// Curia Tab Redesign, Chunk C3, Delta 4 — two-sided support meter with a
// centre tick at zero. No third "undecided" segment and no "Non Liquet"
// (Finding 6 — that's a juror's formula from criminal trials, not a
// legislative abstention). Static here; C6 is the animation pass — the
// value flows straight from a prop into a width percentage, so C6 can wrap
// this in an Animated.Value later without restructuring.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

interface VoteBarProps {
  /** -100..+100. Positive = passes at season end. */
  effectiveSupport: number;
}

export default function VoteBar({ effectiveSupport }: VoteBarProps) {
  const clamped = Math.max(-100, Math.min(100, effectiveSupport));
  const leftPct = clamped < 0 ? Math.min(100, -clamped) : 0;
  const rightPct = clamped > 0 ? Math.min(100, clamped) : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.half, styles.halfLeft]}>
          <View style={[styles.fillLeft, { width: `${leftPct}%` }]} />
        </View>
        <View style={styles.centreTick} />
        <View style={[styles.half, styles.halfRight]}>
          <View style={[styles.fillRight, { width: `${rightPct}%` }]} />
        </View>
      </View>
      <View style={styles.labelsRow}>
        <Text style={[styles.label, styles.labelLeft]}>A · ANTIQUO</Text>
        <Text style={[styles.label, styles.labelRight]}>VTI ROGAS · V·R</Text>
      </View>
    </View>
  );
}

const BAR_HEIGHT = 8;

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  track: {
    flexDirection: 'row',
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  half: {
    flex: 1,
    flexDirection: 'row',
  },
  // Both halves' fills are anchored at the centre tick and grow outward.
  halfLeft: {
    justifyContent: 'flex-end',
  },
  halfRight: {
    justifyContent: 'flex-start',
  },
  fillLeft: {
    height: '100%',
    backgroundColor: COLORS.crimson,
  },
  fillRight: {
    height: '100%',
    backgroundColor: COLORS.laurel,
  },
  centreTick: {
    width: 1,
    backgroundColor: COLORS.dust,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  label: {
    fontFamily: FONTS.ui,
    fontSize: 8,
    letterSpacing: 0.5,
  },
  labelLeft: {
    color: COLORS.crimson,
  },
  labelRight: {
    color: COLORS.laurel,
  },
});
