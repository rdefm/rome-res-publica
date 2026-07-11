import { TroopUnit } from './troop';
import type { OfficeId } from './office';

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
  /** Phase 4, Chunk P4-A — historical record of offices this character has won,
   *  appended at the same moment GameState.heldOffices is (election victory in
   *  turnSequencer.ts / Tribune grant in gameStore.ts), not at term end. Feeds
   *  CursusScreen's isHeld/prereqMet for non-player family members (previously
   *  read the always-effectively-null character.officeId — see that screen's
   *  OfficeRung) and secretEngine's provincial_plunder eligibility gate.
   *  Does NOT fix the deeper single-office-slot model: only one family member's
   *  office is ever "current" at a time (GameState.currentOffice); isCurrent for
   *  non-player characters is unchanged by this field. */
  heldOffices: OfficeId[];
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

// ─── Phase 3, Chunk P3-C — Succession ────────────────────────────────────────

/** Set on GameState when the paterfamilias dies (natural age-based death or
 *  battle death — both routed through inheritanceEngine.detectPaterfamiliasDeath
 *  into the same scripted sequence, successionEvents.ts). Consumed by
 *  gameStore.succeedPaterfamilias, which clears it. */
export interface PendingSuccession {
  deceasedId: string;
  deceasedName: string;
  deceasedAge: number;
  /** One template-light line for the death card — robust to a paterfamilias
   *  with no notable offices/traits. See inheritanceEngine.ts. */
  rememberedDetail: string;
  /** Priority order (eldest son > eldest daughter > eldest spouse, then
   *  every other eligible relative) — [0] is the default heir offered in
   *  the confirmation card; the rest are the "name a different heir"
   *  choices. Empty if no eligible heir exists — P3-D's extinction path:
   *  the cadet-branch continuation offer (or, on a second extinction, the
   *  dark ending) instead of the normal funeral/heir chain. */
  eligibleHeirIds: string[];
}

/** Set on GameState while the confirmed heir is under
 *  BALANCE.succession.regencyMinorAge. Cleared at the yearly rollover once
 *  the heir comes of age. */
export interface Regency {
  heirId: string;
  regentId: string | null;
  /** GameState.year the heir turns regencyMinorAge — regency clears then. */
  untilYear: number;
}

// ─── Phase 3, Chunk P3-D — Cadet Branch ──────────────────────────────────────
// A collateral Brutia relative, generated once at run start and tracked
// minimally — NOT a member of the playable `family` array (keeps Domus
// uncluttered and him non-controllable) until/unless he is ever promoted via
// gameStore's continueAsCadet: effect-string token (inheritanceEngine.
// promoteCadetToParterfamilias). Folded into this file rather than a new
// models/cadet.ts — a single small interface, consistent with keeping
// family-domain types together (PendingSuccession/Regency above).

export interface CadetBranch {
  id: string;
  /** Brutia gens + a praenomen from LEADER_PRAENOMINA (reputationEngine.ts's
   *  existing successor-generator pool) — see inheritanceEngine.generateCadet. */
  name: string;
  age: number;
  skills: CharacterSkills;
  /** One personality trait for flavour — not mechanically applied (this is
   *  an NPC, not a playable Character; no skill-modifier pass runs on him). */
  trait: PersonalityTrait;
  /** One authored-ish line assembled from trait/stats, used by
   *  cadetEvents.ts's evt-cadet-visit content. */
  characterization: string;
  /** How many times evt-cadet-visit has fired this run — caps at
   *  BALANCE.cadet.maxVisits. */
  metCount: number;
  /** 0–100, the player's rapport with the cadet line. */
  standing: number;
  /** False once he has died of old age — see the yearly-rollover aging
   *  tick (turnSequencer.ts). A dead cadet does not disable the extinction
   *  safety net: detectPaterfamiliasDeath's caller lazily regenerates a
   *  fresh one at extinction time rather than maintaining a continuously
   *  "topped up" living backup (D4's documented lifecycle choice). */
  alive: boolean;
}
