// ─── Phase 5, Chunk P5-F — Achievement ("Laurel") evaluator ─────────────────
// Pure. No store/React imports. Every predicate below reads facts that
// already exist on GameState or AncestorRecord — see docs/content-audit.md-
// style verification notes in the P5-F commit for the detection source of
// each row. `flamma` is the one Laurel that needed a new permanent signal
// (flags['secret-burned-ever'], set once in gameStore.burnSecret); every
// other Laurel is detectable from state that already existed.

import type { GameState } from '../state/gameStore';
import type { AncestorRecord } from '../models/epilogue';
import { ACHIEVEMENT_DEFINITIONS } from '../data/achievementDefinitions';

// ─── State-only predicates (always evaluated) ────────────────────────────────

type StatePredicate = (state: GameState) => boolean;

const STATE_PREDICATES: Record<string, StatePredicate> = {
  // highestOfficeEverHeld only ever becomes non-null via an election win
  // (Censor/Dictator — the only non-elected offices in OFFICE_PRESTIGE —
  // are cut from this phase; see rome-phase5-implementation-plan.md's do-
  // not-build list), so "non-null" is exactly "won any election".
  'primus-honos': s => s.highestOfficeEverHeld !== null,
  // consul (prestige 20) is the highest-prestige office actually reachable
  // this phase, so highestOfficeEverHeld tracking "the single highest-
  // prestige office ever held" collapses to an equality check here.
  'consul-gentis': s => s.highestOfficeEverHeld === 'consul',
  // warEngine.buildWarTriumphBill's passEffect sets exactly this flag shape
  // on a passed Triumph bill (also mirrored by epilogueEngine's own beat
  // count for the historian paragraph).
  'triumphator': s => Object.keys(s.flags).some(k => k.startsWith('triumph-granted-')),
  'patronus-maximus': s => s.patronTier >= 5,
  'accusator': s => s.trials.some(t =>
    t.status === 'resolved' && t.seat === 'prosecution' &&
    !!t.outcome && t.outcome !== 'acquitted' && t.outcome !== 'dismissed'
  ),
  // P4-F's convictedSittingMagistrate is the single record of "the leader
  // held office at the moment of conviction" — the live office signal
  // doesn't survive to be re-derived later.
  'vox-populi': s => s.trials.some(t => t.convictedSittingMagistrate === true),
  'absolvo': s => s.trials.some(t =>
    t.status === 'resolved' && t.seat === 'defense' && t.outcome === 'dismissed'
  ),
  'flamma': s => s.flags['secret-burned-ever'] === true,
  // "Hold" reads as the player's own leverage over others — Secrets the
  // player holds against a leader, not ones held against the family.
  'araneus': s => s.secrets.filter(sec =>
    sec.holder === 'player' && (sec.status === 'held' || sec.status === 'extorting')
  ).length >= 3,
  'munificus': s => (s.munificenceUsage['grand-games']?.totalUses ?? 0) >= 1,
  // Mirrors LEGACY_DEFINITIONS' 'treasury_legacy' 2000-threshold milestone
  // ("Wealthy House") rather than re-deriving the number.
  'midas': s => (s.legacyObjectives.find(o => o.definitionId === 'treasury_legacy')?.currentValue ?? 0) >= 2000,
  'gens-perennis': s => s.paterfamiliasGenerations >= 3,
  'ramus-minor': s => s.cadetBranchUsed === true,
  'sine-fine': s => s.endlessMode === true,
  // Meta predicate over gensId + office history — no engine branch on gens
  // identity (design invariant 5 intact).
  'novus-homo': s => s.gensId === 'duilia' && s.highestOfficeEverHeld === 'consul',
};

// ─── Outcome predicates (only evaluated when an epilogue record exists) ─────

type OutcomePredicate = (record: AncestorRecord) => boolean;

const OUTCOME_PREDICATES: Record<string, OutcomePredicate> = {
  'victoria-punica': r => r.outcome === 'victory',
  'pax-fessa': r => r.outcome === 'exhaustion',
  'roma-humilis': r => r.outcome === 'humbled',
};

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * Returns newly-earned Laurel ids only (already-earned ids are never
 * re-returned — idempotent awarding). Two logical call sites collapse into
 * this one function: pass `epilogueRecord` only when this call coincides
 * with the run's epilogue being written (gameStore.endSeason's epilogue-
 * detection block); omit it for the plain per-season check. State
 * predicates are checked either way so a Laurel earned in a run's final
 * season is still caught.
 */
export function evaluateAchievements(
  state: GameState,
  alreadyEarned: Set<string>,
  epilogueRecord?: AncestorRecord,
): string[] {
  const newlyEarned: string[] = [];

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    if (alreadyEarned.has(def.id)) continue;

    const statePredicate = STATE_PREDICATES[def.id];
    if (statePredicate && statePredicate(state)) {
      newlyEarned.push(def.id);
      continue;
    }

    const outcomePredicate = OUTCOME_PREDICATES[def.id];
    if (outcomePredicate && epilogueRecord && outcomePredicate(epilogueRecord)) {
      newlyEarned.push(def.id);
    }
  }

  return newlyEarned;
}
