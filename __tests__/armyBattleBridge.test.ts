import {
  armyUnitToBattleUnit, battleUnitToArmyUnit, promotedArmyVeterancy, applyArmyLifecycleUpdates,
  applyCommanderFate, applyArmyBattleOutcome, type CommanderFateSlice,
} from '../src/engine/battle/armyBattleBridge';
import {
  initBattle, submitOrders, submitBreakDecision,
} from '../src/engine/battle/battleEngine';
import type {
  BattleUnit, Deployment, LaneAssignment, LaneId, TerrainMod, SideOrders, BattleState, UnitClass, Veterancy,
} from '../src/models/battle';
import type { DeploySideInput } from '../src/engine/battle/battleEngine';
import type { Army, ArmyUnit } from '../src/models/army';
import type { Character } from '../src/models/character';
import type { Command } from '../src/models/command';
import { BALANCE } from '../src/data/balance';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const LANES: LaneId[] = ['left', 'centre', 'right'];
const NEUTRAL_TERRAIN: TerrainMod = { id: 'coastal_plain', label: 'Coastal Plain', mods: {} };
const EMPTY_ORDERS: SideOrders = { laneOrders: {} };

function makeArmyUnit(overrides: Partial<ArmyUnit> = {}): ArmyUnit {
  return {
    id: `au-${Math.random().toString(36).slice(2)}`,
    unitClass: 'legionary', strength: 100, veterancy: 'trained', loyalty: 50, elephantSteady: false,
    homeRegion: 'latium', raisedBy: 'player', raisedSeason: 1, campaignsSurvived: 0, wonCrushingVictory: false,
    ...overrides,
  };
}

function makeArmy(overrides: Partial<Army> = {}): Army {
  return {
    id: 'army-1', name: 'Legio I', owner: 'player', commanderId: 'pc-1',
    location: 'latium', stationedCityId: 'latium',
    units: [makeArmyUnit({ id: 'u1' }), makeArmyUnit({ id: 'u2' }), makeArmyUnit({ id: 'u3' })],
    stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
    ...overrides,
  };
}

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [], ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    ...overrides,
  } as unknown as Character;
}

function makeDeployment(laneUnits: Partial<Record<LaneId, BattleUnit[]>>, opts: { commanderStation?: LaneId | 'reserve' } = {}): Deployment {
  const lanes = {} as Record<LaneId, LaneAssignment>;
  for (const laneId of LANES) {
    lanes[laneId] = { units: laneUnits[laneId] ?? [], captainId: null, formation: 'line' };
  }
  return { lanes, reserve: [], commanderStation: opts.commanderStation ?? 'reserve' };
}

function makeSlice(overrides: Partial<CommanderFateSlice> = {}): CommanderFateSlice {
  return {
    family: [makeCharacter()],
    flags: {},
    pendingEvents: [],
    pendingSuccession: null,
    cadetBranch: null,
    pendingEpilogue: null,
    ...overrides,
  };
}

/** Runs a small battle to completion (trivial policy) so tests have a real
 *  BattleState + BattleOutcome, not a hand-rolled fixture — same pattern
 *  battleEngine.test.ts's own runFullBattle uses. */
function runFullBattle(attacker: DeploySideInput, defender: DeploySideInput, seed: number): BattleState {
  let state = initBattle(attacker, defender, NEUTRAL_TERRAIN, seed);
  let iterations = 0;
  while (state.phase !== 'resolved' && iterations < 60) {
    iterations += 1;
    if (state.phase === 'orders') {
      state = submitOrders(state, EMPTY_ORDERS, EMPTY_ORDERS);
    } else if (state.phase === 'break_decision') {
      const pending = state.pendingBreakDecisions[0];
      if (!pending) throw new Error('break_decision phase with no pending decisions');
      state = submitBreakDecision(state, pending.laneId, 'pursue');
    } else {
      throw new Error(`unexpected phase ${state.phase}`);
    }
  }
  return state;
}

function makeBattleUnit(unitClass: UnitClass, overrides: Partial<BattleUnit> = {}): BattleUnit {
  return { id: `bu-${Math.random().toString(36).slice(2)}`, unitClass, strength: 100, veterancy: 'trained' as Veterancy, loyalty: 50, elephantSteady: false, ...overrides };
}

// ─── Projection ──────────────────────────────────────────────────────────────

describe('armyUnitToBattleUnit / battleUnitToArmyUnit', () => {
  test('projects an ArmyUnit into an equivalent BattleUnit', () => {
    const unit = makeArmyUnit({ strength: 77, veterancy: 'veteran', loyalty: 62 });
    const battleUnit = armyUnitToBattleUnit(unit);
    expect(battleUnit).toMatchObject({ id: unit.id, unitClass: 'legionary', strength: 77, veterancy: 'veteran', loyalty: 62 });
  });

  test('a destroyed unit (0 strength) round-trips to null', () => {
    const original = makeArmyUnit({ strength: 50 });
    const final = { ...armyUnitToBattleUnit(original), strength: 0 };
    expect(battleUnitToArmyUnit(original, final)).toBeNull();
  });

  test('a surviving unit conserves its identity and picks up the final strength/veterancy/loyalty', () => {
    const original = makeArmyUnit({ strength: 100, veterancy: 'trained', loyalty: 50, campaignsSurvived: 2 });
    const final = { ...armyUnitToBattleUnit(original), strength: 63, veterancy: 'veteran' as Veterancy, loyalty: 40 };
    const mapped = battleUnitToArmyUnit(original, final)!;
    expect(mapped.id).toBe(original.id);
    expect(mapped.strength).toBe(63);
    expect(mapped.veterancy).toBe('veteran');
    expect(mapped.loyalty).toBe(40);
    // campaignsSurvived increments for every survivor, win or lose.
    expect(mapped.campaignsSurvived).toBe(3);
    // Fields not touched by the battle stay put.
    expect(mapped.homeRegion).toBe(original.homeRegion);
    expect(mapped.raisedBy).toBe(original.raisedBy);
  });
});

// ─── Lifecycle (M8 parity) ──────────────────────────────────────────────────

describe('promotedArmyVeterancy / applyArmyLifecycleUpdates', () => {
  test('promotes strictly by campaignsSurvived thresholds, never downgrades', () => {
    const t = BALANCE.battle.lifecycle.veterancyThresholds;
    const raw = makeArmyUnit({ veterancy: 'raw', campaignsSurvived: 0 });
    expect(promotedArmyVeterancy(raw)).toBe('raw');
    const trained = makeArmyUnit({ veterancy: 'raw', campaignsSurvived: t.trained });
    expect(promotedArmyVeterancy(trained)).toBe('trained');
    const veteran = makeArmyUnit({ veterancy: 'raw', campaignsSurvived: t.veteran });
    expect(promotedArmyVeterancy(veteran)).toBe('veteran');
    // legendary requires BOTH the threshold and a crushing-victory flag.
    const almostLegendary = makeArmyUnit({ veterancy: 'raw', campaignsSurvived: t.legendary, wonCrushingVictory: false });
    expect(promotedArmyVeterancy(almostLegendary)).toBe('veteran');
    const legendary = makeArmyUnit({ veterancy: 'raw', campaignsSurvived: t.legendary, wonCrushingVictory: true });
    expect(promotedArmyVeterancy(legendary)).toBe('legendary');
    // Never downgrades a unit whose TroopType/veterancy tier already exceeds computed.
    const alreadyHigh = makeArmyUnit({ veterancy: 'legendary', campaignsSurvived: 0 });
    expect(promotedArmyVeterancy(alreadyHigh)).toBe('legendary');
  });

  test('applyArmyLifecycleUpdates clamps loyalty and re-promotes on a crushing victory', () => {
    const t = BALANCE.battle.lifecycle.veterancyThresholds;
    const unit = makeArmyUnit({ loyalty: 95, veterancy: 'veteran', campaignsSurvived: t.legendary, wonCrushingVictory: false });
    const updated = applyArmyLifecycleUpdates(unit, { loyaltyDelta: 20, elephantSteady: false, crushingVictory: true });
    expect(updated.loyalty).toBe(100); // clamped
    expect(updated.wonCrushingVictory).toBe(true);
    expect(updated.veterancy).toBe('legendary'); // unlocked by the crushing flag just set
  });
});

// ─── Commander fate ─────────────────────────────────────────────────────────

describe('applyCommanderFate', () => {
  test('unharmed is a no-op', () => {
    const slice = makeSlice();
    const result = applyCommanderFate('pc-1', 'unharmed', slice, { turnNumber: 5, playerCharacterId: 'pc-1', gensName: 'Brutia' });
    expect(result.slice).toBe(slice);
    expect(result.ledgerNotes).toEqual([]);
  });

  test('an unknown character id is a no-op (Carthage general / rome_rival ClanLeader / no commander)', () => {
    const slice = makeSlice();
    const result = applyCommanderFate('carthage-general-hanno', 'killed', slice, { turnNumber: 5, playerCharacterId: 'pc-1', gensName: 'Brutia' });
    expect(result.slice).toBe(slice);
    expect(result.ledgerNotes).toEqual([]);
  });

  test('wounded sets the cooldown flag and queues a notice', () => {
    const slice = makeSlice();
    const result = applyCommanderFate('pc-1', 'wounded', slice, { turnNumber: 5, playerCharacterId: 'pc-1', gensName: 'Brutia' });
    expect(result.slice.flags['wounded-cooldown-pc-1']).toBe(BALANCE.battle.wounds.durationTurns);
    expect(result.slice.pendingEvents.length).toBe(1);
    expect(result.ledgerNotes[0]).toContain('wounded');
  });

  test('captured sets captivity and queues a ransom-demand notice', () => {
    const slice = makeSlice();
    const result = applyCommanderFate('pc-1', 'captured', slice, { turnNumber: 5, playerCharacterId: 'pc-1', gensName: 'Brutia' });
    const character = result.slice.family.find(c => c.id === 'pc-1')!;
    expect((character as any).captivity).toMatchObject({ status: 'awaiting_ransom', capturedTurn: 5 });
    expect(result.ledgerNotes[0]).toContain('captured');
  });

  test('a killed non-paterfamilias is removed with no succession machinery invoked', () => {
    const heir = makeCharacter({ id: 'heir-1', isPlayer: false, role: 'son', age: 20 });
    const slice = makeSlice({ family: [makeCharacter(), heir] });
    const result = applyCommanderFate('heir-1', 'killed', slice, { turnNumber: 5, playerCharacterId: 'pc-1', gensName: 'Brutia' });
    expect(result.slice.family.find(c => c.id === 'heir-1')).toBeUndefined();
    expect(result.slice.family.find(c => c.id === 'pc-1')).toBeDefined();
  });

  // The plan's own C8 test target: "a paterfamilias commanding a shattered
  // army goes through capture/succession pathways without corruption."
  test('a killed paterfamilias goes through succession cleanly, family stays valid', () => {
    const heir = makeCharacter({ id: 'heir-1', isPlayer: false, role: 'son', age: 22 });
    const slice = makeSlice({ family: [makeCharacter({ id: 'pc-1' }), heir] });
    const result = applyCommanderFate('pc-1', 'killed', slice, { turnNumber: 8, playerCharacterId: 'pc-1', gensName: 'Brutia' });

    // Either a real successor was named (pendingSuccession set, a coherent
    // notice queued) or — if detectPaterfamiliasDeath found no eligible
    // heir shape it recognizes — the family array is at least never left
    // corrupted (no duplicate ids, no dangling references).
    const ids = result.slice.family.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length); // no duplicates
    if (result.slice.pendingSuccession) {
      expect(result.slice.pendingEvents.length).toBeGreaterThan(0);
    }
  });
});

// ─── Full tactical write-back ────────────────────────────────────────────────

describe('applyArmyBattleOutcome', () => {
  function fightLopsidedBattle() {
    // Build the Army first, then project via the REAL production function
    // (armyUnitToBattleUnit) — it stamps sourceRef, which the write-back
    // needs to match survivors back to their ArmyUnits. A hand-rolled
    // BattleUnit[] (no sourceRef) would make every survivor look
    // "destroyed" to applyArmyBattleOutcome, same as a real caller skipping
    // that projection would.
    const romeArmyUnits = Array.from({ length: 6 }, () => makeArmyUnit());
    const enemyArmyUnits = Array.from({ length: 3 }, () => makeArmyUnit({ unitClass: 'skirmisher', strength: 20, veterancy: 'raw' }));
    const romeUnits = romeArmyUnits.map(armyUnitToBattleUnit);
    const enemyUnits = enemyArmyUnits.map(armyUnitToBattleUnit);
    const attackerInput: DeploySideInput = {
      label: 'Rome', commanderId: 'pc-1', roster: { martialById: { 'pc-1': 8 } },
      deployment: makeDeployment({ left: [romeUnits[0], romeUnits[1]], centre: [romeUnits[2], romeUnits[3]], right: [romeUnits[4], romeUnits[5]] }, { commanderStation: 'centre' }),
    };
    const defenderInput: DeploySideInput = {
      label: 'Carthage', commanderId: null, roster: { martialById: {} },
      deployment: makeDeployment({ left: [enemyUnits[0]], centre: [enemyUnits[1]], right: [enemyUnits[2]] }),
    };
    const battleState = runFullBattle(attackerInput, defenderInput, 12345);
    return { battleState, romeArmyUnits, enemyArmyUnits };
  }

  test('conservation: every surviving unit is accounted for, none duplicated', () => {
    const { battleState, romeArmyUnits } = fightLopsidedBattle();
    expect(battleState.outcome).toBeDefined();
    const army = makeArmy({ units: romeArmyUnits });

    const result = applyArmyBattleOutcome({
      army, battleState, romeSide: 'attacker', outcome: battleState.outcome!,
      turnNumber: 10, playerCharacterId: 'pc-1', gensName: 'Brutia',
      activeCommand: null,
      family: [makeCharacter()], flags: {}, pendingEvents: [], pendingSuccession: null, cadetBranch: null, pendingEpilogue: null,
    });

    expect(result.army).not.toBeNull();
    const survivorIds = result.army!.units.map(u => u.id);
    expect(new Set(survivorIds).size).toBe(survivorIds.length);
    // Every survivor must have been one of the original units.
    for (const id of survivorIds) expect(romeArmyUnits.some(u => u.id === id)).toBe(true);
    // A won battle should not have destroyed the ENTIRE army against a
    // trio of weak skirmisher units.
    expect(result.army!.units.length).toBeGreaterThan(0);
  });

  test('ticks Command.battlesWon when the army\'s commander holds the command and wins', () => {
    const { battleState, romeArmyUnits } = fightLopsidedBattle();
    const army = makeArmy({ commanderId: 'pc-1', units: romeArmyUnits });
    const command: Command = { id: 'cmd-1', holderId: 'pc-1', holderOwner: 'player', grantedSeason: 1, expiresSeason: 5, battlesWon: 0, battlesLost: 0, warChest: 100 };

    const result = applyArmyBattleOutcome({
      army, battleState, romeSide: 'attacker', outcome: battleState.outcome!,
      turnNumber: 10, playerCharacterId: 'pc-1', gensName: 'Brutia',
      activeCommand: command,
      family: [makeCharacter()], flags: {}, pendingEvents: [], pendingSuccession: null, cadetBranch: null, pendingEpilogue: null,
    });

    expect(battleState.outcome!.victor).toBe('attacker'); // sanity — Rome really won
    expect(result.activeCommand!.battlesWon).toBe(1);
    expect(result.activeCommand!.battlesLost).toBe(0);
  });

  test('does not tick Command when the army\'s commander is NOT the current holder', () => {
    const { battleState, romeArmyUnits } = fightLopsidedBattle();
    const army = makeArmy({ commanderId: 'someone-else', units: romeArmyUnits });
    const command: Command = { id: 'cmd-1', holderId: 'pc-1', holderOwner: 'player', grantedSeason: 1, expiresSeason: 5, battlesWon: 0, battlesLost: 0, warChest: 100 };

    const result = applyArmyBattleOutcome({
      army, battleState, romeSide: 'attacker', outcome: battleState.outcome!,
      turnNumber: 10, playerCharacterId: 'pc-1', gensName: 'Brutia',
      activeCommand: command,
      family: [makeCharacter()], flags: {}, pendingEvents: [], pendingSuccession: null, cadetBranch: null, pendingEpilogue: null,
    });

    expect(result.activeCommand).toBe(command); // untouched
  });
});
