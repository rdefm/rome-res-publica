import {
  getRegion,
  getAdjacent,
  getRegionRelationship,
  isFriendly,
  isHostile,
  landPath,
  regionOf,
} from '../src/engine/theatreEngine';
import { REGIONS, THEATRE_EDGES } from '../src/data/theatreMap';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import type { RegionId, TheatreState } from '../src/models/theatre';
import { BALANCE } from '../src/data/balance';

const ALL_REGION_IDS: RegionId[] = REGIONS.map(r => r.id);

// ─── Adjacency ───────────────────────────────────────────────────────────────

describe('getAdjacent', () => {
  test('is symmetric — every edge is traversable from both ends', () => {
    for (const edge of THEATRE_EDGES) {
      expect(getAdjacent(edge.a)).toContain(edge.b);
      expect(getAdjacent(edge.b)).toContain(edge.a);
    }
  });

  test('kind filter only returns edges of that kind', () => {
    const seaFromSicilia = getAdjacent('sicilia', 'sea');
    expect(seaFromSicilia).toEqual(expect.arrayContaining(['africa', 'sardinia']));
    expect(seaFromSicilia).not.toContain('campania'); // that edge is a strait, not sea
  });

  test('every region is reachable from latium via the full graph (land + strait + sea)', () => {
    const visited = new Set<RegionId>(['latium']);
    const queue: RegionId[] = ['latium'];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of getAdjacent(current)) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    for (const id of ALL_REGION_IDS) {
      expect(visited.has(id)).toBe(true);
    }
  });
});

// ─── Relationship rollup ────────────────────────────────────────────────────

describe('getRegionRelationship', () => {
  test('averages a multi-city region\'s live relationshipScores', () => {
    const cities = buildInitialCityStates();
    const sicilia = getRegion('sicilia')!;
    const matches = cities.filter(c => sicilia.cityIds.includes(c.id));
    const expected = matches.reduce((sum, c) => sum + c.relationshipScore, 0) / matches.length;
    expect(getRegionRelationship(cities, 'sicilia')).toBeCloseTo(expected);
  });

  test('a single-city region reflects that city\'s exact score', () => {
    const cities = buildInitialCityStates();
    const latiumCity = cities.find(c => c.id === 'latium')!;
    expect(getRegionRelationship(cities, 'latium')).toBe(latiumCity.relationshipScore);
  });

  test('falls back to BALANCE.campaign.defaultForeignRelationship when no cities match', () => {
    expect(getRegionRelationship([], 'sicilia')).toBe(BALANCE.campaign.defaultForeignRelationship);
  });
});

// ─── Controller initialization ──────────────────────────────────────────────

describe('REGIONS — startingController', () => {
  test('every Italian region starts Roman', () => {
    for (const id of ['latium', 'etruria', 'samnium', 'campania', 'cisalpine_gaul'] as RegionId[]) {
      expect(getRegion(id)!.startingController).toBe('rome');
    }
  });

  test('Sicily starts neutral — no single power holds the contested island', () => {
    expect(getRegion('sicilia')!.startingController).toBe('neutral');
  });

  test('Sardinia and Africa start Carthaginian', () => {
    expect(getRegion('sardinia')!.startingController).toBe('carthage');
    expect(getRegion('africa')!.startingController).toBe('carthage');
  });
});

describe('isFriendly / isHostile', () => {
  function makeTheatre(): TheatreState {
    const controllers = {} as TheatreState['controllers'];
    const musteredThisYear = {} as TheatreState['musteredThisYear'];
    for (const region of REGIONS) {
      controllers[region.id] = region.startingController;
      musteredThisYear[region.id] = 0;
    }
    return { controllers, contested: {} as TheatreState['contested'], musteredThisYear };
  }

  test('isFriendly true when the controller matches the given owner', () => {
    const theatre = makeTheatre();
    expect(isFriendly(theatre, 'latium', 'rome')).toBe(true);
    expect(isFriendly(theatre, 'sardinia', 'rome')).toBe(false);
  });

  test('isHostile is false for a neutral region', () => {
    const theatre = makeTheatre();
    expect(isHostile(theatre, 'sicilia', 'rome')).toBe(false);
    expect(isHostile(theatre, 'sicilia', 'carthage')).toBe(false);
  });

  test('isHostile true when the controller is a different non-neutral power', () => {
    const theatre = makeTheatre();
    expect(isHostile(theatre, 'sardinia', 'rome')).toBe(true);
    expect(isHostile(theatre, 'latium', 'carthage')).toBe(true);
  });
});

// ─── Pathfinding ─────────────────────────────────────────────────────────────

describe('landPath', () => {
  test('finds the overland+strait route from Latium to Sicily via Campania', () => {
    const path = landPath('latium', 'sicilia');
    expect(path).toEqual(['latium', 'campania', 'sicilia']);
  });

  test('a region is trivially reachable from itself', () => {
    expect(landPath('latium', 'latium')).toEqual(['latium']);
  });

  test('Sardinia and Africa are unreachable overland — sea-lane only', () => {
    expect(landPath('latium', 'sardinia')).toBeNull();
    expect(landPath('latium', 'africa')).toBeNull();
  });
});

// ─── Reverse lookup ──────────────────────────────────────────────────────────

describe('regionOf', () => {
  test('resolves a multi-city region\'s cities back to the shared region id', () => {
    expect(regionOf('messana')).toBe('sicilia');
    expect(regionOf('lilybaeum')).toBe('sicilia');
    expect(regionOf('carthage')).toBe('africa');
  });

  test('resolves a single-city region', () => {
    expect(regionOf('latium')).toBe('latium');
    expect(regionOf('campania')).toBe('campania');
  });

  test('returns undefined for an unknown city id', () => {
    expect(regionOf('atlantis')).toBeUndefined();
  });
});
