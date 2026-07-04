export type ClientType = 'muscle' | 'publicSupport' | 'votingSway';

export interface ClientBonus {
  gold?: number;
  fides?: number;
  lifetimeDignitas?: number;
  trialDefenseBonus?: number;
  corruptionShield?: number;
  rhetoricalBonus?: number;
  martialBonus?: number;
  /** Votes added directly to the player's election score. Defaults to 1 if unset. */
  votingSwayBonus?: number;
}

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  flavourTitle: string;
  flavourText: string;
  bonus: ClientBonus;
  acquiredTurn: number;
}
