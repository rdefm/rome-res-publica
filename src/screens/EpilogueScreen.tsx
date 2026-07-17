/**
 * EpilogueScreen — full-screen modal route for the five terminal outcomes.
 * Mounted once at the App root (alongside BattleScreen etc.) — self-gates
 * on runFinished / currentEpilogueRecord, same idiom as the other root
 * modals (see BattleScreen.tsx's header comment).
 *
 * Phase 3, Chunk P3-E. A dark ending is still a TOLD ending (invariant 3 in
 * the plan) — every outcome gets the same scored screen and a coherent
 * historian paragraph, never a bare "Game Over".
 */
import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import { officeName } from '../engine/epilogueEngine';
import type { EpilogueOutcome } from '../models/epilogue';
import HallOfAncestorsScreen from './HallOfAncestorsScreen';
import InfoTap from '../components/shared/InfoTap';

// Phase 5, Chunk P5-E — 'victory'/'gens_ends' tones were hardcoded 'Gens
// Brutia'/'Brutia', found during the gens-neutrality sweep. `{gensName}` is
// filled from the record's own field at render time (same placeholder
// convention as data/epilogueText.ts).
const OUTCOME_BANNER: Record<EpilogueOutcome, { title: string; color: string; tone: string }> = {
  victory:        { title: 'Victory',              color: COLORS.gold,         tone: 'Rome triumphant — and the Gens {gensName} with it.' },
  exhaustion:     { title: 'Peace of Exhaustion',   color: COLORS.dust,         tone: 'Worn down, not broken.' },
  humbled:        { title: 'Rome Humbled',          color: COLORS.crimsonMuted, tone: 'Terms were dictated, not won.' },
  republic_falls: { title: 'The Republic Falls',    color: COLORS.crimson,      tone: 'What Rome was, it is no longer.' },
  gens_ends:      { title: 'The Gens Ends',         color: COLORS.crimsonDark,  tone: 'The name {gensName} falls silent.' },
};

export default function EpilogueScreen() {
  const runFinished = useGameStore(s => s.runFinished);
  const record = useGameStore(s => s.currentEpilogueRecord);
  const returnToStartMenu = useGameStore(s => s.returnToStartMenu);
  const enterEndlessMode = useGameStore(s => s.enterEndlessMode);
  const [showHall, setShowHall] = useState(false);

  const isOpen = runFinished && !!record;
  if (!isOpen) return null;

  if (showHall) {
    return (
      <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen">
        <HallOfAncestorsScreen onBack={() => setShowHall(false)} />
      </Modal>
    );
  }

  const banner = OUTCOME_BANNER[record!.outcome];
  const bannerTone = banner.tone.replace('{gensName}', record!.gensName);

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>

          <View style={[styles.bannerBlock, { borderColor: banner.color }]}>
            <Text style={[styles.bannerTitle, { color: banner.color }]}>{banner.title}</Text>
            <Text style={styles.bannerTone}>{bannerTone}</Text>
            <Text style={styles.bannerYears}>
              {Math.abs(record!.foundedYear)} BC — {Math.abs(record!.endedYear)} BC
            </Text>
          </View>

          <View style={styles.scoreBlock}>
            <ScoreRow
              label="Legacy"
              value={record!.legacyPenaltyApplied ? `${record!.finalLegacy} (halved — cadet branch)` : String(record!.finalLegacy)}
            />
            <ScoreRow
              label="Highest Office"
              value={officeName(record!.highestOffice) ?? 'None held'}
            />
            <ScoreRow
              label="Generations"
              value={record!.generations === 1 ? '1 (the founding generation)' : String(record!.generations)}
            />
          </View>

          <View style={styles.treeBlock}>
            <Text style={styles.sectionLabel}>THE HOUSEHOLD, AT THE END</Text>
            {record!.familyTree.length === 0 ? (
              <Text style={styles.treeEmpty}>No one remained of the direct line.</Text>
            ) : (
              record!.familyTree.map(m => (
                <Text key={m.id} style={styles.treeRow}>
                  {m.name} — {m.role}, {m.age}
                </Text>
              ))
            )}
          </View>

          <View style={styles.beatsBlock}>
            {record!.notableBeats.map((beat, i) => (
              <Text key={i} style={styles.beatRow}>• {beat}</Text>
            ))}
          </View>

          <View style={styles.paragraphBlock}>
            <Text style={styles.sectionLabel}>WHAT THE HISTORIANS WROTE</Text>
            <Text style={styles.paragraphText}>{record!.historianParagraph}</Text>
          </View>

          <View style={styles.actionsBlock}>
            {record!.outcome === 'victory' && (
              <TouchableOpacity style={styles.actionBtn} onPress={enterEndlessMode}>
                <InfoTap termId="endless-mode">
                  <Text style={styles.actionText}>Continue in Endless Mode</Text>
                </InfoTap>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowHall(true)}>
              <Text style={styles.actionText}>To the Hall of Ancestors</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnMuted]} onPress={returnToStartMenu}>
              <Text style={styles.actionTextMuted}>Return to the Start Menu</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
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
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },

  bannerBlock: {
    borderWidth: 2,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.panelSurface,
  },
  bannerTitle: {
    fontFamily: FONTS.display,
    fontSize: 30,
    letterSpacing: 2,
    marginBottom: SPACING.xs,
  },
  bannerTone: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    color: COLORS.marble,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  bannerYears: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.dust,
    letterSpacing: 1,
  },

  scoreBlock: {
    backgroundColor: COLORS.panelSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  scoreLabel: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.dust },
  scoreValue: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.marble, fontWeight: '700' },

  sectionLabel: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    letterSpacing: 3,
    color: COLORS.goldDim,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },

  treeBlock: { marginBottom: SPACING.lg },
  treeEmpty: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 13, color: COLORS.dust },
  treeRow: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.marble, marginBottom: 2 },

  beatsBlock: { marginBottom: SPACING.lg },
  beatRow: { fontFamily: FONTS.bodyRegular, fontSize: 13, color: COLORS.dust, marginBottom: 4 },

  paragraphBlock: { marginBottom: SPACING.xl },
  paragraphText: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.marble,
  },

  actionsBlock: { gap: SPACING.sm },
  actionBtn: {
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  actionBtnMuted: { borderColor: COLORS.border },
  actionText: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.gold, letterSpacing: 1 },
  actionTextMuted: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.dust, letterSpacing: 1 },
});
