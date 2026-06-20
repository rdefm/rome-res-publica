import type { Character } from '../models/character';
import type { GameState } from '../state/gameStore';
import {
  PERSONALITY_ACTION_WEIGHTS,
  AMBITION_ACTION_WEIGHTS,
  RELATIONSHIP_WEIGHT,
  NOISE_FACTOR,
  type SenateAction,
} from '../data/traits';

/**
 * Score a single action for a character in the current game context.
 */
export function scoreAction(
  character: Character,
  action: SenateAction,
  _context: GameState
): number {
  const relationshipScore =
    (character.relationship / 100) * RELATIONSHIP_WEIGHT * 20;

  const primaryTrait = character.traits[0];
  const personalityScore = primaryTrait
    ? (PERSONALITY_ACTION_WEIGHTS[primaryTrait]?.[action] ?? 0)
    : 0;

  const ambitionScore = character.ambition
    ? (AMBITION_ACTION_WEIGHTS[character.ambition.type]?.[action] ?? 0) *
      character.ambition.priority
    : 0;

  const noise = (Math.random() - 0.5) * NOISE_FACTOR;

  return relationshipScore + personalityScore + ambitionScore + noise;
}

/**
 * Choose the best action for an NPC character from available options.
 */
export function chooseAction(
  character: Character,
  availableActions: SenateAction[],
  context: GameState
): SenateAction {
  return availableActions
    .map((action) => ({ action, score: scoreAction(character, action, context) }))
    .sort((a, b) => b.score - a.score)[0].action;
}

/**
 * Apply NPC family reactions to a player bill action.
 * Returns an updated support value (delta already at 0.4× weight).
 */
export function applyNpcBillReactions(
  currentSupport: number,
  state: GameState
): number {
  const npcs = state.family.filter((c) => !c.isPlayer);
  let supportDelta = 0;

  for (const npc of npcs) {
    const action = chooseAction(npc, ['vote_for', 'vote_against', 'filibuster'], state);
    if (action === 'vote_for') supportDelta += 4 * 0.4;
    else if (action === 'vote_against') supportDelta -= 4 * 0.4;
    // filibuster has no net support change, only affects turnsLeft (not applied here)
  }

  return Math.min(100, Math.max(-100, currentSupport + supportDelta));
}
