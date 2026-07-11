import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { z } from 'zod';
import type { GameState } from './gameStore';

const SAVE_KEY = 'rome_save_v1';

// Minimal Zod schema — validates the shape is correct before loading
const SaveSchema = z.object({
  year: z.number(),
  turnNumber: z.number(),
  seasonIndex: z.number().min(0).max(3),
  fides: z.number(),
  denarii: z.number(),
  crisisLevel: z.number().min(0).max(100),
  family: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  bills: z.array(z.any()),
  clans: z.array(z.any()),
  // Phase 4, Chunk P4-A — .default([]) ensures pre-P4-A saves load cleanly.
  secrets: z.array(z.any()).default([]),
  // .default([]) ensures save files created before this feature load cleanly
  clients: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['muscle', 'publicSupport', 'votingSway']),
    acquiredTurn: z.number(),
  })).default([]),
  ownedAssets: z.array(z.object({
    definitionId: z.string(),
    currentTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    assignedCharacterId: z.string().optional(),
    turnAcquired: z.number(),
  })).default([]),
  familyReputations: z.record(z.string(), z.number()).default({}),
  lifetimeDignitas: z.number(),
  legacyObjectives: z.array(z.object({
    definitionId: z.string(),
    currentValue: z.number(),
    milestonesReached: z.array(z.number()),
  })).default([]),
  // Legacy shape (pre-P4-C saves) — kept optional so old saves still
  // validate; gameStore.loadGame migrates any entries here into `trials`
  // (mirrors the wars/P3-A per-element migration pattern).
  trialQueue: z.array(z.object({
    id: z.string(),
    accusedCharacterId: z.string(),
    accusingClanId: z.string(),
    charge: z.string(),
    defenseStrength: z.number(),
    prosecutionStrength: z.number(),
    turnsRemaining: z.number(),
    resolved: z.boolean(),
    outcome: z.string().optional(),
    actionsUsed: z.array(z.string()),
  })).default([]).optional(),
  // Phase 4, Chunk P4-C — the unified TrialState pipeline. .default([])
  // ensures pre-P4-C saves (which have trialQueue instead) load cleanly.
  trials: z.array(z.any()).default([]),
  // P2-A instrumentation — .default()s ensure pre-Phase-2 saves load cleanly.
  seasonStartedAt: z.number().default(() => Date.now()),
  actionsThisSeason: z.number().default(0),
  fidesSpentThisSeason: z.number().default(0),
  denariiSpentThisSeason: z.number().default(0),
  seasonStatsHistory: z.array(z.any()).default([]),
  // P2-C — rate-limits trainCharacter to once/season.
  trainedThisSeason: z.array(z.string()).default([]),
  // P2-F — Munificence. .default()s ensure pre-Phase-2-F saves load cleanly.
  endowments: z.array(z.string()).default([]),
  munificenceUsage: z.record(z.string(), z.object({
    lastUsedTurn: z.number().optional(),
    usesThisYear: z.number().optional(),
    totalUses: z.number().optional(),
  })).default({}),
  grandGamesVoteBonus: z.number().default(0),
  grandGamesBonusYearsUntilDecay: z.number().default(0),
  // Military Overhaul M9 — .default([]) ensures pre-M9 saves load cleanly.
  // M10 grew WarState.treaty's inner shape (stage/resolvedTurn/initiator on
  // TreatyState) and TREATY_TERMS-referencing termIds — still covered by
  // this z.any() element type, so no schema change was needed for that part.
  // `provinces` (which M10's treaty engine can now add Sicily entries to)
  // isn't listed in this schema at all and never was — like every other
  // unlisted GameState field, it passes through unvalidated: parse() here is
  // a validation gate only, its result is discarded (see load()/importSave()
  // below, which both return the original `parsed` object, not the parsed
  // schema value), so unlisted fields are never stripped.
  wars: z.array(z.any()).default([]),
  // Phase 3, Chunk P3-A — .default(null) ensures pre-P3-A saves load cleanly.
  // Widened by P3-D ('gens_ends') and P3-E ('republic_falls') — see
  // gameStore.ts's field comment; now matches models/epilogue.ts's full
  // EpilogueOutcome.
  pendingEpilogue: z.enum(['victory', 'exhaustion', 'humbled', 'republic_falls', 'gens_ends']).nullable().default(null),
  // Phase 3, Chunk P3-C — .default(null) ensures pre-P3-C saves load cleanly.
  pendingSuccession: z.any().nullable().default(null),
  regency: z.any().nullable().default(null),
  // Phase 3, Chunk P3-D — .default()s ensure pre-P3-D saves load cleanly;
  // loadGame's normalisation (gameStore.ts) backfills a real cadetBranch
  // for an in-progress legacy save (a missing one would silently disable
  // the extinction safety net otherwise).
  cadetBranch: z.any().nullable().default(null),
  cadetBranchUsed: z.boolean().default(false),
  legacyPenaltyMult: z.number().default(1),
  // Phase 3, Chunk P3-E — .default()s ensure pre-P3-E saves load cleanly.
  // A save from before these fields existed has no way to know its true
  // highest office/generation count — null/1 are honest "unknown" defaults,
  // not retroactively computed.
  highestOfficeEverHeld: z.any().nullable().default(null),
  paterfamiliasGenerations: z.number().default(1),
  gensFoundedYear: z.number().default(-264),
  runFinished: z.boolean().default(false),
  currentEpilogueRecord: z.any().nullable().default(null),
  // Phase 3, Chunk P3-F — .default(false) ensures pre-P3-F saves load cleanly.
  endlessMode: z.boolean().default(false),
});

export interface SaveProvider {
  save(state: GameState): Promise<void>;
  load(): Promise<GameState | null>;
}

export class LocalSaveProvider implements SaveProvider {
  async save(state: GameState): Promise<void> {
    // Strip UI-only fields that should never persist across sessions.
    // agendaVisible / uiNavRequest / activeEvent are transient modal state.
    // Military Overhaul M5: a battle in progress does not survive an app
    // restart — same treatment as activeEvent (re-enter/re-launch instead).
    const {
      agendaVisible: _av,
      uiNavRequest:  _unr,
      activeEvent:   _ae,
      activeBattle:      _ab,
      activeBattleSetup: _abs,
      activeBattleBridgeCtx: _abbc,
      selectedTrialId: _sti,
      ...persistedState
    } = state as any;
    const json = JSON.stringify(persistedState);
    await AsyncStorage.setItem(SAVE_KEY, json);
  }

  async load(): Promise<GameState | null> {
    try {
      const raw = await AsyncStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      SaveSchema.parse(parsed); // throws if invalid
      return parsed as GameState;
    } catch (e) {
      console.warn('Save load failed or corrupted:', e);
      return null;
    }
  }
}

/**
 * Lightweight check — reads just the key without deserialising the save.
 * Used by StartMenuScreen to conditionally show the Continue button.
 */
export async function hasSave(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SAVE_KEY);
    return raw !== null;
  } catch {
    return false;
  }
}

export async function exportSave(state: GameState): Promise<void> {
  try {
    const json = JSON.stringify(state, null, 2);
    const filename = `rome-save-${Date.now()}.json`;
    const uri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri);
    }
  } catch (e) {
    console.error('Export failed:', e);
  }
}

export async function importSave(): Promise<GameState | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
    if (result.canceled) return null;

    const uri = result.assets[0].uri;
    const raw = await FileSystem.readAsStringAsync(uri);
    const parsed = JSON.parse(raw);
    SaveSchema.parse(parsed);
    return parsed as GameState;
  } catch (e) {
    console.error('Import failed:', e);
    return null;
  }
}

export const saveProvider = new LocalSaveProvider();
