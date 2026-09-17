/**
 * Pointer input: turning presses, drags and releases into scene operations.
 *
 * Kept free of Konva and the DOM so the behaviour that is easy to get subtly
 * wrong (a drag that goes up and to the left, a click that creates an
 * invisible element, a drag that records fifty undo steps) is testable
 * directly.
 *
 * Every mutation goes through history. One drag is one step: a user who drags
 * a shape across the canvas expects one undo to put it back, not fifty.
 */
import type { History } from './history';
import type { Selection, Box } from './selection';
import type { ToolId } from './tools.svelte';
import type { ElementId, SceneElement } from './scene';
import { simplify } from './stroke';

export type Point = { x: number; y: number };

/** Below this, a drag is a click. Stops shape tools leaving zero-size elements. */
export const DRAG_THRESHOLD = 3;

type Tools = { readonly active: ToolId; escape(): void };

export type PointerHandlerOptions = {
  history: History;
  selection: Selection;
  tools: Tools;
  /** Measures text so the element can store its size. Injectable for tests. */
  measureText?: (text: string) => { width: number; height: number };
};

type Drag = {
  origin: Point;
  /** Ids captured at press time, so a moving selection is stable mid-drag. */
  moving: ElementId[];
  /** Geometry at press time, so a move is applied from the original position. */
  originals: Map<ElementId, { x: number; y: number }>;
  strokePoints: number[];
};

function boxBetween(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

function farEnough(a: Point, b: Point): boolean {
  return Math.abs(b.x - a.x) >= DRAG_THRESHOLD || Math.abs(b.y - a.y) >= DRAG_THRESHOLD;
}

export function createPointerHandler(options: PointerHandlerOptions) {
  const { history, selection, tools } = options;

  let drag: Drag | null = null;
  let marquee: Box | null = null;

  function elementsAt(point: Point): SceneElement[] {
    return history.current.elements.filter(
      (e) => point.x >= e.x && point.x <= e.x + e.w && point.y >= e.y && point.y <= e.y + e.h,
    );
  }

  return {
    /** The marquee rectangle while one is being dragged, for the stage to draw. */
    get marquee(): Box | null {
      return marquee;
    },

    down(point: Point, options: { additive?: boolean } = {}): void {
      const hits = elementsAt(point);

      if (tools.active === 'select' && hits.length > 0) {
        const top = hits[hits.length - 1];
        if (!selection.has(top.id)) selection.click(top.id, options);
      } else if (tools.active === 'select') {
        if (!options.additive) selection.clear();
      }

      const moving = tools.active === 'select' && hits.length > 0 ? selection.ids : [];
      const originals = new Map<ElementId, { x: number; y: number }>();
      for (const id of moving) {
        const element = history.current.elements.find((e) => e.id === id);
        if (element) originals.set(id, { x: element.x, y: element.y });
      }

      drag = { origin: point, moving, originals, strokePoints: [point.x, point.y] };
    },

    move(point: Point): void {
      if (!drag) return;

      if (tools.active === 'pen') {
        drag.strokePoints.push(point.x, point.y);
        return;
      }

      if (tools.active === 'select' && drag.moving.length === 0) {
        marquee = boxBetween(drag.origin, point);
      }
    },

    up(point: Point): void {
      if (!drag) return;
      const started = drag;
      drag = null;
      marquee = null;

      if (tools.active === 'pen') {
        const points = simplify([...started.strokePoints, point.x, point.y], 2);
        const box = boundsOfPoints(points);
        // A tap is not a stroke. Counting points is not enough: a tap still
        // yields two identical ones, and a zero-size element cannot be
        // selected or explained.
        if (box.w < DRAG_THRESHOLD && box.h < DRAG_THRESHOLD) return;
        history.mutate((scene) => {
          scene.elements.push({
            id: nextId(scene.elements.length),
            z: scene.elements.length + 1,
            type: 'stroke',
            points,
            ...box,
          } as SceneElement);
        });
        return;
      }

      if (tools.active === 'select') {
        if (started.moving.length > 0) {
          const dx = point.x - started.origin.x;
          const dy = point.y - started.origin.y;
          if (dx === 0 && dy === 0) return;
          // One step for the whole drag, not one per move event.
          history.mutate((scene) => {
            for (const element of scene.elements) {
              const from = started.originals.get(element.id);
              if (!from) continue;
              element.x = from.x + dx;
              element.y = from.y + dy;
            }
          });
          return;
        }

        if (farEnough(started.origin, point)) {
          selection.marquee(boxBetween(started.origin, point), history.current);
        }
        return;
      }

      // A shape tool. A click is not a shape.
      if (!farEnough(started.origin, point)) return;

      const box = boxBetween(started.origin, point);
      const type = tools.active;
      history.mutate((scene) => {
        scene.elements.push({
          id: nextId(scene.elements.length),
          z: scene.elements.length + 1,
          type,
          ...box,
        } as SceneElement);
      });
    },
  };
}

function boundsOfPoints(points: number[]) {
  const xs = points.filter((_, i) => i % 2 === 0);
  const ys = points.filter((_, i) => i % 2 === 1);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * Ids are assigned here rather than by the scene helper because mutations run
 * inside an immer draft, where the helper's Map is not in play.
 */
function nextId(count: number): string {
  return `e${count + 1}-${Math.random().toString(36).slice(2, 8)}`;
}
