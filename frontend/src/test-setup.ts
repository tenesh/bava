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
