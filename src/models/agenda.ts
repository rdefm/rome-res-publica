// ─── Agenda severity ──────────────────────────────────────────────────────────

export type AgendaSeverity = 'critical' | 'warning' | 'opportunity' | 'info';

// ─── Agenda category ─────────────────────────────────────────────────────────

export type AgendaCategory =
  | 'trial'
  | 'election'
  | 'legislation'
  | 'crisis'
  | 'office'
  | 'province'
  | 'family'
  | 'economy'
  | 'military'
  | 'housekeeping';

// ─── Agenda target ────────────────────────────────────────────────────────────

/**
 * Tab names match the navigator screen names in App.tsx exactly.
 * Verified against Tab.Screen name props — do not rename without updating App.tsx.
 */
export type TabName = 'Domus' | 'Forum' | 'Cursus' | 'Provinciae' | 'Curia';

export interface AgendaTarget {
  tab: TabName;
  // Optional payload fields — mirror existing gameStore UI-helper fields so
  // the navigator can set them with a direct store spread (P1-C).
  selectedCharacterId?: string;
  selectedLeaderId?: string;
  expandedClanId?: string;
  provinceId?: string;
  billId?: string;
  trialId?: string;
}

// ─── Agenda item ──────────────────────────────────────────────────────────────

export interface AgendaItem {
  /**
   * Stable string derived from the item's subject — never a random UUID.
   * Examples: 'agenda-trial-{trialId}', 'agenda-crisis-war', 'agenda-election-{charId}'.
   * Allows the UI to key list items and lets tests assert on specific generators.
   */
  id: string;
  category: AgendaCategory;
  severity: AgendaSeverity;
  /** ≤ 60 chars. States the situation. */
  title: string;
  /** ≤ 140 chars, one sentence. States the consequence or key number. */
  detail: string;
  /** Null for items with no actionable navigation target. */
  target: AgendaTarget | null;
  /**
   * Within a severity band, lower = higher priority.
   * Convention: 0 = resolves this season, 10 = next season, 20 = later.
   * Generators set this directly; the engine does not recompute it.
   */
  sortWeight: number;
}

// ─── Sort order ───────────────────────────────────────────────────────────────

/** Maps severity to its primary sort key. Lower = appears first. */
export const SEVERITY_ORDER: Record<AgendaSeverity, number> = {
  critical:    0,
  warning:     1,
  opportunity: 2,
  info:        3,
};
