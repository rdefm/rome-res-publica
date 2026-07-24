// ─── OfficeActionsModal ──────────────────────────────────────────────────────
// Chunk C4 of cursus-visual-redesign-plan.md — tapping an office card (any
// status) opens this ScrollModal instead of a "scroll to a separate panel"
// affordance (there is no separate panel — in-office actions have always
// rendered inline in the same card, see OfficeCard.tsx's own header comment).
//
// Held office (player only — non-player family members holding the
// household office slot have never had actionable UI, see officeStatus.ts):
// the real, interactive ActionButton list (moved out of the card, same
// gate/afford logic, unchanged). Every other status: the same actions as
// read-only reference rows (name, cost, desc, and a parsed impact summary
// via engine/actionImpactText.ts) — this replaces the plan's one-line
// greyed "Powers preview" caption with the full detail view.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Character } from '../../models/character';
import type { Office } from '../../models/office';
import type { OfficeStatus } from '../../engine/officeStatus';
import { describeActionImpact } from '../../engine/actionImpactText';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import { FONTS, SPACING, RADIUS } from '../../utils/theme';
import ActionButton from './ActionButton';

interface OfficeActionsModalProps {
  visible: boolean;
  onClose: () => void;
  office: Office;
  character: Character;
  status: OfficeStatus;
}

export default function OfficeActionsModal({
  visible, onClose, office, character, status,
}: OfficeActionsModalProps) {
  const isLiveActionable = character.isPlayer && status === 'held';

  return (
    <ScrollModal visible={visible} onClose={onClose} title={office.name} subtitle={office.latin}>
      {isLiveActionable ? (
        office.active && office.inOfficeActions ? (
          office.inOfficeActions.map(action => (
            <ActionButton key={action.id} action={action} character={character} />
          ))
        ) : (
          <Text style={styles.comingSoon}>{office.inOfficeDesc}</Text>
        )
      ) : (
        office.inOfficeActions && office.inOfficeActions.length > 0 ? (
          office.inOfficeActions.map(action => {
            const impact = describeActionImpact(action);
            return (
              <View key={action.id} style={styles.previewRow}>
                <View style={styles.previewHeader}>
                  <Text style={styles.previewName}>{action.name}</Text>
                  <Text style={styles.previewCost}>{action.cost}</Text>
                </View>
                <Text style={styles.previewDesc}>{action.desc}</Text>
                {impact.map((line, i) => (
                  <Text key={i} style={styles.previewImpact}>→ {line}</Text>
                ))}
              </View>
            );
          })
        ) : (
          <Text style={styles.comingSoon}>No recorded powers for this office.</Text>
        )
      )}
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  comingSoon: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
  },
  previewRow: {
    backgroundColor: 'rgba(200,168,112,0.15)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    opacity: 0.85,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  previewName: {
    color: PARCHMENT.heading,
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  previewCost: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  previewDesc: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: 2,
  },
  previewImpact: {
    color: PARCHMENT.body,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 3,
  },
});
