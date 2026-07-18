// ─── Muster Engine ───────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C3 — raising Armies (models/army.ts) by region.
//
// Naming note: src/engine/battle/musterEngine.ts already exists (Legate's
// Line M4's strategic↔battle bridge, `musterArmy(character)`). That file
// projects a CHARACTER's personal TroopUnit arrays into BattleUnits for a
// tactical battle; this file raises brand-new ArmyUnits into a region's
// theatre Army from nothing. They stay two separate files by deliberate
// design (not a literal merge) — same "Army is new and parallel to
// TroopUnit" decision documented in models/army.ts's header comment. A
// future chunk that unifies Army with the battle bridge is where these two
// would actually converge.
//
// Pure functions only — no store/React access, no Math.random/Date.now for
// ids (caller-supplied, matching armyEngine.ts's convention). The quality
// roll itself defaults to plain Math.random(), matching every other
// non-battle strategic-layer engine in this codebase (see
// battle/musterEngine.ts's offerableLegates for the same convention/reasoning).

import type { RegionId, TheatreState } from '../models/theatre';
import type { Army, ArmyUnit } from '../models/army';
import type { Veterancy } from '../models/battle';
import type { CityState } from '../models/city';
import { BALANCE } from '../data/balance';
import { REGIONS } from '../data/theatreMap';
import { getRegionRelationship } from './theatreEngine';

export type MusterTier = 'emergency' | 'standard' | 'picked';

// ─── Eligibility & quote ──────────────────────────────────────────────────────

export interface MusterEligibility {
  allowed: boolean;
  /** Dispatch-voice reason shown to the player when !allowed. */
  reason: string | null;
}

/** Single source of truth for "can this region be mustered right now" —
 *  relationship/controller gate (spec: relationship < 25 or controller ≠
 *  rome = unavailable) and the region's remaining yearly cohort pool
 *  (Region.baseManpower minus TheatreState.musteredThisYear[regionId]). */
export function checkMusterEligibility(
  regionId: RegionId,
  theatre: TheatreState,
  cities: CityState[],
): MusterEligibility {
  const region = REGIONS.find(r => r.id === regionId);
  if (!region) return { allowed: false, reason: 'Unknown region.' };

  const controller = theatre.controllers[regionId];
  const relationship = getRegionRelationship(cities, regionId);
  if (controller !== 'rome' || relationship < BALANCE.campaign.muster.minRelationshipToMuster) {
    return { allowed: false, reason: 'No levy will answer you here.' };
  }

  const remaining = region.baseManpower - (theatre.musteredThisYear[regionId] ?? 0);
  if (remaining <= 0) {
    return { allowed: false, reason: "This year's levy is spent here." };
  }

  return { allowed: true, reason: null };
}

export interface MusterQuote {
  eligible: boolean;
  reason: string | null;
  costDenarii: number;
  cohortsRemaining: number;
  baseVeterancy: Veterancy;
  loyaltySeed: number;
  /** Player paterfamilias holds a formal office — the same senateAuthorised
   *  rule gameStore.raiseLevy already uses. C4 will add "or holds the
   *  theatre command" once that concept exists. */
  sanctioned: boolean;
  imperiumRequired: number;
  imperiumOk: boolean;
}

/** One cohort's price/quality/gate quote for a region+tier — everything
 *  MusterPanel needs to render a tier card and everything raiseTroops needs
 *  to validate before committing. Read-only: does not roll the actual unit
 *  (see rollMusteredUnit) or mutate anything. */
export function quoteMuster(
  regionId: RegionId,
  tier: MusterTier,
  theatre: TheatreState,
  cities: CityState[],
  armies: Army[],
  playerImperium: number,
  playerHoldsOffice: boolean,
): MusterQuote {
  const eligibility = checkMusterEligibility(regionId, theatre, cities);
  const region = REGIONS.find(r => r.id === regionId);
  const m = BALANCE.campaign.muster;
  const tierDef = m.tiers[tier];

  const relationship = region ? getRegionRelationship(cities, regionId) : 0;
  const discount = relationship * m.relationshipCostDiscountFactor;
  const costDenarii = Math.round(tierDef.costPerCohort * (1 - discount));
  const cohortsRemaining = region ? Math.max(0, region.baseManpower - (theatre.musteredThisYear[regionId] ?? 0)) : 0;

  // Invariant 7 — imperium GATES, never pays. "Personal cohorts currently in
  // the field" = every unit in every player-owned Army, any region (the
  // plan's "personally-raised troops kept in the field" framing, read
  // globally — there's no other reasonable per-region scoping for a
  // Rome-wide political threshold).
  const personalCohortsInField = armies
    .filter(a => a.owner === 'player')
    .reduce((sum, a) => sum + a.units.length, 0);
  const imperiumRequired = m.imperiumThresholdBase + m.imperiumThresholdPerCohort * personalCohortsInField;
  const sanctioned = playerHoldsOffice;

  return {
    eligible: eligibility.allowed,
    reason: eligibility.reason,
    costDenarii,
    cohortsRemaining,
    baseVeterancy: tierDef.baseVeterancy,
    loyaltySeed: tierDef.loyaltySeed,
    sanctioned,
    imperiumRequired,
    imperiumOk: sanctioned || playerImperium >= imperiumRequired,
  };
}

// ─── Rolling the actual unit ──────────────────────────────────────────────────

const VETERANCY_STEP: Veterancy[] = ['raw', 'trained', 'veteran'];
// Deliberately excludes 'legendary' — a freshly raised cohort never starts
// there, matching battle/musterEngine.ts's promotedVeterancy convention that
// 'legendary' is a battle-promotion-only tier.

function stepUpVeterancy(v: Veterancy): Veterancy {
  const idx = VETERANCY_STEP.indexOf(v);
  return idx === -1 || idx === VETERANCY_STEP.length - 1 ? v : VETERANCY_STEP[idx + 1];
}

/** Rolls one cohort's veterancy: the tier's own inherent quality mix
 *  ("raw, 25% trained" etc. — tierDef.secondaryChance), THEN, independently,
 *  the relationship≥70 "good families send their sons" bump
 *  (m.relationshipQualityBumpChance) — two separate rolls per spec, not one
 *  combined roll, so both can (rarely) stack on the same cohort. */
export function rollMusteredUnit(
  tier: MusterTier,
  regionId: RegionId,
  relationship: number,
  turnNumber: number,
  unitId: string,
  rng: () => number = Math.random,
): ArmyUnit {
  const m = BALANCE.campaign.muster;
  const tierDef = m.tiers[tier];

  let veterancy: Veterancy = tierDef.baseVeterancy;
  if (rng() < tierDef.secondaryChance) veterancy = stepUpVeterancy(veterancy);
  if (relationship >= m.relationshipQualityBumpThreshold && rng() < m.relationshipQualityBumpChance) {
    veterancy = stepUpVeterancy(veterancy);
  }

  return {
    id: unitId,
    unitClass: 'legionary',
    strength: 100,
    veterancy,
    loyalty: tierDef.loyaltySeed,
    elephantSteady: false,
    homeRegion: regionId,
    raisedBy: 'player',
    raisedSeason: turnNumber,
  };
}

// ─── Auto-naming ────────────────────────────────────────────────────────────
// models/army.ts's own header comment reserves this convention for C3:
// "Legio I Campana"-style, ordinal among the player's existing armies.

const ROMAN_NUMERAL_TABLE: [number, string][] = [
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

function toRoman(n: number): string {
  let remaining = n;
  let out = '';
  for (const [value, symbol] of ROMAN_NUMERAL_TABLE) {
    while (remaining >= value) {
      out += symbol;
      remaining -= value;
    }
  }
  return out;
}

/** Next "Legio N <Region>" name for a freshly-raised player Army — ordinal
 *  counts existing player-owned "Legio ..." armies game-wide (not scoped to
 *  this region), so numbering never repeats across the whole campaign. */
export function nextLegionName(existingArmies: Army[], regionDisplayNameLatin: string): string {
  const count = existingArmies.filter(a => a.owner === 'player' && /^Legio [IVXLCDM]+ /.test(a.name)).length;
  return `Legio ${toRoman(count + 1)} ${regionDisplayNameLatin}`;
}

// ─── Upkeep shortfall consequences (finalizes the C2 declaration) ───────────
// armyEngine.upkeepFor computes the cost; charging it against a purse and
// deciding who pays (only 'player'-owned armies draw on state.denarii today
// — no war chest exists until C4, no NPC economy until C6) is the season
// income step's job. Per the plan, wiring the actual call into
// turnSequencer.ts is C7's job (turn-end resolution owns the campaign
// season tick); this function is the pure consequence logic C7 will call,
// finished and tested now so C7 only has to wire it, not design it.

export interface UpkeepSettlement {
  /** null = the army disbanded (average unit loyalty fell below the
   *  disband threshold this settlement). */
  army: Army | null;
  disbanded: boolean;
}

/** `paid: false` applies one season's shortfall consequences (unpaidSeasons
 *  +1, −10 loyalty and 3% strength attrition on every unit) and disbands the
 *  army if its average loyalty is now below the threshold. `paid: true`
 *  simply resets unpaidSeasons to 0 — no other effect. */
export function settleUpkeep(army: Army, paid: boolean): UpkeepSettlement {
  if (paid) {
    return { army: { ...army, unpaidSeasons: 0 }, disbanded: false };
  }

  const { upkeep } = BALANCE.campaign;
  const penalizedUnits = army.units.map(u => ({
    ...u,
    loyalty: Math.max(0, u.loyalty - upkeep.shortfallLoyaltyPenalty),
    strength: Math.max(0, u.strength * (1 - upkeep.shortfallAttritionPct)),
  }));
  const penalized: Army = { ...army, unpaidSeasons: army.unpaidSeasons + 1, units: penalizedUnits };

  const avgLoyalty = penalizedUnits.length === 0
    ? 0
    : penalizedUnits.reduce((sum, u) => sum + u.loyalty, 0) / penalizedUnits.length;

  if (avgLoyalty < upkeep.disbandLoyaltyThreshold) {
    return { army: null, disbanded: true };
  }
  return { army: penalized, disbanded: false };
}
