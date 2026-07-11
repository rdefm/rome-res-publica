import {
  evaluateBeatResponse,
  pickBestResponse,
  computeNpcPerformance,
  drawTrialBeats,
  applyBeatOutcome,
  getTrialBeat,
} from '../src/engine/trialBeatEngine';
import { TRIAL_BEATS } from '../src/data/trialBeats';
import { TRIAL_CHARGE_DEFS } from '../src/data/trialCharges';
import { BALANCE } from '../src/data/balance';
import type { TrialBeat, TrialState, PrepRecord } from '../src/models/trial';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makePrep(overrides: Partial<PrepRecord> = {}): PrepRecord {
  return {
    logos: 0, pathos: 0, ethos: 0, actionsUsed: [],
    witnesses: [], bribedClanIds: [], praetorBribed: false,
    ...overrides,
  };
}

function makeTrial(overrides: Partial<TrialState> = {}): TrialState {
  return {
    id: 'trial-1',
    seat: 'defense',
    charge: 'peculatus',
    chargeSource: 'accusation',
    prosecutor: { kind: 'leader', leaderId: 'leader-1' },
    defendant: { kind: 'family', characterId: 'pc-1' },
    filedSeason: 1,
    startsSeason: 4,
    playerPrep: makePrep(),
    approach: 'procedure',
    speakerId: 'pc-1',
    npcStrength: 20,
    juryLean: 0,
    consumedSecretIds: [],
    status: 'in_session',
    session: {
      beatIds: ['b-financial-scribe'],
      currentBeatIndex: 0,
      performanceSoFar: 0,
      resolutions: [],
      discoveredBribeClanIds: [],
      discoveredPraetorBribe: false,
      witnessAttackTargetId: null,
    },
    ...overrides,
  };
}

/** Simple deterministic PRNG (mulberry32) — same seed always yields the same
 *  sequence, needed for the draw-determinism test. */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const speaker = { skills: { rhetoric: 7, martial: 4, intrigus: 8 } };
const weakSpeaker = { skills: { rhetoric: 1, martial: 1, intrigus: 1 } };

// ─── evaluateBeatResponse ─────────────────────────────────────────────────────

describe('evaluateBeatResponse', () => {
  test('kind: stat succeeds when speaker skill >= difficulty, deterministic threshold (no roll)', () => {
    const response = {
      id: 'r1', label: 'x', kind: 'stat' as const, skill: 'rhetoric' as const, difficulty: 6,
      swing: { success: 8, failure: -6 }, successText: '', failureText: '',
    };
    const trial = makeTrial();
    expect(evaluateBeatResponse(response, speaker, trial)).toEqual({ succeeded: true, swing: 8 });
    expect(evaluateBeatResponse(response, weakSpeaker, trial)).toEqual({ succeeded: false, swing: -6 });
  });

  test('kind: plain always succeeds', () => {
    const response = {
      id: 'r1', label: 'x', kind: 'plain' as const,
      swing: { success: 2, failure: -99 }, successText: '', failureText: '',
    };
    expect(evaluateBeatResponse(response, weakSpeaker, makeTrial()).succeeded).toBe(true);
  });

  test('kind: prep — witness requirement satisfied only by an unattacked witness', () => {
    const response = {
      id: 'r1', label: 'x', kind: 'prep' as const, requires: { kind: 'witness' as const },
      swing: { success: 6, failure: -8 }, successText: '', failureText: '',
    };
    const noWitness = makeTrial();
    expect(evaluateBeatResponse(response, speaker, noWitness).succeeded).toBe(false);

    const withAttackedOnly = makeTrial({
      playerPrep: makePrep({ witnesses: [{ id: 'w1', name: 'Gaius', attacked: true }] }),
    });
    expect(evaluateBeatResponse(response, speaker, withAttackedOnly).succeeded).toBe(false);

    const withLiveWitness = makeTrial({
      playerPrep: makePrep({ witnesses: [{ id: 'w1', name: 'Gaius' }] }),
    });
    expect(evaluateBeatResponse(response, speaker, withLiveWitness).succeeded).toBe(true);
  });

  test('kind: prep — evidence_uses requires at least N gather_evidence actions', () => {
    const response = {
      id: 'r1', label: 'x', kind: 'prep' as const, requires: { kind: 'evidence_uses' as const, min: 2 },
      swing: { success: 6, failure: -4 }, successText: '', failureText: '',
    };
    const oneUse = makeTrial({ playerPrep: makePrep({ actionsUsed: ['gather_evidence'] }) });
    expect(evaluateBeatResponse(response, speaker, oneUse).succeeded).toBe(false);

    const twoUses = makeTrial({ playerPrep: makePrep({ actionsUsed: ['gather_evidence', 'gather_evidence'] }) });
    expect(evaluateBeatResponse(response, speaker, twoUses).succeeded).toBe(true);
  });

  test('swing is clamped to ±BALANCE.trials.beats.beatSwingMax even if the authored value exceeds it', () => {
    const response = {
      id: 'r1', label: 'x', kind: 'plain' as const,
      swing: { success: 999, failure: -999 }, successText: '', failureText: '',
    };
    const { swing } = evaluateBeatResponse(response, speaker, makeTrial());
    expect(swing).toBe(BALANCE.trials.beats.beatSwingMax);
  });
});

// ─── pickBestResponse (fast-resolve EV) ───────────────────────────────────────

describe('pickBestResponse — fast-resolve EV-neutral path', () => {
  test('picks the response with the highest deterministic swing among available options', () => {
    const beat = getTrialBeat('b-financial-scribe')!;
    const strongPick = pickBestResponse(beat, speaker, makeTrial());
    // Manually compute the analytic best via evaluateBeatResponse over every response.
    const expected = beat.responses
      .map(r => ({ r, out: evaluateBeatResponse(r, speaker, makeTrial()) }))
      .reduce((best, cur) => (cur.out.swing > best.out.swing ? cur : best));
    expect(strongPick.response.id).toBe(expected.r.id);
    expect(strongPick.swing).toBe(expected.out.swing);
  });

  test('a weak speaker with no prep still gets the best available (possibly negative) outcome, never worse than playing it out', () => {
    const beat = getTrialBeat('b-financial-scribe')!;
    const picked = pickBestResponse(beat, weakSpeaker, makeTrial());
    for (const r of beat.responses) {
      const { swing } = evaluateBeatResponse(r, weakSpeaker, makeTrial());
      expect(picked.swing).toBeGreaterThanOrEqual(swing);
    }
  });
});

// ─── computeNpcPerformance ────────────────────────────────────────────────────

describe('computeNpcPerformance', () => {
  test('EV-neutral baseline with no courtroom-savvy trait', () => {
    expect(computeNpcPerformance([])).toBe(BALANCE.trials.beats.npcPerformanceEV);
  });

  test('nudged up when the opponent holds a courtroom-savvy trait', () => {
    expect(computeNpcPerformance(['ruthless'])).toBe(
      BALANCE.trials.beats.npcPerformanceEV + BALANCE.trials.beats.npcPerformanceTraitNudge
    );
  });

  test('clamped to ±performanceCap', () => {
    expect(computeNpcPerformance(['sharp_mind'])).toBeLessThanOrEqual(BALANCE.trials.performanceCap);
  });
});

// ─── drawTrialBeats ───────────────────────────────────────────────────────────

describe('drawTrialBeats', () => {
  const baseCtx = {
    chargeTags: TRIAL_CHARGE_DEFS.peculatus.beatTags,
    approach: 'procedure' as const,
    opponentTraitIds: [] as string[],
    hasUnattackedWitness: false,
    discoveredBribeClanIds: [] as string[],
    discoveredPraetorBribe: false,
  };

  test('draws exactly beatsPerTrial ids, given a rich enough pool', () => {
    const ids = drawTrialBeats(TRIAL_BEATS, baseCtx, seededRng(1));
    expect(ids.length).toBe(BALANCE.trials.beats.beatsPerTrial);
  });

  test('deterministic given the same seed', () => {
    const a = drawTrialBeats(TRIAL_BEATS, baseCtx, seededRng(42));
    const b = drawTrialBeats(TRIAL_BEATS, baseCtx, seededRng(42));
    expect(a).toEqual(b);
  });

  test('no beat repeats within a single draw', () => {
    for (let seed = 0; seed < 25; seed++) {
      const ids = drawTrialBeats(TRIAL_BEATS, baseCtx, seededRng(seed));
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('a discovered jury bribe forces a bribe_discovered_jurors beat into the draw', () => {
    const ids = drawTrialBeats(TRIAL_BEATS, { ...baseCtx, discoveredBribeClanIds: ['testii'] }, seededRng(7));
    const beats = ids.map(id => TRIAL_BEATS.find(b => b.id === id)!);
    expect(beats.some(b => b.tags.includes('bribe_discovered_jurors'))).toBe(true);
  });

  test('a discovered praetor bribe forces a bribe_discovered_praetor beat into the draw', () => {
    const ids = drawTrialBeats(TRIAL_BEATS, { ...baseCtx, discoveredPraetorBribe: true }, seededRng(7));
    const beats = ids.map(id => TRIAL_BEATS.find(b => b.id === id)!);
    expect(beats.some(b => b.tags.includes('bribe_discovered_praetor'))).toBe(true);
  });

  test('an unattacked witness forces a witness_attack beat', () => {
    const ids = drawTrialBeats(TRIAL_BEATS, { ...baseCtx, hasUnattackedWitness: true }, seededRng(3));
    const beats = ids.map(id => TRIAL_BEATS.find(b => b.id === id)!);
    expect(beats.some(b => b.tags.includes('witness_attack'))).toBe(true);
  });

  test('mandatory beats eat normal slots — 2 bribes + a witness attack fills all 3 slots', () => {
    const ids = drawTrialBeats(
      TRIAL_BEATS,
      { ...baseCtx, discoveredBribeClanIds: ['a', 'b'], hasUnattackedWitness: true },
      seededRng(11)
    );
    const beats = ids.map(id => TRIAL_BEATS.find(b => b.id === id)!);
    expect(beats.length).toBe(3);
    expect(beats.filter(b => b.tags.includes('bribe_discovered_jurors')).length).toBe(2);
    expect(beats.some(b => b.tags.includes('witness_attack'))).toBe(true);
  });

  test('slot 1 draws from the charge-tagged pool', () => {
    const ids = drawTrialBeats(TRIAL_BEATS, baseCtx, seededRng(2));
    const first = TRIAL_BEATS.find(b => b.id === ids[0])!;
    expect(first.tags.some(t => baseCtx.chargeTags.includes(t))).toBe(true);
  });
});

// ─── applyBeatOutcome ─────────────────────────────────────────────────────────

describe('applyBeatOutcome', () => {
  test('advances currentBeatIndex, appends the resolution, and clamps the running total', () => {
    const trial = makeTrial({ session: { ...makeTrial().session!, performanceSoFar: 5 } });
    const beat = getTrialBeat('b-financial-scribe')!;
    const response = beat.responses[0];
    const updated = applyBeatOutcome(trial, beat, response, true, BALANCE.trials.beats.beatSwingMax);
    expect(updated.session!.currentBeatIndex).toBe(1);
    expect(updated.session!.resolutions).toHaveLength(1);
    expect(updated.session!.performanceSoFar).toBeLessThanOrEqual(BALANCE.trials.performanceCap);
  });

  test('a failed witness_attack response marks the targeted witness attacked', () => {
    const witnessBeat = getTrialBeat('b-witness-attack-1')!;
    const plainResponse = witnessBeat.responses.find(r => r.kind === 'plain')!;
    const trial = makeTrial({
      playerPrep: makePrep({ witnesses: [{ id: 'w1', name: 'Gaius' }] }),
      session: {
        beatIds: [witnessBeat.id], currentBeatIndex: 0, performanceSoFar: 0, resolutions: [],
        discoveredBribeClanIds: [], discoveredPraetorBribe: false, witnessAttackTargetId: 'w1',
      },
    });
    const updated = applyBeatOutcome(trial, witnessBeat, plainResponse, true, plainResponse.swing.success);
    expect(updated.playerPrep.witnesses.find(w => w.id === 'w1')?.attacked).toBe(true);
    expect(updated.session!.witnessAttackTargetId).toBeNull();
  });

  test('a successful prep-kind protection response does NOT mark the witness attacked', () => {
    const witnessBeat = getTrialBeat('b-witness-attack-1')!;
    const prepResponse = witnessBeat.responses.find(r => r.kind === 'prep')!;
    const trial = makeTrial({
      playerPrep: makePrep({ witnesses: [{ id: 'w1', name: 'Gaius' }] }),
      session: {
        beatIds: [witnessBeat.id], currentBeatIndex: 0, performanceSoFar: 0, resolutions: [],
        discoveredBribeClanIds: [], discoveredPraetorBribe: false, witnessAttackTargetId: 'w1',
      },
    });
    const updated = applyBeatOutcome(trial, witnessBeat, prepResponse, true, prepResponse.swing.success);
    expect(updated.playerPrep.witnesses.find(w => w.id === 'w1')?.attacked).toBeFalsy();
  });
});

// ─── Beat library sanity ──────────────────────────────────────────────────────

describe('TRIAL_BEATS content', () => {
  test('every beat has at least one response, and every response has non-empty flavor text', () => {
    for (const beat of TRIAL_BEATS) {
      expect(beat.responses.length).toBeGreaterThan(0);
      for (const r of beat.responses) {
        expect(r.successText.length).toBeGreaterThan(0);
        expect(r.failureText.length).toBeGreaterThan(0);
      }
    }
  });

  test('every charge has at least one matching beat', () => {
    for (const chargeId of Object.keys(TRIAL_CHARGE_DEFS) as (keyof typeof TRIAL_CHARGE_DEFS)[]) {
      const tags = TRIAL_CHARGE_DEFS[chargeId].beatTags;
      const matches = TRIAL_BEATS.filter((b: TrialBeat) => b.tags.some(t => tags.includes(t)));
      expect(matches.length).toBeGreaterThan(0);
    }
  });

  test('the general pool has enough beats to act as a slot-3 fallback', () => {
    const general = TRIAL_BEATS.filter(b => b.tags.includes('general'));
    expect(general.length).toBeGreaterThanOrEqual(3);
  });
});
