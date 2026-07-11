// ─── Phase 4, Chunk P4-D — the Basilica ──────────────────────────────────────
// Full-screen trial preparation: Logos/Pathos/Ethos sections, the Approach
// selector, a speaker picker, both strength bars (yours exact, theirs an
// estimate band unless you hold a Secret on them), and the seasons-until-
// trial countdown. Pulls directly from useGameStore (P4-A/B/C component
// convention — DossierPanel/LeaderDetailPanel — not prop-drilled like the
// older ProvinceSheet).

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import type { TrialApproach, PrepSection } from '../../models/trial';
import { TRIAL_CHARGE_DEFS } from '../../data/trialCharges';
import { TRIAL_PREP_VERBS } from '../../data/trialPrep';
import { SECRET_CLASS_BY_TYPE } from '../../data/secretDefinitions';
import {
  computeTotalPrepStrength, estimateOpponentStrength,
  gatherEvidenceCost, gatherEvidenceBonus, presentSecretEvidenceBonus,
  prepareOrationBonus, invokeAncestorsBonus,
} from '../../engine/trialEngine';
import { mapSecretTypeToTrialCharge } from '../../engine/secretEngine';
import { getUnlockedAssetActions } from '../../engine/assetEngine';
import { BALANCE } from '../../data/balance';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import InfoTap from '../shared/InfoTap';

// ─── Small pickers ────────────────────────────────────────────────────────────

function AgentPickerModal({
  visible, title, onClose, onPick,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (agentId: string, intrigus: number) => void;
}) {
  const family = useGameStore(s => s.family);
  const eligible = family.filter(c => c.age >= 18);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pk.modal}>
          <Text style={pk.title}>{title}</Text>
          {eligible.map(c => (
            <TouchableOpacity
              key={c.id}
              style={pk.row}
              onPress={() => { onPick(c.id, c.skills.intrigus); onClose(); }}
            >
              <Text style={pk.rowLabel}>{c.isPlayer ? '⭐ ' : ''}{c.name}</Text>
              <Text style={pk.rowSub}>+{gatherEvidenceBonus(c.skills.intrigus)} · Intrigus {c.skills.intrigus}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

function ClanBribePickerModal({
  visible, trialId, bribedClanIds, onClose,
}: {
  visible: boolean;
  trialId: string;
  bribedClanIds: string[];
  onClose: () => void;
}) {
  const clans = useGameStore(s => s.clans);
  const bribeTrialJurors = useGameStore(s => s.bribeTrialJurors);
  const available = clans.filter(c => !bribedClanIds.includes(c.id));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pk.modal}>
          <Text style={pk.title}>BRIBE WHICH BLOC?</Text>
          {available.length === 0 && <Text style={pk.empty}>Every bloc has already been bought.</Text>}
          {available.map(c => (
            <TouchableOpacity
              key={c.id}
              style={pk.row}
              onPress={() => { bribeTrialJurors(trialId, c.id); onClose(); }}
            >
              <Text style={pk.rowLabel}>{c.name}</Text>
              <Text style={pk.rowSub}>+{BALANCE.trials.prep.bribeJurorsBonusPerBloc}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={pk.cancelBtn} onPress={onClose}>
            <Text style={pk.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const pk = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: SPACING.lg },
  modal: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.md },
  title: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 2, marginBottom: SPACING.sm },
  empty: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, paddingVertical: SPACING.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, flexShrink: 1, marginRight: SPACING.sm },
  rowSub: { color: COLORS.gold, fontFamily: FONTS.ui, fontSize: 12 },
  cancelBtn: { marginTop: SPACING.sm, alignItems: 'center', paddingVertical: 6 },
  cancelBtnText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11 },
});

// ─── Section header (collapsible) ────────────────────────────────────────────

function SectionHeader({ label, expanded, onToggle }: { label: string; expanded: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={sh.row} onPress={onToggle} activeOpacity={0.75}>
      <Text style={sh.label}>{label}</Text>
      <Text style={sh.chevron}>{expanded ? '▲' : '▼'}</Text>
    </TouchableOpacity>
  );
}

const sh = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  chevron: { color: COLORS.dust, fontSize: 12 },
});

// ─── Verb row ─────────────────────────────────────────────────────────────────

function VerbRow({
  label, description, cost, effectPreview, disabled, disabledReason, onPress,
}: {
  label: string;
  description: string;
  cost: string;
  effectPreview: string;
  disabled: boolean;
  disabledReason?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[vr.btn, disabled && vr.btnDisabled]} disabled={disabled} onPress={onPress} activeOpacity={0.75}>
      <View style={vr.row}>
        <Text style={vr.label}>{label}</Text>
        <Text style={vr.cost}>{cost}</Text>
      </View>
      <Text style={vr.desc}>{disabled && disabledReason ? disabledReason : description}</Text>
      <Text style={vr.effect}>{effectPreview}</Text>
    </TouchableOpacity>
  );
}

const vr = StyleSheet.create({
  btn: { backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.sm, marginBottom: SPACING.sm },
  btnDisabled: { opacity: 0.45 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600', flex: 1 },
  cost: { color: COLORS.denariiColor, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700' },
  desc: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, marginTop: 2 },
  effect: { color: COLORS.laurel, fontFamily: FONTS.ui, fontSize: 11, fontWeight: '700', marginTop: 3 },
});

// ─── BasilicaSheet ────────────────────────────────────────────────────────────

const APPROACH_LABELS: Record<TrialApproach, string> = {
  ferocity: 'Ferocity', procedure: 'Procedure', sympathy: 'Sympathy',
};

export default function BasilicaSheet({ trialId, onClose }: { trialId: string; onClose: () => void }) {
  const trial = useGameStore(s => s.trials.find(t => t.id === trialId));
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const secrets = useGameStore(s => s.secrets);
  const turnNumber = useGameStore(s => s.turnNumber);
  const fides = useGameStore(s => s.fides);
  const denarii = useGameStore(s => s.denarii);
  const lifetimeDignitas = useGameStore(s => s.lifetimeDignitas);
  const ownedAssets = useGameStore(s => s.ownedAssets);

  const setTrialApproach = useGameStore(s => s.setTrialApproach);
  const setTrialSpeaker = useGameStore(s => s.setTrialSpeaker);
  const gatherTrialEvidence = useGameStore(s => s.gatherTrialEvidence);
  const presentSecretAsEvidence = useGameStore(s => s.presentSecretAsEvidence);
  const secureTrialWitness = useGameStore(s => s.secureTrialWitness);
  const prepareTrialOration = useGameStore(s => s.prepareTrialOration);
  const invokeTrialAncestors = useGameStore(s => s.invokeTrialAncestors);
  const bribeTrialPraetor = useGameStore(s => s.bribeTrialPraetor);
  const intimidateTrialWitness = useGameStore(s => s.intimidateTrialWitness);

  const [expanded, setExpanded] = useState<Record<PrepSection, boolean>>({ logos: true, pathos: false, ethos: false });
  const [gatherPickerOpen, setGatherPickerOpen] = useState(false);
  const [bribePickerOpen, setBribePickerOpen] = useState(false);
  const [speakerPickerOpen, setSpeakerPickerOpen] = useState(false);

  if (!trial) return null;

  const locked = turnNumber >= trial.startsSeason || trial.status !== 'preparing';
  const chargeDef = TRIAL_CHARGE_DEFS[trial.charge];
  const seasonsRemaining = Math.max(0, trial.startsSeason - turnNumber);

  const opponentLeaderId = trial.seat === 'defense'
    ? (trial.prosecutor.kind === 'leader' ? trial.prosecutor.leaderId : null)
    : (trial.defendant.kind === 'leader' ? trial.defendant.leaderId : null);
  const opponentLeader = opponentLeaderId
    ? clans.flatMap(c => c.leaders).find(l => l.id === opponentLeaderId)
    : null;
  const familyDefendantId = trial.defendant.kind === 'family' ? trial.defendant.characterId : null;
  const opponentName = opponentLeader?.name
    ?? (familyDefendantId ? family.find(c => c.id === familyDefendantId)?.name : null)
    ?? 'Unknown';

  const hasIntel = !!opponentLeaderId && secrets.some(sec =>
    sec.holder === 'player' && sec.subject.kind === 'leader' &&
    sec.subject.leaderId === opponentLeaderId && sec.status === 'held'
  );
  const estimate = estimateOpponentStrength(trial.npcStrength, hasIntel);
  const playerStrength = computeTotalPrepStrength(trial.playerPrep, trial.approach);
  const speaker = family.find(c => c.id === trial.speakerId);

  const eligibleEvidenceSecrets = opponentLeaderId
    ? secrets.filter(s =>
        s.holder === 'player' && s.status === 'held' &&
        s.subject.kind === 'leader' && s.subject.leaderId === opponentLeaderId &&
        SECRET_CLASS_BY_TYPE[s.type] === 'criminal' &&
        mapSecretTypeToTrialCharge(s.type) === trial.charge
      )
    : [];

  const gatherUses = trial.playerPrep.actionsUsed.filter(a => a === 'gather_evidence').length;
  const orationUses = trial.playerPrep.actionsUsed.filter(a => a === 'prepare_oration').length;
  const unlockedAssetActions = getUnlockedAssetActions(ownedAssets);

  const verbDesc = (id: string) => TRIAL_PREP_VERBS.find(v => v.id === id)?.description ?? '';

  return (
    <View style={s.container}>
      <View style={s.handle} />
      <ScrollView contentContainerStyle={s.scrollContent}>
        <View style={s.header}>
          <InfoTap termId="basilica">
            <Text style={s.title}>THE BASILICA</Text>
          </InfoTap>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={s.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.subtitle}>
          {chargeDef.displayName} · {trial.seat === 'defense' && familyDefendantId
            ? `Trial of ${family.find(c => c.id === familyDefendantId)?.name ?? 'you'}`
            : `vs. ${opponentName}`}
        </Text>
        <Text style={s.countdown}>{locked ? 'Approach locked — the trial has begun.' : `${seasonsRemaining} season${seasonsRemaining !== 1 ? 's' : ''} to prepare`}</Text>

        {/* Strength bars */}
        <View style={s.barsRow}>
          <View style={s.barWrap}>
            <Text style={s.barLabel}>Your Strength</Text>
            <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.min(100, playerStrength)}%`, backgroundColor: COLORS.laurel }]} /></View>
            <Text style={[s.barVal, { color: COLORS.laurel }]}>{Math.round(playerStrength)}</Text>
          </View>
          <View style={s.barWrap}>
            <Text style={s.barLabel}>Their Strength</Text>
            <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.min(100, estimate.exact ? estimate.value : estimate.high)}%`, backgroundColor: COLORS.crimson }]} /></View>
            <Text style={[s.barVal, { color: COLORS.crimson }]}>
              {estimate.exact ? Math.round(estimate.value) : `${Math.round(estimate.low)}–${Math.round(estimate.high)}`}
            </Text>
          </View>
        </View>

        {/* Approach selector */}
        <InfoTap termId="approach"><Text style={s.groupLabel}>APPROACH</Text></InfoTap>
        <View style={s.approachRow}>
          {(['ferocity', 'procedure', 'sympathy'] as TrialApproach[]).map(a => (
            <TouchableOpacity
              key={a}
              disabled={locked}
              style={[s.approachPill, trial.approach === a && s.approachPillActive, locked && s.approachPillDisabled]}
              onPress={() => setTrialApproach(trial.id, a)}
            >
              <Text style={[s.approachText, trial.approach === a && s.approachTextActive]}>{APPROACH_LABELS[a]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Speaker picker */}
        <Text style={s.groupLabel}>SPEAKER</Text>
        <TouchableOpacity style={s.speakerBtn} disabled={locked} onPress={() => setSpeakerPickerOpen(true)}>
          <Text style={s.speakerName}>{speaker?.name ?? 'Unknown'}</Text>
          <Text style={s.speakerSub}>Rhetoric {speaker?.skills.rhetoric ?? 0} {locked ? '' : '· change'}</Text>
        </TouchableOpacity>

        {/* Logos */}
        <SectionHeader label="Logos" expanded={expanded.logos} onToggle={() => setExpanded(e => ({ ...e, logos: !e.logos }))} />
        {expanded.logos && (
          <View style={s.sectionBody}>
            <VerbRow
              label="Gather Evidence"
              description={verbDesc('gather_evidence')}
              cost={`−${gatherEvidenceCost(gatherUses)} 🤝`}
              effectPreview={`Used ${gatherUses}/${BALANCE.trials.prep.gatherEvidenceMaxUses}`}
              disabled={locked || gatherUses >= BALANCE.trials.prep.gatherEvidenceMaxUses || fides < gatherEvidenceCost(gatherUses)}
              onPress={() => setGatherPickerOpen(true)}
            />
            {eligibleEvidenceSecrets.map(secret => (
              <VerbRow
                key={secret.id}
                label="Present a Secret as Evidence"
                description={secret.flavorText}
                cost="Consumes the Secret"
                effectPreview={`+${presentSecretEvidenceBonus(secret.potency)}`}
                disabled={locked}
                onPress={() => presentSecretAsEvidence(trial.id, secret.id)}
              />
            ))}
          </View>
        )}

        {/* Pathos */}
        <SectionHeader label="Pathos" expanded={expanded.pathos} onToggle={() => setExpanded(e => ({ ...e, pathos: !e.pathos }))} />
        {expanded.pathos && (
          <View style={s.sectionBody}>
            <VerbRow
              label="Secure a Witness"
              description={verbDesc('secure_witness')}
              cost={`−${BALANCE.trials.prep.secureWitnessCostDenarii} 💰`}
              effectPreview={`${trial.playerPrep.witnesses.length}/${BALANCE.trials.prep.secureWitnessMaxSlots} slots used`}
              disabled={locked || trial.playerPrep.witnesses.length >= BALANCE.trials.prep.secureWitnessMaxSlots || denarii < BALANCE.trials.prep.secureWitnessCostDenarii}
              onPress={() => secureTrialWitness(trial.id)}
            />
            <VerbRow
              label="Prepare an Oration"
              description={verbDesc('prepare_oration')}
              cost={`−${BALANCE.trials.prep.prepareOrationCostFides} 🤝`}
              effectPreview={`+${prepareOrationBonus(speaker?.skills.rhetoric ?? 0)} · Used ${orationUses}/${BALANCE.trials.prep.prepareOrationMaxUses}`}
              disabled={locked || orationUses >= BALANCE.trials.prep.prepareOrationMaxUses || fides < BALANCE.trials.prep.prepareOrationCostFides}
              onPress={() => prepareTrialOration(trial.id)}
            />
            <VerbRow
              label="Intimidate a Key Witness"
              description={verbDesc('intimidate_witness')}
              cost={`−${BALANCE.trials.prep.intimidateWitnessCostDenarii} 💰`}
              effectPreview={`Opponent −${BALANCE.trials.prep.intimidateWitnessNpcStrengthReduction}`}
              disabled={
                locked ||
                trial.playerPrep.actionsUsed.includes('intimidate_witness') ||
                !unlockedAssetActions.includes('intimidate_witness') ||
                denarii < BALANCE.trials.prep.intimidateWitnessCostDenarii
              }
              disabledReason={!unlockedAssetActions.includes('intimidate_witness') ? 'Requires the Gladiator School.' : undefined}
              onPress={() => intimidateTrialWitness(trial.id)}
            />
          </View>
        )}

        {/* Ethos */}
        <SectionHeader label="Ethos" expanded={expanded.ethos} onToggle={() => setExpanded(e => ({ ...e, ethos: !e.ethos }))} />
        {expanded.ethos && (
          <View style={s.sectionBody}>
            <VerbRow
              label="Invoke the Ancestors"
              description={verbDesc('invoke_ancestors')}
              cost="Free"
              effectPreview={`+${invokeAncestorsBonus(lifetimeDignitas)}`}
              disabled={locked || trial.playerPrep.actionsUsed.includes('invoke_ancestors')}
              onPress={() => invokeTrialAncestors(trial.id)}
            />
            <VerbRow
              label="Bribe the Jurors"
              description={verbDesc('bribe_jurors')}
              cost={`−${BALANCE.trials.prep.bribeJurorsCostPerBlocDenarii} 💰 / bloc`}
              effectPreview={`+${BALANCE.trials.prep.bribeJurorsBonusPerBloc} per bloc · ${trial.playerPrep.bribedClanIds.length} bought`}
              disabled={locked || denarii < BALANCE.trials.prep.bribeJurorsCostPerBlocDenarii}
              onPress={() => setBribePickerOpen(true)}
            />
            <VerbRow
              label="Bribe the Praetor"
              description={verbDesc('bribe_praetor')}
              cost={`−${BALANCE.trials.prep.bribePraetorCostDenarii} 💰`}
              effectPreview={`+${BALANCE.trials.prep.bribePraetorBonus}`}
              disabled={locked || trial.playerPrep.praetorBribed || denarii < BALANCE.trials.prep.bribePraetorCostDenarii}
              onPress={() => bribeTrialPraetor(trial.id)}
            />
          </View>
        )}
      </ScrollView>

      <AgentPickerModal
        visible={gatherPickerOpen}
        title="WHO GATHERS EVIDENCE?"
        onClose={() => setGatherPickerOpen(false)}
        onPick={(agentId) => gatherTrialEvidence(trial.id, agentId)}
      />
      <ClanBribePickerModal
        visible={bribePickerOpen}
        trialId={trial.id}
        bribedClanIds={trial.playerPrep.bribedClanIds}
        onClose={() => setBribePickerOpen(false)}
      />
      <Modal visible={speakerPickerOpen} transparent animationType="fade" onRequestClose={() => setSpeakerPickerOpen(false)}>
        <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={() => setSpeakerPickerOpen(false)}>
          <View style={pk.modal}>
            <Text style={pk.title}>WHO ARGUES THE CASE?</Text>
            {family.filter(c => c.age >= 18).map(c => (
              <TouchableOpacity
                key={c.id}
                style={pk.row}
                onPress={() => { setTrialSpeaker(trial.id, c.id); setSpeakerPickerOpen(false); }}
              >
                <Text style={pk.rowLabel}>{c.isPlayer ? '⭐ ' : ''}{c.name}</Text>
                <Text style={pk.rowSub}>Rhetoric {c.skills.rhetoric}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={pk.cancelBtn} onPress={() => setSpeakerPickerOpen(false)}>
              <Text style={pk.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginTop: SPACING.sm },
  scrollContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  closeBtn: { color: COLORS.dust, fontSize: 20 },
  subtitle: { color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, marginTop: 4 },
  countdown: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2, marginBottom: SPACING.md },
  barsRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.md },
  barWrap: { flex: 1 },
  barLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  barTrack: { height: 8, backgroundColor: COLORS.panelElevated, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  barFill: { height: '100%', borderRadius: 4 },
  barVal: { fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  groupLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', marginBottom: SPACING.xs, marginTop: SPACING.sm },
  approachRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  approachPill: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingVertical: 8, alignItems: 'center' },
  approachPillActive: { borderColor: COLORS.gold, backgroundColor: COLORS.goldDim + '22' },
  approachPillDisabled: { opacity: 0.5 },
  approachText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 12, fontWeight: '600' },
  approachTextActive: { color: COLORS.gold },
  speakerBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.md },
  speakerName: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600' },
  speakerSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  sectionBody: { paddingTop: SPACING.sm, paddingBottom: SPACING.xs },
});
