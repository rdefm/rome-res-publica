import {
  getReputationTier,
  adjustReputation,
  getUnlockedReputationActions,
  getClanStanding,
  computeReputationDelta,
} from '../src/engine/reputationEngine';
import type { ElectionRival } from '../src/models/office';

function makeRival(clanId: string): ElectionRival {
  return { id: `rival-${clanId}`, name: 'Rival', emoji: '🎭', clanName: clanId, clanId, title: 'Candidate' };
}

describe('getReputationTier / adjustReputation', () => {
  test('tiers map to the correct label at each boundary', () => {
    expect(getReputationTier(-100).label).toBe('Blood Enemies');
    expect(getReputationTier(-50).label).toBe('Rivals');
    expect(getReputationTier(-11).label).toBe('Rivals');
    expect(getReputationTier(-10).label).toBe('Cold');
    expect(getReputationTier(9).label).toBe('Cold');
    expect(getReputationTier(10).label).toBe('Neutral');
    expect(getReputationTier(34).label).toBe('Neutral');
    expect(getReputationTier(35).label).toBe('Cordial');
    expect(getReputationTier(60).label).toBe('Trusted Ally');
    expect(getReputationTier(85).label).toBe('Bound by Oath');
    expect(getReputationTier(100).label).toBe('Bound by Oath');
  });

  test('adjustReputation clamps to [-100, 100]', () => {
    expect(adjustReputation(95, 20).newScore).toBe(100);
    expect(adjustReputation(-95, -20).newScore).toBe(-100);
  });

  test('adjustReputation reports a crossed threshold only when the tier label changes', () => {
    const crossing = adjustReputation(30, 10); // Neutral (10) -> Cordial (35)
    expect(crossing.newScore).toBe(40);
    expect(crossing.crossedThreshold?.label).toBe('Cordial');

    const noCrossing = adjustReputation(30, 2); // stays in Neutral
    expect(noCrossing.crossedThreshold).toBeNull();
  });

  test('getUnlockedReputationActions accumulates actions from lower tiers', () => {
    expect(getUnlockedReputationActions(35)).toEqual(['propose_alliance_marriage']);
    expect(getUnlockedReputationActions(85)).toEqual(
      expect.arrayContaining(['propose_alliance_marriage', 'receive_early_warning', 'secret_pact'])
    );
  });
});

describe('getClanStanding', () => {
  test('election rival overrides reputation score entirely', () => {
    const standing = getClanStanding('fabii', { fabii: 90 }, [makeRival('fabii')]);
    expect(standing).toBe('rival');
  });

  test('score < -10 is hostile', () => {
    expect(getClanStanding('fabii', { fabii: -11 }, [])).toBe('hostile');
    expect(getClanStanding('fabii', { fabii: -100 }, [])).toBe('hostile');
  });

  test('-10 <= score < 35 is neutral', () => {
    expect(getClanStanding('fabii', { fabii: -10 }, [])).toBe('neutral');
    expect(getClanStanding('fabii', { fabii: 34 }, [])).toBe('neutral');
  });

  test('score >= 35 is ally', () => {
    expect(getClanStanding('fabii', { fabii: 35 }, [])).toBe('ally');
    expect(getClanStanding('fabii', { fabii: 100 }, [])).toBe('ally');
  });

  test('missing reputation entry defaults to 0 (neutral)', () => {
    expect(getClanStanding('unknown', {}, [])).toBe('neutral');
  });

  test('an election rival in a different clan does not affect this clan', () => {
    expect(getClanStanding('fabii', { fabii: 50 }, [makeRival('cornelii')])).toBe('ally');
  });
});

describe('computeReputationDelta', () => {
  test('weights the relationship delta by the leader\'s share of clan votes', () => {
    // Cornelii-style spread: [18, 12, 8, 5], total 43
    expect(computeReputationDelta(5, 18, 43)).toBe(Math.round(5 * 18 / 43));
    expect(computeReputationDelta(5, 5, 43)).toBe(Math.round(5 * 5 / 43));
  });

  test('a leader holding all of a clan\'s votes gets the full delta', () => {
    expect(computeReputationDelta(20, 10, 10)).toBe(20);
  });

  test('returns 0 when the clan has no votes at all (avoids divide-by-zero)', () => {
    expect(computeReputationDelta(20, 0, 0)).toBe(0);
  });
});
