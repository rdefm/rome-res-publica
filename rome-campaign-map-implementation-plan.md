# Rome: Res Publica — Campaign Map Implementation Plan: "The Consul's Map"

## 0. How to use this document

This plan specifies the **strategic military redesign**: elected commands, muster-by-region, armies as movable tokens on a theatre map, enemy and NPC-Roman army AI, turn-end campaign playback, and war outcomes **derived from the map** rather than scripted. It **supersedes the strategic wrapper of `rome-military-implementation-plan.md`** ("The Legate's Line") while keeping its tactical battle layer. Design decisions locked with the user (2026-07) — do not re-litigate:

1. **Commands are won by election, not by bill.** The election engine (candidates, support, canvassing) is reused via a new "extraordinary assembly" context that resolves at the end of the season it is called in.
2. **Entering an enemy-occupied region IS the attack.** Adjacency gives intel and the option; there are never two hostile armies coexisting in one region.
3. **Movement is 1–3 region-steps per season** on a coarse theatre map (Italy end-to-end ≈ 3 regions). Roads, army size, winter, forced march, and sea lanes modify it. **AMENDED (Chunk C1):** the map shipped with **8 regions, not ~14** — the original sketch invented regions (Picenum, Apulia, Bruttium, Panormus) with no city anywhere in the codebase to back them; rather than fabricate content, regions were collapsed to match real data (Sicily/Sardinia/Africa each became one multi-city region instead of several single-"region" cities). "Italy end-to-end ≈ 3 regions" still holds under the 8-region map (Cisalpine Gaul→Etruria→Latium→Campania or →Samnium is 3 hops). See Chunk C1 below for the full region list and reasoning.
4. **Campaign results play back as an animation on the Provinciae tab** at turn end (token movement, battles, control flips). Player battles use the tactical battle screen (Legate's Line, option A); NPC-vs-NPC battles resolve abstractly.
5. **The Phase 3 war script's scheduled beats are retired.** No scripted battle locations or outcomes. The five terminal outcomes, the 241 BC end date, the Epilogue/`AncestorRecord` machinery, and Endless mode all **remain** — the war outcome is now *evaluated* from map state (territory control, army balance, war weariness) at treaty time or in 241 BC.
6. **Imperium is a threshold, never a spend**, for raising troops. Election to a command grants imperium, state troops, and a war chest.
7. Commands are **annual**; prorogation is a re-election with a modifier from the general's battle win/loss record. A lapsed command turns state troops over to the next general; personally-raised troops kept in the field past authority feed the **existing unsanctioned-army Senate response**.

### Baseline assumption

Phases 0–4 and **chunk P5-A** are fully implemented (verify: `docs/content-audit.md` exists; the DebugPanel event browser and auto-season runner work).

**AMENDED (Chunk C1, 2026-07-18):** the plan's original text asserted "The Legate's Line plan is not built (verify: `src/engine/battle/` absent)." That check was run at the start of C1 and **failed** — `src/engine/battle/` exists in full: `battleEngine.ts`, `clashEngine.ts`, `battleAi.ts`, `battleSim.ts`, `musterEngine.ts`. Git history confirms all of M1–M11 are merged on this branch (commits `7cc2cb6`…`eb4976d`), **including M9** ("War Score & Campaign Integration, provisional scheduler" — this plan's §0 disposition table below marks M9 **SUPERSEDED, do not build**) **and M10** (peace negotiation — marked **retargeted by C9**). This is a real mismatch with the plan's stated baseline, not a false alarm.

Decision (agreed with the user before C1's code landed): **do not stop and re-scope the whole plan now.** C1 has zero dependency on the battle layer, so it proceeds unaffected. The reconciliation this baseline mismatch actually requires — M9's provisional scheduler needs removing (not skipping, it's already there) and M10's negotiation screen/treaty terms need retargeting onto derived `warStanding` — is deferred to **C4, C8, and C9 specifically**, the chunks whose own text already anticipated touching this code. Whoever builds those chunks must re-verify `src/engine/battle/`'s exact current contents rather than trusting either this note or the original "not built" assumption — chunks can land in between.

This plan builds on, without re-deriving: four-track `crisis` + `flags`; the agenda engine (generators through #26); Season Ledger; `injectNoticeEvent`; `BALANCE`; telemetry (`seasonStatsHistory`, Pace panel); Phase 3's war model (`models/war.ts`, `warEngine.ts`, five terminal outcomes, Epilogue, `AncestorRecord`, succession, Endless mode); Phase 4's trial pipeline; P5-A's tooling.

### Relationship to "The Legate's Line" (per-chunk disposition)

| M chunk | Status under this plan |
|---|---|
| M1 (battle data model & tables) | **Build as written.** One addition: `BattleUnit.sourceRef` points at this plan's `Army` unit ids. |
| M2 (lane clash math) | **Build as written.** |
| M3 (battle orchestrator) | **Build as written.** |
| M4 (strategic ↔ battle bridge) | **Build amended:** strategic force records are this plan's `Army` objects (C2), not province levy records. `musterArmy` maps an `Army` (already unit-shaped) instead. Character fates, ransom, triumph/trial hooks unchanged. |
| M5 (Battle UI I) | **Build as written.** Entry point becomes C8's engagement flow (debug sandbox entry retained). |
| M6 (Battle UI II, animation) | **Build as written.** |
| M7 (stratagems & battle AI) | **Build as written.** `GeneralProfile` gains the C6 campaign fields — one interface, two layers. |
| M8 (veterancy/loyalty/donatives/elephants) | **Build as written**, with army-scope actions targeting `Army` objects. |
| M9 (War Score & provisional scheduler) | **SUPERSEDED.** Do not build. C9 replaces it with derived war standing. The Cannae rule (no battle swings standing > cap) survives as a C9 constant. |
| M10 (peace negotiation & ratification) | **Build retargeted by C9:** thresholds read derived `warStanding`; treaty terms reference theatre regions. The negotiation screen, Senate ratification bill, pass/fail drama all survive. |
| M11 (sandbox & tuning harness) | **Build as written**, extended by C10's campaign-level harness and targets. |

### Ground rules for the implementing chat

You have direct repository access. **One chunk per chat session.** Workflow per chunk: (1) read this document (§0, §1, §2, the chunk, its dependencies' "Done when", §Cross-Chunk Notes); (2) read the chunk's *Files to read* from the repo plus anything they import that you need — `SITEMAP.md` is the orientation map; never guess at file contents; (3) run the chunk's *Verify* list against real code — on any mismatch with this plan's assumptions, **stop and ask before writing code**; (4) implement — engines pure (no store access), UI logic-free, every tunable number in `BALANCE` (never inline literals), content/data in `src/data/`; (5) `npx tsc --noEmit` + test suite, fix what you broke; (6) commit as one commit whose message lists files touched, deviations (with reasons), and `BALANCE` values added/adjusted.

- **No new spendable resources** (valid: `fides`, `denarii`, `imperium`, `lifetimeDignitas`).
- **Verify, don't assume:** the current `turnSequencer` step list (Phases 0–5A grew it); the effect-token and `EventCondition` vocabularies (post-P5-A guide is authoritative); how the sequencer pauses/resumes for interactive sequences (succession and trials do this — reuse that pattern, do not invent one).
- Event/notice content follows `rome-event-writing-guide.md` (as refreshed by P5-A). Campaign and battle text uses the **dispatch voice** (terse, military — per Legate's Line invariant 7); Philon speaks only in Rome (agenda, ledger).
- Gens-neutrality: no hardcoded family names in any new string (P5-E invariant); interpolate the run's gens.

### Chunk order and dependencies

**C1 → C2 → C3 → C4 → C5 → C6 → C7 → [M1–M8 if not yet built] → C8 → C9 → C10.**

- C1 (map data) gates everything.
- C2 (armies) needs C1. C3 (muster) needs C2. C4 (elections) needs C2 (grants create/assign armies) but not C3.
- C5 (movement) needs C2. C6 (AI) needs C5. C7 (turn-end resolution & playback) needs C5, C6.
- C8 (battle bridge) needs C7 **and** M1–M5 minimum (M6–M8 can land after C8, before C10).
- C9 (war standing, peace, terminal outcomes) needs C7, C8, and M10-retargeted is built inside it.
- C10 (harness, tuning, docs) is last.
- M1–M3 are pure math with no campaign dependency — they may be built any time before C8, including in parallel between C chunks.
- **AMENDED (Chunk C1):** M1–M11 are already fully merged (see the Baseline assumption note above) — this dependency note (originally written for a world where they might not exist yet) now describes work that's *already done* for M1–M8, and work that C4/C8/C9 must actively *modify or remove*, not build from scratch, for M9/M10. Re-read the current `src/engine/battle/*` and `warEngine.ts` before starting any of C4/C8/C9 — do not assume this note is still accurate by the time those chunks are reached.

Each chunk ends with a compiling, playable, testable build.

---

## 1. Design invariants (apply to every chunk)

1. **The map decides.** No scripted battle locations, no scripted battle outcomes, no scheduled set-piece beats. Authored content may *react* to map states (events, notices) but never *dictate* them.
2. **Resolve, then animate.** Turn-end campaign resolution computes everything and emits a structured `CampaignLog`; the Provinciae playback *replays* the log. Same principle as the battle layer (Legate's Line invariant 1).
3. **Deterministic given a seed.** Campaign movement, withdrawal rolls, storms, AI choices — all through the seeded RNG. Same seed + same orders = same season.
4. **One engagement rule.** An army entering a region occupied by a hostile army halts and creates an **engagement**. Attack is always a choice made by the mover *before* moving (the move order into an occupied region is labelled "Attack"). Defenders set a standing stance (give battle / avoid battle) instead.
5. **Pace guard.** All military orders for a season are issuable from one screen in one sitting; the player commands at most `BALANCE.campaign.maxPlayerArmies` (seed 3) armies; combine/divide operates on whole units — no sliders, no partial-strength splitting.
6. **Legibility.** Enemy intents are telegraphed with icons and one-word reasons; movement previews show reachable regions, never modifier stacks. The math lives in engines and the debug sandbox.
7. **Imperium gates, never pays.** Raising personal troops checks an imperium threshold; nothing debits imperium. Election grants add imperium.
8. **Reuse over invention.** Election engine (C4), Senate-response sequence (C3), sequencer pause/resume (C7/C8), notice pattern, ledger, agenda, glossary, triumph and trial hooks (M4) — extend, don't fork.
9. **The old province campaign system survives outside the theatre — v1 scope decision.** Province revolt/suppression/allied-support campaigns for non-theatre provinces keep their existing abstract resolution untouched. Only the Punic War theatre uses the map layer. Unifying them is an explicitly deferred decision; leave a code comment at the seam.
10. **Terminal outcomes are evaluated, not scheduled.** The five Phase 3 outcomes remain the only ways a war ends; C9 owns the evaluation. Epilogue, Hall, and laurels wiring is untouched.

---

## 2. System overview (read once, then trust the chunks)

The **theatre map** is **8 coarse regions** (Italy, the islands, Sicily, Africa) drawn over the existing cities (renamed from "provinces" — see Chunk C1) — each region groups one or more existing cities and inherits relationship/economic signals from them. **Armies** are stacks of whole units (the Legate's Line `BattleUnit` shape plus strategic fields) owned by Rome-the-state, the player's gens, rival Roman commanders, or Carthage; they sit in regions (with a specific city as their flavor/siege address inside a multi-city region — see Chunk C1's movement-model note), and move when ordered.

The player **raises troops** from any region's panel in the Provinciae tab: pay more, get more and better; a good relationship with the region's cities makes men cheaper and better. Raising personal troops requires an **imperium threshold** and, without Senate sanction, feeds the existing Senate-response sequence. The **command** — imperium grant, state troops, war chest — is won in an **extraordinary assembly**: an election with candidates (the player's family members and rival senators), support-gathering, and same-season resolution. Commands are annual; a **prorogation vote** with a win/loss-record modifier extends them.

Orders (move, attack, combine, divide, embark, forced march) are issued during the season; at **End Season** the campaign resolves in initiative order — armies step region by region, engagements halt movement, NPC-vs-NPC battles resolve abstractly, control flips where an invader sits uncontested — and everything is written to a `CampaignLog`. Back on the **Provinciae tab**, the log **plays back** as an animated sequence. If a *player* army is engaged, the sequencer pauses (the succession/trial pattern) and the **tactical battle** (Legate's Line lanes, formations, captains) is fought before the season completes; the player may instead delegate it to the abstract resolver.

**War standing** is *derived* each season from Sicilian control, army balance, battle momentum, and war weariness; its thresholds unlock the retargeted M10 peace negotiation (Senate-ratified treaties), and in 241 BC — or at treaty — the standing maps onto Phase 3's five terminal outcomes.

---

## Chunk C1 — Theatre Map: Data Model & Dataset — BUILT (2026-07-18)

**Goal (unchanged):** Regions, adjacency, sea lanes, terrain, and city links exist as data with a pure query engine. Zero gameplay change; a debug map list renders.

**This chunk's scope grew beyond the original sketch below** — implementation-chat discussion (2026-07) decided the existing "province" system itself needed reframing before a Region layer could sit on top of it cleanly: what the codebase called a `province` (`ProvinceState`/`ProvinceDefinition`, Governor/Ambassador/relationship/asset mechanics — all unchanged in behavior) is now called a **City**, and a new **Region** groups one or more Cities. This was a full rename (types, files, store field, UI, ~40 files touched), not just new files — see "City rename" below before the region-model spec, which is what actually shipped.

### City rename (prerequisite to the Region model)

- `models/province.ts` → `models/city.ts`: `ProvinceState`→`CityState`, `ProvinceDefinition`→`CityDefinition`, `ProvinceMap`→`CityMap`, `ProvinceStatus`→`CityStatus`, `ProvinceOwner`→`CityOwner`, `ProvinceAssetOwned`→`CityAssetOwned`, `ProvinceAssetDefinition`→`CityAssetDefinition`, `ProvincialClientDefinition`→`CityClientDefinition`, `ProvinceEventDefinition`→`CityEventDefinition`. `CampaignState`/`CommanderElectionState`/`GovernorCandidate`/`OfficerVolunteerState`/`PendingGovernorAssignment` (the *old* province-level campaign system, invariant 9) kept their names and their `provinceId: string` fields unchanged — they don't contain "Province" in their own name and invariant 9 explicitly keeps that system alive outside the theatre.
- `data/provinceDefinitions.ts`→`cityDefinitions.ts`, `provinceAssets.ts`→`cityAssets.ts`, `provinceEvents.ts`→`cityEvents.ts`, `provincialClients.ts`→`cityClients.ts`; `engine/provinceEngine.ts`→`cityEngine.ts`.
- `gameStore.ts`: field `provinces`→`cities`; actions `updateProvincePolicy`→`updateCityPolicy`, `purchaseProvinceAsset`→`purchaseCityAsset`, `upgradeProvinceAsset`→`upgradeCityAsset`, `recruitProvincialClient`→`recruitCityClient`, `updateProvinces`→`updateCities`. `loadGame` backfills `cities: savedState.cities ?? savedState.provinces ?? INITIAL_STATE.cities` for pre-rename saves (per the user's later call, no further save-migration effort needed beyond this one line — see below).
- UI: `ProvinceSheet.tsx`→`CitySheet.tsx`, `ProvinceAssetGrid.tsx`→`CityAssetGrid.tsx`, `ProvincialClientCard.tsx`→`CityClientCard.tsx`; every consumer's imports fixed (`MapView`, `MilitaryTab`, `PolicyBoard`, `DiplomatDesk`, `MusterPickerModal`, `ProvinciaeScreen`, `ClientelaPanel`, `NegotiationScreen`, plus the engine layer: `warEngine.ts`, `crisisEngine.ts`, `senateResponseEngine.ts`, `officeActionEngine.ts`, `agendaEngine.ts`, `eventEngine.ts`, `battle/musterEngine.ts`, `resourceEngine.ts` — including its `incorporateProvince` effect token, renamed `incorporateCity`).
- **Scope boundary, deliberate:** the `provinceId`-named foreign-key field/param used across ~30 unrelated files (bills, secrets, trials, the old campaign system, office actions, troop engine) was **not** renamed to `cityId` — it's pure churn across systems this chunk doesn't otherwise touch, for a cosmetic-only change, and directly risks silent breakage since those ids are loose `string`, not type-checked. Only the entity's own type/data/engine/store-field layer was renamed.
- **City display names changed, ids preserved:** Latium's city is now shown as "Rome" (`latinName: 'Roma'`), Etruria's as "Veii", Samnium's as "Beneventum", Campania's as "Capua", Cisalpine Gaul's as "Mediolanum". The underlying `id` fields (`latium`, `etruria`, `samnium`, `campania`, `cisalpine_gaul`) were **not** renamed — they're referenced as plain strings (not through the type system) in `data/provinceAssets.ts`'s asset restrictions, `data/provincialClients.ts`'s client postings, muster fallbacks, and treaty/event content; an id rename would be a silent, `tsc`-invisible breakage risk for a purely cosmetic change. A future chunk that wants the ids to match could do that rename with a repo-wide grep-verified sweep, but it wasn't worth the risk here.

### Region model — what actually shipped (8 regions, not 14)

The original 14-region sketch below invented regions (Picenum, Apulia, Bruttium, Panormus) with **no city anywhere in the codebase** to back them — the real city list (`data/cityDefinitions.ts`) only ever had 15 cities: Italy — `cisalpine_gaul, etruria, latium, samnium, campania`; Sicily — `messana, syracuse, agrigentum, lilybaeum`; Sardinia/Corsica — `alalia, olbia, sulci`; Africa — `carthage, numidia, tripolitania`. Rather than fabricate new content to fill the sketch's gaps, the region list was collapsed to match what's real: Italy's five cities (including Cisalpine Gaul, which the sketch omitted entirely) each keep their own single-city region; Sicily/Sardinia/Africa — where multiple existing cities already sit — each become **one multi-city region**.

**`src/models/theatre.ts`** (as built):

- `RegionId` — string union of the 8 ids below.
- `Controller` = `'rome' | 'carthage' | 'neutral'` — distinct from a City's own `CityOwner`, since a region can contain cities under different owners (Sicilia does, at game start).
- `Region` = `{ id: RegionId; name: string; displayNameLatin: string; terrainId: string; coastal: boolean; cityIds: string[]; baseManpower: number; startingController: Controller }`. `provinceRefs` from the original sketch is `cityIds` now. `terrainId` **must** be one of the four ids Legate's Line's battle engine actually defines (`BALANCE.battle.terrains`: `open_plain`, `rough_hills`, `river_crossing`, `coastal_plain`) — not the sketch's informal "plains/hills/mountains" labels; M1 was already built (see Baseline assumption above), so this was verified directly rather than declared provisionally.
- `Edge` = `{ a: RegionId; b: RegionId; kind: 'land' | 'strait' | 'sea'; laneRisk?: number }` — unchanged from the sketch.
- `TheatreState` = `{ controllers: Record<RegionId, Controller>; contested: Record<RegionId, number> }` — unchanged; `contested` is declared but has no writer yet (C7's job).

**`src/data/theatreMap.ts` — the dataset (8 regions):**

| id | name | terrain | coastal | cityIds | baseManpower | startingController | notes |
|---|---|---|---|---|---|---|---|
| `latium` | Latium | open_plain | yes | `['latium']` | 10 | rome | Rome herself; capital flag |
| `etruria` | Etruria | rough_hills | yes | `['etruria']` | 6 | rome | |
| `samnium` | Samnium | rough_hills | no | `['samnium']` | 8 | rome | high manpower, prickly relationship |
| `campania` | Campania | open_plain | yes | `['campania']` | 8 | rome | prime manpower |
| `cisalpine_gaul` | Cisalpine Gaul | open_plain | no | `['cisalpine_gaul']` | 7 | rome | not in the original sketch at all |
| `sicilia` | Sicily | coastal_plain | yes | `['messana','syracuse','agrigentum','lilybaeum']` | 6 | **neutral** | no single power holds Sicily at game start — Messana/Syracuse/Agrigentum are independent, Lilybaeum is Carthage's; 'neutral' is the honest read, not a placeholder |
| `sardinia` | Sardinia & Corsica | rough_hills | yes | `['alalia','olbia','sulci']` | 4 | carthage | |
| `africa` | Africa | coastal_plain | yes | `['carthage','numidia','tripolitania']` | 5 | carthage | Numidia is a Carthaginian *client* (independent, per `CityDefinition.clientOf`), included here for relationship-averaging only |

**Land edges (5):** latium–etruria, latium–campania, latium–samnium, campania–samnium, etruria–cisalpine_gaul.
**Strait edge (1):** campania–sicilia. The sketch's Bruttium–Messana crossing point doesn't exist as its own region here, so the strait is modelled from Campania — the southernmost Italian region this map has. Costs like land, no storm risk, per the sketch's own invariant for strait crossings.
**Sea edges (6, laneRisk seeds — unchanged philosophy from the sketch, first-pass/unverified, C10 tunes):** latium–sardinia (0.15), etruria–sardinia (0.15), campania–africa (0.25), sicilia–africa (0.20), sicilia–sardinia (0.20), sardinia–africa (0.20).

**Movement-model note for C2/C5 (decided during this chunk, binding on those chunks' design, not yet built):** the **Region stays the atomic unit for army movement, adjacency, control-flip, and engagement** — exactly as invariant 2/4 and this chunk's own spec always intended; nothing about C2–C9's design needs to change on that front. What's new: because Sicilia/Sardinia/Africa now each bundle several cities, an `Army` will additionally carry a `stationedCityId` — the *specific* city within its region it's garrisoned at or besieging, for flavor text, battle interstitials, and siege framing ("besieging Lilybaeum") without requiring city-level movement/combat granularity. Single-city regions default trivially; multi-city regions get a "seat" city as the default landing spot. **This directly affects C9's `sicilyControl` formula** (§ Chunk C9 below, which was written assuming 5 separate Sicilian *regions* each independently controlled) — C9 must read live City-level `owner` within the Sicilia region for its ±10/±12-per-holding scoring, not a single region-level controller value; flagged again at that chunk.

**`src/engine/theatreEngine.ts` (pure, as built):** `getRegion(id)`, `getAdjacent(regionId, kind?)`, `getRegionRelationship(cities, regionId)` (mean of the region's live cities' `relationshipScore`, or `BALANCE.campaign.defaultForeignRelationship` — seed 20 — when the region has no cities or none match; no launch region hits that fallback today), `isFriendly`/`isHostile(theatre, regionId, owner)`, `landPath(a, b)` (BFS over land+strait edges only — Sardinia/Africa are correctly unreachable this way, sea-lane only), `regionOf(cityId)` (reverse lookup). Signature differs slightly from the sketch's `getRegionRelationship(state, regionId)` — takes `cities: CityState[]` directly rather than the whole `GameState`, keeping the engine's only real dependency explicit.

**`gameStore.ts`:** `theatre: TheatreState`, seeded by a new `buildInitialTheatreState()` helper from each `Region.startingController`. Unread by any engine yet — C2+ builds on it.

**`balance.ts`:** `BALANCE.campaign.defaultForeignRelationship` (seed 20) — the only C1-relevant constant; later chunks grow this section, not before.

**`DebugPanel.tsx`:** new "theatre" tab, read-only — lists all 8 regions (controller, live relationship, terrain, manpower, cities, adjacency by edge kind).

### Tests (`__tests__/theatreEngine.test.ts`, 18 tests, all green)

Adjacency symmetric; kind-filter correctness; every region reachable from Latium via the *full* graph (land+strait+sea — landPath alone can't reach Sardinia/Africa, by design); `getRegionRelationship`'s live-average and ref-less fallback; `REGIONS`' `startingController` values (incl. Sicilia's 'neutral'); `isFriendly`/`isHostile`; `landPath`'s Latium→Campania→Sicilia route and Sardinia/Africa's overland unreachability; `regionOf` reverse lookup incl. an unknown-id case.

### Chunk C1 — Done when

`tsc --noEmit` clean and `npx jest` green **against their pre-chunk baseline** (47 pre-existing `tsc` errors, 3 pre-existing test failures — a Jest dynamic-import config gap and a couple of strict-null-check/duplicate-identifier bugs in `gameStore.ts`, all unrelated to this chunk and left as-is per CLAUDE.md's "flag, don't silently fix" rule); a DebugPanel tab lists all 8 regions with controller/relationship/adjacency; nothing about gameplay changed. Not verified: a live app boot/UI smoke test (the rename is compile+test verified but wasn't eyeballed running in a simulator/browser) — recommended before C2 lands more UI on top of it.

---

## Chunk C2 — Armies: Model, Store & Combine/Divide

**Goal:** Armies exist as first-class state: creatable in debug, listed per region in the Provinciae tab, combinable and divisible. No movement yet.

**Files to read:** C1 outputs, `src/state/gameStore.ts`, `src/models/character.ts`, the Provinciae screen and its region/city panel components (verify names via `SITEMAP.md`), `src/data/balance.ts`, Legate's Line M1 spec (for the unit shape contract — M1 is already built, see Baseline assumption; align against the real `BattleUnit` shape, not a provisional one).

**Verify:** how existing levies/troops are represented (game-manual: levy records with upkeep, veterans) — C2 **replaces** that representation for the theatre: write a one-shot migration mapping any existing levy records into `Army` objects (or, if none exist in practice, note it and skip); where military UI currently lives in the Provinciae tab.

**Files to create:** `src/models/army.ts`, `src/engine/armyEngine.ts` (pure), `src/components/provinciae/ArmyCard.tsx`, `__tests__/armyEngine.test.ts`

**Files to modify:** `src/state/gameStore.ts` (`armies: Army[]` + thin actions `combineArmies`, `divideArmy`, `assignCommander`, debug `spawnArmy`), the region panel (armies-in-region section), `balance.ts`

### `src/models/army.ts`

- `ArmyUnit` = the M1 `BattleUnit` shape (`id, unitClass, strength, veterancy, loyalty, elephantSteady, sourceRef?`) **plus** `{ homeRegion: RegionId; raisedBy: 'state' | 'player' | 'npc'; raisedSeason: number }`. One type, both layers — M4's `musterArmy` becomes a projection, not a translation.
- `ArmyOwner` = `'player' | 'rome_state' | 'rome_rival' | 'carthage'`.
- `Army` = `{ id; name (auto: "Legio I Campana" style, from home region of the plurality of units); owner: ArmyOwner; commanderId: string | null (character id, legate id, or enemy-general id); location: RegionId; units: ArmyUnit[]; stance: 'give_battle' | 'avoid_battle'; ordersThisSeason: MovementOrder | null (C5 defines; declare placeholder); fatigued: boolean; unpaidSeasons: number }`

### `src/engine/armyEngine.ts` (pure)

`combine(a, b) → Army` (same location + same owner only; commander = higher-martial of the two, other becomes available captain; name keeps the larger army's); `divide(army, unitIds, newCommanderId?) → [Army, Army]` (whole units only; a divided army with no commander gets `commanderId: null`); `armyStrength(army)` (aggregate effective power score — the abstract resolver and AI both consume this; formula: Σ strength × class weight × veterancy multiplier, weights in `BALANCE.campaign.strengthWeights`); `upkeepFor(army, state)` (declared here, tuned in C3/C10: per-cohort base × territory multiplier × relationship discount — see C3).

**Rules:** an army with `commanderId: null` may garrison and (later) move, but can never be ordered to attack (invariant-5 adjacent: leaderless mobs don't assault). Commanders must be alive, in the army's region (assignment teleports are forbidden — assigning a commander is only offered for characters whose tracked location permits it; **verify** whether characters have locations today; if not, gate assignment to "at Rome ∨ with an army" and note it).

### UI

`ArmyCard` (per army, in its region's panel): name, owner chip, commander portrait + martial, unit rows (class icon, strength bar, veterancy pips, loyalty bar — reuse/anticipate M8's row design), upkeep/season, stance toggle (player armies), Combine / Divide / Assign commander buttons where legal. Divide = a whole-unit picker modal, nothing fancier.

### Tests

Combine/divide conserve units exactly; ownership and location guards enforced; strength score monotonic in strength/veterancy; migration (if any) round-trips troop counts.

### Chunk C2 — Done when

Debug-spawned armies of every owner render in their regions' panels; player armies combine, divide, and re-commander correctly on-device; `tsc`/tests green.

---

## Chunk C3 — Muster: Raising Troops by Region

**Goal:** The player raises troops from any region panel — pay tiers set volume and quality, relationship discounts and improves, imperium gates, and unsanctioned raising feeds the existing Senate response.

**Files to read:** C1–C2 outputs, `src/state/gameStore.ts` (resource actions, the existing levy action and Senate-response sequence — locate both), `src/engine/resourceEngine.ts` (spend pathways), the region panel, `balance.ts`, `rome-event-writing-guide.md` (notice format).

**Verify:** exactly how the existing unsanctioned-levy Senate response triggers and progresses (manual: debate → censure → consular army) — C3 must **feed it**, not rebuild it; how denarii spends are validated; current imperium sources and typical magnitudes (to seed thresholds sanely — report findings).

**Files to create:** `src/engine/musterEngine.ts` — **note:** Legate's Line M4 also names a `musterEngine` (strategic→battle mapping). Merge: this file owns *raising* (this chunk) and, when M4 lands, the battle projection joins it. Say so in a header comment. `src/components/provinciae/MusterPanel.tsx`, `__tests__/musterEngine.test.ts`

**Files to modify:** `gameStore.ts` (`raiseTroops` action), region panel (Muster section), `balance.ts` (`BALANCE.campaign.muster`)

### Spec (all numbers → `BALANCE.campaign.muster`; seeds below, C10 tunes)

**Three tiers per region** (shown as cards with literal numbers, P5-G picker style):

| tier | cost/cohort (seed) | quality | loyalty seed |
|---|---|---|---|
| Emergency levy | 15 den | raw | 30 |
| Standard levy | 25 den | raw, 25% trained | 40 |
| Picked men | 45 den | trained, 25% veteran | 50 |

- **Volume cap:** `region.baseManpower` cohorts/year per region (tracked per region per year in state); the panel shows remaining.
- **Relationship modifiers** (from `getRegionRelationship`): cost × `(1 − relationship × relDiscountFactor)` (seed factor 0.004 → up to −40% at relationship 100); quality bump: relationship ≥ 70 upgrades 25% of the raised cohorts one veterancy step ("the good families send their sons"). Hostile/foreign regions (relationship < 25 or controller ≠ rome): muster unavailable except mercenary flavour — **cut for v1**, show "No levy will answer you here."
- **Imperium threshold** (invariant 7): raising as **player** (not under a command) requires `imperium ≥ musterThresholdBase + perCohortAlreadyRaised × (personal cohorts currently in the field)` (seeds 10 and 2). Under an active command (C4), state muster ignores the threshold and draws cost from the **war chest** first, personal denarii after.
- **Sanction:** muster while holding the theatre command (or while a Senate levy authorisation flag is set — verify if one exists) = sanctioned. Otherwise the raise sets/increments whatever the existing Senate-response sequence keys on. Surface the warning **before** confirmation ("The Senate has authorised no levy. They will notice." — dispatch voice).
- Raised cohorts materialize as a new `Army` (or merge into the player's existing army in that region, player's choice at confirmation) with `raisedBy` set accordingly.
- **Upkeep (finalize the C2 declaration):** per cohort per season `upkeepBase` (seed 2 den) × territory multiplier — Rome-controlled ×1.0, neutral ×1.5, Carthage-controlled ×2.0 — × relationship discount (up to −30% at relationship 100, only in regions with a live `cityIds` match — see C1's `getRegionRelationship`). Charged in the income step (C7 wires). Shortfall: `unpaidSeasons`+1, all units −10 loyalty, 3% strength attrition, notice; an army averaging loyalty < 20 disbands itself at season end (notice, dispatch voice, units lost).

### Tests

Tier math incl. discounts and quality bumps; volume cap enforcement and yearly reset; imperium threshold scales with fielded personal cohorts; sanctioned path skips the Senate trigger, unsanctioned path fires it; upkeep multipliers by territory; disband-at-20 fires.

### Chunk C3 — Done when

On-device: raise from three different regions at different tiers and relationships and see the promised costs/quality; an unsanctioned raise provokes the Senate sequence; upkeep drains at End Season; `tsc`/tests green.

---

## Chunk C4 — The Command: Extraordinary Assembly, Grants, Prorogation

**Goal:** The theatre command is won in a same-season election reusing the election engine; winning grants imperium, state troops, and a war chest; commands expire annually with a prorogation vote modified by battle record; rivals can win.

**Files to read:** the election engine and its Winter resolution step in `turnSequencer.ts` (locate exactly how candidacies, support, canvassing, and resolution work — this chunk's core is a **refactor** of that), `src/data/offices.ts`, `gameStore.ts`, `src/models/character.ts`, clan/rival senator data (`startingClans.ts`, any rival-generation code from Phase 2's leader-successor pattern), `balance.ts`, `models/war.ts` (war phase/status — the command should only be proposable while a war is active or a `warDeclared` state holds; verify what expresses that).

**Verify:** whether election resolution is one function callable outside the Winter step or inlined into it (drives refactor size — if it is a tangle, extract the minimal `resolveElection(context)` and report); how candidate support is accumulated mid-season (canvassing actions? events?) and whether those actions can target a non-Winter election without modification; how NPC candidacies are generated today.

**Files to create:** `src/models/command.ts`, `__tests__/commandElection.test.ts`

**Files to modify:** the election engine (extract/parameterize `resolveElection(electionContext)`), `turnSequencer.ts` (resolve any open extraordinary assembly at End Season — every season, not just Winter; **placed before campaign resolution** so a new general can matter immediately), `gameStore.ts` (`activeCommand: Command | null`, `callCommandVote`, candidacy actions), Curia/Senate screen (the "Propose a command vote" action + assembly panel), `balance.ts` (`BALANCE.campaign.command`), `glossaryTerms.ts` (Proconsul, Prorogation)

### `src/models/command.ts`

`Command` = `{ id; holderId (character id — may be a rival senator); holderOwner: 'player' | 'rome_rival'; grantedSeason; expiresSeason (granted + 4); battlesWon; battlesLost; warChest: number (denarii, state money — spendable only on muster/donatives/upkeep for state armies; never mixes into personal denarii) }`

### Spec

- **Calling the vote:** a Senate action, available while the war is active and no command sits unexpired; costs a small fides stake (seed 5 — proposing commands spends political capital); any eligible family member (age ≥ requirement — mirror consulship eligibility from `offices.ts`) may stand; 1–2 NPC rival candidates generated from high-standing clans (reuse the existing NPC-candidate generation — verify). Support accumulates through the season via the **existing** canvassing/support mechanics pointed at the assembly context.
- **Resolution:** End Season, same season, via the extracted `resolveElection`. Winner becomes `activeCommand.holder`.
- **Grants on winning:** `+commandImperium` (seed 15) imperium to the holder; a state army spawns at `latium` (`commandStateCohorts` seed 6, standard-levy quality, owner `rome_state`, commander = holder); war chest `commandWarChest` seed 300 den. If a **rival** wins: same grants, owner `rome_rival`, and the army joins C6's NPC-Roman AI. Ledger headline + notice either way; agenda #28 while a vote is open.
- **Expiry & prorogation:** in the command's final season, a prorogation assembly is called automatically. The incumbent's support gets `winLossModifier = (battlesWon − battlesLost) × prorogationPerBattle` (seed ±8, clamp ±25); challengers may stand. Re-elected: term +4 seasons, no new grants (the war chest tops up `prorogationTopUp` seed 100). Not re-elected (or nobody stands): command lapses — state-owned troops freeze in place as leaderless `rome_state` garrisons awaiting the next command; the ex-general's **personally raised** units remain his, and if kept fielded without a new command or sanction, the existing unsanctioned-army Senate response applies from the next season (C3's trigger; notice explains it in advance).
- Holding the command confers no office; it coexists with magistracies (historically proconsular). If the holder dies, the command lapses immediately (notice; the succession/trial systems do their normal work).

### Tests

Extracted `resolveElection` still produces identical Winter results (regression on existing election tests/fixtures); same-season assembly resolves with multi-candidate support; grants apply once; rival-win path produces an AI-owned army; prorogation modifier math incl. clamps; lapse converts ownerships correctly and arms the Senate-response condition.

### Chunk C4 — Done when

On-device: call a vote, canvass, win → army + chest + imperium appear; lose to a debug-boosted rival → his army appears; a full year later the prorogation fires with the record modifier visible in the assembly UI; Winter magistrate elections are provably unchanged.

---

## Chunk C5 — Movement: Orders, Rates, Sea Lanes, Forced March

**Goal:** Player armies take movement orders from the map/region UI; reachability previews are honest; embarkation, forced march, and attack-moves exist as orders. Nothing resolves yet (C7 resolves).

**Files to read:** C1–C2 outputs, the Provinciae screen (where the order UI mounts), `balance.ts`, `theme.ts`.

**Verify:** how the Provinciae tab currently presents cities (list? map graphic?) — as of C1, it's a real illustrated map (`MapView.tsx`, a parchment PNG background with city nodes at `nodeX`/`nodeY`), not a list; C1's own map view is a plain data-only DebugPanel tab, no graphic. Decide whether C5's army tokens anchor onto the existing `MapView.tsx` graphic (region-level, so 8 node positions, not 15) or get their own schematic overlay — report which approach and why before building.

**Files to create:** `src/engine/movementEngine.ts` (pure), `src/components/provinciae/TheatreMapView.tsx` (token layer + order mode), `__tests__/movementEngine.test.ts`

**Files to modify:** `gameStore.ts` (`issueMovementOrder`, `clearOrder`), `army.ts` (`MovementOrder` finalized), `balance.ts` (`BALANCE.campaign.movement`)

### `MovementOrder`

`{ path: RegionId[] (validated, starts adjacent to current location); forcedMarch: boolean; intent: 'move' | 'attack' (attack iff final region is enemy-occupied — labelled so in UI) }`

### Movement points (all seeds → `BALANCE.campaign.movement`)

- Base **2 MP**/season. Step costs: land into Rome-controlled 1 · land into neutral/enemy 2 · strait 1 · **sea lane = all remaining MP (min 2)** — one lane per season, must start and end coastal, "embark" implied by the order.
- Modifiers: **Winter −1 MP** (min 1); army > `bigStackCohorts` (seed 8) −1 MP (min 1); **forced march +1 MP** at the cost of 4% strength attrition and `fatigued: true` (first battle next season: all lanes −1 effective atk/def — the battle bridge consumes this; until M-chunks exist it is stored, unused).
- **Sea risk:** rolled at resolution (C7): `laneRisk × winterSeaMultiplier (seed 2.0 in Winter)`; failure = storm: 10% strength loss, army lands back where it embarked, notice. (Interception-by-fleet is folded into laneRisk for v1 — no fleet entities; leave a comment naming this the naval seam.)
- **Reachability preview:** tapping a player army enters order mode; reachable regions highlight with cost; enemy-occupied reachable regions highlight red with "Attack"; illegal targets say why in one word ("winter", "sea", "spent").
- Orders are stored, editable until End Season, one order per army per season. Leaderless armies accept `move` but never `attack` (C2 rule).

### Tests

MP math across every modifier combination; path validation rejects non-adjacent steps and post-sea-lane continuation; attack intent only onto occupied regions; forced-march attrition applied at order-resolution time not order-issue time (assert via C7 stub); preview equals engine reachability exactly (one source of truth: the engine exposes `reachable(army, state)` and the UI renders it).

### Chunk C5 — Done when

On-device: order three armies (one by sea, one forced march, one attack-move) and see honest previews; orders persist across app restart (autosave); nothing moves yet; `tsc`/tests green.

---

## Chunk C6 — Campaign AI: Enemy & NPC-Roman Armies

**Goal:** A pure, seeded, characterful army AI issuing the same `MovementOrder`s players do — Carthaginian armies pursue theatre objectives, NPC-Roman generals (rival command holders) fight the same war with the same brain.

**Files to read:** C1–C5 outputs, `enemyGenerals.ts` if M7 built (else this chunk creates it with campaign fields and M7 later adds the battle fields — one file either way), `balance.ts`.

**Files to create:** `src/engine/campaignAi.ts` (pure), `src/data/enemyGenerals.ts` (or extend), `__tests__/campaignAi.test.ts`

**Files to modify:** `balance.ts` (`BALANCE.campaign.ai`)

### Spec

- `CampaignProfile` (data, per general): `{ aggression 0–1; caution 0–1; objectiveWeights: { hold, advance, raid }; homePort: RegionId }`. The four Legate's Line generals get campaign profiles matching their battle personalities (Hanno cautious-hold, Hamilcar raid-heavy, Bomilcar advance-always, Xanthippus balanced-disciplined). NPC-Roman commanders get a profile derived from character stats: aggression = martial/10 × 0.8, caution = (10 − martial)/10, hold/advance from a personality trait if one exists (**verify**; else default).
- `chooseSeasonOrders(state, army, profile, rng) → MovementOrder | null` with exactly **three behaviors**, scored then chosen (softmax over scores × objectiveWeights, temperature in BALANCE — deterministic under seed):
  - **HOLD:** stay/entrench in the current region if it is an objective (any friendly-controlled Sicilian region under threat = adjacent enemy army stronger than local friendlies) — no order.
  - **ADVANCE:** move toward the weakest reachable enemy-controlled region, weakness = garrison strength + relationship penalty; attack-move if an enemy army holds it and `armyStrength` ratio ≥ `attackRatioThreshold` (seed 1.2, scaled down by aggression).
  - **RAID:** (aggression-weighted) move into an undefended enemy region, flagging `raiding: true` — a raid does not seek control; C7 applies an economy/relationship sting to the region and the AI withdraws homeward next season.
- **Carthaginian strategic controller:** one function assigning behaviors across all Carthage armies each season with two hard rules: never voluntarily abandon **Lilybaeum** (a city inside the `sicilia` region now, not its own region — see Chunk C1; the army stationed there via `stationedCityId` is the one this rule pins); keep ≥ 1 army in the `sicilia` region while Carthage controls any city inside it. Reinforcements: Carthage musters `reinforcementCohorts` (seed 3) at the **`africa`** region (renamed from the sketch's `carthago`) every `reinforcementInterval` (seed 3 seasons), scaled by war standing when C9 lands (losing Carthage tries harder — note the hook).
- **Telegraphing (invariant 6):** each AI army carries a visible **intent icon** for next season ("entrenched" / "advancing" / "raiding"), truthful with probability `1 − deceptionChance` (per-profile; Hamilcar seed 0.35, others 0.1). Set at the end of C7's resolution for the following season.
- NPC-Roman armies use the same three behaviors with objectives inverted (defend Roman Sicily, advance on Carthaginian regions). **They fight NPC battles via C8's abstract resolver; their wins/losses accrue to their command's record** — a rival general really can win or lose your war.

### Tests

Determinism under seed; profiles measurably differ (Bomilcar's attack-order rate > 2× Hanno's over 200 seeded seasons); the two Carthaginian hard rules never violated across a 40-season seeded sim; intent icon honesty matches the configured rate; NPC-Roman AI never orders an attack with a leaderless army.

### Chunk C6 — Done when

A headless 20-season sim (debug action: "Simulate campaign, no player") shows both sides maneuvering plausibly per a printed order log; intents display on enemy army cards; `tsc`/tests green.

---

## Chunk C7 — Turn-End Resolution & the Provinciae Playback

**Goal:** End Season resolves the campaign deterministically into a `CampaignLog`; the Provinciae tab plays it back as an animated sequence; player engagements pause the sequencer for C8. This is the chunk where the map starts *living*.

**Files to read:** `turnSequencer.ts` (full current step list — verify where war/crisis/income steps sit and exactly how succession/trials pause and resume the sequencer), C1–C6 outputs, the Provinciae screen + C5's `TheatreMapView`, `models/ledger.ts`, the agenda engine catalog, `App.tsx` (navigation/modal ordering).

**Verify:** the pause/resume mechanism's exact shape (this chunk and C8 depend on reusing it); where upkeep/income applies so C3's upkeep charge slots correctly; that P5-A's auto-season runner can drive through the new step (extend its auto-answer pathway to auto-resolve engagements via the abstract resolver — required, or the runner breaks; do it in this chunk).

**Files to create:** `src/engine/campaignResolver.ts` (pure: state + all orders + seed → new state + `CampaignLog` + `Engagement[]`), `src/components/provinciae/CampaignPlayback.tsx`, `__tests__/campaignResolver.test.ts`

**Files to modify:** `turnSequencer.ts` (**one** new step: campaign resolution — after bills/elections resolve, before income, so a season's muster/upkeep reflects new positions), `gameStore.ts` (`campaignLog: CampaignLog | null`, `pendingEngagements`), `TheatreMapView` (playback mode), the Provinciae tab badge, `models/ledger.ts` (campaign headline lines), agenda catalog (#27 pending engagement — `critical`; #28 assembly open — C4 registered it, confirm; #29 army unpaid), `balance.ts`

### Resolution order (fixed, documented in code)

1. **Initiative:** all armies with orders sort by commander martial desc (leaderless last, ties by seeded roll). Player armies get +2 initiative — legible, and it makes player plans reliable.
2. Each army executes its path **one region-step at a time** in initiative rotation (round-robin by steps, so a fast army can't teleport past an interception). Stepping into a region holding a hostile army: movement halts; if the mover's intent was `attack` → an **Engagement** is created; if `move` → the mover halts in the previous region (bounced, log entry "found the enemy in strength").
3. **Sea rolls** at the embark step (storm = bounce + attrition per C5).
4. **Engagements resolve:** defender stance `avoid_battle` → withdrawal roll `withdrawBase (30) + 3 × defender commander martial + avoidCavBonus (10 if defender cavalry share > attacker's)`, success = retreat one region toward friendly control (deterministic priority: strongest-friendly-adjacent, then lowest region id) with 2% attrition; failure or `give_battle` → **battle**. NPC-vs-NPC battles resolve inline via the abstract resolver (C8 builds it; **this chunk stubs it** with a pure strength-ratio + seeded-variance placeholder clearly marked for C8 replacement). Battles involving a **player-commanded army** are appended to `pendingEngagements` and resolution *of that engagement* defers.
5. **Post-battle:** loser retreats one region (same priority rule); no friendly-adjacent region → **shattered** (army removed; commander fate rolls per M4 when built, until then: captured 25% / escaped otherwise, log entry). Winner may occupy the vacated region if its order pointed there.
6. **Control flips:** a region whose occupier is hostile to its controller, uncontested for a **2nd consecutive season** (`contested` counter), flips controller (abstracted siege). Raids instead apply the raid sting (region relationship −10, a small denarii loss if the region's `cityIds` resolve to live cities) and mark the raider homeward-bound.
7. **Upkeep** charges (C3), unpaid consequences, loyalty decay/donative interactions (M8 when built).
8. Set next-season AI intents (C6). Emit ledger headlines (≤ 2: the most important battle/flip, dispatch voice) and the `CampaignLog`.

**Sequencer pause:** if `pendingEngagements` is non-empty after step 8, the sequencer pauses via the existing pattern; the app navigates to the Provinciae tab, plays the log **up to the engagement**, then hands off to C8's battle flow. After all engagements resolve, the resolver runs a short continuation (retreats/flips consequent on those outcomes), the log finishes, and the sequencer resumes. End Season is never complete with an unresolved player battle.

### Playback (`CampaignPlayback`)

Replays the log on the map view: token slides ~0.6s/step (staggered, not simultaneous), clash marker pulse + one-line result on battles, banner on control flips, storm icon on sea mishaps. **Tap-to-skip to final state instantly** (non-negotiable). When nothing moved, no playback and no badge — the map simply reflects state. When something happened but no player battle: a badge on the Provinciae tab + a ledger headline pull the player in; do **not** hijack navigation (the hard force is reserved for pending player battles, where the sequencer pause already owns navigation).

### Tests

Determinism (same seed + orders = identical log and state); initiative and round-robin stepping (a slow big stack cannot outrun a fast small one); bounce vs attack vs withdrawal branches; retreat priority and shatter; two-season flip counter resets when contested; raids sting and go home; upkeep charged post-movement; auto-season runner completes 20 seasons with campaign active (engagements auto-resolved abstractly).

### Chunk C7 — Done when

On-device: order armies, End Season, watch the playback (and skip it), see enemy armies move with intents updating; a debug-forced NPC battle resolves and shows in the log; a player attack order pauses the season with agenda #27 showing; the auto-season runner still runs clean.

---

## Chunk C8 — The Battle Bridge (requires M1–M5 minimum)

**Goal:** Player engagements flow into the tactical battle screen and back; NPC battles get their real abstract resolver; the player may delegate any battle. **Before starting: verify M1–M8 (in fact all of M1–M11) are built** (grep `src/engine/battle/battleEngine.ts`) — confirmed already merged as of Chunk C1 (see Baseline assumption at the top of this doc), but re-verify with a fresh read rather than trusting that note, since other chunks may land in between.

**Files to read:** M1–M5 outputs (esp. `battleEngine.ts` API, `musterEngine.ts`, `BattleScreen` entry), C7's engagement flow, `models/army.ts`, `gameStore.ts`.

**Verify:** M4's write-back pathway (character fates, triumph/trial hooks) against the `Army`-based records — the §0 amendment says strategic records are `Army` objects; confirm M4 was built that way or adapt here (report which).

**Files to create:** `src/engine/battle/abstractResolver.ts` (pure), `__tests__/abstractResolver.test.ts`

**Files to modify:** `gameStore.ts` (engagement → battle session wiring), `campaignResolver.ts` (swap the C7 stub for the real resolver; consume battle outcomes into retreat/shatter/flip logic), `BattleScreen` entry (launched from the engagement flow with real armies, terrain from the region, enemy general from the army's commander), `balance.ts`

### Spec

- **Player battle flow:** playback reaches the engagement → interstitial card (site name = region, armies, generals, terrain, advantage pips from M5's helper) with two buttons: **"Take the field"** (full tactical battle: M5/M6 screens; the player's `fatigued` flag applies its penalty; outcome writes back via M4 — casualties onto `ArmyUnit`s, veterancy counters, captain fates, triumph/trial hooks) and **"Trust the legate"** (abstract resolver, one-tap, honest EV — mirrors Phase 4's fast-resolve philosophy; requires an assigned commander).
- **`abstractResolver(armyA, armyB, ctx { terrain, generalMartialA/B, fatigueA/B, seed }) → { winner, tier (crushing/clear/narrow), casualtiesPctA/B, commanderFateRolls }`:** power = `armyStrength` × terrain fit (class-weighted, reuse M1 terrain tables) × `(1 + martial × martialFactor)` × fatigue penalty; winner probability from the power ratio through a logistic curve (`BALANCE.campaign.abstract`); casualties by tier (seeds: crushing 25/8, clear 15/10, narrow 12/12). Feeds C4's win/loss record for whichever command owns a Roman side. **Calibration test:** across 500 seeded runs per canonical matchup, abstract win rates within ±10% of M11's tactical harness rates for the same armies — the delegate button must not be a secretly better (or worse) general than the player.
- Battle outcomes return to `campaignResolver`'s continuation: loser retreat/shatter, occupation, flip counters — one pathway for tactical and abstract results (`BattleOutcome`-shaped both ways).

### Tests

Round-trip conservation (units in = units out minus casualties) for both pathways; fatigue applied in both; calibration test above; a paterfamilias commanding a shattered army goes through capture/succession pathways without corruption (the M4 must-playtest, re-run here at campaign level); delegate button absent on leaderless armies.

### Chunk C8 — Done when

A real campaign attack order leads through the interstitial into a full tactical battle whose outcome moves the map (retreat, flip next season), and the same engagement delegated resolves in one tap with comparable expected results; `tsc`/tests green.

---

## Chunk C9 — War Standing, Peace & Terminal Outcomes

**Goal:** War standing derived from the map each season; M10's negotiation retargeted onto it; the five Phase 3 terminal outcomes evaluated from standing at treaty or in 241 BC; the Phase 3 war script's scheduled beats retired cleanly.

**Files to read:** `models/war.ts` + `warEngine.ts` (everything the Phase 3 arc does today: scheduled beats, phase transitions, the five outcome ids and how the Epilogue consumes them — **enumerate the five ids and their triggers in your changelog**), `EpilogueScreen`/`epilogueEngine`, P3-F's Endless entry, **M10 is already built** (see Baseline assumption at the top of this doc — confirm its current shape with a fresh read, don't assume it still matches this spec by the time C9 is reached), `balance.ts`, achievement definitions if P5-F is built (`victoria-punica` etc. must keep firing).

**Verify:** every consumer of `warScore` or scripted war beats (grep) — each must be redirected to `warStanding` or retired with a note; how Endless mode's war retirement interacts with the campaign step (entering Endless must also stand down armies and the campaign step — spec below). **AMENDED (Chunk C1):** also verify `data/treatyTerms.ts` directly before assuming "retarget onto region-based terms" (below) is real work — the Mediterranean-provinces plan's MP-F already reworked `TREATY_TERMS` to be one atomic cession term **per city** (Messana/Syracuse/Agrigentum/Lilybaeum/Alalia/Olbia/Sulci/Tripolitania/Carthage, each its own term), not per region. That may already be the *finer-grained, more correct* shape for a Sicily that's one region with four independently-ownable cities (see this chunk's `sicilyControl` amendment below) — retargeting to coarser region-level terms could be a step backward. Report what's actually there before rewriting it.

**Files to create:** `src/engine/warStanding.ts` (pure), `__tests__/warStanding.test.ts`

**Files to modify:** `warEngine.ts` (strip scheduled set-piece/beat generation; keep war status, weariness if present, and epilogue wiring), `campaignResolver.ts` (compute standing at step 8), M10's negotiation screen + treaty terms (**verify against the real per-city `TREATY_TERMS` first — see above** — likely needs threshold/standing wiring, not a term-shape rewrite), `turnSequencer.ts` (241 BC evaluation — likely already a terminal check; redirect it), `balance.ts` (`BALANCE.campaign.standing`), `glossaryTerms.ts`

### `warStanding` (recomputed each season, −100…+100, Rome-positive)

`standing = sicilyControl + armyBalance + momentum − wearinessGap`, where (seeds → BALANCE):

- **sicilyControl — AMENDED (Chunk C1):** the sketch assumed 5 independent Sicilian *regions*, each with its own `Controller`. C1 shipped Sicily as **one region** (`sicilia`) containing 4 cities (Messana, Syracuse, Agrigentum, Lilybaeum) — see Chunk C1's movement-model note. `sicilyControl` must therefore read live **`CityState.owner`** for each of `sicilia`'s `cityIds`, not the region's own single coarse `Controller` (that field stays atomic for movement/adjacency/control-flip, per invariant 2/4 — unaffected). Formula: Σ over those 4 cities of ±10 per city (`owner === 'rome'` → +10, `'carthage'` → −10, `'independent'`/uncommitted → 0; Syracuse counts while allied/rome, matching the sketch's original intent), with Lilybaeum weighted ±12 in place of ±10 (the war's lock, unchanged from the sketch). This is a genuine formula change the sketch's authors didn't anticipate, not just a rename — build and test it against the real `sicilia` region before assuming the old ±10-per-region shape still applies anywhere else in C9.
- **armyBalance:** `clamp(12 × log2(totalRomanStrength / totalCarthageStrength), −20, +20)` (theatre armies only).
- **momentum:** decaying sum of battle results (crushing ±8, clear ±5, narrow ±2, decay ×0.6/season) — **capped at ±25 total** (the Cannae rule survives here).
- **wearinessGap:** both sides accrue weariness yearly (Rome's rises faster while upkeep shortfalls or unrest-track elevation persist — one small coupling to the crisis system, read-only); the gap nudges standing toward the fresher side, ±10 max.

**Thresholds** (M10 retarget): ≥ +40 sue for peace · ≥ +70 forced negotiation · ≥ +90 dictate terms; mirrored negative for Carthage. Treaty terms cede **cities** (the real `TREATY_TERMS`' actual grain — see the amendment above; a region's own `Controller` can be derived/updated from its cities' live owners after ratification if C7's control-flip logic needs it, rather than the treaty flipping a region value directly), and the Senate ratification drama is exactly M10's. Carthage's AI willingness derives from standing + its own weariness.

**Terminal evaluation** (the only way wars end):

- **Ratified treaty:** outcome = the Phase 3 outcome whose conditions the terms satisfy (map the five ids found in Verify onto standing bands / term contents — e.g. dictate-tier Roman treaty or all-Sicily control → Victory; mid-band mutual peace → Peace of Exhaustion; Carthage-dictated → Rome Humbled; keep whatever darker ids exist wired to Rome-collapse states, which this plan does not touch).
- **241 BC with no treaty:** evaluate standing bands directly to the same outcomes (bands in BALANCE, chosen so an idle Rome drifts negative — C10 proves it).
- Epilogue, `AncestorRecord`, laurels: **untouched consumers** — they receive the same outcome ids as before. Assert via existing epilogue tests.
- **Endless entry** (Victory only, unchanged): additionally disbands theatre armies (state ones stand down honorably; personal ones offer retain-vs-disband per M8), zeroes the campaign step (no-op while `endlessMode`), and freezes controllers as-won.

### Tests

Standing math each term incl. caps and decay; threshold gating both directions; each of the five outcome ids reachable (debug-forced map states) via both treaty and 241-expiry paths; epilogue regression green; Endless entry stands the theatre down; no surviving reference to scripted beats (grep-assert).

### Chunk C9 — Done when

A debug war can be won by conquering Sicily, settled at every threshold from both sides through the Senate, and lost by idling to 241 — each producing the correct existing epilogue; the war script's scheduler is verifiably gone; `tsc`/tests green.

---

## Chunk C10 — Campaign Harness, Tuning Pass & Documentation (last)

**Goal:** The campaign layer proven at the whole-war level, tuned against explicit targets, `BALANCE`-only; docs current.

**Files to read:** `DebugPanel.tsx` (P5-A tools + M11 harness if built), all C outputs, `balance.ts`, `game-manual.md`, `SITEMAP.md`.

**Files to modify:** `DebugPanel.tsx` (campaign harness action), `balance.ts` (numbers only), `game-manual.md`, `SITEMAP.md`, a `## Tuning log` appendix appended to **this plan file**. Structural findings (a system, not a number, is wrong) are written up and **stopped on** — the user decides.

### Harness

`simulateWar(seed, romanPolicy: 'idle' | 'ai', n)` — headless full wars: `idle` = no Roman player/AI initiative beyond garrisons (the P5-A auto-season baseline); `ai` = a Roman side driven by C6's NPC-Roman brain with a competent general. Dumps: outcome distribution, war length, battle count/frequency, army sizes over time, standing trajectory.

### Targets (record evidence in the tuning log)

1. **Idle Rome loses:** `idle` policy ends in a negative outcome by 241 in ≥ 70% of seeds — the war demands engagement.
2. **Competent Rome can win:** `ai` policy reaches Victory or a positive treaty in ≥ 40% of seeds, median war length 8–16 years (the historical 23 is the ceiling, not the norm).
3. **Battle cadence:** during hot war, an engaged player sees a battle every 2–4 seasons (harness proxy: AI-vs-AI battle frequency in that band).
4. **Orders time:** hand-played, issuing all military orders in a 3-army mid-war season takes ≤ 60s (Pace panel over ≥ 6 seasons); total minutes/season stays inside the Phase 5 watch-number (3–6) with the campaign active.
5. **Economy:** a 10-cohort army in Carthage-controlled territory costs enough that sustained African campaigns strain a healthy treasury (upkeep 25–40% of typical mid-game season income — tune the multipliers).
6. **Abstract/tactical parity:** C8's calibration test still passes after all tuning.
7. **Muster spread:** picked-men armies from high-relationship regions measurably outperform emergency levies of equal denarii spend in the harness (quality must be worth buying).
8. If M11 was deferred, run it now; add its targets to this log rather than re-deriving.

### Documentation

`game-manual.md`: replace the Campaigns/Raising Troops sections with the theatre system (map & regions, muster tiers, commands & prorogation, movement & the season playback, engagements & battle choices, war standing & peace, what happened to the old campaign types — invariant 9's scope note verbatim). `SITEMAP.md`: new engine/data/component trees. Glossary: confirm Proconsul, Prorogation, War Standing, Levy tiers entries exist (≤ 2 sentences, P1-F rules).

### Chunk C10 — Done when

Every target row has recorded evidence with final `BALANCE` values and a 10-line narrative of what moved and why; manual and sitemap current; `tsc`/tests green; no engine/store logic changed in this chunk.

---

## Cross-Chunk Notes

- **`gameStore.ts`** is touched additively in chunk order: C1 (`theatre`), C2 (`armies` + actions), C3 (`raiseTroops`), C4 (`activeCommand`, assembly actions), C5 (order actions), C7 (`campaignLog`, `pendingEngagements`), C8 (battle session wiring). Keep actions thin wrappers over pure engines.
- **`turnSequencer.ts`** gains **two** steps total: extraordinary-assembly resolution (C4, before campaign) and campaign resolution (C7). C9 redirects the existing 241/terminal check; it adds no step.
- **Agenda generators:** #27 pending engagement (`critical`), #28 assembly open / command expiring, #29 army unpaid. Update the catalog comment ("Campaign map plan: #27–29"). Nothing else.
- **Pause/resume:** C7/C8 must reuse the succession/trial pause mechanism, not invent one. If it proves single-purpose, extract it minimally and note the refactor.
- **The auto-season runner** (P5-A) must survive every chunk — it auto-resolves engagements abstractly from C7 on. It is also C10's harness substrate. Breaking it blocks the chunk.
- **Naming collision:** `musterEngine.ts` serves both raising (C3) and battle projection (M4) — one file, header comment explains.
- **Voice:** campaign notices, interstitials, and playback strings are dispatch voice; Philon only in agenda/ledger framing back in Rome. Gens-neutral everywhere.
- **Old saves:** default-spread — `theatre` initializes from `theatreMap` starting controllers; `armies: []` (or migrated per C2's Verify); `activeCommand: null`; missing flags falsy. C9's outcome evaluation must handle a save that predates the campaign (no armies, script gone): the 241 evaluation's idle path covers it — assert once. **AMENDED (Chunk C1):** per the user's explicit call after C1 shipped, don't over-invest in save-migration robustness for pre-v1 saves generally — the `cities`/`provinces` rename got one cheap `??`-fallback line and nothing more elaborate. Treat this note's "assert once" as the right level of effort for future chunks too, not a mandate to build a full migration harness.
- **Explicitly out of scope for v1:** fleets as entities and naval battles (laneRisk is the seam) · playable sieges (the 2-season flip abstracts them) · mercenary muster in foreign regions · multi-theatre wars · unifying the old province campaign system (invariant 9) · the Second Punic War.
- **Interaction with Phase 5 in flight:** P5-C's civic war-track events remain valid (they never touch battle/campaign state). P5-H, when it runs, should incorporate C10's targets rather than re-deriving. P5-F's war-outcome laurels fire unchanged (C9 preserves outcome ids).

## Campaign map — Done when (integration criteria)

1. From a fresh war: the player wins a command in an extraordinary assembly, raises troops in two regions at chosen quality, marches and ships them to Sicily, and fights a tactical battle generated purely by army positions — no scripted beats anywhere.
2. A rival can win the command and visibly fight (and possibly lose) the war with the same AI that drives Carthage; prorogation votes swing on battle records.
3. Every season's campaign activity is watchable as a skippable playback on the Provinciae tab; a season with a pending player battle cannot complete without resolving it.
4. The war ends only via C9's evaluation — all five Phase 3 outcomes reachable, epilogue/Hall/laurels untouched and green.
5. All campaign engines are pure, seeded, exercisable headless; C10's targets are demonstrated in the tuning log.
