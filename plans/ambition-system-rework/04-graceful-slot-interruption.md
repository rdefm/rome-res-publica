# 04 — Graceful slot interruption: supersede on collision and character death

**What to build:** The two ways an ambition can end early through no fault of the player — a direct-write event claiming an occupied slot, and the death of an assigned character — wired end-to-end through the store and UI so the player visibly gets a partial, proportional payout instead of a silent loss or a failure penalty.

**Blocked by:** 02 — Player can set, track, and resolve a family/character ambition end-to-end.

**Status:** ready-for-agent

- [ ] A direct-write targeting an occupied family or character slot evicts the current occupant via `supersedeAmbition`, setting its status to `'superseded'` and paying out the progress-scaled partial reward, with no `failureDignitas` applied.
- [ ] The evicted ambition's partial payout is surfaced to the player (consistent with how other reward payouts are already communicated in this game).
- [ ] Killing a character with an active `character`-scope ambition — via natural mortality, battle death, or trial execution/exile — supersedes that ambition with the same partial-payout treatment, without requiring changes at any of the three death code paths themselves (the guard added in ticket 01 handles all three uniformly).
- [ ] Test coverage demonstrates both the slot-collision case and the character-death case end-to-end at the store/turn-sequencer level (beyond the unit-level engine coverage already added in ticket 01).
- [ ] `npx tsc --noEmit` is zero-error and `npm test` passes.
</content>
