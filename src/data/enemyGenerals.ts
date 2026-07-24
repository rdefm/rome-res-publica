// ─── Enemy Generals (P1-M7 content) ─────────────────────────────────────────
// The 4 v1 Carthaginian general profiles — rome-military-implementation-plan.md
// §Chunk M7. Pure content: personality knobs battleAi.ts reads to make
// decisions and flavour text the pre-battle scene can show. No logic here.

import type { FormationId, UnitClass } from '../models/battle';
import type { StratagemId } from './stratagems';
import type { RegionId } from '../models/theatre';

export interface GeneralProfile {
  id: string;
  name: string;
  epithet: string;
  /** Commander martial (0–10) — drives captain/commander stat bonus and
   *  this general's own stratagem hand size, same formula as the player. */
  martial: number;
  /** M9 — relative weight per unit class this general's armies favour.
   *  warEngine.ts's set-piece scheduler allocates a generated enemy army's
   *  cohort count proportionally to these weights (never 'legionary' —
   *  that's Rome's class; Carthage fields spear_foot/skirmisher/cavalry/
   *  elephant, matching gameStore.ts's existing sandbox defender army). */
  armyComposition: Partial<Record<UnitClass, number>>;
  /** 0–1. Drives wedge/advance frequency and pursue-vs-wheel bias. */
  aggression: number;
  /** Rounds this general waits before committing reserves to a struggling lane. */
  reservePatience: number;
  /** Relative weight per formation when this general has a free choice
   *  (i.e. not reacting to an immediate threat/opportunity) — battleAi
   *  normalizes and samples from these. */
  formationPreferenceWeights: Partial<Record<Exclude<FormationId, 'feigned_retreat'>, number>>;
  /** 0–1. Chance to order a feigned retreat in a feint-gated lane that
   *  isn't otherwise being reinforced/attacked this round. */
  feintPreference: number;
  /** 0–1. On a break decision, the chance this general pursues rather than
   *  wheels (subject to a wheel target actually being available). */
  pursueBias: number;
  signatureStratagemId?: StratagemId;
  flavour: {
    preBattle: string;
    victory: string;
    defeat: string;
  };

  // ── Campaign Map plan, Chunk C6 — one interface, two layers (per the
  // plan's own instruction): the four fields below drive campaignAi.ts's
  // HOLD/ADVANCE/RAID behavior selection; everything above drives tactical
  // battles. NPC-Roman commanders (derived from a ClanLeader, not authored
  // here — see campaignAi.deriveNpcRomanProfile) also produce this full
  // shape, filling the battle-only fields above with inert placeholders
  // since a rival command's army only ever fights via C8's abstract
  // resolver, never the tactical battle screen. ──

  /** 0–1. How willing this general is to accept worse odds — lowers the
   *  effective attackRatioThreshold and raises RAID's selection weight
   *  relative to HOLD. Distinct from (but authored alongside) `aggression`
   *  above, which is a battle-layer concept (wedge/pursue frequency); the
   *  two happen to correlate for the four hand-authored Carthaginian
   *  generals but are computed independently for NPC-Roman commanders. */
  caution: number;
  /** Relative weights the softmax behavior-selector multiplies each
   *  behavior's raw (0 or 1) validity score by — see campaignAi.ts. Needn't
   *  sum to 1. */
  objectiveWeights: { hold: number; advance: number; raid: number };
  /** Where a RAID order returns home to next season, and (for the
   *  Carthaginian strategic controller) where reinforcements muster. */
  homePort: RegionId;
  /** 0–1. Probability the telegraphed intent icon (invariant 6) LIES about
   *  next season's true order. */
  deceptionChance: number;
}

export const ENEMY_GENERALS: Record<string, GeneralProfile> = {
  hanno_cautious: {
    id: 'hanno_cautious',
    name: 'Hanno',
    epithet: 'the Cautious',
    martial: 5,
    armyComposition: { spear_foot: 4, skirmisher: 2, cavalry_light: 1 },
    aggression: 0.2,
    reservePatience: 4,
    formationPreferenceWeights: { shield_wall: 3, line: 2, open_ranks: 1, wedge: 0.2 },
    feintPreference: 0.15,
    pursueBias: 0.2,
    flavour: {
      preBattle: 'Hanno counsels patience. "Let them break themselves on our shields first."',
      victory: 'Hanno declines to press the pursuit. "A won field is worth more than a scattered one."',
      defeat: 'Hanno orders the retreat before the line fully gives — the army survives to fight again.',
    },
    // Chunk C6 — cautious-hold: heavily favours HOLD, rarely initiates.
    caution: 0.9,
    objectiveWeights: { hold: 3, advance: 0.5, raid: 0.3 },
    homePort: 'africa',
    deceptionChance: 0.1,
  },
  hamilcar_fox: {
    id: 'hamilcar_fox',
    name: 'Hamilcar',
    epithet: 'the Fox',
    martial: 6,
    armyComposition: { cavalry_light: 3, skirmisher: 3, spear_foot: 2, cavalry_heavy: 1 },
    aggression: 0.5,
    reservePatience: 3,
    formationPreferenceWeights: { line: 2, shield_wall: 1.5, open_ranks: 1, wedge: 1 },
    feintPreference: 0.6,
    pursueBias: 0.5,
    signatureStratagemId: 'ambuscade',
    flavour: {
      preBattle: 'Hamilcar has scouted the ground well before you arrived. Something waits in the folds of it.',
      victory: 'Hamilcar smiles thinly. "They marched exactly where I wished them to."',
      defeat: 'Hamilcar slips away with the remnant of his guard — the fox does not die in the trap.',
    },
    // Chunk C6 — raid-heavy: the fox strikes and withdraws, rarely commits
    // to a straight advance. The plan's own named seed for deceptionChance.
    caution: 0.3,
    objectiveWeights: { hold: 0.5, advance: 1, raid: 3 },
    homePort: 'africa',
    deceptionChance: 0.35,
  },
  bomilcar_bull: {
    id: 'bomilcar_bull',
    name: 'Bomilcar',
    epithet: 'the Bull',
    martial: 7,
    armyComposition: { cavalry_heavy: 3, elephant: 2, spear_foot: 2, skirmisher: 1 },
    aggression: 0.9,
    reservePatience: 1,
    formationPreferenceWeights: { wedge: 4, line: 1, shield_wall: 0.3, open_ranks: 0.3 },
    feintPreference: 0.05,
    pursueBias: 1.0,
    signatureStratagemId: 'fire_arrows',
    flavour: {
      preBattle: 'Bomilcar rides the line once, then takes his station at the front. He means to lead the charge himself.',
      victory: 'Bomilcar gives no quarter — the rout is run down to the last man.',
      defeat: 'Bomilcar is dragged from the field still shouting for the charge to re-form.',
    },
    // Chunk C6 — advance-always: the bull always favours ADVANCE.
    caution: 0.1,
    objectiveWeights: { hold: 0.2, advance: 3, raid: 1 },
    homePort: 'africa',
    deceptionChance: 0.1,
  },
  xanthippus_drillmaster: {
    id: 'xanthippus_drillmaster',
    name: 'Xanthippus',
    epithet: 'the Drillmaster',
    martial: 6,
    armyComposition: { spear_foot: 5, skirmisher: 1, cavalry_light: 1 },
    aggression: 0.4,
    reservePatience: 2,
    formationPreferenceWeights: { shield_wall: 3, line: 2, open_ranks: 0.5, wedge: 0.5 },
    feintPreference: 0.1,
    pursueBias: 0.0,
    signatureStratagemId: 'testudo_discipline',
    flavour: {
      preBattle: 'Xanthippus has drilled this army for a season. The lines move like one body.',
      victory: 'Xanthippus wheels his victorious wings onto the next fight in perfect order.',
      defeat: 'Even breaking, Xanthippus’s lines fall back in step — a defeat, not a rout.',
    },
    // Chunk C6 — balanced-disciplined: even weights across all three, and
    // the fallback profile any Carthage army without one of these four as
    // its commander is assigned (see campaignAi.profileForCarthageArmy).
    caution: 0.5,
    objectiveWeights: { hold: 1, advance: 1, raid: 1 },
    homePort: 'africa',
    deceptionChance: 0.1,
  },
};

export const ENEMY_GENERAL_LIST: GeneralProfile[] = Object.values(ENEMY_GENERALS);
