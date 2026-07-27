import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import {
  registerTarget, clearTarget, registerRemeasurer, unregisterRemeasurer,
} from '../../engine/tutorialTargets';
import type { TutorialTargetId } from '../../engine/tutorialTargets';

// Ref + onLayout pair for a spotlightable control. Spread both onto the
// target View: `<View ref={ref} onLayout={onLayout}>`. `measure` also
// self-registers as this id's remeasurer (see tutorialTargets.ts), so any
// ancestor ScrollView calling remeasureAllTargets() on scroll-end keeps this
// rect in sync automatically — callers don't need to reach for `remeasure`
// themselves; it's returned mainly for a one-off manual remeasure need.
export function useTutorialTarget(id: TutorialTargetId | undefined) {
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

  return { ref, onLayout: measure, remeasure: measure };
}
