// ─── Enemy Generals (P1-M7 content) ─────────────────────────────────────────
// The 4 v1 Carthaginian general profiles — rome-military-implementation-plan.md
// §Chunk M7. Pure content: personality knobs battleAi.ts reads to make
// decisions and flavour text the pre-battle scene can show. No logic here.

import type { FormationId } from '../models/battle';
import type { StratagemId } from './stratagems';

export interface GeneralProfile {
  id: string;
  name: string;
  epithet: string;
  /** Commander martial (0–10) — drives captain/commander stat bonus and
   *  this general's own stratagem hand size, same formula as the player. */
  martial: number;
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
}

export const ENEMY_GENERALS: Record<string, GeneralProfile> = {
  hanno_cautious: {
    id: 'hanno_cautious',
    name: 'Hanno',
    epithet: 'the Cautious',
    martial: 5,
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
  },
  hamilcar_fox: {
    id: 'hamilcar_fox',
    name: 'Hamilcar',
    epithet: 'the Fox',
    martial: 6,
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
  },
  bomilcar_bull: {
    id: 'bomilcar_bull',
    name: 'Bomilcar',
    epithet: 'the Bull',
    martial: 7,
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
  },
  xanthippus_drillmaster: {
    id: 'xanthippus_drillmaster',
    name: 'Xanthippus',
    epithet: 'the Drillmaster',
    martial: 6,
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
  },
};

export const ENEMY_GENERAL_LIST: GeneralProfile[] = Object.values(ENEMY_GENERALS);
