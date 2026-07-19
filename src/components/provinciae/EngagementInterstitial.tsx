/**
 * EngagementInterstitial — Campaign Map plan, Chunks C7 (built the single
 * "Trust the Legate" button) and C8 (adds "Take the Field").
 *
 * Full-screen native Modal (same self-gating idiom as BattleScreen/
 * TrialSessionModal, mounted once at the App root), self-gated on
 * pendingEngagements[0]. Two choices for the Rome-side army (whichever of
 * the engagement's two armies isn't Carthage-owned — see
 * campaignResolver.ts's header comment on why that's always the shape):
 * "Take the Field" (a real tactical battle, M5's DeploymentBoard/
 * BattleScreen pipeline) or "Trust the Legate" (the abstract resolver,
 * one tap) — hidden when the Rome-side army is leaderless, since there's no
 * legate to trust in the first place (takeTheFieldForEngagement auto-
 * assigns the paterfamilias on the spot instead, so that path always works).
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { REGIONS } from '../../data/theatreMap';
import { BALANCE } from '../../data/balance';
import { armyStrength } from '../../engine/armyEngine';
import { profileForCarthageArmy } from '../../engine/campaignAi';
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
  const family = useGameStore(s => s.family);
  const resolveEngagementAbstract = useGameStore(s => s.resolveEngagementAbstract);
  const takeTheFieldForEngagement = useGameStore(s => s.takeTheFieldForEngagement);

  if (!engagement) return null;

  const region = REGIONS.find(r => r.id === engagement.regionId);
  const attacker = armies.find(a => a.id === engagement.attackerArmyId);
  const defender = armies.find(a => a.id === engagement.defenderArmyId);
  if (!attacker || !defender) return null;

  const romeArmy = attacker.owner !== 'carthage' ? attacker : defender;
  const enemyArmy = attacker.owner !== 'carthage' ? defender : attacker;
  const romeCommanderName = romeArmy.commanderId ? family.find(c => c.id === romeArmy.commanderId)?.name ?? null : null;
  const enemyGeneral = profileForCarthageArmy(enemyArmy);
  const terrain = region ? (BALANCE.battle.terrains[region.terrainId] ?? BALANCE.battle.terrains.open_plain) : BALANCE.battle.terrains.open_plain;

  const romePower = armyStrength(romeArmy);
  const enemyPower = armyStrength(enemyArmy);
  const advantageLabel = romePower > enemyPower * 1.15 ? 'Advantage: You'
    : enemyPower > romePower * 1.15 ? 'Advantage: The Enemy'
    : 'Evenly Matched';
  const advantageStyle = romePower > enemyPower * 1.15 ? styles.advantageGood
    : enemyPower > romePower * 1.15 ? styles.advantageBad
    : styles.advantageEven;

  const canDelegate = !!romeArmy.commanderId;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Text style={styles.eyebrow}>ENGAGEMENT</Text>
          <Text style={styles.title}>{region?.name ?? engagement.regionId}</Text>
          <Text style={styles.terrain}>{terrain.label}</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>YOUR ARMY</Text>
            <Text style={styles.cardValue}>{romeArmy.name}</Text>
            <Text style={styles.cardSub}>
              {romeCommanderName ? `Commanded by ${romeCommanderName}` : 'No commander assigned'}
              {' · '}{OWNER_LABELS[romeArmy.owner] ?? romeArmy.owner}
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>ENEMY ARMY</Text>
            <Text style={styles.cardValue}>{enemyArmy.name}</Text>
            <Text style={styles.cardSub}>{enemyGeneral.name} {enemyGeneral.epithet}</Text>
          </View>

          <Text style={[styles.advantage, advantageStyle]}>{advantageLabel}</Text>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.8}
            onPress={() => takeTheFieldForEngagement(engagement.id)}
          >
            <Text style={styles.buttonText}>Take the Field</Text>
          </TouchableOpacity>

          {canDelegate && (
            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.8}
              onPress={() => resolveEngagementAbstract(engagement.id)}
            >
              <Text style={styles.secondaryButtonText}>Trust the Legate</Text>
            </TouchableOpacity>
          )}

          {!canDelegate && (
            <Text style={styles.note}>
              No commander leads this army — whoever takes the field will have to be named first.
            </Text>
          )}
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
  },
  terrain: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
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
  advantage: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: SPACING.md,
    letterSpacing: 0.5,
  },
  advantageGood: { color: COLORS.laurel },
  advantageBad: { color: COLORS.crimson },
  advantageEven: { color: COLORS.dust },
  note: {
    color: COLORS.dust,
    fontFamily: FONTS.ui,
    fontSize: 11,
    textAlign: 'center',
    marginTop: SPACING.md,
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
  secondaryButton: {
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.marble,
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
