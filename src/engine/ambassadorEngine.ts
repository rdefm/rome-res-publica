// ─── Ambassador Engine ────────────────────────────────────────────────────────
// Handles Ambassador appointment, expulsion checks, and Rapport tracking.
// Italy cities are all incorporated so Ambassador logic is minimal in v1,
// but this engine is ready for Mediterranean / East maps.

import type { CityState, AmbassadorState } from '../models/city';

/**
 * Check whether an expulsion event should fire this season.
 * Triggers if relationship dropped by 20+ points in a single season
 * while an Ambassador is posted.
 */
export function checkExpulsion(
  prevRelationship: number,
  currentRelationship: number,
  ambassador: AmbassadorState | null
): boolean {
  if (!ambassador) return false;
  const drop = prevRelationship - currentRelationship;
  return drop >= 20;
}

/**
 * Apply ambassador expulsion consequences.
 * Returns city state delta and resource patch.
 */
export function resolveExpulsion(
  city: CityState
): {
  cityPatch: Partial<CityState>;
  resourcePatch: { fides?: number; lifetimeDignitas?: number };
  logMessage: string;
} {
  return {
    cityPatch: {
      playerAmbassador: null,
      relationshipScore: Math.max(0, city.relationshipScore - 15),
    },
    resourcePatch: { lifetimeDignitas: -8 },
    logMessage: `Ambassador expelled from ${city.id}. −15 Relationship, −8 Dignitas.`,
  };
}

/**
 * Calculate Personal Rapport decay per season (resets when a new ambassador
 * is appointed — this handles passive decay during posting).
 */
export function calcRapportDecay(_ambassador: AmbassadorState): number {
  // Rapport decays by 1 per season when no action is taken.
  // The game prevents this going negative.
  return 1;
}

/**
 * Check whether a City Client can be recruited from this city.
 */
export function canRecruitClient(
  city: CityState,
  requiredSupport: number,
  requiredRelationship: number
): boolean {
  return (
    city.localSupport >= requiredSupport &&
    city.relationshipScore >= requiredRelationship
  );
}

/**
 * Get the cooldown reset for ambassador actions at the start of a new season.
 */
export function resetAmbassadorCooldowns(ambassador: AmbassadorState): AmbassadorState {
  return { ...ambassador, actionsUsedThisTurn: [] };
}
