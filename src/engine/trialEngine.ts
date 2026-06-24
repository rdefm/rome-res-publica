import type { Trial, TrialCharge, TrialOutcome } from '../models/trial';
import type { GameState } from '../state/gameStore';
import { computeTotalAssetBonuses } from './assetEngine';

// ─── Build a new trial ────────────────────────────────────────────────────────

export function buildTrial(
  accusedCharacterId: string,
  accusingClanId: string,
  charge: TrialCharge,
  accuserIntrigus: number,
  accusedCorruptionScore: number,
  assetTrialDefenseBonus: number = 0
): Trial {
  const prosecutionStrength = Math.min(100,
    accuserIntrigus * 2 + accusedCorruptionScore / 2
  );

  return {
    id: `trial_${Date.now()}`,
    accusedCharacterId,
    accusingClanId,
    charge,
    defenseStrength: Math.min(100, 20 + assetTrialDefenseBonus),
    prosecutionStrength,
    turnsRemaining: 4,
    resolved: false,
    actionsUsed: [],
  };
}

// ─── Resolve a trial ──────────────────────────────────────────────────────────

export function resolveTrial(trial: Trial): TrialOutcome {
  const margin = trial.defenseStrength - trial.prosecutionStrength;
  const roll = Math.random() * 40 - 20; // −20 to +20 noise
  const net = margin + roll;

  if (net > 30)  return 'acquitted';
  if (net > 10)  return 'dismissed';
  if (net > -10) return 'fined';
  if (net > -30) return 'exiled';
  return 'executed';
}

// ─── Outcome consequences ─────────────────────────────────────────────────────

export const OUTCOME_CONSEQUENCES: Record<TrialOutcome, {
  reputationDelta: number;
  corruptionClear: boolean;
  dignitas: number;
  denarii?: number;
  removeCharacter: boolean;
  familyTrustDelta?: number;
}> = {
  acquitted: { reputationDelta: +10, corruptionClear: true,  dignitas: +5,  removeCharacter: false },
  dismissed: { reputationDelta: +5,  corruptionClear: false, dignitas:  0,  removeCharacter: false },
  fined:     { reputationDelta: -5,  corruptionClear: false, dignitas: -5,  denarii: -100, removeCharacter: false },
  exiled:    { reputationDelta: -20, corruptionClear: false, dignitas: -20, removeCharacter: true },
  executed:  { reputationDelta: -30, corruptionClear: false, dignitas: -30, removeCharacter: true, familyTrustDelta: -20 },
};

// ─── Passive trial trigger check ──────────────────────────────────────────────

/**
 * Returns a charge if a trial should be triggered this season, or null.
 * Called from turnSequencer after all other steps.
 */
export function shouldTriggerTrial(state: GameState): {
  charge: TrialCharge;
  accusedId: string;
  accusingClanId: string;
} | null {
  // Only one active trial at a time
  if (state.trialQueue.some(t => !t.resolved)) return null;

  const player = state.family.find(c => c.isPlayer);
  if (!player) return null;

  // Need a hostile or rival clan to prosecute
  const accusingClan = state.clans.find(
    c => c.standing === 'hostile' || c.standing === 'rival'
  );
  if (!accusingClan) return null;

  // Corruption charge — player corruptionScore > 60, 20% chance
  if (player.corruptionScore > 60 && Math.random() < 0.20) {
    return { charge: 'corruption', accusedId: player.id, accusingClanId: accusingClan.id };
  }

  // Treason charge — crisis > 80, 10% chance
  if (state.crisisLevel > 80 && Math.random() < 0.10) {
    return { charge: 'treason', accusedId: player.id, accusingClanId: accusingClan.id };
  }

  return null;
}

// ─── Corruption accumulation ──────────────────────────────────────────────────

/**
 * Returns updated corruptionScore for a character after seasonal drift.
 * - Passive gain when crisisLevel > 50: +2/season (reduced by corruptionShield)
 * - Natural decay when corruptionScore > 0 and crisis is low: -1/season
 */
export function tickCorruption(
  currentScore: number,
  crisisLevel: number,
  corruptionShield: number
): number {
  if (crisisLevel > 50) {
    const gain = Math.max(0, 2 - corruptionShield);
    return Math.min(100, currentScore + gain);
  }
  // Natural decay when crisis is calm
  return Math.max(0, currentScore - 1);
}
