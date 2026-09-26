/**
 * The canvas.
 *
 * A plain class owning a Konva stage, mounted once into a div. Svelte never
 * renders scene elements: per-element components reconcile the whole tree on
 * every pan, zoom or keystroke, and the app stutters at a few hundred
 * elements. When that happens the instinct is to blame the webview; it is
 * this.
 *
 * Data flows in through `render`, events flow out. No reactive state holds
 * geometry.
 *
 * Each element is a Konva group at the element's `x, y`, holding its body
 * drawn in local coordinates (`0..w`, `0..h`) and, for a shape with a label,
 * the label. Colours are theme tokens read at render time through `read`, and
 * re-read by `restyle` when the theme changes.
 */
import Konva from 'konva';
import type { SceneData, SceneElement, ElementId } from './scene';
import type { ArrowProps, StyleProps } from './scene';
import { isShapeType } from './scene';
import { drawOutline, isOutlineShape, type OutlineShape, type PathSink } from './shapes';
import { DEFAULT_STROKE_WIDTH, paintFor, ROUND_SHARE } from './paint';
import { wrapLines } from './text-layout';
import { smoothPoints } from './curves';
import { bindingsOf, drawnPoints, isDetached, type Point } from './binding';
import { tensionOf } from './hit';
import type { Run } from './code/highlight';
import { languageTag } from './code/language-tag';
import { monoAdvance } from './code/advance';
import { columnsIn } from './code/measure';
import { columnsFor, wrapRuns } from './code/wrap';
import { canvasLineWidth } from './text-measure';
import { LABEL_CLEARANCE, drawHead, endSegment, headAt, headDash, labelCorners, labelLayout, middlesAlong, pathOf } from './arrows';
import { readRootVariable, resolveStyle, type ReadVariable } from './palette';
import { handleCentre, rotateHandleCentre } from './resize';
import { chromeFor, elbowSegmentHandles, focusSpots, grown, offersMiddles } from './selection-chrome';
import { angleOfElement, centreOf, selectionFrame } from './rotate';
import type { Guide } from './snapping';

export type CanvasStageOptions = {
  /** Reads a CSS custom property. Injected so tests need no stylesheet. */
  read?: ReadVariable;
};

/**
 * Tokens read once per render or restyle. Every element needs the same few,
 * and `getComputedStyle` per element per commit is thousands of style reads on
 * a large scene.
 */
function cached(read: ReadVariable): ReadVariable {
  const values = new Map<string, string>();
  return (name) => {
    let value = values.get(name);
    if (value === undefined) {
      value = read(name);
      values.set(name, value);
    }
    return value;
  };
}

const number = (read: ReadVariable, name: string) => parseFloat(read(name)) || 0;

/**
 * How faint a segment's middle handle is beside the point handles: it offers
 * a bend rather than marking one. A ratio, not a length or a colour.
 */
const MIDDLE_HANDLE_OPACITY = 0.6;

/** The hover disc under a handle: Excalidraw's 0.4. */
const HOVER_OPACITY = 0.4;

/**
 * The attach highlight's width, in screen px, between which it follows the
 * shape's stroke: Excalidraw's clamp(1.75, strokeWidth, 4)
 * (`interactiveScene.ts:123-131`). Excalidraw's own values, kept with it.
 */
const HIGHLIGHT_MIN = 1.75;
const HIGHLIGHT_MAX = 4;

/** The pulse's opacity: around 0.7, by 0.3 either way. */
const PULSE_MIDDLE = 0.7;
const PULSE_DEPTH = 0.3;

/** Beyond anything drawn: the outer edge of the clip that cuts a label's hole. */
const CLIP_EXTENT = 1e6;

type Entry = {
  group: Konva.Group;
  body: Konva.Shape;
  label: Konva.Text | null;
  type: string;
  /** An arrow's heads, drawn as their own nodes: Konva draws only triangles. */
  heads: Konva.Shape[];
  /** Markers on ends whose binding cannot be resolved. */
  detached: Konva.Circle[];
  /** One text node per coloured run, for a code block. */
  runs: Konva.Text[];
  /** A code block's language on its top edge, and its border broken for it. */
  tag: Konva.Text | null;
  border: Konva.Rect | null;
  /**
   * The element this entry was last drawn from. The scene is immutable, so
   * the same object means nothing about it changed and it is not re-applied.
   */
  applied: SceneElement | null;
  /** What those nodes were built from, so a redraw can skip unchanged runs. */
  drawnRuns: Run[][] | null;
  drawnPaint: string;
};

export class CanvasStage {
  #stage: Konva.Stage | null = null;
  #layer: Konva.Layer | null = null;
  /** Above the scene: the selection outline and its handles. */
  #overlay: Konva.Layer | null = null;
  #selected: ElementId[] = [];
  #outline: Konva.Rect | null = null;
  #handles: Konva.Rect[] = [];
  #rotate: Konva.Circle | null = null;
  /** Handles at the ends of a single selected arrow. */
  #endpoints: Konva.Circle[] = [];
  #middles: Konva.Circle[] = [];
  #segments: Konva.Circle[] = [];
  #hover: Konva.Circle | null = null;
  #focus: Konva.Circle[] = [];
  #focusLines: Konva.Line[] = [];
  /** The line or arrow in point editing, and its selected points (06.13). */
  #pointEditing: { id: ElementId; selected: number[] } | null = null;
  /** Outlines on the shapes an arrow being drawn would attach to. */
  #candidates: Konva.Shape[] = [];
  #pulse: Konva.Animation | null = null;
  #candidateIds: ElementId[] = [];
  #snapSpots: Point[] = [];
  #snapDots: Konva.Circle[] = [];
  /** Tokenised code per block, handed in by the caller. */
  #codeRuns = new Map<ElementId, Run[][]>();
  #marquee: Konva.Rect | null = null;
  /** The guides snapping to objects draws (Milestone 7), and their lines. */
  #snapGuides: Guide[] = [];
  #snapGuideLines: Konva.Line[] = [];
  #trail: Konva.Line | null = null;
  #markedForErase = new Set<ElementId>();
  #zoom = 1;
  #entries = new Map<ElementId, Entry>();
  /** A scene that arrived before there was anywhere to paint it. */
  #pending: SceneData | null = null;
  #last: SceneData = { elements: [] };
  /** The element whose text an editor is drawing, and which this must not. */
  #editing: ElementId | null = null;
  /** The paint order last applied, so an unchanged order is not re-stacked. */
  #order: ElementId[] = [];
  #read: ReadVariable;

  constructor(options: CanvasStageOptions = {}) {
    this.#read = options.read ?? readRootVariable;
  }

  mount(host: HTMLDivElement): void {
    this.#stage = new Konva.Stage({
      container: host,
      width: host.clientWidth,
      height: host.clientHeight,
    });
    // Not listening: all input is DOM events through the pointer handler, so a
    // hit canvas redrawn every frame and read on every mouse move buys nothing.
    this.#layer = new Konva.Layer({ listening: false });
    this.#stage.add(this.#layer);
    this.#overlay = new Konva.Layer({ listening: false });
    this.#stage.add(this.#overlay);

    if (this.#pending) {
      const pending = this.#pending;
      this.#pending = null;
      this.render(pending);
    }
  }

  /**
   * Patch the stage to match the scene.
   *
   * Existing nodes are updated in place and only missing ones are created;
   * rebuilding every node on every render is the performance trap this class
   * exists to avoid. An element whose type changed is recreated.
   */
  render(scene: SceneData): void {
    this.#last = scene;
    const read = cached(this.#read);
    if (!this.#layer) {
      this.#pending = scene;
      return;
    }

    const seen = new Set<ElementId>();
    // A new group goes on top of the layer, wherever its element belongs.
    let created = false;

    for (const element of scene.elements) {
      seen.add(element.id);
      let entry = this.#entries.get(element.id);
      if (entry && entry.type !== element.type) {
        entry.group.destroy();
        entry = undefined;
      }
      if (!entry) {
        entry = this.#create(element);
        this.#entries.set(element.id, entry);
        this.#layer.add(entry.group);
        created = true;
      }
      // An arrow is re-applied whatever: whether an end is detached depends
      // on other elements, which the arrow's own object does not show.
      if (entry.applied !== element || element.type === 'arrow') {
        this.#apply(entry, element, read);
        entry.applied = element;
      }
    }

    for (const [id, entry] of this.#entries) {
      if (seen.has(id)) continue;
      entry.group.destroy();
      this.#entries.delete(id);
      // The runs go with the element, or the map grows for the session.
      this.#codeRuns.delete(id);
    }

    // Konva paints in child order, so z is applied rather than assumed; each
    // zIndex call reshuffles the layer's children, so only when order changed.
    const order = scene.elements.map((e) => e.id);
    if (created || order.length !== this.#order.length || order.some((id, i) => id !== this.#order[i])) {
      scene.elements.forEach((element, index) => this.#entries.get(element.id)?.group.zIndex(index));
      this.#order = order;
    }

    this.#layer.batchDraw();
    this.#drawSelection(read);
  }

  /**
   * Outline the selected elements with eight handles. Drawn only: pressing a
   * handle is the pointer handler's job, so all input has one path.
   */
  setSelection(ids: ElementId[]): void {
    this.#selected = [...ids];
    this.#drawSelection(cached(this.#read));
  }

  /** The selection outline, or null when nothing is selected. */
  selectionOutline(): Konva.Rect | null {
    return this.#outline;
  }

  selectionHandleCount(): number {
    return this.#handles.length;
  }

  /**
   * Outline the shapes the arrow being drawn would attach to, so the user can
   * see the attachment before letting go.
   */
  setBindingCandidates(ids: ElementId[], spots: Point[] = []): void {
    this.#candidateIds = [...ids];
    this.#snapSpots = [...spots];
    this.#drawCandidates(cached(this.#read));
  }

  /** Whether the attach highlight is pulsing. */
  pulsing(): boolean {
    return this.#pulse?.isRunning() ?? false;
  }

  bindingHighlights(): Konva.Shape[] {
    return this.#candidates;
  }

  snapDots(): Konva.Circle[] {
    return this.#snapDots;
  }

  #drawCandidates(read: ReadVariable): void {
    if (!this.#overlay) return;
    this.#candidates.forEach((node) => node.destroy());
    this.#candidates = [];
    this.#snapDots.forEach((node) => node.destroy());
    this.#snapDots = [];
    const colour = read('--color-binding-highlight').trim();
    const scale = 1 / this.#zoom;
    const radius = (number(read, '--size-snap-dot') / 2) * scale;
    for (const spot of this.#snapSpots) {
      const dot = new Konva.Circle({ x: spot.x, y: spot.y, radius, fill: colour, listening: false });
      this.#snapDots.push(dot);
      this.#overlay.add(dot);
    }
    for (const id of this.#candidateIds) {
      const element = this.#last.elements.find((e) => e.id === id);
      if (!element) continue;
      // The shape's own outline, turned with it (Excalidraw's
      // `interactiveScene.ts:292-557`), as wide as its stroke within 1.75 and
      // 4 on screen.
      const width = (element as { strokeWidth?: number }).strokeWidth ?? 2;
      const kind = element.type === 'ellipse' ? 'ellipse' : isOutlineShape(element.type) ? element.type : 'rect';
      const outline = new Konva.Shape({
        x: element.x + element.w / 2,
        y: element.y + element.h / 2,
        width: element.w,
        height: element.h,
        offsetX: element.w / 2,
        offsetY: element.h / 2,
        rotation: angleOfElement(element),
        stroke: colour,
        strokeWidth: Math.min(HIGHLIGHT_MAX, Math.max(HIGHLIGHT_MIN, width)) * scale,
        listening: false,
        bavaOutline: kind,
        sceneFunc: (context, shape) => {
          context.beginPath();
          if (kind === 'ellipse') context.ellipse(element.w / 2, element.h / 2, element.w / 2, element.h / 2, 0, 0, Math.PI * 2);
          else if (kind === 'rect') context.rect(0, 0, element.w, element.h);
          else drawOutline(kind as OutlineShape, context as unknown as PathSink, element.w, element.h);
          context.closePath();
          context.strokeShape(shape);
        },
      });
      this.#candidates.push(outline);
      this.#overlay.add(outline);
    }
    // A gentle pulse while anything is highlighted, as Excalidraw's; none
    // under reduced motion (the token is 0 there).
    const beat = number(read, '--duration-pulse');
    if (this.#candidates.length > 0 && !this.#pulse && this.#overlay && beat > 0) {
      const overlay = this.#overlay;
      this.#pulse = new Konva.Animation((frame) => {
        const opacity = PULSE_MIDDLE + PULSE_DEPTH * Math.sin(((frame?.time ?? 0) / beat) * Math.PI * 2);
        this.#candidates.forEach((node) => node.opacity(opacity));
      }, overlay);
      this.#pulse.start();
    } else if (this.#candidates.length === 0 && this.#pulse) {
      this.#pulse.stop();
      this.#pulse = null;
    }
    // The dots over the outlines they sit on.
    this.#snapDots.forEach((dot) => dot.moveToTop());
    this.#overlay.batchDraw();
  }

  /**
   * The coloured runs of a code block, as the caller tokenised them.
   *
   * Parsing is asynchronous (a language loads on first use) and the stage is
   * synchronous, so the runs arrive here rather than being computed here. A
   * block with no runs yet draws its panel and waits.
   */
  setCodeRuns(id: ElementId, runs: Run[][]): void {
    this.#codeRuns.set(id, runs);
    const entry = this.#entries.get(id);
    const element = this.#last.elements.find((e) => e.id === id);
    if (entry && element) this.#drawCode(entry, element, cached(this.#read));
  }

  /** The text nodes drawing a code block's runs, in order. */
  codeRuns(id: ElementId): Konva.Text[] {
    return this.#entries.get(id)?.runs ?? [];
  }

  #drawCode(entry: Entry, element: SceneElement, read: ReadVariable): void {
    if (element.type !== 'code') {
      for (const node of entry.runs) node.destroy();
      entry.runs = [];
      entry.drawnRuns = null;
      return;
    }

    const paint = paintFor(element, read);
    const runsNow = this.#codeRuns.get(element.id) ?? [];
    // `#apply` runs for every element on every render, including each preview
    // frame of a drag. Rebuilding a few hundred text nodes per frame is the
    // performance trap this class exists to avoid, so nodes are rebuilt only
    // when the runs or the way they paint actually changed.
    // The advance too: rows wrapped before Geist Mono loaded were measured
    // with a fallback font, and must wrap again once it has.
    const advanceNow = monoAdvance(paint.font.size, paint.font.family);
    const paintKey = `${paint.font.family} ${paint.font.size} ${paint.font.lineHeight} ${this.#zoom} ${element.w} ${advanceNow}`;
    if (entry.drawnRuns === runsNow && entry.drawnPaint === paintKey) return;
    entry.drawnRuns = runsNow;
    entry.drawnPaint = paintKey;

    for (const node of entry.runs) node.destroy();
    entry.runs = [];
    const padding = number(read, '--size-code-padding');
    const lineHeight = paint.font.size * paint.font.lineHeight;
    const advance = monoAdvance(paint.font.size, paint.font.family);
    // Wrapped to the block's width, by the rule the measurement and the
    // exporter use (`code/wrap.ts`).
    const rows = wrapRuns(runsNow, columnsFor(element.w, { advance, lineHeight, padding }));
    rows.forEach((line, row) => {
      let column = 0;
      for (const run of line) {
        const node = new Konva.Text({
          x: padding + column * advance,
          y: padding + row * lineHeight,
          text: run.text,
          fontFamily: paint.font.family,
          fontSize: paint.font.size,
          lineHeight: paint.font.lineHeight,
          fill: read(`--syntax-${run.kind}`).trim(),
          listening: false,
          wrap: 'none',
        });
        entry.runs.push(node);
        entry.group.add(node);
        column += columnsIn(run.text);
      }
    });
  }

  /** The markers drawn on ends whose bindings cannot be resolved. */
  detachedMarkers(): Konva.Circle[] {
    return [...this.#entries.values()].flatMap((entry) => entry.detached);
  }

  /** The rotate handle above the selection, or null when nothing is selected. */
  rotateHandle(): Konva.Circle | null {
    return this.#rotate;
  }

  /**
   * An arrow's label box in scene space, as drawn, for pressing on it to slide
   * it; null when it has none.
   */
  labelBounds(id: ElementId): { x: number; y: number; w: number; h: number } | null {
    const entry = this.#entries.get(id);
    if (!entry?.label || entry.type !== 'arrow') return null;
    // The box around it as drawn, a turn included, in the layer's (scene) space.
    const box = entry.label.getClientRect({ relativeTo: this.#layer ?? undefined });
    return { x: box.x, y: box.y, w: box.width, h: box.height };
  }

  /** Show a line or arrow in point editing, with its selected points; null to stop. */
  setPointEditing(state: { id: ElementId; selected: number[] } | null): void {
    this.#pointEditing = state;
    this.#drawSelection(cached(this.#read));
  }

  /**
   * A translucent disc under the handle the pointer is over (Excalidraw's
   * `interactiveScene.ts:163-216`), or none.
   */
  setHoverHandle(at: Point | null): void {
    if (!this.#overlay) return;
    // Called on every pointer move: nothing to do when nothing changed.
    const was = this.#hover ? { x: this.#hover.x(), y: this.#hover.y() } : null;
    if (was === at || (was && at && was.x === at.x && was.y === at.y)) return;
    this.#hover?.destroy();
    this.#hover = null;
    if (at) {
      const read = cached(this.#read);
      this.#hover = new Konva.Circle({
        x: at.x,
        y: at.y,
        radius: (number(read, '--size-point-hover') / 2) / this.#zoom,
        fill: read('--color-selection-handle').trim(),
        opacity: HOVER_OPACITY,
        listening: false,
      });
      this.#overlay.add(this.#hover);
    }
    this.#overlay.batchDraw();
  }

  hoverHandle(): Konva.Circle | null {
    return this.#hover;
  }

  /** The discs on the selected arrow's attached ends' anchors. */
  focusHandles(): Konva.Circle[] {
    return this.#focus;
  }

  focusLines(): Konva.Line[] {
    return this.#focusLines;
  }

  /** The handles at the middles of the selected elbow's segments. */
  segmentHandles(): Konva.Circle[] {
    return this.#segments;
  }

  /** The handles at the middles of a selected line's or arrow's segments. */
  middleHandles(): Konva.Circle[] {
    return this.#middles;
  }

  /** The handles on the points of a selected line or arrow: its ends and bends. */
  endpointHandles(): Konva.Circle[] {
    return this.#endpoints;
  }

  #drawSelection(read: ReadVariable): void {
    if (!this.#overlay) return;
    this.#outline?.destroy();
    this.#handles.forEach((handle) => handle.destroy());
    this.#rotate?.destroy();
    this.#endpoints.forEach((end) => end.destroy());
    this.#middles.forEach((middle) => middle.destroy());
    this.#middles = [];
    this.#segments.forEach((handle) => handle.destroy());
    this.#segments = [];
    this.#focus.forEach((disc) => disc.destroy());
    this.#focus = [];
    this.#focusLines.forEach((line) => line.destroy());
    this.#focusLines = [];
    // A hover disc belongs to the handles as they were; the next move puts
    // it back where there still is one, at the zoom now.
    this.#hover?.destroy();
    this.#hover = null;
    this.#outline = null;
    this.#handles = [];
    this.#rotate = null;
    this.#endpoints = [];

    const selected = this.#last.elements.filter((e) => this.#selected.includes(e.id));
    if (selected.length === 0) {
      this.#overlay.batchDraw();
      return;
    }

    const colour = read('--color-selection-handle').trim();
    const surface = read('--color-surface').trim();
    // One element's frame carries its angle, so the outline and the handles
    // sit on the shape; several have no shared angle and stay upright.
    const frame = selectionFrame(selected);
    let bounds = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
    const centre = centreOf(bounds);
    // Everything in the overlay is drawn in the frame's own space and then
    // turned about the selection's centre, so one rotation describes them all.
    const turn = (node: Konva.Node) => {
      if (frame.angle !== 0) {
        node.rotation(frame.angle);
        node.offset({ x: centre.x - node.x(), y: centre.y - node.y() });
        node.position(centre);
      }
      return node;
    };
    // Line widths and handle sizes are divided by the zoom, so they stay the
    // same on screen however far in or out the canvas is.
    const scale = 1 / this.#zoom;
    // What this selection shows, decided with the pointer (`selection-chrome.ts`).
    // A line in point editing shows its points alone, as Excalidraw's editor.
    const editingThis = selected.length === 1 && this.#pointEditing?.id === selected[0].id;
    const chrome = chromeFor(selected, this.#pointEditing?.id ?? null);
    const tight = bounds;
    if (chrome.padded) bounds = grown(tight, number(read, '--size-bent-box-padding') * scale);
    if (chrome.box) {
      this.#outline = turn(
        new Konva.Rect({ ...boundsToRect(bounds), stroke: colour, strokeWidth: scale }),
      ) as Konva.Rect;
      this.#overlay.add(this.#outline);
    }

    const size = number(read, '--size-selection-handle') * scale;
    for (const handle of chrome.handles) {
      const at = handleCentre(bounds, handle);
      const square = new Konva.Rect({
        x: at.x - size / 2,
        y: at.y - size / 2,
        width: size,
        height: size,
        fill: surface,
        stroke: colour,
        strokeWidth: scale,
      });
      this.#handles.push(turn(square) as Konva.Rect);
      this.#overlay.add(square);
    }

    // One selected line or arrow: a handle on each end, where the press zone
    // is, and on every bend; and a smaller, filled one at the middle of each
    // segment long enough to bend. For an elbow or an arc the box corners are
    // nowhere near the ends, so the resize handles do not stand in for these.
    // An elbow routes itself: its ends only.
    const linear = selected.length === 1 && (selected[0].type === 'arrow' || selected[0].type === 'line') ? selected[0] : null;
    if (linear) {
      // Where the points are drawn, a turn included, as the pointer tests them.
      const drawn = drawnPoints(linear);
      // Excalidraw's point handle: 5 px in radius on screen (the token is its
      // diameter), and a middle handle the same size.
      const pointRadius = (number(read, '--size-point-handle') / 2) * scale;
      // In point editing, points are larger (Excalidraw's 10 px) and the
      // selected ones filled.
      const editRadius = (number(read, '--size-point-handle-editing') / 2) * scale;
      const chosen = new Set(editingThis ? this.#pointEditing!.selected : []);
      const elbow = (linear as SceneElement & ArrowProps).arrowType === 'elbow' && linear.type === 'arrow';
      const count = drawn.length >= 4 ? drawn.length / 2 : 0;
      for (let i = 0; i < count; i += 1) {
        if (elbow && i !== 0 && i !== count - 1) continue;
        // A point on top of the one before it is drawn larger and hollow, so
        // both show (Excalidraw's `interactiveScene.ts:268-289`, `:1120-1127`).
        const overlapping = i > 0 && Math.hypot(drawn[i * 2] - drawn[i * 2 - 2], drawn[i * 2 + 1] - drawn[i * 2 - 1]) <= number(read, '--size-point-overlap') * scale;
        const radius = editingThis ? editRadius : pointRadius;
        const handle = new Konva.Circle({
          x: drawn[i * 2],
          y: drawn[i * 2 + 1],
          radius: overlapping ? radius * (editingThis ? 1.5 : 2) : radius,
          fill: chosen.has(i) ? colour : surface,
          fillEnabled: !overlapping || chosen.has(i),
          stroke: colour,
          strokeWidth: scale,
        });
        this.#endpoints.push(handle);
        this.#overlay.add(handle);
      }
      const shortest = number(read, '--size-bend-min-segment') * scale;
      // Outside point editing, only a two-point line or arrow offers its middle.
      const middles =
        count >= 2 && offersMiddles(linear, editingThis)
          ? middlesAlong(drawn, (linear as SceneElement & ArrowProps).arrowType, tensionOf(linear))
          : [];
      // A middle is offered under the label too: a press on it bends (S8).
      middles.forEach((middle, i) => {
        const [x1, y1, x2, y2] = drawn.slice(i * 2, i * 2 + 4);
        if (Math.hypot(x2 - x1, y2 - y1) < shortest) return;
        const handle = new Konva.Circle({
          x: middle.x,
          y: middle.y,
          radius: pointRadius,
          fill: colour,
          opacity: MIDDLE_HANDLE_OPACITY,
        });
        this.#middles.push(handle);
        this.#overlay?.add(handle);
      });
      // Each attached end's anchor, a disc with a dashed line to its end,
      // dragged to move it (`selection-chrome.ts`, as the pointer presses it).
      const focusRadius = (number(read, '--size-focus-point') / 2) * scale;
      for (const spot of focusSpots(linear, this.#last.elements, pointRadius * 2)) {
        const line = new Konva.Line({
          points: [spot.at.x, spot.at.y, spot.end.x, spot.end.y],
          stroke: colour,
          strokeWidth: scale,
          dash: [number(read, '--size-marquee-dash') * scale, number(read, '--size-marquee-dash') * scale],
          listening: false,
        });
        const disc = new Konva.Circle({ x: spot.at.x, y: spot.at.y, radius: focusRadius, fill: colour, listening: false });
        this.#focusLines.push(line);
        this.#focus.push(disc);
        this.#overlay?.add(line);
        this.#overlay?.add(disc);
      }
      // An elbow's segments, each dragged by its middle (the rule in
      // `selection-chrome.ts`, which the pointer presses by): hollow when
      // free, filled when fixed.
      for (const segment of elbowSegmentHandles(linear, (number(read, '--size-point-handle') / 2) * scale)) {
        const handle = new Konva.Circle({
          x: segment.at.x,
          y: segment.at.y,
          radius: pointRadius,
          fill: segment.fixed ? colour : surface,
          stroke: colour,
          strokeWidth: scale,
        });
        this.#segments.push(handle);
        this.#overlay?.add(handle);
      }
    }

    // The rotate handle: a disc above the frame, clear of the top edge. Not
    // drawn when nothing in the selection can turn, so no handle is dead.
    if (!chrome.rotate) {
      this.#overlay.batchDraw();
      return;
    }
    const gap = number(read, '--size-rotate-gap') * scale;
    const at = rotateHandleCentre(bounds, gap);
    this.#rotate = turn(
      new Konva.Circle({
        x: at.x,
        y: at.y,
        radius: size / 2,
        fill: surface,
        stroke: colour,
        strokeWidth: scale,
      }),
    ) as Konva.Circle;
    this.#overlay.add(this.#rotate);
    this.#overlay.batchDraw();
  }

  /**
   * Draw the rectangle being dragged over empty space to select, or clear it.
   * Dashed, in the selection colour, screen-sized at every zoom.
   */
  setMarquee(box: { x: number; y: number; w: number; h: number } | null): void {
    if (!this.#overlay) return;
    if (!box) {
      this.#marquee?.destroy();
      this.#marquee = null;
      this.#overlay.batchDraw();
      return;
    }
    const read = cached(this.#read);
    const scale = 1 / this.#zoom;
    const dash = number(read, '--size-marquee-dash') * scale;
    if (!this.#marquee) {
      this.#marquee = new Konva.Rect();
      this.#overlay.add(this.#marquee);
    }
    this.#marquee.setAttrs({
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      stroke: read('--color-selection-handle').trim(),
      strokeWidth: scale,
      dash: [dash, dash],
    });
    this.#overlay.batchDraw();
  }

  /**
   * Draw the guides a snap made, or clear them with an empty list:
   * Excalidraw's, solid, screen-sized at every zoom. Aligned points get a
   * line through them and a cross at each; a pointer snap a cross at its
   * target and a line to the pointer; equal spacing a line along each gap
   * with a tick at each end and two marks at its middle.
   */
  setSnapGuides(guides: Guide[]): void {
    // Hovering asks every frame; nothing to nothing draws nothing.
    if (guides.length === 0 && this.#snapGuides.length === 0) return;
    this.#snapGuides = guides;
    this.#drawSnapGuides(cached(this.#read));
  }

  /** The snap guides' lines, for tests: what was drawn. */
  snapGuideLines(): Konva.Line[] {
    return this.#snapGuideLines;
  }

  #drawSnapGuides(read: ReadVariable): void {
    for (const line of this.#snapGuideLines) line.destroy();
    this.#snapGuideLines = [];
    if (!this.#overlay) return;
    const scale = 1 / this.#zoom;
    const colour = read('--color-snap-guide').trim();
    const width = number(read, '--size-snap-guide') * scale;
    const cross = (number(read, '--size-snap-cross') / 2) * scale;
    const tick = (number(read, '--size-snap-gap-tick') / 2) * scale;
    const mark = (number(read, '--size-snap-gap-mark') / 2) * scale;
    const segments: number[][] = [];
    const crossAt = (p: Point) => {
      segments.push([p.x - cross, p.y - cross, p.x + cross, p.y + cross], [p.x - cross, p.y + cross, p.x + cross, p.y - cross]);
    };
    for (const guide of this.#snapGuides) {
      if (guide.kind === 'points') {
        const first = guide.points[0];
        const last = guide.points[guide.points.length - 1];
        if (first && last && (first.x !== last.x || first.y !== last.y)) segments.push([first.x, first.y, last.x, last.y]);
        guide.points.forEach(crossAt);
      } else if (guide.kind === 'pointer') {
        segments.push([guide.from.x, guide.from.y, guide.to.x, guide.to.y]);
        crossAt(guide.from);
      } else {
        const { from, to } = guide;
        segments.push([from.x, from.y, to.x, to.y]);
        // Across the gap: a tick at each end, and two marks either side of the middle.
        const across = (at: Point, reach: number) =>
          guide.axis === 'x' ? [at.x, at.y - reach, at.x, at.y + reach] : [at.x - reach, at.y, at.x + reach, at.y];
        segments.push(across(from, tick), across(to, tick));
        const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        // The marks sit half their own reach either side of the middle.
        const apart = mark / 2;
        const along = (by: number) => (guide.axis === 'x' ? { x: middle.x + by, y: middle.y } : { x: middle.x, y: middle.y + by });
        segments.push(across(along(-apart), mark), across(along(apart), mark));
      }
    }
    for (const points of segments) {
      const line = new Konva.Line({ points, stroke: colour, strokeWidth: width, listening: false });
      this.#overlay.add(line);
      this.#snapGuideLines.push(line);
    }
    this.#overlay.batchDraw();
  }

  /**
   * Fade the elements the eraser has marked and draw its trail (scene
   * coordinates, flat x,y pairs). An empty set and trail clear both.
   */
  setErasing(ids: ReadonlySet<ElementId>, trail: number[]): void {
    const read = cached(this.#read);
    const faded = parseFloat(read('--opacity-erasing')) || 0;
    // Back to the element's own opacity: an unchanged element is not
    // re-applied by the next render, so nothing else would restore it.
    for (const id of this.#markedForErase) {
      if (ids.has(id)) continue;
      const element = this.#last.elements.find((e) => e.id === id);
      if (element) this.#entries.get(id)?.group.opacity(paintFor(element, read).opacity);
    }
    for (const id of ids) this.#entries.get(id)?.group.opacity(faded);
    this.#markedForErase = new Set(ids);
    this.#layer?.batchDraw();

    if (!this.#overlay) return;
    if (trail.length < 4) {
      this.#trail?.destroy();
      this.#trail = null;
    } else {
      if (!this.#trail) {
        this.#trail = new Konva.Line({ lineCap: 'round', lineJoin: 'round' });
        this.#overlay.add(this.#trail);
      }
      this.#trail.setAttrs({
        points: trail,
        stroke: read('--color-text-faint').trim(),
        strokeWidth: number(read, '--size-eraser-trail') / this.#zoom,
      });
    }
    this.#overlay.batchDraw();
  }

  /** The eraser trail being drawn, or null. */
  eraserTrail(): Konva.Line | null {
    return this.#trail;
  }

  /** An arrow's head nodes, for tests: what was drawn, not what was asked for. */
  arrowHeads(id: ElementId): Konva.Shape[] {
    return this.#entries.get(id)?.heads ?? [];
  }

  /** The marquee being drawn, or null. */
  marquee(): Konva.Rect | null {
    return this.#marquee;
  }

  /** Show the scene at a zoom and pan, as the viewport computes them. */
  setViewport(view: { zoom: number; pan: { x: number; y: number } }): void {
    this.#zoom = view.zoom;
    // Guides are screen-sized: a zoom while hovering redraws them.
    if (this.#snapGuides.length > 0) this.#drawSnapGuides(cached(this.#read));
    this.#stage?.scale({ x: view.zoom, y: view.zoom });
    this.#stage?.position(view.pan);
    this.#stage?.batchDraw();
    this.#drawSelection(cached(this.#read));
  }

  scale(): number {
    return this.#stage?.scaleX() ?? this.#zoom;
  }

  position(): { x: number; y: number } {
    return this.#stage ? { x: this.#stage.x(), y: this.#stage.y() } : { x: 0, y: 0 };
  }

  /** Match the host element's size, when the window or a pane changes. */
  resize(width: number, height: number): void {
    this.#stage?.size({ width, height });
  }

  /**
   * The drawn scene as a canvas, at `pixelRatio` device pixels per scene unit.
   * What the export encodes: the same nodes, drawn by the same renderer.
   */
  toCanvas(pixelRatio = 1): HTMLCanvasElement {
    if (!this.#stage) throw new Error('canvas: the stage is not mounted');
    return this.#stage.toCanvas({ pixelRatio });
  }

  size(): { width: number; height: number } {
    return this.#stage ? this.#stage.size() : { width: 0, height: 0 };
  }

  /** Re-read every colour, for a theme change. Nodes are kept, not recreated. */
  restyle(): void {
    const read = cached(this.#read);
    for (const element of this.#last.elements) {
      const entry = this.#entries.get(element.id);
      if (entry) {
        this.#style(entry, element, read);
        this.#drawLanguage(entry, element, read);
      }
    }
    this.#layer?.batchDraw();
    this.#drawSelection(read);
    if (this.#snapGuides.length > 0) this.#drawSnapGuides(read);
  }

  /** The Konva group for an element, positioned at its `x, y`. */
  nodeFor(id: ElementId): Konva.Group | undefined {
    return this.#entries.get(id)?.group;
  }

  /** The shape that draws an element, in the group's local coordinates. */
  bodyFor(id: ElementId): Konva.Shape | undefined {
    return this.#entries.get(id)?.body;
  }

  /**
   * Re-apply every element, as if all had changed: for a change render cannot
   * see in the scene, such as the bundled fonts finishing loading, after which
   * text measured with a fallback must be wrapped again.
   */
  invalidate(): void {
    for (const entry of this.#entries.values()) entry.applied = null;
    this.render(this.#last);
  }

  /**
   * Hide an element's text while an editor draws it, or show it again with
   * null. A label is hidden; free text's body is its text, so the body is.
   */
  setEditing(id: ElementId | null): void {
    const previous = this.#editing;
    this.#editing = id;
    for (const each of [previous, id]) {
      const entry = each ? this.#entries.get(each) : undefined;
      if (entry) this.#showText(entry, each!);
    }
    this.#layer?.batchDraw();
  }

  #showText(entry: Entry, id: ElementId): void {
    const shown = this.#editing !== id;
    entry.label?.visible(shown);
    if (entry.type === 'text') entry.body.visible(shown);
  }

  /** A shape's label, when it has one. */
  labelFor(id: ElementId): Konva.Text | undefined {
    return this.#entries.get(id)?.label ?? undefined;
  }

  get nodeCount(): number {
    return this.#entries.size;
  }

  orderedIds(): ElementId[] {
    return [...this.#entries.entries()]
      .sort((a, b) => a[1].group.zIndex() - b[1].group.zIndex())
      .map(([id]) => id);
  }

  destroy(): void {
    this.#pulse?.stop();
    this.#pulse = null;
    this.#stage?.destroy();
    this.#stage = null;
    this.#layer = null;
    this.#overlay = null;
    this.#outline = null;
    this.#handles = [];
    this.#entries.clear();
    this.#order = [];
    this.#pending = null;
  }

  /** Measures a line the way this element is drawn, for the shared breaker. */
  #lineWidth(element: SceneElement, read: ReadVariable): (line: string) => number {
    const paint = paintFor(element, read);
    return canvasLineWidth(`${paint.font.size}px ${paint.font.family}`);
  }

  #create(element: SceneElement): Entry {
    const group = new Konva.Group();
    const body = this.#createBody(element);
    const heads: Konva.Shape[] = [];
    const detached: Konva.Circle[] = [];
    const runs: Konva.Text[] = [];
    const drawnRuns: Run[][] | null = null;
    // A line's body sits in a group of its own, which clips it out from
    // under its label (06.16, L7); the heads and label stay outside it.
    if (element.type === 'arrow' || element.type === 'line') {
      const clip = new Konva.Group();
      clip.add(body);
      group.add(clip);
    } else {
      group.add(body);
    }
    return { group, body, heads, detached, runs, drawnRuns, drawnPaint: '', label: null, type: element.type, applied: null, tag: null, border: null };
  }

  #createBody(element: SceneElement): Konva.Shape {
    switch (element.type) {
      case 'ellipse':
        return new Konva.Ellipse({ radiusX: 0, radiusY: 0 });
      case 'arrow':
        return new Konva.Arrow({ points: [], lineCap: 'round', lineJoin: 'round' });
      case 'line':
      case 'stroke':
        return new Konva.Line({ points: [], lineCap: 'round', lineJoin: 'round' });
      case 'text':
        return new Konva.Text({ text: '' });
      default:
        if (isOutlineShape(element.type)) {
          const type = element.type;
          return new Konva.Shape({
            sceneFunc: (context, shape) => {
              context.beginPath();
              // Excalidraw's proportional radius: a quarter of the shorter side.
              const radius = shape.getAttr('bavaRound')
                ? Math.min(shape.width(), shape.height()) * ROUND_SHARE
                : 0;
              drawOutline(type, context, shape.width(), shape.height(), radius);
              context.fillStrokeShape(shape);
            },
          });
        }
        return new Konva.Rect({});
    }
  }

  #apply(entry: Entry, element: SceneElement, read: ReadVariable): void {
    const { group, body } = entry;
    // A rotated group turns about the element's centre, so the stored box (and
    // the file) stays the upright one. Offset moves the group's origin there.
    const angle = angleOfElement(element);
    if (angle === 0) {
      group.rotation(0);
      group.offset({ x: 0, y: 0 });
      group.x(element.x);
      group.y(element.y);
    } else {
      const centre = centreOf(element);
      group.offset({ x: element.w / 2, y: element.h / 2 });
      group.rotation(angle);
      group.x(centre.x);
      group.y(centre.y);
    }

    if (body instanceof Konva.Ellipse) {
      body.x(element.w / 2);
      body.y(element.h / 2);
      body.radiusX(element.w / 2);
      body.radiusY(element.h / 2);
    } else if (body instanceof Konva.Line) {
      const points = 'points' in element ? element.points : [];
      const routed =
        element.type === 'arrow' ? pathOf(points, (element as SceneElement & ArrowProps).arrowType) : points;
      // Smoothed here rather than by Konva's own tension, which the exporter
      // cannot see: both renderers draw the samples `curves.ts` returns.
      body.points(smoothPoints(routed, paintFor(element, read).tension));
    } else {
      body.width(element.w);
      body.height(element.h);
    }
    if (body instanceof Konva.Text && element.type === 'text') {
      // Broken here, not by Konva: the exporter cannot see inside Konva's
      // wrapping, so both renderers break through `text-layout.ts` instead.
      body.text(wrapLines(element.text, element.w, this.#lineWidth(element, read)).join('\n'));
    }

    // A shape's label is centred in it; a frame's sits at its top-left corner;
    // an arrow's sits on the middle of the path it takes.
    const labelled = isShapeType(element.type) || element.type === 'frame' || element.type === 'arrow';
    const label = labelled && 'label' in element ? element.label : undefined;
    if (label) {
      if (!entry.label) {
        entry.label = new Konva.Text({ wrap: 'none', listening: false });
        group.add(entry.label);
      }
      const inset = number(read, '--size-label-inset');
      const isFrame = element.type === 'frame';
      const isArrow = element.type === 'arrow';
      const props = element as SceneElement & StyleProps;
      entry.label.text(
        wrapLines(label, Math.max(0, element.w - inset * 2), this.#lineWidth(element, read)).join('\n'),
      );
      entry.label.align(props.align ?? (isFrame ? 'left' : 'center'));
      entry.label.verticalAlign(props.verticalAlign ?? (isFrame ? 'top' : 'middle'));
      if (isArrow) {
        // Centred on the middle point (or where it was slid), in the group's
        // own space, and wrapped as Excalidraw wraps it: the exporter does the
        // same, so a long label breaks identically in both.
        const routed = (body as Konva.Line).points();
        const paint = paintFor(element, read);
        const measure = canvasLineWidth(`${paint.font.size}px ${paint.font.family}`);
        // One layout for the stage, the exporter and the label editor, turned
        // along the arrow when it says so (06.17).
        const layout = labelLayout(element, routed, paint.tension, paint.font, measure, label);
        entry.label.text(layout.lines.join('\n'));
        entry.label.align('center');
        entry.label.verticalAlign('middle');
        entry.label.width(layout.width);
        entry.label.height(layout.height);
        entry.label.offsetX(layout.width / 2);
        entry.label.offsetY(layout.height / 2);
        entry.label.x(layout.at.x);
        entry.label.y(layout.at.y);
        entry.label.rotation(layout.angle);
        // The line is hidden under the label's box and a margin round it,
        // turned with it.
        const hole = labelCorners(layout, LABEL_CLEARANCE);
        (body.getParent() as Konva.Group).clipFunc((context) => {
          context.rect(-CLIP_EXTENT, -CLIP_EXTENT, CLIP_EXTENT * 2, CLIP_EXTENT * 2);
          context.moveTo(hole[0].x, hole[0].y);
          for (const corner of hole.slice(1)) context.lineTo(corner.x, corner.y);
          context.closePath();
          return ['evenodd'];
        });
      } else {
        entry.label.rotation(0);
        entry.label.offsetX(0);
        entry.label.offsetY(0);
        entry.label.x(inset);
        entry.label.y(isFrame ? inset : 0);
        entry.label.width(Math.max(0, element.w - inset * 2));
        entry.label.height(isFrame ? Math.max(0, element.h - inset * 2) : element.h);
      }
    } else if (entry.label) {
      entry.label.destroy();
      entry.label = null;
    }
    // No label, nothing hidden.
    if (!entry.label && body.getParent() !== entry.group) (body.getParent() as Konva.Group).clipFunc(undefined as never);

    this.#style(entry, element, read);
    // A label created mid-edit starts hidden, as the one it replaces was.
    this.#showText(entry, element.id);
    this.#drawHeads(entry, element, read);
    this.#drawDetached(entry, element, read);
    this.#drawCode(entry, element, read);
    this.#drawLanguage(entry, element, read);
  }

  /**
   * A code block's language on its top edge, near the left, with the border
   * hidden behind it (`code/language-tag.ts`); none for plain text.
   */
  #drawLanguage(entry: Entry, element: SceneElement, read: ReadVariable): void {
    // Only code blocks carry one; nothing to undo on anything else.
    if (element.type !== 'code' && !entry.tag) return;
    const paint = paintFor(element, read);
    const size = number(read, '--text-code-language');
    const family = read('--font-mono').trim() || paint.font.family;
    const tag =
      element.type === 'code'
        ? languageTag(element, canvasLineWidth(`${size}px ${family}`), {
            size,
            lineHeight: number(read, '--leading-tight'),
            inset: number(read, '--size-code-language-inset'),
            clearance: number(read, '--size-code-language-clearance'),
          })
        : null;
    if (!tag) {
      entry.tag?.destroy();
      entry.tag = null;
      entry.border?.getParent()?.destroy();
      entry.border = null;
      if (element.type === 'code') entry.body.strokeEnabled(true);
      return;
    }
    // The body keeps its fill; its border is drawn apart, with a hole.
    entry.body.strokeEnabled(false);
    if (!entry.border) {
      const clip = new Konva.Group({ listening: false });
      entry.border = new Konva.Rect({ listening: false });
      clip.add(entry.border);
      entry.group.add(clip);
    }
    entry.border.setAttrs({ width: element.w, height: element.h, cornerRadius: paint.cornerRadius, stroke: paint.stroke, strokeWidth: paint.strokeWidth });
    const gap = tag.gap;
    (entry.border.getParent() as Konva.Group).clipFunc((context) => {
      context.rect(-CLIP_EXTENT, -CLIP_EXTENT, CLIP_EXTENT * 2, CLIP_EXTENT * 2);
      context.rect(gap.x, gap.y, gap.w, gap.h);
      return ['evenodd'];
    });
    if (!entry.tag) {
      entry.tag = new Konva.Text({ listening: false, wrap: 'none' });
      entry.group.add(entry.tag);
    }
    entry.tag.setAttrs({
      x: tag.x,
      y: tag.y,
      text: tag.text,
      fontFamily: family,
      fontSize: size,
      lineHeight: number(read, '--leading-tight'),
      fill: read('--color-text-muted').trim(),
    });
  }

  /** A code block's language name node, or null (for tests). */
  codeLanguage(id: ElementId): Konva.Text | null {
    return this.#entries.get(id)?.tag ?? null;
  }

  /** A code block's border, drawn apart when its language is named (for tests). */
  codeBorder(id: ElementId): Konva.Rect | null {
    return this.#entries.get(id)?.border ?? null;
  }

  /**
   * A marker on an end whose binding names an element that is not there.
   *
   * The endpoint has frozen where it last was, and the file still holds the
   * id: the user drew this arrow, so nothing is removed on their behalf
   * (`canvas-architecture.md`). The marker is how they can see it.
   */
  #drawDetached(entry: Entry, element: SceneElement, read: ReadVariable): void {
    for (const marker of entry.detached) marker.destroy();
    entry.detached = [];
    if (element.type !== 'arrow' || !isDetached(element, this.#last)) return;

    const { start, end } = bindingsOf(element);
    const points = ('points' in element ? element.points : []) as number[];
    if (points.length < 4) return;
    const missing = (id?: string) => id !== undefined && !this.#last.elements.some((e) => e.id === id);
    const size = number(read, '--size-selection-handle') / this.#zoom;

    for (const [id, index] of [
      [start, 0],
      [end, points.length - 2],
    ] as [string | undefined, number][]) {
      if (!missing(id)) continue;
      const marker = new Konva.Circle({
        x: points[index],
        y: points[index + 1],
        radius: size / 2,
        stroke: read('--color-danger').trim(),
        strokeWidth: 1 / this.#zoom,
        listening: false,
      });
      entry.detached.push(marker);
      entry.group.add(marker);
    }
  }

  /**
   * An arrow's heads, one node each, placed and turned at the routed path's
   * ends. Konva's own pointer draws a triangle and nothing else.
   */
  #drawHeads(entry: Entry, element: SceneElement, read: ReadVariable): void {
    for (const head of entry.heads) head.destroy();
    entry.heads = [];
    if (element.type !== 'arrow') return;

    const props = element as SceneElement & ArrowProps;
    const points = (entry.body as Konva.Line).points();
    // The arrow's own points cap a head's size, as Excalidraw's: a drawn
    // curve's samples and an elbow's rounded corners do not.
    const route = ('points' in element ? element.points : []) as number[];
    const colour = resolveStyle(element as { stroke?: string }, read).stroke;
    const surface = read('--color-canvas-bg').trim();
    const width = (element as SceneElement & StyleProps).strokeWidth ?? DEFAULT_STROKE_WIDTH;
    const style = (element as SceneElement & StyleProps).strokeStyle;

    for (const end of ['start', 'end'] as const) {
      const kind = end === 'start' ? (props.startArrowhead ?? 'none') : (props.endArrowhead ?? 'arrow');
      if (kind === 'none') continue;
      const at = headAt(points, end);
      const node = new Konva.Shape({
        x: at.x,
        y: at.y,
        rotation: at.angle,
        name: kind,
        listening: false,
        sceneFunc: (context, shape) => {
          context.beginPath();
          drawHead(context, kind, endSegment(route, end), width);
          context.fillStrokeShape(shape);
        },
      });
      // How this head is filled, asked without drawing: the line's colour,
      // or the canvas's for an outline head, which hides the line under it.
      const fill = drawHead(NO_SINK, kind, endSegment(route, end), width);
      node.fill(fill === 'stroke' ? colour : fill === 'surface' ? surface : '');
      node.stroke(colour);
      // The line's own stroke, half a unit thicker when dashed or dotted.
      node.strokeWidth(paintFor(element, read).strokeWidth);
      node.dash(headDash(kind, style, width));
      entry.heads.push(node);
      entry.group.add(node);
    }
  }

  #style(entry: Entry, element: SceneElement, read: ReadVariable): void {
    // How it looks is decided once, in paint.ts, and the exporter reads the
    // same description: a second set of rules here would drift from the file
    // a user exports.
    const paint = paintFor(element, read);
    const { body } = entry;

    // The element's own opacity, on the group so a label fades with its shape.
    entry.group.opacity(paint.opacity);
    body.dash(paint.dash);
    if (body instanceof Konva.Rect) body.cornerRadius(paint.cornerRadius);
    // A polygon outline rounds itself when it draws; the flag rides on the node.
    if (isOutlineShape(element.type)) body.setAttr('bavaRound', paint.cornerRadius > 0);
    // The smoothing is already in the points; Konva must not smooth them again.
    if (body instanceof Konva.Line) body.tension(0);

    body.stroke(paint.stroke);
    body.fill(element.type === 'text' ? paint.font.colour : paint.fill);
    // A closed line with a fill is drawn as a filled loop (06.15).
    if (element.type === 'line') (body as Konva.Line).closed(paint.fill !== '');
    body.strokeWidth(paint.strokeWidth);

    if (body instanceof Konva.Text && element.type === 'text') {
      body.fontFamily(paint.font.family);
      body.fontSize(paint.font.size);
      body.lineHeight(paint.font.lineHeight);
      body.align(paint.font.align);
      // Set explicitly, so the exporter and Konva agree rather than each
      // falling back to its own default.
      body.verticalAlign(paint.font.verticalAlign);
    }
    if (body instanceof Konva.Arrow) {
      body.pointerLength(0);
      body.pointerWidth(0);
      // The heads are their own nodes; Konva's pointer draws triangles only.
      body.pointerAtBeginning(false);
      body.pointerAtEnding(false);
    }

    if (entry.label) {
      entry.label.fill(paint.font.colour);
      entry.label.fontFamily(paint.font.family);
      entry.label.fontSize(paint.font.size);
      entry.label.lineHeight(paint.font.lineHeight);
    }
  }
}



/** A sink that draws nothing: for asking a head whether it is filled. */
const NO_SINK = { moveTo: () => {}, lineTo: () => {}, bezierCurveTo: () => {}, closePath: () => {} };

/** The dash pattern for a stroke style, in scene units, or none. */

function boundsToRect(box: { x: number; y: number; w: number; h: number }) {
  return { x: box.x, y: box.y, width: box.w, height: box.h };
}
