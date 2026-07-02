import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';

export default function DomesticDirectivesTray() {
  const {
    fides,
    commissionLaudatio, performAdrogatio, arrangeMarriageDomus,
  } = useGameStore();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>DOMESTIC DIRECTIVES</Text>

      <DirectiveButton
        label="Commission Laudatio"
        cost="10 Fides"
        desc="Honour your ancestors with a public eulogy. Lifetime Dignitas +10."
        disabled={fides < 10}
        onPress={commissionLaudatio}
      />

      <DirectiveButton
        label="Adrogatio — Adopt Talent"
        cost="50 Denarii"
        desc="Adopt a high-skill commoner. Family trust suffers."
        disabled={fides < 0} // cost is denarii — guard handled in store; never disabled by fides
        onPress={performAdrogatio}
      />

      <DirectiveButton
        label="Arrange Marriage"
        cost="15 Fides"
        desc="Strengthen family bonds through a strategic match. Relationship +15."
        disabled={fides < 15}
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
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={disabled && styles.disabled}
    >
      <ParchmentCard>
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
      </ParchmentCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
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
  disabled: {
    opacity: 0.4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: PARCHMENT_TEXT.heading,
    fontFamily: FONTS.display,
    fontSize: 14,
    flex: 1,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cost: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.fidesColor,
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
    color: PARCHMENT_TEXT.body,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 3,
  },
});
