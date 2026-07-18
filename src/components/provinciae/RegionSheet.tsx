// ─── RegionSheet ─────────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C2 — new. Opened by tapping empty ground inside a
// region's border outline on the theatre map, or by tapping an army marker
// (in which case `focusArmyId` highlights that specific army). Shows the
// region's overview (controller, live relationship, cities inside it) and
// every Army currently stationed there as an ArmyCard.
//
// Sibling to CitySheet, not a tab inside it — a region and a city are
// different granularities now (Campaign Map plan Chunk C1): a region groups
// several cities, so its own sheet needed its own home.

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { Army } from '../../models/army';
import type { Character } from '../../models/character';
import type { TheatreState, RegionId } from '../../models/theatre';
import type { CityState } from '../../models/city';
import { getRegion, getRegionRelationship } from '../../engine/theatreEngine';
import { getCityDefinition } from '../../data/cityDefinitions';
import type { MusterTier } from '../../engine/musterEngine';
import ArmyCard from './ArmyCard';
import MusterPanel from './MusterPanel';

const CONTROLLER_LABEL: Record<'rome' | 'carthage' | 'neutral', string> = {
  rome: 'Roman',
  carthage: 'Carthaginian',
  neutral: 'Contested',
};

const CONTROLLER_COLOR: Record<'rome' | 'carthage' | 'neutral', string> = {
  rome: '#d69a3a',
  carthage: '#a860c9',
  neutral: '#4ab8b8',
};

interface RegionSheetProps {
  regionId: RegionId;
  armies: Army[];
  cities: CityState[];
  theatre: TheatreState;
  family: Character[];
  focusArmyId?: string | null;
  playerImperium: number;
  playerHoldsOffice: boolean;
  denarii: number;
  onClose: () => void;
  onCombineArmies: (armyIdA: string, armyIdB: string) => void;
  onDivideArmy: (armyId: string, unitIds: string[]) => void;
  onAssignCommander: (armyId: string, characterId: string | null) => void;
  onSetStance: (armyId: string, stance: Army['stance']) => void;
  onRaiseTroops: (tier: MusterTier, targetArmyId: string | null) => void;
}

export default function RegionSheet({
  regionId,
  armies,
  cities,
  theatre,
  family,
  focusArmyId,
  playerImperium,
  playerHoldsOffice,
  denarii,
  onClose,
  onCombineArmies,
  onDivideArmy,
  onAssignCommander,
  onSetStance,
  onRaiseTroops,
}: RegionSheetProps) {
  const [combiningArmyId, setCombiningArmyId] = useState<string | null>(null);

  const region = getRegion(regionId);
  if (!region) return null;

  const controller = theatre.controllers[regionId];
  const relationship = getRegionRelationship(cities, regionId);
  const regionArmies = armies.filter(a => a.location === regionId);
  const combiningArmy = combiningArmyId ? regionArmies.find(a => a.id === combiningArmyId) : null;

  function eligiblePartners(army: Army): Army[] {
    return regionArmies.filter(other => other.id !== army.id && other.owner === army.owner);
  }

  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.regionName}>{region.name.toUpperCase()}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: CONTROLLER_COLOR[controller] }]} />
            <Text style={styles.statusLabel}>
              {CONTROLLER_LABEL[controller]} · relationship {Math.round(relationship)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
        <Text style={styles.latinName}>{region.displayNameLatin}</Text>

        <View style={styles.overviewRow}>
          <OverviewStat label="Terrain" value={region.terrainId.replace('_', ' ')} />
          <OverviewStat label="Coastal" value={region.coastal ? 'Yes' : 'No'} />
          <OverviewStat label="Manpower" value={String(region.baseManpower)} />
        </View>

        <Text style={styles.sectionLabel}>CITIES</Text>
        <View style={styles.citiesRow}>
          {region.cityIds.map(cityId => {
            const def = getCityDefinition(cityId);
            return (
              <View key={cityId} style={styles.cityChip}>
                <Text style={styles.cityChipText}>{def?.name ?? cityId}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.divider} />

        <MusterPanel
          regionId={regionId}
          theatre={theatre}
          cities={cities}
          armies={armies}
          playerImperium={playerImperium}
          playerHoldsOffice={playerHoldsOffice}
          denarii={denarii}
          onRaise={onRaiseTroops}
        />

        <View style={styles.divider} />

        <Text style={styles.sectionLabel}>ARMIES ({regionArmies.length})</Text>
        {regionArmies.length === 0 ? (
          <Text style={styles.emptyText}>No armies stationed here.</Text>
        ) : (
          regionArmies.map(army => (
            <ArmyCard
              key={army.id}
              army={army}
              family={family}
              theatre={theatre}
              cities={cities}
              focused={army.id === focusArmyId}
              combineEligible={eligiblePartners(army).length > 0}
              onCombinePress={() => setCombiningArmyId(army.id)}
              onDivide={unitIds => onDivideArmy(army.id, unitIds)}
              onAssignCommander={characterId => onAssignCommander(army.id, characterId)}
              onSetStance={stance => onSetStance(army.id, stance)}
            />
          ))
        )}
      </ScrollView>

      {/* Combine partner picker */}
      <Modal visible={!!combiningArmy} transparent animationType="fade" onRequestClose={() => setCombiningArmyId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>COMBINE {combiningArmy?.name.toUpperCase()}</Text>
            <Text style={styles.modalHint}>Pick another army in this region to merge into one.</Text>
            {combiningArmy && eligiblePartners(combiningArmy).map(partner => (
              <TouchableOpacity
                key={partner.id}
                style={styles.partnerRow}
                onPress={() => {
                  onCombineArmies(combiningArmy.id, partner.id);
                  setCombiningArmyId(null);
                }}
                activeOpacity={0.75}
              >
                <Text style={styles.partnerName}>{partner.name}</Text>
                <Text style={styles.partnerMeta}>{partner.units.length} unit(s)</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => setCombiningArmyId(null)} activeOpacity={0.75}>
              <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.overviewStat}>
      <Text style={styles.overviewStatLabel}>{label}</Text>
      <Text style={styles.overviewStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: '#2e2a24',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  } as ViewStyle,

  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  } as ViewStyle,

  regionName: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  } as TextStyle,

  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 6 } as ViewStyle,
  statusDot: { width: 8, height: 8, borderRadius: 4 } as ViewStyle,
  statusLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 0.5 } as TextStyle,

  closeButton: { padding: SPACING.sm } as ViewStyle,
  closeText: { color: COLORS.dust, fontSize: 18, lineHeight: 20 } as TextStyle,

  content: { flex: 1 } as ViewStyle,
  contentInner: { padding: SPACING.md, paddingBottom: 140 } as ViewStyle,

  latinName: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
  } as TextStyle,

  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1a1410',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  } as ViewStyle,

  overviewStat: { alignItems: 'center', flex: 1 } as ViewStyle,
  overviewStatLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 8, letterSpacing: 0.6, marginBottom: 3 } as TextStyle,
  overviewStatValue: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' } as TextStyle,

  sectionLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  } as TextStyle,

  citiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.md } as ViewStyle,
  cityChip: {
    backgroundColor: '#1a1410',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  } as ViewStyle,
  cityChipText: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 10 } as TextStyle,

  divider: { height: 1, backgroundColor: COLORS.border, marginBottom: SPACING.md } as ViewStyle,

  emptyText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: SPACING.lg,
  } as TextStyle,

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  } as ViewStyle,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2e2a24',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    padding: SPACING.md,
  } as ViewStyle,
  modalTitle: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 13, letterSpacing: 1, marginBottom: 6 } as TextStyle,
  modalHint: { color: COLORS.dust, fontFamily: FONTS.body, fontSize: 11, fontStyle: 'italic', marginBottom: SPACING.sm, lineHeight: 15 } as TextStyle,
  partnerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1a12',
  } as ViewStyle,
  partnerName: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '600' } as TextStyle,
  partnerMeta: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10 } as TextStyle,
  modalBtnSecondary: {
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  } as ViewStyle,
  modalBtnSecondaryText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 } as TextStyle,
});
