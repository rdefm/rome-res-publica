import {
  calcMovementPoints,
  reachable,
  isValidPath,
  buildMovementOrder,
  applyForcedMarchAttrition,
  rollSeaLaneStorm,
  applyStormAttrition,
} from '../src/engine/movementEngine';
import type { Army, ArmyUnit } from '../src/models/army';
import type { TheatreState } from '../src/models/theatre';
import { REGIONS } from '../src/data/theatreMap';
import { BALANCE } from '../src/data/balance';

function makeUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: `unit-${Math.random().toString(36).slice(2)}`,
    unitClass: 'legionary', strength: 80, veterancy: 'trained', loyalty: 50,
    elephantSteady: false, homeRegion: 'latium', raisedBy: 'state', raisedSeason: 1,
    campaignsSurvived: 0, wonCrushingVictory: false,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1', name: 'Legio I', owner: 'player', commanderId: 'cmdr-1',
    location: 'latium', stationedCityId: 'latium', units: [makeUnit(), makeUnit()],
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

const m = BALANCE.campaign.movement;

// ─── calcMovementPoints ─────────────────────────────────────────────────────

describe('calcMovementPoints', () => {
  test('base MP, no modifiers', () => {
    expect(calcMovementPoints(2, 0, false)).toBe(m.baseMP);
  });

  test('winter subtracts', () => {
    expect(calcMovementPoints(2, 3, false)).toBe(m.baseMP - m.winterMPPenalty);
  });

  test('a big stack subtracts', () => {
    expect(calcMovementPoints(m.bigStackCohorts + 1, 0, false)).toBe(m.baseMP - m.bigStackMPPenalty);
  });

  test('exactly bigStackCohorts does NOT trigger the penalty (strictly-above threshold)', () => {
    expect(calcMovementPoints(m.bigStackCohorts, 0, false)).toBe(m.baseMP);
  });

  test('forced march adds', () => {
    expect(calcMovementPoints(2, 0, true)).toBe(m.baseMP + m.forcedMarchMPBonus);
  });

  test('winter + big stack + forced march all combine, floored at 1', () => {
    const raw = m.baseMP - m.winterMPPenalty - m.bigStackMPPenalty + m.forcedMarchMPBonus;
    expect(calcMovementPoints(m.bigStackCohorts + 1, 3, true)).toBe(Math.max(1, raw));
  });

  test('never drops below 1 even with every subtractive modifier stacked', () => {
    // Not realistic at these seeds, but the floor must hold regardless.
    expect(calcMovementPoints(999, 3, false)).toBeGreaterThanOrEqual(1);
  });
});

// ─── reachable ──────────────────────────────────────────────────────────────

describe('reachable', () => {
  test('at base MP from latium, land reaches all 1-hop friendly neighbors at cost 1', () => {
    const army = makeArmy({ location: 'latium' });
    const dests = reachable(army, [army], makeTheatre(), 0, false);
    for (const id of ['etruria', 'campania', 'samnium'] as const) {
      const d = dests.find(x => x.regionId === id);
      expect(d).toBeTruthy();
      expect(d!.costSpent).toBe(1);
      expect(d!.viaSeaLane).toBe(false);
    }
  });

  test('a 2-hop friendly chain (latium->etruria->cisalpine_gaul) is reachable at cost 2, within base budget', () => {
    const army = makeArmy({ location: 'latium' });
    const dests = reachable(army, [army], makeTheatre(), 0, false);
    const d = dests.find(x => x.regionId === 'cisalpine_gaul');
    expect(d?.costSpent).toBe(2);
    expect(d?.path).toEqual(['latium', 'etruria', 'cisalpine_gaul']);
  });

  test('a strait crossing costs the flat strait rate regardless of the target\'s controller', () => {
    const army = makeArmy({ location: 'latium' }); // sicilia starts 'neutral'
    const dests = reachable(army, [army], makeTheatre(), 0, false);
    const d = dests.find(x => x.regionId === 'sicilia');
    expect(d?.costSpent).toBe(1 /* campania */ + m.straitCost);
  });

  test('entering enemy/neutral-controlled territory costs the contested rate, not the friendly rate', () => {
    const carthageArmy = makeArmy({ owner: 'carthage', location: 'latium' }); // every 1-hop neighbor is Rome-controlled
    const dests = reachable(carthageArmy, [carthageArmy], makeTheatre(), 0, false);
    const d = dests.find(x => x.regionId === 'etruria');
    expect(d?.costSpent).toBe(m.landContestedCost);
    // and nothing 2 hops out is reachable — contested cost 2 consumes the whole budget
    expect(dests.find(x => x.regionId === 'cisalpine_gaul')).toBeUndefined();
  });

  test('winter (MP=1) excludes anything costing more than 1, land or sea', () => {
    const army = makeArmy({ location: 'latium' });
    const dests = reachable(army, [army], makeTheatre(), 3, false); // seasonIndex 3 = Winter
    expect(dests.find(x => x.regionId === 'cisalpine_gaul')).toBeUndefined();
    expect(dests.find(x => x.regionId === 'sicilia')).toBeUndefined();
    expect(dests.find(x => x.viaSeaLane)).toBeUndefined();
    expect(dests.find(x => x.regionId === 'etruria')?.costSpent).toBe(1);
  });

  test('a direct sea lane is reachable using the whole MP budget, from a coastal region', () => {
    const army = makeArmy({ location: 'latium' });
    const dests = reachable(army, [army], makeTheatre(), 0, false);
    const d = dests.find(x => x.regionId === 'sardinia');
    expect(d).toBeTruthy();
    expect(d!.viaSeaLane).toBe(true);
    expect(d!.costSpent).toBe(m.baseMP);
  });

  test('a land-then-sea combo route only opens up when forced march provides enough leftover MP', () => {
    const army = makeArmy({ location: 'latium' });
    const theatre = makeTheatre();
    const withoutForcedMarch = reachable(army, [army], theatre, 0, false);
    const withForcedMarch = reachable(army, [army], theatre, 0, true);
    expect(withoutForcedMarch.find(x => x.regionId === 'africa')).toBeUndefined();
    const combo = withForcedMarch.find(x => x.regionId === 'africa');
    expect(combo).toBeTruthy();
    expect(combo!.viaSeaLane).toBe(true);
    expect(combo!.path).toEqual(['latium', 'campania', 'africa']);
  });

  test('a hostile-power army in a reachable region marks it "attack"', () => {
    const army = makeArmy({ owner: 'player', location: 'latium', commanderId: 'cmdr-1' });
    const enemy = makeArmy({ id: 'enemy-1', owner: 'carthage', location: 'etruria' });
    const dests = reachable(army, [army, enemy], makeTheatre(), 0, false);
    const d = dests.find(x => x.regionId === 'etruria');
    expect(d?.intent).toBe('attack');
    expect(d?.blockedReason).toBeNull();
  });

  test('a leaderless army sees the attack destination but it is blocked', () => {
    const army = makeArmy({ owner: 'player', location: 'latium', commanderId: null });
    const enemy = makeArmy({ id: 'enemy-1', owner: 'carthage', location: 'etruria' });
    const dests = reachable(army, [army, enemy], makeTheatre(), 0, false);
    const d = dests.find(x => x.regionId === 'etruria');
    expect(d?.intent).toBe('attack');
    expect(d?.blockedReason).toBe('leaderless');
  });

  test('a same-power army in a reachable region does NOT mark it "attack"', () => {
    const army = makeArmy({ owner: 'player', location: 'latium' });
    const friendly = makeArmy({ id: 'friend-1', owner: 'rome_state', location: 'etruria' });
    const dests = reachable(army, [army, friendly], makeTheatre(), 0, false);
    expect(dests.find(x => x.regionId === 'etruria')?.intent).toBe('move');
  });

  test('the army\'s own starting region is never listed as a destination', () => {
    const army = makeArmy({ location: 'latium' });
    const dests = reachable(army, [army], makeTheatre(), 0, false);
    expect(dests.find(x => x.regionId === 'latium')).toBeUndefined();
  });
});

// ─── isValidPath ────────────────────────────────────────────────────────────

describe('isValidPath', () => {
  test('a single valid land hop is valid', () => {
    expect(isValidPath(['latium', 'etruria']).valid).toBe(true);
  });

  test('a path ending in a sea lane is valid', () => {
    expect(isValidPath(['latium', 'sardinia']).valid).toBe(true);
  });

  test('a path with a sea lane in the middle is invalid', () => {
    const result = isValidPath(['etruria', 'sardinia', 'africa']);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('sea_lane_not_final');
  });

  test('a non-adjacent jump is invalid', () => {
    const result = isValidPath(['latium', 'africa']);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not_adjacent');
  });

  test('a single-element path is too short', () => {
    expect(isValidPath(['latium']).reason).toBe('too_short');
  });
});

// ─── buildMovementOrder ─────────────────────────────────────────────────────

describe('buildMovementOrder', () => {
  test('builds a move order for a reachable, unoccupied destination', () => {
    const army = makeArmy({ location: 'latium' });
    const order = buildMovementOrder(army, [army], makeTheatre(), 0, 'etruria', false);
    expect(order).toEqual({ path: ['latium', 'etruria'], forcedMarch: false, intent: 'move' });
  });

  test('builds an attack order when the destination is hostile-occupied', () => {
    const army = makeArmy({ owner: 'player', location: 'latium', commanderId: 'cmdr-1' });
    const enemy = makeArmy({ id: 'enemy-1', owner: 'carthage', location: 'etruria' });
    const order = buildMovementOrder(army, [army, enemy], makeTheatre(), 0, 'etruria', false);
    expect(order?.intent).toBe('attack');
  });

  test('returns null for an out-of-budget destination', () => {
    const army = makeArmy({ location: 'latium' });
    expect(buildMovementOrder(army, [army], makeTheatre(), 3, 'cisalpine_gaul', false)).toBeNull();
  });

  test('returns null for a leaderless army ordered to attack', () => {
    const army = makeArmy({ owner: 'player', location: 'latium', commanderId: null });
    const enemy = makeArmy({ id: 'enemy-1', owner: 'carthage', location: 'etruria' });
    expect(buildMovementOrder(army, [army, enemy], makeTheatre(), 0, 'etruria', false)).toBeNull();
  });
});

// ─── Resolution-time consequences ──────────────────────────────────────────

describe('applyForcedMarchAttrition', () => {
  test('reduces every unit\'s strength by forcedMarchAttritionPct and sets fatigued', () => {
    const army = makeArmy({ units: [makeUnit({ strength: 100 })], fatigued: false });
    const result = applyForcedMarchAttrition(army);
    expect(result.fatigued).toBe(true);
    expect(result.units[0].strength).toBeCloseTo(100 * (1 - m.forcedMarchAttritionPct), 5);
  });

  test('strength never drops below 0', () => {
    const army = makeArmy({ units: [makeUnit({ strength: 0 })] });
    expect(applyForcedMarchAttrition(army).units[0].strength).toBe(0);
  });
});

describe('rollSeaLaneStorm', () => {
  test('never storms when rng returns above the risk threshold', () => {
    expect(rollSeaLaneStorm(0.2, 0, () => 0.99)).toBe(false);
  });

  test('always storms when rng returns below the risk threshold', () => {
    expect(rollSeaLaneStorm(0.2, 0, () => 0.01)).toBe(true);
  });

  test('winter multiplies the effective risk', () => {
    // rng lands between the base risk and the winter-multiplied risk —
    // only storms when the multiplier is applied.
    const rng = () => 0.25;
    expect(rollSeaLaneStorm(0.2, 0, rng)).toBe(false);  // 0.25 >= 0.2 base
    expect(rollSeaLaneStorm(0.2, 3, rng)).toBe(true);   // 0.25 < 0.2 * winterSeaMultiplier
  });
});

describe('applyStormAttrition', () => {
  test('reduces every unit\'s strength by stormAttritionPct', () => {
    const army = makeArmy({ units: [makeUnit({ strength: 100 })] });
    expect(applyStormAttrition(army).units[0].strength).toBeCloseTo(100 * (1 - m.stormAttritionPct), 5);
  });
});
