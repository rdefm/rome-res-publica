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
    gatherIntelligenceFidesCost: 8,
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

  // ─── P2-C — Deterministic training ─────────────────────────────────────────
  training: {
    /** Cost of training a skill TO targetLevel = this × targetLevel Fides.
     *  E.g. 6→7 costs fidesCostPerTargetLevel × 7. Same for all three skills. */
    fidesCostPerTargetLevel: 3,
    /** Skills cannot be trained above this level. */
    skillCap: 10,
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
//   - assetDefinitions.ts / provinceAssets.ts: asset costs and bonuses
//     (content).
//   - trialActions.ts, campaignEvents.ts, canvassingEvents.ts,
//     provinceEvents.ts: content, not balance-registry tunables. Note:
//     provinceEvents.ts's PROVINCE_EVENTS array is currently unwired to any
//     resolver (dead content, confirmed during P2-A) — its costs/effects
//     were still corrected to valid resource names for consistency, but
//     wiring it up is out of Phase 2's scope.
