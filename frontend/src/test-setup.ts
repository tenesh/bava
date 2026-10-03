import { afterEach, vi } from 'vitest';
import { teardown } from './test/render';

/**
 * Test environment gaps.
 *
 * jsdom has no ResizeObserver. Ark's positioner (floating-ui's autoUpdate)
 * creates one whenever a menu or popover opens, and its absence surfaced as an
 * unhandled rejection that made `npm test` exit 1 while every test passed.
 * A no-op observer is enough: jsdom does no layout, so there is nothing to
 * observe.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

/**
 * The shared teardown: every test ends on real time with its cleanups run, and
 * a test with a page ends with everything it mounted taken down and the page
 * empty (see
 * `src/test/render.ts`). Registered here, first, so it runs after each file's
 * own `afterEach`.
 */
afterEach(async () => {
  // Real time first: on fake time the teardown's own waits would never end.
  vi.useRealTimers();
  await teardown();
});
