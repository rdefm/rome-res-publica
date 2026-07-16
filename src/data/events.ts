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

  // ─── P2-D — Leader death notice (weight 0, inject-only) ───────────────────
  // Fired by turnSequencer step 9 at the yearly rollover when a clan leader's
  // mortality roll succeeds. title/bodyText are overridden dynamically at
  // injection time via injectNoticeEvent with the dead leader's name, clan,
  // age, and the generated successor's details (see reputationEngine.ts).
  {
    id: 'evt-leader-death',
    title: 'A Senator Has Died',
    bodyText:
      'Word from the Forum: a senior clan leader has died. His place falls to an heir.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'continue',
        label: 'Rome moves on.',
        successEffect: '',
        failureEffect: '',
      },
    ],
  },

  // ─── P2-F — Munificence grand act notice (weight 0, inject-only) ──────────
  // Fired immediately by gameStore.performMunificence when a grand act (Grand
  // Games, Public Endowment) executes — shown right away, not deferred to season
  // end. title/bodyText are overridden dynamically at injection time via
  // injectNoticeEvent with the act's name and per-act Philon copy.
  {
    id: 'evt-munificence-grand-act',
    title: 'Rome Remembers',
    bodyText:
      'Philon: "What Rome is given, Rome remembers, Domine."',
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

  // ─── Military Overhaul M4 — battle notices (weight 0, inject-only) ────────
  // Fired by musterEngine.applyBattleOutcome's write-back (buildWoundedNotice/
  // buildBattleDeathNotice/buildRansomDemandNotice). title/bodyText are
  // overridden dynamically at injection time via injectNoticeEvent with the
  // affected character's name and (for ransom) the demand amount. Dispatch
  // voice — terse, military — per the plan's invariant 7 (Philon appears only
  // back in Rome, not in battle-context notices).
  {
    id: 'evt-wounded-notice',
    title: 'Wounded in Battle',
    bodyText: 'A dispatch from the field reports a wound taken in the press of battle.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },
  {
    id: 'evt-battle-death-notice',
    title: 'Fallen in Battle',
    bodyText: 'The dispatch is brief, as these things always are.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },
  {
    id: 'evt-ransom-demand-notice',
    title: 'Taken Captive',
    bodyText: 'Word reaches Rome: a family member lives, but is held. Carthage names a price for his return.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },
  // Military Overhaul M8 — this ONE is a Rome-context notice (fires after
  // the battle, about integrating a captured elephant into the army), so
  // Philon's voice is in-register here per invariant 7 — unlike the three
  // above, which are battle dispatches.
  {
    id: 'evt-captured-elephant-notice',
    title: 'Beasts of War, Now Ours',
    bodyText: 'The beasts of Carthage now eat from Roman hands. Philon is against it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },
  // Military Overhaul M9 — warEngine.ts injects this whenever |warScore|
  // newly crosses the sue/forced/dictate threshold for an active war.
  // Title/body are always overridden via injectNoticeEvent's opts (see
  // buildThresholdNotice) — dispatch voice, terse, per invariant 7.
  {
    id: 'evt-war-threshold-notice',
    title: 'The War Turns',
    bodyText: 'The balance of the war has shifted.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
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
      'The clerk assigned to your family\'s entry is a young man named Statius, new to the office ' +
      'and visibly unsure how closely anyone above him is actually checking his work.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [0],
    choices: [
      {
        id: 'declare-honestly',
        label: 'Declare the family\'s holdings in full, as the law requires',
        successEffect: 'fides+3|lifetimeDignitas+2',
        failureEffect: '',
        successText:
          'Statius records the figures without comment and moves to the next name on his list. ' +
          'There is nothing remarkable about a man who simply tells the truth — which is, in its own ' +
          'quiet way, the point.',
      },
      {
        id: 'understate',
        label: 'Have your steward quietly understate the family\'s property to Statius (Intrigus check)',
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 5 },
        successEffect: 'denarii+20|fides+1',
        failureEffect: 'denarii-15|fides-6|setFlag:census-fraud-suspected:true',
        successText:
          'Statius accepts the revised figures at face value and moves on. Fabius Buteo, three desks ' +
          'away, never looks up. Whatever assessment the family avoided this year, it avoided cleanly.',
        failureText:
          'Statius hesitates over the numbers a moment too long, then excuses himself to "confirm a ' +
          'detail." He does not say with whom. The fine, when it comes, is smaller than the damage to ' +
          'a name that is supposed to be above this sort of thing.',
      },
    ],
  },

  // Pattern D delayed follow-up to evt-spring-census-rumor's failed understate choice.
  {
    id: 'evt-spring-census-scrutiny',
    title: 'Statius Remembers the Ledger',
    bodyText:
      'Statius the clerk has been promoted — Fabius Buteo thought well of the diligence that caught ' +
      'your family\'s figures last year — and his first act in the new post is to reopen the file. ' +
      'He is not hostile about it, which somehow makes the letter requesting your presence at the ' +
      'tabularium harder to read as anything but trouble.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'flag', key: 'census-fraud-suspected', equals: true },
    ],
    weight: 4,
    choices: [
      {
        id: 'cooperate',
        label: 'Attend in person and cooperate fully — setFlag clears with the visit',
        successEffect: 'denarii-20|fides+4|setFlag:census-fraud-suspected:false',
        failureEffect: '',
        successText:
          'A long morning of ledgers and careful questions ends with Statius satisfied and the matter ' +
          'formally closed. It costs more than the original fine would have. It is, this time, honestly paid.',
      },
      {
        id: 'stonewall',
        label: 'Send a lawyer in your place and answer nothing directly',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'fides+2|setFlag:census-fraud-suspected:false',
        failureEffect: 'fides-10|lifetimeDignitas-5|setFlag:census-fraud-suspected:false',
        successText:
          'Your lawyer is better at this than you gave him credit for. The file closes on a technicality, ' +
          'and Statius\'s promotion does not extend to a grudge he can act on.',
        failureText:
          'The lawyer\'s technicalities do not survive contact with a clerk who has read every line ' +
          'twice. The matter closes anyway — files must close — but not in your favour, and not quietly.',
      },
    ],
  },

  {
    id: 'evt-yr-parilia',
    title: 'The Parilia Fires',
    bodyText:
      'The neighbourhood elders come to your door the way they do every year at this time — not to ' +
      'ask, exactly, but to make it easy for you to offer. The Parilia bonfires need wood, the leaping ' +
      'needs an open stretch of the street cleared and swept, and the old woman who leads the purification ' +
      'chant has named your family, unprompted, as the household she expects to sponsor it this year.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [0],
    choices: [
      {
        id: 'sponsor',
        label: 'Sponsor the neighbourhood rites in full',
        successEffect: 'denarii-15|fides+6|plebs+3',
        failureEffect: '',
        successText:
          'The fires burn late and the street fills with people leaping them for luck, laughing at ' +
          'the ones who mistime it. Someone starts a joke about the Brutii and it is, for once, a fond one.',
      },
      {
        id: 'abstain',
        label: 'Send a modest token and let another household take the lead this year',
        successEffect: 'denarii-3|fides-2',
        failureEffect: '',
        successText:
          'The rites happen without you at their centre. The neighbourhood does not forget who paid for ' +
          'them last year, but it does not remember it forever either.',
      },
    ],
  },

  {
    id: 'evt-yr-tiber-flood',
    title: 'The River Comes Up',
    bodyText:
      'Three days of spring rain have put the Tiber over its banks below the Aventine, and the water ' +
      'has reached the storerooms of a client family who keep a small workshop there — the Nonii, ' +
      'weavers, whose patron you have been for nine years without ever once being asked for anything ' +
      'larger than a word of introduction. Now they are asking, and the water is still rising.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [0],
    choices: [
      {
        id: 'send-help',
        label: 'Send household men and denarii to move their stock to higher ground',
        successEffect: 'denarii-20|fides+5',
        failureEffect: '',
        successText:
          'Your men wade the workshop out room by room while the Nonii direct traffic on what is left ' +
          'of their own floor. The looms survive. So, more quietly, does the family\'s sense of who ' +
          'their patron actually is.',
      },
      {
        id: 'send-word',
        label: 'Send your regrets and a small gift — the river is not your household\'s problem to solve',
        successEffect: 'fides-4',
        failureEffect: '',
        successText:
          'The Nonii manage on their own, as clients often must. The gift is accepted with the correct ' +
          'words and the incorrect warmth. Some debts are owed even when nothing was technically promised.',
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

  {
    id: 'evt-yr-summer-opportunity',
    title: 'The Empty House on the Hill',
    bodyText:
      'Half the Senate has decamped to villas outside the city for the worst of the heat, your rival ' +
      'Marcus Decius among them — a full month before he usually leaves, your secretary notes, and ' +
      'without the household staff he normally keeps behind to mind his interests. Whatever business ' +
      'he has been neglecting in Rome is, for the moment, neglected by anyone else too.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [1],
    choices: [
      {
        id: 'move-in',
        label: 'Use the quiet to court his neglected clients yourself (Rhetoric check)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 5 },
        successEffect: 'fides+6|optimatesRel-2',
        failureEffect: 'fides-3',
        successText:
          'A handful of Decius\'s clients discover, over the course of a very warm month, that they have ' +
          'a second patron who actually answers letters. Decius will notice eventually. Eventually is not now.',
        failureText:
          'Your approach is noticed sooner than expected, and clumsily enough that it reads as exactly ' +
          'what it is. Decius\'s people close ranks before you can make the case that mattered.',
      },
      {
        id: 'let-it-lie',
        label: 'Leave it — Rome in summer rewards patience more than opportunism',
        successEffect: '',
        failureEffect: '',
        successText:
          'The city empties and fills again, as it always does. Whatever advantage the quiet offered, ' +
          'it offered to someone else this year.',
      },
    ],
  },

  {
    id: 'evt-yr-consualia',
    title: 'An Invitation to the Consualia',
    bodyText:
      'A box at the Circus for the Consualia races has been offered to you by a clan eager to be seen ' +
      'offering it — the kind of gift that is really a question about where your loyalties sit before ' +
      'the summer\'s business concludes. Accepting costs nothing but an afternoon. It also answers the question.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [1],
    choices: [
      {
        id: 'attend',
        label: 'Accept the box and be seen there',
        successEffect: 'fides+4|optimatesRel+3',
        failureEffect: '',
        successText:
          'The races are fast, the wine is good, and you are photographed by a hundred pairs of eyes ' +
          'that will report exactly whose box you sat in. It is a small thing. Small things accumulate.',
      },
      {
        id: 'decline-attend',
        label: 'Decline politely — accepting favours before you understand their price is unwise',
        successEffect: 'fides-2',
        failureEffect: '',
        successText:
          'You send regrets and a gift of equal but unaligned value. The clan takes the point without ' +
          'taking offence — or says it does not, which in the Forum amounts to the same thing.',
      },
    ],
  },

  {
    id: 'evt-yr-summer-street-performers',
    title: 'The Players at the Crossroads',
    bodyText:
      'A small troupe of itinerant performers — acrobats, a flute girl, a man who juggles knives with ' +
      'more confidence than skill — has set up at the crossroads near your domus, drawing a crowd of ' +
      'household slaves and neighbourhood children before anyone official has decided whether to chase ' +
      'them off. Your steward asks, not for the first time this summer, what you\'d like done about it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 3,
    seasons: [1],
    choices: [
      {
        id: 'sponsor-troupe',
        label: 'Pay them to perform properly at your gate for the evening',
        successEffect: 'denarii-10|plebs+4|fides+2',
        failureEffect: '',
        successText:
          'The knife juggler does not cut himself, which the crowd seems disappointed by. Everyone else ' +
          'goes home fed on a free show and the general impression that your household is a generous one.',
      },
      {
        id: 'move-along',
        label: 'Have them moved along — a crossroads crowd is a crowd for pickpockets too',
        successEffect: '',
        failureEffect: '',
        successText:
          'The troupe packs up without complaint; they have done this before, in better and worse streets ' +
          'than this one. The crossroads is quiet again by evening.',
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

  {
    id: 'evt-yr-ludi-romani',
    title: 'A Seat Not Offered',
    bodyText:
      'The Ludi Romani seating has been arranged, as it is every year, by rank and favour rather than ' +
      'by any written rule — and this year the seats immediately behind the presiding praetor, where ' +
      'your family has sat for three games running, have gone instead to a cousin of Appius Claudius. ' +
      'The slight is deniable. Everyone watching knows exactly what it is anyway.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    seasons: [2],
    choices: [
      {
        id: 'confront-publicly',
        label: 'Raise the matter with the seating officials, in front of everyone (Rhetoric check)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 6 },
        successEffect: 'lifetimeDignitas+6|optimatesRel-3',
        failureEffect: 'lifetimeDignitas-6|fides-4',
        successText:
          'You make your case in the tone of a man restating a fact, not pleading a grievance. The ' +
          'officials find, with visible relief, that a clerical error is easily corrected. Everyone ' +
          'watching understood the negotiation for what it was.',
        failureText:
          'The complaint lands as a complaint, not a correction, and the crowd nearby hears a man ' +
          'protesting his seat at the games. The seating does not change. The impression does, and not for the better.',
      },
      {
        id: 'let-it-pass',
        label: 'Take the lesser seat without comment — the games are not worth the fight',
        successEffect: 'fides+2',
        failureEffect: '',
        successText:
          'You sit two rows back and applaud as loudly as anyone. Dignity, deployed correctly, looks ' +
          'exactly like indifference. Whether anyone believes it is a separate question.',
      },
    ],
  },

  {
    id: 'evt-yr-autumn-magistrate-audit',
    title: 'The Quaestor\'s Question',
    bodyText:
      'A junior quaestor conducting the year\'s routine accounting has flagged a discrepancy — small, ' +
      'almost certainly innocent — in a disbursement your household made to a public contractor last ' +
      'spring. He is not accusing you of anything, he says twice, before asking whether you might ' +
      'have the original receipts.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    seasons: [2],
    choices: [
      {
        id: 'produce-receipts',
        label: 'Produce the receipts and walk him through the accounts personally',
        successEffect: 'fides+3|lifetimeDignitas+2',
        failureEffect: '',
        successText:
          'The discrepancy turns out to be the quaestor\'s own arithmetic, not yours. He thanks you for ' +
          'your patience with a formality that suggests he expects to need it again from someone else soon.',
      },
      {
        id: 'send-steward',
        label: 'Have your steward handle it — a paterfamilias has better uses for an afternoon',
        successEffect: 'denarii-8',
        failureEffect: '',
        successText:
          'The matter resolves without your involvement, at the modest cost of a clerk\'s fee and an ' +
          'afternoon of your steward\'s time. Whether the quaestor drew any conclusion from your absence, he keeps to himself.',
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
      'Philon has served the slaves their dinner himself, as custom and his own sense of order both ' +
      'require, and now stands in the doorway with the estimates for the household\'s celebration — ' +
      'and the particular stillness of a steward who already knows which answer he is hoping for. ' +
      'The neighbourhood expects the family to be seen, and the cost of being seen has a number attached to it.',
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

  {
    id: 'evt-yr-winter-fireside',
    title: 'An Evening With No Business In It',
    bodyText:
      'For once there is nothing on the household ledger that needs your attention tonight — no ' +
      'petitioner at the gate, no letter demanding an answer before morning. The brazier is lit, the ' +
      'family is gathered without having been summoned, and it occurs to you, not for the first time ' +
      'this winter, how rarely an evening like this one is allowed to simply happen.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 3,
    seasons: [3],
    choices: [
      {
        id: 'stay-present',
        label: 'Stay, and let the evening be exactly what it is',
        successEffect: 'fides+4',
        failureEffect: '',
        successText:
          'Nothing of consequence happens, in the sense that ledgers understand consequence. ' +
          'Everything of consequence happens, in every other sense that matters to the people in the room.',
      },
      {
        id: 'work-anyway',
        label: 'Retreat to the study — the accounts will not balance themselves',
        successEffect: 'lifetimeDignitas+1|fides-2',
        failureEffect: '',
        successText:
          'The accounts do, in fact, balance somewhat better for the attention. ' +
          'The room you left does not seem to notice you were gone, which is its own kind of answer.',
      },
    ],
  },

  // ─── Phase 5, Chunk P5-B — Domestic life (unconditioned, can fire any season) ─

  {
    id: 'evt-dom-tutor',
    title: 'A Tutor for the Household',
    bodyText:
      'A Greek tutor named Philocrates presents himself at the door with letters of recommendation ' +
      'from a household two streets over and a proposal: for a modest fee, he will take the youngest ' +
      'of the family in hand for an hour each morning. He speaks well. He also, your steward notes ' +
      'quietly, speaks well of himself rather a lot.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    choices: [
      {
        id: 'engage-tutor',
        label: 'Engage him for the season',
        successEffect: 'denarii-20|rhetoric+1',
        failureEffect: '',
        successText:
          'Philocrates turns out to be exactly as good as his letters claimed, once the self-regard is ' +
          'discounted for. The youngest of the household can now argue a point properly — an ' +
          'accomplishment the rest of the family finds considerably less charming than you do.',
      },
      {
        id: 'decline-tutor',
        label: 'Decline — the household\'s own teaching has served well enough',
        successEffect: '',
        failureEffect: '',
        successText:
          'Philocrates takes the refusal gracefully and tries his letters two doors down instead. ' +
          'The household continues as it was, for better or worse.',
      },
    ],
  },

  {
    id: 'evt-dom-freedman-petition',
    title: 'A Freedman\'s Request',
    bodyText:
      'Eros, freed from your household three years ago and prosperous enough since to have opinions ' +
      'about his own future, asks a favour: permission to trade under the family name in the grain ' +
      'markets near the Forum Boarium, where a Brutii association would open doors that a freedman\'s ' +
      'own name still does not. He has been loyal. He is also, transparently, asking for something valuable.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    choices: [
      {
        id: 'grant-name',
        label: 'Grant the request — a loyal freedman reflects well on the house that made him',
        successEffect: 'fides+3|denarii+15',
        failureEffect: '',
        successText:
          'Eros trades well and pays his respects — and a share of his margin — without being asked ' +
          'twice. The arrangement suits everyone, which is rarer than it should be.',
      },
      {
        id: 'refuse-name',
        label: 'Refuse — the family name is not a trading license to be lent out',
        successEffect: 'fides-3',
        failureEffect: '',
        successText:
          'Eros accepts the answer without argument, as a freedman generally must, and trades under his ' +
          'own name a little more slowly than he might have otherwise. He does not forget being asked, nor being refused.',
      },
    ],
  },

  {
    id: 'evt-dom-illness-scare',
    title: 'A Fever in the House',
    bodyText:
      'One of the household children has taken a fever — nothing the physician thinks serious, but ' +
      'serious enough that he will not commit to a promise, and the space between "nothing serious" ' +
      'and a promise is where a household spends a very long night. Your steward asks, delicately, ' +
      'whether to send for the more expensive physician who trained in Alexandria.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    choices: [
      {
        id: 'spare-no-cost',
        label: 'Send for the Alexandrian physician — spare no cost',
        successEffect: 'denarii-25|fides+3',
        failureEffect: '',
        successText:
          'The fever breaks by morning, as fevers mostly do, and the household is left with a large bill ' +
          'and the entirely unprovable conviction that the bill is the reason. Both feel true enough to live with.',
      },
      {
        id: 'trust-household-physician',
        label: 'Trust the household physician — he has not failed the family yet',
        successEffect: '',
        failureEffect: '',
        successText:
          'The fever breaks by morning. The household physician accepts the quiet vote of confidence ' +
          'without comment, which is his way of accepting most things.',
      },
    ],
  },

  {
    id: 'evt-dom-sibling-friction',
    title: 'Words Between Brothers',
    bodyText:
      'Your heir and his younger brother have been circling the same argument for weeks — about money, ' +
      'or standing, or which of them their father actually favours, though none of them will say it in ' +
      'those words — and tonight it finally breaks into the open, loudly enough that the household staff ' +
      'have found urgent business in other rooms.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 5,
    choices: [
      {
        id: 'mediate-now',
        label: 'Sit them both down and settle it tonight, whatever it costs the evening',
        successEffect: 'fides+2|setFlag:sibling-rivalry-open:true',
        failureEffect: '',
        successText:
          'It is a long, uncomfortable hour, and nothing is fully resolved — but both of them leave the ' +
          'room having said the real thing instead of the practised one, which is its own kind of progress.',
      },
      {
        id: 'let-it-cool',
        label: 'Let it cool on its own — brothers have survived worse arguments than this',
        successEffect: 'setFlag:sibling-rivalry-open:true',
        failureEffect: '',
        successText:
          'The house goes quiet again by midnight, the way houses do. Nothing is settled. ' +
          'It rarely is, the first time.',
      },
    ],
  },

  // Pattern D delayed follow-up to evt-dom-sibling-friction.
  {
    id: 'evt-dom-sibling-reconciliation',
    title: 'What the Brothers Never Finished',
    bodyText:
      'The argument between your heir and his younger brother never properly ended — it just stopped, ' +
      'the way arguments do when everyone gets tired before anyone is satisfied. Something has brought ' +
      'it back to the surface this week, and this time one of them has come to you directly, asking you ' +
      'to actually decide something instead of letting it cool again.',
    imageKey: 'portrait-paterfamilias',
    conditions: [
      { type: 'flag', key: 'sibling-rivalry-open', equals: true },
    ],
    weight: 4,
    choices: [
      {
        id: 'favour-heir',
        label: 'Affirm your heir\'s standing plainly — the household needs a clear order',
        successEffect: 'lifetimeDignitas+2|fides-2|setFlag:sibling-rivalry-open:false',
        failureEffect: '',
        successText:
          'Your heir accepts the affirmation with the relief of a man who was more worried than he ' +
          'showed. His brother accepts it too, outwardly, and files the moment away for later.',
      },
      {
        id: 'divide-fairly',
        label: 'Insist on a settlement that treats both sons\' claims as legitimate',
        successEffect: 'fides+4|setFlag:sibling-rivalry-open:false',
        failureEffect: '',
        successText:
          'Neither son gets everything he wanted, which — as you point out, and as they both eventually ' +
          'concede — is usually the sign of a fair settlement rather than a bad one.',
      },
    ],
  },

  {
    id: 'evt-dom-marriage-feeler',
    title: 'A Quiet Inquiry',
    bodyText:
      'A minor family from the Aventine — respectable, solvent, entirely below the notice of the great ' +
      'clans — has sent a mutual acquaintance to feel out whether a marriage between their son and a ' +
      'daughter of your household might be welcome. It is not an insulting offer. It is also, plainly, ' +
      'not an ambitious one.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    choices: [
      {
        id: 'entertain-offer',
        label: 'Entertain the idea — not every alliance needs to be a strategic masterstroke',
        successEffect: 'fides+3|plebs+2',
        failureEffect: '',
        successText:
          'Word gets back that the family is pleased, and cautiously so — pleasure and caution being, ' +
          'for a family that size, close to the same feeling. Nothing is decided. The door stays open.',
      },
      {
        id: 'decline-quietly',
        label: 'Decline through the same quiet channel it arrived by',
        successEffect: '',
        failureEffect: '',
        successText:
          'The acquaintance carries the answer back with the same discretion he carried the question. ' +
          'No one outside three households will ever know the offer was made at all.',
      },
    ],
  },

  {
    id: 'evt-dom-old-friend',
    title: 'An Old Friend, Diminished',
    bodyText:
      'Publius Herennius — a friend of your father\'s generation, once a man of real means — arrives ' +
      'unannounced and visibly embarrassed to be arriving at all. His fortunes have thinned over the ' +
      'years in ways he clearly does not want narrated, and the request, when it finally comes, is ' +
      'smaller than his old bearing suggested it would be.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    choices: [
      {
        id: 'help-generously',
        label: 'Help him generously and preserve what dignity the visit has left him',
        successEffect: 'denarii-25|fides+5|lifetimeDignitas+2',
        failureEffect: '',
        successText:
          'You settle the matter quickly and change the subject to old stories before he can thank you ' +
          'too much. He leaves lighter in more than one sense, and grateful in the way men are when they ' +
          'are not made to feel the weight of the favour.',
      },
      {
        id: 'help-modestly',
        label: 'Offer what modest help feels appropriate to an old, faded connection',
        successEffect: 'denarii-8|fides+1',
        failureEffect: '',
        successText:
          'He accepts what is offered with the careful gratitude of a man who expected less. ' +
          'It is enough. It is also, both of you understand without saying so, not really about the denarii.',
      },
    ],
  },

  {
    id: 'evt-dom-steward-request',
    title: 'Nicanor Asks for Himself',
    bodyText:
      'Nicanor, who has managed your household accounts for eleven years without once asking for' +
      'anything beyond his wage, asks for something now: a small sum toward his daughter\'s dowry, and ' +
      'the discretion of not having it discussed at the dinner table. He has clearly rehearsed the ' +
      'request and is visibly relieved to have it finally said aloud.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 4,
    choices: [
      {
        id: 'grant-request',
        label: 'Grant it, and thank him for eleven years of never having asked before',
        successEffect: 'denarii-15|fides+3',
        failureEffect: '',
        successText:
          'Nicanor\'s composure slips for exactly one moment before he recovers it. Whatever loyalty your ' +
          'household already had from him, it has more of it now, and loyalty of that kind rarely shows up on a ledger.',
      },
      {
        id: 'decline-request',
        label: 'Explain, kindly, that the household\'s finances cannot extend to it this season',
        successEffect: 'fides-3',
        failureEffect: '',
        successText:
          'Nicanor accepts the answer with the same composure he has managed every other figure in the ' +
          'household accounts. He does not raise the subject again. He also, you notice, does not quite look at you the same way.',
      },
    ],
  },

  {
    id: 'evt-dom-neighbor-dispute',
    title: 'The Wall Between the Gardens',
    bodyText:
      'Your neighbour on the eastern boundary — a minor equestrian named Voconius with more temper than ' +
      'land — insists his garden wall has been encroached on by three feet of your household\'s ' +
      'construction, and has said so loudly enough that half the street has an opinion about it before ' +
      'you have even seen the wall in question.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 3,
    choices: [
      {
        id: 'argue-case',
        label: 'Argue the boundary was always yours and hold your ground (Rhetoric check)',
        skillCheck: { characterId: 'player', skill: 'rhetoric', difficulty: 5 },
        successEffect: 'lifetimeDignitas+3',
        failureEffect: 'fides-4',
        successText:
          'A surveyor\'s old marker, produced at exactly the right moment, settles the matter in your ' +
          'favour. Voconius grumbles his way back over his own boundary and does not raise the subject again.',
        failureText:
          'The old marker turns out to support his claim rather than yours, which he points out to ' +
          'everyone on the street who will listen. The wall moves. So, a little, does your standing on this block.',
      },
      {
        id: 'concede-gracefully',
        label: 'Concede the three feet and rebuild the wall at your own cost',
        successEffect: 'denarii-12|fides+2',
        failureEffect: '',
        successText:
          'Voconius, robbed of a fight, seems almost disappointed. The new wall is, by universal ' +
          'agreement, considerably better built than the old one.',
      },
    ],
  },

  {
    id: 'evt-dom-family-heirloom',
    title: 'The Signet in the Strongbox',
    bodyText:
      'Clearing out a storeroom, your steward finds a signet ring that belonged to your grandfather — ' +
      'and a note, in your late uncle\'s hand, claiming it was promised to his branch of the family and ' +
      'never returned. Your uncle\'s son, still living, does not know the note exists yet. You are, for ' +
      'the moment, the only person who has to decide whether he ever will.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 3,
    choices: [
      {
        id: 'return-heirloom',
        label: 'Send the ring to your cousin along with the note',
        successEffect: 'fides+4|lifetimeDignitas-1',
        failureEffect: '',
        successText:
          'Your cousin\'s reply is three lines long and unmistakably moved, in the understated way men of ' +
          'this family manage to be moved. The ring was never worth much. The gesture, evidently, was worth more.',
      },
      {
        id: 'keep-heirloom',
        label: 'Keep it — a grandfather\'s ring belongs with his name, and you carry it now',
        successEffect: 'lifetimeDignitas+3',
        failureEffect: '',
        successText:
          'The note goes back in the strongbox, unanswered. The ring goes on your hand. ' +
          'Whether this was the right decision is a question with no one left alive to settle it.',
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
