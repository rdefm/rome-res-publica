import {
  troopToBattleUnit,
  battleUnitToTroop,
  musterArmy,
  getEligibleFamilyCaptains,
  effectiveMartial,
  offerableLegates,
  applyCharacterDeath,
  resolveRansomChoice,
  applyBattleOutcome,
  promotedVeterancy,
  computeElephantLanes,
  type BattleBridgeContext,
} from '../src/engine/battle/musterEngine';
import { BALANCE } from '../src/data/balance';
import type { Character } from '../src/models/character';
import type { TroopUnit } from '../src/models/troop';
import type { Clan } from '../src/models/clan';
import type { BattleState, BattleOutcome, SideState, WingState, LaneId, BattleUnit } from '../src/models/battle';
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
  };
}

function makeTroop(overrides: Partial<TroopUnit> = {}): TroopUnit {
  return {
    id: 'troop-1', type: 'raised', strength: 8, campaignsSurvived: 0,
    yearsInactive: 0, bondToCommander: 55, musterProvinceId: 'sicilia',
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
  };
  return { ...base, ...overrides } as unknown as GameState;
}

function makeWing(laneId: LaneId, overrides: Partial<WingState> = {}): WingState {
  return {
    laneId, units: [], captainId: null, formation: 'line', moralePool: 60,
    broken: false, engagedRounds: 3, flanked: false, overextended: false,
    ...overrides,
  };
}

function makeSideState(overrides: Partial<SideState> = {}): SideState {
  return {
    label: 'Rome', wings: { left: makeWing('left'), centre: makeWing('centre'), right: makeWing('right') },
    reserve: [], commanderId: null, commanderStation: 'reserve', captainMartialById: {},
    ...overrides,
  };
}

function makeBattleState(overrides: { attacker?: Partial<SideState>; defender?: Partial<SideState> } = {}): BattleState {
  return {
    seed: 1, round: 6, terrain: { id: 'coastal_plain', label: 'Coastal Plain', mods: {} },
    attacker: makeSideState(overrides.attacker),
    defender: makeSideState({ label: 'Carthage', ...overrides.defender }),
    log: [], phase: 'resolved', rngCallsConsumed: 0, pendingBreakDecisions: [],
    amokChanceRiders: {}, startingStrength: { attacker: 300, defender: 300 },
  };
}

let unitCounter = 0;
function makeBattleUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  unitCounter += 1;
  return {
    id: `u${unitCounter}`, unitClass: 'legionary', strength: 80,
    veterancy: 'trained', loyalty: 55, elephantSteady: false,
    ...overrides,
  };
}

function makeOutcome(overrides: Partial<BattleOutcome> = {}): BattleOutcome {
  return {
    victor: 'attacker', tier: 'clear',
    casualties: { attacker: { strengthLost: 30, unitsLost: 1 }, defender: { strengthLost: 80, unitsLost: 3 } },
    captainOutcomes: [],
    warScoreDelta: 12,
    ...overrides,
  };
}

// ─── Troop <-> BattleUnit mapping ─────────────────────────────────────────────

describe('troopToBattleUnit / battleUnitToTroop', () => {
  test('scales strength ×10 and derives veterancy/class defaults', () => {
    const troop = makeTroop({ strength: 7, bondToCommander: 62 });
    const unit = troopToBattleUnit(troop);
    expect(unit.strength).toBe(70);
    expect(unit.unitClass).toBe('legionary');
    expect(unit.veterancy).toBe('raw'); // 'raised' type -> raw
    expect(unit.loyalty).toBe(62);
    expect(unit.sourceRef).toBe(troop.id);
  });

  test('derives veterancy from existing veteran/seasoned_veteran type when absent', () => {
    expect(troopToBattleUnit(makeTroop({ type: 'veteran' })).veterancy).toBe('veteran');
    expect(troopToBattleUnit(makeTroop({ type: 'seasoned_veteran' })).veterancy).toBe('legendary');
  });

  test('respects an already-set veterancy/unitClass over the derived default', () => {
    const troop = makeTroop({ type: 'raised', veterancy: 'legendary', unitClass: 'cavalry_heavy' });
    const unit = troopToBattleUnit(troop);
    expect(unit.veterancy).toBe('legendary');
    expect(unit.unitClass).toBe('cavalry_heavy');
  });

  test('round-trip conserves strength minus casualties, increments campaignsSurvived', () => {
    const troop = makeTroop({ strength: 8, campaignsSurvived: 2 });
    const unit = troopToBattleUnit(troop);
    const afterCasualties = { ...unit, strength: unit.strength - 25 }; // 80 -> 55
    const result = battleUnitToTroop(troop, afterCasualties);
    expect(result?.strength).toBe(6); // round(55/10)
    expect(result?.campaignsSurvived).toBe(3);
  });

  test('a unit reduced to 0 strength is destroyed (null)', () => {
    const troop = makeTroop({ strength: 3 });
    const unit = troopToBattleUnit(troop);
    const destroyed = { ...unit, strength: 0 };
    expect(battleUnitToTroop(troop, destroyed)).toBeNull();
  });
});

describe('musterArmy', () => {
  test('musters both raisedLegions and veterans', () => {
    const character = makeCharacter({
      raisedLegions: [makeTroop({ id: 't1' })],
      veterans: [makeTroop({ id: 't2', type: 'veteran' })],
    });
    const units = musterArmy(character);
    expect(units.map(u => u.id).sort()).toEqual(['t1', 't2']);
  });
});

// ─── Captains & legates ────────────────────────────────────────────────────────

describe('getEligibleFamilyCaptains / effectiveMartial', () => {
  test('excludes under-16s and the commander themselves', () => {
    const family = [
      makeCharacter({ id: 'pc-1' }),
      makeCharacter({ id: 'son-1', role: 'son', age: 17, isPlayer: false }),
      makeCharacter({ id: 'son-2', role: 'son', age: 12, isPlayer: false }),
    ];
    const captains = getEligibleFamilyCaptains(family, 'pc-1', {});
    expect(captains.map(c => c.characterId)).toEqual(['son-1']);
  });

  test('wounded characters fight at reduced martial', () => {
    const character = makeCharacter({ id: 'son-1', skills: { rhetoric: 5, martial: 6, intrigus: 5 } });
    const flags = { [`wounded-cooldown-son-1`]: 4 };
    expect(effectiveMartial(character, {})).toBe(6);
    expect(effectiveMartial(character, flags)).toBe(6 - BALANCE.battle.wounds.martialPenalty);
  });
});

describe('offerableLegates', () => {
  function makeClan(id: string, overrides: Partial<Clan> = {}): Clan {
    return { id, name: `Gens ${id}`, gensName: id, sigil: '🏛️', influence: 50, desc: '', leaders: [], ...overrides } as Clan;
  }

  test('only offers a legate for clans at or above the relationship threshold', () => {
    const clans = [makeClan('cornelii'), makeClan('valerii')];
    const rep = { cornelii: 70, valerii: 30 };
    const offers = offerableLegates(clans, rep, () => 0.5);
    expect(offers.map(o => o.clanId)).toEqual(['cornelii']);
  });

  test('martial is within the 4-7 range', () => {
    const clans = [makeClan('cornelii')];
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      const [offer] = offerableLegates(clans, { cornelii: 80 }, () => roll);
      expect(offer.martial).toBeGreaterThanOrEqual(4);
      expect(offer.martial).toBeLessThanOrEqual(7);
    }
  });
});

// ─── Character death & succession ────────────────────────────────────────────

describe('applyCharacterDeath', () => {
  test('a non-player death just removes the character, no succession', () => {
    const family = [makeCharacter(), makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 20 })];
    const result = applyCharacterDeath(family, 'son-1');
    expect(result.family.map(c => c.id)).toEqual(['pc-1']);
    expect(result.successionOccurred).toBe(false);
  });

  test('paterfamilias death promotes the eldest son', () => {
    const family = [
      makeCharacter({ id: 'pc-1' }),
      makeCharacter({ id: 'son-young', role: 'son', isPlayer: false, age: 14 }),
      makeCharacter({ id: 'son-old', role: 'son', isPlayer: false, age: 22 }),
      makeCharacter({ id: 'daughter-1', role: 'daughter', isPlayer: false, age: 25 }),
    ];
    const result = applyCharacterDeath(family, 'pc-1');
    expect(result.successionOccurred).toBe(true);
    expect(result.newPaterfamiliasId).toBe('son-old');
    const successor = result.family.find(c => c.id === 'son-old')!;
    expect(successor.isPlayer).toBe(true);
    expect(successor.role).toBe('paterfamilias');
    expect(result.family.find(c => c.id === 'pc-1')).toBeUndefined();
  });

  test('falls back to eldest daughter when there is no son, then spouse when there is neither', () => {
    const withDaughter = applyCharacterDeath(
      [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'd-1', role: 'daughter', isPlayer: false, age: 19 })],
      'pc-1',
    );
    expect(withDaughter.newPaterfamiliasId).toBe('d-1');

    const withSpouseOnly = applyCharacterDeath(
      [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'sp-1', role: 'spouse', isPlayer: false, age: 40 })],
      'pc-1',
    );
    expect(withSpouseOnly.newPaterfamiliasId).toBe('sp-1');
  });

  test('no heir at all is handled gracefully (no crash, no successor)', () => {
    const result = applyCharacterDeath([makeCharacter({ id: 'pc-1' })], 'pc-1');
    expect(result.family).toEqual([]);
    expect(result.successionOccurred).toBe(false);
    expect(result.newPaterfamiliasId).toBeNull();
  });
});

// ─── Ransom resolution ────────────────────────────────────────────────────────

describe('resolveRansomChoice', () => {
  function captiveFamily(): Character[] {
    return [
      makeCharacter(),
      makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 20,
        captivity: { status: 'awaiting_ransom', demandDenarii: 150, capturedTurn: 5 } }),
    ];
  }

  test('pay releases the character for the full demand', () => {
    const result = resolveRansomChoice(captiveFamily(), 'son-1', 'pay', 0);
    expect(result.denariiDelta).toBe(-150);
    expect(result.family.find(c => c.id === 'son-1')?.captivity).toBeNull();
  });

  test('negotiate with sufficient intrigus halves the ransom', () => {
    const result = resolveRansomChoice(captiveFamily(), 'son-1', 'negotiate', BALANCE.war.ransom.negotiateIntrigusDifficulty);
    expect(result.denariiDelta).toBe(-Math.round(150 * BALANCE.war.ransom.negotiateSuccessMult));
    expect(result.fidesDelta).toBe(-BALANCE.war.ransom.negotiateFidesCost);
    expect(result.family.find(c => c.id === 'son-1')?.captivity).toBeNull();
  });

  test('negotiate with insufficient intrigus still pays full ransom and spends Fides', () => {
    const result = resolveRansomChoice(captiveFamily(), 'son-1', 'negotiate', BALANCE.war.ransom.negotiateIntrigusDifficulty - 1);
    expect(result.denariiDelta).toBe(-150);
    expect(result.fidesDelta).toBe(-BALANCE.war.ransom.negotiateFidesCost);
  });

  test('refuse imprisons the character and costs lifetime dignitas', () => {
    const result = resolveRansomChoice(captiveFamily(), 'son-1', 'refuse', 0);
    expect(result.denariiDelta).toBe(0);
    expect(result.lifetimeDignitasDelta).toBe(BALANCE.war.ransom.refuseLifetimeDignitasPenalty);
    expect(result.family.find(c => c.id === 'son-1')?.captivity).toEqual(
      expect.objectContaining({ status: 'imprisoned' }),
    );
  });

  test('a character with no pending ransom is a no-op', () => {
    const result = resolveRansomChoice([makeCharacter()], 'pc-1', 'pay', 0);
    expect(result.logMessage).toBe('');
  });
});

// ─── applyBattleOutcome (the full write-back bridge) ────────────────────────

describe('applyBattleOutcome', () => {
  test('muster round-trip: troop write-back conserves strength minus casualties for the commander only', () => {
    const troop1 = makeTroop({ id: 't1', strength: 8 });
    const troop2 = makeTroop({ id: 't2', strength: 6 });
    const otherTroop = makeTroop({ id: 't-other', strength: 9, musterProvinceId: 'latium' });
    const commander = makeCharacter({ id: 'pc-1', raisedLegions: [troop1, troop2] });
    const other = makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 20, raisedLegions: [otherTroop] });
    const state = makeState({ family: [commander, other] });

    const finalT1 = { ...troopToBattleUnit(troop1), strength: 50 }; // 80 -> 50 (took casualties)
    // t2 is entirely absent from the final battle state = destroyed.
    const rome = makeSideState({
      commanderId: 'pc-1',
      wings: { left: makeWing('left', { units: [finalT1] }), centre: makeWing('centre'), right: makeWing('right') },
    });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome();
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    const updatedCommander = next.family.find(c => c.id === 'pc-1')!;
    expect(updatedCommander.raisedLegions.map(t => t.id)).toEqual(['t1']); // t2 destroyed
    expect(updatedCommander.raisedLegions[0].strength).toBe(5); // round(50/10)

    // Troops belonging to a DIFFERENT character are never touched.
    const updatedOther = next.family.find(c => c.id === 'son-1')!;
    expect(updatedOther.raisedLegions).toEqual([otherTroop]);
  });

  test('wounded sets the cooldown flag and injects a notice', () => {
    const character = makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 20 });
    const state = makeState({ family: [makeCharacter(), character] });
    const rome = makeSideState({ commanderId: 'pc-1' });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ captainOutcomes: [{ characterId: 'son-1', result: 'wounded' }] });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.flags['wounded-cooldown-son-1']).toBe(BALANCE.battle.wounds.durationTurns);
    expect(next.pendingEvents.some(e => e.defId === 'evt-wounded-notice')).toBe(true);
  });

  test('captured sets captivity and injects a ransom notice', () => {
    const character = makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 20 });
    const state = makeState({ family: [makeCharacter(), character] });
    const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
    const outcome = makeOutcome({ victor: 'defender', captainOutcomes: [{ characterId: 'son-1', result: 'captured' }] });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    const updated = next.family.find(c => c.id === 'son-1')!;
    expect(updated.captivity).toEqual({ status: 'awaiting_ransom', demandDenarii: BALANCE.war.ransom.baseDenarii, capturedTurn: 10 });
    expect(next.pendingEvents.some(e => e.defId === 'evt-ransom-demand-notice')).toBe(true);
  });

  test('a non-player killed in battle is removed with no succession', () => {
    const character = makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 20 });
    const state = makeState({ family: [makeCharacter(), character] });
    const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'son-1' }) });
    const outcome = makeOutcome({ victor: 'defender', captainOutcomes: [{ characterId: 'son-1', result: 'killed' }] });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'son-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.family.find(c => c.id === 'son-1')).toBeUndefined();
    expect(next.family.find(c => c.id === 'pc-1')).toBeDefined();
  });

  test('DONE-WHEN: a paterfamilias killed in battle sets pendingSuccession without crashing (P3-C: no longer an immediate silent reassignment)', () => {
    const heir = makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 25 });
    const state = makeState({ family: [makeCharacter({ id: 'pc-1' }), heir] });
    const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
    const outcome = makeOutcome({ victor: 'defender', captainOutcomes: [{ characterId: 'pc-1', result: 'killed' }] });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    expect(() => applyBattleOutcome(state, battleState, 'attacker', outcome, ctx)).not.toThrow();
    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.family.find(c => c.id === 'pc-1')).toBeUndefined();
    // Phase 3, Chunk P3-C: battle death now routes through the same shared
    // succession sequence as natural death — no immediate isPlayer
    // reassignment inside applyBattleOutcome itself (that's
    // gameStore.succeedPaterfamilias's job, driven by the player's choice).
    const stillHeir = next.family.find(c => c.id === 'son-1')!;
    expect(stillHeir.isPlayer).toBe(false);
    expect(stillHeir.role).toBe('son');
    expect(next.pendingSuccession).not.toBeNull();
    expect(next.pendingSuccession?.deceasedId).toBe('pc-1');
    expect(next.pendingSuccession?.eligibleHeirIds).toEqual(['son-1']);
    expect(next.pendingEvents.some(e => e.defId === 'evt-succession-death')).toBe(true);
  });

  test('legate death moves clan relationship down', () => {
    const state = makeState({ family: [makeCharacter()], familyReputations: { cornelii: 70 } });
    const rome = makeSideState({
      wings: { left: makeWing('left', { captainId: 'legate-cornelii-1' }), centre: makeWing('centre'), right: makeWing('right') },
    });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'defender', captainOutcomes: [{ characterId: 'legate-cornelii-1', result: 'killed' }] });
    const ctx: BattleBridgeContext = {
      troopOwnerCharacterId: 'pc-1',
      legateRoster: { 'legate-cornelii-1': { clanId: 'cornelii', clanName: 'Cornelii' } },
      turnNumber: 10,
    };

    const { state: next, ledgerNotes } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.familyReputations.cornelii).toBeLessThan(70);
    expect(ledgerNotes.some(n => n.includes('legate has fallen'))).toBe(true);
  });

  test('a legate on the winning side of a crushing victory shares the glory even without a risk roll', () => {
    const state = makeState({ family: [makeCharacter()], familyReputations: { cornelii: 70 } });
    const rome = makeSideState({
      commanderId: 'pc-1',
      wings: { left: makeWing('left', { captainId: 'legate-cornelii-1' }), centre: makeWing('centre'), right: makeWing('right') },
    });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'attacker', tier: 'crushing', captainOutcomes: [] }); // victor's lanes aren't risk-rolled
    const ctx: BattleBridgeContext = {
      troopOwnerCharacterId: 'pc-1',
      legateRoster: { 'legate-cornelii-1': { clanId: 'cornelii', clanName: 'Cornelii' } },
      turnNumber: 10,
    };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.familyReputations.cornelii).toBeGreaterThan(70);
  });

  test('a crushing victory tied to a province campaign feeds the existing triumph pathway', () => {
    const province = {
      id: 'sicilia',
      activeCampaign: { id: 'camp-1', provinceId: 'sicilia', type: 'conquest', commanderCharacterId: 'pc-1',
        campaignProgress: 80, enemyStrength: 40, turnsElapsed: 3, localSupportBonus: false, resolved: false, outcome: null, activeEventId: null },
    };
    const state = makeState({ family: [makeCharacter()], provinces: [province] as any });
    const rome = makeSideState({ commanderId: 'pc-1' });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'attacker', tier: 'crushing' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, provinceId: 'sicilia', turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    const updatedProvince = next.provinces.find(p => p.id === 'sicilia')!;
    expect(updatedProvince.activeCampaign?.resolved).toBe(true);
    expect(updatedProvince.activeCampaign?.outcome).toBe('victory');
  });

  test('a defeated commander is flagged for the trial hook', () => {
    const state = makeState({ family: [makeCharacter()] });
    const rome = makeSideState({ commanderId: 'pc-1' });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'defender', tier: 'clear' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.flags['defeatedGeneral-pc-1']).toBe(true);
  });

  test('a withdrawal does NOT flag the commander as defeated', () => {
    const state = makeState({ family: [makeCharacter()] });
    const rome = makeSideState({ commanderId: 'pc-1' });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'withdrawal', tier: 'marginal', warScoreDelta: -4 });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.flags['defeatedGeneral-pc-1']).toBeUndefined();
  });

  test('headline is always the first ledger note', () => {
    const state = makeState({ family: [makeCharacter()] });
    const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
    const outcome = makeOutcome({ victor: 'attacker', tier: 'clear' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };
    const { ledgerNotes } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(ledgerNotes[0]).toContain('wins');
  });

  // ─── M8: loyalty deltas ────────────────────────────────────────────────────

  test('a shared victory grants +10 loyalty to surviving units', () => {
    const troop = makeTroop({ id: 't1', bondToCommander: 50 });
    const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
    const finalUnit = { ...troopToBattleUnit(troop), strength: 80 };
    const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'attacker' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.family[0].raisedLegions[0].bondToCommander).toBe(50 + BALANCE.battle.lifecycle.loyaltyGainPerVictoryShared);
  });

  test('a defeat costs -15 loyalty, clamped at 0', () => {
    const troop = makeTroop({ id: 't1', bondToCommander: 5 });
    const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
    const finalUnit = { ...troopToBattleUnit(troop), strength: 40 };
    const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'defender', tier: 'clear' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.family[0].raisedLegions[0].bondToCommander).toBe(0); // 5 - 15 clamped
  });

  test('a withdrawal applies no victory/defeat loyalty delta', () => {
    const troop = makeTroop({ id: 't1', bondToCommander: 50 });
    const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
    const finalUnit = { ...troopToBattleUnit(troop), strength: 40 };
    const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'withdrawal', tier: 'marginal', warScoreDelta: -4 });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.family[0].raisedLegions[0].bondToCommander).toBe(50);
  });

  test('no commander-change penalty on the first battle fought under this system', () => {
    const troop = makeTroop({ id: 't1', bondToCommander: 50 });
    const character = makeCharacter({ raisedLegions: [troop] }); // lastLoyaltyCommanderId absent
    const state = makeState({ family: [character] });
    const finalUnit = { ...troopToBattleUnit(troop), strength: 80 };
    const rome = makeSideState({ commanderId: 'son-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'attacker' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    expect(next.family[0].raisedLegions[0].bondToCommander).toBe(50 + BALANCE.battle.lifecycle.loyaltyGainPerVictoryShared);
    expect(next.family[0].lastLoyaltyCommanderId).toBe('son-1'); // stamped for next time
  });

  test('a changed commander (vs the previously recorded one) costs an extra -10, stacked with the victory/defeat delta', () => {
    const troop = makeTroop({ id: 't1', bondToCommander: 50 });
    const character = makeCharacter({ raisedLegions: [troop], lastLoyaltyCommanderId: 'pc-1' });
    const state = makeState({ family: [character] });
    const finalUnit = { ...troopToBattleUnit(troop), strength: 80 };
    // Same battle, commanded by 'son-1' this time — a change from the recorded 'pc-1'.
    const rome = makeSideState({ commanderId: 'son-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
    const battleState = makeBattleState({ attacker: rome });
    const outcome = makeOutcome({ victor: 'attacker' });
    const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

    const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
    const lc = BALANCE.battle.lifecycle;
    expect(next.family[0].raisedLegions[0].bondToCommander).toBe(50 + lc.loyaltyGainPerVictoryShared + lc.loyaltyLossCommanderChange);
    expect(next.family[0].lastLoyaltyCommanderId).toBe('son-1');
  });

  // ─── M8: elephantSteady write-back ─────────────────────────────────────────

  describe('elephantSteady write-back', () => {
    test('units in a lane with a surviving elephant (either side) become elephantSteady', () => {
      const troop = makeTroop({ id: 't1' });
      const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
      const finalUnit = { ...troopToBattleUnit(troop), strength: 60 };
      const enemyElephant = makeBattleUnit({ id: 'enemy-ele', unitClass: 'elephant' });
      const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
      const carthage = makeSideState({ label: 'Carthage', wings: { left: makeWing('left', { units: [enemyElephant] }), centre: makeWing('centre'), right: makeWing('right') } });
      const battleState = makeBattleState({ attacker: rome, defender: carthage });
      const outcome = makeOutcome({ victor: 'attacker' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

      const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      expect(next.family[0].raisedLegions[0].elephantSteady).toBe(true);
    });

    test('units in a lane where an elephant went amok (and is gone by battle end) still become elephantSteady', () => {
      const troop = makeTroop({ id: 't1' });
      const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
      const finalUnit = { ...troopToBattleUnit(troop), strength: 60 };
      const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
      const battleState = makeBattleState({ attacker: rome });
      const withAmokLog: BattleState = { ...battleState, log: [{ type: 'amok', round: 3, laneId: 'left', unitId: 'dead-ele', casualties: [] }] };
      const outcome = makeOutcome({ victor: 'attacker' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

      const { state: next } = applyBattleOutcome(state, withAmokLog, 'attacker', outcome, ctx);
      expect(next.family[0].raisedLegions[0].elephantSteady).toBe(true);
    });

    test('a lane with no elephants (ever) does not grant elephantSteady', () => {
      const troop = makeTroop({ id: 't1' });
      const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
      const finalUnit = { ...troopToBattleUnit(troop), strength: 60 };
      const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
      const battleState = makeBattleState({ attacker: rome });
      const outcome = makeOutcome({ victor: 'attacker' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

      const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      expect(next.family[0].raisedLegions[0].elephantSteady).toBe(false);
    });

    test('is sticky — a unit already elephantSteady stays so even in a battle with no elephants', () => {
      const troop = makeTroop({ id: 't1', elephantSteady: true });
      const state = makeState({ family: [makeCharacter({ raisedLegions: [troop] })] });
      const finalUnit = { ...troopToBattleUnit(troop), strength: 60, elephantSteady: false };
      const rome = makeSideState({ commanderId: 'pc-1', wings: { left: makeWing('left', { units: [finalUnit] }), centre: makeWing('centre'), right: makeWing('right') } });
      const battleState = makeBattleState({ attacker: rome });
      const outcome = makeOutcome({ victor: 'attacker' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10 };

      const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      expect(next.family[0].raisedLegions[0].elephantSteady).toBe(true);
    });
  });

  // ─── M8: captured elephants ─────────────────────────────────────────────────

  describe('captured elephants', () => {
    const originalRandom = Math.random;
    afterEach(() => { Math.random = originalRandom; });

    test('a crushing victory over an elephant-fielding enemy can capture one, below the roll threshold', () => {
      Math.random = () => 0.0; // always "succeeds" the capture roll
      const state = makeState({ family: [makeCharacter()] });
      const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
      const outcome = makeOutcome({ victor: 'attacker', tier: 'crushing' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10, enemyFieldedElephants: true };

      const { state: next, ledgerNotes } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      const captured = next.family[0].veterans.find(t => t.unitClass === 'elephant');
      expect(captured).toBeDefined();
      expect(captured?.veterancy).toBe('raw');
      expect(captured?.bondToCommander).toBe(BALANCE.battle.elephant.capturedElephantStartingLoyalty);
      expect(next.pendingEvents.some(e => e.defId === 'evt-captured-elephant-notice')).toBe(true);
      expect(ledgerNotes.some(n => n.includes('Carthage'))).toBe(true);
    });

    test('above the roll threshold, no elephant is captured', () => {
      Math.random = () => 0.999;
      const state = makeState({ family: [makeCharacter()] });
      const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
      const outcome = makeOutcome({ victor: 'attacker', tier: 'crushing' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10, enemyFieldedElephants: true };

      const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      expect(next.family[0].veterans.find(t => t.unitClass === 'elephant')).toBeUndefined();
    });

    test('no roll at all when the enemy fielded no elephants', () => {
      Math.random = () => 0.0;
      const state = makeState({ family: [makeCharacter()] });
      const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
      const outcome = makeOutcome({ victor: 'attacker', tier: 'crushing' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10, enemyFieldedElephants: false };

      const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      expect(next.family[0].veterans.find(t => t.unitClass === 'elephant')).toBeUndefined();
    });

    test('no roll on a merely clear (non-crushing) victory', () => {
      Math.random = () => 0.0;
      const state = makeState({ family: [makeCharacter()] });
      const battleState = makeBattleState({ attacker: makeSideState({ commanderId: 'pc-1' }) });
      const outcome = makeOutcome({ victor: 'attacker', tier: 'clear' });
      const ctx: BattleBridgeContext = { troopOwnerCharacterId: 'pc-1', legateRoster: {}, turnNumber: 10, enemyFieldedElephants: true };

      const { state: next } = applyBattleOutcome(state, battleState, 'attacker', outcome, ctx);
      expect(next.family[0].veterans.find(t => t.unitClass === 'elephant')).toBeUndefined();
    });
  });
});

// ─── M8: promotedVeterancy ───────────────────────────────────────────────────

describe('promotedVeterancy', () => {
  test('thresholds: 2 -> trained, 5 -> veteran (without a crushing victory, caps below legendary)', () => {
    expect(promotedVeterancy(makeTroop({ campaignsSurvived: 0 }))).toBe('raw');
    expect(promotedVeterancy(makeTroop({ campaignsSurvived: 1 }))).toBe('raw');
    expect(promotedVeterancy(makeTroop({ campaignsSurvived: 2 }))).toBe('trained');
    expect(promotedVeterancy(makeTroop({ campaignsSurvived: 4 }))).toBe('trained');
    expect(promotedVeterancy(makeTroop({ campaignsSurvived: 5 }))).toBe('veteran');
    expect(promotedVeterancy(makeTroop({ campaignsSurvived: 20 }))).toBe('veteran'); // no crushing win yet
  });

  test('legendary requires BOTH 9+ engagedBattles AND a recorded crushing victory', () => {
    const noVictory = makeTroop({ campaignsSurvived: 9, wonCrushingVictory: false });
    const withVictory = makeTroop({ campaignsSurvived: 9, wonCrushingVictory: true });
    expect(promotedVeterancy(noVictory)).toBe('veteran');
    expect(promotedVeterancy(withVictory)).toBe('legendary');
  });

  test('never downgrades a tier the unit already holds (e.g. from TroopType derivation)', () => {
    const seasonedButFresh = makeTroop({ type: 'seasoned_veteran', campaignsSurvived: 0 });
    expect(promotedVeterancy(seasonedButFresh)).toBe('legendary');

    const explicitLegendaryNoWins = makeTroop({ veterancy: 'legendary', campaignsSurvived: 0 });
    expect(promotedVeterancy(explicitLegendaryNoWins)).toBe('legendary');
  });
});

// ─── M8: computeElephantLanes ────────────────────────────────────────────────

describe('computeElephantLanes', () => {
  test('includes a lane with a surviving elephant on either side', () => {
    const rome = makeSideState({ wings: { left: makeWing('left'), centre: makeWing('centre', { units: [makeBattleUnit({ unitClass: 'elephant' })] }), right: makeWing('right') } });
    const battleState = makeBattleState({ attacker: rome });
    expect(computeElephantLanes(battleState)).toEqual(new Set(['centre']));
  });

  test('includes a lane recorded in an amok log entry even with no surviving elephant', () => {
    const battleState = makeBattleState();
    const withLog: BattleState = { ...battleState, log: [{ type: 'amok', round: 2, laneId: 'right', unitId: 'x', casualties: [] }] };
    expect(computeElephantLanes(withLog)).toEqual(new Set(['right']));
  });

  test('empty when neither condition holds anywhere', () => {
    expect(computeElephantLanes(makeBattleState())).toEqual(new Set());
  });
});
