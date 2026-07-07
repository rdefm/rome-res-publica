// ─── Season ledger ────────────────────────────────────────────────────────────
//
// Snapshot of one season's net changes. Captured in gameStore.endSeason() by
// diffing state before and after processSeason() (P1-D wires the capture logic).
// Displayed in SeasonOverlay and the welcome-back recap (P1-D).

export interface ResourceDeltas {
  fides: number;
  denarii: number;
  imperium: number;
  lifetimeDignitas: number;
}

export interface CrisisDeltas {
  war: number;
  unrest: number;
  constitution: number;
  economy: number;
}

export interface RomeDeltas {
  stability: number;
  plebs: number;
  treasury: number;
}

export interface SeasonLedger {
  turnNumber: number;
  /** Human-readable label, e.g. "264 BC · Spring". */
  seasonLabel: string;
  year: number;
  /** Net per-resource change for the season (processSeason delta only in v1). */
  resourceDeltas: ResourceDeltas;
  /** Net per-track crisis level change. */
  crisisDeltas: CrisisDeltas;
  /** Net per-stat Rome change. */
  romeDeltas: RomeDeltas;
  /**
   * Up to 5 narrative headlines: election results, bills passed/failed,
   * trial outcomes, births, crisis tier crossings.
   * Derived from the log entries written during the same processSeason call.
   */
  headlines: string[];
}
