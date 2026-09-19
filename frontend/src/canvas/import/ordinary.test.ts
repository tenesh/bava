// The point of the milestone, pinned: once a diagram lands it is not special.
// Everything the canvas does to hand-drawn elements works on it, and if one of
// these fails the conversion produced something the rest of the canvas does
// not understand.
import { describe, expect, it } from 'vitest';
import layout from './__fixtures__/containers.json';
import { toElements } from './convert';
import type { Layout } from './convert';
import { createHistory } from '../history';
import { createSelection } from '../selection';
import { createCanvasCommands } from '../commands';
import { sceneToSave } from '../../files/document.svelte';
import { carriedWith } from '../containment';
import { isDetached } from '../binding';
import type { SceneElement } from '../scene';

function inserted() {
  const history = createHistory({ elements: [] });
  const selection = createSelection();
  const commands = createCanvasCommands({ history, selection });
  commands.insertDiagram(toElements(layout as Layout, { at: { x: 0, y: 0 } }));
  const byLabel = (label: string) =>
    history.current.elements.find((e) => (e as { label?: string }).label === label)!;
  return { history, selection, commands, byLabel };
}

/** Where an arrow's far end sits on the canvas. */
const endOf = (arrow: SceneElement) => {
  const points = (arrow as SceneElement & { points: number[] }).points;
  const last = points.length - 2;
  return { x: arrow.x + points[last], y: arrow.y + points[last + 1] };
};

describe('a diagram, once it is on the canvas', () => {
  it('moves a box and its arrows follow it there', () => {
    const { history, byLabel } = inserted();
    const compile = byLabel('Compile');

    history.mutate((draft) => {
      const moved = draft.elements.find((e) => e.id === compile.id)!;
      moved.x += 400;
      moved.y += 400;
    });

    // The arrow ends on the box, wherever the box went: within the binding
    // gap of its edge, not merely "somewhere else".
    const end = endOf(byLabel('source'));
    const moved = byLabel('Compile');
    const gap = 8;
    expect(end.x).toBeGreaterThanOrEqual(moved.x - gap);
    expect(end.x).toBeLessThanOrEqual(moved.x + moved.w + gap);
    expect(end.y).toBeGreaterThanOrEqual(moved.y - gap);
    expect(end.y).toBeLessThanOrEqual(moved.y + moved.h + gap);
  });

  it('freezes and marks an arrow whose box is deleted', () => {
    const { history, selection, commands, byLabel } = inserted();
    const compile = byLabel('Compile');
    const frozen = endOf(byLabel('source'));

    selection.click(compile.id);
    commands.deleteSelection();

    const arrow = byLabel('source') as SceneElement & { endBinding?: string };
    // Kept, with the id it had, at the point it last reached.
    expect(arrow.endBinding).toBe(compile.id);
    expect(endOf(arrow)).toEqual(frozen);
    expect(isDetached(arrow, history.current)).toBe(true);
  });

  it('carries a container contents when the container moves', () => {
    const { history, byLabel } = inserted();
    const frame = byLabel('Frontend');
    const childX = byLabel('Source Editor').x;

    // Through the real expansion, which is what a drag and a nudge both use:
    // naming the child here would make the test pass by construction.
    const carried = new Set(carriedWith(history.current, [frame.id]).map((element) => element.id));
    expect(carried.has(byLabel('Source Editor').id)).toBe(true);
    history.mutate((draft) => {
      for (const element of draft.elements) if (carried.has(element.id)) element.x += 50;
    });

    expect(byLabel('Source Editor').x).toBe(childX + 50);
  });

  // The save path only: reading a file back is Go's, and
  // `internal/format`'s round-trip tests cover bindings and membership there.
  // What this pins is that conversion's output survives the frontend's half.
  it('keeps its bindings and membership through the save path', () => {
    const { history } = inserted();
    const saved = sceneToSave({ version: 1 }, history.current.elements) as unknown as {
      elements: Record<string, unknown>[];
    };
    const elements = saved.elements;
    expect(elements).toHaveLength(history.current.elements.length);
    const frame = elements.find((e) => e.label === 'Frontend')!;
    const child = elements.find((e) => e.label === 'Source Editor')!;
    const arrow = elements.find((e) => e.label === 'source')!;
    expect(child.frame).toBe(frame.id);
    expect(arrow.startBinding).toBe(elements.find((e) => e.label === 'Source Editor')!.id);
    expect(arrow.endBinding).toBe(elements.find((e) => e.label === 'Compile')!.id);
  });

  it('is made only of element types the canvas draws', () => {
    const { history } = inserted();
    const known = new Set(['rect', 'ellipse', 'diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud', 'frame', 'arrow', 'line', 'text', 'stroke', 'group']);
    for (const element of history.current.elements) expect(known.has(element.type)).toBe(true);
  });
});
