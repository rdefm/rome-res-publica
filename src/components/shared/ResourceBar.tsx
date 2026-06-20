import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getCrisisColour } from '../../engine/crisisEngine';
import { COLORS, FONTS, SPACING, RESOURCE_BAR_HEIGHT } from '../../utils/theme';

interface ResourceItemProps {
  label: string;
  value: number;
  income?: number;
  color: string;
  icon: string;
}

function ResourceItem({ label, value, income, color, icon }: ResourceItemProps) {
  return (
    <View style={styles.resourceItem}>
      <Text style={styles.resourceIcon}>{icon}</Text>
      <View>
        <Text style={[styles.resourceValue, { color }]}>{value}</Text>
        {income !== undefined && (
          <Text style={[styles.resourceIncome, { color: income >= 0 ? COLORS.laurel : COLORS.crimson }]}>
            {income >= 0 ? `+${income}` : income}/s
          </Text>
        )}
      </View>
    </View>
  );
}

export default function ResourceBar() {
  const { gravitas, dignitas, gratia, denarii, crisisLevel, year, seasonIndex } =
    useGameStore();
  const insets = useSafeAreaInsets();
  const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter'];
  const crisisColor = getCrisisColour(crisisLevel);

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <ResourceItem label="Dignitas" value={dignitas} icon="🏺" color={COLORS.dignitasColor} />
      <ResourceItem label="Gratia"   value={gratia}   icon="🤝" color={COLORS.gratiaColor} />
      <ResourceItem label="Denarii"  value={denarii}  icon="🪙" color={COLORS.denariiColor} />
      <ResourceItem label="Gravitas" value={gravitas} icon="⚖️" color={COLORS.gravitasColor} />
      <View style={styles.rightSection}>
        <Text style={styles.yearText}>{Math.abs(year)} BC</Text>
        <Text style={styles.seasonText}>{seasonNames[seasonIndex]}</Text>
        <View style={[styles.crisisDot, { backgroundColor: crisisColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: COLORS.panelSurface,
    borderBottomColor: COLORS.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    minHeight: RESOURCE_BAR_HEIGHT,
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
  resourceIncome: {
    fontFamily: FONTS.ui,
    fontSize: 9,
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
