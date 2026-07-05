import type { EventDef } from '../models/event';

export const EVENT_DEFS: EventDef[] = [

  // ─── Class A — Acquisition events ─────────────────────────────────────────

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
        successEffect: 'fides+2',
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
        id: 'rhetoric',
        label: 'Appeal to his loyalty',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 4 },
        successEffect: 'lifetimeDignitas+2',
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
        successEffect: 'fides+3',
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
        successEffect: 'lifetimeDignitas+2',
        failureEffect: '',
      },
      {
        id: 'grant-coin',
        label: 'Give your word and a small purse (−10 Denarii)',
        successEffect: 'lifetimeDignitas+4|fides+2',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Stay out of it — too risky',
        successEffect: 'fides-1',
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
        successEffect: 'fides+4|popularesRel+3',
        failureEffect: '',
      },
      {
        id: 'endorse-speech',
        label: 'Endorse him and attend yourself',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 4 },
        successEffect: 'fides+6|fides+3|popularesRel+5',
        failureEffect: 'fides+2',
      },
      {
        id: 'decline',
        label: 'Decline — the timing is not right',
        successEffect: 'fides-2',
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
        successEffect: 'fides+2|fides+3',
        failureEffect: 'fides-1',
      },
      {
        id: 'help-coin',
        label: 'Smooth the way with coin instead (−12 Denarii)',
        successEffect: 'fides+4|denarii-12',
        failureEffect: '',
      },
      {
        id: 'decline',
        label: 'Politely decline',
        successEffect: 'fides-1',
        failureEffect: '',
      },
    ],
  },

  // ─── Part 2 — New event cards ─────────────────────────────────────────────

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
        successEffect: 'lifetimeDignitas+5',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'blackmail:cornelius-sulla|fides-5',
        failureEffect: '',
      },
      {
        id: 'refuse',
        label: 'Decline — you do not deal in whispers',
        successEffect: 'lifetimeDignitas+4|fides+2',
        failureEffect: '',
      },
      {
        id: 'counter',
        label: 'Counter-offer: take the information and give nothing',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'blackmail:cornelius-sulla',
        failureEffect: 'fides-8|lifetimeDignitas-3',
      },
    ],
  },

  {
    id: 'evt-borrowed-name',
    title: 'The Borrowed Name',
    bodyText:
      'A petitioner arrives claiming distant kinship with your family — he uses your name to access credit in the Subura and seek introductions among the equestrian class. Your steward brings you the report. The man is articulate and plausible. He is also entirely unknown to you.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'resource', key: 'lifetimeDignitas', op: 'gte', value: 20 },
    ],
    weight: 9,
    choices: [
      {
        id: 'confront',
        label: 'Have him brought to you and questioned',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'lifetimeDignitas+8|fides+3',
        failureEffect: 'lifetimeDignitas-5',
      },
      {
        id: 'legal',
        label: 'Send a lawyer — deal with it formally',
        successEffect: 'fides-8|lifetimeDignitas+4',
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
        successEffect: 'lifetimeDignitas+4',
        failureEffect: 'lifetimeDignitas-8|fides-3',
      },
      {
        id: 'pay-him-off',
        label: 'Pay him to disappear quietly (−20 Gold)',
        successEffect: 'gold-20',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'gold-50|plebs+15|lifetimeDignitas+12|fides+5|crisis-unrest-4',
        failureEffect: '',
      },
      {
        id: 'fund-partial',
        label: 'Make a modest contribution (−20 Gold)',
        successEffect: 'gold-20|plebs+6|lifetimeDignitas+5',
        failureEffect: '',
      },
      {
        id: 'do-nothing',
        label: 'Let the Senate handle it',
        successEffect: 'crisis-unrest+3|plebs-5',
        failureEffect: '',
      },
    ],
  },

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
        label: 'Take him in (−10 Fides)',
        successEffect: 'fides-10|addClient:votingSway:Disgraced Advocate:Lucius Caecilius',
        failureEffect: '',
      },
      {
        id: 'persuade',
        label: 'Persuade him to join for the honour alone',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'addClient:votingSway:Disgraced Advocate:Lucius Caecilius',
        failureEffect: 'lifetimeDignitas-2',
      },
      {
        id: 'refuse',
        label: 'Turn him away — his reputation is a liability',
        successEffect: 'fides+2',
        failureEffect: '',
      },
    ],
  },

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
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 4 },
        nextEventIdOnSuccess: 'evt-legion-deserters-reported',
        successEffect: '',
        failureEffect: 'lifetimeDignitas-4',
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
        successEffect: 'imperium+5|lifetimeDignitas+4',
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
        successEffect: 'corruption+8|fides+6|martialBonus+1',
        failureEffect: '',
      },
    ],
  },

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
        label: 'Spend Fides to investigate (−10 Fides)',
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
        successEffect: 'fides-10|blackmail:cornelius-sulla',
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
        successEffect: 'fides-10|lifetimeDignitas-4',
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
        successEffect: 'lifetimeDignitas-6|gold-15',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'gold+65|lifetimeDignitas+6',
        failureEffect: 'lifetimeDignitas-10',
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
        successEffect: 'lifetimeDignitas+14|fides+6|plebs+4',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-augurs-omen',
    title: "The Augur's Omen",
    bodyText:
      'The College of Augurs reports an ill omen over the city: a flight of ravens from the north, a stillbirth in the sacred flock. Half the Senate refuses to vote on substantive legislation until purification rites are performed. The rituals will take most of the season. Fides, already scarce, stretches thinner.',
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
        successEffect: 'fides-4',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'fides+2',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'lifetimeDignitas+5|gold-5|addClient:muscle:Retired Veteran:Titus Servilius',
        failureEffect: 'lifetimeDignitas+3',
      },
      {
        id: 'gift-send',
        label: 'Give him coin and wish him well (−10 Gold)',
        successEffect: 'gold-10|lifetimeDignitas+6',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'fides+8|fides+4|lifetimeDignitas+5',
        failureEffect: '',
      },
    ],
  },

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
        successEffect: 'gold-8|lifetimeDignitas+2',
        failureEffect: '',
      },
      {
        id: 'question-his-methods',
        label: 'Ask pointed questions about his methodology',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 3 },
        successEffect: 'gold-5|lifetimeDignitas+3',
        failureEffect: 'gold-8|lifetimeDignitas-2',
      },
      {
        id: 'dismiss-early',
        label: 'Dismiss him before he finishes and hire someone else',
        successEffect: 'gold-15|lifetimeDignitas-3',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-senatorial-crisis',
    title: 'A House Divided',
    bodyText:
      'The Senate has descended into open faction. Three senators came to blows in the vestibule this morning. The presiding consul was shouted down before he could speak. Legislation has stalled entirely. The city watches, and draws its own conclusions about the health of the Republic.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'rome', key: 'stability', op: 'lte', value: 25 },
    ],
    weight: 8,
    choices: [
      {
        id: 'speak-out',
        label: 'Address the Senate — call for order',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 5 },
        successEffect: 'stability+8|lifetimeDignitas+5|fides+3',
        failureEffect: 'lifetimeDignitas-4',
      },
      {
        id: 'back-faction',
        label: 'Back the stronger faction — pick a side',
        successEffect: 'fides+6|stability-4',
        failureEffect: '',
      },
      {
        id: 'wait',
        label: 'Wait — let the storm exhaust itself',
        successEffect: 'stability-3|crisis-constitution+2',   // Senate dysfunction frays constitution
        failureEffect: '',
      },
    ],
  },

  // ─── Single-track crisis threshold events (Chunk 2C) ──────────────────────
  // These fire through normal weighted random selection when their crisisTrack
  // condition is met. They give the player meaningful choices that can push the
  // track higher or lower, making crisis management active rather than passive.

  // WAR TRACK — tier 1→2 (level ≥ 40)
  {
    id: 'evt-war-frontier-threatened',
    title: 'Despatches From the Frontier',
    bodyText:
      'A courier arrives mud-caked and hollow-eyed. The frontier garrison at Cisalpina has been probed three times in a fortnight. The local commander requests instructions. The Senate, thus far, has not been formally informed. You have a moment in which to act before that changes.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'war', op: 'gte', value: 40 },
      { type: 'crisisTrack', track: 'war', op: 'lt',  value: 60 },
    ],
    weight: 7,
    choices: [
      {
        id: 'request-levy',
        label: 'Bring it immediately to the Senate and request authorisation',
        successEffect: 'fides+5|crisis-war-4',
        failureEffect: '',
      },
      {
        id: 'quiet-reinforcement',
        label: 'Send a private letter authorising the garrison commander to act',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'crisis-war-6|corruption+3',
        failureEffect: 'crisis-war+4|fides-4',
      },
      {
        id: 'wait-and-watch',
        label: 'Wait for the Senate to notice on its own terms',
        successEffect: 'crisis-war+5',
        failureEffect: '',
      },
    ],
  },

  // WAR TRACK — tier 2→3 (level ≥ 60)
  {
    id: 'evt-war-legions-recalled',
    title: 'The Legions Are Needed',
    bodyText:
      'Two dispatches arrive in the same morning. The first is from a frontier prefect describing conditions that can no longer be called skirmishes. The second is from the consul, requesting your family\'s assessment of how far from the city the crisis will be permitted to spread before the Senate acts. Both men are asking the same question in different language.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'war', op: 'gte', value: 60 },
    ],
    weight: 6,
    choices: [
      {
        id: 'champion-funding',
        label: 'Stand before the Senate and champion a war levy immediately',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+8|lifetimeDignitas+5|crisis-war-8',
        failureEffect: 'fides-4',
      },
      {
        id: 'coordinate-allies',
        label: 'Coordinate allied clan support before any Senate session',
        successEffect: 'fides-8|crisis-war-5',
        failureEffect: '',
      },
      {
        id: 'defer',
        label: 'Draft a measured reply — the Senate must deliberate',
        successEffect: 'crisis-war+6|fides+2',
        failureEffect: '',
      },
    ],
  },

  // UNREST TRACK — tier 1→2 (level ≥ 40)
  {
    id: 'evt-unrest-bread-riots',
    title: 'Bread Queues at the Granary',
    bodyText:
      'The Aventine is restless. Grain prices in the Subura have risen sharply for the third week running and the daily queues at the public granary now stretch to nightfall. Three bakers have shuttered their shops after reported threats. Your household steward estimates you have two weeks before this becomes something the aediles cannot contain quietly.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'unrest', op: 'gte', value: 40 },
      { type: 'crisisTrack', track: 'unrest', op: 'lt',  value: 60 },
    ],
    weight: 7,
    choices: [
      {
        id: 'fund-grain',
        label: 'Fund an emergency grain distribution from family reserves (−40 Gold)',
        successEffect: 'gold-40|plebs+10|lifetimeDignitas+6|crisis-unrest-6',
        failureEffect: '',
      },
      {
        id: 'push-grain-law',
        label: 'Announce your intention to table a grain subsidy bill immediately',
        successEffect: 'fides-5|plebs+5|crisis-unrest-3',
        failureEffect: '',
      },
      {
        id: 'wait-it-out',
        label: 'Leave it to the aediles — this is their jurisdiction',
        successEffect: 'crisis-unrest+5|plebs-4',
        failureEffect: '',
      },
    ],
  },

  // UNREST TRACK — tier 2→3 (level ≥ 60)
  {
    id: 'evt-unrest-tribune-rises',
    title: 'A Tribune Speaks',
    bodyText:
      'A tribune you do not recognise has been addressing crowds on the Capitoline for four consecutive days. He is not threatening anything, precisely. But he is naming the names of senators who voted against the grain subsidy, one per speech, with the particular tone of a man who has nothing to lose. The crowd is not rioting. It is listening, which is sometimes worse.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'unrest', op: 'gte', value: 60 },
    ],
    weight: 6,
    choices: [
      {
        id: 'outreach',
        label: 'Meet with him privately and offer to sponsor a grain bill jointly',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides-5|crisis-unrest-8|plebs+8',
        failureEffect: 'fides-5|crisis-unrest+4',
      },
      {
        id: 'games',
        label: 'Announce public games for next season — redirect the crowd',
        successEffect: 'denarii-60|plebs+12|crisis-unrest-5',
        failureEffect: '',
      },
      {
        id: 'ignore',
        label: 'He will exhaust himself. Say nothing.',
        successEffect: 'crisis-unrest+6',
        failureEffect: '',
      },
    ],
  },

  // CONSTITUTION TRACK — tier 1→2 (level ≥ 40)
  {
    id: 'evt-constitution-senate-split',
    title: 'The Senate Divides',
    bodyText:
      'The morning session dissolved without a quorum for the third consecutive week. Two senior optimates have publicly accused two populist tribunes of procedural manipulation. The tribunes have counter-accused the optimates of attempting to pack the senatorial rolls. Everyone is correct, and no one is governing.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'constitution', op: 'gte', value: 40 },
      { type: 'crisisTrack', track: 'constitution', op: 'lt',  value: 60 },
    ],
    weight: 6,
    choices: [
      {
        id: 'mediate',
        label: 'Propose a procedural compromise acceptable to both factions',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+6|lifetimeDignitas+5|crisis-constitution-6',
        failureEffect: 'fides-3|crisis-constitution+3',
      },
      {
        id: 'side-optimates',
        label: 'Publicly back the optimates — clarify where the Brutii stand',
        successEffect: 'optimatesRel+8|popularesRel-5|crisis-constitution-3',
        failureEffect: '',
      },
      {
        id: 'side-populares',
        label: 'Publicly back the tribunes — the people are watching',
        successEffect: 'popularesRel+8|optimatesRel-5|crisis-constitution-3',
        failureEffect: '',
      },
    ],
  },

  // CONSTITUTION TRACK — tier 2→3 (level ≥ 60)
  {
    id: 'evt-constitution-precedent-broken',
    title: 'The Precedent Has Been Broken',
    bodyText:
      'Word spreads through the Forum by mid-morning: the consul last night issued a decree bypassing the standard consular consultation. Whether it was technically legal has become the question every senator is arguing. Three tribunes have filed formal protests. The precedent itself — unbroken for one hundred and twenty years — is now in public dispute.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'constitution', op: 'gte', value: 60 },
    ],
    weight: 5,
    choices: [
      {
        id: 'denounce',
        label: 'Denounce the decree publicly — Rome\'s institutions must hold',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 7 },
        successEffect: 'fides+8|lifetimeDignitas+8|crisis-constitution-8',
        failureEffect: 'fides-4|crisis-constitution+4',
      },
      {
        id: 'defend',
        label: 'Defend the decree — emergency times require emergency measures',
        successEffect: 'fides+4|crisis-constitution+6',
        failureEffect: '',
      },
      {
        id: 'abstain',
        label: 'Say nothing — let lawyers debate while you work behind the scenes',
        successEffect: 'crisis-constitution+3|fides-2',
        failureEffect: '',
      },
    ],
  },

  // ECONOMY TRACK — tier 1→2 (level ≥ 40)
  {
    id: 'evt-economy-debt-collector',
    title: 'The Creditors Are Patient Men',
    bodyText:
      'Your estate manager brings you an unusual morning report: three different banking houses have sent representatives this week, not to demand payment, but to "enquire after the family\'s plans." The tone is polite. The implication is not. The treasury is not empty — but Rome\'s commercial class believes it soon will be.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'economy', op: 'gte', value: 40 },
      { type: 'crisisTrack', track: 'economy', op: 'lt',  value: 60 },
    ],
    weight: 7,
    choices: [
      {
        id: 'reassure-coin',
        label: 'Host a dinner for the banking representatives — demonstrate solvency (−30 Denarii)',
        successEffect: 'denarii-30|fides+4|crisis-economy-5',
        failureEffect: '',
      },
      {
        id: 'push-tax-bill',
        label: 'Announce your intention to table a treasury replenishment bill',
        successEffect: 'fides-4|crisis-economy-3',
        failureEffect: '',
      },
      {
        id: 'ignore',
        label: 'Send them away — the Brutii do not explain themselves to moneylenders',
        successEffect: 'crisis-economy+5',
        failureEffect: '',
      },
    ],
  },

  // ECONOMY TRACK — tier 2→3 (level ≥ 60)
  {
    id: 'evt-economy-scarcity-bites',
    title: 'The Price of Everything',
    bodyText:
      'Your steward\'s monthly accounts reveal something no one has said aloud: the cost of maintaining the household has risen thirty percent in two years. He presents the numbers without comment, which is itself a comment. In the market, the price of iron, timber, and grain has all risen simultaneously, the way prices do when something has gone genuinely wrong rather than merely inconvenient.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'crisisTrack', track: 'economy', op: 'gte', value: 60 },
    ],
    weight: 6,
    choices: [
      {
        id: 'austerity',
        label: 'Impose household austerity — cut expenditure across the board',
        successEffect: 'fides-3|lifetimeDignitas-3|crisis-economy-5',
        failureEffect: '',
      },
      {
        id: 'invest-province',
        label: 'Redirect capital toward provincial investments — long-term play',
        successEffect: 'denarii-40|crisis-economy-3',
        failureEffect: '',
      },
      {
        id: 'nothing',
        label: 'Rome has survived worse. Continue as before.',
        successEffect: 'crisis-economy+6',
        failureEffect: '',
      },
    ],
  },

  // ─── Multi-ticker crisis events (Chunk 2C) ────────────────────────────────
  // Weight 0 — fire ONLY via turnSequencer step 5a injection when multiCrisis
  // conditions are met. Never fired through pickRandomEvent.
  // Cooldown flags prevent repeat firing (see turnSequencer end-of-turn maintenance).

  // Unrest ≥ 65 + Constitution ≥ 65
  {
    id: 'evt-gracchan-moment',
    title: 'A Voice in the Forum',
    bodyText:
      'A tribune named Sempronius has been speaking in the Forum for a week — not cautiously, not with the hedged language of a man managing risk. He is calling for land redistribution, for limits on senatorial landholding, for a commission with actual power. The crowd is larger every morning. The Senate is deciding whether to laugh or to panic.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'multiCrisis', conditions: [
      { track: 'unrest', op: 'gte', value: 65 },
      { track: 'constitution', op: 'gte', value: 65 },
    ]}],
    weight: 0,
    choices: [
      {
        id: 'support-reform',
        label: "Publicly support Sempronius' reform demand",
        successEffect: 'crisis-unrest-10|crisis-constitution+8|fides+8',
        failureEffect: '',
      },
      {
        id: 'oppose',
        label: 'Side with the Senate against him',
        successEffect: 'crisis-constitution-6|crisis-unrest+8|fides+5',
        failureEffect: '',
      },
      {
        id: 'neutrality',
        label: 'Say nothing — let it resolve itself',
        successEffect: 'crisis-constitution+4|crisis-unrest+4',
        failureEffect: '',
        nextEventIdOnSuccess: 'evt-gracchan-aftermath',
      },
    ],
  },

  {
    id: 'evt-gracchan-aftermath',
    title: 'The Reform Crisis Deepens',
    bodyText:
      'Your silence was noted. Sempronius has made it part of his speeches — "even the Brutii, who have benefited so greatly from the current arrangement, could not bring themselves to defend it." The land commission debate has moved to a Senate vote. You are called upon to declare.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'support-commission',
        label: 'Vote for the land commission',
        successEffect: 'crisis-unrest-8|crisis-constitution+5|popularesRel+10|optimatesRel-8',
        failureEffect: '',
      },
      {
        id: 'oppose-commission',
        label: 'Vote against it',
        successEffect: 'crisis-constitution-4|crisis-unrest+10|optimatesRel+8|popularesRel-10',
        failureEffect: '',
      },
    ],
  },

  // War ≥ 70 + Constitution ≥ 70
  {
    id: 'evt-senate-cannot-act',
    title: 'The Senate Cannot Act',
    bodyText:
      'A dispatch arrives from the frontier requesting immediate authorisation for emergency levies. The Senate convenes in emergency session. Four hours later, the session adjourns with no vote taken, no quorum maintained, and two senators having left through different doors rather than pass each other in the corridor. The frontier dispatch sits on the table, unanswered.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'multiCrisis', conditions: [
      { track: 'war', op: 'gte', value: 70 },
      { track: 'constitution', op: 'gte', value: 70 },
    ]}],
    weight: 0,
    choices: [
      {
        id: 'senatus-consultum',
        label: 'Issue a consular emergency decree (requires Consul office)',
        successEffect: 'crisis-war-8|crisis-constitution+6|fides-15',
        failureEffect: '',
      },
      {
        id: 'broker-emergency',
        label: 'Broker an emergency bipartisan agreement (−20 Fides)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 8 },
        successEffect: 'fides-20|crisis-war-6|crisis-constitution-5',
        failureEffect: 'fides-20|crisis-war+5',
      },
      {
        id: 'do-nothing',
        label: "Do nothing — the Senate must find its own way",
        successEffect: 'crisis-war+8|crisis-constitution+4',
        failureEffect: '',
      },
    ],
  },

  // All four tracks ≥ 60
  {
    id: 'evt-republic-trembles',
    title: 'The Republic Trembles',
    bodyText:
      "It is winter. The frontier holds, but barely. The treasury is empty. The Aventine is quiet with the wrong kind of quiet. In the Senate, men who have not spoken civilly to each other in years sit in the same chamber, aware that something is ending and uncertain whether what replaces it will include them. Your steward has placed the family seals within easy reach, for reasons neither of you has said aloud.",
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'multiCrisis', conditions: [
      { track: 'war', op: 'gte', value: 60 },
      { track: 'unrest', op: 'gte', value: 60 },
      { track: 'constitution', op: 'gte', value: 60 },
      { track: 'economy', op: 'gte', value: 60 },
    ]}],
    weight: 0,
    choices: [
      {
        id: 'consolidate-power',
        label: "Begin consolidating your family's position for whatever comes next",
        successEffect: 'lifetimeDignitas+5|fides-10|setFlag:family-consolidating:true',
        failureEffect: '',
      },
      {
        id: 'attempt-stabilise',
        label: "Make a public commitment to defend the Republic's institutions",
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 7 },
        successEffect: 'crisis-constitution-8|fides+10|lifetimeDignitas+8',
        failureEffect: 'fides-5',
      },
      {
        id: 'wait',
        label: 'Do nothing — let events determine who survives',
        successEffect: 'fides-5',
        failureEffect: '',
      },
    ],
  },

  // ─── Inject-only crisis response events ───────────────────────────────────
  // Fired by turnSequencer when specific crisis special effects trigger.

  // Fired by turnSequencer step 5c when Unrest tier ≥ 3 (15% chance per season)
  {
    id: 'evt-grain-riot',
    title: 'Grain Riots in the Aventine',
    bodyText:
      'Your morning is interrupted before it begins. Smoke is visible above the Aventine and the sounds from the Subura are not of commerce. The aediles\' watch is overwhelmed. A granary has been forced open and at least two merchants beaten. The riot is not yet large — but it has a logic to it, the kind that makes other people join in.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'distribute-grain',
        label: 'Open your own stores to the crowd immediately (−25 Gold)',
        successEffect: 'gold-25|crisis-unrest-6|plebs+8',
        failureEffect: '',
      },
      {
        id: 'call-watch',
        label: 'Call in the city watch and contain it — no concessions',
        skillCheck: { characterId: 'player', skill: 'martial', difficulty: 5 },
        successEffect: 'crisis-unrest-3|fides+4',
        failureEffect: 'crisis-unrest+5|fides-4',
      },
      {
        id: 'wait-it-out',
        label: 'Stay home — it will burn itself out',
        successEffect: 'crisis-unrest+8|plebs-6',
        failureEffect: '',
      },
    ],
  },

  // Fired by turnSequencer step 5d when Economy tier ≥ 4 (once per year)
  {
    id: 'evt-creditors-demand',
    title: 'The Creditors Arrive',
    bodyText:
      'Three men from different banking houses arrive on the same morning — separately, but they know each other. They do not ask for payment. They ask, with the patience of men who have other options, for "clarity regarding the Republic\'s intentions with respect to outstanding obligations." What they mean is: the coin is running out, they know it, and they would like something in writing before the situation becomes unmanageable. The meeting lasts an hour. You leave it poorer in spirit if not yet in money. A loss of twenty denarii follows by the end of the week regardless.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'pay-quietly',
        label: 'Pay the twenty denarii with as much dignity as possible',
        successEffect: 'denarii-20|crisis-economy-3',
        failureEffect: '',
      },
      {
        id: 'negotiate',
        label: 'Negotiate a structured repayment arrangement (−20 Denarii, buy time)',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 6 },
        successEffect: 'denarii-20|fides+3|crisis-economy-5',
        failureEffect: 'denarii-20|crisis-economy+5',
      },
      {
        id: 'refuse',
        label: 'Refuse payment and show them out — Rome does not answer to financiers',
        successEffect: 'denarii-20|crisis-economy+8|fides-5',
        failureEffect: '',
      },
    ],
  },

];
