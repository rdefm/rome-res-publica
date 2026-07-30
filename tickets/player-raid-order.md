# Ticket: Player armies have no "raid" order

**STATUS: RESOLVED.** Implemented per the design decisions in the section
below — see "What actually shipped" at the bottom for the final shape and
file list. Left in place as a record of the root cause and the design
questions that were settled before implementation, per this repo's
convention of keeping past plan docs rather than deleting them.

## Report

Provinciae tab, while leading an army in the field: there's no way for the
player to order a raid. The action exists in the game (AI armies raid
routinely) but the player has no button/toggle for it.

## Root cause

Raiding is fully implemented end-to-end for the campaign AI, but the
`MovementOrder.raiding` flag is explicitly documented and enforced as
AI-only — it was never designed into the player order path.

- `src/models/army.ts:81-86` — `MovementOrder.raiding` doc comment: "set by
  the campaign AI's RAID behavior only (never by a player order)."
- `src/engine/campaignAi.ts` (`pickRaidTarget`, ~line 202-203) is the only
  place that ever sets `raiding: true`.
- `src/engine/campaignResolver.ts:536, 585-647` fully resolves a raid
  (relationship/denarii stings, auto-return-home) once the flag is set —
  this logic is real, general, and reusable as-is.
- The player order path has no equivalent:
  - `src/engine/movementEngine.ts` `buildMovementOrder()` takes no raiding
    param and never sets the flag.
  - `src/state/gameStore.ts` `issueMovementOrder(armyId, destinationRegionId,
    forcedMarch)` has no raiding param either.
  - `src/screens/ProvinciaeScreen.tsx` order-mode state only tracks
    `orderModeForcedMarch` — there's no `orderModeRaiding` equivalent.
  - `src/components/provinciae/ArmyCard.tsx` already has the icon/label for
    *displaying* a raiding order (used for AI armies) — just nothing that
    lets the player set one.

## Design decisions (settled with the user before implementing)

- **Raid target:** non-friendly-controlled regions (mirrors the AI's own
  `isFriendly` check). Unlike the AI, the player MAY target a *defended*
  non-friendly region — if a garrison is actually there when the order
  resolves, the raid escalates into a real engagement instead of the usual
  undefended-raid economy sting, and **the defender takes a surprise/morale
  power penalty** for being caught by a raid rather than a full assault.
- **Cost:** none beyond issuing any order (no extra fides/denarii, no
  cooldown) — parity with the AI's own free raid choice.
- **Unit composition gate:** none — open to any army, matching the AI.
- **UI placement:** a "Raid" toggle in the same order-mode banner row as
  Forced March.

## What actually shipped

- **Reachability/order-building** (`src/engine/movementEngine.ts`):
  `ReachableDestination` gained a `raidable` field (`!isFriendly(...)`);
  `buildMovementOrder()` gained a `raiding` param, rejecting (`null`) a raid
  against a friendly destination.
- **Order issuing** (`src/state/gameStore.ts`): `issueMovementOrder` gained
  a `raiding` param, threaded to `buildMovementOrder`.
- **Resolution — undefended target** (`src/engine/campaignResolver.ts`):
  unchanged — still the existing relationship/denarii sting path.
- **Resolution — defended target escalates to combat**
  (`src/engine/campaignResolver.ts`'s movement loop): the hostile-army
  branch now queues an engagement for `intent === 'attack' OR raiding`, not
  just `'attack'`. `Engagement` (`src/models/campaignLog.ts`) gained a
  `raiding?: boolean` tag, threaded through `pendingEngagements` and
  `resolveEngagement`.
- **Surprise/morale penalty, abstract path**
  (`src/engine/battle/abstractResolver.ts`): `AbstractBattleContext` gained
  `defenderSurprised: boolean`, multiplying the defender's power by the new
  `BALANCE.campaign.abstract.raidSurpriseDefenderPenaltyMult` (0.85,
  first-pass/unverified like this block's other constants).
- **Surprise/morale penalty, tactical path** (`src/state/gameStore.ts`'s
  `takeTheFieldForEngagement`): applies the same constant as a flat
  pre-deployment strength scale-down to the defender's `BattleUnit`s,
  reusing the exact precedent already established there for
  `Army.fatigued` (battleEngine has no native morale-seed hook to plug
  into cleanly; a flat strength scale-down was the existing, proven
  mechanism for "penalize this side going into a tactical battle").
- **UI** (`src/screens/ProvinciaeScreen.tsx`): `orderModeRaiding` toggle
  next to Forced March; order-mode destination highlighting filters to
  `raidable` regions while the toggle is on.
- **Display** (`src/components/provinciae/ArmyCard.tsx`): the player's own
  order-summary line now shows "🔥 Raid → ⟨region⟩" when
  `ordersThisSeason.raiding` is set (previously this only ever showed for
  enemy/rival armies' AI-chosen orders).
- **Tests:** `__tests__/movementEngine.test.ts` (`raidable`, raid
  order-building/rejection), `__tests__/abstractResolver.test.ts`
  (`defenderSurprised` win-rate shift), `__tests__/campaignResolver.test.ts`
  (raid-into-garrison escalates to a pending engagement; the raiding flag's
  effect survives the full `resolveEngagement` plumbing, not just the
  isolated resolver).
