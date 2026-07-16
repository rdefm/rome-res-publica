import { create } from 'zustand';
import type { Character, PendingSuccession, Regency, CadetBranch } from '../models/character';
import type { Bill, ActiveLaw } from '../models/bill';
import type { Clan } from '../models/clan';
import type { OfficeId, ElectionRival } from '../models/office';
import type { Client } from '../models/client';
import type { EventInstance, EventChoice } from '../models/event';
import type { OwnedAsset } from '../models/asset';
import type { OwnedHouse, RoomType, BusinessType } from '../models/house';
import type { ActiveAmbition } from '../models/ambition';
import type { LegacyObjective } from '../models/legacyObjective';
import type { PatronTier } from '../models/patronLadder';
import type { TrialState, TrialApproach, ChargeId, ChargeSource } from '../models/trial';
import type { Secret, PendingSecretDemand, LatentSecret } from '../models/secret';
import type { ProvinceState, GovernorPolicy, CampaignState, OfficerVolunteerState } from '../models/province';
import { getRelationshipTier } from '../models/province';
import type { TroopUnit } from '../models/troop';
import type { SenateResponseState } from '../engine/senateResponseEngine';
import type { CrisisState, CrisisTrackId } from '../models/crisis';
import type { OfficeActionTargetContext } from '../engine/officeActionEngine';
// ── Phase 1 (P1-A) ────────────────────────────────────────────────────────────
import type { StartId } from '../models/gameStart';
import type { AgendaTarget, TabName } from '../models/agenda';
import type { SeasonLedger } from '../models/ledger';
import { calcLevyCost } from '../engine/troopEngine';
import {
  calcConsularArmyStrength,
  calcConsularArmyArrivalTurn,
} from '../engine/senateResponseEngine';
import {
  calcOfficeThreshold,
  calcCanvassRoll,
  CANVASS_MIN_RELATIONSHIP,
  CANVASS_EVENT_CHANCE,
  generateRivals,
  getCanvassFidesCost,
} from '../engine/electionEngine';
import { CANVASSING_EVENTS } from '../data/canvassingEvents';
import type { CanvassingEvent, CanvassingEventResult } from '../data/canvassingEvents';
import { STARTING_FAMILY } from '../data/startingFamily';
import { STARTING_CLANS } from '../data/startingClans';
import { STARTING_BILLS } from '../data/billTemplates';
import { buildInitialProvinceStates, getProvinceDefinition } from '../data/provinceDefinitions';
import { processSeason } from '../engine/turnSequencer';
import { incrementLegacy, initLegacyObjectives } from '../engine/legacyEngine';
import { LEGACY_DEFINITIONS } from '../data/legacyDefinitions';
import { adjustReputation, computeReputationDelta } from '../engine/reputationEngine';
import {
  attemptGather,
  isDeterred,
  computeLeverageBillSupportDelta,
  computeBurnVoteLoss,
  payOffCost,
  attemptDiscredit,
  resolveSecretDemand,
  mapSecretTypeToTrialCharge,
  resolveClaudiusDefiance,
} from '../engine/secretEngine';
import {
  canFileProsecution,
  buildTrialState,
  convertLegacyTrial,
  computeTotalPrepStrength,
  gatherEvidenceCost,
  applyGatherEvidence,
  applyPresentSecretEvidence,
  applySecureWitness,
  applyPrepareOration,
  applyInvokeAncestors,
  applyBribeJurors,
  applyBribePraetor,
  applyIntimidateWitness,
  findOpponentLeader,
  resolveTrialOutcome,
} from '../engine/trialEngine';
import {
  evaluateBeatResponse,
  pickBestResponse,
  applyBeatOutcome,
  getTrialBeat,
  computeNpcPerformance,
} from '../engine/trialBeatEngine';
import { TRIAL_CHARGE_DEFS } from '../data/trialCharges';
import { CLIENT_NAMES } from '../data/clientNames';
import { SECRET_CLASS_BY_TYPE } from '../data/secretDefinitions';
import { CLAUDIUS_ARC_SECRET_ID, buildClaudiusStartingSecret } from '../data/claudiusArc';
import {
  resolveAmbassadorAction as engineResolveAmbassadorAction,
  type AmbassadorActionId,
  buildIncorporationBill,
  buildDeclareWarBill,
  getForeignWarTargetEnemyId,
  buildAmbassadorPostingBill,
} from '../engine/provinceEngine';
import { getProvinceAssetDefinition } from '../data/provinceAssets';
import { getHouseLocationDefinition } from '../data/houseLocations';
import { getProvincialClientDef } from '../data/provincialClients';
import { BALANCE } from '../data/balance';
import { calcTrainingCost } from '../engine/resourceEngine';
import type { SeasonStats } from '../models/telemetry';
// P2-F — Munificence
import { getMunificenceAct } from '../data/munificence';
import {
  checkMunificenceRequirements,
  getMunificenceCost,
  getMunificenceEffects,
} from '../engine/munificenceEngine';
import { applyTrackDelta } from '../engine/crisisEngine';
import { injectNoticeEvent } from '../engine/eventEngine';
// Military Overhaul M4 — battle bridge
import type { BattleState, BattleSide, BattleOutcome } from '../models/battle';
import {
  applyBattleOutcome,
  resolveRansomChoice,
  type BattleBridgeContext,
} from '../engine/battle/musterEngine';
// Military Overhaul M5 — battle session (deployment, orders, break decisions)
import type {
  Deployment, SideOrders, LaneId, LaneAssignment, TerrainMod, BattleUnit, UnitClass, Veterancy,
} from '../models/battle';
import {
  initBattle, submitOrders, submitBreakDecision, drawStratagemHand,
  type DeploySideInput,
} from '../engine/battle/battleEngine';
import { musterArmy, getEligibleFamilyCaptains } from '../engine/battle/musterEngine';
// Military Overhaul M7 — enemy general AI (sandbox deployment only; per-round
// orders/break decisions are computed in BattleScreen.tsx, which already
// owns the live battleState and the store's thin submit* wrappers).
import { chooseDeployment } from '../engine/battle/battleAi';
import { ENEMY_GENERAL_LIST, ENEMY_GENERALS } from '../data/enemyGenerals';
import { makeSeededRng } from '../utils/seededRng';
// Military Overhaul M11 — sandbox army builder (DebugPanel). Both sides go
// through battleAi.chooseDeployment (i.e. every side is a "stock profile"
// per the plan's army-builder spec) — the player can still hand-edit the
// result on DeploymentBoard before committing, same as every other sandbox
// entry point. The headless harness (battleSim.ts's simulateBattles) is
// called directly by DebugPanel — a pure function, no store involvement.
// Military Overhaul M9 — war score & set-piece scheduling
import type { WarState } from '../models/war';
import type { AncestorRecord, EpilogueOutcome } from '../models/epilogue';
import { scheduleSetPiece, applyTreatyEffects, buildTreatyBill, getDesperationTier, phaseForYear, type TreatySide } from '../engine/warEngine';
import { generateCadet } from '../engine/inheritanceEngine';

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
  /** P2-C: character IDs already trained this season (rate-limits trainCharacter to once/season). Reset in endSeason. */
  trainedThisSeason: string[];

  // ── Phase 3, Chunk P3-C — Succession & Regency ──────────────────────────
  /** Set when the paterfamilias dies (natural or battle) — see
   *  inheritanceEngine.detectPaterfamiliasDeath. Drives the scripted
   *  successionEvents.ts sequence; cleared by succeedPaterfamilias. */
  pendingSuccession: PendingSuccession | null;
  /** Set by succeedPaterfamilias when the confirmed heir is a minor. */
  regency: Regency | null;

  // ── Phase 3, Chunk P3-D — Cadet Branch ───────────────────────────────────
  /** Generated once at run start (gameStore.startGame) — see
   *  models/character.ts's CadetBranch doc comment. Never null after a run
   *  has started; old saves are lazily backfilled on load. */
  cadetBranch: CadetBranch | null;
  /** True once continueAsCadet has fired — extinction offers no second
   *  continuation (see inheritanceEngine's detectPaterfamiliasDeath caller
   *  in turnSequencer.ts/musterEngine.ts). */
  cadetBranchUsed: boolean;
  /** 1 normally; BALANCE.cadet.legacyPenaltyMult (0.5) once a cadet
   *  continuation has occurred. Read by epilogueEngine.ts (P3-E). */
  legacyPenaltyMult: number;

  // ── Phase 3, Chunk P3-E — cross-generation tracking ──────────────────────
  // heldOffices/currentOffice are cleared on every succession (a fresh
  // cursus per P3-C/D's applySuccession/promoteCadetToParterfamilias — this
  // codebase tracks "the player's" career at the GameState level, not per-
  // Character), so the epilogue's "highest office ever held in the family"
  // and "how many generations" need their own persistent fields, updated
  // right before that clearing happens each succession.
  /** OfficeId of the single highest-prestige office any paterfamilias this
   *  run has held, across all generations. Null if none ever held one. */
  highestOfficeEverHeld: string | null;
  /** Count of paterfamilias this run has had, including the starting one
   *  (so this starts at 1, not 0). */
  paterfamiliasGenerations: number;
  /** GameState.year at run start (startGame) — always -264 today (no
   *  alternate starts exist), stored rather than assumed so a future start
   *  variant doesn't need epilogueEngine.ts touched. */
  gensFoundedYear: number;
  /** Set true once an epilogue has fired (E1) — App.tsx routes a finished
   *  save back to the start menu / Hall rather than a dead board on
   *  reopen, unless Endless mode (P3-F) un-finishes it. */
  runFinished: boolean;
  /** The record built the moment runFinished flips true — plain JSON data
   *  (not transient UI-only state like activeBattle/activeEvent), so it is
   *  NOT stripped before save; EpilogueScreen reads it directly rather than
   *  re-deriving or re-fetching from the Hall's cross-run storage. */
  currentEpilogueRecord: AncestorRecord | null;
  /** Phase 3, Chunk P3-F — set true only via enterEndlessMode (a Victory
   *  epilogue's "Continue in Endless Mode" button). Read by turnSequencer.ts
   *  (skips the Crisis-100 hard terminal), warEngine.ts's processWarSeason
   *  (no-ops any 'major'-scale war — moot today since the only major war is
   *  already inactive/terminalOutcome-set by the time Endless is reachable,
   *  but guards a future authored war from scoring silently), and
   *  agendaEngine.ts's #20/#21 (same reasoning). Never read by succession,
   *  the cadet branch, or Hall of Ancestors — those keep functioning
   *  normally, per the plan's "a family can still die out in Endless"
   *  design call. */
  endlessMode: boolean;

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

  // ── Phase 4, Chunk P4-A — Secrets ──────────────────────────────────────────
  // Single array (plan's recommendation) filtered by `holder` for the two
  // views — deterrence checks (P4-B) are a two-way scan either way.
  secrets: Secret[];
  // ── Player-choice blackmail — compromising facts nobody holds yet ─────────
  // Planted by resourceEngine's `createLatentSecret:` token (see
  // data/compromisingEvents.ts); promoted into an ordinary Secret by
  // secretEngine.latentSecretDiscoveryTick (turnSequencer step 9b). See
  // models/secret.ts's LatentSecret doc comment.
  latentSecrets: LatentSecret[];
  // ── Phase 4, Chunk P4-B — pending NPC demand ───────────────────────────────
  // See models/secret.ts's PendingSecretDemand doc comment.
  pendingSecretDemand: PendingSecretDemand | null;
  // ── Phase 4, Chunk P4-G — the Claudius arc's "Play for time" counter ──────
  // Non-null exactly while a deferred demand is counting down (set by
  // evt-claud-01's 'wait' choice); turnSequencer.ts step 9b decrements it
  // each season and auto-resolves to defiance at 0, or cancels it outright
  // if deterrence kicks in first. null the rest of the time.
  claudiusPatience: number | null;

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

  // Assets (Feature 1) — now only ever holds the 4 assets relocated to
  // Provinciae → Latium (vineyard/gladiator_school/urban_insulae/baths).
  // The player's own residence lives in `house` below (Family House rework).
  ownedAssets: OwnedAsset[];

  // Family House (replaces Patrimonium-as-a-personal-asset-catalog). Never
  // null in practice — a starter house is granted at game start (see
  // INITIAL_STATE below) so the player is never "homeless."
  house: OwnedHouse;

  // Ambitions (Feature 3)
  ambitions: ActiveAmbition[];

  // Legacy Objectives (Feature 4)
  legacyObjectives: LegacyObjective[];

  // Patron Ladder (Feature 7)
  patronTier: PatronTier;
  lifetimeDignitas: number;

  // Trials (Feature 6, reworked Phase 4, Chunk P4-C — "one pipeline, two seats")
  trials: TrialState[];
  /** Phase 4, Chunk P4-D — transient UI field, same pattern as
   *  selectedCharacterId/uiNavRequest: set by an agenda deep-link
   *  (target.trialId) or CuriaScreen's "Open the Basilica" button via
   *  requestNavigation; CursusScreen watches it to open the sheet, then
   *  clears it. Excluded from persistence (see saveLoad.ts's transient list). */
  selectedTrialId: string | null;
  /** The tab the player was actually on right before a `requestNavigation`
   *  with a `trialId` payload switched them to Cursus to open the Basilica
   *  (App.tsx's uiNavRequest effect sets this — null if they were already
   *  on Cursus). CursusScreen's closeBasilica reads it to return the player
   *  to where they came from instead of stranding them on Cursus — e.g.
   *  CuriaScreen's "Open the Basilica" button used to leave the player on
   *  the Cursus tab even after dismissing the sheet. Transient UI field,
   *  excluded from persistence. */
  basilicaReturnTab: TabName | null;

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

  // ── Military Overhaul M9 — war score & set-piece scheduling ─────────────
  // An array (not a single `war`) — a deliberate scope decision to support
  // multiple concurrent wars as more regions are added later. Persisted
  // (survives save/load); each war starts/ends via the debug actions below
  // until Phase 3A supplies a real trigger — see warEngine.ts's header
  // comment for the full reconciliation.
  wars: WarState[];

  // ── Phase 3, Chunk P3-A/P3-D — epilogue signal ───────────────────────────
  /** Set by warEngine.processWarSeason (statePatch.pendingEpilogue) when a
   *  'major'-scale war concludes (P3-A — 'victory'/'exhaustion'/'humbled'),
   *  by the extinction path (P3-D — 'gens_ends'), or by the Crisis-100
   *  hard terminal (P3-E — 'republic_falls'). Consumed exactly once by
   *  gameStore.endSeason's epilogue-detection block, which builds the
   *  AncestorRecord and sets runFinished — see that block's comment.
   *  Typed via models/epilogue.ts's EpilogueOutcome (the P3-A/D inline
   *  unions this replaced are gone now that P3-E's full type exists). */
  pendingEpilogue: EpilogueOutcome | null;

  // ── Military Overhaul M5 — battle session state ─────────────────────────
  // Transient UI/session state — stripped before save (saveLoad.ts), same
  // treatment as activeEvent. Deployment is staged client-side (local
  // component state in DeploymentBoard, seeded from activeBattleSetup) —
  // battleEngine.initBattle only runs once "Give Battle" commits it, which
  // is when activeBattle actually appears.
  activeBattleSetup: {
    attackerInput: DeploySideInput;
    defenderInput: DeploySideInput;
    terrain: TerrainMod;
    seed: number;
    bridgeCtx: BattleBridgeContext;
  } | null;
  activeBattle: BattleState | null;
  /** Carried over from activeBattleSetup.bridgeCtx at commitDeployment time
   *  (activeBattleSetup itself is cleared once the battle starts) — needed
   *  by returnFromBattle to call resolveBattleOutcome (M4) once the battle
   *  finishes, arbitrarily many rounds later. */
  activeBattleBridgeCtx: BattleBridgeContext | null;

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

  // ── Phase 2 — Instrumentation / telemetry (P2-A) ───────────────────────────
  // Local-only playtest telemetry for balance tuning (Chunk P2-E). No network
  // calls, no remote analytics — never leaves the device.
  /** Epoch ms when the current season began. Reset on new game and after each endSeason. */
  seasonStartedAt: number;
  /** Count of meaningful player actions taken this season. Reset each endSeason.
   *  The counted-action set is defined in Chunk P2-E. */
  actionsThisSeason: number;
  /** Fides spent on player actions this season. Reset each endSeason. */
  fidesSpentThisSeason: number;
  /** Denarii spent on player actions this season. Reset each endSeason. */
  denariiSpentThisSeason: number;
  /** Ring buffer (cap 40) of completed-season stats, pushed by endSeason before counters reset. */
  seasonStatsHistory: SeasonStats[];

  // ── Munificence (P2-F) ───────────────────────────────────────────────────────
  /** Ids of built Public Endowments. Each grants +BALANCE.munificence.publicEndowment.endowmentFidesPerSeason Fides/season (resourceEngine). */
  endowments: string[];
  /** Per-act usage tracking, keyed by MunificenceAct id. usesThisYear resets at the yearly rollover (turnSequencer, same gate as P2-D). */
  munificenceUsage: Record<string, { lastUsedTurn?: number; usesThisYear?: number; totalUses?: number }>;
  /** Standing (non-consumed) vote bonus from Grand Games — applied to every election in electionEngine while > 0.
   *  Decays by BALANCE.munificence.grandGames.electionVoteBonusDecayPerInterval every
   *  electionVoteBonusDecayIntervalYears (turnSequencer yearly rollover). Recasting Grand Games refreshes it. */
  grandGamesVoteBonus: number;
  /** Years remaining until the next decay tick on grandGamesVoteBonus. 0 when the bonus is inactive. */
  grandGamesBonusYearsUntilDecay: number;
}

export interface GameActions {
  // Turn
  endSeason: () => void;
  dismissSeasonOverlay: () => void;
  /** Phase 5, Chunk P5-A — DebugPanel's auto-season runner. Calls endSeason
   *  n times with no player input: any fired event is auto-answered with
   *  its first guaranteed (no-skillCheck) choice (falling back to the first
   *  choice if every choice rolls), any trial that enters 'in_session' is
   *  driven via fastResolveTrialSession, any birth naming is confirmed with
   *  its suggested name, and the season overlay is dismissed each
   *  iteration. Stops early if the run concludes (runFinished). Returns how
   *  many seasons actually completed and a note on anything that couldn't
   *  be auto-driven (the event-chain guard tripping — see implementation). */
  runIdleSeasons: (n: number) => { seasonsCompleted: number; stuckReason: string | null };

  // ── Phase 3, Chunk P3-E ───────────────────────────────────────────────────
  /** From EpilogueScreen — routes back to StartMenuScreen (App.tsx's
   *  existing `if (!gameStarted)` gate). Does not clear the finished save;
   *  reopening it (Continue) re-shows the same epilogue, which is
   *  correct — nothing to acknowledge/dismiss beyond navigating away. */
  returnToStartMenu: () => void;

  // ── Phase 3, Chunk P3-F ───────────────────────────────────────────────────
  /** From EpilogueScreen — only ever offered on a 'victory' record. Resumes
   *  the same save past 241 BC: un-finishes the run (so the board reopens
   *  instead of the epilogue) and clears pendingEpilogue (leaving it set
   *  would make the very next endSeason immediately re-detect the same
   *  epilogue and re-finish the run before the player took a single turn).
   *  currentEpilogueRecord is left as-is — harmless, since EpilogueScreen
   *  gates on runFinished, and it'll be overwritten if a later ending
   *  (e.g. a second, cadet-branch extinction) ever fires in Endless. */
  enterEndlessMode: () => void;

  // Resources
  spendResource: (resource: 'fides' | 'denarii', amount: number) => void;

  // Domus
  selectCharacter: (id: string) => void;
  trainCharacter: (characterId: string, skill: keyof Character['skills']) => void;
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

  // Munificence (P2-F)
  performMunificence: (actId: string) => void;

  // Forum
  expandClan: (clanId: string) => void;
  selectLeader: (leaderId: string) => void;
  buyInfluence: (leaderId: string) => void;
  inviteToDinner: (leaderId: string) => void;
  forgeAlliance: (leaderId: string) => void;
  arrangeMarriageForum: (leaderId: string) => void;
  gatherIntelligence: (leaderId: string, agentId: string) => void;
  canvassForVotes: (leaderId: string) => void;

  // Phase 4, Chunk P4-B — Secret verbs
  leverageSecretForBill: (secretId: string, billId: string, direction: 'for' | 'against') => void;
  leverageSecretForElection: (secretId: string) => void;
  extortSecret: (secretId: string) => void;
  stopExtortion: (secretId: string) => void;
  burnSecret: (secretId: string) => void;
  payOffSecret: (secretId: string) => void;
  discreditSecret: (secretId: string, agentId: string) => void;

  // Cursus
  declareCampaign: (officeId: OfficeId) => void;
  useOfficeAction: (actionId: string) => void;

  // Clientela
  addClient: (type: ClientType, name: string, flavourTitle: string, flavourText: string) => void;
  removeClient: (clientId: string) => void;

  // Assets (Feature 1) — now Provinciae → Latium's holdings
  purchaseAsset: (definitionId: string) => void;
  upgradeAsset: (definitionId: string) => void;

  // Family House
  buyHouse: (locationId: string) => void;
  buildRoom: (type: RoomType) => void;
  rentShop: (slotIndex: number, businessType: BusinessType) => void;
  vacateShop: (slotIndex: number) => void;

  // Cursus — family member campaigns
  declareFamilyCampaign: (characterId: string, officeId: OfficeId) => void;

  // Ambitions
  selectAmbition: (definitionId: string, scope: 'family' | 'character', assignedCharacterId?: string) => void;
  dismissAmbitionSelection: () => void;
  clearAmbitionScope: (scope: 'family' | 'character') => void;
  requestAmbitionChange: (scope: 'family' | 'character') => void;

  // Reputation
  adjustClanReputation: (clanId: string, delta: number, clanName: string) => void;

  // Trials — Phase 4, Chunk P4-C
  fileProsecution: (targetLeaderId: string, startDelay: number, speakerId?: string) => void;
  setTrialApproach: (trialId: string, approach: TrialApproach) => void;
  setTrialSpeaker: (trialId: string, characterId: string) => void;
  // Trials — the Basilica's prep catalog (Phase 4, Chunk P4-D). Supersedes
  // takeTrialAction/TRIAL_ACTIONS (retired) — every verb, both seats.
  gatherTrialEvidence: (trialId: string, agentId: string) => void;
  presentSecretAsEvidence: (trialId: string, secretId: string) => void;
  secureTrialWitness: (trialId: string) => void;
  prepareTrialOration: (trialId: string) => void;
  invokeTrialAncestors: (trialId: string) => void;
  bribeTrialJurors: (trialId: string, clanId: string) => void;
  bribeTrialPraetor: (trialId: string) => void;
  intimidateTrialWitness: (trialId: string) => void;
  selectTrialForBasilica: (trialId: string | null) => void;
  setBasilicaReturnTab: (tab: TabName | null) => void;
  // Trial day — Phase 4, Chunk P4-E
  answerTrialBeat: (trialId: string, beatId: string, responseId: string) => void;
  fastResolveTrialSession: (trialId: string) => void;

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
  proposeIncorporationBill: (provinceId: string) => void;
  proposeDeclareWarBill: (provinceId: string) => void;
  seekAmbassadorPosting: (provinceId: string) => void;
  purchaseProvinceAsset: (provinceId: string, assetId: string) => void;
  upgradeProvinceAsset: (provinceId: string, assetId: string) => void;
  recruitProvincialClient: (provinceId: string, clientId: string) => void;
  updateProvinces: (provinces: ProvinceState[]) => void;

  // ── Military (Chunk M) ──────────────────────────────────────────────────
  raiseLevy: (characterId: string, musterProvinceId: string) => void;
  musterVeterans: (characterId: string) => void;
  disbandTroops: (characterId: string, troopIds: string[]) => void;
  /** Military Overhaul M8 — army-scope, once per year (see the action's own comment). */
  payDonative: (characterId: string) => void;
  updateLocalSupportForPlayer: (provinceId: string, delta: number) => void;
  startCampaign: (provinceId: string, type: CampaignState['type']) => void;
  volunteerOfficer: (provinceId: string, characterId: string) => void;
  resolveOfficerDecision: (provinceId: string, decisionIndex: number, tookRisk: boolean) => void;

  // ── Military Overhaul M4 — battle bridge ──────────────────────────────────
  // Thin wrappers over musterEngine.ts's pure functions (per the plan's
  // cross-chunk note). Callers pass the finished BattleState/BattleOutcome
  // directly (M5's returnFromBattle is the one production caller now; this
  // shape is also exactly what a headless debug harness needs).
  resolveBattleOutcome: (
    battleState: BattleState,
    romeSide: BattleSide,
    outcome: BattleOutcome,
    ctx: BattleBridgeContext,
  ) => void;
  payRansom: (characterId: string) => void;
  negotiateRansom: (characterId: string) => void;
  refuseRansom: (characterId: string) => void;

  // ── Military Overhaul M5 — battle session (deployment, orders, UI entry) ──
  /** Debug-only entry point (DebugPanel "Launch Sandbox Battle" — M11 expands
   *  this into a full army builder). Musters the player's own family/troops
   *  as the attacker (synthesizing a small starting force if they have none,
   *  so the M4 write-back has real records to exercise) against a synthetic
   *  Carthaginian defender, and stages it in activeBattleSetup. */
  startSandboxBattle: () => void;
  /** Military Overhaul M11 — DebugPanel's full army builder. Both sides are
   *  built entirely from the given unit lists and staged via
   *  battleAi.chooseDeployment against the given stock general profiles
   *  (decoupled from the player's real family/troops, unlike
   *  startSandboxBattle — this is for reproducing arbitrary compositions,
   *  not roleplaying the current save). No M4/M8 write-back bridge context
   *  is meaningful here (no real strategic-layer army to update), so
   *  returnFromBattle no-ops its resolveBattleOutcome call for this session
   *  (bridgeCtx.troopOwnerCharacterId is set to a sentinel that doesn't
   *  match any real character). */
  startCustomSandboxBattle: (
    attackerUnits: BattleUnit[],
    attackerGeneralProfileId: string,
    defenderUnits: BattleUnit[],
    defenderGeneralProfileId: string,
    terrainId: string,
    seed?: number,
  ) => void;
  /** DeploymentBoard calls this once the player presses "Give Battle" — runs
   *  battleEngine.initBattle with the (possibly player-edited) deployments
   *  staged locally in the component, and sets activeBattle. */
  commitDeployment: (attackerDeployment: Deployment, defenderDeployment: Deployment) => void;
  cancelDeployment: () => void;
  submitBattleOrders: (ordersAttacker: SideOrders, ordersDefender: SideOrders) => void;
  submitBattleBreakDecision: (laneId: LaneId, decision: 'pursue' | 'wheel', targetLane?: LaneId) => void;
  /** "Return to Rome" — applies the M4 write-back via resolveBattleOutcome
   *  using the bridgeCtx captured at deployment time, then clears activeBattle. */
  returnFromBattle: () => void;

  // ── Military Overhaul M9 — war score & set-piece scheduling ──────────────
  /** Debug-only entry point (no real "declare war" trigger exists yet — see
   *  warEngine.ts's header comment). No-ops if an active war already exists
   *  against the same enemyId. */
  startWar: (enemyId: string, scale: WarState['scale'], provinceId?: string | null) => void;
  /** Debug-only — marks a war inactive (kept in `wars` for any later
   *  treaty/history reference, not removed). */
  endWar: (warId: string) => void;
  /** Debug-only — bypasses the scheduler's spacing/roll gate (still goes
   *  through warEngine.scheduleSetPiece, the sole offer source). No-ops if
   *  an offer is already pending for this war. */
  forceSetPieceOffer: (warId: string) => void;
  /** SetPieceOfferModal's "Give Battle" — musters the player's own army as
   *  attacker, deploys the offer's pre-generated enemy army (via
   *  battleAi.chooseDeployment) as defender, and stages activeBattleSetup
   *  exactly like startSandboxBattle, but with bridgeCtx.warId set so
   *  returnFromBattle's write-back feeds the outcome back into this war. */
  acceptSetPieceOffer: (warId: string) => void;
  /** SetPieceOfferModal's "Decline" — same consequence as an unanswered
   *  offer expiring (see BALANCE.war.setPieceOffer). */
  declineSetPieceOffer: (warId: string) => void;

  // ── Military Overhaul M10 — peace: negotiation & Senate ratification ─────
  /** Sue-tier AI offer, "Accept" — applies the offer's terms immediately
   *  (no Senate vote at this tier), ends the war. No-ops without a pending
   *  war.treaty at stage 'ai_offer'. */
  acceptAiTreatyOffer: (warId: string) => void;
  /** Sue-tier AI offer, "Refuse" — costs nothing mechanical per the plan
   *  beyond a small dignitas ding (BALANCE.war.treaty
   *  .refuseAiOfferLifetimeDignitasPenalty); war continues, offer cleared. */
  refuseAiTreatyOffer: (warId: string) => void;
  /** Tables a term package as a special Senate bill (warEngine.buildTreatyBill),
   *  through the existing bill pipeline — resolves on a normal season-end
   *  pass like any other bill. Gated on currentOffice === 'consul' per the
   *  M10 scope decision (negotiation is a consular act). No-ops if the war
   *  already has a treaty pending, or during the 4-turn re-table lockout
   *  after a failed ratification. */
  tableTreaty: (warId: string, termIds: string[]) => void;

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

// ─── Military Overhaul M5 — sandbox battle helpers ───────────────────────────
// Debug-only content (DebugPanel "Launch Sandbox Battle"). M11 replaces this
// with a real army builder — kept intentionally minimal here.

/** Spreads units across the three lanes (cavalry restricted to wings, per
 *  battleEngine.initBattle's validation), all in 'line' formation, no
 *  captains assigned — the player can reassign everything on the
 *  DeploymentBoard before committing. */
function buildDefaultDeployment(units: BattleUnit[]): Deployment {
  const isCavalry = (u: BattleUnit) => u.unitClass === 'cavalry_heavy' || u.unitClass === 'cavalry_light';
  const cavalry = units.filter(isCavalry);
  const rest = units.filter(u => !isCavalry(u));

  const left: BattleUnit[] = [];
  const centre: BattleUnit[] = [];
  const right: BattleUnit[] = [];

  cavalry.forEach((u, i) => (i % 2 === 0 ? left : right).push(u));
  rest.forEach((u, i) => {
    const slot = i % 3;
    (slot === 0 ? left : slot === 1 ? centre : right).push(u);
  });

  const lanes: Record<LaneId, LaneAssignment> = {
    left:   { units: left,   captainId: null, formation: 'line' },
    centre: { units: centre, captainId: null, formation: 'line' },
    right:  { units: right,  captainId: null, formation: 'line' },
  };
  return { lanes, reserve: [], commanderStation: 'centre' };
}

/** A fixed, flavorful Carthaginian preset — no strategic backing (enemy
 *  armies aren't strategic records in this game, per musterEngine.ts). */
function buildSandboxDefenderArmy(): BattleUnit[] {
  const mk = (id: string, unitClass: UnitClass, veterancy: Veterancy = 'trained'): BattleUnit => ({
    id, unitClass, strength: 90, veterancy, loyalty: 60, elephantSteady: false,
  });
  return [
    mk('cart-1', 'spear_foot'), mk('cart-2', 'spear_foot'), mk('cart-3', 'spear_foot'),
    mk('cart-4', 'skirmisher'), mk('cart-5', 'skirmisher'),
    mk('cart-6', 'cavalry_light'), mk('cart-7', 'cavalry_heavy'),
    mk('cart-8', 'elephant', 'veteran'),
  ];
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
  selectedTrialId: null,
  basilicaReturnTab: null,
  trainedThisSeason: [],
  pendingSuccession: null,
  regency: null,
  // P3-D — real value assigned by startGame (generateCadet()); null here is
  // only ever seen transiently between INITIAL_STATE construction and
  // startGame's set() call.
  cadetBranch: null,
  cadetBranchUsed: false,
  legacyPenaltyMult: 1,
  highestOfficeEverHeld: null,
  paterfamiliasGenerations: 1,
  gensFoundedYear: -264,
  runFinished: false,
  currentEpilogueRecord: null,
  endlessMode: false,

  bills: STARTING_BILLS,
  _expandedBill: null,
  _expandedType: null,
  billIdSeq: 1000,

  clans: STARTING_CLANS,
  expandedClanId: null,
  selectedLeaderId: null,
  // Phase 4, Chunk P4-G — the Claudius arc's starting Secret (design point 1,
  // "exists from game start"). acquiredSeason: 1 matches turnNumber's own
  // starting value above, so scanNpcSecretDecisions' `acquiredSeason <
  // turnNumber` pacing guard excludes it from the generic scan on turn 1
  // (turnSequencer.ts step 9b also excludes it by id explicitly — belt and
  // braces, since that guard alone wouldn't survive turn 2 onward).
  secrets: [buildClaudiusStartingSecret('pc-1', 1)],
  latentSecrets: [],
  pendingSecretDemand: null,
  claudiusPatience: null,

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
  // Family House — a modest starter house in the Subura, free, nothing built
  // yet (the player is never "homeless"). shopSlots read from the location
  // def itself rather than hardcoded, so it can't drift out of sync.
  house: {
    locationId: 'subura',
    builtRooms: [],
    shops: Array(getHouseLocationDefinition('subura')?.shopSlots ?? 0).fill(null),
    turnAcquired: 1,
  },
  familyReputations: INITIAL_FAMILY_REPUTATIONS,
  ambitions: [],
  legacyObjectives: initLegacyObjectives(),
  patronTier: 0,
  lifetimeDignitas: 0,
  trials: [],

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

  // Military Overhaul M9 — war score
  wars: [],
  pendingEpilogue: null,

  // Military Overhaul M5 — battle session
  activeBattleSetup: null,
  activeBattle: null,
  activeBattleBridgeCtx: null,

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

  // ── Phase 2 — Instrumentation / telemetry (P2-A) ───────────────────────────
  seasonStartedAt: Date.now(),
  actionsThisSeason: 0,
  fidesSpentThisSeason: 0,
  denariiSpentThisSeason: 0,
  seasonStatsHistory: [],

  // ── Munificence (P2-F) ───────────────────────────────────────────────────────
  endowments: [],
  munificenceUsage: {},
  grandGamesVoteBonus: 0,
  grandGamesBonusYearsUntilDecay: 0,
} as any;


const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function turnLabel(state: GameState): string {
  return `${Math.abs(state.year)} BC · ${SEASON_NAMES[state.seasonIndex]}`;
}

// P2-E — spread into the set() call of every "meaningful action" (E1's counted-action
// list, see plan §P2-E) on its success path only (i.e. after all guard-clause early
// returns). Not incremented on navigation, forced event choices, End Season, or birth naming.
function bumpActions(s: GameState): Pick<GameState, 'actionsThisSeason'> {
  return { actionsThisSeason: s.actionsThisSeason + 1 };
}

// P2-E — tracks gross Fides/Denarii spent this season (P2-A counters, never wired
// until now). Pass the literal cost paid, not a net delta — gains from the same
// action (e.g. Munificence's Public Feast granting Fides) are not netted out here.
function bumpSpend(s: GameState, spend: { fides?: number; denarii?: number }):
  Pick<GameState, 'fidesSpentThisSeason' | 'denariiSpentThisSeason'> {
  return {
    fidesSpentThisSeason:   s.fidesSpentThisSeason   + (spend.fides   ?? 0),
    denariiSpentThisSeason: s.denariiSpentThisSeason + (spend.denarii ?? 0),
  };
}

function findClanAndLeader(clans: Clan[], leaderId: string) {
  for (const clan of clans) {
    const leader = clan.leaders.find(l => l.id === leaderId);
    if (leader) return { clan, leader };
  }
  return null;
}

/**
 * Phase 4, Chunk P4-D — backfills a pre-Basilica PrepRecord (the old flat
 * {totalStrength, actionsUsed}) into the sectioned shape at load time. A
 * save already on the new shape passes through unchanged (the `logos`
 * check below is false for it, since it already has the field).
 */
function normalizePlayerPrep(prep: any): TrialState['playerPrep'] {
  if (prep && typeof prep.logos === 'number') return prep;
  return {
    logos: prep?.totalStrength ?? 0,
    pathos: 0,
    ethos: 0,
    actionsUsed: prep?.actionsUsed ?? [],
    witnesses: [],
    bribedClanIds: [],
    praetorBribed: false,
  };
}

/**
 * Phase 4, Chunk P4-F — a save written before a LEGACY_DEFINITIONS entry
 * existed (e.g. this chunk's prosecutions_won/magistrates_convicted) has a
 * legacyObjectives array missing that entry entirely; incrementLegacy's
 * `.map` silently no-ops on an id it can't find, so without this backfill
 * the milestone would just never track for that save (design invariant 9).
 */
function backfillLegacyObjectives(objectives: GameState['legacyObjectives']): GameState['legacyObjectives'] {
  const have = new Set((objectives ?? []).map(o => o.definitionId));
  const missing = LEGACY_DEFINITIONS
    .filter(def => !have.has(def.id))
    .map(def => ({ definitionId: def.id, currentValue: 0, milestonesReached: [] as number[] }));
  return missing.length === 0 ? (objectives ?? []) : [...(objectives ?? []), ...missing];
}

/**
 * Phase 4, Chunk P4-E — shared by answerTrialBeat (last beat) and
 * fastResolveTrialSession: once a trial's session has no more beats to
 * answer, compute the deterministic verdict + apply every consequence via
 * trialEngine.resolveTrialOutcome (the exact logic turnSequencer.ts used to
 * run inline before trial day became interactive), then merge the result
 * (plus any calumnia counter-suit) back into `trials`.
 */
function concludeTrialSession(s: GameState, trial: TrialState): Partial<GameState> {
  const opponentFound = findOpponentLeader(trial, s.clans);
  const npcPerformance = computeNpcPerformance(opponentFound?.leader.traits ?? []);
  const playerPerformance = Math.max(
    -BALANCE.trials.performanceCap,
    Math.min(BALANCE.trials.performanceCap, trial.session?.performanceSoFar ?? 0)
  );

  const result = resolveTrialOutcome(s, trial, opponentFound, playerPerformance, npcPerformance);
  const others = s.trials.filter(t => t.id !== trial.id);

  return {
    ...result.state,
    trials: [...others, result.trial, ...(result.counterSuit ? [result.counterSuit] : [])],
    log: [...result.state.log, ...result.events.map(e => mkLog(turnLabel(result.state), e, 'neutral'))],
  };
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
      ...bumpActions(s),
      ...bumpSpend(s, { fides: 10 }),
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
      // P3-D — generated once per run, both start types.
      cadetBranch: generateCadet(),
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
        const te = BALANCE.elections.tribuneElection;
        const plebsScore      = finalState.rome.plebs / 100;
        const popularesBonus  = Math.max(0, finalState.popularesRel) / te.popularesRelDivisor;
        const successChance   = Math.min(te.ceiling, te.baseChance + plebsScore * te.plebsWeight + popularesBonus);
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
              c.id === tribuneCharId
                ? {
                    ...c,
                    officeId: 'tribune' as any,
                    // Phase 4, Chunk P4-A — Tribune is a parallel office (its own
                    // tribuneHolder id, not the currentOffice/campaigning slot),
                    // so it's recorded here rather than the election-win branch.
                    heldOffices: (c.heldOffices ?? []).includes('tribune')
                      ? c.heldOffices ?? []
                      : [...(c.heldOffices ?? []), 'tribune' as OfficeId],
                  }
                : c
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

    // ── P2-A: season telemetry snapshot ─────────────────────────────────────
    // fidesIncome/denariiIncome are derived (net change + tracked spend), not
    // separately measured gross figures — sufficient for P2-E pace tuning.
    const completedSeasonStats: SeasonStats = {
      turnNumber:        s.turnNumber,
      durationSec:        Math.round((Date.now() - s.seasonStartedAt) / 1000),
      meaningfulActions:  s.actionsThisSeason,
      fidesIncome:        Math.max(0, (finalState.fides - s.fides) + s.fidesSpentThisSeason),
      fidesSpent:         s.fidesSpentThisSeason,
      denariiIncome:      Math.max(0, (finalState.denarii - s.denarii) + s.denariiSpentThisSeason),
      denariiSpent:       s.denariiSpentThisSeason,
      patronTierAtEnd:    finalState.patronTier,
    };
    const seasonStatsHistory = [...s.seasonStatsHistory, completedSeasonStats].slice(-40);

    // ── Phase 3, Chunk P3-E — epilogue detection ─────────────────────────────
    // pendingEpilogue can be set by warEngine.ts (victory/exhaustion/humbled),
    // inheritanceEngine.ts's extinction path (gens_ends), or turnSequencer.ts's
    // Crisis-100 check (republic_falls) — all upstream of this point, inside
    // processSeason. This is the single place that turns that signal into an
    // actual AncestorRecord, exactly once (guarded on !runFinished so a save
    // reload or an extra endSeason call never double-records the same run).
    if (finalState.pendingEpilogue && !finalState.runFinished) {
      const { buildAncestorRecord } = require('../engine/epilogueEngine');
      const { appendAncestorRecord } = require('./ancestorStore');
      const record = buildAncestorRecord(finalState, finalState.pendingEpilogue);
      finalState = { ...finalState, runFinished: true, currentEpilogueRecord: record };
      appendAncestorRecord(record).catch((e: Error) =>
        console.warn('[P3-E] Hall of Ancestors write failed:', e)
      );
    }

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
      seasonStartedAt:        Date.now(),
      actionsThisSeason:      0,
      fidesSpentThisSeason:   0,
      denariiSpentThisSeason: 0,
      seasonStatsHistory,
      trainedThisSeason:      [],
    });

    // Autosave — async, non-fatal. UI-only fields stripped inside saveLoad.save().
    const { saveProvider: sp } = require('../state/saveLoad');
    sp.save(get()).catch((e: Error) => console.warn('[P1-D] Autosave failed:', e));
  },

  dismissSeasonOverlay: () => set({ seasonOverlayVisible: false, seasonOverlayEvents: [] }),

  runIdleSeasons: (n) => {
    const { getEventDef } = require('../engine/eventEngine');
    const notes: string[] = [];
    let seasonsCompleted = 0;

    for (let i = 0; i < n; i++) {
      if (get().runFinished) break;

      get().endSeason();
      seasonsCompleted++;

      // Drain any chain of events (a resolved choice can queue a follow-up
      // via nextEventId/nextEvent:) with the first guaranteed choice —
      // deterministic, matching P5-A's spec exactly. Falls back to the
      // first choice if every choice on a given event rolls a skill check.
      // The guard exists only to keep a malformed def (a branching cycle)
      // from hanging the whole run — it should never actually trip.
      let guard = 0;
      while (get().activeEvent && guard < 20) {
        guard++;
        const active = get().activeEvent!;
        const def = getEventDef(active.defId);
        if (!def || def.choices.length === 0) {
          set({ activeEvent: null });
          break;
        }
        const guaranteed = def.choices.find((c: EventChoice) => !c.skillCheck);
        const choice = guaranteed ?? def.choices[0];
        get().resolveEvent(choice.id);
      }
      if (guard >= 20) notes.push(`season ${i + 1}: an event chain didn't terminate within ${guard} steps — check for a branching cycle`);

      // Trial beats aren't EventChoices — a trial that entered 'in_session'
      // this season needs its own driver.
      for (const trial of get().trials) {
        if (trial.status === 'in_session') get().fastResolveTrialSession(trial.id);
      }

      // Birth naming — accept the suggested name rather than blocking.
      const pendingBirth = get().pendingBirthNaming;
      if (pendingBirth) get().confirmBirthNaming(pendingBirth.suggestedName);

      // Keep the loop's state clean for the next iteration (and for
      // whatever screen is open once the runner finishes).
      get().dismissSeasonOverlay();
    }

    return { seasonsCompleted, stuckReason: notes.length > 0 ? notes.join('; ') : null };
  },

  returnToStartMenu: () => set({ gameStarted: false }),

  enterEndlessMode: () => set({
    endlessMode: true,
    runFinished: false,
    pendingEpilogue: null,
  }),

  // ─── Resources ───────────────────────────────────────────────────────────────

  spendResource: (resource, amount) => {
    const s = get();
    const current = s[resource] as number;
    if (current < amount) return;
    set({ [resource]: current - amount });
  },

  // ─── Domus ───────────────────────────────────────────────────────────────────

  selectCharacter: (id) => set({ selectedCharacterId: id }),

  // P2-C: deterministic, escalating-cost training. Always succeeds; costs
  // BALANCE.training.fidesCostPerTargetLevel × targetLevel Fides; once per
  // season per character (trainedThisSeason, reset in endSeason); capped at
  // BALANCE.training.skillCap.
  trainCharacter: (characterId, skill) => {
    const s = get();
    const { rollTraining } = require('../engine/houseEngine');
    const char = s.family.find((c) => c.id === characterId);
    if (!char) return;
    if (s.trainedThisSeason.includes(characterId)) return;
    const currentLevel = char.skills[skill];
    if (currentLevel >= BALANCE.training.skillCap) return;
    const targetLevel = currentLevel + 1;
    const cost = calcTrainingCost(currentLevel);
    if (s.fides < cost) return;

    // Family House rework — training now rolls (was 100%-guaranteed):
    // harder as currentLevel rises, easier with a built Study. Fides is
    // still spent on the attempt either way — only the +1 is uncertain.
    const hasStudy = s.house.builtRooms.includes('study');
    const result = rollTraining(currentLevel, hasStudy, Math.random());

    const label = turnLabel(s);
    set({
      fides: s.fides - cost,
      family: result.success
        ? s.family.map((c) =>
            c.id === characterId
              ? { ...c, skills: { ...c.skills, [skill]: targetLevel } }
              : c
          )
        : s.family,
      trainedThisSeason: [...s.trainedThisSeason, characterId],
      log: [...s.log, mkLog(
        label,
        result.success
          ? `${char.name} trains ${skill} to ${targetLevel} (−${cost} Fides).`
          : `${char.name}'s training in ${skill} makes no headway this season (−${cost} Fides spent regardless).`,
        result.success ? 'good' : 'bad'
      )],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: cost }),
    });
  },

  commissionLaudatio: () => {
    const s = get();
    if (s.fides < 10) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 10,
      lifetimeDignitas: s.lifetimeDignitas + 10,
      log: [...s.log, mkLog(label, 'A laudatio commissioned. Lifetime Dignitas +10.', 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: 10 }),
    });
  },

  performAdrogatio: () => {
    const s = get();
    if (s.denarii < 50) return;
    const label = turnLabel(s);
    set({
      denarii: s.denarii - 50,
      log: [...s.log, mkLog(label, 'Adrogatio performed. A citizen adopted into the Brutii.', 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: 50 }),
    });
  },

  arrangeMarriageDomus: () => {
    const s = get();
    if (s.fides < 15) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 15,
      log: [...s.log, mkLog(label, 'Marriage arranged within the family.', 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: 15 }),
    });
  },

  // ─── Curia ───────────────────────────────────────────────────────────────────

  expandBill: (billId, type) => set({ _expandedBill: billId, _expandedType: type }),
  collapseBill: () => set({ _expandedBill: null, _expandedType: null }),

  voteBill: (billId, vote) => {
    const s = get();
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return;
    const voteFidesCost = bill.voteGravitasCost ?? BALANCE.senate.voteFidesCostDefault;
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
      ...bumpActions(s),
      ...bumpSpend(s, { fides: voteFidesCost }),
    });
  },

  speechBill: (billId, direction) => {
    const s = get();
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return;
    const speechFidesCost = bill.speechGravitasCost ?? BALANCE.senate.speechFidesCostDefault;
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
      ...bumpActions(s),
      ...bumpSpend(s, { fides: speechFidesCost }),
    });
  },

  filibusterBill: (billId) => {
    const s = get();
    const bill = s.bills.find((b) => b.id === billId);
    if (!bill) return;
    if (s.fides < BALANCE.senate.filibusterFidesCost) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - BALANCE.senate.filibusterFidesCost,
      bills: s.bills.map((b) =>
        b.id === billId ? { ...b, turnsLeft: b.turnsLeft + 1 } : b
      ),
      _expandedBill: null,
      _expandedType: null,
      log: [...s.log, mkLog(label, `Filibuster delays ${bill.name} by one season.`, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.senate.filibusterFidesCost }),
    });
  },

  submitBill: (template) => {
    const s = get();
    if (s.fides < BALANCE.senate.submitBillFidesCost) return;
    const newBill: Bill = { ...template, id: `player-bill-${Date.now()}` };
    const label = turnLabel(s);
    set({
      fides: s.fides - BALANCE.senate.submitBillFidesCost,
      bills: [...s.bills, newBill],
      log: [...s.log, mkLog(label, `${newBill.name} tabled in the Senate.`, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.senate.submitBillFidesCost }),
    });
  },

  // ─── Munificence (P2-F) ─────────────────────────────────────────────────────
  // Wealth-to-standing conversion: feasts, games, temple restorations, endowments.
  // Requirement/cost/effect math lives in munificenceEngine.ts (Aedile discount,
  // shared 'games' slot, cooldowns); this action assembles the state patch.

  performMunificence: (actId) => {
    const s = get();
    const act = getMunificenceAct(actId);
    if (!act) return;

    const check = checkMunificenceRequirements(s, act);
    if (!check.ok) {
      console.warn(`[performMunificence] Blocked (${actId}): ${check.reason}`);
      return;
    }

    const cost = getMunificenceCost(s, act);
    const effects = getMunificenceEffects(s, act);
    const label = turnLabel(s);

    // Crisis track deltas (unrest relief, constitution boost from temples)
    let crisis = s.crisis;
    if (effects.crisisDeltas) {
      for (const [trackId, delta] of Object.entries(effects.crisisDeltas) as [CrisisTrackId, number][]) {
        crisis = { ...crisis, [trackId]: applyTrackDelta(crisis[trackId], delta) };
      }
    }

    // Rome stats
    const rome = {
      ...s.rome,
      plebs:     Math.min(100, s.rome.plebs + (effects.plebs ?? 0)),
      stability: Math.min(100, s.rome.stability + (effects.stability ?? 0)),
    };

    // Usage record — lastUsedTurn drives cooldowns, usesThisYear the shared 'games'
    // slot and onceThisYear acts, totalUses the per-game caps (temples, endowments).
    const prevUsage = s.munificenceUsage[actId] ?? {};
    const munificenceUsage = {
      ...s.munificenceUsage,
      [actId]: {
        lastUsedTurn: s.turnNumber,
        usesThisYear: (prevUsage.usesThisYear ?? 0) + 1,
        totalUses:    (prevUsage.totalUses ?? 0) + 1,
      },
    };

    const endowments = effects.grantsEndowment ? [...s.endowments, actId] : s.endowments;

    // Grand Games vote bonus: a standing bonus (electionEngine), not one-shot —
    // recasting always refreshes to full and resets the decay clock (P2-F design decision).
    let grandGamesVoteBonus = s.grandGamesVoteBonus;
    let grandGamesBonusYearsUntilDecay = s.grandGamesBonusYearsUntilDecay;
    if (effects.electionVoteBonus !== undefined) {
      grandGamesVoteBonus = effects.electionVoteBonus;
      grandGamesBonusYearsUntilDecay = BALANCE.munificence.grandGames.electionVoteBonusDecayIntervalYears;
    }

    // Games acts reset the "no games" unrest-escalation counter (crisisEngine
    // calcUnrestEscalation reads seasonsSinceAedileGames — previously nothing ever
    // reset it; Fund the Ludi / Grand Games are now the one games system that does).
    const flags = act.requirements.slot === 'games'
      ? { ...s.flags, seasonsSinceAedileGames: 0 }
      : s.flags;

    const effectParts: string[] = [];
    if (effects.plebs)            effectParts.push(`Plebs +${effects.plebs}`);
    if (effects.fides)            effectParts.push(`Fides +${effects.fides}`);
    if (effects.lifetimeDignitas) effectParts.push(`Lifetime Dignitas +${effects.lifetimeDignitas}`);
    if (effects.stability)        effectParts.push(`Stability +${effects.stability}`);
    if (effects.grantsEndowment)  effectParts.push('permanent Fides income');
    if (effects.electionVoteBonus !== undefined) effectParts.push(`+${effects.electionVoteBonus} votes at the next election`);
    const logMsg = `${act.name} performed.${effectParts.length ? ' ' + effectParts.join(', ') + '.' : ''}`;

    // Grand acts trigger a Philon interstitial — shown immediately (not deferred
    // to season end), reusing the P2-B/P2-D injectNoticeEvent pattern.
    let pendingEvents = s.pendingEvents;
    let activeEvent = s.activeEvent;
    if (act.isGrandAct) {
      const player = s.family.find(c => c.isPlayer);
      const bodyText = act.id === 'grand-games'
        ? 'Philon, aglow: "Rome roared your name today, Domine. Ten thousand strangers now consider themselves your personal friends. Some of them vote."'
        : 'Philon, quietly proud: "A gift to the city that outlives us both, Domine. Rome does not easily forget who paid for its bread, or its water."';
      const notice = injectNoticeEvent(
        'evt-munificence-grand-act', s.turnNumber, player?.id ?? 'pc-1', { title: act.name, bodyText },
      );
      if (activeEvent) {
        pendingEvents = [...pendingEvents, notice];
      } else {
        activeEvent = notice;
      }
    }

    set({
      denarii: s.denarii - cost.denarii,
      fides:   s.fides - cost.fides + (effects.fides ?? 0),
      rome,
      crisis,
      lifetimeDignitas: s.lifetimeDignitas + (effects.lifetimeDignitas ?? 0),
      munificenceUsage,
      endowments,
      grandGamesVoteBonus,
      grandGamesBonusYearsUntilDecay,
      flags,
      pendingEvents,
      activeEvent,
      log: [...s.log, mkLog(label, logMsg, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: cost.fides, denarii: cost.denarii }),
    });
  },

  // ─── Forum ───────────────────────────────────────────────────────────────────

  expandClan: (clanId) => set({ expandedClanId: clanId, selectedLeaderId: null }),
  selectLeader: (leaderId) => set({ selectedLeaderId: leaderId }),

  buyInfluence: (leaderId) => {
    const s = get();
    if (s.fides < BALANCE.diplomacy.buyInfluenceFidesCost) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = BALANCE.diplomacy.buyInfluenceRelationshipGain;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      fides: s.fides - BALANCE.diplomacy.buyInfluenceFidesCost,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Influence purchased with a clan leader.', 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.diplomacy.buyInfluenceFidesCost }),
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  inviteToDinner: (leaderId) => {
    const s = get();
    if (s.denarii < BALANCE.diplomacy.inviteToDinnerDenariiCost) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = BALANCE.diplomacy.inviteToDinnerRelationshipGain;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      denarii: s.denarii - BALANCE.diplomacy.inviteToDinnerDenariiCost,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Dinner hosted for a clan leader. Warmth increased.', 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: BALANCE.diplomacy.inviteToDinnerDenariiCost }),
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  forgeAlliance: (leaderId) => {
    const s = get();
    if (s.fides < BALANCE.diplomacy.forgeAllianceFidesCost) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = BALANCE.diplomacy.forgeAllianceRelationshipGain;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      fides: s.fides - BALANCE.diplomacy.forgeAllianceFidesCost,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta), alliance: true } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Alliance forged with a clan leader.', 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.diplomacy.forgeAllianceFidesCost }),
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  arrangeMarriageForum: (leaderId) => {
    const s = get();
    if (s.fides < BALANCE.diplomacy.arrangeMarriageFidesCost) return;
    const found = findClanAndLeader(s.clans, leaderId);
    if (!found) return;
    const label = turnLabel(s);
    const relationshipDelta = BALANCE.diplomacy.arrangeMarriageRelationshipGain;
    const clanTotalVotes = found.clan.leaders.reduce((sum, l) => sum + l.votes, 0);
    const repDelta = computeReputationDelta(relationshipDelta, found.leader.votes, clanTotalVotes);
    set({
      fides: s.fides - BALANCE.diplomacy.arrangeMarriageFidesCost,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + relationshipDelta), married: true } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Marriage alliance arranged with a clan family.', 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.diplomacy.arrangeMarriageFidesCost }),
    });
    get().adjustClanReputation(found.clan.id, repDelta, found.clan.name);
  },

  // Phase 4, Chunk P4-A — rewired onto secretEngine.attemptGather. Cost is
  // for the attempt, win or lose (matches the old action's unconditional
  // deduction). Success yields a visible Secret and resets that leader's
  // groundwork; failure raises groundwork toward a future attempt.
  gatherIntelligence: (leaderId, agentId) => {
    const s = get();
    if (s.fides < BALANCE.secrets.gatherCostFides) return;
    const label = turnLabel(s);
    const result = attemptGather(s, leaderId, agentId, Math.random());

    set({
      fides: s.fides - BALANCE.secrets.gatherCostFides,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, intelGroundwork: result.groundwork } : l
        ),
      })),
      secrets: result.secret ? [...s.secrets, result.secret] : s.secrets,
      log: [...s.log, mkLog(
        label,
        result.success
          ? `Intelligence gathered: ${result.secret!.flavorText}`
          : 'The attempt turns up nothing of use this season.',
        result.success ? 'good' : 'neutral'
      )],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.secrets.gatherCostFides }),
    });
  },

  canvassForVotes: (leaderId) => {
    const s = get();
    if (s.fides < BALANCE.diplomacy.canvassForVotesFidesCost) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - BALANCE.diplomacy.canvassForVotesFidesCost,
      campaignVotes: { ...s.campaignVotes, [leaderId]: 'for' },
      log: [...s.log, mkLog(label, 'Canvassing complete. Clan leader support secured.', 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.diplomacy.canvassForVotesFidesCost }),
    });
  },

  // ─── Phase 4, Chunk P4-B — Secret verbs ────────────────────────────────────
  // Player-held Secrets on a leader (subject.kind==='leader', holder==='player').
  // Deterrence (isDeterred) blocks every verb here — "and vice versa" in the
  // plan's mutual-standoff invariant means the player's own held Secret is
  // just as frozen as the leader's, while a Cold War holds.

  leverageSecretForBill: (secretId, billId, direction) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    if (!secret || secret.holder !== 'player' || secret.subject.kind !== 'leader' || secret.status !== 'held') return;
    if (isDeterred(secret.subject.leaderId, s.secrets)) return;
    const found = findClanAndLeader(s.clans, secret.subject.leaderId);
    const bill = s.bills.find(b => b.id === billId);
    if (!found || !bill) return;

    const delta = computeLeverageBillSupportDelta(found.leader.votes, direction);
    const label = turnLabel(s);
    set({
      bills: s.bills.map(b => b.id === billId ? { ...b, support: Math.min(100, Math.max(-100, b.support + delta)) } : b),
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'spent' as const } : sec),
      log: [...s.log, mkLog(label, `You leverage what you hold on ${found.leader.name} — their bloc's weight swings behind ${bill.name}.`, 'good')],
      ...bumpActions(s),
    });
  },

  leverageSecretForElection: (secretId) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    if (!secret || secret.holder !== 'player' || secret.subject.kind !== 'leader' || secret.status !== 'held') return;
    if (!s.campaigning) return;
    if (isDeterred(secret.subject.leaderId, s.secrets)) return;
    const found = findClanAndLeader(s.clans, secret.subject.leaderId);
    if (!found) return;

    const label = turnLabel(s);
    set({
      campaignVotes: { ...s.campaignVotes, [secret.subject.leaderId]: 'for' as const },
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'spent' as const } : sec),
      log: [...s.log, mkLog(label, `${found.leader.name} pledges support to your campaign — the price of your silence.`, 'good')],
      ...bumpActions(s),
    });
  },

  extortSecret: (secretId) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    if (!secret || secret.holder !== 'player' || secret.subject.kind !== 'leader' || secret.status !== 'held') return;
    if (isDeterred(secret.subject.leaderId, s.secrets)) return;
    const found = findClanAndLeader(s.clans, secret.subject.leaderId);
    if (!found) return;

    const label = turnLabel(s);
    set({
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'extorting' as const } : sec),
      log: [...s.log, mkLog(label, `You begin quietly bleeding ${found.leader.name} for coin.`, 'neutral')],
      ...bumpActions(s),
    });
  },

  // "Stoppable any season" — but reverting to 'held' would be free money
  // already banked (the plan's own note); stopping spends the Secret.
  stopExtortion: (secretId) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    if (!secret || secret.holder !== 'player' || secret.status !== 'extorting') return;

    const label = turnLabel(s);
    set({
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'spent' as const } : sec),
      log: [...s.log, mkLog(label, 'You cut the leash — the extortion ends.', 'neutral')],
      ...bumpActions(s),
    });
  },

  burnSecret: (secretId) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    if (!secret || secret.holder !== 'player' || secret.subject.kind !== 'leader' || secret.status !== 'held') return;
    if (isDeterred(secret.subject.leaderId, s.secrets)) return;
    const found = findClanAndLeader(s.clans, secret.subject.leaderId);
    if (!found) return;
    const { clan, leader } = found;

    const voteLoss = computeBurnVoteLoss(leader.votes);
    const currentRep = s.familyReputations[clan.id] ?? 0;
    const label = turnLabel(s);
    set({
      clans: s.clans.map(c => c.id === clan.id ? {
        ...c,
        leaders: c.leaders.map(l => l.id === leader.id ? { ...l, votes: Math.max(0, l.votes - voteLoss) } : l),
      } : c),
      familyReputations: { ...s.familyReputations, [clan.id]: Math.min(currentRep, BALANCE.secrets.burnClanRepFloor) },
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'spent' as const } : sec),
      log: [...s.log, mkLog(label, `Scandal breaks: ${secret.flavorText} ${leader.name} loses ${voteLoss} votes as the story spreads — ${clan.name} turns hostile.`, 'good')],
      ...bumpActions(s),
    });
  },

  // ─── Counterplay — on a Secret held against the family ─────────────────────
  // Undiscovered Secrets aren't shown/actionable in the Dossier at all, but
  // guard here too (defense-in-depth against a stale secretId).

  payOffSecret: (secretId) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    // 'extorting' is included alongside 'held' — a Secret held against the
    // family that the player is already complying with (resolveSecretDemand's
    // 'extort' comply branch) must still be counterable, the same way the
    // player's own extortion of a leader has a symmetric "Stop Extorting"
    // verb. Without this, once a demand is complied with there was no way
    // to ever end the drain — Pay Off/Discredit silently no-op'd forever.
    if (!secret || secret.holder === 'player' || secret.subject.kind !== 'family'
      || (secret.status !== 'held' && secret.status !== 'extorting') || !secret.discovered) return;
    const cost = payOffCost(secret.potency);
    if (s.denarii < cost) return;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - cost,
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'neutralized' as const } : sec),
      log: [...s.log, mkLog(label, 'Denarii change hands quietly. The matter is buried — for good.', 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
    });
  },

  discreditSecret: (secretId, agentId) => {
    const s = get();
    const secret = s.secrets.find(sec => sec.id === secretId);
    // See payOffSecret's comment — 'extorting' must remain counterable too.
    if (!secret || secret.holder === 'player' || secret.subject.kind !== 'family'
      || (secret.status !== 'held' && secret.status !== 'extorting') || !secret.discovered) return;
    if (s.fides < BALANCE.secrets.discreditCostFides) return;
    const agent = s.family.find(c => c.id === agentId);
    if (!agent) return;

    const result = attemptDiscredit(secret, agent.skills.intrigus, Math.random());
    const label = turnLabel(s);
    set({
      fides: s.fides - BALANCE.secrets.discreditCostFides,
      secrets: s.secrets.map(sec => sec.id === secretId
        ? (result.success ? { ...sec, status: 'neutralized' as const } : { ...sec, potency: result.newPotency })
        : sec),
      log: [...s.log, mkLog(
        label,
        result.success
          ? `${agent.name} quietly discredits the story. It dissolves into rumor.`
          : `${agent.name}'s cover-up unravels — if anything, the story grows sharper.`,
        result.success ? 'good' : 'bad'
      )],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.secrets.discreditCostFides }),
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
      ...bumpActions(s),
      ...bumpSpend(s, {
        fides:   resourceKey === 'fides'   ? action.costVal : undefined,
        denarii: resourceKey === 'denarii' ? action.costVal : undefined,
      }),
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

  addClient: (type, name, flavourTitle, flavourText) => {
    const s = get();
    const { buildClient } = require('../engine/clientEngine');
    const { getClientSlotCap } = require('../engine/houseEngine');
    // Family House rework — the Entry Hall raises this cap. Player-initiated
    // acquisition only; event-driven client grants (_addClient patches,
    // resolveEvent) are exempt, same as every other narrative-effect-always-
    // lands convention in this codebase.
    if (s.clients.length >= getClientSlotCap(s.house)) return;
    const newClient = buildClient(
      `client-${Date.now()}`,
      name,
      type,
      flavourTitle,
      flavourText,
      s.turnNumber,
    );
    set({ clients: [...s.clients, newClient] });
  },

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
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
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
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
    });
  },

  // ─── Family House ───────────────────────────────────────────────────────────

  buyHouse: (locationId) => {
    const s = get();
    const { getHouseLocationDefinition } = require('../data/houseLocations');
    const { sellBackValue } = require('../engine/houseEngine');

    if (s.house.locationId === locationId) return; // already here
    const location = getHouseLocationDefinition(locationId);
    if (!location) return;

    const refund = sellBackValue(s.house);
    const netCost = location.cost - refund;
    if (netCost > 0 && s.denarii < netCost) return;

    const label = turnLabel(s);
    const newHouse = {
      locationId,
      builtRooms: [] as RoomType[],
      shops: Array(location.shopSlots).fill(null) as (BusinessType | null)[],
      turnAcquired: s.turnNumber,
    };
    set({
      denarii: s.denarii - netCost,
      house: newHouse,
      log: [...s.log, mkLog(
        label,
        `The family relocates to ${location.name}. The old house sells for ${refund} Denarii; the move costs ${Math.max(0, netCost)} net.`,
        'neutral'
      )],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: Math.max(0, netCost) }),
    });
  },

  buildRoom: (type) => {
    const s = get();
    const { getHouseLocationDefinition } = require('../data/houseLocations');
    const { getHouseRoomDefinition } = require('../data/houseRooms');
    const { hasFreeRoomSlot } = require('../engine/houseEngine');

    if (s.house.builtRooms.includes(type)) return;
    if (!hasFreeRoomSlot(s.house)) return;
    const room = getHouseRoomDefinition(type);
    if (!room) return;
    if (s.denarii < room.cost) return;

    const label = turnLabel(s);
    // Library's rhetoricGrant is a ONE-TIME permanent stat grant, applied the
    // moment the room is built — not folded into the recurring per-season
    // bonus total (houseEngine.computeHouseBonuses deliberately excludes it).
    const rhetoricGrant = room.bonus.rhetoricGrant ?? 0;
    const family = rhetoricGrant > 0
      ? s.family.map(c => c.isPlayer
          ? { ...c, skills: { ...c.skills, rhetoric: c.skills.rhetoric + rhetoricGrant } }
          : c)
      : s.family;

    set({
      denarii: s.denarii - room.cost,
      house: { ...s.house, builtRooms: [...s.house.builtRooms, type] },
      family,
      log: [...s.log, mkLog(label, `${room.name} built. (${room.flavorText})`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: room.cost }),
    });
  },

  rentShop: (slotIndex, businessType) => {
    const s = get();
    const { getHouseBusinessDefinition } = require('../data/houseBusinesses');

    if (slotIndex < 0 || slotIndex >= s.house.shops.length) return;
    if (s.house.shops[slotIndex] !== null) return;
    const business = getHouseBusinessDefinition(businessType);
    if (!business) return;
    if (s.denarii < business.cost) return;

    const label = turnLabel(s);
    const shops = [...s.house.shops];
    shops[slotIndex] = businessType;
    set({
      denarii: s.denarii - business.cost,
      house: { ...s.house, shops },
      log: [...s.log, mkLog(label, `${business.name} opens its doors. (${business.flavorText})`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: business.cost }),
    });
  },

  vacateShop: (slotIndex) => {
    const s = get();
    if (slotIndex < 0 || slotIndex >= s.house.shops.length) return;
    if (s.house.shops[slotIndex] === null) return;

    const label = turnLabel(s);
    const shops = [...s.house.shops];
    shops[slotIndex] = null;
    set({
      house: { ...s.house, shops },
      log: [...s.log, mkLog(label, 'The shopfront is vacated.', 'neutral')],
      ...bumpActions(s),
    });
  },

  // ─── Trials (Phase 4, Chunk P4-C — "one pipeline, two seats") ──────────────

  fileProsecution: (targetLeaderId, startDelay, speakerId) => {
    const s = get();
    if (s.fides < BALANCE.trials.fileCostFides) return;
    if (s.trials.some(t => t.status !== 'resolved')) return; // one active trial system-wide
    const found = findClanAndLeader(s.clans, targetLeaderId);
    if (!found) return;
    const { leader } = found;

    const gate = canFileProsecution(leader, s.secrets);
    if (!gate.eligible) return;

    const clampedDelay = Math.max(
      BALANCE.trials.startDelayBand[0],
      Math.min(BALANCE.trials.startDelayBand[1], Math.round(startDelay))
    );
    const player = s.family.find(c => c.isPlayer);
    const finalSpeakerId = speakerId ?? player?.id ?? '';

    let charge: ChargeId;
    let chargeSource: ChargeSource;
    let initialNpcStrength: number;
    let consumedSecretIds: string[] = [];
    let secretsPatch = s.secrets;

    if (gate.via === 'secret' && gate.evidenceSecret) {
      charge = mapSecretTypeToTrialCharge(gate.evidenceSecret.type);
      chargeSource = 'secret';
      initialNpcStrength = BALANCE.trials.secretEvidenceBase * gate.evidenceSecret.potency;
      consumedSecretIds = [gate.evidenceSecret.id];
      secretsPatch = s.secrets.map(sec =>
        sec.id === gate.evidenceSecret!.id ? { ...sec, status: 'spent' as const } : sec
      );
    } else {
      // Corruption path — no Secret to infer a specific charge from;
      // 'peculatus' (financial malfeasance) is the most generic
      // corruption-adjacent charge, matching shouldTriggerTrial's own
      // corruption-branch mapping.
      charge = 'peculatus';
      chargeSource = 'corruption';
      initialNpcStrength = BALANCE.trials.corruptionEvidenceBase;
    }

    const newTrial = buildTrialState({
      id: `trial-${Date.now()}`,
      seat: 'prosecution',
      charge,
      chargeSource,
      prosecutor: { kind: 'player', speakerId: finalSpeakerId },
      defendant: { kind: 'leader', leaderId: targetLeaderId },
      filedSeason: s.turnNumber,
      startsSeason: s.turnNumber + clampedDelay,
      initialNpcStrength,
      consumedSecretIds,
      speakerId: finalSpeakerId,
    });

    const label = turnLabel(s);
    set({
      fides: s.fides - BALANCE.trials.fileCostFides,
      trials: [...s.trials, newTrial],
      secrets: secretsPatch,
      log: [...s.log, mkLog(label, `You file charges against ${leader.name}. Trial begins in ${clampedDelay} seasons.`, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.trials.fileCostFides }),
    });
  },

  /** Free, adjustable until startsSeason (design invariant 8) — locks once
   *  the trial enters session. */
  setTrialApproach: (trialId, approach) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    set({ trials: s.trials.map(t => t.id === trialId ? { ...t, approach } : t) });
  },

  setTrialSpeaker: (trialId, characterId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    if (!s.family.some(c => c.id === characterId)) return;
    set({ trials: s.trials.map(t => t.id === trialId ? { ...t, speakerId: characterId } : t) });
  },

  // ─── The Basilica's prep catalog (Phase 4, Chunk P4-D) ─────────────────────
  // Every verb is a thin wrapper: guard (preparing + not yet in session),
  // affordability/cap check, spend, delegate the PrepRecord delta to the
  // matching pure trialEngine function. Normal wallet checks only — no
  // separate trial action budget (design note under P4-D's prep catalog).

  gatherTrialEvidence: (trialId, agentId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    const usesSoFar = trial.playerPrep.actionsUsed.filter(a => a === 'gather_evidence').length;
    if (usesSoFar >= BALANCE.trials.prep.gatherEvidenceMaxUses) return;
    const agent = s.family.find(c => c.id === agentId);
    if (!agent) return;
    const cost = gatherEvidenceCost(usesSoFar);
    if (s.fides < cost) return;

    const label = turnLabel(s);
    set({
      fides: s.fides - cost,
      trials: s.trials.map(t =>
        t.id === trialId ? { ...t, playerPrep: applyGatherEvidence(t.playerPrep, agent.skills.intrigus) } : t
      ),
      log: [...s.log, mkLog(label, `${agent.name} gathers evidence for the trial.`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: cost }),
    });
  },

  presentSecretAsEvidence: (trialId, secretId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    const opponentLeaderId = trial.seat === 'defense'
      ? (trial.prosecutor.kind === 'leader' ? trial.prosecutor.leaderId : null)
      : (trial.defendant.kind === 'leader' ? trial.defendant.leaderId : null);
    if (!opponentLeaderId) return;

    const secret = s.secrets.find(sec => sec.id === secretId);
    if (!secret) return;
    if (secret.holder !== 'player' || secret.status !== 'held') return;
    if (secret.subject.kind !== 'leader' || secret.subject.leaderId !== opponentLeaderId) return;
    if (SECRET_CLASS_BY_TYPE[secret.type] !== 'criminal') return;
    if (mapSecretTypeToTrialCharge(secret.type) !== trial.charge) return;

    const label = turnLabel(s);
    set({
      trials: s.trials.map(t =>
        t.id === trialId
          ? { ...t, playerPrep: applyPresentSecretEvidence(t.playerPrep, secret.potency), consumedSecretIds: [...t.consumedSecretIds, secret.id] }
          : t
      ),
      secrets: s.secrets.map(sec => sec.id === secretId ? { ...sec, status: 'spent' as const } : sec),
      log: [...s.log, mkLog(label, `You present damning evidence before the court.`, 'good')],
      ...bumpActions(s),
    });
  },

  secureTrialWitness: (trialId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    if (trial.playerPrep.witnesses.length >= BALANCE.trials.prep.secureWitnessMaxSlots) return;
    if (s.denarii < BALANCE.trials.prep.secureWitnessCostDenarii) return;

    const pool = CLIENT_NAMES.publicSupport;
    const used = trial.playerPrep.witnesses.map(w => w.name);
    const available = pool.filter(n => !used.includes(n));
    const witnessName = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : `${pool[Math.floor(Math.random() * pool.length)]} (the Younger)`;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - BALANCE.trials.prep.secureWitnessCostDenarii,
      trials: s.trials.map(t =>
        t.id === trialId ? { ...t, playerPrep: applySecureWitness(t.playerPrep, witnessName) } : t
      ),
      log: [...s.log, mkLog(label, `${witnessName} agrees to testify.`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: BALANCE.trials.prep.secureWitnessCostDenarii }),
    });
  },

  prepareTrialOration: (trialId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    const usesSoFar = trial.playerPrep.actionsUsed.filter(a => a === 'prepare_oration').length;
    if (usesSoFar >= BALANCE.trials.prep.prepareOrationMaxUses) return;
    if (s.fides < BALANCE.trials.prep.prepareOrationCostFides) return;
    const speaker = s.family.find(c => c.id === trial.speakerId);
    if (!speaker) return;

    const label = turnLabel(s);
    set({
      fides: s.fides - BALANCE.trials.prep.prepareOrationCostFides,
      trials: s.trials.map(t =>
        t.id === trialId ? { ...t, playerPrep: applyPrepareOration(t.playerPrep, speaker.skills.rhetoric) } : t
      ),
      log: [...s.log, mkLog(label, `${speaker.name} rehearses the oration.`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: BALANCE.trials.prep.prepareOrationCostFides }),
    });
  },

  invokeTrialAncestors: (trialId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    if (trial.playerPrep.actionsUsed.includes('invoke_ancestors')) return;

    const label = turnLabel(s);
    set({
      trials: s.trials.map(t =>
        t.id === trialId ? { ...t, playerPrep: applyInvokeAncestors(t.playerPrep, s.lifetimeDignitas) } : t
      ),
      log: [...s.log, mkLog(label, `You open with the record of your ancestors.`, 'good')],
      ...bumpActions(s),
    });
  },

  bribeTrialJurors: (trialId, clanId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    if (trial.playerPrep.bribedClanIds.includes(clanId)) return;
    if (s.denarii < BALANCE.trials.prep.bribeJurorsCostPerBlocDenarii) return;
    const clan = s.clans.find(c => c.id === clanId);
    if (!clan) return;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - BALANCE.trials.prep.bribeJurorsCostPerBlocDenarii,
      trials: s.trials.map(t =>
        t.id === trialId ? { ...t, playerPrep: applyBribeJurors(t.playerPrep, clanId) } : t
      ),
      log: [...s.log, mkLog(label, `You quietly buy the ${clan.name} bloc.`, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: BALANCE.trials.prep.bribeJurorsCostPerBlocDenarii }),
    });
  },

  bribeTrialPraetor: (trialId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    if (trial.playerPrep.praetorBribed) return;
    if (s.denarii < BALANCE.trials.prep.bribePraetorCostDenarii) return;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - BALANCE.trials.prep.bribePraetorCostDenarii,
      trials: s.trials.map(t =>
        t.id === trialId ? { ...t, playerPrep: applyBribePraetor(t.playerPrep) } : t
      ),
      log: [...s.log, mkLog(label, `Coin changes hands with the presiding Praetor.`, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: BALANCE.trials.prep.bribePraetorCostDenarii }),
    });
  },

  intimidateTrialWitness: (trialId) => {
    const s = get();
    const { getUnlockedAssetActions } = require('../engine/assetEngine');
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'preparing' || s.turnNumber >= trial.startsSeason) return;
    if (trial.playerPrep.actionsUsed.includes('intimidate_witness')) return;
    if (!getUnlockedAssetActions(s.ownedAssets).includes('intimidate_witness')) return;
    if (s.denarii < BALANCE.trials.prep.intimidateWitnessCostDenarii) return;

    const label = turnLabel(s);
    set({
      denarii: s.denarii - BALANCE.trials.prep.intimidateWitnessCostDenarii,
      trials: s.trials.map(t =>
        t.id === trialId
          ? {
              ...t,
              playerPrep: applyIntimidateWitness(t.playerPrep),
              npcStrength: Math.max(0, t.npcStrength - BALANCE.trials.prep.intimidateWitnessNpcStrengthReduction),
            }
          : t
      ),
      log: [...s.log, mkLog(label, `A key witness for the other side suddenly recalls urgent business elsewhere.`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: BALANCE.trials.prep.intimidateWitnessCostDenarii }),
    });
  },

  selectTrialForBasilica: (trialId) => set({ selectedTrialId: trialId }),
  setBasilicaReturnTab: (tab) => set({ basilicaReturnTab: tab }),

  // ─── Trial day: the beat engine (Phase 4, Chunk P4-E) ──────────────────────

  answerTrialBeat: (trialId, beatId, responseId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'in_session' || !trial.session) return;
    if (trial.session.beatIds[trial.session.currentBeatIndex] !== beatId) return;

    const beat = getTrialBeat(beatId);
    const response = beat?.responses.find(r => r.id === responseId);
    const speaker = s.family.find(c => c.id === trial.speakerId);
    if (!beat || !response || !speaker) return;

    const { succeeded, swing } = evaluateBeatResponse(response, speaker, trial);
    const advancedTrial = applyBeatOutcome(trial, beat, response, succeeded, swing);
    const sessionDone = !advancedTrial.session || advancedTrial.session.currentBeatIndex >= advancedTrial.session.beatIds.length;

    if (sessionDone) {
      set(concludeTrialSession(s, advancedTrial));
    } else {
      set({ trials: s.trials.map(t => t.id === trialId ? advancedTrial : t) });
    }
  },

  fastResolveTrialSession: (trialId) => {
    const s = get();
    const trial = s.trials.find(t => t.id === trialId);
    if (!trial || trial.status !== 'in_session' || !trial.session) return;
    const speaker = s.family.find(c => c.id === trial.speakerId);
    if (!speaker) return;

    let working = trial;
    while (working.session && working.session.currentBeatIndex < working.session.beatIds.length) {
      const beatId = working.session.beatIds[working.session.currentBeatIndex];
      const beat = getTrialBeat(beatId);
      if (!beat) break; // shouldn't happen — the id was drawn from this same library
      const { response, succeeded, swing } = pickBestResponse(beat, speaker, working);
      working = applyBeatOutcome(working, beat, response, succeeded, swing);
    }

    set(concludeTrialSession(s, working));
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
      heldOffices: [],
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
    const { WAR_EVENT_DEFS }      = require('../data/warEvents');
    const { SUCCESSION_EVENT_DEFS } = require('../data/successionEvents');
    const { CADET_EVENT_DEFS }    = require('../data/cadetEvents');
    const { SECRET_EVENT_DEFS }   = require('../data/secretEvents');
    const { CLAUDIUS_ARC_EVENT_DEFS } = require('../data/claudiusArc');
    const { COMPROMISING_EVENT_DEFS } = require('../data/compromisingEvents');
    const { applyEffectString }   = require('../engine/resourceEngine');
    const { resolveEventChoice }  = require('../engine/eventEngine');

    // P1-G: search tutorial pool as well as main pool. P3-B added
    // WAR_EVENT_DEFS, P3-C added SUCCESSION_EVENT_DEFS, P3-D added
    // CADET_EVENT_DEFS, P4-B added SECRET_EVENT_DEFS, P4-G added
    // CLAUDIUS_ARC_EVENT_DEFS. Phase 5, P5-A bugfix: COMPROMISING_EVENT_DEFS
    // was missing here despite being in the random-draw pool (turnSequencer.ts
    // step 12) — any of its 3 events firing meant every choice silently
    // no-opped (def lookup failed, activeEvent cleared with zero effect
    // applied). eventEngine.getEventDef already had the correct 8-pool list;
    // this just matches it.
    const allDefs = [...EVENT_DEFS, ...TUTORIAL_EVENT_DEFS, ...WAR_EVENT_DEFS, ...SUCCESSION_EVENT_DEFS, ...CADET_EVENT_DEFS, ...SECRET_EVENT_DEFS, ...CLAUDIUS_ARC_EVENT_DEFS, ...COMPROMISING_EVENT_DEFS];
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

    // Phase 3, P3-C — merge any events the resolved choice just queued
    // (via the nextEvent: effect-string token, resourceEngine.ts) with the
    // pre-existing queue, FIFO, rather than computing nextEvent/remaining
    // from the stale pre-patch s.pendingEvents alone (which would silently
    // drop a same-turn chained scene — the old two-line version here did
    // exactly that whenever statePatch.pendingEvents was set, since
    // `pendingEvents: remainingPending` below always won the object-spread
    // race). When the queue was empty before this choice, the newly-queued
    // event is promoted straight to activeEvent instead of waiting.
    const mergedPending = [...s.pendingEvents, ...(statePatch.pendingEvents ?? [])];
    const nextEvent = mergedPending[0] ?? null;
    const remainingPending = mergedPending.slice(1);

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

    // ── Phase 4, Chunk P4-B — NPC secret demand: comply/defy ────────────────
    // Not a tutorial special case (separate feature area, doesn't count
    // against the P1-G budget above). Demand events carry no per-instance
    // dynamic data of their own — pendingSecretDemand supplies it (see
    // models/secret.ts's PendingSecretDemand doc comment).
    if (
      (defId === 'evt-secret-demand-leverage' || defId === 'evt-secret-demand-extortion') &&
      (choiceId === 'comply' || choiceId === 'defy')
    ) {
      const curr = get();
      if (curr.pendingSecretDemand) {
        const { patch, logMsg } = resolveSecretDemand(curr, curr.pendingSecretDemand, choiceId);
        const label = turnLabel(curr);
        set({
          ...patch,
          pendingSecretDemand: null,
          log: [...curr.log, mkLog(label, logMsg, 'neutral')],
        });
      }
    }

    // ── Phase 4, Chunk P4-G — the Claudius arc ──────────────────────────────
    // evt-claud-01's 'defy' choice branches via nextEventId (handled
    // entirely by the generic branching logic above, before this function
    // ever reaches this point — see resolveEventChoice's early return) —
    // pendingSecretDemand deliberately stays set across that transition so
    // evt-claud-02's own resolution (below) can still read it.
    if (defId === 'evt-claud-01') {
      const curr = get();
      const label = turnLabel(curr);
      if (choiceId === 'comply' && curr.pendingSecretDemand) {
        const { patch, logMsg } = resolveSecretDemand(curr, curr.pendingSecretDemand, 'comply');
        set({
          ...patch,
          pendingSecretDemand: null,
          log: [...curr.log, mkLog(label, logMsg, 'neutral')],
        });
      } else if (choiceId === 'wait') {
        set({
          pendingSecretDemand: null,
          claudiusPatience: BALANCE.secrets.claudius.patienceSeasons,
          log: [...curr.log, mkLog(label, 'You buy a season\'s silence — no more.', 'neutral')],
        });
      }
    }

    if (defId === 'evt-claud-02' && choiceId === 'so-be-it') {
      const curr = get();
      const { patch, logMsg } = resolveClaudiusDefiance(curr);
      set({
        ...patch,
        log: [...curr.log, mkLog(turnLabel(curr), logMsg, 'bad')],
      });
    }

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
      ...bumpActions(s),
      // Effect-string-driven patch can mix costs and gains; approximate "spent" as
      // the net decrease only (a net gain isn't counted as negative spend).
      ...bumpSpend(s, {
        fides:   statePatch.fides   !== undefined && statePatch.fides   < s.fides   ? s.fides   - statePatch.fides   : undefined,
        denarii: statePatch.denarii !== undefined && statePatch.denarii < s.denarii ? s.denarii - statePatch.denarii : undefined,
      }),
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
    // P3-A — a save written before phase/ignitedYear/endedYear/terminalOutcome
    // existed on WarState has wars entries missing them; the top-level
    // INITIAL_STATE spread above only backfills whole missing FIELDS, not
    // missing keys inside an array's elements, so each war is normalised here.
    wars: (savedState.wars ?? []).map(w => ({
      ...w,
      // Approximation only — a pre-P3-A save has no record of the true
      // ignition/end year, so both fall back to "now" / unknown.
      phase: w.phase ?? phaseForYear(savedState.year, w.warScore),
      ignitedYear: w.ignitedYear ?? savedState.year,
      endedYear: w.endedYear ?? null,
      terminalOutcome: w.terminalOutcome ?? null,
      // P3-B — same approximation-only treatment as the P3-A fields above.
      peaceOffered: w.peaceOffered ?? false,
      lastFundingOfferTurn: w.lastFundingOfferTurn ?? (savedState.turnNumber - BALANCE.war.funding.recurTurns),
    })),
    // P3-D — a pre-P3-D save has no cadetBranch at all; generate one now so
    // an in-progress legacy run gains the extinction safety net immediately
    // rather than only the first time resolveDeathNotice lazily regenerates
    // one (which works too, but leaves evt-cadet-visit tracking nothing
    // until extinction actually happens).
    cadetBranch: savedState.cadetBranch ?? generateCadet(),
    // Phase 4, Chunk P4-F — see backfillLegacyObjectives's doc comment.
    legacyObjectives: backfillLegacyObjectives(savedState.legacyObjectives),
    // Phase 4, Chunk P4-G — a save written before the Claudius arc existed
    // has no secret-claudius-arc entry at all; inject it now so an
    // in-progress pre-P4-G run still gets the arc (design invariant 9).
    // Guarded on the id alone — there is no earlier mechanism that could
    // have "resolved" a Secret that didn't yet exist, so id-presence is a
    // complete check, not just a first-pass approximation.
    secrets: (savedState.secrets ?? []).some(sec => sec.id === CLAUDIUS_ARC_SECRET_ID)
      ? savedState.secrets
      : [
          ...(savedState.secrets ?? []),
          buildClaudiusStartingSecret(
            savedState.family.find(c => c.isPlayer)?.id ?? 'pc-1',
            savedState.turnNumber
          ),
        ],
    // Phase 4, Chunk P4-C — a pre-P4-C save has the old `trialQueue: Trial[]`
    // shape (and no `trials` key at all — `...savedState` above only
    // overrides trials if the key is actually present in the parsed JSON).
    // Same per-element migration pattern as the `wars` block above.
    // Purchased defenseStrength is never lost (design invariant 9) —
    // convertLegacyTrial seeds playerPrep.logos from it directly.
    // Phase 4, Chunk P4-D — a pre-P4-D save's `trials` may already exist
    // (post-P4-C) but with the old flat `playerPrep: {totalStrength,
    // actionsUsed}` shape. normalizePlayerPrep backfills the sectioned shape,
    // seeding the raw preserved number into `logos` (same choice as
    // convertLegacyTrial/turnSequencer's NPC-trigger baseline, for the same
    // reason — an undifferentiated flat bonus has no section it more
    // naturally belongs to).
    // Phase 4, Chunk P4-E — `session` didn't exist before this chunk, and no
    // prior chunk ever actually assigned status: 'in_session' (P4-C/D always
    // resolved synchronously) — a pre-P4-E save can only have 'preparing' or
    // 'resolved' trials, so `session: t.session ?? null` is a plain
    // backfill. The defensive `status` reset below only matters if a shape
    // ever regresses this invariant later (an in_session trial with no live
    // session would otherwise be stuck forever with no UI able to reach it) —
    // resetting to 'preparing' lets turnSequencer just redraw it next season.
    trials: (savedState.trials ?? (((savedState as any).trialQueue ?? []) as any[]).map(legacy =>
      convertLegacyTrial(
        legacy,
        savedState.turnNumber,
        savedState.clans,
        savedState.family.find(c => c.isPlayer)?.id ?? 'pc-1'
      )
    )).map((t: any) => ({
      ...t,
      playerPrep: normalizePlayerPrep(t.playerPrep),
      session: t.session ?? null,
      status: (t.status === 'in_session' && !t.session) ? 'preparing' : t.status,
    })),
    // Family House rework — `library` was a personal asset (data/assetDefinitions.ts)
    // before this rework and is now a house room instead; a save written
    // before this feature existed has no `house` key at all (backfilled from
    // INITIAL_STATE.house by the top-level spread above, same mechanic every
    // other per-field migration in this function relies on) and may still
    // carry a `library` OwnedAsset — migrated onto the (possibly fresh
    // starter) house as a built room rather than silently dropped, so no
    // invested progress is lost. Every other relocated asset (vineyard/
    // gladiator_school/urban_insulae/baths) needs no migration at all — they
    // keep their exact OwnedAsset shape, just bought from Latium now.
    ownedAssets: (savedState.ownedAssets ?? []).filter(a => a.definitionId !== 'library'),
    house: (() => {
      const baseHouse = savedState.house ?? INITIAL_STATE.house;
      const hadLibraryAsset = (savedState.ownedAssets ?? []).some(a => a.definitionId === 'library');
      return (hadLibraryAsset && !baseHouse.builtRooms.includes('library'))
        ? { ...baseHouse, builtRooms: [...baseHouse.builtRooms, 'library' as const] }
        : baseHouse;
    })(),
    // Always reset transient UI state — these must not be loaded from disk
    gameStarted:   true,
    debugMode:     false,
    agendaVisible: false,
    uiNavRequest:  null,
    selectedTrialId: null,
    basilicaReturnTab: null,
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
      ...bumpActions(s),
    }));
  },

  proposeIncorporationBill: (provinceId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province || !province.incorporationBillAvailable) return;
    const def = getProvinceDefinition(provinceId);
    if (!def) return;
    const bill = buildIncorporationBill(province, def);
    if (s.bills.some(b => b.name === bill.name)) return;
    get().submitBill(bill);
  },

  proposeDeclareWarBill: (provinceId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province || province.status !== 'foreign') return;
    const def = getProvinceDefinition(provinceId);
    if (!def || def.clientOf) return;
    if (getRelationshipTier(province.relationshipScore) !== 'hostile') return;
    const enemyId = getForeignWarTargetEnemyId(def);
    if (s.wars.some(w => w.active && w.enemyId === enemyId)) return;
    const bill = buildDeclareWarBill(province, def);
    if (s.bills.some(b => b.name === bill.name)) return;
    get().submitBill(bill);
  },

  seekAmbassadorPosting: (provinceId) => {
    const s = get();
    const province = s.provinces.find(p => p.id === provinceId);
    if (!province || province.playerAmbassador) return;
    if (province.status !== 'unincorporated' && province.status !== 'foreign') return;
    const def = getProvinceDefinition(provinceId);
    if (!def) return;
    const character = s.family.find(c => c.id === s.selectedCharacterId) ?? s.family.find(c => c.isPlayer);
    if (!character) return;
    const bill = buildAmbassadorPostingBill(province, def, character.id, character.name);
    if (s.bills.some(b => b.name === bill.name)) return;
    get().submitBill(bill);
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
      ...bumpActions(s),
      ...bumpSpend(s, {
        fides:   rp.fides   !== undefined && rp.fides   < 0 ? -rp.fides   : undefined,
        denarii: rp.denarii !== undefined && rp.denarii < 0 ? -rp.denarii : undefined,
      }),
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
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: def.cost }),
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
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: upgradeCost }),
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

    const { getClientSlotCap } = require('../engine/houseEngine');
    if (s.clients.length >= getClientSlotCap(s.house)) return;

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
      ...bumpActions(s),
      ...bumpSpend(s, { fides: 20 }),
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
      // Military Overhaul M8: was inline 50 pre-M8 — now the balance
      // registry's constant, per the lifecycle spec's "new levies 40".
      bondToCommander:   BALANCE.battle.lifecycle.newLevyLoyalty,
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
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
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
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
    });
  },

  disbandTroops: (characterId, troopIds) => {
    set(s => ({
      family: s.family.map(c =>
        c.id === characterId
          ? {
              ...c,
              raisedLegions: c.raisedLegions.filter(t => !troopIds.includes(t.id)),
              // Military Overhaul M8: veterans (incl. captured elephants,
              // which only ever land in this array) are now disbandable
              // too — the "retain vs disband" tension the plan calls for
              // has to apply to a unit's whole lifecycle, not just its
              // first (raisedLegions) posting.
              veterans: c.veterans.filter(t => !troopIds.includes(t.id)),
            }
          : c
      ),
    }));
  },

  // ── Military Overhaul M8 — Donative ───────────────────────────────────────
  // Army-scope (a character's FULL raisedLegions + veterans, regardless of
  // which province each unit is stationed in): +15 loyalty to every unit,
  // once per year via the existing generic `<key>-cooldown` numeric-flags
  // decay pass (turnSequencer.ts's "Decrement all numeric cooldown flags"
  // step — see musterEngine.ts's baseline note 4 for the precedent).
  payDonative: (characterId) => {
    const s = get();
    const character = s.family.find(c => c.id === characterId);
    if (!character) return;
    const cooldownKey = `donative-cooldown-${characterId}`;
    if (s.flags[cooldownKey]) return;

    const troops = [...character.raisedLegions, ...character.veterans];
    if (troops.length === 0) return;

    const lc = BALANCE.battle.lifecycle;
    const cost = lc.donativeDenariiPerCohort * troops.length;
    if (s.denarii < cost) return;

    const grant = (t: TroopUnit): TroopUnit => ({
      ...t, bondToCommander: Math.min(100, t.bondToCommander + lc.donativeLoyaltyGain),
    });
    const updatedFamily = s.family.map(c =>
      c.id === characterId
        ? { ...c, raisedLegions: c.raisedLegions.map(grant), veterans: c.veterans.map(grant) }
        : c
    );

    const label = turnLabel(s);
    set({
      denarii: s.denarii - cost,
      family: updatedFamily,
      flags: { ...s.flags, [cooldownKey]: lc.donativeCooldownSeasons },
      log: [...s.log, mkLog(label, `${character.name} pays a donative to the army. (+${lc.donativeLoyaltyGain} loyalty, −${cost} Denarii)`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
    });
  },

  // ── Military Overhaul M4 — battle bridge ──────────────────────────────────

  resolveBattleOutcome: (battleState, romeSide, outcome, ctx) => {
    const s = get();
    const { state: nextState, ledgerNotes } = applyBattleOutcome(s, battleState, romeSide, outcome, ctx);
    const label = turnLabel(s);
    const logType: LogEntry['type'] =
      outcome.victor === 'withdrawal' ? 'neutral' : outcome.victor === romeSide ? 'good' : 'bad';
    set({
      ...nextState,
      log: [...nextState.log, ...ledgerNotes.map(note => mkLog(label, note, logType))],
    });
  },

  payRansom: (characterId) => {
    const s = get();
    const character = s.family.find(c => c.id === characterId);
    if (!character?.captivity || character.captivity.status !== 'awaiting_ransom') return;
    if (s.denarii < character.captivity.demandDenarii) return;

    const result = resolveRansomChoice(s.family, characterId, 'pay', 0);
    const label = turnLabel(s);
    set({
      family: result.family,
      denarii: s.denarii + result.denariiDelta,
      log: [...s.log, mkLog(label, result.logMessage, 'neutral')],
    });
  },

  negotiateRansom: (characterId) => {
    const s = get();
    const character = s.family.find(c => c.id === characterId);
    if (!character?.captivity || character.captivity.status !== 'awaiting_ransom') return;
    if (s.fides < BALANCE.war.ransom.negotiateFidesCost) return;

    const player = s.family.find(c => c.isPlayer);
    const result = resolveRansomChoice(s.family, characterId, 'negotiate', player?.skills.intrigus ?? 0);
    if (s.denarii + result.denariiDelta < 0) return; // can't afford even the (possibly halved) ransom

    const label = turnLabel(s);
    set({
      family: result.family,
      denarii: s.denarii + result.denariiDelta,
      fides: s.fides + result.fidesDelta,
      log: [...s.log, mkLog(label, result.logMessage, 'neutral')],
    });
  },

  refuseRansom: (characterId) => {
    const s = get();
    const character = s.family.find(c => c.id === characterId);
    if (!character?.captivity || character.captivity.status !== 'awaiting_ransom') return;

    const result = resolveRansomChoice(s.family, characterId, 'refuse', 0);
    const label = turnLabel(s);
    set({
      family: result.family,
      lifetimeDignitas: Math.max(0, s.lifetimeDignitas + result.lifetimeDignitasDelta),
      log: [...s.log, mkLog(label, result.logMessage, 'bad')],
    });
  },

  // ── Military Overhaul M5 — battle session ─────────────────────────────────

  startSandboxBattle: () => {
    const s = get();
    const player = s.family.find(c => c.isPlayer);
    if (!player) return;

    // Debug/sandbox only — synthesize a small starting force if the player
    // has none, so the M4 write-back has real strategic records to exercise
    // end-to-end. M11 replaces this with a full army builder.
    let attackerCharacter = player;
    // Defensive optional-chaining: older saves/characters may predate these
    // fields (see startingFamily.ts's fix in this same chunk).
    if ((player.raisedLegions?.length ?? 0) === 0 && (player.veterans?.length ?? 0) === 0) {
      const classes: UnitClass[] = ['legionary', 'legionary', 'legionary', 'spear_foot', 'spear_foot', 'cavalry_light'];
      const synthTroops: TroopUnit[] = classes.map((unitClass, i) => ({
        id: `sandbox-troop-${Date.now()}-${i}`,
        type: 'raised',
        strength: 8,
        campaignsSurvived: 0,
        yearsInactive: 0,
        bondToCommander: 55,
        musterProvinceId: s.provinces[0]?.id ?? 'sicilia',
        unitClass,
        veterancy: 'trained',
      }));
      attackerCharacter = { ...player, raisedLegions: synthTroops };
      set({ family: s.family.map(c => (c.id === player.id ? attackerCharacter : c)) });
    }

    const attackerUnits = musterArmy(attackerCharacter);
    const captains = getEligibleFamilyCaptains(s.family, player.id, s.flags);
    const attackerRoster: Record<string, number> = { [player.id]: player.skills.martial };
    for (const c of captains) attackerRoster[c.characterId] = c.martial;

    const terrain = BALANCE.battle.terrains.open_plain;
    const seed = Math.floor(Math.random() * 1e9);
    // M7 — hand-drawing/AI-deployment use their own RNG instances (offset
    // from the battle seed) so they don't overlap the battle's own internal
    // round-by-round RNG stream (battleEngine.makeContinuedRng reconstructs
    // makeSeededRng(seed) fresh and fast-forwards rngCallsConsumed draws).
    const attackerHand = drawStratagemHand(player.skills.martial, attackerUnits, terrain, makeSeededRng(seed ^ 0x51ed270b));
    const defenderArmy = buildSandboxDefenderArmy();
    const generalProfile = ENEMY_GENERAL_LIST[Math.floor(Math.random() * ENEMY_GENERAL_LIST.length)];
    const defenderHand = drawStratagemHand(generalProfile.martial, defenderArmy, terrain, makeSeededRng(seed ^ 0x2545f491));
    const aiDeployment = chooseDeployment(generalProfile, defenderArmy, terrain, defenderHand, makeSeededRng(seed ^ 0x9e3779b9));

    const attackerInput: DeploySideInput = {
      label: attackerCharacter.name,
      deployment: buildDefaultDeployment(attackerUnits),
      commanderId: player.id,
      roster: { martialById: attackerRoster },
      stratagemHand: attackerHand,
    };
    const defenderInput: DeploySideInput = {
      label: `Carthage (${generalProfile.name} ${generalProfile.epithet})`,
      deployment: aiDeployment.deployment,
      commanderId: aiDeployment.commanderId,
      roster: aiDeployment.roster,
      generalProfileId: generalProfile.id,
      stratagemHand: defenderHand,
    };

    const bridgeCtx: BattleBridgeContext = {
      troopOwnerCharacterId: attackerCharacter.id,
      legateRoster: {},
      // Military Overhaul M8 — drives the post-battle captured-elephant
      // roll; computed from the enemy's DEPLOYED army (survival by
      // battle's end is irrelevant, see musterEngine.ts's comment).
      enemyFieldedElephants: defenderArmy.some(u => u.unitClass === 'elephant'),
      turnNumber: s.turnNumber,
    };

    set({
      activeBattleSetup: {
        attackerInput, defenderInput,
        terrain,
        seed,
        bridgeCtx,
      },
    });
  },

  startCustomSandboxBattle: (attackerUnits, attackerGeneralProfileId, defenderUnits, defenderGeneralProfileId, terrainId, seed) => {
    const s = get();
    const attackerProfile = ENEMY_GENERALS[attackerGeneralProfileId] ?? ENEMY_GENERAL_LIST[0];
    const defenderProfile = ENEMY_GENERALS[defenderGeneralProfileId] ?? ENEMY_GENERAL_LIST[0];
    const terrain = BALANCE.battle.terrains[terrainId] ?? BALANCE.battle.terrains.open_plain;
    const battleSeed = seed ?? Math.floor(Math.random() * 1e9);

    // Same RNG-offset convention as startSandboxBattle — see its comment.
    const attackerHand = drawStratagemHand(attackerProfile.martial, attackerUnits, terrain, makeSeededRng(battleSeed ^ 0x51ed270b));
    const defenderHand = drawStratagemHand(defenderProfile.martial, defenderUnits, terrain, makeSeededRng(battleSeed ^ 0x2545f491));
    const attackerDeployed = chooseDeployment(attackerProfile, attackerUnits, terrain, attackerHand, makeSeededRng(battleSeed ^ 0x6a09e667));
    const defenderDeployed = chooseDeployment(defenderProfile, defenderUnits, terrain, defenderHand, makeSeededRng(battleSeed ^ 0x9e3779b9));

    const attackerInput: DeploySideInput = {
      label: `${attackerProfile.name} ${attackerProfile.epithet}`,
      deployment: attackerDeployed.deployment,
      commanderId: attackerDeployed.commanderId,
      roster: attackerDeployed.roster,
      generalProfileId: attackerProfile.id,
      stratagemHand: attackerHand,
    };
    const defenderInput: DeploySideInput = {
      label: `${defenderProfile.name} ${defenderProfile.epithet}`,
      deployment: defenderDeployed.deployment,
      commanderId: defenderDeployed.commanderId,
      roster: defenderDeployed.roster,
      generalProfileId: defenderProfile.id,
      stratagemHand: defenderHand,
    };

    // Decoupled from the real family/strategic layer (see this action's
    // type-doc comment) — troopOwnerCharacterId is a sentinel no real
    // Character will ever match, so applyBattleOutcome's write-back is a
    // safe no-op (musterEngine.ts's family.map/find calls all degrade to
    // "no character found" branches) while the battle still plays out
    // through the exact same DeploymentBoard/BattleScreen/returnFromBattle
    // pipeline as every other sandbox entry point.
    const bridgeCtx: BattleBridgeContext = {
      troopOwnerCharacterId: 'sandbox-custom-no-owner',
      legateRoster: {},
      enemyFieldedElephants: defenderUnits.some(u => u.unitClass === 'elephant'),
      turnNumber: s.turnNumber,
    };

    set({
      activeBattleSetup: {
        attackerInput, defenderInput,
        terrain,
        seed: battleSeed,
        bridgeCtx,
      },
    });
  },

  commitDeployment: (attackerDeployment, defenderDeployment) => {
    const s = get();
    if (!s.activeBattleSetup) return;
    const { attackerInput, defenderInput, terrain, seed, bridgeCtx } = s.activeBattleSetup;
    try {
      const battleState = initBattle(
        { ...attackerInput, deployment: attackerDeployment },
        { ...defenderInput, deployment: defenderDeployment },
        terrain, seed,
      );
      set({ activeBattle: battleState, activeBattleSetup: null, activeBattleBridgeCtx: bridgeCtx });
    } catch (e) {
      const label = turnLabel(s);
      set({ log: [...s.log, mkLog(label, `Invalid deployment: ${(e as Error).message}`, 'bad')] });
    }
  },

  cancelDeployment: () => set({ activeBattleSetup: null }),

  submitBattleOrders: (ordersAttacker, ordersDefender) => {
    const s = get();
    if (!s.activeBattle) return;
    try {
      set({ activeBattle: submitOrders(s.activeBattle, ordersAttacker, ordersDefender) });
    } catch (e) {
      console.warn('[M5] submitBattleOrders failed:', e);
    }
  },

  submitBattleBreakDecision: (laneId, decision, targetLane) => {
    const s = get();
    if (!s.activeBattle) return;
    try {
      set({ activeBattle: submitBreakDecision(s.activeBattle, laneId, decision, targetLane) });
    } catch (e) {
      console.warn('[M5] submitBattleBreakDecision failed:', e);
    }
  },

  returnFromBattle: () => {
    const s = get();
    const battle = s.activeBattle;
    if (battle?.phase === 'resolved' && battle.outcome && s.activeBattleBridgeCtx) {
      get().resolveBattleOutcome(battle, 'attacker', battle.outcome, s.activeBattleBridgeCtx);
    }
    set({ activeBattle: null, activeBattleSetup: null, activeBattleBridgeCtx: null });
  },

  // ── Military Overhaul M9 — war score & set-piece scheduling ──────────────

  startWar: (enemyId, scale, provinceId = null) => {
    const s = get();
    if (s.wars.some(w => w.active && w.enemyId === enemyId && w.scale === scale)) return;
    const newWar: WarState = {
      id: `war-${enemyId}-${Date.now()}`,
      active: true,
      enemyId,
      scale,
      provinceId: provinceId ?? null,
      warScore: 0,
      startedTurn: s.turnNumber,
      // Immediately eligible for a scheduler roll — no mandatory dead
      // multi-turn wait before the first offer can appear.
      lastSetPieceTurn: s.turnNumber - BALANCE.war.setPieceOffer.minSpacingTurns,
      weariness: 0,
      pendingSetPiece: null,
      treaty: null,
      // P3-A
      phase: phaseForYear(s.year, 0),
      ignitedYear: s.year,
      endedYear: null,
      terminalOutcome: null,
      // P3-B
      peaceOffered: false,
      lastFundingOfferTurn: s.turnNumber - BALANCE.war.funding.recurTurns,
    };
    const label = turnLabel(s);
    set({
      wars: [...s.wars, newWar],
      log: [...s.log, mkLog(label, `Rome declares war on ${enemyId}.`, 'bad')],
    });
  },

  endWar: (warId) => {
    set(s => ({
      wars: s.wars.map(w => (w.id === warId ? { ...w, active: false, pendingSetPiece: null, phase: 'ended' as const, endedYear: s.year } : w)),
    }));
  },

  forceSetPieceOffer: (warId) => {
    const s = get();
    const war = s.wars.find(w => w.id === warId);
    if (!war || !war.active || war.pendingSetPiece) return;
    const offer = scheduleSetPiece(s, war, Math.random, { forceRoll: true });
    if (!offer) return;
    set({
      wars: s.wars.map(w => (w.id === warId ? { ...w, pendingSetPiece: offer, lastSetPieceTurn: s.turnNumber } : w)),
    });
  },

  acceptSetPieceOffer: (warId) => {
    const s = get();
    const war = s.wars.find(w => w.id === warId);
    const offer = war?.pendingSetPiece;
    const player = s.family.find(c => c.isPlayer);
    if (!war || !offer || !player) return;

    const attackerUnits = musterArmy(player);
    const captains = getEligibleFamilyCaptains(s.family, player.id, s.flags);
    const attackerRoster: Record<string, number> = { [player.id]: player.skills.martial };
    for (const c of captains) attackerRoster[c.characterId] = c.martial;

    const terrain = BALANCE.battle.terrains[offer.terrainId] ?? BALANCE.battle.terrains.open_plain;
    const seed = Math.floor(Math.random() * 1e9);
    // Same RNG-offset convention as startSandboxBattle — see its comment.
    const attackerHand = drawStratagemHand(player.skills.martial, attackerUnits, terrain, makeSeededRng(seed ^ 0x51ed270b));

    const generalProfile = ENEMY_GENERALS[offer.enemyGeneralId] ?? ENEMY_GENERAL_LIST[0];
    const defenderHand = drawStratagemHand(generalProfile.martial, offer.enemyArmy, terrain, makeSeededRng(seed ^ 0x2545f491));
    // offer.enemyArmy was already generated by warEngine.scheduleSetPiece —
    // chooseDeployment only lays it out into lanes/reserve, it does not
    // regenerate the army.
    const aiDeployment = chooseDeployment(generalProfile, offer.enemyArmy, terrain, defenderHand, makeSeededRng(seed ^ 0x9e3779b9));

    const attackerInput: DeploySideInput = {
      label: player.name,
      deployment: buildDefaultDeployment(attackerUnits),
      commanderId: player.id,
      roster: { martialById: attackerRoster },
      stratagemHand: attackerHand,
    };
    const defenderInput: DeploySideInput = {
      label: `Carthage (${generalProfile.name} ${generalProfile.epithet})`,
      deployment: aiDeployment.deployment,
      commanderId: aiDeployment.commanderId,
      roster: aiDeployment.roster,
      generalProfileId: generalProfile.id,
      stratagemHand: defenderHand,
    };

    const bridgeCtx: BattleBridgeContext = {
      troopOwnerCharacterId: player.id,
      legateRoster: {},
      enemyFieldedElephants: offer.enemyArmy.some(u => u.unitClass === 'elephant'),
      provinceId: war.provinceId ?? undefined,
      turnNumber: s.turnNumber,
      warId: war.id,
    };

    set({
      wars: s.wars.map(w => (w.id === warId ? { ...w, pendingSetPiece: null } : w)),
      activeBattleSetup: { attackerInput, defenderInput, terrain, seed, bridgeCtx },
    });
  },

  declineSetPieceOffer: (warId) => {
    const s = get();
    const war = s.wars.find(w => w.id === warId);
    if (!war || !war.pendingSetPiece) return;
    const so = BALANCE.war.setPieceOffer;
    const siteName = war.pendingSetPiece.siteName;
    const label = turnLabel(s);
    set({
      wars: s.wars.map(w => (w.id === warId
        ? { ...w, warScore: Math.min(100, Math.max(-100, w.warScore + so.declineWarScorePenalty)), pendingSetPiece: null }
        : w)),
      lifetimeDignitas: s.lifetimeDignitas + so.declineLifetimeDignitasPenalty,
      log: [...s.log, mkLog(label, `Rome declines battle at ${siteName}.`, 'bad')],
    });
  },

  // ── Military Overhaul M10 — peace: negotiation & Senate ratification ─────

  acceptAiTreatyOffer: (warId) => {
    const s = get();
    const war = s.wars.find(w => w.id === warId);
    if (!war || war.treaty?.stage !== 'ai_offer' || war.treaty.ratified !== null) return;

    const winner: TreatySide = war.warScore >= 0 ? 'rome' : 'enemy';
    const effectPatch = applyTreatyEffects(war.treaty.termIds, s, winner);
    const label = turnLabel(s);
    set({
      ...effectPatch,
      wars: s.wars.map(w => (w.id === warId
        ? { ...w, active: false, pendingSetPiece: null, treaty: { ...w.treaty!, ratified: true, resolvedTurn: s.turnNumber } }
        : w)),
      log: [...s.log, mkLog(label, `Rome accepts terms from ${war.enemyId}. The war is over.`, 'good')],
    });
  },

  refuseAiTreatyOffer: (warId) => {
    const s = get();
    const war = s.wars.find(w => w.id === warId);
    if (!war || war.treaty?.stage !== 'ai_offer' || war.treaty.ratified !== null) return;

    const label = turnLabel(s);
    set({
      wars: s.wars.map(w => (w.id === warId ? { ...w, treaty: null } : w)),
      lifetimeDignitas: s.lifetimeDignitas + BALANCE.war.treaty.refuseAiOfferLifetimeDignitasPenalty,
      log: [...s.log, mkLog(label, `Rome refuses terms from ${war.enemyId}. The war continues.`, 'neutral')],
    });
  },

  tableTreaty: (warId, termIds) => {
    const s = get();
    if (s.currentOffice !== 'consul') return;
    const war = s.wars.find(w => w.id === warId);
    if (!war || war.treaty) return;
    if (getDesperationTier(war.warScore) === 'none') return;

    const winner: TreatySide = war.warScore >= 0 ? 'rome' : 'enemy';
    const bill = buildTreatyBill(war, termIds, s, winner);
    const label = turnLabel(s);
    set({
      bills: [...s.bills, bill],
      wars: s.wars.map(w => (w.id === warId
        ? {
            ...w,
            treaty: {
              id: bill.id,
              proposedTurn: s.turnNumber,
              resolvedTurn: null,
              termIds,
              ratified: null,
              initiator: 'rome',
              stage: 'senate_vote',
            },
          }
        : w)),
      log: [...s.log, mkLog(label, `A treaty with ${war.enemyId} is tabled before the Senate.`, 'neutral')],
    });
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
      ...bumpActions(s),
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
      ...bumpActions(s),
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
      ...bumpActions(s),
    });
  },

  // ── Canvassing ─────────────────────────────────────────────────────────────

  canvassLeader: (leaderId) => {
    const s = get();
    if (!s.campaigning) return;
    const canvassCost = getCanvassFidesCost(s.campaigning); // P2-E: scaled by office band
    if (s.fides < canvassCost) return;
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
    const newFides = s.fides - canvassCost;
    const label = turnLabel(s);

    if (Math.random() < CANVASS_EVENT_CHANCE && !s.activeCanvassingEvent) {
      const event = CANVASSING_EVENTS[Math.floor(Math.random() * CANVASSING_EVENTS.length)];
      set({
        fides:                   newFides,
        activeCanvassingEvent:   event,
        pendingCanvassLeaderId:  leaderId,
        pendingCanvassRoll:      roll,
        pendingCanvassThreshold: effectiveThreshold,
        ...bumpActions(s),
        ...bumpSpend(s, { fides: canvassCost }),
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
      ...bumpActions(s),
      ...bumpSpend(s, { fides: canvassCost }),
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
