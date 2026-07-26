// Governor-assignment gap fix's sweep — checkCondition's 'hold_office'/
// 'win_election' cases previously checked Character.officeId, a field only
// ever written by the Tribune path (an ordinary magistracy win only ever
// sets the household-wide currentOffice/campaigningCharacterId pair), and
// separately ignored assignedCharacterId in the currentOffice branch — a
// character-scoped ambition could be satisfied by a DIFFERENT family member
// holding the office. No dedicated test file existed for this engine before.

import { checkCondition } from '../src/engine/ambitionEngine';
import type { GameState } from '../src/state/gameStore';

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    currentOffice: null,
    campaigningCharacterId: null,
    family: [],
    ...overrides,
  } as unknown as GameState;
}

describe('checkCondition — hold_office / win_election', () => {
  test.each(['hold_office', 'win_election'] as const)(
    '%s: family-scoped (no assignedCharacterId) is satisfied by ANY holder of the office',
    (type) => {
      const state = makeState({ currentOffice: 'aedile', campaigningCharacterId: 'son-1' });
      expect(checkCondition({ type, officeId: 'aedile' } as any, state)).toBe(true);
    },
  );

  test.each(['hold_office', 'win_election'] as const)(
    '%s: family-scoped is false when the household holds a different office',
    (type) => {
      const state = makeState({ currentOffice: 'quaestor', campaigningCharacterId: 'son-1' });
      expect(checkCondition({ type, officeId: 'aedile' } as any, state)).toBe(false);
    },
  );

  test.each(['hold_office', 'win_election'] as const)(
    '%s: character-scoped is satisfied only when THIS character holds it',
    (type) => {
      const state = makeState({ currentOffice: 'aedile', campaigningCharacterId: 'son-1' });
      expect(checkCondition({ type, officeId: 'aedile' } as any, state, 'son-1')).toBe(true);
    },
  );

  test.each(['hold_office', 'win_election'] as const)(
    '%s: character-scoped is NOT satisfied when a different family member holds the same office (previously a bug — the currentOffice branch ignored assignedCharacterId)',
    (type) => {
      const state = makeState({ currentOffice: 'aedile', campaigningCharacterId: 'someone-else' });
      expect(checkCondition({ type, officeId: 'aedile' } as any, state, 'son-1')).toBe(false);
    },
  );

  test.each(['hold_office', 'win_election'] as const)(
    '%s: satisfied when the player holds it, character-scoped to the player',
    (type) => {
      const state = makeState({ currentOffice: 'consul', campaigningCharacterId: 'pc-1' });
      expect(checkCondition({ type, officeId: 'consul' } as any, state, 'pc-1')).toBe(true);
    },
  );
});
