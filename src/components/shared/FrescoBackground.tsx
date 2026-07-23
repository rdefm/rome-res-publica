// ─── FrescoBackground ────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md (built here, consumed in C5).
// Renders cursusAssets.frescoBg as an absolute-fill background with a dark
// gradient scrim (strong at top per design delta 6, near-opaque toward the
// bottom for office-list legibility). No asset present → renders nothing,
// so the screen falls back to its current flat background, unchanged.

import React from 'react';
import { View, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../utils/theme';
import { cursusAssets } from '../../utils/cursusAssets';

interface FrescoBackgroundProps {
  children?: React.ReactNode;
  /** Merged onto the root container (ImageBackground or its fallback View).
   *  Chunk C5 fix — this is how a screen gets the image to render edge-to-edge
   *  behind e.g. the resource bar while still pushing its own content down:
   *  pass `{ paddingTop: RESOURCE_BAR_HEIGHT }` here rather than wrapping this
   *  component in a padded parent. Padding on this root only shifts where
   *  `children` start laying out — it does NOT move the absolutely-filled
   *  image/scrim, which always renders edge-to-edge at this component's own
   *  outer box, matching DomusScreen's established ImageBackground pattern. */
  style?: ViewStyle;
}

export default function FrescoBackground({ children, style }: FrescoBackgroundProps) {
  if (!cursusAssets.frescoBg) {
    return <View style={[styles.fallback, style]}>{children}</View>;
  }

  return (
    <ImageBackground
      source={cursusAssets.frescoBg}
      style={[styles.fill, style]}
      imageStyle={styles.image}
      resizeMode="cover"
    >
      <LinearGradient
        colors={[COLORS.scrimTop, COLORS.scrimBottom]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  // imageStyle targets the underlying <Image> inside ImageBackground —
  // without forcing top/left/right/bottom: 0 + width/height 100%, it can
  // render anchored to the top-left corner at (near) native pixel size
  // instead of scaling/cropping to cover this box (same fix ParchmentCard.tsx
  // already needed for its own ImageBackground, same root cause here).
  image: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
});
