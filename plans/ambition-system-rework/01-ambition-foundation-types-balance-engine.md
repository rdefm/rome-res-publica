# 01 — Ambition foundation: types, balance constants, core engine

**What to build:** The full new ambition data model and the pure engine functions that operate on it — everything downstream tickets are built on top of. This ticket is the necessary horizontal foundation for a full type-shape replacement (the old ambition shape is read by several files at once, so there's no way to slice this vertically); it is not itself player-demoable, but it is fully verifiable through its own test suite. Old broken/stubbed definitions are deleted here rather than carried forward.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `AmbitionScope`, `AmbitionStatus`, `AmbitionSource`, `AmbitionCriterionId`, `AmbitionCriterion`, `AmbitionBaseline`, `AmbitionReward`, `ActiveAmbition`, `AmbitionProgress`, `AmbitionOffer` types exist matching the approved shape (see the spec's Implementation Decisions section for the exact interface contract — later tickets depend on these names precisely).
- [ ] `BALANCE.ambitions` registry is added with the deadline-pressure curve inputs, `failureRatio`, `failureDignitasCap`, a per-office `officeBaseline`, and `firstCharacterMult`/`firstFamilyMult` — every constant flagged as first-pass/unverified, no cooldown-related constant included.
- [ ] `checkCriterion` and `measureCriterion` correctly implement all nine criteria (`resource_threshold`, `office_held`, `clan_standing`, `asset_tier`, `client_count`, `battles_won`, `region_control`, `survive_seasons`, `trial_won`) — each criterion's checker and its description/measurement agree with each other (no drift like the old `great_orator`/`forge_alliance`/`grand_estate`/`survive_dynasty` bugs).
- [ ] `getProgress` returns a correct `{ current, target, label }` for every criterion.
- [ ] `computeDifficulty` implements delta-from-baseline × deadline-pressure for all non-office criteria; setting a target near the baseline value yields a difficulty score near zero.
- [ ] `computeReward` implements the office baseline plus first-for-character/first-for-family multiplier path for `office_held`, and the standard difficulty-scaled path for every other criterion.
- [ ] `nextEligibleElectionTurns` returns only Winter election turns that are structurally reachable given the office's term length and the current holder's remaining term.
- [ ] `buildAmbition` snapshots the baseline and freezes `reward`/`failureDignitas` at construction time (never recomputed later).
- [ ] `supersedeAmbition` sets status to `'superseded'`, returns a partial reward scaled by progress fraction (using the same current/target measurement as `getProgress`), and applies no `failureDignitas`.
- [ ] `tickAmbitions` resolves completion and deadline failure correctly, and separately supersedes any active `character`-scope ambition whose `assignedCharacterId` no longer resolves to a living family member — via one guard, not by hooking individual death code paths.
- [ ] `projectDynasticAmbitions` turns the current Legacy Objective state into read-only `dynastic`-scope `ActiveAmbition` rows.
- [ ] The `produce_heir`/`prosecute_rival` stub criteria and the old ambition-definitions data file are deleted outright.
- [ ] A new engine test file passes, with coverage for: one case per criterion (checker + measure + progress), the delta rule specifically, office first-time multipliers, `nextEligibleElectionTurns` against a mid-term office holder, deadline-pressure scaling, the failure-cost cap, `supersedeAmbition`'s payout at multiple progress fractions (0%, 50%, 100%), and the character-death guard in `tickAmbitions`.
- [ ] `npx tsc --noEmit` is expected to be red across the store and UI files that still reference the old ambition shape — state this explicitly in the end-of-task summary; it is expected fallout of this ticket, not a regression to fix here, and is resolved by ticket 02.
</content>
