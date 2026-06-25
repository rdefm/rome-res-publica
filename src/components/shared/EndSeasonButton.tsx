import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, END_SEASON_BAR_HEIGHT } from '../../utils/theme';

export default function EndSeasonButton() {
  const { endSeason, seasonOverlayVisible } = useGameStore();

  return (
    <>
      <View style={styles.rule} />
      <TouchableOpacity
        style={[styles.button, seasonOverlayVisible && styles.buttonDisabled]}
        onPress={endSeason}
        disabled={seasonOverlayVisible}
        activeOpacity={0.85}
      >
        <Text style={styles.buttonLabel}>END SEASON</Text>
        <Text style={styles.buttonSub}>Process Year</Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  button: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: END_SEASON_BAR_HEIGHT,
    backgroundColor: COLORS.crimsonDeep,
    borderTopWidth: 2,
    borderTopColor: COLORS.crimsonDark,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.crimsonBlack,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.marble,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  buttonSub: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia-Italic' : 'serif',
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
    marginTop: 2,
  },
});
