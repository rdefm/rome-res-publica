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
    provinces: [],
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
