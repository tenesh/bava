/**
 * Recolouring a selection.
 *
 * Pure policy over history: which element types take which colour, what a
 * selection currently shows, and applying a swatch as one undo step.
 */
import type { History } from './history';
import type { ElementId, SceneData, SceneElement } from './scene';
import { isShapeType } from './scene';
import { anchorFor, BINDING_REACH_MIN, drawnPoints } from './binding';
import { angleOfElement } from './rotate';
import { tidy } from './resize';
import { PROPERTY_DEFAULTS } from './style-defaults';

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
 * The colour keys an element takes: its type's, and a fill on a closed line
 * (`docs/file-format.md`, "Lines, arrows and strokes").
 */
export function styleKeysOf(element: SceneElement): StyleKey[] {
  const keys = styleKeysFor(element.type);
  return element.type === 'line' && (element as { closed?: boolean }).closed === true ? ['fill', ...keys] : keys;
}

/**
 * Set `key` to a swatch on every selected element that takes it, or clear it
 * back to the theme default with `null`. One undo step.
 */
export function applyStyle(history: History, ids: ElementId[], key: StyleKey, swatch: string | null): void {
  const selected = new Set(ids);
  history.mutate((draft) => {
    for (const element of draft.elements) {
      if (!selected.has(element.id) || !styleKeysOf(element).includes(key)) continue;
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
    .filter((e) => selected.has(e.id) && styleKeysOf(e).includes(key))
    .map((e) => (e as typeof e & Partial<Record<StyleKey, string>>)[key] ?? null);
  if (values.length === 0) return 'unavailable';
  return values.every((value) => value === values[0]) ? values[0] : 'mixed';
}

/** A copied style: each key the source takes, `null` where it used the default. */
export type CopiedStyle = Partial<Record<StyleKey | PropertyKey, string | number | null>>;

/** Keys Copy Styles leaves behind: an arrow's kind and a code block's language are its own. */
const NOT_A_STYLE: PropertyKey[] = ['arrowType', 'language'];

/**
 * The style of one element, for Paste Styles: its colours, and the other
 * style keys it takes (width, line style, opacity, edges, text size and
 * alignment, an arrow's heads), as Excalidraw's `actionStyles.ts:118-186`.
 */
export function copyStyle(element: SceneElement): CopiedStyle {
  const styled = element as unknown as Record<string, string | number | undefined>;
  const keys = [...styleKeysOf(element), ...propertyKeysFor(element.type).filter((key) => !NOT_A_STYLE.includes(key))];
  return Object.fromEntries(keys.map((key) => [key, styled[key] ?? null]));
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
      const styled = element as unknown as Record<string, string | number | undefined>;
      const keys = [...styleKeysOf(element), ...propertyKeysFor(element.type).filter((key) => !NOT_A_STYLE.includes(key))];
      for (const key of keys) {
        if (!(key in style)) continue;
        const value = style[key as keyof CopiedStyle];
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
      // The kind picker turns a line into an arrow (06.16, X11).
      keys.push(...STROKE_KEYS, 'arrowType');
      break;
    case 'stroke':
      keys.push(...STROKE_KEYS);
      break;
    case 'arrow':
      // A label's size too (06.16, L8).
      keys.push(...STROKE_KEYS, 'arrowType', 'startArrowhead', 'endArrowhead', 'fontSize');
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
      // A line and an arrow turn into each other through the kind picker
      // (Excalidraw's `ConvertElementTypePopup.tsx:529-601`), points kept.
      if (key === 'arrowType' && (element.type === 'line' || element.type === 'arrow')) {
        const kind = value ?? 'straight';
        const record = element as unknown as Record<string, unknown>;
        if (element.type === 'arrow' && kind === 'line') {
          const curved = record.arrowType === 'arc';
          record.type = 'line';
          // A line has no ends that attach, no heads and no label: nothing of
          // them is left hidden in the file (undo brings them back).
          for (const gone of ['arrowType', 'startBinding', 'endBinding', 'startAnchor', 'endAnchor', 'startMode', 'endMode', 'startArrowhead', 'endArrowhead', 'fixedSegments', 'label', 'labelPosition', 'fontSize']) delete record[gone];
          if (curved) record.edges = 'round';
          continue;
        }
        if (element.type === 'line') {
          if (kind === 'line') continue;
          record.type = 'arrow';
          for (const gone of ['edges', 'closed', 'fill']) delete record[gone];
        }
      }
      // Switching kinds as Excalidraw does (`actionProperties.tsx:2077-2221`):
      // only the ends are kept, where they are drawn, and each attached end
      // is attached again there by the new kind's rule. Becoming an elbow, the
      // arrow loses its turn and `reroute` routes it; an elbow end is never
      // pinned inside (`docs/file-format.md`). Fixed segments belong to one
      // route, and go with it.
      const switching = key === 'arrowType' && element.type === 'arrow' && 'points' in element && (value === 'elbow') !== (styled.arrowType === 'elbow');
      if (switching) {
        const toElbow = value === 'elbow';
        const drawn = drawnPoints(element);
        const ends = [
          { x: drawn[0], y: drawn[1] },
          { x: drawn[drawn.length - 2], y: drawn[drawn.length - 1] },
        ];
        const record = element as unknown as Record<string, unknown>;
        if (toElbow) {
          delete record.angle;
          delete record.startMode;
          delete record.endMode;
        }
        // Without its turn, the ends are written where they were drawn.
        const turned = !toElbow && angleOfElement(element) !== 0;
        if (!turned) element.points = ends.flatMap((p) => [tidy(p.x - element.x), tidy(p.y - element.y)]);
        else {
          const points = element.points as number[];
          element.points = [points[0], points[1], points[points.length - 2], points[points.length - 1]];
        }
        delete record.fixedSegments;
        (['start', 'end'] as const).forEach((side, i) => {
          const id = record[`${side}Binding`];
          const shape = draft.elements.find((e) => e.id === id);
          if (!shape) return;
          const inside = !toElbow && record[`${side}Mode`] === 'inside';
          record[`${side}Anchor`] = anchorFor(shape, ends[i], BINDING_REACH_MIN, inside, toElbow, ends[1 - i]);
        });
      }
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
    // A line's kind is Line (06.16, X11).
    .map((e) => (key === 'arrowType' && e.type === 'line' ? 'line' : ((e as unknown as Record<string, PropertyValue | undefined>)[key] ?? null)));
  if (values.length === 0) return 'unavailable';
  return values.every((value) => value === values[0]) ? values[0] : 'mixed';
}


export { PROPERTY_DEFAULTS } from './style-defaults';

/**
 * Apply a control's choice: the default clears the key, so an element the user
 * takes back to the default carries nothing, and a file stays as small as what
 * was actually chosen. One undo step.
 */
export function setProperty(history: History, ids: ElementId[], key: PropertyKey, value: PropertyValue): void {
  applyProperty(history, ids, key, value === PROPERTY_DEFAULTS[key] ? null : value);
}
