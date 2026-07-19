// ─── Portrait Models ─────────────────────────────────────────────────────────
// Types only, no logic — see engine/portraitEngine.ts for derivation and
// utils/portraitAssets.ts for the asset registry. Shared across every tab,
// not owned by Cursus. Chunk C0 of cursus-visual-redesign-plan.md.

/** Which family/clan a character's face pool belongs to. 'house' covers the
 *  player's own dynasty regardless of which starting gens (Brutii/Duilia/
 *  Manlia) is active — GameState.gensId is a flavour choice, not a distinct
 *  visual lineage (see the plan's Finding 10). One id per rival clan in
 *  data/startingClans.ts. */
export type PortraitLineageId = 'house' | 'cornelii' | 'valerii' | 'fabii' | 'claudii';

/** Six life stages a portrait ages through. Boundaries land on age
 *  landmarks already used elsewhere in the codebase (18 = every election/
 *  marriage/heir eligibility gate; 50/60/70/80 = reputationEngine.ts's own
 *  mortality bands) rather than arbitrary round numbers — the youth→adult
 *  transition lands on the same birthday that unlocks Cursus eligibility. */
export type PortraitAgeBand = 'baby' | 'child' | 'youth' | 'adult' | 'midage' | 'elder';

export type PortraitGender = 'm' | 'f';
