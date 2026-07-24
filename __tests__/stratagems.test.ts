// ─── Stratagems (M7) ─────────────────────────────────────────────────────────
// Engine-level tests for the 8-card catalog's effect application — the "small
// effect-key switch in the orchestrator" (battleEngine.ts) plus clashEngine's
// two additive hooks (Caltrops/Testudo Discipline).

import {
  initBattle, submitOrders, submitBreakDecision, getValidOrders, drawStratagemHand,
  getPlayablePreBattleStratagems, type DeploySideInput,
} from '../src/engine/battle/battleEngine';
import { resolveLaneClash, NO_CAPTAIN_MODS, type LaneClashContext } from '../src/engine/battle/clashEngine';
import { makeSeededRng } from '../src/utils/seededRng';
import { BALANCE } from '../src/data/balance';
import { STRATAGEM_LIST } from '../src/data/stratagems';
import type {
  BattleUnit, UnitClass, Veterancy, Deployment, LaneAssignment, LaneId,
  TerrainMod, BattleState, SideState, WingState,
} from '../src/models/battle';

// ─── Test helpers (mirrors battleEngine.test.ts / musterEngine.test.ts) ─────

const LANES: LaneId[] = ['left', 'centre', 'right'];
const NEUTRAL_TERRAIN: TerrainMod = { id: 'coastal_plain', label: 'Coastal Plain', mods: {} };
const ROUGH_HILLS: TerrainMod = BALANCE.battle.terrains.rough_hills;

let unitCounter = 0;
function makeUnit(unitClass: UnitClass, overrides: Partial<BattleUnit> = {}): BattleUnit {
  unitCounter += 1;
  return { id: `u${unitCounter}`, unitClass, strength: 100, veterancy: 'trained' as Veterancy, loyalty: 50, elephantSteady: false, ...overrides };
}
function makeLane(unitClass: UnitClass, count: number, overrides: Partial<BattleUnit> = {}): BattleUnit[] {
  return Array.from({ length: count }, () => makeUnit(unitClass, overrides));
}
function makeDeployment(
  laneUnits: Partial<Record<LaneId, BattleUnit[]>>,
  opts: { captainId?: string | null; commanderStation?: LaneId | 'reserve'; reserve?: BattleUnit[]; preBattleStratagems?: Deployment['preBattleStratagems'] } = {},
): Deployment {
  const lanes = {} as Record<LaneId, LaneAssignment>;
  for (const laneId of LANES) {
    lanes[laneId] = { units: laneUnits[laneId] ?? [], captainId: opts.captainId ?? null, formation: 'line' };
  }
  return {
    lanes, reserve: opts.reserve ?? [], commanderStation: opts.commanderStation ?? 'reserve',
    preBattleStratagems: opts.preBattleStratagems,
  };
}
function makeSide(label: string, deployment: Deployment, opts: { commanderId?: string | null; martialById?: Record<string, number>; stratagemHand?: string[] } = {}): DeploySideInput {
  return {
    label, deployment, commanderId: opts.commanderId ?? null,
    roster: { martialById: opts.martialById ?? {} }, stratagemHand: opts.stratagemHand,
  };
}
function balancedDeployment(): Deployment {
  return makeDeployment({ left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) });
}

// ─── Pre-battle: Ambuscade ──────────────────────────────────────────────────

describe('Ambuscade', () => {
  test('drops the targeted enemy lane morale, terrain-gated', () => {
    const attackerNoCard = makeSide('Rome', balancedDeployment());
    const defender = makeSide('Carthage', balancedDeployment());
    const baseline = initBattle(attackerNoCard, defender, ROUGH_HILLS, 1);

    const attackerWithCard = makeSide('Rome', makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { preBattleStratagems: [{ stratagemId: 'ambuscade', laneId: 'centre' }] },
    ), { stratagemHand: ['ambuscade'] });
    const withAmbuscade = initBattle(attackerWithCard, defender, ROUGH_HILLS, 1);

    expect(withAmbuscade.defender.wings.centre.moralePool)
      .toBeLessThanOrEqual(baseline.defender.wings.centre.moralePool + BALANCE.battle.stratagems.ambuscadeMoraleDelta + 0.01);
    expect(withAmbuscade.attacker.stratagemsPlayed).toContain('ambuscade');
    expect(withAmbuscade.attacker.stratagemHand).not.toContain('ambuscade');
  });

  test('does nothing on terrain that does not permit it', () => {
    const defender = makeSide('Carthage', balancedDeployment());
    const attackerNoCard = makeSide('Rome', balancedDeployment());
    const baseline = initBattle(attackerNoCard, defender, NEUTRAL_TERRAIN, 1);

    const attackerWithCard = makeSide('Rome', makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { preBattleStratagems: [{ stratagemId: 'ambuscade', laneId: 'centre' }] },
    ), { stratagemHand: ['ambuscade'] });
    const attempted = initBattle(attackerWithCard, defender, NEUTRAL_TERRAIN, 1);

    expect(attempted.defender.wings.centre.moralePool).toBeCloseTo(baseline.defender.wings.centre.moralePool, 5);
    expect(attempted.attacker.stratagemsPlayed).not.toContain('ambuscade');
    expect(attempted.attacker.stratagemHand).toContain('ambuscade');
  });
});

// ─── Pre-battle: Officer's Oath ─────────────────────────────────────────────

describe("Officer's Oath", () => {
  test('overrides the targeted own lane\'s unit loyalty before the morale seed is computed', () => {
    const attacker = makeSide('Rome', makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3, { loyalty: 10 }), right: makeLane('legionary', 3) },
      { preBattleStratagems: [{ stratagemId: 'officers_oath', laneId: 'centre' }] },
    ), { stratagemHand: ['officers_oath'] });
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);

    expect(state.attacker.wings.centre.units.every(u => u.loyalty === BALANCE.battle.stratagems.officersOathLoyalty)).toBe(true);
    expect(state.attacker.wings.left.units.every(u => u.loyalty === 50)).toBe(true);
  });
});

// ─── Pre-battle: Forced March ───────────────────────────────────────────────

describe('Forced March', () => {
  test('locks the enemy reserve until the configured round', () => {
    const attacker = makeSide('Rome', makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { preBattleStratagems: [{ stratagemId: 'forced_march' }] },
    ), { stratagemHand: ['forced_march'] });
    const defender = makeSide('Carthage', balancedDeployment(), { });
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);

    expect(state.defender.reserveLockedUntilRound).toBe(BALANCE.battle.stratagems.forcedMarchLockUntilRound);

    const withReserve: BattleState = { ...state, defender: { ...state.defender, reserve: [makeUnit('legionary')] } };
    expect(getValidOrders({ ...withReserve, round: 1 }, 'defender').reserveAvailable).toBe(false);
    expect(getValidOrders({ ...withReserve, round: BALANCE.battle.stratagems.forcedMarchLockUntilRound }, 'defender').reserveAvailable).toBe(true);
  });
});

// ─── Pre-battle: Fire Arrows ────────────────────────────────────────────────

describe('Fire Arrows', () => {
  test('adds to the ENEMY elephant amok-chance rider, not the caster\'s own', () => {
    const attacker = makeSide('Rome', makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { preBattleStratagems: [{ stratagemId: 'fire_arrows' }] },
    ), { stratagemHand: ['fire_arrows'] });
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);

    expect(state.defender.incomingElephantAmokRiderPct).toBe(BALANCE.battle.stratagems.fireArrowsAmokChanceDelta);
    expect(state.attacker.incomingElephantAmokRiderPct ?? 0).toBe(0);
  });
});

// ─── Pre-battle: Double Envelopment Doctrine ────────────────────────────────

describe('Double Envelopment Doctrine', () => {
  test('is recorded on the caster\'s own side and scales the wheel flank-charge morale hit', () => {
    const attacker = makeSide('Rome', makeDeployment(
      { left: makeLane('legionary', 3), centre: makeLane('legionary', 3), right: makeLane('legionary', 3) },
      { preBattleStratagems: [{ stratagemId: 'double_envelopment_doctrine' }] },
    ), { stratagemHand: ['double_envelopment_doctrine'] });
    const defender = makeSide('Carthage', balancedDeployment());
    const state = initBattle(attacker, defender, NEUTRAL_TERRAIN, 1);
    expect(state.attacker.wheelBonusMult).toBe(BALANCE.battle.stratagems.doubleEnvelopmentWheelBonusMult);

    function wheelAndReadTargetMorale(wheelBonusMult: number | undefined): number {
      const battleState = fabricateBreakDecisionState(wheelBonusMult);
      const result = submitBreakDecision(battleState, 'centre', 'wheel', 'left');
      return result.defender.wings.left.moralePool;
    }

    const baselineMorale = wheelAndReadTargetMorale(undefined);
    const boostedMorale = wheelAndReadTargetMorale(BALANCE.battle.stratagems.doubleEnvelopmentWheelBonusMult);
    // A bigger flank bonus means a LOWER resulting morale for the flanked wing.
    expect(boostedMorale).toBeLessThan(baselineMorale);
  });
});

// ─── Reactive: Rally the Standards ──────────────────────────────────────────

describe('Rally the Standards', () => {
  test('re-forms a broken own wing at the configured morale, then cannot fire again', () => {
    const state = fabricateOrdersPhaseStateWithBrokenLane();
    expect(state.attacker.wings.left.broken).toBe(true);

    const afterRally = submitOrders(
      state,
      { laneOrders: {}, stratagemId: 'rally_the_standards', stratagemLaneId: 'left' },
      { laneOrders: {} },
    );
    expect(afterRally.attacker.wings.left.broken).toBe(false);
    expect(afterRally.attacker.wings.left.moralePool).toBe(BALANCE.battle.stratagems.rallyMorale);
    expect(afterRally.attacker.stratagemsPlayed).toContain('rally_the_standards');
    expect(afterRally.attacker.stratagemHand).not.toContain('rally_the_standards');
    expect(afterRally.log.some(e => e.type === 'stratagem_played' && e.stratagemId === 'rally_the_standards')).toBe(true);

    // Break it again and confirm a second Rally attempt (no longer in hand) does nothing.
    const rebroken: BattleState = { ...afterRally, attacker: { ...afterRally.attacker, wings: { ...afterRally.attacker.wings, left: { ...afterRally.attacker.wings.left, broken: true } } } };
    const secondAttempt = submitOrders(
      rebroken,
      { laneOrders: {}, stratagemId: 'rally_the_standards', stratagemLaneId: 'left' },
      { laneOrders: {} },
    );
    expect(secondAttempt.attacker.wings.left.broken).toBe(true);
  });
});

// ─── clashEngine hooks: Caltrops / Testudo Discipline ───────────────────────

describe('Caltrops (clashEngine incomingCavalryShockMult hook)', () => {
  test('reduces incoming shock damage/morale drain from a cavalry charge onto the protected lane', () => {
    function run(incomingCavalryShockMultA?: number) {
      const laneA = makeLane('legionary', 3);
      const laneB = makeLane('cavalry_heavy', 3);
      const ctx: LaneClashContext = {
        terrain: NEUTRAL_TERRAIN, rng: makeSeededRng(7),
        sideAMods: NO_CAPTAIN_MODS, sideBMods: NO_CAPTAIN_MODS, attackerSide: 'B',
        engagedRoundsA: 0, engagedRoundsB: 0, formationA: 'line', formationB: 'line',
        flankedA: false, flankedB: false, overextendedA: false, overextendedB: false,
        incomingCavalryShockMultA,
      };
      return resolveLaneClash(laneA, laneB, ctx);
    }
    const baseline = run(undefined);
    const withCaltrops = run(BALANCE.battle.stratagems.caltropsCavalryShockMult);
    // Less shock landing on A means a smaller morale hit (less negative delta).
    expect(withCaltrops.moraleDeltaA).toBeGreaterThan(baseline.moraleDeltaA);
  });
});

describe('Testudo Discipline (clashEngine preludeMult hook)', () => {
  test('nullifies the prelude amok-chance rider onto the protected lane', () => {
    function run(preludeMultA?: number) {
      const elephant = makeUnit('elephant', { strength: 100 });
      const laneA = [elephant];
      const laneB = makeLane('skirmisher', 2);
      const ctx: LaneClashContext = {
        terrain: NEUTRAL_TERRAIN, rng: makeSeededRng(3),
        sideAMods: NO_CAPTAIN_MODS, sideBMods: NO_CAPTAIN_MODS, attackerSide: 'A',
        engagedRoundsA: 0, engagedRoundsB: 0, formationA: 'line', formationB: 'line',
        flankedA: false, flankedB: false, overextendedA: false, overextendedB: false,
        preludeMultA,
      };
      return { elephant, result: resolveLaneClash(laneA, laneB, ctx) };
    }
    const baseline = run(undefined);
    expect(baseline.result.amokChanceRiders.get(baseline.elephant.id)).toBeCloseTo(BALANCE.battle.elephant.skirmisherPreludeAmokChanceDelta, 5);

    const withTestudo = run(BALANCE.battle.stratagems.testudoPreludeMult);
    expect(withTestudo.result.amokChanceRiders.get(withTestudo.elephant.id) ?? 0).toBe(0);
  });
});

// ─── drawStratagemHand / getPlayablePreBattleStratagems ─────────────────────

describe('drawStratagemHand', () => {
  test('hand size follows 1 + floor(martial/4), capped at the full catalog size', () => {
    const rng = makeSeededRng(11);
    const army = makeLane('legionary', 5);
    const hand = drawStratagemHand(8, army, NEUTRAL_TERRAIN, rng);
    expect(hand.length).toBe(Math.min(STRATAGEM_LIST.length, 1 + Math.floor(8 / 4)));
    expect(new Set(hand).size).toBe(hand.length); // no duplicates
  });

  test('never draws Ambuscade on terrain that forbids it', () => {
    const rng = makeSeededRng(99);
    const army = makeLane('legionary', 5);
    for (let i = 0; i < 20; i++) {
      const hand = drawStratagemHand(10, army, NEUTRAL_TERRAIN, makeSeededRng(i));
      expect(hand).not.toContain('ambuscade');
    }
  });
});

describe('getPlayablePreBattleStratagems', () => {
  test('filters out reactive-timing cards and terrain-gated cards that do not match', () => {
    const playable = getPlayablePreBattleStratagems(['rally_the_standards', 'ambuscade', 'caltrops'], NEUTRAL_TERRAIN);
    const ids = playable.map(d => d.id);
    expect(ids).not.toContain('rally_the_standards');
    expect(ids).not.toContain('ambuscade');
    expect(ids).toContain('caltrops');
  });
});

// ─── Fabrication helpers for direct BattleState-level tests ─────────────────

function makeWing(laneId: LaneId, overrides: Partial<WingState> = {}): WingState {
  return { laneId, units: [], captainId: null, formation: 'line', moralePool: 60, broken: false, engagedRounds: 3, flanked: false, overextended: false, ...overrides };
}
function makeSideState(overrides: Partial<SideState> = {}): SideState {
  return {
    label: 'Rome', wings: { left: makeWing('left'), centre: makeWing('centre'), right: makeWing('right') },
    reserve: [], commanderId: null, commanderStation: 'reserve', captainMartialById: {},
    ...overrides,
  };
}
function makeFabricatedBattleState(overrides: { attacker?: Partial<SideState>; defender?: Partial<SideState> } = {}): BattleState {
  return {
    seed: 1, round: 6, terrain: NEUTRAL_TERRAIN,
    attacker: makeSideState(overrides.attacker),
    defender: makeSideState({ label: 'Carthage', ...overrides.defender }),
    log: [], phase: 'break_decision', rngCallsConsumed: 0,
    pendingBreakDecisions: [{ laneId: 'centre', brokenSide: 'defender' }],
    amokChanceRiders: {}, startingStrength: { attacker: 300, defender: 300 },
  };
}

function fabricateBreakDecisionState(attackerWheelBonusMult: number | undefined): BattleState {
  return makeFabricatedBattleState({
    attacker: {
      wheelBonusMult: attackerWheelBonusMult,
      wings: { left: makeWing('left', { moralePool: 60 }), centre: makeWing('centre', { units: [makeUnit('legionary')] }), right: makeWing('right', { moralePool: 60 }) },
    },
    defender: {
      wings: { left: makeWing('left', { moralePool: 50 }), centre: makeWing('centre', { broken: true, units: [] }), right: makeWing('right', { moralePool: 60 }) },
    },
  });
}

function fabricateOrdersPhaseStateWithBrokenLane(): BattleState {
  const state = makeFabricatedBattleState({
    attacker: {
      commanderStation: 'left',
      stratagemHand: ['rally_the_standards'],
      stratagemsPlayed: [],
      wings: {
        left: makeWing('left', { broken: true, units: [makeUnit('legionary')], moralePool: 0 }),
        centre: makeWing('centre', { moralePool: 60, units: makeLane('legionary', 2) }),
        right: makeWing('right', { moralePool: 60, units: makeLane('legionary', 2) }),
      },
    },
  });
  return { ...state, phase: 'orders', pendingBreakDecisions: [] };
}
