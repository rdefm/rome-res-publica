# Rome: Res Publica — QA Audit Fix Plan (July 2026)

## How to use this document

This plan addresses everything found during a structural/architecture review of the `cursus-design` branch (the July fixes batch + Cursus Tab Visual Redesign Chunks C0–C3), plus a full baseline audit of `npx tsc --noEmit` and `npx jest` against that branch's tip. It's written in the style of the repo's other plan docs (see `cursus-visual-redesign-plan.md`) and grounded against the actual code — every item below was traced to its root cause by reading the real call sites, not inferred from the error message alone.

**Scope note:** most items here are **pre-existing**, unrelated to the Cursus redesign work itself — they predate that branch by one to several weeks (verified via `git blame`). They're included because the audit that produced this plan was asked to be fully scoped, not just Cursus-specific. Two items (Chunk A) are specific to the redesign chunks.

**Chunk order:** A and B are small and independent — do them first. C is the one item in this plan worth reading twice before touching: it's a live, currently-silent bug in two separate NPC-opposition systems. D and E are mechanical baseline cleanup, file by file. F is process, not code — no diff, just a command to run once D/E are green.

**Ground rules (matching the rest of this repo's plans):**
- Engines stay pure, UI stays logic-free — nothing here changes that; every fix is either a type-correctness fix, a dead-code removal, or a one-line rename back to an already-correct field name.
- No gameplay numbers change as a side effect. Chunk C restores behavior that was clearly *intended* (an existing, still-referenced constant-driven system), it doesn't invent new balance.
- Run `npm test` (not bare `npx jest` — see Chunk F for why that distinction matters) and `npx tsc --noEmit` after each chunk, not just at the end.

---

## Chunk A — Cursus redesign branch hygiene

**Goal:** Fix the four small issues specific to the Cursus Tab Visual Redesign chunks (C0–C3), all cosmetic-risk rather than functional bugs.

**Files to modify:** `src/utils/theme.ts`, `src/components/shared/GildedPanel.tsx`, `src/screens/CursusScreen.tsx`

1. **`theme.ts`:** `gildFrame`, `panelWood`, and `lockedText` currently restate `goldBorder`/`crimsonBlack`/`dust`'s literal hex values under new names (a documented, deliberate choice per SITEMAP.md §3b, following the existing `senatBlue`/`senateBlue` precedent). Change these three to reference the existing token directly (`export const panelWood = crimsonBlack;` or the object-literal equivalent) instead of restating the literal. Same semantic names, same "call sites read by role" goal — but a future retune of `goldBorder` now can't silently desync `gildFrame`. Zero behavior change.
2. **`GildedPanel.tsx:40`:** `backgroundColor: 'rgba(42,10,10,0.92)'` is a hand-computed restatement of `panelWood` at 92% alpha, with a comment claiming the equivalence. Compute it from the token instead (e.g. a small local `withAlpha(panelWood, 0.92)` helper, or store the alpha as its own token) so the comment's claim is enforced by code, not just asserted in a comment.
3. **`CursusScreen.tsx`'s `ElectionPanel`** (the restyled campaign panel, ~line 421) still does `const state = useGameStore();` — a full-store subscription, causing this panel to re-render on every store write anywhere in the app. This predates the branch, but the branch rewrote this component's entire body and it sits one function below `CandidateHeader.tsx`, which does the same job correctly with field-level selectors. Convert to selectors: `seasonIndex`, `campaigning`, `campaigningCharacterId`, `electionRivals`, `clans` (and whatever `calcPlayerElectionScore(state)` actually needs — check if it can take individual fields instead of the full state object; if not, that's fine, just select the fields it needs and pass a minimal object).
4. **`CursusScreen.tsx:503`:** `width: `${(c.votes / maxVotes) * 100}%` as any` — RN 0.74's own `DimensionValue` type already includes `` `${number}%` `` as a valid template-literal type (confirmed in `node_modules/react-native/Libraries/StyleSheet/StyleSheetTypes.d.ts`). The cast is unnecessary; remove `as any` and confirm `tsc` stays clean on this line.

**Done when:** `tsc --noEmit` clean on these four files' own lines (baseline noise from other files aside — see Chunk D/E), `ElectionPanel` re-renders only on the fields it actually reads (verify with React DevTools' render highlighting or a temporary render-count log), no visual change.

---

## Chunk B — `gameStore.ts` duplicate-key bugs

**Goal:** Fix two distinct, unrelated copy-paste duplications in the same file — one in the store's type, one in its initial-state object literal.

**Files to modify:** `src/state/gameStore.ts` only.

1. **Duplicate interface field** (lines 537 and 579): `lastOfficeActionResult: { actionName: string; text: string } | null;` is declared twice in the store's type, verbatim, once inside the Tribune block (~536-537) and once under its own "Office action result modal" section header (~577-579). The second location is clearly the intended one (it has its own section header; the first looks like a leftover from before that section existed). **Delete the declaration at line 536-537** (including its doc comment), keep the one at 577-579.
2. **Duplicate object-literal property** (`TS1117`, real duplicate key in `INITIAL_STATE`): `tribuneCandidateId: null,` appears twice — once at line 1264 (inside the "Chunk 1B" grouping, matching where the type declares it) and again at line 1280 (right next to `lastOfficeActionResult: null,`). Both are `null` so this has been a harmless no-op at runtime (last-write-wins), but it's exactly the kind of duplicate that silently stops being harmless the next time someone changes one copy and not the other. **Delete line 1280** (`tribuneCandidateId: null,`), keep line 1264 and the `lastOfficeActionResult: null,` that follows it at 1281.

**Done when:** `grep -c "lastOfficeActionResult:" src/state/gameStore.ts` shows exactly one interface declaration + the usual read/write call sites (not two type declarations); `tsc --noEmit` no longer reports `TS2300`/`TS1117` on this file for these two fields.

---

## Chunk C — Restore two silently-dead NPC-opposition systems (`Bill.playerProposed` vs `playerSubmitted`)

**This is the highest-value fix in this plan — read it before touching anything.**

**Goal:** Two real gameplay systems — the NPC Consul's antagonism-driven bill sabotage, and the NPC Tribune's per-season veto — have been unconditionally dead since they were written, because both were coded against a `Bill` field name (`playerProposed`) that was never added to the `Bill` model. The model's real, working, actually-populated field is `playerSubmitted`.

**Files to modify:** `src/engine/npcConsulEngine.ts`, `src/engine/turnSequencer.ts`, `__tests__/officeAction.test.ts`

### What's actually broken

- `src/models/bill.ts:24` declares `playerSubmitted?: boolean` — this is the real field. It's set consistently everywhere a bill is actually created: `resourceEngine.ts:370`, `cityEngine.ts:855/891/932`, `warEngine.ts:447/469/501/517`, `billTemplates.ts:61`. It's read correctly by `CuriaScreen.tsx:368` to show the "YOURS" badge on the player's own bills.
- `npcConsulEngine.ts:181` sets `playerProposed: false` on NPC-generated bills (a property that doesn't exist on `Bill` — silently tolerated because the object is cast `as any` right after: `patch.bills = [...state.bills, newBill as any];`). Two lines later, `npcConsulEngine.ts:192`'s antagonism-driven "sabotage a random player bill" mechanic does `state.bills.filter(b => b.playerProposed)` — since no real bill ever has this field, **`playerBills` is always `[]`, and the sabotage never fires, at any antagonism level, ever.**
- `turnSequencer.ts:137` does the same thing for the auto-generated Triumph bill (`playerProposed: false`, cast `as unknown as Bill` right after — same silent tolerance). `turnSequencer.ts:933`'s NPC Tribune veto ("When an NPC tribune is active, they veto one player-sponsored bill per season") has the identical `s.bills.filter(b => b.playerProposed)` bug — **the veto has never fired for any player, in any playthrough, since this system was written.**
- The `as any`/`as unknown as Bill` casts at both bill-construction sites are exactly what hid this from the type checker for as long as it's been broken — neither this plan nor a routine `tsc` run would have caught it without removing those casts, which is why Chunk D removes unnecessary casts like these wherever they're found to be papering over a real mismatch rather than a genuine escape hatch.

### Fix

Rename `playerProposed` → `playerSubmitted` at every site above:
- `npcConsulEngine.ts:181` (the object literal) and `:192` (the filter)
- `turnSequencer.ts:137` (the object literal) and `:933` (the filter)
- `__tests__/officeAction.test.ts:149`, `:187` (test fixtures already using the wrong name — these were written to match the bug, not the model) and `:294` (`expect(triumphBill.playerProposed).toBe(false)` → `expect(triumphBill.playerSubmitted).toBe(false)`)

This is a pure rename, zero new logic. Once fixed, the NPC Consul sabotage and NPC Tribune veto will fire under the exact conditions their own comments already describe.

### Verify before calling this done

- **This changes live game balance** for the first time since these systems were written — a hostile NPC Consul (35-50% chance depending on antagonism) will now actually reduce support on a random player bill each season, and an active NPC Tribune will now actually veto one player bill per season (−25 support). This is "fixing a bug," not "adding a feature," but it will be the first time a player experiences either mechanic. **Flag this to the user/design lead before shipping** — a mechanic that's been silently absent for the game's whole development-to-date suddenly firing is worth a heads-up, in case the rest of the game's balance was tuned assuming it doesn't happen.
- Re-run `npx jest __tests__/officeAction.test.ts` after the rename — the Triumph bill tests exercise the exact object this bug lives in.

**Done when:** `grep -rn "playerProposed" src/ __tests__/` returns nothing; a debug-panel or test-harness playthrough with an active hostile NPC Consul or NPC Tribune shows the sabotage/veto log line firing; the design lead has been told this is now live.

---

## Chunk D — Baseline `tsc --noEmit` cleanup, production files

**Goal:** Every remaining production-code (non-test) `tsc --noEmit` error, root-caused and fixed individually. None of these are related to the Cursus branch — all predate it.

**Files to modify:** `src/components/shared/ResourceBar.tsx`, `src/components/shared/LedgerBlock.tsx`, `src/data/canvassingEvents.ts`, `src/models/client.ts` (import only, no changes needed there), `src/state/gameStore.ts`, `src/engine/officeActionEngine.ts`, `src/engine/cityEngine.ts`, `src/components/shared/ParchmentCard.tsx` call sites, `src/data/campaignEvents.ts` (+ a design decision, see below)

1. **`ResourceBar.tsx:5`** imports `getCrisisColour` from `crisisEngine.ts` — that export doesn't exist and never has (`crisisEngine.ts` exports `applyTrackDelta`, `calcIndividualEscalation`, `calcCascadeDeltas`, `getNamedCrisis`, `getCrisisStatusEffects`, `checkMilitaryBillPressure` — no colour helper). The import is never referenced anywhere else in the file. **Delete the dead import line.**
2. **`LedgerBlock.tsx:38`**: `React.Children.toArray(children).some(c => c !== null && c !== false)` — `React.Children.toArray` already strips `null`/`undefined`/`boolean` children as part of its normal flattening behavior, so the returned array's element type structurally excludes `boolean`, making `c !== false` dead code that can never be false (hence the type error: comparing a type that excludes booleans to a boolean literal). Simplify to `React.Children.toArray(children).length > 0`.
3. **`gameStore.ts:39`** imports `CanvassingEventResult` from `data/canvassingEvents.ts`, but that type is only ever *constructed inline* at `gameStore.ts:5165` (`const result: CanvassingEventResult = { success, leaderName: foundLeader.name, flavour };`) — it was never actually exported from `canvassingEvents.ts`. Add `export interface CanvassingEventResult { success: boolean; leaderName: string; flavour: string; }` to `src/data/canvassingEvents.ts`, matching the shape already constructed at the one call site.
4. **`gameStore.ts:752`** references `ClientType` (the parameter type for `addClient`) without importing it — `ClientType` is a real, correctly-defined export at `src/models/client.ts:1`, just missing from `gameStore.ts`'s existing `import type { Client } from '../models/client';` on line 6. Change to `import type { Client, ClientType } from '../models/client';`.
5. **`gameStore.ts:5061`, `:5120`, `:5185`** — three `mkLog(...)` calls pass `success ? 'positive' : 'negative'` or `success ? 'positive' : 'neutral'` as the log-entry type, but `LogEntry['type']` (gameStore.ts:184) is `'good' | 'bad' | 'neutral'` — there's no `'positive'`/`'negative'` variant and never has been. Replace `'positive'` → `'good'` and `'negative'` → `'bad'` at all three call sites (the two-line diffs are in the Canvassing-support and officer-decision code paths — search for the literal strings, they're easy to find).
6. **`officeActionEngine.ts:134` and `:466`**: `(character.skills as Record<string, number>)[gate.key]` / `(char.skills as Record<string, number>)[sc.skill]` — `CharacterSkills` (`models/character.ts:18`) is a closed 3-key interface (`rhetoric`/`martial`/`intrigus`) with no index signature, so TS won't allow a direct cast to `Record<string, number>` (the two types don't structurally overlap enough for a single-step assertion). Go through `unknown` first: `(character.skills as unknown as Record<string, number>)[gate.key]`. This is the standard, safe TS pattern for exactly this situation — no behavior change, the runtime object is unaffected.
7. **`cityEngine.ts:291/294/295`**: inside `if (p.playerGovernor) { ... }`, the block reassigns `p` to a new object several times (`p = { ...p, playerGovernor: {...} }`), and each reassignment invalidates TS's narrowing of `p.playerGovernor` from the outer `if`, even though every reassignment explicitly keeps it non-null. Capture it once: right after the `if (p.playerGovernor)` check, add `const governor = p.playerGovernor;` and read `governor.turnsServed`/`governor.characterId`/`governor.corruptionAccrued` etc. throughout the block instead of re-reading `p.playerGovernor`. Cleaner and fixes the type error at its root rather than papering over it with non-null assertions.
8. **`ParchmentCard.tsx` callers in `CursusScreen.tsx:187` and `:309`**: `style={[rung.container]}` / `style={[tp.container]}` pass a single-element array to `ParchmentCard`'s `style` prop, which is typed as a plain `ViewStyle` (matching this codebase's existing convention — no other shared component in `components/shared/` uses `StyleProp<ViewStyle>`). Remove the unnecessary array wrapping at both call sites: `style={rung.container}` / `style={tp.container}`. (Don't widen `ParchmentCardProps.style` to accept arrays — that would be a new pattern inconsistent with every sibling component's prop type, for two call sites that don't actually need an array.)
9. **`campaignEvents.ts:313`** — a **design decision, not a pure type fix**. The `seize` option's `failureEffect: { relationshipDelta: -6, ... }` doesn't type-check because `CampaignEventOption.failureEffect`'s type (`campaignEvents.ts:18-22`) only has `progressDelta`/`enemyDelta`/`logMsg` — no `relationshipDelta`, unlike its sibling `successEffect` type which does have one. **But the deeper finding: this whole system appears to be dead code.** `CAMPAIGN_EVENT_DEFS`/`getCampaignEventDef` are only read by `MilitaryTab.tsx:513` to display an event card, and the only wiring for its "choose an option" callback is `ProvinciaeScreen.tsx:391`: `onResolveCampaignEvent={() => {}}` — a no-op. Nothing in the codebase ever sets a `CampaignState.activeEventId` to a real event id either (grepped, no setter found). This looks like an orphaned legacy system predating the Military Overhaul's `campaignSim.ts`/`battleEngine.ts`/`armyEngine.ts` replacement, never cleaned up. **Before touching the type, confirm with the user/design lead**: (a) if this system is confirmed dead, delete `campaignEvents.ts`, its `MilitaryTab.tsx` event-card rendering block, and the associated `CampaignState.activeEventId`/`onResolveCampaignEvent` plumbing outright, rather than fixing a type error in code nothing can reach; (b) if it's meant to be resurrected, that's new feature work (wiring a real event-trigger + resolution path) and belongs in its own plan doc, not this cleanup pass — in that case, widen `failureEffect`'s type to match `successEffect`'s as a minimal placeholder fix for now.

**Done when:** items 1–8 show zero `tsc --noEmit` errors on their file; item 9 has an explicit decision recorded (delete vs. defer-to-new-plan) before any line changes.

---

## Chunk E — Baseline `tsc --noEmit` cleanup, test files

**Goal:** The remaining test-file-only type errors, plus one test that (once Chunk F's Jest fix lands) reveals a real, currently-failing bug.

**Files to modify:** `__tests__/engine.test.ts`, `__tests__/p5e.test.ts`, `__tests__/officeAction.test.ts`

1. **`engine.test.ts`'s `makeCrisisTrack(id: string, level: number)`** (~line 15) types its first parameter as plain `string`, so every `CrisisTrack` it builds gets a widened `id: string` instead of the literal `CrisisTrackId` the real `CrisisTrack.id` field needs — this is the root cause of all ~8 `CrisisTrack`-assignability errors in this file. Change the signature to `function makeCrisisTrack(id: CrisisTrackId, level: number)`, adding `CrisisTrackId` to the existing `import type { CrisisState } from '../src/models/crisis';` line. One-line fix, resolves every occurrence in the file.
2. **`engine.test.ts:131`**: `s.family[0].officeId = 'aedile';` fails because `makeState()` (~line 34) returns an un-annotated object literal — TS infers each mock family member's `officeId` as the literal type `null` (since the fixture only ever assigns `null` to it), not the real `Character.officeId: string | null`. Add an explicit return-type cast to `makeState`: `} as unknown as GameState);` at the end of the function. This also fixes the same widening for every other field in the fixture, and matches the file's own existing convention of casting at consumption sites (`calcResourceIncome(s as any)`).
3. **`engine.test.ts:372-379`**: the inline `aggressiveChar` fixture (~line 356, in the `scoreAction`/`aiScoring` tests) is missing `heldOffices`, `corruptionScore`, `formalImperium`, `militaryImperium`, and two other fields the real `Character` type now requires — this fixture predates those fields being added to the model and was never updated. Add `as unknown as Character` to the object literal (import `Character` from `../src/models/character` if not already imported) — matching the pragmatic-cast convention the rest of this file already uses for exactly this kind of fixture staleness, rather than hand-filling six fields whose "correct" test value is arguable and not this cleanup's call to make.
4. **`p5e.test.ts:248`**: `tickSenateResponse(state)` is called with one argument, but the real signature (`senateResponseEngine.ts:99`) is `tickSenateResponse(state: SenateAwareState, characterId: string)` — the second parameter was added after this test was written. The real call site (`turnSequencer.ts:1301`) passes `playerCharacterId`; this test's `state` object doesn't carry a distinguished player id outside `family`, so pass the same literal every other test fixture in this codebase uses for the player character: `tickSenateResponse(state, 'pc-1')`.
5. **`officeAction.test.ts:293-294`**: `const triumphBill = nextState.bills.find(...)` returns `Bill | undefined`; the next line's `expect(triumphBill).toBeDefined()` is a runtime check TS has no special knowledge of, so the two lines after it (`triumphBill.name`, `triumphBill.playerProposed`) are flagged as possibly-undefined. Add a non-null assertion after the `toBeDefined()` check: `triumphBill!.name`, and rename `playerProposed` → `playerSubmitted` per Chunk C (`triumphBill!.playerSubmitted`).
6. **`officeAction.test.ts`'s `makeState()` (~line 22-75) is missing `pendingAmbitionScopes`** — a real `GameState` field (`gameStore.ts:348`, default `['family', 'character']`) that `turnSequencer.ts:1896` spreads unconditionally (`Array.from(new Set([...s.pendingAmbitionScopes, ...scopesNeeded]))`). This isn't a type error (the field is untyped/`any`-cast at the call site), it's a **currently-failing runtime bug** that only surfaces once Chunk F's Jest fix is applied — with the correct env var, all three "Triumph bill generation" tests currently throw `TypeError: undefined is not iterable` at exactly this line, rather than passing. Add `pendingAmbitionScopes: ['family', 'character'],` to the fixture (matching `gameStore.ts`'s own `INITIAL_STATE` default), inserted anywhere in the object literal (e.g. next to `dictatorOverstaySeasons: 0,`).
7. **Minor, while in this file:** `officeAction.test.ts`'s `makeState()` also has a stale `anyProvinceHasRoads: false,` field — the real field was renamed to `anyCityHasRoads` during the Province→City rename (see `gameStore.ts:553`). Harmless (nothing throws on a missing boolean flag, unlike item 6), but any test that exercises road-based logic through this fixture is silently testing against a flag that's always `undefined`. Rename to `anyCityHasRoads: false,` while touching this file for item 6.

**Done when:** `npx tsc --noEmit` reports zero errors across all three test files; `npm test __tests__/officeAction.test.ts` (see Chunk F — use `npm test`, not bare `npx jest`) shows all "Triumph bill generation" tests passing for real, not erroring out before their assertions run.

---

## Chunk F — Process: verify the test command, then gate `tsc` in CI

**Goal:** No code changes. Confirm the actual test invocation, fix CLAUDE.md's documented command to match it (already done as part of the CLAUDE.md update accompanying this plan), and, once Chunks D/E land, wire `tsc --noEmit` into CI so this list can't silently regrow.

### What was found

`package.json`'s own `"test"` script is `NODE_OPTIONS='--experimental-vm-modules' jest` — it already solves the dynamic-`import()`-inside-a-test-body pattern used in `officeAction.test.ts` (`const { processSeason } = await import('../src/engine/turnSequencer');`, done deliberately "to avoid top-level side effects" per that file's own comment). Running bare `npx jest` (which is what CLAUDE.md's "Run tests" line documents, and what this audit initially ran) skips that env var and the three dynamic-import tests fail with `A dynamic import callback was invoked without --experimental-vm-modules` — a false negative that looks like a Jest-config gap but is actually just the wrong command. **There is no Jest config bug.** CLAUDE.md's command line was wrong; see the accompanying CLAUDE.md update.

Separately, `tsc --noEmit` has its own, real, independent issue with the same three call sites: `TS1323: Dynamic imports are only supported when the '--module' flag is set to ...`. Neither this repo's `tsconfig.json` nor `expo/tsconfig.base.json` (which it extends) sets `compilerOptions.module` explicitly; with `target: "ESNext"` and no explicit `module`, TypeScript's own default lands on `module: "ES2015"` (not, as one might assume, `"ESNext"` — TS does not infer a matching `module` from `target`), and `ES2015`/`ES6` predates dynamic-`import()` support in TS's module-flag allowlist.

**Fix:** add `"module": "esnext"` to `tsconfig.json`'s `compilerOptions` (this repo's own file, not the extended base — keeps the change local and visible). This resolves the `TS1323` errors on all three call sites without touching Jest/Babel config at all.

**One thing still worth a quick look, not a blocking fix:** the "avoid top-level side effects" comment on the dynamic import implies some transitive dependency of `turnSequencer.ts` does something at module-load time that the test author wanted to avoid running for the whole test file. A brief investigation (five minutes with the debugger or a `console.trace` at module scope across `turnSequencer.ts`'s ~35 imports) would tell you whether that's still true — if it's stale caution from an earlier version of the codebase, the dynamic import (and the workaround this whole chunk exists to support) could be deleted in favor of a normal top-level `import`. Not required for this plan to be done; flagged as a fast-follow.

### Done when

- `tsconfig.json` has `"module": "esnext"`.
- `npm test` and `npx tsc --noEmit` both report zero failures/errors, repo-wide.
- `tsc --noEmit` is added to CI (or a pre-push hook) so a clean baseline can't silently reaccumulate — see the accompanying CLAUDE.md update for the durable rule this enforces going forward.
