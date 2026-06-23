export type AmbitionScope = 'family' | 'character';
export type AmbitionStatus = 'active' | 'completed' | 'failed' | 'expired';

export interface AmbitionReward {
  gold?: number;
  dignitas?: number;
  gratia?: number;
  gravitas?: number;
  imperium?: number;
  traitId?: string;         // grants a trait to the target character
  assetId?: string;         // grants an asset (tier 1) for free
  reputationBonus?: { clanId: string; delta: number }[];
  chainAmbitionId?: string; // immediately offers this ambition on completion
}

export interface AmbitionConsequence {
  gold?: number;            // negative = loss
  dignitas?: number;
  familyTrustDelta?: number;
  reputationPenalty?: { clanId: string; delta: number }[];
}

export interface AmbitionCondition {
  type:
    | 'hold_office'           // a family member holds officeId
    | 'reach_reputation'      // reputationScore with clanId >= threshold
    | 'own_asset'             // own assetId at tier >= minTier
    | 'accumulate_resource'   // resource pool >= amount at turn end
    | 'win_election'          // family member wins specific magistracy
    | 'survive_turns'         // family survives N more turns (dynasty ambition)
    | 'produce_heir'          // family has a character born this generation
    | 'prosecute_rival'       // successfully prosecute a character from clanId
    | 'patron_tier_reached';  // reach a specific PatronTier
  officeId?: string;
  clanId?: string;
  threshold?: number;
  assetId?: string;
  minTier?: 1 | 2 | 3;
  resource?: 'gold' | 'dignitas' | 'gratia' | 'gravitas' | 'imperium';
  amount?: number;
  turns?: number;
}

export interface AmbitionDefinition {
  id: string;
  scope: AmbitionScope;
  title: string;
  description: string;
  flavourText: string;
  completionCondition: AmbitionCondition;
  reward: AmbitionReward;
  expiresInTurns?: number;
  consequence?: AmbitionConsequence;
}

export interface ActiveAmbition {
  definitionId: string;
  scope: AmbitionScope;
  assignedCharacterId?: string; // only for character-scope ambitions
  status: AmbitionStatus;
  turnActivated: number;
  turnCompleted?: number;
  turnsRemaining?: number;      // counts down each season if expiresInTurns set
}
