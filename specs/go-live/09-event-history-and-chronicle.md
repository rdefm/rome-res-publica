# Spec 09 — Event history, cooldowns, skill checks and the Chronicle

**Source:** `plans/go-live-review-and-plan.md` §3.4, §3.7, workstream E · **Priority:** P1 · **Phase:** 2 — Polish (the Chronicle is second in the plan's cut order)
**Triage:** cooldowns and the Chronicle: `ready-for-agent` · skill-check changes are **blocked on decision §6.6**
**Depends on:** spec 05 (seeded RNG, for skill rolls), spec 04 (log cap must keep chronicle entries)

## Verified findings (checked against `917e1ae`)

1. **No event history at all.** `pickRandomEvent` (`eventEngine.ts:150-176`) filters by `isEventEligible`, weights by season and rolls `Math.random`. Neither the state nor `EventDef` records which events have fired or when. A def can fire back to back.
2. **The only repeat-control is manual.** `EventCondition` has a `{ type: 'flag'; key; equals }` variant (`models/event.ts:20`), so some content uses set-a-flag-on-fire to make an event one-shot. That's per-event, hand-authored, and not a general mechanism.
3. **The random pool is about 82 eligible defs** (per `npm run audit:events`: `EVENT_DEFS`, `WAR_EVENT_DEFS`, `CADET_EVENT_DEFS` and `COMPROMISING_EVENT_DEFS` with weight > 0), drawn once per season (`turnSequencer.ts` step 12) over about 92 seasons.
4. **Skill checks are deterministic and paterfamilias-only.** `resolveEventChoice` (`eventEngine.ts:178-189`) compares the player character's effective skill with `skillCheck.difficulty`. There's no roll, and no other family member is considered.
5. **The log exists but isn't shown.** `log: LogEntry[]` (`gameStore.ts:457`). `LogEntry` is `{ id, turn: string, text, type: 'good' | 'bad' | 'neutral' }` (`gameStore.ts:194-199`). `turn` is a display label ("264 BC · Spring"), not a number. The only UI reader is `TrialSessionModal`, which brackets log length around a resolution. There's no history screen.
6. **Layer-rule drift:** `LogEntry` is declared in the store rather than in `src/models/`.

## Problem Statement

A dynasty game's payoff is its story, and this one forgets its story as it tells it. Players will see the same random event again, sometimes in consecutive seasons, which makes a second run read like the first. Event skill checks always give the same result for the same paterfamilias, so once a player has seen an event they know the answer, and the rest of the family's talents never matter. The game records a detailed history of the run, but the player can't read it.

## Solution

- Record when each event fires.
- Give the random draw a general cooldown and repetition penalty, so events don't repeat back to back and a run uses the pool's breadth.
- Classify the history so the most important moments are kept permanently.
- Build a **Chronicle** screen over it: a scrollable, year-grouped history of the gens with filters.
- If the design lead approves §6.6, let skill checks roll and let the player choose which family member answers.

## User Stories

1. As a player, I never want the same random event two seasons in a row, so that the world feels varied.
2. As a player on a long run, I want events I've already seen to come up noticeably less often than ones I haven't, so that I keep discovering content.
3. As a player on a second run, I want the early game to show me different events from my first run more often than not, so that replays feel fresh.
4. As a content writer, I want to set a per-event cooldown (or "once per run") in the event data, so that I can control special events without inventing flags.
5. As a content writer, I want a sensible default cooldown applied to every event that doesn't set one, so that I don't have to annotate 82 events.
6. As a balance designer, I want the cooldown and repetition penalty as `BALANCE` constants, so that I can tune variety.
7. As a balance designer, I want the event audit to report repetition statistics from soak runs (spec 06), so that I can see the effect.
8. As a player, I want to open a Chronicle and read my gens' history year by year, so that I can see the story I've made.
9. As a player, I want the Chronicle to highlight milestones (offices won, births, deaths, trials, battles, laws, endings) above routine entries, so that the important moments stand out.
10. As a player, I want to filter the Chronicle (all / family / politics / war), so that I can find a particular moment.
11. As a player, I want the Chronicle to keep the whole run's milestones even when routine entries are trimmed, so that nothing important is lost on a long run.
12. As a player in the epilogue or the Hall of Ancestors, I want to see a summary drawn from the Chronicle, so that the ending reflects what I actually did.
13. As a player, I want Chronicle entries for each paterfamilias's tenure to be marked, so that I can follow the generations.
14. As a player (if §6.6 approves rolls), I want skill checks to have a visible chance of success that depends on skill, so that I'm deciding under risk rather than reading off an answer.
15. As a player (if §6.6 approves delegation), I want to pick which adult family member answers an event's skill check, so that my family's talents matter.
16. As a player, I want the event card to show the chance of success for each skill-check choice and who is answering, so that I'm never surprised by hidden math.
17. As a player, I want the result of a skill check recorded in the Chronicle, so that triumphs and failures become part of the story.
18. As a developer, I want `LogEntry` moved to the models layer with a numeric turn and a category, so that the Chronicle can group and filter without parsing strings.
19. As a developer, I want the auto-resolver in `runIdleSeasons` to keep working with rolled skill checks (seeded), so that idle runs stay deterministic.

## Implementation Decisions

- **Event history (persisted):** add `eventHistory: Record<string /*defId*/, { lastFiredTurn: number; timesFired: number }>` to `GameState`. Written when an event is injected from the random draw (and optionally for scripted ones). This is a save-shape change: Zod schema plus a migration step defaulting to `{}`.
- **Event data:** `EventDef` gains an optional `cooldownSeasons?: number` and `oncePerRun?: boolean`.
- **Draw rule (in `pickRandomEvent`):**
  - An event inside its cooldown (`turnNumber − lastFiredTurn < (cooldownSeasons ?? BALANCE.events.defaultCooldownSeasons)`) is ineligible.
  - A `oncePerRun` event that has fired is ineligible.
  - Otherwise the weight is multiplied by `BALANCE.events.repeatWeightMult ^ timesFired`.
  - If the cooldown filter empties the pool, fall back to the least-recently-fired eligible event rather than firing nothing. Whether "nothing" is acceptable is a design-lead call; default to the fallback.
- **Log model:** move `LogEntry` to `src/models/` and extend it:

  ```ts
  interface LogEntry {
    id: string; turn: string /* label, kept */; turnNumber: number;
    text: string; type: 'good' | 'bad' | 'neutral';
    category?: 'family' | 'politics' | 'war' | 'economy' | 'event';
    milestone?: boolean; // kept forever by spec 04's log cap
  }
  ```

  `mkLog` callers for milestone moments (office won or lost, births, deaths, succession, trial verdicts, battles, laws passed, war outcome) pass `milestone: true` and a category. A migration step backfills `turnNumber` from the label where it can be parsed.
- **Chronicle screen:** a new screen reachable from Domus (and from the epilogue and the Hall), not a sixth tab. It renders the log grouped by year, with milestone styling, filters and generation markers. It uses theme tokens and selector subscriptions only. Exact placement and visual treatment are a design-lead review item; the default is a "Chronicle" button in the Domus header.
- **Skill checks (§6.6), only if approved:** `resolveEventChoice` takes an `rng` and an optional `answeringCharacterId`. Success probability is a smooth function of `(effectiveSkill − difficulty)` (a `BALANCE` curve). `EventCard` shows the probability and a member picker (adults only). `runIdleSeasons` keeps choosing the first no-skill-check choice, so idle determinism is unaffected. If not approved, this item is dropped and the chance line simply shows pass or fail.
- **Glossary:** add "Chronicle". If rolls ship, update the "skill check" entry.

## Testing Decisions

- **Primary seam: `pickRandomEvent` (pure).** Prior art: `eventEngine.test.ts`. Tests:
  - An event fired last turn is never picked this turn (default cooldown ≥ 1).
  - A `oncePerRun` event never fires twice.
  - The repetition penalty lowers selection frequency over many seeded draws.
  - An empty pool after cooldown falls back to the least-recently-fired event.
- **Seam: the store.** After `endSeason` fires a random event, `eventHistory[defId]` is updated. Over a 40-season idle run (seeded), no def fires in consecutive seasons.
- **Seam: the soak harness (spec 06).** Report distinct-events-seen per run and the maximum repeat count. Report it; don't assert it.
- **Seam: `resolveEventChoice`** (only if §6.6 ships): a seeded probability check, and that the answering character's skill is used instead of the paterfamilias's.
- **Chronicle UI:** one render test (groups by year, filter hides non-matching entries) using whatever UI-test setup spec 02 or 15 introduces. Everything else is verified visually.
- **Save:** the migration from a pre-history fixture yields `eventHistory: {}` and log entries with `turnNumber` populated. Extend `saveLoad.test.ts`.

## Out of Scope

- Writing new events (content work; the event-writing guide covers it).
- Typed effect tokens (spec 14).
- Turning the Chronicle into a share or export feature.

## Further Notes

- Moving `LogEntry` into `src/models/` fixes a small layer-rule drift, done here because this spec reshapes the type anyway.
- Coordinate the save version bump with specs 04 and 05 if they land in the same release.
