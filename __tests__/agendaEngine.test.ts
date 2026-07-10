import { generateAgenda, getCriticalItems, getAgendaBadgeCount } from '../src/engine/agendaEngine';
import { SEVERITY_ORDER } from '../src/models/agenda';
import { CORRUPTION_TRIAL_THRESHOLD } from '../src/engine/trialEngine';
import type { GameState } from '../src/state/gameStore';

// ─── Minimal state factory ────────────────────────────────────────────────────
// Only the fields that agendaEngine generators actually read.
// Cast to GameState so TypeScript accepts partial mocks without full construction.

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    // Core
    turnNumber: 1,
    seasonIndex: 0,
    year: -264,
    // Family
    family: [],
    heldOffices: [],
    currentOffice: null,
    officeSeasons: 0,
    // Trials
    trialQueue: [],
    // Election
    campaigning: null,
    campaigningCharacterId: null,
    campaignVotes: {},
    // Legislation
    bills: [],
    activeLaws: [],
    // Crisis
    crisis: {
      war:          { id: 'war',          level: 10, tier: 0, namedCrisis: null },
      unrest:       { id: 'unrest',       level: 10, tier: 0, namedCrisis: null },
      constitution: { id: 'constitution', level: 10, tier: 0, namedCrisis: null },
      economy:      { id: 'economy',      level: 10, tier: 0, namedCrisis: null },
    },
    // Rome stats
    rome: { stability: 70, plebs: 60, treasury: 50 },
    // Clans
    clans: [],
    familyReputations: {},
    electionRivals: [],
    // Ambitions
    ambitions: [],
    // Senate/province
    senateResponse: null,
    provinces: [],
    // Flags
    flags: {},
    // Housekeeping
    pendingBirthNaming: null,
    pendingAmbitionScopes: [],
    // Spread overrides last
    ...overrides,
  } as GameState;
}

// ─── Factories for complex objects ────────────────────────────────────────────

function makeTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trial-001',
    accusedCharacterId: 'pc-brutus',
    accusingClanId: 'fabii',
    charge: 'corruption',
    defenseStrength: 30,
    prosecutionStrength: 70,
    turnsRemaining: 1,
    resolved: false,
    actionsUsed: [],
    ...overrides,
  } as any;
}

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pc-brutus',
    name: 'Marcus Brutus',
    isPlayer: true,
    age: 35,
    corruptionScore: 0,
    ...overrides,
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateAgenda', () => {

  // 1 — Empty-ish state produces no critical items
  test('empty state produces no critical items', () => {
    const state = makeState();
    expect(getCriticalItems(state)).toHaveLength(0);
  });

  // 2 — Trial resolving this season with losing defense is critical
  test('trial resolving this season with losing defense is critical', () => {
    const trial = makeTrial({
      defenseStrength: 20,
      prosecutionStrength: 80,
      turnsRemaining: 1,
    });
    const state = makeState({
      trialQueue: [trial],
      family: [makePlayer()],
    });
    const criticals = getCriticalItems(state);
    expect(criticals.some(i => i.id === `agenda-trial-${trial.id}`)).toBe(true);
  });

  // Also verify: a trial with 3 turns remaining and winning defense is only a warning
  test('trial with comfortable defense and 3 seasons remaining is only a warning', () => {
    const trial = makeTrial({
      defenseStrength: 80,
      prosecutionStrength: 30,
      turnsRemaining: 3,
    });
    const state = makeState({
      trialQueue: [trial],
      family: [makePlayer()],
    });
    const criticals = getCriticalItems(state);
    const all = generateAgenda(state);
    expect(criticals.some(i => i.id === `agenda-trial-${trial.id}`)).toBe(false);
    expect(all.some(i => i.id === `agenda-trial-${trial.id}` && i.severity === 'warning')).toBe(true);
  });

  // 3 — seasonsSinceLastBillPassed = 2 (via flags) produces a critical Senate-idle item
  test('flags.seasonsSinceLastBillPassed = 2 produces a critical senate-idle item', () => {
    const state = makeState({ flags: { seasonsSinceLastBillPassed: 2 } });
    const criticals = getCriticalItems(state);
    expect(criticals.some(i => i.id === 'agenda-senate-idle')).toBe(true);
  });

  // And = 1 is only a warning
  test('flags.seasonsSinceLastBillPassed = 1 produces a warning, not critical', () => {
    const state = makeState({ flags: { seasonsSinceLastBillPassed: 1 } });
    expect(getCriticalItems(state).some(i => i.id === 'agenda-senate-idle')).toBe(false);
    expect(generateAgenda(state).some(i => i.id === 'agenda-senate-idle' && i.severity === 'warning')).toBe(true);
  });

  // 4 — Fixing the underlying state removes the item on recomputation
  test('fixing the underlying state removes the item immediately', () => {
    const stateBad   = makeState({ flags: { seasonsSinceLastBillPassed: 2 } });
    const stateFixed = makeState({ flags: { seasonsSinceLastBillPassed: 0 } });

    expect(getCriticalItems(stateBad).some(i => i.id === 'agenda-senate-idle')).toBe(true);
    expect(generateAgenda(stateFixed).some(i => i.id === 'agenda-senate-idle')).toBe(false);
  });

  // 5 — Sort order is severity-first
  test('items are sorted severity-first', () => {
    // Set up both a critical item (trial resolving now) and a warning (senate 1 season)
    const trial = makeTrial({ turnsRemaining: 1, defenseStrength: 20, prosecutionStrength: 80 });
    const state = makeState({
      trialQueue: [trial],
      family: [makePlayer()],
      flags: { seasonsSinceLastBillPassed: 1 },
    });

    const items = generateAgenda(state);
    expect(items.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < items.length - 1; i++) {
      const currentOrder = SEVERITY_ORDER[items[i].severity];
      const nextOrder    = SEVERITY_ORDER[items[i + 1].severity];
      expect(currentOrder).toBeLessThanOrEqual(nextOrder);
    }
  });

  // 6 — Stable IDs: calling generateAgenda twice on the same state returns identical id arrays
  test('item IDs are stable across two calls on the same state', () => {
    const state = makeState({
      flags: { seasonsSinceLastBillPassed: 2 },
      rome: { stability: 10, plebs: 10, treasury: 5 },
    });
    const ids1 = generateAgenda(state).map(i => i.id);
    const ids2 = generateAgenda(state).map(i => i.id);
    expect(ids1).toEqual(ids2);
  });

  // ─── Additional targeted tests ────────────────────────────────────────────

  // Crisis track tier 2 = warning, tier 3 = critical
  test('crisis track at tier 2 is warning; tier 3 is critical', () => {
    const stateWarning = makeState({
      crisis: {
        war:          { id: 'war',          level: 45, tier: 2, namedCrisis: 'Active Conflict' },
        unrest:       { id: 'unrest',       level: 10, tier: 0, namedCrisis: null },
        constitution: { id: 'constitution', level: 10, tier: 0, namedCrisis: null },
        economy:      { id: 'economy',      level: 10, tier: 0, namedCrisis: null },
      },
    });
    const stateCritical = makeState({
      crisis: {
        war:          { id: 'war',          level: 65, tier: 3, namedCrisis: 'War Crisis' },
        unrest:       { id: 'unrest',       level: 10, tier: 0, namedCrisis: null },
        constitution: { id: 'constitution', level: 10, tier: 0, namedCrisis: null },
        economy:      { id: 'economy',      level: 10, tier: 0, namedCrisis: null },
      },
    });

    const warningItems = generateAgenda(stateWarning);
    const criticalItems = generateAgenda(stateCritical);

    expect(warningItems.some(i => i.id === 'agenda-crisis-war' && i.severity === 'warning')).toBe(true);
    expect(criticalItems.some(i => i.id === 'agenda-crisis-war' && i.severity === 'critical')).toBe(true);
  });

  // Corruption within 10 points of threshold triggers exposure warning
  test('corruption within 10 points of threshold triggers exposure item', () => {
    const nearScore = CORRUPTION_TRIAL_THRESHOLD - 5; // 55 — over the 50 warning floor
    const state = makeState({
      family: [makePlayer({ corruptionScore: nearScore })],
      clans: [],
    });
    const items = generateAgenda(state);
    expect(items.some(i => i.id === 'agenda-corruption-pc-brutus')).toBe(true);
  });

  // Corruption exposure upgrades to critical when a hostile clan is present
  test('corruption exposure is critical when a hostile clan is present', () => {
    const nearScore = CORRUPTION_TRIAL_THRESHOLD - 5;
    const state = makeState({
      family: [makePlayer({ corruptionScore: nearScore })],
      clans: [{ id: 'fabii', leaders: [], influence: 70, name: 'Gens Fabia' } as any],
      familyReputations: { fabii: -50 }, // below -10 → 'hostile' standing
    });
    const items = getCriticalItems(state);
    expect(items.some(i => i.id === 'agenda-corruption-pc-brutus')).toBe(true);
  });

  // getAgendaBadgeCount counts only critical + warning
  test('getAgendaBadgeCount counts critical and warning items only', () => {
    // 1 critical (senate idle ≥2), 0 warning
    const state1 = makeState({ flags: { seasonsSinceLastBillPassed: 2 } });
    expect(getAgendaBadgeCount(state1)).toBe(1);

    // 0 critical, 1 warning (senate idle = 1)
    const state2 = makeState({ flags: { seasonsSinceLastBillPassed: 1 } });
    expect(getAgendaBadgeCount(state2)).toBe(1);

    // 0 of either
    const state3 = makeState();
    expect(getAgendaBadgeCount(state3)).toBe(0);
  });

  // ─── Military Overhaul M9 — generators #17/#18 ─────────────────────────────

  function makeWar(overrides: Record<string, unknown> = {}) {
    return {
      id: 'war-carthage-1', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
      warScore: 0, startedTurn: 1, lastSetPieceTurn: 1, weariness: 0,
      pendingSetPiece: null, treaty: null,
      ...overrides,
    } as any;
  }

  test('#17 fires when an active war has a pending set-piece offer', () => {
    const offer = { id: 'offer-1', siteName: 'Agrigentum', terrainId: 'open_plain', enemyArmy: [], enemyGeneralId: 'hanno_cautious', expiresTurn: 5 };
    const state = makeState({ wars: [makeWar({ pendingSetPiece: offer })] } as any);
    const items = getCriticalItems(state);
    expect(items.some(i => i.id === 'agenda-critical-set-piece-war-carthage-1' && i.title.includes('Agrigentum'))).toBe(true);
  });

  test('#17 does not fire without a pending offer, or for an inactive war', () => {
    const state = makeState({ wars: [makeWar(), makeWar({ id: 'w2', active: false, pendingSetPiece: { id: 'x', siteName: 'X', terrainId: 'open_plain', enemyArmy: [], enemyGeneralId: 'hanno_cautious', expiresTurn: 5 } })] } as any);
    const items = getCriticalItems(state);
    expect(items.some(i => i.category === 'military')).toBe(false);
  });

  test('#18 fires once |warScore| crosses the sue threshold, framed by who is winning', () => {
    const losing = makeState({ wars: [makeWar({ warScore: -45 })] } as any);
    const winning = makeState({ wars: [makeWar({ warScore: 45 })] } as any);
    const notYet = makeState({ wars: [makeWar({ warScore: 20 })] } as any);

    expect(getCriticalItems(losing).some(i => i.id === 'agenda-critical-war-peace-war-carthage-1' && i.title.includes('forced'))).toBe(true);
    expect(getCriticalItems(winning).some(i => i.id === 'agenda-critical-war-peace-war-carthage-1' && i.title.toLowerCase().includes('peace'))).toBe(true);
    expect(getCriticalItems(notYet).some(i => i.id === 'agenda-critical-war-peace-war-carthage-1')).toBe(false);
  });

  test('a state with no wars field at all does not crash generateAgenda (pre-M9 saves)', () => {
    const state = makeState();
    expect(() => generateAgenda(state)).not.toThrow();
  });

});
