import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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

interface ResourceItemProps {
  value: number;
  tintColor: string;
  icon: ReturnType<typeof require>;
}

function ResourceItem({ value, tintColor, icon }: ResourceItemProps) {
  return (
    <View style={styles.resourceItem}>
      <Image source={icon} style={[styles.resourceIcon, { tintColor }]} />
      <Text style={[styles.resourceValue, { color: tintColor }]}>{value}</Text>
    </View>
  );
}

export default function ResourceBar() {
  const { gravitas, dignitas, gratia, denarii, crisisLevel, year, seasonIndex } = useGameStore();
  const insets = useSafeAreaInsets();
  const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const crisisColor = getCrisisColour(crisisLevel);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          onPress={() => setSettingsOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.gearBtn}
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>

        <View style={styles.resources}>
          <ResourceItem value={dignitas} icon={RESOURCE_ICONS.dignitas} tintColor={RESOURCE_TINTS.dignitas} />
          <ResourceItem value={gratia}   icon={RESOURCE_ICONS.gratia}   tintColor={RESOURCE_TINTS.gratia} />
          <ResourceItem value={denarii}  icon={RESOURCE_ICONS.denarii}  tintColor={RESOURCE_TINTS.denarii} />
          <ResourceItem value={gravitas} icon={RESOURCE_ICONS.gravitas} tintColor={RESOURCE_TINTS.gravitas} />
        </View>

        <View style={styles.rightSection}>
          <Text style={styles.yearText}>{Math.abs(year)} BC</Text>
          <Text style={styles.seasonText}>{seasonNames[seasonIndex]}</Text>
          <View style={[styles.crisisDot, { backgroundColor: crisisColor }]} />
        </View>
      </View>

      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: 'rgba(15, 10, 8, 0.75)',
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
    alignItems: 'center',   // icon centred above number
    justifyContent: 'center',
  },
  resourceIcon: {
    width: 24,
    height: 24,
    marginBottom: 1,
  },
  resourceValue: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontSize: 13,
    fontWeight: 'bold',
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  yearText: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
  },
  seasonText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  crisisDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
});
