// Tutorial redesign, T8's own follow-up fix — found in a later sweep on a
// sibling branch (claude/fix-governor-assignment): T8's muster/levy
// sanctioning fix correctly stopped checking the always-null
// character.officeId for ordinary magistracies, but its replacement check
// (`character.isPlayer && currentOffice !== null` for raiseTroops, or
// omitting the isPlayer distinction incorrectly for raiseLevy) still had a
// gap — currentOffice is a single household-wide slot that can be held by
// a family member instead of the player, and campaigningCharacterId (not
// isPlayer) is what actually names the holder. These tests cover the two
// gameStore actions T8 touched: raiseTroops (always player-specific — no
// characterId param of its own) and raiseLevy (per-character — any family
// member can raise their own levy).

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { calcLevyCost } from '../src/engine/troopEngine';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('raiseLevy — sanctioning correctly follows the actual officeholder', () => {
  afterEach(() => useGameStore.setState(INITIAL_STATE));

  test('a non-player family member holding the household office is sanctioned when raising THEIR OWN levy', () => {
    useGameStore.getState().startGame('guided');
    const player = useGameStore.getState().family.find(c => c.isPlayer)!;
    useGameStore.setState({
      family: [
        player,
        { ...player, id: 'son-1', name: 'Gaius', isPlayer: false, officeId: null, raisedLegions: [], formalImperium: 0 },
      ],
      currentOffice: 'aedile',
      campaigningCharacterId: 'son-1',
      denarii: 1000,
    });
    const before = useGameStore.getState().denarii;
    useGameStore.getState().raiseLevy('son-1', 'samnium');
    const spent = before - useGameStore.getState().denarii;
    expect(spent).toBe(calcLevyCost(60, useGameStore.getState().crisisLevel, true));
  });

  test('the player is NOT sanctioned when a different family member holds the household office instead', () => {
    useGameStore.getState().startGame('guided');
    const player = useGameStore.getState().family.find(c => c.isPlayer)!;
    useGameStore.setState({
      family: [
        player,
        { ...player, id: 'son-1', name: 'Gaius', isPlayer: false, officeId: null, raisedLegions: [], formalImperium: 0 },
      ],
      currentOffice: 'aedile',
      campaigningCharacterId: 'son-1',
      denarii: 1000,
    });
    const before = useGameStore.getState().denarii;
    useGameStore.getState().raiseLevy(player.id, 'samnium');
    const spent = before - useGameStore.getState().denarii;
    expect(spent).toBe(calcLevyCost(60, useGameStore.getState().crisisLevel, false));
  });
});

describe('raiseTroops — playerHoldsOffice requires the PLAYER specifically to hold the office', () => {
  afterEach(() => useGameStore.setState(INITIAL_STATE));

  test('a family member (not the player) holding the household office does NOT sanction the player\'s own regional muster', () => {
    useGameStore.getState().startGame('guided');
    const player = useGameStore.getState().family.find(c => c.isPlayer)!;
    useGameStore.setState({
      family: [
        player,
        { ...player, id: 'son-1', name: 'Gaius', isPlayer: false, officeId: null },
      ],
      currentOffice: 'aedile',
      campaigningCharacterId: 'son-1', // NOT the player
      imperium: 0, // below imperiumThresholdBase (10) — the imperium fallback also can't sanction this
    });
    useGameStore.getState().raiseTroops('campania', 'standard', null);
    expect(useGameStore.getState().armies.some(a => a.owner === 'player')).toBe(false);
  });

  test('the player holding the household office DOES sanction their own regional muster', () => {
    useGameStore.getState().startGame('guided');
    const player = useGameStore.getState().family.find(c => c.isPlayer)!;
    useGameStore.setState({
      currentOffice: 'aedile',
      campaigningCharacterId: player.id,
      imperium: 0,
    });
    useGameStore.getState().raiseTroops('campania', 'standard', null);
    expect(useGameStore.getState().armies.some(a => a.owner === 'player')).toBe(true);
  });
});
