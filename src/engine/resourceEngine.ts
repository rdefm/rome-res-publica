import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import { parseEffect } from '../models/bill';
import { generateClientName } from '../data/clientNames';
import { computeTotalAssetBonuses } from './assetEngine';
import { calcAssetGoldOutput, calcAssetDignitasOutput, calcAssetGratiaOutput } from './provinceEngine';
import { buildClient, computeTotalClientBonuses } from './clientEngine';

// ─── Options for applyEffectString ──────────────────────────────────────────

export interface ApplyEffectOptions {
  previewClientName?: string;
  instance?: EventInstance | null;
}

/**
 * Calculate seasonal resource income for the player character.
 */
export function calcResourceIncome(state: GameState): {
  gravitasIncome: number;
  dignitasIncome: number;
  gratiaIncome: number;
  denariiIncome: number;
} {
  const player = state.family.find((c) => c.isPlayer);
  const rhetoric = player?.skills.rhetoric ?? 0;
  const auctoritas = player?.skills.auctoritas ?? 0;

  const gravitasIncome = Math.max(0, rhetoric * 2 - Math.floor(state.crisisLevel / 20));
  const dignitasIncome = Math.max(
    0,
    auctoritas * 2 - Math.floor(state.crisisLevel / 25) + state.laudatioBonus
  );

  const gratia_income_base = Math.max(0, 8 - Math.floor(state.crisisLevel / 30));

  const publicSupportCount = state.clients.filter(c => c.type === 'publicSupport').length;
  const gratiaClientBonus = Math.floor(gratia_income_base * publicSupportCount * 0.05);
  const gratiaIncome = gratia_income_base + gratiaClientBonus;

  // Domus asset passive bonuses
  const assetBonuses = computeTotalAssetBonuses(state.ownedAssets);
  const gravitasAssetBonus = assetBonuses.gravitas ?? 0;
  const dignitasAssetBonus = assetBonuses.dignitas ?? 0;
  const gratiaAssetBonus = assetBonuses.gratia ?? 0;
  const denariiDomusBonus = assetBonuses.gold ?? 0;

  // Province asset passive bonuses
  const provinceDenariiBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGoldOutput(p), 0
  );
  const provinceDignitasBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetDignitasOutput(p), 0
  );
  const provinceGratiaBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGratiaOutput(p), 0
  );

  // Client bonus income (flat per-season bonuses from individual client rolls)
  const clientBonuses = computeTotalClientBonuses(state.clients);
  const clientGoldBonus     = clientBonuses.gold     ?? 0;
  const clientGratiaBonus   = clientBonuses.gratia   ?? 0;
  const clientDignitasBonus = clientBonuses.dignitas ?? 0;
  const clientGravitasBonus = clientBonuses.gravitas ?? 0;

  return {
    gravitasIncome: gravitasIncome + gravitasAssetBonus + clientGravitasBonus,
    dignitasIncome: dignitasIncome + dignitasAssetBonus + provinceDignitasBonus + clientDignitasBonus,
    gratiaIncome: gratiaIncome + gratiaAssetBonus + provinceGratiaBonus + clientGratiaBonus,
    denariiIncome: denariiDomusBonus + provinceDenariiBonus + clientGoldBonus,
  };
}

/**
 * Apply effect string to state. Returns a partial state update.
 *
 * Supported tokens:
 *   - Standard resources:     'key+N' or 'key-N'
 *   - Client add (old style): 'addClient:TYPE'
 *   - Client add (new style): 'addClient:TYPE:FLAVOUR_TITLE:NAME'
 *   - Client remove:          'removeClient:TYPE'
 *   - Blackmail:              'blackmail:LEADER_ID'  — sets leader.blackmail = true
 *   - Skill grant (player):   'rhetoric+N', 'martial+N', 'auctoritas+N', 'intrigus+N'
 *   - Skill grant (youngest): 'rhetoric+N' (see note in event spec for youngest resolution)
 *   - Martial bonus:          'martialBonus+N'  — increments player martial skill
 *   - NPC dignitas:           'npcDignitas:CLAN_ID:+VALUE'  — no-op, logged only
 */
export function applyEffectString(
  effectStr: string,
  state: GameState,
  options?: ApplyEffectOptions
): Partial<GameState> & { _addClient?: Client; _removeClient?: string } {
  const { previewClientName, instance } = options ?? {};

  const segments = effectStr.split('|').map(s => s.trim()).filter(Boolean);

  const patch: Partial<GameState> & { _addClient?: Client; _removeClient?: string } = {};

  for (const segment of segments) {
    // ── Colon-separated effect tokens ──────────────────────────────────────────
    if (segment.includes(':')) {
      const parts = segment.split(':');
      const key = parts[0];

      if (key === 'addClient') {
        if (parts.length >= 4) {
          // New format: addClient:TYPE:FLAVOUR_TITLE:NAME
          const [, type, flavourTitle, name] = parts as [string, ClientType, string, string];
          const newClient = buildClient(
            `client-${Date.now()}`,
            name,
            type,
            flavourTitle,
            'Joined your household after the events of this season.',
            state.turnNumber,
          );
          patch._addClient = newClient;
        } else {
          // Legacy format: addClient:TYPE (Class A events — name from previewClientName)
          const clientType = parts[1] as ClientType;
          const name = previewClientName ?? generateClientName(clientType, state.clients);
          const newClient = buildClient(
            `client-${Date.now()}`,
            name,
            clientType,
            'Client',                    // generic title for legacy-style acquisition
            'Met through circumstance.',
            state.turnNumber,
          );
          patch._addClient = newClient;
        }
        continue;
      }

      if (key === 'removeClient') {
        const clientType = parts[1] as ClientType;
        const target = instance?.clientName
          ? state.clients.find(c => c.name === instance.clientName && c.type === clientType)
          : state.clients
              .filter(c => c.type === clientType)
              .sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
        if (target) patch._removeClient = target.id;
        continue;
      }

      if (key === 'blackmail') {
        // Set leader.blackmail = true for matching leader across all clans
        const leaderId = parts[1];
        const updatedClans = (state.clans ?? []).map(clan => ({
          ...clan,
          leaders: clan.leaders.map(leader =>
            leader.id === leaderId ? { ...leader, blackmail: true } : leader
          ),
        }));
        patch.clans = updatedClans;
        continue;
      }

      if (key === 'npcDignitas') {
        // No-op — future NPC power tracking hook. Log string is passed through.
        // e.g. npcDignitas:cornelii-clan:+10
        console.log(`[npcDignitas] ${parts[1]} gains ${parts[2]} Dignitas (no-op)`);
        continue;
      }

      // Unknown colon-key — skip
      continue;
    }

    // ── Skill grant tokens ────────────────────────────────────────────────────
    // rhetoric+N, auctoritas+N, martial+N, intrigus+N, martialBonus+N
    const skillGrantMatch = segment.match(/^(rhetoric|auctoritas|martial|intrigus|martialBonus)([+-]\d+)$/);
    if (skillGrantMatch) {
      const [, skillKey, deltaStr] = skillGrantMatch;
      const delta = parseInt(deltaStr, 10);
      const resolvedKey = skillKey === 'martialBonus' ? 'martial' : skillKey;

      // rhetoric+N — applied to youngest non-player family member (spec §10)
      // all others — applied to player character
      const updatedFamily = (patch.family ?? state.family).map(char => {
        if (skillKey === 'rhetoric') {
          // youngest non-player
          const nonPlayers = (patch.family ?? state.family).filter(c => !c.isPlayer);
          const youngest = nonPlayers.sort((a, b) => a.age - b.age)[0];
          const targetId = youngest?.id ?? state.family.find(c => c.isPlayer)?.id;
          if (char.id !== targetId) return char;
        } else {
          // player only
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

    // ── Standard resource effects ─────────────────────────────────────────────
    const effects = parseEffect(segment);

    for (const { key, delta } of effects) {
      switch (key) {
        case 'gravitas':
          patch.gravitas = Math.max(0, (patch.gravitas ?? state.gravitas) + delta);
          break;
        case 'dignitas':
          patch.dignitas = Math.max(0, (patch.dignitas ?? state.dignitas) + delta);
          break;
        case 'gratia':
          patch.gratia = Math.max(0, (patch.gratia ?? state.gratia) + delta);
          break;
        case 'denarii':
        case 'gold':
          patch.denarii = Math.max(0, (patch.denarii ?? state.denarii) + delta);
          break;
        case 'crisis':
          patch.crisisLevel = Math.min(
            100,
            Math.max(0, (patch.crisisLevel ?? state.crisisLevel) + delta)
          );
          break;
        case 'corruption':
          // Increment player corruption score
          patch.family = (patch.family ?? state.family).map(c =>
            c.isPlayer
              ? { ...c, corruptionScore: Math.min(100, Math.max(0, (c.corruptionScore ?? 0) + delta)) }
              : c
          );
          break;
        case 'popularesRel':
          patch.popularesRel = Math.min(
            100,
            Math.max(-100, (patch.popularesRel ?? state.popularesRel) + delta)
          );
          break;
        case 'optimatesRel':
          patch.optimatesRel = Math.min(
            100,
            Math.max(-100, (patch.optimatesRel ?? state.optimatesRel) + delta)
          );
          break;
        case 'stability':
          patch.rome = {
            ...state.rome,
            ...patch.rome,
            stability: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).stability) + delta)),
          };
          break;
        case 'plebs':
          patch.rome = {
            ...state.rome,
            ...patch.rome,
            plebs: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).plebs) + delta)),
          };
          break;
        case 'treasury':
          patch.rome = {
            ...state.rome,
            ...patch.rome,
            treasury: Math.min(100, Math.max(0, ((patch.rome ?? state.rome).treasury) + delta)),
          };
          break;
        case 'imperium':
          // Imperium — stored on player character; no-op if field doesn't exist
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

/**
 * Faction standing drift — applied each season.
 */
export function applyFactionDrift(state: GameState): {
  popularesRel: number;
  optimatesRel: number;
} {
  return {
    popularesRel: Math.min(100, Math.max(-100, state.popularesRel - 1)),
    optimatesRel: Math.min(100, Math.max(-100, state.optimatesRel - 1)),
  };
}

/**
 * Rome stats update — applied each season based on bills passed.
 */
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
    plebs: Math.min(100, Math.max(0, plebs + plebsDelta)),
    treasury: Math.min(100, Math.max(0, treasury - crisisDrain)),
  };
}

/**
 * Crisis escalation — applied each season.
 */
export function calcCrisisEscalation(
  crisisLevel: number,
  passedBillCount: number
): number {
  const delta = passedBillCount > 0 ? -3 : 8;
  return Math.min(100, Math.max(0, crisisLevel + delta));
}

/**
 * Relationship drift on clan leaders.
 */
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
