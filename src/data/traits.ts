import type { PersonalityTrait, AmbitionType } from '../models/character';

export type SenateAction = 'vote_for' | 'vote_against' | 'filibuster';

export const PERSONALITY_ACTION_WEIGHTS: Record<
  PersonalityTrait,
  Record<SenateAction, number>
> = {
  aggressive: { vote_for: -5, vote_against: 10, filibuster: 15 },
  content:    { vote_for: 10, vote_against: -5, filibuster: -15 },
  ambitious:  { vote_for:  5, vote_against:  0, filibuster:  5 },
  cautious:   { vote_for:  0, vote_against:  5, filibuster: -5 },
};

export const AMBITION_ACTION_WEIGHTS: Record<
  AmbitionType,
  Record<SenateAction, number>
> = {
  gain_dignitas:   { vote_for:  8, vote_against: -3, filibuster:  0 },
  protect_family:  { vote_for:  5, vote_against:  0, filibuster: -5 },
  personal_power:  { vote_for:  0, vote_against:  8, filibuster: 10 },
};

export const RELATIONSHIP_WEIGHT = 0.2;
export const NOISE_FACTOR = 8;

// ─── Trait definitions (Feature 5) ───────────────────────────────────────────

export interface TraitDefinition {
  id: string;
  name: string;
  description: string;
  heritable: boolean;
  inheritanceWeight: number; // 0–1 probability multiplier when a parent has it
  skillModifiers: Partial<{
    rhetoric: number;
    auctoritas: number;
    martial: number;
    intrigus: number;
  }>;
  resourceBonuses?: Partial<{
    dignitas: number;  // flat bonus per season
    gravitas: number;
    gratia: number;
    imperium: number;
  }>;
  exclusiveWith?: string[]; // trait IDs that cannot coexist with this one
}

export const TRAIT_DEFINITIONS: TraitDefinition[] = [
  {
    id: 'sharp_mind',
    name: 'Sharp Mind',
    description: 'A razor intellect that cuts through deception and rhetoric alike.',
    heritable: true,
    inheritanceWeight: 0.6,
    skillModifiers: { intrigus: 3, rhetoric: 2 },
  },
  {
    id: 'soldier_born',
    name: 'Soldier Born',
    description: 'Raised on martial discipline. The battlefield holds no fear.',
    heritable: true,
    inheritanceWeight: 0.5,
    skillModifiers: { martial: 4 },
    exclusiveWith: ['silver_tongue'],
  },
  {
    id: 'silver_tongue',
    name: 'Silver Tongue',
    description: 'Words flow like honey — and sting like a blade.',
    heritable: true,
    inheritanceWeight: 0.55,
    skillModifiers: { rhetoric: 4 },
    exclusiveWith: ['soldier_born'],
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    description: 'Unmovable under pressure. All endeavours pursued with relentless focus.',
    heritable: true,
    inheritanceWeight: 0.45,
    skillModifiers: { rhetoric: 2, auctoritas: 2, martial: 2, intrigus: 2 },
  },
  {
    id: 'ancient_blood',
    name: 'Ancient Blood',
    description: 'The weight of generations commands respect without a word.',
    heritable: true,
    inheritanceWeight: 0.3,
    skillModifiers: { auctoritas: 5 },
    resourceBonuses: { dignitas: 3 },
  },
  {
    id: 'ruthless',
    name: 'Ruthless',
    description: 'Sentiment is a luxury this mind cannot afford.',
    heritable: true,
    inheritanceWeight: 0.5,
    skillModifiers: { intrigus: 3, auctoritas: -2 },
    exclusiveWith: ['iron_will'],
  },
  {
    id: 'great_orator',
    name: 'Great Orator',
    description: 'The Senate falls silent when this voice rises.',
    heritable: true,
    inheritanceWeight: 0.4,
    skillModifiers: { rhetoric: 6 },
    exclusiveWith: ['ruthless'],
  },
  {
    id: 'conqueror',
    name: 'Conqueror',
    description: 'Born to lead armies. Defeat is not in the vocabulary.',
    heritable: true,
    inheritanceWeight: 0.3,
    skillModifiers: { martial: 5 },
    resourceBonuses: { imperium: 3 },
    exclusiveWith: ['silver_tongue', 'great_orator'],
  },
  {
    id: 'nobilitas',
    name: 'Nobilitas',
    description: 'The Consular ancestry speaks louder than any speech.',
    heritable: true,
    inheritanceWeight: 0.25,
    skillModifiers: { auctoritas: 4 },
    resourceBonuses: { dignitas: 5 },
    exclusiveWith: ['ruthless'],
  },
  {
    id: 'father_of_senate',
    name: 'Father of the Senate',
    description: 'Earned through a lifetime of service. The chamber bends to their counsel.',
    heritable: false,
    inheritanceWeight: 0,
    skillModifiers: { auctoritas: 3, rhetoric: 2 },
    resourceBonuses: { gravitas: 5 },
  },
];
