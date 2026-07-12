// ─── Player-choice blackmail — compromising events ───────────────────────────
// General mechanism, not one-off content: any event choice can offer a real,
// valuable reward (votes, denarii) at the risk of planting a compromising
// fact about the player via resourceEngine's `createLatentSecret:<type>:
// <potency>` effect token. The player always knows exactly what they're
// risking and why — this is the deliberate counterpart to
// secretEngine.npcGatherTick's ambient, no-agency background blackmail
// against kin. What happens to a LatentSecret afterward (whether a hostile
// leader ever notices it) is secretEngine.latentSecretDiscoveryTick's job,
// run every season from turnSequencer step 9b; from the moment it converts,
// it's an ordinary Secret and rides the existing demand/exposure pipeline
// (evt-secret-demand-* in secretEvents.ts) unchanged.
//
// Regular weight — picked by pickRandomEvent like any other event, not
// force-injected. See turnSequencer.ts's pickRandomEvent pool and
// eventEngine.ts's getEventDef for wiring.

import type { EventDef } from '../models/event';

export const COMPROMISING_EVENT_DEFS: EventDef[] = [
  {
    id: 'evt-compromise-votes',
    title: 'A Purse for the Tribes',
    bodyText:
      'Your canvassers report three tribes still uncommitted with the vote only weeks away. ' +
      'A local ward-boss can guarantee one of them for a price paid quietly, in coin, before the assembly meets. ' +
      'He has done this before. He will do it again for someone else, if you hesitate.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'campaigning' }],
    weight: 6,
    choices: [
      {
        id: 'bribe',
        label: 'Pay the ward-boss and buy the tribe',
        successEffect: 'bribeVotes:1|createLatentSecret:electoral_fraud:2',
        failureEffect: '',
        successText:
          'The coin changes hands in a back room, and the tribe\'s vote is yours before a word is spoken in the Forum. ' +
          'Ballots do not remember who paid for them — but men do.',
      },
      {
        id: 'refuse',
        label: 'Campaign on your record alone',
        successEffect: 'fides+3',
        failureEffect: '',
        successText:
          'You decline. Whatever you win, you will have won honestly — and that, at least, no one can take from you.',
      },
    ],
  },

  {
    id: 'evt-compromise-funds',
    title: "The Clerk's Offer",
    bodyText:
      'A quaestor\'s clerk approaches you privately after the season\'s accounts are closed. ' +
      'A discrepancy in the public ledgers, he explains, could easily be made to favor you rather than the treasury — ' +
      'a modest sum, and no one the wiser, so long as it never happens twice.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 6,
    choices: [
      {
        id: 'skim',
        label: 'Take the money',
        successEffect: 'denarii+40|createLatentSecret:embezzlement:2',
        failureEffect: '',
        successText:
          'The sum appears in your strongbox by evening, and the ledgers close as though nothing happened at all. ' +
          'The clerk pockets his own share and says nothing more — for now.',
      },
      {
        id: 'refuse',
        label: 'Report the discrepancy in full',
        successEffect: 'lifetimeDignitas+3',
        failureEffect: '',
        successText:
          'You have the ledger corrected and the clerk quietly reassigned. ' +
          'It costs you nothing but the temptation, which is its own kind of wealth.',
      },
    ],
  },

  {
    id: 'evt-compromise-province',
    title: "The Governor's Cut",
    bodyText:
      'Your procurator lays out the province\'s accounts and, without quite saying so, makes clear that the tribute ' +
      'already collected could yield more than what reaches Rome\'s treasury — if the difference simply never appears ' +
      'in the ledger at all.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'governing' }],
    weight: 6,
    choices: [
      {
        id: 'extract',
        label: 'Take a cut beyond the tribute',
        successEffect: 'denarii+45|createLatentSecret:provincial_plunder:2',
        failureEffect: '',
        successText:
          'The extra tribute is quietly diverted before the manifest is sealed. The province is a little poorer, ' +
          'your household a little richer, and the procurator a little more indebted to your silence than you are to his.',
      },
      {
        id: 'refuse',
        label: 'Send the full tribute to Rome',
        successEffect: 'lifetimeDignitas+4',
        failureEffect: '',
        successText:
          'You forward every denarius owed. The procurator seems almost disappointed — but the province\'s tax farmers ' +
          'will remember an honest governor, if nothing else.',
      },
    ],
  },
];
