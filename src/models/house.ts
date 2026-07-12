// ─── Family House ─────────────────────────────────────────────────────────────
// Types only, no logic (see engine/houseEngine.ts for bonus/roll/sell-back math
// and data/houseLocations.ts, data/houseRooms.ts, data/houseBusinesses.ts for
// content). Replaces the old Patrimonium-as-flat-asset-list model for the
// player's own residence — the 4 relocated assets (vineyard, gladiator_school,
// urban_insulae, baths) stay on models/asset.ts's OwnedAsset/AssetDefinition
// shape unchanged, just bought from Provinciae → Latium now instead of here.

import type { LeaderBias } from './clan';

export type RoomType = 'study' | 'hall' | 'kitchen' | 'library';

/** Per-room passive/mechanical effect payload. Every field is optional —
 *  each RoomDefinition only sets the ones relevant to it. */
export interface RoomBonus {
  /** Study — added to the success chance in houseEngine.rollTraining. */
  trainingRollBonus?: number;
  /** Entry Hall — added to BALANCE.clients.baseSlots by houseEngine.getClientSlotCap. */
  clientSlotBonus?: number;
  /** Kitchen & Dining — multiplies inviteToDinner's relationship gain. */
  dinnerRelationshipMult?: number;
  /** Library — recurring per-season Fides, folded into calcResourceIncome
   *  alongside the personal/province asset bonuses. */
  fidesPerSeason?: number;
  /** Library — one-time permanent rhetoric grant, applied directly to
   *  character.skills.rhetoric the moment the room is built (not recurring). */
  rhetoricGrant?: number;
}

export interface RoomDefinition {
  type: RoomType;
  name: string;
  cost: number;
  flavorText: string;
  bonus: RoomBonus;
}

export type BusinessType = 'tavern' | 'bakery' | 'fullers_shop' | 'moneylender';

export interface BusinessBonus {
  gold?: number;
  fides?: number;
  corruptionShield?: number;
}

export interface BusinessDefinition {
  type: BusinessType;
  name: string;
  cost: number;
  flavorText: string;
  bonus: BusinessBonus;
}

/** One neighborhood the family's house can be located in. Palatine is the
 *  only location with shopSlots: 0 — "all except Palatine have storefronts." */
export interface HouseLocationDefinition {
  id: string;
  name: string;
  latinName: string;
  prestige: 'low' | 'mid' | 'high';
  cost: number;
  /** Fraction of total invested (location + built rooms + rented businesses)
   *  refunded when relocating away from this house. */
  sellBackFraction: number;
  roomSlots: number;
  shopSlots: number;
  /** Which faction this neighborhood leans toward, if any. */
  biasAlignment: LeaderBias | null;
  locationBonus: {
    /** Palatine — flat Dignitas every season, folded into the same
     *  season-end step that applies Library's fidesPerSeason. */
    dignitasPerSeason?: number;
    /** Less-prestigious neighborhoods — a small per-season relationship
     *  drift toward leaders sharing biasAlignment (mirrors the sign/shape
     *  of reputationEngine's existing per-leader relationship drift). */
    factionRelPerSeason?: number;
  };
  flavorText: string;
}

/** The player's single house — relocatable, never absent (a starter house is
 *  granted for free at game start, see state/gameStore.ts's INITIAL_STATE). */
export interface OwnedHouse {
  locationId: string;
  builtRooms: RoomType[];
  /** Fixed-length, sized to the location's shopSlots at purchase time — each
   *  slot independently empty (null) or rented to one BusinessType. Resized
   *  (truncated/padded with null) by gameStore.buyHouse on relocation. */
  shops: (BusinessType | null)[];
  turnAcquired: number;
}
