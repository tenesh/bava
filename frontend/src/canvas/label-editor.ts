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
import { isShapeType } from './scene';
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

/** The topmost shape, frame or text element under a point, which can be typed into. */
export function editableAt(scene: SceneData, point: Point): SceneElement | undefined {
  const hits = scene.elements.filter(
    (e) =>
      (isShapeType(e.type) || e.type === 'text' || e.type === 'frame') &&
      point.x >= e.x &&
      point.x <= e.x + e.w &&
      point.y >= e.y &&
      point.y <= e.y + e.h,
  );
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
  /**
   * The on-screen size of a value, for free text: the field grows to it as the
   * user types. Omitted for a label, which keeps its shape's box.
   */
  measure?: (value: string) => { width: number; height: number };
  onCommit: (value: string) => void;
};

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
    field.dataset.align = request.align ?? 'center';
    field.value = request.value;
    // Position and size are the element's, in screen units, set inline because
    // they change with every element; the minimum size is a token in the
    // stylesheet.
    Object.assign(field.style, {
      left: `${request.rect.x}px`,
      top: `${request.rect.y}px`,
      width: `${request.rect.width}px`,
      height: `${request.rect.height}px`,
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
      // Escape, or Cmd/Ctrl+Enter, commits; plain Enter is a new line.
      if (event.key === 'Escape' || (event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        commit();
      }
      // The canvas must not see keys typed here.
      event.stopPropagation();
    });
    field.addEventListener('blur', commit);
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
