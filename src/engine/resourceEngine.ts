import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import type { CrisisTrackId } from '../models/crisis';
import { parseEffect } from '../models/bill';
import { generateClientName } from '../data/clientNames';
import { computeTotalAssetBonuses } from './assetEngine';
import { calcAssetGoldOutput, calcAssetFidesOutput } from './provinceEngine';
import { buildClient, computeTotalClientBonuses } from './clientEngine';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';
import {
  getCrisisStatusEffects,
  applyTrackDelta,
} from './crisisEngine';
import { getTierFromLevel } from '../models/crisis';
import { BALANCE } from '../data/balance';

export interface ApplyEffectOptions {
  previewClientName?: string;
  instance?: EventInstance | null;
}

// ─── Rome stat modifiers ──────────────────────────────────────────────────────

export interface RomeStatModifiers {
  fidesDelta: number;
  denariDelta: number;
  crisisEscalationMultiplier: number;
  crisisAbsorption: number;
  plebsCrisisBonus: number;
  patronFavourWaived: boolean;
  stabilityLabel: string;
  plebsLabel: string;
  treasuryLabel: string;
}

/**
 * Compute all passive modifiers from the three Rome stats.
 * Called once per season in calcResourceIncome and turnSequencer.
 */
export function calcRomeStatModifiers(rome: GameState['rome']): RomeStatModifiers {
  const { stability, plebs, treasury } = rome;

  // ── Stability → Fides contribution ────────────────────────────────────────
  let fidesFromStability = 0;
  let crisisMultiplier = 1.0;
  let stabilityLabel = 'Stable';
  if (stability < 20) {
    fidesFromStability = -2;
    crisisMultiplier = 1.5;
    stabilityLabel = 'Instability';
  } else if (stability < 40) {
    fidesFromStability = -1;
    crisisMultiplier = 1.25;
    stabilityLabel = 'Fragile';
  } else if (stability < 70) {
    stabilityLabel = 'Stable';
  } else if (stability < 85) {
    fidesFromStability = +1;
    stabilityLabel = 'Cohesive';
  } else {
    fidesFromStability = +2;
    crisisMultiplier = 0.85;
    stabilityLabel = 'Pax Interna';
  }

  // ── Plebs → Fides contribution ─────────────────────────────────────────────
  let fidesFromPlebs = 0;
  let plebsCrisisBonus = 0;
  let plebsLabel = 'Content';
  if (plebs < 20) {
    fidesFromPlebs = -3;
    plebsCrisisBonus = 3;
    plebsLabel = 'Rioting';
  } else if (plebs < 40) {
    fidesFromPlebs = -1;
    plebsLabel = 'Restless';
  } else if (plebs < 70) {
    plebsLabel = 'Content';
  } else if (plebs < 85) {
    fidesFromPlebs = +1;
    plebsLabel = 'Supportive';
  } else {
    fidesFromPlebs = +2;
    plebsLabel = 'Euphoric';
  }

  // ── Treasury ───────────────────────────────────────────────────────────────
  let denariFromTreasury = 0;
  let crisisAbsorption = 0;
  let treasuryLabel = 'Adequate';
  if (treasury < 10) {
    denariFromTreasury = -3;
    treasuryLabel = 'Bankrupt';
  } else if (treasury < 25) {
    denariFromTreasury = -1;
    treasuryLabel = 'Depleted';
  } else if (treasury < 65) {
    treasuryLabel = 'Adequate';
  } else if (treasury < 85) {
    crisisAbsorption = 1;
    treasuryLabel = 'Flush';
  } else {
    crisisAbsorption = 2;
    treasuryLabel = 'Overflowing';
  }

  return {
    fidesDelta: fidesFromStability + fidesFromPlebs,
    denariDelta: denariFromTreasury,
    crisisEscalationMultiplier: crisisMultiplier,
    crisisAbsorption,
    plebsCrisisBonus,
    patronFavourWaived: plebs >= 85,
    stabilityLabel,
    plebsLabel,
    treasuryLabel,
  };
}

// ─── Resource income ──────────────────────────────────────────────────────────

/**
 * Returns per-season resource income.
 * plebsDelta: additional Plebs change from active unrest status effects.
 *   Wired into state in turnSequencer Chunk 2C. Declared here so the return
 *   type is stable; adding it now doesn't break existing destructuring callers.
 */
export function calcResourceIncome(state: GameState): {
  fidesIncome: number;
  denariiIncome: number;
  plebsDelta: number;
} {
  const paterfamilias = state.family.find((c) => c.isPlayer);

  // Step 1: Base skill income — paterfamilias rhetoric, plus a "household
  // voices" term (P2-C): the highest rhetoric among other family members age
  // ≥ bestOtherRhetoricMinAge. Makes training an heir's rhetoric economically
  // meaningful, not just paterfamilias's.
  const bestOtherRhetoric = state.family
    .filter(c => !c.isPlayer && c.age >= BALANCE.income.bestOtherRhetoricMinAge)
    .reduce((best, c) => Math.max(best, c.skills.rhetoric), 0);
  const baseIncome =
    (paterfamilias?.skills.rhetoric ?? 0) * BALANCE.income.paterfamiliasRhetoricMultiplier
    + bestOtherRhetoric * BALANCE.income.bestOtherRhetoricMultiplier;

  // Step 2: Patron tier multiplier
  const patronMultiplier =
    PATRON_TIER_DEFINITIONS[state.patronTier]?.passiveBonus.fidesMultiplier ?? 1.0;

  // Step 3: Office income
  const officeIncome = state.family
    .filter(c => c.isPlayer && c.officeId)
    .reduce((sum, c) => sum + (BALANCE.income.officeFidesBonus[c.officeId!] ?? 0), 0);

  // Step 4: Clan leader relationship income
  let clanFidesIncome = 0;
  for (const clan of state.clans) {
    for (const leader of clan.leaders) {
      if (leader.relationship >= 60)      clanFidesIncome += 2;
      else if (leader.relationship >= 30) clanFidesIncome += 1;
      else if (leader.relationship < 0)   clanFidesIncome -= 1;
    }
  }

  // Step 5: Client bonuses
  const clientBonuses = computeTotalClientBonuses(state.clients);
  const clientFides = clientBonuses.fides ?? 0;

  // Step 6: Asset bonuses
  const assetBonuses = computeTotalAssetBonuses(state.ownedAssets);
  const assetFides = assetBonuses.fides ?? 0;

  // Step 6b: Province asset Fides bonus (former Gratia/Dignitas asset bonuses, now Fides)
  const provinceFidesBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetFidesOutput(p), 0
  );

  // Step 7: Rome stat modifier
  const romeMods = calcRomeStatModifiers(state.rome);
  const romeStatFides = romeMods.fidesDelta;

  // Step 8: Four-track crisis status effects (replaces old single crisisLevel penalty)
  const statusEffects = getCrisisStatusEffects(state.crisis);
  let crisisFidesDelta = 0;
  let crisisDenariiDelta = 0;
  for (const effect of statusEffects) {
    crisisFidesDelta += effect.fidesDelta;
    crisisDenariiDelta += effect.denariDelta;
  }

  // Step 9: Unrest tier ≥ 2 causes passive Plebs decay (design doc section 2.3)
  // plebsDelta is applied by turnSequencer in Chunk 2C once it reads this field.
  const unrestTier = getTierFromLevel(state.crisis.unrest.level);
  const plebsDelta = unrestTier >= 2 ? -3 : 0;

  // Final Fides income
  const fidesIncome = Math.max(0,
    Math.round(baseIncome * patronMultiplier)
    + officeIncome
    + clanFidesIncome
    + clientFides
    + assetFides
    + provinceFidesBonus
    + romeStatFides
    + crisisFidesDelta   // negative at higher crisis tiers
  );

  // Denarii income — assets + province gold output + client gold + treasury mod + crisis penalty
  const provinceDenariiBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGoldOutput(p), 0
  );
  const denariiIncome =
    (assetBonuses.gold ?? 0)
    + provinceDenariiBonus
    + (clientBonuses.gold ?? 0)
    + romeMods.denariDelta
    + crisisDenariiDelta;  // negative at higher War/Economy tiers

  return { fidesIncome, denariiIncome, plebsDelta };
}

// ─── Training cost (P2-C) ─────────────────────────────────────────────────────
// Shared by gameStore.trainCharacter (validation + apply) and
// CharacterActionModal (cost/disabled-reason display) so the two never drift.

/** Fides cost to train a skill from currentLevel to currentLevel + 1. */
export function calcTrainingCost(currentLevel: number): number {
  return BALANCE.training.fidesCostPerTargetLevel * (currentLevel + 1);
}

// ─── Effect string ────────────────────────────────────────────────────────────

export function applyEffectString(
  effectStr: string,
  state: GameState,
  options?: ApplyEffectOptions
): Partial<GameState> & { _addClient?: Client; _removeClient?: string } {
  const { previewClientName, instance } = options ?? {};
  const segments = effectStr.split('|').map(s => s.trim()).filter(Boolean);
  const patch: Partial<GameState> & { _addClient?: Client; _removeClient?: string } = {};

  for (const segment of segments) {

    // ── Crisis track tokens: crisis-[trackId]±N ────────────────────────────
    // Must be checked before the generic parseEffect path, because the hyphen
    // in e.g. 'crisis-war-5' would confuse parseEffect's sign-split logic.
    const crisisTrackMatch = segment.match(
      /^crisis-(war|unrest|constitution|economy)([+-]\d+)$/
    );
    if (crisisTrackMatch) {
      const trackId = crisisTrackMatch[1] as CrisisTrackId;
      const delta = parseInt(crisisTrackMatch[2], 10);
      const currentCrisis = patch.crisis ?? state.crisis;
      const updatedTrack = applyTrackDelta(currentCrisis[trackId], delta);
      patch.crisis = { ...currentCrisis, [trackId]: updatedTrack };
      continue;
    }

    // ── Colon-delimited special tokens ────────────────────────────────────
    if (segment.includes(':')) {
      const parts = segment.split(':');
      const key = parts[0];

      if (key === 'setFlag') {
        // setFlag:flagKey:value  — value can be true, false, or a number
        const flagKey = parts[1];
        const rawVal  = parts[2];
        const val: boolean | number =
          rawVal === 'true'  ? true  :
          rawVal === 'false' ? false :
          Number(rawVal);
        patch.flags = { ...(patch.flags ?? state.flags), [flagKey]: val };
        continue;
      }

      if (key === 'clearFlag') {
        // clearFlag:flagKey
        const flagKey = parts[1];
        const newFlags = { ...(patch.flags ?? state.flags) };
        delete newFlags[flagKey];
        patch.flags = newFlags;
        continue;
      }

      if (key === 'addClient') {
        if (parts.length >= 4) {
          const [, type, flavourTitle, name] = parts as [string, ClientType, string, string];
          patch._addClient = buildClient(`client-${Date.now()}`, name, type, flavourTitle, 'Joined your household after the events of this season.', state.turnNumber);
        } else {
          const clientType = parts[1] as ClientType;
          const name = previewClientName ?? generateClientName(clientType, state.clients);
          patch._addClient = buildClient(`client-${Date.now()}`, name, clientType, 'Client', 'Met through circumstance.', state.turnNumber);
        }
        continue;
      }

      if (key === 'removeClient') {
        const clientType = parts[1] as ClientType;
        const target = instance?.clientName
          ? state.clients.find(c => c.name === instance.clientName && c.type === clientType)
          : state.clients.filter(c => c.type === clientType).sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
        if (target) patch._removeClient = target.id;
        continue;
      }

      if (key === 'blackmail') {
        const leaderId = parts[1];
        patch.clans = (state.clans ?? []).map(clan => ({
          ...clan,
          leaders: clan.leaders.map(leader =>
            leader.id === leaderId ? { ...leader, blackmail: true } : leader
          ),
        }));
        continue;
      }

      if (key === 'npcDignitas') {
        console.log(`[npcDignitas] ${parts[1]} gains ${parts[2]} Dignitas (no-op)`);
        continue;
      }

      // ── P1-G: leaderRel:[leaderId]:[delta] ─────────────────────────────────
      // Updates relationship on the ClanLeader with the matching id across all clans.
      // Clamped to [−100, 100]. Only new effect token added in Phase 1 (plan §P1-G changelog).
      if (key === 'leaderRel') {
        const leaderId = parts[1];
        const delta    = parseInt(parts[2] ?? '0', 10);
        if (leaderId && !isNaN(delta)) {
          patch.clans = (patch.clans ?? state.clans).map((clan: any) => ({
            ...clan,
            leaders: clan.leaders.map((leader: any) =>
              leader.id === leaderId
                ? { ...leader, relationship: Math.min(100, Math.max(-100, (leader.relationship ?? 0) + delta)) }
                : leader
            ),
          })) as any;
        }
        continue;
      }

      continue;
    }

    // ── Skill grants ──────────────────────────────────────────────────────
    const skillGrantMatch = segment.match(/^(rhetoric|martial|intrigus|martialBonus)([+-]\d+)$/);
    if (skillGrantMatch) {
      const [, skillKey, deltaStr] = skillGrantMatch;
      const delta = parseInt(deltaStr, 10);
      const resolvedKey = skillKey === 'martialBonus' ? 'martial' : skillKey;
      const updatedFamily = (patch.family ?? state.family).map(char => {
        if (skillKey === 'rhetoric') {
          const nonPlayers = (patch.family ?? state.family).filter(c => !c.isPlayer);
          const youngest = nonPlayers.sort((a, b) => a.age - b.age)[0];
          const targetId = youngest?.id ?? state.family.find(c => c.isPlayer)?.id;
          if (char.id !== targetId) return char;
        } else {
          if (!char.isPlayer) return char;
        }
        return {
          ...char,
          skills: {
            ...char.skills,
            [resolvedKey]: Math.max(0, (char.skills[resolvedKey as keyof typeof char.skills] ?? 0) + delta),
          },
        };
      });
      patch.family = updatedFamily;
      continue;
    }

    // ── Standard key±N tokens via parseEffect ─────────────────────────────
    const effects = parseEffect(segment);
    for (const { key, delta } of effects) {
      switch (key) {
        case 'fides':
          patch.fides = Math.max(0, (patch.fides ?? state.fides) + delta);
          break;
        case 'lifetimeDignitas':
          patch.lifetimeDignitas = Math.max(0, (patch.lifetimeDignitas ?? state.lifetimeDignitas) + delta);
          break;
        case 'denarii':
        case 'gold':
          patch.denarii = Math.max(0, (patch.denarii ?? state.denarii) + delta);
          break;
        case 'crisis':
        case 'crisisLevel':
          // Legacy token — updates the backwards-compat scalar field.
          // Migrate callers to 'crisis-[trackId]±N' format in Chunk 2C.
          patch.crisisLevel = Math.min(100, Math.max(0, (patch.crisisLevel ?? state.crisisLevel) + delta));
          break;
        case 'corruption':
          patch.family = (patch.family ?? state.family).map(c =>
            c.isPlayer
              ? { ...c, corruptionScore: Math.min(100, Math.max(0, (c.corruptionScore ?? 0) + delta)) }
              : c
          );
          break;
        case 'popularesRel':
          patch.popularesRel = Math.min(100, Math.max(-100, (patch.popularesRel ?? state.popularesRel) + delta));
          break;
        case 'optimatesRel':
          patch.optimatesRel = Math.min(100, Math.max(-100, (patch.optimatesRel ?? state.optimatesRel) + delta));
          break;
        case 'stability':
          patch.rome = { ...state.rome, ...patch.rome, stability: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).stability) + delta)) };
          break;
        case 'plebs':
          patch.rome = { ...state.rome, ...patch.rome, plebs: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).plebs) + delta)) };
          break;
        case 'treasury':
          patch.rome = { ...state.rome, ...patch.rome, treasury: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).treasury) + delta)) };
          break;
        case 'imperium':
          patch.family = (patch.family ?? state.family).map(c =>
            c.isPlayer
              ? { ...c, imperium: Math.max(0, ((c as any).imperium ?? 0) + delta) }
              : c
          );
          break;
      }
    }
  }
  return patch;
}

// ─── Faction drift ────────────────────────────────────────────────────────────

export function applyFactionDrift(state: GameState): { popularesRel: number; optimatesRel: number } {
  return {
    popularesRel: Math.min(100, Math.max(-100, state.popularesRel - 1)),
    optimatesRel: Math.min(100, Math.max(-100, state.optimatesRel - 1)),
  };
}

// ─── Rome stats ───────────────────────────────────────────────────────────────

export function calcRomeStats(
  state: GameState,
  passedBillCount: number
): Partial<GameState['rome']> {
  const { stability, plebs, treasury } = state.rome;
  const stabilityDelta = passedBillCount > 0 ? 3 : -5;
  const plebsDelta = passedBillCount > 0 ? 2 : -3;
  const crisisDrain = Math.floor(state.crisisLevel / 15) - passedBillCount * 3;
  return {
    stability: Math.min(100, Math.max(0, stability + stabilityDelta - Math.floor(state.crisisLevel / 20))),
    plebs:     Math.min(100, Math.max(0, plebs + plebsDelta)),
    treasury:  Math.min(100, Math.max(0, treasury - crisisDrain)),
  };
}

// ─── Relationship drift ───────────────────────────────────────────────────────

export function applyRelationshipDrift(state: GameState): GameState['clans'] {
  // Constitution-track relationship decay (design doc section 2.3 special effects)
  // constitution-relationship-decay: tier 1–2 adds −1 extra per season
  // constitution-relationship-decay-large: tier 3 adds −2 extra per season
  // tier 4: −3 extra (−1 base + −2 extra)
  const constitutionTier = getTierFromLevel(state.crisis.constitution.level);
  const constitutionExtraDecay =
    constitutionTier >= 4 ? 3 :
    constitutionTier >= 3 ? 2 :
    constitutionTier >= 1 ? 1 :
    0;

  return state.clans.map((clan) => ({
    ...clan,
    leaders: clan.leaders.map((leader) => {
      let rel = leader.relationship;

      // Base drift
      if (rel > 0) rel = Math.max(0, rel - 2);
      else if (rel < 0) rel = Math.min(0, rel + 1);

      // Constitution-track additional decay (applied after base drift)
      if (constitutionExtraDecay > 0) {
        rel = Math.max(0, rel - constitutionExtraDecay);
      }

      let allianceTurns = leader.allianceTurns ?? 0;
      let alliance = leader.alliance ?? false;
      if (allianceTurns > 0) {
        allianceTurns -= 1;
        if (allianceTurns === 0) alliance = false;
      }
      return { ...leader, relationship: rel, alliance, allianceTurns };
    }),
  }));
}
