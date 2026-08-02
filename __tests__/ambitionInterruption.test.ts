// Ambition rework, ticket 04 — "graceful slot interruption". supersedeAmbition
// and tickAmbitions' character-death guard themselves are unit-tested in
// ambitionEngine.test.ts (ticket 01); this file drives the two real
// interruption paths through the layers a player actually experiences them
// at: the live Zustand store (setAmbition's slot-collision eviction) and the
// full season pipeline (turnSequencer.processSeason's step 13, which is what
// actually calls tickAmbitions for a character who died this season).
import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';
import type { BuildAmbitionInput } from '../src/engine/ambitionEngine';
import type { ActiveAmbition } from '../src/models/ambition';

// ─── setAmbition — slot collision (store level) ────────────────────────────

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    ambitions: [],
    denarii: 0,
    fides: 0,
    lifetimeDignitas: 0,
    log: [],
    ...overrides,
  } as any);
}

function makeOccupant(overrides: Partial<ActiveAmbition> = {}): ActiveAmbition {
  return {
    id: 'occ-1',
    scope: 'family',
    source: 'player',
    title: 'Old Ambition',
    criterion: { id: 'resource_threshold', resource: 'denarii', amount: 200 },
    baseline: { value: 100, turnNumber: 5 },
    status: 'active',
    turnSet: 5,
    deadlineTurn: 30,
    reward: { lifetimeDignitas: 40, fides: 20 },
    failureDignitas: -6,
    refusable: true,
    ...overrides,
  };
}

describe('setAmbition — slot collision evicts the occupant (store level)', () => {
  test('family-scope collision: occupant is superseded, partial reward paid, new ambition set active, and it is logged', () => {
    const occupant = makeOccupant();
    resetStore({ ambitions: [occupant], denarii: 150, fides: 0, lifetimeDignitas: 0, log: [] });

    const newInput: BuildAmbitionInput = {
      scope: 'family',
      source: 'player',
      title: 'New Ambition',
      criterion: { id: 'client_count', amount: 5 },
      deadlineSeasons: 4,
    };
    useGameStore.getState().setAmbition(newInput);

    const state = useGameStore.getState();
    const evicted = state.ambitions.find(a => a.id === 'occ-1')!;
    expect(evicted.status).toBe('superseded');
    expect(evicted.turnResolved).toBe(state.turnNumber);

    // 50% progress ((150-100)/(200-100)) of the frozen { lifetimeDignitas: 40, fides: 20 } reward.
    expect(state.lifetimeDignitas).toBe(20);
    expect(state.fides).toBe(10);
    // failureDignitas must never apply to a supersede.
    expect(state.denarii).toBe(150);

    const fresh = state.ambitions.find(a => a.status === 'active');
    expect(fresh).toBeDefined();
    expect(fresh!.scope).toBe('family');
    expect(fresh!.title).toBe('New Ambition');

    expect(
      state.log.some(e => e.text.includes('superseded') && e.text.includes('Old Ambition')),
    ).toBe(true);
  });

  test('character-scope collision only evicts the occupant assigned to the SAME character', () => {
    const occupantA = makeOccupant({
      id: 'a-1', scope: 'character', assignedCharacterId: 'pc-1',
      title: 'A\'s Ambition',
    });
    const occupantB = makeOccupant({
      id: 'b-1', scope: 'character', assignedCharacterId: 'npc-son',
      title: 'B\'s Ambition',
    });
    resetStore({ ambitions: [occupantA, occupantB], denarii: 150, log: [] });

    const newInput: BuildAmbitionInput = {
      scope: 'character',
      source: 'player',
      title: 'Replace A',
      criterion: { id: 'client_count', amount: 5 },
      assignedCharacterId: 'pc-1',
      deadlineSeasons: 4,
    };
    useGameStore.getState().setAmbition(newInput);

    const state = useGameStore.getState();
    expect(state.ambitions.find(a => a.id === 'a-1')!.status).toBe('superseded');
    // B's ambition, belonging to a different character, is untouched.
    expect(state.ambitions.find(a => a.id === 'b-1')!.status).toBe('active');
  });

  test('0% progress at collision time pays no reward, but still evicts and re-slots', () => {
    const occupant = makeOccupant();
    resetStore({ ambitions: [occupant], denarii: 100, fides: 0, lifetimeDignitas: 0, log: [] });

    useGameStore.getState().setAmbition({
      scope: 'family', source: 'player', title: 'New Ambition',
      criterion: { id: 'client_count', amount: 5 }, deadlineSeasons: 4,
    });

    const state = useGameStore.getState();
    expect(state.ambitions.find(a => a.id === 'occ-1')!.status).toBe('superseded');
    expect(state.lifetimeDignitas).toBe(0);
    expect(state.fides).toBe(0);
  });
});

// ─── tickAmbitions integration via processSeason — character death (turn-sequencer level) ──

// A hand-built minimal season-tick fixture (no clans/bills/cities/trials/
// campaigns) so processSeason resolves deterministically and the only
// dignitas/fides movement this season traces back to the ambition tick under
// test — same "zero out everything else that could move the same numbers"
// idiom as munificenceEngine.test.ts's makeSequencerState.
function makeSequencerState(overrides: Record<string, any> = {}) {
  const crisis = {
    war:          { id: 'war', level: 0, tier: 0, namedCrisis: null },
    unrest:       { id: 'unrest', level: 0, tier: 0, namedCrisis: null },
    constitution: { id: 'constitution', level: 0, tier: 0, namedCrisis: null },
    economy:      { id: 'economy', level: 0, tier: 0, namedCrisis: null },
  };
  return {
    year: -264, turnNumber: 10, seasonIndex: 1, // Summer -> Autumn, no year crossing
    fides: 0, denarii: 300, imperium: 0, lifetimeDignitas: 0, lifetimeImperium: 0,
    lifetimeBattlesWon: 0,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis, flags: {},
    // The character the ambition below is assigned to is deliberately absent
    // from `family` — structurally identical to the state the real pipeline
    // is in immediately after any of the three death paths (natural
    // mortality, battle death, trial execution/exile) have already run this
    // same season, all of which remove the dead character from `family`
    // before step 13 (ambition tick) executes.
    family: [{
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
      skills: { rhetoric: 6, martial: 4, intrigus: 5 }, traits: [], ambition: null,
      relationship: 100, familyTrust: 100, officeId: null, heldOffices: [], corruptionScore: 0,
      inheritedTraits: [], ambitionIds: [], reputationScores: {},
      formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    }],
    bills: [], passedBills: [], clans: [], clients: [], ownedAssets: [], cities: [],
    pendingEvents: [], tribuneHolder: null, tribuneImmunity: false, tribuneSeasonsServed: 0,
    tribuneHostilityDebt: {}, consulAuthorityActive: false, consulAuthoritySeasonsRemaining: 0,
    npcTribuneActive: false, npcConsul: null, activeCampaignExists: false, familyHasTroops: false,
    anyProvinceHasRoads: false, triumphBillInQueue: false, npcConsulExists: false,
    consultatumUsedThisTerm: false, senatePacked: false, dictatorOverstaySeasons: 0,
    ambitions: [], legacyObjectives: [], patronTier: 0, trials: [],
    selectedCharacterId: 'pc-1', expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], campaigning: null, campaignVotes: {},
    electionRivals: [], pendingBirthNaming: null, activeLaws: [], log: [], cursusLog: [],
    seasonOverlayVisible: false, seasonOverlayEvents: [], _expandedBill: null, _expandedType: null,
    familyReputations: {},
    munificenceUsage: {}, endowments: [], grandGamesVoteBonus: 0, grandGamesBonusYearsUntilDecay: 0,
    theatre: { controllers: {}, contested: {}, musteredThisYear: {} },
    ...overrides,
  } as any;
}

describe('processSeason — character-death guard supersedes a character-scope ambition (turn-sequencer level)', () => {
  test('an active character ambition whose assignedCharacterId is no longer in family is superseded, pays a progress-scaled partial reward, and is reported in the season ledger events', () => {
    const ambition: ActiveAmbition = {
      id: 'char-amb-1',
      scope: 'character',
      source: 'player',
      title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      baseline: { value: 0, turnNumber: 10 },
      assignedCharacterId: 'npc-son', // not present in family below
      status: 'active',
      turnSet: 10,
      deadlineTurn: 50,
      reward: { lifetimeDignitas: 40 },
      failureDignitas: -6,
      refusable: true,
    };
    // 2/5 battles won at the moment of interruption -> 40% progress.
    const state = makeSequencerState({ ambitions: [ambition], lifetimeBattlesWon: 2, lifetimeDignitas: 0 });

    const { nextState, events } = processSeason(state);

    const resolved = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'char-amb-1')!;
    expect(resolved.status).toBe('superseded');
    expect(resolved.turnResolved).toBe(nextState.turnNumber);

    expect(nextState.lifetimeDignitas).toBe(16); // round(40 * 0.4)
    expect(events.some(e => e.includes('Ambition superseded') && e.includes('Win Five Battles'))).toBe(true);
  });

  test('the same ambition is left untouched (active, no supersede event) when the assigned character is still alive', () => {
    const ambition: ActiveAmbition = {
      id: 'char-amb-2',
      scope: 'character',
      source: 'player',
      title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      baseline: { value: 0, turnNumber: 10 },
      assignedCharacterId: 'pc-1', // IS present in family below
      status: 'active',
      turnSet: 10,
      deadlineTurn: 50,
      reward: { lifetimeDignitas: 40 },
      failureDignitas: -6,
      refusable: true,
    };
    const state = makeSequencerState({ ambitions: [ambition], lifetimeBattlesWon: 2, lifetimeDignitas: 0 });

    const { nextState, events } = processSeason(state);

    const stillActive = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'char-amb-2')!;
    expect(stillActive.status).toBe('active');
    expect(nextState.lifetimeDignitas).toBe(0);
    expect(events.some(e => e.includes('Ambition superseded'))).toBe(false);
  });
});
