# Ambition System Rework — Spec

Source plan: `plans/ambition-system-rework-plan.md` (approved design; this spec restates it in PRD form for handoff). Implement on branch `claude/imperium-debug-menu-4ktgyx` — do not cut a new branch for this work (explicit standing instruction from the plan doc).

## Problem Statement

Today's ambition system hands the player one of three randomly-drawn goals with no way to choose what they're working toward, and four of the thirteen existing definitions are silently broken — they check a different condition than the one their own description promises the player (e.g. "Raise Rhetoric to 8" actually checks a Fides threshold that never reads Rhetoric at all). Two more definitions (`produce_heir`, `prosecute_rival`) can never be completed because their checkers are unfinished stubs. Ambitions also carry no visible progress readout, so between setting a goal and it resolving the player has no feedback on how close they are. Separately, Legacy Objectives (six dynastic, always-on goals) live in a completely different panel with their own mental model, so the player is tracking two disconnected "things I'm working toward" systems instead of one.

## Solution

Replace the draw-3-and-pick system with a player-authored goal builder: the player picks a criterion from a curated list, sets their own target and deadline, and sees a live difficulty/reward readout as they do it. Difficulty is computed from the *delta* between the target and the player's current standing (so setting a goal you've nearly already met pays almost nothing), plus deadline pressure. Legacy Objectives are absorbed into the same system as an always-on `dynastic` scope, presented alongside player-set family and character ambitions on a new second leaf ("Ambitiones") of the Agenda Tablet, without touching the five live call sites that already increment their counters. Achievements are untouched. Story and tutorial content get two narrative-hook mechanisms (direct-write and offer-then-accept) so future events can set or offer ambitions and react to their outcome.

## User Stories

1. As a player, I want to open a builder and pick from a curated list of ambition criteria, so that I can choose a goal that matches what I'm actually trying to achieve in my playthrough.
2. As a player, I want to set my own numeric target (e.g. how much Denarii to hold, how many clients to reach), so that the goal reflects my own strategy rather than a fixed value chosen for me.
3. As a player, I want to see a live difficulty and reward readout as I adjust my target and deadline in the builder, so that I can deliberately scale a goal up or down before committing to it.
4. As a player, I want the difficulty of a resource/count-based goal to be based on how far the target is from what I currently hold, so that setting a target I've nearly already met isn't a free reward.
5. As a player, I want every ambition I set to require a deadline, so that ambitions stay meaningfully difficult rather than becoming "set it and forget it forever."
6. As a player, I want to be rewarded with Dignitas (and sometimes Fides) on completing an ambition, scaled to how hard the goal I set was, so that harder self-chosen goals feel worth more.
7. As a player, I want a failed ambition (missed deadline) to cost me a small, capped amount of Dignitas, so that failure stings proportionally without being catastrophic or exploitable as a punishment loop.
8. As a player, I want to be able to set a new ambition in a slot immediately after a failure, with no cooldown, so that I'm not locked out of the goal system as an extra penalty on top of the Dignitas ding.
9. As a player, I want one active family ambition and one active character ambition at a time (unchanged from today), so that the goal system stays focused rather than becoming a checklist.
10. As a player, I want to pursue a goal about my Denarii or Fides holdings ("Hold N Denarii/Fides"), so that I can set economic or piety-driven goals.
11. As a player, I want to pursue a goal about winning a specific office, so that political advancement can be a self-directed target.
12. As a player, I want a first-time-ever office win (for the character, or for the family) to be worth noticeably more Dignitas than a repeat win, so that historic firsts feel special.
13. As a player, I want an office-win ambition's deadline choices to only ever offer elections that are actually reachable (respecting term lengths and the Winter-only election calendar), so that I can never accidentally set a goal that is structurally impossible to complete in time.
14. As a player, I want to pursue a goal about reaching a standing threshold with a specific clan, so that clan diplomacy can be a self-directed target.
15. As a player, I want to pursue a goal about owning a specific asset at a specific tier, so that city-building/economic investment can be a self-directed target.
16. As a player, I want to pursue a goal about the number of clients I hold, so that patronage-building can be a self-directed target.
17. As a player, I want to pursue a goal about winning a number of battles, so that military accomplishment can be a self-directed target.
18. As a player, I want to pursue a goal about taking control of a specific region, so that territorial conquest can be a self-directed target.
19. As a player, I want to pursue a goal about keeping my gens intact for a number of further seasons, so that pure survival/stability can be a self-directed target.
20. As a player, I want to pursue a goal about winning a number of trials, so that legal/prosecutorial success can be a self-directed target.
21. As a player, I want the six dynastic (formerly "Legacy Objective") goals to always be active in the background with no deadline and no way to fail them, so that long-run generational progress keeps accumulating regardless of what I'm actively pursuing.
22. As a player, I want the dynastic goals shown at-a-glance on the Ambitiones leaf (current value + next milestone) alongside my active ambitions, so that I see all my "things I'm working toward" in one place instead of a separate panel.
23. As a player, I want the existing detailed Legacy panel to keep working exactly as it does today, so that I don't lose the deeper milestone view I'm used to.
24. As a player, I want a second leaf on the Agenda Tablet ("Ambitiones") alongside the existing agenda list ("Hodierna"), reachable by a tab switch inside the same tablet, so that I don't have to learn a new UI surface for goal-tracking.
25. As a player, I want each ambition slot to clearly show whether it's empty (with a "Set an ambition" affordance), has a pending offer awaiting my accept/refuse decision, or holds an active ambition with a progress bar and seasons-remaining, so that I always know the state of my goal slots at a glance.
26. As a player, I want an active ambition to show a progress bar and seasons-remaining derived from its actual current-vs-target measurement, so that I get continuous feedback instead of silence until resolution.
27. As a player, I want to be able to abandon an active ambition when it's marked abandonable, so that I'm not stuck with a goal that no longer fits my strategy.
28. As a player, when a story or tutorial event assigns me an ambition directly, I want it to occupy my family or character slot the same way a self-set ambition would (same visuals, same progress bar), so the game doesn't visually call out "this one's different."
29. As a player, when a story event offers me an ambition as a real choice, I want to see it on the Ambitiones leaf with explicit Accept/Refuse actions before it becomes active, so that meaningful narrative choices aren't sprung on me automatically.
30. As a player, if I refuse an offered ambition, I want no consequence and the slot freed immediately, so refusing a genuine choice never feels like a trap.
31. As a player, if a story/tutorial-set ambition is marked non-abandonable, I want no Abandon control shown for it, so that I understand it's a committed, not-optional beat.
32. As a player, if a new story/tutorial event tries to directly set an ambition into a slot I've already filled myself, I want my existing ambition to end gracefully (not "fail") and pay out a reward scaled to how far along it already was, so that narrative events don't punish my unrelated progress.
33. As a player, if the character my ambition is assigned to dies, I want that ambition to end the same graceful way — partial payout, not a failure penalty — so that a death I didn't choose doesn't also cost me Dignitas on top of losing the character.
34. As a player, I want the reward I was shown in the builder to be the reward I actually receive on completion (not recalculated against my state at completion time), so that a lucky windfall mid-goal never quietly devalues the payout I was promised.
35. As a content author, I want an event effect string that directly writes an ambition into a slot (with criterion, target, deadline, and an optional "abandonable" flag), so that I can script goals that simply happen to the player as part of a story beat.
36. As a content author, I want an event effect string that stages an ambition as a pending offer instead of writing it directly, so that I can script goals meant to feel like a deliberate player choice.
37. As a content author, I want to attach an "on complete" and/or "on fail" event id to any ambition or offer I author, so that completing or failing a story-driven ambition can trigger a follow-up narrative beat.
38. As a player with an old save (from before this rework), I want my save to still load successfully, so that a system rework doesn't brick my existing playthrough.
39. As a player with an old save, I want any ambitions from the old system to simply disappear (empty slots) rather than crash or corrupt my save, since they reference goal definitions that no longer exist and can't be meaningfully converted.
40. As a player, I want ambition-related terms (dynastic ambition, deadline, ambition difficulty, ambition offer) to have glossary entries I can tap for an explanation, consistent with how other game terms work.

## Implementation Decisions

**Scope model.** Ambitions gain a `scope` of `'family' | 'character' | 'dynastic'`. `family` and `character` remain single competitive slots (one active each, unchanged from today). `dynastic` is new: all six absorbed Legacy Objective tracks are always active, never chosen by the player, never fail, and carry no deadline.

**Criteria vocabulary (nine, closed set for this rework).** `resource_threshold` (Denarii/Fides), `office_held`, `clan_standing`, `asset_tier`, `client_count`, `battles_won`, `region_control`, `survive_seasons`, `trial_won`. Each criterion needs both a boolean checker and a progress readout (`{ current, target, label }`) computed from one shared "measure" function, so the checker and the description can never drift apart the way four of the old definitions did. An earlier draft's single combined `military_outcome` criterion is split into `battles_won` (count) and `region_control` (boolean-per-region) because bundling a count-goal and a control-goal under one id forces internal branching everywhere it's touched; two ordinary criteria is simpler. The two previously-stubbed, never-completable criteria (`produce_heir`, `prosecute_rival`) are dropped rather than carried forward — `trial_won` covers the prosecution case, and `survive_seasons` covers the heir case well enough.

**Difficulty and reward math.** For all criteria except `office_held`, difficulty is `deltaScore × deadlinePressure`, where `deltaScore` is a normalized 0..1 measure of how far the target is from the value at the moment the ambition was set (not from zero, and not recomputed later), and `deadlinePressure` scales up as the deadline tightens. Reward (Dignitas, and sometimes Fides) is `round(base × difficultyScore)`. `office_held` is the deliberate exception: it uses a per-office baseline reward multiplied up if the office would be a first-ever win for the character and/or for the family, since "delta from current standing" doesn't make sense for a binary office win. All tuning constants (deadline-pressure curve, failure ratio/cap, per-office baselines, first-time multipliers) live in the existing balance-constants registry, each flagged as a first-pass, unverified value to tune after play-testing — following the same convention already used for every other balance constant in the project.

**Deadlines are mandatory** on every player-set ambition — this is both the difficulty axis and the anti-exploit (setting a target you're already near gives you a real deadline for essentially no payout, so there's no free-reward loophole to close separately). `office_held` deadlines are further constrained: because elections resolve only in a fixed season each year and offices have fixed terms, the builder computes which future election points are actually reachable given the office's term length and the current holder's remaining term, and only offers those as deadline choices — never a deadline that's structurally impossible to hit.

**Failure is a capped, proportional Dignitas ding** — `-min(round(reward × failureRatio), failureCap)` — with **no cooldown** on the slot. This was a deliberate change from an earlier draft that also locked the slot for a period after failure; that lock was dropped because the delta rule already prevents exploiting failure, so a lock would only be extra punishment stacked on top of the Dignitas ding for no anti-exploit benefit.

**Reward is frozen at set time**, not recomputed at completion. This matters because the player is shown a specific reward number in the builder before committing — recomputing at completion against a changed game state (e.g. after a windfall makes the goal trivially easy) would either silently shrink the promised reward or leave the shown number meaningless.

**Graceful early termination (`'superseded'` status, distinct from `'failed'`).** Two situations end an ambition early through no fault of the player, and both use one shared function: a direct-write event targeting an already-occupied slot evicts the current occupant, and an assigned character's death (detected by checking, every season, whether `assignedCharacterId` still resolves to a living family member — rather than hooking each of the game's several separate character-removal code paths individually) ends a `character`-scope ambition. In both cases the ambition is marked `'superseded'`, pays out a reward scaled to its progress fraction at the time of interruption (using the same current/target measurement that drives its progress bar), and applies no failure Dignitas penalty.

**Two narrative-entry mechanisms, both landing in the same two competitive slots:**
- *Direct-write* — a story/tutorial event effect writes a fully-formed active ambition straight into a slot; used for beats where the goal simply happens to the player, with no accept/refuse moment. Defaults to non-abandonable unless the event explicitly marks it abandonable.
- *Offer-then-accept* — a story event effect stages a pending offer that reserves the slot and shows Accept/Refuse controls on the Ambitiones leaf; used for beats meant to feel like a genuine player choice. Accepting captures the baseline and freezes the reward at accept time (not at offer time), and always leaves the resulting ambition abandonable, since accepting a choice shouldn't forfeit the right to later change your mind. Refusing discards the offer and frees the slot with no consequence.

Whether a given ambition/offer is abandonable is **per-instance, not per-source** — tutorial beats will conventionally mark theirs non-abandonable and story beats may go either way, but this is a per-authoring decision, not a hardcoded rule keyed off `source`.

**Presentation.** Tutorial-set and player-set ambitions render identically on the Ambitiones leaf — same object type, same visual treatment, no separate tutorial styling. The tablet gains a two-leaf structure: the existing agenda list is unchanged as the first leaf, and the new Ambitiones leaf is the second, reached by a tab switch inside the same modal (not a new modal). Each of the two competitive slots renders one of exactly three states: empty (with a "set an ambition" affordance), offer-pending (criterion/title plus Accept/Refuse, no builder affordance), or active (progress bar, seasons-remaining, and an Abandon control gated on the ambition's abandonable flag). There is no fourth "locked/cooldown" state, since the cooldown was dropped.

**Absorbing Legacy Objectives.** This is a presentation and model-level merge, not a data migration: the existing Legacy Objective definitions, their increment/bonus/milestone logic, and their live call sites (five call sites plus one achievement read) are left untouched and continue to read/write exactly what they do today. What's new is a projection function that turns the current Legacy Objective state into read-only `dynastic`-scope ambition rows for display on the Ambitiones leaf. The detailed Legacy panel keeps working as the deeper milestone view; the leaf is the at-a-glance view. (Two pre-existing unscoped-selector calls in that panel get fixed as part of touching the file, per the project's standing "fix it while you're in there" convention — unrelated to this feature but flagged rather than silently bundled.)

**Type shape (from the approved design, restated here since later implementation work depends on these names/shapes exactly):**

```ts
type AmbitionScope = 'family' | 'character' | 'dynastic';
type AmbitionStatus = 'active' | 'completed' | 'failed' | 'superseded';
type AmbitionSource = 'player' | 'story' | 'tutorial' | 'dynastic';

type AmbitionCriterionId =
  | 'resource_threshold' | 'office_held' | 'clan_standing' | 'asset_tier'
  | 'client_count' | 'battles_won' | 'region_control' | 'survive_seasons' | 'trial_won';

interface AmbitionCriterion {
  id: AmbitionCriterionId;
  resource?: 'denarii' | 'fides';
  officeId?: OfficeId;
  clanId?: string;
  assetId?: string;
  regionId?: RegionId;
  amount?: number;
}

interface AmbitionBaseline { value: number; turnNumber: number; }

interface AmbitionReward {
  lifetimeDignitas?: number; fides?: number; denarii?: number;
  traitId?: string; assetId?: string;
}

interface ActiveAmbition {
  id: string;
  scope: AmbitionScope;
  source: AmbitionSource;
  title: string;
  criterion: AmbitionCriterion;
  baseline: AmbitionBaseline;
  assignedCharacterId?: string;
  status: AmbitionStatus;
  turnSet: number;
  deadlineTurn?: number;       // required when source === 'player'
  turnResolved?: number;
  reward: AmbitionReward;      // computed at set time and frozen
  failureDignitas: number;     // computed at set time, negative
  refusable: boolean;          // per-instance abandonability, always true for source === 'player'
  onCompleteEventId?: string;
  onFailEventId?: string;
}

interface AmbitionProgress { current: number; target: number; label: string; }

interface AmbitionOffer {
  id: string;
  scope: AmbitionScope;
  assignedCharacterId?: string;
  title: string;
  criterion: AmbitionCriterion;
  deadlineSeasons?: number;    // resolved to an absolute deadlineTurn on accept
  onCompleteEventId?: string;
  onFailEventId?: string;
  turnOffered: number;
}
```

`AmbitionOffer` is deliberately a separate, smaller type rather than `ActiveAmbition` with a "pending" status — an offer has no baseline to snapshot yet and no reward to freeze, and threading optional-until-accepted fields through every `ActiveAmbition` consumer would be more expensive than one extra type.

**Save/schema.** The save schema gains a real, validated `ambitions` entry and a `pendingAmbitionOffers` entry (both currently absent from schema validation, a pre-existing gap this rework closes for the new shape going forward). Old saves carry the old ambition shape, which references now-deleted definitions and has no baseline snapshot to convert from — the load path drops unrecognized-shape ambitions silently, matching the precedent already established for a prior save-shape migration in this codebase, rather than attempting a lossy best-effort conversion.

**Narrative hook surface (design now, author later).** Two effect-string tokens are added to the event-effect vocabulary, following the same convention as existing tokens like flag-setting and war-starting: one for direct-write (criterion, target, deadline, optional abandonable flag) and one for offer-then-accept (criterion, target, deadline duration). No per-storyline opening ambitions, narrative text, or start-specific content is authored as part of this work — that's explicitly a later content task once the hook mechanism exists.

**Explicitly not changed:** Achievements (a separate, retrospective, no-input system) are untouched. No new ambition slots are added beyond the existing one-family/one-character plus the new always-on dynastic track. `legacyObjectives` state is not migrated into the ambitions array — the absorption is projection-only.

## Testing Decisions

**Primary seam: the ambition engine's pure functions.** This feature's game logic (criterion checking, progress measurement, difficulty/reward computation, office deadline-eligibility, ambition construction, the supersede path, seasonal ticking, and the dynastic projection) is designed as a set of pure functions with no React/UI dependency, consistent with this codebase's existing engine-layer convention (`src/engine/`, no logic in UI or data layers). That is the one seam this feature should be tested through — it is the highest point at which behavior can be verified without going through UI or persisted-store plumbing, and it's where all the fixed bugs (description/checker drift, biased shuffling, stub criteria) actually live. One new test file at this seam, following the existing one-file-per-engine-area pattern already used throughout the test suite.

Coverage at this seam should include: one case per criterion (checker + measure + progress readout), the delta rule specifically (a near-target set should score near-zero reward — this is the property that closes the exploit the old system had no defense against), the office first-time multipliers, office deadline-eligibility against a mid-term office holder, deadline-pressure scaling, the failure-cost cap, the supersede path's proportional payout at a few different progress fractions, and the character-death guard.

**What NOT to test at this seam:** anything about how the builder UI renders the live readout, how the Agenda Tablet's leaf-switching or per-slot state rendering looks, or button wiring — those are UI-layer concerns and, per this codebase's stated testing philosophy, should only be exercised by hand (or a higher-level flow) if at all, not asserted against implementation details.

**Good test = external behavior only.** Tests should assert on the engine's public function outputs (does this criterion register as complete given this state; does this difficulty score come out low for a near-met target; does a superseded ambition pay out the right fraction) — not on internal computation steps. This mirrors the existing convention across the project's engine test files.

## Out of Scope

- Rebuilding the tutorial system's content to consume this feature (a separate, already-written follow-on plan that depends on this one's types/actions/leaf, but is not part of this spec).
- Authoring any actual narrative content — per-start opening ambitions, story text, event chains — that uses the two new effect-string tokens. Only the token mechanism itself is in scope here.
- Any change to Achievements.
- Adding ambition slots beyond the existing one-family/one-character plus the new dynastic track.
- Migrating `legacyObjectives` state into the `ambitions` array (the absorption is a read-only projection, not a data migration).
- Reintroducing a failure cooldown (explicitly considered and dropped during design).
- A combined `military_outcome` criterion (explicitly split into `battles_won` / `region_control` during design).
- Converting or attempting to salvage old-shape ambitions from pre-rework saves (dropped silently by design).
- Any UI/visual distinction between tutorial-authored and player-authored ambitions (explicitly ruled out — they must render identically).

## Further Notes

- This work ships on the existing branch `claude/imperium-debug-menu-4ktgyx` per explicit instruction in the source plan — do not cut a new branch.
- Sequencing: this should be built and play-tested as a standalone feature before the tutorial-rebuild follow-on work begins, specifically so the goal loop is validated as fun on its own before the tutorial is made to depend on its types and actions.
- All new numeric balance constants are first-pass and explicitly unverified; expect a tuning pass after play-testing, same as the rest of the project's balance registry.
- The source plan document (`plans/ambition-system-rework-plan.md`) contains a `§0` section of pre-verified findings (file/line-level) and a full chunk breakdown intended for direct implementation — this spec is the PRD-level restatement of that same approved design, not a re-derivation of it, and the plan doc remains the authoritative implementation reference for exact interface contracts.
</content>
