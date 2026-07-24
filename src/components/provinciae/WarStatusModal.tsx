// ─── WarStatusModal ──────────────────────────────────────────────────────────
// July Fixes plan, Chunk C — surfaces the existing warStanding.ts math (which
// already recomputes warScore live from campaign-map state every season) so
// it stops reading as arbitrary. No new game logic — every number here is
// read straight from WarState or recomputed via warStanding.ts's own exported
// pure functions, the same ones warEngine.ts's processWarSeason already uses.
// Follows NegotiationScreen.tsx's precedent: a store-reading modal keyed off
// a warId prop, not a pure-props component — avoids prop-drilling cities/
// armies/bills through ProvinciaeScreen for a read-only info surface.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ScrollModal, { PARCHMENT } from '../shared/ScrollModal';
import InfoTap from '../shared/InfoTap';
import { useGameStore } from '../../state/gameStore';
import { getDesperationTier, type DesperationTier } from '../../engine/warEngine';
import {
  computeSicilyControl,
  computeArmyBalance,
  computeWearinessGap,
} from '../../engine/warStanding';
import type { WarPhase } from '../../models/war';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import { BALANCE } from '../../data/balance';

interface WarStatusModalProps {
  warId: string;
  visible: boolean;
  onClose: () => void;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const PHASE_LABEL: Record<WarPhase, string> = {
  not_started: 'Not Yet Begun',
  opening: 'Opening Moves',
  escalation: 'Escalation',
  grinding: 'Grinding War',
  ripe: 'Ripe for Resolution',
  ended: 'Concluded',
};

/** Mirrors warEngine.ts's private buildThresholdHeadline copy/logic — that
 *  function isn't exported (it's only used internally to build a one-time
 *  notice), so this is a matching-in-spirit standalone readout rather than
 *  an import, phrased as a persistent status line instead of a one-off event. */
function tierLabel(tier: DesperationTier, warScore: number): string {
  if (tier === 'none') {
    if (warScore > 10) return 'Rome has the edge';
    if (warScore < -10) return 'Carthage has the edge';
    return 'An even fight';
  }
  const winning = warScore > 0;
  if (tier === 'sue') return winning ? 'Carthage may sue for peace' : 'Rome may need to sue for peace';
  if (tier === 'forced') return winning ? 'Carthage may soon be forced to terms' : 'Rome may be forced to the table';
  return winning ? 'Carthage lies open to dictated terms' : 'Rome stands at the brink — terms may be dictated to us';
}

function scoreColor(warScore: number): string {
  if (warScore > 10) return COLORS.laurel;
  if (warScore < -10) return COLORS.crimson;
  return COLORS.dust;
}

export default function WarStatusModal({ warId, visible, onClose }: WarStatusModalProps) {
  const wars    = useGameStore(s => s.wars);
  const cities  = useGameStore(s => s.cities);
  const armies  = useGameStore(s => s.armies);
  const bills   = useGameStore(s => s.bills);

  const war = wars.find(w => w.id === warId);
  if (!war) return null;

  const enemyLabel = capitalize(war.enemyId);
  const tier = getDesperationTier(war.warScore);
  const color = scoreColor(war.warScore);

  const sicilyControl = computeSicilyControl(cities);
  const armyBalance   = computeArmyBalance(armies);
  const wearinessGap  = computeWearinessGap(war.weariness, war.enemyWeariness);
  const momentum      = war.momentum;

  const barPct = Math.max(0, Math.min(100, (war.warScore + 100) / 2));
  const thresholds = BALANCE.war.thresholds;

  const pendingFundingBill    = bills.find(b => b.id.startsWith(`war-funding-${war.id}-`));
  const pendingSuePeaceBill   = bills.find(b => b.id.startsWith(`sue-for-peace-${war.id}-`));

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={`War with ${enemyLabel}`}
      subtitle={PHASE_LABEL[war.phase]}
    >
      {/* ── Score readout ────────────────────────────────────────────────── */}
      <View style={s.section}>
        <InfoTap termId="war-score">
          <Text style={s.sectionTitle}>WAR SCORE</Text>
        </InfoTap>
        <View style={s.levelRow}>
          <Text style={[s.levelBig, { color }]}>{Math.round(war.warScore)}</Text>
          <Text style={s.levelDenom}> / ±100</Text>
        </View>
        <Text style={[s.tierLabel, { color }]}>{tierLabel(tier, war.warScore)}</Text>

        <View style={s.barTrack}>
          <View style={s.barCenterLine} />
          {[thresholds.sue, thresholds.forced, thresholds.dictate].flatMap(t => [
            <View key={`+${t}`} style={[s.barTick, { left: `${(t + 100) / 2}%` }]} />,
            <View key={`-${t}`} style={[s.barTick, { left: `${(-t + 100) / 2}%` }]} />,
          ])}
          <View
            style={[
              s.barFill,
              war.warScore >= 0
                ? { left: '50%', width: `${barPct - 50}%`, backgroundColor: COLORS.laurel }
                : { left: `${barPct}%`, width: `${50 - barPct}%`, backgroundColor: COLORS.crimson },
            ]}
          />
        </View>
        <View style={s.barLabelsRow}>
          <Text style={s.barLabelText}>Carthage winning</Text>
          <Text style={s.barLabelText}>Rome winning</Text>
        </View>
      </View>

      {/* ── What's driving it ───────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>WHAT'S DRIVING IT</Text>
        <BreakdownRow label="Sicily control" value={sicilyControl} note="Who holds the Sicilian cities" />
        <BreakdownRow label="Army balance" value={armyBalance} note="Whose legions are stronger in-theatre" />
        <BreakdownRow label="Momentum" value={momentum} note="Recent battles — fades over time" />
        <BreakdownRow label="Weariness gap" value={-wearinessGap} note="How tired each side is of fighting" />
      </View>

      {/* ── How to influence it ─────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>HOW TO INFLUENCE IT</Text>
        {war.treaty ? (
          <Text style={s.bodyText}>
            {war.treaty.stage === 'ai_offer' && `${enemyLabel} has sent terms — accept or refuse them in the Curia.`}
            {war.treaty.stage === 'senate_vote' && 'A peace treaty is tabled and awaiting the Senate\'s vote — nothing to influence until it resolves.'}
            {war.treaty.stage === 'auto_ratified' && 'Terms were just dictated — this war is over.'}
          </Text>
        ) : (
          <>
            <Text style={s.bodyText}>
              • Win battles on the campaign map — each victory lifts momentum, though it fades over the following seasons.
            </Text>
            <Text style={s.bodyText}>
              • Hold or take Sicilian cities — this feeds directly into Sicily control, the most stable component of the score.
            </Text>
            <Text style={s.bodyText}>
              • Pass War Funding bills when the Senate tables one — a season's silver for a lasting momentum boost.
            </Text>
            {pendingFundingBill && (
              <View style={s.callout}>
                <Text style={s.calloutText}>A War Funding bill is before the Senate right now.</Text>
              </View>
            )}
            {pendingSuePeaceBill && (
              <View style={s.callout}>
                <Text style={s.calloutText}>A Sue for Peace motion is before the Senate right now.</Text>
              </View>
            )}
            {!pendingSuePeaceBill && war.peaceOffered && (
              <Text style={s.bodyText}>
                • The war has dragged on long enough that Sue for Peace is available — watch the Curia for the motion.
              </Text>
            )}
          </>
        )}
      </View>
    </ScrollModal>
  );
}

function BreakdownRow({ label, value, note }: { label: string; value: number; note: string }) {
  const rounded = Math.round(value * 10) / 10;
  const color = rounded > 0 ? COLORS.laurel : rounded < 0 ? COLORS.crimson : PARCHMENT.muted;
  return (
    <View style={s.breakdownRow}>
      <View style={s.breakdownHeader}>
        <Text style={s.breakdownLabel}>{label}</Text>
        <Text style={[s.breakdownValue, { color }]}>{rounded > 0 ? '+' : ''}{rounded}</Text>
      </View>
      <Text style={s.breakdownNote}>{note}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: {
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: PARCHMENT.border,
  },
  sectionTitle: {
    color: PARCHMENT.gold,
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  levelBig: {
    fontFamily: FONTS.ui,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 32,
  },
  levelDenom: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 12,
    marginBottom: 4,
  },
  tierLabel: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00000022',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    position: 'relative',
    overflow: 'hidden',
  },
  barCenterLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: PARCHMENT.border,
  },
  barTick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: PARCHMENT.muted,
    opacity: 0.6,
  },
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  barLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  barLabelText: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 9,
  },
  bodyText: {
    color: PARCHMENT.body,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    lineHeight: 19,
    marginBottom: SPACING.xs,
  },
  breakdownRow: {
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    color: PARCHMENT.heading,
    fontFamily: FONTS.display,
    fontSize: 12,
    fontWeight: '600',
  },
  breakdownValue: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownNote: {
    color: PARCHMENT.muted,
    fontFamily: FONTS.ui,
    fontSize: 10,
    marginTop: 2,
  },
  callout: {
    backgroundColor: COLORS.amber + '22',
    borderWidth: 1,
    borderColor: COLORS.amber + '88',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: 2,
    marginBottom: SPACING.sm,
  },
  calloutText: {
    color: PARCHMENT.heading,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
});
