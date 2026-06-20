import type { GameState } from '../state/gameStore';

export type OfficeId =
  | 'vigintivirate'
  | 'quaestor'
  | 'tribune'
  | 'aedile'
  | 'praetor'
  | 'consul'
  | 'censor'
  | 'dictator';

export interface OfficeAction {
  id: string;
  name: string;
  cost: string;
  costVal: number;
  resource: 'gratia' | 'dignitas' | 'denarii' | null;
  desc: string;
  effect: (state: GameState) => Partial<GameState> & { logMsg: string };
}

export interface Office {
  id: OfficeId;
  name: string;
  latin: string;
  icon: string;
  termSeasons: number;
  minAge: number;
  prerequisite: OfficeId | null;
  desc: string;
  flavor: string;
  active: boolean;
  inOfficeActions?: OfficeAction[];
  inOfficeDesc?: string;
}

export interface ElectionRival {
  id: string;
  name: string;
  emoji: string;
  clanName: string;
  clanId: string;
  title: string;
  bias: string;
  baseVotes: number;
  clanInfluence: number;
  strength: number;
}
