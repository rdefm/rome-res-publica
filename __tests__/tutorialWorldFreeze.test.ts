// Tutorial redesign, Chunk T4 — integration coverage for isWorldFrozen's
// effect on processSeason. Unit coverage for isWorldFrozen itself lives in
// tutorialEngine.test.ts; this file drives the real season pipeline.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';

const FROZEN: GameState['tutorial'] = {
  activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false,
  replayingArc: null, replayStepId: null,
};
const UNFROZEN: GameState['tutorial'] = {
  activeArc: null, stepId: null, completedArcs: ['prologue'], unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'], skipped: false,
  replayingArc: null, replayStepId: null,
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_STATE, gameStarted: true, ...overrides };
}

describe('world freeze — crisis escalation', () => {
  test('frozen: crisis is bit-for-bit unchanged across a season, even under pressure that would otherwise escalate it', () => {
    const state = makeState({
      tutorial: FROZEN,
      rome: { stability: 10, plebs: 10, treasury: 5 }, // deliberately bad — would drift crisis if not frozen
    });
    const { nextState } = processSeason(state);
    expect(nextState.crisis).toEqual(state.crisis);
  });

  test('not frozen: the same pressure DOES move at least one crisis track (regression guard — the freeze gate did not disable escalation outright)', () => {
    const state = makeState({
      tutorial: UNFROZEN,
      rome: { stability: 10, plebs: 10, treasury: 5 },
    });
    const { nextState } = processSeason(state);
    const changed =
      nextState.crisis.war.level !== state.crisis.war.level ||
      nextState.crisis.unrest.level !== state.crisis.unrest.level ||
      nextState.crisis.constitution.level !== state.crisis.constitution.level ||
      nextState.crisis.economy.level !== state.crisis.economy.level;
    expect(changed).toBe(true);
  });
});

describe('world freeze — bill resolution', () => {
  function makeBill(overrides: Partial<GameState['bills'][number]> = {}): GameState['bills'][number] {
    return {
      id: 'test-bill-1', name: 'Test Bill', type: 'optimates', support: 999, turnsLeft: 3,
      passEffect: 'fides+1', failEffect: '', ...overrides,
    } as any;
  }

  test('frozen: an overwhelmingly-supported bill neither passes nor fails — bills array is untouched', () => {
    const state = makeState({
      tutorial: FROZEN,
      bills: [makeBill()],
      rome: { stability: 60, plebs: 60, treasury: 50 }, // avoid the senate-suspension roll's precondition
    });
    const { nextState } = processSeason(state);
    expect(nextState.bills).toEqual(state.bills);
    expect(nextState.passedBills ?? []).toEqual(state.passedBills ?? []);
  });

  test('not frozen: the same overwhelmingly-supported bill passes (regression guard)', () => {
    const state = makeState({
      tutorial: UNFROZEN,
      bills: [makeBill()],
      rome: { stability: 60, plebs: 60, treasury: 50 },
    });
    const { nextState } = processSeason(state);
    expect(nextState.bills.some(b => b.id === 'test-bill-1')).toBe(false);
    expect((nextState.passedBills ?? []).some(b => b.id === 'test-bill-1')).toBe(true);
  });

  test('frozen: auto-inject top-up does not add bills even when the queue is empty', () => {
    const state = makeState({ tutorial: FROZEN, bills: [] });
    const { nextState } = processSeason(state);
    expect(nextState.bills).toEqual([]);
  });
});

describe('world freeze — births and mortality', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });

  test('frozen: a guaranteed-birth roll does not produce a pending birth', () => {
    Math.random = () => 0; // forces every probability check to succeed if not gated
    const state = makeState({ tutorial: FROZEN });
    const { nextState } = processSeason(state);
    expect(nextState.pendingBirthNaming).toBeNull();
  });

  test('not frozen: the same guaranteed-birth roll produces a pending birth (regression guard)', () => {
    Math.random = () => 0;
    const state = makeState({ tutorial: UNFROZEN });
    const { nextState } = processSeason(state);
    expect(nextState.pendingBirthNaming).not.toBeNull();
  });

  test('frozen: a guaranteed-death roll at the yearly rollover does not kill anyone', () => {
    Math.random = () => 0;
    const state = makeState({ tutorial: FROZEN, seasonIndex: 3 }); // Winter -> crossedNewYear
    const startingCount = state.family.length;
    const { nextState } = processSeason(state);
    expect(nextState.family.length).toBe(startingCount);
    expect(nextState.pendingSuccession).toBeNull();
  });
});

describe('world freeze — the Claudius arc', () => {
  test('frozen: an in-flight patience countdown does not tick down', () => {
    const state = makeState({ tutorial: FROZEN, claudiusPatience: 2 });
    const { nextState } = processSeason(state);
    expect(nextState.claudiusPatience).toBe(2);
  });
});

// World gate rework, ticket 01 — these two categories previously had no
// processSeason-level coverage in this file (only tutorialEngine.test.ts's
// unit test on the boolean itself, and cityEngine.test.ts's direct
// tickAllCities param test). Covering them here closes the gap at the same
// integration level as every other category above.
describe('world freeze — random events and war ignition', () => {
  test('frozen: no story event is injected, even when the Messana/Carthage ignition conditions are otherwise met', () => {
    const state = makeState({
      tutorial: FROZEN,
      startId: 'guided',
      flags: { 'tutorial-embassy-complete': true }, // ignition-eligible if not frozen
      wars: [],
    });
    const { nextState } = processSeason(state);
    expect(nextState.pendingEvents).toEqual(state.pendingEvents);
  });

  test('not frozen: the same ignition-eligible state forces evt-messana-appeal (regression guard)', () => {
    const state = makeState({
      tutorial: UNFROZEN,
      startId: 'guided',
      flags: { 'tutorial-embassy-complete': true },
      wars: [],
    });
    const { nextState } = processSeason(state);
    expect(nextState.pendingEvents.some(e => e.defId === 'evt-messana-appeal')).toBe(true);
  });
});

describe('world freeze — foreign war declarations (QA Audit Fix Plan regression)', () => {
  test('frozen: a hostile foreign power cannot spontaneously declare war', () => {
    const originalRandom = Math.random;
    Math.random = () => 0; // would always succeed the declaration roll if not gated
    try {
      const carthage = { ...INITIAL_STATE.cities.find(c => c.id === 'carthage')!, relationshipScore: 5 };
      const state = makeState({ tutorial: FROZEN, cities: [carthage], wars: [] });
      const { nextState } = processSeason(state);
      expect(nextState.wars).toEqual([]);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('not frozen: the same hostile power does declare war (regression guard — the freeze gate did not disable the roll outright)', () => {
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      const carthage = { ...INITIAL_STATE.cities.find(c => c.id === 'carthage')!, relationshipScore: 5 };
      const state = makeState({ tutorial: UNFROZEN, cities: [carthage], wars: [] });
      const { nextState } = processSeason(state);
      expect(nextState.wars.some(w => w.enemyId === 'carthage')).toBe(true);
    } finally {
      Math.random = originalRandom;
    }
  });
});
