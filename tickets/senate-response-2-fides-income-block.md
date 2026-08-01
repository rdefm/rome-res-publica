# Ticket: Implement the Fides-income-blocked effect for real (+ disband parity fix)

**Depends on Ticket 1 (fix censura bill shape) being done first** — this
ticket's flag is only ever set via that bill's `passEffect`, which only
reaches the real resolution pipeline once Ticket 1 lands. If Ticket 1 isn't
done yet, do that first.

## Report

The censure bill's own description says: "If passed, Fides income is
suspended until all illegal troops are disbanded." Right now nothing
implements either half of that sentence — the block never happens, and
there's no code path that would end it even if it did.

Related, found in the same investigation: for a personal levy (not an
Army-sourced muster), manually disbanding all illegal troops via the
Military tab's existing per-unit Disband button does **not** stop the
`senateResponse` phase machine from continuing to escalate toward the
treason trial / consular army. Only the Army-sourced path has a safety net
for this (`senateResponseEngine.ts`'s hostis/consular_army branch quietly
drops the case if the offending Army no longer exists — see
`tickSenateResponse`, ~line 226-234). The personal-levy path has no
equivalent, so a player who fully disbands in good faith still gets
prosecuted. This ticket fixes both issues with one season-end check, since
they're the same underlying gap: "the player has already complied, but
nothing recognizes it."

## Design decisions (settled with the user before implementing)

- **Block behavior:** full block, ongoing — Fides income is 0 every season
  while the flag is set (not a percentage reduction, not a one-time
  deduction).
- **What clears it:** auto-clears at season-end once the triggering
  character's `raisedLegions` are empty — no player action required beyond
  disbanding.
- **Parity fix:** yes — when a personal-levy `senateResponse` sees the
  player's `raisedLegions` reach zero, clear the *entire* `senateResponse`
  (not just the Fides flag), mirroring the Army-sourced path's "nothing left
  to prosecute" behavior. This is a bigger scope than "just the Fides flag,"
  but it's the same check either way and leaving the phase machine armed
  after full compliance would be inconsistent with the Army-sourced
  precedent right next to it.
- **Which troops count:** `raisedLegions` only, not `veterans`. This matches
  `capitulate()`'s own existing definition of compliance (it only clears
  `raisedLegions`, deliberately leaving `veterans` alone — see
  `senateResponseEngine.ts`'s `capitulate`, ~line 325-331) on the theory that
  veterans may predate this incident and aren't part of what's being
  prosecuted. Don't diverge from that precedent by checking `veterans` too.

## What to change

### 1. `src/engine/resourceEngine.ts` — apply the block

In `calcResourceIncome` (~line 135-264), the final return currently is:

```ts
return {
  fidesIncome: Math.max(0, Math.round(fidesIncome * incomeMult)),
  denariiIncome: Math.round(denariiIncome * incomeMult),
  plebsDelta,
};
```

Change to:

```ts
return {
  fidesIncome: state.flags?.['fidesIncomeBlocked']
    ? 0
    : Math.max(0, Math.round(fidesIncome * incomeMult)),
  denariiIncome: Math.round(denariiIncome * incomeMult),
  plebsDelta,
};
```

Only Fides is blocked — Denarii and Plebs are untouched, matching the bill's
own text ("Fides income is suspended").

### 2. `src/engine/turnSequencer.ts` — auto-clear on compliance

Find step "9f. Senate response tick" (~line 1364-1369):

```ts
// 9f. Senate response tick
if ((s as any).senateResponse?.active) {
  const playerCharacterId = s.family.find(c => c.isPlayer)?.id ?? 'pc-1';
  const patch = tickSenateResponse(s as any, playerCharacterId);
  s = { ...s, ...patch };
}
```

Replace with:

```ts
// 9f. Senate response tick
if ((s as any).senateResponse?.active) {
  const response = (s as any).senateResponse as SenateResponseState;
  const player = s.family.find(c => c.isPlayer);

  // Personal-levy path only — the Army-sourced path already self-clears in
  // tickSenateResponse when its Army no longer exists (senateResponseEngine.ts's
  // hostis/consular_army branch). This is the same "nothing left to
  // prosecute" idea for the older raisedLegions-based levy: if the player
  // has disbanded every illegal legion (whether via the dedicated Capitulate
  // action or just the Military tab's per-unit Disband), there's nothing
  // left to escalate against. Checked before tickSenateResponse runs so a
  // same-season "reached zero" doesn't still advance one more phase.
  const compliedByDisbanding = !response.sourceArmyId && (player?.raisedLegions.length ?? 0) === 0;

  if (compliedByDisbanding) {
    s = {
      ...s,
      senateResponse: null,
      flags: s.flags['fidesIncomeBlocked'] ? { ...s.flags, fidesIncomeBlocked: false } : s.flags,
    };
  } else {
    const playerCharacterId = player?.id ?? 'pc-1';
    const patch = tickSenateResponse(s as any, playerCharacterId);
    s = { ...s, ...patch };
  }
}
```

You'll need `import type { SenateResponseState } from './senateResponseEngine';`
at the top of `turnSequencer.ts` if it isn't already imported (check first —
grep the existing imports near the top of the file).

## Testing

### `__tests__/engine.test.ts` — Fides block

Add near the existing `describe('calcResourceIncome', ...)` block (~line
94-225):

```ts
test('fidesIncomeBlocked flag zeroes Fides income regardless of other bonuses', () => {
  const s = makeState({ flags: { fidesIncomeBlocked: true } });
  const { fidesIncome } = calcResourceIncome(s as any);
  expect(fidesIncome).toBe(0);
});

test('fidesIncomeBlocked does not affect Denarii or Plebs', () => {
  const blocked = calcResourceIncome(makeState({ flags: { fidesIncomeBlocked: true } }) as any);
  const unblocked = calcResourceIncome(makeState({ flags: {} }) as any);
  expect(blocked.denariiIncome).toBe(unblocked.denariiIncome);
  expect(blocked.plebsDelta).toBe(unblocked.plebsDelta);
});
```

Check the file's existing `makeState` helper accepts a `flags` override (it
likely spreads overrides onto a base object — follow the existing pattern
used by the other tests in that `describe` block, e.g. how the regency or
asset-bonus tests override a single field).

### `__tests__/militaryEngine.test.ts` — parity fix

Add to the existing `describe` block covering `tickSenateResponse` (~line
565 onward, reusing its `makeState`/`makeCharacter` helpers). This needs
`processSeason` from `turnSequencer.ts` rather than `tickSenateResponse`
directly, since the new logic lives in `turnSequencer.ts`, not
`senateResponseEngine.ts` — check whether `processSeason` is already
imported in this file; if not, add the import and build whatever minimal
state it needs (check an existing `processSeason` caller in another test
file, e.g. `warEngine.test.ts` or `p5e.test.ts`, for the shape of state it
expects beyond what this file's own `makeState` already provides):

```ts
test('personal-levy response with raisedLegions disbanded to zero auto-clears at season end (parity with the Army-sourced path)', () => {
  const compliantCharacter = makeCharacter({ isPlayer: true, raisedLegions: [], veterans: [{ id: 'v1' } as any] });
  const personalResponse: SenateResponseState = {
    ...armySourcedResponse, sourceArmyId: undefined, phase: 'censure',
  };
  const state = makeState({ family: [compliantCharacter], senateResponse: personalResponse });
  const result = processSeason(state as any);
  expect(result.senateResponse).toBeNull();
});

test('personal-levy response with raisedLegions still present keeps escalating normally', () => {
  const stillArmedCharacter = makeCharacter({ isPlayer: true, raisedLegions: [{ id: 't1' } as any] });
  const personalResponse: SenateResponseState = {
    ...armySourcedResponse, sourceArmyId: undefined, phase: 'censure', seasonDetected: 1,
  };
  const state = makeState({ family: [stillArmedCharacter], senateResponse: personalResponse, turnNumber: 3 });
  const result = processSeason(state as any);
  expect(result.senateResponse).not.toBeNull();
});
```

Adjust field names/turn numbers to whatever `processSeason`'s actual
signature and this file's fixtures require — check `makeCharacter`'s
existing defaults (~line 530-542) for what `isPlayer` default is, since the
new logic keys off `family.find(c => c.isPlayer)`.

## Acceptance criteria

- `npx tsc --noEmit` is zero-error.
- `npm test` passes, including the new tests above.
- Manually: trigger an unsanctioned personal levy, let the censure bill pass
  (or force it via the debug panel), confirm Fides income shows as 0 in the
  season ledger/SeasonOverlay while the flag is active. Disband all raised
  legions via the Military tab, end another season, confirm `senateResponse`
  clears and Fides income resumes.
