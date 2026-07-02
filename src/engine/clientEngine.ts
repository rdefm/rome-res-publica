import type { Client, ClientBonus, ClientType } from '../models/client';

// ─── Bonus pool definitions ───────────────────────────────────────────────────

interface BonusOption {
  bonus: ClientBonus;
  weight: number;
}

const BONUS_POOL: Record<ClientType, BonusOption[]> = {
  muscle: [
    { bonus: { martialBonus: 2 },         weight: 30 },
    { bonus: { trialDefenseBonus: 5 },    weight: 25 },
    { bonus: { corruptionShield: 3 },     weight: 20 },
    { bonus: { fides: 2 },                weight: 15 },
    { bonus: { lifetimeDignitas: 2 },     weight: 10 },
  ],
  publicSupport: [
    { bonus: { lifetimeDignitas: 3 },     weight: 30 },
    { bonus: { fides: 3 },                weight: 25 },
    { bonus: { gold: 4 },                 weight: 20 },
    { bonus: { fides: 2 },                weight: 15 },
    { bonus: { corruptionShield: 2 },     weight: 10 },
  ],
  votingSway: [
    { bonus: { fides: 4 },                weight: 30 },
    { bonus: { fides: 3 },                weight: 25 },
    { bonus: { rhetoricalBonus: 2 },      weight: 20 },
    { bonus: { trialDefenseBonus: 4 },    weight: 15 },
    { bonus: { lifetimeDignitas: 2 },     weight: 10 },
  ],
};

const SECONDARY_BONUS_POOL: BonusOption[] = [
  { bonus: { gold: 2 },                   weight: 25 },
  { bonus: { fides: 1 },                  weight: 20 },
  { bonus: { trialDefenseBonus: 3 },      weight: 20 },
  { bonus: { corruptionShield: 2 },       weight: 15 },
  { bonus: { lifetimeDignitas: 1 },       weight: 10 },
  { bonus: { fides: 1 },                  weight: 10 },
];

// ─── Weighted random picker ───────────────────────────────────────────────────

function pickWeighted<T extends { weight: number }>(pool: T[]): T {
  const total = pool.reduce((s, o) => s + o.weight, 0);
  let rand = Math.random() * total;
  for (const option of pool) {
    rand -= option.weight;
    if (rand <= 0) return option;
  }
  return pool[pool.length - 1];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Roll a randomised ClientBonus for a given ClientType.
 * Always returns at least one bonus key. 30% chance of a secondary bonus.
 */
export function rollClientBonus(type: ClientType): ClientBonus {
  const primary = pickWeighted(BONUS_POOL[type]).bonus;
  const primaryKey = Object.keys(primary)[0];

  if (Math.random() < 0.30) {
    const eligibleSecondary = SECONDARY_BONUS_POOL.filter(
      o => !Object.keys(o.bonus).includes(primaryKey)
    );
    if (eligibleSecondary.length > 0) {
      const secondary = pickWeighted(eligibleSecondary).bonus;
      return { ...primary, ...secondary };
    }
  }

  return primary;
}

/**
 * Compute the aggregate ClientBonus across all clients on the roster.
 */
export function computeTotalClientBonuses(clients: Client[]): ClientBonus {
  const aggregate: ClientBonus = {};
  for (const client of clients) {
    for (const [key, value] of Object.entries(client.bonus) as [keyof ClientBonus, number][]) {
      aggregate[key] = (aggregate[key] ?? 0) + value;
    }
  }
  return aggregate;
}

/**
 * Build a new Client object with a rolled bonus.
 */
export function buildClient(
  id: string,
  name: string,
  type: ClientType,
  flavourTitle: string,
  flavourText: string,
  turnNumber: number
): Client {
  return {
    id,
    name,
    type,
    flavourTitle,
    flavourText,
    bonus: rollClientBonus(type),
    acquiredTurn: turnNumber,
  };
}
