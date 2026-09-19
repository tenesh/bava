import { describe, expect, it } from 'vitest';
import { EXPORT_PADDING, exportArea } from './area';
import type { SceneData, SceneElement } from '../scene';

const scene = (): SceneData => ({
  elements: [
    { id: 'a', type: 'rect', x: 0, y: 0, w: 20, h: 20, z: 1 },
    { id: 'b', type: 'rect', x: 80, y: 0, w: 20, h: 20, z: 2 },
    { id: 'g', type: 'group', x: 0, y: 0, w: 100, h: 20, z: 3, children: ['a', 'b'] },
  ] as SceneElement[],
});

const ids = (area: { elements: SceneElement[] }) => area.elements.map((e) => e.id).sort();

describe('what an export covers', () => {
  it('is the whole canvas by default', () => {
    expect(ids(exportArea(scene(), []))).toEqual(['a', 'b']);
  });

  it('is the selection when only the selection is asked for', () => {
    expect(ids(exportArea(scene(), ['a'], { onlySelected: true }))).toEqual(['a']);
  });

  // Only selected with nothing selected would export an empty picture, which
  // is never what the user meant by ticking it.
  it('falls back to the whole canvas when nothing is selected', () => {
    expect(ids(exportArea(scene(), [], { onlySelected: true }))).toEqual(['a', 'b']);
  });

  // A group draws nothing: its box would only pad the export, and its
  // children are what a reader sees.
  it('takes a group as its children, never its own box', () => {
    expect(ids(exportArea(scene(), ['g'], { onlySelected: true }))).toEqual(['a', 'b']);
  });

  it('pads the box on every side', () => {
    const area = exportArea(scene(), []);
    expect(area.box).toEqual({
      x: -EXPORT_PADDING,
      y: -EXPORT_PADDING,
      w: 100 + EXPORT_PADDING * 2,
      h: 20 + EXPORT_PADDING * 2,
    });
  });

  it('measures a rotated element where it is drawn', () => {
    const turned: SceneData = {
      elements: [{ id: 'r', type: 'rect', x: 0, y: 40, w: 100, h: 20, z: 1, angle: 90 } as never],
    };
    // Turned a quarter, the bar runs x 40 to 60 and y 0 to 100.
    expect(exportArea(turned, []).box).toMatchObject({ x: 40 - EXPORT_PADDING, y: -EXPORT_PADDING, w: 20 + EXPORT_PADDING * 2 });
  });

  it('gives an empty scene an empty box, not an infinite one', () => {
    const area = exportArea({ elements: [] }, []);
    expect(area.elements).toEqual([]);
    expect(area.box).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it('keeps paint order, so the export stacks as the canvas does', () => {
    const shuffled: SceneData = {
      elements: [
        { id: 'top', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 9 },
        { id: 'bottom', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
      ] as SceneElement[],
    };
    expect(exportArea(shuffled, []).elements.map((e) => e.id)).toEqual(['bottom', 'top']);
  });
});
