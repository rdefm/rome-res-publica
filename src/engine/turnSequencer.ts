import type { GameState } from '../state/gameStore';
import {
  calcResourceIncome,
  applyEffectString,
  applyFactionDrift,
  calcRomeStats,
  calcCrisisEscalation,
  applyRelationshipDrift,
} from './resourceEngine';
import { resolveElection } from './electionEngine';
import { OFFICES } from '../data/offices';
import { AUTO_BILL_TEMPLATES } from '../data/billTemplates';
import type { Bill } from '../models/bill';

let billIdCounter = 1000;
function nextBillId(): string {
  return `auto-${billIdCounter++}`;
}

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
      events.push(
        `ELECTED! Marcus Brutus wins the ${office?.name ?? ''} with ${result.playerVotes} votes.`
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
  const { gravitasIncome, dignitasIncome, gratiaIncome } = calcResourceIncome(s);
  s = {
    ...s,
    gravitas: s.gravitas + gravitasIncome,
    dignitas: s.dignitas + dignitasIncome,
    gratia: s.gratia + gratiaIncome,
  };
  events.push(
    `Income: +${gravitasIncome} Gravitas, +${dignitasIncome} Dignitas, +${gratiaIncome} Gratia`
  );

  // 8. Faction drift
  const factionPatch = applyFactionDrift(s);
  s = { ...s, ...factionPatch };

  // 9. Relationship drift and alliance ticks
  s = { ...s, clans: applyRelationshipDrift(s) };

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

  return { nextState: s, events };
}
