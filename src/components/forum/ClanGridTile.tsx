// ─── ClanGridTile ─────────────────────────────────────────────────────────────
// Forum redesign, Chunk C0 — replaces ClanCard's collapsible header. One of
// 4 always-visible tiles in ForumScreen's fixed clan grid; tapping selects
// which clan ClanDetailZone shows below, reusing the existing
// expandedClanId store field as-is (plans/forum-redesign.md Finding 1 — the
// store already models "one clan selected at a time," this is a pure
// layout fix, not a state redesign).

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { RefObject } from 'react';
import type { Clan } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import { getClanStanding } from '../../engine/reputationEngine';
import { useTutorialTarget } from '../shared/useTutorialTarget';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export const STANDING_COLORS: Record<string, string> = {
  ally:    COLORS.laurel,
  neutral: COLORS.dust,
  hostile: COLORS.crimson,
  rival:   COLORS.denariiColor,
};

export default function ClanGridTile({ clan, isSelected, onPress, scrollRef }: {
  clan: Clan;
  isSelected: boolean;
  onPress: () => void;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const familyReputations = useGameStore(s => s.familyReputations);
  const electionRivals = useGameStore(s => s.electionRivals);
  const standing = getClanStanding(clan.id, familyReputations, electionRivals);
  const standingColor = STANDING_COLORS[standing] ?? COLORS.dust;

  // Tutorial redesign, T5 — only Gens Valeria is ever a spotlight target.
  // Re-homed here from ClanCard's collapsible header (retired this chunk).
  // scrollRef kept even though the grid sits high on the page — an active
  // campaign's CanvassingPanel above it can still push it below the fold on
  // a small screen (plans/forum-redesign.md Finding 6 — this must not
  // regress the softlock fixed earlier this session).
  const tutorialTarget = useTutorialTarget(clan.id === 'valerii' ? 'forum.clan.valeria' : undefined, scrollRef);

  // Forum redesign, Chunk C1 — accentColor (models/clan.ts, set in
  // data/startingClans.ts) gives each clan a visual identity even when
  // unselected; falls back to the neutral border color for a save from
  // before this field existed (Clan.accentColor's own doc comment).
  const accentColor = clan.accentColor ?? COLORS.border;

  return (
    <TouchableOpacity
      ref={tutorialTarget.ref}
      onLayout={tutorialTarget.onLayout}
      style={[gt.tile, { borderColor: accentColor }, isSelected && gt.tileSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[gt.sigilRing, { borderColor: accentColor }]}>
        <Text style={gt.sigil}>{clan.sigil}</Text>
      </View>
      <Text style={gt.name} numberOfLines={1}>{clan.name}</Text>
      <View style={[gt.standingBadge, { borderColor: standingColor }]}>
        <Text style={[gt.standingText, { color: standingColor }]}>{standing.toUpperCase()}</Text>
      </View>
    </TouchableOpacity>
  );
}

const gt = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  tileSelected: {
    borderColor: COLORS.gold,
    backgroundColor: COLORS.panelElevated,
  },
  sigilRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.panelElevated,
  },
  sigil: { fontSize: 26 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700' },
  standingBadge: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  standingText: { fontFamily: FONTS.ui, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
});
