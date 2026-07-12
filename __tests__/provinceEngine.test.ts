import {
  calcProvinceGoldOutput,
  tickProvince,
  applyProvinceFlips,
} from '../src/engine/provinceEngine';
import { buildInitialProvinceStates, getProvinceDefinition, isGovernable } from '../src/data/provinceDefinitions';
import type { GovernorPolicy, ProvinceState } from '../src/models/province';

const STANDARD_POLICY: GovernorPolicy = {
  taxation: 'standard',
  security: 'standard_garrison',
  development: 'maintain',
};

function findState(id: string): ProvinceState {
  const found = buildInitialProvinceStates().find(p => p.id === id);
  if (!found) throw new Error(`no province state for ${id}`);
  return found;
}

describe('provinceEngine — foreign province handling', () => {
  test('foreign provinces start with owner set from their definition', () => {
    const carthage = findState('carthage');
    const messana = findState('messana');
    const numidia = findState('numidia');
    expect(carthage.owner).toBe('carthage');
    expect(carthage.status).toBe('foreign');
    expect(messana.owner).toBe('independent');
    expect(numidia.owner).toBe('independent');
    expect(getProvinceDefinition('numidia')?.clientOf).toBe('carthage');
  });

  test('isGovernable is false for foreign provinces and latium, true for a normal province', () => {
    expect(isGovernable('carthage')).toBe(false);
    expect(isGovernable('lilybaeum')).toBe(false);
    expect(isGovernable('latium')).toBe(false);
    expect(isGovernable('campania')).toBe(true);
  });

  test('calcProvinceGoldOutput returns 0 for a foreign province regardless of policy', () => {
    const lilybaeum = findState('lilybaeum');
    expect(calcProvinceGoldOutput(lilybaeum, STANDARD_POLICY, 5)).toBe(0);
  });

  test('tickProvince no-ops entirely for a foreign province', () => {
    const carthage = findState('carthage');
    const result = tickProvince(carthage, 0, 0);
    expect(result.updatedProvince).toEqual(carthage);
    expect(result.goldDelta).toBe(0);
    expect(result.imperiumDelta).toBe(0);
    expect(result.corruptionDelta).toBe(0);
    expect(result.events).toEqual([]);
  });
});

describe('provinceEngine — applyProvinceFlips (conquest/defection)', () => {
  test('leaves provinces alone when their conquestFlag is not set', () => {
    const provinces = buildInitialProvinceStates();
    const { provinces: result, events } = applyProvinceFlips(provinces, {});
    expect(events).toEqual([]);
    const messana = result.find(p => p.id === 'messana')!;
    expect(messana.owner).toBe('independent');
    expect(messana.status).toBe('foreign');
  });

  test('flips Messana to Rome when messanaJoinsRome flag is truthy', () => {
    const provinces = buildInitialProvinceStates();
    const { provinces: result, events } = applyProvinceFlips(provinces, { messanaJoinsRome: true });
    const messana = result.find(p => p.id === 'messana')!;
    expect(messana.owner).toBe('rome');
    expect(messana.status).toBe('unincorporated');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatch(/Messana/);

    // Untouched foreign provinces without a matching flag stay as they were
    const carthage = result.find(p => p.id === 'carthage')!;
    expect(carthage.owner).toBe('carthage');
    expect(carthage.status).toBe('foreign');
  });

  test('is idempotent — a province already owned by Rome is left alone even if its flag is still set', () => {
    const provinces = buildInitialProvinceStates();
    const first = applyProvinceFlips(provinces, { messanaJoinsRome: true }).provinces;
    const { provinces: second, events } = applyProvinceFlips(first, { messanaJoinsRome: true });
    expect(events).toEqual([]);
    const messana = second.find(p => p.id === 'messana')!;
    expect(messana.status).toBe('unincorporated');
  });

  test('a flipped province ticks normally afterward (falls into the unincorporated pathway)', () => {
    const provinces = buildInitialProvinceStates();
    const flipped = applyProvinceFlips(provinces, { messanaJoinsRome: true }).provinces;
    const messana = flipped.find(p => p.id === 'messana')!;
    // Give it an NPC role-holder tick — status is now 'unincorporated', not 'foreign', so tickProvince
    // should no longer short-circuit.
    const result = tickProvince(messana, 0, 0);
    expect(result.updatedProvince.status).toBe('unincorporated');
  });
});
