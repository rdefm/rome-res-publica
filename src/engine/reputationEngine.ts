import { REPUTATION_THRESHOLDS, ReputationThreshold } from '../data/reputationThresholds';

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
