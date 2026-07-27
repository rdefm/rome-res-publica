// Curia Tab Redesign, Chunk C3 — moved out of CuriaScreen.tsx's old inline
// BillDetailModal, unchanged behaviour.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { calcRomeStatVoteModifier } from '../../data/billTemplates';
import { formatEffectString } from '../../utils/billEffectText';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import type { Bill } from '../../models/bill';

export default function BillDetailModal({ bill, visible, onClose }: { bill: Bill; visible: boolean; onClose: () => void }) {
  const rome = useGameStore(s => s.rome);
  const romeMod = calcRomeStatVoteModifier(bill, rome);
  const effectiveSupport = (bill.support ?? 0) + romeMod;

  const passEffects = formatEffectString(bill.passEffect);
  const failEffects = formatEffectString(bill.failEffect);
  const ongoingEffects = formatEffectString(bill.ongoingEffect);

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={bill.name}
      subtitle={bill.type ? bill.type.toUpperCase() : undefined}
    >
      <Text style={styles.desc}>{bill.desc}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{bill.turnsLeft} season{bill.turnsLeft !== 1 ? 's' : ''} left</Text>
        <Text style={styles.metaText}>
          Support: {effectiveSupport > 0 ? '+' : ''}{effectiveSupport}
          {romeMod !== 0 ? ` (Rome mod ${romeMod > 0 ? '+' : ''}${romeMod})` : ''}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: COLORS.laurel }]}>IF PASSED</Text>
        {passEffects.length > 0
          ? passEffects.map((line, i) => <Text key={i} style={styles.effectLine}>{line}</Text>)
          : <Text style={styles.effectLineMuted}>No direct effect.</Text>}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: COLORS.crimson }]}>IF IT FAILS</Text>
        {failEffects.length > 0
          ? failEffects.map((line, i) => <Text key={i} style={styles.effectLine}>{line}</Text>)
          : <Text style={styles.effectLineMuted}>No direct effect.</Text>}
      </View>

      {ongoingEffects.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: PARCHMENT.gold }]}>WHILE ACTIVE (PER SEASON)</Text>
          {ongoingEffects.map((line, i) => <Text key={i} style={styles.effectLine}>{line}</Text>)}
        </View>
      )}
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  desc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: PARCHMENT.border },
  metaText: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  section: { marginTop: SPACING.md },
  sectionLabel: { fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  effectLine: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 13, marginBottom: 2 },
  effectLineMuted: { color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12 },
});
