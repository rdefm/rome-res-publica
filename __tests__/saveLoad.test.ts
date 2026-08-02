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
    const stateWithUi = {
      ...useGameStore.getState(),
      agendaVisible: true,
      uiNavRequest: { tab: 'Domus' },
      // Curia Tab Redesign, Chunk C2 — same transient pattern as
      // selectedTrialId/basilicaReturnTab, which this test didn't
      // previously cover either; added here alongside the new field.
      curiaSubTabRequest: 'leges',
      curiaBillTargetRequest: 'bill-test',
    };
    await saveProvider.save(stateWithUi as any);
    const raw = await AsyncStorage.getItem('rome_save_v1');
    const parsed = JSON.parse(raw as string);
    expect(parsed.agendaVisible).toBeUndefined();
    expect(parsed.uiNavRequest).toBeUndefined();
    expect(parsed.curiaSubTabRequest).toBeUndefined();
    expect(parsed.curiaBillTargetRequest).toBeUndefined();
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

// ─── Ambition system rework, ticket 06 — save schema + migration ───────────
// `ambitions` was never in SaveSchema before this ticket (verified by grep,
// plan §0.6) — nothing validated it, it just round-tripped raw. This closes
// that gap for the new ActiveAmbition/AmbitionOffer shape while still
// letting a pre-rework save (old definitionId/turnActivated shape, deleted
// ticket 01) load cleanly, with its unconvertable ambitions dropped silently
// by gameStore.loadGame rather than the whole save being rejected.

describe('Ambition save schema + migration', () => {
  const freshAmbition = {
    id: 'amb-1',
    scope: 'family',
    source: 'player',
    title: 'Hold 500 Denarii',
    criterion: { id: 'resource_threshold', resource: 'denarii', amount: 500 },
    baseline: { value: 200, turnNumber: 3 },
    status: 'active',
    turnSet: 3,
    deadlineTurn: 7,
    reward: { lifetimeDignitas: 4, fides: 2 },
    failureDignitas: -2,
    refusable: true,
  };

  const oldShapeAmbition = {
    definitionId: 'grand_estate',
    scope: 'family',
    status: 'active',
    turnActivated: 2,
    turnsRemaining: 6,
  };

  test('SaveSchema accepts a fresh-shape ambitions array and pendingAmbitionOffers', () => {
    const withFreshAmbitions = {
      year: -264, turnNumber: 3, seasonIndex: 0,
      fides: 30, denarii: 200, crisisLevel: 0,
      family: [{ id: 'pc-1', name: 'Marcus' }],
      bills: [], clans: [],
      lifetimeDignitas: 0,
      ambitions: [freshAmbition],
      pendingAmbitionOffers: {
        character: {
          id: 'offer-1', scope: 'character', title: 'Win the Consulship',
          criterion: { id: 'office_held', officeId: 'consul' },
          deadlineSeasons: 8, turnOffered: 3,
        },
      },
    };
    expect(() => SaveSchema.parse(withFreshAmbitions)).not.toThrow();
  });

  test('SaveSchema does not reject a save whose ambitions carry the pre-rework shape', () => {
    const withOldAmbitions = {
      year: -264, turnNumber: 3, seasonIndex: 0,
      fides: 30, denarii: 200, crisisLevel: 0,
      family: [{ id: 'pc-1', name: 'Marcus' }],
      bills: [], clans: [],
      lifetimeDignitas: 0,
      ambitions: [oldShapeAmbition],
    };
    expect(() => SaveSchema.parse(withOldAmbitions)).not.toThrow();
  });

  function roundTrip(state: unknown) {
    return JSON.parse(JSON.stringify(state));
  }

  test('loadGame round-trips a fresh-shape save keeping its ambitions intact', () => {
    useGameStore.getState().startGame('standard');
    const base = useGameStore.getState();
    const stateWithAmbitions = { ...base, ambitions: [freshAmbition] };
    const roundTripped = roundTrip(stateWithAmbitions);
    expect(() => SaveSchema.parse(roundTripped)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(roundTripped)).not.toThrow();
    expect(useGameStore.getState().ambitions).toEqual([freshAmbition]);
  });

  test('loadGame silently drops pre-rework-shape ambitions, leaving the slot empty', () => {
    useGameStore.getState().startGame('standard');
    const base = useGameStore.getState();
    const stateWithOldAmbitions = { ...base, ambitions: [oldShapeAmbition] };
    const roundTripped = roundTrip(stateWithOldAmbitions);
    expect(() => SaveSchema.parse(roundTripped)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(roundTripped)).not.toThrow();
    expect(useGameStore.getState().ambitions).toEqual([]);
  });

  test('a save from immediately before the rework (no ambitions key at all) still loads', () => {
    useGameStore.getState().startGame('standard');
    const base = useGameStore.getState() as any;
    const { ambitions: _omitted, pendingAmbitionOffers: _omitted2, ...preReworkState } = base;
    const roundTripped = roundTrip(preReworkState);
    expect(() => SaveSchema.parse(roundTripped)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(roundTripped)).not.toThrow();
    expect(useGameStore.getState().ambitions).toEqual([]);
    expect(useGameStore.getState().pendingAmbitionOffers).toEqual({});
  });
});

// Tutorial rebuild, ticket 04 — 'beat-house' added to the tutorial.activeArc
// enum, plus the new agendaTabletUnlocked field (split off
// philonAdvisoryUnlocked — see both fields' own doc comments on GameState).
describe('Beat I save schema (tutorial rebuild, ticket 04)', () => {
  test('SaveSchema accepts activeArc: "beat-house" and a mid-Beat-I save loads correctly', () => {
    useGameStore.getState().startGame('guided');
    useGameStore.setState({ denarii: 220 });
    const midBeatHouse = JSON.parse(JSON.stringify(useGameStore.getState()));
    expect(midBeatHouse.tutorial.activeArc).toBe('beat-house');
    expect(midBeatHouse.agendaTabletUnlocked).toBe(false);

    expect(() => SaveSchema.parse(midBeatHouse)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(midBeatHouse)).not.toThrow();
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-house');
    expect(s.denarii).toBe(220);
    expect(s.agendaTabletUnlocked).toBe(false);
  });

  test('a save written before ticket 04 (no agendaTabletUnlocked key) defaults to unlocked, matching pre-split behavior', () => {
    useGameStore.getState().startGame('standard');
    const base = useGameStore.getState() as any;
    const { agendaTabletUnlocked: _omitted, ...preTicket04State } = base;
    const roundTripped = JSON.parse(JSON.stringify(preTicket04State));

    expect(() => SaveSchema.parse(roundTripped)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(roundTripped)).not.toThrow();
    expect(useGameStore.getState().agendaTabletUnlocked).toBe(true);
  });
});

// Tutorial rebuild, ticket 05 — 'beat-chamber' added to the tutorial.activeArc
// enum (models/tutorial.ts's TutorialArcId, saveLoad.ts's own z.enum). Same
// discipline as the Beat I block above.
describe('Beat II save schema (tutorial rebuild, ticket 05)', () => {
  test('SaveSchema accepts activeArc: "beat-chamber" and a mid-Beat-II save loads correctly', () => {
    useGameStore.getState().startGame('guided');
    useGameStore.getState().startTutorialArc('beat-chamber');
    useGameStore.getState().advanceTutorialStep(); // beat-chamber.intro -> bill-list
    const midBeatChamber = JSON.parse(JSON.stringify(useGameStore.getState()));
    expect(midBeatChamber.tutorial.activeArc).toBe('beat-chamber');
    expect(midBeatChamber.tutorial.stepId).toBe('beat-chamber.bill-list');

    expect(() => SaveSchema.parse(midBeatChamber)).not.toThrow();
    expect(() => useGameStore.getState().loadGame(midBeatChamber)).not.toThrow();
    const s = useGameStore.getState();
    expect(s.tutorial.activeArc).toBe('beat-chamber');
    expect(s.tutorial.stepId).toBe('beat-chamber.bill-list');
  });
});
