# Military & Provinces — Legibility, Sieges & Diplomatic Annexation (PRD)

## 0. How to use this document

**Status:** draft PRD — aligned with the user on scope and direction (2026-08-03), not yet an
actionable spec doc. The next phase (a spec doc in this repo's usual chunked-implementation style,
e.g. `rome-campaign-map-implementation-plan.md`) should ground each section below against the code
*again* at spec-writing time — this doc's file:line citations were verified at PRD-writing time and
will drift.

**Base branch:** ground all research and implementation planning against **`tutorial-rebuild`**
(`origin/tutorial-rebuild`), not `main`. That branch is the user's own active work (Teach → Goal →
Sandbox tutorial rebuild + an Ambition-system rework) and is materially ahead of `main` in adjacent
systems this PRD touches or could reuse. It does **not** modify any of the military/provinces engine
or UI files this PRD is about (`army.ts`, `musterEngine.ts`, `campaignResolver.ts`,
`movementEngine.ts`, `cityEngine.ts`, `warEngine.ts`, `warStanding.ts`, `theatreEngine.ts`,
`MapView.tsx`, `ArmyCard.tsx`, `RegionSheet.tsx`, `BattlefieldView.tsx`, `battle/*`) — confirmed via
`git diff main...origin/tutorial-rebuild --stat`. It does touch `MilitaryTab.tsx` (a Senate-Response
banner, unrelated to this PRD's content) and introduces the Ambition system, which §7 below discusses
as reusable infrastructure.

**Relationship to prior plans:** this PRD sits downstream of the fully-shipped
`rome-campaign-map-implementation-plan.md` (regions, armies, muster, commands, war standing — chunks
C1–C10, tuned, all green) and `rome-foreign-relations-implementation-plan.md` (Ambassador postings,
foreign-power war declarations). It does not re-open either. It also does not touch
`rome-military-implementation-plan.md` ("Legate's Line," the tactical battle engine, M1–M11) beyond
the legibility fix in §6.2.

**Packaging:** one PRD, intended to become one spec doc with independently-implementable, dependency-
ordered chunks (matching this repo's own convention for large multi-part work) — not split into
several standalone PRDs, since the chunks share context (the War Room/Army unification in particular
is a dependency for the siege chunk).

---

## 1. Problem statement

The Provinciae/military surface is where the campaign-map system (C1–C10) landed its full depth, but
several real gaps and legibility failures are stopping players from using that depth confidently:

- Players can't reliably tell an army to move to a region because the UI's tap targets are ambiguous
  (city pins beat region hit-targets) — bad enough that the shipped tutorial has to explicitly coach
  around it mid-lesson.
- The battle screen shows two different real numbers (strength, morale) as unlabeled bars with no
  indication of what they mean or which one determines the outcome.
- Raising troops doesn't show the player what relationship is actually doing to cost/quality before
  they commit, despite the engine already computing it.
- A parallel, older recruiting system (flat Press/Levy/Elite, no region-manpower check) still exists
  for province revolts, disconnected from the new region-based manpower the Carthage war uses —
  meaning "how much manpower does this region have" has two different, contradictory answers
  depending on which screen you're looking at.
- Taking a city is entirely abstract (a flat occupation-duration counter) with no simulated food
  supply, surrender pressure, or player agency during the siege.
- A city's relationship with Rome can climb indefinitely with no path to actually joining the
  Republic unless it was already Roman-owned — foreign/independent cities are permanently locked out
  of a diplomacy-only path, which reads as a bug to a player watching a 98-relationship city do
  nothing.
- The Provinciae map is a fixed-size static image with no zoom, making the 8-region theatre map
  cramped on smaller devices.
- The "War Funding: Carthage" bill's real cost (a one-time 15-denarii hit, re-offered periodically)
  doesn't read as a meaningful trade-off to the player.

None of these are missing engines so much as missing surface area, missing legibility, or one
genuinely missing mechanic (sieges) and one genuinely missing path (diplomatic annexation).

---

## 2. Grounded findings

Verified against `origin/tutorial-rebuild` (and, where noted, unchanged from `main` since
`tutorial-rebuild` doesn't touch these files). Re-verify line numbers at spec-writing time.

**Two parallel military/manpower systems exist, unmerged**

1. **Legacy:** `TroopUnit` (`src/models/troop.ts`) + `CampaignState` (abstract "War Room" progress
   bars) — engine in `src/engine/campaignEngine.ts`, UI in `MilitaryTab.tsx` (mounted inside
   `CitySheet`). Recruiting here is flat-cost (`Press` free / `Levy` 20g / `Elite` 50g,
   `MilitaryTab.tsx`'s `AllocationRow`) with **no region-manpower-pool check at all**. This is the
   only UI for province/city revolts today.
2. **Current:** `Army`/`ArmyUnit` (`src/models/army.ts`), region-based movement
   (`src/engine/movementEngine.ts`), season resolution (`src/engine/campaignResolver.ts`), real
   tactical battles (`src/engine/battle/*`) — UI in `MapView.tsx`, `RegionSheet.tsx`, `ArmyCard.tsx`,
   `BattleScreen.tsx`. This is what the Carthage war actually runs on.
3. `models/army.ts`'s own header comment documents the fork as deliberate-but-unresolved: "Army is
   new and additional... personal troops fold into Army later." That "later" is what §6.4 proposes
   doing.
4. The old `campaignEngine.resolveCampaignSeason` has zero call sites repo-wide per its own header
   note (superseded by the same-named function in `campaignResolver.ts`) — dead code, not yet
   removed. `PendingGovernorAssignment` (`models/city.ts`) is similarly dead.

**Movement UX**

5. Destination selection is already region-level: `MapView.tsx`'s order mode
   (`orderModeDestinations` prop) replaces the normal tap layer with `OrderHighlight` circles centered
   on each region's centroid; there is no per-city destination anywhere in the movement flow.
6. City pins (`onProvincePress`) render on top of the region "ground" tap target
   (`RegionTapTarget`, sized to the mean of the region's traced border points) and claim taps first —
   confirmed as the mechanism behind the "hard to click the region" complaint.
7. **The shipped tutorial already works around this bug.** `tutorialScript.ts`'s `war` arc, step
   `war.find-campania-region`: *"Tap the ground itself, not the city — the region beneath it, where
   armies muster."* This line becomes unnecessary once §6.1 ships and should be simplified/removed
   in the same chunk.
8. `movementEngine.reachable()` is the map preview's single source of truth — the UI renders exactly
   what it returns, never an approximation. Any UX fix must keep this invariant (matches
   `rome-campaign-map-implementation-plan.md`'s design invariant 6).

**Battle screen**

9. Two independently real numbers render as bars in `BattlefieldView.tsx` with no explanation: a
   per-lane strength/cohesion "tug of war" bar (from `BattleUnit.strength`, 0–100 "% of full cohort
   strength remaining") and a separate YOU/ENEMY `WingState.moralePool` bar (0–100) — the actual
   break condition (`broken` fires at `moralePool <= 0`). These are mechanically distinct and neither
   is currently glossed.
10. The abstract-resolver interstitial (`EngagementInterstitial.tsx`) shows a coarser three-state
    `Advantage: You / Advantage: The Enemy / Evenly Matched` label — no bars there, a separate and
    already-simpler surface.

**Muster / manpower**

11. `musterEngine.ts` already computes everything needed for a clear player-facing preview: manpower
    cap per region (`Region.baseManpower` vs. `TheatreState.musteredThisYear[regionId]`, reset each
    Winter→Spring), a relationship-driven cost discount, and a relationship-gated quality step-up
    ("good families send their sons"). `MusterPanel.tsx` shows tier cards but not the live relationship
    math behind them.
12. Separate imperium-threshold/Senate-response distinction (sanctioned vs. unsanctioned muster) is
    unrelated to legibility and out of scope for this PRD's muster-clarity chunk — do not touch.

**Sieges**

13. Confirmed: no siege mechanic exists anywhere in the codebase. `BALANCE.war.siegeObjectiveMin/Max`
    (`data/balance.ts`) is declared and read by nothing (zero call sites, repo-wide grep). No
    food-supply, surrender-chance, or sally-out logic exists on `CityState` or `Army`.
14. City/region control instead flips via `TheatreState.contested[regionId]`, an occupied-duration
    counter that flips ownership at `BALANCE.campaign.resolution.controlFlipThresholdSeasons`
    (tuned to **12** seasons in the C10 tuning pass — see that plan's tuning log for why 2 was too
    fast). This is the mechanism §6.5 proposes replacing with a computed, player-influenceable score.
15. `Army.stationedCityId` already exists purely as flavor/siege-framing (which specific city inside
    a multi-city region an army is camped at/besieging) — reusable as the anchor for siege state and
    UI, not currently backed by any mechanic.

**Diplomatic annexation**

16. Root cause confirmed: `cityEngine.tickCity()` only sets `incorporationBillAvailable: true` when
    `status === 'unincorporated' && relationshipScore >= 86`. A `status: 'foreign'` city (e.g.
    Messana, pre-conquest) can never trip this flag, at any relationship — there is no diplomacy-only
    path to Rome for a foreign/independent city today, only conquest (region control-flip) or a
    scripted event flag (`CityDefinition.conquestFlag` + `applyCityFlips`).
17. `buildIncorporationBill()` (`cityEngine.ts`) is otherwise reusable: a real Senate bill
    (`constitutional`, support 15, 4 turns, `fides-5` on failure), pass effect
    `lifetimeDignitas+10|imperium+5|incorporateCity:<id>`.
18. Ambassador relationship-building is already a real system: `resolveAmbassadorAction()`
    (`cityEngine.ts`) — `build_rapport`, `grain_dole`, `corrupt_dealing`, etc., one action/season,
    surfaced in `DiplomatDesk.tsx`. This is the natural home for a new petition action.
19. Two independent code paths already write the same `CityState.owner`/`status` fields
    (`applyCityFlips`'s scripted conquest path, and `campaignResolver.ts`'s region control-flip path)
    — not unified. A third, diplomatic path must not become a third uncoordinated writer; route all
    three through one helper if the spec doc finds them still separate at build time.

**War Funding: Carthage**

20. Not free today: `buildWarFundingBill()` (`warEngine.ts`) already applies a one-time
    `treasury-15` (`BALANCE.war.funding.treasuryCost`) plus a one-time `+6` war-momentum bump on
    pass, re-offered every `recurTurns` (4) seasons while the war is active. It has no
    `ongoingEffect` — the recurring-upkeep pattern (`Bill.ongoingEffect`, applied every season in
    `turnSequencer.ts`, already used by `lex-sempronia-frumentaria` and `lex-clodia-exsilio`) exists
    and was considered, but the user chose the simpler path (§5).

**Map**

21. Confirmed non-interactive beyond simple taps: `MapView.tsx` renders at a fixed size derived from
    screen width and the source PNG's aspect ratio; its container is a plain `View` with
    `overflow: 'hidden'`, no `ScrollView`, no gesture handler, no pan/zoom state anywhere in the
    component tree. This is greenfield UI work, not an extension of existing gesture code. The repo
    has no gesture/zoom library as a dependency today (CLAUDE.md: add no new dependencies without
    calling it out explicitly).

**Ambition system (`tutorial-rebuild`, reusable infrastructure)**

22. `models/ambition.ts`'s `AmbitionCriterionId` already includes `region_control` and `battles_won`
    — the ambition system already anticipates military-flavored goals. `ActiveAmbition` has
    `criterion`, `baseline`, `reward`, `failureDignitas`, `refusable`, `onCompleteEventId`,
    `onFailEventId` — a ready-made shape for framing "annex this city" (or "hold this siege") as a
    trackable player goal, not just a bill.
23. No `city_annexed` (or equivalent) criterion exists yet. Adding one is a small, precedented change
    — `tutorial-rebuild`'s own ticket 03 added a `bill_passed` criterion the same way, and flagged
    "raise it against the ambition plan before implementing" as the right process. §7 recommends the
    same discipline here rather than silently adding a criterion.

---

## 3. Goals

- Fix the movement-order tap ambiguity so players can reliably move armies to a chosen region.
- Make the battle screen's two real numbers (strength, morale) legible — what they are, which one
  determines the outcome.
- Surface the muster system's existing relationship math before the player commits denarii.
- Retire the disconnected legacy War Room manpower system; province revolts and the Carthage war
  read one manpower number per region, not two contradictory ones.
- Give sieges real, numbers-driven weight — a computed pressure score the player can influence via a
  small set of camp decisions, plus occasional commander-facing events — without building a second
  tactical battle system.
- Give foreign/independent cities a genuine diplomacy-only path into the Republic, distinct from and
  harder than conquest, with real risk.
- Make the Provinciae map usable at a glance on small screens via zoom/pan.
- Make the War Funding bill's cost read as a real trade-off.

## 4. Non-goals

- Not building a tactical siege mini-game (deliberately, per the user's steer) — sieges stay
  seasonal/abstract-with-levers, not a new battle screen.
- Not re-opening war standing, terminal outcomes, or the tactical battle engine's core math
  (`warStanding.ts`, `battleEngine.ts`) beyond the legibility fix in §6.2.
- Not building fleets/naval entities, multi-theatre wars, or mercenary muster in foreign regions —
  these remain explicitly out of scope per the shipped campaign-map plan and this PRD doesn't revisit
  that call.
- Not the Second Punic War setting pivot — see the companion exploration doc.
- Not a full audit/rewrite of the Ambition system — only the smallest addition needed for §6.6
  (a new criterion), raised as its own decision, not assumed.

## 5. Design decisions settled with the user (2026-08-03)

| # | Decision |
|---|---|
| 1 | The old War Room/`TroopUnit` system is **in scope** — this PRD includes unifying it onto the `Army`/region manpower model, not just leaving it alone. |
| 2 | Diplomatic annexation is a **new path**, not a threshold-flag fix: a real relationship-gated option with genuine risk/cost, distinct from and harder than the existing post-conquest incorporation route. |
| 3 | The movement tap fix applies **order-mode only** — normal map browsing (opening a `CitySheet` via its pin) is unchanged outside of move-order flow. |
| 4 | Siege mechanic is **numbers + camp decisions + commander events**, not a full playable tactical loop — a richer, player-influenceable replacement for the current flat occupation-counter, still resolving automatically at season boundaries. |
| 5 | War Funding: Carthage gets a **raised one-time cost** (possibly split across resources), not a new recurring-upkeep mechanic. |
| 6 | Packaging: **one PRD**, meant to become one spec doc with dependency-ordered chunks. |
| 7 | Ground everything against `tutorial-rebuild`, factoring in what's already in flight there (Ambition system, per-category world-gate, unchanged `war` tutorial arc). |

---

## 6. Feature areas

### 6.1 Movement tap UX (order-mode)

**Problem:** city pins intercept taps meant for the region beneath them during move-order mode.

**Direction:** while an army is in move-order mode, city pins stop being independent tap targets —
either suppressed entirely (all taps in that mode resolve to `onOrderRegionPress`) or demoted so a
tap always resolves to the region first. Outside order mode, city pins behave exactly as today.

**Touches:** `MapView.tsx` (order-mode tap layering), `tutorialScript.ts`'s `war.find-campania-region`
step (simplify/remove the now-unnecessary "tap the ground, not the city" coaching — coordinate with
whoever owns `tutorial-rebuild`'s war arc, since that arc is explicitly "stays as-is" per that plan).

**Open for spec doc:** exact interaction — fully suppress city pins in order mode, or make them
delegate to the region press handler (same visible destination, different implementation cost)?

---

### 6.2 Battle screen legibility

**Problem:** strength and morale bars are unlabeled; the difference between "losing cohesion" and
"about to break" isn't explained anywhere.

**Direction:** label both bars plainly (e.g. "Strength" / "Morale"); add an `InfoTap` per CLAUDE.md's
glossary convention explaining morale is the break condition and strength is casualties/cohesion —
new glossary entries in `glossaryTerms.ts`. Pure legibility; no engine change.

**Touches:** `BattlefieldView.tsx`, `glossaryTerms.ts`.

---

### 6.3 Muster / manpower legibility

**Problem:** relationship's effect on cost and quality is invisible until after the player commits.

**Direction:** `MusterPanel.tsx` tier cards show the live-computed relationship discount and
quality-bump chance before confirmation — same pattern as the existing Gather Intelligence
odds-preview. Also surface remaining yearly manpower per region more prominently (currently a
footer line).

**Touches:** `MusterPanel.tsx`, `musterEngine.ts` (expose a pure preview function if one doesn't
already cleanly exist — verify before assuming a new export is needed).

---

### 6.4 War Room / legacy `TroopUnit` unification

**Problem:** two disconnected recruiting systems give contradictory answers to "how much manpower
does this region have."

**Direction:** migrate province-revolt campaigns (currently the only consumer of the old War Room UI)
onto the `Army`/region muster model — same manpower pool, same tier/relationship math as the Carthage
war. Revolt *resolution* (how a suppression campaign plays out) is a different fight shape from the
theatre war and can keep its own resolution logic; what unifies is the *recruiting* layer feeding it.
Retire `TroopUnit`'s flat Press/Levy/Elite once nothing depends on it; remove the confirmed-dead
`campaignEngine.resolveCampaignSeason` and `PendingGovernorAssignment` in the same pass (per
CLAUDE.md: name dead code found along the way, don't silently fix or silently ignore it).

**Touches:** `MilitaryTab.tsx` (War Room UI), `campaignEngine.ts`, `musterEngine.ts`,
`models/troop.ts`, `models/army.ts`, likely `gameStore.ts` (a one-shot migration for any in-flight
`TroopUnit` records, per this repo's established "cheap `??`-fallback, don't over-invest" convention
for pre-v1 save migrations).

**Flagged risk:** this is the PRD's highest-uncertainty chunk. It needs its own "verify current
state" pass at spec-writing time — how province revolts currently trigger/resolve, whether any live
save data depends on `TroopUnit` shape, and how deep `MilitaryTab.tsx`'s War Room UI is wired into
revolt-specific screens — before committing to numbers or a chunk breakdown. Recommend this be spec'd
as its own grounded sub-section, not estimated from this PRD alone.

**Dependency note:** §6.5 (sieges) needs a real, unified garrison/manpower number to compute siege
pressure against — sequence this chunk before sieges.

---

### 6.5 Siege mechanic

**Problem:** taking a city is a flat 12-season occupation counter with no player agency, no
narrative texture, and no use of the relationship/manpower data the game already tracks per city.

**Direction:** replace the flat counter with a computed **siege pressure** score, recalculated each
season a region's controlling city is under hostile occupation, using inputs the game already has:
garrison strength (from the unified manpower model in §6.4), the city's relationship with the
besieger, and an accruing supply/attrition term. The player (attacker or, symmetrically, a besieged
Roman city's defender) picks from a small menu of **siege camp decisions** each season — e.g. tighten
the blockade (faster pressure, costs attrition to the besieging army), forage the countryside (cheaper,
damages regional relationship), offer terms (attempts an early surrender roll at a diplomatic cost) —
each a real trade-off, not a strictly-best option. Occasional **commander-facing events** interrupt a
siege in progress: a sally-out engagement (a real battle, using the existing tactical/abstract battle
bridge — not a new battle type), a relief column approaching, a garrison mutiny. Resolution stays
seasonal and automatic outside of triggered events — no new tactical screen.

**Touches:** new siege state (attached to `Army`/`CityState` via the existing `stationedCityId`
anchor), `campaignResolver.ts` (replace the flat control-flip step for besieged regions), new
`data/` content for camp decisions and siege events (per CLAUDE.md's layer separation — decisions/
events are data, the pressure formula and decision effects are engine), `BALANCE.campaign.siege.*`
(new constants; the dead `siegeObjectiveMin/Max` should be reconsidered/removed rather than
resurrected, since it was never wired to anything real).

**Open for spec doc:** exact pressure formula and camp-decision numbers (first-pass/tunable, this
repo's standard convention); whether "offer terms" reuses the existing Ambassador-relationship
diplomatic surface or is siege-specific; how a besieged *Roman* city (Carthage attacking) mirrors this
symmetrically.

---

### 6.6 Diplomatic annexation

**Problem:** a foreign/independent city can reach any relationship with no path to actually joining
Rome unless conquered — a real design gap, not a UI gap.

**Direction:** a new Ambassador action, gated at a relationship bar meaningfully **higher** than the
existing 86 (this is meant to be a genuine alternative to conquest, not an easier version of it) —
"Petition for Union" — available only on `status: 'foreign'` cities. Tables a real Senate bill
(reusing `buildIncorporationBill`'s shape) with a real failure cost, plus a diplomatic-fallout risk on
refusal (relationship hit to the petitioning city, and — since these are cities other foreign powers
watch — a possible ripple to Carthage or nearby foreign relations, reusing the foreign-relations
plan's existing drift/hostility machinery rather than inventing a new one). Route the resulting
`owner`/`status` write through whatever single helper the spec doc settles on for finding 19 (don't
add a third uncoordinated writer).

**Touches:** `cityEngine.ts` (new petition-eligibility check + bill builder, sibling to
`buildIncorporationBill`), `DiplomatDesk.tsx` (new action), `resourceEngine.ts` (effect token if the
diplomatic-fallout consequence needs one), possibly `warEngine.ts`/foreign-relations engine for the
ripple effect.

**Worth raising, not deciding here:** whether this should be framed as a trackable `ActiveAmbition`
(finding 22–23) rather than a bare Ambassador action — the ambition system already has
`region_control`/`battles_won` criteria for military-flavored goals, and a `city_annexed` criterion
would be a small, precedented addition (mirroring `tutorial-rebuild` ticket 03's `bill_passed`
addition). Flag this decision explicitly in the spec doc rather than assuming either shape.

---

### 6.7 War Funding: Carthage — cost

**Problem:** the bill's real cost (one-time 15 denarii) doesn't read as a meaningful trade-off.

**Direction:** per the settled decision, raise the existing one-time `treasuryCost`
(`BALANCE.war.funding.treasuryCost`) — and/or split it across resources (denarii + fides) so passing
it costs something the player visibly feels beyond a small treasury dip. No new `ongoingEffect`/
recurring-upkeep mechanic (that pattern exists and was considered — see finding 20 — but isn't what's
being built).

**Touches:** `data/balance.ts` (`BALANCE.war.funding`), bill description text in `warEngine.ts` if
the cost split changes what the bill says it does.

**Note:** small enough that the spec doc may fold this into whichever chunk lands the War Funding
bill's other content, rather than giving it its own chunk.

---

### 6.8 Provinciae map zoom/pan

**Problem:** fixed-size map is cramped on small devices; no zoom/pan exists.

**Direction:** pinch-to-zoom + pan on `MapView.tsx`. No gesture/zoom dependency exists in the repo
today — per CLAUDE.md, adding one is fine only if it's the explicit subject of the chunk and called
out plainly (not a silent side-effect of unrelated work). `react-native-reanimated` is already a
dependency (used by the battle screen and tutorial overlay) and commonly paired with
`react-native-gesture-handler` for exactly this; verify at spec time whether gesture-handler is
already present transitively or needs adding.

**Touches:** `MapView.tsx`. Fully independent of every other chunk in this PRD — can be sequenced
anywhere, including done in parallel by a different session.

---

## 7. Interaction with `tutorial-rebuild`

- **War arc content** (`tutorialScript.ts`'s `war` arc: Command election → muster in Campania → cross
  the strait → one guided engagement) is explicitly unchanged by `tutorial-rebuild`'s own tickets
  ("this plan does not touch [embassy/war/courts]"). §6.1's movement-tap fix should coordinate with
  whoever next touches that arc — the "tap the ground, not the city" line becomes dead instructional
  text once shipped, and the arc's muster step may want to reference the new relationship preview
  from §6.3.
- **Ambition system** (`ActiveAmbition`, `AmbitionCriterion`) is reusable infrastructure for §6.6, per
  findings 22–23. If the spec doc adopts the ambition framing, it should follow `tutorial-rebuild`
  ticket 03's precedent: raise the new criterion against the ambition plan explicitly, don't add it
  silently.
- **Per-category world-gate** (`WorldGateCategory`, replacing the old all-or-nothing
  `isWorldFrozen` boolean) is precedent for any "curated, not frozen" state a siege-camp UI might
  eventually want during a guided/tutorial context — noted for awareness, not currently needed by
  this PRD's scope (sieges here are always-live gameplay, not a tutorial beat).
- **Senate Response banner** (bribe the commission / capitulate — new in `tutorial-rebuild`,
  `MilitaryTab.tsx`) is adjacent to §6.4's War Room unification: it currently keys off
  `senateResponse.musterProvinceId`, tied to the old province-id shape. Verify at spec time that
  unifying the muster layer doesn't silently break this banner's province-matching.

---

## 8. Proposed sequencing

Dependency-driven:

1. **Movement tap UX** (§6.1) — self-contained, low risk, unblocks removing tutorial workaround text.
2. **Battle screen legibility** (§6.2) — self-contained, low risk.
3. **Muster/manpower legibility** (§6.3) — self-contained, low risk, but informs what §6.4 needs to
   preserve.
4. **War Room / `TroopUnit` unification** (§6.4) — foundational for §6.5; highest uncertainty, needs
   its own grounding pass at spec time.
5. **Siege mechanic** (§6.5) — needs §6.4's unified manpower model.
6. **Diplomatic annexation** (§6.6) — logically follows sieges (framed as the "harder, riskier"
   alternative to conquest, which itself needs sieges to feel real); technically independent, could
   move earlier if desired.
7. **War Funding cost** (§6.7) — trivial, can slot in anywhere, possibly folded into another chunk.
8. **Map zoom/pan** (§6.8) — fully independent, can run in parallel with anything above.

---

## 9. Risks & open questions for the spec-doc phase

1. **§6.4's true scope** is unknown until someone reads the current province-revolt trigger/resolve
   path end-to-end — this PRD deliberately doesn't estimate it.
2. **Save compatibility** for the `TroopUnit` → `Army` migration — likely a cheap `??`-fallback per
   this repo's established convention, but confirm no live save shape assumes `TroopUnit` survives.
3. **Siege pressure formula** — first-pass numbers only exist once §6.4 defines what "garrison
   strength" means under the unified model.
4. **Ambition vs. bare-action framing** for diplomatic annexation (§6.6) — explicit decision point,
   not resolved in this PRD.
5. **Gesture-handler dependency** for map zoom — confirm what's actually available before scoping
   §6.8's effort.
6. **Diplomatic-fallout ripple** for a failed annexation petition — how far should it reach (just the
   petitioned city, or nearby foreign powers too)? Not settled here.

---

## 10. Out of scope / explicitly deferred

- Fleets/naval entities, multi-theatre wars, mercenary muster in foreign regions — unchanged from the
  shipped campaign-map plan's own out-of-scope list.
- A full tactical siege mini-game (explicitly declined by the user in favor of §6.5's lighter shape).
- The Second Punic War setting pivot — see the companion exploration doc.
- Any change to war standing's core formula, terminal outcomes, or the tactical battle engine's
  combat math beyond §6.2's labeling.
