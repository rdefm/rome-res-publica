// AgendaBadge — persistent wax-tablet icon docked inside EndSeasonButton.
// Shows a count chip when critical or warning agenda items are live.
// Tapping opens the AgendaTablet modal.

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { generateAgenda } from '../../engine/agendaEngine';
import { COLORS, FONTS } from '../../utils/theme';

export default function AgendaBadge() {
  const showAgenda    = useGameStore(s => s.showAgenda);
  const agendaVisible = useGameStore(s => s.agendaVisible);

  // Compute badge count reactively. Selector returns a number (primitive) so
  // Zustand's default Object.is comparison correctly suppresses unnecessary renders.
  const badgeCount = useGameStore(s => {
    const items = generateAgenda(s);
    return items.filter(i => i.severity === 'critical' || i.severity === 'warning').length;
  });

  const hasCritical = useGameStore(s =>
    generateAgenda(s).some(i => i.severity === 'critical')
  );

  // Don't render when there's nothing to surface, or tablet is already open
  if (badgeCount === 0 || agendaVisible) return null;

  return (
    <TouchableOpacity
      style={styles.badge}
      onPress={showAgenda}
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {/* Wax-tablet glyph */}
      <Text style={styles.icon}>⊞</Text>

      {/* Count chip */}
      <View style={[styles.chip, hasCritical ? styles.chipCritical : styles.chipWarning]}>
        <Text style={styles.chipText}>{badgeCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -44,
    top: '25%',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
  },
  icon: {
    fontSize: 22,
    color: COLORS.goldDim,
    lineHeight: 26,
  },
  chip: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chipCritical: {
    backgroundColor: COLORS.crimson,
  },
  chipWarning: {
    backgroundColor: COLORS.amber,
  },
  chipText: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 14,
  },
});
