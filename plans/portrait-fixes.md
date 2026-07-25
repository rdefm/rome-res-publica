# Portrait System — Cross-Tab Fix Plan (July 2026)

## How to use this document

This plan grew out of Cursus Tab UI Fixes' Chunk D ("replace the initials
circle with a real portrait"). Investigating that bug report turned up a
bigger, differently-shaped gap than "Cursus needs portrait art": the shared,
tab-agnostic portrait system (`engine/portraitEngine.ts` +
`utils/portraitAssets.ts` + `components/shared/PortraitRoundel.tsx`, built
in Chunk C0 of `cursus-visual-redesign-plan.md` specifically so it would
*not* be Cursus-only) is already architected the way the user wants — but
Domus never adopted it, and Forum never got portraits at all. This is a
different unit of work than the Cursus UI bug-fix chunks (spans Domus /
Forum / Cursus, not just Cursus), so per this repo's "one branch per plan
doc" convention it gets its own branch.

**Verified findings, read before touching code:**
1. `portraitEngine.ts`/`portraitAssets.ts`/`PortraitRoundel.tsx` are already
   shared (`utils/`, `engine/`, `components/shared/`), not nested under
   `components/cursus/`. Nothing to relocate.
2. Aging is already automatic and requires no new logic: `portraitKeyFor`
   recomputes the lookup key fresh from a character's *current* `age` every
   render (via `ageBandFor`), so once art exists for a band, a character
   visibly ages into it with zero extra code.
3. New characters (births/adoptions) already get a deterministic portrait
   the instant they exist — `portraitKeyFor`/`variantIndexFor` are pure
   functions of `id`/`name`/`role`/`age`, not something generated/stored at
   creation time. Nothing to hook into.
4. The actual blocker: `portraitAssets.ts`'s `PORTRAITS` pool (the ~60-image
   archetype set: 5 lineages × 2 genders × 6 age bands) is **entirely
   commented out** — zero real archetype art exists anywhere in the repo.
5. Domus (`components/domus/CharacterCard.tsx` and
   `CharacterProfilePane.tsx`) each maintain their **own separate, fully
   duplicated** portrait logic: a hardcoded `NPC_PORTRAITS` map keyed by 4
   literal character ids (`'npc-wife'`, `'npc-son'`, `'npc-daughter'`, plus
   `isPlayer` for the paterfamilias), and their own role-based (not
   age-based) emoji fallback switch. This predates Chunk C0 and was never
   migrated onto it.
6. Those 4 ids (`pc-1` via `isPlayer`, `npc-wife`, `npc-son`,
   `npc-daughter`) are stable literals across every starting family variant
   (verified in `data/startingFamily.ts` and `data/altFamilies.ts`) — safe
   to key a bespoke override on.
7. One starting family variant (`altFamilies.ts`) also has an `npc-brother`
   with no real portrait asset today — already falls back to Domus's
   existing 🧔 emoji case. Not a regression to fix, just noting it exists.
8. `PortraitRoundel` already has a bespoke-override lookup path for
   `kind: 'leader'` subjects (`leaderOverride(id) ?? portrait(key)`) — but
   **not** for `kind: 'character'` subjects, which only ever call
   `portrait(key)`. The override mechanism exists in miniature; it just
   isn't wired up for Characters yet.
9. `PortraitRoundel` is circular-only (`borderRadius: size / 2`, plus a
   `'gold'|'plain'` ring). Domus's current portraits are **square** (80×80,
   `borderRadius: RADIUS.sm`, no ring). Migrating Domus onto `PortraitRoundel`
   as-is would silently change their shape — flagged as a real decision in
   Chunk 3, not assumed.
10. Forum (`screens/ForumScreen.tsx`) has exactly one leader-listing view —
    the canvassing panel's `allLeaders.map(...)` / `cp.leaderRow` — and it
    renders leaders as plain text with no avatar slot at all. This is new UI,
    not asset-wiring.
11. `leaderPortraitSubject`/`lineageForLeader` (for `ClanLeader`s) already
    exist and are already used by Cursus's `CandidateHeader.tsx` election
    rival list — Forum's Chunk 4 is pure reuse, no new engine code.

**Decision already made (2026-07-24, user):** real archetype art is
deliberately deferred. Placeholders — including plain emoji — are the
accepted interim state. This plan does not produce real art; it makes the
*system* correct end-to-end so dropping in real art later (uncommenting
`require()` lines in `portraitAssets.ts`) is the *only* step needed, with
zero further code changes anywhere.

**Ground rules (matching this repo's other plans):**
- Reuse and extend the existing shared system — no new tab-specific
  portrait logic anywhere.
- Styling uses `COLORS`/`FONTS`/`SPACING`/`RADIUS` tokens from
  `utils/theme.ts`.
- Run `npx tsc --noEmit` and the affected Jest file(s) after each chunk.
- No gameplay-logic changes — this is asset resolution and UI wiring only.

---

## Chunk 1 — Archetype-aware emoji fallback (shared)

**Problem:** `PortraitRoundel`'s only fallback is a flat initials-in-a-circle,
ignoring gender/age entirely. Domus's *own* emoji fallback (duplicated
in two files) is role-based, not age-based, so e.g. a character with
`role: 'son'` shows 👦 forever, even at age 60.

**Files:** `src/engine/portraitEngine.ts`, `src/components/shared/PortraitRoundel.tsx`

**Fix:**
1. Add a pure function to `portraitEngine.ts`:
   ```ts
   export function placeholderEmojiFor(gender: PortraitGender, ageBand: PortraitAgeBand): string
   ```
   A 12-entry table (2 genders × 6 age bands). Suggested mapping (placeholder
   — not precious, easy to retune):
   - `baby`: 👶 (both)
   - `child`: 👦 / 👧
   - `youth`: 👦 / 👧 (no distinct teen emoji worth the complexity; revisit if it reads oddly)
   - `adult`: 👨 / 👩
   - `midage`: 🧔 / 👩
   - `elder`: 👴 / 👵
2. **Decision to confirm before implementing:** should the emoji *replace*
   the initials glyph entirely (matching Domus's existing single-big-emoji
   style, but less individually distinguishing since many characters will
   share the same emoji), or should initials remain as a small caption
   alongside it? Recommend replacing entirely for consistency with the
   already-shipped Domus look — flagging rather than assuming.
3. Update `PortraitRoundel`'s fallback branch to compute gender/ageBand
   (via `genderForCharacter`/`genderForLeader` + `ageBandFor`, already
   exported from `portraitEngine.ts`) and render `placeholderEmojiFor(...)`
   instead of (or alongside, per the decision above) `initialsFor(...)`.

**Done when:** any `PortraitRoundel` with no resolved image asset shows a
gender/age-appropriate emoji instead of a flat initials circle — verify
across all six age bands for both genders.

---

## Chunk 2 — Bespoke per-character override (preserve Domus's real art)

**Problem:** Domus's 4 real images (`portrait-paterfamilias.png`,
`npc-wife.png`, `npc-son.png`, `npc-daughter.png`) currently live *outside*
the shared system, hardcoded separately in two Domus files. They need to
become part of the shared registry, checked before the generic archetype
pool, so they keep showing for those 4 specific characters everywhere
(including Cursus) while every other character still gets Chunk 1's
fallback.

**Files:** `src/utils/portraitAssets.ts`, `src/engine/portraitEngine.ts`,
`src/components/shared/PortraitRoundel.tsx`

**Fix:**
1. In `portraitAssets.ts`, add:
   ```ts
   const CHARACTER_PORTRAITS: Partial<Record<string, RequiredAsset>> = {
     'pc-1':          require('../assets/images/portrait-paterfamilias.png'),
     'npc-wife':      require('../assets/images/npc-wife.png'),
     'npc-son':       require('../assets/images/npc-son.png'),
     'npc-daughter':  require('../assets/images/npc-daughter.png'),
   };
   ```
   (Keying the player by literal id `'pc-1'` rather than `isPlayer`, since
   `PortraitSubject`'s `kind: 'character'` variant already carries `id` —
   no type widening needed. Verified `pc-1` is stable across every starting
   family variant, finding 6 above.)
2. Add `characterOverride(id: string): RequiredAsset | undefined` to the
   `portraitAssets` export, parallel to the existing `leaderOverride`.
3. In `PortraitRoundel.tsx`, change the `kind === 'character'` branch from
   `portraitAssets.portrait(key)` to
   `portraitAssets.characterOverride(subject.id) ?? portraitAssets.portrait(key)`
   — mirroring the existing leader lookup exactly.
4. Delete `PLAYER_PORTRAIT`/`NPC_PORTRAITS` and their `require()` lines from
   `CharacterCard.tsx` and `CharacterProfilePane.tsx` (superseded by step 1;
   full JSX migration is Chunk 3, but the dead consts can go now).

**Done when:** `PortraitRoundel` rendered with the player, wife, son, or
daughter's `characterPortraitSubject` resolves to their real image; any
other character/leader still falls through to the generic pool/emoji
fallback.

---

## Chunk 3 — Migrate Domus onto PortraitRoundel

**Problem:** `CharacterCard.tsx` and `CharacterProfilePane.tsx` each still
have their own portrait-resolution JSX and (per Chunk 2) now-dead fallback
switch statements, duplicated between the two files.

**Files:** `src/components/domus/CharacterCard.tsx`,
`src/components/domus/CharacterProfilePane.tsx`,
`src/components/shared/PortraitRoundel.tsx`

**Decision needed before implementing (finding 9 above):** `PortraitRoundel`
is circular-only; Domus's portraits are square. Three options:
1. Accept the shape change — Domus portraits become circular, matching
   Cursus's look everywhere.
2. Add a `shape?: 'circle' | 'square'` prop to `PortraitRoundel` (default
   `'circle'`, preserving Cursus's exact current look) so Domus keeps its
   square frame while sharing the resolution logic.
3. Keep Domus's own square `<Image>` JSX, and *only* swap its data source to
   `portraitAssets`/`portraitEngine` (no `PortraitRoundel` reuse) — least
   visual risk, least code consolidation.

Recommend option 2 (real reuse, no forced look change) — confirm with user
when starting this chunk.

**Fix (assuming option 2; adjust if a different option is chosen):**
1. Add `shape?: 'circle' | 'square'` to `PortraitRoundelProps`; square mode
   skips `borderRadius: size / 2` on `dim`.
2. Replace `CharacterCard.tsx`'s `portraitWrap`/`portrait`/
   `portraitFallback` block with
   `<PortraitRoundel subject={characterPortraitSubject(character)} size={80} shape="square" frame="plain" />`.
3. Same for `CharacterProfilePane.tsx`'s `profileHeader` portrait block.
4. Remove the now-fully-dead emoji-switch statements and any leftover
   styles (`portraitFallback`, etc.) from both files.

**Done when:** neither Domus file contains its own portrait-resolution or
fallback logic; the 4 starting characters show identical art to before
(via Chunk 2's override); any other character (e.g. a newly-born child)
shows Chunk 1's emoji fallback instead of the old static role emoji.

---

## Chunk 4 — Forum: portrait avatars on clan-leader rows

**Problem:** user wants NPCs from other families visible too. Forum's only
leader list (`ForumScreen.tsx`'s canvassing panel) renders leaders as plain
text with no avatar.

**Files:** `src/screens/ForumScreen.tsx`

**Fix:**
1. Import `PortraitRoundel` and `leaderPortraitSubject` (already used this
   exact way by `CandidateHeader.tsx` in Cursus — pure reuse).
2. In the `allLeaders.map(leader => ...)` render, add
   `<PortraitRoundel subject={leaderPortraitSubject(leader, leader.clanId)} size={40} frame="plain" />`
   inside `cp.leaderRow`, before `cp.leaderInfo`.
3. Check `cp.leaderRow`'s current flex layout before assuming — adjust
   (likely just a `marginRight` on the new avatar) so it doesn't break the
   existing name/meta/relationship-score/button layout.

**Done when:** every canvassable leader row shows a portrait avatar (an
archetype emoji in practice, since none of Chunk 2's overrides apply to
rival-clan leaders) to the left of the existing text, with no layout
regression to the row's existing tap targets.

---

## Chunk 5 — Verification

- `npx tsc --noEmit` / `npm test` after each chunk above.
- Visual check (device or `run` skill) for:
  - Domus: the 4 starting characters keep their real portraits; any other
    family member (e.g. a child born mid-game) shows an age/gender-correct
    emoji, not the old static role emoji.
  - Forum: canvassing leader rows show avatars without breaking the
    existing layout.
  - Cursus: unaffected — should show the same emoji fallback change
    automatically, since it already consumes `PortraitRoundel`.
- Confirm no regression to Cursus's existing `CandidateHeader`/election
  rival portraits (Chunk 1 changes shared fallback code they already use).

---

## Chunk 6 — Clan archetype-group variant assignment (2026-07-25, own branch)

**Context:** the first real archetype art landed — 3 male "archetypes" for
Cornelii (12 images: 3 variants × 4 age bands — `child`/`adult`/`midage`/
`elder`; `baby`/`youth` uncovered). User wants each Cornelii leader
permanently assigned to one archetype (e.g. Rufus always renders variant B
as he ages), with no two leaders sharing an archetype until every archetype
in the group has been handed out once (then a fresh cycle, reshuffled, so
repeats aren't back-to-back). This is a different unit of work from Chunks
1–5 (new persisted state + a save-schema addition + hooks into 3 separate
character/leader creation paths), so it landed on its own branch
(`portrait-variant-groups`) off `main`, per this repo's one-branch-per-
plan-doc convention — Chunks 1–5 were already merged to `main` before this
started.

**Verified findings:**
1. "Archetype" is exactly the existing **variant** concept
   (`variantIndexFor`/`portraitKeyFor`'s `{lineage}-{variant}-{gender}-
   {ageBand}` key) — no new concept needed, just a new *assignment*
   mechanism (persisted + no-repeat, instead of the existing pure id-hash).
2. `Math.random()` inside engine functions is already this codebase's norm
   for "roll once, bake the result into the entity" (`electionEngine.ts`,
   `inheritanceEngine.ts`'s `suggestChildName`/`generateSpouse`) — using it
   in `assignPortraitVariant` isn't a new pattern.
3. `ClanLeader`s are a **fixed static roster** from `data/startingClans.ts`
   with one real exception: `reputationEngine.generateSuccessor` (called
   from `ageAndProcessMortality`, wired into `turnSequencer.ts`'s Winter→
   Spring rollover) procedurally creates a brand new `ClanLeader` when one
   dies. This is a real runtime creation path that needed its own hook —
   easy to miss from a `clan.leaders.push` grep alone (it replaces the dead
   leader in-place via `.map`, never pushes).
4. Family `Character`s are created at 3 points: `startGame` (initial
   roster), `gameStore.confirmBirthNaming` (births), and `turnSequencer.ts`'s
   passive remarriage check (`generateSpouse`) — all 3 needed the hook.
5. `saveLoad.ts`'s `SaveSchema` validates `family`/`clans` very loosely
   already (`family` only checks `id`/`name` per entry; `clans` is
   `z.array(z.any())`), and `SaveSchema.parse()`'s return value is discarded
   — `load()` returns `parsed as GameState` (the raw JSON) instead. So
   `Character.portraitVariant`/`ClanLeader.portraitVariant` needed no schema
   change at all; only the new top-level `portraitVariantCycles` field did
   (mirroring `familyReputations`'s existing `z.record(...).default({})`
   shape).
6. `gameStore.ts` already imports `turnSequencer.processSeason` (for
   `endSeason`), so `turnSequencer.ts` importing a *value* back from
   `gameStore.ts` would be circular. The assignment composition helper
   (`portraitAssets.assignVariant`) therefore lives in `utils/
   portraitAssets.ts` — already a dependency-free leaf both files can import
   — not in `gameStore.ts` or `engine/portraitEngine.ts` (which deliberately
   has no knowledge of which asset files exist).

**Decisions made (user, 2026-07-25):**
- Reset behavior: once every variant in a lineage+gender group has been
  assigned, **reshuffle a fresh cycle** (no immediate repeats), not
  unconstrained random.
- Scope: applies to **all lineages**, including `house` — any family member
  without one of the 4 bespoke overrides (a newly-born child, a remarried-in
  spouse, `altFamilies.ts`'s `npc-brother`) also gets a real, persisted,
  no-repeat-until-exhausted archetype assignment, not just rival clan
  leaders. (House lineage has no real archetype art yet, so this is
  currently inert for house characters — falls to Chunk 1's emoji exactly
  as before — but the assignment/persistence machinery is identical either
  way, so it needed no separate code path.)
- Archetype mapping: **3 archetypes within Cornelii's group** (not 1
  archetype each across 3 different clans). Valerii/Fabii/Claudii stay on
  the Chunk 1 emoji fallback until more art lands.

**Fix:**
1. `models/character.ts` / `models/clan.ts`: added `portraitVariant?:
   number` to `Character`/`ClanLeader` — absent means "not yet assigned"
   (old saves), `portraitKeyFor` falls back to the pre-existing id-hash in
   that case.
2. `engine/portraitEngine.ts`:
   - `PortraitSubject`'s both variants gained `portraitVariant?: number`;
     `characterPortraitSubject`/`leaderPortraitSubject` now pass it through.
   - `portraitKeyFor` prefers `subject.portraitVariant` over the id-hash
     when present (signature unchanged otherwise — fully backward
     compatible with every existing call site/test).
   - New pure `assignPortraitVariant(usedThisCycle, variantCount)`: picks a
     variant not yet in `usedThisCycle`; once exhausted, reshuffles fresh
     (returns just the new pick as the cycle's first entry).
3. `utils/portraitAssets.ts`:
   - `VARIANT_COUNTS` map (`'cornelii-m': 3`, default `1` for everything
     else via `DEFAULT_PORTRAIT_VARIANT_COUNT`) plus `variantCountFor`.
   - `assignVariant(lineage, gender, cycles)` — the single composition
     entry point every creation site calls; defaults `cycles` to `{}` since
     plenty of test fixtures build a partial `GameState` predating this
     field (a real bug caught by the full suite run — `s.portraitVariantCycles`
     arriving as `undefined`, not just missing a key, crashed on `cycles[key]`).
   - The 12 real Cornelii files uncommented in `PORTRAITS`.
4. `state/gameStore.ts`:
   - New `portraitVariantCycles: Record<string, number[]>` field (default
     `{}`), keyed `${lineage}-${gender}`.
   - `startGame`: assigns a variant to every starting Cornelii leader and
     any starting-family member without a bespoke override.
   - `confirmBirthNaming`: assigns a variant to the new child.
5. `engine/turnSequencer.ts`:
   - Passive remarriage check: assigns a variant to the new spouse.
   - Leader-mortality block: after `ageAndProcessMortality`, looks up the
     newly-generated successor by `death.successorId`/`death.clanId` and
     assigns it a variant (kept out of `reputationEngine.generateSuccessor`
     itself, so that engine file stays fully decoupled from the portrait
     system).
6. `state/saveLoad.ts`: added `portraitVariantCycles: z.record(z.string(),
   z.array(z.number())).default({})`.
7. Tests: `__tests__/portraitEngine.test.ts` (a `portraitKeyFor` case for
   the stored-variant-wins path, plus a full `assignPortraitVariant`
   describe block) and a new `__tests__/portraitAssets.test.ts`
   (`variantCountFor`/`assignVariant`, including the undefined-cycles
   defensive case).

**Done when:** every starting Cornelii leader shows one of the 3 archetypes
consistently as they age; no two Cornelii leaders share an archetype until
all 3 have been used at least once; a newly-generated Cornelii successor
gets its own assignment; `npx tsc --noEmit` and `npm test` are clean
(matching Chunks 1–5's pre-existing baseline — 3 unrelated failures in
`officeAction.test.ts`).

---

## Explicitly deferred / out of scope

- **Remaining archetype art** (Cornelii's male `baby`/`youth` bands; any
  archetype art for Valerii/Fabii/Claudii/house; female archetypes
  anywhere). Chunk 6 makes the *assignment system* correct end-to-end for
  any lineage+gender group — dropping in more art is just more `require()`
  lines in `portraitAssets.ts` plus a `VARIANT_COUNTS` entry, by design, no
  further code changes.
- `genderForLeader`'s "always returns `'m'`" limitation (pre-existing,
  documented in `portraitEngine.ts`) — undisturbed by this plan.
