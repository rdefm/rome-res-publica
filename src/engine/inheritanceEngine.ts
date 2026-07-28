import type { Character, CharacterSkills, PendingSuccession, Regency, CadetBranch, PersonalityTrait } from '../models/character';
import type { GameState } from '../state/gameStore';
import { TRAIT_DEFINITIONS } from '../data/traits';
import { BALANCE } from '../data/balance';
import { OFFICES } from '../data/offices';
import { getHighestOffice } from './electionEngine';
import { LEADER_PRAENOMINA } from '../data/clientNames';
import { ROMAN_NAMES_MALE, ROMAN_NAMES_FEMALE } from '../data/romanNames';

export function suggestChildName(role: 'son' | 'daughter', familyName: string): string {
  const pool = role === 'son' ? ROMAN_NAMES_MALE : ROMAN_NAMES_FEMALE;
  const praenomen = pool[Math.floor(Math.random() * pool.length)];
  return `${praenomen} ${familyName}`;
}

// ─── Birth probability ────────────────────────────────────────────────────────

/**
 * Returns probability of a birth occurring this season.
 * Base 8%, reduced by 2% per existing child under 18, floored at 2%.
 */
export function calcBirthProbability(family: Character[]): number {
  const childrenUnder18 = family.filter(
    c => !c.isPlayer && c.role !== 'spouse' && c.age < 18
  ).length;
  return Math.max(0.02, 0.08 - childrenUnder18 * 0.02);
}

/**
 * Returns true if a birth is eligible this season.
 * Requires: player age 18–54, spouse exists age 18–45.
 */
export function isBirthEligible(family: Character[]): boolean {
  const player = family.find(c => c.isPlayer);
  const spouse = family.find(c => c.role === 'spouse');
  if (!player || !spouse) return false;
  const playerOk = player.age >= 18 && player.age <= 54;
  const spouseOk = spouse.age >= 18 && spouse.age <= 45;
  return playerOk && spouseOk;
}

// ─── Remarriage — keeping births alive across generations ────────────────────
// Births only ever check "does the CURRENT paterfamilias have a spouse" — that
// logic is already generation-agnostic (isBirthEligible/calcBirthProbability
// read isPlayer/role, not a specific character id), but nothing in this
// codebase ever GRANTS a new spouse: applySuccession promotes an heir without
// one (an unmarried son/daughter, or the spouse's own line), and a spouse can
// die of old age the same as anyone else (turnSequencer step 10's yearly
// mortality roll iterates the whole family). Either way, births silently stop
// forever for that generation once a spouse is missing. This closes the gap
// the same passive-roll way births themselves work.

/**
 * True while the paterfamilias exists, is of marrying/childbearing age, and
 * has no spouse in the family — covers a freshly-succeeded heir who
 * inherited without one AND an existing paterfamilias whose spouse died.
 */
export function needsSpouse(family: Character[]): boolean {
  const player = family.find(c => c.isPlayer);
  if (!player) return false;
  const hasSpouse = family.some(c => c.role === 'spouse');
  return !hasSpouse && player.age >= 18 && player.age <= 54;
}

/**
 * Procedurally arranges a new spouse for a spouseless paterfamilias — same
 * name-pool convention as suggestChildName. This game's fiction is
 * consistently a male paterfamilias / female spouse (every existing flavor
 * line assumes it, e.g. BirthNamingModal's "Livia has delivered..."), so the
 * generated spouse always draws from ROMAN_NAMES_FEMALE.
 */
export function generateSpouse(familyName: string): Character {
  const praenomen = ROMAN_NAMES_FEMALE[Math.floor(Math.random() * ROMAN_NAMES_FEMALE.length)];
  return {
    id: `spouse-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: `${praenomen} ${familyName}`,
    role: 'spouse',
    isPlayer: false,
    age: 18 + Math.floor(Math.random() * 15), // 18–32, comfortably within the childbearing window
    skills: {
      rhetoric: 3 + Math.floor(Math.random() * 5),
      martial: Math.floor(Math.random() * 2),
      intrigus: 3 + Math.floor(Math.random() * 5),
    },
    traits: [],
    ambition: null,
    relationship: 70,
    familyTrust: 100,
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
  };
}

// ─── Trait inheritance ────────────────────────────────────────────────────────

export function resolveInheritedTraits(
  parent1: Character,
  parent2: Character,
): string[] {
  const inherited: string[] = [];
  const heritableTraits = TRAIT_DEFINITIONS.filter(t => t.heritable);

  for (const trait of heritableTraits) {
    const p1Has = parent1.inheritedTraits.includes(trait.id);
    const p2Has = parent2.inheritedTraits.includes(trait.id);

    let threshold = 0;
    if (p1Has && p2Has) {
      threshold = Math.min(0.95, trait.inheritanceWeight * 1.5);
    } else if (p1Has || p2Has) {
      threshold = trait.inheritanceWeight;
    }

    if (Math.random() < threshold) {
      const excluded = trait.exclusiveWith ?? [];
      if (!inherited.some(id => excluded.includes(id))) {
        inherited.push(trait.id);
      }
    }
  }

  // Mutation: 15% chance of one random heritable trait regardless of parents
  if (Math.random() < 0.15) {
    const candidates = heritableTraits.filter(t => !inherited.includes(t.id));
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      const excluded = pick.exclusiveWith ?? [];
      if (!inherited.some(id => excluded.includes(id))) {
        inherited.push(pick.id);
      }
    }
  }

  return inherited;
}

// ─── Apply trait skill modifiers ─────────────────────────────────────────────

export function applyTraitModifiers(
  character: Character,
  traitIds: string[],
): Character {
  const updated = { ...character, skills: { ...character.skills } };

  for (const id of traitIds) {
    const trait = TRAIT_DEFINITIONS.find(t => t.id === id);
    if (!trait?.skillModifiers) continue;
    const sm = trait.skillModifiers;
    // auctoritas removed — CharacterSkills now has only rhetoric, martial, intrigus
    updated.skills.rhetoric = Math.max(0, Math.min(10, updated.skills.rhetoric + (sm.rhetoric ?? 0)));
    updated.skills.martial  = Math.max(0, Math.min(10, updated.skills.martial  + (sm.martial  ?? 0)));
    updated.skills.intrigus = Math.max(0, Math.min(10, updated.skills.intrigus + (sm.intrigus ?? 0)));
  }

  updated.inheritedTraits = traitIds;
  return updated;
}

// ─── Child growth curve (2026-07) ───────────────────────────────────────────
// See data/balance.ts's childGrowth section for the tunable numbers and the
// full rationale. Only ever touches a Character with `parentIds` set — every
// character that predates this feature is untouched by any function here.

/** True while a character is still on the child growth curve — has
 *  `parentIds` (only ever set by a birth after this feature shipped) AND is
 *  still under 18. Once a growing-up child turns 18, this flips false
 *  permanently and every function below stops applying to them; they behave
 *  exactly like any other adult (ordinary BALANCE.training.skillCap, no more
 *  age-bracket ceiling, no more passive tick). */
export function isGrowingUp(character: Character): boolean {
  return !!character.parentIds && character.age < 18;
}

/** The hard ceiling for a growing-up child's current age — limits BOTH the
 *  passive yearly tick and manual training equally. Not meaningful once
 *  isGrowingUp(character) is false (age >= 18); callers should check that
 *  first and fall back to BALANCE.training.skillCap themselves. */
export function getChildSkillCap(age: number): number {
  if (age < 10) return BALANCE.childGrowth.bracketCapUnder10;
  return BALANCE.childGrowth.bracketCap10to17;
}

function averageParentSkill(a: number, b: number, rng: () => number): number {
  return Math.max(0, Math.min(10, Math.round((a + b) / 2 + (rng() * 2 - 1))));
}

/** Live — reads the parents' CURRENT skills every time this is called, not a
 *  value snapshotted at birth, so a parent who trains up later raises the
 *  child's target too. Falls back to a single parent's skills (used for
 *  both slots in the average) if the other can't be found in `family`
 *  (e.g. died); returns the child's own current skills unchanged (no target
 *  to grow toward, so no growth that tick) if NEITHER parent can be found. */
export function computeChildSkillTargets(
  child: Character,
  family: Character[],
  rng: () => number = Math.random,
): CharacterSkills {
  const [idA, idB] = child.parentIds ?? [];
  const parentA = family.find(c => c.id === idA);
  const parentB = family.find(c => c.id === idB);
  const skillsA = parentA?.skills ?? parentB?.skills;
  const skillsB = parentB?.skills ?? parentA?.skills;
  if (!skillsA || !skillsB) return child.skills;
  return {
    rhetoric: averageParentSkill(skillsA.rhetoric, skillsB.rhetoric, rng),
    martial:  averageParentSkill(skillsA.martial,  skillsB.martial,  rng),
    intrigus: averageParentSkill(skillsA.intrigus, skillsB.intrigus, rng),
  };
}

/** Once-a-year passive tick — call from the same crossedNewYear gate that
 *  already increments age (turnSequencer.ts step 10). Pure; returns a new
 *  family array, only ever touching characters isGrowingUp() returns true
 *  for. Per skill, if the character is below min(their age-bracket cap,
 *  their live target), rolls BALANCE.childGrowth.passiveGrowthChancePerYear
 *  for a +1 — this alone produces "flat" (ages 0-9, low cap of 3 reached
 *  quickly) then "ramp" (ages 10-17, higher cap of 6 gives real room to keep
 *  climbing) as an emergent effect of the two brackets, no separate curve
 *  formula needed. */
export function applyChildPassiveGrowth(family: Character[], rng: () => number = Math.random): Character[] {
  return family.map(c => {
    if (!isGrowingUp(c)) return c;
    const cap = getChildSkillCap(c.age);
    const target = computeChildSkillTargets(c, family, rng);
    const grow = (current: number, targetVal: number): number => {
      const ceiling = Math.min(cap, targetVal);
      if (current >= ceiling) return current;
      return rng() < BALANCE.childGrowth.passiveGrowthChancePerYear ? current + 1 : current;
    };
    return {
      ...c,
      skills: {
        rhetoric: grow(c.skills.rhetoric, target.rhetoric),
        martial:  grow(c.skills.martial,  target.martial),
        intrigus: grow(c.skills.intrigus, target.intrigus),
      },
    };
  });
}

// ─── Phase 3, Chunk P3-C — Mortality & Succession ───────────────────────────
// No pre-existing natural-mortality system existed anywhere in this codebase
// before this chunk (verified — only trial execution/exile and battle death
// removed a family member, neither via an age-based roll). See
// BALANCE.succession's header comment for the "first-pass invention, not a
// period-accurate table" framing.
//
// Uses plain Math.random(), matching this file's own existing convention
// (resolveInheritedTraits above) rather than an injected rng — every other
// function here already does this; mortalityChance below is the pure,
// directly-testable half of the roll.

/** Annual death chance for a character of the given age, from
 *  BALANCE.succession.mortalityByAge's lower-bound-inclusive bands. */
export function mortalityChance(age: number): number {
  const bands = BALANCE.succession.mortalityByAge;
  let chance = bands[0].annualChance;
  for (const band of bands) {
    if (age >= band.minAge) chance = band.annualChance;
  }
  return chance;
}

/** Rolls this character's mortality for the current yearly rollover. */
/** Takes `{ age }` rather than a full Character — P3-D's cadet-branch aging
 *  tick (turnSequencer.ts) reuses this against a CadetBranch, which isn't a
 *  Character. Every existing Character caller already satisfies this
 *  structurally, no call-site changes needed. */
export function rollsDead(character: { age: number }): boolean {
  return Math.random() < mortalityChance(character.age);
}

/** Eldest son > eldest daughter > eldest spouse, then every other eligible
 *  relative in the same role-then-age priority — [0] is the default heir;
 *  the rest are "name a different heir" candidates (see PendingSuccession's
 *  doc comment). Same base ordering musterEngine.ts's retired
 *  applyCharacterDeath used, extended to a full list rather than one pick
 *  per role tier. Empty if no eligible relative exists. */
export function getHeirOrder(family: Character[], deceasedId: string): Character[] {
  const remaining = family.filter(c => c.id !== deceasedId);
  const byRole = (role: Character['role']) =>
    remaining.filter(c => c.role === role).sort((a, b) => b.age - a.age);
  return [...byRole('son'), ...byRole('daughter'), ...byRole('spouse')];
}

export interface DeathDetectionResult {
  family: Character[];
  /** null for a non-paterfamilias death (simple removal, unchanged from
   *  before this chunk) — non-null only when the deceased was `isPlayer`. */
  pendingSuccession: PendingSuccession | null;
}

/** The single death-detection path for BOTH natural age-based death
 *  (turnSequencer.ts step 10) and battle death (musterEngine.ts's
 *  applyBattleOutcome) — see this chunk's design note on unifying the two
 *  rather than leaving battle death's old silent/immediate reassignment as
 *  a second, divergent succession system. Removes the deceased from
 *  `family`; when they were the paterfamilias, does NOT reassign `isPlayer`
 *  — that's gameStore.succeedPaterfamilias's job, driven by the player's
 *  choice in the scripted sequence (successionEvents.ts) this function's
 *  non-null `pendingSuccession` result triggers. `heldOffices` is the
 *  caller's current `GameState.heldOffices` (the deceased's own cursus
 *  history — see gameStore.succeedPaterfamilias's doc comment for why this
 *  resets on succession), read here only for the death card's flavour line. */
export function detectPaterfamiliasDeath(
  family: Character[],
  deceasedId: string,
  heldOffices: string[],
): DeathDetectionResult {
  const dead = family.find(c => c.id === deceasedId);
  const remaining = family.filter(c => c.id !== deceasedId);
  if (!dead || !dead.isPlayer) {
    return { family: remaining, pendingSuccession: null };
  }

  const highestOfficeId = getHighestOffice(heldOffices);
  const officeDef = highestOfficeId ? OFFICES.find(o => o.id === highestOfficeId) : undefined;
  const rememberedDetail = officeDef
    ? `who served Rome as ${officeDef.name}`
    : dead.traits.length > 0
      ? `remembered by the household as ${dead.traits[0]}`
      : `who lived a private life`;

  return {
    family: remaining,
    pendingSuccession: {
      deceasedId: dead.id,
      deceasedName: dead.name,
      deceasedAge: dead.age,
      rememberedDetail,
      eligibleHeirIds: getHeirOrder(family, deceasedId).map(c => c.id),
    },
  };
}

/** Reassigns `isPlayer`/role to `heirId`, clears the deceased's cursus
 *  history (a fresh reign starts with a clean Cursus Honorum — see
 *  gameStore.ts's `succeedPaterfamilias:` effect-string token, this
 *  function's only caller), enters a regency if the heir is a minor, and
 *  clears `pendingSuccession`. `isAlternative` applies
 *  BALANCE.succession.nameOtherHeirFamilyTrustPenalty to the new
 *  paterfamilias directly (there is no separate GameState-level "family
 *  trust" stat — verified; familyTrust lives on Character itself). Pure —
 *  returns a patch, does not mutate `state`. */
export function applySuccession(state: GameState, heirId: string, isAlternative: boolean): Partial<GameState> {
  const heir = state.family.find(c => c.id === heirId);
  if (!heir) return {};

  const r = BALANCE.succession;
  const family = state.family.map(c => {
    if (c.id !== heirId) return c;
    const trust = isAlternative ? Math.max(0, c.familyTrust + r.nameOtherHeirFamilyTrustPenalty) : c.familyTrust;
    return { ...c, isPlayer: true, role: 'paterfamilias' as const, familyTrust: trust };
  });

  const patch: Partial<GameState> = {
    family,
    pendingSuccession: null,
    // A fresh reign starts a fresh cursus — the offices/campaign state on
    // GameState belonged to the deceased (this codebase tracks "the
    // player's" career at the GameState level, not per-Character — see
    // this function's header comment). Before clearing it, P3-E's
    // cross-generation tracking fields capture what's about to be lost.
    currentOffice: null,
    officeSeasons: 0,
    heldOffices: [],
    campaigning: null,
    campaigningCharacterId: null,
    campaignVotes: {},
    electionRivals: [],
    highestOfficeEverHeld: getHighestOffice(
      [state.highestOfficeEverHeld, ...state.heldOffices].filter((id): id is string => !!id)
    ),
    paterfamiliasGenerations: state.paterfamiliasGenerations + 1,
    // Tutorial redesign, T10 — durable trigger for the lesson-succession
    // just-in-time lesson (tutorialEngine.getEligibleLesson). Also stamped
    // by promoteCadetToParterfamilias below, this function's own sibling
    // succession path. Cleared once the lesson fires.
    flags: { ...state.flags, 'pending-lesson-succession': true },
  };

  if (heir.age < r.regencyMinorAge) {
    const remaining = family.filter(c => c.id !== heirId);
    const spouse = remaining.find(c => c.role === 'spouse' && c.age >= 18);
    const eldestAdultKin = [...remaining]
      .filter(c => c.age >= 18)
      .sort((a, b) => b.age - a.age)[0];
    const regent = spouse ?? eldestAdultKin ?? null;
    const regency: Regency = {
      heirId,
      regentId: regent?.id ?? null,
      untilYear: state.year + (r.regencyMinorAge - heir.age),
    };
    patch.regency = regency;
  }

  return patch;
}

// ─── Phase 3, Chunk P3-D — Cadet Branch ─────────────────────────────────────

const CADET_PERSONALITY_TRAITS: PersonalityTrait[] = ['aggressive', 'content', 'ambitious', 'cautious'];

// {gensName} filled at generation time — Phase 5, Chunk P5-E — was hardcoded
// 'Gens Brutia', found during the gens-neutrality sweep. Same placeholder
// convention as data/epilogueText.ts.
const CADET_CHARACTERIZATIONS: Record<PersonalityTrait, string> = {
  aggressive: 'quick to speak his mind and quicker to take offence',
  content: 'a quiet man who has never asked the Gens {gensName} for anything',
  ambitious: 'a man who watches the main line\'s fortunes with more interest than he lets on',
  cautious: 'careful with money and careful with words, in that order',
};

/** Generated once at run start (gameStore.startGame, both start types) — see
 *  models/character.ts's CadetBranch doc comment for why he isn't a
 *  playable Character until/unless promoted. Reuses LEADER_PRAENOMINA
 *  (reputationEngine.ts's existing successor-generator pool) per the plan's
 *  explicit instruction, rather than inventing a second name pool.
 *  `gensName` — Phase 5, Chunk P5-E — the feminine/adjectival form (e.g.
 *  'Brutia'), matching this function's own pre-existing naming convention;
 *  was hardcoded before this chunk. */
export function generateCadet(gensName: string): CadetBranch {
  const c = BALANCE.cadet;
  const praenomen = LEADER_PRAENOMINA[Math.floor(Math.random() * LEADER_PRAENOMINA.length)];
  const age = c.ageMin + Math.floor(Math.random() * (c.ageMax - c.ageMin + 1));
  const skill = () => c.skillMin + Math.floor(Math.random() * (c.skillMax - c.skillMin + 1));
  const trait = CADET_PERSONALITY_TRAITS[Math.floor(Math.random() * CADET_PERSONALITY_TRAITS.length)];

  return {
    id: `cadet-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    name: `${praenomen} ${gensName}`,
    age,
    skills: { rhetoric: skill(), martial: skill(), intrigus: skill() },
    trait,
    characterization: CADET_CHARACTERIZATIONS[trait].replace('{gensName}', gensName),
    metCount: 0,
    standing: c.startingStanding,
    alive: true,
  };
}

/** D3's continuation — promotes `cadet` into a fresh playable `family`
 *  (himself plus one generated spouse, so the new line isn't a dead end
 *  waiting to happen — a documented simplification; no children are
 *  spawned, they can arrive through the existing birth mechanics like any
 *  other family). Reuses the same cursus-clearing shape `applySuccession`
 *  above already established. Rome/war/crisis/clan state is untouched —
 *  this only returns `family` + cursus fields + the cadet-consumption
 *  flags; the caller (gameStore's continueAsCadet: token) is responsible
 *  for NOT touching anything else. */
export function promoteCadetToParterfamilias(cadet: CadetBranch, state: GameState): Partial<GameState> {
  // Phase 5, Chunk P5-E — was hardcoded 'Brutia', found during the
  // gens-neutrality sweep; `state` was already a parameter here.
  const spouseName = `${ROMAN_NAMES_FEMALE[Math.floor(Math.random() * ROMAN_NAMES_FEMALE.length)]} ${state.gensName}`;
  const newPaterfamilias: Character = {
    id: cadet.id,
    name: cadet.name,
    role: 'paterfamilias',
    isPlayer: true,
    age: cadet.age,
    skills: { ...cadet.skills },
    traits: [cadet.trait],
    ambition: null,
    relationship: 100,
    familyTrust: 70, // starts under some suspicion — a distant cousin, not the line everyone expected
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
  };
  const spouse: Character = {
    id: `${cadet.id}-spouse`,
    name: spouseName,
    role: 'spouse',
    isPlayer: false,
    age: Math.max(18, cadet.age - 5),
    skills: { rhetoric: 3, martial: 0, intrigus: 3 },
    traits: ['content'],
    ambition: null,
    relationship: 80,
    familyTrust: 80,
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
  };

  return {
    family: [newPaterfamilias, spouse],
    pendingSuccession: null,
    regency: null,
    cadetBranchUsed: true,
    legacyPenaltyMult: BALANCE.cadet.legacyPenaltyMult,
    // Same cursus-clearing as applySuccession — a fresh line, fresh Cursus.
    currentOffice: null,
    officeSeasons: 0,
    heldOffices: [],
    campaigning: null,
    campaigningCharacterId: null,
    campaignVotes: {},
    electionRivals: [],
    highestOfficeEverHeld: getHighestOffice(
      [state.highestOfficeEverHeld, ...state.heldOffices].filter((id): id is string => !!id)
    ),
    paterfamiliasGenerations: state.paterfamiliasGenerations + 1,
    // Tutorial redesign, T10 — see applySuccession's identical comment.
    flags: { ...state.flags, 'pending-lesson-succession': true },
  };
}
