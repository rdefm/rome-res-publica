// ─── War Engine ──────────────────────────────────────────────────────────────
// Chunk M9 — the strategic warScore wrapper around set-piece battles. Pure
// functions only (no store access) — matches troopEngine.ts/trialEngine.ts's
// existing "type-only GameState import" convention. Uses plain Math.random
// by default (injectable for tests), same as every other non-battle
// strategic-layer engine (musterEngine.offerableLegates, etc.) — invariant 2
// ("every battle takes an RNG seed") is scoped to the tactical battle layer,
// not this strategic one.
//
// ── Scope decision (documented per the plan's §0 instruction) ──────────────
// GameState holds `wars: WarState[]` (not a single `war`), per an explicit
// product decision to support multiple concurrent wars as more regions are
// added later. This chunk only ever creates ONE war via its debug entry
// point (a major 'carthage' war) — provincial revolts staying on the
// existing (already-working) officer-volunteer suppression flow untouched.
// The array shape means folding revolts in later is additive, not a schema
// migration — see models/war.ts's own header comment, which anticipated
// exactly this.
//
// Neither "declare war" nor the personal-commander War Room have a real
// trigger anywhere in this codebase today (verified: provinceEngine.ts sets
// `warDeclarationAvailable` but nothing consumes it; ProvinciaeScreen.tsx
// wires the War Room's commit handler to a no-op). So — per the plan's own
// explicit allowance — a war starts/ends via a debug action only
// (gameStore.startWar/endWar); Phase 3A supplies the real trigger. The
// campaigning army is always the player paterfamilias's own
// raisedLegions/veterans (musterEngine.musterArmy), matching
// startSandboxBattle's existing precedent — there's no other reliably-wired
// "which army is on campaign" signal to hook into.

import type { GameState } from '../state/gameStore';
import type { WarState, SetPieceOffer, WarScale, TreatyState, TreatyTerm, WarPhase, WarTerminalOutcome } from '../models/war';
import type { EventInstance } from '../models/event';
import type { BattleUnit, UnitClass } from '../models/battle';
import type { Bill } from '../models/bill';
import { BALANCE } from '../data/balance';
import { WAR_SITES } from '../data/warSites';
import { ENEMY_GENERAL_LIST, type GeneralProfile } from '../data/enemyGenerals';
import { musterArmy } from './battle/musterEngine';
import { injectNoticeEvent } from './eventEngine';
import { applyEffectString } from './resourceEngine';
import { TREATY_TERMS, getTreatyTerm } from '../data/treatyTerms';
import { buildProvinceState, getProvinceDefinition } from '../data/provinceDefinitions';

// ─── Small helpers ───────────────────────────────────────────────────────────

function clampScore(v: number): number {
  return Math.min(100, Math.max(-100, v));
}

/** Moves `current` toward `target` by up to `step`, never overshooting. */
function moveToward(current: number, step: number, target: number): number {
  if (current > target) return Math.max(target, current - step);
  if (current < target) return Math.min(target, current + step);
  return current;
}

function pickWeighted<T extends string>(weights: Partial<Record<T, number>>, rng: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + (w ?? 0), 0);
  let roll = rng() * total;
  for (const [id, w] of entries) {
    roll -= w ?? 0;
    if (roll <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

// ─── Desperation tier (M1's "desperation/overextension modifier
// recomputation" — exposed as a pure function of warScore so callers can
// derive BALANCE.war.desperation's modifiers on demand; wiring every
// downstream consumer (levy cost, wing def, stratagem hand size, upkeep) is
// explicitly deferred past this "provisional scheduler" chunk — see the
// seam comment below). Also the basis for threshold-crossing notices. ────

export type DesperationTier = 'none' | 'sue' | 'forced' | 'dictate';
const TIER_ORDER: Record<DesperationTier, number> = { none: 0, sue: 1, forced: 2, dictate: 3 };

export function getDesperationTier(warScore: number): DesperationTier {
  const abs = Math.abs(warScore);
  const t = BALANCE.war.thresholds;
  if (abs >= t.dictate) return 'dictate';
  if (abs >= t.forced) return 'forced';
  if (abs >= t.sue) return 'sue';
  return 'none';
}

interface ThresholdCrossing {
  tier: DesperationTier;
  /** true = Rome winning big (positive warScore) crossed upward. */
  winning: boolean;
  headline: string;
}

function buildThresholdHeadline(tier: DesperationTier, winning: boolean): string {
  if (winning) {
    if (tier === 'sue') return 'Carthage sends feelers for peace.';
    if (tier === 'forced') return 'Carthage may soon be forced to terms.';
    return 'Carthage lies open to dictated terms.';
  }
  if (tier === 'sue') return 'Rome may need to sue for peace.';
  if (tier === 'forced') return 'Rome may be forced to the table.';
  return 'Rome stands at the brink — terms may be dictated to us.';
}

/** Only fires on a NEWLY higher-magnitude band (escalation), never on
 *  de-escalation back through a threshold — avoids notice spam on drift
 *  oscillation near a boundary. */
function detectThresholdCrossing(before: number, after: number): ThresholdCrossing | null {
  const tBefore = TIER_ORDER[getDesperationTier(before)];
  const tAfter = TIER_ORDER[getDesperationTier(after)];
  if (tAfter <= tBefore) return null;
  const tier = getDesperationTier(after);
  const winning = after > 0;
  return { tier, winning, headline: buildThresholdHeadline(tier, winning) };
}

function buildThresholdNotice(playerId: string, turnNumber: number, crossing: ThresholdCrossing): EventInstance {
  return injectNoticeEvent('evt-war-threshold-notice', turnNumber, playerId, {
    title: crossing.winning ? 'The Balance Tips' : 'The War Turns Against Us',
    bodyText: crossing.headline,
  });
}

// ─── Phase 3, Chunk P3-A — Historical Ripeness ──────────────────────────────
// Purely additive on top of the desperation-tier system above — see
// BALANCE.war.ripeness's header comment and models/war.ts's WarPhase/
// WarTerminalOutcome doc comment for the full reconciliation. Ripeness reads
// GameState.year directly (the calendar), not any one war's ignitedYear —
// it represents how far into Rome's whole historical conflict window we
// are, not how long a particular WarState has been active.

/** 0 (264 BC, war effectively cannot be decisively won/lost/exhausted yet)
 *  → 1 (241 BC and beyond, thresholds fully relaxed). `year` is
 *  GameState.year — negative, magnitude counting DOWN from startYear as
 *  play proceeds (see turnSequencer.ts's rollover comment). */
export function computeRipeness(year: number): number {
  const r = BALANCE.war.ripeness;
  const absYear = Math.abs(year);
  if (absYear <= r.historicalEndYear) return 1;
  const elapsed = r.startYear - absYear;
  const span = r.fullYears - r.floorYears;
  return Math.max(0, Math.min(1, (elapsed - r.floorYears) / span));
}

function interpolateThreshold(hard: number, easy: number, ripeness: number): number {
  return hard + (easy - hard) * ripeness;
}

export interface TerminalThresholds {
  /** warScore at/above which a concluded 'major' war reads as Victory. */
  victory: number;
  /** warScore at/below which a concluded 'major' war reads as Humbled (negative). */
  humbled: number;
}

/** Interpolates BALANCE.war.ripeness.thresholds' hard→easy pairs by ripeness.
 *  At ripeness 0 these sit at their `hard` (extreme) values; at ripeness 1,
 *  their `easy` (moderate) values. */
export function terminalThresholds(ripeness: number): TerminalThresholds {
  const t = BALANCE.war.ripeness.thresholds;
  return {
    victory: interpolateThreshold(t.victory.hard, t.victory.easy, ripeness),
    humbled: interpolateThreshold(t.humbled.hard, t.humbled.easy, ripeness),
  };
}

/** Cosmetic/agenda-flavour narrative stage — no mechanic gates on this
 *  beyond copy selection (per the Phase 3 plan's invariant 2). */
export function phaseForYear(year: number, warScore: number): WarPhase {
  const r = BALANCE.war.ripeness;
  const elapsed = r.startYear - Math.abs(year);
  if (elapsed < r.openingPhaseYears) return 'opening';
  if (computeRipeness(year) >= r.ripePhaseThreshold) return 'ripe';
  if (Math.abs(warScore) < r.grindingWarScoreBand) return 'grinding';
  return 'escalation';
}

/** Classifies how a 'major' war's conclusion reads, once the EXISTING
 *  treaty/desperation-tier system (above) has actually ended it — this
 *  function does not itself end a war or gate anything; it only tags the
 *  ending processWarSeason already produced. `dictatedAgainstRome` is true
 *  only for the Rome-as-loser dictate-tier auto-ratify path (§7 below),
 *  which always reads as Humbled regardless of the ripeness-scaled bounds —
 *  "terms dictated to us" is unambiguous. Everything else (a Senate-
 *  ratified treaty, at any stage) is classified by where the final warScore
 *  landed relative to terminalThresholds(ripeness): Victory or Humbled if
 *  it cleared one of the decisive bounds, Exhaustion otherwise (a
 *  negotiated peace that wasn't a blowout either way). */
export function classifyTerminalOutcome(
  finalWarScore: number,
  ripeness: number,
  dictatedAgainstRome: boolean,
): NonNullable<WarTerminalOutcome> {
  if (dictatedAgainstRome) return 'humbled';
  const th = terminalThresholds(ripeness);
  if (finalWarScore >= th.victory) return 'victory';
  if (finalWarScore <= th.humbled) return 'humbled';
  return 'exhaustion';
}

// ─── Skirmish drift ──────────────────────────────────────────────────────────

function rollSkirmishDrift(playerArmyStrength: number, playerMartial: number, rng: () => number): number {
  const w = BALANCE.war;
  const sk = w.skirmish;
  const magnitude = Math.floor(rng() * (w.skirmishDriftMax - w.skirmishDriftMin + 1)) + w.skirmishDriftMin;
  const strengthSignal = playerArmyStrength >= sk.strengthBaseline ? 1 : -1;
  const martialSignal = playerMartial >= sk.martialBaseline ? 1 : -1;
  const sign = (strengthSignal + martialSignal) >= 0 ? 1 : -1;
  return sign * magnitude;
}

// ─── Enemy army generation (consumed only by the seam below) ───────────────

function generateEnemyArmy(profile: GeneralProfile, warScore: number, scale: WarScale, rng: () => number): BattleUnit[] {
  const so = BALANCE.war.setPieceOffer;
  // Rome winning (positive warScore) faces a WEAKER enemy; a losing Rome
  // faces a growing one — mirrors BALANCE.war.desperation's framing (the
  // losing side gets buffs; here the winning side gets an easier scheduler
  // roll instead of a battle-time buff, since the enemy army is generated
  // once, at offer time).
  const rawCohorts = so.baseCohorts - warScore / so.warScoreDivisor;
  const scaledCohorts = rawCohorts * BALANCE.war.scaleArmyMultiplier[scale];
  const cohortCount = Math.round(Math.min(so.maxCohorts, Math.max(so.minCohorts, scaledCohorts)));

  const weights = Object.entries(profile.armyComposition) as [UnitClass, number][];
  const totalWeight = weights.reduce((s, [, w]) => s + w, 0);
  const units: BattleUnit[] = [];
  let allocated = 0;
  weights.forEach(([unitClass, weight], i) => {
    const isLast = i === weights.length - 1;
    const count = isLast ? Math.max(0, cohortCount - allocated) : Math.round((cohortCount * weight) / totalWeight);
    allocated += count;
    for (let n = 0; n < count; n++) {
      units.push({
        id: `enemy-${profile.id}-${unitClass}-${n}-${Math.floor(rng() * 1e9)}`,
        unitClass,
        strength: 100,
        veterancy: 'trained',
        loyalty: 60,
        elephantSteady: false,
      });
    }
  });
  return units;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── THE SEAM ─────────────────────────────────────────────────────────────────
// scheduleSetPiece is the ONLY function anywhere in this codebase that may
// construct a SetPieceOffer. Phase 3A's war script replaces this single
// exported function wholesale with script-driven scheduling — nothing else
// (processWarSeason included) may build offer generation logic directly;
// everything else just calls this and reacts to its result.
// ─────────────────────────────────────────────────────────────────────────────

export function scheduleSetPiece(
  state: GameState,
  war: WarState,
  rng: () => number = Math.random,
  opts: { forceRoll?: boolean } = {},
): SetPieceOffer | null {
  if (!war.active) return null;

  const player = state.family.find(c => c.isPlayer);
  const hasArmy = !!player && ((player.raisedLegions?.length ?? 0) + (player.veterans?.length ?? 0)) > 0;
  if (!hasArmy) return null;

  const so = BALANCE.war.setPieceOffer;
  if (!opts.forceRoll) {
    if (state.turnNumber - war.lastSetPieceTurn < so.minSpacingTurns) return null;
    if (rng() >= so.chancePerSeason) return null;
  }

  const site = WAR_SITES[Math.floor(rng() * WAR_SITES.length)];
  const terrainId = pickWeighted(site.terrainWeights, rng);
  const terrain = BALANCE.battle.terrains[terrainId];

  // "General chosen round-robin from enemyGenerals.ts" — deterministic
  // cycling keyed off the current turn (no extra persisted counter needed).
  const general = ENEMY_GENERAL_LIST[state.turnNumber % ENEMY_GENERAL_LIST.length];

  const enemyArmy = generateEnemyArmy(general, war.warScore, war.scale, rng);

  return {
    id: `offer-${war.id}-${state.turnNumber}-${Math.floor(rng() * 1e9)}`,
    siteName: site.name,
    terrainId: terrain.id,
    enemyArmy,
    enemyGeneralId: general.id,
    expiresTurn: state.turnNumber + so.expiryTurns,
  };
}

// ─── Peace: Negotiation & Senate Ratification (Chunk M10) ──────────────────
// src/data/treatyTerms.ts holds the term catalog (content only); every piece
// of logic around it lives here rather than in a new engine file — the
// plan's M10 "Files to create" list is just treatyTerms.ts +
// NegotiationScreen.tsx, and the plan's own Cross-Chunk Notes say
// turnSequencer.ts is touched only by M9's one step, not again by M10. So
// treaty resolution (a tabled bill passing/failing, or the dictate-tier
// Rome-as-loser auto-ratify) is detected from *inside* processWarSeason,
// which turnSequencer.ts already calls once per season — see this section's
// bottom half and processWarSeason's step 6/7 below for how that works
// without a new turnSequencer step. turnSequencer.ts's existing M9 merge
// block is widened (not replaced) to apply the resulting statePatch.

export type TreatySide = 'rome' | 'enemy';

/** Which side is currently losing this war, from warScore's sign. Ties
 *  (warScore === 0) have no loser — callers gate on getDesperationTier
 *  first, which is 'none' at 0 regardless. */
export function losingSide(warScore: number): TreatySide | null {
  if (warScore > 0) return 'enemy';
  if (warScore < 0) return 'rome';
  return null;
}

/** Budget = |warScore| − thresholdBase + treatyBudgetAllowance[tier]. See
 *  BALANCE.war.treaty's header comment for why this is 0 at the sue tier
 *  itself (matching the plan's "sue tier is accept/refuse only, not real
 *  term-shopping" framing). */
export function computeTreatyBudget(warScore: number): number {
  const t = BALANCE.war.treaty;
  const tier = getDesperationTier(warScore);
  if (tier === 'none') return 0;
  return Math.max(0, Math.abs(warScore) - t.thresholdBase + t.treatyBudgetAllowance[tier]);
}

/** Total warScore-budget price of a term package. The face-saver term's
 *  price is negative, so including it reduces this below the sum of
 *  everything else. */
export function computePackagePrice(termIds: string[]): number {
  return termIds.reduce((sum, id) => sum + (getTreatyTerm(id)?.warScorePrice ?? 0), 0);
}

// ─── Faction reaction → bill support ────────────────────────────────────────
// Parallel to billTemplates.ts's calcRomeStatVoteModifier (same ±clamp
// shape) — reuses the clan bias fields per the plan's explicit instruction,
// rather than a wholly new mechanism. FIRST-PASS/UNVERIFIED weighting, like
// every other M10 constant (see BALANCE.war.treaty's header comment).

export function calcFactionReactionModifier(termIds: string[], state: GameState): number {
  const terms = termIds.map(getTreatyTerm).filter((t): t is TreatyTerm => !!t);
  if (terms.length === 0) return 0;

  const leaders = (state.clans ?? []).flatMap(c => c.leaders);
  const optimatesCount = leaders.filter(l => l.bias === 'optimates').length;
  const popularesCount = leaders.filter(l => l.bias === 'populares').length;

  const totalOptimates = terms.reduce((s, t) => s + t.factionReaction.optimates, 0);
  const totalPopulares = terms.reduce((s, t) => s + t.factionReaction.populares, 0);

  // Each faction's pull on the vote scales with how many clan leaders hold
  // that bias, plus the existing global optimatesRel/popularesRel dial —
  // a faction that's both numerous AND already well-disposed reacts hardest.
  const optimatesWeight = (optimatesCount + Math.max(0, state.optimatesRel) / 20) / 5;
  const popularesWeight = (popularesCount + Math.max(0, state.popularesRel) / 20) / 5;

  const raw = totalOptimates * optimatesWeight + totalPopulares * popularesWeight;
  const clamp = BALANCE.war.treaty.factionReactionClamp;
  return Math.max(-clamp, Math.min(clamp, Math.round(raw)));
}

// ─── AI term composition ─────────────────────────────────────────────────────

/** Sue-tier AI offer: the losing side (when it's the AI) proposes a small,
 *  cheap package the player just accepts/refuses — no term shopping. Higher
 *  aggression generals offer less (fewer/cheaper terms); cautious ones are
 *  more conciliatory. */
export function composeAiOffer(general: GeneralProfile, rng: () => number = Math.random): string[] {
  const count = BALANCE.war.treaty.aiOfferTermCount;
  const affordable = TREATY_TERMS
    .filter(t => t.warScorePrice >= 0 && t.warScorePrice <= 6)
    .sort(() => rng() - 0.5);
  const take = general.aggression >= 0.5 ? Math.max(1, count - 1) : count;
  return affordable.slice(0, take).map(t => t.id);
}

/** Forced/dictate-tier Rome-as-loser composition: the AI spends up to its
 *  budget, weighted by general aggression — an aggressive general spends the
 *  whole budget (including Sicily, if affordable); a cautious one leaves
 *  budget on the table and favours the face-saver clause. */
export function composeAiTreaty(budget: number, general: GeneralProfile, rng: () => number = Math.random): string[] {
  const shuffled = [...TREATY_TERMS].sort(() => rng() - 0.5);
  const spendCap = general.aggression >= 0.5 ? budget : Math.round(budget * 0.7);
  const picked: string[] = [];
  let spent = 0;
  for (const term of shuffled) {
    if (term.mutuallyExclusiveWith?.some(id => picked.includes(id))) continue;
    if (spent + term.warScorePrice > spendCap) continue;
    picked.push(term.id);
    spent += term.warScorePrice;
  }
  return picked;
}

// ─── Effect application ──────────────────────────────────────────────────────

/** Applies a resolved treaty's full effect set: the generic numeric/flag
 *  parts (via applyEffectString — same parser every other bill uses) plus
 *  the war-end fields that don't fit that vocabulary (province transfer,
 *  prisoner release, the face-saver's loser-dignity grant). `winner` is
 *  which side WON the war this treaty ends (not who initiated it) —
 *  determines whether each term's effectsAsWinner or effectsAsLoser applies. */
export function applyTreatyEffects(
  termIds: string[],
  state: GameState,
  winner: TreatySide,
): Partial<GameState> {
  const terms = termIds.map(getTreatyTerm).filter((t): t is TreatyTerm => !!t);
  let patch: Partial<GameState> = {};
  let working = state;

  for (const term of terms) {
    const effectStr = winner === 'rome' ? term.effectsAsWinner : term.effectsAsLoser;
    if (!effectStr) continue;
    const stepPatch = applyEffectString(effectStr, working);
    patch = { ...patch, ...stepPatch };
    working = { ...working, ...stepPatch };
  }

  // Face-saver: the LOSING side's standing commander gets the dignity grant.
  // Rome's "standing commander" is always the player paterfamilias — see
  // this file's header comment (musterEngine's existing precedent).
  if (winner === 'enemy') {
    const faceSaver = terms.find(t => t.warEndFlags?.faceSaverLoserDignitas);
    if (faceSaver?.warEndFlags?.faceSaverLoserDignitas) {
      patch.lifetimeDignitas = (patch.lifetimeDignitas ?? working.lifetimeDignitas) + faceSaver.warEndFlags.faceSaverLoserDignitas;
    }
  }

  // Province cession — only when Rome is the winner. No mechanic exists for
  // Rome losing a province it already holds, so the loser-side mirror of a
  // cession term is dignity/imperium loss only (effectsAsLoser, above).
  if (winner === 'rome') {
    const provinceIds = [...new Set(terms.flatMap(t => t.warEndFlags?.provinceTransferToRome ?? []))];
    const newProvinces = provinceIds
      .filter(id => !working.provinces.some(p => p.id === id))
      .map(getProvinceDefinition)
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map(buildProvinceState);
    if (newProvinces.length > 0) {
      patch.provinces = [...(patch.provinces ?? working.provinces), ...newProvinces];
    }
  }

  // Prisoner return — symmetric, applies regardless of who won.
  if (terms.some(t => t.warEndFlags?.prisonerReturn)) {
    const family = patch.family ?? working.family;
    patch.family = family.map(c => (c.captivity ? { ...c, captivity: null } : c));
  }

  return patch;
}

function capitalizeEnemyId(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Composes the Bill pushed into state.bills when a package is tabled
 *  (gameStore.tableTreaty). Its own passEffect/failEffect only carry the
 *  SIMPLE top-level numeric consequences the generic bill pipeline already
 *  applies every season (a flat crisis-war easing on pass; the negotiating
 *  consul's dignitas hit on fail) — the real term effects (denarii,
 *  province, prisoners, the nested war.warScore penalty) are applied by
 *  applyTreatyEffects via processWarSeason's detection below, never through
 *  the generic per-bill loop, to avoid double-applying anything. */
export function buildTreatyBill(war: WarState, termIds: string[], state: GameState, winner: TreatySide): Bill {
  const t = BALANCE.war.treaty;
  const enemyLabel = capitalizeEnemyId(war.enemyId);
  const winnerLabel = winner === 'rome' ? 'Rome' : enemyLabel;
  const price = computePackagePrice(termIds);

  return {
    id: `treaty-${war.id}-${state.turnNumber}`,
    name: `Treaty with ${enemyLabel}`,
    desc: `A negotiated peace with ${enemyLabel}, favouring ${winnerLabel}. ${termIds.length} term(s) — package price ${price}.`,
    type: 'military',
    support: calcFactionReactionModifier(termIds, state),
    turnsLeft: t.ratificationTurnsLeft,
    passEffect: 'crisis-war-8',
    failEffect: `lifetimeDignitas${t.failNegotiatingConsulDignitasPenalty}`,
    playerSubmitted: true,
    repealable: false,
  };
}

/** Near-duplicate of turnSequencer.ts's private buildTriumphBill, adapted
 *  for a war-ending treaty rather than a province campaign — deliberately
 *  NOT imported from turnSequencer.ts, which itself imports processWarSeason
 *  from this file; importing back would create a circular module
 *  dependency. Kept in sync by hand (small, stable shape). */
function buildWarTriumphBill(character: GameState['family'][0], state: GameState, war: WarState): Bill {
  const baseSupport = 10 + Math.round(character.skills.martial / 2);
  return {
    id: `triumph-${character.id}-${state.year}`,
    name: `Triumph for ${character.name}`,
    desc: `A petition to honour ${character.name}'s victory over ${capitalizeEnemyId(war.enemyId)} with a Triumph.`,
    passEffect: `lifetimeDignitas+20|fides+15|plebs+5|crisis-war-5|setFlag:triumph-granted-${character.id}:true`,
    failEffect: `fides-5|setFlag:triumph-denied-${character.id}:true`,
    turnsLeft: 4,
    support: baseSupport,
    type: 'military',
    repealable: false,
    playerSubmitted: false,
  };
}

// ─── processWarSeason — the turnSequencer hook ──────────────────────────────

export interface WarSeasonResult {
  wars: WarState[];
  /** Headline strings — the caller pushes these into turnSequencer's
   *  `events` array (which becomes SeasonLedger.headlines via gameStore.
   *  endSeason's existing diff-capture; no separate ledger plumbing needed). */
  events: string[];
  /** Threshold-crossing notices — injected into pendingEvents by the caller. */
  noticeEvents: EventInstance[];
  /** Accumulated across all wars this season (declines/expiries only). */
  lifetimeDignitasDelta: number;
  /** M10 — accumulated GameState patch from any treaty that resolved (pass,
   *  fail, or dictate-tier auto-ratify) this season: denarii, family
   *  (prisoner release), provinces (Sicily cession), bills (a triumph
   *  petition), lifetimeDignitas (face-saver). P3-A additionally sets
   *  `pendingEpilogue` here when a 'major' war concludes this season (see
   *  classifyTerminalOutcome) — unconsumed until a future epilogue chunk.
   *  Empty object when nothing resolved. Applied by turnSequencer.ts's
   *  existing M9 step (widened, not replaced, for M10/P3-A — see that
   *  file's comment at the call site). */
  statePatch: Partial<GameState>;
}

function winnerFromWarScore(warScore: number): TreatySide {
  return warScore >= 0 ? 'rome' : 'enemy';
}

export function processWarSeason(state: GameState, rng: () => number = Math.random): WarSeasonResult {
  const events: string[] = [];
  const noticeEvents: EventInstance[] = [];
  let lifetimeDignitasDelta = 0;
  let statePatch: Partial<GameState> = {};

  const player = state.family.find(c => c.isPlayer) ?? null;
  const playerId = player?.id ?? 'pc-1';
  const playerArmy = player ? musterArmy(player) : [];
  const playerArmyStrength = playerArmy.reduce((s, u) => s + u.strength, 0);
  const playerMartial = player?.skills.martial ?? 0;
  const so = BALANCE.war.setPieceOffer;
  const t = BALANCE.war.treaty;

  const wars = (state.wars ?? []).map(war => {
    if (!war.active) return war;
    let next: WarState = { ...war };
    const beforeScore = next.warScore;

    // "General chosen round-robin from enemyGenerals.ts" — same
    // deterministic cycling scheduleSetPiece uses, reused here for any
    // AI term composition this war needs this season.
    const general = ENEMY_GENERAL_LIST[state.turnNumber % ENEMY_GENERAL_LIST.length];

    // 1. Skirmish drift.
    next.warScore = clampScore(next.warScore + rollSkirmishDrift(playerArmyStrength, playerMartial, rng));

    // 2. Weariness — after wearinessAfterTurns, warScore erodes toward 0.
    const turnsSinceStart = state.turnNumber - next.startedTurn;
    if (turnsSinceStart > BALANCE.war.wearinessAfterTurns) {
      next.warScore = moveToward(next.warScore, BALANCE.war.wearinessDriftPerSeason, 0);
    }
    next.weariness += 1;

    // 2b. Phase 3, Chunk P3-A — cosmetic phase recompute. No mechanic reads
    // this beyond a future chunk's agenda copy (see WarPhase's doc comment).
    next.phase = phaseForYear(state.year, next.warScore);

    // 3. Threshold-crossing notice (also where desperation's tier changes
    // become visible to the player, per getDesperationTier above). When
    // Rome just crossed INTO the sue tier as the WINNER (enemy losing), the
    // losing AI side "initiates" per the plan — auto-generate its minor
    // offer here rather than waiting on a separate player action.
    const crossing = detectThresholdCrossing(beforeScore, next.warScore);
    if (crossing) {
      noticeEvents.push(buildThresholdNotice(playerId, state.turnNumber, crossing));
      events.push(`War with ${next.enemyId}: ${crossing.headline}`);

      if (crossing.tier === 'sue' && crossing.winning && !next.treaty) {
        const offerTermIds = composeAiOffer(general, rng);
        next = {
          ...next,
          treaty: {
            id: `treaty-offer-${next.id}-${state.turnNumber}`,
            proposedTurn: state.turnNumber,
            resolvedTurn: null,
            termIds: offerTermIds,
            ratified: null,
            initiator: 'enemy',
            stage: 'ai_offer',
          },
        };
        events.push(`${capitalizeEnemyId(next.enemyId)} sends terms for Rome to consider.`);
      }
    }

    // 4. A stale, unanswered offer expires with the same consequence as an
    // explicit decline (defensive — keeps the scheduler unstuck even if the
    // player never opens the app to answer it; see SetPieceOfferModal for
    // the normal, immediate resolution path).
    if (next.pendingSetPiece && next.pendingSetPiece.expiresTurn <= state.turnNumber) {
      events.push(`The offer at ${next.pendingSetPiece.siteName} goes unanswered — the moment passes.`);
      next.warScore = clampScore(next.warScore + so.declineWarScorePenalty);
      lifetimeDignitasDelta += so.declineLifetimeDignitasPenalty;
      next = { ...next, pendingSetPiece: null };
    }

    // 5. THE SEAM — scheduler roll (only when no offer is currently pending).
    if (!next.pendingSetPiece) {
      const offer = scheduleSetPiece(state, next, rng);
      if (offer) {
        next = { ...next, pendingSetPiece: offer, lastSetPieceTurn: state.turnNumber };
        events.push(`The armies will meet at ${offer.siteName}.`);
      }
    }

    // 6. Chunk M10 — resolve a tabled ratification bill. gameStore.tableTreaty
    // pushed a Bill with id `treaty-${war.id}-${treaty.proposedTurn}` into
    // state.bills; by the time this step runs, turnSequencer's earlier
    // "resolve bills" step (same processSeason call) has already either
    // moved it to state.passedBills, dropped it (expired without passing —
    // its failEffect already applied the negotiating consul's dignitas
    // penalty), or left it untouched in state.bills (still pending).
    if (next.treaty?.stage === 'senate_vote' && next.treaty.ratified === null) {
      const billId = `treaty-${next.id}-${next.treaty.proposedTurn}`;
      const passed = (state.passedBills ?? []).some(b => b.id === billId);
      const stillPending = state.bills.some(b => b.id === billId);

      if (passed) {
        const winner = winnerFromWarScore(next.warScore);
        const effectPatch = applyTreatyEffects(next.treaty.termIds, { ...state, ...statePatch }, winner);
        statePatch = { ...statePatch, ...effectPatch };
        next = {
          ...next,
          active: false,
          pendingSetPiece: null,
          treaty: { ...next.treaty, ratified: true, resolvedTurn: state.turnNumber },
        };
        // P3-A — classify the conclusion (major wars only; see
        // classifyTerminalOutcome's doc comment). Purely a tag on top of
        // the ratification this block already performed.
        if (next.scale === 'major') {
          const outcome = classifyTerminalOutcome(next.warScore, computeRipeness(state.year), false);
          next = { ...next, terminalOutcome: outcome, endedYear: state.year };
          statePatch = { ...statePatch, pendingEpilogue: outcome };
        }
        noticeEvents.push(injectNoticeEvent(`evt-war-treaty-ratified-${next.id}`, state.turnNumber, playerId, {
          title: 'Peace With Honour',
          bodyText: `The Senate has ratified peace with ${capitalizeEnemyId(next.enemyId)}. The war is over.`,
        }));
        events.push(`Peace ratified with ${capitalizeEnemyId(next.enemyId)}.`);

        if (winner === 'rome' && player) {
          const currentBills = statePatch.bills ?? state.bills;
          const alreadyQueued = currentBills.some(b => b.id.startsWith(`triumph-${player.id}`))
            || (state.passedBills ?? []).some(b => b.id.startsWith(`triumph-${player.id}`));
          if (!alreadyQueued) {
            statePatch = { ...statePatch, bills: [...currentBills, buildWarTriumphBill(player, state, next)] };
            events.push(`⚔ ${player.name} is eligible for a Triumph. A petition has been tabled in the Senate.`);
          }
        }
      } else if (!stillPending) {
        // Failed/expired without passing.
        next = {
          ...next,
          warScore: clampScore(next.warScore + t.failWarScorePenalty),
          treaty: { ...next.treaty, ratified: false, resolvedTurn: state.turnNumber },
        };
        events.push(`Ratification fails — ${capitalizeEnemyId(next.enemyId)} takes heart. The war continues.`);
      }
      // else: still pending, no-op — the vote hasn't resolved yet.
    }

    // 6b. Re-table lockout expiry — once retableLockoutTurns has passed
    // since a failed ratification, clear the treaty so a new package can
    // be composed and tabled.
    if (next.treaty?.ratified === false && next.treaty.resolvedTurn !== null
        && state.turnNumber - next.treaty.resolvedTurn >= t.retableLockoutTurns) {
      next = { ...next, treaty: null };
    }

    // 7. Rome-as-loser dictate-tier auto-ratify — "Rome dictated to". No
    // vote: the AI composes terms per its general's aggression and they
    // apply immediately. Only fires when no treaty is already in flight.
    if (!next.treaty && getDesperationTier(next.warScore) === 'dictate' && losingSide(next.warScore) === 'rome') {
      const budget = computeTreatyBudget(next.warScore);
      const termIds = composeAiTreaty(budget, general, rng);
      const effectPatch = applyTreatyEffects(termIds, { ...state, ...statePatch }, 'enemy');
      statePatch = {
        ...statePatch,
        ...effectPatch,
        flags: { ...(statePatch.flags ?? state.flags), [`campaign-failure-epilogue-${next.id}`]: true },
      };
      next = {
        ...next,
        active: false,
        pendingSetPiece: null,
        treaty: {
          id: `treaty-dictated-${next.id}-${state.turnNumber}`,
          proposedTurn: state.turnNumber,
          resolvedTurn: state.turnNumber,
          termIds,
          ratified: true,
          initiator: 'enemy',
          stage: 'auto_ratified',
        },
      };
      // P3-A — dictated-against-Rome always classifies as Humbled outright
      // (see classifyTerminalOutcome's doc comment) — no ripeness check needed.
      if (next.scale === 'major') {
        next = { ...next, terminalOutcome: 'humbled', endedYear: state.year };
        statePatch = { ...statePatch, pendingEpilogue: 'humbled' as const };
      }
      noticeEvents.push(injectNoticeEvent(`evt-war-dictated-terms-${next.id}`, state.turnNumber, playerId, {
        title: 'Terms Dictated',
        bodyText: `Rome could resist no longer. ${capitalizeEnemyId(next.enemyId)} has dictated terms — the war is over.`,
      }));
      events.push(`Rome is forced to accept dictated terms from ${capitalizeEnemyId(next.enemyId)}.`);
    }

    const seasonDelta = next.warScore - beforeScore;
    events.push(`War with ${next.enemyId}: warScore ${seasonDelta >= 0 ? '+' : ''}${seasonDelta} (now ${next.warScore}).`);

    return next;
  });

  return { wars, events, noticeEvents, lifetimeDignitasDelta, statePatch };
}
