# 03 — Dynastic ambitions on the Ambitiones leaf

**What to build:** The absorbed Legacy Objectives shown as always-on, read-only rows on the Ambitiones leaf, so the player sees dynastic progress alongside their active family/character ambitions in one place — without touching any of the live counters underneath.

**Blocked by:** 02 — Player can set, track, and resolve a family/character ambition end-to-end.

**Status:** ready-for-agent

- [ ] `projectDynasticAmbitions`'s output renders as read-only rows on the Ambitiones leaf, below the two competitive slots, showing each of the six absorbed dynastic tracks' current value and next milestone.
- [ ] All existing Legacy Objective increment call sites, the milestone/bonus computation, and the `midas` achievement's read of Legacy Objective state continue to work completely unmodified.
- [ ] The Legacy panel's two unscoped `useGameStore()` calls are replaced with field-level selectors.
- [ ] The Legacy panel continues to render its existing detailed milestone view correctly (it remains the deeper view; the leaf is the at-a-glance view).
- [ ] The `legacyObjectives` state field and its save-schema entry are untouched — this ticket is projection-only, not a data migration.
- [ ] `npx tsc --noEmit` is zero-error and `npm test` passes.
</content>
