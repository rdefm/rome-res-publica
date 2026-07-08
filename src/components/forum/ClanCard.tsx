import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { Clan } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import LeaderCard from './LeaderCard';
import LeaderDetailPanel from './LeaderDetailPanel';
import { getReputationTier, getClanStanding } from '../../engine/reputationEngine';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const STANDING_COLORS: Record<string, string> = {
  ally:    COLORS.laurel,
  neutral: COLORS.dust,
  hostile: COLORS.crimson,
  rival:   COLORS.denariiColor,
};

// ─── Reputation bar ───────────────────────────────────────────────────────────

function ReputationBar({ clanId }: { clanId: string }) {
  const familyReputations = useGameStore(s => s.familyReputations);
  const score = familyReputations[clanId] ?? 0;
  const tier = getReputationTier(score);

  // Map -100..100 to 0..1 for bar fill
  const pct = (score + 100) / 200;

  // Colour by tier label
  const barColor =
    score >= 85 ? COLORS.gold :
    score >= 60 ? COLORS.laurel :
    score >= 35 ? COLORS.senatBlue :
    score >= 10 ? COLORS.dust :
    score >= -10 ? COLORS.dust :
    score >= -50 ? COLORS.denariiColor :
    COLORS.crimson;

  return (
    <View style={rb.container}>
      <View style={rb.labelRow}>
        <Text style={rb.label}>FAMILY REPUTATION</Text>
        <Text style={[rb.tierLabel, { color: barColor }]}>{tier.label}</Text>
        <Text style={rb.score}>{score > 0 ? `+${score}` : `${score}`}</Text>
      </View>
      <View style={rb.track}>
        <View style={[rb.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
        {/* Centre marker for 0 */}
        <View style={rb.centreMark} />
      </View>
      {tier.passiveEffect && (
        <Text style={rb.passive}>{tier.passiveEffect}</Text>
      )}
    </View>
  );
}

const rb = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.panelSurface,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: SPACING.sm,
  },
  label: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    flex: 1,
  },
  tierLabel: {
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
  },
  score: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    minWidth: 28,
    textAlign: 'right',
  },
  track: {
    height: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  centreMark: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.border,
  },
  passive: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: SPACING.xs,
    lineHeight: 16,
  },
});

// ─── ClanCard ─────────────────────────────────────────────────────────────────

function ClanCard({ clan }: { clan: Clan }) {
  const { expandedClanId, selectedLeaderId, expandClan, selectLeader, familyReputations, electionRivals } = useGameStore();
  const isExpanded = expandedClanId === clan.id;
  const selectedLeader = clan.leaders.find((l) => l.id === selectedLeaderId);
  const standing = getClanStanding(clan.id, familyReputations, electionRivals);
  const standingColor = STANDING_COLORS[standing] ?? COLORS.dust;

  return (
    <View style={cc.container}>
      <TouchableOpacity style={cc.header} onPress={() => expandClan(clan.id)} activeOpacity={0.7}>
        <Text style={cc.sigil}>{clan.sigil}</Text>
        <View style={cc.info}>
          <View style={cc.titleRow}>
            <Text style={cc.name}>{clan.name}</Text>
            <View style={[cc.standingBadge, { borderColor: standingColor }]}>
              <Text style={[cc.standingText, { color: standingColor }]}>{standing.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={cc.desc} numberOfLines={2}>{clan.desc}</Text>
          <View style={cc.infRow}>
            <Text style={cc.leaderCount}>{clan.leaders.length} leader{clan.leaders.length !== 1 ? 's' : ''}</Text>
            <Text style={cc.influence}>Influence {clan.influence}</Text>
          </View>
        </View>
        <Text style={cc.chevron}>{isExpanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={cc.leaderScroll}
            contentContainerStyle={{ padding: SPACING.sm }}
          >
            {clan.leaders.map((l) => (
              <LeaderCard
                key={l.id}
                leader={l}
                selected={l.id === selectedLeaderId}
                onPress={() => selectLeader(l.id)}
                campaigning={false}
              />
            ))}
          </ScrollView>

          {/* Reputation bar — always visible when expanded */}
          <ReputationBar clanId={clan.id} />

          {selectedLeader && isExpanded && (
            <LeaderDetailPanel leader={selectedLeader} clanId={clan.id} />
          )}
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  container: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm },
  sigil: { fontSize: 28, marginRight: SPACING.sm },
  info: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  standingBadge: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 4 },
  standingText: { fontFamily: FONTS.ui, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, lineHeight: 16 },
  infRow: { flexDirection: 'row', gap: 12, marginTop: 3 },
  leaderCount: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  influence: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 11 },
  chevron: { color: COLORS.dust, fontSize: 14, marginLeft: SPACING.sm },
  leaderScroll: { borderTopWidth: 1, borderTopColor: COLORS.border },
});

export default ClanCard;
