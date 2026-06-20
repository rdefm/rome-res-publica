import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export default function DomesticDirectivesTray() {
  const {
    dignitas, laudatioActive, laudatioBonus,
    commissionLaudatio, performAdrogatio, arrangeMarriageDomus,
  } = useGameStore();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>DOMESTIC DIRECTIVES</Text>

      <DirectiveButton
        label="Commission Laudatio"
        cost="12 Dignitas"
        desc={
          laudatioActive
            ? `Active — +${laudatioBonus} Dignitas/season`
            : 'Establish a recurring ancestral praise — Dignitas income +3/season'
        }
        badge={laudatioActive ? `+${laudatioBonus}/yr` : undefined}
        disabled={dignitas < 12}
        onPress={commissionLaudatio}
      />

      <DirectiveButton
        label="Adrogatio — Adopt Talent"
        cost="15 Dignitas"
        desc="Adopt a high-skill commoner. Family trust suffers."
        disabled={dignitas < 15}
        onPress={performAdrogatio}
      />

      <DirectiveButton
        label="Arrange Marriage"
        cost="10 Dignitas"
        desc="Strengthen family bonds through a strategic match. Relationship +15."
        disabled={dignitas < 10}
        onPress={arrangeMarriageDomus}
      />
    </View>
  );
}

function DirectiveButton({
  label, cost, desc, disabled, onPress, badge,
}: {
  label: string;
  cost: string;
  desc: string;
  disabled: boolean;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.rightCluster}>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          <Text style={styles.cost}>{cost}</Text>
        </View>
      </View>
      <Text style={styles.desc}>{desc}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.panelSurface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    padding: SPACING.md,
  },
  heading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  btn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 44,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cost: {
    color: COLORS.dignitasColor,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: COLORS.laurel + '33',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  badgeText: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 9,
  },
  desc: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 3,
  },
});
