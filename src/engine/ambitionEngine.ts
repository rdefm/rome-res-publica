import type { GameState } from '../state/gameStore';
import type { ActiveAmbition, AmbitionDefinition, AmbitionCondition } from '../models/ambition';
import { AMBITION_DEFINITIONS } from '../data/ambitionDefinitions';

// ─── Definition lookup ────────────────────────────────────────────────────────

export function getAmbitionDefinition(id: string): AmbitionDefinition | undefined {
  return AMBITION_DEFINITIONS.find(d => d.id === id);
}

// ─── Draw random ambitions ────────────────────────────────────────────────────

export function drawAmbitions(
  scope: 'family' | 'character',
  count: number,
  excludeIds: string[]
): AmbitionDefinition[] {
  const pool = AMBITION_DEFINITIONS.filter(
    d => d.scope === scope && !excludeIds.includes(d.id)
  );
  return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

// ─── Condition checker ────────────────────────────────────────────────────────

export function checkCondition(
  condition: AmbitionCondition,
  state: GameState,
  assignedCharacterId?: string
): boolean {
  switch (condition.type) {

    // Governor-assignment gap fix's sweep: m.officeId is only ever written
    // by the Tribune path — an ordinary magistracy win only ever sets the
    // household-wide currentOffice/campaigningCharacterId pair, never
    // officeId, for EITHER the player or a family member. The old
    // `state.currentOffice === condition.officeId) return true` branch also
    // had its own bug: it ignored assignedCharacterId entirely, so a
    // character-scoped ambition could be satisfied by a DIFFERENT family
    // member holding the office. Both conditions now check
    // campaigningCharacterId against assignedCharacterId when one is given
    // (character-scoped), falling back to "does the household hold it at
    // all" only when the ambition is family-scoped (no assignedCharacterId).
    case 'hold_office': {
      if (state.currentOffice !== condition.officeId) return false;
      return !assignedCharacterId || state.campaigningCharacterId === assignedCharacterId;
    }

    case 'win_election': {
      // Same as hold_office for now — resolved at election time
      if (state.currentOffice !== condition.officeId) return false;
      return !assignedCharacterId || state.campaigningCharacterId === assignedCharacterId;
    }

    case 'reach_reputation': {
      if (condition.threshold === undefined) return false;
      // Check if ANY clan meets the threshold (family-scope ambitions)
      return Object.values(state.familyReputations).some(
        score => score >= condition.threshold!
      );
    }

    case 'own_asset': {
      if (!condition.assetId) return false;
      return state.ownedAssets.some(
        a => a.definitionId === condition.assetId &&
          a.currentTier >= (condition.minTier ?? 1)
      );
    }

    case 'accumulate_resource': {
      if (!condition.resource || condition.amount === undefined) return false;
      // Map 'gold' → 'denarii'; otherwise use flat store field
      const key = condition.resource === 'gold' ? 'denarii' : condition.resource;
      const val = (state as any)[key] ?? 0;
      return val >= condition.amount;
    }

    case 'survive_turns': {
      if (condition.turns === undefined) return false;
      const active = state.ambitions.find(
        a => a.assignedCharacterId === assignedCharacterId || !assignedCharacterId
      );
      if (!active) return false;
      return (state.turnNumber - active.turnActivated) >= condition.turns;
    }

    case 'patron_tier_reached': {
      return state.patronTier >= (condition.threshold ?? 1);
    }

    // Stubs for future features
    case 'produce_heir':
    case 'prosecute_rival':
      return false;

    default:
      return false;
  }
}

// ─── Tick ambitions each season ───────────────────────────────────────────────

export function tickAmbitions(
  ambitions: ActiveAmbition[],
  state: GameState
): {
  updatedAmbitions: ActiveAmbition[];
  completed: ActiveAmbition[];
  expired: ActiveAmbition[];
} {
  const completed: ActiveAmbition[] = [];
  const expired: ActiveAmbition[] = [];
  const updatedAmbitions: ActiveAmbition[] = [];

  for (const a of ambitions) {
    if (a.status !== 'active') {
      updatedAmbitions.push(a);
      continue;
    }

    const def = getAmbitionDefinition(a.definitionId);
    if (!def) {
      updatedAmbitions.push(a);
      continue;
    }

    // Check completion
    if (checkCondition(def.completionCondition, state, a.assignedCharacterId)) {
      const done: ActiveAmbition = {
        ...a,
        status: 'completed',
        turnCompleted: state.turnNumber,
      };
      completed.push(done);
      updatedAmbitions.push(done);
      continue;
    }

    // Check expiry
    if (a.turnsRemaining !== undefined) {
      const newRemaining = a.turnsRemaining - 1;
      if (newRemaining <= 0) {
        const ex: ActiveAmbition = { ...a, status: 'expired', turnsRemaining: 0 };
        expired.push(ex);
        updatedAmbitions.push(ex);
      } else {
        updatedAmbitions.push({ ...a, turnsRemaining: newRemaining });
      }
      continue;
    }

    updatedAmbitions.push(a);
  }

  return { updatedAmbitions, completed, expired };
}
