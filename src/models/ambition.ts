import type { OfficeId } from './office';
import type { RegionId } from './theatre';

export type AmbitionScope = 'family' | 'character' | 'dynastic';
export type AmbitionStatus = 'active' | 'completed' | 'failed' | 'superseded';
export type AmbitionSource = 'player' | 'story' | 'tutorial' | 'dynastic';

export type AmbitionCriterionId =
  | 'resource_threshold' | 'office_held' | 'clan_standing' | 'asset_tier'
  | 'client_count' | 'battles_won' | 'region_control' | 'survive_seasons' | 'trial_won'
  | 'bill_passed';

export interface AmbitionCriterion {
  id: AmbitionCriterionId;
  resource?: 'denarii' | 'fides';
  officeId?: OfficeId;
  clanId?: string;
  assetId?: string;
  regionId?: RegionId;
  amount?: number;   // threshold / count / tier / seasons
}

/** Snapshot of the measured value when the ambition was set. The delta rule
 *  (spec §2.3) is meaningless without this — never derive it at read time. */
export interface AmbitionBaseline { value: number; turnNumber: number; }

export interface AmbitionReward {
  lifetimeDignitas?: number;
  fides?: number;
  denarii?: number;
  traitId?: string;
  assetId?: string;
}

export interface ActiveAmbition {
  id: string;                       // uuid-ish; ambitions are now instances, not definition refs
  scope: AmbitionScope;
  source: AmbitionSource;
  title: string;                    // player-authored or story-authored
  criterion: AmbitionCriterion;
  baseline: AmbitionBaseline;
  assignedCharacterId?: string;
  status: AmbitionStatus;
  turnSet: number;
  deadlineTurn?: number;            // required when source === 'player'
  turnResolved?: number;
  reward: AmbitionReward;           // computed at set time and FROZEN
  failureDignitas: number;          // computed at set time, negative
  /** Whether the player can abandon this before it resolves naturally. Always
   *  true for source === 'player'. For 'story'/'tutorial', set per-instance by
   *  the authoring event/beat — NOT a blanket rule by source. */
  refusable: boolean;
  /** Narrative hooks (authored later — see spec §5/§4). */
  onCompleteEventId?: string;
  onFailEventId?: string;
}

export interface AmbitionProgress { current: number; target: number; label: string; }

/**
 * A staged offer for a 'story' ambition that requires an explicit
 * accept/refuse moment. Distinct from a direct-write ActiveAmbition: nothing
 * here is baseline-snapshotted or reward-frozen yet — that happens on accept
 * (buildAmbition), matching the existing convention that baseline/reward are
 * captured at *creation*, and an offer isn't a created ambition yet. Reserves
 * its slot the same way an active ambition does — the builder/other offers
 * cannot target an occupied-by-offer slot.
 */
export interface AmbitionOffer {
  id: string;
  scope: AmbitionScope;
  assignedCharacterId?: string;
  title: string;
  criterion: AmbitionCriterion;
  deadlineSeasons?: number;         // duration, resolved to an absolute deadlineTurn on accept
  onCompleteEventId?: string;
  onFailEventId?: string;
  turnOffered: number;
}
