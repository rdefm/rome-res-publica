export type LeaderBias = 'optimates' | 'populares' | 'military' | 'tradition' | 'commerce';
export type ClanStanding = 'ally' | 'neutral' | 'hostile' | 'rival';

export interface ClanLeaderSkills {
  rhetoric: number;   // 0–10. Drives NPC election score and career advancement.
  martial: number;    // 0–10. Used in military campaign scoring.
  intrigus: number;   // 0–10. Used in intrigue and blackmail checks.
}

export interface ClanLeader {
  id: string;
  name: string;
  title: string;
  emoji: string;
  age: number;
  sphere: string;
  relationship: number;   // -100 to 100 (to player)
  favour: number;         // 0–5 pips
  blackmail: boolean;
  bias: LeaderBias;
  votes: number;          // bloc votes this leader controls; added to player score when canvassed
  bio: string;
  alliance?: boolean;
  /** Set by arrangeMarriageForum (Forum). Anchors relationship decay at 55 (P2-D) — the
   *  bond does not carry over to a successor if this leader dies (patronEngine/reputationEngine). */
  married?: boolean;

  // ── NPC career system ─────────────────────────────────────────────────────
  skills: ClanLeaderSkills;
  heldOffices: string[];            // office IDs completed (used for prerequisite checks)
  currentOffice: string | null;     // office ID currently being served
  turnsLeftInOffice: number | null; // seasons remaining in current term

  // ── Judicial / political status ───────────────────────────────────────────
  /**
   * Set to true by the Dictator's Proscription action or nota-censoria consequences.
   * While true: vote contribution is treated as 0 in electionEngine.resolveElection.
   * In practice this is permanent for proscription; nota-censoria uses a timed flag instead.
   */
  proscribed?: boolean;

  // ── Phase 4, Chunk P4-A — Secrets ─────────────────────────────────────────
  /** 0–0.3 (BALANCE.secrets.groundworkCap). Rises by groundworkPerFailure on
   *  each failed Gather Intelligence attempt against this leader (persists,
   *  no decay v1), feeding back into gatherChance. Reset to 0 on a success.
   *  Optional/absent (read as 0) so pre-P4-A saves load unchanged. */
  intelGroundwork?: number;

  // ── Phase 4, Chunk P4-B — Secrets, reverse direction ───────────────────────
  /** This leader's own progress toward generating a Secret against the
   *  player's family — the mirror of intelGroundwork (which tracks the
   *  PLAYER's progress against THIS leader). Same 0–groundworkCap shape and
   *  no-decay persistence, feeding npcGatherTick's chance. Rises on a failed
   *  npcGatherTick roll same as any groundwork; also jumps by
   *  BALANCE.secrets.extortRetaliationGroundwork when the player's own
   *  Extort verb against this leader is exposed — "immediately gains
   *  groundwork toward a counter-Secret." Not in the plan's literal P4-A/B
   *  model field lists, but required to make that consequence mechanically
   *  real (npcGatherTick had no per-leader memory on this side before). */
  familyGroundwork?: number;

  // ── Phase 4, Chunk P4-C — Trials ────────────────────────────────────────────
  /** 0–100, mirrors Character.corruptionScore. Feeds the player's
   *  corruption-gated prosecution-filing path (BALANCE.trials.corruptionChargeThreshold).
   *  Real and seasonal, not a static seed: trialEngine.tickLeaderCorruption
   *  accrues it for leaders who've held praetor/consul and roll "actively
   *  governing" a province this season, via the taxation-notch abstraction
   *  described in that function's header comment — no NPC-governorship
   *  infrastructure exists in this codebase, so this is a leader-side proxy,
   *  not a simulation of who economically controls which province.
   *  Optional/absent (read as 0) so pre-P4-C saves load unchanged. */
  corruptionScore?: number;

  // ── Phase 4, Chunk P4-E — Trial beats ───────────────────────────────────────
  /** Trait IDs from data/traits.ts's TRAIT_DEFINITIONS — the same catalog
   *  used for family Character.inheritedTraits, reused here (per design
   *  decision) as the "opponent trait" signal trialBeatEngine's beat draw
   *  keys off, since ClanLeader previously had no traits system at all (only
   *  `bias`/`sphere` — P4-C's opponent-prep growth skipped a "wealthy trait"
   *  multiplier for lack of exactly this signal). Starting leaders
   *  (data/startingClans.ts) are hand-assigned 0-1 fitting traits with NO
   *  retroactive skillModifiers applied (their skills were hand-tuned before
   *  traits existed; silently buffing them here would be an undocumented
   *  rebalance). Procedurally generated successors (reputationEngine.ts's
   *  generateSuccessor) roll a fresh trait and DO apply skillModifiers via
   *  applyLeaderTraitModifiers, matching how inheritanceEngine.applyTraitModifiers
   *  treats new Characters. Optional/absent (read as []) so pre-P4-E saves
   *  and any ClanLeader literal elsewhere in the codebase load/compile
   *  unchanged. */
  traits?: string[];
}

export interface Clan {
  id: string;
  name: string;
  /** Nominative masculine gens name (e.g. "Cornelius"), used to name procedurally
   *  generated successors (P2-D). Derived once here rather than parsed from leader
   *  names at runtime. */
  gensName: string;
  sigil: string;
  influence: number; // 0–100
  desc: string;
  leaders: ClanLeader[];
}
