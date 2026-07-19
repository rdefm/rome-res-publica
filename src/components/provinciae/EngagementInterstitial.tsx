/**
 * EngagementInterstitial — Campaign Map plan, Chunk C7.
 *
 * TEMPORARY, single-button version — see campaignResolver.ts's header
 * comment. C8 (the real tactical battle bridge) doesn't exist yet, but C5
 * already ships player attack orders, so a real pendingEngagements-non-empty
 * state is reachable today. Rather than leave it genuinely stuck until a
 * future chunk, this full-screen native Modal (same self-gating idiom as
 * BattleScreen/TrialSessionModal, mounted once at the App root) offers the
 * one resolution path that exists this chunk: "Trust the legate," which
 * calls the same abstract-battle stub NPC-vs-NPC fights already resolve
 * through. C8 adds a second "Take the field" tactical option alongside this
 * button; it does not need to change this component's shape.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { REGIONS } from '../../data/theatreMap';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

const OWNER_LABELS: Record<string, string> = {
  player: 'Your army',
  rome_state: "Rome's army",
  rome_rival: 'A rival general\'s army',
  carthage: 'A Carthaginian army',
};

export default function EngagementInterstitial() {
  const engagement = useGameStore(s => s.pendingEngagements[0]);
  const armies = useGameStore(s => s.armies);
  const resolveEngagementAbstract = useGameStore(s => s.resolveEngagementAbstract);

  if (!engagement) return null;

  const region = REGIONS.find(r => r.id === engagement.regionId);
  const attacker = armies.find(a => a.id === engagement.attackerArmyId);
  const defender = armies.find(a => a.id === engagement.defenderArmyId);

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>ENGAGEMENT</Text>
          <Text style={styles.title}>{region?.name ?? engagement.regionId}</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>ATTACKER</Text>
            <Text style={styles.cardValue}>{attacker?.name ?? 'Unknown army'}</Text>
            <Text style={styles.cardSub}>{attacker ? (OWNER_LABELS[attacker.owner] ?? attacker.owner) : ''}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>DEFENDER</Text>
            <Text style={styles.cardValue}>{defender?.name ?? 'Unknown army'}</Text>
            <Text style={styles.cardSub}>{defender ? (OWNER_LABELS[defender.owner] ?? defender.owner) : ''}</Text>
          </View>

          <Text style={styles.note}>
            No commander of yours can take the field yet — a future dispatch will bring that
            choice. For now, trust the legate to give the day's account.
          </Text>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => resolveEngagementAbstract(engagement.id)}
          >
            <Text style={styles.buttonText}>Trust the Legate</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  content: { flex: 1, padding: SPACING.lg, justifyContent: 'center' },
  eyebrow: {
    color: COLORS.crimson,
    fontFamily: FONTS.ui,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
  },
  title: {
    color: COLORS.gold,
    fontFamily: FONTS.display,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: '#1a1714',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardLabel: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 10, letterSpacing: 1 },
  cardValue: { color: COLORS.marble, fontFamily: FONTS.display, fontSize: 16, fontWeight: '700', marginTop: 2 },
  cardSub: { color: COLORS.dust, fontFamily: FONTS.ui, fontSize: 11, marginTop: 2 },
  note: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textAlign: 'center',
    marginVertical: SPACING.lg,
    lineHeight: 16,
  },
  button: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1410',
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
