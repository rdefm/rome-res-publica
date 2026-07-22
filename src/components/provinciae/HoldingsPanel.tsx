import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { getAvailableAssetsForLocation } from '../../data/cityAssets';
import type { AssetDefinition, OwnedAsset } from '../../models/asset';
import HoldingsModal from './HoldingsModal';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';

// ─── Asset image map ──────────────────────────────────────────────────────────
// July 2026 fixes, Chunk E — still Latium-only art; province assets have no
// image files yet, so they simply aren't keyed here (ASSET_IMAGES[id] is
// undefined, treated the same as a graceful require()-missing fallback).

const ASSET_IMAGES: Record<string, ReturnType<typeof require> | null> = {
  vineyard: (() => {
    try { return require('../../assets/images/asset-vineyard.png'); } catch { return null; }
  })(),
  gladiator_school: (() => {
    try { return require('../../assets/images/asset-gladiator-school.png'); } catch { return null; }
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

// ─── Owned-assets-at-location selector ───────────────────────────────────────
// July 2026 fixes, Chunk E — 'latium' reads the flat GameState.ownedAssets;
// any other locationId is a CityState.id and reads that city's nested one.

function useOwnedAssetsAt(locationId: string): OwnedAsset[] {
  return useGameStore(s =>
    locationId === 'latium'
      ? s.ownedAssets
      : s.cities.find(c => c.id === locationId)?.ownedAssets ?? []
  );
}

// ─── Asset card ───────────────────────────────────────────────────────────────

function AssetCard({
  def,
  locationId,
  onPress,
}: {
  def: AssetDefinition;
  locationId: string;
  onPress: () => void;
}) {
  const ownedAssets = useOwnedAssetsAt(locationId);
  const denarii = useGameStore(s => s.denarii);
  const owned = ownedAssets.find(a => a.definitionId === def.id);
  const currentTier = owned?.currentTier ?? null;
  const isMaxTier = currentTier === 3;
  const catColor = CATEGORY_COLORS[def.category] ?? COLORS.gold;
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
      {/* Info column — images shown in modal only */}
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

// ─── Local Support summary (province locations only) ─────────────────────────
// July 2026 fixes, Chunk E — ported from the now-retired CityAssetGrid.tsx.
// Latium has no Local Support concept, so this section is simply omitted
// there rather than shown with a meaningless value.

function LocalSupportNote({ locationId }: { locationId: string }) {
  const localSupport = useGameStore(s => s.cities.find(c => c.id === locationId)?.localSupport ?? 0);

  return (
    <View style={styles.supportNote}>
      <Text style={styles.supportLabel}>LOCAL SUPPORT</Text>
      <View style={styles.supportBar}>
        <View style={[styles.supportBarFill, { width: `${localSupport}%` }]} />
      </View>
      <Text style={styles.supportValue}>{localSupport} / 100</Text>
      <Text style={styles.supportHint}>
        Assets increase Local Support, gating Provincial Client recruitment.
      </Text>
    </View>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────
// Family House rework — moved here from Domus's old Patrimonium panel.
// July 2026 fixes, Chunk E — generalized with a `locationId` prop ('latium'
// default, or a CityState.id) so this single component + HoldingsModal now
// serve both Latium (LatiumSheet.tsx, unchanged call site) and every
// province (CitySheet.tsx, replacing the old CityAssetGrid.tsx) — "one
// coherent asset system" rather than two UIs that must be hand-kept in sync.
// Embedded as a section inside its parent screen's own ScrollView (no
// ScrollView/container of its own, avoiding scroll-view-inside-scroll-view).

export default function HoldingsPanel({ locationId = 'latium' }: { locationId?: string }) {
  const ownedAssets = useOwnedAssetsAt(locationId);
  const [selectedDef, setSelectedDef] = useState<AssetDefinition | null>(null);

  const availableAtLocation = getAvailableAssetsForLocation(locationId);
  const ownedDefs = availableAtLocation.filter(d =>
    ownedAssets.some(a => a.definitionId === d.id)
  );
  const availableDefs = availableAtLocation.filter(d =>
    !ownedAssets.some(a => a.definitionId === d.id)
  );

  return (
    <View style={styles.container}>
      {ownedDefs.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>YOUR HOLDINGS</Text>
          {ownedDefs.map(def => (
            <AssetCard key={def.id} def={def} locationId={locationId} onPress={() => setSelectedDef(def)} />
          ))}
        </>
      )}

      {availableDefs.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>AVAILABLE TO ACQUIRE</Text>
          {availableDefs.map(def => (
            <AssetCard key={def.id} def={def} locationId={locationId} onPress={() => setSelectedDef(def)} />
          ))}
        </>
      )}

      {ownedDefs.length === 0 && availableDefs.length === 0 && (
        <Text style={styles.emptyText}>No holdings available.</Text>
      )}

      {locationId !== 'latium' && <LocalSupportNote locationId={locationId} />}

      {selectedDef && (
        <HoldingsModal def={selectedDef} locationId={locationId} onClose={() => setSelectedDef(null)} />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    // No flex:1 — embedded inline inside the parent screen's own ScrollView.
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
  cardInner: { flexDirection: 'column' },
  card: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PARCHMENT_TEXT.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },

  // ── Info column ────────────────────────────────────────────────────────────
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

  // ── Local Support note (province locations only) ──────────────────────────
  supportNote: {
    marginTop: SPACING.md,
    padding: SPACING.sm,
    backgroundColor: '#1a1a10',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  supportLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  },
  supportBar: {
    height: 6,
    backgroundColor: '#2a2018',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 3,
  },
  supportBarFill: {
    height: '100%',
    backgroundColor: COLORS.laurel,
    borderRadius: 3,
  },
  supportValue: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginBottom: 4,
  },
  supportHint: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontStyle: 'italic',
    lineHeight: 14,
  },
});
