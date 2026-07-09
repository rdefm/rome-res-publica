// ─── Agenda Engine ────────────────────────────────────────────────────────────
// Pure function: GameState → AgendaItem[].
// No side effects, no store access, no async. Safe to call on every render.
// Each generator is a private function; the public API is at the bottom.

import type { GameState } from '../state/gameStore';
import type { AgendaItem, AgendaSeverity } from '../models/agenda';
import type { CrisisTrackId } from '../models/crisis';
import { SEVERITY_ORDER } from '../models/agenda';
import { OFFICES, TRIBUNE_OFFICE } from '../data/offices';
import { CORRUPTION_TRIAL_THRESHOLD } from './trialEngine';
import { getClanStanding } from './reputationEngine';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';
import { getMunificenceAct } from '../data/munificence';
import { isSlotUsedThisYear, getMunificenceCost } from './munificenceEngine';

// ─── Crisis tier copy ─────────────────────────────────────────────────────────
// Labels and penalty strings sourced directly from the tier tables in
// crisisEngine.ts (WAR_EFFECTS, UNREST_EFFECTS, etc.).
// Do not duplicate balance numbers here — these are narrative descriptions.

const CRISIS_TIER_LABELS: Record<CrisisTrackId, Record<number, string>> = {
  war:          { 2: 'Active Conflict',       3: 'War Crisis',            4: 'Existential Threat'   },
  unrest:       { 2: 'Growing Anger',         3: 'Street Violence',       4: 'Open Revolt'          },
  constitution: { 2: 'Senate Dysfunction',    3: 'Constitutional Crisis', 4: 'Republic in Peril'    },
  economy:      { 2: 'Economic Strain',       3: 'Scarcity Crisis',       4: 'Economic Collapse'    },
};

// One sentence per tier ≥ 2. Derived from fidesDelta / denariDelta / specialEffect
// in crisisEngine.ts tier tables. Update here if crisisEngine values change.
const CRISIS_TIER_PENALTIES: Record<CrisisTrackId, Record<number, string>> = {
  war: {
    2: '−2 Fides per season. Military funding bills are now required.',
    3: '−3 Fides and −5 Denarii per season. Mandatory military funding demanded.',
    4: '−5 Fides and −10 Denarii per season. Rome is at the edge of catastrophe.',
  },
  unrest: {
    2: '−2 Fides per season. Plebs mood decays further each season.',
    3: '−3 Fides per season. Senate sessions risk suspension by mob action.',
    4: '−5 Fides per season. Senate sessions suspended; no legislation advances.',
  },
  constitution: {
    2: 'Bills require extra support to pass; all clan relationships decay faster.',
    3: '−1 Fides per season. Bills face severe passage penalties; trials more likely.',
    4: '−2 Fides per season. Legislation near-impossible; the Republic itself is at stake.',
  },
  economy: {
    2: '−5 Denarii per season. All action costs rise 10%.',
    3: '−8 Denarii per season. All action costs rise 20%; austerity constrains spending.',
    4: '−3 Fides and −12 Denarii per season. All action costs rise 30%; creditors demand payment.',
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Returns a display name for a province id (e.g. 'sardinia_corsica' → 'Sardinia Corsica').
function provinceDisplayName(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Generator 1 — Trial pending ─────────────────────────────────────────────

function genTrials(state: GameState): AgendaItem[] {
  return state.trialQueue
    .filter(t => !t.resolved)
    .map(trial => {
      const accused = state.family.find(c => c.id === trial.accusedCharacterId);
      const resolvesThisSeason = trial.turnsRemaining <= 1;
      const losingAndClose =
        trial.defenseStrength < trial.prosecutionStrength && trial.turnsRemaining <= 2;
      const severity: AgendaSeverity =
        resolvesThisSeason || losingAndClose ? 'critical' : 'warning';

      return {
        id: `agenda-trial-${trial.id}`,
        category: 'trial' as const,
        severity,
        title: `Trial of ${accused?.name ?? 'your family'}`,
        detail: `Resolves in ${plural(trial.turnsRemaining, 'season')}. Defense ${trial.defenseStrength} vs prosecution ${trial.prosecutionStrength}.`,
        target: { tab: 'Curia' as const, trialId: trial.id },
        sortWeight: resolvesThisSeason ? 0 : 10,
      };
    });
}

// ─── Generator 2 — Election ahead ────────────────────────────────────────────

function genElectionAhead(state: GameState): AgendaItem[] {
  if (!state.campaigning) return [];

  const char = state.family.find(c =>
    state.campaigningCharacterId
      ? c.id === state.campaigningCharacterId
      : c.isPlayer
  );
  const charName = char?.name ?? 'Your candidate';

  // lockedFor: count leaders committed to vote for the campaign
  const lockedFor = Object.values(state.campaignVotes ?? {})
    .filter(v => v === 'for').length;

  let severity: AgendaSeverity;
  let sortWeight: number;
  if (state.seasonIndex === 3) {
    severity = 'critical'; sortWeight = 0;    // Winter — election this season
  } else if (state.seasonIndex === 2) {
    severity = 'warning';  sortWeight = 10;   // Autumn — one season to go
  } else {
    severity = 'info';     sortWeight = 20;   // Spring/Summer — time remains
  }

  const officeName =
    OFFICES.find(o => o.id === state.campaigning)?.name ??
    (state.campaigning === TRIBUNE_OFFICE.id ? TRIBUNE_OFFICE.name : null) ??
    state.campaigning ??
    'office';

  return [{
    id: `agenda-election-${state.campaigningCharacterId ?? 'player'}`,
    category: 'election' as const,
    severity,
    title: `${charName}'s campaign for ${officeName}`,
    detail: `Locked votes: ${lockedFor}. Canvass leaders in the Forum before Winter.`,
    target: { tab: 'Forum' as const },
    sortWeight,
  }];
}

// ─── Generator 3 — Election opportunity ──────────────────────────────────────
// Fires Spring/Summer only. Picks one item: the highest office any family
// member is currently eligible for and hasn't yet held.
//
// Held-offices note: state.heldOffices tracks the PLAYER character's held
// offices. Non-player family members do not have a heldOffices array in
// Character (the field lives on ClanLeader, not Character). For non-player
// members we check age only; prerequisite eligibility is not enforced.

function genElectionOpportunity(state: GameState): AgendaItem[] {
  if (state.seasonIndex > 1) return [];  // Autumn/Winter — too late to prepare
  if (state.campaigning) return [];       // already campaigning

  // All offices on the standard cursus, excluding Dictator (crisis-only)
  const cursusOffices = OFFICES.filter(o => o.id !== 'dictator');

  let bestOfficeIndex = -1;
  let bestOffice: (typeof OFFICES)[0] | null = null;
  let bestChar: GameState['family'][0] | null = null;

  for (const member of state.family) {
    const isPlayer = member.isPlayer;
    const memberHeld: string[] = isPlayer
      ? state.heldOffices
      : (member as any).heldOffices ?? [];

    for (let i = 0; i < cursusOffices.length; i++) {
      const office = cursusOffices[i];

      // Already held
      if (memberHeld.includes(office.id)) continue;
      // Age gate
      if ((member.age ?? 0) < office.minAge) continue;
      // Prerequisite gate — only enforced when heldOffices is available
      if (office.prerequisite) {
        // For players, check state.heldOffices; for others, skip the check
        if (isPlayer && !state.heldOffices.includes(office.prerequisite)) continue;
        if (!isPlayer && memberHeld.length > 0 && !memberHeld.includes(office.prerequisite)) continue;
      }
      // Currently holding an office already (no double-campaigning)
      if (isPlayer && state.currentOffice) continue;
      if (!isPlayer && (member as any).officeId) continue;

      if (i > bestOfficeIndex) {
        bestOfficeIndex = i;
        bestOffice = office;
        bestChar = member;
      }
    }
  }

  if (!bestOffice || !bestChar) return [];

  return [{
    id: `agenda-opportunity-${bestOffice.id}`,
    category: 'election' as const,
    severity: 'opportunity',
    title: `${bestChar.name} could stand for ${bestOffice.name}`,
    detail: `Declare a campaign in the Cursus; elections resolve in Winter.`,
    target: { tab: 'Cursus' as const, selectedCharacterId: bestChar.id },
    sortWeight: 20,
  }];
}

// ─── Generator 4 — Senate idle ────────────────────────────────────────────────
// Reads from flags['seasonsSinceLastBillPassed'] — maintained by turnSequencer.
// We do not add a parallel top-level field (D1 decision — counter already exists).

function genSenateIdle(state: GameState): AgendaItem[] {
  const n = (state.flags['seasonsSinceLastBillPassed'] as number | undefined) ?? 0;
  if (n < 1) return [];

  return [{
    id: 'agenda-senate-idle',
    category: 'legislation' as const,
    severity: n >= 2 ? 'critical' : 'warning',
    title: `The Senate has passed nothing for ${plural(n, 'season')}`,
    detail: 'Crisis escalates when no bills pass. Any bill will do.',
    target: { tab: 'Curia' as const },
    sortWeight: n >= 2 ? 0 : 10,
  }];
}

// ─── Generator 5 — Bill expiring ─────────────────────────────────────────────

function genBillsExpiring(state: GameState): AgendaItem[] {
  return (state.bills ?? [])
    .filter(b => b.turnsLeft === 1 && b.support <= 0)
    .map(b => ({
      id: `agenda-bill-expiring-${b.id}`,
      category: 'legislation' as const,
      severity: 'warning' as const,
      title: `${b.name} is failing`,
      detail: `Expires this season at ${b.support} support.`,
      target: { tab: 'Curia' as const, billId: b.id },
      sortWeight: 0,
    }));
}

// ─── Generator 6 — Crisis track hot ──────────────────────────────────────────

function genCrisisHot(state: GameState): AgendaItem[] {
  const tracks: CrisisTrackId[] = ['war', 'unrest', 'constitution', 'economy'];
  const items: AgendaItem[] = [];

  for (const trackId of tracks) {
    const track = state.crisis[trackId];
    if (track.tier < 2) continue;

    const severity: AgendaSeverity = track.tier >= 3 ? 'critical' : 'warning';
    // Prefer the named crisis string already computed by getNamedCrisis in turnSequencer;
    // fall back to the tier label table when null (e.g. war track with no hostile province).
    const title = track.namedCrisis ?? CRISIS_TIER_LABELS[trackId][track.tier] ?? capitalize(trackId);
    const detail = CRISIS_TIER_PENALTIES[trackId][track.tier] ?? `Tier ${track.tier} crisis active.`;

    items.push({
      id: `agenda-crisis-${trackId}`,
      category: 'crisis' as const,
      severity,
      title,
      detail,
      target: { tab: 'Curia' as const },
      sortWeight: track.tier >= 3 ? 0 : 10,
    });
  }

  return items;
}

// ─── Generator 7 — Corruption exposure ───────────────────────────────────────
// Warns when corruptionScore is within 10 points of CORRUPTION_TRIAL_THRESHOLD.
// Severity upgrades to critical when a hostile clan is present (trial possible now).

function genCorruptionExposure(state: GameState): AgendaItem[] {
  const nearThreshold = CORRUPTION_TRIAL_THRESHOLD - 10;
  const hasHostileClan = state.clans.some(
    c => getClanStanding(c.id, state.familyReputations, state.electionRivals) === 'hostile'
  );
  const items: AgendaItem[] = [];

  for (const member of state.family) {
    const score = (member as any).corruptionScore ?? 0;
    if (score <= nearThreshold) continue;

    const severity: AgendaSeverity = hasHostileClan ? 'critical' : 'warning';

    items.push({
      id: `agenda-corruption-${member.id}`,
      category: 'family' as const,
      severity,
      title: `${member.name} is exposed`,
      detail: `Corruption ${score}. A hostile clan could bring charges.`,
      target: { tab: 'Domus' as const, selectedCharacterId: member.id },
      sortWeight: score > CORRUPTION_TRIAL_THRESHOLD ? 0 : 10,
    });
  }

  return items;
}

// ─── Generator 8 — Office term ending ────────────────────────────────────────
// officeSeasons is decremented at the start of each processSeason call.
// When it reaches 0 the term ends. officeSeasons === 1 means this is the
// last season — the bonus disappears when the player clicks End Season.

function genOfficeTerm(state: GameState): AgendaItem[] {
  if (!state.currentOffice || state.officeSeasons !== 1) return [];

  const office = OFFICES.find(o => o.id === state.currentOffice);
  const player = state.family.find(c => c.isPlayer);

  return [{
    id: `agenda-office-term-${state.currentOffice}`,
    category: 'office' as const,
    severity: 'info',
    title: `${player?.name ?? 'Your'}'s term as ${office?.name ?? state.currentOffice} ends`,
    detail: 'Passive Fides bonus ends with it.',
    target: { tab: 'Cursus' as const },
    sortWeight: 0,
  }];
}

// ─── Generator 9 — Coming of age ──────────────────────────────────────────────
// The yearly aging tick fires at the Winter→Spring transition (crossedNewYear).
// We check age === 17 (will be 18 — Vigintivirate threshold) or
//           age === 29 (will be 30 — Quaestor and above threshold).

function genComingOfAge(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const member of state.family) {
    const age = member.age ?? 0;
    if (age !== 17 && age !== 29) continue;

    const newAge = age + 1;
    items.push({
      id: `agenda-coming-of-age-${member.id}`,
      category: 'family' as const,
      severity: 'opportunity',
      title: `${member.name} comes of age this year`,
      detail: `New offices open at ${newAge}. Consider their path on the Cursus.`,
      target: { tab: 'Domus' as const, selectedCharacterId: member.id },
      sortWeight: 20,
    });
  }

  return items;
}

// ─── Generator 10 — Ambition expiring ────────────────────────────────────────
// Note: getAmbitionDefinition from ambitionEngine is NOT imported here because
// gameStore lazy-requires ambitionEngine to break a circular dependency.
// We use the definitionId directly for the title — readable enough for the tablet.

function genAmbitionsExpiring(state: GameState): AgendaItem[] {
  return (state.ambitions ?? [])
    .filter(a =>
      a.status === 'active' &&
      typeof a.turnsRemaining === 'number' &&
      a.turnsRemaining <= 2
    )
    .map(a => ({
      id: `agenda-ambition-${a.definitionId}`,
      category: 'family' as const,
      severity: 'warning' as const,
      title: `Ambition at risk: ${a.definitionId.replace(/-/g, ' ')}`,
      detail: `${plural(a.turnsRemaining!, 'season')} left. Failure carries consequences.`,
      target: { tab: 'Domus' as const },
      sortWeight: a.turnsRemaining! <= 1 ? 0 : 10,
    }));
}

// ─── Generator 11 — Rome stat emergency ──────────────────────────────────────
// Thresholds from game-manual.md: plebs < 20, treasury < 10, stability < 20.
// Detail text references the per-season penalty each condition causes.

function genRomeStatEmergency(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  const { plebs, treasury, stability } = state.rome;

  if (plebs < 20) {
    items.push({
      id: 'agenda-rome-plebs',
      category: 'economy' as const,
      severity: 'critical',
      title: 'Plebs are rioting',
      detail: 'Unrest escalates faster and Fides income suffers while plebs mood remains below 20.',
      target: { tab: 'Curia' as const },
      sortWeight: 0,
    });
  }

  if (treasury < 10) {
    items.push({
      id: 'agenda-rome-treasury',
      category: 'economy' as const,
      severity: 'critical',
      title: 'Treasury is bankrupt',
      detail: 'Economy crisis escalates and Denarii income suffers while treasury remains below 10.',
      target: { tab: 'Curia' as const },
      sortWeight: 0,
    });
  }

  if (stability < 20) {
    items.push({
      id: 'agenda-rome-stability',
      category: 'crisis' as const,
      severity: 'critical',
      title: 'Rome is unstable',
      detail: 'Fides income suffers and crisis escalation is multiplied while stability remains below 20.',
      target: { tab: 'Curia' as const },
      sortWeight: 0,
    });
  }

  return items;
}

// ─── Generator 12 — Senate response ──────────────────────────────────────────

function genSenateResponse(state: GameState): AgendaItem[] {
  if (!state.senateResponse) return [];

  // phase: 'debate' | 'censure' | 'hostis' | 'consular_army' | null
  // Typed via SenateResponseState, resolved through GameState — no cast needed.
  const phase = state.senateResponse.phase ?? 'Active';

  return [{
    id: 'agenda-senate-response',
    category: 'military' as const,
    severity: 'critical',
    title: 'The Senate moves against your legions',
    detail: `Phase: ${phase}. Disband or legitimise before the consular army marches.`,
    target: { tab: 'Provinciae' as const },
    sortWeight: 0,
  }];
}

// ─── Generator 13 — Governor idle ────────────────────────────────────────────
// Fires when an incorporated province has no player governor and a family
// member has held Praetor or Consul (the eligibility requirement per game-manual).

function genGovernorIdle(state: GameState): AgendaItem[] {
  // Build list of eligible governors from family
  const eligibleGovernors = state.family.filter(member => {
    const held: string[] = member.isPlayer
      ? state.heldOffices
      : (member as any).heldOffices ?? [];
    return held.includes('praetor') || held.includes('consul');
  });

  if (eligibleGovernors.length === 0) return [];

  const items: AgendaItem[] = [];

  for (const province of (state.provinces ?? [])) {
    if (province.status !== 'incorporated') continue;
    if (province.playerGovernor) continue;

    const char = eligibleGovernors[0];
    items.push({
      id: `agenda-governor-idle-${province.id}`,
      category: 'province' as const,
      severity: 'opportunity',
      title: `${provinceDisplayName(province.id)} lacks a governor`,
      detail: `${char.name} is eligible. Governorships are the road to wealth.`,
      target: { tab: 'Provinciae' as const, provinceId: province.id },
      sortWeight: 20,
    });
  }

  return items;
}

// ─── Generator 14 — Housekeeping ─────────────────────────────────────────────

function genHousekeeping(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];

  if (state.pendingBirthNaming) {
    items.push({
      id: 'agenda-housekeeping-birth',
      category: 'housekeeping' as const,
      severity: 'info',
      title: 'Household matters await',
      detail: 'A birth to name.',
      target: { tab: 'Domus' as const },
      sortWeight: 10,
    });
  }

  if ((state.pendingAmbitionScopes ?? []).length > 0) {
    items.push({
      id: 'agenda-housekeeping-ambition',
      category: 'housekeeping' as const,
      severity: 'info',
      title: 'Household matters await',
      detail: 'A new ambition to choose.',
      target: { tab: 'Domus' as const },
      sortWeight: 10,
    });
  }

  return items;
}

// ─── Generator 15 — Patron Tier proximity (P2-B) ─────────────────────────────
// Fires when Lifetime Dignitas is within 15 points of the next Patron Tier
// threshold. Laudationes, Munificence acts (P2-F), and legacy milestones all
// convert into Lifetime Dignitas, closing the gap.

function genPatronTierProximity(state: GameState): AgendaItem[] {
  const patronTier = state.patronTier ?? 0;
  if (patronTier >= 5) return [];  // already at max tier

  const nextTierDef = PATRON_TIER_DEFINITIONS[patronTier + 1];
  const remaining = nextTierDef.requiresDignitasTotal - (state.lifetimeDignitas ?? 0);
  if (remaining > 15 || remaining <= 0) return [];

  return [{
    id: `agenda-opportunity-patron-tier-${nextTierDef.tier}`,
    category: 'family' as const,
    severity: 'opportunity',
    title: 'The next rung is close',
    detail: `${remaining} Lifetime Dignitas to ${nextTierDef.label}. Laudationes, munificence, and legacy milestones close the gap.`,
    target: { tab: 'Forum' as const },
    sortWeight: 20,
  }];
}

// ─── Generator 16 — Aging bonded leader (P2-D) ───────────────────────────────
// Fires for any marriage- or alliance-anchored leader aged >= 70: a successor
// does not inherit the bond, so it's worth cultivating a second friendship in
// the clan before mortality takes it.

function genAgingBondedLeader(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const clan of state.clans) {
    for (const leader of clan.leaders) {
      if ((leader.married || leader.alliance) && leader.age >= 70) {
        items.push({
          id: `agenda-warning-aging-leader-${leader.id}`,
          category: 'family' as const,
          severity: 'warning',
          title: `${leader.name} grows old`,
          detail: `His heir will not inherit your bond. Prepare a second friendship in the ${clan.name}.`,
          target: { tab: 'Forum' as const, selectedLeaderId: leader.id, expandedClanId: clan.id },
          sortWeight: 20,
        });
      }
    }
  }
  return items;
}

// ─── Generator 19 — Munificence games opportunity (P2-F) ────────────────────
// #17/#18 are reserved by the military overhaul plan. Fires when Unrest is
// tier >= 2, the shared 'games' slot is unused this year, and the player can
// afford Fund the Ludi — games are a lever the player may not think to reach for.

function genMunificenceGamesOpportunity(state: GameState): AgendaItem[] {
  if (state.crisis.unrest.tier < 2) return [];

  const act = getMunificenceAct('fund-the-ludi');
  if (!act) return [];
  if (isSlotUsedThisYear(state.munificenceUsage ?? {}, 'games')) return [];

  const cost = getMunificenceCost(state, act);
  if (state.denarii < cost.denarii) return [];

  return [{
    id: 'agenda-opportunity-munificence-games',
    category: 'crisis' as const,
    severity: 'opportunity',
    title: 'The city wants games',
    detail: 'Bread quiets a street; games quiet a city. The unrest would ease.',
    target: { tab: 'Curia' as const },
    sortWeight: 20,
  }];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all 17 generators against the current state and returns a sorted list
 * of agenda items. Sort order: severity (critical first) → sortWeight →
 * category (alpha tiebreak for stable ordering).
 *
 * The UI is responsible for truncating the list (show top 6, expand for more).
 * The engine returns the full list — never truncates.
 */
export function generateAgenda(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [
    ...genTrials(state),
    ...genElectionAhead(state),
    ...genElectionOpportunity(state),
    ...genSenateIdle(state),
    ...genBillsExpiring(state),
    ...genCrisisHot(state),
    ...genCorruptionExposure(state),
    ...genOfficeTerm(state),
    ...genComingOfAge(state),
    ...genAmbitionsExpiring(state),
    ...genRomeStatEmergency(state),
    ...genSenateResponse(state),
    ...genGovernorIdle(state),
    ...genHousekeeping(state),
    ...genPatronTierProximity(state),
    ...genAgingBondedLeader(state),
    ...genMunificenceGamesOpportunity(state),
  ];

  return items.sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byWeight = a.sortWeight - b.sortWeight;
    if (byWeight !== 0) return byWeight;
    return a.category.localeCompare(b.category); // stable tiebreak
  });
}

/** Convenience: only critical items. Used by EndSeasonButton interceptor (P1-C). */
export function getCriticalItems(state: GameState): AgendaItem[] {
  return generateAgenda(state).filter(i => i.severity === 'critical');
}

/** Count of critical + warning items. Drives the AgendaBadge chip (P1-C). */
export function getAgendaBadgeCount(state: GameState): number {
  return generateAgenda(state).filter(
    i => i.severity === 'critical' || i.severity === 'warning'
  ).length;
}
