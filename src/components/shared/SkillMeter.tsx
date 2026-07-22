// ─── SkillMeter ──────────────────────────────────────────────────────────────
// Chunk C1 of cursus-visual-redesign-plan.md — compact pip meter for the
// mockup's "RHE 6 ▮▮▮▯▯" candidate-header stat row. Built fresh per Finding
// 4 (StatBar's stacked label-row-above-track layout doesn't shrink into this
// footprint) — shares color tokens with StatBar only, no other code reuse.

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

export default function SkillMeter({ label, value, max = 10, color = COLORS.gold, glossaryTermId }: SkillMeterProps) {
  const pips = Array.from({ length: max }, (_, i) => i < value);

  const content = (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <View style={styles.pipRow}>
        {pips.map((filled, i) => (
          <View
            key={i}
            style={[styles.pip, filled ? { backgroundColor: color } : styles.pipEmpty]}
          />
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
    width: 26,
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
    gap: 2,
    marginLeft: SPACING.xs,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  pipEmpty: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
});
