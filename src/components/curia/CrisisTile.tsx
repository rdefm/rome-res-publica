// Curia Tab Redesign, Chunk C1 — one tile in the pinned CrisisGrid.
// Tier drives the frame (tint/border/glow, from CRISIS_TIER_VISUAL); the
// track's own icon/abbreviation carries identity. No StatBar here (Delta 8)
// — the old CrisisTrackCell's StatBar doesn't fit this tile's budget.
//
// Chunk C6, Delta 10 — a one-shot opacity/scale pulse on the damage overlay
// when track.tier increases (compared against a ref, not looping, no
// particle system — the crisis worsening is the event worth animating, the
// crisis being bad is a state).
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { COLORS, FONTS, SPACING, RADIUS, CRISIS_TIER_VISUAL, emberGlow } from '../../utils/theme';
import { curiaAssets } from '../../utils/curiaAssets';
import InfoTap from '../shared/InfoTap';
import type { CrisisTrackId, CrisisTrack } from '../../models/crisis';

// Lifted out of CuriaScreen.tsx:49-54 (Finding — CRISIS_TIER_LABELS/TIER_NAMES
// was independently duplicated there and in CrisisTrackModal.tsx even before
// this redesign; this is the canonical copy going forward, exported for
// TreasuryBar's "highest-tier track" sentence. CrisisTrackModal.tsx's own
// copy is a pre-existing duplicate, out of this chunk's file scope — flagged,
// not fixed here.
export const CRISIS_TIER_LABELS: Record<CrisisTrackId, [string, string, string, string, string]> = {
  war:          ['Pax Externa',            'Border Tensions',    'Active Conflict',      'War Crisis',            'Existential Threat'],
  unrest:       ['Content Populace',       'Murmurs',            'Growing Anger',        'Street Violence',       'Open Revolt'],
  constitution: ['Institutional Stability','Political Tension',  'Senate Dysfunction',   'Constitutional Crisis', 'Republic in Peril'],
  economy:      ['Prosperous Republic',    'Tightening Budgets', 'Economic Strain',      'Scarcity Crisis',       'Economic Collapse'],
};

// Abbreviations per the mockups (Delta 8) — MOS for constitution (mos
// maiorum, ancestral custom), not the full word: no room on a ~70pt tile.
const CRISIS_TRACK_ABBR: Record<CrisisTrackId, string> = {
  war: 'WAR',
  unrest: 'UNREST',
  constitution: 'MOS',
  economy: 'ECON',
};

// No per-track emoji existed anywhere in the codebase before this; picked to
// match the same glyphs already used for these concepts elsewhere (⚔ for war/
// martial, ⚖ for constitutional/judicial, 💰 for economy — see offices.ts,
// startingClans.ts). Used only as the rule-2 fallback when curiaAssets has no
// real icon.
const CRISIS_TRACK_EMOJI: Record<CrisisTrackId, string> = {
  war: '⚔',
  unrest: '🔥',
  constitution: '⚖',
  economy: '💰',
};

interface CrisisTileProps {
  trackId: CrisisTrackId;
  track: CrisisTrack;
  onPress: () => void;
}

export default function CrisisTile({ trackId, track, onPress }: CrisisTileProps) {
  const visual = CRISIS_TIER_VISUAL[track.tier];
  const icon = curiaAssets.crisisIcon(trackId);
  const overlay = visual.overlay !== null ? curiaAssets.damageOverlay(visual.overlay) : undefined;

  const prevTierRef = useRef(track.tier);
  const flareOpacity = useSharedValue(0);
  const flareScale = useSharedValue(1);

  useEffect(() => {
    if (track.tier > prevTierRef.current) {
      flareOpacity.value = withSequence(withTiming(1, { duration: 150 }), withTiming(0, { duration: 450 }));
      flareScale.value = withSequence(withTiming(1.4, { duration: 150 }), withTiming(1, { duration: 450 }));
    }
    prevTierRef.current = track.tier;
  }, [track.tier]);

  const flareStyle = useAnimatedStyle(() => ({
    opacity: flareOpacity.value,
    transform: [{ scale: flareScale.value }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: visual.tint, borderColor: visual.border }]}>
        {visual.glow && <View style={[styles.glow, { backgroundColor: emberGlow }]} pointerEvents="none" />}
        <Animated.View style={[styles.flare, { backgroundColor: emberGlow }, flareStyle]} pointerEvents="none" />
        {icon ? (
          <>
            <Image source={icon} style={styles.iconImage} />
            {overlay && <Image source={overlay} style={[styles.iconImage, styles.overlayImage]} />}
          </>
        ) : (
          <Text style={styles.iconFallback}>{CRISIS_TRACK_EMOJI[trackId]}</Text>
        )}
      </View>
      {trackId === 'constitution' ? (
        <InfoTap termId="mos-maiorum">
          <Text style={styles.abbr}>{CRISIS_TRACK_ABBR[trackId]}</Text>
        </InfoTap>
      ) : (
        <Text style={styles.abbr}>{CRISIS_TRACK_ABBR[trackId]}</Text>
      )}
      <Text style={styles.level}>{Math.round(track.level)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: RADIUS.lg + 6,
    opacity: 0.35,
  },
  flare: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: RADIUS.lg + 6,
    opacity: 0,
  },
  iconImage: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  overlayImage: {
    position: 'absolute',
  },
  iconFallback: {
    fontSize: 16,
  },
  abbr: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  level: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
});
