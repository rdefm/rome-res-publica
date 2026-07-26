// Tutorial redesign, Chunk T5a — integration coverage for the prologue's
// real authored content (Acts I-IV). Drives the actual store actions a
// player would trigger from each screen, not synthetic fixtures — this is
// the same guided run a real session would produce, one step at a time.
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

/** Advance to Act I's completion step (5 taps from act1.intro). */
function reachAct1Train() {
  tapThrough(5);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act1.train');
}

/** Train, then advance once (director's move once satisfied) into Act II.
 *  Trains martial (cost 12 Fides from level 3), not rhetoric (cost 21 from
 *  level 6) — leaves enough Fides for Act II's alternate-action regression
 *  test (buyInfluence, 10 Fides) below; the real narration leaves the skill
 *  choice up to the player either way. */
function completeAct1() {
  reachAct1Train();
  const player = useGameStore.getState().family.find(c => c.isPlayer)!;
  useGameStore.getState().trainCharacter(player.id, 'martial');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act2.intro');
}

function reachAct2CourtFlaccus() {
  completeAct1();
  tapThrough(5);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act2.court-flaccus');
}

function completeAct2() {
  reachAct2CourtFlaccus();
  useGameStore.getState().inviteToDinner('valerius-flaccus');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act3.intro');
}

function reachAct3Vote() {
  completeAct2();
  tapThrough(4);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act3.vote');
}

function completeAct3() {
  reachAct3Vote();
  useGameStore.getState().voteBill('start-2', 'vote_for');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act4.intro');
}

function reachAct4BuyAsset() {
  completeAct3();
  tapThrough(5);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act4.buy-asset');
}

describe('prologue script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('Acts I-IV are present with a reasonable step count each', () => {
    const ids = TUTORIAL_ARCS.prologue.steps.map(s => s.id);
    for (const act of ['act1', 'act2', 'act3', 'act4']) {
      const count = ids.filter(id => id.startsWith(`prologue.${act}.`)).length;
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(9);
    }
  });

  test('every act ends with an unlocksTab, in the right order', () => {
    const steps = TUTORIAL_ARCS.prologue.steps;
    const unlocks = steps.filter(s => s.unlocksTab).map(s => s.unlocksTab);
    expect(unlocks).toEqual(['Forum', 'Curia', 'Provinciae', 'Cursus']);
  });
});

describe('guided run — Acts I-IV end to end', () => {
  beforeEach(() => {
    useGameStore.getState().startGame('guided');
  });

  test('Act I: training a skill on Marcus completes the act and unseals Forum', () => {
    reachAct1Train();
    let s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    const player = s.family.find(c => c.isPlayer)!;
    useGameStore.getState().trainCharacter(player.id, 'rhetoric');
    s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('prologue.act2.intro');
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum']);
  });

  test('Act II: courting Flaccus via ANY real action (not just the spotlighted one) completes the act and unseals Curia', () => {
    reachAct2CourtFlaccus();
    let s = useGameStore.getState();
    const before = s.clans.flatMap(c => c.leaders).find(l => l.id === 'valerius-flaccus')!.relationship;

    useGameStore.getState().buyInfluence('valerius-flaccus'); // deliberately not Invite to Dinner
    s = useGameStore.getState();
    const after = s.clans.flatMap(c => c.leaders).find(l => l.id === 'valerius-flaccus')!.relationship;
    expect(after).toBeGreaterThan(before);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.stepId).toBe('prologue.act3.intro');
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Curia']);
  });

  test('Act III: voting Bellum Punicum moves the War crisis track and unseals Provinciae', () => {
    reachAct3Vote();
    let s = useGameStore.getState();
    const warBefore = s.crisis.war.level;
    const billBefore = s.bills.find(b => b.id === 'start-2')!.support;

    useGameStore.getState().voteBill('start-2', 'vote_for');
    s = useGameStore.getState();
    expect(s.bills.find(b => b.id === 'start-2')!.support).toBe(billBefore + 15);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.crisis.war.level).toBe(warBefore - 10); // act3MoveWarTrack's crisis-war-10
    expect(s.tutorial.stepId).toBe('prologue.act4.intro');
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Curia', 'Provinciae']);
  });

  test('Act IV: buying any asset in Campania completes the prologue and unseals Cursus', () => {
    reachAct4BuyAsset();
    let s = useGameStore.getState();
    expect(s.cities.find(c => c.id === 'campania')?.ownedAssets ?? []).toEqual([]);
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    useGameStore.getState().purchaseAsset('campania', 'campania_holiday_estate');
    s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBeNull();
    expect(s.tutorial.completedArcs).toEqual(['prologue']);
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Curia', 'Provinciae', 'Cursus']);
  });

  test('sealed tabs are actually sealed until each act completes', () => {
    let s = useGameStore.getState();
    expect(s.tutorial.unlockedTabs).toEqual(['Domus']);

    reachAct1Train();
    useGameStore.getState().trainCharacter(s.family.find(c => c.isPlayer)!.id, 'rhetoric');
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.unlockedTabs).toEqual(['Domus', 'Forum']);
  });
});
