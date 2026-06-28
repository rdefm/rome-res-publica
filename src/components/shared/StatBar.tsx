import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showValue?: boolean;
  thresholdMarks?: number[];  // values 0–100 where tick marks are rendered
  onPress?: () => void;       // optional — makes the bar tappable
}

export default function StatBar({
  label,
  value,
  max = 100,
  color = COLORS.laurel,
  showValue = true,
  thresholdMarks,
  onPress,
}: StatBarProps) {
  const pct = Math.min(1, Math.max(0, value / max));

  const inner = (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {showValue && <Text style={[styles.value, { color }]}>{value}</Text>}
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        {/* Threshold tick marks */}
        {thresholdMarks?.map(t => (
          <View
            key={t}
            style={[styles.tick, { left: `${t}%` }]}
          />
        ))}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
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
    overflow: 'visible',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  tick: {
    position: 'absolute',
    top: -2,
    width: 1,
    height: 9,
    backgroundColor: COLORS.gold,
    opacity: 0.7,
  },
});
