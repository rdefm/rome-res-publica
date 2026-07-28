# Family House banner — asset spec

Where it renders: `src/components/domus/FamilyHousePanel.tsx`, first element at the top of Domus's Family House tab, above the "FAMILY HOUSE" header. One image per house location, swapped automatically based on the player's current `house.locationId`.

## Dimensions

- **Aspect ratio: 16:7** (the component's `banner` style is `width: '100%', aspectRatio: 16/7` — any image not at this ratio will get cropped by `resizeMode="cover"`).
- **Recommended source size: 960 × 420 px** (exactly 16:7, no rounding). This sits in the same resolution range as the project's existing icon/background assets (500–850px) while giving enough headroom for high-density phone screens at the banner's on-screen width (roughly 300–380pt after the tab's padding).
- Format: **PNG**, matching every other asset in `src/assets/`.
- File size: keep each file **≤400KB** if possible (the project's existing guidance for this kind of asset — see `src/utils/cursusAssets.ts`'s note on `fresco-bg.png`, which shipped over budget and is flagged as a "should recompress" item, not a template to follow).

## Files needed (one per house location)

| Location | Filename | Path |
|---|---|---|
| Subura | `banner-subura.png` | `src/assets/domus/houses/banner-subura.png` |
| Aventine | `banner-aventine.png` | `src/assets/domus/houses/banner-aventine.png` |
| Caelian | `banner-caelian.png` | `src/assets/domus/houses/banner-caelian.png` |
| Palatine | `banner-palatine.png` | `src/assets/domus/houses/banner-palatine.png` |

## Wiring in art once it's ready

Drop each file at its path above, then uncomment its line in `src/utils/domusAssets.ts`:

```ts
const HOUSE_BANNERS: Partial<Record<string, RequiredAsset>> = {
  subura: require('../assets/domus/houses/banner-subura.png'),
  aventine: require('../assets/domus/houses/banner-aventine.png'),
  caelian: require('../assets/domus/houses/banner-caelian.png'),
  palatine: require('../assets/domus/houses/banner-palatine.png'),
};
```

No other code changes needed — `FamilyHousePanel.tsx` already calls `domusAssets.houseBanner(location.id)` and falls back to today's placeholder only when a given location's entry is missing/commented out, so locations can be added one at a time.
