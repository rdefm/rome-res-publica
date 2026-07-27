// Curia Tab Redesign, Chunk C1 — the whole pinned block: AerariumBar (always
// visible) + CrisisGrid (collapsible). Owns no store subscriptions of its
// own beyond what it passes down — collapse state belongs to CuriaScreen
// (C2), threaded in here, because C2's alert strip needs to sit outside this
// panel but inside the same pinned region.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SPACING } from '../../utils/theme';
import AerariumBar from './AerariumBar';
import CrisisGrid from './CrisisGrid';

interface StateOfRepublicPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// §5's budget only closes if the whole panel is ~32pt when collapsed (60pt
// resource bar + 44pt sub-tab strip + 32pt panel = 136pt "fixed chrome,
// grid collapsed" cap) — AerariumBar's two-line block and CrisisGrid's pip
// row can't stack additively in that mode, so collapsed puts AerariumBar
// (compact) and CrisisGrid (collapsed) side by side in one row instead of
// stacked. Expanded keeps them stacked, AerariumBar's full two lines above
// the tile grid.
export default function StateOfRepublicPanel({ collapsed, onToggleCollapse }: StateOfRepublicPanelProps) {
  if (collapsed) {
    return (
      <View style={[styles.panel, styles.collapsedPanel, styles.collapsedRow]}>
        <AerariumBar compact />
        <CrisisGrid collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <AerariumBar />
      <CrisisGrid collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  collapsedPanel: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
});
