// ─── Campaign Engine ──────────────────────────────────────────────────────────
// Handles military campaign resolution for both the Medium (Commander) system
// and the Light (Officer volunteer) system, plus commander election logic.

import type { CampaignState, CommanderElectionState, GovernorCandidate } from '../models/city';
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

export interface CommanderElectionResult {
  winnerId: string;
  winnerName: string;
  playerSupported: boolean;
  playerWon: boolean;
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
  // ~30% chance per season; weight table handled in data/campaignEvents.ts
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

// ─── Commander Election ───────────────────────────────────────────────────────

/**
 * Generates the list of NPC candidates competing to command a campaign.
 * Picks from clan leaders who have a 'military' bias or high influence,
 * plus any eligible family members from other gens.
 */
export function generateCommanderCandidates(
  provinceId: string,
  state: GameState,
): GovernorCandidate[] {
  // ── NPC candidates: clan leaders with military bias or influence ≥ 50 ────
  const npcCandidates: GovernorCandidate[] = [];
  for (const clan of state.clans) {
    for (const leader of clan.leaders) {
      if (leader.bias === 'military' || clan.influence >= 50) {
        npcCandidates.push({
          characterId: leader.id,
          characterName: leader.name,
          clanId: clan.id,
          clanName: clan.name,
          isPlayerFamily: false,
          martialSkill: clamp(0, 10, Math.round(3 + clan.influence * 0.06)),
          eligibleOffices: ['praetor', 'consul'],
        });
      }
    }
  }

  // ── Player family candidates: any adult not currently in office ──────────
  // Eligibility: age ≥ 18. No martial minimum — the player can nominate anyone.
  const familyCandidates: GovernorCandidate[] = state.family
    .filter(c => c.age >= 18 && !c.officeId)
    .map(c => ({
      characterId: c.id,
      characterName: c.name,
      // Phase 5, Chunk P5-E — was hardcoded 'brutii'/'Brutii', found during
      // the gens-neutrality sweep.
      clanId: state.gensId,
      clanName: state.gensPlural,
      isPlayerFamily: true,
      martialSkill: c.skills.martial,
      eligibleOffices: ['praetor', 'consul'],
    }));

  // ── Combine: shuffle NPC pool, cap at 3, then append ALL family candidates
  // This guarantees family members always appear in the list regardless of the cap.
  const shuffledNpc = npcCandidates.sort(() => Math.random() - 0.5).slice(0, 3);
  return [...shuffledNpc, ...familyCandidates];
}

/**
 * Resolves a commander senate vote.
 * The winning candidate is the one with the most weighted support.
 * Player votes/speeches/canvassing shift support toward their preferred candidate.
 */
export function resolveCommanderElection(
  election: CommanderElectionState,
  state: GameState,
): CommanderElectionResult {
  // Build score for each candidate
  const scores: Record<string, number> = {};

  for (const candidate of election.candidates) {
    let score = 30; // base

    // NPC clan influence
    if (!candidate.isPlayerFamily) {
      const clan = state.clans.find(c => c.id === candidate.clanId);
      score += (clan?.influence ?? 0) * 0.3;
    }

    // Martial skill bonus
    score += candidate.martialSkill * 3;

    // Player support actions — if they voted/canvassed for this candidate
    if (election.playerSupportedCandidateId === candidate.characterId) {
      // Locked votes from campaign votes (re-use existing system)
      let lockedFor = 0;
      state.clans.flatMap(c => c.leaders).forEach(l => {
        const cv = state.campaignVotes[l.id];
        if (cv === 'for') lockedFor += l.votes;
      });
      score += lockedFor * 0.5;
      score += election.playerSpeechBonus;
    }

    // Slight randomness
    score += Math.random() * 15;

    scores[candidate.characterId] = score;
  }

  // Find winner
  const winnerId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
  const winner = election.candidates.find(c => c.characterId === winnerId)!;
  const playerWon = election.playerSupportedCandidateId === winnerId;

  const logMsg = playerWon
    ? `Senate votes ${winner.characterName} as commander of the ${election.provinceId} campaign. Your candidate prevails.`
    : `Senate votes ${winner.characterName} as commander. Your preferred candidate was not chosen.`;

  return {
    winnerId,
    winnerName: winner.characterName,
    playerSupported: !!election.playerSupportedCandidateId,
    playerWon,
    logMsg,
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
