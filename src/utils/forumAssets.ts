// ─── Forum Asset Registry ───────────────────────────────────────────────────
// Forum redesign, Chunk C1 — Forum was the one tab with zero background art
// (plans/forum-redesign.md Finding 5: a flat `COLORS.bg` fill, unlike
// Domus's fresco, Curia's stone tiles, or Cursus's FrescoBackground). Same
// graceful-degradation shape as utils/cursusAssets.ts / utils/curiaAssets.ts:
// Metro resolves require() at BUNDLE time, so this ships commented out until
// the file exists in assets/forum/. A missing/commented entry resolves to
// `undefined` — the consumer (screens/ForumScreen.tsx) falls back to
// today's flat COLORS.bg for that case.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredAsset = any; // matches the untyped require() convention already used by cursusAssets.ts / domusAssets.ts.

// const FORUM_BG = require('../assets/forum/senate-bg.png');

export const forumAssets = {
  /** Undefined until the require() line above is uncommented (i.e. today). */
  screenBg: undefined as RequiredAsset | undefined,
};
