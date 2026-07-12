// ─── Ancestor Store ───────────────────────────────────────────────────────────
// Phase 3, Chunk P3-E — the Hall of Ancestors' cross-run persistence. A
// dedicated AsyncStorage key, separate from saveLoad.ts's SAVE_KEY, so
// starting a new run or deleting the active save never touches it (verified
// requirement: "the Hall key survives a save reset").

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AncestorRecord } from '../models/epilogue';

const HALL_KEY = 'rome_hall_of_ancestors_v1';

/** Most-recent-first. */
export async function loadHall(): Promise<AncestorRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HALL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AncestorRecord[];
  } catch (e) {
    console.warn('[P3-E] Hall of Ancestors read failed:', e);
    return [];
  }
}

/** Appends one record — called exactly once per finished run, from
 *  gameStore.endSeason's epilogue-detection block. */
export async function appendAncestorRecord(record: AncestorRecord): Promise<void> {
  const existing = await loadHall();
  const updated = [record, ...existing];
  await AsyncStorage.setItem(HALL_KEY, JSON.stringify(updated));
}
