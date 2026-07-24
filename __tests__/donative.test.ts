import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { BALANCE } from '../src/data/balance';

// ─── payDonative store action (Military Overhaul M8) ────────────────────────
// Army-scope (a character's full raisedLegions + veterans), once per year via
// the existing generic `<key>-cooldown` numeric-flags decay pass. Tested
// directly against the Zustand store, matching training.test.ts's pattern.

function makeTroop(overrides: Record<string, any> = {}) {
  return {
    id: 'troop-1', type: 'raised', strength: 8, campaignsSurvived: 0,
    yearsInactive: 0, bondToCommander: 50, musterProvinceId: 'sicilia',
    ...overrides,
  };
}

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    family: [
      {
        id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
        skills: { rhetoric: 6, martial: 3, intrigus: 4 },
        traits: [], ambition: null, relationship: 100, familyTrust: 100,
        officeId: null, corruptionScore: 0,
        inheritedTraits: [], ambitionIds: [], reputationScores: {},
        formalImperium: 0, militaryImperium: 0,
        raisedLegions: [makeTroop({ id: 't1', bondToCommander: 50 }), makeTroop({ id: 't2', bondToCommander: 90 })],
        veterans: [makeTroop({ id: 't3', type: 'veteran', bondToCommander: 60 })],
      },
    ] as any,
    denarii: 1000,
    flags: {},
    log: [],
    ...overrides,
  } as any);
}

describe('payDonative', () => {
  beforeEach(() => resetStore());

  test('grants +15 loyalty (clamped at 100) to every unit, raisedLegions AND veterans', () => {
    useGameStore.getState().payDonative('pc-1');
    const character = useGameStore.getState().family[0];
    const lc = BALANCE.battle.lifecycle;
    expect(character.raisedLegions[0].bondToCommander).toBe(50 + lc.donativeLoyaltyGain);
    expect(character.raisedLegions[1].bondToCommander).toBe(100); // 90 + 15 clamped
    expect(character.veterans[0].bondToCommander).toBe(60 + lc.donativeLoyaltyGain);
  });

  test('costs Denarii per unit across the WHOLE army (3 units here)', () => {
    const before = useGameStore.getState().denarii;
    useGameStore.getState().payDonative('pc-1');
    const after = useGameStore.getState().denarii;
    expect(before - after).toBe(BALANCE.battle.lifecycle.donativeDenariiPerCohort * 3);
  });

  test('sets a once-per-year cooldown flag, blocking a second call the same year', () => {
    useGameStore.getState().payDonative('pc-1');
    const loyaltyAfterFirst = useGameStore.getState().family[0].raisedLegions[0].bondToCommander;

    useGameStore.getState().payDonative('pc-1'); // should no-op — on cooldown
    const state = useGameStore.getState();
    expect(state.family[0].raisedLegions[0].bondToCommander).toBe(loyaltyAfterFirst);
    expect(state.flags['donative-cooldown-pc-1']).toBe(BALANCE.battle.lifecycle.donativeCooldownSeasons);
  });

  test('insufficient Denarii is a no-op', () => {
    resetStore({ denarii: 1 });
    useGameStore.getState().payDonative('pc-1');
    expect(useGameStore.getState().family[0].raisedLegions[0].bondToCommander).toBe(50); // unchanged
    expect(useGameStore.getState().denarii).toBe(1); // unspent
  });

  test('a character with no troops at all is a no-op', () => {
    resetStore({
      family: [
        {
          id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
          skills: { rhetoric: 6, martial: 3, intrigus: 4 },
          traits: [], ambition: null, relationship: 100, familyTrust: 100,
          officeId: null, corruptionScore: 0,
          inheritedTraits: [], ambitionIds: [], reputationScores: {},
          formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
        },
      ] as any,
    });
    const before = useGameStore.getState().denarii;
    expect(() => useGameStore.getState().payDonative('pc-1')).not.toThrow();
    expect(useGameStore.getState().denarii).toBe(before);
  });
});
