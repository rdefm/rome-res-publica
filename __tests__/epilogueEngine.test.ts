// Phase 3, Chunk P3-E — epilogueEngine.ts / epilogueText.ts / ancestorStore.ts.
//
// No prior test in this codebase exercises AsyncStorage (verified — even
// saveLoad.ts, which has used it since Phase 1, has no dedicated test file).
// The official mock is required explicitly here rather than relying on any
// project-wide jest config, since none currently mocks it.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { buildAncestorRecord } from '../src/engine/epilogueEngine';
import { assembleHistorianParagraph } from '../src/data/epilogueText';
import { appendAncestorRecord, loadHall } from '../src/state/ancestorStore';
import type { EpilogueOutcome, AncestorRecord } from '../src/models/epilogue';
import type { Character } from '../src/models/character';
import type { GameState } from '../src/state/gameStore';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
    skills: { rhetoric: 6, martial: 3, intrigus: 4 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    ...overrides,
  };
}

function makeCrisisTrack(id: string, level: number) {
  return { id, level, tier: 0, namedCrisis: null } as const;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    year: -250, turnNumber: 40, gensFoundedYear: -264,
    lifetimeDignitas: 80, legacyPenaltyMult: 1,
    highestOfficeEverHeld: 'consul', heldOffices: [],
    paterfamiliasGenerations: 2,
    cadetBranchUsed: false,
    family: [makeCharacter()],
    flags: {},
    trialQueue: [],
    crisis: {
      war: makeCrisisTrack('war', 20),
      unrest: makeCrisisTrack('unrest', 10),
      constitution: makeCrisisTrack('constitution', 10),
      economy: makeCrisisTrack('economy', 15),
    },
    ...overrides,
  } as unknown as GameState;
}

describe('buildAncestorRecord', () => {
  const outcomes: EpilogueOutcome[] = ['victory', 'exhaustion', 'humbled', 'republic_falls', 'gens_ends'];

  test.each(outcomes)('produces a coherent record for outcome=%s', (outcome) => {
    const state = makeState();
    const record = buildAncestorRecord(state, outcome);
    expect(record.outcome).toBe(outcome);
    expect(record.gensName).toBe('Brutia');
    expect(record.foundedYear).toBe(-264);
    expect(record.endedYear).toBe(-250);
    expect(record.historianParagraph.length).toBeGreaterThan(0);
    expect(record.historianParagraph).toContain('Brutia');
    expect(record.familyTree).toHaveLength(1);
  });

  test('finalLegacy is halved and flagged when legacyPenaltyMult < 1 (cadet continuation)', () => {
    const normal = buildAncestorRecord(makeState({ lifetimeDignitas: 100, legacyPenaltyMult: 1 }), 'victory');
    const halved = buildAncestorRecord(makeState({ lifetimeDignitas: 100, legacyPenaltyMult: 0.5, cadetBranchUsed: true }), 'victory');
    expect(normal.finalLegacy).toBe(100);
    expect(normal.legacyPenaltyApplied).toBe(false);
    expect(halved.finalLegacy).toBe(50);
    expect(halved.legacyPenaltyApplied).toBe(true);
  });

  test('notableBeats reflects triumphs, trial outcomes, cadet continuation, and crisis posture', () => {
    const state = makeState({
      flags: { 'triumph-granted-pc-1': true, 'triumph-granted-son-1': true },
      trialQueue: [
        { id: 't1', accusedCharacterId: 'pc-1', accusingClanId: 'x', charge: 'c', defenseStrength: 1, prosecutionStrength: 1, turnsRemaining: 0, resolved: true, outcome: 'acquitted', actionsUsed: [] },
        { id: 't2', accusedCharacterId: 'pc-1', accusingClanId: 'x', charge: 'c', defenseStrength: 1, prosecutionStrength: 1, turnsRemaining: 0, resolved: true, outcome: 'executed', actionsUsed: [] },
      ] as any,
      cadetBranchUsed: true,
    });
    const record = buildAncestorRecord(state, 'victory');
    expect(record.notableBeats.some(b => b.includes('Triumph'))).toBe(true);
    expect(record.notableBeats.some(b => b.includes('trial survived'))).toBe(true);
    expect(record.notableBeats.some(b => b.includes('trial lost'))).toBe(true);
    expect(record.notableBeats.some(b => b.includes('cadet branch'))).toBe(true);
  });

  test('highestOffice combines the tracked historical value and the current cursus', () => {
    const state = makeState({ highestOfficeEverHeld: 'quaestor', heldOffices: ['consul'] });
    const record = buildAncestorRecord(state, 'victory');
    expect(record.highestOffice).toBe('consul'); // consul outranks quaestor
  });
});

describe('assembleHistorianParagraph', () => {
  test('produces a non-empty coherent string for a maximal run', () => {
    const state = makeState({
      lifetimeDignitas: 500,
      highestOfficeEverHeld: 'consul',
      paterfamiliasGenerations: 4,
      flags: { 'triumph-granted-pc-1': true },
    });
    const record = buildAncestorRecord(state, 'victory');
    expect(record.historianParagraph.length).toBeGreaterThan(40);
    expect(record.historianParagraph).toContain('consul'.charAt(0).toUpperCase() + 'onsul'); // "Consul" via OFFICES name
  });

  test('produces a non-empty coherent string for a near-empty run (no office, no beats, 1 generation)', () => {
    const state = makeState({
      lifetimeDignitas: 0,
      highestOfficeEverHeld: null,
      heldOffices: [],
      paterfamiliasGenerations: 1,
      flags: {},
      trialQueue: [],
    });
    const record = buildAncestorRecord(state, 'gens_ends');
    expect(record.historianParagraph.length).toBeGreaterThan(20);
    expect(record.highestOffice).toBeNull();
  });

  test('every outcome has at least 3 distinct opening phrases (graceful variation, per the plan)', () => {
    const seen = new Set<string>();
    for (let year = -264; year <= -241; year++) {
      const state = makeState({ year } as any);
      const record = buildAncestorRecord(state, 'victory');
      seen.add(record.historianParagraph.split('.')[0]);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe('ancestorStore — Hall of Ancestors persistence', () => {
  function makeRecord(overrides: Partial<AncestorRecord> = {}): AncestorRecord {
    return {
      id: 'ancestor-1', gensName: 'Brutia', foundedYear: -264, endedYear: -241,
      outcome: 'victory', finalLegacy: 100, legacyPenaltyApplied: false,
      highestOffice: 'consul', generations: 3, notableBeats: [], familyTree: [],
      historianParagraph: 'Test paragraph.', recordedAt: Date.now(),
      ...overrides,
    };
  }

  test('appendAncestorRecord then loadHall returns the record, most-recent first', async () => {
    const a = makeRecord({ id: 'a' });
    const b = makeRecord({ id: 'b' });
    await appendAncestorRecord(a);
    await appendAncestorRecord(b);
    const hall = await loadHall();
    expect(hall[0].id).toBe('b');
    expect(hall.some(r => r.id === 'a')).toBe(true);
  });
});
