import type { Region, Edge } from '../models/theatre';

// ─── Theatre Map Dataset ────────────────────────────────────────────────────
// Campaign Map plan, Chunk C1. 8 regions — coarser than the plan's original
// 14-region sketch, because the sketch invented regions (Picenum, Apulia,
// Bruttium, Panormus) with no backing city anywhere in the codebase. Rather
// than fabricate new cities to fill them, the region list was collapsed to
// match what real city data actually supports: Italy's four incorporated
// cities plus Cisalpine Gaul each keep their own single-city region, while
// Sicily/Sardinia/Africa — where multiple existing cities already sit — each
// become one multi-city region. See the implementing chat's design
// discussion (2026-07) for the full reasoning; nothing here is scripted
// content, just a grouping of pre-existing data.

export const REGIONS: Region[] = [
  {
    id: 'latium',
    name: 'Latium',
    displayNameLatin: 'Latium',
    terrainId: 'open_plain',
    coastal: true,
    cityIds: ['latium'],
    baseManpower: 10,
    startingController: 'rome',
  },
  {
    id: 'etruria',
    name: 'Etruria',
    displayNameLatin: 'Etruria',
    terrainId: 'rough_hills',
    coastal: true,
    cityIds: ['etruria'],
    baseManpower: 6,
    startingController: 'rome',
  },
  {
    id: 'samnium',
    name: 'Samnium',
    displayNameLatin: 'Samnium',
    terrainId: 'rough_hills',
    coastal: false,
    cityIds: ['samnium'],
    baseManpower: 8,
    startingController: 'rome',
  },
  {
    id: 'campania',
    name: 'Campania',
    displayNameLatin: 'Campania',
    terrainId: 'open_plain',
    coastal: true,
    cityIds: ['campania'],
    baseManpower: 8,
    startingController: 'rome',
  },
  {
    id: 'cisalpine_gaul',
    name: 'Cisalpine Gaul',
    displayNameLatin: 'Gallia Cisalpina',
    terrainId: 'open_plain',
    coastal: false,
    cityIds: ['cisalpine_gaul'],
    baseManpower: 7,
    startingController: 'rome',
  },
  {
    id: 'sicilia',
    name: 'Sicily',
    displayNameLatin: 'Sicilia',
    terrainId: 'coastal_plain',
    coastal: true,
    cityIds: ['messana', 'syracuse', 'agrigentum', 'lilybaeum'],
    baseManpower: 6,
    // No single power holds Sicily at game start — Messana/Syracuse/
    // Agrigentum are independent, Lilybaeum is Carthage's fortress. 'neutral'
    // is the honest read of a contested island, not a design placeholder.
    startingController: 'neutral',
  },
  {
    id: 'sardinia',
    name: 'Sardinia & Corsica',
    displayNameLatin: 'Sardinia et Corsica',
    terrainId: 'rough_hills',
    coastal: true,
    cityIds: ['alalia', 'olbia', 'sulci'],
    baseManpower: 4,
    startingController: 'carthage',
  },
  {
    id: 'africa',
    name: 'Africa',
    displayNameLatin: 'Africa',
    terrainId: 'coastal_plain',
    coastal: true,
    // Numidia is a Carthaginian client (independent, not Carthaginian soil —
    // see CityDefinition.clientOf) but sits in this region geographically;
    // included for relationship-averaging purposes even though it doesn't
    // change the region's startingController.
    cityIds: ['carthage', 'numidia', 'tripolitania'],
    baseManpower: 5,
    startingController: 'carthage',
  },
];

// Land edges — the Italian mainland chain, Latium as the hub.
// Strait edge — the historical Bruttium crossing point isn't its own region
// here (no city backs it), so the crossing is modelled from Campania, the
// southernmost Italian region this dataset has. Costs like land, no storm
// risk (the plan's own invariant for strait crossings).
// Sea edges — laneRisk seeds are first-pass/unverified, C10 tunes.
export const THEATRE_EDGES: Edge[] = [
  { a: 'latium', b: 'etruria', kind: 'land' },
  { a: 'latium', b: 'campania', kind: 'land' },
  { a: 'latium', b: 'samnium', kind: 'land' },
  { a: 'campania', b: 'samnium', kind: 'land' },
  { a: 'etruria', b: 'cisalpine_gaul', kind: 'land' },

  { a: 'campania', b: 'sicilia', kind: 'strait' },

  { a: 'latium', b: 'sardinia', kind: 'sea', laneRisk: 0.15 },
  { a: 'etruria', b: 'sardinia', kind: 'sea', laneRisk: 0.15 },
  { a: 'campania', b: 'africa', kind: 'sea', laneRisk: 0.25 },
  { a: 'sicilia', b: 'africa', kind: 'sea', laneRisk: 0.20 },
  { a: 'sicilia', b: 'sardinia', kind: 'sea', laneRisk: 0.20 },
  { a: 'sardinia', b: 'africa', kind: 'sea', laneRisk: 0.20 },
];
