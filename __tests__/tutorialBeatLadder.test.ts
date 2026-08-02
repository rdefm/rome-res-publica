// Tutorial rebuild, ticket 06 — integration coverage for Beat III: The
// Ladder. Same discipline as tutorialBeatChamber.test.ts: drives real store
// actions, not synthetic fixtures. Jumps straight into 'beat-ladder' via
// startTutorialArc after startGame (same "skipping earlier content is safe"
// convention tutorialWarArc/tutorialCourtsArc.test.ts already use) — this
// beat's own predicates never read anything beat-house/beat-chamber's steps
// would have set.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import {
  validateTutorialScript, getStep, isStepSatisfied,
  isWorldCategoryFrozen, isCuratedEventPoolActive,
} from '../src/engine/tutorialEngine';
import { nextEligibleElectionTurns } from '../src/engine/ambitionEngine';
import { TUTORIAL_ARCS } from '../src/data/tutorialScript';
import { isDeterred } from '../src/engine/secretEngine';
import { CLAUDIUS_LEADER_ID } from '../src/data/claudiusArc';
import { processSeason } from '../src/engine/turnSequencer';

function tapThrough(n: number) {
  for (let i = 0; i < n; i++) useGameStore.getState().advanceTutorialStep();
}

function currentStep() {
  const s = useGameStore.getState();
  return getStep(s.tutorial.stepId!)!;
}

function tutorialAmbition() {
  return useGameStore.getState().ambitions.find(a => a.source === 'tutorial')!;
}

function enterBeatLadder() {
  useGameStore.getState().startGame('guided');
  useGameStore.getState().startTutorialArc('beat-ladder');
}

/** Canvassing has a real (usually-favourable, not guaranteed) RNG roll —
 *  retries up to 12 times, same as a real player just tapping again. Same
 *  pre-existing, documented flake as the old Act V test this ports
 *  (tutorial-rebuild-plan.md §4). */
function canvassFlaccusUntilLocked() {
  let guard = 0;
  while (useGameStore.getState().campaignVotes['valerius-flaccus'] !== 'for' && guard < 12) {
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

/** endSeason() repeatedly until the given predicate over fresh state holds,
 *  dismissing whatever pops up (same tolerant pattern tutorialBeatChamber/
 *  tutorialWarArc/tutorialCourtsArc.test.ts already use). */
function endSeasonsUntil(predicate: () => boolean, guardMax = 6) {
  let guard = 0;
  while (!predicate() && guard < guardMax) {
    guard++;
    useGameStore.getState().endSeason();
    useGameStore.getState().dismissSeasonOverlay();
    const active = useGameStore.getState().activeEvent;
    if (active) {
      // Guaranteed-first-choice fallback — same as tutorialBeatChamber.test.ts.
      const { getEventDef } = require('../src/engine/eventEngine');
      const def = getEventDef(active.defId);
      const choice = def?.choices.find((c: any) => !c.skillCheck) ?? def?.choices[0];
      if (choice) useGameStore.getState().resolveEvent(choice.id);
    }
  }
}

function reachDeclare() {
  enterBeatLadder();
  tapThrough(2); // intro -> find-quaestor -> declare
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.declare');
}

function completeDeclare() {
  reachDeclare();
  useGameStore.getState().declareCampaign('quaestor' as any);
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.canvass-intro');
}

function reachCanvass() {
  completeDeclare();
  tapThrough(1);
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.canvass');
}

function completeCanvass() {
  reachCanvass();
  canvassFlaccusUntilLocked();
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.end-season-intro');
}

function reachWaitForElection() {
  completeCanvass();
  tapThrough(1);
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.wait-for-election');
}

function completeWaitForElection() {
  reachWaitForElection();
  endSeasonsUntil(() => isStepSatisfied(currentStep(), useGameStore.getState()));
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep();
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.audit-intro');
}

/** Reaches beat-ladder.goal with Quaestor won, Claudius deterred, and the
 *  standoff acknowledged — the teach portion's full deterministic sequence. */
function completeTeach() {
  completeWaitForElection();
  tapThrough(1); // audit-intro -> audit

  const player = useGameStore.getState().family.find(c => c.isPlayer)!;
  const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
  useGameStore.getState().takeOfficeAction('audit-rival', player.id, { leaderId: CLAUDIUS_LEADER_ID });
  randomSpy.mockRestore();

  expect(isDeterred(CLAUDIUS_LEADER_ID, useGameStore.getState().secrets)).toBe(true);
  expect(isStepSatisfied(currentStep(), useGameStore.getState())).toBe(true);
  useGameStore.getState().advanceTutorialStep(); // audit -> standoff
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.standoff');
  useGameStore.getState().advanceTutorialStep(); // standoff -> goal
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.goal');
}

function reachSandbox() {
  completeTeach();
  useGameStore.getState().advanceTutorialStep(); // goal's own tap -> ladderSetAmbition fires
  expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.sandbox');
}

describe('beat-ladder script — structural sanity', () => {
  test('validateTutorialScript passes on the real authored content', () => {
    expect(() => validateTutorialScript()).not.toThrow();
  });

  test('beat-ladder has a reasonable step count', () => {
    expect(TUTORIAL_ARCS['beat-ladder'].steps.length).toBeGreaterThanOrEqual(10);
  });

  test('the arc has no unlocksTab of its own (Cursus unlocks off beat-chamber.philon-handoff)', () => {
    const steps = TUTORIAL_ARCS['beat-ladder'].steps;
    expect(steps.filter(s => s.unlocksTab)).toEqual([]);
  });

  test('the goal step sets the ambition; the sandbox step waits on either outcome; the arc\'s last step marks completion', () => {
    const steps = TUTORIAL_ARCS['beat-ladder'].steps;
    const goal = steps.find(s => s.id === 'beat-ladder.goal')!;
    const sandbox = steps.find(s => s.id === 'beat-ladder.sandbox')!;
    const last = steps[steps.length - 1];
    expect(goal.onCompleteEffectId).toBe('ladderSetAmbition');
    expect(sandbox.advance).toEqual({ kind: 'predicate', predicateId: 'ladderAmbitionResolved' });
    expect(sandbox.rail).toBe('guided');
    expect(last.id).toBe('beat-ladder.closing');
    expect(last.onCompleteEffectId).toBe('ladderSetCompleteFlag');
  });
});

describe('world gate — beat-ladder is a wider thaw than beat-chamber', () => {
  const LADDER_TUTORIAL: GameState['tutorial'] = {
    activeArc: 'beat-ladder', stepId: 'beat-ladder.sandbox', completedArcs: ['beat-house', 'beat-chamber'],
    unlockedTabs: ['Domus', 'Forum', 'Curia', 'Provinciae', 'Cursus'], skipped: false,
  };

  test('randomEvents, crisisDrift, passiveBills, claudiusDemands, births, mortality are OPEN', () => {
    const s = { ...INITIAL_STATE, gameStarted: true, tutorial: LADDER_TUTORIAL };
    for (const category of ['randomEvents', 'crisisDrift', 'passiveBills', 'claudiusDemands', 'births', 'mortality'] as const) {
      expect(isWorldCategoryFrozen(s, category)).toBe(false);
    }
  });

  test('warIgnition and foreignWarDeclarations stay FROZEN', () => {
    const s = { ...INITIAL_STATE, gameStarted: true, tutorial: LADDER_TUTORIAL };
    expect(isWorldCategoryFrozen(s, 'warIgnition')).toBe(true);
    expect(isWorldCategoryFrozen(s, 'foreignWarDeclarations')).toBe(true);
  });

  test('isCuratedEventPoolActive is false — beat-ladder draws from the full, uncurated event pool', () => {
    const s = { ...INITIAL_STATE, gameStarted: true, tutorial: LADDER_TUTORIAL };
    expect(isCuratedEventPoolActive(s)).toBe(false);
  });

  // Ticket 06's own implementation note (from ticket 01's review): "Add a
  // regression test (same pattern as tutorialWorldFreeze.test.ts's
  // war-ignition case) confirming Messana/Carthage still cannot ignite
  // during Beat III's sandbox even with the full event pool live." Same
  // "frozen / not frozen (regression guard)" pairing as
  // tutorialWorldFreeze.test.ts's own randomEvents/warIgnition describe
  // block and tutorialBeatChamber.test.ts's identical block for Beat II —
  // unlike Beat II, beat-ladder's randomEvents is fully open (not curated),
  // so this is the one place a naive "randomEvents open => everything's
  // fair game" reading could wrongly let the forced evt-messana-appeal
  // branch jump the gun on the still-unrun scripted Embassy arc.
  describe('evt-messana-appeal cannot fire during Beat III\'s sandbox', () => {
    function makeState(overrides: Partial<GameState> = {}): GameState {
      return {
        ...INITIAL_STATE, gameStarted: true,
        tutorial: LADDER_TUTORIAL,
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

    // No "not frozen" regression-guard counterpart here — same reasoning as
    // tutorialBeatChamber.test.ts's identical omission: already covered by
    // tutorialWorldFreeze.test.ts's own randomEvents/warIgnition describe
    // block, and an activeArc: null state's own (small but real) chance of
    // a foreignWarDeclarations-driven war is an unrelated flake this file
    // doesn't need to inherit just to re-prove behavior covered elsewhere.
  });
});

describe('guided run — Beat III: The Ladder, teach portion', () => {
  beforeEach(() => {
    enterBeatLadder();
  });

  test('a fresh entry begins at beat-ladder.intro, requiring Cursus', () => {
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-ladder');
    expect(s.tutorial.stepId).toBe('beat-ladder.intro');
  });

  test('declares Quaestor, canvasses Flaccus, wins the election, and audits Claudius into a mutual standoff', () => {
    completeTeach();
    const s = useGameStore.getState();
    expect(s.heldOffices).toContain('quaestor');
    expect(isDeterred(CLAUDIUS_LEADER_ID, s.secrets)).toBe(true);
  });
});

describe('guided run — Beat III: The Ladder, goal + sandbox', () => {
  beforeEach(() => {
    enterBeatLadder();
  });

  test('the goal step grants a real, non-refusable, character-scoped "office_held" (Aedile) ambition with a real Winter deadline', () => {
    completeTeach();
    expect(useGameStore.getState().ambitions).toEqual([]);
    const s0 = useGameStore.getState();
    const expectedDeadline = nextEligibleElectionTurns('aedile', s0)[0];
    const player = s0.family.find(c => c.isPlayer)!;

    useGameStore.getState().advanceTutorialStep(); // goal's own tap -> ladderSetAmbition fires
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.sandbox');

    const ambition = tutorialAmbition();
    expect(ambition.scope).toBe('character');
    expect(ambition.assignedCharacterId).toBe(player.id);
    expect(ambition.criterion).toEqual({ id: 'office_held', officeId: 'aedile' });
    expect(ambition.deadlineTurn).toBe(expectedDeadline);
    expect(ambition.refusable).toBe(false);
    expect(ambition.status).toBe('active');
  });

  test('met path: winning the Aedile election resolves the ambition and advances into the prologue (Act IV)', () => {
    reachSandbox();

    // Simulate a well-canvassed field (the outcome of real canvassing, not a
    // replayed dice-roll per leader — same "known-favourable inputs, not a
    // fully-simulated RNG chain" convention as beat-chamber's own met-path
    // test, which relies on a bill's already-known support rather than
    // replaying a passive resolution): lock every clan leader's vote,
    // dwarfing any single eligible rival's own NPC score.
    const allLeaderIds = useGameStore.getState().clans.flatMap(c => c.leaders.map(l => l.id));
    useGameStore.getState().declareCampaign('aedile' as any);
    useGameStore.setState({
      campaignVotes: Object.fromEntries(allLeaderIds.map(id => [id, 'for' as const])),
    });

    endSeasonsUntil(() => tutorialAmbition().status !== 'active');
    const s = useGameStore.getState();
    expect(s.currentOffice).toBe('aedile');
    expect(tutorialAmbition().status).toBe('completed');
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep(); // sandbox -> closing
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.closing');

    useGameStore.getState().advanceTutorialStep(); // closing's own tap -> ladderSetCompleteFlag, auto-chains
    const s2 = useGameStore.getState();
    expect(s2.flags['tutorial-ladder-complete']).toBe(true);
    expect(s2.tutorial.activeArc).toBe('prologue');
    expect(s2.tutorial.stepId).toBe('prologue.act4.intro');
    expect(s2.tutorial.completedArcs).toEqual(['beat-ladder']);
  });

  test('missed path: never declaring for Aedile lets the deadline pass, resolving the ambition failed (capped Dignitas ding), still advances the beat — never blocks or retries', () => {
    reachSandbox();
    useGameStore.setState({ lifetimeDignitas: 20 }); // nonzero so the ding is visible
    const dignitasBefore = useGameStore.getState().lifetimeDignitas;
    const deadlineTurn = tutorialAmbition().deadlineTurn!;

    // Deliberately never declares — the ambition can only resolve via the
    // deadline here.
    endSeasonsUntil(() => useGameStore.getState().turnNumber >= deadlineTurn, 12);

    const s = useGameStore.getState();
    const ambition = tutorialAmbition();
    expect(ambition.status).toBe('failed');
    expect(s.lifetimeDignitas).toBeLessThan(dignitasBefore);
    expect(isStepSatisfied(currentStep(), s)).toBe(true);

    useGameStore.getState().advanceTutorialStep(); // sandbox -> closing
    expect(useGameStore.getState().tutorial.stepId).toBe('beat-ladder.closing');
    useGameStore.getState().advanceTutorialStep(); // closing -> ladderSetCompleteFlag, auto-chains

    const s2 = useGameStore.getState();
    expect(s2.flags['tutorial-ladder-complete']).toBe(true);
    expect(s2.tutorial.activeArc).toBe('prologue');
    expect(s2.tutorial.stepId).toBe('prologue.act4.intro');
  });

  afterEach(() => useGameStore.setState(INITIAL_STATE));
});
