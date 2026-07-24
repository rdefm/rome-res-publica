// ─── StatusSeal ──────────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md — office-card status chip/seal.
// 'served' offices remain re-runnable (design delta 1 — "SERVED ✓", not
// "COMPLETED"); 'locked' always carries a reason (design delta 2).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import { cursusAssets } from '../../utils/cursusAssets';

export type StatusSealStatus = 'served' | 'active' | 'held' | 'eligible' | 'locked';

interface StatusSealProps {
  status: StatusSealStatus;
  /** Locked-only — human-phrased failing gate, e.g. "Min age 36". */
  reason?: string;
}

const SEAL_IMAGE_SIZE = 44;

export default function StatusSeal({ status, reason }: StatusSealProps) {
  if (status === 'served') {
    return (
      <View style={styles.row}>
        {cursusAssets.waxSeal ? (
          <Image source={cursusAssets.waxSeal} style={styles.sealImage} resizeMode="contain" />
        ) : (
          <View style={styles.sealFallbackOuter}>
            <View style={styles.sealFallbackInner}>
              <Text style={styles.sealCheck}>✓</Text>
            </View>
          </View>
        )}
        <Text style={styles.servedText}>SERVED ✓</Text>
      </View>
    );
  }

  if (status === 'active') {
    return (
      <View style={[styles.chip, styles.chipActive]}>
        <Text style={[styles.chipText, styles.chipTextActive]}>CAMPAIGN ACTIVE</Text>
      </View>
    );
  }

  if (status === 'held') {
    return (
      <View style={[styles.chip, styles.chipActive]}>
        <Text style={[styles.chipText, styles.chipTextActive]}>IN OFFICE</Text>
      </View>
    );
  }

  if (status === 'locked') {
    return (
      <View style={[styles.chip, styles.chipLocked]}>
        <Text style={[styles.chipText, styles.chipTextLocked]}>
          LOCKED{reason ? ` · ${reason}` : ''}
        </Text>
      </View>
    );
  }

  // 'eligible' — absence of a chip is the signal (the CAMPAIGN button, owned
  // by C4, renders alongside instead).
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sealImage: {
    width: SEAL_IMAGE_SIZE,
    height: SEAL_IMAGE_SIZE,
  },
  sealFallbackOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: COLORS.sealWaxGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealFallbackInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.sealWaxGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealCheck: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.panelWood,
  },
  servedText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    color: COLORS.sealWaxGrey,
  },
  chip: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  chipActive: {
    borderColor: COLORS.gold,
    backgroundColor: 'transparent',
  },
  chipTextActive: {
    color: COLORS.gold,
  },
  chipLocked: {
    borderColor: COLORS.lockedText,
    backgroundColor: 'transparent',
  },
  chipTextLocked: {
    color: COLORS.lockedText,
  },
});
