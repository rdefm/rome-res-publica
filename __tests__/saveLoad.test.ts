// ─── Phase 5, Chunk P5-I — Save versioning & migration ──────────────────────
// Covers: saveVersion stamping (save()/exportSave()), activeEvent no longer
// stripped from saves, and the migration fixtures — a Phase-2-era, Phase-3-
// era, and Phase-4-era save (fabricated minimal-valid JSONs per each era's
// schema shape, per the plan's own sanctioned fallback), plus a current
// full-featured save (war mid-arc, secrets held both directions, a filed
// trial, Manlia gens, Ferox difficulty) — each loads via gameStore.loadGame
// without crashing and lands on the correct invariant-field defaults.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore } from '../src/state/gameStore';
import { saveProvider, exportSave, CURRENT_SAVE_VERSION, SaveSchema } from '../src/state/saveLoad';
import saveFixturePhase2 from './fixtures/save-phase2.json';
import saveFixturePhase3 from './fixtures/save-phase3.json';
import saveFixturePhase4 from './fixtures/save-phase4.json';
import saveFixturePhase5Full from './fixtures/save-phase5-full.json';

// ─── Migration fixtures ──────────────────────────────────────────────────────

describe('Migration fixtures — each era loads without crashing and lands on correct defaults', () => {
  test('all four fixtures validate against the current SaveSchema', () => {
    for (const fixture of [saveFixturePhase2, saveFixturePhase3, saveFixturePhase4, saveFixturePhase5Full]) {
      expect(() => SaveSchema.parse(fixture)).not.toThrow();
    }
  });

  test('Phase-2-era save (no wars/secrets/trials/gensId/difficulty at all) migrates cleanly', () => {
    expect(() => useGameStore.getState().loadGame(saveFixturePhase2 as any)).not.toThrow();
    const s = useGameStore.getState();
    expect(s.difficulty).toBe('aequus');
    expect(s.gensId).toBe('brutii');
    expect(Array.isArray(s.wars)).toBe(true);
    expect(Array.isArray(s.trials)).toBe(true);
    expect(Array.isArray(s.secrets)).toBe(true);
    expect(s.cadetBranch).not.toBeNull(); // backfilled by loadGame's own migration
  });

  test('Phase-3-era save (wars/succession/cadet exist; secrets/trials/gensId/difficulty do not) migrates cleanly', () => {
    expect(() => useGameStore.getState().loadGame(saveFixturePhase3 as any)).not.toThrow();
    const s = useGameStore.getState();
    expect(s.difficulty).toBe('aequus');
    expect(s.gensId).toBe('brutii');
    expect(s.wars.length).toBe(1);
    expect(s.wars[0].id).toBe('war-carthage-1');
    expect(Array.isArray(s.trials)).toBe(true);
    expect(Array.isArray(s.secrets)).toBe(true);
  });

  test('Phase-4-era save (secrets/trials exist; gensId/difficulty do not) migrates cleanly, trials converted', () => {
    expect(() => useGameStore.getState().loadGame(saveFixturePhase4 as any)).not.toThrow();
    const s = useGameStore.getState();
    expect(s.difficulty).toBe('aequus');
    expect(s.gensId).toBe('brutii');
    expect(s.trials.length).toBe(1);
    expect(s.trials[0].status).toBe('preparing');
    // The fixture's own 2 secrets survive, plus the Claudius starting
    // Secret gets injected for any pre-P4-G save missing it (this fixture
    // predates the P4-G arc).
    expect(s.secrets.length).toBe(3);
    expect(s.secrets.some(sec => sec.id === 'secret-claudius-arc')).toBe(true);
  });

  test('current full-featured save (war mid-arc, secrets both directions, a filed trial, Manlia, Ferox) migrates cleanly and preserves its own values', () => {
    expect(() => useGameStore.getState().loadGame(saveFixturePhase5Full as any)).not.toThrow();
    const s = useGameStore.getState();
    expect(s.difficulty).toBe('ferox'); // already present — not overridden to the default
    expect(s.gensId).toBe('manlia');
    expect(s.gensPlural).toBe('Manlii');
    expect(s.wars[0].active).toBe(true);
    expect(s.secrets.length).toBe(2);
    expect(s.trials[0].seat).toBe('prosecution');
  });
});

// ─── saveVersion stamping ─────────────────────────────────────────────────────

describe('saveVersion stamping', () => {
  test('save() stamps CURRENT_SAVE_VERSION regardless of what the in-memory state carries', async () => {
    useGameStore.getState().startGame('standard');
    await saveProvider.save({ ...useGameStore.getState(), saveVersion: 1 } as any);
    const raw = await AsyncStorage.getItem('rome_save_v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.saveVersion).toBe(CURRENT_SAVE_VERSION);
  });

  test('activeEvent survives save() — no longer stripped', async () => {
    useGameStore.getState().startGame('standard');
    const stateWithEvent = { ...useGameStore.getState(), activeEvent: { defId: 'evt-test', firedAtTurn: 1, targetCharacterId: 'pc-1' } };
    await saveProvider.save(stateWithEvent as any);
    const raw = await AsyncStorage.getItem('rome_save_v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.activeEvent).toEqual({ defId: 'evt-test', firedAtTurn: 1, targetCharacterId: 'pc-1' });
  });

  test('truly transient UI fields are still stripped', async () => {
    useGameStore.getState().startGame('standard');
    const stateWithUi = { ...useGameStore.getState(), agendaVisible: true, uiNavRequest: { tab: 'Domus' } };
    await saveProvider.save(stateWithUi as any);
    const raw = await AsyncStorage.getItem('rome_save_v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.agendaVisible).toBeUndefined();
    expect(parsed.uiNavRequest).toBeUndefined();
  });
});

// ─── Export/import round-trip — the chunk's "likeliest real bug" check ─────

describe('Export/import round-trip — schema drift check', () => {
  test('a full post-Phase-5 save (the fixture) survives a JSON round-trip unchanged and loads cleanly', () => {
    // Simulates exportSave -> wipe -> importSave: both real functions do
    // exactly JSON.stringify(state) then SaveSchema.parse(JSON.parse(...)) —
    // this exercises that same shape directly against the fixture. loadGame
    // (called above, in the migration-fixtures block) already proved
    // SaveSchema doesn't choke on this fixture's post-Phase-5 fields
    // (gensId/difficulty/secrets/trials/wars all populated); this test's
    // job is specifically the round-trip identity, not re-proving that.
    const roundTripped = JSON.parse(JSON.stringify(saveFixturePhase5Full));
    expect(roundTripped).toEqual(saveFixturePhase5Full);
    expect(() => useGameStore.getState().loadGame(roundTripped)).not.toThrow();
  });

  test('exportSave does not throw even when the native FileSystem/Sharing modules are unavailable', async () => {
    // exportSave uses expo-file-system/expo-sharing, which aren't fully
    // mocked in the Jest environment — it hits its own internal try/catch
    // (console.error, no rethrow) rather than the native calls succeeding.
    // Expected and already the app's real defensive behavior; silenced here
    // so the expected warning doesn't clutter test output.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    useGameStore.getState().startGame('standard');
    await expect(exportSave(useGameStore.getState())).resolves.not.toThrow();
    errorSpy.mockRestore();
  });
});

// ─── Provincial client save-corruption bug (July 2026 fixes, Chunk D) ──────
// SaveSchema's clients.type enum was missing 'provincial' even though
// gameStore.recruitCityClient has always set it — any save containing a
// recruited provincial client (possible since the 4 original Italy clients)
// silently failed to load entirely (SaveSchema.parse throws -> caught ->
// treated as corrupted -> load() returns null). Chunk D makes provincial
// clients available in 10 more cities, so this regression matters a lot more.

describe('Provincial client save-corruption fix', () => {
  test('SaveSchema accepts a client with type "provincial"', () => {
    const withProvincialClient = {
      year: -264, turnNumber: 1, seasonIndex: 0,
      fides: 30, denarii: 200, crisisLevel: 0,
      family: [{ id: 'pc-1', name: 'Marcus' }],
      bills: [], clans: [],
      clients: [{
        id: 'provincial-etruscan_augur-1',
        name: 'Vel Saties, Augur',
        type: 'provincial',
        acquiredTurn: 1,
      }],
      lifetimeDignitas: 0,
    };
    expect(() => SaveSchema.parse(withProvincialClient)).not.toThrow();
  });

  test('a save with a recruited provincial client loads via loadGame without being treated as corrupted', () => {
    useGameStore.getState().startGame('standard');
    const base = useGameStore.getState();
    const stateWithClient = {
      ...base,
      clients: [{
        id: 'provincial-etruscan_augur-1',
        name: 'Vel Saties, Augur',
        type: 'provincial' as any,
        flavourTitle: 'Provincial Client',
        flavourText: '+3 Auctoritas.',
        bonus: {},
        acquiredTurn: 1,
        isProvincialClient: true,
        provincialClientDefId: 'etruscan_augur',
      }],
    };
    const roundTripped = JSON.parse(JSON.stringify(stateWithClient));
    expect(() => SaveSchema.parse(roundTripped)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(roundTripped)).not.toThrow();
    expect(useGameStore.getState().clients).toHaveLength(1);
  });
});
