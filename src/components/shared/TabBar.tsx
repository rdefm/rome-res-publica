import React from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { COLORS, FONTS } from '../../utils/theme';

const TAB_ICONS: Record<string, ReturnType<typeof require>> = {
  Domus:      require('../../assets/images/icon-tab-domus.png'),
  Forum:      require('../../assets/images/icon-tab-forum.png'),
  Cursus:     require('../../assets/images/icon-tab-cursus.png'),
  Curia:      require('../../assets/images/icon-tab-curia.png'),
  Provinciae: require('../../assets/images/icon-tab-provinciae.png'),
};

const MARBLE_BG = require('../../assets/images/marble_rectangle.png');

// Rendered once as tabBarBackground — covers the full bar width at exactly the right height
export function TabBarBackground({ height }: { height: number }): JSX.Element {
  const { width } = useWindowDimensions();
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Image
        source={MARBLE_BG}
        style={{ width, height, position: 'absolute', top: 0, left: 0 }}
        resizeMode="cover"
      />
      <View style={bg.topBorder} />
    </View>
  );
}

/** Campaign Map plan, Chunk C7 — `badge` is a small dot on the icon corner,
 *  used by Provinciae to flag unseen campaign activity (a season's log the
 *  player hasn't watched/skipped yet). No other tab uses this yet — first
 *  per-tab badge in this codebase, so kept generic rather than Provinciae-
 *  specific in case a future tab wants the same treatment. */
export function renderTabIcon(label: string, focused: boolean, badge?: boolean): JSX.Element {
  const icon = TAB_ICONS[label];
  const tint = focused ? COLORS.crimson : '#9a8060';

  return (
    <View style={styles.tabItem}>
      {focused && <View style={styles.focusBar} />}
      <View>
        {icon ? (
          <Image source={icon} style={[styles.tabIcon, { tintColor: tint }]} />
        ) : (
          <Text style={{ color: tint, fontSize: 18 }}>●</Text>
        )}
        {badge && <View style={styles.badgeDot} />}
      </View>
      <Text style={[styles.tabLabel, { color: tint }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function renderTabLabel(): null {
  return null;
}

export const tabBarStyle = {
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  height: 70,
  paddingBottom: 0,
  paddingTop: 0,
  elevation: 0,
};

const bg = StyleSheet.create({
  topBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: COLORS.border,
  },
});

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: 'transparent',
  },
  focusBar: {
    position: 'absolute',
    top: 0,
    left: '15%',
    right: '15%',
    height: 2,
    backgroundColor: COLORS.crimson,
  },
  tabIcon: {
    width: 32,
    height: 32,
    marginBottom: 3,
  },
  badgeDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.crimson,
    borderWidth: 1,
    borderColor: '#1a1714',
  },
  tabLabel: {
    fontFamily: FONTS.display,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
