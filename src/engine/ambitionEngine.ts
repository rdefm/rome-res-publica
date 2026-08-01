// ─── Ambition Engine ────────────────────────────────────────────────────────
// Ambition system rework. Pure functions only — no React/UI imports, no
// state mutation (every function here takes a GameState and returns a new
// value; gameStore.ts owns writing the result back).
//
// `survive_seasons` convention: the player/author authors `criterion.amount`
// as a DURATION ("N more seasons") when calling buildAmbition. buildAmbition
// is the single construction path (§2.4 of the rework spec) and normalizes
// that duration into an ABSOLUTE deadline turn number
// (state.turnNumber + duration) before it's ever stored on the resulting
// ActiveAmbition. This keeps checkCriterion/measureCriterion pure functions
// of (criterion, state) with no baseline dependency, exactly like the other
// eight criteria — and keeps getProgress's {current, target} on the same
// absolute axis as `baseline.value` for every criterion, which is what lets
// supersedeAmbition's progress-fraction formula (spec §2.3) stay uniform
// instead of special-casing one criterion.

import type { GameState } from '../state/gameStore';
import type { OfficeId } from '../models/office';
import type { RegionId } from '../models/theatre';
import type {
  ActiveAmbition,
  AmbitionBaseline,
  AmbitionCriterion,
  AmbitionCriterionId,
  AmbitionOffer,
  AmbitionProgress,
  AmbitionReward,
  AmbitionScope,
  AmbitionSource,
} from '../models/ambition';
import { BALANCE } from '../data/balance';
import { OFFICES, TRIBUNE_OFFICE } from '../data/offices';
import { REGIONS } from '../data/theatreMap';
import { ASSET_DEFINITIONS } from '../data/assetDefinitions';
import { LEGACY_DEFINITIONS } from '../data/legacyDefinitions';
import { getNextMilestone } from './legacyEngine';

// ─── Small helpers ──────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Applies a reward's numeric fields (denarii/fides/lifetimeDignitas) onto a
 *  resource slice. Shared by the completion and supersede write-back paths
 *  in turnSequencer.ts, which otherwise repeat the same "if the field is
 *  present, add it" shape for a full reward and a partial (supersede)
 *  reward alike. */
export function applyAmbitionReward(
  resources: { denarii: number; fides: number; lifetimeDignitas: number },
  reward: AmbitionReward,
): { denarii: number; fides: number; lifetimeDignitas: number } {
  return {
    denarii: reward.denarii ? resources.denarii + reward.denarii : resources.denarii,
    fides: reward.fides ? resources.fides + reward.fides : resources.fides,
    lifetimeDignitas: reward.lifetimeDignitas
      ? resources.lifetimeDignitas + reward.lifetimeDignitas
      : resources.lifetimeDignitas,
  };
}

function getOffice(officeId: OfficeId | undefined) {
  if (!officeId) return undefined;
  if (officeId === 'tribune') return TRIBUNE_OFFICE;
  return OFFICES.find(o => o.id === officeId);
}

function getOfficeTermSeasons(officeId: OfficeId): number {
  return getOffice(officeId)?.termSeasons ?? 4;
}

function officeLabel(officeId: OfficeId | undefined): string {
  return getOffice(officeId)?.name ?? officeId ?? 'office';
}

function regionLabel(regionId: RegionId | undefined): string {
  if (!regionId) return 'region';
  return REGIONS.find(r => r.id === regionId)?.name ?? regionId;
}

function assetLabel(assetId: string | undefined): string {
  if (!assetId) return 'an asset';
  return ASSET_DEFINITIONS.find(a => a.id === assetId)?.name ?? assetId;
}

function clanLabel(clanId: string | undefined, state: GameState): string {
  if (!clanId) return 'a clan';
  return state.clans.find(c => c.id === clanId)?.name ?? clanId;
}

/** Player-facing title for a criterion, shared by the builder's live preview
 *  (AmbitionBuilder.tsx) and direct-write/offer narrative-hook tokens
 *  (resourceEngine.ts's setAmbition:/offerAmbition:, ticket 05) — one
 *  phrasing table instead of two switch statements drifting apart. */
export function describeCriterionTitle(criterion: AmbitionCriterion, state: GameState): string {
  switch (criterion.id) {
    case 'resource_threshold':
      return `Hold ${criterion.amount ?? 0} ${criterion.resource === 'fides' ? 'Fides' : 'Denarii'}`;
    case 'office_held':
      return `Win the ${officeLabel(criterion.officeId)}`;
    case 'clan_standing':
      return `Reach ${criterion.amount ?? 0} Standing with the ${clanLabel(criterion.clanId, state)}`;
    case 'asset_tier':
      return `Own the ${assetLabel(criterion.assetId)} at Tier ${criterion.amount ?? 1}`;
    case 'client_count':
      return `Hold ${criterion.amount ?? 0} Clients`;
    case 'battles_won':
      return `Win ${criterion.amount ?? 0} Battles`;
    case 'region_control':
      return `Take ${regionLabel(criterion.regionId)}`;
    case 'survive_seasons':
      return `Keep the Gens Intact ${criterion.amount ?? 0} More Seasons`;
    case 'trial_won':
      return `Win ${criterion.amount ?? 0} Trials`;
    default:
      return 'Ambition';
  }
}

/** Whether `officeId` is currently held, and (when `assignedCharacterId` is
 *  given, i.e. a character-scope ambition) held specifically by that
 *  character. The game models only ONE office slot family-wide
 *  (GameState.currentOffice) and only the player character ever campaigns
 *  (gameStore.declareCampaign hardcodes campaigningCharacterId) — so
 *  `campaigningCharacterId` is the authoritative "who holds it" signal, not
 *  the largely-stale per-character `officeId` field. */
function isOfficeHeldBy(
  officeId: OfficeId | undefined,
  state: GameState,
  assignedCharacterId?: string,
): boolean {
  if (!officeId || state.currentOffice !== officeId) return false;
  if (!assignedCharacterId) return true;
  return state.campaigningCharacterId === assignedCharacterId;
}

function countTrialsWon(state: GameState): number {
  return state.trials.filter(
    t =>
      t.seat === 'prosecution' &&
      t.status === 'resolved' &&
      t.outcome !== undefined &&
      t.outcome !== 'acquitted' &&
      t.outcome !== 'dismissed',
  ).length;
}

/** `office_held`'s reward is a flat per-office baseline multiplied up when
 *  the win is a first for the (always-player) character and/or a first for
 *  the family — see spec §2.3. Shared by computeDifficulty and computeReward
 *  so there's one source of truth for the formula rather than two. */
function computeOfficeScore(officeId: OfficeId | undefined, state: GameState): number {
  if (!officeId) return 0;
  const base = BALANCE.ambitions.officeBaseline[officeId] ?? 0;
  const player = state.family.find(c => c.isPlayer);
  const firstForCharacter = !(player?.heldOffices ?? []).includes(officeId);
  const firstForFamily = !state.heldOffices.includes(officeId);
  let score = base;
  if (firstForCharacter) score *= BALANCE.ambitions.firstCharacterMult;
  if (firstForFamily) score *= BALANCE.ambitions.firstFamilyMult;
  return score;
}

// ─── Criterion checking / measurement ──────────────────────────────────────
// One measure function, two callers (the baseline snapshot at construction
// and every later progress/completion check) — this is what stops
// description/checker drift like the old system's great_orator/
// forge_alliance/grand_estate/survive_dynasty bugs (see the rework plan §0.2).

export function measureCriterion(
  criterion: AmbitionCriterion,
  state: GameState,
  assignedCharacterId?: string,
): number {
  switch (criterion.id) {
    case 'resource_threshold':
      return criterion.resource === 'fides' ? state.fides : state.denarii;
    case 'office_held':
      return isOfficeHeldBy(criterion.officeId, state, assignedCharacterId) ? 1 : 0;
    case 'clan_standing':
      return criterion.clanId ? (state.familyReputations[criterion.clanId] ?? 0) : 0;
    case 'asset_tier':
      return criterion.assetId
        ? (state.ownedAssets.find(a => a.definitionId === criterion.assetId)?.currentTier ?? 0)
        : 0;
    case 'client_count':
      return state.clients.length;
    case 'battles_won':
      return state.lifetimeBattlesWon;
    case 'region_control':
      return criterion.regionId && state.theatre.controllers[criterion.regionId] === 'rome' ? 1 : 0;
    case 'survive_seasons':
      return state.turnNumber;
    case 'trial_won':
      return countTrialsWon(state);
    default:
      return 0;
  }
}

export function checkCriterion(
  criterion: AmbitionCriterion,
  state: GameState,
  assignedCharacterId?: string,
): boolean {
  const current = measureCriterion(criterion, state, assignedCharacterId);
  if (criterion.id === 'office_held' || criterion.id === 'region_control') {
    return current >= 1;
  }
  return current >= (criterion.amount ?? 0);
}

// ─── Progress readout ───────────────────────────────────────────────────────

const DYNASTIC_ID_PREFIX = 'dynastic:';

function getDynasticProgress(ambition: ActiveAmbition, state: GameState): AmbitionProgress {
  const definitionId = ambition.id.slice(DYNASTIC_ID_PREFIX.length);
  const def = LEGACY_DEFINITIONS.find(d => d.id === definitionId);
  const obj = state.legacyObjectives.find(o => o.definitionId === definitionId);
  const current = obj?.currentValue ?? 0;
  const nextMilestone = obj ? getNextMilestone(obj) : null;
  return {
    current,
    target: nextMilestone?.threshold ?? current,
    label: def?.trackingUnit ?? 'progress',
  };
}

export function getProgress(ambition: ActiveAmbition, state: GameState): AmbitionProgress {
  if (ambition.scope === 'dynastic') return getDynasticProgress(ambition, state);

  const { criterion, assignedCharacterId } = ambition;
  const current = measureCriterion(criterion, state, assignedCharacterId);

  switch (criterion.id) {
    case 'office_held':
      return { current, target: 1, label: officeLabel(criterion.officeId) };
    case 'region_control':
      return { current, target: 1, label: regionLabel(criterion.regionId) };
    case 'resource_threshold':
      return {
        current,
        target: criterion.amount ?? 0,
        label: criterion.resource === 'fides' ? 'Fides' : 'Denarii',
      };
    case 'clan_standing':
      return { current, target: criterion.amount ?? 0, label: 'clan standing' };
    case 'asset_tier':
      return { current, target: criterion.amount ?? 0, label: 'asset tier' };
    case 'client_count':
      return { current, target: criterion.amount ?? 0, label: 'clients' };
    case 'battles_won':
      return { current, target: criterion.amount ?? 0, label: 'battles won' };
    case 'survive_seasons':
      return { current, target: criterion.amount ?? current, label: 'seasons survived' };
    case 'trial_won':
      return { current, target: criterion.amount ?? 0, label: 'trials won' };
    default:
      return { current, target: criterion.amount ?? 0, label: '' };
  }
}

// ─── Difficulty / reward math (spec §2.3) ──────────────────────────────────

function computeDeadlinePressure(seasonsAllowed: number): number {
  const { pressureBase, min, max } = BALANCE.ambitions.deadlinePressure;
  const safeSeasons = Math.max(1, seasonsAllowed);
  return clamp(pressureBase / safeSeasons, min, max);
}

function computeDeltaScore(criterion: AmbitionCriterion, baseline: AmbitionBaseline): number {
  if (criterion.id === 'region_control') {
    const { divisor } = BALANCE.ambitions.criteria.region_control;
    return clamp(Math.abs(1 - baseline.value) / divisor, 0, 1);
  }
  if (criterion.id === 'survive_seasons') {
    const { divisor } = BALANCE.ambitions.criteria.survive_seasons;
    const seasonsRequired = Math.max(0, (criterion.amount ?? baseline.value) - baseline.turnNumber);
    return clamp(seasonsRequired / divisor, 0, 1);
  }
  const key = criterion.id as Exclude<AmbitionCriterionId, 'office_held'>;
  const { divisor } = BALANCE.ambitions.criteria[key];
  const target = criterion.amount ?? 0;
  return clamp(Math.abs(target - baseline.value) / divisor, 0, 1);
}

/** delta-from-baseline × deadline-pressure for every criterion except
 *  `office_held`, which returns the flat office score instead (a binary
 *  office win has no "current standing" to measure a delta against — see
 *  computeOfficeScore). */
export function computeDifficulty(
  criterion: AmbitionCriterion,
  baseline: AmbitionBaseline,
  deadlineSeasons: number,
  state: GameState,
): number {
  if (criterion.id === 'office_held') {
    return computeOfficeScore(criterion.officeId, state);
  }
  const deadlinePressure = computeDeadlinePressure(deadlineSeasons);
  const deltaScore = computeDeltaScore(criterion, baseline);
  return deltaScore * deadlinePressure;
}

export function computeReward(
  difficultyScore: number,
  criterion: AmbitionCriterion,
  state: GameState,
): { reward: AmbitionReward; failureDignitas: number } {
  let dignitas: number;
  let fides: number;

  if (criterion.id === 'office_held') {
    dignitas = Math.round(computeOfficeScore(criterion.officeId, state));
    fides = 0;
  } else {
    const key = criterion.id as Exclude<AmbitionCriterionId, 'office_held'>;
    const base = BALANCE.ambitions.criteria[key];
    dignitas = Math.round(base.dignitas * difficultyScore);
    fides = Math.round(base.fides * difficultyScore);
  }

  const reward: AmbitionReward = { lifetimeDignitas: dignitas };
  if (fides > 0) reward.fides = fides;

  const failureDignitas = -Math.min(
    Math.round(dignitas * BALANCE.ambitions.failureRatio),
    BALANCE.ambitions.failureDignitasCap,
  );

  return { reward, failureDignitas };
}

// ─── Office election-deadline clamping (spec §2.3 / §0.18) ────────────────

/** seasonIndex the given (future or present) turn falls on, projected
 *  forward from `state`'s own turnNumber/seasonIndex — season order is
 *  strictly cyclic (['Spring','Summer','Autumn','Winter'], turnSequencer.ts),
 *  so this needs no simulation, just modular arithmetic. */
function seasonIndexAt(turn: number, state: GameState): number {
  return (((state.seasonIndex + (turn - state.turnNumber)) % 4) + 4) % 4;
}

function firstWinterAtOrAfter(minTurn: number, state: GameState): number {
  let turn = minTurn;
  while (seasonIndexAt(turn, state) !== 3) turn += 1;
  return turn;
}

const ELIGIBLE_ELECTION_WINDOWS = 4;

/** Only Winter election turns that are structurally reachable given
 *  `officeId`'s term length and (if the player family currently holds ANY
 *  office — this game models a single office slot family-wide, see
 *  isOfficeHeldBy's comment) that office's remaining term. Returns the next
 *  few reachable windows, not just one, so a deadline picker has real
 *  choices. */
export function nextEligibleElectionTurns(officeId: OfficeId, state: GameState): number[] {
  const results: number[] = [];
  let blockedUntilTurn = state.currentOffice !== null ? state.turnNumber + state.officeSeasons : state.turnNumber;
  let searchState = state;

  for (let i = 0; i < ELIGIBLE_ELECTION_WINDOWS; i++) {
    const minTurn = Math.max(blockedUntilTurn, searchState.turnNumber + 1);
    const winterTurn = firstWinterAtOrAfter(minTurn, searchState);
    results.push(winterTurn);
    blockedUntilTurn = winterTurn + getOfficeTermSeasons(officeId);
    searchState = { ...searchState, turnNumber: winterTurn, seasonIndex: 3 };
  }

  return results;
}

// ─── Construction ───────────────────────────────────────────────────────────

export interface BuildAmbitionInput {
  scope: AmbitionScope;
  source: AmbitionSource;
  title: string;
  /** For `survive_seasons`, `amount` is authored as a DURATION ("N more
   *  seasons") — see this file's header comment; every other criterion's
   *  `amount` is the absolute target the player set. */
  criterion: AmbitionCriterion;
  assignedCharacterId?: string;
  /** Required for every player/story/tutorial ambition (spec: deadlines are
   *  mandatory). Omit only for a `dynastic` row, which this function is
   *  never used to build (see projectDynasticAmbitions). */
  deadlineSeasons?: number;
  /** Defaults to true for source 'player', false otherwise — per-instance
   *  override for story/tutorial content (spec §1 "Refusal"). */
  refusable?: boolean;
  onCompleteEventId?: string;
  onFailEventId?: string;
}

function generateAmbitionId(): string {
  return `ambition-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function normalizeCriterionForConstruction(
  criterion: AmbitionCriterion,
  deadlineSeasons: number | undefined,
  state: GameState,
): AmbitionCriterion {
  if (criterion.id !== 'survive_seasons') return criterion;
  const seasonsRequested = criterion.amount ?? deadlineSeasons ?? 0;
  return { ...criterion, amount: state.turnNumber + seasonsRequested };
}

/** The single construction path for every ActiveAmbition regardless of
 *  origin — the player builder and direct-write story/tutorial effect
 *  strings both call this. Snapshots the baseline and freezes reward/
 *  failureDignitas; neither is ever recomputed later (spec §2.3/§2.4). */
export function buildAmbition(input: BuildAmbitionInput, state: GameState): ActiveAmbition {
  const criterion = normalizeCriterionForConstruction(input.criterion, input.deadlineSeasons, state);
  const baseline: AmbitionBaseline = {
    value: measureCriterion(criterion, state, input.assignedCharacterId),
    turnNumber: state.turnNumber,
  };
  const deadlineSeasons = input.deadlineSeasons ?? 0;
  const difficultyScore = computeDifficulty(criterion, baseline, deadlineSeasons, state);
  const { reward, failureDignitas } = computeReward(difficultyScore, criterion, state);

  return {
    id: generateAmbitionId(),
    scope: input.scope,
    source: input.source,
    title: input.title,
    criterion,
    baseline,
    assignedCharacterId: input.assignedCharacterId,
    status: 'active',
    turnSet: state.turnNumber,
    deadlineTurn: input.deadlineSeasons !== undefined ? state.turnNumber + input.deadlineSeasons : undefined,
    reward,
    failureDignitas,
    refusable: input.refusable ?? input.source === 'player',
    onCompleteEventId: input.onCompleteEventId,
    onFailEventId: input.onFailEventId,
  };
}

export interface BuildAmbitionOfferInput {
  scope: AmbitionScope;
  title: string;
  criterion: AmbitionCriterion;
  assignedCharacterId?: string;
  /** Duration, resolved to an absolute deadlineTurn only on accept
   *  (buildAmbition) — an offer is never baseline-snapshotted or
   *  reward-frozen (models/ambition.ts's AmbitionOffer doc comment). */
  deadlineSeasons?: number;
  onCompleteEventId?: string;
  onFailEventId?: string;
}

/** The single construction path for every AmbitionOffer, mirroring
 *  buildAmbition above — used by the store's offerAmbition action (narrative
 *  hook ticket 05). Unlike buildAmbition, this never touches baseline/
 *  reward/failureDignitas: nothing is measured or priced until the player
 *  actually accepts (acceptStoryAmbition → buildAmbition, spec §2.4). */
export function buildAmbitionOffer(input: BuildAmbitionOfferInput, state: GameState): AmbitionOffer {
  return {
    id: generateAmbitionId(),
    scope: input.scope,
    assignedCharacterId: input.assignedCharacterId,
    title: input.title,
    criterion: input.criterion,
    deadlineSeasons: input.deadlineSeasons,
    onCompleteEventId: input.onCompleteEventId,
    onFailEventId: input.onFailEventId,
    turnOffered: state.turnNumber,
  };
}

/** Progress toward an ambition's target, normalized 0..1 from its baseline —
 *  the same current/target measurement getProgress uses for the tablet's
 *  readout, expressed as a fraction. Shared by the Ambitiones leaf's
 *  progress bar and supersedeAmbition's partial-payout scaling below, so
 *  both read "how far along is this ambition" identically. */
export function getProgressFraction(ambition: ActiveAmbition, state: GameState): number {
  const { current, target } = getProgress(ambition, state);
  const span = target - ambition.baseline.value;
  return span === 0 ? 0 : clamp((current - ambition.baseline.value) / span, 0, 1);
}

// ─── Graceful early termination (spec §2.3 "superseded") ──────────────────

/** Shared "ended early, not a failure" path — called both when a
 *  direct-write targets an already-occupied slot and by tickAmbitions' own
 *  character-death guard below. Pays out a reward scaled to the ambition's
 *  progress fraction at the moment of interruption (using the exact same
 *  current/target measurement getProgress uses for the tablet's readout);
 *  never applies failureDignitas — this isn't the player's fault. */
export function supersedeAmbition(
  ambition: ActiveAmbition,
  state: GameState,
): { ambition: ActiveAmbition; partialReward: AmbitionReward } {
  const progressFraction = getProgressFraction(ambition, state);

  const partialReward: AmbitionReward = {};
  if (ambition.reward.lifetimeDignitas !== undefined) {
    partialReward.lifetimeDignitas = Math.round(ambition.reward.lifetimeDignitas * progressFraction);
  }
  if (ambition.reward.fides !== undefined) {
    partialReward.fides = Math.round(ambition.reward.fides * progressFraction);
  }
  if (ambition.reward.denarii !== undefined) {
    partialReward.denarii = Math.round(ambition.reward.denarii * progressFraction);
  }

  return {
    ambition: { ...ambition, status: 'superseded', turnResolved: state.turnNumber },
    partialReward,
  };
}

/** The active ambition (if any) occupying a family/character slot — shared
 *  lookup for both the eviction path below and the offer-staging occupancy
 *  guard, so "what does this slot currently hold" is answered identically
 *  everywhere it's asked. */
export function findActiveAmbitionInSlot(
  ambitions: ActiveAmbition[],
  scope: AmbitionScope,
  assignedCharacterId: string | undefined,
): ActiveAmbition | undefined {
  return ambitions.find(a =>
    a.status === 'active' && a.scope === scope &&
    (scope !== 'character' || a.assignedCharacterId === assignedCharacterId)
  );
}

/** Shared "force-evict whatever's in this slot" step for a direct-write
 *  (spec §2.3's slot-collision rule): supersedes the occupant (if any) and
 *  folds its partial reward into `resources`. Used by both the store's
 *  setAmbition action and the setAmbition: effect-string token so the two
 *  producers of a direct write can't drift on how eviction behaves. Returns
 *  `resources` unchanged (same object) when the slot was already empty. */
export function evictOccupantForDirectWrite(
  ambitions: ActiveAmbition[],
  scope: AmbitionScope,
  assignedCharacterId: string | undefined,
  resources: { denarii: number; fides: number; lifetimeDignitas: number },
  state: GameState,
): {
  ambitions: ActiveAmbition[];
  resources: { denarii: number; fides: number; lifetimeDignitas: number };
  evicted?: ActiveAmbition;
} {
  const occupant = findActiveAmbitionInSlot(ambitions, scope, assignedCharacterId);
  if (!occupant) return { ambitions, resources };

  const { ambition: superseded, partialReward } = supersedeAmbition(occupant, state);
  return {
    ambitions: ambitions.map(a => (a.id === occupant.id ? superseded : a)),
    resources: applyAmbitionReward(resources, partialReward),
    evicted: occupant,
  };
}

// ─── Seasonal tick ──────────────────────────────────────────────────────────

export interface TickAmbitionsResult {
  updated: ActiveAmbition[];
  completed: ActiveAmbition[];
  failed: ActiveAmbition[];
  superseded: { ambition: ActiveAmbition; partialReward: AmbitionReward }[];
}

/** Resolves completion and deadline failure for every active ambition, and
 *  separately (one guard, not three death-site hooks — spec §0.19) supersedes
 *  any active character-scope ambition whose assignedCharacterId no longer
 *  resolves to a living family member. `dynastic` rows are never passed in
 *  here — they're a read-only projection (projectDynasticAmbitions), not
 *  stored/ticked state. */
export function tickAmbitions(
  ambitions: ActiveAmbition[],
  state: GameState,
  turnNumber: number,
): TickAmbitionsResult {
  const updated: ActiveAmbition[] = [];
  const completed: ActiveAmbition[] = [];
  const failed: ActiveAmbition[] = [];
  const superseded: { ambition: ActiveAmbition; partialReward: AmbitionReward }[] = [];

  for (const ambition of ambitions) {
    if (ambition.status !== 'active') {
      updated.push(ambition);
      continue;
    }

    if (
      ambition.scope === 'character' &&
      ambition.assignedCharacterId &&
      !state.family.some(c => c.id === ambition.assignedCharacterId)
    ) {
      const result = supersedeAmbition(ambition, state);
      superseded.push(result);
      updated.push(result.ambition);
      continue;
    }

    if (checkCriterion(ambition.criterion, state, ambition.assignedCharacterId)) {
      const done: ActiveAmbition = { ...ambition, status: 'completed', turnResolved: turnNumber };
      completed.push(done);
      updated.push(done);
      continue;
    }

    if (ambition.deadlineTurn !== undefined && turnNumber >= ambition.deadlineTurn) {
      const failedAmbition: ActiveAmbition = { ...ambition, status: 'failed', turnResolved: turnNumber };
      failed.push(failedAmbition);
      updated.push(failedAmbition);
      continue;
    }

    updated.push(ambition);
  }

  return { updated, completed, failed, superseded };
}

// ─── Dynastic projection (spec §2.6) ───────────────────────────────────────

/** Legacy Objectives stay a fully separate, live system (LEGACY_DEFINITIONS/
 *  incrementLegacy/computeLegacyBonuses/legacyObjectives — untouched, five
 *  live call sites plus the `midas` achievement read depend on them). This
 *  turns the current legacyObjectives state into read-only `dynastic`-scope
 *  ActiveAmbition rows purely for display on the Ambitiones leaf — nothing
 *  here is ever stored back into GameState.ambitions. */
export function projectDynasticAmbitions(state: GameState): ActiveAmbition[] {
  return state.legacyObjectives.map(obj => {
    const def = LEGACY_DEFINITIONS.find(d => d.id === obj.definitionId);
    return {
      id: `${DYNASTIC_ID_PREFIX}${obj.definitionId}`,
      scope: 'dynastic',
      source: 'dynastic',
      title: def?.title ?? obj.definitionId,
      // Dynastic rows are read-only projections of legacyObjectives, never
      // criterion-driven — this is a structural placeholder only.
      // getProgress/checkCriterion special-case scope === 'dynastic' before
      // ever reading it (see getDynasticProgress above).
      criterion: { id: 'survive_seasons' as AmbitionCriterionId },
      baseline: { value: 0, turnNumber: state.turnNumber },
      status: 'active',
      turnSet: state.turnNumber,
      reward: {},
      failureDignitas: 0,
      refusable: false,
    };
  });
}
