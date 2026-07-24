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
    trials: [],
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
    cities: [],
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

// Phase 4, Chunk P4-C — TrialState shape. startsSeason is relative to
// makeState's default turnNumber: 1, so passing startsSeason: 1 + N
// reproduces the old turnsRemaining: N semantics exactly.
function makeTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trial-001',
    seat: 'defense',
    charge: 'peculatus',
    chargeSource: 'accusation',
    prosecutor: { kind: 'leader', leaderId: 'leader-fabii' },
    defendant: { kind: 'family', characterId: 'pc-brutus' },
    filedSeason: 0,
    startsSeason: 1,
    // Phase 4, Chunk P4-D — sectioned PrepRecord. Put the test's intended
    // total in `pathos` specifically: the default approach ('procedure')
    // only multiplies Logos, so Pathos passes through computeTotalPrepStrength
    // unmultiplied, preserving this suite's pre-P4-D numbers exactly.
    playerPrep: { logos: 0, pathos: 30, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
    approach: 'procedure',
    speakerId: 'pc-brutus',
    npcStrength: 70,
    juryLean: 0,
    consumedSecretIds: [],
    status: 'preparing',
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
      playerPrep: { logos: 0, pathos: 20, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
      npcStrength: 80,
      startsSeason: 1,
    });
    const state = makeState({
      trials: [trial],
      family: [makePlayer()],
    });
    const criticals = getCriticalItems(state);
    expect(criticals.some(i => i.id === `agenda-trial-${trial.id}`)).toBe(true);
  });

  // Also verify: a trial with 3 seasons remaining and winning prep is only a warning
  test('trial with comfortable defense and 3 seasons remaining is only a warning', () => {
    const trial = makeTrial({
      playerPrep: { logos: 0, pathos: 80, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
      npcStrength: 30,
      startsSeason: 4,
    });
    const state = makeState({
      trials: [trial],
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
    const trial = makeTrial({ startsSeason: 1, playerPrep: { logos: 0, pathos: 20, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false }, npcStrength: 80 });
    const state = makeState({
      trials: [trial],
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
      warScore: 0, startedTurn: 1, weariness: 0, enemyWeariness: 0, momentum: 0,
      treaty: null,
      ...overrides,
    } as any;
  }

  // #17 (genPendingSetPiece) was retired in Campaign Map plan Chunk C9 along
  // with the scripted set-piece scheduler it reminded the player about;
  // genPendingEngagement (campaignEngine.test.ts / agendaEngine's own
  // #27 coverage) is its replacement for "a battle awaits your decision".

  test('#18 fires once |warScore| crosses the sue threshold, framed by who is winning', () => {
    const losing = makeState({ wars: [makeWar({ warScore: -45 })] } as any);
    const winning = makeState({ wars: [makeWar({ warScore: 45 })] } as any);
    const notYet = makeState({ wars: [makeWar({ warScore: 20 })] } as any);

    expect(getCriticalItems(losing).some(i => i.id === 'agenda-critical-war-peace-war-carthage-1' && i.title.includes('forced'))).toBe(true);
    expect(getCriticalItems(winning).some(i => i.id === 'agenda-critical-war-peace-war-carthage-1' && i.title.toLowerCase().includes('peace'))).toBe(true);
    expect(getCriticalItems(notYet).some(i => i.id === 'agenda-critical-war-peace-war-carthage-1')).toBe(false);
  });

  // ─── Phase 3, Chunk P3-B — #20 war status / #21 sue-for-peace opportunity ──

  test('#20 fires a status line for an active major war, warning once the War track is tier >= 2', () => {
    const calm = makeState({ wars: [makeWar({ phase: 'escalation' })] } as any);
    const hot = makeState({
      wars: [makeWar({ phase: 'grinding' })],
      crisis: { ...calm.crisis, war: { id: 'war', level: 45, tier: 2, namedCrisis: 'Active Conflict' } },
    } as any);
    const calmItem = generateAgenda(calm).find(i => i.id === 'agenda-war-status-war-carthage-1');
    const hotItem = generateAgenda(hot).find(i => i.id === 'agenda-war-status-war-carthage-1');
    expect(calmItem?.severity).toBe('info');
    expect(hotItem?.severity).toBe('warning');
  });

  test('#20 does not fire for an inactive war or a local-scale revolt', () => {
    const state = makeState({
      wars: [makeWar({ active: false }), makeWar({ id: 'w2', scale: 'local' })],
    } as any);
    expect(generateAgenda(state).some(i => i.id.startsWith('agenda-war-status-'))).toBe(false);
  });

  test('#21 fires only when peaceOffered is true, distinct from #18\'s warScore-tier condition', () => {
    // Low warScore (below #18's sue threshold) but peaceOffered true — #21
    // fires, #18 does not. Demonstrates the two are independently gated.
    const state = makeState({ wars: [makeWar({ warScore: 5, peaceOffered: true })] } as any);
    const items = getCriticalItems(state);
    expect(items.some(i => i.id === 'agenda-critical-sue-for-peace-war-carthage-1')).toBe(true);
    expect(items.some(i => i.id === 'agenda-critical-war-peace-war-carthage-1')).toBe(false);
  });

  test('#21 does not fire when peaceOffered is false, even at a decisive warScore', () => {
    const state = makeState({ wars: [makeWar({ warScore: 95, peaceOffered: false })] } as any);
    expect(getCriticalItems(state).some(i => i.id === 'agenda-critical-sue-for-peace-war-carthage-1')).toBe(false);
  });

  test('a state with no wars field at all does not crash generateAgenda (pre-M9 saves)', () => {
    const state = makeState();
    expect(() => generateAgenda(state)).not.toThrow();
  });

  // ─── Phase 3, Chunk P3-F — endlessMode silences #20/#21 ───────────────────

  test('#20/#21 do not fire once endlessMode is true, even for an active major war', () => {
    const state = makeState({
      wars: [makeWar({ warScore: 5, peaceOffered: true })],
      endlessMode: true,
    } as any);
    expect(generateAgenda(state).some(i => i.id.startsWith('agenda-war-status-'))).toBe(false);
    expect(getCriticalItems(state).some(i => i.id === 'agenda-critical-sue-for-peace-war-carthage-1')).toBe(false);
  });

  // ─── Phase 3, Chunk P3-C — #22 regency in effect ──────────────────────────

  function makeHeir(overrides: Record<string, unknown> = {}) {
    return { id: 'heir-1', name: 'Gaius', age: 12, ...overrides } as any;
  }

  test('#22 fires within ~2 years of majority, references the regent by name', () => {
    const state = makeState({
      regency: { heirId: 'heir-1', regentId: 'regent-1', untilYear: -246 },
      family: [makeHeir({ age: 16 }), { id: 'regent-1', name: 'Livia', age: 38 } as any],
    } as any);
    const items = generateAgenda(state);
    const item = items.find(i => i.id === 'agenda-warning-regency');
    expect(item).toBeDefined();
    expect(item?.severity).toBe('warning');
    expect(item?.title).toContain('Livia');
  });

  test('#22 does not fire when the heir is far from majority', () => {
    const state = makeState({
      regency: { heirId: 'heir-1', regentId: 'regent-1', untilYear: -240 },
      family: [makeHeir({ age: 5 }), { id: 'regent-1', name: 'Livia', age: 38 } as any],
    } as any);
    expect(generateAgenda(state).some(i => i.id === 'agenda-warning-regency')).toBe(false);
  });

  test('#22 does not fire when there is no regency', () => {
    const state = makeState({ regency: null } as any);
    expect(generateAgenda(state).some(i => i.id === 'agenda-warning-regency')).toBe(false);
  });

  test('#22 does not crash when regentId points at no one (no adult kin edge case)', () => {
    const state = makeState({
      regency: { heirId: 'heir-1', regentId: null, untilYear: -246 },
      family: [makeHeir({ age: 16 })],
    } as any);
    expect(() => generateAgenda(state)).not.toThrow();
    const item = generateAgenda(state).find(i => i.id === 'agenda-warning-regency');
    expect(item?.title).toContain('A regent');
  });

  // ── Phase 4, Chunk P4-B — generators #23–25 ─────────────────────────────

  function makeLeader(overrides: Record<string, unknown> = {}) {
    return {
      id: 'leader-1', name: 'L. Testius', title: 'Senator', emoji: '👤', age: 55,
      sphere: 'Senate', relationship: 10, favour: 0, blackmail: false, bias: 'optimates',
      votes: 10, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
      heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
      ...overrides,
    } as any;
  }

  function makeClan(overrides: Record<string, unknown> = {}) {
    return {
      id: 'testii', name: 'Gens Testia', gensName: 'Testius', sigil: '🏛️',
      influence: 50, desc: '', leaders: [makeLeader()],
      ...overrides,
    } as any;
  }

  test('#23 fires while a secret demand is pending', () => {
    const state = makeState({
      clans: [makeClan({ leaders: [makeLeader({ id: 'leader-1', name: 'Claudius' })] })],
      pendingSecretDemand: { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'extort' },
    } as any);
    const item = generateAgenda(state).find(i => i.id === 'agenda-secret-demand-pending');
    expect(item).toBeDefined();
    expect(item?.severity).toBe('critical');
    expect(item?.title).toContain('Claudius');
  });

  test('#23 does not fire with no pending demand', () => {
    const state = makeState({ pendingSecretDemand: null } as any);
    expect(generateAgenda(state).some(i => i.id === 'agenda-secret-demand-pending')).toBe(false);
  });

  test('#24 fires as a warning for a discovered secret held against the family', () => {
    const state = makeState({
      clans: [makeClan({ leaders: [makeLeader({ id: 'leader-1', name: 'Claudius' })] })],
      family: [makePlayer({ id: 'pc-brutus' })],
      secrets: [{
        id: 's1', type: 'embezzlement', subject: { kind: 'family', characterId: 'pc-brutus' },
        holder: 'leader-1', potency: 2, status: 'held', acquiredSeason: 1, flavorText: '', discovered: true,
      }],
    } as any);
    const item = generateAgenda(state).find(i => i.id.startsWith('agenda-secret-against-'));
    expect(item).toBeDefined();
    expect(item?.severity).toBe('warning');
  });

  test('#24 does not fire for an undiscovered secret', () => {
    const state = makeState({
      clans: [makeClan({ leaders: [makeLeader({ id: 'leader-1' })] })],
      secrets: [{
        id: 's1', type: 'affair', subject: { kind: 'family', characterId: 'pc-brutus' },
        holder: 'leader-1', potency: 1, status: 'held', acquiredSeason: 1, flavorText: '', discovered: false,
      }],
    } as any);
    expect(generateAgenda(state).some(i => i.id.startsWith('agenda-secret-against-'))).toBe(false);
  });

  test('#24 downgrades to info when a deterrence standoff freezes it', () => {
    const state = makeState({
      clans: [makeClan({ leaders: [makeLeader({ id: 'leader-1' })] })],
      family: [makePlayer({ id: 'pc-brutus' })],
      secrets: [
        {
          id: 's1', type: 'embezzlement', subject: { kind: 'family', characterId: 'pc-brutus' },
          holder: 'leader-1', potency: 2, status: 'held', acquiredSeason: 1, flavorText: '', discovered: true,
        },
        {
          id: 's2', type: 'affair', subject: { kind: 'leader', leaderId: 'leader-1' },
          holder: 'player', potency: 1, status: 'held', acquiredSeason: 1, flavorText: '',
        },
      ],
    } as any);
    const item = generateAgenda(state).find(i => i.id.startsWith('agenda-secret-against-'));
    expect(item?.severity).toBe('info');
    expect(item?.title).toContain('Stalemate');
  });

  test('#25 fires with the net income/drain summary', () => {
    const state = makeState({
      secrets: [
        {
          id: 's1', type: 'affair', subject: { kind: 'leader', leaderId: 'leader-1' },
          holder: 'player', potency: 2, status: 'extorting', acquiredSeason: 1, flavorText: '',
        },
        {
          id: 's2', type: 'embezzlement', subject: { kind: 'family', characterId: 'pc-brutus' },
          holder: 'leader-2', potency: 1, status: 'extorting', acquiredSeason: 1, flavorText: '',
        },
      ],
    } as any);
    const item = generateAgenda(state).find(i => i.id === 'agenda-extortion-active');
    expect(item).toBeDefined();
    expect(item?.detail).toContain('+');
    expect(item?.detail).toContain('−');
  });

  test('#25 does not fire with no extortion active', () => {
    const state = makeState({ secrets: [] } as any);
    expect(generateAgenda(state).some(i => i.id === 'agenda-extortion-active')).toBe(false);
  });

});
