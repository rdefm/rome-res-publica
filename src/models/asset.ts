export type AssetCategory = 'economic' | 'military' | 'political' | 'cultural';

// July 2026 fixes, Chunk E — where a purchasable asset is offered. 'latium'
// assets are bought via GameState.ownedAssets (a single flat array — Latium
// is one place); 'provinces' and 'everywhere' assets are bought per-city via
// CityState.ownedAssets (models/city.ts) — 'everywhere' additionally shows up
// in Latium's own catalog. Fine-grained per-city gating (coastal-only,
// highland-only, Campania-only) still layers on top via
// data/cityAssets.ts's ASSET_LOCATION_RESTRICTIONS, same convention as
// before this chunk, just renamed from ASSET_CITY_RESTRICTIONS now that
// 'latium' is itself a valid restriction-map key.
export type AssetScope = 'latium' | 'provinces' | 'everywhere';

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
  lifetimeDignitas?: number;
  imperium?: number;
  fides?: number;
  // Slot bonuses
  rhetoricalBonus?: number;
  martialBonus?: number;
  intrigusBonus?: number;
  // Special
  clientSlots?: number;       // extra client network slots
  corruptionShield?: number;  // reduces corruption score gain
  trialDefenseBonus?: number;
  // July 2026 fixes, Chunk E — city-scoped bonus, ported over from the
  // now-retired models/city.ts AssetBonus. No-op when the owning location is
  // Latium (GameState.ownedAssets rather than a CityState), since Latium has
  // no relationshipScore to apply it to — see engine/cityEngine.ts's
  // calcCityAssetBonuses, the only consumer.
  relationshipPerTurn?: number;
  // July 2026 fixes, Chunk E — Rome-wide bonuses (apply regardless of which
  // location owns the asset): plebsPerTurn is the "reduce unrest" ask's real
  // hook (calcUnrestEscalation reads state.rome.plebs, not a dedicated
  // unrest token — see engine/resourceEngine.ts's calcResourceIncome) and
  // optimatesRelPerTurn is the Campania estate's Optimates-relation ask.
  plebsPerTurn?: number;
  optimatesRelPerTurn?: number;
}

export interface AssetDefinition {
  id: string;
  name: string;
  category: AssetCategory;
  flavourText: string;
  scope: AssetScope;
  // July 2026 fixes, Chunk E — one-time Local Support gain on first
  // purchase (province assets only; ignored for 'latium'-scoped assets,
  // which have no Local Support concept). Ported from the now-retired
  // models/city.ts CityAssetDefinition.localSupportGain.
  localSupportGain?: number;
  tiers: [AssetTier, AssetTier, AssetTier];
}

export interface OwnedAsset {
  definitionId: string;
  currentTier: 1 | 2 | 3;
  assignedCharacterId?: string; // some assets can be tied to a family member
  turnAcquired: number;
}
