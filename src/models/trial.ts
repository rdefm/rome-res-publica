export type TrialOutcome = 'acquitted' | 'fined' | 'exiled' | 'executed' | 'dismissed';
export type TrialRole = 'defendant' | 'prosecutor';
export type TrialCharge = 'corruption' | 'treason' | 'electoral_fraud' | 'murder';

export interface Trial {
  id: string;
  accusedCharacterId: string;
  accusingClanId: string;
  charge: TrialCharge;
  defenseStrength: number;      // 0–100, player raises this via actions
  prosecutionStrength: number;  // set at creation based on accuser stats
  turnsRemaining: number;       // seasons left to prepare
  resolved: boolean;
  outcome?: TrialOutcome;
  actionsUsed: string[];        // trial action IDs already spent this trial
}

export interface TrialAction {
  id: string;
  label: string;
  cost: { resource: 'denarii' | 'fides'; amount: number };
  defenseBonus: number;
  requiresAssetAction?: string; // asset action ID required to unlock
}
