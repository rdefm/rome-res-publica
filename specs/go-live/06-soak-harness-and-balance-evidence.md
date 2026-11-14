# Spec 06 — Soak harness and balance evidence

**Source:** `plans/go-live-review-and-plan.md` §1, §2 B8, B9, §3.2, §3.3, workstream D · **Priority:** P0 · **Phase:** 1 — Prove
**Triage:** `ready-for-agent` (harness and NPC-career sample) · the hand-play programme is a human task tracked in the same spec
**Depends on:** spec 05 (seeded RNG) · **Feeds decisions:** §6.2, §6.5, §6.6

## Verified findings (checked against `917e1ae`)

1. **A store-level idle runner already exists.** `gameStore.runIdleSeasons(n)` (`gameStore.ts:1913`) ends `n` seasons with no player input. It drains event chains (first no-skill-check choice), fast-resolves in-session trials, accepts birth names and resolves engagements. It returns `{ seasonsCompleted, stuckReason }` and stops at `runFinished`. That covers most of a softlock detector.
2. **Multi-season store tests already exist.** `p5h.test.ts` drives 3+10 fresh guided starts through `endSeason` for target #3, and `p5g.test.ts` runs 12 auto-seasons for preset ordering. The idiom: the AsyncStorage jest mock, then `useGameStore.setState`/`getState`.
3. **`balance-checks.md` lists nine targets.** Targets #1 (minutes per season) and #2 (actions per season) are explicitly "cannot be checked by simulation" (they rely on wall-clock `SeasonStats.durationSec`) and are "Not evidenced" as of P5-H. Target #4 records Consul at 0% under heavy investment and names the fix: "a real multi-season `tickNpcCareers` sample … snapshot how many NPCs are actually Consul-eligible by, say, turn 40."
4. **NPC careers advance slowly and randomly.** `tickNpcCareers` (`electionEngine.ts:181`) advances an idle leader to the next eligible office only in Winter (`seasonIndex === 3`), with probability clamped to 0.05–0.75 from rhetoric and clan influence. The synthetic Consul pool in `scripts/electionSim.ts` (6 leaders who all already hold Praetor) is therefore probably denser than a real run produces. That's still unproven either way.
5. Seasonal pace stats (`seasonStatsHistory`) are recorded in the store and shown only in DebugPanel → Pace tab. There's no export path for hand-play data.

## Problem Statement

No one knows whether the game can be won, whether it can softlock 60 seasons in, or how long a season really takes to play. Every balance claim comes from short simulations or unit tests. The Consulship, which gates an ambition, a legacy track and the treaty menu, shows 0% reachability in the only sim that exists, against a rival pool nobody believes is realistic. The design lead is being asked to decide war timing, election randomness and event skill checks (§6.2, §6.5, §6.6) without data.

## Solution

Build a **soak harness**: many seeded, full-length idle runs per family and difficulty, driven through the real store. It asserts no crash and no softlock, and records ending distribution, highest office reached, NPC career progression (including how many NPCs are Consul-eligible over time) and economy curves. Run it in CI at a small sample size and on demand at full size. Then run a structured hand-play programme on devices to fill in targets #1 and #2, with a way to export the Pace data. Record every result, dated, in `balance-checks.md`.

## User Stories

1. As a developer, I want a command that runs N seeded full-length runs per family × difficulty and prints a summary, so that I can see run-level outcomes in minutes.
2. As a developer, I want the harness to fail loudly with the seed, family, difficulty and season when a run crashes or gets stuck, so that I can reproduce it immediately (via spec 05).
3. As a developer, I want "stuck" detected both as `runIdleSeasons`'s `stuckReason` and as "no season advanced", so that softlocks that don't throw are caught.
4. As a developer, I want a CI job running a small sample (for example 3 seeds × 3 families × 3 difficulties), so that a change that introduces a softlock fails the build.
5. As a balance designer, I want the ending distribution (victory / exhaustion / humbled / republic falls / gens ends) per family and difficulty, so that I can see whether all endings are reachable and how often.
6. As a balance designer, I want the highest office reached per run, for the player family, so that I can see the passive-play ceiling.
7. As a balance designer, I want a per-season snapshot of how many NPCs hold or are eligible for each office, so that the Consul question is answered with real career data.
8. As a balance designer, I want the election sim to take its rival pool from a soak snapshot at a chosen turn instead of the synthetic pool, so that the summit curve reflects a real run.
9. As a balance designer, I want Denarii, Fides and crisis-track curves per season (median and spread), so that "money has no early loop" and crisis drift are measurable.
10. As a balance designer, I want the harness to support a simple scripted "investing" policy (canvass, take available offices) as well as pure idle, so that the reach numbers aren't only from a player who does nothing.
11. As a balance designer, I want results written to a machine-readable file (JSON) as well as a printed table, so that I can compare runs over time.
12. As a design lead, I want a one-page summary per target in `balance-checks.md` with a date and the command used, so that I can make §6 decisions on evidence.
13. As a playtester, I want a short, written hand-play protocol (which start, how many seasons, what to note), so that sessions are comparable.
14. As a playtester, I want to export the Pace stats from a dev build (share sheet or copy to clipboard), so that my session data reaches the team without screenshots.
15. As a playtester, I want a session-log template (device, OS, build, family, difficulty, minutes per season, confusing moments), so that qualitative findings are captured too.
16. As a design lead, I want the hand-play programme to cover early, mid and late game, so that targets #1 and #2 are evidenced at every stage.
17. As a release manager, I want the airplane-mode and export/import device checks from the release checklist folded into the hand-play sessions, so that B9's pending items close in the same pass.
18. As a developer, I want the harness to reuse the real store and season pipeline, not a parallel simulation, so that it can't drift from the game.

## Implementation Decisions

- **The harness is a script plus a test**, built on the store's existing idle runner, not a new simulation:
  - A runner module (engine-adjacent, no React) that creates a fresh store state for a given seed, family and difficulty, starts a Free Start, and loops the idle runner until `runFinished` or a season cap (the full run, about 92 seasons, plus a margin; Endless Mode off). It collects a per-season metrics record.
  - An `npm run soak` script for full samples, and a Jest suite for the CI sample. Both call the same runner.
- **Metrics record (contract):**

  ```ts
  interface SoakRunResult {
    seed: number; gensId: GensId; difficulty: DifficultyId; policy: 'idle' | 'investing';
    outcome: EpilogueKind | 'stuck' | 'crashed' | 'cap';
    seasonsPlayed: number; stuckReason?: string; error?: string;
    highestPlayerOffice: OfficeId | null;
    perSeason: Array<{
      turn: number; denarii: number; fides: number;
      crisis: Record<CrisisTrackId, number>;
      npcOfficeCounts: Partial<Record<OfficeId, { holding: number; eligible: number }>>;
    }>;
  }
  ```

- **"Investing" policy:** a small, deterministic decision function (canvass when affordable, stand for the next eligible office, accept the first safe event choice). Kept deliberately simple; its job is a ceiling estimate, not optimal play.
- **Election sim integration:** `electionSim` gains an option to load a rival pool from a soak snapshot (by turn) instead of `rivalField()`.
- **Runtime budget:** the CI sample must stay under a fixed wall-clock budget (target about 60 seconds) so it can live in the CI from spec 02. If full runs are too slow, the CI sample uses a season cap and the full soak stays on demand.
- **Hand-play:** a protocol section and a session-log template appended to `docs/balance-checks.md`. The DebugPanel Pace tab gains an "Export pace data" action (dev and internal builds only, behind spec 02's debug flag).
- **No balance numbers change in this spec.** It produces evidence; tuning happens in spec 07 and after the §6 decisions.

## Testing Decisions

- **Seam: the store.** That's the highest possible seam and already the one `runIdleSeasons`, `p5g` and `p5h` use. No new seam. The CI suite asserts, for each sampled run: no `crashed` or `stuck` outcome, and `seasonsPlayed` reaches the 241 BC terminal evaluation or `runFinished`.
- **Determinism check:** the same seed twice gives an identical `SoakRunResult` (depends on spec 05). If this fails, it's a seeding gap to fix, not a test to loosen.
- The investing policy gets its own small unit test (given a state, it picks the expected action), because its correctness changes the meaning of the reach numbers.
- Good tests here assert run-level invariants (no softlock, all endings reachable across the sample), not exact distributions. Distributions go in the report, not in assertions, so balance changes don't break CI.
- Prior art: `p5h.test.ts` (multi-run guided starts, checks before `dismissSeasonOverlay()`), `battleSim.test.ts`, `campaignSim.test.ts`.

## Out of Scope

- Changing election math (spec 07).
- Changing war timing (§6.2, spec 08).
- Building production telemetry from hand-play (decision §6.9).

## Further Notes

- The plan's done-when: "every target in `balance-checks.md` has dated evidence, and the soak harness runs in CI."
- If the soak finds softlocks, each becomes its own bug ticket with the seed attached. Don't fix them inside this spec's branch (per CLAUDE.md's one-branch-per-plan rule).
