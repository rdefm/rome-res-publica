import type { CityAssetDefinition } from '../models/city';

// ─── City Asset Definitions ──────────────────────────────────────────────────
// 7 asset types, each with 2 tiers. Assets are cheaper than Roman assets
// but contribute directly to Local Support — embedding the family in the
// city over time.

export const CITY_ASSET_DEFINITIONS: CityAssetDefinition[] = [
  {
    id: 'latifundium',
    name: 'Latifundium',
    cost: 50,
    localSupportGain: 5,
    flavorText: 'A great farm estate worked by slaves and freedmen. The backbone of provincial wealth.',
    tier1Bonus: {
      label: 'Working Estate',
      goldPerTurn: 6,
    },
    tier2Bonus: {
      label: 'Productive Latifundium',
      goldPerTurn: 12,
    },
  },
  {
    id: 'roadside_inn',
    name: 'Roadside Inn',
    cost: 35,
    localSupportGain: 8,
    flavorText: 'Where soldiers rest, merchants deal, and locals talk. More valuable than it looks.',
    tier1Bonus: {
      label: 'Way-station',
      goldPerTurn: 3,
      fidesPerTurn: 1,
    },
    tier2Bonus: {
      label: 'Traveller\'s Inn',
      goldPerTurn: 5,
      fidesPerTurn: 2,
    },
  },
  {
    id: 'local_garrison_contract',
    name: 'Garrison Contract',
    cost: 60,
    localSupportGain: 4,
    flavorText: 'A contract to supply and quarter auxiliary troops. Generates Imperium and goodwill with the legions.',
    tier1Bonus: {
      label: 'Minor Contract',
      imperiumPerTurn: 2,
    },
    tier2Bonus: {
      label: 'Standing Contract',
      imperiumPerTurn: 4,
    },
  },
  {
    id: 'merchant_wharf',
    name: 'Merchant Wharf',
    cost: 70,
    localSupportGain: 3,
    flavorText: 'Control of a coastal or river trading post. Requires a water route — not available in highland cities.',
    tier1Bonus: {
      label: 'Trading Post',
      goldPerTurn: 8,
    },
    tier2Bonus: {
      label: 'Busy Wharf',
      goldPerTurn: 15,
    },
  },
  {
    id: 'temple_patronage',
    name: 'Temple Patronage',
    cost: 45,
    localSupportGain: 10,
    flavorText: 'Endowing a local temple buys spiritual legitimacy and the warmth of the community.',
    tier1Bonus: {
      label: 'Minor Patron',
      fidesPerTurn: 3,
      relationshipPerTurn: 2,
    },
    tier2Bonus: {
      label: 'Major Patron',
      fidesPerTurn: 5,
      relationshipPerTurn: 4,
    },
  },
  {
    id: 'grain_dole_subscription',
    name: 'Grain Dole',
    cost: 40,
    localSupportGain: 12,
    flavorText: 'Committing to seasonal grain distributions keeps the populace loyal and crisis risk lower.',
    tier1Bonus: {
      label: 'Seasonal Dole',
      relationshipPerTurn: 5,
    },
    tier2Bonus: {
      label: 'Regular Dole',
      relationshipPerTurn: 8,
    },
  },
  {
    id: 'mining_rights',
    name: 'Mining Rights',
    cost: 80,
    localSupportGain: 2,
    flavorText: 'A concession to extract metal or mineral wealth. Highly profitable but unpopular with locals.',
    tier1Bonus: {
      label: 'Working Mine',
      goldPerTurn: 12,
      relationshipPerTurn: -3,
    },
    tier2Bonus: {
      label: 'Expanded Mine',
      goldPerTurn: 20,
      relationshipPerTurn: -5,
    },
  },
];

// City-specific availability gates. Some assets only make sense in
// certain terrain types. If id is not in this map, it's available everywhere.
export const ASSET_CITY_RESTRICTIONS: Record<string, string[]> = {
  merchant_wharf: ['campania', 'etruria'],   // coastal/river only
  mining_rights:  ['samnium', 'cisalpine_gaul', 'etruria'], // highland/mineral-rich only
};

export function getCityAssetDefinition(id: string): CityAssetDefinition | undefined {
  return CITY_ASSET_DEFINITIONS.find(a => a.id === id);
}

export function getAvailableAssetsForCity(cityId: string): CityAssetDefinition[] {
  return CITY_ASSET_DEFINITIONS.filter(asset => {
    const restriction = ASSET_CITY_RESTRICTIONS[asset.id];
    return !restriction || restriction.includes(cityId);
  });
}
