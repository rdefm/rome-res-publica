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
  isWorldCategoryFrozen,
  categoryFrozenUnderPolicy,
  ALL_WORLD_GATE_CATEGORIES,
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
    // Not .clear() — TUTORIAL_TARGET_IDS is the real, shared singleton
    // registry (embassy/war/courts arcs carry real content and real target
    // references now that T7+ have authored them, unlike when this file was
    // written in T2 and every non-prologue arc was still an empty array), so
    // wiping the whole set here would make validateTutorialScript() see
    // those real steps' real targets as unregistered. Only remove the one
    // synthetic id a test below actually adds.
    TUTORIAL_TARGET_IDS.delete('domus.real-button');
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

  it('isWorldCategoryFrozen freezes every one of the eight categories during the prologue (no behavior change from the old all-or-nothing boolean)', () => {
    const s = makeState({
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });
    for (const category of ALL_WORLD_GATE_CATEGORIES) {
      expect(isWorldCategoryFrozen(s, category)).toBe(true);
    }
  });

  it('isWorldCategoryFrozen leaves every category open once the prologue has ended', () => {
    const s = makeState({
      tutorial: { activeArc: 'embassy', stepId: 's1', completedArcs: ['prologue'], unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'], skipped: false },
    });
    for (const category of ALL_WORLD_GATE_CATEGORIES) {
      expect(isWorldCategoryFrozen(s, category)).toBe(false);
    }
  });

  // No real arc is wired to a partial policy yet — doing so would itself be
  // a behavior change for that arc, which the ticket's own "no behavior
  // change" acceptance criterion rules out until a later ticket adds a real
  // guided beat with one. So the partial-thaw case is proven at the policy-
  // resolution layer instead: categoryFrozenUnderPolicy is the exact
  // function isWorldCategoryFrozen delegates to once it has looked up an
  // arc's policy value, so exercising it directly with a hand-built partial
  // array is genuine coverage of the same per-category logic, just without
  // a production arc attached to it yet.
  it('categoryFrozenUnderPolicy supports a partially-thawed policy — the mechanism future guided beats will plug into, ahead of any real arc using it yet', () => {
    const partial = ['crisisDrift', 'births'] as const;
    expect(categoryFrozenUnderPolicy(partial, 'crisisDrift')).toBe(true);
    expect(categoryFrozenUnderPolicy(partial, 'births')).toBe(true);
    expect(categoryFrozenUnderPolicy(partial, 'randomEvents')).toBe(false);
    expect(categoryFrozenUnderPolicy(partial, 'warIgnition')).toBe(false);
  });

  it('categoryFrozenUnderPolicy: "all" freezes every category; undefined freezes none', () => {
    for (const category of ALL_WORLD_GATE_CATEGORIES) {
      expect(categoryFrozenUnderPolicy('all', category)).toBe(true);
      expect(categoryFrozenUnderPolicy(undefined, category)).toBe(false);
    }
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

  it('startTutorialArc does NOT auto-navigate when the first step declares requiresTab — the player must tap the tab themselves (tutorial fix, App.tsx TutorialLayer)', () => {
    TUTORIAL_ARCS.prologue.steps = [makeStep({ id: 's1', requiresTab: 'Forum' })];
    useGameStore.setState(INITIAL_STATE);
    useGameStore.getState().startTutorialArc('prologue');
    expect(useGameStore.getState().uiNavRequest).toBeNull();
  });

  it('advanceTutorialStep does NOT auto-navigate when the NEXT step declares requiresTab', () => {
    TUTORIAL_ARCS.prologue.steps = [makeStep({ id: 's1' }), makeStep({ id: 's2', requiresTab: 'Curia' })];
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().uiNavRequest).toBeNull();
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

  it('advancing past the arc\'s last step auto-chains into the next arc in TUTORIAL_ARC_ORDER', () => {
    // embassy.steps carries real T7 content now (TUTORIAL_ARC_ORDER's next
    // arc after prologue) — swapped for a controlled synthetic step here so
    // this test exercises the auto-chain mechanism itself, not embassy's
    // actual authored content, and won't break if that content changes later.
    const realEmbassySteps = TUTORIAL_ARCS.embassy.steps;
    TUTORIAL_ARCS.embassy.steps = [makeStep({ id: 'embassy.s1', arc: 'embassy', requiresTab: 'Provinciae' })];
    TUTORIAL_ARCS.prologue.steps = [makeStep({ id: 's1', unlocksTab: 'Cursus' })];
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'prologue', stepId: 's1', completedArcs: [], unlockedTabs: ['Domus'], skipped: false },
    });

    useGameStore.getState().advanceTutorialStep();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBe('embassy');
    expect(tutorial.stepId).toBe('embassy.s1');
    expect(tutorial.completedArcs).toEqual(['prologue']);
    expect(tutorial.unlockedTabs).toEqual(['Domus', 'Cursus']);
    // Tutorial fix — no more auto-navigate on arc-to-arc chaining either.
    expect(useGameStore.getState().uiNavRequest).toBeNull();

    TUTORIAL_ARCS.embassy.steps = realEmbassySteps;
  });

  it('advancing past the true last arc (courts) in TUTORIAL_ARC_ORDER goes idle, same as before auto-chaining existed', () => {
    TUTORIAL_ARCS.courts.steps = [makeStep({ id: 'c1', arc: 'courts', unlocksTab: 'Cursus' })];
    useGameStore.setState({
      ...INITIAL_STATE,
      tutorial: { activeArc: 'courts', stepId: 'c1', completedArcs: ['prologue', 'embassy', 'war'], unlockedTabs: ['Domus'], skipped: false },
    });

    useGameStore.getState().advanceTutorialStep();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBeNull();
    expect(tutorial.stepId).toBeNull();
    expect(tutorial.completedArcs).toEqual(['prologue', 'embassy', 'war', 'courts']);

    TUTORIAL_ARCS.courts.steps = [];
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
