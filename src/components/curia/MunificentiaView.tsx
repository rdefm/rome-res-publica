// Curia Tab Redesign, Chunk C5 — real content, replacing the C2 stub. Keeps
// the framing quote and the decaying grandGamesVoteBonus note above the
// list, same as the pre-redesign screen.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { MUNIFICENCE_ACTS } from '../../data/munificence';
import PatronageCard from './PatronageCard';

export default function MunificentiaView() {
  const grandGamesVoteBonus = useGameStore(s => s.grandGamesVoteBonus);

  return (
    <View style={styles.wrap}>
      <Text style={styles.framing}>“What Rome is given, Rome remembers.”</Text>
      {grandGamesVoteBonus > 0 && (
        <Text style={styles.bonusNote}>
          Rome still remembers your games: +{grandGamesVoteBonus} votes at the next election, fading with the years.
        </Text>
      )}
      {MUNIFICENCE_ACTS.map(act => (
        <PatronageCard key={act.id} act={act} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACING.md },
  framing: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  bonusNote: {
    color: COLORS.laurel,
    fontFamily: FONTS.body,
    fontSize: 11,
    marginBottom: SPACING.sm,
  },
});
