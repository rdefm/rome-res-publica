import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import CharacterCard from './CharacterCard';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

interface FamilyTreeProps {
  selectedCharacterId: string | null;
  onPressCharacter: (id: string) => void;
}

export default function FamilyTree({ selectedCharacterId, onPressCharacter }: FamilyTreeProps) {
  const { family } = useGameStore();

  return (
    <View>
      <Text style={styles.sectionLabel}>FAMILY MEMBERS</Text>
      <View style={styles.sectionRule} />
      {family.map((c) => (
        <CharacterCard
          key={c.id}
          character={c}
          selected={c.id === selectedCharacterId}
          onPress={() => onPressCharacter(c.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 12,
    color: COLORS.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
    marginHorizontal: SPACING.md,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sectionRule: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
});
