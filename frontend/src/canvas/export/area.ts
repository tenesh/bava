/**
 * What an export covers: which elements are drawn, and the box around them.
 *
 * Pure over scene data, so the decisions that are easy to get subtly wrong (a
 * group standing for its children, an empty selection, a rotated element's
 * real extent) are testable without a stage or a renderer.
 */
import { createScene, type ElementId, type SceneData, type SceneElement } from '../scene';
import { drawnBoundsOf, withDescendants } from '../edit';
import type { Box } from '../selection';

/**
 * How much empty space an export keeps around its content, in scene units.
 * Fixed: the export dialog has no padding control (canvas-toolbar.md).
 */
export const EXPORT_PADDING = 16;

export type ExportArea = {
  /** The elements to draw, in paint order. Groups are not among them. */
  elements: SceneElement[];
  /** The box to draw, padded. */
  box: Box;
};

/**
 * The elements an export draws and the box it covers.
 *
 * Only-selected with nothing selected falls back to the whole canvas: an empty
 * picture is never what ticking the box meant. A group contributes its
 * children, since a group draws nothing itself.
 */
export function exportArea(
  scene: SceneData,
  ids: ElementId[],
  options: { onlySelected?: boolean } = {},
): ExportArea {
  const selected = new Set(ids);
  const chosen =
    options.onlySelected && ids.length > 0
      ? withDescendants(
          createScene(scene),
          scene.elements.filter((e) => selected.has(e.id)),
        )
      : scene.elements;
  const elements = chosen.filter((e) => e.type !== 'group').sort((a, b) => a.z - b.z);
  if (elements.length === 0) return { elements, box: { x: 0, y: 0, w: 0, h: 0 } };

  const bounds = drawnBoundsOf(elements);
  return {
    elements,
    box: {
      x: bounds.x - EXPORT_PADDING,
      y: bounds.y - EXPORT_PADDING,
      w: bounds.w + EXPORT_PADDING * 2,
      h: bounds.h + EXPORT_PADDING * 2,
    },
  };
}
