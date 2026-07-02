import {
  getLocalSupportModifier,
  calcEffectiveForce,
  calcMilitaryImperium,
  calcTotalImperium,
  promoteVeterans,
  applyTroopAttrition,
  calcLevyCost,
} from '../src/engine/troopEngine';
import {
  getMusterProvinceDistanceTier,
  calcConsularArmyStrength,
  calcConsularArmyArrivalTurn,
} from '../src/engine/senateResponseEngine';
import type { TroopUnit } from '../src/models/troop';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeTroop = (overrides: Partial<TroopUnit> = {}): TroopUnit => ({
  id:                `troop-${Math.random().toString(36).slice(2)}`,
  type:              'raised',
  strength:          5,
  campaignsSurvived: 0,
  yearsInactive:     0,
  bondToCommander:   50,
  musterProvinceId:  'samnium',
  ...overrides,
});

// ─── getLocalSupportModifier ─────────────────────────────────────────────────

describe('getLocalSupportModifier', () => {
  test('localSupport 0 returns 0.85', () => {
    expect(getLocalSupportModifier(0)).toBe(0.85);
  });

  test('localSupport 15 (upper boundary of first tier) returns 0.85', () => {
    expect(getLocalSupportModifier(15)).toBe(0.85);
  });

  test('localSupport 16 (first tick into second tier) returns 0.95', () => {
    expect(getLocalSupportModifier(16)).toBe(0.95);
  });

  test('localSupport 50 (upper boundary of middle tier) returns 1.00', () => {
    expect(getLocalSupportModifier(50)).toBe(1.00);
  });

  test('localSupport 86 (first tick into top tier) returns 1.30', () => {
    expect(getLocalSupportModifier(86)).toBe(1.30);
  });

  test('localSupport 100 (maximum) returns 1.30', () => {
    expect(getLocalSupportModifier(100)).toBe(1.30);
  });
});

// ─── calcEffectiveForce ───────────────────────────────────────────────────────

describe('calcEffectiveForce', () => {
  test('empty troops array returns 0', () => {
    expect(calcEffectiveForce([], 5, 50)).toBe(0);
  });

  test('2 troops strength 5, martial 0, support 50: rawStrength × 1.0 × 1.0 = 10', () => {
    const troops = [makeTroop({ strength: 5 }), makeTroop({ strength: 5 })];
    // localMod(50) = 1.00, martialMod = 1 + 0/10 = 1.0
    // round(10 × 1.0 × 1.0) = 10
    expect(calcEffectiveForce(troops, 0, 50)).toBe(10);
  });

  test('2 troops strength 5, martial 10, support 50: 2× martial multiplier = 20', () => {
    const troops = [makeTroop({ strength: 5 }), makeTroop({ strength: 5 })];
    // localMod(50) = 1.00, martialMod = 1 + 10/10 = 2.0
    // round(10 × 2.0 × 1.0) = 20
    expect(calcEffectiveForce(troops, 10, 50)).toBe(20);
  });

  test('2 troops strength 5, martial 5, support 90: 1.5 × 1.30 multiplier', () => {
    const troops = [makeTroop({ strength: 5 }), makeTroop({ strength: 5 })];
    // localMod(90) = 1.30, martialMod = 1 + 5/10 = 1.5
    // round(10 × 1.5 × 1.30) = round(19.5) = 20
    // Note: spec approximation of ~16 appears to be a calculation error;
    // the formula unambiguously produces 20 for these inputs.
    expect(calcEffectiveForce(troops, 5, 90)).toBe(20);
  });

  test('strength is summed across all troops before applying multipliers', () => {
    const troops = [
      makeTroop({ strength: 3 }),
      makeTroop({ strength: 7 }),
    ];
    // rawStrength = 10, localMod(0) = 0.85, martialMod = 1.0
    // round(10 × 1.0 × 0.85) = round(8.5) = 9
    expect(calcEffectiveForce(troops, 0, 0)).toBe(9);
  });
});

// ─── calcMilitaryImperium ─────────────────────────────────────────────────────

describe('calcMilitaryImperium', () => {
  test('empty array returns 0', () => {
    expect(calcMilitaryImperium([])).toBe(0);
  });

  test('1 unit with strength 2 (below threshold) returns 0', () => {
    expect(calcMilitaryImperium([makeTroop({ strength: 2 })])).toBe(0);
  });

  test('1 unit with strength 3 (at threshold) returns 1', () => {
    expect(calcMilitaryImperium([makeTroop({ strength: 3 })])).toBe(1);
  });

  test('2 units with strength ≥ 3 returns 1', () => {
    const troops = [makeTroop({ strength: 3 }), makeTroop({ strength: 5 })];
    expect(calcMilitaryImperium(troops)).toBe(1);
  });

  test('3 units with strength ≥ 3 returns 2', () => {
    const troops = [
      makeTroop({ strength: 3 }),
      makeTroop({ strength: 4 }),
      makeTroop({ strength: 5 }),
    ];
    expect(calcMilitaryImperium(troops)).toBe(2);
  });

  test('6 units with strength ≥ 3 returns 3', () => {
    const troops = Array.from({ length: 6 }, () => makeTroop({ strength: 3 }));
    expect(calcMilitaryImperium(troops)).toBe(3);
  });

  test('1 seasoned_veteran of any strength returns 3 (special override)', () => {
    const veteran = makeTroop({ type: 'seasoned_veteran', strength: 1 });
    expect(calcMilitaryImperium([veteran])).toBe(3);
  });

  test('seasoned_veteran override applies even when strong unit count < 6', () => {
    const troops = [
      makeTroop({ type: 'seasoned_veteran', strength: 1 }),
      makeTroop({ strength: 2 }), // below threshold
    ];
    expect(calcMilitaryImperium(troops)).toBe(3);
  });
});

// ─── calcTotalImperium ────────────────────────────────────────────────────────

describe('calcTotalImperium', () => {
  test('formal 2, military 0: higher dominates, lower contributes 0', () => {
    // higher=2, lower=0, total = 2 + floor(0/2) = 2
    expect(calcTotalImperium(2, 0)).toBe(2);
  });

  test('formal 0, military 2: symmetric — same result as (2, 0)', () => {
    expect(calcTotalImperium(0, 2)).toBe(2);
  });

  test('formal 1, military 1: 1 + floor(1/2) = 1', () => {
    // higher=1, lower=1, total = 1 + 0 = 1
    expect(calcTotalImperium(1, 1)).toBe(1);
  });

  test('formal 2, military 2: 2 + floor(2/2) = 3', () => {
    expect(calcTotalImperium(2, 2)).toBe(3);
  });

  test('formal 3, military 3: capped at 3', () => {
    // higher=3, lower=3, uncapped = 3 + 1 = 4 → clamped to 3
    expect(calcTotalImperium(3, 3)).toBe(3);
  });

  test('formal 3, military 0: hard cap does not reduce 3', () => {
    expect(calcTotalImperium(3, 0)).toBe(3);
  });

  test('result is always in range 0–3', () => {
    const pairs: [number, number][] = [
      [0, 0], [1, 0], [0, 1], [2, 1], [3, 2], [3, 3],
    ];
    for (const [f, m] of pairs) {
      const result = calcTotalImperium(f, m);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(3);
    }
  });
});

// ─── promoteVeterans ──────────────────────────────────────────────────────────

describe('promoteVeterans', () => {
  describe('decisive_victory', () => {
    test('raised → veteran (strength +2, bond → 85)', () => {
      const troop = makeTroop({ type: 'raised', strength: 4, bondToCommander: 50 });
      const result = promoteVeterans([troop], 'decisive_victory');
      expect(result[0].type).toBe('veteran');
      expect(result[0].strength).toBe(6);
      expect(result[0].bondToCommander).toBe(85);
    });

    test('veteran → seasoned_veteran (strength +1, bond → 95)', () => {
      const troop = makeTroop({ type: 'veteran', strength: 6, bondToCommander: 85 });
      const result = promoteVeterans([troop], 'decisive_victory');
      expect(result[0].type).toBe('seasoned_veteran');
      expect(result[0].strength).toBe(7);
      expect(result[0].bondToCommander).toBe(95);
    });

    test('strength is clamped at 10 on promotion', () => {
      const troop = makeTroop({ type: 'raised', strength: 9 });
      const result = promoteVeterans([troop], 'decisive_victory');
      expect(result[0].strength).toBe(10);
    });

    test('seasoned_veteran is unchanged', () => {
      const troop = makeTroop({ type: 'seasoned_veteran', strength: 8, bondToCommander: 95 });
      const result = promoteVeterans([troop], 'decisive_victory');
      expect(result[0].type).toBe('seasoned_veteran');
      expect(result[0].strength).toBe(8);
    });
  });

  describe('victory', () => {
    test('raised → veteran (same stat boost as decisive_victory promotion)', () => {
      const troop = makeTroop({ type: 'raised', strength: 4, bondToCommander: 50 });
      const result = promoteVeterans([troop], 'victory');
      expect(result[0].type).toBe('veteran');
      expect(result[0].strength).toBe(6);
      expect(result[0].bondToCommander).toBe(85);
    });

    test('veteran does NOT advance to seasoned_veteran', () => {
      const troop = makeTroop({ type: 'veteran', strength: 6, bondToCommander: 85 });
      const result = promoteVeterans([troop], 'victory');
      expect(result[0].type).toBe('veteran');
      expect(result[0].strength).toBe(6);
    });
  });

  describe('pyrrhic', () => {
    test('no promotions — all units lose 1 strength', () => {
      const troop = makeTroop({ type: 'raised', strength: 5 });
      const result = promoteVeterans([troop], 'pyrrhic');
      expect(result[0].type).toBe('raised');
      expect(result[0].strength).toBe(4);
    });

    test('no desertion regardless of bond', () => {
      const troop = makeTroop({ strength: 3, bondToCommander: 10 });
      const result = promoteVeterans([troop], 'pyrrhic');
      expect(result).toHaveLength(1);
    });

    test('strength floor at 1 (not 0)', () => {
      const troop = makeTroop({ strength: 1 });
      const result = promoteVeterans([troop], 'pyrrhic');
      expect(result[0].strength).toBe(1);
    });
  });

  describe('defeat', () => {
    test('unit with bond 50 (≥ 40) survives with strength −2', () => {
      const troop = makeTroop({ strength: 6, bondToCommander: 50 });
      const result = promoteVeterans([troop], 'defeat');
      expect(result).toHaveLength(1);
      expect(result[0].strength).toBe(4);
    });

    test('unit with bond 30 (< 40) deserts — removed from array', () => {
      const troop = makeTroop({ strength: 5, bondToCommander: 30 });
      const result = promoteVeterans([troop], 'defeat');
      expect(result).toHaveLength(0);
    });

    test('mixed bonds — only high-bond units survive', () => {
      const troops = [
        makeTroop({ bondToCommander: 40 }),  // exactly at threshold — survives
        makeTroop({ bondToCommander: 39 }),  // below — deserts
        makeTroop({ bondToCommander: 70 }),  // well above — survives
      ];
      const result = promoteVeterans(troops, 'defeat');
      expect(result).toHaveLength(2);
    });

    test('strength floor at 1 — units do not reach 0', () => {
      const troop = makeTroop({ strength: 1, bondToCommander: 50 });
      const result = promoteVeterans([troop], 'defeat');
      expect(result[0].strength).toBe(1);
    });
  });

  describe('catastrophic', () => {
    test('unit with bond 55 (< 60) deserts', () => {
      const troop = makeTroop({ strength: 5, bondToCommander: 55 });
      const result = promoteVeterans([troop], 'catastrophic');
      expect(result).toHaveLength(0);
    });

    test('unit with bond 60 (at threshold) survives with strength −2', () => {
      const troop = makeTroop({ strength: 6, bondToCommander: 60 });
      const result = promoteVeterans([troop], 'catastrophic');
      expect(result).toHaveLength(1);
      expect(result[0].strength).toBe(4);
    });

    test('broader desertion than defeat (bond < 60 vs bond < 40)', () => {
      const troop = makeTroop({ bondToCommander: 45 }); // survives defeat, deserts catastrophic
      const afterDefeat       = promoteVeterans([troop], 'defeat');
      const afterCatastrophic = promoteVeterans([troop], 'catastrophic');
      expect(afterDefeat).toHaveLength(1);
      expect(afterCatastrophic).toHaveLength(0);
    });
  });
});

// ─── applyTroopAttrition ──────────────────────────────────────────────────────

describe('applyTroopAttrition', () => {
  test('newly raised troop (yearsInactive 0) takes no strength loss', () => {
    const troop = makeTroop({ yearsInactive: 0, strength: 5 });
    const result = applyTroopAttrition([troop], 1);
    expect(result[0].strength).toBe(5);
    expect(result[0].yearsInactive).toBe(1); // counter still increments
  });

  test('yearsInactive 39 (just under 10 years): no strength loss', () => {
    const troop = makeTroop({ yearsInactive: 39, strength: 5 });
    const result = applyTroopAttrition([troop], 1);
    // total = 40 seasons, exactly at threshold — no loss yet
    expect(result[0].strength).toBe(5);
  });

  test('yearsInactive 40 (exactly 10 years): first strength loss of −1', () => {
    // Per spec: at 40 seasons inactive, attrition begins.
    // Note: if this test fails, the troopEngine threshold condition
    // (currently `> 40`) may need adjustment to `>= 40` or similar.
    const troop = makeTroop({ yearsInactive: 40, strength: 5 });
    const result = applyTroopAttrition([troop], 1);
    expect(result[0].strength).toBe(4);
  });

  test('yearsInactive 44 (11 years): still −1 strength loss', () => {
    const troop = makeTroop({ yearsInactive: 44, strength: 5 });
    const result = applyTroopAttrition([troop], 1);
    expect(result[0].strength).toBe(4);
  });

  test('yearsInactive counter is always incremented by seasonsElapsed', () => {
    const troop = makeTroop({ yearsInactive: 10 });
    const result = applyTroopAttrition([troop], 4);
    expect(result[0].yearsInactive).toBe(14);
  });

  test('strength never drops below 1 from attrition', () => {
    const troop = makeTroop({ yearsInactive: 200, strength: 1 });
    const result = applyTroopAttrition([troop], 1);
    expect(result[0].strength).toBeGreaterThanOrEqual(1);
  });

  test('multiple troops are all processed independently', () => {
    const troops = [
      makeTroop({ yearsInactive: 0,  strength: 5 }),
      makeTroop({ yearsInactive: 44, strength: 5 }),
    ];
    const result = applyTroopAttrition(troops, 1);
    expect(result[0].strength).toBe(5);
    expect(result[1].strength).toBe(4);
  });
});

// ─── calcLevyCost ────────────────────────────────────────────────────────────

describe('calcLevyCost', () => {
  test('authorised levy at zero crisis: base cost unchanged', () => {
    // crisisModifier = 1 + 0 = 1.0, senateDiscount = 1.0
    expect(calcLevyCost(60, 0, true)).toBe(60);
  });

  test('unsanctioned levy at zero crisis: 50% surcharge', () => {
    // crisisModifier = 1.0, senateDiscount = 1.5
    expect(calcLevyCost(60, 0, false)).toBe(90);
  });

  test('authorised levy at max crisis: 50% crisis surcharge', () => {
    // crisisModifier = 1 + (100/100 × 0.5) = 1.5, senateDiscount = 1.0
    expect(calcLevyCost(60, 100, true)).toBe(90);
  });

  test('unsanctioned levy at max crisis: both surcharges compound', () => {
    // crisisModifier = 1.5, senateDiscount = 1.5
    // 60 × 1.5 × 1.5 = 135
    expect(calcLevyCost(60, 100, false)).toBe(135);
  });

  test('half-base levy (veterans): unsanctioned at zero crisis = 45', () => {
    // Chunk M uses baseCost=30 for musterVeterans with senateAuthorised=false
    // 30 × 1.0 × 1.5 = 45
    expect(calcLevyCost(30, 0, false)).toBe(45);
  });

  test('result is always a whole number (rounded)', () => {
    // Use a crisis level that would produce a fractional result
    const result = calcLevyCost(60, 33, false);
    expect(Number.isInteger(result)).toBe(true);
  });
});

// ─── getMusterProvinceDistanceTier ───────────────────────────────────────────

describe('getMusterProvinceDistanceTier', () => {
  test("'samnium' is 'near'", () => {
    expect(getMusterProvinceDistanceTier('samnium')).toBe('near');
  });

  test("'etruria' is 'near'", () => {
    expect(getMusterProvinceDistanceTier('etruria')).toBe('near');
  });

  test("'campania' is 'near'", () => {
    expect(getMusterProvinceDistanceTier('campania')).toBe('near');
  });

  test("'latium' is 'near' (in lookup, though forbidden for mustering)", () => {
    expect(getMusterProvinceDistanceTier('latium')).toBe('near');
  });

  test("'cisalpine_gaul' is 'far'", () => {
    expect(getMusterProvinceDistanceTier('cisalpine_gaul')).toBe('far');
  });

  test("'hispania_citerior' is 'very_far'", () => {
    expect(getMusterProvinceDistanceTier('hispania_citerior')).toBe('very_far');
  });

  test("'africa' is 'very_far'", () => {
    expect(getMusterProvinceDistanceTier('africa')).toBe('very_far');
  });

  test("'asia_minor' is 'distant'", () => {
    expect(getMusterProvinceDistanceTier('asia_minor')).toBe('distant');
  });

  test("'macedonia' is 'distant'", () => {
    expect(getMusterProvinceDistanceTier('macedonia')).toBe('distant');
  });

  test('unknown province ID defaults to near (safe fallback)', () => {
    expect(getMusterProvinceDistanceTier('unknown_province')).toBe('near');
  });
});

// ─── calcConsularArmyStrength ─────────────────────────────────────────────────

describe('calcConsularArmyStrength', () => {
  test('crisis 0, imperium 1: 40 + 0 + 2 = 42', () => {
    expect(calcConsularArmyStrength(0, 1)).toBe(42);
  });

  test('crisis 60, imperium 3: 40 + 30 + 6 = 76', () => {
    expect(calcConsularArmyStrength(60, 3)).toBe(76);
  });

  test('crisis 100, imperium 3: 40 + 50 + 6 = 96', () => {
    expect(calcConsularArmyStrength(100, 3)).toBe(96);
  });

  test('crisis 0, imperium 0: base value of 40', () => {
    expect(calcConsularArmyStrength(0, 0)).toBe(40);
  });

  test('result is always a whole number (rounded)', () => {
    expect(Number.isInteger(calcConsularArmyStrength(33, 2))).toBe(true);
  });
});

// ─── calcConsularArmyArrivalTurn ──────────────────────────────────────────────

describe('calcConsularArmyArrivalTurn', () => {
  test('near province: arrives in 4 seasons (detectedOnTurn + 4)', () => {
    expect(calcConsularArmyArrivalTurn(1, 'samnium')).toBe(5);  // 1 + 4 + 0
  });

  test('far province: arrives in 5 seasons', () => {
    expect(calcConsularArmyArrivalTurn(1, 'cisalpine_gaul')).toBe(6); // 1 + 4 + 1
  });

  test('very_far province: arrives in 6 seasons', () => {
    expect(calcConsularArmyArrivalTurn(1, 'africa')).toBe(7); // 1 + 4 + 2
  });

  test('distant province: arrives in 7 seasons', () => {
    expect(calcConsularArmyArrivalTurn(1, 'asia_minor')).toBe(8); // 1 + 4 + 3
  });

  test('detectedOnTurn is used as the base for the delay', () => {
    // detected on turn 10 in a far province: arrives on turn 15
    expect(calcConsularArmyArrivalTurn(10, 'cisalpine_gaul')).toBe(15); // 10 + 4 + 1
  });

  test('unknown province defaults to near (safe fallback: +4 seasons)', () => {
    expect(calcConsularArmyArrivalTurn(1, 'unknown_province')).toBe(5); // 1 + 4 + 0
  });
});

// ─── Latium prohibition (integration note) ───────────────────────────────────
//
// The Latium prohibition ("no armed force may enter the sacred boundary of Rome")
// is enforced as a guard in the `raiseLevy` store action (gameStore.ts, Chunk M):
//
//   if (musterProvinceId === 'latium') return;
//
// This is store logic, not engine logic, so it is not tested here. A store-level
// integration test for `raiseLevy` with musterProvinceId='latium' should be added
// to a separate gameStore test file when one is created.
//
// What CAN be verified here is that the distance tier lookup does include latium
// (it is 'near') — the prohibition is a separate policy layer above the distance calc.
