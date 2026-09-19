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

/** The style properties of `docs/file-format.md`, beyond the three colours. */
export type PropertyKey =
  | 'language'
  | 'strokeWidth'
  | 'strokeStyle'
  | 'edges'
  | 'opacity'
  | 'fontSize'
  | 'align'
  | 'verticalAlign'
  | 'arrowType'
  | 'startArrowhead'
  | 'endArrowhead';

export type PropertyValue = string | number;

/** Shapes drawn as polygons: their corners can round. Excalidraw rounds these. */
const ROUNDABLE = new Set(['rect', 'diamond', 'hexagon', 'parallelogram', 'line']);

const STROKE_KEYS: PropertyKey[] = ['strokeWidth', 'strokeStyle'];
const LABEL_KEYS: PropertyKey[] = ['fontSize', 'align', 'verticalAlign'];

/**
 * The property keys an element type takes, per `docs/file-format.md`. Every
 * element takes `opacity`; the rest follow what the element draws.
 */
export function propertyKeysFor(type: string): PropertyKey[] {
  const keys: PropertyKey[] = [];
  if (isShapeType(type)) keys.push(...STROKE_KEYS, ...LABEL_KEYS);
  switch (type) {
    case 'line':
    case 'stroke':
      keys.push(...STROKE_KEYS);
      break;
    case 'arrow':
      keys.push(...STROKE_KEYS, 'arrowType', 'startArrowhead', 'endArrowhead');
      break;
    case 'frame':
      keys.push(...STROKE_KEYS, ...LABEL_KEYS);
      break;
    case 'text':
      keys.push('fontSize', 'align');
      break;
    case 'code':
      // A code block's look comes from its language and the theme; the shape
      // controls would mean nothing on it (canvas-toolbar.md).
      keys.push('language');
      break;
    default:
      break;
  }
  if (ROUNDABLE.has(type)) keys.push('edges');
  keys.push('opacity');
  return keys;
}

/**
 * Set a property on every selected element that takes it, or clear it back to
 * the default with `null`. One undo step.
 */
export function applyProperty(
  history: History,
  ids: ElementId[],
  key: PropertyKey,
  value: PropertyValue | null,
): void {
  const selected = new Set(ids);
  history.mutate((draft) => {
    for (const element of draft.elements) {
      if (!selected.has(element.id) || !propertyKeysFor(element.type).includes(key)) continue;
      // The element's own types name each key; a generic setter writes through
      // a record view of the same object.
      const styled = element as unknown as Record<string, PropertyValue | undefined>;
      if (value === null) {
        if (key in styled) delete styled[key];
      } else if (styled[key] !== value) {
        styled[key] = value;
      }
    }
  });
}

/**
 * What a control should show for `key`: the value every applicable element
 * shares, `null` where they all use the default, `mixed` where they differ, or
 * `unavailable` when nothing selected takes the key.
 */
export function currentProperty(
  scene: SceneData,
  ids: ElementId[],
  key: PropertyKey,
): PropertyValue | null | 'mixed' | 'unavailable' {
  const selected = new Set(ids);
  const values = scene.elements
    .filter((e) => selected.has(e.id) && propertyKeysFor(e.type).includes(key))
    .map((e) => (e as unknown as Record<string, PropertyValue | undefined>)[key] ?? null);
  if (values.length === 0) return 'unavailable';
  return values.every((value) => value === values[0]) ? values[0] : 'mixed';
}


/**
 * What each property means when the key is absent, as `docs/file-format.md`
 * records it. `align` has no single default (centred in a shape, left in free
 * text) and is always written.
 */
export const PROPERTY_DEFAULTS: Partial<Record<PropertyKey, PropertyValue>> = {
  strokeWidth: 2,
  strokeStyle: 'solid',
  edges: 'sharp',
  opacity: 100,
  fontSize: 20,
  verticalAlign: 'middle',
  arrowType: 'straight',
  startArrowhead: 'none',
  endArrowhead: 'arrow',
};

/**
 * Apply a control's choice: the default clears the key, so an element the user
 * takes back to the default carries nothing, and a file stays as small as what
 * was actually chosen. One undo step.
 */
export function setProperty(history: History, ids: ElementId[], key: PropertyKey, value: PropertyValue): void {
  applyProperty(history, ids, key, value === PROPERTY_DEFAULTS[key] ? null : value);
}
