// Tutorial rebuild, ticket 07 — act selector, replay, "leave the guided
// path". Same discipline as tutorialBeatHouse.test.ts: drives real store
// actions, not synthetic fixtures.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import {
  getStep, isTabSealed, applyTutorialEffect,
  BEAT_GOAL_STEP_ID, BEAT_ENTRY_UNLOCKED_TABS,
} from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';
import type { TutorialBeatId } from '../src/models/tutorial';

beforeEach(() => {
  useGameStore.setState(INITIAL_STATE);
});

// The number of beat-house steps strictly BEFORE 'beat-house.goal' — i.e.
// its full replayable teach content.
const BEAT_HOUSE_TEACH_STEP_COUNT =
  TUTORIAL_ARCS['beat-house'].steps.findIndex(s => s.id === BEAT_GOAL_STEP_ID['beat-house']);

describe('startTutorialReplay / advanceTutorialReplayStep / exitTutorialReplay', () => {
  test('startTutorialReplay begins at the beat\'s first step without touching real activeArc/stepId/completedArcs', () => {
    useGameStore.getState().startGame('guided'); // real progress: activeArc 'beat-house'
    useGameStore.getState().startTutorialArc('beat-ladder'); // simulate real progress being elsewhere
    const before = useGameStore.getState().tutorial;
    expect(before.activeArc).toBe('beat-ladder');

    useGameStore.getState().startTutorialReplay('beat-house');

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.replayingArc).toBe('beat-house');
    expect(tutorial.replayStepId).toBe(TUTORIAL_ARCS['beat-house'].steps[0]!.id);
    // Real progress is completely untouched.
    expect(tutorial.activeArc).toBe('beat-ladder');
    expect(tutorial.stepId).toBe(before.stepId);
    expect(tutorial.completedArcs).toEqual(before.completedArcs);
  });

  test('advanceTutorialReplayStep walks every teach step on tap, regardless of its real advance kind, and ends the replay right before the goal step — never entering goal/sandbox', () => {
    useGameStore.getState().startTutorialReplay('beat-house');

    for (let i = 0; i < BEAT_HOUSE_TEACH_STEP_COUNT; i++) {
      const stepId = useGameStore.getState().tutorial.replayStepId;
      expect(stepId).not.toBeNull();
      const step = getStep(stepId!)!;
      // Confirms this loop is genuinely exercising predicate-advance steps
      // too (e.g. beat-house.train, whose real advance never resolves on a
      // bare tap) — replay must tap through them anyway.
      if (i === TUTORIAL_ARCS['beat-house'].steps.findIndex(s => s.id === 'beat-house.train')) {
        expect(step.advance.kind).toBe('predicate');
      }
      useGameStore.getState().advanceTutorialReplayStep();
    }

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.replayingArc).toBeNull();
    expect(tutorial.replayStepId).toBeNull();
  });

  test('replaying grants nothing: no ambition, no flag stamp, no resource change, and real tutorial bookkeeping (activeArc/completedArcs) never moves', () => {
    const before = useGameStore.getState();
    expect(before.ambitions).toEqual([]);
    expect(before.tutorial.activeArc).toBeNull();
    expect(before.tutorial.completedArcs).toEqual([]);

    useGameStore.getState().startTutorialReplay('beat-house');
    for (let i = 0; i < BEAT_HOUSE_TEACH_STEP_COUNT; i++) {
      useGameStore.getState().advanceTutorialReplayStep();
    }

    const after = useGameStore.getState();
    // beat-house.forum-intro's onEnterEffectId (houseSnapshotFlaccusRel) and
    // beat-house.goal/.sandbox's onCompleteEffectId (houseSetAmbition/
    // houseSetCompleteFlag) are the three tutorial-authored effects this
    // walk would otherwise cross — none of them fired.
    expect(after.ambitions).toEqual([]);
    expect(after.flags['tutorial-flaccus-rel-snapshot']).toBeUndefined();
    expect(after.denarii).toBe(before.denarii);
    expect(after.fides).toBe(before.fides);
    expect(after.agendaTabletUnlocked).toBe(before.agendaTabletUnlocked);
    // Real tutorial bookkeeping never moved — this was purely a review.
    expect(after.tutorial.activeArc).toBeNull();
    expect(after.tutorial.completedArcs).toEqual([]);
  });

  test('does not re-chain into another beat once replay ends', () => {
    useGameStore.getState().startTutorialReplay('beat-house');
    for (let i = 0; i < BEAT_HOUSE_TEACH_STEP_COUNT; i++) {
      useGameStore.getState().advanceTutorialReplayStep();
    }
    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).not.toBe('beat-chamber');
    expect(tutorial.activeArc).toBeNull();
  });

  test('advanceTutorialReplayStep is a no-op when no replay is active', () => {
    useGameStore.getState().advanceTutorialReplayStep();
    expect(useGameStore.getState().tutorial).toEqual(INITIAL_STATE.tutorial);
  });

  test('exitTutorialReplay bails out mid-review with no confirmation and no trace left behind', () => {
    useGameStore.getState().startTutorialReplay('beat-chamber');
    useGameStore.getState().advanceTutorialReplayStep();
    expect(useGameStore.getState().tutorial.replayingArc).toBe('beat-chamber');

    useGameStore.getState().exitTutorialReplay();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.replayingArc).toBeNull();
    expect(tutorial.replayStepId).toBeNull();
  });

  test('skipTutorialArc also ends an in-flight replay — leaving the guided path never leaves a review dangling', () => {
    useGameStore.getState().startGame('guided');
    useGameStore.getState().startTutorialReplay('beat-ladder');
    useGameStore.getState().advanceTutorialReplayStep();
    expect(useGameStore.getState().tutorial.replayingArc).toBe('beat-ladder');

    useGameStore.getState().skipTutorialArc();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.replayingArc).toBeNull();
    expect(tutorial.replayStepId).toBeNull();
    expect(tutorial.activeArc).toBeNull();
  });

  test('skipAllTutorials also ends an in-flight replay', () => {
    useGameStore.getState().startTutorialReplay('beat-chamber');

    useGameStore.getState().skipAllTutorials();

    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.replayingArc).toBeNull();
    expect(tutorial.replayStepId).toBeNull();
  });
});

describe('applyTutorialEffect suppresses every effect while replaying (belt-and-braces per tutorial-rebuild-plan.md §2.4)', () => {
  test('a registered effect id no-ops when tutorial.replayingArc is set', () => {
    const s = { ...INITIAL_STATE, tutorial: { ...INITIAL_STATE.tutorial, replayingArc: 'beat-house' as TutorialBeatId } };
    expect(applyTutorialEffect('houseSetAmbition', s)).toEqual({});
  });

  test('the same effect id applies normally when not replaying', () => {
    const s = { ...INITIAL_STATE, ambitions: [] as any[], flags: {} };
    const result = applyTutorialEffect('houseSetCompleteFlag', s);
    expect(result).not.toEqual({});
  });
});

describe('isTabSealed bypasses the real unlockedTabs check while replaying', () => {
  test('a tab outside real unlockedTabs is sealed normally', () => {
    const s = { ...INITIAL_STATE, tutorial: { ...INITIAL_STATE.tutorial, unlockedTabs: ['Domus'] as any[] } };
    expect(isTabSealed('Curia', s)).toBe(true);
  });

  test('the same tab is unsealed the moment a replay is active', () => {
    const s = {
      ...INITIAL_STATE,
      tutorial: { ...INITIAL_STATE.tutorial, unlockedTabs: ['Domus'] as any[], replayingArc: 'beat-ladder' as TutorialBeatId },
    };
    expect(isTabSealed('Curia', s)).toBe(false);
    expect(isTabSealed('Cursus', s)).toBe(false);
  });
});

describe('startGame(startArc) — the act selector\'s pre-game chapter picker (StartMenuScreen)', () => {
  test('defaults to beat-house, unchanged from before this ticket', () => {
    useGameStore.getState().startGame('guided');
    const tutorial = useGameStore.getState().tutorial;
    expect(tutorial.activeArc).toBe('beat-house');
    expect(tutorial.unlockedTabs).toEqual(['Domus']);
    expect(useGameStore.getState().agendaTabletUnlocked).toBe(false);
    expect(useGameStore.getState().philonAdvisoryUnlocked).toBe(false);
  });

  test('starting directly at beat-chamber pre-unlocks Domus/Forum/Curia and the Agenda Tablet, but not Philon\'s advisory (that still unlocks at beat-chamber\'s own hand-off)', () => {
    useGameStore.getState().startGame('guided', 'senator', 'aequus', 'beat-chamber');
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-chamber');
    expect(s.tutorial.stepId).toBe(TUTORIAL_ARCS['beat-chamber'].steps[0]!.id);
    expect(s.tutorial.unlockedTabs).toEqual(BEAT_ENTRY_UNLOCKED_TABS['beat-chamber']);
    expect(s.agendaTabletUnlocked).toBe(true);
    expect(s.philonAdvisoryUnlocked).toBe(false);
  });

  test('starting directly at beat-ladder pre-unlocks every tab and both the Agenda Tablet and Philon\'s advisory (beat-chamber\'s own hand-off is skipped entirely)', () => {
    useGameStore.getState().startGame('guided', 'senator', 'aequus', 'beat-ladder');
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-ladder');
    expect(s.tutorial.stepId).toBe(TUTORIAL_ARCS['beat-ladder'].steps[0]!.id);
    expect(s.tutorial.unlockedTabs).toEqual(BEAT_ENTRY_UNLOCKED_TABS['beat-ladder']);
    expect(s.agendaTabletUnlocked).toBe(true);
    expect(s.philonAdvisoryUnlocked).toBe(true);
  });

  test('a non-guided start ignores startArc entirely', () => {
    useGameStore.getState().startGame('standard', 'senator', 'aequus', 'beat-ladder');
    expect(useGameStore.getState().tutorial).toEqual(INITIAL_STATE.tutorial);
  });
});
