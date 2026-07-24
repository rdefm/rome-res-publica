/**
 * LaneCard — read-only display of one lane's WingState during a battle
 * (round-resolution view). Deployment has its own inline lane rendering in
 * DeploymentBoard.tsx (tap-to-assign needs different affordances than a
 * pure status display).
 *
 * "Ugly-but-clear" per the M5 spec — no animation, no modifier-stack
 * numbers shown (invariant 6): unit chips, formation label, captain name,
 * a morale bar, and status badges (broken/flanked/overextended).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { WingState, UnitClass } from '../../models/battle';

const CLASS_LABEL: Record<UnitClass, string> = {
  legionary: 'Legionary',
  spear_foot: 'Spear',
  skirmisher: 'Skirmisher',
  cavalry_heavy: 'Heavy Cav',
  cavalry_light: 'Light Cav',
  elephant: 'Elephant',
};

const FORMATION_LABEL: Record<string, string> = {
  line: 'Line',
  wedge: 'Wedge',
  shield_wall: 'Shield Wall',
  open_ranks: 'Open Ranks',
  feigned_retreat: 'Feigned Retreat',
};

interface LaneCardProps {
  label: string;
  wing: WingState;
  captainName?: string | null;
  isCommanderHere?: boolean;
}

export default function LaneCard({ label, wing, captainName, isCommanderHere }: LaneCardProps) {
  const totalStrength = wing.units.reduce((s, u) => s + u.strength, 0);
  const moralePct = Math.max(0, Math.min(100, wing.moralePool));
  const moraleColor = wing.broken ? COLORS.crimson : moralePct < 30 ? '#c07030' : COLORS.laurel;

  return (
    <View style={[styles.card, wing.broken && styles.cardBroken]}>
      <Text style={styles.laneLabel}>{label}</Text>
      <Text style={styles.formation}>{FORMATION_LABEL[wing.formation] ?? wing.formation}</Text>

      {wing.units.length === 0 ? (
        <Text style={styles.empty}>{wing.broken ? 'Conceded' : 'Empty'}</Text>
      ) : (
        <View style={styles.chips}>
          {wing.units.map(u => (
            <View key={u.id} style={styles.chip}>
              <Text style={styles.chipText}>{CLASS_LABEL[u.unitClass]} {Math.round(u.strength)}%</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.moraleRow}>
        <View style={styles.moraleTrack}>
          <View style={[styles.moraleFill, { width: `${moralePct}%`, backgroundColor: moraleColor }]} />
        </View>
        <Text style={styles.moraleValue}>{Math.round(moralePct)}</Text>
      </View>

      <Text style={styles.captain}>
        {captainName ? `⚔ ${captainName}${isCommanderHere ? ' (commander)' : ''}` : '— unled —'}
      </Text>

      {(wing.broken || wing.flanked || wing.overextended) && (
        <View style={styles.badges}>
          {wing.broken && <Text style={styles.badgeBroken}>BROKEN</Text>}
          {wing.flanked && <Text style={styles.badgeWarn}>FLANKED</Text>}
          {wing.overextended && <Text style={styles.badgeWarn}>OVEREXTENDED</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    minHeight: 140,
  },
  cardBroken: {
    borderColor: COLORS.crimson,
    opacity: 0.7,
  },
  laneLabel: {
    fontFamily: FONTS.display,
    fontSize: 11,
    color: COLORS.gold,
    letterSpacing: 1,
  },
  formation: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.dust,
    marginBottom: SPACING.xs,
  },
  empty: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    color: COLORS.dust,
    marginVertical: SPACING.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: SPACING.xs,
  },
  chip: {
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  chipText: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.marble,
  },
  moraleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: SPACING.xs,
  },
  moraleTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.panelElevated,
    overflow: 'hidden',
  },
  moraleFill: {
    height: '100%',
  },
  moraleValue: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.dust,
    width: 20,
    textAlign: 'right',
  },
  captain: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 10,
    color: COLORS.marble,
    marginTop: SPACING.xs,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: SPACING.xs,
  },
  badgeBroken: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.crimson,
  },
  badgeWarn: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    fontWeight: '700',
    color: '#c07030',
  },
});
