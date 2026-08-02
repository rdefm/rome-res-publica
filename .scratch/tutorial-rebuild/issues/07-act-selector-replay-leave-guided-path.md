# 07 — Act selector, replay, and "leave the guided path"

**What to build:** The entry-point UI for the guided tutorial. Tapping "start tutorial" (and reopening later from the same entry point) shows all three beats as a list: completed beats are tappable and replay just their teach steps (no goal, no sandbox, no state side-effects); the current beat is tappable to resume; locked beats are visible but greyed with their unlock condition stated. Every screen in the guided path also offers "leave the guided path" (existing skip behavior, newly reachable and newly worded), which the player can always take instead of continuing.

**Blocked by:** 04, 05, 06 (all three beats must exist to be listed/locked/replayed correctly).

**Status:** ready-for-agent

- [ ] The tutorial entry point lists all three beats with correct completed/current/locked state, matching actual save progress.
- [ ] Locked beats show their unlock condition and are not enterable.
- [ ] Tapping a completed beat replays its teach steps only, with zero resource/flag/state side-effects (verified: replaying grants nothing and does not re-chain into another beat).
- [ ] "Leave the guided path" is reachable from the act selector and from any beat's screen, uses copy that makes clear the game continues (not "skip"), and is wired to the existing skip behavior with no new game-state action introduced.
- [ ] A save made mid-replay or immediately after leaving the guided path loads correctly.
