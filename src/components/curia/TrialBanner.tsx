// Curia Tab Redesign, Chunk C4 — moved out of CuriaScreen.tsx's old inline
// TrialBanner. Same passive status card (bars via computeTotalPrepStrength,
// seat/charge framing, countdown, resolved-outcome banner) — only the
// button changed: instead of requestNavigation({ tab: 'Cursus', trialId })
// it calls selectTrialForBasilica directly, the same store field an agenda
// deep-link sets, so CuriaScreen's own effect opens the Basilica sheet in
// place (no more stranding the player on Cursus — Finding 13).
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { computeTotalPrepStrength } from '../../engine/trialEngine';
import { TRIAL_CHARGE_DEFS } from '../../data/trialCharges';
import InfoTap from '../shared/InfoTap';
import { useTutorialTarget } from '../shared/useTutorialTarget';

const OUTCOME_COLORS: Record<string, string> = {
  acquitted: COLORS.laurel, dismissed: COLORS.senatBlue,
  fined: COLORS.denariiColor, exiled: COLORS.crimson, executed: COLORS.crimson,
};

export default function TrialBanner() {
  const trials = useGameStore(s => s.trials);
  const turnNumber = useGameStore(s => s.turnNumber);
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const selectTrialForBasilica = useGameStore(s => s.selectTrialForBasilica);
  const activeTrial = trials.find(t => t.status !== 'resolved');
  const trialBannerTarget = useTutorialTarget('curia.trial-banner');

  if (!activeTrial) {
    const resolved = trials.filter(t => t.status === 'resolved' && t.outcome);
    if (resolved.length === 0) return null;
    const last = resolved[resolved.length - 1];
    const color = OUTCOME_COLORS[last.outcome!] ?? COLORS.dust;
    return (
      <View style={[styles.container, { borderColor: color }]}>
        <Text style={[styles.heading, { color, padding: SPACING.md }]}>TRIAL CONCLUDED — {last.outcome!.toUpperCase()}</Text>
      </View>
    );
  }

  const findLeader = (leaderId: string) => clans.flatMap(c => c.leaders).find(l => l.id === leaderId);

  const defendant = activeTrial.defendant;
  const prosecutor = activeTrial.prosecutor;
  const defendantName = defendant.kind === 'family'
    ? family.find(c => c.id === defendant.characterId)?.name ?? 'Unknown'
    : findLeader(defendant.leaderId)?.name ?? 'Unknown';

  const opponentLine = activeTrial.seat === 'defense'
    ? `Brought by ${(prosecutor.kind === 'leader' ? findLeader(prosecutor.leaderId)?.name : null) ?? 'Unknown'}`
    : `You accuse ${defendantName}`;

  const seasonsRemaining = Math.max(0, activeTrial.startsSeason - turnNumber);
  const chargeLabel = TRIAL_CHARGE_DEFS[activeTrial.charge]?.displayName ?? activeTrial.charge;
  const playerStrength = computeTotalPrepStrength(activeTrial.playerPrep, activeTrial.approach);

  return (
    <View ref={trialBannerTarget.ref} onLayout={trialBannerTarget.onLayout} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <InfoTap termId="trial">
            <Text style={styles.heading}>⚖️ {activeTrial.seat === 'defense' ? 'ACTIVE TRIAL' : 'PROSECUTION FILED'}</Text>
          </InfoTap>
          <Text style={styles.sub}>{chargeLabel} · {activeTrial.seat === 'defense' ? defendantName : `vs. ${defendantName}`}</Text>
          <Text style={styles.sub}>{opponentLine} · {seasonsRemaining} season{seasonsRemaining !== 1 ? 's' : ''} remaining</Text>
        </View>
      </View>
      <View style={styles.barsRow}>
        <View style={styles.barWrap}>
          <Text style={styles.barLabel}>Your Strength</Text>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.min(100, playerStrength)}%`, backgroundColor: COLORS.laurel }]} /></View>
          <Text style={[styles.barVal, { color: COLORS.laurel }]}>{Math.round(playerStrength)}</Text>
        </View>
        <View style={styles.barWrap}>
          <Text style={styles.barLabel}>Their Strength</Text>
          <View style={styles.barTrack}><View style={[styles.barFill, { width: `${Math.min(100, activeTrial.npcStrength)}%`, backgroundColor: COLORS.crimson }]} /></View>
          <Text style={[styles.barVal, { color: COLORS.crimson }]}>{Math.round(activeTrial.npcStrength)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.basilicaBtn}
        activeOpacity={0.75}
        onPress={() => selectTrialForBasilica(activeTrial.id)}
      >
        <Text style={styles.basilicaBtnText}>OPEN THE BASILICA →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.panelSurface, borderWidth: 2, borderColor: COLORS.crimson, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: SPACING.md },
  headerLeft: { flex: 1 },
  heading: { color: COLORS.crimson, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  sub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 1 },
  barsRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  barWrap: { flex: 1 },
  barLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  barTrack: { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  barFill: { height: '100%', borderRadius: 3 },
  barVal: { fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  basilicaBtn: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  basilicaBtnText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
