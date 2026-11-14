# Spec 13 — Store split and `processSeason` phases

**Source:** `plans/go-live-review-and-plan.md` §4.4, §4.5, workstream G · **Priority:** P1 · **Phase:** 1 — Prove (in parallel with spec 06)
**Triage:** `ready-for-agent` · **behaviour-preserving refactor:** any player-visible difference is a bug in this spec
**Depends on:** spec 05 (seeded RNG), which makes "behaviour-preserving" provable with golden tests

## Verified findings (checked against `917e1ae`)

1. **`gameStore.ts` is 5,563 lines.** CLAUDE.md says about 2,000. Confirmed.
2. **The store has 36 inline `require()` calls**, used to dodge import cycles (for example `endSeason`'s `require('../state/saveLoad')` and `addClient`'s `require('../engine/clientEngine')`). The `balance.ts` ↔ `electionEngine.ts` (via `data/offices.ts`) cycle is documented in `scripts/electionSim.ts:12-19` as a real TDZ crash under ESM.
3. **Game rules live in the store.** The Tribune election is resolved inside `endSeason` (`gameStore.ts:~1760-1800`, "Chunk 1B: resolve pending Tribune candidacy election"), against the layer rule.
4. **`processSeason` is one function of about 2,200 lines** (`turnSequencer.ts:155` to about 2,360). Its step comments have **duplicate and out-of-order labels**: two "7b" (`:934` Family House location bonuses, `:960` NPC consul tick), two "9b" (`:1214` survival_legacy, `:1453` Secrets tick), and "9c" (`:1077`) before the first "9b". Confirmed.
5. **About 76 `as any` sites** in `src/` (the plan's 97 counts all casts). Includes `useGameStore() as any` in `CursusScreen.tsx`.
6. **24 unselected `useGameStore()` calls across 19 files** (CursusScreen ×4, LegatumPanel ×2, CharacterActionModal ×2, and one each in ForumScreen, DomusScreen, ResourceBar, SeasonOverlay, SettingsModal, AmbitionSelectionModal and others). CLAUDE.md forbids this. `ResourceBar` is always mounted and recomputes income on every write.
7. **233 hex or `rgb(a)` color literals** in `src/components` and `src/screens` `.tsx` files (the plan says 251, counted differently).
8. Prior art for season-level tests: `commandTurnSequencer.test.ts`, `p5g.test.ts` (calls `processSeason` directly) and `engine.test.ts`.

## Problem Statement

The game's two central files have outgrown the people working on them. A season's 40-odd steps sit in one function whose own step numbers collide, so ordering bugs (a tick reading a value before another tick updates it) are hard to see and impossible to test in isolation. The store is two and a half times the size its own guide claims, hides real rules (the Tribune election) and works around import cycles with dozens of inline `require`s. In the UI, components that subscribe to the whole store re-render on every write anywhere in the app. Every future feature pays this tax, and the risk of a silent regression grows with each one.

## Solution

A behaviour-preserving refactor in three parts, proven by golden tests built on spec 05's seeded RNG:

1. **Season phases:** split `processSeason` into named phase functions with one ordering table, each individually testable, with unique names instead of numbered comments.
2. **Rules out of the store:** move store-resident rules (the Tribune election first) into engines, break the import cycles properly, and split the store into slices by tab (Domus, Forum, Cursus, Provinciae, Curia, plus shared/meta) composed into the single Zustand store.
3. **UI subscription and token cleanup:** convert every unselected subscription to field-level selectors and move color literals to theme tokens.

Finally, make CLAUDE.md's size and layer statements true again.

## User Stories

1. As a player, I want the game to behave identically after this refactor, so that engineering work never changes my run.
2. As a player, I want tabs to stay responsive late in a long run, so that the UI doesn't slow down as state grows.
3. As a player, I want the resource bar not to stutter when other parts of the game update, so that the interface feels smooth.
4. As a developer, I want each season phase to be a named function, so that I can read the season as a list of steps.
5. As a developer, I want the phase order defined in one table, so that reordering is a one-line, reviewable change.
6. As a developer, I want to unit-test a single phase with a constructed state, so that I can pin down one rule without running a whole season.
7. As a developer, I want each phase to report its ledger deltas, so that `SeasonOverlay` and `WelcomeBackModal` stay correct.
8. As a developer, I want phases to declare which state slices they read and write (documented, not enforced), so that ordering dependencies are visible.
9. As a developer, I want the Tribune election to live in an engine, so that the store is just state plus orchestration.
10. As a developer, I want no inline `require()` in the store, so that dependencies are visible and the bundler can tree-shake.
11. As a developer, I want the `balance` ↔ `electionEngine` cycle removed, so that scripts don't need an import-order hack.
12. As a developer, I want the store split into per-tab slice files composed into one store, so that I edit a slice of a few hundred lines, not a 5,500-line file.
13. As a developer, I want the store's public shape (field and action names) unchanged, so that no component or test needs to change because of the split.
14. As a developer, I want every component to subscribe with field-level selectors, so that a write in one tab doesn't re-render another.
15. As a developer, I want color literals replaced with theme tokens (using references for semantic aliases, per CLAUDE.md), so that retheming works.
16. As a developer, I want `as any` reduced on the paths this refactor touches (and a recorded count), so that type errors stop hiding.
17. As a reviewer, I want each part to land as its own PR with golden tests unchanged, so that I can review a refactor safely.
18. As the next agent, I want CLAUDE.md and SITEMAP.md to describe the new layout accurately, so that I'm not misled by stale sizes.

## Implementation Decisions

- **Phase contract** (indicative):

  ```ts
  interface SeasonPhaseContext { rng: SeasonRngs; ledger: SeasonLedgerBuilder; events: string[]; flags: { crossedNewYear: boolean; isWinter: boolean } }
  type SeasonPhase = (state: GameState, ctx: SeasonPhaseContext) => GameState;
  const SEASON_PHASES: ReadonlyArray<{ id: string; run: SeasonPhase }> = [
    { id: 'advance-calendar', run: advanceCalendar },
    { id: 'npc-careers', run: tickNpcCareersPhase },
    { id: 'player-election', run: resolvePlayerElectionPhase },
    // … one row per current numbered step, in today's order
  ];
  function processSeason(state: GameState): ProcessSeasonResult; // same signature as today, folds over SEASON_PHASES
  ```

  Phase ids replace step numbers. The existing step comments' content moves to each phase's doc comment. The two "7b" and two "9b" steps get distinct ids. **The order is preserved exactly as the code runs today**, not as the labels suggest.
- **Extraction method:** mechanical. Each step's body moves verbatim into a function and local variables become context or state fields. No logic changes in the same commit.
- **Tribune election** moves into `electionEngine` (or a `tribuneEngine`) as a pure function and becomes a season phase. The store's `endSeason` stops resolving it.
- **Store slices:** one slice creator per tab plus `meta` (start, save, settings, tutorial), using Zustand's slice pattern. `GameState` remains the union type. Field and action names are unchanged. Section comments move with their slices.
- **Cycle breaking:** `BALANCE.elections` (the re-export nothing consumes, per the sim script's comment) is removed or moved so that `data/offices.ts` doesn't import an engine. Inline `require`s become top-level imports once the cycles are gone.
- **Selectors:** convert all 24 unselected calls. Where a component needs many fields, use `useShallow`. `ResourceBar`'s income computation moves to a memoised selector.
- **Tokens:** move literals into `theme.ts` tokens, using reference aliases for semantic duplicates, never restated literals (CLAUDE.md rule). Provinciae first (the worst offender).
- **CLAUDE.md:** update the store-size statement and describe the slice layout. Update SITEMAP.md.

## Testing Decisions

- **Primary seam: `processSeason` (pure), with golden tests.** Before any extraction, record golden outputs: for each fixture save (`__tests__/fixtures/*`) and a set of seeds, the full `processSeason` result. After each refactor step, outputs must be deep-equal. This is the behaviour-preservation proof and needs spec 05.
- **Seam: individual phases.** New per-phase unit tests are written only for phases whose rules aren't already covered elsewhere. Don't duplicate existing engine tests. Highest value: the phases whose labels collided (7b, 9b, 9c) and the Tribune election.
- **Seam: the store.** The existing store-driving suites (`p5g`, `p5h`, `tutorial*`, `commandTurnSequencer`) must pass unchanged. Any test edit in this spec is a review flag.
- **Selector conversion:** a small guard test (or lint rule) fails on any `useGameStore()` with no selector argument. Spec 14's lint can absorb it.
- **Soak (spec 06):** a seeded soak sample produces identical results before and after.

## Out of Scope

- Any rule or balance change, including fixing ordering bugs discovered during extraction. Those get flagged as separate tickets, per CLAUDE.md's "name it, don't silently fix it".
- Typed effect tokens (spec 14).
- Splitting `events.ts` (spec 14).

## Further Notes

- Land in this order: golden tests, then phases, then the Tribune move, then cycles and requires, then slices, then selectors and tokens. Each step is a separate PR on this spec's branch or a stacked branch.
- If extraction reveals that a phase reads a value a later phase was meant to update first (an ordering bug), stop and flag it. Preserving behaviour wins inside this spec.
