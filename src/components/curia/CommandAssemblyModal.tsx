// Curia Tab Redesign, Chunk C4 — moved out of CuriaScreen.tsx's old inline
// CommandAssemblyModal, essentially unchanged. Campaign Map plan, Chunk C4.
// Covers both a fresh vote and an auto-called prorogation vote — see
// models/command.ts's CommandElectionState. Mirrors SubmitBillModal's
// ScrollModal + item-row shape rather than inventing a new visual language
// for "pick from a list, pay a cost, get a result."
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { isEligibleForCommand, commandMinAge, calcCommandStandings } from '../../engine/commandEngine';
import { BALANCE } from '../../data/balance';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';

export default function CommandAssemblyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const commandElection = useGameStore(s => s.commandElection);
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const clients = useGameStore(s => s.clients);
  const fides = useGameStore(s => s.fides);
  const declareCommandCandidate = useGameStore(s => s.declareCommandCandidate);
  const canvassForCommand = useGameStore(s => s.canvassForCommand);
  if (!commandElection?.active) return null;

  const candidate = commandElection.candidateCharacterId
    ? family.find(c => c.id === commandElection.candidateCharacterId)
    : null;
  const eligibleFamily = family.filter(c => !commandElection.candidateCharacterId && isEligibleForCommand(c));
  const canvassCost = BALANCE.campaign.command.canvassFidesCost;

  // Mobile QA fix (2026-07) — this modal had no voting-status display at all
  // (the actual root of "can't see the voting status" — the canvass button
  // below was always correctly gated/working). Mirrors the magistracy
  // ElectionPanel's "Live Polling Standings" — see calcCommandStandings'
  // own comment for why it's an honest estimate, not the final resolved
  // score.
  const standings = calcCommandStandings(commandElection, clans, clients, candidate?.name ?? null);
  const maxStandingScore = Math.max(...standings.map(s => s.score), 1);
  const playerRank = candidate ? standings.findIndex(s => s.isPlayer) + 1 : 0;

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={commandElection.isProrogation ? 'Prorogation Vote' : 'Extraordinary Assembly'}
      subtitle={`Resolves at End Season · Canvass cost: ${canvassCost} Fides`}
    >
      <Text style={styles.itemDesc}>
        {commandElection.isProrogation
          ? 'The command\'s term ends this season. The incumbent stands for re-election; a challenger may still declare.'
          : 'Winning grants imperium, a state legion at Rome, and a war chest for the duration of the war.'}
      </Text>

      {standings.length > 0 && (
        <>
          <View style={styles.standingsHeaderRow}>
            <Text style={styles.sectionLabel}>LIVE ASSEMBLY STANDINGS</Text>
            {candidate && (
              <Text style={[styles.rankBadge, playerRank === 1 ? styles.rankBadgeWin : styles.rankBadgeLose]}>
                {playerRank === 1 ? `✓ Est. #${playerRank}` : `✗ Est. #${playerRank}`}
              </Text>
            )}
          </View>
          {standings.map((s, i) => (
            <View key={s.id} style={styles.standingRow}>
              <Text style={[styles.standingName, s.isPlayer && styles.standingNamePlayer]} numberOfLines={1}>
                {i === 0 ? '👑 ' : ''}{s.name}
              </Text>
              <View style={styles.standingBarTrack}>
                <View style={[styles.standingBarFill, {
                  width: `${(s.score / maxStandingScore) * 100}%`,
                  backgroundColor: s.isPlayer ? PARCHMENT.gold : PARCHMENT.muted,
                }]} />
              </View>
              <Text style={styles.standingScore}>{s.score}</Text>
            </View>
          ))}
        </>
      )}

      <Text style={styles.sectionLabel}>YOUR CANDIDATE</Text>
      {candidate ? (
        <View style={styles.item}>
          <Text style={styles.itemName}>{candidate.name}</Text>
          <Text style={styles.itemDesc}>Rhetoric {candidate.skills.rhetoric}/10</Text>
        </View>
      ) : eligibleFamily.length === 0 ? (
        <Text style={styles.empty}>No family member meets the age requirement (≥{commandMinAge()}).</Text>
      ) : (
        eligibleFamily.map(c => (
          <TouchableOpacity key={c.id} style={styles.item} onPress={() => declareCommandCandidate(c.id)}>
            <Text style={styles.itemName}>{c.name}</Text>
            <Text style={styles.itemDesc}>Stand for the command — Rhetoric {c.skills.rhetoric}/10</Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={styles.sectionLabel}>RIVAL CANDIDATES</Text>
      {commandElection.rivals.length === 0 && <Text style={styles.empty}>No rivals stand this season.</Text>}
      {commandElection.rivals.map(rival => {
        const pledged = commandElection.votes[rival.id] === 'for';
        const isIncumbent = rival.id === commandElection.incumbentRivalId;
        const disabled = pledged || fides < canvassCost;
        return (
          <View key={rival.id} style={styles.item}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{rival.emoji} {rival.name}{isIncumbent ? ' (Incumbent)' : ''}</Text>
              <Text style={styles.itemType}>{rival.clanName.toUpperCase()}</Text>
            </View>
            <Text style={styles.itemDesc}>
              {rival.title}{rival.highestOffice ? ` · Ex-${rival.highestOffice}` : ''}
            </Text>
            <TouchableOpacity
              style={[styles.canvassBtn, disabled && styles.itemDisabled]}
              disabled={disabled}
              onPress={() => canvassForCommand(rival.id)}
            >
              <Text style={styles.canvassBtnText}>
                {pledged ? 'Pledged' : `Canvass (−${canvassCost} Fides)`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollModal>
  );
}

const styles = StyleSheet.create({
  standingsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankBadge: { fontFamily: FONTS.display, fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  rankBadgeWin: { color: COLORS.laurel, backgroundColor: 'rgba(80,140,60,0.2)' },
  rankBadgeLose: { color: COLORS.crimson, backgroundColor: 'rgba(160,40,40,0.2)' },
  standingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 6 },
  standingName: { flex: 1, color: PARCHMENT.body, fontFamily: FONTS.display, fontSize: 12 },
  standingNamePlayer: { color: PARCHMENT.heading, fontWeight: '700' },
  standingBarTrack: { flex: 1.2, height: 6, backgroundColor: 'rgba(122,90,26,0.15)', borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: PARCHMENT.border },
  standingBarFill: { height: '100%', borderRadius: 3 },
  standingScore: { width: 28, textAlign: 'right', color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  item: { backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: PARCHMENT.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  itemDisabled: { opacity: 0.4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  itemName: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  itemType: { color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1 },
  itemDesc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 3 },
  empty: { color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', textAlign: 'center', marginTop: SPACING.lg },
  sectionLabel: {
    color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  canvassBtn: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(122,90,26,0.25)', borderWidth: 1,
    borderColor: PARCHMENT.gold, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
    paddingVertical: 5, marginTop: SPACING.xs,
  },
  canvassBtnText: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '600' },
});
