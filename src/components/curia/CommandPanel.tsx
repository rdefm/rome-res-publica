// Curia Tab Redesign, Chunk C4 — moved out of CuriaScreen.tsx's old inline
// "THE COMMAND" panel (Campaign Map plan, Chunk C4). Self-contained: owns
// its own CommandAssemblyModal open/close state.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { isWarActiveForCommand } from '../../engine/commandEngine';
import { BALANCE } from '../../data/balance';
import InfoTap from '../shared/InfoTap';
import { useTutorialTarget } from '../shared/useTutorialTarget';
import CommandAssemblyModal from './CommandAssemblyModal';

export default function CommandPanel() {
  const wars = useGameStore(s => s.wars);
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const fides = useGameStore(s => s.fides);
  const activeCommand = useGameStore(s => s.activeCommand);
  const commandElection = useGameStore(s => s.commandElection);
  const callCommandVote = useGameStore(s => s.callCommandVote);
  const [commandModalVisible, setCommandModalVisible] = useState(false);

  // Tutorial redesign, T8 — same "call unconditionally, target id conditional
  // on the relevant state" pattern used elsewhere.
  const proposeCommandVoteTarget = useTutorialTarget(
    !activeCommand && !commandElection?.active ? 'curia.action.propose-command-vote' : undefined,
  );
  const openAssemblyTarget = useTutorialTarget(
    commandElection?.active ? 'curia.action.open-assembly' : undefined,
  );

  const commandVoteEligible = !activeCommand && !commandElection?.active && isWarActiveForCommand(wars ?? []);
  if (!commandVoteEligible && !activeCommand && !commandElection?.active) return null;

  const commandHolderName = activeCommand
    ? (activeCommand.holderOwner === 'player'
        ? family.find(c => c.id === activeCommand.holderId)?.name ?? 'Unknown'
        : clans.flatMap(c => c.leaders).find(l => l.id === activeCommand.holderId)?.name ?? 'A rival commander')
    : null;

  return (
    <View style={styles.panel}>
      <InfoTap termId="the-command">
        <Text style={styles.panelTitle}>THE COMMAND</Text>
      </InfoTap>
      {commandElection?.active ? (
        <TouchableOpacity
          ref={openAssemblyTarget.ref}
          onLayout={openAssemblyTarget.onLayout}
          style={styles.row}
          onPress={() => setCommandModalVisible(true)}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>
              {commandElection.isProrogation ? 'Prorogation vote open' : 'Extraordinary assembly open'}
            </Text>
            <Text style={styles.rowSub}>
              {commandElection.rivals.length} rival(s) standing — canvass before End Season.
            </Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      ) : activeCommand ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>{commandHolderName} holds the command</Text>
            <Text style={styles.rowSub}>
              War chest {activeCommand.warChest} den · expires season {activeCommand.expiresSeason}
            </Text>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          ref={proposeCommandVoteTarget.ref}
          onLayout={proposeCommandVoteTarget.onLayout}
          style={[styles.submitBtn, fides < BALANCE.campaign.command.callVoteFidesCost && styles.submitBtnDisabled]}
          onPress={() => callCommandVote(null)}
          disabled={fides < BALANCE.campaign.command.callVoteFidesCost}
        >
          <Text style={styles.submitBtnLabel}>Propose a Command Vote</Text>
          <Text style={styles.submitBtnCost}>−{BALANCE.campaign.command.callVoteFidesCost} 🤝</Text>
        </TouchableOpacity>
      )}

      <CommandAssemblyModal visible={commandModalVisible} onClose={() => setCommandModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  panelTitle: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
  },
  rowLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  rowSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  rowArrow: { color: COLORS.dust, fontSize: 18, marginLeft: SPACING.sm },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6, alignSelf: 'flex-start' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  submitBtnCost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 11 },
});
