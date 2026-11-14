# Spec 08 — First-hour redesign

**Source:** `plans/go-live-review-and-plan.md` §3.1, §3.2, §3.5 (map labels), §4.6 (contrast, crisis tiles), workstream E · **Priority:** P1 · **Phase:** 2 — Polish
**Triage:** **blocked on decisions §6.2** (Free Start war timing), **§6.3** (political path to victory) and **§6.8** (client acquisition) · ready for agent once decided
**Depends on:** spec 03 (presentation queue, so the opening sequence can be ordered at all)

## Verified findings (checked against `917e1ae`)

1. **The ambition picker opens before any context.** `INITIAL_STATE.pendingAmbitionScopes` is `['family', 'character']` (`gameStore.ts:1347`). On a Free Start (`philonAdvisoryUnlocked: true`) the picker renders immediately, before the player has seen a tab.
2. **Chain-only ambitions are offered as openers.** `drawAmbitions` (`ambitionEngine.ts:13-22`) filters only by scope and exclusions. `second_consul` ("Hold the Consulship a second time", `ambitionDefinitions.ts:24`) is meant to be reached via `chainAmbitionId` from the first-Consul ambition, but it's in the same pool and can be offered on turn one. The shuffle is `sort(() => Math.random() - 0.5)`, which gives a biased ordering.
3. **Doubled quotation marks.** Ambition `flavourText` values embed their own quote characters (`'"Once is fortune. Twice is destiny."'`). The leaked-ids half of this finding (`Grants trait: great_orator`) is fixed in spec 03.
4. **The Guided Path card copy is stale.** `data/startDefinitions.ts:24` says "no tutorial screens, only Rome doing what Rome does", but the guided path ships Philon's spotlight-and-caption tutorial.
5. **Clients have a player verb in the store that the UI never calls.** `gameStore.addClient` (`:2767`) is documented as "player-initiated acquisition", respects the house's client-slot cap, and has a `BALANCE` cap comment (`balance.ts:165`). No component calls it, so clients arrive only through event effects (`addClient:` tokens in `events.ts`). The "direct recruiting action" in §6.8 is therefore mostly wiring plus a cost model, not a new system.
6. **The war can start in season 1 of a Free Start.** The Mamertine appeal content lives in `data/warEvents.ts` and `cityDefinitions.ts` (Messana is "the flashpoint"). The plan's test run saw it fire on the first End Season. The manual promises "within your first year or two".
7. **Money:** a new game starts at 200 Denarii and the resource bar shows +0 per season. `balance-checks.md` records the Brutii at −105 Denarii over 12 passive seasons.
8. **Map labels and accessibility items** (overlapping CAPUA/BENEVENTUM, clipped MESSANA, SARDINIA & CORSICA and CISALPINE GAUL at 390 pt, low-contrast vote labels, unlabelled crisis tiles) were seen in a web build only. Per the plan, re-confirm each on device before ticketing.

## Problem Statement

A new player who picks Free Start is asked, before seeing a single screen, to choose an ambition they can't evaluate. One of the offered choices assumes they've already been Consul. Their first End Season can drop them into a war and several unrelated decisions at once. They have no visible way to make money, and the main Domus resource (clients) appears to arrive by luck. If they lean towards politics, nothing tells them how a senator influences the war, which is where every non-failure ending is decided. The guided player gets a better opening, but its own start-menu card says there are no tutorial screens.

## Solution

Redesign the first hour as a sequence where each new decision arrives alone and with context:

- The ambition choice moves after the player has seen their family and the city.
- Only valid opening ambitions are offered.
- The war's start on Free Start follows the design lead's timing decision.
- The player has a visible first step towards income and, if decided, a direct way to recruit clients.
- The political levers on the war are signposted from the first time the war appears.
- Copy, map labels, contrast and the crisis tiles are fixed so the first screens look and read as finished.

## User Stories

1. As a new Free Start player, I want to see my family and at least one tab before choosing an ambition, so that the choice means something to me.
2. As a new player, I want to be offered only ambitions that make sense for a family in my position, so that I'm not asked to "hold the Consulship a second time" on turn one.
3. As a new player, I want each ambition to show what it rewards in plain words and roughly how long it takes, so that I can choose between them.
4. As a new player, I want ambition flavor text with one set of quotation marks, so that it reads as edited copy.
5. As a Free Start player, I want the war to begin after the grace period the design lead decides (or at season 1, if that's the decision, but then alone and with context), so that my first season isn't swallowed by a crisis I don't understand.
6. As a new player, I want my first End Season to give me one headline decision, not three, so that I learn the loop.
7. As a new player, I want the resource bar to show where income will come from, and a suggested first income action, so that money isn't a mystery.
8. As a new player, I want the Agenda's first items to include one concrete income step, so that I'm not drifting into debt passively.
9. As a player, I want a direct way to seek clients (if the design lead approves), with a clear cost and the slot cap visible, so that building a clientela is a strategy rather than luck.
10. As a player who prefers politics to generalship, I want the first war event to point to the levers I have (funding bills, the command vote, treaty ratification), so that I know how a senator wins a war.
11. As a player, I want the Curia and the war screens to label those levers as "affects the war", so that the connection is visible later in the run too.
12. As a player, I want the Guided Path card to describe what it actually is (a guided introduction with Philon), so that I pick the start I want.
13. As a player on a 390 pt phone, I want every map label readable and unclipped, so that I can find Messana when the war starts there.
14. As a player, I want vote labels on bill cards to be readable in bright light, so that I can tell how a bill is going.
15. As a player, I want the crisis tiles labelled (name and tier), not just an icon and a number, so that I know which crisis is rising.
16. As a player, I want the terms I meet in the first ten minutes to have glossary entries and InfoTaps, and later terms deferred, so that the vocabulary arrives at a manageable pace.
17. As a guided player, I want the hand-off from Philon to land me in the same calm sequence as a Free Start player, so that the moment the guide lets go isn't a cliff.
18. As a design lead, I want the "first ten minutes" term list written down, so that future content respects it.
19. As a first-time-player tester, I want to reach the end of year one without asking what to do next, so that the plan's done-when is met.
20. As the player, I want the Claudius demand (the first real stake) to land as designed and not be buried in a pile-up, so that the hook works.

## Implementation Decisions

- **Ambition timing:** initial `pendingAmbitionScopes` on a Free Start becomes empty. A new opening step re-offers ambitions after a defined trigger (the first End Season recap, or the player's first visit to Domus; the design lead picks). It goes through the presentation queue's `ambition` surface from spec 03. Guided starts keep their existing `philonAdvisoryUnlocked` hold-back.
- **Ambition eligibility:** an `AmbitionDefinition` gains an eligibility notion. At minimum, any definition that is the target of another's `chainAmbitionId` is excluded from `drawAmbitions`, and an optional `requires` condition reuses `AmbitionCondition` (for example "has held office X"). Replace the sort-random shuffle with a seeded Fisher–Yates using spec 05's RNG.
- **Flavor quotes:** strip the embedded quotes from ambition `flavourText` data and let the component add typographic quotes. Audit other data files for the same double-quoting.
- **War timing (§6.2):** implement whatever grace the design lead decides as a `BALANCE.war` constant (minimum turn for the Mamertine appeal on Free Start), checked in the war-event eligibility condition. If the decision is "keep season 1", this item reduces to sequencing via spec 03.
- **Income signpost:** the resource bar's income readout shows a projected per-season number with a breakdown on tap (the data already exists in `calcResourceIncome`). The Agenda gains an early-game rule recommending one income action when projected income ≤ 0. Which action to recommend is a design-lead call.
- **Client verb (§6.8):** if approved, wire `addClient` to a Domus action with a cost (Fides and/or Denarii, `BALANCE` constants) and the existing slot cap. If rejected, delete the orphaned action and its balance comment, and update the glossary entry to say clients come from events and patronage.
- **Political levers (§6.3):** if approved, tag the relevant bills and votes with an `affectsWar` marker in data, and show a shared badge component where they appear. The first war event's copy points at them. The exact levers are the design lead's call.
- **Copy:** rewrite the Guided Path card description.
- **Map labels:** move label placement into per-region data offsets (data, not logic) and choose short labels where needed. Re-check at 360 and 390 pt.
- **Contrast and tiles:** use theme tokens that meet WCAG AA for the vote labels, and add text labels to the crisis tiles. These overlap with spec 15. Whichever lands first does it, and the other references it.
- **Glossary:** produce the first-ten-minutes term list as a comment block in the glossary data, and ensure each listed term has an entry and an InfoTap at its first appearance.

## Testing Decisions

- **Seam: `drawAmbitions` (pure).** Chain-target ambitions are never drawn. The `requires` gate is respected. With a seeded RNG, the draw is deterministic. Prior art: the ambition coverage in `engine.test.ts`.
- **Seam: the store, through a fresh Free Start.** After `startGame` (Free Start), `pendingAmbitionScopes` is empty. After the chosen trigger it's re-offered. Prior art: `p5h.test.ts` Target #3 drives fresh starts.
- **Seam: the soak harness (spec 06).** The war doesn't start before the decided minimum turn across a seeded sample of Free Starts. Target #3 (first "oh no" ≤ 8 seasons) still holds for guided starts.
- **Seam: `agendaEngine`.** With projected income ≤ 0 in the early stage, an income recommendation appears.
- Map labels, contrast and copy are verified visually on device. Screenshots are attached to the PR.
- The plan's done-when ("five first-time players reach the end of year one without asking what to do next") is a human playtest. Record it in `balance-checks.md` next to targets #1 and #2.

## Out of Scope

- Event repetition and the chronicle (spec 09).
- The battle screen (spec 10, already specified in `plans/battle-revamp.md`).
- Historical naming conventions (decision §6.7). If decided, that's its own content spec.
- A full accessibility pass (spec 15).

## Further Notes

- Phase 2 cut order from the plan (battle revamp, then chronicle, then portraits) doesn't include this spec. Treat it as the last thing cut.
- The `addClient` orphan is an unrelated-but-real finding (dead player verb). It's resolved here either way, pending §6.8.
