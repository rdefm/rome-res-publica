// Governor-assignment gap fix — models/city.ts's PendingGovernorAssignment/
// engine/campaignEngine.ts's drawGovernorLot/attemptRigLot were pure
// scaffolding with zero callers: nothing anywhere ever set CityState.playerGovernor
// to a real value for the first time, so a player could never actually become
// governor of an incorporated city. This wires the missing entry point at
// turnSequencer.ts's existing "tick office term" step (Praetor/Consul only —
// the two offices whose own inOfficeActions already reference "governorship"),
// plus a matching fix for declareTribuneCandidate's identical
// officeId-vs-currentOffice bug for non-player family members.

import { processSeason } from '../src/engine/turnSequencer';
import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { Character } from '../src/models/character';
import type { CityState } from '../src/models/city';
import type { GameState } from '../src/state/gameStore';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCrisisTrack(id: string, level: number) {
  return { id, level, tier: 0, namedCrisis: null } as const;
}
const CRISIS_ALL_ZERO = {
  war: makeCrisisTrack('war', 0),
  unrest: makeCrisisTrack('unrest', 0),
  constitution: makeCrisisTrack('constitution', 0),
  economy: makeCrisisTrack('economy', 0),
};

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0,
    raisedLegions: [], veterans: [],
    ...overrides,
  } as unknown as Character;
}

function makeCity(overrides: Partial<CityState> = {}): CityState {
  return {
    id: 'campania', map: 'italy', status: 'incorporated', owner: 'rome',
    relationshipScore: 60, internalStability: 70, infrastructureRating: 50, localSupport: 30,
    playerGovernor: null, playerAmbassador: null, npcRoleHolder: null,
    ownedAssets: [], incorporationBillAvailable: false, warDeclarationAvailable: false,
    revoltActive: false, activeCampaign: null, officerVolunteer: null,
    infraStagnationSeasons: 0, lastInfraScore: 50,
    ...overrides,
  } as unknown as CityState;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    year: -264, turnNumber: 10, seasonIndex: 0,
    fides: 60, denarii: 300, imperium: 0,
    lifetimeDignitas: 20, lifetimeImperium: 60,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis: CRISIS_ALL_ZERO,
    flags: {},
    gensId: 'brutii', gensName: 'Brutius', gensSurname: 'Brutus', gensPlural: 'Brutii',
    family: [makeCharacter()],
    selectedCharacterId: 'pc-1', trainedThisSeason: [],
    bills: [], _expandedBill: null, _expandedType: null, billIdSeq: 0,
    clans: [], expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], campaigning: null,
    campaigningCharacterId: null, campaignVotes: {}, electionRivals: [], pendingAmbitionScopes: [],
    pendingGovernorAssignment: null,
    clients: [], ownedAssets: [], ambitions: [], legacyObjectives: [],
    patronTier: 0, trialQueue: [], familyReputations: {},
    activeLaws: [], passedBills: [],
    pendingEvents: [], activeEvent: null, pendingBirthNaming: null,
    log: [], cursusLog: [],
    seasonOverlayVisible: false, seasonOverlayEvents: [],
    cities: [], senateResponse: null,
    activeCanvassingEvent: null, canvassingEventResult: null,
    pendingCanvassLeaderId: null, pendingCanvassRoll: 0, pendingCanvassThreshold: 0,
    npcConsul: null,
    tribuneHolder: null, tribuneImmunity: false, tribuneSeasonsServed: 0, tribuneHostilityDebt: {},
    lastOfficeActionResult: null,
    consulAuthorityActive: false, consulAuthoritySeasonsRemaining: 0, npcTribuneActive: false,
    activeCampaignExists: false, familyHasTroops: false, anyProvinceHasRoads: false,
    triumphBillInQueue: false, npcConsulExists: false, consultatumUsedThisTerm: false,
    senatePacked: false, dictatorOverstaySeasons: 0,
    wars: [], theatre: undefined, armies: [], activeCommand: null, commandElection: null,
    pendingEngagements: [],
  };
  return { ...base, ...overrides } as unknown as GameState;
}

// ─── turnSequencer.ts — term-end governor assignment ────────────────────────

describe('processSeason — governor assignment at Praetor/Consul term end', () => {
  test('rig guaranteed (flag set) + eligible city → pendingGovernorAssignment awaits player choice, no city assigned yet', () => {
    const state = makeState({
      turnNumber: 9, // becomes 10 after step 1
      currentOffice: 'praetor', officeSeasons: 1, campaigningCharacterId: 'pc-1',
      flags: { 'governorship-rig-guaranteed': true },
      cities: [makeCity()],
    });
    const { nextState } = processSeason(state);
    expect(nextState.currentOffice).toBeNull();
    expect(nextState.pendingGovernorAssignment).toEqual({
      characterId: 'pc-1', characterName: 'Marcus', isPlayerFamily: true, clanId: 'brutii',
      rigAttempted: true, rigSucceeded: true, assignedProvinceId: null,
    });
    expect(nextState.cities[0].playerGovernor).toBeNull();
    expect(nextState.flags['governorship-rig-guaranteed']).toBe(false);
  });

  test('rig not attempted, roll fails → auto-drawn city gets playerGovernor directly, no pending assignment', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.99); // fails attemptRigLot regardless of intrigus; drawGovernorLot picks index 0
    const state = makeState({
      turnNumber: 9,
      currentOffice: 'consul', officeSeasons: 1, campaigningCharacterId: 'pc-1',
      cities: [makeCity({ id: 'campania' })],
    });
    const { nextState } = processSeason(state);
    randomSpy.mockRestore();
    expect(nextState.pendingGovernorAssignment).toBeNull();
    // corruptionAccrued/turnsServed aren't asserted as exactly 0/0 here —
    // tickAllCities (a later, unrelated step in this same processSeason
    // pass) ticks whatever governor is in place by the time it runs,
    // including one this step just assigned moments earlier. That's a
    // pre-existing, correct property of tickAllCities, not something this
    // fix controls.
    expect(nextState.cities[0].playerGovernor?.characterId).toBe('pc-1');
    expect(nextState.cities[0].playerGovernor?.policy).toEqual({
      taxation: 'standard', security: 'light_patrol', development: 'neglect',
    });
  });

  test('no eligible incorporated city → no assignment, no crash', () => {
    const state = makeState({
      turnNumber: 9,
      currentOffice: 'praetor', officeSeasons: 1, campaigningCharacterId: 'pc-1',
      flags: { 'governorship-rig-guaranteed': true },
      cities: [makeCity({ status: 'foreign' })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.pendingGovernorAssignment).toBeNull();
    // Flag is only consumed on the praetor/consul branch when it actually runs
    // through to the eligibility check — still cleared since the office ended.
    expect(nextState.currentOffice).toBeNull();
  });

  test('a non-Praetor/Consul office ending (e.g. Aedile) never triggers a governor assignment', () => {
    const state = makeState({
      turnNumber: 9,
      currentOffice: 'aedile', officeSeasons: 1, campaigningCharacterId: 'pc-1',
      flags: { 'governorship-rig-guaranteed': true },
      cities: [makeCity()],
    });
    const { nextState } = processSeason(state);
    expect(nextState.pendingGovernorAssignment).toBeNull();
    expect(nextState.cities[0].playerGovernor).toBeNull();
    // Not this chunk's concern to clear — the flag is only ever consumed on
    // the praetor/consul branch, so it's still true here (harmless: it just
    // waits for whichever term next ends as praetor/consul).
    expect(nextState.flags['governorship-rig-guaranteed']).toBe(true);
  });

  test('a non-player family member holding Praetor is eligible too, per "any family member" design', () => {
    const state = makeState({
      turnNumber: 9,
      family: [makeCharacter(), makeCharacter({ id: 'son-1', name: 'Gaius', isPlayer: false })],
      currentOffice: 'praetor', officeSeasons: 1, campaigningCharacterId: 'son-1',
      flags: { 'governorship-rig-guaranteed': true },
      cities: [makeCity()],
    });
    const { nextState } = processSeason(state);
    expect(nextState.pendingGovernorAssignment?.characterId).toBe('son-1');
    expect(nextState.pendingGovernorAssignment?.characterName).toBe('Gaius');
  });
});

// ─── gameStore — chooseGovernorship ─────────────────────────────────────────

describe('gameStore.chooseGovernorship', () => {
  afterEach(() => useGameStore.setState(INITIAL_STATE));

  test('assigns the chosen city and clears the pending assignment', () => {
    useGameStore.setState({
      cities: [makeCity({ id: 'campania' }), makeCity({ id: 'etruria' })],
      pendingGovernorAssignment: {
        characterId: 'pc-1', characterName: 'Marcus', isPlayerFamily: true, clanId: 'brutii',
        rigAttempted: true, rigSucceeded: true, assignedProvinceId: null,
      },
    });
    useGameStore.getState().chooseGovernorship('etruria');
    const s = useGameStore.getState();
    expect(s.pendingGovernorAssignment).toBeNull();
    expect(s.cities.find(c => c.id === 'etruria')?.playerGovernor?.characterId).toBe('pc-1');
    expect(s.cities.find(c => c.id === 'campania')?.playerGovernor).toBeNull();
  });

  test('no-ops without a pending assignment', () => {
    useGameStore.setState({ cities: [makeCity({ id: 'campania' })], pendingGovernorAssignment: null });
    useGameStore.getState().chooseGovernorship('campania');
    expect(useGameStore.getState().cities[0].playerGovernor).toBeNull();
  });

  test('no-ops for a city that already has a governor', () => {
    useGameStore.setState({
      cities: [makeCity({ id: 'campania', playerGovernor: { characterId: 'other', policy: { taxation: 'standard', security: 'light_patrol', development: 'neglect' }, corruptionAccrued: 0, turnsServed: 2 } })],
      pendingGovernorAssignment: {
        characterId: 'pc-1', characterName: 'Marcus', isPlayerFamily: true, clanId: 'brutii',
        rigAttempted: true, rigSucceeded: true, assignedProvinceId: null,
      },
    });
    useGameStore.getState().chooseGovernorship('campania');
    const s = useGameStore.getState();
    expect(s.pendingGovernorAssignment).not.toBeNull(); // untouched — invalid choice
    expect(s.cities[0].playerGovernor?.characterId).toBe('other');
  });
});

// ─── gameStore — declareTribuneCandidate's fixed office check ───────────────

describe('gameStore.declareTribuneCandidate', () => {
  afterEach(() => useGameStore.setState(INITIAL_STATE));

  test('blocks a non-player family member who currently holds the household office (previously only checked officeId, which ordinary offices never set)', () => {
    useGameStore.setState({
      family: [
        makeCharacter(),
        makeCharacter({ id: 'son-1', name: 'Gaius', isPlayer: false, officeId: null }),
      ],
      currentOffice: 'aedile', campaigningCharacterId: 'son-1',
      tribuneHolder: null, tribuneCandidateId: null,
    } as any);
    useGameStore.getState().declareTribuneCandidate('son-1');
    expect(useGameStore.getState().tribuneCandidateId).toBeNull();
  });

  test('still allows a family member who holds no office at all', () => {
    useGameStore.setState({
      family: [
        makeCharacter(),
        makeCharacter({ id: 'son-1', name: 'Gaius', isPlayer: false, officeId: null, age: 30 }),
      ],
      currentOffice: null, campaigningCharacterId: null,
      tribuneHolder: null, tribuneCandidateId: null,
    } as any);
    useGameStore.getState().declareTribuneCandidate('son-1');
    expect(useGameStore.getState().tribuneCandidateId).toBe('son-1');
  });
});
