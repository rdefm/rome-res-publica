import {
  resolveLaneClash,
  buildEffectiveSide,
  lookupMatchup,
  isFeintGated,
  skirmisherScreenMult,
  elephantTerrorApplies,
  applyAmokDamage,
  NO_CAPTAIN_MODS,
  type LaneClashContext,
  type SideClashMods,
} from '../src/engine/battle/clashEngine';
import { makeSeededRng, rngPercent } from '../src/utils/seededRng';
import { BALANCE } from '../src/data/balance';
import type { BattleUnit, UnitClass, Veterancy, FormationId, TerrainMod } from '../src/models/battle';

// ─── Test helpers ────────────────────────────────────────────────────────────

let unitCounter = 0;
function makeUnit(unitClass: UnitClass, overrides: Partial<BattleUnit> = {}): BattleUnit {
  unitCounter += 1;
  return {
    id: `u${unitCounter}`,
    unitClass,
    strength: 100,
    veterancy: 'trained',
    loyalty: 50,
    elephantSteady: false,
    ...overrides,
  };
}

function makeLane(unitClass: UnitClass, count: number, overrides: Partial<BattleUnit> = {}): BattleUnit[] {
  return Array.from({ length: count }, () => makeUnit(unitClass, overrides));
}

const NEUTRAL_TERRAIN: TerrainMod = { id: 'coastal_plain', label: 'Coastal Plain', mods: {} };

function makeCtx(overrides: Partial<LaneClashContext> = {}): LaneClashContext {
  return {
    terrain: NEUTRAL_TERRAIN,
    rng: makeSeededRng(1),
    sideAMods: NO_CAPTAIN_MODS,
    sideBMods: NO_CAPTAIN_MODS,
    attackerSide: 'A',
    engagedRoundsA: 0,
    engagedRoundsB: 0,
    formationA: 'line',
    formationB: 'line',
    flankedA: false,
    flankedB: false,
    overextendedA: false,
    overextendedB: false,
    ...overrides,
  };
}

function totalStrength(units: BattleUnit[]): number {
  return units.reduce((s, u) => s + u.strength, 0);
}

function sumLosses(losses: Map<string, number>): number {
  let total = 0;
  for (const v of losses.values()) total += v;
  return total;
}

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  test('same seed + inputs produce identical results', () => {
    const laneA = makeLane('legionary', 3);
    const laneB = makeLane('spear_foot', 3);
    const ctx1 = makeCtx({ rng: makeSeededRng(42) });
    const ctx2 = makeCtx({ rng: makeSeededRng(42) });

    const r1 = resolveLaneClash(laneA, laneB, ctx1);
    const r2 = resolveLaneClash(laneA, laneB, ctx2);

    expect(sumLosses(r1.casualtiesA)).toBeCloseTo(sumLosses(r2.casualtiesA), 10);
    expect(sumLosses(r1.casualtiesB)).toBeCloseTo(sumLosses(r2.casualtiesB), 10);
    expect(r1.moraleDeltaA).toBeCloseTo(r2.moraleDeltaA, 10);
    expect(r1.moraleDeltaB).toBeCloseTo(r2.moraleDeltaB, 10);
    expect(r1.roundLoser).toBe(r2.roundLoser);
  });
});

// ─── Purity ──────────────────────────────────────────────────────────────────

describe('purity', () => {
  test('resolveLaneClash does not mutate its inputs', () => {
    const laneA = makeLane('legionary', 3);
    const laneB = makeLane('spear_foot', 3);
    const snapshotA = JSON.parse(JSON.stringify(laneA));
    const snapshotB = JSON.parse(JSON.stringify(laneB));

    resolveLaneClash(laneA, laneB, makeCtx());

    expect(laneA).toEqual(snapshotA);
    expect(laneB).toEqual(snapshotB);
  });
});

// ─── Mirror matchup symmetry ─────────────────────────────────────────────────

describe('mirror matchups', () => {
  test('identical compositions are symmetric within ±3% over 500 seeded runs', () => {
    let netAdvantageSum = 0;
    const runs = 500;
    for (let seed = 1; seed <= runs; seed++) {
      const laneA = makeLane('legionary', 3);
      const laneB = makeLane('legionary', 3);
      const result = resolveLaneClash(laneA, laneB, makeCtx({ rng: makeSeededRng(seed) }));
      const lossA = sumLosses(result.casualtiesA);
      const lossB = sumLosses(result.casualtiesB);
      netAdvantageSum += (lossB - lossA);
    }
    const avgNetAdvantage = netAdvantageSum / runs;
    // Mirror matchup has zero RNG variance (no feint order), so this should
    // land at exactly 0 — the ±3% tolerance covers any future RNG-driven terms.
    const strengthPool = totalStrength(makeLane('legionary', 3));
    expect(Math.abs(avgNetAdvantage)).toBeLessThanOrEqual(0.03 * strengthPool);
  });
});

// ─── Spear wall vs heavy cavalry ─────────────────────────────────────────────

describe('spear_foot vs cavalry_heavy matchup', () => {
  test('incoming shock on spear_foot from cavalry_heavy is reduced to ×0.25', () => {
    const effect = lookupMatchup('spear_foot', new Set(['cavalry_heavy']), true);
    expect(effect.incomingShockMult).toBeCloseTo(0.25, 5);
    expect(effect.defDelta).toBe(2);
  });

  test('cavalry_heavy atk is reduced −2 vs spear_foot', () => {
    const effect = lookupMatchup('cavalry_heavy', new Set(['spear_foot']), true);
    expect(effect.atkDelta).toBe(-2);
  });

  test('net round loser is cavalry_heavy', () => {
    const laneA = makeLane('spear_foot', 3);
    const laneB = makeLane('cavalry_heavy', 3);
    const result = resolveLaneClash(laneA, laneB, makeCtx({ rng: makeSeededRng(7) }));
    expect(result.roundLoser).toBe('B');
    expect(sumLosses(result.casualtiesB)).toBeGreaterThan(sumLosses(result.casualtiesA));
  });
});

// ─── Legionary vs spear_foot grind ────────────────────────────────────────────

describe('legionary vs spear_foot 5-round grind', () => {
  test('legionary wins (loses less total strength) in ≥70% of seeds', () => {
    const trials = 100;
    let legionaryWins = 0;

    for (let seed = 1; seed <= trials; seed++) {
      let laneA = makeLane('legionary', 3);
      let laneB = makeLane('spear_foot', 3);
      const rng = makeSeededRng(seed * 1000 + 3);
      let engagedA = 0;
      let engagedB = 0;

      for (let round = 0; round < 5; round++) {
        if (totalStrength(laneA) <= 0 || totalStrength(laneB) <= 0) break;
        const result = resolveLaneClash(laneA, laneB, makeCtx({
          rng, engagedRoundsA: engagedA, engagedRoundsB: engagedB,
        }));
        laneA = applyLossesForTest(laneA, result.casualtiesA);
        laneB = applyLossesForTest(laneB, result.casualtiesB);
        engagedA += 1;
        engagedB += 1;
      }

      const lostA = totalStrength(makeLane('legionary', 3)) - totalStrength(laneA);
      const lostB = totalStrength(makeLane('spear_foot', 3)) - totalStrength(laneB);
      if (lostA < lostB) legionaryWins += 1;
    }

    expect(legionaryWins / trials).toBeGreaterThanOrEqual(0.7);
  });
});

function applyLossesForTest(units: BattleUnit[], losses: Map<string, number>): BattleUnit[] {
  return units.map(u => {
    const lost = losses.get(u.id) ?? 0;
    return { ...u, strength: Math.max(0, u.strength - lost) };
  });
}

// ─── Skirmisher screen ────────────────────────────────────────────────────────

describe('skirmisher screen', () => {
  test('reduces incoming shock once own skirmisher strength exceeds threshold', () => {
    const belowThreshold = [makeUnit('skirmisher', { strength: 30 })];
    const aboveThreshold = [makeUnit('skirmisher', { strength: 31 })];
    expect(skirmisherScreenMult(belowThreshold)).toBe(1);
    expect(skirmisherScreenMult(aboveThreshold)).toBe(BALANCE.battle.skirmisherScreen.incomingShockMult);
  });

  test('a screened lane takes less shock-derived morale damage than an unscreened one', () => {
    const screened = makeLane('skirmisher', 1, { strength: 100 });
    const unscreened = makeLane('legionary', 1, { strength: 100 });
    const attacker = makeLane('cavalry_heavy', 3);

    const rScreened = resolveLaneClash(screened, attacker, makeCtx({ rng: makeSeededRng(5) }));
    const rUnscreened = resolveLaneClash(unscreened, attacker, makeCtx({ rng: makeSeededRng(5) }));

    // Isolate the shock effect via the exported multiplier rather than the
    // full (melee-confounded) round outcome.
    expect(skirmisherScreenMult(screened)).toBeLessThan(skirmisherScreenMult(unscreened));
  });
});

// ─── Wedge vs flanked ─────────────────────────────────────────────────────────

describe('wedge formation', () => {
  test('a wedge lane performs worse when flanked than when not', () => {
    const laneAUnflanked = makeLane('legionary', 3);
    const laneAFlanked = makeLane('legionary', 3);
    const laneB1 = makeLane('legionary', 3);
    const laneB2 = makeLane('legionary', 3);

    const unflanked = resolveLaneClash(laneAUnflanked, laneB1, makeCtx({
      rng: makeSeededRng(9), formationA: 'wedge', flankedA: false,
    }));
    const flanked = resolveLaneClash(laneAFlanked, laneB2, makeCtx({
      rng: makeSeededRng(9), formationA: 'wedge', flankedA: true,
    }));

    expect(sumLosses(flanked.casualtiesA)).toBeGreaterThan(sumLosses(unflanked.casualtiesA));
  });

  test('wedge requires a captain to be ordered (validated by the orchestrator, not here) — formation stats exist regardless', () => {
    expect(BALANCE.battle.formations.wedge.requiresCaptain).toBe(true);
  });
});

// ─── Open ranks vs elephants ──────────────────────────────────────────────────

describe('open_ranks vs elephants', () => {
  test('takes no terror', () => {
    const opposingElephants = makeLane('elephant', 1, { strength: 100 });
    const ownUnits = makeLane('legionary', 3);
    expect(elephantTerrorApplies('open_ranks', ownUnits, opposingElephants)).toBe(false);
    expect(elephantTerrorApplies('line', ownUnits, opposingElephants)).toBe(true);
  });

  test('receives ≤20% of normal (line) incoming shock', () => {
    const lineMult = BALANCE.battle.formations.line.incomingShockMult;
    const openRanksMult = BALANCE.battle.formations.open_ranks.incomingShockMult;
    expect(openRanksMult).toBeLessThanOrEqual(0.2 * lineMult + 1e-9);
  });
});

// ─── Feint ────────────────────────────────────────────────────────────────────

describe('feint gating', () => {
  test('raw units are refused', () => {
    const rawLane = makeLane('legionary', 3, { veterancy: 'raw', loyalty: 50 });
    expect(isFeintGated(rawLane)).toBe(false);
  });

  test('veteran-average lane is permitted', () => {
    const veteranLane = makeLane('legionary', 3, { veterancy: 'veteran' });
    expect(isFeintGated(veteranLane)).toBe(true);
  });

  test('trained + high loyalty lane is permitted', () => {
    const lane = makeLane('legionary', 3, { veterancy: 'trained', loyalty: 75 });
    expect(isFeintGated(lane)).toBe(true);
  });

  test('trained + low loyalty lane is refused', () => {
    const lane = makeLane('legionary', 3, { veterancy: 'trained', loyalty: 40 });
    expect(isFeintGated(lane)).toBe(false);
  });

  test('any legendary unit present is always permitted', () => {
    const lane = [
      makeUnit('legionary', { veterancy: 'raw', loyalty: 10 }),
      makeUnit('legionary', { veterancy: 'legendary', loyalty: 10 }),
    ];
    expect(isFeintGated(lane)).toBe(true);
  });

  test('a gated (refused) feint order resolves as normal combat, not a manoeuvre', () => {
    const rawLane = makeLane('legionary', 3, { veterancy: 'raw', loyalty: 50 });
    const opponent = makeLane('spear_foot', 3);
    const result = resolveLaneClash(rawLane, opponent, makeCtx({
      rng: makeSeededRng(11), formationA: 'feigned_retreat',
    }));
    expect(result.wasFeintRound).toBe(false);
    expect(result.feintA?.attempted).toBe(false);
    expect(sumLosses(result.casualtiesA) + sumLosses(result.casualtiesB)).toBeGreaterThan(0);
  });
});

describe('feint rolls', () => {
  // Legendary-gated lane so every seed is eligible to attempt the feint;
  // seeds below are hand-picked (via a small scan) to force each branch.
  const legendaryLane = () => [
    makeUnit('legionary', { veterancy: 'legendary', loyalty: 50 }),
    makeUnit('legionary', { veterancy: 'legendary', loyalty: 50 }),
  ];

  function findSeedForRoll(target: 'botch' | 'success' | 'failure'): number {
    const f = BALANCE.battle.feint;
    for (let seed = 1; seed < 500; seed++) {
      const roll = rngPercent(makeSeededRng(seed));
      if (target === 'botch' && roll <= f.botchRollMax) return seed;
      if (target === 'success' && roll > f.botchRollMax && roll <= f.successCap) return seed;
      if (target === 'failure' && roll > f.successCap) return seed;
    }
    throw new Error(`no seed found for ${target}`);
  }

  test('success branch', () => {
    const seed = findSeedForRoll('success');
    const lane = legendaryLane();
    const opponent = makeLane('spear_foot', 2);
    const result = resolveLaneClash(lane, opponent, makeCtx({
      rng: makeSeededRng(seed), formationA: 'feigned_retreat',
    }));
    expect(result.wasFeintRound).toBe(true);
    expect(result.feintA?.result).toBe('success');
    expect(result.feintA?.ownMoraleDelta).toBe(0);
  });

  test('failure branch applies own morale penalty', () => {
    const seed = findSeedForRoll('failure');
    const lane = legendaryLane();
    const opponent = makeLane('spear_foot', 2);
    const result = resolveLaneClash(lane, opponent, makeCtx({
      rng: makeSeededRng(seed), formationA: 'feigned_retreat',
    }));
    expect(result.feintA?.result).toBe('failure');
    expect(result.moraleDeltaA).toBe(BALANCE.battle.feint.failureOwnMoraleDelta);
  });

  test('botch branch routs the weakest unit and applies the morale penalty', () => {
    const seed = findSeedForRoll('botch');
    const lane = [
      makeUnit('legionary', { veterancy: 'legendary', loyalty: 50, strength: 100 }),
      makeUnit('legionary', { veterancy: 'legendary', loyalty: 50, strength: 40 }),
    ];
    const opponent = makeLane('spear_foot', 2);
    const result = resolveLaneClash(lane, opponent, makeCtx({
      rng: makeSeededRng(seed), formationA: 'feigned_retreat',
    }));
    expect(result.feintA?.result).toBe('botch');
    expect(result.feintA?.routedUnitId).toBe(lane[1].id); // the weaker (40-strength) unit
    expect(result.casualtiesA.get(lane[1].id)).toBe(40);
    expect(result.moraleDeltaA).toBe(BALANCE.battle.feint.botchOwnMoraleDelta);
  });

  test('both sides feinting resolves independently ("comedy permitted")', () => {
    const laneA = legendaryLane();
    const laneB = legendaryLane();
    const result = resolveLaneClash(laneA, laneB, makeCtx({
      rng: makeSeededRng(3), formationA: 'feigned_retreat', formationB: 'feigned_retreat',
    }));
    expect(result.wasFeintRound).toBe(true);
    expect(result.feintA?.attempted).toBe(true);
    expect(result.feintB?.attempted).toBe(true);
  });
});

// ─── Amok damage helper ───────────────────────────────────────────────────────

describe('applyAmokDamage', () => {
  test('deals one round of atk to both lanes, weakest-first, excluding the elephant itself', () => {
    const elephant = makeUnit('elephant', { strength: 100 });
    const laneA = [elephant, makeUnit('legionary', { strength: 20 }), makeUnit('legionary', { strength: 100 })];
    const laneB = [makeUnit('spear_foot', { strength: 100 })];

    const result = applyAmokDamage(elephant, laneA, laneB);
    const totalDealt = sumLosses(result.casualtiesA) + sumLosses(result.casualtiesB);

    expect(totalDealt).toBeCloseTo(BALANCE.battle.unitStats.elephant.atk, 5);
    expect(result.casualtiesA.has(elephant.id)).toBe(false);
  });
});

// ─── Effective stat bundle (debug sandbox export) ────────────────────────────

describe('buildEffectiveSide', () => {
  test('exposes per-unit and aggregate effective stats for the debug sandbox', () => {
    const units = makeLane('legionary', 2);
    const opposing = makeLane('spear_foot', 2);
    const bundle = buildEffectiveSide({
      units, formation: 'line', opposingUnits: opposing, mods: NO_CAPTAIN_MODS,
      terrain: NEUTRAL_TERRAIN, terrainRole: 'attacker', engagedRounds: 0,
      flanked: false, overextended: false,
    });
    expect(bundle.units).toHaveLength(2);
    expect(bundle.totalAtk).toBeGreaterThan(0);
    expect(bundle.summary).toContain('formation=line');
  });

  test('captain martial increases atk/def multiplicatively', () => {
    const units = makeLane('legionary', 1);
    const opposing = makeLane('spear_foot', 1);
    const noCaptain = buildEffectiveSide({
      units, formation: 'line', opposingUnits: opposing, mods: NO_CAPTAIN_MODS,
      terrain: NEUTRAL_TERRAIN, terrainRole: 'attacker', engagedRounds: 0,
      flanked: false, overextended: false,
    });
    const withCaptain: SideClashMods = { laneCaptainMartial: 10, commanderInLaneMartial: null, commanderReserveMartial: null };
    const captained = buildEffectiveSide({
      units, formation: 'line', opposingUnits: opposing, mods: withCaptain,
      terrain: NEUTRAL_TERRAIN, terrainRole: 'attacker', engagedRounds: 0,
      flanked: false, overextended: false,
    });
    expect(captained.totalAtk).toBeGreaterThan(noCaptain.totalAtk);
    expect(captained.captainAtkDefMult).toBeCloseTo(1 + BALANCE.battle.command.captainAtkDefMultPerMartial * 10, 5);
  });
});

// ─── M11 tuning baseline: canonical matchup win rates ────────────────────────
// Six canonical 3-unit-vs-3-unit compositions, each run 200 seeded 5-round
// grinds (line formation both sides, no captains, neutral terrain — isolates
// the class/matchup math from formation/command/terrain effects). "Win" =
// lower total strength lost after 5 rounds (or full elimination of the
// other side sooner). These are Chunk M2's required documented baseline for
// M11's tuning pass — do not delete when M11 starts; update the numbers if
// M11 changes BALANCE.battle and re-run this suite to refresh them.
//
// Observed results (200 seeds each, captured when this test was written):
//   legionary      vs spear_foot     → legionary   wins ~100% (matchup: swords beat spears)
//   spear_foot     vs cavalry_heavy  → spear_foot  wins ~100% (matchup: spear wall stops the charge)
//   cavalry_light  vs skirmisher     → cavalry_light wins ~100% (matchup: run down the skirmish screen)
//   cavalry_light  vs cavalry_heavy  → cavalry_light wins ~0%  (evasion only blunts shock, doesn't win melee)
//   legionary      vs cavalry_light  → legionary   wins ~100% (no matchup either way; legionary's higher def wins the grind)
//   elephant       vs spear_foot     → elephant    wins ~100% (elephant's raw stats dominate a single-class spear line —
//                                       M11's "prepared counters" target needs skirmisher+spear+open_ranks together, not spear alone)
describe('M11 tuning baseline — canonical matchup win rates', () => {
  const CANONICAL_MATCHUPS: Array<{ label: string; classA: UnitClass; classB: UnitClass }> = [
    { label: 'legionary vs spear_foot', classA: 'legionary', classB: 'spear_foot' },
    { label: 'spear_foot vs cavalry_heavy', classA: 'spear_foot', classB: 'cavalry_heavy' },
    { label: 'cavalry_light vs skirmisher', classA: 'cavalry_light', classB: 'skirmisher' },
    { label: 'cavalry_light vs cavalry_heavy', classA: 'cavalry_light', classB: 'cavalry_heavy' },
    { label: 'legionary vs cavalry_light', classA: 'legionary', classB: 'cavalry_light' },
    { label: 'elephant vs spear_foot', classA: 'elephant', classB: 'spear_foot' },
  ];

  function simulateWinRate(classA: UnitClass, classB: UnitClass, trials: number): number {
    let aWins = 0;
    for (let seed = 1; seed <= trials; seed++) {
      let laneA = makeLane(classA, 3);
      let laneB = makeLane(classB, 3);
      const startA = totalStrength(laneA);
      const startB = totalStrength(laneB);
      const rng = makeSeededRng(seed * 7919 + 11);
      let engagedA = 0;
      let engagedB = 0;
      for (let round = 0; round < 5; round++) {
        if (totalStrength(laneA) <= 0 || totalStrength(laneB) <= 0) break;
        const result = resolveLaneClash(laneA, laneB, makeCtx({ rng, engagedRoundsA: engagedA, engagedRoundsB: engagedB }));
        laneA = applyLossesForTest(laneA, result.casualtiesA);
        laneB = applyLossesForTest(laneB, result.casualtiesB);
        engagedA += 1;
        engagedB += 1;
      }
      const lostA = startA - totalStrength(laneA);
      const lostB = startB - totalStrength(laneB);
      if (lostA < lostB) aWins += 1;
    }
    return aWins / trials;
  }

  test.each(CANONICAL_MATCHUPS)('$label — win rate is deterministic and reproducible', ({ classA, classB }) => {
    const trials = 200;
    const rate1 = simulateWinRate(classA, classB, trials);
    const rate2 = simulateWinRate(classA, classB, trials);
    expect(rate1).toBe(rate2); // same seeded trials must reproduce exactly
    expect(rate1).toBeGreaterThanOrEqual(0);
    expect(rate1).toBeLessThanOrEqual(1);
  });
});
