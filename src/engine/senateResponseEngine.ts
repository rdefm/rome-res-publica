// ─── Senate Response Engine ───────────────────────────────────────────────────
// Handles the Senate's escalating reaction to an unsanctioned personal levy.
// Phase sequence: null → debate → censure → hostis → consular_army

import type { GameState } from '../state/gameStore';
import { calcEffectiveForce, getLocalSupportModifier } from './troopEngine';
import { buildTrialState } from './trialEngine';
import { armyStrength } from './armyEngine';

// ─── Senate Response State ────────────────────────────────────────────────────

export interface SenateResponseState {
  active: boolean;
  seasonDetected: number;              // turnNumber when unsanctioned levy first detected
  phase: 'debate' | 'censure' | 'hostis' | 'consular_army' | null;
  musterProvinceId: string | null;
  consularArmyStrength: number;
  debateSuppressed: boolean;
  consularArmyArrivesOnTurn: number;   // accounts for distance delay
  /** Campaign Map plan, Chunk C3 — set when this response was triggered by
   *  an unsanctioned Army muster (musterEngine.ts) rather than the older
   *  personal-levy path (gameStore.raiseLevy). Undefined/null = personal-
   *  levy path, unchanged from before this field existed. Drives the
   *  combat-resolution and capitulate branches below onto the Army
   *  (state.armies) instead of the triggering character's
   *  raisedLegions/veterans. */
  sourceArmyId?: string | null;
}

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

export function getMusterProvinceDistanceTier(provinceId: string): DistanceTier {
  return DISTANCE_LOOKUP[provinceId] ?? 'near';
}

// ─── Army Strength & Arrival ──────────────────────────────────────────────────

export function calcConsularArmyStrength(
  crisisLevel: number,
  playerMilitaryImperium: number,
): number {
  return Math.round(40 + (crisisLevel * 0.5) + (playerMilitaryImperium * 2));
}

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

export function tickSenateResponse(
  state: SenateAwareState,
  characterId: string,
): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active) return {};

  // ── Consul authority cap (Chunk 1C) ───────────────────────────────────────
  // When the player holds consular authority (invoke-consular-authority action),
  // the Senate response cannot advance beyond the 'censure' phase for the duration.
  // Decrement the remaining counter each season; clear when it reaches 0.
  if (state.consulAuthorityActive) {
    const cappedPhase: SenateResponseState['phase'] =
      response.phase === 'hostis' || response.phase === 'consular_army'
        ? 'censure'
        : response.phase;
    const newRemaining = state.consulAuthoritySeasonsRemaining - 1;
    return {
      senateResponse: { ...response, phase: cappedPhase },
      consulAuthorityActive: newRemaining > 0,
      consulAuthoritySeasonsRemaining: Math.max(0, newRemaining),
    };
  }

  const { turnNumber } = state;
  const { debateTurn, censureTurn, hostisTurn } = phaseThresholds(response);

  // ── null → debate ─────────────────────────────────────────────────────────
  if (turnNumber === debateTurn && response.phase === null) {
    const patch: SenateAwarePatch = {
      senateResponse: { ...response, phase: 'debate' },
    };

    if (!response.debateSuppressed) {
      const censuraBill = {
        id:              `senate-censura-${turnNumber}`,
        title:           'Senatus Consultum de Censura',
        // Phase 5, Chunk P5-E — was hardcoded 'the Brutii', found during the
        // gens-neutrality sweep.
        description:     `The Senate moves to censure the ${state.gensPlural} for raising an unsanctioned personal levy. If passed, Fides income is suspended until all illegal troops are disbanded.`,
        type:            'censure',
        forVotes:        0,
        againstVotes:    0,
        playerCanVote:   true,
        passThreshold:   50,
        effectOnPass:    'fides_income_blocked',
      } as any;
      patch.bills = [...state.bills, censuraBill];
    }

    return patch;
  }

  // ── debate → censure ──────────────────────────────────────────────────────
  if (turnNumber === censureTurn && response.phase === 'debate') {
    const updatedProvinces = response.musterProvinceId
      ? state.cities.map(p =>
          p.id === response.musterProvinceId
            ? { ...p, localSupport: Math.max(0, p.localSupport - 10) }
            : p
        )
      : state.cities;

    const updatedFamily = state.family.map(c =>
      c.id === characterId
        ? { ...c, corruptionScore: Math.min(100, c.corruptionScore + 5) }
        : c
    );

    return {
      senateResponse: { ...response, phase: 'censure' },
      cities:         updatedProvinces,
      family:         updatedFamily,
    };
  }

  // ── censure → hostis ──────────────────────────────────────────────────────
  // Phase 4, Chunk P4-C — was pushing an ad-hoc object (type/severity/
  // characterId/turnQueued/autoResolve — none of which match Trial's real
  // fields) into trialQueue under an `as any` cast. Harmless pre-P4-C only
  // because nothing ever read that malformed shape correctly (resolveTrial's
  // math degraded to NaN and always fell through to 'executed', but
  // accusedCharacterId being undefined meant OUTCOME_CONSEQUENCES's
  // removeCharacter branch matched no one — a silent no-op, not a crash).
  // Renaming trialQueue -> trials turned this into a real type error; fixed
  // in place to build a genuine TrialState, preserving the original intent
  // (defying censure escalates to a treason trial) — the Senate collectively
  // prosecutes, so the most-influential clan's senior leader stands in as
  // nominal prosecutor. Near-guaranteed-loss npcStrength matches the old
  // (never-functioning) object's forcedOutcome: 'worst' intent — Hostis
  // declaration means the Senate has already all but condemned you.
  if (turnNumber === hostisTurn && response.phase === 'censure') {
    const mostInfluentialClan = [...state.clans].sort((a, b) => b.influence - a.influence)[0];
    const treasonTrial = buildTrialState({
      id: `trial-treason-${turnNumber}`,
      seat: 'defense',
      charge: 'maiestas',
      chargeSource: 'accusation',
      prosecutor: { kind: 'leader', leaderId: mostInfluentialClan?.leaders[0]?.id ?? '' },
      defendant: { kind: 'family', characterId },
      filedSeason: turnNumber,
      startsSeason: turnNumber + 1,
      initialNpcStrength: 200,
      speakerId: characterId,
    });

    return {
      senateResponse: { ...response, phase: 'hostis' },
      trials: [...(state.trials ?? []), treasonTrial],
    };
  }

  // ── hostis / consular_army → combat ──────────────────────────────────────
  if (
    turnNumber >= response.consularArmyArrivesOnTurn &&
    (response.phase === 'hostis' || response.phase === 'consular_army')
  ) {
    const musterProvince = response.musterProvinceId
      ? state.cities.find(p => p.id === response.musterProvinceId)
      : null;
    const localSupport = musterProvince?.localSupport ?? 0;

    // Chunk C3 — Army-sourced response: measure state.armies instead of the
    // character's personal TroopUnit arrays. Mirrors calcEffectiveForce's
    // own shape (raw strength × commander-martial bonus × local support)
    // rather than inventing a divergent formula, so both paths are judged
    // against the same consularArmyStrength threshold on equal footing.
    if (response.sourceArmyId) {
      const army = state.armies.find(a => a.id === response.sourceArmyId);
      // The offending Army may have been combined/divided/disbanded away
      // since detection — there is nothing left to move the consular army
      // against, so the Senate's case quietly evaporates rather than
      // punishing a force that no longer exists.
      if (!army) {
        return { senateResponse: null };
      }
      const commander = army.commanderId ? state.family.find(c => c.id === army.commanderId) : null;
      const effectiveForce = Math.round(
        armyStrength(army) * (1 + (commander?.skills.martial ?? 0) / 10) * getLocalSupportModifier(localSupport),
      );

      if (effectiveForce >= response.consularArmyStrength) {
        return {
          senateResponse:   null,
          lifetimeDignitas: Math.max(0, state.lifetimeDignitas - 5),
        };
      }
      // Falls through to the shared "loses" branch below.
    } else {
      const character = state.family.find(c => c.id === characterId);
      const allTroops = character
        ? [...character.raisedLegions, ...character.veterans]
        : [];
      const commanderMartial = character?.skills.martial ?? 0;
      const effectiveForce = calcEffectiveForce(allTroops, commanderMartial, localSupport);

      if (effectiveForce >= response.consularArmyStrength) {
        return {
          senateResponse:   null,
          lifetimeDignitas: Math.max(0, state.lifetimeDignitas - 5),
        };
      }
      // Falls through to the shared "loses" branch below.
    }

    {
      // Same P4-C fix as the treason-trial branch above — captured after
      // losing to the consular army is even more clearly a guaranteed loss.
      const mostInfluentialClan = [...state.clans].sort((a, b) => b.influence - a.influence)[0];
      const captureTrial = buildTrialState({
        id: `trial-capture-${turnNumber}`,
        seat: 'defense',
        charge: 'maiestas',
        chargeSource: 'accusation',
        prosecutor: { kind: 'leader', leaderId: mostInfluentialClan?.leaders[0]?.id ?? '' },
        defendant: { kind: 'family', characterId },
        filedSeason: turnNumber,
        startsSeason: turnNumber + 1,
        initialNpcStrength: 300,
        speakerId: characterId,
      });

      return {
        senateResponse: { ...response, phase: 'consular_army' },
        trials: [...(state.trials ?? []), captureTrial],
      };
    }
  }

  return {};
}

// ─── Player Counter-Actions ───────────────────────────────────────────────────

export function suppressDebate(state: SenateAwareState): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active || response.phase !== 'debate') return {};
  if (state.fides < 15) return {};

  return {
    fides:          state.fides - 15,
    senateResponse: { ...response, debateSuppressed: true },
  };
}

export function bribeCommission(state: SenateAwareState): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active || response.phase !== 'censure') return {};
  if (state.denarii < 50) return {};

  return {
    denarii:        state.denarii - 50,
    senateResponse: { ...response, active: false, phase: null },
  };
}

export function capitulate(
  state: SenateAwareState,
  characterId: string,
): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active) return {};

  // Chunk C3 — Army-sourced response: stand the Army down (remove it from
  // play) instead of clearing a character's raisedLegions, which an
  // Army-triggered response never touched in the first place.
  const updatedFamily = response.sourceArmyId
    ? state.family
    : state.family.map(c =>
        c.id === characterId
          ? { ...c, raisedLegions: [] }
          : c
      );
  const updatedArmies = response.sourceArmyId
    ? state.armies.filter(a => a.id !== response.sourceArmyId)
    : state.armies;

  const updatedTrials = response.phase === 'hostis'
    ? (state.trials ?? []).filter(t =>
        !(t.charge === 'maiestas' && t.defendant.kind === 'family' && t.defendant.characterId === characterId)
      )
    : (state.trials ?? []);

  return {
    senateResponse:   null,
    lifetimeDignitas: Math.max(0, state.lifetimeDignitas - 15),
    family:           updatedFamily,
    armies:           updatedArmies,
    trials:           updatedTrials,
  };
}
