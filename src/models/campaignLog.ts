// ─── Campaign Log & Engagement models ───────────────────────────────────────
// Campaign Map plan ("The Consul's Map"), Chunk C7. Design invariant 2:
// "resolve, then animate" — engine/campaignResolver.ts computes an entire
// season's campaign in one pure pass and emits a CampaignLog; the Provinciae
// tab's playback (MapView.tsx's playback mode) only ever REPLAYS this log,
// never recomputes anything.
//
// No logic here — pure types, per the project's model/data/engine layering.

import type { RegionId, Controller } from './theatre';

/** One step of one army's campaign season, in the order campaignResolver
 *  produced them (NOT necessarily grouped by army — playback replays the
 *  whole list in order, staggering simultaneous armies' moves). `text` is a
 *  ready-to-display dispatch-voice line (per the plan's voice rule); the
 *  UI does not synthesize its own narration from the structured fields. */
export type CampaignLogEntry =
  | { type: 'move'; armyId: string; armyName: string; from: RegionId; to: RegionId; text: string }
  | { type: 'bounce'; armyId: string; armyName: string; at: RegionId; text: string }
  | { type: 'storm'; armyId: string; armyName: string; at: RegionId; text: string }
  | {
      type: 'battle';
      regionId: RegionId;
      attackerArmyId: string;
      defenderArmyId: string;
      winnerArmyId: string;
      loserArmyId: string;
      tier: 'marginal' | 'clear' | 'crushing';
      text: string;
    }
  | { type: 'withdrawal'; armyId: string; armyName: string; from: RegionId; to: RegionId; text: string }
  | { type: 'shatter'; armyId: string; armyName: string; at: RegionId; captured: boolean; text: string }
  | { type: 'flip'; regionId: RegionId; newController: Controller; text: string }
  | { type: 'raid'; armyId: string; armyName: string; regionId: RegionId; text: string }
  | { type: 'engagement_pending'; armyId: string; armyName: string; regionId: RegionId; text: string };

export interface CampaignLog {
  turnNumber: number;
  entries: CampaignLogEntry[];
}

/** An engagement whose battle hasn't resolved yet — created when a player-
 *  commanded army (attacker or defender) is one side of a stepping-into-
 *  hostile-territory halt (campaignResolver's step 2/4). NPC-vs-NPC
 *  engagements never reach this list — they resolve inline, same season,
 *  via the abstract battle stub (C8 replaces the stub, not this gating). */
export interface Engagement {
  id: string;
  regionId: RegionId;
  attackerArmyId: string;
  defenderArmyId: string;
}
