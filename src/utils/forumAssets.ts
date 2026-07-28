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

export const forumAssets = {
  /** 10:3 aspect (actual: 1888x560, ~3.37:1 — close enough that cover-mode
   *  crop is negligible). */
  headerBanner: FORUM_HEADER_BANNER as RequiredAsset,
};
