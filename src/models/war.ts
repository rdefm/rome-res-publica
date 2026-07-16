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

// ─── Chunk M10 — Peace: Negotiation & Senate Ratification ────────────────────

/** Support delta applied to the ratification bill per faction, scaled by how
 *  many clan leaders carry that bias (see warEngine.ts's
 *  calcFactionReactionModifier). Positive = that faction favours the term. */
export interface TreatyTermFactionReaction {
  optimates: number;
  populares: number;
}

/** Effects that don't fit the flat `key±N` / colon-token effect-string
 *  vocabulary (resourceEngine.ts's applyEffectString) — applied by
 *  warEngine.ts's applyTreatyEffects, not the generic bill pass/fail path. */
export interface TreatyTermWarEndFlags {
  /** Clears `captivity` on every family member who has it set. */
  prisonerReturn?: boolean;
  /** Province ids (from provinceDefinitions.ts's MEDITERRANEAN_PROVINCES) flipped
   *  to owner: 'rome' / status: 'unincorporated' when Rome is the winning side
   *  applying this term — an insert-or-update: the listed province is almost
   *  always already present in state.provinces as 'foreign' (MP-B populates
   *  every Mediterranean province from turn 1), so this flips it in place
   *  rather than inserting a new one (see warEngine.ts's applyTreatyEffects).
   *  Never removes a Roman province — no mechanic for that exists yet, so
   *  the Rome-as-loser mirror of a cession term is dignity/imperium loss
   *  only (see effectsAsLoser), not an actual transfer away from Rome. */
  provinceTransferToRome?: string[];
  /** Face-saver clause: shaves this many points off the total package's
   *  warScore price and grants the LOSING side's standing commander this
   *  much lifetimeDignitas (Rome's commander if Rome lost; otherwise this
   *  is flavour-only since the AI has no dignitas stat). */
  faceSaverPriceDiscount?: number;
  faceSaverLoserDignitas?: number;
}

/** A single term in the treatyTerms.ts catalog. Bidirectional by design
 *  (per the M10 scope decision) — one entry serves both "Rome wins" and
 *  "Rome loses" framings rather than doubling the menu with mirrored ids. */
export interface TreatyTerm {
  id: string;
  label: string;
  description: string;
  /** Cost in warScore-budget points to include this term in a package.
   *  The face-saver term's price is negative (see faceSaverPriceDiscount). */
  warScorePrice: number;
  /** Existing effect-string vocabulary, applied when Rome is the winning
   *  side proposing/receiving this term. */
  effectsAsWinner: string;
  /** Existing effect-string vocabulary, applied when Rome is the losing
   *  side conceding this term. */
  effectsAsLoser: string;
  warEndFlags?: TreatyTermWarEndFlags;
  factionReaction: TreatyTermFactionReaction;
  /** Term ids that can't be selected alongside this one in the same package.
   *  Enforced by NegotiationScreen at selection time, not by the engine. No
   *  current term uses this — the Mediterranean cession terms are each
   *  atomic/per-province, with no overlapping-region pairs left to exclude. */
  mutuallyExclusiveWith?: string[];
}

export interface TreatyState {
  id: string;
  proposedTurn: number;
  /** Turn the vote/decision resolved (pass, fail, or auto-ratify) — null
   *  while pending. Drives the 4-turn re-table lockout after a failed
   *  ratification (see BALANCE.war.treaty.retableLockoutTurns). */
  resolvedTurn: number | null;
  /** Term ids from the M10 treatyTerms.ts catalog. */
  termIds: string[];
  /** null = pending a decision (Senate vote, or player accept/refuse at
   *  'ai_offer' stage); true = ratified; false = rejected/expired. */
  ratified: boolean | null;
  /** Who tabled/proposed this treaty — determines which side's win/loss
   *  framing (effectsAsWinner/effectsAsLoser) applies at resolution. */
  initiator: 'rome' | 'enemy';
  /** 'ai_offer' = lightweight sue-tier accept/refuse, no Senate vote.
   *  'senate_vote' = full package tabled as a bill through the normal
   *  pipeline. 'auto_ratified' = Rome-as-loser dictate-tier terms applied
   *  immediately with no vote (Rome dictated to). */
  stage: 'ai_offer' | 'senate_vote' | 'auto_ratified';
}

// ─── Phase 3, Chunk P3-A — Historical Ripeness ────────────────────────────
// EXTENDS the M9/M10 war model above rather than replacing it (see
// rome-phase3-implementation-plan.md §0's reconciliation note, resolved by
// direct decision when P3-A was scoped: the military overhaul's `wars:
// WarState[]` / warEngine.ts already existed when Phase 3 began, in the
// opposite build order the Phase 3 plan anticipated — so Phase 3 extends
// them in place instead of creating a parallel singular `war: WarState`).
//
// `phase` is cosmetic/agenda-flavour only (no mechanic gates on it, per the
// plan's invariant 2 framing) — narrative flavour for agenda copy in a
// later chunk. `terminalOutcome` is a NEW classification layered on top of
// the EXISTING treaty/ratification system (M10): it does not change how or
// when a war ends (that's still purely the desperation-tier/treaty
// machinery in warEngine.ts, untouched by this chunk) — it only tags what
// kind of ending a 'major'-scale war's conclusion counts as, for a future
// epilogue chunk (P3-E) to read via GameState.pendingEpilogue. 'local'-scale
// wars (province revolts) never receive a terminalOutcome — they keep
// ending via the plain treaty flow with no epilogue hook.

/** Cosmetic narrative stage — no mechanic reads this to gate anything. */
export type WarPhase = 'not_started' | 'opening' | 'escalation' | 'grinding' | 'ripe' | 'ended';

/** Set only on a 'major'-scale war once it concludes (treaty ratifies, or
 *  the dictate-tier Rome-as-loser auto-ratify fires). null while active or
 *  for any 'local'-scale war. */
export type WarTerminalOutcome = 'victory' | 'exhaustion' | 'humbled' | null;

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
  /** P3-A — cosmetic narrative stage, recomputed each active season. */
  phase: WarPhase;
  /** P3-A — the calendar year (GameState.year) this war was started via startWar. */
  ignitedYear: number;
  /** P3-A — the calendar year this war's `active` flag flipped false. null while active. */
  endedYear: number | null;
  /** P3-A — set once, at the season this war concludes. See WarTerminalOutcome. */
  terminalOutcome: WarTerminalOutcome;
  /** P3-B — true once weariness clears the ripeness-scaled bar computed by
   *  warEngine.peaceReachable, for a 'major' war only. Surfaces the
   *  bill-sue-for-peace lever (see warEngine.ts's queueSueForPeaceBill) and
   *  gates agenda #21. Always false for 'local'-scale wars. */
  peaceOffered: boolean;
  /** P3-B — GameState.turnNumber the war-funding bill was last auto-tabled
   *  for this war (any outcome). −Infinity until the first offer, mirroring
   *  lastSetPieceTurn's "immediately eligible" convention. Gates re-offering
   *  via BALANCE.war.funding.recurTurns. */
  lastFundingOfferTurn: number;
}
