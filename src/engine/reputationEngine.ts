import { REPUTATION_THRESHOLDS, ReputationThreshold } from '../data/reputationThresholds';
import type { ClanStanding } from '../models/clan';
import type { ElectionRival } from '../models/office';

export function getReputationTier(score: number): ReputationThreshold {
  const sorted = [...REPUTATION_THRESHOLDS].sort((a, b) => b.score - a.score);
  return sorted.find(t => score >= t.score) ?? REPUTATION_THRESHOLDS[0];
}

export function adjustReputation(
  current: number,
  delta: number,
): { newScore: number; crossedThreshold: ReputationThreshold | null } {
  const clamped = Math.max(-100, Math.min(100, current + delta));
  const oldTier = getReputationTier(current);
  const newTier = getReputationTier(clamped);
  const crossedThreshold = oldTier.label !== newTier.label ? newTier : null;
  return { newScore: clamped, crossedThreshold };
}

export function getUnlockedReputationActions(score: number): string[] {
  return getReputationTier(score).unlockedActions;
}

// ─── Forum "gens" badge (ally / neutral / hostile / rival) ───────────────────
// Derived from familyReputations, not stored — keeps the badge and the
// Reputation Bar tier directly below it always in sync. 'rival' overrides the
// reputation-based label whenever the clan is currently fielding a candidate
// against the player (see electionEngine.generateRivals).
// ─── Forum action → family reputation ────────────────────────────────────────
// Converts a flat relationship gain with one leader into a family-reputation
// swing for their whole clan, weighted by that leader's share of the clan's
// total voting bloc — winning over a clan's most powerful leader moves the
// family's standing with the whole gens much more than winning over a minor one.
export function computeReputationDelta(
  relationshipDelta: number,
  leaderVotes: number,
  clanTotalVotes: number,
): number {
  if (clanTotalVotes <= 0) return 0;
  return Math.round(relationshipDelta * (leaderVotes / clanTotalVotes));
}

export function getClanStanding(
  clanId: string,
  familyReputations: Record<string, number>,
  electionRivals: ElectionRival[],
): ClanStanding {
  if (electionRivals.some(r => r.clanId === clanId)) return 'rival';
  const score = familyReputations[clanId] ?? 0;
  if (score < -10) return 'hostile';
  if (score < 35) return 'neutral';
  return 'ally';
}
