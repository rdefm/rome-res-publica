# Ticket: Surface "Bribe the Commission" as a real player action

**STATUS: RESOLVED.** Implemented per the plan below, alongside Ticket 4 in
the same pass (both needed the same `SenateResponseBanner`) — see "What
actually shipped" at the bottom. Left in place per this repo's convention of
keeping past plan docs rather than deleting them.

**Depends on nothing else in this batch (independent of Tickets 1/2).
Shares a new UI component with Ticket 4 ("Capitulate ui") — read the
"Shared component" section below carefully before writing code, since
whichever of these two tickets is implemented second must extend what the
first one built, not duplicate or overwrite it.**

## Report

`src/engine/senateResponseEngine.ts` already has a fully-implemented
`bribeCommission(state)` function (~line 304-313): spend 50 Denarii during
the `censure` phase to make the Senate's case against you quietly go away.
It is never imported or called anywhere outside that file — no gameStore
action wraps it, no UI button triggers it. It's dead code. This ticket wires
it up.

```ts
export function bribeCommission(state: SenateAwareState): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active || response.phase !== 'censure') return {};
  if (state.denarii < 50) return {};

  return {
    denarii:        state.denarii - 50,
    senateResponse: { ...response, active: false, phase: null },
  };
}
```

Note its own quirk, unrelated to this ticket and not something to fix here:
it sets `senateResponse: { ...response, active: false, phase: null }`
rather than `senateResponse: null`. This leaves a harmless, permanently
inactive object in state (nothing reads an inactive `senateResponse`, so
nothing renders or escalates from it) — just be aware `state.senateResponse`
won't literally become `null` after a successful bribe, only `.active`
becomes `false`. Any UI gating on "is a response in progress" must check
`.active`, not `senateResponse !== null`.

Also note: a successful bribe does **not** clear the `fidesIncomeBlocked`
flag (from Ticket 2) if it's already active. That's intentional — bribing
ends the Senate's *investigation*, but the Fides block (once triggered) is
tied to actually disbanding the illegal troops per the bill's own text, not
to making the case disappear through corruption. This is a documented
interpretation call, not an oversight — if the design lead wants bribing to
also lift an active Fides block, that's a one-line addition, flag it for a
follow-up rather than assuming it here.

## Why no existing UI surface works

Investigated and ruled out before settling on the option below:

- **Agenda cards** (`src/models/agenda.ts`) are navigation-only — `target`
  can only point at a tab, there's no way to hang an inline action button
  off one.
- **Office actions** (`data/offices.ts` + `ActionButton.tsx` in Cursus,
  the mechanism `invoke-consular-authority` uses) are gated on holding a
  specific office. That's backwards here — this whole scenario is
  triggered by *not* holding formal authority, so an office-action-list
  entry doesn't fit.
- **The censura bill's own `ActionCluster`** (Curia LEGES tab) was
  considered and rejected: the bill only lives in `state.bills` for
  `turnsLeft` seasons (3, per Ticket 1) before it resolves and is removed.
  Bribe Commission is gated to the `censure` phase, which lands close to
  when the bill would resolve anyway, so it's borderline-workable there —
  but Capitulate (Ticket 4) must stay reachable through `hostis` and
  `consular_army`, long after the bill is gone. Since both actions need to
  live somewhere consistent, both go in the same place.

## Shared component: `SenateResponseBanner`

**Check first** whether `src/components/provinciae/MilitaryTab.tsx` already
has a `SenateResponseBanner` function component (Ticket 4 may have been
implemented first). If it exists, add this ticket's button to it without
disturbing what's already there. If it doesn't exist, create it fresh per
the spec below — Ticket 4, whichever runs second, will extend it with its
own button.

Model it directly on the existing `revoltBanner` pattern already in this
file (~line 112-178: `province.revoltActive && !campaign` gates a `View`
styled with `styles.revoltBanner`/`revoltBannerTitle`/`revoltBannerDesc`).
Do the same thing for the Senate response, as its own conditional block
inserted right after the Legion Roster section (~line 110) and before the
Revolt Warning block (~line 112):

```tsx
{/* ── Senate Response (unsanctioned levy) ─────────────────────────────── */}
<SenateResponseBanner province={province} />
```

Component (add near the other local section components in this file, e.g.
alongside wherever `LegionRosterSection` is defined):

```tsx
function SenateResponseBanner({ province }: { province: CityState }) {
  const senateResponse = useGameStore(s => s.senateResponse);
  const denarii = useGameStore(s => s.denarii);
  const bribeSenateCommission = useGameStore(s => s.bribeSenateCommission);

  if (!senateResponse?.active) return null;
  if (senateResponse.musterProvinceId !== province.id) return null;

  const PHASE_COPY: Record<string, { title: string; desc: string }> = {
    debate: {
      title: 'The Senate is debating your legions',
      desc: 'A censure motion is before the Curia — check the LEGES tab to vote, speak, or filibuster it.',
    },
    censure: {
      title: 'The Senate has censured your family',
      desc: 'The matter can still be made to quietly disappear — for a price.',
    },
    hostis: {
      title: 'You have been declared hostis',
      desc: 'A treason trial is underway in the Courts. A consular army is being prepared.',
    },
    consular_army: {
      title: 'A consular army marches against you',
      desc: `Arrives turn ${senateResponse.consularArmyArrivesOnTurn}. Your legions will need to hold, or you'll face capture.`,
    },
  };
  const copy = senateResponse.phase ? PHASE_COPY[senateResponse.phase] : null;

  return (
    <View style={styles.senateResponseBanner}>
      <Text style={styles.senateResponseBannerTitle}>⚖ {copy?.title ?? 'The Senate has taken notice'}</Text>
      <Text style={styles.senateResponseBannerDesc}>
        {copy?.desc ?? 'Your unsanctioned levy has been reported to the Curia.'}
      </Text>

      {senateResponse.phase === 'censure' && (
        <TouchableOpacity
          style={[styles.bribeBtn, denarii < 50 && styles.btnDisabled]}
          onPress={bribeSenateCommission}
          disabled={denarii < 50}
          activeOpacity={0.75}
        >
          <Text style={styles.bribeBtnText}>
            Bribe the Commission (−50 Denarii)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

Add styles near the existing `revoltBanner*` styles, matching their visual
weight (border/background/padding — copy the existing `revoltBanner` style
object's values, don't invent a new visual language):

```ts
senateResponseBanner: {
  // copy styles.revoltBanner's values
},
senateResponseBannerTitle: {
  // copy styles.revoltBannerTitle's values
},
senateResponseBannerDesc: {
  // copy styles.revoltBannerDesc's values
},
bribeBtn: {
  // copy styles.suppressionBtn's values (or similar existing action-button style in this file)
},
bribeBtnText: {
  // copy styles.suppressionBtnText's values
},
```

(`styles.btnDisabled` already exists in this file, reused as-is.)

## Store wiring

### `src/state/gameStore.ts`

Add to the imports from `senateResponseEngine.ts` (~line 38-41, alongside
`calcConsularArmyStrength`/`calcConsularArmyArrivalTurn`):

```ts
import {
  calcConsularArmyStrength,
  calcConsularArmyArrivalTurn,
  bribeCommission,
} from '../engine/senateResponseEngine';
```

Add to the `GameActions` interface (near `raiseLevy`'s declaration, ~line
967):

```ts
/** Ends an active Senate Response in 'censure' phase for 50 Denarii, no
 *  further consequence. No-op outside 'censure' phase or if denarii < 50. */
bribeSenateCommission: () => void;
```

Add the implementation (near `raiseLevy`'s own implementation, ~line 4811,
or immediately after it):

```ts
bribeSenateCommission: () => {
  const s = get();
  const patch = bribeCommission(s as any);
  if (Object.keys(patch).length === 0) return;
  const label = turnLabel(s);
  set({
    ...patch,
    log: [...s.log, mkLog(label, 'A discreet payment to the censure commission makes the matter disappear. (−50 Denarii)', 'neutral')],
  });
},
```

## Testing

Add to the existing `describe` block covering `senateResponseEngine` in
`__tests__/militaryEngine.test.ts` (~line 565 onward, reusing its
`makeState` helper) — this is testing the already-existing `bribeCommission`
engine function directly, since it has no test coverage today despite being
fully implemented:

```ts
test('bribeCommission clears the response for 50 Denarii during censure phase', () => {
  const state = makeState({
    senateResponse: { ...armySourcedResponse, phase: 'censure' },
    denarii: 100,
  } as any);
  const patch = bribeCommission(state as any);
  expect((patch.senateResponse as SenateResponseState).active).toBe(false);
  expect(patch.denarii).toBe(50);
});

test('bribeCommission no-ops outside censure phase', () => {
  const state = makeState({ senateResponse: { ...armySourcedResponse, phase: 'hostis' }, denarii: 100 } as any);
  expect(bribeCommission(state as any)).toEqual({});
});

test('bribeCommission no-ops without enough denarii', () => {
  const state = makeState({ senateResponse: { ...armySourcedResponse, phase: 'censure' }, denarii: 10 } as any);
  expect(bribeCommission(state as any)).toEqual({});
});
```

You'll need to import `bribeCommission` into the test file alongside the
existing `capitulate`/`tickSenateResponse` imports, and add `denarii` to
`makeState`'s base object if it isn't already there (check first — grep the
existing `makeState` function in this file).

## Acceptance criteria

- `npx tsc --noEmit` is zero-error.
- `npm test` passes, including the new tests.
- Manually: trigger an unsanctioned levy, reach `censure` phase (via play or
  the debug panel's Auto-Season Runner), open the muster province's
  Military tab, confirm the banner shows with a working "Bribe the
  Commission" button that's disabled below 50 Denarii, and tapping it with
  enough Denarii clears the banner and deducts the cost.

## What actually shipped

Implemented together with Ticket 4 in one pass (both needed the same new
banner), no deviations from the plan:

- **`src/state/gameStore.ts`** — added `bribeCommission` (and Ticket 4's
  `capitulate`) to the existing `senateResponseEngine` import block.
  `bribeSenateCommission: () => void` added to `GameActions` next to
  `raiseLevy`'s declaration; implemented right after `raiseLevy`'s own
  function body, calling `bribeCommission(s)` and no-opping via
  `Object.keys(patch).length === 0`, exactly as planned.
- **`src/components/provinciae/MilitaryTab.tsx`** — added
  `SenateResponseBanner` (shared with Ticket 4) as a new sub-component,
  inserted into the main render right before the Revolt Warning block. Bribe
  button gated to `phase === 'censure'`, disabled below 50 Denarii, styled
  with new `bribeBtn`/`bribeBtnText` (gold-outlined, modeled on the
  existing `donativeBtn` rather than `suppressionBtn` — checked its actual
  styles while implementing and found `suppressionBtn` is solid crimson,
  not gold/laurel as this ticket's draft assumed; `donativeBtn`'s gold
  outline fits "spend money to make a problem go away" better anyway).
  `senateResponseBanner`/`senateResponseBannerTitle`/
  `senateResponseBannerDesc` copy `revoltBanner`'s existing values exactly.
- **`__tests__/militaryEngine.test.ts`** — added the three
  `bribeCommission` engine-function tests verbatim from the plan (import
  extended, no `denarii` needed in `makeState`'s base since each test
  overrides it directly). Also added a `bribeSenateCommission /
  capitulateToSenate store actions` describe block (shared with Ticket 4)
  exercising the real store via `useGameStore.setState({ ...INITIAL_STATE,
  ... })` / `useGameStore.getState().bribeSenateCommission()`, matching
  `training.test.ts`'s existing store-action test convention.
- Verified: `npx tsc --noEmit` zero-error; `npm test` — 60/60 suites, 1490
  tests (1488 passed, 2 pre-existing skips) across three consecutive full
  runs. One transient failure was observed on an earlier full-suite run in
  `__tests__/tutorialPrologueActs.test.ts` ("Act V: declares Quaestor,
  canvasses Flaccus...") — reproduced in isolation and in combination with
  this ticket's own test file with no failure, and the full suite then
  passed clean on two subsequent runs with no changes. That test's
  `canvassFlaccusUntilLocked` helper loops on a `Math.random()`-driven
  canvass roll; this reads as a pre-existing flake in that loop, unrelated
  to this ticket's changes (nothing here touches `Math.random`, tutorial
  state, or election/canvassing code) — flagging it rather than silently
  fixing or ignoring it, per this repo's convention for out-of-scope issues
  found along the way.
