// The four tutorial arcs, plus T10's standalone just-in-time lessons, as
// static content. No logic — see engine/tutorialEngine.ts for step
// resolution and engine/tutorialTargets.ts for the spotlight registry.
// tutorial-redesign-plan.md §2.1/§2.5.
//
// Steps were authored incrementally per the plan's chunk order: T5 (prologue),
// T7 (embassy), T8 (war), T9 (courts), T10 (the four lessons) — all landed.
// All four main arcs were declared here from the start so each chunk only
// ever appended to `steps`, never touched this file's structure; the four
// lesson arcs are new additions (models/tutorial.ts's TutorialLessonId).

import type { TutorialArc, TutorialAnyArcId, TutorialStep } from '../models/tutorial';

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

// ── Act V — Cursus: why all of it existed ───────────────────────────────────
// Completion: Marcus declares for Quaestor, canvasses Flaccus, wins the
// election, then uses Audit a Rival on Claudius — a mutual standoff
// (isDeterred), Claudius's blackmail neutralised on screen, mechanically
// real per the plan's own framing.
//
// Guaranteed-win numbers (per the plan's "do not invent numbers" instruction
// — derived, not assumed): calcOfficeThreshold('quaestor') = 40 + 1*5 = 45
// (Quaestor is OFFICES[1]). A targeted 2000-trial simulation of this EXACT
// scripted sequence (fresh guided start -> Invite Flaccus to Dinner (Act II)
// -> declare Quaestor -> canvass Flaccus, retrying on failure/event up to 3
// times -> advance to Winter) won 2000/2000 (100%). Canvassing Flaccus
// itself only actually locks his vote in ~87% of individual trials (roll vs.
// threshold, retried), yet the election was won 100% of the time regardless
// — Quaestor's 8 seats and the fresh-game rival pool's low bar guarantee the
// win on their own; canvassing Flaccus is scripted here as a teaching beat
// (Arc II's Command election re-tests the same verb — finding 16), not
// because the win depends on it. No relationship-gain adjustment needed.
//
// Audit a Rival's own button lives inside OfficeActionsModal (a native
// Modal, same as Act I's training and Act IV's asset purchase) — that step
// is narration-only, predicate-driven, no spotlight cutout.
const PROLOGUE_ACT5_STEPS: TutorialStep[] = [
  {
    id: 'prologue.act5.intro',
    arc: 'prologue',
    actLabel: 'Act V — The Cursus',
    rail: 'hard',
    requiresTab: 'Cursus',
    narration:
      "The Cursus Honorum, Domine — why any of it existed. Family, friendships, income, " +
      "the Curia's patience: every one of them was spent so that a name could climb this ladder.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act5.find-quaestor',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    target: 'cursus.office.quaestor',
    narration:
      "There: Quaestor. Financial magistrate, and the first rung nearly every serious career " +
      "climbs. Eight seats stand open this year — generous odds, for a first attempt.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act5.declare',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    target: 'cursus.action.declare',
    narration: "Declare your candidacy.",
    advance: { kind: 'predicate', predicateId: 'quaestorCampaignDeclared' },
  },
  {
    id: 'prologue.act5.canvass-intro',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    narration:
      "Every leader you have courted can now be canvassed — locked support, not mere goodwill. " +
      "Flaccus, whom you already know, is the surest bet in the chamber.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act5.canvass',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Forum',
    target: 'cursus.action.canvass',
    narration: "Canvass him.",
    advance: { kind: 'predicate', predicateId: 'flaccusCanvassedForQuaestor' },
  },
  {
    id: 'prologue.act5.end-season-intro',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    narration: "The city votes when Winter comes — and Winter is close now. Close out the season.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act5.wait-for-election',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    target: 'shared.end-season',
    narration: "End the season, Domine. Rome does not wait, and neither, now, do you.",
    advance: { kind: 'predicate', predicateId: 'quaestorWon' },
  },
  {
    id: 'prologue.act5.audit-intro',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    narration:
      "Quaestor. The treasury's ledgers are yours now — and its audit powers. Appius Claudius " +
      "Pulcher has held something over this family since before you could vote. Return the favour.",
    advance: { kind: 'tap' },
  },
  {
    id: 'prologue.act5.audit',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    narration: "Open the office, choose Audit a Rival, and name him specifically.",
    advance: { kind: 'predicate', predicateId: 'claudiusDeterred' },
  },
  {
    id: 'prologue.act5.standoff',
    arc: 'prologue',
    rail: 'hard',
    requiresTab: 'Cursus',
    narration:
      "It is done. He holds what he held, still — but so, now, do you. Neither of you can move " +
      "first without losing everything. Philon: \"That, Domine, is what protects a family in " +
      "Rome. Not virtue. Leverage, and the nerve to hold it.\"",
    advance: { kind: 'tap' },
  },
];

// ─── Arc II — The Embassy ───────────────────────────────────────────────────
// Guided rail (spotlight hints only — taps pass through; the world freeze
// lifts the instant this arc becomes active, isWorldFrozen's own gate).
// One continuous arc, not multiple acts. Completion: the player posts an
// ambassador to Messana (still status: 'foreign' at this point — finding 9),
// builds enough Local Support there via the Ambassador's Desk, and recruits
// Vibius the Mamertine as a provincial client — the same man Rome will later
// hear from as evt-messana-appeal's envoy (T4's ignition gate waits on this
// arc's completion flag precisely so that appeal is never a stranger).
//
// Messana's relationshipRequired (40) for Vibius is already cleared at game
// start (startingRelationship: 45) — the real gate the player must clear is
// Local Support, 0 -> 25 (Vibius's supportRequired), via whichever
// Ambassador's Desk action(s) they choose. Not prescribed here, same "the
// choice, again, is yours" treatment as Act II/Act IV of the prologue.
const EMBASSY_STEPS: TutorialStep[] = [
  {
    id: 'embassy.intro',
    arc: 'embassy',
    actLabel: 'The Embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration:
      "Domine. The family stands on its own now — I will not walk your hand through every step " +
      "from here. But one thing wants doing before Rome has any reason to care about it: across " +
      "the strait from Italy sits Messana, held by Mamertine mercenaries and courted by nobody. " +
      "Post a man there before Rome ever needs Sicily, and you will know its captain as a friend, " +
      "not a stranger asking for a fleet.",
    advance: { kind: 'tap' },
  },
  {
    id: 'embassy.find-messana',
    arc: 'embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'provinciae.map.messana',
    narration: "There, across the water — Messana. Foreign still, and no business of Rome's. Tap it.",
    advance: { kind: 'tap' },
  },
  {
    id: 'embassy.request-posting',
    arc: 'embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'provinciae.foreign.request-posting',
    narration:
      "Request the posting. It tables exactly like any bill you passed in the Curia — support " +
      "carries it, and here, nothing yet stands against it.",
    advance: { kind: 'predicate', predicateId: 'messanaPostingRequested' },
  },
  {
    id: 'embassy.end-season-for-posting',
    arc: 'embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'shared.end-season',
    narration: "Close the season, and let the Senate's business run its course.",
    advance: { kind: 'predicate', predicateId: 'messanaAmbassadorPosted' },
  },
  {
    id: 'embassy.ambassador-desk',
    arc: 'embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration:
      "Your man is posted. Open Messana again — the Ambassador's Desk waits there now. Rapport, " +
      "grain, exchange: every action spends Fides or gold to buy Local Support, and Messana's " +
      "garrison will not deal with a house it does not trust. The method is yours to choose.",
    advance: { kind: 'tap' },
  },
  {
    id: 'embassy.recruit-vibius',
    arc: 'embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration:
      "Once the garrison trusts your house enough, its captain can be recruited as a client of " +
      "this family — Vibius, a Mamertine, one of the self-styled \"sons of Mars.\" Recruit him.",
    advance: { kind: 'predicate', predicateId: 'vibiusRecruited' },
  },
  {
    id: 'embassy.closing',
    arc: 'embassy',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration:
      "It is done. Vibius owes your house now — not Rome, you. Remember that distinction, Domine. " +
      "It will matter again, sooner than either of you would like.",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'embassySetCompleteFlag',
  },
];

// ─── Arc II — The War ───────────────────────────────────────────────────────
// Guided rail throughout (freeze already lifted — isWorldFrozen is prologue-
// only). One continuous arc. Sequence: wait for Vibius's appeal to actually
// fire and resolve into a Carthage war (evt-messana-appeal, T7's sting) ->
// call and win-or-lose a Command election (the Curia's extraordinary
// assembly, re-testing Act V's canvass verb per finding 16 — CuriaScreen's
// CommandAssemblyModal, NOT MilitaryTab's now-deleted dead
// CommanderElectionState block, which this chunk also retired) -> muster in
// Campania (finding 13, already the player's own ground since Act IV) ->
// assign a commander (a leaderless army may garrison but never attack) ->
// march for Sicilia -> one guided engagement against a seeded Carthaginian
// garrison (warSeedCarthageGarrison — natural Carthage-army generation is
// real but far too slow/uncertain for a scripted beat; see that effect's
// own comment).
//
// Battle outcome is genuinely open — nothing later depends on winning or
// losing, same as the Command vote itself. Narration is written to read
// correctly either way (no per-outcome templating; models/tutorial.ts's
// TutorialStep.narration supports none in v1).
const WAR_STEPS: TutorialStep[] = [
  {
    id: 'war.intro',
    arc: 'war',
    actLabel: 'The War',
    rail: 'guided',
    requiresTab: 'Curia',
    narration:
      "Domine. Vibius's plea will reach the Senate soon enough — and once Rome answers it, there " +
      "will be a war to fight, on ground you already hold some standing near. Campania is yours, " +
      "remember, since the family's very first purchase there.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.wait-for-appeal',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    target: 'shared.end-season',
    narration: "Close the season, Domine, and answer whatever the Curia brings you.",
    advance: { kind: 'predicate', predicateId: 'warStarted' },
  },
  {
    id: 'war.command-intro',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    narration:
      "Rome is at war. Someone must hold the Command — an extraordinary assembly, separate from " +
      "the offices you already know, granting imperium, a state legion, and a war chest for as " +
      "long as the fighting lasts. Canvass for it exactly as you canvassed for Quaestor.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.propose-vote',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    target: 'curia.action.propose-command-vote',
    narration: "Propose the vote.",
    advance: { kind: 'predicate', predicateId: 'commandVoteCalled' },
  },
  {
    id: 'war.open-assembly',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    target: 'curia.action.open-assembly',
    narration: "The assembly stands open. Tap it.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.declare-candidate',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    narration: "Stand for it yourself — name Marcus as your candidate.",
    advance: { kind: 'predicate', predicateId: 'commandCandidateDeclared' },
  },
  {
    id: 'war.canvass-intro',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    narration:
      "Now canvass the rivals standing against you, exactly as you did in the Cursus. A stranger's " +
      "door will not open for a bribe alone, though — court one first, if his standing with you is " +
      "still too low to hear you at all.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.court-rival',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Forum',
    narration:
      "Open the Forum. Whichever rival stands nearest you already, court him — dinner, favour, " +
      "alliance, your choice — until his door is open.",
    advance: { kind: 'predicate', predicateId: 'commandRivalCourted' },
  },
  {
    id: 'war.canvass',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    narration: "Back to the Curia. Canvass him now — he will listen.",
    advance: { kind: 'predicate', predicateId: 'commandRivalCanvassed' },
  },
  {
    id: 'war.end-season-for-vote',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    target: 'shared.end-season',
    narration: "Close the season and let the assembly resolve.",
    advance: { kind: 'predicate', predicateId: 'commandVoteResolved' },
  },
  {
    id: 'war.command-outcome',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Curia',
    narration:
      "Whoever holds the Command now, Domine, your own arms are still Rome's to muster — sanctioned " +
      "by your own office, if not by the Senate's writ. Sicilia does not wait on any one man's title.",
    advance: { kind: 'tap' },
    onEnterEffectId: 'warEnsureMusterSanctioned',
  },
  {
    id: 'war.muster-intro',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration: "Return to Campania. It is time to raise legions of your own.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.find-campania-region',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'provinciae.map.campania-ground',
    narration: "Tap the ground itself, not the city — the region beneath it, where armies muster.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.muster',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration: "Muster a legion here. Any tier will serve to teach the lesson.",
    advance: { kind: 'predicate', predicateId: 'campaniaArmyMustered' },
  },
  {
    id: 'war.assign-commander-intro',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration: "A leaderless army may garrison, Domine, but it may never attack. Give it a commander.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.assign-commander',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'provinciae.army.assign-commander',
    narration: "Name Marcus its commander.",
    advance: { kind: 'predicate', predicateId: 'campaniaArmyCommanderAssigned' },
  },
  {
    id: 'war.move-intro',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration: "Now march it for Sicilia. The strait costs more to cross than open ground — expect it.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.issue-order',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'provinciae.army.move',
    narration: "Tap Move.",
    advance: { kind: 'tap' },
  },
  {
    id: 'war.select-sicilia',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'provinciae.map.order-sicilia',
    narration: "Sicilia, there, across the strait. Order the march.",
    advance: { kind: 'predicate', predicateId: 'campaniaArmyOrdered' },
    onEnterEffectId: 'warSeedCarthageGarrison',
  },
  {
    id: 'war.end-season-for-engagement',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    target: 'shared.end-season',
    narration:
      "Close the season, Domine. Carthage holds Lilybaeum still, and your legion is marching " +
      "straight for it.",
    advance: { kind: 'predicate', predicateId: 'engagementResolved' },
  },
  {
    id: 'war.closing',
    arc: 'war',
    rail: 'guided',
    requiresTab: 'Provinciae',
    narration:
      "Whatever the field decided, Domine, it decided something real — no dice loaded, no outcome " +
      "written in advance. That is the whole of war: you commit, and Rome finds out what you're " +
      "worth. Philon: \"There is a third lesson still owed you. It will not be so honest as this one.\"",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'warSetCompleteFlag',
  },
];

// ─── Arc IV — The Courts ────────────────────────────────────────────────────
// Guided rail throughout. One continuous arc, the final one — nothing in this
// codebase runs after it (T10 is flag-gated just-in-time lessons layered on
// top of BOTH guided and free starts, not a fifth arc). Sequence: a gate that
// waits for the one-active-trial/no-Tribune invariants to be free (courts
// arc.charge-gate) -> Claudius files a fabricated repetundae charge the
// instant he can (courts.charge-filed, tutorialEngine's
// courtsFileFalseCharge) -> Basilica prep across all three fronts -> trial
// day -> verdict, whatever it is.
//
// The verdict is left genuinely real (trialEngine.resolveTrialOutcome is
// never touched) — including its OUTCOME_CONSEQUENCES.removeCharacter effect
// on Exiled/Executed. War arc's own battle-death shield
// (gameStore.resolveEngagementAbstract's TUTORIAL_CARTHAGE_GARRISON_ID
// comment) was necessary because T9 needed Marcus alive to BE the defendant;
// nothing downstream needs him alive AFTER the verdict, since courts is the
// last arc — a loss triggers Rome's ordinary funeral/succession event chain
// exactly as it would in free play, and the tutorial director already bails
// on `s.activeEvent`, so that chain plays out before the closing beat's
// caption reappears. Closing narration (courts.closing) is written to read
// correctly under any of the five outcomes, same discipline as war.closing's
// win/loss-agnostic phrasing.
//
// courtsFileFalseCharge reuses BALANCE.secrets.claudius's trialSeed/
// startsDelaySeasons (0 / 1 season) rather than inventing new numbers or
// copying the generic NPC-initiated formula (accuserIntrigus*2 +
// corruption/2) — those two constants are Claudius's own, already tuned and
// simulated (__tests__/p5h.test.ts's "Claudius trial" test) for exactly this
// design goal: a Claudius-filed trial a clean defendant can comfortably win
// with a handful of real prep actions. Same antagonist, same "weak by
// construction, do not additionally rig it" goal (plan finding 24) — a new,
// separately-tuned constant would just restate the same value under a
// different name.
const COURTS_STEPS: TutorialStep[] = [
  {
    id: 'courts.intro',
    arc: 'courts',
    actLabel: 'The Courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "Domine. The standoff with Appius Claudius Pulcher holds — he cannot use what he holds over " +
      "this family without exposing what you hold over him. A patient man would leave it there. He " +
      "will not.",
    advance: { kind: 'tap' },
  },
  {
    id: 'courts.charge-gate',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "The courts move at their own pace, Domine, and hear one matter of the family's at a time. " +
      "Claudius will have his moment the instant they are free to give him one.",
    advance: { kind: 'predicate', predicateId: 'courtsEntryClear' },
  },
  {
    id: 'courts.charge-filed',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Curia',
    target: 'curia.trial-banner',
    narration:
      "There. Formal charges of repetundae — plundering a province under color of office, the " +
      "Verres charge — brought against you by Appius Claudius Pulcher himself. A lie, Domine: " +
      "your command in Sicilia was clean, and he knows it. He cannot touch the secret between you " +
      "without losing it, so he has invented one instead.",
    advance: { kind: 'tap' },
    onEnterEffectId: 'courtsFileFalseCharge',
  },
  {
    id: 'courts.basilica-intro',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "Open the Basilica. A weak case is still a case, and an unanswered one convicts itself. " +
      "Choose how the family argues it — procedure, ferocity, or sympathy for the jury — and who " +
      "speaks for you. The choice, again, is yours.",
    advance: { kind: 'tap' },
  },
  {
    id: 'courts.prep-logos',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "Logos first: the facts of the matter. Gather evidence, or present a secret as evidence " +
      "outright if you hold one that fits — whatever the Basilica offers under that heading, take it.",
    advance: { kind: 'predicate', predicateId: 'courtsLogosPrepared' },
  },
  {
    id: 'courts.prep-pathos',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "Pathos: the human weight of it. A witness secured, an oration prepared — the jury are men, " +
      "not ledgers, and men are moved by more than facts.",
    advance: { kind: 'predicate', predicateId: 'courtsPathosPrepared' },
  },
  {
    id: 'courts.prep-ethos',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "Ethos: your standing itself. Invoke the family's ancestors, or — Rome being Rome — spend to " +
      "quietly improve a juror's opinion of you. Spend carefully; a discovered bribe costs more " +
      "than it buys.",
    advance: { kind: 'predicate', predicateId: 'courtsEthosPrepared' },
  },
  {
    id: 'courts.wait-for-trial-day',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    target: 'shared.end-season',
    narration: "Close the season, Domine, until the day itself arrives.",
    advance: { kind: 'predicate', predicateId: 'courtsTrialDayArrived' },
  },
  {
    id: 'courts.trial-day',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "The Basilica is full. Answer the court as it presses you — three exchanges, and the matter " +
      "is decided.",
    advance: { kind: 'predicate', predicateId: 'courtsVerdictReached' },
  },
  {
    id: 'courts.closing',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "Whatever the court decided, Domine, it decided something real — a false charge, met with an " +
      "honest defense, argued on the strength of what you actually prepared, not what you were " +
      "owed. That is the last of it. Appius Claudius Pulcher could not use what he held over this " +
      "family without losing it himself — so he tried a lie instead, and the lie stood or fell on " +
      "its own. Not virtue, and not leverage alone, either. Preparation, met honestly. Philon's part " +
      "in this ends here, Domine. The rest of the history is yours to write.",
    advance: { kind: 'tap' },
  },
  // Tutorial redesign — the actual hand-off beat. Distinct from courts.closing
  // on purpose: that step's "Philon's part in this ends here" closes the
  // courts drama specifically, not Philon's ongoing presence, and cramming
  // this practical note into the same caption made an already-long beat
  // unwieldy. Firing philonAdvisoryUnlocked here (not earlier) means neither
  // AmbitionSelectionModal nor the Agenda Tablet has been able to surface
  // ANYTHING throughout the entire guided run until Philon says so himself —
  // see philonAdvisoryUnlocked's own doc comment on GameState. This is now
  // the arc's real last step (courtsCourtsArc.test.ts's "arc's last step
  // carries courtsSetCompleteFlag" moved onto it, not courts.closing).
  {
    id: 'courts.philon-handoff',
    arc: 'courts',
    rail: 'guided',
    requiresTab: 'Cursus',
    narration:
      "One thing more before I truly step back, Domine. Twice more Rome will want your attention " +
      "unprompted: an ambition worth chasing — yours to choose, starting now — and, each season " +
      "after, a tablet of my own notes, Ex Tabulis Philonis, whenever something demands it. I " +
      "merely surface them from here on. The choosing, as ever, is yours.",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'courtsSetCompleteFlag',
  },
];

// ─── T10 — Just-in-time micro-lessons ───────────────────────────────────────
// Standalone one-off arcs (models/tutorial.ts's TutorialLessonId), NOT part
// of TUTORIAL_ARC_ORDER's main chain. Each is entered by
// tutorialEngine.getEligibleLesson (via the App.tsx director, same
// subscription as the main chain) the first time its own condition holds
// AND no arc/lesson is already active, and fires exactly once per save
// (flag-gated) — including on Free Start, which never runs the four main
// arcs at all. All `rail: 'guided'` (never hard-rails a tab or the world).

// Fires the first time a trial exists that the player was never taught
// about — i.e. they never completed the courts arc (Free Start, or a
// guided run that skipped ahead). Reuses curia.trial-banner, the SAME
// target T9's courts arc already instruments — no new spotlight wiring.
const LESSON_TRIAL_STEPS: TutorialStep[] = [
  {
    id: 'lesson-trial.intro',
    arc: 'lesson-trial',
    rail: 'guided',
    requiresTab: 'Curia',
    target: 'curia.trial-banner',
    narration:
      "Domine — a charge has been brought against the family. That banner tracks it: your strength " +
      "against theirs, and the seasons remaining to prepare. Open the Basilica from Cursus and " +
      "answer it there — Logos, Pathos, and Ethos, whichever mix you judge the case needs.",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'lessonTrialSetTaught',
  },
];

// Delivered entirely inside BattleScreen.tsx itself, not the global
// TutorialLayer (App.tsx) — BattleScreen is a native `Modal`, same
// precedence problem as every other modal-housed step in this file, except
// here there's no "outside" screen to spotlight from: the whole lesson
// happens inside the modal. BattleScreen.tsx mounts its own TutorialCaption
// reading this SAME tutorial.stepId, gated locally on which phase is
// actually on screen (deployment vs. live orders) — see that file's own
// comment. No `target`: DeploymentBoard/OrdersPanel are unfamiliar UI this
// chunk doesn't risk mis-instrumenting for a cutout: two plain captions.
//
// Entry condition (tutorialEngine.getEligibleLesson) is `activeBattleSetup`
// truthy AND no arc/lesson already active — which excludes the war arc's
// OWN scripted engagement automatically: if the player "Takes the Field" on
// that fight, tutorial.activeArc is still 'war' at that moment, so this
// lesson never fires mid-Arc-II. It only ever fires on a LATER, real
// set-piece battle — the interactive deployment/orders/wings flow the
// tutorial otherwise never explains at all (Arc II only ever taught the
// abstract "Trust the Legate" resolution).
const LESSON_BATTLE_STEPS: TutorialStep[] = [
  {
    id: 'lesson-battle.deployment',
    arc: 'lesson-battle',
    rail: 'guided',
    narration:
      "A real field of battle, Domine — not a season-end abstraction. Assign your commander a wing, " +
      "read the ground and the stratagem hand you've drawn, then give battle when you're ready. " +
      "Nothing here is decided until you commit.",
    advance: { kind: 'tap' },
  },
  {
    id: 'lesson-battle.orders',
    arc: 'lesson-battle',
    rail: 'guided',
    narration:
      "Each round, issue orders for all three wings — hold, advance, or commit a stratagem — then " +
      "watch it resolve. A broken wing forces a choice: pursue the routers, or wheel the victors onto " +
      "the fight beside them. Toggle Dispatches for the full written account of a round.",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'lessonBattleSetTaught',
  },
];

// Delivered as a single beat AFTER the death notice closes (EventModal
// always wins over a spotlight — same rule as every native-Modal-housed
// step elsewhere in this file). Fires on EITHER the paterfamilias's own
// death (evt-succession-death) or, since this chunk, any other family
// member's (the new evt-family-death-natural, data/successionEvents.ts) —
// turnSequencer.ts's natural-mortality step stamps
// flags['pending-lesson-death'] unconditionally whenever either fires.
// Battle/trial-execution deaths of the paterfamilias are NOT wired to this
// flag (scope call — see tutorialEngine.ts's getEligibleLesson comment):
// natural aging is by far the common case this early in a run, and a player
// whose first death happens to be a battle casualty still gets the lesson
// on whichever natural death follows.
const LESSON_DEATH_STEPS: TutorialStep[] = [
  {
    id: 'lesson-death.intro',
    arc: 'lesson-death',
    rail: 'guided',
    narration:
      "Death visits every house, Domine — not only the ones the histories remember. Mourn if you " +
      "must, but Rome does not pause for grief, and neither, in time, will you.",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'lessonDeathSetTaught',
  },
];

// Fires once the paterfamilias actually changes — inheritanceEngine.ts's
// applySuccession stamps flags['pending-lesson-succession'] at its one call
// site, regardless of what killed the previous paterfamilias (natural,
// battle, or a trial's Exiled/Executed verdict all funnel through it).
const LESSON_SUCCESSION_STEPS: TutorialStep[] = [
  {
    id: 'lesson-succession.intro',
    arc: 'lesson-succession',
    rail: 'guided',
    narration:
      "The name on the house changes, Domine, not the house itself. A fresh Cursus Honorum, a clean " +
      "slate of offices — and, if the new head of the family is still a boy, a regent governs in his " +
      "name until he comes of age. The family goes on. See to it that it's worth going on for.",
    advance: { kind: 'tap' },
    onCompleteEffectId: 'lessonSuccessionSetTaught',
  },
];

export const TUTORIAL_ARCS: Record<TutorialAnyArcId, TutorialArc> = {
  prologue: {
    id: 'prologue',
    title: 'The First Year',
    steps: [
      ...PROLOGUE_ACT1_STEPS, ...PROLOGUE_ACT2_STEPS, ...PROLOGUE_ACT3_STEPS,
      ...PROLOGUE_ACT4_STEPS, ...PROLOGUE_ACT5_STEPS,
    ],
  },
  embassy:  { id: 'embassy',  title: 'The Embassy',     steps: [...EMBASSY_STEPS] },
  war:      { id: 'war',      title: 'The War',         steps: [...WAR_STEPS] },
  courts:   { id: 'courts',   title: 'The Courts',      steps: [...COURTS_STEPS] },

  // T10 — just-in-time lessons, standalone (see the header comment above).
  'lesson-trial':      { id: 'lesson-trial',      title: 'The Charge',        steps: [...LESSON_TRIAL_STEPS] },
  'lesson-battle':     { id: 'lesson-battle',     title: 'The Field',         steps: [...LESSON_BATTLE_STEPS] },
  'lesson-death':      { id: 'lesson-death',      title: 'A Death',          steps: [...LESSON_DEATH_STEPS] },
  'lesson-succession': { id: 'lesson-succession', title: 'A New Head',       steps: [...LESSON_SUCCESSION_STEPS] },
};
