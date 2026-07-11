/**
 * TrialSessionModal — Phase 4, Chunk P4-E; verdict presentation reworked
 * Chunk P4-F.
 *
 * Trial day: a full-screen native Modal (same idiom as BattleScreen — always
 * renders above everything else, self-gates, blocks input to the rest of the
 * app while up), mounted once at the App root. Plays the drawn 3-beat
 * sequence (or fast-resolves it), then hands off to VerdictScene for the
 * full verdict presentation.
 *
 * VerdictScene needs two things the store discards the instant a trial
 * resolves (concludeTrialSession sets `session: null`): the beat-by-beat
 * recap and the consequence narration. Rather than persisting either onto
 * TrialState, this component captures both client-side:
 *  - `recapRef` accumulates each beat's resolution as it's answered
 *    (evaluateBeatResponse — the exact pure function the store itself
 *    calls) or, on fast-resolve, by replaying the remaining beats locally
 *    with the same pickBestResponse/applyBeatOutcome pair
 *    fastResolveTrialSession uses internally — same functions, same order,
 *    so the replay is guaranteed identical to what the store computed.
 *  - consequence lines are read straight off the log: the length of
 *    `s.log` just before the resolving call vs. just after brackets exactly
 *    the narration resolveTrialOutcome/checkCalumnia pushed for this trial.
 */
import React, { useRef, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { getTrialBeat, evaluateBeatResponse, pickBestResponse, applyBeatOutcome } from '../../engine/trialBeatEngine';
import { TRIAL_CHARGE_DEFS } from '../../data/trialCharges';
import type { TrialState, BeatResponse, TrialBeatResolution } from '../../models/trial';
import VerdictScene, { type ConsequenceLine } from './VerdictScene';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export default function TrialSessionModal() {
  const activeTrial = useGameStore(s => s.trials.find(t => t.status === 'in_session'));
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);
  const answerTrialBeat = useGameStore(s => s.answerTrialBeat);
  const fastResolveTrialSession = useGameStore(s => s.fastResolveTrialSession);

  const [verdictData, setVerdictData] = useState<{
    trial: TrialState;
    recap: TrialBeatResolution[];
    consequenceLines: ConsequenceLine[];
  } | null>(null);
  const recapRef = useRef<TrialBeatResolution[]>([]);

  const isOpen = !!activeTrial || !!verdictData;
  if (!isOpen) return null;

  function checkResolved(trialId: string, preLogLength: number) {
    const updated = useGameStore.getState().trials.find(t => t.id === trialId);
    if (updated?.status === 'resolved' && updated.outcome) {
      const newLog = useGameStore.getState().log;
      const consequenceLines: ConsequenceLine[] = newLog.slice(preLogLength).map(l => ({
        text: l.text,
        type: (l.type === 'good' || l.type === 'bad') ? l.type : 'neutral',
      }));
      setVerdictData({ trial: updated, recap: recapRef.current, consequenceLines });
      recapRef.current = [];
    }
  }

  function handleAnswer(beatId: string, responseId: string) {
    if (!activeTrial) return;
    const beat = getTrialBeat(beatId);
    const response = beat?.responses.find(r => r.id === responseId);
    const speaker = family.find(c => c.id === activeTrial.speakerId);
    if (beat && response && speaker) {
      const { succeeded, swing } = evaluateBeatResponse(response, speaker, activeTrial);
      recapRef.current = [...recapRef.current, { beatId, responseId, succeeded, swing }];
    }
    const preLogLength = useGameStore.getState().log.length;
    answerTrialBeat(activeTrial.id, beatId, responseId);
    checkResolved(activeTrial.id, preLogLength);
  }

  function handleFastResolve() {
    if (!activeTrial) return;
    const speaker = family.find(c => c.id === activeTrial.speakerId);
    if (speaker) {
      let working = activeTrial;
      const extra: TrialBeatResolution[] = [];
      while (working.session && working.session.currentBeatIndex < working.session.beatIds.length) {
        const beatId = working.session.beatIds[working.session.currentBeatIndex];
        const beat = getTrialBeat(beatId);
        if (!beat) break;
        const { response, succeeded, swing } = pickBestResponse(beat, speaker, working);
        extra.push({ beatId, responseId: response.id, succeeded, swing });
        working = applyBeatOutcome(working, beat, response, succeeded, swing);
      }
      recapRef.current = [...recapRef.current, ...extra];
    }
    const preLogLength = useGameStore.getState().log.length;
    fastResolveTrialSession(activeTrial.id);
    checkResolved(activeTrial.id, preLogLength);
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
        {verdictData ? (
          <VerdictScene
            trial={verdictData.trial}
            recap={verdictData.recap}
            consequenceLines={verdictData.consequenceLines}
            onContinue={() => setVerdictData(null)}
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
});
