// A brief, non-blocking one-line toast shown when the player taps a sealed
// tab during the guided prologue. Module-level ping/subscribe rather than a
// gameStore field or prop — this is a fire-and-forget UI event with no
// state worth persisting, the same reasoning engine/tutorialTargets.ts uses
// for keeping measured rects out of the store.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, TAB_BAR_HEIGHT } from '../../utils/theme';

const TOAST_DURATION_MS = 2200;

type Listener = () => void;
const listeners = new Set<Listener>();

export function pingSealedTabDeflection(): void {
  listeners.forEach(cb => cb());
}

export default function TutorialDeflectionToast() {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onPing = () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setVisible(true);
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      dismissTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          setVisible(false);
        });
      }, TOAST_DURATION_MS);
    };

    listeners.add(onPing);
    return () => {
      listeners.delete(onPing);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <Text style={styles.text}>Not yet, Domine — one thing at a time.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + SPACING.lg,
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 1000,
    alignItems: 'center',
    backgroundColor: COLORS.waxSurface,
    borderWidth: 1,
    borderColor: COLORS.waxFrame,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  text: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.waxInscription,
    textAlign: 'center',
  },
});
