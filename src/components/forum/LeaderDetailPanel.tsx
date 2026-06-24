import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ClanLeader } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import { getUnlockedReputationActions } from '../../engine/reputationEngine';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

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
  cost: { color: COLORS.gratiaColor, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 2 },
});

// ─── LeaderDetailPanel ────────────────────────────────────────────────────────

function LeaderDetailPanel({ leader, clanId }: { leader: ClanLeader; clanId: string }) {
  const {
    gratia, campaigning, campaignVotes, familyReputations,
    buyInfluence, inviteToDinner, forgeAlliance, arrangeMarriageForum,
    gatherIntelligence, canvassForVotes,
  } = useGameStore();

  const canvassed = !!campaignVotes[leader.id];
  const repScore = familyReputations[clanId] ?? 0;
  const unlockedActions = getUnlockedReputationActions(repScore);

  const allianceMarriageLocked = !unlockedActions.includes('propose_alliance_marriage');
  const allianceMarriageLockReason = `Requires "Cordial" standing (Rep ≥ 35). Current: ${repScore > 0 ? '+' : ''}${repScore}.`;

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

      <View style={ld.actions}>
        <ForumActionBtn
          label="Buy Influence"
          cost="8 Gratia"
          desc="Relationship +. Reputation +5."
          disabled={gratia < 8}
          onPress={() => buyInfluence(leader.id)}
        />
        <ForumActionBtn
          label="Invite to Dinner"
          cost="12 Gratia"
          desc="Relationship +, Favour +. Reputation +3."
          disabled={gratia < 12}
          onPress={() => inviteToDinner(leader.id)}
        />
        <ForumActionBtn
          label="Forge Alliance"
          cost="20 Gratia"
          desc="Requires Rel ≥ 30. 2-season alliance. Reputation +5."
          disabled={gratia < 20 || leader.relationship < 30}
          onPress={() => forgeAlliance(leader.id)}
        />
        <ForumActionBtn
          label="Arrange Marriage"
          cost="18 Gratia"
          desc="Requires Rel ≥ 20. Standing improves. Reputation +15."
          disabled={gratia < 18 || leader.relationship < 20}
          locked={allianceMarriageLocked}
          lockReason={allianceMarriageLockReason}
          onPress={() => arrangeMarriageForum(leader.id)}
        />
        <ForumActionBtn
          label={leader.blackmail ? 'Counter Blackmail' : 'Gather Intelligence'}
          cost="6 Gratia"
          desc={leader.blackmail
            ? 'Neutralise leverage they hold.'
            : '50% chance to acquire leverage. Reputation -20 if successful.'}
          disabled={gratia < 6}
          onPress={() => gatherIntelligence(leader.id)}
        />
        {campaigning && (
          <ForumActionBtn
            label={canvassed ? `Canvassed: ${campaignVotes[leader.id]}` : 'Canvass for Votes'}
            cost="6 Gratia"
            desc="One chance per leader per campaign."
            disabled={gratia < 6 || canvassed}
            onPress={() => canvassForVotes(leader.id)}
          />
        )}
      </View>
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
  actions: {},
});

export default LeaderDetailPanel;
