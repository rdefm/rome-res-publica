# Go-live specs — index

These specs are split from `plans/go-live-review-and-plan.md` (one per row of its §8). Each follows the to-spec template (Problem Statement → Solution → User Stories → Implementation Decisions → Testing Decisions → Out of Scope → Further Notes). Each one opens with a **Verified findings** section checked against the code at `917e1ae`, per this repo's plan-doc convention.

**Triage label:** every spec is intended for `ready-for-agent`, except where a §6 design decision blocks it (marked below). A blocked spec's non-blocked parts can start.

| # | Spec | Workstream | Priority | Phase | Depends on | Blocked by §6 |
|---|---|---|---|---|---|---|
| 01 | [Platform upgrade and build ownership](01-platform-upgrade-and-build-ownership.md) | A | P0 | 0 | — | 10 (web only) |
| 02 | [Production hardening: fonts, splash, debug gating, error recovery, CI](02-production-hardening.md) | A | P0 | 0 | (04 for backup fallback) | — |
| 03 | [Presentation queue and season-end sequence](03-presentation-queue-and-season-end-sequence.md) | B | P0 | 0 | — | — |
| 04 | [Save integrity and migrations](04-save-integrity-and-migrations.md) | C | P0 | 0 | — | — |
| 05 | [Seeded RNG through the season loop](05-seeded-rng.md) | G | P1 → Phase 0 | 0 | — | (save-scum behaviour: design-lead review) |
| 06 | [Soak harness and balance evidence](06-soak-harness-and-balance-evidence.md) | D | P0 | 1 | 05 | — (feeds 2, 5, 6) |
| 07 | [Election model](07-election-model.md) | D | P0 | 1 | 05, 06 | **5**, (1) |
| 08 | [First-hour redesign](08-first-hour-redesign.md) | E | P1 | 2 | 03 | **2, 3, 8** |
| 09 | [Event history, cooldowns, skill checks and the Chronicle](09-event-history-and-chronicle.md) | E | P1 | 2 | 04, 05 | **6** (skill checks only) |
| 10 | [Battle screen revamp](10-battle-screen-revamp.md) | E | P1 | 2 | — | **13** |
| 11 | [Audio and haptics](11-audio-and-haptics.md) | F | P1 | 2 | 01, 03 | **12** (assets only) |
| 12 | [Art completion and asset pipeline](12-art-completion-and-asset-pipeline.md) | F | P1 | 2 | — | (14-style deletions) |
| 13 | [Store split and `processSeason` phases](13-store-split-and-season-phases.md) | G | P1 | 1 | 05 | — |
| 14 | [Content lint and typed effects](14-content-lint-and-typed-effects.md) | G | P1 | 1 | — | — |
| 15 | [Accessibility pass](15-accessibility-pass.md) | H | P1 | 3 | 03 | — |
| 16 | [Store readiness and release runbook](16-store-readiness-and-release-runbook.md) | H | P0 paperwork / P1 | 3 | 02, 04, 12 | **9, 10, 11** |
| 17 | [Documentation reset](17-documentation-reset.md) | I | P2 | 3 | 01, 13, 14 | **14** (deletions only) |

**Launch-blocker coverage:** B1 → 01 · B2, B3, B7 → 02 · B4 → 03 · B5, B6 → 04 · B8 → 06 + 07 · B9 → 06 · B10 → 16.

## Where these specs correct the review

Grounding against the code turned up these differences from `go-live-review-and-plan.md`. Each one is written into the relevant spec.

1. **Seeded randomness partly exists** (spec 05). `src/utils/seededRng.ts` (mulberry32) is already used across the battle engine and battle setup in the store. The gap is the season loop, not the whole game. The election sim seeds by monkey-patching the global `Math.random`.
2. **"Contested rate 0.000" doesn't measure closeness** (spec 07). `ElectionResult.contested` is a Constitution-crisis dispute flag (tier ≥3), not a tension band. Spec 07 renames it `disputed` and adds real margin and band reporting.
3. **Density-variant duplicates are 3 of 17, not systemic** (spec 12). Only `border-greek-key@3x`, `border-mosaic@2x` and `border-mosaic@3x` are byte-identical to their base.
4. **The client recruiting verb already exists, unwired** (spec 08). `gameStore.addClient` is documented as "player-initiated acquisition" with a slot cap, but no UI calls it. Decision §6.8 is about wiring and cost, not a new system.
5. **The blocking-condition copies have already drifted** (spec 03). The Agenda auto-open still uses the bare `pendingAmbitionScopes.length` check that `TutorialLayer` fixed, and skips `activeBattle`. None of the three copies checks `activeCityEvent`, `pendingEngagements` or `runFinished`.
6. **No hosted CI was a deliberate earlier choice** (spec 02). SITEMAP records the pre-push hook as chosen *over* GitHub Actions. Adding CI reverses that call, so it needs a design-lead OK.
7. **Additional layer-rule violations found:** `Math.random` in three data files (spec 05), `parseEffect` logic in `src/models/bill.ts` (spec 14), and `LogEntry` declared in the store rather than in models (spec 09).
8. **Chain-only ambitions are drawable as openers** (spec 08). This is the root cause of "Hold the Consulship a second time" being offered on turn one: `drawAmbitions` doesn't exclude `chainAmbitionId` targets.
9. **Counts:** 24 unselected `useGameStore()` calls in 19 files (the plan says "about twenty"). 233 color literals by a hex/rgba grep (the plan says 251). About 76 `as any` sites (the plan's 97 counts all casts).

## Test seams (to confirm)

The to-spec process asks for the seams to be checked with the user. The proposed seams, each the highest available and reusing existing ones where possible:

| Spec | Primary seam | New or existing |
|---|---|---|
| 01 | Full Jest suite + save fixtures | existing |
| 02 | One debug-tools constant; save provider | new (tiny) / existing |
| 03 | Pure `getPresentationQueue(state)` | **new** |
| 04 | Save provider + pure migration table | existing / **new** |
| 05 | `processSeason` determinism + golden tests | existing |
| 06 | Store via `runIdleSeasons` | existing |
| 07 | `resolveElection` / `forecastElection`; `simulateElections` | existing |
| 08 | `drawAmbitions`; store fresh-start; soak | existing |
| 09 | `pickRandomEvent`; store | existing |
| 10 | Pure battle view-model function | **new** |
| 11 | Moment→sound table; mocked audio/haptics services | **new** |
| 12 | Asset index modules + filesystem check | existing / **new** |
| 13 | `processSeason` golden tests; per-phase tests | existing |
| 14 | Content lint over static data; `applyEffectString` golden | **new** / existing |
| 15 | Shared accessible primitives; pure label builders; RNTL harness | **new** |
| 16 | Runbook dry run; telemetry init (if chosen) | manual / new |
| 17 | Repo-lint file (CLAUDE.md size claims) | shared with 05/13/14 |

A shared **repo-lint test file** (static checks: no `Math.random` in engines and data, no unselected `useGameStore()`, no unlabelled touchables, CLAUDE.md size claims) is proposed across specs 05, 13, 14, 15 and 17, so static guards live in one place.

## Publishing

The to-spec skill publishes each spec to the project issue tracker with the `ready-for-agent` label. No tracker is configured for this repo yet (`/setup-matt-pocock-skills` hasn't been run), so the specs live here as files. They can be published as GitHub issues on request.
