/**
 * SetPieceOfferModal — Military Overhaul M9. A global, blocking modal
 * (mounted at App.tsx root, same pattern as EventModal/BattleScreen) shown
 * whenever any active war has a pendingSetPiece. Give Battle stages
 * activeBattleSetup via gameStore.acceptSetPieceOffer and this modal closes
 * itself (self-gated on war.pendingSetPiece) as BattleScreen takes over;
 * Decline applies the warScore/lifetimeDignitas penalty.
 *
 * No neutral "dismiss" — matches the break-decision interstitial precedent
 * in BattleScreen.tsx (a real decision, not a notice).
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../../state/gameStore';
import { ENEMY_GENERALS } from '../../data/enemyGenerals';
import { BALANCE } from '../../data/balance';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';

export default function SetPieceOfferModal() {
  const wars = useGameStore(s => s.wars);
  const acceptSetPieceOffer = useGameStore(s => s.acceptSetPieceOffer);
  const declineSetPieceOffer = useGameStore(s => s.declineSetPieceOffer);
  const activeBattle = useGameStore(s => s.activeBattle);
  const activeBattleSetup = useGameStore(s => s.activeBattleSetup);

  const war = wars.find(w => w.active && w.pendingSetPiece);
  // Never stack on top of an in-progress battle (e.g. the sandbox one).
  const battleInProgress = !!activeBattle || !!activeBattleSetup;
  if (!war || !war.pendingSetPiece || battleInProgress) return null;

  const offer = war.pendingSetPiece;
  const terrain = BALANCE.battle.terrains[offer.terrainId];
  const general = ENEMY_GENERALS[offer.enemyGeneralId];

  return (
    <Modal visible transparent animationType="fade">
      <SafeAreaView style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>THE ARMIES WILL MEET</Text>
          <Text style={styles.site}>at {offer.siteName}</Text>
          <Text style={styles.terrain}>{terrain?.label ?? offer.terrainId}</Text>

          {general && (
            <>
              <Text style={styles.generalName}>{general.name} {general.epithet}</Text>
              <Text style={styles.flavour}>"{general.flavour.preBattle}"</Text>
            </>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => declineSetPieceOffer(war.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.declineText}>Decline</Text>
              <Text style={styles.declineSub}>
                {BALANCE.war.setPieceOffer.declineWarScorePenalty} war score, {BALANCE.war.setPieceOffer.declineLifetimeDignitasPenalty} dignitas
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.battleBtn}
              onPress={() => acceptSetPieceOffer(war.id)}
              activeOpacity={0.75}
            >
              <Text style={styles.battleText}>Give Battle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.panelSurface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.crimson,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.crimson,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  site: {
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.gold,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  terrain: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    color: COLORS.dust,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  generalName: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.marble,
    marginTop: SPACING.md,
  },
  flavour: {
    fontFamily: FONTS.body,
    fontStyle: 'italic',
    fontSize: 12,
    color: COLORS.dust,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    width: '100%',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: COLORS.panelElevated,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
  },
  declineText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.dust,
  },
  declineSub: {
    fontFamily: FONTS.ui,
    fontSize: 9,
    color: COLORS.dust,
    marginTop: 2,
    textAlign: 'center',
  },
  battleBtn: {
    flex: 1,
    backgroundColor: COLORS.crimson,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  battleText: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.marble,
    letterSpacing: 0.5,
  },
});
