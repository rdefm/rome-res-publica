// ─── Phase 5, Chunk P5-E — Alternate Starting Families ───────────────────────
// Gens Duilia ("Nova Pecunia") and Gens Manlia ("The Disgraced") — two
// unlockable free-start sidegrades (invariant 3/5: trophies and flavour,
// never mechanical power). Character[] rosters mirror startingFamily.ts's
// STARTING_FAMILY shape exactly; per-family stateOverrides bundle the
// resource/reputation/asset deltas that startGame shallow-merges over
// INITIAL_STATE. Numbers live in BALANCE.altFamilies (data/balance.ts) — see
// that block's comments for the reasoning behind each figure.
//
// Family spread note (Duilia): the brief calls for "a high-intrigus
// brother." Character.role gained 'brother'/'sister' this chunk specifically
// for him (models/character.ts) rather than misrepresenting him as a son —
// per the user's explicit request, anticipating future dynamic family trees
// where a same-generation sibling is a real, distinct relationship.

import type { Character } from '../models/character';
import type { GensId } from '../models/gameStart';
import type { OwnedAsset } from '../models/asset';
import type { AncestorRecord } from '../models/epilogue';
import { BALANCE } from './balance';

export interface AltFamilyDefinition {
  gensId: GensId;
  gensSurname: string;
  gensName: string;
  gensPlural: string;
  family: Character[];
  denarii: number;
  fides: number;
  lifetimeDignitas: number;
  familyReputations: Record<string, number>;
  ownedAssets: OwnedAsset[];
  /** Plain-language unlock condition, shown on the locked start-menu card. */
  unlockCondition: string;
  /** Pure predicate over the Hall of Ancestors — no separate unlock flag to
   *  migrate or lose (per the plan's E2 spec). */
  isUnlocked: (hall: AncestorRecord[]) => boolean;
}

// ─── Gens Duilia — "Nova Pecunia" ─────────────────────────────────────────────

const DUILIA_FAMILY: Character[] = [
  {
    id: 'pc-1',
    name: 'Gaius Duilius',
    role: 'paterfamilias',
    isPlayer: true,
    age: 38,
    skills: { rhetoric: 5, martial: 2, intrigus: 7 },
    traits: ['ambitious'],
    ambition: { type: 'gain_dignitas', priority: 0.7 },
    relationship: 100,
    familyTrust: 100,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: ['wealthy_house'],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-wife',
    name: 'Fulvia Duilius',
    role: 'spouse',
    isPlayer: false,
    age: 34,
    skills: { rhetoric: 5, martial: 0, intrigus: 5 },
    traits: ['content'],
    ambition: { type: 'protect_family', priority: 0.8 },
    relationship: 80,
    familyTrust: 100,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: ['survive_dynasty'],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-brother',
    name: 'Lucius Duilius',
    role: 'brother',
    isPlayer: false,
    age: 35,
    skills: { rhetoric: 4, martial: 2, intrigus: 8 },
    traits: ['cautious'],
    ambition: { type: 'personal_power', priority: 0.4 },
    relationship: 65,
    familyTrust: 85,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: [],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-son',
    name: 'Quintus Duilius',
    role: 'son',
    isPlayer: false,
    age: 14,
    skills: { rhetoric: 3, martial: 3, intrigus: 4 },
    traits: ['aggressive'],
    ambition: { type: 'personal_power', priority: 0.5 },
    relationship: 70,
    familyTrust: 90,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: ['first_consul'],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-daughter',
    name: 'Marcia Duilius',
    role: 'daughter',
    isPlayer: false,
    age: 11,
    skills: { rhetoric: 4, martial: 0, intrigus: 5 },
    traits: ['cautious'],
    ambition: null,
    relationship: 75,
    familyTrust: 90,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: [],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
];

// ─── Gens Manlia — "The Disgraced" ────────────────────────────────────────────

const MANLIA_FAMILY: Character[] = [
  {
    id: 'pc-1',
    name: 'Titus Manlius',
    role: 'paterfamilias',
    isPlayer: true,
    age: 45,
    skills: { rhetoric: 7, martial: 7, intrigus: 3 },
    traits: ['ambitious'],
    ambition: { type: 'gain_dignitas', priority: 0.7 },
    relationship: 100,
    familyTrust: 100,
    officeId: null,
    heldOffices: [],
    // The disgrace hook (E1) — elevated starting corruption, safely under
    // trialEngine.CORRUPTION_TRIAL_THRESHOLD (60). See BALANCE.altFamilies'
    // own comment for the reasoning.
    corruptionScore: BALANCE.altFamilies.manlia.startingCorruption,
    inheritedTraits: [],
    ambitionIds: ['wealthy_house'],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-wife',
    name: 'Aemilia Manlius',
    role: 'spouse',
    isPlayer: false,
    age: 40,
    skills: { rhetoric: 5, martial: 0, intrigus: 6 },
    traits: ['content'],
    ambition: { type: 'protect_family', priority: 0.8 },
    relationship: 80,
    familyTrust: 100,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: ['survive_dynasty'],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-son',
    name: 'Aulus Manlius',
    role: 'son',
    isPlayer: false,
    age: 24,
    skills: { rhetoric: 5, martial: 6, intrigus: 3 },
    traits: ['aggressive'],
    ambition: { type: 'personal_power', priority: 0.6 },
    relationship: 70,
    familyTrust: 90,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: ['first_consul'],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
  {
    id: 'npc-daughter',
    name: 'Tullia Manlius',
    role: 'daughter',
    isPlayer: false,
    age: 19,
    skills: { rhetoric: 5, martial: 0, intrigus: 5 },
    traits: ['cautious'],
    ambition: null,
    relationship: 75,
    familyTrust: 90,
    officeId: null,
    heldOffices: [],
    corruptionScore: 0,
    inheritedTraits: [],
    ambitionIds: [],
    reputationScores: {},
    formalImperium: 0,
    militaryImperium: 0,
    raisedLegions: [],
    veterans: [],
  },
];

// ─── Registry ──────────────────────────────────────────────────────────────

export const ALT_FAMILIES: Record<'duilia' | 'manlia', AltFamilyDefinition> = {
  duilia: {
    gensId: 'duilia',
    gensSurname: 'Duilius',
    gensName: 'Duilia',
    gensPlural: 'Duilii',
    family: DUILIA_FAMILY,
    denarii: BALANCE.altFamilies.duilia.startingDenarii,
    fides: BALANCE.altFamilies.duilia.startingFides,
    lifetimeDignitas: BALANCE.altFamilies.duilia.startingLifetimeDignitas,
    // All four clans start cool — "nobody knows them" (E1).
    familyReputations: {
      cornelii: BALANCE.altFamilies.duilia.startingClanReputation,
      valerii:  BALANCE.altFamilies.duilia.startingClanReputation,
      fabii:    BALANCE.altFamilies.duilia.startingClanReputation,
      claudii:  BALANCE.altFamilies.duilia.startingClanReputation,
    },
    // +2 commerce-flavoured assets (E1) — vineyard and urban insulae are
    // both 'economic' category (assetDefinitions.ts).
    ownedAssets: [
      { definitionId: 'vineyard', currentTier: 1, turnAcquired: 1 },
      { definitionId: 'urban_insulae', currentTier: 1, turnAcquired: 1 },
    ],
    unlockCondition: 'Complete any run (any outcome)',
    isUnlocked: (hall) => hall.length > 0,
  },
  manlia: {
    gensId: 'manlia',
    gensSurname: 'Manlius',
    gensName: 'Manlia',
    gensPlural: 'Manlii',
    family: MANLIA_FAMILY,
    denarii: BALANCE.altFamilies.manlia.startingDenarii,
    fides: BALANCE.altFamilies.manlia.startingFides,
    lifetimeDignitas: BALANCE.altFamilies.manlia.startingLifetimeDignitas,
    // Fabii and Claudii hostile, Cornelii neutral, Valerii sympathetic (E1 —
    // "pick from the four with historical plausibility, note the choice").
    // The two proudest old patrician houses judge a disgraced peer harshest;
    // the populist Valerii extend sympathy to a humbled patrician house (an
    // intentionally unusual pairing, noted here as the plan's own text asks).
    familyReputations: {
      fabii:    BALANCE.altFamilies.manlia.hostileClanReputation,
      claudii:  BALANCE.altFamilies.manlia.hostileClanReputation,
      cornelii: BALANCE.altFamilies.manlia.neutralClanReputation,
      valerii:  BALANCE.altFamilies.manlia.sympatheticClanReputation,
    },
    ownedAssets: [],
    unlockCondition: 'Complete a run with a Victory outcome',
    isUnlocked: (hall) => hall.some(r => r.outcome === 'victory'),
  },
};
