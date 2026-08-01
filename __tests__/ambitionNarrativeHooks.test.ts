// Ambition rework, ticket 05 — "narrative hooks: direct-write and
// offer-then-accept effect tokens". Covers the two new resourceEngine
// effect-string tokens (setAmbition:/offerAmbition:), the store's
// offerAmbition/acceptStoryAmbition/refuseStoryAmbition actions, and
// turnSequencer's onCompleteEventId/onFailEventId follow-up firing.
// checkCriterion/measureCriterion/buildAmbition/supersedeAmbition themselves
// are already covered in ambitionEngine.test.ts (ticket 01) — this file only
// exercises the new layers ticket 05 adds on top.

import { applyEffectString } from '../src/engine/resourceEngine';
import { processSeason } from '../src/engine/turnSequencer';
import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';
import type { ActiveAmbition, AmbitionOffer } from '../src/models/ambition';

// ─── Shared fixture ─────────────────────────────────────────────────────────

const CRISIS_ALL_ZERO = {
  war:          { id: 'war', level: 0, tier: 0, namedCrisis: null },
  unrest:       { id: 'unrest', level: 0, tier: 0, namedCrisis: null },
  constitution: { id: 'constitution', level: 0, tier: 0, namedCrisis: null },
  economy:      { id: 'economy', level: 0, tier: 0, namedCrisis: null },
} as const;

function makeState(overrides: Record<string, any> = {}): GameState {
  return {
    year: -264,
    turnNumber: 10,
    seasonIndex: 1,
    fides: 30,
    denarii: 200,
    imperium: 0,
    lifetimeDignitas: 0,
    popularesRel: 0,
    optimatesRel: 0,
    rome: { stability: 50, plebs: 50, treasury: 50 },
    crisisLevel: 0,
    crisis: CRISIS_ALL_ZERO,
    flags: {},
    family: [
      {
        id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
        skills: { rhetoric: 6, martial: 3, intrigus: 4 }, traits: [], ambition: null,
        relationship: 100, familyTrust: 100, officeId: null, heldOffices: [], corruptionScore: 0,
        inheritedTraits: [], ambitionIds: [], reputationScores: {},
      },
    ],
    bills: [], clans: [], clients: [], ownedAssets: [],
    ambitions: [], pendingAmbitionOffers: {}, legacyObjectives: [],
    patronTier: 0, trials: [],
    selectedCharacterId: 'pc-1', expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], campaigning: null, campaignVotes: {},
    electionRivals: [], cities: [], pendingEvents: [], activeEvent: null,
    log: [], cursusLog: [], seasonOverlayVisible: false, seasonOverlayEvents: [],
    _expandedBill: null, _expandedType: null,
    familyReputations: {},
    theatre: { controllers: {}, contested: {}, musteredThisYear: {} },
    lifetimeBattlesWon: 0,
    ...overrides,
  } as unknown as GameState;
}

function makeOccupant(overrides: Partial<ActiveAmbition> = {}): ActiveAmbition {
  return {
    id: 'occ-1',
    scope: 'family',
    source: 'player',
    title: 'Old Ambition',
    criterion: { id: 'client_count', amount: 10 },
    baseline: { value: 0, turnNumber: 5 },
    status: 'active',
    turnSet: 5,
    deadlineTurn: 30,
    reward: { lifetimeDignitas: 40, fides: 20 },
    failureDignitas: -6,
    refusable: true,
    ...overrides,
  };
}

// ─── applyEffectString — setAmbition: token ────────────────────────────────

describe('applyEffectString — setAmbition: token (direct-write, ticket 05)', () => {
  test('writes a new ActiveAmbition into an empty family slot, source "story", refusable false by default', () => {
    const state = makeState({ clients: [] });
    const patch = applyEffectString('setAmbition:family:client_count:5:4', state);

    expect(patch.ambitions).toHaveLength(1);
    const a = patch.ambitions![0];
    expect(a.scope).toBe('family');
    expect(a.source).toBe('story');
    expect(a.criterion).toEqual({ id: 'client_count', amount: 5 });
    expect(a.deadlineTurn).toBe(state.turnNumber + 4);
    expect(a.refusable).toBe(false);
    expect(a.status).toBe('active');
  });

  test('the :refusable suffix makes the direct-written ambition abandonable', () => {
    const state = makeState();
    const patch = applyEffectString('setAmbition:family:client_count:5:4:refusable', state);
    expect(patch.ambitions![0].refusable).toBe(true);
  });

  test('character scope infers assignedCharacterId as the player character', () => {
    const state = makeState();
    const patch = applyEffectString('setAmbition:character:battles_won:3:6', state);
    expect(patch.ambitions![0].scope).toBe('character');
    expect(patch.ambitions![0].assignedCharacterId).toBe('pc-1');
  });

  test('onComplete/onFail trailing flags are parsed onto the new ambition', () => {
    const state = makeState();
    const patch = applyEffectString(
      'setAmbition:family:client_count:5:4:onComplete:evt-goal-won:onFail:evt-goal-lost',
      state,
    );
    expect(patch.ambitions![0].onCompleteEventId).toBe('evt-goal-won');
    expect(patch.ambitions![0].onFailEventId).toBe('evt-goal-lost');
  });

  test('resource_threshold parses its comma-compound target (resource,amount)', () => {
    const state = makeState();
    const patch = applyEffectString('setAmbition:family:resource_threshold:denarii,500:8', state);
    expect(patch.ambitions![0].criterion).toEqual({ id: 'resource_threshold', resource: 'denarii', amount: 500 });
  });

  test('office_held parses a bare officeId target and prices via the office baseline (spec §2.3)', () => {
    const state = makeState();
    const patch = applyEffectString('setAmbition:family:office_held:consul:8', state);
    const a = patch.ambitions![0];
    expect(a.criterion).toEqual({ id: 'office_held', officeId: 'consul' });
    // BALANCE.ambitions.officeBaseline.consul = 60, no first-time multiplier
    // applies here since heldOffices is empty on both family and character —
    // this test only asserts a title/criterion round-trip, not the full
    // reward formula (already covered by ambitionEngine.test.ts).
    expect(a.reward.lifetimeDignitas).toBeGreaterThan(0);
  });

  test('force-evicts an occupied slot: occupant is superseded, partial reward paid, no failureDignitas, new ambition installed', () => {
    const occupant = makeOccupant({ baseline: { value: 0, turnNumber: 5 } });
    const state = makeState({
      ambitions: [occupant], denarii: 200, fides: 30, lifetimeDignitas: 0,
      clients: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }, { id: 'c5' }],
    });
    // occupant target is client_count:10 from baseline 0 -> 5/10 = 50% progress.

    const patch = applyEffectString('setAmbition:family:battles_won:2:4', state);

    const evicted = patch.ambitions!.find(a => a.id === 'occ-1')!;
    expect(evicted.status).toBe('superseded');
    expect(evicted.turnResolved).toBe(state.turnNumber);
    // applyAmbitionReward returns absolute post-add totals (same convention
    // as gameStore.setAmbition's own use of it), not bare deltas.
    expect(patch.lifetimeDignitas).toBe(0 + 20);  // round(40 * 0.5) added to base 0
    expect(patch.fides).toBe(30 + 10);            // round(20 * 0.5) added to base 30
    expect(patch.denarii).toBe(200);              // reward carried no denarii component — unchanged

    const fresh = patch.ambitions!.find(a => a.status === 'active');
    expect(fresh).toBeDefined();
    expect(fresh!.criterion).toEqual({ id: 'battles_won', amount: 2 });
  });

  test('a direct-write also clears a stale pending offer reserving the same slot', () => {
    const offer: AmbitionOffer = {
      id: 'offer-1', scope: 'family', title: 'A staged offer',
      criterion: { id: 'client_count', amount: 5 }, deadlineSeasons: 4, turnOffered: 8,
    };
    const state = makeState({ pendingAmbitionOffers: { family: offer } });

    const patch = applyEffectString('setAmbition:family:battles_won:2:4', state);

    expect(patch.pendingAmbitionOffers!.family).toBeUndefined();
    expect(patch.ambitions).toHaveLength(1);
  });
});

// ─── applyEffectString — offerAmbition: token ──────────────────────────────

describe('applyEffectString — offerAmbition: token (offer-then-accept, ticket 05)', () => {
  test('stages an AmbitionOffer into pendingAmbitionOffers[scope], not an ActiveAmbition', () => {
    const state = makeState();
    const patch = applyEffectString('offerAmbition:family:client_count:5:4', state);

    expect(patch.ambitions).toBeUndefined();
    const offer = patch.pendingAmbitionOffers!.family!;
    expect(offer.scope).toBe('family');
    expect(offer.criterion).toEqual({ id: 'client_count', amount: 5 });
    expect(offer.deadlineSeasons).toBe(4);
    expect(offer.turnOffered).toBe(state.turnNumber);
  });

  test('character-scope offer infers assignedCharacterId as the player character', () => {
    const state = makeState();
    const patch = applyEffectString('offerAmbition:character:battles_won:3:6', state);
    expect(patch.pendingAmbitionOffers!.character!.assignedCharacterId).toBe('pc-1');
  });

  test('onComplete/onFail trailing flags carry onto the staged offer', () => {
    const state = makeState();
    const patch = applyEffectString(
      'offerAmbition:family:client_count:5:4:onComplete:evt-goal-won:onFail:evt-goal-lost',
      state,
    );
    const offer = patch.pendingAmbitionOffers!.family!;
    expect(offer.onCompleteEventId).toBe('evt-goal-won');
    expect(offer.onFailEventId).toBe('evt-goal-lost');
  });

  test('is a no-op against a slot an ActiveAmbition already occupies — never masks a live ambition behind an offer card', () => {
    const occupant = makeOccupant();
    const state = makeState({ ambitions: [occupant] });

    const patch = applyEffectString('offerAmbition:family:battles_won:3:6', state);

    expect(patch.pendingAmbitionOffers).toBeUndefined();
    expect(patch.ambitions).toBeUndefined();
  });
});

// ─── gameStore — offerAmbition / acceptStoryAmbition / refuseStoryAmbition ─

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    ambitions: [],
    pendingAmbitionOffers: {},
    denarii: 0,
    fides: 0,
    lifetimeDignitas: 0,
    log: [],
    ...overrides,
  } as any);
}

describe('gameStore.offerAmbition (ticket 05)', () => {
  test('stages an offer and logs it, without touching ambitions', () => {
    resetStore();
    useGameStore.getState().offerAmbition({
      scope: 'family',
      title: 'Win Three Battles',
      criterion: { id: 'battles_won', amount: 3 },
      deadlineSeasons: 6,
    });

    const state = useGameStore.getState();
    expect(state.ambitions).toHaveLength(0);
    expect(state.pendingAmbitionOffers.family?.title).toBe('Win Three Battles');
    expect(state.log.some(e => e.text.includes('Ambition offered') && e.text.includes('Win Three Battles'))).toBe(true);
  });

  test('is a no-op against a slot an ActiveAmbition already occupies', () => {
    const occupant = makeOccupant();
    resetStore({ ambitions: [occupant] });

    useGameStore.getState().offerAmbition({
      scope: 'family',
      title: 'Win Three Battles',
      criterion: { id: 'battles_won', amount: 3 },
      deadlineSeasons: 6,
    });

    const state = useGameStore.getState();
    expect(state.pendingAmbitionOffers.family).toBeUndefined();
    expect(state.ambitions).toEqual([occupant]);
  });
});

describe('gameStore.acceptStoryAmbition (ticket 05)', () => {
  test('converts the offer into a real ActiveAmbition, snapshotting baseline/reward at ACCEPT time (not offer time), always refusable, and clearing the offer', () => {
    resetStore({ lifetimeBattlesWon: 0 } as any);
    useGameStore.getState().offerAmbition({
      scope: 'character',
      assignedCharacterId: 'pc-1',
      title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      deadlineSeasons: 8,
    });

    // Progress the measured value BEFORE accepting — proves baseline is
    // captured at accept time, not offer time.
    useGameStore.setState({ lifetimeBattlesWon: 2 } as any);

    const offerId = useGameStore.getState().pendingAmbitionOffers.character!.id;
    useGameStore.getState().acceptStoryAmbition(offerId);

    const state = useGameStore.getState();
    expect(state.pendingAmbitionOffers.character).toBeUndefined();
    const accepted = state.ambitions.find(a => a.title === 'Win Five Battles')!;
    expect(accepted).toBeDefined();
    expect(accepted.source).toBe('story');
    expect(accepted.status).toBe('active');
    expect(accepted.refusable).toBe(true);
    expect(accepted.baseline.value).toBe(2); // captured at accept time, not 0 (offer time)
    expect(accepted.assignedCharacterId).toBe('pc-1');
  });

  test('carries onCompleteEventId/onFailEventId from the offer onto the accepted ambition', () => {
    resetStore();
    useGameStore.getState().offerAmbition({
      scope: 'family',
      title: 'Take Latium',
      criterion: { id: 'region_control', regionId: 'latium' as any },
      deadlineSeasons: 4,
      onCompleteEventId: 'evt-triumph',
      onFailEventId: 'evt-shame',
    });
    const offerId = useGameStore.getState().pendingAmbitionOffers.family!.id;
    useGameStore.getState().acceptStoryAmbition(offerId);

    const accepted = useGameStore.getState().ambitions.find(a => a.title === 'Take Latium')!;
    expect(accepted.onCompleteEventId).toBe('evt-triumph');
    expect(accepted.onFailEventId).toBe('evt-shame');
  });

  test('an unknown offerId is a no-op', () => {
    resetStore();
    useGameStore.getState().acceptStoryAmbition('does-not-exist');
    expect(useGameStore.getState().ambitions).toHaveLength(0);
  });
});

describe('gameStore.refuseStoryAmbition (ticket 05)', () => {
  test('discards the offer and frees the slot with no reward/penalty', () => {
    resetStore({ denarii: 100, fides: 50, lifetimeDignitas: 10 } as any);
    useGameStore.getState().offerAmbition({
      scope: 'family',
      title: 'Win Three Battles',
      criterion: { id: 'battles_won', amount: 3 },
      deadlineSeasons: 6,
    });
    const offerId = useGameStore.getState().pendingAmbitionOffers.family!.id;

    useGameStore.getState().refuseStoryAmbition(offerId);

    const state = useGameStore.getState();
    expect(state.pendingAmbitionOffers.family).toBeUndefined();
    expect(state.ambitions).toHaveLength(0);
    expect(state.denarii).toBe(100);
    expect(state.fides).toBe(50);
    expect(state.lifetimeDignitas).toBe(10);
    expect(state.log.some(e => e.text.includes('offer refused'))).toBe(true);
  });
});

// ─── turnSequencer — onCompleteEventId/onFailEventId follow-up (ticket 05) ─

function makeSequencerState(overrides: Record<string, any> = {}) {
  return {
    year: -264, turnNumber: 10, seasonIndex: 1, // Summer -> Autumn, no year crossing
    fides: 0, denarii: 300, imperium: 0, lifetimeDignitas: 0, lifetimeImperium: 0,
    lifetimeBattlesWon: 0,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis: CRISIS_ALL_ZERO, flags: {},
    // isWorldFrozen(s) (tutorialEngine.ts) short-circuits turnSequencer step
    // 12's "pick and inject one end-of-season event" entirely — both the
    // unconditional evt-messana-appeal force-injection AND the normal random
    // draw. The ambition tick itself (step 13) carries no such guard, so
    // this only silences an unrelated pipeline step that would otherwise
    // inject a second, nondeterministic event alongside whatever this test
    // is actually checking pendingEvents for.
    tutorial: { activeArc: 'prologue' },
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

describe('processSeason — ambition onCompleteEventId/onFailEventId narrative follow-up (ticket 05)', () => {
  test('a completed ambition with onCompleteEventId queues the follow-up event', () => {
    const ambition: ActiveAmbition = {
      id: 'amb-1', scope: 'family', source: 'story', title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      baseline: { value: 0, turnNumber: 10 },
      status: 'active', turnSet: 10, deadlineTurn: 50,
      reward: { lifetimeDignitas: 40 }, failureDignitas: -6, refusable: false,
      onCompleteEventId: 'evt-triumph',
    };
    const state = makeSequencerState({ ambitions: [ambition], lifetimeBattlesWon: 5 });

    const { nextState } = processSeason(state);

    const resolved = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'amb-1')!;
    expect(resolved.status).toBe('completed');
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-triumph' && e.targetCharacterId === 'pc-1')).toBe(true);
  });

  test('a deadline-failed ambition with onFailEventId queues the follow-up event', () => {
    const ambition: ActiveAmbition = {
      id: 'amb-2', scope: 'family', source: 'story', title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      baseline: { value: 0, turnNumber: 5 },
      status: 'active', turnSet: 5, deadlineTurn: 10,
      reward: { lifetimeDignitas: 40 }, failureDignitas: -6, refusable: false,
      onFailEventId: 'evt-shame',
    };
    const state = makeSequencerState({ ambitions: [ambition], lifetimeBattlesWon: 0 });

    const { nextState } = processSeason(state);

    const resolved = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'amb-2')!;
    expect(resolved.status).toBe('failed');
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-shame')).toBe(true);
  });

  test('an ambition with no onCompleteEventId/onFailEventId queues nothing on completion', () => {
    const ambition: ActiveAmbition = {
      id: 'amb-3', scope: 'family', source: 'player', title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      baseline: { value: 0, turnNumber: 10 },
      status: 'active', turnSet: 10, deadlineTurn: 50,
      // Kept under the Patron Ladder's first threshold (30 lifetime Dignitas,
      // models/patronLadder.ts) so this test's only possible pendingEvents
      // source is the ambition follow-up hook under test.
      reward: { lifetimeDignitas: 10 }, failureDignitas: -6, refusable: true,
    };
    const state = makeSequencerState({ ambitions: [ambition], lifetimeBattlesWon: 5 });
    const { nextState } = processSeason(state);
    expect(nextState.pendingEvents).toHaveLength(0);
  });

  test('a superseded (character-death) ambition does NOT fire onFailEventId — a supersede is not a failure', () => {
    const ambition: ActiveAmbition = {
      id: 'amb-4', scope: 'character', source: 'story', title: 'Win Five Battles',
      criterion: { id: 'battles_won', amount: 5 },
      baseline: { value: 0, turnNumber: 10 },
      assignedCharacterId: 'npc-son', // not present in family
      status: 'active', turnSet: 10, deadlineTurn: 50,
      reward: { lifetimeDignitas: 40 }, failureDignitas: -6, refusable: true,
      onFailEventId: 'evt-shame', onCompleteEventId: 'evt-triumph',
    };
    const state = makeSequencerState({ ambitions: [ambition], lifetimeBattlesWon: 2 });
    const { nextState } = processSeason(state);

    const resolved = nextState.ambitions.find((a: ActiveAmbition) => a.id === 'amb-4')!;
    expect(resolved.status).toBe('superseded');
    expect(nextState.pendingEvents).toHaveLength(0);
  });
});

// ─── End-to-end: the two debug-fireable QA events (ticket 05's own
// checklist item — "demoable end-to-end with a test event") ───────────────
// evt-qa-ambition-direct-write / evt-qa-ambition-offer (data/events.ts,
// weight: 0) are reachable from DebugPanel.tsx's "FIRE EVENT" list by id —
// this exercises the exact same path a person clicking that button does:
// gameStore.resolveEvent -> eventEngine.resolveEventChoice ->
// resourceEngine.applyEffectString, through the real EVENT_DEFS pool, not a
// hand-built effect string.

describe('gameStore.resolveEvent — QA ambition test events fire the real tokens end-to-end (ticket 05)', () => {
  test('evt-qa-ambition-direct-write evicts an occupied family slot through the real event-resolution pipeline', () => {
    const occupant = makeOccupant();
    resetStore({ ambitions: [occupant], denarii: 200, fides: 30, lifetimeDignitas: 0 });
    useGameStore.setState({
      activeEvent: {
        defId: 'evt-qa-ambition-direct-write',
        firedAtTurn: useGameStore.getState().turnNumber,
        targetCharacterId: 'pc-1',
      },
    } as any);

    useGameStore.getState().resolveEvent('apply');

    const state = useGameStore.getState();
    const evicted = state.ambitions.find(a => a.id === 'occ-1')!;
    expect(evicted.status).toBe('superseded');
    const fresh = state.ambitions.find(a => a.status === 'active')!;
    expect(fresh.criterion).toEqual({ id: 'battles_won', amount: 2 });
    expect(fresh.source).toBe('story');
    expect(fresh.refusable).toBe(true);
  });

  test('evt-qa-ambition-offer stages an offer the leaf can then accept via acceptStoryAmbition', () => {
    resetStore();
    useGameStore.setState({
      activeEvent: {
        defId: 'evt-qa-ambition-offer',
        firedAtTurn: useGameStore.getState().turnNumber,
        targetCharacterId: 'pc-1',
      },
    } as any);

    useGameStore.getState().resolveEvent('apply');

    const staged = useGameStore.getState().pendingAmbitionOffers.character!;
    expect(staged.criterion).toEqual({ id: 'client_count', amount: 5 });

    useGameStore.getState().acceptStoryAmbition(staged.id);

    const state = useGameStore.getState();
    expect(state.pendingAmbitionOffers.character).toBeUndefined();
    expect(state.ambitions.some(a => a.criterion.id === 'client_count' && a.status === 'active')).toBe(true);
  });
});
