/**
 * At most one run per animation frame, with the latest arguments.
 *
 * A pointer reports moves faster than the screen redraws; previewing, routing
 * and rendering the scene for each one does work nobody sees. `cancel` drops a
 * pending run, so a release is never followed by a move from before it.
 */
export function frameThrottle<A extends unknown[]>(
  fn: (...args: A) => void,
  schedule: (run: () => void) => number = (run) => requestAnimationFrame(run),
  unschedule: (handle: number) => void = (handle) => cancelAnimationFrame(handle),
) {
  let pending: A | null = null;
  let handle: number | null = null;

  const throttled = (...args: A): void => {
    pending = args;
    if (handle !== null) return;
    handle = schedule(() => {
      handle = null;
      const latest = pending;
      pending = null;
      if (latest) fn(...latest);
    });
  };

  throttled.cancel = (): void => {
    if (handle !== null) unschedule(handle);
    handle = null;
    pending = null;
  };

  return throttled;
}
