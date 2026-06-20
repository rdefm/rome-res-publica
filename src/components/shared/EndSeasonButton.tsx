import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS, END_SEASON_BAR_HEIGHT } from '../../utils/theme';

export default function EndSeasonButton() {
  const { endSeason, seasonOverlayVisible } = useGameStore();

  return (
    <TouchableOpacity
      style={[styles.btn, seasonOverlayVisible && styles.btnDisabled]}
      onPress={endSeason}
      disabled={seasonOverlayVisible}
      activeOpacity={0.7}
    >
      <Text style={styles.label}>END SEASON</Text>
      <Text style={styles.sub}>Process Year</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: END_SEASON_BAR_HEIGHT,
    backgroundColor: COLORS.crimson,
    borderTopColor: '#6b1414',
    borderTopWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  label: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  sub: {
    color: '#c09090',
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: 1,
  },
});
