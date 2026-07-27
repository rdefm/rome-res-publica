// Curia Tab Redesign, Chunk C1 — always-visible treasury + top-crisis
// summary line, even when CrisisGrid is collapsed (Finding 1, Delta 8).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import { calcRomeStatModifiers } from '../../engine/resourceEngine';
import InfoTap from '../shared/InfoTap';
import { CRISIS_TIER_LABELS } from './CrisisTile';
import type { CrisisTrackId } from '../../models/crisis';

const TRACK_ORDER: CrisisTrackId[] = ['war', 'unrest', 'constitution', 'economy'];

interface AerariumBarProps {
  /** §5's budget only balances if the whole pinned panel is ~32pt when the
   *  grid collapses — that leaves no room for a second line. `compact` drops
   *  the "Republic: …" sentence and renders line 1 alone, single-line,
   *  sized to sit inline next to CrisisGrid's collapsed pip row (this prop
   *  isn't in the plan's illustrative contract snippet; added to satisfy
   *  the hard height cap in §5 — flagged in the chunk summary). */
  compact?: boolean;
}

export default function AerariumBar({ compact = false }: AerariumBarProps) {
  const rome = useGameStore(s => s.rome);
  const crisis = useGameStore(s => s.crisis);

  const treasuryLabel = calcRomeStatModifiers(rome).treasuryLabel;

  // Highest-tier track wins the second line; TRACK_ORDER breaks ties.
  const topTrackId = TRACK_ORDER.reduce((best, id) =>
    crisis[id].tier > crisis[best].tier ? id : best
  , TRACK_ORDER[0]);
  const topTier = crisis[topTrackId].tier;

  const republicLine = topTier === 0
    ? 'The Republic is at peace with itself.'
    : `The Republic: ${CRISIS_TIER_LABELS[topTrackId][topTier].toLowerCase()}.`;

  if (compact) {
    return (
      <InfoTap termId="aerarium" style={styles.compactWrapper}>
        <Text style={styles.line1} numberOfLines={1}>
          AERARIUM: {treasuryLabel} · {Math.round(rome.treasury)}/100
        </Text>
      </InfoTap>
    );
  }

  return (
    <InfoTap termId="aerarium" style={styles.wrapper}>
      <View>
        <Text style={styles.line1}>
          AERARIUM: {treasuryLabel} · {Math.round(rome.treasury)}/100
        </Text>
        <Text style={styles.line2}>{republicLine}</Text>
      </View>
    </InfoTap>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-start',
  },
  compactWrapper: {
    alignItems: 'center',
  },
  line1: {
    color: COLORS.marble,
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  line2: {
    color: COLORS.dust,
    fontFamily: FONTS.body,
    fontSize: 11,
    marginTop: 2,
  },
});
