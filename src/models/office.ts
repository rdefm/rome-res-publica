import type { GameState } from '../state/gameStore';
import type { SkillCheck } from '../models/event';
import type { OfficeActionTargetContext } from '../engine/officeActionEngine';

export type OfficeId =
  | 'vigintivirate'
  | 'quaestor'
  | 'tribune'
  | 'aedile'
  | 'praetor'
  | 'consul'
  | 'censor'
  | 'dictator';

// ─── Gate system ──────────────────────────────────────────────────────────────

/**
 * Controls whether an office action is available to the acting character.
 * gate[] entries use AND logic — all must pass.
 * gateAny[] entries use OR logic — at least one must pass.
 *
 * Gate types:
 *   skill       — character.skills[key] op value
 *   resource    — state field by dot-notation (e.g. 'rome.plebs') op value
 *   flag        — state.flags[key] op value
 *   asset       — ownedAssets has definitionId===key at currentTier >= value
 *   client      — clients of type key (or 'any') count >= value
 *   imperium    — state.imperium op value
 *   npcConsulRelationship — state.npcConsul.antagonismLevel op value
 */
export interface OfficeActionGate {
  type: 'skill' | 'resource' | 'flag' | 'asset' | 'client' | 'imperium' | 'npcConsulRelationship';
  key: string;
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number | boolean;
}

// ─── Cross-tab consequences ───────────────────────────────────────────────────

/**
 * Applied by officeActionEngine.applyConsequences when an action resolves successfully.
 * targetId accepts either a literal id or one of the sentinel constants exported from
 * officeActionEngine.ts (e.g. TARGET_ALL_CLANS, TARGET_ACTIVE_CAMPAIGN_PROVINCE).
 */
export interface CrossTabConsequence {
  type:
    | 'clanRelationship'
    | 'provinceRelationship'
    | 'romeStability'
    | 'romePlebs'
    | 'romeTreasury'
    | 'crisisTrack'
    | 'addFlag'
    | 'clearFlag'
    | 'addBlackmail'
    | 'constitutionTick';
  /** Clan id / province id / crisis track id / flag key / leader id — or a sentinel constant. */
  targetId?: string;
  /** Positive or negative magnitude. */
  delta: number;
  /** Human-readable label shown in the action preview UI. */
  description: string;
}

// ─── Office action ────────────────────────────────────────────────────────────

export interface OfficeAction {
  id: string;
  name: string;
  /** Display label for the cost (e.g. "5 Fides"). Used by legacy UI. */
  cost: string;
  costVal: number;
  resource: 'fides' | 'denarii' | null;
  desc: string;

  /**
   * Legacy effect function. Present on all existing actions.
   * New actions use successEffect/failureEffect strings instead.
   * officeActionEngine.resolveOfficeAction routes based on which is present.
   * Optional to support new-style actions that omit it.
   *
   * Tutorial redesign, Chunk T6 — widened to also receive targetContext and
   * the acting character's id, so an effect closure needing a player-chosen
   * target (Audit a Rival's leaderId) or the acting character's own stats
   * (its Intrigus) can read them. Backwards-compatible: every existing
   * `(state) => ...` closure still satisfies this type unchanged — JS
   * ignores extra call arguments a function doesn't declare.
   */
  effect?: (
    state: GameState,
    targetContext?: OfficeActionTargetContext,
    characterId?: string,
  ) => Partial<GameState> & { logMsg: string };

  // ── New fields (all optional — existing actions need not define them) ────────

  /** AND-logic gates. All must pass for the action to be available. */
  gate?: OfficeActionGate[];
  /** OR-logic gates. At least one must pass (evaluated after gate[]). */
  gateAny?: OfficeActionGate[];
  /** Cross-tab consequences applied on successful resolution. */
  consequences?: CrossTabConsequence[];
  /**
   * If true: action is visually flagged in the UI (amber/red + ⚠ EXTREME prefix)
   * and adds a flat +3 to the Constitution crisis track on resolution,
   * in addition to any explicit consequences.
   */
  isExtreme?: boolean;
  /**
   * Numeric spend costs. Named 'spend' to avoid collision with the display
   * string in 'cost'. Processed by officeActionEngine before effect application.
   */
  spend?: { fides?: number; denarii?: number };
  /** Effect string applied on success (or unconditionally if no skillCheck). */
  successEffect?: string;
  /** Effect string applied on skill-check failure. Defaults to no effect if absent. */
  failureEffect?: string;
  /** Skill check to roll before applying success/failure effect. */
  skillCheck?: SkillCheck;
  /**
   * Tutorial redesign, Chunk T6 — set when this action needs a player-
   * chosen target (a PLAYER_CHOSEN_* consequence, or an effect closure that
   * reads targetContext directly, like Audit a Rival). Drives both which
   * picker OfficeTargetPickerModal renders and whether ActionButton routes
   * the action through takeOfficeAction (with the resolved targetContext)
   * instead of the legacy useOfficeAction path, which supports neither
   * targetContext nor characterId.
   */
  targetPicker?: 'leader' | 'clan' | 'province';
}

// ─── Office ──────────────────────────────────────────────────────────────────

export interface Office {
  id: OfficeId;
  name: string;
  latin: string;
  icon: string;
  termSeasons: number;
  minAge: number;
  prerequisite: OfficeId | null;
  /** Number of simultaneous holders. Player wins if their rank ≤ seats. */
  seats: number;
  desc: string;
  flavor: string;
  active: boolean;
  inOfficeActions?: OfficeAction[];
  inOfficeDesc?: string;
}

// ─── Election rival ───────────────────────────────────────────────────────────

export interface ElectionRival {
  id: string;
  name: string;
  emoji: string;
  clanName: string;
  clanId: string;
  title: string;
  bias: string;
  baseVotes: number;
  clanInfluence: number;
  strength: number;         // NPC election score (calcNpcElectionScore result)
  highestOffice: string | null; // most senior office held — shown in UI as "Ex-Praetor" etc.
}
