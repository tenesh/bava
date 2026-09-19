/**
 * Editing operations over a scene: bounds, grouping, clipboard.
 *
 * Grouping does not move anything. A group is a labelled element that knows
 * its children and covers them; its children keep their own coordinates, so
 * ungrouping is removal of the wrapper rather than an inverse transform.
 */
import type { ElementId, GroupElement, Scene, SceneElement } from './scene';
import type { Box } from './selection';
import { angleOfElement, normalise, rotatedBounds } from './rotate';

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

/** The box around elements as they are drawn, rotation included. */
export function drawnBoundsOf(elements: SceneElement[]): Box {
  return boundsOf(elements.map((e) => ({ ...e, ...rotatedBounds(e), angle: 0 }) as SceneElement));
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
 * The children were never moved, so there is nothing to undo, which is why
 * grouping is defined not to move them.
 */
export function ungroup(scene: Scene, id: ElementId): void {
  const element = scene.get(id);
  if (element?.type !== 'group') return;
  scene.remove(id);
}

/** Copy elements into the scene, offset so the copy is visible. */
export function paste(scene: Scene, elements: SceneElement[]): SceneElement[] {
  const copies = new Map<ElementId, SceneElement>();
  const pasted = elements.map((element) => {
    const copy = { ...element, x: element.x + PASTE_OFFSET, y: element.y + PASTE_OFFSET };
    // add() assigns a fresh id and z; the ones carried over are ignored.
    const added = scene.add(copy);
    copies.set(element.id, added);
    return added;
  });
  remapReferences(scene, pasted, copies);
  return refreshed(scene, pasted);
}

/**
 * Point a copy's references at the other copies rather than the originals.
 *
 * A copied arrow attaches to the copied shapes, and a copied child joins the
 * copied frame; a reference to something that was *not* copied is kept, since
 * that element is still there and the copy sits on it.
 */
function remapReferences(scene: Scene, copies: SceneElement[], byOriginal: Map<ElementId, SceneElement>): void {
  for (const copy of copies) {
    const referring = copy as SceneElement & { startBinding?: string; endBinding?: string; frame?: string };
    const update: Record<string, string> = {};
    for (const key of ['startBinding', 'endBinding', 'frame'] as const) {
      const original = referring[key];
      const replacement = original === undefined ? undefined : byOriginal.get(original);
      if (replacement) update[key] = replacement.id;
    }
    if (Object.keys(update).length > 0) scene.update(copy.id, update as Partial<SceneElement>);
  }
}

/** The scene's current version of each element, after an update replaced it. */
function refreshed(scene: Scene, elements: SceneElement[]): SceneElement[] {
  return elements.map((element) => scene.get(element.id) ?? element);
}

/**
 * The elements plus, for every group among them, its children (and theirs):
 * what a geometric edit of a group has to touch, since children keep their
 * own coordinates.
 */
export function withDescendants(scene: Scene, elements: SceneElement[]): SceneElement[] {
  const seen = new Map<ElementId, SceneElement>();
  const visit = (element: SceneElement | undefined) => {
    if (!element || seen.has(element.id)) return;
    seen.set(element.id, element);
    if (element.type === 'group') element.children.forEach((id) => visit(scene.get(id)));
  };
  elements.forEach(visit);
  return [...seen.values()];
}

/**
 * Copy elements beside themselves. A group's children are copied with it and
 * the copy's children point at the copies. Returns the copies of the elements
 * asked for, not of their descendants.
 */
export function duplicate(scene: Scene, elements: SceneElement[]): SceneElement[] {
  const all = withDescendants(scene, elements).sort((a, b) => a.z - b.z);
  const copies = new Map<ElementId, SceneElement>();
  // Non-groups first, so every group's children have their new ids.
  const ordered = [...all.filter((e) => e.type !== 'group'), ...all.filter((e) => e.type === 'group')];
  for (const element of ordered) {
    const moved = { ...element, x: element.x + PASTE_OFFSET, y: element.y + PASTE_OFFSET };
    if (moved.type === 'group') {
      moved.children = moved.children.map((id) => copies.get(id)?.id ?? id);
    }
    copies.set(element.id, scene.add(moved));
  }
  // The copies refer to each other, never back to what they were copied from.
  remapReferences(scene, [...copies.values()], copies);
  return refreshed(
    scene,
    elements.map((e) => copies.get(e.id)).filter((e): e is SceneElement => Boolean(e)),
  );
}

/**
 * Mirror elements across the bounds of `selection`, in place. The axis is
 * where the elements are drawn, so a rotated one mirrors about what is on
 * screen, and its lean mirrors with it.
 */
export function flip(scene: Scene, selection: SceneElement[], axis: 'horizontal' | 'vertical'): void {
  const bounds = drawnBoundsOf(selection);
  for (const element of withDescendants(scene, selection)) {
    // A mirrored element leans the other way; which axis it was mirrored
    // across is already carried by the box.
    const angle = angleOfElement(element);
    const turned: Partial<SceneElement> = angle === 0 ? {} : ({ angle: normalise(360 - angle) } as Partial<SceneElement>);
    if (axis === 'horizontal') {
      const x = 2 * bounds.x + bounds.w - element.x - element.w;
      const points = 'points' in element ? element.points.map((v, i) => (i % 2 === 0 ? element.w - v : v)) : undefined;
      scene.update(element.id, { ...turned, x, ...(points ? { points } : {}) } as Partial<SceneElement>);
    } else {
      const y = 2 * bounds.y + bounds.h - element.y - element.h;
      const points = 'points' in element ? element.points.map((v, i) => (i % 2 === 1 ? element.h - v : v)) : undefined;
      scene.update(element.id, { ...turned, y, ...(points ? { points } : {}) } as Partial<SceneElement>);
    }
  }
}

/**
 * Move each selected element one step up (or down) the paint order, past its
 * nearest unselected neighbour. A run of selected elements moves together and
 * keeps its order. Returns the new order.
 */
export function stepOrder(ordered: SceneElement[], selected: Set<ElementId>, direction: 1 | -1): SceneElement[] {
  const list = [...ordered];
  const indices = list.map((_, i) => i);
  if (direction === 1) indices.reverse();
  for (const i of indices) {
    const j = i + direction;
    if (!selected.has(list[i].id) || j < 0 || j >= list.length || selected.has(list[j].id)) continue;
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/**
 * The selected units: selected elements that are not inside another selected
 * element's group. Select All picks a group and its children together; each
 * must still act once.
 */
export function topLevel(scene: Scene, elements: SceneElement[]): SceneElement[] {
  const selected = new Set(elements.map((e) => e.id));
  const parentOf = new Map<ElementId, ElementId>();
  for (const element of scene.ordered()) {
    if (element.type === 'group') element.children.forEach((child) => parentOf.set(child, element.id));
  }
  const hasSelectedAncestor = (id: ElementId): boolean => {
    let parent = parentOf.get(id);
    while (parent) {
      if (selected.has(parent)) return true;
      parent = parentOf.get(parent);
    }
    return false;
  };
  return elements.filter((e) => !hasSelectedAncestor(e.id));
}

/**
 * Paint order after stepping the selection one place, as the full element
 * list. Groups draw nothing, so they are never the neighbour stepped past; a
 * selected group moves as its children. Each group is placed just above its
 * last child, so clicking its area still finds the group first.
 */
export function steppedOrder(scene: Scene, selectedIds: ElementId[], direction: 1 | -1): SceneElement[] {
  const all = scene.ordered();
  const byId = new Map(all.map((e) => [e.id, e]));
  const selected = new Set(
    withDescendants(scene, selectedIds.map((id) => byId.get(id)).filter((e): e is SceneElement => Boolean(e)))
      .filter((e) => e.type !== 'group')
      .map((e) => e.id),
  );
  const visible = stepOrder(all.filter((e) => e.type !== 'group'), selected, direction);

  const groups = all.filter((e): e is Extract<SceneElement, { type: 'group' }> => e.type === 'group');
  const placed = new Set<ElementId>();
  const result: SceneElement[] = [];
  const allPlaced = (group: Extract<SceneElement, { type: 'group' }>): boolean =>
    group.children.every((child) => placed.has(child) || !byId.has(child));
  const placeReadyGroups = () => {
    let added = true;
    while (added) {
      added = false;
      for (const group of groups) {
        if (!placed.has(group.id) && allPlaced(group)) {
          placed.add(group.id);
          result.push(group);
          added = true;
        }
      }
    }
  };
  for (const element of visible) {
    placed.add(element.id);
    result.push(element);
    placeReadyGroups();
  }
  placeReadyGroups();
  return result;
}

