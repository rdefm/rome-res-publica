// Curia Tab Redesign, Chunk C3, Delta 2/Delta 6 — the three embossed coins
// (VOTE/SPEECH/FILIBUSTER) and their expand-to-Tabella regions. Tapping a
// coin calls the existing expandBill(bill.id, verb); FILIBUSTER now expands
// to a confirm tablet instead of firing on a single tap (Delta 6) — the
// store's _expandedType union was widened to include 'filibuster' for
// exactly this (gameStore.ts).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, RADIUS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { useTutorialTarget } from '../shared/useTutorialTarget';
import Tabella from './Tabella';
import type { Bill } from '../../models/bill';

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

  return (
    <View>
      <View style={styles.coins}>
        <TouchableOpacity
          style={[styles.coin, isExpandedVote && styles.coinActive]}
          onPress={() => expandBill(bill.id, 'vote')}
        >
          <Text style={styles.coinLabel}>VOTE</Text>
          <Text style={styles.coinCost}>−{voteFidesCost} 🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.coin, isExpandedSpeech && styles.coinActive]}
          onPress={() => expandBill(bill.id, 'speech')}
        >
          <Text style={styles.coinLabel}>SPEECH</Text>
          <Text style={styles.coinCost}>−{speechFidesCost} 🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.coin, isExpandedFilibuster && styles.coinActive]}
          onPress={() => expandBill(bill.id, 'filibuster')}
        >
          <Text style={styles.coinLabel}>FILIBUSTER</Text>
          <Text style={styles.coinCost}>−{filibusterFidesCost} 🤝</Text>
        </TouchableOpacity>
      </View>

      {isExpandedVote && (
        <View style={styles.expanded}>
          <View ref={voteForTarget.ref} onLayout={voteForTarget.onLayout}>
            <Tabella
              label={`V·R  Vote For (+${bill.voteForSupport ?? 15} support)`}
              color={COLORS.laurel}
              onPress={() => voteBill(bill.id, 'vote_for')}
              disabled={fides < voteFidesCost}
            />
          </View>
          <Tabella
            label={`A  Vote Against (−${Math.abs(bill.voteAgainstSupport ?? 15)} support)`}
            color={COLORS.crimson}
            onPress={() => voteBill(bill.id, 'vote_against')}
            disabled={fides < voteFidesCost}
          />
        </View>
      )}

      {isExpandedSpeech && (
        <View style={styles.expanded}>
          <Tabella
            label="V·R  Speak in Favour"
            color={COLORS.laurel}
            onPress={() => speechBill(bill.id, 'for')}
            disabled={fides < speechFidesCost}
          />
          <Tabella
            label="A  Speak Against"
            color={COLORS.crimson}
            onPress={() => speechBill(bill.id, 'against')}
            disabled={fides < speechFidesCost}
          />
        </View>
      )}

      {isExpandedFilibuster && (
        <View style={styles.expanded}>
          <Tabella
            label={`CONFIRM · −${filibusterFidesCost} 🤝`}
            color={COLORS.crimson}
            onPress={() => filibusterBill(bill.id)}
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
  expanded: {
    marginTop: 8,
    gap: 6,
  },
});
