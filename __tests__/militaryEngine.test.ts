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
  tickSenateResponse,
  capitulate,
  bribeCommission,
  type SenateResponseState,
} from '../src/engine/senateResponseEngine';
import type { TroopUnit } from '../src/models/troop';
import type { Army, ArmyUnit } from '../src/models/army';
import type { Character } from '../src/models/character';
import type { Clan } from '../src/models/clan';
import type { GameState } from '../src/state/gameStore';
import { INITIAL_STATE, useGameStore } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';
import type { Bill } from '../src/models/bill';

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

// ─── Campaign Map plan, Chunk C3 — Army-sourced Senate response ─────────────
// tickSenateResponse's combat-resolution step and capitulate now branch on
// SenateResponseState.sourceArmyId (Chunk C3) to measure/disband an Army
// instead of a character's raisedLegions/veterans. These tests cover only
// the NEW branch — the pre-existing personal-levy path (sourceArmyId unset)
// already has coverage via calcEffectiveForce/getLocalSupportModifier above.

describe('tickSenateResponse / capitulate — Chunk C3 Army-sourced branch', () => {
  const makeCharacter = (overrides: Partial<Character> = {}): Character => ({
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0,
    raisedLegions: [], veterans: [],
    ...overrides,
  } as unknown as Character);

  const makeUnit = (overrides: Partial<ArmyUnit> = {}): ArmyUnit => ({
    id: `unit-${Math.random().toString(36).slice(2)}`,
    unitClass: 'legionary', strength: 80, veterancy: 'trained', loyalty: 50,
    elephantSteady: false, homeRegion: 'latium', raisedBy: 'player', raisedSeason: 1,
    campaignsSurvived: 0, wonCrushingVictory: false,
    ...overrides,
  });

  const makeArmy = (overrides: Partial<Army> = {}): Army => ({
    id: 'army-1', name: 'Legio I', owner: 'player', commanderId: null,
    location: 'latium', stationedCityId: 'latium', units: [makeUnit()],
    stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    ...overrides,
  });

  const makeClan = (overrides: Partial<Clan> = {}): Clan => ({
    id: 'clan-1', name: 'Clan', gensName: 'Testia', sigil: '🏛', influence: 50,
    desc: '', leaders: [{ id: 'leader-1' } as Clan['leaders'][0]],
    ...overrides,
  });

  const armySourcedResponse: SenateResponseState = {
    active: true, seasonDetected: 1, phase: 'hostis', musterProvinceId: 'latium',
    consularArmyStrength: 0, debateSuppressed: false, consularArmyArrivesOnTurn: 5,
    sourceArmyId: 'army-1',
  };

  function makeState(overrides: Partial<GameState> = {}): GameState {
    const base = {
      turnNumber: 5, lifetimeDignitas: 20,
      family: [makeCharacter()], cities: [], clans: [makeClan()], trials: [],
      armies: [makeArmy()],
      senateResponse: armySourcedResponse,
      consulAuthorityActive: false, consulAuthoritySeasonsRemaining: 0,
      ...overrides,
    };
    return base as unknown as GameState;
  }

  test('army strong enough clears the response with the usual small dignitas cost', () => {
    const state = makeState({ senateResponse: { ...armySourcedResponse, consularArmyStrength: 0 } });
    const patch = tickSenateResponse(state as any, 'pc-1');
    expect(patch.senateResponse).toBeNull();
    expect(patch.lifetimeDignitas).toBe(15);
  });

  test('army too weak escalates to consular_army with a fresh capture trial', () => {
    const state = makeState({
      senateResponse: { ...armySourcedResponse, consularArmyStrength: 1_000_000 },
      trials: [],
    });
    const patch = tickSenateResponse(state as any, 'pc-1');
    expect((patch.senateResponse as SenateResponseState).phase).toBe('consular_army');
    expect(patch.trials).toHaveLength(1);
  });

  test('the offending army having vanished (combined/disbanded away) quietly clears the response', () => {
    const state = makeState({ armies: [] }); // sourceArmyId no longer resolves
    const patch = tickSenateResponse(state as any, 'pc-1');
    expect(patch.senateResponse).toBeNull();
    expect(patch.lifetimeDignitas).toBeUndefined(); // no penalty either way — the case evaporates
  });

  test('capitulate removes the source Army, not the character\'s raisedLegions', () => {
    const troopedCharacter = makeCharacter({ raisedLegions: [{ id: 't1' } as any] });
    const state = makeState({ family: [troopedCharacter] });
    const patch = capitulate(state as any, 'pc-1');
    expect(patch.armies).toEqual([]);
    expect((patch.family as Character[])[0].raisedLegions).toEqual([{ id: 't1' }]);
  });

  test('the pre-existing personal-levy path (no sourceArmyId) is unaffected', () => {
    const troopedCharacter = makeCharacter({ raisedLegions: [{ id: 't1' } as any] });
    const personalResponse: SenateResponseState = { ...armySourcedResponse, sourceArmyId: undefined };
    const state = makeState({ family: [troopedCharacter], senateResponse: personalResponse });
    const patch = capitulate(state as any, 'pc-1');
    expect((patch.family as Character[])[0].raisedLegions).toEqual([]);
    expect(patch.armies).toEqual(state.armies); // present but untouched
  });

  // tickets/senate-response-3-bribe-commission-ui.md — bribeCommission was
  // fully implemented but had zero test coverage before this ticket.
  test('bribeCommission clears the response for 50 Denarii during censure phase', () => {
    const state = makeState({
      senateResponse: { ...armySourcedResponse, phase: 'censure' },
      denarii: 100,
    } as any);
    const patch = bribeCommission(state as any);
    expect((patch.senateResponse as SenateResponseState).active).toBe(false);
    expect(patch.denarii).toBe(50);
  });

  test('bribeCommission no-ops outside censure phase', () => {
    const state = makeState({ senateResponse: { ...armySourcedResponse, phase: 'hostis' }, denarii: 100 } as any);
    expect(bribeCommission(state as any)).toEqual({});
  });

  test('bribeCommission no-ops without enough denarii', () => {
    const state = makeState({ senateResponse: { ...armySourcedResponse, phase: 'censure' }, denarii: 10 } as any);
    expect(bribeCommission(state as any)).toEqual({});
  });

  test('the debate-phase censure bill is a real Bill the Curia UI can render and resolve', () => {
    const state = makeState({
      senateResponse: { ...armySourcedResponse, phase: null, sourceArmyId: undefined },
      turnNumber: 2, // seasonDetected(1) + 1 = debateTurn
      bills: [],
    });
    const patch = tickSenateResponse(state as any, 'pc-1');
    const bill = (patch.bills as Bill[])?.find(b => b.id.startsWith('senate-censura-'));
    expect(bill).toBeDefined();
    expect(bill!.name).toBeTruthy();
    expect(bill!.desc).toBeTruthy();
    expect(typeof bill!.support).toBe('number');
    expect(typeof bill!.turnsLeft).toBe('number');
    expect(bill!.passEffect).toBe('setFlag:fidesIncomeBlocked:true');
  });
});

// tickets/senate-response-2-fides-income-block.md — the disband parity fix
// lives in turnSequencer.ts's step 9f, not senateResponseEngine.ts, so this
// needs a full processSeason() run rather than a direct tickSenateResponse()
// call. Built off INITIAL_STATE (real STARTING_FAMILY, real crisis/rome
// defaults) rather than this file's own minimal makeState() — the same
// proven pattern __tests__/training.test.ts already uses for store-shaped
// fixtures, since a hand-rolled minimal state isn't safe to run through the
// full season pipeline (crisis/war/election processing all read fields
// makeState() doesn't set).
describe('senate response — disband parity fix (processSeason)', () => {
  function makeFullState(overrides: Partial<GameState> = {}): GameState {
    return { ...INITIAL_STATE, ...overrides } as GameState;
  }

  const basePersonalResponse: SenateResponseState = {
    active: true, seasonDetected: INITIAL_STATE.turnNumber, phase: 'censure',
    musterProvinceId: null, consularArmyStrength: 999, debateSuppressed: false,
    consularArmyArrivesOnTurn: INITIAL_STATE.turnNumber + 10, sourceArmyId: undefined,
  };

  test('raisedLegions disbanded to zero auto-clears the response at season end', () => {
    const family = INITIAL_STATE.family.map(c =>
      c.isPlayer ? { ...c, raisedLegions: [], veterans: [{ id: 'v1' } as any] } : c
    );
    const state = makeFullState({ family, senateResponse: basePersonalResponse });
    const { nextState } = processSeason(state);
    expect((nextState as any).senateResponse).toBeNull();
  });

  test('raisedLegions still present keeps the response escalating normally', () => {
    const family = INITIAL_STATE.family.map(c =>
      c.isPlayer ? { ...c, raisedLegions: [{ id: 't1' } as any] } : c
    );
    const state = makeFullState({ family, senateResponse: basePersonalResponse });
    const { nextState } = processSeason(state);
    expect((nextState as any).senateResponse).not.toBeNull();
  });

  test('an Army-sourced response with an empty raisedLegions but a still-existing Army keeps escalating (new check does not misfire on it)', () => {
    const family = INITIAL_STATE.family.map(c =>
      c.isPlayer ? { ...c, raisedLegions: [] } : c
    );
    const army = {
      id: 'army-1', name: 'Legio I', owner: 'player' as const, commanderId: null,
      location: 'latium' as any, stationedCityId: null, units: [],
      stance: 'give_battle' as const, ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    };
    const armySourced: SenateResponseState = { ...basePersonalResponse, sourceArmyId: 'army-1' };
    const state = makeFullState({ family, senateResponse: armySourced, armies: [army] });
    const { nextState } = processSeason(state);
    // The player's raisedLegions is empty, but this response is Army-sourced
    // and the Army still exists — the new (raisedLegions-only) parity check
    // must not clear it. It should keep escalating via the pre-existing
    // Army-sourced machinery instead.
    expect((nextState as any).senateResponse).not.toBeNull();
  });
});

// tickets/senate-response-3-bribe-commission-ui.md /
// tickets/senate-response-4-capitulate-ui.md — the gameStore wrapper
// actions, exercised against the real store (bribeCommission/capitulate
// themselves are already covered directly, against the pure engine
// functions, in the describe block above). Follows the resetStore-via-
// INITIAL_STATE pattern __tests__/training.test.ts already uses for
// store-action tests.
describe('bribeSenateCommission / capitulateToSenate store actions', () => {
  function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
    useGameStore.setState({ ...INITIAL_STATE, log: [], ...overrides } as any);
  }

  const activeResponse: SenateResponseState = {
    active: true, seasonDetected: 1, phase: 'censure', musterProvinceId: null,
    consularArmyStrength: 999, debateSuppressed: false, consularArmyArrivesOnTurn: 20,
    sourceArmyId: undefined,
  };

  test('bribeSenateCommission spends 50 Denarii and deactivates the response', () => {
    resetStore({ senateResponse: activeResponse, denarii: 100 });
    useGameStore.getState().bribeSenateCommission();
    const after = useGameStore.getState();
    expect(after.senateResponse?.active).toBe(false);
    expect(after.denarii).toBe(50);
    expect(after.log.length).toBe(1);
  });

  test('bribeSenateCommission is a no-op with insufficient Denarii', () => {
    resetStore({ senateResponse: activeResponse, denarii: 10 });
    useGameStore.getState().bribeSenateCommission();
    const after = useGameStore.getState();
    expect(after.senateResponse?.active).toBe(true);
    expect(after.denarii).toBe(10);
    expect(after.log.length).toBe(0);
  });

  test('capitulateToSenate clears the response, disbands raisedLegions, applies the Dignitas penalty, and clears an active Fides block', () => {
    const family = INITIAL_STATE.family.map(c =>
      c.isPlayer ? { ...c, raisedLegions: [{ id: 't1' } as any] } : c
    );
    resetStore({
      family, senateResponse: activeResponse, lifetimeDignitas: 20,
      flags: { fidesIncomeBlocked: true },
    });
    useGameStore.getState().capitulateToSenate();
    const after = useGameStore.getState();
    expect(after.senateResponse).toBeNull();
    expect(after.family.find(c => c.isPlayer)?.raisedLegions).toEqual([]);
    expect(after.lifetimeDignitas).toBe(5);
    expect(after.flags['fidesIncomeBlocked']).toBe(false);
    expect(after.log.length).toBe(1);
  });

  test('capitulateToSenate is a no-op with no active response', () => {
    resetStore({ senateResponse: null, denarii: 100, lifetimeDignitas: 20 });
    useGameStore.getState().capitulateToSenate();
    const after = useGameStore.getState();
    expect(after.lifetimeDignitas).toBe(20);
    expect(after.log.length).toBe(0);
  });
});
