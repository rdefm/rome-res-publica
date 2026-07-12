import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import LedgerBlock from './LedgerBlock';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

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
      {/* Fixed header — never scrolls. */}
      <View style={styles.header}>
        <Text style={styles.season}>{SEASON_NAMES[seasonIndex]}</Text>
        <Text style={styles.year}>{Math.abs(year)} BC</Text>
        <View style={styles.divider} />
      </View>

      {/* Scrollable middle — a long list of notifications scrolls here
          instead of pushing the Continue button off-screen (the bug this
          layout fixes: previously everything, footer included, was one
          plain centered View with no way to scroll). contentContainerStyle's
          flexGrow+justifyContent keeps a short list looking centered, same
          as before, while a long one just scrolls. */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
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
      </ScrollView>

      {/* Fixed footer — always reachable, regardless of how long the
          scrollable content above is. */}
      <View style={styles.footer}>
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
    // Anchored to all four edges rather than a literal Dimensions-derived
    // pixel width/height — this component is mounted per-screen (Curia,
    // Forum, Cursus, Provinciae), inside each screen's own container BELOW
    // the app-root ResourceBar, not at the App.tsx root. A hardcoded
    // full-window height here overshoots that actual container by exactly
    // the ResourceBar's height, pushing the footer (and the Continue
    // button) that far below the visible area — invisible when the content
    // is short enough to sit well above the overshoot, but exactly the
    // "Continue button is off-screen" bug once a long notification list
    // pushes content down into it. Edge-anchoring instead always matches
    // whatever box this is actually rendered inside.
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,8,6,0.93)',
    zIndex: 999,
    alignItems: 'center',
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  header: {
    width: '80%',
    alignItems: 'center',
  },
  scrollArea: {
    width: '80%',
    flex: 1,
    // minHeight: 0 overrides the web flexbox default (min-height: auto),
    // which otherwise lets this flex:1 child grow to fit ALL its content
    // (every notification line) instead of clipping to the space actually
    // available — pushing the footer/Continue button below the viewport on
    // a long list. Native Yoga doesn't have this quirk, but this fixes web
    // too and is a no-op there either way.
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
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
