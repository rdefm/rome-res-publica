// ─── Munificence Engine — P2-F ───────────────────────────────────────────────
// Pure functions for requirement gating, cost, and effect calculation for
// Munificence acts. No state mutation, no React/UI imports. gameStore's
// performMunificence action calls these and assembles the final state patch.

import type { GameState } from '../state/gameStore';
import { BALANCE } from '../data/balance';
import { MUNIFICENCE_ACTS, type MunificenceAct, type MunificenceActEffects } from '../data/munificence';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';

export interface MunificenceUsageEntry {
  lastUsedTurn?: number;
  usesThisYear?: number;
  totalUses?: number;
}

export type MunificenceUsage = Record<string, MunificenceUsageEntry>;

// ─── Aedile discount ──────────────────────────────────────────────────────────

/** Player's current office is tracked at state.currentOffice, not on the character. */
export function isAedileActive(state: GameState): boolean {
  return state.currentOffice === 'aedile';
}

// ─── Shared slot check ────────────────────────────────────────────────────────

/** True if any act sharing `slot` has already been used this year. */
export function isSlotUsedThisYear(usage: MunificenceUsage, slot: string): boolean {
  return MUNIFICENCE_ACTS.some(
    a => a.requirements.slot === slot && (usage[a.id]?.usesThisYear ?? 0) > 0
  );
}

// ─── Cost / effects with Aedile scaling ──────────────────────────────────────

export function getMunificenceCost(state: GameState, act: MunificenceAct): { denarii: number; fides: number } {
  const scaled = act.aedileDiscount && isAedileActive(state);
  const mult = scaled ? BALANCE.munificence.aedileCostMultiplier : 1;
  return {
    denarii: Math.round(act.costs.denarii * mult),
    fides: Math.round((act.costs.fides ?? 0) * mult),
  };
}

export function getMunificenceEffects(state: GameState, act: MunificenceAct): MunificenceActEffects {
  const scaled = act.aedileDiscount && isAedileActive(state);
  const mult = scaled ? BALANCE.munificence.aedileEffectMultiplier : 1;
  const e = act.effects;
  if (mult === 1) return e;

  const crisisDeltas = e.crisisDeltas
    ? Object.fromEntries(
        Object.entries(e.crisisDeltas).map(([k, v]) => [k, Math.round((v as number) * mult)])
      )
    : undefined;

  return {
    ...e,
    plebs:            e.plebs            !== undefined ? Math.round(e.plebs * mult)            : undefined,
    fides:            e.fides            !== undefined ? Math.round(e.fides * mult)             : undefined,
    lifetimeDignitas: e.lifetimeDignitas !== undefined ? Math.round(e.lifetimeDignitas * mult)  : undefined,
    stability:        e.stability        !== undefined ? Math.round(e.stability * mult)         : undefined,
    crisisDeltas,
  };
}

// ─── Requirement gating ───────────────────────────────────────────────────────

export type MunificenceCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

export function checkMunificenceRequirements(state: GameState, act: MunificenceAct): MunificenceCheckResult {
  const usage = (state.munificenceUsage ?? {})[act.id];
  const { requirements } = act;

  if (requirements.minPatronTier !== undefined && state.patronTier < requirements.minPatronTier) {
    return { ok: false, reason: `Requires ${PATRON_TIER_DEFINITIONS[requirements.minPatronTier].label}` };
  }

  if (requirements.cooldownSeasons !== undefined && usage?.lastUsedTurn !== undefined) {
    const seasonsSince = state.turnNumber - usage.lastUsedTurn;
    if (seasonsSince < requirements.cooldownSeasons) {
      return { ok: false, reason: `Again in ${requirements.cooldownSeasons - seasonsSince} season${requirements.cooldownSeasons - seasonsSince !== 1 ? 's' : ''}` };
    }
  }

  if (requirements.onceThisYear && (usage?.usesThisYear ?? 0) > 0) {
    return { ok: false, reason: 'Already done this year' };
  }

  if (requirements.slot && isSlotUsedThisYear(state.munificenceUsage ?? {}, requirements.slot)) {
    return { ok: false, reason: 'Games already held this year' };
  }

  if (requirements.maxPerGame !== undefined && (usage?.totalUses ?? 0) >= requirements.maxPerGame) {
    return { ok: false, reason: 'No longer available' };
  }

  const cost = getMunificenceCost(state, act);
  if (state.denarii < cost.denarii) return { ok: false, reason: 'Cannot afford' };
  if (cost.fides > 0 && state.fides < cost.fides) return { ok: false, reason: 'Cannot afford' };

  return { ok: true };
}
