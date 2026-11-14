# Spec 15 — Accessibility pass

**Source:** `plans/go-live-review-and-plan.md` §4.5 (zero UI tests), §4.6, workstream H · **Priority:** P1 · **Phase:** 3 — Ship (start earlier if possible; it touches every screen)
**Triage:** `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **Zero accessibility props.** There are 0 occurrences of `accessibilityLabel`, `accessibilityRole`, `accessible=`, `allowFontScaling` or `maxFontSizeMultiplier` in `src/` or `App.tsx`. Confirmed.
2. **Scale of the surface:** 595 `TouchableOpacity`/`Pressable` usages and 832 `fontSize:` declarations across `.tsx` files.
3. **Color- or icon-only signals:** the crisis tiles show an icon and a number with no text label, and the vote labels on bill cards are low contrast (both from the plan's web-build review; re-confirm on device). The battle bar's color-means-class bug is handled in spec 10.
4. **Zero UI tests.** All test suites are engine or store tests. This spec needs a minimal component-test harness, and so do specs 02, 03 and 09 lightly. `jest-expo` is already the preset, so `@testing-library/react-native` is the natural addition.
5. The glossary (`data/glossaryTerms.ts`, about 95 entries) and `InfoTap` already give a pattern for explaining terms that a screen reader can reuse.

## Problem Statement

A player who uses VoiceOver or TalkBack can't play: every control is an unlabelled button, and important state (crisis levels, vote tallies, resources) is carried by icons and colors. A player who sets a larger system font either gets no scaling or a broken layout, because nothing has been checked. Some text fails contrast in normal use. Both stores increasingly expect basic accessibility, and the audience for a text-heavy strategy game skews towards people who'll notice.

## Solution

Make the game usable with a screen reader and with larger text, and make every signal readable without color:

- Labels and roles on every interactive control, using shared components so most of the work happens in a few places.
- Accessible text for icon-and-number displays (resources, crisis tiles, vote tallies).
- A defined font-scaling policy (scale up to a cap) with layouts checked at that cap.
- A contrast audit of the theme tokens, fixing failures at the token level.

This spec also introduces the repo's first UI-test harness, which other specs reuse.

## User Stories

1. As a VoiceOver or TalkBack user, I want every button to announce what it does ("End Season", "Canvass Cornelii, costs 10 Fides"), so that I can operate the game.
2. As a screen-reader user, I want the five tabs announced with their names and selected state, so that I can navigate.
3. As a screen-reader user, I want resources announced as "Denarii 200, plus 5 per season", not "coin icon 200", so that I understand my position.
4. As a screen-reader user, I want each crisis tile announced with its name, level and tier, so that I know which crisis is rising.
5. As a screen-reader user, I want modals to take focus when they open and return it when they close, so that I always know where I am.
6. As a screen-reader user, I want the presentation queue's active surface (spec 03) to be the only focusable layer, so that I can't wander behind a modal.
7. As a screen-reader user, I want glossary terms to announce their definition hint, so that InfoTap works for me too.
8. As a screen-reader user, I want disabled actions announced as disabled with the reason ("Requires Quaestor"), so that I understand the gate.
9. As a screen-reader user, I want the tutorial spotlight and captions announced, so that the guided path is usable.
10. As a screen-reader user, I want battle zone states available as text (spec 10's view model), so that battles are playable.
11. As a player with large system text, I want text to scale up to a sensible cap without clipping or overlapping, so that I can read comfortably.
12. As a player with large system text, I want dense numeric badges to cap their scaling, so that layouts don't break.
13. As a player in bright light or with low vision, I want all body and label text to meet WCAG AA contrast, so that I can read everything.
14. As a color-blind player, I want no information carried by color alone (good/bad log entries, vote for/against, side colors in battle), so that I can tell states apart.
15. As a player with motor impairments, I want touch targets at least 44 × 44 pt, so that I can hit controls reliably.
16. As a player sensitive to motion, I want animations reduced when the system's reduce-motion setting is on, so that the game is comfortable.
17. As a developer, I want shared button, tab and badge components to carry accessibility props by default, so that new UI is accessible without extra work.
18. As a developer, I want a UI-test harness with an example test, so that accessibility (and other UI behaviour) can be tested.
19. As a developer, I want a guard test that fails when a `Pressable`/`TouchableOpacity` has no accessible label, so that regressions are caught.
20. As a release manager, I want an accessibility section in the release checklist with device-tested results, so that store questionnaires can be answered truthfully.

## Implementation Decisions

- **UI-test harness:** add `@testing-library/react-native` as a dev dependency (tooling change, done explicitly here), plus a small render helper that wraps components with the store and navigation providers. The first tests are the ones in this spec. Specs 02, 03 and 09 reuse the helper.
- **Shared primitives:** introduce or upgrade shared accessible primitives (a themed pressable button, icon-plus-value badge, tab button) that **require** an `accessibilityLabel` prop (type-level) and set `accessibilityRole`. Migrate the 595 touchables in waves, screen by screen. Each wave is a PR.
- **Composite readouts:** the resource bar, crisis tiles, vote tallies and bill status expose a single `accessibilityLabel` string built from the same data the visuals use.
- **Glossary integration:** `InfoTap` sets `accessibilityHint` from the glossary entry.
- **Focus management:** each queue surface (spec 03) sets `accessibilityViewIsModal` (iOS) and `importantForAccessibility` (Android) on the layers behind it.
- **Font scaling policy:** allow scaling and set a global `maxFontSizeMultiplier` cap (default proposal 1.5; design-lead confirm), with a lower cap for dense numeric badges. Check layouts at the cap on a small device.
- **Contrast:** audit `theme.ts` color tokens against their usual backgrounds and adjust failing tokens at the token level (not per component). Record the ratios in a comment next to the tokens.
- **Non-color signals:** add text or shape cues wherever color alone carries meaning (for example a +/− glyph on log entries, and "For"/"Against" text on votes).
- **Reduce motion:** read `AccessibilityInfo.isReduceMotionEnabled` and shorten or skip non-essential animations (battle effects, overlays).

## Testing Decisions

- **Seam: the shared primitives.** A component test asserts that each primitive exposes role and label. The type-level required label is the main guard.
- **Seam: composite readouts (pure label builders).** Given state, the resource and crisis label builders produce the expected strings. These are plain functions, so they're cheap and stable.
- **Guard test:** a static scan (with the spec 14 repo-lint file) that fails on a touchable with no label outside the shared primitives (with an allowlist that shrinks wave by wave).
- **Device verification:** a VoiceOver and TalkBack walkthrough of the first season (start, each tab, End Season, an event), recorded in the release checklist. This is the real done-when; automated tests guard against regressions.
- Good tests assert what a user perceives (role, label, state), not prop plumbing.

## Out of Scope

- Localisation (decision §6.11, spec 16).
- Full keyboard or switch-control support beyond what the platforms give for free.
- Audio descriptions.

## Further Notes

- The crisis-tile labels and vote-label contrast also appear in spec 08. Whichever spec lands first fixes them, and the other references it.
