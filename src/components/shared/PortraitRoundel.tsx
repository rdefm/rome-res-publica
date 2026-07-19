// ─── PortraitRoundel ─────────────────────────────────────────────────────────
// Chunk C0 of cursus-visual-redesign-plan.md — shared, character-tied
// portrait component. Not Cursus-specific: any tab can render a Character
// or ClanLeader through this. Resolves an image via engine/portraitEngine +
// utils/portraitAssets; renders initials in a themed circle when no asset
// exists yet (the expected state for the whole pool until art lands — see
// portraitAssets.ts's header comment).

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../../utils/theme';
import { portraitKeyFor, type PortraitSubject } from '../../engine/portraitEngine';
import { portraitAssets } from '../../utils/portraitAssets';

interface PortraitRoundelProps {
  subject: PortraitSubject;
  size?: number;
  frame?: 'gold' | 'plain';
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

export default function PortraitRoundel({ subject, size = 44, frame = 'gold' }: PortraitRoundelProps) {
  const key = portraitKeyFor(subject);
  const source = subject.kind === 'leader'
    ? portraitAssets.leaderOverride(subject.id) ?? portraitAssets.portrait(key)
    : portraitAssets.portrait(key);

  const dim = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = frame === 'gold' ? styles.ringGold : styles.ringPlain;

  if (source) {
    return (
      <View style={[styles.base, dim, ringStyle]}>
        <Image source={source} style={dim} resizeMode="cover" />
      </View>
    );
  }

  return (
    <View style={[styles.base, styles.fallback, dim, ringStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initialsFor(subject.name)}</Text>
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
  initials: {
    fontFamily: FONTS.display,
    color: COLORS.parchmentText,
    fontWeight: '700',
  },
});
