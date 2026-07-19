// ─── Headless War Simulation Harness ─────────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C10 — `simulateWar` runs N
// full Punic wars (264 BC start to either a terminal outcome or the 241 BC
// historical cutoff) with no UI, mirroring `engine/battle/battleSim.ts`'s
// idiom (the M11 tactical-battle harness) at the campaign-map layer. Pure —
// no store/React access. The only production caller is DebugPanel.tsx.
//
// ROMAN ARMY MODEL (confirmed with the user before writing this file): every
// Roman army in the harness is `rome_rival`-owned, never `player`/
// `rome_state`. `campaignResolver.isPlayerManaged` defers any battle
// involving a `player`/`rome_state` army to `pendingEngagements` — headless,
// with no player to click through it, that battle would simply never
// resolve. `rome_rival` armies auto-resolve inline via the abstract resolver
// AND are exactly what `campaignAi.assignNpcRomanOrders` (the plan's own
// "C6 NPC-Roman brain" for the `ai` policy) already drives — reusing it
// untouched. The real Command-grant/election apparatus (which is how a real
// game actually grants `rome_state` armies) is entirely bypassed; Roman
// forces are seeded and reinforced directly, matching the grant's own shape
// (`BALANCE.campaign.command.grantStateCohorts` cohorts, standard muster
// tier, every `termSeasons` seasons) without simulating the election itself.
//
// CONSEQUENCE (documented, not silently absorbed): `rome_rival` armies never
// accrue `unpaidSeasons` — "no NPC economy exists" for that owner (see
// `agendaEngine.ts`'s own comment) — so this harness cannot surface upkeep-
// driven attrition/disbanding as a risk. Target #5 (economy) is verified
// separately, as a direct `armyEngine.upkeepFor` check against a synthetic
// `player`-owned army — see `__tests__/campaignSim.test.ts`'s economy block
// and the plan's own Chunk C10 tuning log for that evidence.
//
// PEACE-MAKING SIMPLIFICATION (documented): the real M10 negotiation flow
// needs a live Senate (tabled bills, votes) for the 'forced' desperation
// tier and any sue-tier offer's Accept/Refuse choice — none of which exists
// in this harness (no bills, no player). Dictate-tier auto-ratify already
// self-resolves inside `processWarSeason` with no vote needed, so it works
// unchanged. A sue-tier `ai_offer` (Rome winning) is instead auto-accepted
// by this harness the moment it appears, using the same
// `classifyTerminalOutcome` classification a real acceptance would produce
// — WITHOUT calling `applyTreatyEffects` (whose denarii/city-cession/
// prisoner-release side effects don't matter to a war that's just ended; no
// future season ever reads them again). A 'forced'-tier treaty is never
// tabled at all (nothing calls the player-only `tableTreaty`) — a war stuck
// at that tier simply keeps running until it either reaches dictate tier,
// the historical 241 BC cutoff, or Rome pulls back into the sue-tier
// auto-accept band. This is a real, if minor, gap in how faithfully the
// harness's war LENGTH distribution mirrors a real playthrough (a real
// player might table forced-tier terms earlier) — noted, not fixed, since
// building a synthetic Senate/bill-vote simulator is well outside this
// chunk's "no engine/store logic changed" scope.
//
// EVENT-DRIVEN MOMENTUM (out of scope): periodic war-flavoured random events
// (`data/warEvents.ts`) nudge momentum in real play via the generic event
// pool (weights, seasons, choices) — an entirely separate system this
// harness doesn't reach into. The harness tests the MAP-DRIVEN war-standing
// dynamics (territory, army balance, battles, weariness), not the event
// economy, which already has its own coverage (`warEngine.test.ts`'s
// `WAR_EVENT_DEFS` content-sanity block, `docs/balance-checks.md` target #5).

import type { Army, ArmyUnit } from '../models/army';
import type { TheatreState } from '../models/theatre';
import type { WarState, WarTerminalOutcome } from '../models/war';
import type { Clan, ClanLeader } from '../models/clan';
import type { CampaignLogEntry } from '../models/campaignLog';
import { BALANCE } from '../data/balance';
import { REGIONS } from '../data/theatreMap';
import { buildInitialCityStates } from '../data/cityDefinitions';
import { getRegionRelationship } from './theatreEngine';
import { resolveCampaignSeason, type CampaignResolutionInput } from './campaignResolver';
import {
  assignCarthaginianOrders, assignNpcRomanOrders,
  shouldReinforceCarthage, applyCarthageReinforcement,
} from './campaignAi';
import { rollMusteredUnit } from './musterEngine';
import { processWarSeason, computeRipeness, classifyTerminalOutcome } from './warEngine';
import { makeSeededRng } from '../utils/seededRng';

export type RomanPolicy = 'idle' | 'ai';

const START_YEAR = -264;
const HISTORICAL_END_YEAR = BALANCE.war.ripeness.historicalEndYear; // 241
const SICILIA_REGION_ID = 'sicilia';
const LATIUM_REGION_ID = 'latium';
// Generous safety net — the real historical span is (264-241)*4 = 92 seasons;
// the 241 BC check (mirrored below) always force-ends the war by then, this
// only guards against a genuine bug looping forever.
const SAFETY_SEASON_CAP = 200;

/** The harness's one synthetic "competent NPC-Roman general" — martial 9
 *  (near the top of the 1-10 scale) plus `conqueror` for
 *  campaignAi.deriveNpcRomanProfile's advance-bonus, so the `ai` policy
 *  actually tests a genuinely aggressive Roman commander, not a mediocre
 *  one. Reused as every Roman army's commanderId throughout a trial — one
 *  standing command, not a rotating cast (this harness has no Cursus/
 *  election apparatus to generate a cast from anyway). */
const COMPETENT_ROMAN_LEADER: ClanLeader = {
  id: 'sim-roman-general', name: 'The Competent General', title: 'Proconsul', emoji: '⚔️', age: 45,
  sphere: 'military', relationship: 0, favour: 0, blackmail: false, bias: 'optimates',
  votes: 0, bio: '', skills: { rhetoric: 5, martial: 9, intrigus: 5 },
  heldOffices: [], currentOffice: null, turnsLeftInOffice: null,
  traits: ['conqueror'],
};
const COMPETENT_ROMAN_CLAN: Clan = {
  id: 'sim-roman-clan', name: 'The Legion', gensName: 'Simulata', sigil: '⚔️', influence: 50,
  desc: '', leaders: [COMPETENT_ROMAN_LEADER],
};

function buildInitialTheatre(): TheatreState {
  const controllers = {} as TheatreState['controllers'];
  const contested = {} as TheatreState['contested'];
  const musteredThisYear = {} as TheatreState['musteredThisYear'];
  for (const region of REGIONS) {
    controllers[region.id] = region.startingController;
    contested[region.id] = 0;
    musteredThisYear[region.id] = 0;
  }
  return { controllers, contested, musteredThisYear };
}

function buildInitialWar(): WarState {
  return {
    id: 'sim-war-carthage', active: true, enemyId: 'carthage', scale: 'major', provinceId: null,
    // Seeded at 0 — engine/warStanding.ts recomputes this fresh from live
    // armies/cities/momentum at the end of the very first season anyway
    // (Chunk C9), so the seed value here is immediately superseded.
    warScore: 0, startedTurn: 1, weariness: 0, enemyWeariness: 0, momentum: 0,
    treaty: null,
    phase: 'opening', ignitedYear: START_YEAR, endedYear: null, terminalOutcome: null,
    peaceOffered: false, lastFundingOfferTurn: -100,
  };
}

/** Carthage's starting garrison — Lilybaeum, "Carthage's fortress" per
 *  theatreMap.ts's own comment — sized/composed to match the same
 *  Command-grant scale (`grantStateCohorts`) Rome's own opening force uses,
 *  so neither side starts with a structural size advantage. `spear_foot`
 *  mirrors `campaignAi.applyCarthageReinforcement`'s own unit-class choice
 *  for Carthage cohorts. */
function buildInitialCarthageArmy(): Army {
  const cohorts = BALANCE.campaign.command.grantStateCohorts;
  const units: ArmyUnit[] = Array.from({ length: cohorts }, (_, i) => ({
    id: `sim-carthage-unit-0-${i}`,
    unitClass: 'spear_foot',
    strength: 100,
    veterancy: 'trained',
    loyalty: 70,
    elephantSteady: false,
    homeRegion: SICILIA_REGION_ID,
    raisedBy: 'npc',
    campaignsSurvived: 0,
    wonCrushingVictory: false,
    raisedSeason: 0,
  }));
  return {
    id: 'sim-carthage-army-0', name: 'The Lilybaeum Garrison', owner: 'carthage',
    commanderId: 'hanno_cautious', location: SICILIA_REGION_ID, stationedCityId: 'lilybaeum',
    units, stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
  };
}

/** Rome's opening force (`ai` policy only — `idle` fields nothing, ever,
 *  matching a real never-mustering/never-electing playthrough, which truly
 *  has zero theatre armies) — exactly `buildGrantUnits`'s real shape
 *  (`rollMusteredUnit('standard', 'latium', ...)` × `grantStateCohorts`),
 *  just issued directly instead of through a simulated election. */
function buildRomanReinforcement(
  cities: ReturnType<typeof buildInitialCityStates>,
  turnNumber: number,
  batchIndex: number,
  rng: () => number,
): Army {
  const cmd = BALANCE.campaign.command;
  const relationship = getRegionRelationship(cities, LATIUM_REGION_ID);
  const units = Array.from({ length: cmd.grantStateCohorts }, (_, i) =>
    rollMusteredUnit('standard', LATIUM_REGION_ID, relationship, turnNumber, `sim-roman-unit-${batchIndex}-${i}`, rng),
  );
  return {
    id: `sim-roman-army-${batchIndex}`, name: `Legio ${batchIndex + 1}`, owner: 'rome_rival',
    commanderId: COMPETENT_ROMAN_LEADER.id, location: LATIUM_REGION_ID, stationedCityId: 'latium',
    units, stance: 'give_battle', ordersThisSeason: null, fatigued: false, unpaidSeasons: 0,
  };
}

export interface WarSimResult {
  /** 'unresolved' only if SAFETY_SEASON_CAP was hit without the war ever
   *  concluding — should never happen in practice (the 241 BC check always
   *  forces a conclusion well before the cap). */
  outcome: NonNullable<WarTerminalOutcome> | 'unresolved';
  warLengthSeasons: number;
  warLengthYears: number;
  finalWarScore: number;
  /** Count of NPC-vs-NPC battles resolved inline across the whole war
   *  (every battle in this harness is inline — see this file's header
   *  comment on the rome_rival ownership choice). */
  battleCount: number;
  /** One sample per season — `resolveCampaignSeason`'s own post-recompute
   *  warScore, i.e. the "standing trajectory" the plan's harness spec asks
   *  for. */
  warScoreSamples: number[];
  romanArmyCountSamples: number[];
  carthageArmyCountSamples: number[];
}

/** Runs one full war from 264 BC to either a terminal outcome or the 241 BC
 *  cutoff, deterministic under `seed`. */
export function simulateOneWar(seed: number, romanPolicy: RomanPolicy): WarSimResult {
  const rng = makeSeededRng(seed);
  let cities = buildInitialCityStates();
  let theatre = buildInitialTheatre();
  const clans: Clan[] = romanPolicy === 'ai' ? [COMPETENT_ROMAN_CLAN] : [];

  let armies: Army[] = [buildInitialCarthageArmy()];
  let wars: WarState[] = [buildInitialWar()];
  let flags: Record<string, boolean | number> = {};
  let year = START_YEAR;
  let seasonIndex = 0;
  let turnNumber = 1;
  let romanBatchIndex = 0;
  let battleCount = 0;
  const warScoreSamples: number[] = [];
  const romanArmyCountSamples: number[] = [];
  const carthageArmyCountSamples: number[] = [];

  if (romanPolicy === 'ai') {
    armies = [...armies, buildRomanReinforcement(cities, turnNumber, romanBatchIndex, rng)];
    romanBatchIndex += 1;
  }

  let seasonsElapsed = 0;
  while (seasonsElapsed < SAFETY_SEASON_CAP) {
    const majorWar = wars.find(w => w.active && w.scale === 'major' && w.enemyId === 'carthage');
    if (!majorWar) break; // already concluded

    // ── Orders ────────────────────────────────────────────────────────────
    const carthageOrders = assignCarthaginianOrders(armies, theatre, cities, seasonIndex, rng);
    const romanOrders = romanPolicy === 'ai'
      ? assignNpcRomanOrders(armies, clans, theatre, cities, seasonIndex, rng)
      : new Map<string, Army['ordersThisSeason']>(); // idle — no orders issued, ever
    armies = armies.map(a => {
      const order = carthageOrders.has(a.id) ? carthageOrders.get(a.id)
        : romanOrders.has(a.id) ? romanOrders.get(a.id)
        : undefined;
      return order === undefined ? a : { ...a, ordersThisSeason: order ?? null };
    });

    // ── Periodic Carthage reinforcement (existing, unchanged mechanic) ────
    if (shouldReinforceCarthage(turnNumber)) {
      armies = applyCarthageReinforcement(armies, turnNumber, `sim-carthage-reinforcement-${turnNumber}`);
    }
    // ── Periodic Roman reinforcement (`ai` only) — same cadence as a real
    // Command's term (`termSeasons`), same grant shape, issued directly. ──
    if (romanPolicy === 'ai' && turnNumber % BALANCE.campaign.command.termSeasons === 0) {
      armies = [...armies, buildRomanReinforcement(cities, turnNumber, romanBatchIndex, rng)];
      romanBatchIndex += 1;
    }

    const newSeasonIndex = (seasonIndex + 1) % 4;
    const crossedNewYear = newSeasonIndex === 0;

    const input: CampaignResolutionInput = {
      armies, theatre: theatre, cities, family: [], clans, denarii: 0,
      seasonIndex, turnNumber, wars, unrestTier: 0, crossedNewYear,
    };
    const resolution = resolveCampaignSeason(input, rng);
    armies = resolution.armies;
    wars = resolution.wars;
    theatre = resolution.theatre;
    cities = resolution.cities;
    battleCount += resolution.log.entries.filter((e: CampaignLogEntry) => e.type === 'battle').length;

    seasonIndex = newSeasonIndex;
    if (crossedNewYear) year += 1;
    turnNumber += 1;

    // ── React to the recomputed warScore (threshold notices, dictate-tier
    // auto-ratify) — same GameState-shaped stub every field of which
    // processWarSeason actually reads (verified by grep), nothing more. ──
    const stubState = {
      family: [], clans, wars, cities, bills: [], passedBills: [],
      flags, optimatesRel: 0, popularesRel: 0, endlessMode: false, turnNumber, year,
    } as unknown as Parameters<typeof processWarSeason>[0];
    const warResult = processWarSeason(stubState, rng);
    wars = warResult.wars;
    flags = { ...flags, ...(warResult.statePatch.flags ?? {}) };

    // ── Sue-tier auto-accept (harness simplification — see header) ────────
    wars = wars.map(w => {
      if (!w.active || w.scale !== 'major' || w.enemyId !== 'carthage') return w;
      if (w.treaty?.stage !== 'ai_offer') return w;
      const outcome = classifyTerminalOutcome(w.warScore, computeRipeness(year), false);
      return { ...w, active: false, terminalOutcome: outcome, endedYear: year };
    });

    // ── 241 BC hard stop (mirrors turnSequencer.ts's step 9d4 exactly) ────
    wars = wars.map(w => {
      if (!w.active || w.scale !== 'major' || w.enemyId !== 'carthage') return w;
      if (Math.abs(year) > HISTORICAL_END_YEAR) return w;
      const outcome = classifyTerminalOutcome(w.warScore, computeRipeness(year), false);
      return { ...w, active: false, terminalOutcome: outcome, endedYear: year };
    });

    const sampledWar = wars.find(w => w.enemyId === 'carthage' && w.scale === 'major');
    warScoreSamples.push(sampledWar?.warScore ?? 0);
    romanArmyCountSamples.push(armies.filter(a => a.owner === 'rome_rival').length);
    carthageArmyCountSamples.push(armies.filter(a => a.owner === 'carthage').length);

    seasonsElapsed += 1;
  }

  const finalWar = wars.find(w => w.enemyId === 'carthage' && w.scale === 'major');
  const outcome = finalWar?.terminalOutcome ?? 'unresolved';
  // Elapsed years = how far `year` has climbed from START_YEAR toward 0
  // (both negative BC years — see the crossedNewYear comment above).
  const elapsedYears = Math.abs(START_YEAR) - Math.abs(year);

  return {
    outcome,
    warLengthSeasons: seasonsElapsed,
    warLengthYears: elapsedYears,
    finalWarScore: finalWar?.warScore ?? 0,
    battleCount,
    warScoreSamples,
    romanArmyCountSamples,
    carthageArmyCountSamples,
  };
}

export interface WarSimAggregate {
  trials: number;
  /** Hit SAFETY_SEASON_CAP without concluding — should be 0. */
  unresolved: number;
  outcomeDistribution: Record<NonNullable<WarTerminalOutcome>, number>;
  /** (humbled + exhaustion) / resolved — target #1's "negative outcome" proxy. */
  negativeOutcomeRate: number;
  /** finalWarScore >= 0 at conclusion, resolved trials only — target #2's
   *  "Victory or a positive treaty" proxy (a positive-but-not-decisive
   *  score classifies as 'exhaustion', not 'victory', but still reads as a
   *  treaty favouring Rome). */
  positiveEndRate: number;
  medianWarLengthYears: number;
  p90WarLengthYears: number;
  /** Median, across trials, of (seasons the war was active / battles fought
   *  that trial) — target #3's cadence proxy. */
  medianSeasonsPerBattle: number;
  avgBattleCount: number;
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor(p * sortedAsc.length));
  return sortedAsc[idx];
}

/** Runs `n` full wars (seeds `seedBase`..`seedBase + n - 1`) under the given
 *  Roman policy and returns aggregate stats — see the plan's Chunk C10
 *  targets #1-3. */
export function simulateWar(romanPolicy: RomanPolicy, n: number, seedBase: number = 1): WarSimAggregate {
  let unresolved = 0;
  const outcomeCounts: Record<NonNullable<WarTerminalOutcome>, number> = { victory: 0, exhaustion: 0, humbled: 0 };
  let positiveEnds = 0;
  const warLengthYears: number[] = [];
  const seasonsPerBattle: number[] = [];
  let totalBattles = 0;

  for (let i = 0; i < n; i++) {
    const result = simulateOneWar(seedBase + i, romanPolicy);
    if (result.outcome === 'unresolved') {
      unresolved += 1;
      continue;
    }
    outcomeCounts[result.outcome] += 1;
    if (result.finalWarScore >= 0) positiveEnds += 1;
    warLengthYears.push(result.warLengthYears);
    totalBattles += result.battleCount;
    if (result.battleCount > 0) seasonsPerBattle.push(result.warLengthSeasons / result.battleCount);
  }

  const resolvedCount = n - unresolved;
  warLengthYears.sort((a, b) => a - b);
  seasonsPerBattle.sort((a, b) => a - b);

  return {
    trials: n,
    unresolved,
    outcomeDistribution: {
      victory: resolvedCount > 0 ? outcomeCounts.victory / resolvedCount : 0,
      exhaustion: resolvedCount > 0 ? outcomeCounts.exhaustion / resolvedCount : 0,
      humbled: resolvedCount > 0 ? outcomeCounts.humbled / resolvedCount : 0,
    },
    negativeOutcomeRate: resolvedCount > 0 ? (outcomeCounts.exhaustion + outcomeCounts.humbled) / resolvedCount : 0,
    positiveEndRate: resolvedCount > 0 ? positiveEnds / resolvedCount : 0,
    medianWarLengthYears: percentile(warLengthYears, 0.5),
    p90WarLengthYears: percentile(warLengthYears, 0.9),
    medianSeasonsPerBattle: percentile(seasonsPerBattle, 0.5),
    avgBattleCount: resolvedCount > 0 ? totalBattles / resolvedCount : 0,
  };
}
