// Curia Tab Redesign, Chunk C2 — stub. Chunk C5 replaces this with the real
// patronage-act cards — see plans/curia-redesign.md.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';

export default function MunificentiaView() {
  return (
    <View style={styles.stub}>
      <Text style={styles.heading}>MUNIFICENTIA</Text>
      <Text style={styles.body}>Acts of patronage — coming in Chunk C5.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stub: { padding: SPACING.md },
  heading: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 16 },
  body: { color: COLORS.dust, fontFamily: FONTS.body, fontSize: 12, marginTop: SPACING.sm },
});
