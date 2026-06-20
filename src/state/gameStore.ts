import { create } from 'zustand';
import type { Character } from '../models/character';
import type { Bill } from '../models/bill';
import type { Clan } from '../models/clan';
import type { OfficeId, ElectionRival } from '../models/office';
import { STARTING_FAMILY } from '../data/startingFamily';
import { STARTING_CLANS } from '../data/startingClans';
import { STARTING_BILLS } from '../data/billTemplates';
import { processSeason } from '../engine/turnSequencer';

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
  campaignVotes: Record<string, 'for' | 'against' | 'neutral'>;
  electionRivals: ElectionRival[];

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

  // Log
  addLog: (text: string, type?: LogEntry['type']) => void;
  addCursusLog: (text: string, type?: LogEntry['type']) => void;
}

let _logId = 0;
function mkLog(turn: string, text: string, type: LogEntry['type'] = 'neutral'): LogEntry {
  return { id: `log-${_logId++}`, turn, text, type };
}

const INITIAL_STATE: GameState = {
  year: -264,
  turnNumber: 1,
  seasonIndex: 0,

  gravitas: 20,
  dignitas: 20,
  gratia: 30,
  denarii: 200,

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
  campaignVotes: {},
  electionRivals: [],

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
    const { nextState, events } = processSeason(state);
    const newLog = [...state.log, mkLog(turnLabel(state), 'Season ended.', 'neutral')];
    set({
      ...nextState,
      log: newLog,
      seasonOverlayVisible: true,
      seasonOverlayEvents: events,
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
    set({
      gravitas: s.gravitas - 3,
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
    const noise = Math.random() * 6 - 2; // -2 to +4
    const base = 4 + Math.floor(rhetoric * 0.8) + noise;
    const delta = direction === 'for' ? base : -base;
    set({
      gravitas: s.gravitas - 6,
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
    set({
      gravitas: s.gravitas - 8,
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
    set({
      gravitas: s.gravitas - 10,
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
    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader) return;
    const gain = Math.max(3, 8 + Math.floor(leader.favour * 2) + Math.floor(Math.random() * 3) - 1);
    const label = turnLabel(s);
    set({
      gratia: s.gratia - 8,
      clans: s.clans.map((c) => ({
        ...c,
        leaders: c.leaders.map((l) =>
          l.id === leaderId ? { ...l, relationship: Math.min(100, l.relationship + gain) } : l
        ),
      })),
      log: [...s.log, mkLog(label, `${leader.name}'s relationship +${gain}.`, 'good')],
    });
  },

  inviteToDinner: (leaderId) => {
    const s = get();
    if (s.gratia < 12) return;
    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader) return;
    const relGain = 10 + leader.favour * 3 + Math.floor(Math.random() * 5);
    const label = turnLabel(s);
    set({
      gratia: s.gratia - 12,
      clans: s.clans.map((c) => ({
        ...c,
        leaders: c.leaders.map((l) =>
          l.id === leaderId
            ? { ...l, relationship: Math.min(100, l.relationship + relGain), favour: Math.min(5, l.favour + 1) }
            : l
        ),
      })),
      log: [...s.log, mkLog(label, `Dinner with ${leader.name}. Relationship +${relGain}, Favour +1.`, 'good')],
    });
  },

  forgeAlliance: (leaderId) => {
    const s = get();
    if (s.gratia < 20) return;
    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader || leader.relationship < 30) return;
    const label = turnLabel(s);
    set({
      gratia: s.gratia - 20,
      clans: s.clans.map((c) => ({
        ...c,
        standing: c.leaders.some((l) => l.id === leaderId) && c.standing !== 'ally' ? 'ally' : c.standing,
        leaders: c.leaders.map((l) =>
          l.id === leaderId
            ? { ...l, alliance: true, allianceTurns: 2, relationship: Math.min(100, l.relationship + 10) }
            : l
        ),
      })),
      log: [...s.log, mkLog(label, `Alliance forged with ${leader.name} for 2 seasons.`, 'good')],
    });
  },

  arrangeMarriageForum: (leaderId) => {
    const s = get();
    if (s.gratia < 18) return;
    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader || leader.relationship < 20) return;
    const label = turnLabel(s);
    set({
      gratia: s.gratia - 18,
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
      log: [...s.log, mkLog(label, `Marriage arranged with ${leader.name}'s family.`, 'good')],
    });
  },

  gatherIntelligence: (leaderId) => {
    const s = get();
    if (s.gratia < 6) return;
    const leader = s.clans.flatMap((c) => c.leaders).find((l) => l.id === leaderId);
    if (!leader) return;
    const label = turnLabel(s);

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
        set({
          gratia: s.gratia - 6,
          clans: s.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) =>
              l.id === leaderId ? { ...l, blackmail: true } : l
            ),
          })),
          log: [...s.log, mkLog(label, `Leverage acquired over ${leader.name}.`, 'good')],
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
    set({
      campaigning: officeId,
      campaignVotes: {},
      electionRivals: rivals,
      cursusLog: [...s.cursusLog, mkLog(label, `Campaign declared for ${officeId}.`, 'neutral')],
    });
  },

  useOfficeAction: (actionId) => {
    const s = get();
    if (!s.currentOffice) return;
    const { OFFICES } = require('../data/offices');
    const office = OFFICES.find((o: any) => o.id === s.currentOffice);
    const action = office?.inOfficeActions?.find((a: any) => a.id === actionId);
    if (!action) return;

    // Check cost
    if (action.resource && s[action.resource] < action.costVal) return;

    const patch = action.effect(s);
    const { logMsg, ...statePatch } = patch;
    const label = turnLabel(s);

    set({
      ...statePatch,
      ...(action.resource ? { [action.resource]: s[action.resource] - action.costVal } : {}),
      log: [...s.log, mkLog(label, logMsg, 'neutral')],
    });
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
