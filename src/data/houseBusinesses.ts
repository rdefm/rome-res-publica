import type { BusinessDefinition } from '../models/house';

// ─── Family House — storefronts ──────────────────────────────────────────────
// Fixed catalog of 4 rentable business types, filling a location's shopSlots
// (Pompeii-style — every house but Palatine has street-facing shopfronts).
// Costs roughly match data/provinceAssets.ts's scale (35–80 denarii).

export const HOUSE_BUSINESS_DEFINITIONS: BusinessDefinition[] = [
  {
    type: 'tavern',
    name: 'Tavern',
    cost: 50,
    flavorText: 'Wine, dice, and gossip. A steady trickle of coin, and an ear on the street besides.',
    bonus: { gold: 6 },
  },
  {
    type: 'bakery',
    name: 'Bakery',
    cost: 40,
    flavorText: 'Bread sold at a fair price buys more goodwill than its coin is worth.',
    bonus: { fides: 2 },
  },
  {
    type: 'fullers_shop',
    name: "Fuller's Shop",
    cost: 60,
    flavorText: "A laundry and cloth-finishing business — unglamorous, and useful for laundering more than togas when the censors come asking.",
    bonus: { corruptionShield: 5 },
  },
  {
    type: 'moneylender',
    name: "Moneylender's Table",
    cost: 80,
    flavorText: 'Coin lent at interest, quietly, to those who need it. The most profitable shopfront in Rome — and the least respectable.',
    bonus: { gold: 12 },
  },
];

export function getHouseBusinessDefinition(type: string): BusinessDefinition | undefined {
  return HOUSE_BUSINESS_DEFINITIONS.find(b => b.type === type);
}
