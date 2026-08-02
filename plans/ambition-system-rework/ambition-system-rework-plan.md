# Ambition System Rework — Implementation Plan

**Status:** approved design, ready to implement
**Branch:** implement on `claude/imperium-debug-menu-4ktgyx` (explicit instruction — do **not** cut a new branch for this)
**Sequencing:** this plan ships **first**, as a standalone playable feature on Free/Standard Start. The tutorial rebuild (`plans/tutorial-rebuild-plan.md`) is its first consumer and depends on the types, store fields and store actions named here. Build and play-test this before starting that one — that ordering exists specifically so the goal loop is proven fun before the tutorial is made to depend on it.

This plan replaces the current draw-3-and-pick ambition system with a **player-authored goal builder**, absorbs Legacy Objectives into it as a passive `dynastic` scope, and adds the second leaf of the Agenda Tablet as its home. Achievements are untouched.

Read §0 before writing any code. Everything there was verified against the working tree and several items contradict what the current code's own descriptions claim.

---

## §0. Grounded findings (verified — do not re-derive)

File:line references are to the tree at plan time; re-grep if lines moved, but the *facts* hold.

**The ambition system is live but partly fictional**

1. 13 definitions in `src/data/ambitionDefinitions.ts`; engine in `src/engine/ambitionEngine.ts` (153 lines); ticked from `turnSequencer.ts:1970` (step 13), rewards applied `:1974-1999`, expiry consequences `:2001-2018`, re-offer logic `:2020-2039`.
2. **Four definitions do not do what their own `description` says.** These are live bugs, not cosmetic:
   - `great_orator` — description "Raise Rhetoric to 8 or above", condition `accumulate_resource / fides >= 80`. Rhetoric is never read.
   - `forge_alliance` — description "…with two different clans", condition `reach_reputation threshold 60`, whose checker (`ambitionEngine.ts:51-57`) returns true if **any one** clan qualifies.
   - `grand_estate` — description "Own at least one asset at Tier 2 or above", condition hardcodes `assetId: 'vineyard'`. Any other Tier 2 asset fails it.
   - `survive_dynasty` / `survive_turns` — checker (`:75-82`) finds `state.ambitions.find(a => a.assignedCharacterId === assignedCharacterId || !assignedCharacterId)`, i.e. for a family-scope ambition (no `assignedCharacterId`) it matches the **first ambition in the array**, not itself, and measures that one's `turnActivated`.
3. `produce_heir` and `prosecute_rival` are `case ... return false` stubs (`ambitionEngine.ts:89-91`). Any definition using them can never complete. None currently do, so this is latent, not active.
4. `drawAmbitions` (`:13-22`) shuffles with `sort(() => Math.random() - 0.5)` — a biased shuffle, and irrelevant after this rework since the draw is being replaced by a builder.
5. `AmbitionSelectionModal.tsx:79-80` calls `drawAmbitions` inside `useMemo(..., [])` with `excludeIds` captured but **not** in the dep array. Deliberate ("draw once on mount"), noted so the rewrite doesn't "fix" it into a reshuffling bug.

**Ambitions are not in the save schema**

6. `src/state/saveLoad.ts` has **no `ambitions` key** in `SaveSchema` (verified by grep — zero matches for "ambition" in that file). They still round-trip, because `save()` writes the whole state minus an explicit blocklist (`:230-241`) and `load()` **discards** `SaveSchema.parse()`'s result, returning the raw parsed object (`:249-251`). So the schema validates nothing about ambitions today.
7. This is a pre-existing gap, not one this plan creates — but CLAUDE.md's "any change to the save-file shape requires updating the Zod schema" applies to every field this plan adds. **Chunk A5 closes it for the new shape.** Do not treat "it already round-trips" as permission to skip the schema.
8. `legacyObjectives` **is** in the schema (`:77-81`), so the absorption in §2.3 must keep that key valid for old saves.

**Legacy Objectives are a separate, fully live system**

9. `src/models/legacyObjective.ts`, `src/data/legacyDefinitions.ts` (6 objectives: `consular_line`, `treasury_legacy`, `senate_voice`, `survival_legacy`, `prosecutions_won`, `magistrates_convicted`), `src/engine/legacyEngine.ts` (`incrementLegacy` / `computeLegacyBonuses` / `getNextMilestone` / `initLegacyObjectives`), surfaced in `src/components/domus/LegatumPanel.tsx`.
10. `incrementLegacy` is called from `turnSequencer.ts:221` (consular_line), `:925` (treasury_legacy), `:1217` (survival_legacy) and `trialEngine.ts:465,471` (prosecutions_won, magistrates_convicted). `computeLegacyBonuses` is consumed at `turnSequencer.ts:904`. **These call sites must keep working** — the absorption is a presentation/model merge, not a rewrite of the counters.
11. `achievementEngine.ts:52` (`'midas'`) reads `legacyObjectives.find(o => o.definitionId === 'treasury_legacy')?.currentValue`. Achievements are staying (design decision), so this read must survive.
12. `LegatumPanel.tsx:56` and `:303` both do a bare `useGameStore()` with no selector — a CLAUDE.md violation. Since this plan touches that panel, fix both while in there (the repo's stated "fix it while you're in there" rule).

**The Agenda Tablet has no leaf concept yet**

13. `src/components/shared/AgendaTablet.tsx` is a single `Modal` rendering one scrolling list, `TABLET_MAX_ITEMS = 6`, fed by `generateAgenda(state)`. There is no tab/leaf/page structure to extend — §2.5 adds the first one.
14. `agendaEngine.ts:366` already generates ambition-derived agenda items from `state.ambitions`. That generator needs updating, not deleting, once ambitions gain deadlines (a deadline is exactly the kind of thing the agenda should nag about).

**Anti-exploit context for the delta rule**

15. `GameState` resources relevant to targets: `fides`, `denarii`, `lifetimeDignitas`, `imperium`, `patronTier`, `familyReputations` (`Record<clanId, number>`), `ownedAssets`, `clients`, `heldOffices`, `currentOffice`, `trials`, `armies`.
16. `BALANCE` (`src/data/balance.ts`) is the registry every tuning constant belongs in. Every number this plan introduces goes in `BALANCE.ambitions`, not inline.

**Grilling-session follow-ups (verified after §0's first pass)**

17. `requestAmbitionChange` (`gameStore.ts:832,2770-2773`) is called only from `CharacterActionModal.tsx`. Grepped `tutorial-rebuild-plan.md` in full: it names exactly three dependencies on this plan — `ActiveAmbition`/`AmbitionCriterion` types, the `setAmbition` action, and the Agenda Tablet leaf. It never names `requestAmbitionChange`. Chunk A3's original hedge ("keep it only if the tutorial plan needs it") is resolved: **delete it outright**.
18. Elections resolve only in Winter (`turnSequencer.ts:182-194`, season cycle `['Spring','Summer','Autumn','Winter']`, election check gated on `newSeasonIndex === 3`). Office terms are fixed (`data/offices.ts`: most `termSeasons: 4`, Censor `6`, Dictator `2`) — re-election is automatic at term end, not player-triggered. An `office_held` ambition can only resolve at a Winter boundary; §2.2/§2.3 account for this below.
19. Character death/removal has **three separate write sites** — `turnSequencer.ts:1765-1808` (yearly natural mortality), `battle/musterEngine.ts:579-604` (battle death), `trialEngine.ts:349-392` (execution/exile) — all funneling through `inheritanceEngine.ts:313`'s `detectPaterfamiliasDeath` (or `musterEngine.ts:307`'s `applyCharacterDeath` for non-paterfamilias). Hooking all three individually is unnecessary: `ambitionEngine.ts`'s `tickAmbitions` (`:100-137`) already runs every season and can check whether `assignedCharacterId` is still present in `state.family` — one guard, one call site, correct regardless of which of the three paths caused the death. Use that instead of touching the three death sites (Chunk A2).

---

## §1. Design decisions (settled with the design lead — do not re-open)

| # | Decision |
|---|---|
| Difficulty basis | **Delta from state-at-set-time**, not absolute threshold. Setting "500 Denarii" while holding 480 is worth almost nothing. |
| Offices | Offices are the exception to pure delta: each office has a **baseline reward**, multiplied up when it's a **first** for this character *or* for the family. Deadline choices are clamped to actually-reachable Winter election boundaries (§0.18, §2.3). |
| Stake | **Deadline mandatory** on every player-set ambition. It is both the difficulty axis and the anti-exploit. |
| Failure cost | Small `lifetimeDignitas` ding, scaled to the reward that was on offer and **hard-capped low**. **No up-front wager, no cooldown** — the slot is available again immediately after a failure (revised from an earlier draft that added a cooldown lock; dropped because it added punishment on top of the dignitas ding for no anti-exploit reason — the delta rule already closes the exploit). |
| Criteria | Curated builder, **9** criteria (§2.2 — `military_outcome` split into `battles_won`/`region_control`, see below). Extensible later. |
| Difficulty display | **Computed from the criteria**, shown live as the player edits, so they scale the ambition up/down themselves. Not a difficulty tier that gates targets. |
| Slots | **No new slots.** 1 family + 1 character active, exactly as today, plus `dynastic` as an always-on non-competing track. Tutorial-set, story-set and player-set all write into those same two slots — via one of two mechanisms, see "Story/tutorial entry" below. |
| Legacy Objectives | **Absorbed** into ambitions as `scope: 'dynastic'`. |
| Achievements | **Kept as-is.** Separate system, retrospective, no player input, no mechanical effect. |
| Refusal | **Per-instance, not per-source.** Every `ActiveAmbition`/`AmbitionOffer` carries a `refusable: boolean` set by the authoring event/beat. Tutorial beats conventionally set it `false`; story beats may set either, depending on whether the moment is meant to be a real choice. (Revises an earlier draft that stated this as a blanket "post-tutorial = refusable" rule — the design lead clarified some story beats are mandatory too.) |
| Story/tutorial entry | **Two mechanisms**, both landing in the same family/character slots: **direct-write** (effect string writes an `ActiveAmbition` straight into the slot — used for beats where the goal simply happens) and **offer-then-accept** (effect string stages an `AmbitionOffer` that reserves the slot until the player accepts/refuses on the tablet leaf — used for beats meant to feel like a real choice). See §2.4, §4. |
| Slot collision | A direct-write targeting an occupied slot **force-evicts** the occupant: status → `'superseded'`, no dignitas ding, no cooldown, but the evicted ambition pays out a **partial reward** scaled to its progress fraction (§2.3). |
| Character death | An active `character`-scope ambition whose assigned character dies is cancelled the same way: `'superseded'` + the same partial-progress payout (§2.3, §0.19). |
| Presentation | Tutorial goals and player ambitions are the **same object class on the same leaf** — no visually distinct tutorial styling. |
| Narrative starts | Design the **hooks** now, author content later. Events are the story spine; ambitions are the goalposts and payoff. |

---

## §2. Target design

### 2.1 Scopes

```ts
export type AmbitionScope = 'family' | 'character' | 'dynastic';
```

- `family` — one active. Competitive slot.
- `character` — one active, bound to `assignedCharacterId`. Competitive slot.
- `dynastic` — **all six always active**, never chosen, never fail, no deadline. This is the absorbed Legacy Objective set.

### 2.2 The criteria set (the builder's whole vocabulary)

Nine. Each needs a checker **and** a progress readout `{ current, target, label }` — the readout is what makes the tablet leaf worth opening, and is the thing today's system entirely lacks.

| id | Player-facing | Target the player sets | Delta basis |
|---|---|---|---|
| `resource_threshold` | "Hold N Denarii / Fides" | amount | current value at set time |
| `office_held` | "Win the ⟨office⟩" | office | n/a — baseline + first-time multiplier |
| `clan_standing` | "Reach N standing with ⟨clan⟩" | clan + value | current standing at set time |
| `asset_tier` | "Own ⟨asset⟩ at Tier N" | asset + tier | current tier (0 if unowned) |
| `client_count` | "Hold N clients" | count | current count |
| `battles_won` | "Win N battles" | count | current battle-win count |
| `region_control` | "Take ⟨region⟩" | region | current control (0/1) |
| `survive_seasons` | "Keep the gens intact N more seasons" | seasons | always a pure delta |
| `trial_won` | "Win N trials" | count | current count |

`military_outcome` (an earlier draft's single criterion for both battle count and region capture) is **split in two**: it bundled a count-based goal and a boolean-control goal under one id, which would have forced the builder UI and checker to branch internally instead of each criterion having one target shape. `battles_won` and `region_control` are now ordinary criteria like the rest of the table.

`produce_heir` and `prosecute_rival` (the dead stubs, §0.3) are **deliberately not** in this set — `trial_won` covers the prosecution case properly, and heirs are better served by `survive_seasons`. Delete the stub cases rather than leaving them returning `false`.

### 2.3 Reward and difficulty maths

All constants live in `BALANCE.ambitions`. Suggested first-pass values, explicitly **unverified** (same convention as the rest of the registry — tune after play-testing):

```
difficultyScore = deltaScore × deadlinePressure

deltaScore      = normalised 0..1 per criterion (criterion-specific divisor in BALANCE)
deadlinePressure= clamp(BALANCE.ambitions.pressureBase / seasonsAllowed, min, max)

reward.lifetimeDignitas = round(baseDignitas × difficultyScore)
reward.fides            = round(baseFides    × difficultyScore)
```

**Offices override `deltaScore`:**

```
officeScore = BALANCE.ambitions.officeBaseline[officeId]
            × (firstForCharacter ? firstCharacterMult : 1)
            × (firstForFamily    ? firstFamilyMult    : 1)
```

`firstForFamily` reads `state.heldOffices` (the family-wide record); `firstForCharacter` reads `character.heldOffices` (per-character, added Phase 4 P4-A — see `models/character.ts:59`). Both already exist; no new tracking needed.

**`office_held` deadline clamping (§0.18):** elections resolve only in Winter and offices have fixed terms, so a free-entry deadline could ask for something structurally impossible (e.g. "win Consul in 2 seasons" when the next Winter is 3 seasons away). The builder computes the next Winter(s) at which the office is actually contestable — respecting the current holder's remaining `termSeasons` — and only offers those as deadline choices, defaulting to the nearest one. No other criterion needs this; it's specific to `office_held` because it's the only criterion tied to a fixed external calendar.

**Failure:**

```
failureDignitas = -min(
  round(reward.lifetimeDignitas × BALANCE.ambitions.failureRatio),
  BALANCE.ambitions.failureDignitasCap
)
```

The cap is the whole point — it makes an ambitious failed goal sting proportionally but never catastrophically. **No cooldown** — the slot is available again immediately (§1, revised from an earlier draft).

**The exploit this closes:** setting "500 Denarii" at 480 gives `deltaScore ≈ 0`, so the reward rounds to ~0. Setting it at 50 with a tight deadline scores high. No separate exploit check needed anywhere.

**Partial payout on `'superseded'` (§1's Slot collision / Character death rows):** when a direct-write ambition evicts an occupied slot, or an assigned character dies, the displaced ambition doesn't just vanish — it pays out a reward scaled to how far along it was:

```
progressFraction = clamp((current - baseline.value) / (target - baseline.value), 0, 1)
  // `current`/`target` from the same getProgress() used for the tablet's readout

partialReward.lifetimeDignitas = round(reward.lifetimeDignitas × progressFraction)
partialReward.fides            = round(reward.fides            × progressFraction)
partialReward.denarii          = round(reward.denarii          × progressFraction)
```

No `failureDignitas` applies — this is not a failure, it's an interruption outside the player's control. One function (`supersedeAmbition` in Chunk A2) implements this and is called from both the slot-collision path and the character-death guard, so there's a single source of truth for "an ambition ended early through no fault of the player."

### 2.4 Types

Replace `src/models/ambition.ts` wholesale (it is 63 lines and every interface changes):

```ts
export type AmbitionScope = 'family' | 'character' | 'dynastic';
export type AmbitionStatus = 'active' | 'completed' | 'failed' | 'superseded';
export type AmbitionSource = 'player' | 'story' | 'tutorial' | 'dynastic';

export type AmbitionCriterionId =
  | 'resource_threshold' | 'office_held' | 'clan_standing' | 'asset_tier'
  | 'client_count' | 'battles_won' | 'region_control' | 'survive_seasons' | 'trial_won';

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
 *  (§2.3) is meaningless without this — never derive it at read time. */
export interface AmbitionBaseline { value: number; turnNumber: number; }

export interface AmbitionReward {
  lifetimeDignitas?: number; fides?: number; denarii?: number;
  traitId?: string; assetId?: string;
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
   *  the authoring event/beat — NOT a blanket rule by source (§1). */
  refusable: boolean;
  /** Narrative hooks (authored later — see §5). */
  onCompleteEventId?: string;
  onFailEventId?: string;
}

export interface AmbitionProgress { current: number; target: number; label: string; }

/**
 * A staged offer for a 'story' ambition that requires an explicit
 * accept/refuse moment (§1 "Story/tutorial entry"). Distinct from a
 * direct-write ActiveAmbition: nothing here is baseline-snapshotted or
 * reward-frozen yet — that happens on accept (buildAmbition), matching the
 * existing convention that baseline/reward are captured at *creation*, and an
 * offer isn't a created ambition yet. Reserves its slot the same way an
 * active ambition does (§1 "Slots") — the builder/other offers cannot target
 * an occupied-by-offer slot.
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
```

`reward` is **frozen at set time**, not recomputed on completion. Otherwise a player sets a goal at 50 Denarii, the reward is priced off that delta, and then a windfall makes it trivial while still paying the big reward — recomputing would price it *down* and feel like a bait-and-switch, and not recomputing but not freezing means the number shown in the builder isn't the number paid.

`dynastic` ambitions are the exception to almost all of this: no deadline, no failure, milestone-based. Model them as `ActiveAmbition` with `source: 'dynastic'`, `deadlineTurn: undefined`, `failureDignitas: 0`, `refusable: false`, and let the milestone logic stay in `legacyEngine.ts` (§2.6).

**Why `AmbitionOffer` isn't just `ActiveAmbition` with a `status: 'offered'`:** an offer has no baseline (nothing to snapshot until the player commits) and no frozen reward (the difficulty/reward computation needs a baseline to run against). Reusing `ActiveAmbition` would mean every reader has to treat `baseline`/`reward`/`failureDignitas` as maybe-absent instead of always-present, which defeats the point of freezing them at construction. A distinct, smaller type is cheaper than optional fields threaded through every consumer.

### 2.5 The Agenda Tablet's second leaf

`AgendaTablet.tsx` currently renders one list (§0.13). Add a two-leaf structure:

- **Leaf 1 — "Hodierna"** (today): the existing agenda list, unchanged.
- **Leaf 2 — "Ambitiones"**: active family + character ambition with live progress bars and seasons-remaining; the dynastic track below them; a "Set an ambition" affordance on any empty competitive slot.

Leaf switching is a two-tab header inside the existing tablet frame. Do **not** build a new modal — the tablet already has the right visual identity and is already the place the player looks after each season.

**Each competitive slot renders one of three states** (no fourth "locked" state — the cooldown was dropped, §1):
- **Empty** — "Set an ambition" affordance opens `AmbitionBuilder`.
- **Offer pending** — an `AmbitionOffer` reserves this slot; render its criterion/title with Accept/Refuse actions, no builder affordance.
- **Active** — progress bar, seasons-remaining, and an Abandon control gated on `ambition.refusable`.

Tutorial goals render here **identically** to player-set ones (design decision — §1). A tutorial-set ambition is always direct-write with `refusable: false`, so its slot shows the Active state with no Abandon control and no builder affordance.

### 2.6 Absorbing Legacy Objectives

The merge is **presentational and model-level, not a rewrite of the counters**:

- `LEGACY_DEFINITIONS`, `incrementLegacy`, `computeLegacyBonuses`, `getNextMilestone`, `initLegacyObjectives` and the `legacyObjectives` state field **all stay** (§0.10-0.11 — five live call sites plus an achievement read depend on them).
- What changes: `legacyObjectives` is **projected into the Ambitiones leaf** as read-only `dynastic` rows via a new `projectDynasticAmbitions(state): ActiveAmbition[]` in `ambitionEngine.ts`, showing each objective's current value and next milestone.
- `LegatumPanel.tsx` keeps working (it is the detailed milestone view); the leaf is the at-a-glance view. Fix its two bare `useGameStore()` calls (§0.12).

This is the cheapest correct version of "absorb them": the player sees one unified goal system, while six live increment call sites and the `midas` achievement keep reading exactly what they read today. Do **not** migrate `legacyObjectives` into the `ambitions` array — that would break §0.10's call sites and the save schema's existing `legacyObjectives` key for no gameplay gain.

---

## §3. Chunks

Each chunk is independently type-checkable and testable. Follow the interface contract in §2.4 exactly — later chunks depend on these names.

### Chunk A1 — Types + balance registry
- Rewrite `src/models/ambition.ts` per §2.4, including `AmbitionOffer` and the `'superseded'` status.
- Add `BALANCE.ambitions` to `src/data/balance.ts` with every constant from §2.3 (`pressureBase`, `min`, `max`, `failureRatio`, `failureDignitasCap`, `officeBaseline: Record<OfficeId, number>` plus `firstCharacterMult`/`firstFamilyMult`), each commented as first-pass/unverified. **No `failureCooldownSeasons`** — the cooldown was dropped (§1). `officeBaseline` mirrors the existing `officePrestige: OFFICE_PRESTIGE` keyed-by-office-id pattern already in `BALANCE.elections` — not a novel registry shape. 8 office IDs total (`OFFICES` array + `TRIBUNE_OFFICE`), so this is a small authoring burden.
- `src/data/ambitionDefinitions.ts` is **deleted** — ambitions are now authored instances, not a definition pool. (Its four broken definitions, §0.2, die with it; that is the fix.)
- Expect `tsc` to be red across `ambitionEngine.ts`, `turnSequencer.ts`, `AmbitionSelectionModal.tsx`, `CharacterActionModal.tsx`, `agendaEngine.ts` until A2-A4 land. **State this explicitly in the chunk's end-of-task summary** per CLAUDE.md.

### Chunk A2 — Engine
Rewrite `src/engine/ambitionEngine.ts`:
- `checkCriterion(criterion, state, assignedCharacterId): boolean` — all nine, no stubs.
- `measureCriterion(criterion, state, assignedCharacterId): number` — the raw current value, shared by the baseline snapshot and the progress readout. **One function, two callers** — that is what stops description/behaviour drift like §0.2.
- `getProgress(ambition, state): AmbitionProgress`.
- `computeDifficulty(criterion, baseline, deadlineSeasons, state): number`.
- `computeReward(difficultyScore, criterion, state): { reward, failureDignitas }` — including the office baseline/first-time path.
- `nextEligibleElectionTurns(officeId, state): number[]` — the `office_held` deadline-clamping helper (§2.3), reading the office's `termSeasons` and the current holder's remaining term against the Winter-only election cadence (§0.18). Consumed by the builder (Chunk A4) to populate deadline choices.
- `buildAmbition(input): ActiveAmbition` — snapshots baseline, freezes reward. Used both by the player builder and by direct-write story/tutorial effect strings (Chunk A3/§4) — one construction path regardless of source.
- `supersedeAmbition(ambition, state): { ambition: ActiveAmbition; partialReward: AmbitionReward }` — the shared "ended early, not a failure" path (§2.3's partial-payout formula): `status: 'superseded'`, reward scaled by `getProgress`'s current/target fraction, no `failureDignitas`. Called from (a) the store when a direct-write targets an occupied slot, and (b) `tickAmbitions` below.
- `tickAmbitions(ambitions, state, turnNumber)` — completion, deadline expiry → `status: 'failed'`. **Also** checks every active `character`-scope ambition's `assignedCharacterId` against `state.family`; if the character is no longer present (died via any of the three write sites in §0.19), calls `supersedeAmbition` instead of leaving it dangling. One guard here is correct regardless of which of the three death paths fired — no need to hook `turnSequencer.ts`, `musterEngine.ts`, or `trialEngine.ts` individually.
- `projectDynasticAmbitions(state): ActiveAmbition[]` (§2.6).
- New `__tests__/ambitionEngine.test.ts`: one describe per criterion (9) covering checker + measure + progress; the delta rule (near-target set = near-zero reward); the office first-time multipliers; `nextEligibleElectionTurns` against a mid-term holder; deadline pressure; failure cap; `supersedeAmbition`'s partial-payout scaling at a few progress fractions (0%, 50%, 100%); the character-death guard in `tickAmbitions`.

### Chunk A3 — Store
`src/state/gameStore.ts`:
- `ambitions: ActiveAmbition[]` (shape changed), plus `pendingAmbitionOffers: { family?: AmbitionOffer; character?: AmbitionOffer }`. **No `ambitionSlotLockedUntil`** — dropped with the cooldown (§1).
- Remove `pendingAmbitionScopes` and its re-offer block (`turnSequencer.ts:2020-2039`) — the builder is player-initiated from the tablet leaf, not pushed.
- **Delete `requestAmbitionChange` outright** (`gameStore.ts:832,2770-2773`) — confirmed by grep (§0.17) that the tutorial plan never calls it; its only caller, `CharacterActionModal.tsx`, is being rewritten in Chunk A4 anyway.
- New actions:
  - `setAmbition(input)` — player builder AND direct-write story/tutorial effect strings both call this (same underlying `buildAmbition`, different `source`). If the target slot is occupied, calls `supersedeAmbition` on the occupant first (§2.3), then installs the new one.
  - `offerAmbition(input)` — stages an `AmbitionOffer` into `pendingAmbitionOffers[scope]`, reserving the slot (§1 "Story/tutorial entry", §2.4).
  - `acceptStoryAmbition(offerId)` — converts the pending offer into a real `ActiveAmbition` via `buildAmbition` (baseline/reward captured now, at accept time), `refusable: true` (accepting a choice doesn't forfeit the right to later abandon it), clears the offer.
  - `refuseStoryAmbition(offerId)` — discards the offer, frees the slot, no consequence (§4).
  - `abandonAmbition(id)` — for any active ambition where `refusable === true` (always true for `source: 'player'`; per-instance for `'story'`/`'tutorial'`, §1).
- Rewrite `turnSequencer.ts` step 13 (`:1970-2018`) against the new reward/failure/supersede shape.

### Chunk A4 — UI
- `AgendaTablet.tsx`: two-leaf structure, three-state slot rendering (§2.5).
- New `src/components/shared/AmbitionBuilder.tsx`: criterion picker → target detail → **live reward/difficulty readout** → confirm. The live readout is the feature, not a nicety (§1). For `office_held`, the deadline field is populated from `nextEligibleElectionTurns` (Chunk A2) rather than free entry.
- Delete `AmbitionSelectionModal.tsx` (the draw-3 flow is gone).
- `CharacterActionModal.tsx:29-33`, `agendaEngine.ts:366`: update to the new shape (both currently read the old `definitionId`/`turnsRemaining` fields — confirmed by grep, §0 grounding).
- `LegatumPanel.tsx`: selector fix (§0.12).

### Chunk A5 — Save schema + glossary
- **`SaveSchema` gains a real `ambitions` entry** plus `pendingAmbitionOffers` (§0.6-0.7). Not optional-and-ignored — a proper `z.array(z.object({...}))` matching §2.4, with `.default([])` / `.default({})` so pre-rework saves load. **No `ambitionSlotLockedUntil`** entry — dropped (§1).
- Old saves carry the *old* ambition shape. Add a `loadGame` migration that **drops** unrecognised-shape ambitions rather than trying to convert them (they reference deleted definition ids and have no baseline snapshot, so they cannot be meaningfully converted) — silently, matching the `trialQueue` → `trials` migration precedent at `saveLoad.ts:82-84` (confirmed silent, no player-facing notice — a deliberate choice to match existing convention, §0).
- Glossary (`data/glossaryTerms.ts`): update `ambition`; add `dynastic ambition`, `deadline`, `ambition difficulty`, `ambition offer`. Wire `InfoTap` in the builder and the leaf.
- `SITEMAP.md`: update for the deleted/added files.

---

## §4. Narrative-start hooks (design now, author later)

Events are the spine; ambitions are the goalposts and payoff. Build **only** these hooks. Two effect-string tokens, matching the two entry mechanisms settled in §1:

1. `ActiveAmbition.source: 'story'` and `onCompleteEventId` / `onFailEventId` (already in §2.4, and mirrored on `AmbitionOffer`). An event sets or offers an ambition; resolving it fires the next event. That closes the loop in both directions with two optional string fields, on either type.
2. `setAmbition:<criterionId>:<target>:<deadline>[:refusable]` in `resourceEngine.applyEffectString` — **direct-write**. Calls `buildAmbition`/the store's `setAmbition` immediately; the ambition is active as soon as the event resolves, no player decision point. Defaults to `refusable: false` (mandatory) unless the `:refusable` suffix is present, in which case the player can `abandonAmbition` it later even though there was no accept/refuse moment up front. Force-evicts an occupied slot per §1/§2.3's supersede-with-partial-payout rule.
3. `offerAmbition:<criterionId>:<target>:<deadlineSeasons>` in the same handler — **offer-then-accept**. Stages an `AmbitionOffer` (reserving the slot) instead of an `ActiveAmbition`; the player sees it on the Ambitiones leaf and must `acceptStoryAmbition`/`refuseStoryAmbition` explicitly. Always presented as a real choice — there's no "mandatory offer," that's what `setAmbition:` is for.

Both tokens follow the existing `setFlag:`/`startWar:` token precedent. Choosing which one an event/beat uses is a content-authoring decision made per beat, not a system-level rule — a tutorial lesson and a mid-game crisis event can each use either token depending on whether the moment is meant to feel inevitable or like a real choice (§1 "Refusal").

**Do not** author per-gens opening ambitions, narrative text, or start-specific chains in this plan. The hooks make that a content task later rather than a re-architecture.

---

## §5. Done when

- A player on Standard Start can open the tablet's second leaf, author a family and a character ambition through the builder with a live reward readout, watch progress accrue, and get paid on completion or docked (capped) on deadline failure — and can immediately set a new one in that slot with no cooldown.
- Setting a target the player has nearly already met pays approximately nothing.
- An `office_held` ambition's deadline choices are limited to actually-reachable Winter elections; the builder never lets a player set one that's structurally impossible.
- A direct-write test event can evict an occupied slot and the evicted ambition pays out a reward proportional to its progress, with status `'superseded'` (not `'failed'`) and no dignitas ding.
- A test offer-flow event stages an `AmbitionOffer` that reserves its slot, is visible on the leaf, and can be accepted (becoming a real `ActiveAmbition`, baseline snapshotted at accept time) or refused (slot freed, no consequence).
- Killing off a character with an active `character`-scope ambition (via any of the three death paths, §0.19) supersedes it with the same partial-progress payout, without needing to touch the death call sites themselves.
- The six dynastic rows show current value and next milestone, and every existing `incrementLegacy` call site still moves them.
- `npx tsc --noEmit` is zero-error; `npm test` passes with `__tests__/ambitionEngine.test.ts` added.
- No save written before this rework fails to load; ambitions from before the rework load as empty (dropped silently, matching the `trialQueue` precedent).
