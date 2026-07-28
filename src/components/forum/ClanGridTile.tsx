// ─── ClanGridTile ─────────────────────────────────────────────────────────────
// Forum redesign, Chunk C0 — replaces ClanCard's collapsible header. One of
// 4 always-visible tiles in ForumScreen's fixed clan grid; tapping selects
// which clan ClanDetailZone shows below, reusing the existing
// expandedClanId store field as-is (plans/forum-redesign.md Finding 1 — the
// store already models "one clan selected at a time," this is a pure
// layout fix, not a state redesign).
//
// Chunk C1b (menu aesthetics pass) — flat panelSurface/panelElevated fills
// replaced with the shared ParchmentCard (same material Domus/Cursus already
// use), per the "Option A" design review: Forum was the one tab still on the
// old flat-charcoal-box look, next to Domus/Cursus's parchment and Curia's
// gilded-wood-and-rivets. Text colors follow, switching from the dark-theme
// marble/dust palette to ParchmentCard's own PARCHMENT_TEXT (dark-on-cream).
// Semantic status colors (STANDING_COLORS, per-clan accentColor) are kept
// as-is regardless of card material — same "status colors don't change with
// background" precedent OfficeCard.tsx's StatusSeal chips already establish
// on top of this exact same card.

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import type { RefObject } from 'react';
import type { Clan } from '../../models/clan';
import { useGameStore } from '../../state/gameStore';
import { getClanStanding } from '../../engine/reputationEngine';
import { useTutorialTarget } from '../shared/useTutorialTarget';
import ParchmentCard, { PARCHMENT_TEXT } from '../shared/ParchmentCard';
import { forumAssets } from '../../utils/forumAssets';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

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
  const accentColor = clan.accentColor ?? PARCHMENT_TEXT.border;
  const sigilIcon = forumAssets.clanSigil(clan.id);

  return (
    <TouchableOpacity
      ref={tutorialTarget.ref}
      onLayout={tutorialTarget.onLayout}
      onPress={onPress}
      activeOpacity={0.75}
      style={gt.touchable}
    >
      <ParchmentCard style={gt.tile} contentStyle={gt.inner}>
        {/* Medallion — deliberately kept dark, like a wax seal or bronze
            medallion pinned to a document, rather than switching to
            parchment's own cream tone. */}
        <View style={[gt.sigilRing, { borderColor: accentColor }]}>
          {sigilIcon ? (
            <View style={gt.sigilClip}>
              <Image source={sigilIcon} style={gt.sigilImage} />
            </View>
          ) : (
            <Text style={gt.sigil}>{clan.sigil}</Text>
          )}
        </View>
        <Text style={gt.name} numberOfLines={1}>{clan.name}</Text>
        <View style={[gt.standingBadge, { borderColor: standingColor }]}>
          <Text style={[gt.standingText, { color: standingColor }]}>{standing.toUpperCase()}</Text>
        </View>
      </ParchmentCard>
    </TouchableOpacity>
  );
}

const gt = StyleSheet.create({
  touchable: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  tile: {
    margin: 0,
  },
  inner: {
    paddingVertical: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  sigilRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.panelElevated,
  },
  sigil: { fontSize: 26 },
  // The source art (assets/forum/icon-*.png) is a circular medallion
  // (already gold-on-black, its own ring baked in) rendered on a wide
  // transparent canvas — `cover` inside a clipped circle crops away that
  // padding down to just the medallion, no `contain` letterboxing.
  sigilClip: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sigilImage: { width: 44, height: 44, resizeMode: 'cover' },
  name: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700' },
  standingBadge: { borderWidth: 1, borderRadius: 2, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  standingText: { fontFamily: FONTS.ui, fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
});
