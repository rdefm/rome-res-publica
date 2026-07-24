// ─── FrescoBackground ────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md (built here, consumed in C5).
// Renders cursusAssets.frescoBg as an absolute-fill background with a dark
// gradient scrim (strong at top per design delta 6, near-opaque toward the
// bottom for office-list legibility). No asset present → renders nothing,
// so the screen falls back to its current flat background, unchanged.
//
// Chunk A of cursustabuifixesplan.md — percentage-based imageStyle sizing on
// ImageBackground is unreliable inside a deeply-nested flex:1 chain (it can
// resolve against the image's own measured box rather than the true final
// layout height), which showed up as the fresco photo stopping short of the
// container's real bottom edge. Fixed by measuring the container with
// onLayout and rendering the <Image> at that explicit pixel size instead of
// '100%'. styles.fill also carries a COLORS.bg fallback so any residual gap
// (e.g. the single frame before the first onLayout fires) reads as "background"
// rather than an unstyled white bar.
//
// Once that sizing bug was fixed, the scrim's old locations=[0, 0.6] plateau
// at COLORS.scrimBottom's old 0.88 alpha turned out to be its own bug: it hit
// near-opaque black well before the bottom of the screen and held flat the
// rest of the way, blotting out the now-visible image under the office list.
// Retuned to locations=[0, 0.85] + a lower scrimBottom alpha (theme.ts) so
// the image stays visible under the darkening instead of disappearing under it.

import React, { useCallback, useState } from 'react';
import { View, Image, StyleSheet, ViewStyle, LayoutChangeEvent } from 'react-native';
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
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMeasured({ width, height });
  }, []);

  if (!cursusAssets.frescoBg) {
    return <View style={[styles.fallback, style]}>{children}</View>;
  }

  return (
    <View style={[styles.fill, style]} onLayout={onLayout}>
      {measured && (
        <Image
          source={cursusAssets.frescoBg}
          resizeMode="cover"
          style={[styles.image, { width: measured.width, height: measured.height }]}
        />
      )}
      <LinearGradient
        colors={[COLORS.scrimTop, COLORS.scrimBottom]}
        locations={[0, 0.85]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  fallback: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  // Explicit pixel width/height from onLayout, not percentage-based sizing —
  // see the Chunk A comment above for why percentages are unreliable here.
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
