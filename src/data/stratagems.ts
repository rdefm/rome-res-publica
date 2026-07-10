// ─── Stratagems (P1-M7 content) ─────────────────────────────────────────────
// The 8-card v1 stratagem catalog — rome-military-implementation-plan.md
// §Chunk M7. Pure content: id, display text, timing, and targeting metadata
// only. Every numeric effect magnitude lives in BALANCE.battle.stratagems
// (src/data/balance.ts); every bit of logic (hand drawing, legality,
// effect application) lives in src/engine/battle/battleEngine.ts's "small
// effect-key switch" per the plan's instruction.
//
// Timing: all cards except 'rally_the_standards' are 'pre_battle' — chosen
// at deployment (Deployment.preBattleStratagems) and resolved once by
// battleEngine.initBattle. This is a deliberate simplification of the
// plan's "played at deployment or any decision point per card's timing
// field" — every card OTHER than Rally reads naturally as a one-time
// battle-wide/lane-wide setup (caltrops laid, an oath sworn, a doctrine
// briefed) rather than something re-triggered mid-fight, and it keeps the
// live-battle stratagem surface to the one card that's inherently reactive
// (a wing has to have broken first). 'rally_the_standards' is 'reactive' —
// played via SideOrders during the 'orders' phase whenever a broken own
// wing qualifies.

export type StratagemId =
  | 'ambuscade'
  | 'caltrops'
  | 'fire_arrows'
  | 'rally_the_standards'
  | 'forced_march'
  | 'testudo_discipline'
  | 'officers_oath'
  | 'double_envelopment_doctrine';

export type StratagemTiming = 'pre_battle' | 'reactive';

/** What the card needs a target for, if anything. 'own_lane'/'enemy_lane'
 *  cards need a LaneId; 'own_side'/'enemy_side' cards apply army-wide;
 *  'none' needs nothing. */
export type StratagemTarget = 'own_lane' | 'enemy_lane' | 'own_side' | 'enemy_side' | 'none';

export interface StratagemDef {
  id: StratagemId;
  label: string;
  description: string;
  timing: StratagemTiming;
  target: StratagemTarget;
  /** Ambuscade only — playable only when the battle's terrain id is one of these. */
  requiresTerrainIds?: string[];
  /** Rally the Standards only — playable only when the targeted own lane is broken. */
  requiresBrokenOwnWing?: boolean;
}

export const STRATAGEMS: Record<StratagemId, StratagemDef> = {
  ambuscade: {
    id: 'ambuscade',
    label: 'Ambuscade',
    description: 'One enemy lane starts the battle at −10 morale. Rough hills or a river crossing only.',
    timing: 'pre_battle',
    target: 'enemy_lane',
    requiresTerrainIds: ['rough_hills', 'river_crossing'],
  },
  caltrops: {
    id: 'caltrops',
    label: 'Caltrops',
    description: 'Iron spikes sown before one of your lanes — incoming cavalry charges land far weaker there, all battle.',
    timing: 'pre_battle',
    target: 'own_lane',
  },
  fire_arrows: {
    id: 'fire_arrows',
    label: 'Fire Arrows',
    description: "Flame turned on the enemy's beasts — their elephants panic more easily for the rest of the battle.",
    timing: 'pre_battle',
    target: 'enemy_side',
  },
  rally_the_standards: {
    id: 'rally_the_standards',
    label: 'Rally the Standards',
    description: 'One broken wing of yours re-forms and returns to the line — once per battle, commander must stand adjacent.',
    timing: 'reactive',
    target: 'own_lane',
    requiresBrokenOwnWing: true,
  },
  forced_march: {
    id: 'forced_march',
    label: 'Forced March',
    description: "Strike before the enemy is ready — their reserve cannot be committed until the third round.",
    timing: 'pre_battle',
    target: 'enemy_side',
  },
  testudo_discipline: {
    id: 'testudo_discipline',
    label: 'Testudo Discipline',
    description: 'Shields locked overhead — one lane takes no prelude or skirmisher-panic damage, all battle.',
    timing: 'pre_battle',
    target: 'own_lane',
  },
  officers_oath: {
    id: 'officers_oath',
    label: "Officer's Oath",
    description: 'A binding oath before the standards — one lane fights as though its loyalty were unshakeable, all battle.',
    timing: 'pre_battle',
    target: 'own_lane',
  },
  double_envelopment_doctrine: {
    id: 'double_envelopment_doctrine',
    label: 'Double Envelopment Doctrine',
    description: 'A battle plan built for the pincer — both your wings strike far harder when they wheel to flank.',
    timing: 'pre_battle',
    target: 'own_side',
  },
};

export const STRATAGEM_LIST: StratagemDef[] = Object.values(STRATAGEMS);
