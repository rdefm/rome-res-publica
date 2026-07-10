// ─── War Sites (M9 content) ──────────────────────────────────────────────────
// A small named-site list for set-piece offer flavour (rome-military-
// implementation-plan.md §Chunk M9: "site name from a small data list,
// terrain weighted by site"). Sicilian, matching this game's First Punic
// War setting. Pure content — no logic; warEngine.ts picks a site and rolls
// its weighted terrain.

export interface WarSite {
  id: string;
  name: string;
  /** Weight per terrain id (src/data/balance.ts's BALANCE.battle.terrains
   *  keys) — warEngine.ts samples proportionally. Terrains absent here have
   *  zero chance at this site. */
  terrainWeights: Partial<Record<string, number>>;
}

export const WAR_SITES: WarSite[] = [
  { id: 'agrigentum', name: 'Agrigentum', terrainWeights: { open_plain: 3, coastal_plain: 2 } },
  { id: 'panormus', name: 'Panormus', terrainWeights: { coastal_plain: 3, rough_hills: 1 } },
  { id: 'lilybaeum', name: 'Lilybaeum', terrainWeights: { coastal_plain: 3, open_plain: 1 } },
  { id: 'messana_straits', name: 'the Straits of Messana', terrainWeights: { river_crossing: 3, coastal_plain: 1 } },
  { id: 'himera_hills', name: 'the Himera Hills', terrainWeights: { rough_hills: 3, open_plain: 1 } },
];
