# Rome: Res Publica — Military Overhaul Implementation Plan: "The Legate's Line"

## 0. How to use this document (instructions for the implementing chat)

This plan specifies the complete military overhaul: the lane-based set-piece battle system, unit stats/veterancy/loyalty, captains and character risk, the War Score strategic wrapper, and peace negotiation with Senate ratification. It follows the conventions of `rome-phase1-implementation-plan.md` and `rome-phase2-implementation-plan.md`.

**You are expected to implement ONE chunk per chat session.** The chunks are sized to fit comfortably in a single session including reading, questions, coding, and tests. When the user says "implement chunk M4 of the military plan", your workflow is:

1. **Read this entire document** (at minimum: §0, §1, §2, the chunk itself, its dependencies' "Done when" criteria, and §Cross-Chunk Notes).
2. **Request the files** listed in the chunk's *Files to request* line (the user will paste or attach them). Do not guess at file contents you have not seen.
3. **Run the chunk's *Verify* list** against those files. If anything doesn't match this plan's assumptions — a missing field, a different function signature, an earlier chunk apparently not implemented — **stop and ask before writing code.** Also flag any ambiguity you find in the spec itself.
4. Implement the chunk. Engines are pure functions (no store access); UI contains no game logic; all tunable numbers go in `BALANCE` (never inline literals); content/data lives in `src/data/`.
5. Run `npx tsc --noEmit` and the test suite. Fix what you broke.
6. **Share every created or modified file in full** as output files, plus a short changelog note listing: files touched, any deviations from this plan (with reasons), and any `BALANCE` values you had to adjust.

**Baseline assumption:** Phases 0–2 are fully implemented — four-track `crisis`, `flags`, agenda engine + AgendaTablet, Philon interstitial/notice pattern (`injectNoticeEvent` or equivalent from Phase 2), Season Ledger, autosave, `src/data/balance.ts` registry, telemetry (`seasonStatsHistory`), governor presets. If the file set you receive contradicts this, stop and ask.

**Implementation timing note:** chunks M1–M8 and M11 are self-sufficient against the Phase 0–2 baseline. Chunk M9 contains a *provisional* set-piece scheduler explicitly designed to be replaced by the Phase 3A war script; M9/M10 may be implemented before or after Phase 3A (see M9 for the seam). The user may choose to implement this whole plan only after Phase 3 — nothing here assumes otherwise except where M9 notes it.

**Chunk dependency graph:**

- M1 → M2 → M3 → M4 → M5 → M6
- M7 requires M3 (+ M6 for its UI part)
- M8 requires M3 (+ store wiring from M4)
- M9 requires M3, M4
- M10 requires M9
- M11 requires M5 (sandbox) and is finalised after M6–M10 (tuning)

---

## 1. Design invariants (apply to every chunk)

1. **Resolve, then animate.** `battleEngine` computes rounds and emits a structured `BattleLog`. The UI *replays* the log; it never simulates. Decision points are: engine returns a round → UI animates it → UI collects new orders → engine computes the next round. The engine must therefore be callable one round at a time with explicit orders as input.
2. **Deterministic given a seed.** Every battle takes an RNG seed; the same seed + same orders = the same battle. Use a small seeded PRNG utility (add one to `src/utils/` in M2 if none exists — check first). This makes tests exact and replays possible.
3. **Skin-agnostic data model.** No land assumptions in engine logic: units have a `unitClass`, lanes have abstract ids (`left`/`centre`/`right`) with display labels supplied by data, terrain is a generic modifier bundle. A future naval battle is a data reskin (squadron classes, boarding stratagems), not an engine fork.
4. **Morale wins battles, not annihilation.** Wings *break* (rout) at zero morale; battles end by wing collapse or withdrawal. Casualties matter but are the input to morale, not the win condition.
5. **The Cannae rule.** No single battle may swing `warScore` by more than `BALANCE.war.maxSingleBattleSwing` (25). Enforced in the engine, not by convention.
6. **Legibility over math.** UI shows advantage pips, risk pips, and plain-language previews — never the modifier stack. The modifier stack exists in the engine and the debug sandbox only.
7. **Voice.** Battle narration is *military*, not Philon: pre-battle and dispatch text is voiced by the army's primus pilus or written as terse field dispatches. Philon appears only back in Rome (agenda items, ledger lines about the war).

---

## 2. System overview (read once, then trust the chunks)

A **set-piece battle**: two armies of cohort-scale **units** meet. The player deploys units and **captains** across three **lanes** (left wing / centre / right wing) plus a **reserve**, choosing a **formation** per lane and the commander's own station. Rounds resolve: each round, every contested lane computes a clash from unit stats × formation × class matchups × veterancy × captain × terrain; casualties and events drain per-wing **morale pools**; a pool at zero = the wing **routs**. The victor of a broken lane chooses **pursue** (destroy routers, endanger their captain) or **wheel** (flank-charge an adjacent lane). Between rounds the player may change formations, **commit reserves**, play a **stratagem**, or **withdraw**. Two enemy lanes broken (or enemy withdrawal/rout cascade) = victory, tiered by margin. Battle results, sieges, and skirmish seasons move **warScore** (−100…+100); thresholds at ±40/±70/±90 unlock *sue for peace* / *forced negotiation* / *dictate terms*; treaties are assembled on a negotiation screen and must be **ratified by the Senate** as a special bill. Family members and legates serving as captains roll wounded/captured/killed outcomes when their wing breaks; victories feed the existing triumph system, defeats feed the existing trial system.

---

## Chunk M1 — Data Model & Balance Tables

**Goal:** All battle/war types and every tuning number exist. Compiles; zero gameplay change.

**Files to request:** `src/data/balance.ts`, `src/models/province.ts` (existing levy/troop shapes), `src/models/character.ts`, `src/state/gameStore.ts` (state shape section only), any existing military model file the sitemap shows.

**Verify:** how levied troops are currently represented (the manual describes levies with upkeep and veteran flavour — the new `BattleUnit` must be constructible from whatever exists, via a mapping function specified in M4); that `BALANCE` exists per Phase 2.

**Files to create:** `src/models/battle.ts`, `src/models/war.ts`

### `src/models/battle.ts` — types (no logic)

| Type | Shape |
|---|---|
| `UnitClass` | `'legionary' \| 'spear_foot' \| 'skirmisher' \| 'cavalry_heavy' \| 'cavalry_light' \| 'elephant'` |
| `Veterancy` | `'raw' \| 'trained' \| 'veteran' \| 'legendary'` |
| `FormationId` | `'line' \| 'wedge' \| 'shield_wall' \| 'open_ranks' \| 'feigned_retreat'` |
| `LaneId` | `'left' \| 'centre' \| 'right'` |
| `BattleUnit` | `{ id, unitClass, strength (0–100, % of full cohort), veterancy, loyalty (0–100), elephantSteady: boolean, sourceRef? (string — link back to the strategic-layer levy/legion record) }` |
| `LaneAssignment` | `{ units: BattleUnit[], captainId: string \| null (character or legate id), formation: FormationId }` |
| `Deployment` | `{ lanes: Record<LaneId, LaneAssignment>, reserve: BattleUnit[], commanderStation: LaneId \| 'reserve' }` |
| `LaneOrders` | per-round player/AI input: `{ formation?: FormationId (change), commitReserves?: BattleUnit ids to a lane, stratagemId?: string, withdraw?: boolean }` — exact shape may be refined in M3; declare a first pass now |
| `WingState` | runtime: `{ laneId, units, captainId, formation, moralePool (0–100), broken: boolean, engagedRounds: number, flanked: boolean, overextended: boolean }` |
| `BattleState` | `{ seed, round, terrain: TerrainMod, attacker: SideState, defender: SideState, log: BattleLog, phase: 'deployment' \| 'orders' \| 'resolved' , outcome?: BattleOutcome }` where `SideState` = `{ label, wings: Record<LaneId, WingState>, reserve, commanderId, commanderStation, generalProfileId? (AI side) }` |
| `TerrainMod` | generic bundle: `{ id, label, mods: partial multipliers e.g. { cavalryShock?: number, defenderDef?: number, elephantAmok?: number } }` — 4 terrains defined in balance data: open plain (cavalry shock ×1.15), rough hills (cavalry shock ×0.7, defender def ×1.1), river crossing (attacker atk ×0.85), coastal plain (neutral; exists so naval-adjacent fights have a label) |
| `BattleLog` / `RoundLogEntry` | ordered entries the UI replays: typed events — `clash` (lane, casualties both sides, morale deltas, modifiers-summary string for debug), `shock_charge`, `terror`, `wing_break`, `wheel`, `pursue`, `amok`, `feint_result`, `reserve_commit`, `stratagem_played`, `withdrawal`, `battle_end`. Each entry carries enough display data that the UI never recomputes anything. |
| `BattleOutcome` | `{ victor: 'attacker' \| 'defender' \| 'withdrawal', tier: 'marginal' \| 'clear' \| 'crushing', casualties summary, captainOutcomes: Array<{ characterId, result: 'unharmed' \| 'wounded' \| 'captured' \| 'killed' }>, warScoreDelta }` |

### `src/models/war.ts` — types

`WarState`: `{ active: boolean, enemyId: 'carthage' (extensible), warScore (−100…100), startedTurn, lastSetPieceTurn, weariness: number, pendingSetPiece: SetPieceOffer | null, treaty: TreatyState | null }`. `SetPieceOffer`: `{ id, siteName, terrainId, enemyArmy: BattleUnit[], enemyGeneralId, expiresTurn }`. `TreatyState` and term types are specified in M10 — declare minimal placeholders now.

### `BALANCE.battle` and `BALANCE.war` — the numbers (add to `balance.ts`)

**Unit base stats** (`BALANCE.battle.unitStats`):

| class | atk | def | shock | moraleWeight | notes field (string, for debug UI) |
|---|---|---|---|---|---|
| legionary | 6 | 6 | 3 | 7 | "The line that grinds" |
| spear_foot | 4 | 7 | 2 | 7 | "The wall" |
| skirmisher | 3 | 2 | 1 | 4 | "The screen" |
| cavalry_heavy | 5 | 4 | 8 | 6 | "The hammer" |
| cavalry_light | 4 | 3 | 4 | 5 | "The net" |
| elephant | 7 | 6 | 10 | 8 | "The gamble" |

**Class matchup modifiers** (`BALANCE.battle.matchups` — applied when class A fights lane containing class B; additive to atk/def or multiplicative to shock as noted):

| Matchup | Effect |
|---|---|
| legionary vs spear_foot | legionary atk +2 (swords beat spears in the grind) |
| spear_foot vs cavalry_heavy or elephant | spear def +2; incoming shock from those classes ×0.25 |
| cavalry_heavy vs spear_foot | cavalry atk −2 (on top of shock negation above) |
| cavalry_light vs cavalry_heavy | first-clash incoming shock ×0.5 (evasion) |
| cavalry_light vs skirmisher | cavalry_light atk +2 |
| skirmisher prelude vs elephant | see elephant rules (M3): prelude panic chip |
| skirmisher screen | while a lane contains skirmishers at >30 strength, incoming shock to that lane ×0.7 |

Constraint for M2: implement matchups as a data-driven table lookup, not a switch — naval reskins add rows, not code.

**Veterancy** (`BALANCE.battle.veterancy`): raw ×0.85 stats, morale seed −10 · trained ×1.0 · veteran ×1.15, +10 · legendary ×1.30, +20, feigned_retreat always permitted.

**Formations** (`BALANCE.battle.formations`):

| id | atk | def | incoming shock | other |
|---|---|---|---|---|
| line | ×1.0 | ×1.0 | ×1.0 | baseline |
| wedge | ×1.25 | ×0.8 | ×1.25 (flank charges vs this lane ×1.25 too) | if the lane loses the round: extra −1 wing morale |
| shield_wall | ×0.75 | ×1.3 | ×0.6 | skirmisher prelude chip vs this lane ×0.5; wing morale drain ×0.85 |
| open_ranks | ×0.9 | ×0.85 | ×0.2 | immune to Terror this round |
| feigned_retreat | — | — | — | resolved as a manoeuvre, not a stance: see M3 |

Formation change costs nothing but takes effect next round (orders are for the *coming* round). `wedge` and `feigned_retreat` require a captain present in the lane.

**Feigned retreat gating & rolls** (`BALANCE.battle.feint`): permitted if lane's average veterancy ≥ veteran, OR ≥ trained AND lane average loyalty ≥ 70, OR any legendary unit present. Success chance = `30 + 0.5 × avgLoyalty + 10 × vetTierIndex` (cap 95). Roll ≤ 10 = botch. Success: enemy lane gains `overextended` next round (def ×0.7; your next charge counts shock refreshed ×1.25). Failure: own lane −3 wing morale, def ×0.8 this round. Botch: the lane's weakest-morale unit routs immediately (removed; wing morale −10).

**Shock decay** (`BALANCE.battle.shock`): a unit's shock applies ×1.0 on its first round engaged in a lane, ×0.5 the second, ×0 after; resets on entering a new lane (wheel, reserve commit) and on a successful feint countercharge.

**Captains & commander** (`BALANCE.battle.command`): wing atk & def ×(1 + 0.02 × captain martial); wing morale seed +2 × martial. Commander stationed on a lane = acts as that lane's captain at full effect **and** grants +1 morale seed army-wide; commander in reserve/centre-rear (`'reserve'` station) = every lane gets ×(1 + 0.01 × martial) instead (half-effect army command), lower personal risk. Unled lane (no captain): morale seed −15, cannot order wedge or feigned_retreat.

**Loyalty effects in battle** (`BALANCE.battle.loyalty`): lane avg ≥ 80: +5 morale seed. < 30: whenever the wing loses a round, extra −2 morale ("wavering"). Loyalty *lifecycle* numbers live in M8.

**Morale** (`BALANCE.battle.morale`): wing morale pool seeded = `10 × avg(unit moraleWeight × veterancy multiplier)` + captain/loyalty/stratagem seeds, clamp 20–100. Per-round drain = `casualtiesTakenThisRound% × 0.8` + terror + flank + wavering effects − shield_wall reduction. Broken at ≤ 0. Rout cascade: while a side has 2 broken wings, its remaining wing takes −20 morale per round automatically.

**Wing break resolution** (`BALANCE.battle.break`): victor chooses `pursue` (destroy 40% of routed units permanently — 60% if any cavalry_light pursues; enemy captain +15% capture weight; +2 warScore rider on the battle result) or `wheel` (move to one adjacent lane — left/right are adjacent to centre; centre victor may choose either wing — arriving next round as a flank charge: shock reset and ×1.5, target wing −10 morale immediately and `flanked` (def ×0.85) while outnumbered).

**Elephants** (`BALANCE.battle.elephant`): deployable to any lane. Terror: opposing lane units without `elephantSteady` take −2 wing morale per round while elephants ≥ 30 strength in the lane (open_ranks immune per formation table). Skirmisher prelude panic: if the opposing lane contains skirmishers, elephants take 8 strength damage in the prelude and their amok chance that battle +10%. Amok check each round from round 2: chance = `8% × engagedRounds + 15% if strength < 50` (+ prelude rider); on amok, deal one round of atk to **both** lanes' units (own side included) then remove the unit. Elephants never gain from formations other than line. Post-battle: surviving units that fought a lane containing elephants gain `elephantSteady` (wired in M8). Rome cannot levy elephants; capture rules in M8.

**Character risk table** (`BALANCE.battle.risk`, weights sum 100): wing routed → killed 10 / captured 20 / wounded 30 / unharmed 40. Battle lost without that wing routing → 3 / 5 / 15 / 77. Modifiers: stationed on a cavalry wing +5 killed weight; enemy chose pursue on your routed wing +15 captured weight; commander (vs mere captain) +5 captured weight (he's the prize). Victorious side rolls nothing except lanes that personally routed.

**Victory tiers** (`BALANCE.battle.tiers`): crushing = enemy fully routed (all wings broken) or ≥ 2 wings broken with ≥ 60% total enemy casualties · clear = 2 enemy wings broken · marginal = enemy withdrew or single-wing-break end states. warScore: +20 / +12 / +6 (mirror negative; orderly withdrawal by you = −4 flat).

**War** (`BALANCE.war`): `maxSingleBattleSwing: 25` · skirmish drift ±1–3/season while campaigning · siege/objective values ±5–10 (consumed by M9's scheduler and later the Phase 3A script) · weariness: after 12 war-turns (3 years), both sides drift 1/season toward 0 · thresholds `{ sue: 40, forced: 70, dictate: 90 }` · desperation (|ws| ≥ 40, applies to losing side): levy Denarii cost ×0.75, all wings def ×1.1; (≥ 70): +1 stratagem hand size, and the *winning* side pays campaign upkeep ×1.25 (overextension).

### Chunk M1 — Done when

`tsc` clean; `BALANCE.battle`/`BALANCE.war` populated exactly per tables; no runtime behaviour change; a `DebugPanel` dump can print the matchup table.

---

## Chunk M2 — Lane Clash Resolution (single-round math)

**Goal:** A pure, seeded, exhaustively-tested function that resolves ONE round of ONE lane.

**Files to request:** `src/models/battle.ts`, `src/data/balance.ts`, `src/utils/` listing (for RNG), one existing engine file (e.g. `crisisEngine.ts`) as a style reference.

**Verify:** seeded PRNG availability (create `src/utils/seededRng.ts` if absent — mulberry32 or similar, tiny).

**Files to create:** `src/engine/battle/clashEngine.ts`, `__tests__/clashEngine.test.ts`

### Spec

`resolveLaneClash(laneA: WingState, laneB: WingState, ctx: { terrain, rng, sideAMods, sideBMods }) → LaneClashResult` where the result carries: casualties per unit, morale deltas per wing, applied-modifier summaries (strings for the log/debug), triggered sub-events (terror ticks, feint results, shock charges, amok — amok *orchestration* is M3, but the amok damage application helper lives here).

Resolution order within a round (fixed, documented in code):
1. **Prelude** (skirmisher chip + elephant panic chip) — only on each pairing's first engaged round.
2. **Feint resolution** if either side ordered feigned_retreat (both feinting = both resolve, comedy permitted).
3. **Shock application** (charging classes' shock × decay × formation × matchup × terrain → immediate morale + casualty chip).
4. **Melee exchange**: effective atk vs effective def both directions; casualties% = `BALANCE.battle.melee.baseCasualtyRate (first pass: 6) × (atkEff / defEff)`, clamped 2–15% strength per round, applied to units proportionally (weakest-first tiebreak).
5. **Morale accounting** (drain formula from M1; terror; wavering; wedge stall).
6. Emit `RoundLogEntry` fragments.

All multipliers compose multiplicatively in a single documented pipeline: `base × formation × matchup × veterancy × captain × terrain × status(flanked/overextended)`. One helper builds each side's effective-stat bundle; it is exported for the debug sandbox to display.

### Tests (this chunk is the math heart — be thorough)

Mirror matchups are symmetric under seed variation (±3% over 500 seeded runs); spear wall vs heavy cavalry charge: cavalry shock reduced to 25% and net round loser is cavalry; legionary beats spear_foot in a 5-round grind ≥ 70% of seeds; skirmisher screen reduces shock; wedge beats line frontally but loses harder when flanked flag set; open_ranks vs elephant lane takes no terror and ≤ 20% of normal shock; feint gating (raw units refused), success/failure/botch branches each exercised via forced-seed tests; determinism: same seed + inputs = identical result object.

### Chunk M2 — Done when

All tests pass; the function is pure (lint: no imports from `state/`); a table in the test file documents observed win rates for 6 canonical matchups (these become M11's tuning baseline).

---

## Chunk M3 — Battle Orchestrator (rounds, breaks, reserves, end)

**Goal:** Full battles run headless: deployment in, orders per round in, `BattleLog` + `BattleOutcome` out.

**Files to request:** M2 outputs, `src/models/battle.ts`, `balance.ts`.

**Files to create:** `src/engine/battle/battleEngine.ts`, `__tests__/battleEngine.test.ts`

### Spec

Public API (pure, state-in/state-out):
- `initBattle(deploymentA, deploymentB, terrain, seed) → BattleState` (validates: cavalry classes only on wings — reject centre cavalry at init with a typed error the UI can show; elephants anywhere; empty lanes permitted but seeded broken? No — an empty lane is `conceded`: counts as broken from round 1, log entry explains).
- `submitOrders(state, ordersA, ordersB) → BattleState` — applies formation changes/reserve commits/stratagem/withdraw for the coming round, then resolves the round via `clashEngine` per contested lane, then post-round phase: amok checks, wing-break detection, break resolution (pursue/wheel — **the break decision is itself an order**: when a wing breaks, the state enters a `break_decision` sub-phase for the victor side; the orchestrator exposes `submitBreakDecision(state, laneId, 'pursue' | 'wheel', targetLane?)`), rout cascade, end-condition check, outcome + tier computation.
- `getValidOrders(state, side) → structured affordances` (which formations are legal per lane right now, whether reserves/withdraw/feint available) — the UI and the AI both consume this; single source of legality truth.

Withdrawal: an orderly withdrawal order ends the battle after one final round resolved at def ×1.1 for the withdrawer (fighting retreat); outcome `withdrawal`, warScore −4 for the withdrawer, no risk rolls except already-routed wings. If ≥ 2 of the withdrawer's wings are already broken, withdrawal is unavailable (it's a rout now).

Reserves: committing reserves places units into a lane next round with fresh shock; reserve units contribute nothing while unassigned; max one lane reinforced per round (a real decision, not a top-up).

warScore delta computed into `BattleOutcome` with the M1 cap applied here (invariant 5).

### Tests

Full seeded battles run to completion ≤ 12 rounds for canonical armies (median 4–7 — record it); double-envelopment emergence: give side A superior cavalry both wings vs balanced side B, verify ≥ 40% of seeds produce both-wings-broken + wheel → centre collapse (Cannae check); conceded-lane, withdrawal, rout-cascade, and amok paths each exercised; `getValidOrders` blocks wedge/feint on captainless lanes; determinism end-to-end.

### Chunk M3 — Done when

A scripted headless battle prints a readable log via a test helper (`formatBattleLog` — write it; the UI chunks and sandbox reuse it); all tests pass.

---

## Chunk M4 — Armies, Captains & Character Risk (strategic ↔ battle bridge)

**Goal:** Real game state produces battle inputs; battle outcomes write back — casualties, veterancy exposure, character fates, triumph/trial hooks.

**Files to request:** `src/state/gameStore.ts`, `src/models/character.ts`, `src/models/province.ts` (levy/troop records), `src/data/startingClans.ts`, `src/engine/turnSequencer.ts` (military upkeep step), Phase 2's notice-injection helper location.

**Verify:** exact shape of levied forces and where they live; how volunteered family officers are tracked (manual: "Volunteer as Officer"); the trial system's entry point for indicting a character; the v2 triumph qualification pathway.

**Files to create:** `src/engine/battle/musterEngine.ts` (pure mapping both directions)

**Files to modify:** `src/state/gameStore.ts`, `src/models/character.ts` (status additions), `src/data/events.ts` (ransom/wounded notice events)

### Spec

- `musterArmy(state) → BattleUnit[]`: maps the strategic force records into battle units (a levy record of N troops → N/500-scale cohort units, class from levy type; veterancy/loyalty read from the records — if the current records lack these fields, **add them to the strategic record with defaults** raw/40 and note it; M8 owns their lifecycle).
- Captain roster: eligible captains = family members age ≥ 16 with the army, plus **clan legates**: for each clan with relationship ≥ 60, one offerable legate (procedurally named per Phase 2's leader-successor generator pattern, martial 4–7). Accepting a legate: +5 clan-leader relationship now; his death in your battle: −15; his share in a crushing victory: +10 and a ledger headline. This is deliberate political texture — surface those stakes in M5's UI.
- `applyBattleOutcome(state, outcome) → state`: casualties back onto strategic records; survivors' `engagedBattles` counter +1 (M8 consumes); character results — wounded: `woundedUntilTurn` = now + 4, all skills −2 while wounded (apply via the same status pathway existing effects use — verify) · captured: status + inject a ransom event chain (demand = `BALANCE.war.ransom` base 150 Denarii, choices: pay / negotiate (Fides, 60% halve) / refuse (character imprisoned; release on war end; −5 lifetimeDignitas) · killed: existing death pathway (verify how deaths process — paterfamilias death here triggers the normal succession flow; that interaction MUST be play-tested in this chunk) · commander of a crushing victory: feed the v2 triumph qualification · commander of a clear-or-worse *defeat*: set a `defeatedGeneral` flag the existing trial-trigger logic can read (add one condition clause to wherever `shouldTriggerTrial` composes — hostile clans may prosecute a beaten general; this is one line plus a test, not a new system).
- Ledger headlines + agenda: battle fought/won/lost headline; agenda generator #17 (`critical`): pending set-piece offer ("The armies will meet at [site]" — target: Provinciae). Register the generator id in `agendaEngine`'s catalog comment.

### Tests

Muster round-trips (strategic → battle → outcome → strategic) conserve troops minus casualties; each character-outcome branch mutates state correctly; paterfamilias killed-in-battle produces a clean succession hand-off; legate death moves clan relationship.

### Chunk M4 — Done when

A headless battle driven from a debug-constructed real `GameState` writes all consequences back without crashes, including a paterfamilias death.

---

## Chunk M5 — Battle UI I: The Commander's Tent (deployment + static resolution)

**Goal:** Battles are playable in the app, ugly-but-clear: full deployment screen, then round-by-round resolution shown as formatted log text with an orders panel. No animation yet.

**Files to request:** `App.tsx`, one screen + one modal component as style references (`CuriaScreen.tsx`, `EventModal.tsx`), `theme.ts`, M1–M4 outputs.

**Files to create:** `src/screens/BattleScreen.tsx`, `src/components/battle/DeploymentBoard.tsx`, `src/components/battle/OrdersPanel.tsx`, `src/components/battle/LaneCard.tsx`

**Files to modify:** `App.tsx` (battle takes over the screen — full-screen modal route above the tab navigator; verify the navigation pattern and match it), `src/state/gameStore.ts` (battle session state: `activeBattle: BattleState | null` + thin action wrappers around the engine API).

### Spec

- **DeploymentBoard:** three lane columns + reserve row; tap a unit chip → tap a lane to assign; per-lane formation selector (only legal options per `getValidOrders`); captain assignment per lane from the roster (portrait chip, martial shown, **risk pips**: 1–3 skull pips derived from station type and the M1 risk table — cavalry wing shows more); commander station selector with the tradeoff stated in one line ("Lead the right wing: stronger there, greater risk / Command from the rear: steadier everywhere, safer").
- **Advantage pips:** per lane, compare effective-stat bundles (reuse M2's exported helper) → 0–3 chevrons toward the favoured side with a one-word reason ("spears", "numbers", "ground"). Never numbers.
- **Resolution view (this chunk):** after "Give battle", each round renders as a formatted entry list (reuse `formatBattleLog`) inside a scroll; the OrdersPanel offers the legal orders; break decisions render as a two-button interstitial ("Pursue the routers" / "Wheel upon the centre").
- Battle end → outcome screen: verdict banner, tier, casualties, captain fates (each a line with portrait), warScore delta, "Return to Rome" (applies M4 write-back).
- Entry point for now: `DebugPanel` "Launch sandbox battle" with two preset armies (M11 expands this).

### Chunk M5 — Done when

A full battle is playable from the debug entry on a phone-sized screen with every mechanic reachable (feint, reserves, break decisions, withdrawal), and the outcome writes back to a real game state.

---

## Chunk M6 — Battle UI II: Animated Resolution

**Goal:** The hybrid feel: rounds *play out* visually (~10–15s), then pause for orders.

**Files to request:** M5 outputs, `theme.ts`; check `package.json` for `react-native-reanimated` (Expo default) — prefer it; **do not add `react-native-skia` without asking the user first** (native dependency decision).

**Files to create:** `src/components/battle/BattlefieldView.tsx`, `src/components/battle/animations.ts`

### Spec

Replace M5's text-log resolution view with a stylised top-down field: each lane = two opposing **line blocks** built from unit chips (width ∝ strength, colour by class, small veterancy pips), a centre "push front" that shifts with round advantage, wing morale bars flanking. The animation *interprets `RoundLogEntry` sequences*: shock charge = fast slide + impact shake; melee = slow push + strength shrink; terror = tremble on affected chips; wing break = chips scatter rearward; wheel = block arcs into adjacent lane; amok = elephant chip zigzag damaging both lines; withdrawal = ordered rearward slide. Round entries animate sequentially (~2s each, tap-to-skip to end-of-round state instantly — non-negotiable for the burst player). Keep M5's text log accessible behind a "dispatches" toggle (it's the accessibility fallback and the debug view).

**Scope guard:** no particles, no per-soldier sprites, no sound (sound is a later polish ticket). If any single animation fights Reanimated for more than an hour of implementation, replace it with a simpler cut and note it in the changelog.

### Chunk M6 — Done when

A full battle plays with animated rounds, pausing at every decision point; tap-to-skip works; the dispatches toggle shows the text log; performance is acceptable on a mid-range device profile (no dropped-frame stutter in the Expo dev build's perf monitor during a 3-lane clash round).

---

## Chunk M7 — Stratagems & Enemy General AI

**Goal:** Battles get their spice (order cards) and their opponent (personality-driven AI).

**Files to request:** M3 + M5/M6 outputs, `balance.ts`.

**Files to create:** `src/data/stratagems.ts`, `src/data/enemyGenerals.ts`, `src/engine/battle/battleAi.ts`

### Spec

**Stratagems** (`stratagems.ts`, 8 for v1 — data-driven effects referencing existing engine hooks, no bespoke logic per card beyond a small effect-key switch in the orchestrator): Ambuscade (pre-battle only: one enemy lane starts −10 morale; requires rough/river terrain) · Caltrops (one lane: incoming cavalry shock ×0.3 this battle) · Fire Arrows (elephant amok +20% this battle) · Rally the Standards (one broken own wing re-forms at 25 morale, once per battle, commander must be stationed adjacent) · Forced March (battle starts with enemy reserve unavailable until round 3; pre-battle, costs supply/Denarii) · Testudo Discipline (one lane: prelude + missile chip ×0 this battle) · Officer's Oath (one lane: loyalty counts as 80 this battle) · Double Envelopment Doctrine (both your wings' wheel flank bonus ×1.75; visible tribute to the fantasy).
**Hand building:** commander gets `1 + floor(martial / 4)` stratagems per battle, drawn weighted by army composition and terrain; desperation (+1 per M1). Played at deployment or any decision point per card's timing field.

**AI (`battleAi.ts`, pure):** `chooseDeployment(profile, army, terrain)` and `chooseOrders(profile, state)`. A `GeneralProfile` (data): formation preference weights, aggression (0–1: drives wedge/advance frequency and pursue-vs-wheel bias), reservePatience (rounds before committing), signature stratagem, flavour lines for the pre-battle scene. Decision logic: score each legal order = preference weight × situational heuristic (losing lane → defensive formation or reserves; enemy wing weak → aggression-scaled wedge; own wing broke → per-aggression pursue/wheel). Keep heuristics under ~10 rules, readable — this AI needs to be *characterful*, not optimal; profiles carry the variety. Ship 4 profiles in `enemyGenerals.ts`: Hanno the Cautious (low aggression, high patience) · Hamilcar the Fox (feint-heavy, signature Ambuscade) · Bomilcar the Bull (wedge + elephants, pursues always) · Xanthippus the Drillmaster (spear walls, Testudo, wheels always).

### Tests

AI never submits illegal orders across 200 seeded battles (validate via `getValidOrders`); each profile produces measurably different order distributions (assert on aggregate stats, e.g. Bomilcar's wedge rate > 2× Hanno's); Rally the Standards fires at most once.

### Chunk M7 — Done when

Sandbox battles against each of the 4 generals feel distinct in play (subjective — user verifies) and all tests pass.

---

## Chunk M8 — Unit Lifecycle: Veterancy, Loyalty, Donatives, Elephants

**Goal:** The strategic layer between battles makes armies *grow characters*: experience, loyalty, elephant-steadiness, and the retain-vs-disband decision with teeth.

**Files to request:** `gameStore.ts` (military actions), `turnSequencer.ts` (upkeep step), M4 outputs, `balance.ts`, `ProvinciaeScreen.tsx`/`LegionsPanel` (verify actual component name for army UI).

### Spec (all constants → `BALANCE.battle.lifecycle`)

- **Veterancy progression:** `engagedBattles` thresholds — 2 → trained, 5 → veteran, 9 + at least one crushing victory → legendary. Promote at battle write-back (M4's counter already exists; add the promotion pass).
- **Loyalty lifecycle:** new levies 40; +5 per campaign-season under the same commander; +10 per victory shared; −15 per defeat; −10 when the army's commander changes; **Donative** action (army-scope, `BALANCE`: 20 Denarii per cohort): +15 loyalty, once per year per army; loyalty clamps 0–100. Between wars, retained (upkeep-paid) units hold veterancy and decay loyalty −2/year toward 50; disbanded units are gone (this is the retain-vs-disband tension — surface both numbers in the army UI).
- **elephantSteady:** applied at write-back to surviving units that fought in or opposite a lane containing elephants.
- **Captured elephants:** after a crushing victory over an army containing elephants, 25% chance to gain 1 elephant unit (raw, loyalty 30, notice via the interstitial pattern: "The beasts of Carthage now eat from Roman hands. Philon is against it.").
- **Army UI additions:** per-unit rows show veterancy pips, loyalty bar, elephantSteady icon; Donative button; retain/disband with consequences stated inline.
- Glossary entries: Veterancy, Loyalty, Donative, War Score (≤ 2 sentences each, P1-F rules).

### Chunk M8 — Done when

A unit visibly progresses raw → trained across two sandbox battles wired through real state; donatives, decay, and disband all function; captured elephant path reachable via forced seed.

---

## Chunk M9 — War Score & Campaign Integration (provisional scheduler)

**Goal:** The strategic wrapper: warScore lives, moves, and produces set-piece offers — via a provisional scheduler cleanly replaceable by Phase 3A's war script.

**Files to request:** `gameStore.ts`, `turnSequencer.ts`, `crisisEngine.ts`, `agendaEngine.ts`, M1/M4 outputs.

**Files to create:** `src/engine/warEngine.ts`

### Spec

- `WarState` into `GameState` (`war: WarState | null`); started/ended by scripted triggers (Phase 3A) or a debug action for now.
- `warEngine.processWarSeason(state)`: called from a new turnSequencer step adjacent to the existing military upkeep step (document exact insertion point after reading the sequencer): applies skirmish drift while a campaign is active (±1–3, seeded, biased by relative army strength ± commander martial difference), weariness drift per M1, desperation/overextension modifier recomputation, and **the provisional scheduler**: if an army is on campaign, no set-piece in the last 2 turns, roll 25% → generate `SetPieceOffer` (site name from a small data list, terrain weighted by site, enemy army scaled to `10 ± warScore/10` cohorts with composition from the assigned general profile, general chosen round-robin from `enemyGenerals.ts`). Offer surfaces as an injected event: "The armies meet at [site]" — Give battle (→ BattleScreen) / Decline (warScore −3, commander lifetimeDignitas −2, offer expires).
- **THE SEAM (mark with a comment block):** the scheduler is one exported function `scheduleSetPiece(state) → SetPieceOffer | null`. Phase 3A replaces this single function with script-driven scheduling. Nothing else may call generation logic directly.
- Coupling to crisis: war crisis track input gains one term from warScore trajectory (losing: warScore < −20 adds +2/season to war track; winning ≥ +20 adds −1). One term, in `crisisEngine`'s existing per-season input composition — do not merge the systems.
- Threshold events: crossing ±40/±70/±90 injects notice events (copy: terse dispatch style) and, at ≥ sue-level, unlocks the negotiation entry (M10). Agenda generator #18: "Carthage may treat for peace" / "[Rome may be forced to terms]" (`critical`).
- Ledger: warScore delta line each war season.

### Tests

Drift/weariness/desperation math; cap enforcement (a +25-capped crushing victory at ws 65 lands at 90 — wait, 65+20+2 pursue rider = 87; test the cap binds only when raw swing > 25); scheduler spacing respected; seam function is the only offer source (architectural test: grep-style assertion or reviewed manually).

### Chunk M9 — Done when

Debug-starting a war and campaigning produces skirmish drift, periodic set-piece offers, threshold notices, and a coherent war crisis interaction across 20 simulated seasons.

---

## Chunk M10 — Peace: Negotiation & Senate Ratification

**Goal:** Wars end at a table, and the table answers to the Senate.

**Files to request:** M9 outputs, `gameStore.ts`, the bill/senate engine files (`senateEngine.ts` or equivalent — verify name), `CuriaScreen.tsx`, clan/faction bias data.

**Files to create:** `src/data/treatyTerms.ts`, `src/components/war/NegotiationScreen.tsx`

### Spec

- **Terms** (`treatyTerms.ts`; each: id, label, description, warScore price, effects as existing effect-string vocabulary + war-end fields, faction reaction weights): Indemnity minor/major (Denarii to treasury +100/+300; price 5/12) · Prisoner return (all captured characters home; 5) · Carthage quits western Sicily / all Sicily (province control transfers; 15/25) · Fleet limitation (future naval-war modifier flag; 10) · Face-saver clause (give the *loser* +5 warScore-equivalent dignity, −1 price of the total package, Optimates −reaction) — plus mirrored terms for when *Rome* is the loser (Rome pays indemnity, Rome cedes claims). Keep the v1 menu to ~8 terms.
- **Negotiation flow:** available when |warScore| ≥ threshold. Budget = `|warScore| − thresholdBase` (+ a base allowance at forced/dictate: 0/+10/+30). At `sue`: only the *losing* side initiates (if that's the AI, it composes a minor offer the player accepts/refuses — refusing costs nothing mechanical but injects faction reaction events); at `forced`: negotiation screen opens, term shopping within budget; at `dictate`: all terms affordable up to the cap, and the loser cannot refuse.
- **Ratification:** the composed treaty becomes a special bill through the existing bill pipeline (verify how special bills enter — the v2 plan's Dictator/Tribune work likely established injected-bill precedent): support seeded from faction reactions (Optimates penalise soft terms and face-savers; Populares penalise war-continuation and heavy levies — reuse the clan bias fields), voted next Winter session or an emergency session if the mechanic exists. **Passes:** war ends, effects apply, big epilogue-style notice, triumph check for the standing commander. **Fails:** war continues, warScore −5 ("Carthage takes heart"), negotiating consul −5 lifetimeDignitas, and the same treaty cannot be re-tabled for 4 turns. If the AI side was forced and the *Senate* refused, that is the player's political problem — exactly the intended drama.
- Rome-as-loser path: at warScore ≤ −70 the AI composes terms per its general profile's aggression; player must table them; Senate may still refuse (and the war grinds on with Rome desperate). At ≤ −90, terms auto-ratify (Rome dictated *to*) and feed the campaign-failure epilogue (Phase 3 wiring; leave a flag).

### Tests

Budget math at each threshold; both loser/winner paths; ratification pass/fail effects; the 4-turn re-table lockout; treaty effect application (province transfer, prisoner release).

### Chunk M10 — Done when

A debug war can be ended at every threshold from both sides, through the Senate, with all effects applied and sane notices throughout.

---

## Chunk M11 — Sandbox, Simulation Harness & Tuning Pass (last)

**Goal:** The developer can test any battle instantly and prove the balance targets.

**Files to request:** `DebugPanel.tsx`, all M1–M10 outputs as needed.

### Spec

- **Sandbox (extends M5's debug entry):** army builder for both sides (add units by class/veterancy/loyalty, pick captains from stock profiles, terrain, general, seed field), launch into the real BattleScreen.
- **Headless harness:** `simulateBattles(configA, configB, n, aiVsAi = true)` running the engine without UI, returning aggregate stats: win rates, median rounds, casualty averages, amok frequency, formation usage by AI. Exposed as a DebugPanel action with a results dump. (This is cheap because M3 is already headless — the harness is a loop and a tally.)
- **Tuning targets** (adjust `BALANCE.battle` constants ONLY; structural changes require stopping and reporting): mirror armies 47–53% either side · every unit class appears in at least one composition that wins ≥ 55% vs a naive all-legionary army (each class earns its slot) · median battle length 4–7 rounds, p90 ≤ 10 · AI-vs-AI crushing outcomes 15–30% of battles (decisive results happen but aren't the norm) · elephant armies vs prepared counters (skirmisher+spear+open_ranks) lose ≥ 60% (the gamble must be counterable) · double envelopment reproduces in the Cannae config ≥ 40% of seeds (regression-protect M3's test).
- Record final values + observed stats in a `## Tuning log` appendix at the bottom of this file (or sibling note).

### Chunk M11 — Done when

All targets demonstrated by harness output pasted into the tuning log; sandbox usable for any future battle bug report.

---

## Cross-Chunk Notes

- **`gameStore.ts`** is touched in M4, M5, M8, M9, M10 — additive, in order; battle-session actions stay thin wrappers over the pure engine.
- **`turnSequencer.ts`** is touched only in M9 (one new step) and possibly M4 (verify whether wounded-status expiry needs a tick or reuses an existing status-expiry pass — prefer reuse).
- **New engine directory:** `src/engine/battle/` (clashEngine, battleEngine, musterEngine, battleAi) + `src/engine/warEngine.ts`. Update `sitemap.md` when the overhaul completes.
- **Notice pattern:** M4 (ransom/wounds), M8 (elephants), M9 (thresholds), M10 (treaty) all use Phase 2's `injectNoticeEvent` helper. Battle-context notices use dispatch voice (terse, military); Rome-context ones may use Philon. Never mix registers in one notice.
- **Agenda generators added:** #17 set-piece pending (M4), #18 peace available (M9). Keep `agendaEngine`'s catalog comment current.
- **Old systems retired:** whatever abstract campaign-battle resolution currently exists is superseded for set-pieces only — locate it in M4 and route set-piece resolution through the new engine while leaving non-battle campaign mechanics (supply, senate response to unsanctioned armies, upkeep) untouched.
- **Naval futures:** any chunk that finds itself writing `if (unitClass === 'legionary')`-style logic outside the matchup/stat tables is violating invariant 3 — push it into data.
- **Explicitly out of scope for this plan:** naval battles (data model must merely not preclude them) · the Phase 3A war script (only the M9 seam) · battle sound · multi-army fronts (one Roman field army at a time) · sieges as playable battles (sieges are warScore objectives, resolved abstractly until a future "Siege Expanded" decision).

## Documentation updates (after M11)

`game-manual.md`: replace the military campaign resolution text with the new system (battle overview, unit classes + matchup table, formations, veterancy/loyalty, captains and risk, warScore thresholds, negotiation + ratification); revise "Military Actions" and veterans sections; add War Score to Key Strategic Principles ("win the war, then win the Senate"). Refresh `sitemap.md` with the new `engine/battle/` tree, screens, and data files. Add the new glossary terms list (M8) to the Tabularium source list.

## Military overhaul — Done when (integration criteria)

1. From a real campaign, a set-piece offer leads through deployment, an animated multi-round battle with at least one decision point, and an outcome that changes strategic state — in under 10 minutes.
2. A family member can die, be captured (and ransomed), or be wounded in battle, with every consequence flowing through existing systems (succession, events, statuses); a defeated commander can face trial; a crushing victor can qualify for a triumph.
3. No single battle moves warScore more than 25; a war can be ended at all three thresholds via a Senate-ratified treaty, and the Senate refusing a treaty is a playable, survivable state.
4. Each of the 4 enemy generals is distinguishable in play; each unit class has a demonstrated competitive role per the M11 harness stats.
5. All engine code is pure, seeded, and covered by the M2/M3 test suites; the whole battle layer is exercisable headless from the debug harness.

## Tuning log (Chunk M11)

Harness: `src/engine/battle/battleSim.ts`'s `simulateBattles`, exercised via `__tests__/battleSim.test.ts` (regression locks) and DebugPanel's "HEADLESS HARNESS" panel (ad hoc). All figures below are direct harness output, not estimates.

### Two structural fixes (found by the harness, not by design — reported and approved before applying)

Building the harness's first target (mirror-army win rate) immediately surfaced two pre-existing `battleEngine.ts` bugs that no prior test caught, because no prior test measured win-rate *distribution* — only round counts:

1. **`checkRoutDefeat` iteration-order bias.** A fully symmetric clash (e.g. two identical armies, no captains — nothing that draws RNG) puts both sides at ≥2-broken-wings in the *same* round. The original function iterated `['attacker', 'defender']` and returned whichever it found first, so the attacker lost every such tie — mirror battles resolved defender-favor 300/300, not ~50/50. Fixed: simultaneous double-breaks now resolve by remaining total army strength; an exact-strength tie falls back to the round's own seeded rng.
2. **`submitBreakDecision` pending-decision collision.** `pendingBreakDecisions` can legitimately hold two entries with the same `laneId` (one per side) when both sides' same-named lane breaks in the same round. The removal filter matched on `laneId` alone, so resolving one side's break silently discarded the *other* side's pending decision too — it was never pursued/wheeled, handing that side's lane a free pass. Fixed: removal is now keyed on `(laneId, brokenSide)`.

Both are in `src/engine/battle/battleEngine.ts` (`checkRoutDefeat`, `submitBreakDecision`). See the inline comments at each site for the full before/after. Verified against the full M2–M10 test suite (162 tests) — no regressions.

### BALANCE.battle changes

- `morale.casualtyDrainMult`: `0.8` → `1.8`. This is the length lever, not `melee.baseCasualtyRate` — per invariant 4 ("morale wins battles, not annihilation"), shortening fights should come from wings breaking sooner, not from armies bleeding out faster. Dropped the canonical mirror-army battle from a fixed 10 rounds to a fixed 4 (two identical armies still have ~no RNG, so min=median=max, just at a lower number).
- Added one matchup rule: `{ subjectClass: 'elephant', vsClass: 'spear_foot', atkDelta: -1 }` (mirrors the existing `cavalry_heavy` vs `spear_foot` rule one point milder). Without it, the plan's own "prepared counter" composition (skirmisher+spear+open_ranks) only neutralizes an elephant's *shock* (the existing `incomingShockMult` rules), not its base melee atk — elephants kept winning ≥60% of trials against their designated counter, the opposite of the target.

### Target-by-target results (harness output, verified via `__tests__/battleSim.test.ts`)

| Target | Result |
|---|---|
| Mirror armies 47–53% either side | 50.3% / 49.7% (n=300, trivial mode, identical 9-legionary armies) |
| Median battle length 4–7 rounds, p90 ≤ 10 | median=4, p90=4 (same mirror scenario, n=300) |
| Every unit class wins ≥55% in some composition vs naive all-legionary | All 5 non-legionary classes hit 100% (n=150–300 each) via combined-arms comps (wedge+captain cavalry flanks carrying a class embedded in the winning wing; spear_foot holds centre in shield_wall while cavalry wins the flanks; elephant flanks vs a legionary-only defender need no help). Naive `line`-formation swaps alone did *not* clear the bar for any class except elephant — legionary's stats have no built-in weakness, so beating it cleanly requires actual formation/captain tactics, not just a class swap. See `__tests__/battleSim.test.ts` for the exact compositions. |
| AI-vs-AI crushing outcomes 15–30% | 20.8% (mixed 9-unit armies, all 4 general profiles round-robin, n=20/pairing × 12 pairings = 240 trials) |
| Elephant army vs prepared counter (skirmisher+spear+open_ranks) loses ≥60% | Elephant side loses 62.8% (n=200, trivial mode, 9 elephants vs a 9-unit skirmisher/spear open_ranks mix) |
| Cannae double envelopment ≥40% (M3 regression) | Reverified unaffected by the above changes — still 100/100 both-wings-broken, wheel exercised, at n=100 (`__tests__/battleEngine.test.ts`) |

### Known rare edge case (flagged, not fixed)

The elephant-vs-prepared-counter scenario leaves ~0.5–2% of trials (n=200) unresolved within the 60-round safety cap: amok events remove elephant units and deal strength damage without draining morale (only melee/shock casualties feed `calcCasualtyDrain`), so a lane can occasionally grind down to a couple of low-strength survivors on each side without either wing's morale pool ever crossing zero. Bounded (`expect(agg.unresolved).toBeLessThanOrEqual(4)`) rather than fixed — it's a rare tail on a synthetic all-elephant composition unlikely to occur in real play (armies are never literally 9 elephants), and a real fix (morale-linked amok damage, or a hard round cap with a forced-withdrawal resolution) is a structural engine change outside this chunk's constant-only tuning mandate. Worth a look if a future chunk touches amok or morale drain again.
