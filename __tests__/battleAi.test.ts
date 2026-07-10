// ─── Enemy General AI (M7) ───────────────────────────────────────────────────
// Headless AI-vs-AI battles driving battleAi.ts through the real orchestrator
// (battleEngine.ts) — per the plan's Chunk M7 test list: the AI never submits
// illegal orders, each profile's order distribution measurably differs, and
// Rally the Standards fires at most once per side per battle. M11 will build
// the general-purpose simulateBattles harness; this file's runner is a
// minimal, test-local equivalent (not exported/reused elsewhere).

import {
  initBattle, submitOrders, submitBreakDecision, getValidOrders, getPlayableStratagems,
  drawStratagemHand, type DeploySideInput,
} from '../src/engine/battle/battleEngine';
import { chooseDeployment, chooseOrders, chooseBreakDecision, deriveAiRng } from '../src/engine/battle/battleAi';
import { ENEMY_GENERALS, type GeneralProfile } from '../src/data/enemyGenerals';
import { makeSeededRng } from '../src/utils/seededRng';
import type {
  BattleUnit, UnitClass, Veterancy, LaneId, TerrainMod, BattleState, BattleSide,
  SideOrders, FormationId,
} from '../src/models/battle';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const NEUTRAL_TERRAIN: TerrainMod = { id: 'coastal_plain', label: 'Coastal Plain', mods: {} };

let unitCounter = 0;
function makeUnit(unitClass: UnitClass, overrides: Partial<BattleUnit> = {}): BattleUnit {
  unitCounter += 1;
  return { id: `ai-u${unitCounter}`, unitClass, strength: 100, veterancy: 'trained' as Veterancy, loyalty: 50, elephantSteady: false, ...overrides };
}

/** A mixed 8-unit army so every general's formation/stratagem heuristics
 *  have real material to react to (pure infantry armies would starve the
 *  wedge/cavalry-driven heuristics of anything to trigger on). */
function makeMixedArmy(): BattleUnit[] {
  return [
    makeUnit('legionary'), makeUnit('legionary'),
    makeUnit('spear_foot'), makeUnit('spear_foot'),
    makeUnit('cavalry_heavy'), makeUnit('cavalry_light'),
    makeUnit('skirmisher'), makeUnit('elephant'),
  ];
}

function validateOrders(state: BattleState, side: BattleSide, orders: SideOrders, illegal: string[]): void {
  const valid = getValidOrders(state, side);
  for (const laneId of LANES) {
    const lo = orders.laneOrders[laneId];
    if (lo?.formation && !valid.lanes[laneId].legalFormations.includes(lo.formation)) {
      illegal.push(`${side} lane ${laneId} ordered illegal formation ${lo.formation}`);
    }
  }
  if (orders.commitReserves && !valid.reserveAvailable) {
    illegal.push(`${side} committed reserves while unavailable`);
  }
  if (orders.withdraw && !valid.withdrawAvailable) {
    illegal.push(`${side} withdrew while unavailable`);
  }
  if (orders.stratagemId) {
    const playable = getPlayableStratagems(state, side);
    const match = playable.find(p => p.stratagemId === orders.stratagemId);
    if (!match) illegal.push(`${side} played unavailable/illegal stratagem ${orders.stratagemId}`);
    else if (orders.stratagemLaneId && !match.validLanes.includes(orders.stratagemLaneId)) {
      illegal.push(`${side} targeted an illegal lane for ${orders.stratagemId}`);
    }
  }
}

function sampleFormations(state: BattleState, side: BattleSide, counts: Partial<Record<FormationId, number>>): void {
  for (const laneId of LANES) {
    const f = state[side].wings[laneId].formation;
    if (state[side].wings[laneId].units.length === 0) continue;
    counts[f] = (counts[f] ?? 0) + 1;
  }
}

interface AiVsAiResult {
  finalState: BattleState;
  formationCounts: Record<BattleSide, Partial<Record<FormationId, number>>>;
  illegal: string[];
}

function runAiVsAiBattle(profileA: GeneralProfile, profileB: GeneralProfile, seed: number): AiVsAiResult {
  const illegal: string[] = [];
  const formationCounts: Record<BattleSide, Partial<Record<FormationId, number>>> = { attacker: {}, defender: {} };

  const armyA = makeMixedArmy();
  const armyB = makeMixedArmy();
  const handA = drawStratagemHand(profileA.martial, armyA, NEUTRAL_TERRAIN, makeSeededRng(seed ^ 0x1111));
  const handB = drawStratagemHand(profileB.martial, armyB, NEUTRAL_TERRAIN, makeSeededRng(seed ^ 0x2222));
  const deployA = chooseDeployment(profileA, armyA, NEUTRAL_TERRAIN, handA, makeSeededRng(seed ^ 0x3333));
  const deployB = chooseDeployment(profileB, armyB, NEUTRAL_TERRAIN, handB, makeSeededRng(seed ^ 0x4444));

  const attackerInput: DeploySideInput = {
    label: profileA.name, deployment: deployA.deployment, commanderId: deployA.commanderId,
    roster: deployA.roster, generalProfileId: profileA.id, stratagemHand: handA,
  };
  const defenderInput: DeploySideInput = {
    label: profileB.name, deployment: deployB.deployment, commanderId: deployB.commanderId,
    roster: deployB.roster, generalProfileId: profileB.id, stratagemHand: handB,
  };

  let state = initBattle(attackerInput, defenderInput, NEUTRAL_TERRAIN, seed);
  let iterations = 0;
  while (state.phase !== 'resolved' && iterations < 60) {
    iterations += 1;
    if (state.phase === 'orders') {
      sampleFormations(state, 'attacker', formationCounts.attacker);
      sampleFormations(state, 'defender', formationCounts.defender);
      const ordersA = chooseOrders(profileA, state, 'attacker', deriveAiRng(seed, state.round * 10 + 1));
      const ordersB = chooseOrders(profileB, state, 'defender', deriveAiRng(seed, state.round * 10 + 2));
      validateOrders(state, 'attacker', ordersA, illegal);
      validateOrders(state, 'defender', ordersB, illegal);
      state = submitOrders(state, ordersA, ordersB);
    } else if (state.phase === 'break_decision') {
      const pending = state.pendingBreakDecisions[0];
      if (!pending) throw new Error('break_decision phase with no pending decisions');
      const victorSideKey: BattleSide = pending.brokenSide === 'attacker' ? 'defender' : 'attacker';
      const victorProfile = victorSideKey === 'attacker' ? profileA : profileB;
      const { decision, targetLane } = chooseBreakDecision(
        victorProfile, state, victorSideKey, pending.laneId, deriveAiRng(seed, state.round * 10 + 3),
      );
      state = submitBreakDecision(state, pending.laneId, decision, targetLane);
    } else {
      throw new Error(`unexpected phase '${state.phase}'`);
    }
  }
  if (state.phase !== 'resolved') illegal.push(`battle did not resolve within safety cap (seed ${seed})`);

  return { finalState: state, formationCounts, illegal };
}

// ─── No illegal orders ───────────────────────────────────────────────────────

describe('AI legality', () => {
  test('never submits an order getValidOrders/getPlayableStratagems would reject, across 200 seeded battles', () => {
    const profiles = Object.values(ENEMY_GENERALS);
    const allIllegal: string[] = [];
    for (let seed = 1; seed <= 200; seed++) {
      const profileA = profiles[seed % profiles.length];
      const profileB = profiles[(seed + 1) % profiles.length];
      const { illegal } = runAiVsAiBattle(profileA, profileB, seed * 7919);
      allIllegal.push(...illegal);
    }
    expect(allIllegal).toEqual([]);
  }, 30000);
});

// ─── Per-profile distinctiveness ────────────────────────────────────────────

describe('AI personality distinctiveness', () => {
  test("Bomilcar the Bull's wedge rate is more than double Hanno the Cautious's, same fixed opponent", () => {
    const opponent = ENEMY_GENERALS.xanthippus_drillmaster;
    const seeds = Array.from({ length: 25 }, (_, i) => 1000 + i * 13);

    function wedgeRateFor(profile: GeneralProfile): number {
      let wedge = 0;
      let total = 0;
      for (const seed of seeds) {
        const { formationCounts } = runAiVsAiBattle(profile, opponent, seed);
        wedge += formationCounts.attacker.wedge ?? 0;
        total += Object.values(formationCounts.attacker).reduce((a, b) => a + (b ?? 0), 0);
      }
      return total > 0 ? wedge / total : 0;
    }

    const bomilcarRate = wedgeRateFor(ENEMY_GENERALS.bomilcar_bull);
    const hannoRate = wedgeRateFor(ENEMY_GENERALS.hanno_cautious);

    expect(hannoRate).toBeGreaterThanOrEqual(0);
    expect(bomilcarRate).toBeGreaterThan(hannoRate * 2);
  }, 30000);
});

// ─── Rally the Standards ─────────────────────────────────────────────────────

describe('Rally the Standards (AI usage)', () => {
  test('never plays more than once per side per battle', () => {
    const profiles = Object.values(ENEMY_GENERALS);
    for (let seed = 1; seed <= 60; seed++) {
      const profileA = profiles[seed % profiles.length];
      const profileB = profiles[(seed + 2) % profiles.length];
      const { finalState } = runAiVsAiBattle(profileA, profileB, seed * 104729);
      const attackerRallyCount = (finalState.attacker.stratagemsPlayed ?? []).filter(id => id === 'rally_the_standards').length;
      const defenderRallyCount = (finalState.defender.stratagemsPlayed ?? []).filter(id => id === 'rally_the_standards').length;
      expect(attackerRallyCount).toBeLessThanOrEqual(1);
      expect(defenderRallyCount).toBeLessThanOrEqual(1);
    }
  }, 30000);
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  test('same seed + profiles produce an identical outcome', () => {
    const r1 = runAiVsAiBattle(ENEMY_GENERALS.hamilcar_fox, ENEMY_GENERALS.bomilcar_bull, 555);
    unitCounter = 0; // reset so the second run mints identical unit ids
    const r2 = runAiVsAiBattle(ENEMY_GENERALS.hamilcar_fox, ENEMY_GENERALS.bomilcar_bull, 555);
    expect(r1.finalState.outcome).toEqual(r2.finalState.outcome);
  });
});
