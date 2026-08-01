# Tutorial Rebuild — Teach → Goal → Sandbox

**Status:** approved design, ready to implement
**Branch:** implement on `claude/imperium-debug-menu-4ktgyx` (explicit instruction — do **not** cut a new branch for this)
**Depends on:** `plans/ambition-system-rework-plan.md` — **ship and play-test that first.** This plan consumes its `ActiveAmbition`/`AmbitionCriterion` types, its `setAmbition` store action and its Agenda Tablet leaf. Starting this before that lands means building against types that don't exist.
**Supersedes (partially):** `plans/tutorialredesignplan.md` — that plan's four-arc spotlight system, predicate/effect registries and lesson machinery all **stay**. What changes is the shape of the guided path built on top of them.

The complaint this exists to fix: the current guided run is ~10 minutes of hard rail in which Philon does the interesting things *for* the player. The objection is **agency, not length** (design lead, explicitly). A longer tutorial in which the player actually acts is the correct trade.

Read §0 before writing any code.

---

## §0. Grounded findings (verified — do not re-derive)

**What already exists and is reusable as-is**

1. `src/models/tutorial.ts` — `TutorialArc`/`TutorialStep`/`TutorialState`, `TutorialRail = 'hard' | 'guided'`. The `rail` field already exists and is already the right axis for this plan's hard-vs-sandbox distinction.
2. `src/engine/tutorialEngine.ts` (612 lines) — `TUTORIAL_PREDICATES` (`:141`), `TUTORIAL_EFFECTS` (`:294`), `getStep` (`:468`), `getNextStep` (`:477`), `isStepSatisfied` (`:490`), `isTabSealed` (`:496`), `isWorldFrozen` (`:521`), `getEligibleLesson` (`:557`), `validateTutorialScript` (`:587`). **All reusable.** The predicate/effect registry pattern is exactly what sandbox goals need.
3. `src/data/tutorialScript.ts` (1044 lines) — five prologue acts with `actLabel`s at `:31, :109, :184, :247, :333`, plus embassy (`:447`), war (`:544`), courts (`:779`), and four lessons (`:927, :961, :997, :1014`). `TUTORIAL_ARCS` at `:1026`.
4. `validateTutorialScript` already fails a test on any step referencing an unknown predicate/effect/target (`:587-612`), asserted in `__tests__/tutorialEngine.test.ts`. **Every new step this plan adds is covered by that guard for free.**
5. `TUTORIAL_TARGET_IDS` (`:50-114`) is the registry of instrumented spotlight targets, with a well-documented rule: controls inside a native RN `<Modal>` cannot be spotlighted (they render above the overlay), so those steps are narration-only with a predicate advance. **Respect this** — it is why several existing steps look like narration when you'd expect a cutout.

**The world-freeze is all-or-nothing today**

6. `isWorldFrozen(s)` is literally `s.tutorial?.activeArc === 'prologue'` (`:521-523`). One boolean, whole prologue.
7. It gates **eight** things, documented in its own comment: random events, ambient crisis drift, war ignition, the Claudius demand block, births, natural mortality, passive bill resolution + auto-bill-injection, and `cityEngine.tickAllCities`'s `checkForeignWarDeclarations`. The last was added after a flaky pre-push test — a hostile foreign power could spontaneously declare war mid-prologue and derail the scripted sequencing.
8. **This is the single most important finding for §2.2.** "Curate the event pool instead of freezing" is not a small change: whatever replaces the boolean must still suppress all eight, or a known-flaky failure mode returns. Partial thaw must be *explicit per category*, not "let events through and hope."

**Arc chaining is linear and auto-advancing**

9. `TUTORIAL_ARC_ORDER = ['prologue', 'embassy', 'war', 'courts']` (`:35`). `advanceTutorialStep` (`gameStore.ts:3732-3801`) auto-chains into the next arc when one finishes (`:3757-3787`), only going idle after `courts`.
10. Lessons are deliberately **excluded** from `TUTORIAL_ARC_ORDER` (`models/tutorial.ts:11-21`) — `indexOf` returns `-1`, which the "no next arc" branch treats correctly as "just finish". This is the precedent for a non-chaining, standalone, replayable arc. **The act selector in §2.4 should follow it.**
11. `skipTutorialArc` (`:3803-3826`) cascades: skipping an arc marks it *and every downstream arc* complete, unlocks all tabs, sets `skipped: true`, and force-sets `philonAdvisoryUnlocked` (`:3824`) — because `courts.philon-handoff`'s own unlock effect would otherwise never fire, leaving Ambitions permanently dark for that save.
12. **§2.5's "end the tutorial, keep playing" option is `skipTutorialArc`'s existing behaviour.** Do not write a new one; wire the new UI to it.

**Tabs are sealed, not hidden**

13. `isTabSealed` reads `tutorial.unlockedTabs`; steps unseal via `TutorialStep.unlocksTab`. Current prologue order: Domus → Forum → Curia → Provinciae → Cursus (acts I-V). Accretive by construction already.

**Save schema**

14. `saveLoad.ts:195-209` validates the `tutorial` slice, with `activeArc` as a **closed enum** of the four arcs plus four lessons. Any new arc id added by this plan **must** be added there or saves mid-tutorial fail to load.

**Ambitions are held back during a guided run**

15. `philonAdvisoryUnlocked` gates `AmbitionSelectionModal` (`:70`, `:90`) and is only set by `courts.philon-handoff` — i.e. at the very end of the whole guided chain. §2.6 moves this earlier.

---

## §1. Design decisions (settled — do not re-open)

| # | Decision |
|---|---|
| Structure | **Accretive.** Every previously-taught mechanic stays live; the goal points at the newest one. |
| Pacing | Early sandboxes deliberately **short**. |
| Length | **~15-20 minutes, 3 teach beats** — not five. Provinciae/military and courts become just-in-time lessons on first contact. |
| World during sandbox | **Curated, not frozen.** Few/no random events early; the pool opens up as mechanics are introduced. The player must never sit pressing End Season with nothing to do. |
| Failure | The **first hard-guided beat cannot be failed.** Sandbox beats **can**. |
| Act selector | On tapping "start tutorial", the player sees **all acts/beats as options**. Locked until the previous is complete; **replayable** afterwards for recap without redoing the whole tutorial. |
| Refusal | In-tutorial the player **cannot refuse** an individual goal — but can always choose "end the tutorial and keep playing in open sandbox". |
| Presentation | Tutorial goals and player ambitions are the **same class on the same tablet leaf**. No distinct tutorial styling. |
| Player-set ambitions | **Unlocked partway through**, once the ambition system itself has been taught — not at the very end as today. |

---

## §2. Target design

### 2.1 Shape: three beats, each Teach → Goal → Sandbox

| Beat | Teaches | Goal (a real `ActiveAmbition`, `source: 'tutorial'`) | Sandbox |
|---|---|---|---|
| **I — The House** | Domus, Forum, income, relationships | "Hold 250 Denarii" (`resource_threshold`) | 2 seasons. Hard rail on the teach; free action in the sandbox. **Cannot be failed** (§2.3). |
| **II — The Chamber** | Curia: bills, votes, crisis tracks | "Pass a bill you voted for" (`trial_won`-style custom predicate — see §2.2 note) | 2-3 seasons. Can be failed. |
| **III — The Ladder** | Cursus: offices, canvassing, elections | "Win the Quaestorship" (`office_held`) | 3 seasons. Can be failed. |

Beats I-III replace prologue Acts I-V. **Provinciae and the Courts are cut from the guided path entirely** and become just-in-time lessons (§2.7) — that is what buys the 40min → 15-20min reduction without losing coverage.

Existing arcs `embassy`, `war`, `courts` **stay as they are** and continue to auto-chain after Beat III. They are already goal-shaped and already have real agency; this plan does not touch them.

> **Note on Beat II's criterion.** The eight-criterion set in the ambition plan has no "pass a bill" entry. Either (a) add a ninth criterion `bill_passed` there, or (b) use a tutorial-only predicate for this goal and give it a display-only ambition row. **(a) is preferable** — "pass a bill" is a goal players will want to set themselves. Raise it against the ambition plan before implementing Beat II; do not silently add a ninth criterion without that decision.

### 2.2 Curated world, not frozen world

Replace the single `isWorldFrozen` boolean with a **category-level gate**, preserving all eight suppression targets from §0.7:

```ts
export type WorldGateCategory =
  | 'randomEvents' | 'crisisDrift' | 'warIgnition' | 'claudiusDemands'
  | 'births' | 'mortality' | 'passiveBills' | 'foreignWarDeclarations';

export function isWorldCategoryFrozen(s: GameState, c: WorldGateCategory): boolean;
```

Per-beat policy:

| Category | Beat I | Beat II | Beat III | After |
|---|---|---|---|---|
| `randomEvents` | frozen | **curated pool only** | open | open |
| `crisisDrift` | frozen | open | open | open |
| `passiveBills` | frozen | open | open | open |
| `warIgnition` | frozen | frozen | frozen | open |
| `claudiusDemands` | frozen | frozen | open | open |
| `births` / `mortality` | frozen | frozen | open | open |
| `foreignWarDeclarations` | frozen | frozen | frozen | open |

"Curated pool" = `EventDef`s tagged with a new optional `tutorialSafe?: boolean` — events that touch only already-taught mechanics. Beat II draws from `tutorialSafe` events only; Beat III draws from the full pool. This is what stops the "taught one tab, now taking a Claudius blackmail demand" problem while still giving the player something to react to.

**Keep `isWorldFrozen` as a thin wrapper** (`isWorldCategoryFrozen(s, c)` for each c, all true) so the eight existing call sites can migrate one at a time rather than in one risky sweep.

### 2.3 Failure

- **Beat I cannot fail.** Implement as: no `deadlineTurn` on Beat I's ambition. It simply stays open until met. Nothing to strand a new player.
- **Beats II-III can fail.** Real `deadlineTurn`. On failure the tutorial-set ambition resolves `failed` (taking the ambition system's capped Dignitas ding), Philon acknowledges it in one narration beat, **and the beat still advances**. A missed tutorial goal never blocks progress and never retries — the run continues worse-off, which is the honest version and matches "sandbox beats can fail".
- Philon does **not** soft-rescue. Soft-rescue is the thing that makes a sandbox feel fake.

### 2.4 The act selector (new requirement)

On tapping "start tutorial" (and re-openable later from the same entry point), show a list of all beats:

- **Completed** — tappable, replays that beat's *teach* steps only (narration + spotlights), not its goal or sandbox.
- **Current** — tappable, enters/resumes.
- **Locked** — visible but greyed, with its unlock condition stated.

Replay implementation follows the lesson precedent (§0.10): a replayed beat is entered via `startTutorialArc`, is **not** in `TUTORIAL_ARC_ORDER`, so `advanceTutorialStep`'s "no next arc" branch ends it cleanly without chaining or re-awarding anything.

**Replay must be side-effect free.** Every beat's `onEnterEffectId`/`onCompleteEffectId` that grants resources, sets flags or seeds state must be skipped on replay. Cleanest way: a `tutorial.replayingArc: TutorialAnyArcId | null` field, checked in `applyTutorialEffect` — if set, return `{}`. Add it to `TutorialState` **and to `saveLoad.ts`'s tutorial slice** (§0.14).

Beat ids need to be real arc ids (`beat-house`, `beat-chamber`, `beat-ladder`) added to `TutorialArcId`, `TUTORIAL_ARC_ORDER` and the `saveLoad.ts` enum (§0.14). Missing the schema is a mid-tutorial save-corruption bug, not a type error — it will not be caught by `tsc`.

### 2.5 "End the tutorial, keep playing"

Always available from the act selector and from any beat's caption. Wire directly to the existing `skipTutorialArc` (§0.11-0.12): cascades downstream arcs complete, unlocks all tabs, sets `skipped: true`, unlocks Philon's advisory. No new action.

Copy should be explicit that the run continues — "Leave the guided path (your game continues)", not "Skip tutorial", which reads like abandoning the save.

### 2.6 When player-set ambitions unlock

Move `philonAdvisoryUnlocked` from `courts.philon-handoff` (§0.15 — the very end) to **the end of Beat II**. Rationale: Beat I's and II's goals *are* ambitions, so by the end of Beat II the player has watched two of them resolve on the tablet leaf and understands the object. Beat III then becomes the first beat where they could set their own alongside the tutorial's.

This satisfies "player can only set their own ambitions later in the tutorial, after we introduce it" without deferring it to the end of the entire guided chain.

### 2.7 Cut from the guided path → just-in-time lessons

Provinciae/asset-buying (old Act IV) and the Courts arc's teaching content are cut from the mandatory path. Add two lessons alongside the existing four (`getEligibleLesson`, `tutorialEngine.ts:557`):

- `lesson-province` — fires on first Provinciae city sheet open.
- `lesson-asset` — fires on first asset-purchase modal open.

Follow the existing `lesson-*` pattern exactly, including the `<flag>-taught` guard convention. The existing `courts` arc stays in the chain (it is a good arc); only its *prerequisite position* changes — it no longer has to be crossed before the player is free.

---

## §3. Chunks

### Chunk T1 — World gate
- `isWorldCategoryFrozen` + `WorldGateCategory` in `tutorialEngine.ts`; keep `isWorldFrozen` as a wrapper.
- Migrate the eight call sites (§0.7) one at a time; `turnSequencer.ts`, `cityEngine.ts`.
- `tutorialSafe?: boolean` on `EventDef`; tag an initial curated set.
- Extend `__tests__/tutorialWorldFreeze.test.ts` — it already exists and already guards this behaviour.

### Chunk T2 — Beat script
- Add `beat-house` / `beat-chamber` / `beat-ladder` to `TutorialArcId`, `TUTORIAL_ARC_ORDER`, `TUTORIAL_ARCS`, **and `saveLoad.ts`'s enum**.
- Author their steps in `tutorialScript.ts`, reusing existing targets where the old acts already instrumented them.
- Retire prologue Acts I-V (keep the file's five `LESSON_*` blocks and the three later arcs).
- New predicates/effects as needed — `validateTutorialScript` covers them automatically (§0.4).

### Chunk T3 — Goals as real ambitions
- Beat entry sets a `source: 'tutorial'` ambition via the ambition plan's `setAmbition`.
- Beat I: no deadline. Beats II-III: real deadlines (§2.3).
- Advance-on-failure narration beat.
- **Blocked on the §2.1 `bill_passed` criterion decision.**

### Chunk T4 — Act selector + replay
- `tutorial.replayingArc` on `TutorialState` **and `saveLoad.ts`**.
- `applyTutorialEffect` returns `{}` while replaying (§2.4).
- Selector UI at the tutorial entry point; "Leave the guided path" wired to `skipTutorialArc`.
- Test: replaying a completed beat grants nothing and does not re-chain.

### Chunk T5 — Lessons + unlock move
- `lesson-province`, `lesson-asset` (§2.7).
- Move `philonAdvisoryUnlocked` to end of Beat II (§2.6).
- Update `__tests__/tutorialLessons.test.ts`, `tutorialPrologueActs.test.ts` (which will need renaming/rewriting for the new beats).

---

## §4. Known-flaky test, pre-existing

`__tests__/tutorialPrologueActs.test.ts` → "Act V: declares Quaestor, canvasses Flaccus, wins the election…" failed once during unrelated work on this branch and did not reproduce across three subsequent full runs or in isolation. Its `canvassFlaccusUntilLocked` helper loops on a `Math.random()`-driven canvass roll. **Chunk T2 rewrites this file anyway** — take the opportunity to seed or inject the roll rather than porting the flake into the new beat tests.

---

## §5. Done when

- A new player reaches open sandbox in ~15-20 minutes having personally trained a character, courted a leader, voted a bill and won an election — with Philon never taking an action on their behalf.
- Every beat's goal appears on the Agenda Tablet's Ambitiones leaf, styled identically to a player-set ambition.
- Beat I cannot be failed; Beats II-III can, and failing advances rather than blocking.
- The act selector lists all beats, locks unearned ones, and replays completed ones with zero state side-effects.
- "Leave the guided path" works from anywhere and the run continues normally.
- Provinciae, assets, courts, battle, death and succession all teach on first contact.
- `npx tsc --noEmit` zero-error; `npm test` passes; no mid-tutorial save fails to load.
