// ─── War Engine ──────────────────────────────────────────────────────────────
// Chunk M9 — the strategic warScore wrapper around set-piece battles. Pure
// functions only (no store access) — matches troopEngine.ts/trialEngine.ts's
// existing "type-only GameState import" convention. Uses plain Math.random
// by default (injectable for tests), same as every other non-battle
// strategic-layer engine (musterEngine.offerableLegates, etc.) — invariant 2
// ("every battle takes an RNG seed") is scoped to the tactical battle layer,
// not this strategic one.
//
// ── Scope decision (documented per the plan's §0 instruction) ──────────────
// GameState holds `wars: WarState[]` (not a single `war`), per an explicit
// product decision to support multiple concurrent wars as more regions are
// added later. This chunk only ever creates ONE war via its debug entry
// point (a major 'carthage' war) — provincial revolts staying on the
// existing (already-working) officer-volunteer suppression flow untouched.
// The array shape means folding revolts in later is additive, not a schema
// migration — see models/war.ts's own header comment, which anticipated
// exactly this.
//
// Neither "declare war" nor the personal-commander War Room have a real
// trigger anywhere in this codebase today (verified: provinceEngine.ts sets
// `warDeclarationAvailable` but nothing consumes it; ProvinciaeScreen.tsx
// wires the War Room's commit handler to a no-op). So — per the plan's own
// explicit allowance — a war starts/ends via a debug action only
// (gameStore.startWar/endWar); Phase 3A supplies the real trigger. The
// campaigning army is always the player paterfamilias's own
// raisedLegions/veterans (musterEngine.musterArmy), matching
// startSandboxBattle's existing precedent — there's no other reliably-wired
// "which army is on campaign" signal to hook into.

import type { GameState } from '../state/gameStore';
import type { WarState, SetPieceOffer, WarScale } from '../models/war';
import type { EventInstance } from '../models/event';
import type { BattleUnit, UnitClass } from '../models/battle';
import { BALANCE } from '../data/balance';
import { WAR_SITES } from '../data/warSites';
import { ENEMY_GENERAL_LIST, type GeneralProfile } from '../data/enemyGenerals';
import { musterArmy } from './battle/musterEngine';
import { injectNoticeEvent } from './eventEngine';

// ─── Small helpers ───────────────────────────────────────────────────────────

function clampScore(v: number): number {
  return Math.min(100, Math.max(-100, v));
}

/** Moves `current` toward `target` by up to `step`, never overshooting. */
function moveToward(current: number, step: number, target: number): number {
  if (current > target) return Math.max(target, current - step);
  if (current < target) return Math.min(target, current + step);
  return current;
}

function pickWeighted<T extends string>(weights: Partial<Record<T, number>>, rng: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w ?? 0), 0);
  let roll = rng() * total;
  for (const [id, w] of entries) {
    roll -= w ?? 0;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

// ─── Desperation tier (M1's "desperation/overextension modifier
// recomputation" — exposed as a pure function of warScore so callers can
// derive BALANCE.war.desperation's modifiers on demand; wiring every
// downstream consumer (levy cost, wing def, stratagem hand size, upkeep) is
// explicitly deferred past this "provisional scheduler" chunk — see the
// seam comment below). Also the basis for threshold-crossing notices. ────

export type DesperationTier = 'none' | 'sue' | 'forced' | 'dictate';
const TIER_ORDER: Record<DesperationTier, number> = { none: 0, sue: 1, forced: 2, dictate: 3 };

export function getDesperationTier(warScore: number): DesperationTier {
  const abs = Math.abs(warScore);
  const t = BALANCE.war.thresholds;
  if (abs >= t.dictate) return 'dictate';
  if (abs >= t.forced) return 'forced';
  if (abs >= t.sue) return 'sue';
  return 'none';
}

interface ThresholdCrossing {
  tier: DesperationTier;
  /** true = Rome winning big (positive warScore) crossed upward. */
  winning: boolean;
  headline: string;
}

function buildThresholdHeadline(tier: DesperationTier, winning: boolean): string {
  if (winning) {
    if (tier === 'sue') return 'Carthage sends feelers for peace.';
    if (tier === 'forced') return 'Carthage may soon be forced to terms.';
    return 'Carthage lies open to dictated terms.';
  }
  if (tier === 'sue') return 'Rome may need to sue for peace.';
  if (tier === 'forced') return 'Rome may be forced to the table.';
  return 'Rome stands at the brink — terms may be dictated to us.';
}

/** Only fires on a NEWLY higher-magnitude band (escalation), never on
 *  de-escalation back through a threshold — avoids notice spam on drift
 *  oscillation near a boundary. */
function detectThresholdCrossing(before: number, after: number): ThresholdCrossing | null {
  const tBefore = TIER_ORDER[getDesperationTier(before)];
  const tAfter = TIER_ORDER[getDesperationTier(after)];
  if (tAfter <= tBefore) return null;
  const tier = getDesperationTier(after);
  const winning = after > 0;
  return { tier, winning, headline: buildThresholdHeadline(tier, winning) };
}

function buildThresholdNotice(playerId: string, turnNumber: number, crossing: ThresholdCrossing): EventInstance {
  return injectNoticeEvent('evt-war-threshold-notice', turnNumber, playerId, {
    title: crossing.winning ? 'The Balance Tips' : 'The War Turns Against Us',
    bodyText: crossing.headline,
  });
}

// ─── Skirmish drift ──────────────────────────────────────────────────────────

function rollSkirmishDrift(playerArmyStrength: number, playerMartial: number, rng: () => number): number {
  const w = BALANCE.war;
  const sk = w.skirmish;
  const magnitude = Math.floor(rng() * (w.skirmishDriftMax - w.skirmishDriftMin + 1)) + w.skirmishDriftMin;
  const strengthSignal = playerArmyStrength >= sk.strengthBaseline ? 1 : -1;
  const martialSignal = playerMartial >= sk.martialBaseline ? 1 : -1;
  const sign = (strengthSignal + martialSignal) >= 0 ? 1 : -1;
  return sign * magnitude;
}

// ─── Enemy army generation (consumed only by the seam below) ───────────────

function generateEnemyArmy(profile: GeneralProfile, warScore: number, scale: WarScale, rng: () => number): BattleUnit[] {
  const so = BALANCE.war.setPieceOffer;
  // Rome winning (positive warScore) faces a WEAKER enemy; a losing Rome
  // faces a growing one — mirrors BALANCE.war.desperation's framing (the
  // losing side gets buffs; here the winning side gets an easier scheduler
  // roll instead of a battle-time buff, since the enemy army is generated
  // once, at offer time).
  const rawCohorts = so.baseCohorts - warScore / so.warScoreDivisor;
  const scaledCohorts = rawCohorts * BALANCE.war.scaleArmyMultiplier[scale];
  const cohortCount = Math.round(Math.min(so.maxCohorts, Math.max(so.minCohorts, scaledCohorts)));

  const weights = Object.entries(profile.armyComposition) as [UnitClass, number][];
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0);
  const units: BattleUnit[] = [];
  let allocated = 0;
  weights.forEach(([unitClass, weight], i) => {
    const isLast = i === weights.length - 1;
    const count = isLast ? Math.max(0, cohortCount - allocated) : Math.round((cohortCount * weight) / totalWeight);
    allocated += count;
    for (let n = 0; n < count; n++) {
      units.push({
        id: `enemy-${profile.id}-${unitClass}-${n}-${Math.floor(rng() * 1e9)}`,
        unitClass,
        strength: 100,
        veterancy: 'trained',
        loyalty: 60,
        elephantSteady: false,
      });
    }
  });
  return units;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── THE SEAM ─────────────────────────────────────────────────────────────────
// scheduleSetPiece is the ONLY function anywhere in this codebase that may
// construct a SetPieceOffer. Phase 3A's war script replaces this single
// exported function wholesale with script-driven scheduling — nothing else
// (processWarSeason included) may build offer generation logic directly;
// everything else just calls this and reacts to its result.
// ─────────────────────────────────────────────────────────────────────────────

export function scheduleSetPiece(
  state: GameState,
  war: WarState,
  rng: () => number = Math.random,
  opts: { forceRoll?: boolean } = {},
): SetPieceOffer | null {
  if (!war.active) return null;

  const player = state.family.find(c => c.isPlayer);
  const hasArmy = !!player && ((player.raisedLegions?.length ?? 0) + (player.veterans?.length ?? 0)) > 0;
  if (!hasArmy) return null;

  const so = BALANCE.war.setPieceOffer;
  if (!opts.forceRoll) {
    if (state.turnNumber - war.lastSetPieceTurn < so.minSpacingTurns) return null;
    if (rng() >= so.chancePerSeason) return null;
  }

  const site = WAR_SITES[Math.floor(rng() * WAR_SITES.length)];
  const terrainId = pickWeighted(site.terrainWeights, rng);
  const terrain = BALANCE.battle.terrains[terrainId];

  // "General chosen round-robin from enemyGenerals.ts" — deterministic
  // cycling keyed off the current turn (no extra persisted counter needed).
  const general = ENEMY_GENERAL_LIST[state.turnNumber % ENEMY_GENERAL_LIST.length];

  const enemyArmy = generateEnemyArmy(general, war.warScore, war.scale, rng);

  return {
    id: `offer-${war.id}-${state.turnNumber}-${Math.floor(rng() * 1e9)}`,
    siteName: site.name,
    terrainId: terrain.id,
    enemyArmy,
    enemyGeneralId: general.id,
    expiresTurn: state.turnNumber + so.expiryTurns,
  };
}

// ─── processWarSeason — the turnSequencer hook ──────────────────────────────

export interface WarSeasonResult {
  wars: WarState[];
  /** Headline strings — the caller pushes these into turnSequencer's
   *  `events` array (which becomes SeasonLedger.headlines via gameStore.
   *  endSeason's existing diff-capture; no separate ledger plumbing needed). */
  events: string[];
  /** Threshold-crossing notices — injected into pendingEvents by the caller. */
  noticeEvents: EventInstance[];
  /** Accumulated across all wars this season (declines/expiries only). */
  lifetimeDignitasDelta: number;
}

export function processWarSeason(state: GameState, rng: () => number = Math.random): WarSeasonResult {
  const events: string[] = [];
  const noticeEvents: EventInstance[] = [];
  let lifetimeDignitasDelta = 0;

  const player = state.family.find(c => c.isPlayer) ?? null;
  const playerId = player?.id ?? 'pc-1';
  const playerArmy = player ? musterArmy(player) : [];
  const playerArmyStrength = playerArmy.reduce((s, u) => s + u.strength, 0);
  const playerMartial = player?.skills.martial ?? 0;
  const so = BALANCE.war.setPieceOffer;

  const wars = (state.wars ?? []).map(war => {
    if (!war.active) return war;
    let next: WarState = { ...war };
    const beforeScore = next.warScore;

    // 1. Skirmish drift.
    next.warScore = clampScore(next.warScore + rollSkirmishDrift(playerArmyStrength, playerMartial, rng));

    // 2. Weariness — after wearinessAfterTurns, warScore erodes toward 0.
    const turnsSinceStart = state.turnNumber - next.startedTurn;
    if (turnsSinceStart > BALANCE.war.wearinessAfterTurns) {
      next.warScore = moveToward(next.warScore, BALANCE.war.wearinessDriftPerSeason, 0);
    }
    next.weariness += 1;

    // 3. Threshold-crossing notice (also where desperation's tier changes
    // become visible to the player, per getDesperationTier above).
    const crossing = detectThresholdCrossing(beforeScore, next.warScore);
    if (crossing) {
      noticeEvents.push(buildThresholdNotice(playerId, state.turnNumber, crossing));
      events.push(`War with ${next.enemyId}: ${crossing.headline}`);
    }

    // 4. A stale, unanswered offer expires with the same consequence as an
    // explicit decline (defensive — keeps the scheduler unstuck even if the
    // player never opens the app to answer it; see SetPieceOfferModal for
    // the normal, immediate resolution path).
    if (next.pendingSetPiece && next.pendingSetPiece.expiresTurn <= state.turnNumber) {
      events.push(`The offer at ${next.pendingSetPiece.siteName} goes unanswered — the moment passes.`);
      next.warScore = clampScore(next.warScore + so.declineWarScorePenalty);
      lifetimeDignitasDelta += so.declineLifetimeDignitasPenalty;
      next = { ...next, pendingSetPiece: null };
    }

    // 5. THE SEAM — scheduler roll (only when no offer is currently pending).
    if (!next.pendingSetPiece) {
      const offer = scheduleSetPiece(state, next, rng);
      if (offer) {
        next = { ...next, pendingSetPiece: offer, lastSetPieceTurn: state.turnNumber };
        events.push(`The armies will meet at ${offer.siteName}.`);
      }
    }

    const seasonDelta = next.warScore - beforeScore;
    events.push(`War with ${next.enemyId}: warScore ${seasonDelta >= 0 ? '+' : ''}${seasonDelta} (now ${next.warScore}).`);

    return next;
  });

  return { wars, events, noticeEvents, lifetimeDignitasDelta };
}
