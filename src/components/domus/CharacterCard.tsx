import React from 'react';
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { Character } from '../../models/character';
import { COLORS, SPACING, RADIUS } from '../../utils/theme';

const PLAYER_PORTRAIT = require('../../assets/images/portrait-paterfamilias.png');
const MARBLE_BG = require('../../assets/images/marble_rectangle.png');

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
  return (
    <TouchableOpacity
      style={[styles.cardShell, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <ImageBackground
        source={MARBLE_BG}
        style={styles.cardBg}
        imageStyle={styles.cardBgImage}
        resizeMode="cover"
      >
        <View style={styles.portraitPlaceholder}>
          {character.isPlayer ? (
            <Image source={PLAYER_PORTRAIT} style={styles.portraitImage} />
          ) : (
            <Text style={styles.portraitEmoji}>
              {character.role === 'spouse' ? '👩' : character.role === 'son' ? '👦' : '👧'}
            </Text>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.cardName}>{character.name}</Text>
          <Text style={styles.cardRole}>
            {character.role.charAt(0).toUpperCase() + character.role.slice(1)} · Age {character.age}
          </Text>
          <View style={styles.traits}>
            {character.traits.map((t) => (
              <View key={t} style={[styles.badge, { borderColor: traitColor(t) }]}>
                <Text style={[styles.badgeText, { color: traitColor(t) }]}>{t}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.cardStats}>
            {(['rhetoric', 'auctoritas', 'martial', 'intrigus'] as const)
              .map((sk) => `${sk.slice(0, 3).toUpperCase()} ${character.skills[sk]}`)
              .join('  ')}
          </Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardShell: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#c8c2b8',
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    overflow: 'hidden',   // clips ImageBackground flush to border — no gap
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  cardSelected: {
    borderColor: COLORS.goldBorder,
    borderWidth: 2,
  },
  cardBg: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 4,
  },
  cardBgImage: {
    // No borderRadius — cardShell overflow:hidden handles clipping.
    // No margin/offset — image must start at pixel 0,0 of the container.
  },
  portraitPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.sm,
    backgroundColor: 'rgba(200, 184, 144, 0.5)',
    marginRight: SPACING.sm,
    flexShrink: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#b0a898',
  },
  portraitImage: {
    width: 72,
    height: 72,
    resizeMode: 'cover',
  },
  portraitEmoji: {
    fontSize: 36,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 18,
    color: '#1a1410',
    fontWeight: 'bold',
  },
  cardRole: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
    fontStyle: 'italic',
    fontSize: 13,
    color: '#5a4a3a',
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
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardStats: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 12,
    color: '#3a2e20',
    marginTop: 4,
    letterSpacing: 0.5,
  },
});
