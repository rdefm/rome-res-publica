import {
  tickCity,
  calcCityGoldOutput,
  isGovernable,
  applyCityFlips,
  checkForeignWarDeclarations,
  getForeignWarTargetEnemyId,
  buildDeclareWarBill,
  getDeclareWarBillName,
  buildAmbassadorPostingBill,
  getAmbassadorPostingBillName,
  resolveCityEventEffect,
  rollCityEventTick,
  calcCityAssetBonuses,
} from '../src/engine/cityEngine';
import { applyEffectString } from '../src/engine/resourceEngine';
import { buildInitialCityStates, getCityDefinition } from '../src/data/cityDefinitions';
import type { CityState, AmbassadorState, GovernorState, GovernorPolicy } from '../src/models/city';
import type { WarState } from '../src/models/war';
import type { GameState } from '../src/state/gameStore';

const STANDARD_POLICY: GovernorPolicy = {
  taxation: 'standard',
  security: 'standard_garrison',
  development: 'maintain',
};

// ─── Fixtures (mirrors warEngine.test.ts's pattern) ─────────────────────────

function makeCrisisTrack(id: string, level: number) {
  return { id, level, tier: 0, namedCrisis: null } as const;
}
const CRISIS_ALL_ZERO = {
  war: makeCrisisTrack('war', 0),
  unrest: makeCrisisTrack('unrest', 0),
  constitution: makeCrisisTrack('constitution', 0),
  economy: makeCrisisTrack('economy', 0),
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  const base = {
    year: -264, turnNumber: 10, seasonIndex: 0,
    fides: 60, denarii: 300, imperium: 0,
    lifetimeDignitas: 20, lifetimeImperium: 60,
    popularesRel: 0, optimatesRel: 0,
    rome: { stability: 50, plebs: 60, treasury: 50 },
    crisisLevel: 0, crisis: CRISIS_ALL_ZERO,
    flags: {},
    family: [],
    selectedCharacterId: 'pc-1', trainedThisSeason: [],
    bills: [], _expandedBill: null, _expandedType: null, billIdSeq: 0,
    clans: [], expandedClanId: null, selectedLeaderId: null,
    currentOffice: null, officeSeasons: 0, heldOffices: [], campaigning: null,
    campaigningCharacterId: null, campaignVotes: {}, electionRivals: [], pendingAmbitionScopes: [],
    clients: [], ownedAssets: [], ambitions: [], legacyObjectives: [],
    patronTier: 0, trialQueue: [], familyReputations: {},
    activeLaws: [], passedBills: [],
    pendingEvents: [], activeEvent: null, pendingBirthNaming: null,
    log: [], cursusLog: [],
    seasonOverlayVisible: false, seasonOverlayEvents: [],
    cities: [], senateResponse: null,
    activeCanvassingEvent: null, canvassingEventResult: null,
    pendingCanvassLeaderId: null, pendingCanvassRoll: 0, pendingCanvassThreshold: 0,
    npcConsul: null,
    tribuneHolder: null, tribuneImmunity: false, tribuneSeasonsServed: 0, tribuneHostilityDebt: {},
    lastOfficeActionResult: null,
    consulAuthorityActive: false, consulAuthoritySeasonsRemaining: 0, npcTribuneActive: false,
    activeCampaignExists: false, familyHasTroops: false, anyCityHasRoads: false,
    triumphBillInQueue: false, npcConsulExists: false, consultatumUsedThisTerm: false,
    senatePacked: false, dictatorOverstaySeasons: 0,
    wars: [] as WarState[],
  };
  return { ...base, ...overrides } as unknown as GameState;
}

function findState(id: string): CityState {
  const found = buildInitialCityStates().find(p => p.id === id);
  if (!found) throw new Error(`no city state for ${id}`);
  return found;
}

function makeAmbassador(overrides: Partial<AmbassadorState> = {}): AmbassadorState {
  return {
    characterId: 'pc-1',
    personalRapport: 20,
    turnsServed: 0,
    actionsUsedThisTurn: ['build_rapport'],
    intelRevealed: 2,
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Foreign city model basics (Mediterranean plan, chunk MP-G) ────────────

describe('cityEngine — foreign city handling', () => {
  test('foreign cities start with owner set from their definition', () => {
    const carthage = findState('carthage');
    const messana = findState('messana');
    const numidia = findState('numidia');
    expect(carthage.owner).toBe('carthage');
    expect(carthage.status).toBe('foreign');
    expect(messana.owner).toBe('independent');
    expect(numidia.owner).toBe('independent');
    expect(getCityDefinition('numidia')?.clientOf).toBe('carthage');
  });

  test('isGovernable is false for foreign cities and latium, true for a normal city', () => {
    expect(isGovernable(findState('carthage'))).toBe(false);
    expect(isGovernable(findState('lilybaeum'))).toBe(false);
    expect(isGovernable(findState('latium'))).toBe(false);
    expect(isGovernable(findState('campania'))).toBe(true);
  });

  test('isGovernable reads live status — a flipped foreign city becomes governable', () => {
    const flipped = applyCityFlips(buildInitialCityStates(), { messanaJoinsRome: true }).cities;
    const messana = flipped.find(p => p.id === 'messana')!;
    expect(isGovernable(messana)).toBe(true);
  });

  test('calcCityGoldOutput returns 0 for a foreign city regardless of policy', () => {
    const lilybaeum = findState('lilybaeum');
    expect(calcCityGoldOutput(lilybaeum, STANDARD_POLICY, 5)).toBe(0);
  });
});

// ─── Foreign relationship drift (chunk WD-A) ────────────────────────────────

describe('tickCity — foreign relationship drift', () => {
  test('still produces zero economic deltas for a foreign city', () => {
    const carthage = findState('carthage');
    const result = tickCity(carthage, 0, 0);
    expect(result.goldDelta).toBe(0);
    expect(result.imperiumDelta).toBe(0);
    expect(result.corruptionDelta).toBe(0);
    expect(result.treasuryDelta).toBe(0);
  });

  test('drift stays within −2..+2 and clamps at 100', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1); // pushes drift to its max (+2)
    const carthage = findState('carthage');
    const nearMax = { ...carthage, relationshipScore: 99 };
    const result = tickCity(nearMax, 0, 0);
    expect(result.updatedCity.relationshipScore).toBeLessThanOrEqual(100);
  });

  test('drift clamps at 0', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // pushes drift to its min (−2)
    const carthage = findState('carthage');
    const nearMin = { ...carthage, relationshipScore: 1 };
    const result = tickCity(nearMin, 0, 0);
    expect(result.updatedCity.relationshipScore).toBeGreaterThanOrEqual(0);
  });

  test('a foreign city with no playerAmbassador has none after ticking', () => {
    const carthage = findState('carthage');
    const result = tickCity(carthage, 0, 0);
    expect(result.updatedCity.playerAmbassador).toBeNull();
  });
});

// ─── AI war declaration (chunk WD-B) ────────────────────────────────────────

describe('getForeignWarTargetEnemyId', () => {
  test('Carthage-owned cities all resolve to \'carthage\'', () => {
    for (const id of ['carthage', 'lilybaeum', 'alalia', 'olbia', 'sulci', 'tripolitania']) {
      const def = getCityDefinition(id)!;
      expect(getForeignWarTargetEnemyId(def)).toBe('carthage');
    }
  });

  test('an independent city resolves to its own id', () => {
    const def = getCityDefinition('syracuse')!;
    expect(getForeignWarTargetEnemyId(def)).toBe('syracuse');
  });
});

describe('checkForeignWarDeclarations', () => {
  test('never fires against a client (Numidia), even if forced hostile', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // would always "succeed" if rolled at all
    const numidia = { ...findState('numidia'), relationshipScore: 5 }; // hostile tier
    const state = makeState({ cities: [numidia] });
    const { newWars, events } = checkForeignWarDeclarations([numidia], state);
    expect(newWars).toEqual([]);
    expect(events).toEqual([]);
  });

  test('does not fire when relations are not hostile', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const carthage = { ...findState('carthage'), relationshipScore: 60 }; // cooperative, not hostile
    const state = makeState({ cities: [carthage] });
    const { newWars } = checkForeignWarDeclarations([carthage], state);
    expect(newWars).toEqual([]);
  });

  test('skips a power already at active war with Rome', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const carthage = { ...findState('carthage'), relationshipScore: 5 };
    const existingWar: WarState = {
      id: 'war-carthage-1', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
      warScore: 0, startedTurn: 1, weariness: 0, enemyWeariness: 0, momentum: 0,
      treaty: null,
      phase: 'opening', ignitedYear: -264, endedYear: null, terminalOutcome: null,
      peaceOffered: false, lastFundingOfferTurn: -100,
    };
    const state = makeState({ cities: [carthage], wars: [existingWar] });
    const { newWars } = checkForeignWarDeclarations([carthage], state);
    expect(newWars).toEqual([]);
  });

  test('de-dupes multiple Carthage-owned cities to a single roll/power', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // always "fail" the chance roll
    const cities = [
      { ...findState('carthage'), relationshipScore: 5 },
      { ...findState('lilybaeum'), relationshipScore: 5 },
      { ...findState('alalia'), relationshipScore: 5 },
    ];
    const state = makeState({ cities });
    const randomSpy = jest.spyOn(Math, 'random');
    checkForeignWarDeclarations(cities, state);
    // Only one roll should have been attempted for the shared 'carthage' enemyId,
    // not one per city.
    expect(randomSpy).toHaveBeenCalledTimes(1);
  });

  test('fires and constructs a valid major WarState when the roll succeeds', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // always succeeds
    const syracuse = { ...findState('syracuse'), relationshipScore: 5 };
    const state = makeState({ cities: [syracuse], turnNumber: 42, year: -250 });
    const { newWars, events } = checkForeignWarDeclarations([syracuse], state);
    expect(newWars).toHaveLength(1);
    expect(newWars[0].enemyId).toBe('syracuse');
    expect(newWars[0].active).toBe(true);
    expect(newWars[0].scale).toBe('major');
    expect(newWars[0].startedTurn).toBe(42);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatch(/Syracuse/);
  });
});

// ─── Player-initiated declare-war bill (chunk WD-C) ─────────────────────────

describe('buildDeclareWarBill', () => {
  test('targets \'carthage\' for a Carthage-owned city and reuses the startWar token', () => {
    const lilybaeum = findState('lilybaeum');
    const def = getCityDefinition('lilybaeum')!;
    const bill = buildDeclareWarBill(lilybaeum, def);
    expect(bill.name).toBe(getDeclareWarBillName(def));
    expect(bill.passEffect).toContain('startWar:carthage:major:');
    expect(bill.playerSubmitted).toBe(true);
  });

  test('targets its own id for an independent city', () => {
    const syracuse = findState('syracuse');
    const def = getCityDefinition('syracuse')!;
    const bill = buildDeclareWarBill(syracuse, def);
    expect(bill.passEffect).toContain('startWar:syracuse:major:');
  });
});

// ─── Ambassador posting bill + assignment token (chunk WD-D) ───────────────

describe('buildAmbassadorPostingBill / assignAmbassador token', () => {
  test('bill name embeds both character and city', () => {
    const campania = findState('campania');
    const def = getCityDefinition('campania')!;
    const bill = buildAmbassadorPostingBill(campania, def, 'pc-1', 'Marcus');
    expect(bill.name).toBe(getAmbassadorPostingBillName(def, 'Marcus'));
    expect(bill.passEffect).toBe(`assignAmbassador:campania:pc-1`);
  });

  test('applyEffectString assigns a fresh playerAmbassador on the matching city', () => {
    const campania = { ...findState('campania'), status: 'unincorporated' as const };
    const state = makeState({ cities: [campania] });
    const patch = applyEffectString('assignAmbassador:campania:pc-1', state);
    const updated = patch.cities?.find(p => p.id === 'campania');
    expect(updated?.playerAmbassador).toEqual({
      characterId: 'pc-1',
      personalRapport: 0,
      turnsServed: 0,
      actionsUsedThisTurn: [],
      intelRevealed: 0,
    });
  });

  test('works on a foreign city too (WD-D reverses the no-Ambassador-for-foreign invariant)', () => {
    const lilybaeum = findState('lilybaeum');
    const state = makeState({ cities: [lilybaeum] });
    const patch = applyEffectString('assignAmbassador:lilybaeum:pc-1', state);
    const updated = patch.cities?.find(p => p.id === 'lilybaeum');
    expect(updated?.playerAmbassador?.characterId).toBe('pc-1');
  });
});

// ─── Ambassador term-limit ticking (chunk WD-D) ─────────────────────────────

describe('tickCity — playerAmbassador term limit', () => {
  test('increments turnsServed each season on a Roman unincorporated city', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 0 }),
    };
    const result = tickCity(campania, 0, 0);
    expect(result.updatedCity.playerAmbassador?.turnsServed).toBe(1);
  });

  test('increments turnsServed each season on a foreign city', () => {
    const lilybaeum = { ...findState('lilybaeum'), playerAmbassador: makeAmbassador({ turnsServed: 3 }) };
    const result = tickCity(lilybaeum, 0, 0);
    expect(result.updatedCity.playerAmbassador?.turnsServed).toBe(4);
  });

  test('resets actionsUsedThisTurn and decays personalRapport by 1 each season', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 0, personalRapport: 10, actionsUsedThisTurn: ['grain_dole'] }),
    };
    const result = tickCity(campania, 0, 0);
    expect(result.updatedCity.playerAmbassador?.actionsUsedThisTurn).toEqual([]);
    expect(result.updatedCity.playerAmbassador?.personalRapport).toBe(9);
  });

  test('warns at 7 seasons served but keeps the posting active', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 6 }),
    };
    const result = tickCity(campania, 0, 0);
    expect(result.updatedCity.playerAmbassador).not.toBeNull();
    expect(result.updatedCity.playerAmbassador?.turnsServed).toBe(7);
    expect(result.events.some(e => e.includes('term ends this season'))).toBe(true);
  });

  test('ends the posting at 8 seasons served', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 7 }),
    };
    const result = tickCity(campania, 0, 0);
    expect(result.updatedCity.playerAmbassador).toBeNull();
    expect(result.events.some(e => e.includes('term concluded'))).toBe(true);
  });

  test('ends the posting at 8 seasons served on a foreign city too', () => {
    const lilybaeum = { ...findState('lilybaeum'), playerAmbassador: makeAmbassador({ turnsServed: 7 }) };
    const result = tickCity(lilybaeum, 0, 0);
    expect(result.updatedCity.playerAmbassador).toBeNull();
  });
});

// ─── applyCityFlips — conquest/defection (Mediterranean plan, chunk MP-C/MP-G) ──

describe('cityEngine — applyCityFlips (conquest/defection)', () => {
  test('leaves cities alone when their conquestFlag is not set', () => {
    const cities = buildInitialCityStates();
    const { cities: result, events } = applyCityFlips(cities, {});
    expect(events).toEqual([]);
    const messana = result.find(p => p.id === 'messana')!;
    expect(messana.owner).toBe('independent');
    expect(messana.status).toBe('foreign');
  });

  test('flips Messana to Rome when messanaJoinsRome flag is truthy', () => {
    const cities = buildInitialCityStates();
    const { cities: result, events } = applyCityFlips(cities, { messanaJoinsRome: true });
    const messana = result.find(p => p.id === 'messana')!;
    expect(messana.owner).toBe('rome');
    expect(messana.status).toBe('unincorporated');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatch(/Messana/);

    const carthage = result.find(p => p.id === 'carthage')!;
    expect(carthage.owner).toBe('carthage');
    expect(carthage.status).toBe('foreign');
  });

  test('is idempotent — a city already owned by Rome is left alone even if its flag is still set', () => {
    const cities = buildInitialCityStates();
    const first = applyCityFlips(cities, { messanaJoinsRome: true }).cities;
    const { cities: second, events } = applyCityFlips(first, { messanaJoinsRome: true });
    expect(events).toEqual([]);
    const messana = second.find(p => p.id === 'messana')!;
    expect(messana.status).toBe('unincorporated');
  });

  test('a flipped city ticks normally afterward (falls into the unincorporated pathway)', () => {
    const cities = buildInitialCityStates();
    const flipped = applyCityFlips(cities, { messanaJoinsRome: true }).cities;
    const messana = flipped.find(p => p.id === 'messana')!;
    const result = tickCity(messana, 0, 0);
    expect(result.updatedCity.status).toBe('unincorporated');
  });
});

// ─── resolveCityEventEffect (July 2026 fixes, Chunk D) ──────────────────────

describe('resolveCityEventEffect', () => {
  const city = findState('syracuse');

  test('applies rel/localSupport/infra as clamped absolute city values', () => {
    const result = resolveCityEventEffect('rel:+8,localSupport:+10,infra:-5', city);
    expect(result.cityPatch.relationshipScore).toBe(city.relationshipScore + 8);
    expect(result.cityPatch.localSupport).toBe(city.localSupport + 10);
    expect(result.cityPatch.infrastructureRating).toBe(city.infrastructureRating - 5);
  });

  test('clamps rel to [0, 100]', () => {
    const hot = { ...city, relationshipScore: 95 };
    const result = resolveCityEventEffect('rel:+20', hot);
    expect(result.cityPatch.relationshipScore).toBe(100);

    const cold = { ...city, relationshipScore: 5 };
    const result2 = resolveCityEventEffect('rel:-20', cold);
    expect(result2.cityPatch.relationshipScore).toBe(0);
  });

  test('routes corruption to corruptionDelta, not cityPatch', () => {
    const result = resolveCityEventEffect('corruption:+10,rel:+3', city);
    expect(result.corruptionDelta).toBe(10);
    expect((result.cityPatch as any).corruption).toBeUndefined();
  });

  test('routes gold/fides/imperium/lifetimeDignitas to resourcePatch', () => {
    const result = resolveCityEventEffect('gold:+40,fides:+5,imperium:+2,lifetimeDignitas:+8', city);
    expect(result.resourcePatch).toEqual({ denarii: 40, fides: 5, imperium: 2, lifetimeDignitas: 8 });
  });

  test('ignores unmatched/malformed tokens rather than throwing', () => {
    expect(() => resolveCityEventEffect('garbage,rel:notanumber,', city)).not.toThrow();
  });
});

// ─── rollCityEventTick (July 2026 fixes, Chunk D) ───────────────────────────

describe('rollCityEventTick', () => {
  function makeGovernor(overrides: Partial<GovernorState> = {}): GovernorState {
    return {
      characterId: 'pc-1',
      policy: STANDARD_POLICY,
      corruptionAccrued: 0,
      turnsServed: 0,
      ...overrides,
    };
  }

  test('never fires when a city event is already active', () => {
    const cities = [{ ...findState('etruria'), playerGovernor: makeGovernor() }];
    jest.spyOn(Math, 'random').mockReturnValue(0); // would always hit if checked
    const result = rollCityEventTick(cities, true);
    expect(result).toBeNull();
  });

  test('never fires for a city with neither a governor nor an ambassador', () => {
    const cities = [findState('etruria')];
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = rollCityEventTick(cities, false);
    expect(result).toBeNull();
  });

  test('fires a governor-pool card for a governed city on a hit roll', () => {
    const cities = [{ ...findState('etruria'), playerGovernor: makeGovernor() }];
    jest.spyOn(Math, 'random').mockReturnValue(0); // < tickChance, and picks pool[0]
    const result = rollCityEventTick(cities, false);
    expect(result).not.toBeNull();
    expect(result!.cityId).toBe('etruria');
  });

  test('fires an ambassador-pool card for an ambassador-posted city on a hit roll', () => {
    const cities = [{ ...findState('syracuse'), playerAmbassador: makeAmbassador() }];
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const result = rollCityEventTick(cities, false);
    expect(result).not.toBeNull();
    expect(result!.cityId).toBe('syracuse');
  });

  test('does not fire when the roll misses', () => {
    const cities = [{ ...findState('etruria'), playerGovernor: makeGovernor() }];
    jest.spyOn(Math, 'random').mockReturnValue(0.999); // >= tickChance
    const result = rollCityEventTick(cities, false);
    expect(result).toBeNull();
  });
});

// ─── calcCityAssetBonuses (July 2026 fixes, Chunk E) ────────────────────────
// Replaces the old single-field calcAssetGoldOutput/calcAssetFidesOutput now
// that province assets share Latium's 3-tier AssetDefinition/AssetBonus
// shape (models/asset.ts) instead of their own 2-tier CityAssetDefinition.

describe('calcCityAssetBonuses', () => {
  test('returns an empty object for a city with no owned assets', () => {
    const city = { ...findState('campania'), ownedAssets: [] };
    expect(calcCityAssetBonuses(city)).toEqual({});
  });

  test('reads the tier matching currentTier, not always tier 1', () => {
    const city = {
      ...findState('campania'),
      ownedAssets: [{ definitionId: 'latifundium', currentTier: 2 as const, turnAcquired: 0 }],
    };
    expect(calcCityAssetBonuses(city).gold).toBe(12); // latifundium tier 2
  });

  test('sums bonuses across multiple owned assets, including different fields', () => {
    const city = {
      ...findState('campania'),
      ownedAssets: [
        { definitionId: 'latifundium', currentTier: 1 as const, turnAcquired: 0 },       // gold: 6
        { definitionId: 'temple_patronage', currentTier: 1 as const, turnAcquired: 0 },  // fides: 3, relationshipPerTurn: 2
      ],
    };
    const total = calcCityAssetBonuses(city);
    expect(total.gold).toBe(6);
    expect(total.fides).toBe(3);
    expect(total.relationshipPerTurn).toBe(2);
  });

  test('a negative relationshipPerTurn (Mining Rights) is preserved, not clamped away', () => {
    const city = {
      ...findState('etruria'),
      ownedAssets: [{ definitionId: 'mining_rights', currentTier: 1 as const, turnAcquired: 0 }],
    };
    expect(calcCityAssetBonuses(city).relationshipPerTurn).toBe(-3);
  });

  test('ignores an owned asset whose definitionId no longer resolves', () => {
    const city = {
      ...findState('campania'),
      ownedAssets: [{ definitionId: 'not-a-real-asset', currentTier: 1 as const, turnAcquired: 0 }],
    };
    expect(() => calcCityAssetBonuses(city)).not.toThrow();
    expect(calcCityAssetBonuses(city)).toEqual({});
  });
});
