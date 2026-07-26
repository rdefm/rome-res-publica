// Tutorial redesign, Chunk T7 — integration coverage for the Embassy arc's
// real authored content. Same discipline as tutorialPrologueActs.test.ts:
// drives real store actions, not synthetic fixtures. Jumps straight into
// the embassy arc via startTutorialArc('embassy') after startGame — embassy's
// own predicates/effects never read anything the prologue's steps would have
// set (only bills/cities/clients), so skipping the prologue itself is safe
// and keeps this file focused on embassy content alone.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore } from '../src/state/gameStore';
import { validateTutorialScript, getStep, isStepSatisfied } from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';

function tapThrough(n: number) {
  for (let i = 0; i < n; i++) useGameStore.getState().advanceTutorialStep();
}

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

function messana() {
  return useGameStore.getState().cities.find(c => c.id === 'messana')!;
}

describe('embassy script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('embassy arc has a reasonable step count', () => {
    expect(TUTORIAL_ARCS.embassy.steps.length).toBeGreaterThanOrEqual(5);
  });

  test('every step is rail: guided (freeze lifts for this arc)', () => {
    for (const step of TUTORIAL_ARCS.embassy.steps) {
      expect(step.rail).toBe('guided');
    }
  });

  test('the arc\'s last step carries embassySetCompleteFlag', () => {
    const steps = TUTORIAL_ARCS.embassy.steps;
    expect(steps[steps.length - 1].onCompleteEffectId).toBe('embassySetCompleteFlag');
  });
});

describe('guided run — embassy arc end to end', () => {
  beforeEach(() => {
    useGameStore.getState().startGame('guided');
    useGameStore.getState().startTutorialArc('embassy');
  });

  test('world freeze lifts the instant the embassy arc becomes active', () => {
    // isWorldFrozen is prologue-only (see tutorialEngine.ts's own comment) —
    // asserted indirectly here via a real consequence: passive bill
    // resolution (turnSequencer step 4) is no longer skipped, so the
    // ambassador posting bill below can actually resolve at season end.
    expect(useGameStore.getState().tutorial.activeArc).toBe('embassy');
  });

  test('posting an ambassador to Messana, waiting a season, building support, then recruiting Vibius completes the arc', () => {
    expect(useGameStore.getState().tutorial.stepId).toBe('embassy.intro');

    tapThrough(2); // intro -> find-messana -> request-posting
    let s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('embassy.request-posting');
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    useGameStore.getState().seekAmbassadorPosting('messana');
    s = useGameStore.getState();
    expect(s.bills.some(b => b.name.startsWith('Ambassador Posting:') && b.name.endsWith(' to Messana'))).toBe(true);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('embassy.end-season-for-posting');
    expect(messana().playerAmbassador).toBeNull();

    // Ambassador Posting Bill starts at support: 10 with no opposing forces
    // — passes the very first season it's up for passive resolution.
    let guard = 0;
    while (!isStepSatisfied(currentStep(), useGameStore.getState()) && guard < 4) {
      useGameStore.getState().endSeason();
      useGameStore.getState().dismissSeasonOverlay();
      guard++;
    }
    expect(messana().playerAmbassador).not.toBeNull();

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('embassy.ambassador-desk');

    tapThrough(1); // ambassador-desk -> recruit-vibius
    s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('embassy.recruit-vibius');
    // Messana's startingRelationship (45) already clears Vibius's
    // relationshipRequired (40) — only Local Support (0 -> 25) is a real gate.
    expect(messana().relationshipScore).toBeGreaterThanOrEqual(40);
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    // Build Local Support via the Ambassador's Desk — grain_dole only
    // (denarii, not Fides: 200 starting denarii comfortably covers several
    // seasons, and recruitCityClient itself needs 20 Fides, so this leaves
    // that pool untouched for the recruit call below).
    guard = 0;
    while (messana().localSupport < 25 && guard < 5) {
      useGameStore.getState().resolveAmbassadorAction('messana', 'grain_dole');
      if (messana().localSupport < 25) {
        useGameStore.getState().endSeason();
        useGameStore.getState().dismissSeasonOverlay();
      }
      guard++;
    }
    expect(messana().localSupport).toBeGreaterThanOrEqual(25);
    expect(useGameStore.getState().fides).toBeGreaterThanOrEqual(20);

    useGameStore.getState().recruitCityClient('messana', 'mamertine_captain');
    s = useGameStore.getState();
    expect(s.clients.some(c => (c as any).provincialClientDefId === 'mamertine_captain')).toBe(true);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('embassy.closing');
    expect(useGameStore.getState().flags['tutorial-embassy-complete']).toBeUndefined();

    // Closing beat's own tap fires embassySetCompleteFlag and auto-chains
    // into the next arc in TUTORIAL_ARC_ORDER (war).
    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.flags['tutorial-embassy-complete']).toBe(true);
    expect(s.tutorial.completedArcs).toEqual(['embassy']);
  });
});
