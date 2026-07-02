export type ClientType = 'muscle' | 'publicSupport' | 'votingSway';

export interface ClientBonus {
  gold?: number;
  fides?: number;
  lifetimeDignitas?: number;
  trialDefenseBonus?: number;
  corruptionShield?: number;
  rhetoricalBonus?: number;
  martialBonus?: number;
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
