// ─── Phase 4, Chunk P4-E — Trial day: the beat library ───────────────────────
// Static content only (CLAUDE.md layer rule) — draw/evaluation logic lives in
// engine/trialBeatEngine.ts. Courtroom copy is forensic register throughout,
// never Philon's voice (design invariant — courtroom beats are never notices).
//
// Tag pools (trialBeatEngine.drawTrialBeats):
//   slot 1 — charge-tagged: intersects data/trialCharges.ts's beatTags for the
//            trial's charge. Every 'financial' beat below serves BOTH
//            repetundae and peculatus (their beatTags both include
//            'financial') rather than duplicating near-identical content per
//            charge.
//   slot 2 — approach-tagged OR opponent-trait-tagged (data/traits.ts ids).
//            Ten beats below double as trait-tagged by adding a second tag to
//            an already-charge-tagged beat — one matching beat per trait is
//            enough (slot 2's pool is approach beats ∪ the opponent's own
//            1-trait match, not an independently-sized pool).
//   slot 3 / fallback — 'general'.
//   mandatory — 'witness_attack' (forced whenever an unattacked witness
//            exists), 'bribe_discovered_jurors' / 'bribe_discovered_praetor'
//            (forced once per bribe the session-start discovery roll catches).
//
// Every response's `kind: 'stat'` reuses eventEngine.resolveEventChoice's
// exact threshold idiom (skillVal >= difficulty, no roll) — design invariant
// 2's "the verdict itself is a deterministic threshold" applies one level
// down to every beat response too, not just the final verdict math.
// `kind: 'plain'` responses always succeed (no check) — swing.failure is set
// equal to swing.success on those and never actually read.

import type { TrialBeat } from '../models/trial';

export const TRIAL_BEATS: TrialBeat[] = [
  // ── Financial (repetundae + peculatus share this pool via 'financial') ───
  {
    id: 'b-financial-ledger',
    tags: ['financial', 'provincial', 'repetundae'],
    complication: 'A provincial ledger surfaces, its columns suspiciously round — the kind of numbers a man writes when he is inventing them, not remembering them.',
    responses: [
      { id: 'r1', label: 'Argue the rounding is a quaestor\'s ordinary shorthand', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'The jury nods — bookkeeping is bookkeeping, after all.',
        failureText: 'The rounding looks worse the longer your speaker dwells on it.' },
      { id: 'r2', label: 'Set your own audited accounts against it', kind: 'prep', requires: { kind: 'evidence_uses', min: 2 },
        swing: { success: 6, failure: -4 },
        successText: 'Your gathered evidence makes the comparison an easy one.',
        failureText: 'Without enough of your own paperwork, the comparison falls flat.' },
      { id: 'r3', label: 'Concede the discrepancy is unexplained and move on', kind: 'plain',
        swing: { success: -2, failure: -2 },
        successText: 'A small admission, quickly buried under the next witness.',
        failureText: 'A small admission, quickly buried under the next witness.' },
    ],
  },
  {
    id: 'b-financial-scribe',
    tags: ['financial', 'peculatus'],
    complication: 'The treasury scribe\'s tally does not match the sum the defense has claimed all along — by not very much, but not by nothing either.',
    responses: [
      { id: 'r1', label: 'Cross-examine the scribe\'s method', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 7, failure: -5 },
        successText: 'The scribe admits his own tally was done in haste.',
        failureText: 'The scribe holds his ground, and so does the discrepancy.' },
      { id: 'r2', label: 'Have your own witness corroborate the claimed sum', kind: 'prep', requires: { kind: 'witness' },
        swing: { success: 7, failure: -5 },
        successText: 'A second voice agreeing with the first carries real weight.',
        failureText: 'One voice against the treasury\'s own scribe is not enough.' },
    ],
  },
  {
    id: 'b-financial-audit',
    tags: ['financial', 'peculatus', 'sharp_mind'],
    complication: 'An independent auditor is called to the stand, and begins reading figures aloud with unnerving precision.',
    responses: [
      { id: 'r1', label: 'Match him figure for figure', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 9, failure: -7 },
        successText: 'Your speaker keeps pace, and the jury\'s eyes stop narrowing.',
        failureText: 'The auditor\'s precision outpaces your speaker\'s recall.' },
      { id: 'r2', label: 'Let the presented evidence speak instead of the speaker', kind: 'prep', requires: { kind: 'evidence_uses', min: 3 },
        swing: { success: 8, failure: -6 },
        successText: 'A thick sheaf of your own gathered evidence blunts his precision.',
        failureText: 'With too little evidence of your own, his figures stand unanswered.' },
    ],
  },
  {
    id: 'b-financial-strongbox',
    tags: ['financial', 'peculatus', 'ruthless'],
    complication: 'The temple strongbox itself is produced before the court, its seal visibly broken and re-set.',
    responses: [
      { id: 'r1', label: 'Insist the seal was broken by the temple\'s own priests, routinely', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -7 },
        successText: 'Two of the priests present nod along — routine, indeed.',
        failureText: 'No one present will vouch for a "routine" broken seal.' },
      { id: 'r2', label: 'Question who else held a key', kind: 'stat', skill: 'intrigus', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'It emerges three men held keys, not one — reasonable doubt, handed to you.',
        failureText: 'No one else is willing to admit holding a key.' },
    ],
  },
  {
    id: 'b-financial-envoy',
    tags: ['financial', 'provincial', 'ancient_blood'],
    complication: 'A provincial envoy testifies to grain quotas that, by his account, never arrived at all.',
    responses: [
      { id: 'r1', label: 'Press him on the shipping records', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 7, failure: -5 },
        successText: 'His memory of the shipping manifests turns out to be thin.',
        failureText: 'His memory of the shipping manifests holds up uncomfortably well.' },
      { id: 'r2', label: 'Undercut him with your own gathered evidence', kind: 'prep', requires: { kind: 'evidence_uses', min: 1 },
        swing: { success: 6, failure: -4 },
        successText: 'A single contradicting document is enough to seed doubt.',
        failureText: 'Without anything gathered to set against him, his account stands.' },
    ],
  },

  // ── Ambitus (electoral fraud) ────────────────────────────────────────────
  {
    id: 'b-ambitus-centurion',
    tags: ['ambitus', 'electoral'],
    complication: 'A voting-tribe centurion admits, haltingly, that denarii changed hands before the tribal vote.',
    responses: [
      { id: 'r1', label: 'Establish the payment was for a feast, not a vote', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'Munificence is not bribery, your speaker reminds the court — and the jury agrees.',
        failureText: 'The distinction between a feast and a bribe does not survive cross-examination.' },
      { id: 'r2', label: 'Have a witness confirm the feast actually happened', kind: 'prep', requires: { kind: 'witness' },
        swing: { success: 7, failure: -5 },
        successText: 'Your witness recalls the feast in convincing, mundane detail.',
        failureText: 'Without a witness to the feast, the centurion\'s account stands alone.' },
    ],
  },
  {
    id: 'b-ambitus-crowd',
    tags: ['ambitus', 'electoral', 'silver_tongue'],
    complication: 'A hired crowd\'s cheers on election day are recalled by a witness a little too vividly for comfort.',
    responses: [
      { id: 'r1', label: 'Dismiss enthusiasm as evidence of nothing', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 7, failure: -5 },
        successText: '"Popularity is not a crime," your speaker says, and the room half-laughs.',
        failureText: 'The jury does not share the joke.' },
      { id: 'r2', label: 'Let it pass without comment', kind: 'plain',
        swing: { success: -1, failure: -1 },
        successText: 'A shrug, and the court moves on.',
        failureText: 'A shrug, and the court moves on.' },
    ],
  },
  {
    id: 'b-ambitus-tally',
    tags: ['ambitus', 'electoral'],
    complication: 'The comitia\'s tally sheet shows an improbable spike in one century\'s votes, all cast within the same quarter-hour.',
    responses: [
      { id: 'r1', label: 'Question the clerk who recorded the tally', kind: 'stat', skill: 'intrigus', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'The clerk\'s own recordkeeping turns out to be the weak link, not the vote.',
        failureText: 'The clerk\'s recordkeeping, infuriatingly, checks out.' },
      { id: 'r2', label: 'Present your own tally records as a counter', kind: 'prep', requires: { kind: 'evidence_uses', min: 2 },
        swing: { success: 7, failure: -5 },
        successText: 'A second set of numbers muddies the spike enough to matter.',
        failureText: 'With no counter-tally of your own, the spike stands unexplained.' },
    ],
  },
  {
    id: 'b-ambitus-oath',
    tags: ['ambitus', 'electoral', 'nobilitas'],
    complication: 'Sworn statements from the tribe\'s own assessors are entered into the record, each one reciting the accuser\'s consular lineage before answering a single question.',
    responses: [
      { id: 'r1', label: 'Remind the court that ancestry is not evidence', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 9, failure: -6 },
        successText: 'The reminder lands — the assessors\' testimony is weighed on its facts, not its pedigree.',
        failureText: 'The room is not so easily unimpressed by a great name.' },
      { id: 'r2', label: 'Invoke your own family\'s record in reply', kind: 'prep', requires: { kind: 'evidence_uses', min: 1 },
        swing: { success: 6, failure: -4 },
        successText: 'A modest recitation of your own is enough to level the room.',
        failureText: 'Your own record, thin by comparison, does not help.' },
    ],
  },
  {
    id: 'b-ambitus-agent',
    tags: ['ambitus', 'electoral'],
    complication: 'The accused\'s own canvassing agent is called — and declines, politely but firmly, to answer several questions at all.',
    responses: [
      { id: 'r1', label: 'Press the silence as an admission', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: '"His silence speaks for him," your speaker says, and the jury seems to agree.',
        failureText: 'The praetor rules the silence proves nothing, and the moment passes.' },
      { id: 'r2', label: 'Let the silence stand on its own', kind: 'plain',
        swing: { success: 3, failure: 3 },
        successText: 'You say nothing — and let the room draw its own conclusion.',
        failureText: 'You say nothing — and let the room draw its own conclusion.' },
    ],
  },

  // ── Maiestas (treason) ───────────────────────────────────────────────────
  {
    id: 'b-maiestas-letter',
    tags: ['maiestas', 'treason'],
    complication: 'A letter is read aloud to the court, its meaning bitterly disputed between the two sides.',
    responses: [
      { id: 'r1', label: 'Offer the more charitable reading, word by word', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 10, failure: -8 },
        successText: 'Your speaker\'s reading is the one the jury remembers.',
        failureText: 'The prosecution\'s darker reading is the one that sticks.' },
      { id: 'r2', label: 'Call the letter\'s recipient to explain its context', kind: 'prep', requires: { kind: 'witness' },
        swing: { success: 9, failure: -6 },
        successText: 'Context from someone who was actually there changes the room\'s mood entirely.',
        failureText: 'Without the recipient to explain it, the letter is left to speak for itself — badly.' },
    ],
  },
  {
    id: 'b-maiestas-legion',
    tags: ['maiestas', 'treason', 'iron_will'],
    complication: 'A legionary swears under oath that he heard words at the standard that no loyal Roman should have spoken.',
    responses: [
      { id: 'r1', label: 'Undermine his position to have overheard anything at all', kind: 'stat', skill: 'intrigus', difficulty: 7,
        swing: { success: 9, failure: -7 },
        successText: 'It emerges he stood nowhere near close enough to hear clearly.',
        failureText: 'His position, infuriatingly, checks out — he was close enough.' },
      { id: 'r2', label: 'Grind through the account line by line, unhurried', kind: 'plain',
        swing: { success: 1, failure: 1 },
        successText: 'A long, patient unpicking that wins no drama and loses no ground either.',
        failureText: 'A long, patient unpicking that wins no drama and loses no ground either.' },
    ],
  },
  {
    id: 'b-maiestas-priest',
    tags: ['maiestas', 'treason', 'great_orator'],
    complication: 'The augurs are summoned and asked, before the whole court, whether the omens of that day were knowingly defied.',
    responses: [
      { id: 'r1', label: 'Match the augurs\' gravity with your own', kind: 'stat', skill: 'rhetoric', difficulty: 8,
        swing: { success: 10, failure: -8 },
        successText: 'Your speaker holds the room\'s attention as surely as the priests do.',
        failureText: 'The augurs\' solemnity fills the room, and your speaker\'s answer is lost in it.' },
      { id: 'r2', label: 'Invoke your own family\'s piety as a character', kind: 'prep', requires: { kind: 'evidence_uses', min: 2 },
        swing: { success: 8, failure: -6 },
        successText: 'A well-documented record of piety softens the question considerably.',
        failureText: 'Without much on record, the question of piety is left uncomfortably open.' },
    ],
  },
  {
    id: 'b-maiestas-oath',
    tags: ['maiestas', 'treason', 'father_of_senate'],
    complication: 'A senior voice in the gallery — one the whole chamber quiets for — demands a public oath of loyalty, here, now.',
    responses: [
      { id: 'r1', label: 'Take the oath without hesitation', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 8, failure: -9 },
        successText: 'The oath is given cleanly, and the demand loses its edge.',
        failureText: 'Even a clean oath cannot undo the damage of having been asked at all.' },
      { id: 'r2', label: 'Object to the demand as theater, not law', kind: 'plain',
        swing: { success: -3, failure: -3 },
        successText: 'The objection is noted — and so, quietly, is the refusal.',
        failureText: 'The objection is noted — and so, quietly, is the refusal.' },
    ],
  },
  {
    id: 'b-maiestas-crowd',
    tags: ['maiestas', 'treason'],
    complication: 'The crowd outside the Basilica grows audibly loud at the word "treason" — the noise carries into the chamber itself.',
    responses: [
      { id: 'r1', label: 'Ask the praetor to clear the gallery', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 6, failure: -4 },
        successText: 'The gallery clears, and the room\'s temperature drops with it.',
        failureText: 'The praetor declines — the crowd, and its verdict on you, stays.' },
      { id: 'r2', label: 'Let the noise pass unremarked', kind: 'plain',
        swing: { success: -2, failure: -2 },
        successText: 'The noise fades on its own, eventually.',
        failureText: 'The noise fades on its own, eventually.' },
    ],
  },

  // ── Military incompetence ────────────────────────────────────────────────
  {
    id: 'b-military-retreat',
    tags: ['military', 'command'],
    complication: 'A centurion describes the retreat in blunt soldier\'s Latin — no rhetoric in it at all, which is exactly why it lands.',
    responses: [
      { id: 'r1', label: 'Reframe the retreat as a disciplined withdrawal', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 9, failure: -7 },
        successText: '"A withdrawal in good order," your speaker insists, and enough of the jury believes it.',
        failureText: 'No amount of rhetoric turns a rout into an order, not to this jury.' },
      { id: 'r2', label: 'Call a fellow officer to corroborate the order', kind: 'prep', requires: { kind: 'witness' },
        swing: { success: 8, failure: -6 },
        successText: 'A second officer\'s account of the same order carries real weight.',
        failureText: 'Without corroboration, one soldier\'s account stands unanswered.' },
    ],
  },
  {
    id: 'b-military-standard',
    tags: ['military', 'command', 'conqueror'],
    complication: 'The lost standard itself is produced before the court, laid on the tribunal\'s table for all to see.',
    responses: [
      { id: 'r1', label: 'Argue the standard was recovered, not abandoned', kind: 'stat', skill: 'rhetoric', difficulty: 8,
        swing: { success: 10, failure: -9 },
        successText: 'The distinction between "lost" and "recovered" is the whole case, and your speaker wins it.',
        failureText: 'The standard sitting on the table speaks louder than any distinction your speaker can draw.' },
      { id: 'r2', label: 'Present the muster records of the recovery detachment', kind: 'prep', requires: { kind: 'evidence_uses', min: 2 },
        swing: { success: 9, failure: -7 },
        successText: 'The paperwork of the recovery itself does what argument alone could not.',
        failureText: 'Without the muster records in hand, the recovery is only a claim.' },
    ],
  },
  {
    id: 'b-military-desertion',
    tags: ['military', 'command', 'soldier_born'],
    complication: 'Desertion figures from the campaign are read into the record, one grim number after another.',
    responses: [
      { id: 'r1', label: 'Compare the figures to other commanders\' campaigns', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'The numbers, set beside others\', turn out to be unremarkable.',
        failureText: 'The comparison does not land — these numbers still look bad.' },
      { id: 'r2', label: 'Let the figures stand without comment', kind: 'plain',
        swing: { success: -2, failure: -2 },
        successText: 'The numbers are left to speak for themselves, for better or worse.',
        failureText: 'The numbers are left to speak for themselves, for better or worse.' },
    ],
  },
  {
    id: 'b-military-council',
    tags: ['military', 'command'],
    complication: 'Fellow officers are asked, one by one, whether the disputed order was actually given as claimed.',
    responses: [
      { id: 'r1', label: 'Have your own officer testify first, and firmly', kind: 'prep', requires: { kind: 'witness' },
        swing: { success: 8, failure: -6 },
        successText: 'Your officer\'s account sets the tone before the others even speak.',
        failureText: 'Without your own officer to speak first, the others\' hesitations shape the room.' },
      { id: 'r2', label: 'Cross-examine each hesitation directly', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 9, failure: -7 },
        successText: 'Pressed, the hesitations resolve in the order\'s favor.',
        failureText: 'Pressed, the hesitations only grow more damning.' },
    ],
  },
  {
    id: 'b-military-supply',
    tags: ['military', 'command'],
    complication: 'A quartermaster testifies the campaign\'s supply lines were left dangerously thin before the engagement.',
    responses: [
      { id: 'r1', label: 'Blame the Senate\'s own funding delays', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'The blame shifts, at least partly, to the purse-holders back in Rome.',
        failureText: 'The Senate, absent from the room, is an unconvincing scapegoat today.' },
      { id: 'r2', label: 'Present the funding requests you filed at the time', kind: 'prep', requires: { kind: 'evidence_uses', min: 1 },
        swing: { success: 7, failure: -5 },
        successText: 'A dated request for more supply is worth more than any excuse.',
        failureText: 'With nothing on record, the excuse is all you have.' },
    ],
  },

  // ── Approach-tagged (slot 2) ─────────────────────────────────────────────
  {
    id: 'b-approach-ferocity',
    tags: ['ferocity', 'surprise'],
    complication: 'Your speaker\'s opening broadside draws gasps from the gallery — and a sharp objection from the other side.',
    responses: [
      { id: 'r1', label: 'Press the attack without flinching', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 10, failure: -8 },
        successText: 'The objection is overruled, and the broadside stands.',
        failureText: 'The objection is sustained, and the broadside is struck from the record.' },
      { id: 'r2', label: 'Soften the blow with a measured aside', kind: 'plain',
        swing: { success: 2, failure: 2 },
        successText: 'A small retreat that costs little and offends no one.',
        failureText: 'A small retreat that costs little and offends no one.' },
    ],
  },
  {
    id: 'b-approach-procedure',
    tags: ['procedure'],
    complication: 'A procedural technicality is raised over the precise wording of the indictment itself.',
    responses: [
      { id: 'r1', label: 'Cite your own filed evidence to settle the wording', kind: 'prep', requires: { kind: 'evidence_uses', min: 1 },
        swing: { success: 6, failure: -4 },
        successText: 'The paperwork resolves the wording dispute cleanly.',
        failureText: 'With nothing filed to point to, the wording dispute drags on unresolved.' },
      { id: 'r2', label: 'Argue the point live before the praetor', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 6, failure: -4 },
        successText: 'The praetor rules in your favor on the wording.',
        failureText: 'The praetor rules against you on the wording.' },
    ],
  },
  {
    id: 'b-approach-sympathy',
    tags: ['sympathy'],
    complication: 'A grieving relation of the accuser is brought forward, visibly, to sway the jury\'s heart before its head.',
    responses: [
      { id: 'r1', label: 'Answer with equal feeling, not facts', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 8, failure: -6 },
        successText: 'Your speaker\'s own feeling, honestly shown, answers theirs in kind.',
        failureText: 'The theater of grief outmatches anything your speaker offers back.' },
      { id: 'r2', label: 'Object to the theatrics outright', kind: 'plain',
        swing: { success: -3, failure: -3 },
        successText: 'The objection is noted, and the room notes your coldness in making it.',
        failureText: 'The objection is noted, and the room notes your coldness in making it.' },
    ],
  },

  // ── General pool (slot 3 fallback) ──────────────────────────────────────
  {
    id: 'b-general-recess',
    tags: ['general'],
    complication: 'The praetor calls a brief recess. Both sides use it to confer, and to be seen conferring.',
    responses: [
      { id: 'r1', label: 'Use the recess to steady your speaker', kind: 'plain',
        swing: { success: 3, failure: 3 },
        successText: 'A quiet word, and your speaker returns composed.',
        failureText: 'A quiet word, and your speaker returns composed.' },
      { id: 'r2', label: 'Use the recess to needle the other side instead', kind: 'stat', skill: 'intrigus', difficulty: 6,
        swing: { success: 6, failure: -4 },
        successText: 'A word dropped in the right ear leaves the other side visibly rattled.',
        failureText: 'The needling is noticed, and not appreciated by the praetor.' },
    ],
  },
  {
    id: 'b-general-crowd-murmur',
    tags: ['general'],
    complication: 'A murmur runs through the watching crowd at some remark — it is hard to tell, from the bench, which way it leans.',
    responses: [
      { id: 'r1', label: 'Address the crowd directly, briefly', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 6, failure: -4 },
        successText: 'The address turns the murmur in your favor.',
        failureText: 'The address does not land, and the murmur turns against you.' },
      { id: 'r2', label: 'Ignore the crowd entirely', kind: 'plain',
        swing: { success: 0, failure: 0 },
        successText: 'The murmur passes, unaddressed and unresolved.',
        failureText: 'The murmur passes, unaddressed and unresolved.' },
    ],
  },
  {
    id: 'b-general-scribe-error',
    tags: ['general'],
    complication: 'The court scribe misrecords a name in the transcript; a correction is demanded before the record can proceed.',
    responses: [
      { id: 'r1', label: 'Demand the correction be entered at once', kind: 'plain',
        swing: { success: 2, failure: 2 },
        successText: 'The correction is entered, and the delay costs little.',
        failureText: 'The correction is entered, and the delay costs little.' },
      { id: 'r2', label: 'Use the delay to reposition your argument', kind: 'stat', skill: 'rhetoric', difficulty: 5,
        swing: { success: 5, failure: -3 },
        successText: 'The pause gives your speaker room to land the next point cleanly.',
        failureText: 'The pause helps the other side more than it helps you.' },
    ],
  },
  {
    id: 'b-general-late-witness',
    tags: ['general'],
    complication: 'A witness arrives late and flustered, and is admitted to testify anyway over quiet objection.',
    responses: [
      { id: 'r1', label: 'Use the confusion to your advantage', kind: 'stat', skill: 'intrigus', difficulty: 6,
        swing: { success: 7, failure: -5 },
        successText: 'The witness\'s fluster works in your favor under questioning.',
        failureText: 'The witness recovers their composure faster than expected.' },
      { id: 'r2', label: 'Let the witness settle before proceeding', kind: 'plain',
        swing: { success: 1, failure: 1 },
        successText: 'A moment of patience costs nothing and offends no one.',
        failureText: 'A moment of patience costs nothing and offends no one.' },
    ],
  },
  {
    id: 'b-general-closing',
    tags: ['general'],
    complication: 'Both sides are given a moment for closing remarks before the matter is put to the verdict.',
    responses: [
      { id: 'r1', label: 'Close with the strongest evidence in hand', kind: 'prep', requires: { kind: 'evidence_uses', min: 1 },
        swing: { success: 7, failure: -5 },
        successText: 'The closing lands on solid ground, evidence in hand.',
        failureText: 'With little to close on, the remarks ring hollow.' },
      { id: 'r2', label: 'Close on feeling rather than fact', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 7, failure: -5 },
        successText: 'The closing words are the ones the jury carries into the verdict.',
        failureText: 'The closing words fall flat, and the room\'s attention drifts.' },
    ],
  },

  // ── Mandatory — bribe discovered ────────────────────────────────────────
  {
    id: 'b-bribe-jurors-1',
    tags: ['bribe_discovered_jurors'],
    complication: 'Word reaches the court, mid-session, that one voting bloc\'s favor was bought — and everyone in the room now knows it.',
    responses: [
      { id: 'r1', label: 'Distance your case from the scandal at once', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 4, failure: -10 },
        successText: 'The distancing is believed, mostly — the damage is contained, not undone.',
        failureText: 'No one believes the distancing, and the scandal attaches itself to the whole case.' },
      { id: 'r2', label: 'Say nothing and let the moment pass', kind: 'plain',
        swing: { success: -8, failure: -8 },
        successText: 'The silence is itself read as an admission.',
        failureText: 'The silence is itself read as an admission.' },
    ],
  },
  {
    id: 'b-bribe-jurors-2',
    tags: ['bribe_discovered_jurors'],
    complication: 'One of the bribed jurors, conscience-stricken, confesses the whole arrangement in open session.',
    responses: [
      { id: 'r1', label: 'Argue the confession implicates an agent, not you', kind: 'stat', skill: 'intrigus', difficulty: 7,
        swing: { success: 5, failure: -10 },
        successText: 'The line between you and your agent holds, barely.',
        failureText: 'The line between you and your agent does not hold at all.' },
      { id: 'r2', label: 'Accept the disgrace and press on regardless', kind: 'plain',
        swing: { success: -7, failure: -7 },
        successText: 'The case survives the disgrace, diminished but standing.',
        failureText: 'The case survives the disgrace, diminished but standing.' },
    ],
  },
  {
    id: 'b-bribe-praetor-1',
    tags: ['bribe_discovered_praetor'],
    complication: 'A clerk quietly reports irregular payments reaching the presiding Praetor\'s own household.',
    responses: [
      { id: 'r1', label: 'Demand the Praetor recuse himself', kind: 'stat', skill: 'rhetoric', difficulty: 8,
        swing: { success: 3, failure: -12 },
        successText: 'The demand is granted, at real cost to your standing with him regardless.',
        failureText: 'The demand is refused, and the Praetor\'s mood toward your case sours further.' },
      { id: 'r2', label: 'Let the matter lie unremarked', kind: 'plain',
        swing: { success: -9, failure: -9 },
        successText: 'The matter lies unremarked — and unresolved.',
        failureText: 'The matter lies unremarked — and unresolved.' },
    ],
  },
  {
    id: 'b-bribe-praetor-2',
    tags: ['bribe_discovered_praetor'],
    complication: 'Asked pointedly whether he ought to recuse himself, the Praetor does not — and the room takes note of exactly what that means.',
    responses: [
      { id: 'r1', label: 'Press the point once more, formally, for the record', kind: 'stat', skill: 'rhetoric', difficulty: 7,
        swing: { success: 4, failure: -11 },
        successText: 'The formal objection is entered, and at least the record is clean.',
        failureText: 'The formal objection is waved off, and the record shows only your insistence.' },
      { id: 'r2', label: 'Drop it rather than provoke him further', kind: 'plain',
        swing: { success: -6, failure: -6 },
        successText: 'The moment passes without further provocation.',
        failureText: 'The moment passes without further provocation.' },
    ],
  },

  // ── Mandatory — witness attacked ────────────────────────────────────────
  {
    id: 'b-witness-attack-1',
    tags: ['witness_attack'],
    complication: 'Opposing counsel corners your witness in the corridor before they can even take the stand.',
    responses: [
      { id: 'r1', label: 'Have your witness testify immediately, before further contact', kind: 'prep', requires: { kind: 'witness' },
        swing: { success: 6, failure: -8 },
        successText: 'Your witness takes the stand rattled but intact, and testifies as planned.',
        failureText: 'Your witness takes the stand, but the corridor conversation shows in every answer.' },
      { id: 'r2', label: 'Withdraw the witness rather than risk it', kind: 'plain',
        swing: { success: -4, failure: -4 },
        successText: 'The witness is withdrawn — a quiet loss, not a public one.',
        failureText: 'The witness is withdrawn — a quiet loss, not a public one.' },
    ],
  },
  {
    id: 'b-witness-attack-2',
    tags: ['witness_attack'],
    complication: 'A rumor reaches your witness\'s ears — about what might happen to them, or to their family, if they speak.',
    responses: [
      { id: 'r1', label: 'Reassure the witness in person before they testify', kind: 'stat', skill: 'rhetoric', difficulty: 6,
        swing: { success: 6, failure: -8 },
        successText: 'The reassurance holds, and the witness testifies as planned.',
        failureText: 'The reassurance does not hold — the witness testifies, visibly afraid, and it shows.' },
      { id: 'r2', label: 'Trace the rumor back to its source', kind: 'stat', skill: 'intrigus', difficulty: 7,
        swing: { success: 7, failure: -6 },
        successText: 'The source is found and named before the court — the rumor loses its teeth.',
        failureText: 'The source is never found, and the rumor is left to do its work.' },
    ],
  },
];
