import { TroopUnit } from './troop';

export type PersonalityTrait = 'aggressive' | 'content' | 'ambitious' | 'cautious';
export type AmbitionType = 'gain_dignitas' | 'protect_family' | 'personal_power';

// ─── Military Overhaul M4 — captivity status ─────────────────────────────────
// Wounded status is deliberately NOT a Character field — see musterEngine.ts's
// header comment for why (reuses the existing generic `<key>-cooldown` flags
// decay pass in turnSequencer.ts instead of a new per-character field/tick).

export interface CaptivityState {
  status: 'awaiting_ransom' | 'imprisoned';
  demandDenarii: number;
  capturedTurn: number;
}

export interface CharacterSkills {
  rhetoric: number;   // 0–10. Drives Fides income.
  martial: number;    // 0–10. Military campaigns and governor effectiveness.
  intrigus: number;   // 0–10. Corruption shield, blackmail, intelligence.
}

export interface AmbitionGoal {
  type: AmbitionType;
  priority: number; // 0–1
}

export interface Character {
  id: string;
  name: string;
  role: 'paterfamilias' | 'spouse' | 'son' | 'daughter';
  isPlayer: boolean;
  age: number;
  skills: CharacterSkills;
  traits: PersonalityTrait[];
  ambition: AmbitionGoal | null;
  relationship: number;  // -100 to 100 (to player)
  familyTrust: number;   // 0–100

  // Added for multi-feature systems (spec Section 0.2)
  officeId: string | null;                      // current office held (null if none)
  corruptionScore: number;                      // 0–100, triggers prosecution risk
  inheritedTraits: string[];                    // trait IDs from parents (Feature 5)
  ambitionIds: string[];                        // active ambition IDs (Feature 3)
  reputationScores: Record<string, number>;     // clanId → -100 to 100 (Feature 2)

  // Imperium fields
  formalImperium: number;    // 0–3, set by office engine when character holds magistracy
  militaryImperium: number;  // 0–3, derived from personal troop base (calculated in troopEngine)

  // Military fields (Chunk H)
  raisedLegions: TroopUnit[];  // Personal legions raised by this character. Persist across postings.
  veterans: TroopUnit[];        // Veterans from survived campaigns. Never lost between postings.

  // Military Overhaul M4 — optional so existing Character object literals
  // (startingFamily.ts, birth/inheritance) don't all need updating; absent
  // is equivalent to null (not captured).
  captivity?: CaptivityState | null;

  // Military Overhaul M8 — unit lifecycle. Tracks who last commanded this
  // character's own troops in a set-piece battle, so musterEngine.ts can
  // detect a commander change (-10 loyalty) at the NEXT battle write-back.
  // Optional/absent = "no battle fought yet under this system" (not treated
  // as a change on the first battle). See musterEngine.ts's header comment
  // for the full "commander changed" interpretation.
  lastLoyaltyCommanderId?: string | null;
}
