// Ambition rework, ticket 03 — `bill_passed` criterion. Per-criterion
// checker/measure/progress unit coverage lives in ambitionEngine.test.ts
// alongside the other eight; this file covers the one piece that lives
// outside ambitionEngine.ts — turnSequencer.ts's passive bill-resolution
// step (4) incrementing GameState.lifetimeBillsPassedVotedFor only for a
// bill that actually resolved `playerVote === 'vote_for'` — driven through
// the real season pipeline (processSeason), plus the criterion's full
// met/failed lifecycle through the SAME pipeline (step 13's tickAmbitions
// call runs after step 4, off the season's already-updated counter).
import { processSeason } from '../src/engine/turnSequencer';
import type { Bill } from '../src/models/bill';
import type { ActiveAmbition } from '../src/models/ambition';

const CRISIS_ALL_ZERO = {
  war:          { id: 'war', level: 0, tier: 0, namedCrisis: null },
  unrest:       { id: 'unrest', level: 0, tier: 0, namedCrisis: null },
  constitution: { id: 'constitution', level: 0, tier: 0, namedCrisis: null },
  economy:      { id: 'economy', level: 0, tier: 0, namedCrisis: null },
} as const;

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'b-1', name: 'Test Bill', desc: '', support: 50, turnsLeft: 2,
    passEffect: '', failEffect: '',
    ...overrides,
  };
}

// Mirrors ambitionNarrativeHooks.test.ts's makeSequencerState, but with
// `tutorial: { activeArc: null }` (NOT 'prologue') — the prologue policy
// freezes passiveBills (tutorialEngine.ts's isWorldCategoryFrozen), which
// would make step 4 skip bill resolution entirely and defeat every test
// in this file.
function makeSequencerState(overrides: Record<string, any> = {}) {
  return {
    year: -264, turnNumber: 10, seasonIndex: 1, // Summer -> Autumn, no year crossing
    fides: 0, denarii: 300, imperium: 0, lifetimeDignitas: 0, lifetimeImperium: 0,
    lifetimeBattlesWon: 0, lifetimeBillsPassedVotedFor: 0,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis: CRISIS_ALL_ZERO, flags: {},
    tutorial: { activeArc: null },
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

describe('processSeason — lifetimeBillsPassedVotedFor (ticket 03)', () => {
  test('increments when a bill the player voted for passes', () => {
    const state = makeSequencerState({
      bills: [makeBill({ playerVote: 'vote_for' })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.lifetimeBillsPassedVotedFor).toBe(1);
    expect(nextState.passedBills.some((b: any) => b.id === 'b-1')).toBe(true);
  });

  test('does NOT increment when the passing bill was voted against', () => {
    const state = makeSequencerState({
      bills: [makeBill({ playerVote: 'vote_against' })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.lifetimeBillsPassedVotedFor).toBe(0);
    // The bill still passes — the counter is specifically about the
    // player's own vote, not whether the bill passed at all.
    expect(nextState.passedBills.some((b: any) => b.id === 'b-1')).toBe(true);
  });

  test('does NOT increment for a bill the player never voted on', () => {
    const state = makeSequencerState({
      bills: [makeBill()], // no playerVote
    });
    const { nextState } = processSeason(state);
    expect(nextState.lifetimeBillsPassedVotedFor).toBe(0);
  });

  test('does NOT increment for a bill voted for that fails to pass', () => {
    const state = makeSequencerState({
      bills: [makeBill({ playerVote: 'vote_for', support: -50, turnsLeft: 1 })],
    });
    const { nextState } = processSeason(state);
    expect(nextState.lifetimeBillsPassedVotedFor).toBe(0);
  });

  test('accumulates across multiple qualifying bills passing in the same season', () => {
    const state = makeSequencerState({
      bills: [
        makeBill({ id: 'b-1', playerVote: 'vote_for' }),
        makeBill({ id: 'b-2', name: 'Second Bill', playerVote: 'vote_for' }),
        makeBill({ id: 'b-3', name: 'Third Bill', playerVote: 'vote_against' }),
      ],
    });
    const { nextState } = processSeason(state);
    expect(nextState.lifetimeBillsPassedVotedFor).toBe(2);
  });
});

describe('processSeason — bill_passed ambition, full lifecycle (ticket 03)', () => {
  function makeBillPassedAmbition(overrides: Partial<ActiveAmbition> = {}): ActiveAmbition {
    return {
      id: 'amb-1', scope: 'family', source: 'player', title: 'Pass 1 Bill You Voted For',
      criterion: { id: 'bill_passed', amount: 1 },
      baseline: { value: 0, turnNumber: 10 },
      status: 'active', turnSet: 10, deadlineTurn: 20,
      reward: { lifetimeDignitas: 25, fides: 10 }, failureDignitas: -7, refusable: true,
      ...overrides,
    };
  }

  test('met path: a qualifying bill passing the same season resolves the ambition completed', () => {
    const ambition = makeBillPassedAmbition();
    const withAmbition = makeSequencerState({
      ambitions: [ambition],
      bills: [makeBill({ playerVote: 'vote_for' })],
    });
    // Control run (same bill, no ambition) isolates the reward's own fides
    // delta from the season's ordinary passive fides income — both states
    // otherwise resolve the identical bill the identical way.
    const control = makeSequencerState({
      ambitions: [],
      bills: [makeBill({ playerVote: 'vote_for' })],
    });

    const { nextState } = processSeason(withAmbition);
    const { nextState: controlNext } = processSeason(control);

    const resolved = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'amb-1')!;
    expect(resolved.status).toBe('completed');
    expect(nextState.lifetimeDignitas).toBe(25);
    expect(nextState.fides - controlNext.fides).toBe(10);
  });

  test('failed path: deadline passes with no qualifying bill — capped Dignitas ding applied, no reward', () => {
    const ambition = makeBillPassedAmbition({ deadlineTurn: 11 });
    const state = makeSequencerState({
      turnNumber: 10, // processSeason advances to 11, hitting the deadline
      lifetimeDignitas: 20, // nonzero so the Math.max(0, ...) floor doesn't mask the ding
      ambitions: [ambition],
      bills: [makeBill({ playerVote: 'vote_against' })], // passes, but doesn't count
    });
    const { nextState } = processSeason(state);

    const resolved = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'amb-1')!;
    expect(resolved.status).toBe('failed');
    expect(nextState.lifetimeDignitas).toBe(13);
  });
});
