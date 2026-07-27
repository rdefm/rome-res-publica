// ─── Curia Asset Registry ─────────────────────────────────────────────────────
// Curia Tab Redesign plan, Chunk C0 — Curia-only assets (header tiles, crisis
// track icons/damage overlays, vote-coin faces). Mirrors cursusAssets.ts's
// shape exactly.
//
// Same graceful-degradation contract as cursusAssets.ts / portraitAssets.ts:
// Metro resolves require() at BUNDLE time, so every line below ships
// commented out until the file exists in assets/curia/. A missing/commented
// entry resolves to `undefined` — every consumer must render a fallback for
// that (rule 2 — assets are coming separately; nothing here should require
// them to look correct).
//
// Wax seals are NOT in this registry — reuse cursusAssets.waxSeal (Finding 7).
// Tablets (tabellae) are NOT in this registry either — they are shaped Views
// with text, no image needed.

import type { CrisisTrackId, CrisisTier } from '../models/crisis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredAsset = any; // matches the untyped require() convention already used by cursusAssets.ts / portraitAssets.ts.

export type VoteVerb = 'vote' | 'speech' | 'filibuster';

// const PORPHYRY_TILE   = require('../assets/curia/tile-porphyry.png');
// const BRONZE_TILE     = require('../assets/curia/tile-bronze.png');
// const STONE_TILE      = require('../assets/curia/tile-stone.png');
// const TERRACOTTA_TILE = require('../assets/curia/tile-terracotta.png');

const CRISIS_ICONS: Partial<Record<CrisisTrackId, RequiredAsset>> = {
  // war: require('../assets/curia/icon-crisis-war.png'),
  // unrest: require('../assets/curia/icon-crisis-unrest.png'),
  // constitution: require('../assets/curia/icon-crisis-constitution.png'),
  // economy: require('../assets/curia/icon-crisis-economy.png'),
};

// Damage overlays for tiers 1–4 only — tier 0 is pristine (no overlay).
const DAMAGE_OVERLAYS: Partial<Record<CrisisTier, RequiredAsset>> = {
  // 1: require('../assets/curia/damage-overlay-1.png'),
  // 2: require('../assets/curia/damage-overlay-2.png'),
  // 3: require('../assets/curia/damage-overlay-3.png'),
  // 4: require('../assets/curia/damage-overlay-4.png'),
};

const COIN_FACES: Partial<Record<VoteVerb, RequiredAsset>> = {
  // vote: require('../assets/curia/coin-vote.png'),
  // speech: require('../assets/curia/coin-speech.png'),
  // filibuster: require('../assets/curia/coin-filibuster.png'),
};

export const curiaAssets = {
  /** Seamless tile for the pinned header. resizeMode="repeat". */
  porphyryTile: undefined as RequiredAsset | undefined,
  /** Seamless tile for LawCard's bronze plaque. */
  bronzeTile: undefined as RequiredAsset | undefined,
  /** Seamless tile for the sub-tab strip. */
  stoneTile: undefined as RequiredAsset | undefined,
  /** Seamless tile for PatronageCard. */
  terracottaTile: undefined as RequiredAsset | undefined,
  /** Pristine track icon. One per track — damage is composited, never baked in. */
  crisisIcon: (id: CrisisTrackId): RequiredAsset | undefined => CRISIS_ICONS[id],
  /** Transparent damage layer for tiers 1–4. Tier 0 returns undefined (pristine). */
  damageOverlay: (tier: CrisisTier): RequiredAsset | undefined => DAMAGE_OVERLAYS[tier],
  /** Coin face for a vote verb. */
  coinFace: (verb: VoteVerb): RequiredAsset | undefined => COIN_FACES[verb],
};
