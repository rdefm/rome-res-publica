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
  | { type: 'multiCrisis'; conditions: Array<{ track: CrisisTrackId; op: ConditionOperator; value: number }> }
  // ── Phase 1 (P1-E) — new condition types ─────────────────────────────────
  | { type: 'flag'; key: string; equals: boolean }
  | { type: 'asset'; definitionId: string }
  | { type: 'campaigning' }
  | { type: 'governing' };

// ─── Skill check ─────────────────────────────────────────────────────────────

export interface SkillCheck {
  characterId: string;
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
  nextEventId?: string;
  nextEventIdOnSuccess?: string;
  nextEventIdOnFailure?: string;
  // Post-choice narrative feedback — names match rome-event-writing-guide.md §2.2.
  // Required on every terminal choice (quality checklist §9).
  successText?: string;
  failureText?: string;
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
  seasons?: number[];   // 0=Spring 1=Summer 2=Autumn 3=Winter; absent = season-neutral
  isTutorial?: boolean; // excluded from pickRandomEvent; only fired via tutorialQueue (P1-G)
}

// ─── Event instance ──────────────────────────────────────────────────────────

export interface EventInstance {
  defId: string;
  firedAtTurn: number;
  targetCharacterId: string;
  clientName?: string;
  clientType?: ClientType;
  bodyText?: string;
  /** Overrides def.title when set — dynamic interstitials (P2-B tier-up, P2-D
   *  leader death, P2-F grand acts) via injectNoticeEvent. */
  title?: string;
}
