// ─── Phase 5, Chunk P5-F — Achievement ("Laurel") definitions ───────────────
// Content only, no logic. Evaluated by engine/achievementEngine.ts against
// existing GameState/AncestorRecord facts — no achievement here required a
// new run-stat counter except `flamma` (gameStore.burnSecret now also sets
// the permanent flags['secret-burned-ever'], alongside the pre-existing
// transient 'secret-burned-recently' P5-D reads and clears).

import type { AchievementDef } from '../models/achievement';

export const ACHIEVEMENT_DEFINITIONS: AchievementDef[] = [
  {
    id: 'primus-honos',
    name: 'Primus Honos',
    latin: 'Primus Honos',
    description: 'Win any election.',
    icon: '🎖️',
  },
  {
    id: 'consul-gentis',
    name: 'Consul Gentis',
    latin: 'Consul Gentis',
    description: 'A family member wins the consulship.',
    icon: '🏛️',
  },
  {
    id: 'triumphator',
    name: 'Triumphator',
    latin: 'Triumphator',
    description: 'Celebrate a Triumph.',
    icon: '🏆',
  },
  {
    id: 'patronus-maximus',
    name: 'Patronus Maximus',
    latin: 'Patronus Maximus',
    description: 'Reach Patron Tier 5.',
    icon: '🤝',
  },
  {
    id: 'accusator',
    name: 'Accusator',
    latin: 'Accusator',
    description: 'Win a prosecution.',
    icon: '⚖️',
  },
  {
    id: 'vox-populi',
    name: 'Vox Populi',
    latin: 'Vox Populi',
    description: 'Convict a sitting magistrate.',
    icon: '📢',
  },
  {
    id: 'absolvo',
    name: 'Absolvo',
    latin: 'Absolvo',
    description: 'Win a defense at Dismissed.',
    icon: '🕊️',
  },
  {
    id: 'flamma',
    name: 'Flamma',
    latin: 'Flamma',
    description: 'Burn a Secret.',
    icon: '🔥',
  },
  {
    id: 'araneus',
    name: 'Araneus',
    latin: 'Araneus',
    description: 'Hold 3 Secrets simultaneously.',
    icon: '🕸️',
  },
  {
    id: 'munificus',
    name: 'Munificus',
    latin: 'Munificus',
    description: 'Stage the Grand Games.',
    icon: '🎪',
  },
  {
    id: 'midas',
    name: 'Midas',
    latin: 'Midas',
    description: 'Earn 2,000 lifetime Denarii.',
    icon: '💰',
  },
  {
    id: 'gens-perennis',
    name: 'Gens Perennis',
    latin: 'Gens Perennis',
    description: 'Reach a third paterfamilias generation in one run.',
    icon: '🌳',
  },
  {
    id: 'ramus-minor',
    name: 'Ramus Minor',
    latin: 'Ramus Minor',
    description: 'Continue the family line through the cadet branch.',
    icon: '🌿',
  },
  {
    id: 'victoria-punica',
    name: 'Victoria Punica',
    latin: 'Victoria Punica',
    description: 'End the war with Victory over Carthage.',
    icon: '⚔️',
  },
  {
    id: 'pax-fessa',
    name: 'Pax Fessa',
    latin: 'Pax Fessa',
    description: 'End the war with the Peace of Exhaustion.',
    icon: '🤍',
  },
  {
    id: 'roma-humilis',
    name: 'Roma Humilis',
    latin: 'Roma Humilis',
    description: 'Endure Rome Humbled.',
    icon: '⛓️',
  },
  {
    id: 'sine-fine',
    name: 'Sine Fine',
    latin: 'Sine Fine',
    description: 'Enter Endless mode.',
    icon: '♾️',
  },
  {
    id: 'novus-homo',
    name: 'Novus Homo',
    latin: 'Novus Homo',
    description: 'Win the consulship playing Gens Duilia.',
    icon: '⭐',
  },
];
