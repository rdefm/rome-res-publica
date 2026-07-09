// ─── Seeded RNG ──────────────────────────────────────────────────────────────
// Deterministic PRNG (mulberry32) — same seed always produces the same
// sequence. Used by the battle engine (src/engine/battle/*) so battles are
// reproducible from a seed alone, for exact-match tests and replays.

export type RngFn = () => number; // [0, 1)

export function makeSeededRng(seed: number): RngFn {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [min, max], inclusive both ends. */
export function rngInt(rng: RngFn, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** A d100-style percentile roll, 1–100 inclusive — the battle engine's most
 *  common check shape (feint success, amok, character risk). */
export function rngPercent(rng: RngFn): number {
  return rngInt(rng, 1, 100);
}
