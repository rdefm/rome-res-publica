import type { Bill, ActiveLaw } from '../models/bill';
import { parseEffect } from '../models/bill';

// ─── Rome stat vote modifier ──────────────────────────────────────────────────

/**
 * Returns a support modifier for a bill based on current Rome stats.
 * Applied when bills are displayed and when votes are processed.
 */
export function calcRomeStatVoteModifier(
  bill: Bill,
  rome: { stability: number; plebs: number; treasury: number }
): number {
  let modifier = 0;

  // Stability modifier for constitutional/emergency bills
  if (bill.type === 'constitutional' || bill.type === 'emergency') {
    modifier += Math.floor((rome.stability - 50) / 10);
  }

  // Plebs modifier for populist/optimates bills
  if (bill.type === 'populist') {
    modifier += Math.floor((rome.plebs - 40) / 15);
  } else if (bill.type === 'optimates') {
    modifier -= Math.floor((rome.plebs - 40) / 15);
  }

  // Treasury modifier for spending bills (those that drain treasury)
  const effects = parseEffect(bill.passEffect);
  const hasTreasuryDrain = effects.some(e => e.key === 'treasury' && e.delta < 0);
  if (hasTreasuryDrain) {
    if (rome.treasury < 25) {
      modifier += Math.floor((rome.treasury - 25) / 5); // negative, down to −5
    } else if (rome.treasury > 65) {
      modifier += Math.floor((rome.treasury - 65) / 5); // positive, up to +5
    }
  }

  // Clamp to ±10
  return Math.max(-10, Math.min(10, modifier));
}

// ─── Repeal bill factory ──────────────────────────────────────────────────────

/**
 * Build a repeal bill from an active law.
 * Inverts Rome stat effects from the original pass effect.
 * Crisis effects are NOT reversed.
 */
export function buildRepealBill(law: ActiveLaw): Bill {
  const template = [...BILL_TEMPLATES, ...AUTO_BILL_TEMPLATES, ...HISTORICAL_BILL_TEMPLATES]
    .find(t => t.id === law.billId);

  // Build inverted pass effect — flip sign on rome stats only
  const REVERSIBLE_KEYS = new Set(['stability', 'plebs', 'treasury', 'gravitas', 'dignitas', 'gratia', 'plebs']);
  const originalEffects = parseEffect(template?.passEffect ?? '');
  const repealPassParts = originalEffects
    .filter(e => REVERSIBLE_KEYS.has(e.key))
    .map(e => `${e.key}${e.delta > 0 ? '-' : '+'}${Math.abs(e.delta)}`);

  return {
    id: `repeal-${law.billId}-${Date.now()}`,
    name: `Abrogatio: ${law.name}`,
    desc: `A motion to strike down the ${law.name} and nullify its effects.`,
    type: 'repeal',
    repeals: law.billId,
    support: 0,
    turnsLeft: 3,
    passEffect: repealPassParts.join('|') || 'stability-2',
    failEffect: 'stability-3',
    playerSubmitted: true,
    repealable: false,
  };
}

// ─── Existing bills — tagged with type, duration, renewable ──────────────────

export const BILL_TEMPLATES: (Omit<Bill, 'playerVote' | 'playerSubmitted'> & { id: string })[] = [
  {
    id: 'lex-de-viis',
    name: 'Lex de Viis',
    desc: 'Road maintenance and expansion across the Republic.',
    type: 'economic',
    support: 15, turnsLeft: 3,
    passEffect: 'stability+5|dignitas+4', failEffect: 'crisis+3',
    repealable: false,
  },
  {
    id: 'lex-annalis',
    name: 'Lex Annalis',
    desc: 'Codifies age requirements for magistracies.',
    type: 'constitutional',
    support: -10, turnsLeft: 4,
    passEffect: 'gravitas+6', failEffect: 'dignitas-3',
    repealable: false,
  },
  {
    id: 'lex-de-aquis',
    name: 'Lex de Aquis',
    desc: 'Expansion of the aqueduct network to outlying districts.',
    type: 'economic',
    support: 25, turnsLeft: 3,
    passEffect: 'stability+8|crisis-4', failEffect: 'crisis+5',
    repealable: false,
  },
  {
    id: 'senatus-consultum-de-bello',
    name: 'Senatus Consultum de Bello',
    desc: 'Emergency war powers authorization for the consuls.',
    type: 'military',
    support: -20, turnsLeft: 2,
    passEffect: 'crisis-12|gravitas+5', failEffect: 'crisis+10',
    repealable: false,
  },
  {
    id: 'lex-de-civitate',
    name: 'Lex de Civitate',
    desc: 'Grants citizenship rights to select allied communities.',
    type: 'constitutional',
    support: 5, turnsLeft: 4,
    passEffect: 'stability+10|dignitas+6|crisis-6', failEffect: 'crisis+8|dignitas-4',
    repealable: false,
  },
  {
    id: 'lex-sumptuaria',
    name: 'Lex Sumptuaria',
    desc: 'Restricts luxury expenditure among the senatorial class.',
    type: 'optimates',
    support: -25, turnsLeft: 3,
    passEffect: 'gravitas+8|dignitas+3', failEffect: 'gravitas-3',
    repealable: true,
  },
  {
    id: 'lex-frumentaria',
    name: 'Lex Frumentaria',
    desc: 'Subsidized grain distribution to Rome\'s urban poor.',
    type: 'populist',
    support: 20, turnsLeft: 4,
    duration: 20, renewable: true,
    renewalFlavour: 'The grain subsidy has lapsed. The people grow hungry and watchful.',
    passEffect: 'plebs+10|stability+3', failEffect: 'plebs-6|crisis+3',
    repealable: true,
  },
  {
    id: 'lex-agraria',
    name: 'Lex Agraria',
    desc: 'Redistribution of public land to the urban poor.',
    type: 'populist',
    support: -15, turnsLeft: 3,
    passEffect: 'stability+6|plebs+8', failEffect: 'plebs-5|crisis+4',
    repealable: false,
  },
];

// ─── Auto-injected bills ──────────────────────────────────────────────────────

export const AUTO_BILL_TEMPLATES: (Omit<Bill, 'playerVote' | 'playerSubmitted'> & { id: string })[] = [
  {
    id: 'lex-militaria',
    name: 'Lex Militaria',
    desc: 'Military levy and conscription provisions.',
    type: 'military',
    support: -5, turnsLeft: 3,
    duration: 8, renewable: true,
    renewalFlavour: 'The military levy has expired. The Senate must re-authorise conscription.',
    passEffect: 'crisis-8', failEffect: 'crisis+10',
    repealable: false,
  },
  {
    id: 'senatus-consultum-ultimum',
    name: 'Senatus Consultum Ultimum',
    desc: 'Emergency decree granting consuls extraordinary powers.',
    type: 'emergency',
    support: -20, turnsLeft: 2,
    passEffect: 'crisis-15|gravitas+5', failEffect: 'crisis+5',
    repealable: false,
  },
  {
    id: 'lex-porcia',
    name: 'Lex Porcia',
    desc: 'Protections against arbitrary punishment of citizens.',
    type: 'constitutional',
    support: 10, turnsLeft: 4,
    passEffect: 'dignitas+6', failEffect: 'dignitas-3',
    repealable: false,
  },
];

// ─── Starting bills ───────────────────────────────────────────────────────────

export const STARTING_BILLS: Bill[] = [
  {
    id: 'start-1', name: 'Lex Agraria',
    desc: 'Redistribution of public land to the urban poor.',
    type: 'populist',
    support: -15, turnsLeft: 3,
    passEffect: 'stability+6|plebs+8', failEffect: 'plebs-5|crisis+4',
    repealable: false,
  },
  {
    id: 'start-2', name: 'Bellum Punicum',
    desc: 'Authorization of war funding against Carthage.',
    type: 'military',
    support: -30, turnsLeft: 2,
    passEffect: 'crisis-10|gravitas+4', failEffect: 'crisis+12',
    repealable: false,
  },
  {
    id: 'start-3', name: 'Lex Frumentaria',
    desc: 'Subsidized grain distribution to Rome\'s urban poor.',
    type: 'populist',
    support: 20, turnsLeft: 4,
    duration: 20, renewable: true,
    renewalFlavour: 'The grain subsidy has lapsed. The people grow hungry and watchful.',
    passEffect: 'plebs+10|stability+3', failEffect: 'plebs-6|crisis+3',
    repealable: true,
  },
];

// ─── New historical bills ─────────────────────────────────────────────────────

export const HISTORICAL_BILL_TEMPLATES: (Omit<Bill, 'playerVote' | 'playerSubmitted'> & { id: string })[] = [
  {
    id: 'lex-sempronia-frumentaria',
    name: 'Lex Sempronia Frumentaria',
    desc: 'The state shall sell grain to Roman citizens at a fixed subsidised price. The people will not go hungry while Rome prospers.',
    type: 'populist',
    support: 10, turnsLeft: 4,
    ongoingEffect: 'treasury-3',
    passEffect: 'plebs+15|stability+3', failEffect: 'plebs-8|crisis+4',
    repealable: true,
  },
  {
    id: 'lex-iulia-de-sociis',
    name: 'Lex Iulia de Sociis',
    desc: 'Rome\'s Italian allies have bled for her for generations. This law extends full citizenship to all free peoples of Italy.',
    type: 'constitutional',
    support: -15, turnsLeft: 4,
    passEffect: 'stability+14|plebs+6|crisis-8', failEffect: 'crisis+10|stability-6',
    repealable: false,
  },
  {
    id: 'lex-licinia-sextia',
    name: 'Lex Licinia Sextia de Modo Agrorum',
    desc: 'No citizen shall hold more than 500 iugera of public land. The Senate\'s great estates have swallowed what belongs to Rome.',
    type: 'populist',
    support: -20, turnsLeft: 3,
    passEffect: 'plebs+12|stability+5|treasury+4', failEffect: 'plebs-6|stability-4',
    repealable: true,
  },
  {
    id: 'lex-gabinia',
    name: 'Lex Gabinia',
    desc: 'Extraordinary command of the seas shall be granted to a single general for three years. The pirates strangle Rome\'s grain supply.',
    type: 'military',
    support: 5, turnsLeft: 3,
    duration: 12, renewable: false,
    passEffect: 'crisis-10|stability-8', failEffect: 'crisis+6',
    repealable: false,
    submissionCondition: 'crisisLevel >= 45',
  },
  {
    id: 'lex-oppia',
    name: 'Lex Oppia',
    desc: 'In a time of war, all must sacrifice. The law restricts the display of personal wealth. The women of Rome are displeased.',
    type: 'optimates',
    support: -5, turnsLeft: 3,
    duration: 20, renewable: false,
    renewalFlavour: 'The Lex Oppia has lapsed. The women of Rome exhale.',
    passEffect: 'treasury+6|stability-3|plebs-5', failEffect: 'plebs+4',
    repealable: true,
  },
  {
    id: 'lex-valeria-provocatione',
    name: 'Lex Valeria de Provocatione',
    desc: 'Every Roman citizen condemned to death may appeal to the people. The magistrate\'s power ends where Roman liberty begins.',
    type: 'constitutional',
    support: 15, turnsLeft: 4,
    duration: 40, renewable: true,
    renewalFlavour: 'The right of appeal has lapsed. The Senate must renew the Lex Valeria or Rome\'s citizens stand unprotected.',
    passEffect: 'stability+10|plebs+8|dignitas+4', failEffect: 'stability-5|plebs-4|crisis+3',
    repealable: false,
  },
  {
    id: 'lex-clodia-exsilio',
    name: 'Lex Clodia de Exsilio',
    desc: 'Citizens condemned to death may choose exile over execution. The grain dole shall be free. Clodius offers the people protection and bread.',
    type: 'populist',
    support: 10, turnsLeft: 3,
    ongoingEffect: 'treasury-2',
    passEffect: 'plebs+10|stability-4', failEffect: 'plebs-5|crisis+4',
    repealable: true,
  },
  {
    id: 'sc-de-re-publica-defendenda',
    name: 'Senatus Consultum de Re Publica Defendenda',
    desc: 'The consul shall see to it that the Republic suffers no harm. This decree suspends normal legal protections. It is a weapon, and weapons cut both ways.',
    type: 'emergency',
    support: -25, turnsLeft: 2,
    duration: 4, renewable: false,
    passEffect: 'crisis-12|stability-6', failEffect: 'crisis+5|stability-3',
    repealable: false,
    submissionCondition: 'crisisLevel >= 55',
  },
  {
    id: 'lex-sempronia-agraria',
    name: 'Lex Sempronia Agraria',
    desc: 'The land of Italy is worked by slaves and owned by the few. An agrarian commission shall redistribute public lands to Rome\'s landless citizens.',
    type: 'populist',
    support: -30, turnsLeft: 3,
    passEffect: 'plebs+18|stability-10|treasury+5', failEffect: 'plebs-10|stability-6|crisis+8',
    repealable: true,
  },
  {
    id: 'lex-iulia-pecuniis-mutuis',
    name: 'Lex Iulia de Pecuniis Mutuis',
    desc: 'Interest on debts shall be capped. Existing obligations shall be restructured. The Senate must decide which Rome prefers.',
    type: 'populist',
    support: 0, turnsLeft: 4,
    duration: 16, renewable: true,
    renewalFlavour: 'The debt relief law has expired. Rome\'s debtors await the Senate\'s decision.',
    passEffect: 'plebs+10|stability+8|treasury-4', failEffect: 'plebs-4|stability-3',
    repealable: true,
  },
  {
    id: 'lex-de-vectigalibus',
    name: 'Lex de Vectigalibus',
    desc: 'An emergency tax levy to replenish the public treasury. The Senate agrees this is necessary. The people agree this is their money.',
    type: 'emergency',
    support: -20, turnsLeft: 3,
    passEffect: 'treasury+20|plebs-8', failEffect: 'treasury-5|crisis+4',
    repealable: false,
  },
];

// ─── All templates combined (for submit modal filtering) ─────────────────────

export const ALL_BILL_TEMPLATES = [
  ...BILL_TEMPLATES,
  ...HISTORICAL_BILL_TEMPLATES,
];
