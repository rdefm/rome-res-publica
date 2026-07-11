/**
 * secretEngine.ts — Phase 4, Chunk P4-A
 *
 * Pure functions: gather-chance math, the player's Gather Intelligence /
 * Audit a Rival roll resolution, the NPC-side reverse gather tick, and the
 * shared Secret generator. No store access, no React/UI imports.
 *
 * Spend/counterplay verbs (Leverage, Extort, Burn, Pay Off, Discredit,
 * Deterrence) are P4-B. This chunk only produces latent Secret objects.
 */

import type { GameState } from '../state/gameStore';
import type { Secret, SecretType, SecretSubject, SecretHolder } from '../models/secret';
import { SECRET_TYPE_DEFS, SECRET_TYPES } from '../data/secretDefinitions';
import { BALANCE } from '../data/balance';

// ─── Gather chance ────────────────────────────────────────────────────────────

/** The number the family-member picker UI shows per candidate. */
export function gatherChance(agentIntrigus: number, groundwork: number): number {
  const raw =
    BALANCE.secrets.gatherBaseChance +
    agentIntrigus * BALANCE.secrets.gatherPerIntrigus +
    groundwork;
  return Math.min(BALANCE.secrets.gatherChanceCap, raw);
}

// ─── Weighted picks ───────────────────────────────────────────────────────────

/** maxPotency renormalizes BALANCE.secrets.potencyWeights over 1..maxPotency
 *  (e.g. Audit a Rival's "potency-weighted 1–2" reuses the same relative
 *  55/35 weighting between just those two tiers, rather than inventing a
 *  second weight table). */
function pickWeightedPotency(rng: () => number, maxPotency: 1 | 2 | 3 = 3): 1 | 2 | 3 {
  const weights = BALANCE.secrets.potencyWeights.slice(0, maxPotency);
  const total = weights.reduce((a, b) => a + b, 0);
  const roll = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll < cumulative) return (i + 1) as 1 | 2 | 3;
  }
  return maxPotency;
}

/** Equal weight among condition-eligible types (optionally restricted to a
 *  caller-supplied pool, e.g. Audit a Rival's embezzlement/electoral_fraud).
 *  The plan calls for weighting "by leader bias/history" but gives no
 *  numeric table for it (unlike potencyWeights, which is specified) — this
 *  is the simplest defensible reading until a tuning pass wants to correlate
 *  specific SecretTypes with LeaderBias. officeHistoryEligible gates
 *  provincial_plunder per SECRET_TYPE_DEFS[type].requiresOfficeHistory. */
function pickWeightedType(
  officeHistoryEligible: boolean,
  rng: () => number,
  pool: SecretType[] = SECRET_TYPES
): SecretType {
  const eligible = pool.filter(
    t => !SECRET_TYPE_DEFS[t].requiresOfficeHistory || officeHistoryEligible
  );
  const idx = Math.min(Math.floor(rng() * eligible.length), eligible.length - 1);
  return eligible[idx];
}

// ─── Shared generator ─────────────────────────────────────────────────────────

export interface GenerateSecretOptions {
  /** Restrict the type draw to this pool (still subject to officeHistoryEligible
   *  gating). Defaults to all SECRET_TYPES — used by Audit a Rival to narrow
   *  to embezzlement/electoral_fraud per the plan. */
  typePool?: SecretType[];
  /** Restrict the potency draw to 1..maxPotency. Defaults to 3 — used by
   *  Audit a Rival's "potency-weighted 1–2". */
  maxPotency?: 1 | 2 | 3;
}

export function generateSecret(
  subject: SecretSubject,
  holder: SecretHolder,
  subjectName: string,
  acquiredSeason: number,
  officeHistoryEligible: boolean,
  rng: () => number = Math.random,
  options?: GenerateSecretOptions
): Secret {
  const type = pickWeightedType(officeHistoryEligible, rng, options?.typePool);
  const potency = pickWeightedPotency(rng, options?.maxPotency ?? 3);
  const templates = SECRET_TYPE_DEFS[type].flavorTemplates;
  const template = templates[Math.min(Math.floor(rng() * templates.length), templates.length - 1)];
  const flavorText = template.split('{subject}').join(subjectName);

  return {
    id: `secret-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    type,
    subject,
    holder,
    potency,
    status: 'held',
    acquiredSeason,
    flavorText,
  };
}

// ─── Player-side: Gather Intelligence ────────────────────────────────────────

export interface AttemptGatherResult {
  success: boolean;
  secret: Secret | null;
  /** New intelGroundwork value for this leader — 0 on success (reset), else
   *  the existing value + groundworkPerFailure (capped) on failure. Caller
   *  writes this back onto ClanLeader.intelGroundwork. */
  groundwork: number;
}

/** roll is externalized for testability (0–1, caller supplies Math.random()
 *  in production). rng drives the generator's internal type/potency/flavor
 *  picks on success — separate from roll, which only decides success/fail. */
export function attemptGather(
  state: GameState,
  leaderId: string,
  agentId: string,
  roll: number,
  rng: () => number = Math.random
): AttemptGatherResult {
  const leader = state.clans.flatMap(c => c.leaders).find(l => l.id === leaderId);
  const agent = state.family.find(c => c.id === agentId);
  const currentGroundwork = leader?.intelGroundwork ?? 0;

  if (!leader || !agent) {
    return { success: false, secret: null, groundwork: currentGroundwork };
  }

  const chance = gatherChance(agent.skills.intrigus, currentGroundwork);
  if (roll >= chance) {
    const groundwork = Math.min(
      BALANCE.secrets.groundworkCap,
      currentGroundwork + BALANCE.secrets.groundworkPerFailure
    );
    return { success: false, secret: null, groundwork };
  }

  const officeHistoryEligible = leader.heldOffices.length > 0;
  const secret = generateSecret(
    { kind: 'leader', leaderId },
    'player',
    leader.name,
    state.turnNumber,
    officeHistoryEligible,
    rng
  );
  return { success: true, secret, groundwork: 0 };
}

// ─── NPC-side: reverse gather (season tick) ──────────────────────────────────

/**
 * Each leader whose relationship (the codebase's "standing" for this purpose
 * — see offices.ts's audit-rival, which gates hostility the same way) is
 * below hostileStandingMax rolls once this season. Odds scale with the
 * highest corruptionScore among the player's own family — corruption is the
 * fuel. Targets the single most-corrupt family member (the "magnet"); ties
 * resolve to array order. Respects maxHeldAgainstFamily per leader. Zero UI
 * notification this chunk (P4-B adds discovery/agenda surfacing) — generated
 * Secrets sit latent.
 */
export function npcGatherTick(state: GameState, rng: () => number = Math.random): Secret[] {
  if (state.family.length === 0) return [];

  const highestFamilyCorruption = state.family.reduce(
    (max, c) => Math.max(max, c.corruptionScore ?? 0),
    0
  );

  const heldAgainstFamilyByLeader = new Map<string, number>();
  for (const s of state.secrets ?? []) {
    if (s.subject.kind === 'family' && s.holder !== 'player') {
      heldAgainstFamilyByLeader.set(s.holder, (heldAgainstFamilyByLeader.get(s.holder) ?? 0) + 1);
    }
  }

  const target = state.family.reduce(
    (best, c) => ((c.corruptionScore ?? 0) > (best.corruptionScore ?? 0) ? c : best),
    state.family[0]
  );
  // Defensive optional-chaining: heldOffices is a new (P4-A) required field,
  // but plenty of pre-existing test fixtures and legacy code paths construct
  // Character objects via loose type-casts that predate it.
  const officeHistoryEligible = (target.heldOffices?.length ?? 0) > 0 || target.officeId !== null;

  const chance = Math.min(
    BALANCE.secrets.npcGatherCap,
    BALANCE.secrets.npcGatherBase + BALANCE.secrets.npcGatherPerCorruption * highestFamilyCorruption
  );

  const newSecrets: Secret[] = [];
  for (const clan of state.clans) {
    for (const leader of clan.leaders) {
      if (leader.relationship >= BALANCE.secrets.hostileStandingMax) continue;
      const alreadyHeld = heldAgainstFamilyByLeader.get(leader.id) ?? 0;
      if (alreadyHeld >= BALANCE.secrets.maxHeldAgainstFamily) continue;

      if (rng() < chance) {
        const secret = generateSecret(
          { kind: 'family', characterId: target.id },
          leader.id,
          target.name,
          state.turnNumber,
          officeHistoryEligible,
          rng
        );
        newSecrets.push(secret);
        heldAgainstFamilyByLeader.set(leader.id, alreadyHeld + 1);
      }
    }
  }
  return newSecrets;
}
