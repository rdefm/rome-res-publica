import type { LegacyObjectiveDefinition } from '../models/legacyObjective';

export const LEGACY_DEFINITIONS: LegacyObjectiveDefinition[] = [
  {
    id: 'consular_line',
    title: 'The Consular Line',
    description: 'How many Consuls your family has produced across all generations.',
    trackingUnit: 'Consuls produced',
    milestones: [
      {
        threshold: 1,
        label: 'First Among Equals',
        permanentBonus: { flatBonus: { lifetimeDignitas: 5 } },
      },
      {
        threshold: 3,
        label: 'Consular Family',
        permanentBonus: { flatBonus: { lifetimeDignitas: 10 }, resourceMultiplier: { fides: 1.1 } },
      },
      {
        threshold: 7,
        label: 'Ancient Nobility',
        permanentBonus: { flatBonus: { lifetimeDignitas: 20 }, unlocksTrait: 'nobilitas' },
      },
    ],
  },
  {
    id: 'treasury_legacy',
    title: 'The Midas Dynasty',
    description: 'Total Denarii earned across all turns — not current holdings.',
    trackingUnit: 'Lifetime Denarii earned',
    milestones: [
      {
        threshold: 500,
        label: 'Men of Means',
        permanentBonus: { flatBonus: { gold: 5 } },
      },
      {
        threshold: 2000,
        label: 'Wealthy House',
        permanentBonus: { flatBonus: { gold: 15 }, resourceMultiplier: { gold: 1.1 } },
      },
      {
        threshold: 6000,
        label: 'Dynastic Wealth',
        permanentBonus: { flatBonus: { gold: 30 }, resourceMultiplier: { gold: 1.25 }, unlocksAsset: 'urban_insulae' },
      },
    ],
  },
  {
    id: 'senate_voice',
    title: 'Voice of the Senate',
    description: 'Total times a family member has voted, spoken, or submitted a bill in the Curia.',
    trackingUnit: 'Senate actions taken',
    milestones: [
      {
        threshold: 10,
        label: 'Senate Regular',
        permanentBonus: { flatBonus: { fides: 3 } },
      },
      {
        threshold: 40,
        label: 'Senate Voice',
        permanentBonus: { resourceMultiplier: { fides: 1.1 } },
      },
      {
        threshold: 100,
        label: 'Pillar of Rome',
        permanentBonus: { flatBonus: { fides: 15 }, unlocksTrait: 'father_of_senate' },
      },
    ],
  },
  {
    id: 'survival_legacy',
    title: 'Endurance of the Gens',
    description: 'Total seasons your family name has survived.',
    trackingUnit: 'Seasons survived',
    milestones: [
      {
        threshold: 40,
        label: 'Established House',
        permanentBonus: { flatBonus: { lifetimeDignitas: 5 } },
      },
      {
        threshold: 100,
        label: 'Ancient House',
        permanentBonus: { flatBonus: { lifetimeDignitas: 15 }, resourceMultiplier: { lifetimeDignitas: 1.1 } },
      },
      {
        threshold: 200,
        label: 'Eternal Gens',
        permanentBonus: { unlocksTrait: 'ancient_blood' },
      },
    ],
  },
];
