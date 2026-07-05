import { rollClientBonus, computeTotalClientBonuses } from '../src/engine/clientEngine';
import { resolveEventChoice, pickRandomEvent, evalCondition } from '../src/engine/eventEngine';
import { EVENT_DEFS } from '../src/data/events';
import type { ClientType, Client } from '../src/models/client';
import type { EventChoice, EventCondition } from '../src/models/event';
import { getTierFromLevel } from '../src/models/crisis';
import type { CrisisState, CrisisTrack } from '../src/models/crisis';

// ─── Shared state fixture ─────────────────────────────────────────────────────

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

// ─── Test 1 — rollClientBonus always returns at least one key ────────────────

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

// ─── Test 2 — secondary bonus key never matches primary key ──────────────────

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

// ─── Test 3 — computeTotalClientBonuses([]) returns empty object ─────────────

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

// ─── Test 4 — branching choice returns nextEventId, does not apply effectStr ──

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

// ─── Test 5 — weight:0 events never fire via pickRandomEvent ─────────────────
// Includes all original follow-up events plus new inject-only events from Chunk 2C.

describe('pickRandomEvent — weight:0 exclusion', () => {
  const WEIGHT_ZERO_IDS = [
    // Original follow-ups
    'evt-borrowed-name-followup',
    'evt-legion-deserters-reported',
    'evt-legion-deserters-covered',
    'evt-rivals-agent-turned',
    'evt-rivals-agent-failed',
    'evt-rivals-agent-ignored',
    // Chunk 2C: multi-ticker events (injection-only)
    'evt-gracchan-moment',
    'evt-gracchan-aftermath',
    'evt-senate-cannot-act',
    'evt-republic-trembles',
    // Chunk 2C: injected-by-turnSequencer special events
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

// ─── Test 6 — evalCondition: crisisTrack conditions ──────────────────────────

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
    const state = makeStateWithCrisis(75, 10) as any; // war=75, unrest=10
    expect(evalCondition(warCond, state)).toBe(true);
    expect(evalCondition(unrestCond, state)).toBe(false);
  });
});

// ─── Test 7 — evalCondition: multiCrisis conditions ──────────────────────────

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
    // unrest = 55 — below threshold
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
    // Constitution just below threshold
    expect(evalCondition(cond, makeStateWithAllTracks(65, 65, 59, 65) as any)).toBe(false);
  });

  test('empty sub-conditions array always passes', () => {
    const cond: EventCondition = { type: 'multiCrisis', conditions: [] };
    const state = makeStateWithAllTracks(0, 0, 0, 0) as any;
    expect(evalCondition(cond, state)).toBe(true);
  });
});
