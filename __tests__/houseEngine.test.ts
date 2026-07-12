import {
  computeHouseBonuses,
  getClientSlotCap,
  rollTraining,
  sellBackValue,
  getAvailableRooms,
  hasFreeRoomSlot,
  hasFreeShopSlot,
} from '../src/engine/houseEngine';
import { BALANCE } from '../src/data/balance';
import type { OwnedHouse } from '../src/models/house';

function makeHouse(overrides: Partial<OwnedHouse> = {}): OwnedHouse {
  return {
    locationId: 'subura',
    builtRooms: [],
    shops: [null, null, null, null],
    turnAcquired: 1,
    ...overrides,
  };
}

// ─── computeHouseBonuses ──────────────────────────────────────────────────────

describe('computeHouseBonuses', () => {
  test('null house yields an all-zero total', () => {
    const total = computeHouseBonuses(null);
    expect(total).toEqual({ fides: 0, gold: 0, dignitas: 0, corruptionShield: 0, factionRelPerSeason: 0, factionBias: null });
  });

  test('Palatine location bonus: dignitas/season AND optimates relationship drift', () => {
    const total = computeHouseBonuses(makeHouse({ locationId: 'palatine', shops: [] }));
    expect(total.dignitas).toBeGreaterThan(0);
    expect(total.factionRelPerSeason).toBeGreaterThan(0);
    expect(total.factionBias).toBe('optimates');
  });

  test('Subura location bonus: populares relationship drift, no dignitas', () => {
    const total = computeHouseBonuses(makeHouse({ locationId: 'subura' }));
    expect(total.factionRelPerSeason).toBeGreaterThan(0);
    expect(total.factionBias).toBe('populares');
    expect(total.dignitas).toBe(0);
  });

  test('Library room contributes recurring fides, not a one-time value', () => {
    const withLibrary = computeHouseBonuses(makeHouse({ builtRooms: ['library'] }));
    const without = computeHouseBonuses(makeHouse({ builtRooms: [] }));
    expect(withLibrary.fides).toBeGreaterThan(without.fides);
  });

  test('study/hall/kitchen rooms contribute no recurring fides/gold on their own', () => {
    const total = computeHouseBonuses(makeHouse({ builtRooms: ['study', 'hall', 'kitchen'] }));
    expect(total.fides).toBe(0);
    expect(total.gold).toBe(0);
  });

  test('rented businesses aggregate gold/fides/corruptionShield, empty slots contribute nothing', () => {
    const total = computeHouseBonuses(makeHouse({ shops: ['tavern', 'bakery', null, 'fullers_shop'] }));
    expect(total.gold).toBeGreaterThan(0);   // tavern
    expect(total.fides).toBeGreaterThan(0);  // bakery
    expect(total.corruptionShield).toBeGreaterThan(0); // fuller's shop
  });

  test('unknown location/room/business ids are a safe no-op contribution', () => {
    expect(() => computeHouseBonuses(makeHouse({
      locationId: 'nope',
      builtRooms: ['study'],
      shops: ['nope' as any],
    }))).not.toThrow();
  });
});

// ─── getClientSlotCap ─────────────────────────────────────────────────────────

describe('getClientSlotCap', () => {
  test('base cap with no house or no hall', () => {
    expect(getClientSlotCap(null)).toBe(BALANCE.clients.baseSlots);
    expect(getClientSlotCap(makeHouse({ builtRooms: [] }))).toBe(BALANCE.clients.baseSlots);
  });

  test('hall room raises the cap', () => {
    const cap = getClientSlotCap(makeHouse({ builtRooms: ['hall'] }));
    expect(cap).toBeGreaterThan(BALANCE.clients.baseSlots);
  });
});

// ─── rollTraining ──────────────────────────────────────────────────────────────

describe('rollTraining', () => {
  test('chance decreases as currentSkillLevel rises', () => {
    const low = rollTraining(0, false, 0.5);
    const high = rollTraining(10, false, 0.5);
    expect(high.chance).toBeLessThan(low.chance);
  });

  test('hasStudy raises the chance at the same skill level', () => {
    const without = rollTraining(5, false, 0.5);
    const withStudy = rollTraining(5, true, 0.5);
    expect(withStudy.chance).toBeGreaterThan(without.chance);
  });

  test('chance is clamped to [studyRollFloor, studyRollCeiling]', () => {
    const veryHigh = rollTraining(999, false, 0.5);
    expect(veryHigh.chance).toBe(BALANCE.house.studyRollFloor);
    const veryLow = rollTraining(-999, true, 0.5);
    expect(veryLow.chance).toBe(BALANCE.house.studyRollCeiling);
  });

  test('success is roll < chance, deterministic given a fixed roll', () => {
    const result = rollTraining(0, false, 0.01);
    expect(result.success).toBe(true);
    const fail = rollTraining(0, false, 0.999);
    expect(fail.success).toBe(false);
  });
});

// ─── sellBackValue ─────────────────────────────────────────────────────────────

describe('sellBackValue', () => {
  test('null house sells for 0', () => {
    expect(sellBackValue(null)).toBe(0);
  });

  test('scales with location cost plus built rooms plus rented businesses', () => {
    const bare = sellBackValue(makeHouse());
    const furnished = sellBackValue(makeHouse({ builtRooms: ['study', 'library'], shops: ['tavern', null, null, null] }));
    expect(furnished).toBeGreaterThan(bare);
  });

  test('applies the location sellBackFraction (roughly half back, not full)', () => {
    const value = sellBackValue(makeHouse());
    expect(value).toBeLessThan(150); // subura cost is 100 — sold back at a fraction, not full price
    expect(value).toBeGreaterThan(0);
  });
});

// ─── Slot availability ─────────────────────────────────────────────────────────

describe('slot availability', () => {
  test('getAvailableRooms excludes already-built room types', () => {
    const rooms = getAvailableRooms(makeHouse({ builtRooms: ['study'] }));
    expect(rooms.some(r => r.type === 'study')).toBe(false);
    expect(rooms.some(r => r.type === 'library')).toBe(true);
  });

  test('hasFreeRoomSlot respects the location roomSlots count', () => {
    // subura has 2 room slots
    expect(hasFreeRoomSlot(makeHouse({ builtRooms: [] }))).toBe(true);
    expect(hasFreeRoomSlot(makeHouse({ builtRooms: ['study', 'library'] }))).toBe(false);
  });

  test('hasFreeShopSlot is true only while a null slot remains', () => {
    expect(hasFreeShopSlot(makeHouse({ shops: ['tavern', 'bakery', 'fullers_shop', 'moneylender'] }))).toBe(false);
    expect(hasFreeShopSlot(makeHouse({ shops: ['tavern', null, 'fullers_shop', 'moneylender'] }))).toBe(true);
  });

  test('no house is never free', () => {
    expect(hasFreeRoomSlot(null)).toBe(false);
    expect(hasFreeShopSlot(null)).toBe(false);
  });
});
