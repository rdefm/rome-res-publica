// ─── Phase 4, Chunk P4-A — Secret content ────────────────────────────────────
// Static data only (CLAUDE.md layer rule) — generation/interpolation logic
// lives in engine/secretEngine.ts.

import type { SecretType, SecretClass } from '../models/secret';

export interface SecretTypeDefinition {
  type: SecretType;
  displayName: string;
  class: SecretClass;
  icon: string;
  /** Single {subject} slot — interpolated with the leader's or family
   *  character's name (whichever the Secret's subject is) by
   *  secretEngine.generateSecret at generation time, so every Secret reads
   *  as a specific scandal, not a category label. */
  flavorTemplates: string[];
  /** ChargeId (P4-C's trialCharges.ts) this type seeds a prosecution with.
   *  null for social types — affair/impiety never feed a criminal charge. */
  chargeType: 'repetundae' | 'peculatus' | 'ambitus' | null;
  /** Provincial plunder only generates against a leader/character who has
   *  held a governorship or office. Checked in secretEngine's generator
   *  against leader.heldOffices / character.heldOffices (P4-A's tracker) —
   *  see secretEngine.ts's condition hook. */
  requiresOfficeHistory?: boolean;
}

export const SECRET_TYPE_DEFS: Record<SecretType, SecretTypeDefinition> = {
  affair: {
    type: 'affair',
    displayName: 'Affair',
    class: 'social',
    icon: '💋',
    chargeType: null,
    flavorTemplates: [
      "{subject} keeps a household in the Subura that a spouse has never seen.",
      "A slave girl in {subject}'s villa has borne a child with {subject}'s eyes.",
      "{subject} was seen leaving a senator's wife's litter before dawn, twice.",
      "Love letters, unwisely kept, name a woman who is not {subject}'s wife.",
      "{subject} maintains a second household under a freedman's name.",
      "A priestess of Vesta's cousin speaks too freely of nights spent with {subject}.",
    ],
  },
  impiety: {
    type: 'impiety',
    displayName: 'Impiety',
    class: 'social',
    icon: '🕯️',
    chargeType: null,
    flavorTemplates: [
      "{subject} mocked the auspices before the augurs, in earshot of a slave who talks.",
      "{subject} skipped the sacrifice at the Compitalia and let a client swear falsely on their behalf.",
      "A curse tablet bearing {subject}'s name was found buried near a rival's threshold.",
      "{subject} consulted a Chaldean astrologer against the Senate's own decree.",
      "{subject} let the sacred chickens starve rather than delay a crossing — and hid it.",
      "Whispers place {subject} at a proscribed Bacchanalian rite outside the pomerium.",
    ],
  },
  embezzlement: {
    type: 'embezzlement',
    displayName: 'Embezzlement',
    class: 'criminal',
    icon: '💰',
    chargeType: 'peculatus',
    flavorTemplates: [
      "{subject} skimmed the quaestor's chest during their term, and the ledgers still show it.",
      "A certain irregularity in {subject}'s accounts has never been explained to the censors.",
      "Public funds meant for the grain dole passed through {subject}'s hands and came out lighter.",
      "{subject} billed the treasury twice for the same road survey.",
      "A freedman clerk kept a second set of books for {subject} — and kept a copy for himself.",
      "{subject} pocketed the difference between the contract price and what the builders were actually paid.",
    ],
  },
  electoral_fraud: {
    type: 'electoral_fraud',
    displayName: 'Electoral Fraud',
    class: 'criminal',
    icon: '🗳️',
    chargeType: 'ambitus',
    flavorTemplates: [
      "{subject} paid a century's worth of votes in coin, and the paymaster kept receipts.",
      "Ballots for {subject} were cast by men who had died the previous winter.",
      "{subject} bribed a tribune to delay a rival's candidacy past the filing date.",
      "A client of {subject}'s openly boasted of the denarii paid per vote in the Forum.",
      "{subject} packed a tribal assembly with hired men bused in from the countryside.",
      "The censor who certified {subject}'s election was their own brother-in-law.",
    ],
  },
  provincial_plunder: {
    type: 'provincial_plunder',
    displayName: 'Provincial Plunder',
    class: 'criminal',
    icon: '⚱️',
    chargeType: 'repetundae',
    requiresOfficeHistory: true,
    flavorTemplates: [
      "{subject}'s province returned threadbare while their own household grew richer.",
      "Statues and temple gold vanished from {subject}'s province and never reached Rome's treasury.",
      "Provincial envoys still speak bitterly of what {subject} extracted from them 'in tribute.'",
      "{subject} sold judgments to the highest bidder in a governor's court.",
      "A province's tax farmers answered to {subject} personally, and paid {subject} personally too.",
      "{subject} requisitioned grain 'for the legions' that the legions never saw.",
    ],
  },
};

export const SECRET_CLASS_BY_TYPE: Record<SecretType, SecretClass> = Object.fromEntries(
  (Object.keys(SECRET_TYPE_DEFS) as SecretType[]).map(t => [t, SECRET_TYPE_DEFS[t].class])
) as Record<SecretType, SecretClass>;

export const SECRET_TYPES: SecretType[] = Object.keys(SECRET_TYPE_DEFS) as SecretType[];
