import {
  getReputationTier,
  adjustReputation,
  getUnlockedReputationActions,
  getClanStanding,
  computeReputationDelta,
  deriveRelationshipAnchor,
  applyYearlyRelationshipDecay,
  ageAndProcessMortality,
} from '../src/engine/reputationEngine';
import { calcPlayerElectionScore, resolveElection } from '../src/engine/electionEngine';
import type { ElectionRival } from '../src/models/office';
import type { Clan, ClanLeader } from '../src/models/clan';

function makeRival(clanId: string): ElectionRival {
  return {
    id: `rival-${clanId}`, name: 'Rival', emoji: '🎭', clanName: clanId, clanId, title: 'Candidate',
    bias: 'optimates', baseVotes: 10, clanInfluence: 50, strength: 40, highestOffice: null,
  };
}

function makeLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
  return {
    id: 'leader-1', name: 'L. Testius', title: 'Senator', emoji: '👤', age: 55,
    sphere: 'Senate', relationship: 20, favour: 0, blackmail: false, bias: 'optimates',
    votes: 10, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  };
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'testii', name: 'Gens Testia', gensName: 'Testius', sigil: '🏛️',
    influence: 50, desc: '', leaders: [makeLeader()],
    ...overrides,
  };
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

// ─── P2-D: Relationship anchors ──────────────────────────────────────────────

describe('deriveRelationshipAnchor', () => {
  test('precedence: marriage > alliance > default > hostile', () => {
    expect(deriveRelationshipAnchor(makeLeader({ married: true, alliance: true, relationship: 5 }))).toBe(55);
    expect(deriveRelationshipAnchor(makeLeader({ married: false, alliance: true, relationship: 5 }))).toBe(40);
    expect(deriveRelationshipAnchor(makeLeader({ married: false, alliance: false, relationship: 50 }))).toBe(25);
    expect(deriveRelationshipAnchor(makeLeader({ married: false, alliance: false, relationship: 5 }))).toBe(15);
  });

  test('hostile boundary is exactly relationship < 25', () => {
    expect(deriveRelationshipAnchor(makeLeader({ relationship: 24 }))).toBe(15);
    expect(deriveRelationshipAnchor(makeLeader({ relationship: 25 }))).toBe(25);
  });
});

describe('applyYearlyRelationshipDecay', () => {
  test('positive default-anchored relationship decays down toward 25, never below', () => {
    const clans = [makeClan({ leaders: [makeLeader({ relationship: 40 })] })];
    const result = applyYearlyRelationshipDecay(clans);
    expect(result[0].leaders[0].relationship).toBe(37); // 40 - 3

    const atFloor = applyYearlyRelationshipDecay([makeClan({ leaders: [makeLeader({ relationship: 26 })] })]);
    expect(atFloor[0].leaders[0].relationship).toBe(25); // clamped, not 23
  });

  test('a married leader below the marriage anchor drifts UP toward 55', () => {
    const clans = [makeClan({ leaders: [makeLeader({ married: true, relationship: 30 })] })];
    const result = applyYearlyRelationshipDecay(clans);
    expect(result[0].leaders[0].relationship).toBe(33); // 30 + 3, drifting up toward 55
  });

  test('an allied leader above the alliance anchor drifts down, never below it', () => {
    const clans = [makeClan({ leaders: [makeLeader({ alliance: true, relationship: 41 })] })];
    const result = applyYearlyRelationshipDecay(clans);
    expect(result[0].leaders[0].relationship).toBe(40);
  });

  test('hostile-anchored leaders only drift down toward 15, never up', () => {
    // Above the hostile anchor (20 > 15) — cools further toward 15.
    const above = applyYearlyRelationshipDecay([makeClan({ leaders: [makeLeader({ relationship: 20 })] })]);
    expect(above[0].leaders[0].relationship).toBe(17);

    // Below the hostile anchor (5 < 15) — must NOT warm toward 15.
    const below = applyYearlyRelationshipDecay([makeClan({ leaders: [makeLeader({ relationship: 5 })] })]);
    expect(below[0].leaders[0].relationship).toBe(5);

    // Deeply negative — stays put, does not drift toward 0 or 15.
    const negative = applyYearlyRelationshipDecay([makeClan({ leaders: [makeLeader({ relationship: -20 })] })]);
    expect(negative[0].leaders[0].relationship).toBe(-20);
  });

  test('a leader exactly at their anchor does not move', () => {
    const result = applyYearlyRelationshipDecay([makeClan({ leaders: [makeLeader({ relationship: 25 })] })]);
    expect(result[0].leaders[0].relationship).toBe(25);
  });
});

// ─── P2-D: Leader aging + mortality + succession ─────────────────────────────

describe('ageAndProcessMortality', () => {
  const originalRandom = Math.random;
  afterEach(() => { Math.random = originalRandom; });

  test('every leader ages by exactly 1', () => {
    Math.random = () => 0.999; // never rolls death
    const clans = [makeClan({ leaders: [makeLeader({ age: 40 }), makeLeader({ id: 'leader-2', age: 60 })] })];
    const { clans: result, death } = ageAndProcessMortality(clans);
    expect(death).toBeNull();
    expect(result[0].leaders[0].age).toBe(41);
    expect(result[0].leaders[1].age).toBe(61);
  });

  test('under-50 leaders never die', () => {
    Math.random = () => 0; // would roll death at any nonzero chance
    // Aging happens before the mortality roll: 48 -> 49, still under the 50 band.
    const clans = [makeClan({ leaders: [makeLeader({ age: 48 })] })];
    const { death } = ageAndProcessMortality(clans);
    expect(death).toBeNull();
  });

  test('a guaranteed death produces a valid successor and death record', () => {
    Math.random = () => 0; // guarantees death for any leader >= 50, and picks bias/praenomen deterministically
    const predecessor = makeLeader({
      id: 'old-leader', name: 'Q. Testius Senex', age: 79, votes: 20, relationship: 60,
      married: true, bias: 'military',
    });
    const clans = [makeClan({ leaders: [predecessor] })];
    const { clans: result, death } = ageAndProcessMortality(clans);

    expect(death).not.toBeNull();
    expect(death!.deadLeaderName).toBe('Q. Testius Senex');
    expect(death!.hadBond).toBe(true);

    const successor = result[0].leaders[0];
    expect(successor.id).not.toBe('old-leader');
    expect(successor.name).toContain('Testius'); // clan gens name
    expect(successor.age).toBeGreaterThanOrEqual(32);
    expect(successor.age).toBeLessThanOrEqual(45);
    expect(successor.votes).toBe(Math.round(20 * 0.7));
    expect(successor.married).toBe(false); // bond does not carry over
    expect(successor.alliance).toBe(false);
    expect(successor.blackmail).toBe(false);
    expect(successor.proscribed).toBe(false);
    expect(successor.heldOffices).toEqual([]);
  });

  test('successor relationship is clamped to at least their own derived anchor', () => {
    Math.random = () => 0;
    // predecessor relationship 10 -> raw successor relationship round(10*0.4)=4,
    // which is below the successor's own hostile anchor (15) since the
    // successor starts unmarried/unallied — must clamp up to 15, not stay at 4.
    const predecessor = makeLeader({ id: 'old-leader', age: 90, relationship: 10, votes: 10 });
    const clans = [makeClan({ leaders: [predecessor] })];
    const { clans: result } = ageAndProcessMortality(clans);
    expect(result[0].leaders[0].relationship).toBe(15);
  });

  test('Phase 4, P4-E — a successor rolls a trait and its skillModifiers apply (rng=0 -> first pool entry, sharp_mind)', () => {
    Math.random = () => 0; // guarantees death, and rollLeaderTrait's 65% gate + pool index both resolve deterministically
    const predecessor = makeLeader({ id: 'old-leader', age: 79, skills: { rhetoric: 5, martial: 5, intrigus: 5 } });
    const clans = [makeClan({ leaders: [predecessor] })];
    const { clans: result } = ageAndProcessMortality(clans);
    const successor = result[0].leaders[0];
    expect(successor.traits).toEqual(['sharp_mind']);
    // sharp_mind: { intrigus: 3, rhetoric: 2 } per data/traits.ts
    expect(successor.skills.rhetoric).toBe(7);
    expect(successor.skills.intrigus).toBe(8);
    expect(successor.skills.martial).toBe(5); // untouched
  });

  test('at most one death per year, keeping the eldest when multiple roll', () => {
    Math.random = () => 0; // both would die
    const younger = makeLeader({ id: 'younger', name: 'Younger', age: 60 });
    const elder = makeLeader({ id: 'elder', name: 'Elder', age: 85 });
    const clans = [makeClan({ id: 'clan-a', leaders: [younger] }), makeClan({ id: 'clan-b', leaders: [elder] })];
    const { clans: result, death } = ageAndProcessMortality(clans);

    expect(death!.deadLeaderName).toBe('Elder');
    // The younger leader survives this year (just aged, not replaced).
    const survivingYounger = result.find(c => c.id === 'clan-a')!.leaders[0];
    expect(survivingYounger.id).toBe('younger');
    expect(survivingYounger.age).toBe(61);
  });
});

// ─── P2-D: election engine tolerates a canvassed-then-dead leader ───────────

describe('election engine does not crash on a dangling canvassed leader ID', () => {
  test('calcPlayerElectionScore ignores a campaignVotes entry for a leader no longer in state.clans', () => {
    const state: any = {
      clients: [],
      clans: [makeClan({ leaders: [makeLeader({ id: 'survivor', votes: 5 })] })],
      campaignVotes: { 'dead-leader-id': 'for', survivor: 'for' },
    };
    expect(() => calcPlayerElectionScore(state)).not.toThrow();
    // Only the surviving leader's votes count; the dangling id contributes nothing.
    const score = calcPlayerElectionScore(state);
    expect(score).toBe(25 + 5); // PLAYER_BASE_SCORE + survivor's 5 votes
  });

  test('resolveElection does not throw when campaignVotes references a dead leader', () => {
    const state: any = {
      campaigning: 'quaestor',
      clients: [],
      clans: [makeClan({ leaders: [makeLeader({ id: 'survivor', age: 40, votes: 5, heldOffices: [] })] })],
      campaignVotes: { 'dead-leader-id': 'for' },
      flags: {},
      crisis: { constitution: { level: 0 } },
    };
    expect(() => resolveElection(state)).not.toThrow();
  });
});
