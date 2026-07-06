/**
 * npcConsulEngine.ts
 *
 * Manages the NPC co-consul: assignment at consular year start,
 * antagonism computation, and seasonal tick behaviour.
 *
 * Called by:
 *   gameStore (assignNpcConsul — Chunk 1B)
 *   turnSequencer.processSeason (tickNpcConsul + calcAntagonismLevel — Chunk 1C)
 */

import type { GameState } from '../state/gameStore';
import type { EventInstance } from '../models/event';
import { BILL_TEMPLATES } from '../data/billTemplates';

// ─── NPC consul state shape ───────────────────────────────────────────────────
// Mirrors what Chunk 1B adds to GameState. Declared locally so this engine
// compiles before that patch is applied.

export interface NpcConsulData {
  leaderId: string | null;
  clanId: string | null;
  factionBias: 'optimates' | 'populares' | 'neutral' | null;
  antagonismLevel: 0 | 1 | 2 | 3;
  seasonsServed: number;
}

/** GameState extended with the npcConsul field (available after Chunk 1B). */
type StateWithNpcConsul = GameState & { npcConsul: NpcConsulData | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Average relationship of a clan across all its leaders. */
function avgClanRelationship(clan: GameState['clans'][0]): number {
  if (!clan.leaders.length) return 0;
  const sum = clan.leaders.reduce(
    (acc, l) => acc + ((l as unknown as Record<string, number>).relationship ?? 0),
    0,
  );
  return sum / clan.leaders.length;
}

// ─── Assign NPC consul ────────────────────────────────────────────────────────

/**
 * Assign an NPC co-consul at the start of each consular year.
 * Call from turnSequencer / gameStore when a new Consul term begins.
 *
 * Priority:
 *   1. If electionRivals exist (player just won an election), pick the rival with the
 *      highest strength score — they represent the most credible alternative candidate.
 *   2. Otherwise pick the first leader of the clan with the lowest average relationship
 *      toward the player family.
 *
 * Returns a partial patch suitable for spreading into Zustand set().
 */
export function assignNpcConsul(state: GameState): Partial<StateWithNpcConsul> {
  // Option 1: election just occurred
  if (state.electionRivals.length > 0) {
    const topRival = state.electionRivals.reduce(
      (best, r) => (r.strength > best.strength ? r : best),
      state.electionRivals[0],
    );
    return {
      npcConsul: {
        leaderId: topRival.id,
        clanId: topRival.clanId,
        factionBias: topRival.bias as NpcConsulData['factionBias'],
        antagonismLevel: 0,
        seasonsServed: 0,
      },
    };
  }

  // Option 2: no election — pick from most hostile clan
  if (!state.clans.length) return { npcConsul: null };

  const mostHostileClan = [...state.clans].sort(
    (a, b) => avgClanRelationship(a) - avgClanRelationship(b),
  )[0];

  const leader = mostHostileClan.leaders[0];
  return {
    npcConsul: {
      leaderId: leader?.id ?? null,
      clanId: mostHostileClan.id,
      factionBias: ((leader as any)?.bias as NpcConsulData['factionBias']) ?? null,
      antagonismLevel: 0,
      seasonsServed: 0,
    },
  };
}

// ─── Antagonism computation ───────────────────────────────────────────────────

/**
 * Compute the NPC consul's antagonism level (0–3) for this season.
 * Based on the player paterfamilias's average relationship with the consul's clan
 * and whether they are from opposing faction blocs.
 *
 * Design doc table (section 1.3):
 *   Non-opposing faction:
 *     rel >= 40 → 0   rel 20-39 → 1   rel 10-19 → 2   rel < 10 → 3
 *   Opposing faction:
 *     rel >= 40 → 1   rel 20-39 → 2   rel < 20  → 3
 *
 * Also adds +1 (capped at 3) if the 'auxilium-used-this-term' flag is set.
 */
export function calcAntagonismLevel(state: GameState): 0 | 1 | 2 | 3 {
  const s = state as StateWithNpcConsul;
  if (!s.npcConsul?.clanId) return 0;

  const consulClan = state.clans.find(c => c.id === s.npcConsul!.clanId);
  if (!consulClan) return 0;

  const avgRel = avgClanRelationship(consulClan);

  // Determine opposing factions: compare player's dominant faction alignment to NPC bias.
  const npcBias = s.npcConsul.factionBias;
  const playerDominantFaction: 'optimates' | 'populares' =
    state.popularesRel >= state.optimatesRel ? 'populares' : 'optimates';
  const opposing =
    npcBias !== null &&
    npcBias !== 'neutral' &&
    npcBias !== playerDominantFaction;

  let level: 0 | 1 | 2 | 3;

  if (!opposing) {
    if (avgRel >= 40)      level = 0;
    else if (avgRel >= 20) level = 1;
    else if (avgRel >= 10) level = 2;
    else                   level = 3;
  } else {
    if (avgRel >= 40)      level = 1;
    else if (avgRel >= 20) level = 2;
    else                   level = 3;
  }

  // Flag bonus: Auxilium action used against this consul's clan boosts antagonism
  if (state.flags['auxilium-used-this-term']) {
    level = Math.min(3, level + 1) as 0 | 1 | 2 | 3;
  }

  return level;
}

// ─── Seasonal tick ────────────────────────────────────────────────────────────

/**
 * Run NPC consul seasonal behaviour and return a state patch.
 * Called from turnSequencer after resource income (step 9 / Chunk 1C).
 *
 * Antagonism levels:
 *   0 — 25% bill sponsor. No direct player impact.
 *   1 — 25% bill sponsor. 20% chance to reduce one player bill's support by 10.
 *   2 — 25% bill sponsor. 35% chance −15 support. 15% chance evt-npc-consul-opposes.
 *   3 — 25% bill sponsor. 50% chance −20 support. 30% chance event. 10% chance prosecution flag.
 */
export function tickNpcConsul(state: GameState): Partial<StateWithNpcConsul> {
  const s = state as StateWithNpcConsul;
  if (!s.npcConsul) return {};

  const antagonism = s.npcConsul.antagonismLevel;
  let patch: Partial<StateWithNpcConsul> = {};

  // ── Bill sponsorship (25% chance at all antagonism levels) ────────────────
  if (Math.random() < 0.25) {
    const bias = s.npcConsul.factionBias ?? 'neutral';
    // Filter templates by faction bias when available. BILL_TEMPLATES may not
    // carry a factionBias field on every entry — fall back to any template.
    const templates = BILL_TEMPLATES as unknown as Array<Record<string, any>>;
    const candidates = templates.filter(
      t => !t.factionBias || t.factionBias === bias || bias === 'neutral',
    );
    if (candidates.length > 0) {
      const template = candidates[Math.floor(Math.random() * candidates.length)];
      const newBill = {
        ...template,
        id: `npc-consul-bill-${state.turnNumber}-${Math.floor(Math.random() * 9000) + 1000}`,
        playerProposed: false,
      };
      patch.bills = [...state.bills, newBill as any];
    }
  }

  // ── Support reduction on player-sponsored bills ───────────────────────────
  const supportReductionChance  = [0, 0.20, 0.35, 0.50][antagonism] ?? 0;
  const supportReductionAmount  = [0, 10,   15,   20  ][antagonism] ?? 0;

  if (supportReductionAmount > 0 && Math.random() < supportReductionChance) {
    const playerBills = state.bills.filter(b => b.playerProposed);
    if (playerBills.length > 0) {
      const target = playerBills[Math.floor(Math.random() * playerBills.length)];
      const billsBase = patch.bills ?? state.bills;
      patch.bills = billsBase.map(b =>
        b.id !== target.id
          ? b
          : { ...b, support: ((b as any).support ?? 0) - supportReductionAmount },
      );
    }
  }

  // ── Opposition event (antagonism 2 and 3) ─────────────────────────────────
  if (antagonism >= 2) {
    const eventChance = antagonism === 2 ? 0.15 : 0.30;

    if (Math.random() < eventChance) {
      const consulClan = state.clans.find(c => c.id === s.npcConsul!.clanId);
      const consulLeader =
        consulClan?.leaders.find(l => l.id === s.npcConsul!.leaderId) ??
        consulClan?.leaders[0];
      const consulName  = (consulLeader as any)?.name ?? 'Your co-consul';
      const clanName    = consulClan?.name ?? 'his clan';

      // EventInstance extended with bodyText (added to the interface in Chunk 1A).
      const eventInstance: EventInstance = {
        defId: 'evt-npc-consul-opposes',
        firedAtTurn: state.turnNumber,
        targetCharacterId: state.family.find(c => c.isPlayer)?.id ?? 'pc-1',
        bodyText: `${consulName} has used his consular authority to publicly oppose your family's position in the Senate. ` +
          `He spoke for over an hour, drawing applause from the ${clanName} benches. ` +
          `The chamber watched to see how you would respond.`,
      };

      patch.pendingEvents = [...state.pendingEvents, eventInstance];
    }
  }

  // ── Prosecution pressure (antagonism 3 only) ──────────────────────────────
  // Sets a flag that trialEngine can inspect. The actual trial is triggered by the
  // existing shouldTriggerTrial flow — this avoids coupling to trialEngine directly.
  if (antagonism === 3 && Math.random() < 0.10) {
    const highestCorrupt = [...state.family]
      .filter(c => ((c as any).corruptionScore ?? 0) >= 20)
      .sort((a, b) => ((b as any).corruptionScore ?? 0) - ((a as any).corruptionScore ?? 0))[0];

    if (highestCorrupt) {
      patch.flags = {
        ...(patch.flags ?? state.flags),
        [`npc-consul-prosecution-${highestCorrupt.id}`]: true,
      };
    }
  }

  return patch;
}
