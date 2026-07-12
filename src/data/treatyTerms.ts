// ─── Treaty Terms (Military Overhaul M10) ────────────────────────────────────
// Content only — the ~8-term v1 menu for peace negotiation. See
// rome-military-implementation-plan.md, Chunk M10 and models/war.ts's
// TreatyTerm header comment for the bidirectional-term design decision (one
// entry serves both "Rome wins" and "Rome loses" framings).
//
// Every price and faction-reaction weight below is FIRST-PASS/UNVERIFIED —
// same treatment as M7's stratagem draw weights and M9's setPieceOffer
// constants (the plan specifies the shape, not every number). Revisit in a
// future tuning pass.
//
// warScorePrice is spent from the negotiating side's budget (see
// warEngine.ts's computeTreatyBudget) regardless of who "pays" the resulting
// effect — the price represents how much of the war's decisiveness the term
// consumes, not a resource cost.

import type { TreatyTerm } from '../models/war';

export const TREATY_TERMS: TreatyTerm[] = [
  {
    id: 'indemnity_minor',
    label: 'Indemnity (Minor)',
    description: 'A modest cash payment to the victor — 100 Denarii.',
    warScorePrice: 5,
    effectsAsWinner: 'denarii+100',
    effectsAsLoser: 'denarii-100',
    factionReaction: { optimates: 2, populares: 0 },
  },
  {
    id: 'indemnity_major',
    label: 'Indemnity (Major)',
    description: 'A crippling war indemnity — 300 Denarii, paid over the life of the treaty.',
    warScorePrice: 12,
    effectsAsWinner: 'denarii+300',
    effectsAsLoser: 'denarii-300',
    factionReaction: { optimates: 3, populares: 0 },
  },
  {
    id: 'prisoner_return',
    label: 'Prisoner Return',
    description: 'Every captured family member and legate, on either side, comes home.',
    warScorePrice: 5,
    effectsAsWinner: 'lifetimeDignitas+3',
    effectsAsLoser: 'lifetimeDignitas+3',
    warEndFlags: { prisonerReturn: true },
    factionReaction: { optimates: -1, populares: 2 },
  },
  {
    id: 'sicily_west',
    label: 'Carthage Quits Western Sicily',
    description: 'Carthage withdraws from the western half of the island. Rome gains a new province.',
    warScorePrice: 15,
    effectsAsWinner: 'lifetimeDignitas+8|imperium+5',
    effectsAsLoser: 'lifetimeDignitas-5|crisis-war+3',
    warEndFlags: { provinceTransferToRome: ['sicily_west'] },
    factionReaction: { optimates: 3, populares: 1 },
    mutuallyExclusiveWith: ['sicily_all'],
  },
  {
    id: 'sicily_all',
    label: 'Carthage Quits All Sicily',
    description: 'Carthage abandons the island entirely. Rome gains both Sicilian provinces.',
    warScorePrice: 25,
    effectsAsWinner: 'lifetimeDignitas+15|imperium+10',
    effectsAsLoser: 'lifetimeDignitas-10|crisis-war+5',
    warEndFlags: { provinceTransferToRome: ['sicily_west', 'sicily_east'] },
    factionReaction: { optimates: 5, populares: 2 },
    mutuallyExclusiveWith: ['sicily_west'],
  },
  {
    id: 'fleet_limitation',
    label: 'Fleet Limitation',
    description: "Caps the loser's war fleet — a lasting constraint on their naval ambitions.",
    warScorePrice: 10,
    effectsAsWinner: 'setFlag:fleet-limitation-carthage:true|crisis-war-2',
    effectsAsLoser: 'setFlag:fleet-limitation-rome:true|crisis-war+2',
    factionReaction: { optimates: 1, populares: 0 },
  },
  {
    id: 'face_saver',
    label: 'Face-Saving Clause',
    description:
      'A diplomatic nicety that lets the loser claim the terms were generous — cheaper to include, but the hawks in the Senate call it weakness.',
    warScorePrice: -1,
    effectsAsWinner: '',
    effectsAsLoser: '',
    warEndFlags: { faceSaverPriceDiscount: 1, faceSaverLoserDignitas: 5 },
    factionReaction: { optimates: -3, populares: 1 },
  },
];

export function getTreatyTerm(id: string): TreatyTerm | undefined {
  return TREATY_TERMS.find(t => t.id === id);
}
