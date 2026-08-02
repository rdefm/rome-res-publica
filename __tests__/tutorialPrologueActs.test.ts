// Tutorial redesign, Chunk T5a (Act IV) — integration coverage for the
// prologue's real authored content. Drives the actual store actions a
// player would trigger from the screen, not synthetic fixtures — this is
// the same guided run a real session would produce, one step at a time.
//
// Tutorial rebuild, ticket 04 — Acts I-II moved into 'beat-house'
// (tutorialBeatHouse.test.ts now covers them). Tutorial rebuild, ticket 05 —
// Act III moved into 'beat-chamber' (tutorialBeatChamber.test.ts now covers
// it). Tutorial rebuild, ticket 06 — Act V moved into 'beat-ladder'
// (tutorialBeatLadder.test.ts now covers it); 'prologue' is now a
// single-act arc, just Act IV/Provinciae, and now runs AFTER 'beat-ladder'
// in TUTORIAL_ARC_ORDER (tutorialEngine.ts) rather than before it — Cursus
// is unlocked off 'beat-chamber.philon-handoff' now, not this arc's own
// last step (tutorialScript.ts's own comment on that step explains why).
// Jumps straight in via setState (same "skipping earlier content is safe"
// convention tutorialEmbassyArc/tutorialWarArc/tutorialCourtsArc.test.ts
// already use) rather than replaying beat-house/beat-chamber/beat-ladder
// first — Act IV's own predicate never reads anything those beats' steps
// would have set beyond unlockedTabs, seeded here to exactly what a real
// beat-ladder completion would have left (every tab but none of the later
// arcs' own content).
//
// advanceTutorialStep() itself never checks whether the current step's
// advance condition is actually satisfied — that gating is the caller's
// job (the director checks isStepSatisfied for predicate steps; the
// caption's onTapAdvance only wires to tap steps). So tapping through a
// predicate-gated step without performing the real action first would
// silently skip it — these helpers perform the real action before ever
// calling advanceTutorialStep on a predicate step, matching what the
// director would actually do.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { validateTutorialScript, getStep, isStepSatisfied } from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

/** Enters 'prologue' at Act IV's first step, seeded as if beat-house,
 *  beat-chamber and beat-ladder had just completed for real (see this
 *  file's header comment). */
function enterProloguePostBeatLadder() {
  useGameStore.getState().startGame('guided');
  useGameStore.setState({
    tutorial: {
      activeArc: 'prologue',
      stepId: TUTORIAL_ARCS.prologue.steps[0]!.id,
      completedArcs: ['beat-house', 'beat-chamber', 'beat-ladder'],
      unlockedTabs: ['Domus', 'Forum', 'Curia', 'Provinciae', 'Cursus'],
      skipped: false,
    },
  });
}

function reachAct4BuyAsset() {
  enterProloguePostBeatLadder();
  for (let i = 0; i < 5; i++) useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act4.buy-asset');
}

describe('prologue script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('prologue is a single act (IV) with a reasonable step count', () => {
    const ids = TUTORIAL_ARCS.prologue.steps.map(s => s.id);
    expect(ids.every(id => id.startsWith('prologue.act4.'))).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(5);
    expect(ids.length).toBeLessThanOrEqual(10);
  });

  test('prologue carries no unlocksTab — Cursus now unlocks off beat-chamber.philon-handoff (ticket 06)', () => {
    const steps = TUTORIAL_ARCS.prologue.steps;
    const unlocks = steps.filter(s => s.unlocksTab).map(s => s.unlocksTab);
    expect(unlocks).toEqual([]);
  });

  test('the arc\'s first and last step are both Act IV\'s', () => {
    const steps = TUTORIAL_ARCS.prologue.steps;
    expect(steps[0].id).toBe('prologue.act4.intro');
    expect(steps[steps.length - 1].id).toBe('prologue.act4.buy-asset');
  });
});

describe('guided run — Act IV end to end', () => {
  afterEach(() => useGameStore.setState(INITIAL_STATE));

  test('Act IV: buying any asset in Campania completes the prologue arc outright and auto-chains into embassy', () => {
    reachAct4BuyAsset();
    let s = useGameStore.getState();
    expect(s.cities.find(c => c.id === 'campania')?.ownedAssets ?? []).toEqual([]);
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    useGameStore.getState().purchaseAsset('campania', 'campania_holiday_estate');
    s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('embassy');
    expect(s.tutorial.stepId).toBe('embassy.intro');
    expect(s.tutorial.completedArcs).toEqual(['beat-house', 'beat-chamber', 'beat-ladder', 'prologue']);
    // Cursus was already unlocked by beat-chamber.philon-handoff (seeded in
    // enterProloguePostBeatLadder above) — this arc doesn't touch unlockedTabs.
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Curia', 'Provinciae', 'Cursus']);
  });
});
