/**
 * EndlessDisbandModal — Campaign Map plan, Chunk C9. Shown from
 * EpilogueScreen when the player presses "Continue in Endless Mode" on a
 * Victory record AND at least one personal (player-owned) theatre Army
 * still exists. Lets the player choose retain vs disband per army before
 * gameStore.enterEndlessMode actually stands the Punic theatre down
 * (state-owned armies always stand down honorably; enemy armies are simply
 * gone — neither needs a decision here).
 *
 * Not mounted at App.tsx root like the other global modals (BattleScreen,
 * SetPieceOfferModal) — this is a one-time, EpilogueScreen-local interstitial,
 * same idiom as that screen's own HallOfAncestorsScreen toggle.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Army } from '../../models/army';
import type { Character } from '../../models/character';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

type Decision = 'retain' | 'disband';

interface EndlessDisbandModalProps {
  armies: Army[]; // player-owned theatre armies only
  family: Character[];
  onConfirm: (decisions: Record<string, Decision>) => void;
}

export default function EndlessDisbandModal({ armies, family, onConfirm }: EndlessDisbandModalProps) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(
    () => Object.fromEntries(armies.map(a => [a.id, 'retain' as Decision])),
  );

  const setDecision = (armyId: string, decision: Decision) =>
    setDecisions(prev => ({ ...prev, [armyId]: decision }));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>STANDING DOWN THE ARMIES</Text>
        <Text style={styles.subtitle}>
          Sicily is secure. Choose what becomes of the legions you raised yourself — retain them
          in your commander's service, or release them to go home.
        </Text>

        {armies.map(army => {
          const commander = army.commanderId ? family.find(c => c.id === army.commanderId) : undefined;
          const totalStrength = army.units.reduce((sum, u) => sum + u.strength, 0);
          const decision = decisions[army.id] ?? 'retain';
          return (
            <View key={army.id} style={styles.armyCard}>
              <Text style={styles.armyName}>{army.name}</Text>
              <Text style={styles.armyMeta}>
                {commander ? commander.name : 'No commander'} — {army.units.length} unit{army.units.length === 1 ? '' : 's'}, {totalStrength}% total strength
              </Text>
              <View style={styles.choiceRow}>
                <TouchableOpacity
                  style={[styles.choiceBtn, decision === 'retain' && styles.choiceBtnActive]}
                  onPress={() => setDecision(army.id, 'retain')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.choiceText, decision === 'retain' && styles.choiceTextActive]}>Retain</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.choiceBtn, decision === 'disband' && styles.choiceBtnActive]}
                  onPress={() => setDecision(army.id, 'disband')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.choiceText, decision === 'disband' && styles.choiceTextActive]}>Disband</Text>
                </TouchableOpacity>
              </View>
              {!commander && decision === 'retain' && (
                <Text style={styles.warnText}>No commander to retain these troops — they'll disperse regardless.</Text>
              )}
            </View>
          );
        })}

        <TouchableOpacity style={styles.confirmBtn} onPress={() => onConfirm(decisions)} activeOpacity={0.8}>
          <Text style={styles.confirmText}>Confirm & Continue in Endless Mode</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: SPACING.lg,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.gold,
    letterSpacing: 1,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.dust,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  armyCard: {
    backgroundColor: COLORS.panelSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.panelElevated,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  armyName: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.marble,
  },
  armyMeta: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    marginTop: 2,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
    alignItems: 'center',
  },
  choiceBtnActive: {
    backgroundColor: COLORS.gold,
  },
  choiceText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    color: COLORS.dust,
  },
  choiceTextActive: {
    color: COLORS.bg,
  },
  warnText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    color: COLORS.crimsonMuted,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  confirmBtn: {
    backgroundColor: COLORS.crimson,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  confirmText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
    letterSpacing: 0.5,
  },
});
