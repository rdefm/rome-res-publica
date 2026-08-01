# 07 — Ticket 06 code-review cleanup (optional polish)

**What to build:** Three minor dedup/tightening items flagged by ticket 06's own `/code-review` pass (Standards axis — judgement-call smells, not hard violations). No gameplay or save-shape change; internal cleanup only.

**Blocked by:** 06 — Save schema hardening, old-save migration, glossary (shipped; this ticket cleans up its diff).

**Status:** ready-for-agent

- [ ] `src/components/shared/AgendaTablet.tsx`'s `AmbitionSlotCard` repeats the identical `<InfoTap termId="ambition"><Text style={styles.slotLabel}>{icon} {label}</Text></InfoTap>` wrapper across all three render branches (offer-pending / empty / active). Hoist it once (either above the branch `if`s, since `icon`/`label` are already common props, or into a tiny shared sub-component) instead of repeating it per return path.
- [ ] `__tests__/saveLoad.test.ts`'s `describe('Ambition save schema + migration', ...)` block repeats the same `useGameStore.getState().startGame('standard')` → snapshot → `JSON.parse(JSON.stringify(...))` round-trip boilerplate across three tests. Factor into a small local `roundTrip(state)` helper in that file, matching its existing test style (no change to what's asserted).
- [ ] `src/state/gameStore.ts`'s `isActiveAmbitionShape` only checks that `criterion`/`baseline`/`reward` are present, non-null objects — it doesn't validate their internal fields, so a malformed object carrying those three keys with wrong inner types would still pass. Decide whether a stricter check is worth it for a load-time migration guard (it currently only needs to distinguish "old shape" from "new shape," not fully validate the new shape — `SaveSchema`'s `ActiveAmbitionSchema` already does the strict version at the parse layer), or whether the function should just be renamed to reflect what it actually checks.

**Not an action item, noted for awareness:** `src/state/saveLoad.ts`'s new `AmbitionCriterionSchema`/`AmbitionRewardSchema`/`ActiveAmbitionSchema`/`AmbitionOfferSchema` re-declare the shape already defined in `src/models/ambition.ts` — a second place that must be kept in sync by hand on any future ambition-shape change. This matches the repo's existing convention for evolving save-schema shapes (e.g. `clients.type`'s enum tracking `Client['type']`) and was reviewed as acceptable, not a defect — recorded here only as a standing drift risk to watch if `models/ambition.ts` changes again.
