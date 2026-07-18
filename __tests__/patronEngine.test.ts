import { computePatronTier } from '../src/engine/patronEngine';
import { PATRON_TIER_DEFINITIONS } from '../src/models/patronLadder';
import { processSeason } from '../src/engine/turnSequencer';

// ─── computePatronTier — pure function ───────────────────────────────────────

describe('computePatronTier', () => {
  test('tier is gated by Lifetime Dignitas alone', () => {
    expect(computePatronTier(0)).toBe(0);
    expect(computePatronTier(29)).toBe(0);
    expect(computePatronTier(30)).toBe(1);
    expect(computePatronTier(79)).toBe(1);
    expect(computePatronTier(80)).toBe(2);
    expect(computePatronTier(179)).toBe(2);
    expect(computePatronTier(180)).toBe(3);
    expect(computePatronTier(349)).toBe(3);
    expect(computePatronTier(350)).toBe(4);
    expect(computePatronTier(599)).toBe(4);
    expect(computePatronTier(600)).toBe(5);
    expect(computePatronTier(10000)).toBe(5);
  });

  test('a Fides pool of 0 with high Lifetime Dignitas still yields the high tier', () => {
    // Signature no longer accepts a Fides argument at all — spending Fides to
    // zero can never demote you, because it was never part of the gate.
    expect(computePatronTier(350)).toBe(4);
  });

  test('Lifetime Dignitas dropping below a threshold demotes the tier', () => {
    // Simulates a rare event-penalty crossing a threshold downward.
    const beforePenalty = computePatronTier(180); // tier 3
    const afterPenalty  = computePatronTier(170); // dropped below 180
    expect(beforePenalty).toBe(3);
    expect(afterPenalty).toBe(2);
  });

  test('PATRON_TIER_DEFINITIONS no longer carries a Fides requirement field', () => {
    for (const def of PATRON_TIER_DEFINITIONS) {
      expect((def as any).requiresFidesPool).toBeUndefined();
    }
  });
});

// ─── Tier-up notice — turnSequencer integration ──────────────────────────────

function makeCrisisTrack(id: string, level: number) {
  const tier =
    level < 20 ? 0 :
    level < 40 ? 1 :
    level < 60 ? 2 :
    level < 80 ? 3 : 4;
  return { id, level, tier, namedCrisis: null } as const;
}

const CRISIS_ALL_ZERO = {
  war:          makeCrisisTrack('war',          0),
  unrest:       makeCrisisTrack('unrest',       0),
  constitution: makeCrisisTrack('constitution', 0),
  economy:      makeCrisisTrack('economy',      0),
};

function makeState(overrides: Record<string, any> = {}) {
  return {
    year: -264,
    turnNumber: 10,
    seasonIndex: 0,
    fides: 0,
    denarii: 300,
    imperium: 0,
    lifetimeDignitas: 0,
    lifetimeImperium: 0,
    popularesRel: 0,
    optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0,
    crisis: CRISIS_ALL_ZERO,
    flags: {},
    family: [
      {
        id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
        skills: { rhetoric: 6, martial: 4, intrigus: 5 },
        traits: [],
        ambition: null,
        relationship: 100, familyTrust: 100,
        officeId: null,
        corruptionScore: 0,
        inheritedTraits: [], ambitionIds: [], reputationScores: {},
        formalImperium: 0, militaryImperium: 0,
        raisedLegions: [], veterans: [],
      },
    ],
    bills: [],
    passedBills: [],
    clans: [],
    clients: [],
    ownedAssets: [],
    cities: [],
    pendingEvents: [],
    tribuneHolder: null,
    tribuneImmunity: false,
    tribuneSeasonsServed: 0,
    tribuneHostilityDebt: {},
    consulAuthorityActive: false,
    consulAuthoritySeasonsRemaining: 0,
    npcTribuneActive: false,
    npcConsul: null,
    activeCampaignExists: false,
    familyHasTroops: false,
    anyProvinceHasRoads: false,
    triumphBillInQueue: false,
    npcConsulExists: false,
    consultatumUsedThisTerm: false,
    senatePacked: false,
    dictatorOverstaySeasons: 0,
    ambitions: [],
    pendingAmbitionScopes: [],
    legacyObjectives: [],
    patronTier: 0,
    trialQueue: [],
    selectedCharacterId: 'pc-1',
    expandedClanId: null,
    selectedLeaderId: null,
    currentOffice: null,
    officeSeasons: 0,
    heldOffices: [],
    campaigning: null,
    campaignVotes: {},
    electionRivals: [],
    pendingBirthNaming: null,
    activeLaws: [],
    log: [],
    cursusLog: [],
    seasonOverlayVisible: false,
    seasonOverlayEvents: [],
    _expandedBill: null,
    _expandedType: null,
    familyReputations: {},
    ...overrides,
  };
}

describe('Patron Tier-up notice (turnSequencer step 18)', () => {
  test('crossing a tier threshold injects exactly one evt-patron-tier-up notice', () => {
    const state = makeState({ patronTier: 0, lifetimeDignitas: 30 }); // crosses tier 1 threshold

    const { nextState } = processSeason(state as any);

    expect(nextState.patronTier).toBe(1);
    const notices = nextState.pendingEvents.filter((e: any) => e.defId === 'evt-patron-tier-up');
    expect(notices.length).toBe(1);
    expect(notices[0].title).toBe('Minor Patron');
  });

  test('no tier change means no notice injected', () => {
    const state = makeState({ patronTier: 1, lifetimeDignitas: 40 }); // stays in tier 1 band

    const { nextState } = processSeason(state as any);

    expect(nextState.patronTier).toBe(1);
    const notices = nextState.pendingEvents.filter((e: any) => e.defId === 'evt-patron-tier-up');
    expect(notices.length).toBe(0);
  });
});

// ─── P2-D: relationship decay is yearly, not seasonal (turnSequencer step 9) ─

function makeTestClan(relationship: number) {
  return {
    id: 'testii', name: 'Gens Testia', gensName: 'Testius', sigil: '🏛️', influence: 50, desc: '',
    leaders: [{
      id: 'leader-1', name: 'L. Testius', title: 'Senator', emoji: '👤', age: 55,
      sphere: 'Senate', relationship, favour: 0, blackmail: false, bias: 'optimates',
      votes: 10, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
      heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    }],
  };
}

describe('Relationship decay only applies at the yearly rollover', () => {
  test('a mid-year season transition leaves relationship unchanged', () => {
    // seasonIndex 0 (Spring) -> 1 (Summer): does not cross a new year.
    const state = makeState({ seasonIndex: 0, clans: [makeTestClan(40)] });
    const { nextState } = processSeason(state as any);
    expect(nextState.clans[0].leaders[0].relationship).toBe(40); // unchanged, no default anchor drift yet
  });

  test('the Winter -> Spring rollover applies exactly one decay tick', () => {
    // seasonIndex 3 (Winter) -> 0 (Spring): crosses a new year.
    const state = makeState({ seasonIndex: 3, clans: [makeTestClan(40)] });
    const { nextState } = processSeason(state as any);
    expect(nextState.clans[0].leaders[0].relationship).toBe(37); // one decayPerYear tick toward the 25 default anchor
  });
});

// ─── Military Overhaul M8: unit lifecycle loyalty season tick (step 9d2) ────

function makeTroopFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'troop-1', type: 'raised', strength: 8, campaignsSurvived: 0,
    yearsInactive: 0, bondToCommander: 50, musterProvinceId: 'sicilia',
    ...overrides,
  };
}

/** Mirrors officeAction.test.ts's "doesn't crash turnSequencer" minimal
 *  ProvinceState fixture. */
function makeProvinceFixture(activeCampaign: Record<string, any> | null, overrides: Record<string, any> = {}) {
  return {
    id: 'sicilia',
    relationshipScore: 60, localSupport: 50,
    infrastructureRating: 20, infraStagnationSeasons: 0, lastInfraScore: 20,
    revoltActive: false, incorporationBillAvailable: false, warDeclarationAvailable: false,
    playerGovernor: null, npcRoleHolder: null, playerAmbassador: null, ownedAssets: [],
    activeCampaign, officerVolunteer: null,
    ...overrides,
  };
}

function withRaisedLegions(troops: any[], overrides: Record<string, any> = {}) {
  return makeState({ family: [{ ...makeState().family[0], raisedLegions: troops }], ...overrides });
}

describe('Military Overhaul M8 — unit lifecycle loyalty season tick', () => {
  test('+5/season while personally commanding an unresolved activeCampaign', () => {
    const troop = makeTroopFixture({ bondToCommander: 50 });
    const campaign = { id: 'camp-1', provinceId: 'sicilia', type: 'conquest', commanderCharacterId: 'pc-1',
      campaignProgress: 10, enemyStrength: 40, turnsElapsed: 1, localSupportBonus: false,
      resolved: false, outcome: null, activeEventId: null };
    const state = withRaisedLegions([troop], { cities: [makeProvinceFixture(campaign)] });

    const { nextState } = processSeason(state as any);
    expect(nextState.family[0].raisedLegions[0].bondToCommander).toBe(55);
  });

  test('no gain when the campaign is resolved, or commanded by someone else', () => {
    const resolvedCampaign = { id: 'camp-1', provinceId: 'sicilia', type: 'conquest', commanderCharacterId: 'pc-1',
      campaignProgress: 100, enemyStrength: 0, turnsElapsed: 5, localSupportBonus: false,
      resolved: true, outcome: 'victory', activeEventId: null };
    const troopA = makeTroopFixture({ id: 't-resolved', bondToCommander: 50 });
    const stateResolved = withRaisedLegions([troopA], { seasonIndex: 0, cities: [makeProvinceFixture(resolvedCampaign)] });
    expect(processSeason(stateResolved as any).nextState.family[0].raisedLegions[0].bondToCommander).toBe(50);

    const othersCampaign = { id: 'camp-2', provinceId: 'sicilia', type: 'conquest', commanderCharacterId: 'son-1',
      campaignProgress: 10, enemyStrength: 40, turnsElapsed: 1, localSupportBonus: false,
      resolved: false, outcome: null, activeEventId: null };
    const troopB = makeTroopFixture({ id: 't-other-commander', bondToCommander: 50 });
    const stateOther = withRaisedLegions([troopB], { seasonIndex: 0, cities: [makeProvinceFixture(othersCampaign)] });
    expect(processSeason(stateOther as any).nextState.family[0].raisedLegions[0].bondToCommander).toBe(50);
  });

  test('idle decay toward 50 applies only at the Winter -> Spring rollover, never past the target', () => {
    const above = makeTroopFixture({ id: 't-above', bondToCommander: 60 });
    const below = makeTroopFixture({ id: 't-below', bondToCommander: 40 });
    const atTarget = makeTroopFixture({ id: 't-at-target', bondToCommander: 51 }); // within one tick of 50

    const midYear = withRaisedLegions([above, below, atTarget], { seasonIndex: 0 }); // Spring -> Summer, no rollover
    const midYearResult = processSeason(midYear as any).nextState;
    expect(midYearResult.family[0].raisedLegions.map((t: any) => t.bondToCommander)).toEqual([60, 40, 51]);

    const rollover = withRaisedLegions([above, below, atTarget], { seasonIndex: 3 }); // Winter -> Spring, rollover
    const rolloverResult = processSeason(rollover as any).nextState;
    expect(rolloverResult.family[0].raisedLegions.map((t: any) => t.bondToCommander)).toEqual([58, 42, 50]);
  });
});
