// Phase 3, Chunks P3-C/P3-D — mortality, death-detection & cadet-branch
// tests. This file only covers the P3-C/P3-D additions to
// inheritanceEngine.ts; the pre-existing birth/trait functions in that file
// had no dedicated test file before P3-C either (verified) and are out of
// this file's scope.

import {
  mortalityChance, rollsDead, getHeirOrder, detectPaterfamiliasDeath,
  generateCadet, promoteCadetToParterfamilias,
} from '../src/engine/inheritanceEngine';
import { resolveDeathNotice } from '../src/data/cadetEvents';
import { BALANCE } from '../src/data/balance';
import type { Character, CadetBranch } from '../src/models/character';

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

// ─── Phase 3, Chunk P3-D — Cadet Branch ──────────────────────────────────────

function makeCadet(overrides: Partial<CadetBranch> = {}): CadetBranch {
  return {
    id: 'cadet-1', name: 'Quintus Brutia', age: 30,
    skills: { rhetoric: 3, martial: 3, intrigus: 3 },
    trait: 'cautious', characterization: 'careful with money and careful with words',
    metCount: 0, standing: 40, alive: true,
    ...overrides,
  };
}

describe('generateCadet', () => {
  test('produces a valid CadetBranch within BALANCE.cadet bounds', () => {
    const cadet = generateCadet();
    expect(cadet.age).toBeGreaterThanOrEqual(BALANCE.cadet.ageMin);
    expect(cadet.age).toBeLessThanOrEqual(BALANCE.cadet.ageMax);
    expect(cadet.skills.rhetoric).toBeGreaterThanOrEqual(BALANCE.cadet.skillMin);
    expect(cadet.skills.rhetoric).toBeLessThanOrEqual(BALANCE.cadet.skillMax);
    expect(cadet.name).toContain('Brutia');
    expect(cadet.alive).toBe(true);
    expect(cadet.metCount).toBe(0);
    expect(cadet.characterization.length).toBeGreaterThan(0);
  });

  test('two generated cadets have distinct ids', () => {
    const a = generateCadet();
    const b = generateCadet();
    expect(a.id).not.toBe(b.id);
  });
});

describe('promoteCadetToParterfamilias', () => {
  const stateStub = {
    highestOfficeEverHeld: null as string | null,
    heldOffices: [] as string[],
    paterfamiliasGenerations: 1,
  } as any;

  test('promotes the cadet into a fresh 2-person family, halves the legacy multiplier, clears cursus', () => {
    const cadet = makeCadet();
    const patch = promoteCadetToParterfamilias(cadet, stateStub);
    expect(patch.family).toHaveLength(2);
    const newHead = patch.family!.find(c => c.id === cadet.id)!;
    expect(newHead.isPlayer).toBe(true);
    expect(newHead.role).toBe('paterfamilias');
    expect(newHead.name).toBe(cadet.name);
    const spouse = patch.family!.find(c => c.id !== cadet.id)!;
    expect(spouse.role).toBe('spouse');
    expect(patch.cadetBranchUsed).toBe(true);
    expect(patch.legacyPenaltyMult).toBe(BALANCE.cadet.legacyPenaltyMult);
    expect(patch.currentOffice).toBeNull();
    expect(patch.heldOffices).toEqual([]);
    expect(patch.pendingSuccession).toBeNull();
    expect(patch.regency).toBeNull();
    expect(patch.paterfamiliasGenerations).toBe(2);
  });
});

describe('resolveDeathNotice (cadetEvents.ts)', () => {
  const p = {
    deceasedId: 'pc-1', deceasedName: 'Marcus', deceasedAge: 60,
    rememberedDetail: 'who lived a private life', eligibleHeirIds: [] as string[],
  };

  test('has-heir case still fires the plain P3-C death card', () => {
    const result = resolveDeathNotice({ ...p, eligibleHeirIds: ['son-1'] }, null, false, 10);
    expect(result.notice.defId).toBe('evt-succession-death');
    expect(result.cadetBranch).toBeUndefined();
    expect(result.pendingEpilogue).toBeUndefined();
  });

  test('no-heir + cadet available (alive) fires the continuation offer using the existing cadet unchanged', () => {
    const cadet = makeCadet({ alive: true });
    const result = resolveDeathNotice(p, cadet, false, 10);
    expect(result.notice.defId).toBe('evt-cadet-succession');
    expect(result.cadetBranch).toEqual(cadet);
  });

  test('no-heir + cadet dead lazily regenerates a fresh one', () => {
    const deadCadet = makeCadet({ alive: false });
    const result = resolveDeathNotice(p, deadCadet, false, 10);
    expect(result.notice.defId).toBe('evt-cadet-succession');
    expect(result.cadetBranch).not.toEqual(deadCadet);
    expect(result.cadetBranch?.alive).toBe(true);
  });

  test('no-heir + cadetBranchUsed already true goes straight to the dark ending, no cadet touched', () => {
    const result = resolveDeathNotice(p, makeCadet(), true, 10);
    expect(result.notice.defId).toBe('evt-succession-no-heir');
    expect(result.cadetBranch).toBeUndefined();
    expect(result.pendingEpilogue).toBe('gens_ends');
  });
});

describe('CADET_EVENT_DEFS — content sanity', () => {
  test('evt-cadet-visit has non-zero weight (enters the random pool); evt-cadet-succession is weight 0 (force-injected only)', () => {
    const { CADET_EVENT_DEFS } = require('../src/data/cadetEvents');
    const visit = CADET_EVENT_DEFS.find((d: any) => d.id === 'evt-cadet-visit');
    const succession = CADET_EVENT_DEFS.find((d: any) => d.id === 'evt-cadet-succession');
    expect(visit.weight).toBeGreaterThan(0);
    expect(succession.weight).toBe(0);
  });

  test('evt-cadet-visit is gated on the maxVisits-exhausted flag, not always eligible', () => {
    const { CADET_EVENT_DEFS } = require('../src/data/cadetEvents');
    const visit = CADET_EVENT_DEFS.find((d: any) => d.id === 'evt-cadet-visit');
    expect(visit.conditions).toEqual([{ type: 'flag', key: 'cadet-visits-exhausted', equals: false }]);
  });
});
