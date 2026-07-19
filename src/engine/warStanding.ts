// ─── War Standing ────────────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C9 — the active major
// Carthage war's warScore is recomputed fresh each season from the campaign
// map's own live state (sicilyControl + armyBalance + momentum −
// wearinessGap), replacing warEngine.ts's old internal skirmish-drift roll.
// Pure, no store access — matches every other engine file's convention.
//
// AMENDED (per the plan's own Chunk C1 note, re-verified here): the plan's
// original sketch assumed 5 independent Sicilian regions, each with its own
// Controller. C1 shipped Sicily as ONE region ('sicilia') containing 4
// cities. sicilyControl therefore reads live CityState.owner for each of
// sicilia's cityIds, not the region's own coarse TheatreState.controllers
// value (that field stays atomic for movement/adjacency/control-flip, per
// design invariant 2/4 — unaffected by this chunk).

import type { Army } from '../models/army';
import type { CityState } from '../models/city';
import type { WarState } from '../models/war';
import { BALANCE } from '../data/balance';
import { REGIONS } from '../data/theatreMap';
import { armyStrength, armyPowerOf } from './armyEngine';

const SICILIA_REGION_ID = 'sicilia';
const LILYBAEUM_CITY_ID = 'lilybaeum';

function clampScore(v: number): number {
  const c = BALANCE.campaign.standing.clamp;
  return Math.min(c, Math.max(-c, v));
}

/** Σ over sicilia's live cities of ±sicilyControlPerCity (rome/carthage),
 *  Lilybaeum weighted at sicilyControlLilybaeumWeight instead — the war's
 *  lock, unchanged from the plan's original seed. Independent/uncommitted
 *  cities (still CityOwner 'independent') score 0. A region with no cities
 *  at all (shouldn't happen for sicilia specifically, but defensive) scores 0. */
export function computeSicilyControl(cities: CityState[]): number {
  const s = BALANCE.campaign.standing;
  const sicilia = REGIONS.find(r => r.id === SICILIA_REGION_ID);
  if (!sicilia) return 0;
  return sicilia.cityIds.reduce((sum, cityId) => {
    const city = cities.find(c => c.id === cityId);
    if (!city) return sum;
    const weight = cityId === LILYBAEUM_CITY_ID ? s.sicilyControlLilybaeumWeight : s.sicilyControlPerCity;
    if (city.owner === 'rome') return sum + weight;
    if (city.owner === 'carthage') return sum - weight;
    return sum; // 'independent'
  }, 0);
}

/** clamp(armyBalanceMult × log2(totalRome / totalCarthage), ±armyBalanceCap) —
 *  theatre armies only (state.armies — personal legions never enter the
 *  theatre map, C2's own scope decision). log2(0/0) and log2(x/0) are
 *  guarded: no Carthage presence at all reads as the cap in Rome's favour
 *  (and vice versa), not NaN/Infinity. */
export function computeArmyBalance(armies: Army[]): number {
  const s = BALANCE.campaign.standing;
  let romeTotal = 0;
  let carthageTotal = 0;
  for (const army of armies) {
    const power = armyPowerOf(army.owner);
    const strength = armyStrength(army);
    if (power === 'rome') romeTotal += strength;
    else carthageTotal += strength;
  }
  if (romeTotal <= 0 && carthageTotal <= 0) return 0;
  if (carthageTotal <= 0) return s.armyBalanceCap;
  if (romeTotal <= 0) return -s.armyBalanceCap;
  const raw = s.armyBalanceMult * Math.log2(romeTotal / carthageTotal);
  return Math.max(-s.armyBalanceCap, Math.min(s.armyBalanceCap, raw));
}

export type BattleTier = 'crushing' | 'clear' | 'marginal';

/** One battle's signed momentum delta, Rome-positive — the caller (either
 *  campaignResolver's inline NPC-vs-NPC resolution, or gameStore's deferred
 *  player-engagement write-back) supplies which power actually won. */
export function momentumDeltaForBattle(tier: BattleTier, winnerPower: 'rome' | 'carthage'): number {
  const magnitude = BALANCE.campaign.standing.momentumDeltaByTier[tier];
  return winnerPower === 'rome' ? magnitude : -magnitude;
}

/** Applies one battle's momentum delta to whichever active 'major' war
 *  matches `enemyId` (in practice always the single Carthage war — see
 *  models/war.ts's header comment on multiple concurrent wars being
 *  supported in shape only). A no-op if no such war is active. Shared by
 *  both call sites so the exact same clamp/accumulation logic runs whether
 *  the battle resolved inline this season or was deferred to later. */
export function applyBattleMomentum(
  wars: WarState[],
  enemyId: string,
  winnerPower: 'rome' | 'carthage',
  tier: BattleTier,
): WarState[] {
  const delta = momentumDeltaForBattle(tier, winnerPower);
  const cap = BALANCE.campaign.standing.momentumCap;
  return wars.map(w => {
    if (!w.active || w.scale !== 'major' || w.enemyId !== enemyId) return w;
    return { ...w, momentum: Math.max(-cap, Math.min(cap, w.momentum + delta)) };
  });
}

/** Also used for a one-time narrative momentum injection (the Mamertine-
 *  ignition event's opening delta, or a periodic war event's nudge) —
 *  distinct from applyBattleMomentum only in that the caller supplies a
 *  raw signed delta directly rather than deriving one from a battle tier. */
export function applyMomentumDelta(wars: WarState[], enemyId: string, delta: number): WarState[] {
  const cap = BALANCE.campaign.standing.momentumCap;
  return wars.map(w => {
    if (!w.active || w.scale !== 'major' || w.enemyId !== enemyId) return w;
    return { ...w, momentum: Math.max(-cap, Math.min(cap, w.momentum + delta)) };
  });
}

/** Once per season — momentum decays toward 0 regardless of any battles
 *  fought this season (those are applied separately, before this call). */
export function decayMomentum(momentum: number): number {
  const decayed = momentum * BALANCE.campaign.standing.momentumDecayMult;
  // Snap tiny residuals to exactly 0 rather than an eternal 0.001-style tail.
  return Math.abs(decayed) < 0.5 ? 0 : decayed;
}

/** clamp((enemyWeariness − weariness) × wearinessGapMult, ±wearinessGapCap) —
 *  positive = Carthage wearier than Rome, nudging standing UP (in Rome's
 *  favour); negative = Rome wearier, nudging standing down. */
export function computeWearinessGap(weariness: number, enemyWeariness: number): number {
  const s = BALANCE.campaign.standing;
  const raw = (enemyWeariness - weariness) * s.wearinessGapMult;
  return Math.max(-s.wearinessGapCap, Math.min(s.wearinessGapCap, raw));
}

/** Yearly weariness accrual (called once per season the war is active —
 *  callers gate the cadence, this function doesn't). Rome's own weariness
 *  rises faster while upkeep shortfalls or high unrest persist this season;
 *  Carthage's enemyWeariness accrues at the flat base rate only (no
 *  symmetric AI-side upkeep/unrest signal exists in this codebase). */
export function accrueWeariness(
  weariness: number,
  enemyWeariness: number,
  hadUpkeepShortfallThisSeason: boolean,
  unrestTier: number,
): { weariness: number; enemyWeariness: number } {
  const w = BALANCE.campaign.standing.weariness;
  let romeDelta = w.baseRate;
  if (hadUpkeepShortfallThisSeason) romeDelta += w.upkeepShortfallBonus;
  if (unrestTier >= w.unrestElevatedTier) romeDelta += w.unrestElevatedBonus;
  return { weariness: weariness + romeDelta, enemyWeariness: enemyWeariness + w.baseRate };
}

/** The final sum — sicilyControl + armyBalance + momentum − wearinessGap,
 *  clamped to the same ±100 range every consumer (getDesperationTier,
 *  classifyTerminalOutcome, etc.) already expects from a warScore. */
export function computeWarScore(
  sicilyControl: number,
  armyBalance: number,
  momentum: number,
  wearinessGap: number,
): number {
  return clampScore(sicilyControl + armyBalance + momentum - wearinessGap);
}
