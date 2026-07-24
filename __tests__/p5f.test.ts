// ─── Phase 5, Chunk P5-F — Achievements ("Laurels") ─────────────────────────
// Covers: evaluateAchievements' state and outcome predicates (each seed
// Laurel from a fabricated matching state, idempotent re-evaluation,
// deterministic ordering — the toast queue's ordering guarantee, since this
// codebase has no React component test harness to drive AchievementToast
// itself), achievementStore's cross-run persistence (empty on a fresh
// install, round-trips a write, never touched by starting a new run), and
// the gameStore.endSeason integration (burnSecret -> flamma, via the real
// flags['secret-burned-ever'] write).

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { evaluateAchievements } from '../src/engine/achievementEngine';
import { ACHIEVEMENT_DEFINITIONS } from '../src/data/achievementDefinitions';
import {
  loadEarnedAchievements,
  recordEarnedAchievements,
  getCachedEarnedIds,
} from '../src/state/achievementStore';
import type { GameState } from '../src/state/gameStore';
import type { TrialState } from '../src/models/trial';
import type { Secret } from '../src/models/secret';
import type { AncestorRecord } from '../src/models/epilogue';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTrial(overrides: Partial<TrialState> = {}): TrialState {
  return {
    id: 'trial-1',
    seat: 'defense',
    charge: 'peculatus',
    chargeSource: 'accusation',
    prosecutor: { kind: 'leader', leaderId: 'leader-1' },
    defendant: { kind: 'family', characterId: 'pc-1' },
    filedSeason: 10,
    startsSeason: 13,
    playerPrep: { logos: 0, pathos: 0, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
    approach: 'procedure',
    speakerId: 'pc-1',
    npcStrength: 20,
    juryLean: 0,
    consumedSecretIds: [],
    status: 'resolved',
    session: null,
    ...overrides,
  };
}

function makeSecret(overrides: Partial<Secret> = {}): Secret {
  return {
    id: 'secret-1', type: 'affair', subject: { kind: 'family', characterId: 'pc-1' },
    holder: 'leader-1', potency: 2, status: 'held', acquiredSeason: 1,
    flavorText: 'a private matter', ...overrides,
  };
}

function makeRecord(overrides: Partial<AncestorRecord> = {}): AncestorRecord {
  return {
    id: 'r-1', gensName: 'Brutia', foundedYear: -264, endedYear: -250,
    outcome: 'exhaustion', finalLegacy: 10, legacyPenaltyApplied: false,
    highestOffice: null, generations: 1, notableBeats: [], familyTree: [],
    historianParagraph: 'x', recordedAt: 1,
    ...overrides,
  };
}

function makeState(overrides: Record<string, any> = {}): GameState {
  return { ...INITIAL_STATE, ...overrides } as unknown as GameState;
}

// ─── evaluateAchievements — state predicates ────────────────────────────────

describe('evaluateAchievements — a vanilla fresh-game state earns nothing', () => {
  test('INITIAL_STATE alone does not satisfy any Laurel', () => {
    expect(evaluateAchievements(makeState(), new Set())).toEqual([]);
  });
});

describe('evaluateAchievements — each seed Laurel fires from a matching state and never re-fires', () => {
  const cases: [string, Record<string, any>][] = [
    ['primus-honos', { highestOfficeEverHeld: 'quaestor' }],
    ['consul-gentis', { highestOfficeEverHeld: 'consul' }],
    ['triumphator', { flags: { 'triumph-granted-pc-1': true } }],
    ['patronus-maximus', { patronTier: 5 }],
    ['accusator', { trials: [makeTrial({ seat: 'prosecution', outcome: 'fined' })] }],
    ['vox-populi', { trials: [makeTrial({ seat: 'prosecution', outcome: 'fined', convictedSittingMagistrate: true })] }],
    ['absolvo', { trials: [makeTrial({ seat: 'defense', outcome: 'dismissed' })] }],
    ['flamma', { flags: { 'secret-burned-ever': true } }],
    ['araneus', {
      secrets: [
        makeSecret({ id: 's1', holder: 'player', status: 'held' }),
        makeSecret({ id: 's2', holder: 'player', status: 'extorting' }),
        makeSecret({ id: 's3', holder: 'player', status: 'held' }),
      ],
    }],
    ['munificus', { munificenceUsage: { 'grand-games': { totalUses: 1 } } }],
    ['midas', { legacyObjectives: [{ definitionId: 'treasury_legacy', currentValue: 2000, milestonesReached: [] }] }],
    ['gens-perennis', { paterfamiliasGenerations: 3 }],
    ['ramus-minor', { cadetBranchUsed: true }],
    ['sine-fine', { endlessMode: true }],
    ['novus-homo', { gensId: 'duilia', highestOfficeEverHeld: 'consul' }],
  ];

  test.each(cases)('%s', (id, overrides) => {
    const state = makeState(overrides);
    expect(evaluateAchievements(state, new Set())).toContain(id);
    // Idempotent — already-earned ids are never re-returned.
    expect(evaluateAchievements(state, new Set([id]))).not.toContain(id);
  });

  test('accusator does not fire for a defense win, and absolvo does not fire for an acquittal (not Dismissed)', () => {
    const defenseWin = makeState({ trials: [makeTrial({ seat: 'defense', outcome: 'acquitted' })] });
    expect(evaluateAchievements(defenseWin, new Set())).not.toContain('accusator');
    expect(evaluateAchievements(defenseWin, new Set())).not.toContain('absolvo');
  });

  test('araneus does not fire below 3 held/extorting player-held Secrets', () => {
    const state = makeState({
      secrets: [
        makeSecret({ id: 's1', holder: 'player', status: 'held' }),
        makeSecret({ id: 's2', holder: 'player', status: 'spent' }), // spent doesn't count
      ],
    });
    expect(evaluateAchievements(state, new Set())).not.toContain('araneus');
  });
});

// ─── evaluateAchievements — outcome predicates (epilogue-time) ─────────────

describe('evaluateAchievements — outcome predicates only fire with an epilogue record', () => {
  test('victoria-punica / pax-fessa / roma-humilis fire from a matching AncestorRecord', () => {
    expect(evaluateAchievements(makeState(), new Set(), makeRecord({ outcome: 'victory' }))).toContain('victoria-punica');
    expect(evaluateAchievements(makeState(), new Set(), makeRecord({ outcome: 'exhaustion' }))).toContain('pax-fessa');
    expect(evaluateAchievements(makeState(), new Set(), makeRecord({ outcome: 'humbled' }))).toContain('roma-humilis');
  });

  test('no outcome Laurel fires without a record, even at plain per-season checks', () => {
    const result = evaluateAchievements(makeState(), new Set());
    expect(result).not.toContain('victoria-punica');
    expect(result).not.toContain('pax-fessa');
    expect(result).not.toContain('roma-humilis');
  });

  test('an already-earned outcome Laurel is not re-returned at the epilogue call site', () => {
    const record = makeRecord({ outcome: 'victory' });
    expect(evaluateAchievements(makeState(), new Set(['victoria-punica']), record)).not.toContain('victoria-punica');
  });
});

// ─── Deterministic ordering — the toast queue's FIFO guarantee ─────────────

describe('evaluateAchievements — deterministic ordering', () => {
  test('multiple Laurels earned at once return in ACHIEVEMENT_DEFINITIONS order', () => {
    const state = makeState({
      patronTier: 5,           // patronus-maximus
      endlessMode: true,       // sine-fine
      cadetBranchUsed: true,   // ramus-minor
    });
    const result = evaluateAchievements(state, new Set());
    const definitionOrder = ACHIEVEMENT_DEFINITIONS.map(d => d.id);
    const resultIndices = result.map(id => definitionOrder.indexOf(id));
    expect(resultIndices).toEqual([...resultIndices].sort((a, b) => a - b));
    expect(result).toEqual(expect.arrayContaining(['patronus-maximus', 'sine-fine', 'ramus-minor']));
  });
});

// ─── achievementStore — cross-run persistence ──────────────────────────────

describe('achievementStore — cross-run persistence', () => {
  test('a fresh install (no key) initializes empty', async () => {
    const list = await loadEarnedAchievements();
    expect(list).toEqual([]);
    expect(getCachedEarnedIds().size).toBe(0);
  });

  test('recordEarnedAchievements updates the synchronous cache immediately and persists across a reload', async () => {
    await recordEarnedAchievements(['primus-honos']);
    expect(getCachedEarnedIds().has('primus-honos')).toBe(true);

    const reloaded = await loadEarnedAchievements();
    expect(reloaded.some(e => e.id === 'primus-honos')).toBe(true);
  });

  test('starting a new run never clears the achievements key', async () => {
    await recordEarnedAchievements(['midas']);
    useGameStore.getState().startGame('standard');

    const raw = await AsyncStorage.getItem('rome_achievements_v1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).some((e: any) => e.id === 'midas')).toBe(true);
  });
});

// ─── gameStore.endSeason — Laurel evaluation integration ──────────────────

describe('gameStore.endSeason — Laurel evaluation integration (P5-F)', () => {
  function burnAHeldSecret() {
    const s0 = useGameStore.getState();
    const leader = s0.clans[0].leaders[0];
    useGameStore.setState({
      secrets: [...s0.secrets, makeSecret({
        id: 'p5f-secret', holder: 'player',
        subject: { kind: 'leader', leaderId: leader.id }, status: 'held',
      })],
    } as any);
    useGameStore.getState().burnSecret('p5f-secret');
  }

  test('burning a Secret and ending the season earns and records the flamma Laurel', () => {
    useGameStore.getState().startGame('standard');
    burnAHeldSecret();
    expect(useGameStore.getState().flags['secret-burned-ever']).toBe(true);

    useGameStore.getState().endSeason();

    const s = useGameStore.getState();
    expect(s.lastSeasonLedger?.earnedLaurels).toContain('flamma');
    expect(getCachedEarnedIds().has('flamma')).toBe(true);
  });

  test('flamma is not re-earned (and not re-listed in the ledger) on a later season end', () => {
    useGameStore.getState().startGame('standard');
    burnAHeldSecret();
    useGameStore.getState().endSeason();

    useGameStore.getState().endSeason(); // second season — flag still true, already earned

    expect(useGameStore.getState().lastSeasonLedger?.earnedLaurels).not.toContain('flamma');
  });
});
