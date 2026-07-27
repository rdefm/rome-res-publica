// Curia Tab Redesign, Chunk C3, Delta 2/Delta 6 — the three embossed coins
// (VOTE/SPEECH/FILIBUSTER) and their expand-to-Tabella regions. Tapping a
// coin calls the existing expandBill(bill.id, verb); FILIBUSTER now expands
// to a confirm tablet instead of firing on a single tap (Delta 6) — the
// store's _expandedType union was widened to include 'filibuster' for
// exactly this (gameStore.ts).
//
// Chunk C6 — floating cost text (local RN Animated, no store field, no new
// engine) on a committed tablet tap, plus haptics: light impact on a coin
// tap, medium on a committed tablet. Haptics guarded for web, where
// expo-haptics has no native implementation.
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { useTutorialTarget } from '../shared/useTutorialTarget';
import Tabella from './Tabella';
import type { Bill } from '../../models/bill';

function hapticImpact(style: Haptics.ImpactFeedbackStyle) {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(style);
}

interface ActionClusterProps {
  bill: Bill;
  /** Tutorial redesign, T5 — 'start-2' (Bellum Punicum), Act III's teaching
   *  bill. Only its Vote For tabella is ever a spotlight target. */
  isTutorialBill: boolean;
}

export default function ActionCluster({ bill, isTutorialBill }: ActionClusterProps) {
  const fides = useGameStore(s => s.fides);
  const expandBill = useGameStore(s => s.expandBill);
  const expandedBill = useGameStore(s => s._expandedBill);
  const expandedType = useGameStore(s => s._expandedType);
  const voteBill = useGameStore(s => s.voteBill);
  const speechBill = useGameStore(s => s.speechBill);
  const filibusterBill = useGameStore(s => s.filibusterBill);

  const voteForTarget = useTutorialTarget(isTutorialBill ? 'curia.action.vote-for' : undefined);

  const isExpandedVote = expandedBill === bill.id && expandedType === 'vote';
  const isExpandedSpeech = expandedBill === bill.id && expandedType === 'speech';
  const isExpandedFilibuster = expandedBill === bill.id && expandedType === 'filibuster';

  const voteFidesCost = bill.voteGravitasCost ?? 4;
  const speechFidesCost = bill.speechGravitasCost ?? 6;
  const filibusterFidesCost = 8;

  // Floating "−N Fides" label — drifts up and fades on a committed tablet tap.
  const [floatingCost, setFloatingCost] = useState<string | null>(null);
  const floatAnim = useRef(new Animated.Value(0)).current;

  function showFloatingCost(cost: number) {
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    setFloatingCost(`−${cost} Fides`);
    floatAnim.setValue(0);
    Animated.timing(floatAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(() => setFloatingCost(null));
  }

  function onCoinPress(verb: 'vote' | 'speech' | 'filibuster') {
    hapticImpact(Haptics.ImpactFeedbackStyle.Light);
    expandBill(bill.id, verb);
  }

  return (
    <View>
      <View style={styles.coins}>
        <TouchableOpacity
          style={[styles.coin, isExpandedVote && styles.coinActive]}
          onPress={() => onCoinPress('vote')}
        >
          <Text style={styles.coinLabel}>VOTE</Text>
          <Text style={styles.coinCost}>−{voteFidesCost} 🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.coin, isExpandedSpeech && styles.coinActive]}
          onPress={() => onCoinPress('speech')}
        >
          <Text style={styles.coinLabel}>SPEECH</Text>
          <Text style={styles.coinCost}>−{speechFidesCost} 🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.coin, isExpandedFilibuster && styles.coinActive]}
          onPress={() => onCoinPress('filibuster')}
        >
          <Text style={styles.coinLabel}>FILIBUSTER</Text>
          <Text style={styles.coinCost}>−{filibusterFidesCost} 🤝</Text>
        </TouchableOpacity>

        {floatingCost && (
          <Animated.Text
            style={[
              styles.floatingCost,
              {
                opacity: floatAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
                transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -28] }) }],
              },
            ]}
          >
            {floatingCost}
          </Animated.Text>
        )}
      </View>

      {isExpandedVote && (
        <View style={styles.expanded}>
          <View ref={voteForTarget.ref} onLayout={voteForTarget.onLayout}>
            <Tabella
              label={`V·R  Vote For (+${bill.voteForSupport ?? 15} support)`}
              color={COLORS.laurel}
              onPress={() => { showFloatingCost(voteFidesCost); voteBill(bill.id, 'vote_for'); }}
              disabled={fides < voteFidesCost}
            />
          </View>
          <Tabella
            label={`A  Vote Against (−${Math.abs(bill.voteAgainstSupport ?? 15)} support)`}
            color={COLORS.crimson}
            onPress={() => { showFloatingCost(voteFidesCost); voteBill(bill.id, 'vote_against'); }}
            disabled={fides < voteFidesCost}
          />
        </View>
      )}

      {isExpandedSpeech && (
        <View style={styles.expanded}>
          <Tabella
            label="V·R  Speak in Favour"
            color={COLORS.laurel}
            onPress={() => { showFloatingCost(speechFidesCost); speechBill(bill.id, 'for'); }}
            disabled={fides < speechFidesCost}
          />
          <Tabella
            label="A  Speak Against"
            color={COLORS.crimson}
            onPress={() => { showFloatingCost(speechFidesCost); speechBill(bill.id, 'against'); }}
            disabled={fides < speechFidesCost}
          />
        </View>
      )}

      {isExpandedFilibuster && (
        <View style={styles.expanded}>
          <Tabella
            label={`CONFIRM · −${filibusterFidesCost} 🤝`}
            color={COLORS.crimson}
            onPress={() => { showFloatingCost(filibusterFidesCost); filibusterBill(bill.id); }}
            disabled={fides < filibusterFidesCost}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  coins: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  coin: {
    flex: 1,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  coinActive: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.goldDim + '22',
  },
  coinLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  coinCost: {
    color: COLORS.fidesColor,
    fontFamily: FONTS.ui,
    fontSize: 9,
    marginTop: 1,
  },
  floatingCost: {
    position: 'absolute',
    top: -4,
    pointerEvents: 'none',
    alignSelf: 'center',
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  expanded: {
    marginTop: 8,
    gap: 6,
  },
});
