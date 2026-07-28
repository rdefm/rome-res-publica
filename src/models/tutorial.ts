// Tutorial redesign — types only, no logic. tutorial-redesign-plan.md §2.2.

import type { TabName } from './agenda';

// Re-exported so tutorial-domain code can import TabName from here without
// every file needing to know it actually lives in models/agenda.ts.
export type { TabName };

export type TutorialArcId = 'prologue' | 'embassy' | 'war' | 'courts';

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
export type TutorialLessonId = 'lesson-trial' | 'lesson-battle' | 'lesson-death' | 'lesson-succession';

export type TutorialAnyArcId = TutorialArcId | TutorialLessonId;

export type TutorialRail = 'hard' | 'guided';

/** Stable ids for spotlightable UI. Namespaced <area>.<thing>. */
export type TutorialTargetId = string;

export type TutorialAdvance =
  | { kind: 'tap' }                              // narration only — tap the caption to continue
  | { kind: 'predicate'; predicateId: string }   // resolved via engine/tutorialEngine
  | { kind: 'eventResolved'; defId: string };    // an EventDef finished resolving

export interface TutorialStep {
  id: string;                        // globally unique, e.g. 'prologue.act2.court-flaccus'
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
}
