// ─── Phase 5, Chunk P5-G — Difficulty Presets ───────────────────────────────
// Covers: the two seams (calcResourceIncome's incomeMult,
// calcIndividualEscalation's crisisMult) apply the exact BALANCE.difficulty
// multiplier and nowhere else — cascade deltas, military-bill-pressure, and
// event-driven effect-string resource/crisis changes are all identical
// across presets; a 12-auto-season crisis drift shows Ferox ≥ Aequus ≥
// Clemens; AncestorRecord carries difficulty; old saves default to Aequus.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import { calcResourceIncome, applyEffectString } from '../src/engine/resourceEngine';
import { calcIndividualEscalation, calcCascadeDeltas, checkMilitaryBillPressure } from '../src/engine/crisisEngine';
import { processSeason } from '../src/engine/turnSequencer';
import { buildAncestorRecord } from '../src/engine/epilogueEngine';
import { BALANCE } from '../src/data/balance';
import { ALT_FAMILIES } from '../src/data/altFamilies';
import type { DifficultyId } from '../src/models/gameStart';
import type { Client } from '../src/models/client';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCrisisTrack(id: string, level = 0) {
  return { id, level, tier: 0 as const, namedCrisis: null };
}
const CRISIS_ALL_ZERO = {
  war: makeCrisisTrack('war'), unrest: makeCrisisTrack('unrest'),
  constitution: makeCrisisTrack('constitution'), economy: makeCrisisTrack('economy'),
};

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-1', name: 'A Client', type: 'publicSupport',
    flavourTitle: '', flavourText: '', bonus: {}, acquiredTurn: 1,
    ...overrides,
  };
}

/** A fully-neutral income baseline: Rome stats in their zero-modifier bands
 *  (stability/plebs 40-70, treasury 25-65), no clans/provinces/assets/
 *  endowments, one client carrying a controlled, well-separated bonus so the
 *  pre-multiplier raw income is deterministic and large enough that
 *  ×0.85/×1.0/×1.15 and ×0.9/×1.0/×1.2 round to three distinct integers. */
function makeIncomeState(difficulty: DifficultyId): GameState {
  return {
    ...INITIAL_STATE,
    difficulty,
    rome: { stability: 50, plebs: 50, treasury: 50 },
    crisis: CRISIS_ALL_ZERO,
    clans: [],
    provinces: [],
    ownedAssets: [],
    endowments: [],
    clients: [makeClient({ bonus: { fides: 20, gold: 20 } })],
  } as unknown as GameState;
}

/** A state guaranteed to produce a nonzero calcIndividualEscalation('unrest', ...)
 *  delta (plebs < 20 → +6), isolated from provinces/clients that could add
 *  their own unrest terms. */
function makeEscalationState(difficulty: DifficultyId): GameState {
  return {
    ...INITIAL_STATE,
    difficulty,
    rome: { stability: 50, plebs: 15, treasury: 50 },
    provinces: [],
    clients: [],
    flags: {},
  } as unknown as GameState;
}

// ─── The income seam ─────────────────────────────────────────────────────────

describe('resourceEngine.calcResourceIncome — the income seam', () => {
  test('fidesIncome and denariiIncome scale by exactly BALANCE.difficulty[...].incomeMult', () => {
    const aequus  = calcResourceIncome(makeIncomeState('aequus'));
    const clemens = calcResourceIncome(makeIncomeState('clemens'));
    const ferox   = calcResourceIncome(makeIncomeState('ferox'));

    // Sanity: the fixture actually produces a meaningful, well-separated
    // baseline (not 0 — which would make every multiplier trivially "pass").
    expect(aequus.fidesIncome).toBeGreaterThan(10);
    expect(aequus.denariiIncome).toBeGreaterThan(10);

    expect(clemens.fidesIncome).toBe(Math.max(0, Math.round(aequus.fidesIncome * BALANCE.difficulty.clemens.incomeMult)));
    expect(ferox.fidesIncome).toBe(Math.max(0, Math.round(aequus.fidesIncome * BALANCE.difficulty.ferox.incomeMult)));
    expect(clemens.denariiIncome).toBe(Math.round(aequus.denariiIncome * BALANCE.difficulty.clemens.incomeMult));
    expect(ferox.denariiIncome).toBe(Math.round(aequus.denariiIncome * BALANCE.difficulty.ferox.incomeMult));

    // Distinct — proves the multipliers aren't silently collapsing via rounding.
    expect(new Set([clemens.fidesIncome, aequus.fidesIncome, ferox.fidesIncome]).size).toBe(3);
    expect(clemens.fidesIncome).toBeGreaterThan(aequus.fidesIncome);
    expect(aequus.fidesIncome).toBeGreaterThan(ferox.fidesIncome);
  });

  test('a state with no difficulty field behaves exactly as Aequus (?? fallback covers fixtures/old saves)', () => {
    const state = { ...makeIncomeState('aequus') } as any;
    delete state.difficulty;
    const withoutField = calcResourceIncome(state);
    const aequus = calcResourceIncome(makeIncomeState('aequus'));
    expect(withoutField).toEqual(aequus);
  });
});

// ─── The crisis seam ──────────────────────────────────────────────────────────

describe('crisisEngine.calcIndividualEscalation — the crisis seam', () => {
  test('the per-track delta scales by exactly BALANCE.difficulty[...].crisisMult', () => {
    const aequus  = calcIndividualEscalation('unrest', makeEscalationState('aequus'));
    const clemens = calcIndividualEscalation('unrest', makeEscalationState('clemens'));
    const ferox   = calcIndividualEscalation('unrest', makeEscalationState('ferox'));

    expect(aequus).toBe(6); // plebs < 20 -> +6, unscaled at Aequus (mult 1.0)
    expect(clemens).toBe(Math.round(aequus * BALANCE.difficulty.clemens.crisisMult));
    expect(ferox).toBe(Math.round(aequus * BALANCE.difficulty.ferox.crisisMult));
    expect(ferox).toBeGreaterThan(aequus);
    expect(aequus).toBeGreaterThan(clemens);
  });

  test('a state with no difficulty field behaves exactly as Aequus', () => {
    const state = { ...makeEscalationState('aequus') } as any;
    delete state.difficulty;
    expect(calcIndividualEscalation('unrest', state)).toBe(calcIndividualEscalation('unrest', makeEscalationState('aequus')));
  });
});

// ─── Everything else stays untouched ─────────────────────────────────────────

describe('difficulty touches exactly these two seams and nothing else', () => {
  test('calcCascadeDeltas and checkMilitaryBillPressure take no GameState/difficulty input at all', () => {
    // Structural guarantee, not just a behavioral one: neither function's
    // signature accepts a GameState, so there is no seam here to leak into.
    const cascade = calcCascadeDeltas({
      war: makeCrisisTrack('war', 65), unrest: makeCrisisTrack('unrest', 20),
      constitution: makeCrisisTrack('constitution', 20), economy: makeCrisisTrack('economy', 65),
    } as any);
    expect(cascade).toEqual({ war: 0, unrest: 2, constitution: 0, economy: 0 });

    const pressure = checkMilitaryBillPressure(
      { war: { ...makeCrisisTrack('war', 55), tier: 2 }, unrest: makeCrisisTrack('unrest'), constitution: makeCrisisTrack('constitution'), economy: makeCrisisTrack('economy') } as any,
      []
    );
    expect(pressure).toBe(5); // tier 2, no military bill passed — flat, authored magnitude
  });

  test('applyEffectString\'s resource and crisis-track tokens are identical regardless of difficulty', () => {
    const base = { ...INITIAL_STATE, crisis: CRISIS_ALL_ZERO } as unknown as GameState;
    const clemens = applyEffectString('fides+10|crisis-unrest+5', { ...base, difficulty: 'clemens' } as GameState);
    const ferox   = applyEffectString('fides+10|crisis-unrest+5', { ...base, difficulty: 'ferox' } as GameState);

    expect(clemens.fides).toBe(ferox.fides);
    expect(clemens.crisis!.unrest.level).toBe(ferox.crisis!.unrest.level);
    expect(clemens.fides).toBe(INITIAL_STATE.fides + 10);
    expect(clemens.crisis!.unrest.level).toBe(5);
  });
});

// ─── 12 auto-seasons — monotonic crisis drift ────────────────────────────────

describe('12-season crisis drift ordering across presets', () => {
  test('Ferox drifts hotter than Aequus, which drifts hotter than Clemens, from an identical seed', () => {
    function seed(difficulty: DifficultyId): GameState {
      return {
        ...INITIAL_STATE,
        difficulty,
        rome: { stability: 50, plebs: 15, treasury: 8 }, // sustained pressure on Unrest + Economy
        crisis: CRISIS_ALL_ZERO,
        provinces: [],
        clients: [],
        flags: {},
      } as unknown as GameState;
    }

    function runSeasons(state: GameState, n: number): GameState {
      let s = state;
      for (let i = 0; i < n; i++) {
        s = processSeason(s).nextState;
      }
      return s;
    }

    const clemensEnd = runSeasons(seed('clemens'), 12);
    const aequusEnd  = runSeasons(seed('aequus'), 12);
    const feroxEnd   = runSeasons(seed('ferox'), 12);

    expect(feroxEnd.crisisLevel).toBeGreaterThan(aequusEnd.crisisLevel);
    expect(aequusEnd.crisisLevel).toBeGreaterThan(clemensEnd.crisisLevel);
  });
});

// ─── AncestorRecord carries difficulty ───────────────────────────────────────

describe('epilogueEngine.buildAncestorRecord — difficulty on the record', () => {
  test('the run\'s difficulty is copied onto the AncestorRecord (no score multiplier applied)', () => {
    const state = {
      ...INITIAL_STATE, difficulty: 'ferox', lifetimeDignitas: 50, legacyPenaltyMult: 1,
      highestOfficeEverHeld: null, heldOffices: [], paterfamiliasGenerations: 1, family: [],
    } as unknown as GameState;
    const record = buildAncestorRecord(state, 'exhaustion');
    expect(record.difficulty).toBe('ferox');
    // No score multiplier (design invariant 3's spirit) — finalLegacy is
    // exactly lifetimeDignitas * legacyPenaltyMult, unaffected by preset.
    expect(record.finalLegacy).toBe(50);
  });
});

// ─── Old saves default to Aequus ─────────────────────────────────────────────

describe('gameStore.loadGame — difficulty default-spread for pre-P5-G saves', () => {
  test('a save with no difficulty field loads as aequus', () => {
    const legacySave: any = {
      ...INITIAL_STATE,
      family: [{ id: 'pc-1', name: 'Marcus Brutus', isPlayer: true, role: 'paterfamilias' }],
    };
    delete legacySave.difficulty;

    useGameStore.getState().loadGame(legacySave);
    expect(useGameStore.getState().difficulty).toBe('aequus');
  });

  test('a save that already has a difficulty field preserves it on load', () => {
    const feroxSave: any = {
      ...INITIAL_STATE, difficulty: 'ferox',
      family: [{ id: 'pc-1', name: 'Marcus Brutus', isPlayer: true, role: 'paterfamilias' }],
    };
    useGameStore.getState().loadGame(feroxSave);
    expect(useGameStore.getState().difficulty).toBe('ferox');
  });
});

// ─── Alt families (P5-E) × difficulty (P5-G) compose correctly ─────────────
// Follow-up check requested after the P5-G chunk: StartMenuScreen routes
// duilia/manlia through the same handleStartPress -> picker -> startGame(id,
// mode, difficulty) path as 'standard' (no special-casing in the component),
// so this exercises that exact call shape directly against the store.

describe('alt families x difficulty — the two P5 chunks compose without clobbering each other', () => {
  test('duilia at Ferox keeps its full family stateOverrides bundle and the chosen difficulty', () => {
    useGameStore.getState().startGame('duilia', 'senator', 'ferox');
    const s = useGameStore.getState();

    expect(s.gensId).toBe('duilia');
    expect(s.gensPlural).toBe('Duilii');
    expect(s.denarii).toBe(ALT_FAMILIES.duilia.denarii); // starting grant unscaled — not a seam
    expect(s.family.find(c => c.isPlayer)?.name).toBe('Gaius Duilius');
    expect(s.difficulty).toBe('ferox');
  });

  test('manlia at Clemens keeps its full family stateOverrides bundle and the chosen difficulty', () => {
    useGameStore.getState().startGame('manlia', 'senator', 'clemens');
    const s = useGameStore.getState();

    expect(s.gensId).toBe('manlia');
    expect(s.gensPlural).toBe('Manlii');
    expect(s.family.find(c => c.isPlayer)?.name).toBe('Titus Manlius');
    expect(s.family.find(c => c.isPlayer)?.corruptionScore).toBe(BALANCE.altFamilies.manlia.startingCorruption);
    expect(s.difficulty).toBe('clemens');
  });

  test('unlike guided, alt families are NOT locked to Aequus', () => {
    useGameStore.getState().startGame('duilia', 'senator', 'ferox');
    expect(useGameStore.getState().difficulty).toBe('ferox');
    useGameStore.getState().startGame('manlia', 'senator', 'ferox');
    expect(useGameStore.getState().difficulty).toBe('ferox');
  });

  test('a Duilia run at Ferox and at Clemens diverge in season income by exactly the seam multipliers', () => {
    useGameStore.getState().startGame('duilia', 'senator', 'clemens');
    const clemensIncome = calcResourceIncome(useGameStore.getState());

    useGameStore.getState().startGame('duilia', 'senator', 'ferox');
    const feroxIncome = calcResourceIncome(useGameStore.getState());

    useGameStore.getState().startGame('duilia', 'senator', 'aequus');
    const aequusIncome = calcResourceIncome(useGameStore.getState());

    expect(clemensIncome.fidesIncome).toBe(Math.max(0, Math.round(aequusIncome.fidesIncome * BALANCE.difficulty.clemens.incomeMult)));
    expect(feroxIncome.fidesIncome).toBe(Math.max(0, Math.round(aequusIncome.fidesIncome * BALANCE.difficulty.ferox.incomeMult)));
  });
});

// ─── gameStore.startGame — guided always resolves to Aequus ────────────────

describe('gameStore.startGame — guided ignores any difficulty argument', () => {
  test('guided always starts at aequus even if a different difficulty is passed', () => {
    useGameStore.getState().startGame('guided', 'senator', 'ferox' as DifficultyId);
    expect(useGameStore.getState().difficulty).toBe('aequus');
  });

  test('standard honors the passed difficulty', () => {
    useGameStore.getState().startGame('standard', 'senator', 'ferox');
    expect(useGameStore.getState().difficulty).toBe('ferox');
  });

  test('omitting difficulty defaults to aequus', () => {
    useGameStore.getState().startGame('standard', 'senator');
    expect(useGameStore.getState().difficulty).toBe('aequus');
  });
});
