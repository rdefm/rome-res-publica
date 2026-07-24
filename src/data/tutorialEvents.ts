// ─── Tutorial Event Definitions ──────────────────────────────────────────────
// All events: isTutorial: true, weight: 0.
// Fired via state.tutorialQueue (never by pickRandomEvent).
// Effects verified against applyEffectString token vocabulary before use.
// See Fable-phase1-implementation-plan.md §P1-G for full copy spec.
//
// Special-case store handlers (resolveEvent in gameStore.ts) handle:
//   tut-00 → open AgendaTablet
//   tut-03 → add +15 support to highest live bill
//   tut-05 → invoke declareFamilyCampaign for eligible member
//
// tut-04 intel: Phase 4, Chunk P4-G — rewired from the pre-Phase-4
// setFlag:intel-claudius-pulcher:true (never consumed) to
// grantGroundwork:claudius-pulcher:0.3, a real head start in the Secrets
// system toward the Claudius arc's counter-Secret (data/claudiusArc.ts).
//
// leaderRel token: new in P1-G, added to applyEffectString in resourceEngine.ts.
// Format: leaderRel:[leaderId]:[delta]

import type { EventDef } from '../models/event';
import { CLAUDIUS_LEADER_ID } from './claudiusArc';

export const TUTORIAL_EVENT_DEFS: EventDef[] = [

  // ── tut-00 ─ "The Greek at the Door" ─────────────────────────────────────
  // Timing: gameStart (popped from tutorialQueue into pendingEvents immediately
  // by the startGame store action — does NOT go through the season slot).
  {
    id: 'evt-tut-00',
    title: 'The Greek at the Door',
    bodyText:
      'The house is quiet before dawn. Philon — the Greek your father bought twenty years ago ' +
      'and never quite stopped listening to — sets a wax tablet beside your morning bread. ' +
      '"Domine. Carthage stirs in Sicily, the Senate quarrels, and the Gens Brutia is… ' +
      'let us say, *unremarked*. I will keep your tablet each season: what presses, what threatens, ' +
      'what beckons. Attend to it, and we may yet make this family\'s name outlast us both."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    choices: [
      {
        id: 'show-tablet',
        label: 'Show me the tablet.',
        successEffect: '',
        failureEffect: '',
        // Special-case handler in resolveEvent opens AgendaTablet on this choiceId.
      },
      {
        id: 'later',
        label: 'Later, Philon. Rome first.',
        successEffect: '',
        failureEffect: '',
        successText: 'Philon nods and withdraws. The tablet rests on the table, patient as stone.',
      },
    ],
  },

  // ── tut-01 ─ "The Weight of a Name" ──────────────────────────────────────
  // Gate: year-1 Spring (seasonIndex 0)
  {
    id: 'evt-tut-01',
    title: 'The Weight of a Name',
    bodyText:
      'Philon unrolls a family scroll thin enough to embarrass. ' +
      '"Your ancestors were worthy men, Domine, but worth must be *proclaimed*. ' +
      'Commission a laudatio — a public reading of the family\'s deeds — and Rome will ' +
      'begin to remember the Brutii. It costs standing to claim standing. It always does."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    seasons: [0],
    choices: [
      {
        id: 'commission',
        label: 'Commission the laudatio. (−10 Fides)',
        successEffect: 'fides-10|lifetimeDignitas+10',
        failureEffect: '',
        successText:
          'The reading takes place at the Forum steps. A small crowd. ' +
          'Enough to remember, and to tell others what they remember. ' +
          'Lifetime Dignitas rises by ten.',
      },
      {
        id: 'our-deeds',
        label: 'Our deeds will speak for themselves.',
        successEffect: '',
        failureEffect: '',
        successText:
          '"They will whisper, Domine. Whispers build nothing. ' +
          'The option remains in the Domus, when you are ready."',
      },
    ],
  },

  // ── tut-02 ─ "A Wolf at Dinner" ──────────────────────────────────────────
  // Gate: year-1 Summer (seasonIndex 1)
  // Uses leaderRel token (new in P1-G) for M. Valerius Flaccus (id: valerius-flaccus).
  {
    id: 'evt-tut-02',
    title: 'A Wolf at Dinner',
    bodyText:
      'An invitation arrives under the wolf seal of the Valerii — allies of your father, ' +
      'and the nearest thing this family has to friends. ' +
      'Philon: "Relationships are held with *men*, Domine, not houses. ' +
      'Flaccus commands fifteen votes and forgets nothing. ' +
      'Every leader in the Forum can be courted — dinners, favours, marriages. ' +
      'All of it costs. All of it counts, come the elections."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    seasons: [1],
    choices: [
      {
        id: 'attend-gift',
        label: 'Attend, and bring a fine gift. (−20 Denarii)',
        successEffect: 'denarii-20|leaderRel:valerius-flaccus:8',
        failureEffect: '',
        successText:
          'An evening of expensive wine and careful conversation. ' +
          'Flaccus is warmer than his reputation suggested — or better at hiding what he is. ' +
          'Either way, the relationship advances by eight.',
      },
      {
        id: 'send-regrets',
        label: 'Send regrets and a courteous letter. (−4 Fides)',
        successEffect: 'fides-4|leaderRel:valerius-flaccus:2',
        failureEffect: '',
        successText:
          'The letter is well-received. Flaccus notes the courtesy without requiring the commitment. ' +
          'A small step forward.',
      },
      {
        id: 'ignore',
        label: 'Ignore it.',
        successEffect: 'leaderRel:valerius-flaccus:-3',
        failureEffect: '',
        successText:
          '"Even wolves notice an empty chair, Domine."',
      },
    ],
  },

  // ── tut-03 ─ "The Business of the Curia" ─────────────────────────────────
  // Gate: year-1 Autumn (seasonIndex 2)
  // "vote-bill" choice: special-case handler in resolveEvent adds +15 support
  // to the highest-support live bill (in addition to the fides-4 effect).
  {
    id: 'evt-tut-03',
    title: 'The Business of the Curia',
    bodyText:
      'From the Curia steps, Philon watches the senators file in. ' +
      '"Understand this above all: when the Senate passes *nothing*, Rome\'s crises grow ' +
      'of their own accord — the war, the mobs, the treasury, the constitution itself. ' +
      'Any bill passed buys calm. Even a bad law is a bulwark. ' +
      'Your voice in there costs Fides; your silence, in time, costs more."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    seasons: [2],
    choices: [
      {
        id: 'vote-bill',
        label: 'Vote for whatever stands closest to passage. (−4 Fides)',
        successEffect: 'fides-4',
        failureEffect: '',
        // Special-case handler adds +15 support to the top bill (in addition to fides-4).
        successText:
          'Your vote lands where it was needed. The bill moves closer to passage. ' +
          'The Senate notes the participation, if not the enthusiasm.',
      },
      {
        id: 'watch-learn',
        label: 'I will watch this season, and learn.',
        successEffect: '',
        failureEffect: '',
        successText:
          '"Watching is free, Domine. Note only that the meters on the Curia\'s wall ' +
          'do not watch back — they climb."',
      },
    ],
  },

  // ── tut-04 ─ "The Claudian Smile" ────────────────────────────────────────
  // Gate: year-1 Winter (seasonIndex 3) — the arc's own year-1 introduction
  // (data/claudiusArc.ts's starting Secret exists from game start regardless
  // of start type; this is where a GUIDED start is told about it in-fiction).
  {
    id: 'evt-tut-04',
    title: 'The Claudian Smile',
    bodyText:
      'At the Saturnalia, Appius Claudius Pulcher toasts your health too warmly and mentions — ' +
      'lightly, as one mentions weather — a certain irregularity in your father\'s accounts ' +
      'that he keeps "quite safe." ' +
      'Philon, afterward, quietly: "He holds a blade of paper to our throat, Domine. ' +
      'Such things are answered in kind. Gather what is known about *him*. ' +
      'Knowledge is armour, and occasionally a knife."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    seasons: [3],
    choices: [
      {
        id: 'set-to-work',
        label: "Set Philon's contacts to work. (−8 Fides)",
        // Phase 4, Chunk P4-G — was 'fides-8|setFlag:intel-claudius-pulcher:true'.
        // That flag was never consumed anywhere (grepped before removing it,
        // per the plan's own instruction) — a leftover from the pre-Phase-4
        // "intel flag" system CLAUDE.md's baseline section describes as
        // already rewired. grantGroundwork gives a real head start (capped
        // at BALANCE.secrets.groundworkCap = 0.30, the same ceiling ordinary
        // failed gathers climb toward) in the actual Secrets system,
        // teaching the gather loop this event's own flavor text promises.
        successEffect: `fides-8|grantGroundwork:${CLAUDIUS_LEADER_ID}:0.3`,
        failureEffect: '',
        successText:
          'Philon departs without elaborating on where he is going. ' +
          'A week later he returns, says little, but what he has learned of Ap. Claudius Pulcher\'s own ' +
          'affairs will make the next attempt to learn more considerably easier.',
      },
      {
        id: 'wont-stoop',
        label: 'We will not stoop to it.',
        successEffect: 'lifetimeDignitas+2',
        failureEffect: '',
        successText:
          '"Honour, Domine, is a fine cloak. Wear it knowing the Claudii sell cloaks with ' +
          'knife-slits ready-cut. The Forum offers the means, should you reconsider."',
      },
    ],
  },

  // ── tut-05 ─ "A Man at Eighteen" ─────────────────────────────────────────
  // Gate: year-2 Spring (seasonIndex 0 after year rollover);
  // condition: a family member is 18+ and holds no office (default: Gaius Brutus).
  // "declare-gaius" choice: special-case handler invokes declareFamilyCampaign.
  {
    id: 'evt-tut-05',
    title: 'A Man at Eighteen',
    bodyText:
      'Gaius stands straighter this year. ' +
      'Philon: "The Cursus Honorum, Domine — the ladder every Roman name must climb, ' +
      'rung by rung, office by office. It begins low: the Vigintivirate, open at eighteen. ' +
      'Declare his candidacy in the Cursus, court the clan leaders\' votes through the Forum — ' +
      '*Canvass for Votes* locks a leader\'s support — and the city votes in Winter. ' +
      'Every consul Rome has ever had began exactly here."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    seasons: [0],
    choices: [
      {
        id: 'declare-gaius',
        label: 'Declare Gaius for the Vigintivirate.',
        successEffect: '',
        failureEffect: '',
        // Special-case handler in resolveEvent calls declareFamilyCampaign.
        successText:
          'The declaration is registered. Gaius will campaign through the season; ' +
          'the election resolves at the end of Winter. Court the leaders who matter.',
      },
      {
        id: 'not-ready',
        label: 'He is not ready. Next year, perhaps.',
        successEffect: '',
        failureEffect: '',
        successText:
          '"As you judge, Domine. The ladder does not shorten while we wait."',
      },
    ],
  },

  // ── tut-06 ─ "The Count" ──────────────────────────────────────────────────
  // Gate: year-2 Winter (seasonIndex 3); skip silently if campaigning === null.
  {
    id: 'evt-tut-06',
    title: 'The Count',
    bodyText:
      'Election eve. Philon tallies by lamplight. ' +
      '"Locked votes are certain votes, Domine — the rest is weather. ' +
      'Canvassed leaders stand bound to us; the uncommitted clans drift with their sympathies, ' +
      'Optimates or Populares. Whatever tomorrow brings, remember: lost elections cost a ' +
      'season\'s pride. Un-fought ones cost the family\'s future."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    seasons: [3],
    choices: [
      {
        id: 'read-tally',
        label: 'Read me the tally.',
        successEffect: '',
        failureEffect: '',
        successText:
          'Philon reads the count: locked votes confirmed, uncommitted leaders noted. ' +
          'The election resolves when this season ends. Whatever the margin, the family contested it.',
      },
      {
        id: 'let-rome-decide',
        label: 'Enough. Let Rome decide.',
        successEffect: '',
        failureEffect: '',
        successText:
          '"As you say, Domine. Rome always does."',
      },
    ],
  },

  // ── tut-07 ─ "The Tablet Is Yours" ───────────────────────────────────────
  // Gate: fires the season after tut-06 resolves (or after tut-05 if tut-06 was skipped).
  // No season gate — fires whenever it reaches the head of the queue.
  // Queue exhaustion after this event sets flags['tutorial-complete'] = true
  // (handled in turnSequencer step 12 when the queue empties).
  {
    id: 'evt-tut-07',
    title: 'The Tablet Is Yours',
    bodyText:
      'Philon sets down the stylus. ' +
      '"You know the shape of it now, Domine: the Domus feeds your strength, ' +
      'the Forum buys your friends, the Cursus builds your name, the provinces your fortune, ' +
      'the Curia your survival. I will keep the tablet current each season. ' +
      'The rest —" he almost smiles, "— is Rome\'s to inflict and yours to answer. ' +
      'The records, should you ever need a term explained, are in the Tabularium."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    isTutorial: true,
    choices: [
      {
        id: 'thank-philon',
        label: 'Thank you, Philon.',
        successEffect: 'lifetimeDignitas+2',
        failureEffect: '',
        successText:
          'Philon inclines his head and withdraws without further words. ' +
          'The tablet is yours now. The Republic has been waiting.',
      },
    ],
  },

];
