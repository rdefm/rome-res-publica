# Rome: Res Publica — July Fixes Plan

## How to use this document

This plan addresses the six items in `July-fixes.txt`, grounded against the actual current code (not the original bug report's assumptions — several items turned out to have a different root cause than they read on the surface). It's written in the style of the other implementation plans in this repo (see `cursus-visual-redesign-plan.md`) and is meant to be handed to an implementation chat one chunk at a time, together with the source files that chunk names.

**Scope decisions made with the user before writing this plan** (see the conversation that produced it):
- Item 1 (scandal frequency): tune down **both** new-secret generation and how often NPCs act on secrets they already hold.
- Item 2 (praetor has no options): the underlying bug affects four offices, not just Praetor — fix all four.
- Items 3 (war score drift) + 6 (war score visibility) are **merged into one chunk**: war score is not actually hardcoded, it's just invisible. Build the legibility UI first; only revisit the underlying balance numbers in a follow-up if it still feels wrong once players can actually see it.
- Item 5 (ambassador unlocks): fix the mechanical bug **and** author the missing City Client content in this pass, not just the code fix.
- Item 4 (region/Latium asset parity): stays inside this document as one (large) chunk, rather than spinning out its own plan file, per explicit instruction.

**Chunk order:** A → B → C → D → E. A and B are small, mechanical, and independent — do them first. C is a self-contained UI feature. D is medium-sized and content-authoring-heavy. E (asset parity) is the largest and most design-heavy, and is last on purpose — it's the one chunk worth re-confirming scope on again once A–D have shipped and the team has a feel for how much appetite remains.

**Ground rules for the implementing chat:**
- Engines stay pure (`src/engine/`), no React/UI imports. Static content stays in `src/data/`, no logic. UI reads store state and calls store actions only.
- Any change to `GameState` shape needs a matching Zod schema update in `src/state/saveLoad.ts` — Chunk E is the only chunk here that plausibly needs one (a new/extended asset shape); confirm before writing it.
- Run `npx tsc --noEmit` after any multi-file change and `npx jest` for any touched engine's test file before calling a chunk done.
- Player-facing new terms get a `glossaryTerms.ts` entry + `InfoTap` wiring.
- Numbers proposed in Chunks A and E are **first-pass, unverified** — same convention `balance.ts` already uses throughout (see its own `FIRST-PASS/UNVERIFIED` comments). Land them, then tune from actual playtesting, don't treat them as final.

---

## Chunk A — Scandal / Secret Frequency Tuning

**Goal:** Reduce how often the player is hit with secret-related events, on both axes: new secrets appearing against the family, and existing secrets being played (leverage/extort/burn demands).

**Files to modify:** `src/data/balance.ts` only (the `secrets` block, ~line 826). No engine or UI changes — every consumer already reads these constants.

### What's actually driving the current frequency

- **New secrets** (`npcGatherTick`, `secretEngine.ts:265`): every clan leader below `hostileStandingMax` (currently 30 relationship) rolls **every season**, at a chance of `npcGatherBase + npcGatherPerCorruption × (highest corruption in your family)`, capped at `npcGatherCap`. Current values: base `0.03`, per-corruption `0.0015`, cap `0.15`. With a typically-sized clan roster (13 leaders across 4 clans, most starting well under the hostility line), that's a lot of independent rolls per season.
- **Compromising-choice payoff** (`latentSecretDiscoveryTick`): every outstanding player-chosen risk has a flat `latentDiscoveryChance` (currently `0.12`) per season of being discovered and converted into a real, demandable secret.
- **Demands** (`scanNpcSecretDecisions`/`npcSecretDecision`, `secretEngine.ts:659`): every leader holding an unfrozen (`isDeterred` returns false), cooldown-elapsed secret **always** acts — there's no additional probability roll once cooldown clears, only `npcAi.npcUseCooldownSeasons` (currently `4`) gates cadence. With several leaders independently accumulating secrets, the demand cadence compounds even though each individual leader is "only" acting once every 4 seasons.

### Proposed changes

| Constant | Current | Proposed | Effect |
|---|---|---|---|
| `secrets.npcGatherBase` | 0.03 | 0.018 | ~40% fewer fresh secrets from a clean-ish family |
| `secrets.npcGatherCap` | 0.15 | 0.10 | Lowers the ceiling for a heavily-corrupt family too |
| `secrets.latentDiscoveryChance` | 0.12 | 0.08 | Compromising choices stay a real risk, just less likely to bite immediately |
| `secrets.npcAi.npcUseCooldownSeasons` | 4 | 6 | Leaders wait longer between plays of a held secret |

Leave `npcGatherPerCorruption`, `hostileStandingMax`, and `maxHeldAgainstFamily` untouched — corruption should still meaningfully drive risk (that's the intended fuel/consequence loop), and the existing per-leader cap of 3 held secrets against the family already bounds worst-case pileup.

### Done when

`balance.ts`'s `secrets` block reflects the table above, with a short comment on each changed line noting it's a July-2026 frequency-down-tune (matching the file's existing per-constant comment convention). `npx jest __tests__/secretEngine.test.ts` still passes unmodified (these are pure constant changes — no test should assert the *old* literal values; if any do, that test was over-fitted to a tuning constant and should assert behavior/shape instead).

---

## Chunk B — Office Action Visibility Fix

**Goal:** Praetor (and three siblings with the identical bug) shows its in-office actions when the player holds it.

**Files to modify:** `src/data/offices.ts` only.

### Root cause

`CursusScreen.tsx:281` gates the entire in-office-actions UI block on `office.active`:

```tsx
{isCurrent && isPlayer && office.active && office.inOfficeActions && (
  ...renders office.inOfficeActions...
)}
{isCurrent && isPlayer && !office.active && (
  <Text style={rung.comingSoon}>{office.inOfficeDesc}</Text>
)}
```

Four offices are marked `active: false` in `offices.ts`: **Vigintivirate** (line 18), **Praetor** (line 337), **Censor** (line 599), **Dictator** (line 719). All four nonetheless have fully-written `inOfficeActions` arrays — Praetor alone has six real actions (Issue an Edict, Preside Over a Trial, Recommend a Governorship, Allocate Judicial Resources, Prorogatio, Blacklist Rival from Courts), Censor has six, Vigintivirate three. None of these actions are stubs or TODOs — they have real `successEffect`/`consequences` payloads. `active: false` reads like a leftover "not yet implemented" flag from before these actions were written, never flipped back on. Quaestor, Aedile, Consul, and Tribune are all `active: true` and work correctly today.

### Fix

Flip `active: true` for all four offices (Vigintivirate, Praetor, Censor, Dictator). This is a one-line change per office, four lines total. No `inOfficeDesc` field needs removing — it stays as unused-but-harmless flavor text (or can be folded into `desc`, implementer's call, not required).

### Verify before calling this done

- Play (or debug-panel-simulate) up to holding each of the four offices and confirm their action lists render and each action resolves without a runtime error — a couple of these actions (`prorogatio`, `blacklist-from-courts`, `nota-censoria`, `lectio-senatus`) have `gate`/`gateAny` skill requirements and `PLAYER_CHOSEN_LEADER_CLAN`/`TARGET_LEADER_CLAN` target-selection tokens; confirm the existing action-resolution UI already handles target selection for these (it should, since Quaestor's `audit-rival` and other `active:true` offices use the same tokens) rather than assuming it does.
- If any of the four turns out to be genuinely unfinished on closer inspection (missing target-picker wiring, a dangling TODO), flag it back rather than silently shipping a broken button — but the code read here shows no such gap for any of the four.

### Done when

All four offices render their action lists in Cursus when held by the player character, `npx tsc --noEmit` passes, and a manual pass through each office's action list confirms no broken action.

---

## Chunk C — War Legibility: Status Banner + Score/Influence Modal

**Goal:** Make the war score system, which already works correctly under the hood, visible and explicable. During an active war, the Provinciae map shows a banner naming the war; tapping it opens a modal with the current score, what's driving it, and what the player can do about it.

**Files to create:**
- `src/components/provinciae/WarStatusModal.tsx`

**Files to modify:**
- `src/screens/ProvinciaeScreen.tsx` (add `wars` store selector, render the banner + wire the modal)
- Possibly `src/data/glossaryTerms.ts` (a "War Score" glossary entry if one doesn't already exist — check first)

### Why this is the real fix for item 3

Item 3 assumed war score was "nudged or hardcoded." It isn't: `engine/warStanding.ts`'s `computeWarScore` recomputes it fresh every season as `sicilyControl + armyBalance + momentum − wearinessGap`, purely from live campaign-map state (who owns which Sicilian city, the live army strength ratio in-theatre, a decaying tally of recent battle results, and a weariness gap that only grows if the war drags on). It is not scripted to produce the Punic War — it's a real, reactive system. The actual bug is that **none of this is shown anywhere in the UI.** `warScore` only surfaces indirectly (desperation-tier notices, treaty screens once things are already dire) — there is currently no persistent "here's where the war stands and why" surface, which is exactly why it reads as arbitrary/unresponsive to the player's actions. This chunk builds that surface; it deliberately does not touch `warStanding.ts`'s math.

### Banner (`ProvinciaeScreen.tsx`)

- Add `const wars = useGameStore(s => s.wars);` and derive `const activeMajorWar = wars.find(w => w.active && w.scale === 'major');` (mirrors `warEngine.ts`'s own "primary major war" convention, see its `war-active-major` flag comment).
- When `activeMajorWar` exists, render a small banner pinned top-right over `MapView`, absolutely positioned within the screen's existing map container (`MapView` itself stays a pure, store-free rendering component per its existing convention — the banner belongs in the screen, not the map component). Label: `⚔ War with {capitalized enemyId}` (reuse `warEngine.ts`'s `capitalizeEnemyId` shape, or a local equivalent since that function isn't exported — check before duplicating). Tapping opens `WarStatusModal`.
- Local-scale (`scale: 'local'`, i.e. province revolts) wars are **not** shown in this banner — they already have their own revolt UI (`CitySheet.tsx`'s revolt banner, the Military tab). Keep this banner scoped to the one major foreign war, matching how the rest of the war system already treats "the war" as singular in practice.

### `WarStatusModal.tsx`

Props: `war: WarState`, `onClose: () => void`. Pure presentational component reading only its `war` prop (plus whatever static `BALANCE.war`/`REGIONS` data it needs for display — no store access, matching `NegotiationScreen.tsx`'s existing sibling pattern).

Content:
1. **Header:** war name, current phase (`war.phase` — 'opening'/'escalation'/'grinding'/'ripe', already computed, just needs display copy per phase).
2. **The score itself:** `war.warScore` on a −100..+100 bar, labelled by `getDesperationTier` (import from `warEngine.ts`) so the player sees "Winning — Carthage may sue for peace" / "Losing — Rome may be forced to the table" etc., not just a bare number.
3. **What's driving it** — a breakdown, not just the total. Reuse `warStanding.ts`'s exported pure functions directly rather than re-deriving anything:
   - Sicily control (`computeSicilyControl(cities)`) — "Who holds Sicily" framing.
   - Army balance (`computeArmyBalance(armies)`) — "Whose legions are stronger in-theatre."
   - Momentum (`war.momentum`, already stored) — "Recent battles" — this is the one component that decays over time (`decayMomentum`), worth a one-line note that it fades.
   - Weariness gap (`computeWearinessGap(war.weariness, war.enemyWeariness)`) — "How tired each side is of fighting."
4. **How to influence it** — concrete, actionable, not generic advice text:
   - Win battles on the campaign map (raises momentum — reference the Military tab).
   - Hold/take Sicilian cities (raises sicilyControl directly).
   - Pass War Funding bills when tabled (`war.momentum` bonus on pass, per `buildWarFundingBill`/`BALANCE.war.funding.momentumBonusOnPass`) — if one is currently live in `state.bills`, say so and point at Curia.
   - Once `war.peaceOffered` is true, a Sue for Peace bill becomes available — surface that fact if applicable.
   - If a treaty is currently in flight (`war.treaty !== null`), show its stage instead of the influence list (nothing to "influence" mid-negotiation — direct the player to the negotiation screen).

### Done when

Starting/loading a save with an active major war shows the banner on the Provinciae map; tapping it opens the modal with a correct, live-updating breakdown; the modal's numbers visibly change season over season in a way that traces back to what the player actually did (win a battle → momentum ticks up next visit; take a Sicilian city → sicilyControl visibly shifts). No war? No banner — confirm the null case renders nothing, not an empty shell.

---

## Chunk D — Ambassador Unlock Fixes

**Goal:** "Being ambassador unlocks nothing" stops being true anywhere. Two independent bugs, both fixed in this chunk.

**Files to modify:**
- `src/engine/cityEngine.ts` (the `cultural_exchange` case, ~line 656)
- `src/data/cityDefinitions.ts` (populate `clientIds` for currently-empty cities)
- `src/data/*` — wherever `CityClientDefinition`s actually live (confirm the file — likely alongside `cityDefinitions.ts` or a dedicated `cityClients.ts`; grep for `CityClientDefinition[]` before assuming) — add new client entries

### Bug 1 — Cultural Exchange is a dead stub

`resolveAmbassadorAction`'s `cultural_exchange` case (`cityEngine.ts:656`) returns a flat `localSupport +6 / fides −15` and a log message claiming *"A region-specific event has been queued"* — but nothing is queued. `getEventsForContext('ambassador', cityId)` (`cityEvents.ts:255`) exists and is never called from here. This is broken identically in **every** city, not just Syracuse — Messana "working" for the player was very likely a different action (`build_rapport`/`grain_dole`, which are correctly implemented) being mistaken for this one, or a lucky `seek_local_client` success where Messana happens to have a client (`clientIds` isn't defined per-Mediterranean-city — check whether Messana or Syracuse individually have one before assuming which action the report is actually about; ground this against the report before fixing rather than guessing).

**Fix:** wire `cultural_exchange` to actually call `getEventsForContext('ambassador', city.id)`, pick one of the results (there are currently only 2 generic ambassador-triggerable events in `cityEvents.ts` — `rival_envoy_arrives`, `local_festival` — both city-agnostic, so this will work everywhere immediately), and queue it as a real pending event via whatever mechanism `gameStore.ts`'s existing city-event triggers already use (check `governor` `triggerCondition` events for the queueing pattern already wired for governors — ambassador should mirror it, not invent a new path). This is a mechanical fix only.

**Flag while here (do not silently expand scope):** only 2 ambassador-triggerable event cards exist total, both generic. Once wired, `cultural_exchange` will feel repetitive fast (same 2 cards every time). Authoring more ambassador event content is a reasonable fast-follow but is explicitly out of scope for this chunk — note it in the end-of-task summary as a flagged follow-up, don't scope-creep into writing a full event card set here.

### Bug 2 — `seek_local_client` is a dead end almost everywhere

`canRecruitClient` gates on `city.localSupport`/`relationshipScore` thresholds, but there's nothing *to* recruit unless the city has a `CityClientDefinition` at all — and `clientIds` is empty (`[]`) for every city except four: `cisalpine_gaul` (`gallic_chieftains_son`), `etruria` (`etruscan_augur`), `samnium` (`samnite_gladiator_trainer`), `campania` (`campanian_grain_factor`). Every Mediterranean city (Messana, Syracuse, and the rest) has `clientIds: []` — `seek_local_client` there can never succeed, no matter how much Local Support the player builds. This is the most likely real explanation for "ambassador unlocks nothing in Syracuse" — there is nothing behind the door.

**Fix:** author one `CityClientDefinition` per currently-empty city that has an ambassador presence possible (i.e. every `unincorporated`/foreign-until-conquered city an ambassador can actually be posted to — confirm the full list against `cityDefinitions.ts`'s `ITALY_CITIES` + `MEDITERRANEAN_CITIES` before starting), following the shape/flavor of the four existing entries (each is a named, characterful NPC tied to the city's profile — e.g. Syracuse's should read Hellenistic/Archimedes-court-adjacent given its existing `flavorDescription`, not generic filler). This is content-authoring work, not a code change beyond adding data entries — **no assumptions on flavor/naming without checking the existing four for tone**, and if a city's own identity is thin in the current data (some Mediterranean entries have minimal `profile`/`flavorDescription` text), flag it back rather than inventing lore wholesale.

### Done when

`cultural_exchange`, used in any city, visibly queues one of the two ambassador event cards. Every non-heartland city the player can plausibly hold an ambassador or governor posting in has a non-empty `clientIds` with a defined, flavorful `CityClientDefinition` behind it, so `seek_local_client` is a live option everywhere, not just four Italian regions.

---

## Chunk E — Region / Latium Asset Parity

**Goal:** One coherent asset system, with a shared UI/data shape, used by both Latium (the player's home holdings) and every province — while still allowing real per-region variation (a Campania holiday estate; a gladiator school everywhere).

**This is the largest chunk in this plan and the one most worth re-scoping before an implementer starts** — it touches a data model, a save shape, and two separate UI components that currently look and behave differently on purpose (one is more polished than the other). Treat everything below as a grounded proposal, not a locked spec.

### Audit — what's actually different today

| | **Latium** (`HoldingsPanel.tsx` / `LatiumSheet.tsx`) | **Every other region** (`CityAssetGrid.tsx`) |
|---|---|---|
| Data model | `AssetDefinition` (`models/asset.ts`) | `CityAssetDefinition` (`models/city.ts`) — a *different* type, same name pattern, no shared base |
| Content file | `data/assetDefinitions.ts` — **4 assets**: Vineyard, Gladiator School, Public Baths, Insulae | `data/cityAssets.ts` — **7 assets**: Latifundium, Roadside Inn, Garrison Contract, Merchant Wharf, Temple Patronage, Grain Dole, Mining Rights |
| Tiers | **3 tiers** per asset, each with its own `goldCost`/`upgradeCost` and a `label` (e.g. "Small Ludus" → "Established Ludus" → "Grand Ludus") | **2 tiers** (`tier1Bonus`/`tier2Bonus` — fixed fields, not an array), no per-tier `label`/cost breakdown beyond the two bonus objects |
| Unlocks | Tier-3 assets can grant `unlockedActions` (e.g. Gladiator School T3 → `intimidate_witness`) | No unlock mechanism at all |
| Bonuses | `AssetBonus` (models/asset.ts): `gold`, `lifetimeDignitas`, `imperium`, `fides`, `rhetoricalBonus`/`martialBonus`/`intrigusBonus`, `clientSlots`, `corruptionShield`, `trialDefenseBonus` | `AssetBonus` (models/city.ts — **different type, same name**): `goldPerTurn`, `fidesPerTurn`, `imperiumPerTurn`, `relationshipPerTurn`, `corruptionResistance` — no skill bonuses, no client slots, no trial defense |
| Ownership shape | `OwnedAsset` — one array on `GameState`, not per-city (Latium is a single place) | `CityAssetOwned` — nested per-`CityState.ownedAssets`, since every province owns its own separately |
| Per-location gating | None needed (single location) | `ASSET_CITY_RESTRICTIONS` (e.g. Merchant Wharf coastal-only, Mining Rights highland-only) |
| Art | Image registry (`ASSET_IMAGES` in `HoldingsPanel.tsx`), graceful `require()`-missing fallback, tier stars (`★★☆`) | No images at all — plain text cards |
| UI polish | `ParchmentCard`, category-colored borders, tier stars, dedicated `AssetCard` + `HoldingsModal` detail view | Plain `ScrollView`/grid, functional but flat |
| Purchase/upgrade cost | Denarii, `goldCost` (tier 1) / `upgradeCost` (tier 2+) | Denarii, single flat `cost` field (no distinction between initial purchase and upgrade cost beyond the two bonus tiers) |

### Design decision this chunk needs to make (recommend, don't silently pick)

The two models don't share a base type, and unifying them for real means either (a) extending `CityAssetDefinition`/`CityAssetOwned` up to `AssetDefinition`'s richer 3-tier/unlock/art shape and porting every province onto it, or (b) collapsing `AssetDefinition` down to the simpler 2-tier shape and losing Latium's unlock/tier-label richness, or (c) introducing one new shared type both consume. **Recommend (a)** — Latium's model is strictly more expressive and its UI is more finished; bringing provinces up to it is additive (richer content, no regression), whereas (b) is a downgrade the user didn't ask for. This needs sign-off before implementation starts, since (a) is real engineering work: a `CityAssetOwned.tier` type widening from `1 | 2` to `1 | 2 | 3`, a `CityState.ownedAssets` shape that's already save-persisted (Zod schema update required, with a migration for existing saves' tier-2-max assets — they should read as "at their current max, further upgrade available" not silently break), and `CityAssetGrid.tsx` rebuilt against `HoldingsPanel.tsx`'s visual patterns (`ParchmentCard`, tier stars, art registry with graceful fallback) rather than its own simpler one.

### Proposed content additions (once the model question above is settled)

1. **Gladiator school in every region.** Port Latium's `gladiator_school` definition (or a close sibling) into the unified province-asset catalog, available everywhere — matches the explicit ask ("bring in some money but mainly boost relation, and reduce unrest"). That bonus shape (relationship + unrest reduction, secondarily gold) doesn't exist verbatim in either current catalog — `mining_rights`/`grain_dole_subscription` are the closest precedents (`relationshipPerTurn`) — so this is a new bonus combination, not a straight port of Latium's version (which leans martial/client-slot, not relationship/unrest). Confirm the "reduce unrest" mechanic hooks into whatever the crisis-track/unrest system currently reads (`crisisEngine.ts` — check its inputs before inventing a new effect token).
2. **Campania holiday estate.** New region-specific asset, Campania-only (via the existing `ASSET_CITY_RESTRICTIONS`-style gating, extended per-region rather than per-terrain), granting +Fides, +Dignitas, and +Optimates relation per the explicit ask — flavored as a countryside retreat for the political class, fitting Campania's existing `profile`: "Wealthy agricultural plain," "sophisticated, commercially minded."
3. Beyond these two named additions, the base 7-vs-4 asset catalogs should converge into one shared list available (subject to per-region restrictions) everywhere, rather than two parallel catalogs — but which of the existing 11 combined assets are kept, merged, or cut is a real content decision, not something to auto-resolve; bring a proposed unified list back for approval before writing it, rather than shipping a guess.

### Files likely touched (confirm exact set once the model decision is made)

- `src/models/city.ts` (`CityAssetDefinition`, `CityAssetOwned` — widen to 3 tiers + unlocks)
- `src/models/asset.ts` (possibly retired in favor of the widened city-asset types, or kept as the canonical shape city.ts's types now match — implementer's call once (a) above is confirmed)
- `src/data/cityAssets.ts` (rewritten onto the 3-tier shape; new gladiator-school + Campania-estate entries; region-restriction table extended)
- `src/data/assetDefinitions.ts` (Latium's 4 assets — likely unchanged in shape, now just "the same shape everyone else uses")
- `src/components/provinciae/CityAssetGrid.tsx` (rebuilt against `HoldingsPanel.tsx`'s visual patterns)
- `src/engine/cityEngine.ts` (`calcAssetGoldOutput` and any other asset-bonus aggregation — widen from 2-tier to 3-tier lookup)
- `src/state/saveLoad.ts` (Zod schema — `CityAssetOwned.tier` widening, migration for existing tier-2 saves)
- `src/utils/theme.ts` if new category colors are needed to match `HoldingsPanel`'s `CATEGORY_COLORS`

### Done when

There's a single asset data shape both Latium and every province read; every incorporated/unincorporated province offers a gladiator school; Campania offers its holiday estate; the province asset UI visually matches Latium's card/tier-star/art-fallback treatment; existing saves with tier-2 province assets load without data loss; `npx tsc --noEmit` and `npx jest` (asset-related engine tests) pass.
