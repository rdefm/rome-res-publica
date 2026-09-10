# Rome: Res Publica — Battle Screen Revamp

## How to use this document

This is the agreed design for the live round-resolution view of a set-piece battle (`BattlefieldView.tsx` — what the player sees between "Resolve Round" taps), reached over three visual passes worked through with the design lead directly (mockups linked below). It replaces `plans/battle-ui-clarity-plan.md`'s original three-option sketch, which this supersedes entirely — that doc proposed per-lane cards with icon-coded unit chips; what's actually agreed is a single unified battle map, described here. No implementation chunks have been built yet; this document is the spec to build against once you're ready to start.

**Mockups (in order, for context on how we got here):**
- v1 — per-lane cards, top/bottom facing, icon-coded unit tokens (rejected: too close to today's screen, no map feel).
- v2 — single diagonal front line, left/right facing per wing, text-labelled formation blocks (liked the structure, wanted stronger strength/morale readouts).
- **v3 (agreed)** — v2 plus a strength-split roundel per zone and a morale bar per block: https://claude.ai/code/artifact/102ac6a2-ae54-4c46-8c49-d42cefe7c280

**Scope:** presentation-layer only. No changes to `clashEngine.ts`, `battleEngine.ts`, `battleAi.ts`, or any `BALANCE.battle` numbers. Reworks `BattlefieldView.tsx`. `LaneCard.tsx` (the "Dispatches" text fallback) and `DeploymentBoard.tsx` (pre-battle staging) are unaffected by this pass — see "Not in scope" below.

---

## The agreed design

**One continuous front line, not three stacked cards.** Left Wing / Centre / Right Wing become zones along a single diagonal line spanning the screen, divided by tick marks, each zone's name captioned along the line. This replaces `BattlefieldView.tsx`'s current three independently-stacked `LaneBattlefield` cards.

**Per wing per side, one formation block, not one chip per unit.** Today's per-`BattleUnit` chip row is gone. Instead each `WingState` (own and enemy, three per side) draws as a single elongated block:
- **Shape is driven by the wing's real `formation: FormationId`** (`models/battle.ts:23`) — this is the one genuinely new piece of information design here, real state driving the drawing instead of decoration:
  - `line` → a plain bar.
  - `shield_wall` → visibly thicker/denser, with a hatch texture.
  - `open_ranks` → broken into spaced-out segments.
  - `wedge` → a chevron pointing at the enemy.
  - `feigned_retreat` → not built in the mockup (rare — gated on a captain *and* `isFeintGated`, `DeploymentBoard.tsx:75`) but needs a shape in BU1: a dashed-outline variant of `line`, angled back.
- **Color is fixed by side, never by unit class**: own is always laurel (`COLORS.laurel`), enemy always crimson (`COLORS.crimson`). This is the actual bug this whole effort started from — `BattlefieldView.tsx`'s current `dominantColor()` (lines 34-41) colors its tug-of-war bar by whichever `CLASS_COLOR` the wing's dominant unit class happens to be, which has nothing to do with who's winning and collides with the morale bars' fixed side-coloring right next to it. The agreed design never repeats that mistake — color means side, full stop, everywhere on this screen.
- **Troop identity is a text label**, not an icon or abbreviation: the wing's unit classes listed by name next to the block (e.g. "Legionary, Spear"), the same convention a real battle-plan diagram uses to caption a formation. No icon set to design, build, or teach.
- **Block length is proportional to the wing's total strength** (sum of `BattleUnit.strength` across its units), giving a rough "how big is this force" read before the reader even gets to the label.

**A strength-breakdown roundel sits on the line at each zone.** A small two-color circle (own laurel, enemy crimson) split exactly by that zone's own-vs-enemy total strength ratio — a precise, at-a-glance "who's ahead here" read, replacing both today's ambiguous `dominantColor()`-tinted tug-of-war bar and an intermediate all-ellipse-wash version from v2 that wasn't precise enough.

**A morale bar sits above every block.** Always laurel-filled for own, always crimson-filled for enemy, width = that side's `WingState.moralePool` (`models/battle.ts:105`) — deliberately *not* color-ramped by value (no amber/red-by-severity the way `LaneCard.tsx:43`'s morale color does today). Ramping by value would put a healthy-looking laurel bar on an enemy block at high morale, reopening the exact color-collision problem this redesign exists to close. Side color is sacred on this screen; severity is communicated by bar width and the numeric label, not a second color axis.

**Exact numbers stay in text**, alongside the roundel/bar, same pairing `LaneCard.tsx` already uses for morale (a bar plus a printed value) — visual for the glance, number for the precise read.

**Ground is the app's existing parchment sub-theme**, not a new palette: `COLORS.parchment` / `parchmentBorder` / `parchmentText` / `parchmentMid` / `parchmentDark` (`utils/theme.ts:62-67`), already minted for the Domus/Cursus redesigns. The map is deliberately a lighter parchment panel sitting inside the rest of the screen's dark chrome (topbar, formation-key legend, skip hint stay on the existing dark `COLORS.bg`/`panelSurface` — only the map surface itself is parchment), the same "a paper battle-map sitting on a dark desk" contrast the mockup uses.

---

## Findings from grounding this plan against the actual code (verified this pass)

1. **`react-native-svg` is not a dependency** (checked `package.json` — not present; no file under `src/` imports it either). The mockup draws the diagonal line, the dashed stroke, and the pie-wedge roundels as SVG paths, which is by far the easiest way to build all three in a real app too. `expo-linear-gradient` (`package.json`, `~13.0.2`) is already present and covers the parchment gradient; it does **not** cover arbitrary path/arc drawing. **This is a real open decision, not a rubber stamp**: either add `react-native-svg` (a genuine new native dependency — outside this plan's own "presentation-layer only, don't touch package.json" instinct, needs explicit sign-off before BU1 starts) or build the line/roundel with plain RN `View`s and `transform: [{rotate}]` (the front line as a thin rotated `View`, ticks as small rotated `View`s, the roundel approximated with two rotated/clipped semicircle `View`s or `react-native-svg`'s absence worked around some other way — more fiddly, especially the pie-wedge roundel, but zero new dependency). Flagging for a decision before BU1, not assuming either way.
2. **Formation blocks can reuse the transform pattern already in the codebase.** `animations.ts`'s existing one-shot effects (`playArc`, `playShake`, etc., lines 80-132) already animate `View`s via `transform: [{translateX}, {translateY}]` `SharedValue`s. Rotating a formation block to sit along the diagonal line is the same idiom, one more transform (`rotate`) on the same kind of `Animated.View` — no new animation architecture needed for the blocks themselves, only for whatever ends up drawing the line/roundel (see Finding 1).
3. **`WingState.moralePool` and summed `BattleUnit.strength` are exactly the two numbers this design needs, no new state.** (`models/battle.ts:99-120`, confirmed in the original `battle-ui-clarity-plan.md` grounding pass too.) Per-unit granularity is genuinely gone from the display in this design (no more per-chip strength) — worth a final sanity check with you before BU1, since it's a step down in displayed detail even though the underlying data isn't touched.
4. **`legalFormationsFor()` in `DeploymentBoard.tsx:71-78` already gates `wedge` (needs a captain) and `feigned_retreat` (needs a captain *and* `isFeintGated(units)`)** — both formations can be legitimately absent for most of a battle. The shape language should degrade gracefully to `line` for any formation it doesn't yet have art for, rather than crashing on an unhandled `FormationId`.
5. **Zone geometry (the diagonal's exact slope, per-zone offsets, "sag toward the losing side") is hand-placed art-direction in the mockup, not derived from data.** BU1 needs to decide whether the front line's shape reacts to `WingState` at all (e.g., a zone visibly sags when that side's roundel share drops below some threshold) or stays a fixed diagonal every battle — the mockup's "Right Wing sags because it's losing" read is a nice touch but was manually placed, not computed; confirm before building it as a real reactive rule.

---

## Not in scope for this pass

- `LaneCard.tsx` (the "Dispatches" fallback) — stays as-is, already unambiguous, not the screen this redesign targets.
- `DeploymentBoard.tsx` (pre-battle staging chips) — a flagged fast-follow if you want the same formation-shape/parchment language applied there too, not required for this plan's own "done."
- Any change to `clashEngine.ts` / `battleEngine.ts` / `battleAi.ts` / `BALANCE.battle`.

---

## Ground rules for the implementing chat

- Read before writing: `src/components/battle/BattlefieldView.tsx`, `src/components/battle/animations.ts`, `src/models/battle.ts`, `src/utils/theme.ts`, and this document's linked mockup.
- Resolve Finding 1 (the `react-native-svg` question) explicitly before starting BU1 — don't default to adding the dependency without saying so out loud first.
- Reuse `COLORS`/`FONTS`/`SPACING`/`RADIUS` tokens exactly; the parchment tokens are already minted (Finding above) — reference them, don't restate hex literals.
- `src/engine/battle/*` and `src/models/battle.ts` are read-only for this plan.
- Run the affected test file(s) and `npx tsc --noEmit` after each chunk; this is presentation-only, so a green suite with zero diffs to `__tests__/*` is itself a useful check that scope held.
- This is a UI change — per CLAUDE.md, actually run it (Expo) and look at a sandbox battle before calling it done, not just `tsc`/tests.
