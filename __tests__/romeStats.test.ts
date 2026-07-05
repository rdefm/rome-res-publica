import { calcRomeStatModifiers } from '../src/engine/resourceEngine';
import {
  applyTrackDelta,
  calcCascadeDeltas,
  getCrisisStatusEffects,
  checkMilitaryBillPressure,
  calcIndividualEscalation,
} from '../src/engine/crisisEngine';
import { getTierFromLevel } from '../src/models/crisis';
import type { CrisisState, CrisisTrack } from '../src/models/crisis';
import { calcRomeStatVoteModifier, buildRepealBill } from '../src/data/billTemplates';
import type { Bill, ActiveLaw } from '../src/models/bill';

// ─── calcRomeStatModifiers ────────────────────────────────────────────────────

describe('calcRomeStatModifiers — stability bands', () => {
  test('0–19 Instability: fides −2, multiplier 1.5', () => {
    const m = calcRomeStatModifiers({ stability: 10, plebs: 50, treasury: 50 });
    expect(m.fidesDelta).toBe(-2);
    expect(m.crisisEscalationMultiplier).toBe(1.5);
    expect(m.stabilityLabel).toBe('Instability');
  });
  test('20–39 Fragile: fides −1, multiplier 1.25', () => {
    const m = calcRomeStatModifiers({ stability: 30, plebs: 50, treasury: 50 });
    expect(m.fidesDelta).toBe(-1);
    expect(m.crisisEscalationMultiplier).toBe(1.25);
    expect(m.stabilityLabel).toBe('Fragile');
  });
  test('40–69 Stable: no modifier', () => {
    const m = calcRomeStatModifiers({ stability: 55, plebs: 50, treasury: 50 });
    expect(m.fidesDelta).toBe(0);
    expect(m.crisisEscalationMultiplier).toBe(1.0);
    expect(m.stabilityLabel).toBe('Stable');
  });
  test('70–84 Cohesive: fides +1', () => {
    const m = calcRomeStatModifiers({ stability: 75, plebs: 50, treasury: 50 });
    expect(m.fidesDelta).toBe(1);
    expect(m.stabilityLabel).toBe('Cohesive');
  });
  test('85–100 Pax Interna: fides +2, multiplier 0.85', () => {
    const m = calcRomeStatModifiers({ stability: 90, plebs: 50, treasury: 50 });
    expect(m.fidesDelta).toBe(2);
    expect(m.crisisEscalationMultiplier).toBe(0.85);
    expect(m.stabilityLabel).toBe('Pax Interna');
  });
});

describe('calcRomeStatModifiers — plebs bands', () => {
  test('0–19 Rioting: fides −3, crisis +3, label Rioting', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 10, treasury: 50 });
    expect(m.fidesDelta).toBe(-3);
    expect(m.plebsCrisisBonus).toBe(3);
    expect(m.plebsLabel).toBe('Rioting');
  });
  test('20–39 Restless: fides −1', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 30, treasury: 50 });
    expect(m.fidesDelta).toBe(-1);
    expect(m.plebsLabel).toBe('Restless');
  });
  test('40–69 Content: no modifier', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 55, treasury: 50 });
    expect(m.fidesDelta).toBe(0);
    expect(m.plebsCrisisBonus).toBe(0);
    expect(m.plebsLabel).toBe('Content');
  });
  test('70–84 Supportive: fides +1', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 75, treasury: 50 });
    expect(m.fidesDelta).toBe(1);
    expect(m.plebsLabel).toBe('Supportive');
  });
  test('85–100 Euphoric: fides +2, patron call-ins waived', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 90, treasury: 50 });
    expect(m.fidesDelta).toBe(2);
    expect(m.patronFavourWaived).toBe(true);
    expect(m.plebsLabel).toBe('Euphoric');
  });
});

describe('calcRomeStatModifiers — combined stability + plebs', () => {
  test('fidesDelta sums stability and plebs contributions together', () => {
    const m = calcRomeStatModifiers({ stability: 90, plebs: 90, treasury: 50 });
    expect(m.fidesDelta).toBe(4);
  });
  test('opposing contributions partially cancel', () => {
    const m = calcRomeStatModifiers({ stability: 10, plebs: 90, treasury: 50 });
    expect(m.fidesDelta).toBe(0);
  });
});

describe('calcRomeStatModifiers — treasury bands', () => {
  test('0–9 Bankrupt: denarii −3, label Bankrupt', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 50, treasury: 5 });
    expect(m.denariDelta).toBe(-3);
    expect(m.treasuryLabel).toBe('Bankrupt');
  });
  test('10–24 Depleted: denarii −1', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 50, treasury: 15 });
    expect(m.denariDelta).toBe(-1);
    expect(m.treasuryLabel).toBe('Depleted');
  });
  test('25–64 Adequate: no modifier', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 50, treasury: 50 });
    expect(m.denariDelta).toBe(0);
    expect(m.crisisAbsorption).toBe(0);
    expect(m.treasuryLabel).toBe('Adequate');
  });
  test('65–84 Flush: absorbs 1 crisis/season', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 50, treasury: 70 });
    expect(m.crisisAbsorption).toBe(1);
    expect(m.treasuryLabel).toBe('Flush');
  });
  test('85–100 Overflowing: absorbs 2 crisis/season', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 50, treasury: 90 });
    expect(m.crisisAbsorption).toBe(2);
    expect(m.treasuryLabel).toBe('Overflowing');
  });
});

// ─── Four-track crisis engine (replaces old calcCrisisEscalation tests) ───────

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeTrack(id: CrisisTrack['id'], level: number): CrisisTrack {
  return { id, level, tier: getTierFromLevel(level), namedCrisis: null };
}

function makeCrisisState(overrides: Partial<Record<string, number>> = {}): CrisisState {
  return {
    war:          makeTrack('war',          overrides.war          ?? 10),
    unrest:       makeTrack('unrest',       overrides.unrest       ?? 10),
    constitution: makeTrack('constitution', overrides.constitution ?? 10),
    economy:      makeTrack('economy',      overrides.economy      ?? 10),
  };
}

// Minimal GameState shape for calcIndividualEscalation
function makeMinimalState(overrides: Record<string, any> = {}): any {
  return {
    rome: { stability: 50, plebs: 50, treasury: 50 },
    crisis: makeCrisisState(),
    provinces: [],
    clients: [],
    clans: [],
    flags: {},
    npcConsul: null,
    optimatesRel: 0,
    popularesRel: 0,
    ...overrides,
  };
}

// ── getTierFromLevel ────────────────────────────────────────────────────────────

describe('getTierFromLevel', () => {
  test('0–19 → tier 0', () => {
    expect(getTierFromLevel(0)).toBe(0);
    expect(getTierFromLevel(19)).toBe(0);
  });
  test('20–39 → tier 1', () => {
    expect(getTierFromLevel(20)).toBe(1);
    expect(getTierFromLevel(39)).toBe(1);
  });
  test('40–59 → tier 2', () => {
    expect(getTierFromLevel(40)).toBe(2);
    expect(getTierFromLevel(59)).toBe(2);
  });
  test('60–79 → tier 3', () => {
    expect(getTierFromLevel(60)).toBe(3);
    expect(getTierFromLevel(79)).toBe(3);
  });
  test('80–100 → tier 4', () => {
    expect(getTierFromLevel(80)).toBe(4);
    expect(getTierFromLevel(100)).toBe(4);
  });
});

// ── applyTrackDelta ─────────────────────────────────────────────────────────────

describe('applyTrackDelta', () => {
  test('applies positive delta and recomputes tier', () => {
    const track = makeTrack('war', 15);
    const result = applyTrackDelta(track, 10);
    expect(result.level).toBe(25);
    expect(result.tier).toBe(1);
  });

  test('applies negative delta and recomputes tier', () => {
    const track = makeTrack('war', 45);
    const result = applyTrackDelta(track, -10);
    expect(result.level).toBe(35);
    expect(result.tier).toBe(1);
  });

  test('clamps to 0 when delta would go negative', () => {
    const track = makeTrack('war', 5);
    const result = applyTrackDelta(track, -20);
    expect(result.level).toBe(0);
    expect(result.tier).toBe(0);
  });

  test('clamps to 100 when delta would exceed maximum', () => {
    const track = makeTrack('war', 95);
    const result = applyTrackDelta(track, 20);
    expect(result.level).toBe(100);
    expect(result.tier).toBe(4);
  });

  test('does not mutate the input track', () => {
    const track = makeTrack('war', 30);
    applyTrackDelta(track, 15);
    expect(track.level).toBe(30);
  });

  test('returns correct tier at tier boundary', () => {
    const track = makeTrack('war', 39);
    const result = applyTrackDelta(track, 1); // 40 → tier 2
    expect(result.tier).toBe(2);
  });
});

// ── calcCascadeDeltas ───────────────────────────────────────────────────────────

describe('calcCascadeDeltas', () => {
  test('no cascades when all tracks below 60', () => {
    const crisis = makeCrisisState({ war: 50, unrest: 50, constitution: 50, economy: 50 });
    const deltas = calcCascadeDeltas(crisis);
    expect(deltas.war).toBe(0);
    expect(deltas.unrest).toBe(0);
    expect(deltas.constitution).toBe(0);
    expect(deltas.economy).toBe(0);
  });

  test('constitution ≥ 60 → War +2', () => {
    const crisis = makeCrisisState({ war: 10, constitution: 65 });
    const deltas = calcCascadeDeltas(crisis);
    expect(deltas.war).toBe(2);
    expect(deltas.unrest).toBe(0);
    expect(deltas.constitution).toBe(0);
  });

  test('war ≥ 60 AND constitution ≥ 60 → War +4 total (constitution +2, compound +2)', () => {
    const crisis = makeCrisisState({ war: 65, constitution: 65 });
    const deltas = calcCascadeDeltas(crisis);
    expect(deltas.war).toBe(4);
  });

  test('economy ≥ 60 → Unrest +2', () => {
    const crisis = makeCrisisState({ economy: 65 });
    const deltas = calcCascadeDeltas(crisis);
    expect(deltas.unrest).toBe(2);
    expect(deltas.war).toBe(0);
  });

  test('unrest ≥ 60 → Constitution +2', () => {
    const crisis = makeCrisisState({ unrest: 65 });
    const deltas = calcCascadeDeltas(crisis);
    expect(deltas.constitution).toBe(2);
    expect(deltas.war).toBe(0);
  });

  test('multiple cascades stack correctly', () => {
    // economy 65 → unrest +2; unrest 65 → constitution +2; constitution 65 → war +2
    const crisis = makeCrisisState({ war: 10, unrest: 65, constitution: 65, economy: 65 });
    const deltas = calcCascadeDeltas(crisis);
    // constitution ≥ 60 → war +2; war NOT ≥ 60 so no compound
    expect(deltas.war).toBe(2);
    // economy ≥ 60 → unrest +2
    expect(deltas.unrest).toBe(2);
    // unrest ≥ 60 → constitution +2
    expect(deltas.constitution).toBe(2);
  });

  test('cascade threshold is strictly ≥ 60 — 59 does not trigger', () => {
    const crisis = makeCrisisState({ constitution: 59 });
    const deltas = calcCascadeDeltas(crisis);
    expect(deltas.war).toBe(0);
  });
});

// ── getCrisisStatusEffects ──────────────────────────────────────────────────────

describe('getCrisisStatusEffects', () => {
  test('returns exactly 4 effects', () => {
    const effects = getCrisisStatusEffects(makeCrisisState());
    expect(effects).toHaveLength(4);
  });

  test('all four track IDs are represented', () => {
    const effects = getCrisisStatusEffects(makeCrisisState());
    const ids = effects.map(e => e.trackId).sort();
    expect(ids).toEqual(['constitution', 'economy', 'unrest', 'war']);
  });

  test('War tier 0: no Fides/Denarii penalty, no special effect', () => {
    const crisis = makeCrisisState({ war: 10 });
    const effect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'war')!;
    expect(effect.tier).toBe(0);
    expect(effect.fidesDelta).toBe(0);
    expect(effect.denariDelta).toBe(0);
    expect(effect.specialEffect).toBeUndefined();
  });

  test('War tier 2 (40–59): Fides −2, special war-military-bill-pressure', () => {
    const crisis = makeCrisisState({ war: 50 });
    const effect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'war')!;
    expect(effect.tier).toBe(2);
    expect(effect.fidesDelta).toBe(-2);
    expect(effect.specialEffect).toBe('war-military-bill-pressure');
  });

  test('War tier 4 (80–100): Fides −5, Denarii −10, war-levy-discount', () => {
    const crisis = makeCrisisState({ war: 90 });
    const effect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'war')!;
    expect(effect.tier).toBe(4);
    expect(effect.fidesDelta).toBe(-5);
    expect(effect.denariDelta).toBe(-10);
    expect(effect.specialEffect).toBe('war-levy-discount');
  });

  test('Economy tier 2 (40–59): actionCostMultiplier 1.1', () => {
    const crisis = makeCrisisState({ economy: 50 });
    const effect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'economy')!;
    expect(effect.actionCostMultiplier).toBe(1.1);
  });

  test('Economy tier 4 (80–100): Fides −3, Denarii −12, multiplier 1.3', () => {
    const crisis = makeCrisisState({ economy: 85 });
    const effect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'economy')!;
    expect(effect.fidesDelta).toBe(-3);
    expect(effect.denariDelta).toBe(-12);
    expect(effect.actionCostMultiplier).toBe(1.3);
  });

  test('label matches tier table', () => {
    const crisis = makeCrisisState({ unrest: 65 });
    const effect = getCrisisStatusEffects(crisis).find(e => e.trackId === 'unrest')!;
    expect(effect.label).toBe('Street Violence');
  });
});

// ── checkMilitaryBillPressure ───────────────────────────────────────────────────

describe('checkMilitaryBillPressure', () => {
  test('returns 0 when War tier < 2 regardless of bills', () => {
    const crisis = makeCrisisState({ war: 10 }); // tier 0
    expect(checkMilitaryBillPressure(crisis, [])).toBe(0);
  });

  test('returns 0 when a military bill passed this season (tier 2)', () => {
    const crisis = makeCrisisState({ war: 50 }); // tier 2
    expect(checkMilitaryBillPressure(crisis, ['lex-militaria-auto-1234'])).toBe(0);
  });

  test('returns +5 at tier 2 with no military bill passed', () => {
    const crisis = makeCrisisState({ war: 50 }); // tier 2
    expect(checkMilitaryBillPressure(crisis, [])).toBe(5);
  });

  test('returns +8 at tier 3 with no military bill passed', () => {
    const crisis = makeCrisisState({ war: 65 }); // tier 3
    expect(checkMilitaryBillPressure(crisis, [])).toBe(8);
  });

  test('returns +8 at tier 4 with no military bill passed', () => {
    const crisis = makeCrisisState({ war: 90 }); // tier 4
    expect(checkMilitaryBillPressure(crisis, [])).toBe(8);
  });

  test('recognises war-related bill IDs', () => {
    const crisis = makeCrisisState({ war: 65 }); // tier 3
    // Should return 0 because a "war" bill passed
    expect(checkMilitaryBillPressure(crisis, ['senatus-consultum-de-bello'])).toBe(0);
    expect(checkMilitaryBillPressure(crisis, ['levy-supplemental-1'])).toBe(0);
  });

  test('non-military bills do not count', () => {
    const crisis = makeCrisisState({ war: 65 }); // tier 3
    expect(checkMilitaryBillPressure(crisis, ['lex-frumentaria', 'lex-agraria'])).toBe(8);
  });
});

// ── calcIndividualEscalation — Economy stagnation ──────────────────────────────

describe('calcIndividualEscalation — Economy track stagnation', () => {
  test('province with infraStagnationSeasons ≥ 12 adds +3 to Economy escalation', () => {
    const state = makeMinimalState({
      provinces: [
        {
          id: 'samnium', status: 'incorporated',
          infraStagnationSeasons: 12, lastInfraScore: 30,
          relationshipScore: 50,
          playerGovernor: null, npcRoleHolder: null,
        },
      ],
      rome: { stability: 50, plebs: 50, treasury: 50 },
    });
    const delta = calcIndividualEscalation('economy', state);
    // treasury 50 = no modifier; one stagnant province = +3
    expect(delta).toBeGreaterThanOrEqual(3);
  });

  test('province with infraStagnationSeasons < 12 does not trigger stagnation bonus', () => {
    const state = makeMinimalState({
      provinces: [
        {
          id: 'samnium', status: 'incorporated',
          infraStagnationSeasons: 8, lastInfraScore: 30,
          relationshipScore: 50,
          playerGovernor: null, npcRoleHolder: null,
        },
      ],
      rome: { stability: 50, plebs: 50, treasury: 50 },
    });
    const delta = calcIndividualEscalation('economy', state);
    // treasury 50 = no modifier; stagnation counter below threshold
    expect(delta).toBe(0);
  });

  test('multiple stagnant provinces stack additively', () => {
    const state = makeMinimalState({
      provinces: [
        { id: 'samnium',   status: 'incorporated', infraStagnationSeasons: 12, lastInfraScore: 30, relationshipScore: 50, playerGovernor: null, npcRoleHolder: null },
        { id: 'campania',  status: 'incorporated', infraStagnationSeasons: 15, lastInfraScore: 60, relationshipScore: 50, playerGovernor: null, npcRoleHolder: null },
      ],
      rome: { stability: 50, plebs: 50, treasury: 50 },
    });
    const delta = calcIndividualEscalation('economy', state);
    // Two stagnant provinces = +6
    expect(delta).toBeGreaterThanOrEqual(6);
  });

  test('heartland provinces never trigger stagnation', () => {
    const state = makeMinimalState({
      provinces: [
        { id: 'latium', status: 'heartland', infraStagnationSeasons: 20, lastInfraScore: 80, relationshipScore: 100, playerGovernor: null, npcRoleHolder: null },
      ],
      rome: { stability: 50, plebs: 50, treasury: 50 },
    });
    const delta = calcIndividualEscalation('economy', state);
    expect(delta).toBe(0);
  });
});

// ── calcIndividualEscalation — War track province pressure ─────────────────────

describe('calcIndividualEscalation — War track province pressure', () => {
  test('hostile province (rel < 15) adds +6 per season', () => {
    const state = makeMinimalState({
      provinces: [
        { id: 'samnium', status: 'incorporated', relationshipScore: 10, infraStagnationSeasons: 0, lastInfraScore: 30, playerGovernor: null, npcRoleHolder: null },
      ],
    });
    const delta = calcIndividualEscalation('war', state);
    expect(delta).toBeGreaterThanOrEqual(6);
  });

  test('restless province (rel 15–29) adds +3 per season', () => {
    const state = makeMinimalState({
      provinces: [
        { id: 'samnium', status: 'incorporated', relationshipScore: 20, infraStagnationSeasons: 0, lastInfraScore: 30, playerGovernor: null, npcRoleHolder: null },
      ],
    });
    const delta = calcIndividualEscalation('war', state);
    expect(delta).toBeGreaterThanOrEqual(3);
  });

  test('stable province (rel > 70) gives −2 per season', () => {
    const state = makeMinimalState({
      provinces: [
        { id: 'campania', status: 'incorporated', relationshipScore: 80, infraStagnationSeasons: 0, lastInfraScore: 60, playerGovernor: null, npcRoleHolder: null },
      ],
    });
    const delta = calcIndividualEscalation('war', state);
    expect(delta).toBe(-2);
  });

  test('heartland provinces do not contribute to war escalation', () => {
    const state = makeMinimalState({
      provinces: [
        { id: 'latium', status: 'heartland', relationshipScore: 0, infraStagnationSeasons: 0, lastInfraScore: 80, playerGovernor: null, npcRoleHolder: null },
      ],
    });
    const delta = calcIndividualEscalation('war', state);
    expect(delta).toBe(0);
  });
});

// ─── calcRomeStatVoteModifier ─────────────────────────────────────────────────

describe('calcRomeStatVoteModifier', () => {
  const baseRome = { stability: 50, plebs: 50, treasury: 50 };

  test('neutral bill at baseline rome: modifier 0', () => {
    const bill: Partial<Bill> = { type: 'neutral', passEffect: 'fides+3' };
    expect(calcRomeStatVoteModifier(bill as Bill, baseRome)).toBe(0);
  });

  test('populist bill at high plebs: positive modifier', () => {
    const bill: Partial<Bill> = { type: 'populist', passEffect: 'plebs+5' };
    const rome = { stability: 50, plebs: 80, treasury: 50 };
    const mod = calcRomeStatVoteModifier(bill as Bill, rome);
    expect(mod).toBeGreaterThan(0);
  });

  test('optimates bill at high plebs: negative modifier', () => {
    const bill: Partial<Bill> = { type: 'optimates', passEffect: 'fides+3' };
    const rome = { stability: 50, plebs: 80, treasury: 50 };
    const mod = calcRomeStatVoteModifier(bill as Bill, rome);
    expect(mod).toBeLessThan(0);
  });

  test('spending bill at bankrupt treasury: negative modifier', () => {
    const bill: Partial<Bill> = { type: 'economic', passEffect: 'treasury-10|stability+5' };
    const rome = { stability: 50, plebs: 50, treasury: 5 };
    const mod = calcRomeStatVoteModifier(bill as Bill, rome);
    expect(mod).toBeLessThan(0);
  });

  test('spending bill at overflowing treasury: positive modifier', () => {
    const bill: Partial<Bill> = { type: 'economic', passEffect: 'treasury-10|stability+5' };
    const rome = { stability: 50, plebs: 50, treasury: 90 };
    const mod = calcRomeStatVoteModifier(bill as Bill, rome);
    expect(mod).toBeGreaterThan(0);
  });

  test('modifier clamped to ±10', () => {
    const bill: Partial<Bill> = { type: 'constitutional', passEffect: 'stability+5' };
    const extremeRome = { stability: 100, plebs: 100, treasury: 100 };
    const mod = calcRomeStatVoteModifier(bill as Bill, extremeRome);
    expect(mod).toBeLessThanOrEqual(10);
    expect(mod).toBeGreaterThanOrEqual(-10);
  });
});

// ─── buildRepealBill ──────────────────────────────────────────────────────────

describe('buildRepealBill', () => {
  test('inverts plebs and stability effects from original pass effect', () => {
    const law: ActiveLaw = {
      billId: 'lex-frumentaria',
      name: 'Lex Frumentaria',
      passedOnTurn: 5,
      repealable: true,
      renewable: true,
    };
    const repeal = buildRepealBill(law);
    expect(repeal.type).toBe('repeal');
    expect(repeal.repeals).toBe('lex-frumentaria');
    expect(repeal.passEffect).toContain('plebs-10');
    expect(repeal.passEffect).toContain('stability-3');
  });

  test('repeal bill has playerSubmitted: true', () => {
    const law: ActiveLaw = {
      billId: 'lex-sumptuaria',
      name: 'Lex Sumptuaria',
      passedOnTurn: 3,
      repealable: true,
      renewable: false,
    };
    const repeal = buildRepealBill(law);
    expect(repeal.playerSubmitted).toBe(true);
  });

  test('repeal bill starts with support 0', () => {
    const law: ActiveLaw = {
      billId: 'lex-frumentaria',
      name: 'Lex Frumentaria',
      passedOnTurn: 5,
      repealable: true,
      renewable: true,
    };
    const repeal = buildRepealBill(law);
    expect(repeal.support).toBe(0);
  });
});
