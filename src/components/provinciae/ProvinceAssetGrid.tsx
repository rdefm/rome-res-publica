import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import type { ProvinceState, ProvinceAssetOwned, ProvinceAssetDefinition } from '../../models/province';
import {
  getAvailableAssetsForProvince,
  getProvinceAssetDefinition,
} from '../../data/provinceAssets';

// ─── Component ────────────────────────────────────────────────────────────────

interface ProvinceAssetGridProps {
  province: ProvinceState;
  playerDenarii: number;
  onPurchase: (definitionId: string) => void;
  onUpgrade: (definitionId: string) => void;
}

export default function ProvinceAssetGrid({
  province,
  playerDenarii,
  onPurchase,
  onUpgrade,
}: ProvinceAssetGridProps) {
  const available = getAvailableAssetsForProvince(province.id);
  const owned = province.ownedAssets;

  const ownedIds = new Set(owned.map(a => a.definitionId));

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Owned assets */}
      {owned.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>YOUR ASSETS</Text>
          <View style={styles.grid}>
            {owned.map(asset => {
              const def = getProvinceAssetDefinition(asset.definitionId);
              if (!def) return null;
              return (
                <OwnedAssetCard
                  key={asset.definitionId}
                  asset={asset}
                  def={def}
                  playerDenarii={playerDenarii}
                  onUpgrade={() => onUpgrade(asset.definitionId)}
                />
              );
            })}
          </View>
          <View style={styles.divider} />
        </>
      )}

      {/* Available to purchase */}
      <Text style={styles.sectionTitle}>AVAILABLE TO ACQUIRE</Text>
      {available.filter(a => !ownedIds.has(a.id)).length === 0 ? (
        <Text style={styles.emptyText}>All available assets acquired.</Text>
      ) : (
        <View style={styles.grid}>
          {available
            .filter(a => !ownedIds.has(a.id))
            .map(def => (
              <AvailableAssetCard
                key={def.id}
                def={def}
                playerDenarii={playerDenarii}
                onPurchase={() => onPurchase(def.id)}
              />
            ))}
        </View>
      )}

      {/* Local Support summary */}
      <View style={styles.supportNote}>
        <Text style={styles.supportLabel}>LOCAL SUPPORT</Text>
        <View style={styles.supportBar}>
          <View
            style={[
              styles.supportBarFill,
              { width: `${province.localSupport}%` },
            ]}
          />
        </View>
        <Text style={styles.supportValue}>{province.localSupport} / 100</Text>
        <Text style={styles.supportHint}>
          Assets increase Local Support, gating Provincial Client recruitment.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function OwnedAssetCard({
  asset,
  def,
  playerDenarii,
  onUpgrade,
}: {
  asset: ProvinceAssetOwned;
  def: ProvinceAssetDefinition;
  playerDenarii: number;
  onUpgrade: () => void;
}) {
  const currentBonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
  const canUpgrade = asset.tier < 2;
  // Upgrade cost: 60% of base purchase price
  const upgradeCost = canUpgrade ? Math.round(def.cost * 0.6) : 0;
  const canAffordUpgrade = playerDenarii >= upgradeCost;

  return (
    <View style={styles.assetCard}>
      {/* Tier stars */}
      <View style={styles.assetTierRow}>
        {Array.from({ length: 2 }).map((_, i) => (
          <Text key={i} style={i < asset.tier ? styles.starFilled : styles.starEmpty}>
            ★
          </Text>
        ))}
        <Text style={styles.assetTierLabel}>{currentBonus.label}</Text>
      </View>

      <Text style={styles.assetName}>{def.name}</Text>
      <Text style={styles.assetBonus}>{renderBonusSummary(currentBonus)}</Text>
      <Text style={styles.assetFlavor} numberOfLines={2}>{def.flavorText}</Text>

      {canUpgrade ? (
        <TouchableOpacity
          style={[styles.upgradeButton, !canAffordUpgrade && styles.upgradeButtonDisabled]}
          onPress={onUpgrade}
          disabled={!canAffordUpgrade}
          activeOpacity={0.75}
        >
          <Text style={[styles.upgradeText, !canAffordUpgrade && styles.upgradeTextDim]}>
            Upgrade · {upgradeCost}g
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.maxTierBadge}>
          <Text style={styles.maxTierText}>MAX TIER</Text>
        </View>
      )}
    </View>
  );
}

function AvailableAssetCard({
  def,
  playerDenarii,
  onPurchase,
}: {
  def: ProvinceAssetDefinition;
  playerDenarii: number;
  onPurchase: () => void;
}) {
  const canAfford = playerDenarii >= def.cost;

  return (
    <View style={[styles.assetCard, styles.assetCardAvailable]}>
      <Text style={styles.assetName}>{def.name}</Text>
      <Text style={styles.assetBonus}>{renderBonusSummary(def.tier1Bonus)}</Text>
      <Text style={styles.assetFlavor} numberOfLines={2}>{def.flavorText}</Text>

      <View style={styles.supportGainRow}>
        <Text style={styles.supportGainText}>+{def.localSupportGain} Local Support</Text>
      </View>

      <TouchableOpacity
        style={[styles.purchaseButton, !canAfford && styles.purchaseButtonDisabled]}
        onPress={onPurchase}
        disabled={!canAfford}
        activeOpacity={0.75}
      >
        <Text style={[styles.purchaseText, !canAfford && styles.purchaseTextDim]}>
          {canAfford ? `Acquire · ${def.cost}g` : `${def.cost}g — insufficient funds`}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function renderBonusSummary(bonus: { goldPerTurn?: number; fidesPerTurn?: number; imperiumPerTurn?: number; relationshipPerTurn?: number }): string {
  const parts: string[] = [];
  if (bonus.goldPerTurn) parts.push(`+${bonus.goldPerTurn} Gold/turn`);
  if (bonus.fidesPerTurn) parts.push(`+${bonus.fidesPerTurn} Fides/turn`);
  if (bonus.imperiumPerTurn) parts.push(`+${bonus.imperiumPerTurn} Imperium/turn`);
  if (bonus.relationshipPerTurn) {
    const sign = bonus.relationshipPerTurn > 0 ? '+' : '';
    parts.push(`${sign}${bonus.relationshipPerTurn} Rel/turn`);
  }
  return parts.join(' · ') || 'No direct resource bonus';
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.md,
  } as ViewStyle,

  sectionTitle: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  } as TextStyle,

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  } as ViewStyle,

  assetCard: {
    width: '47%',
    backgroundColor: '#2a2218',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  } as ViewStyle,

  assetCardAvailable: {
    borderStyle: 'dashed',
    opacity: 0.9,
  } as ViewStyle,

  assetTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 2,
  } as ViewStyle,

  starFilled: {
    color: COLORS.gold,
    fontSize: 10,
  } as TextStyle,

  starEmpty: {
    color: COLORS.border,
    fontSize: 10,
  } as TextStyle,

  assetTierLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    marginLeft: 4,
  } as TextStyle,

  assetName: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  } as TextStyle,

  assetBonus: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 14,
  } as TextStyle,

  assetFlavor: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 14,
    marginBottom: SPACING.sm,
  } as TextStyle,

  supportGainRow: {
    backgroundColor: '#1a2018',
    borderRadius: 3,
    padding: 3,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  } as ViewStyle,

  supportGainText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 9,
  } as TextStyle,

  upgradeButton: {
    backgroundColor: '#3a2a10',
    borderRadius: 4,
    padding: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.goldDim,
  } as ViewStyle,

  upgradeButtonDisabled: {
    opacity: 0.4,
  } as ViewStyle,

  upgradeText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,

  upgradeTextDim: {
    color: COLORS.dust,
  } as TextStyle,

  maxTierBadge: {
    backgroundColor: '#1a2818',
    borderRadius: 4,
    padding: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.laurel,
  } as ViewStyle,

  maxTierText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
  } as TextStyle,

  purchaseButton: {
    backgroundColor: '#1a3010',
    borderRadius: 4,
    padding: 5,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.laurel,
  } as ViewStyle,

  purchaseButtonDisabled: {
    backgroundColor: '#1a1410',
    borderColor: COLORS.border,
    opacity: 0.6,
  } as ViewStyle,

  purchaseText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,

  purchaseTextDim: {
    color: COLORS.dust,
  } as TextStyle,

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  } as ViewStyle,

  emptyText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: SPACING.md,
  } as TextStyle,

  supportNote: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#1a1a10',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  supportLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  } as TextStyle,

  supportBar: {
    height: 6,
    backgroundColor: '#2a2018',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 3,
  } as ViewStyle,

  supportBarFill: {
    height: '100%',
    backgroundColor: COLORS.laurel,
    borderRadius: 3,
  } as ViewStyle,

  supportValue: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginBottom: 4,
  } as TextStyle,

  supportHint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 14,
  } as TextStyle,
});
