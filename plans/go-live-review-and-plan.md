# Rome: Res Publica — Go-Live Review & Plan

**Date:** 2026-11-14 · **Reviewed at:** `ced7e7d` · **Lens:** game design + senior engineering

This is a top-level review and plan. It is meant to be split into specs (one per workstream below) and then into tickets. It does not prescribe balance numbers or UX details; where a decision belongs to the design lead it is listed in §6 instead of assumed.

---

## 1. Verdict

The game is **feature-rich and engine-solid, but not yet shippable.** Almost every system the design calls for exists and is unit-tested. What is missing is the layer between "systems work" and "a stranger can install it and have a good first hour": platform currency, presentation polish, modal/flow orchestration, save robustness, and — most importantly — evidence from real play.

Three facts frame everything else:

1. **Nobody has recorded a full run on a device.** `docs/release-checklist.md` still lists the airplane-mode session and the export/import flow as pending, and `docs/balance-checks.md` marks pacing targets #1 (minutes per season) and #2 (actions per season) as "not evidenced". Every balance claim so far comes from simulation or unit tests.
2. **The top of the career ladder may be unreachable.** `npm run sim:elections` (run for this review) gives a 0% Consul win rate even under heavy investment. The docs call this an open evidence gap, not a confirmed bug, but the Consulship gates an ambition, a legacy track, and the treaty-negotiation menu.
3. **The build targets a platform level the stores have moved past.** Expo SDK 51 / React Native 0.74 / Android target API 34.

**Estimated distance to a credible soft launch:** four phases (§7), of which the first two are mandatory. Phase 0 is mostly small, mechanical fixes.

### What is already strong (keep, don't rework)

- **Engine discipline.** `npx tsc --noEmit` is clean and all 1,475 tests pass in 60 suites (verified this review). Pure engines, a central `BALANCE` registry, and a pre-push hook that enforces both.
- **Design depth.** Secrets and the Dossier, the Basilica trial pipeline, the theatre-map war, succession, regency and the cadet branch, five written endings, the Hall of Ancestors and Laurels.
- **Honest premium posture.** No network calls, no timers, no IAP, all audited and documented.
- **Onboarding intent.** Philon's guided arcs, tab unsealing, just-in-time lessons, the Agenda Tablet, and a 94-term glossary.
- **Working balance tooling.** `sim:elections`, `audit:events`, the `p5g`/`p5h` regression suites, and `runIdleSeasons`.
- **Plan-doc culture.** Plans are grounded against code and record decisions. This document follows the same convention.

### How this review was done

- Read the README, manual, SITEMAP, CLAUDE.md, `docs/`, `plans/`, and the core code paths (`App.tsx`, `gameStore.ts`, `saveLoad.ts`, `turnSequencer.ts`, the event, election and agenda engines, the start menu).
- Ran the type check, the full test suite, the election sim and the event audit.
- Built the web export and played it in a headless 390×844 browser: start menu, guided start, free start, all five tabs, and the first season end.

**Not verified:** anything on a physical device or native build (performance, safe areas, haptics, the share sheet, Android back button), and any play beyond the first few seasons. Web rendering differs from native in places, so each visual finding below should be re-confirmed on a device before it is ticketed.

---

## 2. Launch blockers (P0)

These must be closed before any store submission. Each is detailed in the workstream noted.

| # | Blocker | Evidence | Workstream |
|---|---|---|---|
| B1 | Platform is out of date for store submission | Expo `~51.0.0`, RN `0.74.5`, `android/build.gradle` targets API 34 | A |
| B2 | Debug Mode is reachable by every player | `StartMenuScreen.tsx` renders "⚙ Debug Mode" and "Preview locked families" unconditionally | A |
| B3 | The display font is never loaded | No `useFonts`/`Font.loadAsync` anywhere; `theme.ts:149` claims `App.tsx` does it. Titles rendered in a fallback serif in the test build | A |
| B4 | Modals stack on top of each other | One End Season produced the war event, the ambition picker and the birth-naming modal all visible at once | B |
| B5 | A corrupted or invalid save is silently lost | `LocalSaveProvider.load` catches, logs, returns `null`; the player sees "No save found". Single slot, no backup | C |
| B6 | Starting a new game overwrites the existing run without warning | `handleStartPress` never checks `saveExists`; the next autosave replaces the slot | C |
| B7 | Crash screen shows a raw stack trace with no way out | `ErrorBoundary` in `App.tsx` prints `e.message + e.stack`, no retry or reload | A |
| B8 | Consul reachability is unproven | Election sim: 0% at every investment level | D |
| B9 | No full-run playtest evidence | Checklist and balance docs both list device sessions as pending | D |
| B10 | Store paperwork was cut from scope | Release checklist says store-listing content was removed from Phase 5; no privacy policy, rating, or listing copy exists | H |

---

## 3. Game design review

### 3.1 The first hour

The guided path is well thought out. The free start, and the moment the guided path lets go, are overwhelming.

- **Free Start opens with a required choice the player cannot evaluate.** The ambition picker appears before the player has seen any tab, and offered "Hold the Consulship a second time" to a family that holds no office.
- **The war can start at the end of season 1 on a Free Start.** "The Mamertine Envoys" fired on the first End Season of the test run. The manual says "within your first year or two".
- **Season-end is a pile-up, not a sequence.** The first End Season delivered a war event, an ambition re-prompt and a birth simultaneously (B4). Even once queued, three unrelated decisions in a row is a lot for turn one.
- **The Guided Path card undersells itself.** Its copy says "no tutorial screens", which no longer matches the spotlight-and-caption tutorial that ships.
- **Vocabulary load is high.** Five tabs, three sub-tabs in several of them, Latin labels for votes, and 94 glossary terms. The glossary is the right mitigation; the remaining work is deciding which terms a new player must meet in the first ten minutes and deferring the rest.

**Outcome wanted:** a first session in which each new decision arrives alone, with context, and the first real stake (the Claudius demand) lands as designed.

### 3.2 Core loop and pacing

- **Pacing targets have never been measured.** The 3–6 minutes per season and the per-stage action bands exist only as constants. A full run is roughly 92 seasons (264→241 BC), so the difference between 3 and 8 minutes per season is the difference between a 5-hour and a 12-hour run.
- **Money has no early loop.** A new game starts at 200 Denarii with +0 per season shown in the resource bar. `balance-checks.md` records the Brutii at −105 Denarii over twelve passive seasons. Players need a visible first step toward income.
- **Clients arrive only through random events.** A core Domus system with no direct player verb reads as luck, not strategy.
- **The win condition sits in a system some players will avoid.** All three non-failure endings are war outcomes. A player who plays politics and never takes the Command has their ending decided by an NPC commander. The political levers on the war (funding bills, the command vote, treaty ratification) need to be legible as "how a senator wins the war".

### 3.3 Elections and the career ladder

- **Outcomes are cliffs.** In the sim every office is 0% or ~100% at each investment level, and the "contested" rate is 0.000 everywhere. There is no tension band where a race could go either way.
- **Consul is at 0%** (B8). Either the synthetic rival pool is too strong, as the docs suspect, or the summit is genuinely out of reach. This needs the multi-season `tickNpcCareers` sample the docs already propose.
- **One office slot per household.** `currentOffice` and `campaigningCharacterId` are household-wide; `Character.officeId` is documented as dead for everyone but the Tribune. In a dynasty game the heir cannot build a career while the father serves, and succession resets the cursus. This is a design decision (§6), not a bug, but it should be made deliberately and explained to the player.
- **The Agenda gives a false lead.** On turn one it says "Livia Brutus could stand for Aedile". `agendaEngine.ts:188` skips the prerequisite check for non-player members with no held offices, so it recommends an office she cannot run for.

### 3.4 Events and narrative

- **Repetition is guaranteed.** The random pool is 82 events, one fires per season, and `pickRandomEvent` has no history or cooldown. Over ~92 seasons the same event will recur, and can recur back to back.
- **Skill checks are solved on sight.** `resolveEventChoice` compares the paterfamilias's skill to a fixed difficulty, with no roll. The same event gives the same result every time, and other family members' skills never matter.
- **There is no chronicle.** The store keeps a full `log` of the run, but no screen displays it (only the trial modal reads it). A dynasty game's history is one of its main payoffs, and the data already exists.
- **Internal ids leak into copy.** The ambition picker showed "Grants trait: great_orator" and doubled quotation marks around flavor lines.

### 3.5 War and military

- **Two military systems ship side by side.** The theatre map handles Carthage; provincial revolts still use the older campaign system. The manual needs a whole section to explain why. There are also two `musterEngine.ts` files.
- **The battle screen redesign is agreed but unbuilt.** `plans/battle-revamp.md` fixes a real readability bug (bar color keyed to unit class, not side) and has an open dependency decision (`react-native-svg`).
- **`EngagementInterstitial` is still marked TEMPORARY** in `App.tsx`'s comments; confirm whether that note is stale.
- **Map labels collide.** "CAPUA" and "BENEVENTUM" overlap, and "MESSANA", "SARDINIA & CORSICA" and "CISALPINE GAUL" are clipped or hidden behind nodes at 390 pt width.

### 3.6 Historical credibility

The audience for this game will notice naming. Roman women took the feminine form of the family name, and "Brutus" is a cognomen of the gens Iunia, so "Livia Brutus", "Julia Brutus" and "Gens Brutia" will read as wrong to that audience. Women also appear as candidates for magistracies. A newborn was suggested the name "Marcus Brutus" while his father of the same name is alive; that is authentic, but the family tree needs a way to tell them apart. All of this is flagged for decision in §6, not for unilateral change.

### 3.7 Replayability

One scenario, three families (two unlockable), three difficulties, five endings, the Hall and ~18 Laurels, plus Endless Mode. That is a reasonable premium launch. The risk is the event pool (§3.4) making a second run read like the first.

---

## 4. Engineering review

### 4.1 Platform and release engineering

- **SDK currency** (B1). Upgrade Expo and React Native to a currently supported pair. Confirm the exact Google Play target-API and Apple SDK requirements at submission time; both have moved since SDK 51 shipped.
- **`android/` is committed alongside a "managed workflow" README.** With a native folder present, EAS builds from it and `app.json` changes (such as `allowBackup`) only apply after a prebuild. Decide: delete and git-ignore `android/`, or own it as a bare project. The committed Gradle file also signs release builds with the debug config.
- **No CI.** The pre-push hook is the only gate and can be bypassed. A hosted workflow running `tsc` and `npm test` is cheap.
- **Unused dependencies.** `lottie-react-native` and `expo-app-loading` (deprecated) are installed and never imported.
- **No splash image**; `app.json` sets a background color only.
- **Web is undecided.** `react-native-web` is installed and the export works, but `Alert.alert` (still used in `MilitaryTab.tsx`) does nothing there. Either support web or stop carrying workarounds for it.

### 4.2 Flow orchestration

`App.tsx` mounts thirteen independent overlays, each self-gating on its own store field. Priority is documented in a comment, and the comment itself admits overlaps were left unhandled. The same list of blocking conditions is hand-copied into three places (the tutorial layer, the tutorial director, the agenda opener), and past bugs in the comments trace to those copies drifting.

**Outcome wanted:** one presentation queue that decides which blocking surface is on screen, with a single `isBlocked` selector everything else reads.

### 4.3 Save system

- **Validation is shallow.** `SaveSchema` uses `z.any()` for most nested shapes, and the parsed result is discarded, so schema defaults never apply. Real migration is a set of `??` fallbacks in `loadGame`.
- **`saveVersion` is stamped but never dispatched on.** There is no migration table.
- **Failures are invisible** (B5). Load, import and export failures are logged to the console; the player gets no message, or a misleading one.
- **One slot, no backup** (B5, B6). No rotation, no "previous season" copy.
- **Export writes more than save does.** `exportSave` serialises the whole state, including the transient fields `save()` strips.
- **Unbounded growth.** `log` is appended on nearly every action and never trimmed. The whole state is stringified on every background and inactive transition.

### 4.4 State and engine architecture

- **`gameStore.ts` is 5,563 lines**; CLAUDE.md describes it as ~2,000.
- **Game rules live in the store.** The Tribune election is resolved inside `endSeason`, against the layer rule. The store has 36 inline `require()` calls working around import cycles, and `balance.ts` ↔ `electionEngine.ts` is a documented circular import.
- **`processSeason` is one ~2,200-line function** with duplicated step labels (two "7b", two "9b"). Ordering bugs are hard to see and steps cannot be tested alone.
- **No seeded randomness.** `Math.random` is called 142 times across engines, data files and the store. Bugs cannot be reproduced from a save, and sims are noisy.
- **Stringly-typed effects.** Content uses tokens like `'gold+15|corruption+2'`. A typo is a silent no-op at runtime. `events.ts` is 3,734 lines.
- **97 `as any` / cast sites**, including `useGameStore() as any` in `CursusScreen.tsx`.

### 4.5 UI performance and consistency

- **About twenty unselected store subscriptions**, including `ResourceBar` (always mounted, and it recomputes income on every store write), `ForumScreen`, `CursusScreen` and `DomusScreen`. CLAUDE.md already forbids this.
- **251 hard-coded color literals** in components and screens; Provinciae is the worst offender.
- **Asset weight is 36 MB.** The `@2x`/`@3x` files checked are byte-identical copies of the base image. Portraits are ~700 KB PNGs. Some filenames are stray (`Portrait-claudii-5-m-child (1).png`, `marius-plumber.png`, `*_original.png`, `*-removebg-preview.png`).
- **Zero UI tests.** All 60 suites are engine or store tests.

### 4.6 Accessibility

No `accessibilityLabel` or `accessibilityRole` anywhere in the app. No handling of system font scaling. Several signals are color-only or icon-only (the crisis tiles show an icon and a number with no label), and some text is very low contrast (the vote labels on bill cards).

### 4.7 Documentation drift

- `SITEMAP.md` is 958 lines and has become a change log; many table cells run to hundreds of words.
- `README.md` lists orphaned files that no longer exist and says "no clips shipped" for a dependency that should simply be removed.
- Stale `TODO(P3-E)` comments point at an epilogue screen that now exists.
- Dead code: `components/shared/EndSeasonButton.tsx` (unimported), `data/warSites.ts` (unimported), `engine/aiScoring.ts` (imported only by a test).

---

## 5. Workstreams

Each workstream is sized to become one spec. Priorities: **P0** blocks launch, **P1** should ship at launch, **P2** can follow.

### A. Platform and release hygiene — P0

- Upgrade Expo / React Native; resolve the `android/` ownership question; fix release signing.
- Load fonts before first render, with a splash screen held until ready. Pick a body font that exists on Android.
- Remove debug entry points from production builds (gate on `__DEV__` or a build flag).
- Replace the error screen with a player-facing recovery screen (reload from last autosave, export save).
- Add hosted CI. Remove unused dependencies. Decide the web question.

**Done when:** a production build installs from a store test track on both platforms, shows the correct fonts, and exposes no debug affordance.

### B. Flow orchestration and season-end experience — P0

- Introduce a single presentation queue and one shared "blocked" selector.
- Define the season-end order as a designed sequence (recap → story event → family news → planning prompts).
- Fix the false Agenda lead and the leaked ids found in §3.

**Done when:** no two blocking surfaces are ever visible together, proven by a test that fires every modal trigger in one season.

### C. Save integrity — P0

- Keep a rolling backup of the previous good save and fall back to it on a failed load.
- Tell the player when a load, import or export fails, and why.
- Confirm before a new game replaces an existing run.
- Introduce a versioned migration table keyed on `saveVersion`; tighten the schema for the shapes that have broken before.
- Cap `log` and any other unbounded arrays; make export use the same field list as save.

**Done when:** a deliberately corrupted save recovers to the prior season with a clear message, and every fixture migrates through the table.

### D. Balance and playtest evidence — P0

- Build a soak harness: many seeded full-length runs per family and difficulty, asserting no crash, no softlock, and recording ending distribution, office reach, and economy curves.
- Close the Consul question with the multi-season NPC career sample.
- Run a structured hand-play program on devices and fill in pacing targets #1 and #2.
- Give elections a real contested band.

**Done when:** every target in `balance-checks.md` has dated evidence, and the soak harness runs in CI.

Depends on seeded randomness from workstream G.

### E. First-hour and UX polish — P1

- Rework the Free Start opening so the ambition choice comes after the player has context.
- Decide the war's start timing for Free Start.
- Fix the start-menu overlap, map label collisions, low-contrast labels and unlabelled crisis tiles.
- Add a Chronicle screen over the existing log.
- Add an event history with cooldowns; consider letting other family members' skills answer events.
- Build the agreed battle-screen redesign.

**Done when:** five first-time players reach the end of year one without asking what to do next.

### F. Audio, art completion and feel — P1

The game currently has no audio at all: no audio dependency and no sound assets.

- A minimal audio layer: ambient bed, UI sounds, stings for elections, verdicts, births and deaths, with a mute setting.
- Extend haptics beyond the one component that uses them.
- Finish placeholder art: portraits exist for two of five lineages, three of four house banners are placeholders, and on the Domus family cards the paterfamilias portrait is in a different style from the rest of the family.
- Compress and rename assets; generate real density variants or drop the fakes.

**Done when:** no screen shows a placeholder, and the install size has a stated budget that the build meets.

### G. Architecture hardening — P1, in parallel

- One seeded RNG passed through the engines and stored in the save.
- Move store-resident rules into engines; split the store into slices by tab.
- Break `processSeason` into named, individually tested phases with a single ordering table.
- Add a content lint that validates every effect token and event reference at test time.
- Convert unselected store subscriptions; move color literals to tokens.

**Done when:** a save plus a seed reproduces a season exactly, and CLAUDE.md's size and layer statements are true again.

### H. Store readiness and launch operations — P0 for paperwork, P1 for the rest

- Privacy policy, age rating, store listing copy, screenshots, pricing.
- Accessibility pass: labels and roles on every control, font-scaling behavior, contrast.
- Decide crash reporting against the offline promise (§6).
- Decide localization scope; all strings are currently inline English.
- A release runbook: versioning, test tracks, rollback, and the pre-release QA list already in `docs/release-checklist.md`.

### I. Documentation — P2

- Cut `SITEMAP.md` back to a map; move history into the plan docs.
- Correct CLAUDE.md, the README and stale comments; delete the dead files listed in §4.7 after confirming with the design lead.

---

## 6. Decisions needed from the design lead

These change what gets built. None has been assumed in this plan.

1. **Office model.** Keep one office slot per household, or give each family member their own career?
2. **Free Start pacing.** Should the war begin at the end of season 1, or after a grace period?
3. **Political path to victory.** Should a player who never commands an army be able to steer the war's outcome clearly, and through which levers?
4. **Legacy revolt system.** Keep it at launch, fold it into the theatre map, or reduce revolts to event chains?
5. **Election randomness.** Add a contested band with a roll, or keep outcomes deterministic and show the threshold?
6. **Event skill checks.** Stay deterministic, or add a roll and let other family members attempt them?
7. **Historical naming and women in office.** Correct to Roman convention, or keep the current simplification and say so?
8. **Client acquisition.** Add a direct recruiting action, or keep clients event-only?
9. **Crash reporting.** Opt-in telemetry, store-provided vitals only, or none? This touches the "zero network calls" promise.
10. **Platforms at launch.** iOS and Android together? Is web a supported target?
11. **Launch language.** English only?
12. **Audio scope.** Licensed, commissioned, or minimal UI sounds only?
13. **Battle revamp dependency.** Approve `react-native-svg`, or build with plain views?
14. **Dead-code removal.** Delete `aiScoring.ts`, `warSites.ts` and `EndSeasonButton.tsx`, or is any of them reserved?

---

## 7. Phasing

| Phase | Goal | Workstreams | Exit gate |
|---|---|---|---|
| 0 — Stabilise | Safe to hand to testers | A, B, C; seeded RNG from G | No P0 blocker from B1–B7 open; internal test-track build on both platforms |
| 1 — Prove | Know the game is winnable and well paced | D; rest of G in parallel | Soak harness green in CI; pacing and Consul evidence recorded; §6 decisions 1–6 made |
| 2 — Polish | A stranger enjoys the first hour | E, F | First-time-player test passes; no placeholder art; audio in |
| 3 — Ship | Store submission | H, I | Store checklists complete; closed beta run with no save-loss or softlock reports |

Phases 0 and 1 are not optional. Phase 2 can be trimmed to fit a date; the order of cuts should be battle revamp, then chronicle, then additional portraits.

---

## 8. Suggested spec split

One spec per row, each following this repo's convention of opening with findings verified against the code.

| Spec | From | Notes |
|---|---|---|
| Platform upgrade and build ownership | A | Includes the `android/` decision |
| Production hardening (fonts, debug gating, error recovery, CI) | A | Small; can ship first |
| Presentation queue and season-end sequence | B | Touches `App.tsx` and every root modal |
| Save integrity and migrations | C | Schema change; needs fixtures |
| Seeded RNG | G | Prerequisite for the soak harness |
| Soak harness and balance evidence | D | Produces the data for decisions 2, 5, 6 |
| Election model | D | After decision 5 |
| First-hour redesign | E | After decisions 2 and 3 |
| Event history and chronicle | E | |
| Battle screen revamp | E | Already specified in `plans/battle-revamp.md` |
| Audio and haptics | F | After decision 12 |
| Art completion and asset pipeline | F | Extends the existing asset manifests |
| Store split and `processSeason` phases | G | Behaviour-preserving refactor |
| Content lint and typed effects | G | |
| Accessibility pass | H | |
| Store readiness and release runbook | H | |
| Documentation reset | I | |

---

## 9. Unrelated findings surfaced during this review

Per the repo convention, these are named, not silently fixed. Nothing in the codebase was changed by this review.

- `agendaEngine.ts:188` recommends offices a family member cannot run for (§3.3). **Flagged for workstream B.**
- `theme.ts:149` says fonts load in `App.tsx`; they do not (§2, B3). **Flagged for workstream A.**
- `README.md` and CLAUDE.md contain statements that are no longer true (§4.7). **Flagged for workstream I.**
- Three unimported or test-only source files (§4.7). **Needs a design-lead decision (§6.14).**
