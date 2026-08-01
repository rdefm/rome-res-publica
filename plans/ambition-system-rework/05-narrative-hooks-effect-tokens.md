# 05 — Narrative hooks: direct-write and offer-then-accept effect tokens

**What to build:** The two event-effect tokens that let story/tutorial content set or offer ambitions, plus the accept/refuse flow and the on-complete/on-fail follow-up hook — so a future event can either hand the player a goal directly or stage it as a real choice on the Ambitiones leaf.

**Blocked by:** 02 — Player can set, track, and resolve a family/character ambition end-to-end; 04 — Graceful slot interruption (direct-write reuses the supersede-on-collision path).

**Status:** ready-for-agent

- [ ] A `setAmbition:<criterionId>:<target>:<deadline>[:refusable]` effect-string token is recognized and direct-writes an `ActiveAmbition` with `source: 'story'`, defaulting to non-abandonable unless the `:refusable` suffix is present, and force-evicting an occupied slot via the existing supersede path.
- [ ] An `offerAmbition:<criterionId>:<target>:<deadlineSeasons>` effect-string token is recognized and stages an `AmbitionOffer` into `pendingAmbitionOffers[scope]`, reserving that slot.
- [ ] `offerAmbition`, `acceptStoryAmbition`, and `refuseStoryAmbition` store actions exist: accepting snapshots the baseline and freezes the reward at accept time (not offer time) and always results in `refusable: true`; refusing discards the offer and frees the slot with no consequence.
- [ ] The Ambitiones leaf's offer-pending slot state is fully wired: it shows the offer's criterion/title with working Accept and Refuse actions.
- [ ] `onCompleteEventId` and `onFailEventId`, when set on an `ActiveAmbition` or `AmbitionOffer`, fire the referenced event when the ambition resolves.
- [ ] Demoable end-to-end with a test event: one using `setAmbition:` that evicts an occupied slot, and one using `offerAmbition:` that can be accepted or refused from the leaf.
- [ ] `npx tsc --noEmit` is zero-error and `npm test` passes.
</content>
