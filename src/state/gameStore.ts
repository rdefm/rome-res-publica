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
import type { CityState, GovernorPolicy, CampaignState, OfficerVolunteerState } from '../models/city';
import { getRelationshipTier } from '../models/city';
import type { TroopUnit } from '../models/troop';
import type { SenateResponseState } from '../engine/senateResponseEngine';
import type { CrisisState, CrisisTrackId } from '../models/crisis';
import type { OfficeActionTargetContext } from '../engine/officeActionEngine';
// ── Phase 1 (P1-A) ────────────────────────────────────────────────────────────
import type { StartId, GensId, DifficultyId } from '../models/gameStart';
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
import { buildInitialCityStates, getCityDefinition } from '../data/cityDefinitions';
import type { TheatreState, RegionId } from '../models/theatre';
import { REGIONS } from '../data/theatreMap';
import type { Army } from '../models/army';
import { combine as engineCombineArmies, divide as engineDivideArmy, armyPowerOf } from '../engine/armyEngine';
import {
  applyBattleMomentum, computeSicilyControl, computeArmyBalance, computeWearinessGap, computeWarScore,
} from '../engine/warStanding';
import type { MusterTier } from '../engine/musterEngine';
import { quoteMuster, rollMusteredUnit, nextLegionName } from '../engine/musterEngine';
import { getRegion, getRegionRelationship } from '../engine/theatreEngine';
import { buildMovementOrder } from '../engine/movementEngine';
import type { CampaignLog, CampaignLogEntry, Engagement } from '../models/campaignLog';
import { resolveEngagement, applyPostBattleContinuation } from '../engine/campaignResolver';
import { profileForCarthageArmy } from '../engine/campaignAi';
import {
  armyUnitToBattleUnit, applyArmyBattleOutcome, applyCommanderFate, armyUnitToTroop,
} from '../engine/battle/armyBattleBridge';
import type { Command, CommandElectionState } from '../models/command';
import {
  isEligibleForCommand,
  isWarActiveForCommand,
  generateCommandRivals,
  commandCanvassFidesCost,
  commandCanvassThreshold,
  rollCommandCanvass,
  calcProrogationModifier,
  COMMAND_CANVASS_MIN_RELATIONSHIP,
} from '../engine/commandEngine';
import { processSeason, buildTriumphBill } from '../engine/turnSequencer';
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
  resolveCityEventEffect,
} from '../engine/cityEngine';
import { getHouseLocationDefinition } from '../data/houseLocations';
import { getCityClientDef } from '../data/cityClients';
import { getEventsForContext, getCityEventDef } from '../data/cityEvents';
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
import { injectNoticeEvent, getEffectiveSkill } from '../engine/eventEngine';
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
import { applyTreatyEffects, buildTreatyBill, getDesperationTier, phaseForYear, type TreatySide } from '../engine/warEngine';
import { generateCadet } from '../engine/inheritanceEngine';
// Phase 5, Chunk P5-F — Achievements ("Laurels"). evaluateAchievements is
// pure (no AsyncStorage), safe to import eagerly; achievementStore is
// required lazily inside endSeason, same idiom as ancestorStore/saveLoad
// just below it — a top-level import would pull in AsyncStorage's native
// module at gameStore.ts load time, breaking every test file that imports
// gameStore.ts without first mocking @react-native-async-storage/async-storage.
import { evaluateAchievements } from '../engine/achievementEngine';

export interface LogEntry {
  id: string;
  turn: string;
  text: string;
  type: 'good' | 'bad' | 'neutral';
}

/** Campaign Map plan, Chunk C8 — stamped on activeBattleSetup/
 *  activeBattleBridgeCtx when a battle was launched from
 *  takeTheFieldForEngagement (a real campaign engagement), instead of
 *  BattleBridgeContext (the sandbox/M9-set-piece shape). Distinguished
 *  structurally (its own `engagementId` field) rather than a nominal `kind`
 *  tag, so BattleBridgeContext itself never needed touching. */
export interface CampaignBattleBridgeContext {
  engagementId: string;
  regionId: RegionId;
  romeArmyId: string;
  enemyArmyId: string;
  /** Whether the Rome-side army was the campaign engagement's `attackerArmyId`
   *  (vs. `defenderArmyId`) — battleEngine always deploys the Rome-side army
   *  into the UI-attacker slot regardless (DeploymentBoard only lets the
   *  player edit that slot), so this is the only way to map the battle's
   *  own attacker/defender victor back onto which CAMPAIGN side actually
   *  advances into the region. */
  romeIsCampaignAttacker: boolean;
  /** Did the enemy (Carthage) side field elephants at deployment? Same M8
   *  convention as BattleBridgeContext.enemyFieldedElephants — captured here
   *  since the enemy Army itself may no longer exist by the time the battle
   *  resolves (arbitrarily many rounds later). */
  enemyFieldedElephants: boolean;
  turnNumber: number;
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

  // July 2026 fixes, Chunk D — governor/ambassador city event (data/cityEvents.ts's
  // CITY_EVENTS pool). Kept separate from pendingEvents/activeEvent above since
  // CityEventDefinition is a distinct shape (city-scoped effects, not player-resource
  // ones) with its own resolution path — see cityEngine.rollCityEventTick /
  // resolveCityEventEffect and CityEventModal.tsx. Single slot, not a queue: only
  // one can be active at a time (rollCityEventTick no-ops while this is set).
  activeCityEvent: { defId: string; cityId: string } | null;

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
  cities: CityState[];
  lifetimeImperium: number;

  // ── Campaign Map plan, Chunk C1 — theatre (controllers/contested only; ──
  // the static Region/Edge data stays in data/theatreMap.ts). Unread by any
  // engine yet — C2+ builds armies/movement/AI on top of this.
  theatre: TheatreState;

  // ── Campaign Map plan, Chunk C2 — armies. A new, parallel model to the
  // existing Character.raisedLegions/veterans (TroopUnit) personal-legion
  // system — NOT a replacement (see models/army.ts's header comment for the
  // full reasoning). No movement yet (C5); no muster (C3) — armies exist
  // here only via debug spawn/combine/divide.
  armies: Army[];

  // ── Campaign Map plan, Chunk C4 — the theatre command. A NEW, PARALLEL
  // election track to Cursus's Winter magistracy campaigns (campaigning/
  // campaignVotes/electionRivals) — see models/command.ts's header comment
  // for why they aren't shared. commandElection is null when no vote is
  // open; activeCommand is null when no one currently holds the command.
  activeCommand: Command | null;
  commandElection: CommandElectionState | null;

  // ── Campaign Map plan, Chunk C7 — turn-end campaign resolution. Written
  // by turnSequencer's new step (6c) every season; campaignLog is the
  // Provinciae tab's playback source (MapView's playback mode replays it,
  // never recomputes). pendingEngagements accumulates any battle involving
  // a player-manageable army that the resolver deferred (see
  // campaignResolver.ts's header comment on why C7 exposes a temporary
  // abstract-only resolution path rather than leaving these genuinely
  // stuck until C8's tactical battle bridge exists).
  campaignLog: CampaignLog | null;
  pendingEngagements: Engagement[];

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
    bridgeCtx: BattleBridgeContext | CampaignBattleBridgeContext;
  } | null;
  activeBattle: BattleState | null;
  /** Carried over from activeBattleSetup.bridgeCtx at commitDeployment time
   *  (activeBattleSetup itself is cleared once the battle starts) — needed
   *  by returnFromBattle to call resolveBattleOutcome (M4) once the battle
   *  finishes, arbitrarily many rounds later. Campaign Map plan, Chunk C8 —
   *  widened to a union: a battle launched from takeTheFieldForEngagement
   *  carries a CampaignBattleBridgeContext instead (distinguished by its
   *  `engagementId` field, which BattleBridgeContext never has — see
   *  returnFromBattle's own branch). */
  activeBattleBridgeCtx: BattleBridgeContext | CampaignBattleBridgeContext | null;

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
  /** True if any city currently has an active CampaignState. */
  activeCampaignExists: boolean;
  /** True if any family member has raisedLegions.length > 0 or veterans.length > 0. */
  familyHasTroops: boolean;
  /** True if any city has infrastructureRating ≥ 30. */
  anyCityHasRoads: boolean;
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

  // ── Phase 5, Chunk P5-E — gens identity (alternate starting families) ──────
  // Four grammatical forms, all needed somewhere in the codebase's existing
  // flavor text (verified by the P5-E neutrality sweep) — stored explicitly
  // rather than derived, matching STARTING_CLANS' own precedent of storing
  // both `name: 'Gens Cornelia'` and `gensName: 'Cornelius'` side by side
  // rather than computing one from the other.
  /** Stable machine key. 'brutii' for the original/guided family. */
  gensId: GensId;
  /** Masculine surname, e.g. 'Brutus' — used in character full names and
   *  generateSpouse/suggestChildName/generateCadet. */
  gensSurname: string;
  /** Feminine/adjectival form, e.g. 'Brutia' — used in "Gens {gensName}"
   *  phrasing (epilogue, historian paragraph, patron tier-up notice). */
  gensName: string;
  /** Collective plural, e.g. 'Brutii' — used in "the {gensPlural}" idioms
   *  (log messages, birth/adoption/client-join notices). */
  gensPlural: string;

  // ── Phase 5, Chunk P5-G — Difficulty preset ─────────────────────────────
  /** Chosen at new game (picker step after family selection), fixed for the
   *  run. Applied at exactly two seams — resourceEngine.calcResourceIncome's
   *  incomeMult and crisisEngine.calcIndividualEscalation's crisisMult (see
   *  BALANCE.difficulty). Recorded on AncestorRecord at epilogue time. */
  difficulty: DifficultyId;

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
  /** Phase 5, Chunk P5-I — stamped by saveLoad.ts's save()/exportSave() with
   *  CURRENT_SAVE_VERSION on every write; undefined on a fresh unsaved game
   *  and on any save written before this chunk. Purely informational today
   *  (see saveLoad.ts's own comment) — not read by any behavior branch. */
  saveVersion?: number;
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
   *  (e.g. a second, cadet-branch extinction) ever fires in Endless.
   *
   *  Campaign Map plan, Chunk C9 — also stands the Punic theatre down for
   *  good (the campaign step no-ops from here on, gated on `endlessMode` in
   *  turnSequencer.ts's step 6c): every `rome_state`-owned Army is removed
   *  ("stands down honorably"); every enemy-owned Army (`carthage`/
   *  `rome_rival`) is simply removed (the war is over); every `player`-owned
   *  Army is resolved per `personalArmyDecisions[armyId]` (default 'retain'
   *  if the caller omits an id) — 'disband' removes it outright, 'retain'
   *  folds its units back into its commander's `veterans` (via
   *  armyBattleBridge.armyUnitToTroop) if the commander is a living family
   *  member, otherwise it's removed the same as 'disband' (no one left to
   *  retain it for). EpilogueScreen gathers the decisions via a new
   *  confirmation modal before calling this (skipped entirely, called with
   *  `{}`, when there are no personal armies to decide on). */
  enterEndlessMode: (personalArmyDecisions: Record<string, 'retain' | 'disband'>) => void;

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

  // Assets (Feature 1) — now Provinciae → Latium's holdings. July 2026
  // fixes, Chunk E — locationId is 'latium' or a CityState.id; unifies what
  // used to be this pair plus a separate purchaseCityAsset/upgradeCityAsset
  // pair, now that both read the same AssetDefinition/OwnedAsset shape.
  purchaseAsset: (locationId: string, definitionId: string) => void;
  upgradeAsset: (locationId: string, definitionId: string) => void;

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
  startGame: (startId?: StartId, mode?: 'senator' | 'debug', difficulty?: DifficultyId) => void;

  // Log
  addLog: (text: string, type?: LogEntry['type']) => void;
  addCursusLog: (text: string, type?: LogEntry['type']) => void;

  // ── Provinciae ────────────────────────────────────────────────────────
  updateCityPolicy: (cityId: string, policy: GovernorPolicy) => void;
  resolveAmbassadorAction: (provinceId: string, actionId: AmbassadorActionId) => void;
  /** July 2026 fixes, Chunk D — resolves state.activeCityEvent's chosen
   *  option (governor/ambassador city event card). No-ops if none is active. */
  resolveCityEventChoice: (optionId: string) => void;
  /** Clears state.activeCityEvent without applying any effect (mirrors dismissEvent). */
  dismissCityEvent: () => void;
  proposeIncorporationBill: (provinceId: string) => void;
  proposeDeclareWarBill: (provinceId: string) => void;
  seekAmbassadorPosting: (provinceId: string) => void;
  recruitCityClient: (cityId: string, clientId: string) => void;
  updateCities: (cities: CityState[]) => void;

  // ── Campaign Map plan, Chunk C2 — armies ────────────────────────────────
  /** Debug-only entry point (per C2's "creatable in debug" goal) — C3 adds
   *  the real muster flow. Spawns a fresh Army with the given shape. */
  spawnArmy: (army: Army) => void;
  combineArmies: (armyIdA: string, armyIdB: string) => void;
  divideArmy: (armyId: string, unitIds: string[], newCommanderId?: string | null) => void;
  /** Character must exist in `family` (i.e. be alive — this codebase has no
   *  other "is this character alive" signal); no location gate is enforced
   *  since Character has no location field at all today — the plan's own
   *  fallback allowance for exactly this case. */
  assignArmyCommander: (armyId: string, characterId: string | null) => void;
  setArmyStance: (armyId: string, stance: Army['stance']) => void;
  /** Campaign Map plan, Chunk C3 — raises one cohort in `regionId` at the
   *  given tier. `targetArmyId`, if given, must be a player-owned Army
   *  already at `regionId` — the cohort joins it instead of forming a new
   *  Army. No-ops silently if quoteMuster's eligibility/imperium/denarii
   *  checks fail (mirrors this file's other guard-clause action convention
   *  — the panel is expected to disable the button first). */
  raiseTroops: (regionId: RegionId, tier: MusterTier, targetArmyId?: string | null) => void;

  // ── Campaign Map plan, Chunk C4 — The Command ────────────────────────────
  /** Opens a fresh extraordinary assembly. No-ops unless the war is active,
   *  no command is currently held, and no vote is already open. `fides`
   *  stake is spent regardless of whether a candidate is nominated.
   *  `candidateCharacterId` may be null to call the vote without personally
   *  contesting it (declareCommandCandidate can join in later, same as a
   *  challenger joining a prorogation vote). */
  callCommandVote: (candidateCharacterId: string | null) => void;
  /** Joins an already-open assembly (fresh or prorogation) as the player's
   *  family candidate. No-ops if no vote is open, a candidate is already
   *  standing, or the character isn't age-eligible. */
  declareCommandCandidate: (characterId: string) => void;
  /** Same shape as canvassLeader, scoped to commandElection instead of
   *  campaignVotes — see commandEngine.ts's header comment. */
  canvassForCommand: (leaderId: string) => void;

  // ── Campaign Map plan, Chunk C5 — Movement ───────────────────────────────
  /** Issues (or replaces) `armyId`'s order for this season — the ONLY entry
   *  point, so every stored order is guaranteed to have come from that
   *  army's own `movementEngine.reachable()` set (valid, in-budget,
   *  correctly intent-labelled). No-ops for an unmanageable army (not
   *  'player'/'rome_state' — mirrors ArmyCard's own canManage gate) or an
   *  unreachable/blocked destination. Nothing resolves the order yet — C7
   *  does, and clears `ordersThisSeason` afterward. */
  issueMovementOrder: (armyId: string, destinationRegionId: RegionId, forcedMarch: boolean) => void;
  clearOrder: (armyId: string) => void;

  // ── Campaign Map plan, Chunk C7/C8 — Turn-end resolution & the battle bridge ─
  /** Dismisses the playback (MapView's playback mode) once the player has
   *  watched or skipped it — clears campaignLog only, never pendingEngagements
   *  (a pending battle keeps its own agenda/interstitial alive independently
   *  of whether the map animation has been seen). */
  dismissCampaignLog: () => void;
  /** "Trust the Legate" — resolves one pending engagement via
   *  engine/battle/abstractResolver.ts's real resolver (Chunk C7's own
   *  stub, superseded by C8) and removes it from pendingEngagements. Applies
   *  any commanderFateRolls the resolver rolled for a real family-member
   *  commander (wound/capture/death) via armyBattleBridge.applyCommanderFate. */
  resolveEngagementAbstract: (engagementId: string) => void;
  /** "Take the Field" — Chunk C8. Stages a REAL tactical battle
   *  (battleEngine/DeploymentBoard/BattleScreen — the same M5 pipeline the
   *  sandbox and M9 set-piece flows already use) from a pending engagement's
   *  two Armies. If the Rome-side army is leaderless, auto-assigns the
   *  player's paterfamilias as its commander (permanently — see this
   *  action's own implementation comment) so DeploymentBoard has someone to
   *  draw a stratagem hand/roster martial for; "Trust the Legate" has no such
   *  fallback, since there's no legate to trust in the first place. No-op if
   *  the engagement doesn't exist or the player has no living paterfamilias
   *  to fall back on. */
  takeTheFieldForEngagement: (engagementId: string) => void;

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
  /** Campaign Map plan, Chunk C8 — the Army-flavored analog of
   *  resolveBattleOutcome above, called from returnFromBattle when
   *  activeBattleBridgeCtx is a CampaignBattleBridgeContext instead of a
   *  BattleBridgeContext. See engine/battle/armyBattleBridge.ts. */
  resolveCampaignBattleOutcome: (
    battleState: BattleState,
    outcome: BattleOutcome,
    ctx: CampaignBattleBridgeContext,
  ) => void;

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

// ─── Campaign Map plan, Chunk C1 — theatre init ────────────────────────────

/** Seeds TheatreState.controllers from each Region's static startingController
 *  (data/theatreMap.ts); `contested` starts empty — C7's turn-end resolution
 *  is the only writer once that chunk lands. */
function buildInitialTheatreState(): TheatreState {
  const controllers = {} as TheatreState['controllers'];
  const musteredThisYear = {} as TheatreState['musteredThisYear'];
  for (const region of REGIONS) {
    controllers[region.id] = region.startingController;
    musteredThisYear[region.id] = 0;
  }
  return { controllers, contested: {} as TheatreState['contested'], musteredThisYear };
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
  activeCityEvent: null,
  pendingBirthNaming: null,

  log: [mkLog('264 BC · Spring', 'The Brutii begin their ascent.', 'neutral')],
  cursusLog: [],

  seasonOverlayVisible: false,
  seasonOverlayEvents: [],

  // Provinciae
  cities: buildInitialCityStates(),
  lifetimeImperium: 0,
  theatre: buildInitialTheatreState(),
  armies: [],
  activeCommand: null,
  commandElection: null,
  campaignLog: null,
  pendingEngagements: [],

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
  anyCityHasRoads: false,
  triumphBillInQueue: false,
  npcConsulExists: false,

  consultatumUsedThisTerm: false,
  senatePacked: false,
  dictatorOverstaySeasons: 0,

  tribuneCandidateId: null,
  lastOfficeActionResult: null,

  // ── Phase 1 — Agenda tablet + tutorial (P1-A) ──────────────────────────────
  startId: 'standard' as StartId,

  // ── Phase 5, Chunk P5-E — gens identity ────────────────────────────────────
  gensId: 'brutii' as GensId,
  gensSurname: 'Brutus',
  gensName: 'Brutia',
  gensPlural: 'Brutii',

  // ── Phase 5, Chunk P5-G — Difficulty preset ────────────────────────────────
  difficulty: 'aequus' as DifficultyId,

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

/** Campaign Map plan, Chunk C9 — a DEFERRED battle's momentum feed + warScore
 *  recompute. campaignResolver.resolveCampaignSeason's own step 8 already
 *  did this for every battle resolved DURING that season's pass; a
 *  player-manageable engagement can resolve LATER (the interstitial waits
 *  on the player), after that pass already finished — this is the same
 *  math, applied once more right when that deferred battle actually
 *  resolves, so its result isn't silently lost until next season. Does NOT
 *  decay momentum (that's a once-per-season thing, already done this
 *  season) — only adds this battle's delta and refreshes warScore from the
 *  CURRENT (post-battle) armies/cities against the momentum this produces. */
function applyDeferredBattleToWarStanding(
  wars: WarState[],
  armies: Army[],
  cities: CityState[],
  winnerPower: 'rome' | 'carthage',
  tier: 'marginal' | 'clear' | 'crushing',
): WarState[] {
  const bumped = applyBattleMomentum(wars, 'carthage', winnerPower, tier);
  const sicilyControl = computeSicilyControl(cities);
  const armyBalance = computeArmyBalance(armies);
  return bumped.map(w => {
    if (!w.active || w.scale !== 'major' || w.enemyId !== 'carthage') return w;
    const wearinessGap = computeWearinessGap(w.weariness, w.enemyWeariness);
    return { ...w, warScore: computeWarScore(sicilyControl, armyBalance, w.momentum, wearinessGap) };
  });
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
 * cities, family troops, bills, or npcConsul.
 */
function recomputeComputedFlags(s: GameState): Partial<GameState> {
  return {
    activeCampaignExists: s.cities.some(p => p.activeCampaign !== null),
    familyHasTroops: s.family.some(
      c => (c.raisedLegions?.length ?? 0) > 0 || (c.veterans?.length ?? 0) > 0,
    ),
    anyCityHasRoads: s.cities.some(
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

  startGame: (startId = 'standard', mode = 'senator', difficulty = 'aequus') => {
    // Phase 5, Chunk P5-G — the guided start's tutorial numbers are authored
    // against Aequus; StartMenuScreen never routes 'guided' through the
    // difficulty picker, but this is the belt-and-braces guarantee (same
    // idiom as guided always being Brutii regardless of a stateOverrides
    // attempt — P5-E, this same function, a few lines below).
    const resolvedDifficulty: DifficultyId = startId === 'guided' ? 'aequus' : difficulty;

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

    // Phase 5, Chunk P5-E — stateOverrides was documented on StartDefinition
    // (models/gameStart.ts) but never actually applied here; this is the
    // exact extension point Duilia/Manlia need (family, resources,
    // familyReputations, ownedAssets, gens identity). Guided/standard set no
    // overrides, so they're unaffected — this is additive.
    const stateOverrides = (startDef?.stateOverrides ?? {}) as Partial<GameState>;
    const gensPlural = (stateOverrides.gensPlural as string | undefined) ?? INITIAL_STATE.gensPlural;
    const gensName   = (stateOverrides.gensName   as string | undefined) ?? INITIAL_STATE.gensName;

    // Fired once, only for an alternate family — Philon's one sanctioned
    // family-specific line (see evt-new-house-notice's own comment).
    if (stateOverrides.gensId && stateOverrides.gensId !== 'brutii') {
      pendingGameStart = [
        ...pendingGameStart,
        injectNoticeEvent(
          'evt-new-house-notice', 0,
          ((stateOverrides.family as any[])?.find(c => c.isPlayer)?.id ?? 'pc-1'),
        ),
      ];
    }

    set({
      ...INITIAL_STATE,
      ...stateOverrides,
      difficulty: resolvedDifficulty,
      gameStarted: true,
      debugMode: mode === 'debug',
      startId: startId as StartId,
      tutorialQueue,
      pendingEvents: pendingGameStart,
      lastActiveAt: Date.now(),
      log: [mkLog('264 BC · Spring', `The ${gensPlural} begin their ascent.`, 'neutral')],
      // P3-D — generated once per run, every start.
      cadetBranch: generateCadet(gensName),
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
    let ledger: SeasonLedger = {
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
      earnedLaurels: [], // patched below, after epilogue detection (P5-F)
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

    // ── Phase 5, Chunk P5-F — Laurel evaluation ──────────────────────────────
    // One call covers both of the plan's logical call sites: state predicates
    // are always checked, and outcome predicates (victoria-punica/pax-fessa/
    // roma-humilis) additionally fire when this same endSeason call just
    // wrote finalState.currentEpilogueRecord above. Nothing mechanical is
    // granted (design invariant 3) — this only feeds the ledger line and the
    // cross-run Laurels store.
    const { getCachedEarnedIds, recordEarnedAchievements } = require('./achievementStore');
    const newlyEarnedLaurels = evaluateAchievements(
      finalState,
      getCachedEarnedIds(),
      finalState.currentEpilogueRecord ?? undefined
    );
    if (newlyEarnedLaurels.length > 0) {
      ledger = { ...ledger, earnedLaurels: newlyEarnedLaurels };
      recordEarnedAchievements(newlyEarnedLaurels).catch((e: Error) =>
        console.warn('[P5-F] Laurel write failed:', e)
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

      // Campaign Map plan, Chunk C7 — a pending engagement (EngagementInterstitial's
      // full-screen Modal in the real app) needs its own driver here too, same
      // reasoning as the trial-session loop above: it isn't an EventChoice and
      // would otherwise leave this runner stuck. Resolves via the same
      // abstract-battle stub the interstitial's one button calls.
      let guardEngagements = 0;
      while (get().pendingEngagements.length > 0 && guardEngagements < 20) {
        guardEngagements++;
        get().resolveEngagementAbstract(get().pendingEngagements[0].id);
      }
      if (guardEngagements >= 20) notes.push(`season ${i + 1}: pendingEngagements didn't drain within ${guardEngagements} steps`);

      // Keep the loop's state clean for the next iteration (and for
      // whatever screen is open once the runner finishes).
      get().dismissCampaignLog();
      get().dismissSeasonOverlay();
    }

    return { seasonsCompleted, stuckReason: notes.length > 0 ? notes.join('; ') : null };
  },

  returnToStartMenu: () => set({ gameStarted: false }),

  enterEndlessMode: (personalArmyDecisions) => {
    const s = get();
    const label = turnLabel(s);
    const notes: string[] = [];
    let family = s.family;

    for (const army of s.armies) {
      if (army.owner === 'rome_state') {
        notes.push(`${army.name} stands down honorably as Rome secures Sicily.`);
        continue;
      }
      if (army.owner === 'carthage' || army.owner === 'rome_rival') {
        continue; // the war is over — no notice needed per enemy army
      }
      // owner === 'player'
      const decision = personalArmyDecisions[army.id] ?? 'retain';
      const commander = army.commanderId ? family.find(c => c.id === army.commanderId) : undefined;
      if (decision === 'retain' && commander) {
        const troops = army.units.map(armyUnitToTroop);
        family = family.map(c => (c.id === commander.id ? { ...c, veterans: [...c.veterans, ...troops] } : c));
        notes.push(`${army.name} stands down; its veterans return to ${commander.name}'s service.`);
      } else if (decision === 'retain') {
        notes.push(`${army.name} disperses — with no commander left to retain it.`);
      } else {
        notes.push(`${army.name} is disbanded.`);
      }
    }

    set({
      endlessMode: true,
      runFinished: false,
      pendingEpilogue: null,
      // Phase 5, Chunk P5-D — endlessMode is a top-level boolean, not in
      // `flags`, so it isn't reachable by the `flag` EventCondition. Mirrored
      // here (the one place Endless mode is ever entered) so evt-end-*
      // ambience events can gate on it without a new condition type.
      flags: { ...s.flags, 'endless-mode-active': true },
      // Chunk C9 — every theatre Army is gone once Endless mode begins (the
      // campaign step no-ops from here on, gated on `endlessMode` in
      // turnSequencer.ts's step 6c); controllers are left exactly as they
      // stand ("frozen as-won") since nothing will ever flip them again.
      armies: [],
      family,
      log: [...s.log, ...notes.map(text => mkLog(label, text, 'neutral'))],
    });
  },

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
      log: [...s.log, mkLog(label, `Adrogatio performed. A citizen adopted into the ${s.gensPlural}.`, 'neutral')],
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
      flags: {
        ...s.flags,
        // Phase 5, Chunk P5-D — feeds evt-aft-burn-* aftermath events;
        // cleared by that event's terminal choices (flag hygiene).
        'secret-burned-recently': true,
        // Phase 5, Chunk P5-F — the flamma Laurel's detection source. Never
        // cleared (unlike the flag above), since a transient flag racing an
        // aftermath event's resolution can't reliably signal "ever burned".
        'secret-burned-ever': true,
      },
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
          `${clanName} now regards the ${s.gensPlural} as "${crossedThreshold.label}".`]
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

  // July 2026 fixes, Chunk E — locationId 'latium' writes to the flat
  // GameState.ownedAssets; any other locationId is a CityState.id and writes
  // to that city's nested ownedAssets (and applies its one-time
  // localSupportGain, a province-only concept). Unifies what used to be
  // this action plus a separate purchaseCityAsset, now that both locations
  // share the same AssetDefinition/OwnedAsset shape.
  purchaseAsset: (locationId, definitionId) => {
    const s = get();
    const { purchaseCost, getDefinition } = require('../engine/assetEngine');

    const isLatium = locationId === 'latium';
    const city = isLatium ? null : s.cities.find(p => p.id === locationId);
    if (!isLatium && !city) return;

    const ownedAssets = isLatium ? s.ownedAssets : city!.ownedAssets;
    if (ownedAssets.some(a => a.definitionId === definitionId)) return;

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
    const logMsg = isLatium
      ? `${def.name} acquired. (${def.tiers[0].label})`
      : `${def.name} acquired in ${locationId}. (${def.tiers[0].label})`;

    set({
      denarii: s.denarii - cost,
      ...(isLatium
        ? { ownedAssets: [...s.ownedAssets, newAsset] }
        : {
            cities: s.cities.map(p =>
              p.id === locationId
                ? {
                    ...p,
                    ownedAssets: [...p.ownedAssets, newAsset],
                    localSupport: Math.min(100, p.localSupport + (def.localSupportGain ?? 0)),
                  }
                : p
            ),
          }),
      log: [...s.log, mkLog(label, logMsg, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: cost }),
    });
  },

  upgradeAsset: (locationId, definitionId) => {
    const s = get();
    const { upgradeCost, getDefinition } = require('../engine/assetEngine');

    const isLatium = locationId === 'latium';
    const city = isLatium ? null : s.cities.find(p => p.id === locationId);
    if (!isLatium && !city) return;

    const ownedAssets = isLatium ? s.ownedAssets : city!.ownedAssets;
    const owned = ownedAssets.find(a => a.definitionId === definitionId);
    if (!owned) return;
    if (owned.currentTier === 3) return;

    const def = getDefinition(definitionId);
    if (!def) return;

    const cost = upgradeCost(owned);
    if (cost === null || s.denarii < cost) return;

    const newTier = (owned.currentTier + 1) as 2 | 3;
    const tierLabel = def.tiers[newTier - 1].label;
    const label = turnLabel(s);
    const logMsg = isLatium
      ? `${def.name} upgraded to ${tierLabel}.`
      : `${def.name} upgraded to ${tierLabel} in ${locationId}.`;

    set({
      denarii: s.denarii - cost,
      ...(isLatium
        ? {
            ownedAssets: s.ownedAssets.map(a =>
              a.definitionId === definitionId ? { ...a, currentTier: newTier } : a
            ),
          }
        : {
            cities: s.cities.map(p =>
              p.id === locationId
                ? {
                    ...p,
                    ownedAssets: p.ownedAssets.map(a =>
                      a.definitionId === definitionId ? { ...a, currentTier: newTier } : a
                    ),
                  }
                : p
            ),
          }),
      log: [...s.log, mkLog(label, logMsg, 'good')],
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
      log: [...s.log, mkLog(label, `${name} is born into the ${s.gensPlural}.`, 'good')],
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
    // Campaign Map plan, Chunk C1 — the `provinces` field was renamed to
    // `cities`. A save written before this rename has a `provinces` key and
    // no `cities` key at all, so the top-level `...savedState` spread above
    // leaves `cities` at its INITIAL_STATE default (losing every city's
    // relationship/governor/asset progress) unless backfilled here from the
    // old key — same per-field migration pattern as every other backfill in
    // this function.
    // July 2026 fixes, Chunk E — each city's ownedAssets also gets a
    // per-element migration here: CityAssetOwned.tier (1|2) was renamed to
    // OwnedAsset.currentTier (1|2|3) when province assets were unified onto
    // Latium's richer shape. A pre-Chunk-E save's city assets still carry
    // the old `tier` field only — backfilled so a save's tier-2 asset reads
    // as "at its current max, upgrade to 3 available" (per the plan), not
    // silently invisible to calcCityAssetBonuses/HoldingsPanel.
    cities: (savedState.cities ?? (savedState as any).provinces ?? INITIAL_STATE.cities).map((c: any) => ({
      ...c,
      ownedAssets: (c.ownedAssets ?? []).map((a: any) => ({
        ...a,
        currentTier: a.currentTier ?? a.tier ?? 1,
      })),
    })),
    // Campaign Map plan, Chunk C3 — a save written during C1/C2 has a real
    // `theatre` object (controllers/contested) but no `musteredThisYear` key
    // at all; the top-level spread above only backfills a WHOLLY missing
    // field, not a missing key inside one that's already present, so it's
    // backfilled per-field here (same pattern as `wars` above).
    theatre: {
      ...savedState.theatre,
      musteredThisYear: savedState.theatre?.musteredThisYear ?? buildInitialTheatreState().musteredThisYear,
    },
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
    cadetBranch: savedState.cadetBranch ?? generateCadet((savedState as any).gensName ?? 'Brutia'),
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

  updateCityPolicy: (cityId, policy) => {
    set((s) => ({
      cities: s.cities.map(p =>
        p.id === cityId && p.playerGovernor
          ? { ...p, playerGovernor: { ...p.playerGovernor, policy } }
          : p
      ),
      ...bumpActions(s),
    }));
  },

  proposeIncorporationBill: (provinceId) => {
    const s = get();
    const city = s.cities.find(p => p.id === provinceId);
    if (!city || !city.incorporationBillAvailable) return;
    const def = getCityDefinition(provinceId);
    if (!def) return;
    const bill = buildIncorporationBill(city, def);
    if (s.bills.some(b => b.name === bill.name)) return;
    get().submitBill(bill);
  },

  proposeDeclareWarBill: (provinceId) => {
    const s = get();
    const city = s.cities.find(p => p.id === provinceId);
    if (!city || city.status !== 'foreign') return;
    const def = getCityDefinition(provinceId);
    if (!def || def.clientOf) return;
    if (getRelationshipTier(city.relationshipScore) !== 'hostile') return;
    const enemyId = getForeignWarTargetEnemyId(def);
    if (s.wars.some(w => w.active && w.enemyId === enemyId)) return;
    const bill = buildDeclareWarBill(city, def);
    if (s.bills.some(b => b.name === bill.name)) return;
    get().submitBill(bill);
  },

  seekAmbassadorPosting: (provinceId) => {
    const s = get();
    const city = s.cities.find(p => p.id === provinceId);
    if (!city || city.playerAmbassador) return;
    if (city.status !== 'unincorporated' && city.status !== 'foreign') return;
    const def = getCityDefinition(provinceId);
    if (!def) return;
    const character = s.family.find(c => c.id === s.selectedCharacterId) ?? s.family.find(c => c.isPlayer);
    if (!character) return;
    const bill = buildAmbassadorPostingBill(city, def, character.id, character.name);
    if (s.bills.some(b => b.name === bill.name)) return;
    get().submitBill(bill);
  },

  resolveAmbassadorAction: (provinceId, actionId) => {
    const s = get();
    const city = s.cities.find(p => p.id === provinceId);
    if (!city || !city.playerAmbassador) return;

    if (city.playerAmbassador.actionsUsedThisTurn.includes(actionId)) return;

    const result = engineResolveAmbassadorAction(actionId, city, 0);
    if (!result.success) return;

    const label = turnLabel(s);
    const rp = result.resourcePatch;

    // July 2026 fixes, Chunk D — cultural_exchange's guaranteed city-event
    // fire, on top of (not instead of) the passive per-season roll: it's a
    // deliberate, paid action, so it should never buy nothing. Only fires if
    // no city event is already active (mirrors rollCityEventTick's own guard).
    const queuedEvent = actionId === 'cultural_exchange' && !s.activeCityEvent
      ? getEventsForContext('ambassador', provinceId)
      : [];
    const newActiveCityEvent = queuedEvent.length > 0
      ? { defId: queuedEvent[Math.floor(Math.random() * queuedEvent.length)].id, cityId: provinceId }
      : s.activeCityEvent;

    // July 2026 fixes, Chunk D — corrupt_dealing's resourcePatch.corruption
    // was silently dropped here (only fides/denarii were ever applied),
    // so "at a cost to Rome's standing" never actually cost anything. Applies
    // to the posted ambassador's own corruptionScore, clamped 0-100 same as
    // every other corruptionScore mutation in this codebase.
    const ambassadorCharacterId = city.playerAmbassador!.characterId;

    set({
      ...(rp.fides   !== undefined ? { fides:   Math.max(0, s.fides   + rp.fides)   } : {}),
      ...(rp.denarii !== undefined ? { denarii: Math.max(0, s.denarii + rp.denarii) } : {}),
      family: rp.corruption !== undefined
        ? s.family.map(c =>
            c.id === ambassadorCharacterId
              ? { ...c, corruptionScore: Math.max(0, Math.min(100, c.corruptionScore + rp.corruption!)) }
              : c
          )
        : s.family,
      cities: s.cities.map(p =>
        p.id === provinceId
          ? {
              ...p,
              ...result.cityPatch,
              playerAmbassador: p.playerAmbassador
                ? {
                    ...p.playerAmbassador,
                    ...result.cityPatch.playerAmbassador,
                    actionsUsedThisTurn: [
                      ...p.playerAmbassador.actionsUsedThisTurn,
                      actionId,
                    ],
                  }
                : null,
            }
          : p
      ),
      activeCityEvent: newActiveCityEvent,
      log: [...s.log, mkLog(label, result.logMessage, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, {
        fides:   rp.fides   !== undefined && rp.fides   < 0 ? -rp.fides   : undefined,
        denarii: rp.denarii !== undefined && rp.denarii < 0 ? -rp.denarii : undefined,
      }),
    });
  },

  // July 2026 fixes, Chunk D — resolves state.activeCityEvent (fired by
  // cityEngine.rollCityEventTick's passive season tick, or cultural_exchange's
  // guaranteed fire above). Mirrors resolveEvent's shape but scoped to a
  // specific city and its own CityEventOption effect grammar — doesn't count
  // against the season action budget (bumpActions/bumpSpend), same as
  // resolveEvent itself: responding to an event that already fired isn't a
  // new player-initiated action.
  resolveCityEventChoice: (optionId) => {
    const s = get();
    if (!s.activeCityEvent) return;

    const def = getCityEventDef(s.activeCityEvent.defId);
    const city = s.cities.find(p => p.id === s.activeCityEvent!.cityId);
    if (!def || !city) {
      set({ activeCityEvent: null });
      return;
    }

    const option = def.options.find(o => o.id === optionId);
    if (!option) {
      set({ activeCityEvent: null });
      return;
    }

    const actingCharacterId = def.triggerCondition === 'governor'
      ? city.playerGovernor?.characterId
      : city.playerAmbassador?.characterId;
    const actingCharacter = s.family.find(c => c.id === actingCharacterId);

    let costDenarii = 0, costFides = 0, costImperium = 0;
    if (option.cost) {
      if (option.cost.resource === 'denarii') costDenarii = option.cost.amount;
      else if (option.cost.resource === 'fides') costFides = option.cost.amount;
      else if (option.cost.resource === 'imperium') costImperium = option.cost.amount;
    }

    let succeeded = true;
    if (option.skillCheck) {
      const baseSkill = (actingCharacter?.skills as any)?.[option.skillCheck.skill] ?? 0;
      const skillVal = getEffectiveSkill(baseSkill, option.skillCheck.skill as any, s);
      succeeded = skillVal >= option.skillCheck.difficulty;
    }

    const effectStr = (succeeded ? option.successEffect : option.failureEffect) ?? '';
    const resultText = (succeeded ? option.successText : option.failureText) ?? option.successText;

    const { cityPatch, corruptionDelta, resourcePatch } = resolveCityEventEffect(effectStr, city);
    const label = turnLabel(s);

    set({
      fides:   Math.max(0, s.fides   - costFides   + (resourcePatch.fides   ?? 0)),
      denarii: Math.max(0, s.denarii - costDenarii + (resourcePatch.denarii ?? 0)),
      imperium: s.imperium - costImperium + (resourcePatch.imperium ?? 0),
      lifetimeDignitas: s.lifetimeDignitas + (resourcePatch.lifetimeDignitas ?? 0),
      family: (corruptionDelta !== 0 && actingCharacter)
        ? s.family.map(c =>
            c.id === actingCharacter.id
              ? { ...c, corruptionScore: Math.max(0, Math.min(100, c.corruptionScore + corruptionDelta)) }
              : c
          )
        : s.family,
      cities: s.cities.map(p => (p.id === city.id ? { ...p, ...cityPatch } : p)),
      activeCityEvent: null,
      log: [...s.log, mkLog(label, resultText, 'neutral')],
    });
  },

  dismissCityEvent: () => set({ activeCityEvent: null }),


  recruitCityClient: (cityId, clientId) => {
    const s = get();
    const city = s.cities.find(p => p.id === cityId);
    if (!city) return;

    const clientDef = getCityClientDef(clientId);
    if (!clientDef) return;

    if (city.localSupport < clientDef.supportRequired) return;
    if (city.relationshipScore < clientDef.relationshipRequired) return;

    if (s.clients.some(c => (c as any).provincialClientDefId === clientId)) return;

    if (s.fides < 20) return;

    const { getClientSlotCap } = require('../engine/houseEngine');
    if (s.clients.length >= getClientSlotCap(s.house)) return;

    const label = turnLabel(s);
    // July 2026 fixes, Chunk D — resourceBonus/skillBonus used to be
    // descriptive-only (bonus: {} below, always empty): computeTotalClientBonuses
    // reads exactly these ClientBonus keys (gold/fides feed resourceEngine's
    // season income calc; rhetoricalBonus/martialBonus/intrigusBonus now feed
    // eventEngine.getEffectiveSkill's skill checks), so populating it here
    // makes every provincial client's stated bonus real. auctoritas has no
    // skill-check consumer anywhere in the engine (SkillCheck only ever
    // checks rhetoric/martial/intrigus) — left out, same as it's always been.
    const bonus: Record<string, number> = {};
    if (clientDef.resourceBonus?.goldPerTurn)   bonus.gold  = clientDef.resourceBonus.goldPerTurn;
    if (clientDef.resourceBonus?.gratiaPerTurn) bonus.fides = (bonus.fides ?? 0) + clientDef.resourceBonus.gratiaPerTurn;
    if (clientDef.skillBonus?.rhetoric)  bonus.rhetoricalBonus = clientDef.skillBonus.rhetoric;
    if (clientDef.skillBonus?.martial)   bonus.martialBonus    = clientDef.skillBonus.martial;
    if (clientDef.skillBonus?.intrigus)  bonus.intrigusBonus   = clientDef.skillBonus.intrigus;

    const newClient = {
      id: `provincial-${clientId}-${Date.now()}`,
      name: clientDef.name,
      type: 'provincial' as any,
      flavourTitle: 'Provincial Client',
      flavourText: clientDef.bonusDescription,
      bonus,
      acquiredTurn: s.turnNumber,
      isProvincialClient: true,
      provincialClientDefId: clientId,
    };

    set({
      clients: [...s.clients, newClient as any],
      fides: s.fides - 20,
      log: [...s.log, mkLog(label, `${clientDef.name} joins the ${s.gensPlural} as a provincial client.`, 'good')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: 20 }),
    });
  },

  updateCities: (cities) => set({ cities }),

  // ── Campaign Map plan, Chunk C2 — armies ──────────────────────────────────

  spawnArmy: (army) => {
    set(s => ({ armies: [...s.armies, army] }));
  },

  combineArmies: (armyIdA, armyIdB) => {
    const s = get();
    const a = s.armies.find(ar => ar.id === armyIdA);
    const b = s.armies.find(ar => ar.id === armyIdB);
    if (!a || !b) return;

    const martialOf = (commanderId: string | null) =>
      commanderId ? (s.family.find(c => c.id === commanderId)?.skills.martial ?? 0) : 0;

    const merged = engineCombineArmies(a, b, martialOf(a.commanderId), martialOf(b.commanderId), `army-${Date.now()}`);
    if (!merged) return;

    const label = turnLabel(s);
    set({
      armies: [...s.armies.filter(ar => ar.id !== armyIdA && ar.id !== armyIdB), merged],
      log: [...s.log, mkLog(label, `${a.name} and ${b.name} combine into ${merged.name}.`, 'neutral')],
    });
  },

  divideArmy: (armyId, unitIds, newCommanderId = null) => {
    const s = get();
    const army = s.armies.find(ar => ar.id === armyId);
    if (!army) return;

    const result = engineDivideArmy(army, unitIds, `army-${Date.now()}`, newCommanderId);
    if (!result) return;
    const [remaining, split] = result;

    const label = turnLabel(s);
    set({
      armies: [...s.armies.filter(ar => ar.id !== armyId), remaining, split],
      log: [...s.log, mkLog(label, `${army.name} divides — ${split.units.length} unit(s) form ${split.name}.`, 'neutral')],
    });
  },

  assignArmyCommander: (armyId, characterId) => {
    const s = get();
    if (characterId && !s.family.some(c => c.id === characterId)) return; // must be alive (i.e. in family)
    set({
      armies: s.armies.map(ar => ar.id === armyId ? { ...ar, commanderId: characterId } : ar),
    });
  },

  setArmyStance: (armyId, stance) => {
    set(s => ({
      armies: s.armies.map(ar => ar.id === armyId ? { ...ar, stance } : ar),
    }));
  },

  // ── Campaign Map plan, Chunk C3 — Muster ─────────────────────────────────
  raiseTroops: (regionId, tier, targetArmyId) => {
    const s = get();
    const region = getRegion(regionId);
    if (!region) return;

    const paterfamilias = s.family.find(c => c.isPlayer);
    const playerHoldsOffice = !!paterfamilias?.officeId;
    const playerHoldsCommand = s.activeCommand?.holderOwner === 'player';

    const quote = quoteMuster(regionId, tier, s.theatre, s.cities, s.armies, s.imperium, playerHoldsOffice, playerHoldsCommand);
    if (!quote.eligible || !quote.imperiumOk) return;

    // Chunk C4 — a sanctioning command's war chest pays first, personal
    // denarii cover the rest (per the plan's own C3 forward-reference).
    const warChestSpend = playerHoldsCommand && s.activeCommand
      ? Math.min(s.activeCommand.warChest, quote.costDenarii)
      : 0;
    const denariiSpend = quote.costDenarii - warChestSpend;
    if (s.denarii < denariiSpend) return;

    let targetArmy: Army | null = null;
    if (targetArmyId) {
      const found = s.armies.find(a => a.id === targetArmyId);
      if (found && found.owner === 'player' && found.location === regionId) targetArmy = found;
    }

    const relationship = getRegionRelationship(s.cities, regionId);
    const unitId = `army-unit-${s.turnNumber}-${Date.now()}`;
    const newUnit = rollMusteredUnit(tier, regionId, relationship, s.turnNumber, unitId);

    let armies: Army[];
    let armyLabel: string;
    let resultArmyId: string;
    if (targetArmy) {
      const merged: Army = { ...targetArmy, units: [...targetArmy.units, newUnit] };
      armies = s.armies.map(a => a.id === targetArmy!.id ? merged : a);
      armyLabel = merged.name;
      resultArmyId = merged.id;
    } else {
      const newArmy: Army = {
        id: `army-${s.turnNumber}-${Date.now()}`,
        name: nextLegionName(s.armies, region.displayNameLatin),
        owner: 'player',
        commanderId: null,
        location: regionId,
        stationedCityId: region.cityIds[0] ?? null,
        units: [newUnit],
        stance: 'avoid_battle',
        ordersThisSeason: null,
        fatigued: false,
        unpaidSeasons: 0,
      };
      armies = [...s.armies, newArmy];
      armyLabel = newArmy.name;
      resultArmyId = newArmy.id;
    }

    const theatre: TheatreState = {
      ...s.theatre,
      musteredThisYear: {
        ...s.theatre.musteredThisYear,
        [regionId]: (s.theatre.musteredThisYear[regionId] ?? 0) + 1,
      },
    };

    // Unsanctioned — feed the same Senate-response tracker raiseLevy drives
    // for personal levies (see senateResponseEngine.ts's Chunk C3
    // sourceArmyId branch). A response already in progress isn't restarted.
    let senateResponse = s.senateResponse;
    if (!quote.sanctioned && !senateResponse?.active) {
      senateResponse = {
        active: true,
        seasonDetected: s.turnNumber,
        phase: null,
        musterProvinceId: region.cityIds[0] ?? null,
        consularArmyStrength: calcConsularArmyStrength(s.crisisLevel, paterfamilias?.militaryImperium ?? 0),
        debateSuppressed: false,
        consularArmyArrivesOnTurn: calcConsularArmyArrivalTurn(s.turnNumber, regionId),
        sourceArmyId: resultArmyId,
      };
    }

    const label = turnLabel(s);
    const costNote = warChestSpend > 0
      ? ` (−${warChestSpend} from the war chest${denariiSpend > 0 ? `, −${denariiSpend} Denarii` : ''})`
      : ` (−${denariiSpend} Denarii)`;
    set({
      denarii: s.denarii - denariiSpend,
      activeCommand: warChestSpend > 0 && s.activeCommand
        ? { ...s.activeCommand, warChest: s.activeCommand.warChest - warChestSpend }
        : s.activeCommand,
      armies,
      theatre,
      senateResponse,
      log: [...s.log, mkLog(label, `${armyLabel} musters a cohort in ${region.name}.${costNote}`, 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { denarii: denariiSpend }),
    });
  },

  // ── Campaign Map plan, Chunk C4 — The Command ────────────────────────────

  callCommandVote: (candidateCharacterId) => {
    const s = get();
    if (s.commandElection?.active) return;
    if (s.activeCommand) return;
    if (!isWarActiveForCommand(s.wars ?? [])) return;
    const cost = BALANCE.campaign.command.callVoteFidesCost;
    if (s.fides < cost) return;

    let resolvedCandidateId: string | null = null;
    if (candidateCharacterId) {
      const character = s.family.find(c => c.id === candidateCharacterId);
      if (character && isEligibleForCommand(character)) resolvedCandidateId = character.id;
    }

    const election: CommandElectionState = {
      active: true,
      calledSeason: s.turnNumber,
      isProrogation: false,
      incumbentWinLossModifier: 0,
      incumbentIsPlayerCandidate: false,
      incumbentRivalId: null,
      candidateCharacterId: resolvedCandidateId,
      rivals: generateCommandRivals(s.clans),
      votes: {},
    };

    const label = turnLabel(s);
    set({
      fides: s.fides - cost,
      commandElection: election,
      log: [...s.log, mkLog(label, 'An extraordinary assembly is called to elect a theatre command.', 'neutral')],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: cost }),
    });
  },

  declareCommandCandidate: (characterId) => {
    const s = get();
    const election = s.commandElection;
    if (!election?.active || election.candidateCharacterId) return;
    const character = s.family.find(c => c.id === characterId);
    if (!character || !isEligibleForCommand(character)) return;

    const label = turnLabel(s);
    set({
      commandElection: { ...election, candidateCharacterId: character.id },
      log: [...s.log, mkLog(label, `${character.name} stands for the command.`, 'neutral')],
      ...bumpActions(s),
    });
  },

  canvassForCommand: (leaderId) => {
    const s = get();
    const election = s.commandElection;
    if (!election?.active) return;
    const cost = commandCanvassFidesCost();
    if (s.fides < cost) return;
    if (election.votes[leaderId] === 'for') return;

    let foundLeader: (typeof s.clans[0]['leaders'][0]) | null = null;
    let foundClanId: string | null = null;
    for (const clan of s.clans) {
      const l = clan.leaders.find(l => l.id === leaderId);
      if (l) { foundLeader = l; foundClanId = clan.id; break; }
    }
    if (!foundLeader || !foundClanId) return;
    if (foundLeader.relationship < COMMAND_CANVASS_MIN_RELATIONSHIP) return;

    const clanHasRival = election.rivals.some(r => r.clanId === foundClanId);
    const threshold = commandCanvassThreshold() * (clanHasRival ? 2 : 1);

    const playerChar = s.family.find(c => c.isPlayer);
    const rhetoric = playerChar?.skills.rhetoric ?? 0;
    const roll = rollCommandCanvass(rhetoric, foundLeader.relationship);
    const success = roll >= threshold;
    const label = turnLabel(s);

    set({
      fides: s.fides - cost,
      commandElection: {
        ...election,
        votes: success ? { ...election.votes, [leaderId]: 'for' as const } : election.votes,
      },
      log: [...s.log, mkLog(
        label,
        success
          ? `${foundLeader.name} pledges support for the command.`
          : `${foundLeader.name} was not persuaded.${clanHasRival ? ' Their gens backs a rival candidate.' : ''}`,
        success ? 'good' : 'neutral',
      )],
      ...bumpActions(s),
      ...bumpSpend(s, { fides: cost }),
    });
  },

  // ── Campaign Map plan, Chunk C5 — Movement ───────────────────────────────

  issueMovementOrder: (armyId, destinationRegionId, forcedMarch) => {
    const s = get();
    const army = s.armies.find(a => a.id === armyId);
    if (!army || (army.owner !== 'player' && army.owner !== 'rome_state')) return;

    const order = buildMovementOrder(army, s.armies, s.theatre, s.seasonIndex, destinationRegionId, forcedMarch);
    if (!order) return;

    const label = turnLabel(s);
    const verb = order.intent === 'attack' ? 'marches to attack' : 'marches for';
    set({
      armies: s.armies.map(a => a.id === armyId ? { ...a, ordersThisSeason: order } : a),
      log: [...s.log, mkLog(label, `${army.name} ${verb} ${destinationRegionId}.${forcedMarch ? ' (forced march)' : ''}`, 'neutral')],
    });
  },

  clearOrder: (armyId) => {
    set(s => ({
      armies: s.armies.map(a => a.id === armyId ? { ...a, ordersThisSeason: null } : a),
    }));
  },

  // ── Campaign Map plan, Chunk C7/C8 — Turn-end resolution & the battle bridge ─

  dismissCampaignLog: () => set({ campaignLog: null }),

  resolveEngagementAbstract: (engagementId) => {
    const s = get();
    const engagement = s.pendingEngagements.find(e => e.id === engagementId);
    if (!engagement) return;

    const result = resolveEngagement(engagement, s.armies, s.theatre, s.family, s.clans);
    const label = turnLabel(s);
    const playerId = s.family.find(c => c.isPlayer)?.id ?? '';

    let { family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue } = s;
    const fateNotes: string[] = [];
    for (const roll of result.commanderFateRolls) {
      const fate = applyCommanderFate(
        roll.characterId, roll.result,
        { family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue },
        { turnNumber: s.turnNumber, playerCharacterId: playerId, gensName: s.gensName },
      );
      family = fate.slice.family;
      flags = fate.slice.flags;
      pendingEvents = fate.slice.pendingEvents;
      pendingSuccession = fate.slice.pendingSuccession;
      cadetBranch = fate.slice.cadetBranch;
      pendingEpilogue = fate.slice.pendingEpilogue;
      fateNotes.push(...fate.ledgerNotes);
    }

    // Chunk C9 — this engagement may have resolved LATER than the season it
    // was created in (the interstitial waited on the player), so the season's
    // one-shot momentum/warScore pass (campaignResolver step 8) already ran
    // without it. Feed this battle's result in now, at the moment it actually
    // resolves.
    let wars = s.wars;
    const battleEntry = result.logEntries.find(
      (e): e is Extract<CampaignLogEntry, { type: 'battle' }> => e.type === 'battle',
    );
    if (battleEntry) {
      const attackerArmy = s.armies.find(a => a.id === engagement.attackerArmyId);
      const defenderArmy = s.armies.find(a => a.id === engagement.defenderArmyId);
      const winnerArmy = battleEntry.winnerArmyId === attackerArmy?.id ? attackerArmy : defenderArmy;
      if (winnerArmy) {
        wars = applyDeferredBattleToWarStanding(
          s.wars, result.armies, s.cities, armyPowerOf(winnerArmy.owner), battleEntry.tier,
        );
      }
    }

    set({
      armies: result.armies,
      family, flags, pendingEvents, pendingSuccession, cadetBranch, pendingEpilogue,
      pendingEngagements: s.pendingEngagements.filter(e => e.id !== engagementId),
      log: [...s.log, ...[...result.logEntries.map(e => e.text), ...fateNotes].map(text => mkLog(label, text, 'neutral'))],
      wars,
    });
  },

  takeTheFieldForEngagement: (engagementId) => {
    const s = get();
    const engagement = s.pendingEngagements.find(e => e.id === engagementId);
    if (!engagement) return;
    const player = s.family.find(c => c.isPlayer);
    if (!player) return;

    const attackerArmy = s.armies.find(a => a.id === engagement.attackerArmyId);
    const defenderArmy = s.armies.find(a => a.id === engagement.defenderArmyId);
    if (!attackerArmy || !defenderArmy) return;
    // Every pendingEngagements entry is rome(player/rome_state) vs. carthage —
    // C7's own gate never lets a rome_rival-vs-carthage (NPC-vs-NPC) fight
    // reach this list. See campaignResolver.ts's header comment.
    const romeIsAttacker = attackerArmy.owner !== 'carthage';
    let romeArmy = romeIsAttacker ? attackerArmy : defenderArmy;
    const enemyArmy = romeIsAttacker ? defenderArmy : attackerArmy;

    // A leaderless Rome-side army has no one to draw a stratagem hand or
    // roster martial for — auto-assign the paterfamilias (permanently; this
    // mirrors "you sent someone, they now lead" rather than a one-battle
    // stand-in). "Trust the Legate" has no such fallback since there's no
    // legate to trust — see EngagementInterstitial.tsx's own gating.
    if (!romeArmy.commanderId) {
      romeArmy = { ...romeArmy, commanderId: player.id };
    }

    const region = REGIONS.find(r => r.id === engagement.regionId);
    const terrain = BALANCE.battle.terrains[region?.terrainId ?? 'open_plain'] ?? BALANCE.battle.terrains.open_plain;
    const seed = Math.floor(Math.random() * 1e9);

    // battleEngine.ts has no native fatigue concept (verified — grep turned
    // up nothing) — a fatigued Army (C5's forced march) applies its penalty
    // here, pre-deployment, as a flat strength scale-down, reusing the SAME
    // constant the abstract path multiplies POWER by (BALANCE.campaign.abstract
    // .fatiguePenaltyMult) for consistency between the two paths, even
    // though the mechanism differs (there's no single shared "power" number
    // in a real tactical battle to scale instead).
    const romeUnits = romeArmy.units.map(u => {
      const battleUnit = armyUnitToBattleUnit(u);
      return romeArmy.fatigued
        ? { ...battleUnit, strength: Math.round(battleUnit.strength * BALANCE.campaign.abstract.fatiguePenaltyMult) }
        : battleUnit;
    });
    const captains = getEligibleFamilyCaptains(s.family, romeArmy.commanderId!, s.flags);
    const romeRoster: Record<string, number> = {};
    const romeCommanderCharacter = s.family.find(c => c.id === romeArmy.commanderId);
    if (romeCommanderCharacter) romeRoster[romeCommanderCharacter.id] = romeCommanderCharacter.skills.martial;
    for (const c of captains) romeRoster[c.characterId] = c.martial;
    const romeHand = drawStratagemHand(romeCommanderCharacter?.skills.martial ?? 0, romeUnits, terrain, makeSeededRng(seed ^ 0x51ed270b));

    const generalProfile = profileForCarthageArmy(enemyArmy);
    const enemyUnits = enemyArmy.units.map(armyUnitToBattleUnit);
    const enemyHand = drawStratagemHand(generalProfile.martial, enemyUnits, terrain, makeSeededRng(seed ^ 0x2545f491));
    const aiDeployment = chooseDeployment(generalProfile, enemyUnits, terrain, enemyHand, makeSeededRng(seed ^ 0x9e3779b9));

    const attackerInput: DeploySideInput = {
      label: romeArmy.name,
      deployment: buildDefaultDeployment(romeUnits),
      commanderId: romeArmy.commanderId,
      roster: { martialById: romeRoster },
      stratagemHand: romeHand,
    };
    const defenderInput: DeploySideInput = {
      label: `Carthage (${generalProfile.name} ${generalProfile.epithet})`,
      deployment: aiDeployment.deployment,
      commanderId: aiDeployment.commanderId,
      roster: aiDeployment.roster,
      generalProfileId: generalProfile.id,
      stratagemHand: enemyHand,
    };

    const bridgeCtx: CampaignBattleBridgeContext = {
      engagementId,
      regionId: engagement.regionId,
      romeArmyId: romeArmy.id,
      enemyArmyId: enemyArmy.id,
      romeIsCampaignAttacker: romeIsAttacker,
      enemyFieldedElephants: enemyArmy.units.some(u => u.unitClass === 'elephant'),
      turnNumber: s.turnNumber,
    };

    set({
      armies: s.armies.map(a => a.id === romeArmy.id ? romeArmy : a),
      activeBattleSetup: { attackerInput, defenderInput, terrain, seed, bridgeCtx },
    });
  },

  /** Chunk C8's tactical write-back, called from returnFromBattle when
   *  activeBattleBridgeCtx is a CampaignBattleBridgeContext. Runs
   *  engine/battle/armyBattleBridge.applyArmyBattleOutcome for BOTH sides
   *  (the enemy call's family/flags/etc mutations are discarded — Carthage
   *  generals are never state.family Characters, so applyCommanderFate
   *  no-ops for them; only its returned `.army` matters), then the SAME
   *  campaignResolver.applyPostBattleContinuation the abstract path uses for
   *  retreat/shatter/occupy — "one pathway for tactical and abstract
   *  results," per the plan's own C8 instruction. */
  resolveCampaignBattleOutcome: (battleState, outcome, ctx) => {
    const s = get();
    const romeArmy = s.armies.find(a => a.id === ctx.romeArmyId);
    if (!romeArmy) return;
    const enemyArmy = s.armies.find(a => a.id === ctx.enemyArmyId) ?? null;
    const playerId = s.family.find(c => c.isPlayer)?.id ?? '';

    const romeResult = applyArmyBattleOutcome({
      army: romeArmy, battleState, romeSide: 'attacker', outcome,
      turnNumber: ctx.turnNumber, playerCharacterId: playerId, gensName: s.gensName,
      enemyFieldedElephants: ctx.enemyFieldedElephants, activeCommand: s.activeCommand,
      family: s.family, flags: s.flags, pendingEvents: s.pendingEvents,
      pendingSuccession: s.pendingSuccession, cadetBranch: s.cadetBranch, pendingEpilogue: s.pendingEpilogue,
    });

    const enemyResult = enemyArmy ? applyArmyBattleOutcome({
      army: enemyArmy, battleState, romeSide: 'defender', outcome,
      turnNumber: ctx.turnNumber, playerCharacterId: playerId, gensName: s.gensName,
      enemyFieldedElephants: false, activeCommand: null,
      family: s.family, flags: s.flags, pendingEvents: s.pendingEvents,
      pendingSuccession: s.pendingSuccession, cadetBranch: s.cadetBranch, pendingEpilogue: s.pendingEpilogue,
    }) : null;

    const romeWon = outcome.victor === 'attacker';
    const winnerIsCampaignAttacker = ctx.romeIsCampaignAttacker ? romeWon : !romeWon;
    const winnerArmy = romeWon ? romeResult.army : enemyResult?.army ?? null;
    const loserArmy = romeWon ? enemyResult?.army ?? null : romeResult.army;
    const loserArmyMeta = romeWon
      ? { id: enemyArmy?.id ?? ctx.enemyArmyId, name: enemyArmy?.name ?? 'The enemy army', owner: enemyArmy?.owner ?? 'carthage' as const }
      : { id: romeArmy.id, name: romeArmy.name, owner: romeArmy.owner };
    // Flavor-only (the shatter log line): whichever side LOST this battle,
    // did battleEngine's own captainOutcomes mark its commander captured?
    // Only meaningful to the player when the loser is Rome (a Carthage
    // general's "capture" has no mechanical effect — see applyCommanderFate's
    // "not a Character, skip" precedent) but harmless to compute either way.
    const loserCommanderId = romeWon ? enemyArmy?.commanderId ?? null : romeArmy.commanderId;
    const commanderCaptured = !!loserCommanderId
      && outcome.captainOutcomes.some(c => c.characterId === loserCommanderId && c.result === 'captured');

    const armiesAfterBattle = s.armies
      .map(a => {
        if (a.id === romeArmy.id) return romeResult.army;
        if (enemyArmy && a.id === enemyArmy.id) return enemyResult?.army ?? null;
        return a;
      })
      .filter((a): a is Army => a !== null);

    const continuation = applyPostBattleContinuation(
      {
        regionId: ctx.regionId,
        attackerArmyId: ctx.romeIsCampaignAttacker ? ctx.romeArmyId : ctx.enemyArmyId,
        defenderArmyId: ctx.romeIsCampaignAttacker ? ctx.enemyArmyId : ctx.romeArmyId,
      },
      armiesAfterBattle, s.theatre, winnerIsCampaignAttacker, winnerArmy, loserArmy, loserArmyMeta, commanderCaptured,
    );

    const label = turnLabel(s);
    let triumphBills = s.bills;
    let triumphNotes: string[] = [];
    if (romeResult.crushingWinByCommandHolder && romeArmy.commanderId) {
      const commander = romeResult.family.find(c => c.id === romeArmy.commanderId);
      const alreadyQueued = s.bills.some(b => b.id.startsWith(`triumph-${romeArmy.commanderId}`))
        || (s.passedBills ?? []).some(b => b.id.startsWith(`triumph-${romeArmy.commanderId}`));
      if (commander && !alreadyQueued && (s.lifetimeImperium ?? 0) >= 50) {
        triumphBills = [...s.bills, buildTriumphBill(commander, s)];
        triumphNotes = [`⚔ ${commander.name} is eligible for a Triumph. A petition has been tabled in the Senate.`];
      }
    }

    // Chunk C9 — this tactical battle may resolve LATER than the season it
    // was created in, after campaignResolver step 8's once-per-season
    // momentum/warScore pass already ran. Feed the result in now. romeSide is
    // always 'attacker' per C8's design (see applyArmyBattleOutcome calls
    // above), so victor === 'attacker' means Rome won regardless of which
    // side was the campaign-layer attacker.
    const winnerPower = romeWon ? 'rome' : 'carthage';
    const wars = applyDeferredBattleToWarStanding(s.wars, continuation.armies, s.cities, winnerPower, outcome.tier);

    set({
      armies: continuation.armies,
      family: romeResult.family, flags: romeResult.flags, pendingEvents: romeResult.pendingEvents,
      pendingSuccession: romeResult.pendingSuccession, cadetBranch: romeResult.cadetBranch, pendingEpilogue: romeResult.pendingEpilogue,
      activeCommand: romeResult.activeCommand,
      bills: triumphBills,
      pendingEngagements: s.pendingEngagements.filter(e => e.id !== ctx.engagementId),
      log: [...s.log, ...[...romeResult.ledgerNotes, ...continuation.logEntries.map(e => e.text), ...triumphNotes].map(text => mkLog(label, text, 'neutral'))],
      wars,
    });
  },

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
        musterProvinceId: s.cities[0]?.id ?? 'sicilia',
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
      // Campaign Map plan, Chunk C8 — a CampaignBattleBridgeContext is
      // distinguished structurally (its own `engagementId` field, which
      // BattleBridgeContext never has) rather than a nominal tag.
      if ('engagementId' in s.activeBattleBridgeCtx) {
        get().resolveCampaignBattleOutcome(battle, battle.outcome, s.activeBattleBridgeCtx);
      } else {
        get().resolveBattleOutcome(battle, 'attacker', battle.outcome, s.activeBattleBridgeCtx);
      }
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
      weariness: 0,
      enemyWeariness: 0,
      momentum: 0,
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
      wars: s.wars.map(w => (w.id === warId ? { ...w, active: false, phase: 'ended' as const, endedYear: s.year } : w)),
    }));
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
        ? { ...w, active: false, treaty: { ...w.treaty!, ratified: true, resolvedTurn: s.turnNumber } }
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
      cities: s.cities.map(p =>
        p.id === provinceId
          ? { ...p, localSupport: Math.min(100, Math.max(0, p.localSupport + delta)) }
          : p
      ),
    }));
  },

  startCampaign: (provinceId, type) => {
    const s = get();
    const city = s.cities.find(p => p.id === provinceId);
    if (!city || city.activeCampaign) return;

    // Commander: player family member who is currently governor, otherwise NPC (null)
    const governorCharId = city.playerGovernor?.characterId ?? null;
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
      localSupportBonus: city.localSupport >= 40,
      resolved:          false,
      outcome:           null,
      activeEventId:     null,
    };

    const label = turnLabel(s);
    set({
      cities: s.cities.map(p =>
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
    const city = s.cities.find(p => p.id === provinceId);
    if (!city?.activeCampaign) return;
    const character = s.family.find(c => c.id === characterId);
    if (!character) return;

    const volunteer: OfficerVolunteerState = {
      campaignId:        city.activeCampaign.id,
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
      cities: s.cities.map(p =>
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
    const city = s.cities.find(p => p.id === provinceId);
    const volunteer = city?.officerVolunteer;
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
      cities: s.cities.map(p =>
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
