// ─── Achievement Store ────────────────────────────────────────────────────────
// Phase 5, Chunk P5-F — Laurels' cross-run persistence. A dedicated
// AsyncStorage key, sibling to ancestorStore.ts's Hall key with identical
// discipline: never cleared by starting a new run, finishing a run, or
// deleting the active save (see saveLoad.ts — this key isn't touched by any
// of that).
//
// Unlike the Hall (write-only from gameStore's perspective — only ever read
// by HallOfAncestorsScreen), evaluateAchievements needs a synchronous,
// already-earned id set inside gameStore.endSeason's synchronous action.
// AsyncStorage itself is inherently async, so this module keeps an in-memory
// mirror (`cache`) populated by loadEarnedAchievements() — App.tsx triggers
// that once on mount, well before a player can realistically reach a season
// end. getCachedEarnedIds() is a best-effort synchronous read of whatever
// the cache currently holds (empty until the first load resolves): a narrow
// startup race, not a correctness issue — Laurels are trophies only (design
// invariant 3), so a rare double-award just yields a second dated entry for
// the same id, which the Hall's Laurels section de-duplicates by id (keeping
// the earliest earnedAt) when rendering.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACHIEVEMENTS_KEY = 'rome_achievements_v1';

export interface EarnedAchievement {
  id: string;
  /** Date.now() at the moment recordEarnedAchievements wrote it. */
  earnedAt: number;
}

let cache: EarnedAchievement[] | null = null;

/** Reads the AsyncStorage key and populates the in-memory cache. Safe to
 *  call more than once (e.g. a slow first load racing a second mount). */
export async function loadEarnedAchievements(): Promise<EarnedAchievement[]> {
  try {
    const raw = await AsyncStorage.getItem(ACHIEVEMENTS_KEY);
    cache = raw ? (JSON.parse(raw) as EarnedAchievement[]) : [];
  } catch (e) {
    console.warn('[P5-F] Achievements read failed:', e);
    cache = cache ?? [];
  }
  return cache;
}

/** Synchronous best-effort read for evaluateAchievements' `alreadyEarned`
 *  argument — see the module header for the startup-race note. */
export function getCachedEarnedIds(): Set<string> {
  return new Set((cache ?? []).map(e => e.id));
}

/** Appends newly-earned ids (idempotent from the caller's side — only ever
 *  called with evaluateAchievements' "newly earned only" result) and
 *  persists. Updates the in-memory cache immediately so a second award
 *  later in the same session — before this write resolves — still sees it. */
export async function recordEarnedAchievements(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = Date.now();
  const additions: EarnedAchievement[] = ids.map(id => ({ id, earnedAt: now }));
  cache = [...(cache ?? []), ...additions];
  try {
    await AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[P5-F] Achievements write failed:', e);
  }
}
