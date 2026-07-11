import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { calcRomeStatModifiers } from '../engine/resourceEngine';
import { computeTotalPrepStrength } from '../engine/trialEngine';
import { calcRomeStatVoteModifier, ALL_BILL_TEMPLATES } from '../data/billTemplates';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import StatBar from '../components/shared/StatBar';
import CrisisTrackModal from '../components/shared/CrisisTrackModal';
import ParchmentCard, { PARCHMENT_TEXT } from '../components/shared/ParchmentCard';
import ScrollModal, { PARCHMENT } from '../components/shared/ScrollModal';
import { TRIAL_CHARGE_DEFS } from '../data/trialCharges';
import type { Bill, ActiveLaw } from '../models/bill';
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

  const cell = (
    <View style={ctc.cell}>
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

// ─── Bloc meter ───────────────────────────────────────────────────────────────

function BlocMeter({ support }: { support: number }) {
  const safeSupport = isNaN(support) ? 0 : support;
  const norm = (safeSupport + 100) / 200;
  const pop = Math.max(0, Math.round(norm * 70));
  const opt = Math.max(0, Math.round((1 - norm) * 70));
  const neu = Math.max(0, 100 - pop - opt);
  return (
    <View style={bloc.container}>
      <View style={[bloc.segment, { flex: pop || 1, backgroundColor: COLORS.purple }]} />
      <View style={[bloc.segment, { flex: neu || 1, backgroundColor: COLORS.dust + '55' }]} />
      <View style={[bloc.segment, { flex: opt || 1, backgroundColor: COLORS.senatBlue }]} />
    </View>
  );
}

const bloc = StyleSheet.create({
  container: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  segment: { height: '100%' },
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
    <View style={tb.container}>
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

// ─── Bill card ────────────────────────────────────────────────────────────────

function BillCard({ bill }: { bill: Bill }) {
  const { rome, fides, expandBill, _expandedBill, _expandedType, voteBill, speechBill, filibusterBill } = useGameStore();
  const isExpandedVote = _expandedBill === bill.id && _expandedType === 'vote';
  const isExpandedSpeech = _expandedBill === bill.id && _expandedType === 'speech';
  const [detailVisible, setDetailVisible] = useState(false);

  const romeMod = calcRomeStatVoteModifier(bill, rome);
  const effectiveSupport = (bill.support ?? 0) + romeMod;
  const supportVerdict = effectiveSupport > 0 ? 'Likely to pass' : effectiveSupport < -20 ? 'Likely to fail' : 'Too close to call';
  const verdictColor = effectiveSupport > 0 ? COLORS.laurel : effectiveSupport < -20 ? COLORS.crimson : COLORS.gold;

  const voteFidesCost = bill.voteGravitasCost ?? 4;
  const speechFidesCost = bill.speechGravitasCost ?? 6;

  return (
    <View style={bstyle.card}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => setDetailVisible(true)}>
        <View style={bstyle.topRow}>
          <View style={bstyle.nameWrap}>
            <Text style={bstyle.name}>{bill.name}</Text>
            {bill.type && <Text style={bstyle.type}>{bill.type.toUpperCase()}</Text>}
          </View>
          <View style={bstyle.badges}>
            {bill.playerSubmitted && <View style={bstyle.badge}><Text style={bstyle.badgeText}>YOURS</Text></View>}
            {bill.playerVote && (
              <View style={[bstyle.badge, { borderColor: bill.playerVote === 'filibuster' ? COLORS.crimson : COLORS.gold }]}>
                <Text style={[bstyle.badgeText, { color: bill.playerVote === 'filibuster' ? COLORS.crimson : COLORS.gold }]}>
                  {bill.playerVote.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={bstyle.desc}>{bill.desc}</Text>
        {bill.ongoingEffect && <Text style={bstyle.ongoing}>Ongoing: {bill.ongoingEffect} per season</Text>}

        <View style={bstyle.row}>
          <Text style={bstyle.meta}>{bill.turnsLeft} seasons left</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[bstyle.verdict, { color: verdictColor }]}>{supportVerdict}</Text>
            {romeMod !== 0 && (
              <Text style={bstyle.modNote}>Rome mod: {romeMod > 0 ? '+' : ''}{romeMod}</Text>
            )}
          </View>
        </View>
        <BlocMeter support={effectiveSupport} />
      </TouchableOpacity>

      <BillDetailModal bill={bill} visible={detailVisible} onClose={() => setDetailVisible(false)} />

      <View style={bstyle.actions}>
        <TouchableOpacity style={[bstyle.actionBtn, isExpandedVote && bstyle.actionBtnActive]} onPress={() => expandBill(bill.id, 'vote')}>
          <Text style={bstyle.actionLabel}>VOTE</Text>
          <Text style={bstyle.actionCost}>-{voteFidesCost} 🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[bstyle.actionBtn, isExpandedSpeech && bstyle.actionBtnActive]} onPress={() => expandBill(bill.id, 'speech')}>
          <Text style={bstyle.actionLabel}>SPEECH</Text>
          <Text style={bstyle.actionCost}>-{speechFidesCost} 🤝</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[bstyle.actionBtn, fides < 8 && bstyle.actionBtnDisabled]} onPress={() => filibusterBill(bill.id)} disabled={fides < 8}>
          <Text style={bstyle.actionLabel}>FILIBUSTER</Text>
          <Text style={bstyle.actionCost}>-8 🤝</Text>
        </TouchableOpacity>
      </View>

      {isExpandedVote && (
        <View style={bstyle.expanded}>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.laurel }, fides < voteFidesCost && bstyle.actionBtnDisabled]} onPress={() => voteBill(bill.id, 'vote_for')} disabled={fides < voteFidesCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.laurel }]}>Vote For (+{bill.voteForSupport ?? 15} support)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.crimson }, fides < voteFidesCost && bstyle.actionBtnDisabled]} onPress={() => voteBill(bill.id, 'vote_against')} disabled={fides < voteFidesCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.crimson }]}>Vote Against (−{Math.abs(bill.voteAgainstSupport ?? 15)} support)</Text>
          </TouchableOpacity>
        </View>
      )}
      {isExpandedSpeech && (
        <View style={bstyle.expanded}>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.laurel }, fides < speechFidesCost && bstyle.actionBtnDisabled]} onPress={() => speechBill(bill.id, 'for')} disabled={fides < speechFidesCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.laurel }]}>Speak in Favour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.crimson }, fides < speechFidesCost && bstyle.actionBtnDisabled]} onPress={() => speechBill(bill.id, 'against')} disabled={fides < speechFidesCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.crimson }]}>Speak Against</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const bstyle = StyleSheet.create({
  card: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  nameWrap: { flex: 1 },
  name: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 15, fontWeight: '600' },
  type: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1, marginTop: 1 },
  badges: { flexDirection: 'row', gap: 4, marginLeft: 4 },
  badge: { borderWidth: 1, borderColor: COLORS.goldDim, borderRadius: 2, paddingHorizontal: 4 },
  badgeText: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 8, textTransform: 'uppercase' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 4 },
  ongoing: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 10, marginTop: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 6 },
  meta: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
  verdict: { fontFamily: FONTS.ui, fontSize: 11, fontWeight: '600' },
  modNote: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 9, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 6, marginTop: 10 },
  actionBtn: { flex: 1, backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingVertical: 6, alignItems: 'center' },
  actionBtnActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldDim + '22' },
  actionBtnDisabled: { opacity: 0.4 },
  actionLabel: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  actionCost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 9, marginTop: 1 },
  expanded: { marginTop: 8, gap: 6 },
  subBtn: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.sm, minHeight: 44, justifyContent: 'center' },
  subBtnLabel: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

// ─── Bill effect string formatting ────────────────────────────────────────────
// Mirrors the token vocabulary applyEffectString (resourceEngine.ts) actually
// understands, so the modal only ever shows effects that really happen —
// colon tokens (setFlag, addClient, etc.) are internal bookkeeping and skipped.

const EFFECT_LABELS: Record<string, string> = {
  fides: 'Fides',
  denarii: 'Denarii',
  gold: 'Denarii',
  lifetimeDignitas: 'Dignitas',
  stability: 'Stability',
  plebs: 'Plebs Mood',
  treasury: 'Treasury',
  imperium: 'Imperium',
  corruption: 'Corruption',
  popularesRel: 'Populares Standing',
  optimatesRel: 'Optimates Standing',
};

const CRISIS_EFFECT_LABELS: Record<CrisisTrackId, string> = {
  war: 'War Crisis',
  unrest: 'Unrest',
  constitution: 'Constitution Crisis',
  economy: 'Economy Crisis',
};

function formatEffectString(effectStr: string | undefined): string[] {
  if (!effectStr) return [];
  const parts: string[] = [];
  for (const raw of effectStr.split('|').map(s => s.trim()).filter(Boolean)) {
    const crisisMatch = raw.match(/^crisis-(war|unrest|constitution|economy)([+-]\d+)$/);
    if (crisisMatch) {
      const delta = parseInt(crisisMatch[2], 10);
      parts.push(`${delta > 0 ? '+' : ''}${delta} ${CRISIS_EFFECT_LABELS[crisisMatch[1] as CrisisTrackId]}`);
      continue;
    }
    if (raw.includes(':')) continue; // internal bookkeeping token — not player-facing
    const match = raw.match(/^([a-zA-Z]+)([+-]\d+)$/);
    if (!match) continue;
    const label = EFFECT_LABELS[match[1]];
    if (!label) continue; // unrecognized/legacy key
    const delta = parseInt(match[2], 10);
    parts.push(`${delta > 0 ? '+' : ''}${delta} ${label}`);
  }
  return parts;
}

// ─── Bill detail modal ────────────────────────────────────────────────────────

function BillDetailModal({ bill, visible, onClose }: { bill: Bill; visible: boolean; onClose: () => void }) {
  const { rome } = useGameStore();
  const romeMod = calcRomeStatVoteModifier(bill, rome);
  const effectiveSupport = (bill.support ?? 0) + romeMod;

  const passEffects = formatEffectString(bill.passEffect);
  const failEffects = formatEffectString(bill.failEffect);
  const ongoingEffects = formatEffectString(bill.ongoingEffect);

  return (
    <ScrollModal
      visible={visible}
      onClose={onClose}
      title={bill.name}
      subtitle={bill.type ? bill.type.toUpperCase() : undefined}
    >
      <Text style={bdm.desc}>{bill.desc}</Text>

      <View style={bdm.metaRow}>
        <Text style={bdm.metaText}>{bill.turnsLeft} season{bill.turnsLeft !== 1 ? 's' : ''} left</Text>
        <Text style={bdm.metaText}>
          Support: {effectiveSupport > 0 ? '+' : ''}{effectiveSupport}
          {romeMod !== 0 ? ` (Rome mod ${romeMod > 0 ? '+' : ''}${romeMod})` : ''}
        </Text>
      </View>

      <View style={bdm.section}>
        <Text style={[bdm.sectionLabel, { color: COLORS.laurel }]}>IF PASSED</Text>
        {passEffects.length > 0
          ? passEffects.map((line, i) => <Text key={i} style={bdm.effectLine}>{line}</Text>)
          : <Text style={bdm.effectLineMuted}>No direct effect.</Text>}
      </View>

      <View style={bdm.section}>
        <Text style={[bdm.sectionLabel, { color: COLORS.crimson }]}>IF IT FAILS</Text>
        {failEffects.length > 0
          ? failEffects.map((line, i) => <Text key={i} style={bdm.effectLine}>{line}</Text>)
          : <Text style={bdm.effectLineMuted}>No direct effect.</Text>}
      </View>

      {ongoingEffects.length > 0 && (
        <View style={bdm.section}>
          <Text style={[bdm.sectionLabel, { color: PARCHMENT.gold }]}>WHILE ACTIVE (PER SEASON)</Text>
          {ongoingEffects.map((line, i) => <Text key={i} style={bdm.effectLine}>{line}</Text>)}
        </View>
      )}
    </ScrollModal>
  );
}

const bdm = StyleSheet.create({
  desc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: PARCHMENT.border },
  metaText: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  section: { marginTop: SPACING.md },
  sectionLabel: { fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  effectLine: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 13, marginBottom: 2 },
  effectLineMuted: { color: PARCHMENT.muted, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12 },
});

// ─── Active Law card ──────────────────────────────────────────────────────────

function ActiveLawCard({ law }: { law: ActiveLaw }) {
  const { proposeRepeal, fides, bills, turnNumber } = useGameStore();
  const repealAlreadyActive = bills.some(b => b.type === 'repeal' && b.repeals === law.billId);
  const canRepeal = law.repealable && !repealAlreadyActive && fides >= 10;
  const seasonsLeft = law.expiresOnTurn !== undefined ? law.expiresOnTurn - turnNumber : null;
  const [detailVisible, setDetailVisible] = useState(false);

  return (
    <ParchmentCard style={alc.card}>
      <TouchableOpacity activeOpacity={0.75} onPress={() => setDetailVisible(true)}>
        <View style={alc.row}>
          <Text style={alc.name}>{law.name}</Text>
          {seasonsLeft !== null && (
            <Text style={alc.expiry}>Expires in {seasonsLeft} season{seasonsLeft !== 1 ? 's' : ''}</Text>
          )}
        </View>
        {law.ongoingEffect && <Text style={alc.ongoing}>Ongoing: {law.ongoingEffect} per season</Text>}
      </TouchableOpacity>

      <ActiveLawDetailModal law={law} visible={detailVisible} onClose={() => setDetailVisible(false)} />

      {law.repealable && (
        <TouchableOpacity
          style={[alc.repealBtn, !canRepeal && alc.repealBtnDisabled]}
          onPress={() => proposeRepeal(law.billId)}
          disabled={!canRepeal}
        >
          <Text style={alc.repealLabel}>
            {repealAlreadyActive ? 'Repeal pending' : 'Propose Repeal (−10 🤝)'}
          </Text>
        </TouchableOpacity>
      )}
    </ParchmentCard>
  );
}

// ─── Active law detail modal ──────────────────────────────────────────────────

function ActiveLawDetailModal({ law, visible, onClose }: { law: ActiveLaw; visible: boolean; onClose: () => void }) {
  const { turnNumber } = useGameStore();
  // law.billId is the bill's runtime instance id (re-assigned on every injection/
  // submission via nextBillId()/Date.now()), not the template's static id — so the
  // only reliable way back to the template is by name, which stays stable per bill type.
  const template = ALL_BILL_TEMPLATES.find(t => t.name === law.name);
  const seasonsLeft = law.expiresOnTurn !== undefined ? law.expiresOnTurn - turnNumber : null;
  const enactedEffects = formatEffectString(template?.passEffect);
  const ongoingEffects = formatEffectString(law.ongoingEffect);

  return (
    <ScrollModal visible={visible} onClose={onClose} title={law.name} subtitle="ACTIVE LAW">
      {template?.desc && <Text style={ldm.desc}>{template.desc}</Text>}

      <View style={ldm.metaRow}>
        <Text style={ldm.metaText}>Enacted turn {law.passedOnTurn}</Text>
        <Text style={ldm.metaText}>
          {seasonsLeft !== null ? `Expires in ${seasonsLeft} season${seasonsLeft !== 1 ? 's' : ''}` : 'Permanent'}
        </Text>
      </View>

      {enactedEffects.length > 0 && (
        <View style={ldm.section}>
          <Text style={[ldm.sectionLabel, { color: COLORS.laurel }]}>WHEN ENACTED</Text>
          {enactedEffects.map((line, i) => <Text key={i} style={ldm.effectLine}>{line}</Text>)}
        </View>
      )}

      {ongoingEffects.length > 0 && (
        <View style={ldm.section}>
          <Text style={[ldm.sectionLabel, { color: PARCHMENT.gold }]}>WHILE ACTIVE (PER SEASON)</Text>
          {ongoingEffects.map((line, i) => <Text key={i} style={ldm.effectLine}>{line}</Text>)}
        </View>
      )}

      <View style={ldm.section}>
        <Text style={[ldm.sectionLabel, { color: PARCHMENT.gold }]}>STATUS</Text>
        <Text style={ldm.effectLine}>
          {law.repealable ? 'Can be repealed by proposing a repeal bill.' : 'Cannot be repealed.'}
        </Text>
        {law.renewable && <Text style={ldm.effectLine}>Renews automatically when it expires.</Text>}
      </View>
    </ScrollModal>
  );
}

const ldm = StyleSheet.create({
  desc: { color: PARCHMENT.body, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.md, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: PARCHMENT.border },
  metaText: { color: PARCHMENT.muted, fontFamily: FONTS.ui, fontSize: 11 },
  section: { marginTop: SPACING.md },
  sectionLabel: { fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 },
  effectLine: { color: PARCHMENT.heading, fontFamily: FONTS.ui, fontSize: 13, marginBottom: 2 },
});

const alc = StyleSheet.create({
  card: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  name: { fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', color: PARCHMENT_TEXT.heading, flex: 1 },
  expiry: { fontFamily: FONTS.ui, fontSize: 10, color: PARCHMENT_TEXT.muted },
  ongoing: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT_TEXT.body, marginTop: 3 },
  repealBtn: { marginTop: SPACING.sm, borderWidth: 1, borderColor: PARCHMENT_TEXT.gold, borderRadius: RADIUS.sm, padding: 6, alignItems: 'center' },
  repealBtnDisabled: { opacity: 0.4 },
  repealLabel: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT_TEXT.gold },
});

// ─── Submit bill modal ────────────────────────────────────────────────────────

function SubmitBillModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // crisisLevel is kept in sync as a real field (see Chunk 2D note in plan)
  const { bills, submitBill, fides, crisisLevel, rome } = useGameStore();
  const existing = new Set(bills.map(b => b.name));

  const available = ALL_BILL_TEMPLATES.filter(t => {
    if (existing.has(t.name)) return false;
    if (!t.submissionCondition) return true;
    const cond = t.submissionCondition;
    if (cond.startsWith('crisisLevel >=')) {
      const threshold = parseInt(cond.split('>=')[1].trim(), 10);
      return crisisLevel >= threshold;
    }
    if (cond.startsWith('crisisLevel <=')) {
      const threshold = parseInt(cond.split('<=')[1].trim(), 10);
      return crisisLevel <= threshold;
    }
    return true;
  });

  return (
    <ScrollModal visible={visible} onClose={onClose} title="Submit a Bill" subtitle="Cost: 10 Fides">
      {available.map((t, i) => {
        const romeMod = calcRomeStatVoteModifier(t as Bill, rome);
        return (
          <TouchableOpacity
            key={i}
            style={[modal.item, fides < 10 && modal.itemDisabled]}
            disabled={fides < 10}
            onPress={() => { submitBill(t as any); onClose(); }}
          >
            <View style={modal.itemHeader}>
              <Text style={modal.itemName}>{t.name}</Text>
              {t.type && <Text style={modal.itemType}>{t.type.toUpperCase()}</Text>}
            </View>
            <Text style={modal.itemDesc}>{t.desc}</Text>
            <View style={modal.itemMeta}>
              <Text style={modal.itemMetaText}>Support: {t.support > 0 ? `+${t.support}` : t.support} · {t.turnsLeft} seasons</Text>
              {romeMod !== 0 && <Text style={modal.itemMod}>Rome mod: {romeMod > 0 ? '+' : ''}{romeMod}</Text>}
            </View>
          </TouchableOpacity>
        );
      })}
      {available.length === 0 && <Text style={modal.empty}>No bills available to submit.</Text>}
    </ScrollModal>
  );
}

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

// ─── CuriaScreen ──────────────────────────────────────────────────────────────

export default function CuriaScreen() {
  const { rome, crisis, bills, activeLaws, fides, turnNumber, grandGamesVoteBonus, wars } = useGameStore();
  const [submitVisible, setSubmitVisible] = useState(false);
  const [activeLawsExpanded, setActiveLawsExpanded] = useState(true);
  const [munificenceExpanded, setMunificenceExpanded] = useState(true);
  const [romeStatModal, setRomeStatModal] = useState<RomeStat | null>(null);
  const [crisisModal, setCrisisModal] = useState<CrisisTrackId | null>(null);
  const [negotiationWarId, setNegotiationWarId] = useState<string | null>(null);
  const romeMods = calcRomeStatModifiers(rome);

  // Military Overhaul M10 — any active war that's reached the sue threshold
  // unlocks the negotiation entry point (agendaEngine's generator #18 also
  // points here — see its target: { tab: 'Curia' }).
  const negotiableWars = (wars ?? []).filter(w => w.active && getDesperationTier(w.warScore) !== 'none');

  const TRACK_ORDER: CrisisTrackId[] = ['war', 'unrest', 'constitution', 'economy'];

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>CURIA</Text>
        <Text style={styles.subtitle}>Senate & Legislation</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        <TrialBanner />

        {/* Treasury — the one Rome stat that directly affects legislation */}
        <View style={styles.panel}>
          <InfoTap termId="rome-treasury">
            <Text style={styles.panelTitle}>ROME — TREASURY</Text>
          </InfoTap>
          <Text style={styles.panelSub}>
            Affects bill support and Denarii income each season. Tap for tier details.
          </Text>
          <StatBar
            label={`Treasury — ${romeMods.treasuryLabel}`}
            value={rome.treasury}
            color={COLORS.denariiColor}
            thresholdMarks={[10, 25, 65, 85]}
            onPress={() => setRomeStatModal('treasury')}
          />
          <View style={styles.crosslink}>
            <Text style={styles.crosslinkText}>
              Popular Sentiment &amp; Internal Stability are tracked in{' '}
              <Text style={styles.crosslinkEmphasis}>Provinciae → Latium</Text>
              {' '}— they drive Unrest and Constitution crisis escalation.
            </Text>
          </View>
        </View>

        <View style={styles.panel}>
          <InfoTap termId="crisis-tracks">
            <Text style={styles.panelTitle}>CRISIS TRACKS</Text>
          </InfoTap>
          <Text style={styles.panelSub}>Four independent pressures on the Republic. Each escalates and de-escalates through different mechanisms.</Text>
          <View style={styles.crisisRow}>
            <CrisisTrackCell trackId={TRACK_ORDER[0]} track={crisis[TRACK_ORDER[0]]} onPress={() => setCrisisModal(TRACK_ORDER[0])} />
            <View style={styles.crisisGap} />
            <CrisisTrackCell trackId={TRACK_ORDER[1]} track={crisis[TRACK_ORDER[1]]} onPress={() => setCrisisModal(TRACK_ORDER[1])} />
          </View>
          <View style={[styles.crisisRow, { marginTop: SPACING.sm }]}>
            <CrisisTrackCell trackId={TRACK_ORDER[2]} track={crisis[TRACK_ORDER[2]]} onPress={() => setCrisisModal(TRACK_ORDER[2])} />
            <View style={styles.crisisGap} />
            <CrisisTrackCell trackId={TRACK_ORDER[3]} track={crisis[TRACK_ORDER[3]]} onPress={() => setCrisisModal(TRACK_ORDER[3])} />
          </View>
        </View>

        {/* Military Overhaul M10 — War & Peace */}
        {negotiableWars.length > 0 && (
          <View style={styles.panel}>
            <InfoTap termId="peace-negotiation">
              <Text style={styles.panelTitle}>WAR &amp; PEACE</Text>
            </InfoTap>
            <Text style={styles.panelSub}>
              The war has reached a threshold where terms may be discussed.
            </Text>
            {negotiableWars.map(w => (
              <TouchableOpacity
                key={w.id}
                style={styles.warRow}
                onPress={() => setNegotiationWarId(w.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.warRowLabel}>
                    War with {w.enemyId.charAt(0).toUpperCase() + w.enemyId.slice(1)}
                  </Text>
                  <Text style={styles.warRowSub}>
                    warScore {w.warScore >= 0 ? '+' : ''}{w.warScore}
                    {w.treaty?.stage === 'ai_offer' && ' — terms offered'}
                    {w.treaty?.stage === 'senate_vote' && ' — awaiting Senate vote'}
                  </Text>
                </View>
                <Text style={styles.warRowArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Active bills */}
        <View style={styles.billsHeader}>
          <Text style={styles.sectionLabel}>LEGES — ACTIVE BILLS</Text>
          <TouchableOpacity
            style={[styles.submitBtn, fides < 10 && styles.submitBtnDisabled]}
            onPress={() => setSubmitVisible(true)}
            disabled={fides < 10}
          >
            <Text style={styles.submitBtnLabel}>+ Submit Bill</Text>
            <Text style={styles.submitBtnCost}>−10 🤝</Text>
          </TouchableOpacity>
        </View>

        {bills.length === 0
          ? <Text style={styles.emptyText}>No active bills. Submit one or end the season.</Text>
          : bills.map(bill => <BillCard key={bill.id} bill={bill} />)
        }

        {/* Active Laws section */}
        {(activeLaws ?? []).length > 0 && (
          <View style={styles.activeLawsSection}>
            <TouchableOpacity
              style={styles.billsHeader}
              onPress={() => setActiveLawsExpanded(e => !e)}
              activeOpacity={0.75}
            >
              <Text style={styles.sectionLabel}>LEGES IN VIGORE — ACTIVE LAWS ({activeLaws.length})</Text>
              <Text style={styles.chevron}>{activeLawsExpanded ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {activeLawsExpanded && (activeLaws ?? []).map(law => (
              <ActiveLawCard key={law.billId} law={law} />
            ))}
          </View>
        )}

        {/* Munificence — P2-F */}
        <View style={styles.munificenceSection}>
          <TouchableOpacity
            style={styles.billsHeader}
            onPress={() => setMunificenceExpanded(e => !e)}
            activeOpacity={0.75}
          >
            <Text style={styles.sectionLabel}>MUNIFICENCE</Text>
            <Text style={styles.chevron}>{munificenceExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {munificenceExpanded && (
            <>
              <Text style={styles.munificenceFraming}>“What Rome is given, Rome remembers.”</Text>
              {grandGamesVoteBonus > 0 && (
                <Text style={styles.munificenceBonusNote}>
                  Rome still remembers your games: +{grandGamesVoteBonus} votes at the next election, fading with the years.
                </Text>
              )}
              {MUNIFICENCE_ACTS.map(act => (
                <MunificenceActRow key={act.id} act={act} />
              ))}
            </>
          )}
        </View>
      </ScrollView>

      <SeasonOverlay />
      <SubmitBillModal visible={submitVisible} onClose={() => setSubmitVisible(false)} />

      {romeStatModal && (
        <RomeStatModal
          stat={romeStatModal}
          value={rome[romeStatModal]}
          visible={!!romeStatModal}
          onClose={() => setRomeStatModal(null)}
        />
      )}

      {crisisModal && (
        <CrisisTrackModal
          trackId={crisisModal}
          track={crisis[crisisModal]}
          crisisState={crisis}
          visible={!!crisisModal}
          onClose={() => setCrisisModal(null)}
        />
      )}

      {negotiationWarId && (
        <NegotiationScreen
          warId={negotiationWarId}
          visible={!!negotiationWarId}
          onClose={() => setNegotiationWarId(null)}
        />
      )}
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
