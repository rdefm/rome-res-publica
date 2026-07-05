import type { GameState } from '../state/gameStore';
import type { EventCondition, ConditionOperator, EventDef, EventChoice } from '../models/event';
import type { ClientType } from '../models/client';

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
  }
}

// ─── Full event eligibility check ────────────────────────────────────────────

export function isEventEligible(def: EventDef, state: GameState): boolean {
  // weight: 0 events fire only via injection (nextEventId branching or
  // turnSequencer's multi-ticker step) — never through random selection.
  if (def.weight === 0) return false;
  return def.conditions.every(cond => evalCondition(cond, state));
}

// ─── Weighted random selection ────────────────────────────────────────────────

export function pickRandomEvent(
  defs: EventDef[],
  state: GameState
): EventDef | undefined {
  const eligible = defs.filter(def => isEventEligible(def, state));
  if (eligible.length === 0) return undefined;

  const totalWeight = eligible.reduce((sum, def) => sum + def.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const def of eligible) {
    roll -= def.weight;
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
