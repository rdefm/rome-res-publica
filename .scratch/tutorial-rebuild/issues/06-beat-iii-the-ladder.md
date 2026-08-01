# 06 — Beat III: The Ladder

**What to build:** The third and final guided beat. A teach sequence covering Cursus (offices, canvassing, elections), followed by a real ambition — "Win the Quaestorship" — with a deadline, in a 3-season sandbox with the full, uncurated event pool. This is the first beat where the player can set their own ambition alongside the tutorial's. Completing (or failing) this beat hands off into the existing embassy/war/courts chain unchanged.

**Blocked by:** 05 (sequential arc — Beat II must complete first, and player-set ambitions must already be unlocked).

**Status:** ready-for-agent

- [ ] A player entering Beat III is taught Cursus's office/canvassing/election mechanics via teach steps.
- [ ] On completing the teach portion, the player receives a real `office_held` ambition (Quaestorship) with a deadline, visible on the Ambitions tablet leaf.
- [ ] The sandbox portion runs with the full open event pool (no curation), per the world-gate plan.
- [ ] The player can additionally set their own ambition during this beat's sandbox, alongside the tutorial's goal.
- [ ] Missing the deadline resolves failed (capped Dignitas ding, one Philon narration beat) and still advances — into the existing embassy arc, unchanged.
- [ ] Save-file schema is updated for the new arc identity; a save made mid-Beat-III loads correctly.

**Implementation note (from ticket 01's review):** per the world-gate plan's per-beat table, Beat III runs `randomEvents: open` but `warIgnition: frozen` — the Carthage war still only ignites after the scripted Embassy arc, even though the rest of the event pool is fully open. `turnSequencer.ts`'s injection block only guards the forced `evt-messana-appeal` branch on `!warIgnitionFrozen` (it doesn't separately re-check `randomEventsFrozen`), so wiring `beat-ladder`'s `WORLD_GATE_POLICY` entry must explicitly keep `warIgnition` frozen — it won't default there just because `randomEvents` is open. Add a regression test (same pattern as `tutorialWorldFreeze.test.ts`'s war-ignition case) confirming Messana/Carthage still cannot ignite during Beat III's sandbox even with the full event pool live.
