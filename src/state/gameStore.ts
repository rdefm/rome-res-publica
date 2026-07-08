import { create } from 'zustand';
import type { Character } from '../models/character';
import type { Bill, ActiveLaw } from '../models/bill';
import type { Clan } from '../models/clan';
import type { OfficeId, ElectionRival } from '../models/office';
import type { Client } from '../models/client';
import type { EventInstance } from '../models/event';
import type { OwnedAsset } from '../models/asset';
import type { ActiveAmbition } from '../models/ambition';
import type { LegacyObjective } from '../models/legacyObjective';
import type { PatronTier } from '../models/patronLadder';
import type { Trial } from '../models/trial';
import type { ProvinceState, GovernorPolicy, CampaignState, OfficerVolunteerState } from '../models/province';
import type { TroopUnit } from '../models/troop';
import type { SenateResponseState } from '../engine/senateResponseEngine';
import type { CrisisState } from '../models/crisis';
import type { OfficeActionTargetContext } from '../engine/officeActionEngine';
// ── Phase 1 (P1-A) ────────────────────────────────────────────────────────────
import type { StartId } from '../models/gameStart';
import type { AgendaTarget } from '../models/agenda';
import type { SeasonLedger } from '../models/ledger';
import { calcLevyCost } from '../engine/troopEngine';
import {
  calcConsularArmyStrength,
  calcConsularArmyArrivalTurn,
} from '../engine/senateResponseEngine';
import {
  calcOfficeThreshold,
  calcCanvassRoll,
  CANVASS_FIDES_COST,
  CANVASS_MIN_RELATIONSHIP,
  CANVASS_EVENT_CHANCE,
  generateRivals,
} from '../engine/electionEngine';
import { CANVASSING_EVENTS } from '../data/canvassingEvents';
import type { CanvassingEvent, CanvassingEventResult } from '../data/canvassingEvents';
import { STARTING_FAMILY } from '../data/startingFamily';
import { STARTING_CLANS } from '../data/startingClans';
import { STARTING_BILLS } from '../data/billTemplates';
import { buildInitialProvinceStates } from '../data/provinceDefinitions';
import { processSeason } from '../engine/turnSequencer';
import { incrementLegacy, initLegacyObjectives } from '../engine/legacyEngine';
import { adjustReputation, computeReputationDelta } from '../engine/reputationEngine';
import {
  resolveAmbassadorAction as engineResolveAmbassadorAction,
  type AmbassadorActionId,
} from '../engine/provinceEngine';
import { getProvinceAssetDefinition } from '../data/provinceAssets';
import { getProvincialClientDef } from '../data/provincialClients';

export interface LogEntry {
  id: string;
  turn: string;
  text: string;
  type: 'good' | 'bad' | 'neutral';
}

export interface GameState {
  // Time
  year: number;
  turnNumber: number;
  seasonIndex: number; // 0=Spring 1=Summer 2=Autumn 3=Winter

  // Resources
  fides: number;
  denarii: number;
  imperium: number;

  // Faction standings (-100 to +100)
  popularesRel: number;
  optimatesRel: number;

  // Rome-level stats
  rome: {
    stability: number;
    plebs: number;
    treasury: number;
  };

  // Crisis
  crisisLevel: number;         // legacy scalar — kept in sync with four-track average each season
  crisis: CrisisState;         // four-track model (Chunk 2A+)

  // Flags — general boolean/numeric flag store used by effect strings and gate checks
  flags: Record<string, boolean | number>;

  // Family (Domus)
  family: Character[];
  selectedCharacterId: string;

  // Senate (Curia)
  bills: Bill[];
  _expandedBill: string | null;
  _expandedType: 'vote' | 'speech' | null;
  /** Monotonic sequence for auto-generated bill ids (turnSequencer.nextBillId). Lives in state, not a module
   *  singleton, so it survives being duplicated across Metro's per-route lazy web bundles. */
  billIdSeq: number;

  // Forum
  clans: Clan[];
  expandedClanId: string | null;
  selectedLeaderId: string | null;

  // Cursus Honorum
  currentOffice: OfficeId | null;
  officeSeasons: number;
  heldOffices: OfficeId[];
  campaigning: OfficeId | null;
  campaigningCharacterId: string | null;
  campaignVotes: Record<string, 'for' | 'against' | 'neutral'>;
  electionRivals: ElectionRival[];
  pendingAmbitionScopes: ('family' | 'character')[];

  // Clientela Network
  clients: Client[];

  // Assets (Feature 1)
  ownedAssets: OwnedAsset[];

  // Ambitions (Feature 3)
  ambitions: ActiveAmbition[];

  // Legacy Objectives (Feature 4)
  legacyObjectives: LegacyObjective[];

  // Patron Ladder (Feature 7)
  patronTier: PatronTier;
  lifetimeDignitas: number;

  // Trials (Feature 6)
  trialQueue: Trial[];

  // Faction Reputation (Feature 2)
  familyReputations: Record<string, number>;

  // Legislation
  activeLaws: ActiveLaw[];
  passedBills: { id: string; name: string; passedOnTurn: number }[];

  // Event queue
  pendingEvents: EventInstance[];
  activeEvent: EventInstance | null;

  // Birth naming queue
  pendingBirthNaming: {
    suggestedName: string;
    role: 'son' | 'daughter';
    inheritedTraits: string[];
    baseSkills: { rhetoric: number; martial: number; intrigus: number };
  } | null;

  // Log
  log: LogEntry[];
  cursusLog: LogEntry[];

  // UI
  seasonOverlayVisible: boolean;
  seasonOverlayEvents: string[];

  // ── Provinciae ──────────────────────────────────────────────────────────
  provinces: ProvinceState[];
  lifetimeImperium: number;

  // ── Military (Chunk M) ──────────────────────────────────────────────────
  senateResponse: SenateResponseState | null;

  // ── Canvassing ──────────────────────────────────────────────────────────
  activeCanvassingEvent: CanvassingEvent | null;
  canvassingEventResult: CanvassingEventResult | null;
  pendingCanvassLeaderId: string | null;
  pendingCanvassRoll: number;
  pendingCanvassThreshold: number;

  // ── NPC Co-Consul (Chunk 1B) ─────────────────────────────────────────────
  npcConsul: {
    leaderId: string | null;
    clanId: string | null;
    factionBias: 'optimates' | 'populares' | 'neutral' | null;
    antagonismLevel: 0 | 1 | 2 | 3;
    seasonsServed: number;
  } | null;

  // ── Tribune of the Plebs — parallel path (Chunk 1B) ─────────────────────
  /** characterId of the family member currently holding Tribune, or null. */
  tribuneHolder: string | null;
  /** True while tribuneHolder is set — grants trial immunity (sacrosanctity). */
  tribuneImmunity: boolean;
  /** Seasons served in the current Tribune term (max 4). */
  tribuneSeasonsServed: number;
  /**
   * Tracks veto hostility debt per clan.
   * Incremented each time the Tribune vetoes a bill sponsored by that clan.
   * When a clan's debt ≥ 20, turnSequencer fires evt-tribune-veto-retaliation.
   */
  tribuneHostilityDebt: Record<string, number>;
  /** Populated after any office action resolves. Drives the result modal in CursusScreen. Cleared by clearOfficeActionResult. */
  lastOfficeActionResult: { actionName: string; text: string } | null;

  // ── Consul authority / NPC Tribune (Chunk 1B) ────────────────────────────
  /** True when invoke-consular-authority action is active. Caps Senate Response at censure. */
  consulAuthorityActive: boolean;
  /** Seasons remaining on the consular authority window (starts at 2, decrements each season). */
  consulAuthoritySeasonsRemaining: number;
  /** True if the NPC opposition tribune is still active this term. Cleared by depose-fellow-tribune. */
  npcTribuneActive: boolean;

  // ── Computed flags — recomputed by recomputeComputedFlags after every action (Chunk 1B) ─
  /** True if any province currently has an active CampaignState. */
  activeCampaignExists: boolean;
  /** True if any family member has raisedLegions.length > 0 or veterans.length > 0. */
  familyHasTroops: boolean;
  /** True if any province has infrastructureRating ≥ 30. */
  anyProvinceHasRoads: boolean;
  /** True if any bill with id starting 'triumph-' is in state.bills. */
  triumphBillInQueue: boolean;
  /** True when npcConsul is non-null. */
  npcConsulExists: boolean;

  // ── Term-scoped flags — persisted, reset per office term by turnSequencer (Chunk 1B) ─
  /** True once senatus-consultum has been used this Consul term. */
  consultatumUsedThisTerm: boolean;
  /**
   * True when the Senate has been packed (pack-senate or lectio-senatus).
   * Adds +15 support to all player-sponsored bills while active.
   */
  senatePacked: boolean;
  /**
   * How many consecutive seasons the Dictator has overstayed.
   * After 3: fires evt-assassination-attempt.
   */
  dictatorOverstaySeasons: number;

  // ── Tribune candidacy ────────────────────────────────────────────────────────
  /** characterId of the family member who has declared Tribune candidacy, pending election. Null once resolved. */
  tribuneCandidateId: string | null;

  // ── Office action result modal ───────────────────────────────────────────────
  /** Populated after any office action resolves. Drives the result modal in CursusScreen. Cleared by clearOfficeActionResult. */
  lastOfficeActionResult: { actionName: string; text: string } | null;

  // ── Phase 1 — Agenda tablet + tutorial (P1-A) ──────────────────────────────
  /** Which start configuration launched this game. */
  startId: StartId;
  /** Ordered defIds remaining in the guided tutorial script. Empty = no active script or standard start. */
  tutorialQueue: string[];
  /** turnNumber of the last season the tablet auto-opened. −1 = never opened. Prevents re-open within same season. */
  agendaViewedTurn: number;
  /** True while the Agenda Tablet modal is open. */
  agendaVisible: boolean;
  /** Snapshot of the last completed season's resource/crisis/rome deltas. Displayed in SeasonOverlay and welcome-back recap (P1-D). */
  lastSeasonLedger: SeasonLedger | null;
  /** Epoch ms; updated on endSeason and app background. Used for the welcome-back 12-hour threshold (P1-D). */
  lastActiveAt: number;
  /** One-shot deep-link request. Set by agenda item taps; consumed and cleared by the App.tsx navigator (P1-C). */
  uiNavRequest: AgendaTarget | null;

  // ── App lifecycle (previously untyped — formalised here) ──────────────────
  gameStarted: boolean;
  debugMode: boolean;
}

export interface GameActions {
  // Turn
  endSeason: () => void;
  dismissSeasonOverlay: () => void;

  // Resources
  spendResource: (resource: 'fides' | 'denarii', amount: number) => void;

  // Domus
  selectCharacter: (id: string) => void;
  trainCharacter: (characterId: string, skill: keyof Character['skills'], cost: number) => void;
  commissionLaudatio: () => void;
  performAdrogatio: () => void;
  arrangeMarriageDomus: () => void;

  // Curia
  expandBill: (billId: string, type: 'vote' | 'speech') => void;
  collapseBill: () => void;
  voteBill: (billId: string, vote: 'vote_for' | 'vote_against') => void;
  speechBill: (billId: string, direction: 'for' | 'against') => void;
  filibusterBill: (billId: string) => void;
  submitBill: (template: Omit<Bill, 'id'>) => void;

  // Forum
  expandClan: (clanId: string) => void;
  selectLeader: (leaderId: string) => void;
  buyInfluence: (leaderId: string) => void;
  inviteToDinner: (leaderId: string) => void;
  forgeAlliance: (leaderId: string) => void;
  arrangeMarriageForum: (leaderId: string) => void;
  gatherIntelligence: (leaderId: string) => void;
  canvassForVotes: (leaderId: string) => void;

  // Cursus
  declareCampaign: (officeId: OfficeId) => void;
  useOfficeAction: (actionId: string) => void;

  // Clientela
  addClient: (type: ClientType, name: string, flavourTitle: string, flavourText: string) => void;
  removeClient: (clientId: string) => void;

  // Assets (Feature 1)
  purchaseAsset: (definitionId: string) => void;
  upgradeAsset: (definitionId: string) => void;

  // Cursus — family member campaigns
  declareFamilyCampaign: (characterId: string, officeId: OfficeId) => void;

  // Ambitions
  selectAmbition: (definitionId: string, scope: 'family' | 'character', assignedCharacterId?: string) => void;
  dismissAmbitionSelection: () => void;
  clearAmbitionScope: (scope: 'family' | 'character') => void;
  requestAmbitionChange: (scope: 'family' | 'character') => void;

  // Reputation
  adjustClanReputation: (clanId: string, delta: number, clanName: string) => void;

  // Trials
  takeTrialAction: (trialId: string, actionId: string) => void;

  // Birth
  confirmBirthNaming: (name: string) => void;
  dismissBirthNaming: () => void;

  // Events
  resolveEvent: (choiceId: string, previewClientName?: string) => void;
  dismissEvent: () => void;

  // Legislation
  proposeRepeal: (lawId: string) => void;
  expireLaw: (lawId: string) => void;

  // App flow
  /** Start a new game with the chosen start configuration. Default is standard (no tutorial). */
  startGame: (startId?: StartId, mode?: 'senator' | 'debug') => void;

  // Log
  addLog: (text: string, type?: LogEntry['type']) => void;
  addCursusLog: (text: string, type?: LogEntry['type']) => void;

  // ── Provinciae ────────────────────────────────────────────────────────
  updateProvincePolicy: (provinceId: string, policy: GovernorPolicy) => void;
  resolveAmbassadorAction: (provinceId: string, actionId: AmbassadorActionId) => void;
  purchaseProvinceAsset: (provinceId: string, assetId: string) => void;
  upgradeProvinceAsset: (provinceId: string, assetId: string) => void;
  recruitProvincialClient: (provinceId: string, clientId: string) => void;
  updateProvinces: (provinces: ProvinceState[]) => void;

  // ── Military (Chunk M) ──────────────────────────────────────────────────
  raiseLevy: (characterId: string, musterProvinceId: string) => void;
  musterVeterans: (characterId: string) => void;
  disbandTroops: (characterId: string, troopIds: string[]) => void;
  updateLocalSupportForPlayer: (provinceId: string, delta: number) => void;
  startCampaign: (provinceId: string, type: CampaignState['type']) => void;
  volunteerOfficer: (provinceId: string, characterId: string) => void;
  resolveOfficerDecision: (provinceId: string, decisionIndex: number, tookRisk: boolean) => void;

  // ── Canvassing ──────────────────────────────────────────────────────────
  canvassLeader: (leaderId: string) => void;
  resolveCanvassingEvent: (optionId: string) => void;
  dismissCanvassingResult: () => void;

  // ── Office actions (Chunk 1B) ─────────────────────────────────────────────
  /**
   * Resolve an office action for a character.
   * Routes through officeActionEngine.resolveOfficeAction.
   * For actions requiring a player-chosen target (province, leader, clan),
   * supply targetContext with the relevant id.
   */
  takeOfficeAction: (
    actionId: string,
    characterId: string,
    targetContext?: OfficeActionTargetContext,
  ) => void;

  /**
   * Declare a family member as Tribune of the Plebs candidate.
   * Blocked if the character already holds another office, or if tribuneHolder is set.
   */
  declareTribuneCandidate: (characterId: string) => void;

  /** Dismiss the office action result modal. */
  clearOfficeActionResult: () => void;

  // ── Phase 1 — Agenda tablet (P1-A; auto-open logic derived in App.tsx in P1-C) ──
  /** Open the Agenda Tablet modal and record the viewed turn. */
  showAgenda: () => void;
  /** Close the Agenda Tablet modal. */
  dismissAgenda: () => void;
  /**
   * Request navigation to a tab with an optional entity payload.
   * App.tsx watches uiNavRequest and executes the navigation, then calls clearNavRequest().
   */
  requestNavigation: (target: AgendaTarget) => void;
  /** Clear a consumed navigation request. Called by App.tsx after the nav executes. */
  clearNavRequest: () => void;

  // ── Phase 1 — Season ledger + autosave (P1-D) ─────────────────────────────
  /**
   * Load a saved game. Spreads INITIAL_STATE under savedState so fields added
   * after a save was written fall back to their initial values (migration guard).
   * Always resets UI-only fields to safe defaults.
   */
  loadGame: (savedState: GameState) => void;
  /** Stamp lastActiveAt = Date.now(). Called on foreground/background by App.tsx. */
  tickLastActive: () => void;
}

let _logId = 0;
function mkLog(turn: string, text: string, type: LogEntry['type'] = 'neutral'): LogEntry {
  return { id: `log-${_logId++}`, turn, text, type };
}

export const INITIAL_FAMILY_REPUTATIONS: Record<string, number> = Object.fromEntries(
  STARTING_CLANS.map((c) => [c.id, 0])
);

export const INITIAL_STATE: GameState = {
  year: -264,
  turnNumber: 1,
  seasonIndex: 0,

  fides: 30,
  denarii: 200,
  imperium: 0,

  popularesRel: 0,
  optimatesRel: 0,

  rome: { stability: 70, plebs: 60, treasury: 50 },

  crisisLevel: 15,

  crisis: {
    war:          { id: 'war',          level: 20, tier: 1, namedCrisis: 'Border Tensions' },
    unrest:       { id: 'unrest',       level: 10, tier: 0, namedCrisis: null },
    constitution: { id: 'constitution', level: 5,  tier: 0, namedCrisis: null },
    economy:      { id: 'economy',      level: 15, tier: 0, namedCrisis: null },
  },

  flags: {},

  family: STARTING_FAMILY,
  selectedCharacterId: 'pc-1',

  bills: STARTING_BILLS,
  _expandedBill: null,
  _expandedType: null,
  billIdSeq: 1000,

  clans: STARTING_CLANS,
  expandedClanId: null,
  selectedLeaderId: null,

  currentOffice: null,
  officeSeasons: 0,
  heldOffices: [],
  campaigning: null,
  campaigningCharacterId: null,
  campaignVotes: {},
  electionRivals: [],
  pendingAmbitionScopes: ['family', 'character'],

  clients: [],

  ownedAssets: [],
  familyReputations: INITIAL_FAMILY_REPUTATIONS,
  ambitions: [],
  legacyObjectives: initLegacyObjectives(),
  patronTier: 0,
  lifetimeDignitas: 0,
  trialQueue: [],

  activeLaws: [],
  passedBills: [],

  pendingEvents: [],
  activeEvent: null,
  pendingBirthNaming: null,

  log: [mkLog('264 BC · Spring', 'The Brutii begin their ascent.', 'neutral')],
  cursusLog: [],

  seasonOverlayVisible: false,
  seasonOverlayEvents: [],

  // Provinciae
  provinces: buildInitialProvinceStates(),
  lifetimeImperium: 0,

  // Military (Chunk M)
  senateResponse: null,

  // Canvassing
  activeCanvassingEvent: null,
  canvassingEventResult: null,
  pendingCanvassLeaderId: null,
  pendingCanvassRoll: 0,
  pendingCanvassThreshold: 0,

  // ── Chunk 1B ────────────────────────────────────────────────────────────
  npcConsul: null,

  tribuneHolder: null,
  tribuneImmunity: false,
  tribuneSeasonsServed: 0,
  tribuneHostilityDebt: {},
  tribuneCandidateId: null,

  consulAuthorityActive: false,
  consulAuthoritySeasonsRemaining: 0,
  npcTribuneActive: true,

  activeCampaignExists: false,
  familyHasTroops: false,
  anyProvinceHasRoads: false,
  triumphBillInQueue: false,
  npcConsulExists: false,

  consultatumUsedThisTerm: false,
  senatePacked: false,
  dictatorOverstaySeasons: 0,

  tribuneCandidateId: null,
  lastOfficeActionResult: null,

  // ── Phase 1 — Agenda tablet + tutorial (P1-A) ──────────────────────────────
  startId: 'standard' as StartId,
  tutorialQueue: [],
  agendaViewedTurn: -1,
  agendaVisible: false,
  lastSeasonLedger: null,
  lastActiveAt: Date.now(),
  uiNavRequest: null,

  gameStarted: false,
  debugMode: false,
} as any;


const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function turnLabel(state: GameState): string {
  return `${Math.abs(state.year)} BC · ${SEASON_NAMES[state.seasonIndex]}`;
}

function findClanAndLeader(clans: Clan[], leaderId: string) {
  for (const clan of clans) {
    const leader = clan.leaders.find(l => l.id === leaderId);
    if (leader) return { clan, leader };
  }
  return null;
}

// ── Chunk 1B helper ───────────────────────────────────────────────────────────

/**
 * Recompute derived boolean flags that depend on live state slices.
 * Called at the end of takeOfficeAction and any other action that changes
 * provinces, family troops, bills, or npcConsul.
 */
function recomputeComputedFlags(s: GameState): Partial<GameState> {
  return {
    activeCampaignExists: s.provinces.some(p => p.activeCampaign !== null),
    familyHasTroops: s.family.some(
      c => (c.raisedLegions?.length ?? 0) > 0 || (c.veterans?.length ?? 0) > 0,
    ),
    anyProvinceHasRoads: s.provinces.some(
      p => ((p as any).infrastructureRating ?? 0) >= 30,
    ),
    triumphBillInQueue: s.bills.some(b => b.id.startsWith('triumph-')),
    npcConsulExists: s.npcConsul !== null,
  };
}

export const useGameStore = create<GameState & GameActions>()((set, get) => ({
  ...INITIAL_STATE,

  // ─── Turn ────────────────────────────────────────────────────────────────────

  proposeRepeal: (lawId) => {
    const s = get();
    if (s.fides < 10) return;
    const law = (s.activeLaws ?? []).find(l => l.billId === lawId);
    if (!law || !law.repealable) return;
    const repealAlreadyActive = s.bills.some(b => b.type === 'repeal' && b.repeals === lawId);
    if (repealAlreadyActive) return;
    const { buildRepealBill } = require('../data/billTemplates');
    const repealBill = buildRepealBill(law);
    const label = turnLabel(s);
    set({
      fides: s.fides - 10,
      bills: [...s.bills, repealBill],
      log: [...s.log, mkLog(label, `Abrogatio proposed: ${law.name}.`, 'neutral')],
    });
  },

  expireLaw: (lawId) => {
    set(s => ({
      activeLaws: (s.activeLaws ?? []).filter(l => l.billId !== lawId),
    }));
  },

  startGame: (startId = 'standard', mode = 'senator') => {
    // P1-G: resolve tutorial script for the chosen start
    const { START_DEFINITIONS, TUTORIAL_SCRIPTS } = require('../data/startDefinitions');
    const startDef = (START_DEFINITIONS as any[]).find((d: any) => d.id === startId);
    const scriptId: string | undefined = startDef?.tutorialScriptId;
    const rawQueue: string[] = scriptId ? [...((TUTORIAL_SCRIPTS as any)[scriptId] ?? [])] : [];

    // tut-00 fires immediately at game start (gameStart timing).
    // Pop it from the raw queue and push directly into pendingEvents.
    // All other tutorial events fire through the season slot.
    let tutorialQueue  = rawQueue;
    let pendingGameStart: import('./gameStore').GameState['pendingEvents'] = [];

    if (rawQueue[0] === 'evt-tut-00') {
      pendingGameStart = [{
        defId: 'evt-tut-00',
        firedAtTurn: 0,
        targetCharacterId: (INITIAL_STATE as any).family?.find((c: any) => c.isPlayer)?.id ?? 'pc-1',
      }];
      tutorialQueue = rawQueue.slice(1);
    }

    set({
      ...INITIAL_STATE,
      gameStarted: true,
      debugMode: mode === 'debug',
      startId: startId as StartId,
      tutorialQueue,
      pendingEvents: pendingGameStart,
      lastActiveAt: Date.now(),
    });
  },

  endSeason: () => {
    const s = get();
    const { nextState, events } = processSeason(s);
    const seasonEvents = [...events];

    let finalState = nextState;

    // Chunk 1B: assign NPC co-consul when player wins the Consul election
    const playerJustBecameConsul =
      s.currentOffice !== 'consul' &&
      finalState.currentOffice === 'consul' &&
      !finalState.npcConsul;
    if (playerJustBecameConsul) {
      const { assignNpcConsul } = require('../engine/npcConsulEngine');
      const npcPatch = assignNpcConsul(finalState);
      finalState = { ...finalState, ...npcPatch };
    }

    // Chunk 1B: resolve pending Tribune candidacy election.
    // Success chance scales with plebs mood (0–100) and popularesRel.
    // Floor 40%, ceiling 90% — even a hostile plebs gives some chance.
    if (finalState.tribuneCandidateId) {
      const tribuneCharId = finalState.tribuneCandidateId;
      const candidate = finalState.family.find(c => c.id === tribuneCharId);
      if (candidate) {
        const plebsScore      = finalState.rome.plebs / 100;
        const popularesBonus  = Math.max(0, finalState.popularesRel) / 200;
        const successChance   = Math.min(0.90, 0.40 + plebsScore * 0.40 + popularesBonus);
        const won             = Math.random() < successChance;

        if (won) {
          finalState = {
            ...finalState,
            tribuneHolder:        tribuneCharId,
            tribuneCandidateId:   null,
            tribuneImmunity:      true,
            tribuneSeasonsServed: 0,
            tribuneHostilityDebt: {},
            family: finalState.family.map(c =>
              c.id === tribuneCharId ? { ...c, officeId: 'tribune' as any } : c
            ),
          };
          seasonEvents.push(
            `${candidate.name} is elected Tribune of the Plebs by the Concilium Plebis. Sacrosanctity granted.`
          );
        } else {
          finalState = { ...finalState, tribuneCandidateId: null };
          seasonEvents.push(
            `${candidate.name}'s candidacy for Tribune of the Plebs was rejected by the Concilium Plebis.`
          );
        }
      }
    }

    // ── P1-D: season ledger ──────────────────────────────────────────────────
    // Diff is computed against the pre-season snapshot `s` and the fully
    // post-processed `finalState` (after NPC consul, Tribune election, etc.).
    const ledger: SeasonLedger = {
      turnNumber:  s.turnNumber,
      seasonLabel: `${Math.abs(s.year)} BC · ${SEASON_NAMES[s.seasonIndex]}`,
      year:        s.year,
      resourceDeltas: {
        fides:            finalState.fides            - s.fides,
        denarii:          finalState.denarii          - s.denarii,
        imperium:         finalState.imperium         - s.imperium,
        lifetimeDignitas: finalState.lifetimeDignitas - s.lifetimeDignitas,
      },
      crisisDeltas: {
        war:          finalState.crisis.war.level          - s.crisis.war.level,
        unrest:       finalState.crisis.unrest.level       - s.crisis.unrest.level,
        constitution: finalState.crisis.constitution.level - s.crisis.constitution.level,
        economy:      finalState.crisis.economy.level      - s.crisis.economy.level,
      },
      romeDeltas: {
        stability: finalState.rome.stability - s.rome.stability,
        plebs:     finalState.rome.plebs     - s.rome.plebs,
        treasury:  finalState.rome.treasury  - s.rome.treasury,
      },
      headlines: seasonEvents.slice(0, 5),
    };

    const nextEvent       = finalState.pendingEvents[0] ?? null;
    const remainingPending = finalState.pendingEvents.slice(1);
    set({
      ...finalState,
      activeEvent:            nextEvent,
      pendingEvents:          remainingPending,
      seasonOverlayVisible:   true,
      seasonOverlayEvents:    seasonEvents,
      lastSeasonLedger:       ledger,
      lastActiveAt:           Date.now(),
    });

    // Autosave — async, non-fatal. UI-only fields stripped inside saveLoad.save().
    const { saveProvider: sp } = require('../state/saveLoad');
    sp.save(get()).catch((e: Error) => console.warn('[P1-D] Autosave failed:', e));
  },

  dismissSeasonOverlay: () => set({ seasonOverlayVisible: false, seasonOverlayEvents: [] }),

  // ─── Resources ───────────────────────────────────────────────────────────────

  spendResource: (resource, amount) => {
    const s = get();
    const current = s[resource] as number;
    if (current < amount) return;
    set({ [resource]: current - amount });
  },

  // ─── Domus ───────────────────────────────────────────────────────────────────

  selectCharacter: (id) => set({ selectedCharacterId: id }),

  trainCharacter: (characterId, skill, cost) => {
    const s = get();
    if (s.fides < cost) return;
    const char = s.family.find((c) => c.id === characterId);
    if (!char) return;
    const roll = Math.random();
    const success = roll < 0.65;
    const label = turnLabel(s);
    if (success) {
      set({
        fides: s.fides - cost,
        family: s.family.map((c) =>
          c.id === characterId
            ? { ...c, skills: { ...c.skills, [skill]: c.skills[skill] + 1 } }
            : c
        ),
        log: [...s.log, mkLog(label, `${char.name} improves ${skill} by 1.`, 'good')],
      });
    } else {
      set({
        fides: s.fides - cost,
        log: [...s.log, mkLog(label, `${char.name}'s training yields no progress this season.`, 'neutral')],
      });
    }
  },

  commissionLaudatio: () => {
    const s = get();
    if (s.fides < 10) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 10,
      lifetimeDignitas: s.lifetimeDignitas + 10,
      log: [...s.log, mkLog(label, 'A laudatio commissioned. Lifetime Dignitas +10.', 'good')],
    });
  },

  performAdrogatio: () => {
    const s = get();
    if (s.denarii < 50) return;
    const label = turnLabel(s);
    set({
      denarii: s.denarii - 50,
      log: [...s.log, mkLog(label, 'Adrogatio performed. A citizen adopted into the Brutii.', 'neutral')],
    });
  },

  arrangeMarriageDomus: () => {
    const s = get();
    if (s.fides < 15) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 15,
      log: [...s.log, mkLog(label, 'Marriage arranged within the family.', 'neutral')],
    });
  },

  // ─── Curia ───────────────────────────────────────────────────────────────────

  expandBill: (billId, type) => set({ _expandedBill: billId, _expandedType: type }),
  collapseBill: () => set({ _expandedBill: null, _expandedType: null }),

  voteBill: (billId, vote) => {
    const s = get();
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return;
    const voteFidesCost = bill.voteGravitasCost ?? 4;
    if (s.fides < voteFidesCost) return;
    const delta = vote === 'vote_for'
      ? (bill.voteForSupport ?? 15)
      : (bill.voteAgainstSupport ?? -15);
    const label = turnLabel(s);
    set({
      fides: s.fides - voteFidesCost,
      bills: s.bills.map((b) =>
        b.id === billId ? { ...b, support: b.support + delta } : b
      ),
      _expandedBill: null,
      _expandedType: null,
      log: [...s.log, mkLog(label, `Voted ${vote === 'vote_for' ? 'for' : 'against'} ${bill.name}.`, 'neutral')],
    });
  },

  speechBill: (billId, direction) => {
    const s = get();
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return;
    const speechFidesCost = bill.speechGravitasCost ?? 6;
    if (s.fides < speechFidesCost) return;
    const player = s.family.find((c) => c.isPlayer);
    const rhetoric = player?.skills.rhetoric ?? 0;
    const roll = Math.random();
    const success = roll < 0.4 + rhetoric * 0.06;
    const baseDelta = direction === 'for'
      ? (bill.speechForSupport ?? 20)
      : (bill.speechAgainstSupport ?? -20);
    // Rhetoric scales the swing itself, not just whether it lands: 0.5x at rhetoric 0,
    // 1x (the old flat default) at rhetoric 5, 1.5x at rhetoric 10.
    const rhetoricMultiplier = 0.5 + rhetoric * 0.1;
    const delta = success ? Math.round(baseDelta * rhetoricMultiplier) : 0;
    const label = turnLabel(s);
    set({
      fides: s.fides - speechFidesCost,
      bills: s.bills.map((b) =>
        b.id === billId ? { ...b, support: b.support + delta } : b
      ),
      _expandedBill: null,
      _expandedType: null,
      log: [
        ...s.log,
        mkLog(
          label,
          success
            ? `Speech ${direction === 'for' ? 'for' : 'against'} ${bill.name} sways the Senate.`
            : `Speech on ${bill.name} fails to move the chamber.`,
          success ? 'good' : 'neutral'
        ),
      ],
    });
  },

  filibusterBill: (billId) => {
    const s = get();
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return;
    if (s.fides < 8) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 8,
      bills: s.bills.map((b) =>
        b.id === billId ? { ...b, turnsLeft: b.turnsLeft + 1 } : b
      ),
      _expandedBill: null,
      _expandedType: null,
      log: [...s.log, mkLog(label, `Filibuster delays ${bill.name} by one season.`, 'neutral')],
    });
  },

  submitBill: (template) => {
    const s = get();
    if (s.fides < 10) return;
    const newBill: Bill = { ...template, id: `player-bill-${Date.now()}` };
    const label = turnLabel(s);
    set({
      fides: s.fides - 10,
      bills: [...s.bills, newBill],
      log: [...s.log, mkLog(label, `${newBill.name} tabled in the Senate.`, 'neutral')],
    });
  },

  // ─── Forum ───────────────────────────────────────────────────────────────────

  expandClan: (clanId) => set({ expandedClanId: clanId, selectedLeaderId: null }),
  selectLeader: (leaderId) => set({ selectedLeaderId: leaderId }),

  buyInfluence: (leaderId) => {
    const s = get();
    if (s.fides < 10) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = 5;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      fides: s.fides - 10,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Influence purchased with a clan leader.', 'neutral')],
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  inviteToDinner: (leaderId) => {
    const s = get();
    if (s.denarii < 20) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = 8;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      denarii: s.denarii - 20,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Dinner hosted for a clan leader. Warmth increased.', 'good')],
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  forgeAlliance: (leaderId) => {
    const s = get();
    if (s.fides < 20) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = 12;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      fides: s.fides - 20,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta), alliance: true } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Alliance forged with a clan leader.', 'good')],
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  arrangeMarriageForum: (leaderId) => {
    const s = get();
    if (s.fides < 20) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = 20;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      fides: s.fides - 20,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Marriage alliance arranged with a clan family.', 'good')],
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  gatherIntelligence: (leaderId) => {
    const s = get();
    if (s.fides < 8) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 8,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, intelGathered: true } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Intelligence gathered on a clan leader.', 'neutral')],
    });
  },

  canvassForVotes: (leaderId) => {
    const s = get();
    if (s.fides < 12) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 12,
      campaignVotes: { ...s.campaignVotes, [leaderId]: 'for' },
      log: [...s.log, mkLog(label, 'Canvassing complete. Clan leader support secured.', 'good')],
    });
  },

  // ─── Cursus ──────────────────────────────────────────────────────────────────

  declareCampaign: (officeId) => {
    const s = get();
    const label = turnLabel(s);
    set({
      campaigning: officeId,
      campaigningCharacterId: 'pc-1',
      electionRivals: generateRivals(officeId, s),
      campaignVotes: {},
      log: [...s.log, mkLog(label, `Campaign for ${officeId} declared.`, 'neutral')],
    });
  },

  useOfficeAction: (actionId) => {
    const s = get();
    const { OFFICES, TRIBUNE_OFFICE } = require('../data/offices');
    const { getUnlockedAssetActions } = require('../engine/assetEngine');

    // Flatten all inOfficeActions from every office + Tribune (legacy effect path).
    // OFFICE_ACTIONS no longer exported separately from offices.ts — search inline.
    const allActions: any[] = [
      ...OFFICES.flatMap((o: any) => o.inOfficeActions ?? []),
      ...(TRIBUNE_OFFICE?.inOfficeActions ?? []),
    ];
    const action = allActions.find((a: any) => a.id === actionId);
    if (!action) return;

    if (action.requiresAssetAction) {
      const unlocked = getUnlockedAssetActions(s.ownedAssets);
      if (!unlocked.includes(action.requiresAssetAction)) return;
    }

    const resourceKey = action.resource as keyof typeof s | undefined;
    if (resourceKey && (s[resourceKey] as number) < action.costVal) return;

    const patch = action.effect(s);
    const { logMsg, ...statePatch } = patch;
    const label = turnLabel(s);

    set({
      ...statePatch,
      ...(resourceKey ? { [resourceKey]: (s[resourceKey] as number) - action.costVal } : {}),
      log: [...s.log, mkLog(label, logMsg, 'neutral')],
      lastOfficeActionResult: { actionName: action.name, text: logMsg ?? action.desc ?? 'Done.' },
    });
  },

  // ─── Reputation ─────────────────────────────────────────────────────────────

  adjustClanReputation: (clanId, delta, clanName) => {
    const s = get();
    const current = s.familyReputations[clanId] ?? 0;
    const { newScore, crossedThreshold } = adjustReputation(current, delta);
    const newReps = { ...s.familyReputations, [clanId]: newScore };
    set({
      familyReputations: newReps,
      ...(crossedThreshold ? {
        seasonOverlayEvents: [...s.seasonOverlayEvents,
          `${clanName} now regards the Brutii as "${crossedThreshold.label}".`]
      } : {}),
    });
  },

  // ─── Ambitions ──────────────────────────────────────────────────────────────

  selectAmbition: (definitionId, scope, assignedCharacterId) => {
    const s = get();
    const { getAmbitionDefinition } = require('../engine/ambitionEngine');
    const def = getAmbitionDefinition(definitionId);
    if (!def) return;
    const newAmbition = {
      definitionId,
      scope,
      assignedCharacterId,
      status: 'active' as const,
      turnActivated: s.turnNumber,
      turnsRemaining: def.expiresInTurns,
    };
    // Picking a new ambition for a scope (initial selection or a deliberate change from
    // the Domus tab) always supersedes whatever's currently active there — dropped for
    // free, with no reward or expiry consequence, since it's a choice, not a timeout.
    const survivingAmbitions = s.ambitions.filter(a =>
      !(a.status === 'active' && a.scope === scope &&
        (scope !== 'character' || a.assignedCharacterId === assignedCharacterId))
    );
    const newFamily = assignedCharacterId
      ? s.family.map(c =>
          c.id === assignedCharacterId
            ? { ...c, ambitionIds: [...c.ambitionIds.filter(id => id !== definitionId), definitionId] }
            : c
        )
      : s.family;
    set({
      ambitions: [...survivingAmbitions, newAmbition],
      family: newFamily,
      pendingAmbitionScopes: s.pendingAmbitionScopes.filter(sc => sc !== scope),
    });
  },

  dismissAmbitionSelection: () => set({ pendingAmbitionScopes: [] }),

  clearAmbitionScope: (scope) => set((s) => ({
    pendingAmbitionScopes: s.pendingAmbitionScopes.filter(sc => sc !== scope),
  })),

  // Opens the ambition picker for a scope on demand (e.g. tapping an ambition in the
  // Domus character modal to change it), independent of the season-end auto-prompt.
  requestAmbitionChange: (scope) => set((s) => ({
    pendingAmbitionScopes: s.pendingAmbitionScopes.includes(scope)
      ? s.pendingAmbitionScopes
      : [...s.pendingAmbitionScopes, scope],
  })),

  // ─── Clientela ──────────────────────────────────────────────────────────────

  addClient: (type, name, flavourTitle, flavourText) => set((s) => {
    const { buildClient } = require('../engine/clientEngine');
    const newClient = buildClient(
      `client-${Date.now()}`,
      name,
      type,
      flavourTitle,
      flavourText,
      s.turnNumber,
    );
    return { clients: [...s.clients, newClient] };
  }),

  removeClient: (clientId) => set((s) => ({
    clients: s.clients.filter(c => c.id !== clientId),
  })),

  // ─── Assets ─────────────────────────────────────────────────────────────────

  purchaseAsset: (definitionId) => {
    const s = get();
    const { purchaseCost, getDefinition } = require('../engine/assetEngine');

    if (s.ownedAssets.some(a => a.definitionId === definitionId)) return;

    const def = getDefinition(definitionId);
    if (!def) return;

    const cost = purchaseCost(definitionId);
    if (s.denarii < cost) return;

    const newAsset: OwnedAsset = {
      definitionId,
      currentTier: 1,
      turnAcquired: s.turnNumber,
    };

    const label = turnLabel(s);
    set({
      denarii: s.denarii - cost,
      ownedAssets: [...s.ownedAssets, newAsset],
      log: [...s.log, mkLog(label, `${def.name} acquired. (${def.tiers[0].label})`, 'good')],
    });
  },

  upgradeAsset: (definitionId) => {
    const s = get();
    const { upgradeCost, getDefinition } = require('../engine/assetEngine');

    const owned = s.ownedAssets.find(a => a.definitionId === definitionId);
    if (!owned) return;
    if (owned.currentTier === 3) return;

    const def = getDefinition(definitionId);
    if (!def) return;

    const cost = upgradeCost(owned);
    if (cost === null || s.denarii < cost) return;

    const newTier = (owned.currentTier + 1) as 2 | 3;
    const tierLabel = def.tiers[newTier - 1].label;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - cost,
      ownedAssets: s.ownedAssets.map(a =>
        a.definitionId === definitionId
          ? { ...a, currentTier: newTier }
          : a
      ),
      log: [...s.log, mkLog(label, `${def.name} upgraded to ${tierLabel}.`, 'good')],
    });
  },

  // ─── Trials ─────────────────────────────────────────────────────────────────

  takeTrialAction: (trialId, actionId) => {
    const s = get();
    const { TRIAL_ACTIONS } = require('../data/trialActions');
    const { getUnlockedAssetActions } = require('../engine/assetEngine');

    const trial = s.trialQueue.find(t => t.id === trialId);
    if (!trial || trial.resolved) return;
    if (trial.actionsUsed.includes(actionId)) return;

    const action = TRIAL_ACTIONS.find((a: any) => a.id === actionId);
    if (!action) return;

    if (action.requiresAssetAction) {
      const unlocked = getUnlockedAssetActions(s.ownedAssets);
      if (!unlocked.includes(action.requiresAssetAction)) return;
    }

    const resource = action.cost.resource as keyof typeof s;
    const currentAmount = s[resource] as number;
    if (currentAmount < action.cost.amount) return;

    const label = turnLabel(s);
    set({
      [resource]: currentAmount - action.cost.amount,
      trialQueue: s.trialQueue.map(t =>
        t.id === trialId
          ? {
              ...t,
              defenseStrength: Math.min(100, t.defenseStrength + action.defenseBonus),
              actionsUsed: [...t.actionsUsed, actionId],
            }
          : t
      ),
      log: [...s.log, mkLog(label, `Trial defense: ${action.label}. Defense +${action.defenseBonus}.`, 'good')],
    });
  },

  // ─── Birth ──────────────────────────────────────────────────────────────────

  confirmBirthNaming: (name) => {
    const s = get();
    if (!s.pendingBirthNaming) return;
    const { role, inheritedTraits, baseSkills } = s.pendingBirthNaming;
    const { applyTraitModifiers } = require('../engine/inheritanceEngine');

    const baseChild: import('../models/character').Character = {
      id: `child-${Date.now()}`,
      name,
      role,
      isPlayer: false,
      age: 0,
      skills: baseSkills,
      traits: [],
      ambition: null,
      relationship: 80,
      familyTrust: 100,
      officeId: null,
      corruptionScore: 0,
      inheritedTraits: [],
      ambitionIds: [],
      reputationScores: {},
      formalImperium: 0,
      militaryImperium: 0,
      raisedLegions: [],
      veterans: [],
    };

    const child = applyTraitModifiers(baseChild, inheritedTraits);
    const label = turnLabel(s);
    set({
      family: [...s.family, child],
      pendingBirthNaming: null,
      log: [...s.log, mkLog(label, `${name} is born into the Brutii.`, 'good')],
    });
  },

  dismissBirthNaming: () => set({ pendingBirthNaming: null }),

  // ─── Events ─────────────────────────────────────────────────────────────────

  resolveEvent: (choiceId, previewClientName) => {
    const s = get();
    if (!s.activeEvent) return;

    const { EVENT_DEFS }          = require('../data/events');
    const { TUTORIAL_EVENT_DEFS } = require('../data/tutorialEvents');
    const { applyEffectString }   = require('../engine/resourceEngine');
    const { resolveEventChoice }  = require('../engine/eventEngine');

    // P1-G: search tutorial pool as well as main pool
    const allDefs = [...EVENT_DEFS, ...TUTORIAL_EVENT_DEFS];
    const def = allDefs.find((d: any) => d.id === s.activeEvent!.defId);
    if (!def) {
      set({ activeEvent: null });
      return;
    }

    const choice = def.choices.find((c: any) => c.id === choiceId);
    if (!choice) {
      set({ activeEvent: null });
      return;
    }

    const result = resolveEventChoice(choice, s);

    // Branching path — push follow-up event rather than applying effects
    if (result.nextEventId) {
      const followUp = {
        defId: result.nextEventId,
        firedAtTurn: s.turnNumber,
        targetCharacterId: s.activeEvent?.targetCharacterId ?? 'pc-1',
      };
      const remainingPending = s.pendingEvents.filter(e => e.defId !== result.nextEventId);
      set({
        activeEvent: followUp,
        pendingEvents: remainingPending,
      });
      return;
    }

    const effectStr = result.effectStr;

    const patch = effectStr
      ? applyEffectString(effectStr, s, { previewClientName, instance: s.activeEvent })
      : {};

    const { _addClient, _removeClient, ...statePatch } = patch as any;

    const nextEvent = s.pendingEvents[0] ?? null;
    const remainingPending = s.pendingEvents.slice(1);

    set({ ...statePatch, activeEvent: nextEvent, pendingEvents: remainingPending });

    // ── P1-G: Tutorial special-case handlers ────────────────────────────────
    // Three handlers permitted by plan. Fourth would require a generic token.
    // See Fable-phase1-implementation-plan.md §P1-G cross-chunk notes.
    const defId = s.activeEvent.defId;

    // Case 1 — tut-00 "Show me the tablet": open AgendaTablet immediately
    if (defId === 'evt-tut-00' && choiceId === 'show-tablet') {
      const curr = get();
      set({ agendaVisible: true, agendaViewedTurn: curr.turnNumber });
    }

    // Case 2 — tut-03 "Vote for bill": add +15 support to highest-support live bill
    if (defId === 'evt-tut-03' && choiceId === 'vote-bill') {
      const curr = get();
      if (curr.bills.length > 0) {
        const topBill = curr.bills.reduce(
          (best, b) => (b.support > best.support ? b : best),
          curr.bills[0]
        );
        set({
          bills: curr.bills.map(b =>
            b.id === topBill.id ? { ...b, support: b.support + 15 } : b
          ),
        });
      }
    }

    // Case 3 — tut-05 "Declare Gaius": invoke declareFamilyCampaign for eligible member
    if (defId === 'evt-tut-05' && choiceId === 'declare-gaius') {
      const curr  = get();
      const { OFFICES } = require('../data/offices');
      const eligible = curr.family.find(c =>
        !c.isPlayer && (c.age ?? 0) >= 18 && (c as any).officeId === null
      );
      if (eligible) {
        const heldOffices: string[] = (eligible as any).heldOffices ?? [];
        const firstOffice = (OFFICES as any[]).find((o: any) =>
          o.id !== 'dictator' &&
          !heldOffices.includes(o.id) &&
          (eligible.age ?? 0) >= o.minAge
        );
        if (firstOffice) {
          get().declareFamilyCampaign(eligible.id, firstOffice.id);
        }
      }
    }
    // ── End tutorial special-case handlers ─────────────────────────────────

    if (_addClient) {
      set((s2) => ({ clients: [...s2.clients, _addClient] }));
    }
    if (_removeClient) get().removeClient(_removeClient);
  },

  dismissEvent: () => {
    const s = get();
    const nextEvent = s.pendingEvents[0] ?? null;
    const remainingPending = s.pendingEvents.slice(1);
    set({ activeEvent: nextEvent, pendingEvents: remainingPending });
  },

  // ─── Log ────────────────────────────────────────────────────────────────────

  addLog: (text, type = 'neutral') => {
    const s = get();
    set({ log: [...s.log, mkLog(turnLabel(s), text, type)] });
  },

  addCursusLog: (text, type = 'neutral') => {
    const s = get();
    set({ cursusLog: [...s.cursusLog, mkLog(turnLabel(s), text, type)] });
  },

  // ─── Cursus — family member campaigns ───────────────────────────────────────

  declareFamilyCampaign: (characterId, officeId) => {
    const s = get();
    const label = turnLabel(s);
    set({
      campaigning: officeId,
      campaigningCharacterId: characterId,
      electionRivals: generateRivals(officeId, s),
      campaignVotes: {},
      log: [...s.log, mkLog(label, `Family member declared campaign for ${officeId}.`, 'neutral')],
    });
  },

  // ─── Office actions (Chunk 1B) ───────────────────────────────────────────────

  takeOfficeAction: (actionId, characterId, targetContext) => {
    const s = get();

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveOfficeAction } = require('../engine/officeActionEngine') as typeof import('../engine/officeActionEngine');
    const result = resolveOfficeAction(actionId, characterId, s, targetContext);

    if (result.blocked) {
      console.warn(`[takeOfficeAction] Blocked: ${result.blockedReason}`);
      return;
    }

    const { blocked: _b, blockedReason: _br, logMsg, ...statePatch } = result;

    // Look up action name and compose result text for the modal
    const { OFFICES: _offices, TRIBUNE_OFFICE: _tribune } = require('../data/offices');
    const _allActions: any[] = [
      ..._offices.flatMap((o: any) => o.inOfficeActions ?? []),
      ...(_tribune?.inOfficeActions ?? []),
    ];
    const _actionDef = _allActions.find((a: any) => a.id === actionId);
    const _actionName = _actionDef?.name ?? actionId;
    const _resultText = logMsg ?? _actionDef?.desc ?? 'The action has been carried out.';

    // Post-process: sync flag-driven fields to direct GameState fields.
    // applyEffectString writes to state.flags; some flags have a corresponding
    // direct field that engines read (avoiding flag-string lookups in hot paths).
    const flags = (statePatch.flags ?? s.flags) as Record<string, unknown>;
    const syncedPatch: Partial<GameState> = {};

    // invoke-consular-authority sets flag + direct fields
    if (flags['consulAuthorityActive'] === true && !s.consulAuthorityActive) {
      syncedPatch.consulAuthorityActive = true;
      syncedPatch.consulAuthoritySeasonsRemaining = 2;
    }

    // pack-senate and lectio-senatus set the 'senate-packed' flag
    if (flags['senate-packed'] === true && !s.senatePacked) {
      syncedPatch.senatePacked = true;
    }

    // depose-fellow-tribune sets flag to false
    if (flags['npcTribuneActive'] === false) {
      syncedPatch.npcTribuneActive = false;
    }

    // senatus-consultum sets flag by the same name
    if ('consultatumUsedThisTerm' in flags) {
      syncedPatch.consultatumUsedThisTerm = Boolean(flags['consultatumUsedThisTerm']);
    }

    // Recompute computed flags after all patches applied
    const mergedForRecompute: GameState = { ...s, ...statePatch, ...syncedPatch };
    const computedFlagsPatch = recomputeComputedFlags(mergedForRecompute);

    const label = turnLabel(s);
    set({
      ...statePatch,
      ...syncedPatch,
      ...computedFlagsPatch,
      lastOfficeActionResult: { actionName: _actionName, text: _resultText },
      ...(logMsg
        ? { log: [...s.log, mkLog(label, logMsg, 'neutral')] }
        : {}),
    });
  },

  declareTribuneCandidate: (characterId) => {
    const s = get();

    const character = s.family.find(c => c.id === characterId);
    if (!character) {
      console.warn(`[declareTribuneCandidate] Character ${characterId} not found.`);
      return;
    }

    // Block: character already holds another office.
    // For the player, office is tracked in state.currentOffice (not character.officeId).
    // For non-player family members, it's on character.officeId.
    const holdsAnyOffice = character.officeId !== null ||
      (character.isPlayer && s.currentOffice !== null);
    if (holdsAnyOffice) {
      console.warn(`[declareTribuneCandidate] ${character.name} already holds an office.`);
      return;
    }

    // Block: a family member already holds Tribune
    if (s.tribuneHolder !== null) {
      console.warn(`[declareTribuneCandidate] Tribune already held by character ${s.tribuneHolder}`);
      return;
    }

    // Block: a candidacy is already pending
    if (s.tribuneCandidateId !== null) {
      console.warn(`[declareTribuneCandidate] Tribune candidacy already pending for ${s.tribuneCandidateId}`);
      return;
    }

    const label = turnLabel(s);

    // Set pending candidacy — election resolves at the next season end in endSeason().
    set({
      tribuneCandidateId: characterId,
      log: [
        ...s.log,
        mkLog(
          label,
          `${character.name} declares candidacy for Tribune of the Plebs. The Concilium Plebis will vote at the next season end.`,
          'neutral',
        ),
      ],
    });
  },

  clearOfficeActionResult: () => set({ lastOfficeActionResult: null }),

  // ── Phase 1 — Agenda tablet (P1-A) ───────────────────────────────────────────
  // These are the complete implementations. Auto-open is derived from state shape
  // in App.tsx (P1-C), not a store action, so no stub-replacement is needed later.

  showAgenda: () => {
    const s = get();
    set({ agendaVisible: true, agendaViewedTurn: s.turnNumber });
  },

  dismissAgenda:     () => set({ agendaVisible: false }),
  requestNavigation: (target) => set({ uiNavRequest: target }),
  clearNavRequest:   () => set({ uiNavRequest: null }),

  // ── Phase 1 — Season ledger + autosave (P1-D) ─────────────────────────────

  loadGame: (savedState) => set({
    ...INITIAL_STATE,
    ...savedState,
    // Always reset transient UI state — these must not be loaded from disk
    gameStarted:   true,
    debugMode:     false,
    agendaVisible: false,
    uiNavRequest:  null,
    activeEvent:   null,
  }),

  tickLastActive: () => set({ lastActiveAt: Date.now() }),


  // ─── Provinciae ─────────────────────────────────────────────────────────────

  updateProvincePolicy: (provinceId, policy) => {
    set((s) => ({
      provinces: s.provinces.map(p =>
        p.id === provinceId && p.playerGovernor
          ? { ...p, playerGovernor: { ...p.playerGovernor, policy } }
          : p
      ),
    }));
  },

  resolveAmbassadorAction: (provinceId, actionId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province || !province.playerAmbassador) return;

    if (province.playerAmbassador.actionsUsedThisTurn.includes(actionId)) return;

    const result = engineResolveAmbassadorAction(actionId, province, 0);
    if (!result.success) return;

    const label = turnLabel(s);
    const rp = result.resourcePatch;

    set({
      ...(rp.fides   !== undefined ? { fides:   Math.max(0, s.fides   + rp.fides)   } : {}),
      ...(rp.denarii !== undefined ? { denarii: Math.max(0, s.denarii + rp.denarii) } : {}),
      provinces: s.provinces.map(p =>
        p.id === provinceId
          ? {
              ...p,
              ...result.provincePatch,
              playerAmbassador: p.playerAmbassador
                ? {
                    ...p.playerAmbassador,
                    ...result.provincePatch.playerAmbassador,
                    actionsUsedThisTurn: [
                      ...p.playerAmbassador.actionsUsedThisTurn,
                      actionId,
                    ],
                  }
                : null,
            }
          : p
      ),
      log: [...s.log, mkLog(label, result.logMessage, 'neutral')],
    });
  },

  purchaseProvinceAsset: (provinceId, assetId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province) return;

    if (province.ownedAssets.some(a => a.definitionId === assetId)) return;

    const def = getProvinceAssetDefinition(assetId);
    if (!def) return;

    if (s.denarii < def.cost) return;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - def.cost,
      provinces: s.provinces.map(p =>
        p.id === provinceId
          ? {
              ...p,
              ownedAssets: [
                ...p.ownedAssets,
                { definitionId: assetId, tier: 1 as const, turnAcquired: s.turnNumber },
              ],
              localSupport: Math.min(100, p.localSupport + def.localSupportGain),
            }
          : p
      ),
      log: [...s.log, mkLog(label, `${def.name} acquired in ${provinceId}. (+${def.localSupportGain} Local Support)`, 'good')],
    });
  },

  upgradeProvinceAsset: (provinceId, assetId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province) return;

    const owned = province.ownedAssets.find(a => a.definitionId === assetId);
    if (!owned || owned.tier >= 2) return;

    const def = getProvinceAssetDefinition(assetId);
    if (!def) return;

    const upgradeCost = Math.round(def.cost * 0.6);
    if (s.denarii < upgradeCost) return;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - upgradeCost,
      provinces: s.provinces.map(p =>
        p.id === provinceId
          ? {
              ...p,
              ownedAssets: p.ownedAssets.map(a =>
                a.definitionId === assetId ? { ...a, tier: 2 as const } : a
              ),
            }
          : p
      ),
      log: [...s.log, mkLog(label, `${def.name} upgraded in ${provinceId}.`, 'good')],
    });
  },

  recruitProvincialClient: (provinceId, clientId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province) return;

    const clientDef = getProvincialClientDef(clientId);
    if (!clientDef) return;

    if (province.localSupport < clientDef.supportRequired) return;
    if (province.relationshipScore < clientDef.relationshipRequired) return;

    if (s.clients.some(c => (c as any).provincialClientDefId === clientId)) return;

    if (s.fides < 20) return;

    const label = turnLabel(s);
    const newClient = {
      id: `provincial-${clientId}-${Date.now()}`,
      name: clientDef.name,
      type: 'provincial' as any,
      flavourTitle: 'Provincial Client',
      flavourText: clientDef.bonusDescription,
      // Provincial clients carry their bonuses via provincialClientDefId (resolved through
      // getProvincialClientDef), not the generic ClientBonus pool — but computeTotalClientBonuses
      // and the Clientela UI both assume every Client has a `bonus` object, so this must be
      // present (even empty) or those call sites crash on Object.entries(undefined).
      bonus: {},
      acquiredTurn: s.turnNumber,
      isProvincialClient: true,
      provincialClientDefId: clientId,
    };

    set({
      clients: [...s.clients, newClient as any],
      fides: s.fides - 20,
      log: [...s.log, mkLog(label, `${clientDef.name} joins the Brutii as a provincial client.`, 'good')],
    });
  },

  updateProvinces: (provinces) => set({ provinces }),

  // ── Military Actions (Chunk M) ───────────────────────────────────────────────

  raiseLevy: (characterId, musterProvinceId) => {
    const s = get();
    if (musterProvinceId === 'latium') return;

    const character = s.family.find(c => c.id === characterId);
    if (!character) return;

    // senateAuthorised = character currently holds a formal office
    const senateAuthorised = !!character.officeId;
    const cost = calcLevyCost(60, s.crisisLevel, senateAuthorised);
    if (s.denarii < cost) return;

    const newTroop: TroopUnit = {
      id:                `troop-${Date.now()}`,
      type:              'raised',
      strength:          4,
      campaignsSurvived: 0,
      yearsInactive:     0,
      bondToCommander:   50,
      musterProvinceId,
    };

    const updatedFamily = s.family.map(c =>
      c.id === characterId
        ? { ...c, raisedLegions: [...c.raisedLegions, newTroop] }
        : c
    );

    // Initialise Senate response tracking for the first unsanctioned levy.
    // Condition: character holds no formalImperium AND had no prior raised legions.
    const isFirstUnsanctionedLevy = !character.formalImperium && character.raisedLegions.length === 0 && !senateAuthorised;
    const senateResponse: SenateResponseState | null = isFirstUnsanctionedLevy
      ? {
          active:                    true,
          seasonDetected:            s.turnNumber,
          phase:                     null,
          musterProvinceId,
          consularArmyStrength:      calcConsularArmyStrength(s.crisisLevel, character.militaryImperium),
          debateSuppressed:          false,
          consularArmyArrivesOnTurn: calcConsularArmyArrivalTurn(s.turnNumber, musterProvinceId),
        }
      : s.senateResponse;

    const label = turnLabel(s);
    set({
      denarii:        s.denarii - cost,
      family:         updatedFamily,
      senateResponse,
      log: [...s.log, mkLog(label, `${character.name} raises a legion in ${musterProvinceId}. (−${cost} Denarii)`, 'neutral')],
    });
  },

  musterVeterans: (characterId) => {
    const s = get();
    const character = s.family.find(c => c.id === characterId);
    if (!character || character.veterans.length === 0) return;

    // Always unsanctioned cost basis (personal troops called back to service)
    const cost = calcLevyCost(30, s.crisisLevel, false);
    if (s.denarii < cost) return;

    const updatedFamily = s.family.map(c =>
      c.id === characterId
        ? { ...c, veterans: c.veterans.map(v => ({ ...v, yearsInactive: 0 })) }
        : c
    );

    const label = turnLabel(s);
    set({
      denarii: s.denarii - cost,
      family:  updatedFamily,
      log: [...s.log, mkLog(label, `${character.name} musters veterans back to service. (−${cost} Denarii)`, 'neutral')],
    });
  },

  disbandTroops: (characterId, troopIds) => {
    set(s => ({
      family: s.family.map(c =>
        c.id === characterId
          ? { ...c, raisedLegions: c.raisedLegions.filter(t => !troopIds.includes(t.id)) }
          : c
      ),
    }));
  },

  updateLocalSupportForPlayer: (provinceId, delta) => {
    set(s => ({
      provinces: s.provinces.map(p =>
        p.id === provinceId
          ? { ...p, localSupport: Math.min(100, Math.max(0, p.localSupport + delta)) }
          : p
      ),
    }));
  },

  startCampaign: (provinceId, type) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province || province.activeCampaign) return;

    // Commander: player family member who is currently governor, otherwise NPC (null)
    const governorCharId = province.playerGovernor?.characterId ?? null;
    const commanderCharacterId = (governorCharId && s.family.some(c => c.id === governorCharId))
      ? governorCharId
      : null;

    const newCampaign: CampaignState = {
      id:                `campaign-${Date.now()}`,
      provinceId,
      type,
      commanderCharacterId,
      campaignProgress:  0,
      enemyStrength:     50,
      turnsElapsed:      0,
      localSupportBonus: province.localSupport >= 40,
      resolved:          false,
      outcome:           null,
      activeEventId:     null,
    };

    const label = turnLabel(s);
    set({
      provinces: s.provinces.map(p =>
        p.id === provinceId ? { ...p, activeCampaign: newCampaign } : p
      ),
      log: [...s.log, mkLog(
        label,
        `${type.replace(/_/g, ' ')} campaign begins in ${provinceId.replace(/_/g, ' ')}.`,
        'neutral',
      )],
    });
  },

  volunteerOfficer: (provinceId, characterId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province?.activeCampaign) return;
    const character = s.family.find(c => c.id === characterId);
    if (!character) return;

    const volunteer: OfficerVolunteerState = {
      campaignId:        province.activeCampaign.id,
      provinceId,
      characterId,
      characterName:     character.name,
      decisionsResolved: 0,
      successCount:      0,
      decisions:         [],
      resolved:          false,
    };

    const label = turnLabel(s);
    set({
      provinces: s.provinces.map(p =>
        p.id === provinceId ? { ...p, officerVolunteer: volunteer } : p
      ),
      log: [...s.log, mkLog(
        label,
        `${character.name} volunteers as officer in ${provinceId.replace(/_/g, ' ')}.`,
        'neutral',
      )],
    });
  },

  resolveOfficerDecision: (provinceId, decisionIndex, tookRisk) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    const volunteer = province?.officerVolunteer;
    if (!volunteer || volunteer.resolved || volunteer.decisionsResolved !== decisionIndex) return;

    const character = s.family.find(c => c.id === volunteer.characterId);
    const martial = character?.skills.martial ?? 0;

    // Safe:  50% base + 4% per martial point → martial 10 = 90%
    // Risk:  35% base + 6% per martial point → martial 10 = 95%, but lower floor
    const successChance = tookRisk
      ? 0.35 + martial * 0.06
      : 0.50 + martial * 0.04;
    const success = Math.random() < successChance;

    const newDecisionsResolved = volunteer.decisionsResolved + 1;
    const newSuccessCount = volunteer.successCount + (success ? 1 : 0);
    const resolved = newDecisionsResolved >= 3;

    const updatedVolunteer: OfficerVolunteerState = {
      ...volunteer,
      decisionsResolved: newDecisionsResolved,
      successCount:      newSuccessCount,
      decisions:         [...volunteer.decisions, { decisionId: `decision-${decisionIndex}`, tookRisk, success }],
      resolved,
    };

    const label = turnLabel(s);
    set({
      provinces: s.provinces.map(p =>
        p.id === provinceId ? { ...p, officerVolunteer: updatedVolunteer } : p
      ),
      log: [...s.log, mkLog(
        label,
        `${volunteer.characterName} — officer decision ${newDecisionsResolved}/3: ${success ? 'success' : 'failed'}.`,
        success ? 'positive' : 'negative',
      )],
    });
  },

  // ── Canvassing ─────────────────────────────────────────────────────────────

  canvassLeader: (leaderId) => {
    const s = get();
    if (!s.campaigning) return;
    if (s.fides < CANVASS_FIDES_COST) return;
    if (s.campaignVotes[leaderId] === 'for') return;

    let foundLeader: (typeof s.clans[0]['leaders'][0]) | null = null;
    let foundClanId: string | null = null;
    for (const clan of s.clans) {
      const l = clan.leaders.find(l => l.id === leaderId);
      if (l) { foundLeader = l; foundClanId = clan.id; break; }
    }
    if (!foundLeader || !foundClanId) return;
    if (foundLeader.relationship < CANVASS_MIN_RELATIONSHIP) return;

    const clanHasRival = s.electionRivals.some(r => r.clanId === foundClanId);
    const threshold = calcOfficeThreshold(s.campaigning);
    const effectiveThreshold = clanHasRival ? threshold * 2 : threshold;

    const playerChar = s.family.find(c => c.isPlayer);
    const rhetoric = playerChar?.skills.rhetoric ?? 0;
    const roll = calcCanvassRoll(rhetoric, foundLeader.relationship);
    const newFides = s.fides - CANVASS_FIDES_COST;
    const label = turnLabel(s);

    if (Math.random() < CANVASS_EVENT_CHANCE && !s.activeCanvassingEvent) {
      const event = CANVASSING_EVENTS[Math.floor(Math.random() * CANVASSING_EVENTS.length)];
      set({
        fides:                   newFides,
        activeCanvassingEvent:   event,
        pendingCanvassLeaderId:  leaderId,
        pendingCanvassRoll:      roll,
        pendingCanvassThreshold: effectiveThreshold,
      });
      return;
    }

    const success = roll >= effectiveThreshold;
    set({
      fides: newFides,
      campaignVotes: success
        ? { ...s.campaignVotes, [leaderId]: 'for' as const }
        : s.campaignVotes,
      log: [...s.log, mkLog(
        label,
        success
          ? `${foundLeader.name} pledges their support to your campaign.`
          : `${foundLeader.name} was not persuaded.${clanHasRival ? ' Their gens backs a rival candidate.' : ''}`,
        success ? 'positive' : 'neutral',
      )],
    });
  },

  resolveCanvassingEvent: (optionId) => {
    const s = get();
    const event = s.activeCanvassingEvent;
    const leaderId = s.pendingCanvassLeaderId;
    if (!event || !leaderId) return;

    const option = event.options.find(o => o.id === optionId);
    if (!option) return;
    if (option.cost?.resource === 'fides'   && s.fides   < option.cost.amount) return;
    if (option.cost?.resource === 'denarii' && s.denarii < option.cost.amount) return;

    let foundLeader: (typeof s.clans[0]['leaders'][0]) | null = null;
    for (const clan of s.clans) {
      const l = clan.leaders.find(l => l.id === leaderId);
      if (l) { foundLeader = l; break; }
    }
    if (!foundLeader) return;

    let rollBonus = 0;
    let flavour = '';

    if (option.skillCheck) {
      const playerChar = s.family.find(c => c.isPlayer);
      const rhetoric = playerChar?.skills.rhetoric ?? 0;
      const checkRoll = Math.random() * 100 + rhetoric * 5;
      const checkSuccess = checkRoll >= option.skillCheck.difficulty;
      rollBonus = checkSuccess
        ? option.skillCheck.bonusOnSuccess
        : option.skillCheck.penaltyOnFail;
      flavour = checkSuccess ? option.flavorSuccess : (option.flavorFail ?? '');
    } else {
      flavour = option.flavorSuccess;
    }

    const finalRoll = s.pendingCanvassRoll + rollBonus;
    const success = !!(option.immediateSuccess) || (finalRoll >= s.pendingCanvassThreshold);
    const label = turnLabel(s);

    const result: CanvassingEventResult = {
      success,
      leaderName: foundLeader.name,
      flavour,
    };

    set({
      fides:   s.fides   - (option.cost?.resource === 'fides'   ? option.cost.amount : 0),
      denarii: s.denarii - (option.cost?.resource === 'denarii' ? option.cost.amount : 0),
      campaignVotes: success
        ? { ...s.campaignVotes, [leaderId]: 'for' as const }
        : s.campaignVotes,
      activeCanvassingEvent:   null,
      canvassingEventResult:   result,
      pendingCanvassLeaderId:  null,
      pendingCanvassRoll:      0,
      pendingCanvassThreshold: 0,
      log: [...s.log, mkLog(
        label,
        `${foundLeader.name}: ${flavour}${success ? ' They pledge their support.' : ''}`,
        success ? 'positive' : 'neutral',
      )],
    });
  },

  dismissCanvassingResult: () => set({ canvassingEventResult: null }),
}));
