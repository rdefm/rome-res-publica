// ─── Forum Asset Registry ───────────────────────────────────────────────────
// Forum redesign, Chunk C1 (revised) — Forum was the one tab with zero
// background art (plans/forum-redesign.md Finding 5). A full-screen
// background was tried first and reverted: Forum's scrollable body is almost
// entirely opaque panels (DossierPanel/ClanGridTile/ClanDetailZone, all
// panelSurface) with only thin margins between them, so a tall background
// would mostly sit permanently hidden behind them — a poor fit next to
// Domus/Cursus's looser layouts, where that treatment actually shows through.
// headerBanner instead: a fixed-height banner in the header zone, 10:3
// aspect, always fully visible, never covered by scroll content.
//
// forum-fresco-header-plan.md reopens that background decision on purpose
// (its Finding 3 + §3.2): headerBackground below is scoped to just the strip
// below the locked frieze, not the whole screen, and the "mostly hidden
// behind opaque panels" tradeoff is accepted, not silently reintroduced —
// see that plan for the reasoning.
//
// Same graceful-degradation shape as utils/cursusAssets.ts / utils/curiaAssets.ts:
// Metro resolves require() at BUNDLE time, so this ships commented out until
// the file exists in assets/forum/. Missing/commented → `undefined` — the
// consumer (screens/ForumScreen.tsx) falls back to today's plain flat header
// for that case.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredAsset = any; // matches the untyped require() convention already used by cursusAssets.ts / domusAssets.ts.

// ~596KB — over the ~400KB guidance other asset manifests in this repo use
// (see cursusAssets.ts's fresco-bg.png note for the same situation); fine
// as-is, worth recompressing next time this art gets touched.
const FORUM_HEADER_BANNER = require('../assets/forum/header-banner.png');

// Background socle/dado layer behind the scrollable content (forum-fresco-
// header-plan.md §3.2/§4.2). Asset landed as a .png (~478KB), not the .jpg
// the plan called for — fine as-is, same "recompress later" situation as
// headerBanner above.
const FORUM_HEADER_BACKGROUND = require('../assets/forum/header-background.png');

// Per-clan medallion icons, replacing ClanGridTile's emoji `clan.sigil`
// fallback (🦅/🐺/🐗/⚖️ for cornelii/valerii/fabii/claudii — see
// data/startingClans.ts). Keyed by Clan.id; a clan with no entry here (a
// future 5th clan, or before this art existed) falls back to the emoji,
// same graceful-degradation contract as the rest of this registry.
const CLAN_SIGILS: Record<string, RequiredAsset> = {
  cornelii: require('../assets/forum/icon-cornelii.png'),
  valerii: require('../assets/forum/icon-valerii.png'),
  fabii: require('../assets/forum/icon-fabii.png'),
  claudii: require('../assets/forum/icon-claudii.png'),
};

export const forumAssets = {
  /** Fresco header banner (forum-fresco-header-plan.md art direction).
   *  Current asset: 2172x724, ~3:1 — see ForumScreen.tsx's
   *  HEADER_BANNER_HEIGHT comment for how the display box is sized to it. */
  headerBanner: FORUM_HEADER_BANNER as RequiredAsset,
  /** Non-scrolling background strip below the frieze. */
  headerBackground: FORUM_HEADER_BACKGROUND as RequiredAsset,
  /** Per-clan medallion icon for ClanGridTile's sigil ring. */
  clanSigil: (id: string): RequiredAsset | undefined => CLAN_SIGILS[id],
};
