import { getOfficeStatus, OfficeStatusGameState } from '../src/engine/officeStatus';
import { OFFICES } from '../src/data/offices';
import type { Character } from '../src/models/character';

const QUAESTOR = OFFICES.find(o => o.id === 'quaestor')!;   // minAge 30, no prerequisite
const AEDILE   = OFFICES.find(o => o.id === 'aedile')!;      // minAge 36, prerequisite 'quaestor'

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'c-1',
    name: 'Marcus',
    role: 'paterfamilias',
    isPlayer: true,
    age: 40,
    skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    traits: [],
    ambition: null,
    relationship: 100,
    familyTrust: 100,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: [],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
    ...overrides,
  };
}

function makeState(overrides: Partial<OfficeStatusGameState> = {}): OfficeStatusGameState {
  return {
    currentOffice: null,
    heldOffices: [],
    campaigning: null,
    campaigningCharacterId: null,
    ...overrides,
  };
}

describe('getOfficeStatus', () => {
  test('player currently holding the office → held', () => {
    const character = makeCharacter({ isPlayer: true });
    const state = makeState({ currentOffice: 'quaestor' });
    expect(getOfficeStatus(character, QUAESTOR, state)).toEqual({ status: 'held' });
  });

  test('non-player family member currently holding the office (via character.officeId) → held', () => {
    const character = makeCharacter({ isPlayer: false, officeId: 'quaestor' });
    const state = makeState({ currentOffice: null });
    expect(getOfficeStatus(character, QUAESTOR, state)).toEqual({ status: 'held' });
  });

  test('this character is the active campaigner for this office → active', () => {
    const character = makeCharacter({ id: 'c-1' });
    const state = makeState({ campaigning: 'quaestor', campaigningCharacterId: 'c-1' });
    expect(getOfficeStatus(character, QUAESTOR, state)).toEqual({ status: 'active' });
  });

  test('a different character campaigning for this office does not mark it active for me', () => {
    const character = makeCharacter({ id: 'c-1' });
    const state = makeState({ campaigning: 'quaestor', campaigningCharacterId: 'someone-else' });
    // Not campaigning myself, not held, not current — falls through to the
    // locked branch below since noCampaignActive is false (someone else in
    // the family is mid-campaign).
    expect(getOfficeStatus(character, QUAESTOR, state).status).toBe('locked');
  });

  test('office already in heldOffices, not current → served', () => {
    const character = makeCharacter({ isPlayer: true });
    const state = makeState({ heldOffices: ['quaestor'] });
    expect(getOfficeStatus(character, QUAESTOR, state)).toEqual({ status: 'served' });
  });

  test('non-player served via character.heldOffices → served', () => {
    const character = makeCharacter({ isPlayer: false, heldOffices: ['quaestor'] });
    const state = makeState();
    expect(getOfficeStatus(character, QUAESTOR, state)).toEqual({ status: 'served' });
  });

  test('under minimum age → locked with age reason (takes priority over prerequisite)', () => {
    const character = makeCharacter({ age: 20, heldOffices: [] });
    const state = makeState();
    expect(getOfficeStatus(character, AEDILE, state)).toEqual({
      status: 'locked',
      reason: 'Min age 36',
    });
  });

  test('age ok but missing prerequisite → locked with prerequisite reason', () => {
    const character = makeCharacter({ age: 40, heldOffices: [] });
    const state = makeState();
    expect(getOfficeStatus(character, AEDILE, state)).toEqual({
      status: 'locked',
      reason: 'Requires Quaestor',
    });
  });

  test('age and prerequisite ok but another campaign is active → locked with campaign reason', () => {
    // Player prereq is checked against state.heldOffices (the household-wide
    // record), not character.heldOffices — matches the original OfficeRung
    // logic (Finding 2).
    const character = makeCharacter({ age: 40 });
    const state = makeState({
      heldOffices: ['quaestor'],
      campaigning: 'praetor',
      campaigningCharacterId: 'someone-else',
    });
    expect(getOfficeStatus(character, AEDILE, state)).toEqual({
      status: 'locked',
      reason: 'Another campaign in progress',
    });
  });

  test('everything satisfied and no active campaign → eligible', () => {
    const character = makeCharacter({ age: 40 });
    const state = makeState({ heldOffices: ['quaestor'] });
    expect(getOfficeStatus(character, AEDILE, state)).toEqual({ status: 'eligible' });
  });

  test('player prerequisite check also accepts currentOffice as satisfying the prerequisite', () => {
    const character = makeCharacter({ isPlayer: true, age: 40, heldOffices: [] });
    const state = makeState({ currentOffice: 'quaestor' });
    // currentOffice is 'quaestor', not 'aedile', so isCurrent for AEDILE is false;
    // prereqMet should still be satisfied via currentOffice === prerequisite.
    expect(getOfficeStatus(character, AEDILE, state)).toEqual({ status: 'eligible' });
  });
});
