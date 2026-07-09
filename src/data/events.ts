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

  // ─── P2-B — Patron Tier tier-up notice (weight 0, inject-only) ─────────────
  // Fired by turnSequencer step 18 when patronTier increases. title/bodyText
  // are overridden dynamically at injection time via injectNoticeEvent, using
  // the newly-reached tier's name and passive bonuses (see patronEngine.ts).
  {
    id: 'evt-patron-tier-up',
    title: 'Rome Takes Notice',
    bodyText:
      'Philon does not smile often. "Rome has taken notice, Domine. Your family\'s standing has grown."',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'continue',
        label: 'Continue',
        successEffect: '',
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

  // ─── Class E — Seasonal flavour events (P1-E) ──────────────────────────────
  // Written to rome-event-writing-guide.md conventions.
  // Effect budgets: ≤±10 resource, ≤±5 Rome stat, ≤±3 crisis track per choice.

  // ── Spring (seasons: [0]) ──────────────────────────────────────────────────

  {
    id: 'evt-spring-lustration',
    title: 'The Lustration Rite',
    bodyText:
      'A haruspex named Spurinna arrives before the morning meal, uninvited and unhurried. ' +
      'He has examined the entrails, he explains, and found three signs of pollution that require ' +
      'immediate purification of the household — for a modest consideration. ' +
      'Your steward waits at the door with the household accounts open.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [0],
    choices: [
      {
        id: 'commission',
        label: 'Commission the rite and pay the fee',
        successEffect: 'denarii-20|fides+4|lifetimeDignitas+3',
        failureEffect: '',
        successText:
          'Spurinna burns herbs in every room and speaks words over the threshold. ' +
          'You feel no different, but the household staff seem steadier for it.',
      },
      {
        id: 'refuse',
        label: 'Send him away — the gods require deeds, not rites',
        successEffect: 'fides-2',
        failureEffect: '',
        successText:
          'Spurinna departs without argument, which somehow makes it worse. ' +
          'Three days later you begin to wonder if the spring rains are connected.',
      },
    ],
  },

  {
    id: 'evt-spring-planting',
    title: 'The Seed Loan',
    bodyText:
      'Three of your rural clients arrive together — Titus Capito, Decimus Maro, and a freedman ' +
      'whose name you never quite caught — with their hats in their hands and a story about poor ' +
      'reserves after last winter. They are asking, circuitously, for a loan of thirty denarii to ' +
      'cover their seed purchase for the planting season. ' +
      'They will repay in autumn, they say, with interest, on their honour as your clients.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [0],
    choices: [
      {
        id: 'lend',
        label: 'Lend the money — clients who prosper are clients who remain loyal',
        successEffect: '',
        failureEffect: '',
        nextEventId: 'evt-autumn-repayment',
        // No successText — branching choice; evt-autumn-repayment opens the next scene.
      },
      {
        id: 'decline',
        label: 'Decline — a patron is not a bank',
        successEffect: 'fides-3',
        failureEffect: '',
        successText:
          'They leave without protest, but the silence on the road behind them says something. ' +
          'Loyalty is built in small moments and undone in smaller ones.',
      },
    ],
  },

  {
    id: 'evt-spring-census-rumor',
    title: 'The Censor\'s Eye',
    bodyText:
      'Your steward brings word that Fabius Buteo — the Censor — has been seen in the tabularium ' +
      'with three scribes and a lamp, reviewing the rolls of the equestrian order. ' +
      'Whether this is routine, politically motivated, or both, your steward cannot say. ' +
      'The next review will determine your family\'s official standing in Rome\'s hierarchy — ' +
      'a small matter, until it isn\'t.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [0],
    choices: [
      {
        id: 'ensure',
        label: 'See to it that your entry is properly represented',
        successEffect: 'fides-8|lifetimeDignitas+5',
        failureEffect: '',
        successText:
          'A careful consultation with the appropriate clerks ensures the record reflects the ' +
          'family\'s actual standing. The censor\'s eye passes over the Brutii with no irregularities noted.',
      },
      {
        id: 'ignore',
        label: 'Let the rolls fall as they may',
        successEffect: '',
        failureEffect: '',
        successText:
          'The census records what it records. ' +
          'You are not the sort of man who pays for what he already deserves.',
      },
    ],
  },

  // ── Summer (seasons: [1]) ──────────────────────────────────────────────────

  {
    id: 'evt-summer-campaign-fever',
    title: 'Glory in Sicily',
    bodyText:
      'The younger men of the household have been restless since the war in Sicily became a ' +
      'topic at dinner. Gaius — your steward\'s nephew, a young man you have watched grow into ' +
      'something almost promising — has come to you directly to ask for help securing a placement ' +
      'with the legions. He wants to go, he says, before the war is over and all the glory is ' +
      'already distributed.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [1],
    choices: [
      {
        id: 'back-him',
        label: 'Back him — fund the equipment and write the necessary letters',
        successEffect: 'denarii-25|fides+4',
        failureEffect: '',
        successText:
          'You write two letters and arrange the equipment costs. Gaius leaves with the supply ' +
          'column the following week, straight-backed and barely old enough to shave. ' +
          'Whether he returns the same is another matter.',
      },
      {
        id: 'counsel',
        label: 'Counsel him to wait — the war will still need soldiers next season',
        successEffect: 'fides+2',
        failureEffect: '',
        successText:
          'He listens with the expression of someone who has already decided. ' +
          'But he stays. For now.',
      },
    ],
  },

  {
    id: 'evt-summer-heat-plague',
    title: 'Fever in the Subura',
    bodyText:
      'The physicians are calling it the summer fever — which is what physicians call something ' +
      'when they do not know what it is. It has been in the Subura for three weeks and has now ' +
      'appeared in the Esquiline. The market stalls near the Tiber have closed. ' +
      'Your steward estimates that a third of your urban clients live in the affected streets.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [1],
    choices: [
      {
        id: 'fund-relief',
        label: 'Send food and medicine into the Subura — your name should be visible in a crisis',
        successEffect: 'denarii-30|plebs+8|fides+4',
        failureEffect: '',
        successText:
          'Carts of grain and vinegar move through the affected streets under your steward\'s direction. ' +
          'You do not go yourself — no senator does — but the Brutii name is spoken in the Subura ' +
          'with something other than indifference for the rest of the summer.',
      },
      {
        id: 'close-gates',
        label: 'Seal the domus and wait — Rome has survived fevers before',
        successEffect: 'fides-3',
        failureEffect: '',
        successText:
          'The household remains healthy. ' +
          'The streets beyond the gate do not. ' +
          'Stability, in a city that remembers everything, costs more than it saves.',
      },
    ],
  },

  {
    id: 'evt-summer-road-embassy',
    title: 'The Delegation from the East',
    bodyText:
      'A party of Sicilian representatives — sent by the Greek cities on the eastern coast to ' +
      'make formal representations to the Senate — has arrived in Rome two weeks early and without ' +
      'the proper introduction letters. They are staying at an insula near the Aventine, waiting ' +
      'politely but visibly for someone in the Senate to take notice. ' +
      'Your secretary mentions it at breakfast as though it is not urgent, which is how he mentions ' +
      'everything that is.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [1],
    choices: [
      {
        id: 'receive',
        label: 'Receive them at the domus — hospitality is its own form of influence',
        successEffect: 'denarii-25|fides+6',
        failureEffect: '',
        successText:
          'Three hours of careful listening and expensive wine. The delegation departs with letters ' +
          'of introduction — written by you — for the relevant Senate committees. ' +
          'You have made friends with people who will remember the meal when the treaty negotiations begin.',
      },
      {
        id: 'pass',
        label: 'File the matter away — the Senate has a process for this',
        successEffect: 'fides-3',
        failureEffect: '',
        successText:
          'The delegation finds its way through the proper channels without you. ' +
          'Someone else receives the credit for their reception. ' +
          'The cost of doing nothing is rarely obvious in the moment.',
      },
    ],
  },

  // ── Autumn (seasons: [2]) ─────────────────────────────────────────────────

  {
    id: 'evt-autumn-harvest',
    title: 'The Price of Grain',
    bodyText:
      'The harvest reports from the south arrive in batches, each one contradicting the last. ' +
      'What is clear is that prices in the city are moving — and your factor is pressing you for ' +
      'a decision on the family\'s modest grain holdings before the market settles. ' +
      'Buy cheap and sell to the people, or take the profit while there is one to take.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [2],
    choices: [
      {
        id: 'buy-distribute',
        label: 'Buy grain and sell it cheaply to your clients and neighbours',
        successEffect: 'denarii-30|plebs+6',
        failureEffect: '',
        successText:
          'The purchase costs thirty denarii and the grain sells at a loss — but the line outside ' +
          'the family warehouse is a visible thing, visible to the people who vote in tribal ' +
          'assemblies and to the senators who live on adjacent streets.',
      },
      {
        id: 'sell',
        label: 'Sell the holdings now at whatever the market gives',
        successEffect: 'denarii+25|plebs-3',
        failureEffect: '',
        successText:
          'The factor is satisfied. The denarii arrive before the prices settle. ' +
          'The clients who were expecting a discount from their patron will find other arrangements this year.',
      },
    ],
  },

  {
    id: 'evt-autumn-vintage',
    title: 'An Exceptional Vintage',
    bodyText:
      'Your steward at the vineyard estate sends word by courier: the vintage this season is ' +
      'exceptional — better than anything in the past eight years. He has already had three ' +
      'separate inquiries from buyers, one of them from a household whose name your steward ' +
      'mentioned twice, to make sure you noticed. ' +
      'The question is whether to sell the yield at a premium or to make a different kind of use of it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'asset', definitionId: 'vineyard' },
    ],
    weight: 5,
    seasons: [2],
    choices: [
      {
        id: 'sell-vintage',
        label: 'Sell the vintage at the season\'s best price',
        successEffect: 'gold+35',
        failureEffect: '',
        successText:
          'The couriers come and go for a week. When the accounting is done, the vineyard has ' +
          'returned more in one season than it usually does in two. A good year deserves to end well.',
      },
      {
        id: 'gift-vintage',
        label: 'Dedicate the finest amphorae to key political relationships',
        successEffect: 'fides+8|lifetimeDignitas+4',
        failureEffect: '',
        successText:
          'Twelve amphorae go to twelve different households, each with a note in your handwriting. ' +
          'A senator who receives wine from your vineyard in October has a reason to remember your ' +
          'name in December, when the elections are decided.',
      },
    ],
  },

  // Chain follow-up from evt-spring-planting (weight 0 — only reachable via nextEventId)
  {
    id: 'evt-autumn-repayment',
    title: 'Capito Returns',
    bodyText:
      'Titus Capito arrives in the third week of autumn with a cart. ' +
      'You had half-forgotten the loan, which is either a sign of wealth or of distraction — ' +
      'you are not sure which. The harvest has been uneven. ' +
      'He sets a purse on your table with the expression of a man who is not certain what it contains.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    seasons: [2],
    choices: [
      {
        id: 'accept',
        label: 'Open the purse and accept what the season gave',
        successEffect: 'denarii+30|fides+6',
        failureEffect: '',
        successText:
          'Forty denarii — thirty returned and ten in interest, as promised. ' +
          'Capito\'s face when you count it without comment is worth the winter you waited.',
      },
      {
        id: 'press',
        label: 'Ask him directly for the agreed sum',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 4 },
        successEffect: 'denarii+45|fides+8',
        failureEffect: 'fides-5|denarii+20',
        successText:
          'A firm conversation yields the proper figure. ' +
          'Capito had set some aside for contingencies. He will not do that again.',
        failureText:
          'The conversation turns awkward and then cold. He gives what he has and promises the rest ' +
          'next season. You believe him, which may be the problem.',
      },
    ],
  },

  // ── Winter (seasons: [3]) ─────────────────────────────────────────────────

  {
    id: 'evt-winter-saturnalia',
    title: 'The Festival\'s Demands',
    bodyText:
      'Saturnalia has arrived with its usual combination of obligation and sincerity. ' +
      'The slaves have been served their dinner by the family, the streets are loud, and your ' +
      'steward has presented the estimates for the household\'s celebration with the expression ' +
      'of a man who already knows the answer. ' +
      'The neighbourhood expects the Brutii to be seen, and the cost of being seen has a number attached to it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 6,
    seasons: [3],
    choices: [
      {
        id: 'host-generously',
        label: 'Host the festival with full generosity — the people will remember',
        successEffect: 'denarii-40|fides+8|plebs+6',
        failureEffect: '',
        successText:
          'Three days of open house, distributed gifts, and an ox roasted in the courtyard. ' +
          'By the fourth day you are tired and poorer, and somehow this is satisfying. ' +
          'The name Brutii is heard in the streets without a pause before it.',
      },
      {
        id: 'economise',
        label: 'Mark the occasion with dignity, but keep the expenditure moderate',
        successEffect: 'fides-3',
        failureEffect: '',
        successText:
          'A respectable celebration. Quiet by the standards of the richer houses on the hill. ' +
          'The neighbours note it — they note everything — but the Saturnalia passes without incident.',
      },
    ],
  },

  {
    id: 'evt-winter-election-eve',
    title: 'One More Vote',
    bodyText:
      'The elections are four days away and the tribal count remains uncertain. ' +
      'Your campaign manager — a freedman named Philemon who has run three candidacies for two ' +
      'different families — arrives at dusk with news: a bloc of eighteen votes in the Pollia tribe ' +
      'is still uncommitted, and their ward boss is the kind of man who can be reached before morning ' +
      'if the approach is right.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'campaigning' },
    ],
    weight: 5,
    seasons: [3],
    choices: [
      {
        id: 'court-bloc',
        label: 'Send Philemon with a gift and a message — eighteen votes is eighteen votes',
        successEffect: 'fides-5|plebs+5',
        failureEffect: '',
        successText:
          'Philemon returns before dawn looking satisfied, which is the only expression that matters. ' +
          'The Pollia tribe\'s ward boss will not be speaking against you. ' +
          'Whether his men follow him to the voting stalls is, as always, the question.',
      },
      {
        id: 'leave-it',
        label: 'Leave it — the count will be what it will be',
        successEffect: '',
        failureEffect: '',
        successText:
          'Philemon accepts the decision with the expression of a man who disagrees but will not say so. ' +
          'Four days later, you will learn whether the Pollia tribe mattered.',
      },
    ],
  },

  // ─── Chunk 2C — follow-ups and injection-only crisis events (weight 0) ─────
  // See Fable-phase1-implementation-plan.md §P1-G. All entries below are
  // unreachable via pickRandomEvent (weight 0) and only fire via nextEventId /
  // nextEventIdOnSuccess / nextEventIdOnFailure branching or direct injection
  // from an engine (militaryEngine, npcConsulEngine, turnSequencer, etc).

  // Follow-up when a client's true background is not investigated and later surfaces.
  {
    id: 'evt-borrowed-name-followup',
    title: 'The Name Was Never His',
    bodyText:
      'The client you welcomed under the name {clientName} has been exposed — quietly, but not ' +
      'quietly enough. The name was borrowed from a family long extinct in the north, and the man ' +
      'wearing it has debts, enemies, and a talent for both that he did not disclose. Whatever he ' +
      'brought to your household, he brought it under false pretences.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'confront',
        label: 'Confront him and demand the truth',
        successEffect: 'fides+3|setFlag:borrowed-name-confronted:true',
        failureEffect: '',
      },
      {
        id: 'quietly-release',
        label: 'Release him from the household without incident',
        successEffect: 'fides-2',
        failureEffect: '',
      },
      {
        id: 'keep-him',
        label: 'Say nothing — a useful man is a useful man, whatever his name',
        successEffect: 'fides-5|setFlag:borrowed-name-kept:true',
        failureEffect: '',
      },
    ],
  },

  // Fired by militaryEngine when a campaign's desertion roll crosses the report threshold.
  {
    id: 'evt-legion-deserters-reported',
    title: 'The Ranks Have Thinned',
    bodyText:
      'Your legate\'s dispatch is blunt: desertion has become a pattern, not an incident. Whole ' +
      'tent-groups have slipped away in the night, and the men who remain are asking, with ' +
      'increasing openness, why they should not do the same. The matter has reached the ears of ' +
      'the Senate faster than your own couriers.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'discipline',
        label: 'Order exemplary discipline for those caught (Martial check, difficulty 5)',
        skillCheck: { characterId: 'player', skill: 'martial', difficulty: 5 },
        successEffect: 'fides+5|crisis-war-3',
        failureEffect: 'fides-6|crisis-war+4',
      },
      {
        id: 'address-grievances',
        label: 'Send a commissioner to address pay and supply grievances (−20 Denarii)',
        successEffect: 'gold-20|crisis-war-5',
        failureEffect: '',
      },
      {
        id: 'report-honestly',
        label: 'Report the true numbers to the Senate without softening them',
        successEffect: 'fides-8|setFlag:legion-desertion-disclosed:true',
        failureEffect: '',
      },
    ],
  },

  // Alternate branch — fires when a prior choice conceals the desertion figures instead of reporting them.
  {
    id: 'evt-legion-deserters-covered',
    title: 'The Numbers Do Not Add Up',
    bodyText:
      'A junior quaestor, reviewing the muster rolls for an unrelated audit, has noticed the ' +
      'discrepancy your officers were paid to smooth over. He has said nothing publicly — yet. ' +
      'He has, however, requested a private audience, and he did not phrase it as a request.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'bribe',
        label: 'Ensure his continued discretion (−25 Denarii)',
        successEffect: 'gold-25|setFlag:desertion-coverup-bribed:true',
        failureEffect: '',
      },
      {
        id: 'confess',
        label: 'Get ahead of it — disclose the true figures yourself',
        successEffect: 'fides-10|clearFlag:legion-desertion-hidden',
        failureEffect: '',
      },
      {
        id: 'intimidate',
        label: 'Remind him whose patronage his career depends on (Rhetoric check, difficulty 6)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+2|setFlag:desertion-coverup-held:true',
        failureEffect: 'fides-12|crisis-constitution+5',
      },
    ],
  },

  // Success branch of the "Investigate" choice on a rival's suspected agent within your household.
  {
    id: 'evt-rivals-agent-turned',
    title: 'The Spy Offers Himself',
    bodyText:
      'Confronted with what your intrigus network uncovered, the man admits everything — he was ' +
      'placed in your household eighteen months ago, reporting on your correspondence and your ' +
      'visitors to a rival clan. Rather than face exposure, he offers something rarer than an ' +
      'apology: continued service, now reporting to you on the household that sent him.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'turn-him',
        label: 'Accept him as a double agent',
        successEffect: 'fides+6|setFlag:rival-agent-turned:true',
        failureEffect: '',
      },
      {
        id: 'dismiss',
        label: 'Dismiss him quietly — the risk of a second betrayal is too high',
        successEffect: 'fides+2',
        failureEffect: '',
      },
    ],
  },

  // Failure branch — the investigation reveals nothing conclusive and the agent remains hidden.
  {
    id: 'evt-rivals-agent-failed',
    title: 'The Trail Goes Cold',
    bodyText:
      'Your agents return with suspicion and no proof. Someone in the household is almost ' +
      'certainly reporting to a rival, but every thread they pulled led to a servant who was, on ' +
      'closer inspection, exactly who they claimed to be. Whoever it is has covered their tracks ' +
      'well — which is itself a kind of confirmation.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'tighten-security',
        label: 'Tighten household security and limit sensitive discussion (−10 Denarii)',
        successEffect: 'gold-10|setFlag:household-security-tightened:true',
        failureEffect: '',
      },
      {
        id: 'let-it-go',
        label: 'Let it go — a household run on suspicion is not a household worth keeping',
        successEffect: 'fides-3',
        failureEffect: '',
      },
    ],
  },

  // Branch when the suspicion of a rival's agent is raised but never acted on.
  {
    id: 'evt-rivals-agent-ignored',
    title: 'The Suspicion Fades',
    bodyText:
      'Nothing further comes of it. No confrontation, no investigation — the household continues ' +
      'as before, and if someone within it truly is reporting to a rival, they have had every ' +
      'opportunity to continue doing so undisturbed.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'accept',
        label: 'Accept the uncertainty and move on',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  // Major constitutional-crisis event — injected by turnSequencer when the Popular faction
  // forces a land/grain reform vote against Senate resistance.
  {
    id: 'evt-gracchan-moment',
    title: 'A Tribune Moves Against the Senate',
    bodyText:
      'A tribune has taken his reform bill directly to the tribal assembly, bypassing the Senate ' +
      'entirely — a manoeuvre with a name in Rome now, spoken with admiration by some and dread by ' +
      'others. The chamber is furious. The Forum is electric. Whatever happens next will be ' +
      'remembered as a precedent, for good or for catastrophe.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'support',
        label: 'Publicly support the tribune\'s manoeuvre',
        successEffect: 'plebs+8|fides-6|crisis-constitution+6',
        failureEffect: '',
        nextEventId: 'evt-gracchan-aftermath',
      },
      {
        id: 'oppose',
        label: 'Side with the Senate against the precedent',
        successEffect: 'fides+6|plebs-8|crisis-constitution+4',
        failureEffect: '',
        nextEventId: 'evt-gracchan-aftermath',
      },
      {
        id: 'abstain',
        label: 'Take no public position — let others own the consequences',
        successEffect: 'crisis-constitution+8',
        failureEffect: '',
        nextEventId: 'evt-gracchan-aftermath',
      },
    ],
  },

  // Follow-up to evt-gracchan-moment — fires regardless of which side was taken.
  {
    id: 'evt-gracchan-aftermath',
    title: 'The Precedent Settles',
    bodyText:
      'The vote is done, one way or another, but the manner of it lingers in every subsequent ' +
      'session. Senators who once treated the tribal assembly as a formality now watch it the way ' +
      'a man watches a fire that has already jumped one firebreak. Nobody says the Republic has ' +
      'changed. Everybody behaves as though it has.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'accept',
        label: 'Let the new precedent stand',
        successEffect: 'crisis-constitution+3',
        failureEffect: '',
      },
      {
        id: 'push-back',
        label: 'Argue for procedural safeguards before the next assembly vote (Rhetoric check, difficulty 6)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+4|crisis-constitution-5',
        failureEffect: 'fides-4|crisis-constitution+3',
      },
    ],
  },

  // Injection-only event — fires when the Senate is deadlocked (constitution + war crisis both high)
  // and no ordinary business can proceed.
  {
    id: 'evt-senate-cannot-act',
    title: 'The Senate Sits in Silence',
    bodyText:
      'For the third session running, the Senate has adjourned without a quorum willing to vote ' +
      'on anything of consequence. Factions boycott each other\'s motions. Consuls issue edicts ' +
      'that other magistrates simply decline to enforce. Rome\'s government, for the moment, ' +
      'exists mostly on paper.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      {
        type: 'multiCrisis',
        conditions: [
          { track: 'constitution', op: 'gte', value: 60 },
          { track: 'war', op: 'gte', value: 50 },
        ],
      },
    ],
    weight: 0,
    choices: [
      {
        id: 'force-session',
        label: 'Use your office to compel a quorum (Rhetoric check, difficulty 7)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 7 },
        successEffect: 'fides+6|crisis-constitution-8',
        failureEffect: 'fides-6|crisis-constitution+5',
      },
      {
        id: 'govern-around-it',
        label: 'Govern by edict and precedent while the Senate stalls',
        successEffect: 'crisis-constitution+6|setFlag:senate-bypassed:true',
        failureEffect: '',
      },
      {
        id: 'wait',
        label: 'Wait it out — the deadlock will break on its own',
        successEffect: 'crisis-constitution+3',
        failureEffect: '',
      },
    ],
  },

  // End-state crisis event — injection-only, fires when all four crisis tracks are critical at once.
  {
    id: 'evt-republic-trembles',
    title: 'The Republic Trembles',
    bodyText:
      'War, unrest, constitutional breakdown, and ruin all arrive together, as they so often do — ' +
      'not because one caused the others, but because a state under enough pressure fails ' +
      'everywhere at once. Men in the Forum are no longer asking who will fix this. They are ' +
      'asking who will be blamed for it, and who might seize what is left.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      {
        type: 'multiCrisis',
        conditions: [
          { track: 'war', op: 'gte', value: 60 },
          { track: 'unrest', op: 'gte', value: 60 },
          { track: 'constitution', op: 'gte', value: 60 },
          { track: 'economy', op: 'gte', value: 60 },
        ],
      },
    ],
    weight: 0,
    choices: [
      {
        id: 'seize-authority',
        label: 'Seize emergency authority in the Republic\'s name',
        successEffect: 'lifetimeDignitas+10|fides-15|setFlag:emergency-authority-seized:true',
        failureEffect: '',
      },
      {
        id: 'rally-senate',
        label: 'Rally what remains of the Senate to a unified response (Rhetoric check, difficulty 8)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 8 },
        successEffect: 'fides+10|crisis-constitution-10|crisis-unrest-10',
        failureEffect: 'fides-10|crisis-constitution+5',
      },
      {
        id: 'protect-family',
        label: 'Set the Republic aside and secure your own family\'s survival first',
        successEffect: 'fides-20|denarii+40|setFlag:family-survival-prioritised:true',
        failureEffect: '',
      },
    ],
  },

  {
    id: 'evt-winter-frozen-tiber',
    title: 'The River Does Not Move',
    bodyText:
      'The Tiber has not frozen completely, but the ice has slowed the grain barges enough that ' +
      'prices in the city have climbed fifteen percent since the first frost. ' +
      'The men who sleep in the porticos near the river have moved to the insulae, where landlords ' +
      'are charging double for brazier rights. ' +
      'Your steward reports that three of your urban clients have written to ask whether the ' +
      'patron\'s domus has any surplus firewood.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [3],
    choices: [
      {
        id: 'send-fuel',
        label: 'Send fuel to your clients\' households — a patron\'s duty does not pause for weather',
        successEffect: 'denarii-20|fides+5',
        failureEffect: '',
        successText:
          'Two carts of oak and one of charcoal, distributed through the steward\'s network. ' +
          'The letters of thanks arrive over the next week. ' +
          'They cost nothing to write and something to mean, and most of them mean it.',
      },
      {
        id: 'reserve',
        label: 'Reserve the stores — winter is long and the supply uncertain',
        successEffect: 'fides-2',
        failureEffect: '',
        successText:
          'A defensible position. The clients will manage. ' +
          'The calculation is probably correct. It does not feel correct, which may be the point.',
      },
    ],
  },

];
