import type { CityClientDefinition } from '../models/city';

// ─── City Client Definitions ─────────────────────────────────────────────────
// Italy-relevant clients for the v1 Italy map.
// All 12 are defined here (others will activate when their maps unlock).

export const CITY_CLIENT_DEFINITIONS: CityClientDefinition[] = [
  {
    id: 'samnite_gladiator_trainer',
    name: 'Vergilius the Samnite',
    provinceId: 'samnium',
    supportRequired: 30,
    relationshipRequired: 35,
    bonusDescription: '+3 Martial to assigned character. Gladiator School assets upgrade for 15% less Gold.',
    skillBonus: { martial: 3 },
    specialAbility: 'gladiator_school_discount',
  },
  {
    id: 'etruscan_augur',
    name: 'Vel Saties, Augur',
    provinceId: 'etruria',
    supportRequired: 40,
    relationshipRequired: 50,
    bonusDescription: '+3 Auctoritas. Once per year, reroll one unfavourable Senate vote result.',
    skillBonus: { auctoritas: 3 },
    specialAbility: 'senate_vote_reroll',
  },
  {
    id: 'campanian_grain_factor',
    name: 'M. Herennius, Factor',
    provinceId: 'campania',
    supportRequired: 25,
    relationshipRequired: 35,
    bonusDescription: '+6 Gold/turn. Rome\'s grain stability stat benefits passively.',
    resourceBonus: { goldPerTurn: 6 },
    specialAbility: 'rome_grain_stability_bonus',
  },
  {
    id: 'gallic_chieftains_son',
    name: 'Ambiorix of the Insubres',
    provinceId: 'cisalpine_gaul',
    supportRequired: 50,
    relationshipRequired: 55,
    bonusDescription: '+5 Martial. Campaigns in Gaul gain +10 Local Support bonus automatically.',
    skillBonus: { martial: 5 },
    specialAbility: 'gaul_campaign_support',
  },
  // ── Future map clients (locked until Mediterranean/East maps unlock) ─────
  {
    id: 'greek_philosopher',
    name: 'Demetrios of Athens',
    provinceId: 'macedonia',
    supportRequired: 50,
    relationshipRequired: 60,
    bonusDescription: '+4 Rhetoric to assigned character per turn. Unlocks Study Philosophy action in Domus.',
    skillBonus: { rhetoric: 4 },
    specialAbility: 'study_philosophy_action',
  },
  {
    id: 'macedonian_wrestling_coach',
    name: 'Kratinos the Macedonian',
    provinceId: 'macedonia',
    supportRequired: 30,
    relationshipRequired: 40,
    bonusDescription: '+3 Martial to assigned character. Young characters gain \'Athletic\' trait if trained 2+ years.',
    skillBonus: { martial: 3 },
    specialAbility: 'athletic_trait_grant',
  },
  {
    id: 'numidian_cavalry_officer',
    name: 'Jugurtha\'s Nephew',
    provinceId: 'africa',
    supportRequired: 40,
    relationshipRequired: 50,
    bonusDescription: '+5 Martial. Unlocks elite Numidian auxiliary option in campaigns.',
    skillBonus: { martial: 5 },
    specialAbility: 'numidian_auxiliary_option',
  },
  {
    id: 'carthaginian_merchant',
    name: 'Hanno bar-Barca',
    provinceId: 'africa',
    supportRequired: 35,
    relationshipRequired: 45,
    bonusDescription: '+10 Gold/turn. +2 Corruption resistance. Unlocks trade route event pool.',
    resourceBonus: { goldPerTurn: 10 },
    specialAbility: 'trade_route_events',
  },
  {
    id: 'hispanian_silver_merchant',
    name: 'Rectugenos of Contrebia',
    provinceId: 'hispania_citerior',
    supportRequired: 35,
    relationshipRequired: 40,
    bonusDescription: '+8 Gold/turn. Mining Rights assets cost 20% less.',
    resourceBonus: { goldPerTurn: 8 },
    specialAbility: 'mining_rights_discount',
  },
  {
    id: 'iberian_cavalry_trainer',
    name: 'Indibilis the Ilergete',
    provinceId: 'hispania_ulterior',
    supportRequired: 30,
    relationshipRequired: 35,
    bonusDescription: '+4 Martial. Campaign cavalry allocation options improve.',
    skillBonus: { martial: 4 },
    specialAbility: 'cavalry_allocation_upgrade',
  },
  {
    id: 'asian_court_advisor',
    name: 'Mithridates\' Counsellor',
    provinceId: 'asia_minor',
    supportRequired: 60,
    relationshipRequired: 65,
    bonusDescription: '+4 Intrigus, +3 Gratia/turn. Unlocks Eastern Intelligence action: spy on any clan leader once per year.',
    skillBonus: { intrigus: 4 },
    resourceBonus: { gratiaPerTurn: 3 },
    specialAbility: 'eastern_intelligence_action',
  },
  {
    id: 'hellenistic_architect',
    name: 'Hermogenes of Priene',
    provinceId: 'asia_minor',
    supportRequired: 45,
    relationshipRequired: 55,
    bonusDescription: 'Development axis costs -20% Gold. Infrastructure rating builds 25% faster.',
    specialAbility: 'infrastructure_accelerator',
  },
];

export function getCityClientDef(id: string): CityClientDefinition | undefined {
  return CITY_CLIENT_DEFINITIONS.find(c => c.id === id);
}

export function getClientsForCity(provinceId: string): CityClientDefinition[] {
  return CITY_CLIENT_DEFINITIONS.filter(c => c.provinceId === provinceId);
}
