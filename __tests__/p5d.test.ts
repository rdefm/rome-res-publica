// ─── Phase 5, Chunk P5-D — cross-cutting flag writes ────────────────────────
// Covers the three D1 flag-write sites that don't live in trialEngine.ts
// (resolveTrialOutcome's own three flags are tested directly in
// trialEngine.test.ts, next to the function they belong to):
//   - gameStore.burnSecret (player-initiated burn)
//   - turnSequencer.ts's NPC self-destructive burn loop, via processSeason
//   - gameStore.enterEndlessMode (endlessMode -> flags mirror)
// All three feed P5-D's new events.ts content (evt-aft-burn-*, evt-end-*).

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';
import { BALANCE } from '../src/data/balance';
import type { Secret } from '../src/models/secret';
import type { Clan, ClanLeader } from '../src/models/clan';

function makeCrisisTrack(id: string, level = 0) {
  return { id, level, tier: 0 as const, namedCrisis: null };
}
const CRISIS_ALL_ZERO = {
  war: makeCrisisTrack('war'), unrest: makeCrisisTrack('unrest'),
  constitution: makeCrisisTrack('constitution'), economy: makeCrisisTrack('economy'),
};

function makeLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
  return {
    id: 'leader-1', name: 'L. Testius', title: 'Senator', emoji: '👤', age: 55,
    sphere: 'Senate', relationship: 20, favour: 0, blackmail: false, bias: 'optimates',
    votes: 10, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  } as ClanLeader;
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'testii', name: 'Gens Testia', gensName: 'Testius', sigil: '🏛️',
    influence: 50, desc: '', leaders: [makeLeader()],
    ...overrides,
  } as Clan;
}

function makeSecret(overrides: Partial<Secret> = {}): Secret {
  return {
    id: 'secret-1', type: 'affair', subject: { kind: 'family', characterId: 'pc-1' },
    holder: 'leader-1', potency: 2, status: 'held', acquiredSeason: 1,
    flavorText: 'a private matter', ...overrides,
  };
}

// ─── gameStore.burnSecret — player-initiated burn ───────────────────────────

function resetStore(overrides: Record<string, any> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    family: [{
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
      skills: { rhetoric: 6, martial: 3, intrigus: 4 }, traits: [], ambition: null,
      relationship: 100, familyTrust: 100, officeId: null, corruptionScore: 0,
      inheritedTraits: [], ambitionIds: [], reputationScores: {},
      formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    }] as any,
    flags: {},
    ...overrides,
  } as any);
}

describe('gameStore.burnSecret — P5-D aftermath flag', () => {
  beforeEach(() => resetStore());

  test('burning a held Secret against a leader sets secret-burned-recently', () => {
    useGameStore.setState({
      clans: [makeClan({ id: 'testii', leaders: [makeLeader({ id: 'leader-1', relationship: 30, votes: 10 })] })],
      secrets: [makeSecret({ id: 'secret-1', holder: 'player', subject: { kind: 'leader', leaderId: 'leader-1' }, status: 'held' })],
    } as any);

    useGameStore.getState().burnSecret('secret-1');

    expect(useGameStore.getState().flags['secret-burned-recently']).toBe(true);
    expect(useGameStore.getState().secrets.find(s => s.id === 'secret-1')?.status).toBe('spent');
  });

  test('a no-op burnSecret call (wrong holder) does not set the flag', () => {
    useGameStore.setState({
      clans: [makeClan()],
      secrets: [makeSecret({ id: 'secret-1', holder: 'leader-1', subject: { kind: 'leader', leaderId: 'leader-1' }, status: 'held' })],
    } as any);

    useGameStore.getState().burnSecret('secret-1'); // holder isn't 'player' -> guard clause returns early

    expect(useGameStore.getState().flags['secret-burned-recently']).toBeUndefined();
  });
});

// ─── gameStore.enterEndlessMode — endlessMode -> flags mirror ──────────────

describe('gameStore.enterEndlessMode — P5-D endless-mode-active flag mirror', () => {
  beforeEach(() => resetStore());

  test('entering Endless mode sets both endlessMode and flags.endless-mode-active', () => {
    useGameStore.getState().enterEndlessMode();
    const s = useGameStore.getState();
    expect(s.endlessMode).toBe(true);
    expect(s.flags['endless-mode-active']).toBe(true);
  });

  test('preserves pre-existing flags rather than replacing them', () => {
    useGameStore.setState({ flags: { 'some-other-flag': true } } as any);
    useGameStore.getState().enterEndlessMode();
    expect(useGameStore.getState().flags['some-other-flag']).toBe(true);
    expect(useGameStore.getState().flags['endless-mode-active']).toBe(true);
  });
});

// ─── turnSequencer.ts's NPC self-destructive burn loop, via processSeason ──

function makeSeasonState(overrides: Record<string, any> = {}) {
  return {
    year: -264, turnNumber: 10, seasonIndex: 0,
    fides: 0, denarii: 300, imperium: 0,
    lifetimeDignitas: 0, lifetimeImperium: 0,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis: CRISIS_ALL_ZERO,
    flags: {},
    family: [{
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
      skills: { rhetoric: 6, martial: 4, intrigus: 5 }, traits: [], ambition: null,
      relationship: 100, familyTrust: 100, officeId: null, corruptionScore: 0,
      inheritedTraits: [], ambitionIds: [], reputationScores: {},
      formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    }],
    bills: [], passedBills: [], clans: [], clients: [], ownedAssets: [], provinces: [],
    pendingEvents: [], tribuneHolder: null, tribuneImmunity: false, tribuneSeasonsServed: 0,
    tribuneHostilityDebt: {}, consulAuthorityActive: false, consulAuthoritySeasonsRemaining: 0,
    npcTribuneActive: false, npcConsul: null, activeCampaignExists: false, familyHasTroops: false,
    anyProvinceHasRoads: false, triumphBillInQueue: false, npcConsulExists: false,
    consultatumUsedThisTerm: false, senatePacked: false, dictatorOverstaySeasons: 0,
    ambitions: [], pendingAmbitionScopes: [], legacyObjectives: [], patronTier: 0, trialQueue: [],
    trials: [], secrets: [], campaigning: null, campaignVotes: {}, electionRivals: [],
    pendingBirthNaming: null, activeLaws: [], log: [], cursusLog: [],
    seasonOverlayVisible: false, seasonOverlayEvents: [], _expandedBill: null, _expandedType: null,
    familyReputations: {}, selectedCharacterId: 'pc-1', expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], wars: [], cadetBranch: null,
    cadetBranchUsed: false, endlessMode: false, pendingSuccession: null, regency: null,
    ...overrides,
  };
}

describe('turnSequencer — NPC self-destructive Secret burn (P5-D aftermath flag)', () => {
  test('a leader burning a held Secret against the family sets secret-burned-recently', () => {
    const leader = makeLeader({
      id: 'leader-1', relationship: BALANCE.secrets.npcAi.npcBurnStandingMax, votes: 10, bias: 'optimates',
    });
    const state = makeSeasonState({
      clans: [makeClan({ id: 'testii', leaders: [leader] })],
      secrets: [makeSecret({
        id: 'secret-1', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' },
        status: 'held', acquiredSeason: 1, lastActedSeason: undefined,
      })],
    });

    const { nextState } = processSeason(state as any);

    expect(nextState.flags['secret-burned-recently']).toBe(true);
    expect(nextState.secrets.find((s: Secret) => s.id === 'secret-1')?.status).toBe('spent');
  });

  test('no eligible Secret to burn leaves the flag unset', () => {
    const leader = makeLeader({ id: 'leader-1', relationship: 50, votes: 10 }); // above burn threshold, no secrets
    const state = makeSeasonState({
      clans: [makeClan({ id: 'testii', leaders: [leader] })],
      secrets: [],
    });

    const { nextState } = processSeason(state as any);

    expect(nextState.flags['secret-burned-recently']).toBeUndefined();
  });
});
