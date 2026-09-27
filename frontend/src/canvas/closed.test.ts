import { describe, expect, it } from 'vitest';
import { closeLine, openLine } from './closed';
import { createHistory } from './history';
import { drawnPoints } from './binding';

// Close line and Open line, as Excalidraw's polygon toggle
// (`element/src/shape.ts:1138-1180`, `actions/actionLinearEditor.tsx:106-212`).
const line = (points: number[], over: Record<string, unknown> = {}) =>
  createHistory({ elements: [{ id: 'l', type: 'line', x: 0, y: 0, w: 100, h: 100, z: 1, points, ...over }] as never });
const current = (history: ReturnType<typeof line>) => history.current.elements[0] as unknown as Record<string, unknown> & { points: number[] };

describe('closing a line', () => {
  it('adds a point on the first when the last is far from it', () => {
    const history = line([0, 0, 100, 0, 100, 100]);
    closeLine(history, 'l');
    expect(current(history)).toMatchObject({ closed: true, points: [0, 0, 100, 0, 100, 100, 0, 0] });
  });

  it('moves the last point onto the first when within 20', () => {
    const history = line([0, 0, 100, 0, 100, 100, 10, 10]);
    closeLine(history, 'l');
    expect(current(history)).toMatchObject({ closed: true, points: [0, 0, 100, 0, 100, 100, 0, 0] });
  });

  it('is one step', () => {
    const history = line([0, 0, 100, 0, 100, 100]);
    closeLine(history, 'l');
    history.undo();
    expect(current(history)).not.toHaveProperty('closed');
  });
});

describe('opening a line', () => {
  it('keeps its points, and loses its fill', () => {
    const history = line([0, 0, 100, 0, 100, 100, 0, 0], { closed: true, fill: 'blue' });
    openLine(history, 'l');
    expect(current(history)).not.toHaveProperty('closed');
    expect(current(history)).not.toHaveProperty('fill');
    expect(current(history).points).toEqual([0, 0, 100, 0, 100, 100, 0, 0]);
  });
});

// A turned line stays where it is drawn when closed.
describe('closing a turned line', () => {
  it('keeps its points where they are drawn', () => {
    const history = line([0, 0, 100, 0, 100, 100, 10, 10], { angle: 45, edges: 'round' });
    const before = drawnPoints(current(history) as never).slice(0, 6);
    closeLine(history, 'l');
    const after = drawnPoints(current(history) as never).slice(0, 6);
    after.forEach((v, i) => expect(v).toBeCloseTo(before[i], 1));
  });
});
