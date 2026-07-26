// Tutorial step resolution — predicate/effect registries plus pure lookup
// helpers. tutorial-redesign-plan.md §2.5. Predicates/effects live here
// (not inline in tutorialScript.ts) per CLAUDE.md's data-layer rule: no
// logic in src/data/.

import type { GameState } from '../state/gameStore';
import type { TutorialArcId, TutorialStep, TabName } from '../models/tutorial';
import { TUTORIAL_ARCS } from '../data/tutorialScript';
import { applyEffectString } from './resourceEngine';

export const ALL_TABS: TabName[] = ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'];

/** Order arcs resolve in — used by skipTutorialArc to cascade downstream arcs. */
export const TUTORIAL_ARC_ORDER: TutorialArcId[] = ['prologue', 'embassy', 'war', 'courts'];

// Populated by each content chunk (T5 prologue, T7 embassy, T8 war, T9
// courts) alongside the useTutorialTarget(id) call sites they instrument.
// validateTutorialScript() checks every step.target against this set so
// script/component drift (a renamed or removed target) fails a test instead
// of silently spotlighting nothing at runtime.
//
// Not every step that logically "points at" a control gets an entry here —
// several Domus/Cursus/Forum actions live inside a native RN <Modal> (via
// ScrollModal), which renders above TutorialOverlay/TutorialCaption
// regardless of JSX order (same reason EventModal always wins — see
// App.tsx's TutorialLayer comment). A cutout on a control the player can't
// see the caption over is pointless, so those steps are narration-only
// (no target) with a predicate advance instead.
export const TUTORIAL_TARGET_IDS = new Set<string>([
  // Act I — Domus
  'domus.character-card.marcus',
  // Act II — Forum
  'forum.clan.valeria',
  'forum.leader.valerius-flaccus',
  'forum.action.invite-dinner',
  // Act III — Curia
  'curia.bill-list.first',
  'curia.crisis-track.war',
  'curia.action.vote-for',
  // Act IV — Provinciae. provinciae.asset.buy is NOT here: the purchase
  // confirm button lives inside HoldingsModal, another native Modal — same
  // reasoning as domus.action.train.
  'provinciae.map.campania',
]);

// Act III's teaching bill — STARTING_BILLS' 'start-2' (Bellum Punicum), the
// only starting bill whose passEffect touches a crisis track directly
// (crisis-war-10|fides+4). Not literally array index 0 (that's 'start-1'
// Lex Agraria) — "first" in the target id names the bill the tutorial walks
// the player through, not its position in the list.
const ACT3_BILL_ID = 'start-2';

function findFlaccus(s: GameState) {
  return s.clans.flatMap(c => c.leaders).find(l => l.id === 'valerius-flaccus');
}

export const TUTORIAL_PREDICATES: Record<string, (s: GameState) => boolean> = {
  // Act I — Domus: any skill trained on the player this season.
  act1SkillTrained: (s) => {
    const player = s.family.find(c => c.isPlayer);
    return !!player && s.trainedThisSeason.includes(player.id);
  },

  // Act II — Forum: Flaccus's relationship is higher than when the act
  // began (act2SnapshotFlaccusRel takes the snapshot on entry) — any real
  // courting action qualifies, not just Invite to Dinner specifically.
  flaccusRelationshipRaised: (s) => {
    const flaccus = findFlaccus(s);
    if (!flaccus) return false;
    const snapshot = (s.flags['tutorial-flaccus-rel-snapshot'] as number | undefined) ?? -Infinity;
    return flaccus.relationship > snapshot;
  },

  // Act III — Curia: the teaching bill's support differs from its snapshot
  // at act entry. Not keyed on Bill.playerVote — found during this chunk
  // that voteBill/speechBill/filibusterBill never actually set that field
  // (CuriaScreen.tsx reads and displays it, nothing writes it — a
  // pre-existing dead field, flagged separately, not fixed here) — support
  // deltas are the reliable signal voteBill/speechBill/filibusterBill all
  // genuinely produce.
  billVotedThisSeason: (s) => {
    const bill = s.bills.find(b => b.id === ACT3_BILL_ID);
    if (!bill) return false;
    const snapshot = s.flags['tutorial-bill-support-snapshot'] as number | undefined;
    return snapshot !== undefined && bill.support !== snapshot;
  },

  // Act IV — Provinciae: every city starts with ownedAssets: [] (buildCityState),
  // so no snapshot is needed — Campania having any owned asset at all means
  // the player bought one.
  campaniaAssetOwned: (s) => {
    const campania = s.cities.find(c => c.id === 'campania');
    return (campania?.ownedAssets.length ?? 0) > 0;
  },
};

export const TUTORIAL_EFFECTS: Record<string, (s: GameState) => Partial<GameState>> = {
  // Act II — Forum: snapshot Flaccus's relationship the moment the act
  // begins, so flaccusRelationshipRaised can detect a real increase rather
  // than assuming any particular starting value.
  act2SnapshotFlaccusRel: (s) => ({
    flags: { ...s.flags, 'tutorial-flaccus-rel-snapshot': findFlaccus(s)?.relationship ?? 0 },
  }),

  // Act III — Curia: snapshot the teaching bill's support on act entry.
  act3SnapshotBillSupport: (s) => ({
    flags: {
      ...s.flags,
      'tutorial-bill-support-snapshot': s.bills.find(b => b.id === ACT3_BILL_ID)?.support ?? 0,
    },
  }),

  // Act III — Curia: applies Bellum Punicum's OWN real passEffect
  // (crisis-war-10|fides+4) the instant the player votes on it, rather than
  // waiting for it to actually pass through turnSequencer's step 4 — which
  // T4 freezes entirely during the prologue (see isWorldFrozen's comment),
  // so the ordinary passive-resolution path can never fire here. Using the
  // bill's real effect string keeps the moment thematically honest: this is
  // what the bill would have done had it passed normally.
  act3MoveWarTrack: (s) => applyEffectString('crisis-war-10|fides+4', s),
};

export function getStep(stepId: string): TutorialStep | null {
  for (const arc of Object.values(TUTORIAL_ARCS)) {
    const step = arc.steps.find(st => st.id === stepId);
    if (step) return step;
  }
  return null;
}

/** Next step in `current`'s arc, in authored order. Null past the arc's last step. */
export function getNextStep(current: TutorialStep, _s: GameState): TutorialStep | null {
  const arc = TUTORIAL_ARCS[current.arc];
  const idx = arc.steps.findIndex(st => st.id === current.id);
  if (idx === -1) return null;
  return arc.steps[idx + 1] ?? null;
}

/**
 * True only for a `predicate`-kind advance whose predicate currently holds.
 * `tap` and `eventResolved` steps are never "satisfied" by state polling —
 * they advance via an explicit user tap or the director's event-resolution
 * hook, respectively.
 */
export function isStepSatisfied(step: TutorialStep, s: GameState): boolean {
  if (step.advance.kind !== 'predicate') return false;
  const predicate = TUTORIAL_PREDICATES[step.advance.predicateId];
  return predicate ? predicate(s) : false;
}

export function isTabSealed(tab: TabName, s: GameState): boolean {
  return !s.tutorial.unlockedTabs.includes(tab);
}

/**
 * True while the guided prologue is hard-railing the world: random events,
 * ambient crisis drift, war ignition, the Claudius demand block, births, and
 * the natural-mortality roll all gate on this (turnSequencer.ts,
 * tutorial-redesign-plan.md §3 T4's six named targets). Also gates passive
 * bill resolution and auto-bill-injection — found during T4's own
 * verification, not one of the plan's original six: bills resolving in the
 * background off NPC-driven support (nothing to do with the player) can
 * move crisis tracks on their own via passEffect/failEffect, which is both
 * "not actually frozen" and a confound for Act III's own bill-vote teaching
 * moment. `?.` guards bespoke test fixtures built via
 * `as unknown as GameState` that don't set `tutorial` — never null in any
 * real, INITIAL_STATE-derived GameState.
 */
export function isWorldFrozen(s: GameState): boolean {
  return s.tutorial?.activeArc === 'prologue';
}

export function applyTutorialEffect(effectId: string | undefined, s: GameState): Partial<GameState> {
  if (!effectId) return {};
  const effect = TUTORIAL_EFFECTS[effectId];
  return effect ? effect(s) : {};
}

/**
 * Dev-only drift guard: every predicateId/onEnterEffectId/onCompleteEffectId
 * a step references must resolve in the registries above, and every
 * step.target must be a known instrumented id. Call from the director in
 * __DEV__; asserted directly in __tests__/tutorialEngine.test.ts.
 */
export function validateTutorialScript(): void {
  for (const arc of Object.values(TUTORIAL_ARCS)) {
    for (const step of arc.steps) {
      if (step.advance.kind === 'predicate' && !(step.advance.predicateId in TUTORIAL_PREDICATES)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unknown predicate "${step.advance.predicateId}"`,
        );
      }
      if (step.onEnterEffectId && !(step.onEnterEffectId in TUTORIAL_EFFECTS)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unknown onEnterEffectId "${step.onEnterEffectId}"`,
        );
      }
      if (step.onCompleteEffectId && !(step.onCompleteEffectId in TUTORIAL_EFFECTS)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unknown onCompleteEffectId "${step.onCompleteEffectId}"`,
        );
      }
      if (step.target && !TUTORIAL_TARGET_IDS.has(step.target)) {
        throw new Error(
          `tutorialScript: step "${step.id}" references unregistered target "${step.target}"`,
        );
      }
    }
  }
}
