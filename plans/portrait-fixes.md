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

## Explicitly deferred / out of scope

- **Real archetype art** (the ~60-image pool). Placeholders are the
  deliberate accepted state per the user's 2026-07-24 decision. Revisit as
  its own follow-up once art is ready — at that point, only
  `utils/portraitAssets.ts` needs new `require()` lines uncommented, by
  design.
- `genderForLeader`'s "always returns `'m'`" limitation (pre-existing,
  documented in `portraitEngine.ts`) — undisturbed by this plan.
