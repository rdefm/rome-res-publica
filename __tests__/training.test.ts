import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { calcTrainingCost } from '../src/engine/resourceEngine';
import { BALANCE } from '../src/data/balance';

// ─── trainCharacter store action (P2-C, roll mechanic added by the Family
// House rework) ────────────────────────────────────────────────────────────
// Escalating-cost, once-per-season training that now rolls for success
// (houseEngine.rollTraining — tested directly in houseEngine.test.ts).
// Math.random is mocked here since trainCharacter calls it internally rather
// than accepting an externalized roll. Tested directly against the Zustand
// store since the validation now lives in the action itself (calcTrainingCost
// supplies the shared cost math, tested separately in engine.test.ts).

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    family: [
      {
        id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
        skills: { rhetoric: 6, martial: 3, intrigus: 4 },
        traits: [], ambition: null, relationship: 100, familyTrust: 100,
        officeId: null, corruptionScore: 0,
        inheritedTraits: [], ambitionIds: [], reputationScores: {},
        formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
      },
    ] as any,
    fides: 100,
    trainedThisSeason: [],
    log: [],
    ...overrides,
  } as any);
}

describe('trainCharacter', () => {
  beforeEach(() => resetStore());
  afterEach(() => jest.restoreAllMocks());

  test('a low roll succeeds and increments the skill', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // always under the success chance
    const before = useGameStore.getState().family[0].skills.rhetoric;
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    const after = useGameStore.getState().family[0].skills.rhetoric;
    expect(after).toBe(before + 1);
  });

  test('a high roll fails — no skill gain, but Fides is still spent', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999); // always over the success chance
    const before = useGameStore.getState();
    const beforeSkill = before.family[0].skills.rhetoric;
    const expectedCost = calcTrainingCost(beforeSkill);
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    const after = useGameStore.getState();
    expect(after.family[0].skills.rhetoric).toBe(beforeSkill); // unchanged
    expect(before.fides - after.fides).toBe(expectedCost);     // spent regardless
    expect(after.trainedThisSeason).toContain('pc-1');          // the attempt still counts
  });

  test('a built Study room raises the success chance (fails without one, succeeds with one, same roll)', () => {
    const marginalRoll = BALANCE.house.studyRollBaseChance
      - 6 * BALANCE.house.studyRollDifficultyPerPoint // rhetoric starts at 6 in this fixture
      + 0.01; // just above the no-Study chance, just below the with-Study chance
    jest.spyOn(Math, 'random').mockReturnValue(marginalRoll);

    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    expect(useGameStore.getState().family[0].skills.rhetoric).toBe(6); // failed, no Study

    resetStore({ house: { ...INITIAL_STATE.house, builtRooms: ['study'] } } as any);
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    expect(useGameStore.getState().family[0].skills.rhetoric).toBe(7); // succeeded, with Study
  });

  test('cost is deducted per calcTrainingCost(currentLevel), regardless of roll outcome', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.999); // pin to a failure — cost is still charged
    const before = useGameStore.getState();
    const currentLevel = before.family[0].skills.rhetoric;
    const expectedCost = calcTrainingCost(currentLevel);
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    const after = useGameStore.getState();
    expect(before.fides - after.fides).toBe(expectedCost);
  });

  test('a character cannot train twice in the same season', () => {
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    const afterFirst = useGameStore.getState().family[0].skills.rhetoric;
    const fidesAfterFirst = useGameStore.getState().fides;

    useGameStore.getState().trainCharacter('pc-1', 'martial'); // even a different skill
    const afterSecond = useGameStore.getState();

    expect(afterSecond.family[0].skills.rhetoric).toBe(afterFirst); // unchanged
    expect(afterSecond.family[0].skills.martial).toBe(3);            // unchanged
    expect(afterSecond.fides).toBe(fidesAfterFirst);                 // no further deduction
  });

  test('training refuses when unaffordable', () => {
    resetStore({ fides: 0 } as any);
    const before = useGameStore.getState().family[0].skills.rhetoric;
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    const after = useGameStore.getState();
    expect(after.family[0].skills.rhetoric).toBe(before);
    expect(after.trainedThisSeason).not.toContain('pc-1');
  });

  test('training refuses at the skill cap', () => {
    resetStore({
      family: [
        {
          id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
          skills: { rhetoric: BALANCE.training.skillCap, martial: 3, intrigus: 4 },
          traits: [], ambition: null, relationship: 100, familyTrust: 100,
          officeId: null, corruptionScore: 0,
          inheritedTraits: [], ambitionIds: [], reputationScores: {},
          formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
        },
      ] as any,
    } as any);
    const fidesBefore = useGameStore.getState().fides;
    useGameStore.getState().trainCharacter('pc-1', 'rhetoric');
    const after = useGameStore.getState();
    expect(after.family[0].skills.rhetoric).toBe(BALANCE.training.skillCap);
    expect(after.fides).toBe(fidesBefore);
  });
});
