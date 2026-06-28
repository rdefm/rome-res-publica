import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import type { CampaignState, PendingGovernorAssignment, CommanderElectionState } from '../models/province';
import {
  calcResourceIncome,
  applyEffectString,
  applyFactionDrift,
  calcRomeStats,
  calcCrisisEscalation,
  applyRelationshipDrift,
} from './resourceEngine';
import { resolveElection } from './electionEngine';
import { pickRandomEvent } from './eventEngine';
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
import {
  drawGovernorLot,
  generateCommanderCandidates,
  resolveCommanderElection,
} from './campaignEngine';
import { TRIAL_ACTIONS } from '../data/trialActions';
import { EVENT_DEFS } from '../data/events';
import { OFFICES } from '../data/offices';
import { AUTO_BILL_TEMPLATES } from '../data/billTemplates';
import type { Bill } from '../models/bill';

let billIdCounter = 1000;
function nextBillId(): string {
  return `auto-${billIdCounter++}`;
}

// ─── Client helpers ──────────────────────────────────────────────────────────

function pickOldestClient(clients: Client[], type: ClientType): Client | undefined {
  return clients
    .filter(c => c.type === type)
    .sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
}

// ─── Season processor ────────────────────────────────────────────────────────

export function processSeason(state: GameState): {
  nextState: GameState;
  events: string[];
} {
  const events: string[] = [];
  let s = { ...state };

  // 1. Advance season / year
  const newSeasonIndex = (s.seasonIndex + 1) % 4;
  const crossedNewYear = newSeasonIndex === 0;
  const newYear = crossedNewYear ? s.year - 1 : s.year;
  s = { ...s, seasonIndex: newSeasonIndex, year: newYear, turnNumber: s.turnNumber + 1 };

  const seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter'];
  events.push(`${seasonNames[newSeasonIndex]}, ${Math.abs(newYear)} BC`);

  // 2. Resolve election (if in Winter and campaigning)
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
        `ELECTED! ${s.family.find(c => c.id === s.campaigningCharacterId)?.name ?? 'Your candidate'} wins the ${office?.name ?? ''} with ${result.playerVotes} votes.`
      );
    } else {
      s = { ...s, campaigning: null, campaignVotes: {}, electionRivals: [] };
      events.push(
        `Defeated. Marcus receives ${result.playerVotes} votes. ${result.topRivalName} wins with ${result.topRivalVotes}.`
      );
    }
  }

  // 2b. Resolve pending commander election (votes close at end of season)
  if (s.pendingCommanderElection && !s.pendingCommanderElection.resolved) {
    const electionResult = resolveCommanderElection(s.pendingCommanderElection, s);
    const winnerCandidate = s.pendingCommanderElection.candidates
      .find(c => c.characterId === electionResult.winnerId);
    const provinceId = s.pendingCommanderElection.provinceId;
    const campaignType = s.pendingCommanderElection.campaignType;

    const newCampaign: CampaignState = {
      id: `campaign_${provinceId}_${s.turnNumber}`,
      provinceId,
      type: campaignType,
      commanderCharacterId: winnerCandidate?.isPlayerFamily ? winnerCandidate.characterId : null,
      campaignProgress: 10,
      enemyStrength: 70,
      turnsElapsed: 0,
      localSupportBonus: false,
      resolved: false,
      outcome: null,
      activeEventId: null,
    };

    s = {
      ...s,
      provinces: s.provinces.map(p =>
        p.id === provinceId ? { ...p, activeCampaign: newCampaign } : p
      ),
      pendingCommanderElection: { ...s.pendingCommanderElection, resolved: true },
      activeCampaignVotes: {},
      campaignVotes: {},
    };

    events.push(electionResult.logMsg);

    if (winnerCandidate?.isPlayerFamily) {
      s = {
        ...s,
        family: s.family.map(c =>
          c.id === winnerCandidate.characterId
            ? { ...c, officeId: `commander_${provinceId}` }
            : c
        ),
      };
      events.push(
        `${winnerCandidate.characterName} takes command. Open the Military tab in ` +
        `${provinceId.replace('_', ' ')} to direct the campaign.`
      );
    }
  }

  // 3. Tick office term
  if (s.currentOffice && s.officeSeasons > 0) {
    const newOfficeSeasons = s.officeSeasons - 1;

    // Final season in office — enable rig-the-lot for consul/praetor
    if (newOfficeSeasons === 1 &&
        (s.currentOffice === 'consul' || s.currentOffice === 'praetor')) {
      s = { ...s, officeSeasons: newOfficeSeasons, rigLotAvailable: true };
      events.push(
        `Your term as ${OFFICES.find(o => o.id === s.currentOffice)?.name ?? ''} ends next season. ` +
        `You may attempt to influence the provincial lot before your term concludes.`
      );
    } else if (newOfficeSeasons === 0) {
      const officeName = OFFICES.find((o) => o.id === s.currentOffice)?.name ?? '';
      events.push(`Your term as ${officeName} has ended.`);

      // Governor lot draw for consul/praetor
      if (s.currentOffice === 'consul' || s.currentOffice === 'praetor') {
        const player = s.family.find(c => c.isPlayer);
        const eligibleProvinceIds = s.provinces
          .filter(p => p.status === 'incorporated' && !p.playerGovernor && p.id !== 'latium')
          .map(p => p.id);

        if (eligibleProvinceIds.length > 0 && player) {
          const baseAssignment: PendingGovernorAssignment = {
            characterId: player.id,
            characterName: player.name,
            isPlayerFamily: true,
            clanId: 'brutii',
            rigAttempted: s.pendingGovernorAssignment?.rigAttempted ?? false,
            rigSucceeded: s.pendingGovernorAssignment?.rigSucceeded ?? false,
            assignedProvinceId: null,
          };

          if (baseAssignment.rigSucceeded) {
            // Player gets to choose — UI will prompt them to pick
            s = {
              ...s,
              currentOffice: null,
              officeSeasons: 0,
              rigLotAvailable: false,
              pendingGovernorAssignment: baseAssignment,
            };
            events.push(
              `The lot is to be drawn. Your influence holds — choose your province of appointment.`
            );
          } else {
            // Draw randomly and assign immediately
            const drawnProvinceId = drawGovernorLot(eligibleProvinceIds);
            const drawnProvince = s.provinces.find(p => p.id === drawnProvinceId);
            s = {
              ...s,
              currentOffice: null,
              officeSeasons: 0,
              rigLotAvailable: false,
              pendingGovernorAssignment: { ...baseAssignment, assignedProvinceId: drawnProvinceId },
              provinces: s.provinces.map(p =>
                p.id === drawnProvinceId
                  ? {
                      ...p,
                      playerGovernor: {
                        characterId: player.id,
                        policy: {
                          taxation: 'standard' as const,
                          security: 'standard_garrison' as const,
                          development: 'maintain' as const,
                        },
                        corruptionAccrued: 0,
                        turnsServed: 0,
                      },
                      npcRoleHolder: null,
                    }
                  : p
              ),
              family: s.family.map(c =>
                c.id === player.id
                  ? { ...c, officeId: `governor_${drawnProvinceId}` }
                  : c
              ),
            };
            events.push(
              `The lot has been cast. ${player.name} is appointed Governor of ` +
              `${(drawnProvince?.id ?? drawnProvinceId).replace(/_/g, ' ')}.`
            );
          }
        } else {
          s = { ...s, currentOffice: null, officeSeasons: 0, rigLotAvailable: false };
        }
      } else {
        s = { ...s, currentOffice: null, officeSeasons: 0 };
      }
    } else {
      s = { ...s, officeSeasons: newOfficeSeasons };
    }
  }

  // 4. Resolve bills
  const passedBills: Bill[] = [];
  const resolvedLogs: string[] = [];
  const remainingBills: Bill[] = [];

  for (const bill of s.bills) {
    const turnsLeft = bill.turnsLeft - 1;
    if (bill.support > 0) {
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
  s = { ...s, bills: remainingBills };
  events.push(...resolvedLogs);

  // 5. Crisis escalation
  const newCrisis = calcCrisisEscalation(s.crisisLevel, passedBills.length);
  if (newCrisis > s.crisisLevel) events.push(`Crisis worsens — ${newCrisis} / 100.`);
  else if (newCrisis < s.crisisLevel) events.push(`Crisis eases — ${newCrisis} / 100.`);
  s = { ...s, crisisLevel: newCrisis };

  // 6. Rome stat updates
  const romeUpdate = calcRomeStats(s, passedBills.length);
  s = { ...s, rome: { ...s.rome, ...romeUpdate } };

  // 7. Resource income
  const { gravitasIncome, dignitasIncome, gratiaIncome, denariiIncome } = calcResourceIncome(s);

  const legacyBonuses = computeLegacyBonuses(s.legacyObjectives);
  const flatBonus = legacyBonuses.flatBonus ?? {};
  const multiplier = legacyBonuses.resourceMultiplier ?? {};
  const finalGravitas = Math.round((gravitasIncome + (flatBonus.gravitas ?? 0)) * (multiplier.gravitas ?? 1));
  const finalDignitas = Math.round((dignitasIncome + (flatBonus.dignitas ?? 0)) * (multiplier.dignitas ?? 1));
  const finalGratia   = Math.round((gratiaIncome   + (flatBonus.gratia   ?? 0)) * (multiplier.gratia   ?? 1));
  const finalDenarii  = Math.round((denariiIncome  + (flatBonus.gold     ?? 0)) * (multiplier.gold     ?? 1));

  s = {
    ...s,
    gravitas: s.gravitas + finalGravitas,
    dignitas: s.dignitas + finalDignitas,
    gratia:   s.gratia   + finalGratia,
    denarii:  s.denarii  + finalDenarii,
  };

  if (finalDenarii > 0) {
    const { updated: legacyAfterTreasury, newMilestonesReached: tMilestones } =
      incrementLegacy(s.legacyObjectives, 'treasury_legacy', finalDenarii);
    s = { ...s, legacyObjectives: legacyAfterTreasury };
    for (const m of tMilestones) {
      events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  const newLifetimeDignitas = s.lifetimeDignitas + Math.max(0, finalDignitas);

  const patronTierDef = PATRON_TIER_DEFINITIONS[s.patronTier];
  const patronGratiaMultiplier = patronTierDef?.passiveBonus.gratiaMultiplier ?? 1;
  const finalGratiaWithPatron = Math.round(finalGratia * patronGratiaMultiplier);
  const patronGratiaDelta = finalGratiaWithPatron - finalGratia;
  if (patronGratiaDelta > 0) {
    s = { ...s, gratia: s.gratia + patronGratiaDelta };
  }

  s = { ...s, lifetimeDignitas: newLifetimeDignitas };

  events.push(
    `Income: +${finalGravitas} Gravitas, +${finalDignitas} Dignitas, +${finalGratiaWithPatron} Gratia${finalDenarii > 0 ? `, +${finalDenarii} Denarii` : ''}${patronGratiaDelta > 0 ? ` (patron bonus +${patronGratiaDelta})` : ''}`
  );

  // 8. Faction drift
  const factionPatch = applyFactionDrift(s);
  s = { ...s, ...factionPatch };

  // 9. Relationship drift and alliance ticks
  s = { ...s, clans: applyRelationshipDrift(s) };

  // 9c. Province tick — relationship, infrastructure, gold/imperium from provinces
  if (s.provinces && s.provinces.length > 0) {
    const { updatedProvinces, totalGoldDelta, totalImperiumDelta, events: provinceEvents } =
      tickAllProvinces(s.provinces, s);

    s = {
      ...s,
      provinces: updatedProvinces,
      denarii:  s.denarii  + totalGoldDelta,
      imperium: s.imperium + totalImperiumDelta,
      lifetimeImperium: (s.lifetimeImperium ?? 0) + Math.max(0, totalImperiumDelta),
    };

    for (const msg of provinceEvents) {
      events.push(msg);
    }

    if (totalGoldDelta > 0 || totalImperiumDelta > 0) {
      events.push(
        `Provincial income: +${totalGoldDelta} Gold, +${totalImperiumDelta} Imperium from Italy.`
      );
    }

    // 9c-ii. Clear officeId on family members whose governorship just ended
    // (provinceEngine removes playerGovernor from the province; we sync the character here)
    const activeGovernorIds = new Set(
      s.provinces
        .filter(p => p.playerGovernor)
        .map(p => p.playerGovernor!.characterId)
    );
    const familyNeedsSync = s.family.some(
      c => c.officeId?.startsWith('governor_') && !activeGovernorIds.has(c.id)
    );
    if (familyNeedsSync) {
      s = {
        ...s,
        family: s.family.map(c =>
          c.officeId?.startsWith('governor_') && !activeGovernorIds.has(c.id)
            ? { ...c, officeId: null }
            : c
        ),
      };
    }
  }

  // 9d. Trigger commander elections for provinces that need campaigns but lack one
  if (!s.pendingCommanderElection || s.pendingCommanderElection.resolved) {
    for (const province of s.provinces) {
      const needsCampaign =
        (province.revoltActive && !province.activeCampaign) ||
        (province.warDeclarationAvailable && !province.activeCampaign);

      if (needsCampaign) {
        const campaignType: CampaignState['type'] =
          province.revoltActive ? 'suppression' : 'conquest';
        const candidates = generateCommanderCandidates(province.id, s);

        const newElection: CommanderElectionState = {
          provinceId: province.id,
          campaignType,
          candidates,
          playerSupportedCandidateId: null,
          playerSpeechBonus: 0,
          resolved: false,
        };

        s = { ...s, pendingCommanderElection: newElection };
        events.push(
          `⚔ The Senate must elect a commander for the ${province.id.replace(/_/g, ' ')} ` +
          `${campaignType} campaign. Open the Military tab to support your preferred candidate.`
        );
        break; // one election at a time
      }
    }
  }

  // 9b. Increment survival_legacy each season
  {
    const { updated: legacyAfterSurvival, newMilestonesReached: sMilestones } =
      incrementLegacy(s.legacyObjectives, 'survival_legacy', 1);
    s = { ...s, legacyObjectives: legacyAfterSurvival };
    for (const m of sMilestones) {
      events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  // 10. Age family members
  s = {
    ...s,
    family: s.family.map((c) => ({ ...c, age: c.age + (crossedNewYear ? 1 : 0) })),
  };

  // 11. Auto-inject bills if below minimum
  if (s.bills.length < 2) {
    const existing = new Set(s.bills.map((b) => b.name));
    const candidates = AUTO_BILL_TEMPLATES.filter((t) => !existing.has(t.name));
    const toAdd = candidates.slice(0, 2 - s.bills.length);
    const newBills: Bill[] = toAdd.map((t) => ({
      ...t,
      id: nextBillId(),
    }));
    s = { ...s, bills: [...s.bills, ...newBills] };
    for (const b of newBills) events.push(`New bill introduced: ${b.name}.`);
  }

  // 12. Pick and inject one end-of-season event (if eligible)
  const chosenDef = pickRandomEvent(EVENT_DEFS, s);
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

  // 13. Tick ambitions
  const { updatedAmbitions, completed, expired } = tickAmbitions(s.ambitions, s);
  s = { ...s, ambitions: updatedAmbitions };

  for (const a of completed) {
    const def = getAmbitionDefinition(a.definitionId);
    if (!def) continue;
    const r = def.reward;
    if (r.gold)      s = { ...s, denarii:   s.denarii   + r.gold };
    if (r.dignitas)  s = { ...s, dignitas:  s.dignitas  + r.dignitas };
    if (r.gratia)    s = { ...s, gratia:    s.gratia    + r.gratia };
    if (r.gravitas)  s = { ...s, gravitas:  s.gravitas  + r.gravitas };
    if (r.imperium)  s = { ...s, imperium:  s.imperium  + r.imperium };
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
    if (c.gold)             s = { ...s, denarii:  Math.max(0, s.denarii + c.gold) };
    if (c.dignitas)         s = { ...s, dignitas: Math.max(0, s.dignitas + c.dignitas) };
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

  // 14. Corruption tick
  {
    const player = s.family.find(c => c.isPlayer);
    if (player) {
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

      s = { ...s, dignitas: Math.max(0, s.dignitas + cons.dignitas) };

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
        s = {
          ...s,
          family: s.family.filter(c => c.id !== trial.accusedCharacterId),
        };
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
      const accused = s.family.find(c => c.id === trigger.accusedId);
      const accusingClan = s.clans.find(c => c.id === trigger.accusingClanId);
      const accuserLeader = accusingClan?.leaders[0];
      const accuserIntrigus = accuserLeader?.sphere === 'intelligence' ? 7 : 4;
      const assetBonuses = computeTotalAssetBonuses(s.ownedAssets);
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
      const player = s.family.find(c => c.isPlayer)!;
      const spouse = s.family.find(c => c.role === 'spouse')!;
      const role: 'son' | 'daughter' = Math.random() < 0.5 ? 'son' : 'daughter';
      const inheritedTraits = resolveInheritedTraits(player, spouse);

      const baseSkills = {
        rhetoric:   Math.max(1, Math.min(8, Math.round((player.skills.rhetoric   + spouse.skills.rhetoric)   / 2 + (Math.random() * 2 - 1)))),
        auctoritas: Math.max(1, Math.min(8, Math.round((player.skills.auctoritas + spouse.skills.auctoritas) / 2 + (Math.random() * 2 - 1)))),
        martial:    Math.max(1, Math.min(8, Math.round((player.skills.martial    + spouse.skills.martial)    / 2 + (Math.random() * 2 - 1)))),
        intrigus:   Math.max(1, Math.min(8, Math.round((player.skills.intrigus   + spouse.skills.intrigus)   / 2 + (Math.random() * 2 - 1)))),
      };

      const suggestedName = suggestChildName(role, 'Brutus');

      s = {
        ...s,
        pendingBirthNaming: {
          suggestedName,
          role,
          inheritedTraits,
          baseSkills,
        },
      };
      events.push(`A child is expected in the Brutii household. Name them before the season ends.`);
    }
  }

  // 18. Patron tier update and favour call-ins
  {
    const newPatronTier = computePatronTier(s.lifetimeDignitas, s.gratia);
    if (newPatronTier !== s.patronTier) {
      const tierDef = PATRON_TIER_DEFINITIONS[newPatronTier];
      const direction = newPatronTier > s.patronTier ? 'risen to' : 'fallen to';
      events.push(`Your family has ${direction} "${tierDef.label}" on the Patron Ladder.`);
      s = { ...s, patronTier: newPatronTier };
    }

    const { gratiaOwed, callInCount } = processFavourCallIns(s.patronTier, s.clients.length);
    if (callInCount > 0) {
      s = { ...s, gratia: Math.max(0, s.gratia - gratiaOwed) };
      events.push(`${callInCount} client${callInCount !== 1 ? 's' : ''} called in favour${callInCount !== 1 ? 's' : ''} this season (−${gratiaOwed} Gratia).`);
    }
  }

  return { nextState: s, events };
}
