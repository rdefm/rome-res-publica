import {
  shouldTriggerTrial,
  buildTrialState,
  canFileProsecution,
  computeOpponentPrepGrowth,
  estimateOpponentStrength,
  computeJuryLean,
  computeVerdict,
  checkCalumnia,
  convertLegacyTrial,
  applyLegacyTrialAction,
  tickLeaderCorruption,
} from '../src/engine/trialEngine';
import { BALANCE } from '../src/data/balance';
import { TAXATION_CORRUPTION_PER_TURN } from '../src/models/province';
import type { Character } from '../src/models/character';
import type { Clan, ClanLeader } from '../src/models/clan';
import type { GameState } from '../src/state/gameStore';
import type { TrialState, LegacyTrial } from '../src/models/trial';
import type { Secret } from '../src/models/secret';

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
    formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    ...overrides,
  };
}

function makeHostileClan(id: string): Clan {
  return { id, name: `Gens ${id}`, gensName: id, sigil: '🏛️', influence: 50, desc: '', leaders: [] } as Clan;
}

function makeLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
  return {
    id: 'leader-1', name: 'L. Testius', title: 'Senator', emoji: '👤', age: 55,
    sphere: 'Senate', relationship: 20, favour: 0, blackmail: false, bias: 'optimates',
    votes: 10, bio: '', skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
    ...overrides,
  };
}

function makeClan(overrides: Partial<Clan> = {}): Clan {
  return {
    id: 'testii', name: 'Gens Testia', gensName: 'Testius', sigil: '🏛️',
    influence: 50, desc: '', leaders: [makeLeader()],
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
    trials: [] as TrialState[],
    clans: [],
    familyReputations: {},
    electionRivals: [],
    tribuneHolder: null,
    secrets: [] as Secret[],
    ownedAssets: [],
    campaignVotes: {},
    campaigning: null,
    ...overrides,
  };
  return base as unknown as GameState;
}

function makeTrial(overrides: Partial<TrialState> = {}): TrialState {
  return {
    id: 'trial-1',
    seat: 'defense',
    charge: 'peculatus',
    chargeSource: 'accusation',
    prosecutor: { kind: 'leader', leaderId: 'leader-1' },
    defendant: { kind: 'family', characterId: 'pc-1' },
    filedSeason: 10,
    startsSeason: 13,
    playerPrep: { totalStrength: 20, actionsUsed: [] },
    approach: 'procedure',
    speakerId: 'pc-1',
    npcStrength: 20,
    juryLean: 0,
    consumedSecretIds: [],
    status: 'preparing',
    ...overrides,
  };
}

// ─── Pre-existing branches (light smoke coverage — no dedicated test file
// existed before this chunk touched shouldTriggerTrial) ────────────────────

describe('shouldTriggerTrial — guard clauses', () => {
  test('no trial while a family member holds Tribune (sacrosanctity)', () => {
    const state = makeState({
      tribuneHolder: 'pc-1',
      family: [makeCharacter({ corruptionScore: 90 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: -50 },
    });
    expect(shouldTriggerTrial(state)).toBeNull();
  });

  test('no trial when an unresolved trial is already queued', () => {
    const state = makeState({
      trials: [makeTrial({ status: 'preparing' })],
      family: [makeCharacter({ corruptionScore: 90 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: -50 },
    });
    expect(shouldTriggerTrial(state)).toBeNull();
  });

  test('no trial when no clan is hostile/rival', () => {
    const state = makeState({
      family: [makeCharacter({ corruptionScore: 90 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: 50 }, // not hostile
    });
    expect(shouldTriggerTrial(state)).toBeNull();
  });
});

// ─── Military Overhaul M4 — defeated general prosecution ────────────────────

describe('shouldTriggerTrial — defeated general prosecution (M4)', () => {
  function hostileState(overrides: Partial<GameState> = {}): GameState {
    return makeState({
      family: [makeCharacter({ id: 'pc-1' }), makeCharacter({ id: 'son-1', role: 'son', isPlayer: false, age: 25 })],
      clans: [makeHostileClan('cornelii')],
      familyReputations: { cornelii: -50 },
      ...overrides,
    });
  }

  test('can accuse a non-paterfamilias family member (unlike the corruption/treason checks, which only ever accuse the player)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-son-1': true } });
    const originalRandom = Math.random;
    Math.random = () => 0; // inside the 25% chance
    try {
      const trigger = shouldTriggerTrial(state);
      expect(trigger).toEqual({
        charge: 'military_incompetence',
        chargeSource: 'accusation',
        accusedId: 'son-1',
        accusingClanId: 'cornelii',
      });
    } finally {
      Math.random = originalRandom;
    }
  });

  test('does not fire the trial when the random roll misses (flag persists for next season)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-son-1': true } });
    const originalRandom = Math.random;
    Math.random = () => 0.99; // outside the 25% chance
    try {
      expect(shouldTriggerTrial(state)).toBeNull();
    } finally {
      Math.random = originalRandom;
    }
  });

  test('ignores a defeatedGeneral flag for a character no longer in the family (already removed/succeeded)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-someone-else': true } });
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      expect(shouldTriggerTrial(state)).toBeNull();
    } finally {
      Math.random = originalRandom;
    }
  });

  test('a false-valued flag does not trigger (only true)', () => {
    const state = hostileState({ flags: { 'defeatedGeneral-son-1': false } });
    const originalRandom = Math.random;
    Math.random = () => 0;
    try {
      expect(shouldTriggerTrial(state)).toBeNull();
    } finally {
      Math.random = originalRandom;
    }
  });
});

// ─── Phase 4, Chunk P4-C — "one pipeline, two seats" ────────────────────────

describe('canFileProsecution', () => {
  function makeCriminalSecret(overrides: Partial<Secret> = {}): Secret {
    return {
      id: 's1', type: 'embezzlement', subject: { kind: 'leader', leaderId: 'leader-1' },
      holder: 'player', potency: 2, status: 'held', acquiredSeason: 1, flavorText: '',
      ...overrides,
    };
  }

  test('eligible via secret path when a held criminal Secret exists', () => {
    const leader = makeLeader({ id: 'leader-1', corruptionScore: 0 });
    const result = canFileProsecution(leader, [makeCriminalSecret()]);
    expect(result.eligible).toBe(true);
    expect(result.via).toBe('secret');
    expect(result.evidenceSecret?.id).toBe('s1');
  });

  test('picks the highest-potency criminal secret when multiple exist', () => {
    const leader = makeLeader({ id: 'leader-1' });
    const low = makeCriminalSecret({ id: 'low', potency: 1 });
    const high = makeCriminalSecret({ id: 'high', potency: 3 });
    expect(canFileProsecution(leader, [low, high]).evidenceSecret?.id).toBe('high');
  });

  test('ignores social secrets, spent secrets, and secrets on other leaders', () => {
    const leader = makeLeader({ id: 'leader-1' });
    const social = makeCriminalSecret({ id: 'social', type: 'affair' });
    const spent = makeCriminalSecret({ id: 'spent', status: 'spent' });
    const other = makeCriminalSecret({ id: 'other', subject: { kind: 'leader', leaderId: 'leader-2' } });
    expect(canFileProsecution(leader, [social, spent, other]).eligible).toBe(false);
  });

  test('eligible via corruption path when no secret but corruption crosses the threshold', () => {
    const leader = makeLeader({ id: 'leader-1', corruptionScore: BALANCE.trials.corruptionChargeThreshold });
    const result = canFileProsecution(leader, []);
    expect(result.eligible).toBe(true);
    expect(result.via).toBe('corruption');
  });

  test('neither path qualifies -> blocked', () => {
    const leader = makeLeader({ id: 'leader-1', corruptionScore: BALANCE.trials.corruptionChargeThreshold - 1 });
    const result = canFileProsecution(leader, []);
    expect(result.eligible).toBe(false);
    expect(result.via).toBeNull();
  });

  test('secret path preferred over corruption path when both qualify', () => {
    const leader = makeLeader({ id: 'leader-1', corruptionScore: 100 });
    expect(canFileProsecution(leader, [makeCriminalSecret()]).via).toBe('secret');
  });
});

describe('computeOpponentPrepGrowth', () => {
  test('scales with intrigus and clan influence', () => {
    expect(computeOpponentPrepGrowth(0, 0)).toBeCloseTo(BALANCE.trials.npcPrepBase);
    expect(computeOpponentPrepGrowth(5, 0)).toBeCloseTo(BALANCE.trials.npcPrepBase + 5 * BALANCE.trials.npcPrepPerIntrigue);
    expect(computeOpponentPrepGrowth(0, 50)).toBeCloseTo(BALANCE.trials.npcPrepBase + 50 * BALANCE.trials.npcPrepClanFactor);
  });
});

describe('estimateOpponentStrength', () => {
  test('exact value when intel signal present', () => {
    expect(estimateOpponentStrength(50, true)).toEqual({ exact: true, value: 50 });
  });

  test('±estimateBandPct band otherwise', () => {
    const band = BALANCE.trials.estimateBandPct;
    expect(estimateOpponentStrength(100, false)).toEqual({
      exact: false,
      low: Math.round(100 * (1 - band)),
      high: Math.round(100 * (1 + band)),
    });
  });
});

describe('computeJuryLean', () => {
  test('zero with no clans', () => {
    expect(computeJuryLean([], {})).toBe(0);
  });

  test('positive when the family is well-regarded, negative when reviled', () => {
    const clanA = makeClan({ id: 'a', leaders: [makeLeader({ id: 'la', votes: 10 })] });
    expect(computeJuryLean([clanA], { a: 100 })).toBeGreaterThan(0);
    expect(computeJuryLean([clanA], { a: -100 })).toBeLessThan(0);
  });

  test('clamped to ±juryLeanCap', () => {
    const clanA = makeClan({ id: 'a', leaders: [makeLeader({ id: 'la', votes: 10 })] });
    expect(computeJuryLean([clanA], { a: 100 })).toBeLessThanOrEqual(BALANCE.trials.juryLeanCap);
    expect(computeJuryLean([clanA], { a: -100 })).toBeGreaterThanOrEqual(-BALANCE.trials.juryLeanCap);
  });
});

describe('computeVerdict', () => {
  // Each row's (playerPrep, npc) yields the SAME differential magnitude;
  // 'standard' band thresholds: acquitted>30, dismissed>10, fined>-10, exiled>-30.
  // defense reads the differential as-is; prosecution reads it flipped —
  // "the same bands read from the other side."
  const cases: Array<{ playerPrep: number; npc: number; seat: 'defense' | 'prosecution'; expected: string }> = [
    { playerPrep: 100, npc: 0,   seat: 'defense',    expected: 'acquitted' },
    { playerPrep: 40,  npc: 10,  seat: 'defense',    expected: 'dismissed' },
    { playerPrep: 20,  npc: 20,  seat: 'defense',    expected: 'fined' },
    { playerPrep: 10,  npc: 40,  seat: 'defense',    expected: 'exiled' },
    { playerPrep: 0,   npc: 100, seat: 'defense',    expected: 'executed' },
    { playerPrep: 0,   npc: 100, seat: 'prosecution', expected: 'acquitted' },
    { playerPrep: 10,  npc: 40,  seat: 'prosecution', expected: 'dismissed' },
    { playerPrep: 20,  npc: 20,  seat: 'prosecution', expected: 'fined' },
    { playerPrep: 40,  npc: 10,  seat: 'prosecution', expected: 'exiled' },
    { playerPrep: 100, npc: 0,   seat: 'prosecution', expected: 'executed' },
  ];

  test.each(cases)('$seat prep=$playerPrep vs npc=$npc -> $expected', ({ playerPrep, npc, seat, expected }) => {
    const trial = makeTrial({ seat, playerPrep: { totalStrength: playerPrep, actionsUsed: [] }, npcStrength: npc, juryLean: 0 });
    expect(computeVerdict(trial, 'standard').outcome).toBe(expected);
  });

  test('severe tier shifts every band harsher than standard', () => {
    const trial = makeTrial({ seat: 'defense', playerPrep: { totalStrength: 20, actionsUsed: [] }, npcStrength: 20, juryLean: 15 });
    expect(computeVerdict(trial, 'standard').outcome).toBe('dismissed'); // 15 > 10
    expect(computeVerdict(trial, 'severe').outcome).toBe('fined');       // 15 not > 20, but > 0
  });

  test('juryLean shifts the differential', () => {
    const trial = makeTrial({ seat: 'defense', playerPrep: { totalStrength: 20, actionsUsed: [] }, npcStrength: 20, juryLean: -15 });
    expect(computeVerdict(trial, 'standard').outcome).toBe('exiled'); // 0 - 15 = -15: not > -10, but > -30
  });

  test('differential reported is the player\'s own (unflipped) value, not the defendant-flipped one', () => {
    const trial = makeTrial({ seat: 'prosecution', playerPrep: { totalStrength: 100, actionsUsed: [] }, npcStrength: 0, juryLean: 0 });
    const { differential, outcome } = computeVerdict(trial, 'standard');
    expect(differential).toBeCloseTo(70); // player did well...
    expect(outcome).toBe('executed');     // ...which is bad news for the defendant.
  });
});

describe('checkCalumnia', () => {
  test('never triggers for a defense-seat trial, however badly it went', () => {
    const trial = makeTrial({ seat: 'defense' });
    expect(checkCalumnia(trial, -1000, 0).triggered).toBe(false);
  });

  test('does not trigger when the prosecution differential is at/above the threshold', () => {
    const trial = makeTrial({ seat: 'prosecution' });
    expect(checkCalumnia(trial, BALANCE.trials.calumniaThreshold, 0).triggered).toBe(false);
  });

  test('triggers on a clear prosecution loss, applying the fixed penalties', () => {
    const trial = makeTrial({ seat: 'prosecution' });
    const result = checkCalumnia(trial, BALANCE.trials.calumniaThreshold - 1, 0.99); // roll misses counter-suit
    expect(result.triggered).toBe(true);
    expect(result.dignitasDelta).toBe(BALANCE.trials.calumniaDignitas);
    expect(result.clanRelationsDelta).toBe(BALANCE.trials.calumniaClanRelations);
    expect(result.counterSuitRolled).toBe(false);
  });

  test('counter-suit rolls independently of the trigger', () => {
    const trial = makeTrial({ seat: 'prosecution' });
    expect(checkCalumnia(trial, BALANCE.trials.calumniaThreshold - 1, 0).counterSuitRolled).toBe(true);
  });
});

describe('convertLegacyTrial (save migration)', () => {
  function makeLegacy(overrides: Partial<LegacyTrial> = {}): LegacyTrial {
    return {
      id: 'legacy-1', accusedCharacterId: 'pc-1', accusingClanId: 'testii',
      charge: 'corruption', defenseStrength: 45, prosecutionStrength: 60,
      turnsRemaining: 2, resolved: false, actionsUsed: ['hire_advocate'],
      ...overrides,
    };
  }

  test('preserves purchased strength exactly (design invariant 9)', () => {
    const result = convertLegacyTrial(makeLegacy({ defenseStrength: 77 }), 20, [makeClan()], 'pc-1');
    expect(result.playerPrep.totalStrength).toBe(77);
    expect(result.playerPrep.actionsUsed).toEqual(['hire_advocate']);
  });

  test('maps every legacy charge to a real ChargeId', () => {
    const clans = [makeClan()];
    expect(convertLegacyTrial(makeLegacy({ charge: 'corruption' }), 20, clans, 'pc-1').charge).toBe('peculatus');
    expect(convertLegacyTrial(makeLegacy({ charge: 'treason' }), 20, clans, 'pc-1').charge).toBe('maiestas');
    expect(convertLegacyTrial(makeLegacy({ charge: 'electoral_fraud' }), 20, clans, 'pc-1').charge).toBe('ambitus');
    expect(convertLegacyTrial(makeLegacy({ charge: 'military_incompetence' }), 20, clans, 'pc-1').charge).toBe('military_incompetence');
    expect(convertLegacyTrial(makeLegacy({ charge: 'murder' }), 20, clans, 'pc-1').charge).toBe('maiestas');
  });

  test('startsSeason is exact; always defense seat with the accused as defendant', () => {
    const result = convertLegacyTrial(makeLegacy({ turnsRemaining: 3 }), 20, [makeClan()], 'pc-1');
    expect(result.startsSeason).toBe(23);
    expect(result.seat).toBe('defense');
    expect(result.defendant).toEqual({ kind: 'family', characterId: 'pc-1' });
  });

  test('preserves resolved status and outcome for historical entries', () => {
    const result = convertLegacyTrial(makeLegacy({ resolved: true, outcome: 'acquitted' }), 20, [makeClan()], 'pc-1');
    expect(result.status).toBe('resolved');
    expect(result.outcome).toBe('acquitted');
  });
});

describe('applyLegacyTrialAction (TRIAL_ACTIONS shim)', () => {
  test('adds the action bonus and records the action id', () => {
    const prep = { totalStrength: 20, actionsUsed: [] as string[] };
    const action = { id: 'hire_advocate', label: 'Hire a Plebeian Advocate', cost: { resource: 'denarii' as const, amount: 40 }, defenseBonus: 15 };
    const result = applyLegacyTrialAction(prep, action);
    expect(result.totalStrength).toBe(35);
    expect(result.actionsUsed).toEqual(['hire_advocate']);
  });

  test('caps at 100', () => {
    const prep = { totalStrength: 95, actionsUsed: [] as string[] };
    const action = { id: 'bribe_jury', label: 'Bribe the Jury', cost: { resource: 'denarii' as const, amount: 80 }, defenseBonus: 35 };
    expect(applyLegacyTrialAction(prep, action).totalStrength).toBe(100);
  });
});

describe('tickLeaderCorruption', () => {
  test('leaders who never held praetor/consul never accrue corruption', () => {
    const leader = makeLeader({ heldOffices: ['quaestor'], corruptionScore: 0 });
    expect(tickLeaderCorruption(leader, () => 0)).toBe(0);
  });

  test('eligible leaders accrue via the real TAXATION_CORRUPTION_PER_TURN table when the activeChance roll hits', () => {
    const leader = makeLeader({ heldOffices: ['praetor'], corruptionScore: 0, relationship: -50 });
    // Hostile standing (< hostileStandingMax) + roll 0 -> 'extortionate' notch.
    expect(tickLeaderCorruption(leader, () => 0)).toBe(TAXATION_CORRUPTION_PER_TURN.extortionate);
  });

  test('does not accrue when the activeChance roll misses', () => {
    const leader = makeLeader({ heldOffices: ['consul'], corruptionScore: 10 });
    expect(tickLeaderCorruption(leader, () => 0.999)).toBe(10);
  });

  test('caps at 100', () => {
    const leader = makeLeader({ heldOffices: ['praetor'], corruptionScore: 98, relationship: -50 });
    expect(tickLeaderCorruption(leader, () => 0)).toBeLessThanOrEqual(100);
  });
});

describe('buildTrialState', () => {
  test('builds a fresh preparing trial with zeroed playerPrep/juryLean and the given npcStrength', () => {
    const trial = buildTrialState({
      id: 't1', seat: 'defense', charge: 'peculatus', chargeSource: 'accusation',
      prosecutor: { kind: 'leader', leaderId: 'leader-1' },
      defendant: { kind: 'family', characterId: 'pc-1' },
      filedSeason: 10, startsSeason: 13, initialNpcStrength: 25, speakerId: 'pc-1',
    });
    expect(trial.status).toBe('preparing');
    expect(trial.playerPrep).toEqual({ totalStrength: 0, actionsUsed: [] });
    expect(trial.npcStrength).toBe(25);
    expect(trial.juryLean).toBe(0);
    expect(trial.approach).toBe('procedure');
    expect(trial.consumedSecretIds).toEqual([]);
  });

  test('consumedSecretIds can be set explicitly (evidence consumption at filing)', () => {
    const trial = buildTrialState({
      id: 't2', seat: 'prosecution', charge: 'ambitus', chargeSource: 'secret',
      prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      filedSeason: 10, startsSeason: 13, initialNpcStrength: 10,
      consumedSecretIds: ['s1'], speakerId: 'pc-1',
    });
    expect(trial.consumedSecretIds).toEqual(['s1']);
  });
});
