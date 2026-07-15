import {
  tickProvince,
  checkForeignWarDeclarations,
  getForeignWarTargetEnemyId,
  buildDeclareWarBill,
  getDeclareWarBillName,
  buildAmbassadorPostingBill,
  getAmbassadorPostingBillName,
} from '../src/engine/provinceEngine';
import { applyEffectString } from '../src/engine/resourceEngine';
import { buildInitialProvinceStates, getProvinceDefinition } from '../src/data/provinceDefinitions';
import type { ProvinceState, AmbassadorState } from '../src/models/province';
import type { WarState } from '../src/models/war';
import type { GameState } from '../src/state/gameStore';

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
    provinces: [], senateResponse: null,
    activeCanvassingEvent: null, canvassingEventResult: null,
    pendingCanvassLeaderId: null, pendingCanvassRoll: 0, pendingCanvassThreshold: 0,
    npcConsul: null,
    tribuneHolder: null, tribuneImmunity: false, tribuneSeasonsServed: 0, tribuneHostilityDebt: {},
    lastOfficeActionResult: null,
    consulAuthorityActive: false, consulAuthoritySeasonsRemaining: 0, npcTribuneActive: false,
    activeCampaignExists: false, familyHasTroops: false, anyProvinceHasRoads: false,
    triumphBillInQueue: false, npcConsulExists: false, consultatumUsedThisTerm: false,
    senatePacked: false, dictatorOverstaySeasons: 0,
    wars: [] as WarState[],
  };
  return { ...base, ...overrides } as unknown as GameState;
}

function findState(id: string): ProvinceState {
  const found = buildInitialProvinceStates().find(p => p.id === id);
  if (!found) throw new Error(`no province state for ${id}`);
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

// ─── Foreign relationship drift (chunk WD-A) ────────────────────────────────

describe('tickProvince — foreign relationship drift', () => {
  test('still produces zero economic deltas for a foreign province', () => {
    const carthage = findState('carthage');
    const result = tickProvince(carthage, 0, 0);
    expect(result.goldDelta).toBe(0);
    expect(result.imperiumDelta).toBe(0);
    expect(result.corruptionDelta).toBe(0);
    expect(result.treasuryDelta).toBe(0);
  });

  test('drift stays within −2..+2 and clamps at 100', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1); // pushes drift to its max (+2)
    const carthage = findState('carthage');
    const nearMax = { ...carthage, relationshipScore: 99 };
    const result = tickProvince(nearMax, 0, 0);
    expect(result.updatedProvince.relationshipScore).toBeLessThanOrEqual(100);
  });

  test('drift clamps at 0', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // pushes drift to its min (−2)
    const carthage = findState('carthage');
    const nearMin = { ...carthage, relationshipScore: 1 };
    const result = tickProvince(nearMin, 0, 0);
    expect(result.updatedProvince.relationshipScore).toBeGreaterThanOrEqual(0);
  });

  test('a foreign province with no playerAmbassador has none after ticking', () => {
    const carthage = findState('carthage');
    const result = tickProvince(carthage, 0, 0);
    expect(result.updatedProvince.playerAmbassador).toBeNull();
  });
});

// ─── AI war declaration (chunk WD-B) ────────────────────────────────────────

describe('getForeignWarTargetEnemyId', () => {
  test('Carthage-owned provinces all resolve to \'carthage\'', () => {
    for (const id of ['carthage', 'lilybaeum', 'alalia', 'olbia', 'sulci', 'tripolitania']) {
      const def = getProvinceDefinition(id)!;
      expect(getForeignWarTargetEnemyId(def)).toBe('carthage');
    }
  });

  test('an independent province resolves to its own id', () => {
    const def = getProvinceDefinition('syracuse')!;
    expect(getForeignWarTargetEnemyId(def)).toBe('syracuse');
  });
});

describe('checkForeignWarDeclarations', () => {
  test('never fires against a client (Numidia), even if forced hostile', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // would always "succeed" if rolled at all
    const numidia = { ...findState('numidia'), relationshipScore: 5 }; // hostile tier
    const state = makeState({ provinces: [numidia] });
    const { newWars, events } = checkForeignWarDeclarations([numidia], state);
    expect(newWars).toEqual([]);
    expect(events).toEqual([]);
  });

  test('does not fire when relations are not hostile', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const carthage = { ...findState('carthage'), relationshipScore: 60 }; // cooperative, not hostile
    const state = makeState({ provinces: [carthage] });
    const { newWars } = checkForeignWarDeclarations([carthage], state);
    expect(newWars).toEqual([]);
  });

  test('skips a power already at active war with Rome', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const carthage = { ...findState('carthage'), relationshipScore: 5 };
    const existingWar: WarState = {
      id: 'war-carthage-1', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
      warScore: 0, startedTurn: 1, lastSetPieceTurn: -1, weariness: 0,
      pendingSetPiece: null, treaty: null,
      phase: 'opening', ignitedYear: -264, endedYear: null, terminalOutcome: null,
      peaceOffered: false, lastFundingOfferTurn: -100,
    };
    const state = makeState({ provinces: [carthage], wars: [existingWar] });
    const { newWars } = checkForeignWarDeclarations([carthage], state);
    expect(newWars).toEqual([]);
  });

  test('de-dupes multiple Carthage-owned provinces to a single roll/power', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.99); // always "fail" the chance roll
    const provinces = [
      { ...findState('carthage'), relationshipScore: 5 },
      { ...findState('lilybaeum'), relationshipScore: 5 },
      { ...findState('alalia'), relationshipScore: 5 },
    ];
    const state = makeState({ provinces });
    const randomSpy = jest.spyOn(Math, 'random');
    checkForeignWarDeclarations(provinces, state);
    // Only one roll should have been attempted for the shared 'carthage' enemyId,
    // not one per province.
    expect(randomSpy).toHaveBeenCalledTimes(1);
  });

  test('fires and constructs a valid major WarState when the roll succeeds', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // always succeeds
    const syracuse = { ...findState('syracuse'), relationshipScore: 5 };
    const state = makeState({ provinces: [syracuse], turnNumber: 42, year: -250 });
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
  test('targets \'carthage\' for a Carthage-owned province and reuses the startWar token', () => {
    const lilybaeum = findState('lilybaeum');
    const def = getProvinceDefinition('lilybaeum')!;
    const bill = buildDeclareWarBill(lilybaeum, def);
    expect(bill.name).toBe(getDeclareWarBillName(def));
    expect(bill.passEffect).toContain('startWar:carthage:major:');
    expect(bill.playerSubmitted).toBe(true);
  });

  test('targets its own id for an independent province', () => {
    const syracuse = findState('syracuse');
    const def = getProvinceDefinition('syracuse')!;
    const bill = buildDeclareWarBill(syracuse, def);
    expect(bill.passEffect).toContain('startWar:syracuse:major:');
  });
});

// ─── Ambassador posting bill + assignment token (chunk WD-D) ───────────────

describe('buildAmbassadorPostingBill / assignAmbassador token', () => {
  test('bill name embeds both character and province', () => {
    const campania = findState('campania');
    const def = getProvinceDefinition('campania')!;
    const bill = buildAmbassadorPostingBill(campania, def, 'pc-1', 'Marcus');
    expect(bill.name).toBe(getAmbassadorPostingBillName(def, 'Marcus'));
    expect(bill.passEffect).toBe(`assignAmbassador:campania:pc-1`);
  });

  test('applyEffectString assigns a fresh playerAmbassador on the matching province', () => {
    const campania = { ...findState('campania'), status: 'unincorporated' as const };
    const state = makeState({ provinces: [campania] });
    const patch = applyEffectString('assignAmbassador:campania:pc-1', state);
    const updated = patch.provinces?.find(p => p.id === 'campania');
    expect(updated?.playerAmbassador).toEqual({
      characterId: 'pc-1',
      personalRapport: 0,
      turnsServed: 0,
      actionsUsedThisTurn: [],
      intelRevealed: 0,
    });
  });

  test('works on a foreign province too (WD-D reverses the no-Ambassador-for-foreign invariant)', () => {
    const lilybaeum = findState('lilybaeum');
    const state = makeState({ provinces: [lilybaeum] });
    const patch = applyEffectString('assignAmbassador:lilybaeum:pc-1', state);
    const updated = patch.provinces?.find(p => p.id === 'lilybaeum');
    expect(updated?.playerAmbassador?.characterId).toBe('pc-1');
  });
});

// ─── Ambassador term-limit ticking (chunk WD-D) ─────────────────────────────

describe('tickProvince — playerAmbassador term limit', () => {
  test('increments turnsServed each season on a Roman unincorporated province', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 0 }),
    };
    const result = tickProvince(campania, 0, 0);
    expect(result.updatedProvince.playerAmbassador?.turnsServed).toBe(1);
  });

  test('increments turnsServed each season on a foreign province', () => {
    const lilybaeum = { ...findState('lilybaeum'), playerAmbassador: makeAmbassador({ turnsServed: 3 }) };
    const result = tickProvince(lilybaeum, 0, 0);
    expect(result.updatedProvince.playerAmbassador?.turnsServed).toBe(4);
  });

  test('resets actionsUsedThisTurn and decays personalRapport by 1 each season', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 0, personalRapport: 10, actionsUsedThisTurn: ['grain_dole'] }),
    };
    const result = tickProvince(campania, 0, 0);
    expect(result.updatedProvince.playerAmbassador?.actionsUsedThisTurn).toEqual([]);
    expect(result.updatedProvince.playerAmbassador?.personalRapport).toBe(9);
  });

  test('warns at 7 seasons served but keeps the posting active', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 6 }),
    };
    const result = tickProvince(campania, 0, 0);
    expect(result.updatedProvince.playerAmbassador).not.toBeNull();
    expect(result.updatedProvince.playerAmbassador?.turnsServed).toBe(7);
    expect(result.events.some(e => e.includes('term ends this season'))).toBe(true);
  });

  test('ends the posting at 8 seasons served', () => {
    const campania = {
      ...findState('campania'),
      status: 'unincorporated' as const,
      playerAmbassador: makeAmbassador({ turnsServed: 7 }),
    };
    const result = tickProvince(campania, 0, 0);
    expect(result.updatedProvince.playerAmbassador).toBeNull();
    expect(result.events.some(e => e.includes('term concluded'))).toBe(true);
  });

  test('ends the posting at 8 seasons served on a foreign province too', () => {
    const lilybaeum = { ...findState('lilybaeum'), playerAmbassador: makeAmbassador({ turnsServed: 7 }) };
    const result = tickProvince(lilybaeum, 0, 0);
    expect(result.updatedProvince.playerAmbassador).toBeNull();
  });
});
