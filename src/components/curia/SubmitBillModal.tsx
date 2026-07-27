// Curia Tab Redesign, Chunk C3 — moved out of CuriaScreen.tsx's old inline
// SubmitBillModal, unchanged behaviour.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { ALL_BILL_TEMPLATES, calcRomeStatVoteModifier } from '../../data/billTemplates';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import type { Bill } from '../../models/bill';

export default function SubmitBillModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const bills = useGameStore(s => s.bills);
  const submitBill = useGameStore(s => s.submitBill);
  const fides = useGameStore(s => s.fides);
  // crisisLevel is kept in sync as a real field (see Chunk 2D note in plan)
  const crisisLevel = useGameStore(s => s.crisisLevel);
  const rome = useGameStore(s => s.rome);
  const existing = new Set(bills.map(b => b.name));

  const available = ALL_BILL_TEMPLATES.filter(t => {
    if (existing.has(t.name)) return false;
    if (!t.submissionCondition) return true;
    const cond = t.submissionCondition;
    if (cond.startsWith('crisisLevel >=')) {
      const threshold = parseInt(cond.split('>=')[1].trim(), 10);
      return crisisLevel >= threshold;
    }
    if (cond.startsWith('crisisLevel <=')) {
      const threshold = parseInt(cond.split('<=')[1].trim(), 10);
      return crisisLevel <= threshold;
    }
    return true;
  });

  return (
    <ScrollModal visible={visible} onClose={onClose} title="Submit a Bill" subtitle="Cost: 10 Fides">
      {available.map((t, i) => {
        const romeMod = calcRomeStatVoteModifier(t as Bill, rome);
        return (
          <TouchableOpacity
            key={i}
            style={[styles.item, fides < 10 && styles.itemDisabled]}
            disabled={fides < 10}
            onPress={() => { submitBill(t as any); onClose(); }}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{t.name}</Text>
              {t.type && <Text style={styles.itemType}>{t.type.toUpperCase()}</Text>}
            </View>
            <Text style={styles.itemDesc}>{t.desc}</Text>
            <View style={styles.itemMeta}>
              <Text style={styles.itemMetaText}>Support: {t.support > 0 ? `+${t.support}` : t.support} · {t.turnsLeft} seasons</Text>
              {romeMod !== 0 && <Text style={styles.itemMod}>Rome mod: {romeMod > 0 ? '+' : ''}{romeMod}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      {available.length === 0 && <Text style={styles.empty}>No bills available to submit.</Text>}
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: PARCHMENT.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  itemDisabled: { opacity: 0.4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  itemName: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  itemType: { color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1 },
  itemDesc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 3 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemMetaText: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  itemMod: { color: COLORS.senatBlue, fontFamily: FONTS.ui, fontSize: 11 },
  empty: { color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', textAlign: 'center', marginTop: SPACING.lg },
});
