// Tutorial step resolution — predicate/effect registries plus pure lookup
// helpers. tutorial-redesign-plan.md §2.5. Predicates/effects live here
// (not inline in tutorialScript.ts) per CLAUDE.md's data-layer rule: no
// logic in src/data/.

import type { GameState } from '../state/gameStore';
import type { TutorialArcId, TutorialStep, TabName } from '../models/tutorial';
import type { Army } from '../models/army';
import { TUTORIAL_ARCS } from '../data/tutorialScript';
import { applyEffectString } from './resourceEngine';
import { isDeterred } from './secretEngine';
import { CLAUDIUS_LEADER_ID } from '../data/claudiusArc';
import { buildCarthageReinforcementUnits } from './campaignAi';
import { COMMAND_CANVASS_MIN_RELATIONSHIP } from './commandEngine';
import { BALANCE } from '../data/balance';

export const ALL_TABS: TabName[] = ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'];

// War arc (T8) — stable id for the scripted Lilybaeum garrison
// (warSeedCarthageGarrison below). Exported so gameStore.ts's battle-
// resolution actions can recognise this ONE specific engagement and shield
// the player's commander from death in it (see resolveEngagementAbstract's
// own comment) without a duplicated string literal drifting between files.
export const TUTORIAL_CARTHAGE_GARRISON_ID = 'tutorial-carthage-garrison-lilybaeum';

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
  // Act V — Cursus. cursus.office-action.audit-rival is NOT here: Audit a
  // Rival's button lives inside OfficeActionsModal, another native Modal —
  // same reasoning as domus.action.train.
  'cursus.office.quaestor',
  'cursus.action.declare',
  'cursus.action.canvass',
  'shared.end-season',
  // Embassy arc (T7). provinciae.ambassador.* and provinciae.client.recruit-
  // vibius are NOT here: the Ambassador's Desk offers 5 interchangeable
  // actions (the plan leaves the method up to the player, same "choice is
  // yours" treatment as Act II's courting) and the recruit button lives
  // inside CityClientCard, a component reused by every city's ordinary
  // Clients tab — spotlighting one recruit row there would mean threading a
  // ref through a shared component for a single arc's benefit. Both steps
  // are narration-only, predicate-driven instead.
  'provinciae.map.messana',
  'provinciae.foreign.request-posting',
  // War arc (T8). curia.action.declare-command-candidate and
  // curia.action.canvass-command are NOT here: both live inside
  // CommandAssemblyModal (a native RN Modal, via ScrollModal) — same
  // reasoning as domus.action.train. Narration-only, predicate-driven.
  'curia.action.propose-command-vote',
  'curia.action.open-assembly',
  'provinciae.map.campania-ground',
  'provinciae.army.assign-commander',
  'provinciae.army.move',
  'provinciae.map.order-sicilia',
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

  // Act V — Cursus
  quaestorCampaignDeclared: (s) => s.campaigning === 'quaestor',
  flaccusCanvassedForQuaestor: (s) => s.campaignVotes['valerius-flaccus'] === 'for',
  // Verified via npm run sim:elections-equivalent (a targeted 2000-trial
  // simulation of this exact scripted sequence — see tutorialScript.ts's
  // Act V header comment for the derived numbers): quaestorWon fires
  // reliably. Quaestor's own generosity (8 seats, low rival bar at fresh
  // game start) guarantees the win regardless of canvassing outcome;
  // canvassing Flaccus is scripted as a teaching beat (Arc II's Command
  // election re-tests the same verb, finding 16), not because the win
  // depends on it.
  quaestorWon: (s) => s.heldOffices.includes('quaestor'),
  claudiusDeterred: (s) => isDeterred(CLAUDIUS_LEADER_ID, s.secrets),

  // Embassy arc (T7). Mirrors CitySheet.tsx's own ambassadorBillPending
  // check exactly (fuzzy name match — the bill embeds the requesting
  // character, which this predicate has no reason to resolve).
  messanaPostingRequested: (s) =>
    s.bills.some(b => b.name.startsWith('Ambassador Posting:') && b.name.endsWith(' to Messana')),
  messanaAmbassadorPosted: (s) => !!s.cities.find(c => c.id === 'messana')?.playerAmbassador,
  // Same loose (c as any).provincialClientDefId idiom gameStore.recruitCityClient
  // itself uses — Client has no such field in its own type today.
  vibiusRecruited: (s) => s.clients.some(c => (c as any).provincialClientDefId === 'mamertine_captain'),

  // War arc (T8). warStarted covers both evt-messana-appeal branches: the
  // 'answer' choice starts the war immediately; 'refuse' tables a bill
  // (resourceEngine's tableRefuseMamertineBill, tuned T7 to fail decisively)
  // whose failEffect starts it a few seasons later instead. A patient wait
  // either way — see this chunk's own accepted edge case if that bill were
  // ever to pass instead (a real, if vanishingly rare, possibility).
  warStarted: (s) => s.wars.some(w => w.enemyId === 'carthage' && w.active),
  commandVoteCalled: (s) => !!s.commandElection?.active,
  commandCandidateDeclared: (s) => !!s.commandElection?.candidateCharacterId,
  // Found while authoring this arc: generateCommandRivals (commandEngine.ts)
  // picks purely by clan influence, with no relationship floor — a fresh
  // game's top-2 rival clans are rarely ones the player has ever courted, and
  // canvassForCommand silently no-ops below COMMAND_CANVASS_MIN_RELATIONSHIP
  // (25). Real players hit the same wall Act V's script never has to (Flaccus
  // is already courted by then) — so this arc adds one courting beat first.
  // "At least one rival" (not a specific id) keeps the same "your choice"
  // flexibility Act II's courting step has.
  commandRivalCourted: (s) => {
    const rivalIds = new Set((s.commandElection?.rivals ?? []).map(r => r.id));
    return s.clans.some(c => c.leaders.some(l => rivalIds.has(l.id) && l.relationship >= COMMAND_CANVASS_MIN_RELATIONSHIP));
  },
  // At least one rival successfully canvassed — same "retry until it lands"
  // teaching parallel as Act V's flaccusCanvassedForQuaestor, re-testing the
  // canvass verb per the plan's own finding 16. Not a win requirement — see
  // commandVoteResolved below, which advances on EITHER outcome ("battle
  // outcome is genuinely open" extends to this vote too, by design).
  commandRivalCanvassed: (s) => Object.values(s.commandElection?.votes ?? {}).some(v => v === 'for'),
  commandVoteResolved: (s) => !s.commandElection?.active,
  campaniaArmyMustered: (s) => s.armies.some(a => a.owner === 'player' && a.location === 'campania'),
  // Exactly one player army exists at this point in the scripted arc (a
  // single fresh muster) — these three don't need to track a specific
  // army id.
  campaniaArmyCommanderAssigned: (s) => s.armies.some(a => a.owner === 'player' && !!a.commanderId),
  campaniaArmyOrdered: (s) => s.armies.some(a => a.owner === 'player' && !!a.ordersThisSeason),
  // Found while testing: a WIN requirement here (army.location === 'sicilia')
  // would softlock this step on a loss — a losing army falls back to
  // campania (campaignResolver.ts's own resolution), which is exactly the
  // "genuinely open, nothing depends on the outcome" result the plan wants.
  // ordersThisSeason clearing to null (campaignResolver's clearSpentOrder,
  // on arrival OR bounce-back alike) plus no outstanding pendingEngagements
  // is the real outcome-agnostic "this engagement is over" signal.
  engagementResolved: (s) =>
    s.armies.some(a => a.owner === 'player' && !a.ordersThisSeason) && s.pendingEngagements.length === 0,
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

  // Embassy arc (T7) — fires on the arc's final step's onCompleteEffectId.
  // Consumed by turnSequencer.ts's evt-messana-appeal ignition gate (T4):
  // for a guided run, the appeal never fires until this flag is set, so its
  // envoy is always Vibius, never a stranger.
  embassySetCompleteFlag: (s) => ({
    flags: { ...s.flags, 'tutorial-embassy-complete': true },
  }),

  // War arc (T8) — fires on 'war.select-sicilia's onEnterEffectId, the
  // moment the player is about to pick Sicilia as their army's destination.
  // Guarantees "one guided engagement" actually happens: natural Carthage-
  // army generation (campaignAi.ts's shouldReinforceCarthage/
  // applyCarthageReinforcement) only founds a fresh army at 'africa' every
  // BALANCE.campaign.ai.reinforcementInterval seasons, then takes further
  // AI-driven seasons to reach Sicily — far too slow/uncertain for a
  // scripted beat. Seeded directly at Lilybaeum (Carthage's real Sicilian
  // fortress per theatreMap.ts) instead, with the SAME unit composition the
  // live reinforcement AI already uses (buildCarthageReinforcementUnits,
  // reused not reinvented) and a real named general (hanno_cautious,
  // data/enemyGenerals.ts) so it resolves through the ordinary abstract-
  // battle/EngagementInterstitial pipeline exactly like any other fight.
  // Fired this late (not at arc-entry) to minimise the window where
  // campaignAi's per-season Carthaginian order logic could relocate it
  // before the player's own order arrives — only one endSeason() call
  // (the march itself) happens between this effect and the encounter.
  // Idempotent: no-ops if a seed with this id already exists (defensive
  // only — onEnterEffectId fires once per real playthrough, this step
  // having no "re-enter" path).
  warSeedCarthageGarrison: (s) => {
    const seedId = TUTORIAL_CARTHAGE_GARRISON_ID;
    if (s.armies.some(a => a.id === seedId)) return {};
    const garrison: Army = {
      id: seedId,
      name: 'Lilybaeum Garrison',
      owner: 'carthage',
      commanderId: 'hanno_cautious',
      location: 'sicilia',
      stationedCityId: 'lilybaeum',
      units: buildCarthageReinforcementUnits(s.turnNumber),
      stance: 'give_battle',
      ordersThisSeason: null,
      fatigued: false,
      unpaidSeasons: 0,
    };
    return { armies: [...s.armies, garrison] };
  },

  // War arc (T8) — fires on 'war.command-outcome's onEnterEffectId, right
  // after the Command vote resolves either way. musterEngine.quoteMuster
  // sanctions a muster via holding a magistracy, holding the Command, OR
  // (the fallback) enough personal imperium — a real, non-scripted player
  // builds that up over several seasons via provincial assets like the
  // Garrison Contract (data/cityAssets.ts, +2-7 imperium/season). The
  // scripted arc doesn't have that many seasons to spend, and the Command
  // vote's outcome is deliberately left open (win or lose, same as the
  // battle itself) — so if the player didn't win it, this tops up personal
  // imperium to exactly the unsanctioned-muster threshold, standing in for
  // what time alone would have granted. No-ops if the player is already
  // sanctioned (won the Command, or — after this chunk's officeId fix —
  // still holds a magistracy) or already has enough imperium.
  warEnsureMusterSanctioned: (s) => {
    const player = s.family.find(c => c.isPlayer);
    const sanctioned =
      (player?.officeId != null) ||
      (!!player?.isPlayer && s.currentOffice !== null) ||
      s.activeCommand?.holderOwner === 'player';
    if (sanctioned) return {};
    const required = BALANCE.campaign.muster.imperiumThresholdBase;
    return s.imperium < required ? { imperium: required } : {};
  },

  // War arc (T8) — fires on the arc's final step's onCompleteEffectId, same
  // pattern as embassySetCompleteFlag. Not yet consumed anywhere (T9/the
  // courts arc hasn't been authored), but sets the precedent up now rather
  // than requiring a T9 change to gameStore/turnSequencer for a flag this
  // arc's own completion should obviously record.
  warSetCompleteFlag: (s) => ({
    flags: { ...s.flags, 'tutorial-war-complete': true },
  }),
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
