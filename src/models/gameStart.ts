// ─── Start ID ─────────────────────────────────────────────────────────────────

/**
 * Identifies which start configuration launched the current game.
 * Phase 5, Chunk P5-E added 'duilia'/'manlia' — the anticipated "alternate
 * family" extension this type's own comment predicted. `startId` is written
 * to GameState but never read/compared anywhere else in the codebase
 * (verified) beyond the two hooks below, so extending this union is safe:
 *   (1) the new-game store action populates tutorialQueue from TUTORIAL_SCRIPTS
 *   (2) StartMenuScreen renders a picker card per definition.
 */
export type StartId = 'guided' | 'standard' | 'duilia' | 'manlia';

// ─── Gens ID (Phase 5, Chunk P5-E) ───────────────────────────────────────────

/**
 * Which starting family a run uses. Stored on GameState directly (not
 * derived from StartId at read time) since 'guided' and 'standard' are both
 * 'brutii' — see src/data/altFamilies.ts for Duilia/Manlia's full data and
 * unlock predicates.
 */
export type GensId = 'brutii' | 'duilia' | 'manlia';

// ─── Start definition ─────────────────────────────────────────────────────────

export interface StartDefinition {
  id: StartId;
  /** Short name shown as the card header. */
  name: string;
  /** One-line sub-header shown beneath the name. */
  subtitle: string;
  /** 2–3 sentences shown in the picker card body. */
  description: string;
  /** If true, a "Recommended" laurel badge is rendered on the picker card. */
  recommended: boolean;
  /**
   * Shallow-merged over INITIAL_STATE when this start begins a new game.
   * Typed as a loose record to avoid a circular dependency with gameStore.ts.
   * All values must be valid GameState field values; enforced at the call site.
   * Phase 5, Chunk P5-E — this was documented but never actually applied by
   * startGame; wired up this chunk (the exact extension point Duilia/Manlia
   * needed).
   */
  stateOverrides?: Record<string, unknown>;
  /**
   * Key into TUTORIAL_SCRIPTS in startDefinitions.ts.
   * When set, the new-game action copies the matching script into tutorialQueue.
   * Only the 'guided' start sets this.
   */
  tutorialScriptId?: string;
  /**
   * Phase 5, Chunk P5-E — plain-language unlock condition shown on a locked
   * start-menu card. Absent = always available (guided/standard).
   */
  unlockCondition?: string;
  /**
   * Phase 5, Chunk P5-E — pure predicate over the Hall of Ancestors; no
   * separate unlock flag to migrate or lose. `hall` is loosely typed
   * (AncestorRecord[] in practice) to avoid a circular dependency with
   * models/epilogue.ts, same rationale as stateOverrides' own loose typing.
   * Absent = always available.
   */
  isUnlocked?: (hall: any[]) => boolean;
}
