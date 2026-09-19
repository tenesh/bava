/**
 * D2's shape names, mapped onto the ones Bava draws.
 *
 * The canvas set was chosen by comparing D2's shapes with Eraser's
 * (`diagrams-as-shapes.md`): everything D2 can produce either has a Bava shape
 * or becomes a rectangle that keeps its label. A box with the right name says
 * more than a shape nobody recognises, and far more than nothing at all.
 */
import { isShapeType, type SceneElement } from '../scene';

type CanvasShape = SceneElement['type'];

/** D2 names that differ from Bava's for the same drawing. */
const RENAMED: Record<string, string> = {
  rectangle: 'rect',
  square: 'rect',
  circle: 'ellipse',
  oval: 'ellipse',
};

/**
 * The canvas shape for a D2 shape type.
 *
 * Anything Bava has no drawing for becomes a rectangle: the rarer D2 shapes
 * (queue, page, package, step, callout, stored data, C4 person), the deferred
 * ones (SQL table, UML class), and any shape a later D2 adds.
 */
export function canvasShapeFor(d2Type: string): CanvasShape {
  const renamed = RENAMED[d2Type];
  if (renamed) return renamed as CanvasShape;
  return (isShapeType(d2Type) ? d2Type : 'rect') as CanvasShape;
}
