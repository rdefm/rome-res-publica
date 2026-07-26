import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { COLORS, FONTS } from '../../utils/theme';

// Tutorial redesign, Chunk T3 — how long the unseal ceremony's crack/fade
// flourish plays. Exported so App.tsx's TabIcon can hold `ceremonyActive`
// true for exactly this long.
export const SEAL_CEREMONY_MS = 700;

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
 *  specific in case a future tab wants the same treatment.
 *
 *  Tutorial redesign, Chunk T3 — `sealed` renders the locked-tab treatment
 *  (dimmed icon, wax-seal stamp, no focus bar/badge) for a tab the guided
 *  start hasn't unsealed yet. `ceremonyActive` overlays a brief crack/fade
 *  animation on the seal the moment it unseals — App.tsx's TabIcon detects
 *  the sealed→unsealed transition and passes this for one render window. */
export function renderTabIcon(
  label: string,
  focused: boolean,
  badge?: boolean,
  sealed?: boolean,
  ceremonyActive?: boolean,
): JSX.Element {
  const icon = TAB_ICONS[label];
  const tint = sealed ? COLORS.lockedText : focused ? COLORS.crimson : COLORS.tabInactive;

  return (
    <View style={styles.tabItem}>
      {focused && !sealed && <View style={styles.focusBar} />}
      <View>
        {icon ? (
          <Image source={icon} style={[styles.tabIcon, { tintColor: tint }]} />
        ) : (
          <Text style={{ color: tint, fontSize: 18 }}>●</Text>
        )}
        {badge && !sealed && <View style={styles.badgeDot} />}
        {sealed && (
          <View style={styles.sealStamp} pointerEvents="none">
            <View style={styles.sealStampGlyph} />
          </View>
        )}
        {ceremonyActive && <SealCrackFlourish />}
      </View>
      <Text style={[styles.tabLabel, { color: tint }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// A brief outward "crack and fade" flourish stamped over the wax seal the
// moment a tab unseals. Self-contained animated overlay so renderTabIcon
// itself can stay a plain function — this is the one piece that needs
// Reanimated's hooks.
function SealCrackFlourish(): JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: SEAL_CEREMONY_MS, easing: Easing.out(Easing.quad) });
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ scale: 1 + progress.value * 0.8 }],
  }));

  return (
    <View style={styles.sealStamp} pointerEvents="none">
      <Animated.View style={[styles.sealCrack, style]} />
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
  // Tutorial redesign, Chunk T3 — the wax-seal stamp over a sealed tab's icon.
  sealStamp: {
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealStampGlyph: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.sealWaxGrey,
    borderWidth: 1,
    borderColor: COLORS.waxFrame,
  },
  sealCrack: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.gildFrame,
  },
});
