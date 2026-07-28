// ─── ClanDetailZone ───────────────────────────────────────────────────────────
// Forum redesign, Chunk C0 — replaces ClanCard's inline-expanded content.
// Rendered once by ForumScreen, below the clan grid, for whichever clan is
// currently selected (expandedClanId) — never more than one clan's detail
// on screen, and it no longer occupies that clan's own position in a
// vertical list, so switching clans costs zero scrolling past others'
// collapsed cards (plans/forum-redesign.md, Chunk C0).

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import type { RefObject } from 'react';
import type { Clan } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import LeaderCard from './LeaderCard';
import LeaderDetailPanel from './LeaderDetailPanel';
import { getReputationTier } from '../../engine/reputationEngine';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Reputation bar — moved verbatim from ClanCard.tsx ───────────────────────

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

// ─── ClanDetailZone ───────────────────────────────────────────────────────────

export default function ClanDetailZone({ clan, scrollRef }: {
  clan: Clan;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const selectedLeaderId = useGameStore(s => s.selectedLeaderId);
  const selectLeader = useGameStore(s => s.selectLeader);
  const selectedLeader = clan.leaders.find(l => l.id === selectedLeaderId);

  // Forum redesign, Chunk C1 — same accent treatment as ClanGridTile, so
  // the identity carries through from tile to detail.
  const accentColor = clan.accentColor ?? COLORS.border;

  return (
    <View style={[dz.container, { borderColor: accentColor }]}>
      <View style={dz.headerRow}>
        <View style={[dz.sigilRing, { borderColor: accentColor }]}>
          <Text style={dz.sigil}>{clan.sigil}</Text>
        </View>
        <View style={dz.headerInfo}>
          <Text style={dz.name}>{clan.name}</Text>
          <Text style={dz.desc} numberOfLines={2}>{clan.desc}</Text>
          <View style={dz.infRow}>
            <Text style={dz.leaderCount}>{clan.leaders.length} leader{clan.leaders.length !== 1 ? 's' : ''}</Text>
            <Text style={dz.influence}>Influence {clan.influence}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={dz.leaderScroll}
        contentContainerStyle={{ padding: SPACING.sm }}
      >
        {clan.leaders.map((l) => (
          <LeaderCard
            key={l.id}
            leader={l}
            clanId={clan.id}
            selected={l.id === selectedLeaderId}
            onPress={() => selectLeader(l.id)}
            campaigning={false}
          />
        ))}
      </ScrollView>

      {/* Reputation bar — always visible */}
      <ReputationBar clanId={clan.id} />

      {selectedLeader && (
        <LeaderDetailPanel leader={selectedLeader} clanId={clan.id} scrollRef={scrollRef} />
      )}
    </View>
  );
}

const dz = StyleSheet.create({
  container: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    overflow: 'hidden',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm },
  sigilRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.panelElevated,
    marginRight: SPACING.sm,
  },
  sigil: { fontSize: 22 },
  headerInfo: { flex: 1 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 15, fontWeight: '700' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, lineHeight: 16, marginTop: 2 },
  infRow: { flexDirection: 'row', gap: 12, marginTop: 3 },
  leaderCount: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  influence: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 11 },
  leaderScroll: { borderTopWidth: 1, borderTopColor: COLORS.border },
});
