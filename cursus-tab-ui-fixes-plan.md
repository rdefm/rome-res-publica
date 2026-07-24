# Cursus Tab — UI/UX Fix Plan (July 2026)

## How to use this document

This plan addresses a batch of visual/UX bugs reported against the Cursus tab, gathered from live device screenshots and a design-review pass. It's written in the style of this repo's other plan docs (see `qa-audit-fix-plan.md`) — every item below was traced to its root cause by reading the real component it lives in, not inferred from the bug description alone. Two screenshots (device, portrait, scrolled to top and to bottom of the office list) are the ground truth for the visual items; where a fix can't be fully verified from code alone, that's called out explicitly.

**You are on the right branch.** This plan lives on `claude/cursus-tab-ui-fixes-3z1iw8`, which has been reset to start from `cursus-design` (not `main`) — `cursus-design` is where the actual Cursus Tab Visual Redesign (Chunks C0–C5) lives, and every file this plan references only exists there. If you ever find yourself looking at `src/screens/CursusScreen.tsx` and it looks like a flat list with an "Apply" button and no fresco background, you're on the wrong branch/base — stop and re-check `git log --oneline -5` against the commits below before changing anything.

```
a925e03 Cursus redesign: wire up first fresco/icon assets, fix background rendering
d98f9a9 Cursus redesign, Chunk C5: fresco background, scrim, and polish pass
3509850 Cursus redesign, Chunk C4: office cards status, seals, action detail modal
...
```

**Chunk order:** Do B (padding) before E (icon size) — E's icon sizing interacts with B's padding fix (see E's note). Everything else is independent. G and H (contrast fixes) are quick and can be batched together. Do J (verification) last, and also spot-check each chunk with the `run` skill / Expo dev server as you go — these are all visual bugs; `tsc`/`jest` passing does not mean they're actually fixed on screen.

**Ground rules (matching the rest of this repo's plans):**
- Follow CLAUDE.md: styling uses `COLORS`/`FONTS`/`SPACING`/`RADIUS` tokens from `src/utils/theme.ts`, never hardcoded values. Every new token this plan needs already exists in `theme.ts` — check there before adding a new one.
- No gameplay-logic changes. Every fix here is styling, layout, or copy — nothing in `officeStatus.ts`, `gameStore.ts`, or any engine file should change as a result of this plan, except Chunk F's small addition of a status-mapping helper for Tribune (still pure UI wiring, no gate/effect logic touched).
- Run `npx tsc --noEmit` and the affected Jest file(s) after each chunk, not just at the end.

---

## Chunk A — FrescoBackground: dark cutoff / "white bar" at the bottom of the scroll

**Reported bug:** "there's a dark filter on the background at the bottom / under the list of offices. Also, the image cuts off at the bottom when scrolled all the way down, so there's a white bar at the bottom."

**Confirmed on-device** (second screenshot, scrolled to the bottom of the office/Tribune list): below the "Declare Candidacy" card, the fresco image's statue/column texture visibly ends partway down the remaining viewport, and the rest of the space down to the tab bar renders as a flat, hard-edged dark rectangle with no image texture at all — a real discontinuity, not a gradient.

**File:** `src/components/shared/FrescoBackground.tsx`

**Root cause:** `FrescoBackground` renders `cursusAssets.frescoBg` inside an `ImageBackground` whose own box is sized by `flex: 1` (i.e., to whatever height its parent flex chain resolves to — here, the full `CursusScreen` viewport, per `CursusScreen.tsx`'s `frescoRoot: { flex: 1, paddingTop: RESOURCE_BAR_HEIGHT }`). The `<Image>` inside is told to fill via `imageStyle: { top:0,left:0,right:0,bottom:0,width:'100%',height:'100%' }` (lines 63–70) — but percentage-based `imageStyle` sizing on `ImageBackground` is a known RN/Android weak point: it can resolve against the image's own intrinsic/measured box rather than the true final layout height of a `flex:1` container nested several levels deep (`FrescoBackground` → `SafeAreaView` → `View` → `ScrollView` sibling), especially before all ancestor layouts have settled. The `LinearGradient` scrim (lines 39–44) is positioned via `StyleSheet.absoluteFillObject`, which *does* reliably track the true container height — so the scrim keeps darkening all the way to the container's real bottom edge even where the underlying photo has already stopped rendering. Below the scrim's own effective range (locations `[0, 0.6]`, i.e. fully at `scrimBottom` — `rgba(20,14,8,0.88)`, see `theme.ts:57`) with no photo beneath it, you get exactly the hard near-black rectangle in the screenshot. Whether it reads as this dark rectangle or as a lighter "white bar" likely depends on device/aspect ratio (some devices may show the raw un-scrimmed default background — `ImageBackground` has no explicit `backgroundColor` fallback of its own here) — both symptoms share the same root cause: **the photo doesn't reliably cover the full measured height of its `flex:1` container.**

**Fix:**
1. Replace the percentage-based `imageStyle` approach with an explicit-measurement pattern: wrap the `<Image>` in a `View` that uses `onLayout` to capture its own `{ width, height }`, then render the `<Image>` as `position: 'absolute', top: 0, left: 0` with that measured `width`/`height` passed explicitly (not `'100%'`) and `resizeMode="cover"`. This is the standard, reliable fix for this exact class of RN bug — percentage dimensions on an `Image`/`ImageBackground` inside a flex-measured ancestor are unreliable; explicit pixel dimensions from a real `onLayout` measurement are not.
2. Alternatively (simpler, lower-risk first attempt): give `styles.fill` an explicit `backgroundColor: COLORS.bg` so that wherever the photo doesn't reach, you get the app's normal dark background color instead of an unstyled gap — this won't fix the *image* cutting off, but removes the "white bar" failure mode and makes the discontinuity read as "background got a bit darker" rather than "content clipped." Do this as a safety net regardless of whether you also do (1).
3. After either fix, **verify on an actual running instance** (via the `run` skill or `npx expo start` + a connected device/emulator) by scrolling the Cursus office list all the way to the bottom on at least two different simulated screen heights/aspect ratios — this bug is exactly the kind that "looks fine in one viewport, breaks in another," so a single visual check isn't enough.

**Done when:** scrolling the Cursus tab's office/Tribune list to its full extent shows continuous fresco texture + scrim all the way to the tab bar, with no hard-edged flat-color band, on at least two device sizes.

---

## Chunk B — ParchmentCard content padding: "need a bit more gap between card edge and elements within it"

**Reported bug:** "need to move the 'campaign' button a bit more to the left, so there's a small gap between it and the edge of the office 'paper card'. Generally, need a bit more of a 'gap' between the card edge and all elements within it."

**Files:** `src/components/cursus/OfficeCard.tsx`, `src/screens/CursusScreen.tsx` (TribunePanel)

**Root cause:** `ParchmentCard`'s own default content padding is `10` (`src/components/shared/ParchmentCard.tsx`, `content: { padding: 10 }`). Both call sites in this branch override it down to almost nothing:
- `OfficeCard.tsx:167`: `inner: { padding: 2 }`, passed as `contentStyle={rung.inner}` at line 83.
- `CursusScreen.tsx`'s `TribunePanel`, `tp.inner: { padding: 2 }` (same pattern), passed at its own `ParchmentCard` call.

That `padding: 2` is why the CAMPAIGN button, the office icon, and the description text all sit almost flush against the card's real edge — there's no per-element margin fix needed, the whole card's content box is just nearly unpadded.

**Fix:**
1. In `OfficeCard.tsx`, change `rung.inner` from `{ padding: 2 }` to `{ padding: SPACING.sm }` (8px) or `{ padding: SPACING.md }` (16px) — try `SPACING.sm` first and compare against the screenshot's card proportions; go to `SPACING.md` if it still reads tight. Do this **before** Chunk E (icon sizing) — Chunk E's icon change interacts with this padding, see its own note.
2. Apply the same change to `TribunePanel`'s `tp.inner` in `CursusScreen.tsx`, for visual consistency between the two card types.
3. Re-check the CAMPAIGN button specifically after the padding change — `rung.row` (`OfficeCard.tsx:160`) has no explicit gap between the `info` column (`flex: 1`) and the button, so increasing the card's outer padding should be sufficient to pull the button in from the true edge without a separate `marginRight`. If it's still touching the edge after the padding fix, add `marginRight: SPACING.xs` to `rung.applyBtn` (and its Tribune equivalent, once Chunk F wires one in) rather than increasing padding further.

**Done when:** the CAMPAIGN button, description text, and status/tap-hint row all show visible breathing room from the card's rough parchment edge, matching the general spacing of the rest of the app's cards (e.g. `ProvincialClientCard.tsx`) — compare side by side.

---

## Chunk C — CandidateHeader: Intrigus (INT) skill meter overflows the card

**Reported bug:** "the intrigus stat doesn't fit and goes out the right side of the box."

**Confirmed on-device** (first screenshot): "RHE 6" and "MAR 3" render fully inside the maroon candidate-header panel; "INT" is visibly clipped at the card's right edge, with its value/pips pushed off past the border.

**Files:** `src/components/cursus/CandidateHeader.tsx`, `src/components/shared/SkillMeter.tsx`

**Root cause:** `CandidateHeader.tsx`'s `skillsRow` (line 112) renders three `SkillMeter`s with `flexDirection: 'row', justifyContent: 'space-between'` inside `styles.main` (`flex: 1`, itself squeezed between the prev-arrow, the 56px portrait, and the 56px-wide `peek` column showing the *next* candidate). Each `SkillMeter` (`SkillMeter.tsx`) has a fixed minimum footprint: a 26px label + a 14px value + a 10-pip row (`10 × 8px` pips + `9 × 2px` gaps = 98px) + a `SPACING.xs` (4px) margin ≈ **~146px per meter, minimum**. Three of them side-by-side need ~440px+ of width — more than `styles.main` has left after the portrait/arrows/peek column on a typical phone screen (~350–400px wide device, `main` likely has under 300px available). `justifyContent: 'space-between'` doesn't shrink the children to fit; it just overflows the row, and the last (rightmost) meter — Intrigus — is the one that visibly runs past the card's edge.

**Fix — do not just shrink Intrigus specifically; fix the row's ability to fit all three:**
1. In `SkillMeter.tsx`, reduce the pip count's footprint for this specific use — the simplest lever without changing the component's public shape: shrink `pip`/`pipEmpty` from `8×8` to `6×6` and their `gap` from `2` to `1` (saves ~30px per meter, ~90px across three), and/or shrink `label`'s fixed `width: 26` down to `20` (saves 6px × 3 = 18px) if `RHE`/`MAR`/`INT` still fit at that width without wrapping.
2. If (1) alone isn't enough (verify visually — don't guess), change `CandidateHeader.tsx`'s `skillsRow` from `justifyContent: 'space-between'` to `justifyContent: 'flex-start'` with an explicit `gap` (e.g. `SPACING.xs`) between meters instead — `space-between` is actively making this worse by spreading the three metersto the row's full (insufficient) width rather than letting them sit compactly.
3. If both of the above still don't fit on a narrow device, the last resort is reducing `max` pips shown compactly (e.g. a smaller pip target of 5 "chunks" each representing 2 points instead of 10 individual pips) — flag this to the user before doing it, since it changes the stat's visual granularity, not just its size.
4. Whichever combination you land on, verify by rendering `CandidateHeader` with a character whose `intrigus` is high (near 10, i.e. all pips filled — the worst case for width) on the narrowest device/simulator width available.

**Done when:** all three of RHE/MAR/INT render fully inside the candidate-header panel's right edge with no clipping, at `intrigus` values from 0 to 10, on the narrowest supported device width.

---

## Chunk D — Character portrait: circle-with-initials vs. real portrait (asset gap, not a code bug)

**Reported bug:** "the circle with a character's initials: let's replace with the character portrait."

**Important finding — read before touching code:** `PortraitRoundel.tsx` (`src/components/shared/PortraitRoundel.tsx`) **already does this**. It calls `portraitAssets.portrait(key)` (and `portraitAssets.leaderOverride(...)` for clan leaders) and only falls back to the initials circle (`initialsFor(subject.name)`, lines 21–26/45–49) when no image asset resolves for that character. The "MB" and "LB" circles in the screenshots are that fallback path working exactly as designed — not a bug in `PortraitRoundel` itself.

**Root cause:** `src/utils/portraitAssets.ts`'s asset pool is nearly empty right now — only `portrait-paterfamilias.png` (+`@2x`/`@3x`) exists under `src/assets/images/`. There is no portrait art yet for arbitrary family members/rivals by age/gender/etc., so `portraitAssets.portrait(key)` returns `undefined` for almost every character, and every card falls back to initials.

**This is not something code alone can fix.** Do **not** attempt to "wire up" a portrait that doesn't exist, and don't build a new portrait-rendering path — one already exists and is correct. There are two real options, and the choice is a content/production decision, not an engineering one:
1. **Add real portrait art** to the pool (a set of generic age/gender-banded portrait images, per whatever key scheme `portraitEngine.ts`'s `portraitKeyFor`/`characterPortraitSubject` already generates — read that file to see the exact key space before commissioning/sourcing art) and register them in `portraitAssets.ts`, following the same `require(...)` pattern as `portrait-paterfamilias.png`.
2. **Leave the initials fallback as the intended design** for now (it's a reasonable placeholder state, and the code comment on `PortraitRoundel.tsx` explicitly documents this as "the expected state for the whole pool until art lands") and treat this item as closed for this UI-fixes pass.

**Action for this plan:** stop here and ask the user which of (1) or (2) they want — if (1), ask whether they're supplying the art assets themselves or want you to source/generate placeholders, since that materially changes scope (this could be a one-line asset-registration change or a much larger content task). Do not guess.

---

## Chunk E — Office icons: make bigger, fill the left "square," text starts to its right

**Reported bug:** "make office icons bigger, maybe take up the whole left square, and text begins to the right of it."

**File:** `src/components/cursus/OfficeCard.tsx`

**Current state:** `officeIconImg` renders at `44×44` (`rung.iconImg`, line 165) when a real icon asset exists (currently only `vigintivirate` and `quaestor` have one — see `src/utils/cursusAssets.ts`'s `OFFICE_ICONS` map; `aedile`/`praetor`/`consul`/`censor`/`dictator`/`tribune` are commented out and fall back to `office.icon`'s plain emoji at `fontSize: 24`, `rung.icon`, line 161). There's already a code comment here noting a prior bump from `28→44` "per user feedback" — this request is asking to go further still.

**Fix:**
1. Introduce a fixed-size icon "slot" instead of an organically-sized inline icon, so the name/desc text column starts at a consistent x-position regardless of whether an office has a real icon asset or falls back to the emoji. Wrap the icon in a fixed-size container (e.g. a new `iconSlot: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md }` style) and:
   - Real icon: `rung.iconImg` becomes `{ width: 52, height: 52 }` (slightly under the slot to leave a hair of breathing room) inside that slot, `resizeMode="contain"` unchanged.
   - Emoji fallback: bump `rung.icon`'s `fontSize` from `24` to roughly `40` so it visually fills a comparable footprint inside the same slot.
2. Remove the existing ad-hoc `marginLeft: SPACING.xs` "nudge" on `rung.iconImg` (line 165's comment says this was specifically compensating for the card's tight edge padding) — **do this only after Chunk B's padding fix lands**, since Chunk B already gives the whole card breathing room from its edge; keeping both the nudge and the new padding will likely overcorrect and push the icon too far right, oddly close to the text column.
3. Verify `rung.row`'s `alignItems: 'center'` still vertically centers the (now taller) icon slot against the 3-line text column (name/latin/meta) — a 56px-tall icon next to 3 lines of ~15/11/10px text should center reasonably, but check visually since the icon is now taller than the text block.

**Done when:** every office card's icon — real asset or emoji fallback — renders at a visually consistent, larger size filling a dedicated left-hand slot, with the name/Latin/meta text column starting immediately to its right at a consistent x-position across all eight offices.

---

## Chunk F — Locked-office status: badge/hint swap + distinct locked Campaign-button style

**Reported bugs (two related items from the notes):**
1. "higher offices say 'LOCKED - requires aedile' (for example), which is good. But this should be on the right hand side under 'CAMPAIGN' button, and then the 'tap for powers' should be back on the left hand side, where it is for eligible offices."
2. "The Aedile card displays a gray badge reading LOCKED · Requires Quaestor, but its CAMPAIGN button uses the exact same active gold style as the unlocked offices above it. Fix: Gray out, dim, or replace the CAMPAIGN button with a locked icon state."

**Important finding — this already exists, it's a positioning/styling fix, not new UI:** `OfficeCard.tsx`'s `sealRow` (lines 110–113) already renders exactly this: `<StatusSeal status={status} reason={reason} />` then `<Text style={rung.tapHint}>Tap for powers ›</Text>`, laid out with `flexDirection: 'row', justifyContent: 'space-between'`. `StatusSeal.tsx` (lines 55–63) already renders the `LOCKED · Requires X` chip for locked offices, sourced from `officeStatus.ts`'s `getOfficeStatus` (`reason` field, e.g. `` `Requires ${prereqOffice.name}` `` at line 66, or `` `Min age ${office.minAge}` `` at line 62). Confirmed exactly matching the screenshot (Aedile card: "LOCKED · Requires Quaestor" on the left, "Tap for powers ›" on the right).

**Current layout (both confirmed on-device):**
- Eligible office (e.g. Vigintivirate): `StatusSeal` returns `null` for `'eligible'` status (`StatusSeal.tsx:67`) → `sealRow` has one real child (`tapHint`), which lands on the **left** under `space-between` with nothing to push against.
- Locked office (e.g. Aedile): `StatusSeal` renders the `LOCKED` chip as the first child → it takes the **left** slot, pushing `tapHint` to the **right**.

**Fix for item 1 — swap the pairing so "tap for powers" position is status-independent:**
Restructure `sealRow` so `tapHint` always renders in a fixed left-hand slot and the status indicator always renders in a fixed right-hand slot (under where the CAMPAIGN button sits above it) — i.e. swap the JSX order of `<StatusSeal .../>` and `<Text style={rung.tapHint}>` at `OfficeCard.tsx:110-113`, or (cleaner) keep `sealRow`'s `justifyContent: 'space-between'` but explicitly render `tapHint` first and `StatusSeal` second regardless of status, so eligible offices (which render nothing for the seal) still show `tapHint` on the left exactly as they do now, and locked offices now show `tapHint` on the left + the `LOCKED` chip on the right, under the (now visually-locked, see below) CAMPAIGN button.

**Fix for item 2 — give the locked CAMPAIGN button its own distinct visual state:**
`showApplyBtn = status === 'eligible' || status === 'locked'` (`OfficeCard.tsx:58`) and `canApply = status === 'eligible'` (line 59) mean the button is visible-but-disabled specifically (and only) when `status === 'locked'` — i.e. every disabled CAMPAIGN button on this screen is the locked case, there's no other disabled reason to preserve. Currently `applyBtnDisabled: { opacity: 0.4 }` (line 173) just dims the same gold/amber-styled button (`applyBtn`, line 172: `backgroundColor: COLORS.amber + '22', borderColor: COLORS.amber`) — same hue, just faded, which reads as "still tappable, just faint" rather than "locked." Replace this with a genuinely distinct locked style: e.g. `applyBtnLocked: { backgroundColor: COLORS.border + '22', borderColor: COLORS.lockedText, opacity: 1 }` (using the same `lockedText`/`border` tokens `StatusSeal` already uses for its own locked chip, so the two locked indicators — chip and button — read as the same "locked" language), and swap the button's text color/label similarly (e.g. `applyTextLocked: { color: COLORS.lockedText }`, and consider replacing the `CAMPAIGN` label with a small `🔒` prefix or swapping to a literal `LOCKED` label — check with the user which they prefer before choosing, it's a small copy decision).

**Done when:** eligible offices show `Tap for powers ›` on the left with no chip (unchanged from today); locked offices show `Tap for powers ›` on the left and the `LOCKED · Requires X` chip on the right, roughly under the CAMPAIGN button; the CAMPAIGN button on a locked office is visually distinguishable at a glance from an eligible office's CAMPAIGN button (different color scheme, not just lower opacity of the same colors).

---

## Chunk G — Tribune of the Plebs: add the same status/tap-hint row

**Reported bug:** "tribune of the plebs doesn't have 'tap for powers', let's add it."

**File:** `src/screens/CursusScreen.tsx` (`TribunePanel`, lines ~39–146)

**Root cause:** `TribunePanel` predates the `OfficeCard`/`StatusSeal`/`OfficeActionsModal` redesign (Chunk C4) and was never migrated to match — it still renders its own bespoke `tp.badge` chips (`IN OFFICE` / `CANDIDACY`) inline in the header row, with no `sealRow`-equivalent and no tap-to-open-modal affordance at all. Tapping the Tribune card today does nothing.

**Fix — bring Tribune to parity with `OfficeCard`, don't just paste in a label:**
1. Compute a `TribuneStatus` equivalent to `OfficeStatus` from the eligibility booleans already in `TribunePanel` (`isHolder`, `isCandidate`, `ageOk`, `noOtherOffice`, `tribuneFree`) — map: `isHolder → 'held'`, `isCandidate → 'active'`, `isEligible → 'eligible'`, everything else → `'locked'` with a `reason` string built from the same three `ineligible`-branch conditions already computed at lines 418–425 (age / already-holds-office / occupied-by-someone-else).
2. Add a `sealRow`-equivalent below the description, reusing `StatusSeal` directly (it's generic over `StatusSealStatus`, not Cursus-office-specific) and a `Tap for powers ›` hint, positioned exactly per Chunk F's fixed layout (hint always left, status chip always right).
3. Wrap the whole `ParchmentCard` in a `TouchableOpacity` (matching `OfficeCard.tsx:82`) that opens `OfficeActionsModal`, passing `office={TRIBUNE_OFFICE}` (already an `Office`-shaped constant, exported from `data/offices.ts` and already imported in this file) and your new mapped status. `OfficeActionsModal` is generic over any `Office` + `OfficeStatus`/character combination — it doesn't need a Tribune-specific variant.
4. Existing Tribune-specific content (`immunity` block, `pending` block, `occupied`/`declareBtn`/`ineligible` text) all stay exactly as-is, just add to it rather than replacing it — this is additive, not a rewrite.

**Done when:** the Tribune card shows the same status-chip + "Tap for powers ›" row as ladder offices, and tapping the card opens `OfficeActionsModal` showing the Tribune's `inOfficeActions` (same read-only preview any non-held ladder office shows, or the live action list when the player holds it).

---

## Chunk H — Low-contrast text: section headers + any text sitting directly on the fresco

**Reported bugs (from the design-review notes):**
1. "Dark brown font on a dark background image; almost unreadable." → "Lighten font to gold/cream or add a subtle drop shadow/backing panel."
2. "Section Header ('OFFICES'): Very dark brown against dark background." → "Increase contrast ratio to hit standard AAA readability."

**File:** `src/screens/CursusScreen.tsx` (bottom `styles` block)

**Root cause — found by comparing this file's own two conventions side by side:** `styles.title` and `styles.subtitle` (the "CURSUS HONORUM" header) **already got a legibility fix** for exactly this problem — both carry `textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: {width:1,height:1}, textShadowRadius: 2-3` (lines 569–571, 579–581), on top of using `COLORS.gold`/`PARCHMENT_TEXT.muted`. `styles.sectionLabel` (the "OFFICES" / "TRIBUNE OF THE PLEBS" headers, line 585) — which sits in the exact same place, directly on the fresco background with no card behind it — never received the same treatment: it's just `color: COLORS.goldDim` (a notably darker/muted gold, `#7a6230`) with no shadow at all. Against the darker regions of the fresco image (the statue silhouettes visible in both screenshots), `goldDim` with no shadow is the low-contrast case being reported.

**Fix:**
1. Add the same `textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2` treatment already used by `styles.title`/`styles.subtitle` to `styles.sectionLabel`.
2. Additionally, consider switching `sectionLabel`'s color from `COLORS.goldDim` to `COLORS.gold` (the brighter token already used by `styles.title`) — `goldDim` was presumably chosen for a subtler, secondary-heading feel, but combined with sitting directly on a busy photographic background (rather than a flat or card surface), that subtlety is exactly what's reading as "almost unreadable." Try the shadow fix alone first, then decide if the color also needs to change.
3. **Audit for other instances of the same pattern** while you're in this file: anything using `PARCHMENT_TEXT.heading`/`PARCHMENT_TEXT.muted` (both dark-brown tokens meant for use *inside* a light parchment card) that might currently render directly on `FrescoBackground` rather than inside a `ParchmentCard`/`GildedPanel` — those are the same bug wherever they occur. Grep this file and `CandidateHeader.tsx`/`OfficeCard.tsx` for `PARCHMENT_TEXT` usage outside a `ParchmentCard`'s `contentStyle` and check each one against a screenshot.

**Done when:** "OFFICES" and "TRIBUNE OF THE PLEBS" headers are clearly legible against the darkest parts of the fresco background image, matching the legibility of the already-fixed "CURSUS HONORUM" title directly above them.

---

## Chunk I — Bottom tab bar: low-contrast inactive icons

**Reported bug:** "Light gray line icons on off-white marble background provide very poor visual contrast." → "Darken inactive icon line weights (dark bronze or charcoal)."

**Confirmed on-device** (both screenshots): DOMUS / FORUM / PROVINCIAE / CURIA icons and labels are a faint tan, noticeably harder to read than the active crimson-tinted CURSUS icon, against the light marble tab-bar background.

**File:** `src/components/shared/TabBar.tsx`

**Root cause:** `renderTabIcon` (line ~36 on this branch — the function gained a `badge` parameter from the Campaign Map work but this logic is unchanged) sets `const tint = focused ? COLORS.crimson : '#9a8060';` — `#9a8060` is a light warm tan, applied both to the icon's `tintColor` and the label text color, against the light marble background rendered by `TabBarBackground`. This is a plain contrast-ratio problem, not a layering/z-index bug — confirmed unchanged from `main`, i.e. pre-existing, not something introduced by the Cursus redesign.

**Fix:**
1. Add a new token to `theme.ts` for this — don't hardcode a new hex directly in `TabBar.tsx` (per CLAUDE.md's token rule). Something like `tabInactive: '#6b5638'` (a dark bronze) or reuse an existing dark, warm token already in the palette if one fits (check `goldDim`/`goldBronze`/`panelWood` for something appropriately dark against light marble — `goldBronze: '#a07840'` is still fairly light; you likely want something darker, closer to `waxFrame: '#5a3c1a'` or a new dedicated token).
2. Replace the inline `'#9a8060'` literal in `TabBar.tsx` with the new/chosen token.
3. Check contrast against the actual marble background asset (`marble_rectangle.png`) — not just against a flat swatch — since the marble texture has its own light/dark variation; verify the new tint reads clearly across the whole tab bar width, not just in isolated spots.

**Done when:** inactive tab icons/labels (Domus, Forum, Provinciae, Curia when not focused) are clearly readable against the marble tab bar background, at a contrast level comparable to the active (crimson) tab.

---

## Chunk J — Resource delta indicators: low-contrast, no sign coloring

**Reported bug:** "Stat Delta Indicators (+12, +0): Small, thin text that blends into the background." → "Increase font size slightly and use distinct green/red delta colors."

**File:** `src/components/shared/ResourceBar.tsx`

**Root cause:** `ResourceItem`'s projected-income text (lines 36–38) renders via `styles.resourceProjected` (lines 207–211): `fontSize: 10, color: COLORS.dust` — a single static muted tan-grey color, applied unconditionally regardless of whether `projectedIncome` is positive, negative, or zero. There is no sign-based branching at all currently (contrast this with `styles.resourceValue`, the main number, which *does* get a dynamic `color: tintColor` per-resource, just not per-sign).

**Fix:**
1. Bump `resourceProjected.fontSize` from `10` to `11` or `12`.
2. Add sign-based coloring: pass a computed color into the `Text` at line 36 based on `projectedIncome`'s sign — e.g. `projectedIncome > 0 ? COLORS.laurel : projectedIncome < 0 ? COLORS.crimson : COLORS.dust` (laurel/crimson are this codebase's existing positive/negative tokens — check their usage elsewhere, e.g. `ep.rankBadgeWin`/`ep.rankBadgeLose` in `CursusScreen.tsx`, for precedent before picking different tokens). Zero stays neutral (`COLORS.dust`) since it's neither a gain nor a loss.
3. This is a small, self-contained component change — while in this file, note per `qa-audit-fix-plan.md`'s Chunk D that `ResourceBar.tsx:5` currently has a dead import (`getCrisisColour` from `crisisEngine.ts`, which doesn't exist) that a prior audit already flagged; if that audit's Chunk D hasn't landed yet by the time you're in this file, feel free to remove the dead import too, but don't go looking for other unrelated issues here — stay scoped to the delta-color fix.

**Done when:** projected income deltas in the top resource bar are legibly sized and colored green (gain), red (loss), or neutral (zero) — verify against both a positive and a negative `fides`/`denarii` income state (check `__tests__/` or the debug panel for an easy way to force a negative income state for visual testing).

---

## Chunk K — Verification

Run after every chunk above, not just once at the end:
- `npx tsc --noEmit` — must stay clean (or at least not regress) on every file touched.
- `npx jest` — run the full suite; nothing in this plan should change engine behavior, so no test should need updating. If a snapshot or UI-adjacent test breaks, that's a signal you've drifted into a logic change — stop and reconsider before "fixing" the test.
- Visual verification via the `run` skill (or `npx expo start` + a connected device/emulator/simulator) for every chunk marked "Confirmed on-device" above, and for Chunk C/E/G specifically since those change layout in ways that are easy to get subtly wrong from code-reading alone. Test both the "top of the office list" and "scrolled to the bottom" states (Chunk A specifically depends on this), and at least one narrow-width device for Chunk C/E.
- End-of-task summary per CLAUDE.md: list every file changed, note Chunk D's open decision (portrait art sourcing) if it wasn't resolved, and flag anything from this plan you deliberately skipped or deferred.
