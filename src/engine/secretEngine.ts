/**
 * secretEngine.ts — Phase 4, Chunks P4-A + P4-B
 *
 * Pure functions: gather-chance math, the player's Gather Intelligence /
 * Audit a Rival roll resolution, the NPC-side reverse gather tick, the
 * shared Secret generator (P4-A); player verbs (Leverage/Extort/Burn),
 * counterplay (Pay Off/Discredit), deterrence, and NPC decision-making
 * (P4-B). No store access, no React/UI imports.
 */

import type { GameState } from '../state/gameStore';
import type { Secret, SecretType, SecretSubject, SecretHolder, PendingSecretDemand } from '../models/secret';
import type { ClanLeader, LeaderBias } from '../models/clan';
import type { BillType } from '../models/bill';
import type { ChargeId } from '../models/trial';
import { SECRET_TYPE_DEFS, SECRET_TYPES, SECRET_CLASS_BY_TYPE } from '../data/secretDefinitions';
import { BALANCE } from '../data/balance';
import { buildTrialState } from './trialEngine';

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
  /** New intelGroundwork value for this leader — 0 on a fresh-Secret success,
   *  else the existing value + groundworkPerFailure (capped) on failure OR a
   *  reveal-success (see revealedSecretId). Caller writes this back onto
   *  ClanLeader.intelGroundwork. */
  groundwork: number;
  /** Phase 4, Chunk P4-B — set when this success revealed an existing
   *  undiscovered Secret the target holds against the family, instead of
   *  generating a new one. Caller flips that Secret's `discovered` to true. */
  revealedSecretId: string | null;
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
    return { success: false, secret: null, groundwork: currentGroundwork, revealedSecretId: null };
  }

  const chance = gatherChance(agent.skills.intrigus, currentGroundwork);
  if (roll >= chance) {
    const groundwork = Math.min(
      BALANCE.secrets.groundworkCap,
      currentGroundwork + BALANCE.secrets.groundworkPerFailure
    );
    return { success: false, secret: null, groundwork, revealedSecretId: null };
  }

  // Phase 4, Chunk P4-B — counter-espionage: a successful gather against a
  // leader who already holds an undiscovered Secret on the family reveals it
  // instead of yielding a brand-new one — the plan's recommended rule, "so
  // counter-espionage feels distinct." Only groundwork advances this attempt
  // (same shape as a failure), not a fresh Secret; reveal takes priority over
  // generation whenever an undiscovered target exists.
  const undiscovered = (state.secrets ?? []).find(
    s => s.holder === leaderId && s.subject.kind === 'family' && s.status === 'held' && !s.discovered
  );
  if (undiscovered) {
    const groundwork = Math.min(
      BALANCE.secrets.groundworkCap,
      currentGroundwork + BALANCE.secrets.groundworkPerFailure
    );
    return { success: true, secret: null, groundwork, revealedSecretId: undiscovered.id };
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
  return { success: true, secret, groundwork: 0, revealedSecretId: null };
}

// ─── NPC-side: reverse gather (season tick) ──────────────────────────────────

export interface NpcGatherTickResult {
  secrets: Secret[];
  /** Full updated clans array — familyGroundwork bumped (reset on a success,
   *  raised on a failure) for every leader below hostileStandingMax who
   *  rolled this season. Caller (turnSequencer) writes this back wholesale
   *  onto state.clans, same pattern as every other clans-mapping step. */
  clans: GameState['clans'];
}

/**
 * Each leader whose relationship (the codebase's "standing" for this purpose
 * — see offices.ts's audit-rival, which gates hostility the same way) is
 * below hostileStandingMax rolls once this season. Odds scale with the
 * highest corruptionScore among the player's own family (corruption is the
 * fuel) plus this leader's own familyGroundwork — the mirror of the
 * player's intelGroundwork, persisting across failed attempts and jumping
 * on an exposed Extort (BALANCE.secrets.extortRetaliationGroundwork).
 * Targets the single most-corrupt family member (the "magnet"); ties
 * resolve to array order. Respects maxHeldAgainstFamily per leader.
 */
export function npcGatherTick(state: GameState, rng: () => number = Math.random): NpcGatherTickResult {
  if (state.family.length === 0) return { secrets: [], clans: state.clans };

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

  const newSecrets: Secret[] = [];

  const clans = state.clans.map(clan => ({
    ...clan,
    leaders: clan.leaders.map(leader => {
      if (leader.relationship >= BALANCE.secrets.hostileStandingMax) return leader;
      const alreadyHeld = heldAgainstFamilyByLeader.get(leader.id) ?? 0;
      if (alreadyHeld >= BALANCE.secrets.maxHeldAgainstFamily) return leader;

      const familyGroundwork = leader.familyGroundwork ?? 0;
      const chance = Math.min(
        BALANCE.secrets.npcGatherCap,
        BALANCE.secrets.npcGatherBase + BALANCE.secrets.npcGatherPerCorruption * highestFamilyCorruption + familyGroundwork
      );

      if (rng() < chance) {
        const secret = generateSecret(
          { kind: 'family', characterId: target.id },
          leader.id,
          target.name,
          state.turnNumber,
          officeHistoryEligible,
          rng
        );
        // Phase 4, Chunk P4-B — starts hidden from the player; revealed by a
        // demand firing (turnSequencer's NPC decision step) or a successful
        // counter-gather (attemptGather's reveal branch, above).
        newSecrets.push({ ...secret, discovered: false });
        heldAgainstFamilyByLeader.set(leader.id, alreadyHeld + 1);
        return { ...leader, familyGroundwork: 0 };
      }

      return {
        ...leader,
        familyGroundwork: Math.min(BALANCE.secrets.groundworkCap, familyGroundwork + BALANCE.secrets.groundworkPerFailure),
      };
    }),
  }));

  return { secrets: newSecrets, clans };
}

// ─── Deterrence (Phase 4, Chunk P4-B) ────────────────────────────────────────

/**
 * True while a mutual standoff exists with leaderId: the player holds a
 * 'held' Secret on them AND they hold a 'held' Secret on the family.
 * Symmetric by construction — call with the same leaderId from either side
 * (an NPC-decision loop iterating leaders, or a player verb on a
 * subject.kind==='leader' Secret) and get the same answer.
 *
 * Existence-based, not discovery-gated (design invariant 6: "Mutual
 * deterrence is automatic... visible in the UI, no action required") — the
 * standoff is real even before the player has discovered the countering
 * Secret. The Dossier surfaces the *fact* of a stalemate without
 * necessarily revealing an undiscovered Secret's content (DossierPanel.tsx).
 */
export function isDeterred(leaderId: string, allSecrets: Secret[]): boolean {
  const playerHoldsOnLeader = allSecrets.some(
    s => s.holder === 'player' && s.subject.kind === 'leader' && s.subject.leaderId === leaderId && s.status === 'held'
  );
  if (!playerHoldsOnLeader) return false;
  return allSecrets.some(
    s => s.holder === leaderId && s.subject.kind === 'family' && s.status === 'held'
  );
}

// ─── Player verbs — Leverage / Extort / Burn (on a held Secret you hold) ────

/**
 * Leverage-for-bill: no per-leader bill vote exists anywhere in this
 * codebase (Bill.support is a single aggregate scalar) — so "force the
 * vote" is implemented as a support swing weighted by the leader's vote
 * bloc, signed for/against. Abstain isn't offered — it has no distinct
 * mechanical meaning when there's no individual ballot to withhold.
 */
export function computeLeverageBillSupportDelta(
  leaderVotes: number,
  direction: 'for' | 'against'
): number {
  const magnitude = leaderVotes * BALANCE.secrets.leverageBillSupportPerVote;
  return direction === 'for' ? magnitude : -magnitude;
}

export interface ExtortSeasonTickResult {
  income: number;
  exposed: boolean;
  newStatus: 'extorting' | 'spent';
  relationshipDelta: number;
  retaliationGroundworkDelta: number;
}

/**
 * One season of the PLAYER extorting a leader (status 'extorting',
 * holder==='player'). roll externalized for testability. On exposure the
 * Secret is spent (income stops), the leader's relationship nosedives, and
 * their retaliation groundwork rises toward a counter-Secret on the family
 * — "stoppable any season" (the player's own choice to stop) is handled by
 * the caller setting status to 'spent' directly, not through this function.
 */
export function extortSeasonTick(secret: Secret, roll: number): ExtortSeasonTickResult {
  const income = BALANCE.secrets.extortIncomePerPotency * secret.potency;
  const exposed = roll < BALANCE.secrets.extortExposureChance;
  return {
    income,
    exposed,
    newStatus: exposed ? 'spent' : 'extorting',
    relationshipDelta: exposed ? BALANCE.secrets.extortExposureRelationship : 0,
    retaliationGroundworkDelta: exposed ? BALANCE.secrets.extortRetaliationGroundwork : 0,
  };
}

/**
 * One season of a LEADER extorting the player family (status 'extorting',
 * holder===leaderId — the player complied with an extortion demand). A flat
 * Denarii drain, no further exposure roll: the player's exposure risk was
 * already resolved at the comply/defy fork (secretDemandChoice below).
 * Continues until the player counters it (Pay Off/Discredit) — no
 * NPC-initiated "stop," matching the plan's asymmetric detail level (it
 * specifies the player's own extort mechanics in full but not a mirrored
 * NPC-side wind-down).
 */
export function computeExtortionDrain(secret: Secret): number {
  return BALANCE.secrets.extortIncomePerPotency * secret.potency;
}

/** Burn: deterministic — no roll. Leader permanently loses this fraction of
 *  their votes (plan's system-overview text: "permanently loses half their
 *  votes"). */
export function computeBurnVoteLoss(currentVotes: number): number {
  return Math.round(currentVotes * BALANCE.secrets.burnVoteLossFraction);
}

// ─── Counterplay — Pay Off / Discredit (on a Secret held against the family) ─

export function payOffCost(potency: 1 | 2 | 3): number {
  return BALANCE.secrets.payOffCostPerPotency * potency;
}

export function discreditChance(agentIntrigus: number): number {
  return BALANCE.secrets.discreditBase + agentIntrigus * BALANCE.secrets.discreditPerIntrigus;
}

export interface AttemptDiscreditResult {
  success: boolean;
  /** Unchanged (secret goes 'neutralized' regardless of this value on
   *  success) or potency + 1 (capped at 3) on failure — "the cover-up made
   *  it worse." */
  newPotency: 1 | 2 | 3;
}

export function attemptDiscredit(
  secret: Secret,
  agentIntrigus: number,
  roll: number
): AttemptDiscreditResult {
  const success = roll < discreditChance(agentIntrigus);
  return {
    success,
    newPotency: success ? secret.potency : (Math.min(3, secret.potency + 1) as 1 | 2 | 3),
  };
}

// ─── Criminal exposure → the unified trial pipeline (Phase 4, P4-C) ─────────

/**
 * Maps a criminal SecretType to its real ChargeId — a clean 1:1 (each
 * criminal SecretType has exactly one matching charge in data/trialCharges.ts).
 * Social types (affair/impiety) never call this — their exposure routes to
 * the scandal-event branch instead
 * (BALANCE.secrets.npcAi.socialExposureDignitas/Relationship).
 */
export function mapSecretTypeToTrialCharge(type: SecretType): ChargeId {
  switch (type) {
    case 'electoral_fraud':      return 'ambitus';
    case 'embezzlement':         return 'peculatus';
    case 'provincial_plunder':   return 'repetundae';
    default:                     return 'peculatus';
  }
}

// ─── NPC decision-making (season tick) ───────────────────────────────────────

export type NpcSecretActionKind = 'leverage_bill' | 'leverage_election' | 'extort' | 'burn';

export interface NpcSecretDecision {
  secretId: string;
  leaderId: string;
  clanId: string;
  action: NpcSecretActionKind;
  /** Set only for 'leverage_bill'. */
  billId?: string;
  direction?: 'for' | 'against';
}

/**
 * A leader "cares about" a bill when its type aligns with their political
 * bias — the only existing signal that connects a ClanLeader to a Bill in
 * this codebase (there's no per-leader bill-interest table). Not
 * exhaustive/bidirectional (a leader never leverages *against* a
 * bias-aligned bill this chunk) — a reasonable first pass the plan leaves
 * to implementer judgment ("a bill they care about is live").
 */
const BIAS_TO_BILL_TYPE: Record<LeaderBias, BillType> = {
  optimates: 'optimates',
  populares: 'populist',
  military: 'military',
  commerce: 'economic',
  tradition: 'constitutional',
};

/**
 * Chooses ONE action for a leader given their eligible (unfrozen,
 * cooldown-elapsed, still-'held') Secrets against the family — the plan's
 * "choosing by disposition and situation." Priority: Leverage when a live
 * bill matches their bias, or the player is mid-campaign and they haven't
 * pledged; Burn only at standing ≤ npcBurnStandingMax and no Leverage
 * opportunity ("rarely... if they hold nothing better"); otherwise Extort,
 * the default recurring option. Plays their highest-potency eligible
 * Secret when more than one qualifies.
 */
export function npcSecretDecision(
  leader: ClanLeader,
  clanId: string,
  eligibleSecrets: Secret[],
  state: GameState
): NpcSecretDecision | null {
  if (eligibleSecrets.length === 0) return null;
  const secret = [...eligibleSecrets].sort((a, b) => b.potency - a.potency)[0];
  const base = { secretId: secret.id, leaderId: leader.id, clanId };

  const matchingBillType = BIAS_TO_BILL_TYPE[leader.bias];
  const targetBill = state.bills.find(b => b.type === matchingBillType);
  if (targetBill) {
    return { ...base, action: 'leverage_bill', billId: targetBill.id, direction: 'for' };
  }

  const campaignThreat = state.campaigning !== null && state.campaignVotes[leader.id] !== 'for';
  if (campaignThreat) {
    return { ...base, action: 'leverage_election' };
  }

  if (leader.relationship <= BALANCE.secrets.npcAi.npcBurnStandingMax) {
    return { ...base, action: 'burn' };
  }

  return { ...base, action: 'extort' };
}

/**
 * Scans every clan leader and returns at most one decision per eligible
 * leader for this season — the orchestration turnSequencer's step 9b calls.
 * Eligibility: unfrozen (isDeterred), a 'held' family-subject Secret they
 * hold, cooldown elapsed since lastActedSeason, and not generated this very
 * turn (acquiredSeason < turnNumber — a brief pacing guard so a Secret isn't
 * demanded the instant it's discovered by npcGatherTick in the same step).
 */
export function scanNpcSecretDecisions(state: GameState): NpcSecretDecision[] {
  const allSecrets = state.secrets ?? [];
  const decisions: NpcSecretDecision[] = [];

  for (const clan of state.clans) {
    for (const leader of clan.leaders) {
      if (isDeterred(leader.id, allSecrets)) continue;

      const eligible = allSecrets.filter(s =>
        s.holder === leader.id &&
        s.subject.kind === 'family' &&
        s.status === 'held' &&
        s.acquiredSeason < state.turnNumber &&
        (state.turnNumber - (s.lastActedSeason ?? -Infinity)) >= BALANCE.secrets.npcAi.npcUseCooldownSeasons
      );
      const decision = npcSecretDecision(leader, clan.id, eligible, state);
      if (decision) decisions.push(decision);
    }
  }
  return decisions;
}

// ─── Demand resolution (comply/defy) ─────────────────────────────────────────

export interface ResolveSecretDemandResult {
  patch: Partial<GameState>;
  logMsg: string;
}

/**
 * Applies the consequence of the player's comply/defy answer to an NPC
 * demand event. Pure — gameStore.resolveEvent's special-case handler calls
 * this with live state + the pendingSecretDemand context, merges the
 * returned patch, and clears pendingSecretDemand itself (this function
 * doesn't touch it, matching every other special-case handler in that file,
 * which own their own pending-field clearing).
 */
export function resolveSecretDemand(
  state: GameState,
  demand: PendingSecretDemand,
  choiceId: 'comply' | 'defy'
): ResolveSecretDemandResult {
  const secret = (state.secrets ?? []).find(s => s.id === demand.secretId);
  const leaderFound = state.clans.flatMap(c => c.leaders).find(l => l.id === demand.leaderId);
  if (!secret || !leaderFound) {
    return { patch: {}, logMsg: 'The matter has already resolved itself.' };
  }

  if (choiceId === 'comply') {
    const useCount = (secret.useCount ?? 0) + 1;
    const spent = useCount >= BALANCE.secrets.npcAi.leverageReuseLimit;
    const statusAfterUse: 'spent' | 'held' = spent ? 'spent' : 'held';

    if (demand.kind === 'leverage_bill' && demand.billId) {
      const delta = computeLeverageBillSupportDelta(leaderFound.votes, demand.direction ?? 'for');
      const bills = state.bills.map(b =>
        b.id === demand.billId ? { ...b, support: Math.min(100, Math.max(-100, b.support + delta)) } : b
      );
      const secrets = state.secrets.map(s => s.id === secret.id
        ? { ...s, status: statusAfterUse, useCount, lastActedSeason: state.turnNumber }
        : s
      );
      const bill = bills.find(b => b.id === demand.billId);
      return {
        patch: { bills, secrets },
        logMsg: `You comply. ${leaderFound.name}'s bloc swings behind ${bill?.name ?? 'the bill'} — the price of their silence.`,
      };
    }

    if (demand.kind === 'leverage_election' && state.campaigning) {
      const secrets = state.secrets.map(s => s.id === secret.id
        ? { ...s, status: statusAfterUse, useCount, lastActedSeason: state.turnNumber }
        : s
      );
      return {
        patch: {
          campaignVotes: { ...state.campaignVotes, [leaderFound.id]: 'for' as const },
          secrets,
        },
        logMsg: `You comply. ${leaderFound.name} pledges support to your campaign.`,
      };
    }

    if (demand.kind === 'extort') {
      const secrets = state.secrets.map(s => s.id === secret.id
        ? { ...s, status: 'extorting' as const, lastActedSeason: state.turnNumber }
        : s
      );
      return {
        patch: { secrets },
        logMsg: `You comply. ${leaderFound.name} now bleeds your treasury quietly, season by season.`,
      };
    }

    // The situation lapsed between injection and answer (e.g. an
    // election-leverage demand answered after the campaign already ended) —
    // no penalty, the Secret stays held for a future opportunity.
    const secrets = state.secrets.map(s => s.id === secret.id ? { ...s, status: 'held' as const } : s);
    return { patch: { secrets }, logMsg: 'The moment has passed — there is nothing to give them now.' };
  }

  // ── Defy ──────────────────────────────────────────────────────────────────
  const secretClass = SECRET_CLASS_BY_TYPE[secret.type];

  if (secretClass === 'social') {
    const clans = state.clans.map(c => ({
      ...c,
      leaders: c.leaders.map(l => l.id === leaderFound.id
        ? { ...l, relationship: Math.max(-100, l.relationship + BALANCE.secrets.npcAi.socialExposureRelationship) }
        : l
      ),
    }));
    const secrets = state.secrets.map(s => s.id === secret.id ? { ...s, status: 'exposed' as const, discovered: true } : s);
    return {
      patch: {
        clans,
        lifetimeDignitas: Math.max(0, state.lifetimeDignitas + BALANCE.secrets.npcAi.socialExposureDignitas),
        secrets,
      },
      logMsg: `You defy them. ${secret.flavorText} The story breaks anyway — Dignitas suffers, and ${leaderFound.name} will not forget the refusal.`,
    };
  }

  // Criminal — exposure queues a trial through the unified TrialState
  // pipeline (Phase 4, P4-C). Only one active trial at a time (matches
  // shouldTriggerTrial's own invariant) — if one is already pending, the
  // Secret is still exposed but no duplicate trial is queued.
  const secretsExposed = state.secrets.map(s => s.id === secret.id ? { ...s, status: 'exposed' as const, discovered: true } : s);
  const alreadyOnTrial = (state.trials ?? []).some(t => t.status !== 'resolved');
  const criminalSubject = secret.subject;
  if (alreadyOnTrial || criminalSubject.kind !== 'family') {
    return {
      patch: { secrets: secretsExposed },
      logMsg: `You defy them. ${secret.flavorText} The evidence is loose in Rome now — sooner or later, someone will use it.`,
    };
  }

  const accused = state.family.find(c => c.id === criminalSubject.characterId);
  // Same seeding formula as turnSequencer's other NPC-initiated triggers
  // (leader intrigus + accused corruption), not the player-filing formula
  // (secretEvidenceBase × potency) — this trial is NPC-initiated, not filed.
  const initialNpcStrength = Math.min(100, leaderFound.skills.intrigus * 2 + (accused?.corruptionScore ?? 0) / 2);
  const charge = mapSecretTypeToTrialCharge(secret.type);
  const newTrial = buildTrialState({
    id: `trial-${Date.now()}`,
    seat: 'defense',
    charge,
    chargeSource: 'secret',
    prosecutor: { kind: 'leader', leaderId: leaderFound.id },
    defendant: { kind: 'family', characterId: criminalSubject.characterId },
    filedSeason: state.turnNumber,
    startsSeason: state.turnNumber + BALANCE.trials.npcInitiatedDelay,
    initialNpcStrength,
    consumedSecretIds: [secret.id],
    speakerId: state.family.find(c => c.isPlayer)?.id ?? criminalSubject.characterId,
  });
  return {
    patch: { secrets: secretsExposed, trials: [...(state.trials ?? []), newTrial] },
    logMsg: `You defy them. ${secret.flavorText} ${leaderFound.name} brings formal charges of ${charge} against ${accused?.name ?? 'your family'}.`,
  };
}
