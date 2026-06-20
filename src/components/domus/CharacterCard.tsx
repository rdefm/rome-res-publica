import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import type { Character } from '../../models/character';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const PLAYER_PORTRAIT = require('../../assets/images/portrait-paterfamilias.png');

interface CharacterCardProps {
  character: Character;
  selected: boolean;
  onPress: () => void;
}

function relationshipBorderColor(rel: number): string {
  if (rel >= 60) return COLORS.gold;
  if (rel >= 20) return COLORS.laurel;
  if (rel < 0)  return COLORS.crimson;
  return COLORS.border;
}

function traitColor(trait: string): string {
  switch (trait) {
    case 'aggressive': return COLORS.crimson;
    case 'ambitious':  return COLORS.gold;
    case 'cautious':   return COLORS.senatBlue;
    case 'content':    return COLORS.laurel;
    default:           return COLORS.dust;
  }
}

export default function CharacterCard({ character, selected, onPress }: CharacterCardProps) {
  const borderColor = selected ? COLORS.gold : relationshipBorderColor(character.relationship);

  return (
    <TouchableOpacity
      style={[styles.card, { borderColor }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.portrait, { borderColor }]}>
        {character.isPlayer ? (
          <Image source={PLAYER_PORTRAIT} style={styles.portraitImage} />
        ) : (
          <Text style={styles.portraitEmoji}>
            {character.role === 'spouse' ? '👩' : character.role === 'son' ? '👦' : '👧'}
          </Text>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{character.name}</Text>
        <Text style={styles.role}>{character.role.charAt(0).toUpperCase() + character.role.slice(1)} · Age {character.age}</Text>
        <View style={styles.traits}>
          {character.traits.map((t) => (
            <View key={t} style={[styles.traitBadge, { borderColor: traitColor(t) }]}>
              <Text style={[styles.traitText, { color: traitColor(t) }]}>{t}</Text>
            </View>
          ))}
        </View>
        <View style={styles.skills}>
          {(['rhetoric', 'auctoritas', 'martial', 'intrigus'] as const).map((sk) => (
            <Text key={sk} style={styles.skillPip}>
              {sk.slice(0, 3).toUpperCase()} {character.skills[sk]}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.relBar}>
        <View style={[styles.relFill, {
          height: `${Math.max(0, character.relationship)}%`,
          backgroundColor: relationshipBorderColor(character.relationship),
        }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  portrait: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    marginRight: SPACING.sm,
  },
  portraitImage: {
    width: 60,
    height: 60,
    resizeMode: 'cover',
  },
  portraitEmoji: {
    fontSize: 36,
  },
  info: {
    flex: 1,
  },
  name: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '600',
  },
  role: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginTop: 1,
  },
  traits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  traitBadge: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  traitText: {
    fontSize: 9,
    fontFamily: FONTS.ui,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  skills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  skillPip: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  relBar: {
    width: 6,
    height: 60,
    backgroundColor: COLORS.bg,
    borderRadius: 3,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    marginLeft: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  relFill: {
    width: '100%',
    borderRadius: 3,
  },
});
