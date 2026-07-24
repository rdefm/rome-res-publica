import {
  calcResourceIncome,
  applyFactionDrift,
  calcRomeStats,
  calcTrainingCost,
  applyEffectString,
} from '../src/engine/resourceEngine';
import { BALANCE } from '../src/data/balance';
import { getCrisisStatusEffects } from '../src/engine/crisisEngine';
import { scoreAction, chooseAction } from '../src/engine/aiScoring';
import { parseEffect } from '../src/models/bill';
import type { CrisisState } from '../src/models/crisis';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

function makeCrisisTrack(id: string, level: number) {
  const tier =
    level < 20 ? 0 :
    level < 40 ? 1 :
    level < 60 ? 2 :
    level < 80 ? 3 : 4;
  return { id, level, tier, namedCrisis: null } as const;
}

const CRISIS_ALL_ZERO: CrisisState = {
  war:          makeCrisisTrack('war',          0),
  unrest:       makeCrisisTrack('unrest',       0),
  constitution: makeCrisisTrack('constitution', 0),
  economy:      makeCrisisTrack('economy',      0),
};

// Minimal mock game state
// Chunk 2A: 'crisis' field added alongside the legacy 'crisisLevel' scalar.
const makeState = (overrides: Record<string, any> = {}) => ({
  year: -264,
  turnNumber: 1,
  seasonIndex: 0,
  fides: 30,
  denarii: 200,
  imperium: 0,
  lifetimeDignitas: 0,
  popularesRel: 0,
  optimatesRel: 0,
  rome: { stability: 50, plebs: 50, treasury: 50 },
  crisisLevel: 0,
  crisis: CRISIS_ALL_ZERO,     // ← required by calcResourceIncome (Chunk 2B+)
  flags: {},
  family: [
    {
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
      skills: { rhetoric: 6, martial: 3, intrigus: 4 },
      traits: ['ambitious'],
      ambition: { type: 'gain_dignitas', priority: 0.7 },
      relationship: 100, familyTrust: 100,
      officeId: null,
      inheritedTraits: [],
      ambitionIds: [],
      reputationScores: {},
    },
  ],
  bills: [],
  clans: [],
  clients: [],
  ownedAssets: [],
  ambitions: [],
  legacyObjectives: [],
  patronTier: 0,
  trialQueue: [],
  selectedCharacterId: 'pc-1',
  expandedClanId: null,
  selectedLeaderId: null,
  currentOffice: null,
  officeSeasons: 0,
  heldOffices: [],
  campaigning: null,
  campaignVotes: {},
  electionRivals: [],
  cities: [],
  pendingEvents: [],
  activeEvent: null,
  log: [],
  cursusLog: [],
  seasonOverlayVisible: false,
  seasonOverlayEvents: [],
  _expandedBill: null,
  _expandedType: null,
  ...overrides,
});

// ─── Resource Engine ─────────────────────────────────────────────────────────

describe('calcResourceIncome', () => {
  test('fides = rhetoric × 2 at no crisis, before multipliers', () => {
    const s = makeState();
    const { fidesIncome } = calcResourceIncome(s as any);
    expect(fidesIncome).toBe(12); // rhetoric 6 × 2 = 12, no crisis penalty at tier 0
  });

  test('income floors at 0 under heavy crisis', () => {
    const s = makeState({
      crisis: {
        war:          makeCrisisTrack('war',          100),
        unrest:       makeCrisisTrack('unrest',       100),
        constitution: makeCrisisTrack('constitution', 100),
        economy:      makeCrisisTrack('economy',      100),
      },
    });
    const { fidesIncome } = calcResourceIncome(s as any);
    expect(fidesIncome).toBeGreaterThanOrEqual(0);
  });

  // Chunk 2B: crisis penalty now comes from getCrisisStatusEffects, not Math.floor(crisisLevel/20).
  // War tier 1 (level 20–39) applies fidesDelta: -1. Compare tier-0 vs tier-1 state.
  test('War tier 1 reduces fides income by 1 compared to tier 0', () => {
    const s0 = makeState(); // all tracks tier 0 → total fidesDelta = 0
    const s1 = makeState({
      crisis: {
        war:          makeCrisisTrack('war', 25),  // tier 1 → fidesDelta: -1
        unrest:       makeCrisisTrack('unrest',       0),
        constitution: makeCrisisTrack('constitution', 0),
        economy:      makeCrisisTrack('economy',      0),
      },
    });
    const { fidesIncome: f0 } = calcResourceIncome(s0 as any);
    const { fidesIncome: f1 } = calcResourceIncome(s1 as any);
    expect(f0 - f1).toBe(1);
  });

  test('fides income includes office held bonus', () => {
    const s = makeState();
    s.family[0].officeId = 'aedile';
    const { fidesIncome } = calcResourceIncome(s as any);
    // base: rhetoric 6 × 2 = 12, aedile office bonus = +5
    expect(fidesIncome).toBe(12 + 5);
  });

  test('fides income includes allied clan leader bonus', () => {
    const s = makeState({
      clans: [
        {
          id: 'clan-1',
          name: 'Cornelii',
          leaders: [
            { id: 'leader-1', name: 'Lucius', relationship: 70 },
          ],
        },
      ],
    });
    const { fidesIncome } = calcResourceIncome(s as any);
    // base: rhetoric 6 × 2 = 12, allied leader (relationship >= 60) = +2
    expect(fidesIncome).toBe(12 + 2);
  });

  // P2-C: household-voices income term
  test('fides income includes the household-voices term from the highest-rhetoric other family member age >= 12', () => {
    const s = makeState({
      family: [
        { id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42, skills: { rhetoric: 6, martial: 3, intrigus: 4 }, officeId: null },
        { id: 'heir-1', name: 'Julia', role: 'daughter', isPlayer: false, age: 16, skills: { rhetoric: 4, martial: 1, intrigus: 2 }, officeId: null },
      ],
    });
    const { fidesIncome } = calcResourceIncome(s as any);
    // base: paterfamilias rhetoric 6 × 2 = 12, + best other rhetoric 4 × 1 = 4
    expect(fidesIncome).toBe(12 + 4);
  });

  test('family members below the minimum age contribute nothing to the household-voices term', () => {
    const s = makeState({
      family: [
        { id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42, skills: { rhetoric: 6, martial: 3, intrigus: 4 }, officeId: null },
        { id: 'child-1', name: 'Little Marcus', role: 'son', isPlayer: false, age: 8, skills: { rhetoric: 9, martial: 0, intrigus: 0 }, officeId: null },
      ],
    });
    const { fidesIncome } = calcResourceIncome(s as any);
    // base: rhetoric 6 × 2 = 12; child's rhetoric 9 ignored (age 8 < min age 12)
    expect(fidesIncome).toBe(12);
  });

  test('household-voices term takes only the highest other rhetoric, not the sum', () => {
    const s = makeState({
      family: [
        { id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42, skills: { rhetoric: 6, martial: 3, intrigus: 4 }, officeId: null },
        { id: 'heir-1', name: 'Julia', role: 'daughter', isPlayer: false, age: 16, skills: { rhetoric: 4, martial: 1, intrigus: 2 }, officeId: null },
        { id: 'heir-2', name: 'Gaius', role: 'son', isPlayer: false, age: 20, skills: { rhetoric: 7, martial: 5, intrigus: 1 }, officeId: null },
      ],
    });
    const { fidesIncome } = calcResourceIncome(s as any);
    // base: 6 × 2 = 12, + best other rhetoric (7, not 4+7) × 1 = 7
    expect(fidesIncome).toBe(12 + 7);
  });

  // July 2026 fixes, Chunk E — province assets now share Latium's
  // AssetDefinition/OwnedAsset shape (cityEngine.calcCityAssetBonuses,
  // replacing the old single-field calcAssetGoldOutput/calcAssetFidesOutput).
  test('a province-owned asset contributes its gold/fides bonus to season income', () => {
    const s = makeState({
      cities: [
        { id: 'campania', ownedAssets: [{ definitionId: 'latifundium', currentTier: 1, turnAcquired: 0 }] },
      ],
    });
    const withAsset = calcResourceIncome(s as any);
    const without = calcResourceIncome(makeState() as any);
    expect(withAsset.denariiIncome).toBe(without.denariiIncome + 6); // latifundium tier 1: +6 gold
  });

  test('a province asset upgraded to tier 3 uses its tier-3 bonus, not tier 1', () => {
    const s = makeState({
      cities: [
        { id: 'campania', ownedAssets: [{ definitionId: 'latifundium', currentTier: 3, turnAcquired: 0 }] },
      ],
    });
    const { denariiIncome } = calcResourceIncome(s as any);
    const without = calcResourceIncome(makeState() as any);
    expect(denariiIncome).toBe(without.denariiIncome + 22); // latifundium tier 3: +22 gold
  });

  test("an asset's plebsPerTurn (e.g. Provincial Ludus) feeds plebsDelta — the real 'reduce unrest' hook", () => {
    const s = makeState({
      cities: [
        { id: 'campania', ownedAssets: [{ definitionId: 'provincial_ludus', currentTier: 1, turnAcquired: 0 }] },
      ],
    });
    const { plebsDelta } = calcResourceIncome(s as any);
    expect(plebsDelta).toBe(2); // provincial_ludus tier 1: plebsPerTurn 2, no unrest penalty at CRISIS_ALL_ZERO
  });
});

// ─── Training cost (P2-C) ─────────────────────────────────────────────────────

describe('calcTrainingCost', () => {
  test('cost scales with target level, not current level', () => {
    expect(calcTrainingCost(0)).toBe(3);   // 0 → 1 costs 3 × 1
    expect(calcTrainingCost(5)).toBe(18);  // 5 → 6 costs 3 × 6
    expect(calcTrainingCost(6)).toBe(21);  // 6 → 7 costs 3 × 7 (plan's worked example)
    expect(calcTrainingCost(9)).toBe(30);  // 9 → 10 costs 3 × 10
  });
});

// ─── Crisis Engine — four-track tier system ───────────────────────────────────
// Replaces old getCrisisInfo tests (Chunk 2B: getCrisisInfo removed from crisisEngine).
// The single-level crisis info is now split across four tracks via getCrisisStatusEffects.

describe('getCrisisStatusEffects — war track tiers', () => {
  test('tier 0 (level 0–19): label Pax Externa, no Fides or Denarii penalty', () => {
    const crisis: CrisisState = {
      war:          makeCrisisTrack('war', 10),
      unrest:       makeCrisisTrack('unrest', 0),
      constitution: makeCrisisTrack('constitution', 0),
      economy:      makeCrisisTrack('economy', 0),
    };
    const warEffect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'war')!;
    expect(warEffect.label).toBe('Pax Externa');
    expect(warEffect.fidesDelta).toBe(0);
    expect(warEffect.denariDelta).toBe(0);
  });

  test('tier 4 (level 80–100): label Existential Threat, maximum penalties', () => {
    const crisis: CrisisState = {
      war:          makeCrisisTrack('war', 90),
      unrest:       makeCrisisTrack('unrest', 0),
      constitution: makeCrisisTrack('constitution', 0),
      economy:      makeCrisisTrack('economy', 0),
    };
    const warEffect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'war')!;
    expect(warEffect.label).toBe('Existential Threat');
    expect(warEffect.fidesDelta).toBe(-5);
    expect(warEffect.denariDelta).toBe(-10);
  });

  test('five distinct war tier labels exist across 0–100', () => {
    const levels = [10, 25, 50, 70, 90]; // one per tier band
    const labels = levels.map(level => {
      const crisis: CrisisState = {
        war:          makeCrisisTrack('war', level),
        unrest:       makeCrisisTrack('unrest', 0),
        constitution: makeCrisisTrack('constitution', 0),
        economy:      makeCrisisTrack('economy', 0),
      };
      return getCrisisStatusEffects(crisis).find(e => e.trackId === 'war')!.label;
    });
    expect(new Set(labels).size).toBe(5);
  });
});

// NOTE: calcCrisisEscalation (flat single-track escalation) was removed from
// resourceEngine in Chunk 2B. The four-track equivalent is tested in
// romeStats.test.ts (calcIndividualEscalation, calcCascadeDeltas, etc).

// ─── Faction Drift ───────────────────────────────────────────────────────────

describe('applyFactionDrift', () => {
  test('both factions drift -1 each season', () => {
    const s = makeState({ popularesRel: 50, optimatesRel: -10 });
    const result = applyFactionDrift(s as any);
    expect(result.popularesRel).toBe(49);
    expect(result.optimatesRel).toBe(-11);
  });
  test('clamped at -100', () => {
    const s = makeState({ popularesRel: -100, optimatesRel: -100 });
    const result = applyFactionDrift(s as any);
    expect(result.popularesRel).toBe(-100);
    expect(result.optimatesRel).toBe(-100);
  });

  // July 2026 fixes, Chunk E — the Campania Holiday Estate's Optimates-
  // relation ask, via AssetBonus.optimatesRelPerTurn (owned by Latium or any
  // city — summed across both).
  test('an owned asset with optimatesRelPerTurn offsets the -1 baseline drift', () => {
    const s = makeState({
      optimatesRel: 0,
      cities: [
        { id: 'campania', ownedAssets: [{ definitionId: 'campania_holiday_estate', currentTier: 1, turnAcquired: 0 }] },
      ],
    });
    const result = applyFactionDrift(s as any);
    expect(result.optimatesRel).toBe(1); // -1 baseline + optimatesRelPerTurn 2
  });
});

// ─── Rome Stats ──────────────────────────────────────────────────────────────

describe('calcRomeStats', () => {
  test('bills passed improves stability and plebs', () => {
    const s = makeState({ rome: { stability: 50, plebs: 50, treasury: 50 } });
    const result = calcRomeStats(s as any, 1);
    expect(result.stability).toBeGreaterThan(50);
    expect(result.plebs).toBeGreaterThan(50);
  });
  test('no bills passed decreases stability', () => {
    const s = makeState({ rome: { stability: 50, plebs: 50, treasury: 50 } });
    const result = calcRomeStats(s as any, 0);
    expect(result.stability).toBeLessThan(50);
    expect(result.plebs).toBeLessThan(50);
  });
});

// ─── Bill Effect Parsing ─────────────────────────────────────────────────────

describe('parseEffect', () => {
  test('parses single effect', () => {
    expect(parseEffect('lifetimeDignitas+8')).toEqual([{ key: 'lifetimeDignitas', delta: 8 }]);
  });
  test('parses multiple pipe-separated effects', () => {
    const result = parseEffect('stability+5|crisis-3');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ key: 'stability', delta: 5 });
    expect(result[1]).toEqual({ key: 'crisis', delta: -3 });
  });
  test('empty string returns empty array', () => {
    expect(parseEffect('')).toEqual([]);
  });
});

// ─── AI Scoring ──────────────────────────────────────────────────────────────

describe('scoreAction', () => {
  const aggressiveChar = {
    id: 'npc-son', name: 'Gaius', role: 'son' as const, isPlayer: false, age: 17,
    skills: { rhetoric: 3, martial: 5, intrigus: 2 },
    traits: ['aggressive' as const],
    ambition: { type: 'personal_power' as const, priority: 0.5 },
    relationship: 70, familyTrust: 90,
    officeId: null,
    inheritedTraits: [],
    ambitionIds: [],
    reputationScores: {},
  };
  test('aggressive character scores filibuster above vote_for on average', () => {
    let filibusterWins = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const sf = scoreAction(aggressiveChar, 'filibuster', makeState() as any);
      const sv = scoreAction(aggressiveChar, 'vote_for', makeState() as any);
      if (sf > sv) filibusterWins++;
    }
    expect(filibusterWins).toBeGreaterThan(trials * 0.6);
  });
  test('chooseAction returns one of the available actions', () => {
    const action = chooseAction(aggressiveChar, ['vote_for', 'vote_against', 'filibuster'], makeState() as any);
    expect(['vote_for', 'vote_against', 'filibuster']).toContain(action);
  });
});

// ─── Phase 3, Chunk P3-C — regency income penalty ───────────────────────────

describe('calcResourceIncome — regency (P3-C)', () => {
  test('a regency multiplies total fidesIncome by BALANCE.succession.regencyIncomeMult', () => {
    const noRegency = calcResourceIncome(makeState() as any);
    const withRegency = calcResourceIncome(makeState({
      regency: { heirId: 'pc-1', regentId: null, untilYear: -250 },
    }) as any);
    expect(withRegency.fidesIncome).toBeLessThan(noRegency.fidesIncome);
    expect(withRegency.fidesIncome).toBe(Math.round(noRegency.fidesIncome * BALANCE.succession.regencyIncomeMult));
  });

  test('no regency field at all behaves identically to regency: null (old-save safety)', () => {
    const explicit = calcResourceIncome(makeState({ regency: null }) as any);
    const { regency: _omit, ...noRegencyField } = makeState() as any;
    const implicit = calcResourceIncome(noRegencyField);
    expect(implicit.fidesIncome).toBe(explicit.fidesIncome);
  });
});

// ─── Phase 3, Chunk P3-C — succession effect-string tokens ──────────────────

describe('applyEffectString — nextEvent: token', () => {
  test('queues a new EventInstance onto pendingEvents', () => {
    const state = makeState({ pendingEvents: [] }) as any;
    const patch = applyEffectString('nextEvent:evt-succession-funeral', state);
    expect(patch.pendingEvents).toHaveLength(1);
    expect(patch.pendingEvents![0].defId).toBe('evt-succession-funeral');
  });

  test('appends after any already-pending events rather than replacing them', () => {
    const existing = { defId: 'evt-existing', firedAtTurn: 1, targetCharacterId: 'pc-1' };
    const state = makeState({ pendingEvents: [existing] }) as any;
    const patch = applyEffectString('nextEvent:evt-succession-funeral', state);
    expect(patch.pendingEvents).toEqual([existing, expect.objectContaining({ defId: 'evt-succession-funeral' })]);
  });
});

describe('applyEffectString — succeedPaterfamilias: token', () => {
  function makeSuccessionState(overrides: Record<string, any> = {}) {
    return makeState({
      family: [
        { id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
          skills: { rhetoric: 6, martial: 3, intrigus: 4 }, traits: [], ambition: null,
          relationship: 100, familyTrust: 100, officeId: null, inheritedTraits: [], ambitionIds: [], reputationScores: {} },
        { id: 'son-1', name: 'Gaius', role: 'son', isPlayer: false, age: 20,
          skills: { rhetoric: 4, martial: 4, intrigus: 3 }, traits: [], ambition: null,
          relationship: 90, familyTrust: 80, officeId: null, inheritedTraits: [], ambitionIds: [], reputationScores: {} },
        { id: 'son-2', name: 'Lucius', role: 'son', isPlayer: false, age: 10,
          skills: { rhetoric: 1, martial: 1, intrigus: 1 }, traits: [], ambition: null,
          relationship: 90, familyTrust: 80, officeId: null, inheritedTraits: [], ambitionIds: [], reputationScores: {} },
      ],
      pendingSuccession: {
        deceasedId: 'pc-1', deceasedName: 'Marcus', deceasedAge: 60,
        rememberedDetail: 'who lived a private life',
        eligibleHeirIds: ['son-1', 'son-2'],
      },
      currentOffice: 'consul', officeSeasons: 2, heldOffices: ['quaestor', 'consul'],
      ...overrides,
    }) as any;
  }

  test('default confirms eligibleHeirIds[0] and clears pendingSuccession + cursus history', () => {
    const state = makeSuccessionState();
    const patch = applyEffectString('succeedPaterfamilias:default', state);
    const heir = patch.family!.find(c => c.id === 'son-1')!;
    expect(heir.isPlayer).toBe(true);
    expect(heir.role).toBe('paterfamilias');
    expect(patch.pendingSuccession).toBeNull();
    expect(patch.currentOffice).toBeNull();
    expect(patch.heldOffices).toEqual([]);
  });

  test('alt confirms eligibleHeirIds[1] and applies the family-trust penalty', () => {
    const state = makeSuccessionState();
    const patch = applyEffectString('succeedPaterfamilias:alt', state);
    const heir = patch.family!.find(c => c.id === 'son-2')!;
    expect(heir.isPlayer).toBe(true);
    expect(heir.familyTrust).toBe(80 + BALANCE.succession.nameOtherHeirFamilyTrustPenalty);
  });

  test('alt gracefully falls back to eligibleHeirIds[0] when no alternative exists (never soft-locks)', () => {
    const state = makeSuccessionState({
      pendingSuccession: {
        deceasedId: 'pc-1', deceasedName: 'Marcus', deceasedAge: 60,
        rememberedDetail: 'who lived a private life', eligibleHeirIds: ['son-1'],
      },
    });
    const patch = applyEffectString('succeedPaterfamilias:alt', state);
    const heir = patch.family!.find(c => c.id === 'son-1')!;
    expect(heir.isPlayer).toBe(true);
    // Fallback to the default heir is NOT the "named a different heir"
    // path — no family-trust penalty should apply.
    expect(heir.familyTrust).toBe(80);
  });

  test('a minor heir (under regencyMinorAge) enters a regency', () => {
    const state = makeSuccessionState({
      pendingSuccession: {
        deceasedId: 'pc-1', deceasedName: 'Marcus', deceasedAge: 60,
        rememberedDetail: 'who lived a private life', eligibleHeirIds: ['son-2'],
      },
    });
    const patch = applyEffectString('succeedPaterfamilias:default', state);
    expect(patch.regency).not.toBeNull();
    expect(patch.regency!.heirId).toBe('son-2');
    expect(patch.regency!.untilYear).toBe(state.year + (BALANCE.succession.regencyMinorAge - 10));
  });

  test('an adult heir (>= regencyMinorAge) does not enter a regency', () => {
    const state = makeSuccessionState();
    const patch = applyEffectString('succeedPaterfamilias:default', state);
    expect(patch.regency).toBeUndefined();
  });

  test('no-op (does not crash, does not touch family) when pendingSuccession is null', () => {
    const state = makeSuccessionState({ pendingSuccession: null });
    const patch = applyEffectString('succeedPaterfamilias:default', state);
    expect(patch.family).toBeUndefined();
  });

  test('regent selection: spouse (if adult) over the eldest adult kin', () => {
    // Realistic family shape for this token's real firing point — the
    // deceased paterfamilias is already gone from `family` by the time
    // succeedPaterfamilias: fires (detectPaterfamiliasDeath already
    // removed them before pendingSuccession was set).
    const state = makeState({
      family: [
        { id: 'spouse-1', name: 'Livia', role: 'spouse', isPlayer: false, age: 38,
          skills: { rhetoric: 2, martial: 1, intrigus: 3 }, traits: [], ambition: null,
          relationship: 90, familyTrust: 80, officeId: null, inheritedTraits: [], ambitionIds: [], reputationScores: {} },
        { id: 'heir-1', name: 'Gaius', role: 'son', isPlayer: false, age: 12,
          skills: { rhetoric: 1, martial: 1, intrigus: 1 }, traits: [], ambition: null,
          relationship: 90, familyTrust: 80, officeId: null, inheritedTraits: [], ambitionIds: [], reputationScores: {} },
      ],
      pendingSuccession: {
        deceasedId: 'pc-1', deceasedName: 'Marcus', deceasedAge: 60,
        rememberedDetail: 'who lived a private life', eligibleHeirIds: ['heir-1'],
      },
    }) as any;
    const patch = applyEffectString('succeedPaterfamilias:default', state);
    expect(patch.regency!.regentId).toBe('spouse-1');
  });

  test('regent selection: falls back to null (not a soft-lock) when no adult kin exists', () => {
    const state = makeState({
      family: [
        { id: 'heir-1', name: 'Gaius', role: 'son', isPlayer: false, age: 12,
          skills: { rhetoric: 1, martial: 1, intrigus: 1 }, traits: [], ambition: null,
          relationship: 90, familyTrust: 80, officeId: null, inheritedTraits: [], ambitionIds: [], reputationScores: {} },
      ],
      pendingSuccession: {
        deceasedId: 'pc-1', deceasedName: 'Marcus', deceasedAge: 60,
        rememberedDetail: 'who lived a private life', eligibleHeirIds: ['heir-1'],
      },
    }) as any;
    const patch = applyEffectString('succeedPaterfamilias:default', state);
    expect(patch.regency!.regentId).toBeNull();
    expect(patch.family!.find(c => c.id === 'heir-1')?.isPlayer).toBe(true);
  });
});

// ─── Phase 3, Chunk P3-D — cadet-branch effect-string tokens ────────────────

describe('applyEffectString — continueAsCadet / setPendingEpilogue / cadetStanding / cadetVisited tokens', () => {
  const cadet = {
    id: 'cadet-1', name: 'Quintus Brutia', age: 30,
    skills: { rhetoric: 3, martial: 3, intrigus: 3 },
    trait: 'cautious' as const, characterization: 'careful with money',
    metCount: 0, standing: 40, alive: true,
  };

  test('continueAsCadet promotes state.cadetBranch into a fresh family and sets cadetBranchUsed/legacyPenaltyMult', () => {
    const state = makeState({ cadetBranch: cadet, family: [] }) as any;
    const patch = applyEffectString('continueAsCadet', state);
    expect(patch.family).toHaveLength(2);
    expect(patch.family![0].isPlayer || patch.family![1].isPlayer).toBe(true);
    expect(patch.cadetBranchUsed).toBe(true);
    expect(patch.legacyPenaltyMult).toBe(BALANCE.cadet.legacyPenaltyMult);
  });

  test('continueAsCadet is a safe no-op when cadetBranch is null', () => {
    const state = makeState({ cadetBranch: null, family: [] }) as any;
    const patch = applyEffectString('continueAsCadet', state);
    expect(patch.family).toBeUndefined();
    expect(patch.cadetBranchUsed).toBeUndefined();
  });

  test('setPendingEpilogue:gens_ends sets the field directly', () => {
    const state = makeState() as any;
    const patch = applyEffectString('setPendingEpilogue:gens_ends', state);
    expect(patch.pendingEpilogue).toBe('gens_ends');
  });

  test('cadetStanding+N/-N clamps to 0..100', () => {
    const state = makeState({ cadetBranch: cadet }) as any;
    const up = applyEffectString('cadetStanding+50', state);
    expect(up.cadetBranch!.standing).toBe(90);
    const down = applyEffectString('cadetStanding-90', state);
    expect(down.cadetBranch!.standing).toBe(0);
  });

  test('cadetVisited increments metCount and sets the exhausted flag at BALANCE.cadet.maxVisits', () => {
    const almostDone = { ...cadet, metCount: BALANCE.cadet.maxVisits - 1 };
    const state = makeState({ cadetBranch: almostDone }) as any;
    const patch = applyEffectString('cadetVisited', state);
    expect(patch.cadetBranch!.metCount).toBe(BALANCE.cadet.maxVisits);
    expect(patch.flags!['cadet-visits-exhausted']).toBe(true);
  });

  test('cadetVisited below the cap does not set the exhausted flag', () => {
    const state = makeState({ cadetBranch: cadet }) as any; // metCount: 0
    const patch = applyEffectString('cadetVisited', state);
    expect(patch.cadetBranch!.metCount).toBe(1);
    expect(patch.flags?.['cadet-visits-exhausted']).toBeUndefined();
  });
});
