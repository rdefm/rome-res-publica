import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getCrisisColour } from '../../engine/crisisEngine';
import SettingsModal from './SettingsModal';
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../../utils/theme';

const RESOURCE_ICONS = {
  dignitas: require('../../assets/images/icon-dignitas.png'),
  gratia:   require('../../assets/images/icon-gratia.png'),
  denarii:  require('../../assets/images/icon-denarii.png'),
  gravitas: require('../../assets/images/icon-gravitas.png'),
};

const RESOURCE_TINTS = {
  dignitas: COLORS.dignitasColor,
  gratia:   COLORS.gratiaColor,
  denarii:  COLORS.denariiColor,
  gravitas: COLORS.marble,
};

function ResourceItem({ value, tintColor, icon }: {
  value: number;
  tintColor: string;
  icon: ReturnType<typeof require>;
}) {
  return (
    <View style={styles.resourceItem}>
      <Image source={icon} style={[styles.resourceIcon, { tintColor }]} />
      <Text style={[styles.resourceValue, { color: tintColor }]}>{value}</Text>
    </View>
  );
}

export default function ResourceBar() {
  const {
    gravitas, dignitas, gratia, denarii,
    crisisLevel, year, seasonIndex,
    endSeason, seasonOverlayVisible,
  } = useGameStore();
  const insets = useSafeAreaInsets();
  const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top }]}>

        {/* Left — gear */}
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.gearBtn}
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>

        {/* Centre — resources */}
        <View style={styles.resources}>
          <ResourceItem value={dignitas} icon={RESOURCE_ICONS.dignitas} tintColor={RESOURCE_TINTS.dignitas} />
          <ResourceItem value={gratia}   icon={RESOURCE_ICONS.gratia}   tintColor={RESOURCE_TINTS.gratia} />
          <ResourceItem value={denarii}  icon={RESOURCE_ICONS.denarii}  tintColor={RESOURCE_TINTS.denarii} />
          <ResourceItem value={gravitas} icon={RESOURCE_ICONS.gravitas} tintColor={RESOURCE_TINTS.gravitas} />
        </View>

        {/* Right — single unified box: date on left, divider, END SEASON on right */}
        <TouchableOpacity
          style={[styles.endBox, seasonOverlayVisible && styles.endBoxDisabled]}
          onPress={endSeason}
          disabled={seasonOverlayVisible}
          activeOpacity={0.75}
        >
          {/* Date column */}
          <View style={styles.dateCol}>
            <Text style={styles.yearText}>{Math.abs(year)} BC</Text>
            <Text style={styles.seasonText}>{SEASON_NAMES[seasonIndex].toUpperCase()}</Text>
          </View>

          {/* Vertical divider */}
          <View style={styles.divider} />

          {/* End Season label */}
          <Text style={styles.endText}>END{'\n'}SEASON</Text>
        </TouchableOpacity>

      </View>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(15, 10, 8, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    minHeight: RESOURCE_BAR_HEIGHT,
  },
  gearBtn: {
    marginRight: SPACING.sm,
  },
  gearIcon: {
    fontSize: 18,
  },
  resources: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  resourceItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourceIcon: {
    width: 20,
    height: 20,
    marginBottom: 1,
  },
  resourceValue: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Single unified rectangle — date | divider | END SEASON
  endBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a2a0e',
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 8,
  },
  endBoxDisabled: {
    opacity: 0.4,
  },
  dateCol: {
    alignItems: 'center',
  },
  yearText: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 0.5,
  },
  seasonText: {
    fontFamily: FONTS.display,
    fontSize: 9,
    color: COLORS.marble,
    letterSpacing: 1,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
  },
  endText: {
    fontFamily: FONTS.display,
    fontSize: 10,
    color: COLORS.marble,
    letterSpacing: 2,
    textAlign: 'center',
    lineHeight: 14,
  },
});
