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

  // ─── Class B — Crisis threshold events (weight 0, inject-only) ────────────

  // Fired by turnSequencer step 5c when Unrest tier ≥ 3 (15% chance per season)
  {
    id: 'evt-grain-riot',
    title: 'Grain Riots in the Subura',
    bodyText:
      'The Subura is burning. Or at least, three insulae are. The grain price doubled overnight — ' +
      'someone is hoarding, or someone is incompetent, or both. Either way, the mob does not ' +
      'distinguish between causes and consequences. They want bread, and they want it now.',
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

  // ─── Chunk 1D — NPC consul, Tribune, Dictator events (weight 0, inject-only) ─

  // Fired by npcConsulEngine.tickNpcConsul at antagonism 2 (15%) or 3 (30%).
  // bodyText is overridden dynamically at injection time with the consul's name and clan.
  {
    id: 'evt-npc-consul-opposes',
    title: 'Your Colleague Acts Against You',
    bodyText:
      'Your co-consul has used his authority to publicly oppose your family\'s position in the ' +
      'Senate. He spoke at length, drawing applause from his allies. The chamber watched to see ' +
      'how you would respond.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'confront',
        label: 'Confront him publicly (Rhetoric check, difficulty 6)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+8|setFlag:consul-confrontation-won:true',
        failureEffect: 'fides-5',
      },
      {
        id: 'ignore',
        label: 'Say nothing — let it pass',
        successEffect: 'fides-3',
        failureEffect: '',
      },
      {
        id: 'negotiate',
        label: 'Offer a private concession (−15 Denarii)',
        successEffect: 'gold-15|fides+4',
        failureEffect: '',
      },
    ],
  },

  // Fired by turnSequencer step 9i when tribuneHostilityDebt[clanId] >= 20.
  // A clan retaliates after repeated veto use by the Tribune.
  {
    id: 'evt-tribune-veto-retaliation',
    title: 'The Vetoed Clan Responds',
    bodyText:
      'A senior member of the clan whose bills you have blocked arrives at your domus unannounced. ' +
      'He does not threaten — men of his standing do not threaten directly. He simply describes, ' +
      'in careful detail, the things that tend to happen to families who accumulate too many enemies ' +
      'in the Senate. His clan\'s allies have taken note of your tribunate. They are keeping records.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'appease',
        label: 'Offer a concession and smooth things over (−10 Fides)',
        successEffect: 'fides-10',
        failureEffect: '',
      },
      {
        id: 'stand-firm',
        label: 'Stand firm — the Tribune\'s veto is constitutional and beyond reproach',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 5 },
        successEffect: 'fides+3',
        failureEffect: 'fides-8|crisis-constitution+3',
      },
      {
        id: 'invoke-immunity',
        label: 'Invoke tribunician sacrosanctity — remind them what it means to threaten a Tribune',
        successEffect: 'fides+5|setFlag:sacrosanctity-invoked:true',
        failureEffect: '',
      },
    ],
  },

  // Fired by turnSequencer step 2b when resolveElection returns contested: true.
  {
    id: 'evt-election-contested',
    title: 'The Result Is Challenged',
    bodyText:
      'Rivals are not conceding. Three days after the comitia, a formal challenge has been ' +
      'lodged with the presiding magistrate. Your opponents claim irregularities in the tribal ' +
      'count. The challenge may go nowhere — but it will cost you time, political capital, and ' +
      'the appearance of certainty that a new officeholder needs.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'accept-result',
        label: 'Accept the process — let the magistrates rule',
        successEffect: 'fides-5',
        failureEffect: '',
      },
      {
        id: 'challenge-back',
        label: 'Counter-challenge: demand a full recount and make it expensive for them',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+3|crisis-constitution+3',
        failureEffect: 'fides-8|crisis-constitution+6',
      },
      {
        id: 'pay-to-settle',
        label: 'Quietly compensate the challengers and make them go away (−30 Denarii)',
        successEffect: 'gold-30|fides+2',
        failureEffect: '',
      },
    ],
  },

  // Consequence event after the "Claim Full Sacrosanctity" extreme Tribune action.
  // Fires via injection when setFlag:sacrosanctity-claimed:true is set.
  {
    id: 'evt-sacrosanctity-declared',
    title: 'The Senate Reacts to Your Claim',
    bodyText:
      'Word of your sacrosanctity declaration has spread beyond the Aventine. Conservative ' +
      'senators have been meeting privately. At least two tribunes have publicly distanced ' +
      'themselves from the claim. The question being asked in the Forum is not whether you have ' +
      'the legal right — you do — but whether you intend to use it, and against whom.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'stand-firm',
        label: 'Double down — the claim stands and the Senate knows it',
        successEffect: 'setFlag:sacrosanctity-active:true|crisis-constitution+5',
        failureEffect: '',
      },
      {
        id: 'soften',
        label: 'Clarify that the claim was defensive, not aggressive — reduce the temperature',
        successEffect: 'fides-8|crisis-constitution-3',
        failureEffect: '',
      },
      {
        id: 'withdraw',
        label: 'Quietly withdraw the claim — the point was made',
        successEffect: 'fides-12|clearFlag:sacrosanctity-claimed',
        failureEffect: '',
      },
    ],
  },

  // Fires each season after dictatorOverstaySeasons >= 1 (while dictator-overstaying flag is set).
  {
    id: 'evt-conspiracy-against-dictator',
    title: 'A Conspiracy Takes Shape',
    bodyText:
      'Your agents report a pattern of private meetings between senators whose only common ' +
      'ground is opposition to your continued rule. No names yet. No explicit plans. But men ' +
      'of this quality do not meet socially. Something is being organised, and the longer you ' +
      'remain in office, the more it will attract adherents.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'expose',
        label: 'Send agents to identify and expose the conspirators (Intrigus check)',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 6 },
        successEffect: 'fides+5|setFlag:conspiracy-exposed:true',
        failureEffect: 'fides-5|crisis-constitution+4',
      },
      {
        id: 'co-opt',
        label: 'Identify the ringleader and offer him something — buy his silence',
        successEffect: 'gold-40|fides-5|crisis-constitution-3',
        failureEffect: '',
      },
      {
        id: 'ignore',
        label: 'Ignore it — conspiracies without courage are just conversations',
        successEffect: 'crisis-constitution+4',
        failureEffect: '',
      },
    ],
  },

  // Fires in turnSequencer end-of-turn when dictatorOverstaySeasons >= 3.
  {
    id: 'evt-assassination-attempt',
    title: 'They Come for You at Night',
    bodyText:
      'The warning comes from a slave, of all people — one of your own, loyal enough to refuse ' +
      'the coin he was offered. Armed men entered the lower city at dusk. The Dictator\'s house ' +
      'is known. You have perhaps two hours. The question is not whether to fight, but how, and ' +
      'with whom, and whether the men you trust are actually trustworthy.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'face-them',
        label: 'Face them directly — the Dictator does not flee (Martial check, difficulty 7)',
        skillCheck: { characterId: 'player', skill: 'martial', difficulty: 7 },
        successEffect: 'fides+10|lifetimeDignitas+5|setFlag:assassination-survived:true',
        failureEffect: 'lifetimeDignitas-20|crisis-constitution+10|setFlag:assassination-wounded:true',
      },
      {
        id: 'use-agents',
        label: 'Turn your intelligence network against them before they reach the house (Intrigus check)',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 6 },
        successEffect: 'fides+6|setFlag:assassination-survived:true|setFlag:assassins-turned:true',
        failureEffect: 'fides-8|crisis-constitution+8',
      },
      {
        id: 'flee',
        label: 'Leave the city tonight — live to return another day',
        successEffect: 'lifetimeDignitas-15|fides-10|clearFlag:dictator-overstaying',
        failureEffect: '',
      },
    ],
  },

];
