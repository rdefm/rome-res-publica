// ─── Theatre Engine ──────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C1 — pure query engine over the static REGIONS/
// THEATRE_EDGES dataset (data/theatreMap.ts) and the live TheatreState/City
// arrays. No store access, no mutation — matches the project's engine-layer
// convention (troopEngine.ts, cityEngine.ts, etc.).

import type { RegionId, Region, Controller, EdgeKind, TheatreState } from '../models/theatre';
import type { CityState } from '../models/city';
import { REGIONS, THEATRE_EDGES } from '../data/theatreMap';
import { BALANCE } from '../data/balance';

export function getRegion(id: RegionId): Region | undefined {
  return REGIONS.find(r => r.id === id);
}

/** Regions adjacent to `regionId`, optionally filtered to one edge kind
 *  (e.g. 'land' for a movement preview that excludes sea lanes). Edges are
 *  stored once (a→b); this checks both directions since adjacency is
 *  symmetric. */
export function getAdjacent(regionId: RegionId, kind?: EdgeKind): RegionId[] {
  const out: RegionId[] = [];
  for (const edge of THEATRE_EDGES) {
    if (kind && edge.kind !== kind) continue;
    if (edge.a === regionId) out.push(edge.b);
    else if (edge.b === regionId) out.push(edge.a);
  }
  return out;
}

/** Mean relationshipScore of the region's cities, drawn from the live
 *  `cities` array (not the static REGIONS.cityIds alone — relationship is
 *  mutable CityState). Falls back to BALANCE.campaign.defaultForeignRelationship
 *  when the region has no cityIds or none of them match a live city (the
 *  ref-less-region case the plan's C1 spec calls out; no launch region hits
 *  this today). */
export function getRegionRelationship(cities: CityState[], regionId: RegionId): number {
  const region = getRegion(regionId);
  if (!region || region.cityIds.length === 0) {
    return BALANCE.campaign.defaultForeignRelationship;
  }
  const matches = cities.filter(c => region.cityIds.includes(c.id));
  if (matches.length === 0) {
    return BALANCE.campaign.defaultForeignRelationship;
  }
  const sum = matches.reduce((acc, c) => acc + c.relationshipScore, 0);
  return sum / matches.length;
}

export function isFriendly(theatre: TheatreState, regionId: RegionId, owner: Controller): boolean {
  return theatre.controllers[regionId] === owner;
}

export function isHostile(theatre: TheatreState, regionId: RegionId, owner: Controller): boolean {
  const controller = theatre.controllers[regionId];
  return controller !== owner && controller !== 'neutral';
}

/** BFS shortest path from `a` to `b` over land + strait edges only (sea
 *  lanes excluded — this is for AI planning and movement previews, which
 *  the plan scopes to overland routes; C5's real movement engine handles
 *  sea lanes as a distinct order type). Returns the region-id sequence
 *  including both endpoints, or null if unreachable. */
export function landPath(a: RegionId, b: RegionId): RegionId[] | null {
  if (a === b) return [a];

  const queue: RegionId[] = [a];
  const cameFrom = new Map<RegionId, RegionId>();
  const visited = new Set<RegionId>([a]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = [...getAdjacent(current, 'land'), ...getAdjacent(current, 'strait')];
    for (const next of neighbors) {
      if (visited.has(next)) continue;
      visited.add(next);
      cameFrom.set(next, current);
      if (next === b) {
        const path: RegionId[] = [b];
        let node = b;
        while (node !== a) {
          node = cameFrom.get(node)!;
          path.unshift(node);
        }
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

/** Reverse lookup: which region contains this city id. */
export function regionOf(cityId: string): RegionId | undefined {
  return REGIONS.find(r => r.cityIds.includes(cityId))?.id;
}
