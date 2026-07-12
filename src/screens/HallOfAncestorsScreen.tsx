/**
 * HallOfAncestorsScreen — Phase 3, Chunk P3-E. A trophy shelf of past runs
 * (invariant 7: no mechanical carry-over). Reused in two contexts: inline
 * from EpilogueScreen (post-game, wrapped in that screen's own Modal) and
 * standalone from StartMenuScreen (pre-game) — hence the generic `onBack`
 * prop rather than assuming either caller's navigation shape.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadHall } from '../state/ancestorStore';
import { officeName } from '../engine/epilogueEngine';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import type { AncestorRecord, EpilogueOutcome } from '../models/epilogue';

const OUTCOME_LABEL: Record<EpilogueOutcome, string> = {
  victory: 'Victory',
  exhaustion: 'Peace of Exhaustion',
  humbled: 'Rome Humbled',
  republic_falls: 'The Republic Falls',
  gens_ends: 'The Gens Ends',
};

const OUTCOME_COLOR: Record<EpilogueOutcome, string> = {
  victory: COLORS.gold,
  exhaustion: COLORS.dust,
  humbled: COLORS.crimsonMuted,
  republic_falls: COLORS.crimson,
  gens_ends: COLORS.crimsonDark,
};

export default function HallOfAncestorsScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<AncestorRecord[] | null>(null);
  const [selected, setSelected] = useState<AncestorRecord | null>(null);

  useEffect(() => {
    loadHall().then(setRecords);
  }, []);

  if (selected) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backRow}>
            <Text style={styles.backText}>‹ Back to the Hall</Text>
          </TouchableOpacity>

          <Text style={[styles.detailOutcome, { color: OUTCOME_COLOR[selected.outcome] }]}>
            {OUTCOME_LABEL[selected.outcome]}
          </Text>
          <Text style={styles.detailYears}>
            {Math.abs(selected.foundedYear)} BC — {Math.abs(selected.endedYear)} BC
          </Text>

          <View style={styles.scoreBlock}>
            <ScoreRow label="Legacy" value={selected.legacyPenaltyApplied ? `${selected.finalLegacy} (halved)` : String(selected.finalLegacy)} />
            <ScoreRow label="Highest Office" value={officeName(selected.highestOffice) ?? 'None held'} />
            <ScoreRow label="Generations" value={String(selected.generations)} />
          </View>

          <View style={styles.treeBlock}>
            <Text style={styles.sectionLabel}>THE HOUSEHOLD, AT THE END</Text>
            {selected.familyTree.length === 0 ? (
              <Text style={styles.treeEmpty}>No one remained of the direct line.</Text>
            ) : (
              selected.familyTree.map(m => (
                <Text key={m.id} style={styles.treeRow}>{m.name} — {m.role}, {m.age}</Text>
              ))
            )}
          </View>

          <Text style={styles.paragraphText}>{selected.historianParagraph}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>THE HALL OF ANCESTORS</Text>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>Close ×</Text>
        </TouchableOpacity>
      </View>

      {records === null ? (
        <ActivityIndicator color={COLORS.gold} style={{ marginTop: SPACING.xl }} />
      ) : records.length === 0 ? (
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyText}>No runs have ended yet. History is still being written.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listScroll}>
          {records.map(r => (
            <TouchableOpacity key={r.id} style={styles.card} onPress={() => setSelected(r)} activeOpacity={0.8}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardGens}>Gens {r.gensName}</Text>
                <Text style={[styles.cardOutcome, { color: OUTCOME_COLOR[r.outcome] }]}>
                  {OUTCOME_LABEL[r.outcome]}
                </Text>
              </View>
              <Text style={styles.cardYears}>
                {Math.abs(r.foundedYear)} BC — {Math.abs(r.endedYear)} BC · Legacy {r.finalLegacy}
              </Text>
              <Text style={styles.cardExcerpt} numberOfLines={2}>{r.historianParagraph}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={styles.scoreValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.gold, letterSpacing: 2 },
  backText: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.dust },
  backRow: { marginBottom: SPACING.md },

  emptyBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  emptyText: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 14, color: COLORS.dust, textAlign: 'center' },

  listScroll: { padding: SPACING.lg, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.panelSurface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardGens: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.marble },
  cardOutcome: { fontFamily: FONTS.ui, fontSize: 12, letterSpacing: 0.5 },
  cardYears: { fontFamily: FONTS.ui, fontSize: 11, color: COLORS.dust, marginBottom: 6 },
  cardExcerpt: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 12, color: COLORS.dust, lineHeight: 17 },

  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  detailOutcome: { fontFamily: FONTS.display, fontSize: 24, letterSpacing: 1, marginBottom: 4 },
  detailYears: { fontFamily: FONTS.ui, fontSize: 12, color: COLORS.dust, marginBottom: SPACING.lg },

  scoreBlock: {
    backgroundColor: COLORS.panelSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  scoreLabel: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.dust },
  scoreValue: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.marble, fontWeight: '700' },

  sectionLabel: {
    fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 3, color: COLORS.goldDim,
    textTransform: 'uppercase', marginBottom: SPACING.sm,
  },
  treeBlock: { marginBottom: SPACING.lg },
  treeEmpty: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, color: COLORS.dust },
  treeRow: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.marble, marginBottom: 2 },

  paragraphText: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 14, lineHeight: 21, color: COLORS.marble },
});
