// ─── Phase 4, Chunk P4-C — Trial charges ─────────────────────────────────────
// Static data only (CLAUDE.md layer rule) — verdict/prep/growth logic lives
// in engine/trialEngine.ts.

import type { ChargeId } from '../models/trial';

export interface TrialChargeDefinition {
  charge: ChargeId;
  /** Latin name shown in courtroom copy (forensic register — never Philon). */
  latinName: string;
  displayName: string;
  /** {defendant}/{accuser} slots, filled at filing time. */
  accusationTemplate: string;
  /** Selects which BALANCE.trials.verdictThresholds band set applies —
   *  'severe' charges (treason-adjacent) convict/condemn more readily than
   *  the financial charges. A shared two-tier table rather than 5 separate
   *  threshold sets, since the plan gives no distinct numbers per charge. */
  severityTier: 'standard' | 'severe';
  /** Consumed by P4-E's beat draw (tags the complication pool). Placeholder
   *  this chunk — no beat engine exists yet. */
  beatTags: string[];
}

export const TRIAL_CHARGE_DEFS: Record<ChargeId, TrialChargeDefinition> = {
  repetundae: {
    charge: 'repetundae',
    latinName: 'De Repetundis',
    displayName: 'Extortion in Office',
    accusationTemplate: '{accuser} accuses {defendant} of plundering a province under color of office — the Verres charge, governors\' bane.',
    severityTier: 'standard',
    beatTags: ['repetundae', 'provincial', 'financial'],
  },
  peculatus: {
    charge: 'peculatus',
    latinName: 'Peculatus',
    displayName: 'Embezzlement of Public Funds',
    accusationTemplate: '{accuser} accuses {defendant} of embezzling funds entrusted to the Republic.',
    severityTier: 'standard',
    beatTags: ['peculatus', 'financial'],
  },
  ambitus: {
    charge: 'ambitus',
    latinName: 'De Ambitu',
    displayName: 'Electoral Corruption',
    accusationTemplate: '{accuser} accuses {defendant} of buying an office the Republic\'s citizens should have freely given.',
    severityTier: 'standard',
    beatTags: ['ambitus', 'electoral'],
  },
  maiestas: {
    charge: 'maiestas',
    latinName: 'Perduellio',
    displayName: 'Treason',
    accusationTemplate: '{accuser} accuses {defendant} of maiestas — an offense against the majesty of the Roman People itself.',
    severityTier: 'severe',
    beatTags: ['maiestas', 'treason'],
  },
  military_incompetence: {
    charge: 'military_incompetence',
    latinName: 'Ignavia Ducis',
    displayName: 'Military Incompetence',
    accusationTemplate: '{accuser} accuses {defendant} of a commander\'s ruinous failure in the field, costing Roman lives and Roman standards.',
    severityTier: 'severe',
    beatTags: ['military', 'command'],
  },
};
