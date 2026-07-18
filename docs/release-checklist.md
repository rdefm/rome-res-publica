# Release Checklist — Phase 5, Chunk P5-I

The premium-hygiene audit findings, plus a repeatable pre-release QA list. QA-only — no store-listing/marketing content (cut from Phase 5's scope by design review).

## Premium audit

### Offline (zero network calls)

**Static audit: clean.**
- Grepped `fetch(|axios|XMLHttpRequest|WebSocket` across `src/` — zero hits.
- `package.json` dependencies: no `axios`, no analytics SDK, no network client of any kind beyond Expo's own bundled modules (`expo-file-system`, `expo-sharing`, `expo-document-picker` — all local-disk/share-sheet operations, not network calls).
- `proxy.mjs` is a local Metro-bundler dev proxy (`localhost:8081` → `8082`) — dev tooling only, never bundled into the shipped app. Confirmed dev-only, exempt per this audit's own scope.

**Open — live device verification (pending, user to run):** a full session (new game → 4 seasons → an event → save/load) performed in airplane mode on a device/emulator. This environment has no device/emulator access; the static audit above gives high confidence but doesn't substitute for the live check.

### Zero timers (no wall-clock gameplay gating)

**Confirmed clean.** Every `Date.now()` call site in `src/` (13 files) is one of:
- **ID-generation uniqueness suffix** (`secret-${Date.now()}-${random}`, `trial-${Date.now()}`, `spouse-${Date.now()}-...`, etc.) — not gameplay-gating, just collision avoidance.
- **Real-world display/telemetry timestamps** — `lastActiveAt` (welcome-back detection), `seasonStartedAt` (Pace panel duration tracking), `AncestorRecord.recordedAt` (Hall sort order), `EarnedAchievement.earnedAt` (display date). None of these disable or delay a gameplay action based on elapsed wall-clock time.
- **The one wall-clock conditional**: `App.tsx`'s `elapsed > TWELVE_HOURS` check, gating whether the welcome-back recap modal shows. This doesn't block, delay, or unlock anything — it's a UX choice about whether to show a summary, not a "wait N hours" mechanic. Not a timer in the audited sense.

No energy systems, no "wait to unlock," no real-money-timer patterns anywhere.

### Zero IAP

**Confirmed clean.** No `expo-in-app-purchases` or any purchase module in dependencies; no store SKU references anywhere in `src/` or config files.

## Save safety

- **Autosave:** confirmed — every season end (`gameStore.endSeason` calls `saveProvider.save(get())`), unchanged this chunk.
- **Save-on-background:** confirmed already implemented (`App.tsx`'s `AppState` listener, tagged `[P1-D]`) — `background`/`inactive` transitions trigger a save. Nothing needed here.
- **`activeEvent` persistence (fixed this chunk):** previously stripped from every save alongside truly-transient UI fields (`agendaVisible`, `uiNavRequest`). Found during this audit: unlike `pendingSuccession`/in-session trials/`pendingBirthNaming` (all real `GameState` fields, already safe), a random event modal's state lived *only* in `activeEvent` — an app kill while that modal was showing silently discarded the event on restart. `saveLoad.ts`'s `save()` no longer strips it; `EventModal` already renders off `state.activeEvent` directly, so a restored one just works. Covered by `__tests__/saveLoad.test.ts`.
- **Android Auto Backup:** `app.json`'s `android.allowBackup: true` (added this chunk). Android's default full-backup behavior (no custom rules needed) already covers AsyncStorage's on-disk location. **Honest limitation:** OS-scheduled (roughly every 24h when idle/charging/on wifi), requires the user signed into a Google account with device backup enabled — not immediate, not guaranteed, not something the app controls or can prompt for.
- **iOS:** no code change — AsyncStorage rides the device's own backup (iCloud or iTunes/Finder) by default. Verified nothing in this app opts data out of that (no `NSURLIsExcludedFromBackupKey`-equivalent anywhere; no `ios/` directory exists to check natively, and `app.json`'s `ios` key has no backup-exclusion config).
- **Export/import round-trip:** verified programmatically against a full post-Phase-5 fixture save (war mid-arc, secrets held both directions, a filed trial, Manlia gens, Ferox difficulty) — `__tests__/saveLoad.test.ts`'s "Export/import round-trip" block. JSON round-trip is identity-preserving; the fixture validates against `SaveSchema` with zero drift found. **Open — live device verification (pending, user to run):** the actual export → share-sheet → wipe app → import flow on a device, which needs the real native modules this environment can't exercise.
- **Settings — "Your saves":** added to `SettingsModal.tsx` — plain-language section above the Save/Export/Import buttons, platform-aware copy (iCloud/iTunes on iOS, Google device backup on Android), wired to a new "Saves & Backup" Tabularium entry via `InfoTap`. No "cloud" overpromise.

## Save versioning & migration

- `saveVersion` added to `GameState`/`SaveSchema` (optional — absent means "written before this chunk," not "version 1"; there was no version-1 concept before now). `CURRENT_SAVE_VERSION = 5`, stamped on every `save()`/`exportSave()` call.
- Migration behavior itself is unchanged (the existing per-field `??`/spread fallbacks in `gameStore.loadGame`, already correct and tested) — `saveVersion` is a stamp for future logic and test assertions to key off, not a new dispatch table (behaviour-preserving, per the plan's own instruction).
- Four committed fixtures in `__tests__/fixtures/` (fabricated minimal-valid JSON per era, per the plan's own sanctioned fallback — none of the original era saves were at hand): `save-phase2.json` (pre-Phase-3: no wars/secrets/trials(unified)/gensId/difficulty), `save-phase3.json` (adds wars/succession/cadet-branch scaffolding), `save-phase4.json` (adds secrets/unified trials), `save-phase5-full.json` (current: adds gensId/difficulty, war mid-arc, secrets both directions, a filed trial, Manlia, Ferox). All four load via `gameStore.loadGame` without crashing and land on the correct invariant defaults (`difficulty: 'aequus'`, `gensId: 'brutii'`, the Claudius starting Secret backfilled for any pre-P4-G fixture) — `__tests__/saveLoad.test.ts`.

## Repeatable pre-release QA list

Run this end-to-end once before any release build; re-run the parts that changed after future edits.

1. **Fresh install** — new game (each start: guided, standard, Duilia, Manlia), play 2 seasons, confirm no crash, confirm the difficulty picker appears for every start except guided.
2. **Old-save load** — load each of the four `__tests__/fixtures/` saves through the real app (Import Save in Settings) and confirm each opens into a playable state with no crash. *(Automated equivalent already covered by `__tests__/saveLoad.test.ts`; this step is the live-app confirmation.)*
3. **Airplane mode** — new game, play 4 seasons (trigger at least one event), save, reload, all in airplane mode. *(Open — pending device session.)*
4. **Each family boots** — Brutii (guided + standard), Duilia (after unlocking via any completed Hall run), Manlia (after unlocking via a Victory) — confirm correct gens naming everywhere (log, epilogue, agenda, glossary).
5. **Each preset boots** — Clemens, Aequus, Ferox — confirm the picker shows the literal numbers, and the Hall/epilogue badge matches the chosen preset.
6. **Export/import** — export a save mid-run, wipe the app (New Game or reinstall), import the exported file, confirm the exact state returns. *(Open — pending device session for the live share-sheet/file-picker flow; the schema-level round-trip is already automated.)*
7. **Backup sanity** — confirm `app.json`'s `android.allowBackup: true` survives the next `eas build`/prebuild (spot-check the generated manifest if a native build is run).

## Status summary

| Area | Status |
|---|---|
| Offline (static audit) | ✅ Clean |
| Offline (live device session) | ⏳ Pending — user to run |
| Zero timers | ✅ Confirmed clean |
| Zero IAP | ✅ Confirmed clean |
| Autosave | ✅ Confirmed (unchanged) |
| Save-on-background | ✅ Confirmed (already existed) |
| `activeEvent` persistence gap | ✅ Fixed this chunk |
| Android Auto Backup | ✅ Configured (`allowBackup: true`) |
| iOS backup | ✅ Confirmed (default behavior, nothing opts out) |
| Export/import (schema-level) | ✅ Verified, zero drift found |
| Export/import (live device) | ⏳ Pending — user to run |
| Settings "Your saves" story | ✅ Added |
| `saveVersion` + migration fixtures | ✅ Added, 10 passing tests |
