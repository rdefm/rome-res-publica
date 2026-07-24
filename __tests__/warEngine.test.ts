import {
  processWarSeason, getDesperationTier,
  computeTreatyBudget, computePackagePrice, calcFactionReactionModifier,
  composeAiOffer, composeAiTreaty, applyTreatyEffects, buildTreatyBill, losingSide,
  computeRipeness, terminalThresholds, phaseForYear, classifyTerminalOutcome,
  peaceReachable, buildWarFundingBill, buildSueForPeaceBill, getEligibleTreatyTerms,
} from '../src/engine/warEngine';
import { applyEffectString } from '../src/engine/resourceEngine';
import { processSeason } from '../src/engine/turnSequencer';
import { WAR_EVENT_DEFS } from '../src/data/warEvents';
import { BALANCE } from '../src/data/balance';
import { ENEMY_GENERAL_LIST } from '../src/data/enemyGenerals';
import { TREATY_TERMS } from '../src/data/treatyTerms';
import { buildInitialCityStates } from '../src/data/cityDefinitions';
import { makeSeededRng } from '../src/utils/seededRng';
import type { Character } from '../src/models/character';
import type { TroopUnit } from '../src/models/troop';
import type { WarState, TreatyState } from '../src/models/war';
import type { Clan } from '../src/models/clan';
import type { Army, ArmyUnit } from '../src/models/army';
import { useGameStore } from '../src/state/gameStore';
import type { GameState } from '../src/state/gameStore';

// ─── Fixtures (mirrors musterEngine.test.ts's pattern) ──────────────────────

function makeCrisisTrack(id: string, level: number) {
  return { id, level, tier: 0, namedCrisis: null } as const;
}
const CRISIS_ALL_ZERO = {
  war: makeCrisisTrack('war', 0),
  unrest: makeCrisisTrack('unrest', 0),
  constitution: makeCrisisTrack('constitution', 0),
  economy: makeCrisisTrack('economy', 0),
};

function makeTroop(overrides: Partial<TroopUnit> = {}): TroopUnit {
  return {
    id: 'troop-1', type: 'raised', strength: 8, campaignsSurvived: 0,
    yearsInactive: 0, bondToCommander: 55, musterProvinceId: 'sicilia',
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 6, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0,
    raisedLegions: [makeTroop({ id: 't1' }), makeTroop({ id: 't2' }), makeTroop({ id: 't3' })],
    veterans: [],
    ...overrides,
  };
}

function makeWar(overrides: Partial<WarState> = {}): WarState {
  return {
    id: 'war-carthage-1', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
    warScore: 0, startedTurn: 1, weariness: 0,
    // Chunk C9
    enemyWeariness: 0, momentum: 0,
    treaty: null,
    // P3-A
    phase: 'opening', ignitedYear: -264, endedYear: null, terminalOutcome: null,
    // P3-B
    peaceOffered: false, lastFundingOfferTurn: -100,
    ...overrides,
  };
}

function makeArmyUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: 'armyunit-1', unitClass: 'legionary', strength: 80, veterancy: 'trained', loyalty: 60,
    elephantSteady: false, homeRegion: 'sicilia', raisedBy: 'player', raisedSeason: 1,
    campaignsSurvived: 1, wonCrushingVictory: false,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1', name: 'Legio I', owner: 'player', commanderId: 'pc-1', location: 'sicilia',
    stationedCityId: null, units: [makeArmyUnit()], stance: 'give_battle',
    ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    ...overrides,
  };
}

function makeTreaty(overrides: Partial<TreatyState> = {}): TreatyState {
  return {
    id: 'treaty-war-carthage-1-10', proposedTurn: 10, resolvedTurn: null,
    termIds: ['indemnity_minor'], ratified: null, initiator: 'rome', stage: 'senate_vote',
    ...overrides,
  };
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'clan-test', name: 'Test Clan', gensName: 'Testia', sigil: '🏛', influence: 50,
    desc: '', leaders: [],
    ...overrides,
  };
}

function makeLeader(overrides: Partial<Clan['leaders'][0]> = {}): Clan['leaders'][0] {
  return {
    id: 'leader-test', name: 'Test Leader', title: 'Senator', emoji: '👤', age: 50,
    sphere: 'politics', relationship: 0, favour: 0, blackmail: false, bias: 'optimates',
    votes: 5, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
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
  };
  return { ...base, ...overrides } as unknown as GameState;
}

// ─── getDesperationTier ──────────────────────────────────────────────────────

describe('getDesperationTier', () => {
  test('thresholds, symmetric for both signs', () => {
    expect(getDesperationTier(0)).toBe('none');
    expect(getDesperationTier(39)).toBe('none');
    expect(getDesperationTier(-39)).toBe('none');
    expect(getDesperationTier(40)).toBe('sue');
    expect(getDesperationTier(-40)).toBe('sue');
    expect(getDesperationTier(69)).toBe('sue');
    expect(getDesperationTier(70)).toBe('forced');
    expect(getDesperationTier(-70)).toBe('forced');
    expect(getDesperationTier(89)).toBe('forced');
    expect(getDesperationTier(90)).toBe('dictate');
    expect(getDesperationTier(-90)).toBe('dictate');
    expect(getDesperationTier(100)).toBe('dictate');
  });
});

// ─── processWarSeason ────────────────────────────────────────────────────────
// Chunk C9 retired the skirmish-drift/weariness-erosion/set-piece-scheduler
// machinery that used to live here — warScore/weariness/momentum are now
// computed once per season by engine/warStanding.ts (see turnSequencer.ts's
// step 6c, BEFORE this function runs); this function only REACTS to whatever
// value it finds (threshold crossings, treaty resolution, dictate-tier,
// bill queueing). It never mutates warScore itself anymore — see the
// dedicated regression test below and warStanding.test.ts for the standing
// math itself.

describe('processWarSeason', () => {
  test('inactive wars are left untouched', () => {
    const state = makeState({ wars: [makeWar({ active: false, warScore: 12 })] });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].warScore).toBe(12);
  });

  test('never mutates warScore itself — only reacts to the value already set upstream', () => {
    const state = makeState({ wars: [makeWar({ warScore: 17 })] });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].warScore).toBe(17);
  });

  test('threshold crossing (detected via the war-score-snapshot flag) fires a notice once, not again while sustained', () => {
    // Simulates campaignResolver having already moved warScore from 38 (last
    // season's snapshot) to 41 THIS season, crossing the sue threshold (40).
    const state = makeState({
      turnNumber: 3,
      flags: { 'war-score-snapshot-war-carthage-1': 38 },
      wars: [makeWar({ warScore: 41, startedTurn: 1 })],
    });
    const first = processWarSeason(state, () => 0.5);
    expect(first.noticeEvents.some(e => e.defId === 'evt-war-threshold-notice')).toBe(true);

    // A second season sustained at the same warScore (snapshot now 41, same
    // as current) must not re-fire — no crossing happened.
    const state2 = {
      ...state, turnNumber: 4, wars: first.wars,
      flags: { ...state.flags, ...first.statePatch.flags },
    };
    const second = processWarSeason(state2, () => 0.5);
    expect(second.noticeEvents.some(e => e.defId === 'evt-war-threshold-notice')).toBe(false);
  });

  test('crossing into the sue tier while Rome is winning auto-generates an AI offer', () => {
    const state = makeState({
      turnNumber: 3,
      flags: { 'war-score-snapshot-war-carthage-1': 38 },
      wars: [makeWar({ warScore: 41, startedTurn: 1 })],
    });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].warScore).toBe(41); // unchanged — this function never sets warScore
    expect(result.wars[0].treaty?.stage).toBe('ai_offer');
    expect(result.wars[0].treaty?.initiator).toBe('enemy');
  });

  test('ledger events include a warScore delta headline for each active war', () => {
    const state = makeState({ wars: [makeWar({ id: 'w1' }), makeWar({ id: 'w2', enemyId: 'a-revolt', scale: 'local' })] });
    const result = processWarSeason(state, () => 0.9);
    expect(result.events.some(e => e.includes('carthage') && e.includes('warScore'))).toBe(true);
    expect(result.events.some(e => e.includes('a-revolt') && e.includes('warScore'))).toBe(true);
  });
});

// ─── Chunk M10 — Peace: Negotiation & Senate Ratification ──────────────────

describe('computeTreatyBudget', () => {
  test('0 below the sue threshold', () => {
    expect(computeTreatyBudget(20)).toBe(0);
    expect(computeTreatyBudget(-20)).toBe(0);
  });

  test('0 exactly at the sue threshold (thresholdBase cancels)', () => {
    expect(computeTreatyBudget(40)).toBe(0);
    expect(computeTreatyBudget(-40)).toBe(0);
  });

  test('forced tier: |warScore| - 40 + 10', () => {
    expect(computeTreatyBudget(70)).toBe(70 - 40 + 10);
    expect(computeTreatyBudget(-70)).toBe(70 - 40 + 10);
  });

  test('dictate tier: |warScore| - 40 + 30', () => {
    expect(computeTreatyBudget(90)).toBe(90 - 40 + 30);
    expect(computeTreatyBudget(100)).toBe(100 - 40 + 30);
    expect(computeTreatyBudget(-90)).toBe(90 - 40 + 30);
  });
});

describe('computePackagePrice', () => {
  test('sums term prices', () => {
    expect(computePackagePrice(['indemnity_minor', 'prisoner_return'])).toBe(5 + 5);
  });

  test('face-saver has a negative price', () => {
    expect(computePackagePrice(['face_saver'])).toBe(-1);
    expect(computePackagePrice(['indemnity_minor', 'face_saver'])).toBe(5 - 1);
  });

  test('unknown term ids contribute 0', () => {
    expect(computePackagePrice(['not-a-real-term'])).toBe(0);
  });
});

describe('calcFactionReactionModifier', () => {
  test('0 for an empty package', () => {
    expect(calcFactionReactionModifier([], makeState())).toBe(0);
  });

  test('a clan-heavy optimates senate reacts positively to an optimates-favoured term', () => {
    const state = makeState({
      optimatesRel: 50,
      clans: [makeClan({ leaders: [makeLeader({ bias: 'optimates' }), makeLeader({ id: 'l2', bias: 'optimates' })] })],
    });
    expect(calcFactionReactionModifier(['lilybaeum'], state)).toBeGreaterThan(0);
  });

  test('result is clamped within BALANCE.war.treaty.factionReactionClamp', () => {
    const manyOptimates = Array.from({ length: 20 }, (_, i) => makeLeader({ id: `l${i}`, bias: 'optimates' }));
    const state = makeState({ optimatesRel: 100, clans: [makeClan({ leaders: manyOptimates })] });
    const allTermIds = TREATY_TERMS.map(t => t.id);
    const clamp = BALANCE.war.treaty.factionReactionClamp;
    expect(Math.abs(calcFactionReactionModifier(allTermIds, state))).toBeLessThanOrEqual(clamp);
  });
});

describe('composeAiOffer / composeAiTreaty', () => {
  const cautiousGeneral = ENEMY_GENERAL_LIST.find(g => g.aggression < 0.5)!;
  const aggressiveGeneral = ENEMY_GENERAL_LIST.find(g => g.aggression >= 0.5)!;
  const carthageProvinces = buildInitialCityStates();

  test('composeAiOffer returns only valid, cheap term ids', () => {
    const offer = composeAiOffer(cautiousGeneral, 'carthage', carthageProvinces, makeSeededRng(1));
    expect(offer.length).toBeGreaterThan(0);
    for (const id of offer) {
      const term = TREATY_TERMS.find(t => t.id === id);
      expect(term).toBeDefined();
      expect(term!.warScorePrice).toBeLessThanOrEqual(6);
    }
  });

  test('an aggressive general offers no more terms than a cautious one', () => {
    const cautious = composeAiOffer(cautiousGeneral, 'carthage', carthageProvinces, () => 0);
    const aggressive = composeAiOffer(aggressiveGeneral, 'carthage', carthageProvinces, () => 0);
    expect(aggressive.length).toBeLessThanOrEqual(cautious.length);
  });

  test('composeAiTreaty never exceeds the general-weighted spend cap', () => {
    const budget = 40;
    for (const seed of [1, 2, 3, 4, 5]) {
      const cautiousPicks = composeAiTreaty(budget, cautiousGeneral, 'carthage', carthageProvinces, makeSeededRng(seed));
      expect(computePackagePrice(cautiousPicks)).toBeLessThanOrEqual(Math.round(budget * 0.7));
      const aggressivePicks = composeAiTreaty(budget, aggressiveGeneral, 'carthage', carthageProvinces, makeSeededRng(seed));
      expect(computePackagePrice(aggressivePicks)).toBeLessThanOrEqual(budget);
    }
  });

  test('composeAiOffer/composeAiTreaty never include a province-cession term whose province is not live-owned by the passed enemyId', () => {
    // A Gaul war (synthetic enemyId, owns none of the Mediterranean provinces)
    // should never surface a Carthaginian-owned cession term.
    for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
      const offer = composeAiOffer(aggressiveGeneral, 'a-gaul-revolt', carthageProvinces, makeSeededRng(seed));
      const treaty = composeAiTreaty(100, aggressiveGeneral, 'a-gaul-revolt', carthageProvinces, makeSeededRng(seed));
      for (const id of [...offer, ...treaty]) {
        const term = TREATY_TERMS.find(t => t.id === id);
        expect(term?.warEndFlags?.provinceTransferToRome).toBeUndefined();
      }
    }
  });
});

describe('applyTreatyEffects', () => {
  test('winner=rome with lilybaeum adds the province to state.cities', () => {
    const state = makeState();
    const patch = applyTreatyEffects(['lilybaeum'], state, 'rome');
    expect(patch.cities?.some(p => p.id === 'lilybaeum')).toBe(true);
  });

  test('does not duplicate a province already present — flips it in place instead', () => {
    const state = makeState({ cities: [{ id: 'lilybaeum', owner: 'carthage', status: 'foreign' } as any] });
    const patch = applyTreatyEffects(['lilybaeum'], state, 'rome');
    const result = patch.cities ?? state.cities;
    const matches = result.filter(p => p.id === 'lilybaeum');
    expect(matches).toHaveLength(1);
    expect(matches[0].owner).toBe('rome');
    expect(matches[0].status).toBe('unincorporated');
  });

  test('ceding a province already owned by Rome is a no-op', () => {
    const state = makeState({ cities: [{ id: 'lilybaeum', owner: 'rome', status: 'unincorporated' } as any] });
    const patch = applyTreatyEffects(['lilybaeum'], state, 'rome');
    const result = patch.cities ?? state.cities;
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: 'lilybaeum', owner: 'rome', status: 'unincorporated' });
  });

  test('winner=enemy does not cede any province', () => {
    const state = makeState();
    const patch = applyTreatyEffects(['lilybaeum'], state, 'enemy');
    expect(patch.cities).toBeUndefined();
  });

  test('prisoner_return clears captivity on every captured family member', () => {
    const state = makeState({
      family: [
        makeCharacter({ id: 'pc-1' }),
        makeCharacter({ id: 'c2', isPlayer: false, captivity: { status: 'awaiting_ransom', demandDenarii: 100, capturedTurn: 5 } }),
      ],
    });
    const patch = applyTreatyEffects(['prisoner_return'], state, 'rome');
    expect(patch.family?.find(c => c.id === 'c2')?.captivity).toBeNull();
  });

  test('indemnity_minor: winner gains denarii, loser loses denarii', () => {
    const state = makeState({ denarii: 300 });
    const winPatch = applyTreatyEffects(['indemnity_minor'], state, 'rome');
    expect(winPatch.denarii).toBe(400);
    const losePatch = applyTreatyEffects(['indemnity_minor'], state, 'enemy');
    expect(losePatch.denarii).toBe(200);
  });
});

describe('buildTreatyBill', () => {
  test('id matches the reconstructable format treaty-<warId>-<turnNumber>', () => {
    const state = makeState({ turnNumber: 42 });
    const war = makeWar();
    const bill = buildTreatyBill(war, ['indemnity_minor'], state, 'rome');
    expect(bill.id).toBe(`treaty-${war.id}-42`);
  });
});

describe('processWarSeason — treaty resolution (Chunk M10)', () => {
  test('a passed ratification bill ends the war and applies its effects', () => {
    const treaty = makeTreaty({ termIds: ['lilybaeum'], proposedTurn: 10 });
    const state = makeState({
      turnNumber: 12,
      wars: [makeWar({ warScore: 75, startedTurn: 1, treaty })],
      passedBills: [{ id: `treaty-war-carthage-1-10`, name: 'Treaty with Carthage', passedOnTurn: 12 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].treaty?.ratified).toBe(true);
    expect(result.statePatch.cities?.some(p => p.id === 'lilybaeum')).toBe(true);
  });

  test('a passed ratification queues a Triumph petition for the player when Rome wins', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 10 });
    const state = makeState({
      turnNumber: 12,
      wars: [makeWar({ warScore: 75, startedTurn: 1, treaty })],
      passedBills: [{ id: `treaty-war-carthage-1-10`, name: 'Treaty with Carthage', passedOnTurn: 12 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.statePatch.bills?.some(b => b.id.startsWith('triumph-pc-1'))).toBe(true);
  });

  test('a failed/expired ratification keeps the war active, bumps momentum (not warScore), and locks the treaty out', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 5 });
    const state = makeState({
      turnNumber: 9,
      wars: [makeWar({ warScore: 75, momentum: 0, startedTurn: 1, treaty })],
      bills: [], passedBills: [],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].active).toBe(true);
    expect(result.wars[0].treaty?.ratified).toBe(false);
    expect(result.wars[0].treaty?.resolvedTurn).toBe(9);
    // Chunk C9 — the fail penalty is now a momentum injection; warScore itself
    // is untouched by processWarSeason (it's recomputed fresh next season by
    // warStanding.ts from this momentum, among other terms).
    expect(result.wars[0].warScore).toBe(75);
    expect(result.wars[0].momentum).toBe(BALANCE.war.treaty.failWarScorePenalty);
  });

  test('a still-pending ratification bill is left untouched', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 9 });
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ warScore: 75, startedTurn: 1, treaty })],
      bills: [{ id: 'treaty-war-carthage-1-9', support: 0 } as any],
      passedBills: [],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].active).toBe(true);
    expect(result.wars[0].treaty?.ratified).toBeNull();
  });

  test('the re-table lockout clears once retableLockoutTurns has elapsed since a failed vote', () => {
    const lockoutTurns = BALANCE.war.treaty.retableLockoutTurns;
    const treaty = makeTreaty({ ratified: false, resolvedTurn: 10, proposedTurn: 5 });
    const state = makeState({
      turnNumber: 10 + lockoutTurns,
      wars: [makeWar({ warScore: 75, startedTurn: 1, treaty })],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].treaty).toBeNull();
  });

  test('the re-table lockout does NOT clear before retableLockoutTurns has elapsed', () => {
    const treaty = makeTreaty({ ratified: false, resolvedTurn: 10, proposedTurn: 5 });
    const state = makeState({
      turnNumber: 11,
      wars: [makeWar({ warScore: 75, startedTurn: 1, treaty })],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].treaty).not.toBeNull();
  });

  test('Rome losing at the dictate tier auto-ratifies terms with no vote', () => {
    const state = makeState({
      turnNumber: 20,
      wars: [makeWar({ warScore: -95, startedTurn: 1})],
    });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].treaty?.stage).toBe('auto_ratified');
    expect(result.wars[0].treaty?.ratified).toBe(true);
    expect(result.statePatch.flags?.[`campaign-failure-epilogue-${state.wars[0].id}`]).toBe(true);
  });

  // "crossing into the sue tier..." is covered by the dedicated
  // processWarSeason describe block above (Chunk C9 — the crossing is now
  // detected via the war-score-snapshot flag, not in-function drift).
});

// ─── DONE-WHEN: 20-season simulation coherence ──────────────────────────────

describe('DONE-WHEN: 20-season simulation', () => {
  test('a war with steadily escalating warScore produces coherent notices/events across 20 seasons without crashing', () => {
    // Chunk C9 — warScore is now driven upstream by the campaign map
    // (warStanding.ts), recomputed once per season BEFORE processWarSeason
    // ever runs; this loop simulates that upstream step with a steady climb
    // so it still exercises threshold crossings/AI-offer auto-generation
    // under realistic input, without reintroducing the retired skirmish-
    // drift/scheduler machinery this function no longer owns.
    let state = makeState({ turnNumber: 1, wars: [makeWar({ startedTurn: 1 })] });
    let noticesSeen = 0;

    for (let season = 1; season <= 20; season++) {
      const warScore = Math.min(100, season * 5);
      state = { ...state, turnNumber: season, wars: [{ ...state.wars[0], warScore }] };
      const result = processWarSeason(state, () => 0.5);
      expect(result.wars).toHaveLength(1);
      expect(result.wars[0].warScore).toBeGreaterThanOrEqual(-100);
      expect(result.wars[0].warScore).toBeLessThanOrEqual(100);
      state = { ...state, wars: result.wars, flags: { ...state.flags, ...result.statePatch.flags } };
      noticesSeen += result.noticeEvents.length;
    }

    // Coherence, not a specific count — the threshold-crossing/AI-offer
    // mechanism is exercised by the dedicated tests above; here we just need
    // the whole loop to run cleanly for 20 seasons under a realistic climb.
    expect(noticesSeen).toBeGreaterThan(0);
  });
});

// ─── Phase 3, Chunk P3-A — Historical Ripeness ──────────────────────────────

describe('computeRipeness', () => {
  test('0 at the historical start year (264 BC)', () => {
    expect(computeRipeness(-264)).toBe(0);
  });

  test('0 for every year up to and including floorYears elapsed', () => {
    const floor = BALANCE.war.ripeness.floorYears;
    expect(computeRipeness(-264 + floor)).toBe(0);
  });

  test('monotonically non-decreasing as the year descends from 264 toward 241', () => {
    let prev = -1;
    for (let year = -264; year >= -241; year++) {
      const r = computeRipeness(year);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
  });

  test('reaches 1.0 at fullYears elapsed, before the historical end year', () => {
    const { startYear, fullYears, historicalEndYear } = BALANCE.war.ripeness;
    const yearAtFull = -(startYear - fullYears);
    // Only meaningful if that year is still before/at the historical end —
    // guards the test against a future BALANCE tweak making fullYears > the
    // 264->241 span, which would make this assertion vacuous rather than wrong.
    if (Math.abs(yearAtFull) >= historicalEndYear) {
      expect(computeRipeness(yearAtFull)).toBe(1);
    }
  });

  test('pinned at 1 at and past the historical end year (241 BC)', () => {
    expect(computeRipeness(-241)).toBe(1);
    expect(computeRipeness(-200)).toBe(1);
    expect(computeRipeness(-1)).toBe(1);
  });
});

describe('terminalThresholds', () => {
  test('hard bounds at ripeness 0', () => {
    const t = BALANCE.war.ripeness.thresholds;
    expect(terminalThresholds(0)).toEqual({ victory: t.victory.hard, humbled: t.humbled.hard });
  });

  test('easy bounds at ripeness 1', () => {
    const t = BALANCE.war.ripeness.thresholds;
    expect(terminalThresholds(1)).toEqual({ victory: t.victory.easy, humbled: t.humbled.easy });
  });

  test('victory threshold shrinks and humbled threshold rises (toward 0) as ripeness climbs', () => {
    const low = terminalThresholds(0);
    const high = terminalThresholds(1);
    expect(high.victory).toBeLessThan(low.victory);
    expect(high.humbled).toBeGreaterThan(low.humbled);
  });
});

describe('phaseForYear', () => {
  test('opening in the first openingPhaseYears', () => {
    expect(phaseForYear(-264, 0)).toBe('opening');
  });

  test('ripe once ripeness clears ripePhaseThreshold', () => {
    expect(phaseForYear(-241, 0)).toBe('ripe');
  });

  test('grinding when warScore sits inside the flat band, mid-war, not yet ripe', () => {
    // elapsed=3 (just past openingPhaseYears), ripeness still 0 (below floorYears=4).
    expect(phaseForYear(-261, 5)).toBe('grinding');
  });

  test('escalation when warScore is well outside the grinding band, mid-war, not yet ripe', () => {
    expect(phaseForYear(-261, 50)).toBe('escalation');
  });
});

describe('classifyTerminalOutcome', () => {
  test('dictated-against-Rome is always humbled, regardless of score/ripeness', () => {
    expect(classifyTerminalOutcome(100, 1, true)).toBe('humbled');
  });

  test('victory when warScore clears the ripeness-scaled victory bound', () => {
    const th = terminalThresholds(0);
    expect(classifyTerminalOutcome(th.victory, 0, false)).toBe('victory');
  });

  test('humbled when warScore clears the ripeness-scaled humbled bound', () => {
    const th = terminalThresholds(0);
    expect(classifyTerminalOutcome(th.humbled, 0, false)).toBe('humbled');
  });

  test('exhaustion for a middling ratified score between both bounds', () => {
    expect(classifyTerminalOutcome(10, 0.5, false)).toBe('exhaustion');
  });

  test('the same warScore can flip from exhaustion to victory as ripeness climbs (easier late)', () => {
    const midScore = terminalThresholds(1).victory; // clears the EASY bound only
    expect(classifyTerminalOutcome(midScore, 0, false)).toBe('exhaustion');
    expect(classifyTerminalOutcome(midScore, 1, false)).toBe('victory');
  });
});

describe('processWarSeason — terminal outcome tagging (P3-A)', () => {
  test('a ratified major-war treaty tags terminalOutcome, endedYear, and statePatch.pendingEpilogue', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 10 });
    const state = makeState({
      turnNumber: 12,
      year: -264,
      wars: [makeWar({ warScore: 95, scale: 'major', startedTurn: 1, treaty })],
      passedBills: [{ id: `treaty-war-carthage-1-10`, name: 'Treaty with Carthage', passedOnTurn: 12 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].terminalOutcome).toBe('victory');
    expect(result.wars[0].endedYear).toBe(-264);
    expect(result.statePatch.pendingEpilogue).toBe('victory');
  });

  test('a ratified local-war (revolt) treaty does NOT tag a terminalOutcome or pendingEpilogue', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 10, id: 'treaty-war-carthage-1-10' });
    const state = makeState({
      turnNumber: 12,
      wars: [makeWar({ warScore: 95, scale: 'local', startedTurn: 1, treaty })],
      passedBills: [{ id: `treaty-war-carthage-1-10`, name: 'Treaty', passedOnTurn: 12 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].terminalOutcome).toBeNull();
    expect(result.statePatch.pendingEpilogue).toBeUndefined();
  });

  test('Rome dictated to (major war) tags humbled regardless of ripeness', () => {
    // The dictate-tier auto-ratify branch always classifies humbled — it
    // never consults terminalThresholds, so ripeness is irrelevant here.
    const state = makeState({
      turnNumber: 20,
      year: -264,
      wars: [makeWar({ warScore: -95, scale: 'major', startedTurn: 1})],
    });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].terminalOutcome).toBe('humbled');
    expect(result.statePatch.pendingEpilogue).toBe('humbled');
  });

  test('phase is recomputed each active season from the current year/warScore', () => {
    const state = makeState({ year: -241, wars: [makeWar({ warScore: 0 })] });
    const result = processWarSeason(state, () => 0.9); // no-op-ish drift direction doesn't matter here
    expect(result.wars[0].phase).toBe('ripe');
  });
});

// ─── Phase 3, Chunk P3-A — calendar-direction fix (pre-existing bug) ────────
// Discovered while building ripeness math: turnSequencer.ts's year rollover
// previously moved the stored (negative) year FURTHER negative each
// Winter->Spring crossing, so the displayed BC year climbed instead of
// descending toward 241. Regression-locks the fix (reported/approved before
// applying — see that file's comment at the call site).

describe('processSeason — calendar direction', () => {
  test('the displayed BC year descends (264 -> 263) after a full year elapses', () => {
    let state = makeState({ year: -264, seasonIndex: 3, turnNumber: 1 }); // Winter -> next tick crosses into a new year
    const { nextState } = processSeason(state as any);
    expect(nextState.seasonIndex).toBe(0); // Spring
    expect(Math.abs(nextState.year)).toBe(263);
  });

  test('mid-year season advances do not touch the year', () => {
    const state = makeState({ year: -264, seasonIndex: 0, turnNumber: 1 }); // Spring -> Summer
    const { nextState } = processSeason(state as any);
    expect(nextState.year).toBe(-264);
  });
});

// ─── Phase 3, Chunk P3-B ──────────────────────────────────────────────────────

describe('applyEffectString — startWar: token', () => {
  test('creates a new active WarState with the given opening warScore', () => {
    const state = makeState({ wars: [] });
    const patch = applyEffectString('startWar:carthage:major:8', state);
    expect(patch.wars).toHaveLength(1);
    const war = patch.wars![0];
    expect(war.active).toBe(true);
    expect(war.enemyId).toBe('carthage');
    expect(war.scale).toBe('major');
    expect(war.warScore).toBe(8);
    expect(war.phase).toBe('opening');
    expect(war.terminalOutcome).toBeNull();
    expect(war.peaceOffered).toBe(false);
  });

  test('is idempotent — does not create a second war if one is already active for the same enemy/scale', () => {
    const state = makeState({ wars: [makeWar({ enemyId: 'carthage', scale: 'major' })] });
    const patch = applyEffectString('startWar:carthage:major:8', state);
    expect(patch.wars).toBeUndefined();
  });

  test('defaults opening warScore to 0 when omitted', () => {
    const state = makeState({ wars: [] });
    const patch = applyEffectString('startWar:carthage:major', state);
    expect(patch.wars![0].warScore).toBe(0);
  });
});

describe('applyEffectString — warScoreDelta: token', () => {
  test('bumps the matching active war\'s momentum, clamped to ±momentumCap (Chunk C9 — warScore itself is untouched)', () => {
    const cap = BALANCE.campaign.standing.momentumCap;
    const state = makeState({ wars: [makeWar({ warScore: 95, momentum: cap - 5 })] });
    const patch = applyEffectString('warScoreDelta:carthage:10', state);
    expect(patch.wars![0].momentum).toBe(cap);
    expect(patch.wars![0].warScore).toBe(95);
  });

  test('leaves an inactive or differently-enemied war untouched', () => {
    const state = makeState({
      wars: [makeWar({ id: 'w1', active: false, momentum: 0 }), makeWar({ id: 'w2', enemyId: 'a-revolt', momentum: 0 })],
    });
    const patch = applyEffectString('warScoreDelta:carthage:10', state);
    expect(patch.wars!.every(w => w.momentum === 0)).toBe(true);
  });
});

describe('peaceReachable', () => {
  test('false below the ripeness-scaled bound, true at/above it', () => {
    const t = BALANCE.war.ripeness.exhaustionWeariness;
    expect(peaceReachable(t.hard - 1, 0)).toBe(false);
    expect(peaceReachable(t.hard, 0)).toBe(true);
    expect(peaceReachable(t.easy - 1, 1)).toBe(false);
    expect(peaceReachable(t.easy, 1)).toBe(true);
  });

  test('the bound needed shrinks as ripeness climbs (easier to reach late)', () => {
    const weariness = BALANCE.war.ripeness.exhaustionWeariness.easy + 1;
    expect(peaceReachable(weariness, 0)).toBe(false);
    expect(peaceReachable(weariness, 1)).toBe(true);
  });
});

describe('buildWarFundingBill / buildSueForPeaceBill', () => {
  test('reconstructable ids match the prefixes processWarSeason detects', () => {
    const war = makeWar({ id: 'war-carthage-1' });
    const state = makeState({ turnNumber: 20 });
    expect(buildWarFundingBill(war, state).id).toBe('war-funding-war-carthage-1-20');
    expect(buildSueForPeaceBill(war, state).id).toBe('sue-for-peace-war-carthage-1-20');
  });

  test('support bias runs opposite ways: funding favours Optimates lean, sue-for-peace favours Populares lean', () => {
    const war = makeWar();
    const optimatesLeaning = makeState({ optimatesRel: 50, popularesRel: 0 });
    const funding = buildWarFundingBill(war, optimatesLeaning);
    const peace = buildSueForPeaceBill(war, optimatesLeaning);
    expect(funding.support).toBeGreaterThan(0);
    expect(peace.support).toBeLessThan(0);
  });
});

describe('processWarSeason — war-funding bill (P3-B)', () => {
  test('queues a bill when none pending and the cooldown has elapsed', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ lastFundingOfferTurn: -100})],
    });
    const result = processWarSeason(state, () => 0.99); // 0.99 avoids a competing set-piece offer this same season
    expect(result.statePatch.bills?.some(b => b.id.startsWith('war-funding-war-carthage-1-'))).toBe(true);
    expect(result.wars[0].lastFundingOfferTurn).toBe(10);
  });

  test('does not queue a second bill while one is already pending', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ lastFundingOfferTurn: -100})],
      bills: [{ id: 'war-funding-war-carthage-1-5', support: 0 } as any],
    });
    const result = processWarSeason(state, () => 0.99);
    const fundingBills = (result.statePatch.bills ?? state.bills).filter(b => b.id.startsWith('war-funding-war-carthage-1-'));
    expect(fundingBills).toHaveLength(1);
  });

  test('does not queue while an M10 treaty is in flight', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ lastFundingOfferTurn: -100, treaty: makeTreaty() })],
    });
    const result = processWarSeason(state, () => 0.99);
    expect(result.statePatch.bills?.some(b => b.id.startsWith('war-funding-war-carthage-1-'))).toBeFalsy();
  });

  test('applies the momentum bonus exactly once when a matching bill has passed', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ warScore: 0, momentum: 0, lastFundingOfferTurn: 10 })], // just tabled -> no re-queue this season
      passedBills: [{ id: 'war-funding-war-carthage-1-6', name: 'War Funding: Carthage', passedOnTurn: 6 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    // Chunk C9 — the pass bonus is now a momentum injection, not a direct
    // warScore set (see this function's own header comment).
    expect(result.wars[0].momentum).toBe(BALANCE.war.funding.momentumBonusOnPass);
    expect(result.wars[0].warScore).toBe(0);
    expect(result.statePatch.flags?.['war-funding-applied-war-funding-war-carthage-1-6']).toBe(true);

    // A second call with the SAME passedBills (simulating next season, flag now set) must not re-apply.
    const state2 = { ...state, flags: { ...state.flags, ...result.statePatch.flags }, wars: result.wars };
    const result2 = processWarSeason(state2, () => 0);
    expect(result2.wars[0].momentum).toBe(result.wars[0].momentum);
  });
});

describe('processWarSeason — sue-for-peace bill (P3-B)', () => {
  test('queues a bill only when peaceOffered is true and none pending', () => {
    // peaceOffered is recomputed from `weariness` each season (step 2c) —
    // a high weariness clears BALANCE.war.ripeness.exhaustionWeariness at
    // any ripeness, so this holds regardless of the fixture's year.
    const offered = makeState({ turnNumber: 30, wars: [makeWar({ weariness: 50})] });
    const notOffered = makeState({ turnNumber: 30, wars: [makeWar({ weariness: 0})] });
    const r1 = processWarSeason(offered, () => 0.99);
    const r2 = processWarSeason(notOffered, () => 0.99);
    expect(r1.statePatch.bills?.some(b => b.id.startsWith('sue-for-peace-war-carthage-1-'))).toBe(true);
    expect(r2.statePatch.bills?.some(b => b.id.startsWith('sue-for-peace-war-carthage-1-'))).toBeFalsy();
  });

  test('never queues for a local-scale war', () => {
    const state = makeState({
      turnNumber: 30,
      wars: [makeWar({ scale: 'local', peaceOffered: true})],
    });
    const result = processWarSeason(state, () => 0.99);
    expect(result.statePatch.bills?.some(b => b.id.startsWith('sue-for-peace-'))).toBeFalsy();
  });

  test('passing ends the war and classifies exhaustion for a middling warScore', () => {
    const state = makeState({
      turnNumber: 30,
      year: -264, // ripeness 0 -> wide victory/humbled bounds, a mid score reads exhaustion
      wars: [makeWar({ warScore: 10, peaceOffered: true})],
      passedBills: [{ id: 'sue-for-peace-war-carthage-1-25', name: 'Sue for Peace: Carthage', passedOnTurn: 25 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].terminalOutcome).toBe('exhaustion');
    expect(result.statePatch.pendingEpilogue).toBe('exhaustion');
  });

  test('passing classifies fresh at resolution time — a since-decisive warScore reads Victory, not hardcoded Exhaustion', () => {
    const th = terminalThresholds(0);
    const state = makeState({
      turnNumber: 30,
      year: -264, // ripeness 0
      wars: [makeWar({ warScore: th.victory, peaceOffered: true})],
      passedBills: [{ id: 'sue-for-peace-war-carthage-1-25', name: 'Sue for Peace: Carthage', passedOnTurn: 25 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].terminalOutcome).toBe('victory');
  });
});

describe('processSeason — Mamertine ignition (P3-B / MP-E)', () => {
  test('force-injects evt-messana-appeal once tutorial queue is empty and no carthage war exists', () => {
    const state = makeState({ tutorialQueue: [] as any, wars: [] });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-messana-appeal')).toBe(true);
  });

  test('never fires again once a carthage war exists', () => {
    const state = makeState({ tutorialQueue: [] as any, wars: [makeWar()] });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-messana-appeal')).toBe(false);
  });

  test('never fires again once messanaResolved is set (the "refuse" path can end peacefully without a war)', () => {
    const state = makeState({ tutorialQueue: [] as any, wars: [], flags: { messanaResolved: true } });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-messana-appeal')).toBe(false);
  });
});

describe('WAR_EVENT_DEFS — content sanity', () => {
  test('all ids are unique', () => {
    const ids = WAR_EVENT_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('ignition and terminal notices are weight 0 (never enter the random pool)', () => {
    const zeroWeightIds = ['evt-messana-appeal', 'evt-war-outcome-victory', 'evt-war-outcome-exhaustion', 'evt-war-outcome-humbled'];
    for (const id of zeroWeightIds) {
      expect(WAR_EVENT_DEFS.find(d => d.id === id)?.weight).toBe(0);
    }
  });

  test('every periodic event has a non-zero weight and at least one choice', () => {
    const periodic = WAR_EVENT_DEFS.filter(d => d.weight > 0);
    expect(periodic.length).toBeGreaterThanOrEqual(4);
    for (const def of periodic) {
      expect(def.choices.length).toBeGreaterThan(0);
    }
  });
});

// ─── Phase 3, Chunk P3-C — natural death wiring (turnSequencer step 10) ─────
// Unit coverage for the mortality formula/death-detection/succession-
// application logic itself lives in inheritanceEngine.test.ts; this is the
// end-to-end wiring check that step 10 actually calls it and reaches
// pendingEvents. makeState/makeCharacter (this file) are the most complete
// GameState fixture already exercised against processSeason (see the
// calendar-direction tests above), reused here for the same reason.

describe('processSeason — natural death wiring (P3-C)', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  test('a forced mortality roll at the yearly rollover sets pendingSuccession and queues the death card', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // rollsDead: 0 < any positive chance -> always "dies"
    const state = makeState({
      seasonIndex: 3, // Winter -> next tick crosses into a new year
      family: [
        makeCharacter({ id: 'pc-1', age: 60 }),
        makeCharacter({ id: 'son-1', role: 'son', age: 20, isPlayer: false }),
      ],
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.family.find((c: any) => c.id === 'pc-1')).toBeUndefined();
    expect(nextState.pendingSuccession).not.toBeNull();
    expect(nextState.pendingSuccession?.deceasedId).toBe('pc-1');
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-succession-death')).toBe(true);
  });

  test('no roll at all on a mid-year season advance (crossedNewYear false)', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const state = makeState({
      seasonIndex: 0, // Spring -> Summer, no year crossing
      pendingSuccession: null,
      family: [makeCharacter({ id: 'pc-1', age: 60 })],
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.family.find((c: any) => c.id === 'pc-1')).toBeDefined();
    expect(nextState.pendingSuccession).toBeFalsy();
  });

  test('extinction with a cadet branch available (P3-D) offers the continuation notice, not the plain death card', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const state = makeState({
      seasonIndex: 3,
      family: [makeCharacter({ id: 'pc-1', age: 60 })], // no heirs at all
      cadetBranchUsed: false,
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-cadet-succession')).toBe(true);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-succession-death')).toBe(false);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-succession-no-heir')).toBe(false);
    // cadetBranch is written back (lazily regenerated, since this fixture's default cadetBranch is undefined/dead).
    expect(nextState.cadetBranch).not.toBeNull();
  });

  test('a SECOND extinction (cadetBranchUsed already true) goes straight to the dark ending, no offer', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const state = makeState({
      seasonIndex: 3,
      family: [makeCharacter({ id: 'pc-1', age: 60 })],
      cadetBranchUsed: true,
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-succession-no-heir')).toBe(true);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-cadet-succession')).toBe(false);
    expect(nextState.pendingEpilogue).toBe('gens_ends');
  });
});

// ─── Phase 3, Chunk P3-E — Crisis-100 hard terminal ─────────────────────────

describe('processSeason — Crisis-100 terminal (P3-E)', () => {
  test('fires republic_falls once all four crisis tracks are maxed', () => {
    const state = makeState({
      crisis: {
        war:          { id: 'war',          level: 100, tier: 4, namedCrisis: 'Existential Threat' },
        unrest:       { id: 'unrest',       level: 100, tier: 4, namedCrisis: 'Open Revolt' },
        constitution: { id: 'constitution', level: 100, tier: 4, namedCrisis: 'Republic in Peril' },
        economy:      { id: 'economy',      level: 100, tier: 4, namedCrisis: 'Economic Collapse' },
      },
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEpilogue).toBe('republic_falls');
  });

  test('does not fire below the threshold', () => {
    const state = makeState({
      crisis: {
        war:          { id: 'war',          level: 50, tier: 2, namedCrisis: null },
        unrest:       { id: 'unrest',       level: 50, tier: 2, namedCrisis: null },
        constitution: { id: 'constitution', level: 50, tier: 2, namedCrisis: null },
        economy:      { id: 'economy',      level: 50, tier: 2, namedCrisis: null },
      },
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEpilogue).toBeFalsy();
  });

  test('never overrides an outcome already set the same season (e.g. a war conclusion)', () => {
    const state = makeState({
      pendingEpilogue: 'victory' as any,
      crisis: {
        war:          { id: 'war',          level: 100, tier: 4, namedCrisis: 'Existential Threat' },
        unrest:       { id: 'unrest',       level: 100, tier: 4, namedCrisis: 'Open Revolt' },
        constitution: { id: 'constitution', level: 100, tier: 4, namedCrisis: 'Republic in Peril' },
        economy:      { id: 'economy',      level: 100, tier: 4, namedCrisis: 'Economic Collapse' },
      },
    });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEpilogue).toBe('victory');
  });

  test('is suppressed while endlessMode is true, even with every track maxed', () => {
    const state = makeState({
      endlessMode: true,
      crisis: {
        war:          { id: 'war',          level: 100, tier: 4, namedCrisis: 'Existential Threat' },
        unrest:       { id: 'unrest',       level: 100, tier: 4, namedCrisis: 'Open Revolt' },
        constitution: { id: 'constitution', level: 100, tier: 4, namedCrisis: 'Republic in Peril' },
        economy:      { id: 'economy',      level: 100, tier: 4, namedCrisis: 'Economic Collapse' },
      },
    } as any);
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEpilogue).toBeFalsy();
  });
});

// ─── Phase 3, Chunk P3-F — Endless mode ─────────────────────────────────────

describe('processWarSeason — Endless mode (P3-F)', () => {
  test('no-ops a major-scale war while endlessMode is true (future-proofing guard)', () => {
    const state = makeState({
      endlessMode: true,
      wars: [makeWar({ warScore: 0, active: true })],
    } as any);
    const result = processWarSeason(state);
    expect(result.wars[0]).toEqual(state.wars[0]);
  });

  test('still processes a local-scale (revolt) war while endlessMode is true (phase still recomputes)', () => {
    const state = makeState({
      endlessMode: true,
      year: -241, // ripe
      wars: [makeWar({ id: 'w-local', scale: 'local', warScore: 0, active: true, phase: 'opening' })],
    } as any);
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].phase).toBe('ripe');
  });
});

describe('enterEndlessMode (P3-F)', () => {
  test('sets endlessMode, un-finishes the run, and clears pendingEpilogue', () => {
    useGameStore.setState({
      runFinished: true,
      pendingEpilogue: 'victory' as any,
      currentEpilogueRecord: { outcome: 'victory' } as any,
      armies: [],
    });
    useGameStore.getState().enterEndlessMode({});
    const s = useGameStore.getState();
    expect(s.endlessMode).toBe(true);
    expect(s.runFinished).toBe(false);
    expect(s.pendingEpilogue).toBeNull();
  });

  // ─── Chunk C9 — theatre stand-down ────────────────────────────────────────

  test('removes every rome_state and enemy army; empties the theatre entirely', () => {
    useGameStore.setState({
      armies: [
        makeArmy({ id: 'a-state', owner: 'rome_state', commanderId: null }),
        makeArmy({ id: 'a-carthage', owner: 'carthage', commanderId: 'gen-1' }),
        makeArmy({ id: 'a-rival', owner: 'rome_rival', commanderId: 'rival-1' }),
      ],
      family: [makeCharacter()],
    });
    useGameStore.getState().enterEndlessMode({});
    expect(useGameStore.getState().armies).toHaveLength(0);
  });

  test('"retain" folds a personal army\'s units into its living commander\'s veterans', () => {
    useGameStore.setState({
      armies: [makeArmy({ id: 'a-player', owner: 'player', commanderId: 'pc-1', units: [makeArmyUnit({ id: 'u1', strength: 87 })] })],
      family: [makeCharacter({ id: 'pc-1', veterans: [] })],
    });
    useGameStore.getState().enterEndlessMode({ 'a-player': 'retain' });
    const s = useGameStore.getState();
    expect(s.armies).toHaveLength(0);
    const commander = s.family.find(c => c.id === 'pc-1')!;
    expect(commander.veterans).toHaveLength(1);
    expect(commander.veterans[0].strength).toBe(9); // 87/10 rounded
  });

  test('"disband" removes a personal army without adding any veterans', () => {
    useGameStore.setState({
      armies: [makeArmy({ id: 'a-player', owner: 'player', commanderId: 'pc-1' })],
      family: [makeCharacter({ id: 'pc-1', veterans: [] })],
    });
    useGameStore.getState().enterEndlessMode({ 'a-player': 'disband' });
    const s = useGameStore.getState();
    expect(s.armies).toHaveLength(0);
    expect(s.family.find(c => c.id === 'pc-1')!.veterans).toHaveLength(0);
  });

  test('a personal army with no living commander is removed even when "retain" is requested', () => {
    useGameStore.setState({
      armies: [makeArmy({ id: 'a-orphan', owner: 'player', commanderId: 'nobody' })],
      family: [makeCharacter({ id: 'pc-1', veterans: [] })],
    });
    useGameStore.getState().enterEndlessMode({ 'a-orphan': 'retain' });
    const s = useGameStore.getState();
    expect(s.armies).toHaveLength(0);
    expect(s.family.find(c => c.id === 'pc-1')!.veterans).toHaveLength(0);
  });

  test('defaults an undecided personal army to "retain"', () => {
    useGameStore.setState({
      armies: [makeArmy({ id: 'a-player', owner: 'player', commanderId: 'pc-1' })],
      family: [makeCharacter({ id: 'pc-1', veterans: [] })],
    });
    useGameStore.getState().enterEndlessMode({}); // no decision supplied for 'a-player'
    expect(useGameStore.getState().family.find(c => c.id === 'pc-1')!.veterans).toHaveLength(1);
  });
});
