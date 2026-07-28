// ─── Domus Asset Registry ─────────────────────────────────────────────────────
// Family House banner art, one per house location (`HouseLocationDefinition.id`
// — currently 'subura' | 'aventine' | 'caelian' | 'palatine', see
// data/houseLocations.ts). Same graceful-degradation shape as
// utils/cursusAssets.ts / utils/curiaAssets.ts: Metro resolves require() at
// BUNDLE time, so every line below ships commented out until the file exists
// in assets/domus/houses/. A missing/commented entry resolves to `undefined`
// — the consumer (components/domus/FamilyHousePanel.tsx) renders a
// placeholder banner for that case.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredAsset = any; // matches the untyped require() convention already used by cursusAssets.ts / curiaAssets.ts.

const HOUSE_BANNERS: Partial<Record<string, RequiredAsset>> = {
  // subura: require('../assets/domus/houses/banner-subura.png'),
  // aventine: require('../assets/domus/houses/banner-aventine.png'),
  // caelian: require('../assets/domus/houses/banner-caelian.png'),
  // palatine: require('../assets/domus/houses/banner-palatine.png'),
};

export const domusAssets = {
  /** `locationId` is an OwnedHouse.locationId / HouseLocationDefinition.id.
   *  Returns undefined until that location's banner line above is
   *  uncommented (i.e. for every location today). */
  houseBanner: (locationId: string): RequiredAsset | undefined => HOUSE_BANNERS[locationId],
};
