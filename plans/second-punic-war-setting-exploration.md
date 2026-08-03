# Second Punic War Setting Pivot — Exploration Doc

## 0. How to use this document

This is **not a build plan.** It's a scoping/options doc for a setting change the user raised
alongside the military/provinces PRD (`military-provinces-legibility-siege-annexation-prd.md`), kept
separate deliberately — it's a full setting replacement question, an order of magnitude bigger than
that PRD, and the shipped campaign-map plan's own out-of-scope list already names it as a known,
unbuilt future idea. Nothing here should be implemented without a further, explicit scoping pass once
a direction is chosen.

---

## 1. The pitch, as raised

> "What if we changed the game to be around the 2nd Punic war? Ups the stakes, is more recognisable
> to people (Hannibal), allows some more options for events and narrative (eg tutorial: you could
> lose your paterfamilias, and most forum contacts, due to Cannae. Then have the rebuild, including
> new families rising, adopting promising upcomers outside patrician class, etc)"

The appeal is real: the Second Punic War (218–201 BC) is the most narratively famous of the three,
built around a single, recognizable antagonist (Hannibal), a run of catastrophic early Roman defeats
(Trebia, Trasimene, and above all Cannae — the worst single-day Roman military disaster in the game's
whole historical window) followed by a genuine, dramatic recovery. It's a stronger "story spine" than
the First Punic War, which is a longer, more attritional naval/Sicilian conflict with less of a single
household name attached to it.

## 2. Grounded findings — what's currently built on the First Punic War

Confirmed against the repo (both `main` and `tutorial-rebuild` — this content is untouched by that
branch):

- Game start is **hardcoded to 264 BC**: `year: -264` (`gameStore.ts`), `startYear: 264`
  (`data/balance.ts`), the very first log line is "264 BC · Spring."
- The casus belli is the **Mamertine/Messana affair** — the historical trigger of the First Punic
  War specifically (`evt-messana-appeal`, `warEvents.ts`), already deeply wired into the tutorial's
  `embassy` arc (Vibius the Mamertine as a named recruitable client).
- The theatre map's 8 regions (Cisalpine Gaul, Etruria, Latium, Samnium, Campania, Sicily, Sardinia &
  Corsica, Africa) and the 4 named enemy generals (Hanno, Hamilcar, Bomilcar, Xanthippus) are First
  Punic War figures and theatres — Sicily/Lilybaeum, not the Italian peninsula Hannibal actually
  fought across.
- The tutorial's `war` arc scripts a siege at **Lilybaeum** specifically (250–241 BC, First Punic
  War) — anachronistic to a Second Punic War framing.
- `README.md`/`MANUAL.md` both describe the setting in First-Punic-War-specific terms already.
- There is currently **no Hannibal, no Second Punic War content, and no time-skip mechanism**
  anywhere in `src/data/`.
- The **paterfamilias mechanic** the pitch wants to hook a Cannae-style event into is real and
  central (`inheritanceEngine.ts`'s `applySuccession`, Regency-on-minor-heir) — a natural fit for a
  scripted catastrophic-death beat, mechanically speaking.
- The **Forum clan-leader relationship system** (`models/clan.ts`) is the closest existing analog to
  "Forum contacts," but there's no existing primitive for a bulk, event-driven relationship wipe —
  leaders currently age/die individually with heir succession, not as a scripted mass event. A
  Cannae-style "you lose most of your standing at once" beat would need new logic, not just reuse of
  what exists.
- The historical First Punic War **does** have its own real disasters that would fit the existing
  264–241 BC timeline without any anachronism — most notably the storm/naval losses (Rome lost entire
  fleets to weather multiple times) and the Drepana naval defeat (249 BC). These aren't currently
  built as scripted beats either, and are worth naming as a lower-cost alternative to a full era
  change (see Option C below).

## 3. Why this is genuinely a different order of magnitude

Every one of these would need rework, not extension, for a Second Punic War framing:

- The entire 8-region theatre map (Sicily-centric) doesn't match the Second Punic War's actual
  geography (Italy itself as the primary battlefield, plus Iberia as a major theatre the current map
  has no concept of).
- All 4 named enemy generals, and the war-standing/momentum content tuned around them.
- The casus belli, the embassy arc, Vibius, and the entire tutorial `embassy`→`war` chain.
- All existing war-arc events, war-ending terminal outcomes, and their epilogue/laurel wiring — tuned
  and tested against *this* war's shape and pacing (see the campaign-map plan's tuning log).
- The hardcoded start year and every piece of flavor text that assumes it.

This is not a chunk inside the military PRD. It would be its own multi-month-scale plan on the order
of the original campaign-map plan (C1–C10), possibly larger, since it also touches setting/lore
content the campaign-map plan didn't (event writing, tutorial narrative, family/clan flavor).

## 4. Framing options

**Option A — Full replacement.** Rip out the First Punic War setting and rebuild the game around
218–201 BC: new map (Italy-centric, plus Iberia), Hannibal and the other historical Carthaginian/Roman
generals, Cannae as a scripted catastrophic beat, new tutorial arcs. Everything built on the First
Punic War (a fully shipped, tuned campaign-map system) gets thrown away or radically reworked.
Highest narrative payoff, highest cost, and it deletes real, working, tuned content.

**Option B — "Book Two": a second era, played in sequence.** Keep the First Punic War exactly as it
is (Act One of the game), and add a genuine time-skip mechanism that, on reaching 241 BC (the
existing terminal-outcome boundary), can advance the game ~23 years into a new Second Punic War era
with a new map/cast, inheriting family standing/dynasty state from Act One rather than discarding it.
Preserves all existing content and tuning; the new era becomes new content on top, not a replacement.
Highest engineering cost of the three (needs a genuine era-transition mechanism nothing in the
codebase has today), but is the only option that keeps both wars' content live simultaneously and
turns "your family's dynasty spans the whole Punic Wars" into a real, differentiating feature.

**Option C — Borrow the narrative beats, keep the setting.** Don't change the era at all. Instead,
script a First-Punic-War-appropriate catastrophic disaster (a Drepana-style naval defeat, or a
composite "lost fleet + lost paterfamilias" beat) into the *existing* 264–241 BC timeline, giving the
tutorial/early game the "family disaster → rebuild" narrative arc the pitch wants, without touching
the map, generals, casus belli, or any tuned war content. Lowest cost by far; doesn't get Hannibal or
the Second Punic War's specific recognizability, but delivers the actual gameplay/narrative beat (loss
→ rebuild → new families rising) the pitch's second half describes.

## 5. Recommendation

Start with **Option C** as a near-term, low-risk way to get the narrative payoff (disaster → rebuild)
without touching anything currently shipped or tuned. Treat **Option B** as the real long-term answer
if "Second Punic War" as a recognizable, marketable setting matters enough to justify a plan on the
scale of the original campaign-map work — it's the only option that doesn't throw away the existing
system. Recommend against **Option A** specifically because it discards a large amount of tuned,
tested, working content for a narrative upgrade that Option B can deliver without the destruction.

## 6. Open questions before this becomes a real PRD

1. Is the goal "make the existing game's story more dramatic" (→ Option C likely sufficient) or "ship
   a recognizably Hannibal/Second-Punic-War game" (→ Option B, or A if B is rejected)?
2. If Option B: what does "inheriting dynasty state" actually carry forward — clan relationships,
   built assets, family members, all of it? This is a major design question in its own right.
3. If Option B or A: does the new era need its own full campaign-map treatment (new regions, new
   generals, new tuning pass) at the same fidelity as C1–C10, or a lighter version?
4. Would a Second Punic War era, if built, become the *only* way to reach it (must complete/survive
   the First Punic War first), or a selectable alternate start?
5. How much new authored content (events, generals, tutorial beats, glossary) is the team actually
   willing to commit to, independent of engineering cost?

This doc stops here — no chunk breakdown, no `BALANCE` numbers, no file-level touches — until those
questions have answers.
