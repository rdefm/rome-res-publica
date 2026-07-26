# Rome: Res Publica — Curia Tab Redesign Plan

## How to use this document

This plan turns the current text-heavy, seven-panel Curia scroll into a pinned-header + three-sub-tab screen, per the approved mockups and the design review that followed them. It is written in the style of `cursus-visual-redesign-plan.md` and is intended to be handed to a fresh implementation chat **together with the actual source files per chunk**.

Chunks are ordered by dependency. **C0 is the only chunk with cross-tab blast radius** — everything after it touches Curia plus a small, enumerated set of call sites.

**Read this whole document before writing any code.** The Findings section (§3) settles about a dozen things the mockups get wrong or the original proposal omitted; implementing from the mockups alone will produce a screen that misreports game state.

---

## 1. Scope

**In scope — presentation layer, plus one deliberate feature relocation.**

- Rebuild `CuriaScreen.tsx` as a layout shell: a pinned State-of-the-Republic header, a three-way sub-tab bar, and three view components.
- Create `src/components/curia/` — it **does not currently exist**. Curia is the only one of the five tabs with no component folder; every card, modal and panel is inline in a 1,220-line screen file.
- **Relocate trial preparation from Cursus back into Curia** (reversing Phase 4 P4-D — see §4 delta 1). This is the one non-cosmetic change in the plan, and it is deliberate.
- Fix the bare-`useGameStore()` subscriptions in this file (CLAUDE.md mandates field-level selectors and mandates fixing them when you are in the file). A pinned header makes the current pattern genuinely expensive.

**Out of scope — do not change:**

- Bill support math, `applyNpcBillReactions`, `calcRomeStatVoteModifier`, crisis escalation/cascade logic, munificence cost/effect math, treaty terms, command election resolution, trial prep or beat resolution. **No engine changes at all**, with one exception: two `target.tab` string literals in `agendaEngine.ts` (C2).
- The treasury model. `rome.treasury` stays a 0–100 index (Finding 1).
- Any new spendable resource, any new gameplay rule, any balance number.

**One new dependency:** `expo-haptics` (C6). This is a `package.json` edit, which CLAUDE.md normally gates — it is explicitly in scope for this plan, and for this plan only.

---

## 2. Ground rules for the implementing chat

**Before writing anything, read:**
`src/screens/CuriaScreen.tsx` · `src/utils/theme.ts` · `src/models/crisis.ts` · `src/models/bill.ts` · `src/models/agenda.ts` · `src/engine/resourceEngine.ts` (`calcRomeStatModifiers`) · `src/engine/munificenceEngine.ts` · `src/data/munificence.ts` · `src/utils/cursusAssets.ts` · `src/components/shared/StatusSeal.tsx` · `src/components/shared/ParchmentCard.tsx` · `src/components/shared/GildedPanel.tsx` · `src/components/shared/StatBar.tsx` · `src/components/shared/InfoTap.tsx` · `src/components/shared/CrisisTrackModal.tsx` · `src/components/shared/AgendaBadge.tsx` · `src/components/cursus/BasilicaSheet.tsx` · `src/components/war/NegotiationScreen.tsx` · `src/screens/CursusScreen.tsx` (lines 440–600, the sheet shell) · `src/screens/ProvinciaeScreen.tsx` (lines 120–200, 320–400, the other sheet shell) · `App.tsx` (lines 153–193, the nav handler) · `src/state/saveLoad.ts` (lines 185–213, the strip list) · `src/data/glossaryTerms.ts`.

**Rules:**

1. **The code is the source of truth for state; the mockups are the source of truth for style only.** The mockups misreport crisis tiers, mislabel the treasury unit, show the same bill as both a bill and a law, and use two different names for the constitution track. See Finding 9.
2. **Every asset ships behind a code fallback.** The screen must render acceptably with **zero** image files present. `cursusAssets.ts` is the pattern to copy verbatim (Metro resolves `require()` at bundle time, so unshipped lines stay commented and resolve to `undefined`). This is what stops art generation from ever blocking the build — and `cursusAssets.ts` still has three office icons commented out months later, which is the empirical argument for taking this seriously.
3. **Styling comes from `theme.ts` tokens only.** No hardcoded colors or spacing in components. Per CLAUDE.md, a new token that is semantically the same value as an existing one must **reference** it (`export const porphyry = crimsonDeep;`), never restate the literal.
4. **Field-level selectors everywhere.** `useGameStore(s => s.bills)`, never `const { bills } = useGameStore()`. No new component in this plan may ship with a bare unselected subscription.
5. **Engines stay pure; UI stays logic-free.** Tier→visual-style mapping is a *token map* in `theme.ts`, not engine logic and not inline component logic.
6. **Every new player-facing game term gets glossary coverage** (`glossaryTerms.ts`) and an `InfoTap` at its point of use. This plan introduces seven Latin terms at once — see C6 and Appendix B.
7. **`npx tsc --noEmit` must be zero-error at the end of every chunk**, not just at the end of the plan.
8. **Run `npm test` (not bare `npx jest`) before declaring any chunk done.** This is a presentation-layer plan, so no engine test should need to change — with one exception called out in C2 (`saveLoad.test.ts`).
9. **Update `SITEMAP.md` in the same chunk that changes a file's responsibility.** §5 (Curia) and §3 (Cursus) both need edits; see C6.

**Chunk order:** C0 → C1 → C2 → C3 → C4 → C5 → C6. C1–C5 all depend on C0. C3, C4, C5 all depend on C2's view shells. C6 is last deliberately.

---

## 3. Findings — verified against the code this pass

Treat these as settled. Do not re-litigate them, and do not "fix" the code back toward the mockups on any of these points.

**Finding 1 — `rome.treasury` is a 0–100 index, not a quantity of coin.**
`calcRomeStatModifiers` (`resourceEngine.ts:97–111`) maps it to five labels: Bankrupt (<10) / Depleted (<25) / Adequate (<65) / Flush (<85) / Overflowing (≥85). The mockups render it as **"50 Denarii"**, directly beneath the player's *personal* 200 Denarii in the resource bar — which tells the player the Republic is poorer than their household. The model is **not changing**. This is a copy fix; see C1's `AerariumBar` contract.

**Finding 2 — there are five crisis tiers at 20% bands, not four at 25%.**
`CRISIS_TIER_BANDS` and `getTierFromLevel` (`models/crisis.ts:34–48`) define tiers 0–4 at 0/20/40/60/80. `CuriaScreen.tsx:48–53` carries five named labels per track. The visual degradation states must be **five, on 20% bands**. The mockups' numbers are wrong and are disregarded (e.g. panel 3 draws Econ 15 — tier 0, "Prosperous Republic" — as a shattered, ember-glowing amphora).

**Finding 3 — VOTE and SPEECH are already two-step actions, and the second step carries per-bill numbers.**
`expandBill(billId, 'vote' | 'speech')` writes `_expandedBill` / `_expandedType` to the store; the card then reveals For/Against sub-buttons (`CuriaScreen.tsx:411–430`) labelled with `bill.voteForSupport` / `voteAgainstSupport` — which **vary per bill**. The two-step flow is preserved (so this costs zero state changes), but step 2 is **not** coins; see §4 delta 2.

**Finding 4 — four working surfaces are missing from the original proposal's layout tree.**
`TrialBanner` (`CuriaScreen.tsx:258`), the WAR & PEACE panel opening `NegotiationScreen` (`:914`), THE COMMAND panel opening `CommandAssemblyModal` (`:945`), and the Provinciae→Latium crosslink for Stability/Plebs (`:887`). Additionally `agendaEngine.ts` has **eleven** generators targeting `tab: 'Curia'`, two of which (`:227`, `:270`… through `:868`) point at War & Peace specifically. All of it must land somewhere; see §4 delta 3.

**Finding 5 — `BasilicaSheet.tsx` is portable, but the sheet *shell* is already duplicated twice.**
`BasilicaSheet` (451 lines) takes only `(trialId, onClose)` and has no Cursus coupling — it moves cleanly. But the `Animated` + `PanResponder` drag-sheet shell around it exists in both `CursusScreen.tsx:440–600` and `ProvinciaeScreen.tsx:120–200/320–400`, with identical spring constants (tension 65, friction 11), identical close timing (240ms), and identical dismiss thresholds (`dy > 100 || vy > 0.5`). A third copy is where you extract instead; see C0.

**Finding 6 — the vote probability bar would claim precision the model does not have.**
There is no per-senator vote data anywhere. `Bill.support` is a single scalar, −100…+100 (`models/bill.ts:19`). `BlocMeter` (`CuriaScreen.tsx:142–155`) derives its three segments from that one number using hardcoded `70`/`70` spans — the "neutral" middle is a **formula artifact, not a modelled quantity**. Labelling it "Non Liquet (Undecided / Margin of Error)" would tell players Rome tracks undecided senators. See §4 delta 4.

**Finding 7 — the wax seal system already exists, and the grey token for its missing third state already exists too.**
`StatusSeal.tsx` + `cursusAssets.waxSeal` are live (used for Cursus office status). `COLORS.sealWaxGrey` (`theme.ts:60`) is already defined and currently **unused by Curia** — a strong hint the three-way seal was anticipated. The verdict logic at `CuriaScreen.tsx:353` is already three-way (`>0` pass / `<−20` fail / else too-close), so a two-state red/gold seal would collapse a real distinction.

**Finding 8 — the `billId` deep-link is currently tab-landing only.**
`App.tsx:180–190` consumes only `selectedCharacterId` and `trialId`; `provinceId` / `billId` are landing-only with an explicit `TODO (P1-C+)`. So sub-tabs do not break a working `billId` deep-link — but they do introduce a **new** failure: an agenda tap targeting `{ tab: 'Curia', billId }` will land the player on whatever sub-tab they last used, which may show nothing related. C2 must handle sub-tab selection on nav.

**Finding 9 — the mockups are illustrative, not data-accurate.** Beyond Findings 1 and 2: `Bellum Punicum` appears as an active bill in panel 1 and an enacted law in panel 2; the constitution track is labelled "Institutional Stability" in panel 2 and "Pristine Marble" in panel 3. Neither is a spec.

**Finding 10 — `ActiveLaw` has no description field.**
`models/bill.ts:47–56`. The only route to descriptive text is name-matching against `ALL_BILL_TEMPLATES`, which `ActiveLawDetailModal` (`CuriaScreen.tsx:610–618`) already does and already documents *why*: `law.billId` is a runtime instance id re-assigned on every injection, not a stable template id. Keep using that route; do not assume a field.

**Finding 11 — every component in this file subscribes with a bare `useGameStore()`.**
`TrialBanner:259`, `BillCard:346`, `BillDetailModal:511`, `ActiveLawCard:573`, `ActiveLawDetailModal:611`, `SubmitBillModal:680`, `CommandAssemblyModal:746`, `CuriaScreen:834`, and worst `MunificenceActRow:1155` (`const state = useGameStore()`, then passes the whole state object into `checkMunificenceRequirements`). Today this is invisible because everything scrolls away. With a **pinned** header, every vote re-renders the crisis grid, and any write from any of the other four tabs re-renders all six patronage cards mid-animation.

**Finding 12 — `expo-haptics` is not a dependency.** `package.json` has `react-native-reanimated ~3.10.1` (so bar animation needs no new package) and `expo-linear-gradient ~13.0.2` (so gradients/ember glow need no new package), but no haptics module.

**Finding 13 — `basilicaReturnTab` exists only to compensate for the hand-off this plan reverses.**
It is a store field + action (`gameStore.ts:392–394`, `setBasilicaReturnTab`) read once in `App.tsx:172–175` and once in `CursusScreen`'s `closeBasilica`, whose sole job is to un-strand a player whom a Curia→Cursus trial deep-link had moved to a tab they did not choose. Once trials live in Curia, closing the sheet correctly leaves the player in Curia. The field is **stripped from saves** (`saveLoad.ts:208`), so retiring it needs no migration.

**Finding 14 — glossary definitions are conventionally sourced from the manual, and the manual does not cover this plan's Latin.**
`glossaryTerms.ts:15–16` states all definitions come from the manual. `MANUAL.md` (323 lines) has **no** entry for Aerarium, Rogationes, Leges in Vigore, Negotia, Uti Rogas or Antiquo — its only Curia vocabulary is the §"Bills, Munificence, and Crisis" paragraph at line 218. So C6 adds a short manual subsection **first**, then mirrors it into the glossary, rather than inventing glossary text and breaking the convention.

---

## 4. Design deltas — deliberate; do not "fix" back toward the mockups or toward current code

**Delta 1 — trial preparation returns to Curia. This reverses Phase 4, Chunk P4-D.**
P4-D deliberately moved prep into Cursus's Basilica sheet and, per an explicit prior design decision, removed the Curia entry-point card, leaving "Curia's slimmed `TrialBanner` is the only card" — all of which `SITEMAP.md` §3 and §5 document at length. **That decision is now reversed**: trials are Senate business and belong beside the Senate's other business. C6 must edit both SITEMAP sections to say so, in those words, or a future session will read the old rationale and helpfully move it back.

**Delta 2 — step 2 of a vote is two voting tablets, not two coins.**
Coins stay for the three *verbs* (VOTE −4 / SPEECH −6 / FILIBUSTER −8) because coin-as-cost reads true when the costs genuinely differ. For/Against cost identically, so encoding a direction choice as two same-cost coins encodes the wrong axis — and a ~56pt circle cannot carry the per-bill support delta that Finding 3 says the current buttons carry. Instead: the tapped coin expands into **two wide *tabella* buttons** — a Roman voting tablet, inscribed **V·R** (*uti rogas*, yes, laurel) and **A** (*antiquo*, no, crimson) — each showing its support delta. Better metaphor, room for the number, and step 2 becomes visually distinct from step 1.

**Delta 3 — the third sub-tab is NEGOTIA (Affairs of State), not "Treaties and Trials".**
It holds three things, not two: peace negotiation, trials, **and** The Command (an extraordinary military command election — neither a treaty nor a trial). The honest thread is *Senate business that isn't legislation*, which is historically exactly the Senate's non-legislative docket: foreign affairs, extraordinary commands, and the criminal courts. `NEGOTIA` covers all three without lying about any, and matches the bilingual pattern of the other two tabs.

**Delta 4 — the vote bar is a two-sided support meter with a centre tick, and "Non Liquet" is cut.**
Per Finding 6, a three-zone bar with a labelled "undecided" segment is a false precision claim. Ship a two-sided meter (crimson left / laurel right, centre tick at zero) labelled `A · ANTIQUO` and `VTI ROGAS · V·R`. Both are correct legislative formulas. **"Non Liquet" is cut entirely** — it is a *juror's* formula from criminal trials ("it is not clear"), not a legislative abstention, and in the proposal it was simultaneously being used to mean "margin of error," which is a third distinct thing.

**Delta 5 — three wax seal states, not two.** Gold = likely to pass, `sealWaxGrey` = too close to call, crimson = likely to fail. Matches the existing three-way verdict logic (Finding 7). The mockup's red seal on "TOO CLOSE TO CALL" reads as failing and is wrong.

**Delta 6 — FILIBUSTER gets a confirmation step.** It currently fires on a single tap, irreversibly, at the highest cost of the three (`CuriaScreen.tsx:405`). Rendering it as a prominent coin between two other coins measurably raises mis-tap risk. It expands to a single confirm tablet (`CONFIRM · −8 🤝`), reusing the same expand mechanism as the other two verbs so all three coins behave consistently.

**Delta 7 — no title bar.** The bottom tab already reads CURIA and is highlighted; a 40pt "CURIA / Senate & Legislation" header is redundant chrome on the one screen that cannot afford it (see §5's budget). The mockups already omit it. Removing it is deliberate.

**Delta 8 — crisis tiles carry icon + abbreviation + number only; the tier *name* moves.**
"Institutional Stability" at ~84pt tile width wraps to three lines and blows the height budget by itself. The worst track's tier name rolls up into the aerarium line as one sentence; full per-track tier detail stays in the existing, already-reachable `CrisisTrackModal`. The constitution track abbreviates to **`MOS`** (*mos maiorum*) rather than `Const` — apt, evocative, and it avoids an abbreviation that reads as the keyword. It costs one glossary entry (Appendix B).

**Delta 9 — the crisis grid is collapsible; the aerarium line and sub-tab strip are always pinned.** Default expanded. Collapsed = a single ~32pt strip of four coloured pips with numbers. This hands the vertical budget to the player rather than guessing on their behalf. Local `useState`, no store field, no save-schema change.

**Delta 10 — the ember/damage effect is a one-shot on tier *change*, not a loop.** A looping particle system on a *pinned* header runs for the whole session — battery and JS-thread cost on the screen players sit on longest. It is also better game feel: the crisis *worsening* is the event worth animating; the crisis *being bad* is a state. The proposal's "particle effect" is **cut**; the flare is a one-shot opacity/scale pulse on the damage overlay.

**Delta 11 — Munificentia cards render all five states the current row renders.** Lock (with tier requirement, greyed not hidden — the P2-F design intent is that locked acts are the aspiration), cooldown/blocked, `isGrandAct` laurel accent, Aedile discount note, and the decaying `grandGamesVoteBonus` line. The mockup shows two clean cards and none of it; the locked variant especially must read as aspirational rather than broken.

**Delta 12 — NEGOTIA gets a badge and a written empty state.** All three of its contents are conditional, so in a typical early game the tab is blank. A permanently-visible empty tab trains players to stop tapping it — and then they miss the season a prosecution is filed against their heir. See C4.

**Flagged, not fixed — asymmetric verdict thresholds.** `>0` passes, `<−20` fails, so a bill at −18 and one at −1 both show "too close to call". Not a redesign bug, but a large wax seal makes the asymmetry much more prominent. **Do not change the thresholds.** Note it in the end-of-task summary as a design-lead question.

---

## 5. The vertical budget

The single largest risk in this redesign. Pinning a header that was previously scrollable removes it from the scroll area permanently.

| Element | Height |
|---|---|
| `RESOURCE_BAR_HEIGHT` | 60pt |
| ~~Title bar~~ (cut, Delta 7) | 0pt |
| State-of-the-Republic panel, expanded | **≤150pt** |
| Sub-tab strip | ≤44pt |
| Alert strip (only when a NEGOTIA item is critical) | 28pt |
| **Fixed chrome, expanded** | **≤254pt** |
| **Fixed chrome, grid collapsed** | **≤136pt** |
| Bottom tab bar | 60pt |

On a 667pt screen that leaves ~350pt of scroll expanded and ~470pt collapsed. As mocked (with a title bar and three-line tile labels) it was ~274pt of chrome and ~1.5 bill cards visible.

**These are hard caps.** If the header exceeds 150pt expanded, cut content from it — do not let it grow.

---

## Chunk C0 — Foundations: asset registry, tokens, shared DragSheet

**Goal:** every primitive C1–C5 need, with nothing Curia-specific leaking into shared space and nothing shared being duplicated a third time.

**Files to create:**
- `src/utils/curiaAssets.ts`
- `src/components/shared/DragSheet.tsx`

**Files to modify:**
- `src/utils/theme.ts` (token additions)
- `src/screens/CursusScreen.tsx` (adopt `DragSheet`, delete its inline shell)
- `src/screens/ProvinciaeScreen.tsx` (adopt `DragSheet`, delete its inline shell)

### `src/utils/curiaAssets.ts`

Copy `cursusAssets.ts`'s shape exactly — same header comment explaining bundle-time `require()` and graceful degradation, same `RequiredAsset = any` escape hatch with the same eslint-disable, same "commented out until the file exists" convention.

```ts
import type { CrisisTrackId, CrisisTier } from '../models/crisis';

export type VoteVerb = 'vote' | 'speech' | 'filibuster';

export const curiaAssets = {
  /** Seamless tile for the pinned header. resizeMode="repeat". */
  porphyryTile:     PORPHYRY_TILE   as RequiredAsset | undefined,
  /** Seamless tile for LawCard's bronze plaque. */
  bronzeTile:       BRONZE_TILE     as RequiredAsset | undefined,
  /** Seamless tile for the sub-tab strip. */
  stoneTile:        STONE_TILE      as RequiredAsset | undefined,
  /** Seamless tile for PatronageCard. */
  terracottaTile:   TERRACOTTA_TILE as RequiredAsset | undefined,
  /** Pristine track icon. One per track — damage is composited, never baked in. */
  crisisIcon:   (id: CrisisTrackId) => CRISIS_ICONS[id],
  /** Transparent damage layer for tiers 1–4. Tier 0 returns undefined (pristine). */
  damageOverlay: (tier: CrisisTier) => DAMAGE_OVERLAYS[tier],
  /** Coin face for a vote verb. */
  coinFace:     (verb: VoteVerb)    => COIN_FACES[verb],
};
```

⚠️ **The `crisisIcon` / `damageOverlay` split is load-bearing, not a convenience.** Four icons × five tiers = 20 baked sprites would drift in lighting, framing and optical weight across a generated batch — and these four tiles sit *side by side* in a fixed grid, the layout that makes drift maximally visible. Compositing four pristine icons under four shared damage layers is 8 assets instead of 20, makes consistency structural, and turns tier retuning into a token edit instead of an art regeneration. **Do not "simplify" this into per-tier-per-track sprites.** See Appendix A.

Wax seals are **not** in this registry — reuse `cursusAssets.waxSeal` (Finding 7). Tablets (*tabellae*) are **not** in this registry either — they are shaped Views with text, no image needed.

### `theme.ts` additions

Add one commented block, `// ── Curia redesign (plans/curia-redesign.md) ──`. Per CLAUDE.md, anything semantically equal to an existing token **references** it:

```ts
// References — same value, Curia-specific semantic name.
export const porphyry       = crimsonDeep;    // header field
export const porphyryFrame  = goldBronze;     // header outer bevel
export const bronzeRivet    = rivet;          // LawCard corner rivets
export const tabellaYes     = laurel;         // V·R
export const tabellaNo      = crimson;        // A
export const sealPass       = gold;
export const sealClose      = sealWaxGrey;    // already exists, currently unused — Finding 7
export const sealFail       = crimson;

// Genuinely new values.
export const bronzePlaque     = '…';
export const bronzePlaqueDark = '…';
export const stoneTab         = '…';
export const stoneTabActive   = '…';
export const emberGlow        = '…';
```

Also add the tier→visual token map. This lives in `theme.ts` as **data**, not as logic in a component or engine (rule 5):

```ts
/** Five entries, indices 0–4, matching CrisisTier / CRISIS_TIER_BANDS exactly
 *  (models/crisis.ts — 20% bands, NOT the mockup's 25%; see Finding 2). */
export const CRISIS_TIER_VISUAL: Record<0|1|2|3|4, {
  /** Overlay index passed to curiaAssets.damageOverlay; null = pristine. */
  overlay: 0 | 1 | 2 | 3 | null;
  /** Multiply-tint over the icon. */
  tint: string;
  /** Tile border. */
  border: string;
  /** Ember glow behind the icon — drives the one-shot flare (Delta 10). */
  glow: boolean;
}> = { /* 0: pristine … 4: shattered + glow */ };
```

The tier→style *lookup* is therefore `CRISIS_TIER_VISUAL[track.tier]` at the call site — no function, no derivation. `track.tier` is already computed and stored by the crisis engine; **never recompute it from `level` in the UI.**

### `src/components/shared/DragSheet.tsx`

Lift the shell that `CursusScreen.tsx:440–600` and `ProvinciaeScreen.tsx` both implement identically (Finding 5). Preserve every constant exactly — spring tension 65 / friction 11, close timing 240ms, dismiss at `dy > 100 || vy > 0.5`, scrim opacity interpolated 0.5→0, `useNativeDriver: false` throughout, `pointerEvents="none"` on the scrim.

```ts
interface DragSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fraction of window height. Both existing call sites use 0.72. */
  heightRatio?: number;
  children: React.ReactNode;
}
```

Animation state lives inside, driven by a `useEffect` on `visible`. `onClose` fires **after** the close animation completes, matching the current `Animated.timing(...).start(callback)` behaviour — several callers depend on that ordering.

**Acceptance:** Cursus's Basilica sheet and Provinciae's city sheet both open, drag, and dismiss exactly as before, with zero inline `PanResponder` left in either screen. `npx tsc --noEmit` clean. `npm test` green.

---

## Chunk C1 — Pinned header

**Goal:** the State-of-the-Republic panel, inside the §5 budget, reporting real state.

**Files to create:** `src/components/curia/StateOfRepublicPanel.tsx` · `AerariumBar.tsx` · `CrisisGrid.tsx` · `CrisisTile.tsx`

**Files to modify:** none yet — C2 wires the panel in. Build and typecheck it standalone.

### Contracts

```ts
// StateOfRepublicPanel — the whole pinned block.
interface StateOfRepublicPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```

Owns no store subscriptions of its own beyond what it passes down. Collapse state is owned by `CuriaScreen` (C2) and threaded in — the panel does not own it, because C2's alert strip needs to sit outside the panel but inside the same pinned region.

```ts
// AerariumBar — always visible, even when the grid is collapsed.
```

Selectors: `useGameStore(s => s.rome.treasury)` and the crisis state. Renders, per Finding 1 and Delta 8:

```
AERARIUM: Adequate · 50/100
The Republic: border tensions in the provinces.
```

Line 1 is `calcRomeStatModifiers(rome).treasuryLabel` then the index. **The word "Denarii" must not appear on this line.** Line 2 is the highest-tier crisis track's name from `CRISIS_TIER_LABELS` (lift the map out of `CuriaScreen.tsx:48–53` into `CrisisTile.tsx` and export it), lower-cased into a sentence; when every track is tier 0, "The Republic is at peace with itself." `InfoTap termId="aerarium"`.

```ts
interface CrisisGridProps { collapsed: boolean; onToggleCollapse: () => void; }

interface CrisisTileProps {
  trackId: CrisisTrackId;
  track: CrisisTrack;      // passed in — one subscription in the grid, not four
  onPress: () => void;     // opens the existing CrisisTrackModal
}
```

**Expanded tile:** composited icon (pristine icon + `damageOverlay` + tint from `CRISIS_TIER_VISUAL[track.tier]`), abbreviation, `Math.round(track.level)`. Abbreviations: `WAR` · `UNREST` · `MOS` · `ECON` (Delta 8). **No tier-name text on the tile** (Delta 8) and **no `StatBar`** — the current `CrisisTrackCell` renders one, and there is no room for it.

**Collapsed grid:** one ~32pt row, four coloured pips + numbers, same tap targets, same modal.

**Fallbacks (rule 2):** with no assets present, a tile is a rounded View filled with `CRISIS_TIER_VISUAL[tier].tint`, bordered `.border`, showing the track's existing emoji or first letter. It must look deliberate, not broken. **Test this path explicitly by commenting every line out of the registry.**

**Acceptance:** header ≤150pt expanded, ≤32pt collapsed (measure with `onLayout`, do not eyeball). All five tiers visually distinct at a glance. Zero assets → still legible. Tapping a tile opens the unmodified `CrisisTrackModal`.

---

## Chunk C2 — Sub-tab bar, view shells, navigation

**Goal:** the screen becomes a shell; the three views exist as stubs; deep-links land on the right sub-tab.

**Files to create:** `src/components/curia/SubTabBar.tsx` · `LegesView.tsx` · `NegotiaView.tsx` · `MunificentiaView.tsx` (last three as stubs returning a heading)

**Files to modify:** `src/screens/CuriaScreen.tsx` · `src/state/gameStore.ts` · `src/state/saveLoad.ts` · `__tests__/saveLoad.test.ts` · `src/engine/agendaEngine.ts` · `App.tsx`

### Contracts

```ts
// models/curia.ts (new — types only, per the src/models rule)
export type CuriaSubTab = 'leges' | 'negotia' | 'munificentia';
```

```ts
interface SubTabBarProps {
  active: CuriaSubTab;
  onChange: (tab: CuriaSubTab) => void;
  /** Item count for NEGOTIA; 0 hides the badge. */
  negotiaCount: number;
  /** Renders the badge in critical styling. */
  negotiaCritical: boolean;
}
```

Labels, bilingual like the mockups: `LEGES` / *(Laws)* · `NEGOTIA` / *(Affairs of State)* · `MUNIFICENTIA` / *(Patronage)*.

### Sub-tab state, and the deep-link problem

Active sub-tab is **local `useState` in `CuriaScreen`**, matching the `CitySheet` / `LatiumSheet` precedent — no persistence, no save-schema change.

But `App.tsx` must be able to steer it (Finding 8). Add **one transient store field**, following `selectedTrialId`'s pattern exactly:

```ts
// gameStore.ts — Curia section
curiaSubTabRequest: CuriaSubTab | null;   // transient UI field, excluded from persistence
requestCuriaSubTab: (tab: CuriaSubTab | null) => void;
```

- `INITIAL_STATE.curiaSubTabRequest = null`.
- **Add to `saveLoad.ts`'s strip destructure (`:201–210`)**, alongside `selectedTrialId` / `basilicaReturnTab`. No Zod entry needed — it is stripped on save so it can never appear in a save file, and the schema comment at `:123–126` confirms unlisted fields pass through unvalidated anyway. CLAUDE.md's "any save-shape change updates the Zod schema" rule is satisfied by the field never entering the save shape; **say so explicitly in the chunk summary** rather than leaving a reviewer to wonder.
- **Extend `__tests__/saveLoad.test.ts`'s "truly transient UI fields are still stripped" test (`:99`)** to assert `parsed.curiaSubTabRequest` is `undefined`. This is the one test change in the plan.
- `CuriaScreen` consumes it with a `useEffect`, then clears it — the same read-then-clear shape as `CursusScreen`'s `selectedTrialId` effect.

`App.tsx`'s nav effect gains, after the existing payload block:

```ts
if (uiNavRequest.tab === 'Curia') {
  if (uiNavRequest.billId)  requestCuriaSubTab('leges');
  if (uiNavRequest.trialId) requestCuriaSubTab('negotia');
}
```

Leave the `TODO (P1-C+)` about actually scrolling to a `billId` in place — that is still out of scope; this only fixes the sub-tab.

### Agenda retargeting

`agendaEngine.ts:100` and `:817` — `tab: 'Cursus'` → `tab: 'Curia'` (generators #1 `genTrials` and #26 `genFiledProsecutionPending`). Both keep their `trialId` payload. **These two string literals are the only engine edit in this plan.** Update the SITEMAP §5 prose about generators #1/#26 targeting Cursus in C6, and check `__tests__/agendaEngine.test.ts` for any assertion on those target tabs.

### The screen shell

`CuriaScreen.tsx` becomes: pinned `StateOfRepublicPanel` → conditional alert strip → `SubTabBar` → one of three views in a `ScrollView`. Field-level selectors only (Finding 11). The `ScrollView` keeps `contentContainerStyle={{ paddingBottom: CONTENT_PADDING_BOTTOM }}`.

**Acceptance:** all three tabs switch without the header re-mounting or the grid's collapse state resetting. An agenda tap targeting Curia with a `billId` lands on LEGES; with a `trialId`, on NEGOTIA. `npm test` green including the extended `saveLoad` test.

---

## Chunk C3 — LegesView

**Goal:** bills and active laws, one tab, correct hierarchy.

**Files to create:** `src/components/curia/BillCard.tsx` · `VoteBar.tsx` · `ActionCluster.tsx` · `Tabella.tsx` · `WaxVerdictSeal.tsx` · `LawCard.tsx` · `BillDetailModal.tsx` · `LawDetailModal.tsx` · `SubmitBillModal.tsx`

Move `formatEffectString` + its two label maps (`CuriaScreen.tsx:466–506`) into `src/utils/billEffectText.ts` — both detail modals need it. It is a pure formatter with no React; `actionImpactText.ts` is the precedent for this kind of file, but note that one lives in `engine/` because it is scoped to office actions. A shared string formatter for bill effects is fine in `utils/`.

### Layout

`ROGATIONES · ACTIVE BILLS` heading, right-aligned `+ Submit Bill −10 🤝`, then the bill list. Beneath, `LEGES IN VIGORE · ACTIVE LAWS (n)` as a **collapsed-by-default accordion** — laws grow monotonically across a long game and must never push bills off screen (they are currently expanded by default; changing that default is intentional). Preserve the existing `activeLawsExpanded` behaviour otherwise.

### BillCard

`tabula dealbata` — whitewashed board in a dark frame. Contents: title, `bill.type` tag, `bill.desc`, `bill.turnsLeft`, the `Rome mod` line when `calcRomeStatVoteModifier` is non-zero, `YOURS` badge on `playerSubmitted`, current `playerVote` badge, `ongoingEffect` line. Tapping the body opens `BillDetailModal` (unchanged behaviour).

`WaxVerdictSeal` in the top-right, **three states** (Delta 5), reusing `cursusAssets.waxSeal` tinted by `sealPass` / `sealClose` / `sealFail`. Derive the state from the *existing* verdict logic at `CuriaScreen.tsx:353` — copy it verbatim, do not re-derive thresholds.

### VoteBar (Delta 4)

Two-sided meter: crimson fill leftward and laurel fill rightward from a centre tick at zero, driven by `effectiveSupport` (−100…+100). Ends labelled `A · ANTIQUO` and `VTI ROGAS · V·R`. **No third segment and no "Non Liquet"** (Finding 6, Delta 4). Carved-channel styling via inset border tokens; no asset. Animation is C6's job — build it static here, but hold the value in a way C6 can animate without restructuring.

### ActionCluster + Tabella (Delta 2, Delta 6)

Three embossed coins: `VOTE −4 🤝` · `SPEECH −6 🤝` · `FILIBUSTER −8 🤝` (costs from `bill.voteGravitasCost ?? 4` / `speechGravitasCost ?? 6` / literal 8, exactly as today).

Tapping a coin calls the **existing** `expandBill(bill.id, 'vote' | 'speech')`; the expanded region renders `Tabella` buttons:

- `vote` → `V·R  Vote For (+15 support)` / `A  Vote Against (−15 support)` → `voteBill(id, 'vote_for' | 'vote_against')`
- `speech` → `V·R  Speak in Favour` / `A  Speak Against` → `speechBill(id, 'for' | 'against')`
- `filibuster` → one confirm tablet → `filibusterBill(id)`

⚠️ **Filibuster needs a third expand type.** `expandBill` currently accepts only `'vote' | 'speech'` (`gameStore.ts:729`). Widen that union to include `'filibuster'` — a one-word type change plus the `_expandedType` field's type. This is the *only* store signature change in C3, and it exists to satisfy Delta 6; do not instead special-case filibuster with separate local state, because then the three coins would behave inconsistently.

Support deltas come from `bill.voteForSupport ?? 15` / `voteAgainstSupport ?? 15` — **per-bill, not hardcoded** (Finding 3). Disabled states: `fides < cost`, at 0.4 opacity, exactly as today. Tablets are ≥44pt tall.

### LawCard

Bronze plaque (`bronzeTile`, `bronzePlaque` fallback) with `GildedPanel`-style corner rivets — check whether `GildedPanel` can be reused outright before building rivets again; it already draws four rivets as pure Views with no asset. Top row: `law.name` left, `Expires in n seasons` right (or `Permanent`). Middle: `law.ongoingEffect` via `formatEffectString`. Bottom: inset `Propose Repeal (−10 🤝)`.

Preserve **all three** repeal states from `CuriaScreen.tsx:593–603`: repealable-and-affordable, `Repeal pending` when a repeal bill already targets this law, and **no button at all** when `!law.repealable`. Descriptive text comes from the name-match against `ALL_BILL_TEMPLATES` (Finding 10) — carry the existing explanatory comment across with it.

**Acceptance:** vote, speech and filibuster all resolve to the same store actions with the same costs as before. Every badge, disabled state and repeal state present. Zero assets → cards still read. `npm test` green.

---

## Chunk C4 — NegotiaView, and trials come home

**Goal:** the three conditional Senate surfaces in one tab, with the empty-tab problem solved.

**Files to create:** `src/components/curia/TrialBanner.tsx` · `WarPeaceRow.tsx` · `CommandPanel.tsx` · `CommandAssemblyModal.tsx` · `AlertStrip.tsx`
**Files to move:** `src/components/cursus/BasilicaSheet.tsx` → `src/components/curia/BasilicaSheet.tsx` (move, no re-export left behind)
**Files to modify:** `src/screens/CursusScreen.tsx` · `src/screens/CuriaScreen.tsx` · `src/state/gameStore.ts` · `src/state/saveLoad.ts` · `App.tsx`

### Order within the view

Trials first (most consequential, most time-critical), then War & Peace, then The Command. Each renders only when its condition holds — reuse the *existing* conditions verbatim:

- Trials: `trials.find(t => t.status !== 'resolved')`, plus the resolved-outcome banner (`CuriaScreen.tsx:262–272`)
- War & Peace: `wars.filter(w => w.active && getDesperationTier(w.warScore) !== 'none')`
- The Command: `commandVoteEligible || activeCommand || commandElection?.active`

`TrialBanner` keeps its passive status card (bars via `computeTotalPrepStrength`, seat/charge framing, countdown) but its button changes from `OPEN THE BASILICA →` + `requestNavigation({ tab: 'Cursus', trialId })` to **opening the Basilica sheet in place**, via C0's `DragSheet` rendered by `CuriaScreen`.

`CommandAssemblyModal` moves out of the screen file essentially unchanged. `WarPeaceRow` keeps opening the unmodified `NegotiationScreen`.

### Retiring `basilicaReturnTab` (Finding 13)

Remove the field, `setBasilicaReturnTab`, its `INITIAL_STATE` entry, its `saveLoad.ts:208` strip entry, its `App.tsx:172–175` block, and its use in `CursusScreen`'s `closeBasilica`. Trials now live where the deep-link lands, so there is nothing to un-strand. No migration — the field was already stripped from saves.

`CursusScreen` also loses its `selectedTrialId` open-effect and its `BasilicaSheet` import; `selectedTrialId` / `selectTrialForBasilica` stay in the store, now consumed by `CuriaScreen` instead.

### Empty state and badging (Delta 12)

**Empty state**, when all three conditions are false — written copy, never a blank panel:

> *"Rome is at peace, and no cases stand before the courts."*

**Badge:** `SubTabBar`'s `negotiaCount` = number of live items across all three surfaces; `negotiaCritical` = true when a trial is in session, a treaty awaits a response (`treaty.stage === 'ai_offer'`), or a command assembly resolves this season. Follow `AgendaBadge.tsx`'s pattern: compute in a selector returning a **primitive**, so Zustand's `Object.is` suppresses re-renders (that file's own comment explains why this matters).

**AlertStrip:** one 28pt line in the pinned region, rendered **only** when `negotiaCritical` and the player is not already on NEGOTIA. Tapping switches tabs. This is a deliberate duplicate entry point — normally a smell, justified here because the cost of a missed trial is a character's exile.

**Acceptance:** a trial opens, prepares and resolves entirely within Curia. Cursus has no trial UI and no dead imports. An agenda tap on a trial item lands on Curia → NEGOTIA and opens the sheet. Empty state renders when nothing is live. `npm test` green (watch `commandElection.test.ts` and `trialEngine.test.ts` — both should be untouched by a presentation move; if either fails, something non-presentational changed).

---

## Chunk C5 — MunificentiaView

**Goal:** the six acts as terracotta cards, with every state the current row has.

**Files to create:** `src/components/curia/PatronageCard.tsx`

Lift `MunificenceActRow` (`CuriaScreen.tsx:1154–1205`) and keep its logic **exactly** — `checkMunificenceRequirements`, `getMunificenceCost`, `getMunificenceEffects`, and the `locked` derivation (`!check.ok && check.reason?.startsWith('Requires')`). That string-prefix test is load-bearing: it distinguishes "locked by tier" from "temporarily blocked" and drives two different visual states.

Keep the framing quote and the `grandGamesVoteBonus` note above the list.

Card: terracotta tile. Top row `act.name` + `−40 Denarii` cost badge (multi-part when `cost.fides > 0`). Middle: italic `act.flavor`. Stat row: effect **pills** rather than the current `·`-joined string — same strings from the same `effectParts` construction, just chipped. Bottom: full-width `Donate` button.

**All five states (Delta 11):** default · locked (greyed, requirement text visible, not hidden — P2-F intent) · blocked/cooldown (0.6 opacity + reason) · `isGrandAct` (laurel accent + 🌿) · Aedile discount active (note line). `disabled={!check.ok}` on the button.

**Acceptance:** all six acts render; a locked act reads as aspirational rather than broken; the Aedile discount note appears when `currentOffice === 'aedile'`; `performMunificence` fires unchanged. `munificenceEngine.test.ts` untouched and green.

---

## Chunk C6 — Motion, haptics, glossary, hygiene

**Files to modify:** `package.json` · `VoteBar.tsx` · `CrisisTile.tsx` · `ActionCluster.tsx` · `src/data/glossaryTerms.ts` · `MANUAL.md` · `SITEMAP.md` · plus any component still holding a bare subscription

### Motion

**VoteBar:** animate segment widths on support change, 300ms ease. Hold the previous value in a ref and drive with `withTiming` (`react-native-reanimated ~3.10.1`, already present — Finding 12). A plain re-render jumps.
⚠️ `applyNpcBillReactions` also moves support at **season end**, so this animation fires during the `SeasonOverlay` transition. Verify the two do not visibly fight; if they do, skip the animation when `seasonOverlayVisible`.

**Floating cost text:** on a tablet tap, a `−6 Fides` label drifts up and fades. Local `Animated` in `ActionCluster`; no store field, no new engine.

**Crisis tile flare (Delta 10):** one-shot opacity/scale pulse on the damage overlay when `track.tier` **increases**. Compare against a `usePrevious`-style ref. **No looping animation and no particle system.** Ember glow itself is a static `expo-linear-gradient` (already a dependency).

### Haptics

Add `expo-haptics` to `package.json` (Finding 12 — the one sanctioned dependency change). Light impact on a coin tap; medium on a committed tablet. Guard for web, where `react-native-web` is a supported target.

### Glossary and manual (Finding 14)

Glossary definitions are conventionally sourced from the manual, and the manual has none of this plan's Latin. So:

1. Add a short **Curia vocabulary** subsection to `MANUAL.md`, near the existing "Bills, Munificence, and Crisis" paragraph (`:218`).
2. Mirror it into `glossaryTerms.ts` — entries stay alphabetical by `term`, `relatedTab: 'Curia'`, definitions ≤2 sentences, plain language, no markdown.
3. Wire `InfoTap` at each term's point of use.

Seven terms — see Appendix B.

### Hygiene

- **Sweep for bare `useGameStore()`** across everything this plan created or moved (Finding 11). `PatronageCard` needs care: `checkMunificenceRequirements(state, act)` genuinely reads many fields, so either select exactly what the engine reads or subscribe narrowly and memoize — do not leave the whole-state subscription in place.
- **`SITEMAP.md` §5 (Curia):** rewrite for the new structure — sub-tabs, the `components/curia/` folder, the relocated Basilica.
- **`SITEMAP.md` §3 (Cursus):** the P4-D prose about trial prep living in Cursus, the retired Curia entry-point card, and generators #1/#26 targeting Cursus is now **wrong**. Replace it with an explicit statement that `plans/curia-redesign.md` reversed P4-D and why (Delta 1). Do not delete the history — say it was reversed.
- **Cheatsheet:** add a `Curia UI / sub-tab` row to CLAUDE.md's "Where do I edit?" table if it earns one.

**Acceptance:** `npx tsc --noEmit` zero errors. Full `npm test` green. Every new Latin term has a manual entry, a glossary entry and an `InfoTap`. No bare store subscriptions in `src/components/curia/`.

---

## Appendix A — Asset manifest

All optional. All behind `curiaAssets.ts` fallbacks. The screen must ship and look deliberate with **none** of these present.

### Crisis icons — 4 files

`icon-crisis-war` (shield) · `icon-crisis-unrest` (torch) · `icon-crisis-mos` (fasces) · `icon-crisis-econ` (amphora)

**Generate all four in one session, one prompt scaffold.** Identical canvas, identical lighting direction, matched optical weight, transparent background, **pristine/undamaged**, centred with consistent margin. They sit side by side in a fixed grid — this is the layout where drift between images is most visible, so consistency between these four matters more than the quality of any one.

### Damage overlays — 4 files

`overlay-damage-1` (hairline cracks) · `-2` (heavy cracks) · `-3` (heavy cracks + soot/discolouration) · `-4` (broken edges + ember hotspots)

Transparent layers composited over **all four** icons. Same canvas as the icons. Neutral/greyscale so per-track tinting works from `CRISIS_TIER_VISUAL`. Tier 0 has no overlay.

### Textures — 4 files

`tile-porphyry` · `tile-bronze` · `tile-stone` · `tile-terracotta`

⚠️ **Seamless and tileable, ~256px, flat even lighting, no vignette, no directional shadow, no focal detail.** These go on cards of *varying* height with `resizeMode="repeat"`. AI generation reliably produces non-tileable images with baked-in vignettes and directional light, which look obviously stretched on a 300pt-tall card. Put "seamless tileable texture, flat even lighting, no vignette" in the prompt, and **verify tiling by rendering one at 3× its natural height before accepting it.**

### Coin faces — 3 files (optional)

`coin-vote` · `coin-speech` · `coin-filibuster`. A styled circular View with an emboss border is an acceptable permanent fallback.

**Not needed:** wax seals (reuse `cursusAssets.waxSeal`, tinted three ways) · tablets (shaped Views + text) · rivets (`GildedPanel` draws them as Views).

**Total: 15 files max, 11 of them load-bearing.** Ship `@2x`/`@3x` per the existing `src/assets/images/` convention. Note `cursusAssets.ts`'s recorded lesson: the fresco shipped at ~1010KB against ≤400KB guidance — keep tiles small, they repeat.

---

## Appendix B — Glossary and manual terms

| `id` | Term | Notes for the definition |
|---|---|---|
| `aerarium` | Aerarium | The state treasury as a 0–100 health index, not a coin balance. **Must not imply Denarii** (Finding 1). |
| `rogatio` | Rogationes | Bills before the Senate; the active-bill list. |
| `leges-in-vigore` | Leges in Vigore | Enacted laws still in force, with ongoing per-season effects. |
| `negotia` | Negotia | The Senate's non-legislative business: treaties, extraordinary commands, and the courts (Delta 3). |
| `uti-rogas` | Uti Rogas | The "yes" vote, inscribed V·R on the voting tablet — "as you ask." |
| `antiquo` | Antiquo | The "no" vote, inscribed A — "for the old way." |
| `mos-maiorum` | Mos Maiorum | Ancestral custom; the constitution crisis track measures its erosion (Delta 8's `MOS` abbreviation). |

`munificence` may already have coverage — **check before adding** rather than creating a duplicate id.

---

## Appendix C — Definition of done

- [ ] `CuriaScreen.tsx` is a layout shell, ~250 lines (from 1,220), with ~14 files under `src/components/curia/`
- [ ] Pinned header ≤150pt expanded / ≤32pt collapsed, measured not eyeballed
- [ ] Five crisis tiers on 20% bands, visually distinct, matching `getTierFromLevel`
- [ ] Aerarium never renders the word "Denarii"
- [ ] All three vote verbs work, at unchanged costs, with per-bill support deltas shown
- [ ] Filibuster requires confirmation
- [ ] Wax seal has three states; the vote bar has two sides and no "Non Liquet"
- [ ] Trials open, prepare and resolve entirely within Curia; Cursus has no trial UI or dead imports
- [ ] NEGOTIA badges when populated and reads as written prose when empty
- [ ] Munificentia renders all five card states
- [ ] **Screen renders acceptably with every line of `curiaAssets.ts` commented out** — verified by actually doing it
- [ ] No bare `useGameStore()` in `src/components/curia/`
- [ ] `npx tsc --noEmit` zero errors
- [ ] `npm test` fully green, including the extended `saveLoad` transient-field test
- [ ] `SITEMAP.md` §3 and §5 updated, with P4-D's reversal stated explicitly
- [ ] `MANUAL.md` + `glossaryTerms.ts` + `InfoTap` for all seven terms
- [ ] End-of-task summary lists files changed, new exports/types/store fields, and the two flagged follow-ups: the asymmetric verdict thresholds (§4), and whether the `billId` deep-link should scroll to the bill rather than only landing on LEGES (Finding 8)
