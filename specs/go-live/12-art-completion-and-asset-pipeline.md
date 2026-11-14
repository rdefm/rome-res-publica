# Spec 12 — Art completion and asset pipeline

**Source:** `plans/go-live-review-and-plan.md` §4.5, workstream F · **Priority:** P1 · **Phase:** 2 — Polish (additional portraits are third in the plan's cut order)
**Triage:** pipeline, cleanup and budget: `ready-for-agent` · new art: needs commissioned or produced assets (human task)
**Extends:** `plans/cursus-asset-manifest.md`, `plans/curia-asset-manifest.md`, `domus-house-banner-asset-spec.md`

## Verified findings (checked against `917e1ae`)

1. **Asset weight:** `src/assets` is 36 MB. That's 22 MB of portraits, 12 MB of images, 1.7 MB cursus, about 0.8 MB each for domus and forum, and 156 KB of fonts. 44 PNGs are larger than 500 KB.
2. **Density variants: the plan overstated this.** The plan says the `@2x`/`@3x` files checked are byte-identical to the base image. Across all 17 `@2x`/`@3x` files, **3** are byte-identical copies of their base (`border-greek-key@3x`, `border-mosaic@2x`, `border-mosaic@3x`). The rest (`asset-baths`, `asset-library`, and so on) are distinct files. The fake variants are a small cleanup, not a systemic problem.
3. **Portrait coverage: two of five lineages.** `PortraitLineageId` is `'house' | 'cornelii' | 'valerii' | 'fabii' | 'claudii'` (`models/portrait.ts:11`). `src/assets/portraits/` contains only `claudii` (18 files) and `cornelii` (12 files). Confirmed.
4. **House banners: one of four.** `domus-house-banner-asset-spec.md` lists Subura, Aventine, Caelian and Palatine. Only `banner-subura.png` exists in `src/assets/domus/houses/`. Confirmed.
5. **Stray files.** `portraits/Portrait-claudii-5-m-child (1).png`, `images/marius-plumber.png`, `images/btn-end-season-bg_original.png` and `images/ornament-coin_3x-removebg-preview.png`. Confirmed. Filenames also mix `Portrait-` and `portrait-` casing, which is a risk on case-sensitive filesystems and bundlers.
6. **The style mismatch** on Domus family cards (the paterfamilias portrait in a different style from the rest of the family) is a visual finding from the web build. Re-confirm on device.
7. Prior art: `__tests__/portraitAssets.test.ts` already asserts the portrait asset tables resolve.

## Problem Statement

Players will meet placeholder art in core places: three of the five portrait lineages have no faces, three of the four house locations have no banner, and the head of the family looks like he belongs to a different game from his children. Meanwhile the install carries 36 MB of mostly uncompressed PNGs, including duplicates and stray working files, which costs download size on every device.

## Solution

- Set an install-size budget and an asset pipeline that meets it: compression, consistent naming, real density variants or none, and no stray files.
- Produce the missing art (three portrait lineages, three house banners, and a consistent paterfamilias style) against the existing manifests, and wire it in.
- Add a check that fails when a referenced asset is missing, a stray file is present, or the budget is exceeded.

## User Stories

1. As a player, I want every rival clan's members to have portraits, so that the Forum and Curia feel populated by people, not silhouettes.
2. As a player, I want my family's portraits, paterfamilias included, in one consistent style, so that the family tree looks like one family.
3. As a player, I want each house location to have its own banner, so that moving house feels like an achievement.
4. As a player, I want a smaller download, so that the game installs quickly and doesn't crowd my phone.
5. As a player on a high-density screen, I want art that's sharp, so that the game looks premium.
6. As a player on a low-end device, I want images that load without stutter, so that tab switches stay smooth.
7. As an artist, I want an up-to-date manifest listing every needed file, size and style reference, so that I know exactly what to deliver.
8. As an artist, I want a documented export recipe (dimensions, format, compression, naming), so that delivered files drop in without rework.
9. As a developer, I want filenames to follow one naming convention (lowercase, no spaces or parentheses), so that case-sensitive builds never break.
10. As a developer, I want a test that every asset the code references exists and every file in assets is referenced, so that missing and stray files are caught automatically.
11. As a developer, I want byte-identical fake density variants removed, so that the bundle isn't carrying copies.
12. As a release manager, I want a stated install-size budget that the build is checked against, so that the plan's done-when ("the build meets a stated budget") is verifiable.
13. As a release manager, I want a credits and licence record for every asset, so that the store listing and credits screen are accurate.
14. As a design lead, I want to approve the paterfamilias style fix (re-render the paterfamilias or restyle the family set), so that the fix matches the intended look.
15. As a design lead, I want unfinished lineages to fall back to a clearly intentional placeholder (not a broken image) until art lands, so that a partial delivery is still shippable.

## Implementation Decisions

- **Budget:** the default proposal is a JS-bundle asset budget of 15 MB or less (from 36 MB). The design lead and release manager confirm the number. It's recorded in `docs/release-checklist.md`.
- **Compression:** convert large opaque PNGs (portraits, backgrounds) to high-quality WebP or optimised PNG/JPEG. Keep PNG where alpha edges matter. Do it as a one-off conversion with a documented script under `tools/` (for example sharp or squoosh-cli); no runtime change.
- **Density variants:** delete the three byte-identical `@2x`/`@3x` files. For the remaining variants, keep them only where the base is genuinely lower-resolution; otherwise ship a single high-resolution file.
- **Naming:** lowercase kebab-case throughout. Rename the `Portrait-claudii-*` files to `portrait-claudii-*` and update the asset-index modules (`utils/*Assets.ts`). Delete the stray files after a quick check that none are referenced (`marius-plumber.png` looks like a placeholder; confirm with the design lead before deleting, per the §6.14-style rule).
- **Asset index as the single source:** every image the UI uses is required through the `utils/*Assets.ts` index modules (already the pattern). No ad-hoc `require()` of images in components.
- **Missing art:** update the manifests with a status column (have / need / in progress) for the three missing lineages (valerii, fabii, and the house set if the paterfamilias is re-done) and three banners. The wiring follows the existing `domus-house-banner-asset-spec.md` "Wiring in art" section. Until art lands, unmapped lineages fall back to a deliberate neutral portrait.
- **Credits:** a const credits table (data) listing asset groups with author and licence, surfaced in Settings (or wherever the design lead prefers).

## Testing Decisions

- **Seam: the asset index modules**, extending `portraitAssets.test.ts`:
  - Every lineage × gender × age band the portrait engine can request resolves to an asset or the deliberate fallback (never `undefined`).
  - Every house location has a banner or the fallback.
- **Seam: the filesystem (a test or script):**
  - No file in `src/assets` is unreferenced by an index module (allowlist for fonts).
  - No filename has uppercase letters, spaces or parentheses.
  - No two files in a density group are byte-identical.
  - The total size is under budget.

  This runs in CI (spec 02).
- Visual QA on device for style consistency. Screenshots go in the PR.

## Out of Scope

- Animation or Lottie (the dependency is removed in spec 01).
- Map art changes beyond label fixes (spec 08).
- Splash and app icon (spec 02 and spec 16).

## Further Notes

- Correction to the review: the "byte-identical density variants" finding applies to 3 of 17 files, not to density variants generally.
