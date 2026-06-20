import type { GameState } from '../state/gameStore';
import { parseEffect } from '../models/bill';

/**
 * Calculate seasonal resource income for the player character.
 * Returns deltas — caller applies them to the store.
 */
export function calcResourceIncome(state: GameState): {
  gravitasIncome: number;
  dignitasIncome: number;
  gratiaIncome: number;
} {
  const player = state.family.find((c) => c.isPlayer);
  const rhetoric = player?.skills.rhetoric ?? 0;
  const auctoritas = player?.skills.auctoritas ?? 0;

  const gravitasIncome = Math.max(0, rhetoric * 2 - Math.floor(state.crisisLevel / 20));
  const dignitasIncome = Math.max(
    0,
    auctoritas * 2 - Math.floor(state.crisisLevel / 25) + state.laudatioBonus
  );
  const gratiaIncome = Math.max(0, 8 - Math.floor(state.crisisLevel / 30));

  return { gravitasIncome, dignitasIncome, gratiaIncome };
}

/**
 * Apply bill pass/fail effects to state. Returns a partial state update.
 */
export function applyEffectString(
  effectStr: string,
  state: GameState
): Partial<GameState> {
  const effects = parseEffect(effectStr);
  const patch: Partial<GameState> = {};

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
      case 'crisis':
        patch.crisisLevel = Math.min(
          100,
          Math.max(0, (patch.crisisLevel ?? state.crisisLevel) + delta)
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
