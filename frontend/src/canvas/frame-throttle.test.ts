import { describe, expect, it, vi } from 'vitest';
import { frameThrottle } from './frame-throttle';

// A pointer can report several moves per frame; the canvas can show one.
describe('frameThrottle', () => {
  function frames() {
    const queued: (() => void)[] = [];
    return {
      schedule: (run: () => void) => {
        queued.push(run);
        return queued.length;
      },
      cancel: (handle: number) => {
        queued[handle - 1] = () => {};
      },
      flush: () => queued.splice(0).forEach((run) => run()),
    };
  }

  it('runs once per frame with the last arguments', () => {
    const f = frames();
    const fn = vi.fn();
    const throttled = frameThrottle(fn, f.schedule, f.cancel);
    throttled(1);
    throttled(2);
    throttled(3);
    expect(fn).not.toHaveBeenCalled();
    f.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('runs again in the next frame', () => {
    const f = frames();
    const fn = vi.fn();
    const throttled = frameThrottle(fn, f.schedule, f.cancel);
    throttled(1);
    f.flush();
    throttled(2);
    f.flush();
    expect(fn.mock.calls).toEqual([[1], [2]]);
  });

  // A release must not be followed by a move from before it.
  it('does not run a call that was cancelled', () => {
    const f = frames();
    const fn = vi.fn();
    const throttled = frameThrottle(fn, f.schedule, f.cancel);
    throttled(1);
    throttled.cancel();
    f.flush();
    expect(fn).not.toHaveBeenCalled();
  });
});
