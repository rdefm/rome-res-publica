// ─── Command Models ──────────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C4 — the theatre command:
// an elected proconsular authority granting imperium, a state army, and a
// war chest, won in a same-season "extraordinary assembly" separate from
// the Cursus tab's ordinary magistracy elections.
//
// DEVIATION FROM THE PLAN TEXT (documented per the plan's own §0 instruction
// to flag deviations with reasons — this one was put to the user before any
// code landed): the plan's C4 draft calls this chunk "a refactor" of
// electionEngine.resolveElection into a parameterized resolveElection(context)
// shared by both the Winter magistracy flow and this new assembly. In the
// real code, `resolveElection(state)`/`campaignVotes`/`electionRivals` are
// single global GameState fields keyed to one `campaigning: OfficeId | null`
// slot, and `canvassLeader` is hard-gated on `if (!state.campaigning) return`
// — nothing stops a player running for quaestor the same season a command
// vote is called, so literally sharing that state would let the two silently
// collide (canvassing a leader would count toward both elections at once).
// Chosen path (user-approved): a NEW, PARALLEL election track — this file's
// CommandElectionState, a new engine/commandEngine.ts, and new gameStore
// fields/actions — that mirrors electionEngine's formulas (calcNpcElectionScore
// is reused directly; the player-score shape is ported, not shared, since it
// hardcodes the `campaignVotes` field name) without touching a single line of
// electionEngine.ts or the Winter election path. Zero regression risk to
// existing magistracy elections was the explicit goal.
//
// No logic here — pure types, per the project's model/data/engine layering.

import type { ElectionRival } from './office';

export type CommandHolderOwner = 'player' | 'rome_rival';

export interface Command {
  id: string;
  /** Character id when holderOwner === 'player', clan-leader id when
   *  holderOwner === 'rome_rival'. */
  holderId: string;
  holderOwner: CommandHolderOwner;
  grantedSeason: number;   // turnNumber granted (or last re-upped via prorogation)
  expiresSeason: number;   // grantedSeason + BALANCE.campaign.command.termSeasons (4)
  /** Ticked by the future battle bridge (C8) — declared now, always 0 until
   *  then, exactly like Army's fatigued/unpaidSeasons fields were in C2. */
  battlesWon: number;
  battlesLost: number;
  /** Denarii, state money — spendable only on state-army muster/upkeep
   *  (musterEngine.ts checks this before personal denarii for a sanctioned
   *  player command). Never mixes into GameState.denarii. */
  warChest: number;
}

/** A same-season extraordinary assembly in progress — either a fresh vote
 *  (no command currently held) or an automatic prorogation vote (called in
 *  an existing Command's final season). Mirrors the shape of
 *  GameState.campaigning/campaignVotes/electionRivals conceptually, but as
 *  one self-contained struct instead of three parallel top-level fields —
 *  see this file's header comment on why it isn't literally that state. */
export interface CommandElectionState {
  active: boolean;
  calledSeason: number;         // turnNumber the vote opened
  isProrogation: boolean;
  /** (battlesWon − battlesLost) × BALANCE.campaign.command.prorogationPerBattle,
   *  clamped — 0 for a fresh (non-prorogation) vote. Applied to whichever
   *  side the incumbent is standing on at resolution. */
  incumbentWinLossModifier: number;
  /** True when the incumbent IS the player's standing candidate
   *  (candidateCharacterId) — the modifier applies to the player's score.
   *  False (with incumbentRivalId set) when the incumbent is an NPC rival. */
  incumbentIsPlayerCandidate: boolean;
  /** Which `rivals[]` entry (by id) is the incumbent, when the incumbent is
   *  NPC-held. Null for a fresh vote or a player-held incumbent. */
  incumbentRivalId: string | null;
  /** The player-side family member standing — a fresh candidate, or (for a
   *  player-held prorogation) auto-set to the incumbent at call time. Null
   *  if no family member is contesting this particular vote. */
  candidateCharacterId: string | null;
  rivals: ElectionRival[];
  votes: Record<string, 'for' | 'against' | 'neutral'>;
}
