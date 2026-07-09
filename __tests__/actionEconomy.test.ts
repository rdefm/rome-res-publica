// endSeason() autosaves via saveLoad.ts -> AsyncStorage; not mocked by default
// for this project's jest-expo preset in a plain unit test context.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';

// ─── P2-E — Action economy: meaningful-action counter (E1) ──────────────────
// actionsThisSeason increments on the plan's counted-action set (E1) and not
// on navigation/UI/forced-event/EndSeason/birth-naming actions. Sampled here,
// not exhaustive over all ~32 instrumented actions (see gameStore.ts's
// bumpActions() call sites for the full list).

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    family: [{
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
      skills: { rhetoric: 6, martial: 3, intrigus: 4 }, traits: [], ambition: null,
      relationship: 100, familyTrust: 100, officeId: null, corruptionScore: 0,
      inheritedTraits: [], ambitionIds: [], reputationScores: {},
      formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    }] as any,
    fides: 1000,
    denarii: 1000,
    patronTier: 3,
    trainedThisSeason: [],
    actionsThisSeason: 0,
    munificenceUsage: {},
    log: [],
    ...overrides,
  } as any);
}

describe('actionsThisSeason — counted actions', () => {
  beforeEach(() => resetStore());

  test('trainCharacter increments by 1', () => {
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    expect(useGameStore.getState().actionsThisSeason).toBe(1);
  });

  test('commissionLaudatio increments by 1', () => {
    useGameStore.getState().commissionLaudatio();
    expect(useGameStore.getState().actionsThisSeason).toBe(1);
  });

  test('submitBill increments by 1', () => {
    useGameStore.getState().submitBill({
      name: 'Test Bill', type: 'standard', support: 0, turnsLeft: 3,
    } as any);
    expect(useGameStore.getState().actionsThisSeason).toBe(1);
  });

  test('performMunificence (Public Feast) increments by 1', () => {
    useGameStore.getState().performMunificence('public-feast');
    expect(useGameStore.getState().actionsThisSeason).toBe(1);
  });

  test('purchaseAsset increments by 1', () => {
    const { getDefinition } = require('../src/engine/assetEngine');
    const anyDef = require('../src/data/assetDefinitions').ASSET_DEFINITIONS[0];
    useGameStore.getState().purchaseAsset(anyDef.id);
    expect(useGameStore.getState().actionsThisSeason).toBe(1);
  });

  test('multiple counted actions in a season accumulate', () => {
    useGameStore.getState().commissionLaudatio();
    useGameStore.getState().performAdrogatio();
    useGameStore.getState().arrangeMarriageDomus();
    expect(useGameStore.getState().actionsThisSeason).toBe(3);
  });

  test('a blocked/no-op action (unaffordable) does not increment', () => {
    resetStore({ fides: 0, denarii: 0 } as any);
    useGameStore.getState().commissionLaudatio(); // costs 10 Fides, has 0
    expect(useGameStore.getState().actionsThisSeason).toBe(0);
  });
});

describe('fidesSpentThisSeason / denariiSpentThisSeason (P2-A counters, wired in P2-E)', () => {
  beforeEach(() => resetStore());

  test('a Fides-costing action tracks gross spend, not net change', () => {
    // Public Feast costs 40 Denarii and grants +2 Fides — net Fides change is
    // positive, but nothing was "spent" in Fides; Denarii spend should be tracked.
    useGameStore.getState().performMunificence('public-feast');
    const after = useGameStore.getState();
    expect(after.denariiSpentThisSeason).toBe(40);
    expect(after.fidesSpentThisSeason).toBe(0);
  });

  test('commissionLaudatio tracks exactly its Fides cost', () => {
    useGameStore.getState().commissionLaudatio();
    expect(useGameStore.getState().fidesSpentThisSeason).toBe(10);
  });

  test('spend accumulates across multiple actions in a season', () => {
    useGameStore.getState().performAdrogatio(); // 50 Denarii
    useGameStore.getState().arrangeMarriageDomus(); // 15 Fides
    const after = useGameStore.getState();
    expect(after.denariiSpentThisSeason).toBe(50);
    expect(after.fidesSpentThisSeason).toBe(15);
  });
});

describe('actionsThisSeason — excluded actions', () => {
  beforeEach(() => resetStore());

  test('navigation/UI actions do not increment', () => {
    useGameStore.getState().selectCharacter('pc-1');
    useGameStore.getState().requestNavigation({ tab: 'Curia' });
    expect(useGameStore.getState().actionsThisSeason).toBe(0);
  });

  test('confirmBirthNaming does not increment', () => {
    resetStore({
      pendingBirthNaming: {
        suggestedName: 'Gaia', role: 'daughter', inheritedTraits: [],
        baseSkills: { rhetoric: 1, martial: 1, intrigus: 1 },
      },
    } as any);
    useGameStore.getState().confirmBirthNaming('Gaia');
    expect(useGameStore.getState().actionsThisSeason).toBe(0);
  });
});

describe('seasonStatsHistory ring buffer', () => {
  test('caps at 40 entries, dropping the oldest', () => {
    const fortyDummyEntries = Array.from({ length: 40 }, (_, i) => ({
      turnNumber: i, durationSec: 10, meaningfulActions: 1,
      fidesIncome: 5, fidesSpent: 0, denariiIncome: 5, denariiSpent: 0,
      patronTierAtEnd: 0,
    }));
    resetStore({ seasonStatsHistory: fortyDummyEntries, turnNumber: 40 } as any);

    useGameStore.getState().endSeason();
    const history = useGameStore.getState().seasonStatsHistory;

    expect(history.length).toBe(40);
    expect(history[0].turnNumber).toBe(1); // oldest (turnNumber 0) dropped
    expect(history[39].turnNumber).toBe(40); // the just-completed season appended
  });

  test('the newly-appended entry snapshots patronTierAtEnd from post-season state', () => {
    // patronTier is recomputed from lifetimeDignitas at season end (P2-B) — set
    // both so the recompute lands on tier 3, not just the pre-season patronTier field.
    resetStore({ patronTier: 3, lifetimeDignitas: 180, seasonStatsHistory: [] } as any);
    useGameStore.getState().endSeason();
    const history = useGameStore.getState().seasonStatsHistory;
    expect(history[history.length - 1].patronTierAtEnd).toBe(3);
  });
});
