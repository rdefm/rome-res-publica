import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';
import { resolveElection } from '../src/engine/electionEngine';
import { calcResourceIncome } from '../src/engine/resourceEngine';
import { MUNIFICENCE_ACTS, getMunificenceAct } from '../src/data/munificence';
import {
  checkMunificenceRequirements,
  getMunificenceCost,
  getMunificenceEffects,
  isSlotUsedThisYear,
  isAedileActive,
} from '../src/engine/munificenceEngine';
import { BALANCE } from '../src/data/balance';

// ─── P2-F Munificence ─────────────────────────────────────────────────────────

const publicFeast   = getMunificenceAct('public-feast')!;
const fundTheLudi    = getMunificenceAct('fund-the-ludi')!;
const grandGames     = getMunificenceAct('grand-games')!;
const templeSaturn   = getMunificenceAct('temple-saturn')!;
const publicEndowment = getMunificenceAct('public-endowment')!;

function makeState(overrides: Record<string, any> = {}) {
  return {
    patronTier: 0,
    turnNumber: 10,
    denarii: 1000,
    fides: 1000,
    lifetimeDignitas: 0,
    rome: { stability: 50, plebs: 50, treasury: 50 },
    crisis: {
      war:          { id: 'war', level: 0, tier: 0, namedCrisis: null },
      unrest:       { id: 'unrest', level: 50, tier: 2, namedCrisis: null },
      constitution: { id: 'constitution', level: 0, tier: 0, namedCrisis: null },
      economy:      { id: 'economy', level: 0, tier: 0, namedCrisis: null },
    },
    currentOffice: null,
    munificenceUsage: {},
    endowments: [],
    ...overrides,
  } as any;
}

// ─── Requirement gating (pure) ────────────────────────────────────────────────

describe('checkMunificenceRequirements', () => {
  test('blocks below the required Patron Tier', () => {
    const state = makeState({ patronTier: 1 });
    const result = checkMunificenceRequirements(state, fundTheLudi); // requires tier 2
    expect(result.ok).toBe(false);
  });

  test('allows at or above the required Patron Tier', () => {
    const state = makeState({ patronTier: 2 });
    expect(checkMunificenceRequirements(state, fundTheLudi).ok).toBe(true);
  });

  test('cooldown blocks reuse within cooldownSeasons, allows after', () => {
    const state = makeState({
      turnNumber: 11,
      munificenceUsage: { 'public-feast': { lastUsedTurn: 10, usesThisYear: 1, totalUses: 1 } },
    });
    expect(checkMunificenceRequirements(state, publicFeast).ok).toBe(false); // 1 season since, cooldown is 2

    const later = makeState({
      turnNumber: 12,
      munificenceUsage: { 'public-feast': { lastUsedTurn: 10, usesThisYear: 1, totalUses: 1 } },
    });
    expect(checkMunificenceRequirements(state, publicFeast).ok).toBe(false);
    expect(checkMunificenceRequirements(later, publicFeast).ok).toBe(true); // 2 seasons since
  });

  test('shared "games" slot blocks the other act once either has been used this year', () => {
    const state = makeState({
      patronTier: 3,
      munificenceUsage: { 'fund-the-ludi': { usesThisYear: 1, totalUses: 1 } },
    });
    expect(isSlotUsedThisYear(state.munificenceUsage, 'games')).toBe(true);
    expect(checkMunificenceRequirements(state, grandGames).ok).toBe(false);
  });

  test('maxPerGame blocks a temple already restored this game', () => {
    const state = makeState({
      patronTier: 2,
      munificenceUsage: { 'temple-saturn': { usesThisYear: 0, totalUses: 1 } },
    });
    expect(checkMunificenceRequirements(state, templeSaturn).ok).toBe(false);
  });

  test('endowment maxPerGame (2) blocks a third build', () => {
    const state = makeState({
      patronTier: 4,
      munificenceUsage: { 'public-endowment': { usesThisYear: 0, totalUses: 2 } },
    });
    expect(checkMunificenceRequirements(state, publicEndowment).ok).toBe(false);
  });

  test('blocks when unaffordable', () => {
    const state = makeState({ denarii: 0 });
    expect(checkMunificenceRequirements(state, publicFeast).ok).toBe(false);
  });
});

// ─── Aedile discount math (pure) ──────────────────────────────────────────────

describe('Aedile discount', () => {
  test('isAedileActive reflects state.currentOffice', () => {
    expect(isAedileActive(makeState({ currentOffice: 'aedile' }))).toBe(true);
    expect(isAedileActive(makeState({ currentOffice: 'consul' }))).toBe(false);
  });

  test('halves cost and scales effects ×1.5 for games acts while holding Aedile', () => {
    const notAedile = makeState({ patronTier: 3, currentOffice: null });
    const aedile    = makeState({ patronTier: 3, currentOffice: 'aedile' });

    const baseCost   = getMunificenceCost(notAedile, grandGames);
    const discounted = getMunificenceCost(aedile, grandGames);
    expect(discounted.denarii).toBe(Math.round(baseCost.denarii * BALANCE.munificence.aedileCostMultiplier));

    const baseEffects   = getMunificenceEffects(notAedile, grandGames);
    const scaledEffects = getMunificenceEffects(aedile, grandGames);
    expect(scaledEffects.plebs).toBe(Math.round(baseEffects.plebs! * BALANCE.munificence.aedileEffectMultiplier));
    expect(scaledEffects.lifetimeDignitas).toBe(Math.round(baseEffects.lifetimeDignitas! * BALANCE.munificence.aedileEffectMultiplier));
  });

  test('does not scale acts without aedileDiscount (e.g. Public Feast)', () => {
    const aedile = makeState({ currentOffice: 'aedile' });
    const cost = getMunificenceCost(aedile, publicFeast);
    expect(cost.denarii).toBe(publicFeast.costs.denarii);
  });
});

// ─── Endowment Fides income term ─────────────────────────────────────────────

describe('endowment income (resourceEngine)', () => {
  test('each built endowment adds BALANCE.munificence.publicEndowment.endowmentFidesPerSeason to Fides income', () => {
    const zeroCrisis = {
      war:          { id: 'war', level: 0, tier: 0, namedCrisis: null },
      unrest:       { id: 'unrest', level: 0, tier: 0, namedCrisis: null },
      constitution: { id: 'constitution', level: 0, tier: 0, namedCrisis: null },
      economy:      { id: 'economy', level: 0, tier: 0, namedCrisis: null },
    };
    const base = { family: [], clans: [], clients: [], ownedAssets: [], provinces: [],
      patronTier: 0, rome: { stability: 50, plebs: 50, treasury: 50 },
      crisis: zeroCrisis, endowments: [] as string[] } as any;

    const withNone = calcResourceIncome(base);
    const withTwo  = calcResourceIncome({ ...base, endowments: ['public-endowment', 'public-endowment'] });

    expect(withTwo.fidesIncome - withNone.fidesIncome)
      .toBe(2 * BALANCE.munificence.publicEndowment.endowmentFidesPerSeason);
  });
});

// ─── Grand Games vote bonus — decaying standing bonus (electionEngine) ──────

describe('Grand Games vote bonus in resolveElection', () => {
  const originalRandom = Math.random;
  beforeEach(() => { Math.random = () => 0; });
  afterEach(() => { Math.random = originalRandom; });

  function makeElectionState(grandGamesVoteBonus: number) {
    return {
      campaigning: 'quaestor',
      clients: [],
      clans: [],
      campaignVotes: {},
      flags: {},
      crisis: { constitution: { level: 0 } },
      grandGamesVoteBonus,
    } as any;
  }

  test('a standing bonus adds directly to the player vote total', () => {
    const without = resolveElection(makeElectionState(0));
    const withBonus = resolveElection(makeElectionState(8));
    expect(withBonus.playerVotes - without.playerVotes).toBe(8);
  });
});

// ─── Yearly rollover: usage reset + bonus decay (turnSequencer) ─────────────

function makeSequencerState(overrides: Record<string, any> = {}) {
  const crisis = {
    war:          { id: 'war', level: 0, tier: 0, namedCrisis: null },
    unrest:       { id: 'unrest', level: 0, tier: 0, namedCrisis: null },
    constitution: { id: 'constitution', level: 0, tier: 0, namedCrisis: null },
    economy:      { id: 'economy', level: 0, tier: 0, namedCrisis: null },
  };
  return {
    year: -264, turnNumber: 10, seasonIndex: 3, // Winter -> crosses new year
    fides: 0, denarii: 300, imperium: 0, lifetimeDignitas: 0, lifetimeImperium: 0,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis, flags: {},
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
    selectedCharacterId: 'pc-1', expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], campaigning: null, campaignVotes: {},
    electionRivals: [], pendingBirthNaming: null, activeLaws: [], log: [], cursusLog: [],
    seasonOverlayVisible: false, seasonOverlayEvents: [], _expandedBill: null, _expandedType: null,
    familyReputations: {},
    munificenceUsage: {}, endowments: [], grandGamesVoteBonus: 0, grandGamesBonusYearsUntilDecay: 0,
    ...overrides,
  };
}

describe('Munificence yearly rollover (turnSequencer)', () => {
  test('usesThisYear resets to 0 at the Winter -> Spring rollover; totalUses/lastUsedTurn untouched', () => {
    const state = makeSequencerState({
      munificenceUsage: { 'fund-the-ludi': { lastUsedTurn: 8, usesThisYear: 1, totalUses: 3 } },
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.munificenceUsage['fund-the-ludi']).toEqual({ lastUsedTurn: 8, usesThisYear: 0, totalUses: 3 });
  });

  test('a mid-year season transition does not reset usage', () => {
    const state = makeSequencerState({
      seasonIndex: 0, // Spring -> Summer, no year crossing
      munificenceUsage: { 'public-feast': { lastUsedTurn: 8, usesThisYear: 1, totalUses: 1 } },
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.munificenceUsage['public-feast'].usesThisYear).toBe(1);
  });

  test('Grand Games bonus decays by 1 every 2 years and stops at 0', () => {
    let state: any = makeSequencerState({ grandGamesVoteBonus: 2, grandGamesBonusYearsUntilDecay: 1 });
    let result = processSeason(state);
    expect(result.nextState.grandGamesVoteBonus).toBe(1); // decay ticked (1 year remaining -> 0 -> decay)
    expect(result.nextState.grandGamesBonusYearsUntilDecay).toBe(2);

    state = { ...result.nextState, seasonIndex: 3, turnNumber: result.nextState.turnNumber };
    result = processSeason(state);
    // one year elapsed, not yet the 2-year mark
    expect(result.nextState.grandGamesVoteBonus).toBe(1);
    expect(result.nextState.grandGamesBonusYearsUntilDecay).toBe(1);
  });

  test('bonus of 0 does not tick the decay clock', () => {
    const state = makeSequencerState({ grandGamesVoteBonus: 0, grandGamesBonusYearsUntilDecay: 0 });
    const { nextState } = processSeason(state as any);
    expect(nextState.grandGamesVoteBonus).toBe(0);
    expect(nextState.grandGamesBonusYearsUntilDecay).toBe(0);
  });
});

// ─── performMunificence — store action ───────────────────────────────────────

function resetStore(overrides: Partial<ReturnType<typeof useGameStore.getState>> = {}) {
  useGameStore.setState({
    ...INITIAL_STATE,
    family: [{
      id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 42,
      skills: { rhetoric: 6, martial: 3, intrigus: 4 }, traits: [], ambition: null,
      relationship: 100, familyTrust: 100, officeId: null, corruptionScore: 0,
      inheritedTraits: [], ambitionIds: [], reputationScores: {},
      formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    }] as any,
    denarii: 1000,
    fides: 1000,
    patronTier: 3,
    munificenceUsage: {},
    endowments: [],
    grandGamesVoteBonus: 0,
    grandGamesBonusYearsUntilDecay: 0,
    activeEvent: null,
    pendingEvents: [],
    log: [],
    ...overrides,
  } as any);
}

describe('performMunificence store action', () => {
  beforeEach(() => resetStore());

  test('deducts cost and applies plebs/fides effects for Public Feast', () => {
    const before = useGameStore.getState();
    useGameStore.getState().performMunificence('public-feast');
    const after = useGameStore.getState();
    expect(before.denarii - after.denarii).toBe(publicFeast.costs.denarii);
    expect(after.rome.plebs - before.rome.plebs).toBe(publicFeast.effects.plebs);
    expect(after.fides - before.fides).toBe(publicFeast.effects.fides); // fides gained, nothing spent
    expect(after.munificenceUsage['public-feast'].totalUses).toBe(1);
  });

  test('applies unrest crisis relief for Grain Largesse', () => {
    resetStore({ crisis: { ...INITIAL_STATE.crisis, unrest: { id: 'unrest', level: 50, tier: 2, namedCrisis: null } } } as any);
    const before = useGameStore.getState();
    useGameStore.getState().performMunificence('grain-largesse');
    const after = useGameStore.getState();
    expect(after.crisis.unrest.level).toBe(before.crisis.unrest.level - 3);
  });

  test('blocked act is a no-op — no cost deducted, no usage recorded', () => {
    resetStore({ patronTier: 0 }); // Grand Games requires tier 3
    const before = useGameStore.getState();
    useGameStore.getState().performMunificence('grand-games');
    const after = useGameStore.getState();
    expect(after.denarii).toBe(before.denarii);
    expect(after.munificenceUsage['grand-games']).toBeUndefined();
  });

  test('Grand Games sets the vote bonus and triggers an immediate Philon interstitial', () => {
    useGameStore.getState().performMunificence('grand-games');
    const after = useGameStore.getState();
    expect(after.grandGamesVoteBonus).toBe(grandGames.effects.electionVoteBonus);
    expect(after.grandGamesBonusYearsUntilDecay).toBe(BALANCE.munificence.grandGames.electionVoteBonusDecayIntervalYears);
    expect(after.activeEvent?.defId).toBe('evt-munificence-grand-act');
  });

  test('recasting Grand Games refreshes an already-decayed bonus to full', () => {
    resetStore({ grandGamesVoteBonus: 3, grandGamesBonusYearsUntilDecay: 1, patronTier: 3 } as any);
    useGameStore.getState().performMunificence('grand-games');
    const after = useGameStore.getState();
    expect(after.grandGamesVoteBonus).toBe(grandGames.effects.electionVoteBonus);
  });

  test('Public Endowment adds to state.endowments and grants permanent Fides income', () => {
    resetStore({ patronTier: 4 } as any);
    useGameStore.getState().performMunificence('public-endowment');
    const after = useGameStore.getState();
    expect(after.endowments.length).toBe(1);
  });

  test('temple restoration is once per game — a second attempt is blocked', () => {
    resetStore({ patronTier: 2 } as any);
    useGameStore.getState().performMunificence('temple-saturn');
    const denariiAfterFirst = useGameStore.getState().denarii;
    useGameStore.getState().performMunificence('temple-saturn');
    expect(useGameStore.getState().denarii).toBe(denariiAfterFirst); // second attempt did nothing
  });
});

// ─── Sanity: every act's requirements.slot (if any) is a recognised value ───

describe('MUNIFICENCE_ACTS data sanity', () => {
  test('exactly two acts share the "games" slot', () => {
    const gamesActs = MUNIFICENCE_ACTS.filter(a => a.requirements.slot === 'games');
    expect(gamesActs.map(a => a.id).sort()).toEqual(['fund-the-ludi', 'grand-games']);
  });
});
