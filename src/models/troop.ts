import type { UnitClass, Veterancy } from './battle';

export type TroopType = 'garrison' | 'raised' | 'veteran' | 'seasoned_veteran';

export interface TroopUnit {
  id: string;
  type: TroopType;
  strength: number;           // 1–10. Combat effectiveness.
  campaignsSurvived: number;  // Increments on each campaign survived. Doubles as the M4/M8
                               // "engagedBattles" veterancy-progression counter for set-piece
                               // battles — reused rather than adding a redundant field.
  yearsInactive: number;      // Seasons without campaign. Attrition starts at 10 years (40 seasons).
  bondToCommander: number;    // 0–100. raised: starts at 50; veterans: start at 80+. Doubles as
                               // the set-piece battle system's "loyalty" (musterEngine.ts) —
                               // reused rather than adding a redundant field.
  musterProvinceId: string;   // Province where this unit is stationed. Latium is forbidden.

  // ── Military Overhaul M4 — set-piece battle fields ──────────────────────
  // Both optional for backward-compat with pre-M4 saves; musterEngine.ts
  // fills in a sensible default (derived from `type`) on first muster and
  // persists it back onto the record from then on.
  /** Battle unit class. Absent = 'legionary' (Rome's traditional levy).
   *  Elephants cannot be raised by Rome (design decision) — 'elephant'
   *  never appears here for player-raised troops. */
  unitClass?: UnitClass;
  /** Battle veterancy tier. M8 owns its ongoing lifecycle (promotion
   *  thresholds); M4 only seeds an initial value. */
  veterancy?: Veterancy;
}
