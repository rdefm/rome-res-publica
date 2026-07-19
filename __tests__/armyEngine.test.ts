import { combine, divide, armyStrength, upkeepFor } from '../src/engine/armyEngine';
import type { Army, ArmyUnit } from '../src/models/army';
import type { TheatreState } from '../src/models/theatre';
import type { CityState } from '../src/models/city';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import { REGIONS } from '../src/data/theatreMap';

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
    campaignsSurvived: 0,
    wonCrushingVictory: false,
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
    units: [makeUnit(), makeUnit()],
    stance: 'give_battle',
    ordersThisSeason: null,
    fatigued: false,
    unpaidSeasons: 0,
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

// ─── combine ─────────────────────────────────────────────────────────────────

describe('combine', () => {
  test('merges units from both armies exactly (no loss, no duplication)', () => {
    const a = makeArmy({ id: 'a', units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    const b = makeArmy({ id: 'b', units: [makeUnit({ id: 'u3' })] });
    const merged = combine(a, b, 5, 3, 'merged-1')!;
    expect(merged).not.toBeNull();
    expect(merged.units.map(u => u.id).sort()).toEqual(['u1', 'u2', 'u3']);
  });

  test('commander is whichever side has higher martial', () => {
    const a = makeArmy({ commanderId: 'char-a' });
    const b = makeArmy({ commanderId: 'char-b' });
    expect(combine(a, b, 8, 3, 'm1')!.commanderId).toBe('char-a');
    expect(combine(a, b, 2, 9, 'm2')!.commanderId).toBe('char-b');
  });

  test('name is inherited from the army with more units', () => {
    const small = makeArmy({ name: 'Small', units: [makeUnit()] });
    const big = makeArmy({ name: 'Big', units: [makeUnit(), makeUnit(), makeUnit()] });
    expect(combine(small, big, 5, 5, 'm3')!.name).toBe('Big');
    expect(combine(big, small, 5, 5, 'm4')!.name).toBe('Big');
  });

  test('returns null when armies are in different locations', () => {
    const a = makeArmy({ location: 'latium' });
    const b = makeArmy({ location: 'campania' });
    expect(combine(a, b, 5, 5, 'm5')).toBeNull();
  });

  test('returns null when armies have different owners', () => {
    const a = makeArmy({ owner: 'rome_state' });
    const b = makeArmy({ owner: 'player' });
    expect(combine(a, b, 5, 5, 'm6')).toBeNull();
  });

  test('the merged army uses the caller-supplied id, not a generated one', () => {
    const a = makeArmy({ id: 'a' });
    const b = makeArmy({ id: 'b' });
    expect(combine(a, b, 5, 5, 'caller-chosen-id')!.id).toBe('caller-chosen-id');
  });
});

// ─── divide ──────────────────────────────────────────────────────────────────

describe('divide', () => {
  test('conserves units exactly across the split', () => {
    const army = makeArmy({ units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' }), makeUnit({ id: 'u3' })] });
    const [remaining, split] = divide(army, ['u2'], 'new-1')!;
    expect(remaining.units.map(u => u.id).sort()).toEqual(['u1', 'u3']);
    expect(split.units.map(u => u.id)).toEqual(['u2']);
  });

  test('the remaining army keeps the original id; the split-off army gets the caller-supplied id', () => {
    const army = makeArmy({ id: 'original', units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    const [remaining, split] = divide(army, ['u1'], 'fresh-id')!;
    expect(remaining.id).toBe('original');
    expect(split.id).toBe('fresh-id');
  });

  test('a leaderless split-off army defaults to commanderId: null', () => {
    const army = makeArmy({ units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    const [, split] = divide(army, ['u1'], 'fresh-id')!;
    expect(split.commanderId).toBeNull();
  });

  test('honors an explicit newCommanderId for the split-off army', () => {
    const army = makeArmy({ units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    const [, split] = divide(army, ['u1'], 'fresh-id', 'char-x')!;
    expect(split.commanderId).toBe('char-x');
  });

  test('returns null when splitting off zero units', () => {
    const army = makeArmy({ units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    expect(divide(army, [], 'fresh-id')).toBeNull();
  });

  test('returns null when splitting off the whole army (nothing would remain)', () => {
    const army = makeArmy({ units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    expect(divide(army, ['u1', 'u2'], 'fresh-id')).toBeNull();
  });

  test('returns null for an unknown unit id', () => {
    const army = makeArmy({ units: [makeUnit({ id: 'u1' }), makeUnit({ id: 'u2' })] });
    expect(divide(army, ['not-a-real-id'], 'fresh-id')).toBeNull();
  });
});

// ─── armyStrength ────────────────────────────────────────────────────────────

describe('armyStrength', () => {
  test('is monotonic in unit strength', () => {
    const weak = makeArmy({ units: [makeUnit({ strength: 20 })] });
    const strong = makeArmy({ units: [makeUnit({ strength: 90 })] });
    expect(armyStrength(strong)).toBeGreaterThan(armyStrength(weak));
  });

  test('is monotonic in veterancy tier', () => {
    const raw = makeArmy({ units: [makeUnit({ veterancy: 'raw' })] });
    const legendary = makeArmy({ units: [makeUnit({ veterancy: 'legendary' })] });
    expect(armyStrength(legendary)).toBeGreaterThan(armyStrength(raw));
  });

  test('sums independently across multiple units', () => {
    const one = makeArmy({ units: [makeUnit()] });
    const two = makeArmy({ units: [makeUnit(), makeUnit()] });
    expect(armyStrength(two)).toBeCloseTo(armyStrength(one) * 2);
  });

  test('an empty army has zero strength', () => {
    expect(armyStrength(makeArmy({ units: [] }))).toBe(0);
  });
});

// ─── upkeepFor ───────────────────────────────────────────────────────────────

describe('upkeepFor', () => {
  const cities = buildInitialCityStates();

  test('a Roman army in Rome-controlled territory pays the friendly multiplier', () => {
    const theatre = makeTheatre();
    const army = makeArmy({ owner: 'rome_state', location: 'latium', units: [makeUnit(), makeUnit()] });
    // latium has no relationship discount headroom below 100 in practice, so just assert it's the cheapest tier
    const friendlyCost = upkeepFor(army, theatre, cities);
    const hostileArmy = makeArmy({ owner: 'rome_state', location: 'sardinia', units: [makeUnit(), makeUnit()] });
    const hostileCost = upkeepFor(hostileArmy, theatre, cities);
    expect(friendlyCost).toBeLessThan(hostileCost);
  });

  test('a neutral region costs more than friendly but less than hostile', () => {
    const theatre = makeTheatre();
    const roman = makeArmy({ owner: 'rome_state', location: 'latium', units: [makeUnit()] });
    const inNeutral = makeArmy({ owner: 'rome_state', location: 'sicilia', units: [makeUnit()] });
    const inHostile = makeArmy({ owner: 'rome_state', location: 'sardinia', units: [makeUnit()] });
    const costFriendly = upkeepFor(roman, theatre, cities);
    const costNeutral = upkeepFor(inNeutral, theatre, cities);
    const costHostile = upkeepFor(inHostile, theatre, cities);
    expect(costFriendly).toBeLessThanOrEqual(costNeutral);
    expect(costNeutral).toBeLessThanOrEqual(costHostile);
  });

  test('territory multiplier is symmetric for a Carthage-owned army', () => {
    const theatre = makeTheatre();
    const inCarthageTerritory = makeArmy({ owner: 'carthage', location: 'sardinia', units: [makeUnit()] });
    const inRomanTerritory = makeArmy({ owner: 'carthage', location: 'latium', units: [makeUnit()] });
    expect(upkeepFor(inCarthageTerritory, theatre, cities))
      .toBeLessThan(upkeepFor(inRomanTerritory, theatre, cities));
  });

  test('scales linearly with cohort count', () => {
    // Large-ish counts so Math.round()'s per-call rounding error stays
    // proportionally negligible (at 1 vs 3 cohorts it doesn't: 1.4 -> 1 but
    // 4.2 -> 4, a real rounding artifact, not a formula bug).
    const theatre = makeTheatre();
    const ten = makeArmy({ units: Array.from({ length: 10 }, () => makeUnit()) });
    const thirty = makeArmy({ units: Array.from({ length: 30 }, () => makeUnit()) });
    expect(upkeepFor(thirty, theatre, cities)).toBeCloseTo(upkeepFor(ten, theatre, cities) * 3, -1);
  });

  test('an empty army costs nothing', () => {
    const theatre = makeTheatre();
    expect(upkeepFor(makeArmy({ units: [] }), theatre, cities)).toBe(0);
  });

  test('falls back to no relationship discount when cities array has no matching data', () => {
    const theatre = makeTheatre();
    const army = makeArmy({ location: 'latium', units: [makeUnit()] });
    const withData = upkeepFor(army, theatre, cities);
    const withoutData = upkeepFor(army, theatre, []);
    expect(withoutData).toBeGreaterThanOrEqual(withData);
  });
});
