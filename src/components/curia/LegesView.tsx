// Curia Tab Redesign, Chunk C3 — bills and active laws, in the shell's
// scroll region (owned by CuriaScreen, threaded in as scrollRef so this
// view can scroll/highlight a deep-linked bill without nesting ScrollViews).
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, findNodeHandle } from 'react-native';
import { COLORS, FONTS, SPACING } from '../../utils/theme';
import { useGameStore } from '../../state/gameStore';
import BillCard from './BillCard';
import LawCard from './LawCard';
import SubmitBillModal from './SubmitBillModal';

interface LegesViewProps {
  scrollRef: React.RefObject<ScrollView>;
}

export default function LegesView({ scrollRef }: LegesViewProps) {
  const bills = useGameStore(s => s.bills);
  const activeLaws = useGameStore(s => s.activeLaws);
  const fides = useGameStore(s => s.fides);
  const curiaBillTargetRequest = useGameStore(s => s.curiaBillTargetRequest);
  const requestCuriaBillTarget = useGameStore(s => s.requestCuriaBillTarget);

  const [submitVisible, setSubmitVisible] = useState(false);
  // §"Layout" — laws grow monotonically across a long game and must never
  // push bills off screen; collapsed-by-default is an intentional change
  // from the pre-redesign default (expanded).
  const [activeLawsExpanded, setActiveLawsExpanded] = useState(false);
  const [highlightedBillId, setHighlightedBillId] = useState<string | null>(null);

  const rowRefs = useRef<Record<string, View | null>>({});

  useEffect(() => {
    if (!curiaBillTargetRequest) return;
    const billId = curiaBillTargetRequest;
    const node = rowRefs.current[billId];
    const scrollHandle = findNodeHandle(scrollRef.current);
    if (node && scrollHandle) {
      // @ts-ignore — measureLayout exists on the native host component ref at runtime.
      node.measureLayout(scrollHandle, (_x: number, y: number) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - SPACING.md), animated: true });
      }, () => {});
    }
    setHighlightedBillId(billId);
    requestCuriaBillTarget(null);
    const timeout = setTimeout(() => setHighlightedBillId(null), 2500);
    return () => clearTimeout(timeout);
  }, [curiaBillTargetRequest]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionLabel}>ROGATIONES · ACTIVE BILLS</Text>
        <TouchableOpacity
          style={[styles.submitBtn, fides < 10 && styles.submitBtnDisabled]}
          onPress={() => setSubmitVisible(true)}
          disabled={fides < 10}
        >
          <Text style={styles.submitBtnLabel}>+ Submit Bill</Text>
          <Text style={styles.submitBtnCost}>−10 🤝</Text>
        </TouchableOpacity>
      </View>

      {bills.length === 0
        ? <Text style={styles.emptyText}>No active bills. Submit one or end the season.</Text>
        : bills.map(bill => (
            <View
              key={bill.id}
              ref={node => { rowRefs.current[bill.id] = node; }}
              style={highlightedBillId === bill.id ? styles.highlighted : undefined}
            >
              <BillCard bill={bill} />
            </View>
          ))
      }

      {(activeLaws ?? []).length > 0 && (
        <View style={styles.activeLawsSection}>
          <TouchableOpacity
            style={styles.headerRow}
            onPress={() => setActiveLawsExpanded(e => !e)}
            activeOpacity={0.75}
          >
            <Text style={styles.sectionLabel}>LEGES IN VIGORE · ACTIVE LAWS ({activeLaws.length})</Text>
            <Text style={styles.chevron}>{activeLawsExpanded ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {activeLawsExpanded && activeLaws.map(law => <LawCard key={law.billId} law={law} />)}
        </View>
      )}

      <SubmitBillModal visible={submitVisible} onClose={() => setSubmitVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: SPACING.md },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  sectionLabel: { color: COLORS.goldDim, fontFamily: FONTS.ui, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.panelElevated, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnLabel: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 13, fontWeight: '600' },
  submitBtnCost: { color: COLORS.fidesColor, fontFamily: FONTS.ui, fontSize: 11 },
  emptyText: { color: COLORS.dust, fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, textAlign: 'center', marginTop: SPACING.lg },
  activeLawsSection: { marginTop: SPACING.md },
  chevron: { color: COLORS.dust, fontSize: 14 },
  highlighted: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: 6,
  },
});
