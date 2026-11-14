# Spec 03 — Presentation queue and season-end sequence

**Source:** `plans/go-live-review-and-plan.md` §2 B4, §3.1, §3.3, §3.4, §4.2, workstream B · **Priority:** P0 · **Phase:** 0 — Stabilise
**Triage:** `ready-for-agent`

## Verified findings (checked against `917e1ae`)

1. **Many blocking surfaces mount independently.** `App.tsx:459-497` mounts `TutorialLayer`, `TutorialDeflectionToast`, `EventModal`, `CityEventModal`, `AmbitionSelectionModal`, `BirthNamingModal`, `AgendaTablet`, `WelcomeBackModal`, `TrialSessionModal`, `EngagementInterstitial`, `BattleScreen`, `EpilogueScreen` and `AchievementToast`. Each self-gates on its own store field. `SeasonOverlay` is mounted separately inside each tab screen (Curia, Cursus, Domus, ...) as an absolutely positioned View, not a Modal.
2. **The priority comment admits gaps.** `App.tsx:461-482` states the priority (EventModal → Ambition → BirthNaming → Agenda → WelcomeBack) and admits that the trial-session vs. random-event overlap was left undeferred.
3. **The "blocked" condition is copied three times, and the copies have already drifted:**
   - `TutorialLayer` (`App.tsx:199-214`): activeEvent, seasonOverlayVisible, pendingBirthNaming, ambition (gated on `philonAdvisoryUnlocked`), in-session trial, activeBattle.
   - Agenda auto-open (`App.tsx:365-378`): checks `agendaVisible`, uses a **bare** `pendingAmbitionScopes.length > 0` (the very bug `TutorialLayer`'s comment says it fixed), and **does not** check `activeBattle`.
   - Tutorial director (`App.tsx:402-418`): matches `TutorialLayer`.
   - **None of the three** checks `activeCityEvent`, `pendingEngagements`, `pendingSuccession` or `runFinished`.
4. **Agenda false lead.** `agendaEngine.ts:188`: for a non-player member with no held offices, the prerequisite check is skipped (`memberHeld.length > 0 && ...`). So "Livia Brutus could stand for Aedile" is recommended on turn one even though she can't run. Confirmed.
5. **Leaked internal ids.** `AmbitionSelectionModal.tsx:21` builds the reward line as `` `Grants trait: ${r.traitId}` ``, which prints `great_orator`. Confirmed.
6. **Season-end state is written in one store commit.** `endSeason` sets `seasonOverlayVisible: true` plus whatever `processSeason` produced (`activeEvent`, `pendingBirthNaming`, re-offered `pendingAmbitionScopes`, `pendingEngagements`, an in-session trial) at once (`gameStore.ts:~1894`). Every self-gated modal sees its trigger in the same render.
7. `runIdleSeasons` (`gameStore.ts:1913`) already drains each of these surfaces in a fixed order (events → trials → birth naming → engagements ...), so the test harness has a de facto order already.

## Problem Statement

At the end of a season the player can be shown a war event, an ambition picker and a birth-naming dialog all at the same moment, stacked on top of each other. They can't tell which one to answer first, and the season recap they're meant to read sits underneath. The tutorial and the Agenda each try to stay out of the way using their own hand-copied idea of "something is on screen", and those copies disagree. So the tutorial caption, the Agenda and the modals collide in ways that have softlocked the tutorial in the past. Separately, the Agenda recommends offices a family member can't run for, and the ambition picker shows raw internal ids.

## Solution

Introduce one **presentation queue**: a pure derivation from game state that answers "which blocking surface, if any, owns the screen right now?" Every blocking surface renders only when it is the head of the queue. Everything else that needs to wait (the tutorial director, the tutorial layer, the Agenda auto-open, toasts) reads one shared `isBlocked` selector derived from the same queue. Season-end becomes a designed sequence: recap, then story event, then family news, then planning prompts. The player meets each decision alone. The Agenda's false lead and the leaked ids are fixed along the way.

## User Stories

1. As a player, I want only one decision on screen at a time, so that I always know what the game is asking me.
2. As a player ending a season, I want to see the season recap first, so that I understand what just happened before I'm asked to decide anything.
3. As a player, I want the story event (war, crisis, random event) to come after the recap, so that I read events in the context of the season's results.
4. As a player, I want family news (births, deaths, succession) after the story event, so that personal moments aren't buried under politics.
5. As a player, I want planning prompts (ambition selection, the Agenda) last, so that I plan with full knowledge of what the season brought.
6. As a player, I want a trial session and a random event in the same season to arrive one after the other, never overlapping, so that I can give the trial my full attention.
7. As a player, I want a pending field engagement to wait its turn rather than covering an open event, so that I'm not forced into a battle decision mid-event.
8. As a player, I want the run's epilogue to take over cleanly when the run ends, with nothing else queued above it, so that the ending lands.
9. As a player returning to the app, I want the Welcome Back summary to appear only when nothing more urgent is pending (and to come before the restored event otherwise), so that I'm re-oriented before deciding.
10. As a player, I want the tutorial caption hidden whenever any blocking surface is up, so that it never paints over a button I need to press.
11. As a player in the guided tutorial, I want tutorial steps to wait until the queue is clear and then resume, so that the tutorial can never softlock behind a modal.
12. As a player, I want the Agenda to open automatically only when nothing else is pending, so that it doesn't pop over an event.
13. As a player, I want achievement toasts to wait until the screen is clear, so that celebrations don't obscure decisions.
14. As a player, I want the Agenda to only suggest offices a family member can actually stand for, so that I don't waste a turn chasing an impossible campaign.
15. As a player, I want ambition rewards described in plain words ("Grants the Great Orator trait"), so that I'm never shown a code id.
16. As a player, I want flavor lines shown with correct, single quotation marks, so that the text looks edited.
17. As a player on Android, I want the back button to act on the head of the queue only (dismiss it if it's dismissible, otherwise do nothing), so that I can't skip past a required decision.
18. As a player who kills the app mid-sequence, I want the remaining queue to resume in the same order on relaunch, so that no decision is lost or skipped.
19. As a developer, I want one place that lists every blocking surface and its priority, so that adding a new modal means adding one row, not editing three conditions.
20. As a developer, I want the blocking condition to be a single exported selector, so that a new waiting system can't drift from the others.
21. As a developer, I want `runIdleSeasons` to drain surfaces through the same queue, so that the test harness and the real app agree on order.
22. As a design lead, I want the season-end order recorded as data (an ordering table), so that I can reorder it without hunting through components.

## Implementation Decisions

- **New pure module (engine layer): the presentation queue.** It is a function from game state to an ordered list of pending surfaces, plus convenience selectors for "head of queue" and "is blocked". No React, no store writes. It's derived, not stored, so there's no new persisted field and no schema change.

  Interface shape (indicative, a contract for downstream work):

  ```ts
  type SurfaceId =
    | 'epilogue' | 'battle' | 'engagement' | 'trialSession'
    | 'seasonRecap' | 'event' | 'cityEvent'
    | 'succession' | 'birthNaming'
    | 'ambition' | 'welcomeBack' | 'agenda';
  function getPresentationQueue(state: GameState, ui: { welcomeBackPending: boolean }): SurfaceId[];
  function getActiveSurface(...): SurfaceId | null;
  function isBlocked(...): boolean; // any surface pending
  ```

- **Ordering table.** A single const ordering (data, not logic) defines priority. The default order is the designed season-end sequence: run-level takeovers (epilogue, battle) first, then `seasonRecap`, then story (`event`, `cityEvent`, `trialSession`, `engagement`), then family (`succession`, `birthNaming`), then planning (`ambition`, `agenda`). `welcomeBack` comes immediately before story surfaces on resume. The exact order within each group is a design-lead review item; the grouping is the decision.
- **SeasonOverlay becomes a queue participant.** It still renders inside tab screens (it isn't moved to a Modal), but its visibility comes from `getActiveSurface() === 'seasonRecap'`. Dismissing it advances the queue.
- **Every blocking component renders on `getActiveSurface() === <its id>`** instead of on its own trigger field. The trigger fields (`activeEvent`, `pendingBirthNaming`, and so on) remain the source of truth for *whether* something is pending; the queue only decides *which one shows*.
- **The tutorial layer, tutorial director and Agenda auto-open** all replace their inline conditions with the shared `isBlocked`. The `philonAdvisoryUnlocked` ambition nuance moves into the queue's ambition-pending rule, so it's defined once.
- **Welcome Back** is currently local component state in `App.tsx`; it's passed into the queue as UI input rather than becoming persisted state.
- **`runIdleSeasons`** is rewritten to loop "while the queue has a head, resolve the head with its default choice", using the same resolution it uses today per surface.
- **Agenda fix:** the prerequisite gate applies to every non-player member whether or not they hold offices. A member with no held offices is eligible only for offices with no prerequisite. This changes what the Agenda recommends on turn one (a player-visible change, so call it out in the PR).
- **Leaked ids:** ambition reward copy looks up the trait's display name from the trait data. Audit other reward and effect description builders for the same `${id}` pattern and fix them in the same pass.

## Testing Decisions

- **Primary seam: the pure queue function.** Test it with constructed `GameState` fixtures. This is the highest seam and the only new one:
  - "Every trigger at once": a state with an active event, a city event, a pending birth, pending ambition scopes, an in-session trial, a pending engagement and the season overlay all set. Assert the exact queue order, and that resolving the head yields the expected next head. This is the "done when" test from the plan.
  - One test per pair the old code got wrong: trial plus event, engagement plus event, ambition held by `philonAdvisoryUnlocked`, and the agenda during battle.
  - A completeness test: every surface id in the ordering table has a corresponding store trigger, so adding a surface without a row fails.
- **Secondary seam: the store (`runIdleSeasons`).** Drive a full season end through the real store and assert that it completes with the queue empty. Prior art: `p5h.test.ts` and `tutorialWorldFreeze.test.ts` drive the store directly with `useGameStore.setState`/`getState`.
- **Agenda fix:** extend `agendaEngine.test.ts` with "non-player member with no offices is never recommended an office that has a prerequisite".
- Good tests assert on which surface is active, not on component internals or render order in the JSX.

## Out of Scope

- Rewriting the content of the season recap, or reducing how many decisions season 1 produces (spec 08, first-hour redesign).
- War start timing on Free Start (decision §6.2, spec 08).
- Converting modals from native `Modal` to a custom stack. The queue decides visibility; the rendering primitive stays the same.

## Further Notes

- The `EngagementInterstitial` "TEMPORARY" note (`App.tsx:480`) refers to chunk C8 replacing its single button. Check whether C8 shipped; if so, delete the note in this branch. It's unrelated to the queue but sits in the same JSX block.
- If the design lead wants fewer decisions in season 1 rather than just sequenced ones, that's spec 08's job; this spec makes ordering possible.
