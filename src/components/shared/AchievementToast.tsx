// AchievementToast — Phase 5, Chunk P5-F. A small, non-blocking laurel
// banner. Never interrupts an event/sequence modal: it self-gates on the
// same "is anything blocking active" signals App.tsx's AgendaTablet
// auto-open effect already checks, plus runFinished (EpilogueScreen takes
// over the whole screen once a run ends and never closes — a Laurel earned
// in a run's final season is still recorded and visible, gold-highlighted,
// in the Hall of Ancestors' Laurels section; it just won't get a toast that
// one time).
//
// Laurels speak in the system's own voice, one register above Philon's
// ledger narration — no Philon copy here (F3's own instruction).

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { ACHIEVEMENT_DEFINITIONS } from '../../data/achievementDefinitions';
import type { AchievementDef } from '../../models/achievement';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const TOAST_DURATION_MS = 3000;

export default function AchievementToast() {
  const lastSeasonLedger = useGameStore(s => s.lastSeasonLedger);
  const activeEvent = useGameStore(s => s.activeEvent);
  const seasonOverlayVisible = useGameStore(s => s.seasonOverlayVisible);
  const pendingBirthNaming = useGameStore(s => s.pendingBirthNaming);
  const pendingAmbitionScopes = useGameStore(s => s.pendingAmbitionScopes);
  const trials = useGameStore(s => s.trials);
  const runFinished = useGameStore(s => s.runFinished);

  const [queue, setQueue] = useState<AchievementDef[]>([]);
  const [current, setCurrent] = useState<AchievementDef | null>(null);
  const lastProcessedTurn = useRef<number | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const blocked =
    !!activeEvent ||
    seasonOverlayVisible ||
    !!pendingBirthNaming ||
    (pendingAmbitionScopes ?? []).length > 0 ||
    trials.some(t => t.status === 'in_session') ||
    runFinished;

  // Enqueue newly-earned laurels from the most recent ledger.
  useEffect(() => {
    if (!lastSeasonLedger || lastSeasonLedger.earnedLaurels.length === 0) return;
    if (lastProcessedTurn.current === lastSeasonLedger.turnNumber) return;
    lastProcessedTurn.current = lastSeasonLedger.turnNumber;

    const defs = lastSeasonLedger.earnedLaurels
      .map(id => ACHIEVEMENT_DEFINITIONS.find(d => d.id === id))
      .filter((d): d is AchievementDef => !!d);
    if (defs.length > 0) setQueue(q => [...q, ...defs]);
  }, [lastSeasonLedger]);

  // Advance the queue whenever nothing is showing and nothing blocks.
  useEffect(() => {
    if (current || blocked || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [current, blocked, queue]);

  // Fade in/out and auto-dismiss the current toast.
  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const dismiss = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setCurrent(null);
      });
    }, TOAST_DURATION_MS);
    return () => clearTimeout(dismiss);
  }, [current]);

  if (!current || blocked) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents="none">
      <Text style={styles.icon}>{current.icon}</Text>
      <View style={styles.textBlock}>
        <Text style={styles.label}>LAUREL EARNED</Text>
        <Text style={styles.name}>{current.name}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xl,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  icon: {
    fontSize: 22,
    marginRight: SPACING.sm,
  },
  textBlock: {
    flex: 1,
  },
  label: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    color: COLORS.goldDim,
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
});
