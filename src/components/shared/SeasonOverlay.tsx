import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import LedgerBlock from './LedgerBlock';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

const { width, height } = Dimensions.get('window');

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

export default function SeasonOverlay() {
  const { seasonOverlayVisible, seasonOverlayEvents, seasonIndex, year, dismissSeasonOverlay, lastSeasonLedger } =
    useGameStore();

  const opacity = useRef(new Animated.Value(0)).current;
  const [visibleEvents, setVisibleEvents] = useState<string[]>([]);

  useEffect(() => {
    if (seasonOverlayVisible) {
      setVisibleEvents([]);
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start(() => {
        // Stagger events in
        seasonOverlayEvents.forEach((_, i) => {
          setTimeout(() => {
            setVisibleEvents((prev) => [...prev, seasonOverlayEvents[i]]);
          }, i * 400 + 200);
        });
      });
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [seasonOverlayVisible]);

  if (!seasonOverlayVisible) return null;

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <View style={styles.content}>
        <Text style={styles.season}>{SEASON_NAMES[seasonIndex]}</Text>
        <Text style={styles.year}>{Math.abs(year)} BC</Text>
        <View style={styles.divider} />

        {/* ── P1-D: compact season ledger ──────────────────────────────── */}
        {lastSeasonLedger && (
          <>
            <LedgerBlock ledger={lastSeasonLedger} />
            <View style={styles.divider} />
          </>
        )}

        {visibleEvents.map((evt, i) => (
          <Text key={i} style={styles.event}>{evt}</Text>
        ))}
        <TouchableOpacity style={styles.continueBtn} onPress={dismissSeasonOverlay}>
          <Text style={styles.continueTxt}>Continue</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0,
    width, height,
    backgroundColor: 'rgba(10,8,6,0.93)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '80%',
    alignItems: 'center',
  },
  season: {
    fontFamily: FONTS.display,
    fontSize: 36,
    color: COLORS.gold,
    fontWeight: '700',
    letterSpacing: 2,
  },
  year: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.dust,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    width: '100%',
    marginVertical: SPACING.md,
  },
  event: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.marble,
    textAlign: 'center',
    marginBottom: SPACING.sm,
    lineHeight: 20,
  },
  continueBtn: {
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 4,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  continueTxt: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 16,
    letterSpacing: 1,
  },
});
