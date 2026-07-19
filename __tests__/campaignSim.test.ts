// ─── campaignSim.ts tests ────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C10 — the headless war
// harness. See that file's header comment for the full architecture
// (rome_rival-owned Roman armies, the sue-tier auto-accept simplification,
// the 241 BC hard stop). Targets #1-3 below are the plan's own Chunk C10
// evidence requirements — see the tuning log appendix in
// rome-campaign-map-implementation-plan.md for the recorded final numbers.

import { simulateOneWar, simulateWar } from '../src/engine/campaignSim';
import { upkeepFor } from '../src/engine/armyEngine';
import { calcCityGoldOutput } from '../src/engine/cityEngine';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import { rollMusteredUnit } from '../src/engine/musterEngine';
import { simulateBattles, type BattleSimConfig } from '../src/engine/battle/battleSim';
import { ENEMY_GENERALS } from '../src/data/enemyGenerals';
import type { Army, ArmyUnit } from '../src/models/army';
import type { BattleUnit } from '../src/models/battle';
import type { TheatreState } from '../src/models/theatre';
import { REGIONS } from '../src/data/theatreMap';
import { BALANCE } from '../src/data/balance';
import { makeSeededRng } from '../src/utils/seededRng';

describe('simulateOneWar — determinism', () => {
  test('the same seed produces an identical result for the idle policy', () => {
    const a = simulateOneWar(42, 'idle');
    const b = simulateOneWar(42, 'idle');
    expect(a).toEqual(b);
  });

  test('the same seed produces an identical result for the ai policy', () => {
    const a = simulateOneWar(42, 'ai');
    const b = simulateOneWar(42, 'ai');
    expect(a).toEqual(b);
  });

  test('different seeds are not guaranteed identical (sanity — not a tautology)', () => {
    const results = Array.from({ length: 10 }, (_, i) => simulateOneWar(i + 1, 'ai'));
    const allIdentical = results.every(r => r.finalWarScore === results[0].finalWarScore);
    expect(allIdentical).toBe(false);
  });
});

describe('simulateOneWar — Roman army model', () => {
  test('idle policy fields zero Roman armies for the entire war (no player/AI initiative)', () => {
    const result = simulateOneWar(1, 'idle');
    expect(result.romanArmyCountSamples.every(c => c === 0)).toBe(true);
  });

  test('ai policy fields at least one Roman army from the start', () => {
    const result = simulateOneWar(1, 'ai');
    expect(result.romanArmyCountSamples[0]).toBeGreaterThan(0);
  });
});

describe('simulateOneWar — shape sanity', () => {
  test('every trial concludes with a real terminal outcome, never "unresolved", within the historical span', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const policy of ['idle', 'ai'] as const) {
        const result = simulateOneWar(seed, policy);
        expect(result.outcome).not.toBe('unresolved');
        expect(result.warLengthYears).toBeGreaterThanOrEqual(0);
        expect(result.warLengthYears).toBeLessThanOrEqual(23); // 264 - 241
      }
    }
  });

  test('warScore stays within -100..100 throughout every sampled season', () => {
    const result = simulateOneWar(7, 'ai');
    expect(result.warScoreSamples.every(s => s >= -100 && s <= 100)).toBe(true);
  });

  test('battleCount is 0 for idle (no Roman army ever exists to fight Carthage)', () => {
    const result = simulateOneWar(1, 'idle');
    expect(result.battleCount).toBe(0);
  });

  test('battleCount is typically > 0 for ai (a real war with two sides fighting)', () => {
    const withBattles = [1, 2, 3, 4, 5].filter(seed => simulateOneWar(seed, 'ai').battleCount > 0);
    expect(withBattles.length).toBeGreaterThan(0);
  });
});

describe('simulateWar — aggregate shape sanity', () => {
  test('rates are always within [0, 1] and outcome fractions sum to ~1', () => {
    const agg = simulateWar('ai', 20, 1);
    expect(agg.negativeOutcomeRate).toBeGreaterThanOrEqual(0);
    expect(agg.negativeOutcomeRate).toBeLessThanOrEqual(1);
    expect(agg.positiveEndRate).toBeGreaterThanOrEqual(0);
    expect(agg.positiveEndRate).toBeLessThanOrEqual(1);
    const sum = agg.outcomeDistribution.victory + agg.outcomeDistribution.exhaustion + agg.outcomeDistribution.humbled;
    expect(sum).toBeCloseTo(1, 5);
    expect(agg.unresolved).toBe(0);
  });
});

// ─── Chunk C10 targets #1-3 ──────────────────────────────────────────────────
// Trial counts chosen for stable-enough stats within a normal test-suite
// runtime, not the exhaustive counts a real tuning pass ran interactively
// (see the tuning log). If a future BALANCE change moves these below their
// bars, that's a real regression worth investigating, not test flakiness —
// re-run with more trials before assuming otherwise.

describe('Chunk C10 — Target #1: idle Rome loses', () => {
  test('idle policy ends in a negative outcome (exhaustion or humbled) in >= 70% of seeds', () => {
    const agg = simulateWar('idle', 60, 1);
    expect(agg.negativeOutcomeRate).toBeGreaterThanOrEqual(0.7);
  });
});

describe('Chunk C10 — Target #2: competent Rome can win', () => {
  test('ai policy reaches Victory or a positive treaty in >= 40% of seeds, median war length 8-16 years', () => {
    const agg = simulateWar('ai', 60, 1);
    expect(agg.positiveEndRate).toBeGreaterThanOrEqual(0.4);
    expect(agg.medianWarLengthYears).toBeGreaterThanOrEqual(8);
    expect(agg.medianWarLengthYears).toBeLessThanOrEqual(16);
  });
});

describe('Chunk C10 — Target #3: battle cadence', () => {
  test('ai policy (a genuinely engaged, hot war) sees a battle every 2-4 seasons on median', () => {
    const agg = simulateWar('ai', 60, 1);
    expect(agg.medianSeasonsPerBattle).toBeGreaterThanOrEqual(2);
    expect(agg.medianSeasonsPerBattle).toBeLessThanOrEqual(4);
  });
});

// ─── Chunk C10 target #5: economy ────────────────────────────────────────────
// Not a war-simulation question (the harness's rome_rival armies never accrue
// unpaidSeasons — see this file's own header comment on "no NPC economy") —
// a direct check of armyEngine.upkeepFor against a synthetic player-owned
// army, per the plan's own target #5 wording ("a 10-cohort army in Carthage-
// controlled territory costs enough that sustained African campaigns strain
// a healthy treasury"). "Typical mid-game season income" is defined here,
// concretely, from real production code rather than a hand-picked number:
// the four incorporated Italian provinces' calcCityGoldOutput at a
// deliberately unglamorous governor policy (standard taxation, no security/
// development spend — a hands-off, tax-only baseline, not a min-maxed one)
// plus two representative mid-tier personal holdings (Vineyard T2 + Insulae
// T2 — always-on income independent of provincial governance, per
// assetDefinitions.ts), which the game already treats as a standard mid-game
// income stream (MANUAL.md §8's "Holdings, Assets, and Clients").
describe('Chunk C10 — Target #5: economy', () => {
  const INCORPORATED_PROVINCE_IDS = ['cisalpine_gaul', 'etruria', 'samnium', 'campania'];
  const MID_GAME_POLICY = { taxation: 'standard' as const, security: 'neglect' as const, development: 'neglect' as const };
  const MID_TIER_HOLDINGS_GOLD = 12 + 18; // Vineyard T2 (12) + Insulae T2 (18), assetDefinitions.ts

  function typicalMidGameDenariiIncome(): number {
    const cities = buildInitialCityStates();
    const provinceIncome = INCORPORATED_PROVINCE_IDS.reduce((sum, id) => {
      const city = cities.find(c => c.id === id)!;
      const midGameCity = { ...city, infrastructureRating: 50, relationshipScore: 60 };
      return sum + calcCityGoldOutput(midGameCity, MID_GAME_POLICY);
    }, 0);
    return provinceIncome + MID_TIER_HOLDINGS_GOLD;
  }

  function buildHostileTerritoryArmy(): Army {
    const units: ArmyUnit[] = Array.from({ length: 10 }, (_, i) => ({
      id: `econ-unit-${i}`, unitClass: 'legionary', strength: 80, veterancy: 'trained', loyalty: 50,
      elephantSteady: false, homeRegion: 'latium', raisedBy: 'state', raisedSeason: 1,
      campaignsSurvived: 0, wonCrushingVictory: false,
    }));
    return {
      id: 'econ-test-army', name: 'Legio Test', owner: 'player', commanderId: null,
      location: 'africa', stationedCityId: null, units,
      stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    };
  }

  function buildAfricaHostileTheatre(): TheatreState {
    const controllers = {} as TheatreState['controllers'];
    const contested = {} as TheatreState['contested'];
    const musteredThisYear = {} as TheatreState['musteredThisYear'];
    for (const region of REGIONS) {
      controllers[region.id] = region.startingController;
      contested[region.id] = 0;
      musteredThisYear[region.id] = 0;
    }
    controllers['africa'] = 'carthage'; // hostile territory, from Rome's perspective
    return { controllers, contested, musteredThisYear };
  }

  test('a 10-cohort army sustained in Carthage-controlled Africa costs 25-40% of typical mid-game season income', () => {
    const cities = buildInitialCityStates();
    const income = typicalMidGameDenariiIncome();
    const upkeep = upkeepFor(buildHostileTerritoryArmy(), buildAfricaHostileTheatre(), cities);
    const ratio = upkeep / income;
    expect(ratio).toBeGreaterThanOrEqual(0.25);
    expect(ratio).toBeLessThanOrEqual(0.4);
  });
});

// ─── Chunk C10 target #7: muster spread ──────────────────────────────────────
// "quality must be worth buying" — measured the only way that actually
// matters: a real headless tactical battle (M11's battleSim, the same
// harness abstractResolver.test.ts's own calibration suite uses) between a
// picked-tier army and an emergency-tier army bought for the SAME denarii
// budget from the SAME high-relationship region. Static armyStrength() sums
// were tried first and are too coarse a proxy here — the veterancy statMult
// spread (raw 0.85..veteran 1.15) can never outweigh a large cohort-count
// gap on its own, so the real test has to be an actual fight, not book math.
//
// Finding (recorded in the plan's tuning log): under the tiers' ORIGINAL
// seeds (emergency 15 / picked 45 — a 3x spread), picked lost 86% of equal-
// spend battles to emergency's sheer numbers. Confirmed-with-the-user fix:
// picked's cost dropped close to standard's (making "picked" a modestly-
// priced, quality-guaranteed muster rather than a 3x premium tier) and its
// baseVeterancy raised to a guaranteed 'veteran' (was a chance-based
// 'trained'). standard's price nudged down too, to keep the three tiers
// priced distinctly rather than colliding.
describe('Chunk C10 — Target #7: muster spread', () => {
  const NEUTRAL_TERRAIN = BALANCE.battle.terrains.coastal_plain;
  const HIGH_RELATIONSHIP = 85; // clears relationshipQualityBumpThreshold (70)
  const BUDGET = 300;

  function costFor(tier: 'picked' | 'emergency', relationship: number): number {
    const m = BALANCE.campaign.muster;
    const discount = relationship * m.relationshipCostDiscountFactor;
    return Math.round(m.tiers[tier].costPerCohort * (1 - discount));
  }

  function armyToBattleUnits(units: ArmyUnit[]): BattleUnit[] {
    return units.map(u => ({
      id: u.id, unitClass: u.unitClass, strength: u.strength,
      veterancy: u.veterancy, loyalty: u.loyalty, elephantSteady: u.elephantSteady,
    }));
  }

  function buildMusteredArmy(tier: 'picked' | 'emergency', relationship: number, budget: number, seed: number): BattleUnit[] {
    const cohorts = Math.floor(budget / costFor(tier, relationship));
    const rng = makeSeededRng(seed);
    const units = Array.from({ length: cohorts }, (_, i) =>
      rollMusteredUnit(tier, 'latium', relationship, 1, `${tier}-${i}`, rng),
    );
    return armyToBattleUnits(units);
  }

  test('a picked-tier army measurably outperforms an emergency-tier army of equal spend, from a high-relationship region', () => {
    const profile = ENEMY_GENERALS.xanthippus_drillmaster;
    const configPicked: BattleSimConfig = {
      label: 'picked', generalProfile: profile,
      army: buildMusteredArmy('picked', HIGH_RELATIONSHIP, BUDGET, 101),
    };
    const configEmergency: BattleSimConfig = {
      label: 'emergency', generalProfile: profile,
      army: buildMusteredArmy('emergency', HIGH_RELATIONSHIP, BUDGET, 202),
    };
    const result = simulateBattles(configPicked, configEmergency, 300, true, NEUTRAL_TERRAIN, 5001);
    expect(result.attackerWinRate).toBeGreaterThan(result.defenderWinRate);
    expect(result.attackerWinRate).toBeGreaterThanOrEqual(0.5);
  });
});
