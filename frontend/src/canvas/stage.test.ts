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

// Milestone 6.3's style properties, drawn. Konva nodes are inspected, never
// only the scene: Milestone 6 shipped every shape unstyled with green tests.
describe('style properties on the stage', () => {
  const theme = reader({
    '--color-shape-fill': 'ivory',
    '--color-shape-stroke': 'slategray',
    '--color-shape-text': 'black',
    '--size-shape-stroke': '1.5px',
    '--size-dash': '6px',
    '--radius-shape-round': '32px',
    '--size-dot': '2px',
    '--text-body': '13px',
    '--leading-tight': '1.2',
    '--font-ui': 'Geist',
    '--size-label-inset': '6px',
  });

  it('draws a shape at its stroke width, style, corner radius and opacity', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 60, strokeWidth: 4, strokeStyle: 'dashed', edges: 'round', opacity: 40 }));
    const body = stage.bodyFor('e1') as Konva.Rect;
    expect(body.strokeWidth()).toBe(4);
    expect(body.dash().length).toBeGreaterThan(0);
    expect(body.cornerRadius()).toBeGreaterThan(0);
    expect(stage.nodeFor('e1')!.opacity()).toBeCloseTo(0.4, 5);
    stage.destroy();
  });

  it('leaves the defaults alone when the keys are absent', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 10, h: 10 }));
    const body = stage.bodyFor('e1') as Konva.Rect;
    expect(body.strokeWidth()).toBe(1.5);
    expect(body.dash()).toEqual([]);
    expect(body.cornerRadius()).toBe(0);
    expect(stage.nodeFor('e1')!.opacity()).toBe(1);
    stage.destroy();
  });

  it('draws a dotted line differently from a dashed one', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'line', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], strokeStyle: 'dotted' }));
    const dotted = (stage.bodyFor('e1') as Konva.Line).dash();
    stage.render(one({ type: 'line', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], strokeStyle: 'dashed' }));
    const dashed = (stage.bodyFor('e1') as Konva.Line).dash();
    expect(dotted.length).toBeGreaterThan(0);
    expect(dashed).not.toEqual(dotted);
    stage.destroy();
  });

  it('draws text at its size and alignment', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'text', x: 0, y: 0, w: 80, h: 20, text: 'hi', measuredWidth: 80, measuredHeight: 20, fontSize: 28, align: 'right' }));
    const body = stage.bodyFor('e1') as Konva.Text;
    expect(body.fontSize()).toBe(28);
    expect(body.align()).toBe('right');
    stage.destroy();
  });

  it('draws a label at its size and both alignments', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'rect', x: 0, y: 0, w: 100, h: 60, label: 'L', fontSize: 16, align: 'left', verticalAlign: 'top' }));
    const label = stage.labelFor('e1')!;
    expect(label.fontSize()).toBe(16);
    expect(label.align()).toBe('left');
    expect(label.verticalAlign()).toBe('top');
    stage.destroy();
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
    stage.destroy();
  });

  it('draws an elbow arrow as orthogonal segments', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 100, h: 60, points: [0, 0, 100, 60], arrowType: 'elbow' }));
    const points = (stage.bodyFor('e1') as Konva.Arrow).points();
    expect(points.length).toBeGreaterThan(4);
    for (let i = 0; i + 3 < points.length; i += 2) {
      expect(points[i + 1] === points[i + 3] || points[i] === points[i + 2]).toBe(true);
    }
    stage.destroy();
  });

  it('draws the head shape each end names, and none where there is none', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], startArrowhead: 'circle', endArrowhead: 'diamond' }));
    expect(stage.arrowHeads('e1').map((head) => head.name())).toEqual(['circle', 'diamond']);

    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], endArrowhead: 'none' }));
    expect(stage.arrowHeads('e1')).toHaveLength(0);
    stage.destroy();
  });

  it('draws a head only where the arrow names one', () => {
    const stage = mounted(theme);
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 50, h: 0, points: [0, 0, 50, 0], startArrowhead: 'circle', endArrowhead: 'none' }));
    expect(stage.arrowHeads('e1').map((head) => head.name())).toEqual(['circle']);
    // Konva's own pointer is off: it draws triangles and nothing else.
    const body = stage.bodyFor('e1') as Konva.Arrow;
    expect(body.pointerAtBeginning()).toBe(false);
    expect(body.pointerAtEnding()).toBe(false);
    stage.destroy();
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
    stage.destroy();
  });

  it('leaves an upright element at its corner', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    const node = stage.nodeFor('e1')!;
    expect(node.rotation()).toBe(0);
    expect(node.x()).toBe(10);
    expect(node.y()).toBe(20);
    stage.destroy();
  });

  it('takes the rotation off again when the element is turned back', () => {
    const stage = mounted();
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50, angle: 45 }));
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    const node = stage.nodeFor('e1')!;
    expect(node.rotation()).toBe(0);
    expect(node.x()).toBe(10);
    stage.destroy();
  });
});

describe('the selection of a rotated element', () => {
  const selectionRead = reader({
    '--color-selection-handle': 'dodgerblue',
    '--size-selection-handle': '8px',
    '--size-rotate-gap': '16px',
  });

  it('turns the outline with the element', () => {
    const stage = new CanvasStage({ read: selectionRead });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50, angle: 30 }));
    stage.setSelection(['e1']);
    const outline = stage.selectionOutline()!;
    expect(outline.rotation()).toBe(30);
    expect(outline.width()).toBe(100);
    stage.destroy();
  });

  it('gives the selection a rotate handle above it, and none with nothing selected', () => {
    const stage = new CanvasStage({ read: selectionRead });
    stage.mount(host());
    stage.render(one({ type: 'rect', x: 10, y: 20, w: 100, h: 50 }));
    stage.setSelection(['e1']);
    const rotate = stage.rotateHandle()!;
    expect(rotate.x()).toBe(60);
    // 16 above the box's top edge at y 20, so a gap of zero fails here.
    expect(rotate.y()).toBe(4);
    stage.setSelection([]);
    expect(stage.rotateHandle()).toBeNull();
    stage.destroy();
  });

  // Several elements have no shared angle, so their outline stays upright and
  // holds everything as drawn.
  it('keeps a multi-selection outline upright, around the turned boxes', () => {
    const stage = new CanvasStage({ read: selectionRead });
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
    stage.destroy();
  });
});

// A handle that cannot do anything is a bug report waiting to happen: an
// elbow arrow is the one element rotation passes over.
describe('the rotate handle and what cannot rotate', () => {
  it('is not drawn for a selection of elbow arrows only', () => {
    const stage = new CanvasStage({
      read: reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px', '--size-rotate-gap': '16px' }),
    });
    stage.mount(host());
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 40, h: 20, points: [0, 0, 40, 20], arrowType: 'elbow' }));
    stage.setSelection(['e1']);
    expect(stage.rotateHandle()).toBeNull();
    expect(stage.selectionHandleCount()).toBe(8);
    stage.destroy();
  });
});

// A binding whose target is gone freezes the endpoint and says so, rather
// than the arrow moving or vanishing (canvas-architecture.md).
describe('an arrow whose target has gone', () => {
  const read = reader({
    '--color-shape-stroke': 'slategray',
    '--color-selection-handle': 'dodgerblue',
    '--color-danger': 'crimson',
    '--size-selection-handle': '8px',
    '--size-shape-stroke': '1.5px',
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
    const stage = new CanvasStage({ read });
    stage.mount(host());

    stage.render(bound(true));
    expect(stage.detachedMarkers()).toHaveLength(0);

    stage.render(bound(false));
    const markers = stage.detachedMarkers();
    expect(markers).toHaveLength(1);
    // At the frozen end, where the arrow was last drawn. The marker lives in
    // the arrow's group, so its place on the canvas is the absolute one.
    expect(markers[0].getAbsolutePosition()).toEqual({ x: 200, y: 30 });
    stage.destroy();
  });

  it('takes the mark away when the target comes back', () => {
    const stage = new CanvasStage({ read });
    stage.mount(host());
    stage.render(bound(false));
    stage.render(bound(true));
    expect(stage.detachedMarkers()).toHaveLength(0);
    stage.destroy();
  });
});

// An arrow may carry a label, drawn where the path passes its middle.
describe('an arrow with a label', () => {
  it('draws it at the middle of the routed path', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 10, y: 20, w: 100, h: 0, points: [0, 0, 100, 0], label: 'sends to' }));
    const label = stage.labelFor('e1')!;
    expect(label.text()).toBe('sends to');
    // Centred on the midpoint, which is (60, 20) on the canvas.
    expect(label.getAbsolutePosition().x + label.width() / 2).toBe(60);
    stage.destroy();
  });

  it('takes the label away when it is cleared', () => {
    const stage = mounted();
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 10, h: 0, points: [0, 0, 10, 0], label: 'x' }));
    stage.render(one({ type: 'arrow', x: 0, y: 0, w: 10, h: 0, points: [0, 0, 10, 0] }));
    expect(stage.labelFor('e1')).toBeUndefined();
    stage.destroy();
  });
});

// While an arrow is being drawn onto a shape, that shape is highlighted, so
// the user can see the attachment before letting go.
describe('the attachment highlight', () => {
  const read = reader({ '--color-selection-handle': 'dodgerblue', '--size-selection-handle': '8px' });

  it('outlines the candidates it is given, and clears them', () => {
    const stage = new CanvasStage({ read });
    stage.mount(host());
    stage.render({
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, w: 60, h: 60, z: 1 },
        { id: 'b', type: 'rect', x: 200, y: 0, w: 60, h: 60, z: 2 },
      ] as SceneElement[],
    });

    stage.setBindingCandidates(['a']);
    const outlines = stage.bindingHighlights();
    expect(outlines).toHaveLength(1);
    expect(outlines[0].getAbsolutePosition()).toEqual({ x: 0, y: 0 });
    expect(outlines[0].width()).toBe(60);

    stage.setBindingCandidates([]);
    expect(stage.bindingHighlights()).toHaveLength(0);
    stage.destroy();
  });
});

// A selected arrow shows a handle at each end, where the hit zone is: for an
// elbow or an arc the box corners are nowhere near the ends.
describe('the ends of a selected arrow', () => {
  it('draws a handle at each end, and clears them with the selection', () => {
    const stage = new CanvasStage({
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
    stage.destroy();
  });
});
