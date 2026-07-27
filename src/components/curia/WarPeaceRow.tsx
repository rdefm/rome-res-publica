// Curia Tab Redesign, Chunk C4 — moved out of CuriaScreen.tsx's old inline
// "WAR & PEACE" panel. Self-contained: owns its own war list + modal state,
// same conditions/behaviour as before (opens the unmodified
// NegotiationScreen).
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { getDesperationTier } from '../../engine/warEngine';
import InfoTap from '../shared/InfoTap';
import NegotiationScreen from '../war/NegotiationScreen';

export default function WarPeaceRow() {
  const wars = useGameStore(s => s.wars);
  const [negotiationWarId, setNegotiationWarId] = useState<string | null>(null);

  // Military Overhaul M10 — any active war that's reached the sue threshold
  // unlocks the negotiation entry point (agendaEngine's generator #18 also
  // points here — see its target: { tab: 'Curia' }).
  const negotiableWars = (wars ?? []).filter(w => w.active && getDesperationTier(w.warScore) !== 'none');
  if (negotiableWars.length === 0) return null;

  return (
    <View style={styles.panel}>
      <InfoTap termId="peace-negotiation">
        <Text style={styles.panelTitle}>WAR &amp; PEACE</Text>
      </InfoTap>
      <Text style={styles.panelSub}>
        The war has reached a threshold where terms may be discussed.
      </Text>
      {negotiableWars.map(w => (
        <TouchableOpacity
          key={w.id}
          style={styles.warRow}
          onPress={() => setNegotiationWarId(w.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.warRowLabel}>
              War with {w.enemyId.charAt(0).toUpperCase() + w.enemyId.slice(1)}
            </Text>
            <Text style={styles.warRowSub}>
              warScore {w.warScore >= 0 ? '+' : ''}{w.warScore}
              {w.treaty?.stage === 'ai_offer' && ' — terms offered'}
              {w.treaty?.stage === 'senate_vote' && ' — awaiting Senate vote'}
            </Text>
          </View>
          <Text style={styles.warRowArrow}>›</Text>
        </TouchableOpacity>
      ))}

      {negotiationWarId && (
        <NegotiationScreen
          warId={negotiationWarId}
          visible={!!negotiationWarId}
          onClose={() => setNegotiationWarId(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  panelTitle: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  panelSub: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginBottom: SPACING.sm },
  warRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  warRowLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  warRowSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  warRowArrow: { color: COLORS.dust, fontSize: 18, marginLeft: SPACING.sm },
});
