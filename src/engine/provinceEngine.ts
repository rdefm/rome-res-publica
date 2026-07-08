import type { GameState } from '../state/gameStore';
import type {
  ProvinceState,
  GovernorPolicy,
  TaxationNotch,
  SecurityNotch,
  DevelopmentNotch,
} from '../models/province';
import {
  TAXATION_REL_PER_YEAR,
  TAXATION_CORRUPTION_PER_TURN,
  TAXATION_GOLD_MULT,
  SECURITY_IMPERIUM_BASE,
  SECURITY_IMPERIUM_MULT,
  SECURITY_REVOLT_DELTA,
  SECURITY_REL_PER_YEAR,
  SECURITY_GOLD_COST,
  DEVELOPMENT_GOLD_COST,
  DEVELOPMENT_INFRA_DELTA,
  DEVELOPMENT_REL_PER_YEAR,
  DEVELOPMENT_GOLD_BONUS,
  getInfrastructureMultiplier,
  getRelationshipOutputMultiplier,
  getRelationshipTier,
} from '../models/province';
import { getProvinceDefinition } from '../data/provinceDefinitions';
import { getProvinceAssetDefinition } from '../data/provinceAssets';

// ─── Province Engine ──────────────────────────────────────────────────────────

/**
 * Calculate gold output for a governed province this turn.
 */
export function calcProvinceGoldOutput(
  province: ProvinceState,
  policy: GovernorPolicy,
  governorMartial: number = 0
): number {
  const def = getProvinceDefinition(province.id);
  if (!def || def.status === 'heartland') return 0;

  const baseGold = def.baseGoldOutput;
  const taxMult = TAXATION_GOLD_MULT[policy.taxation];
  const infraMult = getInfrastructureMultiplier(province.infrastructureRating);
  const relMult = getRelationshipOutputMultiplier(province.relationshipScore);
  const developmentBonus = DEVELOPMENT_GOLD_BONUS[policy.development];
  const securityCost = SECURITY_GOLD_COST[policy.security];
  const devCost = DEVELOPMENT_GOLD_COST[policy.development];

  const raw = (baseGold * taxMult * infraMult * relMult) + developmentBonus - securityCost - devCost;
  return Math.max(0, Math.round(raw));
}

/**
 * Calculate Imperium output for a governor/officer this turn.
 * Formula: base × mult × (1 + Martial/100)
 */
export function calcProvinceImperiumOutput(
  province: ProvinceState,
  policy: GovernorPolicy,
  governorMartial: number
): number {
  if (province.id === 'latium') return 0;
  const base = SECURITY_IMPERIUM_BASE[policy.security];
  if (base === 0) return 0;
  const mult = SECURITY_IMPERIUM_MULT[policy.security];
  const martialScale = 1 + governorMartial / 100;
  return Math.round(base * mult * martialScale);
}

/**
 * Calculate per-turn relationship delta from governor policy.
 * Returns change per year (4 turns) — divide by 4 for per-turn.
 */
export function calcRelationshipDelta(policy: GovernorPolicy): number {
  const taxDelta = TAXATION_REL_PER_YEAR[policy.taxation];
  const secDelta = SECURITY_REL_PER_YEAR[policy.security];
  const devDelta = DEVELOPMENT_REL_PER_YEAR[policy.development];
  return taxDelta + secDelta + devDelta; // per-year total; apply /4 per turn
}

/**
 * Calculate corruption accrual per turn from policy.
 */
export function calcCorruptionAccrual(policy: GovernorPolicy): number {
  return TAXATION_CORRUPTION_PER_TURN[policy.taxation];
}

/**
 * Calculate infrastructure change per turn from development policy.
 */
export function calcInfrastructureDelta(policy: GovernorPolicy): number {
  return DEVELOPMENT_INFRA_DELTA[policy.development];
}

/**
 * Calculate revolt probability per turn for an incorporated province.
 * Base chance modified by relationship, security, and local support.
 */
export function calcRevoltChance(
  province: ProvinceState,
  policy: GovernorPolicy
): number {
  const tier = getRelationshipTier(province.relationshipScore);
  if (tier === 'integrated' || tier === 'loyal') return 0;

  let baseChance = 0;
  switch (tier) {
    case 'hostile':  baseChance = 0.30; break;
    case 'restless': baseChance = 0.10; break;
    case 'uneasy':   baseChance = 0.03; break;
    default:         baseChance = 0;
  }

  const securityModifier = SECURITY_REVOLT_DELTA[policy.security];
  const supportBonus = province.localSupport >= 50 ? -0.05 : 0;

  return Math.max(0, baseChance + securityModifier + supportBonus);
}

/**
 * Tick one province forward one season.
 * Returns updated province state + resource deltas to apply to the game state.
 *
 * Chunk 2B addition: stagnation tracking.
 * prevInfra is captured before any changes. After all infra updates,
 * infraStagnationSeasons is incremented if infra did not improve, reset if it did.
 * lastInfraScore is updated to the current season's final value.
 * The stagnation counter is READ by crisisEngine.calcIndividualEscalation (Economy track).
 */
export function tickProvince(
  province: ProvinceState,
  governorMartial: number,
  assetRelBonus: number // bonus from owned assets (e.g. temple patronage)
): {
  updatedProvince: ProvinceState;
  goldDelta: number;
  imperiumDelta: number;
  corruptionDelta: number;
  events: string[];
} {
  const events: string[] = [];
  let p = { ...province };

  // Heartland (Latium) — no ticking needed
  if (p.id === 'latium') {
    return { updatedProvince: p, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, events };
  }

  const def = getProvinceDefinition(p.id);
  if (!def) {
    return { updatedProvince: p, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, events };
  }

  let goldDelta = 0;
  let imperiumDelta = 0;
  let corruptionDelta = 0;

  // Capture infra before any changes — used for stagnation tracking at end of tick
  const prevInfra = p.infrastructureRating;

  // ── Player governor ticking ──────────────────────────────────────────────
  if (p.playerGovernor) {
    const policy = p.playerGovernor.policy;

    // Gold
    goldDelta += calcProvinceGoldOutput(p, policy, governorMartial);

    // Imperium
    imperiumDelta += calcProvinceImperiumOutput(p, policy, governorMartial);

    // Corruption
    const corruptionAccrual = calcCorruptionAccrual(policy);
    corruptionDelta += corruptionAccrual;
    p = {
      ...p,
      playerGovernor: {
        ...p.playerGovernor,
        corruptionAccrued: p.playerGovernor.corruptionAccrued + corruptionAccrual,
        turnsServed: p.playerGovernor.turnsServed + 1,
      },
    };

    // Relationship change (per turn = per-year total / 4)
    const relPerYear = calcRelationshipDelta(policy);
    const relThisTurn = relPerYear / 4 + assetRelBonus;
    p = {
      ...p,
      relationshipScore: Math.max(0, Math.min(100, p.relationshipScore + relThisTurn)),
    };

    // Infrastructure
    const infraDelta = calcInfrastructureDelta(policy);
    p = {
      ...p,
      infrastructureRating: Math.max(0, Math.min(100, p.infrastructureRating + infraDelta)),
    };

    // Governor term check (4 turns = 1 year term)
    if (p.playerGovernor.turnsServed >= 3) {
      events.push(`⚖ ${def.name}: your governor's term ends this season. A new lot will be drawn after your next office concludes.`);
    }
    if (p.playerGovernor.turnsServed >= 4) {
      const exGovernorId = p.playerGovernor.characterId;
      p = {
        ...p,
        playerGovernor: null,
        npcRoleHolder: def.npcRoleHolder ?? {
          name: 'Interim Prefect',
          clanId: '',
          trait: 'negligent',
          policy: { taxation: 'standard', security: 'standard_garrison', development: 'maintain' },
        },
      };
      events.push(`Governor term concluded in ${def.name}. The province reverts to senatorial control.`);
    }
  }

  // ── NPC governor ticking ─────────────────────────────────────────────────
  else if (p.npcRoleHolder && def.status !== 'heartland') {
    const npc = p.npcRoleHolder;
    const policy = npc.policy;

    // NPC corruption quietly destabilises
    let relDelta = calcRelationshipDelta(policy) / 4;
    if (npc.trait === 'corrupt') {
      relDelta -= 1.5;
    } else if (npc.trait === 'competent') {
      relDelta += 0.5;
    }

    relDelta += assetRelBonus;
    p = {
      ...p,
      relationshipScore: Math.max(0, Math.min(100, p.relationshipScore + relDelta)),
    };

    // NPC infra change
    const infraDelta = calcInfrastructureDelta(policy);
    p = {
      ...p,
      infrastructureRating: Math.max(0, Math.min(100, p.infrastructureRating + infraDelta * 0.5)),
    };
  }

  // ── Stagnation tracking (Chunk 2B) ────────────────────────────────────────
  // Compare the current season's final infra to what it was at the start of the tick.
  // If it improved (even fractionally), reset the counter; otherwise increment.
  // crisisEngine.calcEconomyEscalation reads this counter to drive the Economy track.
  {
    const currInfra = p.infrastructureRating;
    if (currInfra > prevInfra) {
      // Infrastructure improved — reset stagnation counter
      p = { ...p, infraStagnationSeasons: 0, lastInfraScore: currInfra };
    } else {
      // No improvement this season — advance counter
      p = {
        ...p,
        infraStagnationSeasons: (p.infraStagnationSeasons ?? 0) + 1,
        lastInfraScore: currInfra,
      };
    }
  }

  // ── Revolt check (incorporated provinces only) ───────────────────────────
  if (def.status === 'incorporated' && !p.revoltActive) {
    const policy = p.playerGovernor?.policy ?? p.npcRoleHolder?.policy ?? {
      taxation: 'standard' as TaxationNotch,
      security: 'light_patrol' as SecurityNotch,
      development: 'neglect' as DevelopmentNotch,
    };
    const revoltChance = calcRevoltChance(p, policy);
    if (revoltChance > 0 && Math.random() < revoltChance) {
      p = { ...p, revoltActive: true };
      events.push(`⚔ REVOLT in ${def.name}! The province has risen against Roman authority.`);
    }
  }

  // ── Relationship threshold checks ────────────────────────────────────────
  const tier = getRelationshipTier(p.relationshipScore);

  // Unincorporated: incorporation available at 86+
  if (def.status === 'unincorporated' && p.relationshipScore >= 86 && !p.incorporationBillAvailable) {
    p = { ...p, incorporationBillAvailable: true };
    events.push(`${def.name} is now ready for incorporation into Rome. A civitas bill can be tabled in the Curia.`);
  }

  // Unincorporated: war declaration available at 0–15
  if (def.status === 'unincorporated' && tier === 'hostile' && !p.warDeclarationAvailable) {
    p = { ...p, warDeclarationAvailable: true };
    events.push(`${def.name} has become hostile. A War Declaration can now be tabled in the Curia.`);
  }

  // ── Local Support from assets ─────────────────────────────────────────────
  if (p.ownedAssets.length >= 2) {
    p = {
      ...p,
      relationshipScore: Math.max(0, Math.min(100, p.relationshipScore + 2)),
    };
  }

  return { updatedProvince: p, goldDelta, imperiumDelta, corruptionDelta, events };
}

/**
 * Tick all provinces. Returns updated array + aggregate resource deltas.
 */
export function tickAllProvinces(
  provinces: ProvinceState[],
  state: GameState
): {
  updatedProvinces: ProvinceState[];
  totalGoldDelta: number;
  totalImperiumDelta: number;
  events: string[];
} {
  const events: string[] = [];
  let totalGoldDelta = 0;
  let totalImperiumDelta = 0;

  const updatedProvinces = provinces.map(province => {
    // Find governor martial skill
    const governor = province.playerGovernor;
    let governorMartial = 0;
    if (governor) {
      const char = state.family.find(c => c.id === governor.characterId);
      governorMartial = char?.skills.martial ?? 0;
    }

    // Calculate asset relationship and Imperium bonuses for this province
    let assetRelBonus = 0;
    let assetImperiumBonus = 0;
    for (const asset of province.ownedAssets) {
      const def = getProvinceAssetDefinition(asset.definitionId);
      if (!def) continue;
      const bonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
      assetRelBonus += bonus.relationshipPerTurn ?? 0;
      assetImperiumBonus += bonus.imperiumPerTurn ?? 0;
    }

    const { updatedProvince, goldDelta, imperiumDelta, events: pEvents } =
      tickProvince(province, governorMartial, assetRelBonus);

    totalGoldDelta += goldDelta;
    totalImperiumDelta += imperiumDelta + assetImperiumBonus;
    events.push(...pEvents);

    return updatedProvince;
  });

  return { updatedProvinces, totalGoldDelta, totalImperiumDelta, events };
}

/**
 * Apply an ambassador action and return province state delta.
 */
export type AmbassadorActionId =
  | 'build_rapport'
  | 'grain_dole'
  | 'intelligence_gathering'
  | 'corrupt_dealing'
  | 'seek_local_client'
  | 'cultural_exchange';

export interface AmbassadorActionResult {
  success: boolean;
  provincePatch: Partial<ProvinceState>;
  resourcePatch: {
    gratia?: number;
    denarii?: number;
    dignitas?: number;
    gravitas?: number;
    corruption?: number;
  };
  logMessage: string;
}

export function resolveAmbassadorAction(
  action: AmbassadorActionId,
  province: ProvinceState,
  _characterMartial: number
): AmbassadorActionResult {
  switch (action) {
    case 'build_rapport':
      return {
        success: true,
        provincePatch: {
          relationshipScore: Math.min(100, province.relationshipScore + 4),
          localSupport: Math.min(100, province.localSupport + 5),
          playerAmbassador: province.playerAmbassador
            ? { ...province.playerAmbassador, personalRapport: Math.min(50, province.playerAmbassador.personalRapport + 4) }
            : null,
        },
        resourcePatch: { gratia: -15 },
        logMessage: 'Ambassador builds personal rapport with local leaders.',
      };

    case 'grain_dole':
      return {
        success: true,
        provincePatch: {
          relationshipScore: Math.min(100, province.relationshipScore + 6),
          localSupport: Math.min(100, province.localSupport + 8),
        },
        resourcePatch: { denarii: -25 },
        logMessage: 'Grain distributed to the local poor. Warmth toward Rome increases.',
      };

    case 'intelligence_gathering':
      return {
        success: true,
        provincePatch: {
          playerAmbassador: province.playerAmbassador
            ? { ...province.playerAmbassador, intelRevealed: Math.min(6, province.playerAmbassador.intelRevealed + 1) }
            : null,
        },
        resourcePatch: { gratia: -10 },
        logMessage: 'Intelligence gathered on local power structure.',
      };

    case 'corrupt_dealing':
      return {
        success: true,
        provincePatch: {
          relationshipScore: Math.max(0, province.relationshipScore - 8),
        },
        resourcePatch: { denarii: 30, corruption: 5 },
        logMessage: 'Corrupt dealing enriches the family — at a cost to Rome\'s standing.',
      };

    case 'cultural_exchange':
      return {
        success: true,
        provincePatch: {
          localSupport: Math.min(100, province.localSupport + 6),
        },
        resourcePatch: { gratia: -15 },
        logMessage: 'Cultural exchange arranged. A region-specific event has been queued.',
      };

    default:
      return {
        success: false,
        provincePatch: {},
        resourcePatch: {},
        logMessage: 'Unknown action.',
      };
  }
}

/**
 * Calculate gold output from all player-owned assets in a province.
 */
export function calcAssetGoldOutput(province: ProvinceState): number {
  let total = 0;
  for (const asset of province.ownedAssets) {
    const def = getProvinceAssetDefinition(asset.definitionId);
    if (!def) continue;
    const bonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
    total += bonus.goldPerTurn ?? 0;
  }
  return total;
}

/**
 * Calculate Fides output from all player-owned assets in a province.
 * (Consolidates the former separate Dignitas/Gratia asset outputs — both
 * resources were removed and folded into Fides.)
 */
export function calcAssetFidesOutput(province: ProvinceState): number {
  let total = 0;
  for (const asset of province.ownedAssets) {
    const def = getProvinceAssetDefinition(asset.definitionId);
    if (!def) continue;
    const bonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
    total += bonus.fidesPerTurn ?? 0;
  }
  return total;
}
