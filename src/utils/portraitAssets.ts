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
  // 'cornelii-1-m-child': require('../assets/portraits/portrait-cornelii-1-m-child.png'),
  // 'cornelii-1-m-youth': require('../assets/portraits/portrait-cornelii-1-m-youth.png'),
  // 'cornelii-1-m-adult': require('../assets/portraits/portrait-cornelii-1-m-adult.png'),
  // 'cornelii-1-m-midage': require('../assets/portraits/portrait-cornelii-1-m-midage.png'),
  // 'cornelii-1-m-elder': require('../assets/portraits/portrait-cornelii-1-m-elder.png'),
  // 'cornelii-1-f-baby': require('../assets/portraits/portrait-cornelii-1-f-baby.png'),
  // 'cornelii-1-f-child': require('../assets/portraits/portrait-cornelii-1-f-child.png'),
  // 'cornelii-1-f-youth': require('../assets/portraits/portrait-cornelii-1-f-youth.png'),
  // 'cornelii-1-f-adult': require('../assets/portraits/portrait-cornelii-1-f-adult.png'),
  // 'cornelii-1-f-midage': require('../assets/portraits/portrait-cornelii-1-f-midage.png'),
  // 'cornelii-1-f-elder': require('../assets/portraits/portrait-cornelii-1-f-elder.png'),
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
  // 'claudii-1-m-child': require('../assets/portraits/portrait-claudii-1-m-child.png'),
  // 'claudii-1-m-youth': require('../assets/portraits/portrait-claudii-1-m-youth.png'),
  // 'claudii-1-m-adult': require('../assets/portraits/portrait-claudii-1-m-adult.png'),
  // 'claudii-1-m-midage': require('../assets/portraits/portrait-claudii-1-m-midage.png'),
  // 'claudii-1-m-elder': require('../assets/portraits/portrait-claudii-1-m-elder.png'),
  // 'claudii-1-f-baby': require('../assets/portraits/portrait-claudii-1-f-baby.png'),
  // 'claudii-1-f-child': require('../assets/portraits/portrait-claudii-1-f-child.png'),
  // 'claudii-1-f-youth': require('../assets/portraits/portrait-claudii-1-f-youth.png'),
  // 'claudii-1-f-adult': require('../assets/portraits/portrait-claudii-1-f-adult.png'),
  // 'claudii-1-f-midage': require('../assets/portraits/portrait-claudii-1-f-midage.png'),
  // 'claudii-1-f-elder': require('../assets/portraits/portrait-claudii-1-f-elder.png'),
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

export const portraitAssets = {
  /** `key` is engine/portraitEngine.ts's portraitKeyFor output, e.g.
   *  'house-1-m-adult'. Returns undefined until that key's line above is
   *  uncommented (i.e. the file exists). */
  portrait: (key: string): RequiredAsset | undefined => PORTRAITS[key],
  /** `leaderId` is ClanLeader.id. Checked by PortraitRoundel before falling
   *  back to the pooled portrait() lookup. */
  leaderOverride: (leaderId: string): RequiredAsset | undefined => LEADER_PORTRAITS[leaderId],
};
