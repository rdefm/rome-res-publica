// ─── Battle Models ───────────────────────────────────────────────────────────
// Types for the set-piece battle system ("The Legate's Line" — see
// rome-military-implementation-plan.md, Chunk M1). No logic here — pure
// shapes, consumed by src/engine/battle/*.
//
// Skin-agnostic (invariant 3 in the plan): nothing here assumes land warfare.
// `unitClass` is a closed enum today but every rule that reads it lives in
// data (BALANCE.battle in src/data/balance.ts), not in switch statements —
// a naval reskin adds classes/rows, not branches.

// ─── Core enums ─────────────────────────────────────────────────────────────

export type UnitClass =
  | 'legionary'
  | 'spear_foot'
  | 'skirmisher'
  | 'cavalry_heavy'
  | 'cavalry_light'
  | 'elephant';

export type Veterancy = 'raw' | 'trained' | 'veteran' | 'legendary';

export type FormationId = 'line' | 'wedge' | 'shield_wall' | 'open_ranks' | 'feigned_retreat';

export type LaneId = 'left' | 'centre' | 'right';

export type BattleSide = 'attacker' | 'defender';

// ─── Deployment-time shapes ─────────────────────────────────────────────────

export interface BattleUnit {
  id: string;
  unitClass: UnitClass;
  /** 0–100, % of full cohort strength remaining. */
  strength: number;
  veterancy: Veterancy;
  /** 0–100. */
  loyalty: number;
  /** True once this unit has fought in/opposite an elephant lane (M8 lifecycle). */
  elephantSteady: boolean;
  /** Link back to the strategic-layer levy/legion record this unit was mustered from. */
  sourceRef?: string;
}

export interface LaneAssignment {
  units: BattleUnit[];
  /** Character or legate id captaining this lane; null = unled lane. */
  captainId: string | null;
  formation: FormationId;
}

export interface Deployment {
  lanes: Record<LaneId, LaneAssignment>;
  reserve: BattleUnit[];
  commanderStation: LaneId | 'reserve';
}

// ─── Orders (first pass — plan explicitly allows refinement in M3) ─────────

/** A formation change for one lane, taking effect the coming round. */
export interface LaneOrders {
  formation?: FormationId;
}

/** Committing reserve units into a lane next round. Max one lane per round
 *  is an orchestrator-enforced rule (M3), not encoded in the type. */
export interface ReserveCommit {
  laneId: LaneId;
  unitIds: string[];
}

/** One side's full set of orders for the coming round. */
export interface SideOrders {
  laneOrders: Partial<Record<LaneId, LaneOrders>>;
  commitReserves?: ReserveCommit;
  stratagemId?: string;
  withdraw?: boolean;
}

// ─── Runtime state ──────────────────────────────────────────────────────────

export interface WingState {
  laneId: LaneId;
  units: BattleUnit[];
  captainId: string | null;
  formation: FormationId;
  /** 0–100. */
  moralePool: number;
  broken: boolean;
  engagedRounds: number;
  flanked: boolean;
  overextended: boolean;
}

export interface SideState {
  label: string;
  wings: Record<LaneId, WingState>;
  reserve: BattleUnit[];
  commanderId: string | null;
  commanderStation: LaneId | 'reserve';
  /** Set on the AI side only — see data/enemyGenerals.ts (M7). */
  generalProfileId?: string;
  /** M3 addition: captainId (lane captain or commander) → martial rating
   *  (0–10). clashEngine needs a numeric martial for its command multiplier
   *  but battleEngine must stay pure (no Character import) — the caller
   *  (eventually M4's muster bridge) resolves this once at deployment time.
   *  An opaque id→number lookup, nothing more. */
  captainMartialById: Record<string, number>;
}

export interface TerrainMod {
  id: string;
  label: string;
  mods: Partial<{
    cavalryShock: number;
    defenderDef: number;
    attackerAtk: number;
    elephantAmok: number;
  }>;
}

export type BattlePhase = 'deployment' | 'orders' | 'break_decision' | 'resolved';

/** A wing that broke this round awaits a pursue/wheel decision from the side
 *  that broke it (`submitBreakDecision`) before the round can be considered
 *  fully resolved. M3 addition — the plan named this sub-phase but didn't
 *  specify how BattleState tracks which lane(s) are awaiting a decision. */
export interface PendingBreakDecision {
  laneId: LaneId;
  /** The side whose wing broke — the OTHER side (the victor) decides. */
  brokenSide: BattleSide;
}

export interface BattleState {
  seed: number;
  round: number;
  terrain: TerrainMod;
  attacker: SideState;
  defender: SideState;
  log: BattleLog;
  phase: BattlePhase;
  outcome?: BattleOutcome;
  /** M3 addition: how many seeded-rng values have been drawn so far across
   *  the whole battle. BattleState must stay plain data (serializable —
   *  M5 stores it in gameStore) so the RNG itself isn't stored; instead each
   *  orchestrator call reconstructs makeSeededRng(seed) and fast-forwards
   *  this many draws before continuing, preserving one continuous
   *  deterministic sequence across calls. See battleEngine.ts. */
  rngCallsConsumed: number;
  /** M3 addition — see PendingBreakDecision above. Empty when no decision
   *  is outstanding (phase !== 'break_decision'). */
  pendingBreakDecisions: PendingBreakDecision[];
  /** M3 addition: unitId → accrued amok chance (fraction, e.g. 0.10) from
   *  the skirmisher-prelude panic chip (clashEngine's prelude step). Keyed
   *  by unitId across both sides (ids are unique) since amok checks need
   *  the *cumulative* rider for a unit's whole battle, not just one round. */
  amokChanceRiders: Record<string, number>;
  /** M3 addition: total strength each side fielded at initBattle — needed to
   *  turn cumulative casualties into a percentage for the crushing-victory
   *  tier check without re-deriving it from the log. */
  startingStrength: { attacker: number; defender: number };
}

// ─── Log ─────────────────────────────────────────────────────────────────────
// Ordered entries the UI replays — it never recomputes anything from these.
// First pass per the plan; M2/M3 may extend fields as the engine is built.

export interface CasualtyDelta {
  laneId: LaneId;
  side: BattleSide;
  unitId: string;
  strengthLost: number;
}

export interface MoraleDelta {
  laneId: LaneId;
  side: BattleSide;
  delta: number;
  reason: string;
}

interface RoundLogEntryBase {
  round: number;
}

export type RoundLogEntry =
  | (RoundLogEntryBase & {
      type: 'clash';
      laneId: LaneId;
      casualties: CasualtyDelta[];
      moraleDeltas: MoraleDelta[];
      modifiersSummary: string;
    })
  | (RoundLogEntryBase & {
      type: 'shock_charge';
      laneId: LaneId;
      side: BattleSide;
      casualties: CasualtyDelta[];
      moraleDeltas: MoraleDelta[];
    })
  | (RoundLogEntryBase & {
      type: 'terror';
      laneId: LaneId;
      side: BattleSide;
      moraleDeltas: MoraleDelta[];
    })
  | (RoundLogEntryBase & {
      type: 'wing_break';
      laneId: LaneId;
      side: BattleSide;
    })
  | (RoundLogEntryBase & {
      type: 'wheel';
      fromLane: LaneId;
      toLane: LaneId;
      side: BattleSide;
    })
  | (RoundLogEntryBase & {
      type: 'pursue';
      laneId: LaneId;
      side: BattleSide;
      unitsDestroyed: number;
    })
  | (RoundLogEntryBase & {
      type: 'amok';
      laneId: LaneId;
      unitId: string;
      casualties: CasualtyDelta[];
    })
  | (RoundLogEntryBase & {
      type: 'feint_result';
      laneId: LaneId;
      side: BattleSide;
      result: 'success' | 'failure' | 'botch';
    })
  | (RoundLogEntryBase & {
      type: 'reserve_commit';
      laneId: LaneId;
      side: BattleSide;
      unitIds: string[];
    })
  | (RoundLogEntryBase & {
      type: 'stratagem_played';
      side: BattleSide;
      stratagemId: string;
    })
  | (RoundLogEntryBase & {
      type: 'withdrawal';
      side: BattleSide;
    })
  | (RoundLogEntryBase & {
      type: 'battle_end';
      outcome: BattleOutcome;
    });

export type BattleLog = RoundLogEntry[];

// ─── Outcome ─────────────────────────────────────────────────────────────────

export interface BattleCasualtySummary {
  attacker: { strengthLost: number; unitsLost: number };
  defender: { strengthLost: number; unitsLost: number };
}

export interface CaptainOutcome {
  characterId: string;
  result: 'unharmed' | 'wounded' | 'captured' | 'killed';
}

export interface BattleOutcome {
  victor: BattleSide | 'withdrawal';
  tier: 'marginal' | 'clear' | 'crushing';
  casualties: BattleCasualtySummary;
  captainOutcomes: CaptainOutcome[];
  /** Already capped to BALANCE.war.maxSingleBattleSwing by the orchestrator (M3). */
  warScoreDelta: number;
}
