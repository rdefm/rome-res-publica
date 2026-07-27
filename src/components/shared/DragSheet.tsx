// ─── DragSheet ───────────────────────────────────────────────────────────────
// Curia Tab Redesign plan, Chunk C0 — lifts the Animated + PanResponder
// bottom-sheet shell that CursusScreen.tsx (the Basilica) and
// ProvinciaeScreen.tsx (CitySheet/RegionSheet/LatiumSheet) each implemented
// identically (Finding 5): same spring constants (tension 65 / friction 11),
// same close duration (240ms), same dismiss thresholds (dy > 100 || vy > 0.5),
// same scrim opacity interpolation (0.5 → 0), same useNativeDriver: false
// throughout (interpolating a `top` layout property, which the native driver
// cannot animate).
//
// Contract note (not obvious from the props alone): `visible` and the
// sheet's CONTENT must be two separate pieces of parent state, not one
// (the original call sites conflated them — `basilicaVisible` was simply
// `basilicaTrialId !== null`). If a caller nulls its content id the instant
// it flips `visible` to false, the children unmount before the close
// animation ever plays. Instead: flip `visible` false to START the close
// animation, keep the content id defined throughout, and only clear the
// content id inside `onClose` — which this component calls once, exactly
// when the close animation (however it was triggered: the `visible` prop
// going false, OR an internal drag-dismiss) finishes. This matches the
// original code's `Animated.timing(...).start(callback)` ordering exactly,
// which callers (CursusScreen's `basilicaReturnTab` navigation, in
// particular) depend on.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, StyleSheet } from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface DragSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fraction of window height. Both existing call sites used 0.72. */
  heightRatio?: number;
  children: React.ReactNode;
}

export default function DragSheet({ visible, onClose, heightRatio = 0.72, children }: DragSheetProps) {
  const sheetHeight = SCREEN_HEIGHT * heightRatio;
  const anim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  // Keeps rendering (mid-animation, off-screen) for the duration of the
  // close animation even after `visible` has already gone false — otherwise
  // the sheet would vanish instantly instead of sliding down.
  const [shouldRender, setShouldRender] = useState(visible);

  function animateClosed() {
    Animated.timing(anim, {
      toValue: SCREEN_HEIGHT,
      duration: 240,
      useNativeDriver: false,
    }).start(() => {
      setShouldRender(false);
      onClose();
    });
  }

  function animateOpen() {
    Animated.spring(anim, {
      toValue: SCREEN_HEIGHT - sheetHeight,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  }

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      animateOpen();
    } else if (shouldRender) {
      animateClosed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, gs) => gs.dy > 0,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 8,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) {
          anim.setValue(SCREEN_HEIGHT - sheetHeight + gs.dy);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          animateClosed();
        } else {
          animateOpen();
        }
      },
    })
  ).current;

  if (!shouldRender) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.scrim,
          {
            opacity: anim.interpolate({
              inputRange: [SCREEN_HEIGHT - sheetHeight, SCREEN_HEIGHT],
              outputRange: [0.5, 0],
              extrapolate: 'clamp',
            }),
          },
        ]}
        pointerEvents="none"
      />
      <Animated.View
        style={[styles.sheetContainer, { top: anim, height: sheetHeight }]}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  sheetContainer: { position: 'absolute', left: 0, right: 0 },
});
