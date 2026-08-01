# Forum Tab — Fresco Header & Background Redesign

## How to use this document

This is a **design + asset-spec** doc, not yet a chunked implementation plan.
It settles the creative direction and the concrete asset requirements so art
can be generated/sourced; a short implementation chunk (touching
`ForumScreen.tsx` + `forumAssets.ts`) can follow once the two images exist,
using the same graceful-degradation pattern every other art registry in this
repo already uses (`cursusAssets.ts`, `domusAssets.ts`, `curiaAssets.ts`).

**Scope:** Forum's header banner + a new background layer behind its
scrollable content, only. Clan sigil medallions, `ClanGridTile` borders, and
`DossierPanel` chrome are explicitly **out of scope** for this pass — revisit
once the new art is in place and visible.

---

## 1. Findings (verified against `tutorial-rebuild`, not assumed)

1. **The header banner is already architecturally "locked."** `ForumScreen.tsx:469-482` renders it as a sibling *outside* the `SafeAreaView`/`ScrollView` that holds the scrollable content — it already never scrolls. No new engineering needed for "locked at top"; this plan only needs a new asset dropped into the existing slot.
2. **Current `header-banner.png`** (1888×560, 596KB, PNG) is a bright, edge-to-edge "storybook illustration" (a market/temple scene) — a different art direction from the fresco reference. Swapping it for a fresco-style frieze is a genuine art-direction change for Forum's top art, not a like-for-like reskin.
3. **`forumAssets.ts:1-16` documents a prior, deliberate decision**: a full-screen background was tried for Forum and reverted, because its scroll body (`DossierPanel`, `ClanGridTile`, `ClanDetailZone`) is almost entirely opaque panels — a tall background would mostly sit hidden behind them. This plan reopens that decision on purpose (see §3) — the tradeoff still applies and is called out explicitly below, not silently re-introduced.
4. **No reusable border-frame component exists.** `border-greek-key.png` exists in `src/assets/images/` but is unreferenced anywhere in `src/` — any framing/border treatment for the new art has to be either baked into the generated image or built fresh; there's no shared chrome component to lean on.
5. **Domus's background pattern** (`DomusScreen.tsx:51-56`, `bg-domus.png`, 768×1376, 851KB) is a single fixed image sized to fill the remaining screen height below the header (`styles.screen: { flex: 1, paddingTop: RESOURCE_BAR_HEIGHT }`), sitting *outside* the `ScrollView`. It does not move as content scrolls — whatever part of it peeks through panel gaps at any given moment is fixed, not tied to scroll position. This is the pattern we're mirroring for Forum's new background layer (see §3.2) — importantly, this means the asset only ever needs to cover **one viewport's height**, not several — sizing it taller than that buys nothing, since a non-scrolling layer never reveals more of itself.
6. **Both existing full-bleed backgrounds already exceed the repo's own ~400KB asset guidance** (`bg-domus.png` 851KB, `cursus/fresco-bg.png` 1010KB) — both are PNG where JPG would suit photographic/painterly content far better. Flagging so Forum's new assets don't repeat this; see §4.3.
7. **Other tabs' header text is state-driven, not just decorative.** Cursus's header (`CursusScreen.tsx:499-506`) shows `CAMPAIGN: {office name}` during an active campaign and `CURSUS HONORUM` otherwise — the same live-state pattern Forum's current subtitle uses (`campaigning ? 'Campaign Active — Canvass for Votes' : 'Clans & Political Alliances'`, `ForumScreen.tsx:399`). Curia is the only tab with no header text, but it also has no header art at all (`CuriaScreen.tsx` goes straight to `SubTabBar`) — not a precedent for "art tabs drop text."

---

## 2. Agreed creative direction

- **No aging.** The game is set *during* the Republic, not excavated from it — the fresco should read as freshly painted: vivid pigment, crisp linework, no craquelure, no cracks, no soot/ash staining, no faded/bleached passages. This is a deliberate departure from the literal look of the attached reference photo (which does show plaster aging) — the reference is for **composition, palette family, and the use of painted architecture**, not surface condition.
- **Painted architecture divides the scene**, not a museum frame. Real Pompeian (Second Style) wall painting uses illusionistic pilasters/columns to break a wall into panels — the attached reference already does this (painted columns separating standing figures). Lean into that as the structural device, rather than an applied decorative border implying "this is a sealed, finished artifact" — no outer Greek-key/mounted-frame border baked into the new assets (see Finding 4 — nothing in-app to pair it with, and it undercuts the "one continuous wall" read).
- **No header text at all.** No "FORUM" wordmark, no subtitle, no campaign-state callout. The art itself (plus the tab bar icon) is the wayfinding cue. The one candidate for keeping text — the "Campaign Active" state — is dropped deliberately: `CanvassingPanel` already surfaces that state prominently in-body (its own `CANVASSING — {OFFICE}` heading, immediately after `DossierPanel`), and Cursus's own header already owns that signal app-wide. Duplicating it on Forum would be redundant, not clarifying.

---

## 3. Layout & behavior spec

### 3.1 Locked frieze (replaces `header-banner.png`)

No behavior change from today — same slot, same "renders outside the `ScrollView`, falls back to a flat header if the asset is absent" contract (`ForumScreen.tsx:470-478`). Only the art changes, and the `headerContent` JSX (title/subtitle) is deleted rather than reskinned (see §2).

### 3.2 Background layer (new)

Sits behind the `SafeAreaView`/`ScrollView`, in the same non-scrolling tier as the locked frieze — **not** a second banner that scrolls past, and **not** taller than one viewport (see Finding 5 for why that would buy nothing). Concretely: wrap `styles.safeContent` in an `ImageBackground` using the new asset, falling back to today's flat `COLORS.bg` fill when absent — the same shape `DomusScreen.tsx:51-56` already uses, scoped to just the area below the frieze instead of the whole screen.

**Known, accepted tradeoff (Finding 3):** because `DossierPanel`/`ClanGridTile`/`ClanDetailZone` are opaque and cover most of the scrollable area, this background will mostly show as a strip in the gap right below the frieze (before `DossierPanel` starts) and thin margins around the grid — not a grand full reveal. That's consistent with what Domus itself actually delivers today. If that turns out to read as underwhelming once it's in, loosening panel opacity is a fair follow-up, but it's an explicit non-goal of this pass (§ Scope).

### 3.3 Header text — removed

Delete `headerContent` (`ForumScreen.tsx:395-402`) and its usage in both the `ImageBackground` and fallback `View` branches. No replacement text anywhere in the header/background zone.

---

## 4. Asset needs

Both assets follow the existing graceful-degradation contract: ship commented out in `forumAssets.ts` until the file exists, fallback to today's flat treatment otherwise.

### 4.1 Locked frieze → `assets/forum/header-banner.png` (replaces existing file)

| Spec | Value |
|---|---|
| Dimensions | **2400×750px** (3.2:1) — wider than the ~2:1 box it displays in (`HEADER_BANNER_HEIGHT = screen width / 2`); the app's `cover` crop trims from the **left/right edges** most aggressively (a taller display box relative to the source ratio zooms and crops horizontally, not vertically — see `ForumScreen.tsx:39-43`'s own comment on this). Keep the important figures/action within the **central ~75% horizontal band**. |
| Format | JPG, quality ~85 |
| Target filesize | ≤ 400KB |
| Composition | A row of standing togate figures engaged in political business (conversation, an exchange, a scribe, a seated elder) in front of an illusionistic colonnade, painted pilasters dividing the group into 3–5 panels. Wide, frieze-like, single register. |

**Generation prompt (starting point — refine once you share your Pompeii references):**

> *"Ancient Roman Second-Style wall fresco, freshly painted (not aged or weathered), vivid ochre/terracotta/deep-red ground with muted verdigris and cream accents, illusionistic painted stone pilasters dividing the composition into panels, a row of togate Roman men in political conversation — exchanging documents, in discussion, one seated elder — architectural forum backdrop with columns, wide horizontal frieze composition, crisp confident linework, flat fresco-painting style (not oil-painting realism), no cracks, no craquelure, no soot or fading, no applied border or frame, no text."*

### 4.2 Background socle/dado → `assets/forum/header-background.jpg` (new)

| Spec | Value |
|---|---|
| Dimensions | **900×1600px** (portrait, ~9:16) — sized to cover one viewport's remaining height below the frieze on a typical phone; see Finding 5 for why taller isn't useful here. |
| Format | JPG, quality ~85 |
| Target filesize | ≤ 400KB (both existing full-bg assets in this repo ship oversized — see Finding 6; don't repeat that here) |
| Composition | Low-detail dado/socle register — the plain lower zone of a real Pompeian wall, not a second busy scene. |

**Generation prompt:**

> *"Ancient Roman Second-Style fresco wall, lower dado/socle register only, freshly painted (not aged, no cracks, no weathering), simple faux-marble panels alternating with a deep red or black ground field, narrow geometric border motif (guilloche or meander pattern), painted pilasters continuing the same architectural rhythm as the panel above, minimal to no figures, vertical portrait composition, flat fresco-painting style, no text, no applied frame."*

### 4.3 Compression note

Both target ≤400KB JPG — deliberately tighter than what `bg-domus.png`/`cursus/fresco-bg.png` actually shipped at (Finding 6). If generation output comes back as PNG, re-export as JPG at the sizes above before committing; neither asset needs alpha transparency.

---

## 5. Implementation pointers (for the follow-up chunk)

- `src/utils/forumAssets.ts` — add a second `require()` (`header-background.jpg`), same commented-out-until-present shape as `headerBanner`. Update the file's header comment (Finding 3's rationale) to note this plan reopened that decision deliberately, with the tradeoff accepted.
- `src/screens/ForumScreen.tsx`:
  - Delete `headerContent` (`:395-402`) and both its usages (`:472`, `:476`).
  - Wrap `styles.safeContent`'s `SafeAreaView` (`:479-481`) in `ImageBackground`/fallback `View`, mirroring the `DomusScreen.tsx:51-56` pattern, scoped to that container instead of the whole screen.
- No store, schema, or engine changes — presentation-layer only.

---

## 6. Open items

- **Palette/composition specifics** (exact reds/ochres, figure count, whether the socle includes any figures at all) should get a pass once your own Pompeii reference images are shared — the prompts above are a grounded starting point, not final.
- **Whether to keep or delete the current `header-banner.png`** once the new one lands — no code depends on the old file's *content*, only its presence at that path, so this is a pure content swap.
- **Whether the "mostly hidden behind panels" tradeoff (§3.2) reads as worthwhile once visible** — flagged for a follow-up look after implementation, not resolved here.
