// ─── Muster Engine ───────────────────────────────────────────────────────────
// Chunk M4 — the strategic ↔ battle bridge. Pure mapping both directions:
// strategic TroopUnit/Character records → BattleUnit/captain roster (before
// a battle), and BattleOutcome → strategic-record write-back (after one).
// Type-only import of GameState (matches troopEngine.ts/trialEngine.ts's
// existing convention) — no store/React coupling.
//
// ── Baseline reconciliation (documented per the plan's §0 instruction to
// stop and flag mismatches between the plan's assumptions and this
// codebase's actual shape) ──
//
//   1. TroopUnit is NOT the "N troops → N/500-scale cohort" record the plan
//      assumed — it's a single strength-1–10 "combat effectiveness" record
//      (troop.ts). Mapped 1:1 instead: one TroopUnit = one BattleUnit, with
//      strength scaled ×10 into BattleUnit's 0–100 range. Simpler, and
//      keeps casualty write-back exact (no splitting/merging troop
//      records).
//   2. TroopUnit already had `bondToCommander` (0–100) — reused directly as
//      BattleUnit.loyalty rather than adding a redundant `loyalty` field.
//      TroopUnit.campaignsSurvived is reused as the M8 veterancy-promotion
//      counter ("engagedBattles" in the plan's prose) for the same reason.
//      Only `unitClass` and `veterancy` were genuinely absent — both added
//      to TroopUnit as optional fields (see troop.ts), defaulted here.
//   3. There is NO existing player-family death/succession system (verified
//      — the only removal path is trial execution/exile, which just
//      filters the character out of `family` with no successor selection;
//      confirmed via `git grep` before writing any code, per the earlier
//      design discussion). `applyCharacterDeath` below is a new, minimal
//      system: eldest surviving son > daughter > spouse inherits
//      `isPlayer`/role: 'paterfamilias'. This ALSO means the pre-existing
//      trial-execution path has the same latent bug (executing/exiling the
//      player paterfamilias currently leaves no isPlayer character at all)
//      — flagged for the user, not silently fixed here (out of M4's scope;
//      trialEngine.ts/turnSequencer.ts's trial-resolution path is untouched
//      except for the one new shouldTriggerTrial branch below).
//   4. There is no generic "temporary character skill debuff" pathway in
//      this codebase (verified — CrisisStatusEffect is a Rome-wide crisis
//      mechanic, unrelated). Wounded status is therefore NOT a
//      Character-level skill mutation. It reuses the EXISTING generic
//      `<key>-cooldown` numeric-flags decay pass already in
//      turnSequencer.ts ("Decrement all numeric cooldown flags") by keying
//      it `flags['wounded-cooldown-<characterId>']` — zero new
//      turnSequencer code. The −2 martial penalty is applied only where
//      M4 actually needs it (captain-roster martial resolution below), not
//      via a cross-cutting skill mutation that every office/election read
//      site would need to account for.
//   5. Ransom's "negotiate (Fides, 60% halve)" is a DEVIATION from the
//      plan's literal probabilistic framing — this codebase's event system
//      only supports deterministic skill-gate checks (skill >= difficulty;
//      verified in eventEngine.ts's resolveChoice), not weighted-random
//      outcomes. Consistent with every other skill-checked choice in the
//      game: intrigus >= BALANCE.war.ransom.negotiateIntrigusDifficulty
//      reliably halves the ransom for a Fides cost; below that, negotiation
//      reliably fails and the Fides is still spent. See resolveRansomChoice.
//      Ransom resolution (pay/negotiate/refuse) is NOT routed through the
//      generic single-shot event-effect-string pipeline — that pipeline has
//      no way to parameterize "release THIS captured character." It follows
//      the same "queued state + dedicated resolution" shape the Trial
//      system already uses (character.captivity, resolved via
//      resolveRansomChoice + a thin gameStore action) rather than inventing
//      argument-passing into event effect strings.
//   6. Triumph qualification: the plan calls this a "v2 triumph
//      qualification pathway" as if it's a dedicated system — it's actually
//      turnSequencer.ts step 9h, which scans state.provinces[].
//      activeCampaign for a resolved non-defeat campaign with a commander
//      (plus a global lifetimeImperium >= 50 gate) and builds a Triumph
//      bill. A crushing set-piece victory tied to a province's active
//      campaign is fed into this EXISTING pathway (marking that campaign
//      resolved/'victory') rather than inventing a parallel mechanism —
//      matches the cross-chunk note to leave non-battle campaign mechanics
//      untouched. Battles not tied to a province campaign (e.g. sandbox)
//      simply don't feed it, gracefully.

import type { Character, CaptivityState } from '../../models/character';
import type { TroopUnit, TroopType } from '../../models/troop';
import type { Clan } from '../../models/clan';
import type { GameState } from '../../state/gameStore';
import type {
  BattleUnit, BattleOutcome, BattleState, BattleSide, LaneId, Veterancy,
} from '../../models/battle';
import type { EventInstance } from '../../models/event';
import { BALANCE } from '../../data/balance';
import { adjustReputation } from '../reputationEngine';
import { injectNoticeEvent } from '../eventEngine';
import { LEADER_PRAENOMINA } from '../../data/clientNames';

const LANES: LaneId[] = ['left', 'centre', 'right'];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ─── Troop ↔ BattleUnit mapping ──────────────────────────────────────────────

function deriveVeterancyFromTroopType(type: TroopType): Veterancy {
  switch (type) {
    case 'garrison':        return 'raw';
    case 'raised':           return 'raw';
    case 'veteran':          return 'veteran';
    case 'seasoned_veteran': return 'legendary';
  }
}

export function troopToBattleUnit(troop: TroopUnit): BattleUnit {
  return {
    id: troop.id,
    unitClass: troop.unitClass ?? 'legionary',
    strength: clamp(troop.strength * 10, 0, 100),
    veterancy: troop.veterancy ?? deriveVeterancyFromTroopType(troop.type),
    loyalty: clamp(troop.bondToCommander, 0, 100),
    elephantSteady: false,
    sourceRef: troop.id,
  };
}

/** Returns null when the unit was destroyed (strength reached 0). */
export function battleUnitToTroop(original: TroopUnit, unit: BattleUnit): TroopUnit | null {
  const newStrength = Math.round(unit.strength / 10);
  if (newStrength <= 0) return null;
  return {
    ...original,
    strength: clamp(newStrength, 1, 10),
    unitClass: unit.unitClass,
    veterancy: unit.veterancy,
    bondToCommander: clamp(unit.loyalty, 0, 100),
    campaignsSurvived: original.campaignsSurvived + 1,
    yearsInactive: 0,
  };
}

// ─── M8: unit lifecycle (veterancy promotion, loyalty, elephant tracking) ──

const VET_TIER_INDEX: Record<Veterancy, number> = { raw: 0, trained: 1, veteran: 2, legendary: 3 };
const VET_TIER_BY_INDEX: Veterancy[] = ['raw', 'trained', 'veteran', 'legendary'];

function clampVet(v: number): number {
  return Math.min(VET_TIER_BY_INDEX.length - 1, Math.max(0, v));
}

/** Recomputes veterancy from campaignsSurvived (engagedBattles) thresholds,
 *  taking the MAX against the unit's current tier — promotion only, never a
 *  downgrade. Needed because a TroopType-derived tier (e.g. 'seasoned_veteran'
 *  → 'legendary', per deriveVeterancyFromTroopType) can already exceed what
 *  campaignsSurvived alone would justify; this function must not undo that. */
export function promotedVeterancy(troop: TroopUnit): Veterancy {
  const current = troop.veterancy ?? deriveVeterancyFromTroopType(troop.type);
  const t = BALANCE.battle.lifecycle.veterancyThresholds;
  let computed = 0;
  if (troop.campaignsSurvived >= t.trained) computed = 1;
  if (troop.campaignsSurvived >= t.veteran) computed = 2;
  if (troop.campaignsSurvived >= t.legendary && troop.wonCrushingVictory) computed = 3;
  return VET_TIER_BY_INDEX[clampVet(Math.max(VET_TIER_INDEX[current], computed))];
}

export interface LifecycleUpdateOpts {
  /** Already-signed delta (may be 0) — combines victory/defeat/commander-change. */
  loyaltyDelta: number;
  /** This unit ended the battle in (or opposite) a lane that contained elephants. */
  elephantSteady: boolean;
  /** This battle was a crushing victory for Rome's side. */
  crushingVictory: boolean;
}

/** Applied AFTER battleUnitToTroop's 1:1 strength/veterancy/loyalty mapping
 *  — layers the M8 season-independent, per-battle lifecycle effects on top:
 *  loyalty delta (clamped), sticky elephantSteady/wonCrushingVictory flags,
 *  and veterancy re-promotion (now that wonCrushingVictory may have just
 *  flipped true, possibly unlocking legendary this same write-back). */
export function applyLifecycleUpdates(troop: TroopUnit, opts: LifecycleUpdateOpts): TroopUnit {
  const wonCrushingVictory = troop.wonCrushingVictory || opts.crushingVictory;
  const elephantSteady = troop.elephantSteady || opts.elephantSteady;
  const withFlags: TroopUnit = {
    ...troop,
    bondToCommander: clamp(troop.bondToCommander + opts.loyaltyDelta, 0, 100),
    elephantSteady,
    wonCrushingVictory,
  };
  return { ...withFlags, veterancy: promotedVeterancy(withFlags) };
}

const LANES_M8: LaneId[] = ['left', 'centre', 'right'];

/** Lanes considered to have "contained elephants" this battle, for
 *  elephantSteady eligibility — union of (a) either side's SURVIVING
 *  elephants in the final state, and (b) any lane where an elephant went
 *  amok (removed from play, but the log records the lane). FIRST-PASS
 *  simplification (documented deviation): a unit that fought an elephant
 *  which was later destroyed by ordinary melee/shock (not amok) in the
 *  SAME lane won't be credited — clashEngine/battleEngine don't track
 *  historical per-lane composition beyond the log's typed entries, and
 *  reconstructing it would be materially more engine surgery than this
 *  chunk's scope. Revisit if this undercounts noticeably in play. */
export function computeElephantLanes(battleState: BattleState): Set<LaneId> {
  const lanes = new Set<LaneId>();
  const hasElephant = (units: BattleUnit[]) => units.some(u => u.unitClass === 'elephant');
  for (const laneId of LANES_M8) {
    if (hasElephant(battleState.attacker.wings[laneId].units) || hasElephant(battleState.defender.wings[laneId].units)) {
      lanes.add(laneId);
    }
  }
  for (const entry of battleState.log) {
    if (entry.type === 'amok') lanes.add(entry.laneId);
  }
  return lanes;
}

/** Musters one character's whole personal force (raised legions + veterans)
 *  into BattleUnits. The plan's "one Roman field army at a time" invariant
 *  means a single character's army is the unit of muster — mixing multiple
 *  characters' troops into one deployment is a future concern, not M4's. */
export function musterArmy(character: Character): BattleUnit[] {
  return [...(character.raisedLegions ?? []), ...(character.veterans ?? [])].map(troopToBattleUnit);
}

// ─── Captains & legates ──────────────────────────────────────────────────────

export interface CaptainCandidate {
  characterId: string;
  name: string;
  martial: number;
  isFamily: true;
}

/** Family members age >= 16, excluding the army's own commander. Effective
 *  martial already reflects the wounded penalty if applicable (see baseline
 *  note 4 above) — pass `state.flags` so the caller doesn't have to. */
export function getEligibleFamilyCaptains(
  family: Character[],
  excludeCharacterId: string,
  flags: Record<string, boolean | number>,
): CaptainCandidate[] {
  return family
    .filter(c => c.id !== excludeCharacterId && c.age >= 16)
    .map(c => ({
      characterId: c.id,
      name: c.name,
      martial: effectiveMartial(c, flags),
      isFamily: true as const,
    }));
}

/** Wounded characters fight (and captain) at reduced effect — see baseline
 *  note 4. Floors at 0, never negative. */
export function effectiveMartial(character: Character, flags: Record<string, boolean | number>): number {
  const wounded = !!flags[`wounded-cooldown-${character.id}`];
  return wounded ? Math.max(0, character.skills.martial - BALANCE.battle.wounds.martialPenalty) : character.skills.martial;
}

export interface LegateOffer {
  legateId: string;
  name: string;
  martial: number;
  clanId: string;
  clanName: string;
}

/** One offerable legate per clan with relationship >= threshold, named per
 *  Phase 2's leader-successor pattern (reputationEngine.ts's
 *  generateSuccessor — same praenomen pool, same "gens + praenomen" shape).
 *  Uses plain Math.random() by default, matching every other non-battle
 *  strategic-layer engine in this codebase (inheritanceEngine.ts,
 *  trialEngine.ts, etc.) — only the tactical battle layer itself
 *  (clashEngine/battleEngine) needs seeded determinism (invariant 2 is
 *  scoped to "every battle takes an RNG seed", not the strategic bridge). */
export function offerableLegates(
  clans: Clan[],
  familyReputations: Record<string, number>,
  rng: () => number = Math.random,
): LegateOffer[] {
  const cmd = BALANCE.battle.command;
  const offers: LegateOffer[] = [];
  for (const clan of clans) {
    const rel = familyReputations[clan.id] ?? 0;
    if (rel < cmd.legateMinRelationship) continue;
    const gensName = (clan as unknown as { gensName?: string }).gensName ?? clan.name.replace(/^Gens\s+/, '');
    const praenomen = LEADER_PRAENOMINA[Math.floor(rng() * LEADER_PRAENOMINA.length)];
    const martial = cmd.legateMartialMin + Math.floor(rng() * (cmd.legateMartialMax - cmd.legateMartialMin + 1));
    offers.push({
      legateId: `legate-${clan.id}-${Math.floor(rng() * 1e9)}`,
      name: `${praenomen} ${gensName}`,
      martial,
      clanId: clan.id,
      clanName: clan.name,
    });
  }
  return offers;
}

// ─── Character death & succession ────────────────────────────────────────────

export interface CharacterDeathResult {
  family: Character[];
  successionOccurred: boolean;
  newPaterfamiliasId: string | null;
  successorName: string | null;
}

/** New minimal system — see baseline note 3. Eldest surviving son > eldest
 *  surviving daughter > eldest surviving spouse inherits `isPlayer` and
 *  role: 'paterfamilias'. No remarriage/widowing modeling. If no heir
 *  exists, the family is left without an isPlayer character — a terminal
 *  state this chunk doesn't otherwise handle (no game-over system exists
 *  yet); callers should treat `newPaterfamiliasId: null` after a player
 *  death as needing further handling upstream. */
export function applyCharacterDeath(family: Character[], deadCharacterId: string): CharacterDeathResult {
  const dead = family.find(c => c.id === deadCharacterId);
  if (!dead) return { family, successionOccurred: false, newPaterfamiliasId: null, successorName: null };

  const remaining = family.filter(c => c.id !== deadCharacterId);
  if (!dead.isPlayer) {
    return { family: remaining, successionOccurred: false, newPaterfamiliasId: null, successorName: null };
  }

  const heirsOfRole = (role: Character['role']) =>
    remaining.filter(c => c.role === role).sort((a, b) => b.age - a.age);
  const successor = heirsOfRole('son')[0] ?? heirsOfRole('daughter')[0] ?? heirsOfRole('spouse')[0] ?? null;

  if (!successor) {
    return { family: remaining, successionOccurred: false, newPaterfamiliasId: null, successorName: null };
  }

  const promoted = remaining.map(c =>
    c.id === successor.id ? { ...c, role: 'paterfamilias' as const, isPlayer: true } : c
  );
  return { family: promoted, successionOccurred: true, newPaterfamiliasId: successor.id, successorName: successor.name };
}

// ─── Ransom resolution (captured characters) ────────────────────────────────
// Modeled like the Trial system: `character.captivity` is queued state,
// resolved via a dedicated action — not the generic event-effect pipeline.
// See baseline note 5.

export interface RansomResolution {
  family: Character[];
  denariiDelta: number;
  fidesDelta: number;
  lifetimeDignitasDelta: number;
  logMessage: string;
}

export function resolveRansomChoice(
  family: Character[],
  characterId: string,
  choice: 'pay' | 'negotiate' | 'refuse',
  playerIntrigus: number,
): RansomResolution {
  const character = family.find(c => c.id === characterId);
  const noop: RansomResolution = { family, denariiDelta: 0, fidesDelta: 0, lifetimeDignitasDelta: 0, logMessage: '' };
  if (!character || !character.captivity || character.captivity.status !== 'awaiting_ransom') return noop;

  const demand = character.captivity.demandDenarii;
  const r = BALANCE.war.ransom;

  if (choice === 'pay') {
    return {
      family: family.map(c => c.id === characterId ? { ...c, captivity: null } : c),
      denariiDelta: -demand, fidesDelta: 0, lifetimeDignitasDelta: 0,
      logMessage: `${character.name} is ransomed home for ${demand} Denarii.`,
    };
  }

  if (choice === 'negotiate') {
    const succeeded = playerIntrigus >= r.negotiateIntrigusDifficulty;
    const paidDenarii = succeeded ? Math.round(demand * r.negotiateSuccessMult) : demand;
    return {
      family: family.map(c => c.id === characterId ? { ...c, captivity: null } : c),
      denariiDelta: -paidDenarii, fidesDelta: -r.negotiateFidesCost, lifetimeDignitasDelta: 0,
      logMessage: succeeded
        ? `Skilled negotiation halves the ransom — ${character.name} comes home for ${paidDenarii} Denarii.`
        : `The negotiation fails to move them — ${character.name} is ransomed home at the full ${paidDenarii} Denarii.`,
    };
  }

  // refuse — imprisoned until a future war-end step releases them (M9/M10;
  // not implemented yet, see baseline note 6's sibling concern).
  const capt: CaptivityState = { ...character.captivity, status: 'imprisoned' };
  return {
    family: family.map(c => c.id === characterId ? { ...c, captivity: capt } : c),
    denariiDelta: 0, fidesDelta: 0, lifetimeDignitasDelta: r.refuseLifetimeDignitasPenalty,
    logMessage: `${character.name} is left to rot in a Carthaginian cell. Word of it costs you dignitas.`,
  };
}

// ─── Notice event builders ───────────────────────────────────────────────────
// All target the PLAYER paterfamilias (not the affected character) — matches
// the existing injectNoticeEvent convention (see turnSequencer.ts's P2-D
// leader-death notice: `player?.id ?? 'pc-1'`, not the dead leader's id).

export function buildWoundedNotice(playerCharacterId: string, turnNumber: number, woundedName: string): EventInstance {
  return injectNoticeEvent('evt-wounded-notice', turnNumber, playerCharacterId, {
    title: `${woundedName} is Wounded`,
    bodyText: `The primus pilus's dispatch is grim: ${woundedName} took a wound in the press of battle. ` +
      `${BALANCE.battle.wounds.durationTurns} seasons before he leads again at full strength.`,
  });
}

export function buildBattleDeathNotice(playerCharacterId: string, turnNumber: number, deadName: string): EventInstance {
  return injectNoticeEvent('evt-battle-death-notice', turnNumber, playerCharacterId, {
    title: `${deadName} Has Fallen`,
    bodyText: `The dispatch is brief, as these things always are: ${deadName} did not survive the field.`,
  });
}

export function buildRansomDemandNotice(
  playerCharacterId: string,
  turnNumber: number,
  capturedName: string,
  demandDenarii: number,
): EventInstance {
  return injectNoticeEvent('evt-ransom-demand-notice', turnNumber, playerCharacterId, {
    title: `${capturedName} is Captured`,
    bodyText: `Word reaches Rome: ${capturedName} lives, but is held. Carthage names a price of ` +
      `${demandDenarii} Denarii for his return.`,
  });
}

export function buildCapturedElephantNotice(playerCharacterId: string, turnNumber: number): EventInstance {
  return injectNoticeEvent('evt-captured-elephant-notice', turnNumber, playerCharacterId, {
    title: 'Beasts of War, Now Ours',
    bodyText: 'The beasts of Carthage now eat from Roman hands. Philon is against it.',
  });
}

// ─── applyBattleOutcome — the main write-back bridge ────────────────────────

export interface BattleBridgeContext {
  /** Whose raisedLegions/veterans were mustered into this battle (see
   *  musterArmy) — the only character whose troop records get touched. */
  troopOwnerCharacterId: string;
  /** captainId -> clan, for any procedurally-generated legates fielded this
   *  battle (they are NOT in state.family). */
  legateRoster: Record<string, { clanId: string; clanName: string }>;
  /** Province this battle was fought as part of, if any — see baseline
   *  note 6. Undefined for sandbox/unlinked battles. */
  provinceId?: string;
  turnNumber: number;
  /** M8 — did the ENEMY side field any elephant-class units at deployment?
   *  Set by the caller from the pre-battle Deployment (survival by
   *  battle's end is irrelevant — a crushing victory is likely to have
   *  destroyed them). Drives the captured-elephant roll below. Undefined =
   *  false (no elephants, no roll) — safe default for older callers. */
  enemyFieldedElephants?: boolean;
}

export interface ApplyBattleOutcomeResult {
  state: GameState;
  /** Human-readable notes, headline first — caller wraps each in mkLog(). */
  ledgerNotes: string[];
}

function isCaptainInBattleSide(side: BattleState['attacker'], captainId: string): boolean {
  if (side.commanderId === captainId) return true;
  return LANES.some(l => side.wings[l].captainId === captainId);
}

function battleHeadline(outcome: BattleOutcome, commanderName: string | null): string {
  const who = commanderName ? `${commanderName}'s army` : 'The army';
  if (outcome.victor === 'withdrawal') return `${who} withdraws from the field in good order.`;
  const tierWord = outcome.tier === 'crushing' ? 'a crushing' : outcome.tier === 'clear' ? 'a clear' : 'a marginal';
  return outcome.victor === 'attacker' || outcome.victor === 'defender'
    ? `${who} ${outcome.warScoreDelta >= 0 ? 'wins' : 'suffers'} ${tierWord} ${outcome.warScoreDelta >= 0 ? 'victory' : 'defeat'}.`
    : `${who} fights to a close.`;
}

export function applyBattleOutcome(
  state: GameState,
  battleState: BattleState,
  romeSide: BattleSide,
  outcome: BattleOutcome,
  ctx: BattleBridgeContext,
): ApplyBattleOutcomeResult {
  const rome = battleState[romeSide];
  const ledgerNotes: string[] = [];

  // M8: lane info is needed alongside each surviving unit (elephantSteady
  // eligibility is lane-scoped) — flatMap into {unit, laneId} pairs instead
  // of a flat unit array.
  type FinalUnitInfo = { unit: BattleUnit; laneId: LaneId | 'reserve' };
  const finalUnitInfos: FinalUnitInfo[] = [
    ...LANES.flatMap(l => rome.wings[l].units.map(unit => ({ unit, laneId: l as LaneId }))),
    ...rome.reserve.map(unit => ({ unit, laneId: 'reserve' as const })),
  ];
  const finalBySourceRef = new Map(
    finalUnitInfos.filter(i => i.unit.sourceRef).map(i => [i.unit.sourceRef as string, i]),
  );
  const elephantLanes = computeElephantLanes(battleState);

  let family = state.family;
  let flags = state.flags;
  let familyReputations = state.familyReputations;
  let lifetimeDignitas = state.lifetimeDignitas;
  let denarii = state.denarii;
  let fides = state.fides;
  let pendingEvents = state.pendingEvents;
  let provinces = state.provinces;

  const playerId = family.find(c => c.isPlayer)?.id ?? ctx.troopOwnerCharacterId;

  // M8: per-battle loyalty delta + commander-change detection, shared by
  // every one of this character's surviving units this write-back.
  const isVictory = outcome.victor === romeSide;
  const isDefeat = outcome.victor !== romeSide && outcome.victor !== 'withdrawal';
  const troopOwner = family.find(c => c.id === ctx.troopOwnerCharacterId);
  const priorCommanderId = troopOwner?.lastLoyaltyCommanderId ?? null;
  const commanderChanged = rome.commanderId !== null && priorCommanderId !== null && rome.commanderId !== priorCommanderId;
  const lc = BALANCE.battle.lifecycle;
  const loyaltyDelta =
    (isVictory ? lc.loyaltyGainPerVictoryShared : isDefeat ? lc.loyaltyLossPerDefeat : 0)
    + (commanderChanged ? lc.loyaltyLossCommanderChange : 0);
  if (commanderChanged) {
    ledgerNotes.push(`${troopOwner?.name ?? 'The army'}'s troops feel the change in command.`);
  }

  // 1. Troop write-back — only the mustering character's arrays. Layers M8's
  // lifecycle updates (loyalty delta, veterancy promotion, elephantSteady,
  // wonCrushingVictory) on top of M4's 1:1 strength/veterancy mapping.
  family = family.map(character => {
    if (character.id !== ctx.troopOwnerCharacterId) return character;
    const updateArray = (arr: TroopUnit[]): TroopUnit[] =>
      arr
        .map(troop => {
          const info = finalBySourceRef.get(troop.id);
          if (!info) return null;
          const mapped = battleUnitToTroop(troop, info.unit);
          if (!mapped) return null;
          return applyLifecycleUpdates(mapped, {
            loyaltyDelta,
            elephantSteady: info.laneId !== 'reserve' && elephantLanes.has(info.laneId),
            crushingVictory: outcome.tier === 'crushing' && isVictory,
          });
        })
        .filter((t): t is TroopUnit => t !== null);
    return {
      ...character,
      raisedLegions: updateArray(character.raisedLegions),
      veterans: updateArray(character.veterans),
      lastLoyaltyCommanderId: rome.commanderId,
    };
  });

  // 2. Character fates.
  for (const co of outcome.captainOutcomes) {
    const legate = ctx.legateRoster[co.characterId];
    if (legate) {
      if (co.result === 'killed') {
        familyReputations = { ...familyReputations, [legate.clanId]:
          adjustReputation(familyReputations[legate.clanId] ?? 0, BALANCE.battle.command.legateDeathRelationshipPenalty).newScore };
        ledgerNotes.push(`${legate.clanName}'s legate has fallen in battle.`);
      }
      continue; // legates aren't Characters — nothing else to write back.
    }

    const character = family.find(c => c.id === co.characterId);
    if (!character) continue;

    if (co.result === 'wounded') {
      flags = { ...flags, [`wounded-cooldown-${character.id}`]: BALANCE.battle.wounds.durationTurns };
      pendingEvents = [...pendingEvents, buildWoundedNotice(playerId, ctx.turnNumber, character.name)];
      ledgerNotes.push(`${character.name} is wounded in battle.`);
    } else if (co.result === 'captured') {
      const demandDenarii = BALANCE.war.ransom.baseDenarii;
      family = family.map(c => c.id === character.id
        ? { ...c, captivity: { status: 'awaiting_ransom', demandDenarii, capturedTurn: ctx.turnNumber } }
        : c);
      pendingEvents = [...pendingEvents, buildRansomDemandNotice(playerId, ctx.turnNumber, character.name, demandDenarii)];
      ledgerNotes.push(`${character.name} has been captured.`);
    } else if (co.result === 'killed') {
      const deathResult = applyCharacterDeath(family, character.id);
      family = deathResult.family;
      pendingEvents = [...pendingEvents, buildBattleDeathNotice(playerId, ctx.turnNumber, character.name)];
      ledgerNotes.push(
        `${character.name} has fallen in battle.`
        + (deathResult.successionOccurred ? ` ${deathResult.successorName} now leads the family.` : '')
      );
    }
  }

  // Legates on the winning side of a crushing victory share the glory —
  // independent of captainOutcomes (the victorious side isn't risk-rolled
  // unless its own lane broke, so a legate who fought well may never appear
  // in outcome.captainOutcomes at all).
  if (outcome.tier === 'crushing' && outcome.victor === romeSide) {
    for (const [legateId, legate] of Object.entries(ctx.legateRoster)) {
      if (!isCaptainInBattleSide(rome, legateId)) continue;
      const alreadyKilled = outcome.captainOutcomes.some(o => o.characterId === legateId && o.result === 'killed');
      if (alreadyKilled) continue;
      familyReputations = { ...familyReputations, [legate.clanId]:
        adjustReputation(familyReputations[legate.clanId] ?? 0, BALANCE.battle.command.legateCrushingVictoryShareBonus).newScore };
    }
  }

  // 3. Triumph / trial hooks — commander only (see baseline note 6).
  if (rome.commanderId) {
    if (outcome.tier === 'crushing' && outcome.victor === romeSide && ctx.provinceId) {
      provinces = provinces.map(p => {
        if (p.id !== ctx.provinceId || !p.activeCampaign || p.activeCampaign.commanderCharacterId !== rome.commanderId) return p;
        return { ...p, activeCampaign: { ...p.activeCampaign, resolved: true, outcome: 'victory' as const } };
      });
    }
    if (isDefeat) {
      flags = { ...flags, [`defeatedGeneral-${rome.commanderId}`]: true };
    }
  }

  // 4. Captured elephants (M8) — crushing victory over an elephant-fielding
  // enemy, once per battle, independent of captainOutcomes.
  if (outcome.tier === 'crushing' && isVictory && ctx.enemyFieldedElephants && Math.random() < BALANCE.battle.elephant.capturedElephantChance) {
    const ownerTroops = [...(troopOwner?.raisedLegions ?? []), ...(troopOwner?.veterans ?? [])];
    const fallbackProvinceId = ctx.provinceId ?? ownerTroops[0]?.musterProvinceId ?? provinces[0]?.id ?? 'latium';
    const capturedElephant: TroopUnit = {
      id: `captured-elephant-${ctx.turnNumber}-${Math.floor(Math.random() * 1e9)}`,
      type: 'raised',
      strength: 10,
      campaignsSurvived: 0,
      yearsInactive: 0,
      bondToCommander: BALANCE.battle.elephant.capturedElephantStartingLoyalty,
      musterProvinceId: fallbackProvinceId,
      unitClass: 'elephant',
      veterancy: 'raw',
    };
    family = family.map(c => (c.id === ctx.troopOwnerCharacterId ? { ...c, veterans: [...c.veterans, capturedElephant] } : c));
    pendingEvents = [...pendingEvents, buildCapturedElephantNotice(playerId, ctx.turnNumber)];
    ledgerNotes.push('The beasts of Carthage now eat from Roman hands.');
  }

  const commanderName = rome.commanderId ? (state.family.find(c => c.id === rome.commanderId)?.name ?? null) : null;
  ledgerNotes.unshift(battleHeadline(outcome, commanderName));

  return {
    state: { ...state, family, flags, familyReputations, lifetimeDignitas, denarii, fides, pendingEvents, provinces },
    ledgerNotes,
  };
}
