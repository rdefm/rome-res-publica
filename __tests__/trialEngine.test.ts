import { shouldTriggerTrial } from '../src/engine/trialEngine';
import type { Character } from '../src/models/character';
import type { Clan } from '../src/models/clan';
import type { GameState } from '../src/state/gameStore';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCrisisTrack(id: string, level: number) {
  return { id, level, tier: 0, namedCrisis: null } as const;
}
const CRISIS_ALL_ZERO = {
  war: makeCrisisTrack('war', 0),
  unrest: makeCrisisTrack('unrest', 0),
  constitution: makeCrisisTrack('constitution', 0),
  economy: makeCrisisTrack('economy', 0),
};

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    ...overrides,
  };
}

function makeHostileClan(id: string): Clan {
  return { id, name: `Gens ${id}`, gensName: id, sigil: '🏛️', influence: 50, desc: '', leaders: [] } as Clan;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    year: -264, turnNumber: 10, seasonIndex: 0,
    fides: 60, denarii: 300, imperium: 0,
    lifetimeDignitas: 20, lifetimeImperium: 60,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis: CRISIS_ALL_ZERO,
    flags: {},
    family: [makeCharacter()],
    trialQueue: [],
    clans: [],
    familyReputations: {},
    electionRivals: [],
    tribuneHolder: null,
    ...overrides,
  };
  return base as unknown as GameState;
}

// ─── Pre-existing branches (light smoke coverage — no dedicated test file
// existed before this chunk touched shouldTriggerTrial) ────────────────────

describe('shouldTriggerTrial — guard clauses', () => {
  test('no trial while a family member holds Tribune (sacrosanctity)', () => {
    const state = makeState({
      tribuneHolder: 'pc-1',
      family: [makeCharacter({ corruptionScore: 90 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: -50 },
    });
    expect(shouldTriggerTrial(state)).toBeNull();
  });

  test('no trial when an unresolved trial is already queued', () => {
    const state = makeState({
      trialQueue: [{ id: 't1', accusedCharacterId: 'pc-1', accusingClanId: 'cornelii', charge: 'corruption',
        defenseStrength: 20, prosecutionStrength: 50, turnsRemaining: 3, resolved: false, actionsUsed: [] }],
      family: [makeCharacter({ corruptionScore: 90 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: -50 },
    });
    expect(shouldTriggerTrial(state)).toBeNull();
  });

  test('no trial when no clan is hostile/rival', () => {
    const state = makeState({
      family: [makeCharacter({ corruptionScore: 90 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: 50 }, // not hostile
    });
    expect(shouldTriggerTrial(state)).toBeNull();
  });
});

// ─── Military Overhaul M4 — defeated general prosecution ────────────────────

describe('shouldTriggerTrial — defeated general prosecution (M4)', () => {
  function hostileState(overrides: Partial<GameState> = {}): GameState {
    return makeState({
      family: [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 25 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: -50 },
      ...overrides,
    });
  }

  test('can accuse a non-paterfamilias family member (unlike the corruption/treason checks, which only ever accuse the player)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-son-1': true } });
    const originalRandom = Math.random;
    Math.random = () => 0; // inside the 25% chance
    try {
      const trigger = shouldTriggerTrial(state);
      expect(trigger).toEqual({ charge: 'military_incompetence', accusedId: 'son-1', accusingClanId: 'cornelii' });
    } finally {
      Math.random = originalRandom;
    }
  });

  test('does not fire the trial when the random roll misses (flag persists for next season)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-son-1': true } });
    const originalRandom = Math.random;
    Math.random = () => 0.99; // outside the 25% chance
    try {
      expect(shouldTriggerTrial(state)).toBeNull();
    } finally {
      Math.random = originalRandom;
    }
  });

  test('ignores a defeatedGeneral flag for a character no longer in the family (already removed/succeeded)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-someone-else': true } });
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      expect(shouldTriggerTrial(state)).toBeNull();
    } finally {
      Math.random = originalRandom;
    }
  });

  test('a false-valued flag does not trigger (only true)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-son-1': false } });
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      expect(shouldTriggerTrial(state)).toBeNull();
    } finally {
      Math.random = originalRandom;
    }
  });
});
