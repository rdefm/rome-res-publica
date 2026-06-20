import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import EndSeasonButton from '../components/shared/EndSeasonButton';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import type { Clan, ClanLeader } from '../models/clan';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

const STANDING_COLORS: Record<string, string> = {
  ally: COLORS.laurel,
  neutral: COLORS.dust,
  hostile: COLORS.crimson,
  rival: COLORS.denariiColor,
};

function RelBar({ value }: { value: number }) {
  const pct = (value + 100) / 200;
  const color = value >= 20 ? COLORS.laurel : value <= -20 ? COLORS.crimson : COLORS.dust;
  return (
    <View style={rel.track}>
      <View style={[rel.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      <View style={rel.centre} />
    </View>
  );
}
const rel = StyleSheet.create({
  track: { height: 4, backgroundColor: COLORS.bg, borderRadius: 2, overflow: 'hidden', flex: 1, borderWidth: 1, borderColor: COLORS.border, position: 'relative' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 2 },
  centre: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, backgroundColor: COLORS.border },
});

function LeaderCard({ leader, selected, onPress, campaigning }: {
  leader: ClanLeader; selected: boolean; onPress: () => void; campaigning: boolean;
}) {
  const borderColor = selected ? COLORS.gold
    : leader.relationship >= 20 ? COLORS.laurel
    : leader.relationship <= -20 ? COLORS.crimson
    : COLORS.border;

  return (
    <TouchableOpacity
      style={[lc.card, { borderColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {leader.blackmail && <View style={lc.blackmailDot} />}
      {leader.alliance && <View style={lc.allianceDot} />}
      <Text style={lc.emoji}>{leader.emoji}</Text>
      <Text style={lc.name} numberOfLines={1}>{leader.name.split(' ').slice(-1)[0]}</Text>
      <Text style={lc.title} numberOfLines={1}>{leader.title}</Text>
      <RelBar value={leader.relationship} />
      <View style={lc.favourRow}>
        {[0,1,2,3,4].map((i) => (
          <View key={i} style={[lc.pip, i < leader.favour && lc.pipFull]} />
        ))}
      </View>
    </TouchableOpacity>
  );
}
const lc = StyleSheet.create({
  card: {
    width: 90, backgroundColor: COLORS.panelElevated, borderWidth: 1, borderRadius: RADIUS.md,
    padding: SPACING.sm, alignItems: 'center', marginRight: SPACING.sm, position: 'relative',
  },
  blackmailDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.crimson },
  allianceDot: { position: 'absolute', top: 4, left: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.laurel },
  emoji: { fontSize: 28, marginBottom: 4 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  title: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9, textAlign: 'center', marginBottom: 4 },
  favourRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
  pip: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  pipFull: { backgroundColor: COLORS.gold },
});

function LeaderDetailPanel({ leader, clanId }: { leader: ClanLeader; clanId: string }) {
  const {
    gratia, campaigning, campaignVotes,
    buyInfluence, inviteToDinner, forgeAlliance, arrangeMarriageForum,
    gatherIntelligence, canvassForVotes,
  } = useGameStore();

  const canvassed = !!campaignVotes[leader.id];

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
        <ForumActionBtn label="Buy Influence" cost="8 Gratia" desc="Relationship +" disabled={gratia < 8} onPress={() => buyInfluence(leader.id)} />
        <ForumActionBtn label="Invite to Dinner" cost="12 Gratia" desc="Relationship +, Favour +" disabled={gratia < 12} onPress={() => inviteToDinner(leader.id)} />
        <ForumActionBtn label="Forge Alliance" cost="20 Gratia" desc="Requires Rel ≥ 30. 2-season alliance." disabled={gratia < 20 || leader.relationship < 30} onPress={() => forgeAlliance(leader.id)} />
        <ForumActionBtn label="Arrange Marriage" cost="18 Gratia" desc="Requires Rel ≥ 20. Standing improves." disabled={gratia < 18 || leader.relationship < 20} onPress={() => arrangeMarriageForum(leader.id)} />
        <ForumActionBtn
          label={leader.blackmail ? 'Counter Blackmail' : 'Gather Intelligence'}
          cost="6 Gratia"
          desc={leader.blackmail ? 'Neutralise leverage they hold.' : '50% chance to acquire leverage.'}
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

function ForumActionBtn({ label, cost, desc, disabled, onPress }: {
  label: string; cost: string; desc: string; disabled: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[fab.btn, disabled && fab.disabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={fab.row}>
        <Text style={fab.label}>{label}</Text>
        <Text style={fab.cost}>{cost}</Text>
      </View>
      <Text style={fab.desc}>{desc}</Text>
    </TouchableOpacity>
  );
}
const fab = StyleSheet.create({
  btn: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, minHeight: 44 },
  disabled: { opacity: 0.4 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  cost: { color: COLORS.gratiaColor, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 2 },
});

const ld = StyleSheet.create({
  container: { backgroundColor: COLORS.panelSurface, borderTopWidth: 1, borderColor: COLORS.border, padding: SPACING.md },
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

export default function ForumScreen() {
  const { clans, campaigning } = useGameStore();

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>FORUM</Text>
        <Text style={styles.subtitle}>
          {campaigning ? `Campaign Active — Canvass for Votes` : 'Clans & Political Alliances'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        <Text style={styles.intro}>
          Each clan is led by individual men of influence. Build relationships with them personally to
          shift their votes and allegiance.
        </Text>
        {clans.map((clan) => (
          <ClanCard key={clan.id} clan={clan} />
        ))}
      </ScrollView>

      <EndSeasonButton />
      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  scroll: { flex: 1, padding: SPACING.md },
  intro: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, marginBottom: SPACING.md, lineHeight: 18 },
});
