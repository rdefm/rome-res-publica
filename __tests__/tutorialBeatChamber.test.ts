// Tutorial rebuild, ticket 05 — integration coverage for Beat II: The
// Chamber. Same discipline as tutorialBeatHouse.test.ts: drives real store
// actions, not synthetic fixtures. Jumps straight into 'beat-chamber' via
// startTutorialArc after startGame (same "skipping earlier content is safe"
// convention tutorialWarArc/tutorialCourtsArc.test.ts already use) — this
// beat's own predicates never read anything beat-house's steps would have
// set.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import {
  validateTutorialScript, getStep, isStepSatisfied,
  isWorldCategoryFrozen, isCuratedEventPoolActive, ALL_WORLD_GATE_CATEGORIES,
} from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';
import { processSeason } from '../src/engine/turnSequencer';
import { getEventDef } from '../src/engine/eventEngine';
import { EVENT_DEFS } from '../src/data/events';

function tapThrough(n: number) {
  for (let i = 0; i < n; i++) useGameStore.getState().advanceTutorialStep();
}

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

/** Ends seasons, resolving whatever event pops up each time (guaranteed
 *  first-choice fallback, same pattern tutorialWarArc/tutorialCourtsArc.test.ts
 *  already use), until the given predicate over fresh state holds. */
function endSeasonsUntil(predicate: () => boolean, guardMax = 6) {
  let guard = 0;
  while (!predicate() && guard < guardMax) {
    guard++;
    useGameStore.getState().endSeason();
    useGameStore.getState().dismissSeasonOverlay();
    const active = useGameStore.getState().activeEvent;
    if (active) {
      const def = getEventDef(active.defId);
      const choice = def?.choices.find(c => !c.skillCheck) ?? def?.choices[0];
      if (choice) useGameStore.getState().resolveEvent(choice.id);
    }
  }
}

/** Same helper, but for a fixed number of seasons regardless of predicate —
 *  used by the deadline-failure test, which deliberately wants the ambition
 *  to NOT resolve early. */
function endSeasonsFor(n: number) {
  for (let i = 0; i < n; i++) {
    useGameStore.getState().endSeason();
    useGameStore.getState().dismissSeasonOverlay();
    const active = useGameStore.getState().activeEvent;
    if (active) {
      const def = getEventDef(active.defId);
      const choice = def?.choices.find(c => !c.skillCheck) ?? def?.choices[0];
      if (choice) useGameStore.getState().resolveEvent(choice.id);
    }
  }
}

function tutorialAmbition() {
  return useGameStore.getState().ambitions.find(a => a.source === 'tutorial')!;
}

function enterBeatChamber() {
  useGameStore.getState().startGame('guided');
  useGameStore.getState().startTutorialArc('beat-chamber');
}

function reachVote() {
  enterBeatChamber();
  tapThrough(4); // intro -> bill-list -> crisis-tracks -> cost-of-silence -> vote
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-chamber.vote');
}

function completeTeach() {
  reachVote();
  useGameStore.getState().voteBill('start-2', 'vote_for');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-chamber.goal');
}

/** Tap through the goal step — fires chamberSetAmbition, landing on the
 *  sandbox's own waiting step. */
function reachSandbox() {
  completeTeach();
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-chamber.sandbox');
}

describe('beat-chamber script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('beat-chamber has a reasonable step count', () => {
    expect(TUTORIAL_ARCS['beat-chamber'].steps.length).toBeGreaterThanOrEqual(8);
  });

  test('unlocksTab appears for Provinciae (mid-beat) and Cursus (the arc\'s real last step, ticket 06 — Curia unlocks off beat-house.sandbox, a different arc)', () => {
    const steps = TUTORIAL_ARCS['beat-chamber'].steps;
    const unlocks = steps.filter(s => s.unlocksTab).map(s => s.unlocksTab);
    expect(unlocks).toEqual(['Provinciae', 'Cursus']);
    expect(steps[steps.length - 1].unlocksTab).toBe('Cursus');
  });

  test('the goal step sets the ambition; the sandbox step waits on either outcome; the arc\'s last step marks completion', () => {
    const steps = TUTORIAL_ARCS['beat-chamber'].steps;
    const goal = steps.find(s => s.id === 'beat-chamber.goal')!;
    const sandbox = steps.find(s => s.id === 'beat-chamber.sandbox')!;
    const last = steps[steps.length - 1];
    expect(goal.onCompleteEffectId).toBe('chamberSetAmbition');
    expect(sandbox.advance).toEqual({ kind: 'predicate', predicateId: 'chamberAmbitionResolved' });
    expect(sandbox.rail).toBe('guided');
    expect(last.id).toBe('beat-chamber.philon-handoff');
    expect(last.onCompleteEffectId).toBe('chamberSetCompleteFlag');
  });
});

describe('world gate — beat-chamber is a partial thaw, not all-frozen', () => {
  const CHAMBER_TUTORIAL: GameState['tutorial'] = {
    activeArc: 'beat-chamber', stepId: 'beat-chamber.sandbox', completedArcs: ['beat-house'],
    unlockedTabs: ['Domus', 'Forum', 'Curia', 'Provinciae'], skipped: false,
    replayingArc: null, replayStepId: null,
  };

  test('randomEvents, crisisDrift, passiveBills are OPEN', () => {
    const s = { ...INITIAL_STATE, gameStarted: true, tutorial: CHAMBER_TUTORIAL };
    expect(isWorldCategoryFrozen(s, 'randomEvents')).toBe(false);
    expect(isWorldCategoryFrozen(s, 'crisisDrift')).toBe(false);
    expect(isWorldCategoryFrozen(s, 'passiveBills')).toBe(false);
  });

  test('warIgnition, claudiusDemands, births, mortality, foreignWarDeclarations stay FROZEN', () => {
    const s = { ...INITIAL_STATE, gameStarted: true, tutorial: CHAMBER_TUTORIAL };
    for (const category of ['warIgnition', 'claudiusDemands', 'births', 'mortality', 'foreignWarDeclarations'] as const) {
      expect(isWorldCategoryFrozen(s, category)).toBe(true);
    }
  });

  test('isCuratedEventPoolActive is true only while beat-chamber is active', () => {
    const s = { ...INITIAL_STATE, gameStarted: true, tutorial: CHAMBER_TUTORIAL };
    expect(isCuratedEventPoolActive(s)).toBe(true);
    expect(isCuratedEventPoolActive({ ...s, tutorial: { ...CHAMBER_TUTORIAL, activeArc: 'prologue' } })).toBe(false);
    expect(isCuratedEventPoolActive({ ...s, tutorial: { ...CHAMBER_TUTORIAL, activeArc: null } })).toBe(false);
  });

  // Ticket 05's own implementation note (from ticket 01's review):
  // turnSequencer.ts's combined event-injection block only re-checks
  // `!warIgnitionFrozen` before force-injecting evt-messana-appeal, NOT
  // `randomEventsFrozen` separately — so leaving warIgnition off
  // WORLD_GATE_POLICY['beat-chamber'] would let the Messana ignition jump
  // the gun on the scripted embassy sequencing the instant randomEvents
  // stops being a flat freeze. Same "frozen / not frozen (regression
  // guard)" pairing as tutorialWorldFreeze.test.ts's own randomEvents/
  // warIgnition describe block.
  describe('evt-messana-appeal cannot fire during Beat II\'s sandbox', () => {
    function makeState(overrides: Partial<GameState> = {}): GameState {
      return {
        ...INITIAL_STATE, gameStarted: true,
        tutorial: CHAMBER_TUTORIAL,
        startId: 'guided',
        flags: { 'tutorial-embassy-complete': true }, // ignition-eligible if not frozen
        wars: [],
        ...overrides,
      };
    }

    test('frozen: no evt-messana-appeal is injected even when every other ignition condition is met', () => {
      const state = makeState();
      const { nextState } = processSeason(state);
      expect(nextState.pendingEvents.some(e => e.defId === 'evt-messana-appeal')).toBe(false);
    });

    // No "not frozen" regression-guard counterpart here — that's already
    // covered by tutorialWorldFreeze.test.ts's own randomEvents/warIgnition
    // describe block. Deliberately not duplicated: an activeArc: null state
    // opens EVERY category, including foreignWarDeclarations, which has its
    // own (small but real, unseeded Math.random-driven) chance of declaring
    // a war before step 12 ever runs and suppressing the branch this test
    // would be asserting on — an unrelated flake this file doesn't need to
    // inherit just to re-prove behavior already covered elsewhere.
  });

  test('curated pool: every randomly-injected event during beat-chamber is tutorialSafe', () => {
    const tutorialSafeIds = new Set(EVENT_DEFS.filter(d => d.tutorialSafe).map(d => d.id));
    expect(tutorialSafeIds.size).toBeGreaterThan(0);

    let sawAnyEvent = false;
    for (let i = 0; i < 40; i++) {
      const state: GameState = {
        ...INITIAL_STATE, gameStarted: true,
        tutorial: CHAMBER_TUTORIAL,
        startId: 'guided',
        flags: {},
        wars: [{ enemyId: 'carthage', active: true } as any], // clears the messana-appeal branch too
      };
      const { nextState } = processSeason(state);
      for (const evt of nextState.pendingEvents) {
        sawAnyEvent = true;
        expect(tutorialSafeIds.has(evt.defId)).toBe(true);
      }
    }
    expect(sawAnyEvent).toBe(true);
  });
});

describe('guided run — Beat II: The Chamber, teach portion', () => {
  beforeEach(() => {
    enterBeatChamber();
  });

  test('a fresh entry begins at beat-chamber.intro, requiring Curia', () => {
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-chamber');
    expect(s.tutorial.stepId).toBe('beat-chamber.intro');
  });

  test('voting Bellum Punicum moves the War crisis track, retires the bill, and unseals Provinciae', () => {
    reachVote();
    let s = useGameStore.getState();
    const warBefore = s.crisis.war.level;
    expect(s.bills.some(b => b.id === 'start-2')).toBe(true);

    useGameStore.getState().voteBill('start-2', 'vote_for');
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.crisis.war.level).toBe(warBefore - 10); // chamberMoveWarTrack's crisis-war-10
    // Retired from the pool (tutorialEngine.ts's chamberMoveWarTrack comment)
    // so passiveBills — OPEN throughout this beat — can never resolve it a
    // second time and reverse the demonstration.
    expect(s.bills.some(b => b.id === 'start-2')).toBe(false);
    expect(s.tutorial.stepId).toBe('beat-chamber.goal');
    expect(s.tutorial.unlockedTabs).toContain('Provinciae');
  });
});

describe('guided run — Beat II: The Chamber, goal + sandbox', () => {
  beforeEach(() => {
    enterBeatChamber();
  });

  test('the goal step grants a real, 3-season, non-refusable "bill_passed" ambition', () => {
    completeTeach();
    expect(useGameStore.getState().ambitions).toEqual([]);
    const turnBefore = useGameStore.getState().turnNumber;

    useGameStore.getState().advanceTutorialStep(); // goal's own tap -> chamberSetAmbition fires
    const s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('beat-chamber.sandbox');

    const ambition = tutorialAmbition();
    expect(ambition.scope).toBe('family');
    expect(ambition.criterion).toEqual({ id: 'bill_passed', amount: 1 });
    expect(ambition.deadlineTurn).toBe(turnBefore + 3);
    expect(ambition.refusable).toBe(false);
    expect(ambition.status).toBe('active');
  });

  test('met path: passing a bill the player voted for resolves the ambition and advances into Beat III (beat-ladder)', () => {
    reachSandbox();
    // Lex Frumentaria ('start-3') already carries +20 support — Vote For
    // alone clears the 0 pass threshold on the very next season-end.
    useGameStore.getState().voteBill('start-3', 'vote_for');

    endSeasonsUntil(() => tutorialAmbition().status !== 'active');
    let s = useGameStore.getState();
    expect(tutorialAmbition().status).toBe('completed');
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep(); // sandbox -> closing
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-chamber.closing');
    useGameStore.getState().advanceTutorialStep(); // closing -> philon-handoff
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-chamber.philon-handoff');
    expect(useGameStore.getState().philonAdvisoryUnlocked).toBe(false); // not yet — fires on THIS step's completion

    useGameStore.getState().advanceTutorialStep(); // philon-handoff's own tap -> chamberSetCompleteFlag, auto-chains
    s = useGameStore.getState();
    expect(s.flags['tutorial-chamber-complete']).toBe(true);
    expect(s.philonAdvisoryUnlocked).toBe(true);
    expect(s.tutorial.activeArc).toBe('beat-ladder');
    expect(s.tutorial.stepId).toBe('beat-ladder.intro');
    expect(s.tutorial.completedArcs).toEqual(['beat-chamber']);
    // beat-chamber.philon-handoff (this beat's real last step) unlocked
    // Cursus in the SAME transition that entered beat-ladder.intro —
    // requiresTab: 'Cursus' (ticket 06 reversed the old Act IV/V order —
    // see tutorialScript.ts's own comment on that step for why it can't be
    // beat-ladder.intro itself).
    expect(s.tutorial.unlockedTabs).toContain('Cursus');
  });

  test('missed path: letting the deadline pass resolves the ambition failed (capped Dignitas ding), still advances the beat — never blocks or retries', () => {
    reachSandbox();
    useGameStore.setState({ lifetimeDignitas: 20 }); // nonzero so the ding is visible
    const dignitasBefore = useGameStore.getState().lifetimeDignitas;

    // Deliberately never vote for anything — 3 seasons exhausts the deadline
    // (chamberSetAmbition's deadlineSeasons: 3) with no qualifying bill.
    endSeasonsFor(3);

    let s = useGameStore.getState();
    const ambition = tutorialAmbition();
    expect(ambition.status).toBe('failed');
    expect(s.lifetimeDignitas).toBeLessThan(dignitasBefore);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep(); // sandbox -> closing
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-chamber.closing');
    tapThrough(2); // closing -> philon-handoff -> chamberSetCompleteFlag, auto-chains

    s = useGameStore.getState();
    expect(s.flags['tutorial-chamber-complete']).toBe(true);
    expect(s.philonAdvisoryUnlocked).toBe(true); // unlocked regardless of outcome
    expect(s.tutorial.activeArc).toBe('beat-ladder');
    expect(s.tutorial.stepId).toBe('beat-ladder.intro');
  });
});
