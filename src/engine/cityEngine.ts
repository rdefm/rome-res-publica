import type { GameState } from '../state/gameStore';
import type {
  CityState,
  CityDefinition,
  GovernorPolicy,
  TaxationNotch,
  SecurityNotch,
  DevelopmentNotch,
  AmbassadorState,
} from '../models/city';
import {
  TAXATION_REL_PER_YEAR,
  TAXATION_CORRUPTION_PER_TURN,
  TAXATION_GOLD_MULT,
  TAXATION_TREASURY_PER_TURN,
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
} from '../models/city';
import type { Bill } from '../models/bill';
import type { WarState } from '../models/war';
import { getCityDefinition } from '../data/cityDefinitions';
import { getCityAssetDefinition } from '../data/cityAssets';
import { getEventsForContext } from '../data/cityEvents';
import { BALANCE } from '../data/balance';
import { resetAmbassadorCooldowns, calcRapportDecay } from './ambassadorEngine';

// ─── City Engine (renamed from provinceEngine.ts, Campaign Map plan C1) ──────

/**
 * Calculate gold output for a governed city this turn.
 */
export function calcCityGoldOutput(
  city: CityState,
  policy: GovernorPolicy,
  governorMartial: number = 0
): number {
  const def = getCityDefinition(city.id);
  if (!def || city.status === 'heartland' || city.status === 'foreign') return 0;

  const baseGold = def.baseGoldOutput;
  const taxMult = TAXATION_GOLD_MULT[policy.taxation];
  const infraMult = getInfrastructureMultiplier(city.infrastructureRating);
  const relMult = getRelationshipOutputMultiplier(city.relationshipScore);
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
export function calcCityImperiumOutput(
  city: CityState,
  policy: GovernorPolicy,
  governorMartial: number
): number {
  if (city.id === 'latium') return 0;
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
 * Calculate revolt probability per turn for an incorporated city.
 * Base chance modified by relationship, security, and local support.
 */
export function calcRevoltChance(
  city: CityState,
  policy: GovernorPolicy
): number {
  const tier = getRelationshipTier(city.relationshipScore);
  if (tier === 'integrated' || tier === 'loyal') return 0;

  let baseChance = 0;
  switch (tier) {
    case 'hostile':  baseChance = 0.30; break;
    case 'restless': baseChance = 0.10; break;
    case 'uneasy':   baseChance = 0.03; break;
    default:         baseChance = 0;
  }

  const securityModifier = SECURITY_REVOLT_DELTA[policy.security];
  const supportBonus = city.localSupport >= 50 ? -0.05 : 0;

  return Math.max(0, baseChance + securityModifier + supportBonus);
}

/**
 * Latium (heartland) and any 'foreign' city (Carthaginian/independent
 * territory, not yet Roman) are never governable. Takes the live
 * CityState rather than an id — moved here from
 * data/cityDefinitions.ts (Mediterranean plan, chunk MP-G fix) because
 * the original id-only version read the static CityDefinition.status,
 * which never changes, so a city that flipped to Rome mid-game (conquest
 * or treaty cession) would incorrectly stay ungovernable forever. Latium is
 * the only 'heartland'-status city today, so checking status directly
 * subsumes the old explicit id check.
 */
export function isGovernable(city: CityState): boolean {
  return city.status !== 'heartland' && city.status !== 'foreign';
}

/**
 * Per-season Ambassador ticking — rapport decay, cooldown reset, and the
 * 2-year (8-season) term limit, mirroring GovernorState's 1-year (4-season)
 * warn-at-3/end-at-4 pattern doubled. Previously entirely unwired: nothing
 * anywhere incremented AmbassadorState.turnsServed, called
 * ambassadorEngine.resetAmbassadorCooldowns, or called calcRapportDecay —
 * DiplomatDesk.tsx's "Season X of 4" display always read "Season 1" as a
 * result. Foreign-relations plan, chunk WD-D.
 *
 * Shared between tickCity's foreign short-circuit and its main Roman-
 * unincorporated branch below, since WD-D reverses the "no Ambassador
 * system for foreign cities" invariant specifically for Ambassadors, and
 * both cases need identical handling. cityName is passed rather than
 * re-resolved since the foreign branch's caller doesn't always have `def`
 * on hand at that point.
 *
 * Does NOT handle expulsion (ambassadorEngine.checkExpulsion/
 * resolveExpulsion) — that needs a fides/lifetimeDignitas delta channel
 * tickCity's return shape doesn't have (unlike treasuryDelta, which
 * fits because it's an unconditional flat number, not a conditional one-off
 * event). Left as a follow-up.
 */
function tickPlayerAmbassador(
  ambassador: AmbassadorState,
  cityName: string,
): { ambassador: AmbassadorState | null; events: string[] } {
  const events: string[] = [];
  let updated = resetAmbassadorCooldowns(ambassador);
  updated = {
    ...updated,
    personalRapport: Math.max(0, updated.personalRapport - calcRapportDecay(updated)),
    turnsServed: updated.turnsServed + 1,
  };

  if (updated.turnsServed >= 7) {
    events.push(`✦ ${cityName}: your ambassador's term ends this season. A new posting bill may be tabled after.`);
  }
  if (updated.turnsServed >= 8) {
    events.push(`Ambassador term concluded in ${cityName}.`);
    return { ambassador: null, events };
  }
  return { ambassador: updated, events };
}

/**
 * Tick one city forward one season.
 * Returns updated city state + resource deltas to apply to the game state.
 *
 * Chunk 2B addition: stagnation tracking.
 * prevInfra is captured before any changes. After all infra updates,
 * infraStagnationSeasons is incremented if infra did not improve, reset if it did.
 * lastInfraScore is updated to the current season's final value.
 * The stagnation counter is READ by crisisEngine.calcIndividualEscalation (Economy track).
 */
export function tickCity(
  city: CityState,
  governorMartial: number,
  assetRelBonus: number // bonus from owned assets (e.g. temple patronage)
): {
  updatedCity: CityState;
  goldDelta: number;
  imperiumDelta: number;
  corruptionDelta: number;
  treasuryDelta: number;
  events: string[];
} {
  const events: string[] = [];
  let p = { ...city };

  // Heartland (Latium) — no ticking needed
  if (p.id === 'latium') {
    return { updatedCity: p, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, treasuryDelta: 0, events };
  }

  // Foreign territory (Carthaginian/independent, not yet Roman) — no Governor
  // system or income applies (see applyCityFlips for the conquest path), but relations
  // still drift: a small mean-zero random walk each season, first-pass/tunable, so a foreign
  // power's relationshipScore isn't frozen at its starting value forever. See
  // checkForeignWarDeclarations for what reading a 'hostile' drift outcome can lead to.
  // A playerAmbassador still ticks here too (foreign-relations plan, WD-D reverses the
  // "no Ambassador for foreign cities" invariant specifically for Ambassadors) — see
  // tickPlayerAmbassador. Nothing else (income, revolt, incorporation) ever applies.
  if (p.status === 'foreign') {
    const drift = Math.round((Math.random() - 0.5) * 4); // −2..+2
    p = { ...p, relationshipScore: Math.max(0, Math.min(100, p.relationshipScore + drift)) };

    if (p.playerAmbassador) {
      const foreignDef = getCityDefinition(p.id);
      const { ambassador, events: ambEvents } = tickPlayerAmbassador(p.playerAmbassador, foreignDef?.name ?? p.id);
      p = { ...p, playerAmbassador: ambassador };
      events.push(...ambEvents);
    }

    return { updatedCity: p, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, treasuryDelta: 0, events };
  }

  const def = getCityDefinition(p.id);
  if (!def) {
    return { updatedCity: p, goldDelta: 0, imperiumDelta: 0, corruptionDelta: 0, treasuryDelta: 0, events };
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
    goldDelta += calcCityGoldOutput(p, policy, governorMartial);

    // Imperium
    imperiumDelta += calcCityImperiumOutput(p, policy, governorMartial);

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
      events.push(`Governor term concluded in ${def.name}. The city reverts to senatorial control.`);
    }
  }

  // ── Player ambassador ticking (foreign-relations plan, WD-D) ─────────────
  else if (p.playerAmbassador) {
    const { ambassador, events: ambEvents } = tickPlayerAmbassador(p.playerAmbassador, def.name);
    p = { ...p, playerAmbassador: ambassador };
    events.push(...ambEvents);
  }

  // ── NPC governor ticking ─────────────────────────────────────────────────
  else if (p.npcRoleHolder && p.status !== 'heartland') {
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

  // ── Revolt check (incorporated cities only) ───────────────────────────
  if (p.status === 'incorporated' && !p.revoltActive) {
    const policy = p.playerGovernor?.policy ?? p.npcRoleHolder?.policy ?? {
      taxation: 'standard' as TaxationNotch,
      security: 'light_patrol' as SecurityNotch,
      development: 'neglect' as DevelopmentNotch,
    };
    const revoltChance = calcRevoltChance(p, policy);
    if (revoltChance > 0 && Math.random() < revoltChance) {
      p = { ...p, revoltActive: true };
      events.push(`⚔ REVOLT in ${def.name}! The city has risen against Roman authority.`);
    }
  }

  // ── Relationship threshold checks ────────────────────────────────────────
  const tier = getRelationshipTier(p.relationshipScore);

  // Unincorporated: incorporation available at 86+
  if (p.status === 'unincorporated' && p.relationshipScore >= 86 && !p.incorporationBillAvailable) {
    p = { ...p, incorporationBillAvailable: true };
    events.push(`${def.name} is now ready for incorporation into Rome. A civitas bill can be tabled in the Curia.`);
  }

  // Unincorporated: war declaration available at 0–15
  if (p.status === 'unincorporated' && tier === 'hostile' && !p.warDeclarationAvailable) {
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

  // ── Public treasury contribution (incorporated cities only) ───────────
  // Senate treasury (rome.treasury) income, separate from the player's personal
  // Gold (calcCityGoldOutput). Live-recomputed off whichever tax policy
  // currently governs, same policy-fallback order used by the revolt check above.
  let treasuryDelta = 0;
  if (p.status === 'incorporated') {
    const policy = p.playerGovernor?.policy ?? p.npcRoleHolder?.policy ?? {
      taxation: 'standard' as TaxationNotch,
      security: 'light_patrol' as SecurityNotch,
      development: 'neglect' as DevelopmentNotch,
    };
    treasuryDelta = TAXATION_TREASURY_PER_TURN[policy.taxation];
  }

  return { updatedCity: p, goldDelta, imperiumDelta, corruptionDelta, treasuryDelta, events };
}

/**
 * Conquest/defection flips — a 'foreign' city joins Rome when the flag named by
 * its CityDefinition.conquestFlag becomes truthy (set by an event's successEffect,
 * e.g. 'setFlag:messanaJoinsRome:true'). Flips owner to 'rome' and status to
 * 'unincorporated' — a freshly-won territory Rome has not yet incorporated, so it falls
 * straight into the existing unincorporated/Ambassador pathway from the next tick on.
 * Idempotent: re-checks city.owner so a city already flipped is left alone.
 */
export function applyCityFlips(
  cities: CityState[],
  flags: GameState['flags']
): { cities: CityState[]; events: string[] } {
  const events: string[] = [];
  const updated = cities.map(city => {
    if (city.owner === 'rome') return city;
    const def = getCityDefinition(city.id);
    if (!def?.conquestFlag || !flags[def.conquestFlag]) return city;
    events.push(`${def.name} has joined Rome. It is now unincorporated territory, open to an Ambassador posting.`);
    return { ...city, owner: 'rome' as const, status: 'unincorporated' as const };
  });
  return { cities: updated, events };
}

/**
 * Resolves which "power" a foreign city's owner represents for war
 * purposes. Carthage-owned cities (Lilybaeum, Alalia, Olbia, Sulci,
 * Tripolitania, Carthage itself) all collapse to the single 'carthage'
 * enemyId — they're territory, not separate powers. An independent city
 * (Messana, Syracuse, Agrigentum) is its own power, keyed by its own id.
 * Foreign-relations plan, chunk WD-B/WD-C.
 */
export function getForeignWarTargetEnemyId(def: CityDefinition): string {
  return def.owner === 'carthage' ? 'carthage' : def.id;
}

/**
 * Per-season chance a hostile foreign power declares war on Rome unprompted
 * — mirrors calcRevoltChance's existing probabilistic-risk precedent (a
 * first-pass/unverified chance, not a telegraphed certainty). Excludes
 * clients (def.clientOf set, i.e. Numidia) — fighting a client means
 * fighting its patron, which this doesn't model (see the Mediterranean
 * plan's design invariant #5). De-dupes multiple cities sharing the same
 * owner (Carthage's outposts) down to a single roll per power per season,
 * and skips any power already at active war with Rome — either from a
 * pre-existing WarState or one rolled earlier this same call.
 */
export function checkForeignWarDeclarations(
  cities: CityState[],
  state: GameState,
): { newWars: WarState[]; events: string[] } {
  const events: string[] = [];
  const newWars: WarState[] = [];
  const rolledEnemyIds = new Set<string>();

  for (const city of cities) {
    if (city.status !== 'foreign') continue;
    const def = getCityDefinition(city.id);
    if (!def || def.clientOf) continue;

    const enemyId = getForeignWarTargetEnemyId(def);
    if (rolledEnemyIds.has(enemyId)) continue;

    const alreadyAtWar = state.wars.some(w => w.active && w.enemyId === enemyId)
      || newWars.some(w => w.enemyId === enemyId);
    if (alreadyAtWar) continue;

    if (getRelationshipTier(city.relationshipScore) !== 'hostile') continue;

    rolledEnemyIds.add(enemyId);
    const AI_DECLARE_WAR_CHANCE = 0.08; // first-pass/tunable, per power per season
    if (Math.random() < AI_DECLARE_WAR_CHANCE) {
      newWars.push({
        id: `war-${enemyId}-${state.turnNumber}`,
        active: true,
        enemyId,
        scale: 'major',
        provinceId: null,
        // Campaign Map plan, Chunk C9 — this AI-declared foreign war is
        // OUTSIDE the Punic War theatre (a different enemyId entirely, no
        // armies/Sicily/theatre map to derive a standing from — design
        // invariant 9's scope boundary). warStanding.ts only ever recomputes
        // the ACTIVE MAJOR CARTHAGE war's warScore; this one keeps whatever
        // it starts at — a documented, accepted side effect of retiring the
        // shared skirmish-drift/weariness-erosion mechanics that used to
        // move EVERY war's score (including this one) each season.
        warScore: -5, // the power struck first — first-pass/tunable
        startedTurn: state.turnNumber,
        weariness: 0,
        enemyWeariness: 0,
        momentum: 0,
        treaty: null,
        phase: 'opening',
        ignitedYear: state.year,
        endedYear: null,
        terminalOutcome: null,
        peaceOffered: false,
        lastFundingOfferTurn: state.turnNumber - BALANCE.war.funding.recurTurns,
      });
      events.push(`⚔ ${def.name} has declared war on Rome — relations had grown too hostile to hold.`);
    }
  }

  return { newWars, events };
}

/**
 * Tick all cities. Returns updated array + aggregate resource deltas.
 */
export function tickAllCities(
  cities: CityState[],
  state: GameState
): {
  updatedCities: CityState[];
  totalGoldDelta: number;
  totalImperiumDelta: number;
  totalTreasuryDelta: number;
  newWars: WarState[];
  events: string[];
  newCityEvent: { cityId: string; defId: string } | null;
} {
  const { cities: flippedCities, events: flipEvents } = applyCityFlips(cities, state.flags);

  const events: string[] = [...flipEvents];
  let totalGoldDelta = 0;
  let totalImperiumDelta = 0;
  let totalTreasuryDelta = 0;

  const updatedCities = flippedCities.map(city => {
    // Find governor martial skill
    const governor = city.playerGovernor;
    let governorMartial = 0;
    if (governor) {
      const char = state.family.find(c => c.id === governor.characterId);
      governorMartial = char?.skills.martial ?? 0;
    }

    // Calculate asset relationship and Imperium bonuses for this city
    let assetRelBonus = 0;
    let assetImperiumBonus = 0;
    for (const asset of city.ownedAssets) {
      const def = getCityAssetDefinition(asset.definitionId);
      if (!def) continue;
      const bonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
      assetRelBonus += bonus.relationshipPerTurn ?? 0;
      assetImperiumBonus += bonus.imperiumPerTurn ?? 0;
    }

    const { updatedCity, goldDelta, imperiumDelta, treasuryDelta, events: pEvents } =
      tickCity(city, governorMartial, assetRelBonus);

    totalGoldDelta += goldDelta;
    totalImperiumDelta += imperiumDelta + assetImperiumBonus;
    totalTreasuryDelta += treasuryDelta;
    events.push(...pEvents);

    return updatedCity;
  });

  // Checked after this season's drift has already been applied to
  // updatedCities, so a power that just crossed into 'hostile' this
  // season is eligible immediately rather than one tick behind.
  const { newWars, events: warDeclarationEvents } = checkForeignWarDeclarations(updatedCities, state);
  events.push(...warDeclarationEvents);

  // July 2026 fixes, Chunk D — passive governor/ambassador city event roll.
  // Checked against updatedCities (this season's drift already applied) and
  // (state.activeCityEvent ?? null) so it never overwrites an unresolved one.
  const newCityEvent = rollCityEventTick(updatedCities, !!state.activeCityEvent);
  if (newCityEvent) {
    const def = getCityDefinition(newCityEvent.cityId);
    events.push(`⚑ A situation has arisen in ${def?.name ?? newCityEvent.cityId} requiring your attention.`);
  }

  return { updatedCities, totalGoldDelta, totalImperiumDelta, totalTreasuryDelta, newWars, events, newCityEvent };
}

/**
 * Apply an ambassador action and return city state delta.
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
  cityPatch: Partial<CityState>;
  resourcePatch: {
    fides?: number;
    denarii?: number;
    corruption?: number;
  };
  logMessage: string;
}

export function resolveAmbassadorAction(
  action: AmbassadorActionId,
  city: CityState,
  _characterMartial: number
): AmbassadorActionResult {
  switch (action) {
    case 'build_rapport':
      return {
        success: true,
        cityPatch: {
          relationshipScore: Math.min(100, city.relationshipScore + 4),
          localSupport: Math.min(100, city.localSupport + 5),
          playerAmbassador: city.playerAmbassador
            ? { ...city.playerAmbassador, personalRapport: Math.min(50, city.playerAmbassador.personalRapport + 4) }
            : null,
        },
        resourcePatch: { fides: -15 },
        logMessage: 'Ambassador builds personal rapport with local leaders.',
      };

    case 'grain_dole':
      return {
        success: true,
        cityPatch: {
          relationshipScore: Math.min(100, city.relationshipScore + 6),
          localSupport: Math.min(100, city.localSupport + 8),
        },
        resourcePatch: { denarii: -25 },
        logMessage: 'Grain distributed to the local poor. Warmth toward Rome increases.',
      };

    case 'intelligence_gathering':
      return {
        success: true,
        cityPatch: {
          playerAmbassador: city.playerAmbassador
            ? { ...city.playerAmbassador, intelRevealed: Math.min(6, city.playerAmbassador.intelRevealed + 1) }
            : null,
        },
        resourcePatch: { fides: -10 },
        logMessage: 'Intelligence gathered on local power structure.',
      };

    case 'corrupt_dealing':
      return {
        success: true,
        cityPatch: {
          relationshipScore: Math.max(0, city.relationshipScore - 8),
        },
        resourcePatch: { denarii: 30, corruption: 5 },
        logMessage: 'Corrupt dealing enriches the family — at a cost to Rome\'s standing.',
      };

    case 'cultural_exchange':
      return {
        success: true,
        cityPatch: {
          localSupport: Math.min(100, city.localSupport + 6),
        },
        resourcePatch: { fides: -15 },
        logMessage: 'Cultural exchange arranged. A region-specific event has been queued.',
      };

    default:
      return {
        success: false,
        cityPatch: {},
        resourcePatch: {},
        logMessage: 'Unknown action.',
      };
  }
}

// ─── City events — governor/ambassador random situations (July 2026 fixes, Chunk D) ─
// data/cityEvents.ts's CITY_EVENTS pool (6 governor + 2 ambassador cards) was
// fully authored but never fired — no season tick rolled for it, and
// cultural_exchange's "a region-specific event has been queued" was a dead
// stub. These two pure functions are the whole mechanism: a per-season roll
// (rollCityEventTick, called from tickAllCities below) for the passive fire,
// and an effect-string resolver (resolveCityEventEffect) shared by both the
// passive tick and cultural_exchange's guaranteed fire.

export interface CityEventEffectResult {
  cityPatch: Partial<CityState>;
  /** Applied by the caller to the acting (governor/ambassador) character's
   *  own corruptionScore — CityState has no corruption field of its own. */
  corruptionDelta: number;
  resourcePatch: {
    denarii?: number;
    fides?: number;
    imperium?: number;
    lifetimeDignitas?: number;
  };
}

const CITY_EVENT_TOKEN = /^(rel|corruption|gold|infra|localSupport|lifetimeDignitas|fides|imperium):([+-]\d+)$/;

/**
 * Resolves a CityEventOption's comma-separated 'key:±N' effect string
 * (cityEvents.ts's own grammar — distinct from resourceEngine's pipe-
 * delimited applyEffectString tokens) against a specific city.
 */
export function resolveCityEventEffect(
  effectStr: string,
  city: CityState
): CityEventEffectResult {
  const cityPatch: Partial<CityState> = {};
  const resourcePatch: CityEventEffectResult['resourcePatch'] = {};
  let corruptionDelta = 0;

  const segments = effectStr.split(',').map(s => s.trim()).filter(Boolean);
  for (const segment of segments) {
    const match = segment.match(CITY_EVENT_TOKEN);
    if (!match) continue;
    const key = match[1];
    const delta = parseInt(match[2], 10);

    switch (key) {
      case 'rel':
        cityPatch.relationshipScore = Math.max(0, Math.min(100, (cityPatch.relationshipScore ?? city.relationshipScore) + delta));
        break;
      case 'localSupport':
        cityPatch.localSupport = Math.max(0, Math.min(100, (cityPatch.localSupport ?? city.localSupport) + delta));
        break;
      case 'infra':
        cityPatch.infrastructureRating = Math.max(0, Math.min(100, (cityPatch.infrastructureRating ?? city.infrastructureRating) + delta));
        break;
      case 'corruption':
        corruptionDelta += delta;
        break;
      case 'gold':
        resourcePatch.denarii = (resourcePatch.denarii ?? 0) + delta;
        break;
      case 'fides':
        resourcePatch.fides = (resourcePatch.fides ?? 0) + delta;
        break;
      case 'imperium':
        resourcePatch.imperium = (resourcePatch.imperium ?? 0) + delta;
        break;
      case 'lifetimeDignitas':
        resourcePatch.lifetimeDignitas = (resourcePatch.lifetimeDignitas ?? 0) + delta;
        break;
    }
  }

  return { cityPatch, corruptionDelta, resourcePatch };
}

/**
 * Per-season roll for a passive governor/ambassador city event. Returns the
 * first role-holding city (in array order) that rolls a hit, or null if none
 * do — deliberately simple rather than a global weighted pick across every
 * held city at once, since only one city event can be active at a time
 * (mirrors this codebase's single-active-event conventions elsewhere) and
 * holding several governorships/ambassadorships simultaneously is rare.
 * No-ops entirely if one is already active (hasActiveCityEvent), so the
 * check doesn't burn a season's roll on a city event the player hasn't
 * resolved yet.
 */
export function rollCityEventTick(
  cities: CityState[],
  hasActiveCityEvent: boolean
): { cityId: string; defId: string } | null {
  if (hasActiveCityEvent) return null;

  for (const city of cities) {
    if (city.playerGovernor && Math.random() < BALANCE.cityEvents.tickChance) {
      const pool = getEventsForContext('governor', city.id);
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        return { cityId: city.id, defId: pick.id };
      }
    }
    if (city.playerAmbassador && Math.random() < BALANCE.cityEvents.tickChance) {
      const pool = getEventsForContext('ambassador', city.id);
      if (pool.length > 0) {
        const pick = pool[Math.floor(Math.random() * pool.length)];
        return { cityId: city.id, defId: pick.id };
      }
    }
  }

  return null;
}

/**
 * Calculate gold output from all player-owned assets in a city.
 */
export function calcAssetGoldOutput(city: CityState): number {
  let total = 0;
  for (const asset of city.ownedAssets) {
    const def = getCityAssetDefinition(asset.definitionId);
    if (!def) continue;
    const bonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
    total += bonus.goldPerTurn ?? 0;
  }
  return total;
}

/**
 * Calculate Fides output from all player-owned assets in a city.
 * (Consolidates the former separate Dignitas/Gratia asset outputs — both
 * resources were removed and folded into Fides.)
 */
export function calcAssetFidesOutput(city: CityState): number {
  let total = 0;
  for (const asset of city.ownedAssets) {
    const def = getCityAssetDefinition(asset.definitionId);
    if (!def) continue;
    const bonus = asset.tier === 2 ? def.tier2Bonus : def.tier1Bonus;
    total += bonus.fidesPerTurn ?? 0;
  }
  return total;
}

/**
 * Deterministic bill name for a city's incorporation bill — the single
 * source of truth both buildIncorporationBill (below) and any UI checking
 * for an already-pending bill (gameStore.proposeIncorporationBill's dedup
 * check; CitySheet.tsx's button state) key off of, so the two can never
 * drift out of sync with each other.
 */
export function getIncorporationBillName(def: CityDefinition): string {
  return `Incorporate ${def.name}`;
}

/**
 * Builds a one-off, player-submitted bill that formally incorporates an
 * unincorporated city — passed to gameStore.submitBill (which assigns
 * the id and deducts the standard Fides cost). Passing it fires
 * resourceEngine.applyEffectString's 'incorporateCity' token, which
 * flips status to 'incorporated', clears incorporationBillAvailable, and
 * recalls any player Ambassador posted there (the Ambassador system stops
 * applying once incorporated — a Governor is later assigned by lot through
 * the existing, unrelated governor-assignment system).
 *
 * The numeric rewards (lifetimeDignitas/imperium) are a first-pass/unverified
 * balance call, in the same ballpark as the Mediterranean treaty cession
 * terms (data/treatyTerms.ts) for a comparably-sized city — revisit in a
 * future tuning pass. The ongoing per-season contribution to rome.treasury
 * this unlocks is a separate, general mechanic (see tickCity's treasury
 * contribution block above) — it applies to every incorporated city, not
 * just ones incorporated through this bill, so it is not part of passEffect.
 */
export function buildIncorporationBill(city: CityState, def: CityDefinition): Omit<Bill, 'id'> {
  return {
    name: getIncorporationBillName(def),
    desc: `A motion to formally absorb ${def.name} into the Republic as a full province — ending its ambassadorial status and placing it under the Governor system permanently.`,
    type: 'constitutional',
    support: 15,
    turnsLeft: 4,
    passEffect: `lifetimeDignitas+10|imperium+5|incorporateCity:${city.id}`,
    failEffect: 'fides-5',
    playerSubmitted: true,
    repealable: false,
  };
}

/**
 * Deterministic bill name for a foreign power's declare-war bill — matches
 * getIncorporationBillName's role as the single dedup/UI-state source of
 * truth. Named by city (not by resolved enemyId) since that's what the
 * player is looking at on the sheet; getForeignWarTargetEnemyId still
 * collapses Carthage's outposts to one actual war if more than one such
 * bill somehow gets tabled before the first resolves.
 */
export function getDeclareWarBillName(def: CityDefinition): string {
  return `Declare War on ${def.name}`;
}

/**
 * Builds a one-off, player-submitted bill declaring war on a hostile foreign
 * power, gated by the caller on relationship tier (see
 * getForeignWarTargetEnemyId / checkForeignWarDeclarations' sibling logic in
 * this file) — mirrors buildIncorporationBill's shape exactly. Reuses the
 * existing startWar token verbatim; no new colon-token needed for this.
 * Numbers are first-pass/unverified, same convention as every other bill in
 * this codebase.
 */
export function buildDeclareWarBill(city: CityState, def: CityDefinition): Omit<Bill, 'id'> {
  const enemyId = getForeignWarTargetEnemyId(def);
  return {
    name: getDeclareWarBillName(def),
    desc: `A motion to formally declare war on ${def.name} — relations have soured past the point of restraint.`,
    type: 'military',
    support: -5,
    turnsLeft: 3,
    passEffect: `startWar:${enemyId}:major:5`,
    failEffect: 'fides-5',
    playerSubmitted: true,
    repealable: false,
  };
}

/**
 * Deterministic bill name for an ambassador-posting request — keyed by
 * character too (not just city), since the same city could
 * plausibly have different family members petitioned for it across a
 * playthrough (though not at the same time — dedup still applies per name).
 */
export function getAmbassadorPostingBillName(def: CityDefinition, characterName: string): string {
  return `Ambassador Posting: ${characterName} to ${def.name}`;
}

/**
 * Builds a one-off, player-submitted bill posting a character as Ambassador
 * — works on both status: 'unincorporated' Roman cities (fixes the
 * previously-completely-unwired "Seek Ambassador Posting" button) and
 * status: 'foreign' ones (foreign-relations plan, WD-D — a deliberate
 * reversal of the Mediterranean plan's "no Ambassador system for foreign
 * provinces" invariant, for Ambassadors only). Passing it fires
 * resourceEngine.applyEffectString's 'assignAmbassador' token. The 2-year
 * (8-season) term this creates is enforced by tickPlayerAmbassador, called
 * from both of tickCity's relevant branches. Numbers first-pass/
 * unverified, same convention as every other bill in this codebase.
 */
export function buildAmbassadorPostingBill(
  city: CityState,
  def: CityDefinition,
  characterId: string,
  characterName: string,
): Omit<Bill, 'id'> {
  return {
    name: getAmbassadorPostingBillName(def, characterName),
    desc: `A petition to post ${characterName} as Rome's ambassador to ${def.name} for a two-year term.`,
    type: 'constitutional',
    support: 10,
    turnsLeft: 3,
    passEffect: `assignAmbassador:${city.id}:${characterId}`,
    failEffect: 'fides-3',
    playerSubmitted: true,
    repealable: false,
  };
}
