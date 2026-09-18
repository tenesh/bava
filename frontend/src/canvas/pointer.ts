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
import { produce } from 'immer';
import { isLocked, type ElementId, type SceneData, type SceneElement } from './scene';
import { simplify } from './stroke';
import { snapAngle, squareBox } from './constrain';
import { erasableAlong, eraseSet } from './eraser';
import { boundsOf } from './edit';
import { handleAt, resizeBox, scaleInto, tidy, type Handle } from './resize';

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
  /**
   * How near a handle, in scene units, counts as pressing it. The caller
   * divides a screen-space size by the zoom, so handles stay the same size on
   * screen at every zoom.
   */
  handleSize?: () => number;
  /** How near the eraser trail must pass a line or outline, in scene units. */
  eraserTolerance?: () => number;
};

type Drag = {
  origin: Point;
  /** Ids captured at press time, so a moving selection is stable mid-drag. */
  moving: ElementId[];
  /** Geometry at press time, so a move is applied from the original position. */
  originals: Map<ElementId, { x: number; y: number }>;
  strokePoints: number[];
  /** Set when the press landed on a selection handle. */
  resize: { handle: Handle; bounds: Box; originals: Map<ElementId, SceneElement> } | null;
  /** The id a drawn element gets, fixed for the drag so previews update one node. */
  newId: string;
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
  // Elements the eraser's trail has marked, and where the trail last was.
  let erasing = new Set<ElementId>();
  let trailEnd: Point | null = null;
  let trail: number[] = [];
  let marquee: Box | null = null;
  // Shift, as it was on the last event: constraints follow the key during the
  // drag rather than being decided when the pointer went down.
  let shift = false;
  // Half a handle's side, in scene units: the caller divides the on-screen size
  // by the zoom. The zone matches the drawn handle, no larger.
  const handleSize = options.handleSize ?? (() => 4);
  const eraserTolerance = options.eraserTolerance ?? (() => 3);

  function elementsAt(point: Point): SceneElement[] {
    // A locked element is not there as far as a press is concerned.
    return history.current.elements.filter(
      (e) => !isLocked(e) && point.x >= e.x && point.x <= e.x + e.w && point.y >= e.y && point.y <= e.y + e.h,
    );
  }

  return {
    /**
     * Elements the eraser will delete on release, for the stage to fade:
     * what the trail marked, and the groups that go with them.
     */
    get erasing(): ReadonlySet<ElementId> {
      return eraseSet(history.current, erasing);
    },

    /** The eraser trail so far, flat x,y pairs, for the stage to draw. */
    get eraserTrail(): number[] {
      return trail;
    },

    /** Whether a press is being dragged. */
    get dragging(): boolean {
      return drag !== null;
    },

    /** The marquee rectangle while one is being dragged, for the stage to draw. */
    get marquee(): Box | null {
      return marquee;
    },

    down(point: Point, options: { additive?: boolean; shift?: boolean } = {}): void {
      shift = Boolean(options.shift);
      if (tools.active === 'eraser') {
        erasing = new Set();
        trailEnd = point;
        trail = [point.x, point.y];
        drag = { origin: point, moving: [], originals: new Map(), strokePoints: [], resize: null, newId: '' };
        return;
      }

      // A selection handle wins over whatever lies beneath it.
      if (tools.active === 'select' && selection.ids.length > 0) {
        const selected = history.current.elements.filter((e) => selection.has(e.id));
        const bounds = boundsOf(selected);
        const size = handleSize();
        const handle = handleAt(point, bounds, size);
        // A selection only a few handles across is covered by its handles;
        // pressing inside it moves it, and the handles' outer halves resize.
        const inside = point.x > bounds.x && point.x < bounds.x + bounds.w && point.y > bounds.y && point.y < bounds.y + bounds.h;
        const small = bounds.w < size * 6 || bounds.h < size * 6;
        if (handle && !(inside && small)) {
          drag = {
            origin: point,
            moving: [],
            originals: new Map(),
            strokePoints: [],
            resize: { handle, bounds, originals: new Map(selected.map((e) => [e.id, e])) },
            newId: '',
          };
          return;
        }
      }

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

      drag = {
        origin: point,
        moving,
        originals,
        strokePoints: [point.x, point.y],
        resize: null,
        newId: nextId(history.current.elements.length),
      };
    },

    move(point: Point, options: { alt?: boolean; shift?: boolean } = {}): void {
      if (!drag) return;
      shift = Boolean(options.shift);

      if (tools.active === 'eraser') {
        extendTrail(point, Boolean(options.alt));
        return;
      }

      if (tools.active === 'pen') {
        drag.strokePoints.push(point.x, point.y);
        return;
      }

      // A resize is a select-tool drag that moves nothing; the marquee belongs
      // to dragging empty space, not to it.
      if (tools.active === 'select' && !drag.resize && drag.moving.length === 0) {
        marquee = boxBetween(drag.origin, point);
      }
    },

    /**
     * The scene the drag would produce if released at `point`, for the canvas
     * to draw while the pointer moves. History is untouched, though the
     * modifier is recorded: every call states whether Shift is held, so a
     * preview and the release that follows cannot disagree. Null when there is
     * no drag or it would change nothing.
     */
    preview(point: Point, options: { shift?: boolean } = {}): SceneData | null {
      if (!drag) return null;
      shift = Boolean(options.shift);
      const recipe = changeFor(drag, point);
      if (!recipe) return null;
      const next = produce(history.current, recipe);
      return next === history.current ? null : next;
    },

    up(point: Point, options: { alt?: boolean; shift?: boolean } = {}): void {
      if (!drag) return;
      shift = Boolean(options.shift);
      const started = drag;
      drag = null;
      marquee = null;

      if (tools.active === 'eraser') {
        extendTrail(point, Boolean(options.alt));
        // A click with nothing marked erases what it landed on.
        if (erasing.size === 0 && !farEnough(started.origin, point)) {
          erasableAlong(history.current, point, point, eraserTolerance()).forEach((id) => erasing.add(id));
        }
        const doomed = eraseSet(history.current, erasing);
        erasing = new Set();
        trailEnd = null;
        trail = [];
        if (doomed.size > 0) {
          history.mutate((scene) => {
            scene.elements = scene.elements.filter((e) => !doomed.has(e.id));
          });
        }
        return;
      }

      if (tools.active === 'select' && !started.resize && started.moving.length === 0) {
        if (farEnough(started.origin, point)) {
          selection.marquee(boxBetween(started.origin, point), history.current);
        }
        return;
      }

      // One step for the whole gesture, however many move events it had.
      const recipe = changeFor(started, point);
      if (recipe) history.mutate(recipe);
    },
  };

  /** Mark (or, with Alt, unmark) what the trail's newest segment touches. */
  function extendTrail(point: Point, alt: boolean): void {
    if (!trailEnd) return;
    if (trailEnd.x !== point.x || trailEnd.y !== point.y) {
      for (const id of erasableAlong(history.current, trailEnd, point, eraserTolerance())) {
        if (alt) erasing.delete(id);
        else erasing.add(id);
      }
    }
    trailEnd = point;
    trail.push(point.x, point.y);
  }

  /**
   * The change a drag makes if it ends at `point`, shared by the preview and
   * the release so what the user saw while dragging is what they get.
   */
  function changeFor(started: Drag, point: Point): ((scene: SceneData) => void) | null {
    if (started.resize) {
      const { handle, bounds, originals } = started.resize;
      const dx = point.x - started.origin.x;
      const dy = point.y - started.origin.y;
      if (dx === 0 && dy === 0) return null;
      const next = resizeBox(bounds, handle, dx, dy, { keepAspect: shift });
      return (scene) => {
        for (let i = 0; i < scene.elements.length; i += 1) {
          const original = originals.get(scene.elements[i].id);
          if (!original) continue;
          scene.elements[i] = scaleInto(original as SceneElement & { points?: number[] }, bounds, next);
        }
      };
    }

    if (tools.active === 'eraser') return null;

    if (tools.active === 'pen') {
      const points = simplify([...started.strokePoints, point.x, point.y], 2);
      const box = boundsOfPoints(points);
      // A tap is not a stroke. Counting points is not enough: a tap still
      // yields two identical ones, and a zero-size element cannot be
      // selected or explained.
      if (box.w < DRAG_THRESHOLD && box.h < DRAG_THRESHOLD) return null;
      return (scene) => {
        scene.elements.push({
          id: started.newId,
          z: topZ(scene.elements) + 1,
          type: 'stroke',
          // Relative to the stroke's own x and y, as the file format says.
          points: points.map((value, i) => tidy(value - (i % 2 === 0 ? box.x : box.y))),
          x: tidy(box.x),
          y: tidy(box.y),
          w: tidy(box.w),
          h: tidy(box.h),
        } as SceneElement);
      };
    }

    if (tools.active === 'select') {
      if (started.moving.length === 0) return null;
      const dx = point.x - started.origin.x;
      const dy = point.y - started.origin.y;
      if (dx === 0 && dy === 0) return null;
      return (scene) => {
        for (const element of scene.elements) {
          const from = started.originals.get(element.id);
          if (!from) continue;
          element.x = tidy(from.x + dx);
          element.y = tidy(from.y + dy);
        }
      };
    }

    // A shape tool. A click is not a shape.
    if (!farEnough(started.origin, point)) return null;

    const type = tools.active;
    const linear = type === 'line' || type === 'arrow';
    // Shift constrains: a square box, or an angle in 15° steps.
    const end = shift && linear ? snapAngle(started.origin, point) : point;
    const raw = shift && !linear ? squareBox(started.origin, point) : boxBetween(started.origin, end);
    // Tidy: a zoom or fractional pan leaves 83.33333333333333, written into
    // the user's file otherwise.
    const box = { x: tidy(raw.x), y: tidy(raw.y), w: tidy(raw.w), h: tidy(raw.h) };
    // Text is typed, not dragged: its tool is handled with the label editor.
    if (type === 'text') return null;
    const extra = linear
        ? {
            // From where the drag started to where it ended, relative to the box.
            points: [started.origin.x - box.x, started.origin.y - box.y, end.x - box.x, end.y - box.y].map(tidy),
          }
        : {};
    return (scene) => {
      scene.elements.push({
        id: started.newId,
        z: topZ(scene.elements) + 1,
        type,
        ...box,
        ...extra,
      } as SceneElement);
    };
  }
}

/** The highest z in use, so a new element is drawn above everything. */
function topZ(elements: { z: number }[]): number {
  return elements.reduce((max, e) => Math.max(max, e.z), 0);
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
