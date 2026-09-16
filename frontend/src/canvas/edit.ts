/**
 * Editing operations over a scene: bounds, grouping, clipboard.
 *
 * Grouping does not move anything. A group is a labelled element that knows
 * its children and covers them; its children keep their own coordinates, so
 * ungrouping is removal of the wrapper rather than an inverse transform.
 */
import type { ElementId, GroupElement, Scene, SceneElement } from './scene';
import type { Box } from './selection';

/** How far a pasted copy lands from its original, so it is visibly a copy. */
export const PASTE_OFFSET = 16;

export function boundsOf(elements: SceneElement[]): Box {
  if (elements.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  const left = Math.min(...elements.map((e) => e.x));
  const top = Math.min(...elements.map((e) => e.y));
  const right = Math.max(...elements.map((e) => e.x + e.w));
  const bottom = Math.max(...elements.map((e) => e.y + e.h));

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Wrap two or more elements in a group. Returns undefined for fewer. */
export function group(scene: Scene, ids: ElementId[]): GroupElement | undefined {
  const children = ids.map((id) => scene.get(id)).filter((e): e is SceneElement => Boolean(e));
  if (children.length < 2) return undefined;

  const box = boundsOf(children);
  return scene.add({
    type: 'group',
    ...box,
    children: children.map((c) => c.id),
  }) as GroupElement;
}

/**
 * Remove a group, leaving its children in place.
 *
 * The children were never moved, so there is nothing to undo — which is why
 * grouping is defined not to move them.
 */
export function ungroup(scene: Scene, id: ElementId): void {
  const element = scene.get(id);
  if (element?.type !== 'group') return;
  scene.remove(id);
}

/** Copy elements into the scene, offset so the copy is visible. */
export function paste(scene: Scene, elements: SceneElement[]): SceneElement[] {
  return elements.map((element) => {
    const copy = { ...element, x: element.x + PASTE_OFFSET, y: element.y + PASTE_OFFSET };
    // add() assigns a fresh id and z; the ones carried over are ignored.
    return scene.add(copy);
  });
}
