// ─── Election Summit-Curve Evidence Script (Phase 5, Chunk P5-H) ───────────
// Runs src/engine/electionSim.ts's simulateElections across every real
// office band (censor/dictator excluded — confirmed unbuilt, P5-A) under
// two player postures, printing win-rate-by-office-rank. Evidence for
// target #4: "election summit curve holds" — vigintivirate/quaestor should
// read easy, praetor/consul should read as genuine summits (the qualitative
// shape electionEngine.ts's own P2-E comment describes; the exact
// percentage table it references no longer exists in the repo).
//
// Run: npm run sim:elections

// Imported first, deliberately: balance.ts <-> electionEngine.ts (via
// data/offices.ts) form a load-order-dependent circular import — harmless
// under Jest's CJS transform (BALANCE.elections is a pure discoverability
// re-export nothing actually consumes) but a real TDZ crash under tsx's
// stricter ESM semantics if electionEngine.ts is the first thing touched.
// Pulling balance.ts in first here lets the cycle resolve depth-first
// without ever needing a not-yet-initialized binding. Pre-existing repo
// quirk, not something this chunk's BALANCE-only scope should fix.
import '../src/data/balance';
import { simulateElections, type ElectionSimConfig } from '../src/engine/electionSim';
import type { Clan, ClanLeader } from '../src/models/clan';
import type { OfficeId } from '../src/models/office';

const TRIALS = 3000;

function makeLeader(overrides: Partial<ClanLeader>): ClanLeader {
  return {
    id: 'leader', name: 'Rival', title: 'Senator', emoji: '👤', age: 40,
    sphere: 'Senate', relationship: 0, favour: 0, blackmail: false, bias: 'optimates',
    votes: 10, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  };
}

const CLAN_INFLUENCE: Record<string, number> = { cornelii: 85, valerii: 60, fabii: 70, claudii: 75 };

// A moderately-sized, stat-varied rival pool per office band (6 candidates,
// spread across the 4 starting clans, rhetoric 4-9) — deliberately NOT a
// fresh-game STARTING_CLANS snapshot (which has zero leaders eligible for
// aedile+ at turn 1, since nobody holds a prerequisite office yet) and
// deliberately more than 4 candidates: with exactly 4 rivals and 6-8 seats
// (vigintivirate/quaestor), a win is guaranteed by seat math alone regardless
// of vote totals — an artifact of pool size, not a real difficulty signal.
function rivalField(officeId: OfficeId, heldOffices: string[], minAge: number): Clan[] {
  const clanIds = ['cornelii', 'valerii', 'fabii', 'claudii'];
  const rhetoricSpread = [4, 5, 6, 7, 8, 9];
  const leadersByClannish = rhetoricSpread.map((rhetoric, i) => ({
    clanId: clanIds[i % clanIds.length],
    leader: makeLeader({
      id: `rival-${i}`,
      age: minAge + 2 + i,
      skills: { rhetoric, martial: 5, intrigus: 5 },
      heldOffices,
    }),
  }));
  return clanIds.map(clanId => makeClan(
    clanId, CLAN_INFLUENCE[clanId],
    leadersByClannish.filter(l => l.clanId === clanId).map(l => l.leader),
  ));
}

function makeClan(id: string, influence: number, leaders: ClanLeader[]): Clan {
  return { id, name: `Gens ${id}`, gensName: id, sigil: '🏛️', influence, desc: '', leaders };
}

// [officeId, minAge, heldOffices prerequisite chain]. Tribune deliberately
// excluded — confirmed via gameStore.ts's endSeason that Tribune candidacy
// resolves through a wholly separate mechanism (state.tribuneCandidateId,
// a plebs-mood-scaled success-chance roll), never through
// state.campaigning/resolveElection at all; running it through this harness
// produced a meaningless 0-vote/0% result and would misreport a non-issue.
const BANDS: [OfficeId, number, string[]][] = [
  ['vigintivirate', 18, []],
  ['quaestor',      30, []],
  ['aedile',        36, ['quaestor']],
  ['praetor',       39, ['quaestor', 'aedile']],
  ['consul',        42, ['quaestor', 'aedile', 'praetor']],
];

function run(label: string, playerState: ElectionSimConfig['playerState']) {
  console.log(`\n=== ${label} ===`);
  console.log('office'.padEnd(16), 'winRate', 'contested', 'medPlayerVotes', 'medRivalVotes');
  for (const [officeId, minAge, heldOffices] of BANDS) {
    const clans = rivalField(officeId, heldOffices, minAge);
    const result = simulateElections({ officeId, clans, playerState }, TRIALS);
    console.log(
      officeId.padEnd(16),
      result.winRate.toFixed(3),
      result.contestedRate.toFixed(3),
      result.medianPlayerVotes.toFixed(1).padStart(8),
      result.medianTopRivalVotes.toFixed(1).padStart(8),
    );
  }
}

run('No investment (base score + word of mouth only)', {});

run('Light investment (canvass the 2 weakest rivals)', {
  campaignVotes: { 'rival-0': 'for', 'rival-1': 'for' },
});

run('Heavy investment (canvass 4 rivals + 2 votingSway clients + Grand Games)', {
  campaignVotes: { 'rival-0': 'for', 'rival-1': 'for', 'rival-2': 'for', 'rival-3': 'for' },
  clients: [
    { id: 'cl1', name: 'A', type: 'votingSway', flavourTitle: '', flavourText: '', bonus: { votingSwayBonus: 3 }, acquiredTurn: 1 },
    { id: 'cl2', name: 'B', type: 'votingSway', flavourTitle: '', flavourText: '', bonus: { votingSwayBonus: 3 }, acquiredTurn: 1 },
  ] as any,
  grandGamesVoteBonus: 10,
});

console.log('\nDone.');
