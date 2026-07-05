import {
  calcResourceIncome,
  applyFactionDrift,
  calcRomeStats,
} from '../src/engine/resourceEngine';
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
  provinces: [],
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
