# Spec 01 — Platform upgrade and build ownership

**Source:** `plans/go-live-review-and-plan.md` §2 B1, §4.1, workstream A · **Priority:** P0 · **Phase:** 0 — Stabilise
**Triage:** `ready-for-agent` · **Blocked by decisions:** §6.10 (launch platforms / web), only for the web item

## Verified findings (checked against `917e1ae`)

1. `package.json` pins `expo ~51.0.0`, `jest-expo ~51.0.0`, and the matching SDK-51 module versions (`expo-font ~12`, `expo-splash-screen ~0.27`, and so on). Confirmed.
2. `android/build.gradle:7-8` defaults `compileSdkVersion` and `targetSdkVersion` to `34`. Confirmed.
3. `android/app/build.gradle:130,135` sets **both** debug and release `signingConfig` to `signingConfigs.debug`. Confirmed: a release build today is debug-signed.
4. `android/` is committed, and `.gitignore` does not ignore it. With a native folder present, EAS builds from it, and `app.json` changes only apply after a fresh prebuild. Confirmed.
5. `.gitignore` already ignores `*.jks`, `*.p8`, `*.p12`, `*.key` and `*.mobileprovision`, so keystores will not leak once real signing is configured.
6. `lottie-react-native` and `expo-app-loading` are in dependencies with zero imports in `src/` or `App.tsx`. Confirmed.
7. `react-native-web` is installed. `Alert.alert` appears in `src/` (MilitaryTab) and is a no-op on web; only one `Platform.OS === 'web'` branch exists in the codebase.

## Problem Statement

The game cannot be submitted to either store as it stands. It targets an Expo / React Native pair and an Android API level the stores have moved past. Release builds are signed with the debug key. Nobody can say for certain which source of truth (`app.json` or the committed `android/` folder) a production build comes from. A player can never get the game on a store test track, and every later workstream (playtesting on devices, accessibility, store paperwork) is blocked behind that.

## Solution

Move the project to a currently supported Expo SDK / React Native pair that meets current Google Play target-API and Apple SDK minimums. Make one deliberate choice about who owns the native project: either Expo prebuild (delete and git-ignore `android/`) or a bare workflow (keep and own `android/`). Configure real release signing. Remove dead dependencies. Record the web-target decision and act on it. When this is done, a production build installs from an internal test track on both platforms.

## User Stories

1. As a player on a current Android phone, I want to install the game from the Play Store, so that I can play it at all.
2. As a player on a current iPhone, I want to install the game from the App Store or TestFlight, so that I can play it on iOS.
3. As a player, I want the game to behave identically after the platform upgrade, so that my existing run is not affected by an engineering change.
4. As a player with an existing save from the SDK-51 build, I want that save to load in the upgraded build, so that I don't lose a run to an upgrade.
5. As a release manager, I want release builds signed with a real upload key, so that Play accepts the bundle and future updates can be signed with the same key.
6. As a release manager, I want a single documented answer to "where does the native config come from", so that an `app.json` change (such as `allowBackup`) reliably reaches the build.
7. As a release manager, I want a reproducible EAS build profile for internal, preview and production, so that test-track builds and store builds come from the same recipe.
8. As a developer, I want `npm install` on a fresh clone to produce a working dev build with no manual native steps, so that onboarding a new contributor (or agent) takes minutes.
9. As a developer, I want deprecated and unused packages removed, so that the upgrade surface is smaller and audit warnings are meaningful.
10. As a developer, I want `npx tsc --noEmit` and `npm test` to stay green across the upgrade, so that the upgrade is provably behaviour-preserving.
11. As a developer, I want the Jest preset version to match the SDK, so that tests run against the same module shims as the app.
12. As a developer, I want the pre-push hook to keep working after the upgrade, so that the zero-error baseline is still enforced.
13. As a design lead, I want an explicit decision recorded on whether web is a supported target, so that the team stops carrying web workarounds or starts testing web properly.
14. As a developer, if web is dropped, I want web-only code paths and the web dependency removed, so that nobody maintains dead branches.
15. As a developer, if web is kept, I want every `Alert.alert` call replaced with an in-app dialog, so that confirmations work on web too.
16. As a QA tester, I want a build matrix (Android min and target API, an older and a current iOS version) to install and launch on, so that I know which devices the upgrade was checked on.
17. As a player on a small or notched device, I want safe areas to be correct after the upgrade, so that the resource bar and tab bar are not clipped by system UI.
18. As a player, I want the Android back button to behave sensibly (closing the top modal, not exiting mid-decision), so that the upgraded build doesn't introduce accidental exits.

## Implementation Decisions

- **Upgrade path:** step through SDK majors following Expo's upgrade guide, rather than jumping straight to the latest, if a direct jump breaks too many modules at once. The exact target SDK is whatever is current and store-compliant at implementation time. Confirm the Play target-API and Apple SDK minimums on the day of submission, not from this spec.
- **Native-project ownership:** default recommendation is **managed / prebuild**: delete `android/`, add `android/` and `ios/` to `.gitignore`, and generate native projects through EAS / `expo prebuild`. Fall back to bare only if a native customisation is found that cannot be expressed as a config plugin. Record the outcome in README and CLAUDE.md (the "do not touch `android/`" rule changes meaning either way).
- **Signing:** release signing comes from EAS-managed credentials (or a keystore supplied through EAS secrets). No keystore enters the repository.
- **Dependencies:** remove `lottie-react-native` and `expo-app-loading`. Bump every `expo-*` module with `npx expo install --fix` so versions match the SDK.
- **Web:** follow decision §6.10. Until it is made, don't add new web-specific code.
- **Save compatibility:** no save-shape change is expected. If an upgraded AsyncStorage version changes storage semantics, that becomes a migration in spec 04, not a silent break.
- **Tooling scope note:** this spec is explicitly tooling work, so editing `package.json`, `app.json` and `eas.json` and deleting `android/` is in scope (per CLAUDE.md's tooling exception).

## Testing Decisions

- **Seam:** the existing Jest suite (all 60+ engine and store suites) is the behaviour-preservation seam. It must pass unchanged on the new SDK. No new test seam is introduced.
- **Seam:** a save-fixture load check. The existing fixtures in `__tests__/fixtures/` (phase 2 through 5) must still validate and load through the save provider after the AsyncStorage bump. This reuses `saveLoad.test.ts`.
- Device verification (install, launch, start a game, end a season, background and restore) is manual and is recorded in `docs/release-checklist.md` with date, device and OS.
- A good test here asserts on behaviour that a player or the store sees (the build installs, the save loads), not on dependency versions.

## Out of Scope

- CI setup, debug gating, fonts and error recovery (spec 02).
- Store listing, privacy policy and rating (spec 16).
- Any gameplay or UI change.

## Further Notes

- §4.1 also mentions "no splash image". The splash is handled in spec 02 alongside font loading, because the two are coupled (the splash holds until fonts are ready).
- If the prebuild route is chosen, the CLAUDE.md "never hand-edit `android/`" rule becomes "there is no `android/`". Update CLAUDE.md and SITEMAP.md in the same branch.
