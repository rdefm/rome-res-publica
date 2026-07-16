import { rollClientBonus, computeTotalClientBonuses } from '../src/engine/clientEngine';
import { resolveEventChoice, pickRandomEvent, evalCondition, checkTutorialGate, getEventDef } from '../src/engine/eventEngine';
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
    _expandedBill: null, _expandedType: null, provinces: [],
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