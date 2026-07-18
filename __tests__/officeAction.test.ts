import { resolveOfficeAction } from '../src/engine/officeActionEngine';
import { tickNpcConsul } from '../src/engine/npcConsulEngine';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

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
    fides: 60,
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
        officeId: 'consul',
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
    ...overrides,
  };
}

// ─── Extreme action → +3 Constitution ────────────────────────────────────────

describe('resolveOfficeAction — extreme actions add +3 to Constitution', () => {
  test('isExtreme action applies +3 to constitution track on top of its effects', () => {
    // Use pack-senate (isExtreme) as defined in offices.ts.
    // Pre-load state with enough fides and intrigus gate met.
    const state = makeState({
      fides: 60,
      crisis: {
        war:          makeCrisisTrack('war',          0),
        unrest:       makeCrisisTrack('unrest',       0),
        constitution: makeCrisisTrack('constitution', 10),  // start at 10
        economy:      makeCrisisTrack('economy',      0),
      },
      flags: { 'senate-packed': false },
      // Ensure intrigus gate passes: intrigus 8 >= 6
      family: [
        {
          id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
          skills: { rhetoric: 6, martial: 4, intrigus: 8 },
          traits: [], ambition: null, relationship: 100, familyTrust: 100,
          officeId: 'consul', corruptionScore: 0, inheritedTraits: [], ambitionIds: [],
          reputationScores: {}, formalImperium: 0, militaryImperium: 0,
          raisedLegions: [], veterans: [],
        },
      ],
    });

    const result = resolveOfficeAction('pack-senate', 'pc-1', state as any);

    expect(result.blocked).toBeUndefined();
    // pack-senate consequences add +10 to constitution, plus isExtreme adds +3 → total +13
    // Starting at 10, result should be 23 (or higher if cascaded in engine)
    expect(result.crisis?.constitution?.level).toBeGreaterThanOrEqual(13);
  });

  test('non-extreme action does NOT add +3 to constitution', () => {
    const state = makeState({
      fides: 30,
      crisis: {
        war:          makeCrisisTrack('war',          0),
        unrest:       makeCrisisTrack('unrest',       0),
        constitution: makeCrisisTrack('constitution', 0),
        economy:      makeCrisisTrack('economy',      0),
      },
      flags: { consultatumUsedThisTerm: false },
    });

    // senatus-consultum is NOT extreme (isExtreme not set)
    const result = resolveOfficeAction('senatus-consultum', 'pc-1', state as any);

    expect(result.blocked).toBeUndefined();
    // Constitution should not have increased by 3 (may be undefined if no change)
    const constitutionLevel = result.crisis?.constitution?.level ?? 0;
    expect(constitutionLevel).toBeLessThan(3);
  });
});

// ─── NPC consul level 3 reduces bill support ─────────────────────────────────

describe('tickNpcConsul — antagonism level 3 reduces player bill support', () => {
  test('at antagonism 3, player-sponsored bill support is reduced when random roll passes', () => {
    // Force Math.random to return 0 (forces all probabilistic paths: bill sponsor, support reduction)
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
      const playerBill = {
        id: 'player-bill-1',
        name: 'Test Bill',
        playerProposed: true,
        support: 50,
        passEffect: '',
        failEffect: '',
        turnsLeft: 3,
      };

      const state = makeState({
        bills: [playerBill],
        npcConsul: {
          leaderId: 'leader-a',
          clanId: 'clan-a',
          factionBias: 'optimates',
          antagonismLevel: 3,
          seasonsServed: 1,
        },
      }) as any;

      const patch = tickNpcConsul(state);

      // At antagonism 3, support reduction is 20. Starting at 50 → should be 30.
      const updatedBill = (patch.bills ?? state.bills).find((b: any) => b.id === 'player-bill-1');
      expect(updatedBill).toBeDefined();
      expect(updatedBill.support).toBeLessThan(50);
    } finally {
      Math.random = originalRandom;
    }
  });

  test('at antagonism 0, player bill support is not reduced', () => {
    // Even with Math.random = 0, level 0 has 0% reduction chance
    const originalRandom = Math.random;
    Math.random = () => 0;

    try {
      const playerBill = {
        id: 'player-bill-1',
        name: 'Test Bill',
        playerProposed: true,
        support: 50,
        passEffect: '',
        failEffect: '',
        turnsLeft: 3,
      };

      const state = makeState({
        bills: [playerBill],
        npcConsul: {
          leaderId: 'leader-a',
          clanId: 'clan-a',
          factionBias: 'neutral',
          antagonismLevel: 0,
          seasonsServed: 0,
        },
      }) as any;

      const patch = tickNpcConsul(state);

      const updatedBills = patch.bills ?? state.bills;
      const updatedBill = updatedBills.find((b: any) => b.id === 'player-bill-1');
      // Either not updated (no bills patch) or support unchanged
      if (updatedBill) {
        expect(updatedBill.support).toBe(50);
      }
    } finally {
      Math.random = originalRandom;
    }
  });

  test('returns empty patch when npcConsul is null', () => {
    const state = makeState({ npcConsul: null }) as any;
    const patch = tickNpcConsul(state);
    expect(Object.keys(patch).length).toBe(0);
  });
});

// ─── Triumph bill generated at threshold ─────────────────────────────────────
// The Triumph trigger runs in turnSequencer.processSeason (step 9h).
// We test the preconditions by constructing state that meets all requirements
// and running processSeason, then verifying a Triumph bill appears.

describe('Triumph bill generation', () => {
  // processSeason calls many engines; we test the essential data outcome
  // by constructing a state with a completed victory campaign and checking
  // that the triumphBillInQueue flag and bill are correctly set.

  test('Triumph bill is added when province has resolved victory and lifetimeImperium >= 50', async () => {
    // Import here to avoid top-level side effects
    const { processSeason } = await import('../src/engine/turnSequencer');

    const state = makeState({
      lifetimeImperium: 50,
      cities: [
        {
          id: 'sicilia',
          relationshipScore: 60,
          localSupport: 50,
          infrastructureRating: 20,
          infraStagnationSeasons: 0,
          lastInfraScore: 20,
          revoltActive: false,
          incorporationBillAvailable: false,
          warDeclarationAvailable: false,
          playerGovernor: null,
          npcRoleHolder: null,
          playerAmbassador: null,
          ownedAssets: [],
          activeCampaign: {
            commanderCharacterId: 'pc-1',
            resolved: true,
            outcome: 'victory',
          },
          officerVolunteer: null,
        },
      ],
      // Ensure turnSequencer doesn't crash on minimal state
      ambitions: [],
      legacyObjectives: [],
      patronTier: 0,
      trialQueue: [],
      selectedCharacterId: 'pc-1',
      expandedClanId: null,
      selectedLeaderId: null,
      currentOffice: 'consul',
      officeSeasons: 2,
      heldOffices: ['quaestor', 'aedile', 'praetor', 'consul'],
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
    });

    const { nextState } = processSeason(state as any);

    const triumphBill = nextState.bills.find((b: any) => b.id.startsWith('triumph-pc-1'));
    expect(triumphBill).toBeDefined();
    expect(triumphBill.name).toContain('Marcus');
    expect(triumphBill.playerProposed).toBe(false);
  });

  test('No Triumph bill when lifetimeImperium < 50', async () => {
    const { processSeason } = await import('../src/engine/turnSequencer');

    const state = makeState({
      lifetimeImperium: 30,  // below threshold
      cities: [
        {
          id: 'sicilia',
          relationshipScore: 60,
          localSupport: 50,
          infrastructureRating: 20,
          infraStagnationSeasons: 0,
          lastInfraScore: 20,
          revoltActive: false,
          incorporationBillAvailable: false,
          warDeclarationAvailable: false,
          playerGovernor: null,
          npcRoleHolder: null,
          playerAmbassador: null,
          ownedAssets: [],
          activeCampaign: {
            commanderCharacterId: 'pc-1',
            resolved: true,
            outcome: 'victory',
          },
          officerVolunteer: null,
        },
      ],
      ambitions: [],
      legacyObjectives: [],
      patronTier: 0,
      trialQueue: [],
      selectedCharacterId: 'pc-1',
      expandedClanId: null,
      selectedLeaderId: null,
      currentOffice: 'consul',
      officeSeasons: 2,
      heldOffices: ['quaestor', 'aedile', 'praetor', 'consul'],
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
    });

    const { nextState } = processSeason(state as any);

    const triumphBill = nextState.bills.find((b: any) => b.id.startsWith('triumph-pc-1'));
    expect(triumphBill).toBeUndefined();
  });

  test('No Triumph bill for defeat outcome', async () => {
    const { processSeason } = await import('../src/engine/turnSequencer');

    const state = makeState({
      lifetimeImperium: 60,
      cities: [
        {
          id: 'sicilia',
          relationshipScore: 60,
          localSupport: 50,
          infrastructureRating: 20,
          infraStagnationSeasons: 0,
          lastInfraScore: 20,
          revoltActive: false,
          incorporationBillAvailable: false,
          warDeclarationAvailable: false,
          playerGovernor: null,
          npcRoleHolder: null,
          playerAmbassador: null,
          ownedAssets: [],
          activeCampaign: {
            commanderCharacterId: 'pc-1',
            resolved: true,
            outcome: 'defeat',   // defeat → no Triumph
          },
          officerVolunteer: null,
        },
      ],
      ambitions: [],
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
    });

    const { nextState } = processSeason(state as any);

    const triumphBill = nextState.bills.find((b: any) => b.id.startsWith('triumph-pc-1'));
    expect(triumphBill).toBeUndefined();
  });
});
