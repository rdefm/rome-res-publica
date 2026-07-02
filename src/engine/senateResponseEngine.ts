// ─── Senate Response Engine ───────────────────────────────────────────────────
// Handles the Senate's escalating reaction to an unsanctioned personal levy.
// Phase sequence: null → debate → censure → hostis → consular_army

import type { GameState } from '../state/gameStore';
import { calcEffectiveForce } from './troopEngine';

// ─── Senate Response State ────────────────────────────────────────────────────
// Exported so Chunk M can add this to the GameState interface and INITIAL_STATE.

export interface SenateResponseState {
  active: boolean;
  seasonDetected: number;              // turnNumber when unsanctioned levy first detected
  phase: 'debate' | 'censure' | 'hostis' | 'consular_army' | null;
  musterProvinceId: string | null;
  consularArmyStrength: number;
  debateSuppressed: boolean;
  consularArmyArrivesOnTurn: number;   // accounts for distance delay
}

// Augmented type used within this engine.
// Once Chunk M adds senateResponse to GameState, this resolves to the real type.
export type SenateAwareState = GameState & {
  senateResponse: SenateResponseState | null;
};
type SenateAwarePatch = Partial<SenateAwareState>;

// ─── Distance Tier ────────────────────────────────────────────────────────────

type DistanceTier = 'near' | 'far' | 'very_far' | 'distant';

const DISTANCE_LOOKUP: Record<string, DistanceTier> = {
  samnium:            'near',
  etruria:            'near',
  campania:           'near',
  latium:             'near',
  cisalpine_gaul:     'far',
  sicilia:            'far',
  sardinia:           'far',
  hispania_citerior:  'very_far',
  hispania_ulterior:  'very_far',
  africa:             'very_far',
  asia_minor:         'distant',
  macedonia:          'distant',
};

/**
 * Returns the distance tier for a muster province, used to calculate how many
 * seasons it takes for a consular army to arrive.
 * Unrecognised province IDs default to 'near' (safe fallback).
 */
export function getMusterProvinceDistanceTier(provinceId: string): DistanceTier {
  return DISTANCE_LOOKUP[provinceId] ?? 'near';
}

// ─── Army Strength & Arrival ──────────────────────────────────────────────────

/**
 * Calculates the strength of the consular army sent to suppress the player.
 * Scales with crisis level and how threatening the player's forces already are.
 */
export function calcConsularArmyStrength(
  crisisLevel: number,
  playerMilitaryImperium: number,
): number {
  return Math.round(40 + (crisisLevel * 0.5) + (playerMilitaryImperium * 2));
}

/**
 * Calculates the turn on which the consular army arrives at the muster province.
 * Base delay is 4 seasons, plus 0–3 additional seasons based on distance.
 */
export function calcConsularArmyArrivalTurn(
  detectedOnTurn: number,
  musterProvinceId: string,
): number {
  const distanceTier = getMusterProvinceDistanceTier(musterProvinceId);
  const distanceDelay: Record<DistanceTier, number> = {
    near:     0,
    far:      1,
    very_far: 2,
    distant:  3,
  };
  return detectedOnTurn + 4 + distanceDelay[distanceTier];
}

// ─── Phase Thresholds ─────────────────────────────────────────────────────────

/**
 * Returns the turn number at which each phase transition fires.
 * If the debate was suppressed, all post-debate phases are delayed by 2 seasons,
 * since censure must resolve before hostis can follow.
 */
function phaseThresholds(response: SenateResponseState): {
  debateTurn: number;
  censureTurn: number;
  hostisTurn: number;
} {
  const base = response.seasonDetected;
  const delay = response.debateSuppressed ? 2 : 0;
  return {
    debateTurn:  base + 1,
    censureTurn: base + 2 + delay,
    hostisTurn:  base + 3 + delay,
  };
}

// ─── Senate Response Tick ─────────────────────────────────────────────────────

/**
 * Called once per season end by the turn sequencer (added in Chunk M).
 * Reads the current Senate response state and turn number, advances the phase
 * if a threshold is reached, and returns a state patch to apply.
 *
 * Each phase guard checks BOTH the turn number AND the current phase, so this
 * function is safe to call multiple times without double-firing.
 */
export function tickSenateResponse(
  state: SenateAwareState,
  characterId: string,
): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active) return {};

  const { turnNumber } = state;
  const { debateTurn, censureTurn, hostisTurn } = phaseThresholds(response);

  // ── null → debate ─────────────────────────────────────────────────────────
  if (turnNumber === debateTurn && response.phase === null) {
    const patch: SenateAwarePatch = {
      senateResponse: { ...response, phase: 'debate' },
    };

    if (!response.debateSuppressed) {
      // Inject the Senatus Consultum de Censura as a pending bill.
      // If passed, this bill zeroes Fides income until the levy is disbanded.
      // TODO (Chunk M): adjust the object shape to match the full Bill model.
      const censuraBill = {
        id:              `senate-censura-${turnNumber}`,
        title:           'Senatus Consultum de Censura',
        description:     'The Senate moves to censure the Brutii for raising an unsanctioned personal levy. If passed, Fides income is suspended until all illegal troops are disbanded.',
        type:            'censure',
        forVotes:        0,
        againstVotes:    0,
        playerCanVote:   true,
        passThreshold:   50,
        effectOnPass:    'fides_income_blocked',
      } as any;  // TODO: cast to Bill once model is confirmed
      patch.bills = [...state.bills, censuraBill];
    }

    return patch;
  }

  // ── debate → censure ──────────────────────────────────────────────────────
  if (turnNumber === censureTurn && response.phase === 'debate') {
    // Penalise local support in the muster province and add corruption.
    const updatedProvinces = response.musterProvinceId
      ? state.provinces.map(p =>
          p.id === response.musterProvinceId
            ? { ...p, localSupport: Math.max(0, p.localSupport - 10) }
            : p
        )
      : state.provinces;

    const updatedFamily = state.family.map(c =>
      c.id === characterId
        ? { ...c, corruptionScore: Math.min(100, c.corruptionScore + 5) }
        : c
    );

    return {
      senateResponse: { ...response, phase: 'censure' },
      provinces:      updatedProvinces,
      family:         updatedFamily,
    };
  }

  // ── censure → hostis ──────────────────────────────────────────────────────
  if (turnNumber === hostisTurn && response.phase === 'censure') {
    // Hostis declaration: flag that zeroes allied-clan Fides income is now active
    // (resourceEngine should check senateResponse.phase === 'hostis' when computing income).
    // Also queues a treason trial.
    // TODO (Chunk M): construct a proper Trial object once the Trial model is confirmed.
    const treasonTrial = {
      id:          `trial-treason-${turnNumber}`,
      type:        'treason',
      severity:    'capital',
      characterId,
      turnQueued:  turnNumber,
      autoResolve: false,
    } as any;  // TODO: cast to Trial once model is confirmed

    return {
      senateResponse: { ...response, phase: 'hostis' },
      trialQueue:     [...state.trialQueue, treasonTrial],
    };
  }

  // ── hostis / consular_army → combat ──────────────────────────────────────
  // Combat runs each season once the army has arrived, until resolved.
  if (
    turnNumber >= response.consularArmyArrivesOnTurn &&
    (response.phase === 'hostis' || response.phase === 'consular_army')
  ) {
    const character = state.family.find(c => c.id === characterId);
    const allTroops = character
      ? [...character.raisedLegions, ...character.veterans]
      : [];

    const musterProvince = response.musterProvinceId
      ? state.provinces.find(p => p.id === response.musterProvinceId)
      : null;

    const localSupport    = musterProvince?.localSupport ?? 0;
    const commanderMartial = character?.skills.martial ?? 0;
    const effectiveForce  = calcEffectiveForce(allTroops, commanderMartial, localSupport);

    const playerWins = effectiveForce >= response.consularArmyStrength;

    if (playerWins) {
      // Player defeats the consular army — crisis ends but Dignitas cost is paid.
      return {
        senateResponse:   null,
        lifetimeDignitas: Math.max(0, state.lifetimeDignitas - 5),
      };
    } else {
      // Player is overwhelmed — character captured, worst-outcome trial queued.
      // TODO (Chunk M): construct a proper Trial object once the Trial model is confirmed.
      const captureTrial = {
        id:            `trial-capture-${turnNumber}`,
        type:          'treason',
        severity:      'capital',
        characterId,
        turnQueued:    turnNumber,
        forcedOutcome: 'worst',
        autoResolve:   false,
      } as any;  // TODO: cast to Trial once model is confirmed

      return {
        senateResponse: { ...response, phase: 'consular_army' },
        trialQueue:     [...state.trialQueue, captureTrial],
      };
    }
  }

  return {};
}

// ─── Player Counter-Actions ───────────────────────────────────────────────────

/**
 * Spend 15 Fides to bribe sympathetic tribunes into suppressing the Senate debate.
 * Delays all post-debate phase transitions by 2 seasons.
 * Guard: Senate response must be active and currently in Phase 'debate'.
 */
export function suppressDebate(state: SenateAwareState): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active || response.phase !== 'debate') return {};
  if (state.fides < 15) return {};

  return {
    fides:          state.fides - 15,
    senateResponse: { ...response, debateSuppressed: true },
  };
}

/**
 * Spend 50 Denarii to bribe the Quaestor's Commission into dropping its inquiry.
 * Resets the Senate response entirely — the levy must be re-detected before
 * phase escalation can resume.
 * Guard: Senate response must be active and currently in Phase 'censure'.
 */
export function bribeCommission(state: SenateAwareState): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active || response.phase !== 'censure') return {};
  if (state.denarii < 50) return {};

  return {
    denarii:        state.denarii - 50,
    senateResponse: { ...response, active: false, phase: null },
  };
}

/**
 * Disband all personal legions and submit to the Senate, ending the crisis.
 * Veterans are retained — only raised legions are disbanded.
 * Costs lifetimeDignitas −15. If in Phase 'hostis', cancels the queued treason trial.
 * Guard: Senate response must be active.
 */
export function capitulate(
  state: SenateAwareState,
  characterId: string,
): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active) return {};

  const updatedFamily = state.family.map(c =>
    c.id === characterId
      ? { ...c, raisedLegions: [] }   // veterans intentionally preserved
      : c
  );

  // Cancel queued treason trials for this character if in the hostis phase.
  const updatedTrialQueue = response.phase === 'hostis'
    ? state.trialQueue.filter((t: any) => !(t.type === 'treason' && t.characterId === characterId))
    : state.trialQueue;

  return {
    senateResponse:   null,
    lifetimeDignitas: Math.max(0, state.lifetimeDignitas - 15),
    family:           updatedFamily,
    trialQueue:       updatedTrialQueue,
  };
}
