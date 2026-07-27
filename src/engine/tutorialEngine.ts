// Tutorial step resolution — predicate/effect registries plus pure lookup
// helpers. tutorial-redesign-plan.md §2.5. Predicates/effects live here
// (not inline in tutorialScript.ts) per CLAUDE.md's data-layer rule: no
// logic in src/data/.

import type { GameState } from '../state/gameStore';
import type { TutorialArcId, TutorialLessonId, TutorialStep, TabName } from '../models/tutorial';
import type { Army } from '../models/army';
import { TUTORIAL_ARCS } from '../data/tutorialScript';
import { applyEffectString } from './resourceEngine';
import { isDeterred } from './secretEngine';
import { CLAUDIUS_LEADER_ID } from '../data/claudiusArc';
import { buildCarthageReinforcementUnits } from './campaignAi';
import { COMMAND_CANVASS_MIN_RELATIONSHIP } from './commandEngine';
import { buildTrialState } from './trialEngine';
import { TRIAL_PREP_VERBS } from '../data/trialPrep';
import { BALANCE } from '../data/balance';

export const ALL_TABS: TabName[] = ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'];

// War arc (T8) — stable id for the scripted Lilybaeum garrison
// (warSeedCarthageGarrison below). Exported so gameStore.ts's battle-
// resolution actions can recognise this ONE specific engagement and shield
// the player's commander from death in it (see resolveEngagementAbstract's
// own comment) without a duplicated string literal drifting between files.
export const TUTORIAL_CARTHAGE_GARRISON_ID = 'tutorial-carthage-garrison-lilybaeum';

// Courts arc (T9) — stable id for the one forced trial this arc ever files,
// so predicates can look it up directly rather than snapshotting a flag (the
// entry gate guarantees at most one trial is active at a time while this arc
// runs, and this id is only ever used by this one call site).
export const TUTORIAL_COURTS_TRIAL_ID = 'tutorial-courts-repetundae';

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
  // Courts arc (T9). curia.trial-banner is CuriaScreen's own TrialBanner —
  // a real, always-mounted (when a trial exists) View, not inside any Modal,
  // so it gets a genuine spotlight cutout rather than narration-only
  // treatment. Basilica prep (approach/speaker/logos/pathos/ethos) and trial
  // day itself are NOT here: BasilicaSheet's own actions live behind further
  // native Modals (agent/bribe/speaker pickers) nested inside an Animated
  // bottom sheet — the exact "measurement inside animated bottom sheets"
  // risk the plan's own §4 flags — and TrialSessionModal/VerdictScene are a
  // native Modal outright (same reasoning as domus.action.train). All of
  // those steps are narration-only, predicate-driven instead.
  'curia.trial-banner',
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

// Courts arc (T9) — has this trial's playerPrep recorded any verb tagged to
// `section` (data/trialPrep.ts)? Existence-on-actionsUsed, not "section total
// > 0": Invoke the Ancestors' bonus is Math.floor(lifetimeDignitas / divisor)
// (trialEngine.invokeAncestorsBonus) — genuinely 0 at a fresh game's starting
// Dignitas, so a raw ethos>0 check would silently refuse to advance for a
// player who took the free Ethos action first. actionsUsed records the verb
// regardless of the bonus it happened to roll.
function trialUsedSection(s: GameState, trialId: string, section: 'logos' | 'pathos' | 'ethos'): boolean {
  const trial = s.trials.find(t => t.id === trialId);
  if (!trial) return false;
  const idsInSection = new Set(TRIAL_PREP_VERBS.filter(v => v.section === section).map(v => v.id));
  return trial.playerPrep.actionsUsed.some(a => idsInSection.has(a));
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
  // at act entry. Not keyed on Bill.playerVote — at the time this act was
  // authored, voteBill/speechBill/filibusterBill never actually set that
  // field (a pre-existing dead field, flagged separately, not fixed there).
  // QA Audit Fix Plan, Chunk C fixed voteBill/filibusterBill to set it for
  // real, but speechBill deliberately still doesn't (a persuasion speech
  // isn't a formal vote, and its 'for'/'against' direction has no lossless
  // mapping onto playerVote's vote_for/vote_against/filibuster union) — so
  // this predicate still can't rely on playerVote alone (Act II's own
  // "any real courting action counts" flexibility means the player may
  // legitimately advance this act via a speech). Support deltas remain the
  // one signal all three actions genuinely produce.
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

  // Courts arc (T9). Mirrors shouldTriggerTrial's own two ambient-filing
  // invariants (trialEngine.ts) — one active trial system-wide, no filing
  // while a Tribune is held — so courtsFileFalseCharge below never violates
  // either one. True the overwhelming majority of the time (this is Year
  // 1-2 of a guided run; nothing else scripts a Tribune bid, and the only
  // realistic way a trial is already active is the war arc's own scripted
  // engagement having set a defeatedGeneral flag that then actually fired) —
  // when it's already true at step entry the director's per-commit check
  // advances past this step before it's ever rendered; when it isn't, the
  // step's own narration is worded to be true whether it shows for one tick
  // or lingers for real seasons.
  courtsEntryClear: (s) => !s.tribuneHolder && !(s.trials ?? []).some(t => t.status !== 'resolved'),

  // The next three are existence-based on actionsUsed (see trialUsedSection's
  // own comment for why NOT a raw section-total check) — any real Basilica
  // verb under that heading counts, same "the choice is yours" flexibility
  // as Act II's courting.
  courtsLogosPrepared: (s) => trialUsedSection(s, TUTORIAL_COURTS_TRIAL_ID, 'logos'),
  courtsPathosPrepared: (s) => trialUsedSection(s, TUTORIAL_COURTS_TRIAL_ID, 'pathos'),
  courtsEthosPrepared: (s) => trialUsedSection(s, TUTORIAL_COURTS_TRIAL_ID, 'ethos'),

  // 'preparing' -> ('in_session' | 'resolved') is turnSequencer's own step-15
  // transition, drawn automatically once turnNumber reaches startsSeason —
  // no separate "trial day" action exists to gate on beyond closing seasons.
  // Explicit existence check first: an absent trial must never read as
  // "day arrived" (undefined !== 'preparing' would otherwise be true).
  courtsTrialDayArrived: (s) => {
    const trial = s.trials.find(t => t.id === TUTORIAL_COURTS_TRIAL_ID);
    return !!trial && trial.status !== 'preparing';
  },
  // Genuinely open on purpose (per design decision — courts is the LAST
  // tutorial arc, so nothing downstream needs Marcus, specifically, to have
  // survived a bad verdict; a loss triggers Rome's ordinary funeral/
  // succession event chain exactly as free play would, and the director
  // already bails on `s.activeEvent` while that plays out). No death shield,
  // unlike the war arc's one scripted engagement (which DID need the
  // player's commander alive, to stand as this arc's defendant).
  courtsVerdictReached: (s) =>
    s.trials.find(t => t.id === TUTORIAL_COURTS_TRIAL_ID)?.status === 'resolved',
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

  // Courts arc (T9) — fires on 'courts.charge-filed's onEnterEffectId, only
  // reachable once 'courts.charge-gate' (courtsEntryClear) has confirmed no
  // trial is active and no Tribune is held. Claudius, deterred from ever
  // using the real secret (Act V's audit — isDeterred), files a fabricated
  // repetundae charge instead: chargeSource 'accusation', not 'secret' —
  // this is a lie, not the blackmail. initialNpcStrength/startsSeason reuse
  // BALANCE.secrets.claudius's own trialSeed/startsDelaySeasons (0 / 1
  // season) rather than the generic NPC-initiated formula or a new constant
  // — see tutorialScript.ts's Courts arc header comment for why those two
  // numbers, already tuned and simulated for a Claudius-filed trial, are the
  // right ones to reuse rather than restate. No playerPrep override (all
  // three sections start at 0), same as resolveClaudiusDefiance's own
  // buildTrialState call. Idempotent: no-ops if the trial already exists
  // (defensive only, same convention as warSeedCarthageGarrison).
  courtsFileFalseCharge: (s) => {
    if (s.trials.some(t => t.id === TUTORIAL_COURTS_TRIAL_ID)) return {};
    const player = s.family.find(c => c.isPlayer);
    if (!player) return {};
    const newTrial = buildTrialState({
      id: TUTORIAL_COURTS_TRIAL_ID,
      seat: 'defense',
      charge: 'repetundae',
      chargeSource: 'accusation',
      prosecutor: { kind: 'leader', leaderId: CLAUDIUS_LEADER_ID },
      defendant: { kind: 'family', characterId: player.id },
      filedSeason: s.turnNumber,
      startsSeason: s.turnNumber + BALANCE.secrets.claudius.startsDelaySeasons,
      initialNpcStrength: BALANCE.secrets.claudius.trialSeed,
      speakerId: player.id,
    });
    return { trials: [...s.trials, newTrial] };
  },

  // Courts arc (T9) — fires on the arc's final step's onCompleteEffectId
  // (courts.philon-handoff, not courts.closing — see that step's own
  // comment), same pattern as embassySetCompleteFlag/warSetCompleteFlag.
  // Nothing consumes the flag itself yet (courts is the last arc T9
  // authors), but it's the same "set the precedent up now" call T8 made for
  // warSetCompleteFlag before this arc existed — a natural hook for T10's
  // just-in-time lessons to gate "the guided tutorial has fully finished"
  // on, without re-deriving it from tutorial.completedArcs. Also unlocks
  // philonAdvisoryUnlocked — this is the literal hand-off moment the step's
  // narration describes, so Ambitions/Ex Tabulis Philonis start surfacing
  // from exactly here.
  courtsSetCompleteFlag: (s) => ({
    flags: { ...s.flags, 'tutorial-courts-complete': true },
    philonAdvisoryUnlocked: true,
  }),

  // T10 — just-in-time lessons. Each just marks itself taught; the
  // corresponding 'pending-lesson-*' flag (stamped at the real trigger's
  // source — turnSequencer.ts / inheritanceEngine.ts, see getEligibleLesson's
  // own comment) is cleared in the same edit, standard flag-hygiene
  // convention already used elsewhere in this codebase (aftermath events
  // clearing the flag they consumed).
  lessonTrialSetTaught: (s) => ({
    flags: { ...s.flags, 'lesson-trial-taught': true },
  }),
  lessonBattleSetTaught: (s) => ({
    flags: { ...s.flags, 'lesson-battle-taught': true },
  }),
  lessonDeathSetTaught: (s) => ({
    flags: { ...s.flags, 'lesson-death-taught': true, 'pending-lesson-death': false },
  }),
  lessonSuccessionSetTaught: (s) => ({
    flags: { ...s.flags, 'lesson-succession-taught': true, 'pending-lesson-succession': false },
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
 * moment. QA Audit Fix Plan (post-T10) added an eighth: `cityEngine.
 * tickAllCities`'s `checkForeignWarDeclarations` — a hostile foreign power
 * (Lilybaeum/Carthage, starting relationship 20, drifting toward hostile
 * within a season or two) could spontaneously declare war on Rome during
 * the prologue, completely outside the scripted embassy/Messana sequencing
 * T4/T7 built around "the Carthage war only ignites after the Embassy arc."
 * Found by chasing down a genuinely flaky pre-push test, not a design
 * review — see that fix's own commit for the repro. `?.` guards bespoke
 * test fixtures built via `as unknown as GameState` that don't set
 * `tutorial` — never null in any real, INITIAL_STATE-derived GameState.
 */
export function isWorldFrozen(s: GameState): boolean {
  return s.tutorial?.activeArc === 'prologue';
}

/**
 * T10 — just-in-time lessons. The single place all four lessons' entry
 * conditions live (called by App.tsx's tutorial director, the same
 * subscription that drives the main arc chain). Returns the first eligible
 * lesson id, or null. Checked only while `!tutorial.activeArc` — never
 * interrupts the four main arcs, another lesson, or a `skipped` run's own
 * "everything already unlocked" state (a skipped run still WANTS these,
 * since skipping is exactly "no hand-holding from here," and Free Start
 * never had `activeArc` set in the first place — both cases pass this
 * check identically).
 *
 * Priority order (trial, battle, death, succession) only matters on the
 * rare tick where more than one condition is simultaneously true; each
 * fires independently afterward once `!activeArc` again, since every
 * trigger below is a durable flag/field, not a transient one.
 *
 * - lesson-trial: `!completedArcs.includes('courts')` covers both Free
 *   Start and a guided run that skipped ahead — either way, the player
 *   never got the courts arc's Basilica walkthrough.
 * - lesson-battle: `activeBattleSetup` truthy. Deliberately doesn't special-
 *   case the war arc's own scripted engagement — `!activeArc` already
 *   excludes it, since tutorial.activeArc is still 'war' at the moment that
 *   fight's own deployment board would open.
 * - lesson-death / lesson-succession: driven by 'pending-lesson-death'/
 *   'pending-lesson-succession', stamped at their real source
 *   (turnSequencer.ts's natural-mortality step; inheritanceEngine.ts's
 *   applySuccession) rather than diffed here — a closure over "the previous
 *   render's state" has no precedent in this codebase and is fragile across
 *   an arc boundary (see this function's own PR discussion); a durable flag
 *   set once at the true trigger, cleared once consumed, is the same idiom
 *   `defeatedGeneral-<id>`/`secret-burned-ever` already use.
 */
export function getEligibleLesson(s: GameState): TutorialLessonId | null {
  if (s.tutorial?.activeArc) return null;

  if (!s.flags['lesson-trial-taught'] && !s.tutorial.completedArcs.includes('courts') && s.trials.length > 0) {
    return 'lesson-trial';
  }
  if (!s.flags['lesson-battle-taught'] && !!s.activeBattleSetup) {
    return 'lesson-battle';
  }
  if (!s.flags['lesson-death-taught'] && s.flags['pending-lesson-death']) {
    return 'lesson-death';
  }
  if (!s.flags['lesson-succession-taught'] && s.flags['pending-lesson-succession']) {
    return 'lesson-succession';
  }
  return null;
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
