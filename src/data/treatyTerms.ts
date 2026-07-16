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
  // ─── Mediterranean province cession (one term per province) ────────────────
  // Each of MEDITERRANEAN_PROVINCES (src/data/provinceDefinitions.ts) gets its
  // own atomic cession term — city-states (Messana, Syracuse, Agrigentum) are
  // treated identically to the coastal/mining outposts (Alalia, Olbia, Sulci,
  // Tripolitania), no west/east region bundling. Numidia is deliberately
  // excluded: it's a Carthaginian CLIENT, not Carthaginian territory
  // (`clientOf: 'carthage'`), and "ceding" it via provinceTransferToRome would
  // model it as ordinary conquered soil — a patron/client mechanic (tribute,
  // protection, war-approval gating) is planned separately and Numidia's
  // treaty term should be built against that system, not this one.
  // `getEligibleTreatyTerms` (warEngine.ts) gates all of these on the
  // CURRENT/live owner of the listed province(s) matching the war's enemyId,
  // so e.g. a Gaul war never offers Carthaginian Sicily even though the term
  // exists in this flat list.
  {
    id: 'messana',
    label: 'Carthage Cedes Messana',
    description: 'The Mamertine flashpoint itself, ceded outright — the war\'s original casus belli, formally Roman.',
    warScorePrice: 16,
    effectsAsWinner: 'lifetimeDignitas+8|imperium+5',
    effectsAsLoser: 'lifetimeDignitas-5|crisis-war+3',
    warEndFlags: { provinceTransferToRome: ['messana'] },
    factionReaction: { optimates: 3, populares: 1 },
  },
  {
    id: 'syracuse',
    label: 'Syracuse Submits',
    description: "Hiero II's wealthy Greek kingdom accepts Roman authority — Sicily's richest city.",
    warScorePrice: 20,
    effectsAsWinner: 'lifetimeDignitas+12|imperium+6',
    effectsAsLoser: 'lifetimeDignitas-7|crisis-war+4',
    warEndFlags: { provinceTransferToRome: ['syracuse'] },
    factionReaction: { optimates: 4, populares: 1 },
  },
  {
    id: 'agrigentum',
    label: 'Agrigentum Cedes',
    description: 'The exposed southern Greek polis changes hands again, this time to Rome.',
    warScorePrice: 12,
    effectsAsWinner: 'lifetimeDignitas+6|imperium+3',
    effectsAsLoser: 'lifetimeDignitas-4|crisis-war+2',
    warEndFlags: { provinceTransferToRome: ['agrigentum'] },
    factionReaction: { optimates: 2, populares: 1 },
  },
  {
    id: 'lilybaeum',
    label: 'Carthage Quits Lilybaeum',
    description: "Carthage's principal Sicilian fortress-port, gateway to Africa, surrendered to Rome.",
    warScorePrice: 20,
    effectsAsWinner: 'lifetimeDignitas+12|imperium+8',
    effectsAsLoser: 'lifetimeDignitas-8|crisis-war+4',
    warEndFlags: { provinceTransferToRome: ['lilybaeum'] },
    factionReaction: { optimates: 4, populares: 1 },
  },
  {
    id: 'alalia',
    label: 'Carthage Quits Alalia',
    description: 'A modest Corsican timber-and-iron outpost, ceded for its harbour.',
    warScorePrice: 8,
    effectsAsWinner: 'lifetimeDignitas+4|imperium+2',
    effectsAsLoser: 'lifetimeDignitas-3|crisis-war+1',
    warEndFlags: { provinceTransferToRome: ['alalia'] },
    factionReaction: { optimates: 1, populares: 0 },
  },
  {
    id: 'olbia',
    label: 'Carthage Quits Olbia',
    description: "Sardinia's northern grain port and fleet anchorage, handed to Rome.",
    warScorePrice: 10,
    effectsAsWinner: 'lifetimeDignitas+5|imperium+2',
    effectsAsLoser: 'lifetimeDignitas-3|crisis-war+2',
    warEndFlags: { provinceTransferToRome: ['olbia'] },
    factionReaction: { optimates: 1, populares: 1 },
  },
  {
    id: 'sulci',
    label: 'Carthage Quits Sulci',
    description: "Sardinia's southern silver-and-lead port, ceded along with its mines.",
    warScorePrice: 10,
    effectsAsWinner: 'lifetimeDignitas+5|imperium+3',
    effectsAsLoser: 'lifetimeDignitas-3|crisis-war+2',
    warEndFlags: { provinceTransferToRome: ['sulci'] },
    factionReaction: { optimates: 2, populares: 0 },
  },
  {
    id: 'tripolitania',
    label: 'Carthage Quits Tripolitania',
    description: 'A distant, arid coastal holding — of little interest to Rome yet, but ceded all the same.',
    warScorePrice: 6,
    effectsAsWinner: 'lifetimeDignitas+3|imperium+1',
    effectsAsLoser: 'lifetimeDignitas-2|crisis-war+1',
    warEndFlags: { provinceTransferToRome: ['tripolitania'] },
    factionReaction: { optimates: 1, populares: 0 },
  },
  {
    id: 'carthage_cedes_capital',
    label: 'Carthage Itself',
    description: "The rival's own capital, offered at the negotiating table rather than taken by siege — a demand so extreme most wars will never afford it, and the hawks call anything less a betrayal of the men who could have taken it by the sword.",
    warScorePrice: 40,
    effectsAsWinner: 'lifetimeDignitas+30|imperium+20',
    effectsAsLoser: 'lifetimeDignitas-20|crisis-war+8',
    warEndFlags: { provinceTransferToRome: ['carthage'] },
    factionReaction: { optimates: 8, populares: 3 },
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
