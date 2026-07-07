// ─── Start ID ─────────────────────────────────────────────────────────────────

/**
 * Identifies which start configuration launched the current game.
 * Extend this union when new starts are added (e.g. 'alternate-family' in Phase 5).
 * Only two values branch on startId anywhere in the codebase:
 *   (1) the new-game store action populates tutorialQueue from TUTORIAL_SCRIPTS
 *   (2) StartMenuScreen renders a picker card per definition.
 */
export type StartId = 'guided' | 'standard';

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
   */
  stateOverrides?: Record<string, unknown>;
  /**
   * Key into TUTORIAL_SCRIPTS in startDefinitions.ts.
   * When set, the new-game action copies the matching script into tutorialQueue.
   * Only the 'guided' start sets this.
   */
  tutorialScriptId?: string;
}
