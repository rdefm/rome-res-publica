# CLAUDE.md — Rome: Res Publica

React Native / Expo mobile grand-strategy game. TypeScript throughout. Single Zustand store, five bottom-tab features (Domus, Forum, Cursus, Provinciae, Curia) sharing one turn/season loop.

**Full code map:** see `SITEMAP.md` (organized feature-first). Read the relevant feature section before editing unfamiliar areas.

## Commands

<!-- TODO: verify these against package.json scripts -->
- Run tests: `npx jest` (run affected test file(s) after any engine change; run full suite before finishing a task)
- Type check: `npx tsc --noEmit` (run after any multi-file change)
- Dev server: `npx expo start`

## Architecture — the rules that matter

- **Strict layer separation.** `src/models/` = TypeScript types only, no logic. `src/data/` = static const content, no logic. `src/engine/` = pure game logic, no React/UI imports. UI lives in `src/screens/` and `src/components/`. Never put logic in data files or state in engines.
- **All persisted state lives in `src/state/gameStore.ts`** (~2000 lines, organized in commented sections — add new fields/actions to the matching section, keep the section comments intact).
- **Any change to the save-file shape requires updating the Zod schema in `src/state/saveLoad.ts`.** No exceptions — the schema validates loads, so a missed field silently breaks saves.
- **Season-end effects go through `src/engine/turnSequencer.ts`** (`processSeason`). New "happens every season" systems get called from there and must report their deltas into the `SeasonLedger` so they show in `SeasonOverlay`/`WelcomeBackModal`.
- **Styling uses design tokens from `src/utils/theme.ts`** (`COLORS`, `FONTS`, `SPACING`, `RADIUS`). Never hardcode colors/spacing in components.
- **Player-facing game terms** should get glossary coverage: add/update entries in `src/data/glossaryTerms.ts` and wire `InfoTap` where the term appears.


## Where do I edit? (quick map)

| Task | Start here |
|---|---|
| New season-end effect | `engine/turnSequencer.ts` |
| Income/economy formulas | `engine/resourceEngine.ts` |
| New random event | `data/events.ts` (+ `models/event.ts` if new condition/effect shape) |
| New office action | `data/offices.ts` + `engine/officeActionEngine.ts` |
| New bill | `data/billTemplates.ts` |
| Crisis math | `engine/crisisEngine.ts` |
| City asset | `data/cityAssets.ts` + `engine/assetEngine.ts` / `cityEngine.ts` |
| Military/campaign resolution | `engine/campaignEngine.ts`, `engine/troopEngine.ts` |
| New persisted field or store action | `state/gameStore.ts` (+ Zod schema in `state/saveLoad.ts`) |
| Glossary term | `data/glossaryTerms.ts` |
| Save file shape | `state/saveLoad.ts` (Zod schema too) |
| Resource/stat visual | `components/shared/ResourceBar.tsx` + `utils/theme.ts` |
| Agenda/to-do rule | `engine/agendaEngine.ts` |

## Large files — edit surgically

These files are big; make targeted edits, never regenerate them wholesale:
- `state/gameStore.ts` (~2000 lines)
- `components/provinciae/CitySheet.tsx` and `MilitaryTab.tsx` (1000+ lines each)
- `data/offices.ts` (~1000 lines), `data/events.ts` (~1150 lines)

## Testing

- Jest unit tests live in `__tests__/`, one file per engine area (see SITEMAP.md §10 for the engine→test mapping).
- Any change to an engine requires updating/extending its test file; new engines get a new test file following the existing pattern.
- Tests must pass before a task is considered done. Fix failures you caused; flag (don't silently "fix") pre-existing failures.

## Do not touch unless the task is explicitly about tooling

- `android/` (Expo prebuild output — never hand-edit in feature work)
- `app.json`, `babel.config.js`, `tsconfig.json`, `eas.json`, `package.json`
- `proxy.mjs` (local dev proxy — read it before assuming its purpose)

## Workflow conventions

- **Plans → chunks:** larger features are pre-planned and split into chunks. When executing a chunk, follow its interface contract (types, function signatures, store field names) exactly — downstream chunks depend on those names.
- **End-of-task summary:** finish every task with a short note: files changed, new exports/types/store fields added, and any follow-ups. This is the handoff for the next session.
- **Keep `SITEMAP.md` current:** if you add/move/delete files, or meaningfully change a file's responsibility, update the matching SITEMAP.md section (and the cheatsheet above if relevant) in the same task.
- **No assumptions on ambiguous game-design questions** (balance numbers, UX behavior, historical flavor): ask before implementing.
- **Chat sessions (non-Claude Code):** never output full contents of the large files listed above; output only changed sections with clear "replace X in file Y" anchors.