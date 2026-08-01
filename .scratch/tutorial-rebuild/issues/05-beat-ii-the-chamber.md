# 05 — Beat II: The Chamber

**What to build:** The second guided beat. A teach sequence covering Curia (bills, votes, crisis tracks), followed by a real ambition — "pass a bill you voted for" — with a real deadline, in a 2-3 season sandbox drawing only from the curated (tutorial-safe) event pool. This beat can fail: on a missed deadline the ambition resolves failed (taking the normal capped Dignitas ding), Philon acknowledges it once, and the beat still advances — it never blocks or retries. On completion of this beat (met or failed), the player unlocks the ability to set their own ambitions, moved up from the very end of the guided chain.

**Blocked by:** 01 (curated event pool), 03 (bill_passed criterion), 04 (sequential arc — Beat I must complete first).

**Status:** ready-for-agent

- [ ] A player entering Beat II is taught Curia's bill/vote/crisis-track mechanics via teach steps.
- [ ] On completing the teach portion, the player receives a real `bill_passed` ambition with a deadline, visible on the Ambitions tablet leaf.
- [ ] The sandbox portion draws random events only from the tutorial-safe curated pool; crisis drift and passive bill resolution are open per the world-gate plan.
- [ ] Missing the deadline resolves the ambition as failed (capped Dignitas ding applied), triggers one Philon narration beat, and the tutorial still advances to Beat III — it does not block or retry.
- [ ] Player-set ambitions (the "set your own ambition" flow) become available at the end of this beat, regardless of whether the tutorial goal succeeded or failed.
- [ ] Save-file schema is updated for the new arc identity; a save made mid-Beat-II loads correctly.

**Implementation note (from ticket 01's review):** `turnSequencer.ts`'s combined event-injection block only checks `!warIgnitionFrozen` before force-injecting `evt-messana-appeal` — it does not separately check `randomEventsFrozen`. So when wiring `beat-chamber`'s entry into `WORLD_GATE_POLICY`, `warIgnition` must be explicitly frozen (not left to default-open) alongside `randomEvents`' curated-pool restriction, or the Messana ignition event could fire during Beat II despite the curated pool, jumping the gun on the scripted embassy sequencing. This combination (`warIgnition` open + `randomEvents` not fully open) has never been exercised by a real arc before this ticket — add a `tutorialWorldFreeze.test.ts`-style regression test asserting `evt-messana-appeal` cannot fire during Beat II's sandbox.
