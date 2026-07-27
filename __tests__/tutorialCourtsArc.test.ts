// Tutorial redesign, Chunk T9 — integration coverage for the courts arc's
// real authored content. Same discipline as tutorialEmbassyArc.test.ts/
// tutorialWarArc.test.ts: drives real store actions, not synthetic fixtures.
// Jumps straight into the courts arc via startTutorialArc('courts') after
// startGame — courts' own predicates never read anything the prologue/
// embassy/war arcs would have set (standing in for their completion via
// flags, mirroring tutorialWarArc.test.ts's own precedent).

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore } from '../src/state/gameStore';
import {
  validateTutorialScript, getStep, isStepSatisfied, TUTORIAL_COURTS_TRIAL_ID,
} from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';
import { CLAUDIUS_LEADER_ID } from '../src/data/claudiusArc';
import { getEventDef } from '../src/engine/eventEngine';

function tapThrough(n: number) {
  for (let i = 0; i < n; i++) useGameStore.getState().advanceTutorialStep();
}

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

function courtsTrial() {
  return useGameStore.getState().trials.find(t => t.id === TUTORIAL_COURTS_TRIAL_ID)!;
}

/** Ends seasons, resolving whatever event pops up each time (same
 *  guaranteed-first-choice fallback as tutorialWarArc.test.ts's own helper),
 *  until the given predicate over fresh state holds. Does NOT fast-resolve
 *  in-session trials — courtsTrialDayArrived only needs 'preparing' to end,
 *  not the trial to actually finish. */
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

describe('courts script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('courts arc has a reasonable step count', () => {
    expect(TUTORIAL_ARCS.courts.steps.length).toBeGreaterThanOrEqual(8);
  });

  test('every step is rail: guided', () => {
    for (const step of TUTORIAL_ARCS.courts.steps) {
      expect(step.rail).toBe('guided');
    }
  });

  test("the arc's last step carries courtsSetCompleteFlag", () => {
    const steps = TUTORIAL_ARCS.courts.steps;
    expect(steps[steps.length - 1].onCompleteEffectId).toBe('courtsSetCompleteFlag');
  });
});

describe('entry gate — courtsEntryClear', () => {
  beforeEach(() => {
    useGameStore.getState().startGame('guided');
    useGameStore.setState({
      flags: {
        ...useGameStore.getState().flags,
        'tutorial-embassy-complete': true,
        'tutorial-war-complete': true,
      },
    });
    useGameStore.getState().startTutorialArc('courts');
    tapThrough(1); // courts.intro -> courts.charge-gate
  });

  test('clear on a fresh game (no active trial, no Tribune)', () => {
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.charge-gate');
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  });

  test('blocked while another trial is active, clears once it resolves', () => {
    useGameStore.setState({
      trials: [{
        id: 'some-other-trial',
        seat: 'defense',
        charge: 'peculatus',
        chargeSource: 'corruption',
        prosecutor: { kind: 'leader', leaderId: 'valerius-flaccus' },
        defendant: { kind: 'family', characterId: useGameStore.getState().family.find(c => c.isPlayer)!.id },
        filedSeason: useGameStore.getState().turnNumber,
        startsSeason: useGameStore.getState().turnNumber + 3,
        playerPrep: { logos: 0, pathos: 0, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
        approach: 'procedure',
        speakerId: useGameStore.getState().family.find(c => c.isPlayer)!.id,
        npcStrength: 20,
        juryLean: 0,
        consumedSecretIds: [],
        status: 'preparing',
        session: null,
      }],
    });
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(false);

    useGameStore.setState({
      trials: useGameStore.getState().trials.map(t =>
        t.id === 'some-other-trial' ? { ...t, status: 'resolved' as const, outcome: 'acquitted' as const } : t
      ),
    });
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  });

  test('blocked while a Tribune is held', () => {
    useGameStore.setState({ tribuneHolder: useGameStore.getState().family.find(c => c.isPlayer)!.id });
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(false);
  });
});

describe('guided run — courts arc end to end', () => {
  beforeEach(() => {
    useGameStore.getState().startGame('guided');
    useGameStore.setState({
      flags: {
        ...useGameStore.getState().flags,
        'tutorial-embassy-complete': true,
        'tutorial-war-complete': true,
      },
    });
    useGameStore.getState().startTutorialArc('courts');
  });

  test('charge filed, all three prep fronts, trial day, and verdict complete the arc', () => {
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.charge-gate');
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.charge-filed');
    // onEnterEffectId (courtsFileFalseCharge) fired the instant this step was
    // entered — the fabricated charge should already exist.
    const trial = courtsTrial();
    expect(trial).toBeDefined();
    expect(trial.charge).toBe('repetundae');
    expect(trial.chargeSource).toBe('accusation');
    expect(trial.seat).toBe('defense');
    expect(trial.prosecutor).toEqual({ kind: 'leader', leaderId: CLAUDIUS_LEADER_ID });

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.basilica-intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.prep-logos');

    const player = useGameStore.getState().family.find(c => c.isPlayer)!;
    useGameStore.getState().gatherTrialEvidence(TUTORIAL_COURTS_TRIAL_ID, player.id);
    expect(courtsTrial().playerPrep.logos).toBeGreaterThan(0);
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.prep-pathos');

    useGameStore.getState().prepareTrialOration(TUTORIAL_COURTS_TRIAL_ID);
    expect(courtsTrial().playerPrep.pathos).toBeGreaterThan(0);
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.prep-ethos');

    // Invoke the Ancestors is free but scales with lifetimeDignitas
    // (trialEngine.invokeAncestorsBonus) — genuinely 0 at a fresh game's
    // starting Dignitas. courtsEthosPrepared gates on actionsUsed, not the
    // resulting ethos total, precisely so this doesn't softlock the step.
    useGameStore.getState().invokeTrialAncestors(TUTORIAL_COURTS_TRIAL_ID);
    expect(courtsTrial().playerPrep.actionsUsed).toContain('invoke_ancestors');
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.wait-for-trial-day');

    endSeasonsUntil(() => courtsTrial().status !== 'preparing');
    expect(courtsTrial().status).not.toBe('preparing');

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.trial-day');

    if (courtsTrial().status === 'in_session') {
      useGameStore.getState().fastResolveTrialSession(TUTORIAL_COURTS_TRIAL_ID);
    }
    expect(courtsTrial().status).toBe('resolved');
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.closing');
    expect(useGameStore.getState().flags['tutorial-courts-complete']).toBeUndefined();

    // courts.closing's own tap moves to the real final step, the hand-off
    // beat — philonAdvisoryUnlocked is still false here (guided start's own
    // startGame() default), matching what a fresh guided run holds through
    // the entire tutorial.
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('courts.philon-handoff');
    expect(useGameStore.getState().philonAdvisoryUnlocked).toBe(false);

    // Hand-off beat's own tap fires courtsSetCompleteFlag, which also flips
    // philonAdvisoryUnlocked. courts is the last arc in TUTORIAL_ARC_ORDER,
    // so the auto-chain goes idle rather than entering a fifth arc.
    useGameStore.getState().advanceTutorialStep();
    const s = useGameStore.getState();
    expect(s.flags['tutorial-courts-complete']).toBe(true);
    expect(s.philonAdvisoryUnlocked).toBe(true);
    expect(s.tutorial.completedArcs).toEqual(['courts']);
    expect(s.tutorial.activeArc).toBeNull();
  });
});
