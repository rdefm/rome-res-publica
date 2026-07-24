// ─── Enemy General AI ────────────────────────────────────────────────────────
// Chunk M7 — pure, seeded decision-making for the Carthaginian side.
// `chooseDeployment` runs once at deployment; `chooseOrders` runs once per
// round; `chooseBreakDecision` runs whenever the AI's side is the victor of
// a broken wing. All three read GeneralProfile (data/enemyGenerals.ts) for
// personality and lean on battleEngine's getValidOrders/getPlayable* as the
// single source of legality — this file never invents its own legality
// rules. No state/React imports.
//
// Deliberately under ~10 heuristic rules per lane/round (plan's "readable,
// not optimal" instruction) — profiles carry the variety, not rule count.
//
// Deviation: the plan's chooseDeployment(profile, army, terrain) signature
// is extended with `hand` (this side's drawn stratagem hand — needed to
// pick pre-battle plays) — a "first pass" signature gap, same category as
// several M1 types the plan flagged as refinable. No enemy-side army/intel
// is threaded in anywhere in this file: the AI deploys and plays pre-battle
// stratagems blind to the enemy's composition, same as a real commander
// would before the lines are drawn.
//
// Carthage has no clan/legate roster in this codebase (that's a Roman
// political mechanic — see musterEngine.ts), so chooseDeployment synthesizes
// one "lieutenant" captain per lane (a flat martial step below the general's
// own) purely so wedge/feint stay reachable for the AI.

import type {
  BattleState, BattleSide, BattleUnit, Deployment, FormationId, LaneId,
  LaneAssignment, SideOrders, TerrainMod, PreBattleStratagemPick,
} from '../../models/battle';
import { makeSeededRng, type RngFn } from '../../utils/seededRng';
import type { GeneralProfile } from '../../data/enemyGenerals';
import {
  getValidOrders, getPlayableStratagems, getPlayablePreBattleStratagems, type CaptainRoster,
} from './battleEngine';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const CAVALRY_CLASSES = new Set(['cavalry_heavy', 'cavalry_light']);
type DeploymentFormation = Exclude<FormationId, 'feigned_retreat'>;
const DEPLOYMENT_FORMATIONS: DeploymentFormation[] = ['line', 'shield_wall', 'open_ranks', 'wedge'];

function clampRange(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Derives a fresh, deterministic RNG for one AI decision from the battle's
 *  own seed plus a caller-chosen salt (e.g. round number, or round×lane) —
 *  independent of battleEngine's own internal RNG stream (see battleEngine.
 *  makeContinuedRng's header comment), so callers (BattleScreen.tsx) can
 *  recompute the same decision safely across re-renders without threading
 *  RNG state through React. */
export function deriveAiRng(battleSeed: number, salt: number): RngFn {
  return makeSeededRng(((battleSeed >>> 0) ^ (salt >>> 0) ^ 0x9e3779b9) >>> 0);
}

function totalStrength(units: BattleUnit[]): number {
  return units.reduce((s, u) => s + u.strength, 0);
}

function seededShuffle<T>(items: T[], rng: RngFn): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function weightedPick<T extends string>(weights: Partial<Record<T, number>>, legal: T[], rng: RngFn, fallback: T): T {
  const entries = legal.map(id => ({ id, weight: weights[id] ?? 0.1 })).filter(e => e.weight > 0);
  if (entries.length === 0) return fallback;
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight;
    if (roll <= 0) return e.id;
  }
  return entries[entries.length - 1].id;
}

// ─── chooseDeployment ────────────────────────────────────────────────────────

export interface AiDeploymentResult {
  deployment: Deployment;
  commanderId: string;
  roster: CaptainRoster;
}

function buildAiRoster(profile: GeneralProfile): { commanderId: string; roster: CaptainRoster; lieutenantIdByLane: Record<LaneId, string> } {
  const commanderId = `ai-general-${profile.id}`;
  const martialById: Record<string, number> = { [commanderId]: profile.martial };
  const lieutenantIdByLane = {} as Record<LaneId, string>;
  for (const laneId of LANES) {
    const id = `ai-lieutenant-${profile.id}-${laneId}`;
    lieutenantIdByLane[laneId] = id;
    martialById[id] = Math.max(1, profile.martial - 2);
  }
  return { commanderId, roster: { martialById }, lieutenantIdByLane };
}

/** Greedy least-filled placement — cavalry restricted to left/right (same
 *  rule battleEngine.initBattle enforces), everything else free to any lane. */
function distributeToLanes(units: BattleUnit[]): Record<LaneId, BattleUnit[]> {
  const lanes: Record<LaneId, BattleUnit[]> = { left: [], centre: [], right: [] };
  for (const u of units) {
    const eligible: LaneId[] = CAVALRY_CLASSES.has(u.unitClass) ? ['left', 'right'] : LANES;
    let best = eligible[0];
    for (const l of eligible) if (lanes[l].length < lanes[best].length) best = l;
    lanes[best].push(u);
  }
  return lanes;
}

function pickCommanderStation(profile: GeneralProfile, lanes: Record<LaneId, BattleUnit[]>, rng: RngFn): LaneId | 'reserve' {
  if (rng() > profile.aggression) return 'reserve';
  let best: LaneId = 'centre';
  for (const l of LANES) if (totalStrength(lanes[l]) > totalStrength(lanes[best])) best = l;
  return best;
}

export function chooseDeployment(
  profile: GeneralProfile,
  army: BattleUnit[],
  terrain: TerrainMod,
  hand: string[],
  rng: RngFn,
): AiDeploymentResult {
  const { commanderId, roster, lieutenantIdByLane } = buildAiRoster(profile);

  // Cautious generals hold more back; aggressive ones commit almost everything.
  const reserveFraction = clampRange(0.4 - profile.aggression * 0.3, 0.1, 0.4);
  const shuffled = seededShuffle(army, rng);
  const reserveCount = Math.round(shuffled.length * reserveFraction);
  const reserve = shuffled.slice(0, reserveCount);
  const active = shuffled.slice(reserveCount);

  const laneUnits = distributeToLanes(active);
  const commanderStation = pickCommanderStation(profile, laneUnits, rng);

  const lanes = {} as Record<LaneId, LaneAssignment>;
  for (const laneId of LANES) {
    const units = laneUnits[laneId];
    const formation = units.length > 0
      ? weightedPick(profile.formationPreferenceWeights, DEPLOYMENT_FORMATIONS, rng, 'line')
      : 'line';
    lanes[laneId] = {
      units,
      captainId: commanderStation === laneId ? null : lieutenantIdByLane[laneId],
      formation,
    };
  }

  const playable = getPlayablePreBattleStratagems(hand, terrain);
  const preBattleStratagems: PreBattleStratagemPick[] = [];
  const pickTargetLane = (): LaneId => LANES[Math.floor(rng() * LANES.length)];
  const tryAdd = (id: string): void => {
    if (preBattleStratagems.some(p => p.stratagemId === id)) return;
    const def = playable.find(d => d.id === id);
    if (!def) return;
    const laneId = (def.target === 'own_lane' || def.target === 'enemy_lane') ? pickTargetLane() : undefined;
    preBattleStratagems.push({ stratagemId: id, laneId });
  };

  if (profile.signatureStratagemId) tryAdd(profile.signatureStratagemId);
  if (preBattleStratagems.length < 2 && rng() < 0.4) {
    const remaining = playable.filter(d => !preBattleStratagems.some(p => p.stratagemId === d.id));
    if (remaining.length > 0) tryAdd(remaining[Math.floor(rng() * remaining.length)].id);
  }

  return {
    commanderId,
    roster,
    deployment: { lanes, reserve, commanderStation, preBattleStratagems },
  };
}

// ─── chooseOrders ────────────────────────────────────────────────────────────

export function chooseOrders(profile: GeneralProfile, state: BattleState, sideKey: BattleSide, rng: RngFn): SideOrders {
  const side = state[sideKey];
  const enemyKey: BattleSide = sideKey === 'attacker' ? 'defender' : 'attacker';
  const enemy = state[enemyKey];
  const valid = getValidOrders(state, sideKey);

  const laneOrders: SideOrders['laneOrders'] = {};
  for (const laneId of LANES) {
    const wing = side.wings[laneId];
    if (wing.broken || wing.units.length === 0) continue;
    const enemyWing = enemy.wings[laneId];
    const affordances = valid.lanes[laneId];

    // Rule 1: feint, if this general likes to and the lane allows it.
    if (affordances.feintGated && rng() < profile.feintPreference) {
      laneOrders[laneId] = { formation: 'feigned_retreat' };
      continue;
    }

    const legal = affordances.legalFormations.filter((f): f is DeploymentFormation => f !== 'feigned_retreat');
    const engaged = enemyWing.units.length > 0;
    const losingBadly = engaged && wing.moralePool < enemyWing.moralePool - 15;
    const enemyWeak = engaged && enemyWing.moralePool < wing.moralePool - 15;

    let target: FormationId = wing.formation;
    if (losingBadly && legal.includes('shield_wall') && rng() < (1 - profile.aggression)) {
      // Rule 2: losing badly → fall back on the shield wall, more readily the less aggressive this general is.
      target = 'shield_wall';
    } else if (enemyWeak && legal.includes('wedge') && rng() < profile.aggression) {
      // Rule 3: enemy wing looks weak → press the advantage, more readily the more aggressive this general is.
      target = 'wedge';
    } else if (rng() < 0.2) {
      // Rule 4: otherwise, occasionally re-roll toward this general's standing preference (inertia — no flapping every round).
      target = weightedPick(profile.formationPreferenceWeights, legal, rng, wing.formation as DeploymentFormation);
    }
    if (target !== wing.formation) laneOrders[laneId] = { formation: target };
  }

  // Rule 5: commit the whole reserve to the weakest own lane, once patience runs out.
  let commitReserves: SideOrders['commitReserves'];
  if (valid.reserveAvailable && side.reserve.length > 0 && state.round >= profile.reservePatience) {
    const candidateLanes = LANES.filter(l => !side.wings[l].broken && side.wings[l].units.length > 0);
    if (candidateLanes.length > 0) {
      let weakest = candidateLanes[0];
      for (const l of candidateLanes) if (side.wings[l].moralePool < side.wings[weakest].moralePool) weakest = l;
      commitReserves = { laneId: weakest, unitIds: side.reserve.map(u => u.id) };
    }
  }

  // Rule 6: always rally a broken wing when it's legal — no general leaves that on the table.
  let stratagemId: string | undefined;
  let stratagemLaneId: LaneId | undefined;
  const rally = getPlayableStratagems(state, sideKey).find(r => r.stratagemId === 'rally_the_standards');
  if (rally && rally.validLanes.length > 0) {
    stratagemId = 'rally_the_standards';
    stratagemLaneId = rally.validLanes[0];
  }

  // Rule 7: withdraw when the army is broken and desperate — cautious generals pull the trigger sooner.
  const brokenCount = LANES.filter(l => side.wings[l].broken).length;
  const standing = LANES.filter(l => !side.wings[l].broken && side.wings[l].units.length > 0).map(l => side.wings[l].moralePool);
  const avgStandingMorale = standing.length > 0 ? standing.reduce((a, b) => a + b, 0) / standing.length : 100;
  const desperate = brokenCount >= 1 && avgStandingMorale < 25;
  const withdraw = valid.withdrawAvailable && desperate && rng() < (1 - profile.aggression) * 0.6;

  return {
    laneOrders,
    ...(commitReserves ? { commitReserves } : {}),
    ...(stratagemId ? { stratagemId, stratagemLaneId } : {}),
    ...(withdraw ? { withdraw: true } : {}),
  };
}

// ─── chooseBreakDecision ─────────────────────────────────────────────────────

export function chooseBreakDecision(
  profile: GeneralProfile,
  state: BattleState,
  victorSideKey: BattleSide,
  laneId: LaneId,
  rng: RngFn,
): { decision: 'pursue' | 'wheel'; targetLane?: LaneId } {
  if (rng() < profile.pursueBias) return { decision: 'pursue' };

  const validTargets: LaneId[] = laneId === 'centre' ? ['left', 'right'] : ['centre'];
  if (validTargets.length === 1) return { decision: 'wheel', targetLane: validTargets[0] };

  // Two candidate wheel targets (from centre) — flank whichever of the
  // enemy's remaining wings is already weaker.
  const enemyKey: BattleSide = victorSideKey === 'attacker' ? 'defender' : 'attacker';
  const enemy = state[enemyKey];
  const [a, b] = validTargets;
  const target = enemy.wings[a].moralePool <= enemy.wings[b].moralePool ? a : b;
  return { decision: 'wheel', targetLane: target };
}
