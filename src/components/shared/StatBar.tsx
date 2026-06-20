import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showValue?: boolean;
}

export default function StatBar({
  label,
  value,
  max = 100,
  color = COLORS.laurel,
  showValue = true,
}: StatBarProps) {
  const pct = Math.min(1, Math.max(0, value / max));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showValue && <Text style={[styles.value, { color }]}>{value}</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  label: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 5,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
