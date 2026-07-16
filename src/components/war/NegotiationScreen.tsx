// ─── NegotiationScreen (Military Overhaul M10) ──────────────────────────────
// The Curia's entry point into peace negotiation for a single war. Three
// distinct modes depending on war.treaty's stage — see warEngine.ts's
// header comment on the M10 peace-logic section for how each is produced:
//   - No treaty, tier reached: term-shopping picker (forced/dictate — or
//     sue when ROME is the losing side and must initiate itself).
//   - stage 'ai_offer': the enemy's minor package, read-only, accept/refuse.
//   - stage 'senate_vote': already tabled, awaiting the next bill-resolution
//     pass — status only, no further action here.

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import { useGameStore } from '../../state/gameStore';
import { TREATY_TERMS } from '../../data/treatyTerms';
import { computeTreatyBudget, computePackagePrice, getDesperationTier, losingSide, getEligibleTreatyTerms } from '../../engine/warEngine';
import { FONTS, SPACING, RADIUS, COLORS } from '../../utils/theme';
import InfoTap from '../shared/InfoTap';

interface NegotiationScreenProps {
  warId: string;
  visible: boolean;
  onClose: () => void;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function NegotiationScreen({ warId, visible, onClose }: NegotiationScreenProps) {
  const { wars, currentOffice, provinces, tableTreaty, acceptAiTreatyOffer, refuseAiTreatyOffer } = useGameStore();
  const war = wars.find(w => w.id === warId);
  const [selected, setSelected] = useState<string[]>([]);

  const eligibleTerms = useMemo(
    () => (war ? getEligibleTreatyTerms(TREATY_TERMS, war.enemyId, provinces) : []),
    [war, provinces],
  );

  if (!war) return null;

  const enemyLabel = capitalize(war.enemyId);
  const tier = getDesperationTier(war.warScore);
  const romeIsLoser = losingSide(war.warScore) === 'rome';
  const budget = computeTreatyBudget(war.warScore);
  const price = computePackagePrice(selected);
  const isConsul = currentOffice === 'consul';

  function toggleTerm(id: string) {
    const term = eligibleTerms.find(t => t.id === id);
    if (!term) return;
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      const withoutExcluded = prev.filter(x => !term.mutuallyExclusiveWith?.includes(x));
      return [...withoutExcluded, id];
    });
  }

  function handleTable() {
    if (!isConsul || price > budget) return;
    tableTreaty(warId, selected);
    setSelected([]);
    onClose();
  }

  // ── Stage: AI offer — read-only terms, accept/refuse ─────────────────────
  if (war.treaty?.stage === 'ai_offer') {
    const offerTerms = war.treaty.termIds.map(id => TREATY_TERMS.find(t => t.id === id)).filter(Boolean);
    return (
      <ScrollModal visible={visible} onClose={onClose} title={`Terms from ${enemyLabel}`} subtitle="Field Dispatch">
        <Text style={styles.flavour}>
          {enemyLabel} proposes terms. Accepting ends the war immediately — no Senate vote is needed at this stage.
        </Text>
        {offerTerms.map(t => t && (
          <View key={t.id} style={styles.termCard}>
            <Text style={styles.termLabel}>{t.label}</Text>
            <Text style={styles.termDesc}>{t.description}</Text>
          </View>
        ))}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, styles.refuseBtn]} onPress={() => { refuseAiTreatyOffer(warId); onClose(); }}>
            <Text style={styles.actionBtnLabel}>Refuse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={() => { acceptAiTreatyOffer(warId); onClose(); }}>
            <Text style={styles.actionBtnLabel}>Accept</Text>
          </TouchableOpacity>
        </View>
      </ScrollModal>
    );
  }

  // ── Stage: already tabled — status only ───────────────────────────────────
  if (war.treaty?.stage === 'senate_vote') {
    return (
      <ScrollModal visible={visible} onClose={onClose} title={`Treaty with ${enemyLabel}`} subtitle="Awaiting the Senate">
        <Text style={styles.flavour}>
          A treaty has been tabled before the Senate and awaits a vote at the next season's end. Review or vote on it
          from the bill list below.
        </Text>
      </ScrollModal>
    );
  }

  // ── Re-table lockout ───────────────────────────────────────────────────────
  if (war.treaty?.ratified === false) {
    return (
      <ScrollModal visible={visible} onClose={onClose} title={`Treaty with ${enemyLabel}`} subtitle="Rejected">
        <Text style={styles.flavour}>
          The Senate rejected the last treaty with {enemyLabel}. {capitalize(enemyLabel)} takes heart — a new package
          cannot be tabled again so soon.
        </Text>
      </ScrollModal>
    );
  }

  // ── Term-shopping picker ───────────────────────────────────────────────────
  return (
    <ScrollModal visible={visible} onClose={onClose} title={`Treaty with ${enemyLabel}`} subtitle={`Budget: ${budget}`}>
      <InfoTap termId="war-score">
        <Text style={styles.flavour}>
          {romeIsLoser
            ? `Rome is losing this war (warScore ${war.warScore}). Terms tabled here favour ${enemyLabel}.`
            : `Rome is winning this war (warScore ${war.warScore}). Terms tabled here favour Rome.`}
        </Text>
      </InfoTap>

      {!isConsul && (
        <Text style={styles.warning}>Only a sitting Consul may table a treaty before the Senate.</Text>
      )}

      <InfoTap termId="treaty-terms">
        <Text style={styles.sectionLabel}>TERMS</Text>
      </InfoTap>

      {eligibleTerms.map(term => {
        const isSelected = selected.includes(term.id);
        const disabled = !isSelected && price + term.warScorePrice > budget;
        return (
          <TouchableOpacity
            key={term.id}
            style={[styles.termCard, isSelected && styles.termCardSelected, disabled && styles.termCardDisabled]}
            disabled={disabled}
            onPress={() => toggleTerm(term.id)}
          >
            <View style={styles.termHeader}>
              <Text style={styles.termLabel}>{term.label}</Text>
              <Text style={styles.termPrice}>{term.warScorePrice >= 0 ? term.warScorePrice : `−${Math.abs(term.warScorePrice)}`}</Text>
            </View>
            <Text style={styles.termDesc}>{term.description}</Text>
          </TouchableOpacity>
        );
      })}

      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Package price</Text>
        <Text style={[styles.priceValue, price > budget && styles.priceOverBudget]}>{price} / {budget}</Text>
      </View>

      <TouchableOpacity
        style={[styles.tableBtn, (!isConsul || price > budget) && styles.tableBtnDisabled]}
        disabled={!isConsul || price > budget}
        onPress={handleTable}
      >
        <Text style={styles.tableBtnLabel}>Table Treaty</Text>
      </TouchableOpacity>
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  flavour: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, marginBottom: SPACING.sm },
  sectionLabel: { color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: SPACING.sm },
  warning: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 12, marginBottom: SPACING.sm },
  termCard: {
    backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm,
  },
  termCardSelected: { borderColor: PARCHMENT.gold, backgroundColor: 'rgba(200,168,112,0.45)' },
  termCardDisabled: { opacity: 0.4 },
  termHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  termLabel: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  termPrice: { color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 12 },
  termDesc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 3 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.sm, marginBottom: SPACING.sm },
  priceLabel: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 12 },
  priceValue: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '600' },
  priceOverBudget: { color: COLORS.crimson },
  tableBtn: { backgroundColor: PARCHMENT.gold, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center' },
  tableBtnDisabled: { opacity: 0.4 },
  tableBtnLabel: { color: '#fff', fontFamily: FONTS.ui, fontSize: 13, letterSpacing: 1 },
  actionRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  actionBtn: { flex: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, alignItems: 'center' },
  acceptBtn: { backgroundColor: PARCHMENT.gold },
  refuseBtn: { backgroundColor: 'rgba(139,26,26,0.7)' },
  actionBtnLabel: { color: '#fff', fontFamily: FONTS.ui, fontSize: 13, letterSpacing: 1 },
});
