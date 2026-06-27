import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import { parseEffect } from '../models/bill';
import { generateClientName } from '../data/clientNames';
import { computeTotalAssetBonuses } from './assetEngine';
import { calcAssetGoldOutput, calcAssetDignitasOutput, calcAssetGratiaOutput } from './provinceEngine';

// ─── Options for applyEffectString ──────────────────────────────────────────

export interface ApplyEffectOptions {
  previewClientName?: string;
  instance?: EventInstance | null;
}

/**
 * Calculate seasonal resource income for the player character.
 * Returns deltas — caller applies them to the store.
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

  // NOTE: gratia_income_base intentionally uses 8 - Math.floor(crisisLevel / 30),
  // not intrigus × 2 − crisis penalty. Do not change this formula.
  const gratia_income_base = Math.max(0, 8 - Math.floor(state.crisisLevel / 30));

  // Public Support clients: each adds +5% of base Gratia income (floored)
  const publicSupportCount = state.clients.filter(c => c.type === 'publicSupport').length;
  const gratiaClientBonus = Math.floor(gratia_income_base * publicSupportCount * 0.05);
  const gratiaIncome = gratia_income_base + gratiaClientBonus;

  // Domus asset passive bonuses (Patrimonium — ownedAssets)
  const assetBonuses = computeTotalAssetBonuses(state.ownedAssets);
  const gravitasAssetBonus = assetBonuses.gravitas ?? 0;
  const dignitasAssetBonus = assetBonuses.dignitas ?? 0;
  const gratiaAssetBonus = assetBonuses.gratia ?? 0;
  const denariiDomusBonus = assetBonuses.gold ?? 0;

  // Province asset passive bonuses — summed across all provinces
  const provinceDenariiBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGoldOutput(p), 0
  );
  const provinceDignitasBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetDignitasOutput(p), 0
  );
  const provinceGratiaBonus = state.provinces.reduce(
    (sum, p) => sum + calcAssetGratiaOutput(p), 0
  );

  return {
    gravitasIncome: gravitasIncome + gravitasAssetBonus,
    dignitasIncome: dignitasIncome + dignitasAssetBonus + provinceDignitasBonus,
    gratiaIncome: gratiaIncome + gratiaAssetBonus + provinceGratiaBonus,
    denariiIncome: denariiDomusBonus + provinceDenariiBonus,
  };
}

/**
 * Apply effect string to state. Returns a partial state update.
 *
 * Effect string format:
 *   - Standard resource effects:  'key+N' or 'key-N', pipe-separated for multiple
 *   - Client effects use a colon: 'addClient:muscle', 'removeClient:votingSway'
 *
 * Client effects return special keys _addClient / _removeClient in the patch.
 * The caller (resolveEvent in gameStore.ts) must handle these separately.
 *
 * The options param is optional — all existing callers that pass only (effectStr, state)
 * remain valid with no changes required.
 */
export function applyEffectString(
  effectStr: string,
  state: GameState,
  options?: ApplyEffectOptions
): Partial<GameState> & { _addClient?: Client; _removeClient?: string } {
  const { previewClientName, instance } = options ?? {};

  // Split on pipe to handle multi-effect strings (e.g. 'gravitas+2|denarii-10')
  const segments = effectStr.split('|').map(s => s.trim()).filter(Boolean);

  const patch: Partial<GameState> & { _addClient?: Client; _removeClient?: string } = {};

  for (const segment of segments) {
    // Client effect: colon-separated, e.g. 'addClient:muscle'
    if (segment.includes(':')) {
      const [key, val] = segment.split(':');

      if (key === 'addClient') {
        const clientType = val as ClientType;
        // Name resolution: caller passes previewClientName for Class A events.
        // Fall back to generating a new name only if no preview name was provided.
        const name = previewClientName ?? generateClientName(clientType, state.clients);
        const newClient: Client = {
          id: `client-${Date.now()}`,
          name,
          type: clientType,
          acquiredTurn: state.turnNumber,
        };
        patch._addClient = newClient;
        continue;
      }

      if (key === 'removeClient') {
        const clientType = val as ClientType;
        // For Class B/C events: instance.clientName is set — remove that specific client.
        // Fallback: remove the oldest client of that type.
        const target = instance?.clientName
          ? state.clients.find(c => c.name === instance.clientName && c.type === clientType)
          : state.clients
              .filter(c => c.type === clientType)
              .sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
        if (target) patch._removeClient = target.id;
        continue;
      }

      // Unknown colon-key — skip silently
      continue;
    }

    // Standard effect: parse via existing parseEffect utility
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
          patch.denarii = Math.max(0, (patch.denarii ?? state.denarii) + delta);
          break;
        case 'crisis':
          patch.crisisLevel = Math.min(
            100,
            Math.max(0, (patch.crisisLevel ?? state.crisisLevel) + delta)
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
            stability: Math.min(
              100,
              Math.max(0, ((patch.rome ?? state.rome).stability) + delta)
            ),
          };
          break;
        case 'plebs':
          patch.rome = {
            ...state.rome,
            ...patch.rome,
            plebs: Math.min(
              100,
              Math.max(0, ((patch.rome ?? state.rome).plebs) + delta)
            ),
          };
          break;
        case 'treasury':
          patch.rome = {
            ...state.rome,
            ...patch.rome,
            treasury: Math.min(
              100,
              Math.max(0, ((patch.rome ?? state.rome).treasury) + delta)
            ),
          };
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
 * Relationship drift on clan leaders — political entropy.
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