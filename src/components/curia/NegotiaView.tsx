// Curia Tab Redesign, Chunk C2 — stub. Chunk C4 replaces this with the real
// three-surface view (trials, war & peace, The Command) and moves trials
// back to Curia — see plans/curia-redesign.md.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

export default function NegotiaView() {
  return (
    <View style={styles.stub}>
      <Text style={styles.heading}>NEGOTIA</Text>
      <Text style={styles.body}>Trials, war &amp; peace, and The Command — coming in Chunk C4.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stub: { padding: SPACING.md },
  heading: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 16 },
  body: { color: COLORS.dust, fontFamily: FONTS.body, fontSize: 12, marginTop: SPACING.sm },
});
