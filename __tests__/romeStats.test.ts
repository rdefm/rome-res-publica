import { calcRomeStatModifiers } from '../src/engine/resourceEngine';
import {
  calcCrisisEscalation,
  getStabilityEscalationMultiplier,
  getTreasuryAbsorption,
  getPlebsCrisisBonus,
} from '../src/engine/crisisEngine';
import { calcRomeStatVoteModifier, buildRepealBill } from '../src/data/billTemplates';
import type { Bill, ActiveLaw } from '../src/models/bill';

// ─── calcRomeStatModifiers ────────────────────────────────────────────────────

describe('calcRomeStatModifiers — stability bands', () => {
  test('0–19 Instability: gravitas −2, multiplier 1.5', () => {
    const m = calcRomeStatModifiers({ stability: 10, plebs: 50, treasury: 50 });
    expect(m.gravitasDelta).toBe(-2);
    expect(m.crisisEscalationMultiplier).toBe(1.5);
    expect(m.stabilityLabel).toBe('Instability');
  });
  test('20–39 Fragile: gravitas −1, multiplier 1.25', () => {
    const m = calcRomeStatModifiers({ stability: 30, plebs: 50, treasury: 50 });
    expect(m.gravitasDelta).toBe(-1);
    expect(m.crisisEscalationMultiplier).toBe(1.25);
    expect(m.stabilityLabel).toBe('Fragile');
  });
  test('40–69 Stable: no modifier', () => {
    const m = calcRomeStatModifiers({ stability: 55, plebs: 50, treasury: 50 });
    expect(m.gravitasDelta).toBe(0);
    expect(m.crisisEscalationMultiplier).toBe(1.0);
    expect(m.stabilityLabel).toBe('Stable');
  });
  test('70–84 Cohesive: gravitas +1', () => {
    const m = calcRomeStatModifiers({ stability: 75, plebs: 50, treasury: 50 });
    expect(m.gravitasDelta).toBe(1);
    expect(m.stabilityLabel).toBe('Cohesive');
  });
  test('85–100 Pax Interna: gravitas +2, multiplier 0.85', () => {
    const m = calcRomeStatModifiers({ stability: 90, plebs: 50, treasury: 50 });
    expect(m.gravitasDelta).toBe(2);
    expect(m.crisisEscalationMultiplier).toBe(0.85);
    expect(m.stabilityLabel).toBe('Pax Interna');
  });
});

describe('calcRomeStatModifiers — plebs bands', () => {
  test('0–19 Rioting: gratia −3, crisis +3, label Rioting', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 10, treasury: 50 });
    expect(m.gratiaDelta).toBe(-3);
    expect(m.plebsCrisisBonus).toBe(3);
    expect(m.plebsLabel).toBe('Rioting');
  });
  test('20–39 Restless: gratia −1', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 30, treasury: 50 });
    expect(m.gratiaDelta).toBe(-1);
    expect(m.plebsLabel).toBe('Restless');
  });
  test('40–69 Content: no modifier', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 55, treasury: 50 });
    expect(m.gratiaDelta).toBe(0);
    expect(m.plebsCrisisBonus).toBe(0);
    expect(m.plebsLabel).toBe('Content');
  });
  test('70–84 Supportive: gratia +1', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 75, treasury: 50 });
    expect(m.gratiaDelta).toBe(1);
    expect(m.plebsLabel).toBe('Supportive');
  });
  test('85–100 Euphoric: gratia +2, patron call-ins waived', () => {
    const m = calcRomeStatModifiers({ stability: 50, plebs: 90, treasury: 50 });
    expect(m.gratiaDelta).toBe(2);
    expect(m.patronFavourWaived).toBe(true);
    expect(m.plebsLabel).toBe('Euphoric');
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

// ─── calcCrisisEscalation with multiplier + absorption ───────────────────────

describe('calcCrisisEscalation — with multiplier and absorption', () => {
  test('no bills, stable: +8', () => {
    expect(calcCrisisEscalation(20, 0, 1.0, 0, 0)).toBe(28);
  });
  test('no bills, instability multiplier 1.5: +12', () => {
    expect(calcCrisisEscalation(20, 0, 1.5, 0, 0)).toBe(32);
  });
  test('no bills + treasury absorption 2: net +6', () => {
    expect(calcCrisisEscalation(20, 0, 1.0, 2, 0)).toBe(26);
  });
  test('no bills + rioting plebs bonus 3: net +11', () => {
    expect(calcCrisisEscalation(20, 0, 1.0, 0, 3)).toBe(31);
  });
  test('bill passes: −3 (multiplier does not apply to negative delta)', () => {
    expect(calcCrisisEscalation(20, 1, 1.5, 0, 0)).toBe(17);
  });
  test('clamped at 0', () => {
    expect(calcCrisisEscalation(0, 1, 1.0, 5, 0)).toBe(0);
  });
  test('clamped at 100', () => {
    expect(calcCrisisEscalation(98, 0, 1.5, 0, 0)).toBe(100);
  });
});

// ─── calcRomeStatVoteModifier ─────────────────────────────────────────────────

describe('calcRomeStatVoteModifier', () => {
  const baseRome = { stability: 50, plebs: 50, treasury: 50 };

  test('neutral bill at baseline rome: modifier 0', () => {
    const bill: Partial<Bill> = { type: 'neutral', passEffect: 'gravitas+3' };
    expect(calcRomeStatVoteModifier(bill as Bill, baseRome)).toBe(0);
  });

  test('populist bill at high plebs: positive modifier', () => {
    const bill: Partial<Bill> = { type: 'populist', passEffect: 'plebs+5' };
    const rome = { stability: 50, plebs: 80, treasury: 50 };
    const mod = calcRomeStatVoteModifier(bill as Bill, rome);
    expect(mod).toBeGreaterThan(0);
  });

  test('optimates bill at high plebs: negative modifier', () => {
    const bill: Partial<Bill> = { type: 'optimates', passEffect: 'gravitas+3' };
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
    // Original passEffect: 'plebs+10|stability+3' → repeal should have plebs-10 and stability-3
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
