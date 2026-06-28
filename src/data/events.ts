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

  // ─── Part 2 — New event cards (rome-event-cards-spec.md) ──────────────────

  // EVENT 1 — The Ambitious Freedman
  {
    id: 'evt-ambitious-freedman',
    title: 'The Ambitious Freedman',
    bodyText:
      'Philemon, a man your grandfather once owned, has grown rich through grain trading. He appears at your door, well-dressed and smiling, with a proposition: a share of his operation, in exchange for the protection of your name. It is a crass arrangement. It is also a profitable one.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 8,
    choices: [
      {
        id: 'accept',
        label: 'Accept the arrangement (gain a client)',
        successEffect: 'addClient:publicSupport:Grain Factor:Philemon',
        failureEffect: '',
      },
      {
        id: 'decline',
        label: 'Decline — you are above commerce with freedmen',
        successEffect: 'dignitas+5',
        failureEffect: '',
      },
    ],
  },

  // EVENT 2 — The Whisper in the Baths
  {
    id: 'evt-whisper-baths',
    title: 'The Whisper in the Baths',
    bodyText:
      'A senator approaches you at the baths — relaxed, off-guard, in the way men only are when half-undressed. He leans close and offers you information: compromising correspondence between a rival and a Carthaginian merchant. The offer is clear. He wants something in return.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'clientCount', clientType: 'muscle', op: 'gt', value: 0 },
    ],
    weight: 7,
    choices: [
      {
        id: 'accept-deal',
        label: 'Accept the exchange — information for a favour',
        successEffect: 'blackmail:cornelius-sulla|gratia-5',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Decline — you do not deal in whispers',
        successEffect: 'dignitas+4|gravitas+2',
        failureEffect: '',
      },
      {
        id: 'counter',
        label: 'Counter-offer: take the information and give nothing',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'blackmail:cornelius-sulla',
        failureEffect: 'gratia-8|dignitas-3',
      },
    ],
  },

  // EVENT 3 — The Borrowed Name (branching)
  {
    id: 'evt-borrowed-name',
    title: 'The Borrowed Name',
    bodyText:
      'A petitioner arrives claiming distant kinship with your family — he uses your name to access credit in the Subura and seek introductions among the equestrian class. Your steward brings you the report. The man is articulate and plausible. He is also entirely unknown to you.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'resource', key: 'dignitas', op: 'gte', value: 20 },
    ],
    weight: 9,
    choices: [
      {
        id: 'confront',
        label: 'Have him brought to you and questioned',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'dignitas+8|gratia+3',
        failureEffect: 'dignitas-5',
      },
      {
        id: 'legal',
        label: 'Send a lawyer — deal with it formally',
        successEffect: 'gratia-8|dignitas+4',
        failureEffect: '',
      },
      {
        id: 'ignore',
        label: 'Ignore it — beneath your attention',
        nextEventId: 'evt-borrowed-name-followup',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  // Follow-up: weight 0 — only fires via nextEventId
  {
    id: 'evt-borrowed-name-followup',
    title: 'The Borrowed Name Returns',
    bodyText:
      'You did nothing, and the man grew bolder. He is now claiming your family supported his candidacy for a minor municipal post. Two senators have mentioned it to you, with raised eyebrows. The fiction has become a nuisance that must be addressed.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'act-late',
        label: 'Expose him publicly now',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'dignitas+4',
        failureEffect: 'dignitas-8|gravitas-3',
      },
      {
        id: 'pay-him-off',
        label: 'Pay him to disappear quietly (−20 Gold)',
        successEffect: 'gold-20',
        failureEffect: '',
      },
    ],
  },

  // EVENT 4 — Grain Shortage in the City
  {
    id: 'evt-grain-shortage',
    title: 'Grain Shortage in the City',
    bodyText:
      'The Tiber has flooded the granaries at Ostia. The aediles are overwhelmed and the plebs grow restless. Bread queues stretch past sundown. A senator of means could ease the tension — and earn the gratitude of the city. Or he could wait and see whether the Senate moves first.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'resource', key: 'crisisLevel', op: 'gte', value: 25 },
    ],
    weight: 10,
    choices: [
      {
        id: 'fund-fully',
        label: 'Fund a full grain distribution (−50 Gold)',
        successEffect: 'gold-50|plebs+15|dignitas+12|gravitas+5|crisis-4',
        failureEffect: '',
      },
      {
        id: 'fund-partial',
        label: 'Make a modest contribution (−20 Gold)',
        successEffect: 'gold-20|plebs+6|dignitas+5',
        failureEffect: '',
      },
      {
        id: 'do-nothing',
        label: 'Let the Senate handle it',
        successEffect: 'crisis+3|plebs-5',
        failureEffect: '',
      },
    ],
  },

  // EVENT 5 — The Disgraced Advocate
  {
    id: 'evt-disgraced-advocate',
    title: 'The Disgraced Advocate',
    bodyText:
      'Lucius Caecilius was once the finest legal mind in the Forum — until he botched the defence of a senator and left the man to exile. His reputation is dust. He sits outside your door at dawn, scroll-case in hand, looking for any patron willing to overlook his history. His skills, however, remain extraordinary.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 7,
    choices: [
      {
        id: 'hire',
        label: 'Take him in (−10 Gratia)',
        successEffect: 'gratia-10|addClient:votingSway:Disgraced Advocate:Lucius Caecilius',
        failureEffect: '',
      },
      {
        id: 'persuade',
        label: 'Persuade him to join for the honour alone',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'addClient:votingSway:Disgraced Advocate:Lucius Caecilius',
        failureEffect: 'dignitas-2',
      },
      {
        id: 'refuse',
        label: 'Turn him away — his reputation is a liability',
        successEffect: 'gravitas+2',
        failureEffect: '',
      },
    ],
  },

  // EVENT 6 — Legion Deserters (branching)
  {
    id: 'evt-legion-deserters',
    title: 'Legion Deserters',
    bodyText:
      'Three legionaries from your cohort slipped away in the night — taking their arms and a mule. The camp prefect knows they were under your watch. He stands before you at dawn, expression unreadable. The commander has been informed. He is waiting for your report.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'office', held: 'military-tribune' },
    ],
    weight: 9,
    choices: [
      {
        id: 'report',
        label: 'Report them truthfully',
        skillCheck: { characterId: 'player', skill: 'auctoritas', difficulty: 4 },
        nextEventIdOnSuccess: 'evt-legion-deserters-reported',
        successEffect: '',
        failureEffect: 'dignitas-4',
      },
      {
        id: 'cover',
        label: 'Cover for them — they are good soldiers in a bad season',
        nextEventId: 'evt-legion-deserters-covered',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-legion-deserters-reported',
    title: 'Deserters Reported',
    bodyText:
      'You gave an honest account. The commander nodded. Two of the three were caught within the week. The third was not. You watch the punishment administered and say nothing. The men in your century are quieter with you now. But the commander knows you can be trusted.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'dismiss',
        label: 'Return to your duties',
        successEffect: 'imperium+5|dignitas+4',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-legion-deserters-covered',
    title: 'A Quiet Word',
    bodyText:
      'You told the prefect the men were on a scouting errand, authorised by you. He looked at you for a long moment, then wrote it down. The three men are never found. Your century is loyal to a fault thereafter — but the camp prefect watches you differently. You are not sure whether that is respect or suspicion.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'dismiss',
        label: 'Carry the secret',
        successEffect: 'corruption+8|gratia+6|martialBonus+1',
        failureEffect: '',
      },
    ],
  },

  // EVENT 7 — The Rival's Agent (branching)
  {
    id: 'evt-rivals-agent',
    title: "The Rival's Agent",
    bodyText:
      "Your steward reports that a man has been asking questions in the Forum about your family's financial arrangements — specifically, the source of your most recent land purchases. He has spoken to three men who owe you favours. Your steward does not know who sent him.",
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'resource', key: 'crisisLevel', op: 'gte', value: 10 },
    ],
    weight: 8,
    choices: [
      {
        id: 'investigate',
        label: 'Spend Gratia to investigate (−10 Gratia)',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        nextEventIdOnSuccess: 'evt-rivals-agent-turned',
        nextEventIdOnFailure: 'evt-rivals-agent-failed',
        successEffect: '',
        failureEffect: '',
      },
      {
        id: 'ignore',
        label: 'Do nothing — you have nothing to hide',
        nextEventId: 'evt-rivals-agent-ignored',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-rivals-agent-turned',
    title: 'The Agent Speaks',
    bodyText:
      'Your men found him quickly. He was not difficult to persuade — his employer, it turns out, underpaid him. For a modest additional sum, he provided a name: the agent was hired by a leader of the Cornelii faction. You now hold the string, not them.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'use-intel',
        label: 'File the intelligence away',
        successEffect: 'gratia-10|blackmail:cornelius-sulla',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-rivals-agent-failed',
    title: 'Nothing Found',
    bodyText:
      'Your men turned the Subura upside down and came back empty-handed. The agent has vanished. Whoever sent him was better prepared than you anticipated. You notice, over the following weeks, that two of your regular contacts have become more cautious with their words.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'accept-loss',
        label: 'Accept the setback',
        successEffect: 'gratia-10|dignitas-4',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-rivals-agent-ignored',
    title: 'The Questions Spread',
    bodyText:
      'You ignored it, and the questions multiplied. By the end of the season, two equestrian lenders have quietly declined to do business with you, citing "irregularities". The damage is not severe — but it is real, and it came from your own inaction.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'absorb',
        label: 'Absorb the reputational damage',
        successEffect: 'dignitas-6|gold-15',
        failureEffect: '',
      },
    ],
  },

  // EVENT 8 — An Unexpected Bequest
  {
    id: 'evt-unexpected-bequest',
    title: 'An Unexpected Bequest',
    bodyText:
      "A distant kinsman dies in Brundisium without heirs. His estate — a modest farm and a sum of gold — passes to you by Roman law. Before the ink is dry, a rival clan contests the will. Their advocate is capable; yours will need to be better. Alternatively, you could accept the settlement they offer, or donate the estate publicly and let dignity be your profit.",
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'resource', key: 'denarii', op: 'lte', value: 120 },
    ],
    weight: 6,
    choices: [
      {
        id: 'contest',
        label: 'Contest the challenge in court',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'gold+65|dignitas+6',
        failureEffect: 'dignitas-10',
      },
      {
        id: 'settle',
        label: 'Accept the offered settlement (guaranteed +25 Gold)',
        successEffect: 'gold+25',
        failureEffect: '',
      },
      {
        id: 'donate',
        label: "Donate the estate publicly in your family's name",
        successEffect: 'dignitas+14|gravitas+6|plebs+4',
        failureEffect: '',
      },
    ],
  },

  // EVENT 9 — The Augur's Omen
  {
    id: 'evt-augurs-omen',
    title: "The Augur's Omen",
    bodyText:
      'The College of Augurs reports an ill omen over the city: a flight of ravens from the north, a stillbirth in the sacred flock. Half the Senate refuses to vote on substantive legislation until purification rites are performed. The rituals will take most of the season. Gravitas, already scarce, stretches thinner.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'season', index: 3 },
      { type: 'resource', key: 'crisisLevel', op: 'gte', value: 15 },
    ],
    weight: 6,
    choices: [
      {
        id: 'acknowledge',
        label: 'Acknowledge the omen',
        successEffect: 'gravitas-4',
        failureEffect: '',
      },
    ],
  },

  // EVENT 10 — The Greek Philosopher
  {
    id: 'evt-greek-philosopher',
    title: 'The Greek Philosopher',
    bodyText:
      "A Stoic philosopher of some renown has taken rooms near the Aventine and begun offering instruction. Several of Rome's better families have sent their sons. Your household steward suggests the same. It is, he notes carefully, what the Scipiones would do.",
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'season', index: 0 },
    ],
    weight: 5,
    choices: [
      {
        id: 'send',
        label: 'Send your youngest son to study with him (−5 Gold)',
        successEffect: 'gold-5|rhetoric+1',
        failureEffect: '',
      },
      {
        id: 'decline',
        label: 'Decline — there is Greek enough in Rome already',
        successEffect: 'gravitas+2',
        failureEffect: '',
      },
    ],
  },

  // EVENT 11 — Bread and Circuses
  {
    id: 'evt-bread-and-circuses',
    title: 'Bread and Circuses',
    bodyText:
      'The Cornelii have funded games in the Circus Maximus. Three days of chariot races, beast hunts, and free grain. The crowd chants the Cornelian name until nightfall. Your own clients return home talking of little else. It is, you must admit, well done.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'rome', key: 'plebs', op: 'lte', value: 50 },
    ],
    weight: 7,
    choices: [
      {
        id: 'watch',
        label: 'Note it — and plan your response',
        successEffect: 'npcDignitas:cornelii-clan:+10|plebs+5',
        failureEffect: '',
      },
    ],
  },

  // EVENT 12 — The Returning Soldier
  {
    id: 'evt-returning-soldier',
    title: 'The Returning Soldier',
    bodyText:
      "A grizzled man appears at your gate, bearing your family's old military standard — stolen, lost, or simply carried home across thirty years of campaigns. He says he served under your grandfather at the Metaurus. He is looking for work, or failing that, a square meal and a kind word before he moves on.",
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'season', index: 2 },
    ],
    weight: 6,
    choices: [
      {
        id: 'take-in',
        label: 'Take him into your household (−5 Gold)',
        successEffect: 'gold-5|addClient:muscle:Retired Veteran:Titus Servilius',
        failureEffect: '',
      },
      {
        id: 'listen',
        label: 'Sit with him and hear his stories',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 3 },
        successEffect: 'dignitas+5|gold-5|addClient:muscle:Retired Veteran:Titus Servilius',
        failureEffect: 'dignitas+3',
      },
      {
        id: 'gift-send',
        label: 'Give him coin and wish him well (−10 Gold)',
        successEffect: 'gold-10|dignitas+6',
        failureEffect: '',
      },
    ],
  },

  // EVENT 13 — Feast at the Consul's Villa
  {
    id: 'evt-consular-feast',
    title: "Feast at the Consul's Villa",
    bodyText:
      "The Consul hosts the great families of Rome at his villa on the Palatine. The wine is Falernian. The conversation is generous. It is the kind of evening that only happens when Rome is, for once, not on fire. Old alliances are quietly renewed. You leave later than intended, and better disposed toward several men you had forgotten to like.",
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'rome', key: 'stability', op: 'gte', value: 60 },
      { type: 'resource', key: 'crisisLevel', op: 'lte', value: 20 },
    ],
    weight: 5,
    choices: [
      {
        id: 'enjoy',
        label: 'An evening well spent',
        successEffect: 'gratia+8|gravitas+4|dignitas+5',
        failureEffect: '',
      },
    ],
  },

  // EVENT 14 — It is-a Me, Marius
  {
    id: 'evt-marius-the-plumber',
    title: 'It is-a Me, Marius',
    bodyText:
      'The hypocaust beneath your townhouse has failed — again. Your steward sends for a plumber with a good reputation in the Subura. The man who arrives is short, broad, and wearing an extraordinarily large hat. He surveys the burst pipe with one eyebrow raised and announces, with considerable solemnity: "Do not-a worry. It is-a me — Marius, the plumber." He gestures at the damage. "I have-a seen worse."',
    imageKey: 'marius-plumber',
    conditions: [],
    weight: 3,
    choices: [
      {
        id: 'let-him-work',
        label: 'Stand back and let the man work',
        successEffect: 'gold-8|dignitas+2',
        failureEffect: '',
      },
      {
        id: 'question-his-methods',
        label: 'Ask pointed questions about his methodology',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 3 },
        successEffect: 'gold-5|dignitas+3',
        failureEffect: 'gold-8|dignitas-2',
      },
      {
        id: 'dismiss-early',
        label: 'Dismiss him before he finishes and hire someone else',
        successEffect: 'gold-15|dignitas-3',
        failureEffect: '',
      },
    ],
  },
];
