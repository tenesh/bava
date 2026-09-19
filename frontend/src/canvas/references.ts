/**
 * The ids an element points at, and how to rewrite them.
 *
 * Three things in a scene are references: an arrow's two bindings, an
 * element's frame, and a group's children. Anything that gives elements new
 * ids (copy, paste, an inserted diagram) has to rewrite all four, or a copy
 * quietly points back at the original and moving one drags the other.
 *
 * One list, in one place, because this logic had already been written twice
 * and both copies forgot `children`.
 */
import type { ElementId, SceneElement } from './scene';

/** The keys that hold a single id. */
export const REFERENCE_KEYS = ['startBinding', 'endBinding', 'frame'] as const;

type Referring = SceneElement & {
  startBinding?: string;
  endBinding?: string;
  frame?: string;
  children?: string[];
};

/**
 * `elements` with every reference to a renamed id rewritten.
 *
 * A reference to something that was not renamed is left alone: it still
 * exists, and the element still means it. Returns the same array when nothing
 * was renamed, so a caller can skip the work.
 */
export function remapReferences(elements: SceneElement[], renamed: Map<ElementId, ElementId>): SceneElement[] {
  if (renamed.size === 0) return elements;

  return elements.map((element) => {
    const referring = element as Referring;
    const updates: Record<string, unknown> = {};

    for (const key of REFERENCE_KEYS) {
      const value = referring[key];
      const replacement = value === undefined ? undefined : renamed.get(value);
      if (replacement) updates[key] = replacement;
    }
    if (referring.children) {
      const children = referring.children.map((child) => renamed.get(child) ?? child);
      if (children.some((child, i) => child !== referring.children![i])) updates.children = children;
    }

    return Object.keys(updates).length === 0 ? element : ({ ...element, ...updates } as SceneElement);
  });
}
