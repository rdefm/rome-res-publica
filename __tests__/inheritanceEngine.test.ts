// Phase 3, Chunk P3-C — mortality & death-detection tests. This file only
// covers the P3-C additions to inheritanceEngine.ts; the pre-existing
// birth/trait functions in that file had no dedicated test file before this
// chunk either (verified) and are out of this chunk's scope.

import { mortalityChance, rollsDead, getHeirOrder, detectPaterfamiliasDeath } from '../src/engine/inheritanceEngine';
import { BALANCE } from '../src/data/balance';
import type { Character } from '../src/models/character';

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

describe('mortalityChance', () => {
  test('matches the exact band boundaries in BALANCE.succession.mortalityByAge', () => {
    for (const band of BALANCE.succession.mortalityByAge) {
      expect(mortalityChance(band.minAge)).toBe(band.annualChance);
    }
  });

  test('monotonically non-decreasing across the age range', () => {
    let prev = 0;
    for (let age = 0; age <= 100; age++) {
      const chance = mortalityChance(age);
      expect(chance).toBeGreaterThanOrEqual(prev);
      prev = chance;
    }
  });

  test('negligible under 50, steep past 70 (explicit design direction)', () => {
    expect(mortalityChance(30)).toBeLessThan(0.01);
    expect(mortalityChance(75)).toBeGreaterThan(mortalityChance(65));
    expect(mortalityChance(65)).toBeGreaterThan(mortalityChance(55));
  });
});

describe('rollsDead', () => {
  test('never true at age 0 across many trials (chance is ~0.2%, not exactly 0 — statistical, not absolute)', () => {
    let deaths = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (rollsDead(makeCharacter({ age: 0 }))) deaths++;
    }
    // Loose statistical bound — flags a formula regression without being flaky.
    expect(deaths).toBeLessThan(trials * 0.02);
  });

  test('a 95-year-old dies far more often than a 20-year-old across many trials', () => {
    let oldDeaths = 0;
    let youngDeaths = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (rollsDead(makeCharacter({ age: 95 }))) oldDeaths++;
      if (rollsDead(makeCharacter({ age: 20 }))) youngDeaths++;
    }
    expect(oldDeaths).toBeGreaterThan(youngDeaths);
  });
});

describe('getHeirOrder', () => {
  test('eldest son > eldest daughter > eldest spouse, excluding the deceased', () => {
    const family = [
      makeCharacter({ id: 'pc-1' }),
      makeCharacter({ id: 'son-young', role: 'son', age: 10, isPlayer: false }),
      makeCharacter({ id: 'son-old', role: 'son', age: 20, isPlayer: false }),
      makeCharacter({ id: 'daughter-1', role: 'daughter', age: 25, isPlayer: false }),
      makeCharacter({ id: 'spouse-1', role: 'spouse', age: 40, isPlayer: false }),
    ];
    const order = getHeirOrder(family, 'pc-1').map(c => c.id);
    expect(order).toEqual(['son-old', 'son-young', 'daughter-1', 'spouse-1']);
  });

  test('empty when no eligible relative exists', () => {
    const family = [makeCharacter({ id: 'pc-1' })];
    expect(getHeirOrder(family, 'pc-1')).toEqual([]);
  });

  test('excludes the deceased even if somehow still in the family array', () => {
    const family = [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'son-1', role: 'son', age: 20, isPlayer: false })];
    const order = getHeirOrder(family, 'son-1'); // deceased is son-1, not pc-1
    expect(order.some(c => c.id === 'son-1')).toBe(false);
  });
});

describe('detectPaterfamiliasDeath', () => {
  test('a non-paterfamilias death is simple removal, no pendingSuccession', () => {
    const family = [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'son-1', role: 'son', age: 20, isPlayer: false })];
    const result = detectPaterfamiliasDeath(family, 'son-1', []);
    expect(result.family.find(c => c.id === 'son-1')).toBeUndefined();
    expect(result.family.find(c => c.id === 'pc-1')).toBeDefined();
    expect(result.pendingSuccession).toBeNull();
  });

  test('a paterfamilias death removes them and builds a PendingSuccession, does NOT reassign isPlayer', () => {
    const family = [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'son-1', role: 'son', age: 20, isPlayer: false })];
    const result = detectPaterfamiliasDeath(family, 'pc-1', []);
    expect(result.family.find(c => c.id === 'pc-1')).toBeUndefined();
    const heir = result.family.find(c => c.id === 'son-1')!;
    expect(heir.isPlayer).toBe(false); // NOT reassigned here — succeedPaterfamilias's job
    expect(result.pendingSuccession).not.toBeNull();
    expect(result.pendingSuccession!.deceasedId).toBe('pc-1');
    expect(result.pendingSuccession!.eligibleHeirIds).toEqual(['son-1']);
  });

  test('empty eligibleHeirIds when no eligible heir exists (extinction case — not resolved by this chunk)', () => {
    const family = [makeCharacter({ id: 'pc-1' })];
    const result = detectPaterfamiliasDeath(family, 'pc-1', []);
    expect(result.pendingSuccession!.eligibleHeirIds).toEqual([]);
  });

  test('rememberedDetail references the highest held office when heldOffices is non-empty', () => {
    const family = [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'son-1', role: 'son', age: 20, isPlayer: false })];
    const result = detectPaterfamiliasDeath(family, 'pc-1', ['quaestor', 'consul']);
    expect(result.pendingSuccession!.rememberedDetail.toLowerCase()).toContain('consul');
  });

  test('rememberedDetail is template-light and non-empty for a paterfamilias with no offices/traits', () => {
    const family = [makeCharacter({ id: 'pc-1', traits: [] }), makeCharacter({ id: 'son-1', role: 'son', age: 20, isPlayer: false })];
    const result = detectPaterfamiliasDeath(family, 'pc-1', []);
    expect(result.pendingSuccession!.rememberedDetail.length).toBeGreaterThan(0);
  });
});
