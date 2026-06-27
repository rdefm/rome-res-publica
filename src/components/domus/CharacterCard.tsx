import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet } from 'react-native';
import type { Character } from '../../models/character';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { PARCHMENT_TEXT } from '../shared/ParchmentCard';

const PLAYER_PORTRAIT = require('../../assets/images/portrait-paterfamilias.png');
const PARCHMENT_IMG   = require('../../assets/images/card-parchment-cropped.png');

const NPC_PORTRAITS: Record<string, ReturnType<typeof require>> = {
  'npc-wife':     require('../../assets/images/npc-wife.png'),
  'npc-son':      require('../../assets/images/npc-son.png'),
  'npc-daughter': require('../../assets/images/npc-daughter.png'),
};

interface CharacterCardProps {
  character: Character;
  selected: boolean;
  onPress: () => void;
}

function traitColor(trait: string): string {
  switch (trait) {
    case 'aggressive': return COLORS.crimson;
    case 'ambitious':  return '#8B6914';
    case 'cautious':   return COLORS.senatBlue;
    case 'content':    return COLORS.laurel;
    default:           return '#6a5a4a';
  }
}

export default function CharacterCard({ character, selected, onPress }: CharacterCardProps) {
  const portrait = character.isPlayer
    ? PLAYER_PORTRAIT
    : NPC_PORTRAITS[character.id] ?? null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.touchable, selected && styles.selected]}
    >
      <ImageBackground
        source={PARCHMENT_IMG}
        resizeMode="cover"
        style={styles.bg}
        imageStyle={styles.bgImage}
      >
        {/* Row: portrait | info */}
        <View style={styles.row}>
          {/* Portrait */}
          <View style={styles.portraitWrap}>
            {portrait ? (
              <Image source={portrait} style={styles.portrait} />
            ) : (
              <View style={styles.portraitFallback}>
                <Text style={{ fontSize: 36 }}>
                  {character.role === 'spouse' ? '👩' : character.role === 'son' ? '👦' : '👧'}
                </Text>
              </View>
            )}
          </View>

          {/* Text info */}
          <View style={styles.info}>
            <Text style={styles.name}>{character.name}</Text>
            <Text style={styles.role}>
              {character.role.charAt(0).toUpperCase() + character.role.slice(1)} · Age {character.age}
            </Text>
            <View style={styles.traits}>
              {character.traits.map(t => (
                <View key={t} style={[styles.badge, { borderColor: traitColor(t) }]}>
                  <Text style={[styles.badgeText, { color: traitColor(t) }]}>{t}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.stats}>
              {(['rhetoric', 'auctoritas', 'martial', 'intrigus'] as const)
                .map(sk => `${sk.slice(0, 3).toUpperCase()} ${character.skills[sk]}`)
                .join('  ')}
            </Text>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 4,
    overflow: 'hidden',
  },
  selected: {
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  bg: {
    // ImageBackground sizes to its children — no explicit height needed
  },
  bgImage: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  // The single row that holds everything
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 2,
  },
  portraitWrap: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.sm,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: PARCHMENT_TEXT.border,
    backgroundColor: 'rgba(200,184,144,0.4)',
  },
  portrait: {
    width: 80,
    height: 80,
    resizeMode: 'cover',
  },
  portraitFallback: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: PARCHMENT_TEXT.heading,
  },
  role: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: PARCHMENT_TEXT.muted,
    marginTop: 1,
  },
  traits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  badge: {
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stats: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: PARCHMENT_TEXT.body,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
