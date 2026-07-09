// ─── War Models ──────────────────────────────────────────────────────────────
// Types for the strategic warScore wrapper around set-piece battles (see
// rome-military-implementation-plan.md, Chunk M1). No logic here.
//
// DEVIATION FROM THE PLAN TEXT (documented per the plan's own §0 instruction
// to flag deviations with reasons): the plan's M1 draft types WarState as a
// single Rome-vs-'carthage' affair (`GameState.war: WarState | null`, wired
// in M9). Design discussion before this chunk decided that provincial
// revolts (today's `CampaignState` with `type: 'suppression'`) should ALSO
// route through the new set-piece battle system rather than keep the old
// abstract dice-roll resolution — just scaled down (smaller enemy armies;
// see BALANCE.war.scaleArmyMultiplier in balance.ts). That means more than
// one WarState can plausibly be active at once (one major foreign war +
// one or more local revolts), so:
//   - `enemyId` is a plain `string`, not a closed 'carthage' literal union.
//   - `scale` and `provinceId` are added to distinguish a major foreign war
//     from a local/revolt one (provinceId is set only for local wars).
//   - Each WarState carries its own `id`.
// Whether `GameState` ends up holding `war: WarState | null` (single) or
// `wars: WarState[]` (multiple concurrent) is an M9 decision — this shape
// supports either without changes. M9 must also decide whether a local
// revolt war and a major war can be fought with the same field army at once
// (the plan's "one Roman field army at a time" constraint suggests no).

import type { BattleUnit } from './battle';

export type WarScale = 'major' | 'local';

export interface SetPieceOffer {
  id: string;
  siteName: string;
  terrainId: string;
  enemyArmy: BattleUnit[];
  enemyGeneralId: string;
  expiresTurn: number;
}

/** Minimal placeholder — full shape (terms, budget, faction reactions) is
 *  specified in Chunk M10 (src/data/treatyTerms.ts). */
export interface TreatyState {
  id: string;
  proposedTurn: number;
  /** Term ids from the M10 treatyTerms.ts catalog. */
  termIds: string[];
  /** null = pending a Senate vote. */
  ratified: boolean | null;
}

export interface WarState {
  id: string;
  active: boolean;
  /** 'carthage' for the major foreign war; a synthetic id (e.g. a province id)
   *  for a local revolt war. Extensible — not a closed literal union. */
  enemyId: string;
  scale: WarScale;
  /** Set only for local/revolt wars — the province this war is tied to. */
  provinceId: string | null;
  /** −100…100. */
  warScore: number;
  startedTurn: number;
  lastSetPieceTurn: number;
  weariness: number;
  pendingSetPiece: SetPieceOffer | null;
  treaty: TreatyState | null;
}
