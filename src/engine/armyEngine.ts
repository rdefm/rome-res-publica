// ─── Army Engine ─────────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C2 — pure functions over the Army/ArmyUnit shapes
// (models/army.ts). No store access, no Math.random/Date.now() (fresh ids
// for a combined/split-off army are the caller's job — gameStore.ts — same
// convention every other "build a new entity" pure function in this
// codebase follows, keeping engines deterministic).

import type { Army, ArmyUnit } from '../models/army';
import type { Controller, TheatreState } from '../models/theatre';
import type { CityState } from '../models/city';
import { BALANCE } from '../data/balance';
import { REGIONS } from '../data/theatreMap';
import { getRegionRelationship } from './theatreEngine';

/**
 * Merge two armies into one. Same location + same owner only (returns null
 * otherwise — combining across regions or owners makes no sense and isn't a
 * caller-recoverable situation, so a guard-and-null return matches this
 * codebase's existing "invalid op returns null" convention over throwing).
 * Commander = whichever side has the higher martial (caller resolves and
 * passes both — this engine has no Character/family access, matching the
 * project's model/data/engine layering). The losing commander's id is simply
 * dropped from command here; there is no strategic-layer "available captain
 * roster" yet to move them onto (that's a Legate's Line battle-bridge
 * concept — C8's job when it exists at this layer). Name/stance/
 * stationedCityId are inherited from the army with more units (the plan's
 * "name keeps the larger army's").
 */
export function combine(
  a: Army,
  b: Army,
  martialA: number,
  martialB: number,
  newId: string,
): Army | null {
  if (a.location !== b.location || a.owner !== b.owner) return null;

  const survivor = a.units.length >= b.units.length ? a : b;
  const commanderId = martialA >= martialB ? a.commanderId : b.commanderId;

  return {
    id: newId,
    name: survivor.name,
    owner: a.owner,
    commanderId,
    location: a.location,
    stationedCityId: survivor.stationedCityId,
    units: [...a.units, ...b.units],
    stance: survivor.stance,
    ordersThisSeason: null,
    fatigued: a.fatigued || b.fatigued,
    unpaidSeasons: Math.max(a.unpaidSeasons, b.unpaidSeasons),
  };
}

/**
 * Split whole units off an army into a new one. `unitIds` must be a
 * non-empty, proper subset of `army.units` (at least one unit stays behind,
 * at least one moves) — anything else returns null. The original army keeps
 * its id/name/commander/stance; the split-off army is fresh (`newArmyId`,
 * caller-supplied) and gets `newCommanderId` if given, else null
 * (leaderless — design invariant 5: may garrison, never attack).
 */
export function divide(
  army: Army,
  unitIds: string[],
  newArmyId: string,
  newCommanderId: string | null = null,
): [Army, Army] | null {
  if (unitIds.length === 0 || unitIds.length >= army.units.length) return null;

  const idSet = new Set(unitIds);
  if (![...idSet].every(id => army.units.some(u => u.id === id))) return null;

  const splitOff: ArmyUnit[] = army.units.filter(u => idSet.has(u.id));
  const remaining: ArmyUnit[] = army.units.filter(u => !idSet.has(u.id));
  if (splitOff.length !== unitIds.length) return null; // duplicate/unknown id in unitIds

  const remainingArmy: Army = { ...army, units: remaining };
  const newArmy: Army = {
    id: newArmyId,
    name: `${army.name} (detachment)`,
    owner: army.owner,
    commanderId: newCommanderId,
    location: army.location,
    stationedCityId: army.stationedCityId,
    units: splitOff,
    stance: army.stance,
    ordersThisSeason: null,
    fatigued: army.fatigued,
    unpaidSeasons: 0,
  };

  return [remainingArmy, newArmy];
}

/** Which theatre "side" an Army belongs to, for territory-control/hostility
 *  checks — every non-Carthage ArmyOwner ('player'/'rome_state'/
 *  'rome_rival') counts as 'rome'. Extracted (Chunk C5) from upkeepFor's own
 *  inline version below, now that movementEngine.ts needs the identical
 *  mapping for hostile-occupation checks. */
export function armyPowerOf(owner: Army['owner']): 'rome' | 'carthage' {
  return owner === 'carthage' ? 'carthage' : 'rome';
}

/**
 * Aggregate effective power score — the future abstract battle resolver
 * (C8) and campaign AI (C6) both consume this. Reuses Legate's Line's real
 * per-class atk/def stats and veterancy statMult (BALANCE.battle) rather
 * than a parallel BALANCE.campaign.strengthWeights table the plan's text
 * names — those numbers already exist and are tuned; duplicating them here
 * risks the two drifting apart. classWeight = mean(atk, def): a simple,
 * class-agnostic composite of a unit's raw combat stats (shock and
 * moraleWeight are battle-round-specific, not meaningful strategic power).
 */
export function armyStrength(army: Army): number {
  return army.units.reduce((sum, unit) => {
    const stats = BALANCE.battle.unitStats[unit.unitClass];
    const classWeight = (stats.atk + stats.def) / 2;
    const veterancyMult = BALANCE.battle.veterancy[unit.veterancy].statMult;
    return sum + unit.strength * classWeight * veterancyMult;
  }, 0);
}

/**
 * Per-season upkeep cost in denarii — pure math only (declared here per the
 * plan's own "declared here, tuned in C3/C10" instruction; charging it and
 * applying shortfall consequences — loyalty loss, attrition, disband-under-
 * 20 — is C3's job, wired from the income step). Territory multiplier reads
 * the army's "power" (carthage-owned vs every Roman owner) against the
 * region's live TheatreState controller — friendly/neutral/hostile, not
 * literally "Rome" as the plan's seed table names it, so the same formula
 * works symmetrically for a Carthage-owned army too. Relationship discount
 * only applies where the region actually has live city data to read (see
 * theatreEngine.getRegionRelationship's own ref-less-region fallback) —
 * BALANCE.campaign.defaultForeignRelationship is deliberately NOT used as a
 * discount basis here, since it's a relationship-lookup fallback, not a
 * real signal about this specific army's local standing.
 */
export function upkeepFor(
  army: Army,
  theatre: TheatreState,
  cities: CityState[],
): number {
  const cohortCount = army.units.length;
  if (cohortCount === 0) return 0;

  const { upkeep } = BALANCE.campaign;
  const armyPower = armyPowerOf(army.owner);
  const controller = theatre.controllers[army.location];

  const territoryMult =
    controller === armyPower ? upkeep.friendlyTerritoryMult :
    controller === 'neutral' ? upkeep.neutralTerritoryMult :
    upkeep.hostileTerritoryMult;

  const region = REGIONS.find(r => r.id === army.location);
  const hasLiveCityData = !!region && region.cityIds.some(id => cities.some(c => c.id === id));
  const discountMult = hasLiveCityData
    ? 1 - (getRegionRelationship(cities, army.location) / 100) * upkeep.maxRelationshipDiscount
    : 1;

  return Math.round(upkeep.baseDenariiPerCohort * cohortCount * territoryMult * discountMult);
}
