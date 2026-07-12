/**
 * HousePickerModal — generic picker used by FamilyHousePanel for both
 * "build a room" and "rent a storefront": small, single-purchase catalogs
 * (4 entries each), so one parameterized modal covers both rather than two
 * near-duplicate components.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export interface HousePickerItem {
  id: string;
  name: string;
  cost: number;
  flavorText: string;
  /** One-line bonus summary, already formatted (caller decides the wording
   *  per item — rooms and businesses have different RoomBonus/BusinessBonus
   *  shapes, so formatting lives with the caller, not this generic modal). */
  bonusSummary: string;
}

interface HousePickerModalProps {
  title: string;
  subtitle?: string;
  items: HousePickerItem[];
  onPick: (id: string) => void;
  onClose: () => void;
}

export default function HousePickerModal({ title, subtitle, items, onPick, onClose }: HousePickerModalProps) {
  const denarii = useGameStore(s => s.denarii);

  return (
    <ScrollModal visible onClose={onClose} title={title} subtitle={subtitle}>
      {items.length === 0 && (
        <Text style={styles.emptyText}>Nothing available — every option here is already built or your slots are full.</Text>
      )}
      {items.map(item => {
        const canAfford = denarii >= item.cost;
        return (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, !canAfford && styles.rowDisabled]}
            activeOpacity={0.75}
            disabled={!canAfford}
            onPress={() => onPick(item.id)}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.flavor}>{item.flavorText}</Text>
            <Text style={styles.bonus}>{item.bonusSummary}</Text>
            <Text style={[styles.cost, !canAfford && styles.costDisabled]}>
              {canAfford ? `${item.cost} Denarii` : `Need ${item.cost - denarii} more Denarii`}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  row: {
    backgroundColor: 'rgba(200,168,112,0.25)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  name: {
    color: PARCHMENT.heading,
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '700',
  },
  flavor: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  bonus: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: SPACING.xs,
  },
  cost: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  costDisabled: {
    color: PARCHMENT.muted,
  },
});
