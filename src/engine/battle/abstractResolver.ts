// ─── Abstract Battle Resolver ────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C8 — the REAL abstract
// resolver, superseding Chunk C7's placeholder (campaignResolver.ts's old
// private computeAbstractBattle, a flat strength-ratio-plus-noise stub with
// no terrain/martial/fatigue awareness and no commander-fate rolls). Used
// for BOTH the "Trust the Legate" delegate path (a player-manageable
// engagement, one tap) and every NPC-vs-NPC campaign battle every season —
// campaignResolver.ts calls this directly now, one resolver for both.
//
// Pure, no store/React imports. Reuses Legate's Line's own per-class atk/def
// tables (via armyEngine.armyStrength) and TerrainMod (via BALANCE.battle.terrains)
// rather than a parallel strategic-only power model — the plan's own
// "terrain fit, reuse M1 terrain tables" instruction.

import type { Army } from '../../models/army';
import type { TerrainMod } from '../../models/battle';
import { BALANCE } from '../../data/balance';
import { armyStrength } from '../armyEngine';
import type { RngFn } from '../../utils/seededRng';

const CAVALRY_CLASSES = new Set(['cavalry_heavy', 'cavalry_light']);

export interface AbstractBattleContext {
  terrain: TerrainMod;
  /** Commander martial rating for each side — 0 for a leaderless army (no
   *  bonus, not an error; leaderless armies can defend, just never attack —
   *  design invariant 5, unaffected by this resolver). */
  generalMartialA: number;
  generalMartialB: number;
  fatigueA: boolean;
  fatigueB: boolean;
}

export type AbstractCommanderFateResult = 'unharmed' | 'wounded' | 'captured' | 'killed';

export interface CommanderFateRoll {
  side: 'A' | 'B';
  result: AbstractCommanderFateResult;
}

export interface AbstractBattleResult {
  winner: 'A' | 'B';
  tier: 'marginal' | 'clear' | 'crushing';
  casualtyPctA: number;
  casualtyPctB: number;
  /** Only the LOSING side's commander is ever at risk — mirrors
   *  battleEngine's own convention (captainOutcomes risk-rolls the side that
   *  broke/lost, not the victor). Empty if the losing side has no commander
   *  to roll for (armyB/armyA's owner has commanderId: null). */
  commanderFateRolls: CommanderFateRoll[];
}

/** Class-weighted terrain fit: TerrainMod.mods is role-keyed (attackerAtk/
 *  defenderDef) and additionally scales cavalry-class shock (cavalryShock) —
 *  the same fields clashEngine.ts reads for a real tactical battle. Side A
 *  always plays the terrain's 'attacker' role, side B 'defender' — matches
 *  how an Engagement's attacker/defender are already labelled at the
 *  campaign layer (the mover vs. the army already standing there). */
function terrainFitMultiplier(army: Army, terrain: TerrainMod, role: 'attacker' | 'defender'): number {
  const total = army.units.reduce((sum, u) => sum + u.strength, 0);
  if (total <= 0) return 1;
  const cavalryShare = army.units
    .filter(u => CAVALRY_CLASSES.has(u.unitClass))
    .reduce((sum, u) => sum + u.strength, 0) / total;
  const roleMult = role === 'attacker' ? (terrain.mods.attackerAtk ?? 1) : (terrain.mods.defenderDef ?? 1);
  const cavalryMult = terrain.mods.cavalryShock ?? 1;
  return roleMult * (cavalryShare * cavalryMult + (1 - cavalryShare));
}

function computePower(
  army: Army,
  terrain: TerrainMod,
  role: 'attacker' | 'defender',
  martial: number,
  fatigued: boolean,
): number {
  const cfg = BALANCE.campaign.abstract;
  const base = armyStrength(army);
  const terrainMult = terrainFitMultiplier(army, terrain, role);
  const martialMult = 1 + martial * cfg.martialFactor;
  const fatigueMult = fatigued ? cfg.fatiguePenaltyMult : 1;
  return base * terrainMult * martialMult * fatigueMult;
}

function rollWeighted(weights: Record<AbstractCommanderFateResult, number>, rng: RngFn): AbstractCommanderFateResult {
  const total = weights.killed + weights.captured + weights.wounded + weights.unharmed;
  if (total <= 0) return 'unharmed';
  const roll = rng() * total;
  let acc = 0;
  for (const key of ['killed', 'captured', 'wounded', 'unharmed'] as const) {
    acc += weights[key];
    if (roll < acc) return key;
  }
  return 'unharmed';
}

/**
 * The abstract battle resolver — armyA (attacker role) vs armyB (defender
 * role). Power = armyStrength × terrain fit × (1 + martial × martialFactor)
 * × fatigue penalty; winner probability from the power ratio through a
 * logistic curve (BALANCE.campaign.abstract.logisticSteepness); tier from
 * how decisive that probability was; casualties by tier (the plan's own
 * spec-table seeds — crushing 25/8, clear 15/10, marginal 12/12); the
 * losing side's commander (if any) risk-rolls a fate via the SAME
 * BALANCE.battle.risk weighting tactical battles use (wingRouted for a
 * crushing loss, battleLostNoRout otherwise — the abstract battle has no
 * literal "wing" to rout, but the crushing/non-crushing split is the closest
 * honest analog).
 */
export function abstractResolver(
  armyA: Army,
  armyB: Army,
  ctx: AbstractBattleContext,
  rng: RngFn = Math.random,
): AbstractBattleResult {
  const cfg = BALANCE.campaign.abstract;
  const powerA = computePower(armyA, ctx.terrain, 'attacker', ctx.generalMartialA, ctx.fatigueA);
  const powerB = computePower(armyB, ctx.terrain, 'defender', ctx.generalMartialB, ctx.fatigueB);

  const logRatio = Math.log(Math.max(1e-6, powerA) / Math.max(1e-6, powerB));
  const winProbA = 1 / (1 + Math.exp(-cfg.logisticSteepness * logRatio));
  const winner: 'A' | 'B' = rng() < winProbA ? 'A' : 'B';

  const margin = Math.abs(winProbA - 0.5) * 2;
  const tier: AbstractBattleResult['tier'] =
    margin >= cfg.crushingMarginThreshold ? 'crushing' : margin >= cfg.clearMarginThreshold ? 'clear' : 'marginal';
  const casualties = cfg.casualtiesByTier[tier];

  const casualtyPctA = winner === 'A' ? casualties.winnerPct : casualties.loserPct;
  const casualtyPctB = winner === 'B' ? casualties.winnerPct : casualties.loserPct;

  const commanderFateRolls: CommanderFateRoll[] = [];
  const loserSide: 'A' | 'B' = winner === 'A' ? 'B' : 'A';
  const loserArmy = loserSide === 'A' ? armyA : armyB;
  if (loserArmy.commanderId) {
    const weights = tier === 'crushing' ? BALANCE.battle.risk.wingRouted : BALANCE.battle.risk.battleLostNoRout;
    commanderFateRolls.push({ side: loserSide, result: rollWeighted(weights, rng) });
  }

  return { winner, tier, casualtyPctA, casualtyPctB, commanderFateRolls };
}
