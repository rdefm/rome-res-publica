export type PatronTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface PatronTierDefinition {
  tier: PatronTier;
  label: string;
  flavourText: string;
  requiresDignitasTotal: number;   // lifetime Dignitas accumulated
  requiresGratiaPool: number;      // current Gratia pool >= this
  passiveBonus: {
    clientSlots: number;           // max client slots available to family
    gratiaMultiplier: number;      // multiplier on Gratia income
    incomingFavourChance: number;  // 0–1 probability per turn that a client calls in favour
  };
  unlockedActions: string[];
}

export const PATRON_TIER_DEFINITIONS: PatronTierDefinition[] = [
  {
    tier: 0, label: 'Client Family',
    flavourText: 'You depend on a great house for survival.',
    requiresDignitasTotal: 0, requiresGratiaPool: 0,
    passiveBonus: { clientSlots: 2, gratiaMultiplier: 1.0, incomingFavourChance: 0.0 },
    unlockedActions: [],
  },
  {
    tier: 1, label: 'Minor Patron',
    flavourText: 'A few commoners look to you for protection.',
    requiresDignitasTotal: 30, requiresGratiaPool: 20,
    passiveBonus: { clientSlots: 4, gratiaMultiplier: 1.1, incomingFavourChance: 0.1 },
    unlockedActions: ['sponsor_client'],
  },
  {
    tier: 2, label: 'Established Patron',
    flavourText: 'Your name carries weight in the ward.',
    requiresDignitasTotal: 80, requiresGratiaPool: 50,
    passiveBonus: { clientSlots: 6, gratiaMultiplier: 1.2, incomingFavourChance: 0.2 },
    unlockedActions: ['sponsor_client', 'offer_protection'],
  },
  {
    tier: 3, label: 'Major Patron',
    flavourText: 'Half the city eats from your hand.',
    requiresDignitasTotal: 180, requiresGratiaPool: 100,
    passiveBonus: { clientSlots: 9, gratiaMultiplier: 1.35, incomingFavourChance: 0.3 },
    unlockedActions: ['sponsor_client', 'offer_protection', 'command_client_vote'],
  },
  {
    tier: 4, label: 'Patrician Lord',
    flavourText: 'Lesser families seek your favour as their lifeblood.',
    requiresDignitasTotal: 350, requiresGratiaPool: 180,
    passiveBonus: { clientSlots: 13, gratiaMultiplier: 1.5, incomingFavourChance: 0.4 },
    unlockedActions: ['sponsor_client', 'offer_protection', 'command_client_vote', 'absorb_client_family'],
  },
  {
    tier: 5, label: 'Prince of the Republic',
    flavourText: '"He is not a senator. He is the Senate."',
    requiresDignitasTotal: 600, requiresGratiaPool: 300,
    passiveBonus: { clientSlots: 20, gratiaMultiplier: 1.75, incomingFavourChance: 0.5 },
    unlockedActions: ['sponsor_client', 'offer_protection', 'command_client_vote', 'absorb_client_family', 'dictate_alliance'],
  },
];
