import type { ProvinceDefinition } from '../models/province';

// ─── Italy Province Definitions ──────────────────────────────────────────────
// Node positions (nodeX, nodeY) are expressed as fractions (0–1) of the map
// image dimensions. These are tuned for the Italia pixel-art asset supplied
// (portrait orientation, ~1000×1100px source).
//
// The image was inspected visually:
//   Cisalpine Gaul  → top-centre (Po valley)
//   Etruria         → west-centre coast
//   Latium          → centre, near the Tiber label
//   Samnium         → south-east of Latium
//   Campania        → south, below Latium on Tyrrhenian side

export const ITALY_PROVINCES: ProvinceDefinition[] = [
  {
    id: 'cisalpine_gaul',
    name: 'Cisalpine Gaul',
    latinName: 'Gallia Cisalpina',
    map: 'italy',
    status: 'incorporated',
    profile: 'Northern frontier. Strategically critical, volatile under neglect.',
    flavorDescription:
      'The land beyond the Apennines — a vast plain watered by the Po, home to Gallic tribes only recently brought to heel. Enormous military potential, but loyalty is thin and the legions are essential to keep order here.',
    startingRelationship: 45,
    startingInfrastructure: 20,
    startingLocalSupport: 0,
    baseGoldOutput: 6,
    baseImperiumOutput: 4,
    nodeX: 0.520,
    nodeY: 0.260,
    clientIds: ['gallic_chieftains_son'],
    npcRoleHolder: {
      name: 'C. Servilius',
      clanId: 'clan-servilia',
      trait: 'competent',
      policy: { taxation: 'standard', security: 'heavy_garrison', development: 'maintain' },
    },
    namedWar: 'Gallic Raids',
    threatWeight: 1.2,
  },
  {
    id: 'etruria',
    name: 'Etruria',
    latinName: 'Etruria',
    map: 'italy',
    status: 'incorporated',
    profile: 'Old-money cultural heartland. Proud — drops Relationship fast under squeeze.',
    flavorDescription:
      'The Etruscans built cities when Rome was still a collection of huts. They remember. Ancient families, deep religious traditions, and a pride that cannot be easily flattered. Tax them lightly and invest in their temples; squeeze them and they will make your life difficult through every legal channel available.',
    startingRelationship: 62,
    startingInfrastructure: 55,
    startingLocalSupport: 0,
    baseGoldOutput: 8,
    baseImperiumOutput: 1,
    nodeX: 0.260,
    nodeY: 0.460,
    clientIds: ['etruscan_augur'],
    npcRoleHolder: {
      name: 'M. Fulvius',
      clanId: 'clan-fulvia',
      trait: 'honest',
      policy: { taxation: 'light', security: 'light_patrol', development: 'maintain' },
    },
  },
  {
    id: 'latium',
    name: 'Latium',
    latinName: 'Latium',
    map: 'italy',
    status: 'heartland',
    profile: "Rome's heartland. Cannot be governed — it is Rome.",
    flavorDescription:
      "Latium is Rome's beating heart — the ancient Latin plain from which the Republic grew. It cannot revolt, cannot be taxed separately, and needs no governor. Its loyalty is eternal. What happens here is Rome itself.",
    startingRelationship: 100,
    startingInfrastructure: 80,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.440,
    nodeY: 0.530,
    clientIds: [],
    npcRoleHolder: {
      name: '— Rome itself —',
      clanId: '',
      trait: 'honest',
      policy: { taxation: 'benevolent', security: 'standard_garrison', development: 'maintain' },
    },
  },
  {
    id: 'samnium',
    name: 'Samnium',
    latinName: 'Samnium',
    map: 'italy',
    status: 'incorporated',
    profile: 'Highland warriors, proud and volatile. High Imperium, revolt-prone under neglect.',
    flavorDescription:
      'The Samnites have fought Rome three times and nearly won each time. Now nominally pacified, they retain a fierce martial culture and fierce memories. Strong garrisons keep the peace; neglect invites trouble. A skilled governor can extract extraordinary Imperium from these highlands.',
    startingRelationship: 38,
    startingInfrastructure: 30,
    startingLocalSupport: 0,
    baseGoldOutput: 5,
    baseImperiumOutput: 5,
    nodeX: 0.570,
    nodeY: 0.570,
    clientIds: ['samnite_gladiator_trainer'],
    npcRoleHolder: {
      name: 'P. Papirius',
      clanId: 'clan-papiria',
      trait: 'negligent',
      policy: { taxation: 'standard', security: 'light_patrol', development: 'neglect' },
    },
    namedWar: 'Samnite Unrest',
    threatWeight: 1.1,
  },
  {
    id: 'campania',
    name: 'Campania',
    latinName: 'Campania',
    map: 'italy',
    status: 'incorporated',
    profile: 'Wealthy agricultural plain. High Gold output, sensitive to over-taxation.',
    flavorDescription:
      'The richest farmland in Italy — volcanic soil, abundant harvests, and prosperous cities on the Tyrrhenian coast. Campanians are sophisticated, commercially minded, and quick to compare their treatment to that of their neighbours. A benevolent hand here fills the treasury with grain and Gold alike.',
    startingRelationship: 68,
    startingInfrastructure: 60,
    startingLocalSupport: 0,
    baseGoldOutput: 12,
    baseImperiumOutput: 1,
    nodeX: 0.400,
    nodeY: 0.640,
    clientIds: ['campanian_grain_factor'],
    npcRoleHolder: {
      name: 'A. Atilius',
      clanId: 'clan-atilia',
      trait: 'corrupt',
      policy: { taxation: 'heavy', security: 'standard_garrison', development: 'exploit' },
    },
  },
];

// ─── Sicily Province Definitions (Military Overhaul M10) ────────────────────
// DEVIATION FROM THE PLAN TEXT (documented per the plan's own §0 instruction):
// the plan's M10 treaty terms cede "western Sicily / all Sicily" to Rome, but
// no Mediterranean-map province existed anywhere in this file before M10 —
// ProvinceMap's 'mediterranean'/'east' values were pure type-level future-
// proofing with zero content. Design discussion during M10 chose to add real
// ProvinceDefinition/ProvinceState entries (not a flag-only stub) so a ceded
// Sicily is actually governable through the existing province system.
//
// There is still no Mediterranean map art asset, and MapView.tsx has no
// per-map switching — so these two provinces are overlaid onto the existing
// map_italia.png near its southern edge (nodeY 0.90–0.96), a deliberate
// geographic approximation, not a claim that Sicily is part of the Italian
// peninsula. They render through MapView's existing `if (!province) return
// null` guard, which already skips any def with no matching ProvinceState —
// so simply NOT including them in buildInitialProvinceStates() below is
// sufficient to keep them invisible ("Carthage still holds this") until the
// M10 treaty engine (warEngine.ts's applyTreatyEffects) pushes a ProvinceState
// for them onto state.provinces at cession time. See MapView.tsx's own
// comment at its province-list import for the render-side half of this.
export const SICILY_PROVINCES: ProvinceDefinition[] = [
  {
    id: 'sicily_west',
    name: 'Western Sicily',
    latinName: 'Sicilia Occidentalis',
    map: 'mediterranean',
    status: 'unincorporated',
    profile: 'Freshly ceded Carthaginian territory. Low Relationship, high strategic value.',
    flavorDescription:
      'Punic towns and Greek cities along the western coast, wrested from Carthage at the negotiating table rather than by long occupation. The population remembers whose fleet used to call here — governing it well will take patience the legions cannot supply on their own.',
    startingRelationship: 22,
    startingInfrastructure: 15,
    startingLocalSupport: 0,
    baseGoldOutput: 7,
    baseImperiumOutput: 2,
    nodeX: 0.380,
    nodeY: 0.920,
    clientIds: [],
    npcRoleHolder: {
      name: 'Q. Sicinius',
      clanId: 'clan-sicinia',
      trait: 'negligent',
      policy: { taxation: 'standard', security: 'standard_garrison', development: 'neglect' },
    },
    namedWar: 'Sicilian Unrest',
    threatWeight: 1.3,
  },
  {
    id: 'sicily_east',
    name: 'Eastern Sicily',
    latinName: 'Sicilia Orientalis',
    map: 'mediterranean',
    status: 'unincorporated',
    profile: 'Freshly ceded Carthaginian territory. Grain-rich, distant from Rome.',
    flavorDescription:
      "Syracuse and the island's Greek east — the granary that made Sicily worth fighting over in the first place. Only reachable once Carthage has quit the whole island; a province this rich will draw governors looking to make a fortune fast.",
    startingRelationship: 18,
    startingInfrastructure: 12,
    startingLocalSupport: 0,
    baseGoldOutput: 10,
    baseImperiumOutput: 1,
    nodeX: 0.500,
    nodeY: 0.955,
    clientIds: [],
    npcRoleHolder: {
      name: 'M. Laevinus',
      clanId: 'clan-laevinia',
      trait: 'corrupt',
      policy: { taxation: 'heavy', security: 'light_patrol', development: 'exploit' },
    },
    namedWar: 'Sicilian Unrest',
    threatWeight: 1.3,
  },
];

// Latium is special — heartland, never in the governable pool
export function isGovernable(provinceId: string): boolean {
  return provinceId !== 'latium';
}

export function getProvinceDefinition(id: string): ProvinceDefinition | undefined {
  return [...ITALY_PROVINCES, ...SICILY_PROVINCES].find(p => p.id === id);
}

// Build initial ProvinceState from definitions
import type { ProvinceState } from '../models/province';

/** Single-definition → ProvinceState builder, extracted in M10 so the treaty
 *  engine (warEngine.ts's applyTreatyEffects) can reuse it when adding a
 *  ceded Sicily province mid-game, not just at buildInitialProvinceStates'
 *  game-start call site. */
export function buildProvinceState(def: ProvinceDefinition): ProvinceState {
  return {
    id: def.id,
    map: def.map,
    status: def.status,
    relationshipScore: def.startingRelationship,
    internalStability: def.id === 'latium' ? 100 : 70,
    infrastructureRating: def.startingInfrastructure,
    localSupport: def.startingLocalSupport,
    playerGovernor: null,
    playerAmbassador: null,
    npcRoleHolder: def.id === 'latium' ? null : def.npcRoleHolder,
    ownedAssets: [],
    incorporationBillAvailable: false,
    warDeclarationAvailable: false,
    revoltActive: false,
    activeCampaign: null,
    officerVolunteer: null,
    // ── Crisis track inputs (Chunk 2A) ────────────────────────────────────
    infraStagnationSeasons: 0,
    lastInfraScore: def.startingInfrastructure,
  };
}

export function buildInitialProvinceStates(): ProvinceState[] {
  // Sicily is deliberately excluded — it only enters state.provinces when
  // ceded via the M10 treaty engine (see SICILY_PROVINCES' header comment).
  return ITALY_PROVINCES.map(buildProvinceState);
}
