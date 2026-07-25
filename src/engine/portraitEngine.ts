// ─── Portrait Engine ─────────────────────────────────────────────────────────
// Chunk C0 of cursus-visual-redesign-plan.md — pure derivation for the
// shared, character-tied, aging portrait system. No React/store imports.
// Consumed by components/shared/PortraitRoundel.tsx; the actual require()
// lookups live in utils/portraitAssets.ts, kept separate so this file stays
// pure and independently testable.

import type { Character } from '../models/character';
import type { ClanLeader } from '../models/clan';
import type { PortraitAgeBand, PortraitGender, PortraitLineageId } from '../models/portrait';
import { ROMAN_NAMES_FEMALE } from '../data/romanNames';

const FEMALE_PRAENOMEN_SET = new Set(ROMAN_NAMES_FEMALE);
const MALE_ROLES: Character['role'][] = ['paterfamilias', 'son', 'brother'];

/** age → life stage. See models/portrait.ts's own doc comment for why these
 *  six cutoffs, not others. */
export function ageBandFor(age: number): PortraitAgeBand {
  if (age <= 2) return 'baby';
  if (age <= 9) return 'child';
  if (age <= 17) return 'youth';
  if (age <= 44) return 'adult';
  if (age <= 64) return 'midage';
  return 'elder';
}

/** Character gender isn't a stored field (no field exists anywhere on
 *  Character) — and `role` alone is unreliable across succession: a
 *  daughter can inherit and become role: 'paterfamilias'
 *  (inheritanceEngine.succeedPaterfamilias) without her underlying identity
 *  changing. Praenomen-pool membership is the stable signal instead: every
 *  procedurally generated family member's first name is drawn from
 *  ROMAN_NAMES_FEMALE or it isn't (inheritanceEngine.suggestChildName /
 *  generateSuccessorSpouse), and that membership never changes across a
 *  character's life, unlike role. Falls back to role for the rare
 *  hand-authored name outside the pool (none currently — all three starting
 *  families' names are drawn from the same two pools, verified against
 *  data/startingFamily.ts and data/altFamilies.ts). */
export function genderForCharacter(character: Pick<Character, 'name' | 'role'>): PortraitGender {
  const praenomen = character.name.split(' ')[0];
  if (FEMALE_PRAENOMEN_SET.has(praenomen)) return 'f';
  return MALE_ROLES.includes(character.role) ? 'm' : 'f';
}

/** Every starting-clan leader is currently male (verified against all 13
 *  entries in data/startingClans.ts — masculine praenomen abbreviations
 *  throughout). ClanLeader has no gender field and no name-pool signal
 *  (leader names use abbreviated praenomina like "P.", "Cn.", not the full
 *  first-name pools genderForCharacter reads). Defaults to 'm' until a
 *  female leader exists in the roster — at that point this needs a real
 *  signal (most likely a field on ClanLeader), not a heuristic. */
export function genderForLeader(_leader: Pick<ClanLeader, 'name'>): PortraitGender {
  return 'm';
}

/** A player-family character is always the 'house' lineage, regardless of
 *  which of the three starting gentes (GameState.gensId) is active — see
 *  models/portrait.ts's doc comment. v1 does not track a spouse's origin
 *  clan (see the plan's Appendix B) — a spouse arranged via
 *  arrangeMarriageForum still becomes 'house' once married in. */
export function lineageForCharacter(): PortraitLineageId {
  return 'house';
}

const CLAN_LINEAGE_IDS: PortraitLineageId[] = ['cornelii', 'valerii', 'fabii', 'claudii'];

/** A rival clan leader's lineage is their own clan's id. ClanLeader objects
 *  don't carry a back-reference to their parent Clan (they live nested in
 *  Clan.leaders[]) — the caller must supply clanId from whatever scope
 *  already has both (e.g. the Clan being iterated to render its leaders). */
export function lineageForLeader(clanId: string): PortraitLineageId {
  return (CLAN_LINEAGE_IDS as string[]).includes(clanId)
    ? (clanId as PortraitLineageId)
    : 'house'; // defensive fallback — should never hit with the 4 current starting clans
}

/** Deterministic 1-indexed variant pick (matches the asset file-naming
 *  convention's `-1-`/`-2-` segment) so a given id always resolves to the
 *  same face across sessions. variantCount <= 1 always returns 1 — the
 *  Appendix A default (one variant per lineage for v1). */
export function variantIndexFor(id: string, variantCount: number): number {
  if (variantCount <= 1) return 1;
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % variantCount) + 1;
}

/** The minimal shape PortraitRoundel/portraitKeyFor need — a discriminated
 *  union rather than optional characterId/leaderId flags, so a caller can't
 *  accidentally supply neither or both. Callers pass real Character/
 *  ClanLeader fields directly (id/name/role/age, or id/name/age/clanId) —
 *  no store access here, this file stays pure. */
export type PortraitSubject =
  | { kind: 'character'; id: string; name: string; role: Character['role']; age: number; portraitVariant?: number }
  | { kind: 'leader'; id: string; name: string; age: number; clanId: string; portraitVariant?: number };

/** Builds a `PortraitSubject` straight from a `Character` — the shape every
 *  Cursus consumer (candidate header, campaign panel) needs, kept here so
 *  it's defined once rather than re-typed at each call site. */
export function characterPortraitSubject(
  character: Pick<Character, 'id' | 'name' | 'role' | 'age' | 'portraitVariant'>,
): PortraitSubject {
  return {
    kind: 'character',
    id: character.id,
    name: character.name,
    role: character.role,
    age: character.age,
    portraitVariant: character.portraitVariant,
  };
}

/** Builds a `PortraitSubject` for a `ClanLeader` — `clanId` isn't on
 *  `ClanLeader` itself (see `lineageForLeader`'s doc comment), so the caller
 *  supplies it from whatever scope already has both. */
export function leaderPortraitSubject(
  leader: Pick<ClanLeader, 'id' | 'name' | 'age' | 'portraitVariant'>,
  clanId: string,
): PortraitSubject {
  return {
    kind: 'leader',
    id: leader.id,
    name: leader.name,
    age: leader.age,
    clanId,
    portraitVariant: leader.portraitVariant,
  };
}

/** Appendix A's recommended v1 pool size (1 variant per lineage/gender/age
 *  band, 60 images total) — bump when a second variant's assets land; no
 *  other code changes needed, variantIndexFor already handles any count. */
export const DEFAULT_PORTRAIT_VARIANT_COUNT = 1;

/** Fallback glyph shown by PortraitRoundel when no image asset resolves for
 *  a subject — gender/age-appropriate rather than the flat initials circle
 *  it replaces (Chunk 1 of portrait-fixes.md). Not precious; easy to retune. */
const PLACEHOLDER_EMOJI: Record<PortraitGender, Record<PortraitAgeBand, string>> = {
  m: {
    baby: '👶',
    child: '👦',
    youth: '👦',
    adult: '👨',
    midage: '🧔',
    elder: '👴',
  },
  f: {
    baby: '👶',
    child: '👧',
    youth: '👧',
    adult: '👩',
    midage: '👩',
    elder: '👵',
  },
};

export function placeholderEmojiFor(gender: PortraitGender, ageBand: PortraitAgeBand): string {
  return PLACEHOLDER_EMOJI[gender][ageBand];
}

/** Composes the exact utils/portraitAssets.ts lookup key — matches the
 *  asset manifest's file naming (`portrait-{lineage}-{variant}-{gender}-
 *  {ageBand}.png`) minus the 'portrait-' prefix and extension, e.g.
 *  'house-1-m-adult', 'cornelii-1-m-elder'. */
export function portraitKeyFor(
  subject: PortraitSubject,
  variantCount: number = DEFAULT_PORTRAIT_VARIANT_COUNT,
): string {
  const lineage = subject.kind === 'character' ? lineageForCharacter() : lineageForLeader(subject.clanId);
  const gender = subject.kind === 'character' ? genderForCharacter(subject) : genderForLeader(subject);
  const ageBand = ageBandFor(subject.age);
  // portrait-fixes.md Chunk 6 — a subject assigned a real archetype variant
  // (gameStore's assignment hooks) always uses it; variantIndexFor's id-hash
  // is only a fallback for subjects that predate that system (old saves).
  const variant = subject.portraitVariant ?? variantIndexFor(subject.id, variantCount);
  return `${lineage}-${variant}-${gender}-${ageBand}`;
}

/** portrait-fixes.md Chunk 6 — picks a variant for a newly-created character
 *  or leader within a lineage+gender group, without repeating one already
 *  used in the current cycle. Once every variant in the group has been
 *  handed out (`usedThisCycle.length >= variantCount`, or `variantCount`
 *  itself shrank below what the cycle recorded), starts a fresh cycle —
 *  picks uniformly among all variants again, and the returned
 *  `usedThisCycle` contains only that pick (the first of the new cycle).
 *  `variantCount <= 1` always returns variant 1 with an empty cycle,
 *  matching `variantIndexFor`'s own single-variant convention. Callers
 *  persist the returned `usedThisCycle` back into
 *  GameState.portraitVariantCycles under this group's key. */
export function assignPortraitVariant(
  usedThisCycle: number[],
  variantCount: number,
): { variant: number; usedThisCycle: number[] } {
  if (variantCount <= 1) return { variant: 1, usedThisCycle: [] };

  const remaining: number[] = [];
  for (let v = 1; v <= variantCount; v++) {
    if (!usedThisCycle.includes(v)) remaining.push(v);
  }

  const startingFreshCycle = remaining.length === 0;
  const pool = startingFreshCycle
    ? Array.from({ length: variantCount }, (_, i) => i + 1)
    : remaining;

  const variant = pool[Math.floor(Math.random() * pool.length)];
  return {
    variant,
    usedThisCycle: startingFreshCycle ? [variant] : [...usedThisCycle, variant],
  };
}
