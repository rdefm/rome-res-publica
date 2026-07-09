// ─── Lane Clash Engine ───────────────────────────────────────────────────────
// Chunk M2 — pure, seeded resolution of ONE round of ONE lane. No state/React
// imports; battleEngine.ts (M3) is the only production caller, stitching
// per-lane results across all three lanes into a BattleLog.
//
// Resolution order (fixed — rome-military-implementation-plan.md §Chunk M2):
//   1. Prelude    — elephant panic chip (skirmishers vs elephants), first
//                    engaged round of the pairing only.
//   2. Feint      — if either lane ordered feigned_retreat this round, ONLY
//                    the feint resolves (it supersedes shock/melee for the
//                    round — a feigned retreat is a manoeuvre, not a clash).
//   3. Shock      — charging classes' shock × decay × terrain × matchup
//                    (incoming) × formation (incoming) × skirmisher screen.
//   4. Melee      — effective atk vs effective def both directions.
//   5. Morale     — casualty drain, terror, wavering, wedge stall.
//   6. (No log entries here — resolveLaneClash returns structured data;
//      the orchestrator (M3) is responsible for shaping RoundLogEntry
//      fragments from it.)
//
// Scope boundary: this module has no cross-lane awareness (wheel/flank
// resolution spans lanes, so it lives in battleEngine.ts, M3). `flanked`/
// `overextended` are read here as *inputs* (statuses already set by the
// orchestrator for this round) — clashEngine never sets them itself.
//
// Interpretation notes (spec left these underspecified; documented here for
// the M11 tuning pass to revisit):
//   - Shock's morale/casualty conversion constants (BALANCE.battle.shock.
//     moraleDeltaPerShockPoint / casualtyPctPerShockPoint) were not given
//     explicit values by the plan (only the decay curve was) — first-pass
//     values added to balance.ts, marked FIRST-PASS/UNVERIFIED.
//   - Matchup `incomingShockMult` is applied per attacking unit's class,
//     strength-weighted across the defending lane's own composition (so a
//     100% spear_foot lane gets the full ×0.25 vs cavalry_heavy; a mixed
//     lane gets a blended reduction).
//   - "Weakest-first tiebreak" for casualty distribution: lowest-strength
//     units absorb losses first.
//   - Feint's "weakest-morale unit routs" (botch) reads as lowest-strength
//     unit — BattleUnit has no per-unit morale field, only the wing pool.
//   - If a lane feints, the WHOLE round for that lane pairing resolves as
//     the manoeuvre only (steps 3–4 skipped for that lane) — feigned
//     retreat is a manoeuvre, not a stance to fight from.

import type {
  BattleUnit, UnitClass, FormationId, TerrainMod, Veterancy,
} from '../../models/battle';
import { BALANCE } from '../../data/balance';
import type { RngFn } from '../../utils/seededRng';
import { rngPercent } from '../../utils/seededRng';

// ─── Small helpers ───────────────────────────────────────────────────────────

const VET_TIER_INDEX: Record<Veterancy, number> = { raw: 0, trained: 1, veteran: 2, legendary: 3 };
const CAVALRY_CLASSES: UnitClass[] = ['cavalry_heavy', 'cavalry_light'];

function isCavalry(c: UnitClass): boolean {
  return CAVALRY_CLASSES.includes(c);
}

function totalStrength(units: BattleUnit[]): number {
  return units.reduce((sum, u) => sum + u.strength, 0);
}

function strengthWeightedAvg(units: BattleUnit[], value: (u: BattleUnit) => number): number {
  const total = totalStrength(units);
  if (total <= 0) return 0;
  return units.reduce((sum, u) => sum + value(u) * u.strength, 0) / total;
}

function classStrength(units: BattleUnit[], cls: UnitClass): number {
  return units.filter(u => u.unitClass === cls).reduce((sum, u) => sum + u.strength, 0);
}

/** Distributes `points` (strength points, not a percentage) of casualties
 *  across `units`, weakest (lowest current strength) first. Returns a map of
 *  unitId → strength lost (never more than the unit had). */
function distributeCasualties(units: BattleUnit[], points: number): Map<string, number> {
  const losses = new Map<string, number>();
  let remaining = Math.max(0, points);
  const sorted = [...units].sort((a, b) => a.strength - b.strength);
  for (const u of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(u.strength, remaining);
    if (take > 0) losses.set(u.id, take);
    remaining -= take;
  }
  return losses;
}

function mergeLosses(into: Map<string, number>, from: Map<string, number>): void {
  for (const [id, amount] of from) {
    into.set(id, (into.get(id) ?? 0) + amount);
  }
}

// ─── Matchup lookup ──────────────────────────────────────────────────────────

export interface MatchupEffect {
  atkDelta: number;
  defDelta: number;
  incomingShockMult: number;
}

/** Sums every applicable matchup rule for `subjectClass` given the opposing
 *  lane's class composition. `firstClash` gates rules marked firstClashOnly.
 *  Exported for direct testing/debug display — see BALANCE.battle.matchups. */
export function lookupMatchup(subjectClass: UnitClass, opposingClasses: Set<UnitClass>, firstClash: boolean): MatchupEffect {
  const effect: MatchupEffect = { atkDelta: 0, defDelta: 0, incomingShockMult: 1 };
  for (const rule of BALANCE.battle.matchups) {
    if (rule.subjectClass !== subjectClass) continue;
    if (!opposingClasses.has(rule.vsClass)) continue;
    if (rule.firstClashOnly && !firstClash) continue;
    effect.atkDelta += rule.atkDelta ?? 0;
    effect.defDelta += rule.defDelta ?? 0;
    if (rule.incomingShockMult !== undefined) effect.incomingShockMult *= rule.incomingShockMult;
  }
  return effect;
}

/** Strength-weighted average incoming-shock matchup multiplier for a whole
 *  defending lane against one attacking unit class. */
function laneIncomingShockMatchupMult(defenders: BattleUnit[], attackerClass: UnitClass, firstClash: boolean): number {
  return strengthWeightedAvg(defenders, u => lookupMatchup(u.unitClass, new Set([attackerClass]), firstClash).incomingShockMult) || 1;
}

// ─── Captain/commander multiplier ───────────────────────────────────────────

export interface SideClashMods {
  /** This lane's own captain martial (0–10). Null = unled (or superseded by
   *  the commander being personally stationed here — see below). */
  laneCaptainMartial: number | null;
  /** Set when the army commander is personally stationed in THIS lane — his
   *  martial is used at full effect, superseding laneCaptainMartial. */
  commanderInLaneMartial: number | null;
  /** Set when the army commander is in reserve — applies a half-effect
   *  multiplier stacked on top of every lane, this one included. */
  commanderReserveMartial: number | null;
}

export const NO_CAPTAIN_MODS: SideClashMods = {
  laneCaptainMartial: null,
  commanderInLaneMartial: null,
  commanderReserveMartial: null,
};

export function captainAtkDefMult(mods: SideClashMods): number {
  const { captainAtkDefMultPerMartial, commanderReserveMultPerMartial } = BALANCE.battle.command;
  const baseMartial = mods.commanderInLaneMartial ?? mods.laneCaptainMartial;
  const base = baseMartial != null ? 1 + captainAtkDefMultPerMartial * baseMartial : 1;
  const reserveMult = mods.commanderReserveMartial != null
    ? 1 + commanderReserveMultPerMartial * mods.commanderReserveMartial
    : 1;
  return base * reserveMult;
}

// ─── Effective stat bundle (exported for the debug sandbox, M11) ───────────

export interface EffectiveUnitStats {
  unitId: string;
  unitClass: UnitClass;
  strength: number;
  atk: number;
  def: number;
  /** This round's outgoing shock, post-decay. 0 once decayed out. */
  shock: number;
}

export interface EffectiveSideBundle {
  units: EffectiveUnitStats[];
  totalAtk: number;
  totalDef: number;
  totalShock: number;
  captainAtkDefMult: number;
  summary: string;
}

export interface BuildEffectiveSideParams {
  units: BattleUnit[];
  formation: FormationId;
  opposingUnits: BattleUnit[];
  mods: SideClashMods;
  terrain: TerrainMod;
  /** This side's terrain role — terrain.mods.attackerAtk/defenderDef are
   *  role-keyed, not lane-keyed. */
  terrainRole: 'attacker' | 'defender';
  engagedRounds: number;
  flanked: boolean;
  overextended: boolean;
}

export function buildEffectiveSide(params: BuildEffectiveSideParams): EffectiveSideBundle {
  const { units, formation, opposingUnits, mods, terrain, terrainRole, engagedRounds, flanked, overextended } = params;
  const opposingClasses = new Set(opposingUnits.map(u => u.unitClass));
  const firstClash = engagedRounds === 0;
  const cMult = captainAtkDefMult(mods);
  const formationStats = formation === 'feigned_retreat' ? null : BALANCE.battle.formations[formation];
  const shockDecayMult =
    engagedRounds === 0 ? BALANCE.battle.shock.firstRoundMult
    : engagedRounds === 1 ? BALANCE.battle.shock.secondRoundMult
    : BALANCE.battle.shock.thirdPlusRoundMult;

  const terrainAtkMult = terrainRole === 'attacker' ? (terrain.mods.attackerAtk ?? 1) : 1;
  const terrainDefMult = terrainRole === 'defender' ? (terrain.mods.defenderDef ?? 1) : 1;
  const flankedDefMult = flanked ? BALANCE.battle.break.wheelFlankedDefMult : 1;
  const overextendedDefMult = overextended ? BALANCE.battle.feint.successEnemyOverextendedDefMult : 1;

  const statUnits: EffectiveUnitStats[] = units.map(u => {
    const base = BALANCE.battle.unitStats[u.unitClass];
    const vet = BALANCE.battle.veterancy[u.veterancy];
    const matchup = lookupMatchup(u.unitClass, opposingClasses, firstClash);
    const strengthFrac = u.strength / 100;

    const atk =
      (base.atk + matchup.atkDelta) * vet.statMult
      * (formationStats?.atkMult ?? 1)
      * cMult
      * terrainAtkMult
      * strengthFrac;

    const def =
      (base.def + matchup.defDelta) * vet.statMult
      * (formationStats?.defMult ?? 1)
      * cMult
      * terrainDefMult
      * flankedDefMult
      * overextendedDefMult
      * strengthFrac;

    const cavalryTerrainMult = isCavalry(u.unitClass) ? (terrain.mods.cavalryShock ?? 1) : 1;
    const shock = base.shock * vet.statMult * shockDecayMult * cavalryTerrainMult * strengthFrac;

    return { unitId: u.id, unitClass: u.unitClass, strength: u.strength, atk, def, shock };
  });

  const totalAtk = statUnits.reduce((s, u) => s + u.atk, 0);
  const totalDef = statUnits.reduce((s, u) => s + u.def, 0);
  const totalShock = statUnits.reduce((s, u) => s + u.shock, 0);

  const summary = `formation=${formation} captainMult=${cMult.toFixed(2)} terrain(atk=${terrainAtkMult},def=${terrainDefMult}) flanked=${flanked} overextended=${overextended}`;

  return { units: statUnits, totalAtk, totalDef, totalShock, captainAtkDefMult: cMult, summary };
}

// ─── Feint ───────────────────────────────────────────────────────────────────

export type FeintResult = 'success' | 'failure' | 'botch';

/** Exported for direct testing — see BALANCE.battle.feint gating fields. */
export function isFeintGated(units: BattleUnit[]): boolean {
  const anyLegendary = units.some(u => u.veterancy === 'legendary');
  if (anyLegendary) return true;
  const avgVetTier = strengthWeightedAvg(units, u => VET_TIER_INDEX[u.veterancy]);
  const avgLoyalty = strengthWeightedAvg(units, u => u.loyalty);
  if (avgVetTier >= VET_TIER_INDEX[BALANCE.battle.feint.minVeterancyAvgTier]) return true;
  if (
    avgVetTier >= VET_TIER_INDEX[BALANCE.battle.feint.minVeterancyAvgTierWithLoyalty]
    && avgLoyalty >= BALANCE.battle.feint.minLoyaltyWithMinVeterancy
  ) return true;
  return false;
}

export interface FeintOutcome {
  attempted: boolean;
  result: FeintResult | null;
  /** Only set on botch — the weakest (lowest-strength) unit that routs. */
  routedUnitId: string | null;
  ownMoraleDelta: number;
  /** This round's own def multiplier (failure only — 0.8 this round). */
  ownDefMultThisRound: number;
}

function resolveFeintAttempt(units: BattleUnit[], rng: RngFn): FeintOutcome {
  const f = BALANCE.battle.feint;
  if (!isFeintGated(units)) {
    return { attempted: false, result: null, routedUnitId: null, ownMoraleDelta: 0, ownDefMultThisRound: 1 };
  }
  const avgLoyalty = strengthWeightedAvg(units, u => u.loyalty);
  const avgVetTier = strengthWeightedAvg(units, u => VET_TIER_INDEX[u.veterancy]);
  const successChance = Math.min(
    f.successCap,
    f.successBase + f.successPerAvgLoyalty * avgLoyalty + f.successPerVeterancyTierIndex * avgVetTier,
  );
  const roll = rngPercent(rng);

  if (roll <= f.botchRollMax) {
    const weakest = [...units].sort((a, b) => a.strength - b.strength)[0] ?? null;
    return {
      attempted: true, result: 'botch', routedUnitId: weakest?.id ?? null,
      ownMoraleDelta: f.botchOwnMoraleDelta, ownDefMultThisRound: 1,
    };
  }
  if (roll <= successChance) {
    return { attempted: true, result: 'success', routedUnitId: null, ownMoraleDelta: 0, ownDefMultThisRound: 1 };
  }
  return {
    attempted: true, result: 'failure', routedUnitId: null,
    ownMoraleDelta: f.failureOwnMoraleDelta, ownDefMultThisRound: f.failureOwnDefMult,
  };
}

// ─── Shock damage (defender-side reductions) ────────────────────────────────

/** 1.0 normally; BALANCE.battle.skirmisherScreen.incomingShockMult once a
 *  lane's own skirmisher strength exceeds the threshold. Exported for direct
 *  testing/debug display. */
export function skirmisherScreenMult(defenders: BattleUnit[]): number {
  const ownSkirmisherStrength = classStrength(defenders, 'skirmisher');
  return ownSkirmisherStrength > BALANCE.battle.skirmisherScreen.minStrength
    ? BALANCE.battle.skirmisherScreen.incomingShockMult
    : 1;
}

/** Whether the elephant-terror morale drain applies to `ownUnits` this
 *  round, given the opposing lane's composition. Exported for direct
 *  testing/debug display. */
export function elephantTerrorApplies(formation: FormationId, ownUnits: BattleUnit[], opposingUnits: BattleUnit[]): boolean {
  const opposingElephantStrength = classStrength(opposingUnits, 'elephant');
  return opposingElephantStrength >= BALANCE.battle.elephant.terrorMinStrengthInLane
    && formation !== 'open_ranks'
    && !ownUnits.every(u => u.elephantSteady);
}

function calcIncomingShockOnSide(
  chargingBundle: EffectiveSideBundle,
  chargingUnits: BattleUnit[],
  defenders: BattleUnit[],
  defendingFormation: FormationId,
  engagedRoundsOfCharger: number,
): number {
  if (chargingBundle.totalShock <= 0) return 0;
  const firstClash = engagedRoundsOfCharger === 0;
  const formationStats = defendingFormation === 'feigned_retreat' ? null : BALANCE.battle.formations[defendingFormation];
  const formationMult = formationStats?.incomingShockMult ?? 1;
  const screenMult = skirmisherScreenMult(defenders);

  let total = 0;
  for (const cu of chargingUnits) {
    const stat = chargingBundle.units.find(u => u.unitId === cu.id);
    if (!stat || stat.shock <= 0) continue;
    const matchupMult = laneIncomingShockMatchupMult(defenders, cu.unitClass, firstClash);
    total += stat.shock * matchupMult * formationMult * screenMult;
  }
  return total;
}

// ─── Prelude (elephant panic chip) ─────────────────────────────────────────

export interface PreludeResult {
  /** unitId → strength damage taken in the prelude. */
  casualties: Map<string, number>;
  /** unitId → amok chance rider (fraction) accrued this battle. */
  amokChanceRiders: Map<string, number>;
}

function resolvePreludeForSide(elephantSideUnits: BattleUnit[], skirmisherSideUnits: BattleUnit[]): PreludeResult {
  const casualties = new Map<string, number>();
  const amokChanceRiders = new Map<string, number>();
  const hasSkirmishers = skirmisherSideUnits.some(u => u.unitClass === 'skirmisher');
  if (!hasSkirmishers) return { casualties, amokChanceRiders };

  const e = BALANCE.battle.elephant;
  for (const u of elephantSideUnits) {
    if (u.unitClass !== 'elephant') continue;
    casualties.set(u.id, Math.min(u.strength, e.skirmisherPreludeStrengthDamage));
    amokChanceRiders.set(u.id, e.skirmisherPreludeAmokChanceDelta);
  }
  return { casualties, amokChanceRiders };
}

// ─── Public: resolveLaneClash ───────────────────────────────────────────────

export interface LaneClashContext {
  terrain: TerrainMod;
  rng: RngFn;
  sideAMods: SideClashMods;
  sideBMods: SideClashMods;
  /** Which side plays the terrain's 'attacker' role — terrain.mods.
   *  attackerAtk/defenderDef are role-keyed, not lane-keyed. */
  attackerSide: 'A' | 'B';
  /** Rounds this exact lane pairing has already fought BEFORE this round —
   *  0 means this round is their first clash. Resets on wheel/reserve
   *  commit (the orchestrator's job to track and pass in). */
  engagedRoundsA: number;
  engagedRoundsB: number;
  /** Current formation orders for the coming round (already applied by the
   *  orchestrator — clashEngine only reads them). */
  formationA: FormationId;
  formationB: FormationId;
  flankedA: boolean;
  flankedB: boolean;
  overextendedA: boolean;
  overextendedB: boolean;
}

export interface LaneClashResult {
  /** unitId → strength lost this round, keyed by originating side. */
  casualtiesA: Map<string, number>;
  casualtiesB: Map<string, number>;
  moraleDeltaA: number;
  moraleDeltaB: number;
  modifiersSummary: string;
  feintA: FeintOutcome | null;
  feintB: FeintOutcome | null;
  /** True if this round was consumed by a feint manoeuvre (shock/melee skipped). */
  wasFeintRound: boolean;
  /** unitId → amok chance rider accrued this round (elephant prelude only). */
  amokChanceRiders: Map<string, number>;
  effectiveA: EffectiveSideBundle;
  effectiveB: EffectiveSideBundle;
  /** Whichever side lost more strength this round — used by the orchestrator
   *  for wavering/wedge-stall bookkeeping already folded into moraleDelta*
   *  above; exposed for logging/tests. */
  roundLoser: 'A' | 'B' | 'tie';
}

export function resolveLaneClash(
  laneAUnits: BattleUnit[],
  laneBUnits: BattleUnit[],
  ctx: LaneClashContext,
): LaneClashResult {
  const {
    terrain, rng, sideAMods, sideBMods, attackerSide,
    engagedRoundsA, engagedRoundsB, formationA, formationB,
    flankedA, flankedB, overextendedA, overextendedB,
  } = ctx;

  // ── 1. Prelude ──────────────────────────────────────────────────────────
  const casualtiesA = new Map<string, number>();
  const casualtiesB = new Map<string, number>();
  const amokChanceRiders = new Map<string, number>();

  if (engagedRoundsA === 0 && engagedRoundsB === 0) {
    const preludeOnA = resolvePreludeForSide(laneAUnits, laneBUnits);
    const preludeOnB = resolvePreludeForSide(laneBUnits, laneAUnits);
    mergeLosses(casualtiesA, preludeOnA.casualties);
    mergeLosses(casualtiesB, preludeOnB.casualties);
    for (const [id, r] of preludeOnA.amokChanceRiders) amokChanceRiders.set(id, r);
    for (const [id, r] of preludeOnB.amokChanceRiders) amokChanceRiders.set(id, r);
  }

  // Apply prelude damage before everything else reads unit strength.
  const laneAAfterPrelude = applyLosses(laneAUnits, casualtiesA);
  const laneBAfterPrelude = applyLosses(laneBUnits, casualtiesB);

  // ── 2. Feint ─────────────────────────────────────────────────────────────
  const aFeinting = formationA === 'feigned_retreat';
  const bFeinting = formationB === 'feigned_retreat';
  let feintA: FeintOutcome | null = null;
  let feintB: FeintOutcome | null = null;
  let moraleDeltaA = 0;
  let moraleDeltaB = 0;

  if (aFeinting) feintA = resolveFeintAttempt(laneAAfterPrelude, rng);
  if (bFeinting) feintB = resolveFeintAttempt(laneBAfterPrelude, rng);

  if (feintA?.result === 'botch' && feintA.routedUnitId) {
    casualtiesA.set(feintA.routedUnitId, (casualtiesA.get(feintA.routedUnitId) ?? 0) + laneAAfterPrelude.find(u => u.id === feintA!.routedUnitId)!.strength);
  }
  if (feintB?.result === 'botch' && feintB.routedUnitId) {
    casualtiesB.set(feintB.routedUnitId, (casualtiesB.get(feintB.routedUnitId) ?? 0) + laneBAfterPrelude.find(u => u.id === feintB!.routedUnitId)!.strength);
  }
  if (feintA) moraleDeltaA += feintA.ownMoraleDelta;
  if (feintB) moraleDeltaB += feintB.ownMoraleDelta;

  const wasFeintRound = feintA?.attempted === true || feintB?.attempted === true;

  const laneAAfterFeint = applyLosses(laneAAfterPrelude, casualtiesA);
  const laneBAfterFeint = applyLosses(laneBAfterPrelude, casualtiesB);

  const effectiveA = buildEffectiveSide({
    units: laneAAfterFeint, formation: formationA, opposingUnits: laneBAfterFeint, mods: sideAMods,
    terrain, terrainRole: attackerSide === 'A' ? 'attacker' : 'defender',
    engagedRounds: engagedRoundsA, flanked: flankedA,
    overextended: overextendedA || (feintA?.result === 'failure'),
  });
  const effectiveB = buildEffectiveSide({
    units: laneBAfterFeint, formation: formationB, opposingUnits: laneAAfterFeint, mods: sideBMods,
    terrain, terrainRole: attackerSide === 'B' ? 'attacker' : 'defender',
    engagedRounds: engagedRoundsB, flanked: flankedB,
    overextended: overextendedB || (feintB?.result === 'failure'),
  });

  let modifiersSummary = `A[${effectiveA.summary}] B[${effectiveB.summary}]`;

  if (wasFeintRound) {
    // Feigned retreat consumes the round for whichever lane(s) attempted it —
    // no shock/melee this round for this pairing.
    return {
      casualtiesA, casualtiesB, moraleDeltaA, moraleDeltaB, modifiersSummary,
      feintA, feintB, wasFeintRound, amokChanceRiders, effectiveA, effectiveB,
      roundLoser: moraleDeltaA === moraleDeltaB ? 'tie' : (moraleDeltaA < moraleDeltaB ? 'A' : 'B'),
    };
  }

  // ── 3. Shock ─────────────────────────────────────────────────────────────
  const shockOnA = calcIncomingShockOnSide(effectiveB, laneBAfterFeint, laneAAfterFeint, formationA, engagedRoundsB);
  const shockOnB = calcIncomingShockOnSide(effectiveA, laneAAfterFeint, laneBAfterFeint, formationB, engagedRoundsA);

  const shockCasualtyPointsA = clampPct(shockOnA * BALANCE.battle.shock.casualtyPctPerShockPoint, 0, BALANCE.battle.shock.maxCasualtyPctFromShock) / 100 * totalStrength(laneAAfterFeint);
  const shockCasualtyPointsB = clampPct(shockOnB * BALANCE.battle.shock.casualtyPctPerShockPoint, 0, BALANCE.battle.shock.maxCasualtyPctFromShock) / 100 * totalStrength(laneBAfterFeint);

  mergeLosses(casualtiesA, distributeCasualties(laneAAfterFeint, shockCasualtyPointsA));
  mergeLosses(casualtiesB, distributeCasualties(laneBAfterFeint, shockCasualtyPointsB));

  moraleDeltaA -= shockOnA * BALANCE.battle.shock.moraleDeltaPerShockPoint;
  moraleDeltaB -= shockOnB * BALANCE.battle.shock.moraleDeltaPerShockPoint;

  const laneAAfterShock = applyLosses(laneAAfterFeint, casualtiesA);
  const laneBAfterShock = applyLosses(laneBAfterFeint, casualtiesB);

  // ── 4. Melee ─────────────────────────────────────────────────────────────
  const m = BALANCE.battle.melee;
  const casualtyPctAtoB = effectiveB.totalDef > 0
    ? clampPct(m.baseCasualtyRate * (effectiveA.totalAtk / effectiveB.totalDef), m.minCasualtyPct, m.maxCasualtyPct)
    : m.maxCasualtyPct;
  const casualtyPctBtoA = effectiveA.totalDef > 0
    ? clampPct(m.baseCasualtyRate * (effectiveB.totalAtk / effectiveA.totalDef), m.minCasualtyPct, m.maxCasualtyPct)
    : m.maxCasualtyPct;

  const meleePointsToB = (casualtyPctAtoB / 100) * totalStrength(laneBAfterShock);
  const meleePointsToA = (casualtyPctBtoA / 100) * totalStrength(laneAAfterShock);

  mergeLosses(casualtiesB, distributeCasualties(laneBAfterShock, meleePointsToB));
  mergeLosses(casualtiesA, distributeCasualties(laneAAfterShock, meleePointsToA));

  modifiersSummary += ` melee(A→B=${casualtyPctAtoB.toFixed(1)}%,B→A=${casualtyPctBtoA.toFixed(1)}%)`;

  // ── 5. Morale accounting ────────────────────────────────────────────────
  const totalLossA = sumLosses(casualtiesA);
  const totalLossB = sumLosses(casualtiesB);
  const preRoundStrengthA = totalStrength(laneAUnits);
  const preRoundStrengthB = totalStrength(laneBUnits);
  const roundLoser: 'A' | 'B' | 'tie' = totalLossA === totalLossB ? 'tie' : (totalLossA > totalLossB ? 'A' : 'B');

  moraleDeltaA -= calcCasualtyDrain(totalLossA, preRoundStrengthA, formationA, laneAAfterFeint, laneBAfterFeint, roundLoser === 'A');
  moraleDeltaB -= calcCasualtyDrain(totalLossB, preRoundStrengthB, formationB, laneBAfterFeint, laneAAfterFeint, roundLoser === 'B');

  return {
    casualtiesA, casualtiesB, moraleDeltaA, moraleDeltaB, modifiersSummary,
    feintA, feintB, wasFeintRound, amokChanceRiders, effectiveA, effectiveB, roundLoser,
  };
}

// ─── Morale drain helper ─────────────────────────────────────────────────────

function calcCasualtyDrain(
  strengthLost: number,
  preRoundStrength: number,
  formation: FormationId,
  ownUnits: BattleUnit[],
  opposingUnits: BattleUnit[],
  lostTheRound: boolean,
): number {
  const cfg = BALANCE.battle.morale;
  const casualtyPct = preRoundStrength > 0 ? (strengthLost / preRoundStrength) * 100 : 0;
  let drain = casualtyPct * cfg.casualtyDrainMult;

  if (elephantTerrorApplies(formation, ownUnits, opposingUnits)) {
    drain += -BALANCE.battle.elephant.terrorMoraleDeltaPerRound; // stored as a negative delta
  }

  const avgLoyalty = strengthWeightedAvg(ownUnits, u => u.loyalty);
  if (lostTheRound && avgLoyalty < BALANCE.battle.loyalty.lowThreshold) {
    drain += -BALANCE.battle.loyalty.lowWaveringMoraleDelta;
  }

  if (formation === 'shield_wall') {
    drain *= BALANCE.battle.formations.shield_wall.wingMoraleDrainMult ?? 1;
  }

  if (formation === 'wedge' && lostTheRound) {
    drain += BALANCE.battle.formations.wedge.extraMoraleLossOnRoundLoss ?? 0;
  }

  return drain;
}

// ─── Small numeric utilities ─────────────────────────────────────────────────

function clampPct(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function sumLosses(losses: Map<string, number>): number {
  let total = 0;
  for (const v of losses.values()) total += v;
  return total;
}

/** Returns a new unit array with cumulative losses applied (non-mutating). */
function applyLosses(units: BattleUnit[], losses: Map<string, number>): BattleUnit[] {
  if (losses.size === 0) return units;
  return units.map(u => {
    const lost = losses.get(u.id);
    if (!lost) return u;
    return { ...u, strength: Math.max(0, u.strength - lost) };
  });
}

// ─── Amok damage (orchestration lives in M3 — this is the shared helper) ───

export interface AmokDamageResult {
  casualtiesA: Map<string, number>;
  casualtiesB: Map<string, number>;
}

/** One round of the amok'd elephant's atk, dealt to BOTH lanes' units
 *  (including its own side), weakest-first; the elephant itself is not
 *  included in either casualty map — the orchestrator removes it separately. */
export function applyAmokDamage(
  elephant: BattleUnit,
  laneAUnits: BattleUnit[],
  laneBUnits: BattleUnit[],
): AmokDamageResult {
  const baseAtk = BALANCE.battle.unitStats.elephant.atk * (elephant.strength / 100);
  const targetsA = laneAUnits.filter(u => u.id !== elephant.id);
  const targetsB = laneBUnits.filter(u => u.id !== elephant.id);
  const totalTargets = targetsA.length + targetsB.length;
  if (totalTargets === 0) return { casualtiesA: new Map(), casualtiesB: new Map() };

  const strengthA = totalStrength(targetsA);
  const strengthB = totalStrength(targetsB);
  const totalStrengthBoth = strengthA + strengthB;
  const pointsA = totalStrengthBoth > 0 ? baseAtk * (strengthA / totalStrengthBoth) : 0;
  const pointsB = totalStrengthBoth > 0 ? baseAtk * (strengthB / totalStrengthBoth) : 0;

  return {
    casualtiesA: distributeCasualties(targetsA, pointsA),
    casualtiesB: distributeCasualties(targetsB, pointsB),
  };
}
