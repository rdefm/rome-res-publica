// Curia Tab Redesign, Chunk C1 — the four crisis tracks, pinned. Owns the
// one `crisis` subscription for all four tiles (not four separate
// subscriptions — see CrisisTileProps' `track` contract) and the existing
// CrisisTrackModal's open/close state.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import CrisisTrackModal from '../shared/CrisisTrackModal';
import CrisisTile from './CrisisTile';
import type { CrisisTrackId } from '../../models/crisis';
import { useTutorialTarget } from '../shared/useTutorialTarget';

const TRACK_ORDER: CrisisTrackId[] = ['war', 'unrest', 'constitution', 'economy'];

interface CrisisGridProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function CrisisGrid({ collapsed, onToggleCollapse }: CrisisGridProps) {
  const crisis = useGameStore(s => s.crisis);
  const [modalTrack, setModalTrack] = useState<CrisisTrackId | null>(null);
  // Tutorial redesign, T5 — the War track is the only spotlight target;
  // re-threaded here from the old CrisisTrackCell in CuriaScreen.tsx.
  const warTutorialTarget = useTutorialTarget('curia.crisis-track.war');

  return (
    <View>
      {collapsed ? (
        <TouchableOpacity onPress={onToggleCollapse} activeOpacity={0.8} style={styles.collapsedRow}>
          {TRACK_ORDER.map(id => (
            <TouchableOpacity
              key={id}
              onPress={() => setModalTrack(id)}
              style={styles.pipWrap}
              ref={id === 'war' ? warTutorialTarget.ref : undefined}
              onLayout={id === 'war' ? warTutorialTarget.onLayout : undefined}
            >
              <View style={[styles.pip, { backgroundColor: pipColor(crisis[id].tier) }]} />
              <Text style={styles.pipNumber}>{Math.round(crisis[id].level)}</Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      ) : (
        // No tap-to-collapse gesture here (Delta 8: collapsing the expanded
        // grid is the pinned header's chevron's job, wired in C2 — this row
        // is all per-tile tap targets, and a wrapping touchable would fight
        // them for the gesture). The collapsed row above IS its own
        // tap-to-expand target, matching the common "compact summary row
        // expands on tap" pattern.
        <View style={styles.expandedRow}>
          {TRACK_ORDER.map(id => (
            <View
              key={id}
              ref={id === 'war' ? warTutorialTarget.ref : undefined}
              onLayout={id === 'war' ? warTutorialTarget.onLayout : undefined}
              style={{ flex: 1 }}
            >
              <CrisisTile trackId={id} track={crisis[id]} onPress={() => setModalTrack(id)} />
            </View>
          ))}
        </View>
      )}
      {modalTrack && (
        <CrisisTrackModal
          trackId={modalTrack}
          track={crisis[modalTrack]}
          crisisState={crisis}
          visible={modalTrack !== null}
          onClose={() => setModalTrack(null)}
        />
      )}
    </View>
  );
}

// Same 5-step ramp as CRISIS_TIER_VISUAL's border colours, kept local since
// the collapsed pip is a plain dot, not a full tile.
function pipColor(tier: 0 | 1 | 2 | 3 | 4): string {
  switch (tier) {
    case 0: return COLORS.border;
    case 1: return COLORS.goldDim;
    case 2: return COLORS.amber;
    case 3: return COLORS.crimsonMuted;
    default: return COLORS.crimson;
  }
}

const styles = StyleSheet.create({
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: SPACING.md,
  },
  pipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pipNumber: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
  expandedRow: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
  },
});
