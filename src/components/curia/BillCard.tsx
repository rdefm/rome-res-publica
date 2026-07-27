// Curia Tab Redesign, Chunk C3 — tabula dealbata: whitewashed board in a
// dark frame. Moved/rebuilt out of CuriaScreen.tsx's old inline BillCard,
// same verdict/support logic, new visual pieces (WaxVerdictSeal, VoteBar,
// ActionCluster) replacing the old inline verdict text + BlocMeter + action
// row respectively.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { calcRomeStatVoteModifier } from '../../data/billTemplates';
import { useTutorialTarget } from '../shared/useTutorialTarget';
import WaxVerdictSeal from './WaxVerdictSeal';
import VoteBar from './VoteBar';
import ActionCluster from './ActionCluster';
import BillDetailModal from './BillDetailModal';
import type { Bill } from '../../models/bill';

export default function BillCard({ bill }: { bill: Bill }) {
  const rome = useGameStore(s => s.rome);
  const [detailVisible, setDetailVisible] = useState(false);

  const romeMod = calcRomeStatVoteModifier(bill, rome);
  const effectiveSupport = (bill.support ?? 0) + romeMod;

  // Tutorial redesign, T5 — 'start-2' (Bellum Punicum) is Act III's teaching
  // bill; see tutorialEngine.ts's ACT3_BILL_ID comment for why it, not
  // literal array position, is "first."
  const isTutorialBill = bill.id === 'start-2';
  const cardTarget = useTutorialTarget(isTutorialBill ? 'curia.bill-list.first' : undefined);

  return (
    <View ref={cardTarget.ref} onLayout={cardTarget.onLayout} style={styles.card}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => setDetailVisible(true)}>
        <View style={styles.topRow}>
          <View style={styles.nameWrap}>
            <Text style={styles.name}>{bill.name}</Text>
            {bill.type && <Text style={styles.type}>{bill.type.toUpperCase()}</Text>}
          </View>
          <WaxVerdictSeal effectiveSupport={effectiveSupport} />
        </View>

        <View style={styles.badges}>
          {bill.playerSubmitted && <View style={styles.badge}><Text style={styles.badgeText}>YOURS</Text></View>}
          {bill.playerVote && (
            <View style={[styles.badge, { borderColor: bill.playerVote === 'filibuster' ? COLORS.crimson : COLORS.gold }]}>
              <Text style={[styles.badgeText, { color: bill.playerVote === 'filibuster' ? COLORS.crimson : COLORS.gold }]}>
                {bill.playerVote.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.desc}>{bill.desc}</Text>
        {bill.ongoingEffect && <Text style={styles.ongoing}>Ongoing: {bill.ongoingEffect} per season</Text>}

        <View style={styles.row}>
          <Text style={styles.meta}>{bill.turnsLeft} seasons left</Text>
          {romeMod !== 0 && <Text style={styles.modNote}>Rome mod: {romeMod > 0 ? '+' : ''}{romeMod}</Text>}
        </View>
        <VoteBar effectiveSupport={effectiveSupport} />
      </TouchableOpacity>

      <BillDetailModal bill={bill} visible={detailVisible} onClose={() => setDetailVisible(false)} />

      <ActionCluster bill={bill} isTutorialBill={isTutorialBill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nameWrap: { flex: 1, marginRight: SPACING.sm },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 15, fontWeight: '600' },
  type: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 4, marginTop: 4 },
  badge: { borderWidth: 1, borderColor: COLORS.goldDim, borderRadius: 2, paddingHorizontal: 4 },
  badgeText: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 8, textTransform: 'uppercase' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 4 },
  ongoing: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 10, marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 },
  meta: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  modNote: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9 },
});
