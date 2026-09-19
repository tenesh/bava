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
import { reroute, targetAt } from './binding';
import { carriedWith, releaseFrames } from './containment';
import { measureCode, type CodeMetrics } from './code/measure';
import { isLinear, nearElement } from './hit';
import { simplify } from './stroke';
import { snapAngle, squareBox } from './constrain';
import { erasableAlong, eraseSet } from './eraser';
import { handleAt, isRotateHandle, resizeBox, scaleInto, tidy, type Handle } from './resize';
import {
  angleOf,
  canRotate,
  angleOfElement,
  centreOf,
  containsPoint,
  deltaInFrame,
  normalise,
  placeResized,
  pointInFrame,
  rotateElements,
  scaleRotatedInto,
  selectionFrame,
  snapDegrees,
  type Frame,
} from './rotate';

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
  /** How near a click counts as hitting a line, in scene units. */
  hitTolerance?: () => number;
  /** How far above the selection the rotate handle sits, in scene units. */
  rotateGap?: () => number;
  /** How a code block is measured: the mono advance, line height and padding. */
  codeMetrics?: () => CodeMetrics;
};

type Drag = {
  origin: Point;
  /** Ids captured at press time, so a moving selection is stable mid-drag. */
  moving: ElementId[];
  /** Geometry at press time, so a move is applied from the original position. */
  originals: Map<ElementId, { x: number; y: number }>;
  strokePoints: number[];
  /** Set when the press landed on a selection handle. */
  resize: { handle: Handle; bounds: Box; angle: number; originals: Map<ElementId, SceneElement> } | null;
  /** Set when the press landed on the rotate handle. */
  rotate: { centre: Point; startAngle: number; originals: Map<ElementId, SceneElement> } | null;
  /** Set when the press landed on one end of a selected arrow. */
  endpoint: { id: ElementId; index: number; original: SceneElement } | null;
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
  // Alt, likewise: held while drawing an arrow, it leaves the ends unattached.
  let alt = false;
  // Where the pointer last was, for what the stage draws mid-drag.
  let lastPoint: Point = { x: 0, y: 0 };
  // Half a handle's side, in scene units: the caller divides the on-screen size
  // by the zoom. The zone matches the drawn handle, no larger.
  const handleSize = options.handleSize ?? (() => 4);
  const eraserTolerance = options.eraserTolerance ?? (() => 3);
  // The eraser's brush width and the slop on a click are different decisions.
  const hitTolerance = options.hitTolerance ?? (() => 4);
  // The token's value at zoom 1, as the other defaults do: a test that presses
  // at a gap the app never uses cannot catch a gap regression.
  const rotateGap = options.rotateGap ?? (() => 16);
  // The defaults match the tokens at their default sizes, as the others do.
  const codeMetrics = options.codeMetrics ?? (() => ({ advance: 8, lineHeight: 19.5, padding: 8 }));

  function elementsAt(point: Point): SceneElement[] {
    // A locked element is not there as far as a press is concerned, and a
    // rotated one is hit where it is drawn, not where its stored box is.
    // A line, arrow or stroke is hit by its path: its box is mostly empty
    // space, and an axis-aligned one has no height at all.
    const tolerance = hitTolerance();
    return history.current.elements.filter((e) => {
      if (isLocked(e)) return false;
      return isLinear(e.type) ? nearElement(e, point, tolerance) : containsPoint(e, point);
    });
  }

  /**
   * The elements a drag acts on. A group is selected as one id standing for
   * its children, so every drag expands it: moving, resizing or rotating the
   * wrapper alone moves nothing the user can see.
   */
  function dragTargets(): SceneElement[] {
    return carriedWith(history.current, selection.ids);
  }

  /** The frame the handles are drawn on: the selection as it appears. */
  function frameFor(): { frame: Frame; selected: SceneElement[] } {
    const selected = history.current.elements.filter((e) => selection.has(e.id));
    // The frame follows what is selected; the drag acts on the descendants.
    return { frame: selectionFrame(selected), selected: dragTargets() };
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

    /**
     * The shapes the arrow being drawn would attach to, for the stage to
     * highlight. Empty when nothing is being drawn, when Alt is held, or when
     * neither end is over a shape.
     */
    get bindingCandidates(): ElementId[] {
      if (!drag || tools.active !== 'arrow' || alt) return [];
      // The same endpoint the release would bind, Shift snapping included, so
      // the highlight cannot name a shape the drop would miss.
      const ends = [drag.origin, shift ? snapAngle(drag.origin, lastPoint) : lastPoint];
      const ids = ends.map((end) => targetAt(history.current, end, drag!.newId)?.id);
      return ids.filter((id, i) => id !== undefined && ids.indexOf(id) === i) as ElementId[];
    },

    down(point: Point, options: { additive?: boolean; shift?: boolean } = {}): void {
      shift = Boolean(options.shift);
      alt = false;
      lastPoint = point;
      if (tools.active === 'eraser') {
        erasing = new Set();
        trailEnd = point;
        trail = [point.x, point.y];
        drag = { origin: point, moving: [], originals: new Map(), strokePoints: [], resize: null, rotate: null, endpoint: null, newId: '' };
        return;
      }

      // One selected arrow: its ends are handles of their own, and they win
      // over the box handles, which sit on the same corners for a thin box.
      if (tools.active === 'select' && selection.ids.length === 1) {
        const end = endpointAt(point);
        if (end) {
          drag = {
            origin: point,
            moving: [],
            originals: new Map(),
            strokePoints: [],
            resize: null,
            rotate: null,
            endpoint: end,
            newId: '',
          };
          return;
        }
      }

      // A selection handle wins over whatever lies beneath it.
      if (tools.active === 'select' && selection.ids.length > 0) {
        const { frame, selected } = frameFor();
        const bounds = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
        const size = handleSize();
        // Handles are drawn on the frame, so a press is read in its space.
        const local = pointInFrame(point, frame);
        // A gap of zero would put the rotate zone on the top handle and make
        // that handle unreachable; no gap means no rotate handle.
        const gap = rotateGap();
        if (gap > 0 && isRotateHandle(local, bounds, size, gap) && selected.some(canRotate)) {
          const centre = centreOf(bounds);
          drag = {
            origin: point,
            moving: [],
            originals: new Map(),
            strokePoints: [],
            resize: null,
            rotate: { centre, startAngle: angleOf(centre, point), originals: new Map(selected.map((e) => [e.id, e])) },
            endpoint: null,
            newId: '',
          };
          return;
        }
        // A code block's size comes from its code, so it has no handles: a
        // selection made only of them is dragged, never resized.
        const handle = selected.every((element) => element.type === 'code') ? null : handleAt(local, bounds, size);
        // A selection only a few handles across is covered by its handles;
        // pressing inside it moves it, and the handles' outer halves resize.
        const inside = local.x > bounds.x && local.x < bounds.x + bounds.w && local.y > bounds.y && local.y < bounds.y + bounds.h;
        const small = bounds.w < size * 6 || bounds.h < size * 6;
        if (handle && !(inside && small)) {
          drag = {
            origin: point,
            moving: [],
            originals: new Map(),
            strokePoints: [],
            resize: { handle, bounds, angle: frame.angle, originals: new Map(selected.map((e) => [e.id, e])) },
            rotate: null,
            endpoint: null,
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

      const moving = tools.active === 'select' && hits.length > 0 ? dragTargets().map((e) => e.id) : [];
      const originals = new Map<ElementId, { x: number; y: number }>();
      for (const element of tools.active === 'select' && hits.length > 0 ? dragTargets() : []) {
        originals.set(element.id, { x: element.x, y: element.y });
      }

      drag = {
        origin: point,
        moving,
        originals,
        strokePoints: [point.x, point.y],
        resize: null,
        rotate: null,
        endpoint: null,
        newId: nextId(history.current.elements.length),
      };
    },

    move(point: Point, options: { alt?: boolean; shift?: boolean } = {}): void {
      if (!drag) return;
      shift = Boolean(options.shift);
      alt = Boolean(options.alt);
      lastPoint = point;

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
      if (tools.active === 'select' && !drag.resize && !drag.rotate && !drag.endpoint && drag.moving.length === 0) {
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
      // The preview re-aims attached arrows too, the same way `history.mutate`
      // does, so what is drawn mid-drag is what the release commits.
      const next = produce(history.current, (draft: SceneData) => {
        recipe(draft);
        reroute(draft);
      });
      return next === history.current ? null : next;
    },

    /**
     * Finish a drag. Returns the id of an element that wants an editor opened
     * on it (a code block, which arrives empty), or null.
     */
    up(point: Point, options: { alt?: boolean; shift?: boolean } = {}): ElementId | null {
      if (!drag) return null;
      shift = Boolean(options.shift);
      alt = Boolean(options.alt);
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
            // An erased frame keeps its contents, as a deleted one does.
            releaseFrames(scene, doomed);
          });
        }
        return null;
      }

      if (tools.active === 'select' && !started.resize && !started.rotate && !started.endpoint && started.moving.length === 0) {
        if (farEnough(started.origin, point)) {
          selection.marquee(boxBetween(started.origin, point), history.current);
        }
        return null;
      }

      // A code block is placed by a click and typed into at once: it arrives
      // empty, and its size comes from what is typed, so there is nothing to
      // drag out. The caller opens its editor on the id returned here.
      if (tools.active === 'code') {
        const id = started.newId;
        // At the size an empty block has, not nothing: a 0x0 element cannot be
        // seen, selected or deleted, and would sit in the user's file for ever
        // if they placed one and changed their mind.
        const size = measureCode('', codeMetrics());
        history.mutate((scene) => {
          scene.elements.push({
            id,
            type: 'code',
            x: tidy(started.origin.x),
            y: tidy(started.origin.y),
            w: size.width,
            h: size.height,
            z: topZ(scene.elements) + 1,
            code: '',
            measuredWidth: size.width,
            measuredHeight: size.height,
          } as SceneElement);
        });
        return id;
      }

      // One step for the whole gesture, however many move events it had.
      const recipe = changeFor(started, point);
      if (recipe) history.mutate(recipe);
      return null;
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
    if (started.rotate) {
      const { centre, startAngle, originals } = started.rotate;
      const turn = normalise(angleOf(centre, point) - startAngle);
      if (turn === 0) return null;
      const elements = [...originals.values()];
      // Shift snaps: one element lands on a multiple of fifteen degrees, which
      // is what the user is aiming at; several keep their relative angles, so
      // the turn itself snaps instead.
      const only = elements.length === 1 ? elements[0] : null;
      const degrees = !shift
        ? turn
        : only
          ? normalise(snapDegrees(angleOfElement(only) + turn) - angleOfElement(only))
          : snapDegrees(turn);
      const turned = new Map(rotateElements(elements, centre, degrees).map((e) => [e.id, e]));
      return (scene) => {
        for (let i = 0; i < scene.elements.length; i += 1) {
          const replacement = turned.get(scene.elements[i].id);
          if (replacement) scene.elements[i] = replacement;
        }
      };
    }

    if (started.endpoint) {
      const { id, index, original } = started.endpoint;
      const points = [...(('points' in original ? original.points : []) as number[])];
      if (points.length < 4) return null;
      // A click is not a drag. A bound end sits a gap clear of its shape, so a
      // click on its handle finds nothing under it: without this, clicking an
      // end silently let the arrow go.
      if (!farEnough(started.origin, point)) return null;
      const key = index === 0 ? 'startBinding' : 'endBinding';
      const otherKey = index === 0 ? 'endBinding' : 'startBinding';
      const other = (original as SceneElement & Record<string, string | undefined>)[otherKey];
      // Dropped on a shape it attaches, on empty canvas it lets go, and Alt
      // holds it free either way. Both ends on one shape would leave the arrow
      // with nowhere to run, so that target is refused.
      const candidate = alt ? undefined : targetAt(history.current, point, id);
      const target = candidate && candidate.id === other ? undefined : candidate;
      const last = points.length - 2;
      const at = index === 0 ? 0 : last;
      points[at] = point.x - original.x;
      points[at + 1] = point.y - original.y;
      return (scene) => {
        const element = scene.elements.find((e) => e.id === id) as (SceneElement & { points?: number[] }) | undefined;
        if (!element) return;
        element.points = points;
        const bound = element as SceneElement & Record<string, string | undefined>;
        if (target) bound[key] = target.id;
        else delete bound[key];
      };
    }

    if (started.resize) {
      const { handle, bounds, angle, originals } = started.resize;
      const dx = point.x - started.origin.x;
      const dy = point.y - started.origin.y;
      if (dx === 0 && dy === 0) return null;
      // A rotated element resizes along its own axes: the drag is read in its
      // frame, and the result is put back where that frame leaves it.
      const local = deltaInFrame(dx, dy, angle);
      const next = placeResized(bounds, resizeBox(bounds, handle, local.x, local.y, { keepAspect: shift }), angle);
      return (scene) => {
        for (let i = 0; i < scene.elements.length; i += 1) {
          const original = originals.get(scene.elements[i].id);
          if (!original) continue;
          // A frame with an angle is a single element's own frame, where the
          // stored box is already the right space. An upright frame around
          // several elements is the box around them as drawn, so a rotated
          // member there scales through its drawn bounds instead.
          const member = original as SceneElement & { points?: number[] };
          scene.elements[i] = angle === 0 ? scaleRotatedInto(member, bounds, next) : scaleInto(member, bounds, next);
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
            // An arrow is a connector: it attaches to what its ends land on,
            // unless Alt says otherwise. A line is geometry, and never binds.
            ...(type === 'arrow' && !alt ? bindingsFor(started.origin, end, started.newId) : {}),
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

  /**
   * The end of the selected arrow under a point, if any. Ends are handles the
   * same size as the box handles, drawn where the arrow is drawn.
   */
  function endpointAt(point: Point): { id: ElementId; index: number; original: SceneElement } | null {
    const [id] = selection.ids;
    const element = history.current.elements.find((e) => e.id === id);
    if (!element || element.type !== 'arrow' || isLocked(element)) return null;
    const points = ('points' in element ? element.points : []) as number[];
    if (points.length < 4) return null;
    const size = handleSize();
    for (const index of [0, points.length - 2]) {
      const x = element.x + points[index];
      const y = element.y + points[index + 1];
      if (Math.abs(point.x - x) <= size && Math.abs(point.y - y) <= size) {
        return { id, index: index === 0 ? 0 : 1, original: element };
      }
    }
    return null;
  }

  /** What each end of a drawn arrow lands on, as keys for the element. */
  function bindingsFor(from: Point, to: Point, id: string): Record<string, string> {
    const start = targetAt(history.current, from, id)?.id;
    const end = targetAt(history.current, to, id)?.id;
    return {
      ...(start ? { startBinding: start } : {}),
      ...(end && end !== start ? { endBinding: end } : {}),
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
