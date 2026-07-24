// ─── Battle Orchestrator ─────────────────────────────────────────────────────
// Chunk M3 — runs a full set-piece battle headless: deployment in, per-round
// orders in, BattleLog + BattleOutcome out. Pure, state-in/state-out; the
// only production import of clashEngine.ts. No React/state imports.
//
// Public API: initBattle, submitOrders, submitBreakDecision, getValidOrders,
// formatBattleLog (the human-readable log formatter M5/M11 reuse).
//
// ── Deviations from the plan's M1/M3 text (documented per §0's instruction) ──
// M1's declared types were an explicit "first pass"; building the actual
// orchestrator surfaced gaps that needed real decisions. All are also noted
// as comments on the model fields themselves (src/models/battle.ts):
//
//   1. Captain martial lookup: clashEngine needs a numeric martial rating for
//      its command multiplier, but battleEngine must stay pure (no Character
//      import). SideState gained `captainMartialById: Record<string,number>`
//      — an opaque id→number map the caller (eventually M4's muster bridge)
//      resolves once from strategic character data.
//   2. Determinism across multiple calls: submitOrders/submitBreakDecision
//      are called many times per battle, each needing to continue the SAME
//      rng sequence. Rather than storing a live RngFn closure on BattleState
//      (which would make it non-serializable — a problem for M5 storing it
//      in gameStore), BattleState tracks `rngCallsConsumed: number`; each
//      call reconstructs makeSeededRng(seed) and fast-forwards that many
//      draws before continuing. Battles are short (≤~15 rounds × ~6 draws),
//      so this is computationally trivial.
//   3. `pendingBreakDecisions` and `startingStrength` were added to
//      BattleState — bookkeeping M1 didn't specify a home for.
//   4. Lane topology stays a fixed Record<LaneId,WingState> per side (no
//      many-to-many lane pairings). A 'wheel' is modeled as: the victor's
//      surviving units in the broken-through lane MOVE into the target
//      lane's unit list (merging with whatever's already fighting there);
//      the original lane goes empty. This keeps the data model simple while
//      preserving the fiction (the winning wing marches over to reinforce/
//      flank the neighbouring fight). The wheel's ×1.5 "shock reset" bonus
//      is approximated by the standard fresh-shock reset (engagedRounds→0)
//      for the wheeling units without an additional explicit multiplier —
//      clashEngine has no per-unit one-time-bonus hook; a true
//      implementation would extend clashEngine further. Flagged for M11.
//   5. Log granularity: M3 emits one consolidated 'clash' entry per
//      contested lane per round (casualties from both sides, one
//      modifiers-summary string) rather than separate shock_charge/terror
//      sub-entries — clashEngine's summary string carries that detail. M5/
//      M6 can split these out later if animation needs finer granularity.
//   6. warScoreDelta sign convention: positive = good for the ATTACKER.
//      The caller (M4/M9) negates it if Rome fought as the defender.
//   7. Character risk rolls (captainOutcomes) are computed once, at
//      computeOutcome() time, by walking the finished log + final wing
//      states — not tracked incrementally during the battle.

import type {
  BattleState, BattleSide, BattleUnit, Deployment, FormationId, LaneId,
  RoundLogEntry, SideOrders, SideState, TerrainMod, WingState, BattleOutcome,
  CaptainOutcome, PendingBreakDecision, CasualtyDelta, PreBattleStratagemPick,
} from '../../models/battle';
import { BALANCE } from '../../data/balance';
import { makeSeededRng, rngPercent, type RngFn } from '../../utils/seededRng';
import {
  resolveLaneClash, isFeintGated, applyAmokDamage,
  type SideClashMods, type LaneClashContext,
} from './clashEngine';
import { STRATAGEMS, STRATAGEM_LIST, type StratagemId, type StratagemDef } from '../../data/stratagems';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const CAVALRY_CLASSES = new Set(['cavalry_heavy', 'cavalry_light']);

// ─── Errors ──────────────────────────────────────────────────────────────────

export class InvalidDeploymentError extends Error {
  reasons: string[];
  constructor(reasons: string[]) {
    super(reasons.join('; '));
    this.name = 'InvalidDeploymentError';
    this.reasons = reasons;
  }
}

// ─── Inputs ──────────────────────────────────────────────────────────────────

/** captainId (a lane captain or the commander) → martial rating (0–10).
 *  Resolved by the caller from strategic character data — battleEngine
 *  never looks up a Character itself. */
export interface CaptainRoster {
  martialById: Record<string, number>;
}

export interface DeploySideInput {
  label: string;
  deployment: Deployment;
  commanderId: string | null;
  roster: CaptainRoster;
  generalProfileId?: string;
  /** M7: this side's drawn stratagem hand (see drawStratagemHand below).
   *  Pre-battle picks in deployment.preBattleStratagems are validated
   *  against this and consumed by initBattle. */
  stratagemHand?: string[];
}

// ─── Small numeric helpers ───────────────────────────────────────────────────

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function totalStrength(units: BattleUnit[]): number {
  return units.reduce((s, u) => s + u.strength, 0);
}

function strengthWeightedAvg(units: BattleUnit[], value: (u: BattleUnit) => number): number {
  const total = totalStrength(units);
  if (total <= 0) return 0;
  return units.reduce((s, u) => s + value(u) * u.strength, 0) / total;
}

function totalArmyStrength(side: SideState): number {
  return LANES.reduce((s, laneId) => s + totalStrength(side.wings[laneId].units), 0)
    + totalStrength(side.reserve);
}

function otherSide(side: BattleSide): BattleSide {
  return side === 'attacker' ? 'defender' : 'attacker';
}

function classStrengthFrac(army: BattleUnit[], predicate: (u: BattleUnit) => boolean): number {
  const total = totalStrength(army);
  if (total <= 0) return 0;
  return army.filter(predicate).reduce((s, u) => s + u.strength, 0) / total;
}

/** Left/right are adjacent to centre only; centre is adjacent to both. */
const LANE_ADJACENCY: Record<LaneId, LaneId[]> = { left: ['centre'], right: ['centre'], centre: ['left', 'right'] };

function isCommanderAdjacent(side: SideState, laneId: LaneId): boolean {
  if (side.commanderStation === laneId) return true;
  if (side.commanderStation === 'reserve') return false;
  return LANE_ADJACENCY[laneId].includes(side.commanderStation);
}

// ─── initBattle ──────────────────────────────────────────────────────────────

export function initBattle(
  attackerInput: DeploySideInput,
  defenderInput: DeploySideInput,
  terrain: TerrainMod,
  seed: number,
): BattleState {
  const reasons: string[] = [];
  for (const [label, input] of [['attacker', attackerInput], ['defender', defenderInput]] as const) {
    const centreCavalry = input.deployment.lanes.centre.units.filter(u => CAVALRY_CLASSES.has(u.unitClass));
    if (centreCavalry.length > 0) {
      reasons.push(`${label}: cavalry cannot deploy to the centre lane (${centreCavalry.map(u => u.unitClass).join(', ')})`);
    }
  }
  if (reasons.length > 0) throw new InvalidDeploymentError(reasons);

  // ── M7: pre-battle stratagems ─────────────────────────────────────────
  // Validate picks against each side's hand/terrain first (isPreBattlePlayable),
  // then apply unit-mutating effects (Officer's Oath) BEFORE buildInitialSideState
  // (the morale seed reads unit loyalty), then build both sides, then apply the
  // rest (state-mutating) effects to the finished SideState/WingState objects.
  const attackerPicks = (attackerInput.deployment.preBattleStratagems ?? [])
    .filter(p => isPreBattlePlayable(p, attackerInput.stratagemHand ?? [], terrain));
  const defenderPicks = (defenderInput.deployment.preBattleStratagems ?? [])
    .filter(p => isPreBattlePlayable(p, defenderInput.stratagemHand ?? [], terrain));

  const attackerDeployment = applyOfficersOathToDeployment(attackerInput.deployment, attackerPicks);
  const defenderDeployment = applyOfficersOathToDeployment(defenderInput.deployment, defenderPicks);

  let attacker = buildInitialSideState({ ...attackerInput, deployment: attackerDeployment });
  let defender = buildInitialSideState({ ...defenderInput, deployment: defenderDeployment });

  const log: RoundLogEntry[] = [];
  for (const pick of attackerPicks) ({ attacker, defender } = applyPreBattleStratagem('attacker', pick, attacker, defender, log));
  for (const pick of defenderPicks) ({ attacker, defender } = applyPreBattleStratagem('defender', pick, attacker, defender, log));

  attacker = {
    ...attacker,
    stratagemHand: (attackerInput.stratagemHand ?? []).filter(id => !attackerPicks.some(p => p.stratagemId === id)),
    stratagemsPlayed: attackerPicks.map(p => p.stratagemId),
  };
  defender = {
    ...defender,
    stratagemHand: (defenderInput.stratagemHand ?? []).filter(id => !defenderPicks.some(p => p.stratagemId === id)),
    stratagemsPlayed: defenderPicks.map(p => p.stratagemId),
  };

  for (const [sideKey, side] of [['attacker', attacker], ['defender', defender]] as const) {
    for (const laneId of LANES) {
      if (side.wings[laneId].units.length === 0) {
        log.push({ type: 'wing_break', round: 0, laneId, side: sideKey });
      }
    }
  }

  return {
    seed,
    round: 1,
    terrain,
    attacker,
    defender,
    log,
    phase: 'orders',
    rngCallsConsumed: 0,
    pendingBreakDecisions: [],
    amokChanceRiders: {},
    startingStrength: { attacker: totalArmyStrength(attacker), defender: totalArmyStrength(defender) },
  };
}

// ─── M7: Stratagems ──────────────────────────────────────────────────────────
// Hand drawing, legality, and effect application. Content (the 8-card catalog)
// lives in data/stratagems.ts; every number lives in BALANCE.battle.stratagems;
// this is the "small effect-key switch in the orchestrator" the plan calls for.

/** Weighted (composition + terrain), without-replacement draw of this side's
 *  stratagem hand at deployment. FIRST-PASS/UNVERIFIED weighting — see
 *  BALANCE.battle.stratagems.drawWeights' header comment. */
export function drawStratagemHand(martial: number, army: BattleUnit[], terrain: TerrainMod, rng: RngFn): string[] {
  const cfg = BALANCE.battle.stratagems;
  const handSize = clampRange(cfg.handSizeBase + Math.floor(martial / cfg.handSizeMartialDivisor), 0, STRATAGEM_LIST.length);
  const weights = STRATAGEM_LIST.map(def => stratagemDrawWeight(def, army, terrain));
  return weightedSampleWithoutReplacement(STRATAGEM_LIST, weights, handSize, rng);
}

function stratagemDrawWeight(def: StratagemDef, army: BattleUnit[], terrain: TerrainMod): number {
  const w = BALANCE.battle.stratagems.drawWeights;
  switch (def.id) {
    case 'ambuscade':
      return def.requiresTerrainIds?.includes(terrain.id) ? w.ambuscadeTerrainMatch : w.ambuscadeNoTerrainMatch;
    case 'caltrops':
      return classStrengthFrac(army, u => CAVALRY_CLASSES.has(u.unitClass)) < w.lowCavalryStrengthFraction
        ? w.caltropsLowCavalryMult : 1;
    case 'fire_arrows':
      return army.every(u => u.unitClass !== 'elephant') ? w.fireArrowsNoElephantsMult : 1;
    case 'testudo_discipline':
      return army.some(u => u.unitClass === 'skirmisher' || u.unitClass === 'spear_foot') ? w.testudoInfantryScreenMult : 1;
    case 'officers_oath':
      return strengthWeightedAvg(army, u => u.loyalty) < w.lowLoyaltyThreshold ? w.officersOathLowLoyaltyMult : 1;
    case 'rally_the_standards':
      return w.rallyBaseWeight;
    case 'forced_march':
      return w.forcedMarchBaseWeight;
    case 'double_envelopment_doctrine':
      return classStrengthFrac(army, u => u.unitClass === 'cavalry_heavy') >= w.heavyCavalryStrengthFraction
        ? w.doubleEnvelopmentHeavyCavalryMult : 1;
    default:
      return 1;
  }
}

function weightedSampleWithoutReplacement(items: StratagemDef[], weights: number[], n: number, rng: RngFn): string[] {
  const pool = items.map((item, i) => ({ item, weight: weights[i] })).filter(p => p.weight > 0);
  const picked: string[] = [];
  while (picked.length < n && pool.length > 0) {
    const totalWeight = pool.reduce((s, p) => s + p.weight, 0);
    if (totalWeight <= 0) break;
    let roll = rng() * totalWeight;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      roll -= pool[idx].weight;
      if (roll <= 0) break;
    }
    picked.push(pool[idx].item.id);
    pool.splice(idx, 1);
  }
  return picked;
}

/** Legal pre-battle picks from a hand, gated by timing + terrain — the single
 *  source DeploymentBoard (M7 UI) and battleAi.chooseDeployment both read. */
export function getPlayablePreBattleStratagems(hand: string[], terrain: TerrainMod): StratagemDef[] {
  return hand
    .map(id => STRATAGEMS[id as StratagemId])
    .filter((def): def is StratagemDef => !!def && def.timing === 'pre_battle')
    .filter(def => !def.requiresTerrainIds || def.requiresTerrainIds.includes(terrain.id));
}

function isPreBattlePlayable(pick: PreBattleStratagemPick, hand: string[], terrain: TerrainMod): boolean {
  const def = STRATAGEMS[pick.stratagemId as StratagemId];
  if (!def || def.timing !== 'pre_battle') return false;
  if (!hand.includes(pick.stratagemId)) return false;
  if (def.requiresTerrainIds && !def.requiresTerrainIds.includes(terrain.id)) return false;
  if ((def.target === 'own_lane' || def.target === 'enemy_lane') && !pick.laneId) return false;
  return true;
}

/** Officer's Oath is applied to the raw Deployment (unit loyalty) BEFORE
 *  buildInitialSideState, since the morale seed reads loyalty once at
 *  deployment time — every other pre-battle card is applied after, to the
 *  built SideState/WingState (see applyPreBattleStratagem). */
function applyOfficersOathToDeployment(deployment: Deployment, picks: PreBattleStratagemPick[]): Deployment {
  const oathPicks = picks.filter(p => p.stratagemId === 'officers_oath' && p.laneId);
  if (oathPicks.length === 0) return deployment;
  let lanes = deployment.lanes;
  for (const pick of oathPicks) {
    const laneId = pick.laneId!;
    const assignment = lanes[laneId];
    lanes = {
      ...lanes,
      [laneId]: { ...assignment, units: assignment.units.map(u => ({ ...u, loyalty: BALANCE.battle.stratagems.officersOathLoyalty })) },
    };
  }
  return { ...deployment, lanes };
}

function applyPreBattleStratagem(
  playedBy: BattleSide,
  pick: PreBattleStratagemPick,
  attacker: SideState,
  defender: SideState,
  log: RoundLogEntry[],
): { attacker: SideState; defender: SideState } {
  const cfg = BALANCE.battle.stratagems;
  let own = playedBy === 'attacker' ? attacker : defender;
  let enemy = playedBy === 'attacker' ? defender : attacker;

  switch (pick.stratagemId as StratagemId) {
    case 'officers_oath':
      break; // unit-level effect already applied pre-buildInitialSideState
    case 'ambuscade':
      if (pick.laneId) {
        const wing = enemy.wings[pick.laneId];
        const newMorale = clampRange(wing.moralePool + cfg.ambuscadeMoraleDelta, 0, BALANCE.battle.morale.clampMax);
        enemy = { ...enemy, wings: { ...enemy.wings, [pick.laneId]: { ...wing, moralePool: newMorale } } };
      }
      break;
    case 'caltrops':
      if (pick.laneId) {
        const wing = own.wings[pick.laneId];
        own = { ...own, wings: { ...own.wings, [pick.laneId]: { ...wing, stratagemMods: { ...wing.stratagemMods, incomingCavalryShockMult: cfg.caltropsCavalryShockMult } } } };
      }
      break;
    case 'testudo_discipline':
      if (pick.laneId) {
        const wing = own.wings[pick.laneId];
        own = { ...own, wings: { ...own.wings, [pick.laneId]: { ...wing, stratagemMods: { ...wing.stratagemMods, preludeMult: cfg.testudoPreludeMult } } } };
      }
      break;
    case 'fire_arrows':
      enemy = { ...enemy, incomingElephantAmokRiderPct: (enemy.incomingElephantAmokRiderPct ?? 0) + cfg.fireArrowsAmokChanceDelta };
      break;
    case 'forced_march':
      enemy = { ...enemy, reserveLockedUntilRound: cfg.forcedMarchLockUntilRound };
      break;
    case 'double_envelopment_doctrine':
      own = { ...own, wheelBonusMult: cfg.doubleEnvelopmentWheelBonusMult };
      break;
  }

  log.push({ type: 'stratagem_played', round: 0, side: playedBy, stratagemId: pick.stratagemId, laneId: pick.laneId });
  return playedBy === 'attacker' ? { attacker: own, defender: enemy } : { attacker: enemy, defender: own };
}

/** Reactive-timing legality (v1: Rally the Standards only) — the single
 *  source OrdersPanel (M7 UI) and battleAi.chooseOrders both read. */
export interface PlayableReactiveStratagem {
  stratagemId: string;
  validLanes: LaneId[];
}

export function getPlayableStratagems(state: BattleState, sideKey: BattleSide): PlayableReactiveStratagem[] {
  if (state.phase !== 'orders') return [];
  const side = state[sideKey];
  const hand = side.stratagemHand ?? [];
  const played = new Set(side.stratagemsPlayed ?? []);
  const result: PlayableReactiveStratagem[] = [];
  for (const id of hand) {
    const def = STRATAGEMS[id as StratagemId];
    if (!def || def.timing !== 'reactive') continue;
    if (def.id === 'rally_the_standards') {
      if (played.has(def.id)) continue;
      const validLanes = LANES.filter(laneId => {
        const wing = side.wings[laneId];
        return wing.broken && wing.units.length > 0 && isCommanderAdjacent(side, laneId);
      });
      if (validLanes.length > 0) result.push({ stratagemId: def.id, validLanes });
    }
  }
  return result;
}

function tryApplyRally(sideKey: BattleSide, orders: SideOrders, side: SideState, log: RoundLogEntry[], round: number): SideState {
  if (orders.stratagemId !== 'rally_the_standards' || !orders.stratagemLaneId) return side;
  const laneId = orders.stratagemLaneId;
  const hand = side.stratagemHand ?? [];
  const played = side.stratagemsPlayed ?? [];
  if (!hand.includes('rally_the_standards') || played.includes('rally_the_standards')) return side;
  const wing = side.wings[laneId];
  if (!wing.broken || wing.units.length === 0 || !isCommanderAdjacent(side, laneId)) return side;

  log.push({ type: 'stratagem_played', round, side: sideKey, stratagemId: 'rally_the_standards', laneId });
  return {
    ...side,
    wings: { ...side.wings, [laneId]: { ...wing, broken: false, moralePool: BALANCE.battle.stratagems.rallyMorale } },
    stratagemHand: hand.filter(id => id !== 'rally_the_standards'),
    stratagemsPlayed: [...played, 'rally_the_standards'],
  };
}

function buildInitialSideState(input: DeploySideInput): SideState {
  const { deployment, commanderId, roster, generalProfileId } = input;
  const wings = {} as Record<LaneId, WingState>;
  for (const laneId of LANES) {
    const assignment = deployment.lanes[laneId];
    const isCommanderLane = deployment.commanderStation === laneId;
    const leaderId = isCommanderLane ? commanderId : assignment.captainId;
    const hasLeader = leaderId != null;
    const leaderMartial = leaderId != null ? (roster.martialById[leaderId] ?? 0) : 0;

    let seed = 0;
    if (assignment.units.length > 0) {
      const cfg = BALANCE.battle.morale;
      const weightedMoraleWeight = strengthWeightedAvg(
        assignment.units,
        u => BALANCE.battle.unitStats[u.unitClass].moraleWeight * BALANCE.battle.veterancy[u.veterancy].statMult,
      );
      seed = cfg.seedPerAvgWeightedMoraleWeight * weightedMoraleWeight;
      seed += strengthWeightedAvg(assignment.units, u => BALANCE.battle.veterancy[u.veterancy].moraleSeedDelta);
      seed += hasLeader
        ? BALANCE.battle.command.captainMoraleSeedPerMartial * leaderMartial
        : BALANCE.battle.command.unledLaneMoraleSeedDelta;
      if (deployment.commanderStation !== 'reserve') {
        seed += BALANCE.battle.command.commanderStationedArmyWideMoraleSeed;
      }
      const avgLoyalty = strengthWeightedAvg(assignment.units, u => u.loyalty);
      if (avgLoyalty >= BALANCE.battle.loyalty.highThreshold) seed += BALANCE.battle.loyalty.highMoraleSeedBonus;
      seed = clampRange(seed, cfg.clampMin, cfg.clampMax);
    }

    wings[laneId] = {
      laneId,
      units: assignment.units,
      captainId: assignment.captainId,
      formation: assignment.formation,
      moralePool: seed,
      broken: assignment.units.length === 0,
      engagedRounds: 0,
      flanked: false,
      overextended: false,
    };
  }

  return {
    label: input.label,
    wings,
    reserve: deployment.reserve,
    commanderId,
    commanderStation: deployment.commanderStation,
    generalProfileId,
    captainMartialById: roster.martialById,
  };
}

// ─── Continued RNG ───────────────────────────────────────────────────────────

function makeContinuedRng(seed: number, callsAlreadyConsumed: number): { rng: RngFn; callsThisTime: () => number } {
  const base = makeSeededRng(seed);
  for (let i = 0; i < callsAlreadyConsumed; i++) base();
  let calls = 0;
  const rng: RngFn = () => { calls += 1; return base(); };
  return { rng, callsThisTime: () => calls };
}

// ─── getValidOrders ──────────────────────────────────────────────────────────

export interface LaneAffordances {
  legalFormations: FormationId[];
  feintGated: boolean;
}

export interface ValidOrders {
  lanes: Record<LaneId, LaneAffordances>;
  reserveAvailable: boolean;
  withdrawAvailable: boolean;
}

function isWithdrawAvailable(side: SideState): boolean {
  const brokenCount = LANES.filter(l => side.wings[l].broken).length;
  return brokenCount < 2;
}

export function getValidOrders(state: BattleState, sideKey: BattleSide): ValidOrders {
  const side = state[sideKey];
  const lanes = {} as Record<LaneId, LaneAffordances>;
  for (const laneId of LANES) {
    const wing = side.wings[laneId];
    const hasLeader = wing.captainId != null || side.commanderStation === laneId;
    const legalFormations: FormationId[] = ['line', 'shield_wall', 'open_ranks'];
    const feintGated = !wing.broken && hasLeader && wing.units.length > 0 && isFeintGated(wing.units);
    if (!wing.broken && hasLeader) legalFormations.push('wedge');
    if (feintGated) legalFormations.push('feigned_retreat');
    lanes[laneId] = { legalFormations, feintGated };
  }
  return {
    lanes,
    reserveAvailable: side.reserve.length > 0 && state.round >= (side.reserveLockedUntilRound ?? 0),
    withdrawAvailable: isWithdrawAvailable(side),
  };
}

// ─── Applying orders (formation changes, reserve commits) ──────────────────

function applySideOrders(side: SideState, orders: SideOrders, round: number): SideState {
  let wings = { ...side.wings };
  for (const laneId of LANES) {
    const laneOrder = orders.laneOrders[laneId];
    if (laneOrder?.formation) {
      wings = { ...wings, [laneId]: { ...wings[laneId], formation: laneOrder.formation } };
    }
  }
  let reserve = side.reserve;
  const reserveLocked = round < (side.reserveLockedUntilRound ?? 0);
  if (orders.commitReserves && !reserveLocked) {
    const { laneId, unitIds } = orders.commitReserves;
    const moving = reserve.filter(u => unitIds.includes(u.id));
    if (moving.length > 0) {
      reserve = reserve.filter(u => !unitIds.includes(u.id));
      wings = {
        ...wings,
        [laneId]: {
          ...wings[laneId],
          units: [...wings[laneId].units, ...moving],
          engagedRounds: 0, // fresh shock — reserve commit resets the pairing
        },
      };
    }
  }
  return { ...side, wings, reserve };
}

function computeSideClashMods(side: SideState, laneId: LaneId): SideClashMods {
  const wing = side.wings[laneId];
  const isCommanderLane = side.commanderStation === laneId;
  const laneCaptainMartial = (!isCommanderLane && wing.captainId)
    ? (side.captainMartialById[wing.captainId] ?? 0) : null;
  const commanderInLaneMartial = (isCommanderLane && side.commanderId)
    ? (side.captainMartialById[side.commanderId] ?? 0) : null;
  const commanderReserveMartial = (side.commanderStation === 'reserve' && side.commanderId)
    ? (side.captainMartialById[side.commanderId] ?? 0) : null;
  return { laneCaptainMartial, commanderInLaneMartial, commanderReserveMartial };
}

function applyLossesToUnits(units: BattleUnit[], losses: Map<string, number>): BattleUnit[] {
  if (losses.size === 0) return units;
  return units
    .map(u => {
      const lost = losses.get(u.id);
      return lost ? { ...u, strength: Math.max(0, u.strength - lost) } : u;
    })
    .filter(u => u.strength > 0);
}

function toCasualtyDeltas(losses: Map<string, number>, laneId: LaneId, side: BattleSide): CasualtyDelta[] {
  return [...losses.entries()].map(([unitId, strengthLost]) => ({ laneId, side, unitId, strengthLost }));
}

// ─── submitOrders ────────────────────────────────────────────────────────────

export function submitOrders(state: BattleState, ordersAttacker: SideOrders, ordersDefender: SideOrders): BattleState {
  if (state.phase !== 'orders') {
    throw new Error(`submitOrders called while phase is '${state.phase}', expected 'orders'`);
  }

  let attacker = applySideOrders(state.attacker, ordersAttacker, state.round);
  let defender = applySideOrders(state.defender, ordersDefender, state.round);

  const attackerWithdrawing = ordersAttacker.withdraw === true && isWithdrawAvailable(attacker);
  const defenderWithdrawing = ordersDefender.withdraw === true && isWithdrawAvailable(defender);
  const isWithdrawalRound = attackerWithdrawing || defenderWithdrawing;

  const { rng, callsThisTime } = makeContinuedRng(state.seed, state.rngCallsConsumed);
  const log: RoundLogEntry[] = [];
  const amokChanceRiders = { ...state.amokChanceRiders };
  const round = state.round;

  // M7: Rally the Standards (the only reactive-timing stratagem) resolves
  // before this round's lane clashes, so a re-formed wing can fight the
  // same round.
  attacker = tryApplyRally('attacker', ordersAttacker, attacker, log, round);
  defender = tryApplyRally('defender', ordersDefender, defender, log, round);

  for (const laneId of LANES) {
    const wingA = attacker.wings[laneId];
    const wingB = defender.wings[laneId];
    if (wingA.broken || wingB.broken) continue;
    if (wingA.units.length === 0 || wingB.units.length === 0) continue;

    const ctx: LaneClashContext = {
      terrain: state.terrain,
      rng,
      sideAMods: computeSideClashMods(attacker, laneId),
      sideBMods: computeSideClashMods(defender, laneId),
      attackerSide: 'A',
      engagedRoundsA: wingA.engagedRounds,
      engagedRoundsB: wingB.engagedRounds,
      formationA: wingA.formation,
      formationB: wingB.formation,
      flankedA: wingA.flanked,
      flankedB: wingB.flanked,
      overextendedA: wingA.overextended,
      overextendedB: wingB.overextended,
      withdrawDefMultA: attackerWithdrawing ? BALANCE.battle.withdrawal.defMult : undefined,
      withdrawDefMultB: defenderWithdrawing ? BALANCE.battle.withdrawal.defMult : undefined,
      incomingCavalryShockMultA: wingA.stratagemMods?.incomingCavalryShockMult,
      incomingCavalryShockMultB: wingB.stratagemMods?.incomingCavalryShockMult,
      preludeMultA: wingA.stratagemMods?.preludeMult,
      preludeMultB: wingB.stratagemMods?.preludeMult,
    };

    const result = resolveLaneClash(wingA.units, wingB.units, ctx);

    const newUnitsA = applyLossesToUnits(wingA.units, result.casualtiesA);
    const newUnitsB = applyLossesToUnits(wingB.units, result.casualtiesB);
    const newMoraleA = clampRange(wingA.moralePool + result.moraleDeltaA, 0, BALANCE.battle.morale.clampMax);
    const newMoraleB = clampRange(wingB.moralePool + result.moraleDeltaB, 0, BALANCE.battle.morale.clampMax);

    attacker = { ...attacker, wings: { ...attacker.wings, [laneId]: {
      ...wingA, units: newUnitsA, moralePool: newMoraleA, engagedRounds: wingA.engagedRounds + 1,
      overextended: result.feintB?.result === 'success', // this side's NEXT round is overextended if the enemy's feint succeeded
    } } };
    defender = { ...defender, wings: { ...defender.wings, [laneId]: {
      ...wingB, units: newUnitsB, moralePool: newMoraleB, engagedRounds: wingB.engagedRounds + 1,
      overextended: result.feintA?.result === 'success',
    } } };

    for (const [id, r] of result.amokChanceRiders) {
      amokChanceRiders[id] = (amokChanceRiders[id] ?? 0) + r;
    }

    if (result.wasFeintRound) {
      if (result.feintA?.attempted) log.push({ type: 'feint_result', round, laneId, side: 'attacker', result: result.feintA.result! });
      if (result.feintB?.attempted) log.push({ type: 'feint_result', round, laneId, side: 'defender', result: result.feintB.result! });
    } else {
      log.push({
        type: 'clash', round, laneId,
        casualties: [...toCasualtyDeltas(result.casualtiesA, laneId, 'attacker'), ...toCasualtyDeltas(result.casualtiesB, laneId, 'defender')],
        moraleDeltas: [
          { laneId, side: 'attacker', delta: result.moraleDeltaA, reason: 'clash' },
          { laneId, side: 'defender', delta: result.moraleDeltaB, reason: 'clash' },
        ],
        modifiersSummary: result.modifiersSummary,
      });
    }
  }

  // ── Rout cascade ─────────────────────────────────────────────────────────
  // A side with exactly 1 wing already broken (from a PRIOR round) drains
  // its other still-standing wings automatically this round too.
  attacker = applyRoutCascade(attacker, log, round, 'attacker');
  defender = applyRoutCascade(defender, log, round, 'defender');

  // ── Amok checks (round ≥ amokFirstEligibleRound) ────────────────────────
  if (round >= BALANCE.battle.elephant.amokFirstEligibleRound) {
    for (const sideKey of ['attacker', 'defender'] as const) {
      const side = sideKey === 'attacker' ? attacker : defender;
      const other = sideKey === 'attacker' ? defender : attacker;
      let updatedSide = side;
      let updatedOther = other;
      for (const laneId of LANES) {
        const wing = updatedSide.wings[laneId];
        if (wing.broken) continue;
        for (const unit of wing.units) {
          if (unit.unitClass !== 'elephant') continue;
          const e = BALANCE.battle.elephant;
          const lowStrength = unit.strength < e.amokLowStrengthThreshold ? e.amokLowStrengthChanceBonus : 0;
          const rider = amokChanceRiders[unit.id] ?? 0;
          const terrainRider = state.terrain.mods.elephantAmok ?? 0;
          const fireArrowsRider = side.incomingElephantAmokRiderPct ?? 0; // M7
          const chance = clampRange(e.amokBaseChancePerEngagedRound * wing.engagedRounds + lowStrength + rider + terrainRider + fireArrowsRider, 0, 1);
          if (rngPercent(rng) > chance * 100) continue;

          const opposingWing = updatedOther.wings[laneId];
          const dmg = applyAmokDamage(unit, wing.units, opposingWing.units);
          const newOwnUnits = applyLossesToUnits(wing.units, dmg.casualtiesA).filter(u => u.id !== unit.id);
          const newOppUnits = applyLossesToUnits(opposingWing.units, dmg.casualtiesB);
          updatedSide = { ...updatedSide, wings: { ...updatedSide.wings, [laneId]: { ...wing, units: newOwnUnits } } };
          updatedOther = { ...updatedOther, wings: { ...updatedOther.wings, [laneId]: { ...opposingWing, units: newOppUnits } } };
          delete amokChanceRiders[unit.id];
          log.push({
            type: 'amok', round, laneId, unitId: unit.id,
            casualties: [...toCasualtyDeltas(dmg.casualtiesA, laneId, sideKey), ...toCasualtyDeltas(dmg.casualtiesB, laneId, otherSide(sideKey))],
          });
        }
      }
      if (sideKey === 'attacker') { attacker = updatedSide; defender = updatedOther; }
      else { defender = updatedSide; attacker = updatedOther; }
    }
  }

  // ── Wing-break detection ────────────────────────────────────────────────
  const pendingBreakDecisions: PendingBreakDecision[] = [];
  for (const sideKey of ['attacker', 'defender'] as const) {
    let side = sideKey === 'attacker' ? attacker : defender;
    for (const laneId of LANES) {
      const wing = side.wings[laneId];
      if (!wing.broken && wing.moralePool <= BALANCE.battle.morale.brokenThreshold) {
        side = { ...side, wings: { ...side.wings, [laneId]: { ...wing, broken: true } } };
        log.push({ type: 'wing_break', round, laneId, side: sideKey });
        pendingBreakDecisions.push({ laneId, brokenSide: sideKey });
      }
    }
    if (sideKey === 'attacker') attacker = side; else defender = side;
  }

  const newLog = [...state.log, ...log];
  const rngCallsConsumed = state.rngCallsConsumed + callsThisTime();

  const nextState: BattleState = {
    ...state, attacker, defender, log: newLog, rngCallsConsumed,
    amokChanceRiders,
    pendingBreakDecisions,
  };

  if (isWithdrawalRound) {
    const withdrawerSide: BattleSide = attackerWithdrawing && !defenderWithdrawing ? 'attacker'
      : defenderWithdrawing && !attackerWithdrawing ? 'defender' : 'attacker';
    const mutual = attackerWithdrawing && defenderWithdrawing;
    const withdrawLog = [...newLog, { type: 'withdrawal' as const, round, side: withdrawerSide }];
    const outcome = computeWithdrawalOutcome({ ...nextState, log: withdrawLog }, mutual ? null : withdrawerSide, rng);
    return { ...nextState, log: [...withdrawLog, { type: 'battle_end', round, outcome }], phase: 'resolved', outcome };
  }

  if (pendingBreakDecisions.length > 0) {
    return { ...nextState, phase: 'break_decision' };
  }

  const endCheck = checkRoutDefeat(nextState, rng);
  if (endCheck) {
    const outcome = computeOutcome(nextState, endCheck, rng);
    return { ...nextState, log: [...newLog, { type: 'battle_end', round, outcome }], phase: 'resolved', outcome };
  }

  return { ...nextState, round: round + 1, phase: 'orders' };
}

function applyRoutCascade(side: SideState, log: RoundLogEntry[], round: number, sideKey: BattleSide): SideState {
  const brokenCount = LANES.filter(l => side.wings[l].broken).length;
  if (brokenCount !== 1) return side;
  let updated = side;
  for (const laneId of LANES) {
    const wing = updated.wings[laneId];
    if (wing.broken) continue;
    const newMorale = clampRange(wing.moralePool + BALANCE.battle.morale.routCascadeMoraleDeltaPerRound, 0, BALANCE.battle.morale.clampMax);
    updated = { ...updated, wings: { ...updated.wings, [laneId]: { ...wing, moralePool: newMorale } } };
    log.push({
      type: 'clash', round, laneId,
      casualties: [],
      moraleDeltas: [{ laneId, side: sideKey, delta: BALANCE.battle.morale.routCascadeMoraleDeltaPerRound, reason: 'rout cascade' }],
      modifiersSummary: 'rout cascade — army already has a broken wing',
    });
  }
  return updated;
}

/** Returns the defeated side if the rout condition (≥2 broken wings) is
 *  met, else null.
 *
 *  M11 FIX: both sides can cross the ≥2-broken-wings threshold in the SAME
 *  round (a fully symmetric clash — e.g. mirrored armies — has no per-round
 *  RNG at all unless feint/amok gate in, so both wings can break in lockstep
 *  every round). The original version iterated ['attacker', 'defender'] and
 *  returned whichever it found first, which meant the attacker lost EVERY
 *  simultaneous double-break, deterministically — surfaced by M11's
 *  simulateBattles harness as a 0%/100% mirror-army win split against the
 *  plan's 47–53% target. Simultaneous collapse is now resolved by whichever
 *  side has less total remaining strength (they lost the exchange more
 *  badly); an exact-strength tie falls back to this round's own seeded rng
 *  (consistent with computeOutcome's rng usage immediately after — the
 *  battle is terminal at this point, so the extra draw need not be folded
 *  into rngCallsConsumed). */
function checkRoutDefeat(state: BattleState, rng: RngFn): BattleSide | null {
  const attackerBroken = LANES.filter(l => state.attacker.wings[l].broken).length >= 2;
  const defenderBroken = LANES.filter(l => state.defender.wings[l].broken).length >= 2;
  if (attackerBroken && defenderBroken) {
    const attackerStrength = totalArmyStrength(state.attacker);
    const defenderStrength = totalArmyStrength(state.defender);
    if (attackerStrength !== defenderStrength) {
      return attackerStrength < defenderStrength ? 'attacker' : 'defender';
    }
    return rngPercent(rng) < 50 ? 'attacker' : 'defender';
  }
  if (attackerBroken) return 'attacker';
  if (defenderBroken) return 'defender';
  return null;
}

// ─── submitBreakDecision ─────────────────────────────────────────────────────

export function submitBreakDecision(
  state: BattleState,
  laneId: LaneId,
  decision: 'pursue' | 'wheel',
  targetLane?: LaneId,
): BattleState {
  if (state.phase !== 'break_decision') {
    throw new Error(`submitBreakDecision called while phase is '${state.phase}', expected 'break_decision'`);
  }
  // M11 FIX: matched by laneId ALONE, `find` here would be ambiguous whenever
  // both sides' same-named lane break in the same round (e.g. mirrored
  // armies' 'left' wings breaking together) — pendingBreakDecisions can
  // legitimately hold two entries with the same laneId, one per side. `find`
  // picking the first (always attacker-before-defender, per the wing-break
  // detection loop's iteration order) is fine as the resolution target for
  // THIS call, matching the established caller convention of always
  // resolving pendingBreakDecisions[0]; but see the matching fix below —
  // the ORIGINAL bug was `remainingPending`'s filter dropping BOTH same-
  // laneId entries instead of just this one, silently discarding the other
  // side's break decision (it was never pursued/wheeled, giving that side's
  // lane a free pass). Surfaced by M11's simulateBattles harness as a
  // mirror-army win rate of 0%/100% instead of the plan's 47–53% target.
  const pending = state.pendingBreakDecisions.find(d => d.laneId === laneId);
  if (!pending) throw new Error(`No pending break decision for lane '${laneId}'`);

  const brokenSideKey = pending.brokenSide;
  const victorSideKey = otherSide(brokenSideKey);
  const { rng, callsThisTime } = makeContinuedRng(state.seed, state.rngCallsConsumed);

  let attacker = state.attacker;
  let defender = state.defender;
  const log: RoundLogEntry[] = [];

  if (decision === 'pursue') {
    const brokenSide = brokenSideKey === 'attacker' ? attacker : defender;
    const routedWing = brokenSide.wings[laneId];
    const victorSide = victorSideKey === 'attacker' ? attacker : defender;
    const victorUnits = victorSide.wings[laneId].units;
    const hasCavalryLight = victorUnits.some(u => u.unitClass === 'cavalry_light');
    const destroyPct = hasCavalryLight
      ? BALANCE.battle.break.pursueDestroyPctWithCavalryLight
      : BALANCE.battle.break.pursueDestroyPct;
    const destroyPoints = totalStrength(routedWing.units) * destroyPct;
    const losses = distributeCasualtiesWeakestFirst(routedWing.units, destroyPoints);
    const survivingUnits = applyLossesToUnits(routedWing.units, losses);
    const unitsDestroyed = routedWing.units.length - survivingUnits.length;

    const updatedBrokenSide = { ...brokenSide, wings: { ...brokenSide.wings, [laneId]: { ...routedWing, units: survivingUnits } } };
    if (brokenSideKey === 'attacker') attacker = updatedBrokenSide; else defender = updatedBrokenSide;

    log.push({ type: 'pursue', round: state.round, laneId, side: brokenSideKey, unitsDestroyed });
  } else {
    const victorSide = victorSideKey === 'attacker' ? attacker : defender;
    const opponentSide = brokenSideKey === 'attacker' ? attacker : defender; // the side whose OTHER wing gets flanked

    const validTargets: LaneId[] = laneId === 'centre' ? ['left', 'right'] : ['centre'];
    if (!targetLane || !validTargets.includes(targetLane)) {
      throw new Error(`Invalid wheel target '${String(targetLane)}' from lane '${laneId}' (valid: ${validTargets.join(', ')})`);
    }

    const wheelingUnits = victorSide.wings[laneId].units;
    const updatedVictor = {
      ...victorSide,
      wings: {
        ...victorSide.wings,
        [laneId]: { ...victorSide.wings[laneId], units: [] },
        [targetLane]: {
          ...victorSide.wings[targetLane],
          units: [...victorSide.wings[targetLane].units, ...wheelingUnits],
          engagedRounds: 0,
        },
      },
    };

    // The opponent's wing AT the target lane (the one now facing the flank
    // charge) — this is the broken side's OWN army, same side as `opponentSide`.
    const targetWing = opponentSide.wings[targetLane];
    // M7 — Double Envelopment Doctrine: scales the victor's own flank-charge
    // morale hit. (The ongoing per-round flanked-def-mult reduction stays
    // fixed — see clashEngine's buildEffectiveSide — this is the concrete,
    // immediate "flank bonus" battleEngine can scale without further
    // clashEngine surgery; a fuller implementation is M11 tuning-pass scope.)
    const wheelBonusMult = victorSide.wheelBonusMult ?? 1;
    const updatedOpponent = {
      ...opponentSide,
      wings: {
        ...opponentSide.wings,
        [targetLane]: {
          ...targetWing,
          flanked: true,
          moralePool: clampRange(targetWing.moralePool + BALANCE.battle.break.wheelTargetMoraleDelta * wheelBonusMult, 0, BALANCE.battle.morale.clampMax),
        },
      },
    };

    if (victorSideKey === 'attacker') { attacker = updatedVictor; defender = updatedOpponent; }
    else { defender = updatedVictor; attacker = updatedOpponent; }

    log.push({ type: 'wheel', round: state.round, fromLane: laneId, toLane: targetLane, side: victorSideKey });

    // Re-check: did the flank charge's morale hit break the target wing too?
    const recheckSide = victorSideKey === 'attacker' ? defender : attacker;
    const recheckWing = recheckSide.wings[targetLane];
    if (!recheckWing.broken && recheckWing.moralePool <= BALANCE.battle.morale.brokenThreshold) {
      const brokenRecheckSideKey = otherSide(victorSideKey);
      const withBreak = { ...recheckSide, wings: { ...recheckSide.wings, [targetLane]: { ...recheckWing, broken: true } } };
      if (brokenRecheckSideKey === 'attacker') attacker = withBreak; else defender = withBreak;
      log.push({ type: 'wing_break', round: state.round, laneId: targetLane, side: brokenRecheckSideKey });
      const remainingPending = state.pendingBreakDecisions.filter(d => !(d.laneId === laneId && d.brokenSide === brokenSideKey));
      const newState: BattleState = {
        ...state, attacker, defender, log: [...state.log, ...log],
        rngCallsConsumed: state.rngCallsConsumed + callsThisTime(),
        pendingBreakDecisions: [...remainingPending, { laneId: targetLane, brokenSide: brokenRecheckSideKey }],
      };
      return newState;
    }
  }

  const remainingPending = state.pendingBreakDecisions.filter(d => !(d.laneId === laneId && d.brokenSide === brokenSideKey));
  const newLog = [...state.log, ...log];
  const rngCallsConsumed = state.rngCallsConsumed + callsThisTime();
  const intermediateState: BattleState = { ...state, attacker, defender, log: newLog, rngCallsConsumed, pendingBreakDecisions: remainingPending };

  if (remainingPending.length > 0) {
    return { ...intermediateState, phase: 'break_decision' };
  }

  const { rng: outcomeRng } = makeContinuedRng(intermediateState.seed, intermediateState.rngCallsConsumed);
  const endCheck = checkRoutDefeat(intermediateState, outcomeRng);
  if (endCheck) {
    const outcome = computeOutcome(intermediateState, endCheck, outcomeRng);
    return { ...intermediateState, log: [...newLog, { type: 'battle_end', round: state.round, outcome }], phase: 'resolved', outcome };
  }

  return { ...intermediateState, round: state.round + 1, phase: 'orders' };
}

function distributeCasualtiesWeakestFirst(units: BattleUnit[], points: number): Map<string, number> {
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

// ─── Outcome computation ─────────────────────────────────────────────────────

function isCavalryDominant(units: BattleUnit[]): boolean {
  const cavalryStrength = units.filter(u => CAVALRY_CLASSES.has(u.unitClass)).reduce((s, u) => s + u.strength, 0);
  return cavalryStrength > totalStrength(units) / 2;
}

function wasPursued(log: RoundLogEntry[], laneId: LaneId, side: BattleSide): boolean {
  return log.some(e => e.type === 'pursue' && e.laneId === laneId && e.side === side);
}

function anyPursueChosen(log: RoundLogEntry[]): boolean {
  return log.some(e => e.type === 'pursue');
}

function rollWeighted(weights: { killed: number; captured: number; wounded: number; unharmed: number }, rng: RngFn): CaptainOutcome['result'] {
  const total = weights.killed + weights.captured + weights.wounded + weights.unharmed;
  const roll = rng() * total;
  let acc = weights.killed;
  if (roll < acc) return 'killed';
  acc += weights.captured;
  if (roll < acc) return 'captured';
  acc += weights.wounded;
  if (roll < acc) return 'wounded';
  return 'unharmed';
}

function rollCaptainOutcomes(state: BattleState, loserSide: BattleSide | null, rng: RngFn): CaptainOutcome[] {
  const outcomes: CaptainOutcome[] = [];
  const risk = BALANCE.battle.risk;
  for (const sideKey of ['attacker', 'defender'] as const) {
    const side = state[sideKey];
    const sideLost = loserSide === sideKey;
    for (const laneId of LANES) {
      const wing = side.wings[laneId];
      const leaderId = side.commanderStation === laneId ? side.commanderId : wing.captainId;
      if (!leaderId) continue;
      if (!wing.broken && !sideLost) continue; // victorious side + unbroken wing: no roll
      const weights = { ...(wing.broken ? risk.wingRouted : risk.battleLostNoRout) };
      if (isCavalryDominant(wing.units.length > 0 ? wing.units : [])) weights.killed += risk.cavalryWingKilledWeightBonus;
      if (wing.broken && wasPursued(state.log, laneId, sideKey)) weights.captured += risk.enemyPursuedCapturedWeightBonus;
      if (leaderId === side.commanderId) weights.captured += risk.commanderCapturedWeightBonus;
      outcomes.push({ characterId: leaderId, result: rollWeighted(weights, rng) });
    }
    if (side.commanderStation === 'reserve' && side.commanderId && sideLost) {
      outcomes.push({ characterId: side.commanderId, result: rollWeighted(risk.battleLostNoRout, rng) });
    }
  }
  return outcomes;
}

function computeWithdrawalOutcome(state: BattleState, withdrawerSide: BattleSide | null, rng: RngFn): BattleOutcome {
  // Only wings that were already routed take risk rolls (per the plan).
  const captainOutcomes: CaptainOutcome[] = [];
  const risk = BALANCE.battle.risk;
  for (const sideKey of ['attacker', 'defender'] as const) {
    const side = state[sideKey];
    for (const laneId of LANES) {
      const wing = side.wings[laneId];
      if (!wing.broken) continue;
      const leaderId = side.commanderStation === laneId ? side.commanderId : wing.captainId;
      if (!leaderId) continue;
      const weights = { ...risk.wingRouted };
      if (leaderId === side.commanderId) weights.captured += risk.commanderCapturedWeightBonus;
      captainOutcomes.push({ characterId: leaderId, result: rollWeighted(weights, rng) });
    }
  }

  const casualties = {
    attacker: { strengthLost: state.startingStrength.attacker - totalArmyStrength(state.attacker), unitsLost: 0 },
    defender: { strengthLost: state.startingStrength.defender - totalArmyStrength(state.defender), unitsLost: 0 },
  };

  const rawDelta = withdrawerSide === 'attacker' ? -BALANCE.battle.tiers.orderlyWithdrawalWarScore
    : withdrawerSide === 'defender' ? BALANCE.battle.tiers.orderlyWithdrawalWarScore
    : 0; // mutual disengagement — no net swing
  const warScoreDelta = clampRange(rawDelta, -BALANCE.war.maxSingleBattleSwing, BALANCE.war.maxSingleBattleSwing);

  return {
    victor: 'withdrawal',
    tier: 'marginal',
    casualties,
    captainOutcomes,
    warScoreDelta,
  };
}

function computeOutcome(state: BattleState, loserSide: BattleSide, rng: RngFn): BattleOutcome {
  const victor: BattleSide = otherSide(loserSide);
  const loserSideState = state[loserSide];
  const brokenCount = LANES.filter(l => loserSideState.wings[l].broken).length;
  const loserRemainingStrength = totalArmyStrength(loserSideState);
  const loserStartingStrength = state.startingStrength[loserSide];
  const casualtyPct = loserStartingStrength > 0 ? 1 - (loserRemainingStrength / loserStartingStrength) : 1;

  const tiers = BALANCE.battle.tiers;
  const tier: BattleOutcome['tier'] =
    (brokenCount >= 3 || (brokenCount >= tiers.crushingMinWingsBroken && casualtyPct >= tiers.crushingMinCasualtyPct))
      ? 'crushing'
      : brokenCount >= tiers.clearMinWingsBroken ? 'clear' : 'marginal';

  let rawDelta = tiers.warScoreByTier[tier];
  if (anyPursueChosen(state.log)) rawDelta += BALANCE.battle.break.pursueWarScoreRider;
  const signedDelta = victor === 'attacker' ? rawDelta : -rawDelta;
  const warScoreDelta = clampRange(signedDelta, -BALANCE.war.maxSingleBattleSwing, BALANCE.war.maxSingleBattleSwing);

  const casualties = {
    attacker: { strengthLost: state.startingStrength.attacker - totalArmyStrength(state.attacker), unitsLost: 0 },
    defender: { strengthLost: state.startingStrength.defender - totalArmyStrength(state.defender), unitsLost: 0 },
  };

  const captainOutcomes = rollCaptainOutcomes(state, loserSide, rng);

  return { victor, tier, casualties, captainOutcomes, warScoreDelta };
}

// ─── formatBattleLog ─────────────────────────────────────────────────────────
// Human-readable log formatter. Reused by M5's BattleScreen text-log view,
// M6's "dispatches" toggle, and the M11 debug sandbox.

export function formatBattleLog(log: RoundLogEntry[]): string {
  const lines: string[] = [];
  for (const entry of log) {
    switch (entry.type) {
      case 'clash': {
        const totalA = entry.casualties.filter(c => c.side === 'attacker').reduce((s, c) => s + c.strengthLost, 0);
        const totalB = entry.casualties.filter(c => c.side === 'defender').reduce((s, c) => s + c.strengthLost, 0);
        lines.push(`R${entry.round} [${entry.laneId}] Clash — attacker −${totalA.toFixed(1)}, defender −${totalB.toFixed(1)}`);
        break;
      }
      case 'shock_charge':
        lines.push(`R${entry.round} [${entry.laneId}] ${entry.side} charges`);
        break;
      case 'terror':
        lines.push(`R${entry.round} [${entry.laneId}] Terror grips the ${entry.side}'s line`);
        break;
      case 'wing_break':
        lines.push(`R${entry.round} [${entry.laneId}] The ${entry.side}'s wing BREAKS`);
        break;
      case 'wheel':
        lines.push(`R${entry.round} ${entry.side} wheels from ${entry.fromLane} into ${entry.toLane}`);
        break;
      case 'pursue':
        lines.push(`R${entry.round} [${entry.laneId}] The routers are pursued — ${entry.unitsDestroyed} unit(s) destroyed`);
        break;
      case 'amok':
        lines.push(`R${entry.round} [${entry.laneId}] An elephant goes amok!`);
        break;
      case 'feint_result':
        lines.push(`R${entry.round} [${entry.laneId}] ${entry.side}'s feigned retreat — ${entry.result.toUpperCase()}`);
        break;
      case 'reserve_commit':
        lines.push(`R${entry.round} [${entry.laneId}] ${entry.side} commits reserves`);
        break;
      case 'stratagem_played': {
        const label = STRATAGEMS[entry.stratagemId as StratagemId]?.label ?? entry.stratagemId;
        const laneSuffix = entry.laneId ? ` [${entry.laneId}]` : '';
        lines.push(`R${entry.round} ${entry.side} plays ${label}${laneSuffix}`);
        break;
      }
      case 'withdrawal':
        lines.push(`R${entry.round} ${entry.side} withdraws in good order`);
        break;
      case 'battle_end':
        lines.push(`R${entry.round} BATTLE END — ${entry.outcome.victor} (${entry.outcome.tier}), warScore ${entry.outcome.warScoreDelta >= 0 ? '+' : ''}${entry.outcome.warScoreDelta}`);
        break;
    }
  }
  return lines.join('\n');
}
