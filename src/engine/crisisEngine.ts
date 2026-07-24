// ─── Crisis Engine ────────────────────────────────────────────────────────────
// Four-track crisis model: War, Unrest, Constitution, Economy.
// All functions are pure — they receive state slices and return values/objects.
// No direct state mutation. Chunk 2B implementation.

import type { GameState } from '../state/gameStore';
import type {
  CrisisTrack,
  CrisisState,
  CrisisTrackId,
  CrisisStatusEffect,
  CrisisTier,
} from '../models/crisis';
import { getTierFromLevel } from '../models/crisis';
import { getCityDefinition } from '../data/cityDefinitions';
import { BALANCE } from '../data/balance';

// ─── Apply delta to a single track ───────────────────────────────────────────

/**
 * Applies a signed delta to a CrisisTrack, clamps the result to 0–100,
 * recomputes tier, and returns a new CrisisTrack without mutating the input.
 */
export function applyTrackDelta(track: CrisisTrack, delta: number): CrisisTrack {
  const newLevel = Math.min(100, Math.max(0, track.level + delta));
  return {
    ...track,
    level: newLevel,
    tier: getTierFromLevel(newLevel),
    // namedCrisis is recomputed separately via getNamedCrisis — do not touch here
  };
}

// ─── Individual escalation ────────────────────────────────────────────────────

/**
 * Returns the raw signed delta for a single track this season.
 * Does NOT clamp — caller applies via applyTrackDelta.
 * Does NOT include cascade deltas — those come from calcCascadeDeltas.
 *
 * Sources that are event-/action-based (campaign outcomes, bill pass effects,
 * office action consequences) are NOT computed here — they are applied via
 * effect strings at the point the event/action resolves. This function handles
 * only per-season passive escalation that reads current state.
 */
export function calcIndividualEscalation(trackId: CrisisTrackId, state: GameState): number {
  const raw = (() => {
    switch (trackId) {
      case 'war':          return calcWarEscalation(state);
      case 'unrest':       return calcUnrestEscalation(state);
      case 'constitution': return calcConstitutionEscalation(state);
      case 'economy':      return calcEconomyEscalation(state);
    }
  })();

  // Phase 5, Chunk P5-G — the crisis seam (design invariant 4). Deliberately
  // narrow: only this per-track passive delta is scaled. calcCascadeDeltas'
  // flat +2 compounding bumps and checkMilitaryBillPressure's bill-
  // consequence penalty stay at authored magnitude — Ferox still drifts
  // hotter overall because a faster individual-escalation climb crosses
  // cascade thresholds sooner, not because cascade itself is scaled.
  // `?? 'aequus'` covers any fixture/legacy state without a difficulty
  // field — Aequus's crisisMult is 1.0, so this is a no-op for every state
  // that predates this chunk.
  const crisisMult = BALANCE.difficulty[state.difficulty ?? 'aequus'].crisisMult;
  return Math.round(raw * crisisMult);
}

function calcWarEscalation(state: GameState): number {
  let delta = 0;

  for (const city of state.cities) {
    if (city.status === 'heartland') continue;
    const def = getCityDefinition(city.id);
    const weight = def?.threatWeight ?? 1.0;

    // Hostile/restless cities increase War pressure (design doc section 2.4)
    if (city.relationshipScore < 15) {
      delta += 6 * weight;
    } else if (city.relationshipScore < 30) {
      delta += 3 * weight;
    }

    // Stable cities passively reduce War pressure
    // Design doc: "Province relationship above 70 for 4+ consecutive seasons: −2/season"
    // Simplified: apply if currently above 70 (sustained counter is a future improvement)
    if (city.relationshipScore > 70) {
      delta -= 2;
    }
  }

  // Ignored mandatory funding flag — set by turnSequencer when war-mandatory-funding
  // auto-bill is ignored for 2+ seasons (Chunk 2C wires this)
  if (state.flags['mandatory-funding-ignored-seasons'] &&
      (state.flags['mandatory-funding-ignored-seasons'] as number) >= 2) {
    delta += 5;
  }

  // Military Overhaul M9 — one term from warScore trajectory, kept
  // deliberately separate from warEngine.ts (per the plan's "do not merge
  // the systems" instruction): losing a war badly adds War-track pressure;
  // winning big eases it. Reads state.wars as it stood BEFORE this season's
  // processWarSeason step runs (step 5 here, war-score updates land later
  // in the 9-series) — same "one season behind" relationship every other
  // crisis input already has with its producing system (e.g. city
  // relationshipScore vs. step 9c's city tick).
  for (const war of (state.wars ?? [])) {
    if (!war.active) continue;
    if (war.warScore < -20) delta += 2;
    else if (war.warScore >= 20) delta -= 1;
  }

  return Math.round(delta);
}

function calcUnrestEscalation(state: GameState): number {
  let delta = 0;
  const { plebs } = state.rome;

  // Plebs mood pressure (design doc section 2.4)
  // "Plebs mood sustained below 30 for 2+ seasons: +4/season"
  // "Plebs mood sustained below 20 for any season: +6/season"
  // Simplified: apply on current-season value (sustained counter is a future improvement)
  if (plebs < 20) {
    delta += 6;
  } else if (plebs < 30) {
    delta += 4;
  }

  // Plebs recovery
  if (plebs > 80) {
    delta -= 5;
  } else if (plebs > 60) {
    delta -= 3;
  }

  // Heavy/extortionate taxation per incorporated city (design doc section 2.4)
  for (const city of state.cities) {
    if (city.status !== 'incorporated') continue;
    const policy = city.playerGovernor?.policy ?? city.npcRoleHolder?.policy;
    if (!policy) continue;
    if (policy.taxation === 'heavy' || policy.taxation === 'extortionate') {
      delta += 2;
    }
  }

  // Public Support clients passively reduce Unrest (design doc section 2.4)
  const publicSupportClients = state.clients.filter(c => c.type === 'publicSupport');
  delta -= publicSupportClients.length;

  // No Aedile games counter — maintained by turnSequencer (Chunk 2C)
  // "No Aedile games for 4 consecutive seasons: +3/season"
  const seasonsSinceGames = state.flags['seasonsSinceAedileGames'];
  if (typeof seasonsSinceGames === 'number' && seasonsSinceGames >= 4) {
    delta += 3;
  }

  return Math.round(delta);
}

function calcConstitutionEscalation(state: GameState): number {
  let delta = 0;

  // Faction polarisation (design doc section 2.4)
  const factionGap = Math.abs(state.optimatesRel - state.popularesRel);
  if (factionGap > 60) {
    delta += 2;
  }

  // 3+ seasons without any bill passing — counter maintained by turnSequencer (Chunk 2C)
  const seasonsSinceBill = state.flags['seasonsSinceLastBillPassed'];
  if (typeof seasonsSinceBill === 'number' && seasonsSinceBill >= 3) {
    delta += 5;
  }

  // NPC consul sustained antagonism
  // Design doc: "NPC consul at antagonism level 3 for 3+ seasons: +2/season"
  // Simplified: apply if currently level 3 (sustained counter is future improvement)
  if (state.npcConsul?.antagonismLevel === 3) {
    delta += 2;
  }

  // Dictator overstay (design doc section 1.7 — Refuse to Resign action)
  if (state.flags['dictator-overstaying']) {
    delta += 8;
  }

  return Math.round(delta);
}

function calcEconomyEscalation(state: GameState): number {
  let delta = 0;
  const { treasury } = state.rome;

  // Treasury pressure (design doc section 2.4)
  if (treasury < 10) {
    delta += 5;
  } else if (treasury > 65) {
    delta -= 2;
  }

  // Infrastructure stagnation per city (design doc section 2.4)
  // Cities that have not improved infra in 12+ seasons drain the Economy track
  for (const city of state.cities) {
    if (city.status === 'heartland') continue;
    if ((city.infraStagnationSeasons ?? 0) >= 12) {
      delta += 3;
    }
  }

  return Math.round(delta);
}

// ─── Cascade deltas ───────────────────────────────────────────────────────────

/**
 * Returns the cascade deltas for all tracks based on current levels.
 * Input: already-updated individual levels (after calcIndividualEscalation applied).
 * Output: cascade-only deltas — do not include individual escalation here.
 *
 * Cascade table (design doc section 2.5):
 *   Constitution ≥ 60   → War +2   (Senate paralyzed, cannot respond to threats)
 *   War ≥ 60            → War +2   (additional when ALSO Constitution ≥ 60)
 *   Economy ≥ 60        → Unrest +2 (poverty breeds anger)
 *   Unrest ≥ 60         → Constitution +2 (politicians exploit unrest)
 */
export function calcCascadeDeltas(crisisState: CrisisState): Record<CrisisTrackId, number> {
  const deltas: Record<CrisisTrackId, number> = {
    war: 0, unrest: 0, constitution: 0, economy: 0,
  };

  const { war, unrest, constitution, economy } = crisisState;

  // Constitution paralysis → War escalates
  if (constitution.level >= 60) {
    deltas.war += 2;
  }

  // Compounding: War + Constitution both critical → War spirals faster
  if (war.level >= 60 && constitution.level >= 60) {
    deltas.war += 2;
  }

  // Poverty → Unrest escalates
  if (economy.level >= 60) {
    deltas.unrest += 2;
  }

  // Unrest → Politicians exploit crisis → Constitution frays
  if (unrest.level >= 60) {
    deltas.constitution += 2;
  }

  return deltas;
}

// ─── Named crisis string ──────────────────────────────────────────────────────

/**
 * Returns a human-readable name for the active crisis at a given level,
 * or null at tier 0 (no active crisis). For the War track, derives the name
 * from the most hostile city if it has a namedWar field set.
 */
export function getNamedCrisis(
  trackId: CrisisTrackId,
  level: number,
  state: GameState
): string | null {
  const tier = getTierFromLevel(level);
  if (tier === 0) return null;

  switch (trackId) {
    case 'war': {
      // Derive from most hostile non-heartland city
      const hostile = [...state.cities]
        .filter(p => p.status !== 'heartland')
        .sort((a, b) => a.relationshipScore - b.relationshipScore)[0];
      if (hostile) {
        const def = getCityDefinition(hostile.id);
        if (def?.namedWar) return def.namedWar;
        if (def?.name && hostile.relationshipScore < 30) {
          return `${def.name} Troubles`;
        }
      }
      const warLabels: Record<CrisisTier, string | null> = {
        0: null, 1: 'Border Tensions', 2: 'Active Conflict',
        3: 'War Crisis', 4: 'Existential Threat',
      };
      return warLabels[tier];
    }
    case 'unrest': {
      const labels: Record<CrisisTier, string | null> = {
        0: null, 1: 'Murmurs', 2: 'Growing Anger',
        3: 'Street Violence', 4: 'Open Revolt',
      };
      return labels[tier];
    }
    case 'constitution': {
      const labels: Record<CrisisTier, string | null> = {
        0: null, 1: 'Political Tension', 2: 'Senate Dysfunction',
        3: 'Constitutional Crisis', 4: 'Republic in Peril',
      };
      return labels[tier];
    }
    case 'economy': {
      const labels: Record<CrisisTier, string | null> = {
        0: null, 1: 'Tightening Budgets', 2: 'Economic Strain',
        3: 'Scarcity Crisis', 4: 'Economic Collapse',
      };
      return labels[tier];
    }
  }
}

// ─── Status effects per tier ──────────────────────────────────────────────────
// Values from design doc section 2.3 tier tables.
// specialEffect strings are checked by turnSequencer and officeActionEngine.

type StatusEffectBase = Omit<CrisisStatusEffect, 'trackId' | 'tier'>;

const WAR_EFFECTS: Record<CrisisTier, StatusEffectBase> = {
  0: { label: 'Pax Externa',        fidesDelta: 0,  denariDelta: 0,   actionCostMultiplier: 1.0 },
  1: { label: 'Border Tensions',    fidesDelta: -1, denariDelta: 0,   actionCostMultiplier: 1.0 },
  2: { label: 'Active Conflict',    fidesDelta: -2, denariDelta: 0,   actionCostMultiplier: 1.0, specialEffect: 'war-military-bill-pressure' },
  3: { label: 'War Crisis',         fidesDelta: -3, denariDelta: -5,  actionCostMultiplier: 1.0, specialEffect: 'war-mandatory-funding' },
  4: { label: 'Existential Threat', fidesDelta: -5, denariDelta: -10, actionCostMultiplier: 1.0, specialEffect: 'war-levy-discount' },
};

const UNREST_EFFECTS: Record<CrisisTier, StatusEffectBase> = {
  0: { label: 'Content Populace', fidesDelta: 0,  denariDelta: 0, actionCostMultiplier: 1.0 },
  1: { label: 'Murmurs',          fidesDelta: -1, denariDelta: 0, actionCostMultiplier: 1.0 },
  2: { label: 'Growing Anger',    fidesDelta: -2, denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'unrest-plebs-decay' },
  3: { label: 'Street Violence',  fidesDelta: -3, denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'unrest-tribune-bonus' },
  4: { label: 'Open Revolt',      fidesDelta: -5, denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'unrest-senate-suspension' },
};

const CONSTITUTION_EFFECTS: Record<CrisisTier, StatusEffectBase> = {
  0: { label: 'Institutional Stability', fidesDelta: 0,  denariDelta: 0, actionCostMultiplier: 1.0 },
  1: { label: 'Political Tension',       fidesDelta: 0,  denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'constitution-relationship-decay' },
  2: { label: 'Senate Dysfunction',      fidesDelta: 0,  denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'constitution-bill-penalty' },
  3: { label: 'Constitutional Crisis',   fidesDelta: -1, denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'constitution-bill-penalty-large' },
  4: { label: 'Republic in Peril',       fidesDelta: -2, denariDelta: 0, actionCostMultiplier: 1.0, specialEffect: 'constitution-bill-penalty-extreme' },
};

const ECONOMY_EFFECTS: Record<CrisisTier, StatusEffectBase> = {
  0: { label: 'Prosperous Republic', fidesDelta: 0,  denariDelta: 0,   actionCostMultiplier: 1.0 },
  1: { label: 'Tightening Budgets',  fidesDelta: 0,  denariDelta: -2,  actionCostMultiplier: 1.0 },
  2: { label: 'Economic Strain',     fidesDelta: 0,  denariDelta: -5,  actionCostMultiplier: 1.1, specialEffect: 'economy-lex-vectigalibus' },
  3: { label: 'Scarcity Crisis',     fidesDelta: 0,  denariDelta: -8,  actionCostMultiplier: 1.2, specialEffect: 'economy-forced-austerity' },
  4: { label: 'Economic Collapse',   fidesDelta: -3, denariDelta: -12, actionCostMultiplier: 1.3, specialEffect: 'economy-creditors' },
};

/**
 * Returns the active CrisisStatusEffect for each of the four tracks.
 * Always returns exactly four effects (one per track) in insertion order.
 * Consumed by resourceEngine.calcResourceIncome each season.
 */
export function getCrisisStatusEffects(crisisState: CrisisState): CrisisStatusEffect[] {
  return [
    { trackId: 'war',          tier: crisisState.war.tier,          ...WAR_EFFECTS[crisisState.war.tier] },
    { trackId: 'unrest',       tier: crisisState.unrest.tier,       ...UNREST_EFFECTS[crisisState.unrest.tier] },
    { trackId: 'constitution', tier: crisisState.constitution.tier, ...CONSTITUTION_EFFECTS[crisisState.constitution.tier] },
    { trackId: 'economy',      tier: crisisState.economy.tier,      ...ECONOMY_EFFECTS[crisisState.economy.tier] },
  ];
}

// ─── Military bill pressure ───────────────────────────────────────────────────

/**
 * Returns additional War delta for this season based on whether a military
 * funding bill passed and the current War tier.
 * Called from turnSequencer after bill resolution (Chunk 2C).
 *
 * @param billsPassedThisSeason  IDs of bills that passed this season
 */
export function checkMilitaryBillPressure(
  crisisState: CrisisState,
  billsPassedThisSeason: string[]
): number {
  const warTier = crisisState.war.tier;
  if (warTier < 2) return 0;

  // Military bills are identified by id/category keywords.
  // This matches auto-injected war funding bills and player-submitted military bills.
  const militaryBillPassed = billsPassedThisSeason.some(id =>
    id.includes('military')  ||
    id.includes('militaria') ||  // lex-militaria, lex-militaria-auto-*
    id.includes('war')       ||
    id.includes('bello')     ||  // senatus-consultum-de-bello
    id.includes('bellum')    ||  // bellum-punicum, start-2
    id.includes('levy')      ||
    id.includes('legions')   ||
    id.includes('defense')   ||
    id.includes('defence')   ||
    id.includes('defendenda')    // sc-de-re-publica-defendenda
  );

  if (militaryBillPassed) return 0;

  // tier 2: +5 if no bill; tier 3+: +8
  return warTier >= 3 ? 8 : 5;
}
