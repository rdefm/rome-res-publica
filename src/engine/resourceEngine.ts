import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import { parseEffect } from '../models/bill';
import { generateClientName } from '../data/clientNames';
import { computeTotalAssetBonuses } from './assetEngine';
import { calcAssetGoldOutput } from './provinceEngine';
import { buildClient, computeTotalClientBonuses } from './clientEngine';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';

export interface ApplyEffectOptions {
  previewClientName?: string;
  instance?: EventInstance | null;
}

// ─── Office Fides bonus lookup ────────────────────────────────────────────────
// offices.ts does not carry a fidesBonusPerSeason field, so we maintain
// the lookup here per the spec.

const OFFICE_FIDES_BONUS: Record<string, number> = {
  quaestor: 3,
  aedile:   5,
  praetor:  7,
  consul:   12,
};

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
 *
 * gravitasDelta (stability) and gratiaDelta (plebs) are merged into fidesDelta.
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

export function calcResourceIncome(state: GameState): {
  fidesIncome: number;
  denariiIncome: number;
} {
  const paterfamilias = state.family.find((c) => c.isPlayer);

  // Step 1: Base skill income
  const baseIncome = (paterfamilias?.skills.rhetoric ?? 0) * 2;

  // Step 2: Patron tier multiplier
  const patronMultiplier =
    PATRON_TIER_DEFINITIONS[state.patronTier]?.passiveBonus.fidesMultiplier ?? 1.0;

  // Step 3: Office income
  const officeIncome = state.family
    .filter(c => c.isPlayer && c.officeId)
    .reduce((sum, c) => sum + (OFFICE_FIDES_BONUS[c.officeId!] ?? 0), 0);

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

  // Step 7: Rome stat modifier
  const romeMods = calcRomeStatModifiers(state.rome);
  const romeStatFides = romeMods.fidesDelta;

  // Step 8: Crisis penalty
  const crisisPenalty = Math.floor(state.crisisLevel / 20);

  // Final Fides income
  const fidesIncome = Math.max(0,
    Math.round(baseIncome * patronMultiplier)
    + officeIncome
    + clanFidesIncome
    + clientFides
    + assetFides
    + romeStatFides
    - crisisPenalty
  );

  // Denarii income — assets + province gold output + client gold + treasury mod
  const provinceDenariiBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGoldOutput(p), 0
  );
  const denariiIncome =
    (assetBonuses.gold ?? 0)
    + provinceDenariiBonus
    + (clientBonuses.gold ?? 0)
    + romeMods.denariDelta;

  return { fidesIncome, denariiIncome };
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
    if (segment.includes(':')) {
      const parts = segment.split(':');
      const key = parts[0];

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
      continue;
    }

    // Skill grants
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

    const effects = parseEffect(segment);
    for (const { key, delta } of effects) {
      switch (key) {
        case 'fides':
          patch.fides = Math.max(0, (patch.fides ?? state.fides) + delta);
          break;
        case 'lifetimeDignitas':
          // lifetimeDignitas accumulates and can only decrease on disgrace events — never clamped at 0 in spending
          patch.lifetimeDignitas = Math.max(0, (patch.lifetimeDignitas ?? state.lifetimeDignitas) + delta);
          break;
        case 'denarii':
        case 'gold':
          patch.denarii = Math.max(0, (patch.denarii ?? state.denarii) + delta);
          break;
        case 'crisis':
        case 'crisisLevel':
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

export function applyFactionDrift(state: GameState): { popularesRel: number; optimatesRel: number } {
  return {
    popularesRel: Math.min(100, Math.max(-100, state.popularesRel - 1)),
    optimatesRel: Math.min(100, Math.max(-100, state.optimatesRel - 1)),
  };
}

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

export function calcCrisisEscalation(crisisLevel: number, passedBillCount: number): number {
  const delta = passedBillCount > 0 ? -3 : 8;
  return Math.min(100, Math.max(0, crisisLevel + delta));
}

export function applyRelationshipDrift(state: GameState): GameState['clans'] {
  return state.clans.map((clan) => ({
    ...clan,
    leaders: clan.leaders.map((leader) => {
      let rel = leader.relationship;
      if (rel > 0) rel = Math.max(0, rel - 2);
      else if (rel < 0) rel = Math.min(0, rel + 1);
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
