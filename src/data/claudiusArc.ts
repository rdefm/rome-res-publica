// ─── Phase 4, Chunk P4-G — the Claudius arc ───────────────────────────────────
// Static content only (CLAUDE.md layer rule) — the defiance-trial math lives
// in secretEngine.resolveClaudiusDefiance, right beside its general-purpose
// sibling resolveSecretDemand. evt-claud-01/02 are weight-0, force-injected
// exactly like data/secretEvents.ts's generic demand events, but scripted
// and three-choiced (Comply / Play for time / Defy) rather than generic and
// two-choiced — hence their own file rather than folding into secretEvents.ts.

import type { EventDef } from '../models/event';
import type { Secret } from '../models/secret';

/** Fixed (not Date.now()-generated) so turnSequencer.ts and gameStore.loadGame
 *  can find this exact Secret by id — the arc cares about THIS Secret
 *  specifically, not "any Secret Claudius holds" (npcGatherTick may still
 *  generate ordinary, unrelated ones against the family over time). */
export const CLAUDIUS_ARC_SECRET_ID = 'secret-claudius-arc';
export const CLAUDIUS_LEADER_ID = 'claudius-pulcher';
export const CLAUDIUS_CLAN_ID = 'claudii';

/**
 * The starting Secret (design point 1 — "exists from game start"). Called
 * once by gameStore's INITIAL_STATE and again by loadGame for any save that
 * predates P4-G (backfilled only if not already present). `discovered: true`
 * from the outset — unlike an ordinary npcGatherTick-generated Secret, the
 * player already knows Claudius holds this over them per the game's own
 * opening framing (evt-tut-04, and the base-game blackmail flag this
 * replaces); there is no "discovery" beat to gate on.
 */
export function buildClaudiusStartingSecret(paterfamiliasId: string, acquiredSeason: number = 1): Secret {
  return {
    id: CLAUDIUS_ARC_SECRET_ID,
    type: 'embezzlement',
    subject: { kind: 'family', characterId: paterfamiliasId },
    holder: CLAUDIUS_LEADER_ID,
    potency: 2,
    status: 'held',
    acquiredSeason,
    discovered: true,
    flavorText: "a certain irregularity in your father's accounts",
  };
}

// ─── The demand ────────────────────────────────────────────────────────────

export const EVT_CLAUD_01: EventDef = {
  id: 'evt-claud-01',
  title: 'The Claudian Price',
  bodyText:
    'Ap. Claudius Pulcher finds you after the session, unhurried. He has never needed to raise his voice. ' +
    '"A small matter, between houses that understand each other. Your voice, on the floor, when the vote is called. ' +
    'Nothing you would not have considered anyway." He does not name what he holds. He does not need to.',
  imageKey: 'portrait-paterfamilias',
  conditions: [],
  weight: 0,
  choices: [
    {
      id: 'comply',
      label: 'Cast the vote as he demands.',
      successEffect: '',
      failureEffect: '',
      successText: 'You give him what he wants. Philon, afterward: "A small price, Domine — this time. Men like Claudius keep a ledger, not a memory. He will call on it again."',
    },
    {
      id: 'wait',
      label: 'Ask for time to consider. (defers one season)',
      successEffect: '',
      failureEffect: '',
      successText: 'You ask for time. Claudius inclines his head, unbothered — a man who has never once been in a hurry. "Of course. Take the season, Domine. I am a patient man. I am not, however, an infinitely patient one."',
    },
    {
      id: 'defy',
      label: 'Refuse him outright.',
      successEffect: '',
      failureEffect: '',
      nextEventId: 'evt-claud-02',
      successText: 'You refuse him to his face. Something in his expression does not change, which is its own answer.',
    },
  ],
};

// ─── Defiance ────────────────────────────────────────────────────────────────

export const EVT_CLAUD_02: EventDef = {
  id: 'evt-claud-02',
  title: 'The Charge is Filed',
  bodyText:
    'Ap. Claudius Pulcher does not raise his voice, and he does not repeat himself. Within the week, ' +
    'a charge of peculatus is laid against your father\'s name before the praetor — the "irregularity" he ' +
    'so long declined to name, now named for all of Rome to hear. Philon, grim: "He held the knife a long ' +
    'time, Domine, for exactly this moment. The Basilica awaits your preparation."',
  imageKey: 'portrait-paterfamilias',
  conditions: [],
  weight: 0,
  choices: [
    {
      id: 'so-be-it',
      label: 'So be it. We will answer him in court.',
      successEffect: '',
      failureEffect: '',
      successText: 'The charge is entered. Whatever comes of it now, it comes through the courts, in the open — not by his hand alone.',
    },
  ],
};

export const CLAUDIUS_ARC_EVENT_DEFS: EventDef[] = [EVT_CLAUD_01, EVT_CLAUD_02];
