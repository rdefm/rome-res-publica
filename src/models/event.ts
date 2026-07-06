import type { ClientType } from './client';
import type { CrisisTrackId } from './crisis';

// ─── Condition operators ─────────────────────────────────────────────────────

export type ConditionOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

// ─── Event conditions ────────────────────────────────────────────────────────

export type EventCondition =
  | { type: 'clientCount'; clientType: ClientType; op: ConditionOperator; value: number }
  | { type: 'hasClient'; clientType: ClientType }
  | { type: 'resource'; key: 'fides' | 'lifetimeDignitas' | 'denarii' | 'crisisLevel'; op: ConditionOperator; value: number }
  | { type: 'rome'; key: 'stability' | 'plebs' | 'treasury'; op: ConditionOperator; value: number }
  | { type: 'season'; index: 0 | 1 | 2 | 3 }   // 0=Spring 1=Summer 2=Autumn 3=Winter
  | { type: 'office'; held: string }             // matches heldOffice id in player character
  | { type: 'crisisTrack'; track: CrisisTrackId; op: ConditionOperator; value: number }
  | { type: 'multiCrisis'; conditions: Array<{ track: CrisisTrackId; op: ConditionOperator; value: number }> };

// ─── Skill check ─────────────────────────────────────────────────────────────

export interface SkillCheck {
  characterId: string; // 'player' resolves to the isPlayer character
  skill: 'rhetoric' | 'martial' | 'intrigus';
  difficulty: number;
}

// ─── Event choice ─────────────────────────────────────────────────────────────

export interface EventChoice {
  id: string;
  label: string;
  skillCheck?: SkillCheck;
  successEffect: string;
  failureEffect: string;
  requiresClient?: ClientType;
  // Branching — if set, fires a follow-up event rather than applying effects directly.
  // successEffect and failureEffect are ignored when any nextEventId field is set.
  nextEventId?: string;           // always branch to this event regardless of skill check
  nextEventIdOnSuccess?: string;  // branch here on skill check success
  nextEventIdOnFailure?: string;  // branch here on skill check failure
}

// ─── Event definition ────────────────────────────────────────────────────────

export interface EventDef {
  id: string;
  title: string;
  bodyText: string;
  imageKey: string;
  conditions: EventCondition[];
  weight: number;
  choices: EventChoice[];
}

// ─── Event instance ──────────────────────────────────────────────────────────

export interface EventInstance {
  defId: string;
  firedAtTurn: number;
  targetCharacterId: string;
  clientName?: string;
  clientType?: ClientType;
  /**
   * Optional override for the event's bodyText at render time.
   * Used by NPC consul and other dynamic injection paths that need to
   * substitute names/values into an otherwise static EventDef body.
   * When set, the EventCard should prefer this over EventDef.bodyText.
   */
  bodyText?: string;
}
