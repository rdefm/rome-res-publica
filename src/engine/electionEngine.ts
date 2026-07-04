import type { ElectionRival, OfficeId } from '../models/office';
import type { GameState } from '../state/gameStore';
import { OFFICES } from '../data/offices';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Player's starting election score before any canvassing or client bonuses. */
export const PLAYER_BASE_SCORE = 25;

/** Fides cost per canvassing attempt. */
export const CANVASS_FIDES_COST = 3;

/** Minimum relationship required to canvass a leader. */
export const CANVASS_MIN_RELATIONSHIP = 25;

/** Probability of a canvassing event firing on any given attempt (0–1). */
export const CANVASS_EVENT_CHANCE = 0.15;

function clamp(min: number, max: number, val: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─── Office threshold ─────────────────────────────────────────────────────────

/**
 * Returns the canvassing success threshold for a given office.
 * Scales linearly: Vigintivirate = 40, adding 5 per rung up to Dictator = 75.
 * A rival-clan canvass requires double this threshold.
 */
export function calcOfficeThreshold(officeId: OfficeId): number {
  const idx = OFFICES.findIndex(o => o.id === officeId);
  return 40 + Math.max(0, idx) * 5;
}

// ─── Canvass roll ─────────────────────────────────────────────────────────────

/**
 * Generates the raw canvass roll result (not yet compared to threshold).
 * - Base: 0–100 random
 * - +5 per rhetoric point
 * - +2 per 10 relationship points with the target
 */
export function calcCanvassRoll(rhetoric: number, relationship: number): number {
  const base = Math.random() * 100;
  const rhetBonus = rhetoric * 5;
  const relBonus = Math.floor(relationship / 10) * 2;
  return base + rhetBonus + relBonus;
}

// ─── Player election score ────────────────────────────────────────────────────

/**
 * Returns the player's current displayed election score:
 * base + voting-sway client bonuses + votes from successfully canvassed leaders.
 * Used in both the Cursus election panel (live) and resolveElection (final).
 */
export function calcPlayerElectionScore(state: GameState): number {
  const votingSwayBonus = state.clients
    .filter(c => c.type === 'votingSway')
    .reduce((sum, c) => sum + (c.bonus.votingSwayBonus ?? 1), 0);

  const lockedFor = state.clans
    .flatMap(c => c.leaders)
    .filter(l => state.campaignVotes[l.id] === 'for')
    .reduce((sum, l) => sum + l.votes, 0);

  return PLAYER_BASE_SCORE + votingSwayBonus + lockedFor;
}

// ─── Rival election score ─────────────────────────────────────────────────────

/**
 * Returns a rival's displayed election score, proportional to their clan's
 * influence. Higher-influence families field stronger candidates by default.
 */
export function calcRivalElectionScore(rival: ElectionRival): number {
  return Math.round(30 + rival.clanInfluence * 0.4);
}

// ─── Generate rivals ──────────────────────────────────────────────────────────

export function generateRivals(officeId: OfficeId, state: GameState): ElectionRival[] {
  const officeIdx = OFFICES.findIndex(o => o.id === officeId);
  const count = officeIdx >= 4 ? 3 : 2;

  const pool = state.clans.flatMap(c =>
    c.leaders
      .filter(l => l.relationship < 30 && l.votes >= 6)
      .map(l => ({
        ...l,
        clanName: c.name,
        clanId: c.id,
        clanInfluence: c.influence,
      }))
  );

  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map(l => ({
      id:           l.id,
      name:         l.name,
      emoji:        l.emoji,
      clanName:     l.clanName,
      clanId:       l.clanId,
      title:        l.title,
      bias:         l.bias,
      baseVotes:    l.votes,
      clanInfluence: l.clanInfluence,
      // strength now represents the influence-based election score
      strength: Math.round(30 + l.clanInfluence * 0.4),
    }));
}

// ─── Clan votes (legacy helper, retained for any backward-compatible callers) ──

export function calcClanVotesForPlayer(
  clanId: string,
  state: GameState,
): { forPlayer: number; total: number; prob: number } {
  const clan = state.clans.find(c => c.id === clanId);
  if (!clan) return { forPlayer: 0, total: 0, prob: 0 };

  const totalVotes = clan.leaders.reduce((s, l) => s + l.votes, 0);
  const weightedRel =
    clan.leaders.reduce((s, l) => s + l.relationship * l.votes, 0) / totalVotes;
  const prob = clamp(0.05, 0.95, 0.5 + weightedRel / 130);
  const forPlayer = Math.round(totalVotes * prob);
  return { forPlayer, total: totalVotes, prob };
}

// ─── Resolve election ─────────────────────────────────────────────────────────

export function resolveElection(state: GameState): {
  won: boolean;
  playerVotes: number;
  topRivalName: string;
  topRivalVotes: number;
} {
  // Player: base + client bonuses + canvassed leaders + small luck factor
  const playerBase = calcPlayerElectionScore(state);
  const wordOfMouth = Math.round(Math.random() * 8);
  const playerTotal = playerBase + wordOfMouth;

  // Rivals: influence-based score + small noise
  const rivalResults = state.electionRivals.map(r => ({
    name: r.name,
    votes: Math.round(30 + r.clanInfluence * 0.4 + (Math.random() * 8 - 4)),
  }));
  const topRival = rivalResults.sort((a, b) => b.votes - a.votes)[0];

  return {
    won:           !topRival || playerTotal > topRival.votes,
    playerVotes:   playerTotal,
    topRivalName:  topRival?.name ?? 'unknown',
    topRivalVotes: topRival?.votes ?? 0,
  };
}
