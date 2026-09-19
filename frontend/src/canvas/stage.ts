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
import { drawOutline, isOutlineShape } from './shapes';
import { paintFor, ROUND_SHARE } from './paint';
import { wrapLines } from './text-layout';
import { smoothPoints } from './curves';
import { bindingsOf, isDetached } from './binding';
import type { Run } from './code/highlight';
import { monoAdvance } from './code/advance';
import { columnsIn } from './code/measure';
import { canvasLineWidth } from './text-measure';
import { drawHead, headAt, labelPoint, pathLength, routePoints } from './arrows';
import { readRootVariable, resolveStyle, type ReadVariable } from './palette';
import { HANDLES, handleCentre, rotateHandleCentre } from './resize';
import { angleOfElement, canRotate, centreOf, rotatedBounds, selectionFrame } from './rotate';

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
  /** Outlines on the shapes an arrow being drawn would attach to. */
  #candidates: Konva.Rect[] = [];
  #candidateIds: ElementId[] = [];
  /** Tokenised code per block, handed in by the caller. */
  #codeRuns = new Map<ElementId, Run[][]>();
  #marquee: Konva.Rect | null = null;
  #trail: Konva.Line | null = null;
  #markedForErase = new Set<ElementId>();
  #zoom = 1;
  #entries = new Map<ElementId, Entry>();
  /** A scene that arrived before there was anywhere to paint it. */
  #pending: SceneData | null = null;
  #last: SceneData = { elements: [] };
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
    this.#layer = new Konva.Layer();
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
      }
      this.#apply(entry, element, read);
    }

    for (const [id, entry] of this.#entries) {
      if (seen.has(id)) continue;
      entry.group.destroy();
      this.#entries.delete(id);
      // The runs go with the element, or the map grows for the session.
      this.#codeRuns.delete(id);
    }

    // Konva paints in child order, so z is applied rather than assumed.
    scene.elements.forEach((element, index) => this.#entries.get(element.id)?.group.zIndex(index));

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
  setBindingCandidates(ids: ElementId[]): void {
    this.#candidateIds = [...ids];
    this.#drawCandidates(cached(this.#read));
  }

  bindingHighlights(): Konva.Rect[] {
    return this.#candidates;
  }

  #drawCandidates(read: ReadVariable): void {
    if (!this.#overlay) return;
    this.#candidates.forEach((node) => node.destroy());
    this.#candidates = [];
    const colour = read('--color-selection-handle').trim();
    const scale = 1 / this.#zoom;
    for (const id of this.#candidateIds) {
      const element = this.#last.elements.find((e) => e.id === id);
      if (!element) continue;
      const outline = new Konva.Rect({
        ...boundsToRect(rotatedBounds(element)),
        stroke: colour,
        strokeWidth: scale * 2,
        listening: false,
      });
      this.#candidates.push(outline);
      this.#overlay.add(outline);
    }
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
    const paintKey = `${paint.font.family} ${paint.font.size} ${paint.font.lineHeight} ${this.#zoom}`;
    if (entry.drawnRuns === runsNow && entry.drawnPaint === paintKey) return;
    entry.drawnRuns = runsNow;
    entry.drawnPaint = paintKey;

    for (const node of entry.runs) node.destroy();
    entry.runs = [];
    const padding = number(read, '--size-code-padding');
    const lineHeight = paint.font.size * paint.font.lineHeight;
    const advance = monoAdvance(paint.font.size, paint.font.family);
    runsNow.forEach((line, row) => {
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

  /** The handles at the ends of a selected arrow. */
  endpointHandles(): Konva.Circle[] {
    return this.#endpoints;
  }

  #drawSelection(read: ReadVariable): void {
    if (!this.#overlay) return;
    this.#outline?.destroy();
    this.#handles.forEach((handle) => handle.destroy());
    this.#rotate?.destroy();
    this.#endpoints.forEach((end) => end.destroy());
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
    const bounds = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
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
    this.#outline = turn(
      new Konva.Rect({ ...boundsToRect(bounds), stroke: colour, strokeWidth: scale }),
    ) as Konva.Rect;
    this.#overlay.add(this.#outline);

    const size = number(read, '--size-selection-handle') * scale;
    for (const handle of HANDLES) {
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

    // One selected arrow: a handle at each end, where the press zone is. For
    // an elbow or an arc the box corners are nowhere near the ends, so the
    // resize handles do not stand in for these.
    if (selected.length === 1 && selected[0].type === 'arrow') {
      const arrow = selected[0];
      const points = ('points' in arrow ? arrow.points : []) as number[];
      for (const index of [0, points.length - 2]) {
        if (points.length < 4) break;
        const end = new Konva.Circle({
          x: arrow.x + points[index],
          y: arrow.y + points[index + 1],
          radius: size / 2,
          fill: surface,
          stroke: colour,
          strokeWidth: scale,
        });
        this.#endpoints.push(end);
        this.#overlay.add(end);
      }
    }

    // The rotate handle: a disc above the frame, clear of the top edge. Not
    // drawn when nothing in the selection can turn, so no handle is dead.
    if (!selected.some(canRotate)) {
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
   * Fade the elements the eraser has marked and draw its trail (scene
   * coordinates, flat x,y pairs). An empty set and trail clear both.
   */
  setErasing(ids: ReadonlySet<ElementId>, trail: number[]): void {
    const read = cached(this.#read);
    const faded = parseFloat(read('--opacity-erasing')) || 0;
    for (const id of this.#markedForErase) {
      if (!ids.has(id)) this.#entries.get(id)?.group.opacity(1);
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
      if (entry) this.#style(entry, element, read);
    }
    this.#layer?.batchDraw();
    this.#drawSelection(read);
  }

  /** The Konva group for an element, positioned at its `x, y`. */
  nodeFor(id: ElementId): Konva.Group | undefined {
    return this.#entries.get(id)?.group;
  }

  /** The shape that draws an element, in the group's local coordinates. */
  bodyFor(id: ElementId): Konva.Shape | undefined {
    return this.#entries.get(id)?.body;
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
    this.#stage?.destroy();
    this.#stage = null;
    this.#layer = null;
    this.#overlay = null;
    this.#outline = null;
    this.#handles = [];
    this.#entries.clear();
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
    group.add(body);
    return { group, body, heads, detached, runs, drawnRuns, drawnPaint: '', label: null, type: element.type };
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
        element.type === 'arrow' ? routePoints(points, (element as SceneElement & ArrowProps).arrowType) : points;
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
        // Centred on the middle of the drawn path, in the group's own space,
        // and wrapped to the path's length: the exporter wraps to the same
        // width, so a long label breaks identically in both.
        const routed = (body as Konva.Line).points();
        const at = labelPoint(routed);
        const paint = paintFor(element, read);
        const measure = canvasLineWidth(`${paint.font.size}px ${paint.font.family}`);
        const lines = wrapLines(label, pathLength(routed), measure);
        entry.label.text(lines.join('\n'));
        const width = Math.max(...lines.map(measure));
        const height = paint.font.size * paint.font.lineHeight * lines.length;
        entry.label.align('center');
        entry.label.verticalAlign('middle');
        entry.label.width(width);
        entry.label.height(height);
        entry.label.x(at.x - width / 2);
        entry.label.y(at.y - height / 2);
      } else {
        entry.label.x(inset);
        entry.label.y(isFrame ? inset : 0);
        entry.label.width(Math.max(0, element.w - inset * 2));
        entry.label.height(isFrame ? Math.max(0, element.h - inset * 2) : element.h);
      }
    } else if (entry.label) {
      entry.label.destroy();
      entry.label = null;
    }

    this.#style(entry, element, read);
    this.#drawHeads(entry, element, read);
    this.#drawDetached(entry, element, read);
    this.#drawCode(entry, element, read);
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
    const size = number(read, '--size-arrowhead');
    const colour = resolveStyle(element as { stroke?: string }, read).stroke;
    const width = (element as SceneElement & StyleProps).strokeWidth ?? number(read, '--size-shape-stroke');

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
          drawHead(context, kind, size);
          context.fillStrokeShape(shape);
        },
      });
      // Whether this head is filled or stroked, asked without drawing.
      const filled = drawHead(NO_SINK, kind, size);
      node.fill(filled ? colour : '');
      node.stroke(colour);
      node.strokeWidth(width);
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
      const head = number(read, '--size-arrowhead');
      body.pointerLength(head);
      body.pointerWidth(head);
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
