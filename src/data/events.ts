import type { EventDef } from '../models/event';

export const EVENT_DEFS: EventDef[] = [

  // ─── Class A — Acquisition events ─────────────────────────────────────────
  // No hasClient condition. {clientName} is pre-generated at render time by
  // EventCard.tsx and committed to state only if the player accepts.

  {
    id: 'evt-client-muscle-offer',
    title: 'A Man With Useful Skills',
    bodyText:
      'A scarred freedman named {clientName} approaches your steward. He offers his ' +
      'services — and those of his associates — to the Brutii. No questions asked.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 7,
    choices: [
      {
        id: 'accept',
        label: 'Welcome him into the household',
        successEffect: 'addClient:muscle',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Send him away',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-client-support-offer',
    title: 'A Voice for the People',
    bodyText:
      'A plebeian advocate named {clientName} has been singing the praises of the ' +
      'Brutii in the Forum. He seeks formal patronage in return.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 7,
    choices: [
      {
        id: 'accept',
        label: 'Grant him patronage',
        successEffect: 'addClient:publicSupport',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Decline — you need no mouthpiece',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-client-votes-offer',
    title: 'The Ward Boss',
    bodyText:
      '{clientName}, a minor ward organiser, controls a modest bloc of tribal votes. ' +
      'He is willing to deliver them — for the right patron.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 6,
    choices: [
      {
        id: 'accept',
        label: 'Take him on as a client',
        successEffect: 'addClient:votingSway',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Decline',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  // ─── Class B — Retention / loss events ────────────────────────────────────
  // Require hasClient condition. {clientName} is resolved at injection time by
  // turnSequencer.ts (oldest client of the relevant type). At least one choice
  // has a removeClient: effect.

  {
    id: 'evt-client-muscle-trouble',
    title: 'A Problem With the Help',
    bodyText:
      '{clientName}, one of your Muscle clients, has badly beaten a man in the street ' +
      '— a man with connections. The matter requires handling.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'hasClient', clientType: 'muscle' }],
    weight: 6,
    choices: [
      {
        id: 'pay',
        label: 'Settle it with coin (−30 Denarii)',
        successEffect: 'denarii-30',
        failureEffect: '',
      },
      {
        id: 'rhetoric',
        label: 'Smooth it over personally',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 5 },
        successEffect: 'gravitas+2',
        failureEffect: 'removeClient:muscle',
      },
      {
        id: 'abandon',
        label: 'Disavow him entirely',
        successEffect: 'removeClient:muscle',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-client-support-drift',
    title: 'The Advocate Grows Restless',
    bodyText:
      '{clientName}, one of your public advocates, feels his efforts go unrecognised. ' +
      'He has been approached by the Fabii.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'hasClient', clientType: 'publicSupport' }],
    weight: 5,
    choices: [
      {
        id: 'retain',
        label: 'Reassure him with a gift (−15 Denarii)',
        successEffect: 'denarii-15',
        failureEffect: '',
      },
      {
        id: 'auctoritas',
        label: 'Appeal to his loyalty',
        skillCheck: { characterId: 'player', skill: 'auctoritas', difficulty: 4 },
        successEffect: 'dignitas+2',
        failureEffect: 'removeClient:publicSupport',
      },
      {
        id: 'release',
        label: 'Let him go to the Fabii',
        successEffect: 'removeClient:publicSupport',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-client-votes-defection',
    title: 'A Better Offer',
    bodyText:
      '{clientName}, your ward organiser, has received a substantial offer from ' +
      'Claudius Pulcher. He comes to you first — out of courtesy, he says.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'hasClient', clientType: 'votingSway' }],
    weight: 5,
    choices: [
      {
        id: 'outbid',
        label: 'Outbid Pulcher (−25 Denarii)',
        successEffect: 'denarii-25',
        failureEffect: '',
      },
      {
        id: 'intrigue',
        label: "Undermine Pulcher's offer quietly",
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'gratia+3',
        failureEffect: 'removeClient:votingSway',
      },
      {
        id: 'release',
        label: 'Wish him well and release him',
        successEffect: 'removeClient:votingSway',
        failureEffect: '',
      },
    ],
  },

  // ─── Class C — Favour / help events ───────────────────────────────────────
  // Require hasClient condition. {clientName} resolved at injection. No
  // removeClient: effects — refusing costs a small resource only.

  {
    id: 'evt-client-muscle-favour',
    title: 'A Word of Protection',
    bodyText:
      '{clientName} comes to you quietly. A neighbour has been making threats against ' +
      'his family. He asks only that your name be invoked — nothing more.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'hasClient', clientType: 'muscle' }],
    weight: 6,
    choices: [
      {
        id: 'grant',
        label: 'Give him your word freely',
        successEffect: 'dignitas+2',
        failureEffect: '',
      },
      {
        id: 'grant-coin',
        label: 'Give your word and a small purse (−10 Denarii)',
        successEffect: 'dignitas+4|gratia+2',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Stay out of it — too risky',
        successEffect: 'gravitas-1',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-client-support-request',
    title: 'The Advocate Needs a Platform',
    bodyText:
      '{clientName} has been offered a chance to speak at a minor assembly — but ' +
      'only if a senator of standing endorses him. He asks for your name.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'hasClient', clientType: 'publicSupport' }],
    weight: 6,
    choices: [
      {
        id: 'endorse',
        label: 'Endorse him publicly',
        successEffect: 'gratia+4|popularesRel+3',
        failureEffect: '',
      },
      {
        id: 'endorse-speech',
        label: 'Endorse him and attend yourself',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 4 },
        successEffect: 'gratia+6|gravitas+3|popularesRel+5',
        failureEffect: 'gratia+2',
      },
      {
        id: 'decline',
        label: 'Decline — the timing is not right',
        successEffect: 'gratia-2',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-client-votes-canvass',
    title: 'The Organiser Calls In a Favour',
    bodyText:
      '{clientName} asks you to put in a quiet word with a senior senator on behalf ' +
      'of his ward. A small thing — but he will remember it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'hasClient', clientType: 'votingSway' }],
    weight: 5,
    choices: [
      {
        id: 'help',
        label: 'Speak to the senator',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 3 },
        successEffect: 'gravitas+2|gratia+3',
        failureEffect: 'gravitas-1',
      },
      {
        id: 'help-coin',
        label: 'Smooth the way with coin instead (−12 Denarii)',
        successEffect: 'gratia+4|denarii-12',
        failureEffect: '',
      },
      {
        id: 'decline',
        label: 'Politely decline',
        successEffect: 'gravitas-1',
        failureEffect: '',
      },
    ],
  },
];
