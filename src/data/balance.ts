// ─── Balance Registry (P2-A) ────────────────────────────────────────────────
// Single authoritative home for every tunable game-balance number. Chunk P2-A
// (rome-phase2-implementation-plan.md) seeds this by extracting existing
// scattered constants without changing their values. Later chunks fill in
// their placeholder groups: training (P2-C), relationships (P2-D),
// munificence (P2-F), actionEconomy (P2-E).
//
// Discipline: after this chunk, any new numeric literal for a tunable
// belongs here, not inline in engine/store code. A magic number added to
// engine/state code after P2-A is a defect.
//
// Indirection policy (documented per the plan's "pick one, document it"
// instruction, since duplicating numbers here would create drift risk):
//   - `patron`     — numbers stay in models/patronLadder.ts
//                     (PATRON_TIER_DEFINITIONS is the tier ladder's single
//                     source of truth). Nothing to re-export; see that file.
//   - `elections`  — numbers stay in engine/electionEngine.ts as exported
//                     consts (already imported directly by ForumScreen.tsx
//                     and gameStore.ts). Re-exported below under
//                     BALANCE.elections for discoverability only.
// Every other group's numbers live here directly and are imported by the
// engine/store code that uses them.

import {
  PLAYER_BASE_SCORE,
  CANVASS_FIDES_COST,
  CANVASS_MIN_RELATIONSHIP,
  CANVASS_EVENT_CHANCE,
  OFFICE_PRESTIGE,
} from '../engine/electionEngine';

export const BALANCE = {
  // ─── Fides income formula (resourceEngine.calcResourceIncome) ─────────────
  income: {
    /** paterfamilias.rhetoric × this = base Fides income (step 1). */
    paterfamiliasRhetoricMultiplier: 2,
    /** Office ID → flat Fides/season bonus while a family member holds it. */
    officeFidesBonus: {
      quaestor: 3,
      aedile: 5,
      praetor: 7,
      consul: 12,
    } as Record<string, number>,
    /** P2-C: bestOtherRhetoric × this = the "household voices" income term
     *  (highest rhetoric among living, non-paterfamilias family members). */
    bestOtherRhetoricMultiplier: 1,
    /** P2-C: family members below this age contribute nothing to bestOtherRhetoric. */
    bestOtherRhetoricMinAge: 12,
  },

  // ─── Patron Tier ────────────────────────────────────────────────────────
  // See indirection policy above — numbers live in models/patronLadder.ts.
  patron: {},

  // ─── Forum diplomacy actions (gameStore.ts) ────────────────────────────────
  diplomacy: {
    buyInfluenceFidesCost: 10,
    buyInfluenceRelationshipGain: 5,
    inviteToDinnerDenariiCost: 20,
    inviteToDinnerRelationshipGain: 8,
    forgeAllianceFidesCost: 20,
    forgeAllianceRelationshipGain: 12,
    arrangeMarriageFidesCost: 20,
    arrangeMarriageRelationshipGain: 20,
    gatherIntelligenceFidesCost: 8,
    canvassForVotesFidesCost: 12,
  },

  // ─── Senate bill actions (gameStore.ts) ────────────────────────────────────
  // These are the *default* costs used when a bill template doesn't override
  // them (Bill.voteGravitasCost / speechGravitasCost). Per-bill overrides are
  // content and stay in billTemplates.ts.
  senate: {
    voteFidesCostDefault: 4,
    speechFidesCostDefault: 6,
    filibusterFidesCost: 8,
    submitBillFidesCost: 10,
  },

  // ─── Elections ──────────────────────────────────────────────────────────
  // See indirection policy above — numbers live in engine/electionEngine.ts.
  elections: {
    playerBaseScore: PLAYER_BASE_SCORE,
    canvassFidesCost: CANVASS_FIDES_COST,
    canvassMinRelationship: CANVASS_MIN_RELATIONSHIP,
    canvassEventChance: CANVASS_EVENT_CHANCE,
    officePrestige: OFFICE_PRESTIGE,
  },

  // ─── P2-C — Deterministic training ─────────────────────────────────────────
  training: {
    /** Cost of training a skill TO targetLevel = this × targetLevel Fides.
     *  E.g. 6→7 costs fidesCostPerTargetLevel × 7. Same for all three skills. */
    fidesCostPerTargetLevel: 3,
    /** Skills cannot be trained above this level. */
    skillCap: 10,
  },

  // ─── P2-D — Relationship anchors & leader mortality (filled in Chunk P2-D) ─
  relationships: {},

  // ─── P2-F — Munificence acts (filled in Chunk P2-F) ────────────────────────
  munificence: {},

  // ─── P2-E — Action economy tuning (filled in Chunk P2-E) ───────────────────
  actionEconomy: {},
};

// ─── Known un-extracted tunables ───────────────────────────────────────────
// Left in place rather than extracted here — each is either single-use,
// embedded in a bespoke office-action effect function, or content that
// belongs in data/, not the balance registry. Revisit only if a later chunk
// needs to tune one of these directly.
//   - offices.ts: individual inOfficeAction costs/effects (large, mostly
//     one-off flavour numbers). P2-F touches the Aedile subset directly as
//     part of Munificence consolidation.
//   - billTemplates.ts: per-bill voteGravitasCost/speechGravitasCost
//     overrides (the *defaults* are BALANCE.senate.*; per-bill overrides are
//     content, not registry tunables).
//   - assetDefinitions.ts / provinceAssets.ts: asset costs and bonuses
//     (content).
//   - trialActions.ts, campaignEvents.ts, canvassingEvents.ts,
//     provinceEvents.ts: content, not balance-registry tunables. Note:
//     provinceEvents.ts's PROVINCE_EVENTS array is currently unwired to any
//     resolver (dead content, confirmed during P2-A) — its costs/effects
//     were still corrected to valid resource names for consistency, but
//     wiring it up is out of Phase 2's scope.
