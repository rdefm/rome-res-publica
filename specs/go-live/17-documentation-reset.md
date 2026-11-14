# Spec 17 — Documentation reset

**Source:** `plans/go-live-review-and-plan.md` §4.7, workstream I · **Priority:** P2 · **Phase:** 3 — Ship
**Triage:** doc edits: `ready-for-agent` · dead-file deletion is **blocked on decision §6.14**

## Verified findings (checked against `917e1ae`)

1. **`SITEMAP.md` is 958 lines** and reads as a change log; many table cells are hundreds of words of history. CLAUDE.md (83 lines) points every session at it first, so every session pays that reading cost.
2. **CLAUDE.md claims are stale:** "`gameStore.ts` (~2000 lines)" (actually 5,563), and "`data/events.ts` (~1150 lines)" (actually 3,734). Spec 13 changes the store layout again, so do this spec's CLAUDE.md pass **after** spec 13, or update it twice.
3. **README is stale:** `README.md:19` says "Lottie dependency present, no clips shipped yet". Lottie is removed in spec 01. The plan also notes README lists orphaned files that no longer exist.
4. **Stale TODOs:** three `TODO(P3-E)` comments in `src/` point at an epilogue screen that now exists (`screens/EpilogueScreen.tsx`).
5. **Dead code, confirmed by import search:**
   - `components/shared/EndSeasonButton.tsx`: nothing imports it. (It's also one of the unselected store subscribers.)
   - `data/warSites.ts`: nothing imports it.
   - `engine/aiScoring.ts`: imported only by `__tests__/engine.test.ts:10`.
6. `theme.ts:149`'s false font-loading comment is fixed in spec 02, not here.

## Problem Statement

The documents that every contributor (human or agent) is told to read first are partly wrong and mostly history. A new session reads 958 lines of SITEMAP to find a file's purpose, then trusts CLAUDE.md's line counts and gets surprised. Stale TODOs send people looking for missing work that already shipped. Three dead files sit in the code map as if they mattered. Documentation drift is the slow version of the "tsc is just noise" problem CLAUDE.md warns about.

## Solution

- Cut `SITEMAP.md` back to a map: one short line per file, organised feature-first as it is today. Move the history out to the plan docs it came from (or a `docs/history.md`).
- Correct CLAUDE.md and README against the code as it stands after the other specs land.
- Remove stale TODOs.
- After the design lead decides §6.14, delete or deliberately keep the three dead files.
- Add a light check so the size claims can't silently drift again.

## User Stories

1. As a new contributor, I want SITEMAP to tell me in one line what each file does, so that I can find where to edit in minutes.
2. As an agent starting a session, I want CLAUDE.md's facts (file sizes, layers, commands) to be true, so that I don't plan around wrong assumptions.
3. As a contributor, I want the history of how a system came to be kept somewhere findable (plan docs or a history doc), so that cutting SITEMAP doesn't lose institutional memory.
4. As a contributor, I want the README to describe the current stack and setup only, so that onboarding instructions work.
5. As a contributor, I want TODO comments to refer only to work that's actually outstanding, so that TODO search is meaningful.
6. As a contributor, I want unused files either removed or explicitly marked as reserved with a reason, so that I don't maintain dead code.
7. As a design lead, I want to decide whether `aiScoring.ts`, `warSites.ts` or `EndSeasonButton.tsx` is reserved for future work before anything is deleted, so that planned work isn't lost.
8. As a contributor, I want the "Where do I edit?" table in CLAUDE.md to reflect the post-refactor layout (store slices, season phases, effect registry), so that the quick map stays useful.
9. As a contributor, I want the "Large files" list in CLAUDE.md to match reality, so that the edit-surgically warning targets the right files.
10. As a maintainer, I want a check that warns when CLAUDE.md's stated line counts differ from reality by more than a margin, so that drift is noticed.
11. As a maintainer, I want SITEMAP to have a stated style rule (one line per file, no history), so that it doesn't grow back into a change log.
12. As a reviewer, I want the deletion of dead files in its own commit, so that it's easy to revert if a reservation surfaces later.

## Implementation Decisions

- **Timing:** run this spec last in the go-live sequence (after specs 01, 02, 05, 13 and 14 change the layout), or split it: SITEMAP cut and TODOs now, CLAUDE.md and README after spec 13.
- **SITEMAP:** keep the feature-first structure and the engine-to-test mapping table (§10). Each file gets one line of 25 words or fewer. Long cells move verbatim, under a heading per file, to `docs/history.md` (or to the originating plan doc where one is cited), so nothing is deleted outright.
- **CLAUDE.md:** update sizes, the large-files list, the quick map and the `android/` rule (per spec 01's outcome). Keep every rule; this is a fact refresh, not a policy change.
- **README:** remove the Lottie line and the orphaned-file list, and reflect the SDK version from spec 01.
- **TODOs:** remove or rewrite the three `TODO(P3-E)` comments.
- **Dead files (§6.14):** default recommendation is to delete `EndSeasonButton.tsx` and `warSites.ts`. For `aiScoring.ts`, delete it together with its test block in `engine.test.ts`, unless it's reserved for NPC decision-making. Do it in one commit, after sign-off.
- **Drift check:** a small test reads the line counts claimed in CLAUDE.md's "Large files" section and compares them to `wc -l` with a tolerance (for example ±25%), failing with a message to update CLAUDE.md. It lives in the repo-lint test file from spec 14.

## Testing Decisions

- **Seam: the repo-lint file** (shared with specs 05, 13 and 14). It holds the CLAUDE.md size-claim check. It reads files and needs no app code.
- Deleting dead files is verified by `npx tsc --noEmit` and `npm test` staying green (the aiScoring test block is removed in the same commit).
- Doc quality is reviewed by a person. The acceptance check: a fresh agent session can answer "where do I add a new season-end effect?" from CLAUDE.md and SITEMAP alone.

## Out of Scope

- Rewriting `MANUAL.md` (player-facing). That's a content task, though the manual's "Two military systems" section depends on decision §6.4.
- Plan-doc cleanup beyond receiving history moved out of SITEMAP.

## Further Notes

- `EndSeasonButton.tsx` being both dead and an unselected subscriber means spec 13's selector sweep can skip it if this spec deletes it first.
