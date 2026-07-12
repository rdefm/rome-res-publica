import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useGameStore } from '../../state/gameStore';
import StatBar from '../shared/StatBar';
import CrisisTrackModal from '../shared/CrisisTrackModal';
import { calcRomeStatModifiers } from '../../engine/resourceEngine';
import { getCrisisStatusEffects } from '../../engine/crisisEngine';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { CrisisTrackId } from '../../models/crisis';
import HoldingsPanel from './HoldingsPanel';

// ─── Causal indicator helpers ─────────────────────────────────────────────────

/**
 * Returns a plain-text description of how Plebs Mood is contributing to the
 * Unrest crisis track this season, and whether that contribution is helpful.
 */
function getPlebsUnrestContribution(plebs: number): { text: string; positive: boolean } {
  if (plebs < 20) return { text: '+6/season to Unrest escalation', positive: false };
  if (plebs < 30) return { text: '+4/season to Unrest escalation', positive: false };
  if (plebs < 40) return { text: '+2/season to Unrest escalation', positive: false };
  if (plebs >= 80) return { text: '−5/season from Unrest escalation', positive: true };
  if (plebs >= 60) return { text: '−3/season from Unrest escalation', positive: true };
  return { text: 'No direct effect on Unrest this season', positive: true };
}

/**
 * Returns a description of how Internal Stability influences the Constitution
 * crisis track. The relationship is indirect — through legislation rate.
 */
function getStabilityConstitutionNote(stability: number): string {
  if (stability < 20) return 'Very low — bills stall, no-bill streak risks Constitution +5/season';
  if (stability < 40) return 'Fragile — slows legislation, risking Constitution erosion';
  if (stability < 70) return 'Stable — normal legislation rate, no Constitution pressure';
  if (stability < 85) return 'Cohesive — legislation flows easily, Constitution protected';
  return 'Strong — legislation at peak efficiency, Constitution under no pressure';
}

// ─── Crisis track display ─────────────────────────────────────────────────────

const CRISIS_TRACK_COLOR: Record<CrisisTrackId, string> = {
  war:          '#C04010',
  unrest:       '#C03030',
  constitution: COLORS.purple,
  economy:      '#1A8888',
};

const CRISIS_TRACK_LABEL: Record<CrisisTrackId, string> = {
  war: 'WAR', unrest: 'UNREST', constitution: 'CONST', economy: 'ECON',
};

const TRACK_ORDER: CrisisTrackId[] = ['war', 'unrest', 'constitution', 'economy'];

// ─── LatiumSheet ──────────────────────────────────────────────────────────────

export default function LatiumSheet({ onClose }: { onClose: () => void }) {
  const rome   = useGameStore(s => s.rome);
  const crisis = useGameStore(s => s.crisis);
  const [crisisModal, setCrisisModal] = useState<CrisisTrackId | null>(null);

  const romeMods      = calcRomeStatModifiers(rome);
  const statusEffects = getCrisisStatusEffects(crisis);

  const plebsContrib    = getPlebsUnrestContribution(rome.plebs);
  const stabilityNote   = getStabilityConstitutionNote(rome.stability);

  return (
    <View style={styles.sheet}>
      {/* Drag handle */}
      <View style={styles.handle} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* Province header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.provinceTitle}>LATIUM</Text>
            <Text style={styles.provinceSub}>
              HEARTLAND OF THE REPUBLIC · UNGOVERNABLE
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnLabel}>✕</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.flavor}>
          Latium is Rome's eternal core — the ancient Latin plain from which the Republic grew.
          It cannot revolt, cannot be taxed separately, and needs no governor. Its loyalty is
          absolute. What happens here is Rome itself.
        </Text>

        {/* ── Domestic Conditions ────────────────────────────────────────────── */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DOMESTIC CONDITIONS</Text>
          <Text style={styles.sectionSub}>
            Move these through legislation, grain policy, and public games. They drive crisis
            escalation — low values make the tracks harder to hold.
          </Text>

          {/* Popular Sentiment (rome.plebs) */}
          <View style={styles.statBlock}>
            <StatBar
              label={`Popular Sentiment — ${romeMods.plebsLabel}`}
              value={rome.plebs}
              color={COLORS.purple}
              thresholdMarks={[20, 40, 70, 85]}
            />
            <View style={styles.causalRow}>
              <Text style={styles.causalArrow}>↳ Unrest track:</Text>
              <Text style={[
                styles.causalValue,
                { color: plebsContrib.positive ? COLORS.laurel : COLORS.crimson },
              ]}>
                {plebsContrib.text}
              </Text>
            </View>
          </View>

          {/* Internal Stability (rome.stability) */}
          <View style={styles.statBlock}>
            <StatBar
              label={`Internal Stability — ${romeMods.stabilityLabel}`}
              value={rome.stability}
              color={COLORS.laurel}
              thresholdMarks={[20, 40, 70, 85]}
            />
            <View style={styles.causalRow}>
              <Text style={styles.causalArrow}>↳ Constitution track:</Text>
              <Text style={styles.causalValue}>{stabilityNote}</Text>
            </View>
          </View>
        </View>

        {/* ── Crisis Tracks overview ─────────────────────────────────────────── */}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CRISIS TRACKS — CURRENT STATE</Text>
          <Text style={styles.sectionSub}>
            Read-only. Managed through legislation, provincial governance, and office actions.
          </Text>

          {/* 2×2 grid — War / Unrest in row 1, Constitution / Economy in row 2 */}
          <View style={styles.crisisRow}>
            {TRACK_ORDER.slice(0, 2).map(trackId => (
              <CrisisMiniCell
                key={trackId}
                trackId={trackId}
                level={crisis[trackId].level}
                label={statusEffects.find(e => e.trackId === trackId)!.label}
                onPress={() => setCrisisModal(trackId)}
              />
            ))}
          </View>
          <View style={[styles.crisisRow, { marginTop: SPACING.sm }]}>
            {TRACK_ORDER.slice(2, 4).map(trackId => (
              <CrisisMiniCell
                key={trackId}
                trackId={trackId}
                level={crisis[trackId].level}
                label={statusEffects.find(e => e.trackId === trackId)!.label}
                onPress={() => setCrisisModal(trackId)}
              />
            ))}
          </View>
        </View>

        {/* ── Holdings (Family House rework) ──────────────────────────────── */}
        {/* Vineyard, Gladiator School, Insulae, and Baths — relocated here
            from Domus's old Patrimonium panel. Unchanged mechanically: same
            OwnedAsset/tier shape, same income-calc wiring — just bought from
            the heartland now, since these are Roman-soil holdings, not
            fixtures of the family's own residence. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HOLDINGS</Text>
          <Text style={styles.sectionSub}>
            Land and enterprises across the Latin heartland — the family's holdings outside its own walls.
          </Text>
          <HoldingsPanel />
        </View>

      </ScrollView>

      {crisisModal && (
        <CrisisTrackModal
          trackId={crisisModal}
          track={crisis[crisisModal]}
          crisisState={crisis}
          visible={!!crisisModal}
          onClose={() => setCrisisModal(null)}
        />
      )}
    </View>
  );
}

// ─── Crisis mini cell ─────────────────────────────────────────────────────────

function CrisisMiniCell({
  trackId, level, label, onPress,
}: {
  trackId: CrisisTrackId;
  level: number;
  label: string;
  onPress?: () => void;
}) {
  const color = CRISIS_TRACK_COLOR[trackId];
  const cell = (
    <View style={miniCell.cell}>
      <View style={miniCell.header}>
        <Text style={[miniCell.trackName, { color }]}>{CRISIS_TRACK_LABEL[trackId]}</Text>
        <Text style={[miniCell.levelNum, { color }]}>{Math.round(level)}</Text>
      </View>
      <Text style={miniCell.tierLabel}>{label}</Text>
      <StatBar
        label=""
        value={level}
        color={color}
        thresholdMarks={[20, 40, 60, 80]}
      />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
        {cell}
      </TouchableOpacity>
    );
  }
  return cell;
}

const miniCell = StyleSheet.create({
  cell: {
    flex: 1,
    backgroundColor: COLORS.panelElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  trackName: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  levelNum: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  tierLabel: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: COLORS.panelSurface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingBottom: 100,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: SPACING.sm,
  },
  headerLeft: { flex: 1 },
  provinceTitle: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2,
  },
  provinceSub: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  closeBtnLabel: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 16,
  },
  flavor: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  section: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  sectionSub: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  statBlock: {
    marginBottom: SPACING.sm,
  },
  causalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 3,
    paddingLeft: 4,
    flexWrap: 'wrap',
  },
  causalArrow: {
    color: COLORS.goldDim,
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '600',
  },
  causalValue: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 10,
    flex: 1,
  },
  crisisRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
});
