import { rollClientBonus, computeTotalClientBonuses } from '../src/engine/clientEngine';
import { resolveEventChoice, pickRandomEvent } from '../src/engine/eventEngine';
import { EVENT_DEFS } from '../src/data/events';
import type { ClientType, Client } from '../src/models/client';
import type { EventChoice } from '../src/models/event';

// ─── Shared state fixture ─────────────────────────────────────────────────────

const makeState = (overrides = {}) => ({
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
  ...overrides,
});

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
      // 30% chance of secondary per roll — 500 trials virtually guarantees secondaries appear
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
    // Player intrigus = 4, difficulty = 3 → succeeds
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
    // Player intrigus = 4, difficulty = 10 → fails
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

// ─── Test 5 — weight:0 follow-up events never fire via pickRandomEvent ────────

describe('pickRandomEvent — weight:0 exclusion', () => {
  const FOLLOW_UP_IDS = [
    'evt-borrowed-name-followup',
    'evt-legion-deserters-reported',
    'evt-legion-deserters-covered',
    'evt-rivals-agent-turned',
    'evt-rivals-agent-failed',
    'evt-rivals-agent-ignored',
  ];

  test('all follow-up events have weight === 0 in EVENT_DEFS', () => {
    for (const id of FOLLOW_UP_IDS) {
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

    for (const id of FOLLOW_UP_IDS) {
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
    // Unconditional weight>0 events should fire almost every roll
    expect(pickedCount).toBeGreaterThan(80);
  });
});
