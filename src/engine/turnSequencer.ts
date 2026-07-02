import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
import {
  calcResourceIncome,
  applyEffectString,
  applyFactionDrift,
  calcRomeStats,
  calcRomeStatModifiers,
  applyRelationshipDrift,
} from './resourceEngine';
import {
  calcCrisisEscalation,
  getStabilityEscalationMultiplier,
  getTreasuryAbsorption,
  getPlebsCrisisBonus,
} from './crisisEngine';
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
import { TRIAL_ACTIONS } from '../data/trialActions';
import { EVENT_DEFS } from '../data/events';
import { OFFICES } from '../data/offices';
import { AUTO_BILL_TEMPLATES, HISTORICAL_BILL_TEMPLATES } from '../data/billTemplates';
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
  // Register passed bills as active laws
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

  // Remove active laws whose repeal bill just passed
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

  // 5. Crisis escalation — modified by Rome stats
  const romeMods = calcRomeStatModifiers(s.rome);
  const escalationMultiplier = getStabilityEscalationMultiplier(s.rome.stability);
  const crisisAbsorption     = getTreasuryAbsorption(s.rome.treasury);
  const plebsCrisisBonus     = getPlebsCrisisBonus(s.rome.plebs);

  const newCrisis = calcCrisisEscalation(
    s.crisisLevel,
    passedBills.length,
    escalationMultiplier,
    crisisAbsorption,
    plebsCrisisBonus
  );
  if (newCrisis > s.crisisLevel) events.push(`Crisis worsens — ${newCrisis} / 100.`);
  else if (newCrisis < s.crisisLevel) events.push(`Crisis eases — ${newCrisis} / 100.`);
  s = { ...s, crisisLevel: newCrisis };

  // 5b. Log Rome stat threshold labels if meaningful
  if (romeMods.stabilityLabel !== 'Stable') {
    events.push(`Rome stability: ${romeMods.stabilityLabel}.`);
  }
  if (romeMods.plebsLabel !== 'Content') {
    events.push(`Plebs mood: ${romeMods.plebsLabel}.`);
  }
  if (romeMods.treasuryLabel !== 'Adequate') {
    events.push(`Treasury: ${romeMods.treasuryLabel}.`);
  }

  // 6. Rome stat updates
  const romeUpdate = calcRomeStats(s, passedBills.length);
  s = { ...s, rome: { ...s.rome, ...romeUpdate } };

  // 6b. Process active laws — apply ongoing effects and handle expiry
  if (s.activeLaws && s.activeLaws.length > 0) {
    const expiredLaws: string[] = [];
    const renewalBills: typeof s.bills = [];

    for (const law of s.activeLaws) {
      // Apply ongoing effect
      if (law.ongoingEffect) {
        const lawPatch = applyEffectString(law.ongoingEffect, s);
        s = { ...s, ...lawPatch };
      }

      // Check expiry
      if (law.expiresOnTurn !== undefined && s.turnNumber >= law.expiresOnTurn) {
        expiredLaws.push(law.billId);
        const flavour = law.renewalFlavour ?? `The ${law.name} has lapsed.`;
        events.push(flavour);

        // Re-inject if renewable
        if (law.renewable) {
          const allTemplates = [...AUTO_BILL_TEMPLATES, ...HISTORICAL_BILL_TEMPLATES];
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
  const { fidesIncome, denariiIncome } = calcResourceIncome(s);

  const legacyBonuses = computeLegacyBonuses(s.legacyObjectives);
  const flatBonus = legacyBonuses.flatBonus ?? {};
  const multiplier = legacyBonuses.resourceMultiplier ?? {};
  const finalFides   = Math.round((fidesIncome   + (flatBonus.fides ?? 0)) * (multiplier.fides ?? 1));
  const finalDenarii = Math.round((denariiIncome + (flatBonus.gold  ?? 0)) * (multiplier.gold  ?? 1));

  s = {
    ...s,
    fides:   s.fides   + finalFides,
    denarii: s.denarii + finalDenarii,
  };

  if (finalDenarii > 0) {
    const { updated: legacyAfterTreasury, newMilestonesReached: tMilestones } =
      incrementLegacy(s.legacyObjectives, 'treasury_legacy', finalDenarii);
    s = { ...s, legacyObjectives: legacyAfterTreasury };
    for (const m of tMilestones) {
      events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  // lifetimeDignitas is NOT incremented here — it has no passive seasonal income

  // NOTE: the patron tier's fidesMultiplier is already applied inside
  // calcResourceIncome() (resourceEngine.ts, Step 2), scoped to base rhetoric
  // income only. Do NOT reapply it here — doing so double-multiplies fides
  // income for any patron tier above 0, and desyncs this total from the
  // "projected income" figure ResourceBar.tsx shows the player (which calls
  // calcResourceIncome() directly and only sees the single application).

  events.push(
    `Income: +${finalFides} Fides${finalDenarii > 0 ? `, +${finalDenarii} Denarii` : ''}`
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

  // 11. Auto-inject bills if below minimum + stability/treasury forced injections
  // Force Lex de Vectigalibus if treasury is bankrupt and no tax bill is active
  if (s.rome.treasury <= 9) {
    const vectigalisActive = s.bills.some(b => b.name === 'Lex de Vectigalibus') ||
      (s.activeLaws ?? []).some(l => l.billId === 'lex-de-vectigalibus');
    if (!vectigalisActive) {
      const template = HISTORICAL_BILL_TEMPLATES.find(t => t.id === 'lex-de-vectigalibus');
      if (template) {
        s = { ...s, bills: [...s.bills, { ...template, id: nextBillId() }] };
        events.push(`Emergency: Treasury is bankrupt — Lex de Vectigalibus has been introduced.`);
      }
    }
  }

  // 10% chance to force Senatus Consultum Ultimum when stability < 15
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
        rhetoric: Math.max(1, Math.min(8, Math.round((player.skills.rhetoric + spouse.skills.rhetoric) / 2 + (Math.random() * 2 - 1)))),
        martial:  Math.max(1, Math.min(8, Math.round((player.skills.martial  + spouse.skills.martial)  / 2 + (Math.random() * 2 - 1)))),
        intrigus: Math.max(1, Math.min(8, Math.round((player.skills.intrigus + spouse.skills.intrigus) / 2 + (Math.random() * 2 - 1)))),
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
    const newPatronTier = computePatronTier(s.lifetimeDignitas, s.fides);
    if (newPatronTier !== s.patronTier) {
      const tierDef = PATRON_TIER_DEFINITIONS[newPatronTier];
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

  return { nextState: s, events };
}
