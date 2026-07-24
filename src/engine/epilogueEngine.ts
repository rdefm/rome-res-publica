// ─── Epilogue Engine ──────────────────────────────────────────────────────────
// Phase 3, Chunk P3-E. Pure: GameState -> AncestorRecord. No store/React
// access, matching every other strategic-layer engine's "type-only GameState
// import" convention (troopEngine.ts, trialEngine.ts, warEngine.ts, etc.).
//
// "Final Legacy" is state.lifetimeDignitas x state.legacyPenaltyMult, NOT
// anything from legacyEngine.ts's LegacyObjective system — verified before
// writing this file that no single "Legacy total" number exists anywhere:
// each LegacyObjective tracks a different, unit-mismatched quantity (Consuls
// produced, lifetime Denarii earned, ...), so summing their currentValues
// would mix apples and oranges. lifetimeDignitas is already the one running
// score every bill/event/office/Legacy-milestone-reward this whole game
// feeds into — the natural "how did this family do" number.

import type { GameState } from '../state/gameStore';
import type { AncestorRecord, FamilyTreeMember, EpilogueOutcome } from '../models/epilogue';
import type { TrialState } from '../models/trial';
import { OFFICES } from '../data/offices';
import { TRIAL_CHARGE_DEFS } from '../data/trialCharges';
import { getHighestOffice } from './electionEngine';
import { assembleHistorianParagraph } from '../data/epilogueText';

function buildFamilyTree(state: GameState): FamilyTreeMember[] {
  return state.family.map(c => ({ id: c.id, name: c.name, role: c.role, age: c.age }));
}

function buildNotableBeats(state: GameState): string[] {
  const beats: string[] = [];

  const triumphs = Object.keys(state.flags).filter(k => k.startsWith('triumph-granted-')).length;
  if (triumphs === 1) beats.push('a Triumph celebrated');
  else if (triumphs > 1) beats.push(`${triumphs} Triumphs celebrated`);

  // Phase 4, Chunk P4-C — only 'defense'-seat trials read as "survived/lost"
  // (the player facing trial); prosecution-seat trials (P4-C, new) get their
  // own "famous trial" epilogue framing in P4-F, not counted here.
  const resolvedTrials = (state.trials ?? []).filter(t => t.status === 'resolved' && t.outcome && t.seat === 'defense');
  const survived = resolvedTrials.filter(t => t.outcome === 'acquitted' || t.outcome === 'fined' || t.outcome === 'dismissed').length;
  const lost = resolvedTrials.filter(t => t.outcome === 'exiled' || t.outcome === 'executed').length;
  if (survived === 1) beats.push('a trial survived');
  else if (survived > 1) beats.push(`${survived} trials survived`);
  if (lost === 1) beats.push('a trial lost');
  else if (lost > 1) beats.push(`${lost} trials lost`);

  // Phase 4, Chunk P4-F — the prosecution-seat mirror of the defense framing
  // above (symmetric with "trial survived/lost": win = the target found
  // guilty, loss = acquitted/dismissed and calumnia risked).
  const prosecutionTrials = (state.trials ?? []).filter(t => t.status === 'resolved' && t.outcome && t.seat === 'prosecution');
  const prosecutionWins = prosecutionTrials.filter(t => t.outcome === 'fined' || t.outcome === 'exiled' || t.outcome === 'executed').length;
  const prosecutionLosses = prosecutionTrials.filter(t => t.outcome === 'acquitted' || t.outcome === 'dismissed').length;
  if (prosecutionWins === 1) beats.push('a prosecution won');
  else if (prosecutionWins > 1) beats.push(`${prosecutionWins} prosecutions won`);
  if (prosecutionLosses === 1) beats.push('a prosecution lost to calumnia');
  else if (prosecutionLosses > 1) beats.push(`${prosecutionLosses} prosecutions lost to calumnia`);

  if (state.cadetBranchUsed) beats.push('the name carried on by a cadet branch when the direct line failed');

  const tracks = state.crisis;
  const trackIds = ['war', 'unrest', 'constitution', 'economy'] as const;
  const worst = trackIds.reduce((w, id) => (tracks[id].level > tracks[w].level ? id : w), trackIds[0]);
  beats.push(tracks[worst].level >= 60
    ? `Rome left in ${tracks[worst].namedCrisis ?? 'crisis'}`
    : 'Rome left in relative stability');

  return beats;
}

/**
 * Phase 4, Chunk P4-F — the run's single "Cicero moment," for the epilogue
 * paragraph's dedicated famous-trial sentence. Priority: a Vox-Populi win
 * (convicted a sitting magistrate, trial.convictedSittingMagistrate) beats
 * any ordinary conviction; ties (including "no Vox Populi win exists") break
 * on most recent (highest startsSeason). Returns null for a run with no
 * qualifying win — buildAncestorRecordWithoutParagraph leaves famousTrial
 * undefined in that case.
 */
function pickFamousTrial(state: GameState): string | null {
  const wins = (state.trials ?? []).filter((t): t is TrialState & { defendant: { kind: 'leader'; leaderId: string } } =>
    t.status === 'resolved' && t.seat === 'prosecution' && t.defendant.kind === 'leader' &&
    (t.outcome === 'fined' || t.outcome === 'exiled' || t.outcome === 'executed')
  );
  if (wins.length === 0) return null;

  const best = [...wins].sort((a, b) => {
    if (!!a.convictedSittingMagistrate !== !!b.convictedSittingMagistrate) {
      return a.convictedSittingMagistrate ? -1 : 1;
    }
    return b.startsSeason - a.startsSeason;
  })[0];

  const leaderName = state.clans.flatMap(c => c.leaders).find(l => l.id === best.defendant.leaderId)?.name ?? 'the accused';
  const chargeDef = TRIAL_CHARGE_DEFS[best.charge];
  return `the conviction of ${leaderName} on charges of ${chargeDef.displayName}`;
}

/** Builds the full record — everything except historianParagraph, which
 *  needs the rest of the record as input (assembleHistorianParagraph).
 *  Split out so a future caller (tests, mainly) can inspect the record
 *  before/without the text-assembly step. */
export function buildAncestorRecordWithoutParagraph(
  state: GameState,
  outcome: EpilogueOutcome,
): Omit<AncestorRecord, 'historianParagraph'> {
  const highestOffice = getHighestOffice(
    [state.highestOfficeEverHeld, ...state.heldOffices].filter((id): id is string => !!id)
  );

  const famousTrial = pickFamousTrial(state);

  return {
    id: `ancestor-${state.turnNumber}-${Date.now()}`,
    // Phase 5, Chunk P5-E — was hardcoded 'Brutia' regardless of the actual
    // run's family; every finished run's Hall record silently mis-recorded
    // this until now (found during the gens-neutrality sweep).
    gensName: state.gensName,
    gensId: state.gensId,
    difficulty: state.difficulty,
    foundedYear: state.gensFoundedYear,
    endedYear: state.year,
    outcome,
    finalLegacy: Math.round(state.lifetimeDignitas * state.legacyPenaltyMult),
    legacyPenaltyApplied: state.legacyPenaltyMult < 1,
    highestOffice,
    generations: state.paterfamiliasGenerations,
    notableBeats: buildNotableBeats(state),
    familyTree: buildFamilyTree(state),
    ...(famousTrial ? { famousTrial } : {}),
    recordedAt: Date.now(),
  };
}

/** The one entry point — builds the record AND its historian paragraph.
 *  `outcome` is passed explicitly (from GameState.pendingEpilogue at the
 *  moment the caller detects it) rather than re-read from state, so the
 *  caller can clear pendingEpilogue in the same patch without a stale-read
 *  race. */
export function buildAncestorRecord(state: GameState, outcome: EpilogueOutcome): AncestorRecord {
  const withoutParagraph = buildAncestorRecordWithoutParagraph(state, outcome);
  return {
    ...withoutParagraph,
    historianParagraph: assembleHistorianParagraph(withoutParagraph),
  };
}

// Re-exported so callers needn't import from data/offices.ts just to render
// a highestOffice id — matches epilogueText.ts's own internal helper.
export function officeName(officeId: string | null): string | null {
  if (!officeId) return null;
  return OFFICES.find(o => o.id === officeId)?.name ?? null;
}
