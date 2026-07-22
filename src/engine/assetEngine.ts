import type { OwnedAsset, AssetBonus, AssetDefinition } from '../models/asset';
import { getAssetDefinition } from '../data/cityAssets';

// July 2026 fixes, Chunk E — getDefinition now searches the combined catalog
// (Latium + province assets), not just the old Latium-only ASSET_DEFINITIONS.
// Every function below already took a generic OwnedAsset/definitionId, so
// this one change makes purchaseCost/upgradeCost/computeTotalAssetBonuses/
// getUnlockedAssetActions all correctly generic over BOTH Latium's
// GameState.ownedAssets and a province's CityState.ownedAssets — no other
// change needed in this file.
export function getDefinition(definitionId: string): AssetDefinition | undefined {
  return getAssetDefinition(definitionId);
}

/** Aggregate all passive bonuses across all owned assets */
export function computeTotalAssetBonuses(ownedAssets: OwnedAsset[]): AssetBonus {
  const total: AssetBonus = {};
  for (const owned of ownedAssets) {
    const def = getDefinition(owned.definitionId);
    if (!def) continue;
    const tierDef = def.tiers[owned.currentTier - 1];
    const b = tierDef.passiveBonus;
    for (const key of Object.keys(b) as (keyof AssetBonus)[]) {
      (total[key] as number) = ((total[key] as number) ?? 0) + (b[key] as number);
    }
  }
  return total;
}

/** Returns gold cost to purchase a new asset at tier 1 */
export function purchaseCost(definitionId: string): number {
  const def = getDefinition(definitionId);
  return def?.tiers[0].goldCost ?? 0;
}

/** Returns gold cost to upgrade an existing owned asset to its next tier */
export function upgradeCost(owned: OwnedAsset): number | null {
  if (owned.currentTier === 3) return null;
  const def = getDefinition(owned.definitionId);
  if (!def) return null;
  return def.tiers[owned.currentTier].upgradeCost;
}

/** Returns all action IDs unlocked by owned assets at their current tier */
export function getUnlockedAssetActions(ownedAssets: OwnedAsset[]): string[] {
  const actions: string[] = [];
  for (const owned of ownedAssets) {
    const def = getDefinition(owned.definitionId);
    if (!def) continue;
    const tierDef = def.tiers[owned.currentTier - 1];
    if (tierDef.unlockedActions) actions.push(...tierDef.unlockedActions);
  }
  return actions;
}
