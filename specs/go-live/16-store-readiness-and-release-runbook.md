# Spec 16 — Store readiness and release runbook

**Source:** `plans/go-live-review-and-plan.md` §2 B10, workstream H · **Priority:** P0 for store paperwork, P1 for the rest · **Phase:** 3 — Ship (paperwork can start any time)
**Triage:** runbook and in-app wiring: `ready-for-agent` · **blocked on decisions §6.9** (crash reporting), **§6.10** (platforms) and **§6.11** (launch language) for their parts · listing copy, pricing and rating questionnaires are human tasks

## Verified findings (checked against `917e1ae`)

1. **Store paperwork was cut from scope.** `docs/release-checklist.md` (Phase 5, Chunk P5-I) states that store-listing content was removed from Phase 5. No privacy policy, age-rating answers, listing copy or screenshots exist in the repository. Confirmed by the plan; no such files found.
2. **The premium posture is audited and documented** in the same checklist: zero network calls (static audit, with a live airplane-mode device check still pending), zero timers and zero IAP. That makes the privacy policy simple, but it has to exist.
3. **The release checklist already has a repeatable pre-release QA list** (`docs/release-checklist.md` § "Repeatable pre-release QA list"), with items 3 (airplane mode) and 6 (export/import) still pending device sessions.
4. **Versioning:** there's no documented version or build-number policy. `app.json` and `eas.json` are the relevant files (tooling, in scope for this spec).
5. **All player-facing strings are inline English** in components and data. There's no i18n layer, so localisation scope (§6.11) is a significant fork.

## Problem Statement

Even a perfect build can't reach players without the store paperwork: a privacy policy URL, age-rating questionnaires, listing copy, screenshots and a price. None of it exists. Past the first submission, there's no written process for cutting a release: which version number, which test track, what to check, how to roll back. That's how a bad build reaches players, or how a good one sits unreleased because nobody is sure of the steps.

## Solution

Produce the store-submission package (privacy policy, rating answers, listing copy, screenshots, pricing) for each launch platform. Write a release runbook covering versioning, test tracks, the pre-release QA list, staged rollout and rollback. Record the design lead's decisions on crash reporting, platforms and launch language, and implement the small in-app pieces they require (a privacy and credits screen, and the opt-in toggle if telemetry is chosen).

## User Stories

1. As a prospective player browsing the store, I want an accurate description and screenshots, so that I know what kind of game this is before buying.
2. As a prospective player, I want the listing to state plainly "no ads, no in-app purchases, plays fully offline", so that I trust the purchase.
3. As a privacy-conscious player, I want a privacy policy stating exactly what the app collects (nothing, unless crash reporting is chosen), so that I can make an informed choice.
4. As a parent, I want an accurate age rating, so that I know the content is suitable.
5. As a player, I want a privacy and credits screen in Settings that links to the policy and lists asset credits, so that the information is in the app too.
6. As a player (if opt-in crash reporting is chosen), I want an explicit, off-by-default toggle with a one-line explanation, so that the offline promise stays my choice.
7. As a player (if store vitals only), I want nothing extra collected beyond what the platform does by default, and the policy to say so, so that the promise holds.
8. As a player updating the app, I want release notes that tell me what changed, so that I know whether an update affects my run.
9. As a release manager, I want a version and build-number policy (semver for the marketing version, a monotonically increasing build number), so that every build is traceable.
10. As a release manager, I want a step-by-step runbook from "cut a release" to "100% rollout", so that releasing is routine.
11. As a release manager, I want the pre-release QA list run against each release candidate and the results recorded, so that known-risk areas (saves, offline, export/import) are checked every time.
12. As a release manager, I want staged rollout percentages and a halt criterion (for example any save-loss or softlock report), so that a bad build is caught before it reaches everyone.
13. As a release manager, I want a rollback procedure, including what happens to saves written by the newer build (spec 04's `newerVersion` handling), so that rolling back never corrupts saves.
14. As a release manager, I want closed-beta steps (test track, tester list, feedback form), so that Phase 3's exit gate ("closed beta with no save-loss or softlock reports") is runnable.
15. As a design lead, I want the §6.9, §6.10 and §6.11 decisions recorded in the runbook with dates, so that later contributors know why.
16. As a marketing owner, I want a screenshot shot-list (which screens, which moments, which device sizes), so that screenshots can be reproduced for updates.
17. As a developer, I want the store metadata kept in the repo (text files under a store folder), so that listing copy is versioned with the build.
18. As a player in a non-English market (if §6.11 says English only), I want the listing to state the language plainly, so that I'm not surprised.

## Implementation Decisions

- **Store metadata in the repo:** a `store/` directory with per-platform listing copy (title, subtitle, short and full description, keywords, release-notes template), the screenshot shot-list, and the age-rating questionnaire answers as a reviewed document. Compatible with EAS Submit or fastlane metadata layouts if adopted later.
- **Privacy policy:** a short static policy reflecting the audited posture (no data collected, no network), hosted at a stable URL (the hosting choice is a human task). If §6.9 chooses opt-in telemetry, the policy and the store data-safety forms are updated to match.
- **Crash reporting (§6.9):**
  - *None, or store vitals only:* no code change beyond the policy.
  - *Opt-in:* add a crash-reporting SDK initialised **only** after the player opts in, with no network calls before consent. Add a persisted preference, stored outside the run save, like spec 11's settings. Update the offline section of the release checklist.
- **Platforms (§6.10):** the runbook covers each chosen platform's track names, review lead times and required assets. Web, if kept, gets a deployment section; if dropped, it's noted as unsupported.
- **Localisation (§6.11):** if English only, nothing is built and it's recorded. If more languages are chosen, that becomes a separate i18n spec (extracting strings from components and data). It's not part of this one.
- **Runbook:** `docs/release-runbook.md` covers the version and build policy, branch and tag conventions, EAS build and submit commands, the test-track flow, the pre-release QA list (linking to the existing checklist rather than duplicating it), staged rollout and halt criteria, rollback and save compatibility, and the closed-beta procedure.
- **In-app:** a "Privacy & Credits" entry in Settings showing the policy link and the credits table from spec 12.

## Testing Decisions

- This spec is mostly documents. The test is a **dry run**: a release manager follows the runbook end to end to an internal test track on each platform, and the run is recorded.
- **Seam (only if opt-in telemetry is chosen): the telemetry initialiser.** With consent false (the default), no SDK init occurs and no network module is touched. Prior art: the offline static audit in `docs/release-checklist.md`; this becomes its automated form.
- The Settings entry gets one render test using spec 15's harness.

## Out of Scope

- The accessibility pass itself (spec 15). This spec only records its results for store questionnaires.
- Building localisation.
- Marketing beyond the store listing.

## Further Notes

- The plan's Phase 3 exit gate is "store checklists complete; closed beta run with no save-loss or softlock reports". The closed beta depends on specs 02 and 04 (recovery and backup) being live, so that any report comes with a recoverable save.
