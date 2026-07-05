export type LeaderBias = 'optimates' | 'populares' | 'military' | 'tradition' | 'commerce';
export type ClanStanding = 'ally' | 'neutral' | 'hostile' | 'rival';

export interface ClanLeaderSkills {
  rhetoric: number;   // 0–10. Drives NPC election score and career advancement.
  martial: number;    // 0–10. Used in military campaign scoring.
  intrigus: number;   // 0–10. Used in intrigue and blackmail checks.
}

export interface ClanLeader {
  id: string;
  name: string;
  title: string;
  emoji: string;
  age: number;
  sphere: string;
  relationship: number;   // -100 to 100 (to player)
  favour: number;         // 0–5 pips
  blackmail: boolean;
  bias: LeaderBias;
  votes: number;          // bloc votes this leader controls; added to player score when canvassed
  bio: string;
  alliance?: boolean;
  allianceTurns?: number;

  // ── NPC career system ─────────────────────────────────────────────────────
  skills: ClanLeaderSkills;
  heldOffices: string[];          // office IDs completed (used for prerequisite checks)
  currentOffice: string | null;   // office ID currently being served
  turnsLeftInOffice: number | null; // seasons remaining in current term
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
