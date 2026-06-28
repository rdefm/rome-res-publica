export interface Bill {
  id: string;
  name: string;
  desc: string;
  support: number;         // -100 to +100. Positive = passes at season end.
  turnsLeft: number;       // seasons until the bill expires
  passEffect: string;      // pipe-separated effect string e.g. 'dignitas+8|crisis-5'
  failEffect: string;
  playerVote?: 'vote_for' | 'vote_against' | 'filibuster';
  playerSubmitted?: boolean;
  // Optional vote action costs/effects — defaults applied in gameStore if absent
  voteGravitasCost?: number;      // default 4
  voteForSupport?: number;        // default 15
  voteAgainstSupport?: number;    // default -15
  speechGravitasCost?: number;    // default 6
  speechForSupport?: number;      // default 20
  speechAgainstSupport?: number;  // default -20
}

// Effect string format: key+N or key-N, pipe-separated
// Valid keys: gravitas, dignitas, gratia, crisis, stability, plebs, treasury
export function parseEffect(effectStr: string): Array<{ key: string; delta: number }> {
  if (!effectStr) return [];
  return effectStr.split('|').map((part) => {
    const match = part.match(/^([a-z]+)([+-]\d+)$/);
    if (!match) return null;
    return { key: match[1], delta: parseInt(match[2], 10) };
  }).filter(Boolean) as Array<{ key: string; delta: number }>;
}
