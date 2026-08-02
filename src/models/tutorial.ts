// Tutorial redesign — types only, no logic. tutorial-redesign-plan.md §2.2.

import type { TabName } from './agenda';

// Re-exported so tutorial-domain code can import TabName from here without
// every file needing to know it actually lives in models/agenda.ts.
export type { TabName };

// Tutorial rebuild, ticket 04 — 'beat-house' is the first of three planned
// "beats" (tutorial-rebuild-plan.md §2.1) replacing the old prologue's Acts
// I-II (Domus/Forum). Ticket 05 added 'beat-chamber' (old Act III/Curia).
// Ticket 06 added 'beat-ladder' (old Act V/Cursus), retiring it out of
// 'prologue'; Act IV/Provinciae was already superseded by ticket 02's
// just-in-time lessons (it still runs as scripted content too — ticket 06's
// own review flagged that overlap for the design lead, not resolved
// unilaterally). TUTORIAL_ARC_ORDER chains 'beat-house' -> 'beat-chamber' ->
// 'beat-ladder' -> 'prologue' (now a single-act arc, just Act IV) ->
// 'embassy' -> 'war' -> 'courts'.
export type TutorialArcId = 'beat-house' | 'beat-chamber' | 'beat-ladder' | 'prologue' | 'embassy' | 'war' | 'courts';

/** The three guided beats specifically — the only arcs ticket 07's act
 *  selector ever starts fresh at or replays. A narrower type than
 *  TutorialArcId so startGame's startArc param and TutorialState.replayingArc
 *  can't accidentally be pointed at 'prologue'/'embassy'/'war'/'courts',
 *  none of which this feature was built or tested against. */
export type TutorialBeatId = 'beat-house' | 'beat-chamber' | 'beat-ladder';

/** T10 — standalone just-in-time micro-lessons, on the same arc/step engine
 *  as the four main arcs above but deliberately NOT part of
 *  `tutorialEngine.TUTORIAL_ARC_ORDER`: each fires as a one-off (via
 *  `startTutorialArc`, entered by `tutorialEngine.getEligibleLesson` rather
 *  than the main chain's auto-advance), completes, and goes idle again —
 *  `TUTORIAL_ARC_ORDER.indexOf` already returns -1 for these ids, which
 *  `advanceTutorialStep`'s existing "no next arc" branch treats correctly
 *  as "just finish, don't chain into anything." Fire on Free Start too,
 *  per the plan — unlike the four main arcs, entry never depends on
 *  `tutorial.activeArc` having been 'prologue' at game start. */
export type TutorialLessonId =
  | 'lesson-trial' | 'lesson-battle' | 'lesson-death' | 'lesson-succession'
  // Tutorial rebuild, ticket 02 — fire the first time a player opens a
  // Provinciae city sheet / an asset-purchase modal, so Provinciae and
  // asset-buying can be cut from the mandatory guided path without losing
  // player-facing coverage of those mechanics. Same one-off, flag-gated,
  // non-chaining convention as the four lessons above.
  | 'lesson-provinciae' | 'lesson-assets';

export type TutorialAnyArcId = TutorialArcId | TutorialLessonId;

export type TutorialRail = 'hard' | 'guided';

/** Stable ids for spotlightable UI. Namespaced <area>.<thing>. */
export type TutorialTargetId = string;

export type TutorialAdvance =
  | { kind: 'tap' }                              // narration only — tap the caption to continue
  | { kind: 'predicate'; predicateId: string }   // resolved via engine/tutorialEngine
  | { kind: 'eventResolved'; defId: string };    // an EventDef finished resolving

export interface TutorialStep {
  id: string;                        // globally unique, e.g. 'beat-house.court-flaccus'
  arc: TutorialAnyArcId;
  actLabel?: string;                 // display only, e.g. 'Act II — The Forum'
  rail: TutorialRail;
  requiresTab?: TabName;             // App.tsx's TutorialLayer spotlights this tab's button and
                                      // waits for a real tap if the player isn't already there —
                                      // no longer auto-navigated (tutorial fix)
  target?: TutorialTargetId;         // omit for a full-screen narration beat
  narration: string;                 // Philon's voice; supports no templating in v1
  advance: TutorialAdvance;
  onEnterEffectId?: string;          // resolved via engine/tutorialEngine
  onCompleteEffectId?: string;
  unlocksTab?: TabName;              // the unsealing ceremony fires on completion
}

export interface TutorialArc {
  id: TutorialAnyArcId;
  title: string;
  steps: TutorialStep[];
}

export interface TutorialState {
  activeArc: TutorialAnyArcId | null;
  stepId: string | null;
  completedArcs: TutorialAnyArcId[];
  unlockedTabs: TabName[];
  skipped: boolean;
  /** Tutorial rebuild, ticket 07 (act selector/replay, tutorial-rebuild-plan.md
   *  §2.4) — set only while the player is reviewing a beat's teach content
   *  from the act selector. Deliberately kept separate from activeArc/stepId
   *  (which track REAL progress): a replay must never disturb a genuinely
   *  in-progress or completed beat's own state. `applyTutorialEffect`
   *  (tutorialEngine.ts) short-circuits to `{}` whenever this is set, so no
   *  tutorial-authored effect (ambition grants, flag stamps) ever fires
   *  during a replay; `isTabSealed` also bypasses its real unlockedTabs
   *  check while replaying, since a review session may walk through a tab
   *  the player's real progress hasn't reached yet. */
  replayingArc: TutorialBeatId | null;
  replayStepId: string | null;
}
