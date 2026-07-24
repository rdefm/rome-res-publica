// ─── SkillMeter ──────────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md — compact pip meter for the
// mockup's "RHE 6 ▮▮▮▯▯" candidate-header stat row. Built fresh per Finding
// 4 (StatBar's stacked label-row-above-track layout doesn't shrink into this
// footprint) — shares color tokens with StatBar only, no other code reuse.
//
// Chunk C of cursustabuifixesplan.md — three of these side-by-side in
// CandidateHeader's skillsRow overflowed the card (~150px each, ~450px+
// needed vs. ~224px available on a narrow phone). One-for-one pips
// couldn't shrink enough on their own, so pips were regrouped into 5
// two-point "chunks" (user request: each chunk can render half-filled so
// odd values, e.g. 7, still read exactly as 3 full + 1 half + 1 empty
// rather than rounding away the odd point).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import InfoTap from './InfoTap';

interface SkillMeterProps {
  /** 3-char code shown before the pips, e.g. "RHE". */
  label: string;
  value: number;
  max?: number;
  color?: string;
  /** glossaryTerms.ts id to wrap the label in InfoTap. Omit for no glossary link. */
  glossaryTermId?: string;
}

const CHUNK_SIZE = 2;

/** Each chunk covers up to CHUNK_SIZE points; returns how much of that
 *  chunk's own capacity `value` fills, so a chunk can render empty/half/full. */
function chunkFillFractions(value: number, max: number): number[] {
  const chunkCount = Math.ceil(max / CHUNK_SIZE);
  return Array.from({ length: chunkCount }, (_, i) => {
    const chunkStart = i * CHUNK_SIZE;
    const chunkCap = Math.min(CHUNK_SIZE, max - chunkStart);
    const filled = Math.max(0, Math.min(chunkCap, value - chunkStart));
    return filled / chunkCap;
  });
}

export default function SkillMeter({ label, value, max = 10, color = COLORS.gold, glossaryTermId }: SkillMeterProps) {
  const chunks = chunkFillFractions(value, max);

  const content = (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <View style={styles.pipRow}>
        {chunks.map((fraction, i) => (
          <View key={i} style={styles.chunk}>
            {fraction > 0 && (
              <View style={[styles.chunkFill, { backgroundColor: color, width: `${fraction * 100}%` }]} />
            )}
          </View>
        ))}
      </View>
    </View>
  );

  if (glossaryTermId) {
    return <InfoTap termId={glossaryTermId}>{content}</InfoTap>;
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 0.5,
    color: COLORS.dust,
    width: 20,
  },
  value: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
    width: 14,
    textAlign: 'right',
  },
  pipRow: {
    flexDirection: 'row',
    gap: 1,
    marginLeft: SPACING.xs,
  },
  chunk: {
    width: 7,
    height: 7,
    borderRadius: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  chunkFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
});
