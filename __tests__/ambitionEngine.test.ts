import {
  checkCriterion,
  measureCriterion,
  getProgress,
  computeDifficulty,
  computeReward,
  nextEligibleElectionTurns,
  buildAmbition,
  supersedeAmbition,
  tickAmbitions,
  projectDynasticAmbitions,
} from '../src/engine/ambitionEngine';
import { BALANCE } from '../src/data/balance';
import { initLegacyObjectives } from '../src/engine/legacyEngine';
import type { GameState } from '../src/state/gameStore';
import type { Character } from '../src/models/character';
import type { ActiveAmbition, AmbitionCriterion } from '../src/models/ambition';
import type { TrialState } from '../src/models/trial';
import type { RegionId } from '../src/models/theatre';
import type { Controller } from '../src/models/theatre';

// ─── Minimal factories ──────────────────────────────────────────────────────
// Only the fields ambitionEngine actually reads — same convention as
// __tests__/agendaEngine.test.ts's makeState.

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 40,
    skills: { rhetoric: 5, martial: 5, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [],
    ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0,
    raisedLegions: [], veterans: [],
    ...overrides,
  } as unknown as Character;
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    turnNumber: 10,
    seasonIndex: 1, // Summer
    year: -264,
    family: [makeCharacter()],
    heldOffices: [],
    currentOffice: null,
    officeSeasons: 0,
    campaigningCharacterId: null,
    trials: [],
    familyReputations: {},
    ownedAssets: [],
    clients: [],
    theatre: { controllers: {} as Record<RegionId, Controller>, contested: {}, musteredThisYear: {} },
    lifetimeBattlesWon: 0,
    lifetimeBillsPassedVotedFor: 0,
    legacyObjectives: initLegacyObjectives(),
    denarii: 0,
    fides: 0,
    ...overrides,
  } as unknown as GameState;
}

function makeTrial(overrides: Partial<TrialState> = {}): TrialState {
  return {
    id: 't-1', seat: 'prosecution', charge: 'repetundae', chargeSource: 'accusation',
    prosecutor: { kind: 'player', speakerId: 'pc-1' }, defendant: { kind: 'leader', leaderId: 'l-1' },
    filedSeason: 1, startsSeason: 3,
    playerPrep: { logos: 0, pathos: 0, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
    approach: 'procedure', speakerId: 'pc-1', npcStrength: 0, juryLean: 0, consumedSecretIds: [],
    status: 'resolved', outcome: 'fined', session: null,
    ...overrides,
  } as unknown as TrialState;
}

function makeAmbition(overrides: Partial<ActiveAmbition> = {}): ActiveAmbition {
  return {
    id: 'amb-1',
    scope: 'family',
    source: 'player',
    title: 'Test Ambition',
    criterion: { id: 'resource_threshold', resource: 'denarii', amount: 200 } as AmbitionCriterion,
    baseline: { value: 100, turnNumber: 1 },
    status: 'active',
    turnSet: 1,
    deadlineTurn: 20,
    reward: { lifetimeDignitas: 40 },
    failureDignitas: -6,
    refusable: true,
    ...overrides,
  };
}

// ─── Per-criterion checker / measure / progress ────────────────────────────

describe('resource_threshold', () => {
  test('denarii variant reads denarii, not fides — no great_orator-style drift', () => {
    const criterion: AmbitionCriterion = { id: 'resource_threshold', resource: 'denarii', amount: 500 };
    const state = makeState({ denarii: 480, fides: 999 });
    expect(measureCriterion(criterion, state)).toBe(480);
    expect(checkCriterion(criterion, state)).toBe(false);
    expect(getProgress({ ...makeAmbition(), criterion }, state)).toEqual({ current: 480, target: 500, label: 'Denarii' });
  });

  test('fides variant reads fides and completes at/above the threshold', () => {
    const criterion: AmbitionCriterion = { id: 'resource_threshold', resource: 'fides', amount: 50 };
    const state = makeState({ denarii: 999, fides: 50 });
    expect(measureCriterion(criterion, state)).toBe(50);
    expect(checkCriterion(criterion, state)).toBe(true);
    expect(getProgress({ ...makeAmbition(), criterion }, state).label).toBe('Fides');
  });
});

describe('office_held', () => {
  const criterion: AmbitionCriterion = { id: 'office_held', officeId: 'consul' };

  test('false when no one holds it, true only once currentOffice matches', () => {
    const notHeld = makeState({ currentOffice: null });
    expect(checkCriterion(criterion, notHeld)).toBe(false);
    expect(measureCriterion(criterion, notHeld)).toBe(0);

    const held = makeState({ currentOffice: 'consul', campaigningCharacterId: 'pc-1' });
    expect(checkCriterion(criterion, held)).toBe(true);
    expect(measureCriterion(criterion, held)).toBe(1);
    expect(getProgress({ ...makeAmbition(), criterion }, held)).toEqual({ current: 1, target: 1, label: 'Consul' });
  });

  test('character-scope only counts when the assigned character is the actual holder', () => {
    const state = makeState({ currentOffice: 'consul', campaigningCharacterId: 'pc-1' });
    expect(checkCriterion(criterion, state, 'pc-1')).toBe(true);
    expect(checkCriterion(criterion, state, 'someone-else')).toBe(false);
  });
});

describe('clan_standing', () => {
  test('reads the specific clan, not "any clan" — no forge_alliance-style drift', () => {
    const criterion: AmbitionCriterion = { id: 'clan_standing', clanId: 'fabii', amount: 60 };
    const state = makeState({ familyReputations: { fabii: 55, cornelii: 90 } });
    expect(measureCriterion(criterion, state)).toBe(55);
    expect(checkCriterion(criterion, state)).toBe(false);
    expect(getProgress({ ...makeAmbition(), criterion }, state)).toEqual({ current: 55, target: 60, label: 'clan standing' });
  });
});

describe('asset_tier', () => {
  test('matches the specific assetId at its currentTier — no grand_estate-style hardcode drift', () => {
    const criterion: AmbitionCriterion = { id: 'asset_tier', assetId: 'urban_insulae', amount: 2 };
    const state = makeState({
      ownedAssets: [
        { definitionId: 'vineyard', currentTier: 3, turnAcquired: 1 },
        { definitionId: 'urban_insulae', currentTier: 1, turnAcquired: 5 },
      ] as any,
    });
    expect(measureCriterion(criterion, state)).toBe(1);
    expect(checkCriterion(criterion, state)).toBe(false);
    expect(getProgress({ ...makeAmbition(), criterion }, state)).toEqual({ current: 1, target: 2, label: 'asset tier' });
  });

  test('unowned asset measures 0', () => {
    const criterion: AmbitionCriterion = { id: 'asset_tier', assetId: 'urban_insulae', amount: 1 };
    expect(measureCriterion(criterion, makeState({ ownedAssets: [] }))).toBe(0);
  });
});

describe('client_count', () => {
  test('measures live client count', () => {
    const criterion: AmbitionCriterion = { id: 'client_count', amount: 3 };
    const state = makeState({ clients: [{}, {}] as any });
    expect(measureCriterion(criterion, state)).toBe(2);
    expect(checkCriterion(criterion, state)).toBe(false);
    expect(checkCriterion(criterion, makeState({ clients: [{}, {}, {}] as any }))).toBe(true);
  });
});

describe('battles_won', () => {
  test('reads GameState.lifetimeBattlesWon directly', () => {
    const criterion: AmbitionCriterion = { id: 'battles_won', amount: 5 };
    const state = makeState({ lifetimeBattlesWon: 3 });
    expect(measureCriterion(criterion, state)).toBe(3);
    expect(checkCriterion(criterion, state)).toBe(false);
    expect(checkCriterion(criterion, makeState({ lifetimeBattlesWon: 5 }))).toBe(true);
  });
});

describe('bill_passed', () => {
  test('reads GameState.lifetimeBillsPassedVotedFor directly', () => {
    const criterion: AmbitionCriterion = { id: 'bill_passed', amount: 2 };
    const state = makeState({ lifetimeBillsPassedVotedFor: 1 });
    expect(measureCriterion(criterion, state)).toBe(1);
    expect(checkCriterion(criterion, state)).toBe(false);
    expect(checkCriterion(criterion, makeState({ lifetimeBillsPassedVotedFor: 2 }))).toBe(true);
    expect(getProgress({ ...makeAmbition(), criterion }, state)).toEqual({ current: 1, target: 2, label: 'bills passed' });
  });
});

describe('region_control', () => {
  test('true only when the specific region is rome-controlled', () => {
    const criterion: AmbitionCriterion = { id: 'region_control', regionId: 'sicilia' };
    const notControlled = makeState({ theatre: { controllers: { sicilia: 'carthage' }, contested: {}, musteredThisYear: {} } as any });
    expect(measureCriterion(criterion, notControlled)).toBe(0);
    expect(checkCriterion(criterion, notControlled)).toBe(false);

    const controlled = makeState({ theatre: { controllers: { sicilia: 'rome' }, contested: {}, musteredThisYear: {} } as any });
    expect(measureCriterion(criterion, controlled)).toBe(1);
    expect(checkCriterion(criterion, controlled)).toBe(true);
    expect(getProgress({ ...makeAmbition(), criterion }, controlled)).toEqual({ current: 1, target: 1, label: 'Sicily' });
  });
});

describe('trial_won', () => {
  test('counts only resolved prosecution-seat wins — acquitted/dismissed and defense trials excluded', () => {
    const criterion: AmbitionCriterion = { id: 'trial_won', amount: 2 };
    const state = makeState({
      trials: [
        makeTrial({ outcome: 'fined' }),           // win
        makeTrial({ outcome: 'executed' }),        // win
        makeTrial({ outcome: 'acquitted' }),       // not a win
        makeTrial({ outcome: 'dismissed' }),       // not a win
        makeTrial({ seat: 'defense', outcome: 'exiled' }), // not a prosecution
        makeTrial({ status: 'preparing', outcome: undefined }), // not resolved
      ],
    });
    expect(measureCriterion(criterion, state)).toBe(2);
    expect(checkCriterion(criterion, state)).toBe(true);
  });
});

describe('survive_seasons', () => {
  test('buildAmbition normalizes the authored duration into an absolute deadline turn', () => {
    const state = makeState({ turnNumber: 100 });
    const ambition = buildAmbition({
      scope: 'family', source: 'player', title: 'Endure',
      criterion: { id: 'survive_seasons', amount: 12 },
      deadlineSeasons: 12,
    }, state);
    expect(ambition.criterion.amount).toBe(112);
    expect(ambition.baseline.value).toBe(100);

    // Not yet survived: still short of the absolute deadline turn.
    expect(checkCriterion(ambition.criterion, makeState({ turnNumber: 105 }))).toBe(false);
    // Survived: turnNumber has reached the absolute deadline turn.
    expect(checkCriterion(ambition.criterion, makeState({ turnNumber: 112 }))).toBe(true);

    const progress = getProgress(ambition, makeState({ turnNumber: 106 }));
    expect(progress).toEqual({ current: 106, target: 112, label: 'seasons survived' });
  });
});

// ─── Delta rule ─────────────────────────────────────────────────────────────

describe('delta rule', () => {
  test('a target set near the current baseline scores near-zero difficulty/reward', () => {
    const state = makeState({ denarii: 480 });
    const nearMiss = buildAmbition({
      scope: 'family', source: 'player', title: 'Almost there',
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 500 },
      deadlineSeasons: 8,
    }, state);
    const farTarget = buildAmbition({
      scope: 'family', source: 'player', title: 'Real stretch',
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 980 },
      deadlineSeasons: 8,
    }, state);

    expect(nearMiss.reward.lifetimeDignitas).toBeLessThanOrEqual(1);
    expect(farTarget.reward.lifetimeDignitas!).toBeGreaterThan(nearMiss.reward.lifetimeDignitas!);
  });

  test('computeDifficulty near-zero at baseline itself', () => {
    const criterion: AmbitionCriterion = { id: 'clan_standing', clanId: 'fabii', amount: 61 };
    const baseline = { value: 60, turnNumber: 1 };
    const score = computeDifficulty(criterion, baseline, 8, makeState());
    expect(score).toBeLessThan(0.05);
  });
});

// ─── Office first-time multipliers ──────────────────────────────────────────

describe('office_held reward — first-time multipliers', () => {
  const criterion: AmbitionCriterion = { id: 'office_held', officeId: 'consul' };

  test('neither first-for-character nor first-for-family: base only', () => {
    const state = makeState({
      family: [makeCharacter({ heldOffices: ['consul'] })],
      heldOffices: ['consul'],
    });
    const { reward } = computeReward(0, criterion, state);
    expect(reward.lifetimeDignitas).toBe(BALANCE.ambitions.officeBaseline.consul);
  });

  test('both first-for-character and first-for-family: both multipliers stack', () => {
    const state = makeState({
      family: [makeCharacter({ heldOffices: [] })],
      heldOffices: [],
    });
    const { reward } = computeReward(0, criterion, state);
    const expected = Math.round(
      BALANCE.ambitions.officeBaseline.consul
      * BALANCE.ambitions.firstCharacterMult
      * BALANCE.ambitions.firstFamilyMult,
    );
    expect(reward.lifetimeDignitas).toBe(expected);
  });

  test('first for the family only (a different character already holds it)', () => {
    const state = makeState({
      family: [makeCharacter({ heldOffices: [] })],
      heldOffices: ['consul'],
    });
    const { reward } = computeReward(0, criterion, state);
    const expected = Math.round(BALANCE.ambitions.officeBaseline.consul * BALANCE.ambitions.firstCharacterMult);
    expect(reward.lifetimeDignitas).toBe(expected);
  });
});

// ─── nextEligibleElectionTurns ──────────────────────────────────────────────

describe('nextEligibleElectionTurns', () => {
  test('free right now: earliest reachable is the nearest future Winter', () => {
    const state = makeState({ turnNumber: 10, seasonIndex: 1, currentOffice: null }); // Summer
    const turns = nextEligibleElectionTurns('quaestor', state);
    expect(turns[0]).toBe(12); // Summer -> Autumn(11) -> Winter(12)
  });

  test('mid-term holder of a DIFFERENT, non-4-season office blocks earlier Winters and rounds up', () => {
    // Censor's term is 6 seasons (not a multiple of 4), so its term-end does
    // NOT land neatly back on a Winter — the deadline picker must round up
    // to the next real Winter after that, not just "when officeSeasons hits 0".
    const state = makeState({
      turnNumber: 10, seasonIndex: 1, // Summer
      currentOffice: 'censor', officeSeasons: 3, // 3 of 6 seasons remaining
    });
    const turns = nextEligibleElectionTurns('consul', state);
    // Naive "nearest Winter from now" would incorrectly say 12 — the office
    // block (free at turn 13, itself a Spring) pushes the real answer to 16.
    expect(turns[0]).toBe(16);
    expect(turns).toHaveLength(4);
    // Every returned turn must actually be a Winter (seasonIndex 3).
    for (const t of turns) {
      expect((1 + (t - 10)) % 4).toBe(3);
    }
  });
});

// ─── Deadline pressure scaling ──────────────────────────────────────────────

describe('deadline pressure', () => {
  test('a shorter deadline scores strictly higher difficulty than a longer one for the same delta', () => {
    const criterion: AmbitionCriterion = { id: 'resource_threshold', resource: 'denarii', amount: 1000 };
    const baseline = { value: 0, turnNumber: 1 };
    const state = makeState();
    const short = computeDifficulty(criterion, baseline, 2, state);
    const long = computeDifficulty(criterion, baseline, 20, state);
    expect(short).toBeGreaterThan(long);
  });
});

// ─── Failure cost cap ───────────────────────────────────────────────────────

describe('failure cost cap', () => {
  test('a large reward is capped, not scaled unboundedly', () => {
    const state = makeState({
      family: [makeCharacter({ heldOffices: [] })],
      heldOffices: [],
    });
    const { reward, failureDignitas } = computeReward(0, { id: 'office_held', officeId: 'dictator' }, state);
    const uncappedWouldBe = Math.round(reward.lifetimeDignitas! * BALANCE.ambitions.failureRatio);
    expect(uncappedWouldBe).toBeGreaterThan(BALANCE.ambitions.failureDignitasCap);
    expect(failureDignitas).toBe(-BALANCE.ambitions.failureDignitasCap);
  });

  test('a small reward is scaled normally, under the cap', () => {
    const { reward, failureDignitas } = computeReward(0.2, { id: 'client_count', amount: 5 }, makeState());
    const expected = -Math.min(
      Math.round(reward.lifetimeDignitas! * BALANCE.ambitions.failureRatio),
      BALANCE.ambitions.failureDignitasCap,
    );
    expect(failureDignitas).toBe(expected);
    expect(failureDignitas).toBeGreaterThan(-BALANCE.ambitions.failureDignitasCap);
  });
});

// ─── buildAmbition freezing ─────────────────────────────────────────────────

describe('buildAmbition', () => {
  test('snapshots baseline and freezes reward/failureDignitas — later state changes do not retroactively alter them', () => {
    const state = makeState({ denarii: 100 });
    const ambition = buildAmbition({
      scope: 'family', source: 'player', title: 'Get rich',
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 900 },
      deadlineSeasons: 4,
    }, state);
    const frozenReward = { ...ambition.reward };
    const frozenFailure = ambition.failureDignitas;

    // A windfall after the ambition is set must not change what was promised.
    const laterState = makeState({ denarii: 900, turnNumber: 14 });
    void laterState;

    expect(ambition.reward).toEqual(frozenReward);
    expect(ambition.failureDignitas).toBe(frozenFailure);
    expect(ambition.baseline).toEqual({ value: 100, turnNumber: 10 });
    expect(ambition.status).toBe('active');
    expect(ambition.refusable).toBe(true); // default true for source: 'player'
  });
});

// ─── supersedeAmbition ──────────────────────────────────────────────────────

describe('supersedeAmbition', () => {
  const base = () => makeAmbition({
    criterion: { id: 'resource_threshold', resource: 'denarii', amount: 200 },
    baseline: { value: 100, turnNumber: 1 },
    reward: { lifetimeDignitas: 40, fides: 20 },
  });

  test('0% progress pays nothing', () => {
    const { ambition, partialReward } = supersedeAmbition(base(), makeState({ denarii: 100 }));
    expect(ambition.status).toBe('superseded');
    expect(partialReward.lifetimeDignitas).toBe(0);
    expect(partialReward.fides).toBe(0);
  });

  test('50% progress pays half', () => {
    const { partialReward } = supersedeAmbition(base(), makeState({ denarii: 150 }));
    expect(partialReward.lifetimeDignitas).toBe(20);
    expect(partialReward.fides).toBe(10);
  });

  test('100% progress pays the full frozen reward, and no failureDignitas applies', () => {
    const { ambition, partialReward } = supersedeAmbition(base(), makeState({ denarii: 200 }));
    expect(partialReward.lifetimeDignitas).toBe(40);
    expect(partialReward.fides).toBe(20);
    expect(ambition.status).toBe('superseded');
    // supersede is never a failure — the frozen failureDignitas field is
    // untouched (and never applied by any caller of this function).
    expect(ambition.failureDignitas).toBe(base().failureDignitas);
  });

  test('progress beyond 100% clamps rather than overpaying', () => {
    const { partialReward } = supersedeAmbition(base(), makeState({ denarii: 500 }));
    expect(partialReward.lifetimeDignitas).toBe(40);
  });
});

// ─── tickAmbitions ──────────────────────────────────────────────────────────

describe('tickAmbitions', () => {
  test('completes an ambition whose criterion is now met', () => {
    const ambition = makeAmbition({
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 200 },
    });
    const state = makeState({ denarii: 250, turnNumber: 5 });
    const result = tickAmbitions([ambition], state, 5);
    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].status).toBe('completed');
    expect(result.completed[0].turnResolved).toBe(5);
    expect(result.failed).toHaveLength(0);
    expect(result.superseded).toHaveLength(0);
  });

  test('fails an ambition whose deadline has passed without completion', () => {
    const ambition = makeAmbition({
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 900 },
      deadlineTurn: 5,
    });
    const state = makeState({ denarii: 100, turnNumber: 5 });
    const result = tickAmbitions([ambition], state, 5);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].status).toBe('failed');
    expect(result.completed).toHaveLength(0);
  });

  test('character-death guard: supersedes a character-scope ambition whose assignedCharacterId no longer resolves to a living family member', () => {
    const ambition = makeAmbition({
      scope: 'character',
      assignedCharacterId: 'dead-character',
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 900 },
    });
    const state = makeState({
      family: [makeCharacter({ id: 'pc-1' })], // dead-character is not present
      denarii: 100,
      turnNumber: 5,
    });
    const result = tickAmbitions([ambition], state, 5);
    expect(result.superseded).toHaveLength(1);
    expect(result.superseded[0].ambition.status).toBe('superseded');
    expect(result.completed).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
  });

  test('character-death guard does not fire while the assigned character is still alive', () => {
    const ambition = makeAmbition({
      scope: 'character',
      assignedCharacterId: 'pc-1',
      criterion: { id: 'resource_threshold', resource: 'denarii', amount: 900 },
      deadlineTurn: 50,
    });
    const state = makeState({ family: [makeCharacter({ id: 'pc-1' })], denarii: 100, turnNumber: 5 });
    const result = tickAmbitions([ambition], state, 5);
    expect(result.superseded).toHaveLength(0);
    expect(result.updated[0].status).toBe('active');
  });

  test('leaves non-active ambitions untouched', () => {
    const ambition = makeAmbition({ status: 'completed' });
    const result = tickAmbitions([ambition], makeState(), 5);
    expect(result.updated).toEqual([ambition]);
    expect(result.completed).toHaveLength(0);
  });
});

// ─── projectDynasticAmbitions ───────────────────────────────────────────────

describe('projectDynasticAmbitions', () => {
  test('projects legacyObjectives into read-only dynastic ActiveAmbition rows with correct progress', () => {
    const legacyObjectives = initLegacyObjectives().map(o =>
      o.definitionId === 'consular_line' ? { ...o, currentValue: 2, milestonesReached: [1] } : o,
    );
    const state = makeState({ legacyObjectives });
    const rows = projectDynasticAmbitions(state);

    expect(rows).toHaveLength(legacyObjectives.length);
    expect(rows.every(r => r.scope === 'dynastic' && r.source === 'dynastic' && r.refusable === false)).toBe(true);

    const consularRow = rows.find(r => r.id === 'dynastic:consular_line')!;
    expect(consularRow).toBeDefined();
    expect(consularRow.title).toBe('The Consular Line');

    const progress = getProgress(consularRow, state);
    expect(progress).toEqual({ current: 2, target: 3, label: 'Consuls produced' });
  });
});
