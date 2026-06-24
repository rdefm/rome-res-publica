import type { TrialAction } from '../models/trial';

export const TRIAL_ACTIONS: TrialAction[] = [
  {
    id: 'hire_advocate',
    label: 'Hire a Plebeian Advocate',
    cost: { resource: 'denarii', amount: 40 },
    defenseBonus: 15,
  },
  {
    id: 'call_in_favour',
    label: 'Call in a Political Favour',
    cost: { resource: 'gratia', amount: 20 },
    defenseBonus: 20,
  },
  {
    id: 'senate_filibuster',
    label: 'Filibuster the Proceedings',
    cost: { resource: 'gravitas', amount: 15 },
    defenseBonus: 10,
  },
  {
    id: 'intimidate_witness',
    label: 'Intimidate a Key Witness',
    cost: { resource: 'denarii', amount: 60 },
    defenseBonus: 30,
    requiresAssetAction: 'intimidate_witness', // requires gladiator_school tier 3
  },
  {
    id: 'bribe_jury',
    label: 'Bribe the Jury',
    cost: { resource: 'denarii', amount: 80 },
    defenseBonus: 35,
  },
];
