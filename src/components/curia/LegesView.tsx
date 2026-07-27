// Curia Tab Redesign, Chunk C2 — stub. Chunk C3 replaces this with the real
// bill list/active laws (BillCard, LawCard, etc.) — see plans/curia-redesign.md.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';

export default function LegesView() {
  // Curia Tab Redesign, Chunk C2 — plumbing only. curiaBillTargetRequest
  // carries the billId a deep-link wants scrolled-to/highlighted; this stub
  // has no scrollable bill list yet, so it just clears the request rather
  // than acting on it. Chunk C3's real LegesView is what actually scrolls.
  const curiaBillTargetRequest = useGameStore(s => s.curiaBillTargetRequest);
  const requestCuriaBillTarget = useGameStore(s => s.requestCuriaBillTarget);
  useEffect(() => {
    if (curiaBillTargetRequest) requestCuriaBillTarget(null);
  }, [curiaBillTargetRequest]);

  return (
    <View style={styles.stub}>
      <Text style={styles.heading}>LEGES</Text>
      <Text style={styles.body}>Bills and active laws — coming in Chunk C3.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stub: { padding: SPACING.md },
  heading: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 16 },
  body: { color: COLORS.dust, fontFamily: FONTS.body, fontSize: 12, marginTop: SPACING.sm },
});
