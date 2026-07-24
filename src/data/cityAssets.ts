import type { AssetDefinition } from '../models/asset';
import { ASSET_DEFINITIONS } from './assetDefinitions';

// ─── City (Province) Asset Definitions ───────────────────────────────────────
// July 2026 fixes, Chunk E — rewritten onto the unified 3-tier AssetDefinition
// shape (models/asset.ts), previously Latium-only. Every asset here keeps its
// original id/flavour/first-two-tier numbers; a 3rd tier was added to each,
// continuing its existing tier1→tier2 growth ratio (first-pass/unverified,
// same convention as every other number in this file). `localSupportGain`
// (a one-time bonus on first purchase, not part of the per-tier passiveBonus)
// is the one province-only mechanic ported over unchanged from the old
// CityAssetDefinition shape.
//
// Two new assets this chunk: `provincial_ludus` (a gladiator school "in every
// region," per the explicit ask — a deliberately different id/bonus profile
// from Latium's own `gladiator_school`, so the two don't collide or read as
// duplicates) and `campania_holiday_estate` (Campania-only).

export const CITY_ASSET_DEFINITIONS: AssetDefinition[] = [
  {
    id: 'latifundium',
    name: 'Latifundium',
    category: 'economic',
    scope: 'provinces',
    localSupportGain: 5,
    flavourText: 'A great farm estate worked by slaves and freedmen. The backbone of provincial wealth.',
    tiers: [
      { tier: 1, label: 'Working Estate',        goldCost: 50, upgradeCost: 0,
        passiveBonus: { gold: 6 } },
      { tier: 2, label: 'Productive Latifundium', goldCost: 0, upgradeCost: 30,
        passiveBonus: { gold: 12 } },
      { tier: 3, label: 'Sprawling Latifundium',   goldCost: 0, upgradeCost: 50,
        passiveBonus: { gold: 22 } },
    ],
  },
  {
    id: 'roadside_inn',
    name: 'Roadside Inn',
    category: 'economic',
    scope: 'provinces',
    localSupportGain: 8,
    flavourText: 'Where soldiers rest, merchants deal, and locals talk. More valuable than it looks.',
    tiers: [
      { tier: 1, label: 'Way-station',      goldCost: 35, upgradeCost: 0,
        passiveBonus: { gold: 3, fides: 1 } },
      { tier: 2, label: "Traveller's Inn",   goldCost: 0,  upgradeCost: 21,
        passiveBonus: { gold: 5, fides: 2 } },
      { tier: 3, label: 'Posting House',     goldCost: 0,  upgradeCost: 35,
        passiveBonus: { gold: 8, fides: 3 } },
    ],
  },
  {
    id: 'local_garrison_contract',
    name: 'Garrison Contract',
    category: 'military',
    scope: 'provinces',
    localSupportGain: 4,
    flavourText: 'A contract to supply and quarter auxiliary troops. Generates Imperium and goodwill with the legions.',
    tiers: [
      { tier: 1, label: 'Minor Contract',    goldCost: 60, upgradeCost: 0,
        passiveBonus: { imperium: 2 } },
      { tier: 2, label: 'Standing Contract',  goldCost: 0,  upgradeCost: 36,
        passiveBonus: { imperium: 4 } },
      { tier: 3, label: 'Exclusive Contract', goldCost: 0,  upgradeCost: 60,
        passiveBonus: { imperium: 7 } },
    ],
  },
  {
    id: 'merchant_wharf',
    name: 'Merchant Wharf',
    category: 'economic',
    scope: 'everywhere',
    localSupportGain: 3,
    flavourText: 'Control of a coastal or river trading post. Requires a water route — not available inland.',
    tiers: [
      { tier: 1, label: 'Trading Post',     goldCost: 70, upgradeCost: 0,
        passiveBonus: { gold: 8 } },
      { tier: 2, label: 'Busy Wharf',        goldCost: 0,  upgradeCost: 42,
        passiveBonus: { gold: 15 } },
      { tier: 3, label: 'Harbor Monopoly',   goldCost: 0,  upgradeCost: 70,
        passiveBonus: { gold: 26 } },
    ],
  },
  {
    id: 'temple_patronage',
    name: 'Temple Patronage',
    category: 'political',
    scope: 'everywhere',
    localSupportGain: 10,
    flavourText: 'Endowing a local temple buys spiritual legitimacy and the warmth of the community.',
    tiers: [
      { tier: 1, label: 'Minor Patron',       goldCost: 45, upgradeCost: 0,
        passiveBonus: { fides: 3, relationshipPerTurn: 2 } },
      { tier: 2, label: 'Major Patron',        goldCost: 0,  upgradeCost: 27,
        passiveBonus: { fides: 5, relationshipPerTurn: 4 } },
      { tier: 3, label: "High Priest's Favor", goldCost: 0,  upgradeCost: 45,
        passiveBonus: { fides: 8, relationshipPerTurn: 6 } },
    ],
  },
  {
    id: 'grain_dole_subscription',
    name: 'Grain Dole',
    category: 'political',
    scope: 'provinces',
    localSupportGain: 12,
    flavourText: 'Committing to seasonal grain distributions keeps the populace loyal and crisis risk lower.',
    tiers: [
      { tier: 1, label: 'Seasonal Dole',          goldCost: 40, upgradeCost: 0,
        passiveBonus: { relationshipPerTurn: 5 } },
      { tier: 2, label: 'Regular Dole',            goldCost: 0,  upgradeCost: 24,
        passiveBonus: { relationshipPerTurn: 8 } },
      { tier: 3, label: 'Permanent Subscription',  goldCost: 0,  upgradeCost: 40,
        passiveBonus: { relationshipPerTurn: 12 } },
    ],
  },
  {
    id: 'mining_rights',
    name: 'Mining Rights',
    category: 'economic',
    scope: 'provinces',
    localSupportGain: 2,
    flavourText: 'A concession to extract metal or mineral wealth. Highly profitable but unpopular with locals.',
    tiers: [
      { tier: 1, label: 'Working Mine',       goldCost: 80, upgradeCost: 0,
        passiveBonus: { gold: 12, relationshipPerTurn: -3 } },
      { tier: 2, label: 'Expanded Mine',        goldCost: 0,  upgradeCost: 48,
        passiveBonus: { gold: 20, relationshipPerTurn: -5 } },
      { tier: 3, label: 'Deep Vein Concession', goldCost: 0,  upgradeCost: 80,
        passiveBonus: { gold: 32, relationshipPerTurn: -8 } },
    ],
  },
  {
    id: 'provincial_ludus',
    name: 'Provincial Ludus',
    category: 'cultural',
    scope: 'provinces',
    localSupportGain: 6,
    flavourText: "Games draw a crowd from every corner of the province — and a full arena is a province that isn't rioting.",
    tiers: [
      { tier: 1, label: 'Traveling Troupe',  goldCost: 55, upgradeCost: 0,
        passiveBonus: { gold: 2, relationshipPerTurn: 3, plebsPerTurn: 2 } },
      { tier: 2, label: 'Local Ludus',        goldCost: 0,  upgradeCost: 35,
        passiveBonus: { gold: 4, relationshipPerTurn: 5, plebsPerTurn: 3 } },
      { tier: 3, label: 'Provincial Arena',   goldCost: 0,  upgradeCost: 58,
        passiveBonus: { gold: 7, relationshipPerTurn: 8, plebsPerTurn: 5 } },
    ],
  },
  {
    id: 'campania_holiday_estate',
    name: 'Campania Holiday Estate',
    category: 'political',
    scope: 'provinces',
    localSupportGain: 4,
    flavourText: "A countryside retreat for the political class, far from the city's noise — the sort of place where alliances are made over wine, not votes.",
    tiers: [
      { tier: 1, label: 'Country Villa',       goldCost: 65, upgradeCost: 0,
        passiveBonus: { fides: 3, lifetimeDignitas: 1, optimatesRelPerTurn: 2 } },
      { tier: 2, label: 'Countryside Retreat',  goldCost: 0,  upgradeCost: 45,
        passiveBonus: { fides: 5, lifetimeDignitas: 2, optimatesRelPerTurn: 4 } },
      { tier: 3, label: 'Senatorial Estate',     goldCost: 0,  upgradeCost: 75,
        passiveBonus: { fides: 8, lifetimeDignitas: 3, optimatesRelPerTurn: 6 } },
    ],
  },
];

// ─── Combined catalog ─────────────────────────────────────────────────────────
// The single list both Latium (HoldingsPanel/HoldingsModal) and every
// province (via getAvailableAssetsForLocation('latium' | cityId)) read.

export const ALL_ASSET_DEFINITIONS: AssetDefinition[] = [...ASSET_DEFINITIONS, ...CITY_ASSET_DEFINITIONS];

// Fine-grained per-location availability, layered on top of `scope`. If an
// asset's id isn't a key here, it's available at every location its scope
// otherwise allows. Renamed from ASSET_CITY_RESTRICTIONS ('latium' is now a
// valid entry, e.g. Merchant Wharf's Ostia-adjacent access to the sea) and
// extended for the Mediterranean cities (Chunk D's new map).
export const ASSET_LOCATION_RESTRICTIONS: Record<string, string[]> = {
  merchant_wharf: [
    'latium', 'campania', 'etruria', // coastal/river Italy
    'messana', 'syracuse', 'agrigentum', 'lilybaeum', // Sicily is all coastal
    'alalia', 'olbia', 'sulci', // Sardinia/Corsica, same
    'carthage', 'tripolitania', // African coast
  ],
  mining_rights: ['samnium', 'cisalpine_gaul', 'etruria', 'sulci'], // highland/mineral-rich only — Sulci's silver/lead mines
  campania_holiday_estate: ['campania'],
};

/** locationId is 'latium' or a CityState.id. */
export function isAssetAvailableAt(def: AssetDefinition, locationId: string): boolean {
  if (def.scope === 'latium' && locationId !== 'latium') return false;
  if (def.scope === 'provinces' && locationId === 'latium') return false;
  const restriction = ASSET_LOCATION_RESTRICTIONS[def.id];
  return !restriction || restriction.includes(locationId);
}

export function getAssetDefinition(id: string): AssetDefinition | undefined {
  return ALL_ASSET_DEFINITIONS.find(a => a.id === id);
}

export function getAvailableAssetsForLocation(locationId: string): AssetDefinition[] {
  return ALL_ASSET_DEFINITIONS.filter(def => isAssetAvailableAt(def, locationId));
}
