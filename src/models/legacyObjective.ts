export interface LegacyBonus {
  resourceMultiplier?: Partial<Record<'gold' | 'lifetimeDignitas' | 'fides' | 'imperium', number>>;
  flatBonus?: Partial<Record<'gold' | 'lifetimeDignitas' | 'fides' | 'imperium', number>>;
  unlocksTrait?: string;
  unlocksAsset?: string;
}

export interface LegacyMilestone {
  threshold: number;
  label: string;
  permanentBonus: LegacyBonus;
}

export interface LegacyObjectiveDefinition {
  id: string;
  title: string;
  description: string;
  trackingUnit: string;
  milestones: LegacyMilestone[];
}

export interface LegacyObjective {
  definitionId: string;
  currentValue: number;         // lifetime accumulated value
  milestonesReached: number[];  // threshold values already claimed
}
