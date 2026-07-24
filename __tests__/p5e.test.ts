// ─── Phase 5, Chunk P5-E — The Alternate Starting Families ──────────────────
// Covers: ALT_FAMILIES unlock predicates, startGame's stateOverrides wiring
// (the previously-documented-but-unused mechanism) for all four StartIds,
// the Claudius starting Secret's universality, the gensId/gensName/
// gensSurname/gensPlural threading through generateCadet/resolveDeathNotice/
// promoteCadetToParterfamilias/generateCommanderCandidates/
// tickSenateResponse, the new 'brother'/'sister' Character.role (and its
// correct exclusion from heir order), and save-load's gensId default-spread.

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useGameStore, INITIAL_STATE } from '../src/state/gameStore';
import { processSeason } from '../src/engine/turnSequencer';
import * as fs from 'fs';
import * as path from 'path';
import { ALT_FAMILIES } from '../src/data/altFamilies';
import { getHeirOrder, generateCadet, promoteCadetToParterfamilias } from '../src/engine/inheritanceEngine';
import { resolveDeathNotice } from '../src/data/cadetEvents';
import { generateCommanderCandidates } from '../src/engine/campaignEngine';
import { tickSenateResponse } from '../src/engine/senateResponseEngine';
import { buildAncestorRecord } from '../src/engine/epilogueEngine';
import { assembleHistorianParagraph } from '../src/data/epilogueText';
import type { AncestorRecord } from '../src/models/epilogue';
import type { Character } from '../src/models/character';
import type { CadetBranch, PendingSuccession } from '../src/models/character';

// ─── ALT_FAMILIES unlock predicates ──────────────────────────────────────────

function makeRecord(overrides: Partial<AncestorRecord> = {}): AncestorRecord {
  return {
    id: 'r-1', gensName: 'Brutia', foundedYear: -264, endedYear: -250,
    outcome: 'exhaustion', finalLegacy: 10, legacyPenaltyApplied: false,
    highestOffice: null, generations: 1, notableBeats: [], familyTree: [],
    historianParagraph: 'x', recordedAt: 1,
    ...overrides,
  };
}

describe('ALT_FAMILIES — unlock predicates', () => {
  test('Duilia unlocks with any completed run', () => {
    expect(ALT_FAMILIES.duilia.isUnlocked([])).toBe(false);
    expect(ALT_FAMILIES.duilia.isUnlocked([makeRecord({ outcome: 'gens_ends' })])).toBe(true);
    expect(ALT_FAMILIES.duilia.isUnlocked([makeRecord({ outcome: 'victory' })])).toBe(true);
  });

  test('Manlia unlocks only with a Victory outcome somewhere in the Hall', () => {
    expect(ALT_FAMILIES.manlia.isUnlocked([])).toBe(false);
    expect(ALT_FAMILIES.manlia.isUnlocked([makeRecord({ outcome: 'humbled' })])).toBe(false);
    expect(ALT_FAMILIES.manlia.isUnlocked([makeRecord({ outcome: 'exhaustion' }), makeRecord({ outcome: 'humbled' })])).toBe(false);
    expect(ALT_FAMILIES.manlia.isUnlocked([makeRecord({ outcome: 'humbled' }), makeRecord({ outcome: 'victory' })])).toBe(true);
  });

  test('Manlia paterfamilias starts with elevated but sub-trial-risk corruption', () => {
    const manlius = ALT_FAMILIES.manlia.family.find(c => c.isPlayer)!;
    expect(manlius.corruptionScore).toBeGreaterThan(0);
    expect(manlius.corruptionScore).toBeLessThan(60); // trialEngine.CORRUPTION_TRIAL_THRESHOLD
  });

  test('neither alt family crosses Patron Tier 1 (lifetimeDignitas >= 30) at start', () => {
    expect(ALT_FAMILIES.duilia.lifetimeDignitas).toBeLessThan(30);
    expect(ALT_FAMILIES.manlia.lifetimeDignitas).toBeLessThan(30);
  });

  test('Duilia includes a brother (role) among its starting family, not a misrepresented son', () => {
    const brother = ALT_FAMILIES.duilia.family.find(c => c.role === 'brother');
    expect(brother).toBeDefined();
    expect(brother!.skills.intrigus).toBeGreaterThanOrEqual(7); // "high-intrigus"
  });
});

// ─── startGame — stateOverrides wiring ──────────────────────────────────────

describe('gameStore.startGame — alternate family stateOverrides', () => {
  test('brutii (default/standard) matches INITIAL_STATE gens identity', () => {
    useGameStore.getState().startGame('standard');
    const s = useGameStore.getState();
    expect(s.gensId).toBe('brutii');
    expect(s.gensSurname).toBe('Brutus');
    expect(s.gensName).toBe('Brutia');
    expect(s.gensPlural).toBe('Brutii');
    expect(s.denarii).toBe(INITIAL_STATE.denarii);
    expect(s.log[0].text).toContain('The Brutii begin their ascent');
  });

  test('guided start is always brutii regardless of any override attempt', () => {
    useGameStore.getState().startGame('guided');
    const s = useGameStore.getState();
    expect(s.gensId).toBe('brutii');
    expect(s.tutorialQueue.length).toBeGreaterThan(0); // guided script populated
  });

  test('duilia start applies the full stateOverrides bundle', () => {
    useGameStore.getState().startGame('duilia');
    const s = useGameStore.getState();
    expect(s.gensId).toBe('duilia');
    expect(s.gensSurname).toBe('Duilius');
    expect(s.gensName).toBe('Duilia');
    expect(s.gensPlural).toBe('Duilii');
    expect(s.denarii).toBe(ALT_FAMILIES.duilia.denarii);
    expect(s.fides).toBe(ALT_FAMILIES.duilia.fides);
    expect(s.lifetimeDignitas).toBe(ALT_FAMILIES.duilia.lifetimeDignitas);
    expect(s.familyReputations).toEqual(ALT_FAMILIES.duilia.familyReputations);
    expect(s.ownedAssets).toEqual(ALT_FAMILIES.duilia.ownedAssets);
    expect(s.family.find(c => c.isPlayer)?.name).toBe('Gaius Duilius');
    expect(s.log[0].text).toContain('The Duilii begin their ascent');
  });

  test('manlia start applies the full stateOverrides bundle including corruption', () => {
    useGameStore.getState().startGame('manlia');
    const s = useGameStore.getState();
    expect(s.gensId).toBe('manlia');
    expect(s.gensPlural).toBe('Manlii');
    expect(s.family.find(c => c.isPlayer)?.name).toBe('Titus Manlius');
    expect(s.family.find(c => c.isPlayer)?.corruptionScore).toBe(BALANCE_ALT_MANLIA_CORRUPTION());
    expect(s.familyReputations.fabii).toBeLessThan(0);
    expect(s.familyReputations.claudii).toBeLessThan(0);
    expect(s.familyReputations.valerii).toBeGreaterThan(0);
  });

  test('the Claudius starting Secret exists at start for all three families (not overridden)', () => {
    for (const startId of ['standard', 'duilia', 'manlia'] as const) {
      useGameStore.getState().startGame(startId);
      const s = useGameStore.getState();
      expect(s.secrets.some(sec => sec.id === 'secret-claudius-arc')).toBe(true);
    }
  });

  test('the Philon "new house" notice fires only for alternate families, not Brutii', () => {
    useGameStore.getState().startGame('standard');
    expect(useGameStore.getState().pendingEvents.some(e => e.defId === 'evt-new-house-notice')).toBe(false);

    useGameStore.getState().startGame('duilia');
    expect(useGameStore.getState().pendingEvents.some(e => e.defId === 'evt-new-house-notice')).toBe(true);

    useGameStore.getState().startGame('manlia');
    expect(useGameStore.getState().pendingEvents.some(e => e.defId === 'evt-new-house-notice')).toBe(true);
  });

  test('cadetBranch is generated with the correct gens name per family', () => {
    useGameStore.getState().startGame('duilia');
    expect(useGameStore.getState().cadetBranch?.name).toContain('Duilia');

    useGameStore.getState().startGame('manlia');
    expect(useGameStore.getState().cadetBranch?.name).toContain('Manlia');
  });
});

function BALANCE_ALT_MANLIA_CORRUPTION(): number {
  // Local re-import avoided at top-level to keep this file's import list
  // focused on what's under test; BALANCE is cheap to pull in once here.
  return require('../src/data/balance').BALANCE.altFamilies.manlia.startingCorruption;
}

// ─── save/load — gensId default-spread ──────────────────────────────────────

describe('gameStore.loadGame — gensId default-spread for pre-P5-E saves', () => {
  test('a save with no gens fields at all loads as brutii', () => {
    const legacySave: any = {
      ...INITIAL_STATE,
      family: [{ id: 'pc-1', name: 'Marcus Brutus', isPlayer: true, role: 'paterfamilias' }],
    };
    delete legacySave.gensId;
    delete legacySave.gensSurname;
    delete legacySave.gensName;
    delete legacySave.gensPlural;

    useGameStore.getState().loadGame(legacySave);
    const s = useGameStore.getState();
    expect(s.gensId).toBe('brutii');
    expect(s.gensSurname).toBe('Brutus');
    expect(s.gensName).toBe('Brutia');
    expect(s.gensPlural).toBe('Brutii');
  });

  test('a save that already has gens fields (a Duilia run) preserves them on load', () => {
    const duiliaSave: any = {
      ...INITIAL_STATE,
      family: [{ id: 'pc-1', name: 'Gaius Duilius', isPlayer: true, role: 'paterfamilias' }],
      gensId: 'duilia', gensSurname: 'Duilius', gensName: 'Duilia', gensPlural: 'Duilii',
    };
    useGameStore.getState().loadGame(duiliaSave);
    const s = useGameStore.getState();
    expect(s.gensId).toBe('duilia');
    expect(s.gensPlural).toBe('Duilii');
  });
});

// ─── gens-name threading through previously-hardcoded functions ────────────

describe('gens-neutrality sweep — spot checks on previously-hardcoded functions', () => {
  test('generateCadet uses the passed gensName, not a hardcoded one', () => {
    const cadet = generateCadet('Duilia');
    expect(cadet.name).toContain('Duilia');
    expect(cadet.name).not.toContain('Brutia');
  });

  test('resolveDeathNotice threads gensName into the no-heir dead-end body', () => {
    const p: PendingSuccession = {
      deceasedId: 'pc-1', deceasedName: 'Gaius Duilius', deceasedAge: 70,
      rememberedDetail: 'a shrewd merchant', eligibleHeirIds: [],
    };
    const result = resolveDeathNotice(p, null, true, 10, 'Duilia');
    expect(result.notice.bodyText).toContain('Gens Duilia');
    expect(result.pendingEpilogue).toBe('gens_ends');
  });

  test('resolveDeathNotice threads gensName into the cadet-offer body via generateCadet', () => {
    const p: PendingSuccession = {
      deceasedId: 'pc-1', deceasedName: 'Titus Manlius', deceasedAge: 68,
      rememberedDetail: 'a disgraced patrician', eligibleHeirIds: [],
    };
    const result = resolveDeathNotice(p, null, false, 10, 'Manlia');
    expect(result.notice.bodyText).toContain('Gens Manlia');
    expect(result.cadetBranch?.name).toContain('Manlia');
  });

  test('promoteCadetToParterfamilias reads gensName from state, not hardcoded', () => {
    const cadet: CadetBranch = {
      id: 'cadet-1', name: 'Marcus Duilia', age: 40,
      skills: { rhetoric: 4, martial: 4, intrigus: 4 }, trait: 'cautious',
      characterization: 'x', metCount: 0, standing: 50, alive: true,
    };
    const state = { ...INITIAL_STATE, gensName: 'Duilia', family: [] } as any;
    const patch = promoteCadetToParterfamilias(cadet, state);
    const spouse = (patch.family as Character[]).find(c => c.role === 'spouse');
    expect(spouse?.name).toContain('Duilia');
  });

  test('generateCommanderCandidates reads clan identity from state.gensId/gensPlural', () => {
    const state = {
      ...INITIAL_STATE, gensId: 'manlia', gensPlural: 'Manlii',
      clans: [], family: [{ id: 'pc-1', name: 'Titus Manlius', isPlayer: true, age: 45, officeId: null, skills: { martial: 7 } }],
    } as any;
    const candidates = generateCommanderCandidates('some-province', state);
    const familyCandidate = candidates.find(c => c.isPlayerFamily);
    expect(familyCandidate?.clanId).toBe('manlia');
    expect(familyCandidate?.clanName).toBe('Manlii');
  });

  test('tickSenateResponse\'s censure bill description reads state.gensPlural', () => {
    const state = {
      ...INITIAL_STATE, gensPlural: 'Duilii', turnNumber: 5,
      senateResponse: { active: true, phase: null, debateSuppressed: false, ignoredLevies: 0 },
      consulAuthorityActive: false,
    } as any;
    const patch: any = tickSenateResponse(state);
    const bill = (patch.bills ?? []).find((b: any) => b?.type === 'censure');
    if (bill) {
      expect(bill.description).toContain('Duilii');
      expect(bill.description).not.toContain('Brutii');
    }
  });
});

// ─── historian paragraph / epilogue record ──────────────────────────────────

describe('epilogue record + historian paragraph render the actual gens name', () => {
  test('buildAncestorRecord reads gensName/gensId from state for a non-Brutii run', () => {
    const state = {
      ...INITIAL_STATE, gensId: 'manlia', gensName: 'Manlia',
      turnNumber: 40, year: -250, gensFoundedYear: -264,
      lifetimeDignitas: 50, legacyPenaltyMult: 1, highestOfficeEverHeld: null,
      heldOffices: [], paterfamiliasGenerations: 1, family: [],
    } as any;
    const record = buildAncestorRecord(state, 'gens_ends');
    expect(record.gensName).toBe('Manlia');
    expect(record.gensId).toBe('manlia');
    // The 'gens_ends' opener was found un-interpolated during the sweep —
    // confirm it now actually contains the real name, not literal 'Brutia'.
    expect(record.historianParagraph).toContain('Manlia');
    expect(record.historianParagraph).not.toContain('Brutia');
  });

  test('assembleHistorianParagraph interpolates {gensName} for every outcome, including gens_ends', () => {
    const base = {
      id: 'r', foundedYear: -264, endedYear: -255, finalLegacy: 10,
      legacyPenaltyApplied: false, highestOffice: null, generations: 1,
      notableBeats: [], familyTree: [],
    };
    for (const outcome of ['victory', 'exhaustion', 'humbled', 'republic_falls', 'gens_ends'] as const) {
      const text = assembleHistorianParagraph({ ...base, outcome, gensName: 'Duilia' } as any);
      expect(text).toContain('Duilia');
      expect(text).not.toContain('Brutia');
    }
  });
});

// ─── Character.role — 'brother'/'sister' ────────────────────────────────────

describe("Character.role 'brother'/'sister' (P5-E)", () => {
  test('getHeirOrder never includes a sibling — allowlists son/daughter/spouse explicitly', () => {
    const family: Character[] = [
      { id: 'pc-1', name: 'Gaius Duilius', role: 'paterfamilias' } as Character,
      { id: 'npc-brother', name: 'Lucius Duilius', role: 'brother', age: 35 } as Character,
      { id: 'npc-son', name: 'Quintus Duilius', role: 'son', age: 14 } as Character,
    ];
    const order = getHeirOrder(family, 'pc-1');
    expect(order.some(c => c.role === 'brother')).toBe(false);
    expect(order.some(c => c.id === 'npc-son')).toBe(true);
  });
});

// ─── both alt families boot and survive several auto-played seasons ───────

describe('Duilia and Manlia — 4 auto-played seasons without crashing', () => {
  test.each(['duilia', 'manlia'] as const)('%s survives 4 seasons of processSeason', (gensId) => {
    useGameStore.getState().startGame(gensId);
    let state = useGameStore.getState();
    expect(state.gensId).toBe(gensId);

    for (let i = 0; i < 4; i++) {
      const { nextState } = processSeason(state as any);
      state = nextState as any;
    }

    expect(state.turnNumber).toBe(5); // started at 1, +4 seasons
    expect(state.gensId).toBe(gensId); // survives the whole run unchanged
    expect(state.family.some(c => c.isPlayer)).toBe(true);
  });
});

// ─── neutrality-sweep regression guard ──────────────────────────────────────

describe('gens-neutrality sweep — repo-wide regression guard', () => {
  // Legal survivors (per the P5-E plan): the Brutii data itself, the guided
  // tutorial's authored copy (Brutii-specific by design), and this test file
  // (which legitimately asserts the ABSENCE of 'Brutia' in fixed strings).
  const LEGAL_SURVIVORS = [
    path.join('src', 'data', 'startingFamily.ts'),
    path.join('src', 'data', 'tutorialEvents.ts'),
    path.join('__tests__', 'p5e.test.ts'),
  ];

  // Brutii is the correct, intentional DEFAULT value in exactly these two
  // places — gameStore.ts's INITIAL_STATE (the base every start shallow-
  // merges over; startGame always overrides `log` dynamically per family,
  // per this chunk's own fix) and saveLoad.ts's schema defaults (every
  // pre-P5-E save really was Brutii). Not a violation; the sweep's concern
  // is a hardcoded value used somewhere it should instead read from state.
  const KNOWN_GOOD_DEFAULTS = [
    // saveLoad.ts schema defaults — every pre-P5-E save really was Brutii.
    `gensSurname: z.string().default('Brutus'),`,
    `gensName: z.string().default('Brutia'),`,
    `gensPlural: z.string().default('Brutii'),`,
    // gameStore.ts INITIAL_STATE — the base every start shallow-merges over;
    // startGame always overrides `log` dynamically per family (this fix).
    `gensSurname: 'Brutus',`,
    `gensName: 'Brutia',`,
    `gensPlural: 'Brutii',`,
    `log: [mkLog('264 BC · Spring', 'The Brutii begin their ascent.', 'neutral')],`,
    `cadetBranch: savedState.cadetBranch ?? generateCadet((savedState as any).gensName ?? 'Brutia'),`,
  ];

  test('no "Brutus|Brutia|Brutii" literal survives outside the sanctioned files/defaults', () => {
    const srcRoot = path.join(__dirname, '..', 'src');
    const offenders: string[] = [];

    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;

        const rel = path.relative(path.join(__dirname, '..'), full);
        if (LEGAL_SURVIVORS.some(s => rel.endsWith(s))) continue;

        // Strip /* block comments */ (incl. JSDoc) before scanning lines —
        // explanatory comments documenting this very fix are expected to
        // name the old hardcoded value.
        const text = fs.readFileSync(full, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        for (const line of text.split('\n')) {
          const codePart = line.split('//')[0].trim();
          if (!codePart) continue;
          if (KNOWN_GOOD_DEFAULTS.includes(codePart)) continue;
          if (/Brutus|Brutia|Brutii/.test(codePart)) {
            offenders.push(`${rel}: ${codePart}`);
          }
        }
      }
    }
    walk(srcRoot);

    expect(offenders).toEqual([]);
  });
});
