# 02 — Just-in-time lessons: Provinciae & assets

**What to build:** Two new stand-alone lessons that teach Provinciae (city sheet) and asset-buying the first time a player opens those screens, following the existing lesson pattern (predicate-gated, flag-guarded so they never fire twice, non-chaining into the guided arc). This is what lets Provinciae and asset-buying be cut from the mandatory guided path without losing player-facing coverage of those mechanics.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [x] A lesson fires the first time a player opens a Provinciae city sheet, using the same guard/flag convention as existing lessons (never fires twice).
- [x] A lesson fires the first time a player opens an asset-purchase modal, same convention.
- [x] Both lessons are excluded from the guided arc chain — they do not block or auto-advance any beat, matching the existing lesson precedent.
- [x] Lesson test coverage is extended to include both new lessons.
