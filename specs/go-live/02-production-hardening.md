# Spec 02 — Production hardening: fonts, splash, debug gating, error recovery, CI

**Source:** `plans/go-live-review-and-plan.md` §2 B2, B3, B7, §4.1, workstream A · **Priority:** P0 · **Phase:** 0 — Stabilise (can ship first)
**Triage:** `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **Fonts are never loaded.** `src/assets/fonts/` contains `Cinzel-Bold.ttf` and `Cinzel-Regular.ttf`. The comment at `src/utils/theme.ts:149` says "Cinzel loaded via useFonts in App.tsx", but there is no `useFonts` or `Font.loadAsync` call anywhere in the codebase. Confirmed.
2. **The body font doesn't exist on Android.** `FONTS.body` and `FONTS.bodyRegular` are `'Georgia-Italic'` and `'Georgia'`. Georgia is an iOS and desktop system font and is not present on Android, so it silently falls back there.
3. **Debug Mode is reachable in production.** `StartMenuScreen.tsx:172-186` renders "⚙ Debug Mode" and "Preview locked families" unconditionally. `DomusScreen.tsx:110` mounts `DebugPanel` whenever the store's `debugMode` is set. Only one `__DEV__` check exists in app code (`App.tsx:398`), and it doesn't gate either of these. Confirmed.
4. **The crash screen leaks a stack trace and offers no way out.** `ErrorBoundary` (`App.tsx:66-82`) renders "RENDER ERROR" plus `e.message + e.stack` in monospace, with no retry, reload or export. Confirmed.
5. `expo-splash-screen` is already a dependency, but `app.json` sets only a background color (no splash image).
6. **No hosted CI.** There is no `.github/` directory. The pre-push hook (`scripts/hooks/pre-push`) is the only gate, and `--no-verify` bypasses it. **This was a deliberate earlier choice:** SITEMAP.md §10 records the hook as "local, solo-dev-appropriate enforcement (chosen over standing up this repo's first GitHub Actions CI)" in QA Audit Fix Plan Chunk F. Adding CI reverses that call, which is justified by the go-live context (multiple contributors and agents, and a soak harness to run). Confirm with the design lead and keep the hook either way.

## Problem Statement

The first thing a player sees can be wrong (titles in a fallback serif instead of the Cinzel display face), and the last thing they see after a crash is a developer's stack trace with no way to continue. Between those two, the start menu offers a "Debug Mode" button that can unlock all families and edit game state, which breaks both progression and the premium promise. Nothing outside a contributor's own machine checks that the type check and tests pass.

## Solution

Hold the splash screen until fonts are loaded, then render with the correct typefaces on both platforms. Compile debug entry points out of production builds. Replace the raw error screen with a player-facing recovery screen that offers to reload from the last autosave or export the save. Add a hosted CI workflow that runs the same checks as the pre-push hook on every push and PR.

## User Stories

1. As a player, I want the title and headings to appear in the intended Roman display face from the first frame, so that the game looks finished.
2. As a player, I never want to see a flash of the fallback font before the real one loads, so that the opening looks polished.
3. As a player on Android, I want narrative text in a deliberate serif rather than whatever the system substitutes for Georgia, so that the game reads the same as it does on iOS.
4. As a player, I want a branded splash screen while the app starts, so that a slow cold start doesn't look like a blank or frozen app.
5. As a player, I don't want any Debug or Preview-locked-families option on the start menu, so that I can't accidentally break my run or unlock content I haven't earned.
6. As a player, I don't want the debug panel to be reachable through any stored flag in a production build, so that an old save with `debugMode` set doesn't expose it.
7. As a player whose game hits a render error, I want a calm in-world message instead of a stack trace, so that the crash doesn't feel like the game is broken beyond repair.
8. As a player whose game hits a render error, I want a "Return to last autosave" button, so that I can keep playing from where the game last saved.
9. As a player whose game hits a render error, I want an "Export save" button on the recovery screen, so that I can keep a copy of my run before trying anything else.
10. As a player whose game crashes again right after recovering, I want a "Return to start menu" option, so that I'm never trapped in a crash loop.
11. As a developer, I want the error details still available in dev builds (and copyable from a "details" toggle in production), so that bug reports stay actionable.
12. As a developer, I want the debug tools to keep working exactly as they do now in dev builds, so that balance work (Auto-Season Runner, Pace tab) isn't disrupted.
13. As a developer, I want CI to run `tsc --noEmit` and `npm test` on every push and pull request, so that a `--no-verify` push can't silently regress `main`.
14. As a developer, I want CI to use the same Node version and `npm test` invocation (with `--experimental-vm-modules`) as local runs, so that CI failures are real.
15. As a reviewer, I want a CI status check on PRs, so that I can see at a glance whether a branch is safe to merge.
16. As a QA tester, I want a way to tell a dev build from a production build at a glance (for example a build-type marker in Settings), so that I file bugs against the right build.
17. As a design lead, I want the Theme comment about font loading to be true, so that the next person isn't misled.

## Implementation Decisions

- **Font loading** happens once at the app root with `expo-font`. `SplashScreen.preventAutoHideAsync()` is called at module load and the splash is hidden once fonts resolve (or fail; on failure, render with fallbacks rather than blocking forever).
- **Body font:** choose a bundled serif with an italic, licensed for app embedding, and load it alongside Cinzel. Update the `FONTS.body` and `FONTS.bodyRegular` tokens; components keep using tokens, so no component changes are needed. The specific typeface is a design-lead pick. If no pick is made, keep Georgia on iOS and use a platform-selected serif on Android.
- **Debug gating:** introduce one exported boolean (for example `DEBUG_TOOLS_ENABLED`) that is `__DEV__` or an explicit build-time flag (an EAS env var for internal QA builds). The start-menu debug buttons, the `DebugPanel` mount, and any store action that only debug uses all read that one constant. In production, a persisted `debugMode: true` is ignored on load.
- **Error recovery screen** replaces the current `ErrorBoundary` body:
  - It shows a themed message and three actions: reload from autosave (re-reads the save through the save provider and remounts the tree), export save, and return to the start menu.
  - It catches its own errors. If reload fails, it falls through to start menu with the backup fallback from spec 04.
  - Error text is hidden behind a "Details" toggle in production and shown expanded in dev.
- **CI:** a GitHub Actions workflow on `push` and `pull_request` runs `npm ci`, then `npx tsc --noEmit`, then `npm test`. Cache `node_modules` keyed on the lockfile. Spec 06 later adds the soak harness as an additional job.
- Update the `theme.ts` typography comment to describe where loading actually happens.

## Testing Decisions

- **Seam: the debug-gating constant.** A unit test asserts that with the flag off, the start-menu debug controls aren't rendered and a loaded `debugMode: true` is cleared. This is the only new seam; it's the single point every debug surface reads.
- **Seam: the save provider.** Recovery's "reload from autosave" goes through the existing `saveProvider.load()` seam, already covered in `saveLoad.test.ts`. Extend that test with a "load after crash" case rather than testing the component internals.
- The error recovery screen gets one component-level render test (it's the first UI test in the repo, so keep it minimal): throw inside a child and assert the three actions render. Spec 15 establishes the broader UI-test harness; reuse whatever minimal setup this introduces.
- Font loading is verified manually on device (captured in the release checklist); it isn't unit-testable meaningfully.
- Prior art: `tutorialEngine.test.ts` already asserts a `__DEV__`-dependent branch directly (`tutorialEngine.ts:585`).

## Out of Scope

- SDK upgrade and signing (spec 01).
- Crash *reporting* / telemetry (decision §6.9, spec 16).
- The save backup and fallback mechanism itself (spec 04). This spec only calls into it.

## Further Notes

- If spec 04 lands later than this one, "reload from autosave" should still work against the current single slot. The backup fallback slots in without changing this screen's interface.
