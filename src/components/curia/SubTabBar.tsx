// Curia Tab Redesign, Chunk C2 — the three-way LEGES/NEGOTIA/MUNIFICENTIA
// switch. ≤44pt tall (§5's budget).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS, stoneTab, stoneTabActive, emberGlow } from '../../utils/theme';
import type { CuriaSubTab } from '../../models/curia';

interface SubTabBarProps {
  active: CuriaSubTab;
  onChange: (tab: CuriaSubTab) => void;
  /** Item count for NEGOTIA; 0 hides the badge. */
  negotiaCount: number;
  /** Renders the badge in critical styling. */
  negotiaCritical: boolean;
}

const TABS: { id: CuriaSubTab; label: string; subtitle: string }[] = [
  { id: 'leges',        label: 'LEGES',        subtitle: 'Laws' },
  { id: 'negotia',      label: 'NEGOTIA',      subtitle: 'Affairs of State' },
  { id: 'munificentia', label: 'MUNIFICENTIA', subtitle: 'Patronage' },
];

export default function SubTabBar({ active, onChange, negotiaCount, negotiaCritical }: SubTabBarProps) {
  return (
    <View style={styles.row}>
      {TABS.map(t => {
        const isActive = t.id === active;
        return (
          <TouchableOpacity
            key={t.id}
            onPress={() => onChange(t.id)}
            activeOpacity={0.8}
            style={[styles.tab, { backgroundColor: isActive ? stoneTabActive : stoneTab }]}
          >
            <View style={styles.labelRow}>
              <Text style={[styles.label, isActive && styles.labelActive]}>{t.label}</Text>
              {t.id === 'negotia' && negotiaCount > 0 && (
                <View style={[styles.badge, negotiaCritical && styles.badgeCritical]}>
                  <Text style={styles.badgeText}>{negotiaCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.subtitle, isActive && styles.subtitleActive]}>{t.subtitle}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    height: 44,
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  tab: {
    flex: 1,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: COLORS.dust,
    fontFamily: FONTS.display,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  labelActive: {
    color: COLORS.gold,
  },
  subtitle: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 8,
    opacity: 0.8,
  },
  subtitleActive: {
    color: COLORS.marble,
  },
  badge: {
    backgroundColor: COLORS.goldDim,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCritical: {
    backgroundColor: emberGlow,
  },
  badgeText: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 9,
    fontWeight: '700',
  },
});
