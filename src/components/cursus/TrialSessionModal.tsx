/**
 * TrialSessionModal — Phase 4, Chunk P4-E
 *
 * Trial day: a full-screen native Modal (same idiom as BattleScreen — always
 * renders above everything else, self-gates, blocks input to the rest of the
 * app while up), mounted once at the App root. Plays the drawn 3-beat
 * sequence (or fast-resolves it), then shows a plain-text outcome screen —
 * the full-screen verdict scene with bars/stamp/animation is P4-F's polish,
 * not this chunk's.
 */
import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getTrialBeat } from '../../engine/trialBeatEngine';
import { TRIAL_CHARGE_DEFS } from '../../data/trialCharges';
import type { TrialOutcome, TrialState, BeatResponse } from '../../models/trial';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const OUTCOME_LABEL: Record<TrialOutcome, string> = {
  acquitted: 'ACQUITTED', dismissed: 'DISMISSED', fined: 'FINED', exiled: 'EXILED', executed: 'EXECUTED',
};
const OUTCOME_COLOR: Record<TrialOutcome, string> = {
  acquitted: COLORS.laurel, dismissed: COLORS.laurel, fined: COLORS.goldDim, exiled: COLORS.crimson, executed: COLORS.crimson,
};

export default function TrialSessionModal() {
  const activeTrial = useGameStore(s => s.trials.find(t => t.status === 'in_session'));
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const answerTrialBeat = useGameStore(s => s.answerTrialBeat);
  const fastResolveTrialSession = useGameStore(s => s.fastResolveTrialSession);

  const [outcomeScreen, setOutcomeScreen] = useState<{ trialId: string; outcome: TrialOutcome } | null>(null);

  const isOpen = !!activeTrial || !!outcomeScreen;
  if (!isOpen) return null;

  function checkResolved(trialId: string) {
    const updated = useGameStore.getState().trials.find(t => t.id === trialId);
    if (updated?.status === 'resolved' && updated.outcome) {
      setOutcomeScreen({ trialId, outcome: updated.outcome });
    }
  }

  function handleAnswer(beatId: string, responseId: string) {
    if (!activeTrial) return;
    answerTrialBeat(activeTrial.id, beatId, responseId);
    checkResolved(activeTrial.id);
  }

  function handleFastResolve() {
    if (!activeTrial) return;
    fastResolveTrialSession(activeTrial.id);
    checkResolved(activeTrial.id);
  }

  const opponentLeaderId = activeTrial
    ? (activeTrial.seat === 'defense'
        ? (activeTrial.prosecutor.kind === 'leader' ? activeTrial.prosecutor.leaderId : null)
        : (activeTrial.defendant.kind === 'leader' ? activeTrial.defendant.leaderId : null))
    : null;
  const opponentLeader = opponentLeaderId ? clans.flatMap(c => c.leaders).find(l => l.id === opponentLeaderId) : null;
  const defendantId = activeTrial?.defendant.kind === 'family' ? activeTrial.defendant.characterId : null;
  const defendantName = opponentLeader?.name
    ?? (defendantId ? family.find(c => c.id === defendantId)?.name : null)
    ?? 'the accused';
  const chargeDef = activeTrial ? TRIAL_CHARGE_DEFS[activeTrial.charge] : null;
  const speaker = activeTrial ? family.find(c => c.id === activeTrial.speakerId) : null;

  const currentBeat = activeTrial?.session
    ? getTrialBeat(activeTrial.session.beatIds[activeTrial.session.currentBeatIndex])
    : null;

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {outcomeScreen ? (
          <OutcomeView
            outcome={outcomeScreen.outcome}
            onContinue={() => setOutcomeScreen(null)}
          />
        ) : activeTrial && chargeDef && currentBeat ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text style={styles.eyebrow}>TRIAL DAY</Text>
            <Text style={styles.title}>{chargeDef.displayName}</Text>
            <Text style={styles.subtitle}>
              {activeTrial.seat === 'defense' ? `vs. ${opponentLeader?.name ?? 'the accuser'}` : `vs. ${defendantName}`}
            </Text>
            <Text style={styles.speakerLine}>
              {speaker?.name ?? 'Your speaker'} argues the case — Rhetoric {speaker?.skills.rhetoric ?? 0}, Intrigus {speaker?.skills.intrigus ?? 0}
            </Text>

            <View style={styles.beatCounter}>
              <Text style={styles.beatCounterText}>
                Beat {(activeTrial.session?.currentBeatIndex ?? 0) + 1} of {activeTrial.session?.beatIds.length ?? 0}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.complication}>{currentBeat.complication}</Text>
              <View style={styles.responses}>
                {currentBeat.responses.map(r => {
                  const disabled = r.kind === 'prep' && !responseAvailable(r, activeTrial);
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.responseBtn, disabled && styles.responseBtnDisabled]}
                      disabled={disabled}
                      onPress={() => handleAnswer(currentBeat.id, r.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.responseLabel}>{r.label}</Text>
                      {r.kind === 'stat' && (
                        <Text style={styles.responseHint}>{r.skill} ≥ {r.difficulty}</Text>
                      )}
                      {r.kind === 'prep' && (
                        <Text style={styles.responseHint}>{disabled ? 'Requirement not met' : 'Uses prepared evidence'}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <TouchableOpacity style={styles.fastResolveBtn} onPress={handleFastResolve} activeOpacity={0.75}>
              <Text style={styles.fastResolveText}>Let {speaker?.name ?? 'your speaker'} argue it</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

function responseAvailable(r: BeatResponse, trial: TrialState): boolean {
  if (!r.requires) return true;
  switch (r.requires.kind) {
    case 'witness': return trial.playerPrep.witnesses.some(w => !w.attacked);
    case 'secret_evidence': return trial.playerPrep.actionsUsed.includes('present_secret_evidence');
    case 'evidence_uses': return trial.playerPrep.actionsUsed.filter(a => a === 'gather_evidence').length >= r.requires!.min;
  }
}

// ─── Outcome view (plain — P4-F replaces this with the full verdict scene) ───

function OutcomeView({ outcome, onContinue }: { outcome: TrialOutcome; onContinue: () => void }) {
  return (
    <View style={styles.outcomeRoot}>
      <Text style={styles.outcomeEyebrow}>THE VERDICT</Text>
      <Text style={[styles.outcomeStamp, { color: OUTCOME_COLOR[outcome] }]}>{OUTCOME_LABEL[outcome]}</Text>
      <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.75}>
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xl },
  eyebrow: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 3, textAlign: 'center' },
  title: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  subtitle: { color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 14, textAlign: 'center', marginTop: 4 },
  speakerLine: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, textAlign: 'center', marginTop: SPACING.sm },
  beatCounter: { alignItems: 'center', marginTop: SPACING.md, marginBottom: SPACING.sm },
  beatCounterText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  card: {
    backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.gold,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm,
  },
  complication: { color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 15, lineHeight: 22, marginBottom: SPACING.md },
  responses: { gap: SPACING.sm },
  responseBtn: {
    backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, minHeight: 44, justifyContent: 'center',
  },
  responseBtnDisabled: { opacity: 0.4 },
  responseLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600' },
  responseHint: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  fastResolveBtn: {
    marginTop: SPACING.lg, alignItems: 'center', paddingVertical: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
  },
  fastResolveText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 12, letterSpacing: 1 },
  outcomeRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  outcomeEyebrow: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 12, letterSpacing: 4 },
  outcomeStamp: { fontFamily: FONTS.display, fontSize: 36, fontWeight: '700', marginTop: SPACING.md, letterSpacing: 2 },
  continueBtn: {
    marginTop: SPACING.xl, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl,
  },
  continueText: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600' },
});
