// ─── Command Engine ──────────────────────────────────────────────────────────
// Campaign Map plan, Chunk C4 — pure functions for the theatre command's
// extraordinary assembly. A NEW, PARALLEL track to electionEngine.ts's
// Winter magistracy elections — see models/command.ts's header comment for
// why (electionEngine's resolveElection/campaignVotes/electionRivals are
// single global fields hard-coupled to one `campaigning: OfficeId | null`
// slot; a Command isn't a real OfficeId). Reuses electionEngine's genuinely
// shape-agnostic pieces directly (calcNpcElectionScore, getHighestOffice,
// PLAYER_BASE_SCORE, CANVASS_MIN_RELATIONSHIP, calcCanvassRoll) rather than
// re-deriving them — only the state-shaped parts (resolveElection itself,
// calcPlayerElectionScore) are ported instead of shared, since they
// hardcode GameState field names this track doesn't use.
//
// No store/React access. Math.random() default RNG params (not seeded) —
// matches every other non-battle strategic-layer engine in this codebase
// (see battle/musterEngine.ts's offerableLegates comment for the precedent).

import type { Character } from '../models/character';
import type { Clan } from '../models/clan';
import type { ElectionRival } from '../models/office';
import type { Command, CommandElectionState } from '../models/command';
import type { WarState } from '../models/war';
import { OFFICES } from '../data/offices';
import { BALANCE } from '../data/balance';
import {
  calcNpcElectionScore,
  getHighestOffice,
  PLAYER_BASE_SCORE,
  CANVASS_MIN_RELATIONSHIP,
  calcCanvassRoll,
} from './electionEngine';

// ─── Eligibility ──────────────────────────────────────────────────────────────

/** Mirrors consulship's age floor (per the plan's own instruction) by
 *  reading it live off offices.ts rather than duplicating the number in
 *  BALANCE — the two can never drift apart. */
export function commandMinAge(): number {
  return OFFICES.find(o => o.id === 'consul')?.minAge ?? 42;
}

export function isEligibleForCommand(character: Character): boolean {
  return character.age >= commandMinAge();
}

/** The command may only be proposed while the Punic War is active — reads
 *  the same WarState the rest of Phase 3's war model uses (models/war.ts). */
export function isWarActiveForCommand(wars: WarState[]): boolean {
  return wars.some(w => w.enemyId === 'carthage' && w.active);
}

// ─── Rivals ───────────────────────────────────────────────────────────────────

/** Builds one ElectionRival entry from a known leader id — exported so
 *  callers can unconditionally include a specific leader (the prorogation
 *  incumbent) regardless of whether generateCommandRivals's top-N cut would
 *  have selected them on influence alone. Returns null if the id doesn't
 *  resolve to any clan's leader (e.g. they died). */
export function buildRivalEntry(clans: Clan[], leaderId: string): ElectionRival | null {
  for (const clan of clans) {
    const leader = clan.leaders.find(l => l.id === leaderId);
    if (leader) {
      return {
        id: leader.id,
        name: leader.name,
        emoji: leader.emoji,
        clanName: clan.name,
        clanId: clan.id,
        title: leader.title,
        bias: leader.bias as string,
        baseVotes: leader.votes,
        clanInfluence: clan.influence,
        strength: calcNpcElectionScore(leader, clan.influence),
        highestOffice: getHighestOffice(leader.heldOffices),
      };
    }
  }
  return null;
}

/** Top BALANCE.campaign.command.rivalCount clan leaders by clan influence,
 *  age-eligible and not proscribed. Deliberately does NOT reuse
 *  isNpcEligibleForOffice's currentOffice/heldOffices exclusions — a
 *  Command "coexists with magistracies" (the plan's own invariant), so a
 *  sitting magistrate is a perfectly valid rival here, unlike an ordinary
 *  office election. `excludeLeaderId`, if given, is dropped from the pool
 *  before the top-N cut — used when the caller is about to prepend a
 *  specific leader (the prorogation incumbent) itself, so they aren't
 *  double-counted. */
export function generateCommandRivals(clans: Clan[], excludeLeaderId?: string | null): ElectionRival[] {
  const minAge = commandMinAge();
  const candidates = clans
    .flatMap(clan => clan.leaders
      .filter(l => !l.proscribed && l.age >= minAge && l.id !== excludeLeaderId)
      .map(leader => ({ leader, clan })))
    .sort((a, b) => b.clan.influence - a.clan.influence)
    .slice(0, BALANCE.campaign.command.rivalCount);

  return candidates.map(({ leader, clan }) => buildRivalEntry([clan], leader.id)!);
}

// ─── Canvassing ───────────────────────────────────────────────────────────────

export const COMMAND_CANVASS_MIN_RELATIONSHIP = CANVASS_MIN_RELATIONSHIP;

export function commandCanvassFidesCost(): number {
  return BALANCE.campaign.command.canvassFidesCost;
}

export function commandCanvassThreshold(): number {
  return BALANCE.campaign.command.canvassThreshold;
}

export function rollCommandCanvass(rhetoric: number, relationship: number): number {
  return calcCanvassRoll(rhetoric, relationship); // same formula, no office-band scaling to apply
}

// ─── Prorogation modifier ─────────────────────────────────────────────────────

export function calcProrogationModifier(battlesWon: number, battlesLost: number): number {
  const { prorogationPerBattle, prorogationModifierClamp } = BALANCE.campaign.command;
  const raw = (battlesWon - battlesLost) * prorogationPerBattle;
  return Math.min(prorogationModifierClamp, Math.max(-prorogationModifierClamp, raw));
}

// ─── Resolution ───────────────────────────────────────────────────────────────

export interface CommandElectionResult {
  /** True only when the WINNER is the player-side candidate. */
  won: boolean;
  winnerCharacterId: string | null;
  winnerRivalId: string | null;
  winnerName: string;
  /** True for a prorogation vote whose winner is the SAME side that already
   *  held the command — the caller top-ups in place rather than granting
   *  fresh rewards. Always false for a non-prorogation vote. */
  retainedByIncumbent: boolean;
  playerScore: number | null;
  topRivalName: string;
  topRivalScore: number;
}

/** Ports (does not call) electionEngine.resolveElection's player-score shape
 *  — same formula (base + voting-sway clients + locked-for bloc votes +
 *  0–8 word-of-mouth), reading `election.votes` instead of
 *  GameState.campaignVotes since that field doesn't exist on this track. */
export function resolveCommandElection(
  election: CommandElectionState,
  clans: Clan[],
  votingSwayBonus: number,
  rng: () => number = Math.random,
): CommandElectionResult {
  const allLeaders = clans.flatMap(c => c.leaders);

  const lockedFor = allLeaders
    .filter(l => election.votes[l.id] === 'for')
    .reduce((sum, l) => sum + l.votes, 0);
  const wordOfMouth = Math.round(rng() * 8);
  const incumbentBonusForPlayer = election.incumbentIsPlayerCandidate ? election.incumbentWinLossModifier : 0;

  const playerScore = election.candidateCharacterId
    ? PLAYER_BASE_SCORE + votingSwayBonus + lockedFor + wordOfMouth + incumbentBonusForPlayer
    : null;

  const rivalScores = election.rivals.map(rival => {
    const leader = allLeaders.find(l => l.id === rival.id);
    const clan = clans.find(c => c.leaders.some(l => l.id === rival.id));
    const base = leader && clan ? calcNpcElectionScore(leader, clan.influence) : rival.strength;
    const jitter = Math.round(rng() * 8 - 4);
    const incumbentBonus = rival.id === election.incumbentRivalId ? election.incumbentWinLossModifier : 0;
    return { id: rival.id, name: rival.name, score: base + jitter + incumbentBonus };
  });

  const topRival = [...rivalScores].sort((a, b) => b.score - a.score)[0] ?? null;
  const scoresConsidered = [playerScore, ...rivalScores.map(r => r.score)].filter((v): v is number => v !== null);
  const winnerScore = scoresConsidered.length > 0 ? Math.max(...scoresConsidered) : -Infinity;

  const playerWins = playerScore !== null && playerScore >= winnerScore;
  // ties favour the player, mirroring resolveElection's array-order-first
  // (playerTotal is placed before npcResults, so an exact-tie indexOf finds
  // the player first) tie-break convention.

  const wasIncumbentPlayer = election.incumbentIsPlayerCandidate;
  const wasIncumbentRivalId = election.incumbentRivalId;

  if (playerWins) {
    return {
      won: true,
      winnerCharacterId: election.candidateCharacterId,
      winnerRivalId: null,
      winnerName: '',
      retainedByIncumbent: election.isProrogation && wasIncumbentPlayer,
      playerScore,
      topRivalName: topRival?.name ?? '',
      topRivalScore: topRival?.score ?? 0,
    };
  }

  const winner = rivalScores.find(r => r.score === winnerScore) ?? topRival;
  return {
    won: false,
    winnerCharacterId: null,
    winnerRivalId: winner?.id ?? null,
    winnerName: winner?.name ?? '',
    retainedByIncumbent: election.isProrogation && !!winner && winner.id === wasIncumbentRivalId,
    playerScore,
    topRivalName: topRival?.name ?? '',
    topRivalScore: topRival?.score ?? 0,
  };
}
