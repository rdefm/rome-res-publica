/**
 * trialBeatEngine.ts — Phase 4, Chunk P4-E
 *
 * Pure functions for trial-day: drawing the 3-beat sequence, evaluating a
 * chosen response, and the fast-resolve ("let [speaker] argue it") path.
 * No store access — turnSequencer.ts calls drawTrialBeats at session start;
 * gameStore.ts's answerTrialBeat/fastResolveTrialSession call the rest.
 */

import type { TrialBeat, BeatResponse, BeatPrepRequirement, TrialState, TrialApproach } from '../models/trial';
import type { Character } from '../models/character';
import { TRIAL_BEATS } from '../data/trialBeats';
import { BALANCE } from '../data/balance';

// ─── Response evaluation (design invariant 2 — deterministic, no roll) ───────

/**
 * kind: 'stat' reuses eventEngine.resolveEventChoice's exact threshold idiom
 * (skillVal >= difficulty) — the same "no second RNG idiom" as every other
 * skill check in this codebase. kind: 'prep' checks an already-bought
 * Basilica artifact. kind: 'plain' always succeeds.
 */
export function evaluateBeatResponse(
  response: BeatResponse,
  speaker: Pick<Character, 'skills'>,
  trial: TrialState
): { succeeded: boolean; swing: number } {
  let succeeded: boolean;
  if (response.kind === 'stat') {
    const skillVal = response.skill ? speaker.skills[response.skill] : 0;
    succeeded = skillVal >= (response.difficulty ?? 0);
  } else if (response.kind === 'prep') {
    succeeded = response.requires ? checkPrepRequirement(response.requires, trial) : false;
  } else {
    succeeded = true;
  }

  const raw = succeeded ? response.swing.success : response.swing.failure;
  const clamped = Math.max(-BALANCE.trials.beats.beatSwingMax, Math.min(BALANCE.trials.beats.beatSwingMax, raw));
  return { succeeded, swing: clamped };
}

function checkPrepRequirement(req: BeatPrepRequirement, trial: TrialState): boolean {
  switch (req.kind) {
    case 'witness':
      return trial.playerPrep.witnesses.some(w => !w.attacked);
    case 'secret_evidence':
      return trial.playerPrep.actionsUsed.includes('present_secret_evidence');
    case 'evidence_uses':
      return trial.playerPrep.actionsUsed.filter(a => a === 'gather_evidence').length >= req.min;
  }
}

/** The best deterministic outcome available for this beat, given the
 *  speaker's stats and the trial's current prep artifacts — used by both
 *  the fast-resolve path (design invariant 7: "neutral EV... respect for the
 *  burst player's time, not a tax") and its own test coverage ("fast-resolve
 *  EV equals the analytic expectation"). Every check in this system is a
 *  deterministic threshold, not a probability roll, so "EV-neutral" here
 *  means exactly what a fully-informed player would get playing it out by
 *  hand — never better, never worse. */
export function pickBestResponse(
  beat: TrialBeat,
  speaker: Pick<Character, 'skills'>,
  trial: TrialState
): { response: BeatResponse; succeeded: boolean; swing: number } {
  let best: { response: BeatResponse; succeeded: boolean; swing: number } | null = null;
  for (const response of beat.responses) {
    const { succeeded, swing } = evaluateBeatResponse(response, speaker, trial);
    if (!best || swing > best.swing) best = { response, succeeded, swing };
  }
  return best!; // every authored beat has >=1 response — guaranteed non-null
}

// ─── NPC performance ──────────────────────────────────────────────────────────

/** A single value added once at session conclusion (the NPC doesn't answer
 *  beats) — EV-neutral baseline, nudged if the opponent holds a
 *  courtroom-savvy trait. Clamped to the same ±performanceCap share as the
 *  player's total (design invariant 1). */
const COURTROOM_SAVVY_TRAITS = ['sharp_mind', 'ruthless', 'great_orator', 'silver_tongue'];

export function computeNpcPerformance(opponentTraitIds: string[]): number {
  const nudge = opponentTraitIds.some(id => COURTROOM_SAVVY_TRAITS.includes(id))
    ? BALANCE.trials.beats.npcPerformanceTraitNudge
    : 0;
  const raw = BALANCE.trials.beats.npcPerformanceEV + nudge;
  return Math.max(-BALANCE.trials.performanceCap, Math.min(BALANCE.trials.performanceCap, raw));
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

export interface BeatDrawContext {
  chargeTags: string[];
  approach: TrialApproach;
  opponentTraitIds: string[];
  hasUnattackedWitness: boolean;
  discoveredBribeClanIds: string[];
  discoveredPraetorBribe: boolean;
}

function pickWeighted(candidates: TrialBeat[], rng: () => number, weightFn?: (b: TrialBeat) => number): TrialBeat | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map(c => weightFn ? weightFn(c) : 1);
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return candidates[Math.floor(rng() * candidates.length)];
  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

/**
 * Draws BALANCE.trials.beats.beatsPerTrial (3) beat ids from the pool.
 * Mandatory beats (bribe discoveries, then a witness attack) preempt normal
 * slots first — "bribes eat your beats and their bonuses" (design overview
 * §2). Remaining slots fill charge-tagged (1) -> approach/trait-tagged (2)
 * -> general (3), falling back to 'general' if a pool comes up empty. No
 * beat repeats within a trial (usedIds).
 */
export function drawTrialBeats(pool: TrialBeat[], ctx: BeatDrawContext, rng: () => number): string[] {
  const beatsPerTrial = BALANCE.trials.beats.beatsPerTrial;
  const usedIds = new Set<string>();
  const drawn: TrialBeat[] = [];

  const available = (tag: string) => pool.filter(b => !usedIds.has(b.id) && b.tags.includes(tag));

  // ── Mandatory: bribe discoveries, then witness attack ──────────────────
  for (const _clanId of ctx.discoveredBribeClanIds) {
    if (drawn.length >= beatsPerTrial) break;
    const beat = pickWeighted(available('bribe_discovered_jurors'), rng);
    if (beat) { drawn.push(beat); usedIds.add(beat.id); }
  }
  if (ctx.discoveredPraetorBribe && drawn.length < beatsPerTrial) {
    const beat = pickWeighted(available('bribe_discovered_praetor'), rng);
    if (beat) { drawn.push(beat); usedIds.add(beat.id); }
  }
  if (ctx.hasUnattackedWitness && drawn.length < beatsPerTrial) {
    const beat = pickWeighted(available('witness_attack'), rng);
    if (beat) { drawn.push(beat); usedIds.add(beat.id); }
  }

  // ── Normal slots: charge -> approach/trait -> general ───────────────────
  const surpriseMult = ctx.approach === 'procedure'
    ? BALANCE.trials.approach.procedure.surpriseBeatChanceMultiplier
    : 1;

  const slotPools: (() => TrialBeat[])[] = [
    () => {
      const candidates = pool.filter(b => !usedIds.has(b.id) && b.tags.some(t => ctx.chargeTags.includes(t)));
      return candidates.length > 0 ? candidates : available('general');
    },
    () => {
      const candidates = pool.filter(b =>
        !usedIds.has(b.id) && (b.tags.includes(ctx.approach) || b.tags.some(t => ctx.opponentTraitIds.includes(t)))
      );
      return candidates.length > 0 ? candidates : available('general');
    },
    () => available('general'),
  ];

  for (const getPool of slotPools) {
    if (drawn.length >= beatsPerTrial) break;
    const candidates = getPool();
    const beat = pickWeighted(candidates, rng, b => b.tags.includes('surprise') ? surpriseMult : 1);
    if (beat) { drawn.push(beat); usedIds.add(beat.id); }
  }

  return drawn.map(b => b.id);
}

export function getTrialBeat(beatId: string): TrialBeat | undefined {
  return TRIAL_BEATS.find(b => b.id === beatId);
}

// ─── Applying a resolved beat ────────────────────────────────────────────────

/**
 * Advances trial.session by one beat: clamps performanceSoFar (running,
 * design invariant 1), appends the resolution, increments currentBeatIndex,
 * and — for the mandatory 'witness_attack' beat only — marks the targeted
 * witness `attacked` unless the response both succeeded AND was the
 * kind:'prep' "protect the witness" option (any other response, successful
 * or not, is read as the witness taking the hit; a failed protection attempt
 * still counts as an attack landing). Pure — caller (gameStore) is
 * responsible for persisting the returned TrialState and, once
 * currentBeatIndex reaches beatIds.length, calling trialEngine.resolveTrialOutcome.
 */
export function applyBeatOutcome(
  trial: TrialState,
  beat: TrialBeat,
  response: BeatResponse,
  succeeded: boolean,
  swing: number
): TrialState {
  const session = trial.session;
  if (!session) return trial;

  const performanceSoFar = Math.max(
    -BALANCE.trials.performanceCap,
    Math.min(BALANCE.trials.performanceCap, session.performanceSoFar + swing)
  );

  const witnessSaved = beat.tags.includes('witness_attack') && response.kind === 'prep' && succeeded;
  const shouldMarkAttacked = beat.tags.includes('witness_attack') && !witnessSaved && !!session.witnessAttackTargetId;

  const playerPrep = shouldMarkAttacked
    ? {
        ...trial.playerPrep,
        witnesses: trial.playerPrep.witnesses.map(w =>
          w.id === session.witnessAttackTargetId ? { ...w, attacked: true } : w
        ),
      }
    : trial.playerPrep;

  return {
    ...trial,
    playerPrep,
    session: {
      ...session,
      performanceSoFar,
      resolutions: [...session.resolutions, { beatId: beat.id, responseId: response.id, succeeded, swing }],
      currentBeatIndex: session.currentBeatIndex + 1,
      witnessAttackTargetId: beat.tags.includes('witness_attack') ? null : session.witnessAttackTargetId,
    },
  };
}
