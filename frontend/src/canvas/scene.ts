/**
 * The scene: what is on the canvas, and where.
 *
 * Pure data and pure functions: no Konva, no DOM. The scene is the source of
 * truth for position: every element carries its own geometry and nothing
 * computes it. That is what makes the canvas free-placement rather than a
 * layout engine with a visual skin.
 *
 * This model is deliberately close to what Milestone 5 will persist, but it is
 * **not** the file format. The format is specified there, in
 * `docs/file-format.md`, before anything writes it.
 */

export type ElementId = string;

type Base = {
  id: ElementId;
  /** Paint order. Higher is nearer the viewer. */
  z: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

/**
 * Colours are a swatch name (`"blue"`) or a literal `#rrggbb`, resolved per
 * theme by `palette.ts`. An absent key means the theme's default; an unknown
 * value draws as the default and is kept.
 */
type Styled = { label?: string; fill?: string; stroke?: string; color?: string };

/**
 * The style properties of `docs/file-format.md`. Every one is optional, and an
 * unknown value draws as the default and is written back unchanged, so these
 * are typed loosely on purpose: the file is the contract, not this union.
 */
export type StyleProps = {
  strokeWidth?: number;
  strokeStyle?: string;
  edges?: string;
  opacity?: number;
  fontSize?: number;
  align?: string;
  verticalAlign?: string;
  locked?: boolean;
  /** Degrees, clockwise about the element's centre. */
  angle?: number;
  /** The id of the frame that owns this element, if any. */
  frame?: string;
};

/**
 * An arrow's routing, its ends, and what those ends are attached to. A binding
 * is the target's id: ids survive a move, coordinates do not. A binding whose
 * target is gone is kept and the endpoint freezes (`docs/file-format.md`).
 */
export type ArrowProps = {
  arrowType?: string;
  startArrowhead?: string;
  endArrowhead?: string;
  startBinding?: string;
  endBinding?: string;
};

/** The closed shapes: rectangle and ellipse, and the seven with outlines. */
export const SHAPE_TYPES = [
  'rect',
  'ellipse',
  'diamond',
  'cylinder',
  'hexagon',
  'parallelogram',
  'document',
  'person',
  'cloud',
] as const;

export type ShapeType = (typeof SHAPE_TYPES)[number];

export function isShapeType(type: string): type is ShapeType {
  return (SHAPE_TYPES as readonly string[]).includes(type);
}

export type ShapeElement = Base & Styled & StyleProps & { type: ShapeType };
export type RectElement = ShapeElement & { type: 'rect' };
export type EllipseElement = ShapeElement & { type: 'ellipse' };
/** `points` are relative to the element's `x` and `y`. */
export type LineElement = Base & StyleProps & { type: 'line'; points: number[]; stroke?: string };
export type ArrowElement = Base & StyleProps & ArrowProps & { type: 'arrow'; points: number[]; stroke?: string };
export type FrameElement = Base & StyleProps & { type: 'frame'; label?: string; stroke?: string; color?: string };
export type GroupElement = Base & StyleProps & { type: 'group'; label?: string; children: ElementId[] };
export type StrokeElement = Base & StyleProps & { type: 'stroke'; points: number[]; stroke?: string };

export type TextElement = Base & StyleProps & {
  type: 'text';
  text: string;
  color?: string;
  /**
   * Measured in the frontend and stored, never recomputed on open.
   * WebKitGTK and WebView2 disagree on glyph advances, so re-measuring
   * elsewhere would reflow the scene.
   */
  measuredWidth: number;
  measuredHeight: number;
};

/**
 * A block of code, highlighted in the language it names.
 *
 * Its size comes from its code (`docs/file-format.md`), so `w`/`h` and the
 * measurement are recomputed on every edit rather than dragged. An unknown
 * `language` is kept and drawn as plain text: the file said it for a reason.
 */
export type CodeElement = Base & StyleProps & {
  type: 'code';
  code: string;
  language?: string;
  measuredWidth: number;
  measuredHeight: number;
};

export type SceneElement =
  | ShapeElement
  | LineElement
  | ArrowElement
  | FrameElement
  | GroupElement
  | StrokeElement
  | TextElement
  | CodeElement;

/**
 * Omit applied across a union rather than to the union as a whole.
 *
 * A plain `Omit<SceneElement, 'id' | 'z'>` collapses to the keys every member
 * shares, so it silently rejects `text`, `line`, `group` and every other
 * element with fields of its own.
 */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type NewElement = DistributiveOmit<SceneElement, 'id' | 'z'>;

/** Whether an element is locked: not selectable, not editable, still drawn. */
export function isLocked(element: { locked?: boolean }): boolean {
  return element.locked === true;
}

export type SceneData = {
  elements: SceneElement[];
};

let counter = 0;

/** Ids are unique within a session; Milestone 5 decides what persists. */
function nextId(): ElementId {
  counter += 1;
  return `e${counter}`;
}

export function createScene(initial: SceneData = { elements: [] }) {
  const byId = new Map<ElementId, SceneElement>(initial.elements.map((e) => [e.id, e]));
  let nextZ = initial.elements.reduce((max, e) => Math.max(max, e.z), 0);

  function ordered(): SceneElement[] {
    return [...byId.values()].sort((a, b) => a.z - b.z);
  }

  return {
    add(element: NewElement): SceneElement {
      nextZ += 1;
      // Skip ids the scene already holds: an opened file has its own "e1".
      let id = nextId();
      while (byId.has(id)) id = nextId();
      const created = { ...element, id, z: nextZ } as SceneElement;
      byId.set(created.id, created);
      return created;
    },

    remove(id: ElementId): void {
      byId.delete(id);
    },

    get(id: ElementId): SceneElement | undefined {
      return byId.get(id);
    },

    update(id: ElementId, changes: Partial<SceneElement>): void {
      const existing = byId.get(id);
      if (!existing) return;
      byId.set(id, { ...existing, ...changes, id: existing.id } as SceneElement);
    },

    ordered,

    bringToFront(id: ElementId): void {
      const element = byId.get(id);
      if (!element) return;
      nextZ += 1;
      byId.set(id, { ...element, z: nextZ });
    },

    sendToBack(id: ElementId): void {
      const element = byId.get(id);
      if (!element) return;
      const lowest = Math.min(...[...byId.values()].map((e) => e.z));
      byId.set(id, { ...element, z: lowest - 1 });
    },

    /** Paint order, not insertion order, so the result is stable. */
    data(): SceneData {
      return { elements: ordered() };
    },

    serialise(): string {
      return JSON.stringify(this.data());
    },
  };
}

export type Scene = ReturnType<typeof createScene>;
