export type LeaderBias = 'optimates' | 'populares' | 'military' | 'tradition' | 'commerce';
export type ClanStanding = 'ally' | 'neutral' | 'hostile' | 'rival';

export interface ClanLeader {
  id: string;
  name: string;
  title: string;
  emoji: string;
  age: number;
  sphere: string;
  relationship: number;   // -100 to 100 (to player)
  favour: number;         // 0–5 pips
  blackmail: boolean;     // player holds leverage, or they hold it against player
  bias: LeaderBias;
  votes: number;
  bio: string;
  alliance?: boolean;
  allianceTurns?: number; // seasons remaining on forged alliance
}

export interface Clan {
  id: string;
  name: string;
  sigil: string;
  standing: ClanStanding;
  influence: number; // 0–100
  desc: string;
  leaders: ClanLeader[];
}
