// ─── Cadet Branch Events ──────────────────────────────────────────────────────
// Phase 3, Chunk P3-D — the rare "meet the cadet" flavour event, and the
// extinction-time continuation offer. Reuses successionEvents.ts's death-card
// copy for the "still has an heir" case — this file's `resolveDeathNotice` is
// now the SINGLE decision point all three death call sites (turnSequencer.ts
// x2, musterEngine.ts) use, replacing the triple-duplicated
// "noHeir ? evt-succession-no-heir : evt-succession-death" branch P3-C left
// at each site.

import type { EventDef } from '../models/event';
import type { EventInstance } from '../models/event';
import type { CadetBranch, PendingSuccession } from '../models/character';
import type { GameState } from '../state/gameStore';
import { injectNoticeEvent } from '../engine/eventEngine';
import { generateCadet } from '../engine/inheritanceEngine';
import { buildDeathCardBody, buildNoHeirBody } from './successionEvents';

function buildCadetOfferBody(p: PendingSuccession, cadet: CadetBranch, gensName: string): string {
  return `${p.deceasedName}, ${p.deceasedAge} — ${p.rememberedDetail} — has died, and no one of the direct line ` +
    `remains to take up the name. But the name is not yet extinct: ${cadet.name}, ${cadet.characterization}, ` +
    `is still of the Gens ${gensName}. He could carry it forward — a lesser branch stepping into the light — or the ` +
    `family could let itself end here.`;
}

export interface DeathNoticeResolution {
  notice: EventInstance;
  /** Set only when a dead cadet had to be lazily regenerated for this
   *  offer (D4's documented lifecycle choice) — callers must write this
   *  back onto GameState.cadetBranch. */
  cadetBranch?: CadetBranch;
  /** Set only for a second extinction (cadetBranchUsed already true) — no
   *  offer, straight to the dark ending. TODO(P3-E): consumed by the
   *  epilogue screen once it exists. */
  pendingEpilogue?: 'gens_ends';
}

/** The single decision point for "which notice fires when a paterfamilias
 *  dies" — has-heir (P3-C's normal death card), no-heir-but-cadet-available
 *  (this chunk's continuation offer), or no-heir-and-already-used (the dark
 *  ending, no offer). Used identically by all three death call sites. */
export function resolveDeathNotice(
  p: PendingSuccession,
  cadetBranch: CadetBranch | null,
  cadetBranchUsed: boolean,
  turnNumber: number,
  // Phase 5, Chunk P5-E — feminine/adjectival form (e.g. 'Brutia'), threaded
  // through to buildCadetOfferBody/generateCadet, which both used to
  // hardcode it. All three call sites (turnSequencer.ts x2, musterEngine.ts)
  // have state.gensName in scope.
  gensName: string,
): DeathNoticeResolution {
  if (p.eligibleHeirIds.length > 0) {
    return {
      notice: injectNoticeEvent('evt-succession-death', turnNumber, p.deceasedId, {
        title: 'A Death in the House', bodyText: buildDeathCardBody(p),
      }),
    };
  }

  if (!cadetBranchUsed) {
    // D4's lifecycle choice: no continuous "keep a living backup" process —
    // lazily regenerate right here if he died of old age first, so the
    // safety net never fails to catch. Written back by the caller.
    const effectiveCadet = (cadetBranch && cadetBranch.alive) ? cadetBranch : generateCadet(gensName);
    return {
      notice: injectNoticeEvent('evt-cadet-succession', turnNumber, p.deceasedId, {
        title: 'The Line Falters', bodyText: buildCadetOfferBody(p, effectiveCadet, gensName),
      }),
      cadetBranch: effectiveCadet,
    };
  }

  return {
    notice: injectNoticeEvent('evt-succession-no-heir', turnNumber, p.deceasedId, {
      title: 'The Line Ends', bodyText: buildNoHeirBody(p, gensName),
    }),
    pendingEpilogue: 'gens_ends',
  };
}

export const CADET_EVENT_DEFS: EventDef[] = [

  // ─── D2 — the rare "meet the cadet" event ─────────────────────────────────
  // Low weight, capped at BALANCE.cadet.maxVisits fires per run (gated via
  // the flag condition below — turnSequencer.ts increments metCount and
  // sets/clears the flag each time it fires, mirroring how other counters
  // in this codebase gate rare content, e.g. seasonsSinceAedileGames).
  // Point is familiarity (invariant from the plan), not mechanics — effects
  // are small and only lightly move `standing`.

  {
    id: 'evt-cadet-visit',
    title: 'A Distant Cousin Calls',
    bodyText:
      'A cousin of the lesser branch pays a call at the domus — not close kin, but kin all the same. He asks ' +
      'nothing beyond an afternoon\'s welcome, and the household obliges, if a little unsure what to make of him.',
    imageKey: 'portrait-paterfamilias',
    conditions: [{ type: 'flag', key: 'cadet-visits-exhausted', equals: false }],
    weight: 4,
    choices: [
      {
        id: 'welcome-warmly',
        label: 'Welcome him warmly',
        successEffect: 'cadetStanding+5|cadetVisited',
        failureEffect: '',
        successText: 'He leaves pleased with the visit, and a little more sure the family knows his name.',
      },
      {
        id: 'receive-politely',
        label: 'Receive him, politely and briefly',
        successEffect: 'cadetVisited',
        failureEffect: '',
        successText: 'A short, correct visit. Nothing is gained, nothing is lost.',
      },
    ],
  },

  // ─── D3 — the continuation offer (dynamic bodyText — see resolveDeathNotice) ─

  {
    id: 'evt-cadet-succession',
    title: 'The Line Falters',
    bodyText: 'No heir of the direct line remains.',
    imageKey: 'portrait-paterfamilias',
    conditions: [],
    weight: 0,
    choices: [
      {
        id: 'continue-as-cadet',
        label: 'Continue as the cadet branch',
        successEffect: 'continueAsCadet',
        failureEffect: '',
        successText: 'The name endures — carried now by a branch few in the Forum could have named a season ago.',
      },
      {
        id: 'let-it-end',
        label: 'Let the Gens end',
        successEffect: 'setPendingEpilogue:gens_ends',
        failureEffect: '',
        successText: 'The household is closed. The family\'s name will be spoken of, from now on, only in the past tense.',
      },
    ],
  },

];
