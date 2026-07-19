// ─── warStanding.ts tests ────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C9 — the standing formula
// (sicilyControl + armyBalance + momentum − wearinessGap) that replaced
// warEngine.ts's old skirmish-drift roll. See that file's header comment for
// the full architecture (this module is pure, no store access).

import {
  computeSicilyControl, computeArmyBalance, momentumDeltaForBattle, applyBattleMomentum,
  applyMomentumDelta, decayMomentum, computeWearinessGap, accrueWeariness, computeWarScore,
} from '../src/engine/warStanding';
import { BALANCE } from '../src/data/balance';
import type { CityState } from '../src/models/city';
import type { Army, ArmyUnit } from '../src/models/army';
import type { WarState } from '../src/models/war';

const S = BALANCE.campaign.standing;

// ─── Fixtures ─────────────────────────────────────────────────────────────

function makeCity(id: string, owner: CityState['owner']): CityState {
  return { id, owner } as unknown as CityState;
}

function makeArmyUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: 'unit-1', unitClass: 'legionary', strength: 80, veterancy: 'trained', loyalty: 60,
    elephantSteady: false, homeRegion: 'sicilia', raisedBy: 'player', raisedSeason: 1,
    campaignsSurvived: 1, wonCrushingVictory: false,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1', name: 'Legio I', owner: 'player', commanderId: 'pc-1', location: 'sicilia',
    stationedCityId: null, units: [makeArmyUnit()], stance: 'give_battle',
    ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    ...overrides,
  };
}

function makeWar(overrides: Partial<WarState> = {}): WarState {
  return {
    id: 'war-carthage-1', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
    warScore: 0, startedTurn: 1, weariness: 0, enemyWeariness: 0, momentum: 0,
    treaty: null,
    phase: 'opening', ignitedYear: -264, endedYear: null, terminalOutcome: null,
    peaceOffered: false, lastFundingOfferTurn: -100,
    ...overrides,
  };
}

// ─── computeSicilyControl ───────────────────────────────────────────────────

describe('computeSicilyControl', () => {
  test('Rome holding all 4 cities scores 3×perCity + lilybaeumWeight', () => {
    const cities = [
      makeCity('messana', 'rome'), makeCity('syracuse', 'rome'),
      makeCity('agrigentum', 'rome'), makeCity('lilybaeum', 'rome'),
    ];
    expect(computeSicilyControl(cities)).toBe(3 * S.sicilyControlPerCity + S.sicilyControlLilybaeumWeight);
  });

  test('Carthage holding all 4 cities scores the exact negative', () => {
    const cities = [
      makeCity('messana', 'carthage'), makeCity('syracuse', 'carthage'),
      makeCity('agrigentum', 'carthage'), makeCity('lilybaeum', 'carthage'),
    ];
    expect(computeSicilyControl(cities)).toBe(-(3 * S.sicilyControlPerCity + S.sicilyControlLilybaeumWeight));
  });

  test('an independent city contributes 0', () => {
    const cities = [
      makeCity('messana', 'independent'), makeCity('syracuse', 'rome'),
      makeCity('agrigentum', 'rome'), makeCity('lilybaeum', 'rome'),
    ];
    expect(computeSicilyControl(cities)).toBe(2 * S.sicilyControlPerCity + S.sicilyControlLilybaeumWeight);
  });

  test('a city missing from the array entirely contributes 0 (defensive, not expected in practice)', () => {
    const cities = [makeCity('lilybaeum', 'rome')];
    expect(computeSicilyControl(cities)).toBe(S.sicilyControlLilybaeumWeight);
  });

  test('Lilybaeum is weighted independently of the other 3 cities', () => {
    const romeLilybaeumOnly = [makeCity('lilybaeum', 'rome')];
    const romeOtherOnly = [makeCity('messana', 'rome')];
    expect(computeSicilyControl(romeLilybaeumOnly)).toBe(S.sicilyControlLilybaeumWeight);
    expect(computeSicilyControl(romeOtherOnly)).toBe(S.sicilyControlPerCity);
    expect(S.sicilyControlLilybaeumWeight).not.toBe(S.sicilyControlPerCity);
  });
});

// ─── computeArmyBalance ──────────────────────────────────────────────────────

describe('computeArmyBalance', () => {
  test('no armies at all scores 0', () => {
    expect(computeArmyBalance([])).toBe(0);
  });

  test('Rome presence with zero Carthage presence scores the cap', () => {
    const armies = [makeArmy({ owner: 'player' })];
    expect(computeArmyBalance(armies)).toBe(S.armyBalanceCap);
  });

  test('Carthage presence with zero Rome presence scores the negative cap', () => {
    const armies = [makeArmy({ owner: 'carthage', commanderId: 'gen-1' })];
    expect(computeArmyBalance(armies)).toBe(-S.armyBalanceCap);
  });

  test('identical Rome and Carthage forces score exactly 0 (log2(1) = 0)', () => {
    const armies = [
      makeArmy({ id: 'a1', owner: 'player' }),
      makeArmy({ id: 'a2', owner: 'carthage', commanderId: 'gen-1' }),
    ];
    expect(computeArmyBalance(armies)).toBe(0);
  });

  test('a much stronger Rome force is clamped at the cap, never exceeding it', () => {
    const armies = [
      makeArmy({
        id: 'a1', owner: 'player',
        units: Array.from({ length: 20 }, (_, i) => makeArmyUnit({ id: `u${i}`, veterancy: 'legendary', strength: 100 })),
      }),
      makeArmy({ id: 'a2', owner: 'carthage', commanderId: 'gen-1', units: [makeArmyUnit({ strength: 1 })] }),
    ];
    expect(computeArmyBalance(armies)).toBe(S.armyBalanceCap);
  });

  test('rome_state and rome_rival armies both count as Rome power (armyPowerOf)', () => {
    const armies = [
      makeArmy({ id: 'a1', owner: 'rome_state', commanderId: null }),
      makeArmy({ id: 'a2', owner: 'carthage', commanderId: 'gen-1' }),
    ];
    // Same strength on both sides -> 0, same as the player-owned equivalent above.
    expect(computeArmyBalance(armies)).toBe(0);
  });
});

// ─── momentumDeltaForBattle / applyBattleMomentum / applyMomentumDelta ──────

describe('momentumDeltaForBattle', () => {
  test('Rome winning yields a positive delta sized by tier', () => {
    expect(momentumDeltaForBattle('crushing', 'rome')).toBe(S.momentumDeltaByTier.crushing);
    expect(momentumDeltaForBattle('clear', 'rome')).toBe(S.momentumDeltaByTier.clear);
    expect(momentumDeltaForBattle('marginal', 'rome')).toBe(S.momentumDeltaByTier.marginal);
  });

  test('Carthage winning yields the exact negative', () => {
    expect(momentumDeltaForBattle('crushing', 'carthage')).toBe(-S.momentumDeltaByTier.crushing);
  });
});

describe('applyBattleMomentum', () => {
  test('bumps the matching active major war\'s momentum, clamped to ±momentumCap', () => {
    const wars = [makeWar({ momentum: S.momentumCap - 2 })];
    const result = applyBattleMomentum(wars, 'carthage', 'rome', 'crushing');
    expect(result[0].momentum).toBe(S.momentumCap); // would be cap+6 unclamped
  });

  test('ignores an inactive war, a local-scale war, and a differently-enemied war', () => {
    const wars = [
      makeWar({ id: 'w1', active: false, momentum: 0 }),
      makeWar({ id: 'w2', scale: 'local', momentum: 0 }),
      makeWar({ id: 'w3', enemyId: 'a-revolt', momentum: 0 }),
    ];
    const result = applyBattleMomentum(wars, 'carthage', 'rome', 'crushing');
    expect(result.every(w => w.momentum === 0)).toBe(true);
  });
});

describe('applyMomentumDelta', () => {
  test('applies a raw signed delta, clamped to ±momentumCap', () => {
    const wars = [makeWar({ momentum: 0 })];
    expect(applyMomentumDelta(wars, 'carthage', 5)[0].momentum).toBe(5);
    expect(applyMomentumDelta(wars, 'carthage', S.momentumCap + 50)[0].momentum).toBe(S.momentumCap);
    expect(applyMomentumDelta(wars, 'carthage', -(S.momentumCap + 50))[0].momentum).toBe(-S.momentumCap);
  });
});

// ─── decayMomentum ───────────────────────────────────────────────────────────

describe('decayMomentum', () => {
  test('multiplies by momentumDecayMult', () => {
    expect(decayMomentum(10)).toBeCloseTo(10 * S.momentumDecayMult);
    expect(decayMomentum(-10)).toBeCloseTo(-10 * S.momentumDecayMult);
  });

  test('snaps a tiny residual to exactly 0 rather than trailing forever', () => {
    expect(decayMomentum(0.5)).toBe(0);
    expect(decayMomentum(-0.5)).toBe(0);
  });

  test('0 decays to 0', () => {
    expect(decayMomentum(0)).toBe(0);
  });
});

// ─── computeWearinessGap ─────────────────────────────────────────────────────

describe('computeWearinessGap', () => {
  test('equal weariness on both sides scores 0', () => {
    expect(computeWearinessGap(10, 10)).toBe(0);
  });

  test('Carthage wearier than Rome nudges standing UP (positive)', () => {
    expect(computeWearinessGap(0, 10)).toBeGreaterThan(0);
  });

  test('Rome wearier than Carthage nudges standing DOWN (negative)', () => {
    expect(computeWearinessGap(10, 0)).toBeLessThan(0);
  });

  test('clamped to ±wearinessGapCap for an extreme gap', () => {
    expect(computeWearinessGap(0, 10000)).toBe(S.wearinessGapCap);
    expect(computeWearinessGap(10000, 0)).toBe(-S.wearinessGapCap);
  });
});

// ─── accrueWeariness ─────────────────────────────────────────────────────────

describe('accrueWeariness', () => {
  test('both sides accrue at least the base rate with no modifiers', () => {
    const result = accrueWeariness(0, 0, false, 0);
    expect(result.weariness).toBe(S.weariness.baseRate);
    expect(result.enemyWeariness).toBe(S.weariness.baseRate);
  });

  test('an upkeep shortfall this season adds Rome-only bonus accrual', () => {
    const withShortfall = accrueWeariness(0, 0, true, 0);
    const without = accrueWeariness(0, 0, false, 0);
    expect(withShortfall.weariness).toBe(without.weariness + S.weariness.upkeepShortfallBonus);
    expect(withShortfall.enemyWeariness).toBe(without.enemyWeariness); // Carthage unaffected
  });

  test('elevated Unrest tier adds Rome-only bonus accrual', () => {
    const elevated = accrueWeariness(0, 0, false, S.weariness.unrestElevatedTier);
    const calm = accrueWeariness(0, 0, false, S.weariness.unrestElevatedTier - 1);
    expect(elevated.weariness).toBe(calm.weariness + S.weariness.unrestElevatedBonus);
    expect(elevated.enemyWeariness).toBe(calm.enemyWeariness);
  });

  test('both bonuses stack in the same season', () => {
    const result = accrueWeariness(0, 0, true, S.weariness.unrestElevatedTier);
    expect(result.weariness).toBe(
      S.weariness.baseRate + S.weariness.upkeepShortfallBonus + S.weariness.unrestElevatedBonus,
    );
  });

  test('Carthage always accrues at the flat base rate regardless of Rome-side signals', () => {
    const result = accrueWeariness(5, 5, true, S.weariness.unrestElevatedTier);
    expect(result.enemyWeariness).toBe(5 + S.weariness.baseRate);
  });
});

// ─── computeWarScore ─────────────────────────────────────────────────────────

describe('computeWarScore', () => {
  test('sums all four terms (wearinessGap subtracted)', () => {
    expect(computeWarScore(10, 5, 3, 2)).toBe(10 + 5 + 3 - 2);
  });

  test('clamps to ±clamp (100) for an extreme combination', () => {
    expect(computeWarScore(100, 100, 100, -100)).toBe(S.clamp);
    expect(computeWarScore(-100, -100, -100, 100)).toBe(-S.clamp);
  });

  test('a positive wearinessGap (Rome wearier) pulls the total down', () => {
    const withGap = computeWarScore(10, 0, 0, 5);
    const withoutGap = computeWarScore(10, 0, 0, 0);
    expect(withGap).toBeLessThan(withoutGap);
  });
});
