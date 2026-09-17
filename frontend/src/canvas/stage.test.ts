// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import Konva from 'konva';
import { CanvasStage } from './stage';
import { createScene, type SceneData, type SceneElement } from './scene';

// jsdom resolves no CSS variables, so the tests hand the stage a reader.
function reader(values: Record<string, string>) {
  return (name: string) => values[name] ?? '';
}

const themeA = reader({
  '--color-shape-fill': 'ivory',
  '--color-shape-stroke': 'slategray',
  '--color-shape-text': 'black',
  '--swatch-blue-fill': 'lightblue',
  '--swatch-blue-stroke': 'steelblue',
  '--swatch-blue-text': 'navy',
  '--size-shape-stroke': '1.5px',
});

function one(element: Omit<SceneElement, 'id' | 'z'> & Record<string, unknown>): SceneData {
  return { elements: [{ id: 'e1', z: 1, ...element } as SceneElement] };
}

function mounted(read = themeA) {
  const stage = new CanvasStage({ read });
  stage.mount(host());
  return stage;
}

function host(): HTMLDivElement {
  const el = document.createElement('div');
  // Konva reads the container size at mount.
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.append(el);
  return el;
}

function sceneWith(count: number) {
  const scene = createScene();
  for (let i = 0; i < count; i += 1) {
    scene.add({ type: 'rect', x: i * 20, y: 0, w: 10, h: 10 });
  }
  return scene;
}

describe('CanvasStage', () => {
  it('creates a node per element', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    stage.render(sceneWith(3).data());
    expect(stage.nodeCount).toBe(3);
    stage.destroy();
  });

  // The reason this class exists rather than per-element Svelte components:
  // a render that rebuilds every node reconciles the whole scene on every
  // keystroke and stutters at a few hundred elements.
  it('patches in place rather than rebuilding', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    const scene = sceneWith(3);
    stage.render(scene.data());

    const [first] = scene.ordered();
    const nodeBefore = stage.nodeFor(first.id);
    scene.update(first.id, { x: 500 });
    stage.render(scene.data());

    expect(stage.nodeFor(first.id)).toBe(nodeBefore);
    expect(stage.nodeFor(first.id)?.x()).toBe(500);
    stage.destroy();
  });

  it('removes nodes for elements that are gone', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    const scene = sceneWith(3);
    stage.render(scene.data());

    const [first] = scene.ordered();
    scene.remove(first.id);
    stage.render(scene.data());

    expect(stage.nodeCount).toBe(2);
    expect(stage.nodeFor(first.id)).toBeUndefined();
    stage.destroy();
  });

  it('renders in z-order', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    const scene = sceneWith(3);
    const ids = scene.ordered().map((e) => e.id);
    scene.bringToFront(ids[0]);
    stage.render(scene.data());
    expect(stage.orderedIds()).toEqual([ids[1], ids[2], ids[0]]);
    stage.destroy();
  });

  it('releases the stage on destroy', () => {
    const el = host();
    const stage = new CanvasStage();
    stage.mount(el);
    stage.render(sceneWith(2).data());
    stage.destroy();
    expect(stage.nodeCount).toBe(0);
    expect(el.querySelector('canvas')).toBeNull();
  });

  it('survives a render before mount', () => {
    const stage = new CanvasStage();
    expect(() => stage.render(sceneWith(1).data())).not.toThrow();
    const el = host();
    stage.mount(el);
    // The scene that arrived early is painted once there is somewhere to paint.
    expect(stage.nodeCount).toBe(1);
    stage.destroy();
  });

  // Seen at a running window: every shape was drawn with no stroke and no
  // fill, so drawing appeared to do nothing.
  it('gives a shape a stroke and a fill from the theme', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    const body = stage.bodyFor('e1')!;
    expect(body.stroke()).toBe('slategray');
    expect(body.fill()).toBe('ivory');
    expect(body.strokeWidth()).toBeGreaterThan(0);
    stage.destroy();
  });

  it('uses the element\'s swatches when it names them', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'blue', stroke: 'blue' }));
    expect(stage.bodyFor('e1')!.fill()).toBe('lightblue');
    expect(stage.bodyFor('e1')!.stroke()).toBe('steelblue');
    stage.destroy();
  });

  it('draws an ellipse inside its box, not centred on its corner', () => {
    const stage = mounted();
    stage.render(one({ type: 'ellipse', x: 10, y: 20, w: 100, h: 50 }));
    const body = stage.bodyFor('e1') as Konva.Ellipse;
    expect(stage.nodeFor('e1')!.x()).toBe(10);
    expect(body.x()).toBe(50);
    expect(body.y()).toBe(25);
    expect(body.radiusX()).toBe(50);
    stage.destroy();
  });

  it('draws the new shapes with an outline function sized to the box', () => {
    const stage = mounted();
    stage.render(one({ type: 'cylinder', x: 0, y: 0, w: 80, h: 120 }));
    const body = stage.bodyFor('e1')!;
    expect(body.getClassName()).toBe('Shape');
    expect(body.width()).toBe(80);
    expect(body.height()).toBe(120);
    expect(body.stroke()).toBe('slategray');
    stage.destroy();
  });

  it('draws an arrow with an arrowhead and its points', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 10, points: [0, 0, 50, 10] }));
    const body = stage.bodyFor('e1')!;
    expect(body).toBeInstanceOf(Konva.Arrow);
    expect((body as Konva.Arrow).points()).toEqual([0, 0, 50, 10]);
    expect(body.stroke()).toBe('slategray');
    stage.destroy();
  });

  it('draws a label centred and wrapped inside its shape', () => {
    const stage = mounted();
    stage.render(one({ type: 'diamond', x: 0, y: 0, w: 120, h: 60, label: 'Decide', color: 'blue' }));
    const label = stage.labelFor('e1')!;
    expect(label.text()).toBe('Decide');
    expect(label.fill()).toBe('navy');
    expect(label.width()).toBeLessThanOrEqual(120);
    expect(label.align()).toBe('center');
    expect(label.verticalAlign()).toBe('middle');
    stage.destroy();
  });

  it('draws a text element\'s text in the text colour', () => {
    const stage = mounted();
    stage.render(one({ type: 'text', x: 0, y: 0, w: 60, h: 20, text: 'Hello', measuredWidth: 60, measuredHeight: 20 }));
    const body = stage.bodyFor('e1') as Konva.Text;
    expect(body.text()).toBe('Hello');
    expect(body.fill()).toBe('black');
    stage.destroy();
  });

  // A theme switch recolours what is on screen without recreating it.
  it('restyle re-reads colours on the same nodes', () => {
    let values: Record<string, string> = { '--color-shape-stroke': 'slategray', '--color-shape-fill': 'ivory' };
    const stage = new CanvasStage({ read: (name) => values[name] ?? '' });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 10, h: 10 }));
    const before = stage.bodyFor('e1');

    values = { '--color-shape-stroke': 'white', '--color-shape-fill': 'black' };
    stage.restyle();

    expect(stage.bodyFor('e1')).toBe(before);
    expect(before!.stroke()).toBe('white');
    expect(before!.fill()).toBe('black');
    stage.destroy();
  });

  it('outlines the selection with eight handles, and clears it', () => {
    const stage = new CanvasStage({ read: reader({ '--color-selection-handle': 'dodgerblue' }) });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));

    stage.setSelection(['e1']);
    const outline = stage.selectionOutline()!;
    expect(outline.x()).toBe(10);
    expect(outline.width()).toBe(100);
    expect(outline.stroke()).toBe('dodgerblue');
    expect(stage.selectionHandleCount()).toBe(8);

    stage.setSelection([]);
    expect(stage.selectionOutline()).toBeNull();
    expect(stage.selectionHandleCount()).toBe(0);
    stage.destroy();
  });

  // Dragging over empty space showed nothing: the marquee was tracked but
  // never drawn.
  it('draws a dashed marquee on the overlay, and clears it', () => {
    const stage = new CanvasStage({ read: reader({ '--color-selection-handle': 'dodgerblue' }) });
    stage.mount(host());

    stage.setMarquee({ x: 5, y: 15, w: 120, h: 40 });
    const marquee = stage.marquee()!;
    expect(marquee.x()).toBe(5);
    expect(marquee.y()).toBe(15);
    expect(marquee.width()).toBe(120);
    expect(marquee.height()).toBe(40);
    expect(marquee.stroke()).toBe('dodgerblue');
    expect(marquee.dash().length).toBeGreaterThan(0);

    stage.setMarquee(null);
    expect(stage.marquee()).toBeNull();
    stage.destroy();
  });

  it('fades elements the eraser has marked, draws its trail, and clears both', () => {
    const stage = new CanvasStage({
      read: reader({ '--opacity-erasing': '0.2', '--color-text-faint': 'gray', '--size-eraser-trail': '6px' }),
    });
    stage.mount(host());
    stage.render({
      elements: [
        { id: 'e1', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 },
        { id: 'e2', type: 'rect', x: 20, y: 0, w: 10, h: 10, z: 2 },
      ] as never,
    });

    stage.setErasing(new Set(['e1']), [0, 5, 15, 5]);
    expect(stage.nodeFor('e1')!.opacity()).toBe(0.2);
    expect(stage.nodeFor('e2')!.opacity()).toBe(1);
    expect(stage.eraserTrail()!.points()).toEqual([0, 5, 15, 5]);

    stage.setErasing(new Set(), []);
    expect(stage.nodeFor('e1')!.opacity()).toBe(1);
    expect(stage.eraserTrail()).toBeNull();
    stage.destroy();
  });

  // Seen at a running window: zoom changed the readout and nothing else.
  it('follows the viewport: scale and position, and keeps handles screen-sized', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 100 }));
    stage.setSelection(['e1']);
    const handleBefore = stage.selectionOutline()!.strokeWidth();

    stage.setViewport({ zoom: 2, pan: { x: 30, y: -10 } });

    expect(stage.scale()).toBe(2);
    expect(stage.position()).toEqual({ x: 30, y: -10 });
    expect(stage.selectionOutline()!.strokeWidth()).toBe(handleBefore / 2);
    stage.destroy();
  });

  it('resizes to its host', () => {
    const stage = mounted();
    stage.resize(1024, 700);
    expect(stage.size()).toEqual({ width: 1024, height: 700 });
    stage.destroy();
  });

  it('draws every line of a multi-line text whose box holds them', () => {
    const stage = new CanvasStage({ read: reader({ '--text-body': '10px', '--leading-tight': '1.2' }) });
    stage.mount(host());
    stage.render(one({ type: 'text', x: 0, y: 0, w: 40, h: 24, text: 'a\nb', measuredWidth: 40, measuredHeight: 24 }));
    const body = stage.bodyFor('e1') as Konva.Text & { textArr: unknown[] };
    expect(body.lineHeight()).toBe(1.2);
    expect(body.fontSize()).toBe(10);
    expect(body.textArr).toHaveLength(2);
    stage.destroy();
  });

  // The format lets a frame carry a label; it is drawn at the top-left.
  it('draws a frame\'s label at its top-left corner', () => {
    const stage = new CanvasStage({ read: reader({ '--size-label-inset': '6px' }) });
    stage.mount(host());
    stage.render(one({ type: 'frame', x: 0, y: 0, w: 200, h: 100, label: 'Checkout' }));
    const label = stage.labelFor('e1')!;
    expect(label.text()).toBe('Checkout');
    expect(label.align()).toBe('left');
    expect(label.verticalAlign()).toBe('top');
    expect(label.x()).toBe(6);
    expect(label.y()).toBe(6);
    stage.destroy();
  });
});
