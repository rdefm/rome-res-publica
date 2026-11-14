# Spec 07 — Election model: a real contested band and a reachable summit

**Source:** `plans/go-live-review-and-plan.md` §2 B8, §3.3, workstream D · **Priority:** P0 (B8) · **Phase:** 1 — Prove
**Triage:** **blocked on decision §6.5** (election randomness), and partly on §6.1 (office model) for the career-ladder stories · ready for agent once decided
**Depends on:** spec 05 (seeded RNG), spec 06 (NPC career sample, for tuning evidence)

## Verified findings (checked against `917e1ae`)

1. **The plan's "contested rate 0.000" is measuring something else.** `ElectionResult.contested` (`electionEngine.ts:236-245`, `:297-300`) means "the Constitution crisis is at tier ≥3, so rivals dispute the result". It's a crisis side-effect, not a measure of how close the race was. The election sim's state has a low Constitution track, so 0.000 is expected and says nothing about a tension band. The real evidence for cliffs is the win-rate table alone.
2. **Why outcomes are cliffs.** `resolveElection` (`:247-310`) compares the player's total (a fixed `PLAYER_BASE_SCORE` plus clients, locked-for votes and bonuses, plus `wordOfMouth` of 0–8) against each eligible NPC's `calcNpcElectionScore` ±4. Score gaps between investment postures are much larger than ±4 to ±8 of noise, so each posture lands far from the threshold and the result is near-deterministic.
3. **No closeness signal reaches the player.** `ElectionResult` returns `playerVotes`, `playerRank`, `seats` and the top rival's votes, but there's no margin or "too close to call" concept anywhere.
4. **Consul at 0%** under heavy investment (balance-checks target #4). It's measured against a synthetic pool of 6 Praetor-holders. `tickNpcCareers` (`:181`) may produce far fewer Consul-eligible NPCs in a real run; spec 06 produces that sample.
5. **Tribune is a separate system:** a plebs-mood-scaled roll inside `gameStore.endSeason`, not `resolveElection`. This is also one of the "game rules live in the store" findings in §4.4 (handled in spec 13).
6. **One office slot per household.** `currentOffice` and `campaigningCharacterId` are household-wide. `agendaEngine` and the Cursus screen both assume this.

## Problem Statement

Elections don't feel like races. With a given level of effort, the player either always wins or always loses an office. There's no band where a well-run campaign *might* win, so canvassing reads as "pay the toll" rather than "take a risk". The game never tells the player how close they are. At the top of the ladder, the Consulship appears unreachable, which cuts off an ambition, a legacy track and the treaty-negotiation menu. Nobody can yet say whether that's a tuning problem or a property of the synthetic test.

## Solution

After the design lead decides §6.5, give elections a deliberate **contested band**: a range of vote margins where the outcome is uncertain. Either:

- **(a)** a roll whose odds scale with the margin, or
- **(b)** deterministic outcomes with the threshold shown to the player.

Either way, the player can see how close they are before election day. Separately, rename the existing crisis "contested" flag so it stops being confused with closeness. Then use spec 06's real NPC career data to tune rival strength until the Consulship is a genuine but reachable summit.

## User Stories

1. As a player campaigning for office, I want to see an estimate of where I stand (safe / leaning / too close to call / behind), so that I can decide whether to spend more.
2. As a player, I want extra canvassing to move me through that estimate visibly, so that my spending feels like it matters.
3. As a player in a close race, I want the outcome to be genuinely uncertain (if the design lead chooses the roll model), so that election day has tension.
4. As a player (if the design lead chooses the deterministic model), I want to see the exact threshold I need, so that I can plan precisely.
5. As a player who loses a close race, I want the result screen to show the margin, so that the loss feels fair rather than arbitrary.
6. As a player who wins narrowly, I want that called out ("by a handful of centuries"), so that the win feels earned.
7. As a player aiming for Consul, I want the office to be hard but reachable with sustained investment over a career, so that the summit is a goal and not a wall.
8. As a player, I want the Agenda and Cursus to explain why I can't stand for an office yet (age, prerequisite, already in office), so that the ladder is legible.
9. As a player, I want a Constitution-crisis dispute of my win to be described as a dispute, not as a "contested" race, so that the two ideas don't blur.
10. As a player, I want rivals' strength to reflect the real political field (who actually holds offices in my run), so that the ladder responds to the world.
11. As a balance designer, I want the contested band's width as a single `BALANCE` constant, so that I can tune tension without code changes.
12. As a balance designer, I want the election sim to report, per office and posture, the share of races that fell inside the contested band, so that "is there tension?" has a number.
13. As a balance designer, I want to tune `RIVAL_STRENGTH_BY_OFFICE_RANK` against a real soak-derived rival pool, so that Consul tuning isn't based on a synthetic field.
14. As a design lead, I want a short evidence note in `balance-checks.md` showing the summit curve before and after tuning, so that I can sign off on target #4.
15. As a developer, I want `resolveElection` to return the margin and the band classification, so that UI and sims read the same numbers.
16. As a developer, I want the pre-election estimate to come from the same function as the resolution (minus the roll), so that the forecast can't drift from the result.
17. As a player using the Tribune path, I want the Tribune race to use the same closeness language, so that the two election types feel consistent (if the design lead wants Tribune folded in).
18. As a design lead, I want the office-model question (§6.1) kept separate from this spec, so that the election math can ship without waiting on a per-member careers redesign.

## Implementation Decisions

- **Rename** `ElectionResult.contested` to `disputed` (the crisis effect). Update `turnSequencer`'s `evt-election-contested` injection and the sim's `contestedRate` to `disputedRate`. This is a pure rename; behaviour is unchanged.
- **Add closeness to the result:**

  ```ts
  interface ElectionResult {
    // existing fields…
    margin: number;          // player total minus the vote total of the last winning seat (or first losing seat)
    band: 'safe' | 'leaning' | 'tossup' | 'behind' | 'hopeless';
    disputed: boolean;       // renamed from `contested`
  }
  function forecastElection(state: GameState): Pick<ElectionResult, 'margin' | 'band'>; // no roll
  ```

- **Model choice (§6.5):**
  - **Roll model:** inside the tossup band, the outcome uses a win probability that is a smooth function of margin. Outside it, the current near-deterministic noise stays. Band width and curve live in `BALANCE.elections`.
  - **Deterministic model:** the per-NPC and word-of-mouth noise is removed or fixed, and the Cursus campaign UI shows the exact votes needed.
- **UI:** the campaign surface in Cursus shows the forecast band with a glossary entry ("Too close to call"), and the election result surfaces the margin. Use theme tokens only.
- **Rival pool tuning:** retune `RIVAL_STRENGTH_BY_OFFICE_RANK` (and if needed `tickNpcCareers` advancement odds) against spec 06's Consul-eligibility snapshot. The target shape is the existing target #4 (low offices easy, Praetor and Consul genuine summits), with Consul above 0% under sustained heavy investment. The exact target percentage is the design lead's call.
- **Tribune:** moving its roll out of the store is spec 13's job. This spec only gives it the same band classification if §6.5 says so.
- **Glossary:** add or update terms for the band labels and "disputed election".

## Testing Decisions

- **Primary seam: `resolveElection` / `forecastElection` (pure engine functions).** Prior art: `electionSummitCurve.test.ts`, `commandElection.test.ts`. Tests:
  - The forecast and the resolution agree on `margin` and `band` for the same state (seeded RNG).
  - Margin monotonicity: more locked-for votes never lowers the margin.
  - Roll model: across many seeds, the tossup win rate falls strictly between the leaning and behind rates. Deterministic model: identical inputs give an identical result.
  - The `disputed` flag behaves exactly as `contested` did (regression test pinned before the rename).
- **Seam: the election sim** (`simulateElections`): reports `tossupRate` per office and posture. Add a test that at least one realistic posture produces a non-zero tossup rate at each contested office.
- **Seam: the soak harness (spec 06):** after tuning, the investing policy reaches Consul in a non-zero share of full runs. Report this rather than asserting it, so balance changes don't break CI.

## Out of Scope

- Per-family-member careers (decision §6.1). That's a separate spec if the design lead chooses it.
- The command election (`commandElection`). It's a separate vote with its own engine.
- Any new canvassing actions.

## Further Notes

- Fixing the "contested" naming confusion is worth doing even if §6.5 is delayed. It can land alone as a no-behaviour-change PR.
