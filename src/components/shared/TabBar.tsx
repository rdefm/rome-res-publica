import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../utils/theme';

const TAB_ICONS: Record<string, ReturnType<typeof require>> = {
  Domus:      require('../../assets/images/icon-tab-domus.png'),
  Forum:      require('../../assets/images/icon-tab-forum.png'),
  Cursus:     require('../../assets/images/icon-tab-cursus.png'),
  Curia:      require('../../assets/images/icon-tab-curia.png'),
  Provinciae: require('../../assets/images/icon-tab-provinciae.png'),
};

// renderTabIcon renders BOTH icon and label — tabBarLabel must be () => null in App.tsx
export function renderTabIcon(label: string, focused: boolean): JSX.Element {
  const icon = TAB_ICONS[label];
  const tint = focused ? COLORS.crimson : '#6a5a4a';

  return (
    <View style={styles.tabItem}>
      {focused && <View style={styles.focusBar} />}
      {icon ? (
        <Image source={icon} style={[styles.tabIcon, { tintColor: tint }]} />
      ) : (
        <Text style={{ color: tint, fontSize: 18 }}>●</Text>
      )}
      <Text style={[styles.tabLabel, { color: tint }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function renderTabLabel(): null {
  return null;
}

// tabBarStyle: transparent bg, marble is painted by App.tsx via tabBarBackground
export const tabBarStyle = {
  backgroundColor: 'transparent',
  borderTopWidth: 0,          // we'll draw our own border inside tabBarBackground
  height: 70,
  paddingBottom: 0,
  paddingTop: 0,
  elevation: 0,               // remove Android shadow so background shows cleanly
};

const styles = StyleSheet.create({
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
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
  tabLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
