import {
  initBattle, submitOrders, submitBreakDecision, getValidOrders, formatBattleLog,
  InvalidDeploymentError,
  type DeploySideInput,
} from '../src/engine/battle/battleEngine';
import { BALANCE } from '../src/data/balance';
import type {
  BattleUnit, UnitClass, Veterancy, Deployment, LaneAssignment, LaneId,
  TerrainMod, SideOrders, BattleState,
} from '../src/models/battle';

// ─── Test helpers ────────────────────────────────────────────────────────────

const LANES: LaneId[] = ['left', 'centre', 'right'];
const NEUTRAL_TERRAIN: TerrainMod = { id: 'coastal_plain', label: 'Coastal Plain', mods: {} };
const EMPTY_ORDERS: SideOrders = { laneOrders: {} };

let unitCounter = 0;
function makeUnit(unitClass: UnitClass, overrides: Partial<BattleUnit> = {}): BattleUnit {
  unitCounter += 1;
  return {
    id: `u${unitCounter}`,
    unitClass,
    strength: 100,
    veterancy: 'trained' as Veterancy,
    loyalty: 50,
    elephantSteady: false,
    ...overrides,
  };
}

function makeLane(unitClass: UnitClass, count: number, overrides: Partial<BattleUnit> = {}): BattleUnit[] {
  return Array.from({ length: count }, () => makeUnit(unitClass, overrides));
}

function makeDeployment(
  laneUnits: Partial<Record<LaneId, BattleUnit[]>>,
  opts: { captainId?: string | null; commanderStation?: LaneId | 'reserve'; reserve?: BattleUnit[] } = {},
): Deployment {
  const lanes = {} as Record<LaneId, LaneAssignment>;
  for (const laneId of LANES) {
    lanes[laneId] = { units: laneUnits[laneId] ?? [], captainId: opts.captainId ?? null, formation: 'line' };
  }
  return { lanes, reserve: opts.reserve ?? [], commanderStation: opts.commanderStation ?? 'reserve' };
}

function makeSide(
  label: string,
  deployment: Deployment,
  commanderId: string | null = null,
  martialById: Record<string, number> = {},
): DeploySideInput {
  return { label, deployment, commanderId, roster: { martialById } };
}

function balancedDeployment(): Deployment {
  return makeDeployment({
    left: makeLane('legionary', 3),
    centre: makeLane('legionary', 3),
    right: makeLane('legionary', 3),
  });
}

function totalStrength(units: BattleUnit[]): number {
  return units.reduce((s, u) => s + u.strength, 0);
}

function armyStrength(state: BattleState, side: 'attacker' | 'defender'): number {
  return LANES.reduce((s, l) => s + totalStrength(state[side].wings[l].units), 0)
    + totalStrength(state[side].reserve);
}

/** Runs a battle to completion using a trivial policy: keep formations as
 *  deployed, and resolve every break decision the same way. Safety-capped. */
function runFullBattle(
  attacker: DeploySideInput,
  defender: DeploySideInput,
  seed: number,
  breakPolicy: 'pursue' | 'wheel' = 'pursue',
  terrain: TerrainMod = NEUTRAL_TERRAIN,
): BattleState {
  let state = initBattle(attacker, defender, terrain, seed);
  let iterations = 0;
  while (state.phase !== 'resolved' && iterations < 60) {
    iterations += 1;
    if (state.phase === 'orders') {
      state = submitOrders(state, EMPTY_ORDERS, EMPTY_ORDERS);
    } else if (state.phase === 'break_decision') {
      const pending = state.pendingBreakDecisions[0];
      if (!pending) throw new Error('break_decision phase with no pending decisions');
      if (breakPolicy === 'wheel') {
        const target: LaneId = pending.laneId === 'centre' ? 'left' : 'centre';
        state = submitBreakDecision(state, pending.laneId, 'wheel', target);
      } else {
        state = submitBreakDecision(state, pending.laneId, 'pursue');
      }
    } else {
      throw new Error(`unexpected phase ${state.phase} outside deployment/resolved`);
    }
  }
  if (state.phase !== 'resolved') throw new Error('battle did not resolve within safety cap');
  return state;
}

// ─── initBattle validation ────────────────────────────────────────────────────

describe('initBattle validation', () => {
  test('rejects cavalry deployed to the centre lane', () => {
    const attacker = makeSide('Rome', makeDeployment({ centre: makeLane('cavalry_heavy', 2) }));
    const defender = makeSide('Carthage', balancedDeployment());
    expect(() => initBattle(attacker, defender, NEUTRAL_TERRAIN, 1)).toThrow(InvalidDeploymentError);
  });

  test('allows elephants anywhere, including the centre', () => {
    const attacker = makeSide('Rome', makeDeployment({ centre: makeLane('elephant', 1), left: makeLane('legionary', 2), right: makeLane('legionary', 2) }));
    const defender = makeSide('Carthage', balancedDeployment());
    expect(() => initBattle(attacker, defender, NEUTRAL_TERRAIN, 1)).not.toThrow();
  });

  test('an empty lane is conceded — broken from round 1 with a log entry', () => {
    const attacker = makeSide('Rome', makeDeployment({ left: makeLane('legionary', 3), right: makeLane('legionary', 3) })); // centre empty
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);
    expect(state.attacker.wings.centre.broken).toBe(true);
    expect(state.log.some(e => e.type === 'wing_break' && e.laneId === 'centre' && e.side === 'attacker' && e.round === 0)).toBe(true);
  });
});

// ─── getValidOrders ────────────────────────────────────────────────────────────

describe('getValidOrders', () => {
  test('blocks wedge and feigned_retreat on a captainless lane', () => {
    const attacker = makeSide('Rome', balancedDeployment());
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);
    const orders = getValidOrders(state, 'attacker');
    expect(orders.lanes.left.legalFormations).not.toContain('wedge');
    expect(orders.lanes.left.legalFormations).not.toContain('feigned_retreat');
    expect(orders.lanes.left.legalFormations).toEqual(expect.arrayContaining(['line', 'shield_wall', 'open_ranks']));
  });

  test('allows wedge on a captained lane, and feigned_retreat when gating passes', () => {
    const deployment = makeDeployment(
      { left: makeLane('legionary', 3, { veterancy: 'veteran' }), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { captainId: 'capt-1' },
    );
    const attacker = makeSide('Rome', deployment, null, { 'capt-1': 5 });
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);
    const orders = getValidOrders(state, 'attacker');
    expect(orders.lanes.left.legalFormations).toContain('wedge');
    expect(orders.lanes.left.legalFormations).toContain('feigned_retreat');
  });

  test('reflects reserve and withdraw availability', () => {
    const deployment = makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { reserve: makeLane('legionary', 2) },
    );
    const attacker = makeSide('Rome', deployment);
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);
    const orders = getValidOrders(state, 'attacker');
    expect(orders.reserveAvailable).toBe(true);
    expect(orders.withdrawAvailable).toBe(true);
  });
});

// ─── Full battle completion ────────────────────────────────────────────────────

describe('full battles run to completion', () => {
  test('canonical balanced armies resolve within ≤12 rounds; median recorded', () => {
    const roundsAtEnd: number[] = [];
    const trials = 60;
    for (let seed = 1; seed <= trials; seed++) {
      const attacker = makeSide('Rome', balancedDeployment());
      const defender = makeSide('Carthage', balancedDeployment());
      const state = runFullBattle(attacker, defender, seed);
      expect(state.round).toBeLessThanOrEqual(12);
      roundsAtEnd.push(state.round);
    }
    roundsAtEnd.sort((a, b) => a - b);
    const median = roundsAtEnd[Math.floor(roundsAtEnd.length / 2)];
    // M11 TUNED (verified by direct run, 60 seeds): median = 4 rounds,
    // min = max = 4 — within the plan's target band (4–7, p90 ≤ 10). The
    // pre-tuning baseline was median=10 (BALANCE.battle.morale.
    // casualtyDrainMult was 0.8); M11 raised it to 1.8 specifically because
    // invariant 4 ("morale wins battles, not annihilation") means the
    // morale-drain rate, not the raw casualty rate, is the right lever for
    // battle LENGTH — it shortens fights without making them bloodier.
    // The min=max=4 tightness (two IDENTICAL legionary-only armies, no
    // captains, so no feint/amok RNG ever fires) is UNCHANGED by that
    // tuning and was never actually a length problem — the real bug behind
    // it was in battleEngine.ts's checkRoutDefeat/submitBreakDecision: a
    // symmetric clash reliably put BOTH sides at 2-broken-wings in the same
    // round, and (a) checkRoutDefeat's iteration order made the attacker
    // lose every such tie, while (b) submitBreakDecision's pendingBreak
    // Decisions filter kept only laneId (not laneId+side), silently
    // dropping one side's break resolution whenever both sides broke the
    // same-named lane the same round. Together these made mirror battles
    // resolve defender-favor 100/100, not the ~50/50 a coin-flip mirror
    // should show — caught by M11's simulateBattles harness explicitly
    // measuring win rate (this test never had before). Fixed: simultaneous
    // double-breaks now resolve by remaining strength, tied strength falls
    // back to the round's own seeded rng; pendingBreakDecisions removal is
    // now keyed on (laneId, brokenSide). Verified via the harness at
    // n=300: attackerWinRate 50.3%/49.7%.
    expect(median).toBeGreaterThanOrEqual(4);
    expect(median).toBeLessThanOrEqual(7);
  });

  test('determinism end-to-end: same seed + same deployment objects reproduce an identical outcome and log', () => {
    // Reuse the SAME deployment/unit objects for both runs — unit ids come
    // from a module-level counter, so rebuilding "identical" deployments
    // twice would give each run different unit ids and break the
    // deep-equality check for reasons that have nothing to do with the
    // engine's determinism.
    const attacker = makeSide('Rome', balancedDeployment());
    const defender = makeSide('Carthage', balancedDeployment());
    const seed = 77;
    const state1 = runFullBattle(attacker, defender, seed);
    const state2 = runFullBattle(attacker, defender, seed);
    expect(state1.outcome).toEqual(state2.outcome);
    expect(state1.log).toEqual(state2.log);
    expect(state1.round).toBe(state2.round);
  });
});

// ─── Double envelopment (Cannae check) ─────────────────────────────────────────

describe('double envelopment (Cannae check)', () => {
  function attackerDeployment(): Deployment {
    return makeDeployment({
      left: makeLane('cavalry_heavy', 3, { veterancy: 'veteran' }),
      centre: makeLane('legionary', 3),
      right: makeLane('cavalry_heavy', 3, { veterancy: 'veteran' }),
    });
  }
  function defenderDeployment(): Deployment {
    return makeDeployment({
      left: makeLane('skirmisher', 2),
      centre: makeLane('legionary', 3),
      right: makeLane('skirmisher', 2),
    });
  }

  // Observed (verified by direct run, 100 seeds): both-wings-broken 100/100,
  // wheel exercised 100/100. The composition (veteran cavalry_heavy vs
  // 2-unit skirmisher wings) is a deliberately lopsided stat mismatch — the
  // ≥40% bar is cleared with room to spare, which is the point: the plan
  // asks for the double-envelopment *pattern* to reliably emerge, not for
  // 40% to be a nail-biter.
  test('≥40% of seeds produce both-of-defender\'s-wings broken, with the wheel mechanic exercised', () => {
    const trials = 100;
    let bothWingsBroken = 0;
    let wheelObserved = 0;
    for (let seed = 1; seed <= trials; seed++) {
      const state = runFullBattle(makeSide('Rome', attackerDeployment()), makeSide('Carthage', defenderDeployment()), seed, 'wheel');
      const leftBroken = state.defender.wings.left.broken;
      const rightBroken = state.defender.wings.right.broken;
      if (leftBroken && rightBroken) bothWingsBroken += 1;
      if (state.log.some(e => e.type === 'wheel')) wheelObserved += 1;
    }
    expect(bothWingsBroken / trials).toBeGreaterThanOrEqual(0.4);
    expect(wheelObserved / trials).toBeGreaterThanOrEqual(0.4);
  });
});

// ─── Withdrawal ────────────────────────────────────────────────────────────────

describe('withdrawal', () => {
  test('an orderly withdrawal ends the battle after one final round at warScore ∓4', () => {
    const attacker = makeSide('Rome', balancedDeployment());
    const defender = makeSide('Carthage', balancedDeployment());
    let state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 5);
    state = submitOrders(state, { laneOrders: {}, withdraw: true }, EMPTY_ORDERS);
    expect(state.phase).toBe('resolved');
    expect(state.outcome?.victor).toBe('withdrawal');
    expect(state.outcome?.tier).toBe('marginal');
    expect(state.outcome?.warScoreDelta).toBe(-BALANCE.battle.tiers.orderlyWithdrawalWarScore);
  });

  test('withdrawal is unavailable once 2 wings are already broken', () => {
    const attacker = makeSide('Rome', makeDeployment({ left: makeLane('legionary', 3), right: makeLane('legionary', 3) })); // centre conceded
    const defender = makeSide('Carthage', balancedDeployment());
    let state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);
    // Force the left wing to also break via direct state mutation is not
    // available (pure engine) — instead verify via getValidOrders after one
    // concession already counts as a broken wing, and manufacture a second
    // by using a deployment with two empty lanes instead.
    const attacker2 = makeSide('Rome', makeDeployment({ right: makeLane('legionary', 3) })); // left + centre conceded
    const state2 = initBattle(attacker2, defender, NEUTRAL_TERRAIN, 1);
    expect(getValidOrders(state2, 'attacker').withdrawAvailable).toBe(false);
  });
});

// ─── Rout cascade ──────────────────────────────────────────────────────────────

describe('rout cascade', () => {
  test('a side with exactly 1 broken wing takes automatic drain on its other wings', () => {
    // Attacker's left is conceded (broken from init); its centre faces an
    // ALSO-conceded defender lane, so clashEngine never runs there — any
    // morale change on attacker's centre this round is purely the cascade.
    const attacker = makeSide('Rome', makeDeployment({ centre: makeLane('legionary', 3), right: makeLane('legionary', 3) })); // left conceded
    const defender = makeSide('Carthage', makeDeployment({ left: makeLane('legionary', 3), right: makeLane('legionary', 3) })); // centre conceded
    let state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 3);
    const before = state.attacker.wings.centre.moralePool;
    state = submitOrders(state, EMPTY_ORDERS, EMPTY_ORDERS);
    const after = state.attacker.wings.centre.moralePool;
    const expectedDrop = Math.min(before, -BALANCE.battle.morale.routCascadeMoraleDeltaPerRound);
    expect(before - after).toBeCloseTo(expectedDrop, 5);
  });
});

// ─── Amok ──────────────────────────────────────────────────────────────────────

describe('amok', () => {
  test('a weakened elephant can go amok, dealing damage and being removed', () => {
    // Full-strength elephant paired with full-strength lane-mates (so it
    // isn't singled out as weakest-first casualty fodder and dies before
    // ever reaching an amok check) against a matched defender centre —
    // amok's per-round base chance (8% × engagedRounds) compounds over a
    // multi-round grind. Verified empirically: ~99% of seeds trigger amok
    // within 8 rounds under this composition (amok is gated to round ≥ 2).
    let found: BattleState | null = null;
    for (let seed = 1; seed <= 50 && !found; seed++) {
      const attacker = makeSide('Rome', makeDeployment({
        centre: [makeUnit('elephant', { strength: 100 }), makeUnit('legionary'), makeUnit('legionary')],
        left: makeLane('legionary', 3), right: makeLane('legionary', 3),
      }));
      const defender = makeSide('Carthage', balancedDeployment());
      let state = initBattle(attacker, defender, NEUTRAL_TERRAIN, seed);
      for (let i = 0; i < 8 && state.phase !== 'resolved'; i++) {
        state = state.phase === 'orders' ? submitOrders(state, EMPTY_ORDERS, EMPTY_ORDERS)
          : submitBreakDecision(state, state.pendingBreakDecisions[0].laneId, 'pursue');
        if (state.log.some(e => e.type === 'amok')) { found = state; break; }
      }
    }
    expect(found).not.toBeNull();
    const amokEntry = found!.log.find(e => e.type === 'amok');
    expect(amokEntry).toBeDefined();
    if (amokEntry?.type === 'amok') {
      expect(found!.attacker.wings.centre.units.some(u => u.id === amokEntry.unitId)).toBe(false);
    }
  });
});

// ─── formatBattleLog ────────────────────────────────────────────────────────────

describe('formatBattleLog', () => {
  test('produces a readable multi-line string covering the whole battle', () => {
    const state = runFullBattle(makeSide('Rome', balancedDeployment()), makeSide('Carthage', balancedDeployment()), 9);
    const formatted = formatBattleLog(state.log);
    expect(typeof formatted).toBe('string');
    expect(formatted.split('\n').length).toBeGreaterThan(0);
    expect(formatted).toContain('BATTLE END');
  });
});

// ─── warScore cap ───────────────────────────────────────────────────────────────

describe('warScore cap (invariant 5 — the Cannae rule)', () => {
  test('no single battle outcome exceeds BALANCE.war.maxSingleBattleSwing', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const state = runFullBattle(
        makeSide('Rome', attackerDeploymentForCap()),
        makeSide('Carthage', defenderDeploymentForCap()),
        seed, 'pursue',
      );
      expect(Math.abs(state.outcome!.warScoreDelta)).toBeLessThanOrEqual(BALANCE.war.maxSingleBattleSwing);
    }
  });

  function attackerDeploymentForCap(): Deployment {
    return makeDeployment({
      left: makeLane('cavalry_heavy', 3, { veterancy: 'legendary' }),
      centre: makeLane('legionary', 3, { veterancy: 'legendary' }),
      right: makeLane('cavalry_heavy', 3, { veterancy: 'legendary' }),
    });
  }
  function defenderDeploymentForCap(): Deployment {
    return makeDeployment({
      left: makeLane('skirmisher', 1, { strength: 30 }),
      centre: makeLane('skirmisher', 1, { strength: 30 }),
      right: makeLane('skirmisher', 1, { strength: 30 }),
    });
  }
});
