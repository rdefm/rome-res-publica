import type { AssetDefinition } from '../models/asset';

// Family House rework — these 4 assets now buy/upgrade from Provinciae →
// Latium (components/provinciae/LatiumSheet.tsx) instead of Domus's old
// Patrimonium panel, but are otherwise UNCHANGED: same OwnedAsset/tier shape,
// same engine/assetEngine.ts functions, same income-calc wiring in
// resourceEngine.ts. `library` (the 5th former Patrimonium asset) was
// removed entirely — it's reborn as a Family House room (data/houseRooms.ts);
// state/gameStore.ts's loadGame migrates any pre-rework save's `library`
// OwnedAsset into that room so no investment is lost.
// July 2026 fixes, Chunk E — each definition gained a `scope` field.
// Vineyard/Gladiator School/Insulae stay 'latium' (redundant with province
// equivalents, or too Rome-specific to generalize without inventing flavor
// text unprompted — see the plan's own cross-over discussion). Baths became
// 'everywhere': provincial bathhouses are an authentic, well-attested piece
// of Roman provincial life, and its bonus shape (fides/intrigus) needs no
// city-specific mechanic to work anywhere Latium's own copy already works.
export const ASSET_DEFINITIONS: AssetDefinition[] = [
  {
    id: 'vineyard',
    name: 'Vineyard',
    category: 'economic',
    scope: 'latium',
    flavourText: 'Fertile slopes outside the city yield fine wine and finer coin.',
    tiers: [
      { tier: 1, label: 'Small Vineyard',   goldCost: 80,  upgradeCost: 0,
        passiveBonus: { gold: 5 } },
      { tier: 2, label: 'Estate Vineyard',  goldCost: 0,   upgradeCost: 120,
        passiveBonus: { gold: 12, lifetimeDignitas: 1 } },
      { tier: 3, label: 'Grand Vineyard',   goldCost: 0,   upgradeCost: 200,
        passiveBonus: { gold: 22, lifetimeDignitas: 2 }, unlockedActions: ['host_banquet'] },
    ],
  },
  {
    id: 'gladiator_school',
    name: 'Gladiator School',
    category: 'military',
    scope: 'latium',
    flavourText: 'A ludus of hardened fighters — useful for spectacle, and for sending messages.',
    tiers: [
      { tier: 1, label: 'Small Ludus',       goldCost: 100, upgradeCost: 0,
        passiveBonus: { clientSlots: 1, martialBonus: 2 } },
      { tier: 2, label: 'Established Ludus', goldCost: 0,   upgradeCost: 150,
        passiveBonus: { clientSlots: 2, martialBonus: 4, fides: 2 } },
      { tier: 3, label: 'Grand Ludus',       goldCost: 0,   upgradeCost: 250,
        passiveBonus: { clientSlots: 3, martialBonus: 6, fides: 4 },
        unlockedActions: ['intimidate_witness'] },
    ],
  },
  {
    id: 'baths',
    name: 'Public Baths',
    category: 'political',
    scope: 'everywhere',
    flavourText: 'Coin spent on the people returns as goodwill — and votes.',
    tiers: [
      { tier: 1, label: 'Modest Baths',   goldCost: 90,  upgradeCost: 0,
        passiveBonus: { fides: 3 } },
      { tier: 2, label: 'Popular Baths',  goldCost: 0,   upgradeCost: 140,
        passiveBonus: { fides: 7, intrigusBonus: 2 } },
      { tier: 3, label: 'Grand Thermae',  goldCost: 0,   upgradeCost: 220,
        passiveBonus: { fides: 12, intrigusBonus: 4 },
        unlockedActions: ['host_rival_leader'] },
    ],
  },
  {
    id: 'urban_insulae',
    name: 'Insulae (Tenements)',
    category: 'economic',
    scope: 'latium',
    flavourText: "Rome's poor must live somewhere. Their rent fills your coffers.",
    tiers: [
      { tier: 1, label: 'Modest Block',       goldCost: 70,  upgradeCost: 0,
        passiveBonus: { gold: 8 } },
      { tier: 2, label: 'Prosperous Block',   goldCost: 0,   upgradeCost: 110,
        passiveBonus: { gold: 18, corruptionShield: 5 } },
      { tier: 3, label: 'Extensive Holdings', goldCost: 0,   upgradeCost: 190,
        passiveBonus: { gold: 32, corruptionShield: 10 },
        unlockedActions: ['sway_urban_mob'] },
    ],
  },
];
