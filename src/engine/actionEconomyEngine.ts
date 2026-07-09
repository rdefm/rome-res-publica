// ─── Action Economy Engine (P2-E) ────────────────────────────────────────────
// Pure functions turning seasonStatsHistory into the Pace panel's numbers.
// No React/UI imports — DebugPanel.tsx calls these and renders the result.

import type { SeasonStats } from '../models/telemetry';
import { BALANCE } from '../data/balance';

export type ActionEconomyStage = 'early' | 'mid' | 'late';

/**
 * Stage is derived from Patron Tier alone: the plan's early/mid/late bands
 * (0-1 / 2-3 / 4-5) partition the six tiers with no gaps or overlap, so no
 * separate year/governorship signal is needed.
 */
export function deriveStage(patronTier: number): ActionEconomyStage {
  if (patronTier <= 1) return 'early';
  if (patronTier <= 3) return 'mid';
  return 'late';
}

export interface StagePaceSummary {
  stage: ActionEconomyStage;
  /** Number of seasons averaged (last 10 in this stage, or fewer if not enough history). */
  sampleSize: number;
  avgDurationSec: number;
  avgActions: number;
  avgFidesIncome: number;
  avgFidesSpent: number;
  avgDenariiIncome: number;
  avgDenariiSpent: number;
  actionBand: [number, number];
  /** True if avgActions falls outside actionBand. */
  actionsOutOfBand: boolean;
  /** True if any season in the sample exceeded BALANCE.actionEconomy.maxSeasonDurationSec. */
  anyOverTimeBudget: boolean;
}

function average(entries: SeasonStats[], key: keyof SeasonStats): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, s) => sum + (s[key] as number), 0) / entries.length;
}

/** Last-10 average for one stage, bucketed by each season's own patronTierAtEnd snapshot. */
export function computeStagePace(
  history: SeasonStats[],
  stage: ActionEconomyStage,
): StagePaceSummary | null {
  const inStage = history.filter(s => deriveStage(s.patronTierAtEnd) === stage);
  const last10 = inStage.slice(-10);
  if (last10.length === 0) return null;

  const actionBand = BALANCE.actionEconomy.actionBand[stage];
  const avgActions = average(last10, 'meaningfulActions');

  return {
    stage,
    sampleSize: last10.length,
    avgDurationSec:   average(last10, 'durationSec'),
    avgActions,
    avgFidesIncome:   average(last10, 'fidesIncome'),
    avgFidesSpent:    average(last10, 'fidesSpent'),
    avgDenariiIncome: average(last10, 'denariiIncome'),
    avgDenariiSpent:  average(last10, 'denariiSpent'),
    actionBand,
    actionsOutOfBand: avgActions < actionBand[0] || avgActions > actionBand[1],
    anyOverTimeBudget: last10.some(s => s.durationSec > BALANCE.actionEconomy.maxSeasonDurationSec),
  };
}

/** Pace summaries for every stage that has at least one recorded season. */
export function computeAllStagePace(history: SeasonStats[]): StagePaceSummary[] {
  return (['early', 'mid', 'late'] as const)
    .map(stage => computeStagePace(history, stage))
    .filter((s): s is StagePaceSummary => s !== null);
}
