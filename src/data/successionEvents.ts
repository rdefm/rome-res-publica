// ─── Succession Events ────────────────────────────────────────────────────────
// Phase 3, Chunk P3-C — the paterfamilias's death as scripted theatre rather
// than silent bookkeeping. All weight 0 — every def here fires only via
// direct injection (turnSequencer.ts's natural-death step, musterEngine.ts's
// battle-death write-back, or the trial-execution path), never the random
// pool, matching warEvents.ts's terminal-notice precedent.
//
// Chaining note: the funeral and heir-confirmation choices apply real
// effects (denarii/dignitas/succession) AND advance to the next scene in the
// same choice. This codebase's built-in EventChoice.nextEventId branching
// can't do that — resolveEventChoice (eventEngine.ts) discards effectStr
// entirely whenever any nextEventId variant is set (verified before writing
// this file). So the sequence chains via a new `nextEvent:defId` effect-
// string token (resourceEngine.ts) instead — see that token's own comment.
//
// Choice-visibility note: EventChoice has no per-choice conditional
// visibility in this codebase (only EventDef-level `conditions`). The plan's
// "Name a different heir (guaranteed, only shown if an alternative eligible
// relative exists)" is therefore implemented as an ALWAYS-shown second
// choice that gracefully falls back to the default heir when no alternative
// exists (see the succeedPaterfamilias: token's own comment) — a labelled
// button that occasionally does the same thing as the first, rather than a
// button that sometimes doesn't exist.

import type { EventDef } from '../models/event';
import type { PendingSuccession } from '../models/character';

/** The death card's dynamic bodyText — built here (content), passed to
 *  injectNoticeEvent by the caller (turnSequencer.ts / musterEngine.ts). */
export function buildDeathCardBody(p: PendingSuccession): string {
  return `${p.deceasedName}, ${p.deceasedAge} — ${p.rememberedDetail} — has died. The household mourns, ` +
    `but Rome does not pause for grief.`;
}

/** The no-heir notice's dynamic bodyText — see evt-succession-no-heir's
 *  own comment for why this is a distinct dead-end rather than the normal
 *  funeral/heir-confirmation chain. `gensName` — Phase 5, Chunk P5-E — was
 *  hardcoded 'Brutia'. */
export function buildNoHeirBody(p: PendingSuccession, gensName: string): string {
  return `${p.deceasedName}, ${p.deceasedAge} — ${p.rememberedDetail} — has died, and no one remains ` +
    `of the Gens ${gensName} fit to take up the name.`;
}

export const SUCCESSION_EVENT_DEFS: EventDef[] = [

  {
    id: 'evt-succession-death',
    title: 'A Death in the House',
    bodyText: 'The paterfamilias has died.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'continue',
        label: 'Continue',
        successEffect: 'nextEvent:evt-succession-funeral',
        failureEffect: '',
      },
    ],
  },

  // Injected instead of evt-succession-death when PendingSuccession.
  // eligibleHeirIds is empty — TODO(P3-D): the cadet-branch continuation
  // offer belongs here once that chunk exists. Until then this is a
  // dead-end acknowledgement, same treatment as every other pre-epilogue
  // notice in this codebase (see warEvents.ts's terminal notices) — the
  // family is simply left without an isPlayer character (matches
  // musterEngine.ts's pre-P3-C documented behaviour for this exact case;
  // pendingSuccession is deliberately left set as a marker for P3-D).
  {
    id: 'evt-succession-no-heir',
    title: 'The Line Falters',
    bodyText: 'No heir remains.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },

  {
    id: 'evt-succession-funeral',
    title: 'The Funeral',
    bodyText:
      'The household must decide how to bury its dead. A lavish laudatio funeral, with the eulogy delivered before the ' +
      'assembled Forum, is remembered for a generation — and costs accordingly. Modest rites draw no such attention, ' +
      'and spend nothing the family cannot spare.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'lavish-funeral',
        label: 'A lavish laudatio funeral',
        // Numbers mirror BALANCE.succession.funeral.lavish — kept in sync by hand.
        successEffect: 'denarii-40|lifetimeDignitas+15|optimatesRel+5|popularesRel+5|nextEvent:evt-succession-heir',
        failureEffect: '',
        successText: 'The household spends what it must. Rome remembers the pyre.',
      },
      {
        id: 'modest-funeral',
        label: 'Modest rites',
        // Mirrors BALANCE.succession.funeral.modest.
        successEffect: 'fides-3|nextEvent:evt-succession-heir',
        failureEffect: '',
        successText: 'A quiet burning. Practical. The Forum notices the economy, and thinks less of it.',
      },
    ],
  },

  {
    id: 'evt-succession-heir',
    title: 'The New Master of the House',
    bodyText:
      'By right of age, the eldest eligible child stands ready to take up the household\'s name and its debts alike. ' +
      'The family could instead put forward another — at the cost of the trust such a break in custom always costs.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'confirm-eldest',
        label: 'Confirm the eldest',
        successEffect: 'succeedPaterfamilias:default',
        failureEffect: '',
        successText: 'The household has a new master. Life in the Domus goes on.',
      },
      {
        id: 'name-other-heir',
        label: 'Name a different heir instead',
        // Falls back to the default heir when no alternative exists — see
        // this file's header comment.
        successEffect: 'succeedPaterfamilias:alt',
        failureEffect: '',
        successText: 'It is not the custom the Forum expected — but the household has a new master, and the choice was the family\'s to make.',
      },
    ],
  },

  // Injected by turnSequencer.ts's regency-ends check — dynamic bodyText,
  // static fallback below matches the pattern already established for
  // evt-war-threshold-notice/evt-succession-death.
  {
    id: 'evt-succession-regency-ends',
    title: 'Come of Age',
    bodyText: 'The heir comes of age.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },

];
