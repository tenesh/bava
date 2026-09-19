/**
 * A D2 layout, converted into ordinary canvas elements.
 *
 * D2 lays the diagram out once and Bava takes the geometry; from then on the
 * shapes *are* the diagram, and the source is not kept
 * (`diagrams-as-shapes.md`). Nothing marks an element as generated, because
 * from the moment it lands it is not: it moves, restyles, connects and
 * deletes like anything drawn by hand.
 *
 * Pure: geometry in, elements out. No IPC, no Konva, no history, so the
 * mapping is testable against a fixture taken from the real pipeline.
 */
import { canvasShapeFor } from './shapes';
import type {
  LayoutConnection as WireConnection,
  LayoutShape as WireShape,
} from '../../../bindings/github.com/tenesh/bava/internal/render/models';
import type { ElementId, SceneElement } from '../scene';

/**
 * The layout, as the converter needs it.
 *
 * The wire types are the generated ones: one definition of the contract, and
 * the ipc layer owns it. Wails types the lists as nullable, which the client
 * normalises away before anything here sees them, so these are the same types
 * with the lists present.
 */
export type LayoutShape = WireShape;
export type LayoutConnection = WireConnection;
export type Layout = { shapes: LayoutShape[]; connections: LayoutConnection[] };

export type ConvertOptions = {
  /** Where the diagram's centre should land, in scene coordinates. */
  at: { x: number; y: number };
};

/**
 * Every arrowhead D2 v0.9.0 can produce, as Bava's file format spells it.
 *
 * Taken from `d2target`'s own constants, not from memory: a name that does not
 * match is not an error anywhere, the head simply becomes the default. The
 * test beside this holds the list to the pinned version, so a bump fails
 * loudly rather than quietly dropping a head.
 *
 * Filled and unfilled are different drawings and stay different. The
 * crow's-foot heads have no Bava drawing yet: "one" is a bar across the line
 * and "many" keeps the arrow, which is what those notations mean.
 */
export const D2_ARROWHEADS: Record<string, string> = {
  none: 'none',
  arrow: 'arrow',
  triangle: 'triangle',
  'unfilled-triangle': 'triangle-outline',
  diamond: 'diamond-outline',
  'filled-diamond': 'diamond',
  circle: 'circle-outline',
  'filled-circle': 'circle',
  cross: 'bar',
  box: 'diamond-outline',
  'filled-box': 'diamond',
  line: 'bar',
  'cf-one': 'bar',
  'cf-many': 'arrow',
  'cf-one-required': 'bar',
  'cf-many-required': 'arrow',
};

/** The Bava head for a D2 one, or `fallback` for a name this build predates. */
export function arrowheadFor(name: string | undefined, fallback: string): string {
  return name === undefined ? fallback : (D2_ARROWHEADS[name] ?? fallback);
}

/**
 * How many connections name an endpoint that is not a shape.
 *
 * D2 features Bava cannot place yet do this: a sequence diagram's lifelines
 * end at ids that never appear among the shapes. The caller says so rather
 * than the user finding stray half-attached lines in their canvas.
 */
export function unplaceable(layout: Layout): number {
  const shapes = new Set(layout.shapes.map((shape) => shape.id));
  return layout.connections.filter((connection) => !shapes.has(connection.src) || !shapes.has(connection.dst)).length;
}

/** A shape that holds others becomes a frame, which owns what it holds. */
function isContainer(shape: LayoutShape, layout: Layout): boolean {
  return layout.shapes.some((other) => other.parent === shape.id);
}

/**
 * The layout as elements, centred on `at`.
 *
 * Ids are Bava's own: D2's are absolute paths into a source that is about to
 * be thrown away, and an element id has to be unique in the file rather than
 * in one diagram. Bindings and frame membership are rewritten to the new ids
 * as they are built.
 */
export function toElements(layout: Layout, options: ConvertOptions): SceneElement[] {
  if (layout.shapes.length === 0 && layout.connections.length === 0) return [];

  const offset = centringOffset(layout, options.at);
  const ids = new Map<string, ElementId>();
  let next = 0;
  const idFor = (d2Id: string): ElementId => {
    const existing = ids.get(d2Id);
    if (existing) return existing;
    next += 1;
    const id = `d${next}-${Math.random().toString(36).slice(2, 8)}`;
    ids.set(d2Id, id);
    return id;
  };

  // Containers first, so they paint behind what they hold.
  const ordered = [...layout.shapes].sort((a, b) => Number(isContainer(b, layout)) - Number(isContainer(a, layout)));
  let z = 0;
  const elements: SceneElement[] = ordered.map((shape) => {
    z += 1;
    const container = isContainer(shape, layout);
    return {
      id: idFor(shape.id),
      type: container ? 'frame' : canvasShapeFor(shape.type),
      x: shape.x + offset.x,
      y: shape.y + offset.y,
      w: shape.w,
      h: shape.h,
      z,
      ...(shape.label ? { label: shape.label } : {}),
      ...(shape.parent ? { frame: idFor(shape.parent) } : {}),
    } as SceneElement;
  });

  const shapeIds = new Set(layout.shapes.map((shape) => shape.id));
  for (const connection of layout.connections) {
    // Both ends have to be shapes. An arrow attached at one end only, running
    // off to a lifeline that was never placed, is not something the user drew
    // and not something they can explain.
    if (!shapeIds.has(connection.src) || !shapeIds.has(connection.dst)) continue;
    z += 1;
    // Wails types the route as nullable; a connection without one is not one
    // this canvas can draw.
    const points = (connection.route ?? []).map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
    if (points.length < 2) continue;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    elements.push({
      id: idFor(connection.id),
      type: 'arrow',
      x,
      y,
      w: Math.max(...xs) - x,
      h: Math.max(...ys) - y,
      z,
      points: points.flatMap((point) => [point.x - x, point.y - y]),
      startArrowhead: arrowheadFor(connection.srcArrow, 'none'),
      endArrowhead: arrowheadFor(connection.dstArrow, 'arrow'),
      // Attached from the start, so the first move of a box takes its arrows
      // with it. This is what makes a generated diagram survive being edited.
      startBinding: idFor(connection.src),
      endBinding: idFor(connection.dst),
      ...(connection.label ? { label: connection.label } : {}),
    } as SceneElement);
  }

  return elements;
}

/** How far to move the diagram so its centre lands on `at`. */
function centringOffset(layout: Layout, at: { x: number; y: number }): { x: number; y: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of layout.shapes) {
    xs.push(shape.x, shape.x + shape.w);
    ys.push(shape.y, shape.y + shape.h);
  }
  for (const connection of layout.connections) {
    for (const point of connection.route ?? []) {
      xs.push(point.x);
      ys.push(point.y);
    }
  }
  if (xs.length === 0) return { x: 0, y: 0 };
  const centre = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
  return { x: at.x - centre.x, y: at.y - centre.y };
}
