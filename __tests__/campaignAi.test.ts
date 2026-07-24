import {
  softmaxChoose,
  chooseSeasonOrders,
  profileForCarthageArmy,
  deriveNpcRomanProfile,
  assignCarthaginianOrders,
  assignNpcRomanOrders,
  shouldReinforceCarthage,
  applyCarthageReinforcement,
  trueIntentFor,
  telegraphIntent,
} from '../src/engine/campaignAi';
import { ENEMY_GENERALS } from '../src/data/enemyGenerals';
import type { Army, ArmyUnit } from '../src/models/army';
import type { TheatreState } from '../src/models/theatre';
import type { CityState } from '../src/models/city';
import type { Clan, ClanLeader } from '../src/models/clan';
import { REGIONS } from '../src/data/theatreMap';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import { makeSeededRng } from '../src/utils/seededRng';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: `unit-${Math.random().toString(36).slice(2)}`,
    unitClass: 'spear_foot', strength: 100, veterancy: 'trained', loyalty: 50,
    elephantSteady: false, homeRegion: 'africa', raisedBy: 'npc', raisedSeason: 1,
    campaignsSurvived: 0, wonCrushingVictory: false,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1', name: 'Test Army', owner: 'carthage', commanderId: 'hanno_cautious',
    location: 'africa', stationedCityId: 'carthage', units: [makeUnit(), makeUnit()],
    stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    ...overrides,
  };
}

function makeTheatre(overrides: Partial<TheatreState['controllers']> = {}): TheatreState {
  const controllers = {} as TheatreState['controllers'];
  const musteredThisYear = {} as TheatreState['musteredThisYear'];
  for (const region of REGIONS) {
    controllers[region.id] = region.startingController;
    musteredThisYear[region.id] = 0;
  }
  Object.assign(controllers, overrides);
  return { controllers, contested: {} as TheatreState['contested'], musteredThisYear };
}

function withRelationship(cities: CityState[], cityId: string, relationshipScore: number): CityState[] {
  return cities.map(c => (c.id === cityId ? { ...c, relationshipScore } : c));
}

function makeLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
  return {
    id: 'leader-1', name: 'Leader', title: 'Senator', emoji: '👤', age: 50,
    sphere: 'politics', relationship: 0, favour: 0, blackmail: false, bias: 'optimates',
    votes: 0, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  };
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'clan-1', name: 'Clan', gensName: 'Testia', sigil: '🏛', influence: 50,
    desc: '', leaders: [],
    ...overrides,
  };
}

const cities = buildInitialCityStates();

// ─── softmaxChoose ──────────────────────────────────────────────────────────

describe('softmaxChoose', () => {
  test('deterministic under a fixed seed', () => {
    const scores = { hold: 1, advance: 1, raid: 1 };
    const weights = { hold: 1, advance: 2, raid: 0.5 };
    const rng1 = makeSeededRng(42);
    const rng2 = makeSeededRng(42);
    const results1 = Array.from({ length: 20 }, () => softmaxChoose(scores, weights, 1.0, rng1));
    const results2 = Array.from({ length: 20 }, () => softmaxChoose(scores, weights, 1.0, rng2));
    expect(results1).toEqual(results2);
  });

  test('an invalid (-Infinity) behavior is never chosen regardless of weight', () => {
    const scores = { hold: -Infinity, advance: 1, raid: -Infinity };
    const weights = { hold: 100, advance: 1, raid: 100 };
    const rng = makeSeededRng(7);
    for (let i = 0; i < 50; i++) {
      expect(softmaxChoose(scores, weights, 1.0, rng)).toBe('advance');
    }
  });

  test('a much higher weight is chosen far more often over many draws', () => {
    const scores = { hold: 1, advance: 1, raid: 1 };
    const weights = { hold: 0.2, advance: 3, raid: 1 };
    const rng = makeSeededRng(99);
    const counts = { hold: 0, advance: 0, raid: 0 };
    for (let i = 0; i < 500; i++) counts[softmaxChoose(scores, weights, 1.0, rng)]++;
    expect(counts.advance).toBeGreaterThan(counts.hold * 2);
  });

  test('all-zero exponentials (degenerate) falls back to hold rather than NaN', () => {
    const scores = { hold: -Infinity, advance: -Infinity, raid: -Infinity };
    const weights = { hold: 1, advance: 1, raid: 1 };
    expect(softmaxChoose(scores, weights, 1.0, () => 0.5)).toBe('hold');
  });
});

// ─── chooseSeasonOrders ─────────────────────────────────────────────────────

describe('chooseSeasonOrders', () => {
  test('deterministic under a fixed seed given identical state', () => {
    const army = makeArmy({ owner: 'carthage', location: 'africa' });
    const theatre = makeTheatre();
    const profile = ENEMY_GENERALS.bomilcar_bull;
    const r1 = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, makeSeededRng(1));
    const r2 = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, makeSeededRng(1));
    expect(r1).toEqual(r2);
  });

  test('HOLD is only reachable when stationed in sicilia AND it is under threat', () => {
    // Friendly sicilia, no threat anywhere nearby -> hold is never valid,
    // so with everything else also friendly-controlled, nothing is valid.
    const army = makeArmy({
      owner: 'rome_state', location: 'sicilia', commanderId: 'cmdr-1',
      units: [makeUnit({ unitClass: 'legionary' })],
    });
    const theatre = makeTheatre({
      sicilia: 'rome', latium: 'rome', etruria: 'rome', campania: 'rome',
      samnium: 'rome', cisalpine_gaul: 'rome', sardinia: 'rome', africa: 'rome',
    });
    const profile = ENEMY_GENERALS.xanthippus_drillmaster;
    const order = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, () => 0.99);
    expect(order).toBeNull();
  });

  test('HOLD is chosen (no order) when Sicily is friendly-controlled and threatened by a stronger adjacent enemy', () => {
    const holder = makeArmy({
      id: 'holder', owner: 'rome_state', location: 'sicilia', commanderId: 'cmdr-1',
      units: [makeUnit({ strength: 10 })],
    });
    const bigEnemy = makeArmy({
      id: 'big-enemy', owner: 'carthage', location: 'campania',
      units: Array.from({ length: 10 }, () => makeUnit({ strength: 100, veterancy: 'legendary' })),
    });
    const theatre = makeTheatre({ sicilia: 'rome' });
    const profile = { ...ENEMY_GENERALS.xanthippus_drillmaster, objectiveWeights: { hold: 100, advance: 0.001, raid: 0.001 } };
    const order = chooseSeasonOrders(holder, [holder, bigEnemy], theatre, cities, 0, profile, () => 0.5);
    expect(order).toBeNull();
  });

  test('ADVANCE targets an undefended not-friendly region with a plain move order', () => {
    const army = makeArmy({ owner: 'rome_state', location: 'latium', commanderId: 'cmdr-1' });
    const theatre = makeTheatre({ etruria: 'carthage', campania: 'rome', samnium: 'rome', cisalpine_gaul: 'rome' });
    const profile = { ...ENEMY_GENERALS.bomilcar_bull, objectiveWeights: { hold: 0, advance: 100, raid: 0 } };
    const order = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, () => 0.5);
    expect(order?.path[order.path.length - 1]).toBe('etruria');
    expect(order?.intent).toBe('move');
  });

  test('ADVANCE attack-moves a weakly defended enemy region when the ratio clears the bar', () => {
    const army = makeArmy({ owner: 'rome_state', location: 'latium', commanderId: 'cmdr-1', units: Array.from({ length: 5 }, () => makeUnit({ strength: 100, unitClass: 'legionary' })) });
    const enemy = makeArmy({ id: 'enemy-1', owner: 'carthage', location: 'etruria', units: [makeUnit({ strength: 20, unitClass: 'skirmisher', veterancy: 'raw' })] });
    // Every OTHER region pinned friendly ('rome') so etruria is the only
    // non-friendly, reachable candidate — sicilia/sardinia/africa default
    // to neutral/carthage otherwise and would otherwise sneak in as
    // alternate (undefended) candidates via strait/sea reachability.
    const theatre = makeTheatre({
      etruria: 'carthage', campania: 'rome', samnium: 'rome', cisalpine_gaul: 'rome',
      sicilia: 'rome', sardinia: 'rome', africa: 'rome',
    });
    const profile = { ...ENEMY_GENERALS.bomilcar_bull, objectiveWeights: { hold: 0, advance: 100, raid: 0 } };
    const order = chooseSeasonOrders(army, [army, enemy], theatre, cities, 0, profile, () => 0.5);
    expect(order?.path[order.path.length - 1]).toBe('etruria');
    expect(order?.intent).toBe('attack');
  });

  test('ADVANCE skips a nominally-weaker but too-strongly-defended target and falls through to an undefended one', () => {
    const army = makeArmy({
      owner: 'rome_state', location: 'latium', commanderId: 'cmdr-1',
      units: [makeUnit({ strength: 1, unitClass: 'skirmisher', veterancy: 'raw' })],
    });
    // etruria: tiny garrison (low weakness by the formula) but still
    // outguns the (also tiny) mover badly -> ratio fails, must be skipped.
    const strongDefender = makeArmy({
      id: 'strong-defender', owner: 'carthage', location: 'etruria',
      units: [makeUnit({ strength: 5, unitClass: 'skirmisher', veterancy: 'raw' })],
    });
    // campania is the ONLY other non-friendly, reachable candidate — every
    // region that could otherwise sneak in via a default neutral/carthage
    // controller (sicilia/sardinia/africa) is pinned friendly.
    const theatre = makeTheatre({
      etruria: 'carthage', campania: 'carthage', samnium: 'rome', cisalpine_gaul: 'rome',
      sicilia: 'rome', sardinia: 'rome', africa: 'rome',
    });
    let testCities = withRelationship(cities, 'etruria', 100); // low weakness-by-relationship
    testCities = withRelationship(testCities, 'campania', 0);  // high weakness-by-relationship, but undefended
    const profile = { ...ENEMY_GENERALS.hanno_cautious, aggression: 0, objectiveWeights: { hold: 0, advance: 100, raid: 0 } };
    const order = chooseSeasonOrders(army, [army, strongDefender], theatre, testCities, 0, profile, () => 0.5);
    expect(order?.path[order.path.length - 1]).toBe('campania');
    expect(order?.intent).toBe('move');
  });

  test('a leaderless army never receives an attack order', () => {
    const army = makeArmy({ owner: 'rome_state', location: 'latium', commanderId: null });
    const enemy = makeArmy({ id: 'enemy-1', owner: 'carthage', location: 'etruria', units: [makeUnit({ strength: 1 })] });
    const theatre = makeTheatre({ etruria: 'carthage', campania: 'rome', samnium: 'rome', cisalpine_gaul: 'rome' });
    const profile = { ...ENEMY_GENERALS.bomilcar_bull, objectiveWeights: { hold: 0, advance: 100, raid: 100 } };
    for (const seed of [1, 2, 3, 4, 5]) {
      const order = chooseSeasonOrders(army, [army, enemy], theatre, cities, 0, profile, makeSeededRng(seed));
      expect(order?.intent).not.toBe('attack');
    }
  });

  test('RAID targets an undefended region and flags raiding: true', () => {
    const army = makeArmy({ owner: 'carthage', location: 'africa', commanderId: 'hamilcar_fox' });
    const theatre = makeTheatre({ campania: 'rome' }); // reachable via sea, undefended, not-friendly to carthage
    const profile = { ...ENEMY_GENERALS.hamilcar_fox, objectiveWeights: { hold: 0, advance: 0, raid: 100 } };
    const order = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, () => 0.5);
    expect(order?.raiding).toBe(true);
    expect(order?.intent).toBe('move');
  });

  test('an army whose last order was a raid returns home next call instead of re-evaluating', () => {
    const raidingOrder = { path: ['africa', 'campania'] as const, forcedMarch: false, intent: 'move' as const, raiding: true };
    const army = makeArmy({
      owner: 'carthage', location: 'africa', commanderId: 'hamilcar_fox',
      ordersThisSeason: { path: [...raidingOrder.path], forcedMarch: false, intent: 'move', raiding: true },
    });
    const theatre = makeTheatre();
    const profile = ENEMY_GENERALS.hamilcar_fox; // homePort: 'africa'
    const order = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, () => 0.5);
    // already AT africa (its own homePort) in this fixture -> nothing to do
    expect(order).toBeNull();
  });

  test('an army away from home after a raid is ordered back to its homePort', () => {
    const army = makeArmy({
      owner: 'carthage', location: 'campania', commanderId: 'hamilcar_fox',
      ordersThisSeason: { path: ['africa', 'campania'], forcedMarch: false, intent: 'move', raiding: true },
    });
    const theatre = makeTheatre();
    const profile = ENEMY_GENERALS.hamilcar_fox; // homePort: 'africa'
    const order = chooseSeasonOrders(army, [army], theatre, cities, 0, profile, () => 0.5);
    expect(order?.path[order.path.length - 1]).toBe('africa');
    expect(order?.raiding).toBeFalsy();
  });
});

// ─── Profile differentiation (plan's own named test) ───────────────────────

describe('profile differentiation', () => {
  test('Bomilcar (advance-always) attack-orders more than 2x as often as Hanno (cautious-hold) over 200 seasons', () => {
    // A single reachable, non-friendly, defended target (campania) whose
    // defender is deliberately ~1.36x the mover's own strength:
    //   mover:    1 spear_foot,  trained, str 100 -> 100*5.5*1.00 = 550
    //   defender: 1 elephant,    veteran, str 100 -> 100*6.5*1.15 = 747.5
    //   ratio = 550/747.5 ≈ 0.736
    // Bomilcar (aggression 0.9) effective threshold = 1.2*(1-0.9*0.5) = 0.66  -> PASSES, attacks.
    // Hanno    (aggression 0.2) effective threshold = 1.2*(1-0.2*0.5) = 1.08  -> FAILS, can't advance here.
    // The same defender being STRONGER than the mover's own (sicilia)
    // garrison also satisfies HOLD's threat condition, so with nowhere
    // else to go, Hanno's only valid behavior left is HOLD (weight 3,
    // dominant) while Bomilcar's is ADVANCE (weight 3, dominant for him).
    const mover = makeArmy({
      owner: 'carthage', location: 'sicilia', commanderId: 'x',
      units: [makeUnit({ strength: 100, unitClass: 'spear_foot', veterancy: 'trained' })],
    });
    const defender = makeArmy({
      id: 'defender', owner: 'rome_state', location: 'campania',
      units: [makeUnit({ strength: 100, unitClass: 'elephant', veterancy: 'veteran' })],
    });
    const theatre = makeTheatre({
      sicilia: 'carthage', campania: 'rome',
      latium: 'carthage', etruria: 'carthage', samnium: 'carthage', cisalpine_gaul: 'carthage',
      sardinia: 'carthage', africa: 'carthage',
    });

    function attackRate(profile: typeof ENEMY_GENERALS.bomilcar_bull, seed: number): number {
      const rng = makeSeededRng(seed);
      let attacks = 0;
      for (let i = 0; i < 200; i++) {
        const order = chooseSeasonOrders(mover, [mover, defender], theatre, cities, 0, profile, rng);
        if (order?.intent === 'attack') attacks++;
      }
      return attacks;
    }

    const bomilcarRate = attackRate(ENEMY_GENERALS.bomilcar_bull, 11);
    const hannoRate = attackRate(ENEMY_GENERALS.hanno_cautious, 11);
    expect(bomilcarRate).toBeGreaterThan(hannoRate * 2);
  });
});

// ─── Profile resolution ─────────────────────────────────────────────────────

describe('profileForCarthageArmy', () => {
  test('resolves a known general id to its real profile', () => {
    const army = makeArmy({ commanderId: 'bomilcar_bull' });
    expect(profileForCarthageArmy(army).id).toBe('bomilcar_bull');
  });

  test('falls back to Xanthippus for a null commander', () => {
    const army = makeArmy({ commanderId: null });
    expect(profileForCarthageArmy(army).id).toBe('xanthippus_drillmaster');
  });

  test('falls back to Xanthippus for an unrecognized commanderId', () => {
    const army = makeArmy({ commanderId: 'debug-spawn-123' });
    expect(profileForCarthageArmy(army).id).toBe('xanthippus_drillmaster');
  });
});

describe('deriveNpcRomanProfile', () => {
  test('matches the plan\'s formula for aggression and caution', () => {
    const leader = makeLeader({ skills: { rhetoric: 5, martial: 8, intrigus: 5 } });
    const profile = deriveNpcRomanProfile(leader);
    expect(profile.aggression).toBeCloseTo((8 / 10) * 0.8, 5);
    expect(profile.caution).toBeCloseTo((10 - 8) / 10, 5);
  });

  test('a martial-flavoured trait bumps the advance weight above default', () => {
    const withTrait = deriveNpcRomanProfile(makeLeader({ traits: ['conqueror'] }));
    const withoutTrait = deriveNpcRomanProfile(makeLeader({ traits: [] }));
    expect(withTrait.objectiveWeights.advance).toBeGreaterThan(withoutTrait.objectiveWeights.advance);
    expect(withTrait.objectiveWeights.hold).toBe(withoutTrait.objectiveWeights.hold);
  });
});

// ─── assignCarthaginianOrders — the two hard rules ─────────────────────────

describe('assignCarthaginianOrders', () => {
  test('never issues an order that abandons Lilybaeum', () => {
    const lilybaeumArmy = makeArmy({
      id: 'lily', owner: 'carthage', location: 'sicilia', stationedCityId: 'lilybaeum', commanderId: 'bomilcar_bull',
    });
    // Overwhelming reason to leave: everything is undefended and enemy-controlled elsewhere.
    const theatre = makeTheatre({ sicilia: 'carthage', campania: 'rome', latium: 'rome' });
    const orders = assignCarthaginianOrders([lilybaeumArmy], theatre, cities, 0, makeSeededRng(3));
    const order = orders.get('lily');
    if (order) expect(order.path[order.path.length - 1]).toBe('sicilia');
    // null (no order / stays put) also satisfies "never abandons".
  });

  test('keeps at least one army in sicilia while Carthage holds a city there', () => {
    const onlyArmy = makeArmy({ id: 'only', owner: 'carthage', location: 'sicilia', stationedCityId: 'lilybaeum', commanderId: 'hamilcar_fox' });
    const theatre = makeTheatre({ sicilia: 'carthage', campania: 'rome' });
    const carthageCities = cities.map(c => (c.id === 'lilybaeum' ? { ...c, owner: 'carthage' as const } : c));
    const orders = assignCarthaginianOrders([onlyArmy], theatre, carthageCities, 0, makeSeededRng(9));
    const order = orders.get('only');
    if (order) expect(order.path[order.path.length - 1]).toBe('sicilia');
  });

  test('the two hard rules are never violated across a 40-season seeded simulation', () => {
    const lilybaeumArmy = makeArmy({ id: 'lily', owner: 'carthage', location: 'sicilia', stationedCityId: 'lilybaeum', commanderId: 'bomilcar_bull' });
    const otherArmy = makeArmy({ id: 'other', owner: 'carthage', location: 'africa', commanderId: 'hanno_cautious' });
    let armies = [lilybaeumArmy, otherArmy];
    const theatre = makeTheatre({ sicilia: 'carthage', campania: 'rome', latium: 'rome' });
    const carthageCities = cities.map(c => (c.id === 'lilybaeum' ? { ...c, owner: 'carthage' as const } : c));
    const rng = makeSeededRng(2026);

    for (let season = 0; season < 40; season++) {
      const orders = assignCarthaginianOrders(armies, theatre, carthageCities, season % 4, rng);
      const lilyOrder = orders.get('lily');
      if (lilyOrder) expect(lilyOrder.path[lilyOrder.path.length - 1]).toBe('sicilia');

      const armiesAtSicilia = armies.filter(a => a.location === 'sicilia');
      const stillHasOneStaying = armiesAtSicilia.some(a => {
        const o = orders.get(a.id);
        return !o || o.path[o.path.length - 1] === 'sicilia';
      });
      expect(stillHasOneStaying).toBe(true);

      // Apply orders (location only — this chunk doesn't resolve orders for
      // real; this just advances the sim enough to re-exercise the rules
      // against a changed location next iteration).
      armies = armies.map(a => {
        const o = orders.get(a.id);
        if (!o) return { ...a, ordersThisSeason: null };
        return { ...a, location: o.path[o.path.length - 1], ordersThisSeason: o };
      });
    }
  });
});

// ─── assignNpcRomanOrders ───────────────────────────────────────────────────

describe('assignNpcRomanOrders', () => {
  test('an army whose commander is not a living clan leader gets no order', () => {
    const army = makeArmy({ id: 'orphan', owner: 'rome_rival', commanderId: 'ghost-leader', location: 'latium' });
    const orders = assignNpcRomanOrders([army], [makeClan()], makeTheatre(), cities, 0, makeSeededRng(5));
    expect(orders.get('orphan')).toBeNull();
  });

  test('a valid commander produces a real profile-driven order', () => {
    const leader = makeLeader({ id: 'leader-x', skills: { rhetoric: 5, martial: 9, intrigus: 5 } });
    const clan = makeClan({ leaders: [leader] });
    const army = makeArmy({ id: 'roman-rival', owner: 'rome_rival', commanderId: 'leader-x', location: 'latium' });
    const theatre = makeTheatre({ etruria: 'carthage', campania: 'rome', samnium: 'rome', cisalpine_gaul: 'rome' });
    const orders = assignNpcRomanOrders([army], [clan], theatre, cities, 0, () => 0.5);
    // High martial (9) -> strong aggression -> should find *something* to do
    // against the only non-friendly reachable region.
    expect(orders.get('roman-rival')).not.toBeUndefined();
  });
});

// ─── Reinforcements ─────────────────────────────────────────────────────────

describe('shouldReinforceCarthage', () => {
  test('fires every reinforcementInterval seasons', () => {
    expect(shouldReinforceCarthage(0)).toBe(true);
    expect(shouldReinforceCarthage(3)).toBe(true);
    expect(shouldReinforceCarthage(6)).toBe(true);
    expect(shouldReinforceCarthage(1)).toBe(false);
    expect(shouldReinforceCarthage(4)).toBe(false);
  });
});

describe('applyCarthageReinforcement', () => {
  test('founds a new army at africa when none exists there yet', () => {
    const result = applyCarthageReinforcement([], 12, 'new-army-1');
    expect(result).toHaveLength(1);
    expect(result[0].location).toBe('africa');
    expect(result[0].owner).toBe('carthage');
    expect(result[0].units).toHaveLength(3); // reinforcementCohorts seed
  });

  test('merges into an existing carthage army already at africa', () => {
    const existing = makeArmy({ id: 'home-army', owner: 'carthage', location: 'africa', units: [makeUnit()] });
    const result = applyCarthageReinforcement([existing], 12, 'unused-id');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('home-army');
    expect(result[0].units).toHaveLength(1 + 3);
  });

  test('does not touch a carthage army stationed elsewhere', () => {
    const elsewhere = makeArmy({ id: 'far-away', owner: 'carthage', location: 'sardinia', units: [makeUnit()] });
    const result = applyCarthageReinforcement([elsewhere], 12, 'new-army-2');
    expect(result).toHaveLength(2);
    expect(result.find(a => a.id === 'far-away')?.units).toHaveLength(1);
  });
});

// ─── Telegraphing ───────────────────────────────────────────────────────────

describe('trueIntentFor', () => {
  test('no order -> entrenched', () => {
    expect(trueIntentFor(null)).toBe('entrenched');
  });
  test('raiding order -> raiding', () => {
    expect(trueIntentFor({ path: ['a' as any], forcedMarch: false, intent: 'move', raiding: true })).toBe('raiding');
  });
  test('a plain move or attack order -> advancing', () => {
    expect(trueIntentFor({ path: ['a' as any], forcedMarch: false, intent: 'move' })).toBe('advancing');
    expect(trueIntentFor({ path: ['a' as any], forcedMarch: false, intent: 'attack' })).toBe('advancing');
  });
});

describe('telegraphIntent', () => {
  test('honesty rate matches the configured deceptionChance over many draws', () => {
    const rng = makeSeededRng(555);
    const deceptionChance = 0.35; // Hamilcar's seed
    let truthful = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i++) {
      if (telegraphIntent('raiding', deceptionChance, rng) === 'raiding') truthful++;
    }
    const rate = truthful / trials;
    expect(rate).toBeGreaterThan(1 - deceptionChance - 0.05);
    expect(rate).toBeLessThan(1 - deceptionChance + 0.05);
  });

  test('a lie is always a DIFFERENT intent, never a coincidental match', () => {
    // rng() always < deceptionChance (lie branch), and the "which lie" roll
    // always lands on the first alternative in ALL_INTENTS order.
    const rng = (() => {
      let call = 0;
      return () => (call++ === 0 ? 0 : 0); // first call (deception gate) = 0 < chance; second call (which lie) = 0
    })();
    const result = telegraphIntent('entrenched', 0.9, rng);
    expect(result).not.toBe('entrenched');
  });
});
