import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { Clan } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import LeaderCard from './LeaderCard';
import LeaderDetailPanel from './LeaderDetailPanel';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const STANDING_COLORS: Record<string, string> = {
  ally: COLORS.laurel,
  neutral: COLORS.dust,
  hostile: COLORS.crimson,
  rival: COLORS.denariiColor,
};

function ClanCard({ clan }: { clan: Clan }) {
  const { expandedClanId, selectedLeaderId, expandClan, selectLeader } = useGameStore();
  const isExpanded = expandedClanId === clan.id;
  const selectedLeader = clan.leaders.find((l) => l.id === selectedLeaderId);
  const standingColor = STANDING_COLORS[clan.standing] ?? COLORS.dust;

  return (
    <View style={cc.container}>
      <TouchableOpacity style={cc.header} onPress={() => expandClan(clan.id)} activeOpacity={0.7}>
        <Text style={cc.sigil}>{clan.sigil}</Text>
        <View style={cc.info}>
          <View style={cc.titleRow}>
            <Text style={cc.name}>{clan.name}</Text>
            <View style={[cc.standingBadge, { borderColor: standingColor }]}>
              <Text style={[cc.standingText, { color: standingColor }]}>{clan.standing.toUpperCase()}</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={cc.leaderScroll} contentContainerStyle={{ padding: SPACING.sm }}>
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
          {selectedLeader && isExpanded && (
            <LeaderDetailPanel leader={selectedLeader} clanId={clan.id} />
          )}
        </View>
      )}
    </View>
  );
}

const cc = StyleSheet.create({
  container: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, marginBottom: SPACING.sm, overflow: 'hidden' },
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
