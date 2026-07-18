import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import type { CrisisTrackId } from '../models/crisis';
import type { Bill } from '../models/bill';
import type { TroopUnit } from '../models/troop';
import {
  calcResourceIncome,
  applyEffectString,
  applyFactionDrift,
  calcRomeStats,
  calcRomeStatModifiers,
} from './resourceEngine';
import {
  calcIndividualEscalation,
  calcCascadeDeltas,
  applyTrackDelta,
  getNamedCrisis,
  checkMilitaryBillPressure,
} from './crisisEngine';
import { getTierFromLevel } from '../models/crisis';
import { tickNpcCareers, resolveElection } from './electionEngine';
import { pickRandomEvent, evalCondition, injectNoticeEvent } from './eventEngine';
import { applyYearlyRelationshipDecay, ageAndProcessMortality } from './reputationEngine';
import { tickAmbitions, getAmbitionDefinition } from './ambitionEngine';
import { incrementLegacy, computeLegacyBonuses } from './legacyEngine';
import {
  isBirthEligible,
  calcBirthProbability,
  resolveInheritedTraits,
  suggestChildName,
  needsSpouse,
  generateSpouse,
  rollsDead,
  detectPaterfamiliasDeath,
} from './inheritanceEngine';
import { resolveDeathNotice } from '../data/cadetEvents';
import {
  shouldTriggerTrial,
  buildTrialState,
  computeOpponentPrepGrowth,
  computeJuryLean,
  findOpponentLeader,
  tickCorruption,
  tickLeaderCorruption,
} from './trialEngine';
import { drawTrialBeats } from './trialBeatEngine';
import { TRIAL_BEATS } from '../data/trialBeats';
import { TRIAL_CHARGE_DEFS } from '../data/trialCharges';
import type { TrialState } from '../models/trial';
import { computePatronTier, processFavourCallIns } from './patronEngine';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';
import { BALANCE } from '../data/balance';
import { computeTotalAssetBonuses } from './assetEngine';
import { computeHouseBonuses } from './houseEngine';
import { tickAllCities } from './cityEngine';
import { applyTroopAttrition, calcMilitaryImperium } from './troopEngine';
import { processWarSeason } from './warEngine';
import { tickSenateResponse } from './senateResponseEngine';
import { calcAntagonismLevel, tickNpcConsul } from './npcConsulEngine';
import {
  npcGatherTick,
  latentSecretDiscoveryTick,
  extortSeasonTick,
  computeExtortionDrain,
  computeBurnVoteLoss,
  scanNpcSecretDecisions,
  isDeterred,
  resolveClaudiusDefiance,
} from './secretEngine';
import { CLAUDIUS_ARC_SECRET_ID, CLAUDIUS_LEADER_ID, CLAUDIUS_CLAN_ID } from '../data/claudiusArc';
import { EVENT_DEFS } from '../data/events';
import { WAR_EVENT_DEFS } from '../data/warEvents';
import { CADET_EVENT_DEFS } from '../data/cadetEvents';
import { COMPROMISING_EVENT_DEFS } from '../data/compromisingEvents';
import { OFFICES } from '../data/offices';
import { AUTO_BILL_TEMPLATES, BILL_TEMPLATES, HISTORICAL_BILL_TEMPLATES } from '../data/billTemplates';
import { getCityDefinition } from '../data/cityDefinitions';
import { REGIONS } from '../data/theatreMap';
import type { RegionId } from '../models/theatre';
import { rollMusteredUnit } from './musterEngine';
import { getRegionRelationship } from './theatreEngine';
import type { Army } from '../models/army';
import type { Command, CommandElectionState } from '../models/command';
import {
  resolveCommandElection,
  generateCommandRivals,
  buildRivalEntry,
  calcProrogationModifier,
} from './commandEngine';
import {
  assignCarthaginianOrders,
  assignNpcRomanOrders,
  shouldReinforceCarthage,
  applyCarthageReinforcement,
} from './campaignAi';

// ─── Client helpers ──────────────────────────────────────────────────────────

function pickOldestClient(clients: Client[], type: ClientType): Client | undefined {
  return clients
    .filter(c => c.type === type)
    .sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
}

// ─── Triumph bill builder (Chunk 1C) ─────────────────────────────────────────

/**
 * Dynamically construct a Triumph petition bill for a character who has
 * successfully completed a military campaign.
 *
 * The bill is added to state.bills when the character:
 *   - Has a resolved non-defeat campaign as commanderCharacterId on a province
 *   - state.lifetimeImperium >= 50
 *   - No triumph bill already queued or passed for this character
 *
 * See design doc section 1.6 for full spec.
 */
function buildTriumphBill(
  character: GameState['family'][0],
  state: GameState,
): Bill {
  const characterId = character.id;
  // Base support: 10 + half the character's martial skill (proxy for military reputation)
  const baseSupport = 10 + Math.round(character.skills.martial / 2);

  return {
    id: `triumph-${characterId}-${state.year}`,
    name: `Triumph for ${character.name}`,
    // passEffect uses crisis-war--5 to reduce War track by 5 (victorious campaigns reduce external threat)
    passEffect: `lifetimeDignitas+20|fides+15|plebs+5|crisis-war-5|setFlag:triumph-granted-${characterId}:true`,
    failEffect: `fides-5|setFlag:triumph-denied-${characterId}:true`,
    turnsLeft: 4,
    support: baseSupport,
    playerProposed: false,
    type: 'military',
    repealable: false,
    renewable: false,
  } as unknown as Bill;
}

// ─── Season processor ────────────────────────────────────────────────────────

export function processSeason(state: GameState): {
  nextState: GameState;
  events: string[];
} {
  const events: string[] = [];
  let s = { ...state };

  // Auto-generated bill ids are sourced from state (not a module-level counter) so the
  // sequence survives being duplicated across Metro's per-route lazy web bundles — a module
  // singleton reset to its initial value there produced duplicate React keys like `auto-1000`.
  function nextBillId(): string {
    const id = `auto-${s.billIdSeq}`;
    s = { ...s, billIdSeq: s.billIdSeq + 1 };
    return id;
  }

  // 1. Advance season / year
  //
  // Phase 3, Chunk P3-A — pre-existing bug fix (flagged during ripeness-curve
  // work, reported and approved before applying): `year` is stored negative
  // (INITIAL_STATE.year = -264) and every display site reads Math.abs(year).
  // This previously did `s.year - 1` at the Winter→Spring crossing, which
  // moves the stored value FURTHER negative — so the displayed BC year
  // climbed (264 → 265 → 266...) instead of descending toward the historical
  // 241 BC end of the First Punic War. `+1` moves it toward 0, so the
  // displayed year correctly descends (264 → 263 → ...). Ripeness math
  // (warEngine.computeRipeness) depends on this direction being correct.
  const newSeasonIndex = (s.seasonIndex + 1) % 4;
  const crossedNewYear = newSeasonIndex === 0;
  const newYear = crossedNewYear ? s.year + 1 : s.year;
  s = { ...s, seasonIndex: newSeasonIndex, year: newYear, turnNumber: s.turnNumber + 1 };

  const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter'];
  events.push(`${seasonNames[newSeasonIndex]}, ${Math.abs(newYear)} BC`);

  // 2a. NPC career tick — decrement terms every season, advance careers in Winter
  s = { ...s, clans: tickNpcCareers(s.clans, newSeasonIndex) };

  // 2b. Resolve player election (Winter only)
  if (newSeasonIndex === 3 && s.campaigning) {
    const result = resolveElection(s);
    if (result.won) {
      const office = OFFICES.find((o) => o.id === s.campaigning);
      // Phase 4, Chunk P4-A — mirror the household-level heldOffices push (above)
      // onto the actual winning character's own record. campaigningCharacterId
      // persists past the win (cleared only at succession — inheritanceEngine.ts),
      // so it correctly identifies the holder for both player and family wins.
      const winnerId = s.campaigningCharacterId;
      s = {
        ...s,
        currentOffice: s.campaigning,
        officeSeasons: office?.termSeasons ?? 4,
        heldOffices: s.heldOffices.includes(s.campaigning!)
          ? s.heldOffices
          : [...s.heldOffices, s.campaigning!],
        family: s.family.map(c =>
          c.id === winnerId && s.campaigning && !(c.heldOffices ?? []).includes(s.campaigning!)
            ? { ...c, heldOffices: [...(c.heldOffices ?? []), s.campaigning!] }
            : c
        ),
        campaigning: null,
        campaignVotes: {},
        electionRivals: [],
      };
      if (s.campaigning === 'consul') {
        const { updated: legacyAfterConsul, newMilestonesReached: cMilestones } =
          incrementLegacy(s.legacyObjectives, 'consular_line', 1);
        s = { ...s, legacyObjectives: legacyAfterConsul };
        for (const m of cMilestones) {
          events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
        }
      }
      events.push(
        `ELECTED! ${s.family.find(c => c.id === s.campaigningCharacterId)?.name ?? 'Your candidate'} wins the ${office?.name ?? ''} — ranked #${result.playerRank} of ${result.seats} seats with ${result.playerVotes} votes.`
      );

      // ── Contested election event injection (Chunk 1C) ──────────────────────
      // High constitution crisis makes victorious elections disputeable.
      if (result.contested) {
        const player = s.family.find(c => c.isPlayer);
        s = {
          ...s,
          pendingEvents: [...s.pendingEvents, {
            defId: 'evt-election-contested',
            firedAtTurn: s.turnNumber,
            targetCharacterId: player?.id ?? 'pc-1',
          }],
        };
        events.push('Your election result is being contested by rivals.');
      }
    } else {
      s = { ...s, campaigning: null, campaignVotes: {}, electionRivals: [] };
      events.push(
        `Defeated. Ranked #${result.playerRank} — only ${result.seats} seat${result.seats !== 1 ? 's' : ''} available. ${result.topRivalName} leads with ${result.topRivalVotes} votes.`
      );
    }
  }

  // 2c. Campaign Map plan, Chunk C3 — reset each region's yearly muster pool
  // at the Winter→Spring crossing (same crossedNewYear gate used by every
  // other annual reset in this file — see the aging/regency steps below).
  if (crossedNewYear) {
    s = { ...s, theatre: { ...s.theatre, musteredThisYear: Object.fromEntries(REGIONS.map(r => [r.id, 0])) as Record<RegionId, number> } };
  }

  // 2d. Campaign Map plan, Chunk C4 — immediate lapse on the holder's death
  // (per the plan's own invariant: "if the holder dies, the command lapses
  // immediately"). Checked every season, before election resolution, so a
  // death and a same-season election-open/resolve never race each other.
  if (s.activeCommand) {
    const holderStillExists = s.activeCommand.holderOwner === 'player'
      ? s.family.some(c => c.id === s.activeCommand!.holderId)
      : s.clans.some(c => c.leaders.some(l => l.id === s.activeCommand!.holderId));
    if (!holderStillExists) {
      const lapsedHolderId = s.activeCommand.holderId;
      const player = s.family.find(c => c.isPlayer);
      const deathLapseNotice = injectNoticeEvent('evt-command-lapsed-death', s.turnNumber, player?.id ?? 'pc-1', {
        title: 'The Command Falls Vacant',
        bodyText: 'With the general\'s death, the theatre command falls vacant. Its armies hold in place, leaderless, until a new command is won.',
      });
      s = {
        ...s,
        armies: s.armies.map(a => a.commanderId === lapsedHolderId ? { ...a, commanderId: null } : a),
        activeCommand: null,
        pendingEvents: [...s.pendingEvents, deathLapseNotice],
      };
      events.push('The theatre command falls vacant — its holder has died.');
    }
  }

  // 2e. Campaign Map plan, Chunk C4 — resolve any open command-election.
  // Every season, not just Winter, and BEFORE the province activeCampaign
  // resolution steps later in this function (per the plan's "so a new
  // general can matter immediately" instruction). Safe to resolve
  // unconditionally here: a vote opened via a mid-season store action
  // (callCommandVote/declareCommandCandidate) was always opened in an
  // EARLIER processSeason call than this one (store actions run between
  // seasons, not during this function), and a prorogation vote auto-opened
  // by step 2f below always waits a full season before this check can see
  // it active — see that step's own comment.
  if (s.commandElection?.active) {
    const election = s.commandElection;
    const votingSwayBonus = s.clients
      .filter(c => c.type === 'votingSway')
      .reduce((sum, c) => sum + (c.bonus.votingSwayBonus ?? 1), 0);
    const result = resolveCommandElection(election, s.clans, votingSwayBonus);

    const buildGrantUnits = (count: number): Army['units'] => {
      const relationship = getRegionRelationship(s.cities, 'latium');
      return Array.from({ length: count }, (_, i) =>
        rollMusteredUnit('standard', 'latium', relationship, s.turnNumber, `army-command-unit-${s.turnNumber}-${i}`)
      );
    };
    const latiumCityId = REGIONS.find(r => r.id === 'latium')?.cityIds[0] ?? null;
    const cmd = BALANCE.campaign.command;

    if (election.isProrogation && result.retainedByIncumbent && s.activeCommand) {
      // Incumbent (player or rival, whichever side it was) keeps the
      // command — term extends, war chest tops up, no fresh grants.
      const holderName = election.incumbentIsPlayerCandidate
        ? (s.family.find(c => c.id === s.activeCommand!.holderId)?.name ?? 'its holder')
        : result.topRivalName || 'its holder';
      s = {
        ...s,
        activeCommand: {
          ...s.activeCommand,
          expiresSeason: s.turnNumber + cmd.termSeasons,
          warChest: s.activeCommand.warChest + cmd.prorogationWarChestTopUp,
        },
        commandElection: null,
      };
      events.push(`Prorogation granted — the command continues under ${holderName}.`);
    } else if (election.isProrogation) {
      // Incumbent not retained (or nobody stood) — the command lapses.
      // State-owned troops freeze in place as leaderless rome_state/
      // rome_rival garrisons awaiting the next command.
      const lapsedHolderId = s.activeCommand?.holderId ?? null;
      const player = s.family.find(c => c.isPlayer);
      const lapseNotice = injectNoticeEvent('evt-command-lapsed', s.turnNumber, player?.id ?? 'pc-1', {
        title: 'The Command Lapses',
        bodyText: 'No successor was confirmed in time. The theatre command lapses — its armies hold in place, leaderless, until a new general is named. Any personally-fielded army kept in the field without sanction risks the Senate\'s attention.',
      });
      s = {
        ...s,
        armies: lapsedHolderId
          ? s.armies.map(a => a.commanderId === lapsedHolderId ? { ...a, commanderId: null } : a)
          : s.armies,
        activeCommand: null,
        commandElection: null,
        pendingEvents: [...s.pendingEvents, lapseNotice],
      };
      events.push('The theatre command lapses — its armies await a new general.');
    } else if (result.won && result.winnerCharacterId) {
      // Fresh grant to the player.
      const newCommand: Command = {
        id: `command-${s.turnNumber}`,
        holderId: result.winnerCharacterId,
        holderOwner: 'player',
        grantedSeason: s.turnNumber,
        expiresSeason: s.turnNumber + cmd.termSeasons,
        battlesWon: 0,
        battlesLost: 0,
        warChest: cmd.grantWarChest,
      };
      const grantArmy: Army = {
        id: `army-command-${s.turnNumber}`,
        name: 'The Consular Legion',
        owner: 'rome_state',
        commanderId: result.winnerCharacterId,
        location: 'latium',
        stationedCityId: latiumCityId,
        units: buildGrantUnits(cmd.grantStateCohorts),
        stance: 'avoid_battle',
        ordersThisSeason: null,
        fatigued: false,
        unpaidSeasons: 0,
      };
      s = {
        ...s,
        activeCommand: newCommand,
        armies: [...s.armies, grantArmy],
        imperium: s.imperium + cmd.grantImperium,
        commandElection: null,
      };
      events.push(`${s.family.find(c => c.id === result.winnerCharacterId)?.name ?? 'A general'} is granted the theatre command! (+${cmd.grantImperium} Imperium, a state legion, and a ${cmd.grantWarChest}-denarii war chest)`);
    } else if (result.winnerRivalId) {
      // Fresh grant to a rival — this army becomes C6's NPC-Roman AI to command.
      const newCommand: Command = {
        id: `command-${s.turnNumber}`,
        holderId: result.winnerRivalId,
        holderOwner: 'rome_rival',
        grantedSeason: s.turnNumber,
        expiresSeason: s.turnNumber + cmd.termSeasons,
        battlesWon: 0,
        battlesLost: 0,
        warChest: cmd.grantWarChest,
      };
      const grantArmy: Army = {
        id: `army-command-${s.turnNumber}`,
        name: `${result.winnerName}'s Legion`,
        owner: 'rome_rival',
        commanderId: result.winnerRivalId,
        location: 'latium',
        stationedCityId: latiumCityId,
        units: buildGrantUnits(cmd.grantStateCohorts),
        stance: 'give_battle',
        ordersThisSeason: null,
        fatigued: false,
        unpaidSeasons: 0,
      };
      s = { ...s, activeCommand: newCommand, armies: [...s.armies, grantArmy], commandElection: null };
      events.push(`${result.winnerName} is granted the theatre command.`);
    } else {
      // No valid candidate stood — the assembly disperses without a victor.
      s = { ...s, commandElection: null };
      events.push('The extraordinary assembly disperses without a victor.');
    }
  }

  // 2f. Auto-call a prorogation vote in the command's final season. Guarded
  // on "no election already active" so this only ever fires once per
  // command — a vote opened THIS pass has calledSeason === s.turnNumber, so
  // step 2e above (which already ran this pass) cannot have resolved it;
  // the earliest it can resolve is next season's step 2e, giving the
  // player a full season to canvass, same as a freshly-called vote.
  if (s.activeCommand && !s.commandElection?.active && s.turnNumber === s.activeCommand.expiresSeason) {
    const incumbent = s.activeCommand;
    const modifier = calcProrogationModifier(incumbent.battlesWon, incumbent.battlesLost);
    const isPlayerIncumbent = incumbent.holderOwner === 'player';

    const challengers = generateCommandRivals(s.clans, isPlayerIncumbent ? undefined : incumbent.holderId);
    const incumbentRival = isPlayerIncumbent ? null : buildRivalEntry(s.clans, incumbent.holderId);
    const rivals = incumbentRival ? [incumbentRival, ...challengers] : challengers;

    const election: CommandElectionState = {
      active: true,
      calledSeason: s.turnNumber,
      isProrogation: true,
      incumbentWinLossModifier: modifier,
      incumbentIsPlayerCandidate: isPlayerIncumbent,
      incumbentRivalId: incumbentRival?.id ?? null,
      // A player incumbent auto-stands for their own prorogation; a rival
      // incumbent doesn't block the player from declaring a challenger via
      // declareCommandCandidate later this season.
      candidateCharacterId: isPlayerIncumbent ? incumbent.holderId : null,
      rivals,
      votes: {},
    };
    s = { ...s, commandElection: election };
    events.push('The command\'s term ends this season — a prorogation vote is called.');
  }

  // 2g. Campaign Map plan, Chunk C6 — campaign AI orders. Every season,
  // every carthage/rome_rival army gets a fresh order from the campaign AI
  // (overwriting whatever a previous season left — the AI has no "already
  // planned this season" concept the way a player does). Nothing resolves
  // these orders yet — C7's job, same as player orders since Chunk C5.
  // Guarded on armies existing at all: many fixtures/older saves predate
  // Chunk C2 and have no armies field (or an empty one) — nothing to do.
  if (s.armies && s.armies.length > 0) {
    const carthageOrders = assignCarthaginianOrders(s.armies, s.theatre, s.cities, s.seasonIndex);
    const rivalOrders = assignNpcRomanOrders(s.armies, s.clans, s.theatre, s.cities, s.seasonIndex);
    s = {
      ...s,
      armies: s.armies.map(a => {
        if (carthageOrders.has(a.id)) return { ...a, ordersThisSeason: carthageOrders.get(a.id) ?? null };
        if (rivalOrders.has(a.id)) return { ...a, ordersThisSeason: rivalOrders.get(a.id) ?? null };
        return a;
      }),
    };
  }

  // 2h. Campaign Map plan, Chunk C6 — Carthaginian reinforcements. Flat
  // batch every reinforcementInterval seasons (stateless — derived from
  // turnNumber alone, no extra persisted counter); C9's war-standing
  // scaling hook is noted but not built (see campaignAi.ts). Guarded on
  // theatre existing for the same pre-C1-fixture reason as step 2g.
  if (s.theatre && shouldReinforceCarthage(s.turnNumber)) {
    s = { ...s, armies: applyCarthageReinforcement(s.armies ?? [], s.turnNumber, `army-carthage-reinforce-${s.turnNumber}`) };
    events.push('Carthage lands fresh cohorts at Africa.');
  }

  // 3. Tick office term
  if (s.currentOffice && s.officeSeasons > 0) {
    const newOfficeSeasons = s.officeSeasons - 1;
    if (newOfficeSeasons === 0) {
      const officeName = OFFICES.find((o) => o.id === s.currentOffice)?.name ?? '';
      events.push(`Your term as ${officeName} has ended.`);
      s = { ...s, currentOffice: null, officeSeasons: 0 };
    } else {
      s = { ...s, officeSeasons: newOfficeSeasons };
    }
  }

  // 3b. Tribune term tick — parallel path, independent of main office term (Chunk 1C)
  if (s.tribuneHolder) {
    const newTribSeasons = s.tribuneSeasonsServed + 1;
    if (newTribSeasons >= 4) {
      const exTribuneId   = s.tribuneHolder;
      const exTribuneName = s.family.find(c => c.id === exTribuneId)?.name ?? 'The Tribune';
      s = {
        ...s,
        tribuneHolder:       null,
        tribuneImmunity:     false,
        tribuneSeasonsServed: 0,
        tribuneHostilityDebt: {},
        // Clear the office from the character's record
        family: s.family.map(c =>
          c.id === exTribuneId ? { ...c, officeId: null } : c
        ),
      };
      events.push(`${exTribuneName}'s term as Tribune of the Plebs has ended.`);
    } else {
      s = { ...s, tribuneSeasonsServed: newTribSeasons };
    }
  }

  // 4. Resolve bills
  const unrestTier = getTierFromLevel(s.crisis.unrest.level);
  const senateSessionSuspended = unrestTier >= 4 && Math.random() < 0.20;
  if (senateSessionSuspended) {
    s = { ...s, flags: { ...s.flags, senateSessionSuspended: true } };
    events.push('The Senate session has been suspended — popular unrest has overwhelmed the Forum. No legislation advances this season.');
  } else {
    s = { ...s, flags: { ...s.flags, senateSessionSuspended: false } };
  }

  const passedBills: Bill[] = [];
  const resolvedLogs: string[] = [];
  const remainingBills: Bill[] = [];

  if (!senateSessionSuspended) {
    const economyTier = getTierFromLevel(s.crisis.economy.level);
    const austerityActive = economyTier >= 3;

    for (const bill of s.bills) {
      const turnsLeft = bill.turnsLeft - 1;

      const isSpendingBill = bill.passEffect?.includes('gold-') || bill.passEffect?.includes('treasury-');
      const effectiveSupport = austerityActive && isSpendingBill
        ? bill.support - 10
        : bill.support;

      const constitutionTier = getTierFromLevel(s.crisis.constitution.level);
      const passThresholdBonus =
        constitutionTier >= 4 ? 15 :
        constitutionTier >= 3 ? 10 :
        constitutionTier >= 2 ? 5  : 0;

      if (effectiveSupport > passThresholdBonus) {
        passedBills.push(bill);
        const patch = applyEffectString(bill.passEffect, s);
        s = { ...s, ...patch };
        resolvedLogs.push(`✓ ${bill.name} passes.`);
      } else if (turnsLeft <= 0) {
        const patch = applyEffectString(bill.failEffect, s);
        s = { ...s, ...patch };
        resolvedLogs.push(`✗ ${bill.name} expires without passing.`);
      } else {
        remainingBills.push({ ...bill, turnsLeft });
      }
    }

    const newActiveLaws = passedBills
      .filter(b => b.id && !s.activeLaws?.some(l => l.billId === b.id))
      .map(b => ({
        billId: b.id,
        name: b.name,
        passedOnTurn: s.turnNumber,
        expiresOnTurn: b.duration !== undefined ? s.turnNumber + b.duration : undefined,
        ongoingEffect: b.ongoingEffect,
        repealable: b.repealable ?? false,
        renewable: b.renewable ?? false,
        renewalFlavour: b.renewalFlavour,
      }));

    const repealedLawIds = passedBills
      .filter(b => b.type === 'repeal' && b.repeals)
      .map(b => b.repeals!);

    s = {
      ...s,
      bills: remainingBills,
      passedBills: [
        ...(s.passedBills ?? []),
        ...passedBills.filter(b => b.type !== 'repeal').map(b => ({ id: b.id, name: b.name, passedOnTurn: s.turnNumber })),
      ],
      activeLaws: [
        ...(s.activeLaws ?? []).filter(l => !repealedLawIds.includes(l.billId)),
        ...newActiveLaws,
      ],
    };
    events.push(...resolvedLogs);
  }

  if (passedBills.length > 0) {
    s = { ...s, flags: { ...s.flags, seasonsSinceLastBillPassed: 0 } };
  } else {
    const prev = (s.flags['seasonsSinceLastBillPassed'] as number | undefined) ?? 0;
    s = { ...s, flags: { ...s.flags, seasonsSinceLastBillPassed: prev + 1 } };
  }

  // 5. Crisis escalation — four-track model
  const romeMods = calcRomeStatModifiers(s.rome);
  const prevCrisis = { ...s.crisis };

  let updatedCrisis = { ...s.crisis };
  for (const trackId of ['war', 'unrest', 'constitution', 'economy'] as const) {
    const delta = calcIndividualEscalation(trackId, s);
    updatedCrisis = { ...updatedCrisis, [trackId]: applyTrackDelta(updatedCrisis[trackId], delta) };
  }

  const cascadeDeltas = calcCascadeDeltas(updatedCrisis);
  for (const trackId of ['war', 'unrest', 'constitution', 'economy'] as const) {
    if (cascadeDeltas[trackId] !== 0) {
      updatedCrisis = {
        ...updatedCrisis,
        [trackId]: applyTrackDelta(updatedCrisis[trackId], cascadeDeltas[trackId]),
      };
    }
  }

  for (const trackId of ['war', 'unrest', 'constitution', 'economy'] as const) {
    const namedCrisis = getNamedCrisis(trackId, updatedCrisis[trackId].level, s);
    updatedCrisis = {
      ...updatedCrisis,
      [trackId]: { ...updatedCrisis[trackId], namedCrisis },
    };
  }

  const militaryPressure = checkMilitaryBillPressure(updatedCrisis, passedBills.map(b => b.id));
  if (militaryPressure !== 0) {
    updatedCrisis = { ...updatedCrisis, war: applyTrackDelta(updatedCrisis.war, militaryPressure) };
  }

  const newCrisisLevel = Math.round(
    (updatedCrisis.war.level + updatedCrisis.unrest.level +
     updatedCrisis.constitution.level + updatedCrisis.economy.level) / 4
  );

  s = { ...s, crisis: updatedCrisis, crisisLevel: newCrisisLevel };

  // Phase 3, Chunk P3-E — Crisis-100 hard terminal ("The Republic Falls").
  // Previously "escalating penalties but no hard stop" (verified — this is
  // the first place crisisLevel is ever checked against a ceiling). Fires
  // once and only once: gated on pendingEpilogue not already being set, so
  // it can never override a war outcome or gens_ends that landed the same
  // season, and never re-fires once set.
  // Phase 3, Chunk P3-F — suppressed in Endless mode (per the plan's default:
  // crises persist and punish past 241 BC, but never hard-end the sandbox).
  // Extinction (gens_ends, set elsewhere in this file) is NOT guarded here —
  // a family can still die out in Endless, same as any other run.
  if (!s.endlessMode && !s.pendingEpilogue && newCrisisLevel >= BALANCE.epilogue.crisisTerminalThreshold) {
    s = { ...s, pendingEpilogue: 'republic_falls' };
  }

  const TRACK_LABELS: Record<CrisisTrackId, string> = {
    war: 'War', unrest: 'Unrest', constitution: 'Constitution', economy: 'Economy',
  };
  for (const trackId of ['war', 'unrest', 'constitution', 'economy'] as const) {
    const prev = prevCrisis[trackId].level;
    const curr = s.crisis[trackId].level;
    const diff = Math.round(curr - prev);
    if (Math.abs(diff) >= 5) {
      const name = s.crisis[trackId].namedCrisis
        ? `${TRACK_LABELS[trackId]} (${s.crisis[trackId].namedCrisis})`
        : TRACK_LABELS[trackId];
      events.push(`${name} crisis: ${curr}/100 (${diff > 0 ? '+' : ''}${diff})`);
    }
  }

  // 5a. Multi-ticker event injection
  for (const def of EVENT_DEFS) {
    const hasMultiCrisis = def.conditions.some(c => c.type === 'multiCrisis');
    if (!hasMultiCrisis) continue;
    const cooldownKey = `${def.id}-cooldown`;
    if (s.flags[cooldownKey]) continue;
    const allPass = def.conditions.every(c => evalCondition(c, s));
    if (!allPass) continue;
    const player = s.family.find(c => c.isPlayer);
    const instance: EventInstance = {
      defId: def.id,
      firedAtTurn: s.turnNumber,
      targetCharacterId: player?.id ?? 'pc-1',
    };
    s = {
      ...s,
      pendingEvents: [...s.pendingEvents, instance],
      flags: { ...s.flags, [cooldownKey]: 4 },
    };
  }

  // 5b. Log Rome stat threshold labels
  if (romeMods.stabilityLabel !== 'Stable') events.push(`Rome stability: ${romeMods.stabilityLabel}.`);
  if (romeMods.plebsLabel !== 'Content')    events.push(`Plebs mood: ${romeMods.plebsLabel}.`);
  if (romeMods.treasuryLabel !== 'Adequate') events.push(`Treasury: ${romeMods.treasuryLabel}.`);

  // 5c. Grain riot check
  if (getTierFromLevel(s.crisis.unrest.level) >= 3 && Math.random() < 0.15) {
    const player = s.family.find(c => c.isPlayer);
    s = {
      ...s,
      pendingEvents: [...s.pendingEvents, {
        defId: 'evt-grain-riot',
        firedAtTurn: s.turnNumber,
        targetCharacterId: player?.id ?? 'pc-1',
      }],
    };
    events.push('Grain riots have broken out in the city.');
  }

  // 5d. Creditors demand — Economy tier 4 (Winter only)
  if (newSeasonIndex === 3 && getTierFromLevel(s.crisis.economy.level) >= 4) {
    const creditorCooldown = s.flags['creditors-demand-cooldown'];
    if (!creditorCooldown) {
      const player = s.family.find(c => c.isPlayer);
      s = {
        ...s,
        pendingEvents: [...s.pendingEvents, {
          defId: 'evt-creditors-demand',
          firedAtTurn: s.turnNumber,
          targetCharacterId: player?.id ?? 'pc-1',
        }],
        flags: { ...s.flags, 'creditors-demand-cooldown': 4 },
      };
    }
  }

  // 6. Rome stat updates
  const romeUpdate = calcRomeStats(s, passedBills.length);
  s = { ...s, rome: { ...s.rome, ...romeUpdate } };

  // 6b. Process active laws
  if (s.activeLaws && s.activeLaws.length > 0) {
    const expiredLaws: string[] = [];
    const renewalBills: typeof s.bills = [];

    for (const law of s.activeLaws) {
      if (law.ongoingEffect) {
        const lawPatch = applyEffectString(law.ongoingEffect, s);
        s = { ...s, ...lawPatch };
      }

      if (law.expiresOnTurn !== undefined && s.turnNumber >= law.expiresOnTurn) {
        expiredLaws.push(law.billId);
        const flavour = law.renewalFlavour ?? `The ${law.name} has lapsed.`;
        events.push(flavour);

        if (law.renewable) {
          const allTemplates = [...BILL_TEMPLATES, ...AUTO_BILL_TEMPLATES, ...HISTORICAL_BILL_TEMPLATES];
          const template = allTemplates.find(t => t.id === law.billId);
          if (template) {
            renewalBills.push({ ...template, id: nextBillId() });
            events.push(`New bill introduced: ${template.name}.`);
          }
        }
      }
    }

    if (expiredLaws.length > 0) {
      s = {
        ...s,
        activeLaws: s.activeLaws.filter(l => !expiredLaws.includes(l.billId)),
        bills: [...s.bills, ...renewalBills],
      };
    }
  }

  // 7. Resource income
  const { fidesIncome, denariiIncome, plebsDelta } = calcResourceIncome(s);

  const legacyBonuses = computeLegacyBonuses(s.legacyObjectives);
  const flatBonus  = legacyBonuses.flatBonus ?? {};
  const multiplier = legacyBonuses.resourceMultiplier ?? {};
  const finalFides   = Math.round((fidesIncome   + (flatBonus.fides ?? 0)) * (multiplier.fides ?? 1));
  const finalDenarii = Math.round((denariiIncome + (flatBonus.gold  ?? 0)) * (multiplier.gold  ?? 1));

  s = {
    ...s,
    fides:   s.fides   + finalFides,
    denarii: s.denarii + finalDenarii,
  };

  if (plebsDelta !== 0) {
    s = {
      ...s,
      rome: { ...s.rome, plebs: Math.min(100, Math.max(0, s.rome.plebs + plebsDelta)) },
    };
  }

  if (finalDenarii > 0) {
    const { updated: legacyAfterTreasury, newMilestonesReached: tMilestones } =
      incrementLegacy(s.legacyObjectives, 'treasury_legacy', finalDenarii);
    s = { ...s, legacyObjectives: legacyAfterTreasury };
    for (const m of tMilestones) {
      events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  events.push(`Income: +${finalFides} Fides${finalDenarii > 0 ? `, +${finalDenarii} Denarii` : ''}`);

  // 7b. Family House — location bonuses NOT part of calcResourceIncome's
  // Fides/Denarii shape: Palatine's flat Dignitas/season, and less-prestigious
  // neighborhoods' small per-season relationship drift toward leaders sharing
  // the house's faction alignment (houseEngine.computeHouseBonuses).
  {
    const houseBonuses = computeHouseBonuses(s.house);
    if (houseBonuses.dignitas > 0) {
      s = { ...s, lifetimeDignitas: s.lifetimeDignitas + houseBonuses.dignitas };
    }
    if (houseBonuses.factionRelPerSeason !== 0 && houseBonuses.factionBias) {
      const bias = houseBonuses.factionBias;
      const delta = houseBonuses.factionRelPerSeason;
      s = {
        ...s,
        clans: s.clans.map(clan => ({
          ...clan,
          leaders: clan.leaders.map(l =>
            l.bias === bias
              ? { ...l, relationship: Math.min(100, Math.max(-100, l.relationship + delta)) }
              : l
          ),
        })),
      };
    }
  }

  // 7b. NPC consul tick (Chunk 1C) ────────────────────────────────────────────
  // Recompute antagonism level each season, then run seasonal behaviour.
  if (s.npcConsul) {
    const newAntagonism = calcAntagonismLevel(s);
    s = {
      ...s,
      npcConsul: {
        ...s.npcConsul,
        antagonismLevel: newAntagonism,
        seasonsServed: s.npcConsul.seasonsServed + 1,
      },
    };
    const npcConsulPatch = tickNpcConsul(s);
    s = { ...s, ...npcConsulPatch };
  }

  // 7c. NPC Tribune veto (Chunk 1C) ───────────────────────────────────────────
  // When an NPC tribune is active, they veto one player-sponsored bill per season
  // (reduces support by 25). Cleared by the "Depose Fellow Tribune" extreme action.
  if (s.npcTribuneActive) {
    const playerBills = s.bills.filter(b => b.playerProposed);
    if (playerBills.length > 0) {
      const target = playerBills[Math.floor(Math.random() * playerBills.length)];
      s = {
        ...s,
        bills: s.bills.map(b =>
          b.id !== target.id ? b : { ...b, support: (b.support ?? 0) - 25 }
        ),
      };
      events.push(`The NPC Tribune has vetoed support for "${target.name}" (−25 support).`);
    }
  }

  // 8. Faction drift
  const factionPatch = applyFactionDrift(s);
  s = { ...s, ...factionPatch };

  // 9. Relationship anchor decay + leader aging/mortality (P2-D)
  // Yearly only — gated on the Winter→Spring rollover, not applied per season.
  if (crossedNewYear) {
    s = { ...s, clans: applyYearlyRelationshipDecay(s.clans) };

    const { clans: clansAfterMortality, death } = ageAndProcessMortality(s.clans);
    s = { ...s, clans: clansAfterMortality };

    if (death) {
      const stampClause = death.biasInherited ? "a man of his father's stamp" : 'an unknown quantity';
      let noticeBody =
        `Word from the Forum: ${death.deadLeaderName} of the ${death.clanName} has died, aged ${death.deadLeaderAge}. ` +
        `His place among the ${death.clanName} falls to ${death.successorName}, ${death.successorAge} — ${stampClause}. ` +
        `Philon, practically: "Whatever ${death.deadLeaderName} owed us, Domine, died with him. Whatever he knew of us, we may hope, as well."`;
      if (death.hadBond) {
        noticeBody += ' The bond your family held with him does not pass to his heir.';
      }
      events.push(`${death.deadLeaderName} of the ${death.clanName} has died. ${death.successorName} succeeds him.`);
      const player = s.family.find(c => c.isPlayer);
      s = {
        ...s,
        pendingEvents: [...s.pendingEvents, injectNoticeEvent(
          'evt-leader-death',
          s.turnNumber,
          player?.id ?? 'pc-1',
          { title: `${death.deadLeaderName} is dead`, bodyText: noticeBody },
        )],
      };
    }

    // Munificence (P2-F) — reset the year-scoped usage fields (onceThisYear acts,
    // the shared 'games' slot); lastUsedTurn/totalUses are not touched here.
    const resetMunificenceUsage: typeof s.munificenceUsage = {};
    for (const [actId, entry] of Object.entries(s.munificenceUsage ?? {})) {
      resetMunificenceUsage[actId] = { ...entry, usesThisYear: 0 };
    }
    s = { ...s, munificenceUsage: resetMunificenceUsage };

    // Grand Games vote bonus decay — standing bonus fades by
    // BALANCE.munificence.grandGames.electionVoteBonusDecayPerInterval every
    // electionVoteBonusDecayIntervalYears, until it reaches 0 (P2-F design decision:
    // fame fades rather than being consumed by the next election).
    if ((s.grandGamesVoteBonus ?? 0) > 0) {
      const yearsUntilDecay = (s.grandGamesBonusYearsUntilDecay ?? 0) - 1;
      if (yearsUntilDecay <= 0) {
        const newBonus = Math.max(
          0,
          s.grandGamesVoteBonus - BALANCE.munificence.grandGames.electionVoteBonusDecayPerInterval,
        );
        s = {
          ...s,
          grandGamesVoteBonus: newBonus,
          grandGamesBonusYearsUntilDecay:
            newBonus > 0 ? BALANCE.munificence.grandGames.electionVoteBonusDecayIntervalYears : 0,
        };
      } else {
        s = { ...s, grandGamesBonusYearsUntilDecay: yearsUntilDecay };
      }
    }
  }

  // 9c. City tick
  if (s.cities && s.cities.length > 0) {

    // ── 9c-i: Development mandate enforcement (Lex de Provinciarum Cultura) ──
    //
    // While this law is active, any player governor whose development policy is
    // 'exploit' or 'neglect' is silently raised to 'maintain' before tickCity
    // runs. This means the tick sees the corrected policy: the infrastructure
    // improvement (DEVELOPMENT_INFRA_DELTA['maintain'] = 0, vs -5 for exploit)
    // and the cost difference (DEVELOPMENT_GOLD_COST['maintain'] = 5) are both
    // applied automatically inside calcCityGoldOutput — no extra deduction
    // needed here.
    //
    // Only player governors are compelled. NPC role-holders govern by their own
    // trait and are outside the scope of this mandate. Unincorporated cities
    // have no governor system and are also skipped.
    {
      const mandateLawActive = (s.activeLaws ?? []).some(
        l => l.billId === 'lex-de-provinciarum-cultura',
      );

      if (mandateLawActive) {
        // Ordered from lowest to highest development commitment.
        const DEV_NOTCH_ORDER = ['exploit', 'neglect', 'maintain', 'invest', 'major_works'];
        const MANDATE_MIN = 'maintain';
        const mandateMinIdx = DEV_NOTCH_ORDER.indexOf(MANDATE_MIN);

        s = {
          ...s,
          cities: s.cities.map(city => {
            // Only incorporated cities have governors
            if (city.status !== 'incorporated') return city;
            // Only apply to player governors
            if (!city.playerGovernor) return city;

            const currentDev = city.playerGovernor.policy.development;
            // Already meets or exceeds the mandate — no action needed
            if (DEV_NOTCH_ORDER.indexOf(currentDev) >= mandateMinIdx) return city;

            // Force policy up to the mandate minimum
            const def = getCityDefinition(city.id);
            events.push(
              `⚖ Senate mandate: ${def?.name ?? city.id} — governor's development raised to Maintain` +
              ` (was ${currentDev === 'exploit' ? 'Exploit' : 'Neglect'}) by Lex de Provinciarum Cultura.`,
            );

            return {
              ...city,
              playerGovernor: {
                ...city.playerGovernor,
                policy: {
                  ...city.playerGovernor.policy,
                  development: MANDATE_MIN,
                },
              },
            };
          }),
        };
      }
    }

    // ── 9c-ii: City tick ─────────────────────────────────────────────────────
    const { updatedCities, totalGoldDelta, totalImperiumDelta, totalTreasuryDelta, newWars, events: cityEvents } =
      tickAllCities(s.cities, s);

    s = {
      ...s,
      cities: updatedCities,
      denarii:  s.denarii  + totalGoldDelta,
      imperium: s.imperium + totalImperiumDelta,
      lifetimeImperium: (s.lifetimeImperium ?? 0) + Math.max(0, totalImperiumDelta),
      rome: { ...s.rome, treasury: Math.min(100, Math.max(0, s.rome.treasury + totalTreasuryDelta)) },
      wars: newWars.length > 0 ? [...s.wars, ...newWars] : s.wars,
    };

    for (const msg of cityEvents) events.push(msg);

    if (totalGoldDelta > 0 || totalImperiumDelta > 0) {
      events.push(`Provincial income: +${totalGoldDelta} Gold, +${totalImperiumDelta} Imperium.`);
    }

    // ── 9c-iii: Lex de Viis — city infrastructure boost ──────────────────────
    //
    // While the road maintenance law is active, all non-heartland cities gain
    // +1 infrastructure rating each season, on top of whatever their governor's
    // development policy already produced. This represents the Senate funding
    // direct road-building across the Republic.
    //
    // The treasury cost is 3 points of rome.treasury per city. A larger
    // empire costs proportionally more to maintain — this is the design intent.
    // The cost drains the public treasury (rome.treasury), not the player's
    // personal denarii, since road maintenance is a senatorial expenditure.
    //
    // Note: The +1 infra here also resets the infraStagnationSeasons counter
    // inside tickCity for the *next* season (because currInfra > prevInfra
    // once this is applied). However, since the tick already ran this season
    // before this block executes, the stagnation counter effect is delayed by
    // one season — which is intentional and correct.
    {
      const lexDeViisActive = (s.activeLaws ?? []).some(l => l.billId === 'lex-de-viis');

      if (lexDeViisActive) {
        // Foreign (Carthaginian/independent) territory excluded — Rome doesn't
        // build roads in cities it doesn't hold. Mediterranean-provinces
        // plan, chunk MP-E.
        const nonHeartlandCities = s.cities.filter(p => p.status !== 'heartland' && p.status !== 'foreign');
        const provCount = nonHeartlandCities.length;

        if (provCount > 0) {
          const treasuryCost = provCount * 3;

          s = {
            ...s,
            cities: s.cities.map(p =>
              p.status === 'heartland' || p.status === 'foreign'
                ? p
                : { ...p, infrastructureRating: Math.min(100, p.infrastructureRating + 1) },
            ),
            rome: {
              ...s.rome,
              treasury: Math.max(0, s.rome.treasury - treasuryCost),
            },
          };

          events.push(
            `Via Romana: road upkeep advances infrastructure across ${provCount}` +
            ` cit${provCount !== 1 ? 'ies' : 'y'} (+1 each, −${treasuryCost} Treasury).`,
          );
        }
      }
    }
  }

  // 9b. Increment survival_legacy
  {
    const { updated: legacyAfterSurvival, newMilestonesReached: sMilestones } =
      incrementLegacy(s.legacyObjectives, 'survival_legacy', 1);
    s = { ...s, legacyObjectives: legacyAfterSurvival };
    for (const m of sMilestones) {
      events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  // 9d. Troop attrition
  {
    const updatedFamily = s.family.map(c => {
      if ((c.veterans ?? []).length === 0) return c;
      return { ...c, veterans: applyTroopAttrition(c.veterans, 1) };
    });
    s = { ...s, family: updatedFamily };
  }

  // 9d2. Military Overhaul M8 — unit lifecycle: loyalty season tick.
  // +5/season while a character personally commands an unresolved
  // activeCampaign (the existing abstract campaign system's closest analog
  // to "on campaign, same commander" for the new set-piece muster — see
  // musterEngine.ts's header comment for the fuller reconciliation, incl.
  // the caveat that the personal-commander campaign flow is currently
  // stubbed at the UI layer and so a started campaign never resolves —
  // this tick still fires correctly off activeCampaign's own fields
  // regardless). Otherwise idle decay toward 50, once per year only
  // (Winter -> Spring rollover), same cadence as every other yearly-only
  // system in this file (see crossedNewYear above). Applies to BOTH
  // raisedLegions and veterans, unlike 9d's attrition (veterans only).
  {
    const commandingCharacterIds = new Set(
      s.cities
        .map(p => p.activeCampaign)
        .filter((c): c is NonNullable<typeof c> => !!c && !c.resolved && c.commanderCharacterId !== null)
        .map(c => c.commanderCharacterId as string),
    );
    const lc = BALANCE.battle.lifecycle;
    const moveToward = (current: number, step: number, target: number): number => {
      if (current > target) return Math.max(target, current - step);
      if (current < target) return Math.min(target, current + step);
      return current;
    };
    const clampLoyalty = (v: number) => Math.min(100, Math.max(0, v));
    const updatedFamily = s.family.map(c => {
      const hasTroops = (c.raisedLegions?.length ?? 0) > 0 || (c.veterans?.length ?? 0) > 0;
      if (!hasTroops) return c;
      const onCampaign = commandingCharacterIds.has(c.id);
      if (!onCampaign && !crossedNewYear) return c;
      const applyTick = (t: TroopUnit): TroopUnit => {
        const newLoyalty = onCampaign
          ? t.bondToCommander + lc.loyaltyGainPerCampaignSeason
          : moveToward(t.bondToCommander, Math.abs(lc.idleLoyaltyDecayPerYear), lc.idleLoyaltyDecayTarget);
        return { ...t, bondToCommander: clampLoyalty(newLoyalty) };
      };
      return {
        ...c,
        raisedLegions: (c.raisedLegions ?? []).map(applyTick),
        veterans: (c.veterans ?? []).map(applyTick),
      };
    });
    s = { ...s, family: updatedFamily };
  }

  // 9d3. Military Overhaul M9 — war score season tick. Skirmish drift,
  // weariness, threshold-crossing notices, and the provisional set-piece
  // scheduler (warEngine.ts's seam) for every active war. Placed right
  // after 9d2 (both are military-upkeep-adjacent); crisis escalation (step
  // 5, earlier) reads state.wars as it stood BEFORE this step runs — see
  // crisisEngine.ts's calcWarEscalation comment for why that's consistent
  // with every other crisis input in this file.
  //
  // M10 WIDENING (per the plan's Cross-Chunk Notes: turnSequencer.ts is only
  // touched by M9's one step, not a new one for M10) — a treaty resolving
  // (pass/fail/dictate-auto-ratify) this season can now also patch denarii,
  // family (prisoner release), provinces (Sicily cession), and bills (a
  // triumph petition) via warResult.statePatch. lifetimeDignitas is merged
  // explicitly rather than just spread, since both the pre-existing
  // lifetimeDignitasDelta path (set-piece decline) and the new statePatch
  // path (face-saver clause) can independently want to change it the same
  // season.
  {
    const warResult = processWarSeason(s);
    const mergedLifetimeDignitas = (warResult.statePatch.lifetimeDignitas ?? s.lifetimeDignitas) + warResult.lifetimeDignitasDelta;
    s = {
      ...s,
      ...warResult.statePatch,
      wars: warResult.wars,
      pendingEvents: [...s.pendingEvents, ...warResult.noticeEvents],
      lifetimeDignitas: mergedLifetimeDignitas,
    };
    events.push(...warResult.events);
  }

  // 9e. Recalculate militaryImperium
  {
    const updatedFamily = s.family.map(c => {
      const allTroops = [...(c.raisedLegions ?? []), ...(c.veterans ?? [])];
      const militaryImperium = calcMilitaryImperium(allTroops);
      if (militaryImperium === c.militaryImperium) return c;
      return { ...c, militaryImperium };
    });
    s = { ...s, family: updatedFamily };
  }

  // 9f. Senate response tick
  if ((s as any).senateResponse?.active) {
    const playerCharacterId = s.family.find(c => c.isPlayer)?.id ?? 'pc-1';
    const patch = tickSenateResponse(s as any, playerCharacterId);
    s = { ...s, ...patch };
  }

  // 9g. Resolve campaigns with completed officer volunteers
  {
    const updatedCities = s.cities.map(city => {
      const volunteer = city.officerVolunteer;
      const campaign  = city.activeCampaign;
      if (!volunteer?.resolved || !campaign || campaign.resolved || campaign.commanderCharacterId !== null) {
        return city;
      }

      const { successCount } = volunteer;
      const outcome: 'victory' | 'strategic_win' | 'stalemate' | 'defeat' =
        successCount >= 3 ? 'victory'
        : successCount >= 2 ? 'strategic_win'
        : successCount >= 1 ? 'stalemate'
        : 'defeat';

      const revoltSuppressed = successCount >= 2;
      const relationshipDelta =
        outcome === 'victory'       ? 12
        : outcome === 'strategic_win' ? 6
        : outcome === 'stalemate'     ? 0
        : -8;

      return {
        ...city,
        revoltActive:      revoltSuppressed ? false : city.revoltActive,
        relationshipScore: Math.min(100, Math.max(0, city.relationshipScore + relationshipDelta)),
        activeCampaign:    { ...campaign, resolved: true, outcome },
        officerVolunteer:  null,
      };
    });
    s = { ...s, cities: updatedCities };
  }

  // 9h. Triumph bill trigger (Chunk 1C) ────────────────────────────────────────
  // After campaign resolution: check each city for a completed victory.
  // If found and threshold conditions met, push a Triumph bill to the Senate queue.
  {
    for (const city of s.cities) {
      const campaign = city.activeCampaign;
      // Requires: resolved, non-defeat outcome, has a named commander
      if (!campaign?.resolved || !campaign.commanderCharacterId) continue;
      if (campaign.outcome === 'defeat' || campaign.outcome === 'stalemate') continue;

      const character = s.family.find(c => c.id === campaign.commanderCharacterId);
      if (!character) continue;

      // Don't add a second Triumph bill for the same character
      if (s.bills.some(b => b.id.startsWith(`triumph-${character.id}`))) continue;
      if ((s.passedBills ?? []).some(b => b.id.startsWith(`triumph-${character.id}`))) continue;

      // Require sustained military authority: global lifetimeImperium threshold
      if ((s.lifetimeImperium ?? 0) < 50) continue;

      const triumphBill = buildTriumphBill(character, s);
      s = { ...s, bills: [...s.bills, triumphBill] };
      events.push(`⚔ ${character.name} is eligible for a Triumph. A petition has been tabled in the Senate.`);
    }
  }

  // 9i. Tribune veto hostility debt check (Chunk 1C) ──────────────────────────
  // When veto hostility debt for a clan crosses 20, fire a retaliation event
  // and reset that clan's debt to 0.
  {
    for (const [clanId, debt] of Object.entries(s.tribuneHostilityDebt)) {
      if ((debt as number) >= 20) {
        const player = s.family.find(c => c.isPlayer);
        s = {
          ...s,
          pendingEvents: [...s.pendingEvents, {
            defId: 'evt-tribune-veto-retaliation',
            firedAtTurn: s.turnNumber,
            targetCharacterId: player?.id ?? 'pc-1',
          }],
          tribuneHostilityDebt: { ...s.tribuneHostilityDebt, [clanId]: 0 },
        };
        const clan = s.clans.find(c => c.id === clanId);
        events.push(`${clan?.name ?? 'A clan'} has had enough of your vetoes. Their response is coming.`);
      }
    }
  }

  // 9b. Phase 4, Chunks P4-A + P4-B — Secrets season tick. Grown in place per
  // the plan's cross-chunk note ("one step, grown in place"), not a new step.
  // Player-side groundwork needs no code here (written directly at
  // gather-attempt time in gameStore.gatherIntelligence, no decay — v1).
  {
    // ── P4-A: NPC-side reverse gather ─────────────────────────────────────
    const gatherResult = npcGatherTick(s);
    s = { ...s, clans: gatherResult.clans, secrets: [...(s.secrets ?? []), ...gatherResult.secrets] };

    // ── Player-choice blackmail: latent-secret discovery ───────────────────
    // Compromising choices the player knowingly made (data/compromisingEvents.ts's
    // createLatentSecret: token) may get noticed by a hostile leader this
    // season — see secretEngine.latentSecretDiscoveryTick's header comment.
    // Converted entries become ordinary Secrets and fall straight into the
    // same demand pipeline as npcGatherTick's own output below.
    const discoveryResult = latentSecretDiscoveryTick(s);
    if (discoveryResult.secrets.length > 0) {
      s = {
        ...s,
        secrets: [...s.secrets, ...discoveryResult.secrets],
        latentSecrets: (s.latentSecrets ?? []).filter(l => !discoveryResult.removedLatentIds.includes(l.id)),
      };
      events.push('Someone has taken an interest in a matter you thought was closed.');
    }

    // ── P4-B: extortion ticks, both directions ────────────────────────────
    // Player extorting a leader: income + exposure roll (extortSeasonTick).
    // A leader extorting the player family (already complied): flat drain,
    // no roll — see secretEngine.computeExtortionDrain's header comment.
    let extortIncome = 0;
    let extortDrain = 0;
    const extortLogs: string[] = [];
    let secretsAfterExtort = s.secrets;
    let clansAfterExtort = s.clans;

    for (const secret of s.secrets) {
      if (secret.status !== 'extorting') continue;

      if (secret.holder === 'player' && secret.subject.kind === 'leader') {
        const result = extortSeasonTick(secret, Math.random());
        extortIncome += result.income;
        secretsAfterExtort = secretsAfterExtort.map(sec =>
          sec.id === secret.id ? { ...sec, status: result.newStatus } : sec
        );
        if (result.exposed) {
          const leaderId = secret.subject.leaderId;
          clansAfterExtort = clansAfterExtort.map(c => ({
            ...c,
            leaders: c.leaders.map(l => l.id === leaderId
              ? {
                  ...l,
                  relationship: Math.max(-100, l.relationship + result.relationshipDelta),
                  familyGroundwork: Math.min(
                    BALANCE.secrets.groundworkCap,
                    (l.familyGroundwork ?? 0) + result.retaliationGroundworkDelta
                  ),
                }
              : l),
          }));
          const leaderName = clansAfterExtort.flatMap(c => c.leaders).find(l => l.id === leaderId)?.name ?? 'your target';
          extortLogs.push(`Your extortion of ${leaderName} is discovered — the well runs dry, and they take note.`);
        }
      } else if (secret.subject.kind === 'family' && secret.holder !== 'player') {
        extortDrain += computeExtortionDrain(secret);
      }
    }

    s = {
      ...s,
      clans: clansAfterExtort,
      secrets: secretsAfterExtort,
      denarii: Math.max(0, s.denarii + extortIncome - extortDrain),
    };
    if (extortIncome > 0) events.push(`Extortion income: +${extortIncome} Denarii.`);
    if (extortDrain > 0) events.push(`Extortion drain: −${extortDrain} Denarii, quietly paid.`);
    events.push(...extortLogs);

    // ── P4-B: NPC decisions — burns apply immediately (unilateral, no
    // player choice); at most one leverage/extort demand queues as an
    // event this season (pendingSecretDemand is a single slot, mirroring
    // the pre-existing pendingCanvass* pattern — guarded so an unanswered
    // demand already in the queue is never silently overwritten). ─────────
    // Phase 4, Chunk P4-G — the Claudius arc's starting Secret is excluded
    // from the generic scan: it's a scripted, three-choice arc (comply /
    // play for time / defy — see evt-claud-01 below), not the generic
    // two-choice demand this pool would otherwise pick for it. Left in, his
    // own seeded relationship (-30, startingClans.ts) is already at/below
    // npcBurnStandingMax, which would auto-burn the arc's own Secret in the
    // very first eligible season — well before the scripted demand ever
    // gets a chance to fire.
    const decisions = scanNpcSecretDecisions(s).filter(d => d.secretId !== CLAUDIUS_ARC_SECRET_ID);

    for (const decision of decisions) {
      if (decision.action !== 'burn') continue;
      const clan = s.clans.find(c => c.id === decision.clanId);
      const leader = clan?.leaders.find(l => l.id === decision.leaderId);
      const secret = s.secrets.find(sec => sec.id === decision.secretId);
      if (!clan || !leader || !secret) continue;

      const voteLoss = computeBurnVoteLoss(leader.votes);
      const currentRep = s.familyReputations[clan.id] ?? 0;
      s = {
        ...s,
        clans: s.clans.map(c => c.id === clan.id ? {
          ...c,
          leaders: c.leaders.map(l => l.id === leader.id ? { ...l, votes: Math.max(0, l.votes - voteLoss) } : l),
        } : c),
        familyReputations: { ...s.familyReputations, [clan.id]: Math.min(currentRep, BALANCE.secrets.burnClanRepFloor) },
        secrets: s.secrets.map(sec => sec.id === secret.id ? { ...sec, status: 'spent' as const, discovered: true } : sec),
        // Phase 5, Chunk P5-D — same aftermath flag as gameStore.burnSecret's
        // player-initiated path: either direction ends with a leader ruined
        // by a burned secret, which is the aftermath content's actual trigger.
        flags: { ...s.flags, 'secret-burned-recently': true },
      };
      events.push(`Scandal: ${leader.name} burns what they held rather than lose it quietly — ${secret.flavorText} ${clan.name} turns hostile.`);
    }

    if (!s.pendingSecretDemand) {
      const demandDecision = decisions.find(d => d.action !== 'burn');
      if (demandDecision) {
        const secret = s.secrets.find(sec => sec.id === demandDecision.secretId);
        const leader = s.clans.flatMap(c => c.leaders).find(l => l.id === demandDecision.leaderId);
        const demandSubject = secret?.subject;
        if (secret && leader && demandSubject && demandSubject.kind === 'family') {
          const targetChar = s.family.find(c => c.id === demandSubject.characterId);
          const defId = demandDecision.action === 'extort' ? 'evt-secret-demand-extortion' : 'evt-secret-demand-leverage';
          const kind: 'leverage_bill' | 'leverage_election' | 'extort' =
            demandDecision.action === 'leverage_bill' ? 'leverage_bill'
            : demandDecision.action === 'leverage_election' ? 'leverage_election'
            : 'extort';

          const targetBill = demandDecision.billId ? s.bills.find(b => b.id === demandDecision.billId) : undefined;
          const bodyText =
            kind === 'leverage_bill'
              ? `${leader.name} corners you after the session: he knows what you know he knows. His price is your voice on "${targetBill?.name ?? 'the bill before the Senate'}" — nothing more, nothing less.`
              : kind === 'leverage_election'
              ? `${leader.name} sends word through an intermediary: his support in your campaign has a price, and you already know what he holds.`
              : `${leader.name}'s man arrives with an open hand and a closed mouth. He will keep quiet — for a fee, paid quietly, every season, for as long as you allow it.`;

          s = {
            ...s,
            // Discovery — the demand firing IS how the player learns this
            // Secret exists (plan's discovery paragraph, first branch).
            secrets: s.secrets.map(sec => sec.id === secret.id ? { ...sec, discovered: true } : sec),
            pendingEvents: [...s.pendingEvents, injectNoticeEvent(defId, s.turnNumber, targetChar?.id ?? 'pc-1', { bodyText })],
            pendingSecretDemand: {
              secretId: secret.id,
              leaderId: leader.id,
              clanId: demandDecision.clanId,
              kind,
              billId: demandDecision.billId,
              direction: demandDecision.direction,
            },
          };
          events.push(`${leader.name} makes their move — a demand awaits your answer.`);
        }
      }
    }

    // ── Phase 4, Chunk P4-G — the Claudius arc ──────────────────────────────
    // Patience countdown first — may cancel (deterrence) or auto-resolve to
    // defiance before the demand-injection check below runs this same
    // season, so order matters here.
    if (s.claudiusPatience !== null) {
      if (isDeterred(CLAUDIUS_LEADER_ID, s.secrets)) {
        // The standoff itself is a complete resolution of the arc (design
        // point 1) — cancel the countdown rather than let a frozen Secret
        // eventually "auto-defy" into a trial that can't actually be filed.
        s = { ...s, claudiusPatience: null };
      } else {
        const remaining = s.claudiusPatience - 1;
        if (remaining <= 0) {
          const { patch, logMsg } = resolveClaudiusDefiance(s);
          s = { ...s, ...patch };
          events.push(`His patience runs out. ${logMsg}`);
        } else {
          s = { ...s, claudiusPatience: remaining };
        }
      }
    }

    // The demand (evt-claud-01) — condition-gated: the arc Secret still
    // held and unfrozen, no demand already pending, no active countdown, no
    // succession/epilogue mid-flight, year 2+ (open-ended rather than a
    // hard year-3 cutoff — a guided run's tutorial can finish anywhere
    // around year 2-3 depending on pacing; capping the window risks the arc
    // never firing at all for a slower run), cooldown respected between
    // firings, and a live bill to name.
    //
    // Phase 5, Chunk P5-H — the `tutorialDone` gate this condition used to
    // also require is removed. It made the demand wait for the entire
    // guided tutorialQueue to drain (realistically ~8-9 seasons), which
    // directly conflicted with the "first oh-no within 8 seasons" target;
    // confirmed via 3 auto-driven guided runs never reaching a trial/
    // demand/election-loss oh-no by season 8 under the old gate. Dropping
    // it still isn't reckless: `yearsSinceStart >= 1` alone means the
    // earliest possible firing is turn 5 (Spring, Year 2) — after
    // tut-01..tut-04 (Year 1's script, including tut-04's own "The Claudian
    // Smile," the tutorial's existing narrative setup for this exact arc)
    // have already had their season to fire. The demand queues onto
    // pendingEvents rather than interrupting anything active, so it can
    // never collide with a tutorial event mid-display — it just takes its
    // turn in the same queue.
    if (
      !s.pendingSecretDemand &&
      s.claudiusPatience === null &&
      !s.pendingSuccession &&
      !s.pendingEpilogue
    ) {
      const claudiusSecret = s.secrets.find(sec => sec.id === CLAUDIUS_ARC_SECRET_ID && sec.status === 'held');
      const yearsSinceStart = s.year - s.gensFoundedYear;
      const cooldownElapsed = claudiusSecret
        ? (s.turnNumber - (claudiusSecret.lastActedSeason ?? -Infinity)) >= BALANCE.secrets.npcAi.npcUseCooldownSeasons
        : false;

      if (
        claudiusSecret &&
        cooldownElapsed &&
        yearsSinceStart >= 1 &&
        !isDeterred(CLAUDIUS_LEADER_ID, s.secrets)
      ) {
        const leader = s.clans.flatMap(c => c.leaders).find(l => l.id === CLAUDIUS_LEADER_ID);
        // Bias-matched bill preferred (same signal npcSecretDecision uses
        // generically), falling back to whatever's live — the demand's
        // flavor names a bill, but no SPECIFIC named bill is reliably live
        // this early (verified: only a "keep >=2 queued" refill exists,
        // drawing from AUTO_BILL_TEMPLATES in a fixed order, not a
        // guaranteed-present named bill).
        const targetBill = s.bills.find(b => b.type === 'optimates') ?? s.bills[0];
        if (leader && targetBill) {
          const bodyText =
            `${leader.name} finds you after the session, unhurried. He has never needed to raise his voice. ` +
            `"A small matter, between houses that understand each other. Your voice, on the floor, when ` +
            `‘${targetBill.name}’ is called. Nothing you would not have considered anyway." ` +
            `He does not name what he holds. He does not need to.`;
          s = {
            ...s,
            pendingEvents: [...s.pendingEvents, injectNoticeEvent('evt-claud-01', s.turnNumber, s.family.find(c => c.isPlayer)?.id ?? 'pc-1', { bodyText })],
            pendingSecretDemand: {
              secretId: claudiusSecret.id,
              leaderId: leader.id,
              clanId: CLAUDIUS_CLAN_ID,
              kind: 'leverage_bill',
              billId: targetBill.id,
              direction: 'for',
            },
          };
          events.push(`${leader.name} makes his move — a demand awaits your answer.`);
        }
      }
    }
  }

  // 10. Age family members + Phase 3, Chunk P3-C — yearly natural-mortality
  // roll. No pre-existing natural-death system existed anywhere in this
  // codebase before this chunk (verified) — this is the first one. Rolled
  // only at the yearly rollover (same crossedNewYear gate aging already
  // uses), one roll per character, in family-array order; the first hit
  // wins (a same-season second death would collide with the single
  // pendingSuccession slot — rare enough at realistic family sizes not to
  // handle further this chunk). Battle death is a separate, immediate path
  // (musterEngine.ts's applyBattleOutcome) funnelled through the SAME
  // detectPaterfamiliasDeath -> successionEvents.ts sequence — see that
  // file's header comment for why the two were unified rather than left as
  // two divergent succession systems.
  {
    const aged = s.family.map((c) => ({ ...c, age: c.age + (crossedNewYear ? 1 : 0) }));
    let family = aged;

    if (crossedNewYear && !s.pendingSuccession) {
      const deceased = aged.find(c => rollsDead(c));
      if (deceased) {
        const result = detectPaterfamiliasDeath(aged, deceased.id, s.heldOffices);
        family = result.family;
        if (result.pendingSuccession) {
          const p = result.pendingSuccession;
          const resolution = resolveDeathNotice(p, s.cadetBranch, s.cadetBranchUsed, s.turnNumber, s.gensName);
          s = {
            ...s,
            pendingSuccession: p,
            pendingEvents: [...s.pendingEvents, resolution.notice],
            ...(resolution.cadetBranch ? { cadetBranch: resolution.cadetBranch } : {}),
            ...(resolution.pendingEpilogue ? { pendingEpilogue: resolution.pendingEpilogue } : {}),
          };
          events.push(`${p.deceasedName} has died.`);
        } else {
          events.push(`${deceased.name} has died.`);
        }
      }
    }

    s = { ...s, family };
  }

  // 10b. Phase 3, Chunk P3-C — regency-ends check. Same crossedNewYear gate
  // as step 10 (per the plan's "reuse the existing yearly-rollover gate"
  // instruction) — checked against the heir's just-incremented age, not a
  // separate year comparison, to avoid any off-by-one between the two.
  if (crossedNewYear && s.regency) {
    const heir = s.family.find(c => c.id === s.regency!.heirId);
    if (heir && heir.age >= BALANCE.succession.regencyMinorAge) {
      const regent = s.family.find(c => c.id === s.regency!.regentId);
      s = {
        ...s,
        regency: null,
        pendingEvents: [...s.pendingEvents, injectNoticeEvent('evt-succession-regency-ends', s.turnNumber, heir.id, {
          title: 'Come of Age',
          bodyText: `${heir.name} comes of age and takes the household in his own name`
            + (regent ? ` — ${regent.name} steps back from governing it.` : '.'),
        })],
      };
      events.push(`${heir.name} comes of age; the regency ends.`);
    }
  }

  // 10c. Phase 3, Chunk P3-D — cadet-branch aging. Same yearly gate; he can
  // die of old age like anyone else, but per D4's documented lifecycle
  // choice there is no continuous "regenerate his son" background process
  // — a dead cadet is only lazily replaced at the moment extinction
  // actually needs him (cadetEvents.resolveDeathNotice).
  if (crossedNewYear && s.cadetBranch?.alive) {
    const aged = { ...s.cadetBranch, age: s.cadetBranch.age + 1 };
    s = { ...s, cadetBranch: rollsDead(aged) ? { ...aged, alive: false } : aged };
  }

  // 11. Auto-inject bills
  {
    const economyTier = getTierFromLevel(s.crisis.economy.level);
    const needsVectigalis = s.rome.treasury <= 9 || economyTier >= 2;
    if (needsVectigalis) {
      const vectigalisActive = s.bills.some(b => b.name === 'Lex de Vectigalibus') ||
        (s.activeLaws ?? []).some(l => l.billId === 'lex-de-vectigalibus');
      if (!vectigalisActive) {
        const template = HISTORICAL_BILL_TEMPLATES.find(t => t.id === 'lex-de-vectigalibus');
        if (template) {
          s = { ...s, bills: [...s.bills, { ...template, id: nextBillId() }] };
          events.push(s.rome.treasury <= 9
            ? `Emergency: Treasury is bankrupt — Lex de Vectigalibus has been introduced.`
            : `Economic pressure: Lex de Vectigalibus has been introduced.`
          );
        }
      }
    }
  }

  if (s.rome.stability < 15 && Math.random() < 0.10) {
    const scuActive = s.bills.some(b => b.name === 'Senatus Consultum Ultimum');
    if (!scuActive) {
      const template = AUTO_BILL_TEMPLATES.find(t => t.id === 'senatus-consultum-ultimum');
      if (template) {
        s = { ...s, bills: [...s.bills, { ...template, id: nextBillId() }] };
        events.push(`Crisis: Senate instability forces introduction of Senatus Consultum Ultimum.`);
      }
    }
  }

  if (s.bills.length < 2) {
    const existing = new Set(s.bills.map((b) => b.name));
    const candidates = AUTO_BILL_TEMPLATES.filter((t) => !existing.has(t.name));
    const toAdd = candidates.slice(0, 2 - s.bills.length);
    const newBills: Bill[] = toAdd.map((t) => ({ ...t, id: nextBillId() }));
    s = { ...s, bills: [...s.bills, ...newBills] };
    for (const b of newBills) events.push(`New bill introduced: ${b.name}.`);
  }

  // 12. Pick and inject one end-of-season event
  // P1-G: tutorial queue takes priority over random event pool.
  // When tutorialQueue is non-empty, pop the head if its season gate is met.
  // When queue empties on this pop, set flags['tutorial-complete'].
  // When queue is empty (or tutorial complete), fall through to pickRandomEvent.
  // See Fable-phase1-implementation-plan.md §P1-G — Firing rules, hook 2.
  {
    const { checkTutorialGate, getEventDef } = require('../engine/eventEngine');
    let chosenDef: import('../models/event').EventDef | undefined;

    const tutorialQueue = s.tutorialQueue ?? [];

    if (tutorialQueue.length > 0) {
      const nextDefId = tutorialQueue[0];
      const gate = checkTutorialGate(nextDefId, s) as { fire: boolean; skip: boolean };

      if (gate.fire) {
        chosenDef = getEventDef(nextDefId) as typeof chosenDef;
        const newQueue = tutorialQueue.slice(1);
        s = {
          ...s,
          tutorialQueue: newQueue,
          // Queue exhausted: stamp completion flag
          flags: newQueue.length === 0
            ? { ...s.flags, 'tutorial-complete': true }
            : s.flags,
        };
      } else if (gate.skip) {
        // Conditional failure (e.g. tut-06 with no campaign) — pop silently, no event
        s = { ...s, tutorialQueue: tutorialQueue.slice(1) };
      }
      // gate.wait (both false): leave queue intact, no event this season
    } else if (!(s.wars ?? []).some(w => w.enemyId === 'carthage') && !s.flags['messanaResolved']) {
      // Phase 3, Chunk P3-B — Mamertine ignition: guaranteed once eligible
      // (tutorial queue empty, per the branch above; no Carthage war yet),
      // not weighted into the random pool — the plan wants this "fires in
      // the first or second year", which a competing-on-weight pick can't
      // promise.
      //
      // Mediterranean-provinces plan, chunk MP-E: retargeted from the old
      // evt-war-mamertines to evt-messana-appeal (see that event's own
      // header comment in warEvents.ts for why). The messanaResolved guard
      // is new — evt-war-mamertines' only guard was "no carthage war yet",
      // safe because every one of its choices started one. evt-messana-
      // appeal's 'refuse' choice can resolve into lasting peace (its tabled
      // bill actually passing) without ever starting a war, so without this
      // second guard this branch would force-inject the event again every
      // season thereafter. messanaResolved is set the instant either choice
      // fires, so it closes the gate immediately regardless of which way
      // the 'refuse' bill eventually resolves.
      chosenDef = getEventDef('evt-messana-appeal') as typeof chosenDef;
    } else {
      // Normal random event — tutorial queue exhausted or standard start
      chosenDef = pickRandomEvent([...EVENT_DEFS, ...WAR_EVENT_DEFS, ...CADET_EVENT_DEFS, ...COMPROMISING_EVENT_DEFS], s);
    }

    if (chosenDef) {
      const clientCondition = chosenDef.conditions.find(
        c => c.type === 'hasClient'
      ) as { type: 'hasClient'; clientType: ClientType } | undefined;

      const involvedClient = clientCondition
        ? pickOldestClient(s.clients, clientCondition.clientType)
        : undefined;

      const player = s.family.find((c) => c.isPlayer);
      const instance: EventInstance = {
        defId: chosenDef.id,
        firedAtTurn: s.turnNumber,
        targetCharacterId: player?.id ?? 'pc-1',
        clientName: involvedClient?.name,
        clientType: involvedClient?.type,
      };

      s = { ...s, pendingEvents: [...s.pendingEvents, instance] };
    }
  }

  // 13. Tick ambitions
  const { updatedAmbitions, completed, expired } = tickAmbitions(s.ambitions, s);
  s = { ...s, ambitions: updatedAmbitions };

  for (const a of completed) {
    const def = getAmbitionDefinition(a.definitionId);
    if (!def) continue;
    const r = def.reward;
    if (r.gold)             s = { ...s, denarii:          s.denarii          + r.gold };
    if (r.lifetimeDignitas) s = { ...s, lifetimeDignitas:  s.lifetimeDignitas + r.lifetimeDignitas };
    if (r.fides)            s = { ...s, fides:             s.fides            + r.fides };
    if (r.imperium)         s = { ...s, imperium:          s.imperium         + r.imperium };
    if (r.assetId) {
      s = {
        ...s,
        ownedAssets: [
          ...s.ownedAssets,
          { definitionId: r.assetId, currentTier: 1, turnAcquired: s.turnNumber },
        ],
      };
    }
    if (r.reputationBonus) {
      const newReps = { ...s.familyReputations };
      for (const { clanId, delta } of r.reputationBonus) {
        newReps[clanId] = Math.min(100, Math.max(-100, (newReps[clanId] ?? 0) + delta));
      }
      s = { ...s, familyReputations: newReps };
    }
    events.push(`Ambition complete: "${def.title}". Rewards applied.`);
  }

  for (const a of expired) {
    const def = getAmbitionDefinition(a.definitionId);
    if (!def?.consequence) continue;
    const c = def.consequence;
    if (c.gold)             s = { ...s, denarii:         Math.max(0, s.denarii + c.gold) };
    if (c.lifetimeDignitas) s = { ...s, lifetimeDignitas: Math.max(0, s.lifetimeDignitas + c.lifetimeDignitas) };
    if (c.familyTrustDelta) {
      s = {
        ...s,
        family: s.family.map(m =>
          m.isPlayer
            ? { ...m, familyTrust: Math.max(0, Math.min(100, m.familyTrust + c.familyTrustDelta!)) }
            : m
        ),
      };
    }
    events.push(`Ambition expired: "${def.title}". Consequences applied.`);
  }

  // 13b. Re-offer ambition selection for any scope left without an active ambition —
  // covers a scope that was skipped/dismissed earlier as well as one that just
  // completed or expired above. Without this, dismissing the prompt once meant it
  // never returned, since pendingAmbitionScopes was only ever cleared, not refilled.
  {
    const scopesNeeded: ('family' | 'character')[] = [];
    if (!s.ambitions.some(a => a.status === 'active' && a.scope === 'family')) {
      scopesNeeded.push('family');
    }
    const player = s.family.find(c => c.isPlayer);
    if (!s.ambitions.some(a => a.status === 'active' && a.scope === 'character' && a.assignedCharacterId === player?.id)) {
      scopesNeeded.push('character');
    }
    if (scopesNeeded.length > 0) {
      s = {
        ...s,
        pendingAmbitionScopes: Array.from(new Set([...s.pendingAmbitionScopes, ...scopesNeeded])),
      };
    }
  }

  // 14. Corruption tick
  // Chunk 1C: Tribune holder is sacrosanct — skip corruption accumulation for them.
  {
    const player = s.family.find(c => c.isPlayer);
    if (player && player.id !== s.tribuneHolder) {
      const assetBonuses = computeTotalAssetBonuses(s.ownedAssets);
      const houseBonuses = computeHouseBonuses(s.house);
      const shield = (assetBonuses.corruptionShield ?? 0) + houseBonuses.corruptionShield;
      const newScore = tickCorruption(player.corruptionScore, s.crisisLevel, shield);
      if (newScore !== player.corruptionScore) {
        s = {
          ...s,
          family: s.family.map(c =>
            c.isPlayer ? { ...c, corruptionScore: newScore } : c
          ),
        };
      }
    }
  }

  // 15. Trial prep growth + jury lean + session entry (Phase 4, P4-C grew
  // npcStrength/juryLean and resolved the trial synchronously the instant
  // turnNumber reached startsSeason; P4-E makes trial day an interactive
  // 3-beat session, so this step no longer resolves anything — it only
  // grows the case and, when the day arrives, draws the beat queue
  // (trialBeatEngine.drawTrialBeats) and flips status to 'in_session'.
  // gameStore's answerTrialBeat/fastResolveTrialSession call
  // trialEngine.resolveTrialOutcome once the session's last beat resolves —
  // see that function's header comment for the full verdict/consequences
  // logic this step used to run inline.
  {
    const sessionEvents: string[] = [];

    const updatedTrials = (s.trials ?? []).map(trial => {
      if (trial.status !== 'preparing') return trial;

      const opponentFound = findOpponentLeader(trial, s.clans);

      const npcStrength = opponentFound
        ? trial.npcStrength + computeOpponentPrepGrowth(opponentFound.leader.skills.intrigus, opponentFound.clan.influence)
        : trial.npcStrength;
      const juryLean = computeJuryLean(s.clans, s.familyReputations);
      const grownTrial: TrialState = { ...trial, npcStrength, juryLean };

      if (s.turnNumber < grownTrial.startsSeason) return grownTrial;

      // ── Trial day arrives — enter session ──────────────────────────────
      // Bribe-discovery rolls happen exactly once, right here (the draw is
      // a one-time event per trial) — BALANCE.trials.prep.juryBribeDiscoveryChance
      // / praetorBribeDiscoveryChance, "inert until P4-E" per their own
      // header comments in balance.ts. A discovered bribe's Ethos
      // contribution is voided immediately, whether or not the player ever
      // sees/answers its mandatory beat.
      let ethosAfterDiscovery = grownTrial.playerPrep.ethos;
      const discoveredBribeClanIds: string[] = [];
      for (const clanId of grownTrial.playerPrep.bribedClanIds) {
        if (Math.random() < BALANCE.trials.prep.juryBribeDiscoveryChance) {
          discoveredBribeClanIds.push(clanId);
          ethosAfterDiscovery -= BALANCE.trials.prep.bribeJurorsBonusPerBloc;
        }
      }
      let discoveredPraetorBribe = false;
      if (grownTrial.playerPrep.praetorBribed && Math.random() < BALANCE.trials.prep.praetorBribeDiscoveryChance) {
        discoveredPraetorBribe = true;
        ethosAfterDiscovery -= BALANCE.trials.prep.bribePraetorBonus;
      }

      const unattackedWitnesses = grownTrial.playerPrep.witnesses.filter(w => !w.attacked);
      const hasUnattackedWitness = unattackedWitnesses.length > 0;
      const witnessAttackTargetId = hasUnattackedWitness
        ? unattackedWitnesses[Math.floor(Math.random() * unattackedWitnesses.length)].id
        : null;

      const chargeDef = TRIAL_CHARGE_DEFS[grownTrial.charge];
      const beatIds = drawTrialBeats(TRIAL_BEATS, {
        chargeTags: chargeDef.beatTags,
        approach: grownTrial.approach,
        opponentTraitIds: opponentFound?.leader.traits ?? [],
        hasUnattackedWitness,
        discoveredBribeClanIds,
        discoveredPraetorBribe,
      }, Math.random);

      const sessionDefendant = grownTrial.defendant;
      const defendantName = sessionDefendant.kind === 'family'
        ? (s.family.find(c => c.id === sessionDefendant.characterId)?.name ?? 'your family')
        : (opponentFound?.leader.name ?? 'the accused');
      sessionEvents.push(`⚖️ Trial day has come: ${chargeDef.displayName} — ${defendantName}.`);

      return {
        ...grownTrial,
        playerPrep: { ...grownTrial.playerPrep, ethos: Math.max(0, ethosAfterDiscovery) },
        status: 'in_session' as const,
        session: {
          beatIds,
          currentBeatIndex: 0,
          performanceSoFar: 0,
          resolutions: [],
          discoveredBribeClanIds,
          discoveredPraetorBribe,
          witnessAttackTargetId,
        },
      };
    });

    s = { ...s, trials: updatedTrials };
    events.push(...sessionEvents);
  }

  // 16. Trial trigger check (Phase 4, P4-C — builds a TrialState now; the
  // seeding formula (accuserIntrigus, initial strength, baseline prep) is
  // copied verbatim from the pre-P4-C buildTrial call per the plan's
  // instruction to "reuse the formula as the NPC-side initial strength" —
  // including the sphere-based accuserIntrigus hardcode (7/4), not a switch
  // to leader.skills.intrigus, to avoid a silent behavior change alongside
  // the rework. No client trialDefenseBonus here, same as before — only
  // buildTrialFromState (unused by this call site) ever resolved that.)
  {
    const trigger = shouldTriggerTrial(s);
    if (trigger) {
      const accused      = s.family.find(c => c.id === trigger.accusedId);
      const accusingClan = s.clans.find(c => c.id === trigger.accusingClanId);
      const accuserLeader  = accusingClan?.leaders[0];
      const accuserIntrigus = accuserLeader?.sphere === 'intelligence' ? 7 : 4;
      const assetBonuses    = computeTotalAssetBonuses(s.ownedAssets);
      const trialDefenseBonus = assetBonuses.trialDefenseBonus ?? 0;

      const initialNpcStrength = Math.min(100, accuserIntrigus * 2 + (accused?.corruptionScore ?? 0) / 2);
      const baselinePrep = Math.min(100, 20 + trialDefenseBonus);
      const player = s.family.find(c => c.isPlayer);

      const newTrial: TrialState = {
        ...buildTrialState({
          id: `trial-${Date.now()}`,
          seat: 'defense',
          charge: trigger.charge,
          chargeSource: trigger.chargeSource,
          prosecutor: { kind: 'leader', leaderId: accuserLeader?.id ?? '' },
          defendant: { kind: 'family', characterId: trigger.accusedId },
          filedSeason: s.turnNumber,
          startsSeason: s.turnNumber + BALANCE.trials.npcInitiatedDelay,
          initialNpcStrength,
          speakerId: player?.id ?? trigger.accusedId,
        }),
        // Seeded into Logos (implementer's call, same as convertLegacyTrial —
        // the asset-driven baseline defense bonus is an undifferentiated
        // flat number, no section it more naturally belongs to).
        playerPrep: {
          logos: baselinePrep, pathos: 0, ethos: 0,
          actionsUsed: [], witnesses: [], bribedClanIds: [], praetorBribed: false,
        },
      };

      s = { ...s, trials: [...s.trials, newTrial] };
      events.push(
        `⚖️ ${accusingClan?.name ?? 'A rival faction'} has brought charges of ${TRIAL_CHARGE_DEFS[trigger.charge].displayName} against ${accused?.name ?? 'your family'}. Trial begins in ${BALANCE.trials.npcInitiatedDelay} seasons.`
      );

      // Military Overhaul M4: consume the defeatedGeneral flag once it
      // actually produces a trial (it otherwise re-rolls every season).
      if (trigger.charge === 'military_incompetence') {
        const { [`defeatedGeneral-${trigger.accusedId}`]: _consumed, ...restFlags } = s.flags;
        s = { ...s, flags: restFlags };
      }
    }
  }

  // 16b. Phase 4, Chunk P4-C — leader corruption tick (see
  // trialEngine.tickLeaderCorruption's header comment for the "no
  // NPC-governorship simulation exists" caveat). Feeds the corruption-gated
  // prosecution-filing path.
  {
    s = {
      ...s,
      clans: s.clans.map(c => ({
        ...c,
        leaders: c.leaders.map(l => ({ ...l, corruptionScore: tickLeaderCorruption(l) })),
      })),
    };
  }

  // 16c. Passive remarriage check — keeps births available across
  // generations. A freshly-succeeded heir inherits without a spouse, and an
  // existing spouse can die of old age the same as anyone else (step 10's
  // yearly mortality roll) — either way births would otherwise stop for
  // good, since nothing else in this codebase ever grants a new spouse. See
  // inheritanceEngine.needsSpouse/generateSpouse's header comment.
  if (needsSpouse(s.family)) {
    if (Math.random() < BALANCE.succession.remarriageChance) {
      const player = s.family.find(c => c.isPlayer)!;
      const spouse = generateSpouse(s.gensSurname);
      s = { ...s, family: [...s.family, spouse] };
      events.push(`${spouse.name} joins the household as ${player.name}'s wife.`);
    }
  }

  // 17. Passive birth check
  if (isBirthEligible(s.family) && s.pendingBirthNaming === null) {
    const prob = calcBirthProbability(s.family);
    if (Math.random() < prob) {
      const player  = s.family.find(c => c.isPlayer)!;
      const spouse  = s.family.find(c => c.role === 'spouse')!;
      const role: 'son' | 'daughter' = Math.random() < 0.5 ? 'son' : 'daughter';
      const inheritedTraits = resolveInheritedTraits(player, spouse);

      const baseSkills = {
        rhetoric: Math.max(1, Math.min(8, Math.round((player.skills.rhetoric + spouse.skills.rhetoric) / 2 + (Math.random() * 2 - 1)))),
        martial:  Math.max(1, Math.min(8, Math.round((player.skills.martial  + spouse.skills.martial)  / 2 + (Math.random() * 2 - 1)))),
        intrigus: Math.max(1, Math.min(8, Math.round((player.skills.intrigus + spouse.skills.intrigus) / 2 + (Math.random() * 2 - 1)))),
      };

      const suggestedName = suggestChildName(role, s.gensSurname);

      s = {
        ...s,
        pendingBirthNaming: { suggestedName, role, inheritedTraits, baseSkills },
      };
      events.push(`A child is expected in the ${s.gensPlural} household. Name them before the season ends.`);
    }
  }

  // 18. Patron tier update and favour call-ins
  {
    const newPatronTier = computePatronTier(s.lifetimeDignitas);
    if (newPatronTier !== s.patronTier) {
      const tierDef  = PATRON_TIER_DEFINITIONS[newPatronTier];
      const advanced  = newPatronTier > s.patronTier;
      const direction = advanced ? 'risen to' : 'fallen to';
      events.push(`Your family has ${direction} "${tierDef.label}" on the Patron Ladder.`);

      // P2-B: celebrate advancement with a Philon-voiced interstitial. Rare
      // Dignitas-penalty demotions get the plain ledger headline above only —
      // there's nothing to celebrate there.
      if (advanced) {
        const bonusLine =
          `Your household may now sponsor ${tierDef.passiveBonus.clientSlots} clients, ` +
          `and Fides income rises ×${tierDef.passiveBonus.fidesMultiplier.toFixed(2)}.`;
        const noticeBody =
          `Philon does not smile often. "Rome has taken notice, Domine. The Gens ${s.gensName} now stands as ` +
          `${tierDef.label}. ${bonusLine} Greater names carry greater expectations."`;
        const player = s.family.find(c => c.isPlayer);
        s = {
          ...s,
          pendingEvents: [...s.pendingEvents, injectNoticeEvent(
            'evt-patron-tier-up',
            s.turnNumber,
            player?.id ?? 'pc-1',
            { title: tierDef.label, bodyText: noticeBody },
          )],
        };
      }

      s = { ...s, patronTier: newPatronTier };
    }

    const { fidesOwed, callInCount } = processFavourCallIns(s.patronTier, s.clients.length, s.rome.plebs);
    if (callInCount > 0) {
      s = { ...s, fides: Math.max(0, s.fides - fidesOwed) };
      events.push(`${callInCount} client${callInCount !== 1 ? 's' : ''} called in favour${callInCount !== 1 ? 's' : ''} this season (−${fidesOwed} Fides).`);
    }
  }

  // ── End-of-turn maintenance ──────────────────────────────────────────────────

  // Increment Aedile games counter each season.
  {
    const prev = (s.flags['seasonsSinceAedileGames'] as number | undefined) ?? 0;
    s = { ...s, flags: { ...s.flags, seasonsSinceAedileGames: prev + 1 } };
  }

  // Decrement all numeric cooldown flags.
  {
    const updatedFlags = { ...s.flags };
    for (const [key, val] of Object.entries(updatedFlags)) {
      if (key.endsWith('-cooldown') && typeof val === 'number' && val > 0) {
        const newVal = val - 1;
        if (newVal <= 0) delete updatedFlags[key];
        else updatedFlags[key] = newVal;
      }
    }
    s = { ...s, flags: updatedFlags };
  }

  // Dictator overstay consequences (Chunk 1C) ─────────────────────────────────
  // Each season the dictator-overstaying flag is set: apply relationship and crisis penalties.
  // After 3 consecutive overstay seasons, fire the assassination attempt event.
  if (s.flags['dictator-overstaying']) {
    const overstaySeasons = (s.dictatorOverstaySeasons ?? 0) + 1;

    // All clans -5 relationship (applied directly to each leader)
    const updatedClans = s.clans.map(clan => ({
      ...clan,
      leaders: clan.leaders.map(l => ({
        ...l,
        relationship: Math.min(100, Math.max(-100, l.relationship - 5)),
      })),
    }));

    s = {
      ...s,
      dictatorOverstaySeasons: overstaySeasons,
      clans: updatedClans,
      crisis: {
        ...s.crisis,
        constitution: applyTrackDelta(s.crisis.constitution, 8),
        war:          applyTrackDelta(s.crisis.war, 3),
      },
    };

    events.push('The Dictator continues to hold power beyond the emergency. Rome grows restless.');

    if (overstaySeasons >= 3) {
      const player = s.family.find(c => c.isPlayer);
      s = {
        ...s,
        pendingEvents: [...s.pendingEvents, {
          defId: 'evt-assassination-attempt',
          firedAtTurn: s.turnNumber,
          targetCharacterId: player?.id ?? 'pc-1',
        }],
      };
      events.push('A conspiracy against the Dictator has been set in motion.');
    }
  }

  return { nextState: s, events };
}
