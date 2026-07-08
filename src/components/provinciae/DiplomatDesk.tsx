import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import InfoTap from '../shared/InfoTap';
import type { ProvinceState, AmbassadorState } from '../../models/province';
import type { AmbassadorActionId } from '../../engine/provinceEngine';

// ─── Action Definitions ───────────────────────────────────────────────────────

interface ActionDef {
  id: AmbassadorActionId;
  label: string;
  cost: string;
  costResource: 'fides' | 'denarii';
  costAmount: number;
  description: string;
  requiresSupport?: number;
}

const AMBASSADOR_ACTIONS: ActionDef[] = [
  {
    id: 'build_rapport',
    label: 'Build Personal Rapport',
    cost: '15 Fides',
    costResource: 'fides',
    costAmount: 15,
    description: '+4 Relationship · +5 Local Support · +4 Personal Rapport',
  },
  {
    id: 'grain_dole',
    label: 'Grain Dole to Local Poor',
    cost: '25 Gold',
    costResource: 'denarii',
    costAmount: 25,
    description: '+6 Relationship · +8 Local Support (one-time bonus)',
  },
  {
    id: 'intelligence_gathering',
    label: 'Intelligence Gathering',
    cost: '10 Fides',
    costResource: 'fides',
    costAmount: 10,
    description: 'Reveals one NPC intelligence slot. Usable as Forum blackmail.',
  },
  {
    id: 'seek_local_client',
    label: 'Seek Local Client',
    cost: '20 Fides',
    costResource: 'fides',
    costAmount: 20,
    description: 'Attempt to recruit a Provincial Client. Requires Local Support threshold.',
    requiresSupport: 30,
  },
  {
    id: 'cultural_exchange',
    label: 'Arrange Cultural Exchange',
    cost: '15 Fides',
    costResource: 'fides',
    costAmount: 15,
    description: 'Queues a region-specific event card. +Local Support.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface DiplomatDeskProps {
  province: ProvinceState;
  ambassador: AmbassadorState;
  playerFides: number;
  playerDenarii: number;
  onAction: (actionId: AmbassadorActionId) => void;
}

export default function DiplomatDesk({
  province,
  ambassador,
  playerFides,
  playerDenarii,
  onAction,
}: DiplomatDeskProps) {

  function canAfford(action: ActionDef): boolean {
    if (action.costResource === 'fides') return playerFides >= action.costAmount;
    return playerDenarii >= action.costAmount;
  }

  function meetsSupport(action: ActionDef): boolean {
    if (!action.requiresSupport) return true;
    return province.localSupport >= action.requiresSupport;
  }

  function isUsedThisTurn(actionId: string): boolean {
    return ambassador.actionsUsedThisTurn.includes(actionId);
  }

  // Rapport bar
  const rapportPct = (ambassador.personalRapport / 50) * 100;

  return (
    <View style={styles.desk}>
      {/* Rapport & Intel header */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>PERSONAL RAPPORT</Text>
          <View style={styles.barBg}>
            <View style={[styles.barFill, styles.barRapport, { width: `${rapportPct}%` }]} />
          </View>
          <Text style={styles.statValue}>{ambassador.personalRapport} / 50</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>INTELLIGENCE</Text>
          <View style={styles.intelDots}>
            {Array.from({ length: 6 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.intelDot,
                  i < ambassador.intelRevealed ? styles.intelDotRevealed : styles.intelDotHidden,
                ]}
              />
            ))}
          </View>
          <Text style={styles.statValue}>{ambassador.intelRevealed} / 6 revealed</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Action tray */}
      <InfoTap termId="ambassador">
        <Text style={styles.sectionTitle}>AVAILABLE ACTIONS</Text>
      </InfoTap>
      <Text style={styles.sectionSubtitle}>One action per season. Used actions are locked until next season.</Text>

      {AMBASSADOR_ACTIONS.map(action => {
        const used = isUsedThisTurn(action.id);
        const affordable = canAfford(action);
        const supported = meetsSupport(action);
        const enabled = !used && affordable && supported;

        return (
          <TouchableOpacity
            key={action.id}
            style={[
              styles.actionRow,
              !enabled && styles.actionRowDisabled,
              used && styles.actionRowUsed,
            ]}
            onPress={() => enabled && onAction(action.id)}
            disabled={!enabled}
            activeOpacity={0.75}
          >
            <View style={styles.actionLeft}>
              <Text style={[styles.actionLabel, !enabled && styles.actionLabelDim]}>
                {action.label}
              </Text>
              <Text style={styles.actionDesc}>
                {!supported
                  ? `Requires ${action.requiresSupport} Local Support (have ${province.localSupport})`
                  : !affordable && !used
                  ? `Insufficient ${action.costResource === 'fides' ? 'Fides' : 'Gold'}`
                  : used
                  ? 'Used this season'
                  : action.description
                }
              </Text>
            </View>
            <View style={[styles.costBadge, !affordable && styles.costBadgeDim]}>
              <Text style={[styles.costText, !affordable && styles.costTextDim]}>
                {action.cost}
              </Text>
            </View>
            {!used && enabled && (
              <View style={styles.useButton}>
                <Text style={styles.useButtonText}>USE</Text>
              </View>
            )}
            {used && (
              <View style={styles.usedBadge}>
                <Text style={styles.usedText}>✓</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Posting info */}
      <View style={styles.postingInfo}>
        <Text style={styles.postingText}>
          Season {ambassador.turnsServed % 4 + 1} of 4 · Reappointment required after year's end
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  desk: {
    padding: SPACING.md,
  } as ViewStyle,

  statsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  } as ViewStyle,

  statBlock: {
    flex: 1,
  } as ViewStyle,

  statLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 4,
  } as TextStyle,

  statValue: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
  } as TextStyle,

  barBg: {
    height: 6,
    backgroundColor: '#2a2018',
    borderRadius: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  } as ViewStyle,

  barFill: {
    height: '100%',
    borderRadius: 3,
  } as ViewStyle,

  barRapport: {
    backgroundColor: COLORS.senatBlue,
  } as ViewStyle,

  intelDots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  } as ViewStyle,

  intelDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  } as ViewStyle,

  intelDotRevealed: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  } as ViewStyle,

  intelDotHidden: {
    backgroundColor: 'transparent',
    borderColor: COLORS.border,
  } as ViewStyle,

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.md,
  } as ViewStyle,

  sectionTitle: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: '700',
    marginBottom: 2,
  } as TextStyle,

  sectionSubtitle: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: SPACING.md,
    opacity: 0.8,
  } as TextStyle,

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2218',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  } as ViewStyle,

  actionRowDisabled: {
    opacity: 0.55,
  } as ViewStyle,

  actionRowUsed: {
    opacity: 0.4,
    borderStyle: 'dashed',
  } as ViewStyle,

  actionLeft: {
    flex: 1,
  } as ViewStyle,

  actionLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginBottom: 2,
  } as TextStyle,

  actionLabelDim: {
    color: COLORS.dust,
  } as TextStyle,

  actionDesc: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    lineHeight: 14,
  } as TextStyle,

  costBadge: {
    backgroundColor: '#1a1410',
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.goldDim,
  } as ViewStyle,

  costBadgeDim: {
    borderColor: COLORS.border,
  } as ViewStyle,

  costText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,

  costTextDim: {
    color: COLORS.dust,
  } as TextStyle,

  useButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  } as ViewStyle,

  useButtonText: {
    color: '#1a1410',
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  } as TextStyle,

  usedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.laurel,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  usedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  } as TextStyle,

  postingInfo: {
    marginTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  } as ViewStyle,

  postingText: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
  } as TextStyle,
});
