// ─── Headless Battle Simulation Harness ─────────────────────────────────────
// Chunk M11 — `simulateBattles` runs N battles through the real orchestrator
// (battleEngine.ts) with no UI, returning aggregate stats for tuning and for
// reproducing bug reports. Pure engine code — no state/React imports. The
// only production caller is DebugPanel.tsx (via a plain function call, not a
// store action — results are ephemeral debug output, not persisted state).
//
// Two driving modes, matching the plan's `aiVsAi` flag:
//   - aiVsAi = true:  both sides are driven by battleAi (chooseDeployment/
//     chooseOrders/chooseBreakDecision) against a GeneralProfile — this is
//     the "two commanders actually fighting" mode, used for AI legality/
//     personality/crushing-rate stats. Requires `army` on both configs.
//   - aiVsAi = false: a trivial "hold formation, always pursue" policy on
//     both sides (the same policy __tests__/battleEngine.test.ts's
//     runFullBattle and the Cannae regression use) — isolates raw unit-stat/
//     composition effects from AI decision-making noise. Callers may pass an
//     explicit `deployment` (to fix formations/lane assignments precisely,
//     e.g. testing a specific counter-composition) or just `army`, which is
//     auto-spread across lanes via `buildAutoDeployment`.
//
// This file's runner is the generalized version of the ad-hoc loops in
// __tests__/battleEngine.test.ts (runFullBattle) and __tests__/battleAi.test.ts
// (runAiVsAiBattle) — those stay test-local (per their own header comments);
// this is the reusable one.

import type {
  BattleUnit, Deployment, LaneId, LaneAssignment, TerrainMod, SideOrders,
  BattleState, BattleSide, FormationId,
} from '../../models/battle';
import { BALANCE } from '../../data/balance';
import { makeSeededRng } from '../../utils/seededRng';
import {
  initBattle, submitOrders, submitBreakDecision, drawStratagemHand,
  type DeploySideInput, type CaptainRoster,
} from './battleEngine';
import { chooseDeployment, chooseOrders, chooseBreakDecision, deriveAiRng } from './battleAi';
import type { GeneralProfile } from '../../data/enemyGenerals';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const EMPTY_ORDERS: SideOrders = { laneOrders: {} };
const NEUTRAL_TERRAIN: TerrainMod = BALANCE.battle.terrains.coastal_plain;
const SAFETY_ROUND_CAP = 60;

// ─── Config ──────────────────────────────────────────────────────────────────

export interface BattleSimConfig {
  label: string;
  /** Personality (aiVsAi mode) / martial rating source (both modes) — every
   *  config needs one, even in trivial mode, since a commander martial
   *  rating is still read by clashEngine's command multiplier. */
  generalProfile: GeneralProfile;
  /** Required unless `deployment` is given (trivial mode only). */
  army?: BattleUnit[];
  /** Trivial-mode only: an explicit deployment (fixed formations/lane
   *  assignments), e.g. to test one specific counter-composition. Ignored
   *  in aiVsAi mode — chooseDeployment always decides there. */
  deployment?: Deployment;
  /** Trivial-mode only, paired with an explicit `deployment` that assigns
   *  captainIds: martial ratings for those captains. Defaults to a
   *  commander-only roster at generalProfile.martial. */
  roster?: CaptainRoster;
}

// ─── Auto-deployment (trivial mode default) ─────────────────────────────────

/** Spreads units across the three lanes (cavalry restricted to wings, per
 *  battleEngine.initBattle's validation), all in 'line' formation, no
 *  captains — same policy as gameStore.ts's sandbox default deployment,
 *  reimplemented here to keep this file free of state-layer imports. */
export function buildAutoDeployment(units: BattleUnit[]): Deployment {
  const isCavalry = (u: BattleUnit) => u.unitClass === 'cavalry_heavy' || u.unitClass === 'cavalry_light';
  const cavalry = units.filter(isCavalry);
  const rest = units.filter(u => !isCavalry(u));

  const left: BattleUnit[] = [];
  const centre: BattleUnit[] = [];
  const right: BattleUnit[] = [];

  cavalry.forEach((u, i) => (i % 2 === 0 ? left : right).push(u));
  rest.forEach((u, i) => {
    const slot = i % 3;
    (slot === 0 ? left : slot === 1 ? centre : right).push(u);
  });

  const lanes: Record<LaneId, LaneAssignment> = {
    left:   { units: left,   captainId: null, formation: 'line' },
    centre: { units: centre, captainId: null, formation: 'line' },
    right:  { units: right,  captainId: null, formation: 'line' },
  };
  return { lanes, reserve: [], commanderStation: 'centre' };
}

// ─── One battle ──────────────────────────────────────────────────────────────

function buildInput(config: BattleSimConfig, side: BattleSide, terrain: TerrainMod, seed: number, aiVsAi: boolean): DeploySideInput {
  if (aiVsAi) {
    if (!config.army) throw new Error(`simulateBattles: config '${config.label}' needs 'army' in aiVsAi mode`);
    const salt = side === 'attacker' ? 0x1111 : 0x2222;
    const deploySalt = side === 'attacker' ? 0x3333 : 0x4444;
    const hand = drawStratagemHand(config.generalProfile.martial, config.army, terrain, makeSeededRng(seed ^ salt));
    const deployed = chooseDeployment(config.generalProfile, config.army, terrain, hand, makeSeededRng(seed ^ deploySalt));
    return {
      label: config.label, deployment: deployed.deployment, commanderId: deployed.commanderId,
      roster: deployed.roster, generalProfileId: config.generalProfile.id, stratagemHand: hand,
    };
  }
  const deployment = config.deployment ?? buildAutoDeployment(config.army ?? []);
  const commanderId = `${config.label}-commander`;
  const roster = config.roster ?? { martialById: { [commanderId]: config.generalProfile.martial } };
  return { label: config.label, deployment, commanderId, roster };
}

interface SingleBattleResult {
  state: BattleState;
  formationCounts: Record<BattleSide, Partial<Record<FormationId, number>>>;
  resolved: boolean;
}

function sampleFormations(state: BattleState, side: BattleSide, counts: Partial<Record<FormationId, number>>): void {
  for (const laneId of LANES) {
    const wing = state[side].wings[laneId];
    if (wing.units.length === 0) continue;
    counts[wing.formation] = (counts[wing.formation] ?? 0) + 1;
  }
}

function runOneBattle(configA: BattleSimConfig, configB: BattleSimConfig, seed: number, aiVsAi: boolean, terrain: TerrainMod): SingleBattleResult {
  const attackerInput = buildInput(configA, 'attacker', terrain, seed, aiVsAi);
  const defenderInput = buildInput(configB, 'defender', terrain, seed, aiVsAi);

  const formationCounts: Record<BattleSide, Partial<Record<FormationId, number>>> = { attacker: {}, defender: {} };
  let state = initBattle(attackerInput, defenderInput, terrain, seed);
  let iterations = 0;

  while (state.phase !== 'resolved' && iterations < SAFETY_ROUND_CAP) {
    iterations += 1;
    if (state.phase === 'orders') {
      sampleFormations(state, 'attacker', formationCounts.attacker);
      sampleFormations(state, 'defender', formationCounts.defender);
      const ordersA: SideOrders = aiVsAi
        ? chooseOrders(configA.generalProfile, state, 'attacker', deriveAiRng(seed, state.round * 10 + 1))
        : EMPTY_ORDERS;
      const ordersB: SideOrders = aiVsAi
        ? chooseOrders(configB.generalProfile, state, 'defender', deriveAiRng(seed, state.round * 10 + 2))
        : EMPTY_ORDERS;
      state = submitOrders(state, ordersA, ordersB);
    } else if (state.phase === 'break_decision') {
      const pending = state.pendingBreakDecisions[0];
      if (!pending) throw new Error('break_decision phase with no pending decisions');
      if (aiVsAi) {
        const victorSideKey: BattleSide = pending.brokenSide === 'attacker' ? 'defender' : 'attacker';
        const victorProfile = victorSideKey === 'attacker' ? configA.generalProfile : configB.generalProfile;
        const { decision, targetLane } = chooseBreakDecision(
          victorProfile, state, victorSideKey, pending.laneId, deriveAiRng(seed, state.round * 10 + 3),
        );
        state = submitBreakDecision(state, pending.laneId, decision, targetLane);
      } else {
        state = submitBreakDecision(state, pending.laneId, 'pursue');
      }
    } else {
      break;
    }
  }

  return { state, formationCounts, resolved: state.phase === 'resolved' };
}

// ─── Aggregate stats ─────────────────────────────────────────────────────────

export interface BattleSimAggregate {
  trials: number;
  /** Battles that failed to resolve within the safety cap — should be 0. */
  unresolved: number;
  attackerWinRate: number;
  defenderWinRate: number;
  withdrawalRate: number;
  crushingRate: number;
  medianRounds: number;
  p90Rounds: number;
  avgCasualtyPct: { attacker: number; defender: number };
  /** Fraction of battles with at least one amok event. */
  amokFrequency: number;
  /** Round-sampled formation usage counts, summed across all trials. */
  formationUsage: Record<BattleSide, Partial<Record<FormationId, number>>>;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}

function mergeFormationCounts(
  into: Record<BattleSide, Partial<Record<FormationId, number>>>,
  from: Record<BattleSide, Partial<Record<FormationId, number>>>,
): void {
  for (const side of ['attacker', 'defender'] as const) {
    for (const [formation, count] of Object.entries(from[side])) {
      into[side][formation as FormationId] = (into[side][formation as FormationId] ?? 0) + (count ?? 0);
    }
  }
}

/** Runs `n` battles (seeds 1..n, offset by `seedBase`) between configA
 *  (attacker) and configB (defender) and returns aggregate stats. See the
 *  file header for the two `aiVsAi` modes. `terrain` defaults to the
 *  neutral coastal_plain (no modifiers), applied to both sides equally. */
export function simulateBattles(
  configA: BattleSimConfig,
  configB: BattleSimConfig,
  n: number,
  aiVsAi: boolean = true,
  terrain: TerrainMod = NEUTRAL_TERRAIN,
  seedBase: number = 1,
): BattleSimAggregate {
  let unresolved = 0;
  let attackerWins = 0;
  let defenderWins = 0;
  let withdrawals = 0;
  let crushing = 0;
  let amokBattles = 0;
  const rounds: number[] = [];
  let casualtyPctAttackerSum = 0;
  let casualtyPctDefenderSum = 0;
  const formationUsage: Record<BattleSide, Partial<Record<FormationId, number>>> = { attacker: {}, defender: {} };

  for (let i = 0; i < n; i++) {
    const seed = seedBase + i;
    const { state, formationCounts, resolved } = runOneBattle(configA, configB, seed, aiVsAi, terrain);
    if (!resolved || !state.outcome) {
      unresolved += 1;
      continue;
    }
    const outcome = state.outcome;
    if (outcome.victor === 'attacker') attackerWins += 1;
    else if (outcome.victor === 'defender') defenderWins += 1;
    else withdrawals += 1;
    if (outcome.tier === 'crushing') crushing += 1;
    if (state.log.some(e => e.type === 'amok')) amokBattles += 1;

    rounds.push(state.round);
    const startAtk = state.startingStrength.attacker || 1;
    const startDef = state.startingStrength.defender || 1;
    casualtyPctAttackerSum += outcome.casualties.attacker.strengthLost / startAtk;
    casualtyPctDefenderSum += outcome.casualties.defender.strengthLost / startDef;

    mergeFormationCounts(formationUsage, formationCounts);
  }

  const resolvedCount = n - unresolved;
  rounds.sort((a, b) => a - b);

  return {
    trials: n,
    unresolved,
    attackerWinRate: resolvedCount > 0 ? attackerWins / resolvedCount : 0,
    defenderWinRate: resolvedCount > 0 ? defenderWins / resolvedCount : 0,
    withdrawalRate: resolvedCount > 0 ? withdrawals / resolvedCount : 0,
    crushingRate: resolvedCount > 0 ? crushing / resolvedCount : 0,
    medianRounds: percentile(rounds, 0.5),
    p90Rounds: percentile(rounds, 0.9),
    avgCasualtyPct: {
      attacker: resolvedCount > 0 ? casualtyPctAttackerSum / resolvedCount : 0,
      defender: resolvedCount > 0 ? casualtyPctDefenderSum / resolvedCount : 0,
    },
    amokFrequency: resolvedCount > 0 ? amokBattles / resolvedCount : 0,
    formationUsage,
  };
}
