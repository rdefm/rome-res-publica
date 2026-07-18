// ─── Phase 5, Chunk P5-F — Achievements ("Laurels") ─────────────────────────
// Types only, no logic — see engine/achievementEngine.ts for evaluation and
// data/achievementDefinitions.ts for the seed list. Trophies only (design
// invariant 3): nothing here grants a mechanical effect.

export interface AchievementDef {
  id: string;
  /** Display name — the Laurel's title. */
  name: string;
  /** The Latin phrase shown alongside the name. Identical to `name` for
   *  every seed entry (the seed set's names are already Latin), but kept as
   *  a separate field in case a future Laurel wants an English display name
   *  distinct from its Latin flavor. */
  latin: string;
  /** The exact earn condition, in plain words — shown for both earned and
   *  unearned rows (no hidden trophies). */
  description: string;
  /** A single emoji, matching the plain-emoji `icon` convention already used
   *  by data/offices.ts — not an imageKey into an asset lookup. */
  icon: string;
}
