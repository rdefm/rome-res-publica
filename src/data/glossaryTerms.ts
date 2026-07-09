import type { TabName } from '../models/agenda';

// ─── Glossary term ────────────────────────────────────────────────────────────

export interface GlossaryTerm {
  id: string;
  term: string;
  /** ≤ 2 sentences. Plain language. Sourced from game-manual.md. No markdown. */
  definition: string;
  relatedTab?: TabName;
}

// ─── Term list ────────────────────────────────────────────────────────────────
// ~41 terms. Sorted alphabetically by term for the Tabularium display.
// All definitions sourced strictly from game-manual.md.

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'aedile',
    term: 'Aedile',
    definition: 'The second elected office on the Cursus Honorum. Provides +5 Fides per season and requires having previously held the Quaestor.',
    relatedTab: 'Cursus',
  },
  {
    id: 'ambition',
    term: 'Ambitions',
    definition: 'Medium-term goals for your family (Family scope) or a specific character (Character scope), each with a time limit. Meet the condition to earn a reward; fail and consequences apply.',
    relatedTab: 'Domus',
  },
  {
    id: 'ambassador',
    term: 'Ambassador',
    definition: 'A family member posted to a province without governor authority. Ambassadors build rapport, gather intelligence, recruit provincial clients, and arrange cultural exchanges — one action per season.',
    relatedTab: 'Provinciae',
  },
  {
    id: 'campaign',
    term: 'Campaign (Election)',
    definition: 'A declared intention to stand for a specific office, set in the Cursus tab during Spring or Summer. Only one family member can campaign at a time; elections resolve in Winter.',
    relatedTab: 'Cursus',
  },
  {
    id: 'censor',
    term: 'Censor',
    definition: 'A senior magistracy giving power over the census rolls and public contracts. Requires having held the Consulship and serves a multi-season term.',
    relatedTab: 'Cursus',
  },
  {
    id: 'client',
    term: 'Clients',
    definition: 'Dependants in your network who provide passive bonuses each season. Muscle aids trials; Public Support raises Fides income; Voting Sway adds +1 vote per client in elections.',
    relatedTab: 'Forum',
  },
  {
    id: 'consul',
    term: 'Consul',
    definition: 'The highest regular office on the Cursus Honorum, providing +12 Fides per season. Two consuls serve simultaneously; your election may be contested and the result challenged.',
    relatedTab: 'Cursus',
  },
  {
    id: 'corruption',
    term: 'Corruption',
    definition: 'A score (0–100) that accumulates when a character governs at high taxation or takes corrupt actions. Above 60, hostile clans may initiate a corruption trial.',
    relatedTab: 'Curia',
  },
  {
    id: 'crisis-constitution',
    term: 'Crisis — Constitution',
    definition: 'Rising from vetoes, contested elections, and aggressive use of extraordinary offices. At tier 2 and above, bills require extra Senate support to pass and clan relationships decay faster each season.',
    relatedTab: 'Curia',
  },
  {
    id: 'crisis-economy',
    term: 'Crisis — Economy',
    definition: 'Rising from low Treasury and sustained debt. At tier 2 and above, all action costs rise 10% and Denarii income suffers a penalty each season.',
    relatedTab: 'Curia',
  },
  {
    id: 'crisis-tracks',
    term: 'Crisis Tracks',
    definition: 'Four independent pressures on the Republic — War, Unrest, Constitution, Economy — each running 0–100. Higher tiers impose resource penalties each season; passing legislation is the primary way to reduce them.',
    relatedTab: 'Curia',
  },
  {
    id: 'crisis-unrest',
    term: 'Crisis — Unrest',
    definition: 'Rising from low Plebs mood and economic pressure. At tier 3 and above, Senate sessions risk suspension by mob action, blocking legislation until the crisis falls.',
    relatedTab: 'Curia',
  },
  {
    id: 'crisis-war',
    term: 'Crisis — War',
    definition: 'Rising from provincial conflict and military neglect. At tier 2 and above, Fides penalties apply each season and military funding bills become required.',
    relatedTab: 'Curia',
  },
  {
    id: 'cursus-honorum',
    term: 'Cursus Honorum',
    definition: 'The ladder of public offices — Vigintivirate, Quaestor, Aedile, Praetor, Consul — each requiring the previous to have been held. Higher offices yield more passive Fides income and unique powers.',
    relatedTab: 'Cursus',
  },
  {
    id: 'denarii',
    term: 'Denarii',
    definition: 'Hard cash used for purchasing assets, diplomatic dinners, provincial development, and raising troops. Income comes from owned assets and province gold output each season.',
    relatedTab: 'Domus',
  },
  {
    id: 'development',
    term: 'Development (Governor Policy)',
    definition: 'A governor policy axis controlling infrastructure investment. Higher settings improve provincial relationships over time but provide no short-term gold return.',
    relatedTab: 'Provinciae',
  },
  {
    id: 'dictator',
    term: 'Dictator',
    definition: 'An emergency appointment granting supreme authority for a fixed term. Overstaying the crisis that justified it triggers escalating Senate response events.',
    relatedTab: 'Cursus',
  },
  {
    id: 'election',
    term: 'Elections',
    definition: 'Resolved in Winter at the end of the season. Vote totals reflect actions taken during the preceding seasons — canvassing, speeches, client sway, and faction relationships.',
    relatedTab: 'Cursus',
  },
  {
    id: 'fides',
    term: 'Fides',
    definition: 'Your family\'s credibility in Roman society, spent on almost every meaningful action — Senate votes, speeches, and diplomatic ties. Income each season depends on your paterfamilias\'s Rhetoric skill, offices held, Patron Tier, clients, and assets.',
    relatedTab: 'Forum',
  },
  {
    id: 'fides-income',
    term: 'Fides Income',
    definition: 'Fides earned each season: paterfamilias Rhetoric × 2 × Patron multiplier, plus office bonus, clan relationships, clients, and assets, minus any active crisis penalty.',
    relatedTab: 'Forum',
  },
  {
    id: 'governor-policy',
    term: 'Governor Policy',
    definition: 'Three axes — Taxation, Security, Development — set once per season by a province\'s governor. Each axis controls gold extraction, Imperium generation, or infrastructure growth; changes take effect at the next season end.',
    relatedTab: 'Provinciae',
  },
  {
    id: 'imperium',
    term: 'Imperium',
    definition: 'Military authority earned by governing provinces at higher Security settings, modified by the governor\'s Martial skill. Tracks your family\'s cumulative military presence and affects Senate perception.',
    relatedTab: 'Provinciae',
  },
  {
    id: 'intrigus',
    term: 'Intrigus',
    definition: 'A character skill (0–10) providing corruption resistance, intelligence gathering effectiveness, and trial defense capability. Used in skill checks for covert actions and events.',
    relatedTab: 'Domus',
  },
  {
    id: 'legatum',
    term: 'Legatum',
    definition: 'Four permanent legacy objectives tracking long-term achievements across generations. Reaching milestone thresholds unlocks permanent income bonuses and traits that persist between characters.',
    relatedTab: 'Domus',
  },
  {
    id: 'lifetime-dignitas',
    term: 'Lifetime Dignitas',
    definition: 'A permanent, never-spent prestige score that gates your Patron Tier. Unlike other resources it only rises — certain catastrophic events can reduce it, but normal resource spending cannot.',
    relatedTab: 'Forum',
  },
  {
    id: 'martial',
    term: 'Martial',
    definition: 'A character skill (0–10) determining officer performance in campaigns, governor Imperium yield, and the outcome of Martial-checked events and office actions.',
    relatedTab: 'Domus',
  },
  {
    id: 'optimates',
    term: 'Optimates',
    definition: 'The conservative senatorial aristocracy. Your Optimates relationship affects legislation support and NPC decision-making; you cannot fully please both factions simultaneously.',
    relatedTab: 'Forum',
  },
  {
    id: 'patron-actions',
    term: 'Patron Actions',
    definition: 'Actions unlocked at each Patron Tier for leveraging your client network — from Sponsor Client (Tier 1) to Dictate Alliance (Tier 5). Higher-tier actions affect increasingly powerful targets.',
    relatedTab: 'Forum',
  },
  {
    id: 'patron-tier',
    term: 'Patron Tier',
    definition: 'Your family\'s social standing in six tiers, from Client Family (Tier 0) to Prince of the Republic (Tier 5), gated by Lifetime Dignitas alone — spending Fides can never cost you a tier. Higher tiers multiply Fides income, expand client slots, and unlock diplomatic patron actions.',
    relatedTab: 'Forum',
  },
  {
    id: 'populares',
    term: 'Populares',
    definition: 'The popular faction — champions of the plebs, tribal assembly, and reform. Your Populares relationship improves uncanvassed vote probability in elections and bill support for populist legislation.',
    relatedTab: 'Forum',
  },
  {
    id: 'praetor',
    term: 'Praetor',
    definition: 'The third office on the Cursus Honorum. Provides +7 Fides per season and makes a family member eligible to govern a province as legate.',
    relatedTab: 'Cursus',
  },
  {
    id: 'quaestor',
    term: 'Quaestor',
    definition: 'The first elected office on the Cursus Honorum, open at age 30. Provides +3 Fides per season while in office.',
    relatedTab: 'Cursus',
  },
  {
    id: 'rhetoric',
    term: 'Rhetoric',
    definition: 'A character skill (0–10) that drives your paterfamilias\'s Fides income formula and determines speech success chance in the Senate. The single most impactful early-game stat to train.',
    relatedTab: 'Domus',
  },
  {
    id: 'rome-plebs',
    term: 'Rome — Plebs',
    definition: 'A macro stat (0–100) tracking the urban population\'s mood. Low Plebs accelerates Unrest crisis and reduces Fides income; raised by grain distributions and populist legislation.',
    relatedTab: 'Curia',
  },
  {
    id: 'rome-stability',
    term: 'Rome — Stability',
    definition: 'A macro stat (0–100) that amplifies crisis escalation when low and reduces Fides income. Raised primarily by passing legislation and maintaining public order.',
    relatedTab: 'Curia',
  },
  {
    id: 'rome-treasury',
    term: 'Rome — Treasury',
    definition: 'A macro stat (0–100) affecting bill support and Denarii income. Below 10 it becomes Bankrupt, imposing −3 Denarii per season and triggering automatic crisis legislation.',
    relatedTab: 'Curia',
  },
  {
    id: 'season',
    term: 'Season (Turn)',
    definition: 'The game\'s turn unit. Each season you take actions across all five tabs, then press End Season. Four seasons make one in-game year; elections resolve in Winter and aging occurs at year\'s end.',
  },
  {
    id: 'security',
    term: 'Security (Governor Policy)',
    definition: 'A governor policy axis controlling military presence. Higher settings generate Imperium and reduce revolt risk but increase Senate scrutiny of the forces maintained.',
    relatedTab: 'Provinciae',
  },
  {
    id: 'taxation',
    term: 'Taxation (Governor Policy)',
    definition: 'A governor policy axis controlling gold extraction from a province. Higher settings multiply gold income but damage provincial relationships and add corruption to the governor each season.',
    relatedTab: 'Provinciae',
  },
  {
    id: 'trial',
    term: 'Trial',
    definition: 'A legal proceeding brought by a hostile clan against a family member, lasting several seasons. You take defense actions each season; outcomes range from Acquitted to Executed.',
    relatedTab: 'Curia',
  },
  {
    id: 'tribune',
    term: 'Tribune of the Plebs',
    definition: 'A parallel office outside the Cursus Honorum providing sacrosanctity (trial immunity) and veto power over Senate proceedings. Compatible with holding a Cursus office simultaneously.',
    relatedTab: 'Cursus',
  },
  {
    id: 'vigintivirate',
    term: 'Vigintivirate',
    definition: 'The entry-level magistracy, open at age 18. Completing the Board of Twenty is the first formal step in political life, though its direct resource bonus is limited.',
    relatedTab: 'Cursus',
  },
];
