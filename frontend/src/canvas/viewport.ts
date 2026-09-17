/**
 * Pan and zoom, as pure coordinate arithmetic.
 *
 * Kept free of Konva so it can be tested directly; `canvas.md` names
 * coordinate maths as one of the few places in canvas code where real logic
 * lives and tests earn their keep.
 */

export type Point = { x: number; y: number };

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 8;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function createViewport() {
  let zoom = 1;
  let pan: Point = { x: 0, y: 0 };

  function sceneToScreen(point: Point): Point {
    return { x: point.x * zoom + pan.x, y: point.y * zoom + pan.y };
  }

  function screenToScene(point: Point): Point {
    return { x: (point.x - pan.x) / zoom, y: (point.y - pan.y) / zoom };
  }

  return {
    get zoom(): number {
      return zoom;
    },
    get pan(): Point {
      return { ...pan };
    },

    sceneToScreen,
    screenToScene,

    setZoom(next: number): void {
      zoom = clampZoom(next);
    },

    setPan(x: number, y: number): void {
      pan = { x, y };
    },

    panBy(dx: number, dy: number): void {
      pan = { x: pan.x + dx, y: pan.y + dy };
    },

    /**
     * Zoom about a screen point, keeping whatever is under it in place.
     *
     * The scene point under the cursor is found first, then the pan is solved
     * so that same scene point maps back to the same screen point at the new
     * zoom. Zooming about the origin instead is the usual bug: the drawing
     * slides away from the cursor.
     */
    zoomAt(screenPoint: Point, next: number): void {
      const scenePoint = screenToScene(screenPoint);
      zoom = clampZoom(next);
      pan = {
        x: screenPoint.x - scenePoint.x * zoom,
        y: screenPoint.y - scenePoint.y * zoom,
      };
    },
  };
}

export type Viewport = ReturnType<typeof createViewport>;
