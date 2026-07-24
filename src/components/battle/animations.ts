/**
 * animations.ts — Chunk M6 animation constants + small Reanimated helpers.
 *
 * Design (documented per the plan's scope guard, which explicitly permits
 * cutting an animation down if it fights Reanimated for more than an hour):
 * a full serialized multi-beat choreography per round (prelude → shock →
 * melee → morale, one lane at a time) was cut in favor of PARALLEL
 * per-lane "push" animations — each lane's own/enemy strength bars
 * continuously tween toward the new round's totals (driven directly by
 * Reanimated shared values remembering their last position, no separate
 * "previous state" prop needed), with short one-shot effects (shake/
 * scatter/arc/zigzag/slide) layered on top for the events that happened in
 * that lane this round. This delivers the spec's core "hybrid feel" —
 * rounds visibly play out, then pause for orders — without the risk of an
 * overengineered, brittle sequencer. Total round animation settles in
 * ~1.5–2.5s (parallel across lanes) rather than a serial ~10–15s.
 *
 * M3 note: battleEngine only ever emits 'clash' (shock+melee already
 * folded together — see its header comment), 'feint_result', 'wing_break',
 * 'wheel', 'pursue', 'amok', 'withdrawal', 'battle_end'. 'shock_charge' /
 * 'terror' / 'reserve_commit' / 'stratagem_played' are declared in the
 * model but never emitted yet — handled gracefully (no-op) for forward
 * compatibility with M7+.
 */
import {
  withTiming, withSequence, withDelay, withRepeat, Easing,
  type SharedValue,
} from 'react-native-reanimated';
import type { RoundLogEntry, LaneId, UnitClass, BattleUnit } from '../../models/battle';

export const PUSH_DURATION_MS = 1400;
export const SHAKE_DURATION_MS = 90;
export const SCATTER_DURATION_MS = 600;
export const ARC_DURATION_MS = 900;
export const ZIGZAG_DURATION_MS = 900;
export const SLIDE_DURATION_MS = 1000;

export const CLASS_COLOR: Record<UnitClass, string> = {
  legionary: '#c9a84c',
  spear_foot: '#8a9a6a',
  skirmisher: '#a89060',
  cavalry_heavy: '#8b1a1a',
  cavalry_light: '#c07030',
  elephant: '#6a3d8f',
};

export function totalStrength(units: BattleUnit[]): number {
  return units.reduce((s, u) => s + u.strength, 0);
}

// ─── Event queries (which effect(s) touched a given lane this round) ───────

export function laneHadClash(entries: RoundLogEntry[], laneId: LaneId): boolean {
  return entries.some(e => e.type === 'clash' && e.laneId === laneId);
}
export function laneBrokeSide(entries: RoundLogEntry[], laneId: LaneId): 'attacker' | 'defender' | null {
  const e = entries.find(ev => ev.type === 'wing_break' && ev.laneId === laneId);
  return e && e.type === 'wing_break' ? e.side : null;
}
export function laneWheeledFrom(entries: RoundLogEntry[], laneId: LaneId): { toLane: LaneId; side: 'attacker' | 'defender' } | null {
  const e = entries.find(ev => ev.type === 'wheel' && ev.fromLane === laneId);
  return e && e.type === 'wheel' ? { toLane: e.toLane, side: e.side } : null;
}
export function laneWheeledInto(entries: RoundLogEntry[], laneId: LaneId): boolean {
  return entries.some(e => e.type === 'wheel' && e.toLane === laneId);
}
export function laneHadAmok(entries: RoundLogEntry[], laneId: LaneId): boolean {
  return entries.some(e => e.type === 'amok' && e.laneId === laneId);
}
export function laneHadFeint(entries: RoundLogEntry[], laneId: LaneId): boolean {
  return entries.some(e => e.type === 'feint_result' && e.laneId === laneId);
}
export function sideWithdrew(entries: RoundLogEntry[]): 'attacker' | 'defender' | null {
  const e = entries.find(ev => ev.type === 'withdrawal');
  return e && e.type === 'withdrawal' ? e.side : null;
}

// ─── Promise-free Reanimated triggers (fire-and-forget; skip() cancels) ───

export function playPush(sv: SharedValue<number>, toValue: number): void {
  sv.value = withTiming(toValue, { duration: PUSH_DURATION_MS, easing: Easing.inOut(Easing.quad) });
}

export function playShake(sv: SharedValue<number>): void {
  sv.value = withSequence(
    withTiming(-6, { duration: SHAKE_DURATION_MS }),
    withRepeat(withTiming(6, { duration: SHAKE_DURATION_MS }), 3, true),
    withTiming(0, { duration: SHAKE_DURATION_MS }),
  );
}

/** Chips scatter rearward and fade — timed to land after the push settles. */
export function playScatter(translateY: SharedValue<number>, opacity: SharedValue<number>): void {
  translateY.value = withDelay(PUSH_DURATION_MS * 0.6, withTiming(36, { duration: SCATTER_DURATION_MS }));
  opacity.value = withDelay(PUSH_DURATION_MS * 0.6, withTiming(0.35, { duration: SCATTER_DURATION_MS }));
}

/** The winning block arcs sideways into the adjacent lane. */
export function playArc(translateX: SharedValue<number>, direction: 'left' | 'right'): void {
  const target = direction === 'left' ? -56 : 56;
  translateX.value = withDelay(
    PUSH_DURATION_MS * 0.5,
    withSequence(withTiming(target, { duration: ARC_DURATION_MS }), withTiming(0, { duration: 1 })),
  );
}

/** An elephant chip zigzags erratically then fades — amok. */
export function playZigzag(translateX: SharedValue<number>, opacity: SharedValue<number>): void {
  translateX.value = withSequence(
    withTiming(-14, { duration: 140 }), withTiming(14, { duration: 140 }),
    withTiming(-10, { duration: 140 }), withTiming(10, { duration: 140 }),
    withTiming(0, { duration: 140 }),
  );
  opacity.value = withDelay(ZIGZAG_DURATION_MS * 0.7, withTiming(0.3, { duration: 250 }));
}

/** Whole block slides rearward together — an orderly withdrawal. */
export function playRearwardSlide(translateY: SharedValue<number>): void {
  translateY.value = withTiming(24, { duration: SLIDE_DURATION_MS, easing: Easing.out(Easing.quad) });
}

/** A quick dash-back-and-return — feigned retreat. */
export function playFeintDash(translateY: SharedValue<number>): void {
  translateY.value = withSequence(
    withTiming(18, { duration: 350 }),
    withTiming(0, { duration: 450 }),
  );
}

export function playTremble(sv: SharedValue<number>): void {
  sv.value = withRepeat(withSequence(withTiming(-2, { duration: 60 }), withTiming(2, { duration: 60 })), 4, true);
}
