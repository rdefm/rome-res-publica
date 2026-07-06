/**
 * officeActionEngine.ts
 *
 * Centralises office action resolution: gate evaluation, cost deduction,
 * effect application, cross-tab consequence patching.
 *
 * Called by:
 *   gameStore.takeOfficeAction  (added in Chunk 1B)
 *   CursusScreen                (for gate-locked button rendering)
 */

import type { GameState } from '../state/gameStore';
import type { OfficeAction, OfficeActionGate, CrossTabConsequence } from '../models/office';
import type { Client } from '../models/client';
import { OFFICES, TRIBUNE_OFFICE } from '../data/offices';
import { applyEffectString } from './resourceEngine';
import { applyTrackDelta } from './crisisEngine';
import type { CrisisTrackId } from '../models/crisis';

// ─── Sentinel target-ID constants ─────────────────────────────────────────────
// Used in CrossTabConsequence.targetId. Resolved at runtime inside applyConsequences.

export const TARGET_ALL_OPTIMATES_LEADERS          = 'ALL_OPTIMATES_LEADERS';
export const TARGET_ALL_POPULARES_LEADERS          = 'ALL_POPULARES_LEADERS';
export const TARGET_ALL_NON_ALLIED_CLANS           = 'ALL_NON_ALLIED_CLANS';
export const TARGET_ALL_CLANS                      = 'ALL_CLANS';
export const TARGET_ALL_OTHER_CLANS                = 'ALL_OTHER_CLANS';
export const TARGET_MOST_HOSTILE_CLAN              = 'MOST_HOSTILE_CLAN';
export const TARGET_NPC_CONSUL_CLAN                = 'NPC_CONSUL_CLAN';
export const TARGET_PLAYER_CHOSEN_PROVINCE         = 'PLAYER_CHOSEN_PROVINCE';
export const TARGET_ACTIVE_CAMPAIGN_PROVINCE       = 'ACTIVE_CAMPAIGN_PROVINCE';
export const TARGET_HIGHEST_INFRA_PROVINCE         = 'HIGHEST_INFRASTRUCTURE_PROVINCE';
export const TARGET_PLAYER_CHOSEN_LEADER_CLAN      = 'PLAYER_CHOSEN_LEADER_CLAN';
export const TARGET_PLAYER_CHOSEN_CLAN             = 'PLAYER_CHOSEN_CLAN';
export const TARGET_PLAYER_CHOSEN_HOSTILE_LEADER_CLAN = 'PLAYER_CHOSEN_HOSTILE_LEADER_CLAN';
export const TARGET_LEADER_CLAN                    = 'TARGET_LEADER_CLAN';
export const TARGET_CAMPAIGN_CLAN_LEADER           = 'CAMPAIGN_CLAN_LEADER';
export const TARGET_HIGHEST_CRISIS_TRACK           = 'HIGHEST_CRISIS_TRACK';

// ─── Target context ───────────────────────────────────────────────────────────

/** Caller supplies this when a sentinel requires a player-chosen target. */
export interface OfficeActionTargetContext {
  /** Required for PLAYER_CHOSEN_PROVINCE */
  provinceId?: string;
  /** Required for PLAYER_CHOSEN_LEADER_CLAN / TARGET_LEADER_CLAN (resolved to their clan) */
  leaderId?: string;
  /** Direct clan override — used when leaderId is unavailable */
  clanId?: string;
}

// ─── NPC consul shape (mirrors Chunk 1B GameState addition) ──────────────────

interface NpcConsulData {
  leaderId: string | null;
  clanId: string | null;
  factionBias: 'optimates' | 'populares' | 'neutral' | null;
  antagonismLevel: 0 | 1 | 2 | 3;
  seasonsServed: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function evaluateOp(
  actual: number,
  op: 'gt' | 'lt' | 'gte' | 'lte' | 'eq',
  expected: number,
): boolean {
  switch (op) {
    case 'gt':  return actual > expected;
    case 'lt':  return actual < expected;
    case 'gte': return actual >= expected;
    case 'lte': return actual <= expected;
    case 'eq':  return actual === expected;
  }
}

function resolveResourceValue(key: string, state: GameState): number {
  if (key.includes('.')) {
    const [obj, field] = key.split('.');
    if (obj === 'rome') return ((state.rome as unknown as Record<string, number>)[field]) ?? 0;
    return 0;
  }
  switch (key) {
    case 'fides':            return state.fides;
    case 'denarii':          return state.denarii;
    case 'imperium':         return state.imperium;
    case 'lifetimeDignitas': return state.lifetimeDignitas;
    case 'crisisLevel':      return state.crisisLevel;
    default:                 return 0;
  }
}

function deltaRelationshipOnClan(
  clans: GameState['clans'],
  clanId: string,
  delta: number,
): GameState['clans'] {
  return clans.map(clan =>
    clan.id !== clanId
      ? clan
      : {
          ...clan,
          leaders: clan.leaders.map(leader => ({
            ...leader,
            relationship: Math.min(
              100,
              Math.max(-100, ((leader as unknown as Record<string, number>).relationship ?? 0) + delta),
            ),
          })),
        },
  );
}

function avgClanRelationship(clan: GameState['clans'][0]): number {
  if (!clan.leaders.length) return 0;
  const sum = clan.leaders.reduce(
    (acc, l) => acc + ((l as unknown as Record<string, number>).relationship ?? 0), 0,
  );
  return sum / clan.leaders.length;
}

// ─── Gate evaluation ──────────────────────────────────────────────────────────

function evaluateGateItem(
  gate: OfficeActionGate,
  character: GameState['family'][0],
  state: GameState,
): { pass: boolean; reason: string } {
  const numVal = gate.value as number;

  switch (gate.type) {
    case 'skill': {
      const skillVal = (character.skills as Record<string, number>)[gate.key] ?? 0;
      const pass = evaluateOp(skillVal, gate.op, numVal);
      return { pass, reason: `Requires ${gate.key} ${gate.op} ${numVal} (current: ${skillVal})` };
    }
    case 'resource': {
      const resVal = resolveResourceValue(gate.key, state);
      const pass = evaluateOp(resVal, gate.op, numVal);
      return { pass, reason: `Requires ${gate.key} ${gate.op} ${numVal} (current: ${resVal})` };
    }
    case 'flag': {
      const flagVal = state.flags[gate.key];
      if (gate.op === 'eq') {
        const pass = flagVal === gate.value;
        return { pass, reason: `Requires flag '${gate.key}' = ${String(gate.value)} (current: ${String(flagVal)})` };
      }
      const pass = evaluateOp(Number(flagVal ?? 0), gate.op, numVal);
      return { pass, reason: `Requires flag '${gate.key}' ${gate.op} ${numVal}` };
    }
    case 'asset': {
      const pass = state.ownedAssets.some(
        a => a.definitionId === gate.key &&
             ((a as unknown as Record<string, number>).currentTier ?? 0) >= numVal,
      );
      return { pass, reason: `Requires asset '${gate.key}' at tier ${numVal}+` };
    }
    case 'client': {
      const count = gate.key === 'any'
        ? state.clients.length
        : state.clients.filter(c => c.type === (gate.key as Client['type'])).length;
      const pass = evaluateOp(count, gate.op, numVal);
      return { pass, reason: `Requires ${numVal}+ client(s)${gate.key !== 'any' ? ` of type '${gate.key}'` : ''}` };
    }
    case 'imperium': {
      const pass = evaluateOp(state.imperium, gate.op, numVal);
      return { pass, reason: `Requires Imperium ${gate.op} ${numVal} (current: ${state.imperium})` };
    }
    case 'npcConsulRelationship': {
      const npc = (state as unknown as { npcConsul?: NpcConsulData | null }).npcConsul;
      if (!npc) return { pass: false, reason: 'No NPC co-consul is currently serving' };
      const pass = evaluateOp(npc.antagonismLevel, gate.op, numVal);
      return { pass, reason: `Requires co-consul antagonism ${gate.op} ${numVal} (current: ${npc.antagonismLevel})` };
    }
  }
}

/**
 * Evaluate all gates for an office action.
 * gate[]    — AND logic: all must pass; short-circuits on first failure.
 * gateAny[] — OR logic: at least one must pass (checked only if gate[] passes).
 */
export function evaluateGates(
  action: OfficeAction,
  characterId: string,
  state: GameState,
): { allowed: boolean; blockedReason?: string } {
  const character = state.family.find(c => c.id === characterId);
  if (!character) return { allowed: false, blockedReason: 'Character not found' };

  for (const gate of action.gate ?? []) {
    const { pass, reason } = evaluateGateItem(gate, character, state);
    if (!pass) return { allowed: false, blockedReason: reason };
  }

  if (action.gateAny && action.gateAny.length > 0) {
    const anyPass = action.gateAny.some(gate => evaluateGateItem(gate, character, state).pass);
    if (!anyPass) {
      const reasons = action.gateAny.map(g => evaluateGateItem(g, character, state).reason).join(' OR ');
      return { allowed: false, blockedReason: `At least one must be met: ${reasons}` };
    }
  }

  return { allowed: true };
}

// ─── Cross-tab consequences ───────────────────────────────────────────────────

function applyConsequences(
  consequences: CrossTabConsequence[],
  state: GameState,
  targetContext?: OfficeActionTargetContext,
): Partial<GameState> {
  let patch: Partial<GameState> = {};

  for (const consequence of consequences) {
    const { type, targetId, delta } = consequence;

    switch (type) {

      case 'clanRelationship': {
        if (!targetId) break;
        let clanIds: string[] = [];

        if (targetId === TARGET_ALL_CLANS || targetId === TARGET_ALL_OTHER_CLANS) {
          // ALL_OTHER_CLANS treated as ALL_CLANS — caller handles exclusions separately
          clanIds = state.clans.map(c => c.id);
        } else if (targetId === TARGET_ALL_NON_ALLIED_CLANS) {
          clanIds = state.clans.filter(c => avgClanRelationship(c) < 40).map(c => c.id);
        } else if (targetId === TARGET_ALL_OPTIMATES_LEADERS) {
          clanIds = state.clans.filter(c => c.leaders.some(l => (l as any).bias === 'optimates')).map(c => c.id);
        } else if (targetId === TARGET_ALL_POPULARES_LEADERS) {
          clanIds = state.clans.filter(c => c.leaders.some(l => (l as any).bias === 'populares')).map(c => c.id);
        } else if (targetId === TARGET_MOST_HOSTILE_CLAN) {
          const hostile = [...state.clans].sort((a, b) => avgClanRelationship(a) - avgClanRelationship(b))[0];
          if (hostile) clanIds = [hostile.id];
        } else if (targetId === TARGET_NPC_CONSUL_CLAN) {
          const npc = (state as any).npcConsul as NpcConsulData | null;
          if (npc?.clanId) clanIds = [npc.clanId];
        } else if (
          targetId === TARGET_PLAYER_CHOSEN_LEADER_CLAN ||
          targetId === TARGET_LEADER_CLAN ||
          targetId === TARGET_PLAYER_CHOSEN_HOSTILE_LEADER_CLAN
        ) {
          const resolvedClanId =
            targetContext?.clanId ??
            state.clans.find(c => c.leaders.some(l => l.id === targetContext?.leaderId))?.id;
          if (!resolvedClanId) {
            console.warn(`[applyConsequences] ${targetId}: targetContext.clanId or .leaderId required`);
            break;
          }
          clanIds = [resolvedClanId];
        } else if (targetId === TARGET_PLAYER_CHOSEN_CLAN) {
          if (!targetContext?.clanId) {
            console.warn('[applyConsequences] PLAYER_CHOSEN_CLAN: targetContext.clanId required');
            break;
          }
          clanIds = [targetContext.clanId];
        } else {
          clanIds = [targetId];
        }

        let updatedClans = patch.clans ?? state.clans;
        for (const id of clanIds) updatedClans = deltaRelationshipOnClan(updatedClans, id, delta);
        patch = { ...patch, clans: updatedClans };
        break;
      }

      case 'provinceRelationship': {
        let provinceId: string | undefined;
        if (targetId === TARGET_PLAYER_CHOSEN_PROVINCE) {
          if (!targetContext?.provinceId) {
            console.warn('[applyConsequences] PLAYER_CHOSEN_PROVINCE: targetContext.provinceId required');
            break;
          }
          provinceId = targetContext.provinceId;
        } else if (targetId === TARGET_ACTIVE_CAMPAIGN_PROVINCE) {
          provinceId = state.provinces.find(p => p.activeCampaign !== null)?.id;
        } else if (targetId === TARGET_HIGHEST_INFRA_PROVINCE) {
          provinceId = [...state.provinces].sort(
            (a, b) => ((b as any).infrastructureRating ?? 0) - ((a as any).infrastructureRating ?? 0),
          )[0]?.id;
        } else {
          provinceId = targetId;
        }
        if (!provinceId) break;
        patch = {
          ...patch,
          provinces: (patch.provinces ?? state.provinces).map(p =>
            p.id !== provinceId ? p : {
              ...p,
              relationship: Math.min(100, Math.max(-100, ((p as any).relationship ?? 0) + delta)),
            },
          ),
        };
        break;
      }

      case 'romeStability': {
        const r = patch.rome ?? state.rome;
        patch = { ...patch, rome: { ...r, stability: Math.min(100, Math.max(0, r.stability + delta)) } };
        break;
      }
      case 'romePlebs': {
        const r = patch.rome ?? state.rome;
        patch = { ...patch, rome: { ...r, plebs: Math.min(100, Math.max(0, r.plebs + delta)) } };
        break;
      }
      case 'romeTreasury': {
        const r = patch.rome ?? state.rome;
        patch = { ...patch, rome: { ...r, treasury: Math.min(100, Math.max(0, r.treasury + delta)) } };
        break;
      }

      case 'crisisTrack': {
        if (!targetId) break;
        const currentCrisis = patch.crisis ?? state.crisis;

        if (targetId === TARGET_HIGHEST_CRISIS_TRACK) {
          // Apply delta to whichever of the four tracks currently has the highest level
          const trackIds: CrisisTrackId[] = ['war', 'unrest', 'constitution', 'economy'];
          const highest = trackIds.reduce((best, id) =>
            currentCrisis[id].level > currentCrisis[best].level ? id : best,
          trackIds[0]);
          patch = {
            ...patch,
            crisis: { ...currentCrisis, [highest]: applyTrackDelta(currentCrisis[highest], delta) },
          };
        } else {
          const trackId = targetId as CrisisTrackId;
          patch = {
            ...patch,
            crisis: { ...currentCrisis, [trackId]: applyTrackDelta(currentCrisis[trackId], delta) },
          };
        }
        break;
      }

      case 'constitutionTick': {
        const currentCrisis = patch.crisis ?? state.crisis;
        patch = {
          ...patch,
          crisis: { ...currentCrisis, constitution: applyTrackDelta(currentCrisis.constitution, delta) },
        };
        break;
      }

      case 'addFlag': {
        if (!targetId) break;
        patch = { ...patch, flags: { ...(patch.flags ?? state.flags), [targetId]: delta !== 0 ? delta : true } };
        break;
      }
      case 'clearFlag': {
        if (!targetId) break;
        const newFlags = { ...(patch.flags ?? state.flags) };
        delete newFlags[targetId];
        patch = { ...patch, flags: newFlags };
        break;
      }

      case 'addBlackmail': {
        if (!targetId) break;
        let leaderId: string | undefined = targetId;

        if (targetId === TARGET_CAMPAIGN_CLAN_LEADER) {
          // Find the province with an active campaign, then get its clan's first leader
          const campaignProvince = state.provinces.find(p => p.activeCampaign !== null);
          const campaignClanId = (campaignProvince as any)?.activeCampaign?.clanId
            ?? (campaignProvince as any)?.dominantClanId;
          const campaignClan = state.clans.find(c => c.id === campaignClanId);
          leaderId = campaignClan?.leaders[0]?.id;
        }

        if (!leaderId) break;
        patch = {
          ...patch,
          clans: (patch.clans ?? state.clans).map(clan => ({
            ...clan,
            leaders: clan.leaders.map(l => l.id === leaderId ? { ...l, blackmail: true } : l),
          })),
        };
        break;
      }
    }
  }

  return patch;
}

// ─── Tribune scaling ──────────────────────────────────────────────────────────

export function evaluateTribuneScaling(baseValue: number, state: GameState): number {
  const plebs = state.rome.plebs;
  let multiplier: number;
  if (plebs < 30)       multiplier = 0.6;
  else if (plebs < 50)  multiplier = 0.85;
  else if (plebs < 70)  multiplier = 1.0;
  else if (plebs < 85)  multiplier = 1.2;
  else                  multiplier = 1.4;

  const unrestLevel = state.crisis.unrest.level;
  if (unrestLevel >= 75)       multiplier += 0.4;
  else if (unrestLevel >= 50)  multiplier += 0.2;

  return Math.round(baseValue * multiplier);
}

// ─── Action lookup ────────────────────────────────────────────────────────────

function findAction(actionId: string): OfficeAction | undefined {
  for (const office of OFFICES) {
    const found = office.inOfficeActions?.find(a => a.id === actionId);
    if (found) return found;
  }
  // TRIBUNE_OFFICE is a parallel path — searched separately (added in Chunk 1B)
  const tribuneFound = TRIBUNE_OFFICE.inOfficeActions?.find(a => a.id === actionId);
  if (tribuneFound) return tribuneFound;
  return undefined;
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export interface ResolvedActionPatch extends Partial<GameState> {
  logMsg?: string;
  blocked?: true;
  blockedReason?: string;
}

export function resolveOfficeAction(
  actionId: string,
  characterId: string,
  state: GameState,
  targetContext?: OfficeActionTargetContext,
): ResolvedActionPatch {
  const action = findAction(actionId);
  if (!action) {
    console.warn(`[resolveOfficeAction] Action '${actionId}' not found.`);
    return { blocked: true, blockedReason: `Unknown action: ${actionId}` };
  }

  const gateResult = evaluateGates(action, characterId, state);
  if (!gateResult.allowed) return { blocked: true, blockedReason: gateResult.blockedReason };

  let patch: Partial<GameState> = {};

  // Deduct spend costs
  if (action.spend?.fides) {
    patch.fides = Math.max(0, (patch.fides ?? state.fides) - action.spend.fides);
  }
  if (action.spend?.denarii) {
    patch.denarii = Math.max(0, (patch.denarii ?? state.denarii) - action.spend.denarii);
  }

  const stateAfterCost: GameState = { ...state, ...patch };
  let effectPatch: Partial<GameState> = {};
  let logMsg: string | undefined;

  if (action.successEffect !== undefined || action.failureEffect !== undefined) {
    let success = true;
    if (action.skillCheck) {
      const sc = action.skillCheck;
      const char = sc.characterId === 'player'
        ? state.family.find(c => c.isPlayer)
        : state.family.find(c => c.id === sc.characterId);
      const skillVal = char ? ((char.skills as Record<string, number>)[sc.skill] ?? 0) : 0;
      const roll = Math.floor(Math.random() * 10) + 1;
      success = roll + skillVal >= sc.difficulty;
    }
    const effectStr = success ? (action.successEffect ?? '') : (action.failureEffect ?? '');
    if (effectStr) effectPatch = applyEffectString(effectStr, stateAfterCost);
  } else if (action.effect) {
    const legacyResult = action.effect(stateAfterCost);
    const { logMsg: legacyLog, ...legacyPatch } = legacyResult;
    effectPatch = legacyPatch;
    logMsg = legacyLog;
  }

  patch = { ...patch, ...effectPatch };

  if (action.consequences?.length) {
    const consequencePatch = applyConsequences(action.consequences, { ...state, ...patch }, targetContext);
    patch = { ...patch, ...consequencePatch };
  }

  if (action.isExtreme) {
    const currentCrisis = patch.crisis ?? state.crisis;
    patch = {
      ...patch,
      crisis: { ...currentCrisis, constitution: applyTrackDelta(currentCrisis.constitution, 3) },
    };
  }

  const result: ResolvedActionPatch = { ...patch };
  if (logMsg) result.logMsg = logMsg;
  return result;
}
