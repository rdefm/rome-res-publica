import { deriveStage, computeStagePace, computeAllStagePace } from '../src/engine/actionEconomyEngine';
import { BALANCE } from '../src/data/balance';
import type { SeasonStats } from '../src/models/telemetry';

function mkSeason(overrides: Partial<SeasonStats> = {}): SeasonStats {
  return {
    turnNumber: 1, durationSec: 60, meaningfulActions: 4,
    fidesIncome: 20, fidesSpent: 10, denariiIncome: 20, denariiSpent: 10,
    patronTierAtEnd: 0,
    ...overrides,
  };
}

describe('deriveStage', () => {
  test('tiers 0-1 are early, 2-3 mid, 4-5 late', () => {
    expect(deriveStage(0)).toBe('early');
    expect(deriveStage(1)).toBe('early');
    expect(deriveStage(2)).toBe('mid');
    expect(deriveStage(3)).toBe('mid');
    expect(deriveStage(4)).toBe('late');
    expect(deriveStage(5)).toBe('late');
  });
});

describe('computeStagePace', () => {
  test('returns null when no seasons match the stage', () => {
    expect(computeStagePace([], 'early')).toBeNull();
    expect(computeStagePace([mkSeason({ patronTierAtEnd: 4 })], 'early')).toBeNull();
  });

  test('averages only the last 10 seasons of the given stage', () => {
    const history = [
      ...Array.from({ length: 12 }, (_, i) => mkSeason({ meaningfulActions: 100, patronTierAtEnd: 0 })), // stale, should be dropped
      ...Array.from({ length: 3 }, () => mkSeason({ meaningfulActions: 4, patronTierAtEnd: 0 })),
    ];
    // Only the last 10 of the 15 total early-stage entries should count;
    // the last 3 are all meaningfulActions=4, so if any of the 100-value
    // entries leaked in, the average would be far above 4.
    const summary = computeStagePace(history, 'early');
    expect(summary).not.toBeNull();
    expect(summary!.sampleSize).toBe(10);
  });

  test('flags actionsOutOfBand when the average falls outside the stage band', () => {
    const history = Array.from({ length: 5 }, () => mkSeason({ meaningfulActions: 1, patronTierAtEnd: 0 }));
    const summary = computeStagePace(history, 'early')!;
    expect(summary.actionBand).toEqual(BALANCE.actionEconomy.actionBand.early);
    expect(summary.actionsOutOfBand).toBe(true);
  });

  test('does not flag when the average is within band', () => {
    const history = Array.from({ length: 5 }, () => mkSeason({ meaningfulActions: 3.5, patronTierAtEnd: 0 }));
    const summary = computeStagePace(history, 'early')!;
    expect(summary.actionsOutOfBand).toBe(false);
  });

  test('flags anyOverTimeBudget when any season in the sample exceeds the time cap', () => {
    const history = [
      mkSeason({ patronTierAtEnd: 0, durationSec: 60 }),
      mkSeason({ patronTierAtEnd: 0, durationSec: BALANCE.actionEconomy.maxSeasonDurationSec + 1 }),
    ];
    const summary = computeStagePace(history, 'early')!;
    expect(summary.anyOverTimeBudget).toBe(true);
  });

  test('buckets seasons by their own patronTierAtEnd snapshot, not the live/current tier', () => {
    const history = [
      mkSeason({ patronTierAtEnd: 0, meaningfulActions: 3 }),
      mkSeason({ patronTierAtEnd: 4, meaningfulActions: 7 }),
    ];
    expect(computeStagePace(history, 'early')!.avgActions).toBe(3);
    expect(computeStagePace(history, 'late')!.avgActions).toBe(7);
    expect(computeStagePace(history, 'mid')).toBeNull();
  });
});

describe('computeAllStagePace', () => {
  test('returns only stages with recorded history', () => {
    const history = [mkSeason({ patronTierAtEnd: 0 }), mkSeason({ patronTierAtEnd: 5 })];
    const summaries = computeAllStagePace(history);
    expect(summaries.map(s => s.stage).sort()).toEqual(['early', 'late']);
  });

  test('empty history returns an empty array', () => {
    expect(computeAllStagePace([])).toEqual([]);
  });
});
