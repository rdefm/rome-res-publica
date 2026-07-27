// ─── Campaign Engine ──────────────────────────────────────────────────────────
// Handles military campaign resolution for both the Medium (Commander) system
// and the Light (Officer volunteer) system.
//
// Chunk T8 (tutorial redesign) removed this file's old commander-election
// pair (generateCommanderCandidates/resolveCommanderElection, CommanderElectionResult)
// — confirmed zero callers repo-wide (MilitaryTab.tsx's UI for it was fed a
// permanently-null province-scoped CommanderElectionState from
// ProvinciaeScreen.tsx and never actually rendered). The REAL, live command
// mechanic is a Curia-level "extraordinary assembly" — see models/command.ts's
// CommandElectionState, engine/commandEngine.ts, and CuriaScreen.tsx's
// CommandAssemblyModal — built later (Campaign Map plan Chunk C4) as a
// deliberate parallel track and never wired back to replace this one.

import type { CampaignState } from '../models/city';
import type { GameState } from '../state/gameStore';
import type { Character } from '../models/character';
import type { TroopUnit } from '../models/troop';
import { calcEffectiveForce, promoteVeterans } from './troopEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ManpowerChoice = 'press' | 'standard' | 'elite' | 'numidian';
export type StrategyChoice = 'advance' | 'probe' | 'fortify';
export type MoraleChoice   = 'pay' | 'rally' | 'loot';

export interface CampaignAllocation {
  manpower: ManpowerChoice;
  strategy: StrategyChoice;
  morale: MoraleChoice;
}

export interface CampaignSeasonResult {
  progressDelta: number;
  enemyDelta: number;
  goldCost: number;
  fidesCost: number;
  eventCardId: string | null;
  logMsg: string;
}

export interface CampaignResolution {
  outcome: 'decisive_victory' | 'victory' | 'pyrrhic' | 'defeat' | 'catastrophic';
  dignitasDelta: number;
  corruptionDelta: number;
  relationshipDelta: number;
  triumphAvailable: boolean;
  updatedTroops: TroopUnit[];   // troop state after campaign outcome applied
  catastrophic: boolean;         // true when defeat margin < −30
  logMsg: string;
}

export interface OfficerRollResult {
  decisionIndex: number; // 0, 1, or 2
  success: boolean;
  martialXpGain: number;
  traitUnlocked: string | null;
  imperiumGained: number;
  logMsg: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(min: number, max: number, val: number): number {
  return Math.min(max, Math.max(min, val));
}

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Medium Campaign: Season Allocation ──────────────────────────────────────

/**
 * Resolves one season of an active Commander campaign based on allocation decisions.
 * Returns deltas to apply to CampaignState and GameState.
 */
export function resolveCampaignSeason(
  campaign: CampaignState,
  allocation: CampaignAllocation,
  commanderMartial: number,  // 0–10
  commanderTroops: TroopUnit[],
  localSupportForPlayer: number,
  hasNumidianCavalryClient: boolean,
): CampaignSeasonResult {
  let progressDelta = 0;
  let enemyDelta = 0;
  let goldCost = 0;
  let fidesCost = 0;
  let riskFactor = 0;

  // ── Manpower ──────────────────────────────────────────────────────────────
  switch (allocation.manpower) {
    case 'press':
      progressDelta += 10;
      break;
    case 'standard':
      goldCost += 20;
      progressDelta += 10;
      break;
    case 'elite':
      goldCost += 50;
      progressDelta += 8;
      progressDelta += 15; // quality bonus
      break;
    case 'numidian':
      if (hasNumidianCavalryClient) {
        goldCost += 60;
        progressDelta += 8;
        progressDelta += 20; // elite Numidian option
      } else {
        // Fallback to elite if client not available
        goldCost += 50;
        progressDelta += 23;
      }
      break;
  }

  // ── Strategy ──────────────────────────────────────────────────────────────
  switch (allocation.strategy) {
    case 'advance':
      progressDelta += 20;
      riskFactor += 10;
      break;
    case 'probe':
      progressDelta += 10;
      break;
    case 'fortify':
      progressDelta += 5;
      enemyDelta -= 15; // reduce enemy next season
      break;
  }

  // ── Morale ────────────────────────────────────────────────────────────────
  switch (allocation.morale) {
    case 'pay':
      goldCost += 30;
      progressDelta += 15;
      break;
    case 'rally':
      fidesCost += 10;
      progressDelta += 10;
      break;
    case 'loot':
      // free, morale boost but relationship hit handled in store
      progressDelta += 8;
      break;
  }

  // ── Effective force multiplier ────────────────────────────────────────────
  // Replaces the old martialMult + localSupportBonus system.
  // effectiveForce combines troop strength, commander martial, and local support.
  const effectiveForce = calcEffectiveForce(commanderTroops, commanderMartial, localSupportForPlayer);
  const forceMult = effectiveForce / 10;  // normalise to a 0–N multiplier
  progressDelta = Math.round(progressDelta * forceMult);

  // ── Risk roll: chance of enemy counter-push ────────────────────────────────
  if (riskFactor > 0 && Math.random() * 100 < riskFactor) {
    enemyDelta += rand(5, 15);
  }

  // ── Event card ────────────────────────────────────────────────────────────
  // QA Audit Fix Plan, Chunk D — data/campaignEvents.ts (the event-card
  // CONTENT this id was meant to look up) is deleted: confirmed dead,
  // MilitaryTab.tsx's card UI could never render (CampaignState.activeEventId,
  // this function's only real write target, was never actually wired to any
  // caller — resolveCampaignSeason itself has zero call sites repo-wide,
  // superseded by campaignResolver.ts's newer, differently-named function of
  // the same name). eventCardId is computed and returned below but nothing
  // reads it. Left in place rather than also deleted — that's a materially
  // bigger, unapproved excision of this file's whole "Medium (Commander)
  // campaign" resolution path, flagged separately, not this chunk's call.
  // ~30% chance per season.
  const eventCardId = Math.random() < 0.30 ? pickCampaignEventId(campaign.type) : null;

  const logParts: string[] = [];
  if (goldCost > 0) logParts.push(`−${goldCost} Gold`);
  if (fidesCost > 0) logParts.push(`−${fidesCost} Fides`);
  logParts.push(`Progress +${progressDelta}`);
  if (enemyDelta < 0) logParts.push(`Enemy −${Math.abs(enemyDelta)}`);
  if (enemyDelta > 0) logParts.push(`Enemy +${enemyDelta}`);

  return {
    progressDelta,
    enemyDelta,
    goldCost,
    fidesCost,
    eventCardId,
    logMsg: logParts.join(', '),
  };
}

// ─── Medium Campaign: Final Resolution ───────────────────────────────────────

/**
 * Called when a campaign reaches its terminal condition. Produces the final
 * outcome and state deltas based on the margin between effective force and
 * enemy strength, with ±15 random noise.
 */
export function resolveCampaignOutcome(
  campaign: CampaignState,
  effectiveForce: number,
  commanderTroops: TroopUnit[],
): CampaignResolution {
  let outcome: CampaignResolution['outcome'];
  let dignitasDelta = 0;
  let corruptionDelta = 0;
  let relationshipDelta = 0;
  let triumphAvailable = false;
  let catastrophic = false;

  const noise = (Math.random() * 30) - 15;  // ±15 random noise
  const margin = effectiveForce - campaign.enemyStrength + noise;

  if (margin > 30) {
    outcome = 'decisive_victory';
    dignitasDelta = 20;
    relationshipDelta = 15;
    triumphAvailable = true;
  } else if (margin >= 10) {
    outcome = 'victory';
    dignitasDelta = 10;
    relationshipDelta = 8;
  } else if (margin >= 0) {
    outcome = 'pyrrhic';
    dignitasDelta = 2;
    relationshipDelta = 3;
  } else if (margin >= -30) {
    outcome = 'defeat';
    dignitasDelta = -15;
    corruptionDelta = 10;
    relationshipDelta = -10;
  } else {
    outcome = 'catastrophic';
    dignitasDelta = -25;
    corruptionDelta = 20;
    relationshipDelta = -20;
    catastrophic = true;
  }

  // Map CampaignResolution outcome to promoteVeterans outcome type
  const veteranOutcome: Parameters<typeof promoteVeterans>[1] =
    outcome === 'decisive_victory' ? 'decisive_victory'
    : outcome === 'victory'        ? 'victory'
    : outcome === 'pyrrhic'        ? 'pyrrhic'
    : outcome === 'catastrophic'   ? 'catastrophic'
    : 'defeat';

  const updatedTroops = promoteVeterans(commanderTroops, veteranOutcome);

  const outcomeLabels: Record<CampaignResolution['outcome'], string> = {
    decisive_victory: '⚔ DECISIVE VICTORY! The enemy is utterly broken.',
    victory:          '⚔ Victory. The campaign objectives are secured.',
    pyrrhic:          '⚔ Pyrrhic Victory. Objectives met — at great cost.',
    defeat:           '⚔ DEFEAT. Your forces are routed.',
    catastrophic:     '⚔ CATASTROPHE. Your army is destroyed.',
  };

  const rewardParts: string[] = [];
  if (dignitasDelta > 0) rewardParts.push(`+${dignitasDelta} Dignitas`);
  if (dignitasDelta < 0) rewardParts.push(`${dignitasDelta} Dignitas`);
  if (corruptionDelta > 0) rewardParts.push(`+${corruptionDelta} Corruption`);
  if (triumphAvailable) rewardParts.push('Triumph available in Curia');

  return {
    outcome,
    dignitasDelta,
    corruptionDelta,
    relationshipDelta,
    triumphAvailable,
    updatedTroops,
    catastrophic,
    logMsg: `${outcomeLabels[outcome]}${rewardParts.length ? ' — ' + rewardParts.join(', ') : ''}`,
  };
}

// ─── Light Campaign: Officer Decision Points ──────────────────────────────────

const OFFICER_DECISIONS = [
  {
    id: 'vanguard',
    prompt: 'The commander calls for volunteers for the vanguard.',
    riskOption: 'Volunteer (Martial check)',
    safeOption: 'Hold back',
  },
  {
    id: 'supply',
    prompt: 'Supply lines are stretched. The commander asks your assessment.',
    riskOption: 'Recommend aggressive resupply (Intrigus check)',
    safeOption: 'Advise caution',
  },
  {
    id: 'final_assault',
    prompt: 'The final assault is ordered. How do you position your cohort?',
    riskOption: 'Lead the charge (Martial check)',
    safeOption: 'Secure the flanks',
  },
] as const;

export type OfficerDecisionId = typeof OFFICER_DECISIONS[number]['id'];

export function getOfficerDecisions() {
  return OFFICER_DECISIONS;
}

/**
 * Resolves a single officer decision point.
 * @param decisionIndex 0, 1, or 2
 * @param tookRisk whether the player chose the risky option
 * @param relevantSkill the officer's martial (0–10) or intrigus (0–10)
 */
export function resolveOfficerDecision(
  decisionIndex: number,
  tookRisk: boolean,
  relevantSkill: number,
): { success: boolean; logMsg: string } {
  if (!tookRisk) {
    return { success: false, logMsg: 'You chose the cautious path.' };
  }
  // Skill 0–10 → 30–80% success chance
  const chance = clamp(0.30, 0.80, 0.30 + relevantSkill * 0.05);
  const success = Math.random() < chance;
  return {
    success,
    logMsg: success
      ? 'Your gamble paid off — the cohort distinguished itself.'
      : 'The risk failed. Your cohort took heavy casualties.',
  };
}

/**
 * Resolves the final outcome for an officer volunteer.
 * Called when the NPC-led campaign concludes.
 * @param successCount number of decision points where the officer succeeded (0–3)
 * @param martialSkill officer's martial skill 0–10
 */
export function resolveOfficerOutcome(
  successCount: number,
  martialSkill: number,
): OfficerRollResult & { campaignOutcome: 'won' | 'lost' | 'drawn' } {
  // NPC campaign outcome is separate from personal performance
  const npcRoll = Math.random();
  const campaignOutcome: 'won' | 'lost' | 'drawn' =
    npcRoll > 0.55 ? 'won' : npcRoll > 0.25 ? 'drawn' : 'lost';

  // Personal performance
  const baseXp = successCount * 2;
  const martialXpGain = clamp(0, 8, baseXp + Math.round(martialSkill * 0.2));
  const imperiumGained = successCount > 1 ? 5 : successCount === 1 ? 2 : 0;

  // Trait unlock: 'Veteran' if 3 successes, 'Seasoned' if 2
  const traitUnlocked =
    successCount === 3 ? 'veteran'
    : successCount === 2 ? 'seasoned'
    : null;

  const logParts = [
    `Officer term complete (${successCount}/3 decisions succeeded).`,
    `+${martialXpGain} Martial XP`,
    imperiumGained > 0 ? `+${imperiumGained} Imperium` : null,
    traitUnlocked ? `Trait unlocked: ${traitUnlocked}` : null,
    `NPC campaign: ${campaignOutcome}`,
  ].filter(Boolean).join(' · ');

  return {
    decisionIndex: 2,
    success: successCount > 1,
    martialXpGain,
    traitUnlocked,
    imperiumGained,
    logMsg: logParts,
    campaignOutcome,
  };
}

// ─── Governor Lot Draw ────────────────────────────────────────────────────────

/**
 * Draws a province at random for a character completing their consular/praetor term.
 * Returns the assigned province ID.
 */
export function drawGovernorLot(
  eligibleProvinceIds: string[],
): string {
  return eligibleProvinceIds[Math.floor(Math.random() * eligibleProvinceIds.length)];
}

/**
 * Attempts to rig the lot. Success depends on character's intrigus skill.
 * @returns true if the rig succeeds (player can then choose province)
 */
export function attemptRigLot(intrigusSkill: number): boolean {
  // intrigus 0–10 → 15–75% success
  const chance = clamp(0.15, 0.75, 0.15 + intrigusSkill * 0.06);
  return Math.random() < chance;
}

// ─── Campaign Event Picker ────────────────────────────────────────────────────

function pickCampaignEventId(campaignType: CampaignState['type']): string {
  const pools: Record<CampaignState['type'], string[]> = {
    conquest:       ['supply_shortage', 'local_guides', 'ambush', 'desertion', 'divine_omen'],
    defence:        ['rally_citizens', 'supply_surge', 'ambush', 'reinforcements', 'divine_omen'],
    suppression:    ['civilian_appeal', 'desertion', 'supply_shortage', 'local_intel'],
    allied_support: ['local_guides', 'allied_reinforcements', 'political_complications', 'divine_omen'],
  };
  const pool = pools[campaignType];
  return pool[Math.floor(Math.random() * pool.length)];
}
