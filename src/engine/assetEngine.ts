import type { OwnedAsset, AssetBonus, AssetDefinition } from '../models/asset';
import { ASSET_DEFINITIONS } from '../data/assetDefinitions';

export function getDefinition(definitionId: string): AssetDefinition | undefined {
  return ASSET_DEFINITIONS.find(d => d.id === definitionId);
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
