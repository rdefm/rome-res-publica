# 03 — bill_passed ambition criterion

**What to build:** A ninth ambition criterion, `bill_passed`, so "pass a bill you voted for" is a real settable/completable ambition — the same class as the other eight criteria, not a tutorial-only special case. Resolved in favor of the plan's preferred option: a real criterion, since it's a goal players will want to set for themselves outside the tutorial too. This unblocks Beat II's tutorial goal from being a genuine player-facing ambition rather than a display-only fake.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `bill_passed` is added as a real ambition criterion, evaluated the same way as the other eight (resolves on completion, participates in Dignitas/failure handling identically).
- [ ] A player can set `bill_passed` as their own ambition outside of the tutorial, not just receive it as a tutorial goal.
- [ ] Existing ambition system test coverage is extended to cover the new criterion's resolution, both met and failed paths.
