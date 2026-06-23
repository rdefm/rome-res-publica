import type { ClientType } from './client';

// ─── Condition operators ─────────────────────────────────────────────────────

export type ConditionOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq';

// ─── Event conditions ────────────────────────────────────────────────────────

export type EventCondition =
  | { type: 'clientCount'; clientType: ClientType; op: ConditionOperator; value: number }
  | { type: 'hasClient'; clientType: ClientType };

// ─── Skill check ─────────────────────────────────────────────────────────────

export interface SkillCheck {
  characterId: string; // 'player' resolves to the isPlayer character
  skill: 'rhetoric' | 'auctoritas' | 'martial' | 'intrigus';
  difficulty: number;  // player skill must be >= this to succeed
}

// ─── Event choice ─────────────────────────────────────────────────────────────

export interface EventChoice {
  id: string;
  label: string;
  skillCheck?: SkillCheck;
  successEffect: string;  // pipe-separated effect string, e.g. 'gravitas+2|denarii-10'
  failureEffect: string;  // applied when skillCheck fails; empty string = no effect
  requiresClient?: ClientType;
  // If set, this choice button is disabled when the player holds 0 clients of that type.
  // Used to gate coercive options on having Muscle clients available.
}

// ─── Event definition ────────────────────────────────────────────────────────

export interface EventDef {
  id: string;
  title: string;
  bodyText: string;       // may contain {clientName} and {clientType} placeholders
  imageKey: string;       // key into the asset map
  conditions: EventCondition[];
  weight: number;         // relative probability weight for random selection
  choices: EventChoice[];
}

// ─── Event instance ──────────────────────────────────────────────────────────
// Created by turnSequencer when an event fires; stored in pendingEvents queue.

export interface EventInstance {
  defId: string;
  firedAtTurn: number;
  targetCharacterId: string;
  clientName?: string;    // name of the specific existing client involved (Class B and C only)
  clientType?: ClientType; // type of that client
}
