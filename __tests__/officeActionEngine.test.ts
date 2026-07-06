import { evaluateGates, evaluateTribuneScaling } from '../src/engine/officeActionEngine';
import type { OfficeAction } from '../src/models/office';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeCrisisTrack(id: string, level: number) {
  const tier =
    level < 20 ? 0 :
    level < 40 ? 1 :
    level < 60 ? 2 :
    level < 80 ? 3 : 4;
  return { id, level, tier, namedCrisis: null } as const;
}

const CRISIS_ALL_ZERO = {
  war:          makeCrisisTrack('war',          0),
  unrest:       makeCrisisTrack('unrest',       0),
  constitution: makeCrisisTrack('constitution', 0),
  economy:      makeCrisisTrack('economy',      0),
};

/** Build a minimal character for gate evaluation. */
function makeCharacter(overrides: Record<string, any> = {}) {
  return {
    id: 'pc-1',
    name: 'Marcus',
    role: 'paterfamilias',
    isPlayer: true,
    age: 42,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [],
    ambition: null,
    relationship: 100,
    familyTrust: 100,
    officeId: null,
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: [],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
    ...overrides,
  };
}

/** Build a minimal game state. */
function makeState(overrides: Record<string, any> = {}) {
  return {
    year: -264,
    turnNumber: 1,
    seasonIndex: 0,
    fides: 40,
    denarii: 200,
    imperium: 0,
    lifetimeDignitas: 0,
    popularesRel: 0,
    optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0,
    crisis: CRISIS_ALL_ZERO,
    flags: {},
    family: [makeCharacter()],
    bills: [],
    clans: [],
    clients: [],
    ownedAssets: [],
    provinces: [],
    pendingEvents: [],
    tribuneHolder: null,
    npcConsul: null,
    ...overrides,
  };
}

/** Build a minimal new-style OfficeAction. */
function makeAction(overrides: Partial<OfficeAction> = {}): OfficeAction {
  return {
    id: 'test-action',
    name: 'Test Action',
    cost: 'Free',
    costVal: 0,
    resource: null,
    desc: 'A test action',
    successEffect: 'fides+5',
    ...overrides,
  } as OfficeAction;
}

// ─── evaluateGates — AND gates ────────────────────────────────────────────────

describe('evaluateGates — AND gate (gate[])', () => {
  test('allowed when no gates defined', () => {
    const action = makeAction();
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });

  test('blocked when skill gate fails', () => {
    // Character has rhetoric 6, gate requires >= 7
    const action = makeAction({
      gate: [{ type: 'skill', key: 'rhetoric', op: 'gte', value: 7 }],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toMatch(/rhetoric/i);
  });

  test('allowed when skill gate passes', () => {
    // Character has rhetoric 6, gate requires >= 5
    const action = makeAction({
      gate: [{ type: 'skill', key: 'rhetoric', op: 'gte', value: 5 }],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });

  test('blocked on first failing AND gate (short-circuit)', () => {
    // rhetoric 6 >= 5 passes, but intrigus 5 >= 8 fails
    const action = makeAction({
      gate: [
        { type: 'skill', key: 'rhetoric', op: 'gte', value: 5 },
        { type: 'skill', key: 'intrigus', op: 'gte', value: 8 },
      ],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toMatch(/intrigus/i);
  });

  test('blocked when resource gate fails (rome.plebs)', () => {
    // state.rome.plebs = 60, gate requires >= 80
    const action = makeAction({
      gate: [{ type: 'resource', key: 'rome.plebs', op: 'gte', value: 80 }],
    });
    const state = makeState({ rome: { stability: 50, plebs: 60, treasury: 50 } });
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
  });

  test('allowed when resource gate passes (rome.plebs)', () => {
    const action = makeAction({
      gate: [{ type: 'resource', key: 'rome.plebs', op: 'gte', value: 50 }],
    });
    const state = makeState({ rome: { stability: 50, plebs: 60, treasury: 50 } });
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });

  test('blocked when flag gate requires true but flag is unset', () => {
    const action = makeAction({
      gate: [{ type: 'flag', key: 'activeCampaignExists', op: 'eq', value: true }],
    });
    const state = makeState({ flags: {} });
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
  });

  test('allowed when flag gate matches', () => {
    const action = makeAction({
      gate: [{ type: 'flag', key: 'activeCampaignExists', op: 'eq', value: true }],
    });
    const state = makeState({ flags: { activeCampaignExists: true } });
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });

  test('blocked when flag gate requires false and flag is true (used-this-term guard)', () => {
    const action = makeAction({
      gate: [{ type: 'flag', key: 'consultatumUsedThisTerm', op: 'eq', value: false }],
    });
    const state = makeState({ flags: { consultatumUsedThisTerm: true } });
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
  });

  test('returns blocked with reason when character not found', () => {
    const action = makeAction();
    const state = makeState();
    const result = evaluateGates(action, 'nonexistent-id', state as any);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toMatch(/not found/i);
  });
});

// ─── evaluateGates — OR gates ─────────────────────────────────────────────────

describe('evaluateGates — OR gate (gateAny[])', () => {
  test('allowed when first OR gate passes', () => {
    // rhetoric 6 >= 6 passes → allowed even though intrigus 5 < 8 fails
    const action = makeAction({
      gateAny: [
        { type: 'skill', key: 'rhetoric', op: 'gte', value: 6 },
        { type: 'skill', key: 'intrigus', op: 'gte', value: 8 },
      ],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });

  test('allowed when second OR gate passes (first fails)', () => {
    // rhetoric 6 < 8 fails, intrigus 5 >= 5 passes
    const action = makeAction({
      gateAny: [
        { type: 'skill', key: 'rhetoric', op: 'gte', value: 8 },
        { type: 'skill', key: 'intrigus', op: 'gte', value: 5 },
      ],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });

  test('blocked when all OR gates fail', () => {
    // rhetoric 6 < 8 fails, intrigus 5 < 7 fails
    const action = makeAction({
      gateAny: [
        { type: 'skill', key: 'rhetoric', op: 'gte', value: 8 },
        { type: 'skill', key: 'intrigus', op: 'gte', value: 7 },
      ],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toMatch(/at least one/i);
  });

  test('AND gates checked before OR gates', () => {
    // AND gate fails (martial 4 < 8) even though OR gate would pass
    const action = makeAction({
      gate: [{ type: 'skill', key: 'martial', op: 'gte', value: 8 }],
      gateAny: [{ type: 'skill', key: 'rhetoric', op: 'gte', value: 5 }],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(false);
    expect(result.blockedReason).toMatch(/martial/i);
  });

  test('both AND and OR pass → allowed', () => {
    const action = makeAction({
      gate: [{ type: 'skill', key: 'rhetoric', op: 'gte', value: 5 }],
      gateAny: [{ type: 'skill', key: 'intrigus', op: 'gte', value: 5 }],
    });
    const state = makeState();
    const result = evaluateGates(action, 'pc-1', state as any);
    expect(result.allowed).toBe(true);
  });
});

// ─── evaluateTribuneScaling ───────────────────────────────────────────────────

describe('evaluateTribuneScaling', () => {
  function makeScalingState(plebs: number, unrestLevel = 0) {
    return makeState({
      rome: { stability: 50, plebs, treasury: 50 },
      crisis: {
        war:          makeCrisisTrack('war', 0),
        unrest:       makeCrisisTrack('unrest', unrestLevel),
        constitution: makeCrisisTrack('constitution', 0),
        economy:      makeCrisisTrack('economy', 0),
      },
    });
  }

  test('Plebs < 30 → ×0.6 multiplier', () => {
    const state = makeScalingState(20);
    expect(evaluateTribuneScaling(100, state as any)).toBe(60);
  });

  test('Plebs 30–49 → ×0.85 multiplier', () => {
    const state = makeScalingState(40);
    expect(evaluateTribuneScaling(100, state as any)).toBe(85);
  });

  test('Plebs 50–69 → ×1.0 multiplier (baseline)', () => {
    const state = makeScalingState(60);
    expect(evaluateTribuneScaling(100, state as any)).toBe(100);
  });

  test('Plebs 70–84 → ×1.2 multiplier', () => {
    const state = makeScalingState(75);
    expect(evaluateTribuneScaling(100, state as any)).toBe(120);
  });

  test('Plebs ≥ 85 → ×1.4 multiplier', () => {
    const state = makeScalingState(90);
    expect(evaluateTribuneScaling(100, state as any)).toBe(140);
  });

  test('Unrest tier 2 (level 50–74) adds +0.2 bonus', () => {
    // Plebs 60 → ×1.0 base, unrest tier 2 → +0.2 → ×1.2 total
    const state = makeScalingState(60, 55);
    expect(evaluateTribuneScaling(100, state as any)).toBe(120);
  });

  test('Unrest tier 3+ (level ≥ 75) adds +0.4 bonus', () => {
    // Plebs 60 → ×1.0 base, unrest tier 3 → +0.4 → ×1.4 total
    const state = makeScalingState(60, 80);
    expect(evaluateTribuneScaling(100, state as any)).toBe(140);
  });

  test('rounding — fractional results are rounded to nearest integer', () => {
    // Plebs 40 → ×0.85, base 10 → 8.5 → rounds to 9
    const state = makeScalingState(40);
    expect(evaluateTribuneScaling(10, state as any)).toBe(9);
  });
});
