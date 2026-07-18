// ─── Movement Engine ─────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C5 — pure movement-order math: MP budgets,
// reachability (the map preview's one source of truth — the UI renders
// exactly what `reachable()` returns, never a separate approximation),
// path validation, and the forced-march/sea-storm consequence functions.
// Nothing here resolves an order — C7 owns resolution (actually moving
// armies, rolling storms, creating engagements) and calls the consequence
// functions below at that time; issuing an order here only validates and
// records intent (design invariant 2: "resolve, then animate").

import type { Army, ArmyUnit, MovementOrder } from '../models/army';
import type { RegionId, TheatreState } from '../models/theatre';
import { THEATRE_EDGES } from '../data/theatreMap';
import { getAdjacent, getRegion } from './theatreEngine';
import { armyPowerOf } from './armyEngine';
import { BALANCE } from '../data/balance';

function findEdge(a: RegionId, b: RegionId) {
  return THEATRE_EDGES.find(e => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}

// ─── Movement points ────────────────────────────────────────────────────────

export function calcMovementPoints(
  cohortCount: number,
  seasonIndex: number,
  forcedMarch: boolean,
): number {
  const m = BALANCE.campaign.movement;
  let mp = m.baseMP;
  if (seasonIndex === 3) mp -= m.winterMPPenalty;
  if (cohortCount > m.bigStackCohorts) mp -= m.bigStackMPPenalty;
  if (forcedMarch) mp += m.forcedMarchMPBonus;
  // Modifiers are summed first, THEN floored once — "min 1" reads as a
  // floor on the final budget (an army can always attempt at least one
  // land step), not an independent floor re-applied after each modifier.
  return Math.max(1, mp);
}

// ─── Reachability (the map preview's one source of truth) ──────────────────

export interface ReachableDestination {
  regionId: RegionId;
  /** Full route, army.location first, regionId last. */
  path: RegionId[];
  /** MP spent to arrive — informational (a sea-lane arrival always shows
   *  the army's full budget, since it consumes all remaining MP). */
  costSpent: number;
  viaSeaLane: boolean;
  /** 'attack' iff a hostile-power army already holds this region (design
   *  invariant 4: entering an occupied region IS the attack). */
  intent: 'move' | 'attack';
  /** Set when this destination is visible but not legally orderable for
   *  THIS army — currently only 'leaderless' (design invariant 5: a
   *  leaderless army may move but never attack). Null = orderable. */
  blockedReason: 'leaderless' | null;
}

/**
 * Every region this army could be ordered into this season, land/strait
 * moves budgeted via a cost-relaxation search (small integer costs on an
 * 8-node graph — a full priority queue is unneeded complexity) plus every
 * sea lane reachable from a coastal stopping point with enough MP left.
 * A region reachable by BOTH land and sea keeps its (cheaper, more
 * informative) land route — sea is only added where land can't reach at
 * all within budget.
 */
export function reachable(
  army: Army,
  armies: Army[],
  theatre: TheatreState,
  seasonIndex: number,
  forcedMarch: boolean,
): ReachableDestination[] {
  const m = BALANCE.campaign.movement;
  const totalMP = calcMovementPoints(army.units.length, seasonIndex, forcedMarch);
  const power = armyPowerOf(army.owner);

  const bestCost = new Map<RegionId, number>([[army.location, 0]]);
  const bestPath = new Map<RegionId, RegionId[]>([[army.location, [army.location]]]);
  let frontier: RegionId[] = [army.location];

  while (frontier.length > 0) {
    const next: RegionId[] = [];
    for (const current of frontier) {
      const currentCost = bestCost.get(current)!;
      const currentPath = bestPath.get(current)!;
      const neighbors = [...getAdjacent(current, 'land'), ...getAdjacent(current, 'strait')];
      for (const neighborId of neighbors) {
        const edge = findEdge(current, neighborId);
        if (!edge) continue;
        const stepCost = edge.kind === 'strait'
          ? m.straitCost
          : theatre.controllers[neighborId] === power ? m.landFriendlyCost : m.landContestedCost;
        const newCost = currentCost + stepCost;
        if (newCost > totalMP) continue;
        if (bestCost.has(neighborId) && bestCost.get(neighborId)! <= newCost) continue;
        bestCost.set(neighborId, newCost);
        bestPath.set(neighborId, [...currentPath, neighborId]);
        next.push(neighborId);
      }
    }
    frontier = next;
  }

  const results = new Map<RegionId, ReachableDestination>();

  function addDestination(regionId: RegionId, path: RegionId[], costSpent: number, viaSeaLane: boolean) {
    if (results.has(regionId)) return;
    const hostileHere = armies.some(a => a.location === regionId && armyPowerOf(a.owner) !== power);
    const intent: 'move' | 'attack' = hostileHere ? 'attack' : 'move';
    const blockedReason = intent === 'attack' && !army.commanderId ? 'leaderless' as const : null;
    results.set(regionId, { regionId, path, costSpent, viaSeaLane, intent, blockedReason });
  }

  for (const [regionId, path] of bestPath) {
    if (regionId === army.location) continue;
    addDestination(regionId, path, bestCost.get(regionId)!, false);
  }

  // Sea lanes — from every land-reachable coastal stop (including the
  // army's own starting region, cost 0) with enough MP left over.
  for (const [fromRegion, costSoFar] of bestCost) {
    const remaining = totalMP - costSoFar;
    if (remaining < m.seaLaneMinMP) continue;
    if (!getRegion(fromRegion)?.coastal) continue;
    for (const seaTarget of getAdjacent(fromRegion, 'sea')) {
      const path = [...bestPath.get(fromRegion)!, seaTarget];
      addDestination(seaTarget, path, totalMP, true);
    }
  }

  return [...results.values()];
}

// ─── Path validation ────────────────────────────────────────────────────────

export interface PathValidation {
  valid: boolean;
  reason?: 'too_short' | 'not_adjacent' | 'sea_lane_not_final';
}

/** Structural validation of an arbitrary candidate path — every consecutive
 *  pair must be a real Edge, and a sea-lane edge (if present at all) must
 *  be the LAST edge (no continuing overland after embarking — "one lane
 *  per season"). Independent of any specific army's MP budget; `reachable`
 *  above already only ever produces valid paths, but this exists so any
 *  path (e.g. one read back from a save) can be checked on its own. */
export function isValidPath(path: RegionId[]): PathValidation {
  if (path.length < 2) return { valid: false, reason: 'too_short' };
  for (let i = 0; i < path.length - 1; i++) {
    const edge = findEdge(path[i], path[i + 1]);
    if (!edge) return { valid: false, reason: 'not_adjacent' };
    if (edge.kind === 'sea' && i !== path.length - 2) return { valid: false, reason: 'sea_lane_not_final' };
  }
  return { valid: true };
}

// ─── Building an order ──────────────────────────────────────────────────────

/** Looks up `destinationRegionId` in this army's own `reachable()` set and
 *  wraps it into a MovementOrder — the only supported way to build one, so
 *  every issued order is guaranteed reachable and correctly intent-labelled.
 *  Returns null for an unreachable or blocked (leaderless-attack) target. */
export function buildMovementOrder(
  army: Army,
  armies: Army[],
  theatre: TheatreState,
  seasonIndex: number,
  destinationRegionId: RegionId,
  forcedMarch: boolean,
): MovementOrder | null {
  const destination = reachable(army, armies, theatre, seasonIndex, forcedMarch)
    .find(d => d.regionId === destinationRegionId);
  if (!destination || destination.blockedReason) return null;
  return { path: destination.path, forcedMarch, intent: destination.intent };
}

// ─── Resolution-time consequences (C7 calls these; declared+tested now) ────

/** Forced march's cost: 4% strength attrition across every unit, plus the
 *  `fatigued` flag (consumed by whichever future chunk bridges Army to a
 *  tactical battle — unused by anything yet, same "declared, not consumed"
 *  precedent as Army.fatigued/unpaidSeasons themselves in Chunk C2). */
export function applyForcedMarchAttrition(army: Army): Army {
  const { forcedMarchAttritionPct } = BALANCE.campaign.movement;
  const units: ArmyUnit[] = army.units.map(u => ({
    ...u,
    strength: Math.max(0, u.strength * (1 - forcedMarchAttritionPct)),
  }));
  return { ...army, units, fatigued: true };
}

/** True = the crossing storms. `edgeLaneRisk` is the sea Edge's own
 *  laneRisk (undefined for a land/strait edge, which never storms — callers
 *  should only invoke this for a sea-lane order). Winter multiplies the
 *  base risk (BALANCE.campaign.movement.winterSeaMultiplier). */
export function rollSeaLaneStorm(
  edgeLaneRisk: number,
  seasonIndex: number,
  rng: () => number = Math.random,
): boolean {
  const { winterSeaMultiplier } = BALANCE.campaign.movement;
  const chance = edgeLaneRisk * (seasonIndex === 3 ? winterSeaMultiplier : 1);
  return rng() < chance;
}

/** A storm's cost: 10% strength loss, fleet-wide. The "lands back where it
 *  embarked" half of the consequence is a location/path decision for C7's
 *  resolver to make (this function only has the army, not its full order
 *  context) — declared here only for the strength-loss math. */
export function applyStormAttrition(army: Army): Army {
  const { stormAttritionPct } = BALANCE.campaign.movement;
  const units: ArmyUnit[] = army.units.map(u => ({
    ...u,
    strength: Math.max(0, u.strength * (1 - stormAttritionPct)),
  }));
  return { ...army, units };
}
