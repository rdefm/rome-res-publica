# Ticket: Censura bill doesn't match the real Bill model

**STATUS: RESOLVED.** Implemented per the plan below — see "What actually
shipped" at the bottom. Left in place per this repo's convention of keeping
past plan docs rather than deleting them.

**Depends on nothing. Ticket 2 (Fides income block) depends on this one.**

## Report

When a player raises an unsanctioned personal levy (or an unsanctioned
Army-sourced muster), the Senate eventually opens a "debate" phase and is
supposed to put a censure motion before the Curia LEGES tab. In practice the
motion never renders correctly and can never pass or fail — it just sits in
the bill list forever in a broken state.

## Root cause

`src/engine/senateResponseEngine.ts`, `tickSenateResponse`, the `null →
debate` branch (~line 127-150), builds the censure bill as an ad-hoc object
cast through `as any`:

```ts
const censuraBill = {
  id:              `senate-censura-${turnNumber}`,
  title:           'Senatus Consultum de Censura',
  description:     `The Senate moves to censure the ${state.gensPlural} for raising an unsanctioned personal levy. If passed, Fides income is suspended until all illegal troops are disbanded.`,
  type:            'censure',
  forVotes:        0,
  againstVotes:    0,
  playerCanVote:   true,
  passThreshold:   50,
  effectOnPass:    'fides_income_blocked',
} as any;
patch.bills = [...state.bills, censuraBill];
```

This is pushed straight into `state.bills`, but the real `Bill` interface
(`src/models/bill.ts`) uses a completely different shape: `name`/`desc` (not
`title`/`description`), `support`/`turnsLeft`/`passEffect`/`failEffect` (not
`forVotes`/`againstVotes`/`passThreshold`/`effectOnPass`), and `type` must be
one of the real `BillType` union values (`'censure'` isn't one of them).

Consequences, verified against the actual resolution/render code:

- **Renders broken.** `src/components/curia/BillCard.tsx:36` reads
  `bill.name` directly — undefined for this bill, so the card shows a blank
  title. `BillDetailModal.tsx:28` reads `bill.desc` — also undefined.
- **Never resolves.** `src/engine/turnSequencer.ts`'s season-end bill loop
  (~line 547-580) does:
  ```ts
  const turnsLeft = bill.turnsLeft - 1;               // undefined - 1 = NaN
  const effectiveSupport = ... ? bill.support - 10 : bill.support; // undefined
  if (effectiveSupport > passThresholdBonus) { ... }   // undefined > N → always false
  else if (turnsLeft <= 0) { ... }                     // NaN <= 0 → always false
  else { remainingBills.push({ ...bill, turnsLeft }); } // turnsLeft stays NaN forever
  ```
  The bill can never pass and never expires — it sits in `state.bills`
  permanently, re-pushed with `turnsLeft: NaN` every season.
- **`effectOnPass: 'fides_income_blocked'`** is never read by any code —
  it's a dead string. (Ticket 2 fixes this, but only once this bill uses the
  real resolution pipeline.)
- **A stale test already encodes the broken shape.** `__tests__/p5e.test.ts`
  (~line 236-248), `tickSenateResponse's censure bill description reads
  state.gensPlural`, finds the bill via
  `b.type === 'censure'` and asserts on `bill.description`. Once this ticket
  changes `type` and field names, that `find()` will return `undefined` and
  the test's `if (bill) { ... }` guard means the assertions silently never
  run — the test will still report "pass" without checking anything. **This
  test must be updated in the same change**, not left as a silent no-op.

## What to change

### 1. `src/engine/senateResponseEngine.ts`

Add `import type { Bill } from '../models/bill';` near the top (alongside
the existing imports).

Replace the `censuraBill` object (the `null → debate` branch) with a real
`Bill`:

```ts
const censuraBill: Bill = {
  id:         `senate-censura-${turnNumber}`,
  name:       'Senatus Consultum de Censura',
  desc:       `The Senate moves to censure the ${state.gensPlural} for raising an unsanctioned personal levy. If passed, Fides income is suspended until all illegal troops are disbanded.`,
  type:       'constitutional',
  support:    20,
  turnsLeft:  3,
  passEffect: 'setFlag:fidesIncomeBlocked:true',
  failEffect: '',
};
patch.bills = [...state.bills, censuraBill];
```

Field choices and why (documented so a reviewer doesn't have to re-derive
them — these are first-pass/unverified balance numbers, same convention the
rest of `billTemplates.ts`/`senateResponseEngine.ts` already uses for its own
constants, e.g. see the `tableRefuseMamertineBill` comment in
`resourceEngine.ts`):

- `type: 'constitutional'` — thematically it's a Senate motion about the
  constitutional limits on raising troops, and it plugs into the existing
  Rome-stat vote modifier in `calcRomeStatVoteModifier` (stability-based),
  which is the sensible axis for a motion like this. No new `BillType` union
  member needed.
- `support: 20` — starts already leaning toward passing (the Senate
  initiated this, not the player), but not so high that a single "vote
  against" (−15 default) or "speech against" (−20 default) can't meaningfully
  contest it. The bill is created during the same `processSeason` call as
  step 9f, which runs *after* that season's own bill-resolution loop
  (turnSequencer.ts ~line 533-581 runs before ~line 1364's senate-response
  tick) — so the player gets one full season before this bill is first
  checked for passing, enough time to vote/speech against it.
- `turnsLeft: 3` — in line with most other bill templates (typically 3-4).
- `passEffect: 'setFlag:fidesIncomeBlocked:true'` — uses the existing
  generic `setFlag:key:value` token already supported by
  `applyEffectString` (`src/engine/resourceEngine.ts` ~line 332-341, the
  same mechanism `data/offices.ts`'s `invoke-consular-authority` action
  already uses for `consulAuthorityActive`). This requires no new parsing
  logic. Ticket 2 makes this flag actually do something.
- `failEffect: ''` — deliberately a no-op. The bill passing/failing is
  intentionally decoupled from the `senateResponse` phase escalation
  (`debate → censure → hostis → consular_army`), which is driven purely by
  `turnNumber` thresholds in `tickSenateResponse`, not by this bill's
  outcome. That's the existing design (the two systems already run in
  parallel with no cross-wiring) — this ticket doesn't change that
  relationship, only fixes the bill's own shape. If a future ticket wants
  "defeating the censure bill also caps the phase escalation," that's a
  separate, larger design decision — flag it, don't build it here.

### 2. `__tests__/p5e.test.ts`

Update the test at ~line 236-248 to match the new shape:

```ts
test('tickSenateResponse\'s censure bill description reads state.gensPlural', () => {
  const state = {
    ...INITIAL_STATE, gensPlural: 'Duilii', turnNumber: 5,
    senateResponse: { active: true, phase: null, debateSuppressed: false },
    consulAuthorityActive: false,
  } as any;
  const patch: any = tickSenateResponse(state, 'pc-1');
  const bill = (patch.bills ?? []).find((b: any) => b?.id?.startsWith('senate-censura-'));
  expect(bill).toBeDefined();
  expect(bill.desc).toContain('Duilii');
  expect(bill.desc).not.toContain('Brutii');
});
```

(The `ignoredLevies: 0` field in the original fixture's `senateResponse`
object isn't part of the real `SenateResponseState` interface — it's dead
fixture noise from before this test was written `as any`. Fine to drop it
while you're in there; not required.)

### 3. New test coverage in `__tests__/militaryEngine.test.ts`

This file already has a `describe` block covering `tickSenateResponse` /
`capitulate` (~line 565 onward, with its own `makeState`/`makeCharacter`
helpers). Add a test there asserting the generated bill is a real, valid
`Bill`:

```ts
test('the debate-phase censure bill is a real Bill the Curia UI can render and resolve', () => {
  const state = makeState({
    senateResponse: { ...armySourcedResponse, phase: null, sourceArmyId: undefined },
    turnNumber: 2, // seasonDetected(1) + 1 = debateTurn
  });
  const patch = tickSenateResponse(state as any, 'pc-1');
  const bill = (patch.bills as Bill[])?.find(b => b.id.startsWith('senate-censura-'));
  expect(bill).toBeDefined();
  expect(bill!.name).toBeTruthy();
  expect(bill!.desc).toBeTruthy();
  expect(typeof bill!.support).toBe('number');
  expect(typeof bill!.turnsLeft).toBe('number');
  expect(bill!.passEffect).toBe('setFlag:fidesIncomeBlocked:true');
});
```

Adjust `turnNumber`/`seasonDetected` as needed to land exactly on
`debateTurn` (`seasonDetected + 1`, from `phaseThresholds` in
`senateResponseEngine.ts`) given the file's existing `armySourcedResponse`
fixture has `seasonDetected: 1`. Import `Bill` from `'../src/models/bill'`
at the top of the test file if not already imported.

## Acceptance criteria

- `npx tsc --noEmit` is zero-error.
- `npm test` passes, including the updated `p5e.test.ts` test (now actually
  asserting something) and the new `militaryEngine.test.ts` test.
- Manually triggering an unsanctioned levy and letting it reach the `debate`
  phase (or via the debug panel's Auto-Season Runner) shows a properly
  titled/described bill in the Curia LEGES tab that can be voted on, spoken
  on, or filibustered like any other bill, and eventually passes or expires
  instead of sitting forever.

## What actually shipped

Implemented exactly as planned above, no deviations:

- **`src/engine/senateResponseEngine.ts`** — added `import type { Bill }
  from '../models/bill';`. Replaced the ad-hoc `as any` object with a real
  `Bill` literal (`name`/`desc`/`type: 'constitutional'`/`support: 20`/
  `turnsLeft: 3`/`passEffect: 'setFlag:fidesIncomeBlocked:true'`/
  `failEffect: ''`), matching the plan's field choices and rationale
  verbatim.
- **`__tests__/p5e.test.ts`** — updated the existing censure-bill test to
  find the bill by `id.startsWith('senate-censura-')` and assert on `desc`
  instead of the old `type === 'censure'` / `description` lookup. Also had
  to add `seasonDetected: 4` to the fixture's `senateResponse` (turnNumber
  5, so `debateTurn = seasonDetected + 1 = 5` actually matches) — the
  original fixture omitted `seasonDetected` entirely, which made
  `debateTurn` resolve to `NaN` and meant the bill-building branch never
  ran at all. The old test's `if (bill) { ... }` guard silently swallowed
  that (an unconditional pass, asserting nothing) — worth calling out
  explicitly since it's a second, independent instance of the same "test
  never actually exercised the code" failure mode this ticket set out to
  fix in the app code.
- **`__tests__/militaryEngine.test.ts`** — added `import type { Bill } from
  '../src/models/bill';` and a new test in the existing `tickSenateResponse
  / capitulate` describe block asserting the generated bill has a truthy
  `name`/`desc`, numeric `support`/`turnsLeft`, and the expected
  `passEffect` string. Had to add `bills: []` to that test's state override
  — `makeState`'s base fixture never included a `bills` field (no prior
  test in this file exercised the `null → debate` branch, which is the only
  branch that reads `state.bills`), so omitting it would have thrown
  `undefined is not iterable` at `[...state.bills, censuraBill]`.
- Verified: `npx tsc --noEmit` zero-error; `npm test` — 60/60 suites, 1478
  tests (1476 passed, 2 pre-existing skips), including both the updated and
  new tests above.
