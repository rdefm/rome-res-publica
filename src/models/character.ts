export type PersonalityTrait = 'aggressive' | 'content' | 'ambitious' | 'cautious';
export type AmbitionType = 'gain_dignitas' | 'protect_family' | 'personal_power';

export interface CharacterSkills {
  rhetoric: number;    // 0–10. Drives Gravitas income.
  auctoritas: number;  // 0–10. Drives Dignitas income.
  martial: number;     // 0–10. Reserved for Provinciae (v3).
  intrigus: number;    // 0–10. Drives Gratia income.
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
  inheritedTraits: string[];                    // trait IDs from parents (Feature 5)
  ambitionIds: string[];                        // active ambition IDs (Feature 3)
  reputationScores: Record<string, number>;     // clanId → -100 to 100 (Feature 2)
}
