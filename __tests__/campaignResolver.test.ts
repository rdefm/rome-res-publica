import { resolveCampaignSeason, resolveEngagement } from '../src/engine/campaignResolver';
import type { Army, ArmyUnit, MovementOrder } from '../src/models/army';
import type { TheatreState, RegionId } from '../src/models/theatre';
import type { CityState } from '../src/models/city';
import type { Clan, ClanLeader } from '../src/models/clan';
import type { Character } from '../src/models/character';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import { REGIONS } from '../src/data/theatreMap';
import { makeSeededRng } from '../src/utils/seededRng';

// ─── Fixtures (real 8-region graph, per movementEngine.test.ts's own
// convention — no synthetic topology needed) ────────────────────────────────

function makeUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: `unit-${Math.random().toString(36).slice(2)}`,
    unitClass: 'legionary',
    strength: 80,
    veterancy: 'trained',
    loyalty: 50,
    elephantSteady: false,
    homeRegion: 'latium',
    raisedBy: 'state',
    raisedSeason: 1,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1',
    name: 'Legio I',
    owner: 'rome_state',
    commanderId: null,
    location: 'latium',
    stationedCityId: 'latium',
    units: [makeUnit()],
    stance: 'give_battle',
    ordersThisSeason: null,
    fatigued: false,
    unpaidSeasons: 0,
    ...overrides,
  };
}

function makeOrder(path: RegionId[], overrides: Partial<MovementOrder> = {}): MovementOrder {
  return { path, forcedMarch: false, intent: 'move', ...overrides };
}

function makeTheatre(overrides: Partial<TheatreState['controllers']> = {}): TheatreState {
  const controllers = {} as TheatreState['controllers'];
  const contested = {} as TheatreState['contested'];
  const musteredThisYear = {} as TheatreState['musteredThisYear'];
  for (const region of REGIONS) {
    controllers[region.id] = region.startingController;
    contested[region.id] = 0;
    musteredThisYear[region.id] = 0;
  }
  Object.assign(controllers, overrides);
  return { controllers, contested, musteredThisYear };
}

function makeLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
  return {
    id: 'leader-1', name: 'Leader', title: 'Senator', emoji: '👤', age: 50,
    sphere: 'politics', relationship: 0, favour: 0, blackmail: false, bias: 'optimates',
    votes: 5, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  };
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'clan-1', name: 'Clan', gensName: 'Testia', sigil: '🏛', influence: 50,
    desc: '', leaders: [makeLeader()],
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0,
    raisedLegions: [], veterans: [],
    ...overrides,
  } as unknown as Character;
}

const CITIES = buildInitialCityStates();

function baseInput(armies: Army[], theatreOverrides: Partial<TheatreState['controllers']> = {}) {
  return {
    armies,
    theatre: makeTheatre(theatreOverrides),
    cities: CITIES,
    family: [makeCharacter()],
    clans: [makeClan()],
    denarii: 1000,
    seasonIndex: 0,
    turnNumber: 10,
  };
}

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('resolveCampaignSeason — determinism', () => {
  test('same seed + same orders = identical log and state', () => {
    const armyA = makeArmy({
      id: 'a', owner: 'rome_state', commanderId: null, location: 'etruria',
      ordersThisSeason: makeOrder(['etruria', 'latium']),
    });
    const armyB = makeArmy({
      id: 'b', owner: 'carthage', commanderId: null, location: 'sardinia',
      ordersThisSeason: makeOrder(['sardinia', 'campania']),
    });
    const input = baseInput([armyA, armyB]);

    const r1 = resolveCampaignSeason(input, makeSeededRng(42));
    const r2 = resolveCampaignSeason(input, makeSeededRng(42));

    expect(r1.armies).toEqual(r2.armies);
    expect(r1.theatre).toEqual(r2.theatre);
    expect(r1.log).toEqual(r2.log);
    expect(r1.pendingEngagements).toEqual(r2.pendingEngagements);
  });
});

// ─── Initiative & round-robin stepping ──────────────────────────────────────

describe('resolveCampaignSeason — initiative & round-robin', () => {
  // etruria -(land)- latium -(land)- campania is a real 2-hop route; latium
  // -(land)- samnium is a real 1-hop route. A MOVER passing through latium
  // to reach campania can be intercepted there by a CARTHAGE army arriving
  // from samnium in the SAME season — whichever army has higher initiative
  // (commander martial) claims latium first within a shared round.

  function scenario(interceptorMartial: number, moverMartial: number) {
    const mover = makeArmy({
      id: 'mover', owner: 'rome_state', commanderId: 'mover-cmd', location: 'etruria',
      ordersThisSeason: makeOrder(['etruria', 'latium', 'campania']),
    });
    const interceptor = makeArmy({
      id: 'interceptor', owner: 'carthage', commanderId: 'interceptor-cmd', location: 'samnium',
      ordersThisSeason: makeOrder(['samnium', 'latium']),
    });
    const input = {
      ...baseInput([mover, interceptor]),
      family: [
        makeCharacter({ id: 'mover-cmd', skills: { rhetoric: 5, martial: moverMartial, intrigus: 5 } }),
        makeCharacter({ id: 'interceptor-cmd', skills: { rhetoric: 5, martial: interceptorMartial, intrigus: 5 } }),
      ],
    };
    return resolveCampaignSeason(input, makeSeededRng(1));
  }

  test('higher-initiative interceptor blocks the mover mid-route', () => {
    const result = scenario(9, 1); // interceptor faster
    const finalMover = result.armies.find(a => a.id === 'mover')!;
    expect(finalMover.location).toBe('etruria'); // bounced, never left
    expect(result.log.entries.some(e => e.type === 'bounce' && e.armyId === 'mover')).toBe(true);
  });

  test('higher-initiative mover claims latium first and completes its route', () => {
    const result = scenario(1, 9); // mover faster
    const finalMover = result.armies.find(a => a.id === 'mover')!;
    expect(finalMover.location).toBe('campania'); // completed both hops
    const finalInterceptor = result.armies.find(a => a.id === 'interceptor')!;
    expect(finalInterceptor.location).toBe('samnium'); // bounced
  });
});

// ─── Bounce / attack / withdrawal branches ──────────────────────────────────

describe('resolveCampaignSeason — engagement branches', () => {
  test('an NPC-vs-NPC attack against a give_battle defender resolves inline as a battle', () => {
    const attacker = makeArmy({
      id: 'attacker', owner: 'carthage', commanderId: 'gen-a', location: 'campania',
      units: [makeUnit({ strength: 100, unitClass: 'legionary' }), makeUnit({ strength: 100, unitClass: 'legionary' })],
      ordersThisSeason: makeOrder(['campania', 'sicilia'], { intent: 'attack' }),
    });
    const defender = makeArmy({
      id: 'defender', owner: 'rome_rival', commanderId: 'gen-b', location: 'sicilia',
      units: [makeUnit({ strength: 10, unitClass: 'skirmisher', veterancy: 'raw' })],
      stance: 'give_battle',
    });
    const input = {
      ...baseInput([attacker, defender]),
      clans: [makeClan({ leaders: [makeLeader({ id: 'gen-a', skills: { rhetoric: 5, martial: 8, intrigus: 5 } }), makeLeader({ id: 'gen-b', skills: { rhetoric: 5, martial: 2, intrigus: 5 } })] })],
    };
    const result = resolveCampaignSeason(input, makeSeededRng(5));

    expect(result.pendingEngagements).toEqual([]);
    const battleEntry = result.log.entries.find(e => e.type === 'battle');
    expect(battleEntry).toBeDefined();
    // The much stronger attacker should win — defender either retreats or shatters.
    const survivingDefender = result.armies.find(a => a.id === 'defender');
    const survivingAttacker = result.armies.find(a => a.id === 'attacker')!;
    expect(survivingAttacker.location).toBe('sicilia');
    if (survivingDefender) {
      expect(survivingDefender.location).not.toBe('sicilia');
    }
  });

  test('a player-manageable side defers to pendingEngagements instead of resolving inline', () => {
    const attacker = makeArmy({
      id: 'attacker', owner: 'player', commanderId: 'pc-1', location: 'campania',
      ordersThisSeason: makeOrder(['campania', 'sicilia'], { intent: 'attack' }),
    });
    const defender = makeArmy({
      id: 'defender', owner: 'carthage', commanderId: null, location: 'sicilia',
    });
    const input = baseInput([attacker, defender]);
    const result = resolveCampaignSeason(input, makeSeededRng(2));

    expect(result.pendingEngagements).toHaveLength(1);
    expect(result.pendingEngagements[0]).toMatchObject({ attackerArmyId: 'attacker', defenderArmyId: 'defender', regionId: 'sicilia' });
    // Neither army was mutated by an inline resolution — attacker stays put, defender stays put.
    expect(result.armies.find(a => a.id === 'attacker')!.location).toBe('campania');
    expect(result.armies.find(a => a.id === 'defender')!.location).toBe('sicilia');
  });

  test('resolveEngagement: a defender with avoid_battle stance and a high-martial commander withdraws', () => {
    const attacker = makeArmy({ id: 'attacker', owner: 'player', location: 'campania' });
    const defender = makeArmy({
      id: 'defender', owner: 'carthage', commanderId: 'gen-strong', location: 'sicilia',
      stance: 'avoid_battle',
    });
    const engagement = { regionId: 'sicilia' as RegionId, attackerArmyId: 'attacker', defenderArmyId: 'defender' };
    const theatre = makeTheatre({ sardinia: 'carthage' }); // sicilia's only carthage-controlled neighbor is via sea; use a rng that forces success instead
    const family = [makeCharacter({ id: 'pc-1' })];
    const clans = [makeClan({ leaders: [makeLeader({ id: 'gen-strong', skills: { rhetoric: 5, martial: 10, intrigus: 5 } })] })];

    // A very low rng() roll always clears the withdrawal chance threshold (base 30 + martial bonus).
    const result = resolveEngagement(engagement, [attacker, defender], theatre, family, clans, () => 0.01);
    const withdrawalEntry = result.logEntries.find(e => e.type === 'withdrawal' || e.type === 'shatter');
    expect(withdrawalEntry).toBeDefined();
    const finalDefender = result.armies.find(a => a.id === 'defender');
    const finalAttacker = result.armies.find(a => a.id === 'attacker')!;
    expect(finalAttacker.location).toBe('sicilia'); // occupies the vacated/cleared region
    if (finalDefender) expect(finalDefender.location).not.toBe('sicilia');
  });
});

// ─── Retreat priority & shatter ──────────────────────────────────────────────

describe('resolveEngagement — retreat priority & shatter', () => {
  test('a loser with no friendly-adjacent region shatters and is removed', () => {
    // sardinia's only land/strait neighbors are none (sea-lane only region) —
    // a carthage army holding sardinia has no friendly land retreat.
    const attacker = makeArmy({ id: 'attacker', owner: 'player', location: 'sardinia', stance: 'give_battle' });
    const defender = makeArmy({
      id: 'defender', owner: 'carthage', location: 'sardinia', stance: 'give_battle',
      units: [makeUnit({ strength: 1 })], // guaranteed loser
    });
    attacker.units = [makeUnit({ strength: 100 }), makeUnit({ strength: 100 })];
    const engagement = { regionId: 'sardinia' as RegionId, attackerArmyId: 'attacker', defenderArmyId: 'defender' };
    const theatre = makeTheatre();
    const result = resolveEngagement(engagement, [attacker, defender], theatre, [makeCharacter()], [makeClan()], makeSeededRng(3));

    expect(result.armies.find(a => a.id === 'defender')).toBeUndefined();
    expect(result.logEntries.some(e => e.type === 'shatter' && e.armyId === 'defender')).toBe(true);
  });
});

// ─── Control flips ───────────────────────────────────────────────────────────

describe('resolveCampaignSeason — control flips', () => {
  test('a region flips only on the 2nd consecutive uncontested-hostile season', () => {
    const carthageArmy = makeArmy({ id: 'occupier', owner: 'carthage', location: 'latium' });
    const input1 = baseInput([carthageArmy]);
    const r1 = resolveCampaignSeason(input1, makeSeededRng(9));
    expect(r1.theatre.controllers.latium).toBe('rome'); // not yet — 1st season
    expect(r1.theatre.contested.latium).toBe(1);

    const input2 = { ...input1, theatre: r1.theatre, armies: r1.armies };
    const r2 = resolveCampaignSeason(input2, makeSeededRng(9));
    expect(r2.theatre.controllers.latium).toBe('carthage'); // flips on the 2nd season
    expect(r2.theatre.contested.latium).toBe(0);
    expect(r2.log.entries.some(e => e.type === 'flip' && e.regionId === 'latium')).toBe(true);
  });

  test('contested resets to 0 once the hostile occupier leaves', () => {
    const carthageArmy = makeArmy({ id: 'occupier', owner: 'carthage', location: 'latium' });
    const r1 = resolveCampaignSeason(baseInput([carthageArmy]), makeSeededRng(9));
    expect(r1.theatre.contested.latium).toBe(1);

    // Second season: no armies at all in latium.
    const r2 = resolveCampaignSeason({ ...baseInput([]), theatre: r1.theatre }, makeSeededRng(9));
    expect(r2.theatre.contested.latium).toBe(0);
  });
});

// ─── Raids ───────────────────────────────────────────────────────────────────

describe('resolveCampaignSeason — raids', () => {
  test('a raiding army reaching its target stings relationship/denarii and logs a raid entry, not a flip', () => {
    const raider = makeArmy({
      id: 'raider', owner: 'carthage', location: 'campania',
      ordersThisSeason: makeOrder(['campania', 'latium'], { raiding: true }),
    });
    const input = baseInput([raider]);
    const result = resolveCampaignSeason(input, makeSeededRng(11));

    expect(result.log.entries.some(e => e.type === 'raid' && e.armyId === 'raider')).toBe(true);
    expect(result.log.entries.some(e => e.type === 'flip')).toBe(false); // raiding never seeks control
    expect(result.theatre.contested.latium).toBe(0);
    expect(result.denarii).toBeLessThan(input.denarii);
    const latiumCity = result.cities.find(c => c.id === 'latium')!;
    const originalLatiumCity = CITIES.find(c => c.id === 'latium')!;
    expect(latiumCity.relationshipScore).toBeLessThanOrEqual(originalLatiumCity.relationshipScore);
  });
});

// ─── Multi-season stability (no exceptions over many seasons) ──────────────

describe('resolveCampaignSeason — multi-season sim', () => {
  test('20 seasons of a Carthage army repeatedly reinforced and re-ordered never throws', () => {
    let armies: Army[] = [
      makeArmy({ id: 'rome-garrison', owner: 'rome_state', location: 'latium', commanderId: 'gen-b' }),
      makeArmy({ id: 'carthage-raider', owner: 'carthage', location: 'sicilia', commanderId: 'gen-a' }),
    ];
    let theatre = makeTheatre();
    const family = [makeCharacter()];
    const clans = [makeClan({ leaders: [makeLeader({ id: 'gen-a', skills: { rhetoric: 5, martial: 5, intrigus: 5 } }), makeLeader({ id: 'gen-b', skills: { rhetoric: 5, martial: 5, intrigus: 5 } })] })];
    let denarii = 1000;
    const rng = makeSeededRng(77);

    for (let season = 0; season < 20; season++) {
      armies = armies.map(a => {
        if (a.id !== 'carthage-raider') return a;
        const dest: RegionId = a.location === 'sicilia' ? 'campania' : 'sicilia';
        return { ...a, ordersThisSeason: makeOrder([a.location, dest], { raiding: true }) };
      });
      const result = resolveCampaignSeason(
        { armies, theatre, cities: CITIES, family, clans, denarii, seasonIndex: season % 4, turnNumber: season },
        rng,
      );
      armies = result.armies;
      theatre = result.theatre;
      denarii = result.denarii;
    }
    expect(armies.length).toBeGreaterThan(0);
  });
});
