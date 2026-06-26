import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../../utils/theme';

// Icon asset map — white silhouettes, tinted at render time.
// icon-tab-provinciae.png is NOT imported — Provinciae tab is not yet implemented.
const TAB_ICONS: Record<string, ReturnType<typeof require>> = {
  Domus:    require('../../assets/images/icon-tab-domus.png'),
  Forum:    require('../../assets/images/icon-tab-forum.png'),
  Cursus:   require('../../assets/images/icon-tab-cursus.png'),
  Curia:    require('../../assets/images/icon-tab-curia.png'),
  Provinciae: require('../../assets/images/icon-tab-provinciae.png'),
};

export function renderTabIcon(label: string, focused: boolean): JSX.Element {
  const icon = TAB_ICONS[label];
  return (
    <View style={styles.iconWrapper}>
      {focused && <View style={styles.focusBar} />}
      {icon ? (
        <Image
          source={icon}
          style={[styles.tabIcon, { tintColor: focused ? COLORS.gold : COLORS.dust }]}
        />
      ) : (
        // Fallback if asset missing — renders a dot so the tab still works
        <Text style={{ color: focused ? COLORS.gold : COLORS.dust, fontSize: 20 }}>●</Text>
      )}
    </View>
  );
}

export function renderTabLabel(label: string, focused: boolean): JSX.Element {
  return (
    <Text style={[styles.tabLabel, { color: focused ? COLORS.gold : COLORS.dust }]}>
      {label.toUpperCase()}
    </Text>
  );
}

export const tabBarStyle = {
  backgroundColor: '#1a1410',
  borderTopWidth: 2,
  borderTopColor: COLORS.border,
  paddingBottom: 8,
  height: 70,
};

const styles = StyleSheet.create({
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusBar: {
    position: 'absolute',
    top: -8,
    height: 2,
    width: '60%',
    backgroundColor: COLORS.gold,
    alignSelf: 'center',
  },
  tabIcon: {
    width: 24,
    height: 24,
  },
  tabLabel: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
