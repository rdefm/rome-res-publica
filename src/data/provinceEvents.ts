import type { ProvinceEventDefinition } from '../models/province';

// ─── Generic Province Event Definitions ──────────────────────────────────────
// These fire across all provinces (Italy-focused for v1). Region-specific
// events (Macedonia philosophy school, Hispania silver, etc.) are in
// regionEvents.ts — to be added when those maps unlock.

export const PROVINCE_EVENTS: ProvinceEventDefinition[] = [
  // ── Governor events ───────────────────────────────────────────────────────
  {
    id: 'corrupt_quartermaster',
    title: 'The Dishonest Quartermaster',
    description:
      'Your quartermaster has been skimming from the military supply chain. The legions are grumbling and a local merchant has noticed.',
    triggerCondition: 'governor',
    options: [
      {
        id: 'punish',
        label: 'Punish publicly',
        successEffect: 'rel:+8,corruption:-5',
        successText: 'The public dismissal sends a clear message. The province notices.',
      },
      {
        id: 'cover_up',
        label: 'Cover it up',
        successEffect: 'corruption:+10,gold:+15',
        successText: 'The matter is quietly buried. The denarii disappear into the accounts.',
      },
      {
        id: 'investigate',
        label: 'Investigate quietly',
        skillCheck: { skill: 'intrigus', difficulty: 5 },
        successEffect: 'corruption:-8,rel:+3',
        successText: 'Your investigation uncovers the full extent — and a way to quietly restore the funds.',
        failureEffect: 'corruption:+6',
        failureText: 'The investigation goes nowhere. The quartermaster covers his tracks.',
      },
    ],
  },
  {
    id: 'infrastructure_petition',
    title: 'Petition for Roads',
    description:
      'A delegation of local merchants presents a petition: they request funds for road repairs. The trade benefits could be substantial.',
    triggerCondition: 'governor',
    options: [
      {
        id: 'fund_fully',
        label: 'Fund it fully (40 Gold)',
        cost: { resource: 'denarii', amount: 40 },
        successEffect: 'rel:+10,infra:+8',
        successText: 'The roads are built. Trade flows; loyalty deepens.',
      },
      {
        id: 'fund_partially',
        label: 'Partial funding (15 Gold)',
        cost: { resource: 'denarii', amount: 15 },
        successEffect: 'rel:+4,infra:+3',
        successText: 'A modest contribution. Better than nothing.',
      },
      {
        id: 'refuse',
        label: 'Refuse the petition',
        successEffect: 'rel:-4',
        successText: 'The delegation departs disappointed. Word spreads.',
      },
    ],
  },
  {
    id: 'bandit_raids',
    title: 'Bandits on the Via',
    description:
      'Armed robbers have been preying on travellers and merchants along the main road. Your garrison commander asks for orders.',
    triggerCondition: 'governor',
    options: [
      {
        id: 'dispatch_troops',
        label: 'Dispatch troops',
        cost: { resource: 'imperium', amount: 5 },
        successEffect: 'rel:+8,gold:+5',
        successText: 'Your soldiers root out the bandits. The merchants are grateful.',
      },
      {
        id: 'offer_bounty',
        label: 'Post a bounty (30 Gold)',
        cost: { resource: 'denarii', amount: 30 },
        successEffect: 'rel:+5',
        successText: 'The bounty works. Locals deal with the problem themselves.',
      },
      {
        id: 'ignore',
        label: 'Ignore — not your concern',
        successEffect: 'rel:-6',
        successText: 'The raids continue unchecked. Your reputation for neglect grows.',
      },
    ],
  },
  {
    id: 'wealthy_local_feast',
    title: 'Invitation to a Feast',
    description:
      'A wealthy local family invites you to an elaborate banquet. Attending costs nothing but time — and may yield connections.',
    triggerCondition: 'governor',
    options: [
      {
        id: 'attend_charm',
        label: 'Attend and charm',
        cost: { resource: 'fides', amount: 10 },
        successEffect: 'localSupport:+8,rel:+3',
        successText: 'An excellent evening. Connections made, friendships warmed.',
      },
      {
        id: 'attend_observe',
        label: 'Attend and observe',
        successEffect: 'localSupport:+4',
        successText: 'You learn more than you reveal. Useful intelligence stored away.',
      },
      {
        id: 'decline',
        label: 'Decline — too busy',
        successEffect: 'rel:-2',
        successText: 'A minor slight, but noted.',
      },
    ],
  },
  {
    id: 'grain_surplus',
    title: 'Exceptional Harvest',
    description:
      'This season\'s grain harvest has exceeded all projections. How do you report the surplus to Rome?',
    triggerCondition: 'governor',
    options: [
      {
        id: 'report_fully',
        label: 'Report fully to Rome',
        successEffect: 'lifetimeDignitas:+8,fides:+5',
        successText: 'Your honest accounting earns respect in the Senate.',
      },
      {
        id: 'skim_surplus',
        label: 'Skim the surplus',
        successEffect: 'gold:+40,corruption:+6',
        successText: 'The extra grain disappears quietly into your accounts.',
      },
      {
        id: 'redirect_allies',
        label: 'Redirect to allied clans',
        successEffect: 'fides:+20',
        successText: 'You know who to thank. Debts incurred, favours stored.',
      },
    ],
  },
  {
    id: 'soldiers_unrest',
    title: 'Restless Legions',
    description:
      'Your garrison soldiers have gone unpaid for a season. Grumbling has turned to open complaint. The centurions warn you.',
    triggerCondition: 'governor',
    options: [
      {
        id: 'pay_them',
        label: 'Pay them in full (30 Gold)',
        cost: { resource: 'denarii', amount: 30 },
        successEffect: 'imperium:+3,rel:+4',
        successText: 'Order restored. Loyalty bought.',
      },
      {
        id: 'rally_rhetoric',
        label: 'Rally with a speech',
        skillCheck: { skill: 'rhetoric', difficulty: 6 },
        cost: { resource: 'fides', amount: 10 },
        successEffect: 'rel:+5,imperium:+2',
        successText: 'Your words move them. Pride, not pay, steadies the ranks.',
        failureEffect: 'corruption:+5,rel:-4',
        failureText: 'They jeer. The speech falls flat and your weakness is exposed.',
      },
      {
        id: 'let_them_loot',
        label: 'Allow limited requisitioning',
        successEffect: 'imperium:+2,rel:-8,localSupport:-5',
        successText: 'The soldiers are placated. The locals are not.',
      },
    ],
  },

  // ── Ambassador events ─────────────────────────────────────────────────────
  {
    id: 'rival_envoy_arrives',
    title: 'A Rival Envoy',
    description:
      'A competitor from a rival Roman family has arrived in the province, seeking to undermine your diplomatic position.',
    triggerCondition: 'ambassador',
    options: [
      {
        id: 'outmanoeuvre',
        label: 'Outmanoeuvre them',
        skillCheck: { skill: 'intrigus', difficulty: 5 },
        cost: { resource: 'fides', amount: 15 },
        successEffect: 'localSupport:+10,rel:+5',
        successText: 'You expose their weak credentials to the local authority. They depart humiliated.',
        failureEffect: 'localSupport:-8,rel:-5',
        failureText: 'They are more skilled than you expected. Your position is weakened.',
      },
      {
        id: 'accommodate',
        label: 'Accommodate and cooperate',
        successEffect: 'rel:+3,fides:-5',
        successText: 'A gracious gesture. Rome presents a united face — at a small personal cost.',
      },
      {
        id: 'report_to_senate',
        label: 'Report interference to the Senate',
        successEffect: 'fides:+5',
        successText: 'The Senate takes note. Whether they act is another matter.',
      },
    ],
  },
  {
    id: 'local_festival',
    title: 'Local Festival',
    description:
      'The province holds its annual festival. As Roman Ambassador you are invited to participate. How do you represent Rome?',
    triggerCondition: 'ambassador',
    options: [
      {
        id: 'sponsor_games',
        label: 'Sponsor the games (40 Gold)',
        cost: { resource: 'denarii', amount: 40 },
        successEffect: 'rel:+8,localSupport:+10',
        successText: 'The crowd cheers the Roman eagle. An investment that pays in goodwill.',
      },
      {
        id: 'enter_competition',
        label: 'Enter a family member',
        skillCheck: { skill: 'martial', difficulty: 5 },
        successEffect: 'lifetimeDignitas:+10,localSupport:+8',
        successText: 'Your man competes well. Rome\'s prestige rises on the field.',
        failureEffect: 'lifetimeDignitas:-3,localSupport:+2',
        failureText: 'A respectable showing, but not a victory. Still, participation is noted.',
      },
      {
        id: 'attend_only',
        label: 'Attend as observer',
        successEffect: 'rel:+2',
        successText: 'A quiet presence. Unambitious, but without cost.',
      },
    ],
  },
];

export function getProvinceEventDef(id: string): ProvinceEventDefinition | undefined {
  return PROVINCE_EVENTS.find(e => e.id === id);
}

export function getEventsForContext(
  triggerCondition: 'governor' | 'ambassador',
  provinceId?: string
): ProvinceEventDefinition[] {
  return PROVINCE_EVENTS.filter(
    e => (e.triggerCondition === 'any' || e.triggerCondition === triggerCondition)
      && (!e.region || e.region === provinceId)
  );
}
