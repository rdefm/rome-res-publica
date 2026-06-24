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
  gravitas: z.number(),
  dignitas: z.number(),
  gratia: z.number(),
  denarii: z.number(),
  crisisLevel: z.number().min(0).max(100),
  family: z.array(z.object({ id: z.string(), name: z.string() })).min(1),
  bills: z.array(z.any()),
  clans: z.array(z.any()),
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
  legacyObjectives: z.array(z.object({
    definitionId: z.string(),
    currentValue: z.number(),
    milestonesReached: z.array(z.number()),
  })).default([]),
});

export interface SaveProvider {
  save(state: GameState): Promise<void>;
  load(): Promise<GameState | null>;
}

export class LocalSaveProvider implements SaveProvider {
  async save(state: GameState): Promise<void> {
    const json = JSON.stringify(state);
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
