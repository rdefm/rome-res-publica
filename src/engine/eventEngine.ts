import type { GameState } from '../state/gameStore';
import type { EventCondition, ConditionOperator, EventDef, EventChoice, EventInstance } from '../models/event';
import type { ClientType } from '../models/client';

// ─── Notice event injection (P2-B) ───────────────────────────────────────────
// Shared builder for weight-0, single-choice, Philon-voiced interstitials —
// used by P2-B (patron tier-up), P2-D (leader death), and P2-F (grand
// munificence acts). Push the returned instance onto state.pendingEvents;
// the def itself (weight: 0, in events.ts) supplies the fallback title/body
// and the "Continue" choice — title/bodyText here override it dynamically.
export function injectNoticeEvent(
  defId: string,
  turnNumber: number,
  targetCharacterId: string,
  opts: { title?: string; bodyText?: string } = {},
): EventInstance {
  return {
    defId,
    firedAtTurn: turnNumber,
    targetCharacterId,
    title: opts.title,
    bodyText: opts.bodyText,
  };
}

// ─── Operator evaluator ──────────────────────────────────────────────────────

function evalOp(value: number, op: ConditionOperator, target: number): boolean {
  switch (op) {
    case 'gt':  return value > target;
    case 'lt':  return value < target;
    case 'gte': return value >= target;
    case 'lte': return value <= target;
    case 'eq':  return value === target;
  }
}

// ─── Single condition evaluator ──────────────────────────────────────────────

export function evalCondition(cond: EventCondition, state: GameState): boolean {
  switch (cond.type) {
    case 'clientCount': {
      const count = state.clients.filter(c => c.type === cond.clientType).length;
      return evalOp(count, cond.op, cond.value);
    }
    case 'hasClient': {
      return state.clients.some(c => c.type === cond.clientType);
    }
    case 'resource': {
      const val = (state as any)[cond.key] ?? 0;
      return evalOp(val, cond.op, cond.value);
    }
    case 'rome': {
      const val = (state.rome as any)[cond.key] ?? 0;
      return evalOp(val, cond.op, cond.value);
    }
    case 'season': {
      return state.seasonIndex === cond.index;
    }
    case 'office': {
      const player = state.family.find(c => c.isPlayer);
      const held = (player as any)?.heldOffice ?? null;
      return held === cond.held;
    }
    // ── Chunk 2B: four-track crisis conditions ────────────────────────────
    case 'crisisTrack': {
      const level = state.crisis[cond.track].level;
      return evalOp(level, cond.op, cond.value);
    }
    case 'multiCrisis': {
      return cond.conditions.every(c =>
        evalOp(state.crisis[c.track].level, c.op, c.value)
      );
    }
    // ── P1-E: new condition types ─────────────────────────────────────────
    case 'flag': {
      // Truthy check: undefined/false/0 → false, true/1/positive → true
      const val = state.flags[cond.key];
      return cond.equals ? !!val : !val;
    }
    case 'asset': {
      return state.ownedAssets.some(
        (a: { definitionId: string }) => a.definitionId === cond.definitionId
      );
    }
    case 'campaigning': {
      return state.campaigning !== null;
    }
  }
}

// ─── Full event eligibility check ────────────────────────────────────────────

export function isEventEligible(def: EventDef, state: GameState): boolean {
  // weight: 0 events fire only via injection — never through random selection.
  if (def.weight === 0) return false;
  // isTutorial events fire only via tutorialQueue — never through random selection (P1-G).
  if (def.isTutorial) return false;
  return def.conditions.every(cond => evalCondition(cond, state));
}

// ─── Seasonal weighting ───────────────────────────────────────────────────────
// Applied inside pickRandomEvent. Constants named for future tuning.

const SEASONAL_BOOST      = 2.5;  // event tagged for the current season
const SEASONAL_SUPPRESSED = 0.4;  // event tagged for a different season
// No seasons field → weight × 1.0 (neutral)

function effectiveWeight(def: EventDef, seasonIndex: number): number {
  if (!def.seasons || def.seasons.length === 0) return def.weight;
  if (def.seasons.includes(seasonIndex)) return def.weight * SEASONAL_BOOST;
  return def.weight * SEASONAL_SUPPRESSED;
}

// ─── Weighted random selection ────────────────────────────────────────────────

export function pickRandomEvent(
  defs: EventDef[],
  state: GameState
): EventDef | undefined {
  const eligible = defs.filter(def => isEventEligible(def, state));
  if (eligible.length === 0) return undefined;

  const totalWeight = eligible.reduce(
    (sum, def) => sum + effectiveWeight(def, state.seasonIndex), 0
  );
  let roll = Math.random() * totalWeight;

  for (const def of eligible) {
    roll -= effectiveWeight(def, state.seasonIndex);
    if (roll <= 0) return def;
  }

  return eligible[eligible.length - 1];
}

// ─── Choice resolution ────────────────────────────────────────────────────────

export interface ResolveChoiceResult {
  effectStr: string;
  succeeded: boolean;
  nextEventId?: string;
}

export function resolveEventChoice(
  choice: EventChoice,
  state: GameState
): ResolveChoiceResult {
  // Determine if skill check succeeded
  let succeeded = true;
  if (choice.skillCheck) {
    const player = state.family.find(c => c.isPlayer);
    const skillVal = (player?.skills as any)?.[choice.skillCheck.skill] ?? 0;
    succeeded = skillVal >= choice.skillCheck.difficulty;
  }

  // Branching — any nextEventId field takes priority over applying effects
  if (choice.nextEventId) {
    return { effectStr: '', succeeded, nextEventId: choice.nextEventId };
  }
  if (choice.nextEventIdOnSuccess && succeeded) {
    return { effectStr: '', succeeded, nextEventId: choice.nextEventIdOnSuccess };
  }
  if (choice.nextEventIdOnFailure && !succeeded) {
    return { effectStr: '', succeeded, nextEventId: choice.nextEventIdOnFailure };
  }

  const effectStr = succeeded ? choice.successEffect : choice.failureEffect;
  return { effectStr, succeeded };
}

// ─── P1-G: Unified event definition lookup ───────────────────────────────────
// Searches both the main pool and the tutorial pool so EventModal and
// resolveEvent work correctly for tutorial events.

export function getEventDef(defId: string): EventDef | undefined {
  // Lazy-require to avoid circular dependency and keep HMR working in Expo.
  const { EVENT_DEFS } = require('../data/events');
  const { TUTORIAL_EVENT_DEFS } = require('../data/tutorialEvents');
  const { WAR_EVENT_DEFS } = require('../data/warEvents');
  return (EVENT_DEFS as EventDef[]).find(d => d.id === defId)
      ?? (TUTORIAL_EVENT_DEFS as EventDef[]).find(d => d.id === defId)
      ?? (WAR_EVENT_DEFS as EventDef[]).find(d => d.id === defId);
}

// ─── P1-G: Tutorial season gate ──────────────────────────────────────────────
// Called by turnSequencer step 12 when tutorialQueue is non-empty.
//
//   fire: true  → pop and fire the event this season
//   skip: true  → pop WITHOUT firing (conditional failure — e.g. tut-06 with no campaign)
//   Both false  → leave at head; fire no event this season (season gate unmet)

export function checkTutorialGate(
  defId: string,
  state: GameState
): { fire: boolean; skip: boolean } {
  switch (defId) {
    case 'evt-tut-01':
      return { fire: state.seasonIndex === 0, skip: false };

    case 'evt-tut-02':
      return { fire: state.seasonIndex === 1, skip: false };

    case 'evt-tut-03':
      return { fire: state.seasonIndex === 2, skip: false };

    case 'evt-tut-04':
      return { fire: state.seasonIndex === 3, skip: false };

    case 'evt-tut-05': {
      // Spring + at least one non-player family member is 18+ with no office
      if (state.seasonIndex !== 0) return { fire: false, skip: false };
      const hasEligible = state.family.some(c =>
        !c.isPlayer && (c.age ?? 0) >= 18 && (c as any).officeId === null
      );
      return { fire: hasEligible, skip: false }; // wait if no eligible member yet
    }

    case 'evt-tut-06':
      if (state.seasonIndex !== 3) return { fire: false, skip: false }; // wait for Winter
      // Skip silently if no campaign is active (tut-05 may have been declined)
      if (state.campaigning === null) return { fire: false, skip: true };
      return { fire: true, skip: false };

    case 'evt-tut-07':
    default:
      return { fire: true, skip: false }; // no season gate; fire whenever reached
  }
}
