# Ticket: Surface "Capitulate" as a real player action

**STATUS: RESOLVED.** Implemented per the plan below, alongside Ticket 3 in
the same pass (both needed the same `SenateResponseBanner`) — see "What
actually shipped" at the bottom. Left in place per this repo's convention of
keeping past plan docs rather than deleting them.

**Depends on nothing else in this batch (independent of Tickets 1/2).
Shares a new UI component with Ticket 3 ("Bribe Commission ui") — read the
"Shared component" section below carefully before writing code, since
whichever of these two tickets is implemented second must extend what the
first one built, not duplicate or overwrite it.**

## Report

`src/engine/senateResponseEngine.ts` already has a fully-implemented
`capitulate(state, characterId)` function (~line 315-349): disband every
illegal legion and submit to the Senate's judgment, for a flat 15 lifetime
Dignitas penalty, ending the response immediately regardless of phase. It is
never imported or called anywhere outside that file (and its own test
coverage in `__tests__/militaryEngine.test.ts`) — no gameStore action wraps
it, no UI button triggers it. This ticket wires it up.

```ts
export function capitulate(
  state: SenateAwareState,
  characterId: string,
): SenateAwarePatch {
  const response = state.senateResponse;
  if (!response?.active) return {};

  const updatedFamily = response.sourceArmyId
    ? state.family
    : state.family.map(c =>
        c.id === characterId
          ? { ...c, raisedLegions: [] }
          : c
      );
  const updatedArmies = response.sourceArmyId
    ? state.armies.filter(a => a.id !== response.sourceArmyId)
    : state.armies;

  const updatedTrials = response.phase === 'hostis'
    ? (state.trials ?? []).filter(t =>
        !(t.charge === 'maiestas' && t.defendant.kind === 'family' && t.defendant.characterId === characterId)
      )
    : (state.trials ?? []);

  return {
    senateResponse:   null,
    lifetimeDignitas: Math.max(0, state.lifetimeDignitas - 15),
    family:           updatedFamily,
    armies:           updatedArmies,
    trials:           updatedTrials,
  };
}
```

It handles both the personal-levy path (clears `raisedLegions`, leaves
`veterans` alone) and the Army-sourced path (removes the offending Army
instead), and correctly withdraws the treason trial if one has already been
filed (`hostis` phase). Usable in **any** active phase — unlike Bribe
Commission, it is not gated to `censure`.

Note: this does **not** clear an active `fidesIncomeBlocked` flag (Ticket 2)
by itself — that has to happen in the store wrapper action below, since the
engine function's return type/signature isn't part of this ticket's scope
to change.

## Why no existing UI surface works / shared placement

Same investigation as Ticket 3 — see that ticket's "Why no existing UI
surface works" section for the full reasoning (agenda cards are
navigation-only, office actions require holding an office which contradicts
this scenario). The specific reason Capitulate in particular can't live on
the censura bill's own `ActionCluster` (Curia LEGES tab): that bill resolves
and is removed from `state.bills` after `turnsLeft` seasons (3, per Ticket
1) — long before `hostis`/`consular_army` phases are reached. Capitulate
must stay reachable in those later phases, so it needs a placement that
outlives the bill.

## Shared component: `SenateResponseBanner`

**Check first** whether `src/components/provinciae/MilitaryTab.tsx` already
has a `SenateResponseBanner` function component (Ticket 3 may have been
implemented first — its ticket file has the full component spec, phase-copy
table, and style names). If it exists, add this ticket's button to it
without disturbing what's already there (do not duplicate the phase-copy
table or the gating logic — those are shared). If it doesn't exist yet,
create it from scratch following Ticket 3's "Shared component" section
verbatim (same phase copy, same gating), but wire only the Capitulate button
described below — Ticket 3, whichever runs second, will add the Bribe
button.

The Capitulate button, always visible while `senateResponse.active` is true
(no phase gate, unlike Bribe):

```tsx
<TouchableOpacity
  style={styles.capitulateBtn}
  onPress={() => setShowCapitulateConfirm(true)}
  activeOpacity={0.75}
>
  <Text style={styles.capitulateBtnText}>
    Capitulate — Disband & Submit (−15 Dignitas)
  </Text>
</TouchableOpacity>
```

This is a big, irreversible action — mirror the existing confirm-before-commit
pattern already used in this exact file for individual troop disbanding
(`pendingDisband` state + `ConfirmModal`, ~line 266-329). Add a local
`showCapitulateConfirm` boolean state to `SenateResponseBanner` (or lift it
to `MilitaryTab` if `SenateResponseBanner` needs to stay a simple
presentational component — match whatever Ticket 3 already did if it ran
first) and a `ConfirmModal` (already imported in this file):

```tsx
<ConfirmModal
  visible={showCapitulateConfirm}
  title="Capitulate to the Senate"
  message="Every illegal legion your family raised will be disbanded immediately, and your family loses 15 lifetime Dignitas. This cannot be undone."
  confirmLabel="Capitulate"
  onConfirm={() => { capitulateToSenate(); setShowCapitulateConfirm(false); }}
  onCancel={() => setShowCapitulateConfirm(false)}
/>
```

Check `ConfirmModal`'s actual prop names against `MilitaryTab.tsx`'s
existing usage (~line 316-329) before writing this — copy its exact prop
signature rather than guessing.

Add `capitulateBtn`/`capitulateBtnText` styles near the `bribeBtn`/
`bribeBtnText` styles (from Ticket 3, or create both pairs now if this
ticket runs first) — same visual weight, but use `COLORS.crimson` as the
accent (matching this file's existing convention for destructive/warning
actions, e.g. `disbandBtn`) instead of the gold/laurel tones used for
`suppressionBtn`.

## Store wiring

### `src/state/gameStore.ts`

Add to the imports from `senateResponseEngine.ts` (~line 38-41) — if Ticket
3 already added a `bribeCommission` import here, add `capitulate` to the
same import block rather than creating a second one:

```ts
import {
  calcConsularArmyStrength,
  calcConsularArmyArrivalTurn,
  capitulate,
} from '../engine/senateResponseEngine';
```

Add to the `GameActions` interface (near `raiseLevy`'s declaration, ~line
967, or right next to `bribeSenateCommission` if Ticket 3 already added
that):

```ts
/** Disbands every illegal legion (or the offending Army) and ends an
 *  active Senate Response immediately, in any phase, for −15 lifetime
 *  Dignitas. No-op if no response is active. */
capitulateToSenate: () => void;
```

Add the implementation (near `raiseLevy`'s own implementation, ~line 4811):

```ts
capitulateToSenate: () => {
  const s = get();
  const player = s.family.find(c => c.isPlayer);
  if (!player) return;
  const patch = capitulate(s as any, player.id);
  if (Object.keys(patch).length === 0) return;
  const label = turnLabel(s);
  set({
    ...patch,
    flags: s.flags['fidesIncomeBlocked'] ? { ...s.flags, fidesIncomeBlocked: false } : s.flags,
    log: [...s.log, mkLog(label, `${player.name} disbands every illegal legion and submits to the Senate's judgment. (−15 Dignitas)`, 'neutral')],
  });
},
```

The explicit `flags` clear is needed here (unlike the engine's own
`capitulate` return) because capitulating is meant to fully and immediately
end the situation, including any Fides block already in effect — unlike
Bribe Commission (Ticket 3), where the block deliberately survives (see
that ticket's note on why). This mirrors the same flag-clearing Ticket 2
adds to the season-end auto-clear path, just triggered immediately by the
player's action instead of waiting for season-end.

`characterId` is always the player character here, matching the existing
convention `tickSenateResponse` itself already uses
(`turnSequencer.ts`'s `s.family.find(c => c.isPlayer)?.id`, ~line 1366) —
even though a non-player family member might technically be the one who
raised the levy, the whole Senate Response system already treats the player
as the responsible party throughout. Don't try to thread through the actual
raising character's id; that would be inconsistent with how the rest of the
system already works.

## Testing

Add to the existing `describe` block covering `capitulate`/
`tickSenateResponse` in `__tests__/militaryEngine.test.ts` (~line 565
onward). Note this file already has two `capitulate` tests (~line 607-622)
covering the engine function directly — those don't need to change. Add
coverage for the new gameStore wrapper instead, in whichever test file
already exercises `useGameStore` actions directly via
`useGameStore.getState()` (e.g. follow the pattern in
`__tests__/training.test.ts` or `__tests__/actionEconomy.test.ts` — check
one of those for how they reset/seed store state before calling an action
and asserting on `useGameStore.getState()` afterward):

```ts
test('capitulateToSenate clears an active response and applies the Dignitas penalty', () => {
  // seed store state with an active senateResponse and a family member
  // carrying raisedLegions, call useGameStore.getState().capitulateToSenate(),
  // assert senateResponse is null, raisedLegions is empty, lifetimeDignitas
  // dropped by 15, and (if flags.fidesIncomeBlocked was seeded true) that
  // it's now false.
});

test('capitulateToSenate is a no-op with no active response', () => {
  // seed store state with senateResponse: null, call capitulateToSenate(),
  // assert nothing changed (denarii/dignitas/family untouched, no new log entry).
});
```

Follow whichever existing test file's exact store-seeding/reset convention
most closely matches this (look for a `beforeEach` that resets
`useGameStore` to a known state) — don't invent a new pattern for seeding
store state if one already exists in this test suite.

## Acceptance criteria

- `npx tsc --noEmit` is zero-error.
- `npm test` passes, including the new tests.
- Manually: trigger an unsanctioned levy, open the muster province's
  Military tab, confirm the banner's Capitulate button is visible
  immediately (in `debate` phase, before any bribe/trial), and in every
  later phase too (censure/hostis/consular_army — use the debug panel's
  Auto-Season Runner to advance). Tapping it shows the confirm dialog;
  confirming disbands all raised legions, deducts 15 Dignitas, clears the
  banner, and (if a hostis-phase treason trial had been filed) removes it
  from the Courts.

## What actually shipped

Implemented together with Ticket 3 in one pass (both needed the same new
banner), no deviations from the plan:

- **`src/state/gameStore.ts`** — `capitulate` added to the same
  `senateResponseEngine` import block Ticket 3 uses. `capitulateToSenate:
  () => void` added to `GameActions` next to `bribeSenateCommission`;
  implemented right after it, calling `capitulate(s, player.id)`, no-opping
  via the same `Object.keys(patch).length === 0` guard, and explicitly
  clearing `flags.fidesIncomeBlocked` on top of the engine function's own
  patch — exactly as planned.
- **`src/components/provinciae/MilitaryTab.tsx`** — Capitulate button added
  to the shared `SenateResponseBanner` (created fresh in this pass, so
  there was no pre-existing banner to check for/extend — both tickets'
  buttons went in together). Always visible while `senateResponse.active`,
  wired through a `showCapitulateConfirm` local state + `ConfirmModal`
  (`destructive`, `cancelLabel="Not Yet"`, matching the exact prop shape
  already used by this file's per-unit disband confirm). `capitulateBtn`/
  `capitulateBtnText` styled solid crimson, matching `suppressionBtn`'s
  actual existing weight (see Ticket 3's "what shipped" note — this ticket's
  draft's assumption that `suppressionBtn` was gold/laurel toned was wrong;
  it's crimson, which if anything reinforces reusing that same accent for
  a destructive action like this one).
- **`__tests__/militaryEngine.test.ts`** — added the
  `bribeSenateCommission / capitulateToSenate store actions` describe block
  (shared with Ticket 3) covering: clears response + disbands
  `raisedLegions` + applies the −15 Dignitas penalty + clears an active
  `fidesIncomeBlocked` flag; and the no-op-with-no-active-response case.
  Built via `useGameStore.setState({ ...INITIAL_STATE, ... })` /
  `useGameStore.getState().capitulateToSenate()`, matching
  `training.test.ts`'s existing convention, per the ticket's own guidance.
  The plan's two placeholder test bodies were filled in with real
  assertions rather than left as comments.
- Verified: `npx tsc --noEmit` zero-error; `npm test` — 60/60 suites, 1490
  tests (1488 passed, 2 pre-existing skips) across three consecutive full
  runs. See Ticket 3's "what shipped" note for a transient, unrelated
  `tutorialPrologueActs.test.ts` flake observed once and not reproduced —
  same finding applies here since both tickets landed in the same commit.
