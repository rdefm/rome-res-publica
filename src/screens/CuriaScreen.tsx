import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import type { CuriaSubTab } from '../models/curia';
import StateOfRepublicPanel from '../components/curia/StateOfRepublicPanel';
import SubTabBar from '../components/curia/SubTabBar';
import LegesView from '../components/curia/LegesView';
import NegotiaView from '../components/curia/NegotiaView';
import MunificentiaView from '../components/curia/MunificentiaView';
import { calcRomeStatModifiers } from '../engine/resourceEngine';
import { computeTotalPrepStrength } from '../engine/trialEngine';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import StatBar from '../components/shared/StatBar';
import CrisisTrackModal from '../components/shared/CrisisTrackModal';
import ParchmentCard, { PARCHMENT_TEXT } from '../components/shared/ParchmentCard';
import ScrollModal, { PARCHMENT } from '../components/shared/ScrollModal';
import { TRIAL_CHARGE_DEFS } from '../data/trialCharges';
import type { CrisisTrackId, CrisisTrack } from '../models/crisis';
import { getTierFromLevel } from '../models/crisis';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';
import InfoTap from '../components/shared/InfoTap';
import { MUNIFICENCE_ACTS, type MunificenceAct } from '../data/munificence';
import {
  checkMunificenceRequirements,
  getMunificenceCost,
  getMunificenceEffects,
} from '../engine/munificenceEngine';
import { getDesperationTier } from '../engine/warEngine';
import NegotiationScreen from '../components/war/NegotiationScreen';
import { BALANCE } from '../data/balance';
import { isEligibleForCommand, isWarActiveForCommand, commandMinAge } from '../engine/commandEngine';
import { useTutorialTarget } from '../components/shared/useTutorialTarget';

// ─── Crisis track configuration ───────────────────────────────────────────────

const CRISIS_TRACK_COLOR: Record<CrisisTrackId, string> = {
  war:          '#C04010',  // amber-red
  unrest:       '#C03030',  // red-coral
  constitution: COLORS.purple,
  economy:      '#1A8888',  // teal
};

const CRISIS_TRACK_LABEL: Record<CrisisTrackId, string> = {
  war:          'WAR',
  unrest:       'UNREST',
  constitution: 'CONSTITUTION',
  economy:      'ECONOMY',
};

const CRISIS_TIER_LABELS: Record<CrisisTrackId, [string, string, string, string, string]> = {
  war:          ['Pax Externa',           'Border Tensions',   'Active Conflict',     'War Crisis',            'Existential Threat'],
  unrest:       ['Content Populace',      'Murmurs',           'Growing Anger',       'Street Violence',       'Open Revolt'],
  constitution: ['Institutional Stability','Political Tension', 'Senate Dysfunction',  'Constitutional Crisis', 'Republic in Peril'],
  economy:      ['Prosperous Republic',   'Tightening Budgets','Economic Strain',     'Scarcity Crisis',       'Economic Collapse'],
};

// ─── Crisis track cell ────────────────────────────────────────────────────────

function CrisisTrackCell({
  trackId,
  track,
  onPress,
}: {
  trackId: CrisisTrackId;
  track: CrisisTrack;
  onPress?: () => void;
}) {
  const color = CRISIS_TRACK_COLOR[trackId];
  const tierLabel = CRISIS_TIER_LABELS[trackId][track.tier];
  // Tutorial redesign, T5 — only the War track is ever a spotlight target.
  const tutorialTarget = useTutorialTarget(trackId === 'war' ? 'curia.crisis-track.war' : undefined);

  const cell = (
    <View ref={tutorialTarget.ref} onLayout={tutorialTarget.onLayout} style={ctc.cell}>
      <View style={ctc.header}>
        <Text style={[ctc.trackName, { color }]}>{CRISIS_TRACK_LABEL[trackId]}</Text>
        <Text style={[ctc.levelNum, { color }]}>{Math.round(track.level)}</Text>
      </View>
      <Text style={ctc.tierLabel}>{tierLabel}</Text>
      {track.namedCrisis && (
        <Text style={ctc.namedCrisis}>{track.namedCrisis}</Text>
      )}
      <StatBar
        label=""
        value={track.level}
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

const ctc = StyleSheet.create({
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
    fontSize: 10,
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
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  namedCrisis: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 10,
    marginBottom: 4,
  },
});

// ─── Rome stat detail modal ───────────────────────────────────────────────────

// 'stability' and 'plebs' moved to Provinciae → Latium (LatiumSheet).
// Treasury remains here because it directly affects bill support calculations.
type RomeStat = 'treasury';

const ROME_STAT_CONFIG: Record<RomeStat, {
  label: string;
  color: string;
  thresholds: { range: string; label: string; effects: string }[];
  ticks: number[];
}> = {
  treasury: {
    label: 'Treasury',
    color: COLORS.denariiColor,
    ticks: [10, 25, 65, 85],
    thresholds: [
      { range: '0–9',    label: 'Bankrupt',     effects: 'Denarii −3/season · Spending bills −10 support · Lex de Vectigalibus auto-injected' },
      { range: '10–24',  label: 'Depleted',     effects: 'Denarii −1/season · Spending bills −5 support' },
      { range: '25–64',  label: 'Adequate',     effects: 'No modifier (baseline)' },
      { range: '65–84',  label: 'Flush',        effects: 'Spending bills +5 support · Crisis absorbs 1 point/season' },
      { range: '85–100', label: 'Overflowing',  effects: 'Spending bills +10 support · Crisis absorbs 2 points/season' },
    ],
  },
};

function RomeStatModal({
  stat,
  value,
  visible,
  onClose,
}: {
  stat: RomeStat;
  value: number;
  visible: boolean;
  onClose: () => void;
}) {
  const config = ROME_STAT_CONFIG[stat];

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={config.label}
      subtitle={`Current: ${value}`}
    >
      {config.thresholds.map((t, i) => {
        const [min, max] = t.range.split('–').map(Number);
        const isActive = value >= min && value <= max;
        return (
          <View key={i} style={[rsm.thresholdCard, isActive && rsm.thresholdCardActive]}>
            <View style={rsm.thresholdRow}>
              <Text style={[rsm.thresholdLabel, isActive && rsm.thresholdLabelActive]}>
                {t.label}
              </Text>
              <Text style={rsm.thresholdRange}>{t.range}</Text>
            </View>
            <Text style={rsm.thresholdEffects}>{t.effects}</Text>
            {isActive && <Text style={rsm.activeTag}>← CURRENT</Text>}
          </View>
        );
      })}
    </ScrollModal>
  );
}

const rsm = StyleSheet.create({
  thresholdCard: {
    backgroundColor: 'rgba(200,168,112,0.25)',
    borderWidth: 1,
    borderColor: PARCHMENT.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  thresholdCardActive: { borderColor: PARCHMENT.gold, backgroundColor: 'transparent' },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  thresholdLabel: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', color: PARCHMENT.heading },
  thresholdLabelActive: { color: PARCHMENT.gold },
  thresholdRange: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT.muted },
  thresholdEffects: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, color: PARCHMENT.body },
  activeTag: { fontFamily: FONTS.ui, fontSize: 9, color: PARCHMENT.gold, marginTop: 4, letterSpacing: 1 },
});

// ─── Trial banner ─────────────────────────────────────────────────────────────
// Phase 4, Chunk P4-C — adapted onto TrialState, not rewritten: same JSX
// shape/layout as before, minimal diff, per the plan's "the old trial panel
// keeps working by mapping its legacy defense actions onto the new prep
// model." A small derived-view (defendantName/opponentLine/etc.) stands in
// for the old flat Trial fields this component used to read directly.

const OUTCOME_COLORS: Record<string, string> = {
  acquitted: COLORS.laurel, dismissed: COLORS.senatBlue,
  fined: COLORS.denariiColor, exiled: COLORS.crimson, executed: COLORS.crimson,
};

function TrialBanner() {
  const { trials, turnNumber, family, clans, requestNavigation } = useGameStore();
  const activeTrial = trials.find(t => t.status !== 'resolved');
  const trialBannerTarget = useTutorialTarget('curia.trial-banner');

  if (!activeTrial) {
    const resolved = trials.filter(t => t.status === 'resolved' && t.outcome);
    if (resolved.length === 0) return null;
    const last = resolved[resolved.length - 1];
    const color = OUTCOME_COLORS[last.outcome!] ?? COLORS.dust;
    return (
      <View style={[tb.container, { borderColor: color }]}>
        <Text style={[tb.heading, { color, padding: SPACING.md }]}>TRIAL CONCLUDED — {last.outcome!.toUpperCase()}</Text>
      </View>
    );
  }

  const findLeader = (leaderId: string) => clans.flatMap(c => c.leaders).find(l => l.id === leaderId);

  const defendant = activeTrial.defendant;
  const prosecutor = activeTrial.prosecutor;
  const defendantName = defendant.kind === 'family'
    ? family.find(c => c.id === defendant.characterId)?.name ?? 'Unknown'
    : findLeader(defendant.leaderId)?.name ?? 'Unknown';

  const opponentLine = activeTrial.seat === 'defense'
    ? `Brought by ${(prosecutor.kind === 'leader' ? findLeader(prosecutor.leaderId)?.name : null) ?? 'Unknown'}`
    : `You accuse ${defendantName}`;

  const seasonsRemaining = Math.max(0, activeTrial.startsSeason - turnNumber);
  const chargeLabel = TRIAL_CHARGE_DEFS[activeTrial.charge]?.displayName ?? activeTrial.charge;
  const playerStrength = computeTotalPrepStrength(activeTrial.playerPrep, activeTrial.approach);

  return (
    <View ref={trialBannerTarget.ref} onLayout={trialBannerTarget.onLayout} style={tb.container}>
      <View style={tb.header}>
        <View style={tb.headerLeft}>
          <InfoTap termId="trial">
            <Text style={tb.heading}>⚖️ {activeTrial.seat === 'defense' ? 'ACTIVE TRIAL' : 'PROSECUTION FILED'}</Text>
          </InfoTap>
          <Text style={tb.sub}>{chargeLabel} · {activeTrial.seat === 'defense' ? defendantName : `vs. ${defendantName}`}</Text>
          <Text style={tb.sub}>{opponentLine} · {seasonsRemaining} season{seasonsRemaining !== 1 ? 's' : ''} remaining</Text>
        </View>
      </View>
      <View style={tb.barsRow}>
        <View style={tb.barWrap}>
          <Text style={tb.barLabel}>Your Strength</Text>
          <View style={tb.barTrack}><View style={[tb.barFill, { width: `${Math.min(100, playerStrength)}%`, backgroundColor: COLORS.laurel }]} /></View>
          <Text style={[tb.barVal, { color: COLORS.laurel }]}>{Math.round(playerStrength)}</Text>
        </View>
        <View style={tb.barWrap}>
          <Text style={tb.barLabel}>Their Strength</Text>
          <View style={tb.barTrack}><View style={[tb.barFill, { width: `${Math.min(100, activeTrial.npcStrength)}%`, backgroundColor: COLORS.crimson }]} /></View>
          <Text style={[tb.barVal, { color: COLORS.crimson }]}>{Math.round(activeTrial.npcStrength)}</Text>
        </View>
      </View>
      {/* Phase 4, Chunk P4-D — preparation itself now lives in the Basilica
          (Cursus). This banner stays the passive status card, per the plan's
          "opened from any active trial's card." */}
      <TouchableOpacity
        style={tb.basilicaBtn}
        activeOpacity={0.75}
        onPress={() => requestNavigation({ tab: 'Cursus', trialId: activeTrial.id })}
      >
        <Text style={tb.basilicaBtnText}>OPEN THE BASILICA →</Text>
      </TouchableOpacity>
    </View>
  );
}

const tb = StyleSheet.create({
  container: { backgroundColor: COLORS.panelSurface, borderWidth: 2, borderColor: COLORS.crimson, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: SPACING.md },
  headerLeft: { flex: 1 },
  heading: { color: COLORS.crimson, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  sub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 1 },
  barsRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  barWrap: { flex: 1 },
  barLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  barTrack: { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  barFill: { height: '100%', borderRadius: 3 },
  barVal: { fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  basilicaBtn: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md, alignItems: 'center' },
  basilicaBtnText: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});

// `modal` is shared with the old SubmitBillModal (now moved to
// components/curia/SubmitBillModal.tsx, Chunk C3) — CommandAssemblyModal
// below still depends on it directly, so it stays here until Chunk C4 moves
// CommandAssemblyModal out too.
const modal = StyleSheet.create({
  item: { backgroundColor: 'rgba(200,168,112,0.25)', borderWidth: 1, borderColor: PARCHMENT.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  itemDisabled: { opacity: 0.4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  itemName: { color: PARCHMENT.heading, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  itemType: { color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1 },
  itemDesc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 3 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemMetaText: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  itemMod: { color: COLORS.senatBlue, fontFamily: FONTS.ui, fontSize: 11 },
  empty: { color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', textAlign: 'center', marginTop: SPACING.lg },
});

// ─── Command Assembly modal ──────────────────────────────────────────────────
// Campaign Map plan, Chunk C4. Covers both a fresh vote and an auto-called
// prorogation vote — see models/command.ts's CommandElectionState. Mirrors
// SubmitBillModal's ScrollModal + item-row shape rather than inventing a
// new visual language for "pick from a list, pay a cost, get a result."

function CommandAssemblyModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const {
    commandElection, family, fides, declareCommandCandidate, canvassForCommand,
  } = useGameStore();
  if (!commandElection?.active) return null;

  const candidate = commandElection.candidateCharacterId
    ? family.find(c => c.id === commandElection.candidateCharacterId)
    : null;
  const eligibleFamily = family.filter(c => !commandElection.candidateCharacterId && isEligibleForCommand(c));
  const canvassCost = BALANCE.campaign.command.canvassFidesCost;

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={commandElection.isProrogation ? 'Prorogation Vote' : 'Extraordinary Assembly'}
      subtitle={`Resolves at End Season · Canvass cost: ${canvassCost} Fides`}
    >
      <Text style={modal.itemDesc}>
        {commandElection.isProrogation
          ? 'The command\'s term ends this season. The incumbent stands for re-election; a challenger may still declare.'
          : 'Winning grants imperium, a state legion at Rome, and a war chest for the duration of the war.'}
      </Text>

      <Text style={commandStyles.sectionLabel}>YOUR CANDIDATE</Text>
      {candidate ? (
        <View style={modal.item}>
          <Text style={modal.itemName}>{candidate.name}</Text>
          <Text style={modal.itemDesc}>Rhetoric {candidate.skills.rhetoric}/10</Text>
        </View>
      ) : eligibleFamily.length === 0 ? (
        <Text style={modal.empty}>No family member meets the age requirement (≥{commandMinAge()}).</Text>
      ) : (
        eligibleFamily.map(c => (
          <TouchableOpacity key={c.id} style={modal.item} onPress={() => declareCommandCandidate(c.id)}>
            <Text style={modal.itemName}>{c.name}</Text>
            <Text style={modal.itemDesc}>Stand for the command — Rhetoric {c.skills.rhetoric}/10</Text>
          </TouchableOpacity>
        ))
      )}

      <Text style={commandStyles.sectionLabel}>RIVAL CANDIDATES</Text>
      {commandElection.rivals.length === 0 && <Text style={modal.empty}>No rivals stand this season.</Text>}
      {commandElection.rivals.map(rival => {
        const pledged = commandElection.votes[rival.id] === 'for';
        const isIncumbent = rival.id === commandElection.incumbentRivalId;
        const disabled = pledged || fides < canvassCost;
        return (
          <View key={rival.id} style={modal.item}>
            <View style={modal.itemHeader}>
              <Text style={modal.itemName}>{rival.emoji} {rival.name}{isIncumbent ? ' (Incumbent)' : ''}</Text>
              <Text style={modal.itemType}>{rival.clanName.toUpperCase()}</Text>
            </View>
            <Text style={modal.itemDesc}>
              {rival.title}{rival.highestOffice ? ` · Ex-${rival.highestOffice}` : ''}
            </Text>
            <TouchableOpacity
              style={[commandStyles.canvassBtn, disabled && modal.itemDisabled]}
              disabled={disabled}
              onPress={() => canvassForCommand(rival.id)}
            >
              <Text style={commandStyles.canvassBtnText}>
                {pledged ? 'Pledged' : `Canvass (−${canvassCost} Fides)`}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollModal>
  );
}

const commandStyles = StyleSheet.create({
  sectionLabel: {
    color: PARCHMENT.gold, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1,
    marginTop: SPACING.sm, marginBottom: SPACING.xs,
  },
  canvassBtn: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(122,90,26,0.25)', borderWidth: 1,
    borderColor: PARCHMENT.gold, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm,
    paddingVertical: 5, marginTop: SPACING.xs,
  },
  canvassBtnText: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '600' },
});

// ─── CuriaScreen ──────────────────────────────────────────────────────────────

export default function CuriaScreen() {
  // Curia Tab Redesign, Chunk C2 — active sub-tab and header-collapse are
  // local state, matching the CitySheet/LatiumSheet precedent (no
  // persistence, no save-schema change).
  const [activeSubTab, setActiveSubTab] = useState<CuriaSubTab>('leges');
  const [headerCollapsed, setHeaderCollapsed] = useState(false);

  // App.tsx's uiNavRequest effect sets curiaSubTabRequest from a
  // billId/trialId deep-link; read-then-clear, same shape as CursusScreen's
  // selectedTrialId effect.
  const curiaSubTabRequest = useGameStore(s => s.curiaSubTabRequest);
  const requestCuriaSubTab = useGameStore(s => s.requestCuriaSubTab);
  useEffect(() => {
    if (curiaSubTabRequest) {
      setActiveSubTab(curiaSubTabRequest);
      requestCuriaSubTab(null);
    }
  }, [curiaSubTabRequest]);

  // Curia Tab Redesign, Chunk C3 — owned here (not by LegesView) so
  // scroll-to-bill doesn't require nesting a second ScrollView inside this
  // shell's own scroll region.
  const scrollRef = useRef<ScrollView>(null);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <StateOfRepublicPanel
        collapsed={headerCollapsed}
        onToggleCollapse={() => setHeaderCollapsed(c => !c)}
      />
      <SubTabBar
        active={activeSubTab}
        onChange={setActiveSubTab}
        // Real counts/criticality land in Chunk C4 (AgendaBadge-style
        // primitive selector, per plan §"Badge") — NegotiaView is still a
        // stub, so there is nothing to badge yet.
        negotiaCount={0}
        negotiaCritical={false}
      />
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        {activeSubTab === 'leges' && <LegesView scrollRef={scrollRef} />}
        {activeSubTab === 'negotia' && <NegotiaView />}
        {activeSubTab === 'munificentia' && <MunificentiaView />}
      </ScrollView>
      <SeasonOverlay />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT },
  header: { padding: SPACING.md, borderBottomColor: COLORS.border, borderBottomWidth: 1 },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', letterSpacing: 2 },
  subtitle: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, marginTop: 2 },
  scroll: { flex: 1, padding: SPACING.md },
  panel: { backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md },
  panelTitle: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  panelSub: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginBottom: SPACING.sm },
  // Crisis 2×2 grid
  crisisRow: { flexDirection: 'row' },
  crisisGap: { width: SPACING.sm },
  // War & Peace (M10)
  warRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  warRowLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  warRowSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  warRowArrow: { color: COLORS.dust, fontSize: 18, marginLeft: SPACING.sm },
  // Bills
  billsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  submitBtnCost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 11 },
  emptyText: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, textAlign: 'center', marginTop: SPACING.lg },
  activeLawsSection: { marginTop: SPACING.md },
  chevron: { color: COLORS.dust, fontSize: 14 },
  crosslink: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  crosslinkText: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 11,
    lineHeight: 16,
  },
  crosslinkEmphasis: {
    color: COLORS.goldDim,
    fontStyle: 'normal',
    fontFamily: FONTS.ui,
    fontSize: 11,
  },

  // ── Munificence (P2-F) ───────────────────────────────────────────────────────
  munificenceSection: { marginTop: SPACING.md },
  munificenceFraming: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: SPACING.sm,
  },
  munificenceBonusNote: {
    color: COLORS.laurel,
    fontFamily: FONTS.body,
    fontSize: 11,
    marginBottom: SPACING.sm,
  },
});

// ─── Munificence act row (P2-F) ────────────────────────────────────────────────
// Locked acts are shown greyed-out with their tier requirement, not hidden —
// they're the aspiration (plan §P2-F UI). Grand acts (isGrandAct) get a laurel
// accent border; executing one triggers a Philon interstitial via gameStore.

function MunificenceActRow({ act }: { act: MunificenceAct }) {
  const state = useGameStore();
  const { performMunificence } = state;

  const check = checkMunificenceRequirements(state, act);
  const cost = getMunificenceCost(state, act);
  const effects = getMunificenceEffects(state, act);
  const aedileActive = !!act.aedileDiscount && state.currentOffice === 'aedile';

  const effectParts: string[] = [];
  if (effects.plebs)                            effectParts.push(`Plebs +${effects.plebs}`);
  if (effects.fides)                             effectParts.push(`Fides +${effects.fides}`);
  if (effects.lifetimeDignitas)                  effectParts.push(`Lifetime Dignitas +${effects.lifetimeDignitas}`);
  if (effects.stability)                         effectParts.push(`Stability +${effects.stability}`);
  if (effects.crisisDeltas?.unrest)              effectParts.push(`Unrest ${effects.crisisDeltas.unrest}`);
  if (effects.crisisDeltas?.constitution)        effectParts.push(`Constitution ${effects.crisisDeltas.constitution}`);
  if (effects.grantsEndowment)                   effectParts.push('+1 Fides/season, permanently');
  if (effects.electionVoteBonus !== undefined)   effectParts.push(`+${effects.electionVoteBonus} votes, fading over years`);

  const costParts = [`${cost.denarii} Denarii`];
  if (cost.fides > 0) costParts.push(`${cost.fides} Fides`);

  const locked = !check.ok && !!check.reason && check.reason.startsWith('Requires');
  const cardStyle = StyleSheet.flatten([
    mar.card,
    act.isGrandAct && mar.grandCard,
    !check.ok && !locked && mar.cooldownCard,
  ]);

  return (
    <ParchmentCard style={cardStyle}>
      <TouchableOpacity
        activeOpacity={0.75}
        disabled={!check.ok}
        onPress={() => performMunificence(act.id)}
      >
        <View style={mar.row}>
          <Text style={[mar.name, act.isGrandAct && mar.grandName]} numberOfLines={1}>
            {act.isGrandAct ? '🌿 ' : ''}{act.name}
          </Text>
          <Text style={mar.cost}>−{costParts.join(', −')}</Text>
        </View>
        <Text style={mar.flavor}>{act.flavor}</Text>
        {effectParts.length > 0 && <Text style={mar.effects}>{effectParts.join(' · ')}</Text>}
        {aedileActive && <Text style={mar.aedileNote}>Aedile discount applied (½ cost, ×1.5 effect)</Text>}
        {!check.ok && (
          <Text style={locked ? mar.lockedNote : mar.blockedNote}>{check.reason}</Text>
        )}
      </TouchableOpacity>
    </ParchmentCard>
  );
}

const mar = StyleSheet.create({
  card: { marginBottom: SPACING.sm },
  grandCard: { borderWidth: 2, borderColor: COLORS.laurel },
  cooldownCard: { opacity: 0.6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', flex: 1, marginRight: SPACING.sm },
  grandName: { color: PARCHMENT_TEXT.gold },
  cost: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  flavor: { color: PARCHMENT_TEXT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 3 },
  effects: { color: PARCHMENT_TEXT.heading, fontFamily: FONTS.ui, fontSize: 11, marginTop: 4 },
  aedileNote: { color: PARCHMENT_TEXT.gold, fontFamily: FONTS.ui, fontSize: 10, marginTop: 3 },
  lockedNote: { color: PARCHMENT_TEXT.muted, fontFamily: FONTS.ui, fontSize: 10, marginTop: 4, fontStyle: 'italic' },
  blockedNote: { color: '#a04030', fontFamily: FONTS.ui, fontSize: 10, marginTop: 4 },
});
