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
import { OFFICES } from '../data/offices';
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

  const resolvedTrials = state.trialQueue.filter(t => t.resolved && t.outcome);
  const survived = resolvedTrials.filter(t => t.outcome === 'acquitted' || t.outcome === 'fined' || t.outcome === 'dismissed').length;
  const lost = resolvedTrials.filter(t => t.outcome === 'exiled' || t.outcome === 'executed').length;
  if (survived === 1) beats.push('a trial survived');
  else if (survived > 1) beats.push(`${survived} trials survived`);
  if (lost === 1) beats.push('a trial lost');
  else if (lost > 1) beats.push(`${lost} trials lost`);

  if (state.cadetBranchUsed) beats.push('the name carried on by a cadet branch when the direct line failed');

  const tracks = state.crisis;
  const trackIds = ['war', 'unrest', 'constitution', 'economy'] as const;
  const worst = trackIds.reduce((w, id) => (tracks[id].level > tracks[w].level ? id : w), trackIds[0]);
  beats.push(tracks[worst].level >= 60
    ? `Rome left in ${tracks[worst].namedCrisis ?? 'crisis'}`
    : 'Rome left in relative stability');

  return beats;
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

  return {
    id: `ancestor-${state.turnNumber}-${Date.now()}`,
    gensName: 'Brutia',
    foundedYear: state.gensFoundedYear,
    endedYear: state.year,
    outcome,
    finalLegacy: Math.round(state.lifetimeDignitas * state.legacyPenaltyMult),
    legacyPenaltyApplied: state.legacyPenaltyMult < 1,
    highestOffice,
    generations: state.paterfamiliasGenerations,
    notableBeats: buildNotableBeats(state),
    familyTree: buildFamilyTree(state),
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
