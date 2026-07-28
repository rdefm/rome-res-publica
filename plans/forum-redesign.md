# Rome: Res Publica — Forum Tab Redesign Plan

## How to use this document

This plan turns Forum's current flat-background, always-scroll-past-collapsed-cards clan list into a compact always-visible clan grid + a single inline detail zone below it, plus a visual pass (background art, per-clan accent color) matching the treatment Curia and Domus already got. It follows the same structure as `curia-redesign.md`/`cursus-visual-redesign-plan.md` — read the whole thing before writing code, especially §3 (Findings), which settles a few things a from-memory implementation would get wrong.

**Chosen approach: inline swap, not a bottom sheet.** Both were discussed with the user. A `DragSheet` (as used by Provinciae's map and Curia's Basilica) would look slightly more "modal," but costs more (new sheet-open/close state, re-testing every tutorial target inside a new sheet context, and the same stale-scroll risk already fixed once in `CitySheet.tsx` this session) for no material improvement on the actual complaint. Inline swap fixes the complaint — "scrolling down to open each Gens" — completely, using less new code and less tutorial-retargeting risk.

---

## 1. Scope

**In scope — presentation layer + one small data addition.**

- Replace `ClanCard`'s per-clan accordion (`ForumScreen.tsx`'s `clans.map(clan => <ClanCard clan={clan} />)`, each independently collapsible) with:
  - A compact, always-visible grid of 4 clan tiles (2×2 or a row — see C0).
  - One "detail zone" below the grid, rendered once, showing whichever clan is currently selected (leader strip + reputation bar + `LeaderDetailPanel`) — never more than one clan's detail content on screen at a time, and the grid itself never scrolls away.
- Add a background art treatment for Forum (`ImageBackground`/texture, matching Domus's fresco / Curia's stone tiles), shipped through a new commented-out-by-default asset registry (`utils/forumAssets.ts`, same pattern as `cursusAssets.ts`/`curiaAssets.ts`/`domusAssets.ts`).
- Add a per-clan accent color, sourced from existing `theme.ts` tokens (no new hex literals) — see Finding 4 for where this field belongs.
- Restyle the clan tile and detail-zone header to use the new accent color + (once art lands) the background treatment.

**Out of scope — do not change:**

- Any engine logic: `reputationEngine.ts`, `electionEngine.ts`, `secretEngine.ts`, `npcSecretDecision`, election/canvass math, relationship math. This is a presentation-layer plan.
- `DossierPanel.tsx` and `CanvassingPanel` (inline in `ForumScreen.tsx`) — both already self-hide when empty/inactive and already sit above the clan directory. They stay exactly where they are, unchanged. See Finding 3 for why a separate "needs attention" banner was considered and dropped.
- The `expandedClanId`/`selectedLeaderId` store fields and `expandClan`/`selectLeader` actions (`gameStore.ts:334-335`, `:782-783`, `:2337-2338`) — see Finding 1. No store/schema change needed for the IA restructuring itself.
- `LeaderCard.tsx`, `LeaderDetailPanel.tsx`'s internal content/actions (Buy Influence, Invite to Dinner, etc.) — only their host container changes, not their own logic or layout.

---

## 2. Ground rules for the implementing chat

**Before writing anything, read:**
`src/screens/ForumScreen.tsx` (full) · `src/components/forum/ClanCard.tsx` (full) · `src/components/forum/LeaderCard.tsx` · `src/components/forum/LeaderDetailPanel.tsx` · `src/components/forum/DossierPanel.tsx` (just its self-hide gate, `:344`) · `src/components/shared/useTutorialTarget.ts` (the `scrollRef` param added this session) · `src/engine/tutorialEngine.ts`'s `TUTORIAL_TARGET_IDS` · `src/data/tutorialScript.ts`'s `PROLOGUE_ACT2_STEPS` · `src/utils/cursusAssets.ts` and `src/utils/domusAssets.ts` (the asset-registry pattern to copy verbatim) · `src/utils/theme.ts` · `src/models/clan.ts` · `src/data/startingClans.ts`.

**Rules:**

1. **Every asset ships behind a code fallback.** `forumAssets.ts` follows `cursusAssets.ts`'s exact shape: `require()` lines commented out until the file exists in `assets/forum/`, every consumer renders a fallback (flat `COLORS.bg`, same as today) when the asset is absent. Do not block this plan on art being ready.
2. **Styling comes from `theme.ts` tokens only.** Per CLAUDE.md, a per-clan accent color must **reference** an existing `COLORS` value (`export const corneliiAccent = COLORS.gold;`), never restate a hex literal. If a genuinely new color is needed for a clan, add it to `theme.ts` first, with a comment explaining why the existing palette didn't cover it.
3. **Field-level selectors.** Any new/changed component subscribes with `useGameStore(s => s.field)`, not a bare `useGameStore()`. Check `ClanCard.tsx:125`'s current `const { expandedClanId, selectedLeaderId, expandClan, selectLeader, familyReputations, electionRivals } = useGameStore();` while you're in the file — CLAUDE.md's rule is to fix this kind of thing when touching the file, not just avoid adding new instances of it.
4. **Tutorial targets must keep working — verify, don't assume.** Three targets currently live inside the code this plan restructures: `forum.clan.valeria` (today: `ClanCard.tsx:131`, the collapsible header `TouchableOpacity`), `forum.leader.valerius-flaccus` (`LeaderCard.tsx`, inside the per-clan horizontal leader strip), `forum.action.invite-dinner` (`LeaderDetailPanel.tsx` via `ForumActionBtn`'s `tutorialTargetId` prop). All three need their `ref`/`onLayout` wiring re-homed to wherever their control ends up (the tile, or the detail zone), and `useTutorialTarget`'s `scrollRef` param (added this session specifically to fix these two targets scrolling into view — see `SITEMAP.md`'s "Second tutorial-fixes pass" entry) needs to keep pointing at whatever `ScrollView` still contains them. This restructuring likely *simplifies* that wiring (one page-level `ScrollView` instead of threading a ref through `ClanCard` → `LeaderDetailPanel` → `ForumActionBtn`), but confirm it, don't assume it.
5. **`npx tsc --noEmit` zero-error and `npm test` clean at the end of every chunk.**
6. **Update `SITEMAP.md` §2 (Forum) in the same chunk that changes a file's responsibility.**

**Chunk order:** C0 → C1 → C2. C1 depends on C0's tile component existing. C2 is polish/verification and should run last regardless of how C0/C1 land.

---

## 3. Findings — verified against the code this pass

**Finding 1 — the store already models "one clan's detail visible at a time"; this is a pure layout fix, not a state redesign.**
`expandClan(clanId)` (`gameStore.ts:2337`) unconditionally sets `expandedClanId: clanId, selectedLeaderId: null` — it does not toggle. `ClanCard.tsx`'s current `onPress={() => expandClan(clan.id)}` (`:139`) has no close-on-second-tap branch either. So today's actual state shape is already "single-select," not "multi-open accordion" — the *visual* bug is purely that `ClanCard`'s expanded content renders inline, in whatever vertical position that clan happens to occupy in `clans.map(...)`, forcing a scroll past every clan above it. Reuse `expandedClanId`/`selectedLeaderId` as-is for the new grid+detail-zone split; no new store field is needed.

**Finding 2 — clan order is fixed and Valerii is 2nd, which is why the tutorial bug from earlier this session happened at all.**
`data/startingClans.ts:12,98,166,232` — Cornelii → Valerii → Fabii → Claudii, in that order, in a flat array with no sort/reorder logic anywhere. A 2×2 grid removes the "how far down the page is clan N" question entirely — every clan is always on-screen at once, at a fixed position, regardless of which one (if any) is currently expanded below.

**Finding 3 — a standalone "needs attention" alert strip would duplicate work `DossierPanel` already does; drop it in favor of the tile's existing standing badge.**
Earlier in this conversation a Curia-`AlertStrip`-style banner was proposed for Forum. On inspection: `DossierPanel.tsx` (self-hides at `:344` when both its lists are empty) already surfaces exactly the "something needs your attention" signal this would have duplicated — held/against-you Secrets, with real actions, not just a link. Separately, `ClanCard.tsx`'s current header already renders a standing badge (`STANDING_COLORS`/`cc.standingBadge`, `:146-148`) computed from `getClanStanding` (`reputationEngine.ts`) — HOSTILE/RIVAL is already visible on the collapsed card today, with zero scrolling. The redesigned tile should keep this badge (small, on the tile itself) rather than adding a second, separate banner that re-announces the same fact. **Revising the earlier verbal pitch**: no new `AlertStrip`-equivalent component for this plan. `pendingSecretDemand` (`gameStore.ts:358`) already interrupts via a real `EventModal` the moment it fires (`turnSequencer.ts`'s `injectNoticeEvent` call, per this session's tutorial-engine research) — it does not need a passive banner either, it's already impossible to miss.

**Finding 4 — no per-clan color exists anywhere yet; `sigil` is the closest precedent for where a new one belongs.**
`models/clan.ts:107` has `sigil: string` (an emoji); `Clan` has no color field, and no lookup map keyed by clan id exists elsewhere in the codebase (checked `theme.ts`, `ClanCard.tsx`, `startingClans.ts`). Add `accentColor: string` to `ClanDefinition`/`Clan` alongside `sigil`, sourced from `theme.ts` tokens per Rule 2 above — this keeps the per-clan visual identity as static content next to the field it's most analogous to (`sigil`), rather than a second UI-side id→color map that would need to independently stay in sync with the 4 clan ids.

**Finding 5 — Forum's screen background is a flat, single color, unlike every other tab.**
`ForumScreen.tsx`'s `styles.screen: { flex: 1, backgroundColor: COLORS.bg, paddingTop: RESOURCE_BAR_HEIGHT }` (`:404`) — no `ImageBackground`, no texture. Compare `DomusScreen.tsx`'s `bg-domus.png` fresco, `CuriaScreen.tsx`'s stone-tile assets (`curiaAssets.ts`), `CursusScreen.tsx`'s `FrescoBackground`. Forum is the one tab with zero background art today, ship-blocked-behind-fallback or not — this is a real, verifiable gap, not a taste opinion.

**Finding 6 — the tutorial's `scrollRef`-based auto-scroll-into-view fix (this session) is load-bearing here and must not regress.**
`useTutorialTarget.ts` gained an optional `scrollRef` param this session specifically because `forum.action.invite-dinner` was an unreachable softlock (button below the fold, inside a `ClanCard`'s inline-expanded content, inside `ForumScreen`'s outer `ScrollView`). The current wiring threads `scrollRef` `ForumScreen` → `ClanCard` → `LeaderDetailPanel` → `ForumActionBtn`. Once the detail zone is pulled out of `ClanCard` and rendered once at the page level (Finding 1), this threading gets *shorter*, not longer — `ForumScreen` can likely pass `scrollRef` straight to the detail zone's `LeaderDetailPanel` without going through a per-tile component at all. Confirm this each chunk; do not let it silently regress back to a softlock.

---

## 4. Chunks

### C0 — IA restructuring: grid + detail zone

- New component, `src/components/forum/ClanGridTile.tsx` (or similar name) — compact tile: sigil, name, standing badge/color, maybe a relationship-delta indicator. Replaces `ClanCard`'s collapsed-state header visually; `ClanCard.tsx` itself is likely retired (its expanded-state JSX becomes the detail zone's content, inlined into `ForumScreen.tsx` or a new `ClanDetailZone.tsx`).
- `ForumScreen.tsx`: render the 4 tiles in a fixed grid (2×2 recommended over a single row — a row of 4 gets cramped on a narrow phone screen; verify against `SPACING`/screen-width tokens already in `theme.ts`), then the single detail zone below, driven by `expandedClanId`/`selectedLeaderId` (Finding 1 — no new state).
- Re-home `forum.clan.valeria`'s `useTutorialTarget` call to whichever tile component now renders Valerii's tile (Rule 4).
- Re-verify `forum.leader.valerius-flaccus` and `forum.action.invite-dinner` still resolve correctly and still scroll into view (Finding 6) — this is the chunk most likely to regress a real, previously-fixed softlock if rushed.
- `npx tsc --noEmit` + `npm test` clean. Manually verify (or flag if this environment still can't run a simulator) that tapping each of the 4 tiles shows that clan's detail with zero scroll-past-other-clans.

### C1 — Visual pass: background art + per-clan accent color

- New `src/utils/forumAssets.ts`, same shape as `cursusAssets.ts` (Rule 1) — background texture, ships commented out.
- Add `accentColor` to `Clan`/`ClanDefinition` (Finding 4) and set it for all 4 starting clans in `startingClans.ts`, referencing existing `theme.ts` tokens.
- Apply the background (`ImageBackground`, falling back to today's flat `COLORS.bg` when the asset is absent) to `ForumScreen.tsx`'s screen container.
- Restyle `ClanGridTile` to use `accentColor` (border, icon tint, or a subtle wash — implementer's call, but must come from the token, not a hardcoded literal per Rule 2) and restyle the detail zone's header the same way, so the accent carries through from tile to detail.

### C2 — Polish, hygiene, verification

- Fix the bare `useGameStore()` subscription in `ClanCard.tsx`/wherever its logic lands (Rule 3), while in the file, per CLAUDE.md's standing instruction to fix this pattern when touched, not just avoid adding to it.
- Update `SITEMAP.md` §2 (Forum) for the new component(s) and the retired `ClanCard.tsx` (if actually removed rather than repurposed — note either way, don't leave the doc pointing at a file that no longer exists or no longer does what's described).
- Full re-verification pass on all 3 Forum tutorial targets (Rule 4) — this is the one area of this plan with real regression risk against work already shipped this session.
- `npx tsc --noEmit` + `npm test` clean.

---

## Appendix — explicitly deferred, not forgotten

- **Bottom-sheet version of clan detail.** Discussed and rejected for this plan (see "How to use this document" above) on cost/benefit grounds, not because it's a bad idea outright — if Forum ever needs the extra vertical room a sheet buys (e.g. a much longer per-leader action list than exists today), revisit this as its own follow-up plan rather than folding it in here.
- **A relationship-delta/trend indicator on each tile** (e.g. "Fabii standing rising") — mentioned loosely in conversation as part of the tile redesign, but there's no existing "previous season's standing" snapshot anywhere in the model to diff against (`familyReputations` is a live scalar, not a history). Building that is new engine work, out of scope for a presentation-layer plan — flagged here so it isn't silently promised by C0's tile design and then silently dropped.
