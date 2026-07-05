// ─── Crisis Model ─────────────────────────────────────────────────────────────
// Four independent crisis tracks replacing the single crisisLevel meter.
// Each track runs 0–100, has five tiers, and applies status effects per season.

export type CrisisTrackId = 'war' | 'unrest' | 'constitution' | 'economy';

export type CrisisTier = 0 | 1 | 2 | 3 | 4;

export interface CrisisTrack {
  id: CrisisTrackId;
  level: number;              // 0–100, always clamped
  tier: CrisisTier;           // computed from level bands; never set directly
  namedCrisis: string | null; // human-readable active crisis name; null if tier 0
}

export interface CrisisState {
  war: CrisisTrack;
  unrest: CrisisTrack;
  constitution: CrisisTrack;
  economy: CrisisTrack;
}

// Applied to ResourcePool calculations each season. Consumed by resourceEngine.
export interface CrisisStatusEffect {
  trackId: CrisisTrackId;
  tier: CrisisTier;
  label: string;                // display name for the tier (e.g. 'Active Conflict')
  fidesDelta: number;           // per-season Fides modifier (negative = penalty)
  denariDelta: number;          // per-season Denarii modifier
  actionCostMultiplier: number; // multiplier applied to all action Denarii costs (1.0 = baseline)
  specialEffect?: string;       // machine-readable tag for one-off effects (see tier tables)
}

// Tier band boundaries (inclusive lower, exclusive upper except tier 4)
export const CRISIS_TIER_BANDS: [number, number][] = [
  [0,  20],  // Tier 0
  [20, 40],  // Tier 1
  [40, 60],  // Tier 2
  [60, 80],  // Tier 3
  [80, 100], // Tier 4
];

export function getTierFromLevel(level: number): CrisisTier {
  if (level < 20) return 0;
  if (level < 40) return 1;
  if (level < 60) return 2;
  if (level < 80) return 3;
  return 4;
}
