import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { ASSET_DEFINITIONS } from '../../data/assetDefinitions';
import type { AssetDefinition } from '../../models/asset';
import PatrimoniumModal from './PatrimoniumModal';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';

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

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  economic:  COLORS.denariiColor,
  military:  COLORS.crimson,
  political: COLORS.senatBlue,
  cultural:  COLORS.purple,
};

// ─── Tier stars ───────────────────────────────────────────────────────────────

const TIER_STARS = ['★☆☆', '★★☆', '★★★'];

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({ def, onPress }: { def: AssetDefinition; onPress: () => void }) {
  const { ownedAssets, denarii } = useGameStore();
  const owned = ownedAssets.find(a => a.definitionId === def.id);
  const currentTier = owned?.currentTier ?? null;
  const isMaxTier = currentTier === 3;
  const catColor = CATEGORY_COLORS[def.category] ?? COLORS.gold;
  const source = ASSET_IMAGES[def.id];

  const tierStars = currentTier ? TIER_STARS[currentTier - 1] : null;
  const tierLabel = currentTier ? def.tiers[currentTier - 1].label : null;

  const actionLabel = !owned
    ? `Purchase — ${def.tiers[0].goldCost} Denarii`
    : isMaxTier
    ? 'Max tier reached'
    : `Upgrade — ${def.tiers[currentTier!].upgradeCost} Denarii`;

  const canAct = !owned
    ? denarii >= def.tiers[0].goldCost
    : !isMaxTier && denarii >= def.tiers[(currentTier ?? 1)].upgradeCost;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
      <ParchmentCard contentStyle={styles.cardInner} selected={!!owned} style={{ borderColor: owned ? catColor : 'transparent', borderWidth: owned ? 1 : 0 }}>
      {/* Left — square image */}
      <View style={styles.cardImageWrap}>
        {source ? (
          <Image
            source={source}
            style={[styles.cardImage, { borderColor: catColor }]}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.cardImage, styles.cardImageFallback, { borderColor: catColor }]} />
        )}
      </View>

      {/* Right — info column */}
      <View style={styles.cardInfo}>
        {/* Name + tier stars */}
        <View style={styles.cardNameRow}>
          <Text style={styles.cardName} numberOfLines={1}>{def.name}</Text>
          {tierStars && (
            <Text style={[styles.cardTierStars, { color: catColor }]}>{tierStars}</Text>
          )}
        </View>

        {/* Category */}
        <Text style={[styles.cardCategory, { color: catColor }]}>
          {def.category.toUpperCase()}
        </Text>

        {/* Current tier label */}
        {tierLabel && (
          <Text style={styles.cardTierLabel}>{tierLabel}</Text>
        )}

        {/* Flavour text */}
        <Text style={styles.cardFlavour} numberOfLines={3}>
          {def.flavourText}
        </Text>

        {/* Action */}
        <View style={styles.cardActionRow}>
          <Text style={[
            styles.cardActionText,
            !canAct && styles.cardActionTextDisabled,
            isMaxTier && styles.cardActionTextDisabled,
          ]}>
            {actionLabel}
          </Text>
        </View>
      </View>
      </ParchmentCard>
    </TouchableOpacity>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function PatrimoniumPanel() {
  const { ownedAssets } = useGameStore();
  const [selectedDef, setSelectedDef] = useState<AssetDefinition | null>(null);

  const ownedDefs = ASSET_DEFINITIONS.filter(d =>
    ownedAssets.some(a => a.definitionId === d.id)
  );
  const availableDefs = ASSET_DEFINITIONS.filter(d =>
    !ownedAssets.some(a => a.definitionId === d.id)
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.panelHeader}>PATRIMONIUM — ESTATE & ASSETS</Text>

        {ownedDefs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR HOLDINGS</Text>
            {ownedDefs.map(def => (
              <AssetCard key={def.id} def={def} onPress={() => setSelectedDef(def)} />
            ))}
          </>
        )}

        {availableDefs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>AVAILABLE TO ACQUIRE</Text>
            {availableDefs.map(def => (
              <AssetCard key={def.id} def={def} onPress={() => setSelectedDef(def)} />
            ))}
          </>
        )}

        {ownedDefs.length === 0 && availableDefs.length === 0 && (
          <Text style={styles.emptyText}>No assets available.</Text>
        )}
      </ScrollView>

      {selectedDef && (
        <PatrimoniumModal def={selectedDef} onClose={() => setSelectedDef(null)} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CARD_IMAGE_SIZE = 110;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  panelHeader: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 8,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },
  sectionLabel: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  emptyText: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACING.xl,
  },

  // ── Card ───────────────────────────────────────────────────────────────────
  cardInner: { flexDirection: 'row', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PARCHMENT_TEXT.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },

  // ── Left image block ───────────────────────────────────────────────────────
  cardImageWrap: {
    width: CARD_IMAGE_SIZE,
    overflow: 'hidden',
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardImage: {
    width: CARD_IMAGE_SIZE,
    height: '100%',
    borderRightWidth: 2,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardImageFallback: {
    backgroundColor: 'transparent',
  },

  // ── Right info column ──────────────────────────────────────────────────────
  cardInfo: {
    flex: 1,
    padding: SPACING.sm,
    justifyContent: 'space-between',
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardName: {
    color: PARCHMENT_TEXT.heading,
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  cardTierStars: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginLeft: SPACING.xs,
  },
  cardCategory: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 1,
  },
  cardTierLabel: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 2,
  },
  cardFlavour: {
    color: PARCHMENT_TEXT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 17,
    marginTop: SPACING.xs,
    flex: 1,
  },
  cardActionRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.xs,
    marginTop: SPACING.xs,
  },
  cardActionText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  },
  cardActionTextDisabled: {
    color: PARCHMENT_TEXT.muted,
  },
});
