# Balance Checks — Reference & Playbook

A living reference for re-running the game's balance checks after future edits (new events, office/election tuning, crisis/income formula changes, trial constants, difficulty presets, new families, etc.). Grew out of Phase 5, Chunk P5-H's tuning pass — see `rome-phase5-implementation-plan.md`'s `## Tuning log` appendix for that pass's full narrative and evidence. This doc is the reusable playbook; that appendix is the historical record of one specific pass. Keep this doc current as targets are added/retired or tooling changes; don't let it drift into a second historical record.

## How to use this doc

1. Skim **"When to re-run what"** to figure out which checks your edit actually touches — don't run everything for a one-line content tweak.
2. Run the relevant command(s) from **"Quick-start"**.
3. Compare against the **last-known-good values** under each target. A big divergence isn't automatically wrong — content and formulas are supposed to move things — but it's a signal to look closer before shipping.
4. If you retune a `BALANCE` constant based on what you find, update the **last-known-good value** here and add a one-line dated note, same discipline as the tuning log appendix.

## Quick-start: the full check sequence

```bash
npx tsc --noEmit                 # always, after any change
npx jest                         # always, after any change
npm run audit:events             # after adding/editing/removing events
npm run sim:elections             # after touching office/election constants
npx jest p5g.test.ts             # after touching income/crisis/difficulty formulas
npx jest p5h.test.ts             # after touching trial/war/family-starting-stat constants
```

`p5g.test.ts` and `p5h.test.ts` are regression tests, not just one-off scripts — they assert against the last-known-good numbers below, so a genuine regression fails the suite. `audit:events` and `sim:elections` are print-and-inspect tools; nothing fails automatically, you have to read the output.

---

## The targets

### #1 — Minutes/season median 3–6, never >8 at any stage

**Why it matters:** the core pacing promise — a season shouldn't feel like a chore.
**How to check:** hand-play ≥12 seasons sampled early/mid/late (debug-state jumps into a Patron Tier are fine), read DebugPanel → Pace tab. **Cannot be checked by simulation or script** — `SeasonStats.durationSec` is real wall-clock time (`Date.now() - seasonStartedAt`); nothing else means anything here.
**Constants:** `BALANCE.actionEconomy.maxSeasonDurationSec` (8×60 sec — the Pace panel's own red-flag threshold).
**Last checked:** P5-H (2026-07). Not evidenced — no device/emulator access that pass. Still open.

### #2 — Meaningful actions 3–4 early / 4–6 mid / 5–8 late

**Why it matters:** are there enough decisions per season to feel busy without feeling overwhelmed, and does that scale with the player's growing agency (Patron Tier)?
**How to check:** same hand-play sessions as #1 — DebugPanel → Pace tab shows `avgActions` per stage against `actionBand`, flags `actionsOutOfBand`.
**Constants:** `BALANCE.actionEconomy.actionBand` — `{ early: [3,4], mid: [4,6], late: [5,8] }`. Stage is derived from Patron Tier alone (`actionEconomyEngine.deriveStage`: tier 0–1 early, 2–3 mid, 4–5 late).
**Last checked:** P5-H (2026-07). Not evidenced — same reason as #1. Still open.

### #3 — First "oh no" moment ≤ 8 seasons on a fresh guided start

**Why it matters:** the guided/tutorial start should hook the player with a real stake (trial, blackmail demand, lost election, or a crisis spike) early, not just walk them through UI.
**How to check:** `npx jest p5h.test.ts -t "Target #3"`. Drives 3+10 fresh auto-played guided starts through `gameStore.endSeason` (auto-resolving events with their first no-skill-check choice — same idiom as `gameStore.runIdleSeasons`), and checks headlines/state each season **before** `dismissSeasonOverlay()` clears them (a real bug found during P5-H — checking after silently misses anything that fired-and-resolved same-season).
**Constants/logic:** the Claudius-arc demand trigger in `turnSequencer.ts` (`yearsSinceStart >= 1` is the pacing floor since P5-H removed the old `tutorialDone` gate); `BALANCE.secrets.claudius`.
**Last checked:** P5-H (2026-07). Literal target: 3/3 fresh runs pass (usually via a passive War-tier crossing at season 2 — informative but not evidence of authored content specifically). Spirit-of-target (the Claudius arc's own demand specifically): **8/10** runs within 8 seasons. If a future change to the tutorial script length, the generic secrets system's demand frequency, or the Claudius arc's own gate pushes this rate down noticeably, that's a regression worth investigating — the test asserts `hitCount >= 6`.

### #4 — Election summit curve (low offices easy, Praetor/Consul genuine summits)

**Why it matters:** the Cursus Honorum should read as an actual ladder, not a flat coin-flip at every rung.
**How to check:** `npm run sim:elections`. Prints win rate / contested rate / median votes per office, under three player-investment postures (none / light canvassing / heavy canvassing + clients + Grand Games).
**Constants:** `RIVAL_STRENGTH_BY_OFFICE_RANK`, `CANVASS_FIDES_COST_BY_OFFICE_RANK` (both `electionEngine.ts`).
**Tooling:** `src/engine/electionSim.ts` (pure `simulateElections` harness, mirrors `engine/battle/battleSim.ts`'s idiom) + `scripts/electionSim.ts` (the runner — edit `rivalField()`/`BANDS` there to change the synthetic rival pool or investment postures). **Tribune is deliberately excluded** — it doesn't use `resolveElection`/`state.campaigning` at all, it's a separate plebs-mood-scaled roll in `gameStore.endSeason`.
**Last checked:** P5-H (2026-07). Shape holds through Praetor: no investment wins nothing (Quaestor's 100%-at-zero-investment result is a pool-size artifact of the test's 6-rival fixture vs. its 8 seats, not a real signal — don't read too much into it), light investment wins Vigintivirate, heavy investment wins through Praetor. **Consul stayed at 0% even under heavy investment — an open evidence gap, not a confirmed bug.** The test's Consul rival pool (6 leaders who *all* already hold Praetor) is denser than `tickNpcCareers`' slow probabilistic advancement likely produces in a real run by the time a player reaches Consul eligibility. Closing this gap needs either a real multi-season `tickNpcCareers` sample (build a harness that runs many seasons and snapshots how many NPCs are actually Consul-eligible by, say, turn 40) or real hand-play data — don't retune `RIVAL_STRENGTH_BY_OFFICE_RANK` off the current synthetic pool alone.

### #5 — Event economy near-neutral

**Why it matters:** the random event pool shouldn't be a hidden net drain or windfall that fights the game's other economic systems.
**How to check:** `npm run audit:events`. Prints pool size (target 80–120, random-draw-eligible only), condition-family/weight-band breakdowns, and an effect-magnitude fingerprint (sum/mean per resource token, success-weighted).
**Tooling:** `scripts/eventAudit.ts`. `docs/content-audit.md` is the batch-by-batch history of this number through Phase 5 — check there first if a magnitude number surprises you, it's often already explained.
**Last checked:** P5-H (2026-07). Pool: 82 (within target). Net tracked-token sum: −311 (denarii-heavy negative skew), confirmed **accepted by design**, not a bug — P5-B/P5-C's own audit entries pre-flagged this exact skew as the intended character of crisis-reactive/domestic content (spending denarii to buy fides/dignitas/plebs is the point of that content, not an accident) and already confirmed no single event exceeds the guide's magnitude bands. **If hand-play data (targets #1/#2) ever shows real economic strain, the intended lever is `BALANCE.income`, not clawing back event magnitudes** — don't re-litigate this without new evidence.

### #6 — War: all 3 outcomes reachable; harder early, easier near 241 BC

**Why it matters:** the ripeness curve is the whole shape of the war arc — a flat difficulty would make the "race against history" premise pointless.
**How to check:** `npx jest p5h.test.ts -t "Target #6"` for the ripeness curve shape; `npx jest warEngine.test.ts` for outcome reachability (pre-existing Phase 3 coverage, not re-derived).
**Constants:** `BALANCE.war.ripeness` (thresholds, `ripePhaseThreshold`); `warEngine.computeRipeness` / `terminalThresholds`.
**Last checked:** P5-H (2026-07). Ripeness climbs monotonically 264→241 BC; Victory/Humbled thresholds interpolate toward their easier bounds as ripeness rises. Confirmed unchanged and intact.

### #7 — Trials: 70/30 clamp intact; Claudius trial "3–4 actions → comfortably Acquitted+"

**Why it matters:** the 70/30 prep/performance split is a named design invariant (trial day is at most a ±30% swing on top of prep). The Claudius arc is the game's signature early trial — it needs to be winnable with a modest, achievable investment, not a trap.
**How to check:** `npx jest p5h.test.ts -t "Target #7"`. Simulates the actual trial math (`computeOpponentPrepGrowth`, `computeVerdict`) rather than reasoning about it from fixtures alone.
**Constants:** `BALANCE.trials.prepShare` (must stay `0.70`); `BALANCE.secrets.claudius.trialSeed` and `.startsDelaySeasons` (Claudius-specific — **not** the shared `BALANCE.trials.npcInitiatedDelay`, which every other NPC-initiated trial still uses).
**Last checked:** P5-H (2026-07). `prepShare` unchanged at 0.70. Claudius trial **retuned this pass**: `trialSeed` 10→**0**, new `startsDelaySeasons`: **1** (was implicitly 3, via the shared constant). Simulated result: 4 representative prep actions (2× Gather Evidence @ intrigus 5, 2× Prepare an Oration @ rhetoric 6) now land on **Dismissed**, differential **+17.8** (was Exiled, −15.4, before the retune). "Comfortably Acquitted+" is read as "solidly past the Dismissed threshold (10), not barely" — literally reaching the Acquitted band (needs differential > 30) isn't achievable via 4 modest actions against *any* meaningful opponent growth window, and isn't the bar this check holds to.
**If you touch Claudius's own stats** (intrigus 9 / clan influence 75, `startingClans.ts`) or the shared `npcPrepPerIntrigue`/`npcPrepClanFactor`, re-run this check — the growth-rate math is sensitive to both.

### #8 — Preset spread (Ferox vs. Clemens, 12 seasons, identical seed)

**Why it matters:** the three difficulty presets need to actually feel different, not just cosmetically labeled.
**How to check:** `npx jest p5g.test.ts` (12-season monotonic ordering) and `npx jest p5h.test.ts -t "Target #8"` (the specific ≥15-point aggregate-crisis-gap magnitude check).
**Constants:** `BALANCE.difficulty` (`clemens`/`aequus`/`ferox` — `incomeMult`, `crisisMult`).
**Last checked:** P5-H (2026-07). Aggregate crisis gap over 12 seasons from an identical pressured seed: **44 points** (target: ≥15). Income leanness is proven exactly by construction (the multiplier math is deterministic — `p5g.test.ts`'s income-seam tests), not just observed via simulation.

### #9 — Alt families (Duilia/Manlia) are sidegrades, not power creep

**Why it matters:** design invariant — unlockable families should be flavor/playstyle variants, never strictly better or worse than Brutii.
**How to check:** `npx jest p5h.test.ts -t "Target #9"`. Compares 12-season **growth** (delta from each family's own starting point — not absolute end values, since Duilia/Manlia intentionally start with different fides/denarii/dignitas than Brutii, already covered by `p5e.test.ts`) across all three families from an identical passive-play seed.
**Constants:** `BALANCE.altFamilies` (starting denarii/fides/dignitas/corruption/reputations).
**Last checked:** P5-H (2026-07). 12-season fides growth: Brutii +66 to +74, Duilia +43, Manlia +90 to +96 — same order of magnitude, no mechanical fides advantage either direction. Denarii diverges sharply by design (Duilia +51 vs. Brutii −105 vs. Manlia −80 — intentional; "the money is the hook"). Dignitas growth was 0 for all three under passive play (dignitas needs active munificence/military/office actions an idle auto-run never takes — not a divergence signal either way).

---

## Tooling reference

| Tool | What it is | Run it |
|---|---|---|
| `scripts/eventAudit.ts` | Prints random-draw pool size, condition/weight/season breakdowns, effect-magnitude fingerprint | `npm run audit:events` |
| `src/engine/electionSim.ts` + `scripts/electionSim.ts` | Pure Monte Carlo election harness (mirrors `battleSim.ts`'s idiom) + a runner across all real office bands | `npm run sim:elections` |
| `gameStore.runIdleSeasons(n)` | Store action: ends `n` seasons with no player input, auto-resolving events with their first no-skill-check choice. DebugPanel's "Auto-Season Runner" (Pace tab) is the UI for this. | In-app, or call directly from a script/test |
| DebugPanel → Pace tab | Shows `seasonStatsHistory` averaged per stage (early/mid/late) against `BALANCE.actionEconomy` bands — the only source of targets #1/#2's real data | In-app only |
| `__tests__/p5g.test.ts` | Regression suite for the two difficulty seams (income, crisis escalation) and preset ordering | `npx jest p5g.test.ts` |
| `__tests__/p5h.test.ts` | Regression suite for targets #3, #6, #7, #8, #9 | `npx jest p5h.test.ts` |

**A note on the election harness's circular-import workaround:** `scripts/electionSim.ts` imports `../src/data/balance` first, before anything else. This isn't stylistic — `balance.ts` and `electionEngine.ts` (via `data/offices.ts`) have a load-order-dependent circular import that Jest's CJS transform tolerates silently but `tsx`'s stricter ESM semantics don't (a real TDZ crash if `electionEngine.ts` loads first). If you write a new standalone script that touches `electionEngine.ts`, either copy this same first-import trick or import `gameStore.ts` first (anything that pulls `balance.ts` in before `electionEngine.ts` gets a chance to). This is a pre-existing repo quirk, harmless in the shipped app (nothing reads the affected `BALANCE.elections` re-export), not something in scope to fix here.

## When to re-run what

| You changed... | Re-run |
|---|---|
| Event content (`data/events.ts` and siblings) — added, removed, or reweighted | `npm run audit:events` |
| Office/election constants (`electionEngine.ts`, `OFFICES`) | `npm run sim:elections` |
| Income formula (`resourceEngine.calcResourceIncome`) or crisis escalation (`crisisEngine.calcIndividualEscalation`) | `npx jest p5g.test.ts` |
| `BALANCE.difficulty` | `npx jest p5g.test.ts` + target #8 in `p5h.test.ts` |
| Trial constants (`BALANCE.trials`, `BALANCE.secrets.claudius`) | `npx jest p5h.test.ts -t "Target #7"` |
| War ripeness constants (`BALANCE.war.ripeness`) | `npx jest p5h.test.ts -t "Target #6"` |
| Alt family starting stats (`BALANCE.altFamilies`) | `npx jest p5h.test.ts -t "Target #9"` |
| Tutorial script length/content, or the Claudius arc's gate conditions | `npx jest p5h.test.ts -t "Target #3"` |
| Anything touching pacing/action costs that a real player would feel | Flag for a hand-play pass (targets #1/#2) — nothing here substitutes for it |

## Levers, in priority order (per the Phase 5 plan)

When a check comes back off-target, prefer levers in this order — cheapest/most contained first:

1. Event weights/magnitudes (this phase's own content first)
2. Munificence cooldowns/slots
3. Small-action cooldowns
4. Income constants
5. Tier multipliers
6. Preset multipliers (`BALANCE.difficulty`)

**Structural findings — a system or a piece of wiring is wrong, not just a number — get written up and stopped on, not silently patched.** Two examples from P5-H: the Claudius-arc `tutorialDone` gate (an engine-logic dependency, not a tunable number) and the election harness's Consul evidence gap (a methodology limitation, not confirmed evidence of a bug). Both needed a decision, not a guess.
