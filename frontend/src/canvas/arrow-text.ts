/**
 * Text at a free arrow end: with the Text tool, a click by an unattached end
 * starts a text there that the end attaches to, the arrow staying where it is
 * (Excalidraw's `element/src/arrowEndpointText.ts`).
 */
import { drawnPoints, gapOf, type Point } from './binding';
import type { History } from './history';
import type { ElementId, SceneData, SceneElement } from './scene';

export type ArrowEnd = { arrow: ElementId; side: 'start' | 'end' };

/**
 * The free end of an arrow within `reach` of a point, front to back, the end
 * before the start; one with no direction to place a text along is skipped.
 */
export function freeEndAt(scene: SceneData, point: Point, reach: number): ArrowEnd | null {
  const ordered = [...scene.elements].sort((a, b) => b.z - a.z);
  for (const element of ordered) {
    if (element.type !== 'arrow' || element.locked === true) continue;
    const drawn = drawnPoints(element);
    if (drawn.length < 4) continue;
    const record = element as unknown as Record<string, unknown>;
    for (const side of ['end', 'start'] as const) {
      if (record[`${side}Binding`] !== undefined) continue;
      const [tip, next] = ends(drawn, side);
      if (tip.x === next.x && tip.y === next.y) continue;
      if (Math.hypot(point.x - tip.x, point.y - tip.y) < reach) return { arrow: element.id, side };
    }
  }
  return null;
}

/**
 * Add a text for an arrow end, as one step: the side of it the arrow points
 * at sits a gap past the tip, and the end attaches to that side's middle, so
 * nothing about the arrow moves. Returns the text's id, or null for no text.
 */
export function insertTextAtEnd(
  history: History,
  end: ArrowEnd,
  value: string,
  measure: (text: string) => { width: number; height: number },
): ElementId | null {
  if (!value.trim()) return null;
  const placement = endTextPlacement(history.current, end);
  if (!placement) return null;
  const { at, anchor, align } = placement;
  const side = { anchor, align };
  const size = measure(value);
  const id = `t${history.current.elements.length + 1}-${Math.random().toString(36).slice(2, 8)}`;
  history.mutate((draft) => {
    draft.elements.push({
      id,
      type: 'text',
      x: at.x - side.anchor[0] * size.width,
      y: at.y - side.anchor[1] * size.height,
      w: size.width,
      h: size.height,
      z: draft.elements.reduce((max, e) => Math.max(max, e.z), 0) + 1,
      text: value,
      align: side.align,
      measuredWidth: size.width,
      measuredHeight: size.height,
    } as SceneElement);
    const bound = draft.elements.find((e) => e.id === end.arrow) as unknown as Record<string, unknown> | undefined;
    if (!bound) return;
    bound[`${end.side}Binding`] = id;
    bound[`${end.side}Anchor`] = side.anchor;
  });
  return id;
}

/**
 * Where a text for an arrow end goes: `at`, a gap past the tip along the
 * arrow, is where the side of the text the arrow points at has its middle
 * (`anchor`, as a fraction of the text's box), and how the text is aligned so
 * it grows away from the arrow. Null for an end with no direction.
 */
export function endTextPlacement(
  scene: SceneData,
  end: ArrowEnd,
): { at: Point; anchor: [number, number]; align: 'left' | 'right' | 'center' } | null {
  const arrow = scene.elements.find((e) => e.id === end.arrow);
  if (!arrow) return null;
  const [tip, next] = ends(drawnPoints(arrow), end.side);
  const dx = tip.x - next.x;
  const dy = tip.y - next.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  // Which way the arrow travels at its tip, to the nearest side.
  const across = Math.abs(dx) >= Math.abs(dy);
  const side: { anchor: [number, number]; align: 'left' | 'right' | 'center' } = across
    ? dx >= 0
      ? { anchor: [0, 0.5], align: 'left' }
      : { anchor: [1, 0.5], align: 'right' }
    : dy >= 0
      ? { anchor: [0.5, 0], align: 'center' }
      : { anchor: [0.5, 1], align: 'center' };
  // A gap past the tip along the arrow: Bava keeps the gap along the ray
  // from the anchor, so the attached end lands back on the tip.
  const gap = gapOf();
  return { at: { x: tip.x + (dx / length) * gap, y: tip.y + (dy / length) * gap }, ...side };
}

/** An end's tip and the point next to it, in scene space. */
function ends(drawn: number[], side: 'start' | 'end'): [Point, Point] {
  const last = drawn.length - 2;
  return side === 'start'
    ? [{ x: drawn[0], y: drawn[1] }, { x: drawn[2], y: drawn[3] }]
    : [{ x: drawn[last], y: drawn[last + 1] }, { x: drawn[last - 2], y: drawn[last - 1] }];
}
