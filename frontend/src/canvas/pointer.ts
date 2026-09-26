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
import { labelSpot, middlesAlong, pathOf, positionAlong } from './arrows';
import { smoothPoints } from './curves';
import { duplicate, withDescendants } from './edit';
import {
  anchorFor,
  nearestMiddle,
  spotOn,
  BINDING_GAP,
  BINDING_REACH_MIN,
  bindingsOf,
  drawnPoints,
  elbowEnds,
  elbowSnapSpots,
  fixedOf,
  isInside,
  reroute,
  settledAround,
  targetAt,
  unturned,
  withFixed,
} from './binding';
import { routeElbow } from './elbow';
import { isClosed, keepLoop, removeFromLoop } from './closed';
import { moveSegment, releaseSegment } from './elbow-segments';
import { carriedWith, releaseFrames } from './containment';
import { measureCode, MIN_RESIZE_COLUMNS, type CodeMetrics } from './code/measure';
import { insideFilledLine, isLinear, nearElement, tensionOf } from './hit';
import { chromeFor, elbowSegmentHandles, focusSpots, grown, offersMiddles } from './selection-chrome';
import type { CursorTarget } from './cursor';
import { simplify } from './stroke';
import { ANGLE_STEP, snapAngle, squareBox } from './constrain';
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

type Tools = { readonly active: ToolId; readonly locked?: boolean; escape(): void };

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
  /**
   * The shortest elbow segment, in scene units, that shows a handle at its
   * middle for dragging it: Excalidraw's 5 screen px, half of
   * `--size-point-handle`, divided by the zoom.
   */
  segmentMin?: () => number;
  /**
   * A point handle's size, in scene units: an anchor this near its end shows
   * no disc, the end's handle being there. `--size-point-handle` over the zoom.
   */
  pointHandle?: () => number;
  /** How far a bent line's box stands clear of it, in scene units: 10 screen px. */
  bentBoxPadding?: () => number;
  /**
   * How near a press must come to a line's or arrow's point to take it, in
   * scene units: Excalidraw's 11 screen px (`linearElementEditor.ts:1433-1458`),
   * which the caller divides by the zoom.
   */
  pointHit?: () => number;
  /**
   * How far a segment's middle must be dragged before it adds a bend, in
   * scene units: Excalidraw's 10 screen px, divided by the zoom.
   */
  bendInsertDistance?: () => number;
  /**
   * The shortest line or arrow a drag draws, in scene units: Excalidraw's
   * 20 screen px (`MINIMUM_ARROW_SIZE`), divided by the zoom.
   */
  minLinear?: () => number;
  /**
   * While drawing a line click by click, how near the last point a click
   * finishes it, in scene units: Excalidraw's `LINE_CONFIRM_THRESHOLD`, 8
   * screen px, divided by the zoom.
   */
  confirmDistance?: () => number;
  /** An arrow's label box in scene space, as the stage draws it, for sliding it. */
  labelBounds?: (id: ElementId) => Box | null;
  /**
   * The style keys a new element of a kind is written with: the style last
   * chosen (`current-style.ts`). None when not given.
   */
  newStyle?: (type: SceneElement['type']) => Record<string, unknown>;
  /**
   * Whether an arrow's ends attach to shapes (Settings ▸ Canvas, on by
   * default); Cmd/Ctrl turns it over for a drag, as Excalidraw's.
   */
  bindingEnabled?: () => boolean;
  /** Whether an end snaps to a side's middle (Settings ▸ Canvas, on by default). */
  midpointSnap?: () => boolean;
  /**
   * How far an arrow's label is dragged before it slides, in scene units:
   * Excalidraw's 10 screen px (`--size-label-drag`) over the zoom.
   */
  labelDrag?: () => number;
  /** How a code block is measured: the mono advance, line height and padding. */
  codeMetrics?: (element?: SceneElement) => CodeMetrics;
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
  endpoint: { id: ElementId; index: number; original: SceneElement; at: Point } | null;
  /**
   * Set when the press landed on a point of a selected line or arrow that is
   * not an attachable end (a bend, or a line's end), or on the middle of a
   * segment, which inserts a point there (`insert`). `index` is the point's
   * position in the list.
   */
  bend?: { id: ElementId; index: number; insert: boolean; original: SceneElement; at: Point };
  /**
   * Set when the press landed on the middle of a selected elbow's segment:
   * it moves across itself and stays there (a fixed segment).
   */
  segment?: { id: ElementId; index: number; original: SceneElement };
  /**
   * Set when the press landed on an attached end's anchor disc: the anchor
   * moves, onto another shape re-attaches, off every shape the end lets go.
   * `offset` keeps the disc where it was grabbed.
   */
  focus?: { id: ElementId; side: 'start' | 'end'; original: SceneElement; offset: Point };
  /** Set when the press landed on the selected arrow's label, which slides along it. */
  label?: { id: ElementId; original: SceneElement };
  /**
   * Set in point editing when the press took points: they move together.
   * `deselect`: a Shift-press on a selected point, which drops it only if the
   * press is released without a drag (Excalidraw's).
   */
  points?: { id: ElementId; indices: number[]; original: SceneElement; deselect?: number };
  /** Set in point editing for a press that changes nothing when dragged. */
  inert?: boolean;
  /**
   * Set in point editing by an Alt-press: a point added there, after the last
   * (before an attached end), which the same press drags. `index` is where.
   */
  append?: { id: ElementId; original: SceneElement; index: number; at: Point };
  /** Set in point editing by a press off the line on empty canvas: a box that selects points. */
  pointMarquee?: { additive: boolean };
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
  // Cmd/Ctrl, likewise: held while an arrow end is dropped, it stays free.
  let mod = false;
  /**
   * Alt and Cmd/Ctrl as they were at the press that started a line or arrow:
   * they decide its start end (pinned, or free), as Excalidraw reads them
   * (`App.tsx:10142-10148`, `:10404`); the release decides the other end.
   */
  let pressed = { alt: false, mod: false };
  // Point editing (06.13): the line or arrow whose points are being edited,
  // and which of them are selected, by index.
  let pointEditing: { id: ElementId; selected: number[] } | null = null;
  // Click-by-click drawing (06.13): the line or arrow being drawn, its points
  // so far in scene space, and the id it will have.
  let clicking: { type: 'line' | 'arrow'; points: Point[]; id: string } | null = null;
  // Whether the last release finished a line drawn click by click: the
  // double-click that did it must not then open that line's points.
  let justFinishedClicking = false;
  // Where the pointer last was, for what the stage draws mid-drag.
  let lastPoint: Point = { x: 0, y: 0 };
  // The copies an Alt-drag made, selected once it is released.
  let copied: ElementId[] = [];
  // Where a dragged arrow end is aimed, grab offset and snap included, so the
  // highlight names the shape the release would attach to.
  let endAim: Point | null = null;
  // Half a handle's side, in scene units: the caller divides the on-screen size
  // by the zoom. The zone matches the drawn handle, no larger.
  const handleSize = options.handleSize ?? (() => 4);
  const eraserTolerance = options.eraserTolerance ?? (() => 3);
  // The eraser's brush width and the slop on a click are different decisions.
  const hitTolerance = options.hitTolerance ?? (() => 7);
  // The token's value at zoom 1, as the other defaults do: a test that presses
  // at a gap the app never uses cannot catch a gap regression.
  const rotateGap = options.rotateGap ?? (() => 16);
  // The token's value at zoom 1, as the others.
  const dragThreshold = options.dragThreshold ?? (() => 3);
  const reach = options.bindingReach ?? (() => BINDING_REACH_MIN);
  // The token's value at zoom 1, as the others.
  const bendMinSegment = options.bendMinSegment ?? (() => 40);
  const pointHit = options.pointHit ?? (() => 11);
  const segmentMin = options.segmentMin ?? (() => 5);
  const pointHandle = options.pointHandle ?? (() => 10);
  const bentBoxPadding = options.bentBoxPadding ?? (() => 10);
  const bendInsertDistance = options.bendInsertDistance ?? (() => 10);
  const minLinear = options.minLinear ?? (() => 20);
  const confirmDistance = options.confirmDistance ?? (() => 8);
  const newStyle = options.newStyle ?? (() => ({}));
  const bindingEnabled = options.bindingEnabled ?? (() => true);
  const labelDrag = options.labelDrag ?? (() => 10);
  const midpointSnap = options.midpointSnap ?? (() => true);
  /** Whether an end being placed attaches: the setting, turned over by Cmd/Ctrl. */
  const attaching = (held = mod) => bindingEnabled() !== held;
  /** Whether a new arrow would be an elbow, by the style it would take. */
  const drawsElbow = () => (newStyle('arrow') as { arrowType?: unknown }).arrowType === 'elbow';

  /**
   * Where a dragged point goes: the pointer, plus the offset from where the
   * point was grabbed, so it does not jump to the cursor; with Shift, snapped
   * to 15° steps about its neighbouring point.
   */
  function aimedPoint(point: Point, drag: Drag, at: Point, neighbour: Point | null): Point {
    const aimed = { x: point.x + at.x - drag.origin.x, y: point.y + at.y - drag.origin.y };
    if (!shift || !neighbour) return aimed;
    // The angle the segment had at the press is a step of its own (C12).
    const own = (Math.atan2(at.y - neighbour.y, at.x - neighbour.x) * 180) / Math.PI;
    return snapAngle(neighbour, aimed, ANGLE_STEP, own);
  }

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
      if (!isLinear(e.type)) return containsPoint(e, point);
      if (nearElement(e, point, tolerance) || insideFilledLine(e, point)) return true;
      // An arrow's label is part of it where it reaches past the line
      // (Excalidraw's `App.tsx:6844-6852`).
      if (e.type === 'arrow' && 'label' in e && e.label) {
        const box = options.labelBounds?.(e.id);
        if (box && point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) return true;
      }
      // Selected alone and showing a box (a bent line), it is hit anywhere in
      // the box as drawn, its padding included (Excalidraw's `App.tsx:6824-6842`).
      if (selection.ids.length !== 1 || !selection.has(e.id)) return false;
      const chrome = chromeFor([e], currentEditing()?.id ?? null);
      return chrome.box && containsPoint({ ...e, ...grown(e, chrome.padded ? bentBoxPadding() : tolerance) }, point);
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

  /**
   * What a drag of the body moves, as Excalidraw's (`dragElements.ts:46-67`):
   * an attached elbow alone not at all (its route belongs to its shapes), and
   * an elbow attached at both ends only when both its shapes move too.
   */
  function movable(targets: SceneElement[]): SceneElement[] {
    const bound = (e: SceneElement) => isElbow(e) && Boolean(bindingsOf(e).start ?? bindingsOf(e).end);
    if (targets.length === 1 && bound(targets[0])) return [];
    const ids = new Set(targets.map((e) => e.id));
    return targets.filter((e) => {
      if (!isElbow(e)) return true;
      const { start, end } = bindingsOf(e);
      return start === undefined || end === undefined || (ids.has(start) && ids.has(end));
    });
  }

  /**
   * What moves with a drag, plus every arrow with both ends on one shape
   * that moves: its bends go with it (Excalidraw's
   * `linearElementEditor.ts:1706-1713`).
   */
  function withLoops(targets: SceneElement[]): SceneElement[] {
    const ids = new Set(targets.map((e) => e.id));
    const loops = history.current.elements.filter((e) => {
      if (e.type !== 'arrow' || ids.has(e.id)) return false;
      const { start, end } = bindingsOf(e);
      return start !== undefined && start === end && ids.has(start);
    });
    return [...targets, ...loops];
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

    /**
     * Whether undo and redo must wait: a drag is down or a line is being
     * drawn by clicks (Excalidraw's `actions/actionHistory.tsx:26-45`).
     */
    get holdsHistory(): boolean {
      return drag !== null || clicking !== null;
    },

    /** Whether the drag in progress slides an arrow's label, for the cursor. */
    get draggingLabel(): boolean {
      return Boolean(drag?.label);
    },

    /** The marquee rectangle while one is being dragged, for the stage to draw. */
    get marquee(): Box | null {
      return marquee;
    },

    /**
     * The shapes the arrow being drawn would attach to, for the stage to
     * highlight. Empty when nothing is being drawn, when Cmd/Ctrl is held, or when
     * neither end is over a shape.
     */
    get bindingCandidates(): ElementId[] {
      // What each end would attach to: the start as the press left it, the
      // end as held now (Cmd/Ctrl frees an end).
      const both = (start: Point, end: Point, id: string) => {
        const ids = [attaching(pressed.mod) ? targetAt(history.current, start, id, reach())?.id : undefined, attaching() ? targetAt(history.current, end, id, reach())?.id : undefined];
        return ids.filter((found, i) => found !== undefined && ids.indexOf(found) === i) as ElementId[];
      };
      // A clicked arrow shows what its first point and the pointer would attach to.
      if (clicking?.type === 'arrow') return both(clicking.points[0], lastPoint, clicking.id);
      // With the Arrow tool, before any press: the shape a press would start on.
      if (!drag) {
        if (tools.active !== 'arrow' || !attaching()) return [];
        const under = targetAt(history.current, lastPoint, '', reach());
        return under ? [under.id] : [];
      }
      if (!attaching() && drag.endpoint) return [];
      // An end of an existing arrow being dragged: what it would attach to,
      // by the rule the release uses (with Shift, under the pointer).
      if (drag.endpoint) {
        const { id, at } = drag.endpoint;
        const grabbed = { x: lastPoint.x + at.x - drag.origin.x, y: lastPoint.y + at.y - drag.origin.y };
        const target = targetAt(history.current, shift ? grabbed : (endAim ?? lastPoint), id, reach());
        return target && farEnough(drag.origin, lastPoint) ? [target.id] : [];
      }
      if (tools.active !== 'arrow') return [];
      // The same endpoint the release would bind, Shift snapping included, so
      // the highlight cannot name a shape the drop would miss.
      return both(drag.origin, shift ? snapAngle(drag.origin, lastPoint) : lastPoint, drag.newId);
    },

    /**
     * The spots an elbow end being dragged can snap to on the shape it would
     * attach to, for the stage to show as dots (Excalidraw's elbow midpoints).
     * Empty for any other drag.
     */
    get snapSpots(): Point[] {
      if (!midpointSnap() || shift) return [];
      const elbowEnd = Boolean(drag?.endpoint && isElbow(drag.endpoint.original));
      // An elbow shows every middle it can snap to; a straight or curved
      // arrow the nearest, once the end is within twice the reach of it and
      // outside the shape (Excalidraw's `interactiveScene.ts:503-529`).
      const end = drag?.endpoint ? (endAim ?? lastPoint) : drag && tools.active === 'arrow' ? lastPoint : null;
      if (!end) return [];
      return this.bindingCandidates.flatMap((id) => {
        const shape = history.current.elements.find((e) => e.id === id);
        if (!shape) return [];
        if (elbowEnd) return elbowSnapSpots(shape);
        if (isInside(shape, end)) return [];
        const middle = nearestMiddle(shape, end, reach() * 2);
        return middle ? [middle.at] : [];
      });
    },

    down(point: Point, options: { additive?: boolean; alt?: boolean; mod?: boolean; shift?: boolean } = {}): void {
      shift = Boolean(options.shift);
      // A clicked line keeps what its first press held for its start.
      if (!clicking) pressed = { alt: Boolean(options.alt), mod: Boolean(options.mod) };
      endAim = null;
      justFinishedClicking = false;
      // While a line is drawn click by click, a press is the next click: it
      // draws nothing of its own, and its release adds the point.
      if (clicking && (tools.active === 'line' || tools.active === 'arrow')) {
        lastPoint = point;
        drag = inertDrag(point);
        return;
      }
      alt = false;
      mod = false;
      lastPoint = point;
      if (tools.active === 'eraser') {
        erasing = new Set();
        trailEnd = point;
        trail = [point.x, point.y];
        drag = { origin: point, moving: [], originals: new Map(), strokePoints: [], resize: null, rotate: null, endpoint: null, newId: '' };
        return;
      }

      // Point editing takes a press first: on a point, on a middle, Alt-click
      // to add one; anywhere off the line ends the mode.
      // A press that ends the mode must not then take the box handles the mode
      // hid: they were not drawn when it landed.
      const wasEditing = currentEditing()?.id ?? null;
      if (wasEditing && tools.active === 'select' && pressInPointEditing(point, options)) return;

      // One selected arrow: its ends are handles of their own, and they win
      // over the box handles, which sit on the same corners for a thin box.
      // Not with Shift: a Shift-press on the selected element is a click
      // that removes it from the selection, wherever it lands.
      if (tools.active === 'select' && selection.ids.length === 1 && !options.additive) {
        const end = endpointAt(point);
        // A bend, a line's end or a segment's middle: after an arrow's ends,
        // before the box handles, which share their corners on a thin box.
        const focus = end ? null : focusAt(point);
        const bend = end || focus ? null : bendAt(point);
        // An elbow's segment handle.
        const segment = end ? null : segmentAt(point);
        // Every handle beats the label over it, a middle included, so a
        // labelled arrow can still be bent (Excalidraw's, S8); the rest of the
        // label slides it.
        const label = end || focus || segment || bend ? null : labelAt(point);
        if (end || focus || bend || segment || label) {
          drag = {
            origin: point,
            moving: [],
            originals: new Map(),
            strokePoints: [],
            resize: null,
            rotate: null,
            endpoint: end,
            bend: bend ?? undefined,
            segment: segment ?? undefined,
            focus: focus ?? undefined,
            label: label ?? undefined,
            newId: '',
          };
          return;
        }
      }

      // A selection handle wins over whatever lies beneath it.
      const boxHandle = tools.active === 'select' ? boxHandleAt(point, wasEditing) : null;
      if (boxHandle?.kind === 'rotate') {
        const { centre, selected } = boxHandle;
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
      if (boxHandle?.kind === 'resize') {
        const { handle, bounds, angle } = boxHandle;
        drag = {
          origin: point,
          moving: [],
          originals: new Map(),
          strokePoints: [],
          // A group resizes with its children; a frame alone, since what it
          // holds keeps its own size and place (membership is re-checked
          // after, as for any change).
          resize: { handle, bounds, angle, originals: new Map(resized().map((e) => [e.id, e])) },
          rotate: null,
          endpoint: null,
          newId: '',
        };
        return;
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
      const targets = drags ? withLoops(movable(dragTargets())) : [];
      const moving = targets.map((e) => e.id);
      const originals = new Map<ElementId, { x: number; y: number }>();
      for (const element of targets) {
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
        // A press on what cannot be dragged (an attached elbow alone) drags
        // nothing, and is no marquee either; released, it is still a click.
        inert: drags && hits.length > 0 && targets.length === 0 ? true : undefined,
      };
    },

    move(point: Point, options: { alt?: boolean; mod?: boolean; shift?: boolean } = {}): void {
      // Read whether or not a press is down: a line drawn click by click has
      // none between clicks, and its finish uses what is held then.
      alt = Boolean(options.alt);
      mod = Boolean(options.mod);
      lastPoint = point;
      if (!drag) return;
      shift = Boolean(options.shift);
      alt = Boolean(options.alt);
      mod = Boolean(options.mod);
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
      if (tools.active === 'select' && !drag.resize && !drag.rotate && !drag.endpoint && !drag.bend && !drag.segment && !drag.focus && !drag.append && !drag.label && !drag.points && !drag.inert && drag.moving.length === 0) {
        marquee = boxBetween(drag.origin, point);
      }
    },

    /** Whether a line or arrow is being drawn click by click. */
    get drawingPoints(): boolean {
      return clicking !== null;
    },

    /** The scene with the line being drawn click by click, running to `point`. */
    pointsPreview(point: Point, options: { shift?: boolean } = {}): SceneData | null {
      if (!clicking) return null;
      const last = clicking.points[clicking.points.length - 1];
      // Back on the last point, the next segment is not drawn: a click there
      // finishes (Excalidraw's `App.tsx:8066-8101`). Shift snaps it to 15°.
      const onLast = Math.hypot(point.x - last.x, point.y - last.y) <= confirmDistance();
      const next = options.shift ? snapAngle(last, point) : point;
      const points = onLast ? clicking.points : [...clicking.points, next];
      if (points.length < 2) return history.current;
      const element = linearFrom(clicking.type, clicking.id, points);
      return produce(history.current, (draft: SceneData) => {
        draft.elements.push(element as never);
      });
    },

    /**
     * While Alt is held in point editing, the line with the point an
     * Alt-click would add, running to `point` (Shift snaps it); null
     * otherwise (Excalidraw's `linearElementEditor.ts:1099-1140`).
     */
    appendPreview(point: Point, options: { shift?: boolean } = {}): SceneData | null {
      const editing = currentEditing();
      if (!editing || drag) return null;
      const element = history.current.elements.find((e) => e.id === editing.id)!;
      const base = unturned(element);
      const points = [...(('points' in base ? base.points : []) as number[])];
      const endBound = (element.type === 'arrow' && (element as SceneElement & ArrowProps).endBinding !== undefined) || isClosed(element);
      const at = endBound ? points.length - 2 : points.length;
      const previous = { x: base.x + points[at - 2], y: base.y + points[at - 1] };
      const target = options.shift ? snapAngle(previous, point) : point;
      points.splice(at, 0, tidy(target.x - base.x), tidy(target.y - base.y));
      return produce(history.current, (draft: SceneData) => {
        const i = draft.elements.findIndex((e) => e.id === editing.id);
        if (i >= 0) draft.elements[i] = settledAround(base, points) as never;
      });
    },

    /** Finish the line being drawn click by click (Enter, Escape). */
    finishPoints(options: { keepTool?: boolean } = {}): void {
      finishClicking(options);
    },

    /** Escape: finish a line being clicked, else leave point editing. Whether it did. */
    escape(): boolean {
      if (clicking) {
        finishClicking();
        return true;
      }
      if (currentEditing()) {
        pointEditing = null;
        return true;
      }
      return false;
    },

    /** Enter: finish a line being clicked, or edit the points of a selected line. */
    enter(): boolean {
      if (clicking) {
        finishClicking();
        return true;
      }
      const [only] = selection.ids;
      const element = selection.ids.length === 1 ? history.current.elements.find((e) => e.id === only) : undefined;
      return element?.type === 'line' && this.editPoints(element.id);
    },

    /**
     * Delete in point editing: the selected points. With none selected the
     * mode ends and the caller deletes the line itself. Whether it was taken.
     */
    deletePoints(): boolean {
      const editing = currentEditing();
      if (!editing) return false;
      // With none selected, nothing: deleting the line is most likely a
      // mistake (Excalidraw's `actionDeleteSelected.tsx:225-231`).
      if (editing.selected.length === 0) return true;
      this.removeSelectedPoints();
      return true;
    },

    /**
     * A double-click with Select: on a line, or on an arrow with Cmd/Ctrl (a
     * plain one types its label), edit its points and select it. Not on the
     * double-click that finished a line drawn click by click.
     */
    doubleClick(point: Point, options: { mod?: boolean } = {}): boolean {
      if (tools.active !== 'select' || justFinishedClicking) return false;
      const hits = elementsAt(point);
      const hit = hits[hits.length - 1];
      if (!hit || !(hit.type === 'line' || (hit.type === 'arrow' && options.mod))) return false;
      if (!this.editPoints(hit.id)) return false;
      selection.clear();
      selection.click(hit.id);
      return true;
    },

    /** The line or arrow in point editing, and its selected points; or null. */
    get editingPoints(): { id: ElementId; selected: number[] } | null {
      const editing = currentEditing();
      return editing ? { id: editing.id, selected: [...editing.selected] } : null;
    },

    /** Edit a line's or arrow's points (an elbow's route is its own). */
    editPoints(id: ElementId): boolean {
      const element = history.current.elements.find((e) => e.id === id);
      if (!element || (element.type !== 'line' && element.type !== 'arrow') || isLocked(element)) return false;
      if ((element as { arrowType?: string }).arrowType === 'elbow') return false;
      pointEditing = { id, selected: [] };
      return true;
    },

    stopEditingPoints(): void {
      pointEditing = null;
    },

    /** Remove the selected points, as one step; a line left with fewer than two distinct points goes. */
    removeSelectedPoints(): boolean {
      const editing = currentEditing();
      if (!editing || editing.selected.length === 0) return false;
      const element = history.current.elements.find((e) => e.id === editing.id);
      if (!element) return false;
      const base = unturned(element);
      const all = ('points' in base ? base.points : []) as number[];
      const gone = new Set(editing.selected);
      // A closed line loses its first and last together, and closes again.
      const loop = isClosed(base) ? removeFromLoop(all, gone) : null;
      // Fewer than two left is no line: it goes, as Excalidraw's
      // (`actionDeleteSelected.tsx:233-251`).
      // A loop counts its closing point once.
      if ((loop ? loop.points.length / 2 - 1 : all.length / 2 - gone.size) < 2) {
        history.mutate((scene) => {
          scene.elements = scene.elements.filter((e) => e.id !== element.id);
        });
        pointEditing = null;
        selection.clear();
        return true;
      }
      const points = loop ? loop.points : all.filter((_, i) => !gone.has(Math.floor(i / 2)));
      history.mutate((scene) => {
        const i = scene.elements.findIndex((e) => e.id === element.id);
        if (i < 0) return;
        const settled = settledAround(base, points) as SceneElement & { closed?: boolean; fill?: string };
        // Too few corners left for a loop: open, and its fill goes with it.
        if (loop && !loop.closed) {
          delete settled.closed;
          delete settled.fill;
        }
        scene.elements[i] = settled;
      });
      // The point before the first one removed is selected, in the new numbering.
      const kept = loop ? loop.kept : all.map((_, i) => i).filter((i) => i % 2 === 0 && !gone.has(i / 2)).map((i) => i / 2);
      editing.selected = [Math.max(0, kept.indexOf(Math.min(...editing.selected) - 1))];
      return true;
    },

    /**
     * Duplicate the selected points, as one step: each gains a copy halfway
     * to the next point, and the last one a copy 30, 30 away; the copies are
     * selected (Excalidraw's `linearElementEditor.ts:1500-1574`). Returns
     * whether it did, so `⌘`/`Ctrl`+`D` duplicates nothing else.
     */
    duplicatePoints(): boolean {
      const editing = currentEditing();
      if (!editing) return false;
      // In the mode, Duplicate is the points', none selected or not.
      if (editing.selected.length === 0) return true;
      const element = history.current.elements.find((e) => e.id === editing.id);
      if (!element) return true;
      const base = unturned(element);
      const points = [...(('points' in base ? base.points : []) as number[])];
      // A loop's closing point is its first: its copy goes towards the second.
      const closingIndex = isClosed(base) ? points.length / 2 - 1 : -1;
      const chosen = [...new Set(editing.selected.map((i) => (i === closingIndex ? 0 : i)))].sort((a, b) => a - b);
      const copies: number[] = [];
      let added = 0;
      for (const index of chosen) {
        const at = index + added;
        const last = at * 2 + 2 >= points.length;
        const [x, y] = [points[at * 2], points[at * 2 + 1]];
        const copy = last
          ? [x + DUPLICATE_POINT_OFFSET, y + DUPLICATE_POINT_OFFSET]
          : [(x + points[at * 2 + 2]) / 2, (y + points[at * 2 + 3]) / 2];
        points.splice(at * 2 + 2, 0, ...copy.map(tidy));
        copies.push(at + 1);
        added += 1;
      }
      history.mutate((scene) => {
        const i = scene.elements.findIndex((e) => e.id === element.id);
        if (i >= 0) scene.elements[i] = settledAround(base, points);
      });
      editing.selected = copies;
      return true;
    },

    /** Select All while editing points does nothing (Excalidraw's). Whether it took it. */
    selectAll(): boolean {
      return currentEditing() !== null;
    },

    /**
     * What is under a point, for the cursor (`cursor.ts`), by the rules a
     * press there would follow: the confirm zone while drawing by clicks; a
     * handle of the one selected line or arrow; a box handle; the label; or
     * an element, and whether a drag would move it. Null over nothing.
     */
    cursorTarget(point: Point): CursorTarget | null {
      if (clicking && (tools.active === 'line' || tools.active === 'arrow')) {
        const last = clicking.points[clicking.points.length - 1];
        return Math.hypot(point.x - last.x, point.y - last.y) <= confirmDistance() ? { kind: 'confirm' } : null;
      }
      if (tools.active !== 'select') return null;
      const editing = currentEditing();
      if (editing) {
        const found = bendAt(point);
        if (found) return { kind: found.insert ? 'middle' : 'point' };
        if (endpointAt(point)) return { kind: 'point' };
      }
      if (selection.ids.length === 1) {
        if (endpointAt(point)) return { kind: 'point' };
        if (focusAt(point)) return { kind: 'focus' };
        const bend = bendAt(point);
        if (bend) return { kind: bend.insert ? 'middle' : 'point' };
        if (segmentAt(point)) return { kind: 'segment' };
        if (labelAt(point)) return { kind: 'label' };
      }
      const box = boxHandleAt(point, editing?.id ?? null);
      if (box?.kind === 'rotate') return { kind: 'rotate' };
      if (box?.kind === 'resize') return { kind: 'resize', handle: box.handle, angle: box.angle };
      const hits = elementsAt(point);
      const top = hits[hits.length - 1];
      if (!top) return null;
      // What a press there would drag: the selection when it is in it, else it alone.
      const ids = selection.has(top.id) ? selection.ids : [top.id];
      return { kind: 'element', movable: movable(carriedWith(history.current, ids)).length > 0 };
    },

    /**
     * Where the handle under a point is, for the stage's hover disc: an end,
     * a point or a middle of the one selected line or arrow, or a segment's
     * middle of an elbow. Null during a drag, or over none.
     */
    hoveredHandle(point: Point): Point | null {
      if (drag || tools.active !== 'select' || selection.ids.length !== 1) return null;
      const end = endpointAt(point);
      if (end) return end.at;
      const focus = focusAt(point);
      if (focus) return { x: point.x - focus.offset.x, y: point.y - focus.offset.y };
      const bend = bendAt(point);
      if (bend) return bend.at;
      const segment = segmentAt(point);
      if (!segment) return null;
      return elbowSegmentHandles(segment.original, segmentMin()).find((h) => h.index === segment.index)?.at ?? null;
    },

    /**
     * Let go of the fixed elbow segment whose handle is under a point, as one
     * step: the route between its fixed neighbours is worked out again, or
     * the whole route when it was the last. Returns whether one was released,
     * so the caller skips its own double-click behaviour.
     */
    releaseSegmentAt(point: Point): boolean {
      const found = segmentAt(point);
      if (!found) return false;
      const { id, index, original } = found;
      const fixed = fixedOf(original);
      if (!fixed.includes(index)) return false;
      const points = ('points' in original ? original.points : []) as number[];
      const world: Point[] = [];
      for (let i = 0; i + 1 < points.length; i += 2) world.push({ x: original.x + points[i], y: original.y + points[i + 1] });
      const { start, end } = bindingsOf(original);
      const find = (key?: string) => (key === undefined ? undefined : history.current.elements.find((e) => e.id === key));
      const { from, to } = elbowEnds(original, points, find(start), find(end));
      const released = releaseSegment(world, fixed, index, from, to, (a, b) => routeElbow(a, b, { gap: BINDING_GAP }));
      history.mutate((scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        if (!released) {
          // The last fixed segment: the arrow is routed whole again (`reroute`).
          scene.elements[i] = withFixed(scene.elements[i], []);
          return;
        }
        const flat = released.points.flatMap((p) => [p.x, p.y]);
        scene.elements[i] = settledAround(withFixed({ ...original, x: 0, y: 0, points: flat } as SceneElement, released.fixed), flat);
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
    preview(point: Point, options: { alt?: boolean; mod?: boolean; shift?: boolean } = {}): SceneData | null {
      if (!drag) return null;
      shift = Boolean(options.shift);
      // Alt, like Shift, can change with the pointer still: an Alt-move copies.
      if (options.alt !== undefined) alt = options.alt;
      if (options.mod !== undefined) mod = options.mod;
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
    up(point: Point, options: { alt?: boolean; mod?: boolean; shift?: boolean } = {}): ElementId | null {
      if (!drag) return null;
      shift = Boolean(options.shift);
      alt = Boolean(options.alt);
      mod = Boolean(options.mod);
      const started = drag;
      drag = null;
      marquee = null;

      // A box dragged in point editing selects the points inside it (Shift
      // adds); a click there instead leaves the mode, as a click on empty
      // canvas clears the selection.
      if (started.pointMarquee) {
        const editing = currentEditing();
        if (!editing) return null;
        if (farEnough(started.origin, point)) {
          const box = boxBetween(started.origin, point);
          const element = history.current.elements.find((e) => e.id === editing.id)!;
          const drawn = drawnPoints(element);
          const inside: number[] = [];
          for (let i = 0; i < drawn.length / 2; i += 1) {
            const [x, y] = [drawn[i * 2], drawn[i * 2 + 1]];
            if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) inside.push(i);
          }
          editing.selected = [...new Set([...(started.pointMarquee.additive ? editing.selected : []), ...inside])].sort((a, b) => a - b);
        } else {
          pointEditing = null;
          selection.clear();
        }
        return null;
      }
      // A Shift-press on a selected point that did not drag drops it.
      if (started.points?.deselect !== undefined && !farEnough(started.origin, point)) {
        const editing = currentEditing();
        if (editing) editing.selected = editing.selected.filter((i) => i !== started.points!.deselect);
        return null;
      }

      // Drawing click by click: each click adds a point; a click on the last
      // one finishes the line.
      if (clicking && (tools.active === 'line' || tools.active === 'arrow')) {
        const last = clicking.points[clicking.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) <= confirmDistance()) {
          finishClicking();
          return null;
        }
        // Shift snaps the new segment to 15° about the last point.
        const next = shift ? snapAngle(last, point) : point;
        const first = clicking.points[0];
        // A line clicked back on its first point finishes there, closed into a
        // loop when it has a corner to go round (Excalidraw's `isPathALoop`).
        if (clicking.type === 'line' && clicking.points.length >= 2 && Math.hypot(next.x - first.x, next.y - first.y) <= confirmDistance()) {
          clicking.points.push({ ...first });
          finishClicking({ closed: clicking.points.length >= 4 });
          return null;
        }
        clicking.points.push(next);
        // An elbow is only its two ends: the second click finishes it
        // (Excalidraw's `App.tsx:10180-10191`).
        if (clicking.type === 'arrow' && drawsElbow()) {
          finishClicking();
          return null;
        }
        // An arrow clicked just outside a shape attaches there and finishes
        // (Excalidraw's `App.tsx:10221-10255`); inside one it is a point.
        if (clicking.type === 'arrow' && attaching()) {
          const target = targetAt(history.current, next, clicking.id, reach());
          if (target && !isInside(target, next)) finishClicking();
        }
        return null;
      }

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

      if (tools.active === 'select' && !started.resize && !started.rotate && !started.endpoint && !started.bend && !started.segment && !started.focus && !started.append && !started.label && !started.points && !started.inert && started.moving.length === 0) {
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
        // At the size it is given (the last one chosen), as it will be drawn.
        const size = measureCode('', codeMetrics({ type: 'code', ...newStyle('code') } as unknown as SceneElement));
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
            ...newStyle('code'),
          } as SceneElement);
        });
        return id;
      }

      // One step for the whole gesture, however many move events it had.
      copied = [];
      // A line or arrow press released before the minimum length starts one
      // drawn click by click, from where the press was (Excalidraw's).
      if ((tools.active === 'line' || tools.active === 'arrow') && Math.hypot(point.x - started.origin.x, point.y - started.origin.y) < minLinear()) {
        clicking = { type: tools.active, points: [started.origin], id: started.newId };
        return null;
      }
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
      if (drawn && history.current.elements.some((e) => e.id === started.newId)) afterDraw(started.newId);
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
      const kept = new Set(originals.keys());
      return (scene) => {
        for (let i = 0; i < scene.elements.length; i += 1) {
          const replacement = turned.get(scene.elements[i].id);
          if (replacement) scene.elements[i] = letGoOutside(replacement, kept);
        }
      };
    }

    if (started.inert) return null;

    if (started.append) {
      // Added at the press, whether or not it is then dragged; Shift snaps
      // it to 15° about the point before it.
      const { id, original, index, at } = started.append;
      const base = unturned(original);
      const points = [...(('points' in base ? base.points : []) as number[])];
      const previous = { x: base.x + points[index * 2 - 2], y: base.y + points[index * 2 - 1] };
      // Shift snaps to 15° steps, as its preview did (no own angle: it is new).
      const aimed = farEnough(started.origin, point) ? { x: point.x + at.x - started.origin.x, y: point.y + at.y - started.origin.y } : at;
      const target = shift ? snapAngle(previous, aimed) : aimed;
      points.splice(index * 2, 0, tidy(target.x - base.x), tidy(target.y - base.y));
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i >= 0) scene.elements[i] = settledAround(base, points);
      };
    }

    if (started.points) {
      const { id, indices, original } = started.points;
      if (!farEnough(started.origin, point)) return null;
      const base = unturned(original);
      const points = [...(('points' in base ? base.points : []) as number[])];
      // One point with Shift snaps to 15° about its neighbour, or to the angle
      // it started at (Excalidraw's `linearElementEditor.ts:542-556`).
      if (shift && indices.length === 1 && points.length >= 4) {
        const index = indices[0];
        const next = index === 0 ? 1 : index - 1;
        const at = { x: base.x + points[index * 2], y: base.y + points[index * 2 + 1] };
        const neighbour = { x: base.x + points[next * 2], y: base.y + points[next * 2 + 1] };
        const target = aimedPoint(point, started, at, neighbour);
        points[index * 2] = tidy(target.x - base.x);
        points[index * 2 + 1] = tidy(target.y - base.y);
        const settled = settleLine(base, points, indices);
        return (scene) => {
          const i = scene.elements.findIndex((e) => e.id === id);
          if (i >= 0) scene.elements[i] = settled;
        };
      }
      const dx = point.x - started.origin.x;
      const dy = point.y - started.origin.y;
      for (const index of indices) {
        // Never beyond the points there are: a stale index would write NaN.
        if (index * 2 + 1 >= points.length) continue;
        points[index * 2] += dx;
        points[index * 2 + 1] += dy;
      }
      const settled = settleLine(base, points, indices);
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i >= 0) scene.elements[i] = settled;
      };
    }

    if (started.label) {
      const { id, original } = started.label;
      // A label slides only once dragged a little way, as Excalidraw's.
      if (Math.hypot(point.x - started.origin.x, point.y - started.origin.y) <= labelDrag()) return null;
      const props = original as SceneElement & ArrowProps;
      // The path as drawn, which the stage centres the label on.
      const routed = smoothPoints(pathOf((('points' in original ? original.points : []) as number[]), props.arrowType), tensionOf(original));
      // The label moves with the pointer, kept on the path: where it was, moved
      // by the drag, then brought to the nearest point along the arrow.
      const from = labelSpot(original, tensionOf(original), routed);
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

    if (started.focus) {
      const { id, side, original, offset } = started.focus;
      if (!farEnough(started.origin, point)) return null;
      const aimed = { x: point.x - offset.x, y: point.y - offset.y };
      // The other end's shape too: both ends may be on one (B16).
      const target = attaching() ? targetAt(history.current, aimed, id, reach()) : undefined;
      const [key, anchorKey, modeKey] = [`${side}Binding`, `${side}Anchor`, `${side}Mode`];
      // Off every shape, the end itself goes there, free.
      const base = unturned(original);
      const points = [...(('points' in base ? base.points : []) as number[])];
      const at = side === 'start' ? 0 : points.length - 2;
      points[at] = aimed.x - base.x;
      points[at + 1] = aimed.y - base.y;
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        if (target) {
          const bound = { ...scene.elements[i] } as unknown as Record<string, unknown>;
          bound[key] = target.id;
          // Exactly where it is put: the end aims through it (Alt pins it there).
          bound[anchorKey] = anchorFor(target, aimed, reach(), true);
          if (alt) bound[modeKey] = 'inside';
          else delete bound[modeKey];
          scene.elements[i] = bound as unknown as SceneElement;
          raiseAbove(scene.elements, id, target.id);
          return;
        }
        const loose = settledAround(base, points) as unknown as Record<string, unknown>;
        delete loose[key];
        delete loose[anchorKey];
        delete loose[modeKey];
        scene.elements[i] = loose as unknown as SceneElement;
      };
    }

    if (started.segment) {
      const { id, index, original } = started.segment;
      // It moves at once, as Excalidraw's; a click without moving fixes nothing.
      if (point.x === started.origin.x && point.y === started.origin.y) return null;
      const points = ('points' in original ? original.points : []) as number[];
      const world: Point[] = [];
      for (let i = 0; i + 1 < points.length; i += 2) world.push({ x: original.x + points[i], y: original.y + points[i + 1] });
      const a = world[index - 1];
      const b = world[index];
      const across = Math.abs(b.y - a.y) <= Math.abs(b.x - a.x);
      // By the drag, from where it was: it does not jump to the pointer.
      const coordinate = tidy(across ? a.y + point.y - started.origin.y : a.x + point.x - started.origin.x);
      const { start, end } = bindingsOf(original);
      const find = (key?: string) => (key === undefined ? undefined : history.current.elements.find((e) => e.id === key));
      const { from, to } = elbowEnds(original, points, find(start), find(end));
      const moved = moveSegment(world, fixedOf(original), index, coordinate, from, to);
      const flat = moved.points.flatMap((p) => [p.x, p.y]);
      const base = withFixed({ ...original, x: 0, y: 0, points: flat } as SceneElement, moved.fixed);
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        // The ends re-aim and the legs adapt in the same step (`reroute`).
        if (i >= 0) scene.elements[i] = settledAround(base, flat);
      };
    }

    if (started.bend) {
      const { id, index, insert, original, at } = started.bend;
      // A click on a handle is not a drag: it neither moves nor adds a point.
      if (!farEnough(started.origin, point)) return null;
      // A middle adds a bend only once dragged a little way, as Excalidraw's.
      // In point editing it adds one at once (Excalidraw's).
      if (insert && pointEditing?.id !== id && Math.hypot(point.x - started.origin.x, point.y - started.origin.y) < bendInsertDistance()) return null;
      // A turned line has its turn written into its points first, so the
      // edit is in scene space and nothing else it draws moves.
      const base = unturned(original);
      const points = [...(('points' in base ? base.points : []) as number[])];
      // Its neighbour is the point before it (after it, for a line's start).
      const before = insert ? index - 1 : index === 0 ? 1 : index - 1;
      const neighbour = { x: base.x + points[before * 2], y: base.y + points[before * 2 + 1] };
      const target = aimedPoint(point, started, at, neighbour);
      const local = [target.x - base.x, target.y - base.y];
      if (insert) points.splice(index * 2, 0, ...local);
      else points.splice(index * 2, 2, ...local);
      const settled = settleLine(base, points, insert ? [] : [index]);
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        // The box is settled around the new points; an arrow's attached ends
        // re-aim in the same step (`reroute`).
        if (i >= 0) scene.elements[i] = settled;
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
      const modeKey = index === 0 ? 'startMode' : 'endMode';
      const record = original as SceneElement & Record<string, unknown>;
      const [otherKey, otherAnchorKey, otherModeKey] = index === 0 ? ['endBinding', 'endAnchor', 'endMode'] : ['startBinding', 'startAnchor', 'startMode'];
      const other = record[otherKey] as string | undefined;
      const elbow = isElbow(original);
      // Dropped on a shape it attaches, on empty canvas it lets go, and
      // Cmd/Ctrl holds it free (or, with attaching off, attaches it).
      const last = points.length - 2;
      const at = index === 0 ? 0 : last;
      const otherAt = index === 0 ? last : 0;
      const next = index === 0 ? 2 : last - 2;
      // Where the end goes: kept at its grab offset, snapped with Shift about
      // its neighbour.
      const neighbour = { x: original.x + points[next], y: original.y + points[next + 1] };
      const aimed = aimedPoint(point, started, started.endpoint.at, neighbour);
      endAim = aimed;
      // With Shift the shape is the one under the pointer, not under the
      // snapped end, and the side-middle snap is off (Excalidraw's
      // `element/src/binding.ts:733-749`).
      const grabbed = { x: point.x + started.endpoint.at.x - started.origin.x, y: point.y + started.endpoint.at.y - started.origin.y };
      const target = attaching() ? targetAt(history.current, shift ? grabbed : aimed, id, reach()) : undefined;
      // Both ends on one shape: allowed, both pinned where they are
      // (Excalidraw's `element/src/binding.ts:777-828`); an elbow routes round it.
      const sameShape = Boolean(target) && target!.id === other && !elbow;
      // The other end, which the edge anchor is carried from: its own anchor
      // on a two-point arrow attached there, else the neighbouring point.
      const otherShape = other !== undefined ? history.current.elements.find((e) => e.id === other) : undefined;
      const from = points.length === 4 && otherShape ? spotOn(otherShape, record[otherAnchorKey] as [number, number] | undefined) : neighbour;
      const otherPoint = { x: original.x + points[otherAt], y: original.y + points[otherAt + 1] };
      points[at] = aimed.x - original.x;
      points[at + 1] = aimed.y - original.y;
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        scene.elements[i] = settledAround(original, points);
        const bound = scene.elements[i] as SceneElement & Record<string, unknown>;
        // The binding and where on the target it aims go together.
        // Inside the shape, or anywhere on it with Alt, the end is pinned.
        const inside = Boolean(target) && (sameShape || pinnedAt(target!, aimed, original));
        if (target) {
          bound[key] = target.id;
          bound[anchorKey] = anchorFor(target, aimed, reach(), inside, elbow, from, !shift && midpointSnap());
          raiseAbove(scene.elements, id, target.id);
        } else {
          delete bound[key];
          delete bound[anchorKey];
        }
        if (inside) bound[modeKey] = 'inside';
        else delete bound[modeKey];
        if (sameShape && record[otherModeKey] !== 'inside') {
          bound[otherAnchorKey] = anchorFor(target!, otherPoint, reach(), true);
          bound[otherModeKey] = 'inside';
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
          const scaled = angle === 0 ? scaleRotatedInto(member, bounds, next) : scaleInto(member, bounds, next);
          scene.elements[i] = letGoOutside(scaled.type === 'code' ? codeResized(scaled) : scaled, new Set(originals.keys()));
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
          ...newStyle('stroke'),
        } as SceneElement);
      };
    }

    if (tools.active === 'select') {
      if (started.moving.length === 0) return null;
      // Under the threshold a press is a click, in the preview as on release.
      if (!farEnough(started.origin, point)) return null;
      // A lone attached arrow needs a real drag before it lets go of its
      // shapes: a nudge while selecting it would (Excalidraw's
      // `dragElements.ts:130-158`).
      if (started.moving.length === 1) {
        const only = history.current.elements.find((e) => e.id === started.moving[0]);
        const { start, end } = only?.type === 'arrow' ? bindingsOf(only) : {};
        const offset = Math.max(Math.abs(point.x - started.origin.x), Math.abs(point.y - started.origin.y));
        if ((start !== undefined || end !== undefined) && offset <= LONE_ARROW_DRAG) return null;
      }
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
          for (const [key, anchor, mode] of [
            ['startBinding', 'startAnchor', 'startMode'],
            ['endBinding', 'endAnchor', 'endMode'],
          ] as const) {
            const target = loose[key] as string | undefined;
            if (target === undefined || !order.has(target)) continue;
            delete loose[key];
            delete loose[anchor];
            delete loose[mode];
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
            for (const [key, anchor, mode] of [
              ['startBinding', 'startAnchor', 'startMode'],
              ['endBinding', 'endAnchor', 'endMode'],
            ] as const) {
              const target = bound[key] as string | undefined;
              // A target already gone stays named: the end is detached, and
              // re-aims if it comes back.
              if (target === undefined || started.originals.has(target)) continue;
              if (!scene.elements.some((other) => other.id === target)) continue;
              delete bound[key];
              delete bound[anchor];
              delete bound[mode];
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
    // Under the minimum length it is still drawn (Excalidraw's, from the
    // first move): released there, `up` goes on drawing it click by click.
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
            ...(type === 'arrow' ? bindingsFor(started.origin, end, started.newId) : {}),
          }
        : {};
    const styled = newStyle(type as SceneElement['type']);
    return (scene) => {
      scene.elements.push({
        id: started.newId,
        z: topZ(scene.elements) + 1,
        type,
        ...box,
        ...styled,
        ...extra,
      } as SceneElement);
    };
  }

  /**
   * The end of the selected arrow under a point, if any. Ends are handles the
   * same size as the box handles, drawn where the arrow is drawn.
   */
  function endpointAt(point: Point): { id: ElementId; index: number; original: SceneElement; at: Point } | null {
    const [id] = selection.ids;
    const element = history.current.elements.find((e) => e.id === id);
    if (!element || element.type !== 'arrow' || isLocked(element)) return null;
    const points = drawnPoints(element);
    if (points.length < 4) return null;
    const reach = pointHit();
    for (const index of [0, points.length - 2]) {
      const x = points[index];
      const y = points[index + 1];
      if (Math.hypot(point.x - x, point.y - y) <= reach) {
        return { id, index: index === 0 ? 0 : 1, original: element, at: { x, y } };
      }
    }
    return null;
  }

  /**
   * A code block after a resize: the width is the user's (never narrower
   * than a few columns), and so is the height, but never below its code
   * wrapped to that width (`docs/file-format.md`, "Code blocks").
   */
  function codeResized(element: SceneElement): SceneElement {
    // At the block's own size (06.17).
    const metrics = codeMetrics(element);
    const block = element as SceneElement & { code: string };
    const w = Math.max(element.w, MIN_RESIZE_COLUMNS * metrics.advance + metrics.padding * 2);
    const size = measureCode(block.code, metrics, w);
    // As tall as the user drags it, never shorter than its wrapped code.
    const h = Math.max(element.h, size.height);
    return { ...element, w: size.width, h, measuredWidth: size.width, measuredHeight: size.height } as SceneElement;
  }

  /** A line or arrow through `points` (scene space), boxed around them. */
  function linearFrom(type: 'line' | 'arrow', id: string, points: Point[]): SceneElement {
    const flat = points.flatMap((p) => [p.x, p.y]);
    const box = boundsOfPoints(flat);
    return {
      id,
      z: topZ(history.current.elements) + 1,
      type,
      x: tidy(box.x),
      y: tidy(box.y),
      w: tidy(box.w),
      h: tidy(box.h),
      points: flat.map((value, i) => tidy(value - (i % 2 === 0 ? box.x : box.y))),
      ...newStyle(type),
    } as SceneElement;
  }

  /**
   * Commit the line drawn click by click, as one step: nothing for fewer than
   * two points; an arrow attaches its first and last points as a dragged one
   * does. Then, as after any draw, the select tool with the line selected.
   */
  function finishClicking(options: { keepTool?: boolean; closed?: boolean } = {}): void {
    const drawing = clicking;
    clicking = null;
    if (!drawing) return;
    // A single click makes nothing, but the tool still lets go, as after a draw.
    if (drawing.points.length < 2) {
      if (!options.keepTool) tools.escape();
      return;
    }
    justFinishedClicking = true;
    const first = drawing.points[0];
    const last = drawing.points[drawing.points.length - 1];
    const bindings = drawing.type === 'arrow' ? bindingsFor(first, last, drawing.id) : {};
    const element = {
      ...linearFrom(drawing.type, drawing.id, drawing.points),
      ...bindings,
      ...(options.closed ? { closed: true } : {}),
    } as SceneElement;
    history.mutate((scene) => {
      scene.elements.push(element);
    });
    // A tool chosen mid-line is kept; otherwise, as after any draw, Select.
    if (options.keepTool) selection.click(drawing.id);
    else afterDraw(drawing.id);
  }

  /**
   * After a draw: back to Select with the new element selected; with the tool
   * locked, the tool stays and nothing is selected, so the next press draws
   * again (Excalidraw's `App.tsx:11791-11817`).
   */
  function afterDraw(id: ElementId): void {
    if (tools.locked) {
      selection.clear();
      return;
    }
    tools.escape();
    selection.click(id);
  }

  /**
   * The point editing in force, or null: it ends when the selection is no
   * longer exactly its line (select all, a marquee, an undo), and selected
   * indices past the line's points are dropped, so none can be stale.
   */
  function currentEditing(): { id: ElementId; selected: number[] } | null {
    if (!pointEditing) return null;
    const element = history.current.elements.find((e) => e.id === pointEditing!.id);
    if (!element || selection.ids.length !== 1 || selection.ids[0] !== pointEditing.id) {
      pointEditing = null;
      return null;
    }
    const count = drawnPoints(element).length / 2;
    // A point an Alt-press is adding is selected before it exists.
    const adding = drag?.append?.index;
    pointEditing.selected = pointEditing.selected.filter((i) => i < count || i === adding);
    return pointEditing;
  }

  /**
   * A line or arrow settled around points some of which moved: a closed line
   * keeps its first and last together; a line's end dropped within the
   * closing distance of its other end snaps onto it and closes the line
   * (Excalidraw's `linearElementEditor.ts:738-775`).
   */
  function settleLine(base: SceneElement, points: number[], moved: number[]): SceneElement {
    if (isClosed(base)) return settledAround(base, keepLoop(points, moved));
    const last = points.length / 2 - 1;
    const end = moved.length === 1 && (moved[0] === 0 || moved[0] === last) ? moved[0] : -1;
    if (base.type === 'line' && end >= 0 && last >= 2) {
      const other = end === 0 ? last : 0;
      const gap = Math.hypot(points[end * 2] - points[other * 2], points[end * 2 + 1] - points[other * 2 + 1]);
      if (gap <= confirmDistance()) {
        const closed = [...points];
        closed.splice(end * 2, 2, points[other * 2], points[other * 2 + 1]);
        return { ...settledAround(base, closed), closed: true } as SceneElement;
      }
    }
    return settledAround(base, points);
  }

  /** An empty drag: a press that selects or adds, and moves nothing. */
  function inertDrag(point: Point): Drag {
    return { origin: point, moving: [], originals: new Map(), strokePoints: [], resize: null, rotate: null, endpoint: null, inert: true, newId: '' };
  }

  /**
   * A press while editing points. On a point: select it (Shift adds, or drops
   * a selected one if not dragged) and drag the selection. On a segment's
   * middle: a point added at once. With Alt anywhere: a point added there,
   * after the last (before an attached end), dragged by the same press. On the
   * line itself: the whole line moves. On empty canvas: a box that selects
   * points. On another element: leave the mode, and the press goes on as any
   * other. Returns whether the press was taken.
   */
  function pressInPointEditing(point: Point, options: { additive?: boolean; alt?: boolean }): boolean {
    const editing = pointEditing!;
    const element = history.current.elements.find((e) => e.id === editing.id)!;
    const drawn = drawnPoints(element);
    const reach = pointHit();
    const count = drawn.length / 2;
    for (let i = count - 1; i >= 0; i -= 1) {
      if (Math.hypot(point.x - drawn[i * 2], point.y - drawn[i * 2 + 1]) > reach) continue;
      // An arrow's end is dragged as an end: it attaches, pins or lets go.
      if (element.type === 'arrow' && (i === 0 || i === count - 1)) {
        editing.selected = [i];
        const at = { x: drawn[i * 2], y: drawn[i * 2 + 1] };
        drag = { ...inertDrag(point), inert: false, endpoint: { id: element.id, index: i === 0 ? 0 : 1, original: element, at } };
        return true;
      }
      // Shift adds a point; on a selected one it drops it, but only if the
      // press is not a drag (then the selection moves as it is).
      let deselect: number | undefined;
      if (options.additive) {
        if (editing.selected.includes(i)) deselect = i;
        else editing.selected = [...editing.selected, i].sort((a, b) => a - b);
      } else if (!editing.selected.includes(i)) {
        editing.selected = [i];
      }
      drag = { ...inertDrag(point), inert: false, points: { id: element.id, indices: [...editing.selected], original: element, deselect } };
      return true;
    }
    const middle = bendAt(point);
    if (middle?.insert) {
      // The points after the new one shift: the selection is no longer theirs.
      editing.selected = [];
      drag = { ...inertDrag(point), inert: false, bend: middle };
      return true;
    }
    if (options.alt) {
      // After the last point, or before an attached end; selected, and the
      // same press drags it (Excalidraw's `linearElementEditor.ts:1258-1335`).
      const count = drawn.length / 2;
      // Before an attached end, or a closed line's closing point, which stay.
      const endBound = (element.type === 'arrow' && (element as SceneElement & ArrowProps).endBinding !== undefined) || isClosed(element);
      const index = endBound ? count - 1 : count;
      editing.selected = [index];
      drag = { ...inertDrag(point), inert: false, append: { id: element.id, original: element, index, at: point } };
      return true;
    }
    if (nearElement(element, point, hitTolerance())) {
      // The line itself: a drag moves it whole, and the mode stays.
      editing.selected = [];
      drag = { ...inertDrag(point), inert: false, moving: [element.id], originals: new Map([[element.id, { x: element.x, y: element.y }]]) };
      return true;
    }
    // Empty canvas: a box that selects points; anything else ends the mode.
    if (elementsAt(point).every((e) => e.id === element.id)) {
      drag = { ...inertDrag(point), inert: false, pointMarquee: { additive: Boolean(options.additive) } };
      return true;
    }
    pointEditing = null;
    return false;
  }

  /**
   * The selection's rotate or resize handle under a point, as the stage draws
   * them (`chromeFor`); null over none.
   */
  function boxHandleAt(
    point: Point,
    editingId: ElementId | null,
  ):
    | { kind: 'rotate'; centre: Point; selected: SceneElement[] }
    | { kind: 'resize'; handle: Handle; bounds: Box; angle: number }
    | null {
    if (selection.ids.length === 0) return null;
    const { frame, selected } = frameFor();
    const bounds = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    const size = handleSize();
    // Only the handles the stage draws for this selection can be pressed.
    const chrome = chromeFor(history.current.elements.filter((e) => selection.has(e.id)), editingId);
    // Handles are drawn on the frame, so a press is read in its space.
    const local = pointInFrame(point, frame);
    // Where the handles are drawn: out on a padded box. A resize still
    // acts on the tight bounds, by the drag.
    const drawnBox = chrome.padded ? grown(bounds, bentBoxPadding()) : bounds;
    // A gap of zero would put the rotate zone on the top handle and make
    // that handle unreachable; no gap means no rotate handle.
    const gap = rotateGap();
    if (gap > 0 && chrome.rotate && isRotateHandle(local, drawnBox, size, gap) && selected.some(canRotate)) {
      return { kind: 'rotate', centre: centreOf(bounds), selected };
    }
    const handle = handleAt(local, drawnBox, size, chrome.handles);
    // A selection only a few handles across is covered by its handles;
    // pressing inside it moves it, and the handles' outer halves resize.
    const inside =
      local.x > drawnBox.x && local.x < drawnBox.x + drawnBox.w && local.y > drawnBox.y && local.y < drawnBox.y + drawnBox.h;
    const small = drawnBox.w < size * 6 || drawnBox.h < size * 6;
    return handle && !(inside && small) ? { kind: 'resize', handle, bounds, angle: frame.angle } : null;
  }

  /** The anchor disc of the one selected arrow under a point. */
  function focusAt(point: Point): Drag['focus'] | null {
    const found = bendable();
    if (!found || found.element.type !== 'arrow') return null;
    const reach = pointHit();
    const spot = focusSpots(found.element, history.current.elements, pointHandle()).find(
      (s) => Math.hypot(point.x - s.at.x, point.y - s.at.y) <= reach,
    );
    if (!spot) return null;
    return { id: found.element.id, side: spot.side, original: found.element, offset: { x: point.x - spot.at.x, y: point.y - spot.at.y } };
  }

  /** The handle of a segment of the one selected elbow under a point. */
  function segmentAt(point: Point): Drag['segment'] | null {
    const found = bendable();
    if (!found || !found.elbow) return null;
    const reach = pointHit();
    const handle = elbowSegmentHandles(found.element, segmentMin()).find(
      (h) => Math.hypot(point.x - h.at.x, point.y - h.at.y) <= reach,
    );
    return handle ? { id: found.element.id, index: handle.index, original: found.element } : null;
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
    const reach = pointHit();
    const near = (x: number, y: number) => Math.hypot(point.x - x, point.y - y) <= reach;
    const count = drawn.length / 2;
    for (let i = 0; i < count; i += 1) {
      const isEnd = i === 0 || i === count - 1;
      if (element.type === 'arrow' && isEnd) continue;
      if (near(drawn[i * 2], drawn[i * 2 + 1])) {
        return { id: element.id, index: i, insert: false, original: element, at: { x: drawn[i * 2], y: drawn[i * 2 + 1] } };
      }
    }
    const middles = segmentMiddles(element);
    for (let i = 0; i < middles.length; i += 1) {
      const middle = middles[i];
      if (middle && near(middle.x, middle.y)) {
        return { id: element.id, index: i + 1, insert: true, original: element, at: middle };
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
    // Outside point editing, only a two-point line or arrow offers its middle.
    if (!offersMiddles(element, pointEditing?.id === element.id)) return [];
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

  /**
   * Whether an end dropped at `point` on `target` is pinned inside it: strictly
   * inside its drawn outline, or anywhere on it with Alt (Excalidraw's
   * "inside" mode). An elbow end never is: it keeps to a side.
   */
  function pinnedAt(target: SceneElement, point: Point, arrow?: SceneElement, held = alt): boolean {
    if (arrow && isElbow(arrow)) return false;
    return held || isInside(target, point);
  }

  /**
   * What each end of a drawn arrow lands on, and where, as keys for the
   * element: the start by what was held at the press, the end by what is
   * held now. Cmd/Ctrl leaves that end free; Alt pins it.
   */
  function bindingsFor(from: Point, to: Point, id: string): Record<string, unknown> {
    const start = attaching(pressed.mod) ? targetAt(history.current, from, id, reach()) : undefined;
    const end = attaching(mod) ? targetAt(history.current, to, id, reach()) : undefined;
    // An elbow end snaps by the elbow's rule and is never pinned.
    const elbow = drawsElbow();
    // Both ends on one shape: both pinned where they are (B16); an elbow
    // routes round it.
    const same = Boolean(start && end && start.id === end.id);
    const startInside = Boolean(start) && !elbow && (same || pinnedAt(start!, from, undefined, pressed.alt));
    const endInside = Boolean(end) && !elbow && (same || pinnedAt(end!, to, undefined, alt));
    const snap = !shift && midpointSnap();
    const startAnchor = start ? anchorFor(start, from, reach(), startInside, elbow, to, snap) : undefined;
    // The end's edge anchor is carried from the start's anchor when attached.
    const towards = start ? spotOn(start, startAnchor) : from;
    return {
      ...(start ? { startBinding: start.id, startAnchor } : {}),
      ...(startInside ? { startMode: 'inside' } : {}),
      ...(end ? { endBinding: end.id, endAnchor: anchorFor(end, to, reach(), endInside, elbow, towards, snap) } : {}),
      ...(end && endInside ? { endMode: 'inside' } : {}),
    };
  }
}

/**
 * An arrow resized or turned lets go of every shape not transformed with it
 * (Excalidraw's `resizeElements.ts:241-252`, `:464-475`, `:930-945`): alone,
 * of both; its binding, anchor and mode go together.
 */
function letGoOutside(element: SceneElement, kept: Set<ElementId>): SceneElement {
  if (element.type !== 'arrow') return element;
  const record = { ...element } as unknown as Record<string, unknown>;
  let changed = false;
  for (const side of ['start', 'end'] as const) {
    const target = record[`${side}Binding`] as ElementId | undefined;
    if (target === undefined || kept.has(target)) continue;
    delete record[`${side}Binding`];
    delete record[`${side}Anchor`];
    delete record[`${side}Mode`];
    changed = true;
  }
  return changed ? (record as unknown as SceneElement) : element;
}

/** How far a lone attached arrow is dragged before it moves, in scene units (Excalidraw's 10). */
const LONE_ARROW_DRAG = 10;

/**
 * How far Duplicate puts the copy of a line's last point, in scene units
 * (Excalidraw's 30, 30, `linearElementEditor.ts:1500-1574`).
 */
const DUPLICATE_POINT_OFFSET = 30;

/**
 * Put an arrow just above the shape it attaches to when it is below it, as
 * Excalidraw's `moveArrowAboveBindable` (`element/src/zindex.ts:153-187`):
 * whatever sat above the shape moves up one to make room.
 */
function raiseAbove(elements: SceneElement[], id: ElementId, targetId: ElementId): void {
  const arrow = elements.find((e) => e.id === id);
  const target = elements.find((e) => e.id === targetId);
  if (!arrow || !target || arrow.z > target.z) return;
  const z = target.z + 1;
  for (const element of elements) if (element.id !== id && element.z >= z) element.z += 1;
  arrow.z = z;
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

function isElbow(element: SceneElement): boolean {
  return element.type === 'arrow' && (element as { arrowType?: string }).arrowType === 'elbow';
}
