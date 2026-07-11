// ─── Trial outcome (unchanged across the P4-C rework) ────────────────────────

export type TrialOutcome = 'acquitted' | 'fined' | 'exiled' | 'executed' | 'dismissed';
export type TrialRole = 'defendant' | 'prosecutor';

// ─── Phase 4, Chunk P4-C — the unified pipeline ──────────────────────────────

/** The 5 charges a trial can be built on — see data/trialCharges.ts for
 *  display names, accusation text, and severity tables. `military_incompetence`
 *  isn't in the plan's literal 4-row table; preserved as a 5th charge so the
 *  M4 defeated-general trigger (musterEngine's defeatedGeneral flag) keeps
 *  working rather than silently dropping a shipped, tested feature. */
export type ChargeId = 'repetundae' | 'peculatus' | 'ambitus' | 'maiestas' | 'military_incompetence';

export type ChargeSource = 'secret' | 'corruption' | 'accusation';

export type TrialApproach = 'ferocity' | 'procedure' | 'sympathy';

/** Whichever side is arguing — player-controlled (a family member speaks)
 *  or an NPC leader. */
export type TrialParty =
  | { kind: 'player'; speakerId: string }
  | { kind: 'leader'; leaderId: string };

/** Who stands accused. */
export type TrialTarget =
  | { kind: 'family'; characterId: string }
  | { kind: 'leader'; leaderId: string };

/**
 * Per-verb usage + accumulated strength. This chunk it's a "temporary flat
 * list" (the plan's own words) mapping the legacy TRIAL_ACTIONS onto a single
 * totalStrength number — P4-D's Basilica replaces actionsUsed's flat shape
 * with real Logos/Pathos/Ethos section tracking without needing to touch
 * totalStrength's meaning (it stays "the player's accumulated prep score").
 */
export interface PrepRecord {
  totalStrength: number;
  actionsUsed: string[];
}

export interface TrialState {
  id: string;
  /** The PLAYER's seat — which side of this trial the player occupies. */
  seat: 'defense' | 'prosecution';
  charge: ChargeId;
  chargeSource: ChargeSource;
  prosecutor: TrialParty;
  defendant: TrialTarget;
  /** GameState.turnNumber this trial was filed/created. */
  filedSeason: number;
  /** GameState.turnNumber the trial enters session — startsSeason minus
   *  filedSeason is the prep window both sides get. */
  startsSeason: number;
  playerPrep: PrepRecord;
  /** Free, adjustable until startsSeason (design invariant 8). Multipliers
   *  land in P4-D alongside the Basilica's approach selector — this chunk
   *  the field exists and is settable, but verdict math doesn't yet weight
   *  by it (no prep verbs are approach-sensitive until P4-D). */
  approach: TrialApproach;
  /** Family member who argues the case; defaults to the paterfamilias. */
  speakerId: string;
  /** Opponent's accumulated strength — grows every season during 'preparing'
   *  (trialEngine.computeOpponentPrepGrowth). */
  npcStrength: number;
  /** Recomputed every season from clan standings (trialEngine.computeJuryLean). */
  juryLean: number;
  consumedSecretIds: string[];
  status: 'preparing' | 'in_session' | 'resolved';
  outcome?: TrialOutcome;
}

// ─── Legacy shape — save-migration only ──────────────────────────────────────
// Not used anywhere else after this chunk. Kept solely so
// trialEngine.convertLegacyTrial has something concrete to type its input
// as when reading a pre-P4-C save's trialQueue entries (gameStore.loadGame,
// mirroring the wars/P3-A per-element migration precedent).

export type LegacyTrialCharge = 'corruption' | 'treason' | 'electoral_fraud' | 'murder' | 'military_incompetence';

export interface LegacyTrial {
  id: string;
  accusedCharacterId: string;
  accusingClanId: string;
  charge: LegacyTrialCharge;
  defenseStrength: number;
  prosecutionStrength: number;
  turnsRemaining: number;
  resolved: boolean;
  outcome?: TrialOutcome;
  actionsUsed: string[];
}

// ─── Trial actions — legacy defense-action catalog ───────────────────────────
// Superseded by P4-D's trialPrep.ts, but kept functional this chunk per the
// plan ("keep a legacy-mapping shim") — trialEngine.mapLegacyTrialActionToPrep
// converts a TRIAL_ACTIONS pick into a PrepRecord delta.

export interface TrialAction {
  id: string;
  label: string;
  cost: { resource: 'denarii' | 'fides'; amount: number };
  defenseBonus: number;
  requiresAssetAction?: string; // asset action ID required to unlock
}
