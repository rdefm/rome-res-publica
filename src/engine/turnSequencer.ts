import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import type { CrisisTrackId } from '../models/crisis';
import type { Bill } from '../models/bill';
import {
  calcResourceIncome,
  applyEffectString,
  applyFactionDrift,
  calcRomeStats,
  calcRomeStatModifiers,
  applyRelationshipDrift,
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
import { pickRandomEvent, evalCondition } from './eventEngine';
import { tickAmbitions, getAmbitionDefinition } from './ambitionEngine';
import { incrementLegacy, computeLegacyBonuses } from './legacyEngine';
import {
  isBirthEligible,
  calcBirthProbability,
  resolveInheritedTraits,
  suggestChildName,
} from './inheritanceEngine';
import {
  shouldTriggerTrial,
  buildTrial,
  resolveTrial,
  OUTCOME_CONSEQUENCES,
  tickCorruption,
} from './trialEngine';
import { computePatronTier, processFavourCallIns } from './patronEngine';
import { PATRON_TIER_DEFINITIONS } from '../models/patronLadder';
import { computeTotalAssetBonuses } from './assetEngine';
import { tickAllProvinces } from './provinceEngine';
import { applyTroopAttrition, calcMilitaryImperium } from './troopEngine';
import { tickSenateResponse } from './senateResponseEngine';
import { calcAntagonismLevel, tickNpcConsul } from './npcConsulEngine';
import { TRIAL_ACTIONS } from '../data/trialActions';
import { EVENT_DEFS } from '../data/events';
import { OFFICES } from '../data/offices';
import { AUTO_BILL_TEMPLATES, BILL_TEMPLATES, HISTORICAL_BILL_TEMPLATES } from '../data/billTemplates';
import { getProvinceDefinition } from '../data/provinceDefinitions';

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
  const newSeasonIndex = (s.seasonIndex + 1) % 4;
  const crossedNewYear = newSeasonIndex === 0;
  const newYear = crossedNewYear ? s.year - 1 : s.year;
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
      s = {
        ...s,
        currentOffice: s.campaigning,
        officeSeasons: office?.termSeasons ?? 4,
        heldOffices: s.heldOffices.includes(s.campaigning!)
          ? s.heldOffices
          : [...s.heldOffices, s.campaigning!],
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

  // 9. Relationship drift
  s = { ...s, clans: applyRelationshipDrift(s) };

  // 9c. Province tick
  if (s.provinces && s.provinces.length > 0) {

    // ── 9c-i: Development mandate enforcement (Lex de Provinciarum Cultura) ──
    //
    // While this law is active, any player governor whose development policy is
    // 'exploit' or 'neglect' is silently raised to 'maintain' before tickProvince
    // runs. This means the tick sees the corrected policy: the infrastructure
    // improvement (DEVELOPMENT_INFRA_DELTA['maintain'] = 0, vs -5 for exploit)
    // and the cost difference (DEVELOPMENT_GOLD_COST['maintain'] = 5) are both
    // applied automatically inside calcProvinceGoldOutput — no extra deduction
    // needed here.
    //
    // Only player governors are compelled. NPC role-holders govern by their own
    // trait and are outside the scope of this mandate. Unincorporated provinces
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
          provinces: s.provinces.map(province => {
            // Only incorporated provinces have governors
            if (province.status !== 'incorporated') return province;
            // Only apply to player governors
            if (!province.playerGovernor) return province;

            const currentDev = province.playerGovernor.policy.development;
            // Already meets or exceeds the mandate — no action needed
            if (DEV_NOTCH_ORDER.indexOf(currentDev) >= mandateMinIdx) return province;

            // Force policy up to the mandate minimum
            const def = getProvinceDefinition(province.id);
            events.push(
              `⚖ Senate mandate: ${def?.name ?? province.id} — governor's development raised to Maintain` +
              ` (was ${currentDev === 'exploit' ? 'Exploit' : 'Neglect'}) by Lex de Provinciarum Cultura.`,
            );

            return {
              ...province,
              playerGovernor: {
                ...province.playerGovernor,
                policy: {
                  ...province.playerGovernor.policy,
                  development: MANDATE_MIN,
                },
              },
            };
          }),
        };
      }
    }

    // ── 9c-ii: Province tick ─────────────────────────────────────────────────
    const { updatedProvinces, totalGoldDelta, totalImperiumDelta, events: provinceEvents } =
      tickAllProvinces(s.provinces, s);

    s = {
      ...s,
      provinces: updatedProvinces,
      denarii:  s.denarii  + totalGoldDelta,
      imperium: s.imperium + totalImperiumDelta,
      lifetimeImperium: (s.lifetimeImperium ?? 0) + Math.max(0, totalImperiumDelta),
    };

    for (const msg of provinceEvents) events.push(msg);

    if (totalGoldDelta > 0 || totalImperiumDelta > 0) {
      events.push(`Provincial income: +${totalGoldDelta} Gold, +${totalImperiumDelta} Imperium from Italy.`);
    }

    // ── 9c-iii: Lex de Viis — province infrastructure boost ─────────────────
    //
    // While the road maintenance law is active, all non-heartland provinces gain
    // +1 infrastructure rating each season, on top of whatever their governor's
    // development policy already produced. This represents the Senate funding
    // direct road-building across the Republic.
    //
    // The treasury cost is 3 points of rome.treasury per province. A larger
    // empire costs proportionally more to maintain — this is the design intent.
    // The cost drains the public treasury (rome.treasury), not the player's
    // personal denarii, since road maintenance is a senatorial expenditure.
    //
    // Note: The +1 infra here also resets the infraStagnationSeasons counter
    // inside tickProvince for the *next* season (because currInfra > prevInfra
    // once this is applied). However, since the tick already ran this season
    // before this block executes, the stagnation counter effect is delayed by
    // one season — which is intentional and correct.
    {
      const lexDeViisActive = (s.activeLaws ?? []).some(l => l.billId === 'lex-de-viis');

      if (lexDeViisActive) {
        const nonHeartlandProvinces = s.provinces.filter(p => p.status !== 'heartland');
        const provCount = nonHeartlandProvinces.length;

        if (provCount > 0) {
          const treasuryCost = provCount * 3;

          s = {
            ...s,
            provinces: s.provinces.map(p =>
              p.status === 'heartland'
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
            ` province${provCount !== 1 ? 's' : ''} (+1 each, −${treasuryCost} Treasury).`,
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
    const updatedProvinces = s.provinces.map(province => {
      const volunteer = province.officerVolunteer;
      const campaign  = province.activeCampaign;
      if (!volunteer?.resolved || !campaign || campaign.resolved || campaign.commanderCharacterId !== null) {
        return province;
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
        ...province,
        revoltActive:      revoltSuppressed ? false : province.revoltActive,
        relationshipScore: Math.min(100, Math.max(0, province.relationshipScore + relationshipDelta)),
        activeCampaign:    { ...campaign, resolved: true, outcome },
        officerVolunteer:  null,
      };
    });
    s = { ...s, provinces: updatedProvinces };
  }

  // 9h. Triumph bill trigger (Chunk 1C) ────────────────────────────────────────
  // After campaign resolution: check each province for a completed victory.
  // If found and threshold conditions met, push a Triumph bill to the Senate queue.
  {
    for (const province of s.provinces) {
      const campaign = province.activeCampaign;
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

  // 10. Age family members
  s = {
    ...s,
    family: s.family.map((c) => ({ ...c, age: c.age + (crossedNewYear ? 1 : 0) })),
  };

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
    } else {
      // Normal random event — tutorial queue exhausted or standard start
      chosenDef = pickRandomEvent(EVENT_DEFS, s);
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
      const shield = assetBonuses.corruptionShield ?? 0;
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

  // 15. Trial resolution
  {
    let trialEvents: string[] = [];
    const updatedTrials = s.trialQueue.map(trial => {
      if (trial.resolved) return trial;
      const newTurns = trial.turnsRemaining - 1;
      if (newTurns > 0) return { ...trial, turnsRemaining: newTurns };

      const outcome = resolveTrial(trial);
      const cons = OUTCOME_CONSEQUENCES[outcome];
      const accused = s.family.find(c => c.id === trial.accusedCharacterId);
      const accusedName = accused?.name ?? 'the accused';

      trialEvents.push(`Trial resolved: ${accusedName} — ${outcome.toUpperCase()}.`);

      if (cons.reputationDelta !== 0 && trial.accusingClanId) {
        const newRep = Math.min(100, Math.max(-100,
          (s.familyReputations[trial.accusingClanId] ?? 0) + cons.reputationDelta
        ));
        s = { ...s, familyReputations: { ...s.familyReputations, [trial.accusingClanId]: newRep } };
      }

      s = { ...s, lifetimeDignitas: Math.max(0, s.lifetimeDignitas + cons.lifetimeDignitas) };

      if (cons.denarii) {
        s = { ...s, denarii: Math.max(0, s.denarii + cons.denarii) };
      }

      if (cons.corruptionClear) {
        s = {
          ...s,
          family: s.family.map(c =>
            c.id === trial.accusedCharacterId ? { ...c, corruptionScore: 0 } : c
          ),
        };
      }

      if (cons.familyTrustDelta) {
        s = {
          ...s,
          family: s.family.map(c =>
            c.isPlayer ? { ...c, familyTrust: Math.max(0, c.familyTrust + cons.familyTrustDelta!) } : c
          ),
        };
      }

      if (cons.removeCharacter) {
        s = { ...s, family: s.family.filter(c => c.id !== trial.accusedCharacterId) };
      }

      return { ...trial, resolved: true, outcome };
    });

    s = { ...s, trialQueue: updatedTrials };
    events.push(...trialEvents);
  }

  // 16. Trial trigger check
  {
    const trigger = shouldTriggerTrial(s);
    if (trigger) {
      const accused      = s.family.find(c => c.id === trigger.accusedId);
      const accusingClan = s.clans.find(c => c.id === trigger.accusingClanId);
      const accuserLeader  = accusingClan?.leaders[0];
      const accuserIntrigus = accuserLeader?.sphere === 'intelligence' ? 7 : 4;
      const assetBonuses    = computeTotalAssetBonuses(s.ownedAssets);
      const trialDefenseBonus = assetBonuses.trialDefenseBonus ?? 0;

      const newTrial = buildTrial(
        trigger.accusedId,
        trigger.accusingClanId,
        trigger.charge,
        accuserIntrigus,
        accused?.corruptionScore ?? 0,
        trialDefenseBonus
      );

      s = { ...s, trialQueue: [...s.trialQueue, newTrial] };
      events.push(
        `⚖️ ${accusingClan?.name ?? 'A rival faction'} has brought charges of ${trigger.charge.replace('_', ' ')} against ${accused?.name ?? 'your family'}. ${newTrial.turnsRemaining} seasons to prepare your defense.`
      );
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

      const suggestedName = suggestChildName(role, 'Brutus');

      s = {
        ...s,
        pendingBirthNaming: { suggestedName, role, inheritedTraits, baseSkills },
      };
      events.push(`A child is expected in the Brutii household. Name them before the season ends.`);
    }
  }

  // 18. Patron tier update and favour call-ins
  {
    const newPatronTier = computePatronTier(s.lifetimeDignitas, s.fides);
    if (newPatronTier !== s.patronTier) {
      const tierDef  = PATRON_TIER_DEFINITIONS[newPatronTier];
      const direction = newPatronTier > s.patronTier ? 'risen to' : 'fallen to';
      events.push(`Your family has ${direction} "${tierDef.label}" on the Patron Ladder.`);
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
