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
  const key = portraitKeyFor(subject);
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

  const gender = subject.kind === 'leader' ? genderForLeader(subject) : genderForCharacter(subject);
  const emoji = placeholderEmojiFor(gender, ageBandFor(subject.age));

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
