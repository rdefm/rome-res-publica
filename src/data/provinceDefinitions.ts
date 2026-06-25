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

// Latium is special — heartland, never in the governable pool
export function isGovernable(provinceId: string): boolean {
  return provinceId !== 'latium';
}

export function getProvinceDefinition(id: string): ProvinceDefinition | undefined {
  return ITALY_PROVINCES.find(p => p.id === id);
}

// Build initial ProvinceState from definitions
import type { ProvinceState } from '../models/province';

export function buildInitialProvinceStates(): ProvinceState[] {
  return ITALY_PROVINCES.map(def => ({
    id: def.id,
    map: def.map,
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
  }));
}
