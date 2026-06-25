// ─── Province Models ─────────────────────────────────────────────────────────
// All types for the Provinciae system.

export type ProvinceMap = 'italy' | 'mediterranean' | 'east';

export type ProvinceStatus =
  | 'incorporated'       // Full Roman province — Governor system applies
  | 'unincorporated'     // Foreign/frontier — Ambassador system applies
  | 'heartland';         // Latium + permanent Rome core — never governable

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
  commanderCharacterId: string | null; // null = officer role (light system)
  campaignProgress: number;   // 0–100
  enemyStrength: number;      // 0–100
  turnsElapsed: number;
  localSupportBonus: boolean; // true if family Local Support ≥ 40 in province
  resolved: boolean;
  outcome: 'victory' | 'strategic_win' | 'stalemate' | 'defeat' | null;
}

export interface ProvinceAssetOwned {
  definitionId: string;
  tier: 1 | 2;
  turnAcquired: number;
}

export interface ProvinceState {
  id: string;
  map: ProvinceMap;

  // Relationship with Rome (0–100). Heartland provinces always 100.
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

  // Player-owned assets in this province
  ownedAssets: ProvinceAssetOwned[];

  // Whether an incorporation bill has been triggered (unincorporated only)
  incorporationBillAvailable: boolean;

  // Whether a war declaration is available (unincorporated hostile)
  warDeclarationAvailable: boolean;

  // Whether a revolt campaign is active (incorporated hostile)
  revoltActive: boolean;

  // Active campaign (if any)
  activeCampaign: CampaignState | null;
}

export interface NpcRoleHolder {
  name: string;
  clanId: string;
  trait: 'honest' | 'corrupt' | 'competent' | 'negligent';
  policy: GovernorPolicy; // only partially revealed without Local Support
}

// ─── Province Definition (static data) ───────────────────────────────────────

export interface ProvinceAssetDefinition {
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
  dignitasPerTurn?: number;
  gratiaPerTurn?: number;
  imperiuPerTurn?: number;
  relationshipPerTurn?: number;
  corruptionResistance?: number;
}

export interface ProvincialClientDefinition {
  id: string;
  name: string;
  provinceId: string;
  supportRequired: number;
  relationshipRequired: number;
  bonusDescription: string;
  // Skill bonuses applied to assigned character each turn
  skillBonus?: Partial<{ rhetoric: number; auctoritas: number; martial: number; intrigus: number }>;
  resourceBonus?: { goldPerTurn?: number; gratiaPerTurn?: number };
  specialAbility?: string; // ID of special action/mechanic this client unlocks
}

export interface ProvinceEventOption {
  id: string;
  label: string;
  cost?: { resource: string; amount: number };
  skillCheck?: { skill: string; difficulty: number };
  successEffect: string; // applyEffectString-compatible
  failureEffect?: string;
  successText: string;
  failureText?: string;
}

export interface ProvinceEventDefinition {
  id: string;
  title: string;
  description: string;
  triggerCondition: 'governor' | 'ambassador' | 'any';
  minRelationship?: number;
  minLocalSupport?: number;
  region?: string; // if set, only fires in this province
  options: ProvinceEventOption[];
}

export interface ProvinceDefinition {
  id: string;
  name: string;
  latinName: string;
  map: ProvinceMap;
  status: ProvinceStatus; // starting status
  profile: string;        // one-line flavour text
  flavorDescription: string; // longer Province Sheet description

  // Starting stats
  startingRelationship: number;
  startingInfrastructure: number;
  startingLocalSupport: number;

  // Output profile — base values before modifiers
  baseGoldOutput: number;
  baseImperiumOutput: number;

  // Map node position (as % of image dimensions, for absolute positioning)
  nodeX: number; // 0–1
  nodeY: number; // 0–1

  // Available provincial clients
  clientIds: string[];

  // NPC governor starting state
  npcRoleHolder: NpcRoleHolder;
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

// Taxation notch → gold multiplier
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

// Security notch → Imperium base values
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
