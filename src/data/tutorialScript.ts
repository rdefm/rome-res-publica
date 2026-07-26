// The four tutorial arcs as static content. No logic — see engine/tutorialEngine.ts
// for step resolution and engine/tutorialTargets.ts for the spotlight registry.
// tutorial-redesign-plan.md §2.1/§2.5.
//
// Steps are authored incrementally per the plan's chunk order: T5 (prologue),
// T7 (embassy), T8 (war), T9 (courts). All four arcs are declared here from
// the start so downstream chunks only ever append to `steps`, never touch
// this file's structure.

import type { TutorialArc, TutorialArcId, TutorialStep } from '../models/tutorial';

// ─── Arc I — The Prologue ───────────────────────────────────────────────────
// Hard rail throughout. One act, one tab, per plan §1. Each act's last step
// carries unlocksTab for the NEXT act's tab — Domus is open from game start
// (gameStore.startGame), so Act I doesn't unlock anything on entry, only on
// its own completion (Forum, for Act II).

// ── Act I — Domus: family as instrument, Fides as currency, skills ─────────
// Completion: the player trains a skill on Marcus. ("...or commissions the
// laudatio" in the plan's design table turned out, on inspection of the
// retired tutorial-264 content, to have been a one-off scripted-event effect
// (fides-10|lifetimeDignitas+10), never a persistent Domus UI action — adding
// one would be new-mechanic work outside this chunk's scope (author content +
// instrument existing screens), so training is the sole completion path.)
const PROLOGUE_ACT1_STEPS: TutorialStep[] = [
  {
    id: 'prologue.act1.intro',
    arc: 'prologue',
    actLabel: 'Act I — The Domus',
    rail: 'hard',
    requiresTab: 'Domus',
    narration:
      "Domine. Philon — your father's Greek, and now, I hope, yours. Five things make a Roman " +
      "house worth the name, and Rome will test you in each, one at a time. We begin here, in the " +
      "Domus, with the only thing truly yours: your family.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act1.meet-marcus',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Domus',
    target: 'domus.character-card.marcus',
    narration:
      "This is you, Domine — Marcus, paterfamilias of this house. Everything the family attempts, " +
      "it attempts through hands like his: skills sharpened, offices held, wars fought. Rome does " +
      "not deal with a name. It deals with a man.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act1.fides',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Domus',
    narration:
      "You will spend two currencies in this life, Domine. Denarii buy bread and armies. Fides — " +
      "favour, standing, the small debts men owe you — buys everything else: votes, friendships, " +
      "silence. Spend it as carefully as coin, and never let it sit idle.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act1.skills',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Domus',
    narration:
      "A man is what he can do. Rhetoric moves the Curia. Martial moves legions. Intrigus moves " +
      "what neither should see. Train them, and Marcus becomes a sharper instrument for whatever " +
      "the family asks of him next.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act1.open-card',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Domus',
    target: 'domus.character-card.marcus',
    narration: "Tap him again, Domine, and see what he is capable of.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act1.train',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Domus',
    narration: "Choose a skill and train it — whichever you judge the family will need first.",
    advance: { kind: 'predicate', predicateId: 'act1SkillTrained' },
    unlocksTab: 'Forum',
  },
];

// ── Act II — Forum: leaders vs clans, courting costs, relationship → votes,
// Claudius's hold revealed ──────────────────────────────────────────────────
// Completion: Flaccus's relationship rises via any real courting action
// (Invite to Dinner is spotlighted as the suggested one, but the predicate
// accepts Buy Influence/Forge Alliance/marriage too — see
// flaccusRelationshipRaised's comment). Claudius's reveal is narration only:
// LeaderDetailPanel already renders his held-secret line the moment the
// player selects him (his starting Secret is discovered: true from game
// start), so there's nothing to force the player to go look at — Philon
// just tells them plainly, matching the retired tut-04's beat.
const PROLOGUE_ACT2_STEPS: TutorialStep[] = [
  {
    id: 'prologue.act2.intro',
    arc: 'prologue',
    actLabel: 'Act II — The Forum',
    rail: 'hard',
    requiresTab: 'Forum',
    narration:
      "The Forum, Domine. Rome is not governed by Rome — it is governed by houses, and houses by " +
      "the men who lead them. Every clan you see here is a bloc of votes wearing a family name.",
    advance: { kind: 'tap' },
    onEnterEffectId: 'act2SnapshotFlaccusRel',
  },
  {
    id: 'prologue.act2.open-valeria',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    target: 'forum.clan.valeria',
    narration:
      "Gens Valeria, there — old allies of your father's house. Tap them open, and meet the man " +
      "who actually commands their votes.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act2.meet-flaccus',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    target: 'forum.leader.valerius-flaccus',
    narration:
      "M. Valerius Flaccus. Remember his name and forget his clan's — relationships are held with " +
      "men, Domine, not houses. He commands real votes, and he forgets nothing done for or against him.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act2.claudius-reveal',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    narration:
      "One name in this chamber you should already fear a little: Appius Claudius Pulcher. He " +
      "holds a certain irregularity in your father's accounts, kept \"quite safe,\" and mentions it " +
      "when it suits him. Such things are answered in kind — but that is a lesson for later. Select " +
      "his clan in the Forum whenever you wish to see for yourself what he holds over your family.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act2.courting',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    narration:
      "Every leader in this Forum can be courted — dinners, favours, marriages, alliances. All of " +
      "it costs Fides or Denarii. All of it counts, once the elections come.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act2.court-flaccus',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    target: 'forum.action.invite-dinner',
    narration: "Court him. An invitation to dinner is the simplest opening — but the choice of gesture is yours.",
    advance: { kind: 'predicate', predicateId: 'flaccusRelationshipRaised' },
    unlocksTab: 'Curia',
  },
];

// ── Act III — Curia: Rome's health is your income, bills, crisis tracks ────
// Completion: the player votes on Bellum Punicum (STARTING_BILLS' 'start-2')
// and the War crisis track visibly moves. The ordinary season-end passive
// bill-resolution path is frozen throughout the prologue (T4), so this act's
// "a track moves" moment is delivered directly by act3MoveWarTrack the
// instant the vote registers — see that effect's own comment.
const PROLOGUE_ACT3_STEPS: TutorialStep[] = [
  {
    id: 'prologue.act3.intro',
    arc: 'prologue',
    actLabel: 'Act III — The Curia',
    rail: 'hard',
    requiresTab: 'Curia',
    narration:
      "The Curia, Domine. Understand this above all: when the Senate passes nothing, Rome's " +
      "crises grow of their own accord — the war, the mobs, the treasury, the constitution " +
      "itself. They do not wait on your attention.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act3.bill-list',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Curia',
    target: 'curia.bill-list.first',
    narration:
      "Bellum Punicum — war funding against Carthage, already before the House. Every bill " +
      "either buys calm, passed, or is simply left to die.",
    advance: { kind: 'tap' },
    onEnterEffectId: 'act3SnapshotBillSupport',
  },
  {
    id: 'prologue.act3.crisis-tracks',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Curia',
    target: 'curia.crisis-track.war',
    narration:
      "Four tracks measure the Republic's health — war, unrest, the treasury, the constitution " +
      "itself. Ignore the Curia, and every one of them climbs on its own. This bill, passed, " +
      "would push the War track back.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act3.cost-of-silence',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Curia',
    narration: "Your voice in there costs Fides. Your silence, in time, costs a great deal more.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act3.vote',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Curia',
    target: 'curia.action.vote-for',
    narration: "Tap VOTE beneath it, then Vote For. Commit your voice.",
    advance: { kind: 'predicate', predicateId: 'billVotedThisSeason' },
    onCompleteEffectId: 'act3MoveWarTrack',
    unlocksTab: 'Provinciae',
  },
];

// ── Act IV — Provinciae: denarii loop, the map, Campania ────────────────────
// Completion: the player buys one asset in Campania. The purchase confirm
// button itself lives inside HoldingsModal (a native Modal), so — same
// treatment as Act I's training step — the final action is narration-only;
// only the map marker gets a real spotlight cutout.
const PROLOGUE_ACT4_STEPS: TutorialStep[] = [
  {
    id: 'prologue.act4.intro',
    arc: 'prologue',
    actLabel: 'Act IV — The Provinces',
    rail: 'hard',
    requiresTab: 'Provinciae',
    narration:
      "The provinces, Domine — Rome's reach beyond Rome, and the source of every denarius the " +
      "family will ever see that didn't come from Fides spent well.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act4.denarii-loop',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Provinciae',
    narration:
      "Land and holdings here generate denarii every season, on their own, without your attention " +
      "— unlike Fides, which you must spend and earn deliberately in Rome. Buy well once, and it pays you forever.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act4.the-map',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Provinciae',
    narration:
      "This map is the whole of Rome's world, or will be. Every region marked can, in time, be " +
      "governed, garrisoned, or bought into.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act4.campania',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Provinciae',
    target: 'provinciae.map.campania',
    narration: "Campania, there — close, fertile, and friendly to Rome already. Tap it.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act4.why-campania',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Provinciae',
    narration:
      "A family with standing here has standing near Rome itself — and, should the Republic ever " +
      "need to muster close to home, a foothold already in friendly ground.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act4.buy-asset',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Provinciae',
    narration:
      "Open its Holdings, and buy one. A Country Villa suits a family building influence, " +
      "not just wealth — but the choice, again, is yours.",
    advance: { kind: 'predicate', predicateId: 'campaniaAssetOwned' },
    unlocksTab: 'Cursus',
  },
];

export const TUTORIAL_ARCS: Record<TutorialArcId, TutorialArc> = {
  prologue: {
    id: 'prologue',
    title: 'The First Year',
    steps: [...PROLOGUE_ACT1_STEPS, ...PROLOGUE_ACT2_STEPS, ...PROLOGUE_ACT3_STEPS, ...PROLOGUE_ACT4_STEPS],
  },
  embassy:  { id: 'embassy',  title: 'The Embassy',     steps: [] },
  war:      { id: 'war',      title: 'The War',         steps: [] },
  courts:   { id: 'courts',   title: 'The Courts',      steps: [] },
};
