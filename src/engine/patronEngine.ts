import { PATRON_TIER_DEFINITIONS, type PatronTier } from '../models/patronLadder';

// ─── Compute current patron tier ─────────────────────────────────────────────

export function computePatronTier(
  lifetimeDignitas: number,
  currentGratia: number
): PatronTier {
  const eligible = PATRON_TIER_DEFINITIONS.filter(
    t => lifetimeDignitas >= t.requiresDignitasTotal &&
         currentGratia   >= t.requiresGratiaPool
  );
  const highest = eligible.sort((a, b) => b.tier - a.tier)[0];
  return (highest?.tier ?? 0) as PatronTier;
}

// ─── Favour call-ins from clients ─────────────────────────────────────────────

/**
 * @param currentTier  patron tier
 * @param clientCount  number of active clients
 * @param plebs        current plebs mood (0–100) — at ≥85 (Euphoric), favour call-ins are waived
 */
export function processFavourCallIns(
  currentTier: PatronTier,
  clientCount: number,
  plebs: number = 0
): { gratiaOwed: number; callInCount: number } {
  // Euphoric plebs — clients are satisfied, no call-ins this season
  if (plebs >= 85) {
    return { gratiaOwed: 0, callInCount: 0 };
  }

  const tierDef = PATRON_TIER_DEFINITIONS[currentTier];
  let callInCount = 0;
  for (let i = 0; i < clientCount; i++) {
    if (Math.random() < tierDef.passiveBonus.incomingFavourChance) {
      callInCount++;
    }
  }
  return { gratiaOwed: callInCount * 10, callInCount };
}
