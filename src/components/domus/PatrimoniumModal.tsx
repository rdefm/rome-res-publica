import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
} from 'react-native';
import type { AssetDefinition, AssetBonus } from '../../models/asset';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const { height } = Dimensions.get('window');


// ─── Asset image map ──────────────────────────────────────────────────────────

const ASSET_IMAGES: Record<string, ReturnType<typeof require> | null> = {
  vineyard: (() => {
    try { return require('../../assets/images/asset-vineyard.png'); } catch { return null; }
  })(),
  gladiator_school: (() => {
    try { return require('../../assets/images/asset-gladiator-school.png'); } catch { return null; }
  })(),
  library: (() => {
    try { return require('../../assets/images/asset-library.png'); } catch { return null; }
  })(),
  baths: (() => {
    try { return require('../../assets/images/asset-baths.png'); } catch { return null; }
  })(),
  urban_insulae: (() => {
    try { return require('../../assets/images/asset-insulae.png'); } catch { return null; }
  })(),
};

// ─── Bonus label map ──────────────────────────────────────────────────────────

const BONUS_LABELS: Record<keyof AssetBonus, string> = {
  gold:             '+{n} Denarii/season',
  dignitas:         '+{n} Dignitas/season',
  gratia:           '+{n} Gratia/season',
  gravitas:         '+{n} Gravitas/season',
  imperium:         '+{n} Imperium/season',
  rhetoricalBonus:  '+{n} Rhetoric skill bonus',
  martialBonus:     '+{n} Martial skill bonus',
  auctoritasBonus:  '+{n} Auctoritas skill bonus',
  intrigusBonus:    '+{n} Intrigus skill bonus',
  clientSlots:      '+{n} Client slot(s)',
  corruptionShield: '-{n} Corruption gain/season',
  trialDefenseBonus:'+{n} Trial defense bonus',
};

function formatBonus(key: keyof AssetBonus, value: number): string {
  return (BONUS_LABELS[key] ?? `+{n} ${key}`).replace('{n}', String(value));
}

function BonusList({ bonus }: { bonus: AssetBonus }) {
  const entries = Object.entries(bonus) as [keyof AssetBonus, number][];
  if (entries.length === 0) return <Text style={styles.bonusNone}>No bonus</Text>;
  return (
    <>
      {entries.map(([key, val]) => (
        <Text key={key} style={styles.bonusLine}>
          • {formatBonus(key, val)}
        </Text>
      ))}
    </>
  );
}

// ─── Tier row ─────────────────────────────────────────────────────────────────

const TIER_STARS = ['★☆☆', '★★☆', '★★★'];

function TierRow({
  def,
  tierIndex,
  isOwned,
  isCurrent,
}: {
  def: AssetDefinition;
  tierIndex: number;
  isOwned: boolean;
  isCurrent: boolean;
}) {
  const tier = def.tiers[tierIndex];
  const isLocked = !isOwned && tierIndex > 0;

  return (
    <View style={[styles.tierRow, isCurrent && styles.tierRowCurrent]}>
      <View style={styles.tierHeader}>
        <Text style={styles.tierStars}>{TIER_STARS[tierIndex]}</Text>
        <Text style={[styles.tierLabel, isCurrent && styles.tierLabelCurrent]}>
          {tier.label}
        </Text>
        {isCurrent && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>OWNED</Text>
          </View>
        )}
      </View>
      <View style={styles.tierCost}>
        <Text style={styles.tierCostText}>
          {tierIndex === 0
            ? `Purchase: ${tier.goldCost} Denarii`
            : `Upgrade: ${tier.upgradeCost} Denarii`}
        </Text>
      </View>
      <BonusList bonus={tier.passiveBonus} />
      {tier.unlockedActions && tier.unlockedActions.length > 0 && (
        <Text style={styles.unlockedAction}>
          🔓 Unlocks: {tier.unlockedActions.join(', ')}
        </Text>
      )}
    </View>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PatrimoniumModalProps {
  def: AssetDefinition;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatrimoniumModal({ def, onClose }: PatrimoniumModalProps) {
  const { ownedAssets, denarii, purchaseAsset, upgradeAsset } = useGameStore();

  const owned = ownedAssets.find(a => a.definitionId === def.id);
  const currentTier = owned?.currentTier ?? null;
  const isMaxTier = currentTier === 3;

  // nextTierIndex is the 0-based index of the tier we'd upgrade TO (currentTier is 1-based)
  const nextTierIndex = owned && !isMaxTier ? (owned.currentTier as number) : null;

  const canPurchase = !owned && denarii >= def.tiers[0].goldCost;
  const canUpgrade = owned && !isMaxTier && nextTierIndex !== null &&
    denarii >= (def.tiers[nextTierIndex as 0 | 1 | 2]?.upgradeCost ?? Infinity);

  const purchaseCost = def.tiers[0].goldCost;
  const upgradeCost = nextTierIndex !== null
    ? (def.tiers[nextTierIndex as 0 | 1 | 2]?.upgradeCost ?? null)
    : null;

  function handleAction() {
    if (!owned) {
      purchaseAsset(def.id);
    } else {
      upgradeAsset(def.id);
    }
    onClose();
  }

  const CATEGORY_COLORS: Record<string, string> = {
    economic:  COLORS.denariiColor,
    military:  COLORS.crimson,
    political: COLORS.senatBlue,
    cultural:  COLORS.purple,
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.backdrop} />
      <View style={styles.modal}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: CATEGORY_COLORS[def.category] ?? COLORS.gold }]}>
          <View style={styles.modalHeaderText}>
            <Text style={styles.modalTitle}>{def.name}</Text>
            <Text style={[styles.modalCategory, { color: CATEGORY_COLORS[def.category] ?? COLORS.gold }]}>
              {def.category.toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalScroll}
          contentContainerStyle={styles.modalScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero image */}
          {ASSET_IMAGES[def.id] && (
            <View style={styles.heroContainer}>
              <Image
                source={ASSET_IMAGES[def.id]!}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Flavour text */}
          <Text style={styles.flavourText}>"{def.flavourText}"</Text>

          {/* Tier table */}
          <Text style={styles.sectionLabel}>TIERS</Text>
          {([0, 1, 2] as const).map(i => (
            <TierRow
              key={i}
              def={def}
              tierIndex={i}
              isOwned={!!owned}
              isCurrent={currentTier === i + 1}
            />
          ))}
        </ScrollView>

        {/* Action button */}
        <View style={styles.actionRow}>
          {isMaxTier ? (
            <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
              <Text style={styles.actionBtnText}>Maximum tier reached</Text>
            </View>
          ) : !owned ? (
            <TouchableOpacity
              style={[styles.actionBtn, !canPurchase && styles.actionBtnDisabled]}
              onPress={handleAction}
              disabled={!canPurchase}
            >
              <Text style={styles.actionBtnText}>
                Purchase — {purchaseCost} Denarii
              </Text>
              {!canPurchase && (
                <Text style={styles.actionBtnSub}>
                  Need {purchaseCost - denarii} more Denarii
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, !canUpgrade && styles.actionBtnDisabled]}
              onPress={handleAction}
              disabled={!canUpgrade}
            >
              <Text style={styles.actionBtnText}>
                Upgrade to Tier {(currentTier ?? 1) + 1} — {upgradeCost} Denarii
              </Text>
              {!canUpgrade && upgradeCost !== null && (
                <Text style={styles.actionBtnSub}>
                  Need {upgradeCost - denarii} more Denarii
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 500,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,8,6,0.85)',
  },
  modal: {
    backgroundColor: COLORS.panelSurface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: height * 0.80,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderBottomWidth: 2,
  },
  modalHeaderText: {
    flex: 1,
  },
  modalTitle: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
  },
  modalCategory: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 2,
  },
  closeBtn: {
    padding: SPACING.xs,
  },
  closeBtnText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 16,
  },

  // ── Scroll content ─────────────────────────────────────────────────────────
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    padding: SPACING.md,
  },
  heroContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  flavourText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  // ── Tier row ───────────────────────────────────────────────────────────────
  tierRow: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tierRowCurrent: {
    borderColor: COLORS.gold,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  tierStars: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  tierLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  tierLabelCurrent: {
    color: COLORS.marble,
  },
  currentBadge: {
    backgroundColor: COLORS.gold + '22',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
  },
  currentBadgeText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
  },
  tierCost: {
    marginBottom: SPACING.xs,
  },
  tierCostText: {
    color: COLORS.denariiColor,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  bonusLine: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginBottom: 2,
  },
  bonusNone: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontStyle: 'italic',
  },
  unlockedAction: {
    color: COLORS.senatBlue,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: SPACING.xs,
  },

  // ── Action button ──────────────────────────────────────────────────────────
  actionRow: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionBtn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    borderColor: COLORS.border,
    opacity: 0.5,
  },
  actionBtnText: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnSub: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 4,
  },
});
