import { useCallback, useEffect, useRef } from 'react';
import type { View } from 'react-native';
import { registerTarget, clearTarget } from '../../engine/tutorialTargets';
import type { TutorialTargetId } from '../../engine/tutorialTargets';

// Ref + onLayout pair for a spotlightable control. Spread both onto the
// target View: `<View ref={ref} onLayout={onLayout}>`. For a target inside a
// ScrollView, also call `remeasure()` on scroll-end — onLayout alone won't
// fire when the view moves without resizing.
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
    return () => {
      if (id) clearTarget(id);
    };
  }, [id]);

  return { ref, onLayout: measure, remeasure: measure };
}
