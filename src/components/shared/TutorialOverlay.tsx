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

  // A target inside a ScrollView is measured once on mount/layout — its
  // measureInWindow result reflects wherever it happened to sit at that
  // moment, below-the-fold included, and RN's onLayout does not refire from
  // scrolling alone (useTutorialTarget's own comment). If the cutout ends up
  // (partly or fully) outside the viewport, the four bands below still
  // render around it — and since the cutout itself is off-screen, the "top"
  // band alone stretches past the whole visible area, an opaque,
  // pointerEvents-'auto' scrim covering literally everything the player can
  // see or touch, including the ScrollView they'd need to scroll to reach
  // the real target. That was a genuine unrecoverable softlock (Act II's
  // "Court Flaccus" step, target forum.action.invite-dinner, whenever the
  // Invite to Dinner button happened to land below the fold). Bailing here
  // exactly like the `!rect` case above trades the spotlight cutout for
  // "never block the screen" — the step still advances on its predicate (or
  // stays tappable/scrollable) regardless of whether the ring is visible.
  const targetOffscreen =
    rect.y + rect.height <= 0 || rect.y >= screenH ||
    rect.x + rect.width <= 0 || rect.x >= screenW;
  if (targetOffscreen) return null;

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
