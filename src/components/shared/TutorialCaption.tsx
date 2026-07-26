// Philon's tutorial caption — a wax tablet card docked to whichever screen
// half the spotlighted target is NOT in (see TutorialOverlay's
// getCaptionDock). Wax styling mirrors AgendaTablet.tsx for a consistent
// "Philon's handwriting" feel across both surfaces.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.round(SCREEN_W * 0.9);

export type TutorialCaptionDock = 'top' | 'bottom';

interface TutorialCaptionProps {
  narration: string;
  actLabel?: string;
  dock: TutorialCaptionDock;
  onTapAdvance?: () => void; // present when the step's advance is `{ kind: 'tap' }`
  onSkipPress?: () => void;  // "Philon, I know this" — wired to skipTutorialArc in T2
}

export default function TutorialCaption({
  narration,
  actLabel,
  dock,
  onTapAdvance,
  onSkipPress,
}: TutorialCaptionProps) {
  const content = (
    <>
      {actLabel ? <Text style={styles.actLabel}>{actLabel}</Text> : null}
      <Text style={styles.narration}>{narration}</Text>
      <View style={styles.footerRow}>
        {onTapAdvance ? (
          <Text style={styles.tapHint}>Tap to continue</Text>
        ) : (
          <View />
        )}
        {onSkipPress ? (
          <TouchableOpacity
            onPress={onSkipPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.skipText}>Philon, I know this</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </>
  );

  return (
    <View
      style={[styles.positioner, dock === 'top' ? styles.dockTop : styles.dockBottom]}
      pointerEvents="box-none"
    >
      {onTapAdvance ? (
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onTapAdvance}>
          {content}
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>{content}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  dockTop: { top: SPACING.lg },
  dockBottom: { bottom: SPACING.lg },
  card: {
    width: CARD_W,
    backgroundColor: COLORS.waxSurface,
    borderWidth: 6,
    borderColor: COLORS.waxFrame,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  actLabel: {
    fontFamily: FONTS.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: COLORS.waxInscriptionDim,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  narration: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.waxInscription,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  tapHint: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.waxInscriptionDim,
    textTransform: 'uppercase',
  },
  skipText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    color: COLORS.dust,
    textDecorationLine: 'underline',
  },
});
