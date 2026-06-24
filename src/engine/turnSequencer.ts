import type { GameState } from '../state/gameStore';
import type { Client, ClientType } from '../models/client';
import type { EventInstance } from '../models/event';
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
import { EVENT_DEFS } from '../data/events';
import { OFFICES } from '../data/offices';
import { AUTO_BILL_TEMPLATES } from '../data/billTemplates';
import type { Bill } from '../models/bill';

let billIdCounter = 1000;
function nextBillId(): string {
  return `auto-${billIdCounter++}`;
}

// ─── Client helpers ──────────────────────────────────────────────────────────

/**
 * Return the oldest-acquired client of a given type, or undefined if none.
 * "Oldest" = smallest acquiredTurn value.
 */
function pickOldestClient(clients: Client[], type: ClientType): Client | undefined {
  return clients
    .filter(c => c.type === type)
    .sort((a, b) => a.acquiredTurn - b.acquiredTurn)[0];
}

// ─── Season processor ────────────────────────────────────────────────────────

/**
 * Run the full end-of-season sequence.
 * Returns a full new GameState and an array of log messages for the overlay.
 */
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
      // Increment consular_line if a consul was won
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
      // Passes
      passedBills.push(bill);
      const patch = applyEffectString(bill.passEffect, s);
      s = { ...s, ...patch };
      resolvedLogs.push(`✓ ${bill.name} passes.`);
    } else if (turnsLeft <= 0) {
      // Expires
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

  // Apply legacy flat bonuses to income
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

  // Increment treasury_legacy by denarii earned this season
  if (finalDenarii > 0) {
    const { updated: legacyAfterTreasury, newMilestonesReached: tMilestones } =
      incrementLegacy(s.legacyObjectives, 'treasury_legacy', finalDenarii);
    s = { ...s, legacyObjectives: legacyAfterTreasury };
    for (const m of tMilestones) {
      events.push(`Legacy milestone: "${m.label}" — permanent bonus unlocked.`);
    }
  }

  events.push(
    `Income: +${finalGravitas} Gravitas, +${finalDignitas} Dignitas, +${finalGratia} Gratia${finalDenarii > 0 ? `, +${finalDenarii} Denarii` : ''}`
  );

  // 8. Faction drift
  const factionPatch = applyFactionDrift(s);
  s = { ...s, ...factionPatch };

  // 9. Relationship drift and alliance ticks
  s = { ...s, clans: applyRelationshipDrift(s) };

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
    // Detect Class B / C events: those with a hasClient condition
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
      clientName: involvedClient?.name,   // undefined for Class A events
      clientType: involvedClient?.type,   // undefined for Class A events
    };

    // Append to pending queue — gameStore.endSeason surfaces the first one
    s = { ...s, pendingEvents: [...s.pendingEvents, instance] };
  }

  // 13. Tick ambitions — check completion, expiry, apply rewards/consequences
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
    // Reputation bonuses
    if (r.reputationBonus) {
      const newReps = { ...s.familyReputations };
      for (const { clanId, delta } of r.reputationBonus) {
        newReps[clanId] = Math.min(100, Math.max(-100, (newReps[clanId] ?? 0) + delta));
      }
      s = { ...s, familyReputations: newReps };
    }
    events.push(`Ambition complete: "${def.title}". Rewards applied.`);
    // Chain ambition — queue offer via pendingAmbitionSelection flag (handled in store)
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

  // 14. Passive birth check
  if (isBirthEligible(s.family) && s.pendingBirthNaming === null) {
    const prob = calcBirthProbability(s.family);
    if (Math.random() < prob) {
      const player = s.family.find(c => c.isPlayer)!;
      const spouse = s.family.find(c => c.role === 'spouse')!;
      const role: 'son' | 'daughter' = Math.random() < 0.5 ? 'son' : 'daughter';
      const inheritedTraits = resolveInheritedTraits(player, spouse);

      // Base skills: average of parents' skills with small random variation
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

  return { nextState: s, events };
}
