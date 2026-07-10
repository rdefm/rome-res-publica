# Rome: Res Publica — Phase 3 Implementation Plan: The Arc

## 0. How to use this document

This plan specifies **Phase 3 of the design roadmap** (`rome-design-review-and-plan.md`, Part 3): the bounded campaign that gives a run a shape — a beginning (war ignites), an escalating middle (the First Punic War runs on the four-track crisis system), a climax (a terminal war outcome), and a scored ending (the epilogue), plus the dynasty-defining **succession** and **cadet-branch** machinery that makes failure survivable, and the **Hall of Ancestors** that carries a finished run into the next one. It is written in the exact style of `rome-phase1-implementation-plan.md`, `rome-phase2-implementation-plan.md`, and `rome-military-implementation-plan.md`, and is meant to be handed to a fresh implementation chat **together with the actual source files named in each chunk**.

**You are expected to implement ONE chunk per chat session.** When the user says "implement chunk P3-C of the Phase 3 plan", your workflow is:

1. **Read this entire document** (at minimum §0, §1, §2, the chunk itself, its dependencies' "Done when" criteria, and §Cross-Chunk Notes).
2. **Request the files** listed in the chunk's *Files to request* line. Do not guess at file contents you have not seen.
3. **Run the chunk's *Verify* list** against those files. If anything doesn't match this plan's assumptions — a missing field, a different function signature, an earlier chunk apparently not implemented — **stop and ask before writing code.** Also flag any ambiguity you find in the spec itself.
4. Implement the chunk. Engines are pure functions (no store access); UI contains no game logic; all tunable numbers go in `BALANCE` (never inline literals); content/data lives in `src/data/`.
5. Run `npx tsc --noEmit` and the test suite. Fix what you broke.
6. **Share every created or modified file in full** as output files, plus a short changelog note: files touched, deviations from this plan (with reasons), and any `BALANCE` values you added or adjusted.

### Baseline assumption

Phases 0, 1, and 2 are fully implemented. That means all of the following exist and this plan builds on them without re-deriving them:

- `crisis: CrisisState` with four tracks (`war` / `unrest` / `constitution` / `economy`), `crisisEngine.ts` (per-season track deltas, escalation, named-crisis lookup, status effects), and the per-track effect-token vocabulary that Phase 1/2 events already use.
- `flags: Record<string, boolean | number>` on `GameState`.
- The **agenda engine** (`agendaEngine.ts`, pure `GameState → AgendaItem[]`) + `AgendaTablet`/`AgendaBadge`; the **Season Ledger** (`models/ledger.ts`, `SeasonOverlay`, `LedgerBlock`); autosave and the guided start.
- `src/data/balance.ts` — the `BALANCE` registry (Phase 2). **Every tunable number in this plan goes here.**
- The **`injectNoticeEvent(defId, interpolations)` helper** (or the equivalent weight-0, single-choice, Philon-voiced interstitial pattern established in Phase 1's tutorial special-case and reused by Phase 2's tier-up / leader-death notices). Phase 3 consumes this heavily. If it is not a single reusable helper yet, make it one in P3-A and note it.
- The **family/succession primitives**: `Character`, `family` array, aging tick, `inheritanceEngine.ts` (birth eligibility, trait inheritance), and Phase 2's **leader-successor generator** pattern in the Forum (used here as a reference for procedural character generation).
- `legacyEngine.ts` + `legacyDefinitions.ts` (Legacy objectives/milestones/bonuses) and the resource migration to `fides` / `lifetimeDignitas` / `denarii` / `imperium` (no `gravitas`/`gratia` remnants).

If any of these are absent, **stop and reconcile** before proceeding.

### The military overhaul is NOT built (important scoping fact)

The military overhaul plan (`rome-military-implementation-plan.md`, "The Legate's Line", chunks M1–M11) is **not started**. Phase 3 therefore does **not** depend on any battle engine, `BattleUnit`, `warScore` field, or `WarState` from that plan. **Phase 3 owns and creates the strategic war state itself**, and models the war *abstractly* — it rides the four-track crisis system, war-funding bills, and scripted war events, never playable battles.

Phase 3 defines the canonical war model so that, **if** the military overhaul is ever built afterward, it plugs battles into Phase 3's war state rather than inventing a parallel one. Concretely (see §Cross-Chunk Notes → *Reconciliation with the military plan*): Phase 3 creates `src/models/war.ts` and `src/engine/warEngine.ts`; the military plan's M1 (`war.ts` types) and M9 (`warEngine.ts` + provisional scheduler) become an **extension** of these files, not a re-creation. The military plan's M9 "provisional scheduler" was always designed to be replaced by "the Phase 3A war script" — **this plan is that script.** A later military build supplies set-piece battles that move Phase 3's `warScore`; nothing else changes.

### Ground rules for the implementing chat

- Before writing anything in a chunk, read the files it names — especially `src/state/gameStore.ts` (state shape + actions), `src/engine/turnSequencer.ts` (the season-end loop — the manual documents ~21 steps; verify the current count and step order), and `src/data/balance.ts`.
- **Verify, don't assume:** the season-index mapping (this plan assumes 0=Spring, 1=Summer, 2=Autumn, 3=Winter and "year decrements at the Winter→Spring crossover; the game starts in 264 BC and counts down"); the exact per-track crisis-delta effect token (the flat `crisis±N` token in the event-writing guide is **stale** — Phase 0/2 split crisis into four tracks; confirm the real token, e.g. `crisisWar+N`, before writing any war event); how deaths currently process in the aging step and whether an extinction check already exists (the manual says extinction is *tracked but not enforced*); how `legacyEngine` totals Legacy; and the modal-mounting order in `App.tsx`.
- Engines pure, UI logic-free, content in `src/data/`, **no new spendable resources** (valid: `fides`, `denarii`, `imperium`, `lifetimeDignitas`). `warScore` is **not** a spendable resource — it is strategic state on `WarState`, never shown in the ResourceBar and never spent by actions.
- Event content follows `rome-event-writing-guide.md` exactly (tone, length, effect budgets, schema). Where this plan gives full copy, use it verbatim; where it gives a brief, write to the guide.
- All war narration Rome-side is voiced by **Philon** (dry, practical) in agenda/ledger/notice contexts; front-line dispatches (the few this phase has) are terse field-report voice, never Philon. (This mirrors the military plan's voice invariant so the two never clash if merged.)

### Chunk order

**P3-A → P3-B → P3-C → P3-D → P3-E → P3-F.** Each chunk ends with a compiling, playable, testable build. Dependencies:

- **P3-A** (war state + ripeness curve, foundation) → **P3-B** (the war arc content + resolution) — B needs A.
- **P3-C** (family succession + regency) is independent of A/B and could be built in parallel, but is sequenced here because **P3-D** (cadet branch) is the "no heir at all" tail of the same subsystem and needs C's plumbing.
- **P3-E** (endings + Hall of Ancestors) needs **B** (war terminal states) and **D** (failure endings) to have something to render.
- **P3-F** (Endless mode) needs **E** (the post-victory hook).

---

## 1. Design invariants (apply to every chunk)

1. **The war is abstract this phase.** `warScore` (−100…+100, positive = Rome ascendant) is moved only by: the war crisis track's trajectory, war-funding/peace bills passing or failing, and scripted war events. No battles. Keep every war-moving path routed through one pure function so a future military build has a single seam to feed.
2. **The calendar is the clock, not a rail.** The war *can* end early or run long, but resolving it is **hardest far from history and easiest near ~241 BC**. This is the *historical ripeness* curve (P3-A). The player is never told "you must wait until 241"; they feel it as thresholds that soften and Senate peace-pressure that rises as the years pass.
3. **Every ending is authored, none is a "Game Over" screen.** The three war outcomes (Victory / Peace of Exhaustion / Rome Humbled) and the two failure outcomes (The Republic Falls at Crisis-100, The Gens Ends at extinction) all resolve to the **same epilogue screen** with different content, and all five write a record into the Hall of Ancestors. A dark ending is still a *told* ending.
4. **Failure is survivable exactly once.** Family extinction offers a single per-run **cadet-branch continuation** (halved Legacy). Crisis-100 offers **no** continuation — it is a Republic-level ending, not a family one. A second extinction is terminal.
5. **The cadet is not a stranger.** The cadet-branch paterfamilias is lightly tracked from the run's start and surfaced by a rare event once or twice, so that if the player ever inherits him it feels like meeting someone they've met, not a spawn.
6. **Succession is theatre, not bookkeeping.** The paterfamilias dying runs a scripted sequence (death → funeral choice → heir confirmation → "the new master of the house" beat), reusing the notice/interstitial pattern. It is the dynasty fantasy's payoff and, by campaign length, is *forced* to occur at least once per run.
7. **Persist only what the design allows.** Between-run persistence is Hall of Ancestors records + Endless-unlock flag + (Phase 5's) achievements. **No meta-currency, no power creep.** The Hall is a trophy shelf, never a stat boost.
8. **Old saves must not break.** New `war`, `cadetBranch`, and Hall fields default-spread on load (Phase 1/2 established the load-normalisation pattern). A save begun before Phase 3 gets the war *caught up* to its calendar year on first load (P3-A specifies the catch-up).

---

## 2. System overview (read once, then trust the chunks)

**The war.** A `WarState` object holds `warScore`, a `phase` enum (a narrative stage keyed loosely to the calendar), a `weariness` accumulator, and `terminalOutcome` (null until the war ends). Each season, `warEngine.processWarSeason(state)` runs inside the turn sequencer: it reads the war crisis track's recent trajectory and any war-bill outcomes, nudges `warScore`, accrues `weariness` with elapsed years, recomputes the **historical-ripeness** factor from the current year, and checks whether `warScore` (or a crisis catastrophe) has crossed a *ripeness-adjusted* terminal threshold. Crossing one sets `terminalOutcome` and fires the epilogue. The war *ignites* via a scripted event in the first year or two (the Mamertine casus belli), not silently at turn 1, so it has a beginning beat. While active, war-funding bills and periodic war events give the player levers and drama; the four crisis tracks give the war its pressure and its cost.

**Historical ripeness.** A 0→1 factor that ramps as the in-game year approaches 241 BC. Near 264 it is ~0: terminal thresholds are extreme (you effectively cannot win or lose the whole war in three years). Near 241 it is ~1: thresholds contract to moderate values and Senate peace-pressure events appear. Past 241 the factor stays at 1 and `weariness` keeps climbing, so an overlong war becomes self-resolving (mounting war-crisis pressure pushes toward a negotiated end). This is the mechanism behind invariant 2.

**Succession.** When the paterfamilias dies (age, event, or — if military is later built — battle), a scripted sequence hands the household to an heir: eldest eligible son by default; choosing another costs family trust; an heir under 18 triggers a **regency** (spouse or eldest adult relative governs at an income penalty until the heir comes of age). Marcus is 42 at start and the war ends ~241; he will very likely die mid-run, so succession is essentially guaranteed to fire once.

**Cadet branch.** One collateral relative of the Gens Brutia is generated at run start and tracked minimally (`state.cadetBranch`), surfaced by a rare event so the player has *met* him. If the main line goes fully extinct, the player is offered a one-time continuation *as* the cadet — Rome, the war, the Senate, and clan relationships persist unchanged; only the family resets to the cadet's household, and Legacy is halved. Declining (or a second extinction) gives the dark "The Gens Ends" epilogue.

**Endings & the Hall.** All five terminal outcomes route to one **Epilogue screen**: a scored summary (Legacy totals, highest office reached, family-tree snapshot, Rome's fate) plus a procedurally-assembled paragraph — *what the historians wrote about the Gens Brutia* — assembled from run stats via a template-slot system (no AI). The epilogue writes a compact `AncestorRecord` to persistent storage; the **Hall of Ancestors** (reachable from the start menu) lists past runs. A **Victory** epilogue unlocks **Endless mode**, a post-241 sandbox toggle that resumes the same save with the war retired and crises left to run procedurally forever.

---

## Chunk P3-A — War State Model, Balance Tables & the Ripeness Curve

**Goal:** All war/ending types and every war-tuning number exist; `warEngine` computes ripeness, drift, weariness, and terminal detection as pure functions; `WarState` lives on `GameState` and ticks each season doing *nothing visible yet* (no ignition, no events — those are P3-B). Compiles; the only runtime change is that a `war` object exists and its numbers move. This is the foundation the arc rides on.

**Files to request:** `src/state/gameStore.ts` (state shape + `INITIAL_STATE`), `src/engine/turnSequencer.ts` (full step list), `src/engine/crisisEngine.ts` (track shapes + how per-season track inputs are composed), `src/models/crisis.ts`, `src/data/balance.ts`, `src/state/saveLoad.ts` (Zod schema + load normalisation), any existing military/campaign model the sitemap shows (`models/province.ts` campaign state — to confirm no `warScore`/`WarState` already exists).

**Verify before coding:**
- That no `WarState` / `warScore` already exists anywhere (grep). If a stub exists from earlier work, reconcile rather than duplicate and report.
- The exact way the current year is stored and decremented (assumed: a `year` field starting 264, decrementing at Winter→Spring). All ripeness math keys off this — confirm it.
- How `crisisEngine` composes each track's per-season input (P3-B will add one war-track term; P3-A only needs to *read* the war track's recent value, so confirm the read path).
- Whether `turnSequencer` already has a clean insertion point near the crisis/resource steps for a new `processWarSeason` step.

**Files to create:** `src/models/war.ts`, `src/engine/warEngine.ts`

**Files to modify:** `src/state/gameStore.ts` (state field + init), `src/engine/turnSequencer.ts` (new step), `src/data/balance.ts` (`BALANCE.war`), `src/state/saveLoad.ts` (schema + normalisation)

### `src/models/war.ts` — types (no logic)

| Type | Shape |
|---|---|
| `WarPhase` | `'not_started' \| 'opening' \| 'escalation' \| 'grinding' \| 'ripe' \| 'ended'` |
| `WarTerminalOutcome` | `'victory' \| 'exhaustion' \| 'humbled' \| null` |
| `WarState` | `{ status: 'inactive' \| 'active' \| 'ended'; phase: WarPhase; warScore: number (−100…100, init 0); weariness: number (0…100, init 0); ignitedYear: number \| null; endedYear: number \| null; terminalOutcome: WarTerminalOutcome; peaceOffered: boolean; lastDelta: number (for the ledger line) }` |

Add `war: WarState` to `GameState`; `INITIAL_STATE.war = { status: 'inactive', phase: 'not_started', warScore: 0, weariness: 0, ignitedYear: null, endedYear: null, terminalOutcome: null, peaceOffered: false, lastDelta: 0 }`. **The war does not ignite in P3-A** — status stays `inactive` until P3-B's ignition event flips it.

### `BALANCE.war` (new group)

Seed with (values are first-pass; P3-B/P3-E-adjacent tuning may revise, but record final numbers in a tuning note):

| Key | Meaning | First-pass |
|---|---|---|
| `startYear` / `historicalEndYear` | 264 / 241 | — |
| `ripenessFloorYears` | Years elapsed before ripeness begins climbing off 0 | 4 |
| `ripenessFullYears` | Years elapsed at which ripeness reaches 1.0 (≈ historical length) | 20 |
| `thresholds.victory` | `{ hard, easy }` warScore needed for Victory at ripeness 0 vs 1 | `{ 92, 55 }` |
| `thresholds.humbled` | `{ hard, easy }` warScore (negative) for Rome Humbled | `{ −92, −55 }` |
| `thresholds.exhaustion` | Weariness at/above which a negotiated Peace of Exhaustion becomes reachable (also ripeness-scaled) | `{ hard: 95, easy: 60 }` |
| `drift.fromWarTrackWinning` | warScore/season when war crisis track is low (going well) | `+1..+3` band |
| `drift.fromWarTrackLosing` | warScore/season when war crisis track is high | `−1..−3` band |
| `weariness.perYear` | Weariness added per elapsed war-year | `4` |
| `weariness.perHighCrisisSeason` | Extra weariness when war track ≥ tier 3 | `2` |
| `warTrackFeedback.winning` / `.losing` | The single term P3-B adds to the war crisis track from warScore trajectory | `−1` if warScore ≥ +20 / `+2` if warScore ≤ −20 |

### `warEngine.ts` — pure functions

- `computeRipeness(year): number` → clamp01((elapsed − floorYears) / (fullYears − floorYears)); elapsed = `startYear − year`. Past `historicalEndYear`, returns 1.
- `terminalThresholds(ripeness)` → interpolate each `{ hard, easy }` pair by ripeness (`hard + (easy − hard) × ripeness`). Returns the concrete victory/humbled/exhaustion cutoffs for this season.
- `phaseForYear(year, warScore)` → maps to `WarPhase` (opening: first ~3 years; escalation: mid; grinding: warScore stuck in a middle band for long; ripe: ripeness ≥ ~0.7). Phase is **cosmetic/agenda-flavour only** — no mechanic gates on it beyond copy selection.
- `processWarSeason(state): { warScore, weariness, phase, terminalOutcome, lastDelta }` (pure; returns the new war-relevant fields, the sequencer applies them). Logic: if `war.status !== 'active'`, return unchanged (delta 0). Else: read war-track tier, compute `warScore` drift (seeded per §invariant 1's single seam so a future military build swaps the drift source), accrue weariness, recompute ripeness → thresholds, and set `terminalOutcome` if `warScore ≥ victory` / `≤ humbled` / (`weariness ≥ exhaustion` **and** `|warScore| < victory-band`, i.e. a stalemate that has ground both sides down). **One and only one** terminal check may trip per season; victory/humbled take precedence over exhaustion. Cap the per-season `warScore` swing at a `BALANCE.war` max (mirrors the military plan's "Cannae rule" so the two never disagree; default ±12 for abstract drift, well under the military plan's ±25 battle cap).
- `warTrackContribution(warScore): number` → the single term P3-B feeds into `crisisEngine`'s war-track input composition (do **not** merge the systems — one additive term).

### Turn sequencer

Insert `processWarSeason` as one new step **after** the crisis-escalation step and **before** resource income (so a terminal outcome is known before income/aging, and the epilogue can be raised cleanly by P3-B/P3-E). Document the exact step number you chose. If `terminalOutcome` becomes non-null this season, set a `state.pendingEpilogue = terminalOutcome`-style signal for P3-E to consume (add the field now, unused until P3-E). Write the `lastDelta` for P3-B's ledger line.

### Save/load

Add `war` (and the `pendingEpilogue` signal) to the Zod schema. **Catch-up normalisation** for pre-Phase-3 saves: if `war` is missing on load, initialise it, then — if the save's current year is already past `startYear` — set `status: 'active'`, `ignitedYear = startYear`, and fast-forward `weariness` by `weariness.perYear × elapsed` and `phase` via `phaseForYear`, leaving `warScore` at 0. (A mid-run legacy save thus "joins" a war already in progress rather than starting a fresh one at, say, 255 BC.) Note this in a comment.

### Tests

Ripeness monotonic 0→1 across 264→241 and pinned at 1 past 241; threshold interpolation hits `hard` at ripeness 0 and `easy` at ripeness 1; `processWarSeason` no-ops when inactive; victory/humbled precedence over exhaustion; per-season swing cap binds; catch-up normalisation produces a sane active war from a 255-BC legacy save.

### Chunk P3-A — Done when

`war` exists and ticks silently while active (debug-flip `status` to watch `warScore`/`weariness`/`phase` move and a terminal outcome eventually set `pendingEpilogue`); ripeness and thresholds behave per the tests; no save crashes old or new; no player-visible change yet.

---

## Chunk P3-B — The War Arc: Ignition, Beats, Bills & Resolution Hooks

**Goal:** The war becomes a *played* thing. It ignites via a scripted event, wires its warScore into (and out of) the crisis system, gives the player war-funding and peace levers via bills, surfaces its state through the agenda and ledger, and — when P3-A's engine sets a terminal outcome — raises the appropriate notice and hands off to the epilogue (built in P3-E; until then, a placeholder notice). After this chunk, a debug run started in 264 can ignite, run for years on the crisis system, and reach all three terminal states.

**Files to request:** `src/data/events.ts` (format + how ignition/injected events fire), `src/engine/eventEngine.ts` (eligibility/injection), `src/data/billTemplates.ts` + the bill pipeline (`senateEngine`/`resourceEngine` bill resolution — verify names) + how the v2 plan injects special/auto bills, `src/engine/crisisEngine.ts` (war-track input composition point), `src/engine/agendaEngine.ts` (generator catalog + numbering), `src/models/ledger.ts` + `SeasonOverlay`, `warEngine.ts`/`war.ts`/`balance.ts` (P3-A outputs), Phase 2's `injectNoticeEvent` helper.

**Verify before coding:**
- The **real** per-track crisis effect token (guide's flat `crisis±N` is stale — find the war-track token, e.g. `crisisWar+N`).
- How the v2 plan injects a special bill into the Senate (the Tribune/Dictator work established injected-bill precedent — reuse that exact path for peace/war-funding bills; do not invent a second injection route).
- The one-shot flag/consumed-flag pattern (Phase 1's `peoples-champion` election-bonus precedent) — reuse it for any one-off war modifiers.
- Whether ignition should replace the season's random-event slot or run alongside it (match Phase 1's tutorial-event slot handling).

**Files to create:** `src/data/warEvents.ts` (ignition + periodic war events + terminal notices), plus war-bill entries (add to `billTemplates.ts` rather than a new file unless the pipeline requires otherwise)

**Files to modify:** `src/engine/crisisEngine.ts` (add `warEngine.warTrackContribution` as one war-track input term), `src/engine/turnSequencer.ts` (raise the terminal notice when P3-A set `pendingEpilogue`; ignition scheduling), `src/engine/agendaEngine.ts` (war generators), `src/models/ledger.ts` (warScore delta line), `src/data/glossaryTerms.ts` (War Score, War Weariness, the three outcomes), `src/data/balance.ts` (any bill costs/effects)

### B1. Ignition

A scripted event **`evt-war-mamertines`** (the Mamertine appeal — Rome's actual casus belli) fires in the **first or second year**, condition-gated (`war.status === 'inactive'` AND year ≤ 262 AND, ideally, after the tutorial year completes so it doesn't collide — verify the guided-start flag). Full multi-scene event to the writing guide; brief:

- *Opening scene:* envoys from the Mamertines of Messana beg Rome's protection against Syracuse and Carthage; the Senate is split; the player (as a rising member of the Gens Brutia) can speak for war, speak for caution, or stay silent. This is the war's beginning beat — write it as theatre, not a toggle.
- *All branches* ultimately ignite the war (history did): choosing war = `war.status → active`, `ignitedYear = year`, a warScore/opening bump and Optimates/Populares reaction; choosing caution/silence still ignites but with a small standing cost and a slightly worse opening warScore (Rome went to war anyway; you just weren't on the right side of it). Set `war.status` via a dedicated store action `igniteWar(openingWarScore)` — do **not** mutate war fields from event effect-strings directly (keep the war state owned by the store/engine). Add an effect token or a `nextEventId`→store-hook that the eventEngine already supports for "run this store action"; if none exists, add a minimal `igniteWar` effect token parsed in `resourceEngine`/eventEngine and note it.

### B2. Crisis coupling (one term each way)

- **Into** the war crisis track: add `warEngine.warTrackContribution(war.warScore)` as **one additional additive term** in `crisisEngine`'s existing war-track per-season input (losing war pushes the track up; winning eases it). One line; do not merge systems.
- **Out of** the war track: P3-A's `processWarSeason` already reads the war-track tier to drift `warScore`. Confirm the ordering in the sequencer so the read uses the track value *before* this season's escalation, or *after*, consistently — document which and keep it stable (recommend: drift reads the track value as it stood at start of the step, i.e. last season's settled tier).

### B3. War-funding & peace bills

Add to the bill pipeline (reusing the v2 injected-bill route):

- **`bill-war-funding`** (auto-available while `war.status === 'active'`): passing it eases the economy/treasury pressure of the war and nudges `warScore +` (Rome supplies its legions); failing/never-passing lets the war track climb. Costs treasury; Optimates favour, Populares wary (reuse clan bias fields). This is the player's routine war lever.
- **`bill-sue-for-peace`** (available only when `warEngine` reports a peace-reachable state — i.e. ripeness-scaled `weariness` high enough, surfaced via `war.peaceOffered`): passing it forces a **negotiated terminal outcome now** = Peace of Exhaustion (`terminalOutcome = 'exhaustion'`), regardless of warScore, *provided* warScore isn't already past a victory/humbled cutoff (in which case those take precedence and the bill is moot/withdrawn). This gives the player agency to *end* an overlong war rather than only riding warScore to a decisive edge. Populares favour peace, Optimates penalise it (the political drama the design wants: the Senate may refuse your peace).
- The **military overlap note:** if the military overhaul is later built, its M10 Senate-ratified treaty *replaces* `bill-sue-for-peace` with a richer terms menu; until then this single bill is the whole negotiation surface. Mark it with a comment so the future merge is obvious.

### B4. Periodic war events (`warEvents.ts`)

~4–6 events, `war.status === 'active'`-gated, seasonally flavoured (Summer = campaign season, per Phase 1 seasonal identity), each a real scene per the guide, each moving `warScore` modestly (respect the P3-A swing cap) and touching a crisis track. Suggested set (briefs, write to guide):

- A naval gamble (Rome builds its first real fleet — the historical *quinqueremes-from-a-wreck* story): treasury spend for a warScore swing, or decline.
- A grain-convoy raid threatening the plebs (Sicily theatre): warScore vs plebs/unrest tension.
- A legate's bold overreach: martial skill check; success = warScore+, failure = a war-track spike (and, if military is later built, a seam for a real battle here).
- A war-weariness murmur in the Forum (fires when weariness high): flavour that foreshadows peace-pressure.
- A Carthaginian peace feeler (fires near ripeness ≥ ~0.7): sets `war.peaceOffered = true` narratively and points the player at `bill-sue-for-peace`.

**Terminal notices:** when the sequencer sees `pendingEpilogue` set by P3-A, inject (via `injectNoticeEvent`) the matching terse dispatch → Philon-framed notice for **victory** / **exhaustion** / **humbled**, then hand to P3-E's epilogue. Until P3-E exists, the notice's single choice can dead-end at the current screen with a `TODO(P3-E)` comment; do **not** fake an epilogue here.

### B5. Agenda & ledger

- **Ledger:** a `warScore` delta line each active-war season ("The war in Sicily: [better/worse]" with the `lastDelta` sign), Philon-voiced.
- **Agenda generators** (register in `agendaEngine`'s catalog comment; **use ids #20, #21** — #15/#16/#19 are Phase 2's, #17/#18 are reserved by the military plan; see Cross-Chunk Notes for the peace-agenda reconciliation):
  - **#20 War status** (`info`, or `warning` when war track ≥ tier 2): "The war with Carthage" / one sentence on the current phase and whether it's going well; target Curia.
  - **#21 Peace opportunity** (`critical` when `war.peaceOffered`): "Carthage may treat for peace" / "A motion to sue for peace can pass the Senate now." target Curia. *(If the military overhaul is later built, this same generator #21 serves M9's intended "peace available" item — M9 should defer to it rather than adding #18.)*

### Tests

Ignition flips war active from all three branches with distinct opening warScores; the war-track term is present and signed correctly; `bill-war-funding` and `bill-sue-for-peace` availability gates match `warEngine`; `bill-sue-for-peace` passing sets `exhaustion` only when no decisive cutoff is already crossed; each terminal outcome raises the correct notice; agenda #20/#21 fire on their conditions; ledger war line appears only while active.

### Chunk P3-B — Done when

From a fresh debug game in 264, the Mamertine event ignites the war; across simulated seasons the war track and warScore interact coherently; war-funding and (late) peace bills appear and function; a run can reach **each** of Victory, Peace of Exhaustion, and Rome Humbled and raise the right terminal notice; agenda and ledger reflect the war throughout.

---

## Chunk P3-C — Succession Sequence & Regency

**Goal:** The paterfamilias's death becomes the game's emotional peak instead of silent bookkeeping: a scripted death → funeral → heir-confirmation → "new master of the house" sequence, plus a regency rule so a minor heir never soft-locks the line. Reusable for the natural-death case now and (if military is later built) the battle-death case.

**Files to request:** `src/state/gameStore.ts` (family array, who "the player character"/paterfamilias is, how control/`paterfamiliasId` is tracked), `src/engine/turnSequencer.ts` (the aging/death step), `src/engine/inheritanceEngine.ts` (eligibility/trait logic), `src/models/character.ts`, `src/data/events.ts` (+ Phase 2's `injectNoticeEvent`), `legacyEngine.ts` (for the funeral's Lifetime Dignitas effect), `src/components/domus/*` (whatever renders the paterfamilias identity).

**Verify before coding:**
- How the current paterfamilias is identified (a `paterfamiliasId`? the first living adult male? the "player" flag?) and how death currently removes a character in the aging step. **The succession sequence must hook exactly where a paterfamilias death is detected.**
- Whether heirs already have an ordering (eldest son) anywhere, or if this chunk introduces it.
- Whether an income/action penalty mechanism exists that a regency can reuse (e.g. a flag the resource engine reads), or if one must be added minimally.
- How the `injectNoticeEvent` interstitial handles a *sequence* of scenes (funeral → confirmation are two beats) — reuse the event branching (`nextEventId`) rather than three separate injections if the pattern supports it.

**Files to create:** `src/data/successionEvents.ts` (the scripted sequence)

**Files to modify:** `src/state/gameStore.ts` (a `succeedPaterfamilias(heirId, funeralChoice)` action + regency fields), `src/engine/turnSequencer.ts` (detect paterfamilias death → trigger the sequence instead of a silent removal), `src/engine/resourceEngine.ts` (regency income penalty term), `src/data/balance.ts` (`BALANCE.succession`), `src/data/glossaryTerms.ts` (Succession, Regency, Paterfamilias update)

### C1. Detection & trigger

In the aging/death step, when the character who **is** the paterfamilias dies, do not silently reassign. Instead set a `pendingSuccession` signal and inject the succession sequence (weight-0 events). All other family deaths keep their existing quiet handling.

### C2. The scripted sequence (write to the guide; this is authored content, high care)

Three beats, chained via `nextEventId`:

1. **Death card** — `evt-succession-death`. Philon brings the news; the room is described; the body text lands the loss (name, age, one remembered detail assembled from his traits/offices — e.g. "who wore the consul's toga twice" if he did; keep it template-light and robust to a paterfamilias with no offices). Single continue → funeral.
2. **Funeral choice** — `evt-succession-funeral`. Two guaranteed choices:
   - *A lavish laudatio funeral*: `denarii−[BALANCE]`, `lifetimeDignitas+[large]`, positive clan-relation nudge (the whole Forum attends). "The Gens Brutia spends what it must; Rome remembers the pyre."
   - *Modest rites*: keep the coin, small `fides−`. "A quiet burning. Practical. Philon approves; the Forum notices the economy."
   Then → heir confirmation.
3. **Heir confirmation** — `evt-succession-heir`. Body text presents the default heir (eldest eligible son). Choices:
   - *Confirm the eldest* (guaranteed): calls `succeedPaterfamilias(eldestId, funeralChoice)`.
   - *Name a different heir* (guaranteed, only shown if an alternative eligible relative exists): costs **family trust** (a `fides−` or a relationship/trait hit — reuse whatever "family trust" surfaces as in the codebase; if nothing does, apply a `fides−` and a note) and calls `succeedPaterfamilias(chosenId, funeralChoice)`. This is where the player can skip a weak eldest for a stronger younger sibling at a price.
   Terminal → a short **"the new master of the house"** beat (can be the successText of the confirm choice, or a fourth weight-0 card if you want the full theatre): the new paterfamilias's name and traits shown, one line of Philon handing over the household keys.

### C3. `succeedPaterfamilias(heirId, funeralChoice)` (store action)

Reassigns `paterfamiliasId` (or the control/player flag — match the codebase) to `heirId`; applies the funeral effects; recomputes anything that keys off "who is the paterfamilias" (notably Fides income — the manual's formula uses *paterfamilias rhetoric*, so income will change; that's intended and worth a ledger line). If `heir.age < 18`, enter **regency** (C4).

### C4. Regency

If the confirmed heir is under 18:
- Choose a **regent**: the spouse if living and adult, else the eldest adult relative; if none, the household still functions but at a steeper penalty (edge case — a boy-paterfamilias with no adult kin is rare; do not soft-lock, just penalise).
- Set `regency: { heirId, regentId, untilYear }` on state (untilYear = the year the heir turns 18).
- **Income penalty** while regency active: a `BALANCE.succession.regencyIncomeMult` (e.g. ×0.75 Fides) applied as a term in `resourceEngine`. Surface it plainly (agenda/ledger + glossary "Regency").
- At the yearly rollover, when the heir turns 18, clear `regency`, inject a short "[Heir] comes of age; he takes the household in his own name" notice, and restore full income.

### C5. Touchpoints

- **Agenda generator #22** (`warning`): a regency in effect and the heir within ~2 years of majority — "[Regent] governs in [Heir]'s name" / "Income is reduced until [Heir] comes of age in [year]." (Register #22 in the catalog comment.)
- **Ledger:** headline on the succession season and on the regency-ends season.
- Ensure P3-B's war and any active trials/elections **survive** a paterfamilias change mid-run (the successor inherits offices per the game's existing rules — verify a mid-term office holder dying is already handled; if the paterfamilias held an office, the manual says office clears on term end, but death is different — confirm and, if needed, clear his office on death with a note).

### Tests

Paterfamilias natural death triggers the sequence (not a silent removal); each funeral branch applies correct effects; confirming eldest vs naming another both produce a valid new paterfamilias; Fides income recomputes against the new paterfamilias's rhetoric; a minor heir enters regency with the income penalty and exits at 18; a paterfamilias with no offices and no remembered detail still produces sane death copy; no crash when the deceased held an office or an active trial/campaign.

### Chunk P3-C — Done when

Debug-killing the paterfamilias plays the full death→funeral→heir→new-master sequence; the household continues under the heir (or a regent, with the penalty, if the heir is a minor); income and offices reconcile; the run does not soft-lock under any tested death configuration.

---

## Chunk P3-D — The Cadet Branch (survivable extinction)

**Goal:** Family extinction stops being an untracked dead-end. One collateral Brutia relative is generated at run start, tracked minimally, and *met* by the player via a rare event; if the main line dies out entirely, the player may continue **once** as the cadet (Rome persists, family resets, Legacy halved), or take the dark "The Gens Ends" epilogue. This is the "no heir at all" tail of C's subsystem.

**Files to request:** `src/state/gameStore.ts` (family array, `paterfamiliasId`, Legacy access), `src/engine/turnSequencer.ts` (aging/death + where an extinction check would live), `src/engine/inheritanceEngine.ts` (eligibility — to define "no eligible heir"), Phase 2's leader-successor generator (as the procedural-character reference), `legacyEngine.ts`, `src/data/events.ts`, C's `successionEvents.ts` + `succeedPaterfamilias` (D reuses succession plumbing), `src/state/saveLoad.ts`.

**Verify before coding:**
- The precise definition of extinction the game should use ("no living family member eligible to be paterfamilias" — confirm eligibility: age? sex, given the historical frame? the codebase's existing rule wins). The manual says extinction is *tracked but not enforced* — **this chunk enforces it.**
- That C's `succeedPaterfamilias` can be reused for the cadet hand-off, or what it needs.
- How Legacy total is computed so "halve it" is a clean, reversible-on-nothing operation (a persistent `legacyPenaltyMult` field the epilogue reads is cleaner than mutating stored objectives — prefer that).

**Files to create:** `src/data/cadetEvents.ts` (the rare "meet the cadet" event + the extinction/continuation cards), `src/models/cadet.ts` (`CadetBranch` type) — or fold the type into `war.ts`/`character.ts` if the reviewer prefers fewer files; pick one and note it.

**Files to modify:** `src/state/gameStore.ts` (`cadetBranch` state + `generateCadet()`, `continueAsCadet()`, `cadetBranchUsed` flag + `legacyPenaltyMult`), `src/engine/turnSequencer.ts` (extinction check → continuation offer), `src/engine/eventEngine.ts`/`src/data/events.ts` (rare-event registration), `src/data/balance.ts` (`BALANCE.cadet`), `src/state/saveLoad.ts` (persist cadet + normalise old saves), `src/data/glossaryTerms.ts` (Cadet Branch)

### D1. `CadetBranch` — minimal tracked model

```
CadetBranch = {
  id: string;
  name: string;          // Brutia gens + a praenomen (reuse Phase 2's LEADER_PRAENOMINA pool)
  age: number;           // 25–40 at generation
  rhetoric, martial, intrigus: number;  // a reduced spread vs the main line
  trait?: string;        // one personality trait for flavour
  characterization: string;  // one authored-ish line assembled from trait/stats for events
  metCount: number;      // how many times the player has encountered him (init 0)
  standing: number;      // 0–100, the player's rapport with the cadet line (init ~40)
  alive: boolean;
}
```

Generate **once** at new-game start (guided and standard) via `generateCadet()` and store on `state.cadetBranch`. He is **not** in the playable `family` array (keeps Domus uncluttered and him non-controllable) — he is a tracked NPC of the same gens, referenced only by his events and the extinction path.

### D2. The rare "meet the cadet" event (`cadetEvents.ts`)

**`evt-cadet-visit`** — low `weight` (3–5), a long cooldown, and a **hard cap of ~2–3 fires per run** (gate on `cadetBranch.metCount < cap` via a flag/condition; increment `metCount` on resolution). A real scene to the guide: the cadet — *[name]*, "a Brutius of the lesser branch, [characterization]" — appears at the domus. Variants across fires so the second meeting differs from the first (a small favour asked; news from his estate; his son's coming-of-age). Each choice lightly moves `standing` and can give a tiny reciprocal benefit, but the **point is familiarity**, not mechanics. Keep effects small (guide §6.3 "small"). If `cadetBranch.alive === false` (he died of age in a long run — see D4), the event does not fire.

**Design note to honour invariant 5:** the copy should quietly establish that this man *is* of the gens and could, in extremis, carry the name — without telegraphing the failure mechanic. A returning player who never faces extinction still gets two atmospheric events about a distant cousin; a player who *does* has met him.

### D3. Extinction check → continuation offer

In the aging/death step, **after** all deaths resolve, if there is **no living family member eligible to be paterfamilias** (per the verified eligibility rule) and the succession sequence (C) therefore has no heir to confirm:

- If `cadetBranchUsed === false` **and** a cadet is available (`cadetBranch.alive`, or lazily regenerate one if he died — see D4): inject **`evt-cadet-succession`**, a two-choice card:
  - **Continue as the cadet branch** → `continueAsCadet()`: promote `cadetBranch` into a fresh `family` (the cadet becomes paterfamilias via C's `succeedPaterfamilias` path or an equivalent; optionally generate a minimal household — a spouse and/or a child — so the new line isn't a dead end waiting to happen; note the choice); set `cadetBranchUsed = true`; set `legacyPenaltyMult = 0.5` (halved Legacy, read at epilogue); **Rome, the war, crisis tracks, Senate, and clan relationships persist unchanged.** A "the name endures" beat. Reset his `metCount` context as appropriate.
  - **Let the Gens end** → set `pendingEpilogue = 'gens_ends'` (P3-E renders the dark "The Gens Ends" epilogue). Terminal.
- If `cadetBranchUsed === true` (a second extinction): **no offer** — go straight to `pendingEpilogue = 'gens_ends'`.

### D4. Cadet lifecycle edge cases

- The cadet **ages** with the years (increment at the yearly rollover) and can die of old age in a very long run; on death set `alive = false` and, optionally, quietly regenerate a *younger* cadet (his son) so the safety net persists — recommended, with a `BALANCE.cadet` age band. If you choose not to regenerate, D3 must lazily generate a fresh cadet at extinction time so the net never fails to catch. **Pick one and document it.**
- Guard every `cadetBranch` reference for `null`/`alive` (old saves, post-continuation state).

### D5. Persistence & old saves

Persist `cadetBranch`, `cadetBranchUsed`, `legacyPenaltyMult`. Normalise pre-Phase-3 saves on load: if `cadetBranch` is missing, `generateCadet()` (so even an in-progress legacy run gains a safety net); default `cadetBranchUsed=false`, `legacyPenaltyMult=1`.

### Tests

`generateCadet` produces a valid reduced-spread character; `evt-cadet-visit` fires at most the cap and increments `metCount`; extinction with an available cadet offers continuation; **Continue** promotes the cadet, halves the Legacy multiplier, and leaves war/crisis/clan state byte-identical; **Let the Gens end** sets `gens_ends`; a *second* extinction offers no continuation; the safety net never fails when the cadet died first (regeneration or lazy-gen path); old-save normalisation yields a valid cadet.

### Chunk P3-D — Done when

In debug: the cadet appears in a rare event (twice across a long run), and force-extincting the main line offers a one-time continuation that carries Rome forward under the cadet with Legacy halved; declining, or a second extinction, routes to the dark epilogue; no null-cadet crashes anywhere.

---

## Chunk P3-E — Endings: The Epilogue Screen & the Hall of Ancestors

**Goal:** All five terminal outcomes — the three war ends (P3-B) and the two failure ends (Crisis-100 here + Gens-Ends from P3-D) — resolve to one **scored Epilogue screen** with outcome-specific content and a procedurally-assembled "what the historians wrote" paragraph; each writes a persistent **AncestorRecord**; the **Hall of Ancestors** on the start menu lists past runs. This is the screen players screenshot.

**Files to request:** `src/state/gameStore.ts` (the `pendingEpilogue` signal from A/B/D + all the run stats the epilogue needs: Legacy, highest office, family tree, Rome stats/crisis, `legacyPenaltyMult`), `src/engine/crisisEngine.ts` (to add/confirm the Crisis-100 terminal detection), `src/engine/turnSequencer.ts`, `App.tsx` (full-screen modal-route pattern + modal ordering), `src/screens/StartMenuScreen.tsx` (to add the Hall entry), `src/state/saveLoad.ts` (a **separate** persistence key for cross-run records), `legacyEngine.ts`, `theme.ts`, a reference screen/modal for styling (`SeasonOverlay.tsx`, `EventModal.tsx`).

**Verify before coding:**
- That **Crisis-100** currently has "escalating penalties but no hard stop" (manual) — **this chunk adds the hard terminal**: when overall crisis (or a designated catastrophic track/aggregate — confirm how "crisis 100" reads post-four-track-split) hits the terminal, set `pendingEpilogue = 'republic_falls'`. Confirm the exact aggregate the four tracks roll up to, or define it in `crisisEngine` with a note.
- The cross-run storage mechanism (AsyncStorage per the sitemap) and that a **separate key** from the active-save is used (a finished/deleted run must not erase the Hall).
- How `legacyPenaltyMult` should apply to the displayed/stored Legacy score.

**Files to create:** `src/models/epilogue.ts` (`EpilogueOutcome`, `AncestorRecord`), `src/data/epilogueText.ts` (the template-slot historian-paragraph assembler + per-outcome framing copy), `src/engine/epilogueEngine.ts` (pure: build an `AncestorRecord` + the historian paragraph from `GameState`), `src/screens/EpilogueScreen.tsx`, `src/screens/HallOfAncestorsScreen.tsx`, `src/state/ancestorStore.ts` (or a small persistence module for the cross-run key)

**Files to modify:** `src/engine/turnSequencer.ts`/`App.tsx` (route to the epilogue when `pendingEpilogue` is set), `src/engine/crisisEngine.ts` (Crisis-100 terminal), `src/screens/StartMenuScreen.tsx` (Hall entry), `src/state/saveLoad.ts` (write the record; mark the finished save), `src/data/glossaryTerms.ts` (Hall of Ancestors)

### E1. `EpilogueOutcome` & detection

`EpilogueOutcome = 'victory' | 'exhaustion' | 'humbled' | 'republic_falls' | 'gens_ends'`. The first three arrive from P3-B via `pendingEpilogue`; `republic_falls` is set here by the Crisis-100 terminal; `gens_ends` arrives from P3-D. One consumer: when `pendingEpilogue` is non-null at the end of the season loop, present `EpilogueScreen` (full-screen route above the tabs; match `App.tsx`'s battle-less modal pattern) and mark the active save **finished** (so reopening the app goes to the start menu / Hall, not a dead board — unless Endless is taken, P3-F).

### E2. `epilogueEngine.ts` (pure) & the historian paragraph

`buildAncestorRecord(state): AncestorRecord` gathering: gens name, `foundedYear`/`endedYear`, `outcome`, **final Legacy** (× `legacyPenaltyMult`), highest office ever held in the family, number of paterfamilias generations, notable beats (offices, triumphs, trials survived/lost, whether a cadet continuation happened, Rome's final crisis posture), and a **family-tree snapshot** (compact — names + relations, enough to render).

`assembleHistorianParagraph(record): string` — a **template-slot** assembler (no AI): a few outcome-keyed opening templates × slot fills drawn from the record (e.g. "In the [outcome-phrase] of the war with Carthage, the Gens Brutia [rose to / clung to / fell from] [highest office]; men remembered [notable beat] and [notable beat]."). Author 3–4 templates per outcome in `epilogueText.ts` with graceful fallbacks for sparse runs (a family that achieved little still gets a coherent, if bleaker, sentence). This paragraph is the shareable payload — write it with care to the guide's register.

### E3. `EpilogueScreen.tsx`

Outcome banner (five distinct framings — Victory / Peace of Exhaustion / Rome Humbled / **The Republic Falls** / **The Gens Ends**; the last two are somber, not "you lose" — they are *told* endings per invariant 3), the scored block (Legacy total with the cadet penalty shown if it applied, highest office, generations, Rome's fate), the family-tree snapshot, and the historian paragraph. Actions: **To the Hall of Ancestors** (writes the record if not already, → Hall), and — **only on `victory`** — **Continue in Endless mode** (P3-F; render the button disabled/absent otherwise).

### E4. Hall of Ancestors persistence

`AncestorRecord[]` persisted under a **dedicated cross-run key** (never cleared by starting/deleting a normal save). `HallOfAncestorsScreen.tsx`: a list of past runs (gens, years, outcome badge, Legacy, one-line historian excerpt), tap → the full epilogue read-only. Entry point: a row on `StartMenuScreen`. **No mechanical carry-over** (invariant 7) — this is a trophy shelf. (Phase 5 adds achievements and alternate-family unlocks alongside it; leave room but don't build them.)

### Tests

Each of the five outcomes routes to the epilogue and writes exactly one record; `legacyPenaltyMult` halves the recorded Legacy after a cadet continuation; the historian assembler produces a non-empty coherent string for a maximal run and a near-empty run; the Hall key survives a save reset (write record → reset active save → Hall still lists it); Crisis-100 terminal fires once and only once.

### Chunk P3-E — Done when

Reaching any of the five terminal states shows the epilogue with correct scored content and a sensible historian paragraph, writes a Hall record, and returns cleanly to a start menu that lists it; only a Victory offers the Endless button; no double-records, no lost Hall on reset.

---

## Chunk P3-F — Endless Mode

**Goal:** After a **Victory** epilogue, the player can resume the *same* save into a post-241 sandbox: the war retires, the epilogue/terminal machinery stands down, and the four crisis tracks run procedurally forever. Cheap — the systems already tick indefinitely; this is a mode flag plus guards.

**Files to request:** `src/state/gameStore.ts` (the finished-save marking from E1 + war/crisis state), `src/engine/turnSequencer.ts`, `src/engine/warEngine.ts`, `src/engine/crisisEngine.ts`, `EpilogueScreen.tsx` (the Endless button hook), `src/state/saveLoad.ts`, `src/data/balance.ts`.

**Verify before coding:**
- Exactly what E1's "mark the save finished" does, so Endless can *un*-finish it cleanly.
- That nothing else keys off `war.status === 'ended'` in a way that Endless would break (e.g. agenda #20/#21 should stop firing once the war is retired).

**Files to modify:** `src/state/gameStore.ts` (`endlessMode: boolean` + `enterEndlessMode()`), `EpilogueScreen.tsx` (wire the victory-only button), `src/engine/warEngine.ts` (no-op while `endlessMode`), `src/engine/turnSequencer.ts` (skip terminal/epilogue checks while `endlessMode`), `src/engine/crisisEngine.ts` (optional escalating procedural pressure), `src/data/balance.ts` (`BALANCE.endless`), `src/data/glossaryTerms.ts` (Endless Mode)

### Spec

- `enterEndlessMode()` (called only from a Victory epilogue): set `endlessMode = true`, un-finish the save, set `war.status = 'ended'` / `phase = 'ended'` and stop war processing (`warEngine.processWarSeason` no-ops, war bills/events/agenda #20/#21 stop). The board reopens as a normal, ongoing game past 241 BC.
- **No epilogue/terminal detection while `endlessMode`** — Crisis-100 in Endless does *not* end the run (or, if you prefer a soft failure, define it in `BALANCE.endless` with a note; default: crises simply persist and punish, no hard end). Succession, cadet branch, and Hall records still function normally (a family can still die out — decide and document whether extinction in Endless offers the cadet path or simply lets the ongoing sandbox continue; recommended: it still offers the cadet once, consistent with P3-D).
- **Escalating procedural pressure** (optional, cheap): a small `BALANCE.endless` term that slowly raises baseline crisis-track input each year past 241, so Endless drifts toward harder rather than flat. Keep it gentle.
- The design's post-launch beat (the Second Punic War) is **explicitly out of scope** — Endless is the systems running on, not authored new content. Leave a comment marking Endless as the natural insertion point for a future authored war.

### Tests

Endless is offered only after Victory; entering it un-finishes the save and no-ops the war engine; no terminal outcome or epilogue fires while `endlessMode`; crisis, succession, and Hall still work; the optional escalation term (if built) raises pressure monotonically past 241.

### Chunk P3-F — Done when

From a Victory epilogue, "Continue in Endless mode" resumes the same save past 241 BC with the war retired and no further terminal endings; the game remains fully playable indefinitely; disabling paths (war bills/events/agenda) are cleanly silenced.

---

## Cross-Chunk Notes

- **`gameStore.ts`** is touched in every chunk — additive, in chunk order: `war` (A), `igniteWar` + war-bill hooks (B), succession/regency + `succeedPaterfamilias` (C), `cadetBranch`/`continueAsCadet`/`legacyPenaltyMult` (D), `pendingEpilogue` consumption + finished-save mark (E), `endlessMode` (F). Keep actions thin wrappers over pure engine functions.
- **`turnSequencer.ts`** gains: one war step (A, after crisis-escalation, before resource income), terminal-notice raising (B), paterfamilias-death → succession trigger (C), extinction check → cadet offer (D, *after* deaths resolve), `pendingEpilogue` → epilogue route + finished-save (E), endless-skip guards (F). Document the exact step indices; reuse the existing yearly-rollover gate (do not re-derive it) for regency-expiry (C), cadet aging (D), and any yearly war term.
- **The notice/interstitial pattern** (`injectNoticeEvent`) is reused by B (terminal notices, dispatch→Philon voice), C (succession sequence — but as a *branching multi-scene* event via `nextEventId`, not three injects), and D (cadet visit / extinction offer). Do not fork the helper.
- **Agenda generator numbering:** Phase 2 used #15/#16/#19; the **military plan reserves #17/#18**. Phase 3 uses **#20 (war status), #21 (peace opportunity), #22 (regency)**. Register all three in `agendaEngine`'s catalog comment. **Peace-agenda reconciliation:** the military plan's M9 intended #18 for "peace available"; since Phase 3 now owns the war, **#21 is the canonical peace item** — if the military overhaul is later built, M9 defers to #21 rather than adding #18.
- **Reconciliation with the military plan (`rome-military-implementation-plan.md`):** Phase 3 **creates and owns** `src/models/war.ts` and `src/engine/warEngine.ts`. If the military overhaul is implemented afterward, its **M1** (war types) and **M9** (`warEngine` + provisional scheduler) must be treated as **extensions** of these files, not re-creations: M1's `WarState` fields fold into Phase 3's; M9's `scheduleSetPiece` seam and battle-driven `warScore` movement plug into Phase 3's single warScore-drift seam (invariant 1); M9's crisis-coupling term is the same one Phase 3 added in B2 (do not add a second); M10's Senate-ratified treaty **replaces** Phase 3's `bill-sue-for-peace`. The Cannae-rule cap (military ±25) and Phase 3's abstract-drift cap (±12) coexist — battles may swing more than drift, both under their own caps. Anyone implementing the military plan after Phase 3 should read this note first.
- **Balance discipline:** every tunable added this phase lives in `BALANCE` (`war`, `succession`, `cadet`, `endless`). A magic number in engine/store code is a defect.
- **Old saves:** A (war catch-up), C (no persisted-shape change beyond regency fields — default-spread), D (`generateCadet` on missing cadet), E (Hall key is separate — nothing to migrate), F (`endlessMode` defaults false). One load-normalisation pass in `saveLoad.ts` covers them; follow Phase 1/2's established default-spread approach.
- **Do not build in Phase 3:** playable battles / any military-overhaul chunk (separate plan, not started); the secrets/blackmail system and trial-scene presentation (Phase 4); alternate starting families, achievements, difficulty presets, the event-count pass (Phase 5); the Second Punic War or any authored post-241 content (Endless is systems-only).

## Documentation updates (after all chunks)

`game-manual.md`: add a **"The Punic War" / campaign-arc** section (war ignites via the Mamertine crisis; runs on the crisis system; war-funding and sue-for-peace bills; the three war outcomes; the historical-ripeness idea in plain words — "the longer the war runs toward its natural end, the readier Rome is to resolve it"); rewrite **"Win Conditions and Failure States"** (extinction now enforced with the cadet-branch continuation; Crisis-100 now a real terminal — "The Republic Falls"; every ending is a scored epilogue, not a game over); add **Succession & Regency** under Domus (the death→funeral→heir sequence; minor-heir regency and its income penalty); add **Hall of Ancestors** and **Endless mode**; note in **Key Strategic Principles** that a run has a shape now — the war is the clock, and the family's survival across it is the game. Refresh `sitemap.md`: new files (`models/war.ts`, `models/epilogue.ts`, `models/cadet.ts`, `engine/warEngine.ts`, `engine/epilogueEngine.ts`, `data/warEvents.ts`, `data/successionEvents.ts`, `data/cadetEvents.ts`, `data/epilogueText.ts`, `screens/EpilogueScreen.tsx`, `screens/HallOfAncestorsScreen.tsx`, `state/ancestorStore.ts`), the new turn-sequencer step, and the new agenda generators #20–#22.

## Phase 3 — Done when (integration criteria)

1. A fresh run started in 264 BC ignites the war via the Mamertine event, runs the war on the four-track crisis system with war-funding and sue-for-peace bills as levers, and can reach **each** of Victory, Peace of Exhaustion, and Rome Humbled — with resolution demonstrably harder early and easier as the calendar nears 241 BC.
2. The paterfamilias's death plays the full succession sequence (death → funeral → heir → new master); a minor heir enters a regency with an income penalty and exits it at 18; the run never soft-locks on a death.
3. Total family extinction offers a **one-time** cadet-branch continuation (Rome/war/crisis/clans persist unchanged, Legacy halved) after the player has *met* the cadet in a rare event at least once; declining or a second extinction gives the dark "The Gens Ends" epilogue.
4. Crisis-100 produces the "The Republic Falls" epilogue (a told ending, not a game-over screen).
5. All five terminal outcomes render one scored Epilogue screen with a coherent procedural historian paragraph and write a single record to the Hall of Ancestors, which survives a save reset; a Victory epilogue offers Endless mode, which resumes the same save past 241 BC with the war retired.
6. `war.ts`/`warEngine.ts` are structured so a later military-overhaul build extends rather than replaces them (single warScore-drift seam, single crisis-coupling term, `bill-sue-for-peace` marked as the treaty precursor).
7. `npx tsc --noEmit` clean; all prior tests plus new war/succession/cadet/epilogue/endless tests pass; old saves load (war caught-up, cadet generated) without crashes.
