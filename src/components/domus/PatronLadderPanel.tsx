import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { PATRON_TIER_DEFINITIONS } from '../../models/patronLadder';
import { MUNIFICENCE_ACTS } from '../../data/munificence';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

// ─── Tier icons (stylised fasces, scaling with tier) ─────────────────────────

const TIER_ICONS = ['○', '◎', '◉', '⦿', '❋', '✦'];

// ─── Stub action labels ───────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  sponsor_client:       'Sponsor Client',
  offer_protection:     'Offer Protection',
  command_client_vote:  'Command Vote',
  absorb_client_family: 'Absorb Family',
  dictate_alliance:     'Dictate Alliance',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatronLadderPanel() {
  const { patronTier, lifetimeDignitas, clients } = useGameStore();
  const [expanded, setExpanded] = useState(true);

  const tierDef = PATRON_TIER_DEFINITIONS[patronTier];
  const nextTierDef = patronTier < 5 ? PATRON_TIER_DEFINITIONS[patronTier + 1] : null;

  const clientSlots = tierDef.passiveBonus.clientSlots;
  const clientCount = clients.length;

  // Progress toward next tier — gated by Lifetime Dignitas alone (P2-B).
  // Spending Fides can never cost you a tier, so there's no Fides requirement to show.
  const dignitasPct = nextTierDef
    ? Math.min(1, lifetimeDignitas / nextTierDef.requiresDignitasTotal)
    : 1;

  return (
    <View style={styles.container}>
      {/* Header row — always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.75}
      >
        <View style={styles.headerLeft}>
          <View style={styles.tierRow}>
            <Text style={styles.tierIcon}>{TIER_ICONS[patronTier]}</Text>
            <Text style={styles.tierLabel}>{tierDef.label}</Text>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>TIER {patronTier}</Text>
            </View>
          </View>
          <Text style={styles.flavour} numberOfLines={1}>{tierDef.flavourText}</Text>
        </View>
        <View style={styles.slotsWrap}>
          <Text style={styles.slotsNum}>{clientCount}/{clientSlots}</Text>
          <Text style={styles.slotsLabel}>clients</Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Progress toward next tier */}
          {nextTierDef ? (
            <View style={styles.progressSection}>
              <Text style={styles.progressHeading}>
                PROGRESS TO "{nextTierDef.label.toUpperCase()}"
              </Text>

              {/* Lifetime Dignitas bar */}
              <View style={styles.progressRow}>
                <Text style={styles.progressLabel}>Lifetime Dignitas</Text>
                <Text style={styles.progressVal}>
                  {lifetimeDignitas} / {nextTierDef.requiresDignitasTotal}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.trackFill, {
                  width: `${dignitasPct * 100}%`,
                  backgroundColor: COLORS.lifetimeDignColor,
                }]} />
              </View>
            </View>
          ) : (
            <View style={styles.progressSection}>
              <Text style={styles.maxTier}>Maximum tier reached. Rome bends to your name.</Text>
            </View>
          )}

          {/* Passive bonuses */}
          <View style={styles.bonusSection}>
            <Text style={styles.bonusHeading}>PATRON BONUSES</Text>
            <Text style={styles.bonusLine}>
              ◈ {clientSlots} client slot{clientSlots !== 1 ? 's' : ''}
            </Text>
            <Text style={styles.bonusLine}>
              ◈ ×{tierDef.passiveBonus.fidesMultiplier.toFixed(2)} Fides income
            </Text>
            {tierDef.passiveBonus.incomingFavourChance > 0 && (
              <Text style={styles.bonusLine}>
                ◈ {Math.round(tierDef.passiveBonus.incomingFavourChance * 100)}% chance per client of favour call-in (−10 Fides each)
              </Text>
            )}
          </View>

          {/* Unlocked patron actions */}
          {tierDef.unlockedActions.length > 0 && (
            <View style={styles.actionsSection}>
              <Text style={styles.actionsHeading}>PATRON ACTIONS</Text>
              <View style={styles.actionsRow}>
                {tierDef.unlockedActions.map(actionId => (
                  <TouchableOpacity
                    key={actionId}
                    style={styles.actionStub}
                    disabled
                    activeOpacity={0.6}
                  >
                    <Text style={styles.actionStubLabel}>
                      {ACTION_LABELS[actionId] ?? actionId}
                    </Text>
                    <Text style={styles.actionStubSoon}>Soon</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Munificence acts unlocked at this tier and the next (P2-F) — full
              Munificence panel lives on Curia; this is a cross-link, not the acts themselves. */}
          {(() => {
            const unlockedHere = MUNIFICENCE_ACTS.filter(a => (a.requirements.minPatronTier ?? 0) === patronTier);
            const unlockedNext = nextTierDef
              ? MUNIFICENCE_ACTS.filter(a => a.requirements.minPatronTier === nextTierDef.tier)
              : [];
            if (unlockedHere.length === 0 && unlockedNext.length === 0) return null;
            return (
              <View style={styles.actionsSection}>
                <Text style={styles.actionsHeading}>MUNIFICENCE ACTS</Text>
                {unlockedHere.length > 0 && (
                  <Text style={styles.munificenceLine}>
                    Unlocked now: {unlockedHere.map(a => a.name).join(', ')}
                  </Text>
                )}
                {unlockedNext.length > 0 && (
                  <Text style={styles.munificenceLineMuted}>
                    At {nextTierDef!.label}: {unlockedNext.map(a => a.name).join(', ')}
                  </Text>
                )}
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  headerLeft: { flex: 1 },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 3,
  },
  tierIcon: {
    color: COLORS.gold,
    fontSize: 18,
  },
  tierLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  tierBadge: {
    backgroundColor: COLORS.gold + '22',
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
  },
  tierBadgeText: {
    color: COLORS.gold,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
  },
  flavour: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
  },
  slotsWrap: {
    alignItems: 'center',
    minWidth: 44,
  },
  slotsNum: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '700',
  },
  slotsLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  chevron: {
    color: COLORS.dust,
    fontSize: 12,
  },

  // ── Body ───────────────────────────────────────────────────────────────────
  body: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },

  // ── Progress ───────────────────────────────────────────────────────────────
  progressSection: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  progressHeading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  progressLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  progressVal: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  },
  track: {
    height: 5,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  maxTier: {
    color: COLORS.gold,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
  },

  // ── Bonuses ────────────────────────────────────────────────────────────────
  bonusSection: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bonusHeading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  bonusLine: {
    color: COLORS.laurel,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginBottom: 3,
  },

  // ── Actions ────────────────────────────────────────────────────────────────
  actionsSection: {
    padding: SPACING.md,
  },
  actionsHeading: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionStub: {
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    opacity: 0.55,
    alignItems: 'center',
  },
  actionStubLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
  },
  actionStubSoon: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 9,
    marginTop: 1,
  },

  // ── Munificence cross-link (P2-F) ────────────────────────────────────────────
  munificenceLine: {
    color: COLORS.laurel,
    fontFamily: FONTS.body,
    fontSize: 11,
    lineHeight: 16,
  },
  munificenceLineMuted: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});
