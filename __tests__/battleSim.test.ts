// ─── Chunk M11 — simulateBattles harness ────────────────────────────────────
// Two kinds of coverage:
//   1. Harness mechanics: aggregation is correct, determinism holds, both
//      aiVsAi modes run without throwing.
//   2. Regression locks for the M11 tuning pass's targets (mirror win rate,
//      elephant-vs-counter loss rate, each class earning a winning slot,
//      AI-vs-AI crushing rate) — see rome-military-implementation-plan.md's
//      "## Tuning log" appendix for the full write-up of what these numbers
//      mean and how BALANCE.battle was adjusted to hit them.

import {
  simulateBattles, buildAutoDeployment, type BattleSimConfig,
} from '../src/engine/battle/battleSim';
import { ENEMY_GENERALS } from '../src/data/enemyGenerals';
import type {
  BattleUnit, UnitClass, Veterancy, Deployment, LaneId, LaneAssignment, FormationId,
} from '../src/models/battle';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const GEN = ENEMY_GENERALS.hanno_cautious;

let unitCounter = 0;
function makeUnit(unitClass: UnitClass, overrides: Partial<BattleUnit> = {}): BattleUnit {
  unitCounter += 1;
  return { id: `bs-u${unitCounter}`, unitClass, strength: 100, veterancy: 'trained' as Veterancy, loyalty: 50, elephantSteady: false, ...overrides };
}
function makeLane(unitClass: UnitClass, count: number): BattleUnit[] {
  return Array.from({ length: count }, () => makeUnit(unitClass));
}
function deploy(
  laneUnits: Partial<Record<LaneId, BattleUnit[]>>,
  formations: Partial<Record<LaneId, FormationId>> = {},
  captains: Partial<Record<LaneId, string>> = {},
): Deployment {
  const lanes = {} as Record<LaneId, LaneAssignment>;
  for (const l of LANES) {
    lanes[l] = { units: laneUnits[l] ?? [], captainId: captains[l] ?? null, formation: formations[l] ?? 'line' };
  }
  return { lanes, reserve: [], commanderStation: 'centre' };
}
function mixedArmy(): BattleUnit[] {
  return [
    makeUnit('legionary'), makeUnit('legionary'), makeUnit('legionary'),
    makeUnit('spear_foot'), makeUnit('spear_foot'),
    makeUnit('cavalry_heavy'), makeUnit('cavalry_light'),
    makeUnit('skirmisher'), makeUnit('elephant'),
  ];
}

// ─── Harness mechanics ───────────────────────────────────────────────────────

describe('simulateBattles mechanics', () => {
  test('is deterministic: same configs + same seedBase reproduce identical aggregate stats', () => {
    const build = (): BattleSimConfig => ({ label: 'A', generalProfile: GEN, army: mixedArmy() });
    const agg1 = simulateBattles(build(), build(), 15, true, undefined, 500);
    const agg2 = simulateBattles(build(), build(), 15, true, undefined, 500);
    expect(agg2).toEqual(agg1);
  });

  test('win rates + withdrawal rate sum to 1 when every trial resolves', () => {
    const a: BattleSimConfig = { label: 'A', generalProfile: GEN, army: mixedArmy() };
    const b: BattleSimConfig = { label: 'B', generalProfile: GEN, army: mixedArmy() };
    const agg = simulateBattles(a, b, 40, true);
    expect(agg.unresolved).toBe(0);
    expect(agg.attackerWinRate + agg.defenderWinRate + agg.withdrawalRate).toBeCloseTo(1, 5);
  });

  test('trivial (aiVsAi=false) mode runs a plain hold-formation/always-pursue policy and honours an explicit deployment', () => {
    const a: BattleSimConfig = {
      label: 'A', generalProfile: GEN,
      deployment: deploy({ left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) }),
    };
    const b: BattleSimConfig = { label: 'B', generalProfile: GEN, army: makeLane('legionary', 9) };
    const agg = simulateBattles(a, b, 20, false);
    expect(agg.unresolved).toBe(0);
    // No formation ever changes from the explicit 'line' deployment in trivial mode.
    expect(Object.keys(agg.formationUsage.attacker)).toEqual(['line']);
  });

  test('buildAutoDeployment keeps cavalry off the centre lane (battleEngine.initBattle would reject it otherwise)', () => {
    const units = [...makeLane('cavalry_heavy', 4), ...makeLane('legionary', 5)];
    const deployment = buildAutoDeployment(units);
    const centreCavalry = deployment.lanes.centre.units.filter(u => u.unitClass === 'cavalry_heavy');
    expect(centreCavalry).toEqual([]);
  });

  test('throws a clear error if aiVsAi=true and a config has no army', () => {
    const a: BattleSimConfig = { label: 'A', generalProfile: GEN, deployment: buildAutoDeployment(makeLane('legionary', 3)) };
    const b: BattleSimConfig = { label: 'B', generalProfile: GEN, army: mixedArmy() };
    expect(() => simulateBattles(a, b, 1, true)).toThrow(/needs 'army'/);
  });
});

// ─── M11 tuning targets (regression locks) ──────────────────────────────────

describe('M11 tuning targets', () => {
  test('mirror armies (identical legionary compositions, trivial mode): 47-53% either side', () => {
    const army = () => makeLane('legionary', 9);
    const a: BattleSimConfig = { label: 'A', generalProfile: GEN, army: army() };
    const b: BattleSimConfig = { label: 'B', generalProfile: GEN, army: army() };
    const agg = simulateBattles(a, b, 300, false);
    expect(agg.unresolved).toBe(0);
    expect(agg.attackerWinRate).toBeGreaterThanOrEqual(0.47);
    expect(agg.attackerWinRate).toBeLessThanOrEqual(0.53);
    // Same scenario also anchors the round-length target (4-7 median, p90<=10)
    // exercised directly against real deployments in battleEngine.test.ts.
    expect(agg.medianRounds).toBeGreaterThanOrEqual(4);
    expect(agg.medianRounds).toBeLessThanOrEqual(7);
    expect(agg.p90Rounds).toBeLessThanOrEqual(10);
  });

  test('elephant army vs a prepared counter (skirmisher+spear+open_ranks) loses >=60% of trials', () => {
    const elephantArmy: BattleSimConfig = {
      label: 'elephant-army', generalProfile: GEN,
      deployment: deploy({ left: makeLane('elephant', 3), centre: makeLane('elephant', 3), right: makeLane('elephant', 3) }),
    };
    const preparedCounter: BattleSimConfig = {
      label: 'prepared', generalProfile: GEN,
      deployment: deploy(
        {
          left: [...makeLane('spear_foot', 2), ...makeLane('skirmisher', 1)],
          centre: [...makeLane('spear_foot', 2), ...makeLane('skirmisher', 1)],
          right: [...makeLane('spear_foot', 2), ...makeLane('skirmisher', 1)],
        },
        { left: 'open_ranks', centre: 'open_ranks', right: 'open_ranks' },
      ),
    };
    const agg = simulateBattles(elephantArmy, preparedCounter, 200, false);
    // Rare stalemate tail (elephants ground down by repeated amok events
    // without a matching morale drain — see the Tuning log appendix) can
    // leave a trial or two unresolved within the 60-round safety cap; not
    // the thing under test here, just bounded so a real regression (a
    // scenario that stops resolving reliably) still fails the suite.
    expect(agg.unresolved).toBeLessThanOrEqual(4);
    const resolved = agg.trials - agg.unresolved;
    const elephantLossRate = (resolved - agg.attackerWinRate * resolved) / resolved;
    expect(elephantLossRate).toBeGreaterThanOrEqual(0.6);
  });

  test('every unit class appears in at least one composition beating naive all-legionary >=55% of the time', () => {
    const naive = (): BattleSimConfig => ({
      label: 'naive', generalProfile: GEN,
      deployment: deploy({ left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) }),
    });
    const wedgeRoster = { martialById: { 'capt-l': 6, 'capt-r': 6 } };

    const compositions: Record<UnitClass, () => BattleSimConfig> = {
      legionary: naive, // trivially itself; not asserted below, listed for completeness
      cavalry_heavy: () => ({
        label: 'cav-heavy-wedge', generalProfile: GEN,
        deployment: deploy(
          { left: makeLane('cavalry_heavy', 3), centre: makeLane('legionary', 3), right: makeLane('cavalry_heavy', 3) },
          { left: 'wedge', right: 'wedge' }, { left: 'capt-l', right: 'capt-r' },
        ),
        roster: wedgeRoster,
      }),
      cavalry_light: () => ({
        label: 'cav-light-embedded-wedge', generalProfile: GEN,
        deployment: deploy(
          { left: [...makeLane('cavalry_heavy', 2), ...makeLane('cavalry_light', 1)], centre: makeLane('legionary', 3), right: makeLane('cavalry_heavy', 3) },
          { left: 'wedge', right: 'wedge' }, { left: 'capt-l', right: 'capt-r' },
        ),
        roster: wedgeRoster,
      }),
      spear_foot: () => ({
        label: 'spear-centre-cav-wedge-flanks', generalProfile: GEN,
        deployment: deploy(
          { left: makeLane('cavalry_heavy', 3), centre: makeLane('spear_foot', 3), right: makeLane('cavalry_heavy', 3) },
          { left: 'wedge', right: 'wedge', centre: 'shield_wall' }, { left: 'capt-l', right: 'capt-r' },
        ),
        roster: wedgeRoster,
      }),
      skirmisher: () => ({
        label: 'skirm-embedded-wedge', generalProfile: GEN,
        deployment: deploy(
          { left: [...makeLane('cavalry_heavy', 2), ...makeLane('skirmisher', 1)], centre: makeLane('legionary', 3), right: makeLane('cavalry_heavy', 3) },
          { left: 'wedge', right: 'wedge' }, { left: 'capt-l', right: 'capt-r' },
        ),
        roster: wedgeRoster,
      }),
      elephant: () => ({
        label: 'elephant-flanks-legion-centre', generalProfile: GEN,
        deployment: deploy({ left: makeLane('elephant', 3), centre: makeLane('legionary', 3), right: makeLane('elephant', 3) }),
      }),
    };

    for (const cls of ['cavalry_heavy', 'cavalry_light', 'spear_foot', 'skirmisher', 'elephant'] as const) {
      const agg = simulateBattles(compositions[cls](), naive(), 150, false);
      expect(agg.unresolved).toBe(0);
      expect(agg.attackerWinRate).toBeGreaterThanOrEqual(0.55);
    }
  });

  test('AI-vs-AI (mixed armies, all 4 general profiles round-robin): crushing-outcome rate is 15-30%', () => {
    const profiles = Object.values(ENEMY_GENERALS);
    let crushingWeighted = 0;
    let resolvedTotal = 0;
    for (let i = 0; i < profiles.length; i++) {
      for (let j = 0; j < profiles.length; j++) {
        if (i === j) continue;
        const a: BattleSimConfig = { label: profiles[i].id, generalProfile: profiles[i], army: mixedArmy() };
        const b: BattleSimConfig = { label: profiles[j].id, generalProfile: profiles[j], army: mixedArmy() };
        const seedBase = (i * 100 + j) * 1000 + 1;
        const agg = simulateBattles(a, b, 20, true, undefined, seedBase);
        const resolved = 20 - agg.unresolved;
        crushingWeighted += agg.crushingRate * resolved;
        resolvedTotal += resolved;
      }
    }
    const crushingRate = crushingWeighted / resolvedTotal;
    expect(crushingRate).toBeGreaterThanOrEqual(0.15);
    expect(crushingRate).toBeLessThanOrEqual(0.30);
  }, 30000);
});
