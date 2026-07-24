// ─── Epilogue Models ──────────────────────────────────────────────────────────
// Phase 3, Chunk P3-E. No logic here — see engine/epilogueEngine.ts.

import type { Character } from './character';

/** The five terminal outcomes. 'victory'/'exhaustion'/'humbled' arrive via
 *  GameState.pendingEpilogue from warEngine.ts (P3-A/B); 'gens_ends' from
 *  inheritanceEngine.ts's extinction path (P3-D); 'republic_falls' is new
 *  here — the Crisis-100 hard terminal (see crisisEngine.ts). */
export type EpilogueOutcome = 'victory' | 'exhaustion' | 'humbled' | 'republic_falls' | 'gens_ends';

/** A compact family-tree entry — enough to render, not a full genealogy. */
export interface FamilyTreeMember {
  id: string;
  name: string;
  role: Character['role'];
  age: number;
}

export interface AncestorRecord {
  /** Distinct from any Character id — a record id, unique per epilogue. */
  id: string;
  gensName: string;
  /** Phase 5, Chunk P5-E — which starting family this run used. Optional/
   *  undefined on any pre-P5-E Hall record (default-spread as 'brutii' at
   *  read time — every historical record before this chunk was Brutii). */
  gensId?: import('./gameStart').GensId;
  /** Phase 5, Chunk P5-G — the run's difficulty preset. Optional/undefined
   *  on any pre-P5-G Hall record (default-spread as 'aequus' at read time,
   *  same discipline as gensId above). No score multiplier — this
   *  contextualizes the record, it does not inflate finalLegacy. */
  difficulty?: import('./gameStart').DifficultyId;
  /** GameState.year at run start — always -264 today (no alternate starts
   *  exist yet), stored rather than hardcoded so a future start variant
   *  doesn't need this file touched. */
  foundedYear: number;
  /** GameState.year at the moment the epilogue fired. */
  endedYear: number;
  outcome: EpilogueOutcome;
  /** state.lifetimeDignitas × state.legacyPenaltyMult, rounded — see
   *  epilogueEngine.ts's header comment for why lifetimeDignitas (not the
   *  LegacyObjective system, whose per-objective units don't sum
   *  meaningfully) is this run's "Legacy total". */
  finalLegacy: number;
  /** True if state.legacyPenaltyMult was < 1 (a cadet-branch continuation
   *  occurred this run) — EpilogueScreen shows this next to finalLegacy. */
  legacyPenaltyApplied: boolean;
  /** OfficeId, or null for a run that never reached one — see
   *  GameState.highestOfficeEverHeld's doc comment for how this survives
   *  successions (which otherwise clear the cursus per generation). */
  highestOffice: string | null;
  /** Number of paterfamilias this run had, including the starting one. */
  generations: number;
  /** Short, human-readable lines: triumphs, trial outcomes, whether a
   *  cadet continuation occurred, Rome's final crisis posture. Assembled
   *  by epilogueEngine.buildAncestorRecord — see that function. */
  notableBeats: string[];
  /** state.family at the moment the epilogue fired (or, for 'gens_ends',
   *  the empty/near-empty family at extinction). */
  familyTree: FamilyTreeMember[];
  /** The procedurally-assembled "what the historians wrote" paragraph —
   *  see data/epilogueText.ts. */
  historianParagraph: string;
  /** Phase 4, Chunk P4-F — a short noun-phrase spotlighting this run's single
   *  most notable prosecution win (the "Cicero moment"), e.g. "the conviction
   *  of Appius Claudius Pulcher on charges of Treason". Optional/undefined
   *  for a run with no qualifying win, and absent entirely on any
   *  Phase-3-and-earlier Hall record — default-spread, must still render. */
  famousTrial?: string;
  /** Date.now() — Hall of Ancestors sort order (most recent first). */
  recordedAt: number;
}
