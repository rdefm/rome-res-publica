import {
  calcResourceIncome,
  applyFactionDrift,
  calcCrisisEscalation,
  calcRomeStats,
} from '../src/engine/resourceEngine';
import { getCrisisInfo } from '../src/engine/crisisEngine';
import { scoreAction, chooseAction } from '../src/engine/aiScoring';
import { parseEffect } from '../src/models/bill';

// Minimal mock game state
const makeState = (overrides = {}) => ({
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
    const s = makeState({ crisisLevel: 0 });
    const { fidesIncome } = calcResourceIncome(s as any);
    expect(fidesIncome).toBe(12); // rhetoric 6 × 2
  });
  test('income floors at 0 under heavy crisis', () => {
    const s = makeState({ crisisLevel: 100 });
    const { fidesIncome } = calcResourceIncome(s as any);
    expect(fidesIncome).toBeGreaterThanOrEqual(0);
  });
  test('crisis level 20 reduces fides by 1', () => {
    const s0 = makeState({ crisisLevel: 0 });
    const s20 = makeState({ crisisLevel: 20 });
    const { fidesIncome: f0 } = calcResourceIncome(s0 as any);
    const { fidesIncome: f20 } = calcResourceIncome(s20 as any);
    expect(f0 - f20).toBe(1);
  });
  test('fides income includes office held bonus', () => {
    const s = makeState({ crisisLevel: 0 });
    s.family[0].officeId = 'aedile';
    const { fidesIncome } = calcResourceIncome(s as any);
    // base: rhetoric 6 × 2 = 12, aedile office bonus = +5
    expect(fidesIncome).toBe(12 + 5);
  });
  test('fides income includes allied clan leader bonus', () => {
    const s = makeState({
      crisisLevel: 0,
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

// ─── Crisis Engine ───────────────────────────────────────────────────────────
describe('getCrisisInfo', () => {
  test('0 crisis = Pax Romana, no penalties', () => {
    const info = getCrisisInfo(0);
    expect(info.title).toBe('Pax Romana');
    expect(info.fidesPenalty).toBe(0);
    expect(info.dignitasPenalty).toBe(0);
  });
  test('80+ crisis = EXISTENTIAL THREAT', () => {
    const info = getCrisisInfo(80);
    expect(info.title).toBe('EXISTENTIAL THREAT');
    expect(info.fidesPenalty).toBe(5);
    expect(info.dignitasPenalty).toBe(4);
  });
  test('crisis tiers are continuous and ascending', () => {
    const levels = [0, 19, 20, 39, 40, 59, 60, 79, 80, 100];
    const titles = levels.map((l) => getCrisisInfo(l).title);
    const uniqueTitles = [...new Set(titles)];
    expect(uniqueTitles.length).toBe(5);
  });
});

// ─── Crisis Escalation ───────────────────────────────────────────────────────
describe('calcCrisisEscalation', () => {
  test('no bills passed → crisis +8', () => {
    expect(calcCrisisEscalation(20, 0)).toBe(28);
  });
  test('bills passed → crisis -3', () => {
    expect(calcCrisisEscalation(20, 1)).toBe(17);
  });
  test('clamped to 0–100', () => {
    expect(calcCrisisEscalation(0, 1)).toBe(0);
    expect(calcCrisisEscalation(95, 0)).toBe(100);
  });
});

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
    const s = makeState({ crisisLevel: 0, rome: { stability: 50, plebs: 50, treasury: 50 } });
    const result = calcRomeStats(s as any, 1);
    expect(result.stability).toBeGreaterThan(50);
    expect(result.plebs).toBeGreaterThan(50);
  });
  test('no bills passed decreases stability', () => {
    const s = makeState({ crisisLevel: 0, rome: { stability: 50, plebs: 50, treasury: 50 } });
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
    // Run many times to account for noise
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
