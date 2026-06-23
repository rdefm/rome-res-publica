import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getCrisisColour } from '../../engine/crisisEngine';
import SettingsModal from './SettingsModal';
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../../utils/theme';

interface ResourceItemProps {
  value: number;
  color: string;
  icon: string;
}

function ResourceItem({ value, color, icon }: ResourceItemProps) {
  return (
    <View style={styles.resourceItem}>
      <Text style={styles.resourceIcon}>{icon}</Text>
      <Text style={[styles.resourceValue, { color }]}>{value}</Text>
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
          <ResourceItem value={dignitas}  icon="🏺" color={COLORS.dignitasColor} />
          <ResourceItem value={gratia}    icon="🤝" color={COLORS.gratiaColor} />
          <ResourceItem value={denarii}   icon="🪙" color={COLORS.denariiColor} />
          <ResourceItem value={gravitas}  icon="⚖️" color={COLORS.gravitasColor} />
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
    backgroundColor: COLORS.panelSurface,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resourceIcon: {
    fontSize: 14,
  },
  resourceValue: {
    fontFamily: FONTS.ui,
    fontSize: 15,
    fontWeight: '700',
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
