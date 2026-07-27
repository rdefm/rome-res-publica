// Curia Tab Redesign, Chunk C3 — one tablet button inside a bill's expanded
// action region (vote/speech/filibuster). ≥44pt tall (plan §"ActionCluster
// + Tabella"). Generic — reused for all five tablet variants (vote for/
// against, speech for/against, filibuster confirm).
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FONTS, RADIUS, SPACING } from '../../utils/theme';

interface TabellaProps {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function Tabella({ label, color, onPress, disabled }: TabellaProps) {
  return (
    <TouchableOpacity
      style={[styles.tablet, { borderColor: color }, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tablet: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
