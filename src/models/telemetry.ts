// ─── Telemetry Model (P2-A) ─────────────────────────────────────────────────
// Local-only playtest instrumentation, dumped via DebugPanel for balance
// tuning (Chunk P2-E). No network calls, no remote analytics — this data
// never leaves the device.

export interface SeasonStats {
  turnNumber: number;
  /** Wall-clock seconds spent in the season, from seasonStartedAt to endSeason. */
  durationSec: number;
  /** Count of meaningful player actions taken this season — see gameStore's
   *  actionsThisSeason counter and the counted-action list in Chunk P2-E. */
  meaningfulActions: number;
  fidesIncome: number;
  fidesSpent: number;
  denariiIncome: number;
  denariiSpent: number;
  /**
   * Patron Tier as of the end of this season (P2-E). The plan's early/mid/late
   * action-economy stages partition cleanly on tier alone — 0-1 / 2-3 / 4-5 —
   * so this single snapshot is enough to bucket historical seasons by stage
   * for the DebugPanel Pace view; see engine/actionEconomyEngine.ts.
   */
  patronTierAtEnd: number;
}
