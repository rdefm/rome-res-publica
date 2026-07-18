// ─── Headless Election Simulation Harness (Phase 5, Chunk P5-H) ────────────
// simulateElections runs N elections through the real resolveElection
// (electionEngine.ts) with no UI, returning aggregate win-rate stats — same
// idiom as engine/battle/battleSim.ts's simulateBattles. Built because no
// such harness existed: electionEngine.ts's own P2-E header comment records
// that Phase 2 "chose first-pass-only tuning... revisit with real data
// before trusting the exact percentages in the plan's target table" — this
// is that revisit. Pure engine code — no state/React imports beyond the
// GameState type.
//
// resolveElection calls Math.random() directly (no injectable RNG param,
// unlike the battle engine), so reproducibility here comes from temporarily
// swapping the global Math.random for a seeded one per trial — the same
// trick electionSummitCurve.test.ts already uses (`Math.random = () => 0.5`
// in a beforeEach), just varied per-trial instead of fixed.

import type { GameState } from '../state/gameStore';
import type { OfficeId } from '../models/office';
import type { Clan } from '../models/clan';
import { resolveElection } from './electionEngine';
import { makeSeededRng } from '../utils/seededRng';

export interface ElectionSimConfig {
  officeId: OfficeId;
  /** The rival field contesting this office — isEligibleForOffice-filtered
   *  internally by resolveElection itself, so an over-inclusive roster
   *  (leaders who don't qualify for this office) is safe to pass. */
  clans: Clan[];
  /** Shallow-merged over a minimal base state. Vary this to represent
   *  different player postures (no canvassing vs. some locked-for votes,
   *  Constitution crisis tier, Grand Games bonus, etc.). */
  playerState?: Partial<GameState>;
}

export interface ElectionSimAggregate {
  trials: number;
  winRate: number;
  medianPlayerRank: number;
  medianPlayerVotes: number;
  medianTopRivalVotes: number;
  contestedRate: number;
}

function percentileOf(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}

/** Runs `n` elections (seeds seedBase..seedBase+n-1) for one office/rival-
 *  field/player-posture combination and returns aggregate stats. */
export function simulateElections(config: ElectionSimConfig, n: number, seedBase: number = 1): ElectionSimAggregate {
  const state = {
    crisisLevel: 0,
    crisis: { war: { level: 0 }, unrest: { level: 0 }, constitution: { level: 0 }, economy: { level: 0 } },
    flags: {},
    grandGamesVoteBonus: 0,
    clients: [],
    campaignVotes: {},
    ...config.playerState,
    campaigning: config.officeId,
    clans: config.clans,
  } as unknown as GameState;

  let wins = 0;
  let contested = 0;
  const ranks: number[] = [];
  const playerVotes: number[] = [];
  const rivalVotes: number[] = [];

  const originalRandom = Math.random;
  try {
    for (let i = 0; i < n; i++) {
      Math.random = makeSeededRng(seedBase + i);
      const result = resolveElection(state);
      if (result.won) wins += 1;
      if (result.contested) contested += 1;
      ranks.push(result.playerRank);
      playerVotes.push(result.playerVotes);
      rivalVotes.push(result.topRivalVotes);
    }
  } finally {
    Math.random = originalRandom;
  }

  ranks.sort((a, b) => a - b);
  playerVotes.sort((a, b) => a - b);
  rivalVotes.sort((a, b) => a - b);

  return {
    trials: n,
    winRate: wins / n,
    medianPlayerRank: percentileOf(ranks, 0.5),
    medianPlayerVotes: percentileOf(playerVotes, 0.5),
    medianTopRivalVotes: percentileOf(rivalVotes, 0.5),
    contestedRate: contested / n,
  };
}
