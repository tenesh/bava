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
import { anchorFor, BINDING_REACH_MIN, drawnPoints, isInside, reroute, settledAround, targetAt, unturned } from './binding';
import { carriedWith, releaseFrames } from './containment';
import { measureCode, MIN_RESIZE_COLUMNS, type CodeMetrics } from './code/measure';
import { isLinear, nearElement, tensionOf } from './hit';
import { chromeFor, offersMiddles } from './selection-chrome';
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
  endpoint: { id: ElementId; index: number; original: SceneElement; at: Point } | null;
  /**
   * Set when the press landed on a point of a selected line or arrow that is
   * not an attachable end (a bend, or a line's end), or on the middle of a
   * segment, which inserts a point there (`insert`). `index` is the point's
   * position in the list.
   */
  bend?: { id: ElementId; index: number; insert: boolean; original: SceneElement; at: Point };
  /** Set when the press landed on the selected arrow's label, which slides along it. */
  label?: { id: ElementId; original: SceneElement };
  /** Set in point editing when the press took points: they move together. */
  points?: { id: ElementId; indices: number[]; original: SceneElement };
  /** Set in point editing for a press that changes nothing when dragged. */
  inert?: boolean;
  /** Set in point editing by an Alt-press off the points: add one there on release. */
  appendAt?: Point;
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
  const hitTolerance = options.hitTolerance ?? (() => 4);
  // The token's value at zoom 1, as the other defaults do: a test that presses
  // at a gap the app never uses cannot catch a gap regression.
  const rotateGap = options.rotateGap ?? (() => 16);
  // The token's value at zoom 1, as the others.
  const dragThreshold = options.dragThreshold ?? (() => 3);
  const reach = options.bindingReach ?? (() => BINDING_REACH_MIN);
  // The token's value at zoom 1, as the others.
  const bendMinSegment = options.bendMinSegment ?? (() => 40);
  const pointHit = options.pointHit ?? (() => 11);
  const bendInsertDistance = options.bendInsertDistance ?? (() => 10);
  const minLinear = options.minLinear ?? (() => 20);
  const confirmDistance = options.confirmDistance ?? (() => 8);

  /**
   * Where a dragged point goes: the pointer, plus the offset from where the
   * point was grabbed, so it does not jump to the cursor; with Shift, snapped
   * to 15° steps about its neighbouring point.
   */
  function aimedPoint(point: Point, drag: Drag, at: Point, neighbour: Point | null): Point {
    const aimed = { x: point.x + at.x - drag.origin.x, y: point.y + at.y - drag.origin.y };
    return shift && neighbour ? snapAngle(neighbour, aimed) : aimed;
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
     * highlight. Empty when nothing is being drawn, when Cmd/Ctrl is held, or when
     * neither end is over a shape.
     */
    get bindingCandidates(): ElementId[] {
      if (mod) return [];
      // A clicked arrow shows what its first point and the pointer would attach to.
      if (clicking?.type === 'arrow') {
        const ids = [clicking.points[0], lastPoint].map((end) => targetAt(history.current, end, clicking!.id, reach())?.id);
        return ids.filter((id, i) => id !== undefined && ids.indexOf(id) === i) as ElementId[];
      }
      if (!drag) return [];
      // An end of an existing arrow being dragged: what it would attach to,
      // by the rule the release uses (the other end's shape is refused).
      if (drag.endpoint) {
        const { id, index, original } = drag.endpoint;
        const other = (original as SceneElement & Record<string, string | undefined>)[index === 0 ? 'endBinding' : 'startBinding'];
        const target = targetAt(history.current, endAim ?? lastPoint, id, reach());
        return target && target.id !== other && farEnough(drag.origin, lastPoint) ? [target.id] : [];
      }
      if (tools.active !== 'arrow') return [];
      // The same endpoint the release would bind, Shift snapping included, so
      // the highlight cannot name a shape the drop would miss.
      const ends = [drag.origin, shift ? snapAngle(drag.origin, lastPoint) : lastPoint];
      const ids = ends.map((end) => targetAt(history.current, end, drag!.newId, reach())?.id);
      return ids.filter((id, i) => id !== undefined && ids.indexOf(id) === i) as ElementId[];
    },

    down(point: Point, options: { additive?: boolean; alt?: boolean; shift?: boolean } = {}): void {
      shift = Boolean(options.shift);
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
        // Only the handles the stage draws for this selection can be pressed.
        const chrome = chromeFor(history.current.elements.filter((e) => selection.has(e.id)), wasEditing);
        // Handles are drawn on the frame, so a press is read in its space.
        const local = pointInFrame(point, frame);
        // A gap of zero would put the rotate zone on the top handle and make
        // that handle unreachable; no gap means no rotate handle.
        const gap = rotateGap();
        if (gap > 0 && chrome.rotate && isRotateHandle(local, bounds, size, gap) && selected.some(canRotate)) {
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
        const handle = handleAt(local, bounds, size, chrome.handles);
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
      if (tools.active === 'select' && !drag.resize && !drag.rotate && !drag.endpoint && !drag.bend && !drag.label && !drag.points && !drag.inert && drag.moving.length === 0) {
        marquee = boxBetween(drag.origin, point);
      }
    },

    /** Whether a line or arrow is being drawn click by click. */
    get drawingPoints(): boolean {
      return clicking !== null;
    },

    /** The scene with the line being drawn click by click, running to `point`. */
    pointsPreview(point: Point): SceneData | null {
      if (!clicking) return null;
      const element = linearFrom(clicking.type, clicking.id, [...clicking.points, point]);
      return produce(history.current, (draft: SceneData) => {
        draft.elements.push(element as never);
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
      if (editing.selected.length === 0) {
        pointEditing = null;
        return false;
      }
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

    /** Remove the selected points, as one step, never leaving fewer than two. */
    removeSelectedPoints(): boolean {
      const editing = currentEditing();
      if (!editing || editing.selected.length === 0) return false;
      const element = history.current.elements.find((e) => e.id === editing.id);
      if (!element) return false;
      const base = unturned(element);
      const all = ('points' in base ? base.points : []) as number[];
      const keep = new Set(editing.selected);
      if (all.length / 2 - keep.size < 2) return false;
      const points = all.filter((_, i) => !keep.has(Math.floor(i / 2)));
      history.mutate((scene) => {
        const i = scene.elements.findIndex((e) => e.id === element.id);
        if (i >= 0) scene.elements[i] = settledAround(base, points);
      });
      editing.selected = [];
      return true;
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
      // The points after it shift: a selection in point editing is not theirs.
      if (pointEditing) pointEditing.selected = [];
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

      // An Alt-press off the points in point editing adds one there, read at
      // the release as every modifier is.
      if (started.appendAt) {
        if (alt) appendPoint(point);
        return null;
      }

      // Drawing click by click: each click adds a point; a click on the last
      // one finishes the line.
      if (clicking && (tools.active === 'line' || tools.active === 'arrow')) {
        const last = clicking.points[clicking.points.length - 1];
        if (Math.hypot(point.x - last.x, point.y - last.y) <= confirmDistance()) finishClicking();
        else clicking.points.push(point);
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

      if (tools.active === 'select' && !started.resize && !started.rotate && !started.endpoint && !started.bend && !started.label && !started.points && !started.inert && started.moving.length === 0) {
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

    if (started.inert) return null;

    if (started.points) {
      const { id, indices, original } = started.points;
      if (!farEnough(started.origin, point)) return null;
      const base = unturned(original);
      const points = [...(('points' in base ? base.points : []) as number[])];
      const dx = point.x - started.origin.x;
      const dy = point.y - started.origin.y;
      for (const index of indices) {
        // Never beyond the points there are: a stale index would write NaN.
        if (index * 2 + 1 >= points.length) continue;
        points[index * 2] += dx;
        points[index * 2 + 1] += dy;
      }
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i >= 0) scene.elements[i] = settledAround(base, points);
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
      const { id, index, insert, original, at } = started.bend;
      // A click on a handle is not a drag: it neither moves nor adds a point.
      if (!farEnough(started.origin, point)) return null;
      // A middle adds a bend only once dragged a little way, as Excalidraw's.
      if (insert && Math.hypot(point.x - started.origin.x, point.y - started.origin.y) < bendInsertDistance()) return null;
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
      const modeKey = index === 0 ? 'startMode' : 'endMode';
      const otherKey = index === 0 ? 'endBinding' : 'startBinding';
      const other = (original as SceneElement & Record<string, string | undefined>)[otherKey];
      // Dropped on a shape it attaches, on empty canvas it lets go, and Alt
      // holds it free either way. Both ends on one shape would leave the arrow
      // with nowhere to run, so that target is refused.
      const last = points.length - 2;
      const at = index === 0 ? 0 : last;
      const next = index === 0 ? 2 : last - 2;
      // Where the end goes: kept at its grab offset, snapped with Shift about
      // its neighbour; the target is looked for there.
      const aimed = aimedPoint(point, started, started.endpoint.at, {
        x: original.x + points[next],
        y: original.y + points[next + 1],
      });
      endAim = aimed;
      // Cmd/Ctrl leaves the end free (06.13; Alt used to).
      const candidate = mod ? undefined : targetAt(history.current, aimed, id, reach());
      const target = candidate && candidate.id === other ? undefined : candidate;
      points[at] = aimed.x - original.x;
      points[at + 1] = aimed.y - original.y;
      return (scene) => {
        const i = scene.elements.findIndex((e) => e.id === id);
        if (i < 0) return;
        scene.elements[i] = settledAround(original, points);
        const bound = scene.elements[i] as SceneElement & Record<string, unknown>;
        // The binding and where on the target it aims go together.
        // Inside the shape, or anywhere on it with Alt, the end is pinned.
        const inside = Boolean(target) && pinnedAt(target!, aimed, original);
        if (target) {
          bound[key] = target.id;
          bound[anchorKey] = anchorFor(target, aimed, reach(), inside);
        } else {
          delete bound[key];
          delete bound[anchorKey];
        }
        if (inside) bound[modeKey] = 'inside';
        else delete bound[modeKey];
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
          scene.elements[i] = scaled.type === 'code' ? codeResized(scaled) : scaled;
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
    // A line or arrow shorter than this is a slip, not a drawing (Excalidraw's).
    if (linear && Math.hypot(end.x - started.origin.x, end.y - started.origin.y) < minLinear()) return null;
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
            ...(type === 'arrow' && !mod ? bindingsFor(started.origin, end, started.newId) : {}),
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
   * than a few columns), and the height is its code wrapped to that width
   * (`docs/file-format.md`, "Code blocks").
   */
  function codeResized(element: SceneElement): SceneElement {
    const metrics = codeMetrics();
    const block = element as SceneElement & { code: string };
    const w = Math.max(element.w, MIN_RESIZE_COLUMNS * metrics.advance + metrics.padding * 2);
    const size = measureCode(block.code, metrics, w);
    return { ...element, w: size.width, h: size.height, measuredWidth: size.width, measuredHeight: size.height } as SceneElement;
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
    } as SceneElement;
  }

  /**
   * Commit the line drawn click by click, as one step: nothing for fewer than
   * two points; an arrow attaches its first and last points as a dragged one
   * does. Then, as after any draw, the select tool with the line selected.
   */
  function finishClicking(options: { keepTool?: boolean } = {}): void {
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
    const bindings = drawing.type === 'arrow' && !mod ? bindingsFor(first, last, drawing.id) : {};
    const element = { ...linearFrom(drawing.type, drawing.id, drawing.points), ...bindings } as SceneElement;
    history.mutate((scene) => {
      scene.elements.push(element);
    });
    // A tool chosen mid-line is kept; otherwise, as after any draw, Select.
    if (!options.keepTool) tools.escape();
    selection.click(drawing.id);
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
    pointEditing.selected = pointEditing.selected.filter((i) => i < count);
    return pointEditing;
  }

  /**
   * Add a point where Alt was clicked in point editing, after the last; on an
   * arrow whose end is attached, before that end, which stays on its shape.
   */
  function appendPoint(point: Point): void {
    const editing = currentEditing();
    if (!editing) return;
    const element = history.current.elements.find((e) => e.id === editing.id)!;
    const base = unturned(element);
    const points = [...(('points' in base ? base.points : []) as number[])];
    const added = [tidy(point.x - base.x), tidy(point.y - base.y)];
    const endBound = element.type === 'arrow' && (element as SceneElement & ArrowProps).endBinding !== undefined;
    const at = endBound ? points.length - 2 : points.length;
    points.splice(at, 0, ...added);
    history.mutate((scene) => {
      const i = scene.elements.findIndex((e) => e.id === element.id);
      if (i >= 0) scene.elements[i] = settledAround(base, points);
    });
    editing.selected = [at / 2];
  }

  /** An empty drag: a press that selects or adds, and moves nothing. */
  function inertDrag(point: Point): Drag {
    return { origin: point, moving: [], originals: new Map(), strokePoints: [], resize: null, rotate: null, endpoint: null, inert: true, newId: '' };
  }

  /**
   * A press while editing points. On a point: select it (Shift toggles) and
   * drag the selection. On a segment's middle: the ordinary bend drag. With
   * Alt anywhere: add a point after the last (before an attached end), on
   * release. On the line itself: clear the
   * point selection. Anywhere else: leave the mode, and the press goes on as
   * any other. Returns whether the press was taken.
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
      if (options.additive) {
        editing.selected = editing.selected.includes(i) ? editing.selected.filter((j) => j !== i) : [...editing.selected, i].sort((a, b) => a - b);
      } else if (!editing.selected.includes(i)) {
        editing.selected = [i];
      }
      drag = { ...inertDrag(point), inert: false, points: { id: element.id, indices: [...editing.selected], original: element } };
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
      drag = { ...inertDrag(point), appendAt: point };
      return true;
    }
    if (nearElement(element, point, hitTolerance())) {
      editing.selected = [];
      drag = inertDrag(point);
      return true;
    }
    pointEditing = null;
    return false;
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
  function pinnedAt(target: SceneElement, point: Point, arrow?: SceneElement): boolean {
    if ((arrow as { arrowType?: string } | undefined)?.arrowType === 'elbow') return false;
    return alt || isInside(target, point);
  }

  /** What each end of a drawn arrow lands on, and where, as keys for the element. */
  function bindingsFor(from: Point, to: Point, id: string): Record<string, unknown> {
    const start = targetAt(history.current, from, id, reach());
    const end = targetAt(history.current, to, id, reach());
    const startInside = Boolean(start) && pinnedAt(start!, from);
    const endInside = Boolean(end) && pinnedAt(end!, to);
    return {
      ...(start ? { startBinding: start.id, startAnchor: anchorFor(start, from, reach(), startInside) } : {}),
      ...(startInside ? { startMode: 'inside' } : {}),
      ...(end && end.id !== start?.id ? { endBinding: end.id, endAnchor: anchorFor(end, to, reach(), endInside) } : {}),
      ...(end && end.id !== start?.id && endInside ? { endMode: 'inside' } : {}),
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
