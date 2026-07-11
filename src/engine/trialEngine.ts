/**
 * trialEngine.ts — Phase 1 (Feature 6), reworked Phase 4, Chunk P4-C
 *
 * "One pipeline, two seats." Pure functions: filing gates, opponent prep
 * growth + estimate band, jury lean, deterministic verdict math, calumnia,
 * the legacy-trial save migration, and the legacy TRIAL_ACTIONS shim.
 * `buildTrial`/`buildTrialFromState`/`resolveTrial` (the old roll-based,
 * single-shape system) are retired — every trial origin now builds a
 * `TrialState` via `buildTrialState`. No store access.
 */

import type {
  TrialState, TrialOutcome, TrialParty, TrialTarget, PrepRecord, Witness,
  ChargeId, ChargeSource, LegacyTrial, TrialApproach,
} from '../models/trial';
import type { GameState } from '../state/gameStore';
import type { Clan, ClanLeader } from '../models/clan';
import type { Secret } from '../models/secret';
import { SECRET_CLASS_BY_TYPE } from '../data/secretDefinitions';
import { TAXATION_CORRUPTION_PER_TURN, type TaxationNotch } from '../models/province';
import { getClanStanding } from './reputationEngine';
import { detectPaterfamiliasDeath } from './inheritanceEngine';
import { resolveDeathNotice } from '../data/cadetEvents';
import { TRIAL_CHARGE_DEFS } from '../data/trialCharges';
import { incrementLegacy } from './legacyEngine';
import { BALANCE } from '../data/balance';

// ─── Build a new TrialState ───────────────────────────────────────────────────

export function buildTrialState(params: {
  id: string;
  seat: 'defense' | 'prosecution';
  charge: ChargeId;
  chargeSource: ChargeSource;
  prosecutor: TrialParty;
  defendant: TrialTarget;
  filedSeason: number;
  startsSeason: number;
  initialNpcStrength: number;
  consumedSecretIds?: string[];
  speakerId: string;
}): TrialState {
  return {
    id: params.id,
    seat: params.seat,
    charge: params.charge,
    chargeSource: params.chargeSource,
    prosecutor: params.prosecutor,
    defendant: params.defendant,
    filedSeason: params.filedSeason,
    startsSeason: params.startsSeason,
    playerPrep: { logos: 0, pathos: 0, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
    approach: 'procedure',
    speakerId: params.speakerId,
    npcStrength: params.initialNpcStrength,
    juryLean: 0,
    consumedSecretIds: params.consumedSecretIds ?? [],
    status: 'preparing',
    session: null,
  };
}

// ─── Opponent lookup (Phase 4, Chunk P4-E) ───────────────────────────────────
// Shared by turnSequencer.ts (session-entry growth check) and gameStore.ts
// (session-conclusion consequences) — previously a closure duplicated in
// turnSequencer's step 15 alone.

export function findOpponentLeader(trial: TrialState, clans: Clan[]): { clan: Clan; leader: ClanLeader } | null {
  const opponentLeaderId =
    trial.seat === 'defense'
      ? (trial.prosecutor.kind === 'leader' ? trial.prosecutor.leaderId : null)
      : (trial.defendant.kind === 'leader' ? trial.defendant.leaderId : null);
  if (!opponentLeaderId) return null;
  for (const clan of clans) {
    const leader = clan.leaders.find(l => l.id === opponentLeaderId);
    if (leader) return { clan, leader };
  }
  return null;
}

// ─── Filing gate ──────────────────────────────────────────────────────────────

export interface FilingGateResult {
  eligible: boolean;
  via: 'secret' | 'corruption' | null;
  /** Highest-potency held criminal Secret on the target, if the secret path
   *  qualifies — the caller consumes this into consumedSecretIds. */
  evidenceSecret?: Secret;
}

/** Requires a criminal Secret on the target OR target corruption ≥
 *  BALANCE.trials.corruptionChargeThreshold. Secret path checked first —
 *  when both qualify, filing consumes the (stronger) evidence path. */
export function canFileProsecution(targetLeader: ClanLeader, allSecrets: Secret[]): FilingGateResult {
  const criminalSecrets = allSecrets.filter(s =>
    s.holder === 'player' &&
    s.subject.kind === 'leader' &&
    s.subject.leaderId === targetLeader.id &&
    s.status === 'held' &&
    SECRET_CLASS_BY_TYPE[s.type] === 'criminal'
  );
  if (criminalSecrets.length > 0) {
    const evidenceSecret = [...criminalSecrets].sort((a, b) => b.potency - a.potency)[0];
    return { eligible: true, via: 'secret', evidenceSecret };
  }
  if ((targetLeader.corruptionScore ?? 0) >= BALANCE.trials.corruptionChargeThreshold) {
    return { eligible: true, via: 'corruption' };
  }
  return { eligible: false, via: null };
}

// ─── Opponent prep growth ─────────────────────────────────────────────────────

/** Runs for NPC defendant and NPC prosecutor alike — same formula either
 *  way, since it represents "how hard is the opponent working the case,"
 *  not which seat they occupy. No wealthy-trait multiplier: ClanLeader has
 *  no traits system (only `bias`), and the plan's own phrasing ("if traits
 *  expose one") anticipated this — skipped rather than inventing a proxy. */
export function computeOpponentPrepGrowth(intrigus: number, clanInfluence: number): number {
  return BALANCE.trials.npcPrepBase
    + intrigus * BALANCE.trials.npcPrepPerIntrigue
    + clanInfluence * BALANCE.trials.npcPrepClanFactor;
}

export type OpponentEstimate = { exact: true; value: number } | { exact: false; low: number; high: number };

/** ±estimateBandPct band, narrowed to exact once the player holds a Secret
 *  on the opponent leader (the cleanest existing intel signal). */
export function estimateOpponentStrength(npcStrength: number, hasIntel: boolean): OpponentEstimate {
  if (hasIntel) return { exact: true, value: Math.round(npcStrength) };
  const band = BALANCE.trials.estimateBandPct;
  return {
    exact: false,
    low: Math.round(npcStrength * (1 - band)),
    high: Math.round(npcStrength * (1 + band)),
  };
}

// ─── Jury lean ────────────────────────────────────────────────────────────────

/**
 * Σ over clans of familyReputations[clanId] × juryLeanPerStanding ×
 * clanVoteWeight(clan), clamped ±juryLeanCap. familyReputations is already
 * -100..100 and zero-centered, so unlike the plan's literal "(standing −
 * 50)" wording (written for a 0-100 scale), no offset is needed here — this
 * codebase's equivalent signal is already centered on 0.
 */
export function computeJuryLean(clans: Clan[], familyReputations: Record<string, number>): number {
  const totalVotes = clans.reduce((sum, c) => sum + c.leaders.reduce((s, l) => s + l.votes, 0), 0);
  if (totalVotes === 0) return 0;

  const raw = clans.reduce((sum, c) => {
    const clanVotes = c.leaders.reduce((s, l) => s + l.votes, 0);
    const weight = clanVotes / totalVotes;
    const standing = familyReputations[c.id] ?? 0;
    return sum + standing * BALANCE.trials.juryLeanPerStanding * weight;
  }, 0);

  return Math.max(-BALANCE.trials.juryLeanCap, Math.min(BALANCE.trials.juryLeanCap, raw));
}

// ─── Sectioned prep total (Phase 4, Chunk P4-D) ──────────────────────────────

/**
 * Weighted total of a PrepRecord's three sections under a given Approach —
 * always derived, never stored, so switching Approach (free until
 * startsSeason, design invariant 8) re-previews the strength bar live
 * without touching any verb's accumulated points. Capped at 100 like the
 * old flat totalStrength was.
 */
export function computeTotalPrepStrength(prep: PrepRecord, approach: TrialApproach): number {
  const mult = BALANCE.trials.approach[approach] as Partial<Record<'logos' | 'pathos' | 'ethos', number>>;
  const total =
    prep.logos * (mult.logos ?? 1) +
    prep.pathos * (mult.pathos ?? 1) +
    prep.ethos * (mult.ethos ?? 1);
  return Math.min(100, total);
}

// ─── Verdict (deterministic — design invariant 2) ────────────────────────────

export interface VerdictResult {
  outcome: TrialOutcome;
  /** The PLAYER's own differential (positive = player did better than the
   *  opponent) — calumnia reads this directly, unflipped. */
  differential: number;
  /** Phase 4, Chunk P4-F — the two sides' final scores (prep×prepShare +
   *  performance, before juryLean/Ferocity's flat bonus are folded into
   *  `differential`), exposed so VerdictScene can animate its two strength
   *  bars filling to the same numbers the verdict was actually decided on,
   *  without recomputing or duplicating this formula in the UI layer. */
  finalPlayer: number;
  finalNpc: number;
}

/**
 * finalPlayer = weightedPrepScore × prepShare + performance (+ Ferocity's
 * low-Rhetoric bonus, flat); finalNpc = npcStrength × prepShare +
 * npcPerformance; differential = (finalPlayer − finalNpc) + juryLean ×
 * jury-weight (Sympathy doubles it), from the player's seat.
 * performance/npcPerformance default 0 — P4-E's beat engine doesn't exist
 * yet, so resolution is prep-only this chunk (matches the plan's explicit
 * interim behavior). opponentRhetoric defaults to a neutral mid-value (5)
 * for call sites that don't have an opponent leader to read from.
 * The threshold bands are always phrased in terms of the DEFENDANT's fate;
 * when the player prosecutes, the differential's sign is flipped before
 * lookup ("the same bands read from the other side") since a strong
 * player-as-prosecutor performance should hurt the (NPC) defendant, not
 * help them.
 */
export function computeVerdict(
  trial: TrialState,
  severityTier: 'standard' | 'severe',
  opponentRhetoric: number = 5,
  playerPerformance: number = 0,
  npcPerformance: number = 0
): VerdictResult {
  let finalPlayer = computeTotalPrepStrength(trial.playerPrep, trial.approach) * BALANCE.trials.prepShare + playerPerformance;
  if (trial.approach === 'ferocity' && opponentRhetoric < BALANCE.trials.approach.ferocity.lowRhetoricThreshold) {
    finalPlayer += BALANCE.trials.approach.ferocity.lowRhetoricBonus;
  }
  const finalNpc = trial.npcStrength * BALANCE.trials.prepShare + npcPerformance;
  const juryWeight = trial.approach === 'sympathy' ? BALANCE.trials.approach.sympathy.juryLeanWeightMultiplier : 1;
  const differential = (finalPlayer - finalNpc) + trial.juryLean * juryWeight;
  const defendantDifferential = trial.seat === 'defense' ? differential : -differential;

  const bands = BALANCE.trials.verdictThresholds[severityTier];
  let outcome: TrialOutcome;
  if (defendantDifferential > bands.acquitted)      outcome = 'acquitted';
  else if (defendantDifferential > bands.dismissed) outcome = 'dismissed';
  else if (defendantDifferential > bands.fined)     outcome = 'fined';
  else if (defendantDifferential > bands.exiled)    outcome = 'exiled';
  else                                               outcome = 'executed';

  return { outcome, differential, finalPlayer, finalNpc };
}

// ─── Calumnia ─────────────────────────────────────────────────────────────────

export interface CalumniaResult {
  triggered: boolean;
  dignitasDelta: number;
  clanRelationsDelta: number;
  /** Whether the counter-suit roll hit — caller (turnSequencer) builds the
   *  follow-up TrialState (seat: 'defense', startsSeason = now + 2) via
   *  buildTrialState if true; this function only decides whether it fires. */
  counterSuitRolled: boolean;
}

/** Only meaningful when trial.seat === 'prosecution' — a losing defense
 *  never triggers calumnia (you can't be sued for calumny defending
 *  yourself). differential is the player's own (unflipped) value from
 *  computeVerdict — a losing prosecution reads as strongly negative there. */
export function checkCalumnia(trial: TrialState, differential: number, roll: number): CalumniaResult {
  if (trial.seat !== 'prosecution' || differential >= BALANCE.trials.calumniaThreshold) {
    return { triggered: false, dignitasDelta: 0, clanRelationsDelta: 0, counterSuitRolled: false };
  }
  return {
    triggered: true,
    dignitasDelta: BALANCE.trials.calumniaDignitas,
    clanRelationsDelta: BALANCE.trials.calumniaClanRelations,
    counterSuitRolled: roll < BALANCE.trials.counterSuitChance,
  };
}

// ─── Outcome consequences (unchanged across the P4-C rework) ────────────────

export const OUTCOME_CONSEQUENCES: Record<TrialOutcome, {
  reputationDelta: number;
  corruptionClear: boolean;
  lifetimeDignitas: number;
  denarii?: number;
  removeCharacter: boolean;
  familyTrustDelta?: number;
}> = {
  acquitted: { reputationDelta: +10, corruptionClear: true,  lifetimeDignitas: +5,  removeCharacter: false },
  dismissed: { reputationDelta: +5,  corruptionClear: false, lifetimeDignitas:  0,  removeCharacter: false },
  fined:     { reputationDelta: -5,  corruptionClear: false, lifetimeDignitas: -5,  denarii: -100, removeCharacter: false },
  exiled:    { reputationDelta: -20, corruptionClear: false, lifetimeDignitas: -20, removeCharacter: true },
  executed:  { reputationDelta: -30, corruptionClear: false, lifetimeDignitas: -30, removeCharacter: true, familyTrustDelta: -20 },
};

// ─── Trial resolution (Phase 4, Chunk P4-E) ──────────────────────────────────
// Extracted verbatim from turnSequencer.ts's pre-P4-E step 15 (which used to
// call computeVerdict and apply every consequence synchronously the instant
// turnNumber reached startsSeason). Trial day is now an interactive 3-beat
// session (trialBeatEngine.ts) spanning multiple UI turns, so verdict +
// consequences can no longer run inside processSeason — gameStore's
// answerTrialBeat/fastResolveTrialSession call this once the session's
// final beat resolves. turnSequencer.ts's step 15 now only grows
// npcStrength/juryLean and draws the beat session; it never calls this.

export interface TrialResolutionResult {
  /** status: 'resolved', outcome set, session: null. */
  trial: TrialState;
  /** The full next state — familyReputations/lifetimeDignitas/denarii/
   *  family/clans deltas already applied (mirrors turnSequencer's own
   *  `s = {...s, ...}` chaining style, since the original logic touches
   *  several state slices in sequence). Does NOT include `trials` — the
   *  caller merges `trial` (and `counterSuit`, if present) into its own
   *  `trials` array. */
  state: GameState;
  events: string[];
  /** A defense-seat TrialState the calumnia roll spawned, if any — caller
   *  pushes it into `trials` alongside the resolved `trial`. */
  counterSuit: TrialState | null;
}

export function resolveTrialOutcome(
  state: GameState,
  trial: TrialState,
  opponentFound: { clan: Clan; leader: ClanLeader } | null,
  playerPerformance: number,
  npcPerformance: number,
  rng: () => number = Math.random
): TrialResolutionResult {
  let s = state;
  const events: string[] = [];
  let counterSuit: TrialState | null = null;

  const chargeDef = TRIAL_CHARGE_DEFS[trial.charge];
  const opponentRhetoric = opponentFound?.leader.skills.rhetoric ?? 5;
  const { outcome, differential } = computeVerdict(trial, chargeDef.severityTier, opponentRhetoric, playerPerformance, npcPerformance);
  const cons = OUTCOME_CONSEQUENCES[outcome];
  const defendant = trial.defendant;

  const defendantName = defendant.kind === 'family'
    ? (s.family.find(c => c.id === defendant.characterId)?.name ?? 'the accused')
    : (opponentFound?.leader.name ?? 'the accused');

  events.push(`Trial resolved: ${defendantName} — ${outcome.toUpperCase()}.`);

  // reputationDelta lands on "the other side's clan" — the prosecutor's
  // clan when the player defends, the defendant's clan when the player
  // prosecutes (both are opponentFound in either seat).
  if (cons.reputationDelta !== 0 && opponentFound) {
    const newRep = Math.min(100, Math.max(-100,
      (s.familyReputations[opponentFound.clan.id] ?? 0) + cons.reputationDelta
    ));
    s = { ...s, familyReputations: { ...s.familyReputations, [opponentFound.clan.id]: newRep } };
  }

  s = { ...s, lifetimeDignitas: Math.max(0, s.lifetimeDignitas + cons.lifetimeDignitas) };

  if (cons.denarii) {
    s = { ...s, denarii: Math.max(0, s.denarii + cons.denarii) };
  }

  if (defendant.kind === 'family') {
    const accused = s.family.find(c => c.id === defendant.characterId);

    if (cons.corruptionClear) {
      s = {
        ...s,
        family: s.family.map(c =>
          c.id === defendant.characterId ? { ...c, corruptionScore: 0 } : c
        ),
      };
    }

    if (cons.familyTrustDelta) {
      s = {
        ...s,
        family: s.family.map(c =>
          c.isPlayer ? { ...c, familyTrust: Math.max(0, c.familyTrust + cons.familyTrustDelta!) } : c
        ),
      };
    }

    if (cons.removeCharacter) {
      // Same shared-detection routing as turnSequencer's other death paths
      // (Phase 3, Chunk P3-C) — a still-pending succession from earlier this
      // same season takes precedence (the single pendingSuccession slot
      // can't hold two at once — rare enough not to handle further here).
      if (accused?.isPlayer && !s.pendingSuccession) {
        const result = detectPaterfamiliasDeath(s.family, defendant.characterId, s.heldOffices);
        if (result.pendingSuccession) {
          const p = result.pendingSuccession;
          const resolution = resolveDeathNotice(p, s.cadetBranch, s.cadetBranchUsed, s.turnNumber);
          s = {
            ...s,
            family: result.family,
            pendingSuccession: p,
            pendingEvents: [...s.pendingEvents, resolution.notice],
            ...(resolution.cadetBranch ? { cadetBranch: resolution.cadetBranch } : {}),
            ...(resolution.pendingEpilogue ? { pendingEpilogue: resolution.pendingEpilogue } : {}),
          };
        } else {
          s = { ...s, family: result.family };
        }
      } else {
        s = { ...s, family: s.family.filter(c => c.id !== defendant.characterId) };
      }
    }
  } else {
    // Leader defendant (player-filed prosecution) — reuses the `proscribed`
    // flag (the Dictator's Proscription consequence) rather than inventing
    // leader removal/succession machinery.
    const targetLeaderId = defendant.leaderId;
    if (cons.corruptionClear) {
      s = {
        ...s,
        clans: s.clans.map(c => ({
          ...c,
          leaders: c.leaders.map(l => l.id === targetLeaderId ? { ...l, corruptionScore: 0 } : l),
        })),
      };
    }
    if (cons.removeCharacter) {
      s = {
        ...s,
        clans: s.clans.map(c => ({
          ...c,
          leaders: c.leaders.map(l => l.id === targetLeaderId ? { ...l, proscribed: true } : l),
        })),
      };
    }
  }

  // ── Calumnia (losing a player-filed prosecution) ────────────────────────
  if (trial.seat === 'prosecution') {
    const calumnia = checkCalumnia(trial, differential, rng());
    if (calumnia.triggered) {
      s = { ...s, lifetimeDignitas: Math.max(0, s.lifetimeDignitas + calumnia.dignitasDelta) };
      if (opponentFound) {
        const rep = Math.min(100, Math.max(-100,
          (s.familyReputations[opponentFound.clan.id] ?? 0) + calumnia.clanRelationsDelta
        ));
        s = { ...s, familyReputations: { ...s.familyReputations, [opponentFound.clan.id]: rep } };
      }
      events.push(`Calumnia! Your accusation against ${defendantName} is judged malicious — Dignitas and standing suffer.`);

      if (calumnia.counterSuitRolled && opponentFound) {
        counterSuit = buildTrialState({
          id: `trial-countersuit-${s.turnNumber}`,
          seat: 'defense',
          charge: trial.charge,
          chargeSource: 'accusation',
          prosecutor: { kind: 'leader', leaderId: opponentFound.leader.id },
          defendant: { kind: 'family', characterId: trial.speakerId },
          filedSeason: s.turnNumber,
          startsSeason: s.turnNumber + 2,
          initialNpcStrength: BALANCE.trials.corruptionEvidenceBase,
          speakerId: trial.speakerId,
        });
        events.push(`${opponentFound.leader.name} files a counter-suit against ${s.family.find(c => c.id === trial.speakerId)?.name ?? 'your speaker'}.`);
      }
    }
  }

  // ── Prosecution victory rewards (Phase 4, Chunk P4-F, "the Cicero moment") ──
  // A win is any guilty verdict (fined/exiled/executed already carry the
  // charge's own consequence above) with the player in the prosecution seat.
  let convictedSittingMagistrate = false;
  if (trial.seat === 'prosecution' && outcome !== 'acquitted' && outcome !== 'dismissed' && opponentFound) {
    const sittingMagistrate = opponentFound.leader.currentOffice !== null;
    const dignitasGain = BALANCE.trials.rewards.prosecutionWinDignitasBase
      + opponentFound.leader.votes
      + (sittingMagistrate ? BALANCE.trials.rewards.sittingMagistrateBonus : 0);
    s = { ...s, lifetimeDignitas: Math.max(0, s.lifetimeDignitas + dignitasGain) };
    convictedSittingMagistrate = sittingMagistrate;
    events.push(`Victory in court! ${defendantName}'s conviction earns +${dignitasGain} Dignitas.`);

    const { updated: legacyAfterWin, newMilestonesReached: winMilestones } =
      incrementLegacy(s.legacyObjectives, 'prosecutions_won', 1);
    s = { ...s, legacyObjectives: legacyAfterWin };
    for (const m of winMilestones) events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);

    if (sittingMagistrate) {
      const { updated: legacyAfterMagistrate, newMilestonesReached: magistrateMilestones } =
        incrementLegacy(s.legacyObjectives, 'magistrates_convicted', 1);
      s = { ...s, legacyObjectives: legacyAfterMagistrate };
      for (const m of magistrateMilestones) events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  // ── Defense vindicated (Phase 4, Chunk P4-F) — Dismissed tier specifically,
  // per the plan's own wording: the case thrown out before it could even be
  // properly argued, a sharper rebuke to the accuser than a plain Acquitted. ──
  if (trial.seat === 'defense' && outcome === 'dismissed') {
    s = { ...s, lifetimeDignitas: Math.max(0, s.lifetimeDignitas + BALANCE.trials.rewards.vindicatedDignitas) };
    events.push(`Vindicated — the case against ${defendantName} collapses outright. +${BALANCE.trials.rewards.vindicatedDignitas} Dignitas.`);
  }

  const resolvedTrial: TrialState = {
    ...trial, status: 'resolved', outcome, session: null,
    ...(convictedSittingMagistrate ? { convictedSittingMagistrate: true } : {}),
  };
  return { trial: resolvedTrial, state: s, events, counterSuit };
}

// ─── Passive trial trigger check ──────────────────────────────────────────────

/**
 * The corruptionScore level at which a hostile clan may initiate prosecution
 * against the PLAYER's own family — distinct from
 * BALANCE.trials.corruptionChargeThreshold, which gates the PLAYER filing
 * against a LEADER (opposite direction; coincidentally the same seed value,
 * kept as separate constants). Exported so agendaEngine can warn the player
 * when within 10 points without independently hardcoding the value.
 */
export const CORRUPTION_TRIAL_THRESHOLD = 60;

export function shouldTriggerTrial(state: GameState): {
  charge: ChargeId;
  chargeSource: ChargeSource;
  accusedId: string;
  accusingClanId: string;
} | null {
  // ── Tribune immunity (Chunk 1C) ────────────────────────────────────────────
  // Sacrosanctity: no trials may be initiated while any family member holds Tribune.
  if (state.tribuneHolder) return null;

  // ── Dictator trial suspension (Chunk 1C) ──────────────────────────────────
  // The Dictator's "Suspend All Trials" action sets this flag.
  if (state.flags['dictatorTrialSuspension']) return null;

  // Already a pending trial — only one active trial at a time
  if ((state.trials ?? []).some(t => t.status !== 'resolved')) return null;

  const player = state.family.find(c => c.isPlayer);
  if (!player) return null;

  const accusingClan = state.clans.find(c => {
    const standing = getClanStanding(c.id, state.familyReputations, state.electionRivals);
    return standing === 'hostile' || standing === 'rival';
  });
  if (!accusingClan) return null;

  // ── Blacklist check (Chunk 1C) ─────────────────────────────────────────────
  // If the accusing clan's first leader is blacklisted by the Praetor's action,
  // they cannot initiate prosecution this season.
  const hostileLeader = accusingClan.leaders[0];
  if (hostileLeader && state.flags[`blacklisted-${hostileLeader.id}`]) return null;

  if (player.corruptionScore > CORRUPTION_TRIAL_THRESHOLD && Math.random() < 0.20) {
    return { charge: 'peculatus', chargeSource: 'corruption', accusedId: player.id, accusingClanId: accusingClan.id };
  }

  // ── Crisis track check (Chunk 1C) ─────────────────────────────────────────
  // Use Constitution track level instead of the legacy flat crisisLevel scalar.
  if (state.crisis.constitution.level > 80 && Math.random() < 0.10) {
    return { charge: 'maiestas', chargeSource: 'accusation', accusedId: player.id, accusingClanId: accusingClan.id };
  }

  // ── Military Overhaul M4 — defeated general prosecution ──────────────────
  // Hostile clans may prosecute any family member (not just the player) who
  // commanded a clear-or-worse defeat in a set-piece battle. musterEngine's
  // applyBattleOutcome sets `flags['defeatedGeneral-<characterId>']`;
  // turnSequencer.ts clears it once a trial actually fires from it (the flag
  // otherwise keeps re-rolling each season it isn't consumed).
  const defeatedGeneralId = Object.keys(state.flags)
    .find(k => k.startsWith('defeatedGeneral-') && state.flags[k] === true)
    ?.slice('defeatedGeneral-'.length);
  if (defeatedGeneralId && state.family.some(c => c.id === defeatedGeneralId) && Math.random() < 0.25) {
    return { charge: 'military_incompetence', chargeSource: 'accusation', accusedId: defeatedGeneralId, accusingClanId: accusingClan.id };
  }

  return null;
}

// ─── Corruption accumulation (player family — unchanged) ────────────────────

export function tickCorruption(
  currentScore: number,
  crisisLevel: number,
  corruptionShield: number
): number {
  if (crisisLevel > 50) {
    const gain = Math.max(0, 2 - corruptionShield);
    return Math.min(100, currentScore + gain);
  }
  return Math.max(0, currentScore - 1);
}

// ─── Leader corruption / "governorship" accrual (Phase 4, Chunk P4-C) ──────

/**
 * No NPC-governorship simulation exists in this codebase (provinces only
 * track playerGovernor) — this is a leader-side abstraction feeding the
 * corruption-gated prosecution-filing path, not a simulation of who
 * economically controls which province. Eligibility: has held praetor or
 * consul (historically provincial-command-granting offices, already
 * tracked via heldOffices). Each season, an eligible leader has
 * BALANCE.trials.governorship.activeChance odds of "actively governing"
 * this season; if so, a taxation notch is picked (weighted by
 * `relationship` — hostile leaders lean extortionate) and the REAL,
 * already-tuned province.TAXATION_CORRUPTION_PER_TURN[notch] is applied —
 * reusing existing numbers rather than inventing new ones.
 */
export function tickLeaderCorruption(leader: ClanLeader, rng: () => number = Math.random): number {
  const current = leader.corruptionScore ?? 0;
  const eligible = leader.heldOffices.includes('praetor') || leader.heldOffices.includes('consul');
  if (!eligible) return current;
  if (rng() >= BALANCE.trials.governorship.activeChance) return current;

  const notch = pickTaxationNotch(leader.relationship, rng);
  return Math.min(100, current + TAXATION_CORRUPTION_PER_TURN[notch]);
}

function pickTaxationNotch(relationship: number, rng: () => number): TaxationNotch {
  const { hostileStandingMax, neutralStandingMax } = BALANCE.trials.governorship;
  const roll = rng();
  if (relationship < hostileStandingMax) {
    return roll < 0.6 ? 'extortionate' : roll < 0.9 ? 'heavy' : 'standard';
  }
  if (relationship < neutralStandingMax) {
    return roll < 0.5 ? 'standard' : roll < 0.85 ? 'heavy' : 'extortionate';
  }
  return roll < 0.4 ? 'benevolent' : roll < 0.75 ? 'light' : 'standard';
}

// ─── Save migration (legacy Trial → TrialState) ──────────────────────────────

/**
 * Converts an in-flight (or resolved-but-kept-for-history) legacy trial —
 * mirrors the wars/P3-A per-element migration pattern in gameStore.loadGame.
 * Purchased strength is never lost (design invariant 9): the RAW section
 * value (playerPrep.logos) is seeded directly from legacy.defenseStrength
 * (which already includes buildTrial's base-20 seed plus every action bonus
 * purchased) — Logos, not any section, since the legacy shim's bonuses were
 * a flat, undifferentiated mix (implementer's call, noted here). The
 * DERIVED total a converted trial plays with afterwards passes through
 * computeTotalPrepStrength like any other — under the default 'procedure'
 * Approach that's a ×1.1 Logos multiplier, so the number preserved here is
 * the raw purchased amount, not what the strength bar displays once
 * Approach multipliers apply (same rule for every trial, not a migration
 * quirk).
 */
export function convertLegacyTrial(
  legacy: LegacyTrial,
  currentTurnNumber: number,
  clans: Clan[],
  paterfamiliasId: string
): TrialState {
  const chargeMap: Record<LegacyTrial['charge'], ChargeId> = {
    corruption: 'peculatus',
    treason: 'maiestas',
    electoral_fraud: 'ambitus',
    murder: 'maiestas',
    military_incompetence: 'military_incompetence',
  };
  const accusingClan = clans.find(c => c.id === legacy.accusingClanId);
  const accuserLeaderId = accusingClan?.leaders[0]?.id ?? '';

  // Legacy trials don't record when they were filed, only turnsRemaining —
  // approximate filedSeason assuming buildTrial's standard 4-season window
  // (cosmetic display field only; startsSeason, the field that actually
  // matters for resolution timing, is exact).
  const approxOriginalWindow = 4;

  return {
    id: legacy.id,
    seat: 'defense',
    charge: chargeMap[legacy.charge] ?? 'peculatus',
    chargeSource: 'accusation',
    prosecutor: { kind: 'leader', leaderId: accuserLeaderId },
    defendant: { kind: 'family', characterId: legacy.accusedCharacterId },
    filedSeason: currentTurnNumber - (approxOriginalWindow - legacy.turnsRemaining),
    startsSeason: currentTurnNumber + legacy.turnsRemaining,
    playerPrep: {
      logos: legacy.defenseStrength, pathos: 0, ethos: 0,
      actionsUsed: legacy.actionsUsed, witnesses: [], bribedClanIds: [], praetorBribed: false,
    },
    approach: 'procedure',
    speakerId: paterfamiliasId,
    npcStrength: legacy.prosecutionStrength,
    juryLean: 0,
    consumedSecretIds: [],
    status: legacy.resolved ? 'resolved' : 'preparing',
    outcome: legacy.outcome,
    session: null,
  };
}

// ─── The Basilica's prep verbs (Phase 4, Chunk P4-D) ─────────────────────────
// Pure math + PrepRecord deltas — caller (gameStore) checks affordability,
// per-verb use caps, and slot/one-time limits before calling, same
// convention as fileProsecution's gate check living in the store rather
// than here.

export function gatherEvidenceCost(usesSoFar: number): number {
  return BALANCE.trials.prep.gatherEvidenceCostBaseFides + usesSoFar * BALANCE.trials.prep.gatherEvidenceCostPerUseFides;
}

export function gatherEvidenceBonus(agentIntrigus: number): number {
  return BALANCE.trials.prep.gatherEvidenceBonusBase + agentIntrigus;
}

export function applyGatherEvidence(prep: PrepRecord, agentIntrigus: number): PrepRecord {
  return {
    ...prep,
    logos: prep.logos + gatherEvidenceBonus(agentIntrigus),
    actionsUsed: [...prep.actionsUsed, 'gather_evidence'],
  };
}

export function presentSecretEvidenceBonus(potency: 1 | 2 | 3): number {
  return potency * BALANCE.trials.prep.presentSecretEvidenceBonusPerPotency;
}

export function applyPresentSecretEvidence(prep: PrepRecord, potency: 1 | 2 | 3): PrepRecord {
  return {
    ...prep,
    logos: prep.logos + presentSecretEvidenceBonus(potency),
    actionsUsed: [...prep.actionsUsed, 'present_secret_evidence'],
  };
}

export function applySecureWitness(prep: PrepRecord, witnessName: string): PrepRecord {
  const witness: Witness = { id: `witness-${Date.now()}-${prep.witnesses.length}`, name: witnessName };
  return {
    ...prep,
    pathos: prep.pathos + BALANCE.trials.prep.secureWitnessBonus,
    witnesses: [...prep.witnesses, witness],
    actionsUsed: [...prep.actionsUsed, 'secure_witness'],
  };
}

export function prepareOrationBonus(speakerRhetoric: number): number {
  return BALANCE.trials.prep.prepareOrationBonusBase + speakerRhetoric;
}

/** Value locks in at purchase — re-running after a speaker change does not
 *  retroactively re-rate past uses (design note in the plan's own words:
 *  "uses are speaker-agnostic, value locks at purchase"). */
export function applyPrepareOration(prep: PrepRecord, speakerRhetoric: number): PrepRecord {
  return {
    ...prep,
    pathos: prep.pathos + prepareOrationBonus(speakerRhetoric),
    actionsUsed: [...prep.actionsUsed, 'prepare_oration'],
  };
}

export function invokeAncestorsBonus(lifetimeDignitas: number): number {
  return Math.min(
    BALANCE.trials.prep.invokeAncestorsCap,
    Math.floor(lifetimeDignitas / BALANCE.trials.prep.invokeAncestorsDignitasDivisor)
  );
}

export function applyInvokeAncestors(prep: PrepRecord, lifetimeDignitas: number): PrepRecord {
  return {
    ...prep,
    ethos: prep.ethos + invokeAncestorsBonus(lifetimeDignitas),
    actionsUsed: [...prep.actionsUsed, 'invoke_ancestors'],
  };
}

/** Per clan bloc — dedupe (a clan can only be bribed once per trial) is the
 *  caller's job via prep.bribedClanIds.includes(clanId). Discovery
 *  (juryBribeDiscoveryChance) rolls at trial-day session start (P4-E) —
 *  inert here, just recorded. */
export function applyBribeJurors(prep: PrepRecord, clanId: string): PrepRecord {
  return {
    ...prep,
    ethos: prep.ethos + BALANCE.trials.prep.bribeJurorsBonusPerBloc,
    bribedClanIds: [...prep.bribedClanIds, clanId],
    actionsUsed: [...prep.actionsUsed, 'bribe_jurors'],
  };
}

/** One-time. Same inert-discovery note as applyBribeJurors. */
export function applyBribePraetor(prep: PrepRecord): PrepRecord {
  return {
    ...prep,
    ethos: prep.ethos + BALANCE.trials.prep.bribePraetorBonus,
    praetorBribed: true,
    actionsUsed: [...prep.actionsUsed, 'bribe_praetor'],
  };
}

/** Reworded from the legacy shim's "+strength for you" to "opponent
 *  −strength" per the plan's own table — reduces npcStrength directly
 *  (caller applies the delta to TrialState.npcStrength, floored at 0; there
 *  is no opponent-witness model to remove one from). Only records the
 *  one-time use here; the actual npcStrength write happens in gameStore
 *  since it targets a different field than playerPrep. */
export function applyIntimidateWitness(prep: PrepRecord): PrepRecord {
  return {
    ...prep,
    actionsUsed: [...prep.actionsUsed, 'intimidate_witness'],
  };
}
