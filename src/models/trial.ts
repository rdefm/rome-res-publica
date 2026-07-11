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

/** The Basilica's three preparation sections (P4-D). */
export type PrepSection = 'logos' | 'pathos' | 'ethos';

/** A named witness secured via the Basilica's Pathos section (P4-D).
 *  Attackable at trial (P4-E) — `attacked` lets a beat response spend
 *  "protect the witness" prep against a specific one; undefined/false
 *  until the beat engine exists to ever set it. */
export interface Witness {
  id: string;
  name: string;
  attacked?: boolean;
}

/**
 * Per-section accumulated strength, replacing P4-C's "temporary flat list"
 * (the plan's own words) now that the Basilica (P4-D) gives real Logos/
 * Pathos/Ethos tracking. `logos`/`pathos`/`ethos` are the raw (pre-Approach-
 * multiplier) sums each section's verbs have contributed; the weighted total
 * a trial actually plays with is always derived via
 * trialEngine.computeTotalPrepStrength(prep, trial.approach) — never stored,
 * so switching Approach re-previews live without re-triggering any verb.
 * `bribedClanIds`/`praetorBribed` record Ethos bribes purchased here; the
 * `juryBribeDiscovery`/`praetorBribeDiscovery` roll against them happens at
 * trial-day session start (P4-E) — inert bookkeeping until then.
 */
export interface PrepRecord {
  logos: number;
  pathos: number;
  ethos: number;
  actionsUsed: string[];
  witnesses: Witness[];
  bribedClanIds: string[];
  praetorBribed: boolean;
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
  /** Non-null exactly while status === 'in_session' (Phase 4, Chunk P4-E).
   *  Drawn once when turnNumber reaches startsSeason (trialBeatEngine.drawTrialBeats,
   *  turnSequencer.ts) and persisted — chosen over an ephemeral gameStore
   *  field so an app restart mid-trial-day resumes the exact same session
   *  rather than losing it (unlike activeBattle's "does not survive an app
   *  restart" precedent). */
  session: TrialSession | null;
}

// ─── Phase 4, Chunk P4-E — Trial day: the beat engine ────────────────────────

/** A single answered beat, kept for the eventual verdict scene's (P4-F)
 *  beat-by-beat recap. */
export interface TrialBeatResolution {
  beatId: string;
  responseId: string;
  succeeded: boolean;
  /** Already clamped to ±BALANCE.trials.beatSwingMax. */
  swing: number;
}

/** The live state of an in-session trial's 3-beat sequence. */
export interface TrialSession {
  /** Exactly BALANCE.trials.beatsPerTrial (3) ids into data/trialBeats.ts's
   *  TRIAL_BEATS, drawn once at session start — trialBeatEngine.drawTrialBeats. */
  beatIds: string[];
  /** 0-based pointer into beatIds — the beat currently awaiting a response. */
  currentBeatIndex: number;
  /** Running total, clamped to ±BALANCE.trials.performanceCap as each beat
   *  resolves (design invariant 1 — trial day is at most the ±30% share). */
  performanceSoFar: number;
  resolutions: TrialBeatResolution[];
  /** Rolled once at session draw (BALANCE.trials.prep.juryBribeDiscoveryChance/
   *  praetorBribeDiscoveryChance) — a discovered bribe's Ethos bonus is voided
   *  immediately (playerPrep.ethos reduced) and its mandatory 'bribe_discovered'
   *  beat forced into the draw ("bribes eat your beats and their bonuses"). */
  discoveredBribeClanIds: string[];
  discoveredPraetorBribe: boolean;
  /** The playerPrep.witnesses[].id targeted by a forced 'witness_attack' beat,
   *  if one was drawn — null once answered (the response either saves or
   *  loses the witness) or if no unattacked witness existed at draw time. */
  witnessAttackTargetId: string | null;
}

export type BeatResponseKind = 'stat' | 'prep' | 'plain';

/** What a kind: 'prep' response checks for — a prep artifact already bought
 *  in the Basilica (P4-D), not a fresh spend. */
export type BeatPrepRequirement =
  | { kind: 'witness' }
  | { kind: 'secret_evidence' }
  | { kind: 'evidence_uses'; min: number };

export interface BeatResponse {
  id: string;
  label: string;
  kind: BeatResponseKind;
  /** kind: 'stat' only — reuses eventEngine.resolveEventChoice's exact
   *  threshold idiom (skillVal >= difficulty, no roll — design invariant 2:
   *  "the verdict itself is a deterministic threshold," and per this
   *  codebase's own skill-check convention, so is every beat response). */
  skill?: 'rhetoric' | 'intrigus';
  difficulty?: number;
  /** kind: 'prep' only. */
  requires?: BeatPrepRequirement;
  swing: { success: number; failure: number };
  successText: string;
  failureText: string;
}

/** tags mixes ChargeId values, TrialApproach values, ClanLeader trait ids
 *  (data/traits.ts), and the fixed flavor tags below — kept as `string[]`
 *  rather than a closed union since trait ids are open-ended content, not a
 *  fixed enum (data/trialBeats.ts is the source of truth for which tags
 *  actually appear). */
export type FixedBeatTag = 'surprise' | 'witness_attack' | 'bribe_discovered_jurors' | 'bribe_discovered_praetor' | 'general';

export interface TrialBeat {
  id: string;
  tags: string[];
  complication: string;
  responses: BeatResponse[];
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
// Retired, Phase 4, Chunk P4-D. TRIAL_ACTIONS/TrialAction/
// applyLegacyTrialAction/takeTrialAction are gone — data/trialPrep.ts's
// Logos/Pathos/Ethos catalog is now the only way to prepare a trial (both
// seats). LegacyTrial above still needs `actionsUsed: string[]`-shaped
// history for convertLegacyTrial's benefit, but that's plain string[], not
// this type.
