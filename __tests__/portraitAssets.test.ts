// ─── portraitAssets.ts tests ─────────────────────────────────────────────────
// portrait-fixes.md Chunk 6 — variantCountFor/assignVariant are the only real
// logic in this file (everything else is static require() lookups); covered
// here since assignPortraitVariant itself is already covered in
// portraitEngine.test.ts.

import { portraitAssets } from '../src/utils/portraitAssets';

describe('variantCountFor', () => {
  test('cornelii-m has 3 archetype variants', () => {
    expect(portraitAssets.variantCountFor('cornelii', 'm')).toBe(3);
  });
  test('an unlisted group defaults to 1 (DEFAULT_PORTRAIT_VARIANT_COUNT)', () => {
    expect(portraitAssets.variantCountFor('house', 'm')).toBe(1);
    expect(portraitAssets.variantCountFor('valerii', 'f')).toBe(1);
  });
});

describe('assignVariant', () => {
  test('respects the group\'s configured variant count and updates the cycle under that group\'s key', () => {
    const { variant, cycles } = portraitAssets.assignVariant('cornelii', 'm', {});
    expect([1, 2, 3]).toContain(variant);
    expect(cycles).toEqual({ 'cornelii-m': [variant] });
  });

  test('an unlisted group (count 1) always returns variant 1 with an empty cycle', () => {
    const { variant, cycles } = portraitAssets.assignVariant('house', 'f', {});
    expect(variant).toBe(1);
    expect(cycles).toEqual({ 'house-f': [] });
  });

  test('does not mutate the input cycles map', () => {
    const input = { 'cornelii-m': [1, 2] };
    portraitAssets.assignVariant('cornelii', 'm', input);
    expect(input).toEqual({ 'cornelii-m': [1, 2] });
  });

  test('leaves other groups\' cycles untouched', () => {
    const input = { 'valerii-m': [1] };
    const { cycles } = portraitAssets.assignVariant('cornelii', 'm', input);
    expect(cycles['valerii-m']).toEqual([1]);
  });
});
