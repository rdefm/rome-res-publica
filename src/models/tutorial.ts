// Tutorial redesign — types only, no logic. tutorial-redesign-plan.md §2.2.

import type { TabName } from './agenda';

// Re-exported so tutorial-domain code can import TabName from here without
// every file needing to know it actually lives in models/agenda.ts.
export type { TabName };

export type TutorialArcId = 'prologue' | 'embassy' | 'war' | 'courts';
export type TutorialRail = 'hard' | 'guided';

/** Stable ids for spotlightable UI. Namespaced <area>.<thing>. */
export type TutorialTargetId = string;

export type TutorialAdvance =
  | { kind: 'tap' }                              // narration only — tap the caption to continue
  | { kind: 'predicate'; predicateId: string }   // resolved via engine/tutorialEngine
  | { kind: 'eventResolved'; defId: string };    // an EventDef finished resolving

export interface TutorialStep {
  id: string;                        // globally unique, e.g. 'prologue.act2.court-flaccus'
  arc: TutorialArcId;
  actLabel?: string;                 // display only, e.g. 'Act II — The Forum'
  rail: TutorialRail;
  requiresTab?: TabName;             // director navigates here on enter if not already there
  target?: TutorialTargetId;         // omit for a full-screen narration beat
  narration: string;                 // Philon's voice; supports no templating in v1
  advance: TutorialAdvance;
  onEnterEffectId?: string;          // resolved via engine/tutorialEngine
  onCompleteEffectId?: string;
  unlocksTab?: TabName;              // the unsealing ceremony fires on completion
}

export interface TutorialArc {
  id: TutorialArcId;
  title: string;
  steps: TutorialStep[];
}

export interface TutorialState {
  activeArc: TutorialArcId | null;
  stepId: string | null;
  completedArcs: TutorialArcId[];
  unlockedTabs: TabName[];
  skipped: boolean;
}
