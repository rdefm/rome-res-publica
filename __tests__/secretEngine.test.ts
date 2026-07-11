import {
  gatherChance,
  attemptGather,
  npcGatherTick,
  generateSecret,
} from '../src/engine/secretEngine';
import { BALANCE } from '../src/data/balance';
import type { Character } from '../src/models/character';
import type { Clan, ClanLeader } from '../src/models/clan';
import type { GameState } from '../src/state/gameStore';
import type { Secret } from '../src/models/secret';

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
    const state = makeState({ clans: [makeClan({ leaders: [friendly, hostile] })] });

    // rng always succeeds when called — only 'hostile' should ever roll.
    const newSecrets = npcGatherTick(state, () => 0);
    expect(newSecrets.length).toBe(1);
    expect(newSecrets[0].holder).toBe('hostile');
    expect(newSecrets[0].subject.kind).toBe('family');
  });

  test('corruption scales chance up to the cap', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const cleanFamily = makeState({
      family: [makeCharacter({ corruptionScore: 0 })],
      clans: [makeClan({ leaders: [hostile] })],
    });
    const corruptFamily = makeState({
      family: [makeCharacter({ corruptionScore: 100 })],
      clans: [makeClan({ leaders: [makeLeader({ id: 'hostile', relationship: 10 }) ] })],
    });

    // Roll pinned just above the clean-family chance but below the capped
    // corrupt-family chance — clean family should never generate, corrupt should.
    const cleanChance = BALANCE.secrets.npcGatherBase;
    const roll = cleanChance + 0.001;
    expect(npcGatherTick(cleanFamily, () => roll).length).toBe(0);
    expect(npcGatherTick(corruptFamily, () => roll).length).toBe(1);
  });

  test('respects maxHeldAgainstFamily per leader', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const existing: Secret[] = Array.from({ length: BALANCE.secrets.maxHeldAgainstFamily }, (_, i) => ({
      id: `s${i}`, type: 'affair', subject: { kind: 'family', characterId: 'pc-1' },
      holder: 'hostile', potency: 1, status: 'held', acquiredSeason: 1, flavorText: '',
    }));
    const state = makeState({
      clans: [makeClan({ leaders: [hostile] })],
      secrets: existing,
    });
    expect(npcGatherTick(state, () => 0).length).toBe(0);
  });

  test('missing state.secrets defaults gracefully (pre-P4-A save)', () => {
    const hostile = makeLeader({ id: 'hostile', relationship: 10 });
    const state = makeState({ clans: [makeClan({ leaders: [hostile] })] });
    delete (state as any).secrets;
    expect(() => npcGatherTick(state, () => 0)).not.toThrow();
  });

  test('empty family is a safe no-op', () => {
    const state = makeState({ family: [] });
    expect(npcGatherTick(state, () => 0)).toEqual([]);
  });
});
