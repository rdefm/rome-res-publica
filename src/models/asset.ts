export type AssetCategory = 'economic' | 'military' | 'political' | 'cultural';

export interface AssetTier {
  tier: 1 | 2 | 3;
  label: string;            // e.g. "Villa", "Estate", "Grand Estate"
  goldCost: number;
  upgradeCost: number;      // cost to reach this tier from previous
  passiveBonus: AssetBonus;
  unlockedActions?: string[]; // action IDs this tier unlocks
}

export interface AssetBonus {
  gold?: number;
  dignitas?: number;
  imperium?: number;
  gratia?: number;
  gravitas?: number;
  // Slot bonuses
  rhetoricalBonus?: number;
  martialBonus?: number;
  auctoritasBonus?: number;
  intrigusBonus?: number;
  // Special
  clientSlots?: number;       // extra client network slots
  corruptionShield?: number;  // reduces corruption score gain
  trialDefenseBonus?: number;
}

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  flavourText: string;
  tiers: [AssetTier, AssetTier, AssetTier];
}

export interface OwnedAsset {
  definitionId: string;
  currentTier: 1 | 2 | 3;
  assignedCharacterId?: string; // some assets can be tied to a family member
  turnAcquired: number;
}
