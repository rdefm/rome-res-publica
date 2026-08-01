# 02 — Player can set, track, and resolve a family/character ambition end-to-end

**What to build:** The core playable loop: a player opens the Agenda Tablet's new second leaf, sets a family or character ambition through a builder with a live difficulty/reward readout, watches its progress across seasons, and either gets paid on completion or takes the capped Dignitas ding on deadline failure — with the slot immediately available again afterward. This is the first genuinely demoable slice.

**Blocked by:** 01 — Ambition foundation: types, balance constants, core engine.

**Status:** ready-for-agent

- [ ] The game store gains an `ambitions: ActiveAmbition[]` field (replacing the old shape) and a `pendingAmbitionOffers` scaffold field (populated for real in ticket 05).
- [ ] `setAmbition` and `abandonAmbition` store actions exist and behave per spec: `setAmbition` builds and installs an ambition into the target slot, superseding any occupant first; `abandonAmbition` only succeeds when the target ambition's `refusable` is true.
- [ ] `requestAmbitionChange` and the old re-offer/`pendingAmbitionScopes` logic are deleted outright.
- [ ] `turnSequencer`'s season-end ambition step is rewired to the new engine's `tickAmbitions`/`getProgress`, applying the frozen reward on completion and the capped `failureDignitas` on deadline failure.
- [ ] The Agenda Tablet has two leaves reachable by a tab switch inside the existing modal: leaf 1 ("Hodierna") is the unchanged existing agenda list; leaf 2 ("Ambitiones") is new.
- [ ] Each competitive slot (family, character) on the Ambitiones leaf correctly renders the empty state (a "Set an ambition" affordance) and the active state (progress bar, seasons-remaining, Abandon control gated on `refusable`). The offer-pending state only needs to not crash if reached early — it's fully wired in ticket 05.
- [ ] A new ambition builder component lets the player choose any of the nine criteria, set a target, and (for non-office criteria) choose a deadline, showing a live difficulty/reward readout that updates as the player edits their inputs.
- [ ] For `office_held`, the builder's deadline field is populated only from `nextEligibleElectionTurns`, never free entry.
- [ ] The old draw-3 ambition selection modal is deleted.
- [ ] The character action flow that used to trigger ambition changes is rewired off the deleted `requestAmbitionChange` path.
- [ ] Demoable: setting a target near the player's current standing produces a visibly small reward in the live readout (the delta rule in action).
- [ ] Demoable: a player can set a family ambition, watch its progress bar and seasons-remaining update turn over turn, and receive the exact frozen reward shown at set time on completion.
- [ ] Demoable: a player can miss a deadline, take the capped Dignitas penalty, and immediately set a new ambition in the same slot with no cooldown.
- [ ] `npx tsc --noEmit` is zero-error and `npm test` passes.
</content>
