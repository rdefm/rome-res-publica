import {
  gatherChance,
  attemptGather,
  npcGatherTick,
  generateSecret,
  generateLatentSecret,
  latentSecretDiscoveryTick,
  isDeterred,
  computeLeverageBillSupportDelta,
  extortSeasonTick,
  computeExtortionDrain,
  computeBurnVoteLoss,
  payOffCost,
  discreditChance,
  attemptDiscredit,
  mapSecretTypeToTrialCharge,
  npcSecretDecision,
  scanNpcSecretDecisions,
  resolveSecretDemand,
  resolveClaudiusDefiance,
} from '../src/engine/secretEngine';
import { CLAUDIUS_ARC_SECRET_ID, CLAUDIUS_LEADER_ID, CLAUDIUS_CLAN_ID } from '../src/data/claudiusArc';
import { BALANCE } from '../src/data/balance';
import type { Character } from '../src/models/character';
import type { Clan, ClanLeader } from '../src/models/clan';
import type { GameState } from '../src/state/gameStore';
import type { Secret, LatentSecret } from '../src/models/secret';
import type { TrialState } from '../src/models/trial';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'pc-1', name: 'Marcus', role: 'paterfamilias', isPlayer: true, age: 44,
    skills: { rhetoric: 6, martial: 4, intrigus: 5 },
    traits: [], ambition: null, relationship: 100, familyTrust: 100,
    officeId: null, heldOffices: [], corruptionScore: 0, inheritedTraits: [],
    ambitionIds: [], reputationScores: {},
    formalImperium: 0, militaryImperium: 0, raisedLegions: [], veterans: [],
    ...overrides,
  };
}

/** An adult, non-player family member — npcGatherTick's only valid target
 *  pool as of the player-agency fix (the player is never a target). */
function makeKin(overrides: Partial<Character> = {}): Character {
  return makeCharacter({ id: 'kin-1', name: 'Kin', isPlayer: false, ...overrides });
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
    turnNumber: 10,
    family: [makeCharacter()],
    clans: [makeClan()],
    secrets: [] as Secret[],
    ...overrides,
  };
  return base as unknown as GameState;
}

/** A canned rng sequence for deterministic type/potency/flavor picks. */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

// ─── gatherChance ──────────────────────────────────────────────────────────

describe('gatherChance', () => {
  test('scales with intrigus and groundwork, and clamps to the cap', () => {
    const { gatherBaseChance, gatherPerIntrigus, gatherChanceCap } = BALANCE.secrets;
    expect(gatherChance(0, 0)).toBeCloseTo(gatherBaseChance);
    expect(gatherChance(4, 0)).toBeCloseTo(gatherBaseChance + 4 * gatherPerIntrigus);
    expect(gatherChance(0, 0.2)).toBeCloseTo(gatherBaseChance + 0.2);
    expect(gatherChance(10, 0.3)).toBe(gatherChanceCap); // way over — clamped
  });
});

// ─── generateSecret ────────────────────────────────────────────────────────

describe('generateSecret', () => {
  test('interpolates {subject} with the given name', () => {
    const rng = seqRng([0, 0, 0]); // first eligible type, potency 1, first template
    const secret = generateSecret(
      { kind: 'leader', leaderId: 'leader-1' }, 'player', 'L. Testius', 10, false, rng
    );
    expect(secret.flavorText).not.toContain('{subject}');
    expect(secret.flavorText).toContain('L. Testius');
    expect(secret.subject).toEqual({ kind: 'leader', leaderId: 'leader-1' });
    expect(secret.holder).toBe('player');
    expect(secret.status).toBe('held');
  });

  test('provincial_plunder never generates when officeHistoryEligible is false', () => {
    // Sweep the type-selection roll across its whole range — none of the
    // resulting draws should ever be provincial_plunder when ineligible.
    for (let r = 0; r < 1; r += 0.05) {
      const rng = seqRng([r, 0, 0]);
      const secret = generateSecret(
        { kind: 'family', characterId: 'pc-1' }, 'leader-1', 'Marcus', 10, false, rng
      );
      expect(secret.type).not.toBe('provincial_plunder');
    }
  });

  test('provincial_plunder can generate when officeHistoryEligible is true', () => {
    // With 5 equally-weighted eligible types, roll 0.9 should land on the
    // last (provincial_plunder, alphabetically last in SECRET_TYPES order —
    // verified indirectly: it's reachable at all when eligible).
    let sawPlunder = false;
    for (let r = 0; r < 1; r += 0.05) {
      const rng = seqRng([r, 0, 0]);
      const secret = generateSecret(
        { kind: 'leader', leaderId: 'leader-1' }, 'player', 'L. Testius', 10, true, rng
      );
      if (secret.type === 'provincial_plunder') sawPlunder = true;
    }
    expect(sawPlunder).toBe(true);
  });

  test('typePool option restricts the draw (Audit a Rival)', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const rng = seqRng([r, 0, 0]);
      const secret = generateSecret(
        { kind: 'leader', leaderId: 'leader-1' }, 'player', 'L. Testius', 10, true, rng,
        { typePool: ['embezzlement', 'electoral_fraud'], maxPotency: 2 }
      );
      expect(['embezzlement', 'electoral_fraud']).toContain(secret.type);
      expect(secret.potency).toBeLessThanOrEqual(2);
    }
  });

  test('maxPotency option caps the potency draw', () => {
    for (let r = 0; r < 1; r += 0.05) {
      const rng = seqRng([0, r, 0]);
      const secret = generateSecret(
        { kind: 'leader', leaderId: 'leader-1' }, 'player', 'L. Testius', 10, true, rng,
        { maxPotency: 1 }
      );
      expect(secret.potency).toBe(1);
    }
  });

  test('traitBias heavily favors the trait-matched type over the uniform pool', () => {
    // aggressive -> violence (secretDefinitions.ts's TRAIT_TYPE_BIAS). Sweep
    // the whole roll range with the bias applied — violence should dominate
    // far past its 1-in-5 uniform share.
    let violenceCount = 0;
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const r = i / steps;
      const rng = seqRng([r, 0, 0]);
      const secret = generateSecret(
        { kind: 'family', characterId: 'kin-1' }, 'leader-1', 'Kin', 10, false, rng,
        { traitBias: ['aggressive'] }
      );
      if (secret.type === 'violence') violenceCount++;
    }
    // 5 eligible types, violence weighted 3x vs 1x for the rest -> 3/7 ≈ 43%
    // of the draw, vs. a ~20% uniform baseline — a clear, deliberate lean.
    expect(violenceCount).toBeGreaterThan(steps * 0.35);
  });

  test('traitBias with no matching type falls back to the exact uniform draw', () => {
    // No trait maps to a type outside the pool -> byte-for-byte identical to
    // calling with no traitBias at all (same single rng() call for type).
    const rng1 = seqRng([0.5, 0, 0]);
    const rng2 = seqRng([0.5, 0, 0]);
    const withoutBias = generateSecret(
      { kind: 'leader', leaderId: 'leader-1' }, 'player', 'L. Testius', 10, true, rng1
    );
    const withUnmatchedBias = generateSecret(
      { kind: 'leader', leaderId: 'leader-1' }, 'player', 'L. Testius', 10, true, rng2,
      { traitBias: [] }
    );
    expect(withUnmatchedBias.type).toBe(withoutBias.type);
  });
});

// ─── attemptGather ─────────────────────────────────────────────────────────

describe('attemptGather', () => {
  test('success: roll under chance yields a Secret and resets groundwork to 0', () => {
    const agent = makeCharacter({ id: 'agent-1', skills: { rhetoric: 0, martial: 0, intrigus: 5 } });
    const leader = makeLeader({ id: 'leader-1', intelGroundwork: 0.1 });
    const state = makeState({ family: [agent], clans: [makeClan({ leaders: [leader] })] });

    const chance = gatherChance(5, 0.1);
    const result = attemptGather(state, 'leader-1', 'agent-1', chance - 0.001);

    expect(result.success).toBe(true);
    expect(result.secret).not.toBeNull();
    expect(result.secret!.subject).toEqual({ kind: 'leader', leaderId: 'leader-1' });
    expect(result.secret!.holder).toBe('player');
    expect(result.groundwork).toBe(0);
  });

  test('failure: roll at/over chance yields no Secret and raises groundwork (capped)', () => {
    const agent = makeCharacter({ id: 'agent-1', skills: { rhetoric: 0, martial: 0, intrigus: 5 } });
    const leader = makeLeader({ id: 'leader-1', intelGroundwork: BALANCE.secrets.groundworkCap - 0.02 });
    const state = makeState({ family: [agent], clans: [makeClan({ leaders: [leader] })] });

    const chance = gatherChance(5, BALANCE.secrets.groundworkCap - 0.02);
    const result = attemptGather(state, 'leader-1', 'agent-1', chance);

    expect(result.success).toBe(false);
    expect(result.secret).toBeNull();
    expect(result.groundwork).toBeCloseTo(BALANCE.secrets.groundworkCap); // capped, not overshooting
  });

  test('groundwork accumulates deterministically across repeated failures', () => {
    const agent = makeCharacter({ id: 'agent-1', skills: { rhetoric: 0, martial: 0, intrigus: 0 } });
    let leader = makeLeader({ id: 'leader-1', intelGroundwork: 0 });
    for (let i = 0; i < 3; i++) {
      const state = makeState({ family: [agent], clans: [makeClan({ leaders: [leader] })] });
      const result = attemptGather(state, 'leader-1', 'agent-1', 0.999); // always fails
      expect(result.success).toBe(false);
      leader = { ...leader, intelGroundwork: result.groundwork };
    }
    expect(leader.intelGroundwork).toBeCloseTo(3 * BALANCE.secrets.groundworkPerFailure);
  });

  test('unknown leader or agent id is a safe no-op', () => {
    const state = makeState();
    const result = attemptGather(state, 'nope', 'nope', 0);
    expect(result.success).toBe(false);
    expect(result.secret).toBeNull();
  });
});

// ─── npcGatherTick ─────────────────────────────────────────────────────────

describe('npcGatherTick', () => {
  test('only leaders below hostileStandingMax roll', () => {
    const friendly = makeLeader({ id: 'friendly', relationship: 80 });
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({
      family: [makeCharacter(), makeKin()],
      clans: [makeClan({ leaders: [friendly, hostile] })],
    });

    // rng always succeeds when called — only 'hostile' should ever roll.
    const result = npcGatherTick(state, () => 0);
    expect(result.secrets.length).toBe(1);
    expect(result.secrets[0].holder).toBe('hostile');
    expect(result.secrets[0].subject.kind).toBe('family');
    expect(result.secrets[0].discovered).toBe(false);
  });

  test('never targets the player, even when the player holds the family\'s only corruption', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({
      family: [makeCharacter({ corruptionScore: 100 }), makeKin({ corruptionScore: 0 })],
      clans: [makeClan({ leaders: [hostile] })],
    });

    const result = npcGatherTick(state, () => 0);
    expect(result.secrets.length).toBe(1);
    expect(result.secrets[0].subject).toEqual({ kind: 'family', characterId: 'kin-1' });
  });

  test('a family with only the player is a safe no-op (the actual player-agency fix)', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({
      family: [makeCharacter({ corruptionScore: 100 })],
      clans: [makeClan({ leaders: [hostile] })],
    });
    expect(npcGatherTick(state, () => 0).secrets).toEqual([]);
  });

  test('minors are not eligible targets', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({
      family: [makeCharacter(), makeKin({ age: BALANCE.succession.regencyMinorAge - 1 })],
      clans: [makeClan({ leaders: [hostile] })],
    });
    expect(npcGatherTick(state, () => 0).secrets).toEqual([]);
  });

  test('target selection is weighted toward aggressive/ambitious kin over content/cautious kin', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const reckless = makeKin({ id: 'reckless', traits: ['aggressive'] });
    const meek = makeKin({ id: 'meek', traits: ['content'] });

    let recklessCount = 0;
    const trials = 200;
    for (let i = 0; i < trials; i++) {
      const roll = i / trials;
      // rng is called for target selection, then per-leader chance, then
      // generateSecret's internals — vary only the first call (target pick)
      // deterministically, keep the rest at 0 so the leader always rolls a hit.
      let call = 0;
      const rng = () => (call++ === 0 ? roll : 0);
      const state = makeState({
        family: [makeCharacter(), reckless, meek],
        clans: [makeClan({ leaders: [hostile] })],
      });
      const result = npcGatherTick(state, rng);
      if (result.secrets[0]?.subject.kind === 'family' && result.secrets[0].subject.characterId === 'reckless') {
        recklessCount++;
      }
    }
    // Equal-weight baseline would be ~50%; aggressive's 1.6x weight vs
    // content's 0.7x should skew well above that.
    expect(recklessCount).toBeGreaterThan(trials * 0.6);
  });

  test('corruption scales chance up to the cap', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const cleanFamily = makeState({
      family: [makeCharacter({ corruptionScore: 0 }), makeKin()],
      clans: [makeClan({ leaders: [hostile] })],
    });
    const corruptFamily = makeState({
      family: [makeCharacter({ corruptionScore: 100 }), makeKin()],
      clans: [makeClan({ leaders: [makeLeader({ id: 'hostile', relationship: 10 }) ] })],
    });

    // Roll pinned just above the clean-family chance but below the capped
    // corrupt-family chance — clean family should never generate, corrupt should.
    // The player's own corruption is still "the fuel" for the roll even
    // though the player can never be the target (see the test above).
    const cleanChance = BALANCE.secrets.npcGatherBase;
    const roll = cleanChance + 0.001;
    const constRng = () => roll;
    expect(npcGatherTick(cleanFamily, constRng).secrets.length).toBe(0);
    expect(npcGatherTick(corruptFamily, constRng).secrets.length).toBe(1);
  });

  test('familyGroundwork resets to 0 on success and accumulates on failure', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10, familyGroundwork: 0.05 });
    const state = makeState({ family: [makeCharacter(), makeKin()], clans: [makeClan({ leaders: [hostile] })] });

    const success = npcGatherTick(state, () => 0);
    expect(success.clans[0].leaders[0].familyGroundwork).toBe(0);

    const failure = npcGatherTick(state, () => 0.999);
    expect(failure.clans[0].leaders[0].familyGroundwork).toBeCloseTo(0.05 + BALANCE.secrets.groundworkPerFailure);
  });

  test('respects maxHeldAgainstFamily per leader', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const existing: Secret[] = Array.from({ length: BALANCE.secrets.maxHeldAgainstFamily }, (_, i) => ({
      id: `s${i}`, type: 'affair', subject: { kind: 'family', characterId: 'kin-1' },
      holder: 'hostile', potency: 1, status: 'held', acquiredSeason: 1, flavorText: '',
    }));
    const state = makeState({
      family: [makeCharacter(), makeKin()],
      clans: [makeClan({ leaders: [hostile] })],
      secrets: existing,
    });
    expect(npcGatherTick(state, () => 0).secrets.length).toBe(0);
  });

  test('missing state.secrets defaults gracefully (pre-P4-A save)', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({ family: [makeCharacter(), makeKin()], clans: [makeClan({ leaders: [hostile] })] });
    delete (state as any).secrets;
    expect(() => npcGatherTick(state, () => 0)).not.toThrow();
  });

  test('empty family is a safe no-op', () => {
    const state = makeState({ family: [] });
    expect(npcGatherTick(state, () => 0).secrets).toEqual([]);
  });
});

// ─── Player-choice blackmail: generateLatentSecret / latentSecretDiscoveryTick ─

describe('generateLatentSecret', () => {
  test('interpolates {subject} with the given name and carries the given type/potency', () => {
    const latent = generateLatentSecret('pc-1', 'Marcus', 'electoral_fraud', 2, 10, seqRng([0]));
    expect(latent.flavorText).not.toContain('{subject}');
    expect(latent.flavorText).toContain('Marcus');
    expect(latent.type).toBe('electoral_fraud');
    expect(latent.characterId).toBe('pc-1');
    expect(latent.potency).toBe(2);
    expect(latent.createdSeason).toBe(10);
  });
});

describe('latentSecretDiscoveryTick', () => {
  function makeLatent(overrides: Partial<LatentSecret> = {}): LatentSecret {
    return {
      id: 'latent-1', type: 'embezzlement', characterId: 'pc-1',
      flavorText: 'A discrepancy in the ledgers.', createdSeason: 5, potency: 2,
      ...overrides,
    };
  }

  test('converts into a real, held-but-undiscovered Secret on a hit roll', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10, skills: { rhetoric: 5, martial: 5, intrigus: 5 } });
    const state = makeState({
      clans: [makeClan({ leaders: [hostile] })],
      latentSecrets: [makeLatent()],
    });

    const result = latentSecretDiscoveryTick(state, () => 0); // always under latentDiscoveryChance
    expect(result.secrets.length).toBe(1);
    expect(result.secrets[0].holder).toBe('hostile');
    expect(result.secrets[0].subject).toEqual({ kind: 'family', characterId: 'pc-1' });
    expect(result.secrets[0].status).toBe('held');
    expect(result.secrets[0].discovered).toBe(false);
    expect(result.secrets[0].potency).toBe(2);
    expect(result.removedLatentIds).toEqual(['latent-1']);
  });

  test('no-op on a miss roll', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({
      clans: [makeClan({ leaders: [hostile] })],
      latentSecrets: [makeLatent()],
    });

    const result = latentSecretDiscoveryTick(state, () => 0.999); // always over latentDiscoveryChance
    expect(result.secrets).toEqual([]);
    expect(result.removedLatentIds).toEqual([]);
  });

  test('respects hostileStandingMax — a friendly leader never discovers it', () => {
    const friendly = makeLeader({ id: 'friendly', relationship: 80 });
    const state = makeState({
      clans: [makeClan({ leaders: [friendly] })],
      latentSecrets: [makeLatent()],
    });

    const result = latentSecretDiscoveryTick(state, () => 0);
    expect(result.secrets).toEqual([]);
    expect(result.removedLatentIds).toEqual([]);
  });

  test('respects maxHeldAgainstFamily against that character', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const existing: Secret[] = Array.from({ length: BALANCE.secrets.maxHeldAgainstFamily }, (_, i) => ({
      id: `s${i}`, type: 'affair', subject: { kind: 'family', characterId: 'pc-1' },
      holder: 'hostile', potency: 1, status: 'held', acquiredSeason: 1, flavorText: '',
    }));
    const state = makeState({
      clans: [makeClan({ leaders: [hostile] })],
      secrets: existing,
      latentSecrets: [makeLatent()],
    });

    const result = latentSecretDiscoveryTick(state, () => 0);
    expect(result.secrets).toEqual([]);
    expect(result.removedLatentIds).toEqual([]);
  });

  test('missing state.latentSecrets defaults gracefully', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({ clans: [makeClan({ leaders: [hostile] })] });
    expect(() => latentSecretDiscoveryTick(state, () => 0)).not.toThrow();
    expect(latentSecretDiscoveryTick(state, () => 0).secrets).toEqual([]);
  });
});

// ─── Phase 4, Chunk P4-B ─────────────────────────────────────────────────────

function makeSecret(overrides: Partial<Secret> = {}): Secret {
  return {
    id: 'secret-1',
    type: 'embezzlement',
    subject: { kind: 'leader', leaderId: 'leader-1' },
    holder: 'player',
    potency: 2,
    status: 'held',
    acquiredSeason: 1,
    flavorText: 'A certain irregularity.',
    ...overrides,
  };
}

describe('isDeterred', () => {
  test('false with no mutual hold', () => {
    expect(isDeterred('leader-1', [])).toBe(false);
    expect(isDeterred('leader-1', [makeSecret({ holder: 'player', subject: { kind: 'leader', leaderId: 'leader-1' } })])).toBe(false);
  });

  test('true only when both directions hold', () => {
    const secrets = [
      makeSecret({ id: 's1', holder: 'player', subject: { kind: 'leader', leaderId: 'leader-1' } }),
      makeSecret({ id: 's2', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } }),
    ];
    expect(isDeterred('leader-1', secrets)).toBe(true);
  });

  test('spent/exposed/neutralized secrets do not count toward a standoff', () => {
    const secrets = [
      makeSecret({ id: 's1', holder: 'player', subject: { kind: 'leader', leaderId: 'leader-1' }, status: 'spent' }),
      makeSecret({ id: 's2', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } }),
    ];
    expect(isDeterred('leader-1', secrets)).toBe(false);
  });
});

describe('player verb math', () => {
  test('computeLeverageBillSupportDelta is signed by direction and scaled by votes', () => {
    expect(computeLeverageBillSupportDelta(10, 'for')).toBeCloseTo(10 * BALANCE.secrets.leverageBillSupportPerVote);
    expect(computeLeverageBillSupportDelta(10, 'against')).toBeCloseTo(-10 * BALANCE.secrets.leverageBillSupportPerVote);
  });

  test('extortSeasonTick: income and no exposure below the roll', () => {
    const secret = makeSecret({ potency: 3 });
    const result = extortSeasonTick(secret, BALANCE.secrets.extortExposureChance + 0.01);
    expect(result.income).toBe(BALANCE.secrets.extortIncomePerPotency * 3);
    expect(result.exposed).toBe(false);
    expect(result.newStatus).toBe('extorting');
    expect(result.relationshipDelta).toBe(0);
  });

  test('extortSeasonTick: exposure below the roll spends the secret and applies penalties', () => {
    const secret = makeSecret({ potency: 2 });
    const result = extortSeasonTick(secret, BALANCE.secrets.extortExposureChance - 0.01);
    expect(result.exposed).toBe(true);
    expect(result.newStatus).toBe('spent');
    expect(result.relationshipDelta).toBe(BALANCE.secrets.extortExposureRelationship);
    expect(result.retaliationGroundworkDelta).toBe(BALANCE.secrets.extortRetaliationGroundwork);
  });

  test('computeExtortionDrain scales with potency, no roll involved', () => {
    expect(computeExtortionDrain(makeSecret({ potency: 1 }))).toBe(BALANCE.secrets.extortIncomePerPotency);
    expect(computeExtortionDrain(makeSecret({ potency: 3 }))).toBe(BALANCE.secrets.extortIncomePerPotency * 3);
  });

  test('computeBurnVoteLoss rounds to the configured fraction', () => {
    expect(computeBurnVoteLoss(10)).toBe(Math.round(10 * BALANCE.secrets.burnVoteLossFraction));
  });
});

describe('counterplay math', () => {
  test('payOffCost scales with potency', () => {
    expect(payOffCost(1)).toBe(BALANCE.secrets.payOffCostPerPotency);
    expect(payOffCost(3)).toBe(BALANCE.secrets.payOffCostPerPotency * 3);
  });

  test('discreditChance scales with intrigus', () => {
    expect(discreditChance(0)).toBeCloseTo(BALANCE.secrets.discreditBase);
    expect(discreditChance(10)).toBeCloseTo(BALANCE.secrets.discreditBase + 10 * BALANCE.secrets.discreditPerIntrigus);
  });

  test('attemptDiscredit: success neutralizes at unchanged potency', () => {
    const secret = makeSecret({ potency: 2 });
    const chance = discreditChance(5);
    const result = attemptDiscredit(secret, 5, chance - 0.001);
    expect(result.success).toBe(true);
    expect(result.newPotency).toBe(2);
  });

  test('attemptDiscredit: failure raises potency, capped at 3', () => {
    const secret = makeSecret({ potency: 2 });
    const chance = discreditChance(5);
    const result = attemptDiscredit(secret, 5, chance);
    expect(result.success).toBe(false);
    expect(result.newPotency).toBe(3);

    const maxed = makeSecret({ potency: 3 });
    const failedAtMax = attemptDiscredit(maxed, 5, chance);
    expect(failedAtMax.newPotency).toBe(3);
  });
});

describe('mapSecretTypeToTrialCharge', () => {
  // Phase 4, Chunk P4-C — a clean 1:1 now (real ChargeIds exist); was a
  // fallback-to-'corruption' shim in P4-B before trialCharges.ts existed.
  test('each criminal SecretType maps to its own real ChargeId', () => {
    expect(mapSecretTypeToTrialCharge('electoral_fraud')).toBe('ambitus');
    expect(mapSecretTypeToTrialCharge('embezzlement')).toBe('peculatus');
    expect(mapSecretTypeToTrialCharge('provincial_plunder')).toBe('repetundae');
  });
});

describe('npcSecretDecision / scanNpcSecretDecisions', () => {
  test('null with no eligible secrets', () => {
    expect(npcSecretDecision(makeLeader(), 'testii', [], makeState())).toBeNull();
  });

  test('leverage_bill when a live bill matches the leader\'s bias', () => {
    const leader = makeLeader({ bias: 'optimates' });
    const state = makeState({ bills: [{ id: 'b1', name: 'Optimates Bill', desc: '', type: 'optimates' as const, support: 0, turnsLeft: 2, passEffect: '', failEffect: '' }] });
    const secret = makeSecret({ holder: leader.id, subject: { kind: 'family', characterId: 'pc-1' } });
    const decision = npcSecretDecision(leader, 'testii', [secret], state);
    expect(decision?.action).toBe('leverage_bill');
    expect(decision?.billId).toBe('b1');
    expect(decision?.direction).toBe('for');
  });

  test('leverage_election when the player is mid-campaign and unpledged', () => {
    const leader = makeLeader({ bias: 'optimates', id: 'leader-1' });
    const state = makeState({ bills: [], campaigning: 'aedile', campaignVotes: {} });
    const secret = makeSecret({ holder: leader.id, subject: { kind: 'family', characterId: 'pc-1' } });
    const decision = npcSecretDecision(leader, 'testii', [secret], state);
    expect(decision?.action).toBe('leverage_election');
  });

  test('burn only at/below npcBurnStandingMax with no leverage opportunity', () => {
    const leader = makeLeader({ bias: 'optimates', relationship: BALANCE.secrets.npcAi.npcBurnStandingMax });
    const state = makeState({ bills: [], campaigning: null });
    const secret = makeSecret({ holder: leader.id, subject: { kind: 'family', characterId: 'pc-1' } });
    const decision = npcSecretDecision(leader, 'testii', [secret], state);
    expect(decision?.action).toBe('burn');
  });

  test('extort as the default when standing is above the burn threshold and no leverage opportunity', () => {
    const leader = makeLeader({ bias: 'optimates', relationship: BALANCE.secrets.npcAi.npcBurnStandingMax + 20 });
    const state = makeState({ bills: [], campaigning: null });
    const secret = makeSecret({ holder: leader.id, subject: { kind: 'family', characterId: 'pc-1' } });
    const decision = npcSecretDecision(leader, 'testii', [secret], state);
    expect(decision?.action).toBe('extort');
  });

  test('plays the highest-potency eligible secret', () => {
    const leader = makeLeader({ bias: 'optimates', relationship: BALANCE.secrets.npcAi.npcBurnStandingMax + 20 });
    const state = makeState({ bills: [], campaigning: null });
    const low = makeSecret({ id: 'low', potency: 1, holder: leader.id, subject: { kind: 'family', characterId: 'pc-1' } });
    const high = makeSecret({ id: 'high', potency: 3, holder: leader.id, subject: { kind: 'family', characterId: 'pc-1' } });
    const decision = npcSecretDecision(leader, 'testii', [low, high], state);
    expect(decision?.secretId).toBe('high');
  });

  test('scanNpcSecretDecisions skips deterred leaders and cooldown-gated/undiscovered-turn secrets', () => {
    const leader = makeLeader({ id: 'leader-1', relationship: 10 });
    const deterringSecret = makeSecret({ id: 'counter', holder: 'player', subject: { kind: 'leader', leaderId: 'leader-1' } });
    const heldSecret = makeSecret({ id: 'held', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' }, acquiredSeason: 5 });
    const state = makeState({
      turnNumber: 10,
      clans: [makeClan({ leaders: [leader] })],
      secrets: [deterringSecret, heldSecret],
      bills: [],
      campaigning: null,
    });
    // Deterred — no decision at all.
    expect(scanNpcSecretDecisions(state)).toEqual([]);

    // Remove the deterring secret: now eligible.
    const stateUndeterred = makeState({ ...state, secrets: [heldSecret] });
    expect(scanNpcSecretDecisions(stateUndeterred).length).toBe(1);

    // Generated this very turn — not yet eligible.
    const stateFreshSecret = makeState({
      ...state,
      secrets: [{ ...heldSecret, acquiredSeason: 10 }],
    });
    expect(scanNpcSecretDecisions(stateFreshSecret)).toEqual([]);

    // Cooldown not yet elapsed since lastActedSeason.
    const stateOnCooldown = makeState({
      ...state,
      secrets: [{ ...heldSecret, lastActedSeason: 8 }], // 10 - 8 = 2 < npcUseCooldownSeasons (4)
    });
    expect(scanNpcSecretDecisions(stateOnCooldown)).toEqual([]);
  });
});

describe('resolveSecretDemand', () => {
  test('comply — leverage_bill applies a weighted support delta and may spend the secret', () => {
    const leader = makeLeader({ id: 'leader-1', votes: 10 });
    const bill = { id: 'b1', name: 'A Bill', desc: '', type: 'optimates' as const, support: 0, turnsLeft: 2, passEffect: '', failEffect: '' };
    const secret = makeSecret({ id: 's1', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } });
    const state = makeState({ clans: [makeClan({ leaders: [leader] })], bills: [bill], secrets: [secret] });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'leverage_bill' as const, billId: 'b1', direction: 'for' as const };

    const { patch } = resolveSecretDemand(state, demand, 'comply');
    const updatedBill = (patch.bills as any[]).find(b => b.id === 'b1');
    expect(updatedBill.support).toBeCloseTo(computeLeverageBillSupportDelta(10, 'for'));
    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === 's1')!;
    expect(updatedSecret.useCount).toBe(1);
    expect(updatedSecret.status).toBe('held'); // leverageReuseLimit is 2 — first use retains it
  });

  test('comply — leverage_bill spends the secret once useCount reaches leverageReuseLimit', () => {
    const leader = makeLeader({ id: 'leader-1', votes: 10 });
    const bill = { id: 'b1', name: 'A Bill', desc: '', type: 'optimates' as const, support: 0, turnsLeft: 2, passEffect: '', failEffect: '' };
    const secret = makeSecret({
      id: 's1', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' },
      useCount: BALANCE.secrets.npcAi.leverageReuseLimit - 1,
    });
    const state = makeState({ clans: [makeClan({ leaders: [leader] })], bills: [bill], secrets: [secret] });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'leverage_bill' as const, billId: 'b1', direction: 'for' as const };

    const { patch } = resolveSecretDemand(state, demand, 'comply');
    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === 's1')!;
    expect(updatedSecret.status).toBe('spent');
  });

  test('comply — leverage_election pledges campaignVotes when campaigning is active', () => {
    const leader = makeLeader({ id: 'leader-1' });
    const secret = makeSecret({ id: 's1', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } });
    const state = makeState({
      clans: [makeClan({ leaders: [leader] })], secrets: [secret],
      campaigning: 'aedile', campaignVotes: {},
    });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'leverage_election' as const };

    const { patch } = resolveSecretDemand(state, demand, 'comply');
    expect((patch.campaignVotes as any)['leader-1']).toBe('for');
  });

  test('comply — extort starts the recurring drain', () => {
    const leader = makeLeader({ id: 'leader-1' });
    const secret = makeSecret({ id: 's1', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } });
    const state = makeState({ clans: [makeClan({ leaders: [leader] })], secrets: [secret] });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'extort' as const };

    const { patch } = resolveSecretDemand(state, demand, 'comply');
    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === 's1')!;
    expect(updatedSecret.status).toBe('extorting');
  });

  test('defy — social secret hits dignitas and relationship, no trial', () => {
    const leader = makeLeader({ id: 'leader-1', relationship: 20 });
    const secret = makeSecret({ id: 's1', type: 'affair', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } });
    const state = makeState({
      clans: [makeClan({ leaders: [leader] })], secrets: [secret],
      trials: [], lifetimeDignitas: 20,
    });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'extort' as const };

    const { patch } = resolveSecretDemand(state, demand, 'defy');
    expect(patch.trials).toBeUndefined();
    expect(patch.lifetimeDignitas).toBe(20 + BALANCE.secrets.npcAi.socialExposureDignitas);
    const updatedLeader = (patch.clans as Clan[])[0].leaders[0];
    expect(updatedLeader.relationship).toBe(20 + BALANCE.secrets.npcAi.socialExposureRelationship);
    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === 's1')!;
    expect(updatedSecret.status).toBe('exposed');
    expect(updatedSecret.discovered).toBe(true);
  });

  test('defy — criminal secret queues a trial through the unified pipeline', () => {
    const leader = makeLeader({ id: 'leader-1' });
    const secret = makeSecret({ id: 's1', type: 'embezzlement', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } });
    const state = makeState({
      clans: [makeClan({ leaders: [leader] })], secrets: [secret],
      trials: [], family: [makeCharacter({ id: 'pc-1' })], ownedAssets: [],
    });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'extort' as const };

    const { patch } = resolveSecretDemand(state, demand, 'defy');
    expect(patch.trials).toBeDefined();
    const trial = (patch.trials as any[])[0];
    expect(trial.defendant).toEqual({ kind: 'family', characterId: 'pc-1' });
    expect(trial.charge).toBe('peculatus'); // embezzlement -> peculatus, a real 1:1 mapping now
    expect(trial.seat).toBe('defense');
    expect(trial.chargeSource).toBe('secret');
  });

  test('defy — criminal secret does not queue a second trial while one is already pending', () => {
    const leader = makeLeader({ id: 'leader-1' });
    const secret = makeSecret({ id: 's1', type: 'embezzlement', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' } });
    const existingTrial: TrialState = {
      id: 't1', seat: 'defense', charge: 'peculatus', chargeSource: 'accusation',
      prosecutor: { kind: 'leader', leaderId: 'leader-1' }, defendant: { kind: 'family', characterId: 'pc-1' },
      filedSeason: 8, startsSeason: 10,
      playerPrep: { logos: 20, pathos: 0, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
      approach: 'procedure', speakerId: 'pc-1', npcStrength: 20, juryLean: 0,
      consumedSecretIds: [], status: 'preparing', session: null,
    };
    const state = makeState({
      clans: [makeClan({ leaders: [leader] })], secrets: [secret],
      trials: [existingTrial], family: [makeCharacter({ id: 'pc-1' })], ownedAssets: [],
    });
    const demand = { secretId: 's1', leaderId: 'leader-1', clanId: 'testii', kind: 'extort' as const };

    const { patch } = resolveSecretDemand(state, demand, 'defy');
    expect(patch.trials).toBeUndefined();
    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === 's1')!;
    expect(updatedSecret.status).toBe('exposed');
  });

  test('unknown secret/leader is a safe no-op', () => {
    const state = makeState();
    const demand = { secretId: 'nope', leaderId: 'nope', clanId: 'testii', kind: 'extort' as const };
    const { patch } = resolveSecretDemand(state, demand, 'comply');
    expect(patch).toEqual({});
  });
});

// ─── resolveClaudiusDefiance (Phase 4, Chunk P4-G) ──────────────────────────

describe('resolveClaudiusDefiance', () => {
  function claudiusSecret(overrides: Partial<Secret> = {}): Secret {
    return {
      id: CLAUDIUS_ARC_SECRET_ID, type: 'embezzlement',
      subject: { kind: 'family', characterId: 'pc-1' },
      holder: CLAUDIUS_LEADER_ID, potency: 2, status: 'held',
      acquiredSeason: 1, discovered: true,
      flavorText: "a certain irregularity in your father's accounts",
      ...overrides,
    };
  }
  function claudiusLeader(overrides: Partial<ClanLeader> = {}): ClanLeader {
    return makeLeader({ id: CLAUDIUS_LEADER_ID, name: 'Ap. Claudius Pulcher', votes: 16, ...overrides });
  }

  test('files a peculatus trial seeded from BALANCE.secrets.claudius.trialSeed, and exposes the Secret', () => {
    const state = makeState({
      clans: [makeClan({ id: CLAUDIUS_CLAN_ID, leaders: [claudiusLeader()] })],
      secrets: [claudiusSecret()],
      family: [makeCharacter({ id: 'pc-1' })],
      trials: [],
      turnNumber: 12,
      pendingSecretDemand: { secretId: CLAUDIUS_ARC_SECRET_ID, leaderId: CLAUDIUS_LEADER_ID, clanId: CLAUDIUS_CLAN_ID, kind: 'leverage_bill' as const },
      claudiusPatience: 0,
    });

    const { patch, logMsg } = resolveClaudiusDefiance(state);

    expect(patch.trials).toBeDefined();
    const trial = (patch.trials as any[])[0];
    expect(trial.charge).toBe('peculatus');
    expect(trial.seat).toBe('defense');
    expect(trial.chargeSource).toBe('secret');
    expect(trial.defendant).toEqual({ kind: 'family', characterId: 'pc-1' });
    expect(trial.prosecutor).toEqual({ kind: 'leader', leaderId: CLAUDIUS_LEADER_ID });
    expect(trial.npcStrength).toBe(BALANCE.secrets.claudius.trialSeed);
    // Phase 5, Chunk P5-H — Claudius's own delay, not the shared
    // npcInitiatedDelay every other NPC-initiated trial uses (see
    // BALANCE.secrets.claudius's comment).
    expect(trial.startsSeason).toBe(12 + BALANCE.secrets.claudius.startsDelaySeasons);
    expect(trial.consumedSecretIds).toEqual([CLAUDIUS_ARC_SECRET_ID]);

    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === CLAUDIUS_ARC_SECRET_ID)!;
    expect(updatedSecret.status).toBe('exposed');

    expect(patch.pendingSecretDemand).toBeNull();
    expect(patch.claudiusPatience).toBeNull();
    expect(logMsg).toContain('peculatus');
  });

  test('does not queue a second trial while one is already pending, but still exposes and clears state', () => {
    const existingTrial: TrialState = {
      id: 't1', seat: 'defense', charge: 'ambitus', chargeSource: 'accusation',
      prosecutor: { kind: 'leader', leaderId: 'leader-1' }, defendant: { kind: 'family', characterId: 'pc-1' },
      filedSeason: 8, startsSeason: 10,
      playerPrep: { logos: 0, pathos: 0, ethos: 0, actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false },
      approach: 'procedure', speakerId: 'pc-1', npcStrength: 10, juryLean: 0,
      consumedSecretIds: [], status: 'preparing', session: null,
    };
    const state = makeState({
      clans: [makeClan({ id: CLAUDIUS_CLAN_ID, leaders: [claudiusLeader()] })],
      secrets: [claudiusSecret()],
      family: [makeCharacter({ id: 'pc-1' })],
      trials: [existingTrial],
    });

    const { patch } = resolveClaudiusDefiance(state);
    expect(patch.trials).toBeUndefined();
    const updatedSecret = (patch.secrets as Secret[]).find(s => s.id === CLAUDIUS_ARC_SECRET_ID)!;
    expect(updatedSecret.status).toBe('exposed');
    expect(patch.pendingSecretDemand).toBeNull();
    expect(patch.claudiusPatience).toBeNull();
  });

  test('a safe no-op once the arc Secret is already resolved (not held)', () => {
    const state = makeState({
      clans: [makeClan({ id: CLAUDIUS_CLAN_ID, leaders: [claudiusLeader()] })],
      secrets: [claudiusSecret({ status: 'neutralized' })],
      family: [makeCharacter({ id: 'pc-1' })],
      trials: [],
    });
    const { patch } = resolveClaudiusDefiance(state);
    expect(patch.trials).toBeUndefined();
    expect(patch.secrets).toBeUndefined();
    expect(patch.pendingSecretDemand).toBeNull();
    expect(patch.claudiusPatience).toBeNull();
  });
});

describe('attemptGather — P4-B discovery/reveal branch', () => {
  test('a success against a holder with an undiscovered secret reveals it instead of generating a new one', () => {
    const agent = makeCharacter({ id: 'agent-1', skills: { rhetoric: 0, martial: 0, intrigus: 5 } });
    const leader = makeLeader({ id: 'leader-1', intelGroundwork: 0 });
    const undiscovered = makeSecret({
      id: 'against-1', holder: 'leader-1', subject: { kind: 'family', characterId: 'pc-1' }, discovered: false,
    });
    const state = makeState({
      family: [agent], clans: [makeClan({ leaders: [leader] })], secrets: [undiscovered],
    });

    const chance = gatherChance(5, 0);
    const result = attemptGather(state, 'leader-1', 'agent-1', chance - 0.001);

    expect(result.success).toBe(true);
    expect(result.secret).toBeNull();
    expect(result.revealedSecretId).toBe('against-1');
    expect(result.groundwork).toBeCloseTo(BALANCE.secrets.groundworkPerFailure);
  });

  test('a success against a holder with no undiscovered secret generates a fresh one as before', () => {
    const agent = makeCharacter({ id: 'agent-1', skills: { rhetoric: 0, martial: 0, intrigus: 5 } });
    const leader = makeLeader({ id: 'leader-1', intelGroundwork: 0 });
    const state = makeState({ family: [agent], clans: [makeClan({ leaders: [leader] })], secrets: [] });

    const chance = gatherChance(5, 0);
    const result = attemptGather(state, 'leader-1', 'agent-1', chance - 0.001);

    expect(result.success).toBe(true);
    expect(result.secret).not.toBeNull();
    expect(result.revealedSecretId).toBeNull();
  });
});
