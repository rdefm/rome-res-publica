// ─── Campaign Events ──────────────────────────────────────────────────────────
// Event cards that fire during active military campaigns (Medium + Light systems).

export interface CampaignEventOption {
  id: string;
  label: string;
  goldCost?: number;
  gravitasCost?: number;
  imperiuCost?: number;
  skillCheck?: { skill: 'martial' | 'intrigus' | 'rhetoric'; difficulty: number };
  successEffect: {
    progressDelta?: number;
    enemyDelta?: number;
    goldDelta?: number;
    relationshipDelta?: number;
    logMsg: string;
  };
  failureEffect?: {
    progressDelta?: number;
    enemyDelta?: number;
    logMsg: string;
  };
  successText: string;
  failureText?: string;
}

export interface CampaignEventDef {
  id: string;
  title: string;
  description: string;
  options: CampaignEventOption[];
}

export const CAMPAIGN_EVENT_DEFS: CampaignEventDef[] = [
  {
    id: 'supply_shortage',
    title: 'Supply Lines Threatened',
    description: 'Raiders have cut your supply route. The legions grow hungry.',
    options: [
      {
        id: 'escort',
        label: 'Dispatch escort (20 Gold)',
        goldCost: 20,
        successEffect: { progressDelta: 5, logMsg: 'Supply route secured.' },
        successText: 'The escort drives off the raiders. Supplies resume.',
      },
      {
        id: 'forage',
        label: 'Order foraging (Martial check)',
        skillCheck: { skill: 'martial', difficulty: 5 },
        successEffect: { progressDelta: 3, logMsg: 'Troops forage successfully.' },
        failureEffect: { progressDelta: -8, logMsg: 'Foraging parties are ambushed.' },
        successText: 'Your soldiers live off the land.',
        failureText: 'Foraging parties are cut down. Morale suffers.',
      },
      {
        id: 'ignore',
        label: 'Press on regardless',
        successEffect: { progressDelta: -10, enemyDelta: 5, logMsg: 'Hunger weakens the legions.' },
        successText: 'The troops endure — barely.',
      },
    ],
  },
  {
    id: 'local_guides',
    title: 'Local Guides Offer Aid',
    description: 'Locals familiar with the terrain offer to guide your forces.',
    options: [
      {
        id: 'accept',
        label: 'Accept their guidance (15 Gratia)',
        gravitasCost: 15,
        successEffect: { progressDelta: 15, logMsg: 'Local guides reveal a hidden pass.' },
        successText: 'The guides lead you around the enemy flank.',
      },
      {
        id: 'test',
        label: 'Test their loyalty (Intrigus check)',
        skillCheck: { skill: 'intrigus', difficulty: 4 },
        successEffect: { progressDelta: 15, logMsg: 'Guides prove trustworthy.' },
        failureEffect: { progressDelta: -5, enemyDelta: 10, logMsg: 'An ambush! The guides were enemy agents.' },
        successText: 'They are genuine. Your advance gains ground.',
        failureText: 'A trap — they led you into an ambush.',
      },
      {
        id: 'refuse',
        label: 'Refuse — trust no one',
        successEffect: { logMsg: 'You advance cautiously, gaining nothing.' },
        successText: 'Slow but safe.',
      },
    ],
  },
  {
    id: 'ambush',
    title: 'Enemy Ambush',
    description: 'Enemy forces strike from cover. Your vanguard takes casualties.',
    options: [
      {
        id: 'counter',
        label: 'Counter-charge (Martial check)',
        skillCheck: { skill: 'martial', difficulty: 6 },
        successEffect: { enemyDelta: -15, logMsg: 'Counter-charge routs the ambushers.' },
        failureEffect: { progressDelta: -12, logMsg: 'Counter-charge fails. Heavy losses.' },
        successText: 'Your men turn the ambush into a rout.',
        failureText: 'The counter-charge is repulsed.',
      },
      {
        id: 'withdraw',
        label: 'Withdraw and regroup',
        successEffect: { progressDelta: -8, logMsg: 'Orderly withdrawal. Casualties light.' },
        successText: 'You pull back with minimal losses.',
      },
      {
        id: 'hold',
        label: 'Hold the line (30 Gold for reserves)',
        goldCost: 30,
        successEffect: { enemyDelta: -10, logMsg: 'Reserves stabilise the line.' },
        successText: 'The reserves push through.',
      },
    ],
  },
  {
    id: 'desertion',
    title: 'Desertion',
    description: 'Weary and underpaid, soldiers are slipping away in the night.',
    options: [
      {
        id: 'pay_bonus',
        label: 'Pay a bonus (40 Gold)',
        goldCost: 40,
        successEffect: { progressDelta: 8, logMsg: 'Bonus pay restores loyalty.' },
        successText: 'The men stay. Morale recovers.',
      },
      {
        id: 'rhetoric',
        label: 'Rally with a speech (Rhetoric check)',
        skillCheck: { skill: 'rhetoric', difficulty: 5 },
        successEffect: { progressDelta: 5, logMsg: 'Your words rouse the troops.' },
        failureEffect: { progressDelta: -15, logMsg: 'The speech falls flat. More desert.' },
        successText: 'Your words cut through their despair.',
        failureText: 'Empty words. The desertions continue.',
      },
      {
        id: 'decimation',
        label: 'Make an example of deserters',
        successEffect: { progressDelta: -5, relationshipDelta: -5, logMsg: 'Brutal but effective.' },
        successText: 'Fear replaces discontent. Desertion stops.',
      },
    ],
  },
  {
    id: 'divine_omen',
    title: 'Divine Omen',
    description: 'An eagle circles the camp at dawn. The haruspex reads it as either auspicious or dire.',
    options: [
      {
        id: 'auspicious',
        label: 'Declare it a good omen (Rhetoric check)',
        skillCheck: { skill: 'rhetoric', difficulty: 4 },
        successEffect: { progressDelta: 12, logMsg: 'The men march with the gods\' blessing.' },
        failureEffect: { progressDelta: -5, logMsg: 'None believe your reading. Morale falls.' },
        successText: 'The legions surge forward, inspired.',
        failureText: 'The men can see through forced optimism.',
      },
      {
        id: 'sacrifice',
        label: 'Order sacrifices (25 Gold)',
        goldCost: 25,
        successEffect: { progressDelta: 10, logMsg: 'The gods are appeased.' },
        successText: 'Proper rites performed. The men are heartened.',
      },
    ],
  },
  {
    id: 'reinforcements',
    title: 'Reinforcements Arrive',
    description: 'The Senate has dispatched additional cohorts to support your campaign.',
    options: [
      {
        id: 'integrate',
        label: 'Integrate immediately',
        successEffect: { progressDelta: 20, logMsg: 'Fresh troops bolster the advance.' },
        successText: 'The new cohorts slot into the line seamlessly.',
      },
      {
        id: 'hold_reserve',
        label: 'Hold in reserve for the decisive moment',
        successEffect: { enemyDelta: -20, logMsg: 'Reserve cohorts crush the enemy at the critical moment.' },
        successText: 'Perfectly timed — the reserve breaks the enemy flank.',
      },
    ],
  },
  {
    id: 'rally_citizens',
    title: 'Citizens Volunteer',
    description: 'Inspired by your defence, local citizens offer to form militia units.',
    options: [
      {
        id: 'arm_them',
        label: 'Arm and deploy them (20 Gold)',
        goldCost: 20,
        successEffect: { progressDelta: 12, relationshipDelta: 5, logMsg: 'Militia holds the walls.' },
        successText: 'The citizens fight bravely for their homes.',
      },
      {
        id: 'keep_safe',
        label: 'Refuse — keep civilians out of it',
        successEffect: { relationshipDelta: 8, logMsg: 'The people are grateful for your protection.' },
        successText: 'Your restraint earns respect.',
      },
    ],
  },
  {
    id: 'civilian_appeal',
    title: 'Civilian Delegation',
    description: 'Local leaders beg you to spare their village from the campaign\'s destruction.',
    options: [
      {
        id: 'grant',
        label: 'Grant their appeal',
        successEffect: { relationshipDelta: 10, logMsg: 'Sparing the village earns goodwill.' },
        successText: 'The village is spared. Local sentiment turns.',
      },
      {
        id: 'deny',
        label: 'Military necessity demands it',
        successEffect: { progressDelta: 8, relationshipDelta: -8, logMsg: 'The village is used as a staging post.' },
        successText: 'Tactical advantage gained at a cost.',
      },
    ],
  },
  {
    id: 'local_intel',
    title: 'Informant Comes Forward',
    description: 'A local informant offers to reveal enemy positions — for a price.',
    options: [
      {
        id: 'pay',
        label: 'Pay the informant (30 Gold)',
        goldCost: 30,
        successEffect: { enemyDelta: -20, logMsg: 'Intelligence exposes the enemy flank.' },
        successText: 'The information is solid — enemy caught off-guard.',
      },
      {
        id: 'extract',
        label: 'Interrogate instead (Intrigus check)',
        skillCheck: { skill: 'intrigus', difficulty: 5 },
        successEffect: { enemyDelta: -15, logMsg: 'Information extracted without payment.' },
        failureEffect: { logMsg: 'The informant reveals nothing useful.' },
        successText: 'You extract the information at no cost.',
        failureText: 'The informant stonewalls you.',
      },
    ],
  },
  {
    id: 'allied_reinforcements',
    title: 'Allied Forces Join',
    description: 'Your client kingdom has sent cavalry to support Rome\'s campaign.',
    options: [
      {
        id: 'integrate',
        label: 'Place them on the vanguard',
        successEffect: { progressDelta: 18, logMsg: 'Allied cavalry smashes through.' },
        successText: 'The allied horse breaks the enemy line.',
      },
      {
        id: 'reserve',
        label: 'Use them to guard supply lines',
        successEffect: { enemyDelta: -10, logMsg: 'Supply lines secured by allied cavalry.' },
        successText: 'Allied forces protect the rear effectively.',
      },
    ],
  },
  {
    id: 'political_complications',
    title: 'Political Interference',
    description: 'A senator — likely a rival — has dispatched a quaestor to "audit" your campaign expenses.',
    options: [
      {
        id: 'cooperate',
        label: 'Cooperate fully (costs 1 season\'s progress)',
        successEffect: { progressDelta: -8, logMsg: 'The audit passes without scandal.' },
        successText: 'Tedious, but above reproach.',
      },
      {
        id: 'delay',
        label: 'Delay and obstruct (Intrigus check)',
        skillCheck: { skill: 'intrigus', difficulty: 5 },
        successEffect: { logMsg: 'The quaestor leaves empty-handed.' },
        failureEffect: { progressDelta: -5, logMsg: 'Obstruction noted. A corruption risk grows.' },
        successText: 'The quaestor is tied in paperwork for months.',
        failureText: 'Your obfuscation is noted and reported.',
      },
    ],
  },
  {
    id: 'supply_surge',
    title: 'Merchant Convoy Arrives',
    description: 'A opportunistic merchant convoy has arrived, offering supplies at (inflated) market rates.',
    options: [
      {
        id: 'buy',
        label: 'Purchase supplies (35 Gold)',
        goldCost: 35,
        successEffect: { progressDelta: 15, logMsg: 'Well-supplied troops advance quickly.' },
        successText: 'The supplies arrive just in time.',
      },
      {
        id: 'seize',
        label: 'Commandeer the convoy (Martial check)',
        skillCheck: { skill: 'martial', difficulty: 4 },
        successEffect: { progressDelta: 15, logMsg: 'Supplies seized by military authority.' },
        failureEffect: { relationshipDelta: -6, logMsg: 'The merchants resist. A scandal brews.' },
        successText: 'Military authority overrides merchant protests.',
        failureText: 'The merchants flee — and spread word of your conduct.',
      },
    ],
  },
];

export function getCampaignEventDef(id: string): CampaignEventDef | undefined {
  return CAMPAIGN_EVENT_DEFS.find(e => e.id === id);
}
