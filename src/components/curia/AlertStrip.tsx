// Curia Tab Redesign, Chunk C4, Delta 12 — one 28pt line in the pinned
// region, surfacing a critical NEGOTIA item while the player is elsewhere.
// A deliberate duplicate entry point (normally a smell) — justified because
// the cost of a missed trial is a character's exile. Visibility (negotiaCritical
// && not already on NEGOTIA) is CuriaScreen's call; this component always
// renders its content once mounted.
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

export default function AlertStrip({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.strip} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.text}>⚠ Urgent business awaits in NEGOTIA — tap to view</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  strip: {
    height: 28,
    backgroundColor: COLORS.crimsonDark,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  text: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
