import type { ElectionRival, OfficeId } from '../models/office';
import type { Clan, ClanLeader } from '../models/clan';
import type { GameState } from '../state/gameStore';
import { OFFICES } from '../data/offices';
import { getTierFromLevel } from '../models/crisis';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PLAYER_BASE_SCORE        = 25;
export const CANVASS_FIDES_COST       = 3;
export const CANVASS_MIN_RELATIONSHIP = 25;
export const CANVASS_EVENT_CHANCE     = 0.15;

export const OFFICE_PRESTIGE: Record<string, number> = {
  vigintivirate: 2,
  quaestor:      5,
  tribune:       6,
  aedile:        8,
  praetor:       12,
  consul:        20,
  censor:        22,
  dictator:      25,
};

// ─── P2-E — summit-curve levers (FIRST-PASS / UNVERIFIED) ────────────────────
// The plan's target win-rate curve (vigintivirate/quaestor easy, praetor/consul
// genuine summits) isn't reachable from seats-and-prestige alone, since NPC
// score didn't previously vary by the office being contested. These multipliers
// are reasoned from the score formulas, not measured by playtest or simulation
// (see rome-phase2-implementation-plan.md's "## Tuning log" — no sim harness was
// built this pass; the user chose first-pass-only tuning). Revisit with real
// data before trusting the exact percentages in the plan's target table.

/** Multiplies calcNpcElectionScore for rivals at each office — reflects the
 *  electorate/rival field naturally getting tougher at higher offices,
 *  additive to (not a replacement for) the existing held-office prestige term. */
export const RIVAL_STRENGTH_BY_OFFICE_RANK: Record<string, number> = {
  vigintivirate: 1.0,
  quaestor:      1.0,
  tribune:       1.05,
  aedile:        1.1,
  praetor:       1.3,
  consul:        1.5,
  censor:        1.5,
  dictator:      1.5,
};

/** Fides cost of canvassLeader, scaled by office band — makes a full canvassing
 *  run for the top offices a genuine investment, not just a harder roll. */
export const CANVASS_FIDES_COST_BY_OFFICE_RANK: Record<string, number> = {
  vigintivirate: CANVASS_FIDES_COST,
  quaestor:      CANVASS_FIDES_COST,
  tribune:       4,
  aedile:        4,
  praetor:       6,
  consul:        10,
  censor:        10,
  dictator:      10,
};

export function getCanvassFidesCost(officeId: OfficeId | null): number {
  if (!officeId) return CANVASS_FIDES_COST;
  return CANVASS_FIDES_COST_BY_OFFICE_RANK[officeId] ?? CANVASS_FIDES_COST;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(min: number, max: number, val: number): number {
  return Math.min(max, Math.max(min, val));
}

// Exported for inheritanceEngine.ts's P3-C death-card "remembered detail" line.
export function getHighestOffice(heldOffices: string[]): string | null {
  if (heldOffices.length === 0) return null;
  let highest: string | null = null;
  let highestPrestige = -1;
  for (const id of heldOffices) {
    const p = OFFICE_PRESTIGE[id] ?? 0;
    if (p > highestPrestige) { highest = id; highestPrestige = p; }
  }
  return highest;
}

// ─── Office threshold (canvassing) ────────────────────────────────────────────

export function calcOfficeThreshold(officeId: OfficeId): number {
  const idx = OFFICES.findIndex(o => o.id === officeId);
  return 40 + Math.max(0, idx) * 5;
}

// ─── Canvass roll ─────────────────────────────────────────────────────────────

export function calcCanvassRoll(rhetoric: number, relationship: number): number {
  const base      = Math.random() * 100;
  const rhetBonus = rhetoric * 5;
  const relBonus  = Math.floor(relationship / 10) * 2;
  return base + rhetBonus + relBonus;
}

// ─── NPC eligibility ──────────────────────────────────────────────────────────

export function isNpcEligibleForOffice(npc: ClanLeader, officeId: string): boolean {
  const office = OFFICES.find(o => o.id === officeId);
  if (!office) return false;
  if (npc.age < office.minAge) return false;
  if (office.prerequisite && !npc.heldOffices.includes(office.prerequisite)) return false;
  if (npc.currentOffice !== null) return false;
  if (npc.heldOffices.includes(officeId)) return false;
  return true;
}

// ─── NPC election score ───────────────────────────────────────────────────────

/**
 * officeId is optional so existing display/legacy call sites keep working
 * unscaled; resolveElection and generateRivals pass it to apply the P2-E
 * rank multiplier (RIVAL_STRENGTH_BY_OFFICE_RANK) for the office being contested.
 */
export function calcNpcElectionScore(npc: ClanLeader, clanInfluence: number, officeId?: OfficeId): number {
  const highest   = getHighestOffice(npc.heldOffices);
  const prestige  = highest ? (OFFICE_PRESTIGE[highest] ?? 0) : 0;
  const clanBonus = Math.round(clanInfluence * 0.2);
  const rankMultiplier = officeId ? (RIVAL_STRENGTH_BY_OFFICE_RANK[officeId] ?? 1.0) : 1.0;
  return Math.round((20 + npc.skills.rhetoric * 3 + prestige + clanBonus) * rankMultiplier);
}

// ─── Player election score ────────────────────────────────────────────────────

export function calcPlayerElectionScore(state: GameState): number {
  const votingSwayBonus = state.clients
    .filter(c => c.type === 'votingSway')
    .reduce((sum, c) => sum + (c.bonus.votingSwayBonus ?? 1), 0);

  const lockedFor = state.clans
    .flatMap(c => c.leaders)
    .filter(l => state.campaignVotes[l.id] === 'for')
    .reduce((sum, l) => sum + l.votes, 0);

  return PLAYER_BASE_SCORE + votingSwayBonus + lockedFor;
}

// ─── Generate rivals (display) ────────────────────────────────────────────────

export function generateRivals(officeId: OfficeId, state: GameState): ElectionRival[] {
  const officeIdx    = OFFICES.findIndex(o => o.id === officeId);
  const displayCount = officeIdx >= 3 ? 3 : 2;

  const candidates = state.clans.flatMap(clan =>
    clan.leaders
      .filter(l => isNpcEligibleForOffice(l, officeId))
      .map(l => ({ leader: l, clanId: clan.id, clanName: clan.name, clanInfluence: clan.influence }))
  );

  return candidates
    .map(({ leader, clanId, clanName, clanInfluence }) => ({
      id:            leader.id,
      name:          leader.name,
      emoji:         leader.emoji,
      clanName,
      clanId,
      title:         leader.title,
      bias:          leader.bias as string,
      baseVotes:     leader.votes,
      clanInfluence,
      strength:      calcNpcElectionScore(leader, clanInfluence, officeId),
      highestOffice: getHighestOffice(leader.heldOffices),
    }))
    .sort((a, b) => b.strength - a.strength)
    .slice(0, displayCount);
}

// ─── NPC career tick ──────────────────────────────────────────────────────────

function getNextEligibleOffice(npc: ClanLeader): typeof OFFICES[0] | null {
  for (const office of OFFICES) {
    if (isNpcEligibleForOffice(npc, office.id)) return office;
  }
  return null;
}

export function tickNpcCareers(clans: Clan[], seasonIndex: number): Clan[] {
  let updated = clans.map(clan => ({
    ...clan,
    leaders: clan.leaders.map(leader => {
      if (leader.currentOffice === null || leader.turnsLeftInOffice === null) return leader;
      const remaining = leader.turnsLeftInOffice - 1;
      if (remaining <= 0) {
        return {
          ...leader,
          heldOffices:       [...leader.heldOffices, leader.currentOffice],
          currentOffice:     null,
          turnsLeftInOffice: null,
        };
      }
      return { ...leader, turnsLeftInOffice: remaining };
    }),
  }));

  if (seasonIndex !== 3) return updated;

  updated = updated.map(clan => ({
    ...clan,
    leaders: clan.leaders.map(leader => {
      if (leader.currentOffice !== null) return leader;
      const nextOffice = getNextEligibleOffice(leader);
      if (!nextOffice) return leader;

      const advanceChance = clamp(
        0.05, 0.75,
        0.30 + leader.skills.rhetoric * 0.025 + (clan.influence / 100) * 0.20
      );

      if (Math.random() < advanceChance) {
        return {
          ...leader,
          currentOffice:     nextOffice.id,
          turnsLeftInOffice: nextOffice.termSeasons,
        };
      }
      return leader;
    }),
  }));

  return updated;
}

// ─── Resolve election ─────────────────────────────────────────────────────────

export interface ElectionResult {
  won: boolean;
  playerVotes: number;
  playerRank: number;
  seats: number;
  topRivalName: string;
  topRivalVotes: number;
  /**
   * True if the Constitution crisis tier is high enough to make the election
   * disputed. turnSequencer injects evt-election-contested into pendingEvents
   * when this is true and the player won.
   *
   * Tier 4 (≥75): always contested.
   * Tier 3 (50–74): 30% chance.
   */
  contested: boolean;
}

export function resolveElection(state: GameState): ElectionResult {
  const empty: ElectionResult = {
    won: false, playerVotes: 0, playerRank: 999, seats: 0,
    topRivalName: '', topRivalVotes: 0, contested: false,
  };
  if (!state.campaigning) return empty;

  const office = OFFICES.find(o => o.id === state.campaigning);
  if (!office) return empty;

  const seats = office.seats;

  // ── Player vote total ──────────────────────────────────────────────────────
  const votingSwayBonus = state.clients
    .filter(c => c.type === 'votingSway')
    .reduce((sum, c) => sum + (c.bonus.votingSwayBonus ?? 1), 0);
  const lockedFor = state.clans
    .flatMap(c => c.leaders)
    .filter(l => state.campaignVotes[l.id] === 'for')
    .reduce((sum, l) => sum + l.votes, 0);
  const wordOfMouth = Math.round(Math.random() * 8);

  // Peoples-champion bonus (Chunk 1C): +5 flat votes when flag is active
  const peoplesChampionBonus = state.flags['peoples-champion'] ? 5 : 0;

  // Grand Games vote bonus (P2-F): a standing bonus applied to every election while
  // active, fading over time (ticked in turnSequencer's yearly rollover). Distinct
  // from peoplesChampionBonus above — recasting Grand Games refreshes it to full.
  const grandGamesBonus = state.grandGamesVoteBonus ?? 0;

  const playerTotal = PLAYER_BASE_SCORE + votingSwayBonus + lockedFor + wordOfMouth + peoplesChampionBonus + grandGamesBonus;

  // ── NPC vote pool ──────────────────────────────────────────────────────────
  // Nota Censoria (Chunk 1C): proscribed leaders contribute 0 votes — filter them out.
  const npcResults = state.clans.flatMap(clan =>
    clan.leaders
      .filter(l => isNpcEligibleForOffice(l, office.id))
      .filter(l => !l.proscribed)
      .map(l => ({
        name:  l.name,
        votes: Math.round(calcNpcElectionScore(l, clan.influence, office.id) + (Math.random() * 8 - 4)),
      }))
  );

  const allScores  = [playerTotal, ...npcResults.map(n => n.votes)].sort((a, b) => b - a);
  const playerRank = allScores.indexOf(playerTotal) + 1;
  const topRival   = [...npcResults].sort((a, b) => b.votes - a.votes)[0];

  // ── Contested election check (Chunk 1C) ───────────────────────────────────
  // High Constitution crisis makes elections unstable — rivals challenge results.
  const constitutionTier = getTierFromLevel(state.crisis.constitution.level);
  const alwaysContested  = constitutionTier >= 4;
  const contestedRoll    = constitutionTier >= 3 && Math.random() < 0.30;
  const contested        = alwaysContested || contestedRoll;

  return {
    won:           playerRank <= seats,
    playerVotes:   playerTotal,
    playerRank,
    seats,
    topRivalName:  topRival?.name ?? '',
    topRivalVotes: topRival?.votes ?? 0,
    contested,
  };
}

// ─── Legacy helper ────────────────────────────────────────────────────────────

export function calcClanVotesForPlayer(
  clanId: string,
  state: GameState,
): { forPlayer: number; total: number; prob: number } {
  const clan = state.clans.find(c => c.id === clanId);
  if (!clan) return { forPlayer: 0, total: 0, prob: 0 };
  const totalVotes  = clan.leaders.reduce((s, l) => s + l.votes, 0);
  const weightedRel = clan.leaders.reduce((s, l) => s + l.relationship * l.votes, 0) / totalVotes;
  const prob        = clamp(0.05, 0.95, 0.5 + weightedRel / 130);
  return { forPlayer: Math.round(totalVotes * prob), total: totalVotes, prob };
}
