import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, findNodeHandle } from 'react-native';
import type { RefObject } from 'react';
import type { ScrollView, View } from 'react-native';
import {
  registerTarget, clearTarget, registerRemeasurer, unregisterRemeasurer,
} from '../../engine/tutorialTargets';
import type { TutorialTargetId } from '../../engine/tutorialTargets';
import { getStep } from '../../engine/tutorialEngine';
import { useGameStore } from '../../state/gameStore';

// Ref + onLayout pair for a spotlightable control. Spread both onto the
// target View: `<View ref={ref} onLayout={onLayout}>`. `measure` also
// self-registers as this id's remeasurer (see tutorialTargets.ts), so any
// ancestor ScrollView calling remeasureAllTargets() on scroll-end keeps this
// rect in sync automatically — callers don't need to reach for `remeasure`
// themselves; it's returned mainly for a one-off manual remeasure need.
//
// `scrollRef` (optional) — the ancestor ScrollView this target lives inside,
// if any. When passed, the target scrolls itself into view the moment it
// becomes the tutorial's currently-active target (i.e. the moment
// `tutorial.stepId` resolves to a step whose `target` is this id), rather
// than leaving the player to discover it by manually scrolling. This closes
// two real bugs: a target that renders only partially visible at first
// layout (e.g. the 2nd item in a stacked list, "half cut off" below the
// fold — TutorialOverlay's existing off-screen bail only fires for a rect
// with ZERO overlap with the viewport, not a partial one, so a half-visible
// target still got the full hard-rail blocking treatment with no way to
// scroll further) and a target nested deep enough in a scrollable panel
// that it never appears in the initial viewport at all (Act II's Invite to
// Dinner button — a genuine unrecoverable softlock before this, see
// TutorialOverlay.tsx's own off-screen-bail comment for that history).
export function useTutorialTarget(
  id: TutorialTargetId | undefined,
  scrollRef?: RefObject<ScrollView | null>,
) {
  const nodeRef = useRef<View | null>(null);

  const measure = useCallback(() => {
    if (!id || !nodeRef.current) return;
    nodeRef.current.measureInWindow((x, y, width, height) => {
      if (width <= 0 || height <= 0) return;
      registerTarget(id, { x, y, width, height });
    });
  }, [id]);

  const ref = useCallback((node: View | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (id) registerRemeasurer(id, measure);
    return () => {
      if (id) {
        clearTarget(id);
        unregisterRemeasurer(id);
      }
    };
  }, [id, measure]);

  const stepId = useGameStore(s => s.tutorial.stepId);
  useEffect(() => {
    if (!id || !scrollRef?.current || !nodeRef.current) return;
    const step = stepId ? getStep(stepId) : null;
    if (step?.target !== id) return;
    const scrollHandle = findNodeHandle(scrollRef.current);
    if (!scrollHandle) return;
    // One frame's grace so the node's own layout pass has actually happened
    // before measureLayout runs (it can otherwise fire against a stale/zero
    // rect on the same tick the step becomes current).
    const raf = requestAnimationFrame(() => {
      if (!nodeRef.current || !scrollRef.current) return;
      // measureLayout gives a position relative to the ScrollView's own
      // content, not the window — unlike measureInWindow above, this is
      // scroll-offset-independent, so it works correctly no matter where
      // the ScrollView currently happens to be scrolled to (same technique
      // LegesView.tsx already uses for its bill deep-link scroll-to).
      // @ts-ignore — measureLayout exists on the native host component ref at runtime.
      nodeRef.current.measureLayout(scrollHandle, (_x: number, y: number, _w: number, height: number) => {
        const { height: screenH } = Dimensions.get('window');
        // Reveal the target's full height with a little margin above the
        // bottom edge. Every real case so far starts below the fold (a
        // stacked list's 2nd+ item, or a button deep inside an expanded
        // panel), so "make sure the bottom is visible" is what matters —
        // scrollTo clamps to content bounds on its own, so this is a no-op
        // if the target's already fully on-screen.
        scrollRef.current?.scrollTo({ y: Math.max(0, y - screenH + height + 24), animated: true });
      }, () => {});
    });
    return () => cancelAnimationFrame(raf);
  }, [id, stepId, scrollRef]);

  return { ref, onLayout: measure, remeasure: measure };
}
