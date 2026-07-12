// ─── War Events ───────────────────────────────────────────────────────────────
// Phase 3, Chunk P3-B — the Punic War's scripted beats: ignition, ~5 periodic
// events, and the three outcome-specific terminal notices. Kept in a separate
// file per the plan's file list rather than appended to data/events.ts (which
// CLAUDE.md already flags as edit-surgically-only at ~1150+ lines).
//
// Not spread into EVENT_DEFS — turnSequencer.ts's random-pool call site uses
// [...EVENT_DEFS, ...WAR_EVENT_DEFS] instead (see that file's step 12), and
// eventEngine.getEventDef / gameStore.resolveEvent's combined lookup both
// search this pool too, matching TUTORIAL_EVENT_DEFS' existing precedent.
//
// Content note: no rome-event-writing-guide.md exists in this repo yet (the
// plan assumes one) — tone/length/schema below are inferred directly from
// events.ts's existing content, which is the more reliable source anyway.

import type { EventDef } from '../models/event';

export const WAR_EVENT_DEFS: EventDef[] = [

  // ─── Ignition ────────────────────────────────────────────────────────────
  // weight: 0 — never enters the random pool. turnSequencer.ts step 12
  // force-injects this specific defId once (guard: no 'carthage' entry in
  // state.wars yet) as soon as the tutorial queue is empty, matching the
  // plan's "fires in the first or second year, after the tutorial completes"
  // gate. All three branches ignite the war — see the startWar: effect
  // token in resourceEngine.ts (kept out of a direct store-action call so
  // war state stays engine/store-owned, never mutated ad hoc from event copy).

  {
    id: 'evt-war-mamertines',
    title: 'Envoys from Messana',
    bodyText:
      'A band of Mamertine envoys stand before the Senate, sunburnt and insistent. Syracuse presses them from the south, ' +
      'a Carthaginian garrison already sits in their citadel, and they beg Rome to make Messana hers instead of anyone else\'s. ' +
      'The chamber is split — some call it a trap not worth Roman blood over a strait so narrow a man can see the far shore; ' +
      'others call it the excuse Rome has been waiting for. As a rising voice of the Gens Brutia, you will be asked where you stand.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'speak-for-war',
        label: 'Speak for war',
        successEffect: 'startWar:carthage:major:8|lifetimeDignitas+3|setFlag:war-ignited-carthage:true',
        failureEffect: '',
        successText:
          'You rise and say plainly what half the room is thinking: Carthage at Messana is a dagger at Italy\'s throat. ' +
          'The Senate votes for war. Rome\'s legions cross the strait within the season.',
      },
      {
        id: 'speak-for-caution',
        label: 'Urge caution',
        successEffect: 'startWar:carthage:major:3|fides-3|setFlag:war-ignited-carthage:true',
        failureEffect: '',
        successText:
          'You warn against a war fought for men who were pirates a season ago. The Senate votes for war regardless — ' +
          'Rome was never going to let Carthage sit unchallenged in the strait — but your caution is remembered, and not kindly.',
      },
      {
        id: 'stay-silent',
        label: 'Say nothing',
        successEffect: 'startWar:carthage:major:0|lifetimeDignitas-3|setFlag:war-ignited-carthage:true',
        failureEffect: '',
        successText:
          'You let the debate run its course without you. The Senate votes for war without your voice in it — Rome crosses ' +
          'to Messana regardless, and a man in the Gens Brutia\'s position is expected to have had something to say.',
      },
    ],
  },

  // ─── Periodic war events (~5) ────────────────────────────────────────────
  // Gated on flags['war-active-major'] (mirrored from state.wars each season
  // by warEngine.processWarSeason — see that file's flag-mirror block) rather
  // than a new EventCondition variant; matches the codebase's existing
  // counter/flag idiom (seasonsSinceAedileGames, mandatory-funding-ignored-
  // seasons, etc.) instead of extending models/event.ts. Summer-tagged where
  // the brief calls for the campaign season (Phase 1's seasonal-identity
  // convention); the weariness/peace-feeler pair is season-neutral since they
  // key off the war's duration, not the calendar.

  {
    id: 'evt-war-naval-gamble',
    title: 'A Fleet From a Wreck',
    bodyText:
      'A beached Carthaginian quinquereme, wrecked on the Bruttian coast, has given Roman shipwrights something they never ' +
      'had: a design to copy. The Senate could fund a crash construction of a hundred hulls and put Rome to sea for the first ' +
      'time in her history — or leave the war to the legions and let Carthage keep the water.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'flag', key: 'war-active-major', equals: true }],
    weight: 6,
    seasons: [1],
    choices: [
      {
        id: 'fund-fleet',
        label: 'Fund the fleet',
        successEffect: 'denarii-25|crisis-economy+3|warScoreDelta:carthage:7',
        failureEffect: '',
        successText:
          'The treasury groans, but by season\'s end Rome has a fleet where she had none — and Carthage\'s captains, ' +
          'who have never had to reckon with a Roman sail, are caught off guard more than once.',
      },
      {
        id: 'hold-back',
        label: 'Leave the sea to Carthage',
        successEffect: 'warScoreDelta:carthage:-2',
        failureEffect: '',
        successText:
          'The Senate keeps its silver. The legions fight on as they always have — and Carthaginian galleys move ' +
          'Sicilian grain and reinforcements wherever they please, unchallenged.',
      },
    ],
  },

  {
    id: 'evt-war-grain-convoy-raid',
    title: 'Raiders on the Grain Road',
    bodyText:
      'Carthaginian raiders have struck a grain convoy bound for Rome from Sicily. The granaries can absorb the loss, ' +
      'but the mob in the Forum is already asking why the Senate lets Rome\'s bread be stolen at sea while the legions ' +
      'chase glory on land.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'flag', key: 'war-active-major', equals: true }],
    weight: 6,
    seasons: [1],
    choices: [
      {
        id: 'escort-convoys',
        label: 'Detach ships to escort the convoys',
        successEffect: 'plebs+6|warScoreDelta:carthage:4',
        failureEffect: '',
        successText:
          'Grain reaches Rome under guard from then on. The plebs notice the Senate acted, and the raiders find ' +
          'easier prey elsewhere.',
      },
      {
        id: 'stay-the-course',
        label: 'The legions stay on the war, not the sea lanes',
        successEffect: 'plebs-5|crisis-unrest+3',
        failureEffect: '',
        successText:
          'The war effort is not diluted for one convoy\'s sake. The Forum grumbles about bread and Carthaginian ' +
          'sails within sight of the coast.',
      },
    ],
  },

  {
    id: 'evt-war-legate-overreach',
    title: 'A Legate\'s Gambit',
    bodyText:
      'A legate in Sicily reports a chance to force a Carthaginian column into open ground before it can retreat behind ' +
      'its walls — if the Senate authorizes him to press the advantage rather than hold the line as ordered. It is the ' +
      'kind of gambit that makes reputations, or ends them.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'flag', key: 'war-active-major', equals: true }],
    weight: 5,
    seasons: [1],
    choices: [
      {
        id: 'authorize-gambit',
        label: 'Authorize the gambit',
        skillCheck: { characterId: 'player', skill: 'martial', difficulty: 6 },
        successEffect: 'warScoreDelta:carthage:10',
        failureEffect: 'crisis-war+8|warScoreDelta:carthage:-4',
        successText:
          'Your read on the field proves sound — the legate presses forward and catches the column in open ground. ' +
          'It is a clean, decisive action, and word of it travels fast.',
        failureText:
          'The gambit collapses. The legate is drawn into ground he cannot hold, and the retreat costs more than the ' +
          'caution he was originally ordered to keep would have.',
      },
      {
        id: 'forbid-gambit',
        label: 'Forbid it — hold the line',
        successEffect: '',
        failureEffect: '',
        successText: 'You order the legate to hold as instructed. The chance passes; so does the risk.',
      },
    ],
  },

  {
    id: 'evt-war-weariness-murmur',
    title: 'A Murmur in the Forum',
    bodyText:
      'The war has run long enough that the Forum has stopped asking when Rome will win it and started asking when it ' +
      'will end. No one says it should end badly — only that it has gone on, and on, and the men it has taken are not coming back.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'flag', key: 'war-weariness-high', equals: true }],
    weight: 5,
    choices: [
      {
        id: 'reassure',
        label: 'Speak to the Senate\'s resolve',
        successEffect: 'fides+2',
        failureEffect: '',
        successText: 'You remind the chamber what has already been spent, and what walking away from it would waste. It steadies a few nerves.',
      },
      {
        id: 'let-it-pass',
        label: 'Say nothing — let the mood pass on its own',
        successEffect: '',
        failureEffect: '',
        successText: 'You let it be. The murmur does not grow louder today, but it does not go away either.',
      },
    ],
  },

  {
    id: 'evt-war-carthaginian-feeler',
    title: 'A Quiet Word From Carthage',
    bodyText:
      'An intermediary — a Massaliote grain trader with friends on both sides of the water — passes word that Carthage ' +
      'would listen, quietly, if Rome ever wished to talk terms. Nothing formal. Nothing the Senate could vote on today. ' +
      'Just the knowledge that the door is not shut.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'flag', key: 'war-peace-offered', equals: true }],
    weight: 4,
    choices: [
      {
        id: 'note-it',
        label: 'Note it, and say nothing publicly',
        successEffect: 'fides+1',
        failureEffect: '',
        successText:
          'You keep the word to yourself for now — but it is worth knowing that Carthage is tired too, the next ' +
          'time the Senate weighs whether to sue for peace.',
      },
      {
        id: 'dismiss-it',
        label: 'Dismiss it — Rome does not treat from weakness',
        successEffect: '',
        failureEffect: '',
        successText: 'You wave the intermediary off. Whether Carthage tries again is Carthage\'s business.',
      },
    ],
  },

  // ─── Terminal notices ────────────────────────────────────────────────────
  // weight: 0 — fired only via injectNoticeEvent from warEngine.processWarSeason
  // when a 'major' war's terminalOutcome is set this season (see that file's
  // buildTerminalOutcomeNotice). title/bodyText below are fallbacks only —
  // the real per-firing copy is passed dynamically via injectNoticeEvent's
  // opts, same pattern as evt-war-threshold-notice above.
  //
  // TODO(P3-E): route the "Continue" choice to the Epilogue screen once it
  // exists. Until then this dead-ends at the current screen, same treatment
  // as every other notice in this codebase pre-epilogue.

  {
    id: 'evt-war-outcome-victory',
    title: 'Victory',
    bodyText: 'The war is over. Rome has won it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },

  {
    id: 'evt-war-outcome-exhaustion',
    title: 'Peace of Exhaustion',
    bodyText: 'The war is over — not a triumph, but an end.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },

  {
    id: 'evt-war-outcome-humbled',
    title: 'Rome Humbled',
    bodyText: 'The war is over. Rome did not win it.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      { id: 'continue', label: 'Continue', successEffect: '', failureEffect: '' },
    ],
  },

];
