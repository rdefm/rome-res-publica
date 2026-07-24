/**
 * houseEngine.ts — Family House rework.
 *
 * Pure functions: passive bonus aggregation, the client-slot cap, the Study
 * room's training roll, and relocation sell-back math. Mirrors assetEngine.ts's
 * shape. No store access, no React/UI imports.
 */

import type { OwnedHouse } from '../models/house';
import type { LeaderBias } from '../models/clan';
import { HOUSE_LOCATION_DEFINITIONS, getHouseLocationDefinition } from '../data/houseLocations';
import { HOUSE_ROOM_DEFINITIONS, getHouseRoomDefinition } from '../data/houseRooms';
import { HOUSE_BUSINESS_DEFINITIONS, getHouseBusinessDefinition } from '../data/houseBusinesses';
import { BALANCE } from '../data/balance';

// ─── Passive bonus aggregation ────────────────────────────────────────────────

export interface HouseBonuses {
  fides: number;
  gold: number;
  dignitas: number;
  corruptionShield: number;
  /** Signed per-season relationship drift toward every leader whose bias
   *  matches the house's location (0 if the location has no alignment or
   *  no per-season bonus, e.g. Caelian). Applied by turnSequencer, same
   *  shape as reputationEngine's existing per-leader drift. */
  factionRelPerSeason: number;
  /** Which LeaderBias factionRelPerSeason applies to — null if the location
   *  has no alignment (e.g. Caelian) or no house is owned. */
  factionBias: LeaderBias | null;
}

/** Aggregates the house's location bonus, every built room's recurring
 *  bonus, and every rented business's bonus — everything EXCEPT the
 *  Library's one-time rhetoricGrant, which is applied once at build time
 *  (gameStore.buildRoom), not folded into a recurring total. */
export function computeHouseBonuses(house: OwnedHouse | null | undefined): HouseBonuses {
  const total: HouseBonuses = {
    fides: 0, gold: 0, dignitas: 0, corruptionShield: 0,
    factionRelPerSeason: 0, factionBias: null,
  };
  if (!house) return total;

  const location = getHouseLocationDefinition(house.locationId);
  if (location) {
    total.dignitas += location.locationBonus.dignitasPerSeason ?? 0;
    total.factionRelPerSeason += location.locationBonus.factionRelPerSeason ?? 0;
    total.factionBias = location.biasAlignment;
  }

  for (const roomType of house.builtRooms) {
    const room = getHouseRoomDefinition(roomType);
    if (!room) continue;
    total.fides += room.bonus.fidesPerSeason ?? 0;
  }

  for (const businessType of house.shops) {
    if (!businessType) continue;
    const business = getHouseBusinessDefinition(businessType);
    if (!business) continue;
    total.gold += business.bonus.gold ?? 0;
    total.fides += business.bonus.fides ?? 0;
    total.corruptionShield += business.bonus.corruptionShield ?? 0;
  }

  return total;
}

// ─── Client slot cap (Entry Hall) ─────────────────────────────────────────────

export function getClientSlotCap(house: OwnedHouse | null | undefined): number {
  const hasHall = !!house?.builtRooms.includes('hall');
  const bonus = hasHall ? (getHouseRoomDefinition('hall')?.bonus.clientSlotBonus ?? 0) : 0;
  return BALANCE.clients.baseSlots + bonus;
}

// ─── Study room — training roll ───────────────────────────────────────────────

export interface TrainingRollResult {
  success: boolean;
  chance: number;
}

/** Success chance drops as the character's current skill rises (harder to
 *  improve an already-strong skill), and rises if the Study is built. roll
 *  is externalized (0–1) for testability, same convention as every other
 *  roll-based system in this codebase (e.g. secretEngine.attemptGather). */
export function rollTraining(
  currentSkillLevel: number,
  hasStudy: boolean,
  roll: number
): TrainingRollResult {
  const studyBonus = hasStudy ? (getHouseRoomDefinition('study')?.bonus.trainingRollBonus ?? 0) : 0;
  const raw =
    BALANCE.house.studyRollBaseChance
    - currentSkillLevel * BALANCE.house.studyRollDifficultyPerPoint
    + studyBonus;
  const chance = Math.min(BALANCE.house.studyRollCeiling, Math.max(BALANCE.house.studyRollFloor, raw));
  return { success: roll < chance, chance };
}

// ─── Relocation — sell-back value ─────────────────────────────────────────────

/** Total denarii the player gets back for the CURRENT house (location +
 *  every built room + every rented business, at the location's own
 *  sellBackFraction) — called by gameStore.buyHouse before granting the new
 *  one. Returns 0 for a null house (no current house to sell). */
export function sellBackValue(house: OwnedHouse | null | undefined): number {
  if (!house) return 0;
  const location = getHouseLocationDefinition(house.locationId);
  if (!location) return 0;

  let invested = location.cost;
  for (const roomType of house.builtRooms) {
    invested += getHouseRoomDefinition(roomType)?.cost ?? 0;
  }
  for (const businessType of house.shops) {
    if (!businessType) continue;
    invested += getHouseBusinessDefinition(businessType)?.cost ?? 0;
  }
  return Math.round(invested * location.sellBackFraction);
}

// ─── Slot availability ─────────────────────────────────────────────────────────

export function getAvailableRooms(house: OwnedHouse | null | undefined) {
  if (!house) return [];
  return HOUSE_ROOM_DEFINITIONS.filter(r => !house.builtRooms.includes(r.type));
}

export function hasFreeRoomSlot(house: OwnedHouse | null | undefined): boolean {
  if (!house) return false;
  const location = getHouseLocationDefinition(house.locationId);
  if (!location) return false;
  return house.builtRooms.length < location.roomSlots;
}

export function hasFreeShopSlot(house: OwnedHouse | null | undefined): boolean {
  if (!house) return false;
  return house.shops.some(s => s === null);
}

export { HOUSE_LOCATION_DEFINITIONS, HOUSE_ROOM_DEFINITIONS, HOUSE_BUSINESS_DEFINITIONS };
