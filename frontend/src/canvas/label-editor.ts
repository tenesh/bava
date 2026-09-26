/**
 * Typing a shape's label or a text element's text.
 *
 * The commit policy is pure functions over history, one step per edit. The
 * editor itself is a textarea placed over the element: plain DOM, created and
 * removed imperatively like the stage, never a Svelte component per element.
 * While it has focus, canvas keys stand down, because `editTarget` treats a
 * textarea as a field.
 */
import type { History } from './history';
import type { ElementId, SceneData, SceneElement } from './scene';
import { isLocked, isShapeType } from './scene';
import { containsPoint } from './rotate';
import { nearElement } from './hit';
import type { TextPaint } from './paint';

import type { Point } from './viewport';

/** Set or clear a shape's label, as one undo step. */
export function commitLabel(history: History, id: ElementId, value: string): void {
  const label = value.trim();
  history.mutate((draft) => {
    const element = draft.elements.find((e) => e.id === id) as (SceneElement & { label?: string }) | undefined;
    if (!element) return;
    if (label) {
      if (element.label !== label) element.label = label;
    } else if ('label' in element) {
      delete element.label;
    }
  });
}

/**
 * Set a text element's text and its measured size, as one undo step. The size
 * is measured here and stored, never recomputed on open. An emptied text
 * element is deleted: nothing could see or select it.
 */
export function commitText(
  history: History,
  id: ElementId,
  value: string,
  measure: (text: string) => { width: number; height: number },
): void {
  history.mutate((draft) => {
    const index = draft.elements.findIndex((e) => e.id === id);
    if (index < 0) return;
    if (!value.trim()) {
      draft.elements.splice(index, 1);
      return;
    }
    const element = draft.elements[index] as SceneElement & { text: string; measuredWidth: number; measuredHeight: number };
    if (element.text === value) return;
    const size = measure(value);
    element.text = value;
    element.measuredWidth = size.width;
    element.measuredHeight = size.height;
    element.w = size.width;
    element.h = size.height;
  });
}

/**
 * The topmost shape, frame or text element under a point, which can be typed
 * into. `lineTolerance` is how near an arrow counts, in scene units: the caller
 * divides `--size-hit-tolerance` by the zoom, as the pointer handler does.
 */
export function editableAt(scene: SceneData, point: Point, lineTolerance: number): SceneElement | undefined {
  const hits = scene.elements.filter((e) => {
    if (isLocked(e)) return false;
    // An arrow carries a label too, and is typed on where it is drawn: its
    // box is mostly empty space.
    if (e.type === 'arrow') return nearElement(e, point, lineTolerance);
    if (!(isShapeType(e.type) || e.type === 'text' || e.type === 'frame' || e.type === 'code')) return false;
    // Where the element is drawn, rotation included: the field opens on the
    // shape the user double-clicked, not on the box it is stored as.
    return containsPoint(e, point);
  });
  return hits[hits.length - 1];
}

/**
 * Place typed text at a point, measured, as one undo step. Nothing is recorded
 * for empty text, so placing text and changing your mind leaves no trace and
 * undo can never uncover an invisible element. Returns the new id, or null.
 */
export function insertText(
  history: History,
  point: Point,
  value: string,
  measure: (text: string) => { width: number; height: number },
): ElementId | null {
  if (!value.trim()) return null;
  const id = `t${history.current.elements.length + 1}-${Math.random().toString(36).slice(2, 8)}`;
  const size = measure(value);
  history.mutate((draft) => {
    draft.elements.push({
      id,
      type: 'text',
      x: point.x,
      y: point.y,
      w: size.width,
      h: size.height,
      // Above everything: count + 1 repeats a z once anything was deleted.
      z: draft.elements.reduce((max, e) => Math.max(max, e.z), 0) + 1,
      text: value,
      measuredWidth: size.width,
      measuredHeight: size.height,
    } as SceneElement);
  });
  return id;
}

export type EditorRequest = {
  value: string;
  /** Free text reads left to right; a shape's label is centred. */
  align?: 'left' | 'center';
  /** Where the element is on screen, relative to the host. */
  rect: { x: number; y: number; width: number; height: number };
  /** The element's angle, so the field sits on a rotated shape. */
  angle?: number;
  /**
   * The on-screen size of a value, for free text: the field grows to it as the
   * user types. Omitted for a label, which keeps its shape's box.
   */
  measure?: (value: string) => { width: number; height: number };
  /**
   * How the text is drawn (`paintFor(element).font`), so the field looks like
   * it. Omitted, the stylesheet's defaults apply.
   */
  font?: TextPaint;
  /** The element's opacity, 0 to 1. */
  opacity?: number;
  /** The view's zoom: the font is scaled by it, as the drawn text is. */
  zoom?: number;
  /**
   * The on-screen height of a value once wrapped, for a label placed by its
   * vertical alignment: the field is pushed down by the free space, as the
   * stage places the text.
   */
  textHeight?: (value: string) => number;
  onCommit: (value: string) => void;
};

/**
 * The box a label is drawn in, in scene units, as the stage lays it out: inset
 * from the sides of a shape, and from every edge of a frame. Free text has its
 * own box. The field covers this box, so its text wraps and sits where the
 * stage will draw it.
 */
export function labelBox(element: SceneElement, inset: number): { x: number; y: number; w: number; h: number } {
  if (element.type === 'text' || element.type === 'arrow') return { x: element.x, y: element.y, w: element.w, h: element.h };
  const w = Math.max(0, element.w - inset * 2);
  if (element.type === 'frame') return { x: element.x + inset, y: element.y + inset, w, h: Math.max(0, element.h - inset * 2) };
  return { x: element.x + inset, y: element.y, w, h: element.h };
}

export class LabelEditor {
  #host: HTMLElement;
  #field: HTMLTextAreaElement | null = null;
  #commit: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.#host = host;
  }

  get isOpen(): boolean {
    return this.#field !== null;
  }

  /** Whether an event started inside the editor, which the canvas must ignore. */
  contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.#field !== null && this.#field.contains(target);
  }

  open(request: EditorRequest): void {
    // Anything typed into an editor still open is kept, not dropped.
    this.commit();
    const field = document.createElement('textarea');
    field.className = 'bava-label-editor';
    const { font } = request;
    field.style.textAlign = font?.align ?? request.align ?? 'center';
    field.value = request.value;
    if (font) {
      // The drawn text's own style, scaled as the stage scales it, so typing
      // looks like the result.
      const zoom = request.zoom ?? 1;
      Object.assign(field.style, {
        fontFamily: font.family,
        fontSize: `${font.size * zoom}px`,
        lineHeight: String(font.lineHeight),
        color: font.colour,
      });
    }
    if (request.opacity !== undefined) field.style.opacity = String(request.opacity);
    // Free text grows to its lines; a label wraps inside its box, as drawn.
    field.style.whiteSpace = request.measure ? 'pre' : 'pre-wrap';
    // Position and size are the element's, in screen units, set inline because
    // they change with every element; the minimum size is a token in the
    // stylesheet.
    Object.assign(field.style, {
      left: `${request.rect.x}px`,
      top: `${request.rect.y}px`,
      width: `${request.rect.width}px`,
      height: `${request.rect.height}px`,
      // The field turns with the element, about the same centre the stage
      // turns the shape about, so typing happens on the shape.
      transform: request.angle ? `rotate(${request.angle}deg)` : '',
    });

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const value = field.value;
      this.#field = null;
      this.#commit = null;
      field.remove();
      request.onCommit(value);
    };
    field.addEventListener('keydown', (event) => {
      // Escape, or Cmd/Ctrl+Enter, commits; plain Enter is a new line. Enter
      // that confirms a character being composed (an input method) is not.
      if (event.isComposing) {
        event.stopPropagation();
        return;
      }
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        commit();
      }
      // The canvas must not see keys typed here.
      event.stopPropagation();
    });
    field.addEventListener('blur', commit);
    const { textHeight } = request;
    if (textHeight) {
      // The stage places a label by its vertical alignment; the field does it
      // with the free space above the text, recomputed as lines come and go.
      const place = () => {
        const free = Math.max(0, request.rect.height - textHeight(field.value));
        const align = font?.verticalAlign ?? 'middle';
        field.style.paddingTop = `${align === 'top' ? 0 : align === 'bottom' ? free : free / 2}px`;
      };
      place();
      field.addEventListener('input', place);
    }
    const { measure } = request;
    if (measure) {
      // The stylesheet's minimum size still applies below the measurement.
      field.addEventListener('input', () => {
        const size = measure(field.value);
        field.style.width = `${size.width}px`;
        field.style.height = `${size.height}px`;
      });
    }

    this.#host.append(field);
    this.#field = field;
    this.#commit = commit;
    field.focus();
    field.select();
  }

  /** Commit and close an open editor, if there is one. */
  commit(): void {
    this.#commit?.();
  }

  destroy(): void {
    this.commit();
  }
}
