// ─── Campaign Resolver ───────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C7 — turn-end campaign
// resolution. Pure: armies + orders (already stored on Army.ordersThisSeason
// by C5's issued player orders and C6's AI orders) + theatre/city context +
// a seed → a fully resolved next state plus a CampaignLog for the Provinciae
// tab's playback to replay (design invariant 2: "resolve, then animate" —
// nothing here is UI, nothing in the UI recomputes anything).
//
// PLAYER-ENGAGEMENT SCOPE NOTE (agreed with the user before this chunk's code
// landed, since C8 — the real tactical battle bridge — doesn't exist yet but
// C5 already ships player attack orders): a battle involving a 'player' or
// 'rome_state' (player-manageable, same convention gameStore.issueMovementOrder
// already uses) army is recorded as a pending Engagement and NOT resolved
// here — same as the plan's own spec. But rather than leave that battle
// genuinely unresolvable until some future chunk (which would make a real
// attack order un-completable in an on-device build, contra "every chunk
// ends with a compiling, playable, testable build"), `resolveEngagement`
// below is exported standalone and reused by gameStore's temporary
// `resolveEngagementAbstract` action — the SAME abstract-battle math this
// file uses inline for NPC-vs-NPC fights, exposed to the player through a
// one-button "Trust the legate" interstitial. C8 replaces the abstract-battle
// math with the real, terrain-aware resolver and ADDS a second "Take the
// field" tactical option alongside this one; it does not need to change this
// function's shape or signature.

import type { Army, ArmyUnit } from '../models/army';
import type { RegionId, TheatreState, Controller } from '../models/theatre';
import type { CityState } from '../models/city';
import type { Character } from '../models/character';
import type { Clan } from '../models/clan';
import type { CampaignLog, CampaignLogEntry, Engagement } from '../models/campaignLog';
import { BALANCE } from '../data/balance';
import { REGIONS, THEATRE_EDGES } from '../data/theatreMap';
import { getAdjacent } from './theatreEngine';
import { armyStrength, armyPowerOf } from './armyEngine';
import { applyForcedMarchAttrition, rollSeaLaneStorm, applyStormAttrition } from './movementEngine';
import { ENEMY_GENERALS } from '../data/enemyGenerals';

// ─── Small shared lookups (local copies — matches this codebase's existing
// per-file "garrisonStrengthAt" convention, e.g. campaignAi.ts, rather than
// exporting a cross-cutting util for a two-line helper) ─────────────────────

function findEdge(a: RegionId, b: RegionId) {
  return THEATRE_EDGES.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

function garrisonStrengthAt(regionId: RegionId, armies: Army[], power: 'rome' | 'carthage'): number {
  return armies
    .filter(a => a.location === regionId && armyPowerOf(a.owner) === power)
    .reduce((sum, a) => sum + armyStrength(a), 0);
}

/** Commander martial, whichever of the three places it lives — a player/
 *  rome_state army's commanderId is a Character id, a rome_rival army's is a
 *  ClanLeader id, a carthage army's is one of the four data/enemyGenerals.ts
 *  ids. No unified "get commander martial" helper exists elsewhere in this
 *  codebase (each system does its own ad hoc lookup — verified) — this is
 *  the campaign layer's own. Returns 0 for a leaderless army. */
function commanderMartial(commanderId: string | null, family: Character[], clans: Clan[]): number {
  if (!commanderId) return 0;
  const familyMember = family.find(c => c.id === commanderId);
  if (familyMember) return familyMember.skills.martial;
  const leader = clans.flatMap(c => c.leaders).find(l => l.id === commanderId);
  if (leader) return leader.skills.martial;
  const general = ENEMY_GENERALS[commanderId];
  if (general) return general.martial;
  return 0;
}

/** A player-manageable Roman army — same 'player'|'rome_state' grouping
 *  gameStore.issueMovementOrder already uses (both take orders from the
 *  player, neither from campaignAi). */
function isPlayerManaged(army: Army): boolean {
  return army.owner === 'player' || army.owner === 'rome_state';
}

function cavalryStrengthShare(army: Army): number {
  const total = army.units.reduce((sum, u) => sum + u.strength, 0);
  if (total === 0) return 0;
  const cav = army.units
    .filter(u => u.unitClass === 'cavalry_heavy' || u.unitClass === 'cavalry_light')
    .reduce((sum, u) => sum + u.strength, 0);
  return cav / total;
}

function applyCasualtyPct(army: Army, pct: number): Army {
  const units: ArmyUnit[] = army.units.map(u => ({ ...u, strength: Math.max(0, u.strength * (1 - pct)) }));
  return { ...army, units };
}

/** Once an order fully resolves (arrived, bounced, stormed, or spent
 *  creating an engagement), a player/rome_state army's ordersThisSeason is
 *  cleared — otherwise the ArmyCard would show a stale, already-executed
 *  order, and next season's resolver would try to re-walk it. AI-owned
 *  (carthage/rome_rival) armies are left untouched: campaignAi's own step
 *  (2g, earlier in turnSequencer than this resolver) reads
 *  ordersThisSeason.raiding to decide next season's "return home" order
 *  BEFORE overwriting it — clearing here would break that, not fix it. */
function clearSpentOrder(army: Army): Army {
  return isPlayerManaged(army) ? { ...army, ordersThisSeason: null } : army;
}

/** Retreat priority (shared by a successful withdrawal and a post-battle
 *  loser): the friendly-controlled land/strait-adjacent region with the
 *  strongest existing friendly garrison, tie-broken by lowest region id —
 *  the plan's own literal "strongest-friendly-adjacent, then lowest region
 *  id" rule. Sea lanes are never a retreat route (a beaten army doesn't
 *  improvise an embarkation). Returns null (→ shattered) if no friendly
 *  neighbor exists. */
function pickRetreatDestination(
  fromRegion: RegionId,
  power: 'rome' | 'carthage',
  armies: Army[],
  theatre: TheatreState,
): RegionId | null {
  const neighbors = [...getAdjacent(fromRegion, 'land'), ...getAdjacent(fromRegion, 'strait')];
  const friendly = neighbors.filter(r => theatre.controllers[r] === power);
  if (friendly.length === 0) return null;
  const ranked = friendly
    .map(r => ({ r, strength: garrisonStrengthAt(r, armies, power) }))
    .sort((a, b) => b.strength - a.strength || (a.r < b.r ? -1 : 1));
  return ranked[0].r;
}

// ─── Abstract battle stub (C7 placeholder — see this file's header comment;
// C8 replaces the math, not the shape) ──────────────────────────────────────

export interface AbstractBattleResult {
  winner: 'attacker' | 'defender';
  tier: 'marginal' | 'clear' | 'crushing';
  casualtyPctWinner: number;
  casualtyPctLoser: number;
}

function computeAbstractBattle(
  attackerPower: number,
  defenderPower: number,
  attackerMartial: number,
  defenderMartial: number,
  rng: () => number,
): AbstractBattleResult {
  const ab = BALANCE.campaign.resolution.abstractBattle;
  const effectiveAttacker = attackerPower * (1 + attackerMartial * ab.martialFactor);
  const effectiveDefender = defenderPower * (1 + defenderMartial * ab.martialFactor);
  const ratio = effectiveAttacker / Math.max(1, effectiveDefender);
  const attackerWinProb = ratio / (ratio + 1);
  const winner: 'attacker' | 'defender' = rng() < attackerWinProb ? 'attacker' : 'defender';
  const margin = Math.abs(attackerWinProb - 0.5) * 2;
  const tier: AbstractBattleResult['tier'] =
    margin >= ab.crushingMarginThreshold ? 'crushing' : margin >= ab.clearMarginThreshold ? 'clear' : 'marginal';
  const casualties = ab.casualtiesByTier[tier];
  return { winner, tier, casualtyPctWinner: casualties.winnerPct, casualtyPctLoser: casualties.loserPct };
}

// ─── Engagement resolution (shared: inline NPC-vs-NPC here, and reused
// standalone later by gameStore's deferred player-engagement action) ───────

export interface EngagementResolution {
  /** Full armies array with both sides updated/removed. Callers pass in
   *  whatever `armies` slice is current at resolution time (inline: the
   *  working mid-season array; deferred: the live gameStore armies array),
   *  and get the same shape back — merge-by-id, so the caller can just
   *  replace its own array wholesale. */
  armies: Army[];
  logEntries: CampaignLogEntry[];
}

/**
 * Resolves one engagement to completion — defender-stance withdrawal roll,
 * else the abstract battle stub; loser retreats (same priority rule) or
 * shatters; the winner occupies the region if it was the attacker (a
 * winning defender was already there). `theatre` is only read (retreat
 * destinations), never returned — control flips are the season-level
 * resolver's own job (step 6), not this function's.
 */
export function resolveEngagement(
  engagement: { regionId: RegionId; attackerArmyId: string; defenderArmyId: string },
  armies: Army[],
  theatre: TheatreState,
  family: Character[],
  clans: Clan[],
  rng: () => number = Math.random,
): EngagementResolution {
  const logEntries: CampaignLogEntry[] = [];
  const attacker = armies.find(a => a.id === engagement.attackerArmyId);
  const defender = armies.find(a => a.id === engagement.defenderArmyId);
  if (!attacker || !defender) return { armies, logEntries };

  const w = BALANCE.campaign.resolution.withdrawal;
  const defenderPower = armyPowerOf(defender.owner);

  if (defender.stance === 'avoid_battle') {
    const defenderMartial = commanderMartial(defender.commanderId, family, clans);
    const avoidCavBonus = cavalryStrengthShare(defender) > cavalryStrengthShare(attacker) ? w.avoidCavBonus : 0;
    const chance = (w.base + defenderMartial * w.martialMult + avoidCavBonus) / 100;
    if (rng() < chance) {
      const dest = pickRetreatDestination(engagement.regionId, defenderPower, armies, theatre);
      const attritted = applyCasualtyPct(defender, w.attritionPct);
      let finalDefender: Army | null;
      if (dest) {
        finalDefender = clearSpentOrder({ ...attritted, location: dest });
        logEntries.push({
          type: 'withdrawal', armyId: defender.id, armyName: defender.name,
          from: engagement.regionId, to: dest,
          text: `${defender.name} withdraws from ${engagement.regionId} rather than give battle.`,
        });
      } else {
        const captured = rng() < BALANCE.campaign.resolution.shatterCaptureChance;
        finalDefender = null;
        logEntries.push({
          type: 'shatter', armyId: defender.id, armyName: defender.name, at: engagement.regionId, captured,
          text: `${defender.name}, cut off from retreat, scatters rather than stand. ${captured ? 'Its commander is taken.' : 'Its commander escapes.'}`,
        });
      }
      const finalAttacker = clearSpentOrder({ ...attacker, location: engagement.regionId });
      logEntries.push({
        type: 'move', armyId: attacker.id, armyName: attacker.name,
        from: attacker.location, to: engagement.regionId,
        text: `${attacker.name} occupies ${engagement.regionId} unopposed.`,
      });
      return { armies: mergeSurvivors(armies, attacker.id, finalAttacker, defender.id, finalDefender), logEntries };
    }
    // Failed withdrawal falls through to a real battle below.
  }

  const result = computeAbstractBattle(
    armyStrength(attacker),
    armyStrength(defender),
    commanderMartial(attacker.commanderId, family, clans),
    commanderMartial(defender.commanderId, family, clans),
    rng,
  );
  const winnerIsAttacker = result.winner === 'attacker';
  const winnerArmy = winnerIsAttacker ? attacker : defender;
  const loserArmy = winnerIsAttacker ? defender : attacker;
  const loserPower = armyPowerOf(loserArmy.owner);

  const winnerAfterCasualties = applyCasualtyPct(winnerArmy, result.casualtyPctWinner);
  const loserAfterCasualties = applyCasualtyPct(loserArmy, result.casualtyPctLoser);

  logEntries.push({
    type: 'battle',
    regionId: engagement.regionId,
    attackerArmyId: attacker.id,
    defenderArmyId: defender.id,
    winnerArmyId: winnerArmy.id,
    loserArmyId: loserArmy.id,
    tier: result.tier,
    text: `${winnerArmy.name} wins a ${result.tier} victory over ${loserArmy.name} at ${engagement.regionId}.`,
  });

  const dest = pickRetreatDestination(engagement.regionId, loserPower, armies, theatre);
  let loserFinal: Army | null;
  if (dest) {
    loserFinal = clearSpentOrder({ ...loserAfterCasualties, location: dest });
    logEntries.push({
      type: 'withdrawal', armyId: loserArmy.id, armyName: loserArmy.name,
      from: engagement.regionId, to: dest,
      text: `${loserArmy.name} falls back to ${dest}.`,
    });
  } else {
    const captured = rng() < BALANCE.campaign.resolution.shatterCaptureChance;
    loserFinal = null;
    logEntries.push({
      type: 'shatter', armyId: loserArmy.id, armyName: loserArmy.name, at: engagement.regionId, captured,
      text: `${loserArmy.name} is shattered, with no line of retreat. ${captured ? 'Its commander is taken.' : 'Its commander escapes.'}`,
    });
  }

  const winnerFinal: Army = winnerIsAttacker
    ? clearSpentOrder({ ...winnerAfterCasualties, location: engagement.regionId })
    : clearSpentOrder(winnerAfterCasualties);

  const finalAttacker = winnerIsAttacker ? winnerFinal : loserFinal;
  const finalDefender = winnerIsAttacker ? loserFinal : winnerFinal;
  return { armies: mergeSurvivors(armies, attacker.id, finalAttacker, defender.id, finalDefender), logEntries };
}

function mergeSurvivors(
  armies: Army[],
  attackerId: string,
  finalAttacker: Army | null,
  defenderId: string,
  finalDefender: Army | null,
): Army[] {
  return armies
    .map(a => {
      if (a.id === attackerId) return finalAttacker;
      if (a.id === defenderId) return finalDefender;
      return a;
    })
    .filter((a): a is Army => a !== null);
}

// ─── Season resolution ──────────────────────────────────────────────────────

export interface CampaignResolutionInput {
  armies: Army[];
  theatre: TheatreState;
  cities: CityState[];
  family: Character[];
  clans: Clan[];
  denarii: number;
  seasonIndex: number;
  turnNumber: number;
}

export interface CampaignResolutionResult {
  armies: Army[];
  theatre: TheatreState;
  cities: CityState[];
  denarii: number;
  log: CampaignLog;
  pendingEngagements: Engagement[];
  headlines: string[];
}

interface WorkingOrder {
  armyId: string;
  path: RegionId[];
  stepIndex: number;
  forcedMarch: boolean;
  intent: 'move' | 'attack';
  raiding: boolean;
  halted: boolean;
}

/**
 * Resolves one season of the campaign — the plan's 8-step resolution order,
 * §Chunk C7. Deterministic given `rng`. Player-manageable-army engagements
 * are NOT resolved here (see this file's header comment) — they come back
 * as `pendingEngagements`, unresolved, for gameStore to surface via the
 * (temporary, abstract-only) engagement interstitial, which calls the same
 * `resolveEngagement` above once the player acts.
 */
export function resolveCampaignSeason(
  input: CampaignResolutionInput,
  rng: () => number = Math.random,
): CampaignResolutionResult {
  const { theatre, cities, family, clans, seasonIndex, turnNumber } = input;
  const entries: CampaignLogEntry[] = [];
  const headlines: string[] = [];
  let denarii = input.denarii;

  const armyMap = new Map<string, Army>(input.armies.map(a => [a.id, a]));

  // ── Step 1: initiative ───────────────────────────────────────────────────
  const res = BALANCE.campaign.resolution;
  const orders: WorkingOrder[] = [];
  for (const army of input.armies) {
    const order = army.ordersThisSeason;
    if (!order || order.path.length < 2) continue;
    orders.push({
      armyId: army.id,
      path: order.path,
      stepIndex: 0,
      forcedMarch: order.forcedMarch,
      intent: order.intent,
      raiding: !!order.raiding,
      halted: false,
    });
  }
  const tiebreak = new Map<string, number>(orders.map(o => [o.armyId, rng()]));
  function initiativeScore(o: WorkingOrder): number {
    const army = armyMap.get(o.armyId)!;
    if (!army.commanderId) return -Infinity;
    const martial = commanderMartial(army.commanderId, family, clans);
    return martial + (isPlayerManaged(army) ? res.playerInitiativeBonus : 0);
  }
  orders.sort((a, b) => {
    const sa = initiativeScore(a);
    const sb = initiativeScore(b);
    if (sa !== sb) return sb - sa;
    return tiebreak.get(b.armyId)! - tiebreak.get(a.armyId)!;
  });

  // Forced-march attrition applies once, up front, at resolution time (not
  // order-issue time — matches movementEngine's own instruction).
  for (const o of orders) {
    if (o.forcedMarch) {
      armyMap.set(o.armyId, applyForcedMarchAttrition(armyMap.get(o.armyId)!));
    }
  }

  const engagementQueue: { regionId: RegionId; attackerArmyId: string; defenderArmyId: string }[] = [];
  const raidedThisSeason: { armyId: string; regionId: RegionId }[] = [];

  // ── Step 2/3: stepwise round-robin movement + sea rolls ─────────────────
  // One region-step per army per round (round-robin, in initiative order),
  // so a fast army can't teleport past a slower interceptor — design
  // invariant/plan text, "resolve, then animate."
  let anyMoved = true;
  while (anyMoved) {
    anyMoved = false;
    for (const o of orders) {
      if (o.halted || o.stepIndex + 1 >= o.path.length) continue;
      const from = o.path[o.stepIndex];
      const to = o.path[o.stepIndex + 1];
      const edge = findEdge(from, to);
      if (!edge) { o.halted = true; continue; }

      if (edge.kind === 'sea') {
        const stormed = rollSeaLaneStorm(edge.laneRisk ?? 0, seasonIndex, rng);
        if (stormed) {
          const army = armyMap.get(o.armyId)!;
          armyMap.set(o.armyId, clearSpentOrder(applyStormAttrition(army)));
          o.halted = true;
          entries.push({
            type: 'storm', armyId: army.id, armyName: army.name, at: from,
            text: `A storm scatters ${army.name}'s crossing — it lands back at ${from}.`,
          });
          anyMoved = true;
          continue;
        }
      }

      const mover = armyMap.get(o.armyId)!;
      const moverPower = armyPowerOf(mover.owner);
      const hostileHere = [...armyMap.values()].find(a => a.location === to && armyPowerOf(a.owner) !== moverPower);

      if (hostileHere) {
        const isFinalStep = o.stepIndex + 1 === o.path.length - 1;
        if (isFinalStep && o.intent === 'attack') {
          engagementQueue.push({ regionId: to, attackerArmyId: mover.id, defenderArmyId: hostileHere.id });
        } else {
          entries.push({
            type: 'bounce', armyId: mover.id, armyName: mover.name, at: from,
            text: `${mover.name} finds the enemy in strength and halts at ${from}.`,
          });
          armyMap.set(mover.id, clearSpentOrder(mover));
        }
        o.halted = true;
        anyMoved = true;
        continue;
      }

      armyMap.set(mover.id, { ...mover, location: to });
      o.stepIndex += 1;
      entries.push({
        type: 'move', armyId: mover.id, armyName: mover.name, from, to,
        text: `${mover.name} marches from ${from} to ${to}.`,
      });
      anyMoved = true;

      if (o.stepIndex === o.path.length - 1) {
        if (o.raiding) raidedThisSeason.push({ armyId: mover.id, regionId: to });
        armyMap.set(mover.id, clearSpentOrder(armyMap.get(mover.id)!));
      }
    }
  }

  // ── Step 4/5: resolve engagements (NPC-vs-NPC inline; player-involving
  // ones queue as pendingEngagements, unresolved — see header comment) ────
  const pendingEngagements: Engagement[] = [];
  let engagementCounter = 0;
  for (const eng of engagementQueue) {
    const attacker = armyMap.get(eng.attackerArmyId);
    const defender = armyMap.get(eng.defenderArmyId);
    if (!attacker || !defender) continue; // one side already resolved away this season (rare multi-engagement overlap)

    if (isPlayerManaged(attacker) || isPlayerManaged(defender)) {
      const id = `engagement-${turnNumber}-${engagementCounter++}`;
      pendingEngagements.push({ id, regionId: eng.regionId, attackerArmyId: eng.attackerArmyId, defenderArmyId: eng.defenderArmyId });
      entries.push({
        type: 'engagement_pending', armyId: attacker.id, armyName: attacker.name, regionId: eng.regionId,
        text: `${attacker.name} finds the enemy at ${eng.regionId} — awaiting your command.`,
      });
      continue;
    }

    const resolution = resolveEngagement(eng, [...armyMap.values()], theatre, family, clans, rng);
    const survivingIds = new Set(resolution.armies.map(a => a.id));
    if (!survivingIds.has(eng.attackerArmyId)) armyMap.delete(eng.attackerArmyId);
    if (!survivingIds.has(eng.defenderArmyId)) armyMap.delete(eng.defenderArmyId);
    for (const a of resolution.armies) armyMap.set(a.id, a);
    entries.push(...resolution.logEntries);
    const battleEntry = resolution.logEntries.find((e): e is Extract<CampaignLogEntry, { type: 'battle' }> => e.type === 'battle');
    if (battleEntry) headlines.push(battleEntry.text);
  }

  // ── Step 6: control flips + raid stings ─────────────────────────────────
  const raidingArmyIds = new Set(raidedThisSeason.map(r => r.armyId));
  const newContested: Record<RegionId, number> = { ...theatre.contested };
  const newControllers: Record<RegionId, Controller> = { ...theatre.controllers };
  for (const region of REGIONS) {
    const controller = theatre.controllers[region.id];
    const occupants = [...armyMap.values()].filter(a => a.location === region.id && !raidingArmyIds.has(a.id));
    const occupier = occupants.find(a => armyPowerOf(a.owner) !== controller);
    if (occupier) {
      const occupierPower = armyPowerOf(occupier.owner);
      const count = (theatre.contested[region.id] ?? 0) + 1;
      if (count >= res.controlFlipThresholdSeasons) {
        newControllers[region.id] = occupierPower;
        newContested[region.id] = 0;
        const text = `${region.name} falls under ${occupierPower === 'rome' ? 'Roman' : 'Carthaginian'} control.`;
        entries.push({ type: 'flip', regionId: region.id, newController: occupierPower, text });
        headlines.push(text);
      } else {
        newContested[region.id] = count;
      }
    } else {
      newContested[region.id] = 0;
    }
  }

  const updatedCities = cities.map(c => ({ ...c }));
  for (const raid of raidedThisSeason) {
    const army = armyMap.get(raid.armyId);
    if (!army) continue;
    const region = REGIONS.find(r => r.id === raid.regionId)!;
    const liveCities = updatedCities.filter(c => region.cityIds.includes(c.id));
    if (liveCities.length > 0) {
      for (const city of liveCities) {
        city.relationshipScore = Math.max(0, Math.min(100, city.relationshipScore + res.raid.relationshipSting));
      }
      if (theatre.controllers[raid.regionId] === 'rome') {
        denarii = Math.max(0, denarii - res.raid.denariiSting);
      }
    }
    const text = `${army.name} raids ${region.name}, then turns for home.`;
    entries.push({ type: 'raid', armyId: army.id, armyName: army.name, regionId: raid.regionId, text });
    headlines.push(text);
  }

  const newTheatre: TheatreState = { ...theatre, controllers: newControllers, contested: newContested };

  return {
    armies: [...armyMap.values()],
    theatre: newTheatre,
    cities: updatedCities,
    denarii,
    log: { turnNumber, entries },
    pendingEngagements,
    headlines: headlines.slice(0, 2),
  };
}
