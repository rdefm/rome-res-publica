# 01 — World gate categories

**What to build:** Replace the tutorial's single "is the world frozen" boolean with per-category gating, so different world systems (random events, crisis drift, war ignition, Claudius demands, births, natural mortality, passive bill resolution, foreign war declarations) can be independently open or frozen depending on which guided beat is active. The existing all-frozen behavior must remain available as a thin wrapper so callers migrate one at a time rather than in one risky sweep. Tag an initial set of random events as safe to surface during a curated (partially-thawed) beat.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] A per-category freeze check exists covering all eight previously-frozen systems, with the legacy all-frozen check preserved as a wrapper over it.
- [x] All eight existing freeze call sites are migrated to the category check without behavior change (equivalent to today when every category is frozen).
- [x] Events can be tagged as safe for curated/partial-thaw play; an initial curated set is tagged.
- [x] The existing world-freeze test coverage is extended to cover per-category behavior, including a partially-thawed scenario, and passes.
- [x] No known-flaky suppression regresses — a hostile foreign power still cannot spontaneously declare war while any beat that used to freeze it is active.
