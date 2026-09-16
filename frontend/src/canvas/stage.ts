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
 */
import Konva from 'konva';
import type { SceneData, SceneElement, ElementId } from './scene';

export class CanvasStage {
  #stage: Konva.Stage | null = null;
  #layer: Konva.Layer | null = null;
  #nodes = new Map<ElementId, Konva.Shape>();
  /** A scene that arrived before there was anywhere to paint it. */
  #pending: SceneData | null = null;

  mount(host: HTMLDivElement): void {
    this.#stage = new Konva.Stage({
      container: host,
      width: host.clientWidth,
      height: host.clientHeight,
    });
    this.#layer = new Konva.Layer();
    this.#stage.add(this.#layer);

    if (this.#pending) {
      const pending = this.#pending;
      this.#pending = null;
      this.render(pending);
    }
  }

  /**
   * Patch the stage to match the scene.
   *
   * Existing nodes are updated in place and only missing ones are created —
   * rebuilding every node on every render is the performance trap this class
   * exists to avoid.
   */
  render(scene: SceneData): void {
    if (!this.#layer) {
      this.#pending = scene;
      return;
    }

    const seen = new Set<ElementId>();

    for (const element of scene.elements) {
      seen.add(element.id);
      const existing = this.#nodes.get(element.id);
      if (existing) {
        this.#apply(existing, element);
        continue;
      }
      const node = this.#create(element);
      this.#nodes.set(element.id, node);
      this.#layer.add(node);
    }

    for (const [id, node] of this.#nodes) {
      if (seen.has(id)) continue;
      node.destroy();
      this.#nodes.delete(id);
    }

    // Konva paints in child order, so z is applied rather than assumed.
    for (const element of scene.elements) {
      this.#nodes.get(element.id)?.zIndex(scene.elements.indexOf(element));
    }

    this.#layer.batchDraw();
  }

  /** The Konva node for an element, for tests and hit-testing. */
  nodeFor(id: ElementId): Konva.Shape | undefined {
    return this.#nodes.get(id);
  }

  get nodeCount(): number {
    return this.#nodes.size;
  }

  orderedIds(): ElementId[] {
    return [...this.#nodes.entries()]
      .sort((a, b) => a[1].zIndex() - b[1].zIndex())
      .map(([id]) => id);
  }

  destroy(): void {
    this.#stage?.destroy();
    this.#stage = null;
    this.#layer = null;
    this.#nodes.clear();
    this.#pending = null;
  }

  #create(element: SceneElement): Konva.Shape {
    switch (element.type) {
      case 'ellipse':
        return new Konva.Ellipse({ radiusX: element.w / 2, radiusY: element.h / 2 });
      case 'line':
      case 'arrow':
      case 'stroke':
        return new Konva.Line({ points: element.points });
      case 'text':
        return new Konva.Text({ text: element.text });
      default:
        return new Konva.Rect({});
    }
  }

  #apply(node: Konva.Shape, element: SceneElement): void {
    node.x(element.x);
    node.y(element.y);
    if (node instanceof Konva.Rect || node instanceof Konva.Text) {
      node.width(element.w);
      node.height(element.h);
    }
    if (node instanceof Konva.Ellipse) {
      node.radiusX(element.w / 2);
      node.radiusY(element.h / 2);
    }
    if (node instanceof Konva.Line && 'points' in element) {
      node.points(element.points);
    }
    if (node instanceof Konva.Text && element.type === 'text') {
      node.text(element.text);
    }
  }
}
