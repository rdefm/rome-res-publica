import type { StartDefinition, DifficultyId } from '../models/gameStart';
import { ALT_FAMILIES } from './altFamilies';

// ─── Start definitions ────────────────────────────────────────────────────────
//
// One entry per available start. The picker in StartMenuScreen renders these as
// cards. The new-game store action reads stateOverrides and tutorialScriptId.
// Adding a new start = one new row here + optional stateOverrides + optional
// script in TUTORIAL_SCRIPTS. Nothing else in the codebase branches on startId
// except the two hooks described in Fable-phase1-implementation-plan.md §P1-G.

export const START_DEFINITIONS: StartDefinition[] = [
  {
    id: 'guided',
    name: 'The Guided Path',
    subtitle: 'Philon will teach you the ways of the Republic',
    description:
      'Begin under the eye of Philon, your household secretary. ' +
      'Events through your first year introduce the Domus, the Forum, the Curia, ' +
      'and the Cursus — no tutorial screens, only Rome doing what Rome does. ' +
      'The Tablet opens each season with your priorities.',
    recommended: true,
    tutorialScriptId: 'tutorial-264',
  },
  {
    id: 'standard',
    name: 'Free Start',
    subtitle: 'Rome, unexplained. For returning patresfamilias.',
    description:
      'Begin immediately with full agency. ' +
      'All events are available from the first season; no scripted guidance. ' +
      'The Republic will not wait for you to find your feet.',
    recommended: false,
  },
  // ─── Phase 5, Chunk P5-E — alternate starting families ────────────────────
  // Free-start-only sidegrades (invariant 3/5) unlocked by Hall of Ancestors
  // records — see altFamilies.ts's isUnlocked predicates. Both reuse the
  // free start's own agency (no tutorial script), differing only in
  // stateOverrides.
  {
    id: 'duilia',
    name: 'Gens Duilia',
    subtitle: '"Nova Pecunia" — buy your way into a Republic that sneers at you',
    description:
      'Gaius Duilius has coin enough to shame half the Senate and a name none of them recognize. ' +
      'Wealthy, connected to nobody, and starting from nothing but money. ' +
      'The Republic can be bought a door at a time — if you can stomach how it looks.',
    recommended: false,
    stateOverrides: {
      gensId: ALT_FAMILIES.duilia.gensId,
      gensSurname: ALT_FAMILIES.duilia.gensSurname,
      gensName: ALT_FAMILIES.duilia.gensName,
      gensPlural: ALT_FAMILIES.duilia.gensPlural,
      family: ALT_FAMILIES.duilia.family,
      denarii: ALT_FAMILIES.duilia.denarii,
      fides: ALT_FAMILIES.duilia.fides,
      lifetimeDignitas: ALT_FAMILIES.duilia.lifetimeDignitas,
      familyReputations: ALT_FAMILIES.duilia.familyReputations,
      ownedAssets: ALT_FAMILIES.duilia.ownedAssets,
    },
    unlockCondition: ALT_FAMILIES.duilia.unlockCondition,
    isUnlocked: ALT_FAMILIES.duilia.isUnlocked,
  },
  {
    id: 'manlia',
    name: 'Gens Manlia',
    subtitle: '"The Disgraced" — claw back a name the Forum still whispers about',
    description:
      'Titus Manlius carries a patrician name and the weight of what it did to earn its disgrace. ' +
      'Capable, resented, and one loose word from real trouble. ' +
      'Every clan in Rome remembers exactly why this house fell — some more fondly than others.',
    recommended: false,
    stateOverrides: {
      gensId: ALT_FAMILIES.manlia.gensId,
      gensSurname: ALT_FAMILIES.manlia.gensSurname,
      gensName: ALT_FAMILIES.manlia.gensName,
      gensPlural: ALT_FAMILIES.manlia.gensPlural,
      family: ALT_FAMILIES.manlia.family,
      denarii: ALT_FAMILIES.manlia.denarii,
      fides: ALT_FAMILIES.manlia.fides,
      lifetimeDignitas: ALT_FAMILIES.manlia.lifetimeDignitas,
      familyReputations: ALT_FAMILIES.manlia.familyReputations,
      ownedAssets: ALT_FAMILIES.manlia.ownedAssets,
    },
    unlockCondition: ALT_FAMILIES.manlia.unlockCondition,
    isUnlocked: ALT_FAMILIES.manlia.isUnlocked,
  },
];

// ─── Difficulty presets (Phase 5, Chunk P5-G) ────────────────────────────────
//
// Display copy only — the multiplier values themselves live in
// BALANCE.difficulty (single source of truth, so the picker's "literal
// numbers" requirement is always read live, never duplicated as copy text).
// A step in the new-game flow after family selection, for every start
// except 'guided' (its tutorial numbers are authored against Aequus, so
// StartMenuScreen never routes it through the picker — always resolves to
// 'aequus', enforced again in gameStore.startGame as a belt-and-braces
// guarantee).

export interface DifficultyDefinition {
  id: DifficultyId;
  name: string;
  /** One-line fiction shown under the name, e.g. "the Fates are kind". */
  tagline: string;
}

export const DIFFICULTY_DEFINITIONS: DifficultyDefinition[] = [
  { id: 'clemens', name: 'Clemens', tagline: 'the Fates are kind' },
  { id: 'aequus',  name: 'Aequus',  tagline: 'Rome as she is' },
  { id: 'ferox',   name: 'Ferox',   tagline: 'the Republic shows no mercy' },
];

// ─── Tutorial script registry ─────────────────────────────────────────────────
//
// Maps tutorialScriptId → ordered array of event defIds.
// On new game, the chosen start's script (if any) is copied wholesale into
// state.tutorialQueue. The turnSequencer event slot pops entries in order,
// gate-checking each against the current season before firing.
//
// Event defIds listed here are authored in src/data/tutorialEvents.ts (P1-G).
// The registry is here rather than in tutorialEvents.ts to keep the event
// content file focused on EventDef objects, and to allow future starts to
// reference a subset of existing tutorial events.

export const TUTORIAL_SCRIPTS: Record<string, string[]> = {
  'tutorial-264': [
    'evt-tut-00', // gameStart — "The Greek at the Door" (fires immediately, not via season slot)
    'evt-tut-01', // year-1 Spring  — "The Weight of a Name"
    'evt-tut-02', // year-1 Summer  — "A Wolf at Dinner"
    'evt-tut-03', // year-1 Autumn  — "The Business of the Curia"
    'evt-tut-04', // year-1 Winter  — "The Claudian Smile"
    'evt-tut-05', // year-2 Spring  — "A Man at Eighteen"
    'evt-tut-06', // year-2 Winter  — "The Count" (conditional: skip if not campaigning)
    'evt-tut-07', // season after tut-06 — "The Tablet Is Yours"
  ],
};
