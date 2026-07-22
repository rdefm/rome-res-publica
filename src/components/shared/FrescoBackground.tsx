// ─── FrescoBackground ────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md (built here, consumed in C5).
// Renders cursusAssets.frescoBg as an absolute-fill background with a dark
// gradient scrim (strong at top per design delta 6, near-opaque toward the
// bottom for office-list legibility). No asset present → renders nothing,
// so the screen falls back to its current flat background, unchanged.

import React from 'react';
import { View, ImageBackground, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../utils/theme';
import { cursusAssets } from '../../utils/cursusAssets';

interface FrescoBackgroundProps {
  children?: React.ReactNode;
}

export default function FrescoBackground({ children }: FrescoBackgroundProps) {
  if (!cursusAssets.frescoBg) {
    return <View style={styles.fallback}>{children}</View>;
  }

  return (
    <ImageBackground source={cursusAssets.frescoBg} style={styles.fill} resizeMode="cover">
      <LinearGradient
        colors={[COLORS.scrimTop, COLORS.scrimBottom]}
        locations={[0, 0.75]}
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
});
