# 03 — Dynastic ambitions on the Ambitiones leaf

**What to build:** The absorbed Legacy Objectives shown as always-on, read-only rows on the Ambitiones leaf, so the player sees dynastic progress alongside their active family/character ambitions in one place — without touching any of the live counters underneath.

**Blocked by:** 02 — Player can set, track, and resolve a family/character ambition end-to-end.

**Status:** done

> **Note (post-ticket-02):** Building the Ambitiones leaf in ticket 02 required rendering *something* below the two competitive slots for the leaf to match the spec's own description of it, so the first bullet below was built as part of that ticket rather than held back for this one. Verified in `src/components/shared/AgendaTablet.tsx`: `AmbitionesLeaf` calls `projectDynasticAmbitions(state)` and renders one `DynasticRow` per result (title, progress bar via `getProgress`/`getProgressFraction`, current/target/label text), below `AmbitionSlotCard`×2. Confirmed via `git log`/diff on ticket 02's commit (`5413b23`), not just this note. The remaining bullets — most importantly the `LegatumPanel.tsx` selector fix — are **not** done and are still this ticket's job.

- [x] `projectDynasticAmbitions`'s output renders as read-only rows on the Ambitiones leaf, below the two competitive slots, showing each of the six absorbed dynastic tracks' current value and next milestone. — **Done in ticket 02** (`AgendaTablet.tsx`'s `AmbitionesLeaf`/`DynasticRow`, commit `5413b23`), incidental to building the leaf itself; re-verified by this ticket's own pass.
- [x] All existing Legacy Objective increment call sites, the milestone/bonus computation, and the `midas` achievement's read of Legacy Objective state continue to work completely unmodified. Confirmed via `git log` on `legacyEngine.ts`/`legacyDefinitions.ts` — no commits since before ticket 02. All five `incrementLegacy` call sites (`turnSequencer.ts` ×3, `trialEngine.ts` ×2) and the `midas` achievement read (`achievementEngine.ts:52`) still present and untouched.
- [x] The Legacy panel's two unscoped `useGameStore()` calls are replaced with field-level selectors. Fixed in `LegatumPanel.tsx`: both `LegatumModal` and `LegatumPanel` now use `useGameStore(s => s.legacyObjectives)` instead of destructuring the whole store.
- [x] The Legacy panel continues to render its existing detailed milestone view correctly (it remains the deeper view; the leaf is the at-a-glance view). Only the subscription mechanism changed, not the rendered data or logic.
- [x] The `legacyObjectives` state field and its save-schema entry are untouched — this ticket is projection-only, not a data migration. Confirmed: `saveLoad.ts`'s `legacyObjectives` Zod schema entry unchanged.
- [x] `npx tsc --noEmit` is zero-error and `npm test` passes. Both confirmed (61 test suites, 1524 passed / 2 skipped).
</content>
