// Tutorial redesign, Chunk T8 — integration coverage for the war arc's real
// authored content. Same discipline as tutorialEmbassyArc.test.ts: drives
// real store actions, not synthetic fixtures. Jumps straight into the war
// arc via startTutorialArc('war') after startGame — war's own predicates
// never read anything the prologue/embassy arcs would have set beyond
// flags['tutorial-embassy-complete'] (manually set here, standing in for
// embassy's own completion, which tutorialEmbassyArc.test.ts already covers
// end-to-end on its own).

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore } from '../src/state/gameStore';
import { validateTutorialScript, getStep, isStepSatisfied, TUTORIAL_CARTHAGE_GARRISON_ID } from '../src/engine/tutorialEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';
import { getEventDef } from '../src/engine/eventEngine';

function tapThrough(n: number) {
  for (let i = 0; i < n; i++) useGameStore.getState().advanceTutorialStep();
}

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

function playerArmy() {
  return useGameStore.getState().armies.find(a => a.owner === 'player')!;
}

/** Ends seasons, resolving whatever event pops up each time (evt-messana-appeal
 *  deterministically via 'answer-the-call'; anything else via the same
 *  guaranteed-first-choice fallback gameStore's own fast-forward driver uses),
 *  until the given predicate over fresh state holds. */
function endSeasonsUntil(predicate: () => boolean, guardMax = 6) {
  let guard = 0;
  while (!predicate() && guard < guardMax) {
    guard++;
    useGameStore.getState().endSeason();
    useGameStore.getState().dismissSeasonOverlay();
    const active = useGameStore.getState().activeEvent;
    if (active?.defId === 'evt-messana-appeal') {
      useGameStore.getState().resolveEvent('answer-the-call');
    } else if (active) {
      const def = getEventDef(active.defId);
      const choice = def?.choices.find(c => !c.skillCheck) ?? def?.choices[0];
      if (choice) useGameStore.getState().resolveEvent(choice.id);
    }
    let guardEng = 0;
    while (useGameStore.getState().pendingEngagements.length > 0 && guardEng < 5) {
      guardEng++;
      useGameStore.getState().resolveEngagementAbstract(useGameStore.getState().pendingEngagements[0].id);
    }
  }
}

/** generateCommandRivals picks purely by clan influence — a fresh game's
 *  rivals are rarely ones the player has courted, and canvassForCommand
 *  silently no-ops below COMMAND_CANVASS_MIN_RELATIONSHIP (25). Courts
 *  whichever rival is already closest, via buyInfluence (a generic, real
 *  courting action — same "any real action counts" flexibility as Act II). */
function courtEasiestCommandRival() {
  const rivals = useGameStore.getState().commandElection?.rivals ?? [];
  const leaders = useGameStore.getState().clans.flatMap(c => c.leaders);
  const target = rivals
    .map(r => leaders.find(l => l.id === r.id))
    .filter((l): l is NonNullable<typeof l> => !!l)
    .sort((a, b) => b.relationship - a.relationship)[0];
  if (!target) return;
  let guard = 0;
  while (
    (useGameStore.getState().clans.flatMap(c => c.leaders).find(l => l.id === target.id)?.relationship ?? 0) < 25
    && guard < 10
  ) {
    guard++;
    useGameStore.getState().buyInfluence(target.id);
  }
}

/** canvassForCommand doubles its threshold whenever the target's own clan
 *  ALSO fields another rival (calcCanvassRoll's real formula, commandEngine.ts)
 *  — a real possibility since generateCommandRivals picks purely by clan
 *  influence and can draw two rivals from the same clan (as it does in this
 *  fixed fresh-game seed: both Command rivals are Cornelii). That roughly
 *  halves the per-attempt success rate, so this needs a much larger retry
 *  budget than Act V's own canvassing test (a single, undoubled rival) — and
 *  enough Fides to fund that many attempts, topped up directly here since
 *  this test is verifying the SCRIPT's wiring, not re-litigating canvass
 *  balance (already covered by electionEngine/commandEngine's own tests). */
function canvassCommandRivalsUntilLocked() {
  useGameStore.setState({ fides: 500 });
  let guard = 0;
  while (
    !Object.values(useGameStore.getState().commandElection?.votes ?? {}).some(v => v === 'for')
    && guard < 60
  ) {
    guard++;
    const rivals = useGameStore.getState().commandElection?.rivals ?? [];
    for (const rival of rivals) {
      if (Object.values(useGameStore.getState().commandElection?.votes ?? {}).some(v => v === 'for')) break;
      useGameStore.getState().canvassForCommand(rival.id);
    }
    if (rivals.length === 0) break;
  }
}

describe('war script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('war arc has a reasonable step count', () => {
    expect(TUTORIAL_ARCS.war.steps.length).toBeGreaterThanOrEqual(10);
  });

  test('every step is rail: guided (freeze already lifted by the embassy arc)', () => {
    for (const step of TUTORIAL_ARCS.war.steps) {
      expect(step.rail).toBe('guided');
    }
  });

  test('the arc\'s last step carries warSetCompleteFlag', () => {
    const steps = TUTORIAL_ARCS.war.steps;
    expect(steps[steps.length - 1].onCompleteEffectId).toBe('warSetCompleteFlag');
  });
});

describe('guided run — war arc end to end', () => {
  beforeEach(() => {
    useGameStore.getState().startGame('guided');
    // Deliberately does NOT simulate holding Quaestor (Act V's own win) —
    // this test's fresh-start player has no office and no personal imperium,
    // exercising the arc's own warEnsureMusterSanctioned effect (fires on
    // war.command-outcome's entry) rather than depending on state a real
    // player might or might not still have by this point in the story
    // (Quaestor's 4-season term can easily have lapsed already — found
    // while authoring this arc, see that effect's own comment).
    useGameStore.setState({
      flags: { ...useGameStore.getState().flags, 'tutorial-embassy-complete': true },
    });
    useGameStore.getState().startTutorialArc('war');
  });

  test('war, command election, muster, march, and one guided engagement complete the arc', () => {
    expect(useGameStore.getState().tutorial.stepId).toBe('war.intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.wait-for-appeal');
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(false);

    endSeasonsUntil(() => useGameStore.getState().wars.some(w => w.enemyId === 'carthage' && w.active));
    expect(useGameStore.getState().wars.some(w => w.enemyId === 'carthage' && w.active)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.command-intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.propose-vote');

    useGameStore.getState().callCommandVote(null);
    expect(useGameStore.getState().commandElection?.active).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.open-assembly');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.declare-candidate');

    const player = useGameStore.getState().family.find(c => c.isPlayer)!;
    useGameStore.getState().declareCommandCandidate(player.id);
    expect(useGameStore.getState().commandElection?.candidateCharacterId).toBe(player.id);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.canvass-intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.court-rival');

    courtEasiestCommandRival();
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.canvass');

    canvassCommandRivalsUntilLocked();
    expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.end-season-for-vote');

    endSeasonsUntil(() => !useGameStore.getState().commandElection?.active);
    expect(useGameStore.getState().commandElection?.active).toBeFalsy();

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.command-outcome');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.muster-intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.find-campania-region');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.muster');

    useGameStore.getState().raiseTroops('campania', 'standard', null);
    expect(useGameStore.getState().armies.some(a => a.owner === 'player' && a.location === 'campania')).toBe(true);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.assign-commander-intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.assign-commander');

    useGameStore.getState().assignArmyCommander(playerArmy().id, player.id);
    expect(playerArmy().commanderId).toBe(player.id);
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.move-intro');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.issue-order');

    tapThrough(1);
    expect(useGameStore.getState().tutorial.stepId).toBe('war.select-sicilia');
    // onEnterEffectId (warSeedCarthageGarrison) fired the instant this step
    // was entered — the Lilybaeum garrison should already exist.
    expect(useGameStore.getState().armies.some(a => a.id === TUTORIAL_CARTHAGE_GARRISON_ID)).toBe(true);

    useGameStore.getState().issueMovementOrder(playerArmy().id, 'sicilia', false);
    expect(playerArmy().ordersThisSeason?.path).toContain('sicilia');
    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.end-season-for-engagement');

    // Outcome-agnostic on purpose (see engagementResolved's own comment) —
    // a loss falls back to campania, exactly as real as a win reaching
    // sicilia. Either way the player's own commander must have survived
    // (wounded/wounded-or-worse, never killed — this chunk's shield for
    // this one named engagement, since T9 needs Marcus alive as defendant).
    endSeasonsUntil(() =>
      useGameStore.getState().armies.some(a => a.owner === 'player' && !a.ordersThisSeason)
      && useGameStore.getState().pendingEngagements.length === 0,
    );
    expect(['sicilia', 'campania']).toContain(playerArmy().location);
    expect(useGameStore.getState().pendingEngagements.length).toBe(0);
    expect(useGameStore.getState().family.some(c => c.isPlayer)).toBe(true);

    useGameStore.getState().advanceTutorialStep();
    expect(useGameStore.getState().tutorial.stepId).toBe('war.closing');
    expect(useGameStore.getState().flags['tutorial-war-complete']).toBeUndefined();

    // Closing beat's own tap fires warSetCompleteFlag. courts.steps is still
    // empty (T9 not yet authored), so the auto-chain (gameStore's
    // advanceTutorialStep) falls through to idle rather than entering courts.
    useGameStore.getState().advanceTutorialStep();
    const s = useGameStore.getState();
    expect(s.flags['tutorial-war-complete']).toBe(true);
    expect(s.tutorial.completedArcs).toEqual(['war']);
    expect(s.tutorial.activeArc).toBeNull();
  });
});
