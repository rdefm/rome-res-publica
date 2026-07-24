# CLAUDE.md — Rome: Res Publica

React Native / Expo mobile grand-strategy game. TypeScript throughout. Single Zustand store, five bottom-tab features (Domus, Forum, Cursus, Provinciae, Curia) sharing one turn/season loop.

**Full code map:** see `SITEMAP.md` (organized feature-first). Read the relevant feature section before editing unfamiliar areas.

## Commands

- Run tests: `npm test` (**not** bare `npx jest`) (run affected test file(s) after any engine change; run full suite before finishing a task). `npm test` sets `NODE_OPTIONS='--experimental-vm-modules'` — some tests use a dynamic `import()` inside the test body, which fails with a false-negative error under bare `npx jest`. If you need to run a single file directly with `npx jest <path>`, prefix the same env var.
- Type check: `npx tsc --noEmit` (run after any multi-file change). **This must show zero errors before a task is done.** If it doesn't, on a fresh checkout, that's a regression to fix or flag immediately — don't assume the errors are pre-existing noise (see the July 2026 QA audit, `qa-audit-fix-plan.md`, for a case where 25+ accumulated pre-existing errors made this command useless as a signal for weeks).
- Dev server: `npx expo start`

## Architecture — the rules that matter

- **Strict layer separation.** `src/models/` = TypeScript types only, no logic. `src/data/` = static const content, no logic. `src/engine/` = pure game logic, no React/UI imports. UI lives in `src/screens/` and `src/components/`. Never put logic in data files or state in engines.
- **All persisted state lives in `src/state/gameStore.ts`** (~2000 lines, organized in commented sections — add new fields/actions to the matching section, keep the section comments intact).
- **Subscribe to the store with field-level selectors, not the whole state.** `useGameStore(s => s.family)`, not `const state = useGameStore();` — a bare, unselected call re-renders the component on *any* store write anywhere in the app, not just the fields it reads. This matters more here than in most codebases: the store is a single ~2000-line object covering all five tabs, so an unselected subscription in one tab's component re-renders on unrelated writes from every other tab. If you're touching a component that already does this, fix it while you're in there rather than leaving it for the next person.
- **Any change to the save-file shape requires updating the Zod schema in `src/state/saveLoad.ts`.** No exceptions — the schema validates loads, so a missed field silently breaks saves.
- **Season-end effects go through `src/engine/turnSequencer.ts`** (`processSeason`). New "happens every season" systems get called from there and must report their deltas into the `SeasonLedger` so they show in `SeasonOverlay`/`WelcomeBackModal`.
- **Styling uses design tokens from `src/utils/theme.ts`** (`COLORS`, `FONTS`, `SPACING`, `RADIUS`). Never hardcode colors/spacing in components.
- **A new token that's semantically-the-same-value as an existing one must reference it, not restate the literal.** `export const gildFrame = goldBorder;`, never `gildFrame: '#8B6914', // = goldBorder`. A restated literal drifts silently the next time someone retunes the original — the comment claims equivalence, the code doesn't enforce it. This applies to any "same color, different semantic name for a different tab/context" token, which will keep coming up as more tabs get themed passes.
- **Player-facing game terms** should get glossary coverage: add/update entries in `src/data/glossaryTerms.ts` and wire `InfoTap` where the term appears.
- **A type assertion (`as X`) that papers over a real structural mismatch is a bug waiting to surface, not a shortcut.** If two types don't overlap enough for TypeScript to allow a direct cast, that's usually telling you something (a stale field name, a model that grew and left an old fixture behind) — go through `as unknown as X` only after confirming the mismatch is genuinely fine, not to make a real error disappear. (`Bill.playerProposed` vs. the real `Bill.playerSubmitted` field sat behind exactly this kind of cast for the NPC Consul and NPC Tribune's opposition logic, silently disabling both systems since they were written — see `qa-audit-fix-plan.md` Chunk C.)


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
- Run tests with `npm test`, not bare `npx jest` — see Commands above.
- `npx tsc --noEmit` should be zero-error on `main` at all times. If a change is going to leave it non-clean even temporarily, say so explicitly in the task's end-of-task summary rather than letting it slide — this is the difference between "tsc is a real signal" and "tsc is 25 lines of noise nobody reads," and the latter is much easier to slide into than out of.

## Do not touch unless the task is explicitly about tooling

- `android/` (Expo prebuild output — never hand-edit in feature work)
- `app.json`, `babel.config.js`, `tsconfig.json`, `eas.json`, `package.json`
- `proxy.mjs` (local dev proxy — read it before assuming its purpose)

(`tsconfig.json`/`package.json` changes that are themselves the explicit task — e.g. adding an explicit `module` compiler option, fixing a documented script — are tooling work and fine; this rule is about not touching them as an incidental side effect of unrelated feature work.)

## Branching & PRs

- **One branch per plan doc.** If a plan doc (see below) covers one coherent unit of work, its implementation gets its own branch/PR. Don't land an unrelated bug-fix batch and a feature redesign on the same branch just because they happened to be worked on back-to-back — it makes `git bisect`, review, and rollback all harder than they need to be. If you're mid-branch and realize you're about to start a second, unrelated plan doc's work, that's the signal to branch off first.
- A branch that fixes a real, previously-silent gameplay bug (not just a type error or dead code) should say so plainly in its PR description or commit message — "this was silently disabled before, here's what changes now that it isn't" — not bury it in a list of type fixes. Reviewers and the design lead need to be able to tell "cosmetic cleanup" apart from "the game now behaves differently" at a glance.

## Workflow conventions

- **Plans → chunks:** larger features are pre-planned and split into chunks. When executing a chunk, follow its interface contract (types, function signatures, store field names) exactly — downstream chunks depend on those names.
- **Ground every plan doc against the actual code before writing the rest of it.** The strongest plans in this repo (`cursus-visual-redesign-plan.md`, `July-fixes-plan.md`) open with a numbered list of verified findings — "X already exists at file:line, doesn't need adding," "the bug report's assumed root cause is wrong, the real one is Y" — written *after* reading the real files, not assumed from the bug report or feature request alone. Keep doing this. A plan that hedges "verify this" on something a five-minute grep would have settled is a plan that wasn't grounded yet.
- **When a plan or implementation pass turns up something unrelated but real** (an orphaned/dead system, a silently-broken mechanic, a duplicate field) — name it explicitly and say what you did about it (fixed here / flagged as a separate follow-up / needs a design-lead decision), rather than either silently fixing it out-of-scope or silently ignoring it. `qa-audit-fix-plan.md` Chunk D's `campaignEvents.ts` item is the template: found dead code while fixing a type error, stopped, and asked before deleting or resurrecting it.
- **End-of-task summary:** finish every task with a short note: files changed, new exports/types/store fields added, and any follow-ups. This is the handoff for the next session.
- **Keep `SITEMAP.md` current:** if you add/move/delete files, or meaningfully change a file's responsibility, update the matching SITEMAP.md section (and the cheatsheet above if relevant) in the same task.
- **No assumptions on ambiguous game-design questions** (balance numbers, UX behavior, historical flavor): ask before implementing. This extends to any fix that changes live gameplay behavior, even if the "fix" is just correcting an obvious bug — a mechanic that's been silently absent since it was written changes what a player experiences the moment it's fixed, which is a design-relevant fact, not just an engineering one.
- **Chat sessions (non-Claude Code):** never output full contents of the large files listed above; output only changed sections with clear "replace X in file Y" anchors.
