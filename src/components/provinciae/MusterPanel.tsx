// ─── MusterPanel ─────────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C3. Lives inside RegionSheet — three discrete tier
// cards (P5-G picker style), one cohort raised per tap. Tapping a card opens
// a confirm modal (cost/quality/sanction warning, per the plan's "surface
// the warning BEFORE confirmation" instruction) with a destination choice:
// found a new Legion, or add the cohort to a player army already in this
// region.

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { Army } from '../../models/army';
import type { TheatreState, RegionId } from '../../models/theatre';
import type { CityState } from '../../models/city';
import { quoteMuster } from '../../engine/musterEngine';
import type { MusterTier } from '../../engine/musterEngine';
import InfoTap from '../shared/InfoTap';

const TIER_LABEL: Record<MusterTier, string> = {
  emergency: 'Emergency Levy',
  standard: 'Standard Levy',
  picked: 'Picked Men',
};

const TIERS: MusterTier[] = ['emergency', 'standard', 'picked'];

interface MusterPanelProps {
  regionId: RegionId;
  theatre: TheatreState;
  cities: CityState[];
  armies: Army[];
  playerImperium: number;
  playerHoldsOffice: boolean;
  denarii: number;
  onRaise: (tier: MusterTier, targetArmyId: string | null) => void;
}

export default function MusterPanel({
  regionId,
  theatre,
  cities,
  armies,
  playerImperium,
  playerHoldsOffice,
  denarii,
  onRaise,
}: MusterPanelProps) {
  const [pendingTier, setPendingTier] = useState<MusterTier | null>(null);

  const quotes = TIERS.map(tier => ({
    tier,
    quote: quoteMuster(regionId, tier, theatre, cities, armies, playerImperium, playerHoldsOffice),
  }));
  const playerArmiesHere = armies.filter(a => a.owner === 'player' && a.location === regionId);
  const pending = pendingTier ? quotes.find(q => q.tier === pendingTier) ?? null : null;

  function confirm(targetArmyId: string | null) {
    if (!pendingTier) return;
    onRaise(pendingTier, targetArmyId);
    setPendingTier(null);
  }

  return (
    <View>
      <InfoTap termId="muster">
        <Text style={styles.sectionLabel}>MUSTER</Text>
      </InfoTap>

      <View style={styles.tierRow}>
        {quotes.map(({ tier, quote }) => {
          const affordable = denarii >= quote.costDenarii;
          const blocked = !quote.eligible || !quote.imperiumOk || !affordable;
          const warning = !quote.eligible
            ? quote.reason
            : !quote.imperiumOk
            ? 'Imperium too low'
            : !affordable
            ? 'Cannot afford'
            : !quote.sanctioned
            ? 'Unsanctioned'
            : null;
          return (
            <TouchableOpacity
              key={tier}
              style={[styles.tierCard, blocked && styles.tierCardDisabled]}
              onPress={() => !blocked && setPendingTier(tier)}
              disabled={blocked}
              activeOpacity={0.8}
            >
              <Text style={styles.tierName}>{TIER_LABEL[tier]}</Text>
              <Text style={styles.tierCost}>{quote.costDenarii} den</Text>
              <Text style={styles.tierQuality}>{quote.baseVeterancy}</Text>
              {warning && <Text style={styles.tierWarning}>{warning}</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.remainingText}>
        {quotes[0].quote.cohortsRemaining} cohort(s) left to muster here this year.
      </Text>

      <Modal visible={!!pending} transparent animationType="fade" onRequestClose={() => setPendingTier(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{pendingTier ? TIER_LABEL[pendingTier].toUpperCase() : ''}</Text>
            {pending && !pending.quote.sanctioned && (
              <Text style={styles.modalWarning}>The Senate has authorised no levy. They will notice.</Text>
            )}
            {pending && (
              <Text style={styles.modalHint}>
                {pending.quote.costDenarii} denarii · {pending.quote.baseVeterancy} quality · loyalty {pending.quote.loyaltySeed}
              </Text>
            )}
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => confirm(null)} activeOpacity={0.75}>
              <Text style={styles.modalBtnPrimaryText}>Raise New Legion</Text>
            </TouchableOpacity>
            {playerArmiesHere.map(a => (
              <TouchableOpacity key={a.id} style={styles.modalBtnSecondary} onPress={() => confirm(a.id)} activeOpacity={0.75}>
                <Text style={styles.modalBtnSecondaryText}>Add to {a.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setPendingTier(null)} activeOpacity={0.75}>
              <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  } as TextStyle,

  tierRow: { flexDirection: 'row', gap: 8 } as ViewStyle,
  tierCard: {
    flex: 1,
    backgroundColor: '#1a1410',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  } as ViewStyle,
  tierCardDisabled: { borderColor: COLORS.border, opacity: 0.55 } as ViewStyle,
  tierName: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700', textAlign: 'center' } as TextStyle,
  tierCost: { color: COLORS.denariiColor, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', marginTop: 4 } as TextStyle,
  tierQuality: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9, textTransform: 'capitalize', marginTop: 2 } as TextStyle,
  tierWarning: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 8, textAlign: 'center', marginTop: 4 } as TextStyle,

  remainingText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: SPACING.sm,
  } as TextStyle,

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  } as ViewStyle,
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#2e2a24',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.gold,
    padding: SPACING.md,
  } as ViewStyle,
  modalTitle: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 13, letterSpacing: 1, marginBottom: 6 } as TextStyle,
  modalWarning: {
    color: COLORS.crimson,
    fontFamily: FONTS.body,
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: SPACING.sm,
    lineHeight: 15,
  } as TextStyle,
  modalHint: { color: COLORS.dust, fontFamily: FONTS.body, fontSize: 11, marginBottom: SPACING.sm, lineHeight: 15 } as TextStyle,
  modalBtnPrimary: {
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#1a3018',
    borderWidth: 1,
    borderColor: COLORS.laurel,
    marginTop: SPACING.sm,
  } as ViewStyle,
  modalBtnPrimaryText: { color: '#8fc98f', fontFamily: FONTS.ui, fontSize: 11, fontWeight: '700' } as TextStyle,
  modalBtnSecondary: {
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  } as ViewStyle,
  modalBtnSecondaryText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 } as TextStyle,
  modalBtnCancel: {
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: SPACING.sm,
  } as ViewStyle,
});
