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
    owner: 'rome',
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
    owner: 'rome',
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
    owner: 'rome',
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
    owner: 'rome',
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
    owner: 'rome',
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

// ─── Mediterranean Province Definitions ──────────────────────────────────────
// First Punic War theatre: Sicily, Corsica, Sardinia, and the African coast.
// All status: 'foreign' — held by Carthage, an independent Greek/Italic power,
// or (Numidia) a Carthaginian client. None are governable; Rome has no
// Governor/Ambassador presence until a province flips via conquestFlag.
//
// Map art note: there is no dedicated Mediterranean map asset yet. These nodes
// are rendered on the existing map_italia.png. Corsica, Sardinia, and the NE
// tip of Sicily are actually drawn on that image, so those nodes sit on their
// real landmasses. Agrigentum, Lilybaeum, Syracuse (the rest of Sicily) and
// the three African provinces are off the drawn frame — their nodeX/nodeY
// place them in open sea/parchment margin in roughly the right compass
// direction as a placeholder until a proper Mediterranean map ships.
export const MEDITERRANEAN_PROVINCES: ProvinceDefinition[] = [
  {
    id: 'messana',
    name: 'Messana',
    latinName: 'Messana',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'independent',
    conquestFlag: 'messanaJoinsRome',
    profile: 'Mamertine-held city on the Strait. The flashpoint — appeals to Rome for protection.',
    flavorDescription:
      'A band of Campanian mercenaries — the Mamertines, "sons of Mars" — seized this city years ago and have held it since, squeezed now between Syracuse and Carthage. They have sent envoys to Rome asking for help. Answering them means a fleet, and likely a war with Carthage none has yet dared to start.',
    startingRelationship: 45,
    startingInfrastructure: 35,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.559,
    nodeY: 0.821,
    clientIds: [],
    npcRoleHolder: {
      name: 'Mamertine garrison council',
      clanId: '',
      trait: 'negligent',
      policy: { taxation: 'standard', security: 'light_patrol', development: 'neglect' },
    },
    namedWar: 'Mamertine Crisis',
    threatWeight: 1.4,
  },
  {
    id: 'syracuse',
    name: 'Syracuse',
    latinName: 'Syracusae',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'independent',
    profile: 'Greek kingdom under Hiero II. Wealthy, pragmatic — could ally with Rome or Carthage.',
    flavorDescription:
      "Hiero II rules the wealthiest and best-defended city in Sicily from behind Archimedes' engineering and a fleet that commands the Ionian coast. He has not yet chosen a side in the quarrel over Messana, and he watches Rome's next move as carefully as Carthage's.",
    startingRelationship: 50,
    startingInfrastructure: 65,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.615,
    nodeY: 0.891,
    clientIds: [],
    npcRoleHolder: {
      name: 'Hiero II',
      clanId: '',
      trait: 'competent',
      policy: { taxation: 'light', security: 'heavy_garrison', development: 'invest' },
    },
  },
  {
    id: 'agrigentum',
    name: 'Agrigentum',
    latinName: 'Agrigentum',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'independent',
    profile: 'Greek polis on the south coast. Rich, exposed, and contested by every power in reach.',
    flavorDescription:
      'Once among the grandest of the Greek cities of Sicily, Agrigentum sits on the exposed southern coast, its temples visible for miles out to sea. It has changed hands before and expects to again — the only question is who comes for it first.',
    startingRelationship: 40,
    startingInfrastructure: 50,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.484,
    nodeY: 0.905,
    clientIds: [],
    npcRoleHolder: {
      name: 'Agrigentine assembly',
      clanId: '',
      trait: 'honest',
      policy: { taxation: 'standard', security: 'standard_garrison', development: 'maintain' },
    },
  },
  {
    id: 'lilybaeum',
    name: 'Lilybaeum',
    latinName: 'Lilybaeum',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'carthage',
    profile: "Carthage's principal Sicilian stronghold. Heavily fortified, the gateway to Africa.",
    flavorDescription:
      "Carthage built this fortress-port on Sicily's western tip to command the narrow crossing to Africa, and has garrisoned it ever since. Its walls have never fallen to a siege. Whoever holds Lilybaeum holds the key to Sicily.",
    startingRelationship: 20,
    startingInfrastructure: 60,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.353,
    nodeY: 0.905,
    clientIds: [],
    npcRoleHolder: {
      name: 'Carthaginian garrison command',
      clanId: '',
      trait: 'competent',
      policy: { taxation: 'heavy', security: 'full_occupation', development: 'maintain' },
    },
    namedWar: 'Sicilian Standoff',
    threatWeight: 1.3,
  },
  {
    id: 'alalia',
    name: 'Alalia',
    latinName: 'Alalia',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'carthage',
    profile: 'Carthaginian outpost on Corsica. Timber, iron, and little else — held for the harbour.',
    flavorDescription:
      "A modest Carthaginian trading post on Corsica's eastern coast, valued for its harbour and the iron and timber of the interior tribes rather than for any wealth of its own.",
    startingRelationship: 25,
    startingInfrastructure: 30,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.247,
    nodeY: 0.476,
    clientIds: [],
    npcRoleHolder: {
      name: 'Carthaginian factor',
      clanId: '',
      trait: 'negligent',
      policy: { taxation: 'standard', security: 'light_patrol', development: 'neglect' },
    },
  },
  {
    id: 'olbia',
    name: 'Olbia',
    latinName: 'Olbia',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'carthage',
    profile: 'Carthaginian port on north-east Sardinia. Grain and a fleet anchorage.',
    flavorDescription:
      "Sardinia's grain feeds Carthage as much as it feeds anyone, and this northern port is where much of it is loaded. A useful anchorage for any fleet working the western sea.",
    startingRelationship: 25,
    startingInfrastructure: 35,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.237,
    nodeY: 0.597,
    clientIds: [],
    npcRoleHolder: {
      name: 'Carthaginian factor',
      clanId: '',
      trait: 'corrupt',
      policy: { taxation: 'heavy', security: 'standard_garrison', development: 'exploit' },
    },
  },
  {
    id: 'sulci',
    name: 'Sulci',
    latinName: 'Sulci',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'carthage',
    profile: 'Carthaginian port on south-west Sardinia. Silver and lead from the interior mines.',
    flavorDescription:
      "The southern anchor of Carthage's hold on Sardinia, built on an islet close enough to the mainland to load the silver and lead worked out of the interior mines by conscripted native labour.",
    startingRelationship: 25,
    startingInfrastructure: 35,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.192,
    nodeY: 0.718,
    clientIds: [],
    npcRoleHolder: {
      name: 'Carthaginian factor',
      clanId: '',
      trait: 'corrupt',
      policy: { taxation: 'heavy', security: 'standard_garrison', development: 'exploit' },
    },
  },
  {
    id: 'carthage',
    name: 'Carthage',
    latinName: 'Carthago',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'carthage',
    profile: "Rome's great rival. A merchant empire's capital — never a Roman province in this era.",
    flavorDescription:
      'The greatest port city of the western sea, ringed by triple walls and fed by a merchant fleet that touches every shore from Iberia to the Levant. Carthage does not fear Rome. Not yet.',
    startingRelationship: 15,
    startingInfrastructure: 85,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.565,
    nodeY: 0.942,
    clientIds: [],
    npcRoleHolder: {
      name: 'The Carthaginian Senate',
      clanId: '',
      trait: 'competent',
      policy: { taxation: 'standard', security: 'heavy_garrison', development: 'invest' },
    },
    namedWar: 'Punic Rivalry',
    threatWeight: 1.5,
  },
  {
    id: 'numidia',
    name: 'Numidia',
    latinName: 'Numidia',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'independent',
    clientOf: 'carthage',
    profile: 'Berber kingdom, client to Carthage rather than its territory. Famed cavalry.',
    flavorDescription:
      "The Numidian kings rule the high plains west of Carthage in their own right, bound to their powerful neighbour by treaty and tribute rather than conquest. Their light cavalry is the finest in the western world, and every general in this sea would rather have them as friends than as enemies.",
    startingRelationship: 40,
    startingInfrastructure: 25,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.464,
    nodeY: 0.956,
    clientIds: [],
    npcRoleHolder: {
      name: 'The Numidian court',
      clanId: '',
      trait: 'honest',
      policy: { taxation: 'light', security: 'light_patrol', development: 'neglect' },
    },
  },
  {
    id: 'tripolitania',
    name: 'Tripolitania',
    latinName: 'Tripolitania',
    map: 'mediterranean',
    status: 'foreign',
    owner: 'carthage',
    profile: "Carthage's eastern coastal holding. Distant, arid, of little interest to Rome yet.",
    flavorDescription:
      "A string of Carthaginian coastal towns on the edge of the Libyan desert, valued for trade with the interior caravans more than for the thin strip of arable land behind them. Rome has no reason to look here — yet.",
    startingRelationship: 30,
    startingInfrastructure: 30,
    startingLocalSupport: 0,
    baseGoldOutput: 0,
    baseImperiumOutput: 0,
    nodeX: 0.665,
    nodeY: 0.942,
    clientIds: [],
    npcRoleHolder: {
      name: 'Carthaginian factor',
      clanId: '',
      trait: 'negligent',
      policy: { taxation: 'standard', security: 'light_patrol', development: 'neglect' },
    },
  },
];

// All province definitions, across all maps.
export const ALL_PROVINCES: ProvinceDefinition[] = [...ITALY_PROVINCES, ...MEDITERRANEAN_PROVINCES];

// Latium is special — heartland, never in the governable pool.
// 'foreign' provinces (Carthaginian/independent territory) are likewise never governable
// until a conquestFlag flips them to Roman ownership — at that point their status changes
// to 'unincorporated' and this check (which reads live status, not the static definition)
// picks that up automatically.
export function isGovernable(provinceId: string): boolean {
  if (provinceId === 'latium') return false;
  const def = getProvinceDefinition(provinceId);
  return !!def && def.status !== 'foreign';
}

export function getProvinceDefinition(id: string): ProvinceDefinition | undefined {
  return ALL_PROVINCES.find(p => p.id === id);
}

// Build initial ProvinceState from definitions
import type { ProvinceState } from '../models/province';

export function buildInitialProvinceStates(): ProvinceState[] {
  return ALL_PROVINCES.map(def => ({
    id: def.id,
    map: def.map,
    status: def.status,
    owner: def.owner,
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
    officerVolunteer: null,          // was missing from original — added here
    // ── Crisis track inputs (Chunk 2A) ────────────────────────────────────
    infraStagnationSeasons: 0,
    lastInfraScore: def.startingInfrastructure,
  }));
}
