# Spec 04 — Save integrity and migrations

**Source:** `plans/go-live-review-and-plan.md` §2 B5, B6, §4.3, workstream C · **Priority:** P0 · **Phase:** 0 — Stabilise
**Triage:** `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **Load failures are swallowed.** `LocalSaveProvider.load` (`saveLoad.ts:245-256`) wraps read, parse and validate in one `try/catch`. Any failure logs `console.warn` and returns `null`, so the start menu then reads as "no save". `importSave` and `exportSave` (`saveLoad.ts:272-302`) do the same with `console.error`. The player gets no message. Confirmed.
2. **One slot, no backup.** A single `SAVE_KEY` with no rotation. Confirmed.
3. **New game silently overwrites.** `StartMenuScreen` knows `saveExists` (`:45,61`) but `handleStartPress` (`:110`) never consults it. The first autosave of the new run replaces the old one. Confirmed.
4. **The parsed result is discarded.** `SaveSchema.parse(parsed)` is called for its throw only; the raw `parsed` object is returned. So every `.default()` in the schema never applies. The schema's own comments acknowledge this (`saveLoad.ts:175-193`), and the real backfill is `INITIAL_STATE` spread plus `??` fallbacks in `gameStore.loadGame` (`gameStore.ts:3832`).
5. **The schema is shallow.** `bills`, `clans`, `secrets`, `trials`, `wars`, `house`, `campaignLog`, `pendingSuccession`, `regency`, `cadetBranch` and more are `z.any()`.
6. **`saveVersion` is stamped but never read.** `CURRENT_SAVE_VERSION = 6` is written on save and export. Nothing in `src/` dispatches on it. Confirmed by grep.
7. **Export and save disagree on fields.** `save()` strips `agendaVisible`, `uiNavRequest`, `activeBattle`, `activeBattleSetup`, `activeBattleBridgeCtx`, `selectedTrialId`, `curiaSubTabRequest` and `curiaBillTargetRequest`. `exportSave` serialises the whole state. Confirmed.
8. **Unbounded log.** `log: LogEntry[]` is appended in about 80 places in `gameStore.ts` and never trimmed.
9. **Full-state serialisation on every app-state change.** The `AppState` listener (`App.tsx:283-300`) autosaves on both `background` and `inactive`.
10. **Prior art exists.** `__tests__/saveLoad.test.ts` already has migration fixtures for each era (phase 2 through phase 5 full), `saveVersion` stamping, an export/import round-trip, and a provincial-client corruption regression.

## Problem Statement

A player's run can vanish with no explanation. If the save is corrupted or fails validation (a bad write during a kill, or a shape change between versions), the game quietly reports "no save found" and the run is gone, because there is only one slot and no backup. Tapping New Game by mistake does the same thing on the next autosave, with no warning. Importing a bad file or failing to export does nothing visible. Underneath this, migration is a scatter of `??` fallbacks, and the version number that should drive it is ignored.

## Solution

Make save loss rare and never silent:

- Keep a rolling backup of the last known-good save and fall back to it automatically when the primary fails to load, telling the player what happened.
- Surface every load, import and export failure with a clear message.
- Confirm before a new game replaces an existing run.
- Replace scattered fallbacks with a versioned migration table keyed on `saveVersion`, and use the parsed (defaulted) schema output.
- Tighten the schema for the shapes that have actually broken before.
- Bound the log, and make export use the same field list as save.

## User Stories

1. As a player whose save is corrupted, I want the game to load my previous good save automatically, so that I lose at most one season instead of the whole run.
2. As a player whose save fell back to the backup, I want a clear message ("Your latest save couldn't be read; we restored the save from Winter 262 BC"), so that I understand why I'm a season behind.
3. As a player whose primary and backup saves are both unreadable, I want to be told plainly and offered "export the damaged file", so that I can send it for help instead of losing it.
4. As a player with a run in progress, I want New Game to ask "This will replace your current run (Gens Brutia, 259 BC). Continue?", so that I can't wipe a run by accident.
5. As a player who declines that confirmation, I want to be offered Export first, so that I can keep a copy before starting fresh.
6. As a player, I want the Continue button to describe the save (family, year, season), so that I know which run I'm resuming.
7. As a player importing a save file, I want a specific message if the file isn't a save, is from a newer version, or is damaged, so that I know what went wrong.
8. As a player exporting a save, I want confirmation that it worked, or a message saying it failed, so that I'm not left guessing.
9. As a player who exports and later imports, I want exactly the state a normal save would restore (no stale transient UI state), so that import behaves like Continue.
10. As a player with a very long run (80+ seasons), I want saving to stay fast and the save to stay small, so that backgrounding the app never stalls.
11. As a player, I want the chronicle history I care about (major events) to survive log trimming, so that bounding the log doesn't erase my story. (See spec 09.)
12. As a player updating the app, I want my save from any earlier released version to load and land on sensible defaults, so that updates never cost me a run.
13. As a player opening a save made by a *newer* version of the app (for example after a rollback), I want a clear "this save is from a newer version" message rather than a crash or partial load, so that nothing gets corrupted further.
14. As a developer adding a field, I want to add one migration step and bump the version, so that I never have to hunt for `??` fallbacks.
15. As a developer, I want the loaded state to be the schema's parsed output, so that `.default()` values in the schema mean what they say.
16. As a developer, I want the shapes that have historically corrupted saves (clients, trials, wars, secrets, house) to be properly typed in the schema, so that drift fails a test instead of a player's load.
17. As a developer, I want one list of transient (never-persisted) fields used by both save and export, so that the two can't disagree again.
18. As a QA tester, I want a debug-build way to write a deliberately corrupted primary save, so that the fallback path can be checked on a device.
19. As a design lead, I want the log cap expressed as a balance constant, so that I can tune how much history is kept.

## Implementation Decisions

- **Save provider interface grows to report outcomes**, rather than returning `null` on every failure. Indicative contract:

  ```ts
  type LoadResult =
    | { status: 'ok'; state: GameState; source: 'primary' | 'backup' }
    | { status: 'empty' }
    | { status: 'failed'; reason: 'corrupt' | 'invalid' | 'newerVersion'; rawAvailable: boolean };
  interface SaveProvider {
    save(state: GameState): Promise<void>;
    load(): Promise<LoadResult>;
    describe(): Promise<SaveSummary | null>; // gens, year, season — for Continue and confirm copy
  }
  ```

  Import returns the same result shape. Export returns success or failure.
- **Rolling backup:** before each successful write to the primary slot, copy the current primary (if it validates) to a backup key. "Previous season" granularity: rotate at most once per season (keyed on `turnNumber`), so that rapid background/inactive saves within a season don't rotate a good backup out.
- **Write safety:** write to a temp key, then swap, so a kill mid-write leaves the old primary intact.
- **Migration table:** an ordered map from version N to a pure `(raw) => raw` step that produces version N+1. Load runs every step from the save's version (missing means pre-versioning, treated as 1) up to `CURRENT_SAVE_VERSION`, then parses with the schema and **uses the parsed output**. The existing `??` fallbacks in `loadGame` move into migration steps. A save with a version above current fails with `newerVersion`.
- **Schema tightening (scoped):** give real schemas to the shapes that have broken before or that downstream code trusts: clients (already typed), trials, wars, secrets, house, pending succession and engagements. Leave the rest `z.any()` for now, with a tracked follow-up. Each tightened shape must still validate every fixture.
- **Transient fields:** a single exported const list of non-persisted field names, used by both `save()` and export.
- **Log cap:** keep the last N entries (a `BALANCE` constant), and spec 09's chronicle-worthy entries (flagged by type) indefinitely. Other unbounded arrays found during implementation (`seasonStatsHistory`, `campaignLog`) get the same treatment, or are listed as follow-ups.
- **Autosave cadence:** keep the background save. Drop the save on `inactive` if `background` reliably follows on both platforms (verify on device), or debounce it.
- **New-game confirmation and failure messages** are themed in-app dialogs (not `Alert.alert`, per spec 01's web note), shown from the start menu.
- **This is a save-shape change:** bump `CURRENT_SAVE_VERSION` and add a migration step, per CLAUDE.md.

## Testing Decisions

- **Primary seam: the save provider**, tested with the existing AsyncStorage jest mock (prior art: `saveLoad.test.ts`). This is the highest seam that covers storage, migration and validation together:
  - Corrupt the primary (invalid JSON, schema-invalid) with a good backup: `load()` returns `ok/backup`.
  - Both slots corrupt: `failed/corrupt` with `rawAvailable: true`.
  - A save with version `CURRENT + 1`: `failed/newerVersion`.
  - Backup rotation happens at most once per `turnNumber`.
  - An interrupted write (simulated failure between temp write and swap) leaves the primary readable.
- **Seam: the migration table (pure).** Every fixture in `__tests__/fixtures/` (phase 2 through phase 5 full) migrates through the table to current and validates. Add a fixture for the current version as each version is cut. This is the plan's "every fixture migrates through the table" done-when.
- **Round-trip:** export output equals save output (same transient-field list), extending the existing "Export/import round-trip" block.
- **Log cap:** a store-level test runs N+50 log-producing actions and asserts that the length is capped and chronicle-flagged entries survive.
- The start-menu confirmation gets a light UI test only if spec 02's harness exists by then; otherwise it's verified manually.

## Out of Scope

- Multiple manual save slots (a design decision; not requested by the plan).
- Cloud saves or sync (conflicts with the offline promise).
- The Chronicle screen itself (spec 09). This spec only guarantees its data survives the cap.

## Further Notes

- The plan's done-when: "a deliberately corrupted save recovers to the prior season with a clear message, and every fixture migrates through the table."
- Spec 02's error-recovery screen calls `load()`. With this spec, a failure there falls back to the backup automatically.
- Spec 05 adds the RNG state to the save. Coordinate the version bump if both land in the same phase (one bump each, sequential migration steps).
