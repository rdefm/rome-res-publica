# Rome — Res Publica

A mobile grand strategy RPG set in the Roman Republic. Manage your family's dynasty, cultivate political alliances, climb the Cursus Honorum, and legislate in the Curia — all while Rome faces the existential crisis of the Punic Wars.

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | React Native / Expo (managed workflow) |
| Language | TypeScript (strict) |
| State | Zustand |
| Navigation | React Navigation — bottom tab navigator |
| Persistence | AsyncStorage (save data) + expo-file-system (JSON export/import) |
| Validation | Zod (save file schema check) |
| Animation | React Native Reanimated (micro-interactions) · Lottie placeholder |
| Testing | Jest |

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
├── App.tsx                         # Root navigator, tab bar
├── src/
│   ├── screens/
│   │   ├── DomusScreen.tsx         # Family / Dignitas tab
│   │   ├── ForumScreen.tsx         # Clans & leaders / Gratia tab
│   │   ├── CursusScreen.tsx        # Cursus Honorum / elections
│   │   ├── CuriaScreen.tsx         # Senate & legislation / Gravitas tab
│   │   └── ProvinciaeScreen.tsx    # Placeholder (v3)
│   ├── components/
│   │   ├── domus/                  # CharacterCard, ActionModal, DirectivesTray
│   │   ├── forum/                  # (inline in ForumScreen for now)
│   │   ├── cursus/                 # (inline in CursusScreen for now)
│   │   ├── curia/                  # (inline in CuriaScreen for now)
│   │   └── shared/                 # ResourceBar, SeasonOverlay, EndSeasonButton, StatBar
│   ├── engine/
│   │   ├── resourceEngine.ts       # Income formulas, crisis penalties, Rome stats
│   │   ├── crisisEngine.ts         # Crisis level → narrative text
│   │   ├── aiScoring.ts            # NPC weighted scoring system
│   │   ├── electionEngine.ts       # Rival generation, vote projection, election resolution
│   │   └── turnSequencer.ts        # Full season end orchestration
│   ├── state/
│   │   ├── gameStore.ts            # Zustand store — single source of truth
│   │   └── saveLoad.ts             # AsyncStorage + JSON export/import
│   ├── models/
│   │   ├── character.ts
│   │   ├── bill.ts
│   │   ├── clan.ts
│   │   ├── office.ts
│   │   └── resources.ts
│   ├── data/
│   │   ├── startingFamily.ts       # Brutus family scenario
│   │   ├── startingClans.ts        # 4 starting clans (Cornelii, Valerii, Fabii, Claudii)
│   │   ├── offices.ts              # Full Cursus Honorum, all 8 offices with actions
│   │   ├── billTemplates.ts        # Player-submittable + auto-injected bill templates
│   │   └── traits.ts               # AI weight tables (personality × action)
│   ├── assets/
│   │   ├── images/                 # portrait-paterfamilias.png (@1x/@2x/@3x)
│   │   └── lottie/                 # (drop Lottie JSON here for season transition)
│   └── utils/
│       └── theme.ts                # Colour palette, fonts, spacing constants
└── __tests__/
    └── engine.test.ts              # Jest unit tests for engine functions
```

---

## Game Design

### Resources
| Resource | Tab | Skill Driver |
|---|---|---|
| Dignitas | Domus | Auctoritas |
| Gratia | Forum | Intrigus |
| Denarii | Cursus (spend-only) | — |
| Gravitas | Curia | Rhetoric |

### Turn sequence
1 turn = 1 season. Spring → Summer → Autumn → Winter = 1 year.

Each season: player spends resources across tabs → End Season → bills resolve, crisis updates, income applied, family ages.

### v1 scope (built)
- Domus tab — family tree, training, Domestic Directives
- Forum tab — 4 clans, individual leaders, all Forum actions, election canvassing
- Cursus tab — full 8-office ladder, in-office actions for Quaestor / Aedile / Consul, election engine
- Curia tab — Rome stats, crisis panel, bill voting/speech/filibuster, submit bills
- Season end orchestration with overlay
- AI scoring for NPC Senate behaviour

### Deferred to later versions
- Provinciae tab — province map, Squeeze Slider, Imperium resource
- Tribune / Praetor / Censor / Dictator active mechanics
- Clientela system (patron/client networks)
- Cloud save
- Full historical crisis roster
- Expanded trait set and AI memory system
- Lottie seasonal transition animation (placeholder overlay ships)

---

## Art Assets

Place art assets in `src/assets/images/`. The `portrait-paterfamilias.png` asset (and `@2x`/`@3x` variants) ships with the project for Marcus Brutus. Other characters currently use emoji placeholders.

File naming convention: `portrait-[name].png`, `icon-[resource].png`, `sigil-[clan].png`, `bg-[tab].png`. Include `@2x` and `@3x` variants in the same folder.

See `Rome_game_build_plan-1.md` Section 11 for full art asset specifications.

---

## Save System

- **Auto-save:** runs on every End Season
- **Manual export:** JSON file via share sheet (future: Settings screen)
- **Import:** JSON file picker with Zod schema validation
- **Cloud save:** deferred to v2 — `SaveProvider` interface is ready for a Supabase implementation
