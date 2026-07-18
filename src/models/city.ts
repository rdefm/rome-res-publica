// ─── City Models ─────────────────────────────────────────────────────────────
// All types for the Provinciae system's cities — renamed wholesale from the
// former "province" vocabulary (Campaign Map plan, Chunk C1) so that a new
// higher-level `Region` (src/models/theatre.ts) can group several cities
// (e.g. Sicily groups Messana/Syracuse/Agrigentum/Lilybaeum) without the
// word "province" describing two different granularities at once. This is a
// rename only — every Governor/Ambassador/relationship/campaign mechanic
// below is unchanged from its pre-rename behaviour.
//
// SCOPE NOTE: the `provinceId`-named foreign-key fields/params scattered
// across other systems (bills, secrets, trials, agenda, office actions, the
// old campaign/commander-election flow below) were deliberately NOT renamed
// to `cityId` — they still validly reference a city id, renaming them is
// unrelated churn across systems this chunk doesn't otherwise touch. Only
// the entity's own type/data/engine/store-field layer was renamed.

export type CityMap = 'italy' | 'mediterranean' | 'east';

export type CityStatus =
  | 'incorporated'       // Full Roman province — Governor system applies
  | 'unincorporated'     // Foreign/frontier — Ambassador system applies
  | 'heartland'          // Latium + permanent Rome core — never governable
  | 'foreign';           // Held by a rival power or independent — no Governor/Ambassador system until it flips to Rome (see CityDefinition.conquestFlag)

// Who currently holds a city. 'rome' covers incorporated/unincorporated/heartland;
// 'carthage' and 'independent' are only meaningful for status: 'foreign'.
export type CityOwner = 'rome' | 'carthage' | 'independent';

export type RelationshipTier =
  | 'hostile'       // 0–15
  | 'restless'      // 16–30
  | 'uneasy'        // 31–50
  | 'cooperative'   // 51–70
  | 'loyal'         // 71–85
  | 'integrated';   // 86–100

export type TaxationNotch = 'benevolent' | 'light' | 'standard' | 'heavy' | 'extortionate';
export type SecurityNotch = 'neglect' | 'light_patrol' | 'standard_garrison' | 'heavy_garrison' | 'full_occupation';
export type DevelopmentNotch = 'exploit' | 'neglect' | 'maintain' | 'invest' | 'major_works';

export interface GovernorPolicy {
  taxation: TaxationNotch;
  security: SecurityNotch;
  development: DevelopmentNotch;
}

export interface AmbassadorState {
  characterId: string;     // Which family member is posted
  personalRapport: number; // 0–50, resets on new posting
  turnsServed: number;     // Each year (4 turns) requires reappointment
  actionsUsedThisTurn: string[]; // action IDs used this season (cooldowns)
  intelRevealed: number;   // 0–6 intel slots revealed
}

export interface GovernorState {
  characterId: string;
  policy: GovernorPolicy;
  corruptionAccrued: number; // accumulates during term, follows character home
  turnsServed: number;
}

export interface CampaignState {
  id: string;
  provinceId: string;
  type: 'conquest' | 'defence' | 'suppression' | 'allied_support';
  commanderCharacterId: string | null; // null = NPC commander (light officer system)
  campaignProgress: number;   // 0–100
  enemyStrength: number;      // 0–100
  turnsElapsed: number;
  localSupportBonus: boolean; // true if family Local Support ≥ 40 in province
  resolved: boolean;
  outcome: 'victory' | 'strategic_win' | 'stalemate' | 'defeat' | null;
  activeEventId: string | null; // ID of a pending campaign event card, if any
}

export interface CityAssetOwned {
  definitionId: string;
  tier: 1 | 2;
  turnAcquired: number;
}

export interface CityState {
  id: string;
  map: CityMap;
  status: CityStatus; // mirrors CityDefinition.status, but is the mutable copy — this is
                       // what engines should branch on, since it is the field that actually
                       // changes at runtime (e.g. a 'foreign' city flipping to Rome)
  owner: CityOwner;    // mirrors CityDefinition.owner at start; flips with status on conquest

  // Relationship with Rome (0–100). Heartland cities always 100.
  relationshipScore: number;

  // Internal stability — only meaningful post-incorporation
  internalStability: number; // 0–100

  // Infrastructure rating — persists across governors
  infrastructureRating: number; // 0–100

  // Local Support — how embedded the player family is (0–100)
  localSupport: number;

  // Current role-holder
  playerGovernor: GovernorState | null;
  playerAmbassador: AmbassadorState | null;
  npcRoleHolder: NpcRoleHolder | null;

  // Player-owned assets in this city
  ownedAssets: CityAssetOwned[];

  // Whether an incorporation bill has been triggered (unincorporated only)
  incorporationBillAvailable: boolean;

  // Whether a war declaration is available (unincorporated hostile)
  warDeclarationAvailable: boolean;

  // Whether a revolt campaign is active (incorporated hostile)
  revoltActive: boolean;

  // Active campaign (if any)
  activeCampaign: CampaignState | null;

  // Officer volunteer for the active campaign (if any)
  officerVolunteer: OfficerVolunteerState | null;

  // ── Crisis track inputs ───────────────────────────────────────────────────
  // Seasons since last infrastructure improvement. Used by Economy crisis escalation.
  // Resets to 0 whenever infrastructureRating increases.
  infraStagnationSeasons: number;
  // Infrastructure score at end of previous season. Used to detect improvement.
  lastInfraScore: number;
}

export interface NpcRoleHolder {
  name: string;
  clanId: string;
  trait: 'honest' | 'corrupt' | 'competent' | 'negligent';
  policy: GovernorPolicy; // only partially revealed without Local Support
}

// ─── Governor Assignment ──────────────────────────────────────────────────────

/**
 * A character (player family OR NPC clan leader) eligible to be assigned
 * a governorship after completing a praetor or consul term.
 */
export interface GovernorCandidate {
  characterId: string;
  characterName: string;
  clanId: string;
  clanName: string;
  isPlayerFamily: boolean;
  martialSkill: number; // 0–10
  eligibleOffices: string[];
}

/**
 * Pending governor assignment — set when a character's term ends.
 * If rigSucceeded, the player may choose the province.
 * Otherwise the province is drawn at random and stored in assignedProvinceId.
 */
export interface PendingGovernorAssignment {
  characterId: string;
  characterName: string;
  isPlayerFamily: boolean;
  clanId: string;
  rigAttempted: boolean;
  rigSucceeded: boolean;
  assignedProvinceId: string | null; // null until drawn or chosen
}

// ─── Commander Election ───────────────────────────────────────────────────────

/**
 * Active senate vote to elect a campaign commander.
 * Fires at end-of-season when a campaign is triggered without a commander.
 */
export interface CommanderElectionState {
  provinceId: string;
  campaignType: CampaignState['type'];
  candidates: GovernorCandidate[];
  playerSupportedCandidateId: string | null;
  playerSpeechBonus: number; // accumulated from speech actions
  resolved: boolean;
}

// ─── Officer Volunteer ────────────────────────────────────────────────────────

/**
 * A family member who has volunteered as an officer in an active campaign.
 * Uses the Light system: 3 decision-point events over the campaign duration.
 */
export interface OfficerVolunteerState {
  campaignId: string;
  provinceId: string;
  characterId: string;
  characterName: string;
  decisionsResolved: number; // 0–3
  successCount: number;
  decisions: Array<{
    decisionId: string;
    tookRisk: boolean;
    success: boolean;
  }>;
  resolved: boolean;
}

// ─── City Definition (static data) ───────────────────────────────────────────

export interface CityAssetDefinition {
  id: string;
  name: string;
  cost: number;
  tier1Bonus: AssetBonus;
  tier2Bonus: AssetBonus;
  localSupportGain: number;
  flavorText: string;
}

export interface AssetBonus {
  label: string;
  goldPerTurn?: number;
  /** Consolidated from the former dignitasPerTurn/gratiaPerTurn fields — both resources were removed. */
  fidesPerTurn?: number;
  imperiumPerTurn?: number;
  relationshipPerTurn?: number;
  corruptionResistance?: number;
}

export interface CityClientDefinition {
  id: string;
  name: string;
  provinceId: string;
  supportRequired: number;
  relationshipRequired: number;
  bonusDescription: string;
  skillBonus?: Partial<{ rhetoric: number; auctoritas: number; martial: number; intrigus: number }>;
  resourceBonus?: { goldPerTurn?: number; gratiaPerTurn?: number };
  specialAbility?: string;
}

export interface CityEventOption {
  id: string;
  label: string;
  cost?: { resource: string; amount: number };
  skillCheck?: { skill: string; difficulty: number };
  successEffect: string;
  failureEffect?: string;
  successText: string;
  failureText?: string;
}

export interface CityEventDefinition {
  id: string;
  title: string;
  description: string;
  triggerCondition: 'governor' | 'ambassador' | 'any';
  minRelationship?: number;
  minLocalSupport?: number;
  region?: string;
  options: CityEventOption[];
}

export interface CityDefinition {
  id: string;
  name: string;
  latinName: string;
  map: CityMap;
  status: CityStatus;
  owner: CityOwner;
  // Set only for status: 'foreign' independent states that are diplomatically bound to a
  // stronger power without being that power's own territory (e.g. Numidia is a Carthaginian
  // client, not Carthaginian soil). Purely descriptive — no engine reads it yet.
  clientOf?: CityOwner;
  // Set only on status: 'foreign' cities with a scripted path into Roman hands. When
  // state.flags[conquestFlag] becomes truthy, cityEngine.applyCityFlips flips this
  // city's CityState to owner: 'rome', status: 'unincorporated' at the next season tick.
  conquestFlag?: string;
  profile: string;
  flavorDescription: string;

  startingRelationship: number;
  startingInfrastructure: number;
  startingLocalSupport: number;

  baseGoldOutput: number;
  baseImperiumOutput: number;

  nodeX: number;
  nodeY: number;

  clientIds: string[];
  npcRoleHolder: NpcRoleHolder;

  // ── Crisis track inputs ───────────────────────────────────────────────────
  // Optional flavour name for this city's contribution to the War crisis string.
  // e.g. 'Sicilian War' for sicilia. If absent, the generic tier label is used.
  namedWar?: string;
  // Multiplier for how much this city's hostile relationship contributes to
  // the War track. Default 1.0. Strategically critical cities (e.g. Sicily
  // at the start of the Punic Wars) can be set higher.
  threatWeight?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getRelationshipTier(score: number): RelationshipTier {
  if (score <= 15) return 'hostile';
  if (score <= 30) return 'restless';
  if (score <= 50) return 'uneasy';
  if (score <= 70) return 'cooperative';
  if (score <= 85) return 'loyal';
  return 'integrated';
}

export function getRelationshipLabel(score: number): string {
  const tier = getRelationshipTier(score);
  const labels: Record<RelationshipTier, string> = {
    hostile:     'Hostile',
    restless:    'Restless',
    uneasy:      'Uneasy',
    cooperative: 'Cooperative',
    loyal:       'Loyal',
    integrated:  'Integrated',
  };
  return labels[tier];
}

export function getInfrastructureMultiplier(rating: number): number {
  if (rating <= 20) return 0.8;
  if (rating <= 40) return 1.0;
  if (rating <= 60) return 1.2;
  if (rating <= 80) return 1.4;
  return 1.6;
}

export function getRelationshipOutputMultiplier(score: number): number {
  const tier = getRelationshipTier(score);
  switch (tier) {
    case 'hostile':     return 0;
    case 'restless':    return 0.5;
    case 'uneasy':      return 1.0;
    case 'cooperative': return 1.1;
    case 'loyal':       return 1.2;
    case 'integrated':  return 1.3;
  }
}

export const TAXATION_GOLD_MULT: Record<TaxationNotch, number> = {
  benevolent:    0.5,
  light:         1.0,
  standard:      1.2,
  heavy:         1.5,
  extortionate:  2.0,
};

export const TAXATION_REL_PER_YEAR: Record<TaxationNotch, number> = {
  benevolent:   6,
  light:        3,
  standard:     0,
  heavy:       -5,
  extortionate:-10,
};

export const TAXATION_CORRUPTION_PER_TURN: Record<TaxationNotch, number> = {
  benevolent:   0,
  light:        0,
  standard:     2,
  heavy:        5,
  extortionate: 10,
};

// Public/Senate treasury (rome.treasury) income per season from each currently
// incorporated city, scaled by its live tax policy. Anchor points (standard
// 0.5, extortionate 1, benevolent 0) are a first-pass/unverified balance call;
// light/heavy are linearly interpolated between their neighbours.
export const TAXATION_TREASURY_PER_TURN: Record<TaxationNotch, number> = {
  benevolent:   0,
  light:        0.25,
  standard:     0.5,
  heavy:        0.75,
  extortionate: 1,
};

export const SECURITY_IMPERIUM_BASE: Record<SecurityNotch, number> = {
  neglect:           0,
  light_patrol:      1,
  standard_garrison: 2,
  heavy_garrison:    4,
  full_occupation:   6,
};

export const SECURITY_IMPERIUM_MULT: Record<SecurityNotch, number> = {
  neglect:           0,
  light_patrol:      1.0,
  standard_garrison: 1.5,
  heavy_garrison:    2.5,
  full_occupation:   4.0,
};

export const SECURITY_REVOLT_DELTA: Record<SecurityNotch, number> = {
  neglect:           0.15,
  light_patrol:      0,
  standard_garrison: -0.10,
  heavy_garrison:    -0.25,
  full_occupation:   -0.35,
};

export const SECURITY_REL_PER_YEAR: Record<SecurityNotch, number> = {
  neglect:           -3,
  light_patrol:      0,
  standard_garrison: 0,
  heavy_garrison:    2,
  full_occupation:   3,
};

export const SECURITY_GOLD_COST: Record<SecurityNotch, number> = {
  neglect:           0,
  light_patrol:      5,
  standard_garrison: 15,
  heavy_garrison:    30,
  full_occupation:   50,
};

export const DEVELOPMENT_GOLD_COST: Record<DevelopmentNotch, number> = {
  exploit:     0,
  neglect:     0,
  maintain:    5,
  invest:      20,
  major_works: 40,
};

export const DEVELOPMENT_INFRA_DELTA: Record<DevelopmentNotch, number> = {
  exploit:    -5,
  neglect:     0,
  maintain:    0,
  invest:      2,
  major_works: 5,
};

export const DEVELOPMENT_REL_PER_YEAR: Record<DevelopmentNotch, number> = {
  exploit:     0,
  neglect:     0,
  maintain:    0,
  invest:      3,
  major_works: 6,
};

export const DEVELOPMENT_GOLD_BONUS: Record<DevelopmentNotch, number> = {
  exploit:     10,
  neglect:     0,
  maintain:    0,
  invest:      0,
  major_works: 0,
};
