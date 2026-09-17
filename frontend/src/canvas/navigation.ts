/**
 * What a wheel event does to the view: pan, or zoom about the pointer.
 *
 * Pure, so the direction and scale (easy to get backwards) are tested.
 */
export type WheelAction = { kind: 'pan'; dx: number; dy: number } | { kind: 'zoom'; factor: number };

/** Pixels per line, for mice that report scrolling in lines. */
const LINE_HEIGHT = 16;

/** How strongly a pixel of scroll zooms. */
const ZOOM_SENSITIVITY = 0.01;

/**
 * The most one wheel event may zoom by, in scroll pixels. A notched mouse on
 * WebView2 reports about 100 per notch, which would zoom 2.7 times at once.
 */
const MAX_ZOOM_DELTA = 25;

export function wheelAction(event: WheelEvent): WheelAction {
  const unit = event.deltaMode === 1 ? LINE_HEIGHT : 1;
  const dx = event.deltaX * unit;
  const dy = event.deltaY * unit;
  // A trackpad pinch arrives as a wheel event with ctrlKey set.
  if (event.ctrlKey || event.metaKey) {
    const clamped = Math.max(-MAX_ZOOM_DELTA, Math.min(MAX_ZOOM_DELTA, dy));
    return { kind: 'zoom', factor: Math.exp(-clamped * ZOOM_SENSITIVITY) };
  }
  return { kind: 'pan', dx: -dx, dy: -dy };
}
