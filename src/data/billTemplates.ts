import type { Bill } from '../models/bill';

// Player-submittable bill templates
export const BILL_TEMPLATES: Omit<Bill, 'id' | 'playerVote' | 'playerSubmitted'>[] = [
  { name: 'Lex de Viis',       desc: 'Road maintenance and expansion across the Republic.',       support:  15, turnsLeft: 3, passEffect: 'stability+5|dignitas+4', failEffect: 'crisis+3' },
  { name: 'Lex Annalis',       desc: 'Codifies age requirements for magistracies.',               support: -10, turnsLeft: 4, passEffect: 'gravitas+6',            failEffect: 'dignitas-3' },
  { name: 'Lex de Aquis',      desc: 'Expansion of the aqueduct network to outlying districts.',  support:  25, turnsLeft: 3, passEffect: 'stability+8|crisis-4',  failEffect: 'crisis+5' },
  { name: 'Senatus Consultum de Bello', desc: 'Emergency war powers authorization for the consuls.', support: -20, turnsLeft: 2, passEffect: 'crisis-12|gravitas+5', failEffect: 'crisis+10' },
  { name: 'Lex de Civitate',   desc: 'Grants citizenship rights to select allied communities.',   support:   5, turnsLeft: 4, passEffect: 'stability+10|dignitas+6|crisis-6', failEffect: 'crisis+8|dignitas-4' },
  { name: 'Lex Sumptuaria',    desc: 'Restricts luxury expenditure among the senatorial class.',  support: -25, turnsLeft: 3, passEffect: 'gravitas+8|dignitas+3', failEffect: 'gravitas-3' },
];

// Auto-injected when bill count drops below 2
export const AUTO_BILL_TEMPLATES: Omit<Bill, 'id' | 'playerVote' | 'playerSubmitted'>[] = [
  { name: 'Lex Militaria',             desc: 'Military levy and conscription provisions.',         support:  -5, turnsLeft: 3, passEffect: 'crisis-8',             failEffect: 'crisis+10' },
  { name: 'Senatus Consultum Ultimum', desc: 'Emergency decree granting consuls extraordinary powers.', support: -20, turnsLeft: 2, passEffect: 'crisis-15|gravitas+5', failEffect: 'crisis+5' },
  { name: 'Lex Porcia',                desc: 'Protections against arbitrary punishment of citizens.', support:  10, turnsLeft: 4, passEffect: 'dignitas+6',          failEffect: 'dignitas-3' },
];

// Starting bills for new game
export const STARTING_BILLS: Bill[] = [
  { id: 'start-1', name: 'Lex Agraria',     desc: 'Redistribution of public land to the urban poor.',      support: -15, turnsLeft: 3, passEffect: 'stability+6|plebs+8',  failEffect: 'plebs-5|crisis+4' },
  { id: 'start-2', name: 'Bellum Punicum',  desc: 'Authorization of war funding against Carthage.',        support: -30, turnsLeft: 2, passEffect: 'crisis-10|gravitas+4', failEffect: 'crisis+12' },
  { id: 'start-3', name: 'Lex Frumentaria', desc: 'Subsidized grain distribution to Rome\'s urban poor.',   support:  20, turnsLeft: 4, passEffect: 'plebs+10|stability+3', failEffect: 'plebs-6|crisis+3' },
];
