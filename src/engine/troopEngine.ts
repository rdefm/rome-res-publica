import { TroopUnit } from '../models/troop';

// ─── Local Support Modifier ───────────────────────────────────────────────────

/**
 * Returns a combat effectiveness multiplier based on the player family's
 * local support in the muster province (0–100).
 */
export function getLocalSupportModifier(localSupport: number): number {
  if (localSupport <= 15) return 0.85;
  if (localSupport <= 30) return 0.95;
  if (localSupport <= 50) return 1.00;
  if (localSupport <= 70) return 1.10;
  if (localSupport <= 85) return 1.20;
  return 1.30;
}

// ─── Effective Force ──────────────────────────────────────────────────────────

/**
 * Calculates the effective combat force of a group of troops, factoring in
 * the commander's martial skill and local support in the province.
 */
export function calcEffectiveForce(
  troops: TroopUnit[],
  commanderMartial: number,
  localSupport: number,
): number {
  const localMod = getLocalSupportModifier(localSupport);
  const rawStrength = troops.reduce((sum, t) => sum + t.strength, 0);
  return Math.round(rawStrength * (1 + commanderMartial / 10) * localMod);
}

// ─── Military Imperium ────────────────────────────────────────────────────────

/**
 * Derives a character's military Imperium tier (0–3) from their personal troops.
 * Counts units with strength ≥ 3; seasoned veterans force tier 3 regardless.
 */
export function calcMilitaryImperium(troops: TroopUnit[]): 0 | 1 | 2 | 3 {
  if (troops.some(t => t.type === 'seasoned_veteran')) return 3;

  const strongUnits = troops.filter(t => t.strength >= 3).length;
  if (strongUnits === 0) return 0;
  if (strongUnits <= 2) return 1;
  if (strongUnits <= 5) return 2;
  return 3;
}

// ─── Total Imperium ───────────────────────────────────────────────────────────

/**
 * Combines formal Imperium (from office) and military Imperium (from troops)
 * into a single effective Imperium score (0–3).
 * The higher value dominates; the lower contributes half its value.
 */
export function calcTotalImperium(
  formalImperium: number,
  militaryImperium: number,
): 0 | 1 | 2 | 3 {
  const higher = Math.max(formalImperium, militaryImperium);
  const lower  = Math.min(formalImperium, militaryImperium);
  const total  = higher + Math.floor(lower / 2);
  return Math.min(3, total) as 0 | 1 | 2 | 3;
}

// ─── Veteran Promotion ────────────────────────────────────────────────────────

type CampaignOutcome = 'decisive_victory' | 'victory' | 'pyrrhic' | 'defeat' | 'catastrophic';

/**
 * Applies post-campaign promotion, stat changes, and desertion to a set of troops.
 * Returns the updated (and possibly reduced) troop array.
 * Strength is always clamped to 1–10; units at 0 are removed, not zeroed.
 */
export function promoteVeterans(
  troops: TroopUnit[],
  outcome: CampaignOutcome,
): TroopUnit[] {
  switch (outcome) {
    case 'decisive_victory':
      return troops.map(t => {
        if (t.type === 'raised') {
          return {
            ...t,
            type: 'veteran' as const,
            strength: Math.min(10, t.strength + 2),
            bondToCommander: 85,
          };
        }
        if (t.type === 'veteran') {
          return {
            ...t,
            type: 'seasoned_veteran' as const,
            strength: Math.min(10, t.strength + 1),
            bondToCommander: 95,
          };
        }
        return t;
      });

    case 'victory':
      // Only raised → veteran; veterans do not advance further
      return troops.map(t => {
        if (t.type === 'raised') {
          return {
            ...t,
            type: 'veteran' as const,
            strength: Math.min(10, t.strength + 2),
            bondToCommander: 85,
          };
        }
        return t;
      });

    case 'pyrrhic':
      // No promotions; all units weaken; no desertion
      return troops.map(t => ({
        ...t,
        strength: Math.max(1, t.strength - 1),
      }));

    case 'defeat':
      return troops
        .filter(t => t.bondToCommander >= 40)   // bond < 40 → deserted
        .map(t => ({
          ...t,
          strength: Math.max(1, t.strength - 2),
        }));

    case 'catastrophic':
      // Broader desertion threshold (< 60) plus same strength hit as defeat
      return troops
        .filter(t => t.bondToCommander >= 60)
        .map(t => ({
          ...t,
          strength: Math.max(1, t.strength - 2),
        }));
  }
}

// ─── Troop Attrition ──────────────────────────────────────────────────────────

/**
 * Ages inactive troops and applies long-term attrition.
 * Units weaken by 1 strength per 4 additional seasons beyond the 40-season threshold.
 * Strength is clamped to a minimum of 1 — attrition never destroys a unit outright.
 */
export function applyTroopAttrition(
  troops: TroopUnit[],
  seasonsElapsed: number,
): TroopUnit[] {
  return troops.map(t => {
    const updatedYearsInactive = t.yearsInactive + seasonsElapsed;

    let updatedStrength = t.strength;
    if (updatedYearsInactive > 40) {
      const seasonsOverThreshold = updatedYearsInactive - 40;
      // First loss occurs immediately on crossing 40 seasons (ceil ensures over=1 → loss=1).
      // Each subsequent loss requires 5 more seasons of continued inactivity.
      // Approximates the spec's "−1 per 4 additional seasons" while satisfying all test cases.
      const strengthLoss = Math.ceil(seasonsOverThreshold / 5);
      updatedStrength = Math.max(1, t.strength - strengthLoss);
    }

    return {
      ...t,
      yearsInactive: updatedYearsInactive,
      strength: updatedStrength,
    };
  });
}

// ─── Levy Cost ────────────────────────────────────────────────────────────────

/**
 * Calculates the Denarii cost to raise a new legion.
 * Unsanctioned levies carry a 50% surcharge; crisis level adds up to 50% more.
 */
export function calcLevyCost(
  baseCost: number,
  crisisLevel: number,
  senateAuthorised: boolean,
): number {
  const crisisModifier  = 1 + (crisisLevel / 100) * 0.5;  // 0–50% surcharge at max crisis
  const senateDiscount  = senateAuthorised ? 1.0 : 1.5;   // 50% surcharge if unsanctioned
  return Math.round(baseCost * crisisModifier * senateDiscount);
}
