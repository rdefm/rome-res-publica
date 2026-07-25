// ─── PortraitRoundel ─────────────────────────────────────────────────────────
// Chunk C0 of cursus-visual-redesign-plan.md — shared, character-tied
// portrait component. Not Cursus-specific: any tab can render a Character
// or ClanLeader through this. Resolves an image via engine/portraitEngine +
// utils/portraitAssets; renders a gender/age-appropriate emoji in a themed
// circle when no asset exists yet (the expected state for the whole pool
// until art lands — see portraitAssets.ts's header comment).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../../utils/theme';
import {
  ageBandFor,
  genderForCharacter,
  genderForLeader,
  lineageForCharacter,
  lineageForLeader,
  placeholderEmojiFor,
  portraitKeyFor,
  type PortraitSubject,
} from '../../engine/portraitEngine';
import { portraitAssets } from '../../utils/portraitAssets';

interface PortraitRoundelProps {
  subject: PortraitSubject;
  size?: number;
  frame?: 'gold' | 'plain';
  /** 'circle' (default) matches Cursus's existing look; 'square' preserves
   *  Domus's pre-existing card/profile-pane frame (portrait-fixes.md
   *  Chunk 3) while sharing this component's resolution/fallback logic. */
  shape?: 'circle' | 'square';
}

export default function PortraitRoundel({ subject, size = 44, frame = 'gold', shape = 'circle' }: PortraitRoundelProps) {
  const variantGender = subject.kind === 'leader' ? genderForLeader(subject) : genderForCharacter(subject);
  // portrait-fixes.md Chunk 6 hotfix — subject.portraitVariant (when
  // present) always wins regardless of this count, but a subject that
  // predates variant assignment (an old save, or a session that hasn't
  // reloaded since assignment landed) falls back to portraitKeyFor's
  // id-hash path, which needs THIS group's real variant count, not the
  // global single-variant default, or every un-assigned subject in a
  // multi-variant group collapses onto variant 1.
  const variantLineage = subject.kind === 'leader' ? lineageForLeader(subject.clanId) : lineageForCharacter();
  const variantCount = portraitAssets.variantCountFor(variantLineage, variantGender);
  const key = portraitKeyFor(subject, variantCount);
  const source = subject.kind === 'leader'
    ? portraitAssets.leaderOverride(subject.id) ?? portraitAssets.portrait(key)
    : portraitAssets.characterOverride(subject.id) ?? portraitAssets.portrait(key);

  const dim = { width: size, height: size, borderRadius: shape === 'square' ? RADIUS.sm : size / 2 };
  const ringStyle = frame === 'gold' ? styles.ringGold : styles.ringPlain;

  if (source) {
    return (
      <View style={[styles.base, dim, ringStyle]}>
        <Image source={source} style={dim} resizeMode="cover" />
      </View>
    );
  }

  const emoji = placeholderEmojiFor(variantGender, ageBandFor(subject.age));

  return (
    <View style={[styles.base, styles.fallback, dim, ringStyle]}>
      <Text style={[styles.emoji, { fontSize: size * 0.55 }]}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallback: {
    backgroundColor: COLORS.portraitPlaceholder,
  },
  ringGold: {
    borderWidth: 2,
    borderColor: COLORS.goldBorder,
  },
  ringPlain: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emoji: {
    textAlign: 'center',
  },
});
