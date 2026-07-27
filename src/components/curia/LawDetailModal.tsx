// Curia Tab Redesign, Chunk C3 — moved out of CuriaScreen.tsx's old inline
// ActiveLawDetailModal, unchanged behaviour.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { ALL_BILL_TEMPLATES } from '../../data/billTemplates';
import { formatEffectString } from '../../utils/billEffectText';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import type { ActiveLaw } from '../../models/bill';

export default function LawDetailModal({ law, visible, onClose }: { law: ActiveLaw; visible: boolean; onClose: () => void }) {
  const turnNumber = useGameStore(s => s.turnNumber);
  // law.billId is the bill's runtime instance id (re-assigned on every injection/
  // submission via nextBillId()/Date.now()), not the template's static id — so the
  // only reliable way back to the template is by name, which stays stable per bill type.
  const template = ALL_BILL_TEMPLATES.find(t => t.name === law.name);
  const seasonsLeft = law.expiresOnTurn !== undefined ? law.expiresOnTurn - turnNumber : null;
  const enactedEffects = formatEffectString(template?.passEffect);
  const ongoingEffects = formatEffectString(law.ongoingEffect);

  return (
    <ScrollModal visible={visible} onClose={onClose} title={law.name} subtitle="ACTIVE LAW">
      {template?.desc && <Text style={styles.desc}>{template.desc}</Text>}

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>Enacted turn {law.passedOnTurn}</Text>
        <Text style={styles.metaText}>
          {seasonsLeft !== null ? `Expires in ${seasonsLeft} season${seasonsLeft !== 1 ? 's' : ''}` : 'Permanent'}
        </Text>
      </View>

      {enactedEffects.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: COLORS.laurel }]}>WHEN ENACTED</Text>
          {enactedEffects.map((line, i) => <Text key={i} style={styles.effectLine}>{line}</Text>)}
        </View>
      )}

      {ongoingEffects.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: PARCHMENT.gold }]}>WHILE ACTIVE (PER SEASON)</Text>
          {ongoingEffects.map((line, i) => <Text key={i} style={styles.effectLine}>{line}</Text>)}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: PARCHMENT.gold }]}>STATUS</Text>
        <Text style={styles.effectLine}>
          {law.repealable ? 'Can be repealed by proposing a repeal bill.' : 'Cannot be repealed.'}
        </Text>
        {law.renewable && <Text style={styles.effectLine}>Renews automatically when it expires.</Text>}
      </View>
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
});
