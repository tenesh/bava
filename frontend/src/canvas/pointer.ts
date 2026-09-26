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
import { createScene, isLocked, type ArrowProps, type ElementId, type SceneData, type SceneElement } from './scene';
import { labelPoint, middlesAlong, positionAlong, routePoints } from './arrows';
import { duplicate, withDescendants } from './edit';
import { anchorFor, BINDING_REACH_MIN, drawnPoints, reroute, settledAround, targetAt, unturned } from './binding';
import { carriedWith, releaseFrames } from './containment';
import { measureCode, type CodeMetrics } from './code/measure';
import { isLinear, nearElement, tensionOf } from './hit';
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
  rotatePoint,
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
  /**
   * Below this, in scene units, a drag is a click. The caller divides a
   * screen-space distance by the zoom, so a twitch is a click at any zoom.
   * Also stops shape tools leaving zero-size elements.
   */
  dragThreshold?: () => number;
  /**
   * How near an arrow end must come to a shape's outline to attach, in scene
   * units; the caller gives `bindingReach(zoom)`.
   */
  bindingReach?: () => number;
  /**
   * The shortest segment, in scene units, that shows a handle at its middle
   * for adding a bend; the caller divides `--size-bend-min-segment` by the
   * zoom.
   */
  bendMinSegment?: () => number;
  /** An arrow's label box in scene space, as the stage draws it, for sliding it. */
  labelBounds?: (id: ElementId) => Box | null;
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
  /**
   * Set when the press landed on a point of a selected line or arrow that is
   * not an attachable end (a bend, or a line's end), or on the middle of a
   * segment, which inserts a point there (`insert`). `index` is the point's
   * position in the list.
   */
  bend?: { id: ElementId; index: number; insert: boolean; original: SceneElement };
  /** Set when the press landed on the selected arrow's label, which slides along it. */
  label?: { id: ElementId; original: SceneElement };
  /** The id a drawn element gets, fixed for the drag so previews update one node. */
  newId: string;
  /**
   * A press on an element already selected, whose effect on the selection
   * waits for the release: dragged, the selection moves as it is; clicked, a
   * Shift-click removes the element and a plain click narrows to it.
   */
  pendingClick?: { id: ElementId; additive: boolean };
  /** A press in empty space inside a selection of several: a click clears it. */
  pendingClear?: boolean;
};

function boxBetween(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
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
  // The copies an Alt-drag made, selected once it is released.
  let copied: ElementId[] = [];
  // Half a handle's side, in scene units: the caller divides the on-screen size
  // by the zoom. The zone matches the drawn handle, no larger.
  const handleSize = options.handleSize ?? (() => 4);
  const eraserTolerance = options.eraserTolerance ?? (() => 3);
  // The eraser's brush width and the slop on a click are different decisions.
  const hitTolerance = options.hitTolerance ?? (() => 4);
  // The token's value at zoom 1, as the other defaults do: a test that presses
  // at a gap the app never uses cannot catch a gap regression.
  const rotateGap = options.rotateGap ?? (() => 16);
  // The token's value at zoom 1, as the others.
  const dragThreshold = options.dragThreshold ?? (() => 3);
  const reach = options.bindingReach ?? (() => BINDING_REACH_MIN);
  // The token's value at zoom 1, as the others.
  const bendMinSegment = options.bendMinSegment ?? (() => 40);

  function farEnough(a: Point, b: Point): boolean {
    const threshold = dragThreshold();
    return Math.abs(b.x - a.x) >= threshold || Math.abs(b.y - a.y) >= threshold;
  }
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

  /** What a resize acts on: the selection, with groups expanded but not frames. */
  function resized(): SceneElement[] {
    const scene = createScene(history.current);
    return withDescendants(scene, history.current.elements.filter((e) => selection.has(e.id)));
  }

  /** Whether a point is inside the box the selection is drawn in. */
  function withinSelection(point: Point): boolean {
    const { frame } = frameFor();
    const local = pointInFrame(point, frame);
    return local.x >= frame.x && local.x <= frame.x + frame.w && local.y >= frame.y && local.y <= frame.y + frame.h;
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
      if (!drag || alt) return [];
      // An end of an existing arrow being dragged: what it would attach to,
      // by the rule the release uses (the other end's shape is refused).
      if (drag.endpoint) {
        const { id, index, original } = drag.endpoint;
        const other = (original as SceneElement & Record<string, string | undefined>)[index === 0 ? 'endBinding' : 'startBinding'];
        const target = targetAt(history.current, lastPoint, id, reach());
        return target && target.id !== other && farEnough(drag.origin, lastPoint) ? [target.id] : [];
      }
      if (tools.active !== 'arrow') return [];
      // The same endpoint the release would bind, Shift snapping included, so
      // the highlight cannot name a shape the drop would miss.
      const ends = [drag.origin, shift ? snapAngle(drag.origin, lastPoint) : lastPoint];
      const ids = ends.map((end) => targetAt(history.current, end, drag!.newId, reach())?.id);
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
      // Not with Shift: a Shift-press on the selected element is a click
      // that removes it from the selection, wherever it lands.
      if (tools.active === 'select' && selection.ids.length === 1 && !options.additive) {
        const end = endpointAt(point);
        // A bend, a line's end or a segment's middle: after an arrow's ends,
        // before the box handles, which share their corners on a thin box.
        let bend = end ? null : bendAt(point);
        // The label beats only a segment's middle, which it covers on a
        // straight arrow; the points stay reachable on top of it.
        const label = end || (bend && !bend.insert) ? null : labelAt(point);
        if (label) bend = null;
        if (end || bend || label) {
          drag = {
            origin: point,
            moving: [],
            originals: new Map(),
            strokePoints: [],
            resize: null,
            rotate: null,
            endpoint: end,
            bend: bend ?? undefined,
            label: label ?? undefined,
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
            // A group resizes with its children; a frame alone, since what it
            // holds keeps its own size and place (membership is re-checked
            // after, as for any change).
            resize: { handle, bounds, angle: frame.angle, originals: new Map(resized().map((e) => [e.id, e])) },
            rotate: null,
            endpoint: null,
            newId: '',
          };
          return;
        }
      }

      const hits = elementsAt(point);

      let pendingClick: Drag['pendingClick'];
      // Empty space between selected shapes is still the selection: a press
      // there drags it (Excalidraw does the same), and a click clears it.
      const insideSelection =
        tools.active === 'select' && hits.length === 0 && !options.additive && selection.ids.length > 1 && withinSelection(point);
      if (tools.active === 'select' && hits.length > 0) {
        const top = hits[hits.length - 1];
        if (!selection.has(top.id)) selection.click(top.id, options);
        else pendingClick = { id: top.id, additive: Boolean(options.additive) };
      } else if (tools.active === 'select' && !insideSelection) {
        if (!options.additive) selection.clear();
      }

      const drags = tools.active === 'select' && (hits.length > 0 || insideSelection);
      const moving = drags ? dragTargets().map((e) => e.id) : [];
      const originals = new Map<ElementId, { x: number; y: number }>();
      for (const element of drags ? dragTargets() : []) {
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
        pendingClick,
        pendingClear: insideSelection,
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
      if (tools.active === 'select' && !drag.resize && !drag.rotate && !drag.endpoint && !drag.bend && !drag.label && drag.moving.length === 0) {
        marquee = boxBetween(drag.origin, point);
      }
    },

    /**
     * Remove the bend under a point, on the one selected line or arrow, as one
     * step. The ends are not bends: a line or arrow keeps at least two points.
     * Returns whether a bend was removed, so the caller skips its own
     * double-click behaviour.
     */
    removeBendAt(point: Point): boolean {
      const found = bendAt(point);
      if (!found || found.insert) return false;
      const count = ((('points' in found.original ? found.original.points : []) as number[]).length) / 2;
      if (found.index === 0 || found.index === count - 1) return false;
      const base = unturned(found.original);
      const points = [...(base as SceneElement & { points: number[] }).points];
      points.splice(found.index * 2, 2);
      history.mutate((scene) => {
        const i = scene.elements.findIndex((e) => e.id === found.id);
        if (i >= 0) scene.elements[i] = settledAround(base, points);
      });
      return true;
    },

    /**
     * The scene the drag would produce if released at `point`, for the canvas
     * to draw while the pointer moves. History is untouched, though the
     * modifier is recorded: every call states whether Shift and Alt are held, so a
     * preview and the release that follows cannot disagree. Null when there is
     * no drag or it would change nothing.
     */
    preview(point: Point, options: { alt?: boolean; shift?: boolean } = {}): SceneData | null {
      if (!drag) return null;
      shift = Boolean(options.shift);
      // Alt, like Shift, can change with the pointer still: an Alt-move copies.
      if (options.alt !== undefined) alt = options.alt;
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

      if (started.pendingClear && !farEnough(started.origin, point)) {
        selection.clear();
        return null;
      }
      // A press on a selected element that never became a drag was a click.
      if (started.pendingClick && !farEnough(started.origin, point)) {
        const { id, additive } = started.pendingClick;
        if (additive) selection.click(id, { additive: true });
        else selection.click(id);
        return null;
      }

      if (tools.active === 'select' && !started.resize && !started.rotate && !started.endpoint && !started.bend && !started.label && started.moving.length === 0) {
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
      copied = [];
      const recipe = changeFor(started, point);
      if (recipe) history.mutate(recipe);
      if (copied.length > 0) {
        selection.clear();
        copied.forEach((id, i) => selection.click(id, { additive: i > 0 }));
        copied = [];
      }
      // A shape tool lets go once it has made something, with the new element
      // selected, so the next press edits rather than drawing again. The pen
      // is used stroke after stroke, so it stays on.
      const drawn = tools.active !== 'select' && tools.active !== 'pen';
      if (drawn && history.current.elements.some((e) => e.id === started.newId)) {
        tools.escape();
        selection.click(started.newId);
      }
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

    if (started.label) {
      const { id, original } = started.label;
      if (!farEnough(started.origin, point)) return null;
      const props = original as SceneElement & ArrowProps;
      const routed = routePoints((('points' in original ? original.points : []) as number[]), props.arrowType);
      // The label moves with the pointer, kept on the path: where it was, moved
      // by the drag, then brought to the nearest point along the arrow.
      const from = labelPoint(routed, props.labelPosition);
      // The drag in the arrow's own frame, a turn undone, as its points are.
      const centre = centreOf(original);
      const turn = -angleOfElement(original);
      const a = rotatePoint(started.origin, centre, turn);
      const b = rotatePoint(point, centre, turn);
      const wanted = { x: from.x + b.x - a.x, y: from.y + b.y - a.y };
      const position = tidy(positionAlong(routed, wanted));
      return (scene) => {
        const element = scene.elements.find((e) => e.id === id) as (SceneElement & ArrowProps) | undefined;
        if (element) element.labelPosition = position;
      };
    }

    if (started.bend) {
      const { id, index, insert, original } = started.bend;
      // A click on a handle is not a drag: it neither moves nor adds a point.
      if (!farEnough(started.origin, point)) return null;
      // A turned line has its turn written into its points first, so the
      // edit is in scene space and nothing else it draws moves.
      const base = unturned(original);
      const points = [...(('points' in base ? base.points : []) as number[])];
      const local = [point.x - base.x, point.y - base.y];
      if (insert) points.splice(index * 2, 0, ...local);
      else points.splice(index * 2, 2, ...local);
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        // The box is settled around the new points; an arrow's attached ends
        // re-aim in the same step (`reroute`).
        if (i >= 0) scene.elements[i] = settledAround(base, points);
      };
    }

    if (started.endpoint) {
      const { id, index } = started.endpoint;
      // A turned free arrow has its turn written into its points first.
      const original = unturned(started.endpoint.original);
      const points = [...(('points' in original ? original.points : []) as number[])];
      if (points.length < 4) return null;
      // A click is not a drag. A bound end sits a gap clear of its shape, so a
      // click on its handle finds nothing under it: without this, clicking an
      // end silently let the arrow go.
      if (!farEnough(started.origin, point)) return null;
      const key = index === 0 ? 'startBinding' : 'endBinding';
      const anchorKey = index === 0 ? 'startAnchor' : 'endAnchor';
      const otherKey = index === 0 ? 'endBinding' : 'startBinding';
      const other = (original as SceneElement & Record<string, string | undefined>)[otherKey];
      // Dropped on a shape it attaches, on empty canvas it lets go, and Alt
      // holds it free either way. Both ends on one shape would leave the arrow
      // with nowhere to run, so that target is refused.
      const candidate = alt ? undefined : targetAt(history.current, point, id, reach());
      const target = candidate && candidate.id === other ? undefined : candidate;
      const last = points.length - 2;
      const at = index === 0 ? 0 : last;
      points[at] = point.x - original.x;
      points[at + 1] = point.y - original.y;
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        scene.elements[i] = settledAround(original, points);
        const bound = scene.elements[i] as SceneElement & Record<string, unknown>;
        // The binding and where on the target it aims go together.
        if (target) {
          bound[key] = target.id;
          bound[anchorKey] = anchorFor(target, point, reach());
        } else {
          delete bound[key];
          delete bound[anchorKey];
        }
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
      if (box.w < dragThreshold() && box.h < dragThreshold()) return null;
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
      // Under the threshold a press is a click, in the preview as on release.
      if (!farEnough(started.origin, point)) return null;
      let dx = point.x - started.origin.x;
      let dy = point.y - started.origin.y;
      // Shift keeps the move on the axis it mostly travels along.
      if (shift) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      // Alt copies instead: the originals stay, copies land where the drag
      // is. Each copy is named from the drag and its original, so every
      // preview patches the same nodes.
      // Not on a click: a copy exactly on its original cannot be seen.
      if (alt && farEnough(started.origin, point)) {
        const scene = createScene(history.current);
        const chosen = history.current.elements.filter((e) => selection.has(e.id));
        // Named by position in a fixed order, not after the original: a copy
        // of a copy would otherwise grow its id with every generation.
        const order = new Map(history.current.elements.map((e, i) => [e.id, i]));
        const made = duplicate(scene, chosen, { dx, dy, name: (original) => `${started.newId}-${order.get(original)}` });
        copied = made.map((e) => e.id);
        // A copied arrow lets go of any shape that was not copied with it, as
        // a moved one does; a target already gone stays named.
        const isNew = (elementId: string) => !order.has(elementId);
        const next = scene.data().elements.map((element) => {
          if (element.type !== 'arrow' || !isNew(element.id)) return element;
          const loose = { ...element } as SceneElement & Record<string, unknown>;
          let changed = false;
          for (const [key, anchor] of [
            ['startBinding', 'startAnchor'],
            ['endBinding', 'endAnchor'],
          ] as const) {
            const target = loose[key] as string | undefined;
            if (target === undefined || !order.has(target)) continue;
            delete loose[key];
            delete loose[anchor];
            changed = true;
          }
          return changed ? loose : element;
        });
        return (draft) => {
          draft.elements = next as never;
        };
      }
      copied = [];
      if (dx === 0 && dy === 0) return null;
      return (scene) => {
        for (const element of scene.elements) {
          const from = started.originals.get(element.id);
          if (!from) continue;
          element.x = tidy(from.x + dx);
          element.y = tidy(from.y + dy);
          // An attached arrow moved by its body lets go of every shape not
          // moving with it (Excalidraw does the same); otherwise re-aiming
          // would pull its ends back and undo the move without a word.
          if (element.type === 'arrow') {
            const bound = element as SceneElement & Record<string, unknown>;
            for (const [key, anchor] of [
              ['startBinding', 'startAnchor'],
              ['endBinding', 'endAnchor'],
            ] as const) {
              const target = bound[key] as string | undefined;
              // A target already gone stays named: the end is detached, and
              // re-aims if it comes back.
              if (target === undefined || started.originals.has(target)) continue;
              if (!scene.elements.some((other) => other.id === target)) continue;
              delete bound[key];
              delete bound[anchor];
            }
          }
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
    const points = drawnPoints(element);
    if (points.length < 4) return null;
    const size = handleSize();
    for (const index of [0, points.length - 2]) {
      const x = points[index];
      const y = points[index + 1];
      if (Math.abs(point.x - x) <= size && Math.abs(point.y - y) <= size) {
        return { id, index: index === 0 ? 0 : 1, original: element };
      }
    }
    return null;
  }

  /** The one selected line or arrow that can be bent, with its points. */
  function bendable(): { element: SceneElement; points: number[]; elbow: boolean } | null {
    if (selection.ids.length !== 1) return null;
    const element = history.current.elements.find((e) => e.id === selection.ids[0]);
    if (!element || (element.type !== 'line' && element.type !== 'arrow') || isLocked(element)) return null;
    const points = ('points' in element ? element.points : []) as number[];
    if (points.length < 4) return null;
    const elbow = element.type === 'arrow' && (element as { arrowType?: string }).arrowType === 'elbow';
    return { element, points, elbow };
  }

  /**
   * The bend handle under a point: a point of the selected line or arrow
   * (not an arrow's end, which `endpointAt` owns), or the middle of a segment
   * long enough to bend. An elbow routes itself and offers neither.
   */
  function bendAt(point: Point): Drag['bend'] | null {
    const found = bendable();
    if (!found || found.elbow) return null;
    const { element } = found;
    // Where the points are drawn, a turn included: handles sit there.
    const drawn = drawnPoints(element);
    const size = handleSize();
    const near = (x: number, y: number) => Math.abs(point.x - x) <= size && Math.abs(point.y - y) <= size;
    const count = drawn.length / 2;
    for (let i = 0; i < count; i += 1) {
      const isEnd = i === 0 || i === count - 1;
      if (element.type === 'arrow' && isEnd) continue;
      if (near(drawn[i * 2], drawn[i * 2 + 1])) {
        return { id: element.id, index: i, insert: false, original: element };
      }
    }
    const middles = segmentMiddles(element);
    for (let i = 0; i < middles.length; i += 1) {
      const middle = middles[i];
      if (middle && near(middle.x, middle.y)) {
        return { id: element.id, index: i + 1, insert: true, original: element };
      }
    }
    return null;
  }

  /**
   * The middle handle of each segment, where the drawn path is halfway
   * between its points, or null for a segment too short to offer a bend.
   */
  function segmentMiddles(element: SceneElement): ({ x: number; y: number } | null)[] {
    const drawn = drawnPoints(element);
    const middles = middlesAlong(drawn, (element as SceneElement & ArrowProps).arrowType, tensionOf(element));
    return middles.map((middle, i) => {
      const [x1, y1, x2, y2] = drawn.slice(i * 2, i * 2 + 4);
      return Math.hypot(x2 - x1, y2 - y1) < bendMinSegment() ? null : middle;
    });
  }

  /** The selected arrow whose label is under a point. */
  function labelAt(point: Point): Drag['label'] | null {
    const found = bendable();
    if (!found || found.element.type !== 'arrow' || !('label' in found.element) || !found.element.label) return null;
    const box = options.labelBounds?.(found.element.id);
    if (!box) return null;
    const inside = point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h;
    return inside ? { id: found.element.id, original: found.element } : null;
  }

  /** What each end of a drawn arrow lands on, and where, as keys for the element. */
  function bindingsFor(from: Point, to: Point, id: string): Record<string, unknown> {
    const start = targetAt(history.current, from, id, reach());
    const end = targetAt(history.current, to, id, reach());
    return {
      ...(start ? { startBinding: start.id, startAnchor: anchorFor(start, from, reach()) } : {}),
      ...(end && end.id !== start?.id ? { endBinding: end.id, endAnchor: anchorFor(end, to, reach()) } : {}),
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
