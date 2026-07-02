import type { Trial, TrialCharge, TrialOutcome } from '../models/trial';
import type { GameState } from '../state/gameStore';
import { computeTotalAssetBonuses } from './assetEngine';
import { computeTotalClientBonuses } from './clientEngine';

// ─── Build a new trial ────────────────────────────────────────────────────────

export function buildTrial(
  accusedCharacterId: string,
  accusingClanId: string,
  charge: TrialCharge,
  accuserIntrigus: number,
  accusedCorruptionScore: number,
  assetTrialDefenseBonus: number = 0,
  clientTrialDefenseBonus: number = 0
): Trial {
  const prosecutionStrength = Math.min(100,
    accuserIntrigus * 2 + accusedCorruptionScore / 2
  );

  return {
    id: `trial_${Date.now()}`,
    accusedCharacterId,
    accusingClanId,
    charge,
    defenseStrength: Math.min(100, 20 + assetTrialDefenseBonus + clientTrialDefenseBonus),
    prosecutionStrength,
    turnsRemaining: 4,
    resolved: false,
    actionsUsed: [],
  };
}

/**
 * Build a trial using full game state — resolves both asset and client defense bonuses.
 */
export function buildTrialFromState(
  accusedCharacterId: string,
  accusingClanId: string,
  charge: TrialCharge,
  accuserIntrigus: number,
  accusedCorruptionScore: number,
  state: GameState
): Trial {
  const assetBonuses = computeTotalAssetBonuses(state.ownedAssets);
  const clientBonuses = computeTotalClientBonuses(state.clients);
  return buildTrial(
    accusedCharacterId,
    accusingClanId,
    charge,
    accuserIntrigus,
    accusedCorruptionScore,
    assetBonuses.trialDefenseBonus ?? 0,
    clientBonuses.trialDefenseBonus ?? 0,
  );
}

// ─── Resolve a trial ──────────────────────────────────────────────────────────

export function resolveTrial(trial: Trial): TrialOutcome {
  const margin = trial.defenseStrength - trial.prosecutionStrength;
  const roll = Math.random() * 40 - 20;
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
  lifetimeDignitas: number;
  denarii?: number;
  removeCharacter: boolean;
  familyTrustDelta?: number;
}> = {
  acquitted: { reputationDelta: +10, corruptionClear: true,  lifetimeDignitas: +5,  removeCharacter: false },
  dismissed: { reputationDelta: +5,  corruptionClear: false, lifetimeDignitas:  0,  removeCharacter: false },
  fined:     { reputationDelta: -5,  corruptionClear: false, lifetimeDignitas: -5,  denarii: -100, removeCharacter: false },
  exiled:    { reputationDelta: -20, corruptionClear: false, lifetimeDignitas: -20, removeCharacter: true },
  executed:  { reputationDelta: -30, corruptionClear: false, lifetimeDignitas: -30, removeCharacter: true, familyTrustDelta: -20 },
};

// ─── Passive trial trigger check ──────────────────────────────────────────────

export function shouldTriggerTrial(state: GameState): {
  charge: TrialCharge;
  accusedId: string;
  accusingClanId: string;
} | null {
  if (state.trialQueue.some(t => !t.resolved)) return null;

  const player = state.family.find(c => c.isPlayer);
  if (!player) return null;

  const accusingClan = state.clans.find(
    c => c.standing === 'hostile' || c.standing === 'rival'
  );
  if (!accusingClan) return null;

  if (player.corruptionScore > 60 && Math.random() < 0.20) {
    return { charge: 'corruption', accusedId: player.id, accusingClanId: accusingClan.id };
  }

  if (state.crisisLevel > 80 && Math.random() < 0.10) {
    return { charge: 'treason', accusedId: player.id, accusingClanId: accusingClan.id };
  }

  return null;
}

// ─── Corruption accumulation ──────────────────────────────────────────────────

export function tickCorruption(
  currentScore: number,
  crisisLevel: number,
  corruptionShield: number
): number {
  if (crisisLevel > 50) {
    const gain = Math.max(0, 2 - corruptionShield);
    return Math.min(100, currentScore + gain);
  }
  return Math.max(0, currentScore - 1);
}
