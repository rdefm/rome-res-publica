# Spec 05 — Seeded RNG through the season loop

**Source:** `plans/go-live-review-and-plan.md` §4.4, workstream G (first bullet) · **Priority:** P1, but pulled into **Phase 0** because spec 06 depends on it
**Triage:** `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **A seeded PRNG already exists. The plan's "no seeded randomness" is only partly true.** `src/utils/seededRng.ts` provides `makeSeededRng(seed)` (mulberry32), `rngInt` and `rngPercent`, and an `RngFn` type. The battle engine (`battleEngine`, `battleAi`, `clashEngine`, `abstractResolver`, `armyBattleBridge`, `battleSim`) already uses it, and `gameStore.ts` seeds stratagem hands and AI deployment from a battle seed (`:4646-4663`, `:5065-5069`, `:5115-5116`). About 19 engine functions already take an `rng: RngFn` parameter, several defaulting to `Math.random`.
2. **The season loop is unseeded.** `Math.random` appears 142 times in `src/`: 13 in `turnSequencer.ts`, 16 in `gameStore.ts`, and the rest spread across about 25 engines (election, event, trial, secret, campaign, inheritance, client, patron, ...).
3. **Data files call `Math.random`.** `data/offices.ts` (2), `data/clientNames.ts` (2) and `data/epilogueText.ts` (1). This is a layer-rule violation (data must be logic-free) as well as a seeding gap.
4. **The election sim seeds by monkey-patching.** `engine/electionSim.ts:74` replaces the global `Math.random` with a seeded function per trial. This works only because nothing else runs concurrently; it's a workaround for the missing parameter.
5. `pickRandomEvent` (`eventEngine.ts:160`) and the contested-election roll (`electionEngine.ts:299`) are the two rolls with the biggest effect on balance evidence, and both use the global.

## Problem Statement

When a tester reports "my Consul run softlocked in 248 BC", nobody can reproduce it, because every season's outcome depends on unrecorded global randomness. Balance sims are noisy and have to monkey-patch `Math.random` to get any repeatability. The soak harness (spec 06) can't assert anything stable without seeds. The battle engine already proved the pattern works; the rest of the game never adopted it.

## Solution

Extend the existing seeded-RNG utility through the whole season loop. The game state carries an RNG seed and a draw counter. Every random decision in engines, the season sequencer and the store draws from an RNG derived from that state, passed in as a parameter. Data files stop rolling dice. A save plus its seed reproduces the next season exactly.

## User Stories

1. As a developer, I want a save file plus its stored seed to reproduce the next season exactly, so that I can debug a bug report from a player's exported save.
2. As a developer, I want every engine function that rolls dice to take an `rng` parameter, so that tests can pin outcomes without patching globals.
3. As a developer, I want the election sim to pass a seeded RNG instead of replacing `Math.random`, so that sims are safe to run in parallel with other tests.
4. As a developer, I want a lint/test that fails if `Math.random` appears in `src/engine`, `src/data` or the season path of the store, so that the gap doesn't reopen.
5. As a QA tester, I want to see the run seed in the debug panel and in an exported save, so that I can attach it to a bug report.
6. As a QA tester (dev build only), I want to start a new game with a chosen seed, so that I can replay a reported scenario from turn one.
7. As a balance designer, I want sims to accept a seed range, so that two runs of the same sim produce identical tables.
8. As a player, I want reloading a save and replaying a season *not* to let me re-roll the same event by save-scumming, unless the design lead decides otherwise, so that choices carry weight. (Seeded state persists in the save, so reloading reproduces the roll.)
9. As a player, I want randomness to feel exactly as varied as before, so that seeding doesn't make runs repetitive. (New games get a fresh seed.)
10. As a player with an old save, I want it to load and get a fresh seed assigned, so that the change is invisible to me.
11. As a developer, I want battle seeds to derive from the run RNG, so that one seed reproduces the whole run, battles included.
12. As a developer, I want independent sub-streams (events, elections, NPC careers, battles), so that adding one roll in elections doesn't shift every event outcome after it.
13. As a developer, I want UI-only randomness (cosmetic variation, name suggestions shown before confirmation) to be either seeded or explicitly marked as cosmetic, so that it's clear what affects reproducibility.

## Implementation Decisions

- **Reuse `seededRng`**; don't introduce a new PRNG. Add a derivation helper (for example `deriveRng(runSeed, turnNumber, streamSalt)`), mirroring `battleAi.deriveAiRng`, so that each season and each stream gets a deterministic, independent RNG without threading mutable state through React.
- **Persisted state:** add `rngSeed: number` to `GameState`, set at `startGame` from a non-deterministic source (or from an explicit dev-only seed). Per-season derivation from `(rngSeed, turnNumber, salt)` means no draw counter needs persisting for season logic. Store actions that roll mid-season (player actions with chance outcomes) derive from `(rngSeed, turnNumber, actionCounter, salt)`, where `actionCounter` is a persisted per-season counter. This is a save-shape change: Zod schema plus a migration step that assigns a fresh seed to old saves (coordinate the version bump with spec 04).
- **Stream salts** are a const table (events, elections, careers, mortality, births, trials, secrets, campaign, battle, clients, ...) so streams don't collide.
- **Engine signatures:** every function that currently calls `Math.random` gains an `rng: RngFn` parameter. Default it to `Math.random` only temporarily during the migration; the end state has **no default**, so a missing RNG is a type error.
- **`processSeason`** constructs the stream RNGs at its top and passes them down. The store's mid-season actions construct theirs from the counter.
- **Data files:** move the random picks out of `data/offices.ts`, `data/clientNames.ts` and `data/epilogueText.ts` into the engines that consume them (data exports the pools; engines pick).
- **Election sim:** replace the global patch with a passed RNG.
- **Battle:** battle seeds derive from the run RNG's battle stream instead of being drawn independently.
- **Save-scumming:** the default behaviour (reloading reproduces the same roll) is a design-relevant change and is **flagged for the design lead** in the PR. If the design lead prefers re-rolls on reload, mix a per-session nonce into the salt instead. That's a one-line change in the derivation helper.

## Testing Decisions

- **Primary seam: `processSeason` (pure).** Highest seam, single function. Given the same input state including `rngSeed`, two calls produce deep-equal output. Then a fixture-based golden test: a known save plus seed produces a recorded summary of season-end state (event picked, election result, births and deaths). This is the plan's "a save plus a seed reproduces a season exactly" done-when.
- **Seam: the store, through `runIdleSeasons`.** Two fresh stores with the same seed, run for 20 idle seasons, end in deep-equal state (minus timestamps). Prior art: `p5h.test.ts` drives multi-season runs; `battleSim.test.ts` and `battleEngine.test.ts` already assert seeded determinism for battles.
- **Guard test:** a test that greps `src/engine`, `src/data` and the season path of the store for `Math.random` and fails on any hit not on a short, commented allowlist (cosmetic only). Spec 14's content lint can absorb this later.
- Existing engine tests that relied on `jest.spyOn(Math, 'random')` migrate to passing a seeded or fixed `rng`. That's mechanical, not new tests.

## Out of Scope

- Splitting `processSeason` into phases (spec 13). This spec only threads RNG through it as it stands.
- The soak harness (spec 06), which consumes this.
- Any change to probabilities or balance numbers.

## Further Notes

- Sequencing: this spec touches about 25 engines plus the store. Land it engine by engine behind the temporary `= Math.random` default, then remove the defaults in a final commit so the type checker proves completeness.
- The layer-rule violation in three data files is an unrelated-but-real finding (per CLAUDE.md convention); it's fixed here because the RNG work has to touch those calls anyway.
