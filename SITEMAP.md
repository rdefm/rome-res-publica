# Rome — Res Publica — Code Sitemap

React Native / Expo mobile grand-strategy game. Zustand single-store state, five bottom-tab features (Domus, Forum, Cursus, Provinciae, Curia) sharing one turn/season loop. This doc is organized **by feature first, then by folder** so you can find everything touching a feature in one place. A final section covers cross-cutting infra (app shell, state, data, models, utils, tests).

---

## 1. Domus (Family / Dignitas tab)

Family tree, character actions, aging/birth, clientela (patron-client network), patrimonium (property/wealth), legacy objectives.

**Screen:** `src/screens/DomusScreen.tsx` — tab root; switches between Familias / Clientela / Patrimonium sections, hosts the family background art.

**Components** — `src/components/domus/`
| File | Summary |
|---|---|
| `FamilyTree.tsx` | Renders the grid of `CharacterCard`s for the whole family. |
| `CharacterCard.tsx` | Small tappable portrait card for one character. |
| `CharacterProfilePane.tsx` | Detail panel for the selected character (stats, traits, ambition). |
| `CharacterActionModal.tsx` | Modal listing actions you can take on a selected character (train, assign, etc.). |
| `DomesticDirectivesTray.tsx` | Household-wide directive toggles (standing orders for the family). |
| `BirthNamingModal.tsx` | Modal to name a newborn and preview inherited traits. |
| `LegatumPanel.tsx` | Legacy objectives tracker UI (milestones, bonuses). |
| `ClientelaPanel.tsx` | List/manage personal clients (muscle, public support, voting sway). |
| `PatrimoniumPanel.tsx` | Summary view of owned assets/wealth. |
| `PatrimoniumModal.tsx` | Detail modal for buying/upgrading a specific asset. |

**Engines:** `inheritanceEngine.ts` (birth eligibility, trait inheritance, child naming), `legacyEngine.ts` (legacy objective progress/milestones/bonuses), `patronEngine.ts` (patron tier computation, favour call-ins), `clientEngine.ts` (client bonuses, client generation), `assetEngine.ts` (asset costs/bonuses/unlocks).

**Models:** `character.ts`, `client.ts`, `asset.ts`, `patronLadder.ts`, `legacyObjective.ts`.

**Data:** `startingFamily.ts` (initial Brutus family), `traits.ts` (personality trait defs + AI weight tables), `legacyDefinitions.ts`, `assetDefinitions.ts`, `clientNames.ts` (name pools for generated clients).

---

## 2. Forum (Clans & Leaders / Gratia tab)

Relationship management with the 4 senatorial clans and their leaders; election canvassing.

**Screen:** `src/screens/ForumScreen.tsx` — clan list + canvassing event modal.

**Components** — `src/components/forum/`
| File | Summary |
|---|---|
| `ClanCard.tsx` | Expandable card for one clan, lists its leaders. |
| `LeaderCard.tsx` | Compact row for one clan leader. |
| `LeaderDetailPanel.tsx` | Expanded leader view with available Forum actions. |
| `PatronLadderPanel.tsx` | **Live version** — shows player's patron tier ladder and unlocked actions (imported by ForumScreen). **P2-F:** also cross-links which `MUNIFICENCE_ACTS` unlock at the current and next tier (acts themselves live on Curia). |

**Engines:** `reputationEngine.ts` (reputation tier lookup, unlocked actions; `getClanStanding` derives the ally/neutral/hostile/rival badge shown on `ClanCard` from `familyReputations` + `electionRivals` — `Clan` no longer stores a static `standing` field; `computeReputationDelta` converts a Forum action's relationship gain into a vote-weighted `familyReputations` swing, called from `gameStore`'s `buyInfluence`/`inviteToDinner`/`forgeAlliance`/`arrangeMarriageForum`; **P2-D** — `deriveRelationshipAnchor`/`applyYearlyRelationshipDecay` (relocated from `resourceEngine.applyRelationshipDrift`, now yearly-only, decays toward a per-leader anchor instead of toward 0) and `ageAndProcessMortality` (leader aging, mortality rolls, procedural succession — both called from `turnSequencer` step 9, gated on the Winter→Spring rollover), `electionEngine.ts` (canvassing math, election scoring — also used by Cursus), `aiScoring.ts` (NPC leader action scoring/choice, used for clan-leader AI behavior).

**Models:** `clan.ts` — `Clan`, `ClanLeader`, `LeaderBias` type, `ClanStanding` type (ally/neutral/hostile/rival — derived by `reputationEngine.getClanStanding`, not stored on `Clan`).

**Data:** `startingClans.ts` (4 starting clans: Cornelii, Valerii, Fabii, Claudii), `canvassingEvents.ts`, `reputationThresholds.ts`.

---

## 3. Cursus (Cursus Honorum / Elections tab)

Office ladder progression, campaigning for office, in-office actions, trials.

**Screen:** `src/screens/CursusScreen.tsx` — office ladder, family-member candidate picker, election flow.

**Components:**
- `src/components/cursus/ElectionPanel.tsx` — election projection/results UI (vote shares, outcome).

**Engines:** `electionEngine.ts` (thresholds, player/NPC scores, rival generation; **P2-E** — `RIVAL_STRENGTH_BY_OFFICE_RANK`/`CANVASS_FIDES_COST_BY_OFFICE_RANK` scale NPC score and canvass cost by office band, first-pass/unverified summit-curve levers, see `balance.ts`'s tuning-log pointer), `officeActionEngine.ts` (in-office action gating/targeting logic — large target-selector constant set + `resolveOfficeAction`), `npcConsulEngine.ts` (NPC consul assignment, antagonism level, per-turn tick), `trialEngine.ts` (build/resolve trials, corruption-trial trigger, outcome consequences; **Military Overhaul M4** — `shouldTriggerTrial` also accuses a `defeatedGeneral-<characterId>` flagged family member, charge `military_incompetence`, consumed by `turnSequencer.ts` step 16 once it fires), `senateResponseEngine.ts` (Senate's escalating response to unsanctioned personal levies — debate → censure → hostis → consular army).

**Models:** `office.ts` (office ladder, actions, gates), `trial.ts`.

**Data:** `offices.ts` (all 8 offices + their in-office actions — large file), `trialActions.ts`.

---

## 4. Provinciae (Provinces / Imperium tab)

Province map, governor policy, military campaigns, provincial clients, ambassadors.

**Screen:** `src/screens/ProvinciaeScreen.tsx` — map + swipe-up province sheet / Latium (home region) sheet.

**Components** — `src/components/provinciae/`
| File | Summary |
|---|---|
| `MapView.tsx` | Renders the Italia province map with tappable province nodes. **M10** — also renders `SICILY_PROVINCES` overlaid near the map's southern edge (no Mediterranean art exists yet); see §5c. |
| `ProvinceSheet.tsx` | **Large** (1000+ lines) bottom-sheet container tabbing between a province's Overview/Assets/Military/Diplomacy sections; imports `PolicyBoard`, `DiplomatDesk`, `ProvinceAssetGrid`, `MilitaryTab`. |
| `LatiumSheet.tsx` | Special sheet for the home region (Rome stats, crisis tracks) instead of a regular province. |
| `PolicyBoard.tsx` | **Live version** — governor policy sliders (taxation/security notches). |
| `DiplomatDesk.tsx` | **Live version** — ambassador appointment/actions UI. |
| `ProvinceAssetGrid.tsx` | Grid of provincial assets (buy/upgrade). |
| `ProvincialClientCard.tsx` | Card for a province-based client. |
| `MilitaryTab.tsx` | **Large** (1000+ lines) — active campaign war room, commander election, officer-volunteer flow, revolt status, campaign history. **Military Overhaul M8** — a `LegionRosterSection` at the top (units stationed in this province, grouped by owning character): veterancy pips, loyalty bar, elephantSteady icon, a Donative button (applies to that character's WHOLE army, not just this province — stated inline), and per-unit disband (with a retain-vs-disband confirmation dialog). Pulls `flags`/`disbandTroops`/`payDonative` directly via `useGameStore` rather than threaded props — mirrors `ProvinceSheet.tsx`'s existing `musterVeterans` precedent. Note: the commander-election/War-Room "commit season" flow this file also renders is currently a stub at the screen level (`ProvinciaeScreen.tsx` passes no-op handlers for `onCommitCampaignSeason`/`onResolveCampaignEvent`/`onNominateCommander`/`onVoteCommander`/`onSpeechCommander`) — discovered while wiring M8's season-tick loyalty gain, which reads `activeCampaign.commanderCharacterId` directly and so isn't affected by that stub. |
| `MusterPickerModal.tsx` | Modal to pick troops/units when raising a levy. |

**Engines:** `provinceEngine.ts` (gold/imperium output, relationship/corruption/infrastructure deltas, revolt chance, per-province and all-province ticking, ambassador action resolution), `campaignEngine.ts` (campaign resolution for Commander/Officer systems, commander elections, governor lot-drawing incl. rigging), `troopEngine.ts` (local support modifier, effective force, military imperium, veteran promotion, attrition, levy cost), `ambassadorEngine.ts` (ambassador appointment/expulsion/rapport — minimal for v1 Italy-only map), `senateResponseEngine.ts` (shared with Cursus — consular army response to personal levies).

**Models:** `province.ts` (largest model file — province state, governor policy, campaign state, ambassador state), `troop.ts`.

**Data:** `provinceDefinitions.ts` (Italy province list + map node coordinates; **M10** added `SICILY_PROVINCES` + `buildProvinceState` — see §5c), `provinceAssets.ts`, `provinceEvents.ts`, `provincialClients.ts`, `campaignEvents.ts` (event cards during active campaigns).

---

## 5. Curia (Senate & Legislation / Gravitas tab)

Bill voting, speeches, filibusters, Rome-wide stats, crisis tracks.

**Screen:** `src/screens/CuriaScreen.tsx` — Rome stat bars, crisis panel, bill list with voting/speech/filibuster/submit actions, **Munificence panel (P2-F)** — collapsible list of the 6 munificence acts (`MunificenceActRow`, defined in this file), cost/effect/lock-state per act, decaying Grand Games vote bonus note. **M10** — a "War & Peace" panel opens `components/war/NegotiationScreen.tsx` for any war past the sue threshold; see §5c.

**Components (shared, but Curia-specific in practice):**
- `src/components/shared/CrisisTrackModal.tsx` — detail modal for one of the 4 crisis tracks (war/unrest/constitution/economy).

**Engines:** `crisisEngine.ts` (track deltas, escalation, cascades, named-crisis lookup, status effects, military-bill pressure check; **Military Overhaul M9** — `calcWarEscalation` gained one term from `state.wars` trajectory, see §5b), `resourceEngine.ts` (also cross-cutting — see §7; `calcRomeStatModifiers`/`calcRomeStats` are the Curia-relevant exports, plus the P2-F endowment Fides income term), `aiScoring.ts` (NPC senator bill-vote reactions via `applyNpcBillReactions`), `munificenceEngine.ts` (**P2-F**, pure — requirement gating, cost/effect Aedile-discount math, shared "games"-slot check; `gameStore.performMunificence` calls it and assembles the state patch).

**Models:** `bill.ts`, `crisis.ts`.

**Data:** `billTemplates.ts` (player-submittable + auto-injected bill templates, Rome-stat vote modifiers), `munificence.ts` (**P2-F** — see §9).

---

## 5a. Military Overhaul — Battle System (cross-cutting, not tab-bound)

Set-piece battles ("The Legate's Line" — see `rome-military-implementation-plan.md`). Not one of the 5 tabs — `BattleScreen` is a full-screen native `Modal` mounted at the `App.tsx` root (§6), reached today only via `DebugPanel`'s "battle" tab ("Launch Sandbox Battle" — M11 replaces this with a real campaign entry point and a full army builder).

**Screen:** `src/screens/BattleScreen.tsx` — orchestrates deployment → round-by-round resolution → break-decision interstitials → outcome screen. **M6:** the live round view defaults to the animated `BattlefieldView`; a "Dispatches" toggle reveals M5's original `LaneCard` grid + text log (accessibility fallback / debug view). **M7:** the defender side is a real enemy general — `BattleScreen` computes the defender's per-round orders via `battleAi.chooseOrders` (fed into the same `submitBattleOrders` wrapper alongside the player's own) and auto-resolves the enemy's own break decisions via a `useEffect` calling `battleAi.chooseBreakDecision` (no player interaction — only decisions where the player's side is the victor wait on the interstitial's buttons). `battleAi.deriveAiRng(battleState.seed, salt)` derives a fresh deterministic RNG per AI decision, independent of the engine's own internal RNG stream.

**Components** — `src/components/battle/`
| File | Summary |
|---|---|
| `DeploymentBoard.tsx` | Pre-battle staging UI — entirely local component state until "Give Battle" commits it (`gameStore.commitDeployment`). Tap-to-select-then-tap-to-place unit assignment, per-lane formation/captain pickers (gated by `clashEngine.isFeintGated`/`requiresCaptain`, mirroring `battleEngine.getValidOrders`' legality logic for the not-yet-started battle), commander station selector, advantage-pip chevrons (reuses `clashEngine.buildEffectiveSide`, never shows raw numbers per invariant 6). **M7:** a pre-battle stratagem picker sourced from `attackerInput.stratagemHand` (filtered to legal cards via `battleEngine.getPlayablePreBattleStratagems`), with a lane-target sub-picker for lane-scoped cards — writes into `deployment.preBattleStratagems`. |
| `OrdersPanel.tsx` | Per-round order controls during the 'orders' phase — formation changes, one-lane reserve commit, withdraw toggle, "Resolve Round". Reads `battleEngine.getValidOrders` as the single source of legality. **M7:** a reactive "Rally the Standards" control (only rendered when `battleEngine.getPlayableStratagems` reports it legal) lets the player reform a broken own wing. |
| `LaneCard.tsx` | Read-only WingState display (units, formation, captain, morale bar, broken/flanked/overextended badges) — the M5 fallback view, reachable behind BattleScreen's "Dispatches" toggle since M6. |
| `BattlefieldView.tsx` | **M6** — the default round-resolution view. Each lane is a horizontal "tug of war": own strength pushes in from the left, the enemy's from the right, meeting at a `frontMarker` positioned by their live ratio (never overlapping — both bars share one width computation so the split itself IS the push-front reading). Reanimated shared values remember their own last position across rounds, so no separate "previous state" prop is needed — each new round's totals are just a new animation target. One-shot effects (shake/scatter/arc/zigzag/rearward-slide) layer on top for whichever `RoundLogEntry` types touched that lane this round. Tap anywhere to skip to the round's end state instantly. Scope-guard note (documented in the file and in `animations.ts`): a full serial multi-beat choreography (prelude→shock→melee→morale, one lane at a time, ~10–15s) was cut in favor of parallel per-lane pushes (~1.5–2.5s total) — simpler, robust, still delivers the "rounds play out, then pause for orders" feel. |

`animations.ts` — Reanimated timing constants + small fire-and-forget trigger functions (`playPush`/`playShake`/`playScatter`/`playArc`/`playZigzag`/`playRearwardSlide`/`playFeintDash`/`playTremble`) and `RoundLogEntry` query helpers (`laneHadClash`, `laneBrokeSide`, `laneWheeledFrom`, `laneHadAmok`, `laneHadFeint`, `sideWithdrew`) used by `BattlefieldView.tsx` to decide which effect(s) fire per lane per round. Also `CLASS_COLOR` (the unit-class → chip/bar color map).

**Store wiring (`gameStore.ts`):** `activeBattleSetup`/`activeBattle`/`activeBattleBridgeCtx` (transient session state, stripped before save — see `saveLoad.ts`) + thin wrapper actions `startSandboxBattle`/`commitDeployment`/`cancelDeployment`/`submitBattleOrders`/`submitBattleBreakDecision`/`returnFromBattle`. `returnFromBattle` calls the M4 `resolveBattleOutcome` action using the `bridgeCtx` captured at deployment time, then clears the session. **M7:** `startSandboxBattle` now also picks a random `enemyGenerals.ts` profile for the defender, draws both sides' stratagem hands (`battleEngine.drawStratagemHand`), and deploys the defender via `battleAi.chooseDeployment` (synthesized "lieutenant" captains per lane — see that file's header comment) instead of the old naive default deployment.

**Engines:** see §7's `engine/battle/` entry (`clashEngine.ts`, `battleEngine.ts`, `musterEngine.ts`).

## 5b. Military Overhaul — War Score & Set-Piece Scheduling (M9, cross-cutting)

The strategic wrapper around the battle system above: `GameState.wars: WarState[]` — an array (not a single `war`), a deliberate product decision to support multiple concurrent wars as more regions are added later. This chunk only ever creates ONE war (a major 'carthage' war) via a debug entry point — provincial revolts stay on the existing, already-working officer-volunteer suppression flow (`MilitaryTab.tsx`'s `VolunteerSection`/`OfficerPanel`) untouched. Neither "declare war" nor the personal-commander War Room have a real trigger anywhere in this codebase (verified: `provinceEngine.ts` sets `warDeclarationAvailable` but nothing consumes it; `ProvinciaeScreen.tsx` wires the War Room's commit handler to a no-op) — Phase 3A supplies the real trigger; a war starts/ends via `DebugPanel`'s War tab today. The campaigning army is always the player paterfamilias's own `raisedLegions`/`veterans` (`musterEngine.musterArmy`), matching `startSandboxBattle`'s existing precedent.

**Engine:** `src/engine/warEngine.ts` (new) — `processWarSeason(state, rng)`: skirmish drift (seeded, biased toward Rome when the player's army strength/martial clear `BALANCE.war.skirmish` baselines), weariness (erodes warScore toward 0 past `wearinessAfterTurns`), threshold-crossing notices (fires once per newly-higher band, not on sustained/de-escalating), and a stale-offer auto-expiry safety net (same consequence as an explicit decline — keeps the scheduler unstuck in a headless simulation with no UI to answer offers). `getDesperationTier(warScore)` is a pure, exported helper for BALANCE.war.desperation's tier (also the basis for threshold notices) — wiring every downstream consumer (levy cost, battle-time wing def, stratagem hand size, upkeep) is explicitly deferred past this "provisional scheduler" chunk. **THE SEAM:** `scheduleSetPiece(state, war, rng, opts)` is the ONLY function anywhere that constructs a `SetPieceOffer` — Phase 3A replaces this one exported function wholesale; nothing else may build offer-generation logic directly. Enemy army composition comes from `data/enemyGenerals.ts`'s (M7, extended) `GeneralProfile.armyComposition` weight table; general selection is deterministic round-robin keyed off `turnNumber % ENEMY_GENERAL_LIST.length`; site/terrain comes from `data/warSites.ts` (new, ~5 Sicilian sites with weighted terrain tables).

**Crisis coupling:** `crisisEngine.ts`'s `calcWarEscalation` gained one term (losing badly: `warScore < -20` → `+2`; winning big: `>= 20` → `-1`) — kept deliberately separate from `warEngine.ts` per the plan's "do not merge the systems" instruction. Reads `state.wars` as it stood BEFORE `processWarSeason` runs that same season (step 5 vs. the 9-series) — the same "one season behind" relationship every other crisis input already has with its producing system.

**turnSequencer.ts:** step 9d3, right after M8's 9d2 — calls `processWarSeason`, writes `wars`/`pendingEvents`/`lifetimeDignitas` back, and pushes `events` (→ `SeasonLedger.headlines` via `gameStore.endSeason`'s existing diff-capture — no separate ledger plumbing needed for the "warScore delta line each season" requirement).

**Agenda generators #17/#18** (`agendaEngine.ts`) — reserved since M4 but couldn't be built until `WarState`/`SetPieceOffer` existed as live state: #17 pending set-piece offer (critical, target Provinciae — a secondary reminder; the primary resolution path is the modal below), #18 peace threshold reached (critical, target Curia, framed by who's winning — M10 builds the actual negotiation screen this points at).

**UI:** `src/components/shared/SetPieceOfferModal.tsx` (new) — a global, blocking modal (mounted at `App.tsx` root, self-gates OFF whenever a battle is in progress so it never stacks with `BattleScreen`) shown whenever any active war has a `pendingSetPiece`. "Give Battle" → `gameStore.acceptSetPieceOffer` (musters the player's own army as attacker, deploys the offer's pre-generated `enemyArmy` via `battleAi.chooseDeployment` as defender — the army was already generated by `scheduleSetPiece`, `chooseDeployment` only lays it into lanes — then stages `activeBattleSetup` with `bridgeCtx.warId` set so `returnFromBattle`'s write-back feeds the outcome back into this war). "Decline" → `gameStore.declineSetPieceOffer` (same consequence as an unanswered offer expiring). No neutral dismiss, matching `BattleScreen`'s break-decision interstitial precedent.

**Store wiring (`gameStore.ts`):** `wars: WarState[]` (persisted — `saveLoad.ts`'s Zod schema has a light `.default([])` entry, matching every other complex-array field there) + `startWar`/`endWar`/`forceSetPieceOffer` (all debug-only — see above) and `acceptSetPieceOffer`/`declineSetPieceOffer` (the modal's real actions).

**musterEngine.ts write-back:** `BattleBridgeContext` gained `warId?: string` — when set, `applyBattleOutcome` applies `outcome.warScoreDelta` to the matching `WarState` (re-clamped to -100..100 — `battleEngine.ts` already caps the single-battle swing; this guards the war's running total against overflow near either end) and clears `pendingSetPiece`. Rome is always cast as battle `attacker` in every M9 flow, so no sign negation is needed (see `battleEngine.ts`'s `warScoreDelta` sign-convention comment).

**DebugPanel.tsx:** new "war" tab — Declare War on Carthage, per-war state dump (score/weariness/pending offer), Force Set-Piece Offer (bypasses the scheduler's spacing/roll gate but still goes through `scheduleSetPiece`), End War.

---

## 5c. Military Overhaul — Peace: Negotiation & Senate Ratification (M10, cross-cutting)

Wars end at a table, and the table answers to the Senate. Builds on §5b's `WarState`/`getDesperationTier` — nothing here replaces the provisional scheduler (still M9's seam).

**Data:** `src/data/treatyTerms.ts` (new) — `TREATY_TERMS`: 7 bidirectional terms (indemnity minor/major, prisoner return, Sicily west/all, fleet limitation, face-saver clause) — one entry serves both "Rome wins" and "Rome loses" framings (`effectsAsWinner`/`effectsAsLoser`) rather than mirrored ids, per an explicit M10 scope decision to keep the menu at the plan's "~8 terms" cap. `getTreatyTerm(id)` lookup. Pure content — all logic lives in `warEngine.ts`.

**Models:** `models/war.ts` — `TreatyState` fleshed out from M9's placeholder (`stage: 'ai_offer' | 'senate_vote' | 'auto_ratified'`, `resolvedTurn`, `initiator`) + new `TreatyTerm`/`TreatyTermFactionReaction`/`TreatyTermWarEndFlags` types.

**Engine (`warEngine.ts`, same file as §5b — no new engine file, matching the plan's file list):** `computeTreatyBudget(warScore)` (`|warScore| − thresholdBase + treatyBudgetAllowance[tier]` — 0 at the sue tier itself, matching "sue is accept/refuse only, not term-shopping"), `computePackagePrice(termIds)`, `calcFactionReactionModifier(termIds, state)` (clan-bias-weighted bill support seed, parallel to `billTemplates.calcRomeStatVoteModifier`), `composeAiOffer`/`composeAiTreaty` (AI term selection weighted by `GeneralProfile.aggression`), `applyTreatyEffects(termIds, state, winner)` (the "war-end fields" that don't fit the flat effect-string vocabulary: province cession via `provinceDefinitions.buildProvinceState`, prisoner release, the face-saver's loser-dignity grant — everything else routes through the existing `resourceEngine.applyEffectString`), `buildTreatyBill` (composes the Senate bill), and `losingSide(warScore)`. `processWarSeason` (§5b) gained: sue-tier threshold crossing while Rome is winning auto-generates the enemy's `ai_offer`; a tabled `senate_vote` treaty's pass/fail is detected each season by checking `state.bills`/`state.passedBills` for the reconstructable id `treaty-${war.id}-${treaty.proposedTurn}` (no new turnSequencer step — see below); the 4-turn re-table lockout clears once elapsed; Rome losing at the dictate tier auto-ratifies an AI-composed treaty with no vote at all ("Rome dictated to"). Returns a new `WarSeasonResult.statePatch: Partial<GameState>` for the denarii/family/provinces/bills changes a resolved treaty can produce.

**turnSequencer.ts:** the plan's Cross-Chunk Notes say this file is touched only by M9's one step — M10 honors that by *widening* the existing step 9d3 merge (not adding a new step) to also spread `warResult.statePatch` and merge `lifetimeDignitas` from both the pre-existing delta path and the new statePatch path.

**Sicily provinces (`provinceDefinitions.ts` + `components/provinciae/MapView.tsx`):** no Mediterranean-map province existed anywhere before M10 (`ProvinceMap`'s `'mediterranean'`/`'east'` were pure type-level future-proofing). `sicily_west`/`sicily_east` are now real `ProvinceDefinition`s, absent from `buildInitialProvinceStates()` (Carthage still holds them) and added to `state.provinces` only when ceded by treaty. Since no Mediterranean map art exists, both are overlaid onto the existing `map_italia.png` near its southern edge (`nodeY` 0.90–0.96) — a deliberate geographic approximation, not a claim Sicily is part of the peninsula; `MapView.tsx` now renders `[...ITALY_PROVINCES, ...SICILY_PROVINCES]`, relying on its pre-existing "no matching ProvinceState → render nothing" guard to keep them invisible pre-cession. `getProvinceDefinition` searches both lists; `buildProvinceState(def)` was extracted from `buildInitialProvinceStates` so the treaty engine can reuse it for the mid-game addition.

**Store wiring (`gameStore.ts`):** `acceptAiTreatyOffer`/`refuseAiTreatyOffer` (sue-tier, ungated) and `tableTreaty` (forced/dictate-tier, gated on `currentOffice === 'consul'` — negotiation is a consular act, an M10 scope decision).

**UI:** `src/components/war/NegotiationScreen.tsx` (new) — a `ScrollModal`, three modes by `war.treaty.stage`: no treaty (term-shopping picker with a running budget/price), `'ai_offer'` (read-only terms, Accept/Refuse), `'senate_vote'` (status only — vote from the bill list). `CuriaScreen.tsx` gained a "WAR & PEACE" panel (any active war past the sue threshold) that opens it.

**Glossary:** `glossaryTerms.ts` gained Peace Negotiation and Treaty Terms.

---

## 6. App shell & cross-feature UI

**Root:**
- `App.tsx` — navigation container, bottom tab navigator (registers all 5 screens), global error boundary, app-foreground/background autosave + "welcome back" trigger, agenda auto-open logic, mounts global modals (`EventModal`, `AmbitionSelectionModal`, `AgendaTablet`, `WelcomeBackModal`) above the tab navigator. **Military Overhaul M5** — also mounts `BattleScreen`, its own full-screen native `Modal` (not one of the stacked overlay modals) that takes over the screen whenever `activeBattleSetup`/`activeBattle` is set. **M9** — also mounts `SetPieceOfferModal` (self-gates OFF whenever a battle is in progress, so it never stacks with `BattleScreen`).

**Shared components** — `src/components/shared/` (used across multiple tabs):
| File | Summary |
|---|---|
| `ResourceBar.tsx` | Persistent top bar showing Fides/Denarii (Dignitas/Gratia/Gravitas were consolidated into Fides; lifetime Dignitas survives only as `lifetimeDignitas`, a non-spendable legacy score), settings entry point. |
| `TabBar.tsx` | Custom bottom-tab bar icon/background renderers used by `App.tsx`. |
| `EndSeasonButton.tsx` | The "End Season" CTA that triggers `turnSequencer.processSeason`; hosts `AgendaBadge`. |
| `SeasonOverlay.tsx` | Full-screen season-transition overlay showing the `SeasonLedger` delta summary. |
| `LedgerBlock.tsx` | Renders non-zero resource/crisis/Rome deltas from a `SeasonLedger`; used by `SeasonOverlay` and `WelcomeBackModal`. |
| `WelcomeBackModal.tsx` | **Live version** — "while you were away" recap shown after 12+ hrs absence. |
| `EventModal.tsx` / `EventCard.tsx` | Random/tutorial event popup and its card content. |
| `AmbitionSelectionModal.tsx` | Modal to pick a new family/character ambition when prompted. |
| `AgendaTablet.tsx` | Full agenda list modal (wax tablet UI); deep-links into tabs on item tap. |
| `AgendaBadge.tsx` | Small badge/count chip docked in `EndSeasonButton`, opens `AgendaTablet`. |
| `GlossaryPopup.tsx` + `InfoTap.tsx` | Tap-to-define glossary term system used throughout the app. |
| `ParchmentCard.tsx` | Reusable parchment-styled card background/text style. |
| `ScrollModal.tsx` | Base scroll-styled modal wrapper used by many other modals. |
| `StatBar.tsx` | Generic labeled stat/progress bar. |
| `SettingsModal.tsx` | Settings screen (save export/import, reset, glossary access). |
| `DebugPanel.tsx` | Dev-only panel to force-trigger events/state for testing. Tabs: Resources, Characters, Events, **Battle (M5)** — "Launch Sandbox Battle" entry point (§5a), **War (M9)** — Declare War on Carthage, per-war state dump, Force Set-Piece Offer, End War (the only "declare war" entry point anywhere in the app today — see §5b), Telemetry (raw `seasonStatsHistory`/`BALANCE` dump), **Pace (P2-E)** — last-10-per-stage averages via `engine/actionEconomyEngine.ts`, flags seasons outside their stage's action band or over the 8-minute time budget. Rendered inside `DomusScreen.tsx` when `debugMode` is true (debug-start bypass). |

---

## 7. State, engine core, and turn loop

- `src/state/gameStore.ts` — **the single Zustand store** (~2000 lines); all `GameState` fields and actions live here, organized in commented sections (Turn, Resources, Domus, Curia, Forum, Cursus, Reputation, Ambitions, Clientela, Assets, Trials, Birth, Events, Office actions, Provinciae). Any new persisted field or action goes here. Forum leader actions (`buyInfluence`/`inviteToDinner`/`forgeAlliance`/`arrangeMarriageForum`) update `leader.relationship` and also call `adjustClanReputation` with a vote-weighted delta (via `reputationEngine.computeReputationDelta`), so `familyReputations` moves too. **Military Overhaul M4** — thin wrappers over `musterEngine.ts`: `resolveBattleOutcome` (takes a finished `BattleState`/`BattleOutcome` directly) and `payRansom`/`negotiateRansom`/`refuseRansom` (queued-state resolution for `character.captivity`, mirroring the Trial system's shape). **M5** adds the battle session itself — `activeBattleSetup`/`activeBattle`/`activeBattleBridgeCtx` plus `startSandboxBattle`/`commitDeployment`/`cancelDeployment`/`submitBattleOrders`/`submitBattleBreakDecision`/`returnFromBattle` — see §5a. **M8** adds `payDonative` (army-scope, once/year via the existing `<key>-cooldown` flags pass); `raiseLevy`'s starting loyalty now reads `BALANCE.battle.lifecycle.newLevyLoyalty` (was inline 50); `disbandTroops` now also filters `veterans` by id (captured elephants only ever land there).
- `src/state/saveLoad.ts` — AsyncStorage save/load, Zod schema validation, JSON export/import via share sheet + document picker.
- `src/engine/turnSequencer.ts` — **the season-end orchestrator** (`processSeason`); calls into most other engines in sequence (resources, crisis, bills, campaigns, aging, etc.) and returns the `SeasonLedger` diff. Start here when adding a new "happens every season" system. **Military Overhaul M8** added step 9d2 (unit lifecycle loyalty season tick), right after the existing 9d troop-attrition step: +5/season to a character's raisedLegions+veterans while they personally command an unresolved `activeCampaign` (province.ts's existing abstract-campaign system — the closest analog to "on campaign, same commander" for the new set-piece muster; note the personal-commander War-Room flow is a UI-layer stub today, see `MilitaryTab.tsx`'s entry, but this tick still fires correctly off `activeCampaign`'s own fields), else idle decay toward 50 by 2/year at the Winter→Spring rollover only (`crossedNewYear`, same cadence as every other yearly system in this file). **M9** added step 9d3 right after — see §5b for the full `warEngine.processWarSeason` breakdown.
- `src/engine/resourceEngine.ts` — core economy: Rome stat modifiers, resource income calc (incl. P2-C household-voices term), `calcTrainingCost`, generic bill-effect-string application, faction drift, Rome stats aggregation. Used by Curia and the turn loop. Clan relationship drift moved to `reputationEngine.ts` in P2-D.
- `src/engine/agendaEngine.ts` — pure `GameState → AgendaItem[]` — generates the to-do list shown in `AgendaTablet`/`AgendaBadge`/`EndSeasonButton`. Generators #17/#18 (**Military Overhaul M9**) were reserved since M4 but couldn't be built until `WarState`/`SetPieceOffer` existed as live state — see §5b.
- `src/engine/eventEngine.ts` — random/tutorial event eligibility, condition evaluation, picking, and choice resolution.
- `src/engine/actionEconomyEngine.ts` — **P2-E**, pure — `deriveStage` (Patron Tier → early/mid/late), `computeStagePace`/`computeAllStagePace` (last-10-per-stage averages + band/time-budget flags from `seasonStatsHistory`). Consumed by `DebugPanel`'s Pace tab.

---

## 8. Models (`src/models/`) — TypeScript type definitions only, no logic

| File | Defines |
|---|---|
| `character.ts` | `Character`, skills, personality/ambition types. **Military Overhaul M4** — optional `captivity?: CaptivityState \| null` (ransom/imprisonment; resolved by `musterEngine.resolveRansomChoice`). Wounded status is deliberately NOT a field here — see `musterEngine.ts`'s header comment. **M8** — optional `lastLoyaltyCommanderId?: string \| null`, tracking who last commanded this character's own troops in a set-piece battle so `musterEngine.applyBattleOutcome` can detect a commander change (-10 loyalty) at the NEXT battle. |
| `clan.ts` | `Clan`, `ClanLeader`, `LeaderBias` type, `ClanStanding` type (ally/neutral/hostile/rival — derived by `reputationEngine.getClanStanding`, not stored on `Clan`). |
| `office.ts` | `OfficeId`, `Office`, `OfficeAction`, action gates. |
| `bill.ts` | `Bill`, `ActiveLaw`, bill types. |
| `crisis.ts` | `CrisisTrackId`, `CrisisTrack`, `CrisisState`, tiers. |
| `province.ts` | **Largest model** — province state, governor policy, campaign/commander-election/officer-volunteer state, ambassador state. |
| `troop.ts` | `TroopUnit`, troop type. **Military Overhaul M4** — optional `unitClass?`/`veterancy?` fields for the battle bridge (backward-compat with pre-M4 saves; `musterEngine.ts` defaults and persists them). `bondToCommander`/`campaignsSurvived` are reused as battle "loyalty"/"engagedBattles" rather than adding redundant fields. **M8** — optional `elephantSteady?`/`wonCrushingVictory?` (both sticky, set at battle write-back by `musterEngine.applyLifecycleUpdates`; the latter additionally gates the legendary veterancy tier). |
| `asset.ts` | `AssetDefinition`, `OwnedAsset`, asset category/tier. |
| `client.ts` | `Client`, `ClientBonus`, client type. |
| `patronLadder.ts` | `PatronTier`, tier definitions. |
| `ambition.ts` | `ActiveAmbition`, ambition scope/status/condition/reward. |
| `legacyObjective.ts` | `LegacyObjective`, milestones, bonuses. |
| `event.ts` | `EventDef`, `EventChoice`, `SkillCheck`, condition operators. |
| `trial.ts` | `Trial`, `TrialCharge` (**Military Overhaul M4** added `'military_incompetence'`), `TrialOutcome`. |
| `agenda.ts` | `AgendaItem`, severity/category, `TabName`. |
| `ledger.ts` | `SeasonLedger` and its delta sub-types (resource/crisis/Rome). |
| `battle.ts` | **Military Overhaul M1** — set-piece battle types: `BattleUnit`, `Deployment`, `SideOrders`, `WingState`, `BattleState`, `BattleLog`/`RoundLogEntry`, `BattleOutcome`. Types only — engine lives in `src/engine/battle/` (from M2 onward). **M7** additions: `PreBattleStratagemPick`, `Deployment.preBattleStratagems`, `SideOrders.stratagemLaneId`, `WingState.stratagemMods` (Caltrops/Testudo), `SideState.stratagemHand`/`stratagemsPlayed`/`reserveLockedUntilRound`/`incomingElephantAmokRiderPct`/`wheelBonusMult` — all optional/additive, see `data/stratagems.ts`. |
| `war.ts` | **Military Overhaul M1** — `WarState`, `SetPieceOffer`, `TreatyState` (placeholder, full shape in M10). `enemyId` is a plain string and `scale`/`provinceId` distinguish a major foreign war from a local/revolt war — see the file's header comment for why this departs from the plan's single-war draft. **M9** made the multi-war shape real: `GameState.wars: WarState[]` (see §5b) — this chunk only ever populates it with one major war, but the array was chosen specifically so more regions/wars can be added later without a schema change. |
| `gameStart.ts` | `StartDefinition`, `StartId` (start-menu options). |
| `resources.ts` | `ResourcePool` (tiny — 5 lines). |
| `telemetry.ts` | `SeasonStats` — local-only playtest instrumentation shape (P2-A). No network/remote analytics. **P2-E** added `patronTierAtEnd`, a per-season tier snapshot the Pace panel uses to bucket history by stage. |

---

## 9. Data / content (`src/data/`) — static game content, no logic

Grouped since most are large const arrays of definitions consumed by the matching engine/model above.

| File | Content |
|---|---|
| `balance.ts` | **The balance registry (P2-A)** — single authoritative home for tunable numbers (income, diplomacy, senate, elections, training, relationships, munificence, actionEconomy, **battle**/**war** — Military Overhaul M1, **battle.stratagems** — M7, **battle.lifecycle** — M8, **war.setPieceOffer**/**war.skirmish** — M9). Patron and elections numbers stay in their own files and are re-exported here; see the file's indirection-policy comment. Any new numeric literal for a tunable belongs here, not inline in engine/store code. |
| `stratagems.ts` | **Military Overhaul M7** — the 8-card stratagem catalog (`STRATAGEMS`/`STRATAGEM_LIST`): id, label, description, `timing` ('pre_battle' — everything except Rally the Standards — or 'reactive'), `target` (own/enemy × lane/side/none), Ambuscade's terrain gate. Pure content — hand-drawing, legality, and effect application all live in `engine/battle/battleEngine.ts` (BALANCE.battle.stratagems has every number). |
| `enemyGenerals.ts` | **Military Overhaul M7** — `GeneralProfile` type + the 4 v1 Carthaginian generals (`ENEMY_GENERALS`/`ENEMY_GENERAL_LIST`): Hanno the Cautious, Hamilcar the Fox (signature Ambuscade), Bomilcar the Bull (signature Fire Arrows, wedge + elephants, always pursues), Xanthippus the Drillmaster (signature Testudo Discipline, always wheels). Personality knobs (`aggression`, `reservePatience`, `formationPreferenceWeights`, `feintPreference`, `pursueBias`) consumed by `engine/battle/battleAi.ts`; no logic here. **M9** added `armyComposition` (unit-class weight table per general) — consumed by `warEngine.ts`'s set-piece scheduler to generate that general's enemy army. |
| `warSites.ts` | **Military Overhaul M9** — `WAR_SITES`: ~5 named Sicilian sites, each with a weighted terrain table (`BALANCE.battle.terrains` keys). Pure content — `warEngine.scheduleSetPiece` picks a site and rolls its terrain. |
| `munificence.ts` | **Munificence acts (P2-F)** — `MUNIFICENCE_ACTS`: feasts, games, 5 named temple restorations, endowments. Structured `effects` (not effect strings) so Aedile's cost/effect multipliers can scale individual fields; see the file's header comment. Numbers read from `BALANCE.munificence`. |
| `offices.ts` | Full 8-office Cursus Honorum ladder + all in-office actions (**large**, ~1000 lines). **P2-F:** Aedile's `host-public-games`/`host-grand-ludi`/`sponsor-games-state`/`sponsor-ludi`/`spectacular-munera`/`temple-restoration` were removed — superseded by the Munificence panel (Curia), which the Aedile discount now applies to instead of a separate parallel action set. |
| `events.ts` | All non-tutorial random event definitions (**largest data file**, ~1150 lines). **Military Overhaul M4** added three weight-0 inject-only notices: `evt-wounded-notice`, `evt-battle-death-notice`, `evt-ransom-demand-notice` (built by `musterEngine.ts`'s `build*Notice` helpers via `injectNoticeEvent`, dispatch voice per invariant 7). **M8** added a 4th, `evt-captured-elephant-notice` — the one Rome-context (Philon-voiced) notice among the four, since it fires after the battle rather than as a battle dispatch. |
| `tutorialEvents.ts` | Scripted tutorial-only events (fired via `tutorialQueue`, not random pool). |
| `billTemplates.ts` | Player-submittable + auto-injected Senate bill templates, Rome-stat vote modifiers. |
| `startingClans.ts` | The 4 starting clans (Cornelii, Valerii, Fabii, Claudii) with leaders. |
| `startingFamily.ts` | Initial player family (Brutus scenario). |
| `startDefinitions.ts` | New-game start picker options (guided vs standard). |
| `traits.ts` | Personality trait definitions + AI personality × action weight tables. |
| `glossaryTerms.ts` | All `InfoTap`/`GlossaryPopup` term definitions. **Military Overhaul M8** added Donative, Loyalty, Veterancy, War Score (the last is forward-looking content — warScore itself isn't playable until M9). |
| `reputationThresholds.ts` | Reputation tier cutoffs and unlocked actions. |
| `legacyDefinitions.ts` | Legacy objective definitions (milestones/bonuses). |
| `ambitionDefinitions.ts` | Drawable ambition definitions (conditions/rewards). |
| `assetDefinitions.ts` | Personal (Domus) asset definitions. |
| `provinceDefinitions.ts` | Italy province list + map node coordinates. |
| `provinceAssets.ts` | Provincial asset definitions (7 types × 2 tiers). |
| `provinceEvents.ts` | Generic province-fired events (Italy-focused for v1). **Confirmed unwired (P2-A):** `PROVINCE_EVENTS` has no consumer anywhere in `src/` — dead content, not currently reachable in play. |
| `provincialClients.ts` | 12 Italy-relevant provincial client definitions. |
| `campaignEvents.ts` | Event cards firing during active military campaigns. |
| `canvassingEvents.ts` | Events firing during election vote-canvassing. |
| `clientNames.ts` | Name pools for procedurally generated clients; also `LEADER_PRAENOMINA` (P2-D — clan leader succession naming). |
| `trialActions.ts` | Available actions during a trial. |

---

## 10. Utils, tests, config

- `src/utils/theme.ts` — `COLORS`, `FONTS`, `SPACING`, `RADIUS` and other design-token constants used by virtually every component.
- `src/utils/seededRng.ts` — **Military Overhaul M2** — `makeSeededRng` (mulberry32), `rngInt`, `rngPercent`. Deterministic PRNG used by `src/engine/battle/*` so battles are reproducible from a seed.
- `src/engine/battle/` — **Military Overhaul, new engine directory.** `clashEngine.ts` (M2) — pure, seeded resolution of one round of one lane (`resolveLaneClash`); also exports `buildEffectiveSide` (the effective-stat-bundle helper, for the future debug sandbox), `lookupMatchup`, `isFeintGated`, `skirmisherScreenMult`, `elephantTerrorApplies`, and `applyAmokDamage` (the amok damage helper — orchestration of *when* amok triggers is M3's job). **M7** added two additive optional `LaneClashContext` fields — `incomingCavalryShockMultA/B` (Caltrops) and `preludeMultA/B` (Testudo Discipline) — threaded through `calcIncomingShockOnSide`/`resolvePreludeForSide`, same idiom as M3's `withdrawDefMultA/B`. `battleEngine.ts` (M3) — the orchestrator: `initBattle`/`submitOrders`/`submitBreakDecision`/`getValidOrders`/`formatBattleLog` (the log formatter M5/M6/M11 reuse). Pure, state-in/state-out, no `state/` or React imports; the only production caller of clashEngine.ts. Extends several M1 model fields beyond their original "first pass" shape (captain martial lookup, RNG-continuation bookkeeping, pending break decisions, starting-strength snapshot) — see the file's header comment and the matching field comments in `models/battle.ts` for the full rationale. **M7** added the stratagem "small effect-key switch": `drawStratagemHand`, `getPlayablePreBattleStratagems`/`getPlayableStratagems` (legality — the single source DeploymentBoard/OrdersPanel/battleAi all read), and pre-battle/reactive effect application wired into `initBattle`/`submitOrders`/`submitBreakDecision` (Officer's Oath mutates unit loyalty before the morale seed is computed; Ambuscade/Caltrops/Fire Arrows/Forced March/Testudo Discipline/Double Envelopment Doctrine mutate the built `SideState`/`WingState`; Rally the Standards is the one reactive-timing card, applied via `SideOrders.stratagemId`/`stratagemLaneId` at the top of `submitOrders`). `musterEngine.ts` (M4) — the strategic↔battle bridge: `troopToBattleUnit`/`battleUnitToTroop` (TroopUnit ↔ BattleUnit, 1:1 with a ×10 strength scale — NOT the plan's assumed "N/500-scale cohort" shape, which doesn't match this codebase's actual TroopUnit), `musterArmy`, `getEligibleFamilyCaptains`/`offerableLegates` (procedural legates named per `reputationEngine.ts`'s successor-generator pattern), `applyCharacterDeath` (new minimal death/succession system — none existed before this chunk; see the file's header comment, which also flags that the pre-existing trial-execution path has the same latent gap, not fixed here), `resolveRansomChoice` (Trial-like queued-state resolution, not the generic event-effect pipeline), and `applyBattleOutcome` (the main write-back: troop casualties, wounded/captured/killed fates, legate relationship deltas, and hooks into the *existing* triumph pathway (`turnSequencer.ts` step 9h) and the trial system's `defeatedGeneral` flag — no parallel triumph mechanism invented). Type-only `GameState` import, matching `troopEngine.ts`/`trialEngine.ts`'s existing convention. **M8** added the unit lifecycle layer, applied at the same write-back: `promotedVeterancy` (recomputes veterancy from `campaignsSurvived` thresholds, taking the MAX against the unit's current tier so a TroopType-derived tier can never be downgraded), `applyLifecycleUpdates` (loyalty delta + sticky `elephantSteady`/`wonCrushingVictory` + re-promotion, layered on top of `battleUnitToTroop`'s 1:1 mapping), `computeElephantLanes` (union of final-state elephant lanes + any lane with an `amok` log entry — a documented first-pass simplification, since a unit that fought an elephant later killed by ordinary melee/shock in-lane isn't credited), and a captured-elephant roll (`BattleBridgeContext.enemyFieldedElephants`, set by the caller from the pre-battle deployment since survival by battle's end is irrelevant). Also detects a changed army commander (-10 loyalty) by comparing `Character.lastLoyaltyCommanderId` against the battle's own `commanderId` — a battle-time check, not a season-tick one (see the file's header comment for the interpretation). **M9** added `BattleBridgeContext.warId?` — when set, `applyBattleOutcome` applies `outcome.warScoreDelta` to the matching `WarState` (re-clamped -100..100) and clears its `pendingSetPiece`; see §5b. `battleAi.ts` (**M7**, new) — the enemy general AI: `chooseDeployment`/`chooseOrders`/`chooseBreakDecision` (pure, seeded, under ~10 heuristic rules per decision point — profiles carry the variety, not rule count) plus `deriveAiRng` (derives a decision-scoped RNG from the battle seed, independent of the engine's own RNG stream). Reads `data/enemyGenerals.ts` for personality and `battleEngine.ts`'s `getValidOrders`/`getPlayable*` as its only source of legality. Synthesizes a "lieutenant" captain per lane (Carthage has no clan/legate roster in this codebase) so wedge/feint stay reachable for the AI.
- `__tests__/` — Jest unit tests, one per engine area: `engine.test.ts` (resourceEngine, incl. P2-C household-voices income term + `calcTrainingCost`), `agendaEngine.test.ts`, `officeActionEngine.test.ts`, `officeAction.test.ts` (officeActionEngine + npcConsulEngine), `eventEngine.test.ts` (clientEngine + eventEngine), `militaryEngine.test.ts` (troopEngine), `romeStats.test.ts` (resourceEngine + crisisEngine), `reputationEngine.test.ts` (reputation tiers/clamping, `getClanStanding`, `computeReputationDelta`; P2-D — relationship anchors/yearly decay, `ageAndProcessMortality`, dangling-leader-ID election safety), `patronEngine.test.ts` (P2-B — tier gating, tier-up notice via `processSeason`; P2-D — yearly-vs-seasonal decay via `processSeason`), `training.test.ts` (P2-C — `trainCharacter` store action tested directly against `useGameStore`), `munificenceEngine.test.ts` (P2-F — requirement gating, Aedile discount math, endowment income term, `resolveElection` Grand Games vote bonus, yearly usage-reset/bonus-decay via `processSeason`, `performMunificence` store action), `actionEconomy.test.ts` (P2-E — `actionsThisSeason`/spend-counter increments on the counted-action list and exclusion of navigation/forced-event/birth-naming actions, `seasonStatsHistory` ring buffer cap, `patronTierAtEnd` snapshot), `actionEconomyEngine.test.ts` (P2-E — `deriveStage`, `computeStagePace`/`computeAllStagePace` band/time-budget flags), `electionSummitCurve.test.ts` (P2-E — `RIVAL_STRENGTH_BY_OFFICE_RANK`/`CANVASS_FIDES_COST_BY_OFFICE_RANK` wiring through `calcNpcElectionScore`/`generateRivals`/`resolveElection`; first-pass/unverified, see the plan's tuning log), `clashEngine.test.ts` (**Military Overhaul M2** — determinism, purity, mirror-matchup symmetry, canonical matchup/formation behaviors, feint gating/success/failure/botch, amok damage helper; documents win-rate baselines for M11's tuning pass), `battleEngine.test.ts` (**Military Overhaul M3** — deployment validation incl. conceded lanes, `getValidOrders` legality, full-battle completion + determinism, the Cannae double-envelopment check, withdrawal, rout cascade, amok end-to-end, `formatBattleLog`, the warScore swing cap; records the M11 baseline that mirror-matched armies currently take a flat 10 rounds — above the eventual 4–7 target, flagged for M11 not silently tuned away here), `musterEngine.test.ts` (**Military Overhaul M4** — troop↔BattleUnit round-trip conservation, captain/legate eligibility, `applyCharacterDeath` succession incl. the paterfamilias-death Done-When case, `resolveRansomChoice`, and `applyBattleOutcome`'s full write-back: troop casualties, wounded/captured/killed fates, legate relationship deltas, the triumph-pathway hook, and the defeatedGeneral trial-hook flag; **M8** added loyalty deltas (victory/defeat/commander-change stacking, first-battle no-op), `elephantSteady` write-back (final-state + amok-log cases, stickiness), captured-elephant rolls (forced via mocked `Math.random`), `promotedVeterancy` (thresholds, legendary's crushing-victory gate, never-downgrade), and `computeElephantLanes`), `trialEngine.test.ts` (new — `shouldTriggerTrial`'s guard clauses plus **Military Overhaul M4**'s defeated-general prosecution branch), `stratagems.test.ts` (**Military Overhaul M7**, new — pre-battle effect application for all 6 pre-battle cards via `initBattle`, Rally the Standards via `submitOrders` incl. the once-per-battle gate, the two `clashEngine.ts` hooks (Caltrops/Testudo) tested directly through `resolveLaneClash`, `drawStratagemHand`/`getPlayablePreBattleStratagems`), `battleAi.test.ts` (**Military Overhaul M7**, new — a minimal test-local AI-vs-AI headless battle runner (a smaller, non-exported forerunner of M11's `simulateBattles`): 200-seed legality check against `getValidOrders`/`getPlayableStratagems`, Bomilcar-vs-Hanno wedge-rate divergence, Rally the Standards' once-per-battle cap under AI play, determinism), `donative.test.ts` (**Military Overhaul M8**, new — `payDonative` store action tested directly against `useGameStore`, matching `training.test.ts`'s pattern: whole-army loyalty grant incl. clamping, cost-per-cohort, once-per-year cooldown, insufficient-Denarii/no-troops no-ops). `patronEngine.test.ts` also gained a **Military Overhaul M8** section (season-tick loyalty gain while on personal campaign, no-gain when resolved/other-commanded, idle decay only at the Winter→Spring rollover) alongside its existing yearly-cadence coverage. `warEngine.test.ts` (**Military Overhaul M9**, new — `getDesperationTier` thresholds; `scheduleSetPiece` (the seam): inactive/no-army/spacing/roll gates, `forceRoll` bypass, offer-field validity, warScore-vs-army-size scaling, major-vs-local scale clamping, and an architectural check that `scheduleSetPiece` is the only place a `SetPieceOffer` is constructed (grep-count on its own source, per the plan's "grep-style assertion... or reviewed manually" allowance); `processWarSeason`: skirmish drift, weariness (before/after `wearinessAfterTurns`, toward-0 direction), threshold-crossing notices (fires once, not on sustained bands), -100..100 cap enforcement, stale-offer auto-expiry, scheduler spacing across consecutive seasons, ledger headlines; a 20-season DONE-WHEN simulation proving coherent drift/weariness/offers/notices with no crash). `romeStats.test.ts` and `agendaEngine.test.ts` each gained a small **Military Overhaul M9** section (the `calcWarEscalation` trajectory term; generators #17/#18) alongside their existing coverage, both including a "no `wars` field at all" pre-M9-save regression case (the new code defensively reads `state.wars ?? []` throughout for exactly this reason).
- `app.json`, `babel.config.js`, `tsconfig.json`, `eas.json`, `package.json` — Expo/RN/TS build config; edit only for tooling/dependency changes.
- `proxy.mjs` — local dev proxy script (check contents before assuming purpose if touching networking in dev).
- `android/` — native Android project (Expo prebuild output); not hand-edited in normal feature work.

---

## Quick "where do I edit?" cheatsheet

| I want to... | Start here |
|---|---|
| Add a new season-end effect | `engine/turnSequencer.ts` |
| Change income/economy formulas | `engine/resourceEngine.ts` |
| Add a new random event | `data/events.ts` (+ `models/event.ts` if new condition/effect shape needed) |
| Add a new office action | `data/offices.ts` + `engine/officeActionEngine.ts` |
| Add a new bill | `data/billTemplates.ts` |
| Change crisis math | `engine/crisisEngine.ts` |
| Add a province asset | `data/provinceAssets.ts` + `engine/assetEngine.ts`/`provinceEngine.ts` |
| Change military/campaign resolution | `engine/campaignEngine.ts`, `engine/troopEngine.ts` |
| Add a new persisted state field or store action | `state/gameStore.ts` |
| Add a glossary term | `data/glossaryTerms.ts` |
| Change save file shape | `state/saveLoad.ts` (update Zod schema too) |
| Change a resource/stat's on-screen look | `components/shared/ResourceBar.tsx` + `utils/theme.ts` |
| Add a new agenda/to-do rule | `engine/agendaEngine.ts` |
| Add/change a Munificence act | `data/munificence.ts` + `engine/munificenceEngine.ts` (numbers in `data/balance.ts`) |
