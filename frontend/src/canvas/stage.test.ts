// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import Konva from 'konva';
import { CanvasStage } from './stage';
import { onTeardown } from '../test/render';
import { createScene, type SceneData, type SceneElement } from './scene';
import { pathOf, routePoints } from './arrows';

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
});

function one(element: Omit<SceneElement, 'id' | 'z'> & Record<string, unknown>): SceneData {
  return { elements: [{ id: 'e1', z: 1, ...element } as SceneElement] };
}

/** A stage the shared teardown destroys when the test ends. */
function newStage(options?: ConstructorParameters<typeof CanvasStage>[0]): CanvasStage {
  const stage = new CanvasStage(options);
  onTeardown(() => stage.destroy());
  return stage;
}

function mounted(read = themeA) {
  const stage = newStage({ read });
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
    const stage = newStage();
    stage.mount(host());
    stage.render(sceneWith(3).data());
    expect(stage.nodeCount).toBe(3);
  });

  // The reason this class exists rather than per-element Svelte components:
  // a render that rebuilds every node reconciles the whole scene on every
  // keystroke and stutters at a few hundred elements.
  it('patches in place rather than rebuilding', () => {
    const stage = newStage();
    stage.mount(host());
    const scene = sceneWith(3);
    stage.render(scene.data());

    const [first] = scene.ordered();
    const nodeBefore = stage.nodeFor(first.id);
    scene.update(first.id, { x: 500 });
    stage.render(scene.data());

    expect(stage.nodeFor(first.id)).toBe(nodeBefore);
    expect(stage.nodeFor(first.id)?.x()).toBe(500);
  });

  it('removes nodes for elements that are gone', () => {
    const stage = newStage();
    stage.mount(host());
    const scene = sceneWith(3);
    stage.render(scene.data());

    const [first] = scene.ordered();
    scene.remove(first.id);
    stage.render(scene.data());

    expect(stage.nodeCount).toBe(2);
    expect(stage.nodeFor(first.id)).toBeUndefined();
  });

  it('renders in z-order', () => {
    const stage = newStage();
    stage.mount(host());
    const scene = sceneWith(3);
    const ids = scene.ordered().map((e) => e.id);
    scene.bringToFront(ids[0]);
    stage.render(scene.data());
    expect(stage.orderedIds()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('releases the stage on destroy', () => {
    const el = host();
    const stage = newStage();
    stage.mount(el);
    stage.render(sceneWith(2).data());
    stage.destroy();
    expect(stage.nodeCount).toBe(0);
    expect(el.querySelector('canvas')).toBeNull();
  });

  it('survives a render before mount', () => {
    const stage = newStage();
    expect(() => stage.render(sceneWith(1).data())).not.toThrow();
    const el = host();
    stage.mount(el);
    // The scene that arrived early is painted once there is somewhere to paint.
    expect(stage.nodeCount).toBe(1);
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
  });

  it('uses the element\'s swatches when it names them', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'blue', stroke: 'blue' }));
    expect(stage.bodyFor('e1')!.fill()).toBe('lightblue');
    expect(stage.bodyFor('e1')!.stroke()).toBe('steelblue');
  });

  it('draws an ellipse inside its box, not centred on its corner', () => {
    const stage = mounted();
    stage.render(one({ type: 'ellipse', x: 10, y: 20, w: 100, h: 50 }));
    const body = stage.bodyFor('e1') as Konva.Ellipse;
    expect(stage.nodeFor('e1')!.x()).toBe(10);
    expect(body.x()).toBe(50);
    expect(body.y()).toBe(25);
    expect(body.radiusX()).toBe(50);
  });

  it('draws the new shapes with an outline function sized to the box', () => {
    const stage = mounted();
    stage.render(one({ type: 'cylinder', x: 0, y: 0, w: 80, h: 120 }));
    const body = stage.bodyFor('e1')!;
    expect(body.getClassName()).toBe('Shape');
    expect(body.width()).toBe(80);
    expect(body.height()).toBe(120);
    expect(body.stroke()).toBe('slategray');
  });

  it('draws an arrow with an arrowhead and its points', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 10, points: [0, 0, 50, 10] }));
    const body = stage.bodyFor('e1')!;
    expect(body).toBeInstanceOf(Konva.Arrow);
    expect((body as Konva.Arrow).points()).toEqual([0, 0, 50, 10]);
    expect(body.stroke()).toBe('slategray');
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
  });

  it('draws a text element\'s text in the text colour', () => {
    const stage = mounted();
    stage.render(one({ type: 'text', x: 0, y: 0, w: 60, h: 20, text: 'Hello', measuredWidth: 60, measuredHeight: 20 }));
    const body = stage.bodyFor('e1') as Konva.Text;
    expect(body.text()).toBe('Hello');
    expect(body.fill()).toBe('black');
  });

  // A theme switch recolours what is on screen without recreating it.
  it('restyle re-reads colours on the same nodes', () => {
    let values: Record<string, string> = { '--color-shape-stroke': 'slategray', '--color-shape-fill': 'ivory' };
    const stage = newStage({ read: (name) => values[name] ?? '' });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 10, h: 10 }));
    const before = stage.bodyFor('e1');

    values = { '--color-shape-stroke': 'white', '--color-shape-fill': 'black' };
    stage.restyle();

    expect(stage.bodyFor('e1')).toBe(before);
    expect(before!.stroke()).toBe('white');
    expect(before!.fill()).toBe('black');
  });

  it('outlines the selection with eight handles, and clears it', () => {
    const stage = newStage({ read: reader({ '--color-selection-handle': 'dodgerblue' }) });
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
  });

  // Dragging over empty space showed nothing: the marquee was tracked but
  // never drawn.
  it('draws a dashed marquee on the overlay, and clears it', () => {
    const stage = newStage({ read: reader({ '--color-selection-handle': 'dodgerblue' }) });
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
  });

  // Find on the Canvas outlines every element whose text matches.
  describe('find matches', () => {
    const findTheme = reader({ '--color-selection-handle': 'black', '--size-find-outline': '1px', '--size-find-gap': '4px' });
    const scene = { elements: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 40, z: 1 }, { id: 'b', type: 'rect', x: 100, y: 0, w: 20, h: 20, z: 2 }] as SceneElement[] };

    it('outlines each match a screen gap outside its box, in the ink, at screen width', () => {
      const stage = newStage({ read: findTheme });
      stage.mount(host());
      stage.render(scene);
      stage.setViewport({ zoom: 2, pan: { x: 0, y: 0 } });
      stage.setFindMatches(['a', 'b']);
      const outlines = stage.findOutlines();
      expect(outlines).toHaveLength(2);
      expect(outlines[0].stroke()).toBe('black');
      expect(outlines[0].strokeWidth()).toBe(0.5);
      expect([outlines[0].x(), outlines[0].y(), outlines[0].width(), outlines[0].height()]).toEqual([-2, -2, 64, 44]);
    });

    it('redraws at a new zoom, and clears with none', () => {
      const stage = newStage({ read: findTheme });
      stage.mount(host());
      stage.render(scene);
      stage.setFindMatches(['a']);
      stage.setViewport({ zoom: 4, pan: { x: 0, y: 0 } });
      expect(stage.findOutlines()[0].strokeWidth()).toBe(0.25);
      stage.setFindMatches([]);
      expect(stage.findOutlines()).toHaveLength(0);
    });

    it('follows a match as it moves', () => {
      const stage = newStage({ read: findTheme });
      stage.mount(host());
      stage.render(scene);
      stage.setFindMatches(['b']);
      stage.render({ elements: [scene.elements[0], { ...scene.elements[1], x: 200 }] });
      expect(stage.findOutlines()[0].x()).toBe(196);
    });
  });

  // Where a moving selection is, below it, screen-sized.
  describe('the position while moving', () => {
    const readoutTheme = reader({ '--size-readout-gap': '8px', '--text-mono-status': '11px', '--font-data': 'Mono', '--color-text-muted': 'grey' });

    it('reads the top-left, sits a screen gap below, and is drawn at screen size', () => {
      const stage = newStage({ read: readoutTheme });
      stage.mount(host());
      stage.setViewport({ zoom: 2, pan: { x: 0, y: 0 } });
      stage.setReadout({ x: 519.6, y: 320, w: 100, h: 40 });
      const text = stage.readout()!;
      expect(text.text()).toBe('x 520 · y 320');
      expect([text.x(), text.y()]).toEqual([519.6, 364]);
      expect(text.scaleX()).toBe(0.5);
    });

    // A turned shape's drawn box reaches below its own: the text goes under
    // what is drawn, still reading the shape's own corner.
    it('sits below the drawn box when one is given', () => {
      const stage = newStage({ read: readoutTheme });
      stage.mount(host());
      stage.setReadout({ x: 100, y: 100, w: 50, h: 50 }, { x: 90, y: 90, w: 70, h: 70 });
      const text = stage.readout()!;
      expect(text.text()).toBe('x 100 · y 100');
      expect([text.x(), text.y()]).toEqual([90, 168]);
    });

    it('is gone once cleared', () => {
      const stage = newStage({ read: readoutTheme });
      stage.mount(host());
      stage.setReadout({ x: 0, y: 0, w: 10, h: 10 });
      stage.setReadout(null);
      expect(stage.readout()).toBeNull();
    });
  });

  // The guides snapping draws, Excalidraw's, screen-sized.
  describe('snap guides', () => {
    const guideTheme = reader({
      '--color-snap-guide': 'tomato',
      '--size-snap-guide': '1px',
      '--size-snap-cross': '4px',
      '--size-snap-gap-tick': '16px',
      '--size-snap-gap-mark': '8px',
    });

    it('draws a line through aligned points with a cross at each, in the guide colour, over the zoom', () => {
      const stage = newStage({ read: guideTheme });
      stage.mount(host());
      stage.setViewport({ zoom: 2, pan: { x: 0, y: 0 } });
      stage.setSnapGuides([{ kind: 'points', points: [{ x: 10, y: 0 }, { x: 10, y: 100 }] }]);
      const lines = stage.snapGuideLines();
      expect(lines.map((line) => line.points())).toEqual([
        [10, 0, 10, 100],
        // Each cross: two diagonals reaching 2 screen px (1 scene unit at zoom 2) each way.
        [9, -1, 11, 1],
        [9, 1, 11, -1],
        [9, 99, 11, 101],
        [9, 101, 11, 99],
      ]);
      expect(lines.every((line) => line.stroke() === 'tomato' && line.strokeWidth() === 0.5)).toBe(true);
    });

    it('draws a spacing guide with end ticks and two middle marks', () => {
      const stage = newStage({ read: guideTheme });
      stage.mount(host());
      stage.setSnapGuides([{ kind: 'gap', axis: 'x', from: { x: 40, y: 20 }, to: { x: 80, y: 20 } }]);
      expect(stage.snapGuideLines().map((line) => line.points())).toEqual([
        [40, 20, 80, 20],
        [40, 12, 40, 28],
        [80, 12, 80, 28],
        [58, 16, 58, 24],
        [62, 16, 62, 24],
      ]);
    });

    it('draws a pointer guide as a cross and a line to the pointer', () => {
      const stage = newStage({ read: guideTheme });
      stage.mount(host());
      stage.setSnapGuides([{ kind: 'pointer', from: { x: 50, y: 50 }, to: { x: 50, y: 200 } }]);
      expect(stage.snapGuideLines().map((line) => line.points())).toEqual([
        [50, 50, 50, 200],
        [48, 48, 52, 52],
        [48, 52, 52, 48],
      ]);
    });

    it('redraws them at the new size when the zoom changes', () => {
      const stage = newStage({ read: guideTheme });
      stage.mount(host());
      stage.setSnapGuides([{ kind: 'points', points: [{ x: 0, y: 0 }, { x: 0, y: 10 }] }]);
      stage.setViewport({ zoom: 4, pan: { x: 0, y: 0 } });
      expect(stage.snapGuideLines()[0].strokeWidth()).toBe(0.25);
    });

    it('clears them, and re-reads the colour on a theme change', () => {
      let colour = 'tomato';
      const stage = newStage({ read: (name) => (name === '--color-snap-guide' ? colour : guideTheme(name)) });
      stage.mount(host());
      stage.setSnapGuides([{ kind: 'points', points: [{ x: 0, y: 0 }, { x: 0, y: 10 }] }]);
      colour = 'salmon';
      stage.restyle();
      expect(stage.snapGuideLines()[0].stroke()).toBe('salmon');
      stage.setSnapGuides([]);
      expect(stage.snapGuideLines()).toEqual([]);
    });
  });

  it('fades elements the eraser has marked, draws its trail, and clears both', () => {
    const stage = newStage({
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
  });

  it('resizes to its host', () => {
    const stage = mounted();
    stage.resize(1024, 700);
    expect(stage.size()).toEqual({ width: 1024, height: 700 });
  });

  // A faded shape draws through an off-screen copy the stage's size, and
  // WebKit refuses to draw a copy with no size: the page would fail to open.
  it('keeps its last size while its pane is hidden', () => {
    const stage = mounted();
    stage.resize(1024, 700);
    stage.resize(0, 0);
    expect(stage.size()).toEqual({ width: 1024, height: 700 });
    stage.resize(1024, 0);
    expect(stage.size()).toEqual({ width: 1024, height: 700 });
  });

  it('is never sized to nothing, mounted in a hidden pane', () => {
    const el = host();
    Object.defineProperty(el, 'clientWidth', { value: 0 });
    Object.defineProperty(el, 'clientHeight', { value: 0 });
    const stage = newStage({ read: themeA });
    stage.mount(el);
    expect(stage.size()).toEqual({ width: 1, height: 1 });
  });

  it('draws every line of a multi-line text whose box holds them', () => {
    const stage = newStage({ read: reader({ '--leading-tight': '1.2' }) });
    stage.mount(host());
    stage.render(one({ type: 'text', x: 0, y: 0, w: 40, h: 24, text: 'a\nb', fontSize: 10, measuredWidth: 40, measuredHeight: 24 }));
    const body = stage.bodyFor('e1') as Konva.Text & { textArr: unknown[] };
    expect(body.lineHeight()).toBe(1.2);
    expect(body.fontSize()).toBe(10);
    expect(body.textArr).toHaveLength(2);
  });

  // The format lets a frame carry a label; it is drawn at the top-left.
  it('draws a frame\'s label at its top-left corner', () => {
    const stage = newStage({ read: reader({ '--size-label-inset': '6px' }) });
    stage.mount(host());
    stage.render(one({ type: 'frame', x: 0, y: 0, w: 200, h: 100, label: 'Checkout' }));
    const label = stage.labelFor('e1')!;
    expect(label.text()).toBe('Checkout');
    expect(label.align()).toBe('left');
    expect(label.verticalAlign()).toBe('top');
    expect(label.x()).toBe(6);
    expect(label.y()).toBe(6);
  });

  // Konva cuts a line wider than a fixed width, even with wrapping off; the
  // rule (and the exporter) draws a word too wide for its box whole.
  it('draws a label word wider than its shape whole', () => {
    const stage = newStage({ read: reader({ '--size-label-inset': '2px' }) });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 8, h: 40, label: 'orange' }));
    const label = stage.labelFor('e1') as Konva.Text & { textArr: { text: string }[] };
    expect(label.textArr.map((line) => line.text)).toEqual(['orange']);
  });

  it('draws a free text word wider than its box whole', () => {
    const stage = newStage({ read: themeA });
    stage.mount(host());
    stage.render(one({ type: 'text', x: 0, y: 0, w: 10, h: 24, text: 'overflowing', measuredWidth: 10, measuredHeight: 24 }));
    const body = stage.bodyFor('e1') as Konva.Text & { textArr: { text: string }[] };
    expect(body.textArr.map((line) => line.text)).toEqual(['overflowing']);
  });
});

// Style properties, drawn. Konva nodes are inspected, never only the scene:
// a scene can hold every style while every shape is drawn unstyled.
describe('style properties on the stage', () => {
  const theme = reader({
    '--color-shape-fill': 'ivory',
    '--color-shape-stroke': 'slategray',
    '--color-shape-text': 'black',
    '--radius-shape-round': '32px',
    '--text-body': '13px',
    '--leading-tight': '1.2',
    '--font-ui': 'Geist',
    '--size-label-inset': '6px',
  });

  it('draws a shape at its stroke width, style, corner radius and opacity', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 60, strokeWidth: 4, strokeStyle: 'dashed', edges: 'round', opacity: 40 }));
    const body = stage.bodyFor('e1') as Konva.Rect;
    // Dashed: half a unit thicker.
    expect(body.strokeWidth()).toBe(4.5);
    expect(body.dash().length).toBeGreaterThan(0);
    expect(body.cornerRadius()).toBeGreaterThan(0);
    expect(stage.nodeFor('e1')!.opacity()).toBeCloseTo(0.4, 5);
  });

  it('leaves the defaults alone when the keys are absent', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 10, h: 10 }));
    const body = stage.bodyFor('e1') as Konva.Rect;
    // The file format's default, not a theme value.
    expect(body.strokeWidth()).toBe(2);
    expect(body.dash()).toEqual([]);
    expect(body.cornerRadius()).toBe(0);
    expect(stage.nodeFor('e1')!.opacity()).toBe(1);
  });

  it('draws a dotted line differently from a dashed one', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'line', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], strokeStyle: 'dotted' }));
    const dotted = (stage.bodyFor('e1') as Konva.Line).dash();
    stage.render(one({ type: 'line', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], strokeStyle: 'dashed' }));
    const dashed = (stage.bodyFor('e1') as Konva.Line).dash();
    expect(dotted.length).toBeGreaterThan(0);
    expect(dashed).not.toEqual(dotted);
  });

  it('draws text at its size and alignment', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'text', x: 0, y: 0, w: 80, h: 20, text: 'hi', measuredWidth: 80, measuredHeight: 20, fontSize: 28, align: 'right' }));
    const body = stage.bodyFor('e1') as Konva.Text;
    expect(body.fontSize()).toBe(28);
    expect(body.align()).toBe('right');
  });

  it('draws a label at its size and both alignments', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 60, label: 'L', fontSize: 16, align: 'left', verticalAlign: 'top' }));
    const label = stage.labelFor('e1')!;
    expect(label.fontSize()).toBe(16);
    expect(label.align()).toBe('left');
    expect(label.verticalAlign()).toBe('top');
  });

  it('rounds a polygon shape proportionally, as Excalidraw does', () => {
    const stage = mounted(theme);
    const drawn = (element: Record<string, unknown>) => {
      stage.render(one({ type: 'diamond', x: 0, y: 0, w: 100, h: 60, ...element }));
      const calls: string[] = [];
      const context = {
        beginPath: () => {},
        fillStrokeShape: () => {},
        moveTo: () => calls.push('moveTo'),
        lineTo: () => calls.push('lineTo'),
        bezierCurveTo: () => calls.push('curve'),
        closePath: () => calls.push('close'),
      };
      (stage.bodyFor('e1') as Konva.Shape).sceneFunc()!.call(
        stage.bodyFor('e1') as Konva.Shape,
        context as never,
        stage.bodyFor('e1') as never,
      );
      return calls;
    };
    expect(drawn({}).includes('curve')).toBe(false);
    expect(drawn({ edges: 'round' }).includes('curve')).toBe(true);
  });

  // Orthogonal segments with rounded corners, the path the hit test and the
  // exporter use too.
  it('draws an elbow arrow along its route, corners rounded', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 100, h: 60, points: [0, 0, 100, 60], arrowType: 'elbow' }));
    const points = (stage.bodyFor('e1') as Konva.Arrow).points();
    expect(points).toEqual(pathOf([0, 0, 100, 60], 'elbow'));
    expect(points).not.toEqual(routePoints([0, 0, 100, 60], 'elbow'));
  });

  it('draws the head shape each end names, and none where there is none', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], startArrowhead: 'circle', endArrowhead: 'diamond' }));
    expect(stage.arrowHeads('e1').map((head) => head.name())).toEqual(['circle', 'diamond']);

    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], endArrowhead: 'none' }));
    expect(stage.arrowHeads('e1')).toHaveLength(0);
  });

  it('draws a head only where the arrow names one', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], startArrowhead: 'circle', endArrowhead: 'none' }));
    expect(stage.arrowHeads('e1').map((head) => head.name())).toEqual(['circle']);
    // Konva's own pointer is off: it draws triangles and nothing else.
    const body = stage.bodyFor('e1') as Konva.Arrow;
    expect(body.pointerAtBeginning()).toBe(false);
    expect(body.pointerAtEnding()).toBe(false);
  });
});

// An element stores its upright box and an angle; Konva turns the group about
// the box's centre, so the stored geometry stays readable in the file.
describe('drawing a rotated element', () => {
  it('turns the group about the element centre', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50, angle: 45 }));
    const node = stage.nodeFor('e1')!;
    expect(node.rotation()).toBe(45);
    // Offset to the centre, positioned at it: the box does not move.
    expect(node.offsetX()).toBe(50);
    expect(node.offsetY()).toBe(25);
    expect(node.x()).toBe(60);
    expect(node.y()).toBe(45);
  });

  it('leaves an upright element at its corner', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    const node = stage.nodeFor('e1')!;
    expect(node.rotation()).toBe(0);
    expect(node.x()).toBe(10);
    expect(node.y()).toBe(20);
  });

  it('takes the rotation off again when the element is turned back', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50, angle: 45 }));
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    const node = stage.nodeFor('e1')!;
    expect(node.rotation()).toBe(0);
    expect(node.x()).toBe(10);
  });
});

describe('the selection of a rotated element', () => {
  const selectionRead = reader({
    '--color-selection-handle': 'dodgerblue',
    '--size-selection-handle': '8px',
    '--size-rotate-gap': '16px',
  });

  it('turns the outline with the element', () => {
    const stage = newStage({ read: selectionRead });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50, angle: 30 }));
    stage.setSelection(['e1']);
    const outline = stage.selectionOutline()!;
    expect(outline.rotation()).toBe(30);
    expect(outline.width()).toBe(100);
  });

  it('gives the selection a rotate handle above it, and none with nothing selected', () => {
    const stage = newStage({ read: selectionRead });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    stage.setSelection(['e1']);
    const rotate = stage.rotateHandle()!;
    expect(rotate.x()).toBe(60);
    // 16 above the box's top edge at y 20, so a gap of zero fails here.
    expect(rotate.y()).toBe(4);
    stage.setSelection([]);
    expect(stage.rotateHandle()).toBeNull();
  });

  // Several elements have no shared angle, so their outline stays upright and
  // holds everything as drawn.
  it('keeps a multi-selection outline upright, around the turned boxes', () => {
    const stage = newStage({ read: selectionRead });
    stage.mount(host());
    stage.render({
      elements: [
        { id: 'a', z: 1, type: 'rect', x: 0, y: 0, w: 100, h: 20, angle: 90 },
        { id: 'b', z: 2, type: 'rect', x: 200, y: 0, w: 20, h: 20 },
      ] as SceneElement[],
    });
    stage.setSelection(['a', 'b']);
    const outline = stage.selectionOutline()!;
    expect(outline.rotation()).toBe(0);
    // The turned bar runs from y -40 to 60; the pair spans x 40 to 220.
    expect(outline.y()).toBe(-40);
    expect(outline.height()).toBe(100);
  });
});

// A handle that cannot do anything is a bug report waiting to happen: an
// elbow arrow is the one element rotation passes over.
describe('the rotate handle and what cannot rotate', () => {
  it('is not drawn for a selection of elbow arrows only', () => {
    const stage = newStage({
      read: reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-rotate-gap': '16px' }),
    });
    stage.mount(host());
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 40, h: 20, points: [0, 0, 40, 20], arrowType: 'elbow' }));
    stage.setSelection(['e1']);
    expect(stage.rotateHandle()).toBeNull();
    // No box handles either: an elbow shows only its ends.
    expect(stage.selectionHandleCount()).toBe(0);
  });
});

// A binding whose target is gone freezes the endpoint and says so, rather
// than the arrow moving or vanishing.
describe('an arrow whose target has gone', () => {
  const read = reader({
    '--color-shape-stroke': 'slategray',
    '--color-selection-handle': 'dodgerblue',
    '--color-danger': 'crimson',
    '--size-selection-handle': '8px',
  });

  const bound = (targetPresent: boolean): SceneData => ({
    elements: [
      ...(targetPresent ? [{ id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 1 } as SceneElement] : []),
      {
        id: 'arrow',
        type: 'arrow',
        x: 0,
        y: 30,
        w: 200,
        h: 0,
        z: 2,
        points: [0, 0, 200, 0],
        endBinding: 'b',
      } as SceneElement,
    ],
  });

  it('marks the loose end, and does not while the target is there', () => {
    const stage = newStage({ read });
    stage.mount(host());

    stage.render(bound(true));
    expect(stage.detachedMarkers()).toHaveLength(0);

    stage.render(bound(false));
    const markers = stage.detachedMarkers();
    expect(markers).toHaveLength(1);
    // At the frozen end, where the arrow was last drawn. The marker lives in
    // the arrow's group, so its place on the canvas is the absolute one.
    expect(markers[0].getAbsolutePosition()).toEqual({ x: 200, y: 30 });
  });

  // The end's handle sits on the marker while the arrow is selected, so the
  // handle itself carries the mark.
  it('marks the loose end\'s handle while the arrow is selected', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(bound(false));
    stage.setSelection(['arrow']);
    const [start, end] = stage.endpointHandles();
    expect(start.stroke()).toBe('dodgerblue');
    expect(end.stroke()).toBe('crimson');

    stage.render(bound(true));
    stage.setSelection(['arrow']);
    expect(stage.endpointHandles()[1].stroke()).toBe('dodgerblue');
  });

  it('takes the mark away when the target comes back', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(bound(false));
    stage.render(bound(true));
    expect(stage.detachedMarkers()).toHaveLength(0);
  });
});

// An arrow may carry a label, drawn where the path passes its middle.
describe('an arrow with a label', () => {
  it('draws it at the middle of the routed path', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 10, y: 20, w: 100, h: 0, points: [0, 0, 100, 0], label: 'sends to' }));
    const label = stage.labelFor('e1')!;
    expect(label.text()).toBe('sends to');
    // Centred on the midpoint, which is (60, 20) on the canvas. The label is
    // placed by its centre, so it can turn about it.
    expect(label.getAbsolutePosition()).toEqual({ x: 60, y: 20 });
    expect(label.getClientRect().x + label.getClientRect().width / 2).toBeCloseTo(60, 5);
  });

  it('takes the label away when it is cleared', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 10, h: 0, points: [0, 0, 10, 0], label: 'x' }));
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 10, h: 0, points: [0, 0, 10, 0] }));
    expect(stage.labelFor('e1')).toBeUndefined();
  });
});

// While an arrow is being drawn onto a shape, that shape is highlighted, so
// the user can see the attachment before letting go.
describe('the attachment highlight', () => {
  // The shape's own outline in the highlight colour, as wide as
  // its stroke within 1.75 and 4 screen px (Excalidraw's
  // `interactiveScene.ts:292-557`).
  it('outlines the candidates it is given, and clears them', () => {
    const stage = newStage({ read: reader({ '--color-binding-highlight': 'orchid' }) });
    stage.mount(host());
    stage.render({
      elements: [
        { id: 'a', type: 'ellipse', x: 0, y: 0, w: 60, h: 40, z: 1, strokeWidth: 1 },
        { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 2, strokeWidth: 4 },
      ] as SceneElement[],
    });

    stage.setBindingCandidates(['a', 'b']);
    const outlines = stage.bindingHighlights();
    expect(outlines).toHaveLength(2);
    expect(outlines.map((o) => o.stroke())).toEqual(['orchid', 'orchid']);
    expect(outlines.map((o) => o.strokeWidth())).toEqual([1.75, 4]);
    expect(outlines.map((o) => o.getAttr('bavaOutline'))).toEqual(['ellipse', 'rect']);
    expect(outlines[0].getClientRect({ skipStroke: true })).toMatchObject({ x: 0, y: 0, width: 60, height: 40 });

    stage.setBindingCandidates([]);
    expect(stage.bindingHighlights()).toHaveLength(0);
  });
  // While an elbow end is dragged, the spots it can snap to show
  // as dots (Excalidraw's 4 px radius midpoints).
  it('draws the snap spots it is given as dots, and clears them', () => {
    const stage = newStage({ read: reader({ '--color-selection-handle': 'dodgerblue', '--size-snap-dot': '8px' }) });
    stage.mount(host());
    stage.render({ elements: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 }] as SceneElement[] });
    stage.setBindingCandidates(['a'], [{ x: 30, y: 0 }, { x: 60, y: 30 }]);
    const dots = stage.snapDots();
    expect(dots.map((dot) => dot.getAbsolutePosition())).toEqual([{ x: 30, y: 0 }, { x: 60, y: 30 }]);
    expect(dots[0].radius()).toBe(4);
    stage.setBindingCandidates([]);
    expect(stage.snapDots()).toHaveLength(0);
  });
});

// A selected arrow shows a handle at each end, where the hit zone is: for an
// elbow or an arc the box corners are nowhere near the ends.
describe('the ends of a selected arrow', () => {
  it('draws a handle at each end, and clears them with the selection', () => {
    const stage = newStage({
      read: reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-rotate-gap': '16px' }),
    });
    stage.mount(host());
    stage.render(one({ type: 'arrow', x: 10, y: 20, w: 100, h: 0, points: [0, 0, 100, 0] }));

    stage.setSelection(['e1']);
    const ends = stage.endpointHandles();
    expect(ends).toHaveLength(2);
    expect(ends.map((e) => e.getAbsolutePosition().x).sort((a, b) => a - b)).toEqual([10, 110]);

    stage.setSelection([]);
    expect(stage.endpointHandles()).toHaveLength(0);
  });
});

// A code block draws a panel and its code as coloured text, in the theme's
// syntax colours. Runs come from `canvas/code/highlight.ts`, which the
// exporter reads too.
describe('drawing a code block', () => {
  const read = reader({
    '--color-code-surface': 'whitesmoke',
    '--color-border-subtle': 'gainsboro',
    '--syntax-keyword': 'purple',
    '--syntax-string': 'green',
    '--syntax-comment': 'gray',
    '--syntax-plain': 'black',
    '--font-mono': 'Geist Mono',
    '--text-code': '13px',
    '--leading-code': '1.5',
    '--size-code-padding': '8px',
    '--radius-md': '6px',
  });

  const block = (over: Record<string, unknown> = {}): SceneData =>
    one({ type: 'code', x: 10, y: 20, w: 200, h: 60, code: 'const a = "x" // note', measuredWidth: 200, measuredHeight: 60, ...over });

  it('draws a panel behind the code', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(block());
    expect(stage.bodyFor('e1')!.fill()).toBe('whitesmoke');
  });

  // A block's width is the user's; a line longer than it continues below.
  it('wraps a line longer than the block onto more rows', () => {
    const stage = newStage({ read });
    stage.mount(host());
    // jsdom measures a character as one unit: 24 wide, padded 8, holds 8.
    stage.render(block({ w: 24 }));
    stage.setCodeRuns('e1', [[{ text: 'a very long line of code that cannot fit', kind: 'plain' }]]);
    const rows = new Set(stage.codeRuns('e1').map((node) => node.y()));
    expect(rows.size).toBeGreaterThan(1);
  });

  it('draws one text node per run, in the run colour', () => {
    const stage = newStage({ read });
    stage.mount(host());
    // Runs arrive from the caller, already tokenised: the stage does not parse.
    stage.setCodeRuns('e1', [
      [
        { text: 'const', kind: 'keyword' },
        { text: ' a = ', kind: 'plain' },
        { text: '"x"', kind: 'string' },
        { text: ' // note', kind: 'comment' },
      ],
    ]);
    stage.render(block());

    const runs = stage.codeRuns('e1');
    expect(runs.map((node) => node.text())).toEqual(['const', ' a = ', '"x"', ' // note']);
    expect(runs.map((node) => node.fill())).toEqual(['purple', 'black', 'green', 'gray']);
  });

  it('places the runs of a line side by side, on one baseline', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.setCodeRuns('e1', [
      [
        { text: 'ab', kind: 'plain' },
        { text: 'cd', kind: 'keyword' },
      ],
      [{ text: 'e', kind: 'plain' }],
    ]);
    stage.render(block());

    const [first, second, third] = stage.codeRuns('e1');
    expect(first.y()).toBe(second.y());
    expect(second.x()).toBeGreaterThan(first.x());
    expect(third.y()).toBeGreaterThan(first.y());
  });

  it('draws nothing but the panel until its runs arrive', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(block());
    expect(stage.codeRuns('e1')).toHaveLength(0);
  });

  it('takes the old runs away when new ones arrive', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.setCodeRuns('e1', [[{ text: 'old', kind: 'plain' }]]);
    stage.render(block());
    stage.setCodeRuns('e1', [[{ text: 'new', kind: 'plain' }]]);
    expect(stage.codeRuns('e1').map((node) => node.text())).toEqual(['new']);
  });
});

// `#apply` runs for every element on every render, including each preview
// frame of a drag: rebuilding a few hundred text nodes per frame is the trap
// this class exists to avoid.
describe('redrawing a code block', () => {
  it('keeps the same nodes when nothing about the runs changed', () => {
    const stage = newStage({
      read: reader({ '--syntax-plain': 'black', '--font-mono': 'Geist Mono', '--text-code': '13px', '--leading-code': '1.5' }),
    });
    stage.mount(host());
    const scene = one({ type: 'code', x: 0, y: 0, w: 100, h: 40, code: 'a', measuredWidth: 100, measuredHeight: 40 });
    stage.setCodeRuns('e1', [[{ text: 'a', kind: 'plain' }]]);
    stage.render(scene);

    const before = stage.codeRuns('e1')[0];
    stage.render(scene);
    stage.render(scene);
    expect(stage.codeRuns('e1')[0]).toBe(before);
  });

  it('rebuilds them when the runs do change', () => {
    const stage = newStage({
      read: reader({ '--syntax-plain': 'black', '--font-mono': 'Geist Mono', '--text-code': '13px', '--leading-code': '1.5' }),
    });
    stage.mount(host());
    const scene = one({ type: 'code', x: 0, y: 0, w: 100, h: 40, code: 'a', measuredWidth: 100, measuredHeight: 40 });
    stage.setCodeRuns('e1', [[{ text: 'a', kind: 'plain' }]]);
    stage.render(scene);
    stage.setCodeRuns('e1', [[{ text: 'b', kind: 'plain' }]]);
    expect(stage.codeRuns('e1')[0].text()).toBe('b');
  });
});

// While a label is typed into, the field draws the text; the stage must not
// draw it underneath as well.
describe('an element being edited', () => {
  it('hides its label while edited, and shows it again after', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50, label: 'A' }));
    stage.setEditing('e1');
    expect(stage.labelFor('e1')!.visible()).toBe(false);
    stage.setEditing(null);
    expect(stage.labelFor('e1')!.visible()).toBe(true);
  });

  it('keeps it hidden across a render while still edited', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50, label: 'A' }));
    stage.setEditing('e1');
    stage.render(one({ type: 'rect', x: 5, y: 0, w: 100, h: 50, label: 'A' }));
    expect(stage.labelFor('e1')!.visible()).toBe(false);
  });

  // The code editor covers the block; handles round it would be half under it.
  it('shows no outline or handles on a code block while its editor is open', () => {
    const stage = mounted();
    stage.render(one({ type: 'code', x: 0, y: 0, w: 200, h: 60, code: 'x', measuredWidth: 200, measuredHeight: 60 }));
    stage.setSelection(['e1']);
    stage.setEditing('e1');
    expect(stage.selectionOutline()).toBeNull();
    expect(stage.selectionHandleCount()).toBe(0);
    stage.setEditing(null);
    expect(stage.selectionOutline()).not.toBeNull();
    expect(stage.selectionHandleCount()).toBe(5);
  });

  it('keeps the outline and handles on a shape whose label is typed into', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50, label: 'A' }));
    stage.setSelection(['e1']);
    stage.setEditing('e1');
    expect(stage.selectionOutline()).not.toBeNull();
    expect(stage.selectionHandleCount()).toBe(8);
  });

  it('hides a text element body while edited', () => {
    const stage = mounted();
    stage.render(one({ type: 'text', x: 0, y: 0, w: 40, h: 24, text: 'hi', measuredWidth: 40, measuredHeight: 24 }));
    stage.setEditing('e1');
    expect(stage.bodyFor('e1')!.visible()).toBe(false);
    stage.setEditing(null);
    expect(stage.bodyFor('e1')!.visible()).toBe(true);
  });
});

// A drag renders once per frame. Work for elements that did not change is
// what made that cost grow with the scene rather than with the drag.
describe('rendering only what changed', () => {
  const rect = { id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, label: 'A' } as SceneElement;
  const other = { id: 's', type: 'rect', x: 200, y: 0, w: 100, h: 50, z: 2 } as SceneElement;

  function textSets(spy: { mock: { calls: unknown[][] } }) {
    return spy.mock.calls.filter((args) => args.length > 0).length;
  }

  it('does not listen on the scene layer: input is DOM events', () => {
    const stage = mounted();
    stage.render({ elements: [rect] });
    expect(stage.nodeFor('r')!.getLayer()!.listening()).toBe(false);
  });

  it('does not re-apply an element that is the same object as last time', () => {
    const stage = mounted();
    stage.render({ elements: [rect, other] });
    const spy = vi.spyOn(Konva.Text.prototype, 'text');
    stage.render({ elements: [rect, other] });
    expect(textSets(spy)).toBe(0);
  });

  it('re-applies an element that changed', () => {
    const stage = mounted();
    stage.render({ elements: [rect, other] });
    stage.render({ elements: [{ ...rect, label: 'B' } as SceneElement, other] });
    expect(stage.labelFor('r')!.text()).toBe('B');
  });

  it('re-applies an arrow whose target went, though the arrow is the same object', () => {
    const target = { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 1 } as SceneElement;
    const arrow = { id: 'a', type: 'arrow', x: 0, y: 30, w: 200, h: 0, z: 2, points: [0, 0, 200, 0], endBinding: 'b' } as SceneElement;
    const stage = mounted();
    stage.render({ elements: [target, arrow] });
    stage.render({ elements: [arrow] });
    expect(stage.detachedMarkers()).toHaveLength(1);
  });

  it('does not restack when the order is unchanged', () => {
    const stage = mounted();
    stage.render({ elements: [rect, other] });
    const spy = vi.spyOn(Konva.Node.prototype, 'zIndex');
    stage.render({ elements: [{ ...rect, x: 5 }, other] });
    expect(spy.mock.calls.filter((args) => args.length > 0)).toHaveLength(0);
  });

  it('restacks when the order changes', () => {
    const stage = mounted();
    stage.render({ elements: [rect, other] });
    stage.render({ elements: [other, rect] });
    expect(stage.nodeFor('r')!.zIndex()).toBeGreaterThan(stage.nodeFor('s')!.zIndex());
  });
});

// The eraser fades what it marks from outside `render`, so un-marking must put
// back the element's own opacity: a render of the unchanged element is skipped
// and would not.
describe('un-marking an element for erasing', () => {
  it('restores its own opacity, not full opacity', () => {
    const faded = { id: 'f', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1, opacity: 50 } as SceneElement;
    const stage = newStage({ read: reader({ '--opacity-erasing': '0.2' }) });
    stage.mount(host());
    stage.render({ elements: [faded] });
    stage.setErasing(new Set(['f']), []);
    expect(stage.nodeFor('f')!.opacity()).toBeCloseTo(0.2);
    stage.setErasing(new Set(), []);
    stage.render({ elements: [faded] });
    expect(stage.nodeFor('f')!.opacity()).toBeCloseTo(0.5);
  });
});

// Text wraps by measuring with the bundled font. Wrapped before the font has
// loaded, it wraps with a fallback; an unchanged element is not re-applied, so
// the stage is told when fonts arrive.
describe('fonts arriving', () => {
  it('re-applies every element on invalidate', () => {
    const rect = { id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, label: 'A' } as SceneElement;
    const stage = mounted();
    stage.render({ elements: [rect] });
    const spy = vi.spyOn(Konva.Text.prototype, 'text');
    stage.invalidate();
    expect(spy.mock.calls.filter((args) => args.length > 0).length).toBeGreaterThan(0);
  });
});

// A selected line or arrow shows a handle on every point and one at the middle
// of each segment long enough to bend.
describe('the bend handles of a selected arrow', () => {
  const read = reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-bend-min-segment': '40px' });

  // A bent one offers its middles only in point editing.
  it('draws a handle per point, and middles only while editing its points', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 200, h: 80, points: [0, 0, 100, 80, 200, 0] }));
    stage.setSelection(['e1']);
    expect(stage.endpointHandles()).toHaveLength(3);
    expect(stage.middleHandles()).toHaveLength(0);
    stage.setPointEditing({ id: 'e1', selected: [] });
    expect(stage.middleHandles()).toHaveLength(2);
  });

  it('draws no middle on a short segment, nor any bend on an elbow', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render({
      elements: [
        { id: 'short', type: 'arrow', x: 0, y: 0, w: 30, h: 0, z: 1, points: [0, 0, 30, 0] },
        { id: 'elbow', type: 'arrow', x: 0, y: 100, w: 200, h: 80, z: 2, arrowType: 'elbow', points: [0, 0, 100, 80, 200, 0] },
      ] as never,
    });
    stage.setSelection(['short']);
    expect(stage.middleHandles()).toHaveLength(0);
    stage.setSelection(['elbow']);
    expect(stage.endpointHandles()).toHaveLength(2);
    expect(stage.middleHandles()).toHaveLength(0);
  });

  // An elbow shows a handle at the middle of each segment, for dragging it:
  // hollow when free, filled when fixed, none on a segment under 5 screen px,
  // and not hidden by the label.
  it("draws an elbow's segment handles, filled when fixed", () => {
    const stage = newStage({ read: reader({ '--color-selection-handle': 'dodgerblue', '--color-surface': 'white', '--size-point-handle': '10px' }) });
    stage.mount(host());
    stage.render(
      one({
        type: 'arrow',
        arrowType: 'elbow',
        x: 0,
        y: 0,
        w: 200,
        h: 100,
        points: [0, 0, 100, 0, 100, 100, 103, 100, 200, 100],
        fixedSegments: [{ index: 2, start: [100, 0], end: [100, 100] }],
        label: 'over the middle',
      }),
    );
    stage.setSelection(['e1']);
    const handles = stage.segmentHandles();
    expect(handles.map((h) => h.getAbsolutePosition())).toEqual([
      { x: 50, y: 0 },
      { x: 100, y: 50 },
      { x: 151.5, y: 100 },
    ]);
    expect(handles.map((h) => h.fill())).toEqual(['white', 'dodgerblue', 'white']);
  });

  it('gives a selected line handles too', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'line', x: 0, y: 0, w: 100, h: 0, points: [0, 0, 100, 0] }));
    stage.setSelection(['e1']);
    expect(stage.endpointHandles()).toHaveLength(2);
    expect(stage.middleHandles()).toHaveLength(1);
  });
});

describe('the handles of a turned line', () => {
  it('sit where the line is drawn', () => {
    const read = reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-bend-min-segment': '40px' });
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'line', x: 0, y: 0, w: 100, h: 0, angle: 90, points: [0, 0, 100, 0] }));
    stage.setSelection(['e1']);
    const ends = stage.endpointHandles().map((h) => [Math.round(h.x()), Math.round(h.y())]);
    expect(ends).toEqual([
      [50, -50],
      [50, 50],
    ]);
    expect(stage.middleHandles().map((h) => [Math.round(h.x()), Math.round(h.y())])).toEqual([[50, 0]]);
  });
});

// A handle the label covers is drawn where the line comes out from under it,
// so the label stays readable; the pointer presses it there.
describe('the handles under a label', () => {
  const read = reader({
    '--color-selection-handle': 'dodgerblue',
    '--size-selection-handle': '8px',
    '--size-point-handle': '10px',
    '--size-bend-min-segment': '40px',
    '--text-body': '16px',
    '--leading-tight': '1.2',
  });
  const clear = (handle: Konva.Circle, box: { x: number; y: number; w: number; h: number }) =>
    handle.x() + handle.radius() <= box.x || handle.x() - handle.radius() >= box.x + box.w ||
    handle.y() + handle.radius() <= box.y || handle.y() - handle.radius() >= box.y + box.h;

  it('draws a straight arrow\'s middle beside its label, on the line', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0], label: 'sends' }));
    stage.setSelection(['e1']);
    const box = stage.labelBounds('e1')!;
    const [middle] = stage.middleHandles();
    expect(middle).toBeDefined();
    expect(clear(middle, box)).toBe(true);
    expect(middle.y()).toBeCloseTo(0);
    expect(middle.x()).toBeGreaterThan(box.x + box.w);
  });

  it('offers no middle on an arrow its label leaves no room beside, clear of its head', () => {
    const stage = newStage({ read });
    stage.mount(host());
    // jsdom measures a character as one unit: the label spans 21 to 69,
    // leaving 11 showing at each end, short of the head and the start's handle.
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 90, h: 0, points: [0, 0, 90, 0], label: 'a label over most of a short arrow, near its end' }));
    stage.setSelection(['e1']);
    expect(stage.labelBounds('e1')).not.toBeNull();
    expect(stage.endpointHandles()).toHaveLength(2);
    expect(stage.middleHandles()).toEqual([]);
  });

  it('draws an arc\'s middle point beside its label', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'arrow', arrowType: 'arc', x: 0, y: -40, w: 200, h: 40, points: [0, 40, 100, 0, 200, 40], label: 'sends' }));
    stage.setSelection(['e1']);
    const box = stage.labelBounds('e1')!;
    const points = stage.endpointHandles();
    expect(points).toHaveLength(3);
    expect(clear(points[1], box)).toBe(true);
  });
});

// As Excalidraw shows it (transformHandles.ts:328-354): a two-point line or
// arrow, or an elbow, has no box; a bent one has the box with four corners
// and the rotate handle.
describe('what a selected line or arrow shows', () => {
  const read = reader({
    '--color-selection-handle': 'dodgerblue',
    '--size-selection-handle': '8px',
    '--size-rotate-gap': '16px',
    '--size-bend-min-segment': '40px',
    '--size-point-handle': '10px',
    '--size-bent-box-padding': '10px',
    '--size-point-handle-editing': '20px',
    '--size-point-hover': '20px',
    '--size-focus-point': '9px',
    '--size-point-overlap': '2px',
    '--size-marquee-dash': '4px',
  });
  const selected = (element: Record<string, unknown>) => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one(element as never));
    stage.setSelection(['e1']);
    return stage;
  };

  it('shows a straight arrow its points only, no box or rotate handle', () => {
    const stage = selected({ type: 'arrow', x: 0, y: 0, w: 200, h: 50, points: [0, 0, 200, 50] });
    expect(stage.selectionOutline()).toBeNull();
    expect(stage.selectionHandleCount()).toBe(0);
    expect(stage.rotateHandle()).toBeNull();
    expect(stage.endpointHandles()).toHaveLength(2);
  });

  it('shows an elbow its ends only', () => {
    const stage = selected({ type: 'arrow', arrowType: 'elbow', x: 0, y: 0, w: 200, h: 50, points: [0, 0, 100, 0, 100, 50, 200, 50] });
    expect(stage.selectionOutline()).toBeNull();
    expect(stage.selectionHandleCount()).toBe(0);
    expect(stage.endpointHandles()).toHaveLength(2);
  });

  it('shows a bent line the box, four corners and the rotate handle', () => {
    const stage = selected({ type: 'line', x: 0, y: 0, w: 200, h: 80, points: [0, 0, 100, 80, 200, 0] });
    expect(stage.selectionOutline()).not.toBeNull();
    expect(stage.selectionHandleCount()).toBe(4);
    expect(stage.rotateHandle()).not.toBeNull();
  });

  // A bent line's box stands 10 px clear of its points
  // (Excalidraw's `transformHandles.ts:312-316`); other boxes are tight.
  it("pads a bent line's box by 10 px, its handles with it", () => {
    const stage = selected({ type: 'line', x: 0, y: 0, w: 200, h: 80, points: [0, 0, 100, 80, 200, 0] });
    const outline = stage.selectionOutline()!;
    expect([outline.x(), outline.y(), outline.width(), outline.height()]).toEqual([-10, -10, 220, 100]);
  });

  // A point on top of the one before it is drawn twice the size
  // and hollow (1.5 times in point editing), so both can be seen and grabbed
  // (Excalidraw's `interactiveScene.ts:268-289`, `:1120-1127`).
  it('draws a point on its neighbour larger and hollow', () => {
    const stage = selected({ type: 'line', x: 0, y: 0, w: 200, h: 80, points: [0, 0, 100, 80, 101, 80, 200, 0] });
    const radii = stage.endpointHandles().map((h) => h.radius());
    expect(radii).toEqual([5, 5, 10, 5]);
    expect(stage.endpointHandles()[2].fillEnabled()).toBe(false);
    stage.setPointEditing({ id: 'e1', selected: [] });
    expect(stage.endpointHandles().map((h) => h.radius())).toEqual([10, 10, 15, 10]);
  });

  // A translucent disc under the handle the pointer is over.
  it('draws a disc under the hovered handle, and clears it', () => {
    const stage = selected({ type: 'line', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0] });
    stage.setHoverHandle({ x: 200, y: 0 });
    const disc = stage.hoverHandle()!;
    expect(disc.getAbsolutePosition()).toEqual({ x: 200, y: 0 });
    expect(disc.radius()).toBe(10);
    expect(disc.opacity()).toBe(0.4);
    stage.setHoverHandle(null);
    expect(stage.hoverHandle()).toBeNull();
  });

  // Each attached end's anchor, a disc with a dashed line to the end.
  it("draws each attached end's anchor, clear of the end", () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 100, z: 1 },
        { id: 'r', type: 'arrow', x: 104, y: 50, w: 200, h: 0, z: 3, points: [0, 0, 200, 0], startBinding: 'a', startAnchor: [0.5, 0.5] },
      ] as never,
    });
    stage.setSelection(['r']);
    const discs = stage.focusHandles();
    expect(discs.map((d) => d.getAbsolutePosition())).toEqual([{ x: 50, y: 50 }]);
    expect(stage.focusLines()[0].dash().length).toBeGreaterThan(0);
  });

  it('draws point handles 5 px in radius on screen', () => {
    const stage = selected({ type: 'line', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0] });
    expect(stage.endpointHandles()[0].radius()).toBe(5);
  });
});

// A code block's height is its code's, so it has no top or
// bottom handles, and none that would move its top.
describe('the handles of a selected code block', () => {
  // Its bottom edge too: it can be made taller.
  it('are its sides, its bottom and its bottom corners', () => {
    const stage = newStage({ read: reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-rotate-gap': '16px' }) });
    stage.mount(host());
    stage.render(one({ type: 'code', x: 0, y: 0, w: 200, h: 60, code: 'x', measuredWidth: 200, measuredHeight: 60 } as never));
    stage.setSelection(['e1']);
    expect(stage.selectionHandleCount()).toBe(5);
  });
});

describe('a line in point editing', () => {
  it('draws its points larger, the selected ones filled, and no box', () => {
    const read = reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-point-handle': '10px', '--size-point-handle-editing': '20px', '--size-bend-min-segment': '40px' });
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'line', x: 0, y: 0, w: 200, h: 100, points: [0, 0, 100, 0, 200, 100] }));
    stage.setSelection(['e1']);
    stage.setPointEditing({ id: 'e1', selected: [1] });
    const points = stage.endpointHandles();
    expect(points.map((p) => p.radius())).toEqual([10, 10, 10]);
    expect(points[1].fill()).toBe('dodgerblue');
    expect(stage.selectionOutline()).toBeNull();
    expect(stage.middleHandles()).toHaveLength(2);
  });
});

// The line is hidden under its label's box plus 5, as Excalidraw's
// `renderElement.ts:787-817`.
describe("the line under an arrow's label", () => {
  it('is clipped out where the label sits, and only when there is one', () => {
    const stage = mounted(themeA);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0], label: 'sends' }));
    const clip = stage.bodyFor('e1')!.getParent() as Konva.Group;
    expect(typeof clip.clipFunc()).toBe('function');
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 200, h: 0, points: [0, 0, 200, 0] }));
    expect((stage.bodyFor('e1')!.getParent() as Konva.Group).clipFunc()).toBeFalsy();
  });
});

// The highlight's pulse starts with a candidate, stops when
// there is none or the stage goes, and never starts under reduced motion.
describe("the attach highlight's pulse", () => {
  const scene = { elements: [{ id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 }] as SceneElement[] };
  it('runs while something is highlighted', () => {
    const stage = newStage({ read: reader({ '--duration-pulse': '1200ms' }) });
    stage.mount(host());
    stage.render(scene);
    stage.setBindingCandidates(['a']);
    expect(stage.pulsing()).toBe(true);
    stage.setBindingCandidates([]);
    expect(stage.pulsing()).toBe(false);
    stage.setBindingCandidates(['a']);
    stage.destroy();
    expect(stage.pulsing()).toBe(false);
  });
  it('does not run under reduced motion', () => {
    const stage = newStage({ read: reader({ '--duration-pulse': '0ms' }) });
    stage.mount(host());
    stage.render(scene);
    stage.setBindingCandidates(['a']);
    expect(stage.pulsing()).toBe(false);
  });
});

// The language on a code block's top edge, the border broken for it.
describe("a code block's language on the canvas", () => {
  const read = reader({ '--text-code-language': '10px', '--size-code-language-inset': '12px', '--size-code-language-clearance': '4px', '--color-text-muted': 'gray', '--leading-tight': '1.2' });
  it('names the language on the top edge, and breaks the border behind it', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'code', x: 0, y: 0, w: 200, h: 60, code: 'x', language: 'go', measuredWidth: 200, measuredHeight: 60 }));
    const tag = stage.codeLanguage('e1')!;
    expect(tag.text()).toBe('Go');
    expect(tag.x()).toBe(12);
    // The body keeps its fill and loses its stroke; the border is drawn apart,
    // with a hole from 4 before the name to 4 after it.
    expect(stage.bodyFor('e1')!.strokeEnabled()).toBe(false);
    const rects: number[][] = [];
    (stage.codeBorder('e1')!.getParent() as Konva.Group).clipFunc()!({ rect: (...args: number[]) => rects.push(args) } as never, undefined as never);
    const hole = rects[1];
    expect(hole[0]).toBe(12 - 4);
    expect(hole[2]).toBeGreaterThan(8);
    stage.render(one({ type: 'code', x: 0, y: 0, w: 200, h: 60, code: 'x', measuredWidth: 200, measuredHeight: 60 }));
    expect(stage.codeLanguage('e1')).toBeNull();
  });

  it('breaks the selection outline behind the language, where the border breaks', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'code', x: 30, y: 40, w: 200, h: 60, code: 'x', language: 'go', measuredWidth: 200, measuredHeight: 60 }));
    stage.setSelection(['e1']);
    const rects: number[][] = [];
    const holder = stage.selectionOutline()!.getParent() as Konva.Group;
    holder.clipFunc()!({ rect: (...args: number[]) => rects.push(args) } as never, undefined as never);
    // The border's hole, moved to where the block is.
    expect(rects[1][0]).toBe(30 + 12 - 4);
    expect(rects[1][2]).toBeGreaterThan(8);
  });

  it('leaves the selection outline whole on a block with no language', () => {
    const stage = newStage({ read });
    stage.mount(host());
    stage.render(one({ type: 'code', x: 30, y: 40, w: 200, h: 60, code: 'x', measuredWidth: 200, measuredHeight: 60 }));
    stage.setSelection(['e1']);
    expect((stage.selectionOutline()!.getParent() as Konva.Group).clipFunc()).toBeFalsy();
  });
});

describe('a label along its arrow', () => {
  it('turns with the arrow', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 0, h: 100, points: [0, 0, 0, 100], label: 'down', labelDirection: 'along' }));
    expect(stage.labelFor('e1')!.rotation()).toBeCloseTo(90, 5);
  });
});

describe('the dot grid', () => {
  const gridRead = reader({
    '--color-canvas-dot': 'gainsboro',
    '--size-canvas-grid': '20px',
    '--size-canvas-dot': '1px',
    '--size-canvas-grid-min': '12px',
  });

  it('draws beneath every element, on a layer nothing hit-tests', () => {
    const stage = mounted(gridRead);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50 }));
    const grid = stage.gridLayer()!;
    expect(grid).not.toBeNull();
    expect(grid.zIndex()).toBe(0);
    expect(grid.listening()).toBe(false);
    expect(grid.getChildren().every((node) => !node.listening())).toBe(true);
  });

  it('draws one square per dot in view, in the dot colour, sized for the zoom', () => {
    const stage = mounted(gridRead);
    const rect = vi.spyOn(Konva.Context.prototype, 'rect');
    stage.setViewport({ zoom: 2, pan: { x: 0, y: 0 } });
    stage.gridLayer()!.draw();
    // 800 x 600 at 2x is 400 x 300 of drawing: 21 columns by 16 rows.
    expect(rect).toHaveBeenCalledTimes(21 * 16);
    // A 1px radius on screen is 1 unit across at 2x.
    expect(rect.mock.calls[0].slice(2)).toEqual([1, 1]);
  });

  it('is left out of an image of the stage, and shown again after', () => {
    const stage = mounted(gridRead);
    const seen: boolean[] = [];
    const grid = stage.gridLayer()!;
    const original = Konva.Stage.prototype.toCanvas;
    vi.spyOn(Konva.Stage.prototype, 'toCanvas').mockImplementation(function (this: Konva.Stage, config) {
      seen.push(grid.visible());
      return original.call(this, config);
    });
    stage.toCanvas();
    expect(seen).toEqual([false]);
    expect(grid.visible()).toBe(true);
  });

  it('is not drawn at all on a stage that asks for none', () => {
    const stage = newStage({ read: gridRead, grid: false });
    stage.mount(host());
    expect(stage.gridLayer()).toBeNull();
  });
});

describe('the selection handles', () => {
  const handleRead = reader({
    '--color-selection-handle': 'dodgerblue',
    '--color-surface-raised': 'white',
    '--size-selection-handle': '8px',
    '--size-handle-border': '1.5px',
    '--radius-handle': '2px',
    '--size-point-handle': '10px',
    '--size-rotate-gap': '16px',
  });

  it('draws resize handles raised, bordered and rounded, their border inside their size', () => {
    const stage = mounted(handleRead);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50 }));
    stage.setSelection(['e1']);
    const square = stage.selectionHandles()[0];
    expect(square.fill()).toBe('white');
    expect(square.stroke()).toBe('dodgerblue');
    expect(square.strokeWidth()).toBe(1.5);
    expect(square.cornerRadius()).toBe(2);
    expect(square.width() + square.strokeWidth()).toBe(8);
  });

  it('draws the rotate handle at the point handle size, with the same border and fill', () => {
    const stage = mounted(handleRead);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50 }));
    stage.setSelection(['e1']);
    const rotate = stage.rotateHandle()!;
    expect(rotate.fill()).toBe('white');
    expect(rotate.strokeWidth()).toBe(1.5);
    expect(rotate.radius() * 2 + rotate.strokeWidth()).toBe(10);
  });

  it('keeps handles screen-sized at any zoom', () => {
    const stage = mounted(handleRead);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 50 }));
    stage.setSelection(['e1']);
    stage.setViewport({ zoom: 2, pan: { x: 0, y: 0 } });
    const square = stage.selectionHandles()[0];
    expect(square.strokeWidth()).toBe(0.75);
    expect(square.cornerRadius()).toBe(1);
  });
});
