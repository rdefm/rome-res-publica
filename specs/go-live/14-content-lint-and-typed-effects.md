# Spec 14 — Content lint and typed effects

**Source:** `plans/go-live-review-and-plan.md` §4.4, workstream G · **Priority:** P1 · **Phase:** 1 — Prove (in parallel)
**Triage:** `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **Effects are pipe-delimited strings.** `EventChoice.successEffect` and `failureEffect` are `string` (`models/event.ts:39-40`). Bills and other content use the same shape. Examples: `'denarii-15|addClient:publicSupport:Refugee of Agrigentum:Klytia'`, `'crisis-war-5'`, `'setFlag:secret-burned-recently:false'`.
2. **Unknown tokens are silently dropped.** `applyEffectString` (`resourceEngine.ts:277` onward) tries a series of special-case matchers (crisis tracks, bare tokens like `continueAsCadet`, colon-parameter tokens), then falls back to `parseEffect`. `parseEffect` (`models/bill.ts:60-67`) matches `^([a-zA-Z]+)([+-]\d+)$` and **filters out anything that doesn't match**. Inside the key switch, an unknown key also falls through. So `'denari-15'` (a typo) is a silent no-op at runtime. Confirmed.
3. **Some tokens are deliberate no-ops.** For example `npcDignitas` logs "(no-op)" (`resourceEngine.ts:200`). That's intentional today but indistinguishable from a typo.
4. **Layer-rule violation:** `parseEffect` is logic living in `src/models/` (types only, per CLAUDE.md).
5. **Event references are unchecked strings:** `nextEventId`, `nextEventIdOnSuccess` and `nextEventIdOnFailure` (`models/event.ts:42-44`), plus force-injection ids. `runIdleSeasons` guards chains with a 20-step cycle cap (`gameStore.ts:1928-1942`) because cycles are possible.
6. **Partial audit exists.** `scripts/eventAudit.ts` (`npm run audit:events`) reports pool sizes, conditions, weights and an effect-magnitude fingerprint, but it's a report, not a failing check, and it doesn't validate token grammar or references.
7. `data/events.ts` is 3,734 lines.

## Problem Statement

A content writer who types `denari-15` instead of `denarii-15`, or points `nextEventId` at an event that was renamed, ships a choice that does nothing (or a chain that dead-ends) with no warning at all. With hundreds of effect strings across events, bills, office actions and secrets, the game almost certainly already contains some of these, and players experience them as choices that "didn't do anything". Nothing in the test suite would notice.

## Solution

- Define the effect-token grammar in one place (a typed registry of every token, its parameters and its handler).
- Make `applyEffectString` dispatch through that registry, so an unknown token is an error in development rather than a silent no-op.
- Add a content lint test that parses every effect string and checks every event reference across all content, failing CI on a typo.
- Optionally (a later step), let content authors use typed effect builders instead of raw strings. Strings stay supported so the 3,700-line event file doesn't need a rewrite.

## User Stories

1. As a player, I want every choice I make to do what its text says, so that the game feels trustworthy.
2. As a player, I never want an event chain to dead-end or loop, so that stories finish.
3. As a content writer, I want CI to fail with the file, event id, choice id and bad token when I mistype an effect, so that typos never ship.
4. As a content writer, I want CI to fail when `nextEventId` points to an event that doesn't exist, so that renames don't break chains.
5. As a content writer, I want to know which tokens exist and what parameters they take (generated or in one file), so that I don't have to read the resolver to write content.
6. As a content writer, I want deliberate no-op tokens marked as such in the registry, so that they aren't confused with typos.
7. As a content writer, I want the lint to detect event-chain cycles, so that the 20-step guard in the idle runner never has to fire.
8. As a content writer, I want the lint to check that flags read by conditions are written somewhere (and vice versa), so that unreachable branches are visible.
9. As a content writer, I want every terminal choice checked for `successText`/`failureText` (the event-writing guide's quality checklist §9), so that the guide's rules are enforced.
10. As a content writer (later), I want typed builders like `fx.denarii(-15)`, `fx.addClient('publicSupport', {...})`, so that the type checker catches mistakes as I type.
11. As a developer, I want `applyEffectString` to dispatch through the registry, so that adding a token means adding one registry entry.
12. As a developer, I want an unknown token at runtime to throw in dev builds and log (not crash) in production, so that bugs surface early without risking a player's run.
13. As a developer, I want `parseEffect` moved out of the models layer, so that the layer rule holds.
14. As a developer, I want the lint to cover every content source (events, war, cadet, compromising, succession, secret and Claudius-arc events, bills, office actions, munificence and city events), so that no content type is unchecked.
15. As a developer, I want `events.ts` split by theme into several files re-exported from one index, so that it's no longer one of the "edit surgically" giants.
16. As a reviewer, I want the first lint run's findings listed in the PR (each a real content bug), so that I can see what was silently broken.

## Implementation Decisions

- **Token registry (engine layer):** a const map from token name to `{ params: ParamSpec[]; apply: (state, patch, args, opts) => void; noop?: true }`. `applyEffectString` becomes: split, then parse each segment into `{ name, args }` with a single tokenizer, then look up the registry and call `apply`. The existing special-case matchers become registry entries. Behaviour for every currently valid token is unchanged.
- **Tokenizer grammar** (one place), covering the three shapes in use today: `key±N`, `name:arg:arg…` and bare `name`. Crisis tracks (`crisis-<track>±N`) are parsed explicitly.
- **Unknown tokens:** `applyEffectString` throws in `__DEV__` and tests, and logs a warning and skips in production.
- **`parseEffect`** moves from `models/bill.ts` into the engine tokenizer. Any `models/` import sites update.
- **Content lint:** a Jest suite that imports every content array and, for every effect string, asserts that it parses and that every token is registered with valid args. For every event reference, it asserts that the target id exists. It builds the event graph and asserts there are no cycles (except an explicit allowlist of intentional loops, if any). It also cross-checks flags. It reuses `eventAudit.ts`'s pool list so the two can't disagree.
- **First-run findings:** fix genuine typos in the same PR **only if** the intended token is unambiguous. Anything ambiguous is flagged for the design lead. Either way, list them in the PR, since this changes live gameplay (CLAUDE.md: a previously silent bug).
- **Typed builders (phase 2 of this spec):** `fx.*` helpers that return the same string format, so they can be adopted file by file. The resolver is unchanged.
- **Split `events.ts`** into themed files under the data layer, with an index preserving the exported `EVENT_DEFS` array and order (order affects draw weight iteration; keep it identical).

## Testing Decisions

- **Primary seam: the content lint (pure).** It runs over static data, needs no store and is the highest seam for content correctness. It runs in CI with the rest of `npm test`.
- **Seam: `applyEffectString`.** Prior art: `p5g.test.ts` already calls it directly for difficulty parity. Golden test before the refactor: for every distinct effect string in content, record the patch it produces against a fixture state, then assert identical patches after. That proves registry dispatch is behaviour-preserving.
- **Unknown-token behaviour:** throws under test, and returns an unchanged patch and warns when the production flag is set.
- **Split `events.ts`:** assert that the `EVENT_DEFS` length and the id order are unchanged.

## Out of Scope

- Rewriting existing content to typed builders wholesale.
- Changing what any valid token does.
- Event history and cooldowns (spec 09).

## Further Notes

- The `Math.random` guard from spec 05 and the selector guard from spec 13 can live in the same "repo lint" test file, so that there's one place for static checks.
