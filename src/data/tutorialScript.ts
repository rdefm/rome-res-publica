// The four tutorial arcs as static content. No logic — see engine/tutorialEngine.ts
// for step resolution and engine/tutorialTargets.ts for the spotlight registry.
// tutorial-redesign-plan.md §2.1/§2.5.
//
// Steps are authored incrementally per the plan's chunk order: T5 (prologue),
// T7 (embassy), T8 (war), T9 (courts). All four arcs are declared here from
// the start so downstream chunks only ever append to `steps`, never touch
// this file's structure.

import type { TutorialArc, TutorialArcId } from '../models/tutorial';

export const TUTORIAL_ARCS: Record<TutorialArcId, TutorialArc> = {
  prologue: { id: 'prologue', title: 'The First Year', steps: [] },
  embassy:  { id: 'embassy',  title: 'The Embassy',     steps: [] },
  war:      { id: 'war',      title: 'The War',         steps: [] },
  courts:   { id: 'courts',   title: 'The Courts',      steps: [] },
};
