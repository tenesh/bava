/**
 * Frames that own what is dropped into them.
 *
 * Membership lives on the child, as `frame`: an element can only ever be in
 * one frame, and there is one place to look (`docs/file-format.md`). Dropping
 * an element wholly inside a frame adds it; dragging it out removes it;
 * moving the frame moves everything that records it.
 *
 * Pure over scene data, so the rules are testable without a stage.
 */
import { rotatedBounds } from './rotate';
import { createScene, type ElementId, type SceneData, type SceneElement } from './scene';
import { withDescendants } from './edit';

/** Whether `inner` lies entirely within `outer`, as both are drawn. */
function within(inner: SceneElement, outer: SceneElement): boolean {
  const a = rotatedBounds(inner);
  const b = rotatedBounds(outer);
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

/**
 * The frame an element belongs in by where it is: the smallest frame that
 * covers it entirely. Half inside is not inside, or dragging a frame would
 * carry off whatever merely overlapped its edge.
 */
export function frameAt(scene: SceneData, element: SceneElement): SceneElement | undefined {
  if (element.type === 'frame') return undefined;
  const holders = scene.elements.filter((other) => other.type === 'frame' && other.id !== element.id && within(element, other));
  // The innermost, so a frame inside a frame wins over the one around it.
  return holders.sort((a, b) => a.w * a.h - b.w * b.h)[0];
}

/** The elements that record `frame` as their owner. */
export function framedBy(scene: SceneData, frame: ElementId): SceneElement[] {
  return scene.elements.filter((element) => (element as { frame?: string }).frame === frame);
}

/**
 * The membership changes `ids` need after a move: the frame each should now
 * record, or `undefined` where it should record none. Elements whose
 * membership is unchanged are left out, so a caller writes nothing for them.
 *
 * Only the elements that moved are considered. A frame dragged across the
 * canvas does not adopt what it passes over: the user moved the frame, not
 * the shapes.
 */
export function membershipFor(scene: SceneData, ids: ElementId[]): Map<ElementId, ElementId | undefined> {
  const changes = new Map<ElementId, ElementId | undefined>();
  for (const id of ids) {
    const element = scene.elements.find((e) => e.id === id);
    if (!element || element.type === 'frame') continue;
    const current = (element as { frame?: string }).frame;
    const next = frameAt(scene, element)?.id;
    if (current !== next) changes.set(id, next);
  }
  return changes;
}

/** Apply membership changes to a scene, in place. */
export function applyMembership(scene: SceneData, changes: Map<ElementId, ElementId | undefined>): void {
  if (changes.size === 0) return;
  for (const element of scene.elements) {
    if (!changes.has(element.id)) continue;
    const next = changes.get(element.id);
    const framed = element as SceneElement & { frame?: string };
    if (next === undefined) delete framed.frame;
    else framed.frame = next;
  }
}

/**
 * The elements whose geometry a change touched, and the ones it added.
 *
 * Membership is recomputed for these alone: recomputing for everything would
 * let a frame dragged across the canvas adopt whatever it passed over, and
 * recomputing only for what a drag carried would miss a resize, a nudge, an
 * align or a paste.
 */
export function movedIds(before: SceneData, after: SceneData): ElementId[] {
  const was = new Map(before.elements.map((element) => [element.id, element]));
  return after.elements
    .filter((element) => {
      const previous = was.get(element.id);
      if (!previous) return true;
      return (
        previous.x !== element.x ||
        previous.y !== element.y ||
        previous.w !== element.w ||
        previous.h !== element.h ||
        (previous as { angle?: number }).angle !== (element as { angle?: number }).angle
      );
    })
    .map((element) => element.id);
}

/**
 * Clear the `frame` of anything that belonged to one of `removed`.
 *
 * A deleted or erased frame keeps its contents: deleting a container must not
 * delete work the user did not select (`docs/file-format.md`). They stop
 * claiming a frame that is no longer there, which a binding does not do,
 * because a binding is specified to be kept and a membership is not.
 */
export function releaseFrames(scene: SceneData, removed: Set<ElementId>): void {
  for (const element of scene.elements) {
    const framed = element as SceneElement & { frame?: string };
    if (framed.frame !== undefined && removed.has(framed.frame)) delete framed.frame;
  }
}

/**
 * Everything a move of `ids` carries: the elements themselves, a group's
 * children, and a frame's contents.
 *
 * One expansion for every way of moving a selection, so dragging a frame and
 * nudging it with the arrow keys agree about what comes along.
 */
export function carriedWith(scene: SceneData, ids: ElementId[]): SceneElement[] {
  const chosen = scene.elements.filter((element) => ids.includes(element.id));
  const carried = new Map(withDescendants(createScene(scene), chosen).map((element) => [element.id, element]));

  // A queue, not one pass: a frame inside a frame carries its own contents,
  // and a converted diagram nests as deeply as the D2 it came from. The map
  // de-duplicates, so a frame that somehow records itself cannot loop.
  const queue = [...carried.values()];
  while (queue.length > 0) {
    const element = queue.shift()!;
    if (element.type !== 'frame') continue;
    for (const member of framedBy(scene, element.id)) {
      if (carried.has(member.id)) continue;
      carried.set(member.id, member);
      queue.push(member);
    }
  }
  return [...carried.values()];
}
