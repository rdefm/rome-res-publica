// Tutorial step resolution — predicate/effect registries plus pure lookup
// helpers. tutorial-redesign-plan.md §2.5. Predicates/effects live here
// (not inline in tutorialScript.ts) per CLAUDE.md's data-layer rule: no
// logic in src/data/.

import type { GameState } from '../state/gameStore';
import type { TutorialArcId, TutorialStep, TabName } from '../models/tutorial';
import { TUTORIAL_ARCS } from '../data/tutorialScript';

export const ALL_TABS: TabName[] = ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'];

/** Order arcs resolve in — used by skipTutorialArc to cascade downstream arcs. */
export const TUTORIAL_ARC_ORDER: TutorialArcId[] = ['prologue', 'embassy', 'war', 'courts'];

// Populated by each content chunk (T5 prologue, T7 embassy, T8 war, T9
// courts) alongside the useTutorialTarget(id) call sites they instrument.
// validateTutorialScript() checks every step.target against this set so
// script/component drift (a renamed or removed target) fails a test instead
// of silently spotlighting nothing at runtime.
export const TUTORIAL_TARGET_IDS = new Set<string>([]);

export const TUTORIAL_PREDICATES: Record<string, (s: GameState) => boolean> = {};

export const TUTORIAL_EFFECTS: Record<string, (s: GameState) => Partial<GameState>> = {};

export function getStep(stepId: string): TutorialStep | null {
  for (const arc of Object.values(TUTORIAL_ARCS)) {
    const step = arc.steps.find(st => st.id === stepId);
    if (step) return step;
  }
  return null;
}

/** Next step in `current`'s arc, in authored order. Null past the arc's last step. */
export function getNextStep(current: TutorialStep, _s: GameState): TutorialStep | null {
  const arc = TUTORIAL_ARCS[current.arc];
  const idx = arc.steps.findIndex(st => st.id === current.id);
  if (idx === -1) return null;
  return arc.steps[idx + 1] ?? null;
}

/**
 * True only for a `predicate`-kind advance whose predicate currently holds.
 * `tap` and `eventResolved` steps are never "satisfied" by state polling —
 * they advance via an explicit user tap or the director's event-resolution
 * hook, respectively.
 */
export function isStepSatisfied(step: TutorialStep, s: GameState): boolean {
  if (step.advance.kind !== 'predicate') return false;
  const predicate = TUTORIAL_PREDICATES[step.advance.predicateId];
  return predicate ? predicate(s) : false;
}

export function isTabSealed(tab: TabName, s: GameState): boolean {
  return !s.tutorial.unlockedTabs.includes(tab);
}

/**
 * True while the guided prologue is hard-railing the world: random events,
 * ambient crisis drift, war ignition, the Claudius demand block, births, and
 * the natural-mortality roll all gate on this (turnSequencer.ts,
 * tutorial-redesign-plan.md §3 T4's six named targets). Also gates passive
 * bill resolution and auto-bill-injection — found during T4's own
 * verification, not one of the plan's original six: bills resolving in the
 * background off NPC-driven support (nothing to do with the player) can
 * move crisis tracks on their own via passEffect/failEffect, which is both
 * "not actually frozen" and a confound for Act III's own bill-vote teaching
 * moment. `?.` guards bespoke test fixtures built via
 * `as unknown as GameState` that don't set `tutorial` — never null in any
 * real, INITIAL_STATE-derived GameState.
 */
export function isWorldFrozen(s: GameState): boolean {
  return s.tutorial?.activeArc === 'prologue';
}

export function applyTutorialEffect(effectId: string | undefined, s: GameState): Partial<GameState> {
  if (!effectId) return {};
  const effect = TUTORIAL_EFFECTS[effectId];
  return effect ? effect(s) : {};
}

/**
 * Dev-only drift guard: every predicateId/onEnterEffectId/onCompleteEffectId
 * a step references must resolve in the registries above, and every
 * step.target must be a known instrumented id. Call from the director in
 * __DEV__; asserted directly in __tests__/tutorialEngine.test.ts.
 */
export function validateTutorialScript(): void {
  for (const arc of Object.values(TUTORIAL_ARCS)) {
    for (const step of arc.steps) {
      if (step.advance.kind === 'predicate' && !(step.advance.predicateId in TUTORIAL_PREDICATES)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unknown predicate "${step.advance.predicateId}"`,
        );
      }
      if (step.onEnterEffectId && !(step.onEnterEffectId in TUTORIAL_EFFECTS)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unknown onEnterEffectId "${step.onEnterEffectId}"`,
        );
      }
      if (step.onCompleteEffectId && !(step.onCompleteEffectId in TUTORIAL_EFFECTS)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unknown onCompleteEffectId "${step.onCompleteEffectId}"`,
        );
      }
      if (step.target && !TUTORIAL_TARGET_IDS.has(step.target)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unregistered target "${step.target}"`,
        );
      }
    }
  }
}
