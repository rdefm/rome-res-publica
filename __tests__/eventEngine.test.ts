import { rollClientBonus, computeTotalClientBonuses } from '../src/engine/clientEngine';
import { resolveEventChoice, pickRandomEvent, evalCondition, isEventEligible, checkTutorialGate, getEventDef } from '../src/engine/eventEngine';
import { applyEffectString } from '../src/engine/resourceEngine';
import { EVENT_DEFS } from '../src/data/events';
import type { ClientType, Client } from '../src/models/client';
import type { EventChoice, EventCondition, EventDef } from '../src/models/event';
import { getTierFromLevel } from '../src/models/crisis';
import type { CrisisState, CrisisTrack } from '../src/models/crisis';

// ─── Shared state and helpers ─────────────────────────────────────────────────────

function makeTrack(id: CrisisTrack['id'], level: number): CrisisTrack {
  return { id, level, tier: getTierFromLevel(level), namedCrisis: null };
}

function makeState(overrides: Record<string, any> = {}) {
  return {
    year: -264,
    turnNumber: 1,
    seasonIndex: 0,
    fides: 30,
    denarii: 200,
    imperium: 0,
    lifetimeDignitas: 0,
    popularesRel: 0,
    optimatesRel: 0,
    rome: { stability: 70, plebs: 60, treasury: 50 },
    crisisLevel: 0,
    crisis: {
      war:          makeTrack('war',          0),
      unrest:       makeTrack('unrest',       0),
      constitution: makeTrack('constitution', 0),
      economy:      makeTrack('economy',      0),
    } satisfies CrisisState,
    family: [
      {
        id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
        skills: { rhetoric: 6, martial: 3, intrigus: 4 },
        traits: ['ambitious'],
        relationship: 100, familyTrust: 100,
        officeId: null,
        inheritedTraits: [], ambitionIds: [], reputationScores: {},
      },
    ],
    bills: [], clans: [], clients: [], ownedAssets: [], ambitions: [],
    legacyObjectives: [], patronTier: 0, trialQueue: [],
    selectedCharacterId: 'pc-1', expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [],
    campaigning: null, campaignVotes: {}, electionRivals: [],
    pendingEvents: [], activeEvent: null, log: [], cursusLog: [],
    seasonOverlayVisible: false, seasonOverlayEvents: [],
    _expandedBill: null, _expandedType: null, cities: [],
    flags: {},
    npcConsul: null,
    ...overrides,
  };
}

function makeEventDef(id: string, weight: number, seasons?: number[]): EventDef {
  return {
    id,
    title: id,
    bodyText: 'Test body.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight,
    seasons,
    choices: [{ id: 'ok', label: 'OK', successEffect: '', failureEffect: '' }],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('rollClientBonus', () => {
  const CLIENT_TYPES: ClientType[] = ['muscle', 'publicSupport', 'votingSway'];

  test.each(CLIENT_TYPES)(
    'always returns at least one bonus key for type: %s',
    (type) => {
      for (let i = 0; i < 200; i++) {
        const bonus = rollClientBonus(type);
        expect(Object.keys(bonus).length).toBeGreaterThanOrEqual(1);
      }
    }
  );
});

describe('rollClientBonus secondary bonus', () => {
  const CLIENT_TYPES: ClientType[] = ['muscle', 'publicSupport', 'votingSway'];

  test.each(CLIENT_TYPES)(
    'secondary bonus key never matches primary key for type: %s',
    (type) => {
      for (let i = 0; i < 500; i++) {
        const bonus = rollClientBonus(type);
        const keys = Object.keys(bonus);
        if (keys.length >= 2) {
          expect(new Set(keys).size).toBe(keys.length);
        }
      }
    }
  );
});

describe('computeTotalClientBonuses', () => {
  test('empty roster returns empty object', () => {
    const result = computeTotalClientBonuses([]);
    expect(Object.keys(result)).toHaveLength(0);
  });

  test('aggregates bonuses correctly across multiple clients', () => {
    const clients: Client[] = [
      {
        id: 'c-1', name: 'Alpha', type: 'muscle',
        flavourTitle: 'Brute', flavourText: 'Hits things.',
        bonus: { gold: 2, trialDefenseBonus: 5 },
        acquiredTurn: 1,
      },
      {
        id: 'c-2', name: 'Beta', type: 'publicSupport',
        flavourTitle: 'Orator', flavourText: 'Speaks well.',
        bonus: { gold: 3, fides: 4 },
        acquiredTurn: 1,
      },
    ];
    const result = computeTotalClientBonuses(clients);
    expect(result.gold).toBe(5);
    expect(result.trialDefenseBonus).toBe(5);
    expect(result.fides).toBe(4);
  });
});

describe('resolveEventChoice — branching', () => {
  test('nextEventId branch: returns nextEventId and empty effectStr', () => {
    const choice: EventChoice = {
      id: 'ignore',
      label: 'Ignore it',
      nextEventId: 'evt-borrowed-name-followup',
      successEffect: 'lifetimeDignitas+99',
      failureEffect: 'lifetimeDignitas-99',
    };
    const result = resolveEventChoice(choice, makeState() as any);
    expect(result.nextEventId).toBe('evt-borrowed-name-followup');
    expect(result.effectStr).toBe('');
  });

  test('nextEventIdOnSuccess fires when skill check passes', () => {
    const choice: EventChoice = {
      id: 'investigate',
      label: 'Investigate',
      skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 3 },
      nextEventIdOnSuccess: 'evt-rivals-agent-turned',
      nextEventIdOnFailure: 'evt-rivals-agent-failed',
      successEffect: '',
      failureEffect: '',
    };
    const result = resolveEventChoice(choice, makeState() as any);
    expect(result.succeeded).toBe(true);
    expect(result.nextEventId).toBe('evt-rivals-agent-turned');
    expect(result.effectStr).toBe('');
  });

  test('nextEventIdOnFailure fires when skill check fails', () => {
    const choice: EventChoice = {
      id: 'investigate',
      label: 'Investigate',
      skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 10 },
      nextEventIdOnSuccess: 'evt-rivals-agent-turned',
      nextEventIdOnFailure: 'evt-rivals-agent-failed',
      successEffect: '',
      failureEffect: '',
    };
    const result = resolveEventChoice(choice, makeState() as any);
    expect(result.succeeded).toBe(false);
    expect(result.nextEventId).toBe('evt-rivals-agent-failed');
    expect(result.effectStr).toBe('');
  });

  // July 2026 fixes, Chunk D — client/asset rhetoricalBonus/martialBonus/
  // intrigusBonus were computed by clientEngine/assetEngine but never added
  // to any skill check anywhere in the engine. getEffectiveSkill (used here
  // via resolveEventChoice) is the fix.
  test('skill check succeeds using client intrigusBonus even when base skill alone would fail', () => {
    const choice: EventChoice = {
      id: 'investigate',
      label: 'Investigate',
      skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 6 },
      successEffect: '', failureEffect: '',
    };
    // Base intrigus is 4 (makeState fixture) — fails difficulty 6 alone.
    const withoutBonus = resolveEventChoice(choice, makeState() as any);
    expect(withoutBonus.succeeded).toBe(false);

    const withBonus = resolveEventChoice(choice, makeState({
      clients: [{ id: 'c1', name: 'Test Client', type: 'provincial', flavourTitle: '', flavourText: '', bonus: { intrigusBonus: 3 }, acquiredTurn: 1 }],
    }) as any);
    expect(withBonus.succeeded).toBe(true);
  });

  test('non-branching choice applies effectStr normally', () => {
    const choice: EventChoice = {
      id: 'accept',
      label: 'Accept',
      successEffect: 'lifetimeDignitas+5',
      failureEffect: '',
    };
    const result = resolveEventChoice(choice, makeState() as any);
    expect(result.nextEventId).toBeUndefined();
    expect(result.effectStr).toBe('lifetimeDignitas+5');
    expect(result.succeeded).toBe(true);
  });
});

describe('pickRandomEvent — weight:0 exclusion', () => {
  const WEIGHT_ZERO_IDS = [
    'evt-borrowed-name-followup',
    'evt-legion-deserters-reported',
    'evt-legion-deserters-covered',
    'evt-rivals-agent-turned',
    'evt-rivals-agent-failed',
    'evt-rivals-agent-ignored',
    'evt-gracchan-moment',
    'evt-gracchan-aftermath',
    'evt-senate-cannot-act',
    'evt-republic-trembles',
    'evt-grain-riot',
    'evt-creditors-demand',
  ];

  test('all weight:0 events have weight === 0 in EVENT_DEFS', () => {
    for (const id of WEIGHT_ZERO_IDS) {
      const def = EVENT_DEFS.find(d => d.id === id);
      expect(def).toBeDefined();
      expect(def!.weight).toBe(0);
    }
  });

  test('no weight:0 event ever appears in pickRandomEvent output', () => {
    const state = makeState({ lifetimeDignitas: 100, crisisLevel: 50 });
    const selected = new Set<string>();

    for (let i = 0; i < 1000; i++) {
      const picked = pickRandomEvent(EVENT_DEFS, state as any);
      if (picked) selected.add(picked.id);
    }

    for (const id of WEIGHT_ZERO_IDS) {
      expect(selected.has(id)).toBe(false);
    }
  });

  test('pickRandomEvent still returns eligible events with follow-ups in pool', () => {
    const state = makeState({ crisisLevel: 30 });
    let pickedCount = 0;
    for (let i = 0; i < 100; i++) {
      const picked = pickRandomEvent(EVENT_DEFS, state as any);
      if (picked) pickedCount++;
    }
    expect(pickedCount).toBeGreaterThan(80);
  });
});

describe('evalCondition — crisisTrack', () => {
  function makeStateWithCrisis(warLevel: number, unrestLevel = 10, constitutionLevel = 10, economyLevel = 10) {
    return makeState({
      crisis: {
        war:          makeTrack('war',          warLevel),
        unrest:       makeTrack('unrest',       unrestLevel),
        constitution: makeTrack('constitution', constitutionLevel),
        economy:      makeTrack('economy',      economyLevel),
      },
    });
  }

  test('crisisTrack gte passes when track level meets threshold', () => {
    const cond: EventCondition = { type: 'crisisTrack', track: 'war', op: 'gte', value: 40 };
    expect(evalCondition(cond, makeStateWithCrisis(50) as any)).toBe(true);
    expect(evalCondition(cond, makeStateWithCrisis(40) as any)).toBe(true);
  });

  test('crisisTrack gte fails when track level is below threshold', () => {
    const cond: EventCondition = { type: 'crisisTrack', track: 'war', op: 'gte', value: 40 };
    expect(evalCondition(cond, makeStateWithCrisis(39) as any)).toBe(false);
    expect(evalCondition(cond, makeStateWithCrisis(0) as any)).toBe(false);
  });

  test('crisisTrack lt passes when level is below threshold', () => {
    const cond: EventCondition = { type: 'crisisTrack', track: 'unrest', op: 'lt', value: 60 };
    expect(evalCondition(cond, makeStateWithCrisis(10, 55) as any)).toBe(true);
    expect(evalCondition(cond, makeStateWithCrisis(10, 60) as any)).toBe(false);
  });

  test('crisisTrack eq matches exact level', () => {
    const cond: EventCondition = { type: 'crisisTrack', track: 'economy', op: 'eq', value: 25 };
    expect(evalCondition(cond, makeStateWithCrisis(10, 10, 10, 25) as any)).toBe(true);
    expect(evalCondition(cond, makeStateWithCrisis(10, 10, 10, 24) as any)).toBe(false);
  });

  test('each track is evaluated independently', () => {
    const warCond: EventCondition = { type: 'crisisTrack', track: 'war', op: 'gte', value: 70 };
    const unrestCond: EventCondition = { type: 'crisisTrack', track: 'unrest', op: 'gte', value: 70 };
    const state = makeStateWithCrisis(75, 10) as any;
    expect(evalCondition(warCond, state)).toBe(true);
    expect(evalCondition(unrestCond, state)).toBe(false);
  });
});

describe('evalCondition — multiCrisis', () => {
  function makeStateWithAllTracks(war: number, unrest: number, constitution: number, economy: number) {
    return makeState({
      crisis: {
        war:          makeTrack('war',          war),
        unrest:       makeTrack('unrest',       unrest),
        constitution: makeTrack('constitution', constitution),
        economy:      makeTrack('economy',      economy),
      },
    });
  }

  test('passes when all sub-conditions are met', () => {
    const cond: EventCondition = {
      type: 'multiCrisis',
      conditions: [
        { track: 'war',   op: 'gte', value: 60 },
        { track: 'unrest', op: 'gte', value: 60 },
      ],
    };
    const state = makeStateWithAllTracks(65, 65, 10, 10) as any;
    expect(evalCondition(cond, state)).toBe(true);
  });

  test('fails when any sub-condition is not met', () => {
    const cond: EventCondition = {
      type: 'multiCrisis',
      conditions: [
        { track: 'war',   op: 'gte', value: 60 },
        { track: 'unrest', op: 'gte', value: 60 },
      ],
    };
    const state = makeStateWithAllTracks(65, 55, 10, 10) as any;
    expect(evalCondition(cond, state)).toBe(false);
  });

  test('all-four-tracks condition (evt-republic-trembles): passes when all ≥ 60', () => {
    const cond: EventCondition = {
      type: 'multiCrisis',
      conditions: [
        { track: 'war',          op: 'gte', value: 60 },
        { track: 'unrest',       op: 'gte', value: 60 },
        { track: 'constitution', op: 'gte', value: 60 },
        { track: 'economy',      op: 'gte', value: 60 },
      ],
    };
    expect(evalCondition(cond, makeStateWithAllTracks(65, 65, 65, 65) as any)).toBe(true);
    expect(evalCondition(cond, makeStateWithAllTracks(65, 65, 65, 55) as any)).toBe(false);
  });

  test('all-four-tracks condition fails when exactly one track is below threshold', () => {
    const cond: EventCondition = {
      type: 'multiCrisis',
      conditions: [
        { track: 'war',          op: 'gte', value: 60 },
        { track: 'unrest',       op: 'gte', value: 60 },
        { track: 'constitution', op: 'gte', value: 60 },
        { track: 'economy',      op: 'gte', value: 60 },
      ],
    };
    expect(evalCondition(cond, makeStateWithAllTracks(65, 65, 59, 65) as any)).toBe(false);
  });

  test('empty sub-conditions array always passes', () => {
    const cond: EventCondition = { type: 'multiCrisis', conditions: [] };
    const state = makeStateWithAllTracks(0, 0, 0, 0) as any;
    expect(evalCondition(cond, state)).toBe(true);
  });
});

describe('pickRandomEvent — seasonal weighting', () => {
  test('in-season event is ~6× more likely than its off-season counterpart', () => {
    const pool: EventDef[] = [
      makeEventDef('spring-evt', 5, [0]),
      makeEventDef('summer-evt', 5, [1]),
    ];
    const state = makeState({ seasonIndex: 0 });

    let springCount = 0;
    let summerCount = 0;
    const TRIALS = 10_000;

    for (let i = 0; i < TRIALS; i++) {
      const picked = pickRandomEvent(pool, state as any);
      if (picked?.id === 'spring-evt') springCount++;
      else if (picked?.id === 'summer-evt') summerCount++;
    }

    const ratio = springCount / summerCount;
    expect(ratio).toBeGreaterThan(4.0);
    expect(ratio).toBeLessThan(9.0);
  });

  test('untagged event weight is unchanged by season — neutral multiplier applies', () => {
    const pool: EventDef[] = [
      makeEventDef('neutral-evt', 5),
      makeEventDef('autumn-evt',  5, [2]),
    ];
    const state = makeState({ seasonIndex: 1 });

    let neutralCount = 0;
    let autumnCount  = 0;
    const TRIALS = 10_000;

    for (let i = 0; i < TRIALS; i++) {
      const picked = pickRandomEvent(pool, state as any);
      if (picked?.id === 'neutral-evt') neutralCount++;
      else if (picked?.id === 'autumn-evt') autumnCount++;
    }

    const ratio = neutralCount / autumnCount;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(4.5);
  });
});

describe('evalCondition — P1-E new types', () => {
  test('flag: equals:true passes when flag is truthy', () => {
    const cond: EventCondition = { type: 'flag', key: 'spring-seed-loan', equals: true };
    expect(evalCondition(cond, makeState({ flags: { 'spring-seed-loan': true } }) as any)).toBe(true);
    expect(evalCondition(cond, makeState({ flags: {} }) as any)).toBe(false);
    expect(evalCondition(cond, makeState({ flags: { 'spring-seed-loan': false } }) as any)).toBe(false);
  });

  test('flag: equals:false passes when flag is falsy or absent', () => {
    const cond: EventCondition = { type: 'flag', key: 'spring-seed-loan', equals: false };
    expect(evalCondition(cond, makeState({ flags: {} }) as any)).toBe(true);
    expect(evalCondition(cond, makeState({ flags: { 'spring-seed-loan': false } }) as any)).toBe(true);
    expect(evalCondition(cond, makeState({ flags: { 'spring-seed-loan': true } }) as any)).toBe(false);
  });

  test('asset: passes when ownedAssets contains the definitionId', () => {
    const cond: EventCondition = { type: 'asset', definitionId: 'vineyard' };
    const withVineyard = makeState({
      ownedAssets: [{ definitionId: 'vineyard', currentTier: 1, turnAcquired: 1 }],
    });
    const withoutVineyard = makeState({ ownedAssets: [] });
    expect(evalCondition(cond, withVineyard as any)).toBe(true);
    expect(evalCondition(cond, withoutVineyard as any)).toBe(false);
  });

  test('asset: does not match a different asset definitionId', () => {
    const cond: EventCondition = { type: 'asset', definitionId: 'vineyard' };
    const withLibrary = makeState({
      ownedAssets: [{ definitionId: 'library', currentTier: 1, turnAcquired: 1 }],
    });
    expect(evalCondition(cond, withLibrary as any)).toBe(false);
  });

  test('campaigning: passes when campaigning is non-null', () => {
    const cond: EventCondition = { type: 'campaigning' };
    expect(evalCondition(cond, makeState({ campaigning: 'quaestor' }) as any)).toBe(true);
    expect(evalCondition(cond, makeState({ campaigning: null }) as any)).toBe(false);
  });
});

describe('pickRandomEvent — isTutorial exclusion', () => {
  test('pickRandomEvent never returns an isTutorial event across 1000 trials', () => {
    const tutorialDef: EventDef = {
      id: 'test-isTutorial',
      title: 'Tutorial Test',
      bodyText: 'Tutorial body.',
      imageKey: 'portrait-paterfamilias',
      conditions: [],
      weight: 999,
      isTutorial: true,
      choices: [{ id: 'ok', label: 'OK', successEffect: '', failureEffect: '' }],
    };
    const normalDef = makeEventDef('test-normal-pg', 5);
    const pool = [tutorialDef, normalDef];
    const state = makeState();

    for (let i = 0; i < 1000; i++) {
      const picked = pickRandomEvent(pool, state as any);
      expect(picked?.id).not.toBe('test-isTutorial');
    }
  });
});

describe('checkTutorialGate', () => {
  test('tut-01 fires only in Spring (seasonIndex 0)', () => {
    expect(checkTutorialGate('evt-tut-01', makeState({ seasonIndex: 0 }) as any)).toEqual({ fire: true, skip: false });
    expect(checkTutorialGate('evt-tut-01', makeState({ seasonIndex: 1 }) as any)).toEqual({ fire: false, skip: false });
    expect(checkTutorialGate('evt-tut-01', makeState({ seasonIndex: 2 }) as any)).toEqual({ fire: false, skip: false });
    expect(checkTutorialGate('evt-tut-01', makeState({ seasonIndex: 3 }) as any)).toEqual({ fire: false, skip: false });
  });

  test('tut-02 fires only in Summer (seasonIndex 1)', () => {
    expect(checkTutorialGate('evt-tut-02', makeState({ seasonIndex: 1 }) as any)).toEqual({ fire: true,  skip: false });
    expect(checkTutorialGate('evt-tut-02', makeState({ seasonIndex: 0 }) as any)).toEqual({ fire: false, skip: false });
  });

  test('tut-06 is skipped silently in Winter when not campaigning', () => {
    const winterNoCampaign  = makeState({ seasonIndex: 3, campaigning: null });
    const winterCampaigning = makeState({ seasonIndex: 3, campaigning: 'quaestor' });
    const summerNoCampaign  = makeState({ seasonIndex: 1, campaigning: null });

    expect(checkTutorialGate('evt-tut-06', winterNoCampaign  as any)).toEqual({ fire: false, skip: true  });
    expect(checkTutorialGate('evt-tut-06', winterCampaigning as any)).toEqual({ fire: true,  skip: false });
    expect(checkTutorialGate('evt-tut-06', summerNoCampaign  as any)).toEqual({ fire: false, skip: false });
  });

  test('tut-07 fires any season (no gate)', () => {
    for (const seasonIndex of [0, 1, 2, 3] as const) {
      expect(checkTutorialGate('evt-tut-07', makeState({ seasonIndex }) as any)).toEqual({ fire: true, skip: false });
    }
  });

  test('getEventDef searches both main and tutorial pools', () => {
    expect(getEventDef('evt-client-muscle-offer')).toBeDefined();
    expect(getEventDef('evt-client-muscle-offer')?.id).toBe('evt-client-muscle-offer');
    expect(getEventDef('evt-nonexistent-xyz-abc')).toBeUndefined();
    const tutDef = getEventDef('evt-tut-00');
    expect(tutDef).toBeDefined();
    expect(tutDef?.isTutorial).toBe(true);
  });
});

// ─── evt-messana-appeal — Mediterranean-provinces plan, chunk MP-G ──────────
// Lives in data/warEvents.ts's WAR_EVENT_DEFS (getEventDef searches that pool
// too), not data/events.ts — and conditions: [] there, since eligibility is
// gated by turnSequencer.ts's force-injection guard (no carthage war yet AND
// !flags.messanaResolved) rather than the event's own conditions array. That
// guard already has full coverage in warEngine.test.ts's "Mamertine ignition"
// describe block, so it isn't re-tested here — this block only covers the
// choices' own content.

// ─── Phase 5, Chunk P5-C — Event Batch II: The Republic Reacts ──────────────
// Covers the eventEngine.ts 'office' condition fix (previously dead — read a
// nonexistent player.heldOffice field instead of state.currentOffice) and
// force-fires each new crisisTrack/rome/office/resource-gated event from a
// matching debug state, the pure-function equivalent of DebugPanel's
// force-fire tool for a chat session without a live device.

describe("evalCondition — 'office' fix (P5-C)", () => {
  test('matches when state.currentOffice equals the held office', () => {
    const cond: EventCondition = { type: 'office', held: 'quaestor' };
    expect(evalCondition(cond, makeState({ currentOffice: 'quaestor' }) as any)).toBe(true);
    expect(evalCondition(cond, makeState({ currentOffice: 'aedile' }) as any)).toBe(false);
    expect(evalCondition(cond, makeState({ currentOffice: null }) as any)).toBe(false);
  });

  test('is independent of any per-character officeId field', () => {
    // Regression guard: the old (broken) implementation read a nonexistent
    // player.heldOffice field. Confirm a character-level officeId does NOT
    // make the condition pass — only state.currentOffice matters.
    const cond: EventCondition = { type: 'office', held: 'consul' };
    const state = makeState({
      currentOffice: null,
      family: [{ id: 'pc-1', isPlayer: true, officeId: 'consul' }],
    });
    expect(evalCondition(cond, state as any)).toBe(false);
  });
});

describe('P5-C Batch II — schema and eligibility', () => {
  const P5C_IDS = [
    'evt-cri-unrest-bread-queue',
    'evt-cri-unrest-demagogue',
    'evt-cri-economy-moneylender-collapse',
    'evt-cri-economy-contractors-abandon',
    'evt-cri-constitution-veto-standoff',
    'evt-cri-constitution-extralegal-command',
    'evt-cri-war-widows-petition',
    'evt-cri-war-refugee-families',
    'evt-cri-war-profiteer-partnership',
    'evt-rome-plebs-low-shop-shutters',
    'evt-rome-treasury-property-levy',
    'evt-rome-stability-high-complacency',
    'evt-off-quaestor-account-whisper',
    'evt-off-aedile-market-weights',
    'evt-off-praetor-impossible-docket',
    'evt-off-tribune-doorstep-supplicants',
    'evt-off-consul-levy-noshows',
    'evt-rep-salutatio-parasites',
    'evt-rep-low-fides-social-creditor',
    'evt-rep-new-man-sponsorship',
    'evt-rep-new-man-vindicated',
    'evt-rep-new-man-embarrassment',
  ];

  test('every P5-C id exists exactly once in EVENT_DEFS with weight > 0', () => {
    for (const id of P5C_IDS) {
      const matches = EVENT_DEFS.filter(d => d.id === id);
      expect(matches).toHaveLength(1);
      expect(matches[0].weight).toBeGreaterThan(0);
    }
  });

  test('every choice has successEffect/failureEffect strings and no invented skills', () => {
    for (const id of P5C_IDS) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      for (const choice of def.choices) {
        expect(typeof choice.successEffect).toBe('string');
        expect(typeof choice.failureEffect).toBe('string');
        if (choice.skillCheck) {
          expect(['rhetoric', 'martial', 'intrigus']).toContain(choice.skillCheck.skill);
        }
        // Terminal choices (no nextEventId) must carry successText.
        if (!choice.nextEventId && !choice.nextEventIdOnSuccess) {
          expect(choice.successText).toBeTruthy();
        }
        // Terminal failure paths (a skill check with no nextEventIdOnFailure) must carry failureText.
        if (choice.skillCheck && !choice.nextEventIdOnFailure) {
          expect(choice.failureText).toBeTruthy();
        }
      }
    }
  });

  test('crisisTrack-gated events fire only once their track is elevated', () => {
    const trackByEvent: Record<string, CrisisTrack['id']> = {
      'evt-cri-unrest-bread-queue': 'unrest',
      'evt-cri-unrest-demagogue': 'unrest',
      'evt-cri-economy-moneylender-collapse': 'economy',
      'evt-cri-economy-contractors-abandon': 'economy',
      'evt-cri-constitution-veto-standoff': 'constitution',
      'evt-cri-constitution-extralegal-command': 'constitution',
      'evt-cri-war-widows-petition': 'war',
      'evt-cri-war-refugee-families': 'war',
      'evt-cri-war-profiteer-partnership': 'war',
    };
    for (const [id, track] of Object.entries(trackByEvent)) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      const lowState = makeState({
        crisis: {
          war: makeTrack('war', 10), unrest: makeTrack('unrest', 10),
          constitution: makeTrack('constitution', 10), economy: makeTrack('economy', 10),
        },
      });
      expect(isEventEligible(def, lowState as any)).toBe(false);

      const highLevels = { war: 10, unrest: 10, constitution: 10, economy: 10, [track]: 90 };
      const highState = makeState({
        crisis: {
          war: makeTrack('war', highLevels.war), unrest: makeTrack('unrest', highLevels.unrest),
          constitution: makeTrack('constitution', highLevels.constitution),
          economy: makeTrack('economy', highLevels.economy),
        },
      });
      expect(isEventEligible(def, highState as any)).toBe(true);
    }
  });

  test('rome-stat-gated events fire only at the extreme they name', () => {
    const midState = makeState({ rome: { stability: 70, plebs: 60, treasury: 50 } });
    expect(isEventEligible(EVENT_DEFS.find(d => d.id === 'evt-rome-plebs-low-shop-shutters')!, midState as any)).toBe(false);
    expect(isEventEligible(EVENT_DEFS.find(d => d.id === 'evt-rome-treasury-property-levy')!, midState as any)).toBe(false);
    expect(isEventEligible(EVENT_DEFS.find(d => d.id === 'evt-rome-stability-high-complacency')!, midState as any)).toBe(false);

    const extremeState = makeState({ rome: { stability: 90, plebs: 5, treasury: 2 } });
    expect(isEventEligible(EVENT_DEFS.find(d => d.id === 'evt-rome-plebs-low-shop-shutters')!, extremeState as any)).toBe(true);
    expect(isEventEligible(EVENT_DEFS.find(d => d.id === 'evt-rome-treasury-property-levy')!, extremeState as any)).toBe(true);
    expect(isEventEligible(EVENT_DEFS.find(d => d.id === 'evt-rome-stability-high-complacency')!, extremeState as any)).toBe(true);
  });

  test('office-gated events fire only while the player holds that exact office', () => {
    const officeByEvent: Record<string, string> = {
      'evt-off-quaestor-account-whisper': 'quaestor',
      'evt-off-aedile-market-weights': 'aedile',
      'evt-off-praetor-impossible-docket': 'praetor',
      'evt-off-tribune-doorstep-supplicants': 'tribune',
      'evt-off-consul-levy-noshows': 'consul',
    };
    for (const [id, office] of Object.entries(officeByEvent)) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      expect(isEventEligible(def, makeState({ currentOffice: null }) as any)).toBe(false);
      expect(isEventEligible(def, makeState({ currentOffice: 'vigintivirate' }) as any)).toBe(false);
      expect(isEventEligible(def, makeState({ currentOffice: office }) as any)).toBe(true);
    }
  });

  test('standing-reactive events gate on lifetimeDignitas/fides as named', () => {
    const salutatio = EVENT_DEFS.find(d => d.id === 'evt-rep-salutatio-parasites')!;
    expect(isEventEligible(salutatio, makeState({ lifetimeDignitas: 50 }) as any)).toBe(false);
    expect(isEventEligible(salutatio, makeState({ lifetimeDignitas: 200 }) as any)).toBe(true);

    const creditor = EVENT_DEFS.find(d => d.id === 'evt-rep-low-fides-social-creditor')!;
    expect(isEventEligible(creditor, makeState({ fides: 30 }) as any)).toBe(false);
    expect(isEventEligible(creditor, makeState({ fides: 5 }) as any)).toBe(true);
  });

  test('new-man Pattern D: sponsorship flag gates the vindicated follow-up, decline flag gates the embarrassment follow-up', () => {
    const vindicated = EVENT_DEFS.find(d => d.id === 'evt-rep-new-man-vindicated')!;
    const embarrassment = EVENT_DEFS.find(d => d.id === 'evt-rep-new-man-embarrassment')!;

    expect(isEventEligible(vindicated, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(vindicated, makeState({ flags: { 'rep-new-man-sponsored': true } }) as any)).toBe(true);
    expect(isEventEligible(embarrassment, makeState({ flags: { 'rep-new-man-sponsored': true } }) as any)).toBe(false);

    expect(isEventEligible(embarrassment, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(embarrassment, makeState({ flags: { 'rep-new-man-declined': true } }) as any)).toBe(true);
    expect(isEventEligible(vindicated, makeState({ flags: { 'rep-new-man-declined': true } }) as any)).toBe(false);

    // Both follow-ups clear the flag they consume in every terminal choice.
    for (const choice of vindicated.choices) {
      expect(choice.successEffect).toContain('setFlag:rep-new-man-sponsored:false');
    }
    for (const choice of embarrassment.choices) {
      expect(choice.successEffect).toContain('setFlag:rep-new-man-declined:false');
    }
  });

  // Regression guard: an earlier draft used a colon inside the flag name
  // itself ('rep-new-man:sponsored'), which silently broke setFlag's
  // 3-part parser (setFlag:flagKey:value splits on every ':', so a 4th
  // segment gets misread as the value instead of part of the key). Caught
  // by manual review of resourceEngine.ts, not by the eligibility tests
  // above (which only exercise evalCondition, never the effect-string
  // parser) — asserted directly here so it can't silently regress.
  test('setFlag effect strings actually set the intended boolean flag via applyEffectString', () => {
    const sponsorChoice = EVENT_DEFS.find(d => d.id === 'evt-rep-new-man-sponsorship')!
      .choices.find(c => c.id === 'sponsor-him')!;
    const patch = applyEffectString(sponsorChoice.successEffect, makeState({ flags: {} }) as any);
    expect(patch.flags).toEqual({ 'rep-new-man-sponsored': true });

    const vindicated = EVENT_DEFS.find(d => d.id === 'evt-rep-new-man-vindicated')!;
    const clearChoice = vindicated.choices.find(c => c.id === 'accept-public-credit')!;
    const clearPatch = applyEffectString(
      clearChoice.successEffect,
      makeState({ flags: { 'rep-new-man-sponsored': true } }) as any,
    );
    expect(clearPatch.flags?.['rep-new-man-sponsored']).toBe(false);
  });
});

// ─── Phase 5, Chunk P5-D — Event Batch III: Consequences & the Long Game ────
// D1's three trialEngine.ts flags and the two burn-flag sites are covered
// directly in trialEngine.test.ts / p5d.test.ts, next to the functions that
// write them. This block covers the content side: schema compliance and
// eligibility from fabricated matching states for every new evt-aft-*/
// evt-gen-*/evt-end-*/evt-shp-* entry, plus the two showpieces' flag chains.

describe('P5-D Batch III — schema and eligibility', () => {
  const P5D_IDS = [
    'evt-aft-vindication-afterglow',
    'evt-aft-prosecution-cold-shoulder',
    'evt-aft-defense-lost-season',
    'evt-aft-burn-collateral',
    'evt-aft-burn-gossip',
    'evt-gen-measured-against-old',
    'evt-gen-materfamilias-counsel',
    'evt-gen-materfamilias-echo',
    'evt-gen-ancestor-masks',
    'evt-end-veterans-every-corner',
    'evt-end-senate-without-enemy',
    'evt-end-hothead-new-adventures',
    'evt-shp-sibyl-omen',
    'evt-shp-sibyl-senate',
    'evt-shp-sibyl-resolution',
    'evt-shp-grain-shortage',
    'evt-shp-grain-syndicate',
    'evt-shp-grain-reckoning',
  ];

  test('every P5-D id exists exactly once in EVENT_DEFS with weight > 0', () => {
    for (const id of P5D_IDS) {
      const matches = EVENT_DEFS.filter(d => d.id === id);
      expect(matches).toHaveLength(1);
      expect(matches[0].weight).toBeGreaterThan(0);
    }
  });

  test('every choice has successEffect/failureEffect strings and no invented skills', () => {
    for (const id of P5D_IDS) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      for (const choice of def.choices) {
        expect(typeof choice.successEffect).toBe('string');
        expect(typeof choice.failureEffect).toBe('string');
        if (choice.skillCheck) {
          expect(['rhetoric', 'martial', 'intrigus']).toContain(choice.skillCheck.skill);
        }
        if (!choice.nextEventId && !choice.nextEventIdOnSuccess) {
          expect(choice.successText).toBeTruthy();
        }
        if (choice.skillCheck && !choice.nextEventIdOnFailure) {
          expect(choice.failureText).toBeTruthy();
        }
      }
    }
  });

  test('the three trial-outcome-gated aftermath events fire only from their named flag', () => {
    const cases: [string, string][] = [
      ['evt-aft-vindication-afterglow', 'trial-resolved-defense-won'],
      ['evt-aft-prosecution-cold-shoulder', 'trial-resolved-prosecution-won'],
      ['evt-aft-defense-lost-season', 'trial-resolved-defense-lost'],
    ];
    for (const [id, flag] of cases) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      expect(isEventEligible(def, makeState({ flags: {} }) as any)).toBe(false);
      expect(isEventEligible(def, makeState({ flags: { [flag]: true } }) as any)).toBe(true);
      // every terminal choice clears the flag it consumed
      for (const choice of def.choices) {
        expect(choice.successEffect).toContain(`setFlag:${flag}:false`);
        if (choice.skillCheck) expect(choice.failureEffect).toContain(`setFlag:${flag}:false`);
      }
    }
  });

  test('both burn-gated aftermath events share secret-burned-recently and both clear it', () => {
    for (const id of ['evt-aft-burn-collateral', 'evt-aft-burn-gossip']) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      expect(isEventEligible(def, makeState({ flags: {} }) as any)).toBe(false);
      expect(isEventEligible(def, makeState({ flags: { 'secret-burned-recently': true } }) as any)).toBe(true);
      for (const choice of def.choices) {
        expect(choice.successEffect).toContain('setFlag:secret-burned-recently:false');
      }
    }
  });

  test('generational events gate on lifetimeDignitas thresholds / season, per the Option-A reinterpretation', () => {
    const measured = EVENT_DEFS.find(d => d.id === 'evt-gen-measured-against-old')!;
    expect(isEventEligible(measured, makeState({ lifetimeDignitas: 100 }) as any)).toBe(false);
    expect(isEventEligible(measured, makeState({ lifetimeDignitas: 300 }) as any)).toBe(true);

    const masks = EVENT_DEFS.find(d => d.id === 'evt-gen-ancestor-masks')!;
    expect(isEventEligible(masks, makeState({ seasonIndex: 3, lifetimeDignitas: 350 }) as any)).toBe(true);
    expect(isEventEligible(masks, makeState({ seasonIndex: 0, lifetimeDignitas: 350 }) as any)).toBe(false);
    expect(isEventEligible(masks, makeState({ seasonIndex: 3, lifetimeDignitas: 100 }) as any)).toBe(false);

    // The materfamilias arc is deliberately unconditioned (Option A) — no
    // spouse-existence check exists in this schema (matches the precedent
    // already shipped in P5-B's evt-dom-sibling-friction).
    const counsel = EVENT_DEFS.find(d => d.id === 'evt-gen-materfamilias-counsel')!;
    expect(isEventEligible(counsel, makeState() as any)).toBe(true);
  });

  test('materfamilias-counsel sets one flag on either branch; the echo follow-up gates on it and clears it', () => {
    const opening = EVENT_DEFS.find(d => d.id === 'evt-gen-materfamilias-counsel')!;
    for (const choice of opening.choices) {
      expect(choice.successEffect).toContain('setFlag:materfamilias-advised:true');
    }
    const echo = EVENT_DEFS.find(d => d.id === 'evt-gen-materfamilias-echo')!;
    expect(isEventEligible(echo, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(echo, makeState({ flags: { 'materfamilias-advised': true } }) as any)).toBe(true);
    for (const choice of echo.choices) {
      expect(choice.successEffect).toContain('setFlag:materfamilias-advised:false');
      if (choice.skillCheck) expect(choice.failureEffect).toContain('setFlag:materfamilias-advised:false');
    }
  });

  test('Endless-mode ambience events gate on endless-mode-active', () => {
    for (const id of ['evt-end-veterans-every-corner', 'evt-end-senate-without-enemy', 'evt-end-hothead-new-adventures']) {
      const def = EVENT_DEFS.find(d => d.id === id)!;
      expect(isEventEligible(def, makeState({ flags: {} }) as any)).toBe(false);
      expect(isEventEligible(def, makeState({ flags: { 'endless-mode-active': true } }) as any)).toBe(true);
    }
  });

  test('The Sibyl\'s Price showpiece chains scene-to-scene via flags, each scene a real pool entry', () => {
    const omen = EVENT_DEFS.find(d => d.id === 'evt-shp-sibyl-omen')!;
    const senate = EVENT_DEFS.find(d => d.id === 'evt-shp-sibyl-senate')!;
    const resolution = EVENT_DEFS.find(d => d.id === 'evt-shp-sibyl-resolution')!;

    // Scene 1 is unconditioned (opening scene) and has a guaranteed exit
    // (dismiss-haruspex) that sets no chain flag at all.
    expect(isEventEligible(omen, makeState() as any)).toBe(true);
    const dismiss = omen.choices.find(c => c.id === 'dismiss-haruspex')!;
    expect(dismiss.successEffect).not.toContain('setFlag:sibyl-reported');

    // Scene 2 gates on sibyl-reported; both its choices eventually clear it
    // (one directly, one via the failure branch escalating to scene 3).
    expect(isEventEligible(senate, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(senate, makeState({ flags: { 'sibyl-reported': true } }) as any)).toBe(true);
    const addressChoice = senate.choices.find(c => c.id === 'address-senate')!;
    expect(addressChoice.successEffect).toContain('setFlag:sibyl-reported:false');
    expect(addressChoice.failureEffect).toContain('setFlag:sibyl-reported:false');
    expect(addressChoice.failureEffect).toContain('setFlag:sibyl-escalated:true');

    // Scene 3 gates on sibyl-escalated (only reachable via scene 2's failure branch).
    expect(isEventEligible(resolution, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(resolution, makeState({ flags: { 'sibyl-escalated': true } }) as any)).toBe(true);
    for (const choice of resolution.choices) {
      expect(choice.successEffect).toContain('setFlag:sibyl-escalated:false');
    }
  });

  test('The Grain Fleet showpiece chains autumn shortage -> syndicate offer -> spring reckoning', () => {
    const shortage = EVENT_DEFS.find(d => d.id === 'evt-shp-grain-shortage')!;
    const syndicate = EVENT_DEFS.find(d => d.id === 'evt-shp-grain-syndicate')!;
    const reckoning = EVENT_DEFS.find(d => d.id === 'evt-shp-grain-reckoning')!;

    expect(isEventEligible(shortage, makeState() as any)).toBe(true);
    expect(shortage.seasons).toEqual([2]); // autumn, soft-weighted

    expect(isEventEligible(syndicate, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(syndicate, makeState({ flags: { 'grain-fleet-pressure': true } }) as any)).toBe(true);
    for (const choice of syndicate.choices) {
      expect(choice.successEffect).toContain('setFlag:grain-fleet-pressure:false');
    }
    // The syndicate deal is a real risk/reward choice per the guide's §6.2
    // createLatentSecret allowance — accepting it plants a real Secret.
    const acceptDeal = syndicate.choices.find(c => c.id === 'accept-syndicate')!;
    expect(acceptDeal.successEffect).toContain('createLatentSecret:provincial_plunder:2');

    expect(isEventEligible(reckoning, makeState({ flags: {} }) as any)).toBe(false);
    expect(isEventEligible(reckoning, makeState({ flags: { 'grain-fleet-reckoning': true } }) as any)).toBe(true);
    expect(reckoning.seasons).toEqual([0]); // spring, soft-weighted
    for (const choice of reckoning.choices) {
      expect(choice.successEffect).toContain('setFlag:grain-fleet-reckoning:false');
    }
  });
});

describe('evt-messana-appeal — Sicily/Mediterranean province flip trigger', () => {
  const def = getEventDef('evt-messana-appeal')!;

  test('exists with the two expected choices', () => {
    expect(def).toBeDefined();
    expect(def.choices.map(c => c.id).sort()).toEqual(['answer-the-call', 'refuse']);
  });

  test('answering the call sets both the resolved and conquest flags plus a war-track bump', () => {
    const choice = def.choices.find(c => c.id === 'answer-the-call')!;
    const { effectStr } = resolveEventChoice(choice, makeState({ flags: {} }) as any);
    expect(effectStr).toContain('setFlag:messanaResolved:true');
    expect(effectStr).toContain('setFlag:messanaJoinsRome:true');
    expect(effectStr).toContain('crisis-war+15');
  });

  test('refusing sets only the resolved flag, not the conquest flag', () => {
    const choice = def.choices.find(c => c.id === 'refuse')!;
    const { effectStr } = resolveEventChoice(choice, makeState({ flags: {} }) as any);
    expect(effectStr).toContain('setFlag:messanaResolved:true');
    expect(effectStr).not.toContain('messanaJoinsRome');
  });
});