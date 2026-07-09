import type { ClanLeader, Clan } from '../src/models/clan';
import {
  calcNpcElectionScore,
  getCanvassFidesCost,
  generateRivals,
  resolveElection,
  CANVASS_FIDES_COST,
  RIVAL_STRENGTH_BY_OFFICE_RANK,
} from '../src/engine/electionEngine';

// ─── P2-E — summit-curve levers (FIRST-PASS / unverified — see balance.ts) ──
// These tests check the levers are wired correctly, not that they hit the
// plan's target win-rate percentages (no simulation harness was built).

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

describe('calcNpcElectionScore — rank multiplier', () => {
  test('is unscaled when no officeId is passed (backward compatible)', () => {
    const leader = makeLeader();
    expect(calcNpcElectionScore(leader, 50)).toBe(calcNpcElectionScore(leader, 50, undefined));
  });

  test('consul scores higher than vigintivirate for an identical leader', () => {
    const leader = makeLeader();
    const vigintivirateScore = calcNpcElectionScore(leader, 50, 'vigintivirate');
    const consulScore = calcNpcElectionScore(leader, 50, 'consul');
    expect(consulScore).toBeGreaterThan(vigintivirateScore);
  });

  test('unrecognised officeId falls back to an unscaled (×1.0) score', () => {
    const leader = makeLeader();
    expect(calcNpcElectionScore(leader, 50, 'not-a-real-office' as any))
      .toBe(calcNpcElectionScore(leader, 50));
  });
});

describe('getCanvassFidesCost — office band scaling', () => {
  test('null campaigning context falls back to the flat cost', () => {
    expect(getCanvassFidesCost(null)).toBe(CANVASS_FIDES_COST);
  });

  test('consul costs more to canvass for than vigintivirate', () => {
    expect(getCanvassFidesCost('consul')).toBeGreaterThan(getCanvassFidesCost('vigintivirate'));
  });
});

describe('generateRivals — displayed strength reflects office context', () => {
  test('the same leader shows higher strength when displayed for a higher office', () => {
    // Qualifies for both vigintivirate (no prereq) and consul (prereq: praetor).
    const leader = makeLeader({ age: 42, heldOffices: ['quaestor', 'aedile', 'praetor'] });
    const clan = makeClan({ leaders: [leader] });
    const state: any = { clans: [clan] };

    const vigintivirateRivals = generateRivals('vigintivirate', state);
    const consulRivals = generateRivals('consul', state);

    expect(vigintivirateRivals[0].strength).toBeLessThan(consulRivals[0].strength);
  });
});

describe('resolveElection — office rank feeds through to NPC vote totals', () => {
  const originalRandom = Math.random;
  beforeEach(() => { Math.random = () => 0.5; }); // deterministic mid-roll noise
  afterEach(() => { Math.random = originalRandom; });

  function makeElectionState(campaigning: string) {
    // heldOffices/age qualify this leader for both vigintivirate (no prereq)
    // and consul (prereq: praetor) — isolates the rank multiplier's effect
    // from prestige, which is identical (based on held praetor) in both cases.
    const leader = makeLeader({ age: 42, heldOffices: ['quaestor', 'aedile', 'praetor'] });
    return {
      campaigning,
      clients: [],
      clans: [makeClan({ leaders: [leader] })],
      campaignVotes: {},
      flags: {},
      grandGamesVoteBonus: 0,
      crisis: { constitution: { level: 0 } },
    } as any;
  }

  test('an identical rival scores higher votes in a consul race than a vigintivirate race', () => {
    const vigintivirateResult = resolveElection(makeElectionState('vigintivirate'));
    const consulResult = resolveElection(makeElectionState('consul'));
    expect(consulResult.topRivalVotes).toBeGreaterThan(vigintivirateResult.topRivalVotes);
  });
});

describe('RIVAL_STRENGTH_BY_OFFICE_RANK data sanity', () => {
  test('multipliers are non-decreasing across the Cursus ladder', () => {
    const r = RIVAL_STRENGTH_BY_OFFICE_RANK;
    expect(r.vigintivirate).toBeLessThanOrEqual(r.quaestor);
    expect(r.quaestor).toBeLessThanOrEqual(r.aedile);
    expect(r.aedile).toBeLessThanOrEqual(r.praetor);
    expect(r.praetor).toBeLessThanOrEqual(r.consul);
  });
});
