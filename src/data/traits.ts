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
