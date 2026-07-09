/**
 * BattleScreen — full-screen modal route for the set-piece battle system.
 * Mounted once at the App root (alongside EventModal etc.) — self-gates on
 * activeBattleSetup / activeBattle, same idiom as the other root modals.
 *
 * Chunk M5: deployment → round-by-round resolution → break decisions →
 * outcome screen. Chunk M6: the live round view defaults to the animated
 * BattlefieldView; the "Dispatches" toggle reveals M5's original LaneCard
 * grid + text log (the accessibility fallback and debug view).
 */
import React, { useMemo, useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameStore } from '../state/gameStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';
import DeploymentBoard from '../components/battle/DeploymentBoard';
import OrdersPanel from '../components/battle/OrdersPanel';
import LaneCard from '../components/battle/LaneCard';
import BattlefieldView from '../components/battle/BattlefieldView';
import { formatBattleLog } from '../engine/battle/battleEngine';
import { getEligibleFamilyCaptains } from '../engine/battle/musterEngine';
import type { LaneId } from '../models/battle';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const LANE_LABEL: Record<LaneId, string> = { left: 'Left Wing', centre: 'Centre', right: 'Right Wing' };

export default function BattleScreen() {
  const activeBattleSetup = useGameStore(s => s.activeBattleSetup);
  const activeBattle = useGameStore(s => s.activeBattle);
  const family = useGameStore(s => s.family);
  const flags = useGameStore(s => s.flags);
  const commitDeployment = useGameStore(s => s.commitDeployment);
  const cancelDeployment = useGameStore(s => s.cancelDeployment);
  const submitBattleOrders = useGameStore(s => s.submitBattleOrders);
  const submitBattleBreakDecision = useGameStore(s => s.submitBattleBreakDecision);
  const returnFromBattle = useGameStore(s => s.returnFromBattle);

  const captainOptions = useMemo(() => {
    if (!activeBattleSetup) return [];
    return getEligibleFamilyCaptains(family, activeBattleSetup.attackerInput.commanderId ?? '', flags);
  }, [activeBattleSetup, family, flags]);

  const isOpen = !!activeBattleSetup || !!activeBattle;
  if (!isOpen) return null;

  const characterName = (id: string | null): string => {
    if (!id) return 'Unknown';
    return family.find(c => c.id === id)?.name ?? id;
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {activeBattleSetup && !activeBattle && (
          <DeploymentBoard
            attackerInput={activeBattleSetup.attackerInput}
            defenderInput={activeBattleSetup.defenderInput}
            terrain={activeBattleSetup.terrain}
            captainOptions={captainOptions}
            commanderId={activeBattleSetup.attackerInput.commanderId}
            onGiveBattle={commitDeployment}
            onCancel={cancelDeployment}
          />
        )}

        {activeBattle && activeBattle.phase !== 'resolved' && (
          <BattleLive
            battleState={activeBattle}
            characterName={characterName}
            onSubmitOrders={orders => submitBattleOrders(orders, { laneOrders: {} })}
            onBreakDecision={(laneId, decision, targetLane) => submitBattleBreakDecision(laneId, decision, targetLane)}
          />
        )}

        {activeBattle && activeBattle.phase === 'resolved' && activeBattle.outcome && (
          <OutcomeScreen
            outcome={activeBattle.outcome}
            characterName={characterName}
            onReturn={returnFromBattle}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Live battle view (round resolution + break decisions) ──────────────────

function BattleLive({
  battleState, characterName, onSubmitOrders, onBreakDecision,
}: {
  battleState: NonNullable<ReturnType<typeof useGameStore.getState>['activeBattle']>;
  characterName: (id: string | null) => string;
  onSubmitOrders: (orders: Parameters<ReturnType<typeof useGameStore.getState>['submitBattleOrders']>[0]) => void;
  onBreakDecision: (laneId: LaneId, decision: 'pursue' | 'wheel', targetLane?: LaneId) => void;
}) {
  const dispatches = useMemo(() => formatBattleLog(battleState.log), [battleState.log]);
  const [showDispatches, setShowDispatches] = useState(false);

  return (
    <View style={styles.liveRoot}>
      <ScrollView style={styles.laneScroll} contentContainerStyle={styles.laneScrollContent}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ROUND {battleState.round}</Text>
          <TouchableOpacity style={styles.dispatchToggle} onPress={() => setShowDispatches(v => !v)}>
            <Text style={styles.dispatchToggleText}>{showDispatches ? 'Hide Dispatches' : 'Dispatches'}</Text>
          </TouchableOpacity>
        </View>

        {!showDispatches && <BattlefieldView battleState={battleState} />}

        {showDispatches && (
          <>
            <View style={styles.sideRow}>
              {LANES.map(laneId => (
                <LaneCard
                  key={`a-${laneId}`}
                  label={`${LANE_LABEL[laneId]} (yours)`}
                  wing={battleState.attacker.wings[laneId]}
                  captainName={
                    battleState.attacker.commanderStation === laneId
                      ? (battleState.attacker.commanderId ? characterName(battleState.attacker.commanderId) : null)
                      : (battleState.attacker.wings[laneId].captainId ? characterName(battleState.attacker.wings[laneId].captainId) : null)
                  }
                  isCommanderHere={battleState.attacker.commanderStation === laneId}
                />
              ))}
            </View>
            <View style={styles.sideRow}>
              {LANES.map(laneId => (
                <LaneCard
                  key={`d-${laneId}`}
                  label={`${LANE_LABEL[laneId]} (enemy)`}
                  wing={battleState.defender.wings[laneId]}
                />
              ))}
            </View>

            <Text style={styles.dispatchHeader}>DISPATCHES</Text>
            <View style={styles.dispatchBox}>
              <Text style={styles.dispatchText}>{dispatches || '— the armies have not yet engaged —'}</Text>
            </View>
          </>
        )}
      </ScrollView>

      {battleState.phase === 'orders' && (
        <OrdersPanel battleState={battleState} side="attacker" onSubmit={onSubmitOrders} />
      )}

      {battleState.phase === 'break_decision' && battleState.pendingBreakDecisions[0] && (
        <BreakDecisionInterstitial
          laneId={battleState.pendingBreakDecisions[0].laneId}
          brokenSide={battleState.pendingBreakDecisions[0].brokenSide}
          onDecide={onBreakDecision}
        />
      )}
    </View>
  );
}

function BreakDecisionInterstitial({
  laneId, brokenSide, onDecide,
}: {
  laneId: LaneId;
  brokenSide: 'attacker' | 'defender';
  onDecide: (laneId: LaneId, decision: 'pursue' | 'wheel', targetLane?: LaneId) => void;
}) {
  const victorSide = brokenSide === 'attacker' ? 'defender' : 'attacker';
  const isOurs = victorSide === 'attacker';
  const wheelTargets: LaneId[] = laneId === 'centre' ? ['left', 'right'] : ['centre'];

  return (
    <View style={styles.interstitial}>
      <Text style={styles.interstitialTitle}>
        {LANE_LABEL[laneId]} {brokenSide === 'attacker' ? 'YOUR' : "THE ENEMY'S"} WING BREAKS
      </Text>
      {!isOurs ? (
        <Text style={styles.hint}>The enemy commander decides how to press the advantage...</Text>
      ) : (
        <>
          <Text style={styles.hint}>The wing before you has broken. Press the advantage.</Text>
          <View style={styles.interstitialRow}>
            <TouchableOpacity style={styles.decisionBtn} onPress={() => onDecide(laneId, 'pursue')}>
              <Text style={styles.decisionText}>Pursue the Routers</Text>
              <Text style={styles.decisionSub}>Destroy them — at the cost of good order</Text>
            </TouchableOpacity>
            {wheelTargets.map(target => (
              <TouchableOpacity key={target} style={styles.decisionBtn} onPress={() => onDecide(laneId, 'wheel', target)}>
                <Text style={styles.decisionText}>Wheel upon the {LANE_LABEL[target]}</Text>
                <Text style={styles.decisionSub}>Flank-charge the neighbouring fight</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
      {!isOurs && (
        // Enemy break decisions still need to be resolved to advance the
        // battle — the light AI here just always pursues (M7 gives the
        // enemy general real behavior).
        <TouchableOpacity style={styles.decisionBtn} onPress={() => onDecide(laneId, 'pursue')}>
          <Text style={styles.decisionText}>Continue</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Outcome screen ───────────────────────────────────────────────────────────

function OutcomeScreen({
  outcome, characterName, onReturn,
}: {
  outcome: NonNullable<NonNullable<ReturnType<typeof useGameStore.getState>['activeBattle']>['outcome']>;
  characterName: (id: string | null) => string;
  onReturn: () => void;
}) {
  const verdict = outcome.victor === 'withdrawal' ? 'WITHDRAWAL'
    : outcome.victor === 'attacker' ? 'VICTORY' : 'DEFEAT';
  const verdictColor = outcome.victor === 'withdrawal' ? COLORS.dust
    : outcome.victor === 'attacker' ? COLORS.laurel : COLORS.crimson;

  return (
    <ScrollView contentContainerStyle={styles.outcomeRoot}>
      <Text style={[styles.verdict, { color: verdictColor }]}>{verdict}</Text>
      <Text style={styles.verdictTier}>{outcome.tier.toUpperCase()}</Text>

      <View style={styles.outcomeSection}>
        <Text style={styles.sectionLabel}>CASUALTIES</Text>
        <Text style={styles.outcomeLine}>Your army: −{Math.round(outcome.casualties.attacker.strengthLost)}</Text>
        <Text style={styles.outcomeLine}>Enemy: −{Math.round(outcome.casualties.defender.strengthLost)}</Text>
      </View>

      {outcome.captainOutcomes.length > 0 && (
        <View style={styles.outcomeSection}>
          <Text style={styles.sectionLabel}>CAPTAINS</Text>
          {outcome.captainOutcomes.map((co, i) => (
            <Text key={i} style={styles.outcomeLine}>
              {characterName(co.characterId)} — {co.result.toUpperCase()}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.outcomeSection}>
        <Text style={styles.sectionLabel}>WAR SCORE</Text>
        <Text style={styles.outcomeLine}>{outcome.warScoreDelta >= 0 ? '+' : ''}{outcome.warScoreDelta}</Text>
      </View>

      <TouchableOpacity style={styles.returnBtn} onPress={onReturn}>
        <Text style={styles.returnText}>Return to Rome</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  liveRoot: { flex: 1 },
  laneScroll: { flex: 1 },
  laneScrollContent: { padding: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.gold },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  dispatchToggle: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.sm, backgroundColor: COLORS.panelElevated },
  dispatchToggleText: { fontFamily: FONTS.ui, fontSize: 10, color: COLORS.dust, letterSpacing: 0.5 },
  sideRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  dispatchHeader: { fontFamily: FONTS.ui, fontSize: 10, color: COLORS.dust, letterSpacing: 1, marginTop: SPACING.md },
  dispatchBox: {
    backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.xs,
  },
  dispatchText: { fontFamily: 'monospace', fontSize: 10, color: COLORS.marble, lineHeight: 15 },
  interstitial: { backgroundColor: COLORS.panelSurface, borderTopWidth: 1, borderTopColor: COLORS.crimson, padding: SPACING.md },
  interstitialTitle: { fontFamily: FONTS.display, fontSize: 13, color: COLORS.crimson, marginBottom: SPACING.xs },
  interstitialRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  hint: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 11, color: COLORS.dust },
  decisionBtn: { flex: 1, backgroundColor: COLORS.panelElevated, borderRadius: RADIUS.md, padding: SPACING.sm, alignItems: 'center' },
  decisionText: { fontFamily: FONTS.display, fontSize: 11, color: COLORS.gold },
  decisionSub: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 9, color: COLORS.dust, marginTop: 2, textAlign: 'center' },
  outcomeRoot: { padding: SPACING.lg, alignItems: 'center' },
  verdict: { fontFamily: FONTS.display, fontSize: 28, letterSpacing: 2, marginTop: SPACING.xl },
  verdictTier: { fontFamily: FONTS.ui, fontSize: 12, color: COLORS.dust, letterSpacing: 2, marginBottom: SPACING.lg },
  outcomeSection: { width: '100%', marginBottom: SPACING.md },
  sectionLabel: { fontFamily: FONTS.ui, fontSize: 10, color: COLORS.dust, letterSpacing: 1, marginBottom: 4 },
  outcomeLine: { fontFamily: FONTS.ui, fontSize: 13, color: COLORS.marble },
  returnBtn: { marginTop: SPACING.lg, backgroundColor: COLORS.gold, borderRadius: RADIUS.md, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl },
  returnText: { fontFamily: FONTS.display, fontSize: 14, color: COLORS.bg, letterSpacing: 1 },
});
