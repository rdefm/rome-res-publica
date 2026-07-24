/**
 * VerdictScene — Phase 4, Chunk P4-F
 *
 * The full-screen verdict presentation: charge card -> both strength bars
 * fill to their final values (jury lean shown as a nudge on the marker) ->
 * beat recaps stamp in -> the verdict stamp (a themed slam animation) ->
 * consequence summary card. Used identically for both seats — this is the
 * game's screenshot, so the polish lives here (parchment/wax-seal tokens,
 * restrained motion). No choices inside the scene; tapping anywhere
 * fast-forwards to the end, same "skip the theater" courtesy as
 * SeasonOverlay's continue button.
 *
 * Pure presentation: recomputes computeVerdict/computeNpcPerformance itself
 * from the resolved TrialState (both are deterministic — design invariant
 * 2 — so re-calling them here reproduces exactly what resolveTrialOutcome
 * decided) rather than threading extra fields through TrialState/the save
 * schema. `recap` and `consequenceLines` are the two things that genuinely
 * don't survive on the resolved trial (session is nulled at resolution) —
 * TrialSessionModal captures both client-side and passes them down.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { useGameStore } from '../../state/gameStore';
import { getTrialBeat, computeNpcPerformance } from '../../engine/trialBeatEngine';
import { computeVerdict, findOpponentLeader } from '../../engine/trialEngine';
import { TRIAL_CHARGE_DEFS } from '../../data/trialCharges';
import { BALANCE } from '../../data/balance';
import type { TrialState, TrialOutcome, TrialBeatResolution } from '../../models/trial';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const OUTCOME_LATIN: Record<TrialOutcome, string> = {
  acquitted: 'ABSOLVO', dismissed: 'DIMISSA', fined: 'MVLCTA', exiled: 'EXSILIVM', executed: 'CONDEMNO',
};
const OUTCOME_LABEL: Record<TrialOutcome, string> = {
  acquitted: 'ACQUITTED', dismissed: 'DISMISSED', fined: 'FINED', exiled: 'EXILED', executed: 'CONDEMNED',
};
const OUTCOME_COLOR: Record<TrialOutcome, string> = {
  acquitted: COLORS.laurel, dismissed: COLORS.laurel, fined: COLORS.goldDim,
  exiled: COLORS.crimson, executed: COLORS.crimsonDeep,
};

type Stage = 'charge' | 'bars' | 'recap' | 'stamp' | 'consequences';

export interface ConsequenceLine {
  text: string;
  type: 'good' | 'bad' | 'neutral';
}

interface VerdictSceneProps {
  trial: TrialState;
  recap: TrialBeatResolution[];
  consequenceLines: ConsequenceLine[];
  onContinue: () => void;
}

export default function VerdictScene({ trial, recap, consequenceLines, onContinue }: VerdictSceneProps) {
  const family = useGameStore(s => s.family);
  const clans = useGameStore(s => s.clans);

  const opponentFound = findOpponentLeader(trial, clans);
  const opponentLeader = opponentFound?.leader ?? null;
  const chargeDef = TRIAL_CHARGE_DEFS[trial.charge];
  const outcome = trial.outcome ?? 'dismissed';

  const defendantCharacterId = trial.defendant.kind === 'family' ? trial.defendant.characterId : null;
  const defendantName = defendantCharacterId
    ? (family.find(c => c.id === defendantCharacterId)?.name ?? 'the accused')
    : (opponentLeader?.name ?? 'the accused');
  const accuserName = trial.prosecutor.kind === 'player'
    ? (family.find(c => c.id === trial.speakerId)?.name ?? 'your house')
    : (opponentLeader?.name ?? 'the accuser');
  const accusationText = chargeDef.accusationTemplate
    .replace('{accuser}', accuserName)
    .replace('{defendant}', defendantName);

  // Same deterministic inputs resolveTrialOutcome used — replaying them here
  // reproduces the exact numbers the verdict was decided on.
  const opponentRhetoric = opponentLeader?.skills.rhetoric ?? 5;
  const npcPerformance = computeNpcPerformance(opponentLeader?.traits ?? []);
  const playerPerformance = recap.reduce((soFar, r) =>
    Math.max(-BALANCE.trials.performanceCap, Math.min(BALANCE.trials.performanceCap, soFar + r.swing)), 0);
  const { finalPlayer, finalNpc } = computeVerdict(trial, chargeDef.severityTier, opponentRhetoric, playerPerformance, npcPerformance);

  const barMax = Math.max(finalPlayer, finalNpc, 100 * BALANCE.trials.prepShare + BALANCE.trials.performanceCap, 1);
  const juryLeanFrac = Math.max(-0.5, Math.min(0.5, trial.juryLean / (2 * BALANCE.trials.juryLeanCap || 1)));

  const [stage, setStage] = useState<Stage>('charge');
  const [recapShown, setRecapShown] = useState(0);

  const chargeOpacity = useRef(new Animated.Value(0)).current;
  const playerBarFrac = useRef(new Animated.Value(0)).current;
  const npcBarFrac = useRef(new Animated.Value(0)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const stampScale = useRef(new Animated.Value(1.8)).current;
  const consequenceOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chargeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    const t = setTimeout(() => setStage('bars'), 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stage !== 'bars') return;
    Animated.parallel([
      Animated.timing(playerBarFrac, { toValue: finalPlayer / barMax, duration: 900, useNativeDriver: false }),
      Animated.timing(npcBarFrac, { toValue: finalNpc / barMax, duration: 900, useNativeDriver: false }),
    ]).start();
    const t = setTimeout(() => setStage(recap.length > 0 ? 'recap' : 'stamp'), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage !== 'recap') return;
    if (recapShown >= recap.length) {
      const t = setTimeout(() => setStage('stamp'), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRecapShown(n => n + 1), 550);
    return () => clearTimeout(t);
  }, [stage, recapShown, recap.length]);

  useEffect(() => {
    if (stage !== 'stamp') return;
    Animated.sequence([
      Animated.timing(stampOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.spring(stampScale, { toValue: 1, friction: 4, tension: 60, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setStage('consequences'), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  useEffect(() => {
    if (stage !== 'consequences') return;
    Animated.timing(consequenceOpacity, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function skipToEnd() {
    if (stage === 'consequences') return;
    chargeOpacity.setValue(1);
    playerBarFrac.setValue(finalPlayer / barMax);
    npcBarFrac.setValue(finalNpc / barMax);
    stampOpacity.setValue(1);
    stampScale.setValue(1);
    consequenceOpacity.setValue(1);
    setRecapShown(recap.length);
    setStage('consequences');
  }

  return (
    <TouchableWithoutFeedback onPress={skipToEnd}>
      <View style={styles.root}>
        <Animated.View style={[styles.chargeCard, { opacity: chargeOpacity }]}>
          <View style={styles.portrait}>
            <Text style={styles.portraitInitial}>{defendantName.charAt(0)}</Text>
          </View>
          <Text style={styles.chargeLatin}>{chargeDef.latinName}</Text>
          <Text style={styles.chargeName}>{chargeDef.displayName}</Text>
          <Text style={styles.accusation}>{accusationText}</Text>
        </Animated.View>

        {(stage === 'bars' || stage === 'recap' || stage === 'stamp' || stage === 'consequences') && (
          <View style={styles.barsBlock}>
            <BarRow
              label={trial.seat === 'defense' ? 'Your Defense' : 'Your Prosecution'}
              frac={playerBarFrac}
              value={Math.round(finalPlayer)}
              color={COLORS.gold}
            />
            <BarRow
              label={trial.seat === 'defense' ? accuserName : defendantName}
              frac={npcBarFrac}
              value={Math.round(finalNpc)}
              color={COLORS.crimsonMuted}
            />
            {Math.abs(trial.juryLean) >= 1 && (
              <View style={styles.juryLeanRow}>
                <View style={[styles.juryLeanMarker, { left: `${50 + juryLeanFrac * 100}%` }]} />
                <Text style={styles.juryLeanText}>
                  Jury lean: {trial.juryLean > 0 ? '+' : ''}{Math.round(trial.juryLean)} {trial.juryLean > 0 ? '(favoring you)' : '(against you)'}
                </Text>
              </View>
            )}
          </View>
        )}

        {(stage === 'recap' || stage === 'stamp' || stage === 'consequences') && recap.length > 0 && (
          <View style={styles.recapBlock}>
            {recap.slice(0, stage === 'recap' ? recapShown : recap.length).map((r, i) => {
              const beat = getTrialBeat(r.beatId);
              const response = beat?.responses.find(rr => rr.id === r.responseId);
              const text = response ? (r.succeeded ? response.successText : response.failureText) : '';
              return (
                <View key={i} style={styles.recapLine}>
                  <Text style={[styles.recapSwing, { color: r.swing >= 0 ? COLORS.laurel : COLORS.crimson }]}>
                    {r.swing >= 0 ? '+' : ''}{r.swing}
                  </Text>
                  <Text style={styles.recapText}>{text}</Text>
                </View>
              );
            })}
          </View>
        )}

        {(stage === 'stamp' || stage === 'consequences') && (
          <Animated.View style={[styles.stampWrap, { opacity: stampOpacity, transform: [{ scale: stampScale }, { rotate: '-6deg' }] }]}>
            <View style={[styles.stampSeal, { borderColor: OUTCOME_COLOR[outcome] }]}>
              <Text style={[styles.stampLatin, { color: OUTCOME_COLOR[outcome] }]}>{OUTCOME_LATIN[outcome]}</Text>
              <Text style={[styles.stampLabel, { color: OUTCOME_COLOR[outcome] }]}>{OUTCOME_LABEL[outcome]}</Text>
            </View>
          </Animated.View>
        )}

        {stage === 'consequences' && (
          <Animated.View style={[styles.consequenceCard, { opacity: consequenceOpacity }]}>
            {consequenceLines.map((line, i) => (
              <Text
                key={i}
                style={[
                  styles.consequenceLine,
                  line.type === 'good' && { color: COLORS.laurel },
                  line.type === 'bad' && { color: COLORS.crimson },
                ]}
              >
                {line.text}
              </Text>
            ))}
            <TouchableWithoutFeedback onPress={onContinue}>
              <View style={styles.continueBtn}>
                <Text style={styles.continueText}>Continue</Text>
              </View>
            </TouchableWithoutFeedback>
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

function BarRow({ label, frac, value, color }: { label: string; frac: Animated.Value; value: number; color: string }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <Animated.View
          style={[
            styles.barFill,
            { backgroundColor: color, width: frac.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.lg, alignItems: 'center' },
  chargeCard: {
    backgroundColor: COLORS.parchment, borderWidth: 2, borderColor: COLORS.parchmentBorder,
    borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', width: '100%', marginTop: SPACING.md,
  },
  portrait: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.portraitPlaceholder,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
    borderWidth: 2, borderColor: COLORS.parchmentBorder,
  },
  portraitInitial: { color: COLORS.parchmentText, fontFamily: FONTS.display, fontSize: 22, fontWeight: '700' },
  chargeLatin: { color: COLORS.parchmentMid, fontFamily: FONTS.display, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase' },
  chargeName: { color: COLORS.parchmentText, fontFamily: FONTS.display, fontSize: 20, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  accusation: { color: COLORS.parchmentText, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: SPACING.sm },

  barsBlock: { width: '100%', marginTop: SPACING.lg },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
  barLabel: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 11, width: 96 },
  barTrack: { flex: 1, height: 14, backgroundColor: COLORS.panelElevated, borderRadius: RADIUS.sm, overflow: 'hidden', marginHorizontal: SPACING.sm },
  barFill: { height: '100%' },
  barValue: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, width: 28, textAlign: 'right' },
  juryLeanRow: { marginTop: SPACING.xs, alignItems: 'center' },
  juryLeanMarker: { position: 'absolute', top: -6, width: 2, height: 8, backgroundColor: COLORS.gold },
  juryLeanText: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, textAlign: 'center', marginTop: SPACING.sm },

  recapBlock: { width: '100%', marginTop: SPACING.md, gap: SPACING.xs },
  recapLine: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  recapSwing: { fontFamily: FONTS.ui, fontSize: 12, fontWeight: '700', width: 32 },
  recapText: { flex: 1, color: COLORS.marble, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, lineHeight: 17 },

  stampWrap: { marginTop: SPACING.lg, alignItems: 'center', justifyContent: 'center' },
  stampSeal: {
    width: 140, height: 140, borderRadius: 70, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.waxSurface,
  },
  stampLatin: { fontFamily: FONTS.display, fontSize: 22, fontWeight: '700', letterSpacing: 1 },
  stampLabel: { fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, marginTop: 4 },

  consequenceCard: {
    marginTop: SPACING.lg, backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.md, width: '100%', alignItems: 'center',
  },
  consequenceLine: { color: COLORS.marble, fontFamily: FONTS.ui, fontSize: 12, textAlign: 'center', marginBottom: SPACING.xs },
  continueBtn: {
    marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.gold, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl,
  },
  continueText: { color: COLORS.gold, fontFamily: FONTS.display, fontSize: 14, fontWeight: '600' },
});
