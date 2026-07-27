// Curia Tab Redesign, Chunk C3, Delta 5 — three wax-seal verdict states,
// reusing cursusAssets.waxSeal (Finding 7 — no separate Curia seal asset).
// Verdict derivation is copied verbatim from the pre-redesign BillCard
// (CuriaScreen.tsx:363-364) — do not re-derive the thresholds elsewhere.
import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { sealPass, sealClose, sealFail } from '../../utils/theme';
import { cursusAssets } from '../../utils/cursusAssets';

export type BillVerdict = 'pass' | 'close' | 'fail';

export function getBillVerdict(effectiveSupport: number): BillVerdict {
  if (effectiveSupport > 0) return 'pass';
  if (effectiveSupport < -20) return 'fail';
  return 'close';
}

const VERDICT_COLOR: Record<BillVerdict, string> = {
  pass: sealPass,
  close: sealClose,
  fail: sealFail,
};

const SEAL_SIZE = 32;

export default function WaxVerdictSeal({ effectiveSupport }: { effectiveSupport: number }) {
  const verdict = getBillVerdict(effectiveSupport);
  const color = VERDICT_COLOR[verdict];

  if (cursusAssets.waxSeal) {
    return <Image source={cursusAssets.waxSeal} style={[styles.image, { tintColor: color }]} resizeMode="contain" />;
  }

  return (
    <View style={[styles.fallbackOuter, { borderColor: color }]}>
      <View style={[styles.fallbackInner, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
  },
  fallbackOuter: {
    width: SEAL_SIZE,
    height: SEAL_SIZE,
    borderRadius: SEAL_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackInner: {
    width: SEAL_SIZE - 14,
    height: SEAL_SIZE - 14,
    borderRadius: (SEAL_SIZE - 14) / 2,
  },
});
