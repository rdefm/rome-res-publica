// Tutorial redesign, Chunks T5a (Acts I-IV) + T5b (Act V) — integration
// coverage for the prologue's real authored content. Drives the actual
// store actions a player would trigger from each screen, not synthetic
// fixtures — this is the same guided run a real session would produce,
// one step at a time.
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
import { isDeterred } from '../src/engine/secretEngine';
import { CLAUDIUS_LEADER_ID } from '../src/data/claudiusArc';

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

function completeAct4() {
  reachAct4BuyAsset();
  useGameStore.getState().purchaseAsset('campania', 'campania_holiday_estate');
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.intro');
}

function reachAct5Declare() {
  completeAct4();
  tapThrough(2);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.declare');
}

function completeAct5Declare() {
  reachAct5Declare();
  useGameStore.getState().declareCampaign('quaestor' as any);
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.canvass-intro');
}

function reachAct5Canvass() {
  completeAct5Declare();
  tapThrough(1);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.canvass');
}

/** Canvassing has a real (usually-favourable, not guaranteed) RNG roll —
 *  retries up to 5 times, same as a real player just tapping again. */
function canvassFlaccusUntilLocked() {
  let guard = 0;
  while (useGameStore.getState().campaignVotes['valerius-flaccus'] !== 'for' && guard < 5) {
    guard++;
    useGameStore.getState().canvassLeader('valerius-flaccus');
    const s = useGameStore.getState();
    if (s.activeCanvassingEvent) {
      const ev = s.activeCanvassingEvent as any;
      const optId = ev.choices?.[0]?.id ?? ev.options?.[0]?.id;
      if (optId) useGameStore.getState().resolveCanvassingEvent(optId);
    }
  }
}

function completeAct5Canvass() {
  reachAct5Canvass();
  canvassFlaccusUntilLocked();
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.end-season-intro');
}

function reachAct5WaitForElection() {
  completeAct5Canvass();
  tapThrough(1);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.wait-for-election');
}

/** endSeason() repeatedly until the election resolves (Winter crossing). */
function endSeasonsUntilElectionResolves() {
  let guard = 0;
  while (!isStepSatisfied(currentStep(), useGameStore.getState()) && guard < 6) {
    useGameStore.getState().endSeason();
    useGameStore.getState().dismissSeasonOverlay();
    guard++;
  }
}

function completeAct5WaitForElection() {
  reachAct5WaitForElection();
  endSeasonsUntilElectionResolves();
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.audit-intro');
}

function reachAct5Audit() {
  completeAct5WaitForElection();
  tapThrough(1);
  expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.audit');
}

describe('prologue script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('Acts I-V are present with a reasonable step count each', () => {
    const ids = TUTORIAL_ARCS.prologue.steps.map(s => s.id);
    for (const act of ['act1', 'act2', 'act3', 'act4', 'act5']) {
      const count = ids.filter(id => id.startsWith(`prologue.${act}.`)).length;
      expect(count).toBeGreaterThanOrEqual(5);
      expect(count).toBeLessThanOrEqual(10); // Act V ("why all of it existed") runs a beat longer
    }
  });

  test('every act except the last ends with an unlocksTab, in the right order', () => {
    const steps = TUTORIAL_ARCS.prologue.steps;
    const unlocks = steps.filter(s => s.unlocksTab).map(s => s.unlocksTab);
    expect(unlocks).toEqual(['Forum', 'Curia', 'Provinciae', 'Cursus']);
  });

  test('the arc\'s last step is Act V\'s closing beat', () => {
    const steps = TUTORIAL_ARCS.prologue.steps;
    expect(steps[steps.length - 1].id).toBe('prologue.act5.standoff');
  });
});

describe('guided run — Acts I-V end to end', () => {
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

  test('Act IV: buying any asset in Campania completes the act and unseals Cursus (the prologue itself is not done yet — Act V remains)', () => {
    reachAct4BuyAsset();
    let s = useGameStore.getState();
    expect(s.cities.find(c => c.id === 'campania')?.ownedAssets ?? []).toEqual([]);
    expect(isStepSatisfied(currentStep(), s)).toBe(false);

    useGameStore.getState().purchaseAsset('campania', 'campania_holiday_estate');
    s = useGameStore.getState();
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('prologue'); // still active — Act V is next
    expect(s.tutorial.stepId).toBe('prologue.act5.intro');
    expect(s.tutorial.unlockedTabs).toEqual(['Domus', 'Forum', 'Curia', 'Provinciae', 'Cursus']);
  });

  test('Act V: declares Quaestor, canvasses Flaccus, wins the election, and audits Claudius into a mutual standoff — completing the whole prologue', () => {
    reachAct5Declare();

    // Declare
    useGameStore.getState().declareCampaign('quaestor' as any);
    let s = useGameStore.getState();
    expect(s.campaigning).toBe('quaestor');
    expect(isStepSatisfied(currentStep(), s)).toBe(true);
    useGameStore.getState().advanceTutorialStep();

    // Canvass Flaccus (real RNG roll — retried on failure, same as a player tapping again)
    tapThrough(1); // canvass-intro -> canvass
    canvassFlaccusUntilLocked();
    s = useGameStore.getState();
    expect(s.campaignVotes['valerius-flaccus']).toBe('for');
    expect(isStepSatisfied(currentStep(), s)).toBe(true);
    useGameStore.getState().advanceTutorialStep();

    // End seasons until the election resolves at the Winter crossing
    tapThrough(1); // end-season-intro -> wait-for-election
    endSeasonsUntilElectionResolves();
    s = useGameStore.getState();
    expect(s.heldOffices).toContain('quaestor');
    expect(isStepSatisfied(currentStep(), s)).toBe(true);
    useGameStore.getState().advanceTutorialStep();

    // Audit Claudius specifically — force success deterministically to
    // assert the standoff mechanism itself, not re-litigate calcAuditChance
    // (already covered by secretEngine.test.ts/officeAction.test.ts).
    tapThrough(1); // audit-intro -> audit
    s = useGameStore.getState();
    expect(isDeterred(CLAUDIUS_LEADER_ID, s.secrets)).toBe(false);
    const player = s.family.find(c => c.isPlayer)!;
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    useGameStore.getState().takeOfficeAction('audit-rival', player.id, { leaderId: CLAUDIUS_LEADER_ID });
    randomSpy.mockRestore();

    s = useGameStore.getState();
    expect(isDeterred(CLAUDIUS_LEADER_ID, s.secrets)).toBe(true);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);
    useGameStore.getState().advanceTutorialStep(); // audit -> standoff (closing narration)
    expect(useGameStore.getState().tutorial.stepId).toBe('prologue.act5.standoff');

    useGameStore.getState().advanceTutorialStep(); // standoff's own tap -> prologue complete, auto-chains into embassy
    s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('embassy');
    expect(s.tutorial.stepId).toBe('embassy.intro');
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
