import type { HouseLocationDefinition } from '../models/house';

// ─── Family House — neighborhoods ────────────────────────────────────────────
// 4 locations, low → high prestige. Palatine is the only one with
// shopSlots: 0 ("all except Palatine have storefronts"). sellBackFraction is
// currently the same everywhere (BALANCE.house.sellBackFraction, 0.5) — kept
// per-location for future tuning rather than a shared constant, matching
// data/provinceAssets.ts's convention of inlining its own numbers.

export const HOUSE_LOCATION_DEFINITIONS: HouseLocationDefinition[] = [
  {
    id: 'subura',
    name: 'Subura',
    latinName: 'Subura',
    prestige: 'low',
    cost: 100,
    sellBackFraction: 0.5,
    roomSlots: 2,
    shopSlots: 2,
    biasAlignment: 'populares',
    locationBonus: { factionRelPerSeason: 2 },
    flavorText: 'A crowded, noisy warren of shops and tenements below the Esquiline — cheap, commercial, and never quiet. The people here remember who lives among them.',
  },
  {
    id: 'aventine',
    name: 'Aventine Hill',
    latinName: 'Aventinus',
    prestige: 'low',
    cost: 150,
    sellBackFraction: 0.5,
    roomSlots: 2,
    shopSlots: 3,
    biasAlignment: 'populares',
    locationBonus: { factionRelPerSeason: 1 },
    flavorText: "Traditionally the plebeians' own hill, home to the temple of Ceres and a long memory of secession. A respectable address for a family that means to be seen among the people.",
  },
  {
    id: 'caelian',
    name: 'Caelian Hill',
    latinName: 'Caelius',
    prestige: 'mid',
    cost: 220,
    sellBackFraction: 0.5,
    roomSlots: 3,
    shopSlots: 2,
    biasAlignment: null,
    locationBonus: {},
    flavorText: 'A quieter hill of established households, neither fashionable nor humble. No particular faction claims it — which some families prefer.',
  },
  {
    id: 'palatine',
    name: 'Palatine Hill',
    latinName: 'Palatium',
    prestige: 'high',
    cost: 400,
    sellBackFraction: 0.5,
    roomSlots: 4,
    shopSlots: 0,
    biasAlignment: 'optimates',
    locationBonus: { dignitasPerSeason: 2, factionRelPerSeason: 2 },
    flavorText: "Rome's most prestigious address, where the old consular families keep their houses. No shopfronts sully these walls — but every senator who matters can find your door.",
  },
];

export function getHouseLocationDefinition(id: string): HouseLocationDefinition | undefined {
  return HOUSE_LOCATION_DEFINITIONS.find(l => l.id === id);
}
