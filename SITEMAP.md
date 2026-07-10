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
| `MapView.tsx` | Renders the Italia province map with tappable province nodes. |
| `ProvinceSheet.tsx` | **Large** (1000+ lines) bottom-sheet container tabbing between a province's Overview/Assets/Military/Diplomacy sections; imports `PolicyBoard`, `DiplomatDesk`, `ProvinceAssetGrid`, `MilitaryTab`. |
| `LatiumSheet.tsx` | Special sheet for the home region (Rome stats, crisis tracks) instead of a regular province. |
| `PolicyBoard.tsx` | **Live version** — governor policy sliders (taxation/security notches). |
| `DiplomatDesk.tsx` | **Live version** — ambassador appointment/actions UI. |
| `ProvinceAssetGrid.tsx` | Grid of provincial assets (buy/upgrade). |
| `ProvincialClientCard.tsx` | Card for a province-based client. |
| `MilitaryTab.tsx` | **Large** (1000+ lines) — active campaign war room, commander election, officer-volunteer flow, revolt status, campaign history. |
| `MusterPickerModal.tsx` | Modal to pick troops/units when raising a levy. |

**Engines:** `provinceEngine.ts` (gold/imperium output, relationship/corruption/infrastructure deltas, revolt chance, per-province and all-province ticking, ambassador action resolution), `campaignEngine.ts` (campaign resolution for Commander/Officer systems, commander elections, governor lot-drawing incl. rigging), `troopEngine.ts` (local support modifier, effective force, military imperium, veteran promotion, attrition, levy cost), `ambassadorEngine.ts` (ambassador appointment/expulsion/rapport — minimal for v1 Italy-only map), `senateResponseEngine.ts` (shared with Cursus — consular army response to personal levies).

**Models:** `province.ts` (largest model file — province state, governor policy, campaign state, ambassador state), `troop.ts`.

**Data:** `provinceDefinitions.ts` (Italy province list + map node coordinates), `provinceAssets.ts`, `provinceEvents.ts`, `provincialClients.ts`, `campaignEvents.ts` (event cards during active campaigns).

---

## 5. Curia (Senate & Legislation / Gravitas tab)

Bill voting, speeches, filibusters, Rome-wide stats, crisis tracks.

**Screen:** `src/screens/CuriaScreen.tsx` — Rome stat bars, crisis panel, bill list with voting/speech/filibuster/submit actions, **Munificence panel (P2-F)** — collapsible list of the 6 munificence acts (`MunificenceActRow`, defined in this file), cost/effect/lock-state per act, decaying Grand Games vote bonus note.

**Components (shared, but Curia-specific in practice):**
- `src/components/shared/CrisisTrackModal.tsx` — detail modal for one of the 4 crisis tracks (war/unrest/constitution/economy).

**Engines:** `crisisEngine.ts` (track deltas, escalation, cascades, named-crisis lookup, status effects, military-bill pressure check), `resourceEngine.ts` (also cross-cutting — see §7; `calcRomeStatModifiers`/`calcRomeStats` are the Curia-relevant exports, plus the P2-F endowment Fides income term), `aiScoring.ts` (NPC senator bill-vote reactions via `applyNpcBillReactions`), `munificenceEngine.ts` (**P2-F**, pure — requirement gating, cost/effect Aedile-discount math, shared "games"-slot check; `gameStore.performMunificence` calls it and assembles the state patch).

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

---

## 6. App shell & cross-feature UI

**Root:**
- `App.tsx` — navigation container, bottom tab navigator (registers all 5 screens), global error boundary, app-foreground/background autosave + "welcome back" trigger, agenda auto-open logic, mounts global modals (`EventModal`, `AmbitionSelectionModal`, `AgendaTablet`, `WelcomeBackModal`) above the tab navigator. **Military Overhaul M5** — also mounts `BattleScreen`, its own full-screen native `Modal` (not one of the stacked overlay modals) that takes over the screen whenever `activeBattleSetup`/`activeBattle` is set.

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
| `DebugPanel.tsx` | Dev-only panel to force-trigger events/state for testing. Tabs: Resources, Characters, Events, **Battle (M5)** — "Launch Sandbox Battle" entry point (§5a), Telemetry (raw `seasonStatsHistory`/`BALANCE` dump), **Pace (P2-E)** — last-10-per-stage averages via `engine/actionEconomyEngine.ts`, flags seasons outside their stage's action band or over the 8-minute time budget. Rendered inside `DomusScreen.tsx` when `debugMode` is true (debug-start bypass). |

---

## 7. State, engine core, and turn loop

- `src/state/gameStore.ts` — **the single Zustand store** (~2000 lines); all `GameState` fields and actions live here, organized in commented sections (Turn, Resources, Domus, Curia, Forum, Cursus, Reputation, Ambitions, Clientela, Assets, Trials, Birth, Events, Office actions, Provinciae). Any new persisted field or action goes here. Forum leader actions (`buyInfluence`/`inviteToDinner`/`forgeAlliance`/`arrangeMarriageForum`) update `leader.relationship` and also call `adjustClanReputation` with a vote-weighted delta (via `reputationEngine.computeReputationDelta`), so `familyReputations` moves too. **Military Overhaul M4** — thin wrappers over `musterEngine.ts`: `resolveBattleOutcome` (takes a finished `BattleState`/`BattleOutcome` directly) and `payRansom`/`negotiateRansom`/`refuseRansom` (queued-state resolution for `character.captivity`, mirroring the Trial system's shape). **M5** adds the battle session itself — `activeBattleSetup`/`activeBattle`/`activeBattleBridgeCtx` plus `startSandboxBattle`/`commitDeployment`/`cancelDeployment`/`submitBattleOrders`/`submitBattleBreakDecision`/`returnFromBattle` — see §5a.
- `src/state/saveLoad.ts` — AsyncStorage save/load, Zod schema validation, JSON export/import via share sheet + document picker.
- `src/engine/turnSequencer.ts` — **the season-end orchestrator** (`processSeason`); calls into most other engines in sequence (resources, crisis, bills, campaigns, aging, etc.) and returns the `SeasonLedger` diff. Start here when adding a new "happens every season" system.
- `src/engine/resourceEngine.ts` — core economy: Rome stat modifiers, resource income calc (incl. P2-C household-voices term), `calcTrainingCost`, generic bill-effect-string application, faction drift, Rome stats aggregation. Used by Curia and the turn loop. Clan relationship drift moved to `reputationEngine.ts` in P2-D.
- `src/engine/agendaEngine.ts` — pure `GameState → AgendaItem[]` — generates the to-do list shown in `AgendaTablet`/`AgendaBadge`/`EndSeasonButton`.
- `src/engine/eventEngine.ts` — random/tutorial event eligibility, condition evaluation, picking, and choice resolution.
- `src/engine/actionEconomyEngine.ts` — **P2-E**, pure — `deriveStage` (Patron Tier → early/mid/late), `computeStagePace`/`computeAllStagePace` (last-10-per-stage averages + band/time-budget flags from `seasonStatsHistory`). Consumed by `DebugPanel`'s Pace tab.

---

## 8. Models (`src/models/`) — TypeScript type definitions only, no logic

| File | Defines |
|---|---|
| `character.ts` | `Character`, skills, personality/ambition types. **Military Overhaul M4** — optional `captivity?: CaptivityState \| null` (ransom/imprisonment; resolved by `musterEngine.resolveRansomChoice`). Wounded status is deliberately NOT a field here — see `musterEngine.ts`'s header comment. |
| `clan.ts` | `Clan`, `ClanLeader`, `LeaderBias` type, `ClanStanding` type (ally/neutral/hostile/rival — derived by `reputationEngine.getClanStanding`, not stored on `Clan`). |
| `office.ts` | `OfficeId`, `Office`, `OfficeAction`, action gates. |
| `bill.ts` | `Bill`, `ActiveLaw`, bill types. |
| `crisis.ts` | `CrisisTrackId`, `CrisisTrack`, `CrisisState`, tiers. |
| `province.ts` | **Largest model** — province state, governor policy, campaign/commander-election/officer-volunteer state, ambassador state. |
| `troop.ts` | `TroopUnit`, troop type. **Military Overhaul M4** — optional `unitClass?`/`veterancy?` fields for the battle bridge (backward-compat with pre-M4 saves; `musterEngine.ts` defaults and persists them). `bondToCommander`/`campaignsSurvived` are reused as battle "loyalty"/"engagedBattles" rather than adding redundant fields. |
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
| `war.ts` | **Military Overhaul M1** — `WarState`, `SetPieceOffer`, `TreatyState` (placeholder, full shape in M10). `enemyId` is a plain string and `scale`/`provinceId` distinguish a major foreign war from a local/revolt war — see the file's header comment for why this departs from the plan's single-war draft. |
| `gameStart.ts` | `StartDefinition`, `StartId` (start-menu options). |
| `resources.ts` | `ResourcePool` (tiny — 5 lines). |
| `telemetry.ts` | `SeasonStats` — local-only playtest instrumentation shape (P2-A). No network/remote analytics. **P2-E** added `patronTierAtEnd`, a per-season tier snapshot the Pace panel uses to bucket history by stage. |

---

## 9. Data / content (`src/data/`) — static game content, no logic

Grouped since most are large const arrays of definitions consumed by the matching engine/model above.

| File | Content |
|---|---|
| `balance.ts` | **The balance registry (P2-A)** — single authoritative home for tunable numbers (income, diplomacy, senate, elections, training, relationships, munificence, actionEconomy, **battle**/**war** — Military Overhaul M1, **battle.stratagems** — M7). Patron and elections numbers stay in their own files and are re-exported here; see the file's indirection-policy comment. Any new numeric literal for a tunable belongs here, not inline in engine/store code. |
| `stratagems.ts` | **Military Overhaul M7** — the 8-card stratagem catalog (`STRATAGEMS`/`STRATAGEM_LIST`): id, label, description, `timing` ('pre_battle' — everything except Rally the Standards — or 'reactive'), `target` (own/enemy × lane/side/none), Ambuscade's terrain gate. Pure content — hand-drawing, legality, and effect application all live in `engine/battle/battleEngine.ts` (BALANCE.battle.stratagems has every number). |
| `enemyGenerals.ts` | **Military Overhaul M7** — `GeneralProfile` type + the 4 v1 Carthaginian generals (`ENEMY_GENERALS`/`ENEMY_GENERAL_LIST`): Hanno the Cautious, Hamilcar the Fox (signature Ambuscade), Bomilcar the Bull (signature Fire Arrows, wedge + elephants, always pursues), Xanthippus the Drillmaster (signature Testudo Discipline, always wheels). Personality knobs (`aggression`, `reservePatience`, `formationPreferenceWeights`, `feintPreference`, `pursueBias`) consumed by `engine/battle/battleAi.ts`; no logic here. |
| `munificence.ts` | **Munificence acts (P2-F)** — `MUNIFICENCE_ACTS`: feasts, games, 5 named temple restorations, endowments. Structured `effects` (not effect strings) so Aedile's cost/effect multipliers can scale individual fields; see the file's header comment. Numbers read from `BALANCE.munificence`. |
| `offices.ts` | Full 8-office Cursus Honorum ladder + all in-office actions (**large**, ~1000 lines). **P2-F:** Aedile's `host-public-games`/`host-grand-ludi`/`sponsor-games-state`/`sponsor-ludi`/`spectacular-munera`/`temple-restoration` were removed — superseded by the Munificence panel (Curia), which the Aedile discount now applies to instead of a separate parallel action set. |
| `events.ts` | All non-tutorial random event definitions (**largest data file**, ~1150 lines). **Military Overhaul M4** added three weight-0 inject-only notices: `evt-wounded-notice`, `evt-battle-death-notice`, `evt-ransom-demand-notice` (built by `musterEngine.ts`'s `build*Notice` helpers via `injectNoticeEvent`, dispatch voice per invariant 7). |
| `tutorialEvents.ts` | Scripted tutorial-only events (fired via `tutorialQueue`, not random pool). |
| `billTemplates.ts` | Player-submittable + auto-injected Senate bill templates, Rome-stat vote modifiers. |
| `startingClans.ts` | The 4 starting clans (Cornelii, Valerii, Fabii, Claudii) with leaders. |
| `startingFamily.ts` | Initial player family (Brutus scenario). |
| `startDefinitions.ts` | New-game start picker options (guided vs standard). |
| `traits.ts` | Personality trait definitions + AI personality × action weight tables. |
| `glossaryTerms.ts` | All `InfoTap`/`GlossaryPopup` term definitions. |
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
- `src/engine/battle/` — **Military Overhaul, new engine directory.** `clashEngine.ts` (M2) — pure, seeded resolution of one round of one lane (`resolveLaneClash`); also exports `buildEffectiveSide` (the effective-stat-bundle helper, for the future debug sandbox), `lookupMatchup`, `isFeintGated`, `skirmisherScreenMult`, `elephantTerrorApplies`, and `applyAmokDamage` (the amok damage helper — orchestration of *when* amok triggers is M3's job). **M7** added two additive optional `LaneClashContext` fields — `incomingCavalryShockMultA/B` (Caltrops) and `preludeMultA/B` (Testudo Discipline) — threaded through `calcIncomingShockOnSide`/`resolvePreludeForSide`, same idiom as M3's `withdrawDefMultA/B`. `battleEngine.ts` (M3) — the orchestrator: `initBattle`/`submitOrders`/`submitBreakDecision`/`getValidOrders`/`formatBattleLog` (the log formatter M5/M6/M11 reuse). Pure, state-in/state-out, no `state/` or React imports; the only production caller of clashEngine.ts. Extends several M1 model fields beyond their original "first pass" shape (captain martial lookup, RNG-continuation bookkeeping, pending break decisions, starting-strength snapshot) — see the file's header comment and the matching field comments in `models/battle.ts` for the full rationale. **M7** added the stratagem "small effect-key switch": `drawStratagemHand`, `getPlayablePreBattleStratagems`/`getPlayableStratagems` (legality — the single source DeploymentBoard/OrdersPanel/battleAi all read), and pre-battle/reactive effect application wired into `initBattle`/`submitOrders`/`submitBreakDecision` (Officer's Oath mutates unit loyalty before the morale seed is computed; Ambuscade/Caltrops/Fire Arrows/Forced March/Testudo Discipline/Double Envelopment Doctrine mutate the built `SideState`/`WingState`; Rally the Standards is the one reactive-timing card, applied via `SideOrders.stratagemId`/`stratagemLaneId` at the top of `submitOrders`). `musterEngine.ts` (M4) — the strategic↔battle bridge: `troopToBattleUnit`/`battleUnitToTroop` (TroopUnit ↔ BattleUnit, 1:1 with a ×10 strength scale — NOT the plan's assumed "N/500-scale cohort" shape, which doesn't match this codebase's actual TroopUnit), `musterArmy`, `getEligibleFamilyCaptains`/`offerableLegates` (procedural legates named per `reputationEngine.ts`'s successor-generator pattern), `applyCharacterDeath` (new minimal death/succession system — none existed before this chunk; see the file's header comment, which also flags that the pre-existing trial-execution path has the same latent gap, not fixed here), `resolveRansomChoice` (Trial-like queued-state resolution, not the generic event-effect pipeline), and `applyBattleOutcome` (the main write-back: troop casualties, wounded/captured/killed fates, legate relationship deltas, and hooks into the *existing* triumph pathway (`turnSequencer.ts` step 9h) and the trial system's `defeatedGeneral` flag — no parallel triumph mechanism invented). Type-only `GameState` import, matching `troopEngine.ts`/`trialEngine.ts`'s existing convention. `battleAi.ts` (**M7**, new) — the enemy general AI: `chooseDeployment`/`chooseOrders`/`chooseBreakDecision` (pure, seeded, under ~10 heuristic rules per decision point — profiles carry the variety, not rule count) plus `deriveAiRng` (derives a decision-scoped RNG from the battle seed, independent of the engine's own RNG stream). Reads `data/enemyGenerals.ts` for personality and `battleEngine.ts`'s `getValidOrders`/`getPlayable*` as its only source of legality. Synthesizes a "lieutenant" captain per lane (Carthage has no clan/legate roster in this codebase) so wedge/feint stay reachable for the AI.
- `__tests__/` — Jest unit tests, one per engine area: `engine.test.ts` (resourceEngine, incl. P2-C household-voices income term + `calcTrainingCost`), `agendaEngine.test.ts`, `officeActionEngine.test.ts`, `officeAction.test.ts` (officeActionEngine + npcConsulEngine), `eventEngine.test.ts` (clientEngine + eventEngine), `militaryEngine.test.ts` (troopEngine), `romeStats.test.ts` (resourceEngine + crisisEngine), `reputationEngine.test.ts` (reputation tiers/clamping, `getClanStanding`, `computeReputationDelta`; P2-D — relationship anchors/yearly decay, `ageAndProcessMortality`, dangling-leader-ID election safety), `patronEngine.test.ts` (P2-B — tier gating, tier-up notice via `processSeason`; P2-D — yearly-vs-seasonal decay via `processSeason`), `training.test.ts` (P2-C — `trainCharacter` store action tested directly against `useGameStore`), `munificenceEngine.test.ts` (P2-F — requirement gating, Aedile discount math, endowment income term, `resolveElection` Grand Games vote bonus, yearly usage-reset/bonus-decay via `processSeason`, `performMunificence` store action), `actionEconomy.test.ts` (P2-E — `actionsThisSeason`/spend-counter increments on the counted-action list and exclusion of navigation/forced-event/birth-naming actions, `seasonStatsHistory` ring buffer cap, `patronTierAtEnd` snapshot), `actionEconomyEngine.test.ts` (P2-E — `deriveStage`, `computeStagePace`/`computeAllStagePace` band/time-budget flags), `electionSummitCurve.test.ts` (P2-E — `RIVAL_STRENGTH_BY_OFFICE_RANK`/`CANVASS_FIDES_COST_BY_OFFICE_RANK` wiring through `calcNpcElectionScore`/`generateRivals`/`resolveElection`; first-pass/unverified, see the plan's tuning log), `clashEngine.test.ts` (**Military Overhaul M2** — determinism, purity, mirror-matchup symmetry, canonical matchup/formation behaviors, feint gating/success/failure/botch, amok damage helper; documents win-rate baselines for M11's tuning pass), `battleEngine.test.ts` (**Military Overhaul M3** — deployment validation incl. conceded lanes, `getValidOrders` legality, full-battle completion + determinism, the Cannae double-envelopment check, withdrawal, rout cascade, amok end-to-end, `formatBattleLog`, the warScore swing cap; records the M11 baseline that mirror-matched armies currently take a flat 10 rounds — above the eventual 4–7 target, flagged for M11 not silently tuned away here), `musterEngine.test.ts` (**Military Overhaul M4** — troop↔BattleUnit round-trip conservation, captain/legate eligibility, `applyCharacterDeath` succession incl. the paterfamilias-death Done-When case, `resolveRansomChoice`, and `applyBattleOutcome`'s full write-back: troop casualties, wounded/captured/killed fates, legate relationship deltas, the triumph-pathway hook, and the defeatedGeneral trial-hook flag), `trialEngine.test.ts` (new — `shouldTriggerTrial`'s guard clauses plus **Military Overhaul M4**'s defeated-general prosecution branch), `stratagems.test.ts` (**Military Overhaul M7**, new — pre-battle effect application for all 6 pre-battle cards via `initBattle`, Rally the Standards via `submitOrders` incl. the once-per-battle gate, the two `clashEngine.ts` hooks (Caltrops/Testudo) tested directly through `resolveLaneClash`, `drawStratagemHand`/`getPlayablePreBattleStratagems`), `battleAi.test.ts` (**Military Overhaul M7**, new — a minimal test-local AI-vs-AI headless battle runner (a smaller, non-exported forerunner of M11's `simulateBattles`): 200-seed legality check against `getValidOrders`/`getPlayableStratagems`, Bomilcar-vs-Hanno wedge-rate divergence, Rally the Standards' once-per-battle cap under AI play, determinism).
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
