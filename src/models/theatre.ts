// ─── Theatre Models ────────────────────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C1 — the strategic theatre
// map: coarse Regions, each grouping one or more existing Cities
// (src/models/city.ts). A Region is the atomic unit for army movement,
// adjacency, and control in the coming campaign chunks (C2–C9); Cities
// nested inside it stay exactly what they always were — the
// Governor/Ambassador/relationship/asset entity — and additionally feed
// their region's aggregate relationship (see theatreEngine.getRegionRelationship).
//
// No logic here — pure types, per the project's model/data/engine layering.

/** The 8 launch regions. Only the Punic War theatre is modelled — see
 *  design invariant 9 (rome-campaign-map-implementation-plan.md §1): a
 *  region added later for a different theatre is additive, not a shape
 *  change. */
export type RegionId =
  | 'latium'
  | 'etruria'
  | 'samnium'
  | 'campania'
  | 'cisalpine_gaul'
  | 'sicilia'
  | 'sardinia'
  | 'africa';

/** Who holds a region's strategic position. Distinct from any single
 *  city's `CityOwner` — a region can contain cities under different owners
 *  (e.g. Sicilia's four cities are independent/Carthage-owned at game
 *  start, with no single power in control), in which case the region
 *  itself starts 'neutral'. */
export type Controller = 'rome' | 'carthage' | 'neutral';

export interface Region {
  id: RegionId;
  name: string;
  displayNameLatin: string;
  /** Must match a terrain id in BALANCE.battle.terrains (open_plain,
   *  rough_hills, river_crossing, coastal_plain) — the only four the
   *  Legate's Line battle engine (src/engine/battle/*) understands. */
  terrainId: string;
  coastal: boolean;
  /** Existing City ids (src/data/cityDefinitions.ts) grouped under this
   *  region. Never empty for the 8 launch regions, but a future region
   *  could ship with none yet — theatreEngine.getRegionRelationship falls
   *  back to BALANCE.campaign.defaultForeignRelationship in that case. */
  cityIds: string[];
  /** Cohorts musterable per year — first-pass/unverified seed, C10 tunes.
   *  Zero engine reads this yet (C3 muster wires it up); declared now so
   *  the data shape is settled. */
  baseManpower: number;
  startingController: Controller;
  /** Rough hand-traced border, fractions (0–1) of the theatre map image —
   *  same convention as CityDefinition's nodeX/nodeY. Chunk C2, map-visual
   *  work: purely a rendering aid for MapView.tsx (a soft outline showing
   *  where one region's territory reads as ending and the next beginning);
   *  no engine reads this — adjacency/control/combat all key off RegionId,
   *  never off geometry. Optional: a region without one falls back to no
   *  outline (just its city pins), not an error. */
  borderPoints?: { x: number; y: number }[];
}

export type EdgeKind = 'land' | 'strait' | 'sea';

export interface Edge {
  a: RegionId;
  b: RegionId;
  kind: EdgeKind;
  /** Sea-lane only: base interception/storm chance, 0–1. Undefined for
   *  land/strait edges (the strait crossing carries no storm risk — see
   *  data/theatreMap.ts's comment on the campania–sicilia edge). */
  laneRisk?: number;
}

/** Persisted, mutable half of the theatre — the static Region/Edge data
 *  lives in data/theatreMap.ts. Controllers only for now; `contested`
 *  (consecutive uncontested seasons an invader has held a region) is
 *  declared here per the plan's C1 spec but not yet written by any engine —
 *  C7's turn-end resolution owns it. */
export interface TheatreState {
  controllers: Record<RegionId, Controller>;
  contested: Record<RegionId, number>;
  /** Chunk C3 — cohorts mustered so far this game-year, per region, against
   *  Region.baseManpower's annual cap. Reset to 0 for every region at the
   *  Winter→Spring crossing (turnSequencer.ts). */
  musteredThisYear: Record<RegionId, number>;
}
