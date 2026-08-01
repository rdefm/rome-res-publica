# 03 — Dynastic ambitions on the Ambitiones leaf

**What to build:** The absorbed Legacy Objectives shown as always-on, read-only rows on the Ambitiones leaf, so the player sees dynastic progress alongside their active family/character ambitions in one place — without touching any of the live counters underneath.

**Blocked by:** 02 — Player can set, track, and resolve a family/character ambition end-to-end.

**Status:** partially done — see note below

> **Note (post-ticket-02):** Building the Ambitiones leaf in ticket 02 required rendering *something* below the two competitive slots for the leaf to match the spec's own description of it, so the first bullet below was built as part of that ticket rather than held back for this one. Verified in `src/components/shared/AgendaTablet.tsx`: `AmbitionesLeaf` calls `projectDynasticAmbitions(state)` and renders one `DynasticRow` per result (title, progress bar via `getProgress`/`getProgressFraction`, current/target/label text), below `AmbitionSlotCard`×2. Confirmed via `git log`/diff on ticket 02's commit (`5413b23`), not just this note. The remaining bullets — most importantly the `LegatumPanel.tsx` selector fix — are **not** done and are still this ticket's job.

- [x] `projectDynasticAmbitions`'s output renders as read-only rows on the Ambitiones leaf, below the two competitive slots, showing each of the six absorbed dynastic tracks' current value and next milestone. — **Done in ticket 02** (`AgendaTablet.tsx`'s `AmbitionesLeaf`/`DynasticRow`, commit `5413b23`), incidental to building the leaf itself; not separately re-verified by this ticket's own pass yet (see below).
- [ ] All existing Legacy Objective increment call sites, the milestone/bonus computation, and the `midas` achievement's read of Legacy Objective state continue to work completely unmodified. Ticket 02 didn't touch `legacyEngine.ts`/`legacyDefinitions.ts`/any increment call site, so this should already hold — but wasn't the subject of this ticket's own explicit check/test pass.
- [ ] The Legacy panel's two unscoped `useGameStore()` calls are replaced with field-level selectors. **Not done** — ticket 02 never opened `LegatumPanel.tsx`.
- [ ] The Legacy panel continues to render its existing detailed milestone view correctly (it remains the deeper view; the leaf is the at-a-glance view). Untouched by ticket 02, so presumed still working, but not re-verified here.
- [ ] The `legacyObjectives` state field and its save-schema entry are untouched — this ticket is projection-only, not a data migration. Holds trivially (ticket 02 didn't touch either), but restate/confirm when this ticket is picked up.
- [ ] `npx tsc --noEmit` is zero-error and `npm test` passes.
</content>
