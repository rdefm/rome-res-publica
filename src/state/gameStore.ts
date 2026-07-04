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
} from '../engine/electionEngine';
import { CANVASSING_EVENTS } from '../data/canvassingEvents';
import type { CanvassingEvent } from '../data/canvassingEvents';
import { STARTING_FAMILY } from '../data/startingFamily';
import { STARTING_CLANS } from '../data/startingClans';
import { STARTING_BILLS } from '../data/billTemplates';
import { buildInitialProvinceStates } from '../data/provinceDefinitions';
import { processSeason } from '../engine/turnSequencer';
import { incrementLegacy, initLegacyObjectives } from '../engine/legacyEngine';
import { adjustReputation } from '../engine/reputationEngine';
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
  crisisLevel: number;

  // Family (Domus)
  family: Character[];
  selectedCharacterId: string;

  // Senate (Curia)
  bills: Bill[];
  _expandedBill: string | null;
  _expandedType: 'vote' | 'speech' | null;

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
  pendingCanvassLeaderId: string | null;
  pendingCanvassRoll: number;
  pendingCanvassThreshold: number;
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
  startGame: (mode: 'senator' | 'debug') => void;

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

  family: STARTING_FAMILY,
  selectedCharacterId: 'pc-1',

  bills: STARTING_BILLS,
  _expandedBill: null,
  _expandedType: null,

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
  pendingCanvassLeaderId: null,
  pendingCanvassRoll: 0,
  pendingCanvassThreshold: 0,

  gameStarted: false,
  debugMode: false,
};


const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function turnLabel(state: GameState): string {
  return `${Math.abs(state.year)} BC · ${SEASON_NAMES[state.seasonIndex]}`;
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

  startGame: (mode) => {
    set({
      ...INITIAL_STATE,
      gameStarted: true,
      debugMode: mode === 'debug',
    });
  },

  endSeason: () => {
    const s = get();
    const { nextState, events } = processSeason(s);
    const nextEvent = nextState.pendingEvents[0] ?? null;
    const remainingPending = nextState.pendingEvents.slice(1);
    set({
      ...nextState,
      activeEvent: nextEvent,
      pendingEvents: remainingPending,
      seasonOverlayVisible: true,
      seasonOverlayEvents: events,
    });
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
    const delta = success
      ? direction === 'for'
        ? (bill.speechForSupport ?? 20)
        : (bill.speechAgainstSupport ?? -20)
      : 0;
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
    const label = turnLabel(s);
    set({
      fides: s.fides - 10,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + 5) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Influence purchased with a clan leader.', 'neutral')],
    });
  },

  inviteToDinner: (leaderId) => {
    const s = get();
    if (s.denarii < 20) return;
    const label = turnLabel(s);
    set({
      denarii: s.denarii - 20,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + 8) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Dinner hosted for a clan leader. Warmth increased.', 'good')],
    });
  },

  forgeAlliance: (leaderId) => {
    const s = get();
    if (s.fides < 20) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 20,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + 12), alliance: true } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Alliance forged with a clan leader.', 'good')],
    });
  },

  arrangeMarriageForum: (leaderId) => {
    const s = get();
    if (s.fides < 20) return;
    const label = turnLabel(s);
    set({
      fides: s.fides - 20,
      clans: s.clans.map((clan) => ({
        ...clan,
        leaders: clan.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + 20) } : l
        ),
      })),
      log: [...s.log, mkLog(label, 'Marriage alliance arranged with a clan family.', 'good')],
    });
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
      log: [...s.log, mkLog(label, `Campaign for ${officeId} declared.`, 'neutral')],
    });
  },

  useOfficeAction: (actionId) => {
    const s = get();
    const { OFFICE_ACTIONS } = require('../data/offices');
    const { getUnlockedAssetActions } = require('../engine/assetEngine');

    const action = OFFICE_ACTIONS.find((a: any) => a.id === actionId);
    if (!action) return;

    if (action.requiresAssetAction) {
      const unlocked = getUnlockedAssetActions(s.ownedAssets);
      if (!unlocked.includes(action.requiresAssetAction)) return;
    }

    const resourceKey = action.cost?.resource as keyof typeof s | undefined;
    if (resourceKey && (s[resourceKey] as number) < action.costVal) return;

    const patch = action.effect(s);
    const { logMsg, ...statePatch } = patch;
    const label = turnLabel(s);

    set({
      ...statePatch,
      ...(resourceKey ? { [resourceKey]: (s[resourceKey] as number) - action.costVal } : {}),
      log: [...s.log, mkLog(label, logMsg, 'neutral')],
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
    const newFamily = assignedCharacterId
      ? s.family.map(c =>
          c.id === assignedCharacterId
            ? { ...c, ambitionIds: [...c.ambitionIds.filter(id => id !== definitionId), definitionId] }
            : c
        )
      : s.family;
    set({
      ambitions: [...s.ambitions, newAmbition],
      family: newFamily,
      pendingAmbitionScopes: s.pendingAmbitionScopes.filter(sc => sc !== scope),
    });
  },

  dismissAmbitionSelection: () => set({ pendingAmbitionScopes: [] }),

  clearAmbitionScope: (scope) => set((s) => ({
    pendingAmbitionScopes: s.pendingAmbitionScopes.filter(sc => sc !== scope),
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

    const { EVENT_DEFS } = require('../data/events');
    const { applyEffectString } = require('../engine/resourceEngine');
    const { resolveEventChoice } = require('../engine/eventEngine');

    const def = EVENT_DEFS.find((d: any) => d.id === s.activeEvent!.defId);
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

    if (_addClient) {
      // _addClient is now a fully built Client object from applyEffectString
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
      log: [...s.log, mkLog(label, `Family member declared campaign for ${officeId}.`, 'neutral')],
    });
  },

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

    set({
      fides:   s.fides   - (option.cost?.resource === 'fides'   ? option.cost.amount : 0),
      denarii: s.denarii - (option.cost?.resource === 'denarii' ? option.cost.amount : 0),
      campaignVotes: success
        ? { ...s.campaignVotes, [leaderId]: 'for' as const }
        : s.campaignVotes,
      activeCanvassingEvent:   null,
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
}));
