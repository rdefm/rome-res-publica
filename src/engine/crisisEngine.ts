export interface CrisisInfo {
  title: string;
  narrative: string;
  gravitasPenalty: number;
  dignitasPenalty: number;
}

export function getCrisisInfo(crisisLevel: number): CrisisInfo {
  if (crisisLevel < 20) return {
    title: 'Pax Romana',
    narrative: 'Rome is at peace. The legions hold the frontiers and the Senate deliberates in good order.',
    gravitasPenalty: 0, dignitasPenalty: 0,
  };
  if (crisisLevel < 40) return {
    title: 'The Punic Wars — Early Skirmishes',
    narrative: 'Carthaginian aggression tests Rome\'s resolve. Minor skirmishes along the western trade routes unsettle merchants and senators alike.',
    gravitasPenalty: 1, dignitasPenalty: 0,
  };
  if (crisisLevel < 60) return {
    title: 'The Punic Wars — Escalating',
    narrative: 'Hannibal\'s forces press deeper into allied territory. Fear grips the Forum. Resources are stretched thin across two theatres of war.',
    gravitasPenalty: 2, dignitasPenalty: 1,
  };
  if (crisisLevel < 80) return {
    title: 'The Punic Wars — Crisis Point',
    narrative: 'The legions have suffered a catastrophic defeat. Rome reels. Every senator knows that failure in the Curia now may doom the Republic itself.',
    gravitasPenalty: 3, dignitasPenalty: 2,
  };
  return {
    title: 'EXISTENTIAL THREAT',
    narrative: 'Carthage stands at the gates. The Senate is paralysed by fear and faction. Rome\'s survival rests on what is decided in this chamber — and soon.',
    gravitasPenalty: 5, dignitasPenalty: 4,
  };
}

export function getCrisisColour(crisisLevel: number): string {
  if (crisisLevel < 20) return '#3d6b4f';
  if (crisisLevel < 40) return '#c9a84c';
  if (crisisLevel < 60) return '#d4791a';
  if (crisisLevel < 80) return '#8b1a1a';
  return '#ff0000';
}

// ─── New: stability modifier on crisis escalation ─────────────────────────────

/**
 * Returns the escalation multiplier based on current stability.
 * Low stability makes crises spiral faster; high stability slows them.
 */
export function getStabilityEscalationMultiplier(stability: number): number {
  if (stability < 20) return 1.5;
  if (stability < 40) return 1.25;
  if (stability < 70) return 1.0;   // baseline
  if (stability < 85) return 1.0;   // high stability — same raw escalation but crisis absorbs more
  return 0.85;
}

/**
 * Returns how many crisis points are passively absorbed each season based on
 * treasury level (flush/overflowing treasury absorbs shocks).
 */
export function getTreasuryAbsorption(treasury: number): number {
  if (treasury >= 85) return 2;
  if (treasury >= 65) return 1;
  return 0;
}

/**
 * Returns autonomous crisis added each season from very low plebs.
 * Rioting population destabilises Rome independently of Senate action.
 */
export function getPlebsCrisisBonus(plebs: number): number {
  if (plebs < 20) return 3;
  return 0;
}

/**
 * Calculate crisis escalation for the season.
 *
 * @param crisisLevel    current crisis level
 * @param passedBillCount  number of bills that passed this season
 * @param escalationMultiplier  from getStabilityEscalationMultiplier()
 * @param crisisAbsorption      from getTreasuryAbsorption()
 * @param plebsBonus            from getPlebsCrisisBonus()
 */
export function calcCrisisEscalation(
  crisisLevel: number,
  passedBillCount: number,
  escalationMultiplier: number = 1.0,
  crisisAbsorption: number = 0,
  plebsBonus: number = 0
): number {
  const baseDelta = passedBillCount > 0 ? -3 : 8;
  const scaledDelta = Math.round(baseDelta * (baseDelta > 0 ? escalationMultiplier : 1.0));
  const result = crisisLevel + scaledDelta - crisisAbsorption + plebsBonus;
  return Math.min(100, Math.max(0, result));
}
