import type { ClientType } from './client';

// ─── Condition operators ─────────────────────────────────────────────────────

export type ConditionOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

// ─── Event conditions ────────────────────────────────────────────────────────

export type EventCondition =
  | { type: 'clientCount'; clientType: ClientType; op: ConditionOperator; value: number }
  | { type: 'hasClient'; clientType: ClientType }
  // New condition types added for Part 2 events:
  | { type: 'resource'; key: 'dignitas' | 'gratia' | 'gravitas' | 'denarii' | 'crisisLevel'; op: ConditionOperator; value: number }
  | { type: 'rome'; key: 'stability' | 'plebs' | 'treasury'; op: ConditionOperator; value: number }
  | { type: 'season'; index: 0 | 1 | 2 | 3 }   // 0=Spring 1=Summer 2=Autumn 3=Winter
  | { type: 'office'; held: string };            // matches heldOffice id in player character

// ─── Skill check ─────────────────────────────────────────────────────────────

export interface SkillCheck {
  characterId: string; // 'player' resolves to the isPlayer character
  skill: 'rhetoric' | 'auctoritas' | 'martial' | 'intrigus';
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
}
