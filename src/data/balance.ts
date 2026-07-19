// ─── Balance Registry (P2-A) ────────────────────────────────────────────────
// Single authoritative home for every tunable game-balance number. Chunk P2-A
// (rome-phase2-implementation-plan.md) seeds this by extracting existing
// scattered constants without changing their values. Later chunks fill in
// their placeholder groups: training (P2-C), relationships (P2-D),
// munificence (P2-F), actionEconomy (P2-E), battle/war (Military Overhaul
// Chunk M1 — rome-military-implementation-plan.md).
//
// Discipline: after this chunk, any new numeric literal for a tunable
// belongs here, not inline in engine/store code. A magic number added to
// engine/state code after P2-A is a defect.
//
// Indirection policy (documented per the plan's "pick one, document it"
// instruction, since duplicating numbers here would create drift risk):
//   - `patron`     — numbers stay in models/patronLadder.ts
//                     (PATRON_TIER_DEFINITIONS is the tier ladder's single
//                     source of truth). Nothing to re-export; see that file.
//   - `elections`  — numbers stay in engine/electionEngine.ts as exported
//                     consts (already imported directly by ForumScreen.tsx
//                     and gameStore.ts). Re-exported below under
//                     BALANCE.elections for discoverability only.
// Every other group's numbers live here directly and are imported by the
// engine/store code that uses them.

import {
  PLAYER_BASE_SCORE,
  CANVASS_FIDES_COST,
  CANVASS_MIN_RELATIONSHIP,
  CANVASS_EVENT_CHANCE,
  OFFICE_PRESTIGE,
  RIVAL_STRENGTH_BY_OFFICE_RANK,
  CANVASS_FIDES_COST_BY_OFFICE_RANK,
} from '../engine/electionEngine';
import type { UnitClass, Veterancy, FormationId, TerrainMod } from '../models/battle';

export const BALANCE = {
  // ─── Fides income formula (resourceEngine.calcResourceIncome) ─────────────
  income: {
    /** paterfamilias.rhetoric × this = base Fides income (step 1). */
    paterfamiliasRhetoricMultiplier: 2,
    /** Office ID → flat Fides/season bonus while a family member holds it. */
    officeFidesBonus: {
      quaestor: 3,
      aedile: 5,
      praetor: 7,
      consul: 12,
    } as Record<string, number>,
    /** P2-C: bestOtherRhetoric × this = the "household voices" income term
     *  (highest rhetoric among living, non-paterfamilias family members). */
    bestOtherRhetoricMultiplier: 1,
    /** P2-C: family members below this age contribute nothing to bestOtherRhetoric. */
    bestOtherRhetoricMinAge: 12,
  },

  // ─── Patron Tier ────────────────────────────────────────────────────────
  // See indirection policy above — numbers live in models/patronLadder.ts.
  patron: {},

  // ─── Forum diplomacy actions (gameStore.ts) ────────────────────────────────
  diplomacy: {
    buyInfluenceFidesCost: 10,
    buyInfluenceRelationshipGain: 5,
    inviteToDinnerDenariiCost: 20,
    inviteToDinnerRelationshipGain: 8,
    forgeAllianceFidesCost: 20,
    forgeAllianceRelationshipGain: 12,
    arrangeMarriageFidesCost: 20,
    arrangeMarriageRelationshipGain: 20,
    // gatherIntelligenceFidesCost removed, Phase 4 P4-A — superseded by
    // BALANCE.secrets.gatherCostFides (same seed value, 8); gatherIntelligence
    // is now rewired onto secretEngine.attemptGather.
    canvassForVotesFidesCost: 12,
  },

  // ─── Senate bill actions (gameStore.ts) ────────────────────────────────────
  // These are the *default* costs used when a bill template doesn't override
  // them (Bill.voteGravitasCost / speechGravitasCost). Per-bill overrides are
  // content and stay in billTemplates.ts.
  senate: {
    voteFidesCostDefault: 4,
    speechFidesCostDefault: 6,
    filibusterFidesCost: 8,
    submitBillFidesCost: 10,
  },

  // ─── Elections ──────────────────────────────────────────────────────────
  // See indirection policy above — numbers live in engine/electionEngine.ts.
  elections: {
    playerBaseScore: PLAYER_BASE_SCORE,
    canvassFidesCost: CANVASS_FIDES_COST,
    canvassMinRelationship: CANVASS_MIN_RELATIONSHIP,
    canvassEventChance: CANVASS_EVENT_CHANCE,
    officePrestige: OFFICE_PRESTIGE,
    // P2-E summit-curve levers — FIRST-PASS/UNVERIFIED, see electionEngine.ts's
    // constant comments and the plan's "## Tuning log" appendix.
    rivalStrengthByOfficeRank: RIVAL_STRENGTH_BY_OFFICE_RANK,
    canvassFidesCostByOfficeRank: CANVASS_FIDES_COST_BY_OFFICE_RANK,
    /** Tribune of the Plebs uses a separate resolution formula (Concilium
     *  Plebis vote, not resolveElection) — gameStore.endSeason. Belated P2-A
     *  extraction; values unchanged from the pre-P2-E inline literals. By
     *  inspection this already lands close to the plan's Tribune/Aedile band
     *  (~50-60%) at "solid prep" (decent plebs mood + positive Populares
     *  relationship) — left alone rather than guessed at further. */
    tribuneElection: {
      baseChance: 0.40,
      plebsWeight: 0.40,
      popularesRelDivisor: 200,
      ceiling: 0.90,
    },
  },

  // ─── P2-C — training ────────────────────────────────────────────────────────
  // Was fully deterministic (P2-C's own header once said so) until the Family
  // House rework added a real success roll — see `house.studyRollBaseChance`
  // et al. below. Fides is still spent on any attempt, success or not (the
  // existing "cost of trying" framing) — only whether the +1 actually lands
  // is now uncertain.
  training: {
    /** Cost of training a skill TO targetLevel = this × targetLevel Fides.
     *  E.g. 6→7 costs fidesCostPerTargetLevel × 7. Same for all three skills. */
    fidesCostPerTargetLevel: 3,
    /** Skills cannot be trained above this level. */
    skillCap: 10,
  },

  // ─── Family House rework ────────────────────────────────────────────────────
  // FIRST-PASS/UNVERIFIED, same treatment as every other constant group here.
  clients: {
    /** Cap on player-initiated client acquisition (gameStore.addClient and the
     *  canvassing/patronage recruit flows) — houseEngine.getClientSlotCap adds
     *  the Entry Hall room's bonus on top. Generous by design so this isn't a
     *  nerf for existing playstyles; event-granted clients (_addClient patches)
     *  are exempt, matching this codebase's existing narrative-effects-always-
     *  land convention. */
    baseSlots: 8,
  },
  // Room/location/business BONUS VALUES live in their content files
  // (data/houseRooms.ts, houseLocations.ts, houseBusinesses.ts) directly —
  // same convention as AssetDefinition.tiers[].passiveBonus not being
  // duplicated here. Only the Study's roll FORMULA (not content) lives here.
  house: {
    /** houseEngine.rollTraining's success chance =
     *  studyRollBaseChance − currentSkillLevel × studyRollDifficultyPerPoint
     *  (+ the built Study room's RoomBonus.trainingRollBonus, if any),
     *  clamped to [studyRollFloor, studyRollCeiling]. Harder to improve an
     *  already-high skill, exactly as requested — a skill-10 character sits
     *  at 30% base, 50% with a Study (houseRooms.ts's trainingRollBonus: 0.20). */
    studyRollBaseChance: 0.90,
    studyRollDifficultyPerPoint: 0.06,
    studyRollFloor: 0.05,
    studyRollCeiling: 0.95,
  },

  // ─── P2-D — Relationship anchors & leader mortality ────────────────────────
  relationships: {
    // Anchor precedence (see reputationEngine.deriveRelationshipAnchor):
    // marriage > alliance > hostile (relationship < 25, no bond) > default.
    anchorMarriage: 55,
    anchorAlliance: 40,
    anchorDefault: 25,
    anchorHostile: 15,
    /** Points moved toward the anchor per year (Winter→Spring rollover only — not per season). */
    decayPerYear: 3,
    /** Death chance by age band, rolled once per leader per year. Hard-capped at one death/year game-wide. */
    mortality: {
      under50: 0,
      band50to59: 0.03,
      band60to69: 0.08,
      band70to79: 0.18,
      band80plus: 0.35,
    },
    successorAgeMin: 32,
    successorAgeMax: 45,
    /** Chance the successor inherits the predecessor's LeaderBias; otherwise random. */
    successorBiasInheritChance: 0.6,
    successorVotesRetention: 0.7,
    successorRelationshipRetention: 0.4,
  },

  // ─── P2-F — Munificence acts ────────────────────────────────────────────────
  munificence: {
    publicFeast: { denarii: 40, plebs: 3, fides: 2, cooldownSeasons: 2 },
    grainLargesse: { denarii: 80, plebs: 5, unrestDelta: -3, cooldownSeasons: 2 },
    fundTheLudi: { denarii: 120, fides: 10, plebs: 6, unrestDelta: -4, lifetimeDignitas: 4, minPatronTier: 2 },
    grandGames: {
      denarii: 300, plebs: 10, unrestDelta: -8, lifetimeDignitas: 8,
      electionVoteBonus: 8, minPatronTier: 3,
      // The vote bonus doesn't consume on first use — it's a standing bonus to every
      // election while active, fading as the spectacle is forgotten. Recasting Grand
      // Games refreshes it to electionVoteBonus and resets the decay clock.
      electionVoteBonusDecayPerInterval: 1,
      electionVoteBonusDecayIntervalYears: 2,
    },
    restoreTemple: { denarii: 150, lifetimeDignitas: 6, stability: 3, constitutionDelta: -2, minPatronTier: 2 },
    publicEndowment: {
      denarii: 400, endowmentFidesPerSeason: 1, lifetimeDignitas: 10, plebs: 4,
      minPatronTier: 4, maxPerGame: 2,
    },
    /** Denarii cost multiplier and effect multiplier while the player holds Aedile
     *  (applies to Fund the Ludi / Grand Games only — the "games" slot acts). */
    aedileCostMultiplier: 0.5,
    aedileEffectMultiplier: 1.5,
  },

  // ─── P2-E — Action economy tuning ───────────────────────────────────────────
  // FIRST-PASS / UNVERIFIED: these are the plan's stated target values, not the
  // output of a playtest or simulation pass (see rome-phase2-implementation-plan.md
  // §P2-E and its "## Tuning log" appendix). Stage is derived from Patron Tier
  // alone — the plan's bands (0-1 / 2-3 / 4-5) partition the six tiers cleanly,
  // so no separate year/governorship signal is needed (engine/actionEconomyEngine.ts).
  //
  // Design stance: late-game Denarii/Fides abundance is INTENDED — growth must
  // stay felt, not get taxed away. Pace is controlled by making the *marginal*
  // small action unnecessary (everything routine is handled) while Munificence's
  // grand acts absorb ambition. There is NO action-cost scaling by tier — this
  // was considered and cut for cheapening earned growth (see P2-F's cut-mechanic
  // note). If a stage's Pace panel average exceeds its action band or 8 minutes,
  // the tuning levers are, in order: (1) Munificence cooldowns/slots, (2) small-
  // action cooldowns where the fiction supports them, (3) income constants,
  // (4) tier income multipliers. Structural changes require stopping and writing
  // up the finding rather than reaching for a new mechanic.
  actionEconomy: {
    /** Meaningful-actions-per-season band, keyed by stage. Outside this band on
     *  the Pace panel's last-10 average is the tuning trigger. */
    actionBand: {
      early: [3, 4] as [number, number],
      mid:   [4, 6] as [number, number],
      late:  [5, 8] as [number, number],
    },
    /** Fides income/season target band, for reference alongside the Pace panel — not itself flagged. */
    fidesIncomeBand: {
      early: [15, 25] as [number, number],
      mid:   [28, 45] as [number, number],
      late:  [50, 75] as [number, number],
    },
    /** A season running longer than this (wall-clock) is flagged on the Pace panel. */
    maxSeasonDurationSec: 8 * 60,
  },

  // ─── M1 — Battle system (src/engine/battle/*) ──────────────────────────────
  // Set-piece battle math. See rome-military-implementation-plan.md §Chunk M1
  // for the source tables and rationale for every number below. Zero of this
  // is read by any engine yet — M1 is types + numbers only, no wiring.
  battle: {
    /** Base stats per unit class. shock only matters on a unit's charging
     *  round (see `shock` decay below); moraleWeight feeds the wing morale
     *  pool seed. */
    unitStats: {
      legionary:     { atk: 6, def: 6, shock: 3,  moraleWeight: 7, notes: 'The line that grinds' },
      spear_foot:    { atk: 4, def: 7, shock: 2,  moraleWeight: 7, notes: 'The wall' },
      skirmisher:    { atk: 3, def: 2, shock: 1,  moraleWeight: 4, notes: 'The screen' },
      cavalry_heavy: { atk: 5, def: 4, shock: 8,  moraleWeight: 6, notes: 'The hammer' },
      cavalry_light: { atk: 4, def: 3, shock: 4,  moraleWeight: 5, notes: 'The net' },
      elephant:      { atk: 7, def: 6, shock: 10, moraleWeight: 8, notes: 'The gamble' },
    } as Record<UnitClass, { atk: number; def: number; shock: number; moraleWeight: number; notes: string }>,

    /** Class-vs-class modifiers, data-driven per invariant 3 (a naval reskin
     *  adds rows, not switch branches). `subjectClass` is the unit receiving
     *  the modifier; `vsClass` is the opposing class present in the lane that
     *  triggers it. Applied by clashEngine (M2) alongside the base stat +
     *  formation + veterancy + captain + terrain pipeline. */
    matchups: [
      { subjectClass: 'legionary', vsClass: 'spear_foot', atkDelta: 2,
        note: 'legionary atk +2 (swords beat spears in the grind)' },
      { subjectClass: 'spear_foot', vsClass: 'cavalry_heavy', defDelta: 2, incomingShockMult: 0.25,
        note: 'spear def +2; incoming shock from cavalry_heavy ×0.25' },
      { subjectClass: 'spear_foot', vsClass: 'elephant', defDelta: 2, incomingShockMult: 0.25,
        note: 'spear def +2; incoming shock from elephant ×0.25' },
      { subjectClass: 'cavalry_heavy', vsClass: 'spear_foot', atkDelta: -2,
        note: 'cavalry atk −2 vs spear wall (stacks with the shock negation above)' },
      /** M11 tuning pass: without this, a braced spear wall neutralizes an
       *  elephant's SHOCK (via the incomingShockMult rule above) but not its
       *  base melee atk — elephants kept winning ≥60% of harness trials
       *  against the plan's own "prepared counter" (skirmisher+spear+
       *  open_ranks) composition, the opposite of the target. Mirrors the
       *  cavalry_heavy rule immediately above (braced spears blunt a charge
       *  regardless of what's doing the charging), one point sharper since
       *  elephants are the explicitly-designed "gamble" unit. */
      { subjectClass: 'elephant', vsClass: 'spear_foot', atkDelta: -1,
        note: 'elephant atk −1 vs spear wall (braced spears blunt the charge; stacks with the shock negation above)' },
      { subjectClass: 'cavalry_light', vsClass: 'cavalry_heavy', incomingShockMult: 0.5, firstClashOnly: true,
        note: 'first-clash incoming shock ×0.5 (evasion)' },
      { subjectClass: 'cavalry_light', vsClass: 'skirmisher', atkDelta: 2,
        note: 'cavalry_light atk +2' },
    ] as Array<{
      subjectClass: UnitClass;
      vsClass: UnitClass;
      atkDelta?: number;
      defDelta?: number;
      incomingShockMult?: number;
      firstClashOnly?: boolean;
      note: string;
    }>,

    /** Lane-level (not class-vs-class) effect: a lane containing enough
     *  skirmisher strength dampens incoming shock for the whole lane. */
    skirmisherScreen: {
      minStrength: 30,
      incomingShockMult: 0.7,
    },

    /** Stat/morale multipliers by veterancy tier. */
    veterancy: {
      raw:       { statMult: 0.85, moraleSeedDelta: -10 },
      trained:   { statMult: 1.00, moraleSeedDelta: 0 },
      veteran:   { statMult: 1.15, moraleSeedDelta: 10 },
      legendary: { statMult: 1.30, moraleSeedDelta: 20 },
    } as Record<Veterancy, { statMult: number; moraleSeedDelta: number }>,

    /** Formation stat multipliers. `feigned_retreat` is excluded — it's
     *  resolved as a one-off manoeuvre via `feint` below, not a standing
     *  stance. `requiresCaptain` lanes without a captain may not select it
     *  (enforced by battleEngine.getValidOrders, M3). */
    formations: {
      line:        { atkMult: 1.0,  defMult: 1.0,  incomingShockMult: 1.0, requiresCaptain: false },
      wedge:       { atkMult: 1.25, defMult: 0.8,  incomingShockMult: 1.25, requiresCaptain: true,
                     flankChargeMultVsThisLane: 1.25, extraMoraleLossOnRoundLoss: 1 },
      shield_wall: { atkMult: 0.75, defMult: 1.3,  incomingShockMult: 0.6, requiresCaptain: false,
                     skirmisherPreludeChipMult: 0.5, wingMoraleDrainMult: 0.85 },
      open_ranks:  { atkMult: 0.9,  defMult: 0.85, incomingShockMult: 0.2, requiresCaptain: false,
                     terrorImmune: true },
    } as Record<Exclude<FormationId, 'feigned_retreat'>, {
      atkMult: number;
      defMult: number;
      incomingShockMult: number;
      requiresCaptain: boolean;
      flankChargeMultVsThisLane?: number;
      extraMoraleLossOnRoundLoss?: number;
      skirmisherPreludeChipMult?: number;
      wingMoraleDrainMult?: number;
      terrorImmune?: boolean;
    }>,

    /** Feigned retreat gating + roll math. Gating: permitted if lane avg
     *  veterancy ≥ veteran, OR (avg veterancy ≥ trained AND avg loyalty ≥
     *  minLoyaltyWithMinVeterancy), OR any legendary unit present (checked
     *  directly by the engine, not encoded here). */
    feint: {
      minVeterancyAvgTier: 'veteran' as Veterancy,
      minVeterancyAvgTierWithLoyalty: 'trained' as Veterancy,
      minLoyaltyWithMinVeterancy: 70,
      successBase: 30,
      successPerAvgLoyalty: 0.5,
      successPerVeterancyTierIndex: 10,
      successCap: 95,
      /** Roll ≤ this on the success check = botch, regardless of success chance. */
      botchRollMax: 10,
      successEnemyOverextendedDefMult: 0.7,
      successOwnNextChargeShockMult: 1.25,
      failureOwnMoraleDelta: -3,
      failureOwnDefMult: 0.8,
      botchOwnMoraleDelta: -10,
    },

    /** A unit's shock applies in full on its first round engaged in a lane,
     *  half the second, none after — resets on entering a new lane (wheel,
     *  reserve commit) and on a successful feint countercharge. */
    shock: {
      firstRoundMult: 1.0,
      secondRoundMult: 0.5,
      thirdPlusRoundMult: 0,
      /** FIRST-PASS/UNVERIFIED (M2 implementation gap — the plan specified
       *  the decay curve above but not shock's morale/casualty conversion;
       *  chosen to land shock's per-round impact roughly on par with a
       *  loyalty-wavering tick, per unit of raw shock delivered). Revisit
       *  in M11's tuning pass alongside the other battle constants. */
      moraleDeltaPerShockPoint: 0.6,
      casualtyPctPerShockPoint: 0.3,
      /** Safety cap so a single huge shock hit can't out-damage melee. */
      maxCasualtyPctFromShock: 8,
    },

    /** Captain/commander effects. */
    command: {
      captainAtkDefMultPerMartial: 0.02,
      captainMoraleSeedPerMartial: 2,
      /** Commander stationed on a lane acts as that lane's captain at full
       *  effect, plus this army-wide morale seed bonus. */
      commanderStationedArmyWideMoraleSeed: 1,
      /** Commander in reserve/rear grants every lane this fraction of the
       *  stationed-captain martial multiplier instead (half-effect). */
      commanderReserveMultPerMartial: 0.01,
      unledLaneMoraleSeedDelta: -15,
      unledLaneBlocksWedgeAndFeint: true,
      /** M4 — clan legates: min familyReputations[clanId] to offer one
       *  offerable legate captain from that clan. */
      legateMinRelationship: 60,
      legateMartialMin: 4,
      legateMartialMax: 7,
      legateAcceptRelationshipBonus: 5,
      legateCrushingVictoryShareBonus: 10,
      legateDeathRelationshipPenalty: -15,
    },

    /** M4 — wounded status. Deliberately NOT a per-unit skill-penalty
     *  mechanic (no generic character-skill-buff pathway exists in this
     *  codebase — see musterEngine.ts's header comment); wounded is a
     *  flags-cooldown entry consumed only where the martial rating is
     *  actually read for battle purposes (captain roster resolution). */
    wounds: {
      durationTurns: 4,
      martialPenalty: 2,
    },

    /** Loyalty effects specific to battle. Loyalty *lifecycle* (gain/decay
     *  over time) lives in `lifecycle` below (M8). */
    loyalty: {
      highThreshold: 80,
      highMoraleSeedBonus: 5,
      lowThreshold: 30,
      /** Extra morale loss whenever a low-loyalty wing loses a round ("wavering"). */
      lowWaveringMoraleDelta: -2,
    },

    /** Melee exchange math (clashEngine, M2). */
    melee: {
      baseCasualtyRate: 6,
      minCasualtyPct: 2,
      maxCasualtyPct: 15,
    },

    /** Wing morale pool: seed, drain, break, and rout-cascade math. */
    morale: {
      seedPerAvgWeightedMoraleWeight: 10,
      clampMin: 20,
      clampMax: 100,
      casualtyDrainMult: 1.8,
      brokenThreshold: 0,
      /** Once a side has 2 broken wings, its remaining wing takes this extra
       *  drain automatically each round. */
      routCascadeMoraleDeltaPerRound: -20,
    },

    /** Wing-break resolution: the victor's pursue-vs-wheel choice. */
    break: {
      pursueDestroyPct: 0.4,
      pursueDestroyPctWithCavalryLight: 0.6,
      pursueEnemyCaptainCaptureWeightBonus: 15,
      pursueWarScoreRider: 2,
      wheelShockResetMult: 1.5,
      wheelTargetMoraleDelta: -10,
      wheelFlankedDefMult: 0.85,
    },

    /** Elephant terror, skirmisher-prelude panic, and amok checks. */
    elephant: {
      terrorMoraleDeltaPerRound: -2,
      terrorMinStrengthInLane: 30,
      skirmisherPreludeStrengthDamage: 8,
      skirmisherPreludeAmokChanceDelta: 0.10,
      amokBaseChancePerEngagedRound: 0.08,
      amokLowStrengthThreshold: 50,
      amokLowStrengthChanceBonus: 0.15,
      /** Amok checks begin this round (no check on the first engaged round). */
      amokFirstEligibleRound: 2,
      /** M8: chance to gain a captured elephant unit after a crushing victory
       *  over an army that fielded elephants. */
      capturedElephantChance: 0.25,
      capturedElephantStartingLoyalty: 30,
    },

    /** Character risk on battle end (weights sum to 100 within each branch). */
    risk: {
      wingRouted:       { killed: 10, captured: 20, wounded: 30, unharmed: 40 },
      battleLostNoRout: { killed: 3,  captured: 5,  wounded: 15, unharmed: 77 },
      cavalryWingKilledWeightBonus: 5,
      enemyPursuedCapturedWeightBonus: 15,
      /** Commander (vs a mere captain) is a bigger prize. */
      commanderCapturedWeightBonus: 5,
    },

    /** Victory tiers and their warScore swing (mirrored negative for a loss). */
    tiers: {
      crushingMinWingsBroken: 2,
      crushingMinCasualtyPct: 0.6,
      clearMinWingsBroken: 2,
      warScoreByTier: { crushing: 20, clear: 12, marginal: 6 },
      orderlyWithdrawalWarScore: -4,
    },

    /** Four terrain types. `mods` keys are read by clashEngine (M2); absent
     *  keys mean "no modifier" (coastal_plain is intentionally neutral —
     *  it exists so a future naval-adjacent fight has a label to use). */
    terrains: {
      open_plain:     { id: 'open_plain',     label: 'Open Plain',      mods: { cavalryShock: 1.15 } },
      rough_hills:    { id: 'rough_hills',    label: 'Rough Hills',     mods: { cavalryShock: 0.7, defenderDef: 1.1 } },
      river_crossing: { id: 'river_crossing', label: 'River Crossing',  mods: { attackerAtk: 0.85 } },
      coastal_plain:  { id: 'coastal_plain',  label: 'Coastal Plain',   mods: {} },
    } as Record<string, TerrainMod>,

    /** M3 addition: an orderly withdrawal's "fighting retreat" def bonus for
     *  the withdrawing side's final round (§Chunk M3, "Withdrawal"). */
    withdrawal: {
      defMult: 1.1,
    },

    /** M7 — stratagems (see data/stratagems.ts for the 8-card catalog).
     *  Hand size and draw-weight multipliers are FIRST-PASS/UNVERIFIED —
     *  the plan specifies "drawn weighted by army composition and terrain"
     *  descriptively but gives no numbers; revisit in M11's tuning pass
     *  alongside the other battle constants. Effect magnitudes below ARE
     *  the plan's stated numbers where given. */
    stratagems: {
      handSizeBase: 1,
      handSizeMartialDivisor: 4,
      /** Ambuscade: enemy lane morale hit, pre-battle, rough_hills/river_crossing only. */
      ambuscadeMoraleDelta: -10,
      ambuscadeTerrainIds: ['rough_hills', 'river_crossing'],
      /** Caltrops: incoming cavalry-class shock onto the chosen own lane. */
      caltropsCavalryShockMult: 0.3,
      /** Fire Arrows: added to the ENEMY's elephant amok chance, this battle. */
      fireArrowsAmokChanceDelta: 0.20,
      /** Rally the Standards: broken own wing re-forms at this morale, once/battle. */
      rallyMorale: 25,
      /** Forced March: enemy reserve locked until this round (inclusive start). */
      forcedMarchLockUntilRound: 3,
      /** Testudo Discipline: prelude/missile chip onto the chosen own lane. */
      testudoPreludeMult: 0,
      /** Officer's Oath: chosen own lane's units count as this loyalty, this battle. */
      officersOathLoyalty: 80,
      /** Double Envelopment Doctrine: multiplies this side's wheel flank bonus. */
      doubleEnvelopmentWheelBonusMult: 1.75,
      /** FIRST-PASS/UNVERIFIED draw-weight multipliers (base weight 1 for
       *  every card; a card at weight 0 never enters the draw pool). Applied
       *  by battleEngine.drawStratagemHand against the drawing side's OWN
       *  army composition + terrain only (no cross-side knowledge — matches
       *  battleAi.chooseDeployment's (profile, army, terrain) signature). */
      drawWeights: {
        ambuscadeTerrainMatch: 3,
        ambuscadeNoTerrainMatch: 0,
        caltropsLowCavalryMult: 2,
        fireArrowsNoElephantsMult: 2,
        testudoInfantryScreenMult: 2,
        officersOathLowLoyaltyMult: 2,
        rallyBaseWeight: 1.5,
        forcedMarchBaseWeight: 1,
        doubleEnvelopmentHeavyCavalryMult: 2,
        /** Composition thresholds used by the multipliers above. */
        lowCavalryStrengthFraction: 0.2,
        lowLoyaltyThreshold: 60,
        heavyCavalryStrengthFraction: 0.2,
      },
    },

    /** M8 — unit lifecycle (src/engine/battle/musterEngine.ts, gameStore.ts's
     *  Donative action, turnSequencer.ts's season tick). `campaignsSurvived`
     *  is TroopUnit's existing field, reused as "engagedBattles" (see M4's
     *  baseline note in musterEngine.ts) — thresholds below read it
     *  directly. `bondToCommander` is likewise reused as "loyalty". */
    lifecycle: {
      /** engagedBattles (campaignsSurvived) thresholds. legendary ALSO
       *  requires TroopUnit.wonCrushingVictory (sticky, set at write-back)
       *  — see musterEngine.ts's promotedVeterancy. Promotion never
       *  downgrades an already-higher tier (e.g. a 'seasoned_veteran'-type
       *  troop's M4-derived 'legendary' veterancy survives even at 0
       *  engagedBattles). */
      veterancyThresholds: { trained: 2, veteran: 5, legendary: 9 },
      /** New levy starting loyalty — wired into gameStore.raiseLevy
       *  (DEVIATION: was inline 50 pre-M8; updated to match this constant
       *  since the plan specifies the number directly). Sandbox debug synth
       *  troops (gameStore.startSandboxBattle) are untouched — debug-only
       *  content, not the real levy path. */
      newLevyLoyalty: 40,
      /** Applied once per season, at battle write-back, or at the yearly
       *  rollover respectively — see musterEngine.ts/turnSequencer.ts. */
      loyaltyGainPerCampaignSeason: 5,
      loyaltyGainPerVictoryShared: 10,
      loyaltyLossPerDefeat: -15,
      /** DEVIATION (documented in musterEngine.ts): applied at BATTLE
       *  write-back (comparing Character.lastLoyaltyCommanderId against
       *  that battle's commanderId), not as a season-tick check — "the
       *  army's commander changed" is a battle-time fact in this codebase,
       *  not something with its own season-to-season identity. */
      loyaltyLossCommanderChange: -10,
      /** Between wars (not on an active personally-commanded campaign):
       *  decays toward this target by this amount, once per year
       *  (Winter→Spring rollover only, matching every other yearly-cadence
       *  system in this codebase). */
      idleLoyaltyDecayPerYear: -2,
      idleLoyaltyDecayTarget: 50,
      /** Donative (gameStore.payDonative) — army-scope (a character's full
       *  raisedLegions + veterans), once per year via the existing generic
       *  `<key>-cooldown` numeric-flags decay pass. */
      donativeDenariiPerCohort: 20,
      donativeLoyaltyGain: 15,
      donativeCooldownSeasons: 4,
    },
  },

  // ─── M1 — War score & strategic layer (src/engine/warEngine.ts, M9) ────────
  war: {
    maxSingleBattleSwing: 25,
    skirmishDriftMin: 1,
    skirmishDriftMax: 3,
    siegeObjectiveMin: 5,
    siegeObjectiveMax: 10,
    /** 12 war-turns (3 years) before weariness drift begins. */
    wearinessAfterTurns: 12,
    wearinessDriftPerSeason: 1,
    thresholds: { sue: 40, forced: 70, dictate: 90 },
    /** Applies to the losing side once |warScore| crosses the given threshold. */
    desperation: {
      sueThresholdEffects: { levyDenariiCostMult: 0.75, wingsDefMult: 1.1 },
      forcedThresholdEffects: { extraStratagemHandSize: 1, winningOverextensionUpkeepMult: 1.25 },
    },
    /** M4: ransom demand for a captured character. `negotiate` is a
     *  DEVIATION from the plan's literal "60% chance" framing — this
     *  codebase's event system only supports deterministic skill-gate
     *  checks (skill >= difficulty), not weighted-random outcomes (verified
     *  in eventEngine.ts's resolveChoice; adding true RNG there would be
     *  new surgery on a shared, large file for one choice). A paterfamilias
     *  with intrigus >= negotiateIntrigusDifficulty reliably halves the
     *  ransom for a Fides cost; below that, negotiation reliably fails and
     *  the Fides is spent for nothing — consistent with every other
     *  skill-checked event choice in the game. */
    ransom: {
      baseDenarii: 150,
      negotiateFidesCost: 15,
      negotiateIntrigusDifficulty: 6,
      negotiateSuccessMult: 0.5,
      refuseLifetimeDignitasPenalty: -5,
    },
    /** Design decision (see models/war.ts header comment): provincial revolts
     *  route through this same set-piece system as a 'local' scale war,
     *  scaled well below a 'major' foreign war's enemy army size. M9's
     *  scheduler multiplies its enemy-army-size formula by this factor. */
    scaleArmyMultiplier: { major: 1.0, local: 0.4 },

    /** M9 — src/engine/warEngine.ts. FIRST-PASS/UNVERIFIED (the plan gives
     *  the scheduler's shape but not every constant — same treatment as
     *  M7's stratagem draw weights): the scheduler is explicitly provisional
     *  (Phase 3A replaces scheduleSetPiece wholesale, see warEngine.ts's
     *  seam comment), so these are reasonable starting numbers, not tuned
     *  ones. Revisit in a future tuning pass alongside M11's battle numbers. */
    setPieceOffer: {
      chancePerSeason: 0.25,
      minSpacingTurns: 2,
      expiryTurns: 3,
      baseCohorts: 10,
      warScoreDivisor: 10,
      minCohorts: 4,
      maxCohorts: 16,
      /** Decline OR let the offer expire unanswered — same consequence either way. */
      declineWarScorePenalty: -3,
      declineLifetimeDignitasPenalty: -2,
    },
    /** Skirmish drift: magnitude is uniform in [skirmishDriftMin,
     *  skirmishDriftMax] (existing M1 constants); sign is biased toward
     *  Rome when the campaigning character's army strength / martial clear
     *  these baselines. */
    skirmish: {
      strengthBaseline: 300,
      martialBaseline: 5,
    },

    /** M10 — src/engine/warEngine.ts / src/data/treatyTerms.ts. FIRST-PASS/
     *  UNVERIFIED (same treatment as setPieceOffer above — the plan gives
     *  the negotiation flow's shape but not every constant). Per-term
     *  warScorePrice values are content, living directly on each
     *  TreatyTerm in treatyTerms.ts, not here — these are the systemic
     *  numbers that apply across every negotiation. */
    treaty: {
      /** Budget = |warScore| − thresholdBase + treatyBudgetAllowance[tier].
       *  thresholdBase is BALANCE.war.thresholds.sue (40) — at the sue tier
       *  itself this yields 0 (no real term-shopping budget), matching the
       *  plan's "only accept/refuse a minor AI offer" framing for that tier. */
      thresholdBase: 40,
      treatyBudgetAllowance: { sue: 0, forced: 10, dictate: 30 },
      /** calcFactionReactionModifier's clamp range — mirrors
       *  calcRomeStatVoteModifier's ±10 in billTemplates.ts. */
      factionReactionClamp: 10,
      /** Seasons a ratification bill stays in the queue before expiring
       *  (failing) if support never clears the pass threshold. */
      ratificationTurnsLeft: 3,
      /** Consequences of a failed/expired ratification vote. */
      failWarScorePenalty: -5,
      failNegotiatingConsulDignitasPenalty: -5,
      /** Seasons before the same treaty (by term set) can be re-tabled
       *  after a failed ratification. */
      retableLockoutTurns: 4,
      /** Term count for the lightweight sue-tier AI offer (Carthage losing,
       *  proposes a minor package the player just accepts/refuses). */
      aiOfferTermCount: 2,
      /** Refusing a sue-tier AI offer costs nothing mechanical per the plan,
       *  but does ding relationship with the initiating side's sympathetic
       *  faction — mirrors declineSetPieceOffer's dignitas-only cost. */
      refuseAiOfferLifetimeDignitasPenalty: -2,
    },

    /** Phase 3, Chunk P3-A — historical ripeness curve. Purely additive on
     *  top of the M9/M10 desperation-tier system above (`thresholds` /
     *  `treaty`): it does NOT change when negotiation unlocks — the
     *  sue/forced/dictate tiers stay flat, unmodified constants. It only
     *  scales the bar for how a 'major'-scale war's eventual conclusion
     *  gets CLASSIFIED once a treaty actually ratifies (see warEngine.ts's
     *  classifyTerminalOutcome): the same warScore that reads as a merely
     *  adequate peace early in the war can read as a decisive Victory once
     *  ripeness has climbed. FIRST-PASS/UNVERIFIED, same treatment as every
     *  other M9/M10 constant here — a future tuning pass may revise. */
    ripeness: {
      /** Historical First Punic War bracket — elapsed/ripeness math keys off these. */
      startYear: 264,
      historicalEndYear: 241,
      /** Years elapsed (|GameState.year| counting down from startYear) before
       *  ripeness begins climbing off 0. */
      floorYears: 4,
      /** Years elapsed at which ripeness reaches 1.0 (≈ historical length). */
      fullYears: 20,
      /** phaseForYear cosmetics: first N years elapsed are always 'opening'. */
      openingPhaseYears: 3,
      /** phaseForYear cosmetics: ripeness at/above this reads as 'ripe'. */
      ripePhaseThreshold: 0.7,
      /** phaseForYear cosmetics: |warScore| under this reads as 'grinding'
       *  (a stalemate) rather than 'escalation'. */
      grindingWarScoreBand: 15,
      /** Ripeness-interpolated warScore bounds a ratified/auto-ratified
       *  'major' war's ending must clear to classify as Victory/Humbled
       *  outright, per classifyTerminalOutcome. Anything ratified in
       *  between reads as Exhaustion — a negotiated peace that isn't a
       *  blowout either way. */
      thresholds: {
        victory: { hard: 92, easy: 55 },
        humbled: { hard: -92, easy: -55 },
      },
      /** P3-B — ripeness-interpolated `weariness` bound at/above which
       *  `warEngine.peaceReachable` flips a 'major' war's `peaceOffered`
       *  true (surfaces bill-sue-for-peace). Deliberately far below the
       *  hard/easy pairs above at ripeness 0 — the whole point of this
       *  lever is to let the player END an overlong, non-decisive war
       *  before it would ever clear a decisive victory/humbled bound. */
      exhaustionWeariness: { hard: 45, easy: 20 },
      /** P3-B — flat (not ripeness-scaled) `weariness` bar for the
       *  flags['war-weariness-high'] flag, gating the "murmur" flavour
       *  event — a softer, earlier signal than peaceOffered itself, so it
       *  can foreshadow before the real lever appears. First-pass/unverified. */
      weariedFlagThreshold: 15,
    },

    /** P3-B — the war-funding bill (see warEngine.ts's queueWarFundingBill).
     *  FIRST-PASS/UNVERIFIED, same treatment as every other M9/M10/P3-A
     *  constant in this group. */
    funding: {
      /** Seasons between auto-tabled war-funding bills for the same war
       *  (any outcome — pass, fail, or expiry) — keeps it from reappearing
       *  every single season. */
      recurTurns: 4,
      treasuryCost: 15,
      crisisWarEaseOnPass: 6,
      crisisWarSpikeOnFail: 8,
      /** Applied directly to WarState.warScore on pass only (detected via
       *  the reconstructable bill id, same pattern as the M10 treaty bill —
       *  not expressible through the generic passEffect string, since
       *  warScore lives inside a specific WarState, not top-level GameState). */
      warScoreBonusOnPass: 6,
      /** calcRomeStatVoteModifier-style ±clamp on the support bias term
       *  (Optimates favour funding the legions; Populares wary of the cost). */
      supportBiasClamp: 10,
    },

    /** P3-B — the sue-for-peace bill (see warEngine.ts's queueSueForPeaceBill).
     *  FIRST-PASS/UNVERIFIED. Passing forces a negotiated end — see
     *  classifyTerminalOutcome; the crisis/dignitas numbers here are the
     *  bill's ordinary pass/fail flavour, not the war-ending logic itself. */
    sueForPeace: {
      crisisWarEaseOnPass: 10,
      crisisWarSpikeOnFail: 5,
      failSponsorDignitasPenalty: -3,
      /** Opposite bias from funding's supportBiasClamp — Populares favour
       *  ending the war, Optimates penalise the motion. */
      supportBiasClamp: 10,
    },
  },

  /** Phase 3, Chunk P3-C — Succession & Regency. FIRST-PASS/UNVERIFIED, same
   *  treatment as every other constant group in this file. No pre-existing
   *  natural-mortality system existed anywhere in this codebase before this
   *  chunk (verified — only trial execution/exile and battle death removed
   *  a family member, neither via an age-based roll); these numbers are
   *  this chunk's own invention, not derived from an existing formula. */
  succession: {
    /** Annual death chance by age band, rolled once per character at the
     *  yearly rollover (turnSequencer step 10's existing `crossedNewYear`
     *  gate). Bands are lower-bound-inclusive; the last band whose lower
     *  bound the character's age clears applies. Negligible under 50,
     *  rising through the 60s, steep past 70 (explicit design direction —
     *  NOT a period-accurate Roman actuarial table). */
    mortalityByAge: [
      { minAge: 0,  annualChance: 0.002 },
      { minAge: 50, annualChance: 0.01 },
      { minAge: 60, annualChance: 0.03 },
      { minAge: 70, annualChance: 0.08 },
      { minAge: 80, annualChance: 0.18 },
      { minAge: 90, annualChance: 0.35 },
    ],
    /** Heir confirmed under this age triggers a regency. */
    regencyMinorAge: 18,
    /** Fides income multiplier while a regency is active (resourceEngine.ts). */
    regencyIncomeMult: 0.75,
    /** Referenced by src/data/successionEvents.ts's effect strings — those
     *  are literal numbers (this codebase's content-file convention, same
     *  as every bill template), kept in sync with these by hand. */
    funeral: {
      lavish: { denariiCost: 40, lifetimeDignitasGain: 15, factionRelDelta: 5 },
      modest: { fidesLoss: -3 },
    },
    /** Naming an heir other than the eldest eligible costs family trust —
     *  "family trust" doesn't surface as its own stat outside familyTrust
     *  on Character itself (verified), so this is applied to the NEW
     *  paterfamilias's familyTrust field directly (a fresh reign starting
     *  under a cloud), not a separate GameState-level stat. */
    nameOtherHeirFamilyTrustPenalty: -15,
    /** Per-season chance a spouseless-but-eligible paterfamilias (a fresh
     *  heir who inherited unmarried, or one widowed by the yearly mortality
     *  roll) is arranged a new spouse — inheritanceEngine.needsSpouse/
     *  generateSpouse. Keeps births passively available across generations
     *  instead of silently dying out the first time a spouse is missing.
     *  FIRST-PASS/UNVERIFIED, same treatment as every other constant here. */
    remarriageChance: 0.15,
  },

  /** Phase 3, Chunk P3-D — Cadet Branch. FIRST-PASS/UNVERIFIED, same
   *  treatment as every other constant group in this file. */
  cadet: {
    /** Generated once at run start (gameStore.startGame). */
    ageMin: 25,
    ageMax: 40,
    /** A reduced spread vs. the main line's typical starting stats. */
    skillMin: 2,
    skillMax: 5,
    startingStanding: 40,
    /** evt-cadet-visit's hard cap — "once or twice", per the plan. */
    maxVisits: 3,
    /** evt-cadet-visit's random.ts-style weight (see warEvents.ts's periodic
     *  events for the comparable magnitude) — low, so it's rare relative to
     *  the rest of the event pool. */
    visitWeight: 4,
    /** Legacy multiplier applied once continueAsCadet fires. Read by
     *  epilogueEngine.ts (P3-E). */
    legacyPenaltyMult: 0.5,
  },

  /** Phase 3, Chunk P3-E — Endings. FIRST-PASS/UNVERIFIED, same treatment
   *  as every other constant group in this file. */
  epilogue: {
    /** GameState.crisisLevel (the 4-track average) at/above this triggers
     *  the "Republic Falls" hard terminal. Literally 100 requires every
     *  track maxed simultaneously — extreme, but that's the point of a
     *  terminal ending; kept as a named constant rather than a hardcoded
     *  100 so a future tuning pass can soften it without touching engine
     *  code. */
    crisisTerminalThreshold: 100,
  },

  /** Phase 4, Chunk P4-A — Secrets (gather/generation only; spend/counterplay
   *  numbers land in P4-B, trial numbers in BALANCE.trials from P4-C on).
   *  FIRST-PASS/UNVERIFIED, same treatment as every other constant group in
   *  this file. Supersedes diplomacy.gatherIntelligenceFidesCost, which this
   *  chunk removes (gatherIntelligence is rewired onto secretEngine). */
  secrets: {
    gatherCostFides: 8,
    /** gatherChance(agent, groundwork) = gatherBaseChance + agent.intrigus ×
     *  gatherPerIntrigus + groundwork, clamped to gatherChanceCap. */
    gatherBaseChance: 0.25,
    gatherPerIntrigus: 0.06,
    gatherChanceCap: 0.90,
    /** Failed gather attempts raise groundwork (persists, no decay v1),
     *  which feeds back into gatherChance above — persistence pays
     *  deterministically even on a bad-roll streak. */
    groundworkPerFailure: 0.10,
    groundworkCap: 0.30,
    /** Quaestor's Audit a Rival — moved here from the hardcoded 0.6 in
     *  offices.ts's audit-rival action. */
    auditRivalChance: 0.60,
    /** npcGatherTick — each leader with standing < hostileStandingMax rolls
     *  once per season: npcGatherBase + npcGatherPerCorruption × (highest
     *  corruption among your family) capped at npcGatherCap. Corruption is
     *  the fuel — a clean family is nearly un-blackmailable. */
    npcGatherBase: 0.03,
    npcGatherPerCorruption: 0.0015,
    npcGatherCap: 0.15,
    hostileStandingMax: 30,
    maxHeldAgainstFamily: 3,
    /** Potency 1 / 2 / 3 generation weights (sums to 1). */
    potencyWeights: [0.55, 0.35, 0.10] as [number, number, number],

    /** npcGatherTick never targets the player (see generateSecret's
     *  `traitBias` option and secretDefinitions.ts's TRAIT_TYPE_BIAS) — only
     *  adult, non-player kin are eligible. Target is chosen by weighted
     *  random among them: base weight 1.0, multiplied per trait present via
     *  this table (a character with none of these traits keeps weight 1.0),
     *  plus a light +corruptionScore/200 nudge so a corrupt heir stays
     *  somewhat more exposed without corruption being required. */
    blackmailTargetTraitWeight: {
      aggressive: 1.6,
      ambitious: 1.4,
      cautious: 0.7,
      content: 0.7,
    } as Record<'aggressive' | 'ambitious' | 'cautious' | 'content', number>,
    /** generateSecret's `traitBias` option multiplies the trait-matched
     *  SecretType's draw weight (secretDefinitions.ts's TRAIT_TYPE_BIAS) by
     *  this factor before the weighted draw — a strong lean, not a
     *  guarantee (other types can still turn up occasionally). */
    traitTypeBiasWeight: 3,
    /** Per-season, per-LatentSecret chance (secretEngine.latentSecretDiscoveryTick)
     *  that a compromising choice the player knowingly made (see
     *  resourceEngine's `createLatentSecret:` token) gets noticed by a
     *  hostile leader and converted into a real, demandable Secret. */
    latentDiscoveryChance: 0.12,

    // ── Phase 4, Chunk P4-B — spend/counterplay/NPC behavior ────────────────
    /** Leverage (player, on a held Secret): consumes it, forces the target
     *  bill's support by leader.votes × this, signed for/against. Election
     *  Leverage is free/instant (reuses campaignVotes, no separate constant
     *  needed — same mechanism canvassForVotes/canvassLeader already use). */
    leverageBillSupportPerVote: 1.2,
    /** Extort (player, on a held Secret): status -> 'extorting',
     *  +extortIncomePerPotency × potency Denarii/season. Each season,
     *  extortExposureChance roll: on hit, Secret -> 'spent', leader
     *  relationship += extortExposureRelationship (a nosedive, so negative),
     *  and the leader's retaliation groundwork toward a counter-Secret on
     *  the player's family rises by extortRetaliationGroundwork. */
    extortIncomePerPotency: 10,
    extortExposureChance: 0.15,
    extortExposureRelationship: -30,
    extortRetaliationGroundwork: 0.15,
    /** Burn (player, on a held Secret): consumes it. Leader permanently
     *  loses burnVoteLossFraction of votes (plan's system-overview text:
     *  "the leader permanently loses half their votes"); their clan's
     *  familyReputations score is clamped down to burnClanRepFloor (just
     *  past the -10 hostile threshold — reputationThresholds.ts). */
    burnVoteLossFraction: 0.5,
    burnClanRepFloor: -15,
    /** Pay Off (player, on a Secret held against the family): permanent,
     *  expensive by design. */
    payOffCostPerPotency: 40,
    /** Discredit (player, on a Secret held against the family): agent
     *  picker, same shape as Gather Intelligence's. Success -> neutralized.
     *  Failure -> potency +1 (max 3), the cover-up made it worse. */
    discreditCostFides: 10,
    discreditBase: 0.30,
    discreditPerIntrigus: 0.05,

    /** NPC decision cadence/weights — a leader holding a usable (unfrozen)
     *  family Secret acts once cooldown has elapsed since lastActedSeason,
     *  choosing Leverage/Extort/Burn by disposition and situation (see
     *  secretEngine.npcSecretDecision). FIRST-PASS/UNVERIFIED, same
     *  treatment as every other constant group in this file. */
    npcAi: {
      npcUseCooldownSeasons: 4,
      /** Leverage retains the Secret for this many uses before it's spent. */
      leverageReuseLimit: 2,
      /** Defying a social-class demand: scandal event hits. */
      socialExposureDignitas: -10,
      socialExposureRelationship: -20,
      /** Burn only considered at standing (leader.relationship) at/below this. */
      npcBurnStandingMax: 5,
    },

    // ── Phase 4, Chunk P4-G — the Claudius arc ──────────────────────────────
    // Ap. Claudius Pulcher's starting Secret is excluded from the generic
    // npcAi scan (turnSequencer.ts step 9b) so it never auto-fires the
    // generic demand/burn events — his own relationship (-30, startingClans.ts)
    // is already below npcBurnStandingMax, which would otherwise burn the
    // arc's own Secret in year 1. Claudius's own stats (intrigus 9, clan
    // influence 75) drive an unusually steep computeOpponentPrepGrowth rate
    // (~18.75/season) — steep enough that trialSeed alone can't compensate
    // for it (it's a ~10-point knob against a ~19-point-per-season term).
    //
    // Phase 5, Chunk P5-H — retuned against real evidence, not just fixture
    // math: simulated the trial directly (4 representative prep actions —
    // 2x Gather Evidence at intrigus 5, 2x Prepare an Oration at rhetoric 6,
    // Brutii's own starting stats) against the OLD numbers (trialSeed 10,
    // the shared 3-season npcInitiatedDelay) and got a differential of -15.4
    // — Exiled, nowhere near the "3-4 actions -> comfortably Acquitted+"
    // target. Growth over the prep window (56+ points) dominated the seed's
    // 10 almost completely, so the fix touches both: trialSeed down to 0,
    // and a new Claudius-specific (not the shared, every-trial-affecting
    // npcInitiatedDelay) startsDelaySeasons down to 1 — one fewer season for
    // that steep growth rate to compound before trial day. Re-simulated
    // after: differential +17.8, landing solidly in Dismissed with real
    // margin above the threshold (10) — see __tests__/p5h.test.ts's
    // "Claudius trial" test, which asserts this exact result.
    claudius: {
      /** resolveClaudiusDefiance's initialNpcStrength. */
      trialSeed: 0,
      /** resolveClaudiusDefiance's own prep-window override — NOT
       *  BALANCE.trials.npcInitiatedDelay (that constant is shared by every
       *  other NPC-initiated trial; changing it to fix this one arc would
       *  have rippled everywhere). */
      startsDelaySeasons: 1,
      /** "Play for time": exactly one season of silence, then automatic
       *  defiance if the player hasn't otherwise resolved the Secret
       *  (complied, paid off, discredited, or reached deterrence). */
      patienceSeasons: 1,
    },
  },

  /** Phase 4, Chunk P4-C — the unified trial pipeline. FIRST-PASS/UNVERIFIED,
   *  same treatment as every other constant group in this file. */
  trials: {
    // ── Filing ────────────────────────────────────────────────────────────
    fileCostFides: 15,
    /** Initial npcStrength granted by the evidence base — a consumed
     *  criminal Secret scales by potency; the corruption path is flat and
     *  smaller (weaker case, cheaper to build). */
    secretEvidenceBase: 15,
    corruptionEvidenceBase: 10,
    corruptionChargeThreshold: 60,
    /** Player picks startsSeason = filed + 2..4. NPC-initiated trials
     *  (corruption/treason/military_incompetence/criminal-exposure triggers)
     *  always use the fixed delay below, not a player choice. */
    startDelayBand: [2, 4] as [number, number],
    npcInitiatedDelay: 3,

    // ── Opponent prep growth (per season, while 'preparing') ────────────────
    // npcPrepBase + npcPrepPerIntrigue × intrigue + npcPrepClanFactor × clan.influence.
    // No wealthy-trait multiplier — ClanLeader has no traits system (only
    // `bias`), and the plan's own phrasing ("if traits expose one")
    // anticipated this outcome; skipped rather than inventing a proxy.
    npcPrepBase: 3,
    npcPrepPerIntrigue: 0.5,
    npcPrepClanFactor: 0.15,
    /** The opponent-strength estimate band shown to the player: ±this
     *  fraction, narrowed to the exact number once the player holds a
     *  Secret on the opponent leader (the cleanest existing intel signal —
     *  "Local-Support-style intel" doesn't apply to clan leaders, only
     *  provinces). */
    estimateBandPct: 0.20,

    // ── Jury lean (recomputed every season) ──────────────────────────────
    // Σ over clans of familyReputations[clanId] × juryLeanPerStanding ×
    // clanVoteWeight(clan) — familyReputations is already -100..100 and
    // zero-centered, so no extra "-50" offset is needed (the plan's formula
    // assumed a 0-100 "standing" scale; this codebase's equivalent is
    // already centered on 0).
    juryLeanPerStanding: 0.05,
    juryLeanCap: 10,

    // ── Verdict thresholds ────────────────────────────────────────────────
    // Differential bands (>threshold) mapping to outcomes, always phrased
    // from the DEFENDANT's perspective — trialEngine.computeVerdict flips
    // the differential's sign when the player is the prosecutor before
    // applying these same bands ("the same bands read from the other
    // side"). Two severity tiers (data/trialCharges.ts's severityTier)
    // rather than 5 separate per-charge tables, since the plan gives no
    // distinct numbers per charge — 'severe' (maiestas, military_incompetence)
    // shifts every band up by 10, harsher across the board. Below the
    // lowest listed band (exiled) is executed.
    verdictThresholds: {
      standard: { acquitted: 30, dismissed: 10, fined: -10, exiled: -30 },
      severe:   { acquitted: 40, dismissed: 20, fined: 0,   exiled: -20 },
    },

    // ── Calumnia (losing a player-filed prosecution) ─────────────────────
    // Player's OWN differential (not the defendant-flipped one) below this
    // triggers calumnia — a clear loss, not merely "didn't win."
    calumniaThreshold: -20,
    calumniaDignitas: -15,
    calumniaClanRelations: -25,
    counterSuitChance: 0.35,

    // ── Verdict math shares (design invariant 1 — "70/30, and it's a
    // constant") ──────────────────────────────────────────────────────────
    /** finalX = prepScore × prepShare + performance. Performance (P4-E) is
     *  always 0 this chunk, so verdicts resolve prep-only — the share still
     *  lives here so nothing downstream needs a second number when P4-E lands. */
    prepShare: 0.70,
    /** The ±30% share of a 100-point prep scale P4-E's beats can swing.
     *  Unused this chunk (performance is hardcoded 0) — defined now so the
     *  constant has one home, per invariant 1's "nothing may bypass the clamp." */
    performanceCap: 30,

    // ── Leader corruption / "governorship" accrual (tickLeaderCorruption) ──
    // No NPC-governorship simulation exists in this codebase (provinces
    // only track playerGovernor) — this is a leader-side abstraction, not a
    // simulation of who economically controls which province. Eligibility:
    // has held praetor or consul (historically provincial-command-granting
    // offices, already tracked via heldOffices). Each season, an eligible
    // leader has `activeChance` odds of "actively governing" this season;
    // if so, a taxation notch is picked (weighted by standing — hostile
    // leaders lean extortionate) and BALANCE-external
    // province.TAXATION_CORRUPTION_PER_TURN[notch] is applied directly, so
    // this reuses real, already-tuned numbers rather than inventing new ones.
    governorship: {
      activeChance: 0.15,
      /** relationship < this → weighted toward heavy/extortionate. */
      hostileStandingMax: 0,
      /** relationship < this (and >= hostileStandingMax) → standard/heavy mix. */
      neutralStandingMax: 40,
      // Otherwise (>= neutralStandingMax): benevolent/light/standard mix —
      // a friendly leader has less reason to fleece a province.
    },

    // ── The Basilica's prep catalog (Phase 4, Chunk P4-D) ─────────────────
    // Seed values, first-pass — data/trialPrep.ts holds only labels/section/
    // asset-gate; every number lives here. Section subtotals accumulate raw
    // (pre-Approach) points; trialEngine.computeTotalPrepStrength applies
    // the multipliers below at read time.
    prep: {
      // Gather Evidence (Logos) — repeatable, cap 5 uses. Cost rises per use
      // already made this trial; effect scales with the sending agent's
      // Intrigus (same picker convention as P4-A's Gather Intelligence).
      gatherEvidenceCostBaseFides: 8,
      gatherEvidenceCostPerUseFides: 4,
      gatherEvidenceBonusBase: 6,
      gatherEvidenceMaxUses: 5,

      // Present a Secret as Evidence (Logos) — consumes a criminal Secret on
      // the opponent matching this trial's charge (secretDefinitions'
      // chargeType mapping, via secretEngine.mapSecretTypeToTrialCharge).
      presentSecretEvidenceBonusPerPotency: 12,

      // Secure a Witness (Pathos) — 2 slots; a named Witness object, later
      // attackable at trial (P4-E).
      secureWitnessCostDenarii: 20,
      secureWitnessBonus: 8,
      secureWitnessMaxSlots: 2,

      // Prepare an Oration (Pathos) — repeatable, cap 3 uses. Value locks at
      // purchase (speaker-agnostic; re-running after a speaker change does
      // NOT retroactively use the new speaker's Rhetoric for past uses).
      prepareOrationCostFides: 8,
      prepareOrationBonusBase: 4,
      prepareOrationMaxUses: 3,

      // Invoke the Ancestors (Ethos) — free, one-time. floor(lifetimeDignitas
      // / divisor), capped.
      invokeAncestorsDignitasDivisor: 25,
      invokeAncestorsCap: 12,

      // Bribe the Jurors (Ethos) — per clan bloc; each bribe carries a
      // discovery roll (P4-E's trial-day session start) that voids the bonus
      // and becomes a hostile beat if it hits. Inert this chunk — the record
      // is only stored (TrialState.playerPrep.bribedClanIds).
      bribeJurorsCostPerBlocDenarii: 30,
      bribeJurorsBonusPerBloc: 6,
      juryBribeDiscoveryChance: 0.15,

      // Bribe the Praetor (Ethos) — one-time, largest single Ethos lever.
      // Same "inert until P4-E" discovery-roll note as above.
      bribePraetorCostDenarii: 80,
      bribePraetorBonus: 15,
      praetorBribeDiscoveryChance: 0.25,

      // Intimidate a Key Witness (Pathos, legacy-ported gate) — asset-gated
      // (Gladiator School tier 3, same `intimidate_witness` unlock id as
      // before). Reworded per the plan from "boosts your prep" to "opponent
      // -strength" — reduces npcStrength directly rather than adding to
      // playerPrep, since there's no opponent-witness model to remove one
      // from. Cost carried over from the old TRIAL_ACTIONS entry; the
      // opponent-strength-reduction magnitude is a fresh seed (not the old
      // defenseBonus, since it now targets a different number).
      intimidateWitnessCostDenarii: 60,
      intimidateWitnessNpcStrengthReduction: 20,
    },

    // ── Approach multipliers (Phase 4, Chunk P4-D — design invariant 8) ────
    // Free, adjustable until startsSeason. Applied by
    // trialEngine.computeTotalPrepStrength (Logos/Pathos/Ethos multipliers)
    // and computeVerdict (Ferocity's low-Rhetoric bonus, Sympathy's jury-
    // lean weight). Procedure's surprise-beat effect and Ferocity's
    // "draws aggressive beats" are P4-E beat-engine territory — the
    // multiplier below is defined now so beat drawing has one number to read
    // later, but nothing consumes it until then (same pattern as P4-C's
    // unused performanceCap).
    approach: {
      ferocity: {
        logos: 1.2,
        ethos: 0.9,
        /** Opponent leader's skills.rhetoric (0-10) below this grants the bonus. */
        lowRhetoricThreshold: 4,
        lowRhetoricBonus: 5,
      },
      procedure: {
        logos: 1.1,
        /** Slot-2 draw weight applied to any candidate beat tagged 'surprise'
         *  when approach === 'procedure' (trialBeatEngine.drawTrialBeats) —
         *  no longer inert now that P4-E's beat draw exists. */
        surpriseBeatChanceMultiplier: 0.5,
      },
      sympathy: {
        pathos: 1.25,
        logos: 0.9,
        juryLeanWeightMultiplier: 2,
      },
    },

    // ── Trial day: the beat engine (Phase 4, Chunk P4-E) ──────────────────
    beats: {
      /** Exactly 3 beats per session (design overview §2's "3-beat interactive
       *  sequence"), fewer only if mandatory preemption + a starved pool
       *  somehow can't fill a slot (data/trialBeats.ts's library is sized to
       *  avoid this in practice). */
      beatsPerTrial: 3,
      /** Per-beat swing clamp — the ceiling a single response's success/failure
       *  value may contribute before the running total's own ±performanceCap
       *  clamp (BALANCE.trials.performanceCap, defined above) applies. */
      beatSwingMax: 10,
      /** NPC performance is a single value added once at session conclusion
       *  (not accumulated beat-by-beat like the player's, since the NPC
       *  doesn't answer beats) — EV-neutral baseline, then nudged by
       *  trialBeatEngine.computeNpcPerformance if the opponent holds a
       *  courtroom-savvy trait (sharp_mind/ruthless/great_orator/silver_tongue
       *  — data/traits.ts). Both seeds are a first-pass implementer's call;
       *  no distinct number is given in the design plan. */
      npcPerformanceEV: 0,
      npcPerformanceTraitNudge: 3,
    },

    // ── Verdict scene rewards (Phase 4, Chunk P4-F) ───────────────────────
    // Numbers given directly by the plan text (§Chunk P4-F, "Rewards &
    // records") rather than implementer-picked seeds, unlike most of this
    // registry.
    rewards: {
      /** Prosecution victory (outcome fined/exiled/executed with the player
       *  in the prosecution seat): dignitas = this + the convicted leader's
       *  Senate votes. */
      prosecutionWinDignitasBase: 10,
      /** Added on top when the convicted leader held office at the moment
       *  of conviction (ClanLeader.currentOffice !== null) — the "Vox
       *  Populi" case. */
      sittingMagistrateBonus: 10,
      /** Defense victory at the Dismissed tier specifically (not Acquitted,
       *  per the plan's own wording) — a small vindicated beat. */
      vindicatedDignitas: 5,
    },
  },

  // ─── Phase 5, Chunk P5-E — Alternate starting families ───────────────────
  // Brutii's own starts (INITIAL_STATE, gameStore.ts): fides 30, denarii 200,
  // lifetimeDignitas 0. Both alt families are free-start-only sidegrades —
  // per invariant 3/4 neither should cross a Patron Tier threshold at start
  // (Tier 1 requires lifetimeDignitas >= 30) or approach
  // trialEngine.CORRUPTION_TRIAL_THRESHOLD (60), so neither gets an
  // unintended mechanical head start or immediate trial risk.
  altFamilies: {
    duilia: {
      /** ~3x Brutii's 200 — "buy your way in" is the whole hook. */
      startingDenarii: 600,
      /** Brutii's own lifetimeDignitas is already 0 — "~0.5x" is trivially
       *  satisfied by any low number; kept at 0 like Brutii (no inherited
       *  prestige at all, matching "new money, no name"). */
      startingLifetimeDignitas: 0,
      /** Slightly below Brutii's 30 — cash-rich, trust-poor. */
      startingFides: 20,
      /** All four clans start here — "nobody knows them" (Brutii's own
       *  default anchor is 0; this is the Cold band per
       *  REPUTATION_THRESHOLDS, -50 to -10). */
      startingClanReputation: -15,
    },
    manlia: {
      /** Below Brutii's 200 — a disgraced house has spent down its reserves. */
      startingDenarii: 80,
      /** Below Brutii's 30 — public trust takes time to rebuild. */
      startingFides: 15,
      /** Above Brutii's/Duilia's 0 ("moderate") but nowhere near the Tier 1
       *  threshold (30) — some residual prestige from before the disgrace,
       *  no mechanical head start. */
      startingLifetimeDignitas: 20,
      /** Elevated but safely under CORRUPTION_TRIAL_THRESHOLD (60) — real
       *  pressure (nudges secret-generation targeting odds, corruptionScore
       *  / 200 per secretEngine.ts) without an immediate trial risk from
       *  turn one. */
      startingCorruption: 40,
      /** Fabii and Claudii (the two proudest old patrician houses — natural
       *  judges of a disgraced peer) hostile; Cornelii neutral (aloof,
       *  focused on its own aristocratic circle); Valerii sympathetic
       *  (the populist clan extending sympathy to a humbled patrician
       *  house — an intentional, slightly unusual pairing, noted in the
       *  P5-E commit). */
      hostileClanReputation: -60,
      neutralClanReputation: 0,
      sympatheticClanReputation: 35,
    },
  },

  // ─── Difficulty presets (Phase 5, Chunk P5-G) ─────────────────────────────
  // Exactly two seams read these (design invariant 4): incomeMult scales
  // resourceEngine.calcResourceIncome's final computed Fides/Denarii season
  // income (not action costs, event effects, or one-off grants — margins,
  // not prices); crisisMult scales crisisEngine.calcIndividualEscalation's
  // per-track passive delta only (not calcCascadeDeltas' flat +2 compounding
  // bumps or checkMilitaryBillPressure's bill-consequence penalty — both
  // stay at authored magnitude; Ferox still drifts hotter overall because
  // faster individual escalation crosses cascade thresholds sooner, not
  // because cascade itself is scaled). Seeds — P5-H tunes.
  difficulty: {
    clemens: { incomeMult: 1.15, crisisMult: 0.85 },
    aequus:  { incomeMult: 1.0,  crisisMult: 1.0 },
    ferox:   { incomeMult: 0.9,  crisisMult: 1.2 },
  },

  /** Campaign Map plan ("The Consul's Map"), Chunk C1 — theatre-map data
   *  model skeleton. Grows in later chunks (C3 muster, C5 movement/combat
   *  constants). */
  campaign: {
    /** Fallback relationship theatreEngine.getRegionRelationship uses for a
     *  region whose cityIds is empty (no real city data to average) —
     *  none of the 8 launch regions hit this path today, but the plan's
     *  design keeps it available for a future region added without cities
     *  yet assigned. First-pass/unverified, matches province.ts's old
     *  foreign-relationship starting-value ballpark. */
    defaultForeignRelationship: 20,

    /** Chunk C2 — armyEngine.upkeepFor's per-season cost math. Charging it
     *  and applying shortfall consequences (loyalty loss, attrition,
     *  disband-under-20) is C3's job; only the cost formula lives here.
     *  First-pass/unverified seeds, C10 tunes. */
    upkeep: {
      baseDenariiPerCohort: 2,
      /** Army sits in a region its own power (Rome vs Carthage) controls. */
      friendlyTerritoryMult: 1.0,
      neutralTerritoryMult: 1.5,
      /** Behind enemy lines — the other power controls the region. */
      hostileTerritoryMult: 2.0,
      /** Up to this fraction off at region relationship 100 (linear). */
      maxRelationshipDiscount: 0.30,
      /** Chunk C3 — musterEngine.settleUpkeep's shortfall consequences.
       *  Charging is C7's job; only the pure consequence math lives here. */
      shortfallLoyaltyPenalty: 10,
      shortfallAttritionPct: 0.03,
      disbandLoyaltyThreshold: 20,
    },

    /** Chunk C3 — musterEngine.ts. Three discrete tier cards (P5-G picker
     *  style), one cohort raised per action. First-pass/unverified seeds
     *  from the plan's own spec table, C10 tunes. */
    muster: {
      tiers: {
        emergency: { costPerCohort: 15, baseVeterancy: 'raw' as const, secondaryChance: 0, loyaltySeed: 30 },
        standard:  { costPerCohort: 25, baseVeterancy: 'raw' as const, secondaryChance: 0.25, loyaltySeed: 40 },
        picked:    { costPerCohort: 45, baseVeterancy: 'trained' as const, secondaryChance: 0.25, loyaltySeed: 50 },
      },
      /** cost × (1 − relationship × this) — up to −40% at relationship 100. */
      relationshipCostDiscountFactor: 0.004,
      /** "The good families send their sons" — relationship ≥ this unlocks
       *  a second, independent veterancy-bump roll per cohort. */
      relationshipQualityBumpThreshold: 70,
      relationshipQualityBumpChance: 0.25,
      /** Below this relationship (or non-Rome controller), muster is
       *  unavailable entirely — v1 cuts mercenary flavour. */
      minRelationshipToMuster: 25,
      /** Invariant 7 — imperium gates unsanctioned player musters, never
       *  spent. Scales with the player's OWN cohorts already in the field
       *  (any region), not the region being mustered. */
      imperiumThresholdBase: 10,
      imperiumThresholdPerCohort: 2,
    },

    /** Chunk C4 — commandEngine.ts / gameStore's callCommandVote/
     *  resolveCommandElection. First-pass/unverified seeds from the plan's
     *  own spec table, C10 tunes. minCandidateAge is deliberately NOT
     *  duplicated here — commandEngine.commandMinAge() reads it live off
     *  offices.ts's consul entry so the two never drift apart. */
    command: {
      callVoteFidesCost: 5,
      canvassFidesCost: 3,        // matches electionEngine's base CANVASS_FIDES_COST — no per-office scaling exists for a Command
      canvassThreshold: 60,
      rivalCount: 2,
      grantImperium: 15,
      grantStateCohorts: 6,       // standard-levy quality, spawned at latium
      grantWarChest: 300,
      termSeasons: 4,
      prorogationPerBattle: 8,
      prorogationModifierClamp: 25,
      prorogationWarChestTopUp: 100,
    },

    /** Chunk C5 — movementEngine.ts. First-pass/unverified seeds from the
     *  plan's own spec table, C10 tunes. */
    movement: {
      baseMP: 2,
      /** Step cost entering a region the mover's own power controls. */
      landFriendlyCost: 1,
      /** Step cost entering a neutral- or enemy-controlled region. */
      landContestedCost: 2,
      straitCost: 1,
      /** A sea lane always consumes ALL remaining MP, but only if at least
       *  this much remains when the army reaches a coastal jumping-off
       *  point — "one lane per season". */
      seaLaneMinMP: 2,
      winterMPPenalty: 1,
      /** Cohort count strictly above this triggers the big-stack penalty. */
      bigStackCohorts: 8,
      bigStackMPPenalty: 1,
      forcedMarchMPBonus: 1,
      forcedMarchAttritionPct: 0.04,
      /** Multiplies an Edge's laneRisk when the storm roll happens in
       *  Winter (seasonIndex 3) — resolved at C7's order-resolution time,
       *  not issue time. */
      winterSeaMultiplier: 2.0,
      stormAttritionPct: 0.10,
    },

    /** Chunk C6 — campaignAi.ts. First-pass/unverified seeds from the
     *  plan's own spec table (plus a few this chunk had to invent — noted
     *  below — where the plan named a concept without a formula), C10
     *  tunes. */
    ai: {
      /** ADVANCE only attack-moves when armyStrength ratio (mover ÷
       *  defender) clears this, scaled DOWN by the mover's own aggression —
       *  see attackRatioAggressionScale. */
      attackRatioThreshold: 1.2,
      /** The plan names "scaled down by aggression" without a formula —
       *  invented here: effectiveThreshold = attackRatioThreshold × (1 −
       *  aggression × this). 0.5 halves the threshold at aggression 1.0. */
      attackRatioAggressionScale: 0.5,
      /** Softmax temperature over the three behaviors' (score × weight)
       *  products — one shared constant, not per-profile (per the plan's
       *  own "temperature in BALANCE" phrasing). */
      softmaxTemperature: 1.0,
      reinforcementCohorts: 3,
      reinforcementInterval: 3,
      /** Invented (not named by the plan): NPC-Roman commanders with the
       *  'conqueror' or 'soldier_born' trait (data/traits.ts — the only
       *  martial-flavoured traits that exist; no defensive/cautious trait
       *  exists in that catalog to symmetrically bonus 'hold' with) get
       *  this added to their derived advance weight. */
      traitAdvanceBonus: 0.5,
      /** NPC-Roman commanders' objectiveWeights baseline before the trait
       *  bonus above — the plan's own "else default" fallback, since no
       *  richer hold/advance personality signal exists on ClanLeader. */
      defaultObjectiveWeights: { hold: 1, advance: 1, raid: 1 },
      defaultDeceptionChance: 0.1,
    },

    /** Chunk C7 — campaignResolver.ts. First-pass/unverified seeds from the
     *  plan's own spec table (plus a few invented where the plan named a
     *  concept without a formula — noted below), C10 tunes. */
    resolution: {
      /** Design invariant/plan text — player armies get +2 initiative so
       *  their plans read as reliable. */
      playerInitiativeBonus: 2,
      withdrawal: {
        base: 30,
        martialMult: 3,
        /** Bonus if the DEFENDER's cavalry share of total units exceeds the
         *  attacker's. */
        avoidCavBonus: 10,
        /** Strength lost by a successfully-withdrawing army. */
        attritionPct: 0.02,
      },
      /** Consecutive uncontested seasons a hostile occupier needs before a
       *  region's TheatreState controller flips (the "2nd consecutive
       *  season" the plan's step 6 names literally). */
      controlFlipThresholdSeasons: 2,
      /** Post-battle loser retreat / failed-withdrawal retreat: strength
       *  lost is folded into the abstract battle's own casualty seeds
       *  below, not a separate number — this constant intentionally absent.
       *  A shattered army's commander fate (captured vs escaped) — M4's
       *  real character-fate hooks aren't wired at the campaign layer yet
       *  (C8's job), so this only drives flavor-text branching for now. */
      shatterCaptureChance: 0.25,
      raid: {
        /** Region relationship hit to every live city inside the raided
         *  region — the plan's own literal seed. */
        relationshipSting: -10,
        /** NOT named by the plan ("a small denarii loss") — invented here.
         *  Only ever fires against Rome's treasury (state.denarii): no NPC
         *  economy/Carthage denarii pool exists in this codebase for a
         *  symmetric Roman-raids-Carthage sting to draw from. */
        denariiSting: 20,
      },
      /** The abstract battle resolver — a pure strength-ratio + seeded-
       *  variance PLACEHOLDER (per the plan's own framing for this chunk),
       *  clearly superseded by C8's real `abstractResolver.ts` (which adds
       *  terrain fit and a calibration test against the tactical harness).
       *  `tier` reuses M1's real BattleOutcome enum ('marginal'|'clear'|
       *  'crushing') rather than C8's spec-text "narrow" — same concept,
       *  existing vocabulary preferred over inventing a second one.
       *  Casualty seeds ARE C8's own spec-table numbers (crushing 25/8,
       *  clear 15/10, narrow 12/12) — reused now rather than invented twice. */
      abstractBattle: {
        /** Power-ratio margin (|winProb − 0.5| × 2, 0..1) above which a
         *  result reads as this tier. Invented — the plan gives casualty
         *  numbers per tier but no margin bands to pick a tier from. */
        crushingMarginThreshold: 0.5,
        clearMarginThreshold: 0.2,
        /** Multiplies (attacker martial) into the attacker/defender power
         *  score alongside armyStrength — same "×(1 + martial × factor)"
         *  shape C8's own spec text uses for the real resolver. */
        martialFactor: 0.05,
        casualtiesByTier: {
          crushing: { winnerPct: 0.08, loserPct: 0.25 },
          clear:    { winnerPct: 0.10, loserPct: 0.15 },
          marginal: { winnerPct: 0.12, loserPct: 0.12 },
        },
      },
    },
  },
};

// ─── Known un-extracted tunables ───────────────────────────────────────────
// Left in place rather than extracted here — each is either single-use,
// embedded in a bespoke office-action effect function, or content that
// belongs in data/, not the balance registry. Revisit only if a later chunk
// needs to tune one of these directly.
//   - offices.ts: individual inOfficeAction costs/effects (large, mostly
//     one-off flavour numbers). P2-F touches the Aedile subset directly as
//     part of Munificence consolidation.
//   - billTemplates.ts: per-bill voteGravitasCost/speechGravitasCost
//     overrides (the *defaults* are BALANCE.senate.*; per-bill overrides are
//     content, not registry tunables).
//   - assetDefinitions.ts / cityAssets.ts: asset costs and bonuses
//     (content).
//   - trialActions.ts, campaignEvents.ts, canvassingEvents.ts,
//     cityEvents.ts: content, not balance-registry tunables. Note:
//     cityEvents.ts's CITY_EVENTS array is currently unwired to any
//     resolver (dead content, confirmed during P2-A) — its costs/effects
//     were still corrected to valid resource names for consistency, but
//     wiring it up is out of Phase 2's scope.
