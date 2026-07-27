// Module-level registry of measured rects for spotlightable UI.
//
// Deliberately NOT part of gameStore: rects are UI-only (garbage in a save
// file) and can update on every scroll frame, which would re-render every
// component subscribed to the store. tutorial-redesign-plan.md §2.4.

import type { TutorialTargetId } from '../models/tutorial';
export type { TutorialTargetId };

export interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const targets = new Map<TutorialTargetId, TargetRect>();
const listeners = new Set<() => void>();

// Remeasure callbacks, one per currently-mounted target — registered
// automatically by useTutorialTarget. A ScrollView containing a spotlightable
// target should call remeasureAllTargets() on scroll-end: RN's onLayout only
// fires when a view's own frame changes, never from its ancestor ScrollView
// scrolling, so a target's rect otherwise goes stale (and, worse, can end up
// pointing off-screen) the moment the user scrolls after the initial layout.
const remeasurers = new Map<TutorialTargetId, () => void>();

export function registerRemeasurer(id: TutorialTargetId, remeasure: () => void): void {
  remeasurers.set(id, remeasure);
}

export function unregisterRemeasurer(id: TutorialTargetId): void {
  remeasurers.delete(id);
}

export function remeasureAllTargets(): void {
  remeasurers.forEach(fn => fn());
}

function rectsEqual(a: TargetRect, b: TargetRect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function registerTarget(id: TutorialTargetId, rect: TargetRect): void {
  const prev = targets.get(id);
  if (prev && rectsEqual(prev, rect)) return; // no-op — avoid notify storms on identical re-measures
  targets.set(id, rect);
  listeners.forEach(cb => cb());
}

export function clearTarget(id: TutorialTargetId): void {
  if (!targets.has(id)) return;
  targets.delete(id);
  listeners.forEach(cb => cb());
}

export function getTarget(id: TutorialTargetId): TargetRect | null {
  return targets.get(id) ?? null;
}

export function subscribeTargets(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
