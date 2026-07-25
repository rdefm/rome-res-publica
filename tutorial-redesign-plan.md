# Tutorial Redesign — Implementation Plan

**Status:** approved design, ready to implement
**Branch:** `claude/game-tutorial-redesign-6uymzp`
**Replaces:** the `tutorial-264` scripted-event tutorial (`src/data/tutorialEvents.ts` + `TUTORIAL_SCRIPTS`)

This plan replaces the current passive, event-only tutorial with **four guided arcs** built on a
new spotlight-overlay system: a hard-railed five-act prologue, a Messana embassy interlude, a war
arc, and a courtroom arc. It also carries two adjacent gameplay changes the design depends on
(player-targeted `Audit a Rival`, and wiring the dormant `PLAYER_CHOSEN_*` office-action sentinels).

Read §0 before writing any code. Every finding there was verified against the repo at plan time and
several of them contradict what you would reasonably assume from the feature request alone.

---

## §0. Grounded findings (verified — do not re-derive)

These were checked against the working tree. File:line references are to that state; re-grep if the
lines have moved, but the *facts* below hold.

**The existing tutorial**

1. `tutorial-264` is 8 `EventDef`s in `src/data/tutorialEvents.ts`, registered in
   `TUTORIAL_SCRIPTS` (`src/data/startDefinitions.ts:126`), copied wholesale into
   `state.tutorialQueue` by `startGame` (`src/state/gameStore.ts:1498-1547`).
2. `evt-tut-00` is popped into `pendingEvents` immediately by `startGame`; **all other beats fire
   through the single end-of-season story-event slot** in `turnSequencer.ts:1753-1783`, one per
   season, gated only by season index via `eventEngine.checkTutorialGate`.
3. Three beats have special-case handlers in `resolveEvent` (`gameStore.ts:3258-3304`):
   `tut-00` opens the AgendaTablet, `tut-03` adds +15 support to the top live bill, `tut-05` calls
   `declareFamilyCampaign`. **These perform game actions on the player's behalf** — a guided-start
   player can reach season 9 having never opened the Curia or Cursus tab. This is the central flaw
   the redesign exists to fix.
4. Queue exhaustion sets `flags['tutorial-complete']` (`turnSequencer.ts:1776`).
5. `eventEngine.ts:127-128` — `isTutorial` events are excluded from `pickRandomEvent`;
   `getEventDef` (`eventEngine.ts:204-226`) searches the tutorial pool as well as the main pool.

**The war ignition is already chained to tutorial completion**

6. `evt-messana-appeal` ("The Mamertine Envoys", `src/data/warEvents.ts:44`) is the scripted Punic
   War ignition. It is **force-injected** by `turnSequencer.ts:1784-1802` in the `else if` branch
   that runs only when `tutorialQueue` is empty, guarded by "no Carthage war yet" **and**
   `!flags['messanaResolved']`.
7. Its `answer-the-call` choice sets `messanaResolved`, `messanaJoinsRome`, and
   `startWar:carthage:major:8`. Its `refuse` choice sets `messanaResolved` and
   `tableRefuseMamertineBill` — a **low-support Senate bill** (`resourceEngine.ts:345-370`) whose
   *failure* effect starts the war anyway (`failEffect: 'setFlag:messanaJoinsRome:true|startWar:carthage:major:0|fides-5'`).
   So refusing does not reliably prevent the war, and the design leans on this deliberately.
8. Removing `tutorialQueue` therefore **breaks the ignition guard**. Chunk T4 must re-point it.

**Ambassadors, Messana, Campania**

9. `buildAmbassadorPostingBill` (`src/engine/cityEngine.ts:905-935`) explicitly supports
   `status: 'foreign'` cities — the foreign-relations plan's WD-D chunk reversed the older
   "no Ambassador system for foreign provinces" invariant, for Ambassadors only. Posting is
   achieved by **passing a Senate bill**, whose `passEffect` is `assignAmbassador:<cityId>:<charId>`.
10. `CitySheet.tsx:563` and `:713` already render request/seek posting buttons;
    `CitySheet.tsx:122` dedups on a pending bill by name. `gameStore.ts:3724` calls the builder.
11. Messana (`src/data/cityDefinitions.ts:167-193`) is `status: 'foreign'`, `owner: 'independent'`,
    `conquestFlag: 'messanaJoinsRome'`, `startingRelationship: 45`, `threatWeight: 1.4`,
    `clientIds: ['mamertine_captain']`. Its `npcRoleHolder` is a faceless
    `'Mamertine garrison council'`.
12. **Vibius the Mamertine** already exists — `src/data/cityClients.ts:56`, id `mamertine_captain`,
    `supportRequired: 25`, `relationshipRequired: 40`, `+4 Martial`,
    `specialAbility: 'mamertine_mercenary_contract'`. He is the named figure the embassy arc uses.
13. `campania` is a theatre region (`src/data/theatreMap.ts:77`) adjacent to `latium` by land
    (`:196`) and to `sicilia` **by strait** (`:201`). It is the correct staging region and the
    correct Act IV asset-purchase target.

**The Command**

14. `commandMinAge()` returns the **Consul's** `minAge` — **42** (`src/engine/commandEngine.ts:38`).
    Marcus starts at 42 and qualifies. Gaius (18) can never hold the Command. The war arc's
    commander must be the paterfamilias.
15. `isWarActiveForCommand` requires an active `carthage` war (`commandEngine.ts:48`).
16. `COMMAND_CANVASS_MIN_RELATIONSHIP = CANVASS_MIN_RELATIONSHIP` (`commandEngine.ts:104`) — the
    Command election reuses ordinary canvassing machinery. Arc II deliberately re-tests the verb
    Act V teaches.

**Secrets, deterrence, and the Claudius arc**

17. `Audit a Rival` (Quaestor, `src/data/offices.ts:88-136`) currently **self-selects its target**:
    the first leader with `relationship < 30` not already carrying a player-held secret, then a flat
    `BALANCE.secrets.auditRivalChance` (0.60, `src/data/balance.ts:840`) roll. It uses the legacy
    `effect: (state) => …` closure whose signature takes **only state**
    (`src/models/office.ts:81`) — it cannot receive a target without a signature change.
18. `isDeterred(leaderId, allSecrets)` (`src/engine/secretEngine.ts:459`) is true when the player
    holds a `'held'` secret on a leader **and** that leader holds a `'held'` family-subject secret.
    Existence-based, not discovery-gated.
19. `isDeterred` is already consumed in exactly the places the design needs:
    - `turnSequencer.ts:1569` — the Claudius demand requires the secret held **and unfrozen**.
    - `turnSequencer.ts:1553` — an in-flight countdown is **cancelled** when the secret freezes.
    - `agendaEngine.ts:744-757` — surfaces the standoff in the tablet.
    - `secretEngine.ts:654` — NPC secret-action eligibility.
    - `DossierPanel.tsx:223` — *"Stayed by your hand on his own affairs — a standoff, for now."*
    **Act V's audit therefore disarms Claudius with no new engine code.**
20. `ClanLeader.corruptionScore?: number` exists (`src/models/clan.ts:72`), 0–100, optional,
    mirroring `Character.corruptionScore`. It is the second input to the new audit formula.

**Trials**

21. `ChargeId = 'repetundae' | 'peculatus' | 'ambitus' | 'maiestas' | 'military_incompetence'`
    (`src/models/trial.ts:13`). `ChargeSource = 'secret' | 'corruption' | 'accusation'` (`:15`) —
    `'accusation'` is the "this charge is not backed by real wrongdoing" source.
22. `repetundae` (`src/data/trialCharges.ts:25`) — *"plundering a province under color of office —
    the Verres charge, governors' bane."* This is Arc III's charge.
23. `shouldTriggerTrial` (`src/engine/trialEngine.ts:522-578`) generates trials from exactly three
    sources: corruption > threshold, constitution > 80, or a `defeatedGeneral-<id>` flag. **There is
    no path for a malicious false accusation** — Arc III must force the filing directly.
24. Trial construction happens in `turnSequencer.ts:2019-2050` via `buildTrialState`. NPC case
    strength is `min(100, accuserIntrigus * 2 + accused.corruptionScore / 2)`. Against a clean
    Marcus this yields a **weak** prosecution — the tutorial trial is winnable *because the charge
    is a lie*, which is both fair and thematically correct.
25. `shouldTriggerTrial` enforces one active trial system-wide (`:537`) and returns null while a
    Tribune is held (`:530`).

**The dormant `PLAYER_CHOSEN_*` sentinels**

26. `takeOfficeAction` accepts a `targetContext` (`gameStore.ts:1016-1017`) and
    `resolveOfficeAction` threads it (`gameStore.ts:3407`). **No UI anywhere passes it** — grep of
    every `.tsx` returns zero call sites. When it is absent, `applyConsequences` logs a
    `console.warn` and `break`s (`officeActionEngine.ts:249-259, 272-277`) — the consequence
    silently never applies.
27. Five consequences are dead as a result. **Three of them are penalties**, so those actions are
    currently strictly stronger than designed:

    | Office | Action | Dead consequence | Line |
    |---|---|---|---|
    | Vigintivirate | Road Survey | `PLAYER_CHOSEN_PROVINCE` **+2** province relationship | `offices.ts:42` |
    | Praetor | Blacklist Rival from Courts *(Extreme)* | `PLAYER_CHOSEN_LEADER_CLAN` **−20** clan relationship | `:415` |
    | Censor | Award Public Contracts | `PLAYER_CHOSEN_CLAN` **+15** clan relationship | `:623` |
    | Dictator | Purge Conspirators | `PLAYER_CHOSEN_HOSTILE_LEADER_CLAN` **−10** clan relationship | `:758` |
    | Tribune | Summon Rival to Account | `PLAYER_CHOSEN_LEADER_CLAN` **−12** clan relationship | `:876` |

    Chunk T6 wires all five. **This is a real balance change and must be called out in the PR
    description**, per CLAUDE.md's rule about branches that change live gameplay behaviour.

**Infrastructure**

28. There is **no coach-mark / spotlight infrastructure**. No `measure()` calls exist anywhere;
    `onLayout` is used once, in `FrescoBackground.tsx:47`. This is new build.
29. `App.tsx:97-101` registers all five tabs unconditionally in a
    `createBottomTabNavigator`. `TabBar.renderTabIcon(label, focused, badge?)`
    (`src/components/shared/TabBar.tsx:35`) already takes a third `badge` arg — the sealed-tab
    treatment extends this signature.
30. `App.tsx:200-220` uses a **Zustand `subscribe`** (not a deps-array effect) for agenda
    auto-open, with an explicit comment on why: a subscription fires after every store commit and
    always reads current state, whereas a deps-array effect fires once per render batch and can
    miss a window. **The tutorial director must use the same idiom** for the same reason.
31. Dependencies are fixed: RN 0.74.5, Expo 51, `react-native-reanimated` 3.10.1, no masking or
    tooltip library. **Add no new dependencies** — the scrim is built from four plain `View`s.
32. `CURRENT_SAVE_VERSION = 5` (`src/state/saveLoad.ts:20`). `SaveSchema` is a flat `z.object`;
    every field added after v1 uses `.default(...)` so older saves load cleanly, and the parse
    result is **discarded** — `loadGame`'s `{...INITIAL_STATE, ...savedState}` spread does the real
    backfill. Follow that convention exactly.
33. `src/utils/theme.ts` already has the tokens this feature needs: `sealWaxGrey` (`:60`),
    `lockedText` (`:61`, = `dust`), `gildFrame` (`:56`, = `goldBorder`), `scrimTop`/`scrimBottom`
    (`:67`, `:72`). **Reference existing tokens, never restate their literals** (CLAUDE.md).
34. `scripts/electionSim.ts` exists and is runnable via `npm run sim:elections`. Use it to derive
    Act V's guaranteed-win numbers rather than inventing them.

---

## §1. Design overview

One antagonist, one escalating question — *what protects a family in Rome?* — answered four times:
**standing → office → command → law.**

### Arc I — The Prologue: "The First Year"
Hard rail. Tabs sealed. World frozen. Year 1, five acts, one tab each.

| Act | Tab | Teaches | Completion |
|---|---|---|---|
| I | Domus | Family as instrument; Fides as currency; skills | Player trains a skill / commissions the laudatio |
| II | Forum | Leaders vs clans; courting costs; relationship → votes; Claudius's hold revealed | Flaccus relationship raised by a real action |
| III | Curia | Rome's health is your income; bills; crisis tracks | Player votes a live bill; a track moves |
| IV | Provinciae | Denarii loop; the map; **Campania** | Player buys one asset in Campania |
| V | Cursus | Why all of it existed | Marcus declares for **Quaestor**, canvasses, **wins**, then uses `Audit a Rival` on Claudius |

Act V's audit creates a mutual standoff (finding 18–19) and Claudius's blackmail is neutralised
on screen. That is the prologue's payoff, and it is mechanically real, not narrated.

### Interlude — The Embassy
Guided rail. Freeze lifts. The player uses the Curia lesson to pass an ambassador-posting bill
sending Marcus to **Messana while it is still foreign**, then runs ambassador actions and recruits
**Vibius the Mamertine** as a provincial client. One named man, met before Rome has any reason to
care about Sicily.

### The sting
`evt-messana-appeal` fires, re-pointed to the new completion flag. The envoy asking the Senate for a
fleet is Vibius. If the player argues for refusal, the tabled motion is overwhelmed at the vote —
the Senate overrules them, and the lesson is *this is what insufficient influence feels like*.

### Arc II — The War
Guided rail. Command election (canvassing again, higher stakes) → muster in Campania, where the
player owns property → cross the strait → one guided engagement. **Battle outcome is genuinely
open**; nothing downstream depends on it.

### Arc III — The Courts
Guided rail. Claudius, unable to use the secret, files a **false `repetundae` charge**
(`chargeSource: 'accusation'`) over Marcus's conduct as commander. Basilica prep, approach, the
three fronts, trial day, verdict.

---

## §2. Architecture and interface contract

Downstream chunks depend on these names exactly. Do not rename without updating this section.

### 2.1 New files

```
src/models/tutorial.ts              types only, no logic
src/data/tutorialScript.ts          the four arcs as static TutorialStep[] — no logic
src/engine/tutorialEngine.ts        step resolution, predicate + effect registries
src/engine/tutorialTargets.ts       measured-rect registry (module-level, NOT in the store)
src/components/shared/TutorialOverlay.tsx
src/components/shared/TutorialCaption.tsx
src/components/shared/useTutorialTarget.ts
src/components/cursus/OfficeTargetPickerModal.tsx
__tests__/tutorialEngine.test.ts
```

### 2.2 `src/models/tutorial.ts`

```ts
export type TutorialArcId  = 'prologue' | 'embassy' | 'war' | 'courts';
export type TutorialRail   = 'hard' | 'guided';
export type TabName        = 'Domus' | 'Forum' | 'Cursus' | 'Provinciae' | 'Curia';

/** Stable ids for spotlightable UI. Namespaced <area>.<thing>. */
export type TutorialTargetId = string;

export type TutorialAdvance =
  | { kind: 'tap' }                                  // narration only — tap the caption to continue
  | { kind: 'predicate'; predicateId: string }       // resolved via engine/tutorialEngine
  | { kind: 'eventResolved'; defId: string };        // an EventDef finished resolving

export interface TutorialStep {
  id: string;                        // globally unique, e.g. 'prologue.act2.court-flaccus'
  arc: TutorialArcId;
  actLabel?: string;                 // display only, e.g. 'Act II — The Forum'
  rail: TutorialRail;
  requiresTab?: TabName;             // director navigates here on enter if not already there
  target?: TutorialTargetId;         // omit for a full-screen narration beat
  narration: string;                 // Philon's voice; supports no templating in v1
  advance: TutorialAdvance;
  onEnterEffectId?: string;          // resolved via engine/tutorialEngine
  onCompleteEffectId?: string;
  unlocksTab?: TabName;              // the unsealing ceremony fires on completion
}

export interface TutorialArc {
  id: TutorialArcId;
  title: string;
  steps: TutorialStep[];
}

export interface TutorialState {
  activeArc: TutorialArcId | null;
  stepId: string | null;
  completedArcs: TutorialArcId[];
  unlockedTabs: TabName[];
  skipped: boolean;
}
```

### 2.3 Store slice — `src/state/gameStore.ts`

Add to the **`// ── Phase 1 — Agenda tablet + tutorial (P1-A)`** section (`gameStore.ts:581`), keeping
the section comment intact. Remove `tutorialQueue` in the same edit (chunk T4).

```ts
tutorial: TutorialState;   // never null — INITIAL_STATE uses the inert value below
```

`INITIAL_STATE`:
```ts
tutorial: {
  activeArc: null, stepId: null, completedArcs: [],
  unlockedTabs: ['Domus', 'Forum', 'Cursus', 'Provinciae', 'Curia'],  // free start: all open
  skipped: false,
},
```

Actions (add to the same section of the actions block):
```ts
startTutorialArc:    (arc: TutorialArcId) => void;
advanceTutorialStep: () => void;              // resolves the next step via tutorialEngine
skipTutorialArc:     () => void;              // completes the current arc, unlocks its tabs
skipAllTutorials:    () => void;              // sets skipped, unlocks everything
```

`startGame` (`gameStore.ts:1498`) sets `unlockedTabs: ['Domus']` and
`activeArc: 'prologue'` when the chosen start has `tutorialScriptId` set; otherwise the inert value.

### 2.4 Target registry — **not** in the game store

`src/engine/tutorialTargets.ts` holds measured rects in a module-level `Map` with a
`useSyncExternalStore` subscription. **Do not put rects in `gameStore`.** Two reasons, both from
CLAUDE.md: the store is persisted (rects are UI-only garbage in a save file), and a rect updating
on every scroll frame would re-render every component subscribed to the store.

```ts
export interface TargetRect { x: number; y: number; width: number; height: number; }
export function registerTarget(id: TutorialTargetId, rect: TargetRect): void;
export function clearTarget(id: TutorialTargetId): void;
export function getTarget(id: TutorialTargetId): TargetRect | null;
export function subscribeTargets(cb: () => void): () => void;
```

`useTutorialTarget(id)` returns a ref callback; on layout it calls `measureInWindow` and registers
the rect, and clears on unmount. Re-measure on `onLayout` and on scroll-end for targets inside a
`ScrollView`.

### 2.5 Engine — `src/engine/tutorialEngine.ts`

Predicates and effects live here as **id-keyed registries**, not inline in the script. CLAUDE.md
forbids logic in `src/data/`, and this keeps the script file pure content.

```ts
export const TUTORIAL_PREDICATES: Record<string, (s: GameState) => boolean>;
export const TUTORIAL_EFFECTS:    Record<string, (s: GameState) => Partial<GameState>>;

export function getStep(stepId: string): TutorialStep | null;
export function getNextStep(current: TutorialStep, s: GameState): TutorialStep | null;
export function isStepSatisfied(step: TutorialStep, s: GameState): boolean;
export function isTabSealed(tab: TabName, s: GameState): boolean;
```

Add a **dev-only validation pass** exported as `validateTutorialScript()` that asserts every
`predicateId`/`onEnterEffectId`/`onCompleteEffectId` resolves and every `target` id is registered
somewhere in the codebase. Call it from the tutorial director in `__DEV__` only, and assert it in
`__tests__/tutorialEngine.test.ts`. This is the guard against script/component drift, which is the
main long-term maintenance risk of this feature.

### 2.6 Director

A `useEffect`-mounted `useGameStore.subscribe(...)` in `App.tsx`, mirroring the agenda auto-open
idiom at `App.tsx:200-220` (finding 30). On every store commit: if an arc is active and the current
step's `advance` is a satisfied predicate, advance. Bail while `activeEvent`, `seasonOverlayVisible`,
`pendingBirthNaming`, a battle, or a trial session is up.

### 2.7 Save schema — `src/state/saveLoad.ts`

Bump `CURRENT_SAVE_VERSION` to **6**. Add, following the `.default()` convention (finding 32):

```ts
tutorial: z.object({
  activeArc:     z.enum(['prologue', 'embassy', 'war', 'courts']).nullable().default(null),
  stepId:        z.string().nullable().default(null),
  completedArcs: z.array(z.string()).default([]),
  unlockedTabs:  z.array(z.string()).default(['Domus','Forum','Cursus','Provinciae','Curia']),
  skipped:       z.boolean().default(false),
}).default({ /* same inert values */ }),
```

Remove `tutorialQueue` from the schema if present. A v5 save loading into v6 gets the inert value
via `loadGame`'s spread and lands in a normal, fully-unlocked game — correct, since any v5 save is
either post-tutorial or was never on the guided path.

---

## §3. Chunks

Each chunk is independently reviewable and leaves `npx tsc --noEmit` at **zero errors** and
`npm test` green. Do not start a chunk before its dependencies have landed.

---

### T1 — Spotlight overlay primitives *(no script yet)*
**Depends on:** nothing.

- `src/engine/tutorialTargets.ts` per §2.4.
- `src/components/shared/useTutorialTarget.ts` — ref callback + `measureInWindow` + cleanup.
- `src/components/shared/TutorialOverlay.tsx`:
  - Four absolutely-positioned `View`s forming a scrim with a rectangular cut-out around the target
    rect (top / bottom / left / right bands). **No masking library** (finding 31).
  - Scrim colour from `COLORS.scrimBottom` (`theme.ts:72`); do not hardcode.
  - `pointerEvents: 'auto'` on the four bands, so taps outside the cut-out are swallowed. The
    cut-out itself has no view over it, so the real UI underneath receives the tap.
  - `rail: 'guided'` renders the same visuals with `pointerEvents: 'none'` on the bands.
  - A pulsing ring around the cut-out using `COLORS.gildFrame` (`theme.ts:56`), animated with
    `react-native-reanimated` (already a dependency).
  - Renders nothing when no target rect is available — **never block the screen with no cut-out.**
- `src/components/shared/TutorialCaption.tsx` — Philon caption card, docked top or bottom
  (whichever half the target is *not* in), wax styling consistent with `AgendaTablet.tsx`.
  Includes a "Philon, I know this" skip affordance wired in T2.

**Acceptance:** a scratch screen can spotlight a button, taps outside it do nothing, taps on it work.

---

### T2 — Tutorial store slice, model, engine, director
**Depends on:** T1.

- `src/models/tutorial.ts` per §2.2.
- Store slice, actions, `INITIAL_STATE`, and `startGame` wiring per §2.3.
- Save schema per §2.7, **including the version bump**.
- `src/engine/tutorialEngine.ts` per §2.5 with empty-but-typed registries and
  `validateTutorialScript()`.
- Director subscription in `App.tsx` per §2.6.
- Mount `<TutorialOverlay />` in `App.tsx` above the tab navigator. Place it **below**
  `EventModal` in the modal stack — a story event must always win over a spotlight.
- `skipTutorialArc` / `skipAllTutorials`, confirmed once via a dialog.

**Tests:** `__tests__/tutorialEngine.test.ts` — step advance on satisfied predicate, no advance on
unsatisfied, arc completion unlocks the right tab, `validateTutorialScript()` passes.

---

### T3 — Sealed tabs
**Depends on:** T2.

- Extend `renderTabIcon` (`TabBar.tsx:35`) with a `sealed?: boolean` arg. Sealed renders the icon
  tinted `COLORS.lockedText` (`theme.ts:61`) under a wax-seal glyph in `COLORS.sealWaxGrey`
  (`theme.ts:60`).
- In `App.tsx`'s `Tab.Navigator`, add a `tabPress` listener that calls `e.preventDefault()` when
  `isTabSealed(route.name, state)` and surfaces a one-line Philon deflection toast.
  **Keep all five `Tab.Screen`s registered** — do not conditionally unmount screens, or navigation
  state and the `uiNavRequest` deep-link handler (`App.tsx:163-193`) break.
- Unsealing ceremony: on a step with `unlocksTab`, play a brief seal-crack animation on that tab
  icon before the next step's caption appears.

**Acceptance:** on a guided start only Domus is tappable; completing Act I unseals Forum with a
visible ceremony.

---

### T4 — Retire `tutorial-264`, re-point ignition, freeze the world
**Depends on:** T2. **This is the destructive chunk — read finding 8 first.**

- Delete `src/data/tutorialEvents.ts` and the `TUTORIAL_SCRIPTS` registry
  (`startDefinitions.ts:114-137`). Keep `StartDefinition.tutorialScriptId` in
  `src/models/gameStart.ts` — it now selects a tutorial *arc set*, not an event queue.
- Delete `state.tutorialQueue`, its `INITIAL_STATE` entry, its `startGame` wiring
  (`gameStore.ts:1498-1547`), and the three special-case handlers in `resolveEvent`
  (`gameStore.ts:3258-3304`).
- Delete `eventEngine.checkTutorialGate` and the tutorial-pool branch of `getEventDef` **only if**
  nothing else references them — grep first. Keep `EventDef.isTutorial`; T5/T7/T8/T9 author new
  arc-opener events that use it.
- **Re-point the ignition guard** (`turnSequencer.ts:1753-1802`). Replace the
  `tutorialQueue.length > 0` branch structure with:
  ```
  if (tutorial arc 'prologue' is active and not skipped)      → no story event this season
  else if (no carthage war && !flags['messanaResolved']
           && flags['tutorial-embassy-complete'])              → force evt-messana-appeal
  else                                                          → pickRandomEvent(...)
  ```
  The embassy-complete gate is what makes the war ignite *after* the player has met Vibius.
- **World freeze** while `tutorial.activeArc === 'prologue'`. Add a single exported helper
  `isWorldFrozen(s: GameState): boolean` in `tutorialEngine.ts` and gate, in `turnSequencer.ts`:
  random events, crisis escalation, war ignition, the Claudius demand block
  (`turnSequencer.ts:1569`), births, and the mortality check. **One helper, called in six places** —
  do not scatter the condition.

**Tests:** extend `__tests__/eventEngine.test.ts` and `__tests__/turnSequencer`-adjacent tests.
Assert: prologue-active → no random event; embassy-complete + no war → `evt-messana-appeal` fires
exactly once; frozen → no crisis drift.

**Note for the PR description:** the guided start's entire event script is gone. Say so plainly.

---

### T5 — Arc I content and target instrumentation
**Depends on:** T3, T4. **The largest chunk — consider splitting per act if it runs long.**

- Author `src/data/tutorialScript.ts`'s `prologue` arc: five acts, ~6–9 steps each.
- Add `useTutorialTarget(...)` to the spotlighted controls in `DomusScreen`, `ForumScreen`,
  `CuriaScreen`, `ProvinciaeScreen`, `CursusScreen` and their child components. Suggested ids:
  `domus.character-card.marcus`, `domus.action.train`, `forum.clan.valeria`,
  `forum.leader.valerius-flaccus`, `forum.action.invite-dinner`, `curia.bill-list.first`,
  `curia.action.vote-for`, `curia.crisis-track.war`, `provinciae.map.campania`,
  `provinciae.asset.buy`, `cursus.office.quaestor`, `cursus.action.declare`,
  `cursus.action.canvass`, `cursus.office-action.audit-rival`, `shared.end-season`.
- Register predicates in `TUTORIAL_PREDICATES` — e.g. `flaccusRelationshipRaised`,
  `billVotedThisSeason`, `campaniaAssetOwned`, `quaestorCampaignDeclared`, `claudiusDeterred`.

**Act V's guaranteed win — do not invent numbers.** Threshold comes from
`calcOfficeThreshold('quaestor')`; player score from `calcPlayerElectionScore`
(`electionEngine.ts:86, 129`); Quaestor has 8 seats. Use `npm run sim:elections`
(`scripts/electionSim.ts`, finding 34) to determine how many scripted canvasses at the Act II
relationship level clear the threshold with margin, then author exactly that many steps. Record the
derived numbers in a comment in `tutorialScript.ts`. If the sim shows the win cannot be guaranteed
by canvassing alone, raise the Act II relationship gain rather than rigging `resolveElection` —
**the election must resolve honestly.**

**Acceptance:** a full guided run reaches Winter Year 1 with Marcus elected Quaestor, `Audit a Rival`
used on Claudius, `isDeterred(CLAUDIUS_LEADER_ID, s.secrets) === true`, and all five tabs unsealed.

---

### T6 — `Audit a Rival` picker + wire all five sentinels
**Depends on:** T2. Independent of T5 — can be done in parallel.

**This chunk changes live gameplay. It must be described plainly in the PR body (finding 27).**

*Audit a Rival:*
- Player picks **any** clan leader in the Forum (not just hostile). Remove the auto-select and the
  `relationship < 30` filter. Leaders already carrying a player-held secret show disabled, with the
  reason stated.
- Success now scales with **the acting character's Intrigus and the target's `corruptionScore`**
  (finding 20). Add to `BALANCE.secrets` next to `auditRivalChance` (`balance.ts:840`), keeping
  `auditRivalChance` as the base:
  ```ts
  auditRivalChance: 0.60,          // base, unchanged
  auditPerIntrigus: 0.03,          // × acting character's intrigus
  auditPerCorruption: 0.004,       // × target leader's corruptionScore (0–100)
  auditChanceFloor: 0.20,
  auditChanceCap: 0.90,
  ```
  `chance = clamp(auditRivalChance - 0.20 + intrigus*auditPerIntrigus + corruption*auditPerCorruption,
  floor, cap)`. The −0.20 keeps a mid-Intrigus, mid-corruption target near the old 0.60 so this is a
  redistribution, not a blanket buff. **These numbers are first-pass — tune and say so**, same
  convention as the rest of `balance.ts`.
- Show the computed chance in the picker before committing, matching how Gather Intelligence
  displays its odds.
- `Audit a Rival` must migrate off the legacy `effect` closure (finding 17) onto the
  target-context path so it can receive a `leaderId`.

*The five sentinels:*
- Build `src/components/cursus/OfficeTargetPickerModal.tsx` — a generic picker that renders leaders,
  clans, or provinces depending on which sentinel the action declares.
- Wire `OfficeActionsModal` / `CursusScreen` to open it for any action whose consequences include a
  `PLAYER_CHOSEN_*` sentinel, then pass the chosen id as `targetContext` to `takeOfficeAction`.
- After wiring, all five consequences in finding 27's table apply. **Blacklist from Courts, Purge
  Conspirators and Summon Rival to Account all get meaningfully harder.**

**Tests:** extend `__tests__/officeActionEngine.test.ts` — each sentinel resolves with a supplied
context and still warns-and-skips without one; extend `__tests__/officeAction.test.ts` for the new
audit formula at floor, cap, and mid-range.

---

### T7 — The Embassy interlude + Vibius
**Depends on:** T4, T5.

- Author the `embassy` arc: pass the posting bill (`buildAmbassadorPostingBill` supports foreign
  cities — finding 9), then run ambassador actions on Messana, then recruit Vibius
  (`mamertine_captain`, `supportRequired: 25`, `relationshipRequired: 40` — finding 12).
- **Personalise Messana.** Replace the faceless `npcRoleHolder: 'Mamertine garrison council'`
  (`cityDefinitions.ts:185`) with Vibius by name, so the man you court, the man you recruit, and the
  man who comes to Rome are one person. Extend Messana's `flavorDescription` accordingly.
- Rewrite `evt-messana-appeal`'s `bodyText` (`warEvents.ts:48`) so the envoy is **named as Vibius**
  when the player holds him as a client, falling back to the current generic copy otherwise.
  Author both variants; select in the event's body at resolve time.
- Verify which of `CitySheet.tsx`'s two posting buttons (`:563`, `:713`) renders under the foreign
  view. If neither is reachable for `status: 'foreign'`, that is a UI gap to fix in this chunk —
  the engine already supports it.
- Set `flags['tutorial-embassy-complete']` on arc completion (consumed by T4's ignition gate).
- On the `refuse` branch: the tabled motion should be **overwhelmed at the vote**. Tune the bill's
  starting support so it fails decisively, and have Philon name the lesson — *this is what
  insufficient influence feels like.* Do not remove the choice.

---

### T8 — Arc II: the war
**Depends on:** T7.

- Author the `war` arc, `rail: 'guided'` throughout.
- Steps: Command election (Extraordinary Assembly; canvass — the same verb as Act V, finding 16) →
  muster in **Campania** (finding 13) → movement orders → cross the strait to Sicilia → one guided
  engagement.
- Narration ties the command to Act IV: the player owns property in Campania and has standing there.
- **Battle outcome is genuinely open.** Nothing in Arc III depends on winning or losing.
- Targets in `MusterPanel`, `RegionSheet`, `MilitaryTab`, `MapView`. `ProvinciaeScreen` and
  `CitySheet` are 600–1000+ line files — **edit surgically** (CLAUDE.md).
- The commander must be the paterfamilias (finding 14). Assert this in the arc's entry predicate and
  skip the arc gracefully if no eligible character exists.

---

### T9 — Arc III: the courts
**Depends on:** T8.

- On arc entry, **force-file** a trial: `charge: 'repetundae'`, `chargeSource: 'accusation'`,
  prosecutor = Claudius, defendant = Marcus. `shouldTriggerTrial` has no false-accusation path
  (finding 23), so construct the `TrialState` directly via `buildTrialState`, mirroring
  `turnSequencer.ts:2019-2050`'s seeding.
- Respect the existing invariants: one active trial system-wide, and no filing while a Tribune is
  held (finding 25). Defer arc entry rather than violating either.
- Author the `courts` arc: Basilica prep (approach, speaker, the three fronts), trial day beats,
  verdict scene.
- Narration must make the motive explicit — Claudius cannot use the secret, so he invents a charge.
  This is the payoff of Act V's audit and should be named as such.
- The case against a clean Marcus is weak by construction (finding 24). Do not additionally rig it.

---

### T10 — Just-in-time lessons, docs, and closeout
**Depends on:** all.

- Add 2–4 step micro-lessons on the same engine, each flag-gated so it fires once: first trial the
  player did *not* get taught (post-Arc III), first battle outside Arc II, first death of a family
  member, first succession. Fire on Free Start too.
- Glossary coverage (CLAUDE.md): add/update `src/data/glossaryTerms.ts` for any player-facing term
  the tutorial introduces, and wire `InfoTap` where it appears.
- **Update `SITEMAP.md`** — new files, new store fields, deleted `tutorialEvents.ts`, and the
  "where do I edit?" cheatsheet row for tutorial content.
- Update `MANUAL.md` §2 — the Guided Path description is now wrong.
- Full `npm test` and `npx tsc --noEmit` at zero errors.

---

## §4. Risks and open items

1. **Measurement inside animated bottom sheets.** `ProvinciaeScreen`'s sheet and `CitySheet` are
   `Animated` + `PanResponder` driven. `measureInWindow` during an animation returns a stale rect.
   Mitigate by re-measuring on animation-end, and prefer Act IV / Arc II targets that are reachable
   without deep sheet nesting. If a target proves unmeasurable, use a full-screen narration beat
   rather than a mis-placed cut-out.
2. **Script/component drift.** Every `target` id couples the script to a component's internals.
   `validateTutorialScript()` (§2.5) is the guard; keep it passing in CI via the engine test.
3. **Act V's guaranteed win is derived, not asserted.** If `npm run sim:elections` shows the
   scripted path does not clear `calcOfficeThreshold('quaestor')` reliably, raise the Act II
   relationship gain — do not special-case `resolveElection`.
4. **T6's balance change is real.** Three Extreme/high-tier actions get their intended costs for the
   first time. Flag it in the PR body; a follow-up tuning pass may be warranted once it is playable.
5. **Save version 6.** Confirm a v5 fixture loads cleanly before merging — see the migration-fixture
   tests referenced at `saveLoad.ts:22-25`.

## §5. Explicitly out of scope

Secrets/Dossier depth beyond "they exist", munificence, house-building depth, succession and
regency, the Hall of Ancestors, endless mode, peace negotiation. These are covered by T10's
just-in-time lessons or left to the manual.
