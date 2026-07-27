// Curia Tab Redesign, Chunk C3, Delta 4 — two-sided support meter with a
// centre tick at zero. No third "undecided" segment and no "Non Liquet"
// (Finding 6 — that's a juror's formula from criminal trials, not a
// legislative abstention).
//
// Chunk C6 — fill widths animate on support change (300ms ease) instead of
// jumping, via react-native-reanimated (~3.10.1, already a dependency —
// Finding 12). Skipped while the SeasonOverlay is up: applyNpcBillReactions
// also moves support at season end, so an unconditional animation would
// fire during that transition and visibly fight it.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import InfoTap from '../shared/InfoTap';

interface VoteBarProps {
  /** -100..+100. Positive = passes at season end. */
  effectiveSupport: number;
}

export default function VoteBar({ effectiveSupport }: VoteBarProps) {
  const clamped = Math.max(-100, Math.min(100, effectiveSupport));
  const leftPct = clamped < 0 ? Math.min(100, -clamped) : 0;
  const rightPct = clamped > 0 ? Math.min(100, clamped) : 0;
  const seasonOverlayVisible = useGameStore(s => s.seasonOverlayVisible);

  const leftWidth = useSharedValue(leftPct);
  const rightWidth = useSharedValue(rightPct);

  useEffect(() => {
    if (seasonOverlayVisible) {
      // Season-end resolution already changed support; don't animate a
      // value change that's fighting the SeasonOverlay's own transition.
      leftWidth.value = leftPct;
      rightWidth.value = rightPct;
    } else {
      leftWidth.value = withTiming(leftPct, { duration: 300 });
      rightWidth.value = withTiming(rightPct, { duration: 300 });
    }
  }, [leftPct, rightPct, seasonOverlayVisible]);

  const leftFillStyle = useAnimatedStyle(() => ({ width: `${leftWidth.value}%` }));
  const rightFillStyle = useAnimatedStyle(() => ({ width: `${rightWidth.value}%` }));

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.half, styles.halfLeft]}>
          <Animated.View style={[styles.fillLeft, leftFillStyle]} />
        </View>
        <View style={styles.centreTick} />
        <View style={[styles.half, styles.halfRight]}>
          <Animated.View style={[styles.fillRight, rightFillStyle]} />
        </View>
      </View>
      <View style={styles.labelsRow}>
        <InfoTap termId="antiquo">
          <Text style={[styles.label, styles.labelLeft]}>A · ANTIQUO</Text>
        </InfoTap>
        <InfoTap termId="uti-rogas">
          <Text style={[styles.label, styles.labelRight]}>VTI ROGAS · V·R</Text>
        </InfoTap>
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
