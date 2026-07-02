import type { Character } from '../models/character';
import { TRAIT_DEFINITIONS } from '../data/traits';

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
