import type { Character, PendingSuccession, Regency } from '../models/character';
import type { GameState } from '../state/gameStore';
import { TRAIT_DEFINITIONS } from '../data/traits';
import { BALANCE } from '../data/balance';
import { OFFICES } from '../data/offices';
import { getHighestOffice } from './electionEngine';

// ─── Name pools ───────────────────────────────────────────────────────────────

const ROMAN_NAMES_MALE = [
  'Lucius', 'Marcus', 'Quintus', 'Titus', 'Gaius', 'Publius', 'Gnaeus',
  'Sextus', 'Aulus', 'Decimus', 'Spurius', 'Manius', 'Servius', 'Appius',
];

const ROMAN_NAMES_FEMALE = [
  'Livia', 'Julia', 'Claudia', 'Aemilia', 'Valeria', 'Cornelia', 'Porcia',
  'Caecilia', 'Marcia', 'Tullia', 'Sempronia', 'Hortensia', 'Fulvia', 'Licinia',
];

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
export function rollsDead(character: Character): boolean {
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
    // this function's header comment).
    currentOffice: null,
    officeSeasons: 0,
    heldOffices: [],
    campaigning: null,
    campaigningCharacterId: null,
    campaignVotes: {},
    electionRivals: [],
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
