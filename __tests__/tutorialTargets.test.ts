import {
  registerTarget,
  clearTarget,
  getTarget,
  subscribeTargets,
  type TargetRect,
} from '../src/engine/tutorialTargets';

function rect(overrides: Partial<TargetRect> = {}): TargetRect {
  return { x: 0, y: 0, width: 100, height: 40, ...overrides };
}

describe('tutorialTargets registry', () => {
  afterEach(() => {
    // Registry is module-level state — clear anything a test registered.
    clearTarget('t1');
    clearTarget('t2');
  });

  it('returns null for an unregistered id', () => {
    expect(getTarget('never-registered')).toBeNull();
  });

  it('registers and retrieves a rect', () => {
    registerTarget('t1', rect({ x: 10, y: 20 }));
    expect(getTarget('t1')).toEqual(rect({ x: 10, y: 20 }));
  });

  it('clears a registered rect', () => {
    registerTarget('t1', rect());
    clearTarget('t1');
    expect(getTarget('t1')).toBeNull();
  });

  it('clearing an unregistered id is a no-op (does not throw, does not notify)', () => {
    const cb = jest.fn();
    const unsub = subscribeTargets(cb);
    clearTarget('never-registered');
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it('notifies subscribers on register and on clear', () => {
    const cb = jest.fn();
    const unsub = subscribeTargets(cb);

    registerTarget('t1', rect());
    expect(cb).toHaveBeenCalledTimes(1);

    clearTarget('t1');
    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('does not notify on a re-register with an identical rect', () => {
    const cb = jest.fn();
    registerTarget('t1', rect({ x: 5 }));
    const unsub = subscribeTargets(cb);

    registerTarget('t1', rect({ x: 5 }));
    expect(cb).not.toHaveBeenCalled();

    registerTarget('t1', rect({ x: 6 }));
    expect(cb).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('unsubscribed callbacks stop receiving notifications', () => {
    const cb = jest.fn();
    const unsub = subscribeTargets(cb);
    unsub();

    registerTarget('t1', rect());
    expect(cb).not.toHaveBeenCalled();
  });

  it('tracks multiple ids independently', () => {
    registerTarget('t1', rect({ x: 1 }));
    registerTarget('t2', rect({ x: 2 }));

    expect(getTarget('t1')).toEqual(rect({ x: 1 }));
    expect(getTarget('t2')).toEqual(rect({ x: 2 }));

    clearTarget('t1');
    expect(getTarget('t1')).toBeNull();
    expect(getTarget('t2')).toEqual(rect({ x: 2 }));
  });
});
