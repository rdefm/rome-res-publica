import { describeActionImpact } from '../src/engine/actionImpactText';
import { OFFICES } from '../src/data/offices';
import type { OfficeAction } from '../src/models/office';

function findAction(officeId: string, actionId: string): OfficeAction {
  const office = OFFICES.find(o => o.id === officeId)!;
  const action = office.inOfficeActions?.find(a => a.id === actionId);
  if (!action) throw new Error(`Fixture action not found: ${officeId}/${actionId}`);
  return action;
}

describe('describeActionImpact', () => {
  test('parses a simple two-token successEffect string', () => {
    // vigintivirate/mint-oversight: successEffect 'gold+15|corruption+2'
    const action = findAction('vigintivirate', 'mint-oversight');
    expect(describeActionImpact(action)).toEqual(['+15 Gold', '+2 Corruption']);
  });

  test('renders a negative delta with its sign', () => {
    // quaestor/... failureEffect not used here; use an action with a negative successEffect token.
    const action: OfficeAction = {
      id: 'test-negative',
      name: 'Test',
      cost: 'Free',
      costVal: 0,
      resource: null,
      desc: 'test',
      successEffect: 'fides-8',
    };
    expect(describeActionImpact(action)).toEqual(['-8 Fides']);
  });

  test('skips setFlag: and other colon-delimited tokens — not a player-facing delta', () => {
    // quaestor/embezzle-treasury: 'gold+60|corruption+8|setFlag:quaestor-embezzled:true'
    const action = findAction('quaestor', 'embezzle-treasury');
    expect(describeActionImpact(action)).toEqual(['+60 Gold', '+8 Corruption']);
  });

  test('appends consequences[].description verbatim after successEffect lines', () => {
    // vigintivirate/road-survey: successEffect '' + one consequence
    const action = findAction('vigintivirate', 'road-survey');
    expect(describeActionImpact(action)).toEqual([
      'Province infrastructure investment recognised',
    ]);
  });

  test('legacy effect-function actions with no successEffect/consequences produce no lines', () => {
    // quaestor/divert-treasury: legacy `effect` closure, no successEffect, no consequences.
    const action = findAction('quaestor', 'divert-treasury');
    expect(describeActionImpact(action)).toEqual([]);
  });

  test('unrecognised resource keys are silently skipped, not crashed on', () => {
    const action: OfficeAction = {
      id: 'test-unknown',
      name: 'Test',
      cost: 'Free',
      costVal: 0,
      resource: null,
      desc: 'test',
      successEffect: 'unknownResource+5|fides+3',
    };
    expect(describeActionImpact(action)).toEqual(['+3 Fides']);
  });
});
