// Curia Tab Redesign, Chunk C4 — the three conditional Senate surfaces in
// one tab: trials first (most consequential, most time-critical), then
// War & Peace, then The Command. Each renders only when its own condition
// holds (reused verbatim from the pre-redesign CuriaScreen). Written empty
// state (Delta 12) when none do — never a blank panel.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { getDesperationTier } from '../../engine/warEngine';
import { isWarActiveForCommand } from '../../engine/commandEngine';
import InfoTap from '../shared/InfoTap';
import TrialBanner from './TrialBanner';
import WarPeaceRow from './WarPeaceRow';
import CommandPanel from './CommandPanel';

export default function NegotiaView() {
  const trials = useGameStore(s => s.trials);
  const wars = useGameStore(s => s.wars);
  const activeCommand = useGameStore(s => s.activeCommand);
  const commandElection = useGameStore(s => s.commandElection);

  const trialsLive = trials.some(t => t.status !== 'resolved')
    || trials.some(t => t.status === 'resolved' && t.outcome);
  const warsLive = (wars ?? []).some(w => w.active && getDesperationTier(w.warScore) !== 'none');
  const commandLive = !!activeCommand
    || !!commandElection?.active
    || isWarActiveForCommand(wars ?? []);

  if (!trialsLive && !warsLive && !commandLive) {
    return (
      <View style={styles.empty}>
        <InfoTap termId="negotia">
          <Text style={styles.sectionLabel}>NEGOTIA</Text>
        </InfoTap>
        <Text style={styles.emptyText}>Rome is at peace, and no cases stand before the courts.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <InfoTap termId="negotia" style={styles.heading}>
        <Text style={styles.sectionLabel}>NEGOTIA</Text>
      </InfoTap>
      <TrialBanner />
      <WarPeaceRow />
      <CommandPanel />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACING.md },
  heading: { marginBottom: SPACING.sm },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  empty: { padding: SPACING.md, alignItems: 'center', marginTop: SPACING.lg },
  emptyText: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, textAlign: 'center', marginTop: SPACING.sm },
});
