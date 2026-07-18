// Campaign Map plan, Chunk C4 — integration tests for the turnSequencer.ts
// wiring around commandEngine.ts (steps 2d–2f: death lapse, election
// resolution/grants, auto-prorogation). commandElection.test.ts already
// covers resolveCommandElection's pure math exhaustively; this file only
// covers what that can't: state mutations processSeason actually applies
// (Army creation, imperium/war-chest grants, leaderless conversion, notice
// injection, the auto-open timing).

import { processSeason } from '../src/engine/turnSequencer';
import { BALANCE } from '../src/data/balance';
import { REGIONS } from '../src/data/theatreMap';
import type { Character } from '../src/models/character';
import type { Clan, ClanLeader } from '../src/models/clan';
import type { WarState } from '../src/models/war';
import type { Army } from '../src/models/army';
import type { TheatreState } from '../src/models/theatre';
import type { Command, CommandElectionState } from '../src/models/command';
import type { GameState } from '../src/state/gameStore';

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

function makeLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
  return {
    id: 'leader-1', name: 'Leader', title: 'Senator', emoji: '👤', age: 50,
    sphere: 'politics', relationship: 0, favour: 0, blackmail: false, bias: 'optimates',
    votes: 0, bio: '', skills: { rhetoric: 0, martial: 0, intrigus: 0 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  };
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'clan-1', name: 'Clan', gensName: 'Testia', sigil: '🏛', influence: 0,
    desc: '', leaders: [],
    ...overrides,
  };
}

function makeWar(overrides: Partial<WarState> = {}): WarState {
  return {
    id: 'war-carthage', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
    warScore: 0, startedTurn: 1, lastSetPieceTurn: -1, weariness: 0, pendingSetPiece: null,
    treaty: null, phase: 'opening', ignitedYear: -264, endedYear: null, terminalOutcome: null,
    peaceOffered: false, lastFundingOfferTurn: -100,
    ...overrides,
  } as unknown as WarState;
}

function makeTheatre(): TheatreState {
  const controllers = {} as TheatreState['controllers'];
  const musteredThisYear = {} as TheatreState['musteredThisYear'];
  for (const region of REGIONS) {
    controllers[region.id] = region.startingController;
    musteredThisYear[region.id] = 0;
  }
  return { controllers, contested: {} as TheatreState['contested'], musteredThisYear };
}

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'command-1', holderId: 'pc-1', holderOwner: 'player',
    grantedSeason: 1, expiresSeason: 5, battlesWon: 0, battlesLost: 0,
    warChest: 100,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1', name: 'Legion', owner: 'rome_state', commanderId: 'pc-1',
    location: 'latium', stationedCityId: 'latium', units: [],
    stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    ...overrides,
  };
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
    family: [makeCharacter()],
    selectedCharacterId: 'pc-1', trainedThisSeason: [],
    bills: [], _expandedBill: null, _expandedType: null, billIdSeq: 0,
    clans: [], expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], campaigning: null,
    campaigningCharacterId: null, campaignVotes: {}, electionRivals: [], pendingAmbitionScopes: [],
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
    wars: [makeWar()],
    // Campaign Map plan, Chunk C1–C4
    theatre: makeTheatre(),
    armies: [] as Army[],
    activeCommand: null as Command | null,
    commandElection: null as CommandElectionState | null,
  };
  return { ...base, ...overrides } as unknown as GameState;
}

const cmd = BALANCE.campaign.command;

// ─── Fresh vote resolution ──────────────────────────────────────────────────

describe('processSeason — fresh command-election resolution', () => {
  test('player win grants imperium, a state army commanded by the winner, and clears the election', () => {
    const state = makeState({
      turnNumber: 9, // becomes 10 after step 1's advance
      imperium: 5,
      commandElection: {
        active: true, calledSeason: 9, isProrogation: false,
        incumbentWinLossModifier: 0, incumbentIsPlayerCandidate: false, incumbentRivalId: null,
        candidateCharacterId: 'pc-1', rivals: [], votes: {},
      },
    });
    const { nextState } = processSeason(state);
    expect(nextState.commandElection).toBeNull();
    expect(nextState.activeCommand).not.toBeNull();
    expect(nextState.activeCommand!.holderId).toBe('pc-1');
    expect(nextState.activeCommand!.holderOwner).toBe('player');
    expect(nextState.imperium).toBe(5 + cmd.grantImperium);
    const grantedArmy = nextState.armies.find(a => a.commanderId === 'pc-1');
    expect(grantedArmy).toBeTruthy();
    expect(grantedArmy!.owner).toBe('rome_state');
    expect(grantedArmy!.units.length).toBe(cmd.grantStateCohorts);
  });

  test('rival win grants a rome_rival-owned army and does NOT touch player imperium', () => {
    const rivalLeader = { id: 'rival-1', name: 'Gnaeus', emoji: '👤', clanName: 'Rivalia', clanId: 'clan-r', title: 'Senator', bias: 'optimates', baseVotes: 0, clanInfluence: 0, strength: 0, highestOffice: null };
    const state = makeState({
      turnNumber: 9,
      imperium: 5,
      commandElection: {
        active: true, calledSeason: 9, isProrogation: false,
        incumbentWinLossModifier: 0, incumbentIsPlayerCandidate: false, incumbentRivalId: null,
        candidateCharacterId: null, rivals: [rivalLeader], votes: {},
      },
    });
    const { nextState } = processSeason(state);
    expect(nextState.activeCommand?.holderOwner).toBe('rome_rival');
    expect(nextState.activeCommand?.holderId).toBe('rival-1');
    expect(nextState.imperium).toBe(5); // unchanged — grant is player-only
    const grantedArmy = nextState.armies.find(a => a.commanderId === 'rival-1');
    expect(grantedArmy?.owner).toBe('rome_rival');
  });
});

// ─── Prorogation ─────────────────────────────────────────────────────────────

describe('processSeason — prorogation', () => {
  test('auto-opens a prorogation election in the command\'s final season', () => {
    const existing = makeCommand({ expiresSeason: 10 });
    const state = makeState({ turnNumber: 9, activeCommand: existing, clans: [makeClan()] });
    const { nextState } = processSeason(state);
    expect(nextState.turnNumber).toBe(10);
    expect(nextState.commandElection?.active).toBe(true);
    expect(nextState.commandElection?.isProrogation).toBe(true);
    expect(nextState.commandElection?.candidateCharacterId).toBe('pc-1'); // player incumbent auto-stands
  });

  test('does not resolve a prorogation vote opened this same pass (needs a full season first)', () => {
    const existing = makeCommand({ expiresSeason: 10 });
    const state = makeState({ turnNumber: 9, activeCommand: existing, clans: [makeClan()] });
    const { nextState } = processSeason(state);
    // still open, still the SAME command (not yet re-resolved into a top-up or lapse)
    expect(nextState.activeCommand?.id).toBe('command-1');
    expect(nextState.activeCommand?.expiresSeason).toBe(10); // unextended — no top-up applied yet
  });

  test('retained incumbent tops up the war chest and extends the term without a new army/imperium grant', () => {
    const existing = makeCommand({ expiresSeason: 10, warChest: 50 });
    const state = makeState({
      turnNumber: 9,
      imperium: 5,
      activeCommand: existing,
      armies: [makeArmy({ commanderId: 'pc-1' })],
      commandElection: {
        active: true, calledSeason: 9, isProrogation: true,
        incumbentWinLossModifier: 1000, incumbentIsPlayerCandidate: true, incumbentRivalId: null,
        candidateCharacterId: 'pc-1', rivals: [], votes: {},
      },
    });
    const { nextState } = processSeason(state);
    expect(nextState.commandElection).toBeNull();
    expect(nextState.activeCommand?.id).toBe('command-1'); // SAME command, not a fresh grant
    expect(nextState.activeCommand?.warChest).toBe(50 + cmd.prorogationWarChestTopUp);
    expect(nextState.activeCommand?.expiresSeason).toBe(10 + cmd.termSeasons);
    expect(nextState.imperium).toBe(5); // no fresh grant on a top-up
    expect(nextState.armies).toHaveLength(1); // no new army spawned
  });

  test('a lapsed prorogation converts that holder\'s armies to leaderless and clears activeCommand', () => {
    const existing = makeCommand({ expiresSeason: 10 });
    const strongRival = { id: 'rival-1', name: 'Gnaeus', emoji: '👤', clanName: 'Rivalia', clanId: 'clan-r', title: 'Senator', bias: 'optimates', baseVotes: 500, clanInfluence: 100, strength: 500, highestOffice: null };
    const state = makeState({
      turnNumber: 9,
      activeCommand: existing,
      clans: [makeClan({ id: 'clan-r', influence: 100, leaders: [makeLeader({ id: 'rival-1', votes: 500, skills: { rhetoric: 10, martial: 10, intrigus: 10 } })] })],
      armies: [makeArmy({ id: 'a1', commanderId: 'pc-1' }), makeArmy({ id: 'a2', commanderId: 'someone-else' })],
      commandElection: {
        // A hopeless incumbent penalty against a much stronger rival — the
        // incumbent is guaranteed to lose (and per the plan's own "not
        // re-elected = lapses" framing, this is a lapse, not a handover to
        // the rival — see resolveCommandElection's retainedByIncumbent doc).
        active: true, calledSeason: 9, isProrogation: true,
        incumbentWinLossModifier: -1000, incumbentIsPlayerCandidate: true, incumbentRivalId: null,
        candidateCharacterId: 'pc-1', rivals: [strongRival], votes: {},
      },
    });
    const { nextState } = processSeason(state);
    expect(nextState.activeCommand).toBeNull();
    expect(nextState.commandElection).toBeNull();
    expect(nextState.armies.find(a => a.id === 'a1')?.commanderId).toBeNull();
    expect(nextState.armies.find(a => a.id === 'a2')?.commanderId).toBe('someone-else'); // untouched — different commander
    expect(nextState.pendingEvents.some(e => e.defId === 'evt-command-lapsed')).toBe(true);
  });
});

// ─── Death-triggered immediate lapse ────────────────────────────────────────

describe('processSeason — immediate lapse on the holder\'s death', () => {
  test('a player-side holder no longer in family lapses the command immediately', () => {
    const existing = makeCommand({ holderId: 'dead-guy', holderOwner: 'player', expiresSeason: 99 });
    const state = makeState({
      turnNumber: 5,
      activeCommand: existing,
      armies: [makeArmy({ commanderId: 'dead-guy' })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.activeCommand).toBeNull();
    expect(nextState.armies[0].commanderId).toBeNull();
    expect(nextState.pendingEvents.some(e => e.defId === 'evt-command-lapsed-death')).toBe(true);
  });

  test('a rival-side holder still present in clans is unaffected', () => {
    const existing = makeCommand({ holderId: 'rival-1', holderOwner: 'rome_rival', expiresSeason: 99 });
    const state = makeState({
      turnNumber: 5,
      activeCommand: existing,
      clans: [makeClan({ leaders: [makeLeader({ id: 'rival-1' })] })],
      armies: [makeArmy({ commanderId: 'rival-1', owner: 'rome_rival' })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.activeCommand).not.toBeNull();
    expect(nextState.armies[0].commanderId).toBe('rival-1');
  });

  test('a rival-side holder no longer in any clan lapses the command', () => {
    const existing = makeCommand({ holderId: 'gone', holderOwner: 'rome_rival', expiresSeason: 99 });
    const state = makeState({
      turnNumber: 5,
      activeCommand: existing,
      clans: [makeClan()], // no leader with id 'gone'
      armies: [makeArmy({ commanderId: 'gone', owner: 'rome_rival' })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.activeCommand).toBeNull();
    expect(nextState.armies[0].commanderId).toBeNull();
  });
});
