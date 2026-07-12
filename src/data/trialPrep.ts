// ─── Phase 4, Chunk P4-D — the Basilica's prep catalog ───────────────────────
// Static data only (CLAUDE.md layer rule) — costs/effects that depend on
// current state (uses so far, agent's Intrigus, secret potency, speaker's
// Rhetoric) are computed by engine/trialEngine.ts's prep functions, not baked
// in here. Supersedes data/trialActions.ts (deleted this chunk) — every prep
// verb, both seats, lives here now.

import type { PrepSection } from '../models/trial';

export interface PrepVerbDef {
  id: string;
  section: PrepSection;
  label: string;
  /** Flavor line shown under the verb button. */
  description: string;
  costResource: 'denarii' | 'fides' | null; // null = free (Invoke the Ancestors, one-time)
  /** True if repeatable up to a cap (Gather Evidence, Prepare Oration);
   *  false if one-shot (or capped by slots/bribe targets, tracked elsewhere). */
  repeatable: boolean;
  requiresAssetAction?: string; // ported verbatim from the old intimidate_witness gate
}

export const TRIAL_PREP_VERBS: PrepVerbDef[] = [
  {
    id: 'gather_evidence',
    section: 'logos',
    label: 'Gather Evidence',
    description: 'Send a family member digging through records and testimony. Cost rises with each use.',
    costResource: 'fides',
    repeatable: true,
  },
  {
    id: 'present_secret_evidence',
    section: 'logos',
    label: 'Present a Secret as Evidence',
    description: "Consume a criminal Secret on the opponent that matches this charge — damning, and irreversible.",
    costResource: null,
    repeatable: true,
  },
  {
    id: 'secure_witness',
    section: 'pathos',
    label: 'Secure a Witness',
    description: 'A named witness willing to testify — two slots only, and attackable at trial.',
    costResource: 'denarii',
    repeatable: true,
  },
  {
    id: 'prepare_oration',
    section: 'pathos',
    label: 'Prepare an Oration',
    description: "Rehearse the speaker's case. Value locks in at purchase, whoever argues on the day.",
    costResource: 'fides',
    repeatable: true,
  },
  {
    id: 'invoke_ancestors',
    section: 'ethos',
    label: 'Invoke the Ancestors',
    description: "Open with the family's record — free, one-time, scaled by lifetime Dignitas.",
    costResource: null,
    repeatable: false,
  },
  {
    id: 'bribe_jurors',
    section: 'ethos',
    label: 'Bribe the Jurors',
    description: "Buy a clan's bloc, quietly. Discovery voids the bonus and turns it into a hostile beat.",
    costResource: 'denarii',
    repeatable: true,
  },
  {
    id: 'bribe_praetor',
    section: 'ethos',
    label: 'Bribe the Praetor',
    description: 'The largest single lever in the room — and the largest risk if discovered.',
    costResource: 'denarii',
    repeatable: false,
  },
  {
    id: 'intimidate_witness',
    section: 'pathos',
    label: 'Intimidate a Key Witness',
    description: "Lean on the opponent's case directly. Requires the Gladiator School.",
    costResource: 'denarii',
    repeatable: false,
    requiresAssetAction: 'intimidate_witness',
  },
];
