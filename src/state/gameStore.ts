import { create } from 'zustand';
import type { Character } from '../models/character';
import type { Bill } from '../models/bill';
import type { Clan } from '../models/clan';
import type { OfficeId, ElectionRival } from '../models/office';
import type { Client } from '../models/client';
import type { EventInstance } from '../models/event';
import type { OwnedAsset } from '../models/asset';
import type { ActiveAmbition } from '../models/ambition';
import type { LegacyObjective } from '../models/legacyObjective';
import type { PatronTier } from '../models/patronLadder';
import type { Trial } from '../models/trial';
import { STARTING_FAMILY } from '../data/startingFamily';
import { STARTING_CLANS } from '../data/startingClans';
import { STARTING_BILLS } from '../data/billTemplates';
import { processSeason } from '../engine/turnSequencer';
import { incrementLegacy, initLegacyObjectives } from '../engine/legacyEngine';
import { adjustReputation } from '../engine/reputationEngine';

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
  gravitas: number;
  dignitas: number;
  gratia: number;
  denarii: number;
  imperium: number;

  // Laudatio
  laudatioActive: boolean;
  laudatioBonus: number;

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
  campaigningCharacterId: string | null; // which family member is running
  campaignVotes: Record<string, 'for' | 'against' | 'neutral'>;
  electionRivals: ElectionRival[];
  pendingAmbitionScopes: ('family' | 'character')[]; // scopes needing a new ambition selection

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
  lifetimeDignitas: number; // total Dignitas ever earned, used for patron tier calc

  // Trials (Feature 6)
  trialQueue: Trial[];

  // Faction Reputation (Feature 2)
  familyReputations: Record<string, number>; // clanId → -100 to 100

  // Event queue
  pendingEvents: EventInstance[];
  activeEvent: EventInstance | null;

  // Birth naming queue
  pendingBirthNaming: {
    suggestedName: string;
    role: 'son' | 'daughter';
    inheritedTraits: string[];
    baseSkills: { rhetoric: number; auctoritas: number; martial: number; intrigus: number };
  } | null;

  // Log
  log: LogEntry[];
  cursusLog: LogEntry[];

  // UI
  seasonOverlayVisible: boolean;
  seasonOverlayEvents: string[];
}

export interface GameActions {
  // Turn
  endSeason: () => void;
  dismissSeasonOverlay: () => void;

  // Resources
  spendResource: (resource: 'gravitas' | 'dignitas' | 'gratia' | 'denarii', amount: number) => void;

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
  addClient: (client: Client) => void;
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

  // Log
  addLog: (text: string, type?: LogEntry['type']) => void;
  addCursusLog: (text: string, type?: LogEntry['type']) => void;
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

  gravitas: 20,
  dignitas: 20,
  gratia: 30,
  denarii: 200,
  imperium: 0,

  laudatioActive: false,
  laudatioBonus: 0,

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
  pendingAmbitionScopes: ['family', 'character'], // fire on first load

  clients: [],

  ownedAssets: [],
  familyReputations: INITIAL_FAMILY_REPUTATIONS,
  ambitions: [],
  legacyObjectives: initLegacyObjectives(),
  patronTier: 0,
  lifetimeDignitas: 0,
  trialQueue: [],

  pendingEvents: [],
  activeEvent: null,
  pendingBirthNaming: null,

  log: [mkLog('264 BC · Spring', 'The Brutii begin their ascent.', 'neutral')],
  cursusLog: [],

  seasonOverlayVisible: false,
  seasonOverlayEvents: [],
};

const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];

function turnLabel(state: GameState): string {
  return `${Math.abs(state.year)} BC · ${SEASON_NAMES[state.seasonIndex]}`;
}

export const useGameStore = create<GameState & GameActions>((set, get) => ({
  ...INITIAL_STATE,

  // ─── Turn ───────────────────────────────────────────────────────────────────

  endSeason: () => {
    const state = get();
    console.log('[endSeason] start', {
      turnNumber: state.turnNumber,
      seasonIndex: state.seasonIndex,
      ambitions: state.ambitions.length,
      pendingAmbitionScopes: state.pendingAmbitionScopes,
      pendingEvents: state.pendingEvents.length,
      activeEvent: state.activeEvent?.defId ?? null,
      clients: state.clients.length,
      ownedAssets: state.ownedAssets.length,
    });
    const { nextState, events } = processSeason(state);
    console.log('[endSeason] processSeason complete', { events: events.length });
    const newLog = [...state.log, mkLog(turnLabel(state), 'Season ended.', 'neutral')];

    // If an election was won, set officeId on the campaigning character
    let postElectionState = nextState;
    if (state.campaigning && nextState.currentOffice === state.campaigning) {
      // Election was won — set officeId on the character who was campaigning
      const winnerId = state.campaigningCharacterId;
      if (winnerId) {
        postElectionState = {
          ...postElectionState,
          family: postElectionState.family.map(c =>
            c.id === winnerId ? { ...c, officeId: state.campaigning } : c
          ),
        };
      }
    }

    const firstPending = postElectionState.pendingEvents[0] ?? null;
    const remainingPending = firstPending
      ? postElectionState.pendingEvents.slice(1)
      : postElectionState.pendingEvents;

    // Check which ambition scopes need a new selection
    const hasActiveFamilyAmbition = postElectionState.ambitions.some(
      a => a.scope === 'family' && a.status === 'active'
    );
    const hasActiveCharacterAmbition = postElectionState.ambitions.some(
      a => a.scope === 'character' && a.status === 'active'
    );
    const pendingScopes: ('family' | 'character')[] = [];
    if (!hasActiveFamilyAmbition) pendingScopes.push('family');
    if (!hasActiveCharacterAmbition) pendingScopes.push('character');

    set({
      ...postElectionState,
      pendingEvents: remainingPending,
      activeEvent: firstPending,
      log: newLog,
      seasonOverlayVisible: true,
      seasonOverlayEvents: events,
      pendingAmbitionScopes: pendingScopes,
    });
  },

  dismissSeasonOverlay: () => set({ seasonOverlayVisible: false }),

  spendResource: (resource, amount) => {
    set((s) => ({ [resource]: Math.max(0, s[resource] - amount) }));
  },

  // ─── Domus ──────────────────────────────────────────────────────────────────

  selectCharacter: (id) => set({ selectedCharacterId: id }),

  trainCharacter: (characterId, skill, cost) => {
    const state = get();
    if (state.dignitas < cost && cost > 0) return;

    const success = Math.random() < 0.65;
    const newFamily = state.family.map((c) => {
      if (c.id !== characterId) return c;
      return success
        ? { ...c, skills: { ...c.skills, [skill]: Math.min(10, c.skills[skill] + 1) } }
        : c;
    });
    const label = turnLabel(state);
    const char = state.family.find((c) => c.id === characterId);
    const logText = success
      ? `${char?.name} improves ${skill} by 1.`
      : `Training for ${char?.name} yields no result this season.`;

    set({
      family: newFamily,
      dignitas: cost > 0 ? state.dignitas - cost : state.dignitas,
      log: [...state.log, mkLog(label, logText, success ? 'good' : 'neutral')],
    });
  },

  commissionLaudatio: () => {
    const state = get();
    if (state.dignitas < 12) return;
    const bonus = state.laudatioActive
      ? Math.min(8, state.laudatioBonus + 1)
      : 3;
    const label = turnLabel(state);
    set({
      dignitas: state.dignitas - 12,
      laudatioActive: true,
      laudatioBonus: bonus,
      log: [...state.log, mkLog(label, `Laudatio commissioned. +${bonus} Dignitas per season.`, 'good')],
    });
  },

  performAdrogatio: () => {
    const state = get();
    if (state.dignitas < 15) return;
    const adopted: Character = {
      id: `adopted-${Date.now()}`,
      name: 'Quintus (adopted)',
      role: 'son',
      isPlayer: false,
      age: 22,
      skills: { rhetoric: 7, auctoritas: 5, martial: 4, intrigus: 3 },
      traits: ['ambitious'],
      ambition: { type: 'personal_power', priority: 0.6 },
      relationship: 50,
      familyTrust: 60,
      inheritedTraits: [],
      ambitionIds: [],
      reputationScores: {},
    };
    const newFamily = [
      ...state.family.map((c) =>
        c.isPlayer ? c : { ...c, familyTrust: Math.max(0, c.familyTrust - 15), relationship: c.relationship - 10 }
      ),
      adopted,
    ];
    const label = turnLabel(state);
    set({
      family: newFamily,
      dignitas: state.dignitas - 15,
      log: [...state.log, mkLog(label, 'Quintus adopted into the Brutii. Family trust strained.', 'neutral')],
    });
  },

  arrangeMarriageDomus: () => {
    const state = get();
    if (state.dignitas < 10) return;
    const target = state.family.find(
      (c) => !c.isPlayer && (c.role === 'son' || c.role === 'daughter')
    );
    if (!target) return;
    const newFamily = state.family.map((c) =>
      c.id === target.id
        ? { ...c, relationship: Math.min(100, c.relationship + 15) }
        : c
    );
    const label = turnLabel(state);
    set({
      family: newFamily,
      dignitas: state.dignitas - 10,
      log: [...state.log, mkLog(label, `Marriage arranged for ${target.name}. Relationship +15.`, 'good')],
    });
  },

  // ─── Curia ──────────────────────────────────────────────────────────────────

  expandBill: (billId, type) => {
    const s = get();
    if (s._expandedBill === billId && s._expandedType === type) {
      set({ _expandedBill: null, _expandedType: null });
    } else {
      set({ _expandedBill: billId, _expandedType: type });
    }
  },

  collapseBill: () => set({ _expandedBill: null, _expandedType: null }),

  voteBill: (billId, vote) => {
    const s = get();
    if (s.gravitas < 3) return;
    const delta = vote === 'vote_for' ? 8 : -8;
    const { updated: updatedLegacy } = incrementLegacy(s.legacyObjectives, 'senate_voice', 1);
    set({
      gravitas: s.gravitas - 3,
      legacyObjectives: updatedLegacy,
      bills: s.bills.map((b) =>
        b.id === billId
          ? { ...b, support: Math.min(100, Math.max(-100, b.support + delta)), playerVote: vote }
          : b
      ),
      _expandedBill: null,
      _expandedType: null,
    });
  },

  speechBill: (billId, direction) => {
    const s = get();
    if (s.gravitas < 6) return;
    const player = s.family.find((c) => c.isPlayer);
    const rhetoric = player?.skills.rhetoric ?? 0;
    const noise = Math.random() * 6 - 2;
    const base = 4 + Math.floor(rhetoric * 0.8) + noise;
    const delta = direction === 'for' ? base : -base;
    const { updated: updatedLegacy } = incrementLegacy(s.legacyObjectives, 'senate_voice', 1);
    set({
      gravitas: s.gravitas - 6,
      legacyObjectives: updatedLegacy,
      bills: s.bills.map((b) =>
        b.id === billId
          ? { ...b, support: Math.min(100, Math.max(-100, b.support + delta)) }
          : b
      ),
      _expandedBill: null,
      _expandedType: null,
    });
  },

  filibusterBill: (billId) => {
    const s = get();
    if (s.gravitas < 8) return;
    const { updated: updatedLegacy } = incrementLegacy(s.legacyObjectives, 'senate_voice', 1);
    set({
      gravitas: s.gravitas - 8,
      legacyObjectives: updatedLegacy,
      bills: s.bills.map((b) =>
        b.id === billId
          ? { ...b, support: Math.max(-100, b.support - 15), turnsLeft: b.turnsLeft + 1, playerVote: 'filibuster' }
          : b
      ),
    });
  },

  submitBill: (template) => {
    const s = get();
    if (s.gravitas < 10) return;
    const newBill: Bill = {
      ...template,
      id: `player-${Date.now()}`,
      playerSubmitted: true,
    };
    const label = turnLabel(s);
    const { updated: updatedLegacy } = incrementLegacy(s.legacyObjectives, 'senate_voice', 1);
    set({
      gravitas: s.gravitas - 10,
      legacyObjectives: updatedLegacy,
      bills: [...s.bills, newBill],
      log: [...s.log, mkLog(label, `You submit ${newBill.name} to the Senate.`, 'neutral')],
    });
  },

  // ─── Forum ──────────────────────────────────────────────────────────────────

  expandClan: (clanId) => {
    const s = get();
    set({
      expandedClanId: s.expandedClanId === clanId ? null : clanId,
      selectedLeaderId: null,
    });
  },

  selectLeader: (leaderId) => set({ selectedLeaderId: leaderId }),

  buyInfluence: (leaderId) => {
    const s = get();
    if (s.gratia < 8) return;
    const clan = s.clans.find((c) => c.leaders.some((l) => l.id === leaderId));
    const leader = clan?.leaders.find((l) => l.id === leaderId);
    if (!leader || !clan) return;
    const gain = Math.max(3, 8 + Math.floor(leader.favour * 2) + Math.floor(Math.random() * 3) - 1);
    const label = turnLabel(s);
    const { newScore, crossedThreshold } = adjustReputation(
      s.familyReputations[clan.id] ?? 0, 5
    );
    const newReps = { ...s.familyReputations, [clan.id]: newScore };
    const newOverlayEvents = crossedThreshold
      ? [...(s.seasonOverlayEvents.length > 0 ? s.seasonOverlayEvents : []),
         `${clan.name} now regards the Brutii as "${crossedThreshold.label}".`]
      : s.seasonOverlayEvents;
    set({
      gratia: s.gratia - 8,
      familyReputations: newReps,
      seasonOverlayEvents: newOverlayEvents,
      clans: s.clans.map((c) => ({
        ...c,
        leaders: c.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + gain) } : l
        ),
      })),
      log: [...s.log, mkLog(label, `${leader.name}'s relationship +${gain}. Reputation +5.`, 'good')],
    });
  },

  inviteToDinner: (leaderId) => {
    const s = get();
    if (s.gratia < 12) return;
    const clan = s.clans.find((c) => c.leaders.some((l) => l.id === leaderId));
    const leader = clan?.leaders.find((l) => l.id === leaderId);
    if (!leader || !clan) return;
    const relGain = 10 + leader.favour * 3 + Math.floor(Math.random() * 5);
    const label = turnLabel(s);
    const { newScore, crossedThreshold } = adjustReputation(
      s.familyReputations[clan.id] ?? 0, 3
    );
    const newReps = { ...s.familyReputations, [clan.id]: newScore };
    set({
      gratia: s.gratia - 12,
      familyReputations: newReps,
      clans: s.clans.map((c) => ({
        ...c,
        leaders: c.leaders.map((l) =>
          l.id === leaderId
            ? { ...l, relationship: Math.min(100, l.relationship + relGain), favour: Math.min(5, l.favour + 1) }
            : l
        ),
      })),
      log: [...s.log, mkLog(label, `Dinner with ${leader.name}. Relationship +${relGain}, Favour +1. Reputation +3.`, 'good')],
      ...(crossedThreshold ? {
        seasonOverlayEvents: [...s.seasonOverlayEvents,
          `${clan.name} now regards the Brutii as "${crossedThreshold.label}".`]
      } : {}),
    });
  },

  forgeAlliance: (leaderId) => {
    const s = get();
    if (s.gratia < 20) return;
    const clan = s.clans.find((c) => c.leaders.some((l) => l.id === leaderId));
    const leader = clan?.leaders.find((l) => l.id === leaderId);
    if (!leader || !clan || leader.relationship < 30) return;
    const label = turnLabel(s);
    const { newScore, crossedThreshold } = adjustReputation(
      s.familyReputations[clan.id] ?? 0, 5
    );
    const newReps = { ...s.familyReputations, [clan.id]: newScore };
    set({
      gratia: s.gratia - 20,
      familyReputations: newReps,
      clans: s.clans.map((c) => ({
        ...c,
        standing: c.leaders.some((l) => l.id === leaderId) && c.standing !== 'ally' ? 'ally' : c.standing,
        leaders: c.leaders.map((l) =>
          l.id === leaderId
            ? { ...l, alliance: true, allianceTurns: 2, relationship: Math.min(100, l.relationship + 10) }
            : l
        ),
      })),
      log: [...s.log, mkLog(label, `Alliance forged with ${leader.name} for 2 seasons. Reputation +5.`, 'good')],
      ...(crossedThreshold ? {
        seasonOverlayEvents: [...s.seasonOverlayEvents,
          `${clan.name} now regards the Brutii as "${crossedThreshold.label}".`]
      } : {}),
    });
  },

  arrangeMarriageForum: (leaderId) => {
    const s = get();
    if (s.gratia < 18) return;
    const clan = s.clans.find((c) => c.leaders.some((l) => l.id === leaderId));
    const leader = clan?.leaders.find((l) => l.id === leaderId);
    if (!leader || !clan || leader.relationship < 20) return;
    const label = turnLabel(s);
    const { newScore, crossedThreshold } = adjustReputation(
      s.familyReputations[clan.id] ?? 0, 15
    );
    const newReps = { ...s.familyReputations, [clan.id]: newScore };
    set({
      gratia: s.gratia - 18,
      familyReputations: newReps,
      clans: s.clans.map((c) => ({
        ...c,
        standing:
          c.leaders.some((l) => l.id === leaderId) &&
          (c.standing === 'hostile' || c.standing === 'neutral')
            ? 'ally'
            : c.standing,
        leaders: c.leaders.map((l) =>
          l.id === leaderId
            ? { ...l, relationship: Math.min(100, l.relationship + 25), favour: Math.min(5, l.favour + 2) }
            : l
        ),
      })),
      log: [...s.log, mkLog(label, `Marriage arranged with ${leader.name}'s family. Reputation +15.`, 'good')],
      ...(crossedThreshold ? {
        seasonOverlayEvents: [...s.seasonOverlayEvents,
          `${clan.name} now regards the Brutii as "${crossedThreshold.label}".`]
      } : {}),
    });
  },

  gatherIntelligence: (leaderId) => {
    const s = get();
    if (s.gratia < 6) return;
    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader) return;
    const label = turnLabel(s);

    const clan = s.clans.find((c) => c.leaders.some((l) => l.id === leaderId));

    if (leader.blackmail) {
      set({
        gratia: s.gratia - 6,
        clans: s.clans.map((c) => ({
          ...c,
          leaders: c.leaders.map((l) =>
            l.id === leaderId
              ? { ...l, blackmail: false, relationship: Math.min(100, l.relationship + 5) }
              : l
          ),
        })),
        log: [...s.log, mkLog(label, `Leverage over ${leader.name} neutralised.`, 'good')],
      });
    } else {
      const found = Math.random() < 0.5;
      if (found) {
        const { newScore: bmScore, crossedThreshold: bmCrossed } = adjustReputation(
          s.familyReputations[clan?.id ?? ''] ?? 0, -20
        );
        const newReps = clan ? { ...s.familyReputations, [clan.id]: bmScore } : s.familyReputations;
        set({
          gratia: s.gratia - 6,
          familyReputations: newReps,
          clans: s.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) =>
              l.id === leaderId ? { ...l, blackmail: true } : l
            ),
          })),
          // Acquiring blackmail also adds corruption to the target's reputation
          // (representing the dangerous knowledge that's now circulating)
          log: [...s.log, mkLog(label, `Leverage acquired over ${leader.name}. Reputation -20.`, 'good')],
          ...(bmCrossed && clan ? {
            seasonOverlayEvents: [...s.seasonOverlayEvents,
              `${clan.name} now regards the Brutii as "${bmCrossed.label}".`]
          } : {}),
        });
      } else {
        set({
          gratia: s.gratia - 6,
          log: [...s.log, mkLog(label, `Intelligence on ${leader.name} yields nothing.`, 'neutral')],
        });
      }
    }
  },

  canvassForVotes: (leaderId) => {
    const s = get();
    if (!s.campaigning) return;
    if (s.gratia < 6) return;
    if (s.campaignVotes[leaderId]) return;

    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader) return;

    const leanScore =
      leader.relationship +
      (leader.bias === 'optimates' ? s.optimatesRel * 0.15 : 0) +
      (leader.bias === 'populares' ? s.popularesRel * 0.15 : 0);
    const prob = Math.min(0.95, Math.max(0.05, 0.5 + leanScore / 130));
    const rand = Math.random();
    const result: 'for' | 'against' | 'neutral' =
      rand < prob ? 'for' : rand < prob + 0.3 ? 'neutral' : 'against';

    const label = turnLabel(s);
    set({
      gratia: s.gratia - 6,
      campaignVotes: { ...s.campaignVotes, [leaderId]: result },
      log: [...s.log, mkLog(label, `${leader.name} canvassed — ${result}.`, result === 'for' ? 'good' : result === 'against' ? 'bad' : 'neutral')],
    });
  },

  // ─── Cursus ─────────────────────────────────────────────────────────────────

  declareCampaign: (officeId) => {
    const s = get();
    const { generateRivals } = require('../engine/electionEngine');
    const rivals = generateRivals(officeId, s);
    const label = turnLabel(s);
    const player = s.family.find(c => c.isPlayer);
    set({
      campaigning: officeId,
      campaigningCharacterId: player?.id ?? null,
      campaignVotes: {},
      electionRivals: rivals,
      cursusLog: [...s.cursusLog, mkLog(label, `Campaign declared for ${officeId}.`, 'neutral')],
    });
  },

  declareFamilyCampaign: (characterId, officeId) => {
    const s = get();
    if (s.campaigning) return; // one at a time
    const char = s.family.find(c => c.id === characterId);
    if (!char) return;
    const { generateRivals } = require('../engine/electionEngine');
    const rivals = generateRivals(officeId, s);
    const label = turnLabel(s);
    set({
      campaigning: officeId,
      campaigningCharacterId: characterId,
      campaignVotes: {},
      electionRivals: rivals,
      cursusLog: [...s.cursusLog, mkLog(label, `${char.name} declares campaign for ${officeId}.`, 'neutral')],
    });
  },

  useOfficeAction: (actionId) => {
    const s = get();
    if (!s.currentOffice) return;
    const { OFFICES } = require('../data/offices');
    const office = OFFICES.find((o: any) => o.id === s.currentOffice);
    const action = office?.inOfficeActions?.find((a: any) => a.id === actionId);
    if (!action) return;

    const resourceKey = action.resource as keyof GameState | undefined;
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
    // Also update character's ambitionIds
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

  addClient: (client) => set((s) => ({ clients: [...s.clients, client] })),

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

    // Check asset requirement
    if (action.requiresAssetAction) {
      const unlocked = getUnlockedAssetActions(s.ownedAssets);
      if (!unlocked.includes(action.requiresAssetAction)) return;
    }

    // Check can afford
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
      inheritedTraits: [],
      ambitionIds: [],
      reputationScores: {},
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

    let succeeded = true;
    if (choice.skillCheck) {
      const player = s.family.find((c) => c.isPlayer);
      const skillVal = player?.skills[choice.skillCheck.skill as keyof typeof player.skills] ?? 0;
      succeeded = skillVal >= choice.skillCheck.difficulty;
    }

    const effectStr = succeeded ? choice.successEffect : choice.failureEffect;

    const patch = effectStr
      ? applyEffectString(effectStr, s, { previewClientName, instance: s.activeEvent })
      : {};

    const { _addClient, _removeClient, ...statePatch } = patch as any;

    const nextEvent = s.pendingEvents[0] ?? null;
    const remainingPending = s.pendingEvents.slice(1);

    set({ ...statePatch, activeEvent: nextEvent, pendingEvents: remainingPending });

    if (_addClient) get().addClient(_addClient);
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
}));
