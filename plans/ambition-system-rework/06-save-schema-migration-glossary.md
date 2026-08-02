# 06 — Save schema hardening, old-save migration, glossary

**What to build:** Closing the save-validation gap for the new ambition shape, making sure pre-rework saves still load cleanly, and giving the new player-facing terms proper glossary coverage.

**Blocked by:** 02 — Player can set, track, and resolve a family/character ambition end-to-end; 03 — Dynastic ambitions on the Ambitiones leaf; 05 — Narrative hooks (needs the final shape of ambitions and offers settled before writing an accurate schema).

**Status:** ready-for-agent

- [ ] The save schema gains a real, validated `ambitions` entry matching the `ActiveAmbition` shape and a `pendingAmbitionOffers` entry, both defaulted so pre-rework saves still load.
- [ ] Loading a save containing pre-rework-shape ambitions silently drops them (leaving the slot empty), matching this codebase's existing precedent for a prior save-shape migration — no player-facing error or notice.
- [ ] Loading a save from immediately before this rework (no ambitions data at all) still succeeds.
- [ ] The glossary's existing ambition entry is updated, and new entries are added for dynastic ambition, deadline, ambition difficulty, and ambition offer.
- [ ] The new/updated glossary terms are wired to the info-tap affordance in both the builder and the Ambitiones leaf.
- [ ] The codebase's file map is updated to reflect deleted files (old ambition-definitions data, old selection modal) and added/changed files (new builder component, rewritten ambition model, etc.).
- [ ] `npx tsc --noEmit` is zero-error and `npm test` passes, including a save-load round-trip test covering both a fresh-shape save and a save with dropped old-shape ambitions.
</content>
