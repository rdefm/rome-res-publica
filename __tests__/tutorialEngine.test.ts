// Tutorial redesign, Chunk T2 — engine-level step resolution plus the
// gameStore actions that drive the director. TUTORIAL_ARCS ships empty until
// T5/T7/T8/T9 author real content, so these tests inject synthetic steps
// directly into the (mutable, exported) TUTORIAL_ARCS registry for the
// duration of each test and restore it afterward.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import {
  getStep,
  getNextStep,
  isStepSatisfied,
  isTabSealed,
  isWorldFrozen,
  applyTutorialEffect,
  validateTutorialScript,
  TUTORIAL_PREDICATES,
  TUTORIAL_EFFECTS,
  TUTORIAL_TARGET_IDS,
} from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';
import type { TutorialStep } from '../src/models/tutorial';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_STATE, gameStarted: true, ...overrides };
}

function makeStep(overrides: Partial<TutorialStep> = {}): TutorialStep {
  return {
    id: 'prologue.test.step-1',
    arc: 'prologue',
    rail: 'hard',
    narration: 'Test narration.',
    advance: { kind: 'tap' },
    ...overrides,
  };
}

describe('tutorialEngine — pure step resolution', () => {
  afterEach(() => {
    TUTORIAL_ARCS.prologue.steps = [];
    delete TUTORIAL_PREDICATES['test.always-true'];
    delete TUTORIAL_PREDICATES['test.always-false'];
    delete TUTORIAL_EFFECTS['test.add-fides'];
    TUTORIAL_TARGET_IDS.clear();
  });

  it('getStep finds a step by id across arcs; null if absent', () => {
    const step = makeStep();
    TUTORIAL_ARCS.prologue.steps = [step];
    expect(getStep('prologue.test.step-1')).toEqual(step);
    expect(getStep('nonexistent')).toBeNull();
  });

  it('getNextStep returns the following step in authored order', () => {
    const step1 = makeStep({ id: 's1' });
    const step2 = makeStep({ id: 's2' });
    TUTORIAL_ARCS.prologue.steps = [step1, step2];
    expect(getNextStep(step1, makeState())).toEqual(step2);
  });

  it('getNextStep returns null past the arc\'s last step', () => {
    const step1 = makeStep({ id: 's1' });
    TUTORIAL_ARCS.prologue.steps = [step1];
    expect(getNextStep(step1, makeState())).toBeNull();
  });

  it('isStepSatisfied is true for a predicate step whose predicate holds', () => {
    TUTORIAL_PREDICATES['test.always-true'] = () => true;
    const step = makeStep({ advance: { kind: 'predicate', predicateId: 'test.always-true' } });
    expect(isStepSatisfied(step, makeState())).toBe(true);
  });

  it('isStepSatisfied is false for a predicate step whose predicate does not hold', () => {
    TUTORIAL_PREDICATES['test.always-false'] = () => false;
    const step = makeStep({ advance: { kind: 'predicate', predicateId: 'test.always-false' } });
    expect(isStepSatisfied(step, makeState())).toBe(false);
  });

  it('isStepSatisfied is false for an unknown predicateId (fails safe, does not throw)', () => {
    const step = makeStep({ advance: { kind: 'predicate', predicateId: 'nope' } });
    expect(isStepSatisfied(step, makeState())).toBe(false);
  });

  it('isStepSatisfied is always false for tap and eventResolved steps', () => {
    expect(isStepSatisfied(makeStep({ advance: { kind: 'tap' } }), makeState())).toBe(false);
    expect(
      isStepSatisfied(makeStep({ advance: { kind: 'eventResolved', defId: 'evt-x' } }), makeState()),
    ).toBe(false);
  });

  it('isTabSealed reflects tutorial.unlockedTabs', () => {
    const s = makeState({
      tutorial: { activeArc: 'prologue', stepId: null, completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });
    expect(isTabSealed('Domus', s)).toBe(false);
    expect(isTabSealed('Forum', s)).toBe(true);
  });

  it('isWorldFrozen is true only while the prologue arc is active', () => {
    expect(isWorldFrozen(makeState({
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    }))).toBe(true);

    expect(isWorldFrozen(makeState({
      tutorial: { activeArc: 'embassy', stepId: 's1', completedArcs: ['prologue'], unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'], skipped: false },
    }))).toBe(false);

    expect(isWorldFrozen(makeState({
      tutorial: { activeArc: null, stepId: null, completedArcs: [], unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'], skipped: false },
    }))).toBe(false);
  });

  it('isWorldFrozen is false once the prologue is skipped (activeArc clears to null)', () => {
    const s = makeState({
      tutorial: { activeArc: null, stepId: null, completedArcs: ['prologue', 'embassy', 'war', 'courts'], unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'], skipped: true },
    });
    expect(isWorldFrozen(s)).toBe(false);
  });

  it('isWorldFrozen defensively reads undefined tutorial as not frozen (bespoke test fixtures)', () => {
    const s = { ...makeState(), tutorial: undefined } as any;
    expect(isWorldFrozen(s)).toBe(false);
  });

  it('applyTutorialEffect applies a registered effect and no-ops for undefined/unknown ids', () => {
    TUTORIAL_EFFECTS['test.add-fides'] = (s) => ({ fides: s.fides + 5 });
    expect(applyTutorialEffect('test.add-fides', makeState({ fides: 10 }))).toEqual({ fides: 15 });
    expect(applyTutorialEffect(undefined, makeState())).toEqual({});
    expect(applyTutorialEffect('nope', makeState())).toEqual({});
  });

  it('validateTutorialScript passes on the real (empty) script', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  it('validateTutorialScript throws on a step referencing an unregistered predicate', () => {
    TUTORIAL_ARCS.prologue.steps = [
      makeStep({ advance: { kind: 'predicate', predicateId: 'ghost' } }),
    ];
    expect(() => validateTutorialScript()).toThrow(/ghost/);
  });

  it('validateTutorialScript throws on a step referencing an unregistered target', () => {
    TUTORIAL_ARCS.prologue.steps = [makeStep({ target: 'domus.ghost-button' })];
    expect(() => validateTutorialScript()).toThrow(/domus\.ghost-button/);
  });

  it('validateTutorialScript passes once the referenced target is registered', () => {
    TUTORIAL_TARGET_IDS.add('domus.real-button');
    TUTORIAL_ARCS.prologue.steps = [makeStep({ target: 'domus.real-button' })];
    expect(() => validateTutorialScript()).not.toThrow();
  });
});

describe('gameStore tutorial actions', () => {
  afterEach(() => {
    TUTORIAL_ARCS.prologue.steps = [];
    useGameStore.setState(INITIAL_STATE);
  });

  it('startTutorialArc enters the arc at its first step', () => {
    TUTORIAL_ARCS.prologue.steps = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
    useGameStore.setState(INITIAL_STATE);
    useGameStore.getState().startTutorialArc('prologue');
    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBe('prologue');
    expect(tutorial.stepId).toBe('s1');
  });

  it('advanceTutorialStep moves to the next step without touching unlockedTabs', () => {
    TUTORIAL_ARCS.prologue.steps = [makeStep({ id: 's1' }), makeStep({ id: 's2' })];
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });

    useGameStore.getState().advanceTutorialStep();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.stepId).toBe('s2');
    expect(tutorial.activeArc).toBe('prologue');
    expect(tutorial.unlockedTabs).toEqual(['Domus']);
  });

  it('advancing past a step with unlocksTab adds that tab immediately, mid-arc', () => {
    TUTORIAL_ARCS.prologue.steps = [
      makeStep({ id: 's1', unlocksTab: 'Forum' }),
      makeStep({ id: 's2' }),
    ];
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });

    useGameStore.getState().advanceTutorialStep();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.stepId).toBe('s2');
    expect(tutorial.unlockedTabs).toEqual(['Domus', 'Forum']);
  });

  it('advancing past the arc\'s last step completes the arc and unlocks its tab', () => {
    TUTORIAL_ARCS.prologue.steps = [makeStep({ id: 's1', unlocksTab: 'Cursus' })];
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });

    useGameStore.getState().advanceTutorialStep();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBeNull();
    expect(tutorial.stepId).toBeNull();
    expect(tutorial.completedArcs).toEqual(['prologue']);
    expect(tutorial.unlockedTabs).toEqual(['Domus', 'Cursus']);
  });

  it('advanceTutorialStep is a no-op when no arc is active', () => {
    useGameStore.setState(INITIAL_STATE);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial).toEqual(INITIAL_STATE.tutorial);
  });

  it('skipTutorialArc cascades to every arc after the active one and unlocks all tabs', () => {
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'embassy', stepId: 'x', completedArcs: ['prologue'], unlockedTabs: ['Domus'], skipped: false },
    });

    useGameStore.getState().skipTutorialArc();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBeNull();
    expect(tutorial.stepId).toBeNull();
    expect(tutorial.skipped).toBe(true);
    expect(new Set(tutorial.completedArcs)).toEqual(new Set(['prologue', 'embassy', 'war', 'courts']));
    expect(tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia']);
  });

  it('skipTutorialArc is a no-op when no arc is active', () => {
    useGameStore.setState(INITIAL_STATE);
    useGameStore.getState().skipTutorialArc();
    expect(useGameStore.getState().tutorial).toEqual(INITIAL_STATE.tutorial);
  });

  it('skipAllTutorials completes all four arcs and unlocks every tab', () => {
    useGameStore.setState(INITIAL_STATE);
    useGameStore.getState().skipAllTutorials();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBeNull();
    expect(tutorial.completedArcs).toEqual(['prologue', 'embassy', 'war', 'courts']);
    expect(tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia']);
    expect(tutorial.skipped).toBe(true);
  });
});
