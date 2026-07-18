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
    borderPoints: [
      { x: 0.523, y: 0.377 },
      { x: 0.559, y: 0.360 },
      { x: 0.501, y: 0.340 },
      { x: 0.479, y: 0.318 },
      { x: 0.427, y: 0.310 },
      { x: 0.393, y: 0.329 },
    ],
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
    borderPoints: [
      { x: 0.399, y: 0.325 },
      { x: 0.429, y: 0.310 },
      { x: 0.453, y: 0.313 },
      { x: 0.517, y: 0.249 },
      { x: 0.437, y: 0.199 },
      { x: 0.437, y: 0.156 },
      { x: 0.242, y: 0.189 },
      { x: 0.286, y: 0.213 },
      { x: 0.292, y: 0.238 },
      { x: 0.296, y: 0.258 },
      { x: 0.328, y: 0.288 },
    ],
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
    borderPoints: [
      { x: 0.513, y: 0.249 },
      { x: 0.559, y: 0.308 },
      { x: 0.599, y: 0.325 },
      { x: 0.559, y: 0.357 },
      { x: 0.503, y: 0.340 },
      { x: 0.481, y: 0.318 },
      { x: 0.449, y: 0.309 },
    ],
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
    borderPoints: [
      { x: 0.531, y: 0.384 },
      { x: 0.563, y: 0.363 },
      { x: 0.632, y: 0.353 },
      { x: 0.670, y: 0.396 },
      { x: 0.623, y: 0.436 },
    ],
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
    borderPoints: [
      { x: 0.234, y: 0.187 },
      { x: 0.198, y: 0.178 },
      { x: 0.156, y: 0.206 },
      { x: 0.134, y: 0.168 },
      { x: 0.136, y: 0.140 },
      { x: 0.180, y: 0.116 },
      { x: 0.278, y: 0.091 },
      { x: 0.397, y: 0.083 },
      { x: 0.417, y: 0.103 },
      { x: 0.439, y: 0.152 },
    ],
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
    borderPoints: [
      { x: 0.362, y: 0.527 },
      { x: 0.385, y: 0.510 },
      { x: 0.417, y: 0.510 },
      { x: 0.435, y: 0.521 },
      { x: 0.529, y: 0.515 },
      { x: 0.567, y: 0.514 },
      { x: 0.541, y: 0.555 },
      { x: 0.551, y: 0.574 },
      { x: 0.529, y: 0.601 },
      { x: 0.487, y: 0.590 },
      { x: 0.469, y: 0.567 },
      { x: 0.421, y: 0.563 },
    ],
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
    borderPoints: [
      { x: 0.210, y: 0.443 },
      { x: 0.121, y: 0.446 },
      { x: 0.115, y: 0.330 },
      { x: 0.174, y: 0.258 },
      { x: 0.214, y: 0.245 },
      { x: 0.224, y: 0.280 },
    ],
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
    borderPoints: [
      { x: 0.091, y: 0.616 },
      { x: 0.186, y: 0.595 },
      { x: 0.208, y: 0.616 },
      { x: 0.248, y: 0.610 },
      { x: 0.254, y: 0.632 },
      { x: 0.274, y: 0.653 },
      { x: 0.385, y: 0.653 },
      { x: 0.668, y: 0.705 },
      { x: 0.668, y: 0.790 },
      { x: 0.095, y: 0.819 },
    ],
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
