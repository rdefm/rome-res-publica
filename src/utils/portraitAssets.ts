// ─── Portrait Asset Registry ─────────────────────────────────────────────────
// Chunk C0 of cursus-visual-redesign-plan.md — shared across every tab, not
// Cursus-specific (see components/shared/PortraitRoundel.tsx, the only
// consumer). Metro resolves require() at BUNDLE time, so this file can never
// point at a file that doesn't exist yet — every asset's require() line
// below ships commented out. The designer (or whoever lands the art)
// uncomments a line the moment its file exists in assets/portraits/;
// nothing else in the app needs to change. A missing/commented entry
// resolves to `undefined`, and every consumer must render a fallback for
// that — see PortraitRoundel's initials-circle fallback.
//
// Naming: portrait-{lineage}-{variant}-{gender}-{ageBand}.png
// Lookup keys (this file's own argument) drop the 'portrait-' prefix and
// extension — see engine/portraitEngine.ts's portraitKeyFor, which composes
// these exact keys. Pool below is variant 1 only (Appendix A's recommended
// v1 size, 60 images) — add a `-2-` block the same way if a second variant
// per lineage is generated later; engine/portraitEngine.ts's
// variantIndexFor already handles any variant count with no code change.

import { assignPortraitVariant, DEFAULT_PORTRAIT_VARIANT_COUNT } from '../engine/portraitEngine';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredAsset = any; // RN's require() return type isn't locally typed anywhere else in this codebase (ParchmentCard.tsx, CharacterCard.tsx use the same untyped convention).

const PORTRAITS: Partial<Record<string, RequiredAsset>> = {
  // 'house-1-m-baby': require('../assets/portraits/portrait-house-1-m-baby.png'),
  // 'house-1-m-child': require('../assets/portraits/portrait-house-1-m-child.png'),
  // 'house-1-m-youth': require('../assets/portraits/portrait-house-1-m-youth.png'),
  // 'house-1-m-adult': require('../assets/portraits/portrait-house-1-m-adult.png'),
  // 'house-1-m-midage': require('../assets/portraits/portrait-house-1-m-midage.png'),
  // 'house-1-m-elder': require('../assets/portraits/portrait-house-1-m-elder.png'),
  // 'house-1-f-baby': require('../assets/portraits/portrait-house-1-f-baby.png'),
  // 'house-1-f-child': require('../assets/portraits/portrait-house-1-f-child.png'),
  // 'house-1-f-youth': require('../assets/portraits/portrait-house-1-f-youth.png'),
  // 'house-1-f-adult': require('../assets/portraits/portrait-house-1-f-adult.png'),
  // 'house-1-f-midage': require('../assets/portraits/portrait-house-1-f-midage.png'),
  // 'house-1-f-elder': require('../assets/portraits/portrait-house-1-f-elder.png'),
  // 'cornelii-1-m-baby': require('../assets/portraits/portrait-cornelii-1-m-baby.png'),
  'cornelii-1-m-child': require('../assets/portraits/portrait-cornelii-1-m-child.png'),
  // 'cornelii-1-m-youth': require('../assets/portraits/portrait-cornelii-1-m-youth.png'),
  'cornelii-1-m-adult': require('../assets/portraits/portrait-cornelii-1-m-adult.png'),
  'cornelii-1-m-midage': require('../assets/portraits/portrait-cornelii-1-m-midage.png'),
  'cornelii-1-m-elder': require('../assets/portraits/portrait-cornelii-1-m-elder.png'),
  // 'cornelii-1-f-baby': require('../assets/portraits/portrait-cornelii-1-f-baby.png'),
  // 'cornelii-1-f-child': require('../assets/portraits/portrait-cornelii-1-f-child.png'),
  // 'cornelii-1-f-youth': require('../assets/portraits/portrait-cornelii-1-f-youth.png'),
  // 'cornelii-1-f-adult': require('../assets/portraits/portrait-cornelii-1-f-adult.png'),
  // 'cornelii-1-f-midage': require('../assets/portraits/portrait-cornelii-1-f-midage.png'),
  // 'cornelii-1-f-elder': require('../assets/portraits/portrait-cornelii-1-f-elder.png'),
  'cornelii-2-m-child': require('../assets/portraits/portrait-cornelii-2-m-child.png'),
  'cornelii-2-m-adult': require('../assets/portraits/portrait-cornelii-2-m-adult.png'),
  'cornelii-2-m-midage': require('../assets/portraits/portrait-cornelii-2-m-midage.png'),
  'cornelii-2-m-elder': require('../assets/portraits/portrait-cornelii-2-m-elder.png'),
  'cornelii-3-m-child': require('../assets/portraits/portrait-cornelii-3-m-child.png'),
  'cornelii-3-m-adult': require('../assets/portraits/portrait-cornelii-3-m-adult.png'),
  'cornelii-3-m-midage': require('../assets/portraits/portrait-cornelii-3-m-midage.png'),
  'cornelii-3-m-elder': require('../assets/portraits/portrait-cornelii-3-m-elder.png'),
  // 'valerii-1-m-baby': require('../assets/portraits/portrait-valerii-1-m-baby.png'),
  // 'valerii-1-m-child': require('../assets/portraits/portrait-valerii-1-m-child.png'),
  // 'valerii-1-m-youth': require('../assets/portraits/portrait-valerii-1-m-youth.png'),
  // 'valerii-1-m-adult': require('../assets/portraits/portrait-valerii-1-m-adult.png'),
  // 'valerii-1-m-midage': require('../assets/portraits/portrait-valerii-1-m-midage.png'),
  // 'valerii-1-m-elder': require('../assets/portraits/portrait-valerii-1-m-elder.png'),
  // 'valerii-1-f-baby': require('../assets/portraits/portrait-valerii-1-f-baby.png'),
  // 'valerii-1-f-child': require('../assets/portraits/portrait-valerii-1-f-child.png'),
  // 'valerii-1-f-youth': require('../assets/portraits/portrait-valerii-1-f-youth.png'),
  // 'valerii-1-f-adult': require('../assets/portraits/portrait-valerii-1-f-adult.png'),
  // 'valerii-1-f-midage': require('../assets/portraits/portrait-valerii-1-f-midage.png'),
  // 'valerii-1-f-elder': require('../assets/portraits/portrait-valerii-1-f-elder.png'),
  // 'fabii-1-m-baby': require('../assets/portraits/portrait-fabii-1-m-baby.png'),
  // 'fabii-1-m-child': require('../assets/portraits/portrait-fabii-1-m-child.png'),
  // 'fabii-1-m-youth': require('../assets/portraits/portrait-fabii-1-m-youth.png'),
  // 'fabii-1-m-adult': require('../assets/portraits/portrait-fabii-1-m-adult.png'),
  // 'fabii-1-m-midage': require('../assets/portraits/portrait-fabii-1-m-midage.png'),
  // 'fabii-1-m-elder': require('../assets/portraits/portrait-fabii-1-m-elder.png'),
  // 'fabii-1-f-baby': require('../assets/portraits/portrait-fabii-1-f-baby.png'),
  // 'fabii-1-f-child': require('../assets/portraits/portrait-fabii-1-f-child.png'),
  // 'fabii-1-f-youth': require('../assets/portraits/portrait-fabii-1-f-youth.png'),
  // 'fabii-1-f-adult': require('../assets/portraits/portrait-fabii-1-f-adult.png'),
  // 'fabii-1-f-midage': require('../assets/portraits/portrait-fabii-1-f-midage.png'),
  // 'fabii-1-f-elder': require('../assets/portraits/portrait-fabii-1-f-elder.png'),
  // 'claudii-1-m-baby': require('../assets/portraits/portrait-claudii-1-m-baby.png'),
  // 'claudii-1-m-youth': require('../assets/portraits/portrait-claudii-1-m-youth.png'),
  // Claudii portrait variants — delivered (commit a966671) but never wired
  // into this registry, so every Claudii npc/leader fell back to the emoji
  // placeholder despite the files existing on disk. Filenames as delivered
  // (capitalized `Portrait-`, and numbered 2-5, not 1-4 — a different
  // convention than cornelii's lowercase/sequential-from-1 files above);
  // rather than renaming committed asset files, the registry KEYS below are
  // renumbered sequential-from-1 to match every other lineage's convention,
  // while the require() paths point at the actual on-disk filenames
  // verbatim. No 'baby'/'youth' band exists for any Claudii variant.
  'claudii-1-m-child': require('../assets/portraits/Portrait-claudii-2-m-child.png'),
  'claudii-1-m-adult': require('../assets/portraits/Portrait-claudii-2-m-adult.png'),
  'claudii-1-m-midage': require('../assets/portraits/Portrait-claudii-2-m-midage.png'),
  'claudii-1-m-elder': require('../assets/portraits/Portrait-claudii-2-m-elder.png'),
  // 'claudii-1-f-baby': require('../assets/portraits/portrait-claudii-1-f-baby.png'),
  // 'claudii-1-f-youth': require('../assets/portraits/portrait-claudii-1-f-youth.png'),
  'claudii-1-f-child': require('../assets/portraits/Portrait-claudii-3-f-child.png'),
  'claudii-1-f-adult': require('../assets/portraits/Portrait-claudii-3-f-adult.png'),
  'claudii-1-f-midage': require('../assets/portraits/Portrait-claudii-3-f-midage.png'),
  'claudii-1-f-elder': require('../assets/portraits/Portrait-claudii-3-f-elder.png'),
  // No 'claudii-2-f-child' — Portrait-claudii-3-m-* (this variant's male
  // counterpart) has no child image either; both stay missing (emoji
  // fallback for that one band) rather than borrowing a mismatched asset.
  'claudii-2-m-adult': require('../assets/portraits/Portrait-claudii-3-m-adult.png'),
  'claudii-2-m-midage': require('../assets/portraits/Portrait-claudii-3-m-midage.png'),
  'claudii-2-m-elder': require('../assets/portraits/Portrait-claudii-3-m-elder.png'),
  'claudii-3-m-child': require('../assets/portraits/Portrait-claudii-4-m-child.png'),
  'claudii-3-m-adult': require('../assets/portraits/Portrait-claudii-4-m-adult.png'),
  'claudii-3-m-midage': require('../assets/portraits/Portrait-claudii-4-m-midage.png'),
  'claudii-3-m-elder': require('../assets/portraits/Portrait-claudii-4-m-elder.png'),
  // variant 4 — only adult/child delivered; midage/elder stay on the emoji
  // fallback for this variant specifically.
  'claudii-4-m-child': require('../assets/portraits/Portrait-claudii-5-m-child.png'),
  'claudii-4-m-adult': require('../assets/portraits/Portrait-claudii-5-m-adult.png'),
};

// Bespoke full-image overrides for the 4 starting-family characters with
// real art (checked before falling back to the pooled archetype lookup).
// Keyed by Character.id — stable across every starting family variant
// (data/startingFamily.ts, data/altFamilies.ts; see portrait-fixes.md
// Chunk 2, finding 6). The player is keyed by literal id 'pc-1' rather than
// isPlayer, since PortraitSubject's 'character' variant already carries id.
const CHARACTER_PORTRAITS: Partial<Record<string, RequiredAsset>> = {
  'pc-1':         require('../assets/images/portrait-paterfamilias.png'),
  'npc-wife':     require('../assets/images/npc-wife.png'),
  'npc-son':      require('../assets/images/npc-son.png'),
  'npc-daughter': require('../assets/images/npc-daughter.png'),
};

// Optional bespoke full-image overrides for named leaders (checked before
// falling back to their clan's pooled lineage key) — nice-to-have, the pool
// already covers every leader. Keyed by ClanLeader.id (data/startingClans.ts).
const LEADER_PORTRAITS: Partial<Record<string, RequiredAsset>> = {
  // 'cornelius-scipio': require('../assets/portraits/portrait-leader-cornelius-scipio.png'),
  // 'cornelius-rufus': require('../assets/portraits/portrait-leader-cornelius-rufus.png'),
  // 'cornelius-merula': require('../assets/portraits/portrait-leader-cornelius-merula.png'),
  // 'cornelius-scipio-minor': require('../assets/portraits/portrait-leader-cornelius-scipio-minor.png'),
  // 'valerius-flaccus': require('../assets/portraits/portrait-leader-valerius-flaccus.png'),
  // 'valerius-antias': require('../assets/portraits/portrait-leader-valerius-antias.png'),
  // 'valerius-messalla': require('../assets/portraits/portrait-leader-valerius-messalla.png'),
  // 'fabius-maximus': require('../assets/portraits/portrait-leader-fabius-maximus.png'),
  // 'fabius-buteo': require('../assets/portraits/portrait-leader-fabius-buteo.png'),
  // 'fabius-pictor': require('../assets/portraits/portrait-leader-fabius-pictor.png'),
  // 'claudius-pulcher': require('../assets/portraits/portrait-leader-claudius-pulcher.png'),
  // 'claudius-marcellus': require('../assets/portraits/portrait-leader-claudius-marcellus.png'),
  // 'claudius-nero': require('../assets/portraits/portrait-leader-claudius-nero.png'),
};

// portrait-fixes.md Chunk 6 — how many archetype variants actually exist
// per lineage+gender group (key `${lineage}-${gender}`), read by
// gameStore.ts's assignment hooks (startGame, confirmBirthNaming,
// remarriage, leader succession) to know the range assignPortraitVariant
// should pick within. Any group not listed here defaults to
// DEFAULT_PORTRAIT_VARIANT_COUNT (1) — the same default variantIndexFor's
// hash-fallback path already assumes.
const VARIANT_COUNTS: Partial<Record<string, number>> = {
  'cornelii-m': 3,
  'claudii-m': 4,
  'claudii-f': 1,
};

export const portraitAssets = {
  /** `key` is engine/portraitEngine.ts's portraitKeyFor output, e.g.
   *  'house-1-m-adult'. Returns undefined until that key's line above is
   *  uncommented (i.e. the file exists). */
  portrait: (key: string): RequiredAsset | undefined => PORTRAITS[key],
  /** `leaderId` is ClanLeader.id. Checked by PortraitRoundel before falling
   *  back to the pooled portrait() lookup. */
  leaderOverride: (leaderId: string): RequiredAsset | undefined => LEADER_PORTRAITS[leaderId],
  /** `characterId` is Character.id. Checked by PortraitRoundel before
   *  falling back to the pooled portrait() lookup — mirrors leaderOverride. */
  characterOverride: (characterId: string): RequiredAsset | undefined => CHARACTER_PORTRAITS[characterId],
  /** portrait-fixes.md Chunk 6 — how many archetype variants exist for
   *  `${lineage}-${gender}` (e.g. 'cornelii-m'). Read by assignVariant below;
   *  exposed separately too since a couple of call sites need the raw count. */
  variantCountFor: (lineage: string, gender: string): number =>
    VARIANT_COUNTS[`${lineage}-${gender}`] ?? DEFAULT_PORTRAIT_VARIANT_COUNT,
  /** portrait-fixes.md Chunk 6 — the single entry point every character/
   *  leader creation site (gameStore.startGame/confirmBirthNaming,
   *  turnSequencer's remarriage and leader-succession paths) calls to get a
   *  new portraitVariant and the updated GameState.portraitVariantCycles to
   *  persist. Lives here rather than in engine/portraitEngine.ts (which
   *  deliberately has no knowledge of which assets exist) or state/
   *  gameStore.ts (which turnSequencer.ts can't import a value from without
   *  a circular dependency, since gameStore.ts already imports
   *  turnSequencer.processSeason). */
  assignVariant: (
    lineage: string,
    gender: string,
    // Defaults to {} — plenty of test fixtures across the suite build a
    // partial GameState predating this field, so `s.portraitVariantCycles`
    // can arrive here as `undefined` rather than merely missing one key.
    cycles: Record<string, number[]> = {},
  ): { variant: number; cycles: Record<string, number[]> } => {
    const safeCycles = cycles ?? {};
    const key = `${lineage}-${gender}`;
    const variantCount = VARIANT_COUNTS[key] ?? DEFAULT_PORTRAIT_VARIANT_COUNT;
    const { variant, usedThisCycle } = assignPortraitVariant(safeCycles[key] ?? [], variantCount);
    return { variant, cycles: { ...safeCycles, [key]: usedThisCycle } };
  },
};
