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
import { isDeterred } from './secretEngine';
import { BALANCE } from '../data/balance';

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
  return (state.trials ?? [])
    .filter(t => t.status !== 'resolved')
    .map(trial => {
      const defendant = trial.defendant;
      const defendantName = defendant.kind === 'family'
        ? state.family.find(c => c.id === defendant.characterId)?.name ?? 'your family'
        : state.clans.flatMap(c => c.leaders).find(l => l.id === defendant.leaderId)?.name ?? 'the accused';

      const seasonsRemaining = Math.max(0, trial.startsSeason - state.turnNumber);
      const resolvesThisSeason = seasonsRemaining <= 1;
      const losingAndClose =
        trial.playerPrep.totalStrength < trial.npcStrength && seasonsRemaining <= 2;
      const severity: AgendaSeverity =
        resolvesThisSeason || losingAndClose ? 'critical' : 'warning';

      return {
        id: `agenda-trial-${trial.id}`,
        category: 'trial' as const,
        severity,
        title: trial.seat === 'defense' ? `Trial of ${defendantName}` : `Prosecuting ${defendantName}`,
        detail: `Resolves in ${plural(seasonsRemaining, 'season')}. Your strength ${Math.round(trial.playerPrep.totalStrength)} vs their ${Math.round(trial.npcStrength)}.`,
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
// #17/#18 were reserved here since M4 but couldn't be built until
// WarState/SetPieceOffer existed as live state (M9) — they're defined below
// this one, after the Public API marker's original position, since this
// generator was written first. Fires when Unrest is tier >= 2, the shared
// 'games' slot is unused this year, and the player can afford Fund the
// Ludi — games are a lever the player may not think to reach for.

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

// ─── Generator 17 — Pending set-piece offer (Military Overhaul M9) ──────────
// Reserved since M4 (couldn't be built until WarState/SetPieceOffer were
// actually live state — that only happens in M9). A dedicated, blocking
// SetPieceOfferModal is the primary resolution path; this item is a
// secondary reminder for the AgendaTablet's comprehensive to-do view,
// matching every other generator's role here.

function genPendingSetPiece(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const war of (state.wars ?? [])) {
    if (!war.active || !war.pendingSetPiece) continue;
    items.push({
      id: `agenda-critical-set-piece-${war.id}`,
      category: 'military' as const,
      severity: 'critical',
      title: `The armies will meet at ${war.pendingSetPiece.siteName}`,
      detail: 'Give battle, or decline and let the moment pass.',
      target: { tab: 'Provinciae' as const },
      sortWeight: 0,
    });
  }
  return items;
}

// ─── Generator 18 — Peace threshold reached (Military Overhaul M9) ──────────
// Fires once |warScore| crosses the "sue" threshold for an active war —
// unlocks the negotiation entry point M10 builds (Curia). Framing differs
// by who's winning; the war may still be a long way from a treaty, this is
// just "the option now exists."

function genWarPeaceThreshold(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const war of (state.wars ?? [])) {
    if (!war.active) continue;
    if (Math.abs(war.warScore) < BALANCE.war.thresholds.sue) continue;
    const winning = war.warScore > 0;
    items.push({
      id: `agenda-critical-war-peace-${war.id}`,
      category: 'military' as const,
      severity: 'critical',
      title: winning ? `${capitalize(war.enemyId)} may treat for peace` : `Rome may be forced to terms`,
      detail: winning
        ? `The war has turned decisively enough that ${capitalize(war.enemyId)} may accept terms.`
        : `The war has turned badly enough that terms may soon be forced on Rome.`,
      target: { tab: 'Curia' as const },
      sortWeight: 0,
    });
  }
  return items;
}

// ─── Generator 20 — War status (Phase 3, Chunk P3-B) ────────────────────────
// One line on how the war is going, keyed off WarState.phase (cosmetic —
// see that type's doc comment) and warScore's sign. `warning` once the War
// crisis track is tier ≥ 2, `info` otherwise — mirrors CRISIS_TIER_LABELS'
// own tier-2 cutoff for "the war is now a real strain" framing.

const WAR_PHASE_COPY: Record<string, string> = {
  not_started: 'The war has not yet begun.',
  opening: 'The war is young — too early to call.',
  escalation: 'The war presses on, one side or the other gaining ground.',
  grinding: 'The war has settled into a grinding stalemate.',
  ripe: 'The war has run long enough that its end feels close, one way or another.',
  ended: 'The war is over.',
};

function genWarStatus(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  if (state.endlessMode) return items; // Phase 3, Chunk P3-F — the war is retired.
  for (const war of (state.wars ?? [])) {
    if (!war.active || war.scale !== 'major') continue;
    const warTier = state.crisis.war.tier;
    const leaning = war.warScore > 10 ? ' Rome has the better of it.' : war.warScore < -10 ? ' Rome is losing ground.' : '';
    items.push({
      id: `agenda-war-status-${war.id}`,
      category: 'military' as const,
      severity: warTier >= 2 ? 'warning' : 'info',
      title: `The war with ${capitalize(war.enemyId)}`,
      detail: (WAR_PHASE_COPY[war.phase] ?? WAR_PHASE_COPY.escalation) + leaning,
      target: { tab: 'Curia' as const },
      sortWeight: 40,
    });
  }
  return items;
}

// ─── Generator 21 — Sue-for-peace opportunity (Phase 3, Chunk P3-B) ────────
// Distinct from Generator 18 (genWarPeaceThreshold, Military Overhaul M9):
// #18 fires off the warScore-based desperation tier (the M9/M10 negotiation
// surface); #21 fires off the ripeness/weariness-gated abstract lever this
// chunk adds (WarState.peaceOffered — see warEngine.peaceReachable), which
// can be true independent of warScore's sign. Both can be true at once.

function genSueForPeaceOpportunity(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  if (state.endlessMode) return items; // Phase 3, Chunk P3-F — the war is retired.
  for (const war of (state.wars ?? [])) {
    if (!war.active || war.scale !== 'major' || !war.peaceOffered) continue;
    items.push({
      id: `agenda-critical-sue-for-peace-${war.id}`,
      category: 'military' as const,
      severity: 'critical',
      title: `Sue for peace with ${capitalize(war.enemyId)}?`,
      detail: `The war has worn on long enough that a motion to seek terms now — whatever they may be — can pass the Senate.`,
      target: { tab: 'Curia' as const },
      sortWeight: 0,
    });
  }
  return items;
}

// ─── Generator 22 — Regency in effect (Phase 3, Chunk P3-C) ────────────────
// Fires whenever a regency is active and the heir is within ~2 years of
// majority (BALANCE.succession.regencyMinorAge) — a longer regency doesn't
// need the reminder every season; the income penalty is already visible on
// the resource bar throughout.

function genRegencyInEffect(state: GameState): AgendaItem[] {
  if (!state.regency) return [];
  const heir = state.family.find(c => c.id === state.regency!.heirId);
  if (!heir) return [];
  const yearsToMajority = BALANCE.succession.regencyMinorAge - heir.age;
  if (yearsToMajority > 2) return [];

  const regent = state.family.find(c => c.id === state.regency!.regentId);
  const untilLabel = Math.abs(state.regency.untilYear);
  return [{
    id: 'agenda-warning-regency',
    category: 'family' as const,
    severity: 'warning',
    title: `${regent ? regent.name : 'A regent'} governs in ${heir.name}'s name`,
    detail: `Income is reduced until ${heir.name} comes of age in ${untilLabel} BC.`,
    target: { tab: 'Domus' as const },
    sortWeight: 30,
  }];
}

// ─── Generator 23 — Secret demand pending (Phase 4, Chunk P4-B) ────────────
// Fires while a leader's leverage/extortion demand event awaits an answer
// (pendingSecretDemand is cleared exactly when resolveEvent's special-case
// handler resolves comply/defy — see gameStore.ts/secretEngine.resolveSecretDemand).

function genSecretDemandPending(state: GameState): AgendaItem[] {
  if (!state.pendingSecretDemand) return [];
  const leader = state.clans.flatMap(c => c.leaders).find(l => l.id === state.pendingSecretDemand!.leaderId);
  return [{
    id: 'agenda-secret-demand-pending',
    category: 'family' as const,
    severity: 'critical',
    title: `${leader?.name ?? 'A clan leader'} awaits your answer`,
    detail: 'A demand invoking what they hold on your family is pending — comply or defy it.',
    target: { tab: 'Forum' as const, selectedLeaderId: leader?.id },
    sortWeight: 0,
  }];
}

// ─── Generator 24 — Secret held against family (Phase 4, Chunk P4-B) ──────
// One item per DISCOVERED Secret a leader holds against the family (P4-A's
// npcGatherTick generates them latent/undiscovered — nothing to warn about
// until discovery, per the plan's design). Downgrades to 'info' ("stalemate")
// while a deterrence standoff freezes it — see secretEngine.isDeterred.

function genSecretHeldAgainstFamily(state: GameState): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const secret of state.secrets ?? []) {
    const subject = secret.subject;
    if (secret.holder === 'player' || subject.kind !== 'family') continue;
    if (!secret.discovered || (secret.status !== 'held' && secret.status !== 'extorting')) continue;

    const leader = state.clans.flatMap(c => c.leaders).find(l => l.id === secret.holder);
    const character = state.family.find(c => c.id === subject.characterId);
    const frozen = isDeterred(secret.holder, state.secrets);

    items.push({
      id: `agenda-secret-against-${secret.id}`,
      category: 'family' as const,
      severity: frozen ? 'info' : 'warning',
      title: frozen
        ? `Stalemate with ${leader?.name ?? 'a clan leader'}`
        : `${leader?.name ?? 'A clan leader'} holds leverage on ${character?.name ?? 'your family'}`,
      detail: frozen
        ? 'Stayed by your hand on his own affairs — neither of you can move first.'
        : 'Pay it off or discredit it in the Dossier before he decides to use it.',
      target: { tab: 'Forum' as const, selectedLeaderId: leader?.id },
      sortWeight: frozen ? 30 : 10,
    });
  }
  return items;
}

// ─── Generator 25 — Extortion active (Phase 4, Chunk P4-B) ────────────────
// Info-severity summary of the net per-season Denarii number, both
// directions — one item total, not one per Secret (the Dossier is where
// individual extortions are managed).

function genExtortionActive(state: GameState): AgendaItem[] {
  let income = 0;
  let drain = 0;
  for (const secret of state.secrets ?? []) {
    if (secret.status !== 'extorting') continue;
    if (secret.holder === 'player' && secret.subject.kind === 'leader') {
      income += BALANCE.secrets.extortIncomePerPotency * secret.potency;
    } else if (secret.subject.kind === 'family' && secret.holder !== 'player') {
      drain += BALANCE.secrets.extortIncomePerPotency * secret.potency;
    }
  }
  if (income === 0 && drain === 0) return [];

  const parts: string[] = [];
  if (income > 0) parts.push(`+${income} Denarii/season from what you hold`);
  if (drain > 0) parts.push(`−${drain} Denarii/season to what they hold`);

  return [{
    id: 'agenda-extortion-active',
    category: 'economy' as const,
    severity: 'info',
    title: 'Extortion in progress',
    detail: parts.join('; ') + '.',
    target: { tab: 'Forum' as const },
    sortWeight: 40,
  }];
}

// ─── Generator 26 — Filed prosecution pending (Phase 4, Chunk P4-C) ────────
// Distinct from #1 (which already lists every active trial, both seats,
// urgency-framed): a standing "keep preparing" reminder specifically for
// player-filed prosecutions, opportunity-toned rather than urgency-toned.

function genFiledProsecutionPending(state: GameState): AgendaItem[] {
  return (state.trials ?? [])
    .filter(t => t.status === 'preparing' && t.seat === 'prosecution')
    .map(trial => {
      const defendant = trial.defendant;
      const defendantName = defendant.kind === 'leader'
        ? state.clans.flatMap(c => c.leaders).find(l => l.id === defendant.leaderId)?.name ?? 'the accused'
        : 'the accused';
      const seasonsRemaining = Math.max(0, trial.startsSeason - state.turnNumber);

      return {
        id: `agenda-prosecution-pending-${trial.id}`,
        category: 'trial' as const,
        severity: 'opportunity' as const,
        title: `Your case against ${defendantName} is building`,
        detail: `${plural(seasonsRemaining, 'season')} left to strengthen it before trial.`,
        target: { tab: 'Curia' as const, trialId: trial.id },
        sortWeight: 20,
      };
    });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs all 26 generators against the current state and returns a sorted list
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
    ...genPendingSetPiece(state),
    ...genWarPeaceThreshold(state),
    ...genWarStatus(state),
    ...genSueForPeaceOpportunity(state),
    ...genRegencyInEffect(state),
    ...genSecretDemandPending(state),
    ...genSecretHeldAgainstFamily(state),
    ...genExtortionActive(state),
    ...genFiledProsecutionPending(state),
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
