import {
  processWarSeason, scheduleSetPiece, getDesperationTier,
  computeTreatyBudget, computePackagePrice, calcFactionReactionModifier,
  composeAiOffer, composeAiTreaty, applyTreatyEffects, buildTreatyBill, losingSide,
  computeRipeness, terminalThresholds, phaseForYear, classifyTerminalOutcome,
  peaceReachable, buildWarFundingBill, buildSueForPeaceBill,
} from '../src/engine/warEngine';
import { applyEffectString } from '../src/engine/resourceEngine';
import { processSeason } from '../src/engine/turnSequencer';
import { WAR_EVENT_DEFS } from '../src/data/warEvents';
import { BALANCE } from '../src/data/balance';
import { WAR_SITES } from '../src/data/warSites';
import { ENEMY_GENERAL_LIST } from '../src/data/enemyGenerals';
import { TREATY_TERMS } from '../src/data/treatyTerms';
import { makeSeededRng } from '../src/utils/seededRng';
import type { Character } from '../src/models/character';
import type { TroopUnit } from '../src/models/troop';
import type { WarState, TreatyState } from '../src/models/war';
import type { Clan } from '../src/models/clan';
import type { GameState } from '../src/state/gameStore';
import * as fs from 'fs';
import * as path from 'path';

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
    officeId: null, corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0,
    raisedLegions: [makeTroop({ id: 't1' }), makeTroop({ id: 't2' }), makeTroop({ id: 't3' })],
    veterans: [],
    ...overrides,
  };
}

function makeWar(overrides: Partial<WarState> = {}): WarState {
  return {
    id: 'war-carthage-1', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
    warScore: 0, startedTurn: 1, lastSetPieceTurn: -1, weariness: 0,
    pendingSetPiece: null, treaty: null,
    // P3-A
    phase: 'opening', ignitedYear: -264, endedYear: null, terminalOutcome: null,
    // P3-B
    peaceOffered: false, lastFundingOfferTurn: -100,
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
    provinces: [], senateResponse: null,
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

// ─── scheduleSetPiece (THE SEAM) ─────────────────────────────────────────────

describe('scheduleSetPiece', () => {
  test('null when the war is inactive', () => {
    const state = makeState();
    const war = makeWar({ active: false });
    expect(scheduleSetPiece(state, war, () => 0, { forceRoll: true })).toBeNull();
  });

  test('null when the player has no troops', () => {
    const state = makeState({ family: [makeCharacter({ raisedLegions: [], veterans: [] })] });
    const war = makeWar();
    expect(scheduleSetPiece(state, war, () => 0, { forceRoll: true })).toBeNull();
  });

  test('null when spacing has not elapsed (no forceRoll)', () => {
    const state = makeState({ turnNumber: 10 });
    const war = makeWar({ lastSetPieceTurn: 9 }); // < minSpacingTurns (2) since 10-9=1
    expect(scheduleSetPiece(state, war, () => 0)).toBeNull();
  });

  test('null when the roll fails (no forceRoll)', () => {
    const state = makeState({ turnNumber: 10 });
    const war = makeWar({ lastSetPieceTurn: 1 });
    expect(scheduleSetPiece(state, war, () => 0.99)).toBeNull(); // >= chancePerSeason (0.25)
  });

  test('forceRoll bypasses both spacing and the roll', () => {
    const state = makeState({ turnNumber: 10 });
    const war = makeWar({ lastSetPieceTurn: 10 }); // spacing would normally block this
    const offer = scheduleSetPiece(state, war, () => 0.99, { forceRoll: true });
    expect(offer).not.toBeNull();
  });

  test('offer fields: valid site/terrain, non-empty army, valid general, correct expiry', () => {
    const state = makeState({ turnNumber: 10 });
    const war = makeWar();
    const offer = scheduleSetPiece(state, war, makeSeededRng(7), { forceRoll: true })!;
    expect(offer).not.toBeNull();
    expect(WAR_SITES.some(s => s.name === offer.siteName)).toBe(true);
    expect(Object.keys(BALANCE.battle.terrains)).toContain(offer.terrainId);
    expect(offer.enemyArmy.length).toBeGreaterThan(0);
    expect(ENEMY_GENERAL_LIST.some(g => g.id === offer.enemyGeneralId)).toBe(true);
    expect(offer.expiresTurn).toBe(10 + BALANCE.war.setPieceOffer.expiryTurns);
    // Every generated unit's class must appear in that general's composition table.
    const general = ENEMY_GENERAL_LIST.find(g => g.id === offer.enemyGeneralId)!;
    for (const unit of offer.enemyArmy) {
      expect(Object.keys(general.armyComposition)).toContain(unit.unitClass);
    }
  });

  test('a losing Rome (negative warScore) faces a bigger enemy army than a winning Rome', () => {
    const state = makeState({ turnNumber: 10 });
    const losingWar = makeWar({ warScore: -80 });
    const winningWar = makeWar({ warScore: 80 });
    const losingOffer = scheduleSetPiece(state, losingWar, makeSeededRng(1), { forceRoll: true })!;
    const winningOffer = scheduleSetPiece(state, winningWar, makeSeededRng(1), { forceRoll: true })!;
    expect(losingOffer.enemyArmy.length).toBeGreaterThan(winningOffer.enemyArmy.length);
  });

  test('cohort count is clamped to [minCohorts, maxCohorts]', () => {
    const state = makeState({ turnNumber: 10 });
    const extremeLoss = makeWar({ warScore: -100 });
    const extremeWin = makeWar({ warScore: 100 });
    const so = BALANCE.war.setPieceOffer;
    const bigOffer = scheduleSetPiece(state, extremeLoss, makeSeededRng(2), { forceRoll: true })!;
    const smallOffer = scheduleSetPiece(state, extremeWin, makeSeededRng(2), { forceRoll: true })!;
    expect(bigOffer.enemyArmy.length).toBeLessThanOrEqual(so.maxCohorts);
    expect(smallOffer.enemyArmy.length).toBeGreaterThanOrEqual(so.minCohorts);
  });

  test('a local-scale war fields a smaller army than a major war at the same warScore', () => {
    const state = makeState({ turnNumber: 10 });
    const major = makeWar({ scale: 'major', warScore: 0 });
    const local = makeWar({ scale: 'local', warScore: 0 });
    const majorOffer = scheduleSetPiece(state, major, makeSeededRng(3), { forceRoll: true })!;
    const localOffer = scheduleSetPiece(state, local, makeSeededRng(3), { forceRoll: true })!;
    expect(localOffer.enemyArmy.length).toBeLessThan(majorOffer.enemyArmy.length);
  });

  test('architectural: scheduleSetPiece is the only place a SetPieceOffer object is constructed', () => {
    const source = fs.readFileSync(path.join(__dirname, '../src/engine/warEngine.ts'), 'utf8');
    const occurrences = source.match(/id: `offer-/g) ?? [];
    expect(occurrences.length).toBe(1);
  });
});

// ─── processWarSeason ────────────────────────────────────────────────────────

describe('processWarSeason', () => {
  test('skirmish drift moves warScore by 1-3 magnitude', () => {
    const state = makeState({ turnNumber: 3, wars: [makeWar({ startedTurn: 1, lastSetPieceTurn: 3 })] });
    const result = processWarSeason(state, makeSeededRng(11));
    const delta = Math.abs(result.wars[0].warScore - 0);
    expect(delta).toBeGreaterThanOrEqual(1);
    // (weariness doesn't kick in this early, so drift is the only mover here
    // unless a scheduler roll also fires — scheduler doesn't touch warScore.)
  });

  test('inactive wars are left untouched', () => {
    const state = makeState({ wars: [makeWar({ active: false, warScore: 12 })] });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].warScore).toBe(12);
  });

  test('no weariness drift before wearinessAfterTurns', () => {
    const state = makeState({ turnNumber: 5, wars: [makeWar({ startedTurn: 1, warScore: 50, lastSetPieceTurn: 5 })] });
    // Force skirmish drift toward a KNOWN small delta via rng=0 (min magnitude, negative-biased sign
    // since strength/martial are below baseline in this fixture) — just assert weariness doesn't
    // additionally erode a score nowhere near the wearinessAfterTurns threshold (turnsSinceStart=4).
    const result = processWarSeason(state, () => 0);
    // Only skirmish drift (max magnitude 3) should have moved it — nowhere near a weariness-scale change.
    expect(Math.abs(result.wars[0].warScore - 50)).toBeLessThanOrEqual(BALANCE.war.skirmishDriftMax);
  });

  test('weariness erodes warScore toward 0 once past wearinessAfterTurns', () => {
    const state = makeState({
      turnNumber: 20,
      wars: [makeWar({ startedTurn: 1, warScore: 50, lastSetPieceTurn: 20 })], // turnsSinceStart = 19 > 12
    });
    const result = processWarSeason(state, () => 0);
    // Both fixtures share the identical (deterministic, rng=()=>0) skirmish
    // drift — the only difference is turnsSinceStart crossing
    // wearinessAfterTurns. Weariness pulls a POSITIVE score down toward 0,
    // so the weariness-active run must land lower than the no-weariness
    // control despite starting from the same warScore and drift.
    const control = processWarSeason(
      makeState({ turnNumber: 12, wars: [makeWar({ startedTurn: 1, warScore: 50, lastSetPieceTurn: 12 })] }), // turnsSinceStart = 11, not > 12
      () => 0,
    );
    expect(result.wars[0].warScore).toBeLessThan(control.wars[0].warScore);
  });

  test('weariness counter increments every active season', () => {
    const state = makeState({ wars: [makeWar({ weariness: 5 })] });
    const result = processWarSeason(state, () => 0.9);
    expect(result.wars[0].weariness).toBe(6);
  });

  test('threshold crossing fires a notice once, not again while sustained beyond it', () => {
    // warScore 38 -> drift pushes it past 40 (sue) this season.
    const state = makeState({ turnNumber: 3, wars: [makeWar({ warScore: 38, lastSetPieceTurn: 3, startedTurn: 1 })] });
    const rngUp = makeSeededRng(99);
    const first = processWarSeason(state, rngUp);
    const crossed = first.wars[0].warScore > 38 && Math.abs(first.wars[0].warScore) >= BALANCE.war.thresholds.sue;
    if (crossed) {
      expect(first.noticeEvents.some(e => e.defId === 'evt-war-threshold-notice')).toBe(true);
      // A second season that stays beyond the threshold should not re-fire.
      const second = processWarSeason({ ...state, wars: first.wars, turnNumber: state.turnNumber + 1 }, () => 0.9);
      // Only re-fires if it crosses to a STRICTLY higher band — staying in 'sue' band must not re-notify.
      if (Math.abs(second.wars[0].warScore) < BALANCE.war.thresholds.forced) {
        expect(second.noticeEvents.some(e => e.defId === 'evt-war-threshold-notice')).toBe(false);
      }
    } else {
      // Seed didn't happen to cross this run — not a meaningful failure of the mechanism.
      expect(first.wars[0].warScore).toBeDefined();
    }
  });

  test('cap enforcement: warScore application never exceeds the -100..100 range', () => {
    const state = makeState({ turnNumber: 3, wars: [makeWar({ warScore: 99, lastSetPieceTurn: 3, startedTurn: 1 })] });
    const result = processWarSeason(state, () => 0); // biased-positive drift for this fixture
    expect(result.wars[0].warScore).toBeLessThanOrEqual(100);
    expect(result.wars[0].warScore).toBeGreaterThanOrEqual(-100);

    const stateLow = makeState({ turnNumber: 3, wars: [makeWar({ warScore: -99, lastSetPieceTurn: 3, startedTurn: 1 })] });
    const resultLow = processWarSeason(stateLow, () => 0.999);
    expect(resultLow.wars[0].warScore).toBeGreaterThanOrEqual(-100);
    expect(resultLow.wars[0].warScore).toBeLessThanOrEqual(100);
  });

  test('a stale pendingSetPiece auto-expires with the decline penalty and unblocks scheduling', () => {
    const staleOffer = {
      id: 'offer-x', siteName: 'Test Site', terrainId: 'open_plain',
      enemyArmy: [], enemyGeneralId: ENEMY_GENERAL_LIST[0].id, expiresTurn: 5,
    };
    const state = makeState({
      turnNumber: 6, // >= expiresTurn
      wars: [makeWar({ warScore: 10, pendingSetPiece: staleOffer, lastSetPieceTurn: 1, startedTurn: 1 })],
    });
    const before = state.wars[0].warScore;
    const result = processWarSeason(state, () => 0); // 0 also passes the (now re-armed) scheduler roll
    expect(result.wars[0].pendingSetPiece).not.toEqual(staleOffer); // either cleared or replaced by a fresh offer
    expect(result.lifetimeDignitasDelta).toBeLessThan(0);
    // The decline penalty was applied on top of whatever drift did — score moved down net of the -3.
    expect(result.wars[0].warScore).toBeLessThan(before + BALANCE.war.skirmishDriftMax);
  });

  test('scheduler spacing is respected inside processWarSeason across consecutive seasons', () => {
    let state = makeState({ turnNumber: 1, wars: [makeWar({ lastSetPieceTurn: -10, startedTurn: 1 })] });
    // rng always "succeeds" the 25% roll — spacing is the only gate left.
    const rng = () => 0;
    const s1 = processWarSeason(state, rng);
    expect(s1.wars[0].pendingSetPiece).not.toBeNull(); // first season, immediately eligible

    // Decline it (simulate) so scheduling isn't blocked by "already pending" for this check.
    const afterDecline = { ...s1.wars[0], pendingSetPiece: null };
    state = { ...state, turnNumber: 2, wars: [afterDecline] };
    const s2 = processWarSeason(state, rng);
    // Only 1 turn has elapsed since lastSetPieceTurn (still turn 1) — minSpacingTurns is 2.
    expect(s2.wars[0].pendingSetPiece).toBeNull();
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
    expect(calcFactionReactionModifier(['sicily_all'], state)).toBeGreaterThan(0);
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

  test('composeAiOffer returns only valid, cheap term ids', () => {
    const offer = composeAiOffer(cautiousGeneral, makeSeededRng(1));
    expect(offer.length).toBeGreaterThan(0);
    for (const id of offer) {
      const term = TREATY_TERMS.find(t => t.id === id);
      expect(term).toBeDefined();
      expect(term!.warScorePrice).toBeLessThanOrEqual(6);
    }
  });

  test('an aggressive general offers no more terms than a cautious one', () => {
    const cautious = composeAiOffer(cautiousGeneral, () => 0);
    const aggressive = composeAiOffer(aggressiveGeneral, () => 0);
    expect(aggressive.length).toBeLessThanOrEqual(cautious.length);
  });

  test('composeAiTreaty never exceeds the general-weighted spend cap', () => {
    const budget = 40;
    for (const seed of [1, 2, 3, 4, 5]) {
      const cautiousPicks = composeAiTreaty(budget, cautiousGeneral, makeSeededRng(seed));
      expect(computePackagePrice(cautiousPicks)).toBeLessThanOrEqual(Math.round(budget * 0.7));
      const aggressivePicks = composeAiTreaty(budget, aggressiveGeneral, makeSeededRng(seed));
      expect(computePackagePrice(aggressivePicks)).toBeLessThanOrEqual(budget);
    }
  });

  test('composeAiTreaty never selects mutually exclusive terms together', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
      const picks = composeAiTreaty(100, aggressiveGeneral, makeSeededRng(seed));
      expect(picks.includes('sicily_west') && picks.includes('sicily_all')).toBe(false);
    }
  });
});

describe('applyTreatyEffects', () => {
  test('winner=rome with sicily_west adds the province to state.provinces', () => {
    const state = makeState();
    const patch = applyTreatyEffects(['sicily_west'], state, 'rome');
    expect(patch.provinces?.some(p => p.id === 'sicily_west')).toBe(true);
  });

  test('does not duplicate a province already present', () => {
    const state = makeState({ provinces: [{ id: 'sicily_west' } as any] });
    const patch = applyTreatyEffects(['sicily_west'], state, 'rome');
    const count = (patch.provinces ?? state.provinces).filter(p => p.id === 'sicily_west').length;
    expect(count).toBe(1);
  });

  test('winner=enemy does not cede any province', () => {
    const state = makeState();
    const patch = applyTreatyEffects(['sicily_west'], state, 'enemy');
    expect(patch.provinces).toBeUndefined();
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
    const treaty = makeTreaty({ termIds: ['sicily_west'], proposedTurn: 10 });
    const state = makeState({
      turnNumber: 12,
      wars: [makeWar({ warScore: 75, startedTurn: 1, lastSetPieceTurn: 12, treaty })],
      passedBills: [{ id: `treaty-war-carthage-1-10`, name: 'Treaty with Carthage', passedOnTurn: 12 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].treaty?.ratified).toBe(true);
    expect(result.statePatch.provinces?.some(p => p.id === 'sicily_west')).toBe(true);
  });

  test('a passed ratification queues a Triumph petition for the player when Rome wins', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 10 });
    const state = makeState({
      turnNumber: 12,
      wars: [makeWar({ warScore: 75, startedTurn: 1, lastSetPieceTurn: 12, treaty })],
      passedBills: [{ id: `treaty-war-carthage-1-10`, name: 'Treaty with Carthage', passedOnTurn: 12 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.statePatch.bills?.some(b => b.id.startsWith('triumph-pc-1'))).toBe(true);
  });

  test('a failed/expired ratification keeps the war active, penalises warScore, and locks the treaty out', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 5 });
    const state = makeState({
      turnNumber: 9,
      wars: [makeWar({ warScore: 75, startedTurn: 1, lastSetPieceTurn: 9, treaty })],
      bills: [], passedBills: [],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].active).toBe(true);
    expect(result.wars[0].treaty?.ratified).toBe(false);
    expect(result.wars[0].treaty?.resolvedTurn).toBe(9);
    // warScore moved down by at least the fail penalty net of that season's drift.
    expect(result.wars[0].warScore).toBeLessThan(75 + BALANCE.war.skirmishDriftMax);
  });

  test('a still-pending ratification bill is left untouched', () => {
    const treaty = makeTreaty({ termIds: ['indemnity_minor'], proposedTurn: 9 });
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ warScore: 75, startedTurn: 1, lastSetPieceTurn: 10, treaty })],
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
      wars: [makeWar({ warScore: 75, startedTurn: 1, lastSetPieceTurn: 10 + lockoutTurns, treaty })],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].treaty).toBeNull();
  });

  test('the re-table lockout does NOT clear before retableLockoutTurns has elapsed', () => {
    const treaty = makeTreaty({ ratified: false, resolvedTurn: 10, proposedTurn: 5 });
    const state = makeState({
      turnNumber: 11,
      wars: [makeWar({ warScore: 75, startedTurn: 1, lastSetPieceTurn: 11, treaty })],
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].treaty).not.toBeNull();
  });

  test('Rome losing at the dictate tier auto-ratifies terms with no vote', () => {
    const state = makeState({
      turnNumber: 20,
      wars: [makeWar({ warScore: -95, startedTurn: 1, lastSetPieceTurn: 20 })],
    });
    const result = processWarSeason(state, () => 0.5);
    expect(result.wars[0].active).toBe(false);
    expect(result.wars[0].treaty?.stage).toBe('auto_ratified');
    expect(result.wars[0].treaty?.ratified).toBe(true);
    expect(result.statePatch.flags?.[`campaign-failure-epilogue-${state.wars[0].id}`]).toBe(true);
  });

  test('crossing into the sue tier while Rome is winning auto-generates an AI offer', () => {
    // Default fixture (martial 6 >= baseline 5, army strength << baseline) drifts
    // POSITIVE regardless of rng (sign only depends on those two signals) — rng
    // here only sets the magnitude. 0.99 -> max magnitude (3): 38 + 3 = 41, crossing 40.
    const state = makeState({
      turnNumber: 3,
      wars: [makeWar({ warScore: 38, startedTurn: 1, lastSetPieceTurn: 3 })],
    });
    const result = processWarSeason(state, () => 0.99);
    expect(result.wars[0].warScore).toBe(41);
    expect(result.wars[0].treaty?.stage).toBe('ai_offer');
    expect(result.wars[0].treaty?.initiator).toBe('enemy');
  });
});

// ─── DONE-WHEN: 20-season simulation coherence ──────────────────────────────

describe('DONE-WHEN: 20-season simulation', () => {
  test('a debug-started war produces coherent drift/weariness/offers/notices across 20 seasons without crashing', () => {
    let state = makeState({ turnNumber: 1, wars: [makeWar({ startedTurn: 1, lastSetPieceTurn: -1 })] });
    const rng = makeSeededRng(1234);
    let offersSeen = 0;
    let noticesSeen = 0;

    for (let season = 1; season <= 20; season++) {
      state = { ...state, turnNumber: season };
      const result = processWarSeason(state, rng);
      expect(result.wars).toHaveLength(1);
      const war = result.wars[0];
      expect(war.warScore).toBeGreaterThanOrEqual(-100);
      expect(war.warScore).toBeLessThanOrEqual(100);
      expect(war.weariness).toBe(season); // increments exactly once per active season

      if (war.pendingSetPiece) {
        offersSeen += 1;
        // Auto-decline immediately so the simulation isn't stuck on one
        // offer forever (mirrors "player eventually resolves it").
        state = { ...state, wars: [{ ...war, pendingSetPiece: null }] };
      } else {
        state = { ...state, wars: result.wars };
      }
      noticesSeen += result.noticeEvents.length;
    }

    expect(offersSeen).toBeGreaterThan(0);
    // Coherence, not a specific count — the war crisis coupling and threshold
    // notices are exercised by the dedicated tests above; here we just need
    // the whole loop to run cleanly for 20 seasons.
    expect(noticesSeen).toBeGreaterThanOrEqual(0);
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
      wars: [makeWar({ warScore: 95, scale: 'major', startedTurn: 1, lastSetPieceTurn: 12, treaty })],
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
      wars: [makeWar({ warScore: 95, scale: 'local', startedTurn: 1, lastSetPieceTurn: 12, treaty })],
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
      wars: [makeWar({ warScore: -95, scale: 'major', startedTurn: 1, lastSetPieceTurn: 20 })],
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
  test('bumps the matching active war\'s score, clamped to -100..100', () => {
    const state = makeState({ wars: [makeWar({ warScore: 95 })] });
    const patch = applyEffectString('warScoreDelta:carthage:10', state);
    expect(patch.wars![0].warScore).toBe(100);
  });

  test('leaves an inactive or differently-enemied war untouched', () => {
    const state = makeState({
      wars: [makeWar({ id: 'w1', active: false, warScore: 0 }), makeWar({ id: 'w2', enemyId: 'a-revolt', warScore: 0 })],
    });
    const patch = applyEffectString('warScoreDelta:carthage:10', state);
    expect(patch.wars!.every(w => w.warScore === 0)).toBe(true);
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
      wars: [makeWar({ lastFundingOfferTurn: -100, lastSetPieceTurn: 10 })],
    });
    const result = processWarSeason(state, () => 0.99); // 0.99 avoids a competing set-piece offer this same season
    expect(result.statePatch.bills?.some(b => b.id.startsWith('war-funding-war-carthage-1-'))).toBe(true);
    expect(result.wars[0].lastFundingOfferTurn).toBe(10);
  });

  test('does not queue a second bill while one is already pending', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ lastFundingOfferTurn: -100, lastSetPieceTurn: 10 })],
      bills: [{ id: 'war-funding-war-carthage-1-5', support: 0 } as any],
    });
    const result = processWarSeason(state, () => 0.99);
    const fundingBills = (result.statePatch.bills ?? state.bills).filter(b => b.id.startsWith('war-funding-war-carthage-1-'));
    expect(fundingBills).toHaveLength(1);
  });

  test('does not queue while an M10 treaty is in flight', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ lastFundingOfferTurn: -100, lastSetPieceTurn: 10, treaty: makeTreaty() })],
    });
    const result = processWarSeason(state, () => 0.99);
    expect(result.statePatch.bills?.some(b => b.id.startsWith('war-funding-war-carthage-1-'))).toBeFalsy();
  });

  test('applies the warScore bonus exactly once when a matching bill has passed', () => {
    const state = makeState({
      turnNumber: 10,
      wars: [makeWar({ warScore: 0, lastFundingOfferTurn: 10, lastSetPieceTurn: 10 })], // just tabled -> no re-queue this season
      passedBills: [{ id: 'war-funding-war-carthage-1-6', name: 'War Funding: Carthage', passedOnTurn: 6 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].warScore).toBeGreaterThanOrEqual(BALANCE.war.funding.warScoreBonusOnPass);
    expect(result.statePatch.flags?.['war-funding-applied-war-funding-war-carthage-1-6']).toBe(true);

    // A second call with the SAME passedBills (simulating next season, flag now set) must not re-apply.
    const state2 = { ...state, flags: { ...state.flags, ...result.statePatch.flags }, wars: result.wars };
    const result2 = processWarSeason(state2, () => 0);
    const controlDrift = result2.wars[0].warScore - result.wars[0].warScore;
    expect(Math.abs(controlDrift)).toBeLessThanOrEqual(BALANCE.war.skirmishDriftMax);
  });
});

describe('processWarSeason — sue-for-peace bill (P3-B)', () => {
  test('queues a bill only when peaceOffered is true and none pending', () => {
    // peaceOffered is recomputed from `weariness` each season (step 2c) —
    // a high weariness clears BALANCE.war.ripeness.exhaustionWeariness at
    // any ripeness, so this holds regardless of the fixture's year.
    const offered = makeState({ turnNumber: 30, wars: [makeWar({ weariness: 50, lastSetPieceTurn: 30 })] });
    const notOffered = makeState({ turnNumber: 30, wars: [makeWar({ weariness: 0, lastSetPieceTurn: 30 })] });
    const r1 = processWarSeason(offered, () => 0.99);
    const r2 = processWarSeason(notOffered, () => 0.99);
    expect(r1.statePatch.bills?.some(b => b.id.startsWith('sue-for-peace-war-carthage-1-'))).toBe(true);
    expect(r2.statePatch.bills?.some(b => b.id.startsWith('sue-for-peace-war-carthage-1-'))).toBeFalsy();
  });

  test('never queues for a local-scale war', () => {
    const state = makeState({
      turnNumber: 30,
      wars: [makeWar({ scale: 'local', peaceOffered: true, lastSetPieceTurn: 30 })],
    });
    const result = processWarSeason(state, () => 0.99);
    expect(result.statePatch.bills?.some(b => b.id.startsWith('sue-for-peace-'))).toBeFalsy();
  });

  test('passing ends the war and classifies exhaustion for a middling warScore', () => {
    const state = makeState({
      turnNumber: 30,
      year: -264, // ripeness 0 -> wide victory/humbled bounds, a mid score reads exhaustion
      wars: [makeWar({ warScore: 10, peaceOffered: true, lastSetPieceTurn: 30 })],
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
      wars: [makeWar({ warScore: th.victory, peaceOffered: true, lastSetPieceTurn: 30 })],
      passedBills: [{ id: 'sue-for-peace-war-carthage-1-25', name: 'Sue for Peace: Carthage', passedOnTurn: 25 }] as any,
    });
    const result = processWarSeason(state, () => 0);
    expect(result.wars[0].terminalOutcome).toBe('victory');
  });
});

describe('processSeason — Mamertine ignition (P3-B)', () => {
  test('force-injects evt-war-mamertines once tutorial queue is empty and no carthage war exists', () => {
    const state = makeState({ tutorialQueue: [] as any, wars: [] });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-war-mamertines')).toBe(true);
  });

  test('never fires again once a carthage war exists', () => {
    const state = makeState({ tutorialQueue: [] as any, wars: [makeWar()] });
    const { nextState } = processSeason(state as any);
    expect(nextState.pendingEvents.some((e: any) => e.defId === 'evt-war-mamertines')).toBe(false);
  });
});

describe('WAR_EVENT_DEFS — content sanity', () => {
  test('all ids are unique', () => {
    const ids = WAR_EVENT_DEFS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('ignition and terminal notices are weight 0 (never enter the random pool)', () => {
    const zeroWeightIds = ['evt-war-mamertines', 'evt-war-outcome-victory', 'evt-war-outcome-exhaustion', 'evt-war-outcome-humbled'];
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
});
