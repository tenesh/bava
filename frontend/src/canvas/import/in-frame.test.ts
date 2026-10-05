import { describe, expect, it } from 'vitest';
import type { SceneElement } from '../scene';
import { boundsOf } from '../edit';
import { DIAGRAM_FRAME_GAP, DIAGRAM_FRAME_PADDING, inNewFrame } from './in-frame';

const box = (id: string, x: number, y: number, extra: Partial<SceneElement> = {}) => ({ id, type: 'rectangle', x, y, w: 100, h: 40, z: 1, ...extra }) as SceneElement;
const diagram = [box('a', -50, -20), box('b', 150, 60), box('c', 160, 70, { frame: 'b' })];

describe('a diagram placed in a new frame', () => {
  it('puts the frame first, labelled, round the whole diagram with padding', () => {
    const [frame, ...rest] = inNewFrame({ elements: [] }, diagram, 'Diagram');
    expect(frame).toMatchObject({ type: 'frame', label: 'Diagram' });
    const inside = boundsOf(rest);
    expect(frame.x).toBe(inside.x - DIAGRAM_FRAME_PADDING);
    expect(frame.y).toBe(inside.y - DIAGRAM_FRAME_PADDING);
    expect(frame.w).toBe(inside.w + 2 * DIAGRAM_FRAME_PADDING);
    expect(frame.h).toBe(inside.h + 2 * DIAGRAM_FRAME_PADDING);
  });

  it('makes the new frame hold what nothing else in the diagram holds', () => {
    const [frame, ...rest] = inNewFrame({ elements: [] }, diagram, 'Diagram');
    expect(rest.map((element) => element.frame)).toEqual([frame.id, frame.id, 'b']);
  });

  it('sits below everything already on the canvas, at its left edge', () => {
    const scene = { elements: [box('x', 300, 500), box('y', 20, 100)] };
    const [frame] = inNewFrame(scene, diagram, 'Diagram');
    const content = boundsOf(scene.elements);
    expect(frame.x).toBe(content.x);
    expect(frame.y).toBe(content.y + content.h + DIAGRAM_FRAME_GAP);
  });

  it('keeps the diagram’s own shape', () => {
    const [, a, b] = inNewFrame({ elements: [box('x', 300, 500)] }, diagram, 'Diagram');
    expect(b.x - a.x).toBe(200);
    expect(b.y - a.y).toBe(80);
  });
});
