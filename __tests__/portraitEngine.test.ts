// ─── portraitEngine.ts tests ─────────────────────────────────────────────────
// Chunk C0 of cursus-visual-redesign-plan.md.

import {
  ageBandFor,
  genderForCharacter,
  genderForLeader,
  lineageForCharacter,
  lineageForLeader,
  variantIndexFor,
  portraitKeyFor,
  DEFAULT_PORTRAIT_VARIANT_COUNT,
  type PortraitSubject,
} from '../src/engine/portraitEngine';
import type { Character } from '../src/models/character';

describe('ageBandFor', () => {
  test('baby: 0-2', () => {
    expect(ageBandFor(0)).toBe('baby');
    expect(ageBandFor(2)).toBe('baby');
  });
  test('child: 3-9', () => {
    expect(ageBandFor(3)).toBe('child');
    expect(ageBandFor(9)).toBe('child');
  });
  test('youth: 10-17', () => {
    expect(ageBandFor(10)).toBe('youth');
    expect(ageBandFor(17)).toBe('youth');
  });
  test('adult: 18-44 (18 is the game\'s own eligibility landmark)', () => {
    expect(ageBandFor(18)).toBe('adult');
    expect(ageBandFor(44)).toBe('adult');
  });
  test('midage: 45-64', () => {
    expect(ageBandFor(45)).toBe('midage');
    expect(ageBandFor(64)).toBe('midage');
  });
  test('elder: 65+', () => {
    expect(ageBandFor(65)).toBe('elder');
    expect(ageBandFor(100)).toBe('elder');
  });
});

describe('genderForCharacter', () => {
  test('paterfamilias with a male-pool name reads male', () => {
    expect(genderForCharacter({ name: 'Marcus Brutus', role: 'paterfamilias' })).toBe('m');
  });
  test('son reads male', () => {
    expect(genderForCharacter({ name: 'Gaius Brutus', role: 'son' })).toBe('m');
  });
  test('daughter with a female-pool name reads female', () => {
    expect(genderForCharacter({ name: 'Julia Brutus', role: 'daughter' })).toBe('f');
  });
  test('spouse reads female', () => {
    expect(genderForCharacter({ name: 'Livia Brutus', role: 'spouse' })).toBe('f');
  });
  test('brother reads male, sister reads female', () => {
    expect(genderForCharacter({ name: 'Titus Brutus', role: 'brother' })).toBe('m');
    expect(genderForCharacter({ name: 'Cornelia Brutus', role: 'sister' })).toBe('f');
  });
  test('a female-pool name wins over role — the post-succession case', () => {
    // A daughter who inherits becomes role: 'paterfamilias' without her
    // underlying identity changing (inheritanceEngine.succeedPaterfamilias).
    // Her name — drawn from ROMAN_NAMES_FEMALE at birth — must still read
    // female even though role now says otherwise.
    expect(genderForCharacter({ name: 'Julia Brutus', role: 'paterfamilias' })).toBe('f');
  });
  test('a name outside either pool falls back to role', () => {
    expect(genderForCharacter({ name: 'Xerxes Brutus', role: 'son' })).toBe('m');
    expect(genderForCharacter({ name: 'Xerxes Brutus', role: 'daughter' })).toBe('f');
  });
});

describe('genderForLeader', () => {
  test('always male — every current starting-clan leader is male (see the engine\'s own doc comment)', () => {
    expect(genderForLeader({ name: 'P. Cornelius Scipio' })).toBe('m');
    expect(genderForLeader({ name: 'Anything At All' })).toBe('m');
  });
});

describe('lineageForCharacter', () => {
  test('always house, regardless of which starting gens is active', () => {
    expect(lineageForCharacter()).toBe('house');
  });
});

describe('lineageForLeader', () => {
  test('resolves to the leader\'s own clan id for all 4 starting clans', () => {
    expect(lineageForLeader('cornelii')).toBe('cornelii');
    expect(lineageForLeader('valerii')).toBe('valerii');
    expect(lineageForLeader('fabii')).toBe('fabii');
    expect(lineageForLeader('claudii')).toBe('claudii');
  });
  test('an unrecognized clan id defensively falls back to house', () => {
    expect(lineageForLeader('some-future-clan')).toBe('house');
  });
});

describe('variantIndexFor', () => {
  test('variantCount <= 1 always returns 1', () => {
    expect(variantIndexFor('any-id', 1)).toBe(1);
    expect(variantIndexFor('any-id', 0)).toBe(1);
  });
  test('deterministic — same id + count always returns the same variant', () => {
    const a = variantIndexFor('pc-1', 3);
    const b = variantIndexFor('pc-1', 3);
    expect(a).toBe(b);
  });
  test('result is always within [1, variantCount]', () => {
    const ids = ['pc-1', 'npc-wife', 'npc-son', 'npc-daughter', 'cornelius-scipio', 'valerius-flaccus'];
    for (const id of ids) {
      for (const count of [1, 2, 3, 4]) {
        const v = variantIndexFor(id, count);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(count);
      }
    }
  });
});

describe('portraitKeyFor', () => {
  test('composes a player-family character key at the default (1-variant) pool', () => {
    const subject: PortraitSubject = { kind: 'character', id: 'pc-1', name: 'Marcus Brutus', role: 'paterfamilias', age: 42 };
    expect(portraitKeyFor(subject)).toBe('house-1-m-adult');
  });
  test('composes a daughter-turned-paterfamilias key correctly (female, despite role)', () => {
    const subject: PortraitSubject = { kind: 'character', id: 'pc-2', name: 'Julia Brutus', role: 'paterfamilias', age: 30 };
    expect(portraitKeyFor(subject)).toBe('house-1-f-adult');
  });
  test('composes a rival clan leader key', () => {
    const subject: PortraitSubject = { kind: 'leader', id: 'cornelius-scipio', name: 'P. Cornelius Scipio', age: 68, clanId: 'cornelii' };
    expect(portraitKeyFor(subject)).toBe('cornelii-1-m-elder');
  });
  test('DEFAULT_PORTRAIT_VARIANT_COUNT matches Appendix A\'s v1 recommendation', () => {
    expect(DEFAULT_PORTRAIT_VARIANT_COUNT).toBe(1);
  });
  test('an explicit higher variant count changes the composed key\'s variant segment consistently', () => {
    const subject: PortraitSubject = { kind: 'character', id: 'pc-1', name: 'Marcus Brutus', role: 'paterfamilias', age: 42 };
    const key = portraitKeyFor(subject, 3);
    expect(key).toMatch(/^house-[1-3]-m-adult$/);
    expect(portraitKeyFor(subject, 3)).toBe(key); // deterministic across calls
  });
});

// ─── Sanity: every role union member is handled ─────────────────────────────
describe('genderForCharacter — exhaustive role coverage', () => {
  const roles: Character['role'][] = ['paterfamilias', 'spouse', 'son', 'daughter', 'brother', 'sister'];
  test.each(roles)('role %s never throws and returns m or f', (role) => {
    const result = genderForCharacter({ name: 'Xerxes Placeholder', role });
    expect(['m', 'f']).toContain(result);
  });
});
