export type ClientType = 'muscle' | 'publicSupport' | 'votingSway';

export interface ClientBonus {
  gold?: number;
  fides?: number;
  lifetimeDignitas?: number;
  trialDefenseBonus?: number;
  corruptionShield?: number;
  rhetoricalBonus?: number;
  martialBonus?: number;
  /** July 2026 fixes, Chunk D — parity with rhetoricalBonus/martialBonus so
   *  CityClientDefinition.skillBonus.intrigus has somewhere real to go. */
  intrigusBonus?: number;
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
