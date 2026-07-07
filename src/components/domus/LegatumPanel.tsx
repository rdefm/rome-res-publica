import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Dimensions,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { LEGACY_DEFINITIONS } from '../../data/legacyDefinitions';
import { getNextMilestone } from '../../engine/legacyEngine';
import type { LegacyObjective } from '../../models/legacyObjective';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import InfoTap from '../shared/InfoTap';

const { height } = Dimensions.get('window');

// ─── Bonus description helper ─────────────────────────────────────────────────

function describeBonuses(bonus: LegacyObjective['milestonesReached'] extends any ? any : never): string {
  return ''; // handled inline below
}

function bonusLines(bonus: {
  flatBonus?: Record<string, number>;
  resourceMultiplier?: Record<string, number>;
  unlocksTrait?: string;
  unlocksAsset?: string;
}): string[] {
  const lines: string[] = [];
  const keyLabel: Record<string, string> = {
    gold: 'Denarii', lifetimeDignitas: 'Dignitas (Legacy)', fides: 'Fides', imperium: 'Imperium',
  };
  if (bonus.flatBonus) {
    for (const [k, v] of Object.entries(bonus.flatBonus)) {
      lines.push(`+${v} ${keyLabel[k] ?? k}/season (permanent)`);
    }
  }
  if (bonus.resourceMultiplier) {
    for (const [k, v] of Object.entries(bonus.resourceMultiplier)) {
      lines.push(`×${v} ${keyLabel[k] ?? k} income (permanent)`);
    }
  }
  if (bonus.unlocksTrait) lines.push(`Unlocks trait: ${bonus.unlocksTrait}`);
  if (bonus.unlocksAsset) lines.push(`Unlocks asset: ${bonus.unlocksAsset}`);
  return lines;
}

// ─── Full detail modal ────────────────────────────────────────────────────────

function LegatumModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { legacyObjectives } = useGameStore();

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title="LEGATUM — DYNASTIC LEGACY"
      subtitle="Permanent achievements that persist across generations."
    >
          {LEGACY_DEFINITIONS.map(def => {
            const obj = legacyObjectives.find(o => o.definitionId === def.id);
            if (!obj) return null;
            const next = getNextMilestone(obj);
            const maxThreshold = def.milestones[def.milestones.length - 1].threshold;
            const pct = Math.min(1, obj.currentValue / maxThreshold);

            return (
              <View key={def.id} style={modal.objectiveBlock}>
                <Text style={modal.objTitle}>{def.title}</Text>
                <Text style={modal.objDesc}>{def.description}</Text>

                {/* Progress bar with milestone markers */}
                <View style={modal.trackWrap}>
                  <View style={modal.track}>
                    <View style={[modal.trackFill, { width: `${pct * 100}%` }]} />
                    {def.milestones.map(ms => {
                      const markerPct = ms.threshold / maxThreshold;
                      const reached = obj.milestonesReached.includes(ms.threshold);
                      return (
                        <View
                          key={ms.threshold}
                          style={[
                            modal.marker,
                            { left: `${markerPct * 100}%` },
                            reached && modal.markerReached,
                          ]}
                        />
                      );
                    })}
                  </View>
                  <View style={modal.trackLabels}>
                    <Text style={modal.trackValue}>{obj.currentValue.toLocaleString()}</Text>
                    <Text style={modal.trackUnit}>{def.trackingUnit}</Text>
                  </View>
                </View>

                {/* Milestones */}
                {def.milestones.map(ms => {
                  const reached = obj.milestonesReached.includes(ms.threshold);
                  const lines = bonusLines(ms.permanentBonus);
                  return (
                    <View
                      key={ms.threshold}
                      style={[modal.milestone, reached && modal.milestoneReached]}
                    >
                      <View style={modal.msRow}>
                        <Text style={modal.msDot}>{reached ? '✓' : '○'}</Text>
                        <Text style={[modal.msLabel, reached && modal.msLabelReached]}>
                          {ms.label}
                        </Text>
                        <Text style={modal.msThreshold}>
                          at {ms.threshold.toLocaleString()}
                        </Text>
                      </View>
                      {lines.map((l, i) => (
                        <Text key={i} style={[modal.msBonus, reached && modal.msBonusReached]}>
                          {reached ? '✦ ' : '◇ '}{l}
                        </Text>
                      ))}
                    </View>
                  );
                })}

                {/* Next milestone hint */}
                {next && (
                  <Text style={modal.nextHint}>
                    Next: "{next.label}" in {(next.threshold - obj.currentValue).toLocaleString()} more {def.trackingUnit.toLowerCase()}
                  </Text>
                )}
                {!next && (
                  <Text style={[modal.nextHint, { color: COLORS.gold }]}>
                    All milestones reached.
                  </Text>
                )}
              </View>
            );
          })}
    </ScrollModal>
  );
}

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: 'transparent',
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
    maxHeight: height * 0.85,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  heading: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.display,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  sub: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: SPACING.md,
  },
  objectiveBlock: {
    marginBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: SPACING.md,
  },
  objTitle: {
    color: PARCHMENT.heading,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  objDesc: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginBottom: SPACING.sm,
  },
  trackWrap: {
    marginBottom: SPACING.sm,
  },
  track: {
    height: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    position: 'relative',
    marginBottom: 4,
  },
  trackFill: {
    height: '100%',
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: COLORS.border,
    marginLeft: -1,
  },
  markerReached: {
    backgroundColor: COLORS.laurel,
  },
  trackLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackValue: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  },
  trackUnit: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  milestone: {
    paddingVertical: 4,
    paddingLeft: SPACING.sm,
    opacity: 0.5,
  },
  milestoneReached: {
    opacity: 1,
  },
  msRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  msDot: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  msLabel: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  msLabelReached: {
    color: PARCHMENT.heading,
  },
  msThreshold: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  msBonus: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 11,
    marginLeft: SPACING.md,
    marginTop: 1,
  },
  msBonusReached: {
    color: COLORS.laurel,
  },
  nextHint: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    marginTop: SPACING.xs,
  },
});

// ─── Condensed inline panel ───────────────────────────────────────────────────

export default function LegatumPanel() {
  const { legacyObjectives } = useGameStore();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <View style={styles.headerRow}>
          <InfoTap termId="legatum">
            <Text style={styles.heading}>LEGATUM</Text>
          </InfoTap>
          <Text style={styles.tapHint}>tap for detail ›</Text>
        </View>

        {LEGACY_DEFINITIONS.map(def => {
          const obj = legacyObjectives.find(o => o.definitionId === def.id);
          if (!obj) return null;
          const next = getNextMilestone(obj);
          const maxThreshold = def.milestones[def.milestones.length - 1].threshold;
          const pct = Math.min(1, obj.currentValue / maxThreshold);
          const allDone = !next;

          return (
            <View key={def.id} style={styles.row}>
              {/* Title + value */}
              <View style={styles.rowLeft}>
                <Text style={styles.objName} numberOfLines={1}>{def.title}</Text>
                {next ? (
                  <Text style={styles.nextLabel} numberOfLines={1}>
                    Next: {next.label} ({(next.threshold - obj.currentValue).toLocaleString()} more)
                  </Text>
                ) : (
                  <Text style={[styles.nextLabel, { color: COLORS.gold }]}>Complete ✦</Text>
                )}
              </View>

              {/* Mini progress bar */}
              <View style={styles.miniTrackWrap}>
                <View style={styles.miniTrack}>
                  <View style={[styles.miniTrackFill, {
                    width: `${pct * 100}%`,
                    backgroundColor: allDone ? COLORS.gold : COLORS.laurel,
                  }]} />
                  {def.milestones.map(ms => {
                    const markerPct = ms.threshold / maxThreshold;
                    const reached = obj.milestonesReached.includes(ms.threshold);
                    return (
                      <View
                        key={ms.threshold}
                        style={[
                          styles.miniMarker,
                          { left: `${markerPct * 100}%` },
                          reached && styles.miniMarkerReached,
                        ]}
                      />
                    );
                  })}
                </View>
                <Text style={styles.miniValue}>{obj.currentValue.toLocaleString()}</Text>
              </View>
            </View>
          );
        })}
      </TouchableOpacity>

      <LegatumModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  heading: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  tapHint: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  rowLeft: {
    width: 130,
  },
  objName: {
    color: PARCHMENT.heading,
    fontFamily: FONTS.display,
    fontSize: 11,
    fontWeight: '600',
  },
  nextLabel: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 9,
    marginTop: 1,
  },
  miniTrackWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  miniTrack: {
    flex: 1,
    height: 5,
    backgroundColor: COLORS.bg,
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    position: 'relative',
  },
  miniTrackFill: {
    height: '100%',
    borderRadius: 2,
  },
  miniMarker: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: COLORS.border,
    marginLeft: -0.5,
  },
  miniMarkerReached: {
    backgroundColor: COLORS.gold,
  },
  miniValue: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 9,
    minWidth: 28,
    textAlign: 'right',
  },
});
