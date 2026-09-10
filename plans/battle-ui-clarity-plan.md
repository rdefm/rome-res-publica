# Rome: Res Publica — Battle Screen Visual Clarity Plan

## How to use this document

This plan redesigns the live round-resolution view of a set-piece battle (`BattlefieldView.tsx`, what the player sees between "Resolve Round" taps) so it reads as an actual top-down battle plan — labeled unit rectangles instead of unlabeled color chips, and explicit strength/morale meters instead of a single ambiguous tug-of-war bar. It does **not** touch battle math, formations, or any `src/engine/battle/*` logic. It is written in the style of the repo's other visual-redesign plans (`cursus-visual-redesign-plan.md`) and is meant to be handed to an implementation chat together with the source files each chunk names.

**Origin:** a player screenshot of Round 1 of a sandbox battle, where the meaning of the bars/blocks/colors wasn't recoverable from the screen alone. See "The actual clarity problem" below for the specific root cause found in the code.

**Scope (explicitly agreed):**
- **Presentation-layer only.** No changes to `clashEngine.ts`, `battleEngine.ts`, `battleAi.ts`, or any balance numbers. `BattleState`/`WingState`/`BattleUnit` shapes are read, not extended (see Finding 3 — no new state needed for a per-unit strength bar; per-unit morale genuinely doesn't exist and isn't being added, see Open Question 1).
- Reworks `BattlefieldView.tsx` (the animated default view). `LaneCard.tsx` (the "Dispatches" text fallback) is **not** in scope — it's already unambiguous (`"Legionary 82%"`, a labeled morale bar, text badges) and isn't what the screenshot shows; see Finding 1.
- `DeploymentBoard.tsx` picking up the same rectangle-and-label visual language is a flagged fast-follow (Chunk BU2), not required for this plan's own "done."

---

## The actual clarity problem (grounded findings, verified this pass)

1. **The screenshot is `BattlefieldView.tsx`, not `LaneCard.tsx`.** `BattleScreen.tsx`'s `BattleLive` defaults to `<BattlefieldView>` and only swaps to `LaneCard`'s grid when the player taps "Dispatches" (`BattleScreen.tsx:170-172`). `LaneCard.tsx` is already fine — it's a plain labeled list (`CLASS_LABEL[u.unitClass]` + `%`, a formation name, a numeric morale value). The confusion is entirely in the animated view.

2. **The big lane bar's color and the morale bars' color mean two unrelated things, using the same visual language.** In `BattlefieldView.tsx`:
   - The morale rows (`YOU` / `ENEMY`, lines 170-175 and 198-203) are colored by **fixed side identity**: `COLORS.laurel` for you, `COLORS.crimson` for the enemy, always.
   - The big bar between them (`frontTrack`, lines 177-181) is colored by **`dominantColor()`** (lines 34-41): it picks whichever `CLASS_COLOR` (from `animations.ts:38-45`) has the most combined strength on each side — e.g. gold for legionary-heavy, olive-green for spear-heavy. This is **not** a side color and has nothing to do with who's winning; it's coincidence whether it looks "friendly" or not. A player who just read green=you/red=enemy on the morale bars has no reason to expect the big bar's green to mean "enemy fields mostly spearmen."
   - The same `CLASS_COLOR` palette, still with no on-screen legend anywhere in the app, is reused a third time for the unit chips (`chipsRow`, lines 183-196) — six colors (`#c9a84c` gold, `#8a9a6a` olive, `#a89060` tan, `#8b1a1a` dark red, `#c07030` orange, `#6a3d8f` purple) with no key. This is the direct cause of "what do the blocks and colors mean."

3. **Per-unit strength already exists as data; per-unit morale does not.** `BattleUnit.strength` (`models/battle.ts:35`) is 0-100 and tracked per unit — a real "health bar" per unit rectangle is free to build. `moralePool` (`models/battle.ts:105`) lives on `WingState`, one value shared by every unit in that wing — there is no per-unit morale to show. See Open Question 1 for how this plan resolves "a bar above each unit/wing" against that.

4. **Unit-class labels are already written three times, independently, and never exported.** `CLASS_LABEL` exists verbatim in `LaneCard.tsx:16-23` and `DeploymentBoard.tsx:27-30` (`{ legionary: 'Legionary', spear_foot: 'Spear', ... }`); `BattlefieldView.tsx`/`animations.ts` has the color half (`CLASS_COLOR`) but no label half at all. Chunk BU0 below consolidates this into one shared source rather than writing a fourth copy for the new legend.

5. **No glossary coverage for the terms this screen foregrounds.** Checked `glossaryTerms.ts`'s ~52 entries: only `veterancy` and `war score` brush against battle. Morale, the five formation names (`line`/`wedge`/`shield_wall`/`open_ranks`/`feigned_retreat`), and the six unit classes have no `Tabularium`/`InfoTap` entries. Per CLAUDE.md ("player-facing game terms should get glossary coverage"), adding these belongs in this pass since the redesign is what's putting them on screen in the first place — not a separate follow-up.

6. **Animation attachment point.** `animations.ts`'s one-shot effects (`playShake`/`playScatter`/`playArc`/`playZigzag`/`playRearwardSlide`/`playFeintDash`) are applied today as a single transform on each side's *whole chip group* (`ownBlockStyle`/`enemyBlockStyle`, `BattlefieldView.tsx:152-159`), not per-chip. Recommendation (Open Question 3): keep that attachment point — the redesigned rectangles replace what's *inside* the group, the group-level transform and all of `animations.ts`'s trigger functions are untouched. This keeps the blast radius to `BattlefieldView.tsx`'s own render/styles.

---

## Open design questions (for you to confirm before BU1 is implemented — flagging per CLAUDE.md's "no assumptions on ambiguous UX behavior")

**Q1 — Morale bar granularity.** You asked for a health bar "above each unit/wing... one for strength, one for morale." Strength is real per-unit data; morale isn't (Finding 3). Recommended: one **Strength + Morale** summary pair per side per lane (shown once, above that side's row of rectangles — this is the "wing" reading), **plus** each individual unit rectangle carries its own strength bar (the "unit" reading, using its real per-unit `strength`). Nothing repeats an identical morale value under six separate rectangles. Flag if you actually want morale visually tied to each rectangle anyway (e.g. a colored border/glow driven by wing morale) rather than only in the summary pair.

**Q2 — Map layout on a phone-width screen.** A literal single top-down map (Left | Centre | Right as three side-by-side columns, like a real tactical diagram) is the most literal reading of "battle plan on a map," but three columns each holding several labeled rectangles is tight at ~400dp phone width. Recommended for v1: keep the three lanes **stacked vertically** (today's arrangement, already proven to fit), but redraw the *inside* of each lane card as its own small map — enemy rectangles along the top edge facing down, your rectangles along the bottom edge facing up, meeting at a front-line divider. A true side-by-side single map is flagged as a possible landscape/tablet variant, not required here.

**Q3 — Does the aggregate "who's pushing whom" bar survive?** Recommended: yes, keep it (it's a real, useful "how is this lane going" read that individual unit rectangles don't replace), but restyle it as a **plain side-colored bar** (laurel/crimson, matching the morale bars) instead of `dominantColor()`'s unit-class coloring — this alone removes the biggest source of confusion in Finding 2 even before the rectangle rework.

---

## Ground rules for the implementing chat

- Read before writing: `src/components/battle/BattlefieldView.tsx`, `src/components/battle/animations.ts`, `src/components/battle/LaneCard.tsx`, `src/components/battle/DeploymentBoard.tsx`, `src/models/battle.ts`, `src/utils/theme.ts`, `src/components/shared/InfoTap.tsx`, `src/data/glossaryTerms.ts`.
- `src/engine/battle/*` and `src/models/battle.ts` are read-only for this plan. If BU1 finds it genuinely needs new state, stop and flag it rather than adding a field.
- Reuse `COLORS`/`FONTS`/`SPACING`/`RADIUS` tokens exactly as CLAUDE.md requires; the side colors are already minted (`COLORS.laurel`, `COLORS.crimson`) — reference them, don't restate hex literals.
- Every new/foregrounded game term (Morale, formation names, unit class names) gets a `glossaryTerms.ts` entry and an `InfoTap` wire-up per CLAUDE.md's glossary rule (Finding 5).
- Run the affected test file(s) and `npx tsc --noEmit` after each chunk; this plan shouldn't touch any file `__tests__/` covers directly (it's presentation-only), so a green suite with zero diffs to `__tests__/*` is itself a useful check that scope held.
- This is a UI change — per CLAUDE.md, actually run it (Expo) and look at a sandbox battle before calling a chunk done, not just `tsc`/tests.

**Chunk order:** BU0 → BU1. BU2 is an optional, separately-scoped fast-follow.

---

## Chunk BU0 — Shared building blocks (labels, legend, unit-rectangle primitive)

**Goal:** the plumbing the redesign needs exists and is exercised by a trivial mount, with zero visible change to the current battle screen yet.

**Files to create:**
- `src/components/battle/UnitBlock.tsx` — the rectangle primitive: `unitClass`, `label` (class abbreviation), `strengthPct`, `side: 'own' | 'enemy'` (drives the border color per Finding 2/Q3) props; renders a `CLASS_COLOR`-filled, side-bordered rectangle with a capping strength bar and short text label.
- `src/components/battle/UnitLegend.tsx` — a compact, always-on strip mapping each of the six `CLASS_COLOR` swatches to its `CLASS_LABEL` name, `InfoTap`-wired per class.

**Files to modify:**
- `src/components/battle/animations.ts` — add `CLASS_LABEL: Record<UnitClass, string>` alongside the existing `CLASS_COLOR`, as the single shared source (Finding 4). Also add `FORMATION_LABEL` here if `LaneCard.tsx`'s copy (`line`/`wedge`/`shield_wall`/`open_ranks`/`feigned_retreat` → display names) is going to be reused by the legend too — verify against `LaneCard.tsx:25-31` before assuming it needs to move.
- `src/components/battle/LaneCard.tsx`, `src/components/battle/DeploymentBoard.tsx` — swap their local `CLASS_LABEL` consts for the shared import. Mechanical, zero behavior change.
- `src/data/glossaryTerms.ts` — add entries: `morale`, one entry per formation name (or one combined `formations` entry — pick whichever matches how the rest of the glossary handles small closed sets; check an existing multi-value entry like `charges` at line ~190 of `MANUAL.md`/its glossary counterpart for precedent), and the six unit classes (again, one entry each vs. one combined `unit-classes` entry — match existing precedent).

**Done when:** `UnitBlock`/`UnitLegend` render correctly in isolation (a temporary `DebugPanel` preview is fine, same idiom as the portrait plan's C0), the three duplicated `CLASS_LABEL` consts are down to one shared source, glossary entries exist and are reachable from Tabularium, `npx tsc --noEmit` is clean, `LaneCard`/`DeploymentBoard` render identically to before (dedup only, no visual change).

---

## Chunk BU1 — `BattlefieldView.tsx` redesign

**Goal:** the live round view reads as a labeled battle plan: each lane is its own small top-down map (enemy rectangles facing down from the top, your rectangles facing up from the bottom, a front-line divider between them), a side-colored strength meter and a morale meter once per side per lane, and a legend on screen — no color anywhere on this view whose meaning isn't recoverable without leaving the screen.

**Files to modify:** `src/components/battle/BattlefieldView.tsx` only. `animations.ts`'s trigger functions are consumed, not changed (Finding 6) — if BU1 finds it genuinely needs a new trigger shape (e.g. per-rectangle effects instead of per-side-group), stop and flag it rather than quietly expanding `animations.ts`'s scope.

**Design (per the Open Questions' recommended answers — revisit if you answered differently above):**
- Mount `UnitLegend` once, near the "Tap anywhere to skip the animation" hint.
- Each lane card keeps its header (lane label, broken tags) and its `frontTrack` advantage bar, restyled to plain `COLORS.laurel`/`COLORS.crimson` fill (Q3) instead of `dominantColor()` — delete `dominantColor()` once nothing calls it.
- Below the header: enemy summary (Strength meter + Morale meter, explicitly labeled, not just a bare `ENEMY` tag) and a row of `UnitBlock`s for `enemyWing.units`, both facing "down/inward."
- A visual front-line divider (replacing the single-bar `frontMarker` concept, now separating two rows instead of splitting one bar).
- Own summary (Strength + Morale) and a row of `UnitBlock`s for `ownWing.units`, facing "up/inward."
- The existing one-shot effects (`playShake`/`playScatter`/`playArc`/`playZigzag`/`playRearwardSlide`/`playFeintDash`) reattach to each side's `UnitBlock` row container — same group-level transform target as today's `ownBlockStyle`/`enemyBlockStyle`, just wrapping the new rectangles instead of the old chips.

**Done when:** a sandbox battle round played in Expo visually matches the design above with zero unlabeled/ambiguous color use; `npx tsc --noEmit` clean; `__tests__/battleSim.test.ts`, `__tests__/battleEngine.test.ts`, `__tests__/battleAi.test.ts`, `__tests__/clashEngine.test.ts` all still pass with **no diffs** (confirms the engine boundary held); `SITEMAP.md`'s `BattlefieldView.tsx`/`animations.ts` entries (§5a) updated to describe the new rendering.

---

## Chunk BU2 — DeploymentBoard visual parity (optional fast-follow, not required for this plan's "done")

Carries the same `UnitBlock`/label language from BU0 into `DeploymentBoard.tsx`'s pre-battle chips, so a unit looks the same while you're placing it as it does once the battle starts. Flagged here so it isn't forgotten, deliberately not scoped further — `DeploymentBoard.tsx`'s chips are already textual and reasonably clear on their own, so this is polish/consistency, not a clarity fix.
