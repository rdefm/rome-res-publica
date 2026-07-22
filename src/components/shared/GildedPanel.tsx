// ─── GildedPanel ─────────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md — the riveted gold-framed panel
// used by the candidate header (C2) and campaign panel (C3). Pure Views —
// no image asset required. Reusable across tabs (shared/, not cursus/).

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';

interface GildedPanelProps {
  children: React.ReactNode;
  title?: string;
  style?: ViewStyle;
}

export default function GildedPanel({ children, title, style }: GildedPanelProps) {
  return (
    <View style={[styles.outer, style]}>
      <View style={styles.innerLine} />
      {title && <Text style={styles.title}>{title}</Text>}
      {children}

      {/* Rivets — pure Views, no image asset */}
      <View style={[styles.rivet, styles.rivetTL]} />
      <View style={[styles.rivet, styles.rivetTR]} />
      <View style={[styles.rivet, styles.rivetBL]} />
      <View style={[styles.rivet, styles.rivetBR]} />
    </View>
  );
}

const RIVET_SIZE = 10;
const RIVET_INSET = 6;

const styles = StyleSheet.create({
  outer: {
    // rgba, not the `opacity` style prop — opacity cascades to children
    // (text/rivets), which we don't want translucent, only the field itself
    // (so the fresco behind it, once C5 lands, ghosts through the panel).
    backgroundColor: 'rgba(42,10,10,0.92)', // COLORS.panelWood at ~0.92 alpha
    borderWidth: 2,
    borderColor: COLORS.gildFrame,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    position: 'relative',
  },
  innerLine: {
    ...StyleSheet.absoluteFillObject,
    margin: 3,
    borderWidth: 1,
    borderColor: COLORS.gildFrameDark,
    borderRadius: RADIUS.lg - 2,
  },
  title: {
    fontFamily: FONTS.display,
    color: COLORS.gold,
    fontSize: 15,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  rivet: {
    position: 'absolute',
    width: RIVET_SIZE,
    height: RIVET_SIZE,
    borderRadius: RIVET_SIZE / 2,
    backgroundColor: COLORS.rivet,
    borderWidth: 1,
    borderColor: COLORS.gildFrameDark,
  },
  rivetTL: { top: RIVET_INSET, left: RIVET_INSET },
  rivetTR: { top: RIVET_INSET, right: RIVET_INSET },
  rivetBL: { bottom: RIVET_INSET, left: RIVET_INSET },
  rivetBR: { bottom: RIVET_INSET, right: RIVET_INSET },
});
