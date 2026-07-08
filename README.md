# Rome — Res Publica

A mobile grand strategy RPG set in the Roman Republic. Manage your family's dynasty, cultivate political alliances, climb the Cursus Honorum, govern provinces, and legislate in the Curia — all while Rome faces the escalating Crisis Tracks of the Punic Wars era.

A full sitemap of the codebase (file-by-file, organized by feature) lives in `SITEMAP.md` — check there first when picking up an unfamiliar area.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React Native 0.74 / Expo ~51 (managed workflow) |
| Language | TypeScript (strict) |
| State | Zustand — single store (`src/state/gameStore.ts`) |
| Navigation | React Navigation — bottom tab navigator, 5 tabs |
| Persistence | AsyncStorage (autosave) + expo-file-system/expo-sharing (JSON export/import) |
| Validation | Zod (save file schema check) |
| Animation | React Native Reanimated (micro-interactions) · Lottie dependency present, no clips shipped yet |
| Testing | Jest (`jest-expo` preset) |

---

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- For Android: Android Studio with an emulator, or a physical device with Expo Go

### Install & run

```bash
# 1. Clone your repo
git clone https://github.com/<your-username>/rome-republic-game.git
cd rome-republic-game

# 2. Install dependencies
npm install

# 3. Start development server
npx expo start

# 4. Press 'a' to open on Android emulator, or scan QR with Expo Go on device
```

### Run tests

```bash
npm test
```

---

## Project Structure

```
rome-republic-game/
├── App.tsx                         # Root navigator, tab bar, global modals, autosave/agenda triggers
├── src/
│   ├── screens/                    # One per tab
│   │   ├── DomusScreen.tsx         # Family tab — Familias / Clientela / Patrimonium
│   │   ├── ForumScreen.tsx         # Clans & leaders tab, canvassing
│   │   ├── CursusScreen.tsx        # Cursus Honorum ladder & elections
│   │   ├── ProvinciaeScreen.tsx    # Province map & sheets (fully built, not a placeholder)
│   │   ├── CuriaScreen.tsx         # Senate, bills, Rome stats, crisis tracks
│   │   └── StartMenuScreen.tsx     # New game / continue / import save
│   ├── components/
│   │   ├── domus/                  # FamilyTree, CharacterCard(+Profile/ActionModal), Clientela/Patrimonium/Legatum panels
│   │   ├── forum/                  # ClanCard, LeaderCard/DetailPanel, PatronLadderPanel
│   │   ├── cursus/                 # ElectionPanel
│   │   ├── provinciae/             # MapView, ProvinceSheet, PolicyBoard, DiplomatDesk, MilitaryTab, asset/client cards
│   │   └── shared/                 # ResourceBar, TabBar, SeasonOverlay, AgendaTablet, EventModal, glossary system, modals
│   ├── engine/                     # Pure functions — GameState in, values/patches out. No side effects.
│   │   ├── turnSequencer.ts        # processSeason() — the season-end orchestrator, calls into most other engines
│   │   ├── resourceEngine.ts       # Fides/Denarii income, Rome stat modifiers, faction drift
│   │   ├── crisisEngine.ts         # 4-track crisis model (War / Unrest / Constitution / Economy)
│   │   ├── electionEngine.ts       # Canvassing, vote scoring, rival generation
│   │   ├── campaignEngine.ts       # Military campaign resolution, commander elections
│   │   ├── provinceEngine.ts       # Province gold/Imperium output, revolt risk, policy ticking
│   │   ├── troopEngine.ts          # Levies, veterans, attrition, effective force
│   │   ├── aiScoring.ts            # NPC weighted action scoring (Senate votes, clan leader actions)
│   │   ├── agendaEngine.ts         # GameState → to-do list shown in the Agenda Tablet
│   │   └── ...                     # trialEngine, senateResponseEngine, ambitionEngine, legacyEngine, patronEngine,
│   │                                 clientEngine, assetEngine, reputationEngine, inheritanceEngine, npcConsulEngine,
│   │                                 ambassadorEngine, eventEngine — see SITEMAP.md for the full per-file breakdown
│   ├── state/
│   │   ├── gameStore.ts            # Zustand store — single source of truth for all game state + actions
│   │   └── saveLoad.ts             # AsyncStorage autosave + Zod-validated JSON export/import
│   ├── models/                     # TypeScript types only, no logic — character, clan, office, bill, crisis,
│   │                                 province, troop, asset, client, patronLadder, ambition, legacyObjective,
│   │                                 event, trial, agenda, ledger, gameStart, resources
│   ├── data/                       # Static content arrays consumed by the matching engine/model
│   │   ├── startingFamily.ts       # Initial Brutus family
│   │   ├── startingClans.ts        # 4 starting clans (Cornelii, Valerii, Fabii, Claudii)
│   │   ├── offices.ts              # Full Cursus Honorum, all 8 offices with in-office actions
│   │   ├── events.ts               # Full random event pool; tutorialEvents.ts is the scripted-only pool
│   │   ├── billTemplates.ts        # Player-submittable + auto-injected bill templates
│   │   ├── glossaryTerms.ts        # All in-app glossary/InfoTap definitions
│   │   ├── traits.ts               # AI weight tables (personality × action)
│   │   └── ...                     # province/campaign/client/ambition/asset/legacy definitions — see SITEMAP.md
│   ├── assets/
│   │   ├── images/                 # Portraits, icons, backgrounds, map art (@1x/@2x/@3x)
│   │   └── fonts/                  # Cinzel (display font)
│   └── utils/
│       └── theme.ts                # Colour palette, fonts, spacing, radius constants
├── __tests__/                      # Jest unit tests, one file per engine area (see SITEMAP.md §10)
└── android/                        # Expo-prebuilt native Android project (not hand-edited for feature work)
```

For a complete, always-current file-by-file map (including which files are live vs. orphaned duplicates), see **`SITEMAP.md`**.

---

## Game Design

### Resources
The old per-tab Dignitas/Gratia/Gravitas split has been consolidated into two spendable resources plus two tracked scores:

| Resource | Type | Driven by | Used for |
|---|---|---|---|
| **Fides** | Spendable | Paterfamilias Rhetoric × 2 × Patron Tier multiplier, office bonus, clan relationships, clients, assets | Almost every meaningful action across all tabs — Senate votes, speeches, canvassing, diplomatic ties |
| **Denarii** | Spendable | Owned assets + province gold output | Buying assets, diplomatic dinners, provincial development, raising troops |
| **Imperium** | Tracked | Governor Security policy × governor Martial skill | Military authority; affects Senate perception, gates military actions |
| **Lifetime Dignitas** | Tracked, mostly one-way | Accumulates from actions/events | Gates Patron Tier; only catastrophic events reduce it |

Rome itself tracks three macro stats (Curia tab): **Stability**, **Plebs**, **Treasury** (each 0–100), which feed into Fides/Denarii income and crisis escalation.

### Crisis Tracks
Four independent 0–100 pressure tracks — **War, Unrest, Constitution, Economy** — each with its own escalation triggers and tiered penalties (e.g. Unrest tier 3+ risks Senate session suspension by mob action; Economy tier 2+ raises action costs 10%). Passing legislation is the primary way to reduce them. See `engine/crisisEngine.ts` and `data/glossaryTerms.ts` for exact thresholds.

### Turn sequence
1 turn = 1 season. Spring → Summer → Autumn → Winter = 1 year. Elections resolve in Winter; aging happens at year's end.

Each season: player spends Fides/Denarii across all five tabs → **End Season** → `turnSequencer.processSeason()` resolves bills, ticks crisis tracks, applies income, resolves campaigns/elections, ages the family, and produces a `SeasonLedger` diff shown in the season-transition overlay.

### Current scope (built)
- **Domus** — family tree, character actions/training, birth & naming, Domestic Directives, Clientela (patron/client network), Patrimonium (assets), Legatum (legacy objectives)
- **Forum** — 4 clans with individual leaders, all Forum actions, Patron Ladder, election canvassing (with canvassing events)
- **Cursus** — full 8-office ladder, in-office actions, election engine, corruption trials, Senate response escalation for unsanctioned levies
- **Provinciae** — province map, per-province sheets (Overview/Assets/Military/Diplomacy), governor policy (Taxation/Security/Development), military campaigns (Commander + Officer-volunteer systems), commander elections, ambassadors, provincial clients
- **Curia** — Rome macro stats, 4-track crisis panel, bill voting/speech/filibuster, bill submission
- Ambitions system (family- and character-scoped goals with rewards/consequences)
- Random + scripted tutorial event pools, Agenda Tablet (season to-do list), glossary/InfoTap system throughout
- Season-end orchestration with transition overlay, autosave, and "welcome back" recap after long absences

### Not yet built / known gaps
- Cloud save (`SaveProvider` interface exists in `saveLoad.ts`, no backend wired up)
- Lottie seasonal transition animation (dependency present, no clip shipped — plain overlay ships instead)
- A few duplicate/orphaned component files exist (`screens/WelcomeBackModal.tsx`, `components/shared/PatronLadderPanel.tsx`, `components/shared/DiplomatDesk.tsx`, `components/shared/PolicyBoard.tsx`) — see `SITEMAP.md` for which copies are actually live before editing

---

## Art Assets

Art assets live in `src/assets/images/`. Character portraits now ship for the starting family (paterfamilias, wife, son, daughter placeholders) plus map, background, icon, and ornament art; `src/assets/fonts/` ships Cinzel for display type.

File naming convention: `portrait-[name].png`, `icon-[resource].png`, `asset-[type].png`, `bg-[tab].png`. Include `@2x` / `@3x` variants alongside the base file.

---

## Save System

- **Auto-save:** runs on every End Season, and on app background/inactive (via `AppState` listener in `App.tsx`)
- **Welcome back:** if the app is foregrounded 12+ hours after last active, `WelcomeBackModal` recaps the last `SeasonLedger`
- **Manual export:** JSON file via share sheet, from the Settings modal
- **Import:** JSON file picker with Zod schema validation (`state/saveLoad.ts`)
- **Cloud save:** not implemented — `SaveProvider` interface is ready for a future backend implementation
