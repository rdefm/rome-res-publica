import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { getCrisisInfo, getCrisisColour } from '../engine/crisisEngine';
import { calcRomeStatModifiers } from '../engine/resourceEngine';
import { getUnlockedAssetActions } from '../engine/assetEngine';
import { calcRomeStatVoteModifier, ALL_BILL_TEMPLATES } from '../data/billTemplates';
import SeasonOverlay from '../components/shared/SeasonOverlay';
import StatBar from '../components/shared/StatBar';
import ParchmentCard, { PARCHMENT_TEXT } from '../components/shared/ParchmentCard';
import { TRIAL_ACTIONS } from '../data/trialActions';
import type { Bill, ActiveLaw } from '../models/bill';
import { COLORS, FONTS, SPACING, RADIUS, CONTENT_PADDING_BOTTOM, RESOURCE_BAR_HEIGHT } from '../utils/theme';

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

type RomeStat = 'stability' | 'plebs' | 'treasury';

const ROME_STAT_CONFIG: Record<RomeStat, {
  label: string;
  color: string;
  thresholds: { range: string; label: string; effects: string }[];
  ticks: number[];
}> = {
  stability: {
    label: 'Stability',
    color: COLORS.laurel,
    ticks: [20, 40, 70, 85],
    thresholds: [
      { range: '0–19',   label: 'Instability', effects: 'Crisis escalation ×1.5 · Gravitas −2/season' },
      { range: '20–39',  label: 'Fragile',      effects: 'Crisis escalation ×1.25 · Gravitas −1/season' },
      { range: '40–69',  label: 'Stable',       effects: 'No modifier (baseline)' },
      { range: '70–84',  label: 'Cohesive',     effects: 'Gravitas +1/season' },
      { range: '85–100', label: 'Pax Interna',  effects: 'Gravitas +2/season · Crisis escalation ×0.85' },
    ],
  },
  plebs: {
    label: 'Plebs Mood',
    color: COLORS.purple,
    ticks: [20, 40, 70, 85],
    thresholds: [
      { range: '0–19',   label: 'Rioting',    effects: 'Gratia −3/season · Crisis +3/season autonomous · 20% grain riot chance' },
      { range: '20–39',  label: 'Restless',   effects: 'Gratia −1/season · 10% grain riot chance' },
      { range: '40–69',  label: 'Content',    effects: 'No modifier (baseline)' },
      { range: '70–84',  label: 'Supportive', effects: 'Gratia +1/season · Populist bills +5 support' },
      { range: '85–100', label: 'Euphoric',   effects: 'Gratia +2/season · Populist bills +10 support · Patron call-ins waived' },
    ],
  },
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
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={rsm.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={rsm.sheet}>
        <View style={rsm.handle} />
        <Text style={[rsm.title, { color: config.color }]}>{config.label}</Text>
        <Text style={rsm.current}>Current: <Text style={{ color: config.color, fontWeight: '700' }}>{value}</Text></Text>
        <ScrollView>
          {config.thresholds.map((t, i) => {
            const [min, max] = t.range.split('–').map(Number);
            const isActive = value >= min && value <= max;
            return (
              <ParchmentCard
                key={i}
                style={rsm.thresholdCard}
                selected={isActive}
              >
                <View style={rsm.thresholdRow}>
                  <Text style={[rsm.thresholdLabel, isActive && { color: PARCHMENT_TEXT.gold }]}>
                    {t.label}
                  </Text>
                  <Text style={rsm.thresholdRange}>{t.range}</Text>
                </View>
                <Text style={rsm.thresholdEffects}>{t.effects}</Text>
                {isActive && (
                  <Text style={rsm.activeTag}>← CURRENT</Text>
                )}
              </ParchmentCard>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const rsm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: COLORS.panelSurface, borderTopColor: COLORS.border, borderTopWidth: 1,
    borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: SPACING.md,
    paddingBottom: SPACING.xl, maxHeight: '80%',
  },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  current: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 12, textAlign: 'center', marginBottom: SPACING.md },
  thresholdCard: { marginBottom: SPACING.sm },
  thresholdRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  thresholdLabel: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', color: PARCHMENT_TEXT.heading },
  thresholdRange: { fontFamily: FONTS.ui, fontSize: 11, color: PARCHMENT_TEXT.muted },
  thresholdEffects: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, color: PARCHMENT_TEXT.body },
  activeTag: { fontFamily: FONTS.ui, fontSize: 9, color: PARCHMENT_TEXT.gold, marginTop: 4, letterSpacing: 1 },
});

// ─── Trial banner ─────────────────────────────────────────────────────────────

const CHARGE_LABELS: Record<string, string> = {
  corruption: 'Corruption', treason: 'Treason', electoral_fraud: 'Electoral Fraud', murder: 'Murder',
};

const OUTCOME_COLORS: Record<string, string> = {
  acquitted: COLORS.laurel, dismissed: COLORS.senatBlue,
  fined: COLORS.denariiColor, exiled: COLORS.crimson, executed: COLORS.crimson,
};

function TrialBanner() {
  const { trialQueue, family, clans, ownedAssets, denarii, gratia, gravitas, takeTrialAction } = useGameStore();
  const [expanded, setExpanded] = useState(false);
  const activeTrial = trialQueue.find(t => !t.resolved);

  if (!activeTrial) {
    const resolved = trialQueue.filter(t => t.resolved && t.outcome);
    if (resolved.length === 0) return null;
    const last = resolved[resolved.length - 1];
    const color = OUTCOME_COLORS[last.outcome!] ?? COLORS.dust;
    return (
      <View style={[tb.container, { borderColor: color }]}>
        <Text style={[tb.heading, { color, padding: SPACING.md }]}>TRIAL CONCLUDED — {last.outcome!.toUpperCase()}</Text>
      </View>
    );
  }

  const accused = family.find(c => c.id === activeTrial.accusedCharacterId);
  const clan = clans.find(c => c.id === activeTrial.accusingClanId);
  const unlockedAssetActions = getUnlockedAssetActions(ownedAssets);
  const resources: Record<string, number> = { denarii, gratia, gravitas };

  return (
    <View style={tb.container}>
      <TouchableOpacity style={tb.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.75}>
        <View style={tb.headerLeft}>
          <Text style={tb.heading}>⚖️ ACTIVE TRIAL</Text>
          <Text style={tb.sub}>{CHARGE_LABELS[activeTrial.charge] ?? activeTrial.charge} · {accused?.name ?? 'Unknown'}</Text>
          <Text style={tb.sub}>Brought by {clan?.name ?? 'Unknown'} · {activeTrial.turnsRemaining} season{activeTrial.turnsRemaining !== 1 ? 's' : ''} remaining</Text>
        </View>
        <Text style={tb.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      <View style={tb.barsRow}>
        <View style={tb.barWrap}>
          <Text style={tb.barLabel}>Defense</Text>
          <View style={tb.barTrack}><View style={[tb.barFill, { width: `${activeTrial.defenseStrength}%`, backgroundColor: COLORS.laurel }]} /></View>
          <Text style={[tb.barVal, { color: COLORS.laurel }]}>{activeTrial.defenseStrength}</Text>
        </View>
        <View style={tb.barWrap}>
          <Text style={tb.barLabel}>Prosecution</Text>
          <View style={tb.barTrack}><View style={[tb.barFill, { width: `${activeTrial.prosecutionStrength}%`, backgroundColor: COLORS.crimson }]} /></View>
          <Text style={[tb.barVal, { color: COLORS.crimson }]}>{activeTrial.prosecutionStrength}</Text>
        </View>
      </View>
      {expanded && (
        <View style={tb.actions}>
          <Text style={tb.actionsLabel}>DEFENSE ACTIONS</Text>
          {TRIAL_ACTIONS.map(action => {
            const alreadyUsed = activeTrial.actionsUsed.includes(action.id);
            const needsAsset = action.requiresAssetAction && !unlockedAssetActions.includes(action.requiresAssetAction);
            const canAfford = resources[action.cost.resource] >= action.cost.amount;
            const disabled = alreadyUsed || !!needsAsset || !canAfford;
            const resourceLabel = action.cost.resource === 'denarii' ? 'Denarii' : action.cost.resource === 'gratia' ? 'Gratia' : 'Gravitas';
            return (
              <TouchableOpacity key={action.id} style={[tb.actionBtn, disabled && tb.actionBtnDisabled]} disabled={disabled} onPress={() => takeTrialAction(activeTrial.id, action.id)} activeOpacity={0.75}>
                <View style={tb.actionRow}>
                  <Text style={tb.actionLabel}>{action.label}</Text>
                  <Text style={tb.actionCost}>−{action.cost.amount} {resourceLabel}</Text>
                </View>
                <Text style={tb.actionDesc}>{alreadyUsed ? 'Already used this trial.' : needsAsset ? `Requires: ${action.requiresAssetAction?.replace('_', ' ')}` : `Defense +${action.defenseBonus}`}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const tb = StyleSheet.create({
  container: { backgroundColor: COLORS.panelSurface, borderWidth: 2, borderColor: COLORS.crimson, borderRadius: RADIUS.md, marginBottom: SPACING.md, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: SPACING.md },
  headerLeft: { flex: 1 },
  heading: { color: COLORS.crimson, fontFamily: FONTS.display, fontSize: 14, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  sub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 1 },
  chevron: { color: COLORS.dust, fontSize: 14 },
  barsRow: { flexDirection: 'row', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingBottom: SPACING.sm },
  barWrap: { flex: 1 },
  barLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  barTrack: { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  barFill: { height: '100%', borderRadius: 3 },
  barVal: { fontFamily: FONTS.ui, fontSize: 10, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  actions: { borderTopWidth: 1, borderTopColor: COLORS.border, padding: SPACING.md },
  actionsLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.sm },
  actionBtn: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm, minHeight: 44 },
  actionBtnDisabled: { opacity: 0.4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', flex: 1 },
  actionCost: { color: COLORS.denariiColor, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700' },
  actionDesc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 2 },
});

// ─── Bill card ────────────────────────────────────────────────────────────────

function BillCard({ bill }: { bill: Bill }) {
  const { rome, gravitas, expandBill, _expandedBill, _expandedType, voteBill, speechBill, filibusterBill } = useGameStore();
  const isExpandedVote = _expandedBill === bill.id && _expandedType === 'vote';
  const isExpandedSpeech = _expandedBill === bill.id && _expandedType === 'speech';

  const romeMod = calcRomeStatVoteModifier(bill, rome);
  const effectiveSupport = (bill.support ?? 0) + romeMod;
  const supportVerdict = effectiveSupport > 0 ? 'Likely to pass' : effectiveSupport < -20 ? 'Likely to fail' : 'Too close to call';
  const verdictColor = effectiveSupport > 0 ? COLORS.laurel : effectiveSupport < -20 ? COLORS.crimson : COLORS.gold;

  const voteGravitasCost = bill.voteGravitasCost ?? 4;
  const speechGravitasCost = bill.speechGravitasCost ?? 6;

  return (
    <View style={bstyle.card}>
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

      <View style={bstyle.actions}>
        <TouchableOpacity style={[bstyle.actionBtn, isExpandedVote && bstyle.actionBtnActive]} onPress={() => expandBill(bill.id, 'vote')}>
          <Text style={bstyle.actionLabel}>VOTE</Text>
          <Text style={bstyle.actionCost}>-{voteGravitasCost} ⚖️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[bstyle.actionBtn, isExpandedSpeech && bstyle.actionBtnActive]} onPress={() => expandBill(bill.id, 'speech')}>
          <Text style={bstyle.actionLabel}>SPEECH</Text>
          <Text style={bstyle.actionCost}>-{speechGravitasCost} ⚖️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[bstyle.actionBtn, gravitas < 8 && bstyle.actionBtnDisabled]} onPress={() => filibusterBill(bill.id)} disabled={gravitas < 8}>
          <Text style={bstyle.actionLabel}>FILIBUSTER</Text>
          <Text style={bstyle.actionCost}>-8 ⚖️</Text>
        </TouchableOpacity>
      </View>

      {isExpandedVote && (
        <View style={bstyle.expanded}>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.laurel }, gravitas < voteGravitasCost && bstyle.actionBtnDisabled]} onPress={() => voteBill(bill.id, 'vote_for')} disabled={gravitas < voteGravitasCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.laurel }]}>Vote For (+{bill.voteForSupport ?? 15} support)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.crimson }, gravitas < voteGravitasCost && bstyle.actionBtnDisabled]} onPress={() => voteBill(bill.id, 'vote_against')} disabled={gravitas < voteGravitasCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.crimson }]}>Vote Against (−{Math.abs(bill.voteAgainstSupport ?? 15)} support)</Text>
          </TouchableOpacity>
        </View>
      )}
      {isExpandedSpeech && (
        <View style={bstyle.expanded}>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.laurel }, gravitas < speechGravitasCost && bstyle.actionBtnDisabled]} onPress={() => speechBill(bill.id, 'for')} disabled={gravitas < speechGravitasCost}>
            <Text style={[bstyle.subBtnLabel, { color: COLORS.laurel }]}>Speak in Favour</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[bstyle.subBtn, { borderColor: COLORS.crimson }, gravitas < speechGravitasCost && bstyle.actionBtnDisabled]} onPress={() => speechBill(bill.id, 'against')} disabled={gravitas < speechGravitasCost}>
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
  actionCost: { color: COLORS.gravitasColor, fontFamily: FONTS.ui, fontSize: 9, marginTop: 1 },
  expanded: { marginTop: 8, gap: 6 },
  subBtn: { borderWidth: 1, borderRadius: RADIUS.sm, padding: SPACING.sm, minHeight: 44, justifyContent: 'center' },
  subBtnLabel: { fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

// ─── Active Law card ──────────────────────────────────────────────────────────

function ActiveLawCard({ law }: { law: ActiveLaw }) {
  const { proposeRepeal, gravitas, bills, turnNumber } = useGameStore();
  const repealAlreadyActive = bills.some(b => b.type === 'repeal' && b.repeals === law.billId);
  const canRepeal = law.repealable && !repealAlreadyActive && gravitas >= 10;

  const seasonsLeft = law.expiresOnTurn !== undefined ? law.expiresOnTurn - turnNumber : null;

  return (
    <ParchmentCard style={alc.card}>
      <View style={alc.row}>
        <Text style={alc.name}>{law.name}</Text>
        {seasonsLeft !== null && (
          <Text style={alc.expiry}>Expires in {seasonsLeft} season{seasonsLeft !== 1 ? 's' : ''}</Text>
        )}
      </View>
      {law.ongoingEffect && <Text style={alc.ongoing}>Ongoing: {law.ongoingEffect} per season</Text>}
      {law.repealable && (
        <TouchableOpacity
          style={[alc.repealBtn, !canRepeal && alc.repealBtnDisabled]}
          onPress={() => proposeRepeal(law.billId)}
          disabled={!canRepeal}
        >
          <Text style={alc.repealLabel}>
            {repealAlreadyActive ? 'Repeal pending' : 'Propose Repeal (−10 ⚖️)'}
          </Text>
        </TouchableOpacity>
      )}
    </ParchmentCard>
  );
}

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
  const { bills, submitBill, gravitas, crisisLevel, rome } = useGameStore();
  const existing = new Set(bills.map(b => b.name));

  const available = ALL_BILL_TEMPLATES.filter(t => {
    if (existing.has(t.name)) return false;
    if (!t.submissionCondition) return true;
    // Evaluate submissionCondition string safely
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
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableOpacity style={modal.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={modal.sheet}>
        <View style={modal.handle} />
        <Text style={modal.title}>Submit a Bill</Text>
        <Text style={modal.cost}>Cost: 10 Gravitas</Text>
        <ScrollView>
          {available.map((t, i) => {
            const romeMod = calcRomeStatVoteModifier(t as Bill, rome);
            return (
              <TouchableOpacity
                key={i}
                style={[modal.item, gravitas < 10 && modal.itemDisabled]}
                disabled={gravitas < 10}
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
        </ScrollView>
      </View>
    </Modal>
  );
}

const modal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: COLORS.panelSurface, borderTopColor: COLORS.border, borderTopWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12, padding: SPACING.md, paddingBottom: SPACING.xl, maxHeight: '75%' },
  handle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: SPACING.md },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  cost: { color: COLORS.gravitasColor, fontFamily: FONTS.ui, fontSize: 12, textAlign: 'center', marginBottom: SPACING.md },
  item: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  itemDisabled: { opacity: 0.4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  itemName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600', flex: 1 },
  itemType: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 9, letterSpacing: 1 },
  itemDesc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, marginTop: 3 },
  itemMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  itemMetaText: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11 },
  itemMod: { color: COLORS.senatBlue, fontFamily: FONTS.ui, fontSize: 11 },
  empty: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', textAlign: 'center', marginTop: SPACING.lg },
});

// ─── CuriaScreen ──────────────────────────────────────────────────────────────

export default function CuriaScreen() {
  const { rome, crisisLevel, bills, activeLaws, gravitas, turnNumber } = useGameStore();
  const [submitVisible, setSubmitVisible] = useState(false);
  const [activeLawsExpanded, setActiveLawsExpanded] = useState(true);
  const [romeStatModal, setRomeStatModal] = useState<RomeStat | null>(null);
  const crisis = getCrisisInfo(crisisLevel);
  const crisisColor = getCrisisColour(crisisLevel);
  const romeMods = calcRomeStatModifiers(rome);

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>CURIA</Text>
        <Text style={styles.subtitle}>Senate & Legislation</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}>
        <TrialBanner />

        {/* Rome stats — tappable for detail modal */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>ROME — STATE OF THE REPUBLIC</Text>
          <Text style={styles.panelSub}>Tap a stat to see its effects. These are Rome's stats — separate from your family resources.</Text>
          <StatBar
            label={`Stability — ${romeMods.stabilityLabel}`}
            value={rome.stability}
            color={COLORS.laurel}
            thresholdMarks={[20, 40, 70, 85]}
            onPress={() => setRomeStatModal('stability')}
          />
          <StatBar
            label={`Plebs Mood — ${romeMods.plebsLabel}`}
            value={rome.plebs}
            color={COLORS.purple}
            thresholdMarks={[20, 40, 70, 85]}
            onPress={() => setRomeStatModal('plebs')}
          />
          <StatBar
            label={`Treasury — ${romeMods.treasuryLabel}`}
            value={rome.treasury}
            color={COLORS.denariiColor}
            thresholdMarks={[10, 25, 65, 85]}
            onPress={() => setRomeStatModal('treasury')}
          />
        </View>

        {/* Crisis */}
        <View style={[styles.panel, { borderColor: crisisColor }]}>
          <Text style={[styles.crisisTitle, { color: crisisColor }]}>{crisis.title}</Text>
          <Text style={styles.crisisNarr}>{crisis.narrative}</Text>
          {crisis.gravitasPenalty > 0 && (
            <Text style={styles.crisisPenalty}>
              Penalties: −{crisis.gravitasPenalty} Gravitas/season
              {crisis.dignitasPenalty > 0 ? `, −${crisis.dignitasPenalty} Dignitas/season` : ''}
            </Text>
          )}
          <View style={styles.crisisMeter}>
            <View style={[styles.crisisFill, { width: `${crisisLevel}%`, backgroundColor: crisisColor }]} />
          </View>
          <Text style={styles.crisisLevel}>Crisis: {crisisLevel} / 100</Text>
        </View>

        {/* Active bills */}
        <View style={styles.billsHeader}>
          <Text style={styles.sectionLabel}>LEGES — ACTIVE BILLS</Text>
          <TouchableOpacity
            style={[styles.submitBtn, gravitas < 10 && styles.submitBtnDisabled]}
            onPress={() => setSubmitVisible(true)}
            disabled={gravitas < 10}
          >
            <Text style={styles.submitBtnLabel}>+ Submit Bill</Text>
            <Text style={styles.submitBtnCost}>−10 ⚖️</Text>
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
  crisisTitle: { fontFamily: FONTS.display, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  crisisNarr: { color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, lineHeight: 18, marginBottom: 8 },
  crisisPenalty: { color: COLORS.crimson, fontFamily: FONTS.ui, fontSize: 11, marginBottom: 6 },
  crisisMeter: { height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  crisisFill: { height: '100%', borderRadius: 3 },
  crisisLevel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, marginTop: 4, textAlign: 'right' },
  billsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  submitBtnCost: { color: COLORS.gravitasColor, fontFamily: FONTS.ui, fontSize: 11 },
  emptyText: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, textAlign: 'center', marginTop: SPACING.lg },
  activeLawsSection: { marginTop: SPACING.md },
  chevron: { color: COLORS.dust, fontSize: 14 },
});
