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
  tickLeaderCorruption,
  computeTotalPrepStrength,
  gatherEvidenceCost,
  gatherEvidenceBonus,
  applyGatherEvidence,
  presentSecretEvidenceBonus,
  applyPresentSecretEvidence,
  applySecureWitness,
  prepareOrationBonus,
  applyPrepareOration,
  invokeAncestorsBonus,
  applyInvokeAncestors,
  applyBribeJurors,
  applyBribePraetor,
  applyIntimidateWitness,
  findOpponentLeader,
  resolveTrialOutcome,
  OUTCOME_CONSEQUENCES,
} from '../src/engine/trialEngine';
import { BALANCE } from '../src/data/balance';
import { TAXATION_CORRUPTION_PER_TURN } from '../src/models/city';
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
    // Phase 4, Chunk P4-F — resolveTrialOutcome's prosecution-win reward
    // path reads/writes this; every fixture needs a real array, not undefined.
    legacyObjectives: [
      { definitionId: 'prosecutions_won', currentValue: 0, milestonesReached: [] },
      { definitionId: 'magistrates_convicted', currentValue: 0, milestonesReached: [] },
    ],
    ...overrides,
  };
  return base as unknown as GameState;
}

function makePrep(overrides: Partial<TrialState['playerPrep']> = {}): TrialState['playerPrep'] {
  return {
    logos: 0, pathos: 0, ethos: 0, actionsUsed: [],
    witnesses: [], bribedClanIds: [], praetorBribed: false,
    ...overrides,
  };
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
    // Approach defaults to 'procedure' (×1.1 Logos, ×1 Pathos/Ethos) — test
    // fixtures below put verdict-math values in `pathos` specifically so
    // they pass through computeTotalPrepStrength unmultiplied, preserving
    // this suite's pre-P4-D numbers. Approach-multiplier behavior itself is
    // covered by its own describe block.
    playerPrep: makePrep({ pathos: 20 }),
    approach: 'procedure',
    speakerId: 'pc-1',
    npcStrength: 20,
    juryLean: 0,
    consumedSecretIds: [],
    status: 'preparing',
    session: null,
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
    const trial = makeTrial({ seat, playerPrep: makePrep({ pathos: playerPrep }), npcStrength: npc, juryLean: 0 });
    expect(computeVerdict(trial, 'standard').outcome).toBe(expected);
  });

  test('severe tier shifts every band harsher than standard', () => {
    const trial = makeTrial({ seat: 'defense', playerPrep: makePrep({ pathos: 20 }), npcStrength: 20, juryLean: 15 });
    expect(computeVerdict(trial, 'standard').outcome).toBe('dismissed'); // 15 > 10
    expect(computeVerdict(trial, 'severe').outcome).toBe('fined');       // 15 not > 20, but > 0
  });

  test('juryLean shifts the differential', () => {
    const trial = makeTrial({ seat: 'defense', playerPrep: makePrep({ pathos: 20 }), npcStrength: 20, juryLean: -15 });
    expect(computeVerdict(trial, 'standard').outcome).toBe('exiled'); // 0 - 15 = -15: not > -10, but > -30
  });

  test('differential reported is the player\'s own (unflipped) value, not the defendant-flipped one', () => {
    const trial = makeTrial({ seat: 'prosecution', playerPrep: makePrep({ pathos: 100 }), npcStrength: 0, juryLean: 0 });
    const { differential, outcome } = computeVerdict(trial, 'standard');
    expect(differential).toBeCloseTo(70); // player did well...
    expect(outcome).toBe('executed');     // ...which is bad news for the defendant.
  });

  test('Ferocity grants a flat bonus against a low-Rhetoric opponent', () => {
    const base = makeTrial({ seat: 'defense', approach: 'ferocity', playerPrep: makePrep({ pathos: 20 }), npcStrength: 20, juryLean: 0 });
    const lowRhetoric = BALANCE.trials.approach.ferocity.lowRhetoricThreshold - 1;
    const highRhetoric = BALANCE.trials.approach.ferocity.lowRhetoricThreshold + 5;
    const { differential: withBonus } = computeVerdict(base, 'standard', lowRhetoric);
    const { differential: withoutBonus } = computeVerdict(base, 'standard', highRhetoric);
    expect(withBonus - withoutBonus).toBeCloseTo(BALANCE.trials.approach.ferocity.lowRhetoricBonus);
  });

  test('Sympathy doubles juryLean\'s weight', () => {
    // Ethos specifically — neither 'procedure' nor 'sympathy' defines an
    // Ethos multiplier (both default to ×1), so switching approach here
    // isolates the juryLean-weight effect from Sympathy's own Pathos/Logos
    // multipliers (which would otherwise also shift finalPlayer).
    const procedureTrial = makeTrial({ seat: 'defense', approach: 'procedure', playerPrep: makePrep({ ethos: 20 }), npcStrength: 20, juryLean: 10 });
    const sympathyTrial = { ...procedureTrial, approach: 'sympathy' as const };
    const { differential: procDiff } = computeVerdict(procedureTrial, 'standard');
    const { differential: sympDiff } = computeVerdict(sympathyTrial, 'standard');
    expect(sympDiff - procDiff).toBeCloseTo(10); // one extra ×juryLean(10)
  });
});

describe('computeTotalPrepStrength', () => {
  test('procedure multiplies Logos only', () => {
    const prep = makePrep({ logos: 10, pathos: 10, ethos: 10 });
    expect(computeTotalPrepStrength(prep, 'procedure')).toBeCloseTo(10 * 1.1 + 10 + 10);
  });

  test('ferocity multiplies Logos up and Ethos down', () => {
    const prep = makePrep({ logos: 10, pathos: 10, ethos: 10 });
    expect(computeTotalPrepStrength(prep, 'ferocity')).toBeCloseTo(10 * 1.2 + 10 + 10 * 0.9);
  });

  test('sympathy multiplies Pathos up and Logos down', () => {
    const prep = makePrep({ logos: 10, pathos: 10, ethos: 10 });
    expect(computeTotalPrepStrength(prep, 'sympathy')).toBeCloseTo(10 * 0.9 + 10 * 1.25 + 10);
  });

  test('caps at 100', () => {
    const prep = makePrep({ logos: 100, pathos: 100, ethos: 100 });
    expect(computeTotalPrepStrength(prep, 'sympathy')).toBe(100);
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

  test('preserves purchased strength exactly (design invariant 9) — seeded into Logos', () => {
    const result = convertLegacyTrial(makeLegacy({ defenseStrength: 77 }), 20, [makeClan()], 'pc-1');
    expect(result.playerPrep.logos).toBe(77);
    expect(result.playerPrep.pathos).toBe(0);
    expect(result.playerPrep.ethos).toBe(0);
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

describe('the Basilica prep verbs (Phase 4, Chunk P4-D)', () => {
  test('gatherEvidenceCost rises per use; applyGatherEvidence adds Intrigus-scaled Logos and records the use', () => {
    expect(gatherEvidenceCost(0)).toBe(BALANCE.trials.prep.gatherEvidenceCostBaseFides);
    expect(gatherEvidenceCost(2)).toBe(
      BALANCE.trials.prep.gatherEvidenceCostBaseFides + 2 * BALANCE.trials.prep.gatherEvidenceCostPerUseFides
    );
    expect(gatherEvidenceBonus(5)).toBe(BALANCE.trials.prep.gatherEvidenceBonusBase + 5);

    const result = applyGatherEvidence(makePrep(), 5);
    expect(result.logos).toBe(gatherEvidenceBonus(5));
    expect(result.actionsUsed).toEqual(['gather_evidence']);
  });

  test('presentSecretEvidenceBonus scales with potency; applyPresentSecretEvidence adds to Logos', () => {
    expect(presentSecretEvidenceBonus(2)).toBe(2 * BALANCE.trials.prep.presentSecretEvidenceBonusPerPotency);
    const result = applyPresentSecretEvidence(makePrep({ logos: 10 }), 3);
    expect(result.logos).toBe(10 + presentSecretEvidenceBonus(3));
    expect(result.actionsUsed).toEqual(['present_secret_evidence']);
  });

  test('applySecureWitness adds a named Witness and Pathos', () => {
    const result = applySecureWitness(makePrep(), 'Corvus');
    expect(result.pathos).toBe(BALANCE.trials.prep.secureWitnessBonus);
    expect(result.witnesses).toHaveLength(1);
    expect(result.witnesses[0].name).toBe('Corvus');
    expect(result.actionsUsed).toEqual(['secure_witness']);
  });

  test('prepareOrationBonus scales with the speaker\'s Rhetoric; value locks at purchase', () => {
    expect(prepareOrationBonus(6)).toBe(BALANCE.trials.prep.prepareOrationBonusBase + 6);
    const result = applyPrepareOration(makePrep({ pathos: 5 }), 6);
    expect(result.pathos).toBe(5 + prepareOrationBonus(6));
    expect(result.actionsUsed).toEqual(['prepare_oration']);
  });

  test('invokeAncestorsBonus scales with lifetimeDignitas, capped', () => {
    expect(invokeAncestorsBonus(0)).toBe(0);
    expect(invokeAncestorsBonus(BALANCE.trials.prep.invokeAncestorsDignitasDivisor * 2)).toBe(2);
    expect(invokeAncestorsBonus(100000)).toBe(BALANCE.trials.prep.invokeAncestorsCap);

    const result = applyInvokeAncestors(makePrep(), BALANCE.trials.prep.invokeAncestorsDignitasDivisor * 3);
    expect(result.ethos).toBe(3);
    expect(result.actionsUsed).toEqual(['invoke_ancestors']);
  });

  test('applyBribeJurors adds Ethos and records the bribed clan', () => {
    const result = applyBribeJurors(makePrep(), 'cornelii');
    expect(result.ethos).toBe(BALANCE.trials.prep.bribeJurorsBonusPerBloc);
    expect(result.bribedClanIds).toEqual(['cornelii']);
    expect(result.actionsUsed).toEqual(['bribe_jurors']);
  });

  test('applyBribePraetor adds Ethos and flags praetorBribed', () => {
    const result = applyBribePraetor(makePrep());
    expect(result.ethos).toBe(BALANCE.trials.prep.bribePraetorBonus);
    expect(result.praetorBribed).toBe(true);
    expect(result.actionsUsed).toEqual(['bribe_praetor']);
  });

  test('applyIntimidateWitness only records the one-time use (npcStrength delta is the caller\'s job)', () => {
    const result = applyIntimidateWitness(makePrep());
    expect(result.actionsUsed).toEqual(['intimidate_witness']);
    expect(result.logos).toBe(0);
    expect(result.pathos).toBe(0);
    expect(result.ethos).toBe(0);
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
    expect(trial.playerPrep).toEqual(makePrep());
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

  test('session starts null — populated only once trial day arrives (P4-E)', () => {
    const trial = buildTrialState({
      id: 't3', seat: 'defense', charge: 'peculatus', chargeSource: 'accusation',
      prosecutor: { kind: 'leader', leaderId: 'leader-1' },
      defendant: { kind: 'family', characterId: 'pc-1' },
      filedSeason: 10, startsSeason: 13, initialNpcStrength: 10, speakerId: 'pc-1',
    });
    expect(trial.session).toBeNull();
  });
});

// ─── findOpponentLeader (Phase 4, Chunk P4-E) ────────────────────────────────

describe('findOpponentLeader', () => {
  test('defense seat reads the prosecutor leader', () => {
    const clans = [makeClan({ id: 'fabii', leaders: [makeLeader({ id: 'leader-1', name: 'Fabius' })] })];
    const trial = makeTrial({ seat: 'defense', prosecutor: { kind: 'leader', leaderId: 'leader-1' } });
    const found = findOpponentLeader(trial, clans);
    expect(found?.leader.name).toBe('Fabius');
    expect(found?.clan.id).toBe('fabii');
  });

  test('prosecution seat reads the defendant leader', () => {
    const clans = [makeClan({ id: 'fabii', leaders: [makeLeader({ id: 'leader-2', name: 'Fabius Minor' })] })];
    const trial = makeTrial({ seat: 'prosecution', defendant: { kind: 'leader', leaderId: 'leader-2' } });
    expect(findOpponentLeader(trial, clans)?.leader.name).toBe('Fabius Minor');
  });

  test('null when both parties are family (no leader on the other side)', () => {
    const trial = makeTrial({
      seat: 'defense',
      prosecutor: { kind: 'leader', leaderId: 'ghost' },
      defendant: { kind: 'family', characterId: 'pc-1' },
    });
    expect(findOpponentLeader(trial, [])).toBeNull();
  });
});

// ─── resolveTrialOutcome (Phase 4, Chunk P4-E) ───────────────────────────────
// Extracted verbatim from turnSequencer's pre-P4-E step 15 — these tests
// cover the consequence-application logic that used to run inline there.

describe('resolveTrialOutcome', () => {
  test('a decisive defense win (acquitted): no character removal, corruption cleared, Dignitas up', () => {
    const state = makeState({
      family: [makeCharacter({ id: 'pc-1', corruptionScore: 40 })],
      lifetimeDignitas: 20,
    });
    const trial = makeTrial({
      seat: 'defense', charge: 'peculatus',
      defendant: { kind: 'family', characterId: 'pc-1' },
      playerPrep: makePrep({ logos: 100 }),
      npcStrength: 0,
    });

    const { trial: resolved, state: nextState } = resolveTrialOutcome(state, trial, null, 0, 0);
    expect(resolved.outcome).toBe('acquitted');
    expect(resolved.status).toBe('resolved');
    expect(resolved.session).toBeNull();
    expect(nextState.family.find(c => c.id === 'pc-1')?.corruptionScore).toBe(0);
    expect(nextState.lifetimeDignitas).toBeGreaterThan(20);
    expect(nextState.family.find(c => c.id === 'pc-1')).toBeDefined();
  });

  test('a decisive defense loss (executed) removes a non-player family defendant and dents the player\'s familyTrust', () => {
    const state = makeState({
      family: [
        makeCharacter({ id: 'pc-1', isPlayer: true, familyTrust: 100 }),
        makeCharacter({ id: 'son-1', isPlayer: false, role: 'son' }),
      ],
    });
    const trial = makeTrial({
      seat: 'defense', charge: 'peculatus',
      defendant: { kind: 'family', characterId: 'son-1' },
      playerPrep: makePrep({ logos: 0 }),
      npcStrength: 200,
    });

    const { trial: resolved, state: nextState } = resolveTrialOutcome(state, trial, null, 0, 0);
    expect(resolved.outcome).toBe('executed');
    expect(nextState.family.some(c => c.id === 'son-1')).toBe(false);
    expect(nextState.family.find(c => c.id === 'pc-1')?.familyTrust).toBeLessThan(100);
  });

  test('a player-filed prosecution that wins big proscribes the convicted leader', () => {
    const leader = makeLeader({ id: 'leader-1', name: 'Fabius' });
    const state = makeState({ clans: [makeClan({ id: 'fabii', leaders: [leader] })] });
    const trial = makeTrial({
      seat: 'prosecution', charge: 'peculatus',
      prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 100 }),
      npcStrength: 0,
    });

    const opponentFound = { clan: state.clans[0], leader };
    const { resolved, nextLeader } = (() => {
      const r = resolveTrialOutcome(state, trial, opponentFound, 0, 0);
      return { resolved: r.trial, nextLeader: r.state.clans[0].leaders[0] };
    })();
    expect(resolved.outcome).toBe('executed'); // -70 defendantDifferential (flipped) <= -30 band
    expect(nextLeader.proscribed).toBe(true);
  });

  test('a losing prosecution triggers calumnia and, when the roll hits, a counter-suit', () => {
    const leader = makeLeader({ id: 'leader-1', name: 'Fabius' });
    const state = makeState({ clans: [makeClan({ id: 'fabii', leaders: [leader] })], lifetimeDignitas: 50 });
    const trial = makeTrial({
      seat: 'prosecution', charge: 'peculatus',
      prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 0 }),
      npcStrength: 100, // finalNpc=70, finalPlayer=0 -> differential -70, well below calumniaThreshold
    });

    const opponentFound = { clan: state.clans[0], leader };
    const result = resolveTrialOutcome(state, trial, opponentFound, 0, 0, () => 0); // roll=0 always hits counterSuitChance
    expect(result.state.lifetimeDignitas).toBeLessThan(50);
    expect(result.counterSuit).not.toBeNull();
    expect(result.counterSuit?.seat).toBe('defense');
    expect(result.counterSuit?.defendant).toEqual({ kind: 'family', characterId: trial.speakerId });
    expect(result.events.some(e => e.includes('Calumnia'))).toBe(true);
  });

  test('a defense win never triggers calumnia (only losing prosecutions can)', () => {
    const state = makeState();
    const trial = makeTrial({ seat: 'defense', playerPrep: makePrep({ logos: 100 }), npcStrength: 0 });
    const result = resolveTrialOutcome(state, trial, null, 0, 0, () => 0);
    expect(result.counterSuit).toBeNull();
    expect(result.events.some(e => e.includes('Calumnia'))).toBe(false);
  });
});

// ─── Phase 5, Chunk P5-D — generic verdict-consumption flags ────────────────
// Feeds evt-aft-* aftermath content (src/data/events.ts). Covers all four
// seat/outcome combinations resolveTrialOutcome can produce, since only
// three of them get a flag (a losing prosecution is the pre-existing
// calumnia path, not a new aftermath beat).

describe('resolveTrialOutcome — P5-D aftermath flags', () => {
  test('defense win (acquitted) sets trial-resolved-defense-won and no other aftermath flag', () => {
    const state = makeState({ flags: {} });
    const trial = makeTrial({ seat: 'defense', playerPrep: makePrep({ logos: 100 }), npcStrength: 0 });
    const { state: nextState } = resolveTrialOutcome(state, trial, null, 0, 0);
    expect(nextState.flags['trial-resolved-defense-won']).toBe(true);
    expect(nextState.flags['trial-resolved-defense-lost']).toBeUndefined();
    expect(nextState.flags['trial-resolved-prosecution-won']).toBeUndefined();
  });

  test('defense loss (executed) sets trial-resolved-defense-lost, not defense-won', () => {
    const state = makeState({
      flags: {},
      family: [makeCharacter({ id: 'pc-1', isPlayer: true }), makeCharacter({ id: 'son-1', isPlayer: false, role: 'son' })],
    });
    const trial = makeTrial({
      seat: 'defense', defendant: { kind: 'family', characterId: 'son-1' },
      playerPrep: makePrep({ logos: 0 }), npcStrength: 200,
    });
    const { trial: resolved, state: nextState } = resolveTrialOutcome(state, trial, null, 0, 0);
    expect(resolved.outcome).toBe('executed');
    expect(nextState.flags['trial-resolved-defense-lost']).toBe(true);
    expect(nextState.flags['trial-resolved-defense-won']).toBeUndefined();
  });

  test('prosecution win sets trial-resolved-prosecution-won', () => {
    const leader = makeLeader({ id: 'leader-1', name: 'Fabius', votes: 12, currentOffice: null });
    const state = makeState({ flags: {}, clans: [makeClan({ id: 'fabii', leaders: [leader] })] });
    const trial = makeTrial({
      seat: 'prosecution', prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 100 }), npcStrength: 0,
    });
    const opponentFound = { clan: state.clans[0], leader };
    const { state: nextState } = resolveTrialOutcome(state, trial, opponentFound, 0, 0);
    expect(nextState.flags['trial-resolved-prosecution-won']).toBe(true);
    expect(nextState.flags['trial-resolved-defense-won']).toBeUndefined();
    expect(nextState.flags['trial-resolved-defense-lost']).toBeUndefined();
  });

  test('a losing prosecution (acquitted/dismissed) sets none of the three aftermath flags — calumnia already covers it', () => {
    const leader = makeLeader({ id: 'leader-1', name: 'Fabius' });
    const state = makeState({ flags: {}, clans: [makeClan({ id: 'fabii', leaders: [leader] })], lifetimeDignitas: 50 });
    const trial = makeTrial({
      seat: 'prosecution', prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 0 }), npcStrength: 100, // mirrors the calumnia test above: differential -70, defendantDifferential +70 -> acquitted
    });
    const opponentFound = { clan: state.clans[0], leader };
    const { trial: resolved, state: nextState } = resolveTrialOutcome(state, trial, opponentFound, 0, 0, () => 0.99);
    expect(['acquitted', 'dismissed']).toContain(resolved.outcome);
    expect(nextState.flags['trial-resolved-prosecution-won']).toBeUndefined();
    expect(nextState.flags['trial-resolved-defense-won']).toBeUndefined();
    expect(nextState.flags['trial-resolved-defense-lost']).toBeUndefined();
  });
});

// ─── Prosecution victory rewards & defense vindication (Phase 4, Chunk P4-F) ─

describe('resolveTrialOutcome — P4-F rewards', () => {
  test('a prosecution win grants dignitas base + target votes, and the "Accusator" legacy milestone', () => {
    const leader = makeLeader({ id: 'leader-1', name: 'Fabius', votes: 12, currentOffice: null });
    const state = makeState({ clans: [makeClan({ id: 'fabii', leaders: [leader] })], lifetimeDignitas: 50 });
    const trial = makeTrial({
      seat: 'prosecution', charge: 'peculatus',
      prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 100 }),
      npcStrength: 0,
    });
    const opponentFound = { clan: state.clans[0], leader };
    const result = resolveTrialOutcome(state, trial, opponentFound, 0, 0);

    expect(result.trial.outcome).toBe('executed');
    // The charge's own consequence (OUTCOME_CONSEQUENCES.executed) always
    // applies first, on top of which the P4-F reward is added.
    const expectedGain = OUTCOME_CONSEQUENCES.executed.lifetimeDignitas + BALANCE.trials.rewards.prosecutionWinDignitasBase + 12;
    expect(result.state.lifetimeDignitas).toBe(50 + expectedGain);
    expect(result.trial.convictedSittingMagistrate).toBeUndefined();
    expect(result.state.legacyObjectives.find(o => o.definitionId === 'prosecutions_won')?.currentValue).toBe(1);
    expect(result.events.some(e => e.includes('Accusator'))).toBe(true);
  });

  test('convicting a sitting magistrate adds the bonus and the "Vox Populi" milestone', () => {
    const leader = makeLeader({ id: 'leader-1', name: 'Fabius', votes: 12, currentOffice: 'praetor' });
    const state = makeState({ clans: [makeClan({ id: 'fabii', leaders: [leader] })], lifetimeDignitas: 50 });
    const trial = makeTrial({
      seat: 'prosecution', charge: 'peculatus',
      prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 100 }),
      npcStrength: 0,
    });
    const opponentFound = { clan: state.clans[0], leader };
    const result = resolveTrialOutcome(state, trial, opponentFound, 0, 0);

    const expectedGain = OUTCOME_CONSEQUENCES.executed.lifetimeDignitas
      + BALANCE.trials.rewards.prosecutionWinDignitasBase + 12 + BALANCE.trials.rewards.sittingMagistrateBonus;
    expect(result.state.lifetimeDignitas).toBe(50 + expectedGain);
    expect(result.trial.convictedSittingMagistrate).toBe(true);
    expect(result.state.legacyObjectives.find(o => o.definitionId === 'magistrates_convicted')?.currentValue).toBe(1);
    expect(result.events.some(e => e.includes('Vox Populi'))).toBe(true);
  });

  test('a prosecution loss (acquitted/dismissed) grants no reward and no milestone', () => {
    const leader = makeLeader({ id: 'leader-1', votes: 12, currentOffice: 'praetor' });
    const state = makeState({ clans: [makeClan({ id: 'fabii', leaders: [leader] })], lifetimeDignitas: 50 });
    const trial = makeTrial({
      seat: 'prosecution', charge: 'peculatus',
      prosecutor: { kind: 'player', speakerId: 'pc-1' },
      defendant: { kind: 'leader', leaderId: 'leader-1' },
      playerPrep: makePrep({ logos: 0 }),
      npcStrength: 100, // well-defended -> the defendant is acquitted, a prosecution loss
    });
    const opponentFound = { clan: state.clans[0], leader };
    const result = resolveTrialOutcome(state, trial, opponentFound, 0, 0, () => 0.99); // no counter-suit
    expect(result.trial.outcome).toBe('acquitted');
    // Acquitted's own consequence (+5) applies, and — this decisive a loss —
    // so does calumnia (-15); neither is the P4-F reward path under test here.
    expect(result.state.lifetimeDignitas).toBe(
      50 + OUTCOME_CONSEQUENCES.acquitted.lifetimeDignitas + BALANCE.trials.calumniaDignitas
    );
    expect(result.state.legacyObjectives.find(o => o.definitionId === 'prosecutions_won')?.currentValue).toBe(0);
  });

  test('a defense win at the Dismissed tier grants vindicatedDignitas; Acquitted does not', () => {
    const dismissedState = makeState({ lifetimeDignitas: 50 });
    // pathos=40, npc=10 -> standard bands: dismissed (15 > 10, not > 30 -> wait recompute)
    const dismissedTrial = makeTrial({ seat: 'defense', playerPrep: makePrep({ pathos: 40 }), npcStrength: 10 });
    const dismissedResult = resolveTrialOutcome(dismissedState, dismissedTrial, null, 0, 0);
    expect(dismissedResult.trial.outcome).toBe('dismissed');
    expect(dismissedResult.state.lifetimeDignitas).toBe(50 + BALANCE.trials.rewards.vindicatedDignitas);

    const acquittedState = makeState({ lifetimeDignitas: 50 });
    const acquittedTrial = makeTrial({ seat: 'defense', playerPrep: makePrep({ pathos: 100 }), npcStrength: 0 });
    const acquittedResult = resolveTrialOutcome(acquittedState, acquittedTrial, null, 0, 0);
    expect(acquittedResult.trial.outcome).toBe('acquitted');
    // Acquitted's own consequence (+5) still applies — just not vindicatedDignitas on top.
    expect(acquittedResult.state.lifetimeDignitas).toBe(50 + OUTCOME_CONSEQUENCES.acquitted.lifetimeDignitas);
  });
});

describe('computeVerdict — finalPlayer/finalNpc (Phase 4, Chunk P4-F)', () => {
  test('exposes the two sides\' final scores used to decide the verdict', () => {
    const trial = makeTrial({ seat: 'defense', playerPrep: makePrep({ pathos: 40 }), npcStrength: 10, juryLean: 0 });
    const { finalPlayer, finalNpc } = computeVerdict(trial, 'standard');
    expect(finalPlayer).toBeCloseTo(40 * BALANCE.trials.prepShare);
    expect(finalNpc).toBeCloseTo(10 * BALANCE.trials.prepShare);
  });

  test('finalPlayer includes performance', () => {
    const trial = makeTrial({ seat: 'defense', playerPrep: makePrep({ pathos: 40 }), npcStrength: 10, juryLean: 0 });
    const { finalPlayer } = computeVerdict(trial, 'standard', 5, 8, 0);
    expect(finalPlayer).toBeCloseTo(40 * BALANCE.trials.prepShare + 8);
  });
});
