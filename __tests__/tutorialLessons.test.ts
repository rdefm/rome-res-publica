// Tutorial redesign, Chunk T10 — just-in-time lessons.
// - getEligibleLesson: pure unit coverage (entry gating, priority order).
// - The natural-mortality step (turnSequencer.ts): both branches now stamp
//   flags['pending-lesson-death'], and a non-paterfamilias death now injects
//   a real notice (evt-family-death-natural, data/successionEvents.ts)
//   instead of a silent log line — a standalone gameplay fix, not just a
//   tutorial dependency (see that EventDef's own comment).
// applySuccession/promoteCadetToParterfamilias's 'pending-lesson-succession'
// stamp is covered in inheritanceEngine.test.ts, alongside their other
// assertions, per this repo's "extend the engine's existing test file"
// convention.
//
// Tutorial rebuild, ticket 02 — lesson-provinciae/lesson-assets added below,
// same getEligibleLesson coverage pattern as lesson-death/lesson-succession,
// plus a new describe block for their own pending-flag stamp (gameStore's
// openedProvinciaeCitySheet/openedAssetPurchaseModal) — the first two
// lessons whose "true trigger" is a component mount rather than engine code,
// so unlike pending-lesson-death/succession there's a callable action to
// test directly rather than a turnSequencer/inheritanceEngine assertion.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';
import { getEligibleLesson } from '../src/engine/tutorialEngine';
import type { Character } from '../src/models/character';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return { ...INITIAL_STATE, gameStarted: true, ...overrides };
}

const IDLE_TUTORIAL: GameState['tutorial'] = {
  activeArc: null, stepId: null, completedArcs: [], unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'], skipped: false,
  replayingArc: null, replayStepId: null,
};

describe('getEligibleLesson — entry gating', () => {
  test('null when an arc/lesson is already active, regardless of other conditions', () => {
    const state = makeState({
      tutorial: { ...IDLE_TUTORIAL, activeArc: 'war', stepId: 'war.intro' },
      trials: [{ id: 't1', status: 'preparing' } as any],
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('null when nothing is pending', () => {
    expect(getEligibleLesson(makeState({ tutorial: IDLE_TUTORIAL }))).toBeNull();
  });

  test('lesson-trial: a trial exists and courts was never completed (Free Start or a skipped guided run)', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      trials: [{ id: 't1', status: 'preparing' } as any],
    });
    expect(getEligibleLesson(state)).toBe('lesson-trial');
  });

  test('lesson-trial: does NOT fire once courts has been completed', () => {
    const state = makeState({
      tutorial: { ...IDLE_TUTORIAL, completedArcs: ['courts'] },
      trials: [{ id: 't1', status: 'preparing' } as any],
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('lesson-trial: does NOT re-fire once already taught', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      trials: [{ id: 't1', status: 'preparing' } as any],
      flags: { 'lesson-trial-taught': true },
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('lesson-battle: activeBattleSetup is set', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      activeBattleSetup: { attackerInput: {}, defenderInput: {}, terrain: {}, seed: 1 } as any,
    });
    expect(getEligibleLesson(state)).toBe('lesson-battle');
  });

  test("lesson-battle: never fires mid-war-arc — the war arc's own scripted engagement takes 'Take the Field' too", () => {
    const state = makeState({
      tutorial: { ...IDLE_TUTORIAL, activeArc: 'war', stepId: 'war.end-season-for-engagement' },
      activeBattleSetup: { attackerInput: {}, defenderInput: {}, terrain: {}, seed: 1 } as any,
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('lesson-death: fires off the durable pending-lesson-death flag', () => {
    const state = makeState({ tutorial: IDLE_TUTORIAL, flags: { 'pending-lesson-death': true } });
    expect(getEligibleLesson(state)).toBe('lesson-death');
  });

  test('lesson-death: does not re-fire once taught, even if the pending flag is still set', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      flags: { 'pending-lesson-death': true, 'lesson-death-taught': true },
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('lesson-succession: fires off the durable pending-lesson-succession flag', () => {
    const state = makeState({ tutorial: IDLE_TUTORIAL, flags: { 'pending-lesson-succession': true } });
    expect(getEligibleLesson(state)).toBe('lesson-succession');
  });

  test('priority order: trial beats battle beats death beats succession when several are pending at once', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      trials: [{ id: 't1', status: 'preparing' } as any],
      activeBattleSetup: { attackerInput: {}, defenderInput: {}, terrain: {}, seed: 1 } as any,
      flags: { 'pending-lesson-death': true, 'pending-lesson-succession': true },
    });
    expect(getEligibleLesson(state)).toBe('lesson-trial');
  });

  // Tutorial rebuild, ticket 02 — lesson-provinciae/lesson-assets. The
  // pending flag's real source is a component mount (CitySheet.tsx /
  // HoldingsModal.tsx via gameStore's openedProvinciaeCitySheet/
  // openedAssetPurchaseModal, covered in the store-action describe block
  // below), but getEligibleLesson itself only ever sees the flag — same
  // as lesson-death/lesson-succession above.
  test('lesson-provinciae: fires off the durable pending-lesson-provinciae flag', () => {
    const state = makeState({ tutorial: IDLE_TUTORIAL, flags: { 'pending-lesson-provinciae': true } });
    expect(getEligibleLesson(state)).toBe('lesson-provinciae');
  });

  test('lesson-provinciae: does not re-fire once taught, even if the pending flag is still set', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      flags: { 'pending-lesson-provinciae': true, 'lesson-provinciae-taught': true },
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('lesson-assets: fires off the durable pending-lesson-assets flag', () => {
    const state = makeState({ tutorial: IDLE_TUTORIAL, flags: { 'pending-lesson-assets': true } });
    expect(getEligibleLesson(state)).toBe('lesson-assets');
  });

  test('lesson-assets: does not re-fire once taught, even if the pending flag is still set', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      flags: { 'pending-lesson-assets': true, 'lesson-assets-taught': true },
    });
    expect(getEligibleLesson(state)).toBeNull();
  });

  test('priority order: provinciae beats assets when both are pending', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      flags: { 'pending-lesson-provinciae': true, 'pending-lesson-assets': true },
    });
    expect(getEligibleLesson(state)).toBe('lesson-provinciae');
  });

  test('priority order: death still beats provinciae/assets when several are pending at once', () => {
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      flags: {
        'pending-lesson-death': true,
        'pending-lesson-provinciae': true,
        'pending-lesson-assets': true,
      },
    });
    expect(getEligibleLesson(state)).toBe('lesson-death');
  });
});

describe('openedProvinciaeCitySheet / openedAssetPurchaseModal — UI-mount trigger actions', () => {
  beforeEach(() => {
    useGameStore.setState({ ...INITIAL_STATE, gameStarted: true });
  });

  test('openedProvinciaeCitySheet stamps pending-lesson-provinciae', () => {
    useGameStore.getState().openedProvinciaeCitySheet();
    expect(useGameStore.getState().flags['pending-lesson-provinciae']).toBe(true);
  });

  test('openedProvinciaeCitySheet no-ops once lesson-provinciae is already taught', () => {
    useGameStore.setState({ flags: { 'lesson-provinciae-taught': true } });
    useGameStore.getState().openedProvinciaeCitySheet();
    expect(useGameStore.getState().flags['pending-lesson-provinciae']).toBeUndefined();
  });

  test('openedAssetPurchaseModal stamps pending-lesson-assets', () => {
    useGameStore.getState().openedAssetPurchaseModal();
    expect(useGameStore.getState().flags['pending-lesson-assets']).toBe(true);
  });

  test('openedAssetPurchaseModal no-ops once lesson-assets is already taught', () => {
    useGameStore.setState({ flags: { 'lesson-assets-taught': true } });
    useGameStore.getState().openedAssetPurchaseModal();
    expect(useGameStore.getState().flags['pending-lesson-assets']).toBeUndefined();
  });
});

describe('natural mortality step — T10 additions', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });

  function makeCharacter(overrides: Partial<Character> = {}): Character {
    return {
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
      skills: { rhetoric: 6, martial: 3, intrigus: 4 },
      traits: [], ambition: null, relationship: 100, familyTrust: 100,
      officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
      formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
      ...overrides,
    };
  }

  test('a non-paterfamilias natural death injects evt-family-death-natural and stamps pending-lesson-death', () => {
    Math.random = () => 0; // guarantees rollsDead() for whoever aged.find() reaches first
    const spouse = makeCharacter({ id: 'spouse-1', name: 'Livia', role: 'spouse', isPlayer: false, age: 40 });
    const player = makeCharacter({ id: 'pc-1', name: 'Marcus', isPlayer: true, age: 42 });
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      family: [spouse, player], // spouse first — aged.find picks her, not the player
      seasonIndex: 3, // Winter -> crossedNewYear
      pendingSuccession: null,
    });

    const { nextState } = processSeason(state);

    expect(nextState.family.some(c => c.id === 'spouse-1')).toBe(false);
    expect(nextState.pendingSuccession).toBeNull();
    expect(nextState.flags['pending-lesson-death']).toBe(true);
    const notice = nextState.pendingEvents.find(e => e.defId === 'evt-family-death-natural');
    expect(notice).toBeDefined();
    expect(notice!.targetCharacterId).toBe('spouse-1');
    expect(notice!.bodyText).toContain('Livia');
  });

  test('a paterfamilias natural death still fires the existing evt-succession-death chain, and ALSO stamps pending-lesson-death', () => {
    Math.random = () => 0;
    const player = makeCharacter({ id: 'pc-1', name: 'Marcus', isPlayer: true, age: 42 });
    // A living heir is required for detectPaterfamiliasDeath/getHeirOrder to
    // take the plain evt-succession-death path rather than the no-heir/
    // cadet-continuation branch (inheritanceEngine.test.ts's own
    // resolveDeathNotice tests cover that branch already).
    const son = makeCharacter({ id: 'son-1', name: 'Gaius', role: 'son', isPlayer: false, age: 18 });
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      family: [player, son],
      seasonIndex: 3,
      pendingSuccession: null,
    });

    const { nextState } = processSeason(state);

    expect(nextState.pendingSuccession).not.toBeNull();
    expect(nextState.flags['pending-lesson-death']).toBe(true);
    expect(nextState.pendingEvents.some(e => e.defId === 'evt-succession-death')).toBe(true);
    expect(nextState.pendingEvents.some(e => e.defId === 'evt-family-death-natural')).toBe(false);
  });

  test('no death this season: pending-lesson-death is not stamped', () => {
    const player = makeCharacter({ id: 'pc-1', isPlayer: true, age: 20 });
    const state = makeState({
      tutorial: IDLE_TUTORIAL,
      family: [player],
      seasonIndex: 0, // not a year rollover
    });
    const { nextState } = processSeason(state);
    expect(nextState.flags['pending-lesson-death']).toBeUndefined();
  });
});
