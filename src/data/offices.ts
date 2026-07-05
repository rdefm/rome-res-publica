import type { Office } from '../models/office';

export const OFFICES: Office[] = [
  {
    id: 'vigintivirate',
    name: 'Vigintivirate',
    latin: 'Vigintiviri',
    icon: '📋',
    termSeasons: 4,
    minAge: 18,
    prerequisite: null,
    seats: 6,
    desc: 'Entry-level board of twenty minor magistrates. The first rung of public life.',
    flavor: 'You serve on one of the boards of twenty. Minor, but it is a beginning.',
    active: false,
    inOfficeDesc: 'Administrative duties. Full mechanics coming in a future update.',
  },
  {
    id: 'quaestor',
    name: 'Quaestor',
    latin: 'Quaestura',
    icon: '💰',
    termSeasons: 4,
    minAge: 30,
    prerequisite: null,
    seats: 8,
    desc: 'Financial magistrate. Access to treasury accounts and audit powers.',
    flavor: 'The treasury opens its ledgers to you. Use the access wisely.',
    active: true,
    inOfficeActions: [
      {
        id: 'divert-treasury',
        name: 'Divert Treasury Access',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Redirect minor administrative funds through friendly accounts.',
        effect: (state) => ({
          fides: state.fides + 4,
          logMsg: 'You divert treasury access, gaining 4 Fides.',
        }),
      },
      {
        id: 'audit-rival',
        name: 'Audit a Rival',
        cost: '5 Fides',
        costVal: 5,
        resource: 'fides',
        desc: '60% chance to uncover leverage on a hostile clan leader.',
        effect: (state) => {
          const hostile = state.clans
            .flatMap((c) => c.leaders)
            .find((l) => l.relationship < 30 && !l.blackmail);
          if (!hostile) return { logMsg: 'No suitable target found for audit.' };
          if (Math.random() < 0.6) {
            const clans = state.clans.map((c) => ({
              ...c,
              leaders: c.leaders.map((l) =>
                l.id === hostile.id ? { ...l, blackmail: true } : l
              ),
            }));
            return { clans, logMsg: `Audit complete. You hold leverage over ${hostile.name}.` };
          }
          return { logMsg: 'The audit reveals nothing useful this season.' };
        },
      },
      {
        id: 'host-banquet',
        name: 'Host a Private Banquet',
        cost: '40 Denarii',
        costVal: 40,
        resource: 'denarii',
        desc: 'Wine and conversation. All leaders warm slightly to the Brutii.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship: Math.min(100, l.relationship + 2),
            })),
          }));
          return {
            clans,
            popularesRel: Math.min(100, state.popularesRel + 3),
            logMsg: 'Your banquet draws praise. All relationships +2, Populares +3.',
          };
        },
      },
    ],
  },
  {
    id: 'tribune',
    name: 'Tribune of the Plebs',
    latin: 'Tribunus Plebis',
    icon: '✊',
    termSeasons: 4,
    minAge: 30,
    prerequisite: null,
    seats: 6,
    desc: 'Sacred defender of the plebeian people. Holds power of veto.',
    flavor: 'The plebs roar your name. Your veto can stop any senatorial act.',
    active: false,
    inOfficeDesc: 'Veto and legislation powers. Full mechanics coming in v2.',
  },
  {
    id: 'aedile',
    name: 'Aedile',
    latin: 'Aedilitas',
    icon: '🏟️',
    termSeasons: 4,
    minAge: 36,
    prerequisite: 'quaestor',
    seats: 4,
    desc: 'Overseer of public buildings, games, and grain supply. A path to popular glory.',
    flavor: 'Rome watches as you stage the games. Every denarius spent is a vote purchased.',
    active: true,
    inOfficeActions: [
      {
        id: 'host-public-games',
        name: 'Host Public Games',
        cost: '120 Denarii',
        costVal: 120,
        resource: 'denarii',
        desc: 'Gladiatorial contests and chariot races. The plebs will adore you.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship: Math.min(100, l.relationship + 6),
            })),
          }));
          return {
            clans,
            popularesRel: Math.min(100, state.popularesRel + 15),
            lifetimeDignitas: state.lifetimeDignitas + 4,
            logMsg: 'The games are magnificent. Populares +15, Lifetime Dignitas +4, all relations +6.',
          };
        },
      },
      {
        id: 'host-grand-ludi',
        name: 'Host Grand Ludi',
        cost: '250 Denarii',
        costVal: 250,
        resource: 'denarii',
        desc: 'Spectacular multi-day festival. An investment in lasting renown.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship: Math.min(100, l.relationship + 12),
            })),
          }));
          return {
            clans,
            popularesRel: Math.min(100, state.popularesRel + 25),
            lifetimeDignitas: state.lifetimeDignitas + 8,
            logMsg: 'Rome speaks of nothing else. Populares +25, Lifetime Dignitas +8, all relations +12.',
          };
        },
      },
      {
        id: 'sponsor-games-state',
        name: 'Sponsor Games (State Funds)',
        cost: '8 Fides',
        costVal: 8,
        resource: 'fides',
        desc: 'Use political capital to fund games from the public treasury.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship: Math.min(100, l.relationship + 3),
            })),
          }));
          return {
            clans,
            popularesRel: Math.min(100, state.popularesRel + 8),
            logMsg: 'State-funded games draw modest crowds. Populares +8, all relations +3.',
          };
        },
      },
      {
        id: 'grain-distribution',
        name: 'Oversee Grain Distribution',
        cost: '5 Fides',
        costVal: 5,
        resource: 'fides',
        desc: 'Personally supervise the grain dole. The hungry remember your face.',
        effect: (state) => ({
          popularesRel: Math.min(100, state.popularesRel + 5),
          lifetimeDignitas: state.lifetimeDignitas + 3,
          logMsg: 'Your oversight of grain distribution earns quiet respect. Populares +5, Lifetime Dignitas +3.',
        }),
      },
      {
        id: 'inspect-market',
        name: 'Inspect Market Weights',
        cost: '3 Fides',
        costVal: 3,
        resource: 'fides',
        desc: 'Crack down on fraudulent merchants. Commerce leaders appreciate honest markets.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship:
                l.bias === 'commerce'
                  ? Math.min(100, l.relationship + 6)
                  : l.relationship,
            })),
          }));
          return {
            clans,
            lifetimeDignitas: state.lifetimeDignitas + 2,
            logMsg: 'Market inspection complete. Lifetime Dignitas +2, commerce leaders +6.',
          };
        },
      },
    ],
  },
  {
    id: 'praetor',
    name: 'Praetor',
    latin: 'Praetura',
    icon: '⚖️',
    termSeasons: 4,
    minAge: 39,
    prerequisite: 'aedile',
    seats: 4,
    desc: 'Senior judicial magistrate. Commands a small army and presides over courts.',
    flavor: 'Justice and command are now yours. Wield them without prejudice.',
    active: false,
    inOfficeDesc: 'Judicial investigation and provincial command. Full mechanics in v2.',
  },
  {
    id: 'consul',
    name: 'Consul',
    latin: 'Consulatus',
    icon: '🦅',
    termSeasons: 4,
    minAge: 42,
    prerequisite: 'praetor',
    seats: 2,
    desc: 'Highest elected office. Two consuls share supreme power over Rome for a year.',
    flavor: 'The fasces are borne before you. Rome is yours to govern.',
    active: true,
    inOfficeActions: [
      {
        id: 'push-legislation',
        name: 'Push Legislation',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Use consular authority to advance active bills.',
        effect: (state) => ({
          lifetimeDignitas: state.lifetimeDignitas + 5,
          logMsg: 'You invoke consular privilege. Lifetime Dignitas +5.',
        }),
      },
      {
        id: 'address-senate',
        name: 'Address the Senate',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'A formal speech to the assembled senators.',
        effect: (state) => ({
          optimatesRel: Math.min(100, state.optimatesRel + 5),
          fides: state.fides + 6,
          logMsg: 'Your address is received with dignified approval. Optimates +5, Fides +6.',
        }),
      },
      {
        id: 'appoint-legate',
        name: 'Appoint a Legate',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: 'Name a loyal officer to command on your behalf.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship:
                l.bias === 'military'
                  ? Math.min(100, l.relationship + 8)
                  : l.relationship,
            })),
          }));
          return {
            clans,
            lifetimeDignitas: state.lifetimeDignitas + 6,
            logMsg: 'Your legate is named. Lifetime Dignitas +6, military leaders +8.',
          };
        },
      },
      {
        id: 'fund-triumph',
        name: 'Fund a Triumph Parade',
        cost: '300 Denarii',
        costVal: 300,
        resource: 'denarii',
        desc: 'A magnificent procession through Rome. Unmatched in prestige.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({
            ...c,
            leaders: c.leaders.map((l) => ({
              ...l,
              relationship: Math.min(100, l.relationship + 10),
            })),
          }));
          return {
            clans,
            popularesRel: Math.min(100, state.popularesRel + 20),
            lifetimeDignitas: state.lifetimeDignitas + 12,
            logMsg: 'Rome celebrates your triumph. Populares +20, Lifetime Dignitas +12, all relations +10.',
          };
        },
      },
    ],
  },
  {
    id: 'censor',
    name: 'Censor',
    latin: 'Censura',
    icon: '📜',
    termSeasons: 6,
    minAge: 45,
    prerequisite: 'consul',
    seats: 2,
    desc: 'Guardian of Roman morality and the Senate rolls. Immense informal power.',
    flavor: 'You hold the stylus that writes and erases senatorial careers.',
    active: false,
    inOfficeDesc: 'Senate roster control and census powers. Full mechanics in v3.',
  },
  {
    id: 'dictator',
    name: 'Dictator',
    latin: 'Dictatura',
    icon: '⚔️',
    termSeasons: 2,
    minAge: 50,
    prerequisite: 'consul',
    seats: 1,
    desc: 'Emergency appointment granting supreme authority. Only when crisis demands it.',
    flavor: 'All power is yours — and all responsibility. Do not fail Rome.',
    active: false,
    inOfficeDesc: 'Emergency powers. Only available when crisis > 70. Full mechanics in v3.',
  },
];
