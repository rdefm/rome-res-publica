import type { StartDefinition } from '../models/gameStart';

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
