export type ClientType = 'muscle' | 'publicSupport' | 'votingSway';

export interface Client {
  id: string;           // e.g. 'client-1718023400000'
  name: string;         // randomly generated from clientNames.ts pool
  type: ClientType;
  acquiredTurn: number; // state.turnNumber at acquisition time
}
