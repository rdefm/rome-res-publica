import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Image, Dimensions } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { COLORS, FONTS } from '../../utils/theme';

const MARBLE_BG = require('../../assets/images/btn-end-season-bg.png');

// Image is 949×263 — render at 70% screen width (down from 85%)
const SCREEN_WIDTH = Dimensions.get('window').width;
const BTN_WIDTH    = Math.round(SCREEN_WIDTH * 0.70);
const BTN_HEIGHT   = Math.round(BTN_WIDTH * (263 / 949));

export default function EndSeasonButton() {
  const { endSeason, seasonOverlayVisible } = useGameStore();

  return (
    <View style={styles.floatWrapper}>
      <TouchableOpacity
        style={[styles.button, seasonOverlayVisible && styles.disabled]}
        onPress={endSeason}
        disabled={seasonOverlayVisible}
        activeOpacity={0.75}
      >
        <Image
          source={MARBLE_BG}
          style={styles.bgImage}
          resizeMode="stretch"
        />
        <View style={styles.content}>
          <Text style={styles.label}>END SEASON</Text>
          <Text style={styles.sub}>Process Year</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrapper: {
    position: 'absolute',
    bottom: 12,                              // lower — closer to tab bar
    width: BTN_WIDTH,
    left: (SCREEN_WIDTH - BTN_WIDTH) / 2,
    // No shadow properties at all
  },
  button: {
    width: BTN_WIDTH,
    height: BTN_HEIGHT,
  },
  disabled: {
    opacity: 0.4,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BTN_WIDTH,
    height: BTN_HEIGHT,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
    letterSpacing: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sub: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 10,
    color: COLORS.dust,
    letterSpacing: 1,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
