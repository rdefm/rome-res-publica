// ─── Munificence (Euergetism) — P2-F ─────────────────────────────────────────
// Public acts of wealth-to-standing conversion: feasts, games, temple
// restorations, endowments. The late-game absorber that replaces the cut
// patron-tier action-cost scaling — see rome-phase2-implementation-plan.md §P2-F.
//
// "effects" is a structured object rather than an effect string: Aedile's
// cost/effect discount (BALANCE.munificence.aedileCostMultiplier/
// aedileEffectMultiplier) needs to scale individual numeric fields, and
// scaling a pipe-delimited effect string in place would mean parsing it back
// out — more fragile than just keeping the fields structured from the start.
// gameStore.performMunificence applies these fields directly to state.

import { BALANCE } from './balance';
import type { CrisisTrackId } from '../models/crisis';

export interface MunificenceActEffects {
  plebs?: number;
  fides?: number;
  lifetimeDignitas?: number;
  stability?: number;
  crisisDeltas?: Partial<Record<CrisisTrackId, number>>;
  /** Grand Games only — one-shot vote bonus for the next Winter election resolution (peoples-champion pattern). */
  electionVoteBonus?: number;
  /** Public Endowment only — grants a permanent Fides/season endowment slot. */
  grantsEndowment?: boolean;
}

export interface MunificenceActRequirements {
  minPatronTier?: number;
  /** Seasons that must elapse after lastUsedTurn before the act is usable again. */
  cooldownSeasons?: number;
  /** Caps usesThisYear at 1 (temples/games acts that are once/year). */
  onceThisYear?: boolean;
  /** Total-uses-ever cap (temples: 1 each; endowments: 2). */
  maxPerGame?: number;
  /** Acts sharing a slot compete for one use per year — Fund the Ludi and Grand Games share 'games'. */
  slot?: string;
}

export interface MunificenceAct {
  id: string;
  name: string;
  flavor: string;
  requirements: MunificenceActRequirements;
  costs: { denarii: number; fides?: number };
  effects: MunificenceActEffects;
  /** Grand acts get a laurel UI accent and a Philon interstitial on execution. */
  isGrandAct?: boolean;
  /** Halves Denarii cost and scales goodwill effects ×1.5 while the player holds Aedile. */
  aedileDiscount?: boolean;
}

const M = BALANCE.munificence;

const TEMPLES: { id: string; name: string; flavor: string }[] = [
  { id: 'temple-saturn', name: 'Restore the Temple of Saturn', flavor: 'Guardian of the state treasury — its restoration reassures a nervous Senate.' },
  { id: 'temple-castor', name: 'Restore the Temple of Castor', flavor: 'Patron of the equestrian order and of oaths sworn in the Forum.' },
  { id: 'temple-ceres', name: 'Restore the Temple of Ceres', flavor: 'Grain and the plebeian aediles — its upkeep is watched closely by the people.' },
  { id: 'temple-janus', name: 'Restore the Temple of Janus', flavor: 'Its doors stand open in war, closed in peace — a visible statement about Rome\'s fortunes.' },
  { id: 'temple-bellona', name: 'Restore the Temple of Bellona', flavor: 'Goddess of war, sited outside the pomerium — where the Senate meets foreign envoys and returning generals.' },
];

export const MUNIFICENCE_ACTS: MunificenceAct[] = [
  {
    id: 'public-feast',
    name: 'Public Feast',
    flavor: 'Open tables in the Forum. A modest, reliable gesture.',
    requirements: { cooldownSeasons: M.publicFeast.cooldownSeasons },
    costs: { denarii: M.publicFeast.denarii },
    effects: { plebs: M.publicFeast.plebs, fides: M.publicFeast.fides },
  },
  {
    id: 'grain-largesse',
    name: 'Grain Largesse',
    flavor: 'A free distribution from your own stores to the city\'s poor — Rome\'s plebs, not a province\'s.',
    requirements: { cooldownSeasons: M.grainLargesse.cooldownSeasons },
    costs: { denarii: M.grainLargesse.denarii },
    effects: { plebs: M.grainLargesse.plebs, crisisDeltas: { unrest: M.grainLargesse.unrestDelta } },
  },
  {
    id: 'fund-the-ludi',
    name: 'Fund the Ludi',
    flavor: 'Minor games — chariot races, a day or two of spectacle. Rome expects them of a family your size.',
    requirements: { minPatronTier: M.fundTheLudi.minPatronTier, onceThisYear: true, slot: 'games' },
    costs: { denarii: M.fundTheLudi.denarii, fides: M.fundTheLudi.fides },
    effects: {
      plebs: M.fundTheLudi.plebs,
      crisisDeltas: { unrest: M.fundTheLudi.unrestDelta },
      lifetimeDignitas: M.fundTheLudi.lifetimeDignitas,
    },
    aedileDiscount: true,
  },
  {
    id: 'grand-games',
    name: 'Grand Games',
    flavor: 'A spectacle Rome will speak of for years. Ten thousand strangers in the stands, and some of them vote.',
    requirements: { minPatronTier: M.grandGames.minPatronTier, onceThisYear: true, slot: 'games' },
    costs: { denarii: M.grandGames.denarii },
    effects: {
      plebs: M.grandGames.plebs,
      crisisDeltas: { unrest: M.grandGames.unrestDelta },
      lifetimeDignitas: M.grandGames.lifetimeDignitas,
      electionVoteBonus: M.grandGames.electionVoteBonus,
    },
    isGrandAct: true,
    aedileDiscount: true,
  },
  ...TEMPLES.map((t): MunificenceAct => ({
    id: t.id,
    name: t.name,
    flavor: t.flavor,
    requirements: { minPatronTier: M.restoreTemple.minPatronTier, maxPerGame: 1 },
    costs: { denarii: M.restoreTemple.denarii },
    effects: {
      lifetimeDignitas: M.restoreTemple.lifetimeDignitas,
      stability: M.restoreTemple.stability,
      crisisDeltas: { constitution: M.restoreTemple.constitutionDelta },
    },
  })),
  {
    id: 'public-endowment',
    name: 'Public Endowment',
    flavor: 'A granary, a portico, a fountain house — a permanent gift to the city, and a permanent reminder of who gave it.',
    requirements: { minPatronTier: M.publicEndowment.minPatronTier, maxPerGame: M.publicEndowment.maxPerGame },
    costs: { denarii: M.publicEndowment.denarii },
    effects: {
      lifetimeDignitas: M.publicEndowment.lifetimeDignitas,
      plebs: M.publicEndowment.plebs,
      grantsEndowment: true,
    },
    isGrandAct: true,
  },
];

export const ENDOWMENT_NAMES = ['Granary', 'Portico', 'Fountain House'];

export function getMunificenceAct(id: string): MunificenceAct | undefined {
  return MUNIFICENCE_ACTS.find(a => a.id === id);
}
