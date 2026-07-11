// ─── Phase 4, Chunk P4-B — Secret demand events ──────────────────────────────
// Weight-0, force-injected notices (turnSequencer.ts step 9b, via
// injectNoticeEvent) — never picked by pickRandomEvent. title/bodyText are
// fallbacks; the sequencer overrides bodyText per-instance with the specific
// leader/bill (EventDef is static content, so it can't know which leader is
// demanding — see models/secret.ts's PendingSecretDemand doc comment).
//
// Both events share the same comply/defy choice shape — the actual
// consequence (forced vote, extortion drain, scandal, or a queued trial via
// the unified TrialState pipeline — Phase 4, P4-C) is fully dynamic (which
// leader, which Secret, which bill) and computed by secretEngine.resolveSecretDemand,
// applied by gameStore.resolveEvent's special-case handler. successEffect/
// failureEffect are deliberately empty here — everything routes through
// that handler, not the generic effect-string pipeline (the plan's
// invariant 5, "always defiable," is enforced there).

import type { EventDef } from '../models/event';

export const SECRET_EVENT_DEFS: EventDef[] = [
  {
    id: 'evt-secret-demand-leverage',
    title: 'The Price of Silence',
    bodyText: 'A clan leader lets you know, without quite saying it, what he holds and what he wants for it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'comply',
        label: 'Give him what he wants.',
        successEffect: '',
        failureEffect: '',
        successText: 'You bend. Philon, quietly: "A small price, Domine — for now. Men like him rarely ask only once."',
      },
      {
        id: 'defy',
        label: 'Refuse him outright.',
        successEffect: '',
        failureEffect: '',
        successText: 'You refuse. Philon says nothing, which is its own kind of warning — whatever comes next, it comes on his terms now, not yours.',
      },
    ],
  },
  {
    id: 'evt-secret-demand-extortion',
    title: 'An Open Hand',
    bodyText: 'A clan leader\'s intermediary makes the arrangement plain: silence, purchased quietly, season after season.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'comply',
        label: 'Pay to keep it quiet.',
        successEffect: '',
        failureEffect: '',
        successText: 'You pay. Philon: "A leash, Domine, not a debt paid off. It will want feeding again."',
      },
      {
        id: 'defy',
        label: 'Refuse to be bled.',
        successEffect: '',
        failureEffect: '',
        successText: 'You refuse. Philon: "Then let us see what he thought he was holding, Domine."',
      },
    ],
  },
];
