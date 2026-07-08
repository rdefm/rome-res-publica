# Rome — Res Publica — Code Sitemap

React Native / Expo mobile grand-strategy game. Zustand single-store state, five bottom-tab features (Domus, Forum, Cursus, Provinciae, Curia) sharing one turn/season loop. This doc is organized **by feature first, then by folder** so you can find everything touching a feature in one place. A final section covers cross-cutting infra (app shell, state, data, models, utils, tests).

> ⚠️ **Known dead code** — flagged inline below. Don't edit these expecting them to run:
> - `src/screens/WelcomeBackModal.tsx` — byte-identical orphan of `components/shared/WelcomeBackModal.tsx` (the one actually imported by `App.tsx`).
> - `src/components/shared/PatronLadderPanel.tsx` — orphan of `components/forum/PatronLadderPanel.tsx` (the one ForumScreen imports); slightly **older** (missing `InfoTap` glossary wiring).
> - `src/components/shared/DiplomatDesk.tsx` and `src/components/shared/PolicyBoard.tsx` — orphans of the `components/provinciae/` versions (which `ProvinceSheet.tsx` imports); these `shared/` copies are slightly **newer** (have `InfoTap` wiring the live versions lack). Worth diffing before deleting either side.

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
| `PatronLadderPanel.tsx` | **Live version** — shows player's patron tier ladder and unlocked actions (imported by ForumScreen). |

**Engines:** `reputationEngine.ts` (reputation tier lookup, unlocked actions), `electionEngine.ts` (canvassing math, election scoring — also used by Cursus), `aiScoring.ts` (NPC leader action scoring/choice, used for clan-leader AI behavior).

**Models:** `clan.ts`.

**Data:** `startingClans.ts` (4 starting clans: Cornelii, Valerii, Fabii, Claudii), `canvassingEvents.ts`, `reputationThresholds.ts`.

---

## 3. Cursus (Cursus Honorum / Elections tab)

Office ladder progression, campaigning for office, in-office actions, trials.

**Screen:** `src/screens/CursusScreen.tsx` — office ladder, family-member candidate picker, election flow.

**Components:**
- `src/components/cursus/ElectionPanel.tsx` — election projection/results UI (vote shares, outcome).

**Engines:** `electionEngine.ts` (thresholds, player/NPC scores, rival generation), `officeActionEngine.ts` (in-office action gating/targeting logic — large target-selector constant set + `resolveOfficeAction`), `npcConsulEngine.ts` (NPC consul assignment, antagonism level, per-turn tick), `trialEngine.ts` (build/resolve trials, corruption-trial trigger, outcome consequences), `senateResponseEngine.ts` (Senate's escalating response to unsanctioned personal levies — debate → censure → hostis → consular army).

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

**Screen:** `src/screens/CuriaScreen.tsx` — Rome stat bars, crisis panel, bill list with voting/speech/filibuster/submit actions.

**Components (shared, but Curia-specific in practice):**
- `src/components/shared/CrisisTrackModal.tsx` — detail modal for one of the 4 crisis tracks (war/unrest/constitution/economy).

**Engines:** `crisisEngine.ts` (track deltas, escalation, cascades, named-crisis lookup, status effects, military-bill pressure check), `resourceEngine.ts` (also cross-cutting — see §7; `calcRomeStatModifiers`/`calcRomeStats` are the Curia-relevant exports), `aiScoring.ts` (NPC senator bill-vote reactions via `applyNpcBillReactions`).

**Models:** `bill.ts`, `crisis.ts`.

**Data:** `billTemplates.ts` (player-submittable + auto-injected bill templates, Rome-stat vote modifiers).

---

## 6. App shell & cross-feature UI

**Root:**
- `App.tsx` — navigation container, bottom tab navigator (registers all 5 screens), global error boundary, app-foreground/background autosave + "welcome back" trigger, agenda auto-open logic, mounts global modals (`EventModal`, `AmbitionSelectionModal`, `AgendaTablet`, `WelcomeBackModal`) above the tab navigator.

**Shared components** — `src/components/shared/` (used across multiple tabs):
| File | Summary |
|---|---|
| `ResourceBar.tsx` | Persistent top bar showing Fides/Dignitas/Gratia/Denarii/Gravitas, settings entry point. |
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
| `DebugPanel.tsx` | Dev-only panel to force-trigger events/state for testing. |
| `PatronLadderPanel.tsx` | ⚠️ orphan — see dead-code note at top. |
| `DiplomatDesk.tsx`, `PolicyBoard.tsx` | ⚠️ orphans — see dead-code note at top. |

---

## 7. State, engine core, and turn loop

- `src/state/gameStore.ts` — **the single Zustand store** (~2000 lines); all `GameState` fields and actions live here, organized in commented sections (Turn, Resources, Domus, Curia, Forum, Cursus, Reputation, Ambitions, Clientela, Assets, Trials, Birth, Events, Office actions, Provinciae). Any new persisted field or action goes here.
- `src/state/saveLoad.ts` — AsyncStorage save/load, Zod schema validation, JSON export/import via share sheet + document picker.
- `src/engine/turnSequencer.ts` — **the season-end orchestrator** (`processSeason`); calls into most other engines in sequence (resources, crisis, bills, campaigns, aging, etc.) and returns the `SeasonLedger` diff. Start here when adding a new "happens every season" system.
- `src/engine/resourceEngine.ts` — core economy: Rome stat modifiers, resource income calc, generic bill-effect-string application, faction drift, Rome stats aggregation, clan relationship drift. Used by Curia and the turn loop.
- `src/engine/agendaEngine.ts` — pure `GameState → AgendaItem[]` — generates the to-do list shown in `AgendaTablet`/`AgendaBadge`/`EndSeasonButton`.
- `src/engine/eventEngine.ts` — random/tutorial event eligibility, condition evaluation, picking, and choice resolution.

---

## 8. Models (`src/models/`) — TypeScript type definitions only, no logic

| File | Defines |
|---|---|
| `character.ts` | `Character`, skills, personality/ambition types. |
| `clan.ts` | `Clan`, `ClanLeader`, leader bias/standing types. |
| `office.ts` | `OfficeId`, `Office`, `OfficeAction`, action gates. |
| `bill.ts` | `Bill`, `ActiveLaw`, bill types. |
| `crisis.ts` | `CrisisTrackId`, `CrisisTrack`, `CrisisState`, tiers. |
| `province.ts` | **Largest model** — province state, governor policy, campaign/commander-election/officer-volunteer state, ambassador state. |
| `troop.ts` | `TroopUnit`, troop type. |
| `asset.ts` | `AssetDefinition`, `OwnedAsset`, asset category/tier. |
| `client.ts` | `Client`, `ClientBonus`, client type. |
| `patronLadder.ts` | `PatronTier`, tier definitions. |
| `ambition.ts` | `ActiveAmbition`, ambition scope/status/condition/reward. |
| `legacyObjective.ts` | `LegacyObjective`, milestones, bonuses. |
| `event.ts` | `EventDef`, `EventChoice`, `SkillCheck`, condition operators. |
| `trial.ts` | `Trial`, `TrialCharge`, `TrialOutcome`. |
| `agenda.ts` | `AgendaItem`, severity/category, `TabName`. |
| `ledger.ts` | `SeasonLedger` and its delta sub-types (resource/crisis/Rome). |
| `gameStart.ts` | `StartDefinition`, `StartId` (start-menu options). |
| `resources.ts` | `ResourcePool` (tiny — 5 lines). |

---

## 9. Data / content (`src/data/`) — static game content, no logic

Grouped since most are large const arrays of definitions consumed by the matching engine/model above.

| File | Content |
|---|---|
| `offices.ts` | Full 8-office Cursus Honorum ladder + all in-office actions (**large**, ~1000 lines). |
| `events.ts` | All non-tutorial random event definitions (**largest data file**, ~1150 lines). |
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
| `provinceEvents.ts` | Generic province-fired events (Italy-focused for v1). |
| `provincialClients.ts` | 12 Italy-relevant provincial client definitions. |
| `campaignEvents.ts` | Event cards firing during active military campaigns. |
| `canvassingEvents.ts` | Events firing during election vote-canvassing. |
| `clientNames.ts` | Name pools for procedurally generated clients. |
| `trialActions.ts` | Available actions during a trial. |

---

## 10. Utils, tests, config

- `src/utils/theme.ts` — `COLORS`, `FONTS`, `SPACING`, `RADIUS` and other design-token constants used by virtually every component.
- `__tests__/` — Jest unit tests, one per engine area: `engine.test.ts` (resourceEngine), `agendaEngine.test.ts`, `officeActionEngine.test.ts`, `officeAction.test.ts` (officeActionEngine + npcConsulEngine), `eventEngine.test.ts` (clientEngine + eventEngine), `militaryEngine.test.ts` (troopEngine), `romeStats.test.ts` (resourceEngine + crisisEngine).
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
