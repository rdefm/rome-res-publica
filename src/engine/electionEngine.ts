import type { ElectionRival, OfficeId } from '../models/office';
import type { GameState } from '../state/gameStore';
import { OFFICES } from '../data/offices';

export function generateRivals(officeId: OfficeId, state: GameState): ElectionRival[] {
  const officeIdx = OFFICES.findIndex((o) => o.id === officeId);
  const count = officeIdx >= 4 ? 3 : 2;

  const pool = state.clans.flatMap((c) =>
    c.leaders
      .filter((l) => l.relationship < 30 && l.votes >= 6)
      .map((l) => ({
        ...l,
        clanName: c.name,
        clanId: c.id,
        clanInfluence: c.influence,
      }))
  );

  return pool
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
    .map((l) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      clanName: l.clanName,
      clanId: l.clanId,
      title: l.title,
      bias: l.bias,
      baseVotes: l.votes,
      clanInfluence: l.clanInfluence,
      strength: Math.round(
        40 +
          l.clanInfluence * 0.25 +
          (l.bias === 'optimates' ? 8 : l.bias === 'populares' ? 6 : 3)
      ),
    }));
}

function clamp(min: number, max: number, val: number): number {
  return Math.min(max, Math.max(min, val));
}

export function calcClanVotesForPlayer(
  clanId: string,
  state: GameState
): { forPlayer: number; total: number; prob: number } {
  const clan = state.clans.find((c) => c.id === clanId);
  if (!clan) return { forPlayer: 0, total: 0, prob: 0 };

  const totalVotes = clan.leaders.reduce((s, l) => s + l.votes, 0);
  const weightedRel =
    clan.leaders.reduce((s, l) => s + l.relationship * l.votes, 0) / totalVotes;

  const optBonus =
    clan.leaders
      .filter((l) => l.bias === 'optimates')
      .reduce((s) => s + state.optimatesRel * 0.15, 0) /
    Math.max(1, clan.leaders.length);

  const popBonus =
    clan.leaders
      .filter((l) => l.bias === 'populares')
      .reduce((s) => s + state.popularesRel * 0.15, 0) /
    Math.max(1, clan.leaders.length);

  const score = weightedRel + optBonus + popBonus;
  const prob = clamp(0.05, 0.95, 0.5 + score / 130);
  const forPlayer = Math.round(totalVotes * prob);

  return { forPlayer, total: totalVotes, prob };
}

export function calcRivalVotes(rival: ElectionRival, state: GameState): number {
  const rivalClan = state.clans.find((c) => c.id === rival.clanId);
  const { forPlayer, total } = calcClanVotesForPlayer(rival.clanId, state);
  const homeClanAgainst = total - forPlayer;

  const hostileClans = state.clans.filter(
    (c) => (c.standing === 'hostile' || c.standing === 'rival') && c.id !== rival.clanId
  );
  const spillover = hostileClans.reduce((sum, c) => {
    const { total: ct, forPlayer: cfp } = calcClanVotesForPlayer(c.id, state);
    return sum + Math.round(((ct - cfp) * 0.4) / Math.max(1, state.electionRivals.length));
  }, 0);

  return homeClanAgainst + spillover + Math.round(rival.strength * 0.3);
}

export function resolveElection(state: GameState): {
  won: boolean;
  playerVotes: number;
  topRivalName: string;
  topRivalVotes: number;
} {
  // 1. Locked votes from canvassed leaders
  let lockedFor = 0;
  let lockedAgainst = 0;
  state.clans.flatMap((c) => c.leaders).forEach((l) => {
    const cv = state.campaignVotes[l.id];
    if (cv === 'for') lockedFor += l.votes;
    if (cv === 'against') lockedAgainst += l.votes;
  });

  // 2. Probabilistic uncanvassed votes
  const totalVotes = state.clans.flatMap((c) => c.leaders).reduce((s, l) => s + l.votes, 0);
  const canvassed = lockedFor + lockedAgainst;
  const uncanvassed = totalVotes - canvassed;
  const uncanvProb = clamp(
    0.05,
    0.95,
    0.5 + (state.popularesRel + state.optimatesRel) / 260
  );
  const uncanvFor = Math.round(uncanvassed * uncanvProb * (0.8 + Math.random() * 0.4));
  const playerTotal = lockedFor + uncanvFor;

  // 3. Rival totals
  const rivalResults = state.electionRivals.map((r) => ({
    name: r.name,
    votes: calcRivalVotes(r, state),
  }));
  const topRival = rivalResults.sort((a, b) => b.votes - a.votes)[0];

  return {
    won: !topRival || playerTotal > topRival.votes,
    playerVotes: playerTotal,
    topRivalName: topRival?.name ?? 'unknown',
    topRivalVotes: topRival?.votes ?? 0,
  };
}
