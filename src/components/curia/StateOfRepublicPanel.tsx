// Curia Tab Redesign, Chunk C1 — the whole pinned block: TreasuryBar (always
// visible) + CrisisGrid (collapsible). Owns no store subscriptions of its
// own beyond what it passes down — collapse state belongs to CuriaScreen
// (C2), threaded in here, because C2's alert strip needs to sit outside this
// panel but inside the same pinned region.
//
// Post-launch fix — porphyryTile/porphyry/porphyryFrame were registered in
// C0 but never actually wired to this panel's background; the field sat
// plain-transparent the whole time. `porphyryTile` (seamless, resizeMode
// "repeat") is the real background when present, `porphyry` (flat colour)
// is the fallback, `porphyryFrame` frames the whole field either way.
import React from 'react';
import { View, StyleSheet, ImageBackground } from 'react-native';
import { SPACING, porphyry, porphyryFrame } from '../../utils/theme';
import { curiaAssets } from '../../utils/curiaAssets';
import TreasuryBar from './TreasuryBar';
import CrisisGrid from './CrisisGrid';

interface StateOfRepublicPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// §5's budget only closes if the whole panel is ~32pt when collapsed (60pt
// resource bar + 44pt sub-tab strip + 32pt panel = 136pt "fixed chrome,
// grid collapsed" cap) — TreasuryBar's two-line block and CrisisGrid's pip
// row can't stack additively in that mode, so collapsed puts TreasuryBar
// (compact) and CrisisGrid (collapsed) side by side in one row instead of
// stacked. Expanded keeps them stacked, TreasuryBar's full two lines above
// the tile grid.
export default function StateOfRepublicPanel({ collapsed, onToggleCollapse }: StateOfRepublicPanelProps) {
  const tile = curiaAssets.porphyryTile;

  const inner = collapsed ? (
    <View style={[styles.panel, styles.collapsedPanel, styles.collapsedRow]}>
      <TreasuryBar compact />
      <CrisisGrid collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </View>
  ) : (
    <View style={styles.panel}>
      <TreasuryBar />
      <CrisisGrid collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </View>
  );

  if (tile) {
    return (
      <ImageBackground source={tile} resizeMode="repeat" style={[styles.field, { borderColor: porphyryFrame }]}>
        {inner}
      </ImageBackground>
    );
  }

  return (
    <View style={[styles.field, { backgroundColor: porphyry, borderColor: porphyryFrame }]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderBottomWidth: 1,
  },
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
