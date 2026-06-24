import { LEGACY_DEFINITIONS } from '../data/legacyDefinitions';
import type { LegacyObjective, LegacyBonus, LegacyMilestone } from '../models/legacyObjective';

// ─── Increment a legacy objective ─────────────────────────────────────────────

export function incrementLegacy(
  objectives: LegacyObjective[],
  id: string,
  amount: number
): {
  updated: LegacyObjective[];
  newMilestonesReached: { objectiveId: string; threshold: number; label: string }[];
} {
  const newMilestones: { objectiveId: string; threshold: number; label: string }[] = [];

  const updated = objectives.map(obj => {
    if (obj.definitionId !== id) return obj;
    const def = LEGACY_DEFINITIONS.find(d => d.id === id);
    if (!def) return obj;

    const newValue = obj.currentValue + amount;
    const newlyReached = def.milestones.filter(
      m => m.threshold <= newValue && !obj.milestonesReached.includes(m.threshold)
    );
    newlyReached.forEach(m =>
      newMilestones.push({ objectiveId: id, threshold: m.threshold, label: m.label })
    );

    return {
      ...obj,
      currentValue: newValue,
      milestonesReached: [...obj.milestonesReached, ...newlyReached.map(m => m.threshold)],
    };
  });

  return { updated, newMilestonesReached: newMilestones };
}

// ─── Compute aggregate legacy bonuses ────────────────────────────────────────

export function computeLegacyBonuses(objectives: LegacyObjective[]): LegacyBonus {
  const aggregate: LegacyBonus = { flatBonus: {}, resourceMultiplier: {} };

  for (const obj of objectives) {
    const def = LEGACY_DEFINITIONS.find(d => d.id === obj.definitionId);
    if (!def) continue;

    for (const ms of def.milestones) {
      if (!obj.milestonesReached.includes(ms.threshold)) continue;
      const b = ms.permanentBonus;

      if (b.flatBonus) {
        for (const [k, v] of Object.entries(b.flatBonus) as [string, number][]) {
          (aggregate.flatBonus as Record<string, number>)[k] =
            ((aggregate.flatBonus as Record<string, number>)[k] ?? 0) + v;
        }
      }
      if (b.resourceMultiplier) {
        for (const [k, v] of Object.entries(b.resourceMultiplier) as [string, number][]) {
          (aggregate.resourceMultiplier as Record<string, number>)[k] =
            ((aggregate.resourceMultiplier as Record<string, number>)[k] ?? 1) * v;
        }
      }
    }
  }

  return aggregate;
}

// ─── Get next milestone for a given objective ─────────────────────────────────

export function getNextMilestone(obj: LegacyObjective): LegacyMilestone | null {
  const def = LEGACY_DEFINITIONS.find(d => d.id === obj.definitionId);
  if (!def) return null;
  return (
    def.milestones
      .filter(m => !obj.milestonesReached.includes(m.threshold))
      .sort((a, b) => a.threshold - b.threshold)[0] ?? null
  );
}

// ─── Initialise objectives from definitions ───────────────────────────────────

export function initLegacyObjectives(): LegacyObjective[] {
  return LEGACY_DEFINITIONS.map(def => ({
    definitionId: def.id,
    currentValue: 0,
    milestonesReached: [],
  }));
}
