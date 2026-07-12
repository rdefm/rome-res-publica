/**
 * RelocateModal — detail view for one "Relocate" candidate location, opened
 * by tapping it in FamilyHousePanel's Relocate list. Replaces the old
 * Alert.alert confirm (which is also a no-op on react-native-web — Alert.alert
 * has no implementation there, so the whole relocate flow was silently
 * unusable on web; this fixes that as a side effect).
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { sellBackValue } from '../../engine/houseEngine';
import type { HouseLocationDefinition, OwnedHouse } from '../../models/house';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const PRESTIGE_LABEL: Record<string, string> = { low: 'LOW PRESTIGE', mid: 'MID PRESTIGE', high: 'HIGH PRESTIGE' };

interface RelocateModalProps {
  location: HouseLocationDefinition;
  currentHouse: OwnedHouse;
  onConfirm: () => void;
  onClose: () => void;
}

export default function RelocateModal({ location, currentHouse, onConfirm, onClose }: RelocateModalProps) {
  const denarii = useGameStore(s => s.denarii);
  const refund = sellBackValue(currentHouse);
  const net = Math.max(0, location.cost - refund);
  const canAfford = denarii >= net;

  return (
    <ScrollModal
      visible
      onClose={onClose}
      title={location.name}
      subtitle={`${location.latinName} · ${PRESTIGE_LABEL[location.prestige]}${location.biasAlignment ? ` · ${location.biasAlignment.toUpperCase()} LEANING` : ''}`}
    >
      <Text style={styles.flavor}>{location.flavorText}</Text>

      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Room slots</Text>
        <Text style={styles.statValue}>{location.roomSlots}</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Storefront slots</Text>
        <Text style={styles.statValue}>{location.shopSlots}</Text>
      </View>
      {location.locationBonus.dignitasPerSeason ? (
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Location bonus</Text>
          <Text style={styles.statValue}>+{location.locationBonus.dignitasPerSeason} Dignitas/season</Text>
        </View>
      ) : null}
      {location.locationBonus.factionRelPerSeason ? (
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Location bonus</Text>
          <Text style={styles.statValue}>+{location.locationBonus.factionRelPerSeason} relationship/season with {location.biasAlignment} leaders</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.statRow}>
        <Text style={styles.statLabel}>{location.name} costs</Text>
        <Text style={styles.statValue}>{location.cost} Denarii</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabel}>Current house sells back for</Text>
        <Text style={styles.statValue}>{refund} Denarii</Text>
      </View>
      <View style={styles.statRow}>
        <Text style={styles.statLabelStrong}>Net cost</Text>
        <Text style={styles.statValueStrong}>{net} Denarii</Text>
      </View>
      <Text style={styles.note}>Rooms and storefronts built in your current house do not carry over.</Text>

      <TouchableOpacity
        style={[styles.confirmBtn, !canAfford && styles.confirmBtnDisabled]}
        activeOpacity={0.75}
        disabled={!canAfford}
        onPress={onConfirm}
      >
        <Text style={styles.confirmBtnText}>
          {canAfford ? `Relocate — ${net} Denarii net` : `Need ${net - denarii} more Denarii`}
        </Text>
      </TouchableOpacity>
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  flavor: {
    color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13,
    lineHeight: 19, marginBottom: SPACING.md,
  },
  statRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: SPACING.xs, gap: SPACING.sm,
  },
  statLabel: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11, flexShrink: 1 },
  statValue: { color: PARCHMENT.body, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  statLabelStrong: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700' },
  statValueStrong: { color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 13, fontWeight: '700' },
  divider: {
    height: 1, backgroundColor: PARCHMENT.border, marginVertical: SPACING.sm, opacity: 0.6,
  },
  note: {
    color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11,
    marginTop: SPACING.sm, marginBottom: SPACING.md,
  },
  confirmBtn: {
    backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: COLORS.gold,
    borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center',
  },
  confirmBtnDisabled: { borderColor: PARCHMENT.border, opacity: 0.5 },
  confirmBtnText: { color: PARCHMENT.gold, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700' },
});
