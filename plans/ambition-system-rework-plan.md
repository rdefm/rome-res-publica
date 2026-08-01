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

---

## §1. Design decisions (settled with the design lead — do not re-open)

| # | Decision |
|---|---|
| Difficulty basis | **Delta from state-at-set-time**, not absolute threshold. Setting "500 Denarii" while holding 480 is worth almost nothing. |
| Offices | Offices are the exception to pure delta: each office has a **baseline reward**, multiplied up when it's a **first** for this character *or* for the family. |
| Stake | **Deadline mandatory** on every player-set ambition. It is both the difficulty axis and the anti-exploit. |
| Failure cost | Small `lifetimeDignitas` ding, scaled to the reward that was on offer and **hard-capped low**, plus the slot locks for a cooldown before another can be set. **No up-front wager.** |
| Criteria | Curated builder, ~8 criteria (§2.2). Extensible later. |
| Difficulty display | **Computed from the criteria**, shown live as the player edits, so they scale the ambition up/down themselves. Not a difficulty tier that gates targets. |
| Slots | **No new slots.** 1 family + 1 character active, exactly as today, plus `dynastic` as an always-on non-competing track. Tutorial-set, story-set and player-set all write into those same two slots. |
| Legacy Objectives | **Absorbed** into ambitions as `scope: 'dynastic'`. |
| Achievements | **Kept as-is.** Separate system, retrospective, no player input, no mechanical effect. |
| Refusal | Post-tutorial the player **can** refuse a story-set ambition. In-tutorial they cannot (see the tutorial plan). |
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

Exactly eight. Each needs a checker **and** a progress readout `{ current, target, label }` — the readout is what makes the tablet leaf worth opening, and is the thing today's system entirely lacks.

| id | Player-facing | Target the player sets | Delta basis |
|---|---|---|---|
| `resource_threshold` | "Hold N Denarii / Fides" | amount | current value at set time |
| `office_held` | "Win the ⟨office⟩" | office | n/a — baseline + first-time multiplier |
| `clan_standing` | "Reach N standing with ⟨clan⟩" | clan + value | current standing at set time |
| `asset_tier` | "Own ⟨asset⟩ at Tier N" | asset + tier | current tier (0 if unowned) |
| `client_count` | "Hold N clients" | count | current count |
| `military_outcome` | "Win N battles / take ⟨region⟩" | count or region | current count / control |
| `survive_seasons` | "Keep the gens intact N more seasons" | seasons | always a pure delta |
| `trial_won` | "Win N trials" | count | current count |

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

**Failure:**

```
failureDignitas = -min(
  round(reward.lifetimeDignitas × BALANCE.ambitions.failureRatio),
  BALANCE.ambitions.failureDignitasCap
)
```

The cap is the whole point — it makes an ambitious failed goal sting proportionally but never catastrophically. Plus `slotLockedUntilTurn = turnNumber + BALANCE.ambitions.failureCooldownSeasons`.

**The exploit this closes:** setting "500 Denarii" at 480 gives `deltaScore ≈ 0`, so the reward rounds to ~0. Setting it at 50 with a tight deadline scores high. No separate exploit check needed anywhere.

### 2.4 Types

Replace `src/models/ambition.ts` wholesale (it is 63 lines and every interface changes):

```ts
export type AmbitionScope = 'family' | 'character' | 'dynastic';
export type AmbitionStatus = 'active' | 'completed' | 'failed';
export type AmbitionSource = 'player' | 'story' | 'tutorial' | 'dynastic';

export type AmbitionCriterionId =
  | 'resource_threshold' | 'office_held' | 'clan_standing' | 'asset_tier'
  | 'client_count' | 'military_outcome' | 'survive_seasons' | 'trial_won';

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
  /** Narrative hooks (authored later — see §5). */
  onCompleteEventId?: string;
  onFailEventId?: string;
}

export interface AmbitionProgress { current: number; target: number; label: string; }
```

`reward` is **frozen at set time**, not recomputed on completion. Otherwise a player sets a goal at 50 Denarii, the reward is priced off that delta, and then a windfall makes it trivial while still paying the big reward — recomputing would price it *down* and feel like a bait-and-switch, and not recomputing but not freezing means the number shown in the builder isn't the number paid.

`dynastic` ambitions are the exception to almost all of this: no deadline, no failure, milestone-based. Model them as `ActiveAmbition` with `source: 'dynastic'`, `deadlineTurn: undefined`, `failureDignitas: 0`, and let the milestone logic stay in `legacyEngine.ts` (§2.6).

### 2.5 The Agenda Tablet's second leaf

`AgendaTablet.tsx` currently renders one list (§0.13). Add a two-leaf structure:

- **Leaf 1 — "Hodierna"** (today): the existing agenda list, unchanged.
- **Leaf 2 — "Ambitiones"**: active family + character ambition with live progress bars and seasons-remaining; the dynastic track below them; a "Set an ambition" affordance on any empty competitive slot.

Leaf switching is a two-tab header inside the existing tablet frame. Do **not** build a new modal — the tablet already has the right visual identity and is already the place the player looks after each season.

Tutorial goals render here **identically** to player-set ones (design decision — §1). The only difference is that a tutorial-set ambition's "Set an ambition" affordance is absent, because its slot is occupied.

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
- Rewrite `src/models/ambition.ts` per §2.4.
- Add `BALANCE.ambitions` to `src/data/balance.ts` with every constant from §2.3, each commented as first-pass/unverified.
- `src/data/ambitionDefinitions.ts` is **deleted** — ambitions are now authored instances, not a definition pool. (Its four broken definitions, §0.2, die with it; that is the fix.)
- Expect `tsc` to be red across `ambitionEngine.ts`, `turnSequencer.ts`, `AmbitionSelectionModal.tsx`, `CharacterActionModal.tsx`, `agendaEngine.ts` until A2-A4 land. **State this explicitly in the chunk's end-of-task summary** per CLAUDE.md.

### Chunk A2 — Engine
Rewrite `src/engine/ambitionEngine.ts`:
- `checkCriterion(criterion, state, assignedCharacterId): boolean` — all eight, no stubs.
- `measureCriterion(criterion, state, assignedCharacterId): number` — the raw current value, shared by the baseline snapshot and the progress readout. **One function, two callers** — that is what stops description/behaviour drift like §0.2.
- `getProgress(ambition, state): AmbitionProgress`.
- `computeDifficulty(criterion, baseline, deadlineSeasons, state): number`.
- `computeReward(difficultyScore, criterion, state): { reward, failureDignitas }` — including the office baseline/first-time path.
- `buildAmbition(input): ActiveAmbition` — snapshots baseline, freezes reward.
- `tickAmbitions(ambitions, state, turnNumber)` — completion, deadline expiry → `status: 'failed'`.
- `projectDynasticAmbitions(state): ActiveAmbition[]` (§2.6).
- New `__tests__/ambitionEngine.test.ts`: one describe per criterion covering checker + measure + progress; the delta rule (near-target set = near-zero reward); the office first-time multipliers; deadline pressure; failure cap.

### Chunk A3 — Store
`src/state/gameStore.ts`:
- `ambitions: ActiveAmbition[]` (shape changed), plus `ambitionSlotLockedUntil: { family: number; character: number }`.
- Remove `pendingAmbitionScopes` and its re-offer block (`turnSequencer.ts:2020-2039`) — the builder is player-initiated from the tablet leaf, not pushed. Keep `requestAmbitionChange` only if the tutorial plan needs a programmatic open; otherwise delete.
- New actions: `setAmbition(input)`, `abandonAmbition(id)`, `acceptStoryAmbition(id)`, `refuseStoryAmbition(id)`.
- Rewrite `turnSequencer.ts` step 13 (`:1970-2018`) against the new reward/failure shape.

### Chunk A4 — UI
- `AgendaTablet.tsx`: two-leaf structure (§2.5).
- New `src/components/shared/AmbitionBuilder.tsx`: criterion picker → target detail → **live reward/difficulty readout** → confirm. The live readout is the feature, not a nicety (§1).
- Delete `AmbitionSelectionModal.tsx` (the draw-3 flow is gone).
- `CharacterActionModal.tsx:29-33`, `agendaEngine.ts:366`: update to the new shape.
- `LegatumPanel.tsx`: selector fix (§0.12).

### Chunk A5 — Save schema + glossary
- **`SaveSchema` gains a real `ambitions` entry** plus `ambitionSlotLockedUntil` (§0.6-0.7). Not optional-and-ignored — a proper `z.array(z.object({...}))` matching §2.4, with `.default([])` so pre-rework saves load.
- Old saves carry the *old* ambition shape. Add a `loadGame` migration that **drops** unrecognised-shape ambitions rather than trying to convert them (they reference deleted definition ids and have no baseline snapshot, so they cannot be meaningfully converted). Mirror the `trialQueue` → `trials` migration precedent at `saveLoad.ts:82-84`.
- Glossary (`data/glossaryTerms.ts`): update `ambition`; add `dynastic ambition`, `deadline`, `ambition difficulty`. Wire `InfoTap` in the builder and the leaf.
- `SITEMAP.md`: update for the deleted/added files.

---

## §4. Narrative-start hooks (design now, author later)

Events are the spine; ambitions are the goalposts and payoff. Build **only** these hooks:

1. `ActiveAmbition.source: 'story'` and `onCompleteEventId` / `onFailEventId` (already in §2.4). An event sets an ambition; resolving it fires the next event. That closes the loop in both directions with two optional string fields.
2. A new effect-string token `setAmbition:<criterionId>:<target>:<deadline>` in `resourceEngine.applyEffectString`, so an `EventDef` choice can impose one with no new plumbing. Follows the existing `setFlag:`/`startWar:` token precedent exactly.
3. `refuseStoryAmbition(id)` (Chunk A3) is what makes an imposed ambition not-just-a-crisis: post-tutorial, refusing is free and simply declines it.

**Do not** author per-gens opening ambitions, narrative text, or start-specific chains in this plan. The hooks make that a content task later rather than a re-architecture.

---

## §5. Done when

- A player on Standard Start can open the tablet's second leaf, author a family and a character ambition through the builder with a live reward readout, watch progress accrue, and get paid on completion or docked (capped) on deadline failure.
- Setting a target the player has nearly already met pays approximately nothing.
- The six dynastic rows show current value and next milestone, and every existing `incrementLegacy` call site still moves them.
- `npx tsc --noEmit` is zero-error; `npm test` passes with `__tests__/ambitionEngine.test.ts` added.
- No save written before this rework fails to load.
