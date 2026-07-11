import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import type { ClanLeader } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import { getUnlockedReputationActions, computeReputationDelta } from '../../engine/reputationEngine';
import { gatherChance, isDeterred } from '../../engine/secretEngine';
import { FileProsecutionPickerModal } from './DossierPanel';
import { BALANCE } from '../../data/balance';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Gather Intelligence family-member picker (Phase 4, P4-A) ────────────────
// Inline modal list, per the plan's "a simple inline list is fine this
// chunk" — the richer Cursus/Basilica candidate-picker treatment lands with
// the Basilica screen in P4-D.

function IntelPickerModal({
  visible,
  leader,
  onClose,
  onPick,
}: {
  visible: boolean;
  leader: ClanLeader;
  onClose: () => void;
  onPick: (agentId: string) => void;
}) {
  const family = useGameStore(s => s.family);
  const eligible = family.filter(c => c.age >= 18);
  const groundwork = leader.intelGroundwork ?? 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={ip.overlay} activeOpacity={1} onPress={onClose}>
        <View style={ip.modal}>
          <Text style={ip.title}>WHO GATHERS INTELLIGENCE?</Text>
          {eligible.length === 0 && (
            <Text style={ip.empty}>No adult family member available to send.</Text>
          )}
          {eligible.map(c => {
            const chance = gatherChance(c.skills.intrigus, groundwork);
            return (
              <TouchableOpacity
                key={c.id}
                style={ip.row}
                onPress={() => { onPick(c.id); onClose(); }}
              >
                <View style={ip.rowInner}>
                  <Text style={ip.rowName}>{c.isPlayer ? '⭐ ' : ''}{c.name}</Text>
                  <Text style={ip.rowSub}>Intrigus {c.skills.intrigus}</Text>
                </View>
                <Text style={ip.rowChance}>{Math.round(chance * 100)}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const ip = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modal: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  title: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  empty: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowInner: { flex: 1 },
  rowName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14 },
  rowSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  rowChance: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 13, fontWeight: '700' },
});

// ─── ForumActionBtn ───────────────────────────────────────────────────────────

export function ForumActionBtn({
  label, cost, desc, disabled, onPress, locked, lockReason,
}: {
  label: string;
  cost: string;
  desc: string;
  disabled: boolean;
  onPress: () => void;
  locked?: boolean;
  lockReason?: string;
}) {
  const isDisabled = disabled || !!locked;

  return (
    <TouchableOpacity
      style={[fab.btn, isDisabled && fab.disabled]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
    >
      <View style={fab.row}>
        <View style={fab.labelWrap}>
          {locked && <Text style={fab.lockIcon}>🔒 </Text>}
          <Text style={fab.label}>{label}</Text>
        </View>
        <Text style={fab.cost}>{cost}</Text>
      </View>
      <Text style={fab.desc}>
        {locked && lockReason ? lockReason : desc}
      </Text>
    </TouchableOpacity>
  );
}

const fab = StyleSheet.create({
  btn: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 44,
  },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  labelWrap: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  lockIcon: { fontSize: 11, marginRight: 2 },
  label: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  cost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 2 },
});

// ─── LeaderDetailPanel ────────────────────────────────────────────────────────

function LeaderDetailPanel({ leader, clanId }: { leader: ClanLeader; clanId: string }) {
  const {
    fides, denarii, campaigning, campaignVotes, familyReputations, clans, secrets, trials,
    buyInfluence, inviteToDinner, forgeAlliance, arrangeMarriageForum,
    gatherIntelligence, canvassForVotes,
  } = useGameStore();
  const [intelPickerOpen, setIntelPickerOpen] = useState(false);
  const [prosecutionPickerOpen, setProsecutionPickerOpen] = useState(false);

  const canvassed = !!campaignVotes[leader.id];
  const repScore = familyReputations[clanId] ?? 0;
  const unlockedActions = getUnlockedReputationActions(repScore);

  // Phase 4, Chunk P4-B — Dossier summary line. Undiscovered Secrets held
  // against the family never surface here.
  const youHoldCount = secrets.filter(
    s => s.holder === 'player' && s.subject.kind === 'leader' && s.subject.leaderId === leader.id && s.status === 'held'
  ).length;
  const theyHoldCount = secrets.filter(
    s => s.holder === leader.id && s.subject.kind === 'family' && s.discovered && (s.status === 'held' || s.status === 'extorting')
  ).length;
  const deterred = isDeterred(leader.id, secrets);
  const secretsLine =
    deterred ? 'Standoff — you each hold something on the other.'
    : youHoldCount > 0 && theyHoldCount > 0 ? `You hold ${youHoldCount}, he holds ${theyHoldCount} — see the Dossier.`
    : youHoldCount > 0 ? `You hold ${youHoldCount} on him — see the Dossier.`
    : theyHoldCount > 0 ? `He holds ${theyHoldCount} on your family — see the Dossier.`
    : null;

  // Phase 4, Chunk P4-C — corruption-gated filing path (distinct from the
  // Dossier's criminal-Secret path — see DossierPanel.HeldByYouRow). Shown
  // whenever the corruption threshold qualifies, regardless of whether the
  // player also holds a Secret on this leader (fileProsecution prefers the
  // stronger Secret-evidence path automatically when both are available).
  const corruptionFilingEligible = (leader.corruptionScore ?? 0) >= BALANCE.trials.corruptionChargeThreshold;
  const trialAlreadyActive = trials.some(t => t.status !== 'resolved');

  const allianceMarriageLocked = !unlockedActions.includes('propose_alliance_marriage');
  const allianceMarriageLockReason = `Requires "Cordial" standing (Rep ≥ 35). Current: ${repScore > 0 ? '+' : ''}${repScore}.`;

  // Reputation swing scales with this leader's share of their clan's total
  // voting bloc — see engine/reputationEngine.ts computeReputationDelta.
  const clanTotalVotes = clans.find(c => c.id === clanId)?.leaders.reduce((sum, l) => sum + l.votes, 0) ?? 0;
  const repFor = (relationshipDelta: number) => computeReputationDelta(relationshipDelta, leader.votes, clanTotalVotes);

  return (
    <View style={ld.container}>
      <View style={ld.header}>
        <Text style={ld.emoji}>{leader.emoji}</Text>
        <View style={ld.info}>
          <Text style={ld.name}>{leader.name}</Text>
          <Text style={ld.title}>{leader.title} · Age {leader.age}</Text>
          <Text style={ld.bio}>{leader.bio}</Text>
        </View>
      </View>

      <View style={ld.statsGrid}>
        <Text style={ld.stat}>Sphere: <Text style={ld.statVal}>{leader.sphere}</Text></Text>
        <Text style={ld.stat}>Lean: <Text style={ld.statVal}>{leader.bias}</Text></Text>
        <Text style={ld.stat}>Relationship: <Text style={ld.statVal}>{leader.relationship}</Text></Text>
        <Text style={ld.stat}>Votes: <Text style={ld.statVal}>{leader.votes}</Text></Text>
      </View>

      {secretsLine && <Text style={ld.secretsLine}>{secretsLine}</Text>}

      <View style={ld.actions}>
        <ForumActionBtn
          label="Buy Influence"
          cost="10 Fides"
          desc={`Relationship +5. Reputation +${repFor(5)}.`}
          disabled={fides < 10}
          onPress={() => buyInfluence(leader.id)}
        />
        <ForumActionBtn
          label="Invite to Dinner"
          cost="20 Denarii"
          desc={`Relationship +8, Favour +. Reputation +${repFor(8)}.`}
          disabled={denarii < 20}
          onPress={() => inviteToDinner(leader.id)}
        />
        <ForumActionBtn
          label="Forge Alliance"
          cost="20 Fides"
          desc={`Requires Rel ≥ 30. 2-season alliance. Reputation +${repFor(12)}.`}
          disabled={fides < 20 || leader.relationship < 30}
          onPress={() => forgeAlliance(leader.id)}
        />
        <ForumActionBtn
          label="Arrange Marriage"
          cost="20 Fides"
          desc={`Requires Rel ≥ 20. Standing improves. Reputation +${repFor(20)}.`}
          disabled={fides < 20 || leader.relationship < 20}
          locked={allianceMarriageLocked}
          lockReason={allianceMarriageLockReason}
          onPress={() => arrangeMarriageForum(leader.id)}
        />
        <ForumActionBtn
          label={leader.blackmail ? 'Counter Blackmail' : 'Gather Intelligence'}
          cost={`${BALANCE.secrets.gatherCostFides} Fides`}
          desc="Send a family member to dig for compromising material. Chance depends on who you send."
          disabled={fides < BALANCE.secrets.gatherCostFides}
          onPress={() => setIntelPickerOpen(true)}
        />
        {campaigning && (
          <ForumActionBtn
            label={canvassed ? `Canvassed: ${campaignVotes[leader.id]}` : 'Canvass for Votes'}
            cost="12 Fides"
            desc="One chance per leader per campaign."
            disabled={fides < 12 || canvassed}
            onPress={() => canvassForVotes(leader.id)}
          />
        )}
        {corruptionFilingEligible && (
          <ForumActionBtn
            label={trialAlreadyActive ? 'The courts are occupied' : 'File Prosecution'}
            cost={`${BALANCE.trials.fileCostFides} Fides`}
            desc={`Corruption ${leader.corruptionScore ?? 0} — grounds enough to bring formal charges.`}
            disabled={fides < BALANCE.trials.fileCostFides || trialAlreadyActive}
            onPress={() => setProsecutionPickerOpen(true)}
          />
        )}
      </View>

      <IntelPickerModal
        visible={intelPickerOpen}
        leader={leader}
        onClose={() => setIntelPickerOpen(false)}
        onPick={(agentId) => gatherIntelligence(leader.id, agentId)}
      />
      <FileProsecutionPickerModal
        visible={prosecutionPickerOpen}
        leaderId={leader.id}
        onClose={() => setProsecutionPickerOpen(false)}
      />
    </View>
  );
}

const ld = StyleSheet.create({
  container: {
    backgroundColor: COLORS.panelSurface,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  header: { flexDirection: 'row', marginBottom: SPACING.sm },
  emoji: { fontSize: 36, marginRight: SPACING.sm },
  info: { flex: 1 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 16, fontWeight: '700' },
  title: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  bio: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 4, lineHeight: 17 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  stat: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  statVal: { color: COLORS.marble, fontWeight: '600' },
  secretsLine: { color: COLORS.goldDim, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginBottom: SPACING.sm },
  actions: {},
});

export default LeaderDetailPanel;
