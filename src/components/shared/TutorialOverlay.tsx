// Spotlight overlay — a scrim with a rectangular cut-out around a measured
// tutorial target. No masking library (tutorial-redesign-plan.md finding
// 31): the cut-out is four plain absolutely-positioned bands, one per side
// of the target rect, so the rect itself has no view drawn over it.
//
// `rail: 'hard'` swallows taps outside the cut-out (pointerEvents 'auto' on
// the bands). `rail: 'guided'` renders the same visuals but lets taps pass
// through everywhere (pointerEvents 'none') — the player can still act
// normally; the spotlight is a hint, not a lock.
//
// Renders nothing when no target rect is available yet — never block the
// screen with no cut-out to show.

import React, { useEffect, useSyncExternalStore } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { getTarget, subscribeTargets, TargetRect } from '../../engine/tutorialTargets';
import type { TutorialTargetId, TutorialRail } from '../../models/tutorial';
import { COLORS, RADIUS } from '../../utils/theme';

interface TutorialOverlayProps {
  targetId?: TutorialTargetId; // omit for a full-screen narration beat (no cut-out)
  rail: TutorialRail;
}

const CUTOUT_PADDING = 6;

// Which half of the screen the target is NOT in — for docking the caption
// card in TutorialCaption on the opposite half from the spotlighted control.
export function getCaptionDock(rect: TargetRect | null): 'top' | 'bottom' {
  if (!rect) return 'bottom';
  const { height: screenH } = Dimensions.get('window');
  const targetCenterY = rect.y + rect.height / 2;
  return targetCenterY < screenH / 2 ? 'bottom' : 'top';
}

export default function TutorialOverlay({ targetId, rail }: TutorialOverlayProps) {
  const rect = useSyncExternalStore(
    subscribeTargets,
    () => (targetId ? getTarget(targetId) : null),
  );

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + pulse.value * 0.6,
    transform: [{ scale: 1 + pulse.value * 0.03 }],
  }));

  if (!rect) return null;

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const cutout = {
    x: Math.max(0, rect.x - CUTOUT_PADDING),
    y: Math.max(0, rect.y - CUTOUT_PADDING),
    width: rect.width + CUTOUT_PADDING * 2,
    height: rect.height + CUTOUT_PADDING * 2,
  };

  const bandPointerEvents: 'auto' | 'none' = rail === 'hard' ? 'auto' : 'none';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Top band */}
      <View
        pointerEvents={bandPointerEvents}
        style={[
          styles.band,
          { top: 0, left: 0, right: 0, height: cutout.y, backgroundColor: COLORS.scrimBottom },
        ]}
      />
      {/* Bottom band */}
      <View
        pointerEvents={bandPointerEvents}
        style={[
          styles.band,
          { top: cutout.y + cutout.height, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.scrimBottom },
        ]}
      />
      {/* Left band */}
      <View
        pointerEvents={bandPointerEvents}
        style={[
          styles.band,
          { top: cutout.y, left: 0, width: cutout.x, height: cutout.height, backgroundColor: COLORS.scrimBottom },
        ]}
      />
      {/* Right band */}
      <View
        pointerEvents={bandPointerEvents}
        style={[
          styles.band,
          {
            top: cutout.y,
            left: cutout.x + cutout.width,
            right: 0,
            height: cutout.height,
            backgroundColor: COLORS.scrimBottom,
          },
        ]}
      />
      {/* Pulsing ring around the cut-out */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          ringStyle,
          { top: cutout.y - 2, left: cutout.x - 2, width: cutout.width + 4, height: cutout.height + 4 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.gildFrame,
    borderRadius: RADIUS.md,
  },
});
