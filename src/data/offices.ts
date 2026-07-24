import type { Office, OfficeAction } from '../models/office';
import { BALANCE } from './balance';
import { generateSecret } from '../engine/secretEngine';

export const OFFICES: Office[] = [
  // ─── VIGINTIVIRATE ──────────────────────────────────────────────────────────
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
    active: true,
    inOfficeDesc: 'Administrative duties.',
    inOfficeActions: [
      {
        id: 'mint-oversight',
        name: 'Mint Oversight (Tresviri Monetales)',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Manage coin quality to generate a small gold yield. Profitable but leaves a faint trail.',
        spend: {},
        successEffect: 'gold+15|corruption+2',
        isExtreme: false,
      },
      {
        id: 'road-survey',
        name: 'Road Survey (Quattuorviri Viarum)',
        cost: '8 Fides',
        costVal: 8,
        resource: 'fides',
        desc: "Commission a survey of roads connecting a province. Improves that province's infrastructure. Requires selecting a target province.",
        spend: { fides: 8 },
        successEffect: '',
        consequences: [
          { type: 'provinceRelationship', targetId: 'PLAYER_CHOSEN_PROVINCE', delta: 2, description: 'Province infrastructure investment recognised' },
        ],
        isExtreme: false,
      },
      {
        id: 'petty-courts',
        name: 'Preside Over Petty Courts (Tresviri Capitales)',
        cost: '5 Fides',
        costVal: 5,
        resource: 'fides',
        desc: 'Hear minor cases in the city. Builds goodwill with the urban population.',
        spend: { fides: 5 },
        successEffect: 'fides+6|plebs+3',
        isExtreme: false,
      },
    ],
  },

  // ─── QUAESTOR ────────────────────────────────────────────────────────────────
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
      // ── Existing actions (legacy effect style — unchanged) ────────────────
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
        // 60% — mirrors BALANCE.secrets.auditRivalChance (the actual value
        // used below). Kept as a static string rather than computed from
        // BALANCE at module scope: offices.ts -> balance.ts ->
        // electionEngine.ts -> offices.ts is an existing circular import
        // (electionEngine.ts imports OFFICES for prerequisite checks), and
        // dereferencing BALANCE at OFFICES-array-literal eval time (i.e.
        // synchronously, not inside a closure) crashes on the partially-
        // initialized module. The effect closure below is safe: it only
        // reads BALANCE when the action actually fires, long after every
        // module has finished loading.
        desc: '60% chance to uncover a criminal Secret on a hostile clan leader.',
        // Phase 4, Chunk P4-A — success now yields a real criminal Secret
        // (embezzlement/electoral_fraud, potency 1–2) instead of the old
        // blackmail:true flag (dropped per plan review — that flag is
        // overloaded three ways elsewhere in the codebase and never
        // consumed beyond a single UI label swap).
        effect: (state) => {
          const alreadyTargeted = new Set(
            (state.secrets ?? [])
              .filter((s) => s.holder === 'player' && s.subject.kind === 'leader')
              .map((s) => (s.subject as { kind: 'leader'; leaderId: string }).leaderId)
          );
          const hostile = state.clans
            .flatMap((c) => c.leaders)
            .find((l) => l.relationship < 30 && !alreadyTargeted.has(l.id));
          if (!hostile) return { logMsg: 'No suitable target found for audit.' };
          if (Math.random() < BALANCE.secrets.auditRivalChance) {
            const secret = generateSecret(
              { kind: 'leader', leaderId: hostile.id },
              'player',
              hostile.name,
              state.turnNumber,
              hostile.heldOffices.length > 0,
              Math.random,
              { typePool: ['embezzlement', 'electoral_fraud'], maxPotency: 2 }
            );
            return {
              secrets: [...state.secrets, secret],
              logMsg: `Audit complete. ${secret.flavorText}`,
            };
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
        desc: 'Wine and conversation. All leaders warm slightly to your family.',
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

      // ── New actions (effect-string style) ─────────────────────────────────
      {
        id: 'manage-campaign-accounts',
        name: "Manage the General's Accounts",
        cost: '6 Fides',
        costVal: 6,
        resource: 'fides',
        desc: 'Attach yourself to an active campaign as paymaster. Builds military reputation. Requires an active campaign.',
        spend: { fides: 6 },
        gate: [{ type: 'flag', key: 'activeCampaignExists', op: 'eq', value: true }],
        successEffect: 'martialBonus+1',
        consequences: [
          { type: 'provinceRelationship', targetId: 'ACTIVE_CAMPAIGN_PROVINCE', delta: 0, description: '+20% gold output this season from the campaign province' },
        ],
        isExtreme: false,
      },
      {
        id: 'fund-grain-dole',
        name: 'Fund the Grain Dole (−25 Denarii)',
        cost: '25 Denarii',
        costVal: 25,
        resource: 'denarii',
        desc: 'Direct public funds to subsidised grain distribution. Expensive but the plebs remember.',
        spend: { denarii: 25 },
        successEffect: 'plebs+12|fides+4',
        isExtreme: false,
      },
      {
        id: 'embezzle-treasury',
        name: 'Embezzle the Provincial Treasury',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Divert public funds into family coffers. Lucrative but dangerous if discovered. Requires provincial attachment and no hostile intelligence.',
        spend: {},
        gate: [
          { type: 'flag', key: 'quaestorAttachedToProvince', op: 'eq', value: true },
          { type: 'flag', key: 'hostileIntelOnPlayer', op: 'eq', value: false },
        ],
        successEffect: 'gold+60|corruption+8|setFlag:quaestor-embezzled:true',
        isExtreme: true,
      },
      {
        id: 'forge-generals-accounts',
        name: "Forge the General's Accounts (Intrigus check)",
        cost: '5 Fides',
        costVal: 5,
        resource: 'fides',
        desc: 'Falsify campaign paymaster records to gain leverage over the commanding general. Discovery reverses the advantage. Requires an active campaign and Intrigus 6+.',
        spend: { fides: 5 },
        gate: [
          { type: 'flag', key: 'activeCampaignExists', op: 'eq', value: true },
          { type: 'skill', key: 'intrigus', op: 'gte', value: 6 },
        ],
        skillCheck: { characterId: 'player', skill: 'intrigus', difficulty: 7 },
        successEffect: 'setFlag:quaestor-forge-success:true',
        failureEffect: 'fides-8',
        consequences: [
          { type: 'addBlackmail', targetId: 'CAMPAIGN_CLAN_LEADER', delta: 1, description: "Gain blackmail on the commanding general's clan leader" },
        ],
        isExtreme: true,
      },
    ],
  },

  // ─── AEDILE ──────────────────────────────────────────────────────────────────
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
      // ── Existing actions ──────────────────────────────────────────────────
      // P2-F: host-public-games / host-grand-ludi / sponsor-games-state removed —
      // superseded by the Munificence panel's Fund the Ludi / Grand Games acts
      // (Curia screen), which now unify every "hold games" mechanic in the game.
      // Holding Aedile discounts and boosts those acts (BALANCE.munificence.aedileCostMultiplier/
      // aedileEffectMultiplier) instead of offering a separate, parallel action here.
      {
        id: 'grain-distribution',
        name: 'Oversee Grain Distribution',
        cost: '5 Fides',
        costVal: 5,
        resource: 'fides',
        desc: 'Personally supervise the grain dole. The hungry remember your face.',
        effect: (state) => ({ popularesRel: Math.min(100, state.popularesRel + 5), lifetimeDignitas: state.lifetimeDignitas + 3, logMsg: 'Your oversight of grain distribution earns quiet respect. Populares +5, Lifetime Dignitas +3.' }),
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
            leaders: c.leaders.map((l) => ({ ...l, relationship: l.bias === 'commerce' ? Math.min(100, l.relationship + 6) : l.relationship })),
          }));
          return { clans, lifetimeDignitas: state.lifetimeDignitas + 2, logMsg: 'Market inspection complete. Lifetime Dignitas +2, commerce leaders +6.' };
        },
      },

      // ── New actions ───────────────────────────────────────────────────────
      // P2-F: sponsor-ludi removed — superseded by Fund the Ludi (Curia →
      // Munificence panel), which the Aedile discount now applies to instead.
      {
        id: 'regulate-markets',
        name: 'Regulate the Markets',
        cost: '4 Fides',
        costVal: 4,
        resource: 'fides',
        desc: 'Stabilise grain prices. Modest but reliable benefit to state finances and public mood.',
        spend: { fides: 4 },
        successEffect: 'treasury+5|plebs+4',
        isExtreme: false,
      },
      // P2-F: temple-restoration removed — superseded by Restore a Temple
      // (Curia → Munificence panel; 5 named temples, once each per game).
      {
        id: 'inspect-roads',
        name: 'Inspect Provincial Roads (−6 Fides)',
        cost: '6 Fides',
        costVal: 6,
        resource: 'fides',
        desc: 'Use your authority to fund a road inspection. Requires an existing road network in at least one province.',
        spend: { fides: 6 },
        gate: [{ type: 'flag', key: 'anyProvinceHasRoads', op: 'eq', value: true }],
        successEffect: 'fides+5',
        consequences: [
          { type: 'provinceRelationship', targetId: 'HIGHEST_INFRASTRUCTURE_PROVINCE', delta: 4, description: 'Infrastructure investment recognised' },
        ],
        isExtreme: false,
      },
      // P2-F: spectacular-munera removed — superseded by Grand Games (Curia →
      // Munificence panel), which now owns the "peoples-champion"-style election
      // bonus via the dedicated, decaying grandGamesVoteBonus (electionEngine).
      {
        id: 'corner-grain-supply',
        name: 'Corner the Grain Supply (Extreme)',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Direct grain contracts to family clients. Large immediate gold gain. Requires 2+ clients and no hostile intelligence on the player.',
        spend: {},
        gate: [
          { type: 'client', key: 'any', op: 'gte', value: 2 },
          { type: 'flag', key: 'hostileIntelOnPlayer', op: 'eq', value: false },
        ],
        successEffect: 'gold+50|corruption+6|setFlag:grain-cornered:true',
        consequences: [
          { type: 'crisisTrack', targetId: 'unrest', delta: 8, description: 'Plebs notice rising grain prices' },
        ],
        isExtreme: true,
      },
    ],
  },

  // ─── PRAETOR ─────────────────────────────────────────────────────────────────
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
    active: true,
    inOfficeDesc: 'Judicial investigation and provincial command.',
    inOfficeActions: [
      {
        id: 'issue-edict',
        name: 'Issue a Praetorian Edict',
        cost: '8 Fides',
        costVal: 8,
        resource: 'fides',
        desc: 'Publish a legal ruling with the force of temporary law. Base effect: stability+3, treasury+8.',
        spend: { fides: 8 },
        successEffect: 'stability+3|treasury+8',
        isExtreme: false,
      },
      {
        id: 'preside-trial',
        name: 'Preside Over a Trial (−10 Fides)',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: 'Use judicial authority to influence an active trial, or penalise a hostile clan leader.',
        spend: { fides: 10 },
        successEffect: 'fides+3',
        isExtreme: false,
      },
      {
        id: 'assign-governorship',
        name: 'Recommend a Governorship (−12 Fides)',
        cost: '12 Fides',
        costVal: 12,
        resource: 'fides',
        desc: "Use praetorian influence to support a family member's appointment to a province.",
        spend: { fides: 12 },
        successEffect: '',
        isExtreme: false,
      },
      {
        id: 'judicial-interference',
        name: 'Allocate Judicial Resources (−8 Fides)',
        cost: '8 Fides',
        costVal: 8,
        resource: 'fides',
        desc: 'Quietly redirect court resources away from prosecutions targeting your family.',
        spend: { fides: 8 },
        successEffect: 'fides+2',
        isExtreme: false,
      },
      {
        id: 'prorogatio',
        name: 'Seek Imperium Extension (Prorogatio) (Extreme) (−25 Fides)',
        cost: '25 Fides',
        costVal: 25,
        resource: 'fides',
        desc: 'Manoeuvre to hold your command beyond the normal term. Requires Rhetoric 7+.',
        spend: { fides: 25 },
        // OR condition: rhetoric ≥ 7 OR allied clan count ≥ 2.
        // Allied clan gate cannot yet be expressed; rhetoric requirement used for now.
        gateAny: [
          { type: 'skill', key: 'rhetoric', op: 'gte', value: 7 },
        ],
        successEffect: 'lifetimeDignitas+5|setFlag:prorogatio-used:true',
        consequences: [
          { type: 'crisisTrack', targetId: 'constitution', delta: 5, description: 'Senate resents the precedent' },
          { type: 'clanRelationship', targetId: 'ALL_NON_ALLIED_CLANS', delta: -8, description: 'Non-allies see the extension as power-grabbing' },
        ],
        isExtreme: true,
      },
      {
        id: 'blacklist-from-courts',
        name: 'Blacklist Rival from Courts (Extreme) (−15 Fides)',
        cost: '15 Fides',
        costVal: 15,
        resource: 'fides',
        desc: 'Use court authority to block a hostile leader from initiating prosecutions for two seasons. Requires Intrigus 5+. Requires selecting a target leader.',
        spend: { fides: 15 },
        gate: [{ type: 'skill', key: 'intrigus', op: 'gte', value: 5 }],
        successEffect: 'setFlag:blacklist-used:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'PLAYER_CHOSEN_LEADER_CLAN', delta: -20, description: 'Target clan goes hostile over judicial abuse' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 4, description: 'Judicial interference noted' },
        ],
        isExtreme: true,
      },
    ],
  },

  // ─── CONSUL ──────────────────────────────────────────────────────────────────
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
      // ── Existing actions ──────────────────────────────────────────────────
      {
        id: 'push-legislation',
        name: 'Push Legislation',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Use consular authority to advance active bills.',
        effect: (state) => ({ lifetimeDignitas: state.lifetimeDignitas + 5, logMsg: 'You invoke consular privilege. Lifetime Dignitas +5.' }),
      },
      {
        id: 'address-senate',
        name: 'Address the Senate',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'A formal speech to the assembled senators.',
        effect: (state) => ({ optimatesRel: Math.min(100, state.optimatesRel + 5), fides: state.fides + 6, logMsg: 'Your address is received with dignified approval. Optimates +5, Fides +6.' }),
      },
      {
        id: 'appoint-legate',
        name: 'Appoint a Legate',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: 'Name a loyal officer to command on your behalf.',
        effect: (state) => {
          const clans = state.clans.map((c) => ({ ...c, leaders: c.leaders.map((l) => ({ ...l, relationship: l.bias === 'military' ? Math.min(100, l.relationship + 8) : l.relationship })) }));
          return { clans, lifetimeDignitas: state.lifetimeDignitas + 6, logMsg: 'Your legate is named. Lifetime Dignitas +6, military leaders +8.' };
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
          const clans = state.clans.map((c) => ({ ...c, leaders: c.leaders.map((l) => ({ ...l, relationship: Math.min(100, l.relationship + 10) })) }));
          return { clans, popularesRel: Math.min(100, state.popularesRel + 20), lifetimeDignitas: state.lifetimeDignitas + 12, logMsg: 'Rome celebrates your triumph. Populares +20, Lifetime Dignitas +12, all relations +10.' };
        },
      },

      // ── New actions ───────────────────────────────────────────────────────
      {
        id: 'emergency-session',
        name: 'Convene an Emergency Session (−12 Fides)',
        cost: '12 Fides',
        costVal: 12,
        resource: 'fides',
        desc: 'Call the Senate outside the normal schedule. All active bills gain a one-time support bonus this season.',
        spend: { fides: 12 },
        successEffect: 'fides+5',
        isExtreme: false,
      },
      {
        id: 'champion-triumph',
        name: 'Champion the Triumph Petition (−10 Fides)',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: "Use consular authority to back a family member's Triumph petition. Adds +20 support to the Triumph bill. Requires a Triumph bill in the queue.",
        spend: { fides: 10 },
        gate: [{ type: 'flag', key: 'triumphBillInQueue', op: 'eq', value: true }],
        successEffect: 'lifetimeDignitas+3',
        isExtreme: false,
      },
      {
        id: 'senatus-consultum',
        name: 'Issue a Senatus Consultum (−20 Fides)',
        cost: '20 Fides',
        costVal: 20,
        resource: 'fides',
        desc: 'A formal consular decree with immediate legal effect. Can be used once per term.',
        spend: { fides: 20 },
        gate: [{ type: 'flag', key: 'consultatumUsedThisTerm', op: 'eq', value: false }],
        successEffect: 'stability+12|setFlag:consultatumUsedThisTerm:true',
        isExtreme: false,
      },
      {
        id: 'distribute-provinces',
        name: 'Distribute Consular Provinces (−8 Fides)',
        cost: '8 Fides',
        costVal: 8,
        resource: 'fides',
        desc: 'Assign prestigious governorships as diplomatic currency. Reward an ally or keep the prize for your family.',
        spend: { fides: 8 },
        successEffect: 'lifetimeDignitas+4',
        isExtreme: false,
      },
      {
        id: 'invoke-consular-authority',
        name: 'Invoke Consular Authority (−20 Fides)',
        cost: '20 Fides',
        costVal: 20,
        resource: 'fides',
        desc: "Formally legitimise a family member's military action under consular sanction. Delays and caps Senate Response. Requires family members with active troops.",
        spend: { fides: 20 },
        gate: [{ type: 'flag', key: 'familyHasTroops', op: 'eq', value: true }],
        successEffect: 'setFlag:consulAuthorityActive:true',
        consequences: [
          { type: 'crisisTrack', targetId: 'constitution', delta: 3, description: 'Senate notes the legal overreach' },
          { type: 'clanRelationship', targetId: 'MOST_HOSTILE_CLAN', delta: -10, description: 'Most hostile clan sees through the legal fiction' },
        ],
        isExtreme: false,
      },
      {
        id: 'override-colleague',
        name: 'Override Co-Consul (Extreme) (−15 Fides)',
        cost: '15 Fides',
        costVal: 15,
        resource: 'fides',
        desc: "Suspend your co-consul's authority for this season. Requires a serving NPC co-consul and Intrigus 6+.",
        spend: { fides: 15 },
        gate: [
          { type: 'flag', key: 'npcConsulExists', op: 'eq', value: true },
          { type: 'skill', key: 'intrigus', op: 'gte', value: 6 },
        ],
        successEffect: 'setFlag:colleague-overridden:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'NPC_CONSUL_CLAN', delta: -25, description: "Co-consul's clan goes hostile" },
          { type: 'crisisTrack', targetId: 'constitution', delta: 6, description: 'Unilateral action shocks the Senate' },
        ],
        isExtreme: true,
      },
      {
        id: 'pack-senate',
        name: 'Pack the Senate (Extreme) (−40 Fides)',
        cost: '40 Fides',
        costVal: 40,
        resource: 'fides',
        desc: 'Enrol new senators from your client network. Tilts future votes in your favour for years. Requires Intrigus 6+.',
        spend: { fides: 40 },
        // OR condition: Intrigus ≥ 6 OR blackmail on 2+ leaders.
        // Blackmail-count gate not yet expressible; Intrigus requirement used for now.
        gateAny: [
          { type: 'skill', key: 'intrigus', op: 'gte', value: 6 },
        ],
        successEffect: 'setFlag:senate-packed:true|lifetimeDignitas+5',
        consequences: [
          { type: 'clanRelationship', targetId: 'ALL_NON_ALLIED_CLANS', delta: -15, description: 'Every non-allied clan sees the power grab' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 10, description: 'Institutional manipulation shocks Rome' },
          { type: 'crisisTrack', targetId: 'war', delta: 5, description: 'Senate preoccupied — external threats ignored' },
        ],
        isExtreme: true,
      },
    ],
  },

  // ─── CENSOR ──────────────────────────────────────────────────────────────────
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
    active: true,
    inOfficeDesc: 'Senate roster control and census powers.',
    inOfficeActions: [
      {
        id: 'conduct-census',
        name: 'Conduct the Census',
        cost: '5 Fides',
        costVal: 5,
        resource: 'fides',
        desc: 'The formal census reveals the true state of all clans. Unlocks hidden information and applies a stability bonus.',
        spend: { fides: 5 },
        successEffect: 'stability+5|lifetimeDignitas+3|setFlag:censusCompleted:true',
        isExtreme: false,
      },
      {
        id: 'award-contracts',
        name: 'Award Public Contracts (−10 Fides)',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: 'Direct lucrative state contracts to a chosen clan. Simple patronage with lasting goodwill. Requires selecting a target clan.',
        spend: { fides: 10 },
        successEffect: 'lifetimeDignitas+4',
        consequences: [
          { type: 'clanRelationship', targetId: 'PLAYER_CHOSEN_CLAN', delta: 15, description: 'Contracts cement the relationship' },
        ],
        isExtreme: false,
      },
      {
        id: 'major-works',
        name: 'Commission Major Works (−60 Denarii)',
        cost: '60 Denarii',
        costVal: 60,
        resource: 'denarii',
        desc: 'Fund a lasting infrastructure project — a road, an aqueduct, a basilica. Rome will remember.',
        spend: { denarii: 60 },
        successEffect: 'stability+12|lifetimeDignitas+15',
        isExtreme: false,
      },
      {
        id: 'lustratio',
        name: 'Perform the Lustratio (Ritual Purification)',
        cost: '6 Fides',
        costVal: 6,
        resource: 'fides',
        desc: 'The formal religious closing of the census. Stabilises Rome and reduces external threat perception.',
        spend: { fides: 6 },
        successEffect: 'stability+8',
        consequences: [
          { type: 'crisisTrack', targetId: 'war', delta: -5, description: 'Religious act reduces external tension' },
        ],
        isExtreme: false,
      },
      {
        id: 'nota-censoria',
        name: "Apply the Censor's Mark (Nota Censoria) (Extreme) (−15 Fides)",
        cost: '15 Fides',
        costVal: 15,
        resource: 'fides',
        desc: 'Brand a specific leader with moral censure. Their votes are suspended for three seasons. Requires selecting a target leader.',
        spend: { fides: 15 },
        // Gate: target clan must not already be hostile (relationship ≥ 0).
        // This is validated at resolution time based on targetContext — no static gate possible.
        successEffect: 'lifetimeDignitas+3|setFlag:nota-applied:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'TARGET_LEADER_CLAN', delta: -30, description: 'Clan goes hostile over the public branding' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 5, description: 'Censorial power used aggressively' },
        ],
        isExtreme: true,
      },
      {
        id: 'lectio-senatus',
        name: 'Purge and Repack the Senate (Lectio Senatus) (Extreme) (−30 Fides)',
        cost: '30 Fides',
        costVal: 30,
        resource: 'fides',
        desc: 'Remove hostile senators and fill vacancies with clients and allies. Requires Intrigus 7+.',
        spend: { fides: 30 },
        // OR condition: Intrigus ≥ 7 OR blackmail on 2+ leaders.
        gateAny: [
          { type: 'skill', key: 'intrigus', op: 'gte', value: 7 },
        ],
        successEffect: 'setFlag:senate-packed:true|lifetimeDignitas+8',
        consequences: [
          { type: 'clanRelationship', targetId: 'ALL_NON_ALLIED_CLANS', delta: -15, description: 'Every non-allied clan loses senators' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 12, description: 'Senate composition forcibly altered' },
        ],
        isExtreme: true,
      },
      {
        id: 'refuse-to-step-down',
        name: 'Refuse to Relinquish the Office (Extreme)',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: "At term's end, simply stay. Retain all censorial powers for another year. Rome will call you a tyrant. Available only when term is expiring.",
        spend: {},
        gate: [{ type: 'flag', key: 'censorTermExpiring', op: 'eq', value: true }],
        successEffect: 'setFlag:censor-overstaying:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'ALL_CLANS', delta: -10, description: 'All clans alarmed by the refusal to step down (applied each overstay season)' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 8, description: 'Constitutional crisis deepens (applied each overstay season)' },
        ],
        isExtreme: true,
      },
    ],
  },

  // ─── DICTATOR ────────────────────────────────────────────────────────────────
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
    active: true,
    inOfficeDesc: 'Emergency powers. Only available when crisis > 70.',
    inOfficeActions: [
      {
        id: 'emergency-levy',
        name: 'Emergency Levy (No Senate Response)',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: 'Raise troops under full dictatorial authority. No Senate Response triggered. Cost is reduced to 50% of normal levy cost.',
        spend: {},
        successEffect: 'imperium+5',
        isExtreme: false,
      },
      {
        id: 'resolve-crisis',
        name: 'Emergency Crisis Resolution (Once per term)',
        cost: '15 Fides',
        costVal: 15,
        resource: 'fides',
        desc: 'Focus all state resources on the primary crisis. Applies −20 to the highest crisis track. Can only be used once per term.',
        spend: { fides: 15 },
        gate: [{ type: 'flag', key: 'crisisResolutionUsedThisTerm', op: 'eq', value: false }],
        successEffect: 'setFlag:crisisResolutionUsedThisTerm:true',
        consequences: [
          { type: 'crisisTrack', targetId: 'HIGHEST_CRISIS_TRACK', delta: -20, description: 'State resources focused on the primary threat' },
        ],
        isExtreme: false,
      },
      {
        id: 'purge-conspirators',
        name: 'Purge Conspirators (−10 Fides)',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: 'Use summary authority to eliminate political threats. Clears blackmail and penalises a hostile leader. Requires selecting a target leader.',
        spend: { fides: 10 },
        successEffect: 'setFlag:blackmail-cleared:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'PLAYER_CHOSEN_HOSTILE_LEADER_CLAN', delta: -10, description: 'Target clan pushed further into hostility' },
        ],
        isExtreme: false,
      },
      {
        id: 'suspend-trials',
        name: 'Suspend All Trials',
        cost: '8 Fides',
        costVal: 8,
        resource: 'fides',
        desc: 'Use dictatorial authority to suspend all active trials against family members for the duration of this office.',
        spend: { fides: 8 },
        successEffect: 'setFlag:dictatorTrialSuspension:true|fides+4',
        isExtreme: false,
      },
      {
        id: 'proscription',
        name: 'Issue Proscription List (Extreme) (−10 Fides)',
        cost: '10 Fides',
        costVal: 10,
        resource: 'fides',
        desc: 'Declare enemies of the state. Two leaders are destroyed. Every other faction is horrified.',
        spend: { fides: 10 },
        successEffect: 'setFlag:proscription-used:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'ALL_OTHER_CLANS', delta: -10, description: 'Every other faction horrified' },
          { type: 'crisisTrack', targetId: 'unrest', delta: 15, description: 'Rome is terrorised' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 15, description: 'Rule of law abandoned' },
        ],
        isExtreme: true,
      },
      {
        id: 'institutional-reform',
        name: 'Reshape Roman Institutions (Extreme) (−20 Fides)',
        cost: '20 Fides',
        costVal: 20,
        resource: 'fides',
        desc: 'Use absolute power to permanently alter how Rome works. Choose one: strip tribunician veto / lower bill pass threshold / raise trial threshold.',
        spend: { fides: 20 },
        successEffect: 'lifetimeDignitas+20|setFlag:institutional-reform-used:true',
        consequences: [
          { type: 'crisisTrack', targetId: 'unrest', delta: 20, description: 'Populares and citizens outraged' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 15, description: 'Institutions permanently altered' },
        ],
        isExtreme: true,
      },
      {
        id: 'refuse-to-resign',
        name: 'Refuse to Resign the Dictatorship (Extreme)',
        cost: 'Free',
        costVal: 0,
        resource: null,
        desc: "The crisis is resolved but you stay. Every season you remain accelerates Rome's collapse — and your own. Available only once the triggering crisis is resolved.",
        spend: {},
        gate: [{ type: 'flag', key: 'dictatorshipCrisisResolved', op: 'eq', value: true }],
        successEffect: 'setFlag:dictator-overstaying:true',
        consequences: [
          { type: 'clanRelationship', targetId: 'ALL_CLANS', delta: -5, description: 'Applied every overstay season' },
          { type: 'crisisTrack', targetId: 'constitution', delta: 8, description: 'Applied every overstay season' },
          { type: 'crisisTrack', targetId: 'war', delta: 3, description: 'Applied every overstay season — Rome losing focus' },
        ],
        isExtreme: true,
      },
    ],
  },
];

// ─── Tribune of the Plebs — parallel path ─────────────────────────────────────
// Not a rung on the Cursus Honorum ladder. Declared via declareTribuneCandidate().
// Rendered in CursusScreen as a separate panel below the ladder.
// Actions here are routed through resolveOfficeAction via takeOfficeAction.

export const TRIBUNE_OFFICE: Office = {
  id: 'tribune',
  name: 'Tribune of the Plebs',
  latin: 'Tribunus Plebis',
  icon: '✊',
  termSeasons: 4,
  minAge: 30,
  prerequisite: null,
  seats: 6,
  desc: 'Sacred defender of the plebeian people. Holds power of veto and can legislate via the Tribal Assembly.',
  flavor: 'The plebs roar your name. Your veto can stop any senatorial act.',
  active: true,
  inOfficeActions: [
    {
      id: 'intercessio',
      name: 'Veto a Bill (Intercessio)',
      cost: 'Free',
      costVal: 0,
      resource: null,
      desc: 'Block any active bill for one season. Free, but generates hostility with the sponsoring clan (+8 tribuneHostilityDebt). Requires selecting a target bill.',
      spend: {},
      successEffect: '',
      isExtreme: false,
    },
    {
      id: 'rogatio',
      name: 'Submit Tribal Assembly Bill (Rogatio) (−12 Fides)',
      cost: '12 Fides',
      costVal: 12,
      resource: 'fides',
      desc: 'Bypass the Senate entirely. If Plebs mood is above 50 at season end, the bill passes automatically. Optimates leaders penalised.',
      spend: { fides: 12 },
      successEffect: '',
      isExtreme: false,
    },
    {
      id: 'summon-to-account',
      name: 'Summon Rival to Account (−10 Fides)',
      cost: '10 Fides',
      costVal: 10,
      resource: 'fides',
      desc: 'Drag a magistrate before the Plebeian Assembly for public questioning. Damages their standing. Requires Intrigus 5+ and selecting a target leader.',
      spend: { fides: 10 },
      gate: [{ type: 'skill', key: 'intrigus', op: 'gte', value: 5 }],
      successEffect: 'setFlag:summon-blackmail-pending:true',
      consequences: [
        { type: 'clanRelationship', targetId: 'PLAYER_CHOSEN_LEADER_CLAN', delta: -12, description: 'Public humiliation damages relationship' },
      ],
      isExtreme: false,
    },
    {
      id: 'grain-law-push',
      name: 'Push a Grain Subsidy Law (−8 Fides)',
      cost: '8 Fides',
      costVal: 8,
      resource: 'fides',
      desc: 'Use tribunician authority to fast-track a grain subsidy through the Assembly.',
      spend: { fides: 8 },
      successEffect: 'plebs+15|treasury-8',
      consequences: [
        { type: 'clanRelationship', targetId: 'ALL_OPTIMATES_LEADERS', delta: -6, description: 'Optimates resent the populist grain law' },
      ],
      isExtreme: false,
    },
    {
      id: 'auxilium',
      name: 'Grant Auxilium — Protect a Client',
      cost: '8 Fides',
      costVal: 8,
      resource: 'fides',
      desc: 'Intervene to suspend a trial or prosecution threatening one of your clients. Requires at least 1 client.',
      spend: { fides: 8 },
      gate: [{ type: 'client', key: 'any', op: 'gte', value: 1 }],
      successEffect: 'plebs+5|fides+3|setFlag:auxilium-used-this-term:true',
      isExtreme: false,
    },
    {
      id: 'depose-fellow-tribune',
      name: 'Depose Fellow Tribune (Extreme) (−20 Fides)',
      cost: '20 Fides',
      costVal: 20,
      resource: 'fides',
      desc: 'Remove the NPC tribune who is blocking your legislation. Requires Plebs ≥ 70 and an active NPC tribune.',
      spend: { fides: 20 },
      gate: [
        { type: 'resource', key: 'rome.plebs', op: 'gte', value: 70 },
        { type: 'flag', key: 'npcTribuneActive', op: 'eq', value: true },
      ],
      successEffect: 'setFlag:npcTribuneActive:false|setFlag:depose-tribune-consequence:true',
      consequences: [
        { type: 'clanRelationship', targetId: 'ALL_OPTIMATES_LEADERS', delta: -15, description: 'Optimates outraged by unconstitutional deposition' },
        { type: 'crisisTrack', targetId: 'constitution', delta: 8, description: 'Constitutional precedent shattered' },
      ],
      isExtreme: true,
    },
    {
      id: 'legislative-blitz',
      name: 'Legislative Blitz (Extreme) (−30 Fides)',
      cost: '30 Fides',
      costVal: 30,
      resource: 'fides',
      desc: 'Force three bills through the Tribal Assembly in a single season, bypassing the Senate entirely. Requires Plebs ≥ 80.',
      spend: { fides: 30 },
      gate: [{ type: 'resource', key: 'rome.plebs', op: 'gte', value: 80 }],
      successEffect: 'setFlag:legislative-blitz-used:true',
      consequences: [
        { type: 'clanRelationship', targetId: 'ALL_OPTIMATES_LEADERS', delta: -20, description: 'Optimates hostility cascade' },
        { type: 'crisisTrack', targetId: 'constitution', delta: 12, description: 'Senate authority openly flouted' },
      ],
      isExtreme: true,
    },
    {
      id: 'claim-sacrosanctity',
      name: 'Claim Full Sacrosanctity (Extreme)',
      cost: 'Free',
      costVal: 0,
      resource: null,
      desc: 'Formally invoke your divine inviolability. All active trials against you are voided. The Senate will not forgive this.',
      spend: {},
      successEffect: 'setFlag:sacrosanctity-claimed:true',
      consequences: [
        { type: 'crisisTrack', targetId: 'constitution', delta: 10, description: 'Sacrosanctity claim radicalises Senate opposition' },
        { type: 'clanRelationship', targetId: 'ALL_OPTIMATES_LEADERS', delta: -12, description: 'Establishment furious' },
      ],
      isExtreme: true,
    },
  ],
};
