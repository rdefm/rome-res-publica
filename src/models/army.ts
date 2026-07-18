// ─── Army Models ─────────────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C2. Armies exist as
// first-class state — a NEW, parallel model to the existing personal-legion
// system (Character.raisedLegions/veterans: TroopUnit[], models/troop.ts),
// not a replacement of it.
//
// DEVIATION FROM THE PLAN TEXT (documented per the plan's own §0 instruction
// to flag deviations with reasons): the plan's C2 draft says Army "replaces"
// TroopUnit via "a one-shot migration... or note it and skip." TroopUnit is
// not a legacy stub — it's the live output of the already-built Legate's
// Line M4 (strategic<->battle bridge) and M8 (unit lifecycle) chunks: 32
// files touch character.raisedLegions/veterans, including musterEngine.ts's
// full battle-outcome write-back (casualties, captures, veterancy
// promotion, elephant-steady tracking, commander-change loyalty, ransom,
// the triumph pathway) and the Senate unsanctioned-levy response. Migrating
// all of that onto a new Army-owns-troops model now, before C8 (the battle
// bridge) exists to need it, would be large and risky for a payoff not
// usable until C5 (movement) anyway. Decision (agreed with the user before
// this chunk's code landed): Army is new and additional, for state-owned,
// rival-commander, and Carthage armies. Personal troops fold into Army
// later — C4 (winning a command) or C8 (the real battle bridge), decided
// with real context then, not guessed here.
//
// No logic here — pure types, per the project's model/data/engine layering.

import type { UnitClass, Veterancy } from './battle';
import type { RegionId } from './theatre';

/** One unit within an Army — the M1 BattleUnit shape (Legate's Line, already
 *  built — see the Baseline assumption note in the campaign map plan)
 *  plus strategic-layer fields. One type serves both layers: a future
 *  battle-bridge chunk projects the BattleUnit-shaped fields directly
 *  (id/unitClass/strength/veterancy/loyalty/elephantSteady/sourceRef) rather
 *  than translating from a differently-scaled record, the way
 *  musterEngine.ts currently must for TroopUnit (see that file's own
 *  header comment on TroopUnit's 1–10 strength scale vs BattleUnit's 0–100). */
export interface ArmyUnit {
  id: string;
  unitClass: UnitClass;
  /** 0–100, % of full cohort strength remaining — matches BattleUnit.strength
   *  exactly, not TroopUnit's 1–10 "combat effectiveness" scale. */
  strength: number;
  veterancy: Veterancy;
  /** 0–100. */
  loyalty: number;
  elephantSteady: boolean;
  /** Link back to a strategic-layer levy record, if this unit was ever
   *  projected from one. Unused by anything in this chunk — declared for
   *  forward compatibility with whichever future chunk unifies the two
   *  troop representations. */
  sourceRef?: string;
  homeRegion: RegionId;
  raisedBy: 'state' | 'player' | 'npc';
  raisedSeason: number;
}

export type ArmyOwner = 'player' | 'rome_state' | 'rome_rival' | 'carthage';

/** Placeholder — Chunk C5 (Movement) defines the real shape (forced march,
 *  intent, sea-lane orders, etc.). Declared now only so Army.ordersThisSeason
 *  has a type to point at. */
export interface MovementOrder {
  path: RegionId[];
}

export interface Army {
  id: string;
  /** Free text for now (e.g. "Legio I" from a debug spawn). Chunk C3's real
   *  muster flow owns the "Legio I Campana"-style auto-naming convention the
   *  plan describes — not built here, since it needs a real raising context
   *  (home region, ordinal among existing armies) this chunk's debug spawn
   *  doesn't have. */
  name: string;
  owner: ArmyOwner;
  /** Character id, legate id (Legate's Line's procedurally-generated
   *  `legate-<clanId>-<n>` ids — see engine/battle/musterEngine.ts's
   *  offerableLegates), or enemy-general id (data/enemyGenerals.ts). null =
   *  leaderless — may garrison but never attack (design invariant 5). */
  commanderId: string | null;
  location: RegionId;
  /** Which specific city within `location` this army is garrisoned at or
   *  besieging — flavor/siege-framing only (region stays the atomic unit for
   *  movement/adjacency/control-flip, per the campaign map plan's Chunk C1
   *  movement-model note). null only for a not-yet-placed debug army;
   *  real armies always have one, defaulting to their region's sole city
   *  (single-city regions) or "seat" city (multi-city regions). */
  stationedCityId: string | null;
  units: ArmyUnit[];
  stance: 'give_battle' | 'avoid_battle';
  ordersThisSeason: MovementOrder | null;
  fatigued: boolean;
  unpaidSeasons: number;
}
