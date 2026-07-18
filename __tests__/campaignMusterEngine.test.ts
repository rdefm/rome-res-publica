// Campaign Map plan, Chunk C3 — tests for src/engine/musterEngine.ts (raising
// Armies by region). Named campaignMusterEngine, not musterEngine, to avoid
// colliding with the pre-existing __tests__/musterEngine.test.ts, which
// tests the unrelated src/engine/battle/musterEngine.ts (Legate's Line M4's
// strategic<->battle bridge) — see this chunk's engine file's own header
// comment on why the two stay separate.

import {
  checkMusterEligibility,
  quoteMuster,
  rollMusteredUnit,
  nextLegionName,
  settleUpkeep,
} from '../src/engine/musterEngine';
import type { Army, ArmyUnit } from '../src/models/army';
import type { TheatreState } from '../src/models/theatre';
import type { CityState } from '../src/models/city';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import { REGIONS } from '../src/data/theatreMap';
import { BALANCE } from '../src/data/balance';

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
  return cities.map(c => c.id === cityId ? { ...c, relationshipScore } : c);
}

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
    owner: 'player',
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

const cities = buildInitialCityStates();

// ─── checkMusterEligibility ────────────────────────────────────────────────

describe('checkMusterEligibility', () => {
  test('allowed in Rome-controlled, well-disposed territory with pool remaining', () => {
    const theatre = makeTheatre();
    expect(checkMusterEligibility('latium', theatre, cities).allowed).toBe(true);
  });

  test('blocked when the controller is not Rome', () => {
    const theatre = makeTheatre({ latium: 'carthage' });
    const result = checkMusterEligibility('latium', theatre, cities);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  test('blocked when relationship is below the threshold', () => {
    const theatre = makeTheatre();
    const lowRel = withRelationship(cities, 'latium', 10);
    expect(checkMusterEligibility('latium', theatre, lowRel).allowed).toBe(false);
  });

  test('blocked once the yearly pool is exhausted', () => {
    const region = REGIONS.find(r => r.id === 'latium')!;
    const theatre = makeTheatre();
    theatre.musteredThisYear.latium = region.baseManpower;
    const result = checkMusterEligibility('latium', theatre, cities);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/spent/i);
  });

  test('remaining pool > 0 still allows mustering', () => {
    const region = REGIONS.find(r => r.id === 'latium')!;
    const theatre = makeTheatre();
    theatre.musteredThisYear.latium = region.baseManpower - 1;
    expect(checkMusterEligibility('latium', theatre, cities).allowed).toBe(true);
  });
});

// ─── quoteMuster ────────────────────────────────────────────────────────────

describe('quoteMuster', () => {
  test('higher relationship costs less (up to the tier base price)', () => {
    const theatre = makeTheatre();
    const highRel = withRelationship(cities, 'latium', 100);
    const lowRel = withRelationship(cities, 'latium', 30);
    const cheap = quoteMuster('latium', 'standard', theatre, highRel, [], 100, true);
    const pricier = quoteMuster('latium', 'standard', theatre, lowRel, [], 100, true);
    expect(cheap.costDenarii).toBeLessThan(pricier.costDenarii);
  });

  test('cost never exceeds the tier base price (relationship 0 = no discount)', () => {
    const theatre = makeTheatre();
    const zeroRel = withRelationship(cities, 'latium', 0);
    const quote = quoteMuster('latium', 'picked', theatre, zeroRel, [], 100, true);
    expect(quote.costDenarii).toBe(BALANCE.campaign.muster.tiers.picked.costPerCohort);
  });

  test('imperium requirement scales with the player\'s own fielded cohorts', () => {
    const theatre = makeTheatre();
    const noArmies = quoteMuster('latium', 'emergency', theatre, cities, [], 100, false);
    const playerArmy = makeArmy({ owner: 'player', units: [makeUnit(), makeUnit(), makeUnit()] });
    const withFieldedCohorts = quoteMuster('latium', 'emergency', theatre, cities, [playerArmy], 100, false);
    expect(withFieldedCohorts.imperiumRequired).toBeGreaterThan(noArmies.imperiumRequired);
  });

  test('non-player-owned cohorts do not count toward the imperium threshold', () => {
    const theatre = makeTheatre();
    const stateArmy = makeArmy({ owner: 'rome_state', units: [makeUnit(), makeUnit(), makeUnit()] });
    const withState = quoteMuster('latium', 'emergency', theatre, cities, [stateArmy], 100, false);
    const withNone = quoteMuster('latium', 'emergency', theatre, cities, [], 100, false);
    expect(withState.imperiumRequired).toBe(withNone.imperiumRequired);
  });

  test('holding office sanctions the muster and bypasses the imperium gate', () => {
    const theatre = makeTheatre();
    const manyArmies = [makeArmy({ owner: 'player', units: Array.from({ length: 50 }, () => makeUnit()) })];
    const sanctioned = quoteMuster('latium', 'emergency', theatre, cities, manyArmies, 0, true);
    expect(sanctioned.sanctioned).toBe(true);
    expect(sanctioned.imperiumOk).toBe(true);
  });

  test('without office, low imperium against a high threshold fails the gate', () => {
    const theatre = makeTheatre();
    const manyArmies = [makeArmy({ owner: 'player', units: Array.from({ length: 50 }, () => makeUnit()) })];
    const unsanctioned = quoteMuster('latium', 'emergency', theatre, cities, manyArmies, 0, false);
    expect(unsanctioned.sanctioned).toBe(false);
    expect(unsanctioned.imperiumOk).toBe(false);
  });

  test('eligible mirrors checkMusterEligibility', () => {
    const theatre = makeTheatre({ latium: 'carthage' });
    expect(quoteMuster('latium', 'standard', theatre, cities, [], 100, true).eligible).toBe(false);
  });
});

// ─── rollMusteredUnit ───────────────────────────────────────────────────────

describe('rollMusteredUnit', () => {
  test('rng that never clears a chance threshold keeps the tier\'s base veterancy', () => {
    const neverBump = () => 0.999;
    const unit = rollMusteredUnit('standard', 'latium', 0, 5, 'u1', neverBump);
    expect(unit.veterancy).toBe('raw');
  });

  test('rng that always clears every chance threshold bumps veterancy up', () => {
    const alwaysBump = () => 0;
    // standard's own secondaryChance (raw -> trained) plus the relationship
    // bump (trained -> veteran, since relationship is passed >= 70) should
    // both fire, landing on 'veteran'.
    const unit = rollMusteredUnit('standard', 'latium', 100, 5, 'u2', alwaysBump);
    expect(unit.veterancy).toBe('veteran');
  });

  test('emergency tier never bumps on its own roll (secondaryChance 0)', () => {
    const alwaysBump = () => 0;
    const unit = rollMusteredUnit('emergency', 'latium', 0, 5, 'u3', alwaysBump);
    expect(unit.veterancy).toBe('raw'); // relationship 0 keeps the second roll closed too
  });

  test('sets loyalty, homeRegion, raisedBy, raisedSeason from the tier/context', () => {
    const unit = rollMusteredUnit('picked', 'campania', 0, 42, 'u4', () => 0.999);
    expect(unit.loyalty).toBe(BALANCE.campaign.muster.tiers.picked.loyaltySeed);
    expect(unit.homeRegion).toBe('campania');
    expect(unit.raisedBy).toBe('player');
    expect(unit.raisedSeason).toBe(42);
    expect(unit.id).toBe('u4');
  });

  test('veterancy never exceeds veteran from a fresh muster', () => {
    const alwaysBump = () => 0;
    const unit = rollMusteredUnit('picked', 'latium', 100, 5, 'u5', alwaysBump);
    expect(unit.veterancy).toBe('veteran');
  });
});

// ─── nextLegionName ─────────────────────────────────────────────────────────

describe('nextLegionName', () => {
  test('first legion for a fresh roster is numbered I', () => {
    expect(nextLegionName([], 'Latium')).toBe('Legio I Latium');
  });

  test('increments past existing player "Legio ..." armies', () => {
    const existing = [
      makeArmy({ id: 'a', owner: 'player', name: 'Legio I Latium' }),
      makeArmy({ id: 'b', owner: 'player', name: 'Legio II Etruria' }),
    ];
    expect(nextLegionName(existing, 'Campania')).toBe('Legio III Campania');
  });

  test('ignores non-player-owned armies and non-Legio-named armies', () => {
    const existing = [
      makeArmy({ id: 'a', owner: 'rome_state', name: 'Legio I Latium' }),
      makeArmy({ id: 'b', owner: 'player', name: 'A Debug Army' }),
    ];
    expect(nextLegionName(existing, 'Campania')).toBe('Legio I Campania');
  });
});

// ─── settleUpkeep ───────────────────────────────────────────────────────────

describe('settleUpkeep', () => {
  test('paid resets unpaidSeasons and leaves units untouched', () => {
    const army = makeArmy({ unpaidSeasons: 2, units: [makeUnit({ loyalty: 50, strength: 80 })] });
    const { army: settled, disbanded } = settleUpkeep(army, true);
    expect(disbanded).toBe(false);
    expect(settled!.unpaidSeasons).toBe(0);
    expect(settled!.units[0].loyalty).toBe(50);
    expect(settled!.units[0].strength).toBe(80);
  });

  test('unpaid increments unpaidSeasons and penalizes every unit', () => {
    const army = makeArmy({ unpaidSeasons: 0, units: [makeUnit({ loyalty: 50, strength: 80 })] });
    const { army: settled, disbanded } = settleUpkeep(army, false);
    expect(disbanded).toBe(false);
    expect(settled!.unpaidSeasons).toBe(1);
    expect(settled!.units[0].loyalty).toBe(40);
    expect(settled!.units[0].strength).toBeCloseTo(80 * 0.97, 5);
  });

  test('disbands when average loyalty falls below the threshold', () => {
    const army = makeArmy({ units: [makeUnit({ loyalty: 25 })] });
    const { army: settled, disbanded } = settleUpkeep(army, false);
    expect(disbanded).toBe(true);
    expect(settled).toBeNull();
  });

  test('stays alive exactly at the disband boundary', () => {
    const threshold = BALANCE.campaign.upkeep.disbandLoyaltyThreshold;
    const penalty = BALANCE.campaign.upkeep.shortfallLoyaltyPenalty;
    const army = makeArmy({ units: [makeUnit({ loyalty: threshold + penalty })] });
    const { disbanded } = settleUpkeep(army, false);
    expect(disbanded).toBe(false);
  });
});
