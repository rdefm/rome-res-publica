import type { GameState } from '../state/gameStore';
import type { EventCondition, ConditionOperator, EventDef } from '../models/event';
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
  }
}

// ─── Full event eligibility check ────────────────────────────────────────────

/**
 * Returns true if all conditions on the event def are met by the current state.
 * Events with an empty conditions array are always eligible.
 */
export function isEventEligible(def: EventDef, state: GameState): boolean {
  return def.conditions.every(cond => evalCondition(cond, state));
}

// ─── Weighted random selection ────────────────────────────────────────────────

/**
 * Pick one eligible event definition at random, weighted by def.weight.
 * Returns undefined if no eligible events exist.
 */
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

  // Floating-point safety fallback
  return eligible[eligible.length - 1];
}
