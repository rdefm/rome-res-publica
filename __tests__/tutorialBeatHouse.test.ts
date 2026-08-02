// Tutorial rebuild, ticket 04 — integration coverage for Beat I: The House.
// Same discipline as tutorialPrologueActs.test.ts (which this ticket trims
// down to Acts III-V): drives real store actions, not synthetic fixtures.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore } from '../src/state/gameStore';
import {
  validateTutorialScript, getStep, isStepSatisfied,
  isWorldFrozen, isWorldCategoryFrozen, ALL_WORLD_GATE_CATEGORIES,
} from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';

function tapThrough(n: number) {
  for (let i = 0; i < n; i++) useGameStore.getState().advanceTutorialStep();
}

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

/** Advance to the Domus half's completion step (5 taps from beat-house.intro,
 *  same shape as the old prologue Act I). */
function reachTrain() {
  tapThrough(5);
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.train');
}

/** Train (leaves enough Fides for the Forum regression test below, same
 *  reasoning as tutorialPrologueActs.test.ts's completeAct1), then advance
 *  into the Forum half. */
function completeDomus() {
  reachTrain();
  const player = useGameStore.getState().family.find(c => c.isPlayer)!;
  useGameStore.getState().trainCharacter(player.id, 'martial');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.forum-intro');
}

function reachCourtFlaccus() {
  completeDomus();
  tapThrough(5);
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.court-flaccus');
}

function completeForum() {
  reachCourtFlaccus();
  useGameStore.getState().inviteToDinner('valerius-flaccus');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.income-intro');
}

function reachRentShop() {
  completeForum();
  tapThrough(1);
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.rent-shop');
}

function completeIncome() {
  reachRentShop();
  useGameStore.getState().rentShop(0, 'tavern');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.goal');
}

/** Tap through the goal step — fires houseSetAmbition, landing on the
 *  sandbox's own waiting step. */
function reachSandbox() {
  completeIncome();
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.sandbox');
}

describe('beat-house script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('beat-house has a reasonable step count', () => {
    expect(TUTORIAL_ARCS['beat-house'].steps.length).toBeGreaterThanOrEqual(10);
  });

  test('unlocksTab appears exactly twice, in order: Forum then Curia', () => {
    const steps = TUTORIAL_ARCS['beat-house'].steps;
    const unlocks = steps.filter(s => s.unlocksTab).map(s => s.unlocksTab);
    expect(unlocks).toEqual(['Forum', 'Curia']);
  });

  test('the goal step sets the ambition; the sandbox step (the arc\'s last) waits on it and marks completion', () => {
    const steps = TUTORIAL_ARCS['beat-house'].steps;
    const goal = steps.find(s => s.id === 'beat-house.goal')!;
    const last = steps[steps.length - 1];
    expect(goal.onCompleteEffectId).toBe('houseSetAmbition');
    expect(last.id).toBe('beat-house.sandbox');
    expect(last.rail).toBe('guided');
    expect(last.advance).toEqual({ kind: 'predicate', predicateId: 'houseAmbitionMet' });
    expect(last.onCompleteEffectId).toBe('houseSetCompleteFlag');
  });
});

describe('world freeze — beat-house freezes every category, same as the old prologue', () => {
  test('isWorldFrozen is true while beat-house is active', () => {
    useGameStore.getState().startGame('guided');
    expect(useGameStore.getState().tutorial.activeArc).toBe('beat-house');
    expect(isWorldFrozen(useGameStore.getState())).toBe(true);
  });

  test('every one of the eight categories is frozen individually', () => {
    useGameStore.getState().startGame('guided');
    const s = useGameStore.getState();
    for (const category of ALL_WORLD_GATE_CATEGORIES) {
      expect(isWorldCategoryFrozen(s, category)).toBe(true);
    }
  });
});

describe('guided run — Beat I: The House, end to end', () => {
  beforeEach(() => {
    useGameStore.getState().startGame('guided');
  });

  test('a fresh guided start begins at beat-house.intro, hard-railed to Domus only', () => {
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-house');
    expect(s.tutorial.stepId).toBe('beat-house.intro');
    expect(s.tutorial.unlockedTabs).toEqual(['Domus']);
  });

  test('training a skill on Marcus completes the Domus half and unseals Forum', () => {
    reachTrain();
    let s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    const player = s.family.find(c => c.isPlayer)!;
    useGameStore.getState().trainCharacter(player.id, 'rhetoric');
    s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('beat-house.forum-intro');
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum']);
  });

  test('courting Flaccus via ANY real action (not just the spotlighted one) completes the Forum half', () => {
    reachCourtFlaccus();
    let s = useGameStore.getState();
    const before = s.clans.flatMap(c => c.leaders).find(l => l.id === 'valerius-flaccus')!.relationship;

    useGameStore.getState().buyInfluence('valerius-flaccus'); // deliberately not Invite to Dinner
    s = useGameStore.getState();
    const after = s.clans.flatMap(c => c.leaders).find(l => l.id === 'valerius-flaccus')!.relationship;
    expect(after).toBeGreaterThan(before);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('beat-house.income-intro');
    // Ticket 05 moved Curia's unlock to 'beat-house.sandbox' (this beat's
    // real last step) — see that step's own comment for why it can't live
    // on 'beat-chamber.intro' itself. Still sealed here.
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum']);
  });

  test('renting a storefront completes the income section', () => {
    reachRentShop();
    let s = useGameStore.getState();
    expect(s.house.shops.every(shop => shop === null)).toBe(true);
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    useGameStore.getState().rentShop(1, 'bakery');
    s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-house.goal');
  });

  test('the goal step grants a real, no-deadline, non-refusable "Hold 250 Denarii" ambition and unlocks the Agenda Tablet', () => {
    completeIncome();
    expect(useGameStore.getState().agendaTabletUnlocked).toBe(false);
    expect(useGameStore.getState().ambitions).toEqual([]);

    useGameStore.getState().advanceTutorialStep(); // goal's own tap -> houseSetAmbition fires
    const s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('beat-house.sandbox');
    expect(s.agendaTabletUnlocked).toBe(true);
    // Splitting agendaTabletUnlocked off philonAdvisoryUnlocked (ticket 04's
    // spec review) must NOT also unlock the player's own ambition builder —
    // that stays deferred to end of Beat II (ticket 05).
    expect(s.philonAdvisoryUnlocked).toBe(false);

    expect(s.ambitions).toHaveLength(1);
    const ambition = s.ambitions[0];
    expect(ambition.source).toBe('tutorial');
    expect(ambition.scope).toBe('family');
    expect(ambition.title).toBe('Hold 250 Denarii');
    expect(ambition.criterion).toEqual({ id: 'resource_threshold', resource: 'denarii', amount: 250 });
    expect(ambition.deadlineTurn).toBeUndefined();
    expect(ambition.refusable).toBe(false);
    expect(ambition.status).toBe('active');
  });

  test('the sandbox is fully free-play (rail: guided) while the ambition sits unmet across several seasons, and never fails', () => {
    reachSandbox();
    for (let i = 0; i < 6; i++) {
      const s = useGameStore.getState();
      expect(s.tutorial.activeArc).toBe('beat-house');
      expect(s.tutorial.stepId).toBe('beat-house.sandbox');
      const ambition = s.ambitions.find(a => a.source === 'tutorial')!;
      expect(ambition.status).toBe('active'); // never 'failed' — no deadlineTurn to miss
      useGameStore.getState().endSeason();
      useGameStore.getState().dismissSeasonOverlay();
    }
    // World stays frozen throughout the whole sandbox, exactly as the teach
    // portion — the beat's own policy is 'all', unconditional on step/rail.
    expect(isWorldFrozen(useGameStore.getState())).toBe(true);
  });

  test('meeting the goal (denarii >= 250) resolves the ambition and advances into Beat II (beat-chamber)', () => {
    reachSandbox();
    useGameStore.setState({ denarii: 250 });
    useGameStore.getState().endSeason();
    useGameStore.getState().dismissSeasonOverlay();

    let s = useGameStore.getState();
    const ambition = s.ambitions.find(a => a.source === 'tutorial')!;
    expect(ambition.status).toBe('completed');
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.flags['tutorial-house-complete']).toBe(true);
    expect(s.tutorial.activeArc).toBe('beat-chamber');
    expect(s.tutorial.stepId).toBe('beat-chamber.intro');
    expect(s.tutorial.completedArcs).toEqual(['beat-house']);
    // beat-house.sandbox (this beat's real last step) unlocked Curia in the
    // SAME transition that entered beat-chamber.intro — requiresTab: 'Curia'
    // depends on that having already happened (see that step's own comment
    // in tutorialScript.ts for why it can't be beat-chamber.intro itself).
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Curia']);
  });

  test('sealed tabs are actually sealed until each half of beat-house completes', () => {
    let s = useGameStore.getState();
    expect(s.tutorial.unlockedTabs).toEqual(['Domus']);

    reachTrain();
    useGameStore.getState().trainCharacter(s.family.find(c => c.isPlayer)!.id, 'rhetoric');
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.unlockedTabs).toEqual(['Domus', 'Forum']);
  });
});
