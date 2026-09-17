/**
 * Recolouring a selection.
 *
 * Pure policy over history: which element types take which colour, what a
 * selection currently shows, and applying a swatch as one undo step.
 */
import type { History } from './history';
import type { ElementId, SceneData, SceneElement } from './scene';
import { isShapeType } from './scene';

export type StyleKey = 'fill' | 'stroke' | 'color';

/** The colour keys an element type takes, per `docs/file-format.md`. */
export function styleKeysFor(type: string): StyleKey[] {
  if (isShapeType(type)) return ['fill', 'stroke', 'color'];
  switch (type) {
    case 'line':
    case 'arrow':
    case 'stroke':
      return ['stroke'];
    case 'frame':
      return ['stroke', 'color'];
    case 'text':
      return ['color'];
    default:
      return [];
  }
}

/**
 * Set `key` to a swatch on every selected element that takes it, or clear it
 * back to the theme default with `null`. One undo step.
 */
export function applyStyle(history: History, ids: ElementId[], key: StyleKey, swatch: string | null): void {
  const selected = new Set(ids);
  history.mutate((draft) => {
    for (const element of draft.elements) {
      if (!selected.has(element.id) || !styleKeysFor(element.type).includes(key)) continue;
      const styled = element as typeof element & Partial<Record<StyleKey, string>>;
      if (swatch === null) {
        if (key in styled) delete styled[key];
      } else if (styled[key] !== swatch) {
        styled[key] = swatch;
      }
    }
  });
}

/**
 * What the picker should show for `key`: the swatch every applicable element
 * shares, `null` when they all use the default, `mixed` when they differ, or
 * `unavailable` when nothing selected takes the key.
 */
export function currentStyle(scene: SceneData, ids: ElementId[], key: StyleKey): string | null | 'mixed' | 'unavailable' {
  const selected = new Set(ids);
  const values = scene.elements
    .filter((e) => selected.has(e.id) && styleKeysFor(e.type).includes(key))
    .map((e) => (e as typeof e & Partial<Record<StyleKey, string>>)[key] ?? null);
  if (values.length === 0) return 'unavailable';
  return values.every((value) => value === values[0]) ? values[0] : 'mixed';
}

/** A copied style: each key the source takes, `null` where it used the default. */
export type CopiedStyle = Partial<Record<StyleKey, string | null>>;

/** The style of one element, for Paste Styles. */
export function copyStyle(element: SceneElement): CopiedStyle {
  const styled = element as SceneElement & Partial<Record<StyleKey, string>>;
  return Object.fromEntries(styleKeysFor(element.type).map((key) => [key, styled[key] ?? null]));
}

/**
 * Apply a copied style to every selected element: each copied key it takes is
 * set, or cleared back to the default. One undo step.
 */
export function pasteStyle(history: History, ids: ElementId[], style: CopiedStyle): void {
  const selected = new Set(ids);
  history.mutate((draft) => {
    for (const element of draft.elements) {
      if (!selected.has(element.id)) continue;
      const styled = element as typeof element & Partial<Record<StyleKey, string>>;
      for (const key of styleKeysFor(element.type)) {
        if (!(key in style)) continue;
        const value = style[key];
        if (value === null || value === undefined) {
          if (key in styled) delete styled[key];
        } else if (styled[key] !== value) {
          styled[key] = value;
        }
      }
    }
  });
}

