/**
 * BattlefieldView — Chunk M6. Replaces M5's static LaneCard grid as the
 * default round-resolution view: a stylised top-down field where each lane
 * is a horizontal "tug of war" — your strength pushes in from the left,
 * the enemy's from the right, meeting at a push-front marker that shifts
 * with round advantage. See animations.ts's header comment for the
 * animation design (parallel per-lane pushes + one-shot effects, not a
 * full serial multi-beat choreography — a deliberate scope-guard cut).
 *
 * Tap anywhere to skip straight to the round's end state (non-negotiable
 * per the plan — the burst player). M5's LaneCard grid + text dispatches
 * are still reachable via BattleScreen's "Dispatches" toggle (the
 * accessibility fallback and debug view).
 *
 * Known scope limit: `ownIsAttacker` is currently always true — the
 * sandbox (M5/M11) always musters Rome as the attacker. A defending-Rome
 * scenario needs this threaded through once a real campaign can trigger one
 * (M9), same limitation already noted in gameStore.ts's returnFromBattle.
 */
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, cancelAnimation } from 'react-native-reanimated';
import { COLORS, FONTS, SPACING, RADIUS } from '../../utils/theme';
import type { BattleState, WingState, LaneId, RoundLogEntry, UnitClass, BattleUnit } from '../../models/battle';
import {
  CLASS_COLOR, totalStrength,
  laneHadClash, laneBrokeSide, laneWheeledFrom, laneHadAmok, laneHadFeint, sideWithdrew,
  playPush, playShake, playScatter, playArc, playZigzag, playRearwardSlide, playFeintDash,
} from './animations';

const LANES: LaneId[] = ['left', 'centre', 'right'];
const LANE_LABEL: Record<LaneId, string> = { left: 'Left Wing', centre: 'Centre', right: 'Right Wing' };

function dominantColor(units: BattleUnit[]): string {
  const byClass = new Map<UnitClass, number>();
  for (const u of units) byClass.set(u.unitClass, (byClass.get(u.unitClass) ?? 0) + u.strength);
  let best: UnitClass = 'legionary';
  let bestVal = -1;
  for (const [cls, val] of byClass) if (val > bestVal) { best = cls; bestVal = val; }
  return CLASS_COLOR[best];
}

export interface LaneAnimHandle {
  skip: () => void;
}

interface LaneBattlefieldProps {
  laneId: LaneId;
  ownWing: WingState;
  enemyWing: WingState;
  newEntries: RoundLogEntry[];
  ownIsAttacker: boolean;
}

const LaneBattlefield = forwardRef<LaneAnimHandle, LaneBattlefieldProps>(function LaneBattlefield(
  { laneId, ownWing, enemyWing, newEntries, ownIsAttacker }, ref,
) {
  const ownBarWidth = useSharedValue(totalStrength(ownWing.units));
  const enemyBarWidth = useSharedValue(totalStrength(enemyWing.units));
  const ownMorale = useSharedValue(ownWing.moralePool);
  const enemyMorale = useSharedValue(enemyWing.moralePool);
  const shakeX = useSharedValue(0);
  const ownEffectY = useSharedValue(0);
  const ownEffectOpacity = useSharedValue(1);
  const enemyEffectY = useSharedValue(0);
  const enemyEffectOpacity = useSharedValue(1);
  const ownArcX = useSharedValue(0);
  const enemyArcX = useSharedValue(0);
  const zigzagX = useSharedValue(0);
  const zigzagOpacity = useSharedValue(1);

  const ownTotal = totalStrength(ownWing.units);
  const enemyTotal = totalStrength(enemyWing.units);

  // Runs once per round (this effect's deps only change when the store
  // actually produces a new round) — see BattlefieldView's header comment
  // for why `newEntries` is computed synchronously during render rather
  // than via a lagging useEffect+setState pair.
  React.useEffect(() => {
    playPush(ownBarWidth, ownTotal);
    playPush(enemyBarWidth, enemyTotal);
    playPush(ownMorale, ownWing.moralePool);
    playPush(enemyMorale, enemyWing.moralePool);

    if (laneHadClash(newEntries, laneId)) playShake(shakeX);

    const brokenSide = laneBrokeSide(newEntries, laneId);
    if (brokenSide) {
      const isOwn = (brokenSide === 'attacker') === ownIsAttacker;
      if (isOwn) playScatter(ownEffectY, ownEffectOpacity);
      else playScatter(enemyEffectY, enemyEffectOpacity);
    }

    const wheel = laneWheeledFrom(newEntries, laneId);
    if (wheel) {
      const isOwn = (wheel.side === 'attacker') === ownIsAttacker;
      const direction: 'left' | 'right' = laneId === 'right' ? 'left' : laneId === 'left' ? 'right' : (wheel.toLane === 'left' ? 'left' : 'right');
      playArc(isOwn ? ownArcX : enemyArcX, direction);
    }

    // amok doesn't record which SIDE's elephant went amok (see the model —
    // no `side` field on the 'amok' entry), so both blocks flash — a
    // deliberate, documented simplification.
    if (laneHadAmok(newEntries, laneId)) playZigzag(zigzagX, zigzagOpacity);

    if (laneHadFeint(newEntries, laneId)) playFeintDash(ownEffectY);

    const withdrawer = sideWithdrew(newEntries);
    if (withdrawer) {
      const isOwn = (withdrawer === 'attacker') === ownIsAttacker;
      playRearwardSlide(isOwn ? ownEffectY : enemyEffectY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownTotal, enemyTotal, ownWing.moralePool, enemyWing.moralePool, newEntries]);

  useImperativeHandle(ref, () => ({
    skip: () => {
      [ownBarWidth, enemyBarWidth, ownMorale, enemyMorale, shakeX,
        ownEffectY, ownEffectOpacity, enemyEffectY, enemyEffectOpacity,
        ownArcX, enemyArcX, zigzagX, zigzagOpacity].forEach(cancelAnimation);
      ownBarWidth.value = ownTotal;
      enemyBarWidth.value = enemyTotal;
      ownMorale.value = ownWing.moralePool;
      enemyMorale.value = enemyWing.moralePool;
      shakeX.value = 0;
      ownArcX.value = 0;
      enemyArcX.value = 0;
      zigzagX.value = 0;
      zigzagOpacity.value = 1;
      ownEffectY.value = ownWing.broken ? 24 : 0;
      ownEffectOpacity.value = ownWing.broken ? 0.35 : 1;
      enemyEffectY.value = enemyWing.broken ? 24 : 0;
      enemyEffectOpacity.value = enemyWing.broken ? 0.35 : 1;
    },
  }));

  // Own/enemy bars meet exactly at the front marker (no overlap) — each
  // bar's width is the SAME ratio that positions the marker, so the split
  // itself IS the tug-of-war reading, not two independently-sized bars
  // fighting for z-order on top of each other.
  const frontPct = () => {
    'worklet';
    const total = ownBarWidth.value + enemyBarWidth.value;
    const pct = total > 0 ? (ownBarWidth.value / total) * 100 : 50;
    return Math.max(4, Math.min(96, pct));
  };
  const ownBarStyle = useAnimatedStyle(() => ({ width: `${frontPct()}%` }));
  const enemyBarStyle = useAnimatedStyle(() => ({ width: `${100 - frontPct()}%` }));
  const frontStyle = useAnimatedStyle(() => ({ left: `${frontPct()}%` }));
  const ownMoraleStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, ownMorale.value))}%` }));
  const enemyMoraleStyle = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(100, enemyMorale.value))}%` }));
  const ownBlockStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value + ownArcX.value }, { translateY: ownEffectY.value }],
    opacity: ownEffectOpacity.value,
  }));
  const enemyBlockStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value + enemyArcX.value }, { translateY: enemyEffectY.value }],
    opacity: enemyEffectOpacity.value,
  }));
  const zigzagStyle = useAnimatedStyle(() => ({ transform: [{ translateX: zigzagX.value }], opacity: zigzagOpacity.value }));

  return (
    <View style={[styles.laneCard, ownWing.broken && styles.laneCardOwnBroken, enemyWing.broken && styles.laneCardEnemyBroken]}>
      <View style={styles.laneHeaderRow}>
        <Text style={styles.laneLabel}>{LANE_LABEL[laneId]}</Text>
        {ownWing.broken && <Text style={styles.brokenTag}>YOUR WING BROKEN</Text>}
        {enemyWing.broken && <Text style={styles.brokenTagEnemy}>ENEMY BROKEN</Text>}
      </View>

      <View style={styles.moraleRow}>
        <Text style={styles.moraleTag}>YOU</Text>
        <View style={styles.moraleTrack}>
          <Animated.View style={[styles.moraleFill, ownMoraleStyle, { backgroundColor: COLORS.laurel }]} />
        </View>
      </View>

      <Animated.View style={[styles.frontTrack, zigzagStyle]}>
        <Animated.View style={[styles.barFillOwn, ownBarStyle, { backgroundColor: dominantColor(ownWing.units) }]} />
        <Animated.View style={[styles.barFillEnemy, enemyBarStyle, { backgroundColor: dominantColor(enemyWing.units) }]} />
        <Animated.View style={[styles.frontMarker, frontStyle]} />
      </Animated.View>

      <View style={styles.chipsRow}>
        <Animated.View style={[styles.chipGroup, ownBlockStyle]}>
          {ownWing.units.map(u => (
            <View key={u.id} style={[styles.chip, { backgroundColor: CLASS_COLOR[u.unitClass] }]} />
          ))}
          {ownWing.units.length === 0 && <Text style={styles.emptyLabel}>{ownWing.broken ? 'routed' : 'empty'}</Text>}
        </Animated.View>
        <Animated.View style={[styles.chipGroup, styles.chipGroupRight, enemyBlockStyle]}>
          {enemyWing.units.length === 0 && <Text style={styles.emptyLabel}>{enemyWing.broken ? 'routed' : 'empty'}</Text>}
          {enemyWing.units.map(u => (
            <View key={u.id} style={[styles.chip, { backgroundColor: CLASS_COLOR[u.unitClass] }]} />
          ))}
        </Animated.View>
      </View>

      <View style={styles.moraleRow}>
        <Text style={styles.moraleTag}>ENEMY</Text>
        <View style={styles.moraleTrack}>
          <Animated.View style={[styles.moraleFill, enemyMoraleStyle, { backgroundColor: COLORS.crimson }]} />
        </View>
      </View>
    </View>
  );
});

// ─── Top-level field ──────────────────────────────────────────────────────────

interface BattlefieldViewProps {
  battleState: BattleState;
}

export default function BattlefieldView({ battleState }: BattlefieldViewProps) {
  const lastLogLengthRef = useRef(0);
  const laneRefs = useRef<Record<LaneId, LaneAnimHandle | null>>({ left: null, centre: null, right: null });

  // Computed synchronously during render (documented React pattern for
  // "remembering info from a previous render" via a ref) so the paired
  // wing-state change and its triggering log entries land in the SAME
  // render — a lagging useEffect+setState pair would split them across
  // two renders and could misfire the one-shot effects.
  const sliceStart = Math.min(lastLogLengthRef.current, battleState.log.length);
  const newEntries = battleState.log.slice(sliceStart);
  if (lastLogLengthRef.current !== battleState.log.length) {
    lastLogLengthRef.current = battleState.log.length;
  }

  function handleSkip() {
    LANES.forEach(l => laneRefs.current[l]?.skip());
  }

  return (
    <TouchableWithoutFeedback onPress={handleSkip}>
      <View style={styles.field}>
        {LANES.map(laneId => (
          <LaneBattlefield
            key={laneId}
            ref={r => { laneRefs.current[laneId] = r; }}
            laneId={laneId}
            ownWing={battleState.attacker.wings[laneId]}
            enemyWing={battleState.defender.wings[laneId]}
            newEntries={newEntries}
            ownIsAttacker
          />
        ))}
        <Text style={styles.skipHint}>Tap anywhere to skip the animation</Text>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  field: { padding: SPACING.md },
  laneCard: {
    backgroundColor: COLORS.panelSurface, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm, overflow: 'hidden',
  },
  laneCardOwnBroken: { borderColor: COLORS.crimson },
  laneCardEnemyBroken: { borderColor: COLORS.laurel },
  laneHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  laneLabel: { fontFamily: FONTS.display, fontSize: 12, color: COLORS.gold, letterSpacing: 1 },
  brokenTag: { fontFamily: FONTS.ui, fontSize: 9, fontWeight: '700', color: COLORS.crimson },
  brokenTagEnemy: { fontFamily: FONTS.ui, fontSize: 9, fontWeight: '700', color: COLORS.laurel },
  moraleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  moraleTag: { fontFamily: FONTS.ui, fontSize: 8, color: COLORS.dust, width: 34 },
  moraleTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: COLORS.panelElevated, overflow: 'hidden' },
  moraleFill: { height: '100%' },
  frontTrack: {
    height: 20, borderRadius: RADIUS.sm, backgroundColor: COLORS.panelElevated,
    overflow: 'hidden', marginVertical: SPACING.xs, position: 'relative',
  },
  barFillOwn: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.85 },
  barFillEnemy: { position: 'absolute', right: 0, top: 0, bottom: 0, opacity: 0.85 },
  frontMarker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: COLORS.marble },
  chipsRow: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 20 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, flex: 1 },
  chipGroupRight: { justifyContent: 'flex-end' },
  chip: { width: 10, height: 10, borderRadius: 2 },
  emptyLabel: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 9, color: COLORS.dust },
  skipHint: { fontFamily: FONTS.body, fontStyle: 'italic', fontSize: 9, color: COLORS.dust, textAlign: 'center', marginTop: SPACING.xs },
});
