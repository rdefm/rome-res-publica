# Spec 10 — Battle screen revamp

**Source:** `plans/go-live-review-and-plan.md` §3.5, workstream E · **Design of record:** `plans/battle-revamp.md` (agreed v3 mockup) · **Priority:** P1 · **Phase:** 2 — Polish (**first** in the plan's cut order)
**Triage:** **blocked on decision §6.13** (`react-native-svg` or plain views) · ready for agent once decided

This spec doesn't redesign anything. It turns the already-agreed `plans/battle-revamp.md` into the to-spec shape (problem, stories, decisions, test seams) so it can be ticketed like the others. Where the two disagree, `battle-revamp.md` wins.

## Verified findings (checked against `917e1ae`)

1. `react-native-svg` is still not in `package.json`, and nothing under `src/` imports it. Decision §6.13 is still open.
2. The bug the redesign exists to fix is still live: `BattlefieldView.tsx`'s `dominantColor()` tints the tug-of-war bar by dominant unit class, not by side (per `battle-revamp.md`, which cites lines 34-41).
3. `WingState.moralePool` and summed `BattleUnit.strength` (`models/battle.ts`) are the only data the design needs. No engine or state change is required.
4. The parchment sub-theme tokens the design calls for already exist in `utils/theme.ts`.
5. **Unrelated finding (§3.5):** two `musterEngine.ts` files exist (`src/engine/musterEngine.ts` and `src/engine/battle/musterEngine.ts`), and the legacy revolt system ships alongside the theatre map. That belongs to decision §6.4 and is **not** part of this spec; it's listed here so it isn't lost.

## Problem Statement

During a set-piece battle the player can't tell at a glance who is winning each wing. The main bar's color follows the dominant unit class, not the side, so a winning Roman wing can look like a losing one, and it clashes with the side-colored morale bars next to it. Three stacked lane cards with per-unit chips read as a spreadsheet, not a battlefield.

## Solution

Replace the round-resolution view with the agreed single battle map:

- One diagonal front line with Left Wing, Centre and Right Wing zones.
- One formation block per wing per side, shaped by its real formation, sized by strength, colored strictly by side and captioned with unit classes.
- A two-color strength roundel at each zone.
- A side-colored morale bar above each block, with exact numbers in text.

All of it sits on the existing parchment sub-theme inside the dark chrome.

## User Stories

1. As a player in a battle, I want each side always shown in the same color (own laurel, enemy crimson), so that I never misread who is winning.
2. As a player, I want a roundel at each zone split by own-versus-enemy strength, so that I can see which wing is ahead at a glance.
3. As a player, I want a morale bar above each formation, so that I can see which wing is close to breaking.
4. As a player, I want exact strength and morale numbers next to the visuals, so that I can make precise decisions.
5. As a player, I want each formation's shape to show its real formation (line, shield wall, open ranks, wedge, feigned retreat), so that my deployment choices are visible on the field.
6. As a player, I want formation blocks sized by strength, so that I can sense force size before reading numbers.
7. As a player, I want unit classes named in text next to each block, so that I know what's fighting without learning an icon set.
8. As a player, I want the map to read as a paper battle-map on a dark desk, so that it's clearly distinct from the menus.
9. As a player, I want the round-by-round animation to stay as smooth as today, so that the redesign doesn't feel slower.
10. As a player on a small phone, I want the whole front line visible without scrolling, so that I see the entire battle.
11. As a player using screen reading or large text (spec 15), I want each zone's state available as text, so that the battle is playable without the visuals.
12. As a player, I want an unfamiliar or unsupported formation to fall back to a plain line, never a crash, so that rare formations are safe.
13. As a developer, I want the engines, battle models and `BALANCE.battle` untouched, so that this is provably presentation-only.
14. As a design lead, I want the "front line sags towards the losing side" rule either built as a defined reactive rule or explicitly left out, so that it isn't hand-placed art masquerading as data (battle-revamp Finding 5).
15. As a design lead, I want the loss of per-unit detail on this screen confirmed before build, so that it's a deliberate trade (battle-revamp Finding 3).

## Implementation Decisions

- Everything in `plans/battle-revamp.md` § "The agreed design" is the contract.
- **Drawing primitive (§6.13):** if `react-native-svg` is approved, the line, ticks and roundel are SVG and blocks stay `Animated.View`. If not, everything is plain `View`s with rotate transforms, and the roundel is two clipped semicircles.
- **Pure view-model layer:** extract a pure function from battle state to the drawable model (per zone: own and enemy strength share, morale, formation shape id with fallback, label text). The component only draws. The function has no React imports and can live with other presentation helpers, not in the engine.
- **Formation fallback:** a total map from `FormationId` to shape, with `line` as the default for anything unmapped.
- **Tokens only:** colors from `COLORS.laurel`, `COLORS.crimson` and the parchment tokens. No literals.
- `LaneCard.tsx` and `DeploymentBoard.tsx` are out of scope (per battle-revamp).

## Testing Decisions

- **Seam: the pure view-model function.** This is the new, highest useful seam: everything above it is pixels and everything below it is the engine.
  - Side color is assigned by side regardless of unit class (the regression for the original bug).
  - Roundel share equals the own/(own+enemy) strength ratio, and handles 0/0.
  - Every `FormationId` maps to a shape, and unknown ids fall back to `line`.
  - Morale width tracks `moralePool` with no color ramp.
- **Scope guard:** the diff touches no file under `src/engine/battle/`, `src/models/battle.ts` or the existing battle tests. Per battle-revamp's ground rules, a green suite with zero diffs to existing battle tests is itself the check.
- Visual verification in a sandbox battle on device. Screenshots go in the PR. Prior art for battle fixtures: `battleEngine.test.ts`, `clashEngine.test.ts`.

## Out of Scope

- Engine, AI or balance changes.
- The legacy revolt / dual muster-engine question (§6.4).
- Map-label collisions on the theatre map (spec 08).

## Further Notes

- First to be cut if Phase 2 has to shrink to meet a date.
