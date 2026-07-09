# Rome: Res Publica — Phase 2 Implementation Plan: Economy & Feel Rebalance (rev. 2)

> **Revision note:** this replaces the first Phase 2 plan. Two design decisions changed: (1) patron-tier action-cost scaling is **cut** — it taxed the growth the player earned; late-game surplus is instead absorbed by a new **Munificence (euergetism)** system of expensive aspirational sinks, and the per-season action band now *widens* with progress. (2) The governor policy presets chunk is **cut entirely** — the three sliders stay exactly as they are, no presets, no UI change to the Provinciae governance tab. Election difficulty balancing (praetor and consul as hard-won summits) is added to the tuning pass.

## How to use this document

This plan specifies Phase 2 of the design roadmap (`rome-design-review-and-plan.md`): **Patron Tier rework, Fides income diversification, deterministic training, relationship anchors + leader mortality, the Munificence system, and the action-economy tuning pass with instrumentation.** Written in the style of `rome-crisis-and-cursus-planv2.md` and `rome-phase1-implementation-plan.md`; hand it to a fresh implementation chat together with the actual source files per chunk.

**Baseline assumption:** Phase 0 (v2 crisis/cursus plan) and Phase 1 (mobile layer) are fully implemented: four-track `crisis`, `flags`, the agenda engine, Philon, the ledger, autosave, seasonal event weighting, and the guided start all exist. Several Phase 2 items surface through Phase 1 systems (agenda generators, ledger lines, glossary entries) — those touchpoints are called out per chunk.

**Ground rules for the implementing chat:**
- Before writing anything, read: `src/state/gameStore.ts`, `src/engine/patronEngine.ts`, `src/engine/resourceEngine.ts` (`calcResourceIncome`, `applyRelationshipDrift`), `src/models/patronLadder.ts`, `src/data/startingClans.ts`, `src/models/clan.ts`, `src/engine/electionEngine.ts` (rival generation + vote resolution), `src/screens/CuriaScreen.tsx`, `src/components/forum/PatronLadderPanel.tsx`, `src/components/domus/CharacterActionModal.tsx`, `src/data/legacyDefinitions.ts`, and whatever file defines office actions (for the Aedile/games reconciliation in P2-F).
- **Verify, don't assume:** the current Train Skill cost and where it lives, whether `ClanLeader` already carries an `age` field, the exact signature and call sites of `computePatronTier`, how `applyRelationshipDrift` iterates leaders, how v2's contested elections generate rivals, and whether the Aedile office already has a host-games action.
- Engines pure, UI logic-free, content in `src/data/`, no new spendable resources.
- **Design intent for the whole phase:** remove anti-fun rules (hoarding incentives, coin-flip progression, maintenance treadmills); let earned wealth stay earned, but give it *aspirational* places to go so late-game choices remain choices; make the season's action budget a *measured* number instead of an accident. Nothing here adds a tab; Munificence is the one new player-facing system and it lives inside an existing screen.

**Chunk order:** P2-A → P2-B → P2-C → P2-D → P2-F → P2-E. Tuning (P2-E) is deliberately **last** — it measures and adjusts the economy the other chunks produce, and it needs P2-F's sinks in place to tune the late game.

---

## Chunk P2-A — Balance Registry + Data Hygiene + Instrumentation State

**Goal:** One authoritative home for every tunable number; stale pre-refactor resource names purged; instrumentation fields in place. No gameplay changes.

**Files to create:** `src/data/balance.ts`, `src/models/telemetry.ts`

**Files to modify:** `src/data/legacyDefinitions.ts`, `src/models/ambition.ts`, `src/models/province.ts`, `src/state/gameStore.ts`, plus every file a constant is extracted *from*

### `src/data/balance.ts` (new) — the balance registry

A single exported `BALANCE` const object (grouped, commented) that becomes the only place tuning numbers live. Later chunks add their constants here; this chunk seeds it by **extracting existing scattered constants without changing their values**:

| Group | Contents (extract from) |
|---|---|
| `income` | Fides formula multipliers, `OFFICE_FIDES_BONUS` map (from `resourceEngine.ts` — move it here and re-export or import from here; update the sitemap's known-stale note accordingly) |
| `patron` | Tier thresholds + multipliers + client slots (values currently in `models/patronLadder.ts` — the definitions stay there structurally, but their numbers should read from `BALANCE.patron`; if that indirection is awkward, leave the numbers in `patronLadder.ts` and have `balance.ts` re-export them — pick one, document it at the top of both files) |
| `diplomacy` | All Forum action costs and relationship deltas (from wherever `buyInfluence`/`inviteToDinner`/etc. hardcode them — likely `gameStore.ts`) |
| `senate` | Bill action costs (vote/speech/filibuster/submit) |
| `elections` | Canvass costs and any rival-strength constants findable in `electionEngine.ts` (extraction only in this chunk; P2-E tunes them) |
| `training` | Placeholder for P2-C constants |
| `relationships` | Placeholder for P2-D constants |
| `munificence` | Placeholder for P2-F constants |
| `actionEconomy` | Placeholder for P2-E constants |

Rule for the implementing chat: extraction is mechanical — grep for the literal, replace with the `BALANCE` reference, keep values identical, run tests. If a constant is used in exactly one obscure place and extraction is disruptive, skip it and list it in a comment block at the bottom of `balance.ts` ("known un-extracted tunables").

### Data hygiene (the sitemap's known-stale items)

1. `legacyDefinitions.ts`: migrate all `gravitas` / `dignitas` / `gratia` bonus fields to `fides` / `lifetimeDignitas` equivalents. Preserve intended magnitudes; where an old bonus has no clean equivalent (e.g. a `gravitas` income multiplier), map it to the nearest Fides-side effect and log the mapping in a comment.
2. `models/ambition.ts` (`AmbitionReward`): same migration.
3. `models/province.ts` (`AssetBonus`): rename `dignitasPerTurn` / `gratiaPerTurn` fields to current-resource names; update all readers (`provinceEngine.calcAssetGoldOutput` and any asset bonus summation).
4. Delete `ForumScreen_original.tsx` (sitemap marks it safe).

### Instrumentation state (`src/models/telemetry.ts` + store fields)

Local-only playtest telemetry — **no network, no remote analytics** (premium/privacy posture; this data is for the developer's own tuning via the debug panel).

`SeasonStats` type: `{ turnNumber, durationSec, meaningfulActions, fidesIncome, fidesSpent, denariiIncome, denariiSpent }`.

Add to `GameState` / `INITIAL_STATE`:

| Field | Type | Purpose |
|---|---|---|
| `seasonStartedAt` | `number` (epoch ms) | Set on new game and after each `endSeason` |
| `actionsThisSeason` | `number` (0) | Incremented by the store on each *meaningful* action (list in P2-E) |
| `fidesSpentThisSeason`, `denariiSpentThisSeason` | `number` (0) | Incremented wherever the store deducts those resources for a player action |
| `seasonStatsHistory` | `SeasonStats[]` (`[]`) | Ring buffer, cap 40 entries; `endSeason` pushes the completed season's stats before resetting the counters |

Persisted with the save (Phase 1 autosave picks it up automatically). Exclude nothing — it's small.

### Chunk P2-A — Done when

`tsc` clean, all tests pass, gameplay byte-identical, `DebugPanel` can dump `BALANCE` and `seasonStatsHistory`, no remaining references to `gravitas`/`gratia`/old `dignitas` field names anywhere in `src/`.

---

## Chunk P2-B — Patron Tier Rework

**Goal:** Patron Tier is gated by **Lifetime Dignitas only**. Spending Fides can never demote you. Tier gain becomes a celebrated moment.

**Files to modify:** `src/engine/patronEngine.ts`, `src/models/patronLadder.ts`, `src/components/forum/PatronLadderPanel.tsx`, `src/engine/turnSequencer.ts` (step 10 area), `src/data/events.ts` or `tutorialEvents.ts`-style notice, `src/data/glossaryTerms.ts`

### Rule changes

1. **`computePatronTier`** takes Lifetime Dignitas only (change signature; update all call sites — grep for it). The `requiresFides` column is removed from `PATRON_TIER_DEFINITIONS` (or retained as a deprecated field set to 0 if removal ripples too far — prefer removal).
2. **Monotonicity:** tier is recomputed at the same turnSequencer step as today, but since Lifetime Dignitas only decreases via rare event penalties, tier is monotonic in practice. Keep the recompute honest (it *can* drop if Dignitas drops) — do not special-case.
3. **Tier-up moment:** when the recompute yields a higher tier than stored, push a lightweight notice — reuse the Phase 1 pattern of Philon-voiced interstitials: a small event-card-style notice (weight 0, injected, single "Continue" choice) titled with the new tier name. Copy (final): body — "Philon does not smile often. 'Rome has taken notice, Domine. The Gens Brutia now stands as **[tier title]**. [New client slots / income multiplier line, generated from the tier definition.] Greater names carry greater expectations.'" The closing line foreshadows P2-F: higher tiers unlock grander acts of public munificence, and Rome will come to expect them.
4. **Ledger + agenda touchpoints:** tier changes appear as a ledger headline (P1-D's `headlines`); add an `opportunity` agenda generator (#15): fires when Lifetime Dignitas is within 15 points of the next tier threshold — "The next rung is close" / "[n] Lifetime Dignitas to [tier title]. Laudationes, munificence, and legacy milestones close the gap." Target: Forum.

### UI

`PatronLadderPanel`: remove the current-Fides requirement display entirely; show per-tier: Dignitas threshold, income multiplier, client slots, unlocked action, and (after P2-F) unlocked munificence acts. Progress bar = Lifetime Dignitas toward next threshold.

### Content/docs

Update the `Patron Tier` glossary definition (P1-F) to the new rule. Flag `game-manual.md` §Patron Ladder for revision (see Documentation Updates at the end of this plan).

### Tests

`patronEngine` (new or extended test file): tier from Dignitas alone; Fides pool of 0 with high Dignitas yields the high tier; tier-up notice fires exactly once per gained tier; Dignitas event penalty crossing a threshold downward does demote.

### Chunk P2-B — Done when

Spending Fides to zero never changes tier; reaching 30 Lifetime Dignitas triggers the Minor Patron notice; panel shows no Fides requirement.

---

## Chunk P2-C — Fides Income Diversification + Deterministic Training

**Goal:** Heirs matter economically; training is a purchase, not a coin flip.

**Files to modify:** `src/engine/resourceEngine.ts` (`calcResourceIncome`), `src/state/gameStore.ts` (train action), `src/components/domus/CharacterActionModal.tsx`, `src/data/balance.ts`, `__tests__/engine.test.ts`

### Income formula change

Current: `(paterfamilias.rhetoric × 2) × patronMultiplier + …`
New: `((paterfamilias.rhetoric × 2) + (bestOtherRhetoric × 1)) × patronMultiplier + …` where `bestOtherRhetoric` = highest rhetoric among **living, non-paterfamilias family members age ≥ 12** (children below 12 contribute nothing; verify age field usage). Constants (`2`, `1`, min age `12`) go in `BALANCE.income`.

Effects to note in the ledger income breakdown if one exists (check how `ResourceBar`'s income preview decomposes — if it shows a tooltip/breakdown, add the new term as its own line: "Household voices +[n]").

### Training rework

Replace the 65%-chance flat-cost train with:

1. **Deterministic:** training always succeeds.
2. **Escalating cost:** `BALANCE.training.fidesCostPerTargetLevel × targetLevel` Fides (first-pass value: **3**, so 6→7 costs 21). Applies to all three skills identically.
3. **Rate limit:** each character may train **once per season** (add a per-character `trainedThisTurn`-style marker — prefer a transient store map `trainedThisSeason: string[]` reset in `endSeason` over a new `Character` field; implementer's call, but do not persist stale markers across seasons).
4. **Cap unchanged** at 10.
5. **UI:** `CharacterActionModal` shows the exact cost for the next level per skill, disabled state with reason when already trained this season or unaffordable. Remove all "chance" language.

**Why (comment this in the code):** RNG on the core progression verb punishes at random and rewards reload-scumming; escalating deterministic cost creates the wide-vs-tall build decision (many family members at 5–6 vs. one prodigy at 9–10) that the new income formula makes meaningful.

### Tests

Income includes the second-voice term and respects the age floor; train cost math at several levels; once-per-season enforcement; cost refuses when unaffordable.

### Chunk P2-C — Done when

Training Julia's rhetoric visibly raises next-season Fides income preview; training never fails; a character cannot train twice in one season.

---

## Chunk P2-D — Relationship Anchors, Yearly Decay, Leader Mortality

**Goal:** Relationships stop being a per-season maintenance tax; alliances and marriages become permanent investments; the leader roster ages, dies, and renews across a long campaign.

**Files to modify:** `src/models/clan.ts`, `src/data/startingClans.ts`, `src/engine/resourceEngine.ts` (`applyRelationshipDrift` — likely relocate to a better home, see below), `src/engine/turnSequencer.ts`, `src/data/balance.ts`, `src/data/events.ts` (death notices), `src/engine/electionEngine.ts` (only if leader iteration assumptions break), `src/data/glossaryTerms.ts`

### D1. Anchored decay

Replace decay-toward-zero with **decay toward an anchor**, applied **once per year** (at the Winter→Spring rollover inside the same sequencer step that currently applies seasonal drift — gate it on the rollover; delete the per-season application).

Per-leader `anchor` is derived, not stored: take the **highest** applicable of:

| Condition | Anchor |
|---|---|
| Marriage link to your family exists (verify how `Arrange Marriage` marks the link) | `BALANCE.relationships.anchorMarriage` = **55** |
| Alliance marked (`Forge Alliance`) | `anchorAlliance` = **40** |
| Default | `anchorDefault` = **25** |
| Leader currently hostile (relationship < 25 **and** no alliance/marriage) | `anchorHostile` = **15** (hostiles do not warm on their own — preserves the manual's rule) |

Decay: move **3 points toward the anchor** per year (`decayPerYear` = 3), never crossing it. Relationships *below* their anchor also drift **up** toward it at the same rate (a snubbed ally cools but a neutral stranger's grudge fades) — except hostile-anchored leaders, who only drift down toward 15, never up. This asymmetry is intentional: enemies stay enemies unless *acted upon*.

Relocation note: if `applyRelationshipDrift` lives in `resourceEngine.ts` (per sitemap), consider moving it to `reputationEngine.ts` where relationship logic belongs; low priority — do it only if touching the function anyway makes it free.

### D2. Leader ages

Add `age: number` to `ClanLeader` (verify it doesn't already exist — the original design PDF specified ages, so it may). Populate `startingClans.ts` with sensible ages: Q. Fabius Maximus and P. Cornelius Scipio as elder statesmen (~58–64), military leaders 40s, commerce leaders 35–50, Ap. Claudius Pulcher ~52. Leaders age +1 at the same yearly rollover.

### D3. Mortality and succession

At the yearly rollover, per leader, roll death chance by age band (`BALANCE.relationships.mortality`): under 50: 0% · 50–59: 3% · 60–69: 8% · 70–79: 18% · 80+: 35%. **Hard cap: at most one leader death per year** (if multiple roll death, keep the eldest; this prevents roster chaos and keeps deaths as *events*).

**Succession (fully procedural — zero authored content):** the dead leader is replaced in the same clan by a generated successor:

| Property | Rule |
|---|---|
| Name | Clan gens + praenomen from a small Roman praenomen pool in `clientNames.ts`-style data (add a `LEADER_PRAENOMINA` list; cognomen optional). Guard against duplicating a living leader's exact name. |
| Age | 32–45 uniform |
| Bias | 60% inherit predecessor's bias, 40% random from the bias set |
| Votes | round(predecessor's votes × 0.7) — new men carry less weight; the missing votes are *gone from the map* (total Senate votes may drift down slightly over a long game; acceptable, and it mildly rewards longevity of *your* allies) |
| Relationship to player | round(predecessor's relationship × 0.4), then clamped to at least the successor's derived anchor. Marriage/alliance marks do **not** carry over (the bond was with the man, not the office) |
| Special fields | Any predecessor blackmail/intel marks are discarded; `proscribed` (v2 plan) does not inherit |

**Death notice:** inject a weight-0 single-choice notice event (same interstitial pattern as P2-B's tier-up): title "[Name] is dead"; body (final copy, interpolated): "Word from the Forum: [name] of the [clan] has died, aged [age]. His place among the [clan] falls to [successor], [age] — [a man of his father's stamp / an unknown quantity] *(pick clause by bias-inherited or not)*. Philon, practically: 'Whatever [dead name] owed us, Domine, died with him. Whatever he *knew* of us, we may hope, as well.'" Choice: "Rome moves on."
If the deceased was marriage-linked or allied, append to the body: "The bond your family held with him does not pass to his heir."

**Cross-system checks (verify each):** `electionEngine` rival generation and vote counting must tolerate replaced leader IDs mid-campaign (if the player canvassed a leader who then dies before Winter, the locked votes are lost — ensure no dangling-ID crash; the death notice covers the fiction). Any Phase 1 agenda generator or event condition referencing leaders by ID must guard lookups (P1-C already mandates guarded lookups — confirm).

### D4. Touchpoints

- **Agenda generator #16 (`warning`):** any marriage/alliance-anchored leader aged ≥ 70 — "[Name] grows old" / "His heir will not inherit your bond. Prepare a second friendship in the [clan]." Target: Forum, `selectedLeaderId`.
- **Ledger headline** on any leader death.
- **Glossary:** update/add entries: `Relationship Anchor`, `Leader Succession` (2 sentences each, per P1-F rules).

### Tests

Anchor derivation precedence (marriage > alliance > default > hostile); yearly-not-seasonal application; upward drift toward anchor works and is suppressed for hostile-anchored leaders; mortality respects the one-death cap; successor properties within spec; canvassed-then-dead leader does not crash election resolution.

### Chunk P2-D — Done when

A season passes with zero relationship change; a year boundary applies one decay tick; debug-forcing a leader death produces a valid successor, a notice, and a sane election afterward.

---

## Chunk P2-F — Munificence (Euergetism)

**Goal:** Wealth gets aspirational destinations. Expensive public acts — feasts, games, temple restorations, endowments — convert late-game surplus into Lifetime Dignitas, plebs goodwill, crisis relief, and electoral advantage. This is the late-game absorber that replaces the cut cost-scaling mechanic, and it is historically load-bearing: euergetism is *how* rich Romans actually converted money into standing.

**Files to create:** `src/data/munificence.ts`

**Files to modify:** `src/screens/CuriaScreen.tsx` (new panel), `src/state/gameStore.ts` (act execution + state fields), `src/engine/resourceEngine.ts` (endowment income term), `src/data/balance.ts`, `src/data/glossaryTerms.ts`, `src/engine/agendaEngine.ts`, the office-actions definition file (Aedile reconciliation)

**Verify before coding:** whether the Aedile office already has a host-games action (reconciliation below); the v2 effect-token vocabulary for crisis-track deltas; the one-shot election-bonus flag pattern established by v2 (the `peoples-champion` precedent) — the Grand Games bonus must reuse that exact pattern.

### Placement decision (made, not open)

Munificence lives on the **Curia screen** as a new collapsible panel ("Munificence"), because its effects target Rome — plebs, stability, the crisis tracks — and those already live on Curia. It is *not* a new tab. Panel framing line: "What Rome is given, Rome remembers."

### Data: `src/data/munificence.ts`

`MUNIFICENCE_ACTS`: array of `{ id, name, flavor (one line), requirements: { minPatronTier?, once?: 'year' | 'game', cooldownSeasons?, maxPerGame?, slot? }, costs: { denarii, fides? }, effects (effect strings + structured fields for crisis deltas / election flag / endowment grant), agendaHint? }`.

The v1 act list (all numbers → `BALANCE.munificence`; first-pass values):

| Act | Requirements | Cost | Effects | Frequency |
|---|---|---|---|---|
| **Public Feast** | none | 40 Denarii | plebs +3, fides +2 | cooldown 2 seasons |
| **Grain Largesse** | none | 80 Denarii | plebs +5, unrest crisis −3 | cooldown 2 seasons |
| **Fund the Ludi** (minor games) | tier ≥ 2 | 120 Denarii + 10 Fides | plebs +6, unrest crisis −4, +4 Lifetime Dignitas | once/year, shared `games` slot |
| **Grand Games** | tier ≥ 3 | 300 Denarii | plebs +10, unrest crisis −8, +8 Lifetime Dignitas, election bonus: one declared family candidate gains +8 votes at the next Winter resolution (one-shot flag, `peoples-champion` pattern) | once/year, shared `games` slot |
| **Restore a Temple** | tier ≥ 2 | 150 Denarii | +6 Lifetime Dignitas, stability +3, constitution crisis −2 | each temple once per game; 5 named temples in the data file (Temple of Saturn, of Castor, of Ceres, of Janus, of Bellona — pure flavour strings) |
| **Public Endowment** (granary / portico / fountain house) | tier ≥ 4 | 400 Denarii | permanent +1 Fides/season income, +10 Lifetime Dignitas, plebs +4 | max 2 per game |

**Grain Largesse overlap check:** the ambassador desk has a grain-dole-style action per the manual. If a near-duplicate exists, differentiate cleanly — the ambassador action is *provincial* relations, this one is *city* plebs — by adjusting names/copy, or if they are mechanically identical, route the ambassador one to reference this act's constants. Do not leave two unrelated implementations of the same idea.

**Aedile reconciliation (verify first):** if the Aedile office has a host-games action, unify rather than duplicate: holding Aedile halves the Denarii cost of both games acts and increases their effects ×1.5 (the office *is* the discount — historically apt, and it strengthens the Cursus motivation loop). Implement as modifiers read at act execution; remove or redirect any pre-existing separate office action so there is exactly one games system.

### State & engine

- `endowments: string[]` on `GameState` (ids of built endowments) + per-act usage tracking (`munificenceUsage: Record<actId, { lastUsedTurn?, usesThisYear?, totalUses? }>` — reset year-scoped fields at the rollover; keep it one small record, not per-act booleans scattered).
- Income: `calcResourceIncome` gains a term `endowments.length × BALANCE.munificence.endowmentFidesPerSeason (1)`; ledger/income breakdown line "Endowments +[n]".
- Act execution is one store action `performMunificence(actId)` validating requirements/costs, applying effects via the existing effect-string pathway (crisis deltas via v2 tokens — verify), writing usage, and counting as a meaningful action (P2-E).

### UI (CuriaScreen panel)

Act rows: name, flavour line, cost, effect summary in plain words, and state — affordable / on cooldown ("again in [n] seasons") / locked ("requires [tier title]", shown greyed with the tier name visible: **locked acts are deliberately visible** — they are the aspiration). Grand acts (Grand Games, Endowment) get a subtle laurel accent. Executing a grand act triggers a Philon interstitial (reuse the P2-B pattern), e.g. Grand Games copy (final): "'Rome roared your name today, Domine. Ten thousand strangers now consider themselves your personal friends. Some of them vote.'"

### Touchpoints

- **Agenda generator #19** (`opportunity` — #17/#18 are reserved by the military plan): fires when unrest crisis tier ≥ 2 AND the `games` slot is unused this year AND Denarii ≥ Fund-the-Ludi cost — "The city wants games" / "Bread quiets a street; games quiet a city. The unrest would ease." Target: Curia.
- **Ledger headlines** for games, temples, endowments.
- **Glossary:** `Munificence` and `Endowment` entries (≤ 2 sentences, P1-F rules).
- **PatronLadderPanel** (P2-B): tier rows list the munificence acts they unlock.

### Tests

Requirement gating (tier, cooldown, shared `games` slot, per-game limits); endowment income term; temple once-per-game enforcement; election flag set by Grand Games and consumed exactly once at resolution; Aedile modifier math; usage-record year reset.

### Chunk P2-F — Done when

All six acts executable from Curia under their rules; a tier-1 player sees Grand Games locked-but-visible; an endowment measurably raises income; the Grand Games vote bonus demonstrably lands at the next election in a debug run.

---

## Chunk P2-E — Action Economy Tuning Pass (last)

**Goal:** The season's action budget is a measured, intentional number that **grows with the player's standing** — 3–4 meaningful actions early, 4–6 mid, 5–8 late — with Munificence absorbing late-game surplus, and with praetor and consul balanced as genuinely hard-won summits.

**Files to modify:** `src/state/gameStore.ts` (counters), `src/components/shared/DebugPanel.tsx`, `src/data/balance.ts`, `src/engine/electionEngine.ts` (constants only, extracted in P2-A), possibly many data files (number changes only)

### E1. Define "meaningful action" (the counter list)

Increment `actionsThisSeason` in exactly these store actions (grep the store's action list and reconcile — this is the intended set, adjust names to match the code): all Forum diplomacy actions · bill actions (vote/speech/filibuster/submit/repeal) · train skill · buy/upgrade asset (family or provincial) · Domestic Directives (laudatio/adrogatio/marriage) · office actions · trial actions · ambassador actions · raise levy / start campaign / volunteer officer · governor policy change · **every munificence act**. **Not counted:** navigation, opening panels, event choices (forced), End Season, naming a birth.

### E2. Instrumentation surface

`DebugPanel` gains a "Pace" section reading `seasonStatsHistory`: last-10 averages of duration, actions, Fides income vs. spent, Denarii income vs. spent; plus min/max flags when a season fell outside its stage's action band or exceeded 8 minutes. This is the tuning dashboard — build it before touching numbers.

### E3. Election difficulty: the summit curve

Praetor and consul must feel like summits, not next rungs. Using the constants extracted into `BALANCE.elections` (and adding rank-scaling constants if v2's rival generation supports them — verify how rivals are created and vote weights resolve):

| Office band | Intended experience | First-pass expectation to tune toward |
|---|---|---|
| Vigintivirate / Quaestor | Winnable on a first attempt with 1–2 seasons of canvassing | ≥ 70% win with modest preparation |
| Tribune / Aedile | Requires real Forum investment that season-cycle | ~50–60% with solid preparation |
| Praetor | Requires ~2 years of cultivated relationships or notable standing | ~40% with strong preparation; near-zero cold |
| Consul | The career summit: expect to *lose the first attempt*; winning wants tier ≥ 3 standing, locked allies, and ideally a Grand-Games-boosted year | ~25–35% even well-prepared; a won consulship should feel like the run's crowning act |

Permitted levers: rival vote-strength scaling by office rank, canvass cost per office band, uncommitted-clan sympathy weights. **Not permitted:** new election mechanics (that would be a design change, not tuning). If the current rival system cannot produce the praetor/consul curve with constants alone, stop and report — a "rival strength by office rank" constant is an acceptable *addition* if rivals already have a strength parameter; a new rival system is not.

Measure by scripted election sims if `electionEngine` is cheaply harness-able headless (it should be — it's a pure engine); otherwise hand-played debug runs, minimum 10 per office band.

### E4. First-pass targets and the tuning loop

The implementing chat should play-test in debug mode and adjust `BALANCE` values only, using these targets:

| Stage | Definition | Fides income/season target | Meaningful actions band | Denarii posture |
|---|---|---|---|---|
| Early | Years 1–3, tier 0–1 | 15–25 | **3–4** | Tight: one asset purchase per ~2 years; munificence = an occasional feast |
| Mid | Tier 2–3, first governorship | 28–45 | **4–6** | Province gold funds assets, dinners, first Ludi; a temple restoration is a saved-for event |
| Late | Tier 4–5, consular family | 50–75 | **5–8** | Denarii-rich by design — the player *earned* it; Grand Games, endowments, levies, and trials are where it goes. The constraint is slots and cooldowns, not poverty |

**The design stance (record it in `balance.ts` comments):** late-game abundance is intended — growth must stay felt. Pace is controlled by making the *marginal* small action unnecessary (everything routine is handled) while grand acts absorb ambition. There is **no action-cost scaling by tier** — this was considered and cut for cheapening earned growth. If late seasons exceed the band or 8 minutes, the levers are, in order: (1) munificence cooldowns/slots, (2) small-action cooldowns where fiction supports them, (3) income constants, (4) tier income multipliers. Structural changes require stopping and writing up the finding.

Record the final chosen values and a 5-line summary of observed pace (from the Pace panel) plus the election-curve results in a `## Tuning log` appendix added to the bottom of this plan file (or a sibling note) so the numbers' rationale survives.

### Tests

Counter increments for a sampled set of actions (including a munificence act) and not for excluded ones; ring buffer caps at 40; election sim harness (if built) reproduces the band targets within tolerance.

### Chunk P2-E — Done when

The Pace panel shows real data; hand-played test seasons at each stage land in their band; the election summit curve is demonstrated (sims or logged hand-runs); all displayed costs match charged costs; the tuning log is written.

---

## Cross-Chunk Notes

- **`gameStore.ts`** is touched in P2-A (telemetry fields), P2-C (train action), P2-F (munificence action + fields), P2-E (counters). Additive, in chunk order.
- **`turnSequencer.ts`** is touched in P2-B (tier-up detection at step 10), P2-D (yearly decay/aging/mortality at the rollover), P2-F (year-reset of munificence usage — attach to the same rollover gate as P2-D; do not re-derive the rollover). P2-D's yearly gate must reuse the sequencer's existing Winter→Spring rollover detection from step 1.
- **The interstitial notice pattern** (weight-0, single-choice, Philon-voiced injected event) is used by P2-B (tier-up), P2-D (leader death), and P2-F (grand acts). Build it once — if Phase 1's tutorial special-case block already established an injection helper, reuse it; otherwise add one `injectNoticeEvent(defId, interpolations)` helper and note it for future phases (Phase 3 succession and the military plan both consume it).
- **Balance registry discipline:** after P2-A, any chunk that would introduce a numeric literal for a tunable must put it in `BALANCE` instead. Reviewers (and future chats) should treat a magic number in engine/store code as a defect.
- **Agenda generators added this phase:** #15 (tier proximity, P2-B), #16 (aging bonded leader, P2-D), #19 (games opportunity, P2-F — #17/#18 are reserved by the military overhaul plan). Keep numbering/IDs consistent with `agendaEngine.ts`'s catalog comment.
- **The Provinciae governance tab is untouched this phase.** The three governor sliders remain exactly as they are — no presets, no re-layout. (Decision recorded: presets were cut as adding a layer that made the sliders *less* intuitive on mobile, not more.)
- **Old saves:** Phase 1 established default-spreading on load. P2 changes that can strand old saves: removed `requiresFides` (harmless), leader `age` missing (default-populate ages on load: if any leader lacks `age`, assign from a deterministic band by bias — elder for optimates/tradition, mid for others — in one load-time normalisation function in `saveLoad.ts`), missing `endowments`/`munificenceUsage` (default-spread covers them).
- **Do not build in Phase 2:** blackmail/secrets mechanics (Phase 4 — P2-D deliberately discards intel on death rather than modelling transfer), succession for *family* characters (Phase 3), remote analytics, difficulty presets (Phase 5), any campaign/ending structure (Phase 3), action-cost scaling of any kind (cut by design decision).

## Documentation Updates (do after all chunks)

`game-manual.md` sections to revise: **Patron Ladder** (Dignitas-only gating, no Fides column; tiers unlock munificence acts), **Resources → Fides** (new income formula line; endowment income), **Domus → per-character actions** (deterministic escalating training, once per season), **Forum → relationship drift** (anchors, yearly decay, leader ages/mortality/succession), **Curia** (new Munificence section: the six acts, requirements, the Aedile discount), **Cursus** (note on the election summit curve: consulships are expected to take more than one attempt), **Key Strategic Principles** (revise "Patron Tier compounds"; add lines on investing in heirs' rhetoric and on munificence as the wealth-to-standing converter). Also refresh `sitemap.md`: new files (`balance.ts`, `munificence.ts`, `telemetry.ts`), the `OFFICE_FIDES_BONUS` relocation, and removal of `ForumScreen_original.tsx`.

## Phase 2 — Done when (integration criteria)

1. A player can spend Fides to zero without losing Patron Tier, and reaching a tier threshold produces Philon's notice.
2. Training an heir's rhetoric measurably raises next season's Fides income preview; no training action involves chance.
3. A neglected ally decays to their anchor and stops; a married-in leader never drifts below 55; a hostile leader never warms on his own; a leader death mid-campaign produces a successor and no crashes.
4. A wealthy late-game family can fund Grand Games that visibly ease the unrest crisis and swing an election, and can build an endowment that permanently raises income; a poor early family sees those acts locked but visible.
5. The Provinciae governance sliders are pixel-identical to their pre-Phase-2 state.
6. The Pace panel shows seasons landing in 3–4 / 4–6 / 5–8 bands at early/mid/late debug states; the election summit curve (junior offices winnable, consul a genuine summit) is demonstrated and logged; chosen `BALANCE` values plus observations are recorded in the tuning log.
7. `tsc` clean; all prior tests plus the new patron/training/relationship/munificence/economy tests pass; no `gravitas`/`gratia` remnants in `src/`.
