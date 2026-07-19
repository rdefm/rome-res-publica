// ─── Campaign AI ─────────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C6 — a pure, seeded army AI issuing the same
// MovementOrders players do. Carthaginian armies use one of the four named
// Legate's Line generals' campaign profiles (data/enemyGenerals.ts, extended
// this chunk — "one interface, two layers" per the plan); NPC-Roman rival
// commanders (C4's rome_rival-held command) get a profile derived from their
// ClanLeader stats. No store/React access; Math.random() default RNG params,
// matching every other non-battle strategic-layer engine in this codebase —
// but every function here accepts an explicit rng for the "deterministic
// under seed" test requirement (design invariant 3).

import type { Army, ArmyUnit, MovementOrder } from '../models/army';
import type { RegionId, TheatreState } from '../models/theatre';
import type { CityState } from '../models/city';
import type { Clan, ClanLeader } from '../models/clan';
import type { GeneralProfile } from '../data/enemyGenerals';
import { ENEMY_GENERALS } from '../data/enemyGenerals';
import { REGIONS } from '../data/theatreMap';
import { isFriendly, getRegionRelationship, getAdjacent } from './theatreEngine';
import { armyStrength, armyPowerOf } from './armyEngine';
import { reachable, type ReachableDestination } from './movementEngine';
import { BALANCE } from '../data/balance';

// ─── Shared readers ─────────────────────────────────────────────────────────

function garrisonStrengthAt(regionId: RegionId, armies: Army[], power: 'rome' | 'carthage'): number {
  return armies
    .filter(a => a.location === regionId && armyPowerOf(a.owner) === power)
    .reduce((sum, a) => sum + armyStrength(a), 0);
}

/** Rome-relative relationshipScore, read directionally: a region that likes
 *  Rome is a WEAK Carthaginian hold (low penalty for a Roman advancer, high
 *  penalty for a Carthaginian one) and vice versa — relationshipScore has no
 *  separate "liking Carthage" axis in this codebase, so this is the only
 *  principled way to use one Rome-relative number symmetrically for both
 *  sides (not specified by the plan text; invented here). */
function relationshipPenalty(regionId: RegionId, cities: CityState[], moverPower: 'rome' | 'carthage'): number {
  const rel = getRegionRelationship(cities, regionId);
  return moverPower === 'rome' ? 100 - rel : rel;
}

function opposingPowerOf(power: 'rome' | 'carthage'): 'rome' | 'carthage' {
  return power === 'rome' ? 'carthage' : 'rome';
}

/** HOLD's objective, per the plan's own parenthetical definition: a
 *  friendly-controlled Sicilian region (the only Sicilian region in this
 *  8-region map is 'sicilia' itself — the plan's plural phrasing is a
 *  holdover from its original 14-region sketch) where an enemy army AT or
 *  ADJACENT to it outmuscles the local friendly garrison. */
function isSicilyUnderThreat(armies: Army[], theatre: TheatreState, moverPower: 'rome' | 'carthage'): boolean {
  if (!isFriendly(theatre, 'sicilia', moverPower)) return false;
  const opposing = opposingPowerOf(moverPower);
  const localFriendly = garrisonStrengthAt('sicilia', armies, moverPower);
  const nearbyRegions: RegionId[] = ['sicilia', ...getAdjacent('sicilia')];
  const strongestNearbyEnemy = Math.max(0, ...nearbyRegions.map(r => garrisonStrengthAt(r, armies, opposing)));
  return strongestNearbyEnemy > localFriendly;
}

/** ADVANCE's target region filter is broadened from the plan's literal
 *  "enemy-controlled" to "not friendly-controlled" (i.e. also neutral) —
 *  Sicily starts 'neutral' in this 8-region map (Chunk C1: no single power
 *  holds it at game start), and contesting Sicily is the whole war's point,
 *  so a literal enemy-only filter would make neither side ever advance on
 *  it while it stays neutral. Tries candidates weakest-first, skipping an
 *  occupied one whose defenders clear the (aggression-scaled) attack-ratio
 *  bar, falling through to the next-weakest rather than forcing a bad
 *  fight or aborting ADVANCE outright. */
function pickAdvanceTarget(
  army: Army,
  destinations: ReachableDestination[],
  theatre: TheatreState,
  cities: CityState[],
  armies: Army[],
  profile: GeneralProfile,
): ReachableDestination | null {
  const moverPower = armyPowerOf(army.owner);
  const opposing = opposingPowerOf(moverPower);
  const ai = BALANCE.campaign.ai;
  const effectiveRatio = ai.attackRatioThreshold * (1 - profile.aggression * ai.attackRatioAggressionScale);

  const candidates = destinations
    .filter(d => !isFriendly(theatre, d.regionId, moverPower) && !d.blockedReason)
    .map(d => ({ dest: d, weakness: garrisonStrengthAt(d.regionId, armies, opposing) + relationshipPenalty(d.regionId, cities, moverPower) }))
    .sort((a, b) => a.weakness - b.weakness);

  for (const { dest } of candidates) {
    if (dest.intent === 'move') return dest;
    const defenderStrength = garrisonStrengthAt(dest.regionId, armies, opposing);
    const ratio = defenderStrength > 0 ? armyStrength(army) / defenderStrength : Infinity;
    if (ratio >= effectiveRatio) return dest;
  }
  return null;
}

/** RAID's target: the weakest reachable, not-friendly, UNDEFENDED region —
 *  deterministic by the same weakness ordering ADVANCE uses (garrison is
 *  always 0 here by definition, so this reduces to relationship penalty). */
function pickRaidTarget(
  army: Army,
  destinations: ReachableDestination[],
  theatre: TheatreState,
  cities: CityState[],
  armies: Army[],
): ReachableDestination | null {
  const moverPower = armyPowerOf(army.owner);
  const opposing = opposingPowerOf(moverPower);
  const candidates = destinations
    .filter(d => !isFriendly(theatre, d.regionId, moverPower) && !d.blockedReason)
    .filter(d => garrisonStrengthAt(d.regionId, armies, opposing) === 0)
    .map(d => ({ dest: d, weakness: relationshipPenalty(d.regionId, cities, moverPower) }))
    .sort((a, b) => a.weakness - b.weakness);
  return candidates[0]?.dest ?? null;
}

function returnHomeOrder(
  army: Army,
  armies: Army[],
  theatre: TheatreState,
  seasonIndex: number,
  profile: GeneralProfile,
): MovementOrder | null {
  if (army.location === profile.homePort) return null;
  const home = reachable(army, armies, theatre, seasonIndex, false).find(d => d.regionId === profile.homePort);
  if (!home || home.blockedReason) return null; // can't make it home in one season — sits put (v1 gap, acceptable)
  return { path: home.path, forcedMarch: false, intent: home.intent };
}

// ─── Softmax behavior selection ─────────────────────────────────────────────

type Behavior = 'hold' | 'advance' | 'raid';
const BEHAVIORS: Behavior[] = ['hold', 'advance', 'raid'];

/** Scores use -Infinity (not 0) for "this behavior isn't available at all"
 *  — 0-weighted-but-available would still get uniform probability under a
 *  naive softmax, which is wrong; -Infinity zeroes it out via exp(). */
export function softmaxChoose(
  scores: Record<Behavior, number>,
  weights: { hold: number; advance: number; raid: number },
  temperature: number,
  rng: () => number,
): Behavior {
  const weighted = BEHAVIORS.map(b => (Number.isFinite(scores[b]) ? scores[b] * weights[b] : -Infinity));
  const exps = weighted.map(w => (Number.isFinite(w) ? Math.exp(w / temperature) : 0));
  const sum = exps.reduce((a, b) => a + b, 0);
  if (sum === 0) return 'hold'; // degenerate — callers should already have returned null via the all-invalid guard
  const roll = rng();
  let cumulative = 0;
  for (let i = 0; i < BEHAVIORS.length; i++) {
    cumulative += exps[i] / sum;
    if (roll < cumulative) return BEHAVIORS[i];
  }
  return BEHAVIORS[BEHAVIORS.length - 1];
}

// ─── Per-army order choice ──────────────────────────────────────────────────

/**
 * One army's order for the season — HOLD (returns null, "no order"),
 * ADVANCE, or RAID, softmax-chosen over each behavior's (0/-Infinity
 * validity score × the profile's objectiveWeights). If this army's
 * ordersThisSeason from last time this was called was a raid, it instead
 * unconditionally returns home this call — see MovementOrder.raiding's
 * comment on why this substitutes for C7's not-yet-built "withdraws
 * homeward next season" resolution step.
 */
export function chooseSeasonOrders(
  army: Army,
  armies: Army[],
  theatre: TheatreState,
  cities: CityState[],
  seasonIndex: number,
  profile: GeneralProfile,
  rng: () => number = Math.random,
): MovementOrder | null {
  if (army.ordersThisSeason?.raiding) {
    return returnHomeOrder(army, armies, theatre, seasonIndex, profile);
  }

  const moverPower = armyPowerOf(army.owner);
  const destinations = reachable(army, armies, theatre, seasonIndex, false);

  const holdValid = army.location === 'sicilia' && isSicilyUnderThreat(armies, theatre, moverPower);
  const advanceTarget = pickAdvanceTarget(army, destinations, theatre, cities, armies, profile);
  const raidTarget = pickRaidTarget(army, destinations, theatre, cities, armies);

  const scores: Record<Behavior, number> = {
    hold: holdValid ? 1 : -Infinity,
    advance: advanceTarget ? 1 : -Infinity,
    raid: raidTarget ? 1 : -Infinity,
  };
  if (!Number.isFinite(scores.hold) && !Number.isFinite(scores.advance) && !Number.isFinite(scores.raid)) {
    return null;
  }

  const chosen = softmaxChoose(scores, profile.objectiveWeights, BALANCE.campaign.ai.softmaxTemperature, rng);

  if (chosen === 'advance' && advanceTarget) {
    return { path: advanceTarget.path, forcedMarch: false, intent: advanceTarget.intent };
  }
  if (chosen === 'raid' && raidTarget) {
    return { path: raidTarget.path, forcedMarch: false, intent: 'move', raiding: true };
  }
  return null; // 'hold', or a chosen behavior whose target vanished between scoring and here (can't happen — same call, no mutation between)
}

// ─── Profile resolution ─────────────────────────────────────────────────────

/** Which of the four named generals commands this Carthage army — falls
 *  back to Xanthippus (balanced-disciplined) for any Carthage army whose
 *  commanderId isn't one of the four (debug-spawned test armies, or any
 *  future "who commands which Carthage army" assignment this codebase
 *  doesn't have yet). */
export function profileForCarthageArmy(army: Army): GeneralProfile {
  if (army.commanderId && ENEMY_GENERALS[army.commanderId]) return ENEMY_GENERALS[army.commanderId];
  return ENEMY_GENERALS.xanthippus_drillmaster;
}

/** NPC-Roman commanders (a rome_rival command's holder, a ClanLeader — see
 *  Chunk C4) get a profile computed from character stats, per the plan's
 *  own formula. The battle-only fields (armyComposition etc.) are inert
 *  placeholders — a rival command's army only ever fights via C8's abstract
 *  resolver, never the tactical battle screen, so nothing reads them. */
export function deriveNpcRomanProfile(leader: ClanLeader): GeneralProfile {
  const ai = BALANCE.campaign.ai;
  const martial = leader.skills.martial;
  const aggression = (martial / 10) * 0.8;
  const caution = (10 - martial) / 10;
  // "hold/advance from a personality trait if one exists" (plan text,
  // marked verify) — data/traits.ts has no defensive/cautious trait at all,
  // only martial-flavoured ones ('conqueror', 'soldier_born'); used here as
  // a partial advance-weight signal, "else default" for everything else.
  const advanceBonus = leader.traits?.some(t => t === 'conqueror' || t === 'soldier_born') ? ai.traitAdvanceBonus : 0;

  return {
    id: `npc-roman-${leader.id}`,
    name: leader.name,
    epithet: '',
    martial,
    armyComposition: {},
    aggression,
    reservePatience: 2,
    formationPreferenceWeights: {},
    feintPreference: 0,
    pursueBias: 0,
    flavour: { preBattle: '', victory: '', defeat: '' },
    caution,
    objectiveWeights: {
      hold: ai.defaultObjectiveWeights.hold,
      advance: ai.defaultObjectiveWeights.advance + advanceBonus,
      raid: ai.defaultObjectiveWeights.raid,
    },
    homePort: 'latium',
    deceptionChance: ai.defaultDeceptionChance,
  };
}

// ─── Strategic controllers (assign orders across every army of one side) ───

/**
 * Every Carthage army's order for the season, with the plan's two hard
 * rules applied afterward: the army stationed at Lilybaeum never leaves
 * sicilia, and at least one Carthage army stays in sicilia for as long as
 * Carthage holds any city there.
 */
export function assignCarthaginianOrders(
  armies: Army[],
  theatre: TheatreState,
  cities: CityState[],
  seasonIndex: number,
  rng: () => number = Math.random,
): Map<string, MovementOrder | null> {
  const carthageArmies = armies.filter(a => a.owner === 'carthage');
  const orders = new Map<string, MovementOrder | null>();

  for (const army of carthageArmies) {
    const profile = profileForCarthageArmy(army);
    orders.set(army.id, chooseSeasonOrders(army, armies, theatre, cities, seasonIndex, profile, rng));
  }

  const leavesRegion = (order: MovementOrder | null | undefined, regionId: RegionId) =>
    !!order && order.path[order.path.length - 1] !== regionId;

  // Hard rule 1 — never voluntarily abandon Lilybaeum.
  const lilybaeumArmy = carthageArmies.find(a => a.stationedCityId === 'lilybaeum');
  if (lilybaeumArmy && leavesRegion(orders.get(lilybaeumArmy.id), 'sicilia')) {
    orders.set(lilybaeumArmy.id, null);
  }

  // Hard rule 2 — keep >= 1 army in sicilia while Carthage controls any
  // city there.
  const sicilia = REGIONS.find(r => r.id === 'sicilia')!;
  const carthageHoldsSicilianCity = cities.some(c => sicilia.cityIds.includes(c.id) && c.owner === 'carthage');
  if (carthageHoldsSicilianCity) {
    const armiesAtSicilia = carthageArmies.filter(a => a.location === 'sicilia');
    const staying = armiesAtSicilia.filter(a => !leavesRegion(orders.get(a.id), 'sicilia'));
    if (armiesAtSicilia.length > 0 && staying.length === 0) {
      // Pin the strongest — pinning the weakest would leave the island
      // under-defended right when this rule exists to prevent exactly that.
      const strongest = [...armiesAtSicilia].sort((a, b) => armyStrength(b) - armyStrength(a))[0];
      orders.set(strongest.id, null);
    }
  }

  return orders;
}

/** Every rome_rival army's order for the season — the same three
 *  behaviors, no hard rules (those are Carthage-specific). A rival army
 *  whose commanderId doesn't resolve to a living ClanLeader gets no order
 *  at all (not even a leaderless move) — a real personality is needed to
 *  decide anything, matching invariant 5's spirit for the one case C5's
 *  own leaderless-move allowance doesn't cover: no decision-maker exists. */
export function assignNpcRomanOrders(
  armies: Army[],
  clans: Clan[],
  theatre: TheatreState,
  cities: CityState[],
  seasonIndex: number,
  rng: () => number = Math.random,
): Map<string, MovementOrder | null> {
  const rivalArmies = armies.filter(a => a.owner === 'rome_rival');
  const allLeaders = clans.flatMap(c => c.leaders);
  const orders = new Map<string, MovementOrder | null>();

  for (const army of rivalArmies) {
    const leader = army.commanderId ? allLeaders.find(l => l.id === army.commanderId) : undefined;
    if (!leader) {
      orders.set(army.id, null);
      continue;
    }
    const profile = deriveNpcRomanProfile(leader);
    orders.set(army.id, chooseSeasonOrders(army, armies, theatre, cities, seasonIndex, profile, rng));
  }

  return orders;
}

// ─── Carthaginian reinforcements ────────────────────────────────────────────

export function shouldReinforceCarthage(turnNumber: number): boolean {
  return turnNumber % BALANCE.campaign.ai.reinforcementInterval === 0;
}

function buildCarthageReinforcementUnits(turnNumber: number): ArmyUnit[] {
  const { reinforcementCohorts } = BALANCE.campaign.ai;
  return Array.from({ length: reinforcementCohorts }, (_, i) => ({
    id: `carthage-reinforcement-${turnNumber}-${i}`,
    unitClass: 'spear_foot' as const,
    strength: 100,
    veterancy: 'raw' as const,
    loyalty: 60,
    elephantSteady: false,
    homeRegion: 'africa' as RegionId,
    raisedBy: 'npc' as const,
    campaignsSurvived: 0,
    wonCrushingVictory: false,
    raisedSeason: turnNumber,
  }));
}

/** Adds this season's reinforcement cohorts to an existing Carthage army
 *  already at africa, or founds a new one there (caller-supplied id, per
 *  this codebase's "engines don't call Date.now()" convention). War-standing
 *  scaling is C9's hook (not built) — a first-pass flat batch every
 *  reinforcementInterval seasons for now. */
export function applyCarthageReinforcement(armies: Army[], turnNumber: number, newArmyId: string): Army[] {
  const units = buildCarthageReinforcementUnits(turnNumber);
  const existingHome = armies.find(a => a.owner === 'carthage' && a.location === 'africa');
  if (existingHome) {
    return armies.map(a => (a.id === existingHome.id ? { ...a, units: [...a.units, ...units] } : a));
  }
  const africaRegion = REGIONS.find(r => r.id === 'africa');
  const newArmy: Army = {
    id: newArmyId,
    name: 'Carthaginian Reinforcements',
    owner: 'carthage',
    commanderId: null,
    location: 'africa',
    stationedCityId: africaRegion?.cityIds[0] ?? null,
    units,
    stance: 'give_battle',
    ordersThisSeason: null,
    fatigued: false,
    unpaidSeasons: 0,
  };
  return [...armies, newArmy];
}

// ─── Telegraphing (design invariant 6) ──────────────────────────────────────

export type CampaignIntent = 'entrenched' | 'advancing' | 'raiding';
const ALL_INTENTS: CampaignIntent[] = ['entrenched', 'advancing', 'raiding'];

/** The TRUE intent behind an order — both 'move' and 'attack' read as
 *  "advancing" at this telegraph-icon granularity (the plan's three-icon
 *  vocabulary doesn't distinguish them; ArmyCard shows the real move/attack
 *  split separately for the player's own armies via ordersThisSeason.intent
 *  directly, same as before this chunk). */
export function trueIntentFor(order: MovementOrder | null): CampaignIntent {
  if (!order) return 'entrenched';
  if (order.raiding) return 'raiding';
  return 'advancing';
}

/** What the intent icon actually SHOWS — truthful with probability
 *  1 − deceptionChance, otherwise a uniformly random WRONG intent. Per the
 *  plan, this is meant to be computed once at the end of C7's resolution
 *  for the FOLLOWING season and stored for ArmyCard to read; C7 doesn't
 *  exist yet, so nothing calls this outside tests today — see SITEMAP.md
 *  for what ArmyCard shows in the meantime. */
export function telegraphIntent(
  trueIntent: CampaignIntent,
  deceptionChance: number,
  rng: () => number = Math.random,
): CampaignIntent {
  if (rng() >= deceptionChance) return trueIntent;
  const lies = ALL_INTENTS.filter(i => i !== trueIntent);
  return lies[Math.floor(rng() * lies.length)];
}
