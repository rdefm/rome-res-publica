# Rome: Res Publica — Cursus Tab Visual Redesign Plan

## How to use this document

This plan turns the current text-heavy Cursus screen into the frescoed, gilded design shown in the approved mockup, adjusted per design review (deltas listed below). It is written in the style of the Phase 1/2 implementation plans and is intended to be handed to a fresh implementation chat **together with the actual source files per chunk**.

**Revision note (this pass):** folded in a source-grounded design review (findings below) and expanded the portrait system into its own cross-cutting chunk (C0) — portraits are now a shared, character-tied, aging asset system consumed by Cursus (this plan) and available to Domus/Forum as a fast-follow, not a Cursus-only pool.

**Scope (explicitly agreed):**
- This is a **presentation-layer redesign**. No changes to election math, polling logic, office action resolution, or the turn loop. **Per-character office history already exists** (`Character.heldOffices`) — no state addition needed for that; see Finding 1 below.
- Polling display uses **existing tracker logic only.** The mockup's "Trending Up / Stable" chips and "Needs Rhetoric/Gold" advice chips are **cut** — do not build snapshot history or advisory heuristics.
- New visual primitives are built as **reusable shared components** with new `theme.ts` tokens, intended to spread to other tabs in later phases.
- The portrait system (Chunk C0) is **shared by design, not Cursus-scoped** — it lives in `src/engine/` + `src/utils/` + `src/components/shared/`, keyed off `Character`/`ClanLeader` identity, not anything Cursus-specific. Domus's `CharacterCard.tsx` migrating onto it is a recommended fast-follow, called out where relevant, but is not required for this plan's own "done."
- All art ships behind **code fallbacks** — the screen must render acceptably with zero image assets present, so asset generation (done separately by the designer, per the manifest in this doc) never blocks the build.

**Design deltas from the mockup (deliberate; do not "fix" back toward the mockup):**
1. "COMPLETED" → **"SERVED ✓"**, and served offices remain re-runnable (show the Campaign affordance alongside the seal). "Completed" wrongly implies terminal.
2. "LOCKED" always carries a **reason**: "Locked · Min age 36", "Locked · Requires Quaestor". Never a bare label.
3. **No trend/advice chips** in polling rows (see Scope).
4. Candidate header shows **Age + skill meters only — no Dignitas.**
5. Office-card action buttons are **shortcuts** that open/scroll to the existing office action panel, shown **only on the office the viewed character currently holds.** Unheld offices show the same action names as greyed, non-interactive "powers preview" text.
6. Fresco background gets a **dark gradient scrim** (strong at top, near-opaque behind the office list) — legibility beats fidelity to the mock.

**Findings from grounding this plan against the actual code (verified this pass — treat as settled, not "verify" items):**
1. **Office history already exists.** `Character.heldOffices: OfficeId[]` (`src/models/character.ts:59`), appended at election-win time. No new field, no Zod/save migration. The original plan's "add if missing" hedge is dropped.
2. **The status logic C4 needs already exists, inline.** `OfficeRung` in `CursusScreen.tsx` (~line 195) already computes `isHeld` / `prereqMet` / `isCurrent` / `ageOk` / `isEligible`, and the badge already renders "HELD" (rename to "SERVED ✓"). `officeStatus.ts` is a lift-and-extract of this, not new logic.
3. **Candidate selection is local component state, not a store field.** `selectedCharId` (`CursusScreen.tsx:675`) is `useState` inside the screen; `FamilyMemberPicker` (line 25) takes `selected`/`onSelect` as props with predicate `family.filter(c => c.age >= 18)`. `CandidateHeader` (C2) should take the same prop shape, not look for a store field that doesn't exist.
4. **`StatBar` won't shrink into the mockup's pip meter.** It's a continuous gradient-fill bar with a stacked label-row-above-track layout (`src/components/shared/StatBar.tsx`), not an inline discrete-segment meter. `SkillMeter` (C0/C1) should be built fresh, sharing only color tokens.
5. **There's a sibling redesign's tokens already in `theme.ts`.** Lines ~12–13 and ~30–40 carry a `domus-visual-redesign-plan-v2` block (`parchment`, `parchmentBorder`, `portraitPlaceholder`, `terracotta`, `goldBorder`, `crimsonDeep`, `crimsonBlack`, plus a `senateBlue` alias comment). **Audit these for reuse before minting new gild/panel tokens** (C1) — two incompatible "gilded Roman" palettes in one app is the failure mode to avoid, and it directly undercuts this plan's own "spreads to other tabs" goal.
6. **Portraits are already real, but role-pooled, not aged, and Cursus-blind.** `src/components/domus/CharacterCard.tsx` uses always-bundled (no fallback needed) images: `portrait-paterfamilias.png`, `npc-wife.png`, `npc-son.png`, `npc-daughter.png` — one flat image per *role*, same face regardless of age. This is Finding 6 from the prior review, now the basis for Chunk C0.
7. **Leader count is 13, not ~9.** Counted directly in `src/data/startingClans.ts`: 4 clans (Cornelii, Valerii, Fabii, Claudii), 13 named leaders total.
8. **`expo-linear-gradient` is already a dependency** (`package.json`, `~13.0.2`). The original plan's flagged risk is moot — no new dependency needed for the fresco scrim.
9. **No `gender` field exists on `Character` or `ClanLeader`.** Gender is implicit from `role` (`son`/`brother`/`paterfamilias` → male; `daughter`/`sister`/`spouse` → female — the game's player character is always male paterfamilias across all three starting gentes, per the guided intro and `startDefinitions.ts`). `ClanLeader` has no gender signal at all beyond name — **verify against `startingClans.ts` names** when assigning pooled portraits to leaders (C0).
10. **`GameState.gensId: 'brutii' | 'duilia' | 'manlia'`** is the *only* player-house identity, stored once on `GameState`, not per-character — confirms the player's whole family is always one visual lineage (see C0's lineage design).

**Ground rules for the implementing chat:**
- Before writing anything, read: `src/screens/CursusScreen.tsx`, `src/components/cursus/ElectionPanel.tsx`, `src/utils/theme.ts`, `src/models/office.ts`, `src/models/character.ts`, `src/models/clan.ts`, `src/data/offices.ts`, `src/data/startingClans.ts`, `src/state/gameStore.ts` (Cursus + Office actions + gens identity sections), `src/components/shared/ParchmentCard.tsx`, `src/components/shared/StatBar.tsx`, `src/components/shared/InfoTap.tsx`, `src/components/domus/CharacterCard.tsx` (the system C0 is upgrading), and `src/engine/turnSequencer.ts` around the birth-event site (~line 2099) for C0's lineage-inheritance hook.
- **Verify, don't assume (remaining open items — narrower than before, see Findings above):**
  - How the current campaign object exposes candidate id, target office, rival list, scores, seats, seasons remaining — the redesigned panel must read the same selectors `ElectionPanel.tsx` reads today.
  - How the in-office action panel is currently rendered and gated (`active: true` offices), and its exact invocation path, before wiring shortcuts to it.
  - Whether `arrangeMarriageForum(leaderId)` (gameStore.ts) is worth threading a spouse's origin clan through for lineage purposes (C0 flags this as a nice-to-have, not required — see C0's Lineage assignment).
- Engines stay pure; UI stays logic-free. Portrait/office-status derivation lives in `src/engine/` (`portraitEngine.ts`, `officeStatus.ts`); asset `require()` registries (no logic, just lookups) are the one exception that live in `src/utils/`, matching `ParchmentCard.tsx`'s existing precedent of a directly-required asset.
- No new spendable resources; no new gameplay rules.
- Every new text label added to the UI that is a game term (SERVED, Dignitas, office names) should be `InfoTap`-wrapped where a glossary term exists.

**Chunk order:** C0 → C1 → C2 → C3 → C4 → C5. C0 (portrait system) is first and is the one chunk with real cross-tab blast radius — everything else only touches Cursus. C2, C3, C4 all depend on C1. C5 (background + polish) is last deliberately.

---

## Chunk C0 — Shared Portrait System (cross-cutting: engine + assets + component)

**Goal:** A character-tied portrait system, shared across every tab, where a given character's face **ages through life stages** and **resembles their own family/clan** — not a Cursus-only asset pool. This chunk ships the engine, the asset registry, and the `PortraitRoundel` component; wiring `CharacterCard.tsx` (Domus) onto it is a flagged fast-follow, not required here.

**Files to create:**
- `src/models/portrait.ts` (types only — `PortraitLineageId`, `PortraitAgeBand`, `PortraitGender`)
- `src/engine/portraitEngine.ts` (pure — lineage/age-band/gender/variant derivation)
- `src/utils/portraitAssets.ts` (asset registry, `require()` lookups + graceful-missing handling — supersedes the original plan's Cursus-scoped `cursusAssets.ts`)
- `src/components/shared/PortraitRoundel.tsx`

**Files to modify:** none required this chunk (Domus migration is a fast-follow, see below).

### The design problem this solves

The mockup wants portraits on the candidate header, the campaign panel's contender rows, and office-card context. The original plan treated this as "a small pooled-fallback asset problem, scoped to Cursus." It isn't: the same characters render in Domus today with flat, non-aging, role-only portraits (Finding 6). Building a second, Cursus-only pool would mean the same character can look different across tabs — worse than the status quo. This chunk builds the real thing once.

**Two axes, both character-tied:**
1. **Aging** — a character's face progresses through life stages as `character.age` climbs. Six bands: `baby` (0–2), `child` (3–9), `youth` (10–17), `adult` (18–44), `midage` (45–64), `elder` (65+). These are deliberately bracketed near existing age landmarks already used elsewhere in the codebase (18 = every eligibility gate in the game; 50/60/70/80 = `reputationEngine.ts`'s own mortality bands) so the youth→adult portrait transition lands on the same birthday that unlocks Cursus eligibility — a nice, non-arbitrary coincidence worth having.
2. **Lineage (family resemblance)** — characters belonging to the same family/clan draw from the same small pool of base faces, so siblings and cousins look related without being clones. Five lineages: `house` (the player's own dynasty — one generic lineage regardless of which of the three starting gentes is active; Brutii/Duilia/Manlia are sidegrades of the same challenge per the game's own design language, and don't need visually distinct dynasties) + one per rival clan (`cornelii` | `valerii` | `fabii` | `claudii`).

### `models/portrait.ts`

```ts
export type PortraitLineageId = 'house' | 'cornelii' | 'valerii' | 'fabii' | 'claudii';
export type PortraitAgeBand = 'baby' | 'child' | 'youth' | 'adult' | 'midage' | 'elder';
export type PortraitGender = 'm' | 'f';
```

### `engine/portraitEngine.ts` (pure)

- `ageBandFor(age: number): PortraitAgeBand` — the six cutoffs above.
- `genderFor(subject: Character | ClanLeader): PortraitGender` — for `Character`, derive from `role` per Finding 9 (paterfamilias/son/brother → `m`; spouse/daughter/sister → `f`). For `ClanLeader`, no field exists — **verify against `startingClans.ts` names/bios** and either add a lightweight lookup table in that same data file or infer from name ending as a documented best-effort (flag any ambiguous leader for the designer to confirm by name).
- `lineageFor(subject: Character | ClanLeader, ctx: { gensId?: GensId; clanId?: string }): PortraitLineageId` — a player-family `Character` (present in `GameState.family`) always resolves to `'house'`. A `ClanLeader` resolves to their own clan's id directly (already on the data structure in `startingClans.ts`). **v1 does not track a spouse's origin clan** — a spouse arranged via `arrangeMarriageForum(leaderId)` still becomes `'house'` once married in, same as one arranged via `arrangeMarriageDomus`. Threading the origin clan through (so a Cornelii bride keeps a Cornelii face) is a real, cheap-to-add nice touch flagged for a later pass — it needs one new field on `Character` (e.g. `originClanId?: string`) plus a Zod default, which is exactly the kind of schema change this plan otherwise avoids, so it's deliberately deferred rather than snuck in here.
- `variantIndexFor(id: string, variantCount: number): number` — deterministic (`hash(id) % variantCount`), same mechanic the original plan already specified for generic pooling, now scoped per-lineage instead of globally.
- `portraitKeyFor(subject, ctx): string` — composes the above into the exact asset-registry lookup key, e.g. `house-1-m-adult`, `cornelii-2-f-elder`.

### `utils/portraitAssets.ts`

Same graceful-degradation shape the original plan specified for `cursusAssets.ts` (Metro can't do dynamic `require`, so the full static list is commented in with an `ASSETS_PRESENT` switch per file, missing = `undefined` = fallback) — just renamed and generalized so it's not Cursus-branded:

```ts
export const portraitAssets = {
  portrait: (key: string) => PORTRAITS[key],   // may be undefined
  leaderOverride: (leaderId: string) => LEADER_PORTRAITS[leaderId], // optional bespoke, may be undefined
};
```

Bespoke `leader-{id}` full-image overrides (for the ~13 named leaders, if the designer wants specific faces instead of pool-only) remain optional, checked before falling back to the pooled lineage key — same idea the original plan had, now living in the shared registry.

### `PortraitRoundel.tsx`

- Props: `characterId?`, `leaderId?`, `age?` (needed alongside `characterId` since the registry key depends on it — pass `character.age`/`leader.age` directly, the component doesn't reach into the store), `size` (default 44), `frame: 'gold' | 'plain'`.
- Resolves via `portraitEngine` + `portraitAssets`. **Fallback (no asset present):** initials centered in a themed circle with a ring — must look intentional, not broken. (Exact token to ring/fill with depends on Finding 5's audit — reuse whatever the Domus redesign already established if it fits, rather than minting a parallel `panelWood`/`gildFrame` pair sight-unseen.)

### Scope guard — what this chunk does NOT do

- Does not touch `CharacterCard.tsx` or any Domus rendering. Domus keeps its current flat portraits until a separate, explicitly-scoped fast-follow chunk migrates it onto `PortraitRoundel` — flagged here, not built here, so this plan's own timeline doesn't balloon into a Domus rework.
- Does not add the spouse-origin-clan field (see `lineageFor` above).
- Does not generate art. See the revised Appendix A for the manifest and — importantly — the size of the asset ask this design implies, which is materially larger than the original plan's pool and needs a sign-off before the designer starts generating.

### Chunk C0 — Done when

`portraitEngine.ts` has full unit coverage (age-band boundaries, lineage resolution for both `Character` and `ClanLeader`, deterministic variant stability across repeated calls with the same id); `PortraitRoundel` renders correct fallbacks with zero assets present; a temporary DebugPanel preview (optional but recommended) can page through all 5 lineages × 6 age bands × 2 genders to sanity-check the matrix before any art exists.

---

## Chunk C1 — Visual primitives + theme tokens

**Goal:** All reusable visual building blocks exist and render with pure-View fallbacks. Zero behaviour change; nothing consumes them yet except a debug preview if convenient.

**Files to create:**
- `src/components/shared/FrescoBackground.tsx`
- `src/components/shared/GildedPanel.tsx`
- `src/components/shared/StatusSeal.tsx`
- `src/components/shared/SkillMeter.tsx`
- `src/utils/cursusAssets.ts` (Cursus-specific assets only now — fresco background, wax seal, office icons; portraits moved to C0's shared registry)

**Files to modify:** `src/utils/theme.ts`

### Before minting tokens: the Finding 5 audit

Read the existing `domus-visual-redesign-plan-v2` block in `theme.ts` (the `parchment*`, `portraitPlaceholder`, `terracotta`, `goldBorder`, `crimsonDeep`, `crimsonBlack` tokens) and decide, token by token, reuse vs. new before adding anything below. Where a Domus token already covers the need (e.g. `goldBorder` #8B6914 for a gild frame, `crimsonBlack`/`parchmentDark` for a wood-panel field, `dust` for locked-state text), **use it** rather than minting a near-duplicate. Only add a new token where nothing existing fits.

### `theme.ts` — new tokens (add, never rename existing; skip any row the audit above resolves via reuse)

| Token | Purpose | Suggested |
|---|---|---|
| `COLORS.gildFrame` | GildedPanel border gold | `#B8934A` (or reuse `goldBorder`) |
| `COLORS.gildFrameDark` | frame inner shadow line | `#6E5426` |
| `COLORS.rivet` | corner rivet fill | `#D9B45C` |
| `COLORS.panelWood` | dark panel field behind gilded content | `#221A12` (or reuse `crimsonBlack`/`parchmentDark`) |
| `COLORS.sealWaxGrey` | SERVED seal | `#8E8A82` |
| `COLORS.sealGold` | ACTIVE seal/chip | reuse existing gold |
| `COLORS.lockedText` | locked-state text | reuse `dust` |
| `COLORS.scrimTop` / `COLORS.scrimBottom` | fresco gradient scrim endpoints | `rgba(20,14,8,0.35)` / `rgba(20,14,8,0.92)` |

Reuse existing `FONTS` (Cinzel for display), `SPACING`, `RADIUS`. Do not introduce a new font.

### `GildedPanel.tsx`

The riveted gold-framed panel from the mockup (used by the candidate header and campaign panel).
- Props: `children`, optional `title` (Cinzel, gold, letter-spaced), optional `style`.
- Outer View with 2px `gildFrame` border + 1px inset `gildFrameDark` line, `panelWood` background at ~0.92 opacity (fresco ghosts through), `RADIUS` consistent with existing cards.
- **Rivets are pure Views:** four absolutely-positioned 10px circles at the corners, `rivet` fill with a 1px `gildFrameDark` border. No image asset.
- A dashed inner border (1px, `gildFrame` at 40% opacity) matches the mockup's stitched look — optional, drop if it renders poorly on Android.

### `StatusSeal.tsx`

- Props: `status: 'served' | 'active' | 'eligible' | 'locked'`, optional `reason?: string` (locked only), optional `sealImage` (from `cursusAssets`).
- `served`: grey chip "SERVED ✓" + wax-seal PNG at ~44px if present; without it, a pure-View circle seal (two nested circles, `sealWaxGrey`, embossed ✓).
- `active`: gold-outlined chip "CAMPAIGN ACTIVE".
- `eligible`: no chip (absence is the signal), or a subtle outline button — defer to C4, which owns the button.
- `locked`: grey chip "LOCKED · {reason}".

### `SkillMeter.tsx`

The mockup's compact labeled stat bar (`RHE 6 ▮▮▮▯▯`). Built fresh per Finding 4 — `StatBar`'s stacked layout doesn't shrink into this footprint; share color tokens only.
- Props: `label` (3-char code), `value`, `max` (skill cap is 10, confirmed in `character.ts`), `color`.
- Wrap the label in `InfoTap` when a matching glossary term exists (Rhetoric etc. — verify against `glossaryTerms.ts`).

### `cursusAssets.ts` — Cursus-only assets, same graceful-degradation shape as C0's registry

```ts
export const cursusAssets = {
  frescoBg: tryRequire('../../assets/cursus/fresco-bg.jpg'),
  waxSeal: tryRequire('../../assets/cursus/seal-wax.png'),
  officeIcon: (id: OfficeId) => OFFICE_ICONS[id],       // may be undefined
};
```

Portraits are NOT in this file — they're `portraitAssets` from C0, shared.

### Chunk C1 — Done when

App compiles and behaves identically; each new component renders correctly in isolation (temporary mount behind the existing DebugPanel is acceptable) **with zero assets present**.

---

## Chunk C2 — Candidate header carousel

**Goal:** Replace the "VIEWING [Marcus] [Livia]" chip row with the mockup's candidate header card: portrait, name, current candidacy/office line, age, skill meters, and prev/next arrows cycling eligible family members.

**Files to create:** `src/components/cursus/CandidateHeader.tsx`
**Files to modify:** `src/screens/CursusScreen.tsx`

### Behaviour

- **Population:** `family.filter(c => c.age >= 18)`, the exact predicate `FamilyMemberPicker` already uses (Finding 3) — reuse verbatim. Sorted: current campaigners first, then office-holders, then by age desc.
- **Selection state:** `CandidateHeader` takes `selected`/`onSelect` as props, same shape as the current `FamilyMemberPicker` it replaces (Finding 3 — this is local screen state, not a store field; don't go looking for one).
- **Arrows** (‹ ›) cycle with wraparound; the right edge shows the *next* member's mini roundel (via C0's `PortraitRoundel`) + name as a peek. Swipe gesture optional — arrows are the requirement.
- **Overflow fallback (design delta):** tapping the character's name opens a lightweight picker sheet listing all eligible members (roundel + name + current office). Carousels degrade past ~4 entries; the family grows.
- **Content lines:**
  - Name (Cinzel, gold).
  - Context line: "Candidate: Quaestor" if campaigning, else "Holds: Praetor (2 seasons left)" if in office (verify term-remaining source), else "Privatus" (no office).
  - "Age: 42" — **no Dignitas** (design delta).
  - Three `SkillMeter`s: RHE / MAR / INT mapped to `character.skills.{rhetoric,martial,intrigus}` (confirmed field names, `models/character.ts:18-22`).
- Wrapped in `GildedPanel`, sitting on the fresco (C5) — until C5 lands it sits on the current background, which is fine.

### Chunk C2 — Done when

Selecting via arrows changes the same underlying selection the old chips changed; campaign panel and office list react as before; picker sheet works; header renders with portrait fallbacks (and with real portraits, once C0's assets land).

---

## Chunk C3 — Campaign panel restyle

**Goal:** Restyle the existing campaign/polling block into the mockup's gilded "CAMPAIGN: QUAESTOR" panel — same data, same logic, better clothes.

**Files to modify:** `src/components/cursus/ElectionPanel.tsx` (restyle in place if it's this component; verify whether the campaign card lives here or in `CursusScreen.tsx` and restyle wherever it actually lives)

### Layout (top to bottom, per mockup)

1. Title row: "CAMPAIGN: {OFFICE}" (Cinzel gold) + right-aligned "Est. Position #{n}" chip (existing computed rank — verify source).
2. Meta row: hourglass glyph "{n} Seasons Remaining" · "{n} Seats Available" (both existing fields).
3. "Live Polling Standings" subheader.
4. One row per contender (existing rival list + player candidate, existing ordering):
   - `PortraitRoundel` (C0) — leader portrait (`leaderId`) for rivals, character portrait (`characterId`) for the player's candidate.
   - Name + sub-line (existing: gens / "Base 25 + Clients" style breakdown — keep whatever descriptor text exists today, truncated to one line).
   - Score bar (reuse `StatBar` styling; green for rivals, gold for the player, matching both current screen and mockup) + numeric score.
   - **No trend/advice chips** (design delta).
5. Whole panel wrapped in `GildedPanel`.

Player row should be visually distinguished (gold bar + slightly brighter name) exactly as both current and mock versions already imply.

### Chunk C3 — Done when

Panel shows pixel-for-pixel the same numbers/order the old panel showed across: active campaign, no campaign (panel hidden or replaced by a subtle "No active campaign — choose an office below" line, matching current behaviour — verify), election-eve, and multi-rival cases.

---

## Chunk C4 — Office cards: per-character status, seals, and action shortcuts

**Goal:** Office list cards gain per-character status (SERVED / CAMPAIGN ACTIVE / eligible / LOCKED-with-reason), an office icon, and action shortcuts for the held office. Card states re-render as the carousel selection changes.

**Files to create:** `src/engine/officeStatus.ts` (pure — a lift-and-extract of `OfficeRung`'s existing gate logic, per Finding 2, not new logic)
**Files to modify:** `src/screens/CursusScreen.tsx` (office card rendering), `src/components/cursus/` (extract an `OfficeCard.tsx` if the cards are currently inlined in the screen — recommended)

No `gameStore.ts` / `character.ts` / `saveLoad.ts` changes — Finding 1 confirmed `heldOffices` already exists.

### `officeStatus.ts` (pure)

`getOfficeStatus(character, office, gameState) → { status: 'served'|'active'|'eligible'|'locked', reason?: string }`

Extract directly from `OfficeRung`'s existing `isHeld` / `prereqMet` / `isCurrent` / `ageOk` / `noCampaignActive` computation (`CursusScreen.tsx` ~line 195) rather than re-deriving:

- `active`: this character currently holds the office **or** is the candidate in an active campaign for it (these two may warrant distinct labels: "IN OFFICE" vs "CAMPAIGN ACTIVE" — the mockup only shows the campaign case; implement both, reuse `StatusSeal` with a fifth `held` variant if cleaner).
- `served`: office id ∈ `character.heldOffices` (and not currently active). Served offices **remain runnable**: the Campaign button still renders next to the seal.
- `locked`: fails min-age or ladder-prerequisite gates — the same predicate `OfficeRung` already calls, not a duplicate. `reason` = first failing gate, human-phrased: "Min age 36" / "Requires Quaestor".
- `eligible`: everything else.

### Card layout (per mockup)

- Left: office icon (`cursusAssets.officeIcon(id)`; fallback: the office's existing emoji/glyph if one exists, else a plain roundel with the office's initial).
- Title: "Quaestor *(Quaestura)*" — English + italic Latin (Latin names exist on current cards; keep them, verify source field).
- One-line description (existing copy, truncated ~90 chars) + "Min age 30 · 4 seasons" meta line (existing fields).
- Right/overlay: `StatusSeal` per status; eligible offices show the existing **CAMPAIGN** button restyled as a gold outline chip (same handler as today's Declare Campaign).
- **Action row (held office only):** the office's actions from `offices.ts` rendered as small icon+label shortcuts ("Levy Taxes | Audit Accounts" style). Tapping **scrolls to / opens the existing office action panel** (verify how it's currently presented; if it's a section further down the screen, scroll-to + brief highlight; if a modal, open it pre-focused). Shortcuts do **not** resolve actions directly.
- **Powers preview (unheld offices):** same action names as a single greyed, non-interactive caption line ("Powers: Levy Taxes · Audit Accounts"). This teaches the ladder. Locked offices show it too, dimmer.
- Cards remain parchment (`ParchmentCard`) — the parchment-on-dark contrast against the gilded panels above is deliberate and matches both screenshots.

### Reactivity

All statuses derive from the carousel-selected character. Swiping Marcus → Livia must flip seals immediately (Marcus: Vigintivirate SERVED, Quaestor CAMPAIGN ACTIVE; Livia: her own states).

### Chunk C4 — Done when

Manual pass: a character with history shows SERVED + can still open a campaign on that office; locked cards show correct reasons at correct ages; the held office (grant one via DebugPanel) shows working shortcuts; swiping the carousel flips all card states; existing Declare Campaign and office-action flows work unchanged.

---

## Chunk C5 — Fresco background, scrim, and polish pass

**Goal:** The full atmosphere: fresco behind the top of the screen, dark scrim for legibility, spacing/typography pass, low-end-device sanity.

**Files to modify:** `src/screens/CursusScreen.tsx`, `src/components/shared/FrescoBackground.tsx` (built in C1, consumed here)

### `FrescoBackground` behaviour

- Renders `cursusAssets.frescoBg` as an absolute-fill `ImageBackground` **behind** the screen's ScrollView, with an `expo-linear-gradient` scrim (`scrimTop` → `scrimBottom` — the dependency is already present, per Finding 8, so no flag needed here).
- Scrim tuning: fresco clearly visible behind the title + candidate header (top ~35%), fading to near-opaque dark behind the office list. Test with the busiest card stack.
- **No asset present:** render the current flat dark background — identical to today.
- Static (not parallax) for v1. Parallax-on-scroll is a flagged nice-to-have, only if free.

### Polish checklist

- Title block "CURSUS HONORUM / The Path of Honour" restyled per mockup (Cinzel, larger, sits directly on fresco with scrim).
- Consistent vertical rhythm: header card / campaign panel / office list use the same `SPACING` step.
- Android check: dashed borders, gradient, and image memory (fresco jpg ≤ 400KB decoded reasonably; use jpg not png for the background).
- Verify scroll performance with 8 office cards + campaign panel + header on a low-end profile (no `ImageBackground` re-layout thrash; memoize cards on `(officeId, status)`).
- Confirm nothing regressed in the other four tabs (shared theme tokens are additive; grep for accidental renames).

### Chunk C5 — Done when

Side-by-side with the mockup, the screen reads as the same design (minus the agreed deltas); with assets deleted, the screen still looks intentional; End Season → election resolution → office grant round-trips visually correctly.

---

## Appendix A — Asset manifest (for the designer, not the implementing chat)

Cursus-only assets land in `assets/cursus/`; the shared portrait pool lands in `assets/portraits/`. The build must never depend on any of it existing.

| Asset | File | Size | Format | Notes |
|---|---|---|---|---|
| Fresco background | `fresco-bg.jpg` | ~1080×2400 (or 1024×2048), ≤ 400KB | JPG | Will be darkened by code scrim — generate at natural brightness, **do not bake in darkness**. No text, no faces in the top 30% (title sits there). |
| Wax seal | `seal-wax.png` | 160×160 | PNG, transparent | Grey/silver wax, embossed check or laurel. One asset, reused. |
| Office icons ×8 | `icon-{officeId}.png` | 192×192 | PNG, transparent | One per office id in `offices.ts` (confirmed 8: vigintivirate, quaestor, tribune, aedile, praetor, consul, censor, dictator). Suggested subjects: Vigintivirate = scroll/tabula; Quaestor = coin stack or money bag; Tribune = bench/veto hand; Aedile = amphitheatre arch or grain modius; Praetor = curule chair; Consul = fasces; Censor = census scroll + stylus; Dictator = fasces with axe. |

### Portrait pool (Chunk C0 — shared, cross-tab) — read this before generating anything

The aging + family-resemblance system means the pool is a **lineage × variant × gender × age-band matrix**, not a flat kind list. File naming: `portrait-{lineageId}-{variant}-{gender}-{ageBand}.png`.

| Axis | Values | Count |
|---|---|---|
| Lineage | `house`, `cornelii`, `valerii`, `fabii`, `claudii` | 5 |
| Variant ("a few" per family) | `1`, `2` (default — see note) | 2 |
| Gender | `m`, `f` | 2 |
| Age band | `baby`, `child`, `youth`, `adult`, `midage`, `elder` | 6 |

**Total at the default: 5 × 2 × 2 × 6 = 120 images.** This is a real jump from the original plan's ~12–18-file pool — it's the direct cost of "tied to a character, with aging and family resemblance," which is a materially bigger asset commitment than a flat pooled-fallback system. Two ways to bring the number down if 120 is too many for a first pass, in order of preference:
1. **Drop to 1 variant per lineage** (60 images) for v1 — every member of a family shares one base face per gender, aged through the six bands; add the 2nd variant later without touching any code (`variantIndexFor` already handles any `variantCount`).
2. **Collapse `baby`/`child` into one band** (`youth` stays separate since it's the pre-Cursus-eligibility stage worth seeing distinctly) — drops to 5 bands, 100 images at 2 variants or 50 at 1.

Recommendation: start at **1 variant, all 6 bands** (60 images) — the aging axis is the feature people will actually notice session-to-session as their family grows old; the variant axis (distinguishing siblings) is a nicer-to-have that's cheap to add later since nothing about the code changes.

Each of the 256×256 images: head-and-shoulders, consistent framing, one shared style reference across the *entire* pool (all 5 lineages together) so they read as "the same art style, different families" rather than five disconnected sets.

| Asset | File | Size | Format | Notes |
|---|---|---|---|---|
| Portrait pool | `portrait-{lineage}-{variant}-{gender}-{ageBand}.png` | 256×256 | PNG or JPG | See matrix above. |
| Leader portraits (optional) | `portrait-leader-{leaderId}.png` | 256×256 | PNG or JPG | 13 named leaders in `startingClans.ts` (corrected count). Bespoke override, checked before the pooled lineage key falls back — nice-to-have, the pool already covers every leader via their clan's lineage. |

**Generation style guidance (keeps a hand-authored, coherent look):**
- **Background:** "Roman fresco, Pompeiian Fourth Style, view of the Curia and Forum with togate figures, muted terracotta / ochre / umber / faded verdigris palette, aged cracked plaster texture, soft edges, no text, no modern elements."
- **Portraits:** "Roman-Egyptian Fayum mummy portrait style, encaustic on wood, head and shoulders, dark neutral background, muted earth palette" — Fayum portraits are period-authentic painted faces and AI-generate with remarkable consistency; vary age/gender per kind. For the family-resemblance axis specifically: generate each lineage's `adult` band first as the "reference face" per variant/gender, then generate the other five age bands as explicit age-progressions/regressions *of that same reference face* (most image tools do this well from a reference image + age prompt) rather than five independent generations — this is what actually produces "looks like family," not just "same style."
- **Icons:** "Bronze bas-relief icon of a single object, engraved line style, dark transparent background, no text" — monochrome bronze reads well at 32–44px and won't clash with parchment or wood panels.
- Generate everything in one session per axis with a shared style/seed reference; regenerate stragglers rather than accepting one off-palette item.

## Appendix B — Explicitly out of scope (do not build)

- Polling trend history / snapshots, advice chips, any new election heuristics.
- Dignitas in the candidate header.
- Direct-fire action buttons on office cards.
- A spouse's origin-clan lineage tracking (needs a new `Character` field — deferred, see C0).
- Migrating `CharacterCard.tsx` (Domus) onto the shared portrait system — the system is built shared, but that migration is a flagged fast-follow, not this plan's job.
- Applying the fresco/gilded language to the other four tabs (the *components* are shared and ready; the rollout is a later phase).
- Parallax, animations beyond trivial press states, new fonts, new dependencies.
