// ─── Bill types ───────────────────────────────────────────────────────────────

export type BillType =
  | 'populist'
  | 'optimates'
  | 'constitutional'
  | 'emergency'
  | 'military'
  | 'economic'
  | 'neutral'
  | 'repeal';

// ─── Bill interface ───────────────────────────────────────────────────────────

export interface Bill {
  id: string;
  name: string;
  desc: string;
  support: number;              // −100 to +100. Positive = passes at season end.
  turnsLeft: number;            // seasons until the bill expires
  passEffect: string;           // pipe-separated effect string e.g. 'lifetimeDignitas+8|crisis-5'
  failEffect: string;
  playerVote?: 'vote_for' | 'vote_against' | 'filibuster';
  playerSubmitted?: boolean;
  // Bill type — used for vote modifiers from Rome stats
  type?: BillType;
  // Vote action costs/effects — fall back to defaults in gameStore if absent
  voteGravitasCost?: number;      // default 4
  voteForSupport?: number;        // default 15
  voteAgainstSupport?: number;    // default −15
  speechGravitasCost?: number;    // default 6
  speechForSupport?: number;      // default 20
  speechAgainstSupport?: number;  // default −20
  // Active Law fields
  ongoingEffect?: string;         // effect string applied each season while law is active
  duration?: number;              // seasons the law stays active (undefined = permanent)
  renewable?: boolean;            // if true, re-injects template into bill queue on expiry
  renewalFlavour?: string;        // log message shown on expiry
  repealable?: boolean;           // if false, cannot be proposed for repeal
  repeals?: string;               // id of the active law this bill would strike down
  submissionCondition?: string;   // e.g. 'crisisLevel >= 45' — hidden until met
}

// ─── Active Law ───────────────────────────────────────────────────────────────
// Stored in gameStore.activeLaws when a bill passes.

export interface ActiveLaw {
  billId: string;              // references the bill template id
  name: string;
  passedOnTurn: number;
  expiresOnTurn?: number;      // set when bill had a duration
  ongoingEffect?: string;      // effect string applied each season
  repealable: boolean;
  renewable: boolean;
  renewalFlavour?: string;
}

// ─── Effect string parser ─────────────────────────────────────────────────────

export function parseEffect(effectStr: string): Array<{ key: string; delta: number }> {
  if (!effectStr) return [];
  return effectStr.split('|').map((part) => {
    const match = part.trim().match(/^([a-zA-Z]+)([+-]\d+)$/);
    if (!match) return null;
    return { key: match[1], delta: parseInt(match[2], 10) };
  }).filter(Boolean) as Array<{ key: string; delta: number }>;
}
