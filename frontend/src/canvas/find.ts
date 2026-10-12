/**
 * Find on the Canvas: the elements whose text holds what is typed, as find in
 * a page matches (one phrase, anywhere, capitals ignored). A shape's, arrow's,
 * frame's or group's label, a text element's text, a code block's code and a
 * table's or class's name and rows are read; lines and pen strokes have none. Matches run in reading order: top to
 * bottom, then left to right, by each element's box.
 */
import type { ElementId, SceneElement } from './scene';

function textOf(element: SceneElement): string {
  if (element.type === 'line' || element.type === 'stroke') return '';
  const { label, text, code, name, rows } = element as { label?: string; text?: string; code?: string; name?: string; rows?: string };
  return [label, text, code, name, rows].filter(Boolean).join('\n');
}

export function findOnCanvas(elements: readonly SceneElement[], query: string): ElementId[] {
  const wanted = query.toLowerCase();
  if (!wanted) return [];
  return elements
    .filter((element) => textOf(element).toLowerCase().includes(wanted))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((element) => element.id);
}
