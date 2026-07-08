Rome — Res Publica — Code Sitemap
React Native / Expo mobile grand-strategy game. Zustand single-store state, five bottom-tab features (Domus, Forum, Cursus, Provinciae, Curia) sharing one turn/season loop. This doc is organized by feature first, then by folder so you can find everything touching a feature in one place. A final section covers cross-cutting infra (app shell, state, data, models, utils, tests).

1. Domus (Family / Dignitas tab)
Family tree, character actions, aging/birth, clientela (patron-client network), patrimonium (property/wealth), legacy objectives.
Screen: src/screens/DomusScreen.tsx — tab root; switches between Familias / Clientela / Patrimonium sections, hosts the family background art.
Components — src/components/domus/
FileSummaryFamilyTree.tsxRenders the grid of CharacterCards for the whole family.CharacterCard.tsxSmall tappable portrait card for one character.CharacterProfilePane.tsxDetail panel for the selected character (stats, traits, ambition).CharacterActionModal.tsxModal listing actions you can take on a selected character (train, assign, etc.).DomesticDirectivesTray.tsxHousehold-wide directive toggles (standing orders for the family).BirthNamingModal.tsxModal to name a newborn and preview inherited traits.LegatumPanel.tsxLegacy objectives tracker UI (milestones, bonuses).ClientelaPanel.tsxList/manage personal clients (muscle, public support, voting sway).PatrimoniumPanel.tsxSummary view of owned assets/wealth.PatrimoniumModal.tsxDetail modal for buying/upgrading a specific asset.
Engines: inheritanceEngine.ts (birth eligibility, trait inheritance, child naming), legacyEngine.ts (legacy objective progress/milestones/bonuses), patronEngine.ts (patron tier computation, favour call-ins), clientEngine.ts (client bonuses, client generation), assetEngine.ts (asset costs/bonuses/unlocks).
Models: character.ts, client.ts, asset.ts, patronLadder.ts, legacyObjective.ts.
Data: startingFamily.ts (initial Brutus family), traits.ts (personality trait defs + AI weight tables), legacyDefinitions.ts, assetDefinitions.ts, clientNames.ts (name pools for generated clients).

2. Forum (Clans & Leaders / Gratia tab)
Relationship management with the 4 senatorial clans and their leaders; election canvassing.
Screen: src/screens/ForumScreen.tsx — clan list + canvassing event modal.
Components — src/components/forum/
FileSummaryClanCard.tsxExpandable card for one clan, lists its leaders.LeaderCard.tsxCompact row for one clan leader.LeaderDetailPanel.tsxExpanded leader view with available Forum actions.PatronLadderPanel.tsxLive version — shows player's patron tier ladder and unlocked actions (imported by ForumScreen).
Engines: reputationEngine.ts (reputation tier lookup, unlocked actions; getClanStanding derives the ally/neutral/hostile/rival badge shown on ClanCard from familyReputations + electionRivals — Clan no longer stores a static standing field; computeReputationDelta converts a Forum action's relationship gain into a vote-weighted familyReputations swing, called from gameStore's buyInfluence/inviteToDinner/forgeAlliance/arrangeMarriageForum), electionEngine.ts (canvassing math, election scoring — also used by Cursus), aiScoring.ts (NPC leader action scoring/choice, used for clan-leader AI behavior).
Models: clan.ts.
Data: startingClans.ts (4 starting clans: Cornelii, Valerii, Fabii, Claudii), canvassingEvents.ts, reputationThresholds.ts.

3. Cursus (Cursus Honorum / Elections tab)
Office ladder progression, campaigning for office, in-office actions, trials.
Screen: src/screens/CursusScreen.tsx — office ladder, family-member candidate picker, election flow.
Components:

src/components/cursus/ElectionPanel.tsx — election projection/results UI (vote shares, outcome).

Engines: electionEngine.ts (thresholds, player/NPC scores, rival generation), officeActionEngine.ts (in-office action gating/targeting logic — large target-selector constant set + resolveOfficeAction), npcConsulEngine.ts (NPC consul assignment, antagonism level, per-turn tick), trialEngine.ts (build/resolve trials, corruption-trial trigger, outcome consequences), senateResponseEngine.ts (Senate's escalating response to unsanctioned personal levies — debate → censure → hostis → consular army).
Models: office.ts (office ladder, actions, gates), trial.ts.
Data: offices.ts (all 8 offices + their in-office actions — large file), trialActions.ts.

4. Provinciae (Provinces / Imperium tab)
Province map, governor policy, military campaigns, provincial clients, ambassadors.
Screen: src/screens/ProvinciaeScreen.tsx — map + swipe-up province sheet / Latium (home region) sheet.
Components — src/components/provinciae/
FileSummaryMapView.tsxRenders the Italia province map with tappable province nodes.ProvinceSheet.tsxLarge (1000+ lines) bottom-sheet container tabbing between a province's Overview/Assets/Military/Diplomacy sections; imports PolicyBoard, DiplomatDesk, ProvinceAssetGrid, MilitaryTab.LatiumSheet.tsxSpecial sheet for the home region (Rome stats, crisis tracks) instead of a regular province.PolicyBoard.tsxLive version — governor policy sliders (taxation/security notches).DiplomatDesk.tsxLive version — ambassador appointment/actions UI.ProvinceAssetGrid.tsxGrid of provincial assets (buy/upgrade).ProvincialClientCard.tsxCard for a province-based client.MilitaryTab.tsxLarge (1000+ lines) — active campaign war room, commander election, officer-volunteer flow, revolt status, campaign history.MusterPickerModal.tsxModal to pick troops/units when raising a levy.
Engines: provinceEngine.ts (gold/imperium output, relationship/corruption/infrastructure deltas, revolt chance, per-province and all-province ticking, ambassador action resolution), campaignEngine.ts (campaign resolution for Commander/Officer systems, commander elections, governor lot-drawing incl. rigging), troopEngine.ts (local support modifier, effective force, military imperium, veteran promotion, attrition, levy cost), ambassadorEngine.ts (ambassador appointment/expulsion/rapport — minimal for v1 Italy-only map), senateResponseEngine.ts (shared with Cursus — consular army response to personal levies).
Models: province.ts (largest model file — province state, governor policy, campaign state, ambassador state), troop.ts.
Data: provinceDefinitions.ts (Italy province list + map node coordinates), provinceAssets.ts, provinceEvents.ts, provincialClients.ts, campaignEvents.ts (event cards during active campaigns).

5. Curia (Senate & Legislation / Gravitas tab)
Bill voting, speeches, filibusters, Rome-wide stats, crisis tracks.
Screen: src/screens/CuriaScreen.tsx — Rome stat bars, crisis panel, bill list with voting/speech/filibuster/submit actions.
Components (shared, but Curia-specific in practice):

src/components/shared/CrisisTrackModal.tsx — detail modal for one of the 4 crisis tracks (war/unrest/constitution/economy).

Engines: crisisEngine.ts (track deltas, escalation, cascades, named-crisis lookup, status effects, military-bill pressure check), resourceEngine.ts (also cross-cutting — see §7; calcRomeStatModifiers/calcRomeStats are the Curia-relevant exports), aiScoring.ts (NPC senator bill-vote reactions via applyNpcBillReactions).
Models: bill.ts, crisis.ts.
Data: billTemplates.ts (player-submittable + auto-injected bill templates, Rome-stat vote modifiers).

6. App shell & cross-feature UI
Root:

App.tsx — navigation container, bottom tab navigator (registers all 5 screens), global error boundary, app-foreground/background autosave + "welcome back" trigger, agenda auto-open logic, mounts global modals (EventModal, AmbitionSelectionModal, AgendaTablet, WelcomeBackModal) above the tab navigator.

Shared components — src/components/shared/ (used across multiple tabs):
FileSummaryResourceBar.tsxPersistent top bar showing Fides/Dignitas/Gratia/Denarii/Gravitas, settings entry point.TabBar.tsxCustom bottom-tab bar icon/background renderers used by App.tsx.EndSeasonButton.tsxThe "End Season" CTA that triggers turnSequencer.processSeason; hosts AgendaBadge.SeasonOverlay.tsxFull-screen season-transition overlay showing the SeasonLedger delta summary.LedgerBlock.tsxRenders non-zero resource/crisis/Rome deltas from a SeasonLedger; used by SeasonOverlay and WelcomeBackModal.WelcomeBackModal.tsxLive version — "while you were away" recap shown after 12+ hrs absence.EventModal.tsx / EventCard.tsxRandom/tutorial event popup and its card content.AmbitionSelectionModal.tsxModal to pick a new family/character ambition when prompted.AgendaTablet.tsxFull agenda list modal (wax tablet UI); deep-links into tabs on item tap.AgendaBadge.tsxSmall badge/count chip docked in EndSeasonButton, opens AgendaTablet.GlossaryPopup.tsx + InfoTap.tsxTap-to-define glossary term system used throughout the app.ParchmentCard.tsxReusable parchment-styled card background/text style.ScrollModal.tsxBase scroll-styled modal wrapper used by many other modals.StatBar.tsxGeneric labeled stat/progress bar.SettingsModal.tsxSettings screen (save export/import, reset, glossary access).DebugPanel.tsxDev-only panel to force-trigger events/state for testing.

7. State, engine core, and turn loop

src/state/gameStore.ts — the single Zustand store (~2000 lines); all GameState fields and actions live here, organized in commented sections (Turn, Resources, Domus, Curia, Forum, Cursus, Reputation, Ambitions, Clientela, Assets, Trials, Birth, Events, Office actions, Provinciae). Any new persisted field or action goes here. Forum leader actions (buyInfluence/inviteToDinner/forgeAlliance/arrangeMarriageForum) update leader.relationship and also call adjustClanReputation with a vote-weighted delta (via reputationEngine.computeReputationDelta), so familyReputations moves too.
src/state/saveLoad.ts — AsyncStorage save/load, Zod schema validation, JSON export/import via share sheet + document picker.
src/engine/turnSequencer.ts — the season-end orchestrator (processSeason); calls into most other engines in sequence (resources, crisis, bills, campaigns, aging, etc.) and returns the SeasonLedger diff. Start here when adding a new "happens every season" system.
src/engine/resourceEngine.ts — core economy: Rome stat modifiers, resource income calc, generic bill-effect-string application, faction drift, Rome stats aggregation, clan relationship drift. Used by Curia and the turn loop.
src/engine/agendaEngine.ts — pure GameState → AgendaItem[] — generates the to-do list shown in AgendaTablet/AgendaBadge/EndSeasonButton.
src/engine/eventEngine.ts — random/tutorial event eligibility, condition evaluation, picking, and choice resolution.


8. Models (src/models/) — TypeScript type definitions only, no logic
FileDefinescharacter.tsCharacter, skills, personality/ambition types.clan.tsClan, ClanLeader, LeaderBias type, ClanStanding type (ally/neutral/hostile/rival — derived by reputationEngine.getClanStanding, not stored on Clan).office.tsOfficeId, Office, OfficeAction, action gates.bill.tsBill, ActiveLaw, bill types.crisis.tsCrisisTrackId, CrisisTrack, CrisisState, tiers.province.tsLargest model — province state, governor policy, campaign/commander-election/officer-volunteer state, ambassador state.troop.tsTroopUnit, troop type.asset.tsAssetDefinition, OwnedAsset, asset category/tier.client.tsClient, ClientBonus, client type.patronLadder.tsPatronTier, tier definitions.ambition.tsActiveAmbition, ambition scope/status/condition/reward.legacyObjective.tsLegacyObjective, milestones, bonuses.event.tsEventDef, EventChoice, SkillCheck, condition operators.trial.tsTrial, TrialCharge, TrialOutcome.agenda.tsAgendaItem, severity/category, TabName.ledger.tsSeasonLedger and its delta sub-types (resource/crisis/Rome).gameStart.tsStartDefinition, StartId (start-menu options).resources.tsResourcePool (tiny — 5 lines).

9. Data / content (src/data/) — static game content, no logic
Grouped since most are large const arrays of definitions consumed by the matching engine/model above.
FileContentoffices.tsFull 8-office Cursus Honorum ladder + all in-office actions (large, ~1000 lines).events.tsAll non-tutorial random event definitions (largest data file, ~1150 lines).tutorialEvents.tsScripted tutorial-only events (fired via tutorialQueue, not random pool).billTemplates.tsPlayer-submittable + auto-injected Senate bill templates, Rome-stat vote modifiers.startingClans.tsThe 4 starting clans (Cornelii, Valerii, Fabii, Claudii) with leaders.startingFamily.tsInitial player family (Brutus scenario).startDefinitions.tsNew-game start picker options (guided vs standard).traits.tsPersonality trait definitions + AI personality × action weight tables.glossaryTerms.tsAll InfoTap/GlossaryPopup term definitions.reputationThresholds.tsReputation tier cutoffs and unlocked actions.legacyDefinitions.tsLegacy objective definitions (milestones/bonuses).ambitionDefinitions.tsDrawable ambition definitions (conditions/rewards).assetDefinitions.tsPersonal (Domus) asset definitions.provinceDefinitions.tsItaly province list + map node coordinates.provinceAssets.tsProvincial asset definitions (7 types × 2 tiers).provinceEvents.tsGeneric province-fired events (Italy-focused for v1).provincialClients.ts12 Italy-relevant provincial client definitions.campaignEvents.tsEvent cards firing during active military campaigns.canvassingEvents.tsEvents firing during election vote-canvassing.clientNames.tsName pools for procedurally generated clients.trialActions.tsAvailable actions during a trial.

10. Utils, tests, config

src/utils/theme.ts — COLORS, FONTS, SPACING, RADIUS and other design-token constants used by virtually every component.
__tests__/ — Jest unit tests, one per engine area: engine.test.ts (resourceEngine), agendaEngine.test.ts, officeActionEngine.test.ts, officeAction.test.ts (officeActionEngine + npcConsulEngine), eventEngine.test.ts (clientEngine + eventEngine), militaryEngine.test.ts (troopEngine), romeStats.test.ts (resourceEngine + crisisEngine), reputationEngine.test.ts (reputation tiers/clamping, getClanStanding, computeReputationDelta).
app.json, babel.config.js, tsconfig.json, eas.json, package.json — Expo/RN/TS build config; edit only for tooling/dependency changes.
proxy.mjs — local dev proxy script (check contents before assuming purpose if touching networking in dev).
android/ — native Android project (Expo prebuild output); not hand-edited in normal feature work.


Quick "where do I edit?" cheatsheet
I want to...Start hereAdd a new season-end effectengine/turnSequencer.tsChange income/economy formulasengine/resourceEngine.tsAdd a new random eventdata/events.ts (+ models/event.ts if new condition/effect shape needed)Add a new office actiondata/offices.ts + engine/officeActionEngine.tsAdd a new billdata/billTemplates.tsChange crisis mathengine/crisisEngine.tsAdd a province assetdata/provinceAssets.ts + engine/assetEngine.ts/provinceEngine.tsChange military/campaign resolutionengine/campaignEngine.ts, engine/troopEngine.tsAdd a new persisted state field or store actionstate/gameStore.tsAdd a glossary termdata/glossaryTerms.tsChange save file shapestate/saveLoad.ts (update Zod schema too)Change a resource/stat's on-screen lookcomponents/shared/ResourceBar.tsx + utils/theme.tsAdd a new agenda/to-do ruleengine/agendaEngine.ts