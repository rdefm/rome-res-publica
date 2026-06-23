export type TrialCharge = 'corruption' | 'treason' | 'bribery' | 'extortion';
export type TrialOutcome = 'acquitted' | 'dismissed' | 'fined' | 'exiled' | 'executed' | 'pending';

export interface Trial {
  id: string;
  accusedCharacterId: string;
  accusingClanId: string;
  charge: TrialCharge;
  defenseStrength: number;
  prosecutionStrength: number;
  turnsUntilResolution: number;
  outcome: TrialOutcome;
}
