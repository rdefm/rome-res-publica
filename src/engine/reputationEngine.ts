import { REPUTATION_THRESHOLDS, ReputationThreshold } from '../data/reputationThresholds';
import type { Clan, ClanLeader, ClanStanding, LeaderBias } from '../models/clan';
import type { ElectionRival } from '../models/office';
import { BALANCE } from '../data/balance';
import { LEADER_PRAENOMINA } from '../data/clientNames';
import { TRAIT_DEFINITIONS } from '../data/traits';

// ─── Phase 4, Chunk P4-E — successor traits ──────────────────────────────────
// Procedurally generated successors (unlike the hand-authored starting
// leaders in data/startingClans.ts) get a freshly rolled trait AND its
// skillModifiers applied — there's no hand-tuned baseline here to disturb,
// unlike the starting roster (see models/clan.ts's ClanLeader.traits doc
// comment). Mirrors inheritanceEngine.applyTraitModifiers's clamp/shape, but
// against ClanLeaderSkills (no auctoritas field to touch).

/** 65% chance of inheriting one trait from the pool — leaves a meaningful
 *  minority of successors traitless, same texture as the starting roster
 *  (several of whom were deliberately left without one). */
function rollLeaderTrait(rng: () => number): string | null {
  if (rng() >= 0.65) return null;
  const pool = TRAIT_DEFINITIONS;
  return pool[Math.floor(rng() * pool.length)].id;
}

function applyLeaderTraitModifiers(skills: ClanLeader['skills'], traitIds: string[]): ClanLeader['skills'] {
  const updated = { ...skills };
  for (const id of traitIds) {
    const trait = TRAIT_DEFINITIONS.find(t => t.id === id);
    if (!trait?.skillModifiers) continue;
    const sm = trait.skillModifiers;
    updated.rhetoric = Math.max(0, Math.min(10, updated.rhetoric + (sm.rhetoric ?? 0)));
    updated.martial  = Math.max(0, Math.min(10, updated.martial  + (sm.martial  ?? 0)));
    updated.intrigus = Math.max(0, Math.min(10, updated.intrigus + (sm.intrigus ?? 0)));
  }
  return updated;
}

export function getReputationTier(score: number): ReputationThreshold {
  const sorted = [...REPUTATION_THRESHOLDS].sort((a, b) => b.score - a.score);
  return sorted.find(t => score >= t.score) ?? REPUTATION_THRESHOLDS[0];
}

export function adjustReputation(
  current: number,
  delta: number,
): { newScore: number; crossedThreshold: ReputationThreshold | null } {
  const clamped = Math.max(-100, Math.min(100, current + delta));
  const oldTier = getReputationTier(current);
  const newTier = getReputationTier(clamped);
  const crossedThreshold = oldTier.label !== newTier.label ? newTier : null;
  return { newScore: clamped, crossedThreshold };
}

export function getUnlockedReputationActions(score: number): string[] {
  return getReputationTier(score).unlockedActions;
}

// ─── Forum "gens" badge (ally / neutral / hostile / rival) ───────────────────
// Derived from familyReputations, not stored — keeps the badge and the
// Reputation Bar tier directly below it always in sync. 'rival' overrides the
// reputation-based label whenever the clan is currently fielding a candidate
// against the player (see electionEngine.generateRivals).
// ─── Forum action → family reputation ────────────────────────────────────────
// Converts a flat relationship gain with one leader into a family-reputation
// swing for their whole clan, weighted by that leader's share of the clan's
// total voting bloc — winning over a clan's most powerful leader moves the
// family's standing with the whole gens much more than winning over a minor one.
export function computeReputationDelta(
  relationshipDelta: number,
  leaderVotes: number,
  clanTotalVotes: number,
): number {
  if (clanTotalVotes <= 0) return 0;
  return Math.round(relationshipDelta * (leaderVotes / clanTotalVotes));
}

export function getClanStanding(
  clanId: string,
  familyReputations: Record<string, number>,
  electionRivals: ElectionRival[],
): ClanStanding {
  if (electionRivals.some(r => r.clanId === clanId)) return 'rival';
  const score = familyReputations[clanId] ?? 0;
  if (score < -10) return 'hostile';
  if (score < 35) return 'neutral';
  return 'ally';
}

// ─── Relationship anchors + yearly decay (P2-D) ──────────────────────────────
// Relocated from resourceEngine.applyRelationshipDrift, which decayed every
// leader toward 0 every season — a maintenance treadmill. Replaced with decay
// toward a per-leader anchor, applied once per year at the Winter→Spring
// rollover (turnSequencer gates the call on crossedNewYear).
//
// Dropped intentionally: the old function also applied extra decay while the
// Constitution crisis track was elevated (v2 design doc §2.3). That mechanic
// doesn't carry over — the whole point of this redesign is removing passive
// per-season relationship pressure, and Constitution crisis already has its
// own Fides/bill-passage penalties (crisisEngine, agendaEngine). Flagging
// this drop explicitly in case it needs to come back in a different form.

/**
 * Anchor precedence: marriage > alliance > hostile (relationship < 25, no
 * bond) > default. Derived fresh each year, never stored.
 */
export function deriveRelationshipAnchor(leader: ClanLeader): number {
  if (leader.married) return BALANCE.relationships.anchorMarriage;
  if (leader.alliance) return BALANCE.relationships.anchorAlliance;
  if (leader.relationship < 25) return BALANCE.relationships.anchorHostile;
  return BALANCE.relationships.anchorDefault;
}

/**
 * Moves one leader's relationship BALANCE.relationships.decayPerYear points
 * toward their anchor, never crossing it. Hostile-anchored leaders (no bond,
 * already unfriendly) only drift DOWN toward their anchor — they never warm
 * on their own; "enemies stay enemies unless acted upon."
 */
function decayTowardAnchor(leader: ClanLeader): number {
  const anchor = deriveRelationshipAnchor(leader);
  const isHostileAnchored = anchor === BALANCE.relationships.anchorHostile;
  const step = BALANCE.relationships.decayPerYear;

  if (leader.relationship > anchor) {
    return Math.max(anchor, leader.relationship - step);
  }
  if (leader.relationship < anchor && !isHostileAnchored) {
    return Math.min(anchor, leader.relationship + step);
  }
  return leader.relationship;
}

/** Applies decayTowardAnchor to every leader in every clan. Yearly only. */
export function applyYearlyRelationshipDecay(clans: Clan[]): Clan[] {
  return clans.map(clan => ({
    ...clan,
    leaders: clan.leaders.map(leader => ({
      ...leader,
      relationship: decayTowardAnchor(leader),
    })),
  }));
}

// ─── Leader aging + mortality + succession (P2-D) ────────────────────────────

function mortalityChance(age: number): number {
  const m = BALANCE.relationships.mortality;
  if (age < 50) return m.under50;
  if (age < 60) return m.band50to59;
  if (age < 70) return m.band60to69;
  if (age < 80) return m.band70to79;
  return m.band80plus;
}

const LEADER_BIASES: LeaderBias[] = ['optimates', 'populares', 'military', 'tradition', 'commerce'];

export interface LeaderDeath {
  clanId: string;
  clanName: string;
  deadLeaderName: string;
  deadLeaderAge: number;
  successorId: string;
  successorName: string;
  successorAge: number;
  biasInherited: boolean;
  /** True if the dead leader was marriage- or alliance-linked — the bond does not pass to the heir. */
  hadBond: boolean;
}

/**
 * Generates a fully procedural successor for a dead leader. Predecessor's
 * held offices, blackmail marks, proscription, and marriage/alliance bonds do
 * NOT carry over — "the bond your family held with him does not pass to his
 * heir." Skills and sphere are inherited unchanged (not addressed by the
 * design plan; copying avoids inventing a new formula for a minor detail).
 */
function generateSuccessor(
  predecessor: ClanLeader,
  clan: Clan,
  livingNames: Set<string>,
): { leader: ClanLeader; biasInherited: boolean } {
  const gensName = clan.gensName ?? clan.name.replace(/^Gens\s+/, '');

  let name = '';
  for (const praenomen of [...LEADER_PRAENOMINA].sort(() => Math.random() - 0.5)) {
    const candidate = `${praenomen} ${gensName}`;
    if (!livingNames.has(candidate)) { name = candidate; break; }
  }
  if (!name) name = `${LEADER_PRAENOMINA[0]} ${gensName}`; // pool exhausted — accept a duplicate

  const age = BALANCE.relationships.successorAgeMin +
    Math.floor(Math.random() * (BALANCE.relationships.successorAgeMax - BALANCE.relationships.successorAgeMin + 1));

  const biasInherited = Math.random() < BALANCE.relationships.successorBiasInheritChance;
  const bias = biasInherited ? predecessor.bias : LEADER_BIASES[Math.floor(Math.random() * LEADER_BIASES.length)];

  const votes = Math.round(predecessor.votes * BALANCE.relationships.successorVotesRetention);

  const rawRelationship = Math.round(predecessor.relationship * BALANCE.relationships.successorRelationshipRetention);
  const freshLeaderForAnchor: ClanLeader = { ...predecessor, relationship: rawRelationship, married: false, alliance: false };
  const anchor = deriveRelationshipAnchor(freshLeaderForAnchor);
  const relationship = Math.max(rawRelationship, anchor);

  const trait = rollLeaderTrait(Math.random);
  const traits = trait ? [trait] : [];
  const skills = applyLeaderTraitModifiers(predecessor.skills, traits);

  const leader: ClanLeader = {
    id: `${clan.id}-heir-${predecessor.id}`,
    name,
    title: 'New to the Senate',
    emoji: '👤',
    age,
    sphere: predecessor.sphere,
    relationship,
    favour: 0,
    blackmail: false,
    bias,
    votes,
    bio: `Rises to lead the ${clan.name} after ${predecessor.name}'s death.`,
    alliance: false,
    married: false,
    skills,
    traits,
    heldOffices: [],
    currentOffice: null,
    turnsLeftInOffice: null,
    proscribed: false,
  };
  return { leader, biasInherited };
}

/**
 * Ages every leader +1, rolls mortality by age band, and — capped at one
 * death per year game-wide (ties broken by keeping the eldest) — replaces
 * the deceased with a procedurally generated successor. Yearly only; call
 * only on the Winter→Spring rollover.
 */
export function ageAndProcessMortality(clans: Clan[]): { clans: Clan[]; death: LeaderDeath | null } {
  const aged = clans.map(clan => ({
    ...clan,
    leaders: clan.leaders.map(leader => ({ ...leader, age: leader.age + 1 })),
  }));

  const candidates: { clanId: string; leaderId: string }[] = [];
  for (const clan of aged) {
    for (const leader of clan.leaders) {
      if (Math.random() < mortalityChance(leader.age)) {
        candidates.push({ clanId: clan.id, leaderId: leader.id });
      }
    }
  }

  if (candidates.length === 0) return { clans: aged, death: null };

  // Hard cap: at most one death per year — keep the eldest.
  const chosen = candidates
    .map(c => {
      const clan = aged.find(cl => cl.id === c.clanId)!;
      const leader = clan.leaders.find(l => l.id === c.leaderId)!;
      return { clan, leader };
    })
    .sort((a, b) => b.leader.age - a.leader.age)[0];

  const livingNames = new Set(aged.flatMap(c => c.leaders.map(l => l.name)));
  const { leader: successor, biasInherited } = generateSuccessor(chosen.leader, chosen.clan, livingNames);

  const death: LeaderDeath = {
    clanId: chosen.clan.id,
    clanName: chosen.clan.name,
    deadLeaderName: chosen.leader.name,
    deadLeaderAge: chosen.leader.age,
    successorId: successor.id,
    successorName: successor.name,
    successorAge: successor.age,
    biasInherited,
    hadBond: !!(chosen.leader.married || chosen.leader.alliance),
  };

  const nextClans = aged.map(clan =>
    clan.id !== chosen.clan.id
      ? clan
      : { ...clan, leaders: clan.leaders.map(l => (l.id === chosen.leader.id ? successor : l)) }
  );

  return { clans: nextClans, death };
}
