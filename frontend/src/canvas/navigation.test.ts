import { describe, expect, it } from 'vitest';
import { wheelAction } from './navigation';

const wheel = (over: Partial<WheelEvent>) =>
  ({ deltaX: 0, deltaY: 0, ctrlKey: false, metaKey: false, deltaMode: 0, ...over }) as WheelEvent;

describe('wheelAction', () => {
  it('pans with a plain scroll, in the direction the content moves', () => {
    expect(wheelAction(wheel({ deltaX: 10, deltaY: 20 }))).toEqual({ kind: 'pan', dx: -10, dy: -20 });
  });

  // A trackpad pinch arrives as a wheel event with ctrlKey set, on every
  // platform's webview; Cmd+scroll is the macOS habit.
  it('zooms with Ctrl or Cmd held, in for scroll up and out for scroll down', () => {
    const zoomIn = wheelAction(wheel({ deltaY: -50, ctrlKey: true }));
    const zoomOut = wheelAction(wheel({ deltaY: 50, metaKey: true }));
    expect(zoomIn.kind).toBe('zoom');
    expect(zoomOut.kind).toBe('zoom');
    if (zoomIn.kind === 'zoom' && zoomOut.kind === 'zoom') {
      expect(zoomIn.factor).toBeGreaterThan(1);
      expect(zoomOut.factor).toBeLessThan(1);
      expect(zoomIn.factor * zoomOut.factor).toBeCloseTo(1);
    }
  });

  it('scales line-based wheel deltas to pixels', () => {
    expect(wheelAction(wheel({ deltaY: 3, deltaMode: 1 }))).toEqual({ kind: 'pan', dx: -0, dy: -48 });
  });

  // One notch of a pixel-mode mouse wheel must not zoom several times over.
  it('caps how far one wheel event zooms', () => {
    const notch = wheelAction(wheel({ deltaY: -120, ctrlKey: true }));
    if (notch.kind !== 'zoom') throw new Error('expected zoom');
    expect(notch.factor).toBeLessThan(1.3);
  });
});
